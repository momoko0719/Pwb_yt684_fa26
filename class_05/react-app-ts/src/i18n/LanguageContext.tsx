import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { UI, STUDIES_COPY, type Lang, type StudyCopy } from './strings';

type Ui = (typeof UI)['en'];

interface I18nCtx {
  lang: Lang;
  ui: Ui;
  study: (id: string) => StudyCopy;
  toggle: () => void;
}

const Ctx = createContext<I18nCtx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('en');
  const value = useMemo<I18nCtx>(() => ({
    lang,
    ui: UI[lang] as Ui,
    study: (id: string) => {
      const pack = STUDIES_COPY[lang];
      return (pack as Record<string, StudyCopy>)[id] ?? STUDIES_COPY.en.fresnel;
    },
    toggle: () => setLang(l => (l === 'en' ? 'zh' : 'en')),
  }), [lang]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useI18n outside provider');
  return ctx;
}
