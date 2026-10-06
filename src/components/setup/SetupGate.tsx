import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { SetupStatus } from '../../../shared/setup';
import { useI18n } from '../../i18n';
import { SetupPage } from '../../pages/SetupPage';
import { getErrorMessage, setupApi } from '../../services/api';

/** Mostra a configuração inicial enquanto o banco de dados não estiver configurado. */
export function SetupGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { t } = useI18n();

  const load = useCallback(async () => {
    try {
      setStatus(await setupApi.status());
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <div className="login">
        <div className="login__card">
          <p className="feedback feedback--error">{error}</p>
          <button type="button" className="btn btn--secondary" onClick={load}>
            <RefreshCw size={16} /> {t.common.retry}
          </button>
        </div>
      </div>
    );
  }

  if (!status) return <div className="login" aria-busy="true" />;

  if (!status.configured) {
    return <SetupPage hasLegacyData={status.hasLegacyData} onComplete={() => setStatus({ ...status, configured: true })} />;
  }

  return children;
}
