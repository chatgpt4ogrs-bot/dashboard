import { CheckCircle2, Database, Eye, EyeOff, Layers, PlugZap, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { MIN_PASSWORD_LENGTH } from '../../shared/auth';
import type { ConnectionTestResult, DatabaseInput, SetupResult } from '../../shared/setup';
import { LanguageSelector } from '../components/ui/LanguageSelector';
import { useI18n } from '../i18n';
import { getErrorMessage, setupApi } from '../services/api';

interface SetupPageProps {
  hasLegacyData: boolean;
  onComplete: () => void;
}

export function SetupPage({ hasLegacyData, onComplete }: SetupPageProps) {
  const { t } = useI18n();
  const [host, setHost] = useState('');
  const [port, setPort] = useState('5432');
  const [dbUser, setDbUser] = useState('');
  const [dbPassword, setDbPassword] = useState('');
  const [database, setDatabase] = useState('centralizador');
  const [showDbPassword, setShowDbPassword] = useState(false);

  const [name, setName] = useState(t.setup.defaultAdminName);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SetupResult | null>(null);

  const databaseInput = (): DatabaseInput => ({
    host: host.trim(),
    port: Number(port),
    user: dbUser.trim(),
    password: dbPassword,
    database: database.trim() || 'centralizador',
  });

  const validateDatabase = (): string | null => {
    if (!host.trim()) return t.setup.hostRequired;
    const portNumber = Number(port);
    if (!Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65535) return t.setup.invalidPort;
    if (!dbUser.trim()) return t.setup.userRequired;
    return null;
  };

  const handleTest = async () => {
    const invalid = validateDatabase();
    if (invalid) return setTestResult({ ok: false, message: invalid });
    setTesting(true);
    setTestResult(null);
    try {
      setTestResult(await setupApi.test(databaseInput()));
    } catch (err) {
      setTestResult({ ok: false, message: getErrorMessage(err) });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const invalid =
      validateDatabase() ??
      (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? t.setup.invalidAdminEmail : null) ??
      (password.length < MIN_PASSWORD_LENGTH ? t.common.minPassword(MIN_PASSWORD_LENGTH) : null) ??
      (password !== confirmPassword ? t.setup.passwordMismatch : null);
    if (invalid) return setError(invalid);

    setSubmitting(true);
    setError(null);
    try {
      setResult(
        await setupApi.run({
          database: databaseInput(),
          admin: { name: name.trim() || t.setup.defaultAdminName, email: email.trim(), password },
        }),
      );
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const languageSelector = (
    <div className="login__language">
      <LanguageSelector />
    </div>
  );

  if (result) {
    const { imported } = result;
    return (
      <div className="login">
        {languageSelector}
        <div className="login__card setup__card">
          <div className="login__brand">
            <span className="login__logo setup__logo--success">
              <CheckCircle2 size={22} />
            </span>
            <h1 className="login__title">{t.setup.doneTitle}</h1>
            <p className="login__subtitle">
              {t.setup.doneConnected} <strong>{result.user.email}</strong> {t.setup.doneCreated}
            </p>
          </div>
          {imported && (
            <p className="feedback feedback--success">
              {t.setup.imported(imported.condominiums, imported.equipments, imported.users, imported.events)}
            </p>
          )}
          <button type="button" className="btn btn--primary login__submit" onClick={onComplete}>
            {t.setup.enter}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login">
      {languageSelector}
      <form className="login__card setup__card" onSubmit={handleSubmit} noValidate>
        <div className="login__brand">
          <span className="login__logo">
            <Layers size={22} />
          </span>
          <h1 className="login__title">{t.setup.title}</h1>
          <p className="login__subtitle">{t.setup.subtitle}</p>
        </div>

        <section className="setup__section">
          <h2 className="setup__section-title">
            <Database size={16} /> {t.setup.database}
          </h2>

          <div className="field-row field-row--host">
            <label className="field">
              <span className="field__label">{t.setup.host}</span>
              <input
                className="input"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder={t.setup.hostPlaceholder}
                autoFocus
              />
            </label>
            <label className="field">
              <span className="field__label">{t.common.portRequired}</span>
              <input className="input" value={port} onChange={(e) => setPort(e.target.value)} inputMode="numeric" />
            </label>
          </div>

          <div className="field-row">
            <label className="field">
              <span className="field__label">{t.common.userRequired}</span>
              <input className="input" value={dbUser} onChange={(e) => setDbUser(e.target.value)} autoComplete="off" />
            </label>
            <label className="field">
              <span className="field__label">{t.common.password}</span>
              <div className="input-group">
                <input
                  className="input"
                  type={showDbPassword ? 'text' : 'password'}
                  value={dbPassword}
                  onChange={(e) => setDbPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <div className="input-group__actions">
                  <button
                    type="button"
                    className="icon-btn icon-btn--sm"
                    onClick={() => setShowDbPassword((v) => !v)}
                    aria-label={showDbPassword ? t.common.hidePassword : t.common.showPassword}
                  >
                    {showDbPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            </label>
          </div>

          <label className="field">
            <span className="field__label">{t.setup.databaseName}</span>
            <input className="input" value={database} onChange={(e) => setDatabase(e.target.value)} />
            <span className="field__hint">{t.setup.databaseHint}</span>
          </label>

          <button type="button" className="btn btn--secondary btn--sm setup__test" onClick={handleTest} disabled={testing}>
            <PlugZap size={15} /> {testing ? t.common.testing : t.setup.test}
          </button>
          {testResult && (
            <p className={`feedback feedback--${testResult.ok ? 'success' : 'error'}`}>{t.serverMessage(testResult.message)}</p>
          )}
        </section>

        <section className="setup__section">
          <h2 className="setup__section-title">
            <ShieldCheck size={16} /> {t.setup.admin}
          </h2>

          <label className="field">
            <span className="field__label">{t.common.name}</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>

          <label className="field">
            <span className="field__label">{t.common.emailRequired}</span>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
          </label>

          <div className="field-row">
            <label className="field">
              <span className="field__label">{t.common.passwordRequired}</span>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder={t.setup.passwordPlaceholder(MIN_PASSWORD_LENGTH)}
              />
            </label>
            <label className="field">
              <span className="field__label">{t.setup.confirmPassword}</span>
              <input
                className="input"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </label>
          </div>
        </section>

        {hasLegacyData && <p className="field__hint">{t.setup.legacyHint}</p>}

        {error && (
          <p className="feedback feedback--error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn btn--primary login__submit" disabled={submitting}>
          {submitting ? t.setup.submitting : t.setup.submit}
        </button>
      </form>
    </div>
  );
}
