import clsx from 'clsx';
import type { User } from '@/domain/types';
import { AVATAR_BG } from './tokens';

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

const SIZES = { xs: 'h-5 w-5 text-[9px]', sm: 'h-6 w-6 text-[10px]', md: 'h-8 w-8 text-xs' } as const;

export function Avatar({ user, size = 'sm', className }: { user: User; size?: keyof typeof SIZES; className?: string }) {
  return (
    <span
      title={user.name}
      className={clsx(
        'inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white ring-2 ring-white',
        AVATAR_BG[user.avatarColor],
        SIZES[size],
        className,
      )}
    >
      {initials(user.name)}
    </span>
  );
}

export function AvatarStack({ users, max = 3, size = 'sm' }: { users: User[]; max?: number; size?: keyof typeof SIZES }) {
  if (users.length === 0) {
    return (
      <span
        title="Unassigned"
        className={clsx('inline-flex items-center justify-center rounded-full border border-dashed border-slate-300 text-ink-subtle', SIZES[size])}
      >
        <span className="sr-only">Unassigned</span>
      </span>
    );
  }
  const shown = users.slice(0, max);
  const extra = users.length - shown.length;
  return (
    <span className={clsx('flex', size === 'xs' ? '-space-x-1' : '-space-x-1.5')} aria-label={`Assigned to ${users.map((u) => u.name).join(', ')}`}>
      {shown.map((u) => (
        <Avatar key={u.id} user={u} size={size} />
      ))}
      {extra > 0 && (
        <span className={clsx('inline-flex items-center justify-center rounded-full bg-surface-sunken font-semibold text-ink-muted ring-2 ring-white', SIZES[size])}>
          +{extra}
        </span>
      )}
    </span>
  );
}
