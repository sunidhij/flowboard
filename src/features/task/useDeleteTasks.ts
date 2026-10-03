import { useCallback } from 'react';
import type { Task } from '@/domain/types';
import { useApi } from '@/store/context';
import { useNotify } from '@/store/hooks';

/** Delete one or many tasks (atomically, via the store) with an Undo toast. */
export function useDeleteTasks() {
  const api = useApi();
  const notify = useNotify();
  return useCallback(
    async (tasks: Task[]) => {
      const ids = tasks.map((t) => t.id);
      const r = await api.deleteTasks({ ids });
      notify(r, () => ({
        kind: 'success',
        message: tasks.length === 1 ? `Task “${tasks[0]!.title}” deleted` : `${tasks.length} tasks deleted`,
        action: {
          label: 'Undo',
          run: async () => void notify(await api.restoreTasks({ ids }), tasks.length === 1 ? 'Task restored' : `${tasks.length} tasks restored`),
        },
      }));
      return r;
    },
    [api, notify],
  );
}
