import { DEVICE_BRANDS, type CondominiumInput, type DeviceBrand, type EquipmentInput } from '../shared/condominium.ts';

export class ValidationError extends Error {}

type Body = Record<string, unknown>;

function asBody(value: unknown): Body {
  if (!value || typeof value !== 'object') throw new ValidationError('Corpo da requisição inválido.');
  return value as Body;
}

function optionalText(body: Body, key: string, max = 500): string | undefined {
  const value = body[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new ValidationError(`Campo "${key}" inválido.`);
  return value.trim().slice(0, max) || undefined;
}

function requiredText(body: Body, key: string, label: string, max = 200): string {
  const value = optionalText(body, key, max);
  if (!value) throw new ValidationError(`Informe ${label}.`);
  return value;
}

export function parseCondominiumInput(raw: unknown): CondominiumInput {
  const body = asBody(raw);
  return {
    name: requiredText(body, 'name', 'o nome do condomínio'),
    address: optionalText(body, 'address'),
    notes: optionalText(body, 'notes', 2000),
  };
}

export function parseEquipmentInput(raw: unknown, { requirePassword }: { requirePassword: boolean }): EquipmentInput {
  const body = asBody(raw);

  const brand = body.brand as DeviceBrand;
  if (!DEVICE_BRANDS.some((b) => b.value === brand)) throw new ValidationError('Marca inválida.');

  const host = requiredText(body, 'host', 'o endereço IP ou domínio', 253);
  if (!/^[a-zA-Z0-9.\-:[\]]+$/.test(host)) throw new ValidationError('Endereço IP ou domínio inválido.');

  const port = Number(body.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new ValidationError('Porta inválida.');

  const password = body.password;
  if (password !== undefined && typeof password !== 'string') throw new ValidationError('Senha inválida.');
  if (requirePassword && !password) throw new ValidationError('Informe a senha do equipamento.');

  return {
    name: requiredText(body, 'name', 'o nome do equipamento'),
    brand,
    type: optionalText(body, 'type', 100),
    host,
    port,
    useHttps: body.useHttps === true,
    username: requiredText(body, 'username', 'o usuário', 100),
    password: password || undefined,
    notes: optionalText(body, 'notes', 2000),
  };
}
