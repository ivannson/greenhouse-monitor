import { useEffect, useState } from 'react';
import { t, type Lang } from '../lib/i18n';
import { METRIC_META } from '../lib/metrics';
import type { MetricKey } from '../lib/thingspeak';
import { DEFAULT_THRESHOLDS, type Thresholds } from '../lib/thresholds';

interface Props {
  open: boolean;
  onClose: () => void;
  thresholds: Thresholds;
  onSave: (next: Thresholds) => void;
  onReset: () => void;
  lang: Lang;
}

const METRICS: MetricKey[] = ['temp', 'humidity', 'pressure'];

export function ThresholdDrawer({ open, onClose, thresholds, onSave, onReset, lang }: Props) {
  const [draft, setDraft] = useState<Thresholds>(thresholds);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(thresholds);
      setError(null);
    }
  }, [open, thresholds]);

  if (!open) return null;

  function update(metric: MetricKey, idx: 0 | 1, raw: string) {
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    setDraft((prev) => {
      const pair: [number, number] = [...prev[metric]] as [number, number];
      pair[idx] = n;
      return { ...prev, [metric]: pair };
    });
  }

  function save() {
    for (const m of METRICS) {
      const [lo, hi] = draft[m];
      if (!(lo < hi)) {
        setError(`${t(METRIC_META[m].labelKey, lang)}: ${t('min', lang)} < ${t('max', lang)}`);
        return;
      }
    }
    if (!Number.isFinite(draft.avgTempDaysAbove)) {
      setError(`${t('avgTempDaysAbove', lang)}: ${t('threshold', lang)}`);
      return;
    }
    onSave(draft);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('settingsTitle', lang)}</h2>
          <button type="button" onClick={onClose} className="text-stone-500 hover:text-stone-700" aria-label="Close">
            ✕
          </button>
        </div>
        <p className="mb-4 text-sm text-stone-500">{t('settingsHint', lang)}</p>
        <div className="flex flex-col gap-4">
          {METRICS.map((m) => {
            const meta = METRIC_META[m];
            const [lo, hi] = draft[m];
            return (
              <div key={m}>
                <div className="mb-1 text-sm font-medium text-stone-700">
                  {t(meta.labelKey, lang)} <span className="text-stone-400">({t(meta.unitKey, lang)})</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs text-stone-500">
                    {t('min', lang)}
                    <input
                      type="number"
                      step={meta.decimals > 0 ? '0.1' : '1'}
                      value={lo}
                      onChange={(e) => update(m, 0, e.target.value)}
                      className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-base"
                    />
                  </label>
                  <label className="text-xs text-stone-500">
                    {t('max', lang)}
                    <input
                      type="number"
                      step={meta.decimals > 0 ? '0.1' : '1'}
                      value={hi}
                      onChange={(e) => update(m, 1, e.target.value)}
                      className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-base"
                    />
                  </label>
                </div>
              </div>
            );
          })}
          <div>
            <div className="mb-1 text-sm font-medium text-stone-700">
              {t('avgTempDaysAbove', lang)} <span className="text-stone-400">({t('unitC', lang)})</span>
            </div>
            <label className="text-xs text-stone-500">
              {t('threshold', lang)}
              <input
                type="number"
                step="0.1"
                value={draft.avgTempDaysAbove}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    avgTempDaysAbove: Number(e.target.value),
                  }))
                }
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-base"
              />
            </label>
            <p className="mt-1 text-xs text-stone-500">{t('avgTempDaysAboveHint', lang)}</p>
          </div>
        </div>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        <div className="mt-5 flex flex-col gap-2">
          <button type="button" onClick={save} className="btn-primary">
            {t('save', lang)}
          </button>
          <button
            type="button"
            onClick={() => {
              onReset();
              setDraft(DEFAULT_THRESHOLDS);
            }}
            className="btn-ghost"
          >
            {t('resetDefaults', lang)}
          </button>
        </div>
      </div>
    </div>
  );
}
