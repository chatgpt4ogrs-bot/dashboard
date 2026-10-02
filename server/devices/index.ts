import type { DeviceBrand, RebootResult, StatusResult } from '../../shared/condominium.ts';
import type { EquipmentRecord } from '../db.ts';
import { controlIdDriver } from './controlid.ts';
import { hikvisionDriver } from './hikvision.ts';
import { DeviceError, type DeviceTarget } from './http.ts';
import { intelbrasDriver } from './intelbras.ts';
import type { DeviceDriver } from './types.ts';

const DRIVERS: Record<DeviceBrand, DeviceDriver> = {
  intelbras: intelbrasDriver,
  'intelbras-ss': intelbrasDriver,
  controlid: controlIdDriver,
  hikvision: hikvisionDriver,
};

function toTarget(equipment: EquipmentRecord): DeviceTarget {
  return {
    host: equipment.host,
    port: equipment.port,
    useHttps: equipment.useHttps,
    username: equipment.username,
    password: equipment.password,
  };
}

export async function checkStatus(equipment: EquipmentRecord): Promise<StatusResult> {
  const started = Date.now();
  const checkedAt = new Date().toISOString();

  try {
    const info = await DRIVERS[equipment.brand].getInfo(toTarget(equipment));
    return { status: 'online', message: 'Dispositivo online.', latencyMs: Date.now() - started, info, checkedAt };
  } catch (error) {
    const latencyMs = Date.now() - started;
    if (error instanceof DeviceError) {
      if (error.code === 'auth') return { status: 'auth_error', message: error.message, latencyMs, checkedAt };
      if (error.code === 'unexpected') return { status: 'error', message: error.message, latencyMs, checkedAt };
      return { status: 'offline', message: error.message, checkedAt };
    }
    return { status: 'error', message: 'Erro inesperado ao consultar o dispositivo.', checkedAt };
  }
}

export async function reboot(equipment: EquipmentRecord): Promise<RebootResult> {
  try {
    await DRIVERS[equipment.brand].reboot(toTarget(equipment));
    return { ok: true, message: 'Comando de reinício enviado. O equipamento ficará offline por alguns instantes.' };
  } catch (error) {
    // O dispositivo pode derrubar a conexão ao começar a reiniciar antes de responder.
    if (error instanceof DeviceError && error.networkCode === 'ECONNRESET') {
      return { ok: true, message: 'Comando de reinício enviado. O equipamento ficará offline por alguns instantes.' };
    }
    return { ok: false, message: error instanceof Error ? error.message : 'Falha ao enviar o reinício.' };
  }
}
