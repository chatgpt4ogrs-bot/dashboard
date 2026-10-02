import { useState, type FormEvent } from 'react';
import type { Access, AccessInput } from '../../types';
import { isValidUrl, normalizeUrl } from '../../utils/url';
import { Modal } from '../ui/Modal';

interface AccessFormModalProps {
  access: Access | null;
  categories: string[];
  onClose: () => void;
  onSubmit: (input: AccessInput) => void;
}

interface FormErrors {
  name?: string;
  url?: string;
}

export function AccessFormModal({ access, categories, onClose, onSubmit }: AccessFormModalProps) {
  const [name, setName] = useState(access?.name ?? '');
  const [url, setUrl] = useState(access?.url ?? '');
  const [category, setCategory] = useState(access?.category ?? '');
  const [description, setDescription] = useState(access?.description ?? '');
  const [favorite, setFavorite] = useState(access?.favorite ?? false);
  const [errors, setErrors] = useState<FormErrors>({});

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const normalizedUrl = normalizeUrl(url);
    const nextErrors: FormErrors = {};

    if (!name.trim()) nextErrors.name = 'Informe um nome.';
    if (!normalizedUrl) nextErrors.url = 'Informe o endereço.';
    else if (!isValidUrl(normalizedUrl)) nextErrors.url = 'Endereço inválido.';

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onSubmit({
      name: name.trim(),
      url: normalizedUrl,
      category: category.trim() || undefined,
      description: description.trim() || undefined,
      favorite,
    });
  };

  return (
    <Modal title={access ? 'Editar acesso' : 'Novo acesso'} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="modal__body">
          <label className="field">
            <span className="field__label">Nome *</span>
            <input
              className={`input${errors.name ? ' input--error' : ''}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Gmail"
              autoFocus
            />
            {errors.name && <span className="field__error">{errors.name}</span>}
          </label>

          <label className="field">
            <span className="field__label">Endereço (URL) *</span>
            <input
              className={`input${errors.url ? ' input--error' : ''}`}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Ex.: mail.google.com"
              inputMode="url"
            />
            {errors.url && <span className="field__error">{errors.url}</span>}
          </label>

          <label className="field">
            <span className="field__label">Categoria</span>
            <input
              className="input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Ex.: Trabalho"
              list="access-categories"
            />
            <datalist id="access-categories">
              {categories.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </label>

          <label className="field">
            <span className="field__label">Descrição</span>
            <textarea
              className="input input--textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opcional"
              rows={3}
            />
          </label>

          <label className="checkbox">
            <input type="checkbox" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} />
            <span>Marcar como favorito</span>
          </label>
        </div>

        <div className="modal__footer">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn--primary">
            {access ? 'Salvar' : 'Adicionar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
