import type { VercelRequest, VercelResponse } from '@vercel/node';

// Keep in sync with dashboard/src/lib/constants.ts
const CUTOFF_ISO = '2026-04-01T00:00:00+03:00';
const TZ = 'Europe/Moscow';
const THINGSPEAK_BASE = 'https://api.thingspeak.com';

type Preset = '6h' | '24h' | '7d' | '30d' | 'custom';

interface ThingSpeakFeed {
  created_at: string;
  entry_id: number;
  field1: string | null;
  field2: string | null;
  field3: string | null;
  field4: string | null;
}

interface ThingSpeakResponse {
  channel?: unknown;
  feeds?: ThingSpeakFeed[];
}

function parseNumber(raw: string | null): number | null {
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function toThingSpeakTimestamp(d: Date): string {
  // ThingSpeak accepts YYYY-MM-DD%20HH:MM:SS in the `timezone` query we pass.
  // Formatting the Date in Europe/Moscow so start/end mean wall-clock MSK.
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

function pickAverage(preset: Preset, spanMs: number): number | undefined {
  if (preset === '6h') return undefined;
  if (preset === '24h') return undefined;
  if (preset === '7d') return 10;
  if (preset === '30d') return 60;
  // custom
  const day = 24 * 60 * 60 * 1000;
  if (spanMs < 2 * day) return undefined;
  if (spanMs < 14 * day) return 10;
  if (spanMs < 60 * day) return 60;
  return 240;
}

function resolveRange(q: VercelRequest['query']): {
  preset: Preset;
  start: Date;
  end: Date;
  error?: string;
} {
  const now = new Date();
  const preset = (typeof q.range === 'string' ? q.range : '7d') as Preset;
  const cutoff = new Date(CUTOFF_ISO);

  if (preset === '6h') {
    return { preset, start: new Date(now.getTime() - 6 * 60 * 60 * 1000), end: now };
  }
  if (preset === '24h') {
    return { preset, start: new Date(now.getTime() - 24 * 60 * 60 * 1000), end: now };
  }
  if (preset === '7d') {
    return { preset, start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), end: now };
  }
  if (preset === '30d') {
    return { preset, start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), end: now };
  }
  if (preset === 'custom') {
    const from = typeof q.from === 'string' ? q.from : '';
    const to = typeof q.to === 'string' ? q.to : '';
    if (!from || !to) {
      return { preset, start: cutoff, end: now, error: 'custom range requires from and to' };
    }
    // Interpret YYYY-MM-DD as a calendar day in Europe/Moscow
    const start = new Date(`${from}T00:00:00+03:00`);
    const end = new Date(`${to}T23:59:59+03:00`);
    if (!(start instanceof Date) || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return { preset, start: cutoff, end: now, error: 'invalid date format' };
    }
    if (start >= end) {
      return { preset, start: cutoff, end: now, error: 'from must be before to' };
    }
    return { preset, start, end };
  }
  // All-time fallback (used by Overview when no preset is supplied)
  return { preset: 'custom', start: cutoff, end: now };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const channelId = process.env.THINGSPEAK_CHANNEL_ID;
  const readKey = process.env.THINGSPEAK_READ_KEY;

  if (!channelId || !readKey) {
    res.status(500).json({
      error: 'server not configured',
      hint: 'set THINGSPEAK_CHANNEL_ID and THINGSPEAK_READ_KEY',
    });
    return;
  }

  const { preset, start, end, error } = resolveRange(req.query);
  if (error) {
    res.status(400).json({ error });
    return;
  }

  // Enforce cutoff on the request we send to ThingSpeak
  const cutoff = new Date(CUTOFF_ISO);
  const effectiveStart = start < cutoff ? cutoff : start;
  if (effectiveStart >= end) {
    res.status(200).json({ readings: [], range: { from: effectiveStart.toISOString(), to: end.toISOString() } });
    return;
  }

  const avg = pickAverage(preset, end.getTime() - effectiveStart.getTime());

  const params = new URLSearchParams({
    api_key: readKey,
    start: toThingSpeakTimestamp(effectiveStart),
    end: toThingSpeakTimestamp(end),
    timezone: TZ,
    results: '8000',
  });
  if (avg != null) params.set('average', String(avg));

  const url = `${THINGSPEAK_BASE}/channels/${encodeURIComponent(channelId)}/feeds.json?${params.toString()}`;

  let upstream: Response;
  try {
    upstream = await fetch(url, { headers: { Accept: 'application/json' } });
  } catch (e) {
    res.status(502).json({ error: 'failed to reach ThingSpeak', detail: String(e) });
    return;
  }

  if (!upstream.ok) {
    res.status(upstream.status).json({ error: 'ThingSpeak returned an error', status: upstream.status });
    return;
  }

  const data = (await upstream.json()) as ThingSpeakResponse;
  const cutoffMs = cutoff.getTime();

  const readings = (data.feeds ?? [])
    .map((f) => {
      const ts = new Date(f.created_at);
      return {
        ts: ts.toISOString(),
        tsMs: ts.getTime(),
        tempAht: parseNumber(f.field1),
        tempBmp: parseNumber(f.field2),
        humidity: parseNumber(f.field3),
        pressure: parseNumber(f.field4),
      };
    })
    .filter((r) => Number.isFinite(r.tsMs) && r.tsMs >= cutoffMs)
    .map((r) => {
      const temps = [r.tempAht, r.tempBmp].filter((v): v is number => v != null);
      const temp = temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : null;
      return {
        ts: r.ts,
        temp,
        tempAht: r.tempAht,
        tempBmp: r.tempBmp,
        humidity: r.humidity,
        pressure: r.pressure,
      };
    });

  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
  res.status(200).json({
    readings,
    range: { from: effectiveStart.toISOString(), to: end.toISOString(), preset },
  });
}
