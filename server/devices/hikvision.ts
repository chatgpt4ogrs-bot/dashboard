import type { DeviceInfo } from '../../shared/condominium.ts';
import { assertAuthorized, deviceRequest, type DeviceTarget } from './http.ts';
import type { DeviceDriver } from './types.ts';

/** Hikvision usa a API ISAPI (XML) com autenticação Digest. */
function readXmlTag(xml: string, tag: string): string | undefined {
  return xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))?.[1]?.trim() || undefined;
}

export const hikvisionDriver: DeviceDriver = {
  async getInfo(target: DeviceTarget): Promise<DeviceInfo> {
    const response = await deviceRequest(target, { path: '/ISAPI/System/deviceInfo', auth: true });
    assertAuthorized(response);
    return {
      model: readXmlTag(response.body, 'model'),
      serial: readXmlTag(response.body, 'serialNumber'),
      firmware: readXmlTag(response.body, 'firmwareVersion'),
    };
  },

  async reboot(target: DeviceTarget): Promise<void> {
    const response = await deviceRequest(target, { method: 'PUT', path: '/ISAPI/System/reboot', body: '', auth: true });
    assertAuthorized(response);
  },
};
