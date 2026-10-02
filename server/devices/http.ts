import { createHash, randomBytes } from 'node:crypto';
import http, { type IncomingHttpHeaders } from 'node:http';
import https, { type RequestOptions } from 'node:https';

export interface DeviceTarget {
  host: string;
  port: number;
  useHttps: boolean;
  username: string;
  password: string;
}

export type DeviceErrorCode = 'offline' | 'auth' | 'unexpected';

export class DeviceError extends Error {
  readonly code: DeviceErrorCode;
  readonly networkCode?: string;

  constructor(code: DeviceErrorCode, message: string, networkCode?: string) {
    super(message);
    this.code = code;
    this.networkCode = networkCode;
  }
}

interface DeviceRequest {
  method?: string;
  path: string;
  body?: string;
  headers?: Record<string, string>;
  /** Responde a desafios 401 com Digest (ou Basic) usando as credenciais do alvo. */
  auth?: boolean;
  timeoutMs?: number;
}

export interface DeviceResponse {
  status: number;
  headers: IncomingHttpHeaders;
  body: string;
}

const DEFAULT_TIMEOUT_MS = 6000;

const NETWORK_ERRORS: Record<string, string> = {
  ECONNREFUSED: 'Conexão recusada pelo dispositivo.',
  ECONNRESET: 'A conexão foi encerrada pelo dispositivo.',
  EHOSTUNREACH: 'Dispositivo inacessível na rede.',
  ENETUNREACH: 'Rede inacessível.',
  ENOTFOUND: 'Endereço não encontrado.',
  EAI_AGAIN: 'Falha ao resolver o endereço.',
  ETIMEDOUT: 'Tempo de resposta esgotado.',
};

function toDeviceError(error: unknown): DeviceError {
  if (error instanceof DeviceError) return error;
  const code = (error as NodeJS.ErrnoException)?.code;
  if (code && NETWORK_ERRORS[code]) return new DeviceError('offline', NETWORK_ERRORS[code], code);
  return new DeviceError('offline', error instanceof Error ? error.message : 'Falha de comunicação.');
}

function send(target: DeviceTarget, req: DeviceRequest, extraHeaders: Record<string, string> = {}): Promise<DeviceResponse> {
  const options: RequestOptions = {
    host: target.host,
    port: target.port,
    method: req.method ?? 'GET',
    path: req.path,
    timeout: req.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    // Equipamentos de CFTV/acesso quase sempre usam certificado autoassinado.
    rejectUnauthorized: false,
    headers: {
      ...req.headers,
      ...extraHeaders,
      ...(req.body !== undefined && { 'Content-Length': String(Buffer.byteLength(req.body)) }),
    },
  };

  return new Promise((resolve, reject) => {
    const request = (target.useHttps ? https : http).request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
      res.on('error', reject);
    });
    request.on('timeout', () => request.destroy(new DeviceError('offline', 'Tempo de resposta esgotado.')));
    request.on('error', reject);
    if (req.body !== undefined) request.write(req.body);
    request.end();
  });
}

function md5(value: string): string {
  return createHash('md5').update(value).digest('hex');
}

function parseChallenge(header: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const match of header.matchAll(/(\w+)=(?:"([^"]*)"|([^\s,]+))/g)) {
    params[match[1].toLowerCase()] = match[2] ?? match[3];
  }
  return params;
}

function buildDigestHeader(challengeHeader: string, method: string, uri: string, target: DeviceTarget): string {
  const challenge = parseChallenge(challengeHeader);
  const qop = challenge.qop?.split(',').map((q) => q.trim()).includes('auth') ? 'auth' : undefined;
  const nc = '00000001';
  const cnonce = randomBytes(8).toString('hex');

  const ha1 = md5(`${target.username}:${challenge.realm}:${target.password}`);
  const ha2 = md5(`${method}:${uri}`);
  const response = qop ? md5(`${ha1}:${challenge.nonce}:${nc}:${cnonce}:${qop}:${ha2}`) : md5(`${ha1}:${challenge.nonce}:${ha2}`);

  const parts = [
    `username="${target.username}"`,
    `realm="${challenge.realm}"`,
    `nonce="${challenge.nonce}"`,
    `uri="${uri}"`,
    `response="${response}"`,
  ];
  if (challenge.opaque) parts.push(`opaque="${challenge.opaque}"`);
  if (challenge.algorithm) parts.push(`algorithm=${challenge.algorithm}`);
  if (qop) parts.push(`qop=${qop}`, `nc=${nc}`, `cnonce="${cnonce}"`);
  return `Digest ${parts.join(', ')}`;
}

export async function deviceRequest(target: DeviceTarget, req: DeviceRequest): Promise<DeviceResponse> {
  try {
    const first = await send(target, req);
    if (first.status !== 401 || !req.auth) return first;

    const raw = first.headers['www-authenticate'];
    const challenge = Array.isArray(raw) ? raw.join(', ') : (raw ?? '');
    const digestIndex = challenge.search(/digest/i);

    if (digestIndex >= 0) {
      const authorization = buildDigestHeader(challenge.slice(digestIndex + 6), req.method ?? 'GET', req.path, target);
      return await send(target, req, { Authorization: authorization });
    }
    if (/basic/i.test(challenge)) {
      const token = Buffer.from(`${target.username}:${target.password}`).toString('base64');
      return await send(target, req, { Authorization: `Basic ${token}` });
    }
    return first;
  } catch (error) {
    throw toDeviceError(error);
  }
}

export function assertAuthorized(response: DeviceResponse): void {
  if (response.status === 401 || response.status === 403) {
    throw new DeviceError('auth', 'Usuário ou senha inválidos.');
  }
  if (response.status < 200 || response.status >= 300) {
    throw new DeviceError('unexpected', `O dispositivo respondeu com HTTP ${response.status}.`);
  }
}
