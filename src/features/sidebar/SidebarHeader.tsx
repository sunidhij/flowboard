import { IconButton } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';

/** Logo + product name — shared by the sidebar and its skeleton so nothing shifts on load. */
export function SidebarHeader({ onClose, desktop }: { onClose?: () => void; desktop?: boolean }) {
  return (
    <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-surface-border px-4">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-white shadow-card">
        <Icon name="board" className="h-4 w-4" />
      </span>
      <p className="flex-1 text-sm font-bold tracking-tight text-ink">Flowboard</p>
      {onClose && (
        <IconButton label={desktop ? 'Collapse sidebar' : 'Close menu'} onClick={onClose}>
          <Icon name={desktop ? 'collapseLeft' : 'x'} className="h-4 w-4" />
        </IconButton>
      )}
    </div>
  );
}

export const SpacesLabel = () => <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Spaces</span>;
