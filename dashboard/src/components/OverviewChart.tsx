import {
  ResponsiveContainer,
  ComposedChart,
  Scatter,
  ErrorBar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceArea,
} from 'recharts';
import type { MetricKey } from '../lib/thingspeak';
import type { WindowStat } from '../lib/aggregate';
import { METRIC_META } from '../lib/metrics';
import { t, type Lang } from '../lib/i18n';
import type { Thresholds } from '../lib/thresholds';
import { formatMsk } from '../lib/tz';

interface Props {
  metric: MetricKey;
  stats: WindowStat[];
  thresholds: Thresholds;
  lang: Lang;
  windowHours: number;
}

export function OverviewChart({ metric, stats, thresholds, lang, windowHours }: Props) {
  const meta = METRIC_META[metric];
  if (stats.length === 0) {
    return <p className="card text-sm text-stone-500">{t('noReadings', lang)}</p>;
  }

  // Recharts ErrorBar expects [belowMean, aboveMean] positive numbers.
  const data = stats.map((s) => ({
    x: s.midMs,
    mean: s.mean,
    min: s.min,
    max: s.max,
    count: s.count,
    err: [s.mean - s.min, s.max - s.mean] as [number, number],
  }));

  const [lo, hi] = thresholds[metric];

  // X tick: show date when window spans ≥1 day (24h), otherwise show time only.
  // For 6-h windows: show "23 Apr 06:00" on the first window of a day, "06:00" on others.
  const seenDays = new Set<string>();
  const xTickFormatter = (ms: number) => {
    const dayLabel = formatMsk(ms, 'd MMM');
    const timeLabel = formatMsk(ms, 'HH:mm');
    if (windowHours >= 24) return dayLabel;
    if (!seenDays.has(dayLabel)) {
      seenDays.add(dayLabel);
      return `${dayLabel}\n${timeLabel}`;
    }
    return timeLabel;
  };

  return (
    <div className="card">
      <div className="mb-2 text-sm font-medium text-stone-600">
        {t(meta.labelKey, lang)} <span className="text-stone-400">({t(meta.unitKey, lang)})</span>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
            <CartesianGrid stroke="#e7e5e4" strokeDasharray="4 4" vertical={true} />
            <XAxis
              dataKey="x"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={xTickFormatter}
              stroke="#a8a29e"
              tick={{ fontSize: 10, fill: '#78716c' }}
              minTickGap={windowHours >= 24 ? 28 : 40}
              interval="preserveStartEnd"
              angle={-35}
              textAnchor="end"
              height={50}
            />
            <YAxis
              stroke="#a8a29e"
              tick={{ fontSize: 11, fill: '#78716c' }}
              domain={['auto', 'auto']}
              width={46}
              tickCount={6}
              tickFormatter={(v: number) => v.toFixed(meta.decimals)}
            />
            <Tooltip
              contentStyle={{ borderRadius: 12, borderColor: '#d6d3d1', fontSize: 12 }}
              labelFormatter={(ms) =>
                formatMsk(Number(ms), windowHours >= 24 ? 'd MMM yyyy' : 'd MMM yyyy HH:mm')
              }
              formatter={(_: number, _name: string, item: { payload?: typeof data[number] }) => {
                const p = item.payload;
                if (!p) return null;
                const fmt = (x: number) => `${x.toFixed(meta.decimals)} ${t(meta.unitKey, lang)}`;
                return [
                  `${fmt(p.mean)} (${fmt(p.min)} – ${fmt(p.max)}, n=${p.count})`,
                  t(meta.labelKey, lang),
                ];
              }}
            />
            <ReferenceArea y2={lo} fill="#60a5fa" fillOpacity={0.07} />
            <ReferenceArea y1={hi} fill="#f59e0b" fillOpacity={0.09} />
            <Scatter dataKey="mean" fill={meta.tint} isAnimationActive={false} r={3}>
              <ErrorBar dataKey="err" width={3} stroke={meta.tint} strokeWidth={1.5} direction="y" />
            </Scatter>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
