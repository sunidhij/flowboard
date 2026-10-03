import clsx from 'clsx';
import { forwardRef, useMemo, useState, type HTMLAttributes } from 'react';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task } from '@/domain/types';
import { AvatarStack } from '@/components/ui/Avatar';
import { DueDate, PriorityBadge } from '@/components/ui/Badges';
import { Icon } from '@/components/ui/Icon';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAppDispatch } from '@/store/context';
import { drawerOpened } from '@/store/slices/uiSlice';
import { useDeleteTasks } from '../task/useDeleteTasks';
import { useSession } from '@/store/hooks';
import { selectSubtaskCounts } from '@/store/selectors';

/** Presentational card — shared by the sortable card and the drag overlay. */
export const TaskCardBody = forwardRef<HTMLDivElement, { task: Task; overlay?: boolean } & HTMLAttributes<HTMLDivElement>>(
  function TaskCardBody({ task, overlay, className, ...rest }, ref) {
    const { data } = useSession();
    const assignees = useMemo(() => task.assigneeIds.map((id) => data.users[id]!).filter(Boolean), [task.assigneeIds, data.users]);
    const subtasks = useMemo(() => selectSubtaskCounts(data, task.id), [data, task.id]);
    const done = data.statuses[task.statusId]?.category === 'done';

    return (
      <div
        ref={ref}
        className={clsx(
          'group rounded-card border border-surface-border bg-white p-3 text-left shadow-card transition-[box-shadow,border-color]',
          // no rotate/scale on the overlay: it skews the collision rect dnd-kit uses for keyboard moves
          overlay ? 'cursor-grabbing shadow-lift ring-2 ring-brand-400' : 'cursor-grab hover:border-slate-300 hover:shadow-lift',
          className,
        )}
        {...rest}
      >
        <p className={clsx('line-clamp-2 pr-6 text-[13px] font-medium leading-snug', done ? 'text-ink-muted line-through' : 'text-ink')}>
          {task.title}
        </p>
        <div className="mt-2.5 flex items-center gap-2">
          <PriorityBadge priority={task.priority} compact />
          {task.dueDate && <DueDate iso={task.dueDate} done={done} />}
          {subtasks.total > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-ink-muted" title={`${subtasks.done} of ${subtasks.total} subtasks done`}>
              <Icon name="subtask" className="h-3.5 w-3.5" />
              {subtasks.done}/{subtasks.total}
            </span>
          )}
          <span className="ml-auto">
            <AvatarStack users={assignees} size="xs" />
          </span>
        </div>
      </div>
    );
  },
);

export function SortableTaskCard({ task, showDropIndicator }: { task: Task; showDropIndicator: boolean }) {
  const dispatch = useAppDispatch();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task', statusId: task.statusId },
  });

  return (
    <div className="group/card relative">
      {showDropIndicator && <div className="absolute -top-1.5 left-1 right-1 h-0.5 rounded-full bg-brand-500" aria-hidden />}
      <TaskCardBody
        ref={setNodeRef}
        task={task}
        // dnd-kit requires inline transform/transition for drag movement (documented exception)
        style={{ transform: CSS.Translate.toString(transform), transition }}
        {...attributes}
        {...listeners}
        aria-roledescription="draggable task"
        aria-label={`${task.title}. Press Enter to open, Space to move.`}
        onClick={() => dispatch(drawerOpened({ mode: 'edit', taskId: task.id }))}
        onKeyDown={(e) => {
          listeners?.onKeyDown?.(e);
          if (e.key === 'Enter' && !isDragging) dispatch(drawerOpened({ mode: 'edit', taskId: task.id }));
        }}
        className={clsx(
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
          isDragging && 'border-dashed border-brand-300 bg-brand-50/60 opacity-50 shadow-none',
        )}
      />
      {/* sibling of the card (not a child) so menu / dialog clicks never reach the card's open & drag handlers */}
      {!isDragging && <TaskCardMenu task={task} />}
    </div>
  );
}

function TaskCardMenu({ task }: { task: Task }) {
  const dispatch = useAppDispatch();
  const deleteTasks = useDeleteTasks();
  const [confirm, setConfirm] = useState(false);
  const { data } = useSession();
  const subtaskCount = useMemo(() => selectSubtaskCounts(data, task.id).total, [data, task.id]);

  return (
    <>
      <Menu>
        <MenuButton
          aria-label={`Actions for ${task.title}`}
          className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md bg-white/90 text-ink-subtle opacity-0 transition-opacity hover:bg-surface-sunken hover:text-ink focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 group-hover/card:opacity-100 data-[open]:opacity-100"
        >
          <Icon name="dots" className="h-4 w-4" />
        </MenuButton>
        <MenuItems anchor="bottom end" className="z-40 w-40 rounded-lg border border-surface-border bg-white p-1 text-[13px] shadow-lift focus:outline-none">
          <MenuItem>
            <button
              type="button"
              onClick={() => dispatch(drawerOpened({ mode: 'edit', taskId: task.id }))}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-ink data-[focus]:bg-surface-muted"
            >
              <Icon name="pencil" className="h-4 w-4 text-ink-subtle" /> Edit
            </button>
          </MenuItem>
          <MenuItem>
            <button
              type="button"
              onClick={() => setConfirm(true)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-red-600 data-[focus]:bg-red-50"
            >
              <Icon name="trash" className="h-4 w-4" /> Delete
            </button>
          </MenuItem>
        </MenuItems>
      </Menu>
      <ConfirmDialog
        open={confirm}
        title="Delete this task?"
        description={`“${task.title}”${subtaskCount ? ` and its ${subtaskCount} subtask${subtaskCount === 1 ? '' : 's'}` : ''} will be removed. You can undo right after.`}
        confirmLabel="Delete task"
        onConfirm={() => deleteTasks([task])}
        onClose={() => setConfirm(false)}
      />
    </>
  );
}
