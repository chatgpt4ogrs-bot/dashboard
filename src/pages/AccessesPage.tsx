import { LayoutGrid, Plus, Search } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { AccessCard } from '../components/access/AccessCard';
import { AccessFormModal } from '../components/access/AccessFormModal';
import { useAccesses } from '../context/AccessesContext';
import { useConfirm } from '../context/ConfirmContext';
import { useSettings } from '../context/SettingsContext';
import { useI18n } from '../i18n';
import type { Access, AccessInput } from '../types';
import { normalizeText } from '../utils/text';

type FormState = { mode: 'create' } | { mode: 'edit'; access: Access } | null;

export function AccessesPage() {
  const { accesses, addAccess, updateAccess, removeAccess, toggleFavorite } = useAccesses();
  const { settings } = useSettings();
  const { t, locale } = useI18n();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(null);
  const confirm = useConfirm();

  const categories = useMemo(
    () =>
      [...new Set(accesses.map((a) => a.category?.trim()).filter((c): c is string => Boolean(c)))].sort((a, b) =>
        a.localeCompare(b, locale),
      ),
    [accesses, locale],
  );

  const activeCategory = category && categories.includes(category) ? category : null;

  const filtered = useMemo(() => {
    const q = normalizeText(query);
    return accesses
      .filter((a) => !activeCategory || a.category === activeCategory)
      .filter((a) => !q || [a.name, a.url, a.description, a.category].some((f) => f && normalizeText(f).includes(q)))
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name, locale));
  }, [accesses, query, activeCategory, locale]);

  const closeForm = useCallback(() => setForm(null), []);

  const handleSubmit = (input: AccessInput) => {
    if (form?.mode === 'edit') updateAccess(form.access.id, input);
    else addAccess(input);
    setForm(null);
  };

  const handleDelete = async (access: Access) => {
    const confirmed = await confirm({
      title: t.accesses.deleteTitle,
      message: (
        <>
          {t.accesses.deleteMessage} <strong>{access.name}</strong>? {t.common.irreversible}
        </>
      ),
    });
    if (confirmed) removeAccess(access.id);
  };

  return (
    <div className="page">
      <header className="page__header">
        <div>
          <h1 className="page__title">{t.accesses.title}</h1>
          <p className="page__subtitle">
            {accesses.length === 0 ? t.accesses.emptySubtitle : t.accesses.countSubtitle(accesses.length)}
          </p>
        </div>
        <button type="button" className="btn btn--primary" onClick={() => setForm({ mode: 'create' })}>
          <Plus size={16} /> {t.accesses.new}
        </button>
      </header>

      {accesses.length > 0 && (
        <div className="toolbar">
          <div className="search">
            <Search size={16} className="search__icon" />
            <input
              className="input search__input"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.accesses.search}
              aria-label={t.accesses.searchLabel}
            />
          </div>

          {categories.length > 0 && (
            <div className="chips" role="tablist" aria-label={t.accesses.filterByCategory}>
              <button
                type="button"
                className={`chip${activeCategory === null ? ' chip--active' : ''}`}
                onClick={() => setCategory(null)}
              >
                {t.accesses.allCategories}
              </button>
              {categories.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`chip${activeCategory === item ? ' chip--active' : ''}`}
                  onClick={() => setCategory(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {accesses.length === 0 ? (
        <div className="empty">
          <div className="empty__icon">
            <LayoutGrid size={28} />
          </div>
          <h2 className="empty__title">{t.accesses.emptyTitle}</h2>
          <p className="empty__text">{t.accesses.emptyText}</p>
          <button type="button" className="btn btn--primary" onClick={() => setForm({ mode: 'create' })}>
            <Plus size={16} /> {t.accesses.addFirst}
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty">
          <h2 className="empty__title">{t.common.noResults}</h2>
          <p className="empty__text">{t.accesses.noMatch}</p>
        </div>
      ) : (
        <div className="grid">
          {filtered.map((access) => (
            <AccessCard
              key={access.id}
              access={access}
              openInNewTab={settings.openInNewTab}
              onEdit={(a) => setForm({ mode: 'edit', access: a })}
              onDelete={handleDelete}
              onToggleFavorite={toggleFavorite}
            />
          ))}
        </div>
      )}

      {form && (
        <AccessFormModal
          key={form.mode === 'edit' ? form.access.id : 'new'}
          access={form.mode === 'edit' ? form.access : null}
          categories={categories}
          onClose={closeForm}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
