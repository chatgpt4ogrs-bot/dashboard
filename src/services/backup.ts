import type { Access, Settings } from '../types';
import { createId } from '../utils/text';
import { isValidUrl, normalizeUrl } from '../utils/url';

const APP_ID = 'centralizador-de-acessos';
const BACKUP_VERSION = 1;

interface BackupFile {
  app: typeof APP_ID;
  version: number;
  exportedAt: string;
  accesses: Access[];
  settings?: Partial<Settings>;
}

export function downloadBackup(accesses: Access[], settings: Settings): void {
  const data: BackupFile = {
    app: APP_ID,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    accesses,
    settings,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `centralizador-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function sanitizeAccess(raw: unknown): Access | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  if (typeof item.name !== 'string' || typeof item.url !== 'string') return null;

  const url = normalizeUrl(item.url);
  if (!item.name.trim() || !isValidUrl(url)) return null;

  const now = new Date().toISOString();
  return {
    id: typeof item.id === 'string' && item.id ? item.id : createId(),
    name: item.name.trim(),
    url,
    description: typeof item.description === 'string' ? item.description : undefined,
    category: typeof item.category === 'string' ? item.category : undefined,
    favorite: item.favorite === true,
    createdAt: typeof item.createdAt === 'string' ? item.createdAt : now,
    updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : now,
  };
}

export async function readBackup(file: File): Promise<{ accesses: Access[]; settings?: Partial<Settings> }> {
  let data: unknown;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error('O arquivo não é um JSON válido.');
  }

  if (!data || typeof data !== 'object' || !Array.isArray((data as BackupFile).accesses)) {
    throw new Error('Arquivo de backup inválido.');
  }

  const backup = data as BackupFile;
  const accesses = backup.accesses.map(sanitizeAccess).filter((a): a is Access => a !== null);
  return { accesses, settings: backup.settings };
}
