import { randomUUID } from 'node:crypto';
import type {
  Condominium,
  CondominiumInput,
  CondominiumSummary,
  DeviceBrand,
  Equipment,
  EquipmentInput,
} from '../shared/condominium.ts';
import { query, transaction } from './database.ts';

export interface EquipmentRecord extends Omit<Equipment, 'hasPassword'> {
  password: string;
}

interface CondominiumRow {
  id: string;
  name: string;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface EquipmentRow {
  id: string;
  condominium_id: string;
  name: string;
  brand: string;
  type: string | null;
  host: string;
  port: number;
  use_https: boolean;
  username: string;
  password: string;
  notes: string | null;
  model: string | null;
  firmware: string | null;
  serial: string | null;
  mac: string | null;
  installed_at: string | null;
  last_maintenance_at: string | null;
  responsible: string | null;
  created_at: string;
  updated_at: string;
}

const opt = (value: string | null) => value ?? undefined;

function toCondominium(row: CondominiumRow): Condominium {
  return {
    id: row.id,
    name: row.name,
    address: opt(row.address),
    notes: opt(row.notes),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toEquipmentRecord(row: EquipmentRow): EquipmentRecord {
  return {
    id: row.id,
    condominiumId: row.condominium_id,
    name: row.name,
    brand: row.brand as DeviceBrand,
    type: opt(row.type),
    host: row.host,
    port: row.port,
    useHttps: row.use_https,
    username: row.username,
    password: row.password,
    notes: opt(row.notes),
    model: opt(row.model),
    firmware: opt(row.firmware),
    serial: opt(row.serial),
    mac: opt(row.mac),
    installedAt: opt(row.installed_at),
    lastMaintenanceAt: opt(row.last_maintenance_at),
    responsible: opt(row.responsible),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toPublicEquipment({ password, ...rest }: EquipmentRecord): Equipment {
  return { ...rest, hasPassword: password.length > 0 };
}

/** Valores das colunas editáveis, na ordem de EQUIPMENT_COLUMNS. */
const EQUIPMENT_COLUMNS = [
  'name', 'brand', 'type', 'host', 'port', 'use_https', 'username', 'notes',
  'model', 'firmware', 'serial', 'mac', 'installed_at', 'last_maintenance_at', 'responsible',
] as const;

function equipmentValues(input: Omit<EquipmentInput, 'password'>): unknown[] {
  return [
    input.name, input.brand, input.type ?? null, input.host, input.port, input.useHttps, input.username, input.notes ?? null,
    input.model ?? null, input.firmware ?? null, input.serial ?? null, input.mac ?? null,
    input.installedAt ?? null, input.lastMaintenanceAt ?? null, input.responsible ?? null,
  ];
}

/* ---------- Condomínios ---------- */

export async function listCondominiumSummaries(): Promise<CondominiumSummary[]> {
  const { rows } = await query<CondominiumRow & { equipment_count: number }>(`
    SELECT c.*, (SELECT count(*)::int FROM equipments e WHERE e.condominium_id = c.id) AS equipment_count
    FROM condominiums c`);
  return rows
    .map((row) => ({ ...toCondominium(row), equipmentCount: row.equipment_count }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

export async function listCondominiums(): Promise<Condominium[]> {
  const { rows } = await query<CondominiumRow>('SELECT * FROM condominiums');
  return rows.map(toCondominium);
}

export async function getCondominium(id: string): Promise<Condominium | null> {
  const { rows } = await query<CondominiumRow>('SELECT * FROM condominiums WHERE id = $1', [id]);
  return rows[0] ? toCondominium(rows[0]) : null;
}

export async function createCondominium(input: CondominiumInput): Promise<Condominium> {
  const { rows } = await query<CondominiumRow>(
    'INSERT INTO condominiums (id, name, address, notes) VALUES ($1, $2, $3, $4) RETURNING *',
    [randomUUID(), input.name, input.address ?? null, input.notes ?? null],
  );
  return toCondominium(rows[0]);
}

export async function updateCondominium(id: string, input: CondominiumInput): Promise<Condominium | null> {
  const { rows } = await query<CondominiumRow>(
    'UPDATE condominiums SET name = $2, address = $3, notes = $4, updated_at = now() WHERE id = $1 RETURNING *',
    [id, input.name, input.address ?? null, input.notes ?? null],
  );
  return rows[0] ? toCondominium(rows[0]) : null;
}

/** Exclui o condomínio e (em cascata) seus equipamentos; retorna o que foi removido. */
export function deleteCondominium(id: string): Promise<{ condominium: Condominium; equipments: EquipmentRecord[] } | null> {
  return transaction(async (client) => {
    const equipments = await client.query<EquipmentRow>('SELECT * FROM equipments WHERE condominium_id = $1', [id]);
    const deleted = await client.query<CondominiumRow>('DELETE FROM condominiums WHERE id = $1 RETURNING *', [id]);
    if (!deleted.rows[0]) return null;
    return { condominium: toCondominium(deleted.rows[0]), equipments: equipments.rows.map(toEquipmentRecord) };
  });
}

/* ---------- Equipamentos ---------- */

export async function listAllEquipments(): Promise<EquipmentRecord[]> {
  const { rows } = await query<EquipmentRow>('SELECT * FROM equipments');
  return rows.map(toEquipmentRecord);
}

/** `null` quando o condomínio não existe. */
export async function listEquipmentsByCondominium(condominiumId: string): Promise<EquipmentRecord[] | null> {
  if (!(await getCondominium(condominiumId))) return null;
  const { rows } = await query<EquipmentRow>('SELECT * FROM equipments WHERE condominium_id = $1', [condominiumId]);
  return rows.map(toEquipmentRecord).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

export async function getEquipment(id: string): Promise<EquipmentRecord | null> {
  const { rows } = await query<EquipmentRow>('SELECT * FROM equipments WHERE id = $1', [id]);
  return rows[0] ? toEquipmentRecord(rows[0]) : null;
}

export async function equipmentExists(id: string): Promise<boolean> {
  const { rowCount } = await query('SELECT 1 FROM equipments WHERE id = $1', [id]);
  return (rowCount ?? 0) > 0;
}

/** `null` quando o condomínio não existe. */
export async function createEquipment(condominiumId: string, input: EquipmentInput): Promise<EquipmentRecord | null> {
  const columns = ['id', 'condominium_id', 'password', ...EQUIPMENT_COLUMNS];
  const values = [randomUUID(), condominiumId, input.password ?? '', ...equipmentValues(input)];
  const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
  const { rows } = await query<EquipmentRow>(
    `INSERT INTO equipments (${columns.join(', ')})
     SELECT ${placeholders} WHERE EXISTS (SELECT 1 FROM condominiums WHERE id = $2)
     RETURNING *`,
    values,
  );
  return rows[0] ? toEquipmentRecord(rows[0]) : null;
}

/** Atualiza o equipamento; `password` indefinida mantém a senha atual. Retorna o registro antes e depois. */
export function updateEquipment(
  id: string,
  input: Omit<EquipmentInput, 'password'>,
  password: string | undefined,
): Promise<{ before: EquipmentRecord; after: EquipmentRecord } | null> {
  return transaction(async (client) => {
    const current = await client.query<EquipmentRow>('SELECT * FROM equipments WHERE id = $1 FOR UPDATE', [id]);
    if (!current.rows[0]) return null;

    const values = equipmentValues(input);
    const sets = EQUIPMENT_COLUMNS.map((column, i) => `${column} = $${i + 2}`);
    if (password !== undefined) {
      values.push(password);
      sets.push(`password = $${values.length + 1}`);
    }
    const updated = await client.query<EquipmentRow>(
      `UPDATE equipments SET ${sets.join(', ')}, updated_at = now() WHERE id = $1 RETURNING *`,
      [id, ...values],
    );
    return { before: toEquipmentRecord(current.rows[0]), after: toEquipmentRecord(updated.rows[0]) };
  });
}

export async function deleteEquipment(id: string): Promise<EquipmentRecord | null> {
  const { rows } = await query<EquipmentRow>('DELETE FROM equipments WHERE id = $1 RETURNING *', [id]);
  return rows[0] ? toEquipmentRecord(rows[0]) : null;
}
