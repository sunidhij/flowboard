import clsx from 'clsx';
import { Icon } from '@/components/ui/Icon';

export function SortHeader({
  label,
  active,
  onClick,
  className,
}: {
  label: string;
  active: 'asc' | 'desc' | null;
  onClick: () => void;
  className?: string;
}) {
  return (
    <th scope="col" className={clsx('px-3 py-1.5', className)} aria-sort={active === 'asc' ? 'ascending' : active === 'desc' ? 'descending' : 'none'}>
      <button
        type="button"
        onClick={onClick}
        className={clsx(
          '-mx-1.5 inline-flex items-center gap-1 rounded px-1.5 py-1 uppercase tracking-wide transition-colors',
          'hover:bg-surface-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
          active && 'text-brand-700',
        )}
      >
        {label}
        <Icon name={active === 'asc' ? 'arrowUp' : active === 'desc' ? 'arrowDown' : 'sort'} className="h-3 w-3" />
      </button>
    </th>
  );
}
