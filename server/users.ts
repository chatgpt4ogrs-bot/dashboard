import { randomUUID } from 'node:crypto';
import { Router, type Response } from 'express';
import type { PoolClient } from 'pg';
import { MIN_PASSWORD_LENGTH, USER_ROLES, type AuthUser, type UserInput, type UserRole } from '../shared/auth.ts';
import {
  hashPassword,
  listUsers,
  normalizeEmail,
  requireRole,
  revokeUserSessions,
  toManagedUser,
  toUserRecord,
  type UserRecord,
  type UserRow,
} from './auth.ts';
import { query, transaction } from './database.ts';
import { ValidationError } from './validation.ts';

export const usersRouter = Router();

usersRouter.use(requireRole('super_admin'));

const currentUser = (res: Response) => res.locals.user as AuthUser;

function parseUserInput(raw: unknown, { requirePassword }: { requirePassword: boolean }): UserInput {
  if (!raw || typeof raw !== 'object') throw new ValidationError('Corpo da requisição inválido.');
  const body = raw as Record<string, unknown>;

  const email = typeof body.email === 'string' ? normalizeEmail(body.email) : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new ValidationError('Informe um e-mail válido.');

  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 100) || undefined : undefined;

  const role = body.role as UserRole;
  if (!USER_ROLES.includes(role)) throw new ValidationError('Perfil inválido.');

  const password = body.password;
  if (password !== undefined && password !== '' && typeof password !== 'string') throw new ValidationError('Senha inválida.');
  if (requirePassword && !password) throw new ValidationError('Informe a senha.');
  if (typeof password === 'string' && password && password.length < MIN_PASSWORD_LENGTH) {
    throw new ValidationError(`A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }
  if (typeof password === 'string' && password.length > 200) throw new ValidationError('Senha muito longa.');

  return { email, name, role, active: body.active !== false, password: (password as string) || undefined };
}

/** Bloqueia a tabela de usuários durante a transação, para que a regra do "último super usuário" não seja burlada em paralelo. */
async function lockUsers(client: PoolClient): Promise<UserRecord[]> {
  const { rows } = await client.query<UserRow>('SELECT * FROM users FOR UPDATE');
  return rows.map(toUserRecord);
}

const activeSuperAdmins = (list: UserRecord[]) => list.filter((u) => u.role === 'super_admin' && u.active);

usersRouter.get('/', async (_req, res) => {
  const list = await listUsers();
  res.json(list.map(toManagedUser).sort((a, b) => a.email.localeCompare(b.email, 'pt-BR')));
});

usersRouter.post('/', async (req, res) => {
  const input = parseUserInput(req.body, { requirePassword: true });
  const passwordHash = await hashPassword(input.password!);

  const { rows } = await query<UserRow>(
    `INSERT INTO users (id, email, name, role, active, password_hash)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (email) DO NOTHING
     RETURNING *`,
    [randomUUID(), input.email, input.name ?? null, input.role, input.active, passwordHash],
  );

  if (!rows[0]) return res.status(409).json({ error: 'Já existe um usuário com este e-mail.' });
  res.status(201).json(toManagedUser(toUserRecord(rows[0])));
});

usersRouter.put('/:id', async (req, res) => {
  const input = parseUserInput(req.body, { requirePassword: false });
  const me = currentUser(res);
  const isSelf = req.params.id === me.id;
  const passwordHash = input.password ? await hashPassword(input.password) : undefined;

  if (isSelf && !input.active) return res.status(400).json({ error: 'Você não pode desativar o seu próprio usuário.' });

  const result = await transaction(async (client): Promise<UserRecord | string> => {
    const list = await lockUsers(client);
    const user = list.find((u) => u.id === req.params.id);
    if (!user) return 'not_found';
    if (list.some((u) => u.id !== user.id && u.email === input.email)) return 'Já existe um usuário com este e-mail.';

    const losesSuperAdmin = user.role === 'super_admin' && user.active && (input.role !== 'super_admin' || !input.active);
    if (losesSuperAdmin && activeSuperAdmins(list).length <= 1) return 'O sistema precisa de pelo menos um super usuário ativo.';

    const { rows } = await client.query<UserRow>(
      `UPDATE users SET email = $2, name = $3, role = $4, active = $5,
         password_hash = COALESCE($6, password_hash), updated_at = now()
       WHERE id = $1 RETURNING *`,
      [user.id, input.email, input.name ?? null, input.role, input.active, passwordHash ?? null],
    );
    return toUserRecord(rows[0]);
  });

  if (result === 'not_found') return res.status(404).json({ error: 'Usuário não encontrado.' });
  if (typeof result === 'string') return res.status(400).json({ error: result });

  if (!result.active || passwordHash) {
    await revokeUserSessions(result.id, isSelf ? (res.locals.sessionToken as string) : undefined);
  }
  res.json(toManagedUser(result));
});

usersRouter.delete('/:id', async (req, res) => {
  if (req.params.id === currentUser(res).id) {
    return res.status(400).json({ error: 'Você não pode excluir o seu próprio usuário.' });
  }

  const result = await transaction(async (client) => {
    const list = await lockUsers(client);
    const user = list.find((u) => u.id === req.params.id);
    if (!user) return 'not_found';
    if (user.role === 'super_admin' && user.active && activeSuperAdmins(list).length <= 1) {
      return 'O sistema precisa de pelo menos um super usuário ativo.';
    }
    // As sessões do usuário são removidas em cascata.
    await client.query('DELETE FROM users WHERE id = $1', [user.id]);
    return 'ok';
  });

  if (result === 'not_found') return res.status(404).json({ error: 'Usuário não encontrado.' });
  if (result !== 'ok') return res.status(400).json({ error: result });
  res.status(204).end();
});
