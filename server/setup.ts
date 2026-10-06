import { Router, type Response } from 'express';
import { MIN_PASSWORD_LENGTH } from '../shared/auth.ts';
import type { SetupInput, SetupStatus } from '../shared/setup.ts';
import { startSession, upsertUser } from './auth.ts';
import { saveConfig, type DatabaseConfig } from './config.ts';
import {
  closeDatabase,
  connectDatabase,
  describeDatabaseError,
  ensureDatabase,
  getDatabaseStatus,
  isValidDatabaseName,
  testConnection,
  transaction,
} from './database.ts';
import { hasLegacyData, importLegacyData } from './legacyImport.ts';
import { startMonitor } from './monitor.ts';
import { ValidationError } from './validation.ts';

export const setupRouter = Router();

let setupRunning = false;

function parseDatabaseInput(raw: unknown): DatabaseConfig {
  const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const host = typeof body.host === 'string' ? body.host.trim() : '';
  if (!host || !/^[a-zA-Z0-9.\-:[\]]+$/.test(host)) throw new ValidationError('Informe um IP ou endereço válido para o banco.');

  const port = Number(body.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new ValidationError('Porta do banco inválida.');

  const user = typeof body.user === 'string' ? body.user.trim() : '';
  if (!user) throw new ValidationError('Informe o usuário do banco.');

  const database = typeof body.database === 'string' && body.database.trim() ? body.database.trim() : 'centralizador';
  if (!isValidDatabaseName(database)) {
    throw new ValidationError('Nome do banco inválido: use letras, números e _ (sem espaços), começando por letra.');
  }

  return { host, port, user, password: typeof body.password === 'string' ? body.password : '', database };
}

function parseAdminInput(raw: unknown): SetupInput['admin'] {
  const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ValidationError('Informe um e-mail válido para o Super usuário.');

  const password = typeof body.password === 'string' ? body.password : '';
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new ValidationError(`A senha do Super usuário precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }

  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 100) : 'Super usuário';
  return { name, email, password };
}

function rejectIfConfigured(res: Response): boolean {
  if (getDatabaseStatus().state === 'unconfigured') return false;
  res.status(409).json({ error: 'O sistema já está configurado.' });
  return true;
}

setupRouter.get('/status', (_req, res) => {
  const { state, error } = getDatabaseStatus();
  const status: SetupStatus = {
    configured: state !== 'unconfigured',
    databaseState: state,
    databaseError: error,
    hasLegacyData: state === 'unconfigured' && hasLegacyData(),
  };
  res.json(status);
});

setupRouter.post('/test', async (req, res) => {
  if (rejectIfConfigured(res)) return;
  const config = parseDatabaseInput((req.body as Partial<SetupInput> | undefined)?.database);
  try {
    const { serverVersion, databaseExists } = await testConnection(config);
    const detail = databaseExists
      ? `O banco "${config.database}" já existe e será usado.`
      : `O banco "${config.database}" será criado.`;
    res.json({ ok: true, message: `Conectado ao PostgreSQL ${serverVersion}. ${detail}` });
  } catch (error) {
    res.json({ ok: false, message: describeDatabaseError(error) });
  }
});

setupRouter.post('/', async (req, res) => {
  if (rejectIfConfigured(res)) return;
  if (setupRunning) return res.status(409).json({ error: 'A configuração já está em andamento.' });

  const body = (req.body ?? {}) as Partial<SetupInput>;
  const config = parseDatabaseInput(body.database);
  const admin = parseAdminInput(body.admin);

  setupRunning = true;
  try {
    await ensureDatabase(config);
    await connectDatabase(config);

    const { user, imported } = await transaction(async (client) => {
      const imported = await importLegacyData(client);
      const { user } = await upsertUser({ ...admin, role: 'super_admin' }, client);
      return { user, imported };
    });

    await saveConfig({ database: config });
    await startSession(req, res, user.id);
    startMonitor();

    console.log(`Configuração concluída: banco "${config.database}" em ${config.host}:${config.port}.`);
    res.status(201).json({ user: { id: user.id, email: user.email, name: user.name, role: user.role }, imported });
  } catch (error) {
    await closeDatabase({ reset: true });
    console.error('Falha na configuração inicial.', error);
    res.status(400).json({ error: describeDatabaseError(error) });
  } finally {
    setupRunning = false;
  }
});
