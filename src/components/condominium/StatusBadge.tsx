import type { DeviceStatus } from '../../../shared/condominium';

export type DisplayStatus = DeviceStatus | 'checking' | 'rebooting' | 'unknown';

const LABELS: Record<DisplayStatus, string> = {
  online: 'Online',
  offline: 'Offline',
  auth_error: 'Falha de login',
  error: 'Erro',
  checking: 'Verificando...',
  rebooting: 'Reiniciando',
  unknown: 'Não verificado',
};

export function StatusBadge({ status, title }: { status: DisplayStatus; title?: string }) {
  return (
    <span className={`status status--${status}`} title={title}>
      <span className="status__dot" />
      {LABELS[status]}
    </span>
  );
}
