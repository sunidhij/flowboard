import clsx from 'clsx';
import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { ID, Status, Task } from '@/domain/types';
import { StatusDot } from '@/components/ui/Badges';
import { IconButton } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useApi, useAppDispatch } from '@/store/context';
import { drawerOpened } from '@/store/slices/uiSlice';
import { InlineNameInput } from '@/components/ui/InlineNameInput';
import { StatusMenu } from './StatusControls';
import { SortableTaskCard } from './TaskCard';

export function KanbanColumn({
  listId,
  status,
  tasks,
  isDropTarget,
  dropBeforeId,
  index,
  count,
  canManage,
}: {
  listId: ID;
  status: Status;
  tasks: Task[];
  /** position among the list's statuses (for move left / right) */
  index: number;
  count: number;
  /** admins can configure statuses */
  canManage: boolean;
  /** a card from another column is hovering this column */
  isDropTarget: boolean;
  /** show an insertion line above this card */
  dropBeforeId: ID | null;
}) {
  const dispatch = useAppDispatch();
  const api = useApi();
  const [renaming, setRenaming] = useState(false);
  const { setNodeRef } = useDroppable({ id: `column:${status.id}`, data: { type: 'column', statusId: status.id } });

  return (
    <section
      aria-label={`${status.name} column, ${tasks.length} tasks`}
      className={clsx(
        'flex max-h-full w-[min(18rem,85vw)] shrink-0 flex-col rounded-xl transition-colors',
        isDropTarget ? 'bg-brand-50 ring-2 ring-inset ring-brand-300' : 'bg-surface-sunken/70',
      )}
    >
      <header className="flex items-center gap-2 px-3 pb-2 pt-3">
        <StatusDot status={status} />
        {renaming ? (
          <InlineNameInput
            className="min-w-0 flex-1"
            initial={status.name}
            placeholder="Status name"
            onSubmit={async (name) => {
              const r = await api.updateStatus({ id: status.id, name });
              if (!r.ok) return r.error.fields?.name ?? r.error.message;
              setRenaming(false);
              return null;
            }}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <>
            <h2 className="truncate text-[13px] font-semibold text-ink">{status.name}</h2>
            <span className="rounded-pill bg-white/80 px-1.5 text-[11px] font-medium text-ink-muted ring-1 ring-surface-border">
              {tasks.length}
            </span>
            <span className="ml-auto flex items-center">
              <IconButton
                label={`Add task to ${status.name}`}
                className="h-6 w-6"
                onClick={() => dispatch(drawerOpened({ mode: 'create', listId, statusId: status.id }))}
              >
                <Icon name="plus" className="h-3.5 w-3.5" />
              </IconButton>
              {canManage && <StatusMenu status={status} index={index} count={count} onRename={() => setRenaming(true)} />}
            </span>
          </>
        )}
      </header>
      <div ref={setNodeRef} className="flex min-h-[7rem] flex-1 flex-col gap-2 overflow-y-auto px-2 pb-3">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => (
            <SortableTaskCard key={t.id} task={t} showDropIndicator={dropBeforeId === t.id} />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div
            className={clsx(
              'flex flex-1 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-3 py-6 text-center',
              isDropTarget ? 'border-brand-300 text-brand-700' : 'border-surface-border text-ink-subtle',
            )}
          >
            <p className="text-xs font-medium">{isDropTarget ? 'Drop to move here' : 'No tasks'}</p>
            {!isDropTarget && (
              <button
                type="button"
                onClick={() => dispatch(drawerOpened({ mode: 'create', listId, statusId: status.id }))}
                className="rounded text-xs font-medium text-brand-600 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                + Add a task
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
