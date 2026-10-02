import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Condominium, Equipment } from '../shared/condominium.ts';

export interface EquipmentRecord extends Omit<Equipment, 'hasPassword'> {
  password: string;
}

interface Database {
  condominiums: Condominium[];
  equipments: EquipmentRecord[];
}

const DATA_DIR = path.resolve(process.env.DATA_DIR ?? 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');

let cache: Database | null = null;
let writeQueue: Promise<unknown> = Promise.resolve();

async function load(): Promise<Database> {
  if (cache) return cache;
  if (!existsSync(DATA_FILE)) {
    cache = { condominiums: [], equipments: [] };
    return cache;
  }
  const parsed = JSON.parse(await readFile(DATA_FILE, 'utf8')) as Partial<Database>;
  cache = { condominiums: parsed.condominiums ?? [], equipments: parsed.equipments ?? [] };
  return cache;
}

async function persist(db: Database): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const tmp = `${DATA_FILE}.tmp`;
  await writeFile(tmp, JSON.stringify(db, null, 2), 'utf8');
  await rename(tmp, DATA_FILE);
}

export async function readDb(): Promise<Database> {
  return load();
}

/** Escritas são serializadas para evitar que duas requisições sobrescrevam uma à outra. */
export function updateDb<T>(mutator: (db: Database) => T): Promise<T> {
  const run = writeQueue.then(async () => {
    const db = await load();
    const result = mutator(db);
    await persist(db);
    return result;
  });
  writeQueue = run.catch(() => undefined);
  return run;
}

export function toPublicEquipment({ password, ...rest }: EquipmentRecord): Equipment {
  return { ...rest, hasPassword: password.length > 0 };
}
