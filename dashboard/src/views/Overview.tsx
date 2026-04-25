import { useMemo, useState } from 'react';
import { RangePicker, type RangeValue } from '../components/RangePicker';
import { OverviewChart } from '../components/OverviewChart';
import { useFeeds } from '../lib/useFeeds';
import { METRICS } from '../lib/thingspeak';
import { t, type Lang } from '../lib/i18n';
import type { Thresholds } from '../lib/thresholds';
import { windowedStats } from '../lib/aggregate';
import { CUTOFF_ISO } from '../lib/constants';
import { formatMsk } from '../lib/tz';

interface Props {
  lang: Lang;
  thresholds: Thresholds;
}

const WINDOW_HOURS = 6;
const REFRESH_MS = 5 * 60 * 1000;

function defaultRange(): RangeValue {
  return {
    preset: 'custom',
    from: formatMsk(CUTOFF_ISO, 'yyyy-MM-dd'),
    to: formatMsk(new Date(), 'yyyy-MM-dd'),
  };
}

export function Overview({ lang, thresholds }: Props) {
  const [range, setRange] = useState<RangeValue>(() => defaultRange());
  const { data, loading, error, errorStatus, lastFetchedAt } = useFeeds({
    preset: 'custom',
    from: range.from,
    to: range.to,
    refreshIntervalMs: REFRESH_MS,
  });

  const readings = data?.readings ?? [];
  const statsByMetric = useMemo(
    () => Object.fromEntries(METRICS.map((m) => [m, windowedStats(readings, m, WINDOW_HOURS)])),
    [readings],
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-stone-800">{t('overviewDaily', lang)}</h2>
        <p className="mt-1 text-sm text-stone-500">{t('overviewHint', lang)}</p>
        {lastFetchedAt ? (
          <p className="mt-1 text-xs text-stone-400">
            {t('updated', lang)}: {formatMsk(lastFetchedAt, 'd MMM HH:mm')}
          </p>
        ) : null}
      </div>

      <RangePicker
        value={range}
        onChange={setRange}
        lang={lang}
        customOnly
        minDate={formatMsk(CUTOFF_ISO, 'yyyy-MM-dd')}
        maxDate={formatMsk(new Date(), 'yyyy-MM-dd')}
      />

      {error ? (
        <div className="card border border-red-200 bg-red-50 text-sm text-red-700">
          {errorStatus === 500 ? t('errorConfig', lang) : t('errorLoad', lang)}
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        {METRICS.map((m) => (
          <OverviewChart
            key={m}
            metric={m}
            stats={statsByMetric[m]!}
            thresholds={thresholds}
            lang={lang}
            windowHours={WINDOW_HOURS}
          />
        ))}
      </div>

      {loading && readings.length === 0 ? (
        <p className="text-center text-sm text-stone-500">{t('loading', lang)}</p>
      ) : null}
    </div>
  );
}
