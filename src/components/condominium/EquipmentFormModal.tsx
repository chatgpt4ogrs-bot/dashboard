import { Check, Copy, Eye, EyeOff } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { DEVICE_BRANDS, type DeviceBrand, type Equipment, type EquipmentInput } from '../../../shared/condominium';
import { useI18n } from '../../i18n';
import { equipmentApi, getErrorMessage } from '../../services/api';
import { Modal } from '../ui/Modal';

interface EquipmentFormModalProps {
  equipment: Equipment | null;
  onClose: () => void;
  onSubmit: (input: EquipmentInput) => Promise<void>;
}

export function EquipmentFormModal({ equipment, onClose, onSubmit }: EquipmentFormModalProps) {
  const { t } = useI18n();
  const [name, setName] = useState(equipment?.name ?? '');
  const [brand, setBrand] = useState<DeviceBrand>(equipment?.brand ?? 'intelbras');
  const [type, setType] = useState(equipment?.type ?? '');
  const [host, setHost] = useState(equipment?.host ?? '');
  const [port, setPort] = useState(String(equipment?.port ?? 80));
  const [useHttps, setUseHttps] = useState(equipment?.useHttps ?? false);
  const [username, setUsername] = useState(equipment?.username ?? 'admin');
  const [password, setPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(Boolean(equipment?.hasPassword));
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notes, setNotes] = useState(equipment?.notes ?? '');
  const [model, setModel] = useState(equipment?.model ?? '');
  const [firmware, setFirmware] = useState(equipment?.firmware ?? '');
  const [serial, setSerial] = useState(equipment?.serial ?? '');
  const [mac, setMac] = useState(equipment?.mac ?? '');
  const [installedAt, setInstalledAt] = useState(equipment?.installedAt ?? '');
  const [lastMaintenanceAt, setLastMaintenanceAt] = useState(equipment?.lastMaintenanceAt ?? '');
  const [responsible, setResponsible] = useState(equipment?.responsible ?? '');
  const [hasAssetInfo] = useState(() =>
    Boolean(equipment && [equipment.model, equipment.firmware, equipment.serial, equipment.mac, equipment.installedAt, equipment.lastMaintenanceAt, equipment.responsible].some(Boolean)),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!equipment?.hasPassword) return;
    let cancelled = false;
    equipmentApi
      .getPassword(equipment.id)
      .then((value) => !cancelled && setPassword(value))
      .catch((err) => !cancelled && setError(t.equipmentForm.passwordLoadError(getErrorMessage(err))))
      .finally(() => !cancelled && setPasswordLoading(false));
    return () => {
      cancelled = true;
    };
  }, [equipment]);

  const handleCopyPassword = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setShowPassword(true);
    }
  };

  const handleHttpsChange = (checked: boolean) => {
    setUseHttps(checked);
    if (checked && port === '80') setPort('443');
    if (!checked && port === '443') setPort('80');
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const portNumber = Number(port);

    if (!name.trim()) return setError(t.equipmentForm.nameRequired);
    if (!host.trim()) return setError(t.equipmentForm.hostRequired);
    if (!Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65535) return setError(t.common.invalidPort);
    if (!username.trim()) return setError(t.equipmentForm.userRequired);

    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        brand,
        type: type.trim() || undefined,
        host: host.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, ''),
        port: portNumber,
        useHttps,
        username: username.trim(),
        password: password || undefined,
        notes: notes.trim() || undefined,
        model: model.trim() || undefined,
        firmware: firmware.trim() || undefined,
        serial: serial.trim() || undefined,
        mac: mac.trim() || undefined,
        installedAt: installedAt || undefined,
        lastMaintenanceAt: lastMaintenanceAt || undefined,
        responsible: responsible.trim() || undefined,
      });
    } catch (err) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  };

  return (
    <Modal title={equipment ? t.equipmentForm.editTitle : t.equipmentForm.newTitle} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="modal__body">
          <label className="field">
            <span className="field__label">{t.common.nameRequired}</span>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.equipmentForm.namePlaceholder}
              autoFocus
            />
          </label>

          <div className="field-row">
            <label className="field">
              <span className="field__label">{t.equipmentForm.brand}</span>
              <select className="input" value={brand} onChange={(e) => setBrand(e.target.value as DeviceBrand)}>
                {DEVICE_BRANDS.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field__label">{t.equipmentForm.type}</span>
              <input
                className="input"
                value={type}
                onChange={(e) => setType(e.target.value)}
                placeholder={t.common.optional}
                list="equipment-types"
              />
              <datalist id="equipment-types">
                {t.equipmentForm.typeSuggestions.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </label>
          </div>

          <div className="field-row field-row--host">
            <label className="field">
              <span className="field__label">{t.equipmentForm.host}</span>
              <input className="input" value={host} onChange={(e) => setHost(e.target.value)} placeholder={t.equipmentForm.hostPlaceholder} />
            </label>

            <label className="field">
              <span className="field__label">{t.common.portRequired}</span>
              <input className="input" value={port} onChange={(e) => setPort(e.target.value)} inputMode="numeric" />
            </label>
          </div>

          <label className="checkbox">
            <input type="checkbox" checked={useHttps} onChange={(e) => handleHttpsChange(e.target.checked)} />
            <span>{t.equipmentForm.useHttps}</span>
          </label>

          <div className="field-row">
            <label className="field">
              <span className="field__label">{t.common.userRequired}</span>
              <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" />
            </label>

            <label className="field">
              <span className="field__label">{t.common.password}</span>
              <div className="input-group">
                <input
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder={passwordLoading ? t.common.loading : ''}
                  disabled={passwordLoading}
                />
                <div className="input-group__actions">
                  <button
                    type="button"
                    className="icon-btn icon-btn--sm"
                    onClick={() => setShowPassword((v) => !v)}
                    title={showPassword ? t.common.hidePassword : t.common.showPassword}
                    aria-label={showPassword ? t.common.hidePassword : t.common.showPassword}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                  {password && (
                    <button
                      type="button"
                      className="icon-btn icon-btn--sm"
                      onClick={handleCopyPassword}
                      title={copied ? t.equipmentForm.copied : t.equipmentForm.copyPassword}
                      aria-label={t.equipmentForm.copyPassword}
                    >
                      {copied ? <Check size={15} /> : <Copy size={15} />}
                    </button>
                  )}
                </div>
              </div>
            </label>
          </div>

          <details className="form-section" open={hasAssetInfo}>
            <summary className="form-section__title">{t.equipmentForm.assetSection}</summary>
            <p className="form-section__hint">{t.equipmentForm.assetHint}</p>

            <div className="field-row">
              <label className="field">
                <span className="field__label">{t.equipmentForm.model}</span>
                <input className="input" value={model} onChange={(e) => setModel(e.target.value)} />
              </label>
              <label className="field">
                <span className="field__label">Firmware</span>
                <input className="input" value={firmware} onChange={(e) => setFirmware(e.target.value)} />
              </label>
            </div>

            <div className="field-row">
              <label className="field">
                <span className="field__label">Serial</span>
                <input className="input" value={serial} onChange={(e) => setSerial(e.target.value)} />
              </label>
              <label className="field">
                <span className="field__label">MAC</span>
                <input className="input" value={mac} onChange={(e) => setMac(e.target.value)} placeholder="AA:BB:CC:DD:EE:FF" />
              </label>
            </div>

            <div className="field-row">
              <label className="field">
                <span className="field__label">{t.equipmentForm.installedAt}</span>
                <input className="input" type="date" value={installedAt} onChange={(e) => setInstalledAt(e.target.value)} />
              </label>
              <label className="field">
                <span className="field__label">{t.equipmentForm.lastMaintenance}</span>
                <input className="input" type="date" value={lastMaintenanceAt} onChange={(e) => setLastMaintenanceAt(e.target.value)} />
              </label>
            </div>

            <label className="field">
              <span className="field__label">{t.equipmentForm.responsible}</span>
              <input
                className="input"
                value={responsible}
                onChange={(e) => setResponsible(e.target.value)}
                placeholder={t.equipmentForm.responsiblePlaceholder}
              />
            </label>
          </details>

          <label className="field">
            <span className="field__label">{t.common.notes}</span>
            <textarea
              className="input input--textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
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
            {equipment ? t.common.save : t.common.add}
          </button>
        </div>
      </form>
    </Modal>
  );
}
