import { ImagePlus, X } from 'lucide-react';
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useI18n } from '../../i18n';
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
  const { t } = useI18n();
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
      setErrors((prev) => ({ ...prev, image: error instanceof Error ? error.message : t.errors.imageInvalid }));
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const normalizedUrl = normalizeUrl(url);
    const nextErrors: FormErrors = {};

    if (!name.trim()) nextErrors.name = t.accessForm.nameRequired;
    if (!normalizedUrl) nextErrors.url = t.accessForm.urlRequired;
    else if (!isValidUrl(normalizedUrl)) nextErrors.url = t.accessForm.urlInvalid;

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
    <Modal title={access ? t.accessForm.editTitle : t.accessForm.newTitle} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="modal__body">
          <div className="field">
            <span className="field__label">{t.accessForm.image}</span>
            <div className="image-picker">
              <SiteIcon key={normalizeUrl(url)} url={normalizeUrl(url)} name={name || '?'} image={image} size="lg" />
              <div className="image-picker__actions">
                <button type="button" className="btn btn--secondary btn--sm" onClick={() => fileInputRef.current?.click()}>
                  <ImagePlus size={15} /> {image ? t.accessForm.changeImage : t.accessForm.chooseImage}
                </button>
                {image && (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => setImage(undefined)}>
                    <X size={15} /> {t.common.remove}
                  </button>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleImageChange} />
            </div>
            <span className={errors.image ? 'field__error' : 'field__hint'}>{errors.image ?? t.accessForm.imageHint}</span>
          </div>

          <label className="field">
            <span className="field__label">{t.common.nameRequired}</span>
            <input
              className={`input${errors.name ? ' input--error' : ''}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.accessForm.namePlaceholder}
              autoFocus
            />
            {errors.name && <span className="field__error">{errors.name}</span>}
          </label>

          <label className="field">
            <span className="field__label">{t.accessForm.url}</span>
            <input
              className={`input${errors.url ? ' input--error' : ''}`}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t.accessForm.urlPlaceholder}
              inputMode="url"
            />
            {errors.url && <span className="field__error">{errors.url}</span>}
          </label>

          <label className="field">
            <span className="field__label">{t.accessForm.category}</span>
            <input
              className="input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder={t.accessForm.categoryPlaceholder}
              list="access-categories"
            />
            <datalist id="access-categories">
              {categories.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </label>

          <label className="field">
            <span className="field__label">{t.accessForm.description}</span>
            <textarea
              className="input input--textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t.common.optional}
              rows={3}
            />
          </label>

          <label className="checkbox">
            <input type="checkbox" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} />
            <span>{t.accessForm.favorite}</span>
          </label>
        </div>

        <div className="modal__footer">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            {t.common.cancel}
          </button>
          <button type="submit" className="btn btn--primary">
            {access ? t.common.save : t.common.add}
          </button>
        </div>
      </form>
    </Modal>
  );
}
