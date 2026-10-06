import type { DeviceInfo, DeviceStatus, Equipment } from './condominium.js';

/** Agregado das verificações de um intervalo fixo (ex.: 5 minutos). */
export interface LatencyBucket {
  /** Início do intervalo (ISO). */
  at: string;
  checks: number;
  failures: number;
  /** Quantas vezes o equipamento passou de online para fora do ar neste intervalo. */
  drops: number;
  avgLatencyMs: number | null;
  minLatencyMs: number | null;
  maxLatencyMs: number | null;
}

export interface EquipmentMonitorInfo {
  status: DeviceStatus;
  message: string;
  checkedAt: string;
  latencyMs: number | null;
  lastSeenAt: string | null;
  offlineSince: string | null;
  /** Desde quando está online sem interrupção, segundo o monitor. */
  onlineSince: string | null;
  /** Primeira verificação registrada pelo monitor; o uptime não pode ser medido antes disso. */
  trackedSince: string;
  unstableReason: string | null;
  /** Último modelo/serial/firmware lido do próprio equipamento. */
  detected: DeviceInfo | null;
}

export interface EquipmentStats24h {
  checks: number;
  failures: number;
  /** Percentual de verificações online (0–100), ou null sem dados. */
  availability: number | null;
  avgLatencyMs: number | null;
  maxLatencyMs: number | null;
  drops: number;
  reboots: number;
}

export interface EquipmentDetails {
  equipment: Equipment;
  condominium: { id: string; name: string };
  monitor: EquipmentMonitorInfo | null;
  monitorIntervalMs: number;
  bucketMs: number;
  /** Intervalos consecutivos cobrindo as últimas 24 horas, do mais antigo ao mais recente. */
  history: LatencyBucket[];
  stats24h: EquipmentStats24h;
  unstableLatencyMs: number;
}
