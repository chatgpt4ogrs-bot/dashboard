import { Eye, EyeOff, Layers, LogIn } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { LanguageSelector } from '../components/ui/LanguageSelector';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n';
import { getErrorMessage } from '../services/api';

export function LoginPage() {
  const { user, login } = useAuth();
  const { t } = useI18n();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? '/';
  if (user) return <Navigate to={from} replace />;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password) return setError(t.login.required);
    setSubmitting(true);
    setError(null);
    try {
      await login({ email: email.trim(), password });
    } catch (err) {
      setError(getErrorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <div className="login">
      <div className="login__language">
        <LanguageSelector />
      </div>

      <form className="login__card" onSubmit={handleSubmit} noValidate>
        <div className="login__brand">
          <span className="login__logo">
            <Layers size={22} />
          </span>
          <h1 className="login__title">{t.app.name}</h1>
          <p className="login__subtitle">{t.login.subtitle}</p>
        </div>

        <label className="field">
          <span className="field__label">{t.common.email}</span>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            autoFocus
          />
        </label>

        <label className="field">
          <span className="field__label">{t.common.password}</span>
          <div className="input-group">
            <input
              className="input"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
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
            </div>
          </div>
        </label>

        {error && (
          <p className="feedback feedback--error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn btn--primary login__submit" disabled={submitting}>
          <LogIn size={16} /> {submitting ? t.login.submitting : t.login.submit}
        </button>
      </form>
    </div>
  );
}
