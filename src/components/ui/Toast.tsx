import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import clsx from 'clsx';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';

type ToastTone = 'success' | 'danger' | 'info';
interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastApi {
  push: (message: string, tone?: ToastTone) => void;
  success: (m: string) => void;
  error: (m: string) => void;
  info: (m: string) => void;
}

const Ctx = createContext<ToastApi | undefined>(undefined);

let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      const id = ++seq;
      setToasts((t) => [...t, { id, tone, message }]);
      window.setTimeout(() => remove(id), 4500);
    },
    [remove],
  );

  const api = useMemo<ToastApi>(
    () => ({
      push,
      success: (m) => push(m, 'success'),
      error: (m) => push(m, 'danger'),
      info: (m) => push(m, 'info'),
    }),
    [push],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={clsx(
              'flex animate-toast-in items-start gap-2.5 overflow-hidden rounded-card border border-line bg-paper py-2.5 pl-3 pr-2.5 text-sm text-ink shadow-md',
              'before:absolute before:inset-y-0 before:left-0 before:w-1',
              'relative',
              t.tone === 'success' && 'before:bg-success',
              t.tone === 'danger' && 'before:bg-danger',
              t.tone === 'info' && 'before:bg-info',
            )}
          >
            <span
              className={clsx(
                'mt-px shrink-0',
                t.tone === 'success' && 'text-success',
                t.tone === 'danger' && 'text-danger',
                t.tone === 'info' && 'text-info',
              )}
            >
              {t.tone === 'success' ? (
                <CheckCircle2 className="h-[18px] w-[18px]" strokeWidth={1.5} />
              ) : t.tone === 'danger' ? (
                <XCircle className="h-[18px] w-[18px]" strokeWidth={1.5} />
              ) : (
                <Info className="h-[18px] w-[18px]" strokeWidth={1.5} />
              )}
            </span>
            <span className="flex-1 pt-px">{t.message}</span>
            <button
              onClick={() => remove(t.id)}
              aria-label="Dismiss"
              className="grid h-5 w-5 shrink-0 cursor-pointer place-items-center rounded-chip text-ink-faint hover:bg-surface hover:text-ink"
            >
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
