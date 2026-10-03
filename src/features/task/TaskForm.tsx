import clsx from 'clsx';
import { format } from 'date-fns';
import type { ReactNode } from 'react';
import { PRIORITIES, TITLE_MAX, type Status, type User } from '@/domain/types';
import type { TaskFields } from '@/domain/validators';
import { PriorityIcon } from '@/components/ui/Badges';
import { PRIORITY_META } from '@/components/ui/tokens';
import { Select } from '@/components/ui/Select';
import { AssigneePicker } from './AssigneePicker';

export type FormState = Omit<TaskFields, 'parentTaskId'>;

const inputBase =
  'w-full rounded-lg border bg-white px-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-subtle focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:bg-surface-muted';

/**
 * `group` fields (button groups) are labelled via aria-labelledby on `${htmlFor}-label` instead of <label for>.
 * `required` shows a red asterisk next to the label (hidden from screen readers — the control itself
 * carries `aria-required`, so the label's accessible name stays just the field name).
 */
export function Field({
  label,
  htmlFor,
  error,
  children,
  hint,
  group,
  required,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: ReactNode;
  group?: boolean;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="flex items-baseline gap-0.5">
          {group ? (
            <span id={`${htmlFor}-label`} className="text-xs font-semibold text-ink-muted">
              {label}
            </span>
          ) : (
            <label htmlFor={htmlFor} className="text-xs font-semibold text-ink-muted">
              {label}
            </label>
          )}
          {required && (
            <span aria-hidden className="text-xs font-semibold text-red-500" title="Required">
              *
            </span>
          )}
        </span>
        {hint}
      </div>
      {children}
      {error && (
        <p id={`${htmlFor}-error`} className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

/** ISO ↔ <input type="date"> (local date). Due dates are stored as end-of-day local time. */
export const toDateInput = (iso?: string) => (iso ? format(new Date(iso), 'yyyy-MM-dd') : '');
export const fromDateInput = (value: string) => {
  if (!value) return undefined;
  const d = new Date(`${value}T17:00:00`);
  return Number.isNaN(d.getTime()) ? value : d.toISOString();
};

export function TaskForm({
  form,
  onChange,
  statuses,
  users,
  errors,
  disabled,
}: {
  form: FormState;
  onChange: (patch: Partial<FormState>) => void;
  statuses: Status[];
  users: User[];
  errors: Record<string, string>;
  disabled?: boolean;
}) {
  const titleLength = form.title.trim().length;
  return (
    <div className="space-y-5">
      <Field
        label="Title"
        htmlFor="task-title"
        required
        error={errors.title}
        hint={
          <span className={clsx('text-[11px] tabular-nums', titleLength > TITLE_MAX ? 'font-semibold text-red-600' : 'text-ink-subtle')}>
            {titleLength}/{TITLE_MAX}
          </span>
        }
      >
        <textarea
          id="task-title"
          aria-required="true"
          data-autofocus
          rows={2}
          value={form.title}
          disabled={disabled}
          placeholder="What needs to be done?"
          aria-invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? 'task-title-error' : undefined}
          onChange={(e) => onChange({ title: e.target.value })}
          className={clsx(inputBase, 'resize-none py-2 text-[15px] font-medium', errors.title ? 'border-red-400' : 'border-surface-border')}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Status" htmlFor="task-status" required error={errors.statusId}>
          <Select id="task-status" aria-required="true" value={form.statusId} disabled={disabled} onChange={(e) => onChange({ statusId: e.target.value })}>
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Due date" htmlFor="task-due" error={errors.dueDate}>
          <input
            id="task-due"
            type="date"
            value={toDateInput(form.dueDate)}
            disabled={disabled}
            onChange={(e) => onChange({ dueDate: fromDateInput(e.target.value) })}
            className={clsx(inputBase, 'h-9', errors.dueDate ? 'border-red-400' : 'border-surface-border')}
          />
        </Field>
      </div>

      <Field label="Priority" htmlFor="task-priority" group error={errors.priority}>
        <div role="radiogroup" aria-labelledby="task-priority-label" className="flex flex-wrap gap-1.5">
          {PRIORITIES.map((p) => {
            const selected = form.priority === p;
            return (
              <button
                key={p}
                id={`task-priority-${p}`}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                onClick={() => onChange({ priority: p })}
                className={clsx(
                  'inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium ring-1 ring-inset transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                  selected ? 'bg-brand-50 text-brand-800 ring-brand-300' : 'bg-white text-ink-muted ring-surface-border hover:bg-surface-muted hover:text-ink',
                )}
              >
                <PriorityIcon priority={p} />
                {PRIORITY_META[p].label}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Assignees" htmlFor="task-assignees" error={errors.assigneeIds}>
        <AssigneePicker
          id="task-assignees"
          users={users}
          value={form.assigneeIds}
          onChange={(assigneeIds) => onChange({ assigneeIds })}
          disabled={disabled}
          invalid={Boolean(errors.assigneeIds)}
        />
      </Field>

      <Field label="Description" htmlFor="task-description" error={errors.description}>
        <textarea
          id="task-description"
          rows={5}
          value={form.description ?? ''}
          disabled={disabled}
          placeholder="Add more detail…"
          onChange={(e) => onChange({ description: e.target.value })}
          className={clsx(inputBase, 'resize-y py-2 leading-relaxed', errors.description ? 'border-red-400' : 'border-surface-border')}
        />
      </Field>
    </div>
  );
}
