import { TriangleAlert } from 'lucide-react';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Modal } from '../components/ui/Modal';
import { useI18n } from '../i18n';

export interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  /** `danger` para ações destrutivas (padrão). */
  tone?: 'danger' | 'primary';
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);
  const { t } = useI18n();

  const confirm = useCallback<ConfirmFn>((next) => {
    resolver.current?.(false);
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOptions(null);
  }, []);

  const cancel = useCallback(() => close(false), [close]);
  const tone = options?.tone ?? 'danger';

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && (
        <Modal title={options.title} onClose={cancel}>
          <div className="modal__body">
            <div className={`confirm confirm--${tone}`}>
              {tone === 'danger' && (
                <span className="confirm__icon">
                  <TriangleAlert size={20} />
                </span>
              )}
              <div className="confirm__message">{options.message}</div>
            </div>
          </div>
          <div className="modal__footer">
            <button type="button" className="btn btn--ghost" onClick={cancel} autoFocus>
              {t.common.cancel}
            </button>
            <button type="button" className={tone === 'danger' ? 'btn btn--danger-solid' : 'btn btn--primary'} onClick={() => close(true)}>
              {options.confirmLabel ?? (tone === 'danger' ? t.common.delete : t.common.confirm)}
            </button>
          </div>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm precisa estar dentro de <ConfirmProvider>.');
  return confirm;
}
