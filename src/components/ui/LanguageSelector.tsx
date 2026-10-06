import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { LANGUAGES, useI18n } from '../../i18n';
import type { Language } from '../../types';

const FLAGS: Record<Language, () => ReactElement> = {
  pt: () => (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" fill="#009c3b" />
      <path d="M16 5 29 16 16 27 3 16Z" fill="#ffdf00" />
      <circle cx="16" cy="16" r="6.2" fill="#002776" />
      <path d="M9.9 14.8Q16 13.2 22.1 17.6" stroke="#fff" strokeWidth="1.3" fill="none" />
    </svg>
  ),
  en: () => (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" fill="#fff" />
      {[0, 2, 4, 6, 8, 10, 12].map((i) => (
        <rect key={i} y={(i * 32) / 13} width="32" height={32 / 13} fill="#b22234" />
      ))}
      <rect width="16" height={(7 * 32) / 13} fill="#3c3b6e" />
      {[3.5, 8, 12.5].flatMap((x) => [3.5, 8.5, 13.5].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1" fill="#fff" />))}
    </svg>
  ),
};

function Flag({ code }: { code: Language }) {
  const Icon = FLAGS[code];
  return (
    <span className="lang__flag">
      <Icon />
    </span>
  );
}

interface LanguageSelectorProps {
  /** Para onde o menu abre. */
  direction?: 'up' | 'down';
  /** Mostra só a bandeira (sidebar recolhida). */
  compact?: boolean;
}

export function LanguageSelector({ direction = 'down', compact = false }: LanguageSelectorProps) {
  const { language, setLanguage, t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('pointerdown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const select = (code: Language) => {
    setLanguage(code);
    setOpen(false);
  };

  return (
    <div className={`lang lang--${direction}${compact ? ' lang--compact' : ''}`} ref={ref}>
      <button
        type="button"
        className="lang__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t.language.label}
        title={t.language.label}
      >
        <Flag code={language} />
        {!compact && (
          <>
            <span className="lang__code">{language.toUpperCase()}</span>
            <ChevronDown size={14} className="lang__caret" />
          </>
        )}
      </button>

      {open && (
        <ul className="lang__menu" role="listbox" aria-label={t.language.label}>
          {LANGUAGES.map(({ code, label }) => (
            <li key={code}>
              <button
                type="button"
                role="option"
                aria-selected={code === language}
                className={`lang__option${code === language ? ' lang__option--active' : ''}`}
                onClick={() => select(code)}
                title={label}
              >
                <Flag code={code} />
                {!compact && <span className="lang__code">{code.toUpperCase()}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
