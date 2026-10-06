import { existsSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import express, { type NextFunction, type Request, type Response } from 'express';
import { authRouter, requireAuth } from './auth.ts';
import { loadConfig } from './config.ts';
import { connectDatabase, DatabaseUnavailableError, describeDatabaseError, getDatabaseStatus } from './database.ts';
import { startMonitor } from './monitor.ts';
import { apiRouter } from './routes.ts';
import { setupRouter } from './setup.ts';
import { usersRouter } from './users.ts';
import { ValidationError } from './validation.ts';

// O servidor guarda credenciais e pode reiniciar equipamentos: por padrão só aceita conexões locais.
const HOST = process.env.HOST ?? '127.0.0.1';
const PORT = Number(process.env.PORT ?? 3001);
const DIST_DIR = path.resolve('dist');
const RECONNECT_DELAY_MS = 15_000;

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

app.use('/api/setup', setupRouter);

app.use('/api', (_req, res, next) => {
  const { state, error } = getDatabaseStatus();
  if (state === 'ready') return next();
  if (state === 'unconfigured') {
    res.status(503).json({ error: 'O sistema ainda não foi configurado.', setupRequired: true });
    return;
  }
  res.status(503).json({ error: error ? `Banco de dados indisponível: ${error}` : 'Conectando ao banco de dados...' });
});

app.use('/api/auth', authRouter);
app.use('/api/users', requireAuth, usersRouter);
app.use('/api', requireAuth, apiRouter);
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Rota não encontrada.' });
});

if (existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get('/{*splat}', (_req, res) => res.sendFile(path.join(DIST_DIR, 'index.html')));
}

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof ValidationError) {
    res.status(400).json({ error: error.message });
    return;
  }
  if ((error as { type?: string }).type === 'entity.parse.failed') {
    res.status(400).json({ error: 'JSON inválido.' });
    return;
  }
  if (error instanceof DatabaseUnavailableError) {
    res.status(503).json({ error: error.message });
    return;
  }
  // Identificador com formato inválido (ex.: /equipments/abc).
  if ((error as { code?: string }).code === '22P02') {
    res.status(404).json({ error: 'Registro não encontrado.' });
    return;
  }
  console.error(error);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

/** Conecta no banco configurado, tentando de novo enquanto o servidor do banco estiver fora do ar. */
async function initDatabase(): Promise<void> {
  const config = await loadConfig();
  if (!config) {
    console.log('Primeira inicialização: abra o sistema no navegador para configurar o banco de dados.');
    return;
  }
  const { host, port, database } = config.database;
  for (;;) {
    try {
      await connectDatabase(config.database);
      console.log(`Conectado ao PostgreSQL (${host}:${port}/${database}).`);
      startMonitor();
      return;
    } catch (error) {
      console.error(`Falha ao conectar no PostgreSQL: ${describeDatabaseError(error)} Nova tentativa em ${RECONNECT_DELAY_MS / 1000}s.`);
      await sleep(RECONNECT_DELAY_MS);
    }
  }
}

app.listen(PORT, HOST, () => {
  console.log(`API do Centralizador rodando em http://${HOST}:${PORT}`);
  initDatabase();
});
