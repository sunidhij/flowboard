/**
 * Fake async "API" in front of the store. It stands in for the network so the UI
 * exercises real loading / error / optimistic paths:
 *  - every call waits `latency` ms
 *  - reads re-check permissions (403 → FORBIDDEN)
 *  - when `simulateFailures` is on, every mutation fails with NETWORK and an
 *    operation-specific message ("We were unable to delete your tasks. Please try again.")
 * Swapping this for a real HTTP client would not change any component.
 */
import { fail, ok, type Result } from '@/domain/errors';
import { assertListAccess } from '@/domain/permissions';
import type { ID } from '@/domain/types';
import { describeFailure } from './failureMessages';
import type { MoveTaskInput, MoveTaskValue } from './mutations/tasks';
import { tasksReverted } from './slices/workspaceSlice';
import type { AppStore } from './store';
import { moveTask, runMutation, type MutationInput, type MutationName, type MutationValue } from './thunks';

export interface ApiOptions {
  latency?: number;
}

const sleep = (ms: number) => (ms > 0 ? new Promise<void>((r) => setTimeout(r, ms)) : Promise.resolve());

export function createApi(store: AppStore, { latency = 350 }: ApiOptions = {}) {
  const failing = () => store.getState().ui.simulateFailures;

  /** Pessimistic mutation: wait, then commit (or fail). */
  const mutate =
    <K extends MutationName>(name: K) =>
    async (input: MutationInput<K>): Promise<Result<MutationValue<K>>> => {
      await sleep(latency);
      if (failing()) return fail('NETWORK', describeFailure(name, input, store.getState().workspace.data));
      return store.dispatch(runMutation(name, input));
    };

  return {
    latency,

    /** Simulated initial workspace fetch (drives the first-load skeleton). */
    async loadWorkspace(): Promise<Result<true>> {
      await sleep(latency);
      return ok(true);
    },

    /** Simulated list fetch: rejects with FORBIDDEN / NOT_FOUND like a real endpoint would. */
    async fetchList(listId: ID): Promise<Result<true>> {
      await sleep(latency);
      const { data, currentUserId } = store.getState().workspace;
      const access = assertListAccess(data, currentUserId, listId);
      return access.ok ? ok(true) : access;
    },

    createTask: mutate('createTask'),
    updateTask: mutate('updateTask'),
    deleteTask: mutate('deleteTask'),
    restoreTask: mutate('restoreTask'),
    deleteTasks: mutate('deleteTasks'),
    restoreTasks: mutate('restoreTasks'),
    createContainer: mutate('createContainer'),
    renameContainer: mutate('renameContainer'),
    archiveContainer: mutate('archiveContainer'),
    restoreContainer: mutate('restoreContainer'),
    reorderContainer: mutate('reorderContainer'),
    createStatus: mutate('createStatus'),
    updateStatus: mutate('updateStatus'),
    deleteStatus: mutate('deleteStatus'),

    /**
     * Optimistic move: apply locally right away (validated + permission-checked by the store),
     * then "persist". On failure, roll back exactly the tasks this move touched.
     */
    async moveTaskOptimistic(input: MoveTaskInput): Promise<Result<MoveTaskValue>> {
      const local = store.dispatch(moveTask(input));
      if (!local.ok) return local;
      await sleep(latency);
      if (failing()) {
        store.dispatch(tasksReverted({ previous: local.data.previous, activityId: local.data.activityId }));
        return fail('NETWORK', describeFailure('moveTask', input, store.getState().workspace.data));
      }
      return local;
    },
  };
}

export type Api = ReturnType<typeof createApi>;
