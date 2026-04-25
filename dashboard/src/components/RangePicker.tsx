import { useEffect, useState } from 'react';
import { t, type Lang } from '../lib/i18n';
import type { Preset } from '../lib/thingspeak';
import { formatMsk } from '../lib/tz';

export interface RangeValue {
  preset: Preset;
  from?: string;
  to?: string;
}

interface Props {
  value: RangeValue;
  onChange: (next: RangeValue) => void;
  lang: Lang;
  /** If true, the 24/7/30 preset buttons are hidden (used in Overview which defaults to custom). */
  presetsOnly?: boolean;
  customOnly?: boolean;
  /** Lowest allowed `from` (YYYY-MM-DD), inclusive. */
  minDate?: string;
  /** Highest allowed `to` (YYYY-MM-DD), inclusive. */
  maxDate?: string;
}

const PRESETS: { key: Preset; labelKey: Parameters<typeof t>[0] }[] = [
  { key: '24h', labelKey: 'rangeLast24h' },
  { key: '7d', labelKey: 'rangeLast7d' },
  { key: '30d', labelKey: 'rangeLast30d' },
  { key: 'custom', labelKey: 'rangeCustom' },
];

function todayMsk(): string {
  return formatMsk(new Date(), 'yyyy-MM-dd');
}

export function RangePicker({ value, onChange, lang, presetsOnly, customOnly, minDate, maxDate }: Props) {
  const [from, setFrom] = useState(value.from ?? '');
  const [to, setTo] = useState(value.to ?? todayMsk());
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (value.from) setFrom(value.from);
    if (value.to) setTo(value.to);
  }, [value.from, value.to]);

  const showCustom = customOnly || value.preset === 'custom';

  function apply() {
    if (!from || !to) {
      setErr(t('errorInvalidRange', lang));
      return;
    }
    if (from > to) {
      setErr(t('errorInvalidRange', lang));
      return;
    }
    setErr(null);
    onChange({ preset: 'custom', from, to });
  }

  return (
    <div className="flex flex-col gap-3">
      {!customOnly && !presetsOnly ? (
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => {
            const active = value.preset === p.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => onChange({ preset: p.key, from: value.from, to: value.to })}
                className={active ? 'btn-primary' : 'btn-ghost'}
              >
                {t(p.labelKey, lang)}
              </button>
            );
          })}
        </div>
      ) : null}

      {showCustom ? (
        <div className="card flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-stone-600">
              <span>{t('from', lang)}</span>
              <input
                type="date"
                value={from}
                min={minDate}
                max={maxDate}
                onChange={(e) => setFrom(e.target.value)}
                className="rounded-lg border border-stone-300 px-3 py-2 text-base"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-stone-600">
              <span>{t('to', lang)}</span>
              <input
                type="date"
                value={to}
                min={minDate}
                max={maxDate}
                onChange={(e) => setTo(e.target.value)}
                className="rounded-lg border border-stone-300 px-3 py-2 text-base"
              />
            </label>
          </div>
          {err ? <p className="text-sm text-red-600">{err}</p> : null}
          <button type="button" onClick={apply} className="btn-primary">
            {t('apply', lang)}
          </button>
        </div>
      ) : null}
    </div>
  );
}
