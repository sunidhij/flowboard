import clsx from 'clsx';
import type { ReactNode } from 'react';
import type { AppError } from '@/domain/errors';
import { Icon, type IconName } from './Icon';

export function EmptyState({
  icon = 'list',
  title,
  description,
  action,
  compact,
}: {
  icon?: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={clsx('flex flex-col items-center justify-center text-center', compact ? 'gap-1.5 px-3 py-6' : 'gap-3 px-6 py-16')}>
      <span className={clsx('flex items-center justify-center rounded-xl bg-surface-sunken text-ink-subtle', compact ? 'h-8 w-8' : 'h-12 w-12')}>
        <Icon name={icon} className={compact ? 'h-4 w-4' : 'h-6 w-6'} />
      </span>
      <div>
        <p className={clsx('font-medium text-ink', compact ? 'text-xs' : 'text-sm')}>{title}</p>
        {description && <p className={clsx('mt-1 text-ink-muted', compact ? 'text-xs' : 'text-sm')}>{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorBanner({ error, action, className }: { error: AppError; action?: ReactNode; className?: string }) {
  const isForbidden = error.code === 'FORBIDDEN';
  return (
    <div
      role="alert"
      className={clsx(
        'flex items-start gap-3 rounded-card border px-4 py-3',
        isForbidden ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-red-200 bg-red-50 text-red-900',
        className,
      )}
    >
      <Icon name={isForbidden ? 'lock' : 'alert'} className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">
          {isForbidden ? 'Access denied' : error.code === 'CONFLICT' ? 'This task changed' : 'Something went wrong'}
        </p>
        <p className="mt-0.5 text-sm opacity-90">{error.message}</p>
      </div>
      {action}
    </div>
  );
}
