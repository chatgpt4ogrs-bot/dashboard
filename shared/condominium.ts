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

/** Dados cadastrais opcionais. Modelo, serial e firmware também são detectados automaticamente quando o driver suporta. */
export interface EquipmentAssetInfo {
  model?: string;
  firmware?: string;
  serial?: string;
  mac?: string;
  /** Datas no formato AAAA-MM-DD. */
  installedAt?: string;
  lastMaintenanceAt?: string;
  responsible?: string;
}

export interface Equipment extends EquipmentAssetInfo {
  id: string;
  condominiumId: string;
  name: string;
  brand: DeviceBrand;
  type?: string;
  host: string;
  port: number;
  useHttps: boolean;
  username: string;
  /** A senha não vem na listagem; é consultada sob demanda em GET /equipments/:id/password. */
  hasPassword: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EquipmentInput extends EquipmentAssetInfo {
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
