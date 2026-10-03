import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { statusesOfList } from '@/domain/statusMapping';
import type { ID, Task } from '@/domain/types';
import { Button, IconButton } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ErrorBanner } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { Select } from '@/components/ui/Select';
import { useApi, useAppDispatch } from '@/store/context';
import { useActivity, useNotify, useSession, useUsers } from '@/store/hooks';
import { selectMoveTargets, selectSubtasks } from '@/store/selectors';
import { drawerOpened } from '@/store/slices/uiSlice';
import { ActivityItems } from '../activity/ActivityFeed';
import { useOptimisticMove } from '../board/useOptimisticMove';
import { DrawerHeader } from './DrawerHeader';
import { diffSubtasks, draftsFrom, hasSubtaskChanges, SubtaskEditor } from './SubtaskEditor';
import { TaskForm } from './TaskForm';
import { fromTask, useTaskForm } from './useTaskForm';

export function EditTaskForm({ task, onClose }: { task: Task; onClose: () => void }) {
  const { data, userId } = useSession();
  const api = useApi();
  const users = useUsers();
  const notify = useNotify();
  const move = useOptimisticMove();
  const dispatch = useAppDispatch();
  const statuses = useMemo(() => statusesOfList(data, task.primaryListId), [data, task.primaryListId]);
  const moveTargets = useMemo(() => selectMoveTargets(data, userId), [data, userId]);
  const activity = useActivity({ taskId: task.id });
  const state = useTaskForm(fromTask(task));
  // subtasks are part of the form: staged here, applied on Save together with the fields
  const [initialSubtasks] = useState(() => draftsFrom(data, selectSubtasks(data, userId, task.id)));
  const [subtasks, setSubtasks] = useState(initialSubtasks);
  const subtaskChanges = diffSubtasks(initialSubtasks, subtasks);
  const dirty = state.dirty || hasSubtaskChanges(subtaskChanges);
  const [saving, setSaving] = useState(false);
  const [moving, setMoving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const parent = task.parentTaskId ? data.tasks[task.parentTaskId] : undefined;

  const discard = () => {
    state.setForm(fromTask(task));
    setSubtasks(initialSubtasks);
    state.clearError('subtasks');
  };

  const save = async () => {
    setSaving(true);
    state.setBannerError(null);
    const r = await api.updateTask({
      id: task.id,
      patch: state.form,
      expectedUpdatedAt: task.updatedAt,
      subtasks: subtaskChanges,
    });
    setSaving(false);
    if (!r.ok) return state.handleError(r.error); // stay open so the user can fix the error
    notify(r, 'Changes saved');
    onClose();
  };

  const changeList = async (toListId: ID) => {
    setMoving(true);
    const r = await move({ id: task.id, toListId });
    setMoving(false);
    if (r.ok) notify(r, `Moved to ${data.containers[toListId]?.name}`);
  };

  const remove = async () => {
    const r = await api.deleteTask({ id: task.id });
    notify(r, () => ({
      kind: 'success',
      message: `Task “${task.title}” deleted`,
      action: { label: 'Undo', run: async () => void notify(await api.restoreTask({ id: task.id }), 'Task restored') },
    }));
    if (r.ok) onClose();
  };

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <DrawerHeader title={parent ? 'Subtask' : 'Task details'} onClose={onClose}>
        <IconButton label="Delete task" onClick={() => setConfirmDelete(true)} className="hover:bg-red-50 hover:text-red-600">
          <Icon name="trash" className="h-4 w-4" />
        </IconButton>
      </DrawerHeader>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4 sm:p-5">
        {parent && (
          <button
            type="button"
            onClick={() => dispatch(drawerOpened({ mode: 'edit', taskId: parent.id }))}
            className="flex items-center gap-1.5 rounded text-xs font-medium text-ink-muted hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <Icon name="subtask" className="h-3.5 w-3.5" /> Subtask of <span className="text-ink">{parent.title}</span>
          </button>
        )}

        {state.bannerError && (
          <ErrorBanner
            error={state.bannerError}
            action={
              state.bannerError.code === 'CONFLICT' && (
                <Button
                  size="sm"
                  onClick={() => {
                    discard();
                    state.setBannerError(null);
                  }}
                >
                  Reload
                </Button>
              )
            }
          />
        )}

        {!parent && (
          <div className="flex items-center gap-3 rounded-lg bg-surface-muted px-3 py-2">
            <label htmlFor="task-list" className="text-xs font-semibold text-ink-muted">
              List
            </label>
            <Select
              id="task-list"
              size="sm"
              wrapperClassName="flex-1"
              value={task.primaryListId}
              disabled={moving || dirty}
              title={dirty ? 'Save or discard your changes before moving the task' : undefined}
              onChange={(e) => changeList(e.target.value)}
            >
              {moveTargets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </Select>
          </div>
        )}

        <TaskForm form={state.form} onChange={state.onChange} statuses={statuses} users={users} errors={state.errors} disabled={saving} />

        {!parent && (
          <SubtaskEditor
            items={subtasks}
            onChange={(next) => {
              setSubtasks(next);
              state.clearError('subtasks');
            }}
            error={state.errors.subtasks}
            disabled={saving}
          />
        )}

        <section aria-labelledby="task-activity-heading">
          <h3 id="task-activity-heading" className="mb-3 text-xs font-semibold text-ink-muted">
            History
          </h3>
          {activity.length > 0 && <ActivityItems items={activity} compact />}
          <p className="mt-3 text-[11px] text-ink-subtle">
            Created {format(new Date(task.createdAt), 'PP')} · Updated {format(new Date(task.updatedAt), 'PPp')}
          </p>
        </section>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-surface-border px-4 py-3 sm:px-5">
        {dirty && <span className="mr-auto text-xs text-ink-muted">Unsaved changes</span>}
        <Button onClick={() => (dirty ? discard() : onClose())} disabled={saving}>
          {dirty ? 'Discard' : 'Close'}
        </Button>
        <Button type="submit" variant="primary" loading={saving} disabled={!dirty}>
          Save changes
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this task?"
        description={`“${task.title}”${task.parentTaskId ? '' : ' and its subtasks'} will be removed. You can undo right after.`}
        confirmLabel="Delete task"
        onConfirm={remove}
        onClose={() => setConfirmDelete(false)}
      />
    </form>
  );
}
