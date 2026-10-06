import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useSettings } from '../context/SettingsContext';
import type { Language } from '../types';
import { en } from './en';
import { pt, type Messages } from './pt';

export const LANGUAGES: { code: Language; label: string; locale: string }[] = [
  { code: 'pt', label: 'Português', locale: 'pt-BR' },
  { code: 'en', label: 'English', locale: 'en-US' },
];

const MESSAGES: Record<Language, Messages> = { pt, en };

let active = { messages: pt, locale: 'pt-BR' };

/** Idioma atual para código fora de componentes (formatação de datas, mensagens de erro). */
export const getMessages = (): Messages => active.messages;
export const getLocale = (): string => active.locale;

interface I18nContextValue {
  language: Language;
  locale: string;
  t: Messages;
  setLanguage: (language: Language) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const { settings, updateSettings } = useSettings();
  const language: Language = settings.language in MESSAGES ? settings.language : 'pt';

  const value = useMemo<I18nContextValue>(() => {
    const locale = LANGUAGES.find((l) => l.code === language)!.locale;
    active = { messages: MESSAGES[language], locale };
    return { language, locale, t: MESSAGES[language], setLanguage: (next) => updateSettings({ language: next }) };
  }, [language, updateSettings]);

  useEffect(() => {
    document.documentElement.lang = value.locale;
  }, [value.locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n precisa estar dentro de <I18nProvider>.');
  return context;
}
