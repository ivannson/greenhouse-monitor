import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceArea } from 'recharts';
import type { MetricKey, Reading } from '../lib/thingspeak';
import { METRIC_META } from '../lib/metrics';
import { t, type Lang } from '../lib/i18n';
import type { Thresholds } from '../lib/thresholds';
import { fullStamp, shortTick } from '../lib/tz';

interface Props {
  metric: MetricKey;
  readings: Reading[];
  spanDays: number;
  thresholds: Thresholds;
  lang: Lang;
}

export function DetailChart({ metric, readings, spanDays, thresholds, lang }: Props) {
  const meta = METRIC_META[metric];
  const data = readings
    .filter((r) => r[metric] != null)
    .map((r) => ({ ts: new Date(r.ts).getTime(), v: r[metric] as number }));

  if (data.length === 0) {
    return <p className="card text-sm text-stone-500">{t('noReadings', lang)}</p>;
  }

  const tickFmt = (ms: number) => shortTick(ms, spanDays <= 1.5 ? 'hours' : 'days');
  const [lo, hi] = thresholds[metric];

  return (
    <div className="card">
      <div className="mb-2 text-sm font-medium text-stone-600">
        {t(meta.labelKey, lang)} <span className="text-stone-400">({t(meta.unitKey, lang)})</span>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#e7e5e4" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="ts"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={tickFmt}
              stroke="#78716c"
              fontSize={11}
              minTickGap={40}
            />
            <YAxis
              stroke="#78716c"
              fontSize={11}
              domain={['auto', 'auto']}
              width={40}
              tickFormatter={(v: number) => v.toFixed(meta.decimals)}
            />
            <Tooltip
              contentStyle={{ borderRadius: 12, borderColor: '#d6d3d1', fontSize: 12 }}
              labelFormatter={(ms) => fullStamp(Number(ms))}
              formatter={(v: number) => [`${v.toFixed(meta.decimals)} ${t(meta.unitKey, lang)}`, t(meta.labelKey, lang)]}
            />
            <ReferenceArea y2={lo} fill="#60a5fa" fillOpacity={0.06} />
            <ReferenceArea y1={hi} fill="#f59e0b" fillOpacity={0.08} />
            <Line
              type="monotone"
              dataKey="v"
              stroke={meta.tint}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
