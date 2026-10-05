import { Check, Copy, Eye, EyeOff } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { DEVICE_BRANDS, type DeviceBrand, type Equipment, type EquipmentInput } from '../../../shared/condominium';
import { equipmentApi, getErrorMessage } from '../../services/api';
import { Modal } from '../ui/Modal';

const TYPE_SUGGESTIONS = ['Controlador de acesso', 'Leitor facial', 'DVR', 'NVR', 'Câmera IP', 'Videoporteiro'];

interface EquipmentFormModalProps {
  equipment: Equipment | null;
  onClose: () => void;
  onSubmit: (input: EquipmentInput) => Promise<void>;
}

export function EquipmentFormModal({ equipment, onClose, onSubmit }: EquipmentFormModalProps) {
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
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!equipment?.hasPassword) return;
    let cancelled = false;
    equipmentApi
      .getPassword(equipment.id)
      .then((value) => !cancelled && setPassword(value))
      .catch((err) => !cancelled && setError(`Não foi possível carregar a senha: ${getErrorMessage(err)}`))
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

    if (!name.trim()) return setError('Informe o nome do equipamento.');
    if (!host.trim()) return setError('Informe o endereço IP ou domínio.');
    if (!Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65535) return setError('Porta inválida.');
    if (!username.trim()) return setError('Informe o usuário.');

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
      });
    } catch (err) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  };

  return (
    <Modal title={equipment ? 'Editar equipamento' : 'Novo equipamento'} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="modal__body">
          <label className="field">
            <span className="field__label">Nome *</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Portão social" autoFocus />
          </label>

          <div className="field-row">
            <label className="field">
              <span className="field__label">Marca *</span>
              <select className="input" value={brand} onChange={(e) => setBrand(e.target.value as DeviceBrand)}>
                {DEVICE_BRANDS.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field__label">Tipo</span>
              <input className="input" value={type} onChange={(e) => setType(e.target.value)} placeholder="Opcional" list="equipment-types" />
              <datalist id="equipment-types">
                {TYPE_SUGGESTIONS.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </label>
          </div>

          <div className="field-row field-row--host">
            <label className="field">
              <span className="field__label">IP ou domínio *</span>
              <input className="input" value={host} onChange={(e) => setHost(e.target.value)} placeholder="Ex.: 192.168.1.100" />
            </label>

            <label className="field">
              <span className="field__label">Porta *</span>
              <input className="input" value={port} onChange={(e) => setPort(e.target.value)} inputMode="numeric" />
            </label>
          </div>

          <label className="checkbox">
            <input type="checkbox" checked={useHttps} onChange={(e) => handleHttpsChange(e.target.checked)} />
            <span>Usar HTTPS</span>
          </label>

          <div className="field-row">
            <label className="field">
              <span className="field__label">Usuário *</span>
              <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" />
            </label>

            <label className="field">
              <span className="field__label">Senha</span>
              <div className="input-group">
                <input
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder={passwordLoading ? 'Carregando...' : ''}
                  disabled={passwordLoading}
                />
                <div className="input-group__actions">
                  <button
                    type="button"
                    className="icon-btn icon-btn--sm"
                    onClick={() => setShowPassword((v) => !v)}
                    title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                  {password && (
                    <button
                      type="button"
                      className="icon-btn icon-btn--sm"
                      onClick={handleCopyPassword}
                      title={copied ? 'Copiada!' : 'Copiar senha'}
                      aria-label="Copiar senha"
                    >
                      {copied ? <Check size={15} /> : <Copy size={15} />}
                    </button>
                  )}
                </div>
              </div>
            </label>
          </div>

          <label className="field">
            <span className="field__label">Observações</span>
            <textarea className="input input--textarea" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Opcional" />
          </label>

          {error && <p className="feedback feedback--error">{error}</p>}
        </div>

        <div className="modal__footer">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {equipment ? 'Salvar' : 'Adicionar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
