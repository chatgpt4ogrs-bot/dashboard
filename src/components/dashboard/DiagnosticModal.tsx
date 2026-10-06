import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { DEVICE_BRANDS, type StatusResult } from '../../../shared/condominium';
import type { AttentionItem } from '../../../shared/dashboard';
import { useI18n } from '../../i18n';
import { equipmentApi, getErrorMessage } from '../../services/api';
import { formatDateTime, formatDuration, formatElapsed } from '../../utils/time';
import { StatusBadge } from '../condominium/StatusBadge';
import { Modal } from '../ui/Modal';

interface DiagnosticModalProps {
  item: AttentionItem;
  now: string;
  onClose: () => void;
  onRetested: () => void;
}

export function DiagnosticModal({ item, now, onClose, onRetested }: DiagnosticModalProps) {
  const { t } = useI18n();
  const [testing, setTesting] = useState(false);
  const [retest, setRetest] = useState<StatusResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const status = retest?.status ?? item.status;
  const message = retest?.message ?? item.message;
  const brand = DEVICE_BRANDS.find((b) => b.value === item.brand)?.label ?? item.brand;

  const handleRetest = async () => {
    setTesting(true);
    setError(null);
    try {
      setRetest(await equipmentApi.status(item.equipmentId));
      onRetested();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setTesting(false);
    }
  };

  return (
    <Modal title={t.diagnostic.title(item.equipmentName)} onClose={onClose}>
      <div className="modal__body">
        <div className="diagnostic__status">
          <StatusBadge status={testing ? 'checking' : status} />
          {message && <span className="diagnostic__message">{t.serverMessage(message)}</span>}
        </div>

        <dl className="diagnostic__list">
          <dt>{t.common.condominium}</dt>
          <dd>{item.condominiumName}</dd>
          <dt>{t.common.address}</dt>
          <dd>
            {item.useHttps ? 'https' : 'http'}://{item.host}:{item.port} · {brand}
          </dd>
          {item.offlineSince && (
            <>
              <dt>{t.diagnostic.offlineSince}</dt>
              <dd>
                {formatDateTime(item.offlineSince)} ({formatDuration(Date.parse(now) - Date.parse(item.offlineSince))})
              </dd>
            </>
          )}
          <dt>{t.common.lastSeen}</dt>
          <dd>{item.lastSeenAt ? `${formatDateTime(item.lastSeenAt)} (${formatElapsed(item.lastSeenAt, now)})` : t.diagnostic.noRecordSinceStart}</dd>
          <dt>{t.diagnostic.lastHour}</dt>
          <dd>{t.diagnostic.failures(item.failuresLastHour, item.checksLastHour)}</dd>
          {item.unstableReason && (
            <>
              <dt>{t.diagnostic.instability}</dt>
              <dd>{t.serverMessage(item.unstableReason)}</dd>
            </>
          )}
        </dl>

        {status !== 'online' && (
          <div>
            <p className="field__label">{t.diagnostic.whatToCheck}</p>
            <ul className="diagnostic__tips">
              {t.diagnostic.suggestions[status].map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </div>
        )}

        {retest?.status === 'online' && <p className="feedback feedback--success">{t.diagnostic.respondedAgain(retest.latencyMs)}</p>}
        {error && <p className="feedback feedback--error">{error}</p>}
      </div>

      <div className="modal__footer">
        <Link to={`/equipamentos/${item.equipmentId}`} className="btn btn--ghost">
          {t.diagnostic.viewHistory}
        </Link>
        <button type="button" className="btn btn--primary" onClick={handleRetest} disabled={testing}>
          <RefreshCw size={16} className={testing ? 'spin' : undefined} /> {testing ? t.common.testing : t.diagnostic.retest}
        </button>
      </div>
    </Modal>
  );
}
