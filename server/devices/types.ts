import type { DeviceInfo } from '../../shared/condominium.ts';
import type { DeviceTarget } from './http.ts';

export interface DeviceDriver {
  /** Consulta dados do equipamento; serve também como teste de conectividade e credenciais. */
  getInfo(target: DeviceTarget): Promise<DeviceInfo>;
  reboot(target: DeviceTarget): Promise<void>;
}
