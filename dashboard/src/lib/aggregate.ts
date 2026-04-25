import type { MetricKey, Reading } from './thingspeak';

export interface WindowStat {
  /** Numeric key (window index). */
  key: number;
  /** UTC millis at the centre of the window — used as x-axis value. */
  midMs: number;
  mean: number;
  min: number;
  max: number;
  count: number;
}

// Firmware publishes every 10 minutes (see src/main.cpp:22, DEEP_SLEEP_SECONDS = 600).
// minSamples is derived from the window size: require at least ~1/12 of the window to be
// filled (for a 6-h window that's ~3 readings; for 24-h it's ~12).
const MAD_SIGMA = 1.4826; // scales MAD to a Gaussian-consistent σ estimator
const REJECT_K = 3;

const MSK_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC+3

function windowKeyFromMs(ms: number, windowMs: number): number {
  // Index of the window that contains this timestamp, bucketed in MSK wall-clock time.
  return Math.floor((ms + MSK_OFFSET_MS) / windowMs);
}

function midMsFromKey(key: number, windowMs: number): number {
  // Centre of the window in UTC millis.
  return (key + 0.5) * windowMs - MSK_OFFSET_MS;
}

function extract(r: Reading, metric: MetricKey): number | null {
  const v = r[metric];
  return v == null ? null : v;
}

function median(xs: number[]): number {
  const sorted = [...xs].sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return NaN;
  const mid = Math.floor(n / 2);
  return n % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Bucket readings into windows of `windowHours` hours (in Europe/Moscow wall time),
 * apply MAD-based outlier rejection within each window, and return per-window
 * {mean, min, max, count} statistics.
 *
 * A spurious spike (e.g. a single 7°C reading in a 27°C window) is excluded before
 * computing min/max, so the error bars reflect the real within-window range.
 */
export function windowedStats(
  readings: Reading[],
  metric: MetricKey,
  windowHours: number,
): WindowStat[] {
  const windowMs = windowHours * 60 * 60 * 1000;
  // Require at least ~1/12 of the window filled (min 2 samples).
  const minSamples = Math.max(2, Math.round((windowHours * 60) / 10 / 12));

  const byKey = new Map<number, number[]>();
  for (const r of readings) {
    const v = extract(r, metric);
    if (v == null) continue;
    const ts = new Date(r.ts).getTime();
    if (!Number.isFinite(ts)) continue;
    const key = windowKeyFromMs(ts, windowMs);
    const bucket = byKey.get(key);
    if (bucket) bucket.push(v);
    else byKey.set(key, [v]);
  }

  const out: WindowStat[] = [];
  for (const [key, values] of byKey) {
    if (values.length < minSamples) continue;

    const med = median(values);
    const mad = median(values.map((v) => Math.abs(v - med)));
    const tolerance = REJECT_K * MAD_SIGMA * mad;

    const kept = tolerance === 0 ? values : values.filter((v) => Math.abs(v - med) <= tolerance);
    if (kept.length < minSamples) continue;

    let sum = 0;
    let min = Infinity;
    let max = -Infinity;
    for (const v of kept) {
      sum += v;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    out.push({ key, midMs: midMsFromKey(key, windowMs), mean: sum / kept.length, min, max, count: kept.length });
  }
  out.sort((a, b) => a.midMs - b.midMs);
  return out;
}
