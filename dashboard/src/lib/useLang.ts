import { useCallback, useEffect, useState } from 'react';
import { LANG_STORAGE_KEY, type Lang } from './i18n';

function detect(): Lang {
  if (typeof window === 'undefined') return 'ru';
  const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
  if (stored === 'en' || stored === 'ru') return stored;
  return 'ru';
}

export function useLang(): [Lang, (next: Lang) => void] {
  const [lang, setLangState] = useState<Lang>(() => detect());

  useEffect(() => {
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, lang);
      document.documentElement.lang = lang;
    } catch {
      // ignore storage errors
    }
  }, [lang]);

  const setLang = useCallback((next: Lang) => setLangState(next), []);
  return [lang, setLang];
}
