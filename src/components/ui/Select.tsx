import clsx from 'clsx';
import { forwardRef, type SelectHTMLAttributes } from 'react';
import { Icon } from './Icon';

/**
 * Native <select> (keeps keyboard + screen-reader behaviour) with the browser arrow hidden
 * (`appearance-none`) and our own chevron drawn inside the field — native arrows render
 * inconsistently (e.g. Safari ignores padding and pushes the arrow outside the box).
 */
type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> & { size?: 'sm' | 'md'; wrapperClassName?: string };

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ className, wrapperClassName, size = 'md', children, ...rest }, ref) {
    return (
      <div className={clsx('relative min-w-0', wrapperClassName)}>
        <select
          ref={ref}
          className={clsx(
            'w-full min-w-0 appearance-none truncate rounded-lg border border-surface-border bg-white pl-3 pr-9 text-ink outline-none transition-colors',
            'focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-subtle',
            size === 'sm' ? 'h-8 text-[13px]' : 'h-9 text-sm',
            className,
          )}
          {...rest}
        >
          {children}
        </select>
        <Icon
          name="chevronDown"
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle"
        />
      </div>
    );
  },
);
