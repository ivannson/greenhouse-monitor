import { ResponsiveContainer, AreaChart, Area, YAxis, XAxis, ReferenceLine } from 'recharts';
import type { MetricKey, Reading } from '../lib/thingspeak';
import { METRIC_META, evaluateStatus, formatValue } from '../lib/metrics';
import type { Thresholds } from '../lib/thresholds';
import { t, type Lang } from '../lib/i18n';
import { fullStamp, formatMsk } from '../lib/tz';
import { StatusBadge } from './StatusBadge';

interface Props {
  metric: MetricKey;
  readings: Reading[];
  thresholds: Thresholds;
  lang: Lang;
}

// Moscow is always UTC+3 (no DST)
const MSK_OFF = 3 * 3600 * 1000;
const SIX_H = 6 * 3600 * 1000;

function gen6hTicks(startMs: number, endMs: number): number[] {
  const ticks: number[] = [];
  const first = Math.ceil((startMs + MSK_OFF) / SIX_H) * SIX_H - MSK_OFF;
  for (let t = first; t <= endMs; t += SIX_H) ticks.push(t);
  return ticks;
}

function SparkTick(props: { x?: number; y?: number; payload?: { value: number } }) {
  const { x = 0, y = 0, payload } = props;
  if (!payload) return null;
  const ms = payload.value;
  const isMidnight = formatMsk(ms, 'HH') === '00';
  return (
    <text x={x} y={y + 8} textAnchor="middle" fontSize={10} fontWeight={isMidnight ? 600 : 400} fill={isMidnight ? '#57534e' : '#a8a29e'}>
      {isMidnight ? formatMsk(ms, 'd MMM') : formatMsk(ms, 'HH:mm')}
    </text>
  );
}

export function MetricCard({ metric, readings, thresholds, lang }: Props) {
  const meta = METRIC_META[metric];
  const latest = [...readings].reverse().find((r) => r[metric] != null);
  const value = latest ? (latest[metric] as number) : null;
  const status = evaluateStatus(metric, value, thresholds);
  const series = readings
    .filter((r) => r[metric] != null)
    .map((r) => ({ ts: new Date(r.ts).getTime(), v: r[metric] as number }));

  const seriesValues = series.map((s) => s.v);
  const minV = series.length > 0 ? Math.min(...seriesValues) : null;
  const maxV = series.length > 0 ? Math.max(...seriesValues) : null;

  const sixHMarks = series.length >= 2
    ? gen6hTicks(series[0].ts, series[series.length - 1].ts)
    : [];

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-medium text-stone-500">{t(meta.labelKey, lang)}</div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-3xl font-semibold tabular-nums" style={{ color: meta.tint }}>
              {formatValue(metric, value)}
            </span>
            <span className="text-base text-stone-500">{t(meta.unitKey, lang)}</span>
          </div>
        </div>
        <StatusBadge metric={metric} status={status} lang={lang} />
      </div>

      {series.length >= 2 ? (
        <>
          <div className="h-20 -mx-1 relative">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id={`g-${metric}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={meta.tint} stopOpacity={0.45} />
                    <stop offset="100%" stopColor={meta.tint} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="ts"
                  type="number"
                  scale="time"
                  domain={[series[0].ts, series[series.length - 1].ts]}
                  ticks={sixHMarks}
                  tick={<SparkTick />}
                  height={16}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis hide domain={['auto', 'auto']} />
                {sixHMarks.map((ms) => {
                  const isMidnight = formatMsk(ms, 'HH') === '00';
                  return (
                    <ReferenceLine
                      key={ms}
                      x={ms}
                      stroke={isMidnight ? '#a8a29e' : '#d6d3d1'}
                      strokeWidth={isMidnight ? 1.5 : 1}
                      strokeDasharray={isMidnight ? '3 3' : '4 3'}
                    />
                  );
                })}
                {maxV !== null && (
                  <ReferenceLine y={maxV} stroke={meta.tint} strokeDasharray="4 3" strokeOpacity={0.55} />
                )}
                {minV !== null && (
                  <ReferenceLine y={minV} stroke={meta.tint} strokeDasharray="4 3" strokeOpacity={0.55} />
                )}
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={meta.tint}
                  strokeWidth={2}
                  fill={`url(#g-${metric})`}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
            <span className="absolute right-1 top-0.5 text-xs leading-none text-stone-500 tabular-nums font-medium pointer-events-none">
              {formatValue(metric, maxV)}
            </span>
          </div>
          <div className="flex justify-end pr-1">
            <span className="text-xs leading-none text-stone-500 tabular-nums font-medium">
              {formatValue(metric, minV)}
            </span>
          </div>
          <div className="flex justify-between text-xs text-stone-600 mt-1 px-0.5">
            <span>{formatMsk(series[0].ts, 'HH:mm')}</span>
            <span>{formatMsk(series[series.length - 1].ts, 'HH:mm')}</span>
          </div>
        </>
      ) : null}

      {latest ? (
        <div className="text-xs text-stone-500">
          {t('updated', lang)}: {fullStamp(latest.ts)}
        </div>
      ) : null}
    </div>
  );
}
