import { useEffect, useState } from 'react';

export interface Thresholds {
  temp: [number, number];
  humidity: [number, number];
  pressure: [number, number];
  avgTempDaysAbove: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  temp: [10, 32],
  humidity: [40, 80],
  pressure: [980, 1040],
  avgTempDaysAbove: 10,
};

const STORAGE_KEY = 'greenhouse.thresholds.v1';

function read(): Thresholds {
  if (typeof window === 'undefined') return DEFAULT_THRESHOLDS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_THRESHOLDS;
    const parsed = JSON.parse(raw) as Partial<Thresholds> | null;
    return {
      temp: asPair(parsed?.temp, DEFAULT_THRESHOLDS.temp),
      humidity: asPair(parsed?.humidity, DEFAULT_THRESHOLDS.humidity),
      pressure: asPair(parsed?.pressure, DEFAULT_THRESHOLDS.pressure),
      avgTempDaysAbove: asNumber(parsed?.avgTempDaysAbove, DEFAULT_THRESHOLDS.avgTempDaysAbove),
    };
  } catch {
    return DEFAULT_THRESHOLDS;
  }
}

function asPair(raw: unknown, fallback: [number, number]): [number, number] {
  if (
    Array.isArray(raw) &&
    raw.length === 2 &&
    typeof raw[0] === 'number' &&
    typeof raw[1] === 'number' &&
    raw[0] < raw[1]
  ) {
    return [raw[0], raw[1]];
  }
  return fallback;
}

function asNumber(raw: unknown, fallback: number): number {
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : fallback;
}

export function useThresholds(): [Thresholds, (next: Thresholds) => void, () => void] {
  const [value, setValue] = useState<Thresholds>(() => read());

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      // storage may be unavailable — ignore
    }
  }, [value]);

  const reset = () => setValue(DEFAULT_THRESHOLDS);
  return [value, setValue, reset];
}
