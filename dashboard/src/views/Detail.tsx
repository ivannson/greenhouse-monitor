import { useMemo, useState } from 'react';
import { RangePicker, type RangeValue } from '../components/RangePicker';
import { DetailChart } from '../components/DetailChart';
import { useFeeds } from '../lib/useFeeds';
import { METRICS } from '../lib/thingspeak';
import { t, type Lang } from '../lib/i18n';
import type { Thresholds } from '../lib/thresholds';
import { CUTOFF_ISO } from '../lib/constants';
import { formatMsk } from '../lib/tz';

interface Props {
  lang: Lang;
  thresholds: Thresholds;
}

const REFRESH_MS = 5 * 60 * 1000;

export function Detail({ lang, thresholds }: Props) {
  const [range, setRange] = useState<RangeValue>({ preset: '7d' });
  const { data, loading, error, errorStatus, lastFetchedAt } = useFeeds({
    preset: range.preset,
    from: range.from,
    to: range.to,
    refreshIntervalMs: REFRESH_MS,
  });

  const spanDays = useMemo(() => {
    if (range.preset === '6h') return 0.25;
    if (range.preset === '24h') return 1;
    if (range.preset === '7d') return 7;
    if (range.preset === '30d') return 30;
    if (range.preset === 'custom' && range.from && range.to) {
      const a = new Date(`${range.from}T00:00:00+03:00`).getTime();
      const b = new Date(`${range.to}T23:59:59+03:00`).getTime();
      return Math.max(1, (b - a) / (24 * 60 * 60 * 1000));
    }
    return 7;
  }, [range]);

  const readings = data?.readings ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <RangePicker
          value={range}
          onChange={setRange}
          lang={lang}
          minDate={formatMsk(CUTOFF_ISO, 'yyyy-MM-dd')}
          maxDate={formatMsk(new Date(), 'yyyy-MM-dd')}
        />
        {lastFetchedAt ? (
          <p className="shrink-0 text-xs text-stone-400">
            {t('updated', lang)}: {formatMsk(lastFetchedAt, 'HH:mm')}
          </p>
        ) : null}
      </div>

      {error ? (
        <div className="card border border-red-200 bg-red-50 text-sm text-red-700">
          {errorStatus === 500 ? t('errorConfig', lang) : t('errorLoad', lang)}
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        {METRICS.map((m) => (
          <DetailChart key={m} metric={m} readings={readings} spanDays={spanDays} thresholds={thresholds} lang={lang} />
        ))}
      </div>

      {loading && readings.length === 0 ? <p className="text-center text-sm text-stone-500">{t('loading', lang)}</p> : null}
    </div>
  );
}
