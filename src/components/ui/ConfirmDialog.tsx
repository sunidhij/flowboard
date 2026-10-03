import { Dialog, DialogPanel, DialogTitle, Description } from '@headlessui/react';
import { useState } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  tone?: 'danger' | 'primary';
  onConfirm: () => Promise<unknown> | void;
  onClose: () => void;
}

export function ConfirmDialog({ open, title, description, confirmLabel, tone = 'danger', onConfirm, onClose }: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={() => !busy && onClose()} className="relative z-50">
      <div className="fixed inset-0 bg-slate-900/30" aria-hidden />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-sm animate-slide-in rounded-xl bg-white p-5 shadow-lift">
          <div className="flex gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
              <Icon name="alert" className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle className="text-base font-semibold text-ink">{title}</DialogTitle>
              <Description className="mt-1 text-sm text-ink-muted">{description}</Description>
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button onClick={onClose} disabled={busy} autoFocus>
              Cancel
            </Button>
            <Button variant={tone} onClick={confirm} loading={busy}>
              {confirmLabel}
            </Button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
