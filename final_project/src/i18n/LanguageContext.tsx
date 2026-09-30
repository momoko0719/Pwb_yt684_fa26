import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { strings, type Language, type StringKey } from './strings';

const STORAGE_KEY = 'guixu.language';

interface LanguageValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: StringKey) => string;
}

const LanguageContext = createContext<LanguageValue | null>(null);

function readStored(): Language {
  return localStorage.getItem(STORAGE_KEY) === 'zh' ? 'zh' : 'en';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readStored);

  useEffect(() => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  }, [language]);

  const setLanguage = (next: Language) => {
    localStorage.setItem(STORAGE_KEY, next);
    setLanguageState(next);
  };
  const t = (key: StringKey) => strings[language][key];

  return <LanguageContext.Provider value={{ language, setLanguage, t }}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageValue {
  const value = useContext(LanguageContext);
  if (!value) throw new Error('useLanguage must be used inside LanguageProvider');
  return value;
}
