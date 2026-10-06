import { randomUUID } from 'node:crypto';
import type { AuthUser } from '../shared/auth.ts';
import type { DeviceStatus } from '../shared/condominium.ts';
import type { EquipmentEvent, EquipmentEventsPage, EquipmentEventType, EventActor } from '../shared/events.ts';
import { getPool, query, type Queryable } from './database.ts';

const RETENTION_DAYS = Number(process.env.EVENTS_RETENTION_DAYS ?? 90);
const MAX_EVENTS_PER_EQUIPMENT = 1000;
const PRUNE_INTERVAL_MS = 10 * 60 * 1000;

export type NewEvent = Omit<EquipmentEvent, 'id' | 'at'> & { at?: string };

interface EventRow {
  id: string;
  equipment_id: string;
  type: string;
  at: string;
  actor_id: string | null;
  actor_email: string | null;
  actor_name: string | null;
  status: string | null;
  latency_ms: number | null;
  detail: string | null;
  duration_ms: number | null;
}

function toEvent(row: EventRow): EquipmentEvent {
  return {
    id: row.id,
    equipmentId: row.equipment_id,
    type: row.type as EquipmentEventType,
    at: row.at,
    ...(row.actor_id && row.actor_email && {
      actor: { id: row.actor_id, email: row.actor_email, ...(row.actor_name && { name: row.actor_name }) },
    }),
    ...(row.status && { status: row.status as DeviceStatus }),
    ...(row.latency_ms !== null && { latencyMs: row.latency_ms }),
    ...(row.detail && { detail: row.detail }),
    ...(row.duration_ms !== null && { durationMs: row.duration_ms }),
  };
}

export const toActor = (user: AuthUser | undefined): EventActor | undefined =>
  user ? { id: user.id, email: user.email, ...(user.name && { name: user.name }) } : undefined;

/** Insere eventos na ordem cronológica, numa única instrução. */
export async function insertEvents(db: Queryable, events: EquipmentEvent[]): Promise<void> {
  if (events.length === 0) return;
  const sorted = [...events].sort((a, b) => a.at.localeCompare(b.at));
  await db.query(
    `INSERT INTO equipment_events (id, equipment_id, type, at, actor_id, actor_email, actor_name, status, latency_ms, detail, duration_ms)
     SELECT * FROM unnest($1::uuid[], $2::uuid[], $3::text[], $4::timestamptz[], $5::uuid[], $6::text[], $7::text[],
                          $8::text[], $9::int[], $10::text[], $11::bigint[])
     ON CONFLICT (id) DO NOTHING`,
    [
      sorted.map((e) => e.id),
      sorted.map((e) => e.equipmentId),
      sorted.map((e) => e.type),
      sorted.map((e) => e.at),
      sorted.map((e) => e.actor?.id ?? null),
      sorted.map((e) => e.actor?.email ?? null),
      sorted.map((e) => e.actor?.name ?? null),
      sorted.map((e) => e.status ?? null),
      sorted.map((e) => (e.latencyMs === undefined ? null : Math.round(e.latencyMs))),
      sorted.map((e) => e.detail ?? null),
      sorted.map((e) => (e.durationMs === undefined ? null : Math.round(e.durationMs))),
    ],
  );
}

let lastPruneAt = 0;

async function prune(): Promise<void> {
  await query(`DELETE FROM equipment_events WHERE at < now() - make_interval(days => $1)`, [RETENTION_DAYS]);
  await query(
    `DELETE FROM equipment_events WHERE seq IN (
       SELECT seq FROM (
         SELECT seq, row_number() OVER (PARTITION BY equipment_id ORDER BY at DESC, seq DESC) AS position
         FROM equipment_events
       ) ranked WHERE position > $1)`,
    [MAX_EVENTS_PER_EQUIPMENT],
  );
}

/** Grava eventos. Falhas de gravação são registradas no console e não interrompem a ação principal. */
export async function addEvents(newEvents: NewEvent[]): Promise<void> {
  if (newEvents.length === 0) return;
  const now = new Date().toISOString();
  try {
    await insertEvents(
      getPool(),
      newEvents.map((event) => ({ ...event, id: randomUUID(), at: event.at ?? now })),
    );
    if (Date.now() - lastPruneAt > PRUNE_INTERVAL_MS) {
      lastPruneAt = Date.now();
      await prune();
    }
  } catch (error) {
    console.error('Falha ao salvar o histórico de eventos.', error);
  }
}

/** Eventos do equipamento, do mais recente para o mais antigo. */
export async function listEvents(equipmentId: string, { limit, after }: { limit: number; after?: string }): Promise<EquipmentEventsPage> {
  const params: unknown[] = [equipmentId, limit + 1];
  let cursor = '';
  if (after) {
    params.push(after);
    cursor = `AND (at, seq) < (SELECT at, seq FROM equipment_events WHERE id = $3)`;
  }
  const { rows } = await query<EventRow>(
    `SELECT * FROM equipment_events WHERE equipment_id = $1 ${cursor} ORDER BY at DESC, seq DESC LIMIT $2`,
    params,
  );
  return { events: rows.slice(0, limit).map(toEvent), hasMore: rows.length > limit };
}
