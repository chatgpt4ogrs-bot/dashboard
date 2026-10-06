import {
  Building2,
  Radio,
  RefreshCw,
  RotateCcw,
  Timer,
  TriangleAlert,
  Wifi,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { AttentionItem, DashboardSummary } from '../../shared/dashboard';
import { AttentionTable } from '../components/dashboard/AttentionTable';
import { DiagnosticModal } from '../components/dashboard/DiagnosticModal';
import { useI18n } from '../i18n';
import type { Messages } from '../i18n/pt';
import { dashboardApi, getErrorMessage } from '../services/api';
import { formatDuration } from '../utils/time';

const AUTO_REFRESH_MS = 30_000;

type Tone = 'success' | 'danger' | 'warning' | 'neutral';

function formatLastCycle(summary: DashboardSummary, t: Messages): string {
  const every = t.dashboard.every(Math.round(summary.monitor.intervalMs / 1000));
  if (summary.monitor.running && !summary.monitor.lastCycleAt) return `${t.dashboard.firstCycleRunning} · ${every}`;
  if (!summary.monitor.lastCycleAt) return `${t.dashboard.waitingFirstCycle} · ${every}`;
  const ago = Date.parse(summary.generatedAt) - Date.parse(summary.monitor.lastCycleAt);
  return `${t.dashboard.lastCycle(formatDuration(ago))} · ${every}`;
}

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  title?: string;
}

function MetricCard({ icon: Icon, label, value, hint, tone = 'neutral', title }: MetricCardProps) {
  return (
    <article className={`metric metric--${tone}`} title={title}>
      <div className="metric__top">
        <span className="metric__label">{label}</span>
        <span className="metric__icon">
          <Icon size={18} />
        </span>
      </div>
      <p className="metric__value">{value}</p>
      {hint && <p className="metric__hint">{hint}</p>}
    </article>
  );
}

export function DashboardPage() {
  const { t } = useI18n();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [diagnosing, setDiagnosing] = useState<AttentionItem | null>(null);

  const load = useCallback(async (fetcher: () => Promise<DashboardSummary>) => {
    try {
      setSummary(await fetcher());
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    load(dashboardApi.summary);
    const timer = setInterval(() => load(dashboardApi.summary), AUTO_REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load(dashboardApi.refresh);
    setRefreshing(false);
  };

  const closeDiagnostic = useCallback(() => setDiagnosing(null), []);
  const reloadSummary = useCallback(() => load(dashboardApi.summary), [load]);

  const longest = summary?.longestOffline;

  return (
    <div className="page">
      <header className="page__header">
        <div>
          <h1 className="page__title">{t.dashboard.title}</h1>
          <p className="page__subtitle">{summary ? formatLastCycle(summary, t) : t.common.loading}</p>
        </div>
        <button type="button" className="btn btn--secondary" onClick={handleRefresh} disabled={refreshing || !summary}>
          <RefreshCw size={16} className={refreshing ? 'spin' : undefined} /> {refreshing ? t.common.checking : t.common.checkNow}
        </button>
      </header>

      {error && <p className="feedback feedback--error page__feedback">{error}</p>}

      {summary && summary.pendingEquipments > 0 && (
        <p className="feedback feedback--info page__feedback">{t.dashboard.pending(summary.pendingEquipments)}</p>
      )}

      {summary && (
        <>
          <div className="metrics">
            <MetricCard
              icon={Wifi}
              tone="success"
              label={t.dashboard.online}
              value={summary.online}
              hint={t.dashboard.ofTotal(summary.totalEquipments)}
            />
            <MetricCard
              icon={WifiOff}
              tone="danger"
              label={t.dashboard.offline}
              value={summary.offline}
              hint={t.dashboard.offlineHint}
            />
            <MetricCard
              icon={TriangleAlert}
              tone="warning"
              label={t.dashboard.unstable}
              value={summary.unstable}
              hint={t.dashboard.unstableHint}
              title={t.dashboard.unstableTitle}
            />
            <MetricCard
              icon={Building2}
              label={t.dashboard.totalCondominiums}
              value={summary.totalCondominiums}
              hint={
                <Link to="/condominios" className="metric__link">
                  {t.dashboard.viewCondominiums}
                </Link>
              }
            />
            <MetricCard
              icon={RotateCcw}
              label={t.dashboard.reboots}
              value={summary.rebootsLast24h}
              hint={t.dashboard.rebootsHint}
            />
            <MetricCard
              icon={Timer}
              tone={longest ? 'danger' : 'neutral'}
              label={t.dashboard.longestOffline}
              value={longest ? formatDuration(longest.durationMs) : '—'}
              hint={
                longest ? (
                  <Link to={`/condominios/${longest.condominiumId}`} className="metric__link">
                    {longest.equipmentName} · {longest.condominiumName}
                  </Link>
                ) : (
                  t.dashboard.noneOffline
                )
              }
            />
            <MetricCard
              icon={Radio}
              label={t.dashboard.averageLatency}
              value={summary.averageLatencyMs !== null ? `${summary.averageLatencyMs} ms` : '—'}
              hint={t.dashboard.averageLatencyHint}
            />
          </div>

          {summary.totalEquipments > 0 && (
            <section className="dashboard-section">
              <h2 className="dashboard-section__title">{t.dashboard.attentionTitle}</h2>
              <AttentionTable items={summary.attention} now={summary.generatedAt} onDiagnose={setDiagnosing} />
            </section>
          )}

          {summary.totalEquipments === 0 && (
            <div className="empty">
              <h2 className="empty__title">{t.dashboard.emptyTitle}</h2>
              <p className="empty__text">{t.dashboard.emptyText}</p>
              <Link to="/condominios" className="btn btn--primary">
                {t.dashboard.goToCondominiums}
              </Link>
            </div>
          )}
        </>
      )}

      {diagnosing && summary && (
        <DiagnosticModal
          key={diagnosing.equipmentId}
          item={diagnosing}
          now={summary.generatedAt}
          onClose={closeDiagnostic}
          onRetested={reloadSummary}
        />
      )}
    </div>
  );
}
