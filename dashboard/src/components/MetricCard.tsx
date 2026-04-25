import type { MetricKey, Reading } from '../lib/thingspeak';
import { METRIC_META, evaluateStatus, formatValue } from '../lib/metrics';
import type { Thresholds } from '../lib/thresholds';
import { t, type Lang } from '../lib/i18n';
import { fullStamp } from '../lib/tz';
import { StatusBadge } from './StatusBadge';

interface Props {
  metric: MetricKey;
  readings: Reading[];
  thresholds: Thresholds;
  lang: Lang;
  square?: boolean;
  onClick?: () => void;
}

export function MetricCard({ metric, readings, thresholds, lang, square = false, onClick }: Props) {
  const meta = METRIC_META[metric];
  const latest = [...readings].reverse().find((r) => r[metric] != null);
  const value = latest ? (latest[metric] as number) : null;
  const status = evaluateStatus(metric, value, thresholds);
  const rootClass = `card flex flex-col gap-3 ${square ? 'aspect-square items-center justify-center p-5 text-center' : ''} ${
    onClick ? 'w-full transition hover:ring-stone-300 active:scale-[0.99]' : ''
  }`;
  const content = square ? (
    <>
      <div className="text-sm font-medium text-stone-500">{t(meta.labelKey, lang)}</div>
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-baseline justify-center gap-1">
          <span className="text-5xl font-semibold leading-none tabular-nums" style={{ color: meta.tint }}>
            {formatValue(metric, value)}
          </span>
          <span className="text-lg text-stone-500">{t(meta.unitKey, lang)}</span>
        </div>
        <StatusBadge metric={metric} status={status} lang={lang} />
      </div>
      {latest ? (
        <div className="text-xs text-stone-500">
          {t('updated', lang)}: {fullStamp(latest.ts)}
        </div>
      ) : null}
    </>
  ) : (
    <>
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

      {latest ? (
        <div className="text-xs text-stone-500">
          {t('updated', lang)}: {fullStamp(latest.ts)}
        </div>
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={rootClass}>
        {content}
      </button>
    );
  }

  return <div className={rootClass}>{content}</div>;
}
