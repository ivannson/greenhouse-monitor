import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Customized,
} from 'recharts';
import { t, type Lang } from '../lib/i18n';
import { formatMsk } from '../lib/tz';

export interface DailyAveragePoint {
  day: string;
  avg: number;
  above: boolean;
}

interface Props {
  data: DailyAveragePoint[];
  threshold: number;
  lang: Lang;
}

export function DailyAverageChart({ data, threshold, lang }: Props) {
  if (data.length === 0) {
    return <p className="card text-sm text-stone-500">{t('noReadings', lang)}</p>;
  }

  return (
    <div className="card">
      <div className="mb-2 text-sm font-medium text-stone-600">
        {t('dailyAverageTemp', lang)} <span className="text-stone-400">({t('unitC', lang)})</span>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#e7e5e4" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="day"
              stroke="#78716c"
              fontSize={11}
              minTickGap={20}
              tickFormatter={(day: string) => formatMsk(`${day}T00:00:00Z`, 'd MMM')}
            />
            <YAxis
              stroke="#78716c"
              fontSize={11}
              width={40}
              tickFormatter={(v: number) => v.toFixed(1)}
            />
            <Tooltip
              contentStyle={{ borderRadius: 12, borderColor: '#d6d3d1', fontSize: 12 }}
              labelFormatter={(day) => formatMsk(`${String(day)}T00:00:00Z`, 'd MMM yyyy')}
              formatter={(v: number) => [`${v.toFixed(1)} ${t('unitC', lang)}`, t('dailyAverageTemp', lang)]}
            />
            <Bar dataKey="avg" radius={[8, 8, 0, 0]} isAnimationActive={false}>
              {data.map((entry) => (
                <Cell key={entry.day} fill={entry.above ? '#16a34a' : '#dc2626'} />
              ))}
            </Bar>
            <Customized
              component={(props: unknown) => {
                const { yAxisMap, offset } = (props ?? {}) as {
                  yAxisMap?: Record<number, { scale: (value: number) => number }>;
                  offset?: { left: number; width: number };
                };
                const axis = yAxisMap?.[0];
                if (!axis || !offset) return null;
                const y = axis.scale(threshold);
                if (!Number.isFinite(y)) return null;
                return (
                  <line
                    x1={offset.left}
                    x2={offset.left + offset.width}
                    y1={y}
                    y2={y}
                    stroke="#57534e"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                  />
                );
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
