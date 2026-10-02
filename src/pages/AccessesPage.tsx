import { LayoutGrid, Plus, Search } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { AccessCard } from '../components/access/AccessCard';
import { AccessFormModal } from '../components/access/AccessFormModal';
import { useAccesses } from '../context/AccessesContext';
import { useSettings } from '../context/SettingsContext';
import type { Access, AccessInput } from '../types';
import { normalizeText } from '../utils/text';

type FormState = { mode: 'create' } | { mode: 'edit'; access: Access } | null;

export function AccessesPage() {
  const { accesses, addAccess, updateAccess, removeAccess, toggleFavorite } = useAccesses();
  const { settings } = useSettings();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(null);

  const categories = useMemo(
    () =>
      [...new Set(accesses.map((a) => a.category?.trim()).filter((c): c is string => Boolean(c)))].sort((a, b) =>
        a.localeCompare(b, 'pt-BR'),
      ),
    [accesses],
  );

  const activeCategory = category && categories.includes(category) ? category : null;

  const filtered = useMemo(() => {
    const q = normalizeText(query);
    return accesses
      .filter((a) => !activeCategory || a.category === activeCategory)
      .filter((a) => !q || [a.name, a.url, a.description, a.category].some((f) => f && normalizeText(f).includes(q)))
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name, 'pt-BR'));
  }, [accesses, query, activeCategory]);

  const closeForm = useCallback(() => setForm(null), []);

  const handleSubmit = (input: AccessInput) => {
    if (form?.mode === 'edit') updateAccess(form.access.id, input);
    else addAccess(input);
    setForm(null);
  };

  const handleDelete = (access: Access) => {
    if (window.confirm(`Excluir "${access.name}"?`)) removeAccess(access.id);
  };

  return (
    <div className="page">
      <header className="page__header">
        <div>
          <h1 className="page__title">Acessos</h1>
          <p className="page__subtitle">
            {accesses.length === 0
              ? 'Centralize aqui os sistemas que você usa no dia a dia.'
              : `${accesses.length} ${accesses.length === 1 ? 'acesso cadastrado' : 'acessos cadastrados'}`}
          </p>
        </div>
        <button type="button" className="btn btn--primary" onClick={() => setForm({ mode: 'create' })}>
          <Plus size={16} /> Novo acesso
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
              placeholder="Buscar acessos..."
              aria-label="Buscar acessos"
            />
          </div>

          {categories.length > 0 && (
            <div className="chips" role="tablist" aria-label="Filtrar por categoria">
              <button
                type="button"
                className={`chip${activeCategory === null ? ' chip--active' : ''}`}
                onClick={() => setCategory(null)}
              >
                Todas
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
          <h2 className="empty__title">Nenhum acesso ainda</h2>
          <p className="empty__text">Adicione o primeiro sistema ou plataforma para acessá-lo com um clique.</p>
          <button type="button" className="btn btn--primary" onClick={() => setForm({ mode: 'create' })}>
            <Plus size={16} /> Adicionar acesso
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty">
          <h2 className="empty__title">Nenhum resultado</h2>
          <p className="empty__text">Nenhum acesso corresponde aos filtros atuais.</p>
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
