import { useMemo, useState } from 'react';
import { DetailChart } from '../components/DetailChart';
import { DailyAverageChart } from '../components/DailyAverageChart';
import { MetricCard } from '../components/MetricCard';
import { RangePicker, type RangeValue } from '../components/RangePicker';
import { OverviewChart } from '../components/OverviewChart';
import { METRIC_META } from '../lib/metrics';
import { useFeeds } from '../lib/useFeeds';
import { METRICS, type MetricKey, type Preset } from '../lib/thingspeak';
import { t, type Lang } from '../lib/i18n';
import type { Thresholds } from '../lib/thresholds';
import { dailyAverageStats, windowedStats } from '../lib/aggregate';
import { CUTOFF_ISO } from '../lib/constants';
import { formatMsk } from '../lib/tz';

interface Props {
  lang: Lang;
  thresholds: Thresholds;
  onThresholdsChange: (next: Thresholds) => void;
}

const WINDOW_HOURS = 6;
const REFRESH_MS = 5 * 60 * 1000;
const DETAIL_PRESETS: { key: Preset; labelKey: Parameters<typeof t>[0] }[] = [
  { key: '6h', labelKey: 'rangeLast6h' },
  { key: '24h', labelKey: 'rangeLast1d' },
  { key: '7d', labelKey: 'rangeLast7d' },
  { key: '30d', labelKey: 'rangeLast30d' },
];

function defaultRange(): RangeValue {
  return { preset: '7d' };
}

function presetSpanDays(preset: Preset): number {
  if (preset === '6h') return 0.25;
  if (preset === '24h') return 1;
  if (preset === '7d') return 7;
  return 30;
}

export function Overview({ lang, thresholds, onThresholdsChange }: Props) {
  const [range, setRange] = useState<RangeValue>(() => defaultRange());
  const [activeMetric, setActiveMetric] = useState<MetricKey | null>(null);
  const [dailyAveragesOpen, setDailyAveragesOpen] = useState(false);
  const [detailRange, setDetailRange] = useState<Preset>('24h');
  const { data, loading, error, errorStatus, lastFetchedAt } = useFeeds({
    preset: range.preset,
    from: range.from,
    to: range.to,
    refreshIntervalMs: REFRESH_MS,
  });
  const detailFeeds = useFeeds({
    preset: detailRange,
    refreshIntervalMs: REFRESH_MS,
  });

  const readings = data?.readings ?? [];
  const detailReadings = detailFeeds.data?.readings ?? [];
  const statsByMetric = useMemo(
    () => Object.fromEntries(METRICS.map((m) => [m, windowedStats(readings, m, WINDOW_HOURS)])),
    [readings],
  );
  const dailyTempAverages = useMemo(() => dailyAverageStats(readings, 'temp'), [readings]);
  const daysAboveThreshold = useMemo(
    () => dailyTempAverages.filter((day) => day.avg > thresholds.avgTempDaysAbove).length,
    [dailyTempAverages, thresholds.avgTempDaysAbove],
  );
  const percentAboveThreshold = useMemo(
    () => (dailyTempAverages.length > 0 ? (daysAboveThreshold / dailyTempAverages.length) * 100 : 0),
    [dailyTempAverages.length, daysAboveThreshold],
  );
  const activeMeta = activeMetric ? METRIC_META[activeMetric] : null;

  return (
    <>
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

        {error ? (
          <div className="card border border-red-200 bg-red-50 text-sm text-red-700">
            {errorStatus === 500 ? t('errorConfig', lang) : t('errorLoad', lang)}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          {METRICS.map((m) => (
            <MetricCard
              key={m}
              metric={m}
              readings={readings}
              thresholds={thresholds}
              lang={lang}
              square
              onClick={() => {
                setDetailRange('24h');
                setActiveMetric(m);
              }}
            />
          ))}
          <button
            type="button"
            onClick={() => setDailyAveragesOpen(true)}
            className="card flex aspect-square w-full flex-col items-center justify-center gap-3 p-5 text-center transition hover:ring-stone-300 active:scale-[0.99]"
          >
            <div className="text-sm font-medium text-stone-500">{t('daysAboveAvgTemp', lang)}</div>
            <div className="flex flex-col items-center gap-3">
              <span className="text-5xl font-semibold leading-none tabular-nums text-emerald-600">{daysAboveThreshold}</span>
              <div className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800">
                {percentAboveThreshold.toFixed(0)}% {t('percentAbove', lang)}
              </div>
            </div>
          </button>
        </div>

        <RangePicker
          value={range}
          onChange={setRange}
          lang={lang}
          minDate={formatMsk(CUTOFF_ISO, 'yyyy-MM-dd')}
          maxDate={formatMsk(new Date(), 'yyyy-MM-dd')}
        />

        <div className="flex flex-col gap-3">
          {METRICS.map((m) => (
            <OverviewChart
              key={m}
              metric={m}
              stats={statsByMetric[m]!}
              thresholds={thresholds}
              lang={lang}
            />
          ))}
        </div>

        {loading && readings.length === 0 ? (
          <p className="text-center text-sm text-stone-500">{t('loading', lang)}</p>
        ) : null}
      </div>

      {activeMetric ? (
        <div className="fixed inset-0 z-30 bg-stone-950/45 px-4 py-6 backdrop-blur-sm">
          <div className="mx-auto flex h-full max-w-md flex-col rounded-3xl bg-stone-50 shadow-2xl ring-1 ring-stone-200">
            <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
              <button type="button" onClick={() => setActiveMetric(null)} className="btn-primary gap-2 font-semibold">
                <span aria-hidden className="text-lg font-black leading-none">
                  ←
                </span>
                <span>Back</span>
              </button>
              <div className="text-right">
                <div className="text-base font-semibold text-stone-800">{t('detailRecent', lang)}</div>
                {activeMeta ? <div className="text-sm text-stone-500">{t(activeMeta.labelKey, lang)}</div> : null}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-2">
                  {DETAIL_PRESETS.map((preset) => (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => setDetailRange(preset.key)}
                      className={detailRange === preset.key ? 'btn-primary' : 'btn-ghost'}
                    >
                      {t(preset.labelKey, lang)}
                    </button>
                  ))}
                </div>

                {detailFeeds.error ? (
                  <div className="card border border-red-200 bg-red-50 text-sm text-red-700">
                    {detailFeeds.errorStatus === 500 ? t('errorConfig', lang) : t('errorLoad', lang)}
                  </div>
                ) : null}

                <DetailChart
                  metric={activeMetric}
                  readings={detailReadings}
                  spanDays={presetSpanDays(detailRange)}
                  thresholds={thresholds}
                  lang={lang}
                />

                {detailFeeds.loading && detailReadings.length === 0 ? (
                  <p className="text-center text-sm text-stone-500">{t('loading', lang)}</p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {dailyAveragesOpen ? (
        <div className="fixed inset-0 z-30 bg-stone-950/45 px-4 py-6 backdrop-blur-sm">
          <div className="mx-auto flex h-full max-w-md flex-col rounded-3xl bg-stone-50 shadow-2xl ring-1 ring-stone-200">
            <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
              <button
                type="button"
                onClick={() => setDailyAveragesOpen(false)}
                className="btn-primary gap-2 font-semibold"
              >
                <span aria-hidden className="text-lg font-black leading-none">
                  ←
                </span>
                <span>Back</span>
              </button>
              <div className="text-right">
                <div className="text-base font-semibold text-stone-800">{t('detailDailyAverage', lang)}</div>
                <div className="text-sm text-stone-500">
                  {t('threshold', lang)}: {thresholds.avgTempDaysAbove.toFixed(1)} {t('unitC', lang)}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="flex flex-col gap-4">
                <div className="card bg-emerald-50 text-center">
                  <div className="text-sm text-stone-600">{t('daysAboveAvgTemp', lang)}</div>
                  <div className="mt-1 text-4xl font-semibold tabular-nums text-emerald-600">{daysAboveThreshold}</div>
                  <div className="mt-3 inline-flex self-center rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800">
                    {percentAboveThreshold.toFixed(0)}% {t('percentAbove', lang)}
                  </div>
                </div>

                <DailyAverageChart
                  data={dailyTempAverages.map((day) => ({
                    day: day.day,
                    avg: day.avg,
                    above: day.avg > thresholds.avgTempDaysAbove,
                  }))}
                  threshold={thresholds.avgTempDaysAbove}
                  lang={lang}
                />

                <div className="card flex flex-col gap-3">
                  <div className="text-sm font-medium text-stone-700">{t('threshold', lang)}</div>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        onThresholdsChange({
                          ...thresholds,
                          avgTempDaysAbove: Number((thresholds.avgTempDaysAbove - 0.5).toFixed(1)),
                        })
                      }
                      className="flex h-12 w-12 items-center justify-center rounded-full bg-stone-200 text-2xl font-semibold text-stone-800 transition active:scale-[0.98]"
                      aria-label={t('decreaseThreshold', lang)}
                    >
                      −
                    </button>
                    <div className="min-w-28 rounded-2xl bg-stone-100 px-4 py-3 text-center text-xl font-semibold tabular-nums text-stone-900">
                      {thresholds.avgTempDaysAbove.toFixed(1)} {t('unitC', lang)}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onThresholdsChange({
                          ...thresholds,
                          avgTempDaysAbove: Number((thresholds.avgTempDaysAbove + 0.5).toFixed(1)),
                        })
                      }
                      className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-2xl font-semibold text-white transition active:scale-[0.98]"
                      aria-label={t('increaseThreshold', lang)}
                    >
                      +
                    </button>
                  </div>
                  <div className="text-center text-sm text-stone-500">{t('thresholdAdjustHint', lang)}</div>
                </div>

                {loading && readings.length === 0 ? (
                  <p className="text-center text-sm text-stone-500">{t('loading', lang)}</p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
