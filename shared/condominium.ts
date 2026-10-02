export type DeviceBrand = 'intelbras' | 'intelbras-ss' | 'controlid' | 'hikvision';

export const DEVICE_BRANDS: { value: DeviceBrand; label: string }[] = [
  { value: 'intelbras', label: 'Intelbras' },
  { value: 'intelbras-ss', label: 'Intelbras Linha SS' },
  { value: 'controlid', label: 'Control iD' },
  { value: 'hikvision', label: 'Hikvision' },
];

export interface Condominium {
  id: string;
  name: string;
  address?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CondominiumSummary extends Condominium {
  equipmentCount: number;
}

export type CondominiumInput = Pick<Condominium, 'name' | 'address' | 'notes'>;

export interface Equipment {
  id: string;
  condominiumId: string;
  name: string;
  brand: DeviceBrand;
  type?: string;
  host: string;
  port: number;
  useHttps: boolean;
  username: string;
  /** A senha nunca sai do servidor; o frontend só sabe se existe uma cadastrada. */
  hasPassword: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EquipmentInput {
  name: string;
  brand: DeviceBrand;
  type?: string;
  host: string;
  port: number;
  useHttps: boolean;
  username: string;
  /** Na edição, `undefined` mantém a senha atual. */
  password?: string;
  notes?: string;
}

export type DeviceStatus = 'online' | 'offline' | 'auth_error' | 'error';

export interface DeviceInfo {
  model?: string;
  serial?: string;
  firmware?: string;
}

export interface StatusResult {
  status: DeviceStatus;
  message: string;
  latencyMs?: number;
  info?: DeviceInfo;
  checkedAt: string;
}

export interface RebootResult {
  ok: boolean;
  message: string;
}
