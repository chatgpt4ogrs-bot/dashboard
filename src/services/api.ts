import type { AuthUser, LoginInput, ManagedUser, UserInput } from '../../shared/auth';
import type {
  Condominium,
  CondominiumInput,
  CondominiumSummary,
  Equipment,
  EquipmentInput,
  RebootResult,
  StatusResult,
} from '../../shared/condominium';
import type { DashboardSummary } from '../../shared/dashboard';
import type { EquipmentDetails } from '../../shared/equipment';
import type { EquipmentEventsPage } from '../../shared/events';
import type { ConnectionTestResult, DatabaseInput, SetupInput, SetupResult, SetupStatus } from '../../shared/setup';
import { getMessages } from '../i18n';

export class ApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

/** Disparado quando a API responde 401 fora das rotas de login (sessão expirada ou removida). */
export const AUTH_EXPIRED_EVENT = 'auth:expired';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const t = getMessages();
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch {
    throw new ApiError(t.errors.serverUnavailable);
  }

  if (response.status === 204) return undefined as T;

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (!data && response.status >= 500) throw new ApiError(t.errors.serverUnavailable, response.status);
    if (response.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    throw new ApiError(data?.error ? t.serverMessage(data.error) : t.errors.http(response.status), response.status);
  }
  return data as T;
}

const json = (body: unknown) => JSON.stringify(body);

export const condominiumApi = {
  list: () => request<CondominiumSummary[]>('/condominiums'),
  get: (id: string) => request<Condominium>(`/condominiums/${id}`),
  create: (input: CondominiumInput) => request<Condominium>('/condominiums', { method: 'POST', body: json(input) }),
  update: (id: string, input: CondominiumInput) =>
    request<Condominium>(`/condominiums/${id}`, { method: 'PUT', body: json(input) }),
  remove: (id: string) => request<void>(`/condominiums/${id}`, { method: 'DELETE' }),
};

export const equipmentApi = {
  list: (condominiumId: string) => request<Equipment[]>(`/condominiums/${condominiumId}/equipments`),
  create: (condominiumId: string, input: EquipmentInput) =>
    request<Equipment>(`/condominiums/${condominiumId}/equipments`, { method: 'POST', body: json(input) }),
  update: (id: string, input: EquipmentInput) =>
    request<Equipment>(`/equipments/${id}`, { method: 'PUT', body: json(input) }),
  remove: (id: string) => request<void>(`/equipments/${id}`, { method: 'DELETE' }),
  details: (id: string) => request<EquipmentDetails>(`/equipments/${id}/details`),
  events: (id: string, after?: string) =>
    request<EquipmentEventsPage>(`/equipments/${id}/events?limit=30${after ? `&after=${encodeURIComponent(after)}` : ''}`),
  getPassword: async (id: string) => (await request<{ password: string }>(`/equipments/${id}/password`)).password,
  status: (id: string) => request<StatusResult>(`/equipments/${id}/status`, { method: 'POST' }),
  reboot: (id: string) => request<RebootResult>(`/equipments/${id}/reboot`, { method: 'POST' }),
};

export const authApi = {
  me: () => request<AuthUser>('/auth/me'),
  login: (input: LoginInput) => request<AuthUser>('/auth/login', { method: 'POST', body: json(input) }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
};

export const usersApi = {
  list: () => request<ManagedUser[]>('/users'),
  create: (input: UserInput) => request<ManagedUser>('/users', { method: 'POST', body: json(input) }),
  update: (id: string, input: UserInput) => request<ManagedUser>(`/users/${id}`, { method: 'PUT', body: json(input) }),
  remove: (id: string) => request<void>(`/users/${id}`, { method: 'DELETE' }),
};

export const setupApi = {
  status: () => request<SetupStatus>('/setup/status'),
  test: (database: DatabaseInput) => request<ConnectionTestResult>('/setup/test', { method: 'POST', body: json({ database }) }),
  run: (input: SetupInput) => request<SetupResult>('/setup', { method: 'POST', body: json(input) }),
};

export const dashboardApi = {
  summary: () => request<DashboardSummary>('/dashboard'),
  refresh: () => request<DashboardSummary>('/dashboard/refresh', { method: 'POST' }),
};

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : getMessages().errors.unexpected;
}
