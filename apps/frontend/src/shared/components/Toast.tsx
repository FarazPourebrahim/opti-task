import * as ToastPrimitive from '@radix-ui/react-toast';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import styles from './Toast.module.css';

export type ToastTone = 'info' | 'success' | 'warning' | 'danger';

export type ToastOptions = {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** Shown when the user can quote it in a support request. */
  requestId?: string;
  durationMs?: number;
};

type ToastRecord = ToastOptions & { id: number };

type ToastContextValue = {
  /** Shows a toast. Returns its id so a caller can dismiss it early. */
  toast: (options: ToastOptions) => number;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_ICON: Record<ToastTone, ReactNode> = {
  info: <Info />,
  success: <CheckCircle2 />,
  warning: <AlertTriangle />,
  danger: <XCircle />,
};

/**
 * The only channel for transient messages — `alert()` is banned by lint.
 *
 * Errors default to a longer, non-auto-dismissing lifetime: a failure the user
 * missed is a failure they will hit again.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  const dismiss = useCallback((id: number): void => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback((options: ToastOptions): number => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { ...options, id }]);
    return id;
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({ toast, dismiss }),
    [toast, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}
        {toasts.map((item) => {
          const tone = item.tone ?? 'info';
          return (
            <ToastPrimitive.Root
              key={item.id}
              className={styles.toast}
              data-tone={tone}
              duration={
                item.durationMs ?? (tone === 'danger' ? Infinity : 5000)
              }
              onOpenChange={(open) => {
                if (!open) dismiss(item.id);
              }}
            >
              <span className={styles.toastIcon} aria-hidden>
                {TONE_ICON[tone]}
              </span>
              <div className={styles.toastText}>
                <ToastPrimitive.Title className={styles.toastTitle}>
                  {item.title}
                </ToastPrimitive.Title>
                {item.description ? (
                  <ToastPrimitive.Description
                    className={styles.toastDescription}
                  >
                    {item.description}
                  </ToastPrimitive.Description>
                ) : null}
                {item.requestId ? (
                  <p className={styles.toastRequestId}>
                    {t('error.requestId', { requestId: item.requestId })}
                  </p>
                ) : null}
              </div>
              <ToastPrimitive.Close
                className={styles.toastClose}
                aria-label={t('common.close')}
              >
                <X aria-hidden />
              </ToastPrimitive.Close>
            </ToastPrimitive.Root>
          );
        })}
        <ToastPrimitive.Viewport className={styles.toastViewport} />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  return context;
}
