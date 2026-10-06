import { useState, type FormEvent } from 'react';
import type { Condominium, CondominiumInput } from '../../../shared/condominium';
import { useI18n } from '../../i18n';
import { getErrorMessage } from '../../services/api';
import { Modal } from '../ui/Modal';

interface CondominiumFormModalProps {
  condominium: Condominium | null;
  onClose: () => void;
  onSubmit: (input: CondominiumInput) => Promise<void>;
}

export function CondominiumFormModal({ condominium, onClose, onSubmit }: CondominiumFormModalProps) {
  const { t } = useI18n();
  const [name, setName] = useState(condominium?.name ?? '');
  const [address, setAddress] = useState(condominium?.address ?? '');
  const [notes, setNotes] = useState(condominium?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError(t.condominiumForm.nameRequired);
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
    <Modal title={condominium ? t.condominiumForm.editTitle : t.condominiumForm.newTitle} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="modal__body">
          <label className="field">
            <span className="field__label">{t.common.nameRequired}</span>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.condominiumForm.namePlaceholder}
              autoFocus
            />
          </label>

          <label className="field">
            <span className="field__label">{t.common.address}</span>
            <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t.common.optional} />
          </label>

          <label className="field">
            <span className="field__label">{t.common.notes}</span>
            <textarea
              className="input input--textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder={t.common.optional}
            />
          </label>

          {error && <p className="feedback feedback--error">{error}</p>}
        </div>

        <div className="modal__footer">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            {t.common.cancel}
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {condominium ? t.common.save : t.common.add}
          </button>
        </div>
      </form>
    </Modal>
  );
}
