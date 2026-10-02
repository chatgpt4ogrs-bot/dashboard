import { ArrowLeft, Cpu, Pencil, Plus, Power, RefreshCw, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  DEVICE_BRANDS,
  type Condominium,
  type Equipment,
  type EquipmentInput,
  type StatusResult,
} from '../../shared/condominium';
import { EquipmentFormModal } from '../components/condominium/EquipmentFormModal';
import { StatusBadge, type DisplayStatus } from '../components/condominium/StatusBadge';
import { equipmentApi, condominiumApi, getErrorMessage } from '../services/api';

type FormState = { mode: 'create' } | { mode: 'edit'; equipment: Equipment } | null;
type Feedback = { type: 'success' | 'error'; message: string } | null;

interface EquipmentState {
  display: DisplayStatus;
  result?: StatusResult;
}

const brandLabel = (brand: Equipment['brand']) => DEVICE_BRANDS.find((b) => b.value === brand)?.label ?? brand;

export function CondominiumDetailPage() {
  const { id = '' } = useParams();
  const [condominium, setCondominium] = useState<Condominium | null>(null);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [states, setStates] = useState<Record<string, EquipmentState>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [form, setForm] = useState<FormState>(null);

  const setState = (equipmentId: string, state: EquipmentState) =>
    setStates((prev) => ({ ...prev, [equipmentId]: state }));

  const checkOne = useCallback(async (equipmentId: string) => {
    setStates((prev) => ({ ...prev, [equipmentId]: { ...prev[equipmentId], display: 'checking' } }));
    try {
      const result = await equipmentApi.status(equipmentId);
      setStates((prev) => ({ ...prev, [equipmentId]: { display: result.status, result } }));
    } catch (err) {
      setStates((prev) => ({
        ...prev,
        [equipmentId]: { display: 'error', result: { status: 'error', message: getErrorMessage(err), checkedAt: new Date().toISOString() } },
      }));
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const [condo, list] = await Promise.all([condominiumApi.get(id), equipmentApi.list(id)]);
      setCondominium(condo);
      setEquipments(list);
      setError(null);
      return list;
    } catch (err) {
      setError(getErrorMessage(err));
      return [];
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    load().then((list) => {
      if (!cancelled) list.forEach((e) => checkOne(e.id));
    });
    return () => {
      cancelled = true;
    };
  }, [load, checkOne]);

  const closeForm = useCallback(() => setForm(null), []);

  const handleSubmit = async (input: EquipmentInput) => {
    const saved =
      form?.mode === 'edit' ? await equipmentApi.update(form.equipment.id, input) : await equipmentApi.create(id, input);
    setForm(null);
    await load();
    checkOne(saved.id);
  };

  const handleDelete = async (equipment: Equipment) => {
    if (!window.confirm(`Excluir o equipamento "${equipment.name}"?`)) return;
    try {
      await equipmentApi.remove(equipment.id);
      await load();
    } catch (err) {
      setFeedback({ type: 'error', message: getErrorMessage(err) });
    }
  };

  const handleReboot = async (equipment: Equipment) => {
    if (!window.confirm(`Reiniciar "${equipment.name}" remotamente?\n\nO equipamento ficará indisponível durante o reinício.`)) return;
    setState(equipment.id, { ...states[equipment.id], display: 'checking' });
    try {
      const result = await equipmentApi.reboot(equipment.id);
      setFeedback({ type: result.ok ? 'success' : 'error', message: `${equipment.name}: ${result.message}` });
      if (result.ok) setState(equipment.id, { display: 'rebooting' });
      else checkOne(equipment.id);
    } catch (err) {
      setFeedback({ type: 'error', message: getErrorMessage(err) });
      checkOne(equipment.id);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <p className="page__subtitle">Carregando...</p>
      </div>
    );
  }

  if (!condominium) {
    return (
      <div className="page">
        <Link to="/condominios" className="back-link">
          <ArrowLeft size={16} /> Condomínios
        </Link>
        <p className="feedback feedback--error">{error ?? 'Condomínio não encontrado.'}</p>
      </div>
    );
  }

  const onlineCount = equipments.filter((e) => states[e.id]?.display === 'online').length;

  return (
    <div className="page">
      <Link to="/condominios" className="back-link">
        <ArrowLeft size={16} /> Condomínios
      </Link>

      <header className="page__header">
        <div>
          <h1 className="page__title">{condominium.name}</h1>
          <p className="page__subtitle">
            {condominium.address ? `${condominium.address} · ` : ''}
            {equipments.length === 0 ? 'Nenhum equipamento' : `${onlineCount} de ${equipments.length} online`}
          </p>
        </div>
        <div className="page__actions">
          {equipments.length > 0 && (
            <button type="button" className="btn btn--secondary" onClick={() => equipments.forEach((e) => checkOne(e.id))}>
              <RefreshCw size={16} /> Verificar todos
            </button>
          )}
          <button type="button" className="btn btn--primary" onClick={() => setForm({ mode: 'create' })}>
            <Plus size={16} /> Novo equipamento
          </button>
        </div>
      </header>

      {(feedback || error) && (
        <p className={`feedback feedback--${feedback?.type ?? 'error'} page__feedback`} role="status">
          {feedback?.message ?? error}
        </p>
      )}

      {equipments.length === 0 ? (
        <div className="empty">
          <div className="empty__icon">
            <Cpu size={28} />
          </div>
          <h2 className="empty__title">Nenhum equipamento</h2>
          <p className="empty__text">Cadastre controladores, leitores, DVRs e câmeras deste condomínio.</p>
          <button type="button" className="btn btn--primary" onClick={() => setForm({ mode: 'create' })}>
            <Plus size={16} /> Adicionar equipamento
          </button>
        </div>
      ) : (
        <div className="equipment-list">
          {equipments.map((equipment) => {
            const state = states[equipment.id] ?? { display: 'unknown' };
            const info = state.result?.info;
            const busy = state.display === 'checking';
            const details = [
              state.result?.latencyMs !== undefined && state.display === 'online' ? `${state.result.latencyMs} ms` : null,
              info?.model,
              info?.firmware && `FW ${info.firmware}`,
            ].filter(Boolean);

            return (
              <article key={equipment.id} className="equipment">
                <div className="equipment__main">
                  <div className="equipment__title">
                    <h3 className="equipment__name">{equipment.name}</h3>
                    <StatusBadge status={state.display} title={state.result?.message} />
                  </div>
                  <p className="equipment__meta">
                    {brandLabel(equipment.brand)}
                    {equipment.type && ` · ${equipment.type}`} · {equipment.useHttps ? 'https' : 'http'}://{equipment.host}:{equipment.port}
                  </p>
                  {state.display !== 'online' && state.display !== 'checking' && state.result && (
                    <p className="equipment__message">{state.result.message}</p>
                  )}
                  {details.length > 0 && <p className="equipment__details">{details.join(' · ')}</p>}
                </div>

                <div className="equipment__actions">
                  <button type="button" className="btn btn--secondary btn--sm" onClick={() => checkOne(equipment.id)} disabled={busy}>
                    <RefreshCw size={14} className={busy ? 'spin' : undefined} /> Verificar
                  </button>
                  <button type="button" className="btn btn--secondary btn--sm" onClick={() => handleReboot(equipment)} disabled={busy}>
                    <Power size={14} /> Reiniciar
                  </button>
                  <button
                    type="button"
                    className="icon-btn icon-btn--sm"
                    onClick={() => setForm({ mode: 'edit', equipment })}
                    title="Editar"
                    aria-label="Editar"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn icon-btn--sm icon-btn--danger"
                    onClick={() => handleDelete(equipment)}
                    title="Excluir"
                    aria-label="Excluir"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {form && (
        <EquipmentFormModal
          key={form.mode === 'edit' ? form.equipment.id : 'new'}
          equipment={form.mode === 'edit' ? form.equipment : null}
          onClose={closeForm}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
