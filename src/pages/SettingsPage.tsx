import { Download, Monitor, Moon, Sun, Trash2, Upload } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { Switch } from '../components/ui/Switch';
import { useAccesses } from '../context/AccessesContext';
import { useSettings } from '../context/SettingsContext';
import { downloadBackup, readBackup } from '../services/backup';
import type { Theme } from '../types';

const THEME_OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'dark', label: 'Escuro', icon: Moon },
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'system', label: 'Sistema', icon: Monitor },
];

type Feedback = { type: 'success' | 'error'; message: string } | null;

export function SettingsPage() {
  const { settings, updateSettings } = useSettings();
  const { accesses, replaceAccesses } = useAccesses();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const backup = await readBackup(file);
      const confirmed = window.confirm(
        `Importar ${backup.accesses.length} acesso(s)? Os acessos atuais serão substituídos.`,
      );
      if (!confirmed) return;

      replaceAccesses(backup.accesses);
      if (backup.settings) {
        const { theme, openInNewTab } = backup.settings;
        updateSettings({
          ...(theme && { theme }),
          ...(typeof openInNewTab === 'boolean' && { openInNewTab }),
        });
      }
      setFeedback({ type: 'success', message: `${backup.accesses.length} acesso(s) importado(s) com sucesso.` });
    } catch (error) {
      setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Falha ao importar backup.' });
    }
  };

  const handleClear = () => {
    if (window.confirm('Apagar todos os acessos? Essa ação não pode ser desfeita.')) {
      replaceAccesses([]);
      setFeedback({ type: 'success', message: 'Todos os acessos foram removidos.' });
    }
  };

  return (
    <div className="page page--narrow">
      <header className="page__header">
        <div>
          <h1 className="page__title">Configurações</h1>
          <p className="page__subtitle">Personalize o comportamento do sistema.</p>
        </div>
      </header>

      <section className="settings-section">
        <h2 className="settings-section__title">Aparência</h2>
        <div className="settings-row">
          <div className="settings-row__info">
            <span className="settings-row__label">Tema</span>
            <span className="settings-row__hint">Escolha o tema da interface.</span>
          </div>
          <div className="segmented" role="radiogroup" aria-label="Tema">
            {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={settings.theme === value}
                className={`segmented__option${settings.theme === value ? ' segmented__option--active' : ''}`}
                onClick={() => updateSettings({ theme: value })}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section__title">Comportamento</h2>
        <div className="settings-row">
          <div className="settings-row__info">
            <span className="settings-row__label">Abrir acessos em nova aba</span>
            <span className="settings-row__hint">Mantém o Centralizador aberto ao acessar um sistema.</span>
          </div>
          <Switch
            label="Abrir acessos em nova aba"
            checked={settings.openInNewTab}
            onChange={(openInNewTab) => updateSettings({ openInNewTab })}
          />
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section__title">Dados</h2>
        <div className="settings-row">
          <div className="settings-row__info">
            <span className="settings-row__label">Exportar backup</span>
            <span className="settings-row__hint">Baixa um arquivo JSON com seus acessos e configurações.</span>
          </div>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => downloadBackup(accesses, settings)}
            disabled={accesses.length === 0}
          >
            <Download size={16} /> Exportar
          </button>
        </div>

        <div className="settings-row">
          <div className="settings-row__info">
            <span className="settings-row__label">Importar backup</span>
            <span className="settings-row__hint">Substitui os acessos atuais pelos do arquivo.</span>
          </div>
          <button type="button" className="btn btn--secondary" onClick={() => fileInputRef.current?.click()}>
            <Upload size={16} /> Importar
          </button>
          <input ref={fileInputRef} type="file" accept="application/json,.json" hidden onChange={handleImport} />
        </div>

        <div className="settings-row">
          <div className="settings-row__info">
            <span className="settings-row__label">Apagar todos os acessos</span>
            <span className="settings-row__hint">Remove permanentemente todos os acessos cadastrados.</span>
          </div>
          <button type="button" className="btn btn--danger" onClick={handleClear} disabled={accesses.length === 0}>
            <Trash2 size={16} /> Apagar
          </button>
        </div>

        {feedback && (
          <p className={`feedback feedback--${feedback.type}`} role="status">
            {feedback.message}
          </p>
        )}
      </section>
    </div>
  );
}
