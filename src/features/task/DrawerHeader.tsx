import type { ReactNode } from 'react';
import { DialogTitle } from '@headlessui/react';
import { IconButton } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';

export function DrawerHeader({ title, onClose, children }: { title: string; onClose: () => void; children?: ReactNode }) {
  return (
    <div className="flex h-14 shrink-0 items-center gap-2 border-b border-surface-border px-4 sm:px-5">
      <DialogTitle className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{title}</DialogTitle>
      {children}
      <IconButton label="Close (Esc)" onClick={onClose}>
        <Icon name="x" className="h-4 w-4" />
      </IconButton>
    </div>
  );
}
