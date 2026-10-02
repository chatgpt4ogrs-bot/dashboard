import { Building2, MapPin, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CondominiumInput, CondominiumSummary } from '../../shared/condominium';
import { CondominiumFormModal } from '../components/condominium/CondominiumFormModal';
import { condominiumApi, getErrorMessage } from '../services/api';
import { normalizeText } from '../utils/text';

type FormState = { mode: 'create' } | { mode: 'edit'; condominium: CondominiumSummary } | null;

export function CondominiumsPage() {
  const [condominiums, setCondominiums] = useState<CondominiumSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState<FormState>(null);

  const load = useCallback(async () => {
    try {
      setCondominiums(await condominiumApi.list());
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = normalizeText(query);
    if (!q) return condominiums;
    return condominiums.filter((c) => [c.name, c.address].some((f) => f && normalizeText(f).includes(q)));
  }, [condominiums, query]);

  const closeForm = useCallback(() => setForm(null), []);

  const handleSubmit = async (input: CondominiumInput) => {
    if (form?.mode === 'edit') await condominiumApi.update(form.condominium.id, input);
    else await condominiumApi.create(input);
    setForm(null);
    await load();
  };

  const handleDelete = async (condominium: CondominiumSummary) => {
    const message =
      condominium.equipmentCount > 0
        ? `Excluir "${condominium.name}" e seus ${condominium.equipmentCount} equipamento(s)?`
        : `Excluir "${condominium.name}"?`;
    if (!window.confirm(message)) return;
    try {
      await condominiumApi.remove(condominium.id);
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div className="page">
      <header className="page__header">
        <div>
          <h1 className="page__title">Condomínios</h1>
          <p className="page__subtitle">
            {condominiums.length === 0
              ? 'Cadastre os condomínios e seus equipamentos.'
              : `${condominiums.length} ${condominiums.length === 1 ? 'condomínio cadastrado' : 'condomínios cadastrados'}`}
          </p>
        </div>
        <button type="button" className="btn btn--primary" onClick={() => setForm({ mode: 'create' })}>
          <Plus size={16} /> Novo condomínio
        </button>
      </header>

      {error && <p className="feedback feedback--error page__feedback">{error}</p>}

      {condominiums.length > 0 && (
        <div className="toolbar">
          <div className="search">
            <Search size={16} className="search__icon" />
            <input
              className="input search__input"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar condomínios..."
              aria-label="Buscar condomínios"
            />
          </div>
        </div>
      )}

      {loading ? (
        <p className="page__subtitle">Carregando...</p>
      ) : condominiums.length === 0 ? (
        !error && (
          <div className="empty">
            <div className="empty__icon">
              <Building2 size={28} />
            </div>
            <h2 className="empty__title">Nenhum condomínio ainda</h2>
            <p className="empty__text">Adicione um condomínio para cadastrar e monitorar seus equipamentos.</p>
            <button type="button" className="btn btn--primary" onClick={() => setForm({ mode: 'create' })}>
              <Plus size={16} /> Adicionar condomínio
            </button>
          </div>
        )
      ) : filtered.length === 0 ? (
        <div className="empty">
          <h2 className="empty__title">Nenhum resultado</h2>
          <p className="empty__text">Nenhum condomínio corresponde à busca.</p>
        </div>
      ) : (
        <div className="grid">
          {filtered.map((condominium) => (
            <article key={condominium.id} className="access-card">
              <Link className="access-card__link" to={`/condominios/${condominium.id}`} aria-label={`Abrir ${condominium.name}`} />
              <div className="access-card__top">
                <div className="site-icon">
                  <Building2 size={20} />
                </div>
                <div className="access-card__actions">
                  <button
                    type="button"
                    className="icon-btn icon-btn--sm"
                    onClick={() => setForm({ mode: 'edit', condominium })}
                    title="Editar"
                    aria-label="Editar"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn icon-btn--sm icon-btn--danger"
                    onClick={() => handleDelete(condominium)}
                    title="Excluir"
                    aria-label="Excluir"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <div className="access-card__body">
                <h3 className="access-card__name">{condominium.name}</h3>
                {condominium.address && (
                  <span className="access-card__host">
                    <MapPin size={12} /> {condominium.address}
                  </span>
                )}
              </div>
              <span className="tag">
                {condominium.equipmentCount} {condominium.equipmentCount === 1 ? 'equipamento' : 'equipamentos'}
              </span>
            </article>
          ))}
        </div>
      )}

      {form && (
        <CondominiumFormModal
          key={form.mode === 'edit' ? form.condominium.id : 'new'}
          condominium={form.mode === 'edit' ? form.condominium : null}
          onClose={closeForm}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
