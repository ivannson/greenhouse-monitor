import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const CUTOFF_ISO = '2026-04-01T00:00:00+03:00';
const TZ = 'Europe/Moscow';
const THINGSPEAK_BASE = 'https://api.thingspeak.com';

type Preset = '24h' | '7d' | '30d' | 'custom';

function parseNumber(raw: string | null): number | null {
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function toThingSpeakTimestamp(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

function pickAverage(preset: Preset, spanMs: number): number | undefined {
  if (preset === '24h') return undefined;
  if (preset === '7d') return 10;
  if (preset === '30d') return 60;
  const day = 24 * 60 * 60 * 1000;
  if (spanMs < 2 * day) return undefined;
  if (spanMs < 14 * day) return 10;
  if (spanMs < 60 * day) return 60;
  return 240;
}

function resolveRange(search: URLSearchParams): {
  preset: Preset; start: Date; end: Date; error?: string;
} {
  const now = new Date();
  const preset = (search.get('range') ?? '7d') as Preset;
  const cutoff = new Date(CUTOFF_ISO);
  if (preset === '24h') return { preset, start: new Date(now.getTime() - 86400000), end: now };
  if (preset === '7d') return { preset, start: new Date(now.getTime() - 7 * 86400000), end: now };
  if (preset === '30d') return { preset, start: new Date(now.getTime() - 30 * 86400000), end: now };
  if (preset === 'custom') {
    const from = search.get('from') ?? '';
    const to = search.get('to') ?? '';
    if (!from || !to) return { preset, start: cutoff, end: now, error: 'custom range requires from and to' };
    const start = new Date(`${from}T00:00:00+03:00`);
    const end = new Date(`${to}T23:59:59+03:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
      return { preset, start: cutoff, end: now, error: 'invalid date' };
    if (start >= end) return { preset, start: cutoff, end: now, error: 'from must be before to' };
    return { preset, start, end };
  }
  return { preset: 'custom', start: cutoff, end: now };
}

function devApiPlugin(channelId: string, readKey: string): Plugin {
  return {
    name: 'dev-api-feeds',
    configureServer(server) {
      server.middlewares.use('/api/feeds', async (req, res) => {
        const url = new URL(req.url ?? '', 'http://localhost');
        const { preset, start, end, error } = resolveRange(url.searchParams);
        if (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error }));
          return;
        }
        const cutoff = new Date(CUTOFF_ISO);
        const effectiveStart = start < cutoff ? cutoff : start;
        if (effectiveStart >= end) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ readings: [], range: { from: effectiveStart.toISOString(), to: end.toISOString() } }));
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
        const tsUrl = `${THINGSPEAK_BASE}/channels/${encodeURIComponent(channelId)}/feeds.json?${params}`;
        try {
          const upstream = await fetch(tsUrl, { headers: { Accept: 'application/json' } });
          if (!upstream.ok) {
            res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'ThingSpeak error', status: upstream.status }));
            return;
          }
          const data = await upstream.json() as { feeds?: Record<string, string | null>[] };
          const cutoffMs = cutoff.getTime();
          const readings = (data.feeds ?? [])
            .map((f) => {
              const ts = new Date(f['created_at'] ?? '');
              return { ts: ts.toISOString(), tsMs: ts.getTime(), tempAht: parseNumber(f['field1'] ?? null), tempBmp: parseNumber(f['field2'] ?? null), humidity: parseNumber(f['field3'] ?? null), pressure: parseNumber(f['field4'] ?? null) };
            })
            .filter((r) => Number.isFinite(r.tsMs) && r.tsMs >= cutoffMs)
            .map((r) => {
              const temps = [r.tempAht, r.tempBmp].filter((v): v is number => v != null);
              const temp = temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : null;
              return { ts: r.ts, temp, tempAht: r.tempAht, tempBmp: r.tempBmp, humidity: r.humidity, pressure: r.pressure };
            });
          res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
          res.end(JSON.stringify({ readings, range: { from: effectiveStart.toISOString(), to: end.toISOString(), preset } }));
        } catch (e) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'failed to reach ThingSpeak', detail: String(e) }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const channelId = env.THINGSPEAK_CHANNEL_ID ?? '';
  const readKey = env.THINGSPEAK_READ_KEY ?? '';
  return {
    plugins: [
      react(),
      devApiPlugin(channelId, readKey),
    ],
    server: { port: 5173 },
    build: { outDir: 'dist', sourcemap: true },
  };
});
