import type {
  Condominium,
  CondominiumInput,
  CondominiumSummary,
  Equipment,
  EquipmentInput,
  RebootResult,
  StatusResult,
} from '../../shared/condominium';

export class ApiError extends Error {}

const SERVER_UNAVAILABLE = 'Não foi possível conectar ao servidor. Verifique se ele está rodando (npm run dev).';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch {
    throw new ApiError(SERVER_UNAVAILABLE);
  }

  if (response.status === 204) return undefined as T;

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (!data && response.status >= 500) throw new ApiError(SERVER_UNAVAILABLE);
    throw new ApiError(data?.error ?? `Erro ${response.status}`);
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
  status: (id: string) => request<StatusResult>(`/equipments/${id}/status`, { method: 'POST' }),
  reboot: (id: string) => request<RebootResult>(`/equipments/${id}/reboot`, { method: 'POST' }),
};

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Erro inesperado.';
}
