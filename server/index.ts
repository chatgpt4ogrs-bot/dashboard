import { existsSync } from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import { apiRouter } from './routes.ts';
import { ValidationError } from './validation.ts';

// O servidor guarda credenciais e pode reiniciar equipamentos: por padrão só aceita conexões locais.
const HOST = process.env.HOST ?? '127.0.0.1';
const PORT = Number(process.env.PORT ?? 3001);
const DIST_DIR = path.resolve('dist');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

app.use('/api', apiRouter);
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
  console.error(error);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

app.listen(PORT, HOST, () => {
  console.log(`API do Centralizador rodando em http://${HOST}:${PORT}`);
});
