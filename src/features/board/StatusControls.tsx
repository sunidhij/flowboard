import clsx from 'clsx';
import { useMemo, useState } from 'react';
import { Menu, MenuButton, MenuItem, MenuItems, MenuSeparator } from '@headlessui/react';
import { COLOR_TOKENS, STATUS_CATEGORIES, STATUS_NAME_MAX, type ColorToken, type ID, type Status, type StatusCategory } from '@/domain/types';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Select } from '@/components/ui/Select';
import { Icon } from '@/components/ui/Icon';
import { COLOR_DOT } from '@/components/ui/tokens';
import { useApi, useAppDispatch } from '@/store/context';
import { moveStatus } from '@/store/thunks';
import { useNotify, useSession } from '@/store/hooks';
import { CATEGORY_NAME, fallbackStatus } from '@/store/mutations/statuses';

export function ColorSwatches({ value, onChange, size = 'md' }: { value: ColorToken; onChange: (c: ColorToken) => void; size?: 'sm' | 'md' }) {
  return (
    <div role="radiogroup" aria-label="Color" className="flex flex-wrap gap-1.5">
      {COLOR_TOKENS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={c}
          onClick={() => onChange(c)}
          className={clsx(
            'rounded-full ring-offset-2 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
            size === 'sm' ? 'h-4 w-4' : 'h-5 w-5',
            COLOR_DOT[c],
            value === c ? 'ring-2 ring-ink' : 'hover:ring-2 hover:ring-slate-300',
          )}
        />
      ))}
    </div>
  );
}

/** Column header "⋯" for admins: rename, color, move, delete. */
export function StatusMenu({
  status,
  index,
  count,
  onRename,
}: {
  status: Status;
  index: number;
  count: number;
  onRename: () => void;
}) {
  const { data } = useSession();
  const api = useApi();
  const notify = useNotify();
  const dispatch = useAppDispatch();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fallback = useMemo(() => fallbackStatus(data, status.id), [data, status.id]);
  const taskCount = useMemo(
    () => Object.values(data.tasks).filter((t) => t.statusId === status.id && !t.archivedAt).length,
    [data.tasks, status.id],
  );

  const itemClass = 'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-ink data-[focus]:bg-surface-muted data-[disabled]:cursor-not-allowed data-[disabled]:text-ink-subtle';

  return (
    <>
      <Menu>
        <MenuButton
          aria-label={`Status options for ${status.name}`}
          className="flex h-6 w-6 items-center justify-center rounded text-ink-subtle hover:bg-white hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 data-[open]:bg-white"
        >
          <Icon name="dots" className="h-4 w-4" />
        </MenuButton>
        <MenuItems anchor="bottom end" className="z-40 w-56 rounded-lg border border-surface-border bg-white p-1 text-[13px] shadow-lift focus:outline-none">
          <MenuItem>
            <button type="button" onClick={onRename} className={itemClass}>
              <Icon name="pencil" className="h-4 w-4 text-ink-subtle" /> Rename
            </button>
          </MenuItem>
          <div className="px-2 py-2">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Color</p>
            <ColorSwatches
              size="sm"
              value={status.color}
              onChange={async (color) => notify(await api.updateStatus({ id: status.id, color }))}
            />
          </div>
          <MenuSeparator className="my-1 h-px bg-surface-border" />
          <MenuItem disabled={index === 0}>
            <button type="button" onClick={() => notify(dispatch(moveStatus({ id: status.id, toIndex: index - 1 })))} className={itemClass}>
              <Icon name="chevronRight" className="h-4 w-4 rotate-180 text-ink-subtle" /> Move left
            </button>
          </MenuItem>
          <MenuItem disabled={index === count - 1}>
            <button type="button" onClick={() => notify(dispatch(moveStatus({ id: status.id, toIndex: index + 1 })))} className={itemClass}>
              <Icon name="chevronRight" className="h-4 w-4 text-ink-subtle" /> Move right
            </button>
          </MenuItem>
          <MenuSeparator className="my-1 h-px bg-surface-border" />
          <MenuItem disabled={!fallback}>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className={clsx(itemClass, fallback && 'text-red-600 data-[focus]:bg-red-50')}
            >
              <Icon name="trash" className="h-4 w-4" /> Delete status
            </button>
          </MenuItem>
          {!fallback && (
            <p className="px-2 pb-1.5 text-[11px] leading-snug text-ink-subtle">
              Every list needs at least one “{CATEGORY_NAME[status.category]}” status.
            </p>
          )}
        </MenuItems>
      </Menu>
      {fallback && (
        <ConfirmDialog
          open={confirmDelete}
          title={`Delete “${status.name}”?`}
          description={
            taskCount > 0
              ? `${taskCount} task${taskCount === 1 ? '' : 's'} will move to “${fallback.name}”.`
              : 'This column is empty. No tasks will be affected.'
          }
          confirmLabel="Delete status"
          onConfirm={async () =>
            notify(await api.deleteStatus({ id: status.id }), (v) => ({
              kind: 'success',
              message: `Status “${v.status.name}” deleted${v.movedCount ? ` — ${v.movedCount} task${v.movedCount === 1 ? '' : 's'} moved to “${v.movedTo.name}”` : ''}`,
            }))
          }
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}

/** Trailing board column for admins to add a status. */
export function AddStatusColumn({ listId }: { listId: ID }) {
  const api = useApi();
  const notify = useNotify();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<StatusCategory>('in_progress');
  const [color, setColor] = useState<ColorToken>('blue');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setOpen(false);
    setName('');
    setCategory('in_progress');
    setColor('blue');
    setError(null);
  };

  const submit = async () => {
    setSaving(true);
    const r = await api.createStatus({ listId, name, category, color });
    setSaving(false);
    if (!r.ok) return setError(r.error.fields?.name ?? r.error.message);
    notify(r, (s) => ({ kind: 'success', message: `Status “${s.name}” added` }));
    reset();
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-11 w-60 shrink-0 items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-surface-border text-[13px] font-medium text-ink-muted transition-colors hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <Icon name="plus" className="h-4 w-4" /> Add status
      </button>
    );
  }

  return (
    <form
      aria-label="Add status"
      className="w-64 shrink-0 space-y-3 self-start rounded-xl border border-surface-border bg-white p-3 shadow-card"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      onKeyDown={(e) => e.key === 'Escape' && reset()}
    >
      <div>
        <label htmlFor="new-status-name" className="mb-1 block text-xs font-semibold text-ink-muted">
          Name
        </label>
        <input
          id="new-status-name"
          autoFocus
          value={name}
          maxLength={STATUS_NAME_MAX + 10}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          placeholder="e.g. In review"
          aria-invalid={Boolean(error)}
          className={clsx(
            'h-8 w-full rounded-md border px-2 text-[13px] text-ink outline-none focus:ring-2',
            error ? 'border-red-400 focus:ring-red-100' : 'border-surface-border focus:border-brand-400 focus:ring-brand-100',
          )}
        />
        {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
      </div>
      <div>
        <label htmlFor="new-status-category" className="mb-1 block text-xs font-semibold text-ink-muted">
          Category
        </label>
        <Select id="new-status-category" size="sm" value={category} onChange={(e) => setCategory(e.target.value as StatusCategory)}>
          {STATUS_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_NAME[c]}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-semibold text-ink-muted">Color</p>
        <ColorSwatches value={color} onChange={setColor} />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button size="sm" onClick={reset} disabled={saving}>
          Cancel
        </Button>
        <Button size="sm" type="submit" variant="primary" loading={saving}>
          Add status
        </Button>
      </div>
    </form>
  );
}
