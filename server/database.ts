import pg from 'pg';
import type { DatabaseConfig } from './config.ts';
import { SCHEMA_SQL } from './schema.ts';

// Datas como strings ISO (igual ao formato que a API já usava) e bigint como number.
pg.types.setTypeParser(pg.types.builtins.TIMESTAMPTZ, (value) => new Date(value).toISOString());
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);
pg.types.setTypeParser(pg.types.builtins.INT8, (value) => Number(value));

export type DatabaseState = 'unconfigured' | 'connecting' | 'ready' | 'error';

export class DatabaseUnavailableError extends Error {}

let pool: pg.Pool | null = null;
let state: DatabaseState = 'unconfigured';
let lastError: string | null = null;

export function getDatabaseStatus(): { state: DatabaseState; error: string | null } {
  return { state, error: lastError };
}

export function isValidDatabaseName(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(name);
}

function clientConfig(config: DatabaseConfig, database = config.database): pg.ClientConfig {
  return {
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database,
    connectionTimeoutMillis: 8000,
    application_name: 'centralizador',
  };
}

export function describeDatabaseError(error: unknown): string {
  const err = error as { code?: string; message?: string };
  switch (err.code) {
    case '28P01':
    case '28000':
      return 'Usuário ou senha do banco inválidos.';
    case 'ECONNREFUSED':
      return 'Conexão recusada. Confira o IP e a porta do PostgreSQL.';
    case 'ETIMEDOUT':
    case 'EHOSTUNREACH':
    case 'ENETUNREACH':
      return 'Servidor do banco inacessível. Confira o IP, a porta e o firewall.';
    case 'ENOTFOUND':
    case 'EAI_AGAIN':
      return 'Endereço do servidor não encontrado.';
    case '42501':
      return 'O usuário do banco não tem permissão para esta operação.';
    case '3D000':
      return 'O banco de dados informado não existe.';
    default:
      return err.message?.includes('timeout') ? 'Tempo esgotado ao conectar no banco.' : (err.message ?? 'Falha ao conectar no banco.');
  }
}

export function getPool(): pg.Pool {
  if (!pool || state !== 'ready') {
    throw new DatabaseUnavailableError(lastError ? `Banco de dados indisponível: ${lastError}` : 'Banco de dados não configurado.');
  }
  return pool;
}

export function query<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params?: unknown[]) {
  return getPool().query<T>(text, params);
}

/** Pool ou cliente de uma transação. */
export type Queryable = Pick<pg.Pool, 'query'>;

export async function transaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Testa a conexão usando o banco de manutenção `postgres`, que existe em toda instalação. */
export async function testConnection(config: DatabaseConfig): Promise<{ serverVersion: string; databaseExists: boolean }> {
  const client = new pg.Client(clientConfig(config, 'postgres'));
  await client.connect();
  try {
    const version = await client.query<{ server_version: string }>('SHOW server_version');
    const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [config.database]);
    return { serverVersion: version.rows[0].server_version, databaseExists: (exists.rowCount ?? 0) > 0 };
  } finally {
    await client.end().catch(() => undefined);
  }
}

/** Cria o banco da aplicação, caso ainda não exista. */
export async function ensureDatabase(config: DatabaseConfig): Promise<boolean> {
  if (!isValidDatabaseName(config.database)) throw new Error('Nome do banco inválido.');
  const { databaseExists } = await testConnection(config);
  if (databaseExists) return false;

  const client = new pg.Client(clientConfig(config, 'postgres'));
  await client.connect();
  try {
    await client.query(`CREATE DATABASE "${config.database}" WITH ENCODING 'UTF8' TEMPLATE template0`);
    return true;
  } finally {
    await client.end().catch(() => undefined);
  }
}

/** Abre o pool de conexões e aplica o esquema. Substitui o pool anterior, se houver. */
export async function connectDatabase(config: DatabaseConfig): Promise<void> {
  state = 'connecting';
  const next = new pg.Pool({ ...clientConfig(config), max: 10 });
  next.on('error', (error) => console.error('Erro em conexão ociosa com o PostgreSQL:', error.message));
  try {
    await next.query(SCHEMA_SQL);
  } catch (error) {
    await next.end().catch(() => undefined);
    state = 'error';
    lastError = describeDatabaseError(error);
    throw error;
  }
  const previous = pool;
  pool = next;
  state = 'ready';
  lastError = null;
  await previous?.end().catch(() => undefined);
}

/** Fecha o pool. Com `reset`, volta ao estado "não configurado" (usado quando a configuração inicial falha). */
export async function closeDatabase({ reset = false }: { reset?: boolean } = {}): Promise<void> {
  await pool?.end().catch(() => undefined);
  pool = null;
  if (reset) {
    state = 'unconfigured';
    lastError = null;
  }
}
