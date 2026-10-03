import clsx from 'clsx';
import { useEffect, useId, useRef, useState } from 'react';
import { CONTAINER_NAME_MAX } from '@/domain/types';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';

/** Small text field for creating/renaming tree nodes. Enter saves, Escape / blur-with-no-change cancels. */
export function InlineNameInput({
  initial = '',
  placeholder,
  onSubmit,
  onCancel,
  className,
}: {
  initial?: string;
  placeholder: string;
  /** resolve with an error message to keep the field open */
  onSubmit: (name: string) => Promise<string | null>;
  onCancel: () => void;
  className?: string;
}) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const errorId = useId();

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const submit = async () => {
    if (busy) return;
    if (value.trim() === initial.trim()) return onCancel();
    setBusy(true);
    const err = await onSubmit(value);
    setBusy(false);
    if (err) {
      setError(err);
      ref.current?.focus();
    }
  };

  return (
    <div className={clsx('py-0.5', className)}>
      <div className="relative">
        <input
          ref={ref}
          value={value}
          maxLength={CONTAINER_NAME_MAX + 20}
          placeholder={placeholder}
          aria-label={placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          disabled={busy}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') {
              e.stopPropagation();
              onCancel();
            }
          }}
          onBlur={() => {
            if (!value.trim()) onCancel();
          }}
          className={clsx(
            'h-7 w-full rounded-md border bg-white px-2 pr-7 text-[13px] text-ink outline-none',
            error ? 'border-red-400 ring-2 ring-red-100' : 'border-brand-400 ring-2 ring-brand-100',
          )}
        />
        {busy && <Spinner className="absolute right-2 top-1.5 h-4 w-4 text-ink-subtle" />}
        {error && !busy && (
          <button
            type="button"
            aria-label="Cancel"
            title="Cancel"
            // × in the error state discards the edit entirely (same as Escape)
            onMouseDown={(e) => e.preventDefault()}
            onClick={onCancel}
            className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded text-red-500 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            <Icon name="x" className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-[11px] text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
