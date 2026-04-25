import { METRIC_META, type Status } from '../lib/metrics';
import type { MetricKey } from '../lib/thingspeak';
import type { Lang } from '../lib/i18n';

interface Props {
  metric: MetricKey;
  status: Status;
  lang: Lang;
}

const TONE: Record<Status, string> = {
  ok: 'bg-leaf-100 text-leaf-800',
  low: 'bg-sky-100 text-sky-800',
  high: 'bg-amber-100 text-amber-900',
  none: 'bg-stone-100 text-stone-500',
};

export function StatusBadge({ metric, status, lang }: Props) {
  const meta = METRIC_META[metric];
  return <span className={`chip ${TONE[status]}`}>{meta.statusLabel(status, lang)}</span>;
}
