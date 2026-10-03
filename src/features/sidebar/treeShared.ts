import type { ContainerType } from '@/domain/types';
import type { IconName } from '@/components/ui/Icon';

export const TYPE_ICON: Record<ContainerType, IconName> = { workspace: 'space', space: 'space', folder: 'folder', list: 'list' };

/** Hover-revealed icon button on a tree row (also visible on keyboard focus / while its menu is open). */
export const ROW_ACTION =
  'flex h-6 w-6 items-center justify-center rounded text-ink-subtle opacity-0 hover:bg-surface-border hover:text-ink focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 group-hover:opacity-100 data-[open]:opacity-100';

/**
 * Tree rows are clickable and draggable. Controls inside a row (and their portalled menus/dialogs,
 * whose events still bubble through the React tree) must not trigger the row.
 */
export const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
