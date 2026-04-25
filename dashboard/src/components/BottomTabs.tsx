import { t, type Lang } from '../lib/i18n';

export type Tab = 'detail' | 'overview';

interface Props {
  tab: Tab;
  onChange: (next: Tab) => void;
  lang: Lang;
}

export function BottomTabs({ tab, onChange, lang }: Props) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-10 border-t border-stone-200 bg-white/90 px-2 pt-1 backdrop-blur"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      aria-label="Primary"
    >
      <div className="mx-auto flex max-w-md gap-1">
        {(['overview', 'detail'] as const).map((key) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              className={`flex-1 rounded-xl py-2 text-sm font-medium transition ${
                active ? 'bg-leaf-700 text-white' : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              {key === 'detail' ? t('tabDetail', lang) : t('tabOverview', lang)}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
