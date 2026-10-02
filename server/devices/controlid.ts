import type { DeviceInfo } from '../../shared/condominium.ts';
import { assertAuthorized, DeviceError, deviceRequest, type DeviceTarget } from './http.ts';
import type { DeviceDriver } from './types.ts';

/** Control iD (iDAccess, iDFace, iDFlex...) usa API JSON com sessão obtida em /login.fcgi. */
async function call<T>(target: DeviceTarget, endpoint: string, session?: string, payload: object = {}): Promise<T> {
  const path = session ? `/${endpoint}?session=${encodeURIComponent(session)}` : `/${endpoint}`;
  const response = await deviceRequest(target, {
    method: 'POST',
    path,
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
  if (response.status === 400 && endpoint === 'login.fcgi') {
    throw new DeviceError('auth', 'Usuário ou senha inválidos.');
  }
  assertAuthorized(response);
  try {
    return (response.body ? JSON.parse(response.body) : {}) as T;
  } catch {
    throw new DeviceError('unexpected', 'Resposta inválida do dispositivo.');
  }
}

async function login(target: DeviceTarget): Promise<string> {
  const { session } = await call<{ session?: string }>(target, 'login.fcgi', undefined, {
    login: target.username,
    password: target.password,
  });
  if (!session) throw new DeviceError('auth', 'Usuário ou senha inválidos.');
  return session;
}

export const controlIdDriver: DeviceDriver = {
  async getInfo(target: DeviceTarget): Promise<DeviceInfo> {
    const session = await login(target);
    try {
      const info = await call<{ serial?: string; version?: string; device_name?: string }>(
        target,
        'system_information.fcgi',
        session,
      );
      return { model: info.device_name, serial: info.serial, firmware: info.version };
    } finally {
      call(target, 'logout.fcgi', session).catch(() => undefined);
    }
  },

  async reboot(target: DeviceTarget): Promise<void> {
    const session = await login(target);
    await call(target, 'reboot.fcgi', session);
  },
};
