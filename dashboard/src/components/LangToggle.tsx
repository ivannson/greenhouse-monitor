import type { Lang } from '../lib/i18n';

interface Props {
  lang: Lang;
  onChange: (next: Lang) => void;
}

export function LangToggle({ lang, onChange }: Props) {
  return (
    <div className="inline-flex rounded-full bg-stone-100 p-1 text-xs font-medium shadow-sm ring-1 ring-stone-200" role="tablist" aria-label="Language">
      {(['en', 'ru'] as const).map((code) => {
        const active = lang === code;
        return (
          <button
            key={code}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(code)}
            className={`rounded-full px-3 py-1.5 text-lg leading-none transition ${
              active ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
            }`}
            aria-label={code === 'en' ? 'English' : 'Russian'}
          >
            {code === 'en' ? '🇬🇧' : '🇷🇺'}
          </button>
        );
      })}
    </div>
  );
}
