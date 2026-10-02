import type { DeviceInfo } from '../../shared/condominium.ts';
import { assertAuthorized, deviceRequest, type DeviceTarget } from './http.ts';
import type { DeviceDriver } from './types.ts';

/**
 * Intelbras (DVR/NVR/câmeras e controladores da Linha SS) usa a API CGI
 * herdada da Dahua, com autenticação Digest.
 */
function parseKeyValue(body: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of body.split(/\r?\n/)) {
    const index = line.indexOf('=');
    if (index > 0) result[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return result;
}

export const intelbrasDriver: DeviceDriver = {
  async getInfo(target: DeviceTarget): Promise<DeviceInfo> {
    const response = await deviceRequest(target, { path: '/cgi-bin/magicBox.cgi?action=getSystemInfo', auth: true });
    assertAuthorized(response);
    const data = parseKeyValue(response.body);
    return {
      model: data.deviceType || data.updateSerial || undefined,
      serial: data.serialNumber || undefined,
      firmware: data.hardwareVersion || undefined,
    };
  },

  async reboot(target: DeviceTarget): Promise<void> {
    const response = await deviceRequest(target, { path: '/cgi-bin/magicBox.cgi?action=reboot', auth: true });
    assertAuthorized(response);
  },
};
