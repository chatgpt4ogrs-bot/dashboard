import type { DeviceStatus } from '../../../shared/condominium';
import { useI18n } from '../../i18n';

export type DisplayStatus = DeviceStatus | 'checking' | 'rebooting' | 'unknown';

export function StatusBadge({ status, title }: { status: DisplayStatus; title?: string }) {
  const { t } = useI18n();
  return (
    <span className={`status status--${status}`} title={title && t.serverMessage(title)}>
      <span className="status__dot" />
      {t.status[status]}
    </span>
  );
}
