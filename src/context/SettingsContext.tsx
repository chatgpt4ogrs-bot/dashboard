import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { settingsStorage } from '../services/storage';
import type { Settings } from '../types';

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  language: 'pt',
  openInNewTab: true,
  sidebarCollapsed: false,
};

interface SettingsContextValue {
  settings: Settings;
  resolvedTheme: 'dark' | 'light';
  updateSettings: (patch: Partial<Settings>) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => ({ ...DEFAULT_SETTINGS, ...settingsStorage.load() }));
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');

  const resolvedTheme = settings.theme === 'system' ? (prefersDark ? 'dark' : 'light') : settings.theme;

  useEffect(() => {
    settingsStorage.save(settings);
  }, [settings]);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
  }, [resolvedTheme]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const value = useMemo(() => ({ settings, resolvedTheme, updateSettings }), [settings, resolvedTheme, updateSettings]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings deve ser usado dentro de <SettingsProvider>');
  return context;
}
