import { RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, sessionError, retry } = useAuth();
  const location = useLocation();
  const { t } = useI18n();

  if (sessionError) {
    return (
      <div className="login">
        <div className="login__card">
          <p className="feedback feedback--error">{sessionError}</p>
          <button type="button" className="btn btn--secondary" onClick={retry}>
            <RefreshCw size={16} /> {t.common.retry}
          </button>
        </div>
      </div>
    );
  }

  if (user === undefined) return <div className="login" aria-busy="true" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return children;
}
