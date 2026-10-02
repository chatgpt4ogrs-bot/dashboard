import { useState, type FormEvent } from 'react';
import type { Condominium, CondominiumInput } from '../../../shared/condominium';
import { getErrorMessage } from '../../services/api';
import { Modal } from '../ui/Modal';

interface CondominiumFormModalProps {
  condominium: Condominium | null;
  onClose: () => void;
  onSubmit: (input: CondominiumInput) => Promise<void>;
}

export function CondominiumFormModal({ condominium, onClose, onSubmit }: CondominiumFormModalProps) {
  const [name, setName] = useState(condominium?.name ?? '');
  const [address, setAddress] = useState(condominium?.address ?? '');
  const [notes, setNotes] = useState(condominium?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError('Informe o nome do condomínio.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ name: name.trim(), address: address.trim() || undefined, notes: notes.trim() || undefined });
    } catch (err) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  };

  return (
    <Modal title={condominium ? 'Editar condomínio' : 'Novo condomínio'} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="modal__body">
          <label className="field">
            <span className="field__label">Nome *</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Residencial Jardins" autoFocus />
          </label>

          <label className="field">
            <span className="field__label">Endereço</span>
            <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Opcional" />
          </label>

          <label className="field">
            <span className="field__label">Observações</span>
            <textarea className="input input--textarea" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Opcional" />
          </label>

          {error && <p className="feedback feedback--error">{error}</p>}
        </div>

        <div className="modal__footer">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {condominium ? 'Salvar' : 'Adicionar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
