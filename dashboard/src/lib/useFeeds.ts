import { useEffect, useRef, useState } from 'react';
import { fetchFeeds, type FeedsResponse, type Preset } from './thingspeak';

export interface FeedsState {
  data: FeedsResponse | null;
  error: Error | null;
  loading: boolean;
  errorStatus: number | null;
  reload: () => void;
  lastFetchedAt: Date | null;
}

interface Params {
  preset: Preset;
  from?: string;
  to?: string;
  nonce?: number;
  /** Auto-refresh interval in ms. Omit to disable. */
  refreshIntervalMs?: number;
}

export function useFeeds({ preset, from, to, nonce, refreshIntervalMs }: Params): FeedsState {
  const [data, setData] = useState<FeedsResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);
  const reloadRef = useRef(() => setTick((t) => t + 1));

  useEffect(() => {
    if (preset === 'custom' && (!from || !to)) {
      setData(null);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    setErrorStatus(null);
    fetchFeeds({ preset, from, to }, ctrl.signal)
      .then((res) => {
        setData(res);
        setLastFetchedAt(new Date());
        setLoading(false);
      })
      .catch((e: Error & { status?: number }) => {
        if (ctrl.signal.aborted) return;
        setError(e);
        setErrorStatus(e.status ?? null);
        setLoading(false);
      });
    return () => ctrl.abort();
  }, [preset, from, to, tick, nonce]);

  useEffect(() => {
    if (!refreshIntervalMs) return;
    const id = window.setInterval(() => reloadRef.current(), refreshIntervalMs);
    return () => clearInterval(id);
  }, [refreshIntervalMs]);

  return {
    data,
    error,
    loading,
    errorStatus,
    lastFetchedAt,
    reload: () => setTick((t) => t + 1),
  };
}
