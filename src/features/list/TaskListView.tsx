import clsx from 'clsx';
import { useMemo, useState } from 'react';
import type { ID } from '@/domain/types';
import { AvatarStack } from '@/components/ui/Avatar';
import { DueDate, PriorityBadge, StatusPill } from '@/components/ui/Badges';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { useAppDispatch } from '@/store/context';
import { drawerOpened } from '@/store/slices/uiSlice';
import { useListTasks, useListView, useSession } from '@/store/hooks';
import { BulkActionBar } from './BulkActionBar';
import { SortHeader } from './SortHeader';
import { nextSort, sortTasks, type Sort, type SortKey } from './sortTasks';
import { useSelection } from './useSelection';

const PAGE_SIZE = 12;

/** Dense table view: sortable by priority / due date, paginated, with multi-select bulk delete. */
export function TaskListView({ listId }: { listId: ID }) {
  const view = useListView(listId);
  const tasks = useListTasks(listId);
  const { data } = useSession();
  const dispatch = useAppDispatch();
  const [sort, setSort] = useState<Sort>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const statusOrder = useMemo(
    () => new Map(view.ok ? view.data.statuses.map((s, i) => [s.id, i] as const) : []),
    [view],
  );
  const sorted = useMemo(() => (tasks.ok ? sortTasks(tasks.data, statusOrder, sort) : []), [tasks, statusOrder, sort]);
  const selection = useSelection(sorted);

  if (!view.ok || !tasks.ok) return null;

  if (sorted.length === 0) {
    return (
      <EmptyState
        icon="list"
        title="This list is empty"
        description="Create the first task to get started."
        action={
          <Button variant="primary" onClick={() => dispatch(drawerOpened({ mode: 'create', listId }))}>
            <Icon name="plus" className="h-4 w-4" /> New task
          </Button>
        }
      />
    );
  }

  const page = sorted.slice(0, visible);
  const pageState = selection.stateOf(page);
  const sortDir = (key: SortKey) => (sort?.key === key ? sort.dir : null);

  return (
    <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-5">
      <BulkActionBar selected={selection.selected} onClear={selection.clear} />
      <div className="overflow-hidden rounded-xl border border-surface-border bg-white shadow-card">
        {/* relative: absolutely-positioned descendants (sr-only labels) must stay inside the scroller */}
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[720px] table-fixed text-left text-[13px]">
            <thead className="border-b border-surface-border bg-surface-muted text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
              <tr>
                <th scope="col" className="w-11 py-2.5 pl-4">
                  <input
                    type="checkbox"
                    aria-label={pageState.all ? 'Deselect all tasks' : 'Select all tasks'}
                    checked={pageState.all}
                    ref={(el) => {
                      if (el) el.indeterminate = pageState.some;
                    }}
                    onChange={() => selection.toggleAll(page)}
                    className="h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                </th>
                <th scope="col" className="w-[42%] px-3 py-2.5">Title</th>
                <th scope="col" className="w-[16%] px-3 py-2.5">Status</th>
                <th scope="col" className="w-[12%] px-3 py-2.5">Assignees</th>
                <SortHeader label="Priority" active={sortDir('priority')} onClick={() => setSort((s) => nextSort(s, 'priority'))} className="w-[14%]" />
                <SortHeader label="Due date" active={sortDir('dueDate')} onClick={() => setSort((s) => nextSort(s, 'dueDate'))} className="w-[14%]" />
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {page.map((task) => {
                const status = data.statuses[task.statusId];
                const done = status?.category === 'done';
                const isPicked = selection.isSelected(task.id);
                return (
                  <tr
                    key={task.id}
                    aria-selected={isPicked}
                    onClick={() => dispatch(drawerOpened({ mode: 'edit', taskId: task.id }))}
                    className={clsx(
                      'group cursor-pointer transition-colors active:bg-brand-50',
                      isPicked ? 'bg-brand-50/70 hover:bg-brand-50' : 'hover:bg-brand-50/40',
                    )}
                  >
                    <td className="py-2.5 pl-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${task.title}`}
                        checked={isPicked}
                        onChange={() => selection.toggle(task.id)}
                        className="h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        className={clsx(
                          'block max-w-full truncate rounded text-left font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                          done ? 'text-ink-muted line-through group-hover:text-brand-700' : 'text-ink group-hover:text-brand-700',
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          dispatch(drawerOpened({ mode: 'edit', taskId: task.id }));
                        }}
                      >
                        {task.title}
                      </button>
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusPill status={status} />
                    </td>
                    <td className="px-3 py-2.5">
                      <AvatarStack users={task.assigneeIds.map((id) => data.users[id]!).filter(Boolean)} size="xs" />
                    </td>
                    <td className="px-3 py-2.5">
                      <PriorityBadge priority={task.priority} />
                    </td>
                    <td className="px-3 py-2.5">
                      <DueDate iso={task.dueDate} done={done} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-surface-border bg-surface-muted px-4 py-2 text-xs text-ink-muted">
          <span>
            Showing {page.length} of {sorted.length} tasks
          </span>
          {visible < sorted.length && (
            <Button size="sm" variant="ghost" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
              Load more
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
