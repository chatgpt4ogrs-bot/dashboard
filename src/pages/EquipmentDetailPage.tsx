import { ArrowLeft, ExternalLink, Pencil, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DEVICE_BRANDS, type EquipmentInput } from '../../shared/condominium';
import type { EquipmentDetails } from '../../shared/equipment';
import { EquipmentFormModal } from '../components/condominium/EquipmentFormModal';
import { StatusBadge } from '../components/condominium/StatusBadge';
import { EventTimeline } from '../components/equipment/EventTimeline';
import { LatencyChart } from '../components/equipment/LatencyChart';
import { useI18n } from '../i18n';
import { equipmentApi, getErrorMessage } from '../services/api';
import { formatCheckTime, formatDuration, formatElapsed, formatPlainDate, formatUptime } from '../utils/time';

const AUTO_REFRESH_MS = 60_000;

function InfoRow({ label, value, hint }: { label: string; value?: ReactNode; hint?: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd className={value ? undefined : 'muted'}>
        {value || '—'}
        {value && hint && <span className="detail-hint"> {hint}</span>}
      </dd>
    </>
  );
}

export function EquipmentDetailPage() {
  const { t } = useI18n();
  const { id = '' } = useParams();
  const [details, setDetails] = useState<EquipmentDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    try {
      setDetails(await equipmentApi.details(id));
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    const timer = setInterval(load, AUTO_REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const handleCheck = async () => {
    setChecking(true);
    try {
      await equipmentApi.status(id);
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setChecking(false);
    }
  };

  const closeForm = useCallback(() => setEditing(false), []);

  const handleSubmit = async (input: EquipmentInput) => {
    await equipmentApi.update(id, input);
    setEditing(false);
    await load();
  };

  if (loading) {
    return (
      <div className="page">
        <p className="page__subtitle">{t.common.loading}</p>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="page">
        <Link to="/condominios" className="back-link">
          <ArrowLeft size={16} /> {t.nav.condominiums}
        </Link>
        <p className="feedback feedback--error">{error ?? t.equipmentDetail.notFound}</p>
      </div>
    );
  }

  /** Valor cadastrado ou, na falta dele, o lido do próprio equipamento. */
  const withDetected = (manual: string | undefined, detectedValue: string | undefined) => {
    if (manual) return { value: manual };
    if (detectedValue) return { value: detectedValue, hint: t.equipmentDetail.detected };
    return {};
  };

  const { equipment, condominium, monitor, stats24h } = details;
  const detected = monitor?.detected ?? undefined;
  const url = `${equipment.useHttps ? 'https' : 'http'}://${equipment.host}${equipment.port === (equipment.useHttps ? 443 : 80) ? '' : `:${equipment.port}`}`;
  const now = Date.now();
  const uptimeIsPartial = monitor?.onlineSince && monitor.onlineSince === monitor.trackedSince;

  return (
    <div className="page">
      <Link to={`/condominios/${condominium.id}`} className="back-link">
        <ArrowLeft size={16} /> {condominium.name}
      </Link>

      <header className="page__header">
        <div>
          <h1 className="page__title">{equipment.name}</h1>
          <p className="page__subtitle">
            {condominium.name}
            {equipment.type && ` · ${equipment.type}`}
          </p>
        </div>
        <div className="page__actions">
          <button type="button" className="btn btn--secondary" onClick={handleCheck} disabled={checking}>
            <RefreshCw size={16} className={checking ? 'spin' : undefined} /> {checking ? t.common.checking : t.common.checkNow}
          </button>
          <button type="button" className="btn btn--secondary" onClick={() => setEditing(true)}>
            <Pencil size={16} /> {t.common.edit}
          </button>
        </div>
      </header>

      {error && <p className="feedback feedback--error page__feedback">{error}</p>}

      <div className="detail-grid">
        <section className="detail-card">
          <h2 className="detail-card__title">{t.equipmentDetail.info}</h2>
          <dl className="detail-list">
            <InfoRow label={t.common.name} value={equipment.name} />
            <InfoRow label={t.common.condominium} value={<Link to={`/condominios/${condominium.id}`}>{condominium.name}</Link>} />
            <InfoRow label={t.equipmentDetail.type} value={equipment.type} />
            <InfoRow label={t.equipmentDetail.brand} value={DEVICE_BRANDS.find((b) => b.value === equipment.brand)?.label ?? equipment.brand} />
            <InfoRow label={t.equipmentForm.model} {...withDetected(equipment.model, detected?.model)} />
            <InfoRow
              label="IP/URL"
              value={
                <a href={url} target="_blank" rel="noreferrer" className="detail-link">
                  {url} <ExternalLink size={12} />
                </a>
              }
            />
            <InfoRow label={t.equipmentDetail.port} value={String(equipment.port)} />
            <InfoRow label="Firmware" {...withDetected(equipment.firmware, detected?.firmware)} />
            <InfoRow label="Serial" {...withDetected(equipment.serial, detected?.serial)} />
            <InfoRow label="MAC" value={equipment.mac} />
            <InfoRow label={t.equipmentForm.installedAt} value={equipment.installedAt && formatPlainDate(equipment.installedAt)} />
            <InfoRow
              label={t.equipmentForm.lastMaintenance}
              value={equipment.lastMaintenanceAt && formatPlainDate(equipment.lastMaintenanceAt)}
            />
            <InfoRow label={t.equipmentForm.responsible} value={equipment.responsible} />
            {equipment.notes && <InfoRow label={t.common.notes} value={equipment.notes} />}
          </dl>
        </section>

        <section className="detail-card">
          <h2 className="detail-card__title">{t.equipmentDetail.monitoring}</h2>
          {!monitor ? (
            <p className="muted">{t.equipmentDetail.waitingMonitor}</p>
          ) : (
            <>
              <div className="detail-status">
                <StatusBadge status={checking ? 'checking' : monitor.status} />
                {monitor.unstableReason && (
                  <span className="status status--unstable" title={t.serverMessage(monitor.unstableReason)}>
                    {t.status.unstable}
                  </span>
                )}
              </div>
              {monitor.status !== 'online' && monitor.message && <p className="detail-message">{t.serverMessage(monitor.message)}</p>}
              {monitor.unstableReason && (
                <p className="detail-message detail-message--warning">{t.serverMessage(monitor.unstableReason)}</p>
              )}

              <dl className="detail-list">
                <InfoRow label={t.common.latency} value={monitor.latencyMs !== null ? `${monitor.latencyMs} ms` : undefined} />
                <InfoRow label={t.equipmentDetail.lastCheck} value={formatCheckTime(monitor.checkedAt)} />
                {monitor.onlineSince ? (
                  <InfoRow
                    label="Uptime"
                    value={
                      uptimeIsPartial
                        ? t.equipmentDetail.uptimeAtLeast(formatUptime(now - Date.parse(monitor.onlineSince)))
                        : formatUptime(now - Date.parse(monitor.onlineSince))
                    }
                    hint={uptimeIsPartial ? t.equipmentDetail.sinceMonitoringStart : undefined}
                  />
                ) : (
                  <>
                    <InfoRow
                      label={t.equipmentDetail.offlineFor}
                      value={monitor.offlineSince ? formatDuration(now - Date.parse(monitor.offlineSince)) : undefined}
                    />
                    <InfoRow
                      label={t.common.lastSeen}
                      value={monitor.lastSeenAt ? `${formatCheckTime(monitor.lastSeenAt)} (${formatElapsed(monitor.lastSeenAt, now)})` : undefined}
                    />
                  </>
                )}
                <InfoRow
                  label={t.equipmentDetail.availability}
                  value={stats24h.availability !== null ? `${stats24h.availability}%` : undefined}
                />
                <InfoRow label={t.equipmentDetail.drops} value={String(stats24h.drops)} />
                <InfoRow label={t.equipmentDetail.reboots} value={String(stats24h.reboots)} />
              </dl>
            </>
          )}
        </section>
      </div>

      <section className="detail-card detail-card--chart">
        <div className="detail-card__header">
          <h2 className="detail-card__title">{t.equipmentDetail.latencyTitle}</h2>
          <div className="detail-stats">
            <span>
              {t.equipmentDetail.average} <strong>{stats24h.avgLatencyMs !== null ? `${stats24h.avgLatencyMs} ms` : '—'}</strong>
            </span>
            <span>
              {t.equipmentDetail.peak} <strong>{stats24h.maxLatencyMs !== null ? `${stats24h.maxLatencyMs} ms` : '—'}</strong>
            </span>
            <span>
              {t.equipmentDetail.failures} <strong>{stats24h.failures}</strong> {t.equipmentDetail.of} {stats24h.checks}
            </span>
          </div>
        </div>
        <LatencyChart buckets={details.history} bucketMs={details.bucketMs} thresholdMs={details.unstableLatencyMs} />
      </section>

      <section className="detail-card detail-card--chart">
        <h2 className="detail-card__title">{t.equipmentDetail.eventsTitle}</h2>
        <EventTimeline equipmentId={equipment.id} refreshKey={details} />
      </section>

      {editing && <EquipmentFormModal equipment={equipment} onClose={closeForm} onSubmit={handleSubmit} />}
    </div>
  );
}
