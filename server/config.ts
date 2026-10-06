import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const DATA_DIR = path.resolve(process.env.DATA_DIR ?? 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export interface AppConfig {
  database: DatabaseConfig;
}

export async function loadConfig(): Promise<AppConfig | null> {
  if (!existsSync(CONFIG_FILE)) return null;
  const parsed = JSON.parse(await readFile(CONFIG_FILE, 'utf8')) as Partial<AppConfig>;
  return parsed.database ? { database: parsed.database } : null;
}

/** Contém a senha do banco: fica em `data/` (fora do git) e com permissão restrita ao dono. */
export async function saveConfig(config: AppConfig): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const tmp = `${CONFIG_FILE}.tmp`;
  await writeFile(tmp, JSON.stringify(config, null, 2), { encoding: 'utf8', mode: 0o600 });
  await rename(tmp, CONFIG_FILE);
}
