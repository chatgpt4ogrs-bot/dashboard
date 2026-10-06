import type { AuthUser } from './auth.js';

export interface SetupStatus {
  /** `false` enquanto o banco não foi configurado (primeira inicialização). */
  configured: boolean;
  databaseState: 'unconfigured' | 'connecting' | 'ready' | 'error';
  databaseError: string | null;
  /** Há dados da versão anterior (arquivos JSON) que serão importados na configuração. */
  hasLegacyData: boolean;
}

export interface DatabaseInput {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export interface SetupInput {
  database: DatabaseInput;
  admin: { name: string; email: string; password: string };
}

export interface SetupResult {
  user: AuthUser;
  imported: { condominiums: number; equipments: number; users: number; events: number } | null;
}

export interface ConnectionTestResult {
  ok: boolean;
  message: string;
}
