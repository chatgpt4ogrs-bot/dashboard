import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import type { AuthUser, ManagedUser, UserRole } from '../shared/auth.ts';
import { getPool, query, type Queryable } from './database.ts';

export interface UserRecord extends AuthUser {
  passwordHash: string;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
  lastLoginAt?: string;
}

export interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: string;
  active: boolean;
  password_hash: string;
  created_at: string;
  updated_at: string | null;
  last_login_at: string | null;
}

const COOKIE_NAME = 'centralizador_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const MAX_FAILED_LOGINS = 10;
const FAILED_LOGIN_WINDOW_MS = 15 * 60 * 1000;

const SCRYPT_PARAMS: ScryptOptions = { N: 16384, r: 8, p: 1 };
const KEY_LENGTH = 64;

/* ---------- Senhas ---------- */

function deriveKey(password: string, salt: Buffer, params: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, params, (error, key) => (error ? reject(error) : resolve(key))),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt, SCRYPT_PARAMS);
  return ['scrypt', SCRYPT_PARAMS.N, SCRYPT_PARAMS.r, SCRYPT_PARAMS.p, salt.toString('base64'), key.toString('base64')].join('$');
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, N, r, p, salt, hash] = stored.split('$');
  if (algorithm !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const key = await deriveKey(password, Buffer.from(salt, 'base64'), { N: Number(N), r: Number(r), p: Number(p) });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** Usado quando o e-mail não existe, para a resposta levar o mesmo tempo e não revelar quais e-mails estão cadastrados. */
const dummyHash = hashPassword(randomUUID());

/* ---------- Usuários ---------- */

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export function toUserRecord(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    name: row.name ?? undefined,
    role: row.role as UserRole,
    active: row.active,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
    lastLoginAt: row.last_login_at ?? undefined,
  };
}

const toAuthUser = ({ id, email, name, role }: UserRecord): AuthUser => ({ id, email, ...(name && { name }), role });

export const toManagedUser = (user: UserRecord): ManagedUser => ({
  ...toAuthUser(user),
  active: user.active,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  lastLoginAt: user.lastLoginAt,
});

export async function listUsers(): Promise<UserRecord[]> {
  const { rows } = await query<UserRow>('SELECT * FROM users');
  return rows.map(toUserRecord);
}

async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const { rows } = await query<UserRow>('SELECT * FROM users WHERE email = $1', [normalizeEmail(email)]);
  return rows[0] ? toUserRecord(rows[0]) : null;
}

/** Cria o usuário ou, se o e-mail já existir, redefine a senha e o perfil e o reativa. */
export async function upsertUser(
  input: { email: string; password: string; role: UserRole; name?: string },
  db: Queryable = getPool(),
): Promise<{ user: UserRecord; created: boolean }> {
  const passwordHash = await hashPassword(input.password);
  const { rows } = await db.query<UserRow & { inserted: boolean }>(
    `INSERT INTO users (id, email, name, role, active, password_hash)
     VALUES ($1, $2, $3, $4, true, $5)
     ON CONFLICT (email) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       role = EXCLUDED.role,
       active = true,
       name = COALESCE(EXCLUDED.name, users.name),
       updated_at = now()
     RETURNING *, (xmax = 0) AS inserted`,
    [randomUUID(), normalizeEmail(input.email), input.name ?? null, input.role, passwordHash],
  );
  return { user: toUserRecord(rows[0]), created: rows[0].inserted };
}

/* ---------- Sessões ---------- */

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await query('DELETE FROM sessions WHERE expires_at <= now()');
  await query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [
    hashToken(token),
    userId,
    new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  ]);
  return token;
}

async function deleteSession(token: string): Promise<void> {
  await query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
}

/** Encerra todas as sessões do usuário, exceto (opcionalmente) a do token informado. */
export async function revokeUserSessions(userId: string, keepToken?: string): Promise<void> {
  await query('DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2', [userId, keepToken ? hashToken(keepToken) : '']);
}

async function findSessionUser(token: string): Promise<AuthUser | null> {
  const { rows } = await query<UserRow>(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now() AND u.active`,
    [hashToken(token)],
  );
  return rows[0] ? toAuthUser(toUserRecord(rows[0])) : null;
}

/* ---------- Cookies ---------- */

function readCookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

function setSessionCookie(req: Request, res: Response, token: string, maxAgeMs: number) {
  const parts = [`${COOKIE_NAME}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${Math.floor(maxAgeMs / 1000)}`];
  if (req.secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

/** Abre uma sessão para o usuário e grava o cookie na resposta. */
export async function startSession(req: Request, res: Response, userId: string): Promise<void> {
  setSessionCookie(req, res, await createSession(userId), SESSION_TTL_MS);
}

/* ---------- Limite de tentativas ---------- */

const failedLogins = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(key: string): boolean {
  const entry = failedLogins.get(key);
  if (!entry || entry.resetAt <= Date.now()) return false;
  return entry.count >= MAX_FAILED_LOGINS;
}

function registerFailure(key: string) {
  const now = Date.now();
  const entry = failedLogins.get(key);
  if (!entry || entry.resetAt <= now) failedLogins.set(key, { count: 1, resetAt: now + FAILED_LOGIN_WINDOW_MS });
  else entry.count++;
}

/* ---------- Rotas e middleware ---------- */

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  const { email, password } = (req.body ?? {}) as { email?: unknown; password?: unknown };
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    return res.status(400).json({ error: 'Informe o e-mail e a senha.' });
  }

  const limitKey = req.ip ?? 'unknown';
  if (isRateLimited(limitKey)) {
    return res.status(429).json({ error: 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.' });
  }

  const user = await findUserByEmail(email);
  const valid = await verifyPassword(password, user?.passwordHash ?? (await dummyHash));
  if (!user || !valid) {
    registerFailure(limitKey);
    return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
  }

  if (!user.active) {
    return res.status(403).json({ error: 'Este usuário está desativado. Fale com um administrador.' });
  }

  failedLogins.delete(limitKey);
  await startSession(req, res, user.id);
  await query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);
  res.json(toAuthUser(user));
});

authRouter.post('/logout', async (req, res) => {
  const token = readCookie(req, COOKIE_NAME);
  if (token) await deleteSession(token);
  setSessionCookie(req, res, '', 0);
  res.status(204).end();
});

authRouter.get('/me', async (req, res) => {
  const token = readCookie(req, COOKIE_NAME);
  const user = token ? await findSessionUser(token) : null;
  if (!user) return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
  res.json(user);
});

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = readCookie(req, COOKIE_NAME);
  const user = token ? await findSessionUser(token) : null;
  if (!user) {
    res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
    return;
  }
  res.locals.user = user;
  res.locals.sessionToken = token;
  next();
}

export function requireRole(...roles: UserRole[]) {
  return (_req: Request, res: Response, next: NextFunction) => {
    const user = res.locals.user as AuthUser | undefined;
    if (!user || !roles.includes(user.role)) {
      res.status(403).json({ error: 'Você não tem permissão para esta ação.' });
      return;
    }
    next();
  };
}
