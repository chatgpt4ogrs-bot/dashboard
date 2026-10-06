import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { PoolClient } from 'pg';
import type { Condominium } from '../shared/condominium.ts';
import type { EquipmentEvent } from '../shared/events.ts';
import { DATA_DIR } from './config.ts';
import type { EquipmentRecord } from './db.ts';
import { insertEvents } from './events.ts';

/** Arquivos JSON usados antes do PostgreSQL. São só lidos; ficam no disco como backup. */
const LEGACY_FILES = ['db.json', 'users.json', 'events.json', 'monitor.json'];

interface LegacyUser {
  id: string;
  email: string;
  name?: string;
  role: string;
  active?: boolean;
  passwordHash: string;
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string;
}

interface LegacyMonitor {
  equipments?: Record<string, unknown>;
  reboots?: { equipmentId: string; at: string }[];
}

export interface ImportSummary {
  condominiums: number;
  equipments: number;
  users: number;
  events: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);

async function readJson<T>(name: string): Promise<T | null> {
  const file = path.join(DATA_DIR, name);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T;
  } catch (error) {
    console.warn(`Ignorando ${name}: arquivo ilegível.`, error);
    return null;
  }
}

export function hasLegacyData(): boolean {
  return LEGACY_FILES.slice(0, 2).some((name) => existsSync(path.join(DATA_DIR, name)));
}

/** Importa os dados da versão em JSON. Só roda uma vez e apenas se o banco ainda estiver vazio. */
export async function importLegacyData(client: PoolClient): Promise<ImportSummary | null> {
  const alreadyImported = await client.query(`SELECT 1 FROM app_meta WHERE key = 'legacy_import'`);
  if (alreadyImported.rowCount) return null;

  const existing = await client.query<{ total: number }>(
    'SELECT (SELECT count(*) FROM condominiums) + (SELECT count(*) FROM users) AS total',
  );
  if (existing.rows[0].total > 0) return null;

  const db = await readJson<{ condominiums?: Condominium[]; equipments?: EquipmentRecord[] }>('db.json');
  const users = (await readJson<LegacyUser[]>('users.json')) ?? [];
  const events = (await readJson<EquipmentEvent[]>('events.json')) ?? [];
  const monitor = (await readJson<LegacyMonitor>('monitor.json')) ?? {};
  if (!db && users.length === 0) return null;

  const summary: ImportSummary = { condominiums: 0, equipments: 0, users: 0, events: 0 };

  for (const c of db?.condominiums ?? []) {
    if (!isUuid(c.id) || !c.name) continue;
    const result = await client.query(
      `INSERT INTO condominiums (id, name, address, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, now()), COALESCE($6::timestamptz, now()))
       ON CONFLICT (id) DO NOTHING`,
      [c.id, c.name, c.address ?? null, c.notes ?? null, c.createdAt ?? null, c.updatedAt ?? null],
    );
    summary.condominiums += result.rowCount ?? 0;
  }

  const importedEquipments = new Set<string>();
  for (const e of db?.equipments ?? []) {
    if (!isUuid(e.id) || !isUuid(e.condominiumId)) continue;
    const result = await client.query(
      `INSERT INTO equipments (id, condominium_id, name, brand, type, host, port, use_https, username, password, notes,
                               model, firmware, serial, mac, installed_at, last_maintenance_at, responsible, created_at, updated_at)
       SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
              COALESCE($19::timestamptz, now()), COALESCE($20::timestamptz, now())
       WHERE EXISTS (SELECT 1 FROM condominiums WHERE id = $2)
       ON CONFLICT (id) DO NOTHING`,
      [
        e.id, e.condominiumId, e.name, e.brand, e.type ?? null, e.host, e.port, e.useHttps === true, e.username ?? '',
        e.password ?? '', e.notes ?? null, e.model ?? null, e.firmware ?? null, e.serial ?? null, e.mac ?? null,
        e.installedAt || null, e.lastMaintenanceAt || null, e.responsible ?? null, e.createdAt ?? null, e.updatedAt ?? null,
      ],
    );
    if (result.rowCount) {
      summary.equipments++;
      importedEquipments.add(e.id);
    }
  }

  for (const u of users) {
    if (!isUuid(u.id) || !u.email || !u.passwordHash) continue;
    const result = await client.query(
      `INSERT INTO users (id, email, name, role, active, password_hash, created_at, updated_at, last_login_at)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::timestamptz, now()), $8, $9)
       ON CONFLICT DO NOTHING`,
      [
        u.id, u.email.trim().toLowerCase(), u.name ?? null, u.role, u.active !== false, u.passwordHash,
        u.createdAt ?? null, u.updatedAt ?? null, u.lastLoginAt ?? null,
      ],
    );
    summary.users += result.rowCount ?? 0;
  }

  const validEvents = events.filter((e) => isUuid(e.id) && isUuid(e.equipmentId) && e.type && e.at);
  await insertEvents(client, validEvents.map((e) => (e.actor && !isUuid(e.actor.id) ? { ...e, actor: undefined } : e)));
  summary.events = validEvents.length;

  for (const [equipmentId, state] of Object.entries(monitor.equipments ?? {})) {
    if (!importedEquipments.has(equipmentId)) continue;
    await client.query('INSERT INTO monitor_states (equipment_id, state) VALUES ($1, $2) ON CONFLICT DO NOTHING', [
      equipmentId,
      JSON.stringify(state),
    ]);
  }

  for (const reboot of monitor.reboots ?? []) {
    if (!importedEquipments.has(reboot.equipmentId)) continue;
    await client.query('INSERT INTO equipment_reboots (equipment_id, at) VALUES ($1, $2)', [reboot.equipmentId, reboot.at]);
  }

  await client.query(`INSERT INTO app_meta (key, value) VALUES ('legacy_import', $1)`, [
    JSON.stringify({ at: new Date().toISOString(), ...summary }),
  ]);
  return summary;
}
