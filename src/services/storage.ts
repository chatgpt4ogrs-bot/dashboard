import type { Access, Settings } from '../types';

const KEYS = {
  accesses: 'centralizador:accesses',
  settings: 'centralizador:settings',
} as const;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Falha ao salvar "${key}"`, error);
  }
}

export const accessStorage = {
  load: (): Access[] => read<Access[]>(KEYS.accesses, []),
  save: (accesses: Access[]) => write(KEYS.accesses, accesses),
};

export const settingsStorage = {
  load: (): Partial<Settings> => read<Partial<Settings>>(KEYS.settings, {}),
  save: (settings: Settings) => write(KEYS.settings, settings),
};
