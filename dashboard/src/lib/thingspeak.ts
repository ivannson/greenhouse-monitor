// Data shape matches the server-side proxy in dashboard/api/feeds.ts.
// The four ThingSpeak fields are defined by the firmware call in
// src/main.cpp:619-624:
//   field1 = AHT20 temperature (°C)
//   field2 = BMP280 temperature (°C)
//   field3 = relative humidity (%)
//   field4 = pressure (hPa)
// The server averages field1 + field2 into a single `temp` value.

export interface Reading {
  /** ISO 8601 timestamp from ThingSpeak `created_at`. */
  ts: string;
  /** Combined temperature (mean of AHT20 and BMP280), °C, or null if both missing. */
  temp: number | null;
  tempAht: number | null;
  tempBmp: number | null;
  humidity: number | null;
  pressure: number | null;
}

export interface FeedsResponse {
  readings: Reading[];
  range: { from: string; to: string; preset: Preset };
}

export type Preset = '6h' | '24h' | '7d' | '30d' | 'custom';

export interface FetchArgs {
  preset: Preset;
  from?: string; // YYYY-MM-DD, required for custom
  to?: string; // YYYY-MM-DD, required for custom
}

export async function fetchFeeds(args: FetchArgs, signal?: AbortSignal): Promise<FeedsResponse> {
  const params = new URLSearchParams({ range: args.preset });
  if (args.preset === 'custom') {
    if (args.from) params.set('from', args.from);
    if (args.to) params.set('to', args.to);
  }
  const res = await fetch(`/api/feeds?${params.toString()}`, { signal });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body?.error ?? `HTTP ${res.status}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  return res.json();
}

export type MetricKey = 'temp' | 'humidity' | 'pressure';

export const METRICS: readonly MetricKey[] = ['temp', 'humidity', 'pressure'] as const;
