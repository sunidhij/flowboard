import clsx from 'clsx';
import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/context';
import { toastDismissed } from '@/store/slices/uiSlice';
import type { ToastState } from '@/store/slices/uiSlice';
import { forgetToastAction, runToastAction } from '@/store/toastActions';
import { Icon } from './Icon';

/** Auto-dismiss: 2s for every toast, 4s when it has an action (e.g. Undo) so there's time to click it. */
const DURATION_MS = 2000;
const DURATION_WITH_ACTION_MS = 4000;

function ToastItem({ toast }: { toast: ToastState }) {
  const dispatch = useAppDispatch();
  useEffect(() => {
    const t = setTimeout(() => {
      dispatch(toastDismissed(toast.id));
      forgetToastAction(toast.id);
    }, toast.actionLabel ? DURATION_WITH_ACTION_MS : DURATION_MS);
    return () => clearTimeout(t);
  }, [toast, dispatch]);

  return (
    <div
      role={toast.kind === 'error' ? 'alert' : 'status'}
      className={clsx(
        'pointer-events-auto flex w-[calc(100vw-2rem)] max-w-80 animate-slide-in items-start gap-3 rounded-card border bg-white px-3.5 py-3 shadow-lift',
        toast.kind === 'error' ? 'border-red-200' : 'border-surface-border',
      )}
    >
      <span
        className={clsx(
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
          toast.kind === 'error' && 'bg-red-100 text-red-600',
          toast.kind === 'success' && 'bg-emerald-100 text-emerald-600',
          toast.kind === 'info' && 'bg-brand-100 text-brand-600',
        )}
      >
        <Icon name={toast.kind === 'error' ? 'alert' : toast.kind === 'success' ? 'check' : 'info'} className="h-3 w-3" />
      </span>
      <p className="min-w-0 flex-1 text-sm text-ink">{toast.message}</p>
      {toast.actionLabel && (
        <button
          type="button"
          onClick={() => {
            runToastAction(toast.id);
            dispatch(toastDismissed(toast.id));
          }}
          className="shrink-0 rounded px-1 text-sm font-semibold text-brand-600 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          {toast.actionLabel}
        </button>
      )}
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => {
          dispatch(toastDismissed(toast.id));
          forgetToastAction(toast.id);
        }}
        className="shrink-0 rounded text-ink-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <Icon name="x" className="h-4 w-4" />
      </button>
    </div>
  );
}

export function Toaster() {
  const toasts = useAppSelector((s) => s.ui.toasts);
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}
