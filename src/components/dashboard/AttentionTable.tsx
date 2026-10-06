import { CircleCheck, Stethoscope } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AttentionItem } from '../../../shared/dashboard';
import { useI18n } from '../../i18n';
import { formatElapsed } from '../../utils/time';
import { StatusBadge } from '../condominium/StatusBadge';

interface AttentionTableProps {
  items: AttentionItem[];
  now: string;
  onDiagnose: (item: AttentionItem) => void;
}

export function AttentionTable({ items, now, onDiagnose }: AttentionTableProps) {
  const { t } = useI18n();

  if (items.length === 0) {
    return (
      <div className="attention-empty">
        <CircleCheck size={18} /> {t.attention.allGood}
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>{t.common.condominium}</th>
            <th>{t.common.equipment}</th>
            <th>{t.common.status}</th>
            <th>{t.common.latency}</th>
            <th>{t.common.lastSeen}</th>
            <th className="table__action">{t.attention.action}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.equipmentId}>
              <td>{item.condominiumName}</td>
              <td className="table__strong">
                <Link to={`/equipamentos/${item.equipmentId}`} className="table__link">
                  {item.equipmentName}
                </Link>
              </td>
              <td>
                <span className="table__status">
                  <StatusBadge status={item.status} title={item.message} />
                  {item.unstableReason && (
                    <span className="status status--unstable" title={t.serverMessage(item.unstableReason)}>
                      {t.status.unstable}
                    </span>
                  )}
                </span>
              </td>
              <td>{item.latencyMs !== null ? `${item.latencyMs} ms` : '—'}</td>
              <td>{item.lastSeenAt ? formatElapsed(item.lastSeenAt, now) : t.common.noRecord}</td>
              <td className="table__action">
                {item.status === 'online' ? (
                  <Link to={`/equipamentos/${item.equipmentId}`} className="btn btn--secondary btn--sm">
                    {t.attention.view}
                  </Link>
                ) : (
                  <button type="button" className="btn btn--secondary btn--sm" onClick={() => onDiagnose(item)}>
                    <Stethoscope size={14} /> {t.attention.diagnose}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
