import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  pointerWithin,
  type CollisionDetection,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type { ID } from '@/domain/types';
import { moveId } from '@/domain/ordering';
import { canManageContainers } from '@/domain/permissions';
import { useColumns, useListView, useSession } from '@/store/hooks';
import { KanbanColumn } from './KanbanColumn';
import { AddStatusColumn } from './StatusControls';
import { TaskCardBody } from './TaskCard';
import { useOptimisticMove } from './useOptimisticMove';

/**
 * Drop on whatever is under the pointer (a card, else its column). `closestCorners` alone
 * mis-targets empty columns: a tall empty column's corners are far from the pointer, so a card
 * in the neighbouring column "wins". Keyboard drags have no pointer, so they fall back to it.
 */
const pointerFirst: CollisionDetection = (args) => {
  const under = pointerWithin(args);
  if (under.length === 0) return closestCorners(args);
  const card = under.find((c) => args.droppableContainers.find((d) => d.id === c.id)?.data.current?.type === 'task');
  return card ? [card] : under;
};

interface DropTarget {
  statusId: ID;
  /** card the pointer is over, if any (insert before it) */
  overTaskId: ID | null;
}

export function KanbanBoard({ listId }: { listId: ID }) {
  const view = useListView(listId);
  const { data, userId } = useSession();
  const canManage = canManageContainers(data, userId);
  const columns = useColumns(listId);
  const move = useOptimisticMove();
  const [activeId, setActiveId] = useState<ID | null>(null);
  const [target, setTarget] = useState<DropTarget | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] },
    }),
  );

  if (!view.ok || !columns.ok) return null; // ListPage renders the error state
  const cols = columns.data;
  const allTasks = Object.values(cols).flat();
  const activeTask = activeId ? allTasks.find((t) => t.id === activeId) : undefined;

  const resolveTarget = (over: DragOverEvent['over']): DropTarget | null => {
    if (!over) return null;
    const d = over.data.current as { type?: string; statusId?: ID } | undefined;
    if (!d?.statusId) return null;
    return { statusId: d.statusId, overTaskId: d.type === 'task' ? String(over.id) : null };
  };

  const onDragStart = ({ active }: DragStartEvent) => setActiveId(String(active.id));
  const onDragOver = ({ over }: DragOverEvent) => setTarget(resolveTarget(over));
  const reset = () => {
    setActiveId(null);
    setTarget(null);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const dest = resolveTarget(over);
    const task = allTasks.find((t) => t.id === active.id);
    reset();
    if (!dest || !task) return;

    const destIds = (cols[dest.statusId] ?? []).map((t) => t.id);
    let toIndex: number;
    if (dest.statusId === task.statusId) {
      if (dest.overTaskId === task.id) return;
      // same column: arrayMove semantics (take the over card's slot); the empty space below the
      // last card means "move to the end"
      toIndex = dest.overTaskId ? destIds.indexOf(dest.overTaskId) : destIds.length - 1;
      const reordered = moveId(destIds, task.id, toIndex);
      if (reordered.join() === destIds.join()) return;
    } else {
      // other column: insert before the hovered card, or at the end
      toIndex = dest.overTaskId ? destIds.indexOf(dest.overTaskId) : destIds.length;
    }
    void move({ id: task.id, toStatusId: dest.statusId, toIndex });
  };

  const crossColumn = activeTask && target && target.statusId !== activeTask.statusId;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerFirst}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={reset}
      accessibility={{
        announcements: {
          onDragStart: ({ active }) => `Picked up ${allTasks.find((t) => t.id === active.id)?.title ?? 'task'}.`,
          onDragOver: ({ over }) => {
            const st = resolveTarget(over);
            return st ? `Over ${view.data.statuses.find((s) => s.id === st.statusId)?.name} column.` : 'Not over a column.';
          },
          onDragEnd: ({ over }) => (over ? 'Task dropped.' : 'Task returned to its original position.'),
          onDragCancel: () => 'Move cancelled.',
        },
      }}
    >
      <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto p-3 sm:p-5">
        {view.data.statuses.map((status, i) => (
          <KanbanColumn
            key={status.id}
            listId={listId}
            status={status}
            index={i}
            count={view.data.statuses.length}
            canManage={canManage}
            tasks={cols[status.id] ?? []}
            isDropTarget={Boolean(crossColumn && target?.statusId === status.id)}
            dropBeforeId={crossColumn && target?.statusId === status.id ? target.overTaskId : null}
          />
        ))}
        {canManage && <AddStatusColumn listId={listId} />}
      </div>
      <DragOverlay dropAnimation={{ duration: 160, easing: 'ease-out' }}>
        {activeTask ? <TaskCardBody task={activeTask} overlay className="w-[17rem]" /> : null}
      </DragOverlay>
    </DndContext>
  );
}
