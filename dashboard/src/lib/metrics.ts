import type { MetricKey } from './thingspeak';
import type { Thresholds } from './thresholds';
import { t, type Lang } from './i18n';

export type Status = 'ok' | 'low' | 'high' | 'none';

export interface MetricMeta {
  key: MetricKey;
  labelKey: Parameters<typeof t>[0];
  unitKey: Parameters<typeof t>[0];
  decimals: number;
  /** pressure range shows low-pressure as "stormy" not "too dry"; labels per metric. */
  statusLabel: (s: Status, lang: Lang) => string;
  tint: string; // tailwind colour swatch suffix used in charts
}

export const METRIC_META: Record<MetricKey, MetricMeta> = {
  temp: {
    key: 'temp',
    labelKey: 'metricTemperature',
    unitKey: 'unitC',
    decimals: 1,
    tint: '#ef4444',
    statusLabel: (s, lang) =>
      s === 'low'
        ? t('statusTooCold', lang)
        : s === 'high'
        ? t('statusTooHot', lang)
        : s === 'none'
        ? t('statusNoData', lang)
        : t('statusOk', lang),
  },
  humidity: {
    key: 'humidity',
    labelKey: 'metricHumidity',
    unitKey: 'unitPct',
    decimals: 0,
    tint: '#2563eb',
    statusLabel: (s, lang) =>
      s === 'low'
        ? t('statusTooDry', lang)
        : s === 'high'
        ? t('statusTooHumid', lang)
        : s === 'none'
        ? t('statusNoData', lang)
        : t('statusOk', lang),
  },
  pressure: {
    key: 'pressure',
    labelKey: 'metricPressure',
    unitKey: 'unitHpa',
    decimals: 0,
    tint: '#7c3aed',
    statusLabel: (s, lang) =>
      s === 'low'
        ? t('statusLowPressure', lang)
        : s === 'high'
        ? t('statusHighPressure', lang)
        : s === 'none'
        ? t('statusNoData', lang)
        : t('statusOk', lang),
  },
};

export function evaluateStatus(metric: MetricKey, value: number | null, thresholds: Thresholds): Status {
  if (value == null || !Number.isFinite(value)) return 'none';
  const [lo, hi] = thresholds[metric];
  if (value < lo) return 'low';
  if (value > hi) return 'high';
  return 'ok';
}

export function formatValue(metric: MetricKey, value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const meta = METRIC_META[metric];
  return value.toFixed(meta.decimals);
}
