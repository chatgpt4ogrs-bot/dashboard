import { Download, Monitor, Moon, Sun, Trash2, Upload } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { LanguageSelector } from '../components/ui/LanguageSelector';
import { Switch } from '../components/ui/Switch';
import { useAccesses } from '../context/AccessesContext';
import { useConfirm } from '../context/ConfirmContext';
import { useSettings } from '../context/SettingsContext';
import { useI18n } from '../i18n';
import { downloadBackup, readBackup } from '../services/backup';
import type { Theme } from '../types';

const THEME_OPTIONS: { value: Theme; icon: typeof Sun }[] = [
  { value: 'dark', icon: Moon },
  { value: 'light', icon: Sun },
  { value: 'system', icon: Monitor },
];

type Feedback = { type: 'success' | 'error'; message: string } | null;

export function SettingsPage() {
  const { settings, updateSettings } = useSettings();
  const { accesses, replaceAccesses } = useAccesses();
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const confirm = useConfirm();

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const backup = await readBackup(file);
      const confirmed = await confirm({
        title: t.settings.importBackup,
        message: t.settings.importConfirm(backup.accesses.length, accesses.length),
        confirmLabel: t.settings.replace,
      });
      if (!confirmed) return;

      replaceAccesses(backup.accesses);
      if (backup.settings) {
        const { theme, openInNewTab } = backup.settings;
        updateSettings({
          ...(theme && { theme }),
          ...(typeof openInNewTab === 'boolean' && { openInNewTab }),
        });
      }
      setFeedback({ type: 'success', message: t.settings.imported(backup.accesses.length) });
    } catch (error) {
      setFeedback({ type: 'error', message: error instanceof Error ? error.message : t.errors.backupImport });
    }
  };

  const handleClear = async () => {
    const confirmed = await confirm({
      title: t.settings.clearAll,
      message: t.settings.clearConfirm(accesses.length),
      confirmLabel: t.settings.clearConfirmLabel,
    });
    if (!confirmed) return;
    replaceAccesses([]);
    setFeedback({ type: 'success', message: t.settings.cleared });
  };

  return (
    <div className="settings-content">
      <section className="settings-section">
        <h2 className="settings-section__title">{t.settings.appearance}</h2>
        <div className="settings-row">
          <div className="settings-row__info">
            <span className="settings-row__label">{t.settings.theme}</span>
            <span className="settings-row__hint">{t.settings.themeHint}</span>
          </div>
          <div className="segmented" role="radiogroup" aria-label={t.settings.theme}>
            {THEME_OPTIONS.map(({ value, icon: Icon }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={settings.theme === value}
                className={`segmented__option${settings.theme === value ? ' segmented__option--active' : ''}`}
                onClick={() => updateSettings({ theme: value })}
              >
                <Icon size={14} /> {t.settings.themes[value]}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-row">
          <div className="settings-row__info">
            <span className="settings-row__label">{t.language.label}</span>
            <span className="settings-row__hint">{t.settings.languageHint}</span>
          </div>
          <LanguageSelector />
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section__title">{t.settings.behavior}</h2>
        <div className="settings-row">
          <div className="settings-row__info">
            <span className="settings-row__label">{t.settings.openInNewTab}</span>
            <span className="settings-row__hint">{t.settings.openInNewTabHint}</span>
          </div>
          <Switch
            label={t.settings.openInNewTab}
            checked={settings.openInNewTab}
            onChange={(openInNewTab) => updateSettings({ openInNewTab })}
          />
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section__title">{t.settings.data}</h2>
        <div className="settings-row">
          <div className="settings-row__info">
            <span className="settings-row__label">{t.settings.exportBackup}</span>
            <span className="settings-row__hint">{t.settings.exportHint}</span>
          </div>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => downloadBackup(accesses, settings)}
            disabled={accesses.length === 0}
          >
            <Download size={16} /> {t.settings.export}
          </button>
        </div>

        <div className="settings-row">
          <div className="settings-row__info">
            <span className="settings-row__label">{t.settings.importBackup}</span>
            <span className="settings-row__hint">{t.settings.importHint}</span>
          </div>
          <button type="button" className="btn btn--secondary" onClick={() => fileInputRef.current?.click()}>
            <Upload size={16} /> {t.settings.import}
          </button>
          <input ref={fileInputRef} type="file" accept="application/json,.json" hidden onChange={handleImport} />
        </div>

        <div className="settings-row">
          <div className="settings-row__info">
            <span className="settings-row__label">{t.settings.clearAll}</span>
            <span className="settings-row__hint">{t.settings.clearHint}</span>
          </div>
          <button type="button" className="btn btn--danger" onClick={handleClear} disabled={accesses.length === 0}>
            <Trash2 size={16} /> {t.settings.clear}
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
