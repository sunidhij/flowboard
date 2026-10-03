import clsx from 'clsx';
import type { ReactNode } from 'react';

/**
 * CSS-only tooltip (Tailwind group-hover / group-focus), so no inline positioning styles are needed.
 * Shows on hover of the trigger, and on keyboard focus of the nearest `group` ancestor
 * (e.g. a focusable tree row). The content should also be exposed via an aria-label on the row.
 *
 * `anchor="container"` positions the bubble against the nearest positioned ancestor instead of the
 * trigger — use it inside narrow, clipped areas (the sidebar) so the bubble always stays in bounds
 * no matter where the trigger sits in the row.
 */
export function Tooltip({
  content,
  children,
  align = 'end',
  anchor = 'trigger',
}: {
  content: ReactNode;
  children: ReactNode;
  /** which edge the bubble lines up with */
  align?: 'start' | 'end';
  anchor?: 'trigger' | 'container';
}) {
  return (
    <span className={clsx('group/tip inline-flex', anchor === 'trigger' && 'relative')}>
      {children}
      <span
        role="tooltip"
        className={clsx(
          'pointer-events-none invisible absolute top-full z-50 mt-1.5 w-max max-w-[12rem] rounded-lg bg-slate-900 px-2.5 py-1.5',
          'text-center text-xs font-normal leading-snug text-white opacity-0 shadow-lift transition-opacity duration-100',
          'group-hover/tip:visible group-hover/tip:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100',
          align === 'end' ? (anchor === 'container' ? 'right-1' : 'right-0') : anchor === 'container' ? 'left-1' : 'left-0',
        )}
      >
        {content}
      </span>
    </span>
  );
}
