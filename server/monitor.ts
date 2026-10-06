import type { DeviceInfo, DeviceStatus, StatusResult } from '../shared/condominium.ts';
import type { AttentionItem, DashboardSummary, OfflineEquipment } from '../shared/dashboard.ts';
import type { EquipmentDetails, LatencyBucket } from '../shared/equipment.ts';
import type { EventActor } from '../shared/events.ts';
import { query } from './database.ts';
import { getCondominium, getEquipment, listAllEquipments, listCondominiums, toPublicEquipment, type EquipmentRecord } from './db.ts';
import { checkStatus } from './devices/index.ts';
import { addEvents, type NewEvent } from './events.ts';

const INTERVAL_MS = Number(process.env.MONITOR_INTERVAL_MS ?? 60_000);
const CONCURRENCY = Number(process.env.MONITOR_CONCURRENCY ?? 8);

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const BUCKET_MS = 5 * 60 * 1000;
const BUCKET_COUNT = DAY_MS / BUCKET_MS;

/** Critérios de instabilidade, avaliados sobre as verificações da última hora. */
const UNSTABLE_MIN_CHECKS = 3;
const UNSTABLE_MIN_TRANSITIONS = 2;
const UNSTABLE_FAILURE_RATE = 0.2;
const UNSTABLE_LATENCY_MS = 1500;

/** Latência que gera o evento "Latência elevada"; volta ao normal abaixo de 80% do limite, para não oscilar. */
const LATENCY_WARNING_MS = Number(process.env.LATENCY_WARNING_MS ?? 800);
const LATENCY_RECOVERY_MS = LATENCY_WARNING_MS * 0.8;

interface CheckEntry {
  at: string;
  status: DeviceStatus;
  latencyMs?: number;
}

/** Agregado de 5 minutos, mantido por 24 horas para o gráfico de latência. */
interface HistoryBucket {
  at: string;
  checks: number;
  failures: number;
  drops: number;
  latencySum: number;
  latencyCount: number;
  latencyMin?: number;
  latencyMax?: number;
}

interface EquipmentMonitorState {
  status: DeviceStatus;
  message?: string;
  checkedAt: string;
  latencyMs?: number;
  lastSeenAt?: string;
  offlineSince?: string;
  onlineSince?: string;
  trackedSince?: string;
  info?: DeviceInfo;
  latencyHigh?: boolean;
  checks: CheckEntry[];
  history?: HistoryBucket[];
}

interface MonitorData {
  equipments: Record<string, EquipmentMonitorState>;
  reboots: { equipmentId: string; at: string }[];
}

/** O estado fica em memória e é gravado no banco após cada verificação. */
let loading: Promise<MonitorData> | null = null;
let writeQueue: Promise<unknown> = Promise.resolve();
let currentCycle: Promise<void> | null = null;
let lastCycleAt: string | null = null;

function load(): Promise<MonitorData> {
  loading ??= (async () => {
    const [states, reboots] = await Promise.all([
      query<{ equipment_id: string; state: EquipmentMonitorState }>('SELECT equipment_id, state FROM monitor_states'),
      query<{ equipment_id: string; at: string }>(
        `SELECT equipment_id, at FROM equipment_reboots WHERE at > now() - interval '1 day' ORDER BY at`,
      ),
    ]);
    return {
      equipments: Object.fromEntries(states.rows.map((row) => [row.equipment_id, row.state])),
      reboots: reboots.rows.map((row) => ({ equipmentId: row.equipment_id, at: row.at })),
    };
  })().catch((error) => {
    loading = null;
    throw error;
  });
  return loading;
}

function persist(): Promise<void> {
  const run = writeQueue.then(async () => {
    const data = await load();
    // O EXISTS evita violar a chave estrangeira se o equipamento foi excluído durante a verificação.
    await query(
      `INSERT INTO monitor_states (equipment_id, state, updated_at)
       SELECT key::uuid, value, now() FROM jsonb_each($1::jsonb)
       WHERE EXISTS (SELECT 1 FROM equipments WHERE id = key::uuid)
       ON CONFLICT (equipment_id) DO UPDATE SET state = EXCLUDED.state, updated_at = now()`,
      [JSON.stringify(data.equipments)],
    );
    await query(`DELETE FROM equipment_reboots WHERE at < now() - interval '1 day'`);
  });
  writeQueue = run.catch((error) => console.error('Falha ao salvar o histórico do monitor.', error));
  return run;
}

function prune(data: MonitorData, now: number) {
  for (const state of Object.values(data.equipments)) {
    state.checks = state.checks.filter((c) => now - Date.parse(c.at) <= HOUR_MS);
    state.history = state.history?.filter((b) => now - Date.parse(b.at) < DAY_MS);
  }
  data.reboots = data.reboots.filter((r) => now - Date.parse(r.at) <= DAY_MS);
}

/** Início da sequência atual de verificações online (para estados gravados antes de existir `onlineSince`). */
function onlineStreakStart(checks: CheckEntry[]): string | undefined {
  let start: string | undefined;
  for (let i = checks.length - 1; i >= 0 && checks[i].status === 'online'; i--) start = checks[i].at;
  return start;
}

function addToHistory(history: HistoryBucket[], result: StatusResult, dropped: boolean): HistoryBucket[] {
  const at = new Date(Math.floor(Date.parse(result.checkedAt) / BUCKET_MS) * BUCKET_MS).toISOString();
  let bucket = history.at(-1);
  if (bucket?.at !== at) {
    bucket = { at, checks: 0, failures: 0, drops: 0, latencySum: 0, latencyCount: 0 };
    history = [...history, bucket];
  }
  bucket.checks++;
  if (result.status !== 'online') bucket.failures++;
  if (dropped) bucket.drops++;
  if (result.status === 'online' && result.latencyMs !== undefined) {
    bucket.latencySum += result.latencyMs;
    bucket.latencyCount++;
    bucket.latencyMin = Math.min(bucket.latencyMin ?? Infinity, result.latencyMs);
    bucket.latencyMax = Math.max(bucket.latencyMax ?? -Infinity, result.latencyMs);
  }
  return history;
}

/** Eventos gerados pela mudança de estado entre a verificação anterior e a atual. */
function transitionEvents(
  equipmentId: string,
  previous: EquipmentMonitorState | undefined,
  result: StatusResult,
  latencyHigh: boolean,
): NewEvent[] {
  const base = { equipmentId, at: result.checkedAt, status: result.status };
  const isOnline = result.status === 'online';
  const events: NewEvent[] = [];

  if (!previous) {
    events.push({ ...base, type: 'monitoring_started', latencyMs: result.latencyMs, detail: isOnline ? undefined : result.message });
  } else if (previous.status !== result.status) {
    if (isOnline) {
      const since = previous.offlineSince ?? previous.checkedAt;
      events.push({ ...base, type: 'online', latencyMs: result.latencyMs, durationMs: Date.parse(result.checkedAt) - Date.parse(since) });
    } else {
      events.push({ ...base, type: 'offline', detail: result.message });
    }
  }

  const wasHigh = previous?.status === 'online' && previous.latencyHigh === true;
  if (isOnline && latencyHigh && !wasHigh) events.push({ ...base, type: 'latency_high', latencyMs: result.latencyMs });
  if (isOnline && !latencyHigh && wasHigh) events.push({ ...base, type: 'latency_normal', latencyMs: result.latencyMs });

  return events;
}

function applyResult(data: MonitorData, equipmentId: string, result: StatusResult): NewEvent[] {
  const previous = data.equipments[equipmentId];
  const isOnline = result.status === 'online';
  const wasOnline = previous?.status === 'online';

  const latency = result.latencyMs ?? 0;
  const latencyHigh =
    isOnline && (latency >= LATENCY_WARNING_MS || (wasOnline && previous.latencyHigh === true && latency >= LATENCY_RECOVERY_MS));
  const events = transitionEvents(equipmentId, previous, result, latencyHigh);

  data.equipments[equipmentId] = {
    status: result.status,
    message: result.message,
    checkedAt: result.checkedAt,
    latencyMs: result.latencyMs,
    lastSeenAt: isOnline ? result.checkedAt : previous?.lastSeenAt,
    offlineSince: isOnline ? undefined : !previous || wasOnline ? result.checkedAt : (previous.offlineSince ?? result.checkedAt),
    onlineSince: !isOnline
      ? undefined
      : wasOnline
        ? (previous.onlineSince ?? onlineStreakStart(previous.checks) ?? previous.checkedAt)
        : result.checkedAt,
    trackedSince: previous ? (previous.trackedSince ?? previous.checks[0]?.at ?? previous.checkedAt) : result.checkedAt,
    info: result.info && Object.values(result.info).some(Boolean) ? result.info : previous?.info,
    latencyHigh,
    checks: [...(previous?.checks ?? []), { at: result.checkedAt, status: result.status, latencyMs: result.latencyMs }],
    history: addToHistory(previous?.history ?? [], result, wasOnline && !isOnline),
  };
  return events;
}

/** Registra uma verificação manual (botão "Verificar"), com quem a executou. */
export async function recordCheck(equipmentId: string, result: StatusResult, actor?: EventActor): Promise<void> {
  const data = await load();
  const events = applyResult(data, equipmentId, result);
  prune(data, Date.now());
  await persist();
  await addEvents([
    {
      equipmentId,
      type: 'check',
      at: result.checkedAt,
      actor,
      status: result.status,
      latencyMs: result.latencyMs,
      detail: result.status === 'online' ? undefined : result.message,
    },
    ...events,
  ]);
}

export async function recordReboot(equipmentId: string, ok: boolean, message: string, actor?: EventActor): Promise<void> {
  if (ok) {
    const at = new Date().toISOString();
    const data = await load();
    data.reboots.push({ equipmentId, at });
    prune(data, Date.now());
    await query('INSERT INTO equipment_reboots (equipment_id, at) VALUES ($1, $2)', [equipmentId, at]);
  }
  await addEvents([{ equipmentId, type: ok ? 'reboot' : 'reboot_failed', actor, detail: message }]);
}

async function mapWithConcurrency<T>(items: T[], limit: number, task: (item: T) => Promise<void>) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await task(items[next++]);
  });
  await Promise.all(workers);
}

async function cycle(): Promise<void> {
  const [equipments, data] = await Promise.all([listAllEquipments(), load()]);
  const ids = new Set(equipments.map((e) => e.id));
  for (const id of Object.keys(data.equipments)) if (!ids.has(id)) delete data.equipments[id];

  const results: [string, StatusResult][] = [];
  await mapWithConcurrency<EquipmentRecord>(equipments, CONCURRENCY, async (equipment) => {
    results.push([equipment.id, await checkStatus(equipment)]);
  });

  // Ignora equipamentos excluídos durante a verificação.
  const stillExisting = new Set((await listAllEquipments()).map((e) => e.id));
  const events: NewEvent[] = [];
  for (const [equipmentId, result] of results) {
    if (stillExisting.has(equipmentId)) events.push(...applyResult(data, equipmentId, result));
  }

  prune(data, Date.now());
  lastCycleAt = new Date().toISOString();
  await persist();
  await addEvents(events);
}

/** Executa um ciclo de verificação; se já houver um em andamento, aguarda o mesmo. */
export function runCycle(): Promise<void> {
  currentCycle ??= cycle()
    .catch((error) => console.error('Falha no ciclo de monitoramento.', error))
    .finally(() => {
      currentCycle = null;
    });
  return currentCycle;
}

let started = false;

export function startMonitor(): void {
  if (started) return;
  started = true;
  runCycle();
  setInterval(runCycle, INTERVAL_MS).unref();
  console.log(`Monitor de equipamentos ativo (a cada ${Math.round(INTERVAL_MS / 1000)}s).`);
}

function unstableReason(state: EquipmentMonitorState): string | null {
  if (state.status === 'online' && (state.latencyMs ?? 0) >= UNSTABLE_LATENCY_MS) {
    return `Latência alta (${state.latencyMs} ms).`;
  }

  const checks = state.checks;
  if (checks.length < UNSTABLE_MIN_CHECKS) return null;

  let transitions = 0;
  for (let i = 1; i < checks.length; i++) {
    if ((checks[i].status === 'online') !== (checks[i - 1].status === 'online')) transitions++;
  }
  if (transitions >= UNSTABLE_MIN_TRANSITIONS) return `Caiu e voltou ${Math.ceil(transitions / 2)}x na última hora.`;

  const failures = checks.filter((c) => c.status !== 'online').length;
  if (state.status === 'online' && failures / checks.length >= UNSTABLE_FAILURE_RATE) {
    return `${failures} de ${checks.length} verificações falharam na última hora.`;
  }
  return null;
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const [equipments, condominiums, data] = await Promise.all([listAllEquipments(), listCondominiums(), load()]);
  const now = Date.now();
  const condominiumNames = new Map(condominiums.map((c) => [c.id, c.name]));

  let online = 0;
  let offline = 0;
  let unstable = 0;
  let pending = 0;
  const latencies: number[] = [];
  let longestOffline: OfflineEquipment | null = null;
  const attention: AttentionItem[] = [];

  for (const equipment of equipments) {
    const state = data.equipments[equipment.id];
    if (!state) {
      pending++;
      continue;
    }

    const reason = unstableReason(state);
    if (reason) unstable++;
    if (reason || state.status !== 'online') {
      attention.push({
        equipmentId: equipment.id,
        equipmentName: equipment.name,
        condominiumId: equipment.condominiumId,
        condominiumName: condominiumNames.get(equipment.condominiumId) ?? '—',
        brand: equipment.brand,
        host: equipment.host,
        port: equipment.port,
        useHttps: equipment.useHttps,
        status: state.status,
        message: state.message ?? '',
        unstableReason: reason,
        latencyMs: state.status === 'online' ? (state.latencyMs ?? null) : null,
        checkedAt: state.checkedAt,
        lastSeenAt: state.lastSeenAt ?? null,
        offlineSince: state.status === 'online' ? null : (state.offlineSince ?? state.checkedAt),
        checksLastHour: state.checks.length,
        failuresLastHour: state.checks.filter((c) => c.status !== 'online').length,
      });
    }

    if (state.status === 'online') {
      online++;
      if (state.latencyMs !== undefined) latencies.push(state.latencyMs);
    } else {
      offline++;
      const since = state.offlineSince ?? state.checkedAt;
      const durationMs = now - Date.parse(since);
      if (!longestOffline || durationMs > longestOffline.durationMs) {
        longestOffline = {
          equipmentId: equipment.id,
          equipmentName: equipment.name,
          condominiumId: equipment.condominiumId,
          condominiumName: condominiumNames.get(equipment.condominiumId) ?? '—',
          offlineSince: since,
          durationMs,
        };
      }
    }
  }

  const offlineMs = (item: AttentionItem) => (item.offlineSince ? now - Date.parse(item.offlineSince) : -1);
  attention.sort((a, b) => offlineMs(b) - offlineMs(a) || a.condominiumName.localeCompare(b.condominiumName, 'pt-BR'));

  const rebootsLast24h = data.reboots.filter(
    (r) => now - Date.parse(r.at) <= DAY_MS && equipments.some((e) => e.id === r.equipmentId),
  ).length;

  return {
    generatedAt: new Date(now).toISOString(),
    monitor: { intervalMs: INTERVAL_MS, lastCycleAt, running: currentCycle !== null },
    totalCondominiums: condominiums.length,
    totalEquipments: equipments.length,
    pendingEquipments: pending,
    online,
    offline,
    unstable,
    rebootsLast24h,
    longestOffline,
    averageLatencyMs: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null,
    attention,
  };
}

export async function getEquipmentDetails(equipmentId: string): Promise<EquipmentDetails | null> {
  const [equipment, data] = await Promise.all([getEquipment(equipmentId), load()]);
  if (!equipment) return null;

  const condominium = await getCondominium(equipment.condominiumId);
  const state = data.equipments[equipmentId];
  const now = Date.now();

  const stored = new Map((state?.history ?? []).map((b) => [Date.parse(b.at), b]));
  const lastStart = Math.floor(now / BUCKET_MS) * BUCKET_MS;
  const history: LatencyBucket[] = [];
  let checks = 0;
  let failures = 0;
  let drops = 0;
  let latencySum = 0;
  let latencyCount = 0;
  let maxLatency: number | null = null;

  for (let i = BUCKET_COUNT - 1; i >= 0; i--) {
    const start = lastStart - i * BUCKET_MS;
    const bucket = stored.get(start);
    history.push({
      at: new Date(start).toISOString(),
      checks: bucket?.checks ?? 0,
      failures: bucket?.failures ?? 0,
      drops: bucket?.drops ?? 0,
      avgLatencyMs: bucket?.latencyCount ? Math.round(bucket.latencySum / bucket.latencyCount) : null,
      minLatencyMs: bucket?.latencyMin ?? null,
      maxLatencyMs: bucket?.latencyMax ?? null,
    });
    if (!bucket) continue;
    checks += bucket.checks;
    failures += bucket.failures;
    drops += bucket.drops;
    latencySum += bucket.latencySum;
    latencyCount += bucket.latencyCount;
    if (bucket.latencyMax !== undefined) maxLatency = Math.max(maxLatency ?? 0, bucket.latencyMax);
  }

  return {
    equipment: toPublicEquipment(equipment),
    condominium: { id: equipment.condominiumId, name: condominium?.name ?? '—' },
    monitor: state
      ? {
          status: state.status,
          message: state.message ?? '',
          checkedAt: state.checkedAt,
          latencyMs: state.status === 'online' ? (state.latencyMs ?? null) : null,
          lastSeenAt: state.lastSeenAt ?? null,
          offlineSince: state.status === 'online' ? null : (state.offlineSince ?? state.checkedAt),
          onlineSince: state.status === 'online' ? (state.onlineSince ?? state.checkedAt) : null,
          trackedSince: state.trackedSince ?? state.checks[0]?.at ?? state.checkedAt,
          unstableReason: unstableReason(state),
          detected: state.info ?? null,
        }
      : null,
    monitorIntervalMs: INTERVAL_MS,
    bucketMs: BUCKET_MS,
    history,
    stats24h: {
      checks,
      failures,
      availability: checks ? Math.round(((checks - failures) / checks) * 1000) / 10 : null,
      avgLatencyMs: latencyCount ? Math.round(latencySum / latencyCount) : null,
      maxLatencyMs: maxLatency,
      drops,
      reboots: data.reboots.filter((r) => r.equipmentId === equipmentId && now - Date.parse(r.at) <= DAY_MS).length,
    },
    unstableLatencyMs: UNSTABLE_LATENCY_MS,
  };
}
