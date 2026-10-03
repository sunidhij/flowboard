import { useMemo, useState } from 'react';
import type { Task } from '@/domain/types';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Icon } from '@/components/ui/Icon';
import { useSession } from '@/store/hooks';
import { useDeleteTasks } from '../task/useDeleteTasks';

/** "N tasks selected · Clear selection · Delete N tasks" + confirmation; deletes atomically with Undo. */
export function BulkActionBar({ selected, onClear }: { selected: Task[]; onClear: () => void }) {
  const { data } = useSession();
  const deleteTasks = useDeleteTasks();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const subtaskTotal = useMemo(
    () => selected.reduce((n, t) => n + Object.values(data.tasks).filter((s) => s.parentTaskId === t.id && !s.archivedAt).length, 0),
    [selected, data.tasks],
  );

  if (selected.length === 0) return null;
  const one = selected.length === 1;

  return (
    <>
      <div
        role="toolbar"
        aria-label="Bulk actions"
        className="mb-3 flex animate-slide-in flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2 text-[13px] text-brand-900"
      >
        <span className="font-semibold">
          {selected.length} task{one ? '' : 's'} selected
        </span>
        <button
          type="button"
          onClick={onClear}
          className="rounded text-brand-700 hover:text-brand-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          Clear selection
        </button>
        <Button size="sm" variant="danger" className="ml-auto" onClick={() => setConfirmDelete(true)}>
          <Icon name="trash" className="h-4 w-4" /> Delete {one ? 'task' : `${selected.length} tasks`}
        </Button>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${one ? 'this task' : `${selected.length} tasks`}?`}
        description={`${one ? `“${selected[0]?.title}”` : `${selected.length} tasks`}${subtaskTotal ? ` and ${subtaskTotal} subtask${subtaskTotal === 1 ? '' : 's'}` : ''} will be removed. You can undo right after.`}
        confirmLabel={one ? 'Delete task' : `Delete ${selected.length} tasks`}
        onConfirm={async () => {
          const r = await deleteTasks(selected);
          if (r.ok) onClear();
        }}
        onClose={() => setConfirmDelete(false)}
      />
    </>
  );
}
