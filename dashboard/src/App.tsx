import { useState } from 'react';
import { BottomTabs, type Tab } from './components/BottomTabs';
import { LangToggle } from './components/LangToggle';
import { ThresholdDrawer } from './components/ThresholdDrawer';
import { Detail } from './views/Detail';
import { Overview } from './views/Overview';
import { useLang } from './lib/useLang';
import { useThresholds } from './lib/thresholds';
import { t } from './lib/i18n';

export default function App() {
  const [lang, setLang] = useLang();
  const [thresholds, setThresholds, resetThresholds] = useThresholds();
  const [tab, setTab] = useState<Tab>('detail');
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="min-h-full pb-24">
      <header
        className="sticky top-0 z-10 border-b border-stone-200 bg-white/90 backdrop-blur"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="mx-auto flex max-w-md items-center justify-between gap-2 px-4 py-3">
          <h1 className="text-base font-semibold text-stone-900">
            <span className="mr-1" aria-hidden>
              🌿
            </span>
            {t('appTitle', lang)}
          </h1>
          <div className="flex items-center gap-2">
            <LangToggle lang={lang} onChange={setLang} />
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="btn-ghost !px-2"
              aria-label={t('settings', lang)}
              title={t('settings', lang)}
            >
              ⚙︎
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-4">
        {tab === 'detail' ? (
          <Detail lang={lang} thresholds={thresholds} />
        ) : (
          <Overview lang={lang} thresholds={thresholds} />
        )}
        <p className="mt-6 text-center text-xs text-stone-400">{t('footerHint', lang)}</p>
      </main>

      <BottomTabs tab={tab} onChange={setTab} lang={lang} />

      <ThresholdDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        thresholds={thresholds}
        onSave={setThresholds}
        onReset={resetThresholds}
        lang={lang}
      />
    </div>
  );
}
