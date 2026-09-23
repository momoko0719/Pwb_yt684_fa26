import { createContext, useContext, useState, useMemo, type ReactNode } from 'react';
import { STRINGS, type Lang, type Strings } from './strings';

interface I18nCtx {
  lang: Lang;
  t: Strings;
  toggle: () => void;
  setLang: (l: Lang) => void;
  showJargon: boolean;
  setShowJargon: (v: boolean) => void;
}

const Ctx = createContext<I18nCtx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('en');
  const [showJargon, setShowJargon] = useState(false);
  const value = useMemo<I18nCtx>(() => ({
    lang,
    t: STRINGS[lang] as Strings,
    toggle: () => setLang(l => (l === 'en' ? 'zh' : 'en')),
    setLang,
    showJargon,
    setShowJargon,
  }), [lang, showJargon]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useI18n outside LanguageProvider');
  return ctx;
}
