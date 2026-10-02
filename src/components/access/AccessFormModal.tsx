import { ImagePlus, X } from 'lucide-react';
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import type { Access, AccessInput } from '../../types';
import { imageFileToDataUrl } from '../../utils/image';
import { isValidUrl, normalizeUrl } from '../../utils/url';
import { Modal } from '../ui/Modal';
import { SiteIcon } from './SiteIcon';

interface AccessFormModalProps {
  access: Access | null;
  categories: string[];
  onClose: () => void;
  onSubmit: (input: AccessInput) => void;
}

interface FormErrors {
  name?: string;
  url?: string;
  image?: string;
}

export function AccessFormModal({ access, categories, onClose, onSubmit }: AccessFormModalProps) {
  const [name, setName] = useState(access?.name ?? '');
  const [url, setUrl] = useState(access?.url ?? '');
  const [category, setCategory] = useState(access?.category ?? '');
  const [description, setDescription] = useState(access?.description ?? '');
  const [favorite, setFavorite] = useState(access?.favorite ?? false);
  const [image, setImage] = useState(access?.image);
  const [errors, setErrors] = useState<FormErrors>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      setImage(await imageFileToDataUrl(file));
      setErrors((prev) => ({ ...prev, image: undefined }));
    } catch (error) {
      setErrors((prev) => ({ ...prev, image: error instanceof Error ? error.message : 'Imagem inválida.' }));
    }
  };

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
      image,
      favorite,
    });
  };

  return (
    <Modal title={access ? 'Editar acesso' : 'Novo acesso'} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="modal__body">
          <div className="field">
            <span className="field__label">Imagem</span>
            <div className="image-picker">
              <SiteIcon key={normalizeUrl(url)} url={normalizeUrl(url)} name={name || '?'} image={image} size="lg" />
              <div className="image-picker__actions">
                <button type="button" className="btn btn--secondary btn--sm" onClick={() => fileInputRef.current?.click()}>
                  <ImagePlus size={15} /> {image ? 'Trocar imagem' : 'Escolher imagem'}
                </button>
                {image && (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => setImage(undefined)}>
                    <X size={15} /> Remover
                  </button>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleImageChange} />
            </div>
            <span className={errors.image ? 'field__error' : 'field__hint'}>
              {errors.image ?? 'Opcional. Sem imagem, é usado o ícone do próprio site.'}
            </span>
          </div>

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
