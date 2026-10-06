import { Pencil, Star, Trash2 } from 'lucide-react';
import { useI18n } from '../../i18n';
import type { Access } from '../../types';
import { getHostname } from '../../utils/url';
import { SiteIcon } from './SiteIcon';

interface AccessCardProps {
  access: Access;
  openInNewTab: boolean;
  onEdit: (access: Access) => void;
  onDelete: (access: Access) => void;
  onToggleFavorite: (id: string) => void;
}

export function AccessCard({ access, openInNewTab, onEdit, onDelete, onToggleFavorite }: AccessCardProps) {
  const { t } = useI18n();
  const favoriteLabel = access.favorite ? t.accesses.unfavorite : t.accesses.favorite;
  return (
    <article className="access-card">
      <a
        className="access-card__link"
        href={access.url}
        target={openInNewTab ? '_blank' : undefined}
        rel={openInNewTab ? 'noopener noreferrer' : undefined}
        aria-label={t.common.open(access.name)}
      />

      <div className="access-card__top">
        <SiteIcon key={access.url} url={access.url} name={access.name} image={access.image} />
        <div className="access-card__actions">
          <button
            type="button"
            className={`icon-btn icon-btn--sm${access.favorite ? ' icon-btn--favorite' : ''}`}
            onClick={() => onToggleFavorite(access.id)}
            title={favoriteLabel}
            aria-label={favoriteLabel}
          >
            <Star size={15} fill={access.favorite ? 'currentColor' : 'none'} />
          </button>
          <button
            type="button"
            className="icon-btn icon-btn--sm"
            onClick={() => onEdit(access)}
            title={t.common.edit}
            aria-label={t.common.edit}
          >
            <Pencil size={15} />
          </button>
          <button
            type="button"
            className="icon-btn icon-btn--sm icon-btn--danger"
            onClick={() => onDelete(access)}
            title={t.common.delete}
            aria-label={t.common.delete}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <div className="access-card__body">
        <h3 className="access-card__name">{access.name}</h3>
        <span className="access-card__host">{getHostname(access.url)}</span>
        {access.description && <p className="access-card__description">{access.description}</p>}
      </div>

      {access.category && <span className="tag">{access.category}</span>}
    </article>
  );
}
