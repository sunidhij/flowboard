import clsx from 'clsx';
import { differenceInCalendarDays, format, isToday, isTomorrow, isYesterday } from 'date-fns';
import type { Priority, Status } from '@/domain/types';
import { COLOR_DOT, COLOR_SOFT, PRIORITY_META } from './tokens';
import { Icon } from './Icon';

export function StatusPill({ status, className }: { status: Status | undefined; className?: string }) {
  if (!status) return null;
  return (
    <span
      className={clsx(
        'inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-pill px-2 text-xs font-medium ring-1 ring-inset',
        COLOR_SOFT[status.color],
        className,
      )}
    >
      <span className={clsx('h-1.5 w-1.5 rounded-full', COLOR_DOT[status.color])} />
      {status.name}
    </span>
  );
}

export function StatusDot({ status }: { status: Status }) {
  return <span className={clsx('h-2 w-2 shrink-0 rounded-full', COLOR_DOT[status.color])} />;
}

/** Signal-strength bars: same visual on cards, rows and the drawer. */
export function PriorityIcon({ priority, className }: { priority: Priority; className?: string }) {
  const meta = PRIORITY_META[priority];
  if (priority === 'urgent') {
    return (
      <span className={clsx('inline-flex h-3.5 w-3.5 items-center justify-center rounded-[3px] text-[10px] font-bold leading-none text-white', meta.bar, className)}>
        !
      </span>
    );
  }
  const level = { high: 3, normal: 2, low: 1, none: 0 }[priority];
  return (
    <span className={clsx('inline-flex h-3.5 w-3.5 items-end gap-[2px]', className)} aria-hidden>
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={clsx('w-[3px] rounded-sm', i <= level ? meta.bar : 'bg-slate-200', i === 1 ? 'h-1.5' : i === 2 ? 'h-2.5' : 'h-3.5')}
        />
      ))}
    </span>
  );
}

export function PriorityBadge({ priority, compact }: { priority: Priority; compact?: boolean }) {
  const meta = PRIORITY_META[priority];
  if (compact && priority === 'none') return null;
  return (
    <span
      className={clsx(
        'inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-md px-1.5 text-xs font-medium ring-1 ring-inset',
        meta.soft,
        priority === 'none' ? 'text-ink-subtle' : 'text-ink',
      )}
      title={`Priority: ${meta.label}`}
    >
      <PriorityIcon priority={priority} />
      {meta.label}
    </span>
  );
}

export function dueLabel(iso: string, now = new Date()) {
  const d = new Date(iso);
  if (isToday(d)) return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, differenceInCalendarDays(d, now) > 300 ? 'MMM d, yyyy' : 'MMM d');
}

export function DueDate({ iso, done, className }: { iso?: string; done?: boolean; className?: string }) {
  if (!iso) return <span className={clsx('text-xs text-ink-subtle', className)}>—</span>;
  const days = differenceInCalendarDays(new Date(iso), new Date());
  const overdue = !done && days < 0;
  const soon = !done && days >= 0 && days <= 1;
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium',
        overdue ? 'text-red-600' : soon ? 'text-amber-700' : 'text-ink-muted',
        className,
      )}
      title={`${overdue ? 'Overdue · ' : ''}Due ${format(new Date(iso), 'PPP')}`}
    >
      <Icon name="calendar" className="h-3.5 w-3.5" />
      {dueLabel(iso)}
    </span>
  );
}
