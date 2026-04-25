import type { Lang } from '../lib/i18n';

interface Props {
  lang: Lang;
  onChange: (next: Lang) => void;
}

export function LangToggle({ lang, onChange }: Props) {
  return (
    <div className="inline-flex rounded-full bg-stone-100 p-1 text-xs font-medium" role="tablist" aria-label="Language">
      {(['en', 'ru'] as const).map((code) => {
        const active = lang === code;
        return (
          <button
            key={code}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(code)}
            className={`px-3 py-1 rounded-full transition ${
              active ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            {code === 'en' ? 'EN' : 'RU'}
          </button>
        );
      })}
    </div>
  );
}
