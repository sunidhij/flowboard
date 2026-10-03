import clsx from 'clsx';
import { useState } from 'react';
import type { Data, ID, Task } from '@/domain/types';
import type { SubtaskChanges } from '@/store/mutations/tasks';
import { IconButton } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';

/**
 * Subtasks as part of the task form: ticking, adding and removing are staged locally
 * (so Save / Discard apply to them like any other field) and sent with the save call,
 * which applies everything atomically.
 */
export interface SubtaskDraft {
  /** stable React key */
  key: string;
  /** undefined for subtasks that don't exist yet */
  id?: ID;
  title: string;
  done: boolean;
}

export const draftsFrom = (data: Data, subtasks: Task[]): SubtaskDraft[] =>
  subtasks.map((s) => ({ key: s.id, id: s.id, title: s.title, done: data.statuses[s.statusId]?.category === 'done' }));

/** What changed between the subtasks the form started with and the current drafts. */
export function diffSubtasks(initial: SubtaskDraft[], current: SubtaskDraft[]): SubtaskChanges {
  const currentIds = new Set(current.map((d) => d.id).filter(Boolean));
  const before = new Map(initial.map((d) => [d.id, d]));
  return {
    remove: initial.filter((d) => d.id && !currentIds.has(d.id)).map((d) => d.id!),
    setDone: current.filter((d) => d.id && before.get(d.id)?.done !== d.done).map((d) => ({ id: d.id!, done: d.done })),
    add: current.filter((d) => !d.id).map((d) => d.title),
  };
}

export const hasSubtaskChanges = (c: SubtaskChanges) =>
  Boolean(c.add?.length || c.remove?.length || c.setDone?.length);

let draftSeq = 0;

export function SubtaskEditor({
  items,
  onChange,
  error,
  disabled,
}: {
  items: SubtaskDraft[];
  onChange: (items: SubtaskDraft[]) => void;
  error?: string;
  disabled?: boolean;
}) {
  const [title, setTitle] = useState('');
  const done = items.filter((d) => d.done).length;

  const add = () => {
    const t = title.trim();
    if (!t) return;
    onChange([...items, { key: `draft-${++draftSeq}`, title: t, done: false }]);
    setTitle('');
  };

  return (
    <section aria-labelledby="subtasks-heading">
      <h3 id="subtasks-heading" className="mb-2 text-xs font-semibold text-ink-muted">
        Subtasks{' '}
        {items.length > 0 && (
          <span className="font-normal text-ink-subtle">
            · {done}/{items.length} done
          </span>
        )}
      </h3>
      <ul className={clsx('divide-y divide-surface-border rounded-lg border', error ? 'border-red-300' : 'border-surface-border')}>
        {items.map((item) => (
          <li key={item.key} className="group flex items-center gap-2.5 px-3 py-2 hover:bg-surface-muted">
            <input
              type="checkbox"
              checked={item.done}
              disabled={disabled}
              onChange={() => onChange(items.map((d) => (d.key === item.key ? { ...d, done: !d.done } : d)))}
              aria-label={`Mark “${item.title}” as ${item.done ? 'not done' : 'done'}`}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span className={clsx('min-w-0 flex-1 truncate text-sm', item.done ? 'text-ink-subtle' : 'text-ink')}>{item.title}</span>
            {!item.id && <span className="rounded bg-brand-50 px-1.5 text-[10px] font-semibold uppercase text-brand-700">New</span>}
            <IconButton
              label={`Remove subtask ${item.title}`}
              disabled={disabled}
              className="h-6 w-6 opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
              onClick={() => onChange(items.filter((d) => d.key !== item.key))}
            >
              <Icon name="x" className="h-3.5 w-3.5" />
            </IconButton>
          </li>
        ))}
        <li className="flex items-center gap-2 px-3 py-1.5">
          <Icon name="plus" className="h-4 w-4 text-ink-subtle" />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault(); // don't submit the whole form
                add();
              }
            }}
            onBlur={add}
            disabled={disabled}
            placeholder="Add a subtask and press Enter"
            aria-label="New subtask title"
            className="h-7 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-subtle"
          />
        </li>
      </ul>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </section>
  );
}
