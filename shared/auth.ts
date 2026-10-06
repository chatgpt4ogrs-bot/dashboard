/** Por enquanto existe apenas o super usuário, com acesso a tudo. */
export type UserRole = 'super_admin';

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super usuário',
};

export const USER_ROLES = Object.keys(ROLE_LABELS) as UserRole[];

export const MIN_PASSWORD_LENGTH = 8;

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
}

export interface LoginInput {
  email: string;
  password: string;
}

/** Usuário como aparece na tela de gerenciamento (nunca inclui a senha). */
export interface ManagedUser extends AuthUser {
  active: boolean;
  createdAt: string;
  updatedAt?: string;
  lastLoginAt?: string;
}

export interface UserInput {
  email: string;
  name?: string;
  role: UserRole;
  active: boolean;
  /** Obrigatória na criação; na edição, `undefined` mantém a senha atual. */
  password?: string;
}
