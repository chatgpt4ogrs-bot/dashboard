import { Eye, EyeOff, Wand2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { MIN_PASSWORD_LENGTH, USER_ROLES, type ManagedUser, type UserInput, type UserRole } from '../../../shared/auth';
import { useI18n } from '../../i18n';
import { getErrorMessage } from '../../services/api';
import { Switch } from '../ui/Switch';
import { Modal } from '../ui/Modal';

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$%';
  const values = crypto.getRandomValues(new Uint32Array(14));
  return Array.from(values, (v) => chars[v % chars.length]).join('');
}

interface UserFormModalProps {
  user: ManagedUser | null;
  isSelf: boolean;
  onClose: () => void;
  onSubmit: (input: UserInput) => Promise<void>;
}

export function UserFormModal({ user, isSelf, onClose, onSubmit }: UserFormModalProps) {
  const { t } = useI18n();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [role, setRole] = useState<UserRole>(user?.role ?? 'super_admin');
  const [active, setActive] = useState(user?.active ?? true);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleGenerate = () => {
    setPassword(generatePassword());
    setShowPassword(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError(t.common.invalidEmail);
    if (!user && !password) return setError(t.userForm.passwordRequired);
    if (password && password.length < MIN_PASSWORD_LENGTH) return setError(t.common.minPassword(MIN_PASSWORD_LENGTH));

    setSaving(true);
    setError(null);
    try {
      await onSubmit({ name: name.trim() || undefined, email: email.trim(), role, active, password: password || undefined });
    } catch (err) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  };

  return (
    <Modal title={user ? t.userForm.editTitle : t.userForm.newTitle} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="modal__body">
          <label className="field">
            <span className="field__label">{t.common.name}</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t.common.optional} autoFocus />
          </label>

          <label className="field">
            <span className="field__label">{t.common.emailRequired}</span>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
          </label>

          <label className="field">
            <span className="field__label">{user ? t.userForm.newPassword : t.common.passwordRequired}</span>
            <div className="input-group">
              <input
                className="input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder={user ? t.userForm.keepPassword : t.userForm.minPassword(MIN_PASSWORD_LENGTH)}
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
                <button
                  type="button"
                  className="icon-btn icon-btn--sm"
                  onClick={handleGenerate}
                  title={t.userForm.generate}
                  aria-label={t.userForm.generate}
                >
                  <Wand2 size={15} />
                </button>
              </div>
            </div>
            {user && password && (
              <span className="field__hint">{isSelf ? t.userForm.selfSessionsHint : t.userForm.userSessionsHint}</span>
            )}
          </label>

          <label className="field">
            <span className="field__label">{t.users.role}</span>
            <select className="input" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
              {USER_ROLES.map((value) => (
                <option key={value} value={value}>
                  {t.roles[value]}
                </option>
              ))}
            </select>
            <span className="field__hint">{t.userForm.roleHint}</span>
          </label>

          <div className="settings-row settings-row--compact">
            <div className="settings-row__info">
              <span className="settings-row__label">{t.userForm.active}</span>
              <span className="settings-row__hint">{isSelf ? t.userForm.selfActiveHint : t.userForm.activeHint}</span>
            </div>
            <Switch label={t.userForm.active} checked={active} onChange={setActive} disabled={isSelf} />
          </div>

          {error && <p className="feedback feedback--error">{error}</p>}
        </div>

        <div className="modal__footer">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            {t.common.cancel}
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {user ? t.common.save : t.userForm.create}
          </button>
        </div>
      </form>
    </Modal>
  );
}
