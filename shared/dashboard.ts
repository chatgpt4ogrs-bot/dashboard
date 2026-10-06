import type { DeviceBrand, DeviceStatus } from './condominium.js';

export interface OfflineEquipment {
  equipmentId: string;
  equipmentName: string;
  condominiumId: string;
  condominiumName: string;
  /** Início da queda. Se o equipamento já estava offline quando o monitor começou, é a primeira verificação. */
  offlineSince: string;
  durationMs: number;
}

export interface AttentionItem {
  equipmentId: string;
  equipmentName: string;
  condominiumId: string;
  condominiumName: string;
  brand: DeviceBrand;
  host: string;
  port: number;
  useHttps: boolean;
  status: DeviceStatus;
  message: string;
  /** Motivo da instabilidade, quando houver. */
  unstableReason: string | null;
  latencyMs: number | null;
  checkedAt: string;
  /** Última resposta "online" registrada; `null` se nunca respondeu desde que o monitor começou. */
  lastSeenAt: string | null;
  offlineSince: string | null;
  checksLastHour: number;
  failuresLastHour: number;
}

export interface DashboardSummary {
  generatedAt: string;
  monitor: {
    intervalMs: number;
    lastCycleAt: string | null;
    running: boolean;
  };
  totalCondominiums: number;
  totalEquipments: number;
  /** Equipamentos ainda não verificados pelo monitor (recém-cadastrados ou monitor iniciando). */
  pendingEquipments: number;
  online: number;
  offline: number;
  unstable: number;
  rebootsLast24h: number;
  longestOffline: OfflineEquipment | null;
  averageLatencyMs: number | null;
  /** Equipamentos fora do ar ou instáveis; offline primeiro (maior queda antes). */
  attention: AttentionItem[];
}
