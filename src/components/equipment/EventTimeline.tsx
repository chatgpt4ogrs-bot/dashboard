import {
  Activity,
  CircleCheck,
  CircleX,
  Gauge,
  KeyRound,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { DeviceStatus } from '../../../shared/condominium';
import { EVENT_CATEGORY, type EquipmentEvent, type EventCategory } from '../../../shared/events';
import { useI18n } from '../../i18n';
import type { Messages } from '../../i18n/pt';
import { equipmentApi, getErrorMessage } from '../../services/api';
import { formatDuration } from '../../utils/time';

type Tone = 'success' | 'danger' | 'warning' | 'info' | 'neutral';

interface EventView {
  icon: LucideIcon;
  tone: Tone;
  title: string;
  detail?: string;
}

const problemIcon = (status?: DeviceStatus) => (status === 'auth_error' ? KeyRound : CircleX);
const problemTone = (status?: DeviceStatus): Tone => (status === 'auth_error' ? 'warning' : 'danger');

function describe(event: EquipmentEvent, t: Messages): EventView {
  const tl = t.timeline;
  const latency = event.latencyMs !== undefined ? `${event.latencyMs} ms` : undefined;
  const detail = event.detail && t.serverMessage(event.detail);
  switch (event.type) {
    case 'monitoring_started':
      return event.status === 'online'
        ? { icon: Activity, tone: 'success', title: tl.monitoringStartedOnline, detail: latency }
        : { icon: Activity, tone: problemTone(event.status), title: tl.monitoringStarted(tl.statusText[event.status ?? 'offline']), detail };
    case 'online':
      return {
        icon: CircleCheck,
        tone: 'success',
        title: tl.backOnline,
        detail: [event.durationMs !== undefined && tl.wasOfflineFor(formatDuration(event.durationMs)), latency].filter(Boolean).join(' · '),
      };
    case 'offline': {
      const status = event.status === 'online' || !event.status ? 'offline' : event.status;
      return { icon: problemIcon(status), tone: problemTone(status), title: tl.problems[status], detail };
    }
    case 'latency_high':
      return { icon: TriangleAlert, tone: 'warning', title: tl.latencyHigh(latency ?? '—') };
    case 'latency_normal':
      return { icon: Gauge, tone: 'success', title: tl.latencyNormal(latency ?? '—') };
    case 'check':
      return event.status === 'online'
        ? { icon: Search, tone: 'success', title: tl.checked, detail: `Online${latency ? ` · ${latency}` : ''}` }
        : {
            icon: Search,
            tone: problemTone(event.status),
            title: tl.checked,
            detail: [tl.statusText[event.status ?? 'offline'].replace(/^./, (c) => c.toUpperCase()), detail].filter(Boolean).join(' · '),
          };
    case 'reboot':
      return { icon: RotateCcw, tone: 'info', title: tl.rebooted, detail };
    case 'reboot_failed':
      return { icon: RotateCcw, tone: 'danger', title: tl.rebootFailed, detail };
    case 'created':
      return { icon: Plus, tone: 'neutral', title: tl.created, detail };
    case 'updated':
      return {
        icon: Pencil,
        tone: 'neutral',
        title: tl.updated,
        detail: event.detail && tl.fields(event.detail.split(', ').map(t.serverMessage).join(', ')),
      };
    case 'deleted':
      return { icon: Trash2, tone: 'danger', title: tl.deleted, detail };
  }
}

function formatWhen(iso: string, locale: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' }),
    time: d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
  };
}

interface EventTimelineProps {
  equipmentId: string;
  /** Mude o valor para recarregar a primeira página (ex.: após verificar ou editar). */
  refreshKey: unknown;
}

export function EventTimeline({ equipmentId, refreshKey }: EventTimelineProps) {
  const { t, locale } = useI18n();
  const filters: { value: EventCategory | 'all'; label: string }[] = [
    { value: 'all', label: t.timeline.filterAll },
    { value: 'status', label: t.timeline.filterStatus },
    { value: 'action', label: t.timeline.filterActions },
  ];
  const [events, setEvents] = useState<EquipmentEvent[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<EventCategory | 'all'>('all');

  const loadFirstPage = useCallback(async () => {
    try {
      const page = await equipmentApi.events(equipmentId);
      setEvents((prev) => {
        if (prev.length === 0) {
          setHasMore(page.hasMore);
          return page.events;
        }
        const known = new Set(prev.map((e) => e.id));
        const fresh = page.events.filter((e) => !known.has(e.id));
        return fresh.length ? [...fresh, ...prev] : prev;
      });
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [equipmentId]);

  useEffect(() => {
    loadFirstPage();
  }, [loadFirstPage, refreshKey]);

  const loadMore = async () => {
    const last = events.at(-1);
    if (!last) return;
    setLoadingMore(true);
    try {
      const page = await equipmentApi.events(equipmentId, last.id);
      setEvents((prev) => [...prev, ...page.events]);
      setHasMore(page.hasMore);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  };

  const visible = filter === 'all' ? events : events.filter((e) => EVENT_CATEGORY[e.type] === filter);

  return (
    <div className="timeline">
      <div className="timeline__filters" role="radiogroup" aria-label={t.timeline.filterLabel}>
        {filters.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={filter === value}
            className={`chip${filter === value ? ' chip--active' : ''}`}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="feedback feedback--error">{error}</p>}

      {loading ? (
        <p className="timeline__empty">{t.common.loading}</p>
      ) : visible.length === 0 ? (
        <p className="timeline__empty">{events.length === 0 ? t.timeline.empty : t.timeline.emptyFiltered}</p>
      ) : (
        <ol className="timeline__list">
          {visible.map((event) => {
            const view = describe(event, t);
            const when = formatWhen(event.at, locale);
            const Icon = view.icon;
            return (
              <li key={event.id} className="timeline__item">
                <time className="timeline__when" dateTime={event.at} title={new Date(event.at).toLocaleString(locale)}>
                  <span>{when.date}</span>
                  <span className="timeline__time">{when.time}</span>
                </time>
                <span className={`timeline__icon timeline__icon--${view.tone}`}>
                  <Icon size={14} />
                </span>
                <div className="timeline__body">
                  <p className="timeline__title">{view.title}</p>
                  {view.detail && <p className="timeline__detail">{view.detail}</p>}
                  <p className="timeline__actor">
                    {event.actor
                      ? t.timeline.by(event.actor.name ? `${event.actor.name} (${event.actor.email})` : event.actor.email)
                      : t.timeline.automatic}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {hasMore && !loading && (
        <button type="button" className="btn btn--secondary btn--sm timeline__more" onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? t.common.loading : t.timeline.loadMore}
        </button>
      )}
    </div>
  );
}
