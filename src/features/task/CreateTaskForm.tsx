import { useMemo, useState } from 'react';
import { statusesOfList } from '@/domain/statusMapping';
import type { ID } from '@/domain/types';
import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/Feedback';
import { useApi } from '@/store/context';
import { useNotify, useSession, useUsers } from '@/store/hooks';
import { DrawerHeader } from './DrawerHeader';
import { SubtaskEditor, type SubtaskDraft } from './SubtaskEditor';
import { TaskForm } from './TaskForm';
import { useTaskForm } from './useTaskForm';

export function CreateTaskForm({ listId, statusId, onClose }: { listId: ID; statusId?: ID; onClose: () => void }) {
  const { data } = useSession();
  const api = useApi();
  const users = useUsers();
  const notify = useNotify();
  const statuses = useMemo(() => statusesOfList(data, listId), [data, listId]);
  const state = useTaskForm({
    title: '',
    statusId: statusId ?? statuses[0]?.id ?? '',
    priority: 'none',
    assigneeIds: [],
  });
  const [saving, setSaving] = useState(false);
  const [subtasks, setSubtasks] = useState<SubtaskDraft[]>([]);

  const submit = async () => {
    setSaving(true);
    state.setBannerError(null);
    // parent + subtasks are created atomically by the store
    const r = await api.createTask({ listId, ...state.form, subtaskTitles: subtasks.map((d) => d.title) });
    setSaving(false);
    if (!r.ok) return state.handleError(r.error);
    const extra = subtasks.length ? ` with ${subtasks.length} subtask${subtasks.length === 1 ? '' : 's'}` : '';
    notify(r, (t) => ({ kind: 'success', message: `Task “${t.title}” created${extra}` }));
    onClose();
  };

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <DrawerHeader title={`New task in ${data.containers[listId]?.name ?? 'list'}`} onClose={onClose} />
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
        {state.bannerError && <ErrorBanner error={state.bannerError} />}
        <TaskForm form={state.form} onChange={state.onChange} statuses={statuses} users={users} errors={state.errors} disabled={saving} />
        <SubtaskEditor
          items={subtasks}
          onChange={(next) => {
            setSubtasks(next);
            state.clearError('subtasks');
          }}
          error={state.errors.subtasks}
          disabled={saving}
        />
      </div>
      <div className="flex justify-end gap-2 border-t border-surface-border px-4 py-3 sm:px-5">
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={saving}>
          Create task
        </Button>
      </div>
    </form>
  );
}
