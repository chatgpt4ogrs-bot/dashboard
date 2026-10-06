import type { DeviceStatus } from './condominium.js';

export type EquipmentEventType =
  /** Mudanças detectadas pelo monitor (ou por uma verificação manual). */
  | 'monitoring_started'
  | 'online'
  | 'offline'
  | 'latency_high'
  | 'latency_normal'
  /** Ações executadas por usuários. */
  | 'check'
  | 'reboot'
  | 'reboot_failed'
  | 'created'
  | 'updated'
  | 'deleted';

export type EventCategory = 'status' | 'action';

export const EVENT_CATEGORY: Record<EquipmentEventType, EventCategory> = {
  monitoring_started: 'status',
  online: 'status',
  offline: 'status',
  latency_high: 'status',
  latency_normal: 'status',
  check: 'action',
  reboot: 'action',
  reboot_failed: 'action',
  created: 'action',
  updated: 'action',
  deleted: 'action',
};

export interface EventActor {
  id: string;
  email: string;
  name?: string;
}

export interface EquipmentEvent {
  id: string;
  equipmentId: string;
  type: EquipmentEventType;
  at: string;
  /** Usuário que executou a ação; ausente quando o evento foi gerado pelo monitor automático. */
  actor?: EventActor;
  status?: DeviceStatus;
  latencyMs?: number;
  /** Texto complementar (mensagem do equipamento, campos alterados etc.). */
  detail?: string;
  /** Duração em ms (ex.: quanto tempo ficou fora do ar antes de voltar). */
  durationMs?: number;
}

export interface EquipmentEventsPage {
  events: EquipmentEvent[];
  hasMore: boolean;
}
