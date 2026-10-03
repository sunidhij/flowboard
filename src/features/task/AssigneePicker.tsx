import clsx from 'clsx';
import { useMemo, useRef, useState } from 'react';
import { Combobox, ComboboxButton, ComboboxInput, ComboboxOption, ComboboxOptions } from '@headlessui/react';
import type { ID, User } from '@/domain/types';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';

/**
 * Typeable multi-select for assignees (Headless UI Combobox, `multiple`).
 * Selected people render as removable chips; typing filters the list; Backspace on an
 * empty query removes the last chip.
 */
export function AssigneePicker({
  id,
  users,
  value,
  onChange,
  disabled,
  invalid,
}: {
  id: string;
  users: User[];
  value: ID[];
  onChange: (ids: ID[]) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  /** open the list if it's closed — focus alone doesn't reopen it after Escape / a pick */
  const ensureOpen = () => {
    const input = inputRef.current;
    if (!input) return;
    if (document.activeElement !== input) input.focus(); // `immediate` opens on focus
    else if (input.getAttribute('aria-expanded') !== 'true') buttonRef.current?.click();
  };
  const byId = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const selected = value.map((uid) => byId.get(uid)).filter((u): u is User => Boolean(u));
  const q = query.trim().toLowerCase();
  // people already assigned only appear as chips, not in the list
  const available = users.filter((u) => !value.includes(u.id));
  const filtered = q ? available.filter((u) => u.name.toLowerCase().includes(q)) : available;
  const remove = (uid: ID) => onChange(value.filter((x) => x !== uid));

  return (
    <Combobox
      multiple
      immediate // open on focus / click — no need to aim for the arrow
      value={value}
      onChange={(ids: ID[]) => {
        onChange(ids);
        setQuery('');
      }}
      onClose={() => setQuery('')}
      disabled={disabled}
    >
      {({ open }) => (
        <div className="relative">
          <div
            // clicking anywhere in the field (not just on the text) focuses the input, which opens the list
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                e.preventDefault();
                ensureOpen();
              }
            }}
            className={clsx(
              'relative flex min-h-9 w-full cursor-text flex-wrap items-center gap-1 rounded-lg border bg-white py-1 pl-1.5 pr-8 transition-colors',
              'focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100',
              invalid ? 'border-red-400' : 'border-surface-border',
              disabled && 'cursor-not-allowed bg-surface-muted',
            )}
          >
            {selected.map((u) => (
              <span
                key={u.id}
                className="inline-flex h-7 items-center gap-1 rounded-pill bg-brand-50 py-0.5 pl-0.5 pr-0.5 text-xs font-medium text-brand-800 ring-1 ring-inset ring-brand-200"
              >
                <Avatar user={u} size="sm" className="ring-0" />
                <span className="pl-0.5">{u.name}</span>
                <button
                  type="button"
                  aria-label={`Remove ${u.name}`}
                  title={`Remove ${u.name}`}
                  disabled={disabled}
                  onMouseDown={(e) => e.preventDefault()} // don't steal focus / toggle the list
                  onClick={() => remove(u.id)}
                  className="flex h-5 w-5 items-center justify-center rounded-full text-brand-500 hover:bg-brand-200 hover:text-brand-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  <Icon name="x" className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
            <ComboboxInput
              ref={inputRef}
              id={id}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onClick={ensureOpen}
              onKeyDown={(e) => {
                if (e.key === 'Backspace' && !query && value.length) remove(value[value.length - 1]!);
                // Enter with nothing to pick: keep the list (and its empty state) open,
                // and never let Enter submit the surrounding task form
                if (e.key === 'Enter' && (!open || filtered.length === 0)) e.preventDefault();
              }}
              placeholder={selected.length ? 'Add more…' : 'Type a name to assign…'}
              className="h-7 min-w-[8rem] flex-1 bg-transparent px-1 text-sm text-ink outline-none placeholder:text-ink-subtle"
            />
            <ComboboxButton ref={buttonRef} aria-label="Show people" className="absolute inset-y-0 right-0 flex w-8 items-center justify-center text-ink-subtle hover:text-ink">
              <Icon name="chevronDown" className={clsx('h-4 w-4 transition-transform', open && 'rotate-180')} />
            </ComboboxButton>
          </div>

          {/* no portal: positioned under the field and stretched to its full width */}
          <ComboboxOptions className="absolute inset-x-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-surface-border bg-white p-1 shadow-lift focus:outline-none">
            {filtered.length === 0 ? (
              <div role="status" className="px-2.5 py-2 text-sm text-ink-muted">
                {q ? `No people match “${query.trim()}”` : 'Everyone is already assigned'}
              </div>
            ) : (
              filtered.map((u) => (
                <ComboboxOption
                  key={u.id}
                  value={u.id}
                  className="cursor-pointer truncate rounded-md px-2.5 py-1.5 text-sm text-ink data-[focus]:bg-surface-muted"
                >
                  {u.name}
                </ComboboxOption>
              ))
            )}
          </ComboboxOptions>
        </div>
      )}
    </Combobox>
  );
}
