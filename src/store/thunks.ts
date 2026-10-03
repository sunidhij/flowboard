import type { ThunkAction, UnknownAction } from '@reduxjs/toolkit';
import { notFound, ok, type Result } from '@/domain/errors';
import { assertListAccess, visibleListIds } from '@/domain/permissions';
import type { Data, ID } from '@/domain/types';
import type { MutationCtx, MutationResult } from './mutations/context';
import * as containerMutations from './mutations/containers';
import * as statusMutations from './mutations/statuses';
import * as taskMutations from './mutations/tasks';
import { dataCommitted, userSwitched } from './slices/workspaceSlice';
import { toastAdded, type ToastKind } from './slices/uiSlice';
import { registerToastAction } from './toastActions';
import type { RootState } from './store';

/** Injected via the thunk middleware's `extraArgument` — a deterministic clock and id factory in tests. */
export interface ThunkExtra {
  now: () => string;
  id: (prefix: string) => ID;
}

export type AppThunk<R = void> = ThunkAction<R, RootState, ThunkExtra, UnknownAction>;

/**
 * Every domain mutation, by name. Each is a pure `(data, ctx, input) → Result<{ data, value }>`:
 * permission check → validation → integrity rules → new immutable data. Reducers never contain
 * business rules; they only commit what a mutation returned.
 */
export const MUTATIONS = {
  createTask: taskMutations.createTask,
  updateTask: taskMutations.updateTask,
  moveTask: taskMutations.moveTask,
  deleteTask: taskMutations.deleteTask,
  restoreTask: taskMutations.restoreTask,
  deleteTasks: taskMutations.deleteTasks,
  restoreTasks: taskMutations.restoreTasks,
  createContainer: containerMutations.createContainer,
  renameContainer: containerMutations.renameContainer,
  archiveContainer: containerMutations.archiveContainer,
  restoreContainer: containerMutations.restoreContainer,
  reorderContainer: containerMutations.reorderContainer,
  createStatus: statusMutations.createStatus,
  updateStatus: statusMutations.updateStatus,
  moveStatus: statusMutations.moveStatus,
  deleteStatus: statusMutations.deleteStatus,
};

export type MutationName = keyof typeof MUTATIONS;
export type MutationInput<K extends MutationName> = Parameters<(typeof MUTATIONS)[K]>[2];
export type MutationValue<K extends MutationName> =
  ReturnType<(typeof MUTATIONS)[K]> extends MutationResult<infer V> ? V : never;

/**
 * Run a mutation as the current user. On success, commit the new data; either way, return the
 * `Result` — so `dispatch(createTask(...))` gives callers `{ ok, data } | { ok: false, error }`.
 */
export const runMutation =
  <K extends MutationName>(name: K, input: MutationInput<K>): AppThunk<Result<MutationValue<K>>> =>
  (dispatch, getState, { now, id }) => {
    const { data, currentUserId } = getState().workspace;
    const mutation = MUTATIONS[name] as (d: Data, c: MutationCtx, i: MutationInput<K>) => MutationResult<MutationValue<K>>;
    const result = mutation(data, { actorId: currentUserId, now, id }, input);
    if (!result.ok) return result;
    if (result.data.data !== data) dispatch(dataCommitted(result.data.data));
    return ok(result.data.value);
  };

const thunkFor =
  <K extends MutationName>(name: K) =>
  (input: MutationInput<K>) =>
    runMutation(name, input);

// tasks
export const createTask = thunkFor('createTask');
export const updateTask = thunkFor('updateTask');
export const moveTask = thunkFor('moveTask');
export const deleteTask = thunkFor('deleteTask');
export const restoreTask = thunkFor('restoreTask');
export const deleteTasks = thunkFor('deleteTasks');
export const restoreTasks = thunkFor('restoreTasks');
// containers (admin)
export const createContainer = thunkFor('createContainer');
export const renameContainer = thunkFor('renameContainer');
export const archiveContainer = thunkFor('archiveContainer');
export const restoreContainer = thunkFor('restoreContainer');
export const reorderContainer = thunkFor('reorderContainer');
// statuses (admin)
export const createStatus = thunkFor('createStatus');
export const updateStatus = thunkFor('updateStatus');
export const moveStatus = thunkFor('moveStatus');
export const deleteStatus = thunkFor('deleteStatus');

/**
 * Switch the acting user. If they can't open the current list, move to their first visible list
 * (or none) — "Access denied" is reserved for explicitly opening a list by URL.
 */
export const switchUser =
  (userId: ID): AppThunk<Result<{ redirectedFrom: ID | null; openedListId: ID | null }>> =>
  (dispatch, getState) => {
    const { data, selectedListId } = getState().workspace;
    if (!data.users[userId]) return notFound('User');
    if (selectedListId !== null && assertListAccess(data, userId, selectedListId).ok) {
      dispatch(userSwitched({ userId, selectedListId, replace: false }));
      return ok({ redirectedFrom: null, openedListId: selectedListId });
    }
    const next = visibleListIds(data, userId)[0] ?? null;
    // replace: Back shouldn't land on a list this user can't open
    dispatch(userSwitched({ userId, selectedListId: next, replace: true }));
    return ok({ redirectedFrom: selectedListId, openedListId: next });
  };

export interface ToastInput {
  kind: ToastKind;
  message: string;
  action?: { label: string; run: () => void };
}

/** Show a toast; returns its id. Action callbacks are kept outside Redux (see toastActions.ts). */
export const pushToast =
  (toast: ToastInput): AppThunk<ID> =>
  (dispatch, _getState, { id }) => {
    const toastId = id('toast');
    if (toast.action) registerToastAction(toastId, toast.action.run);
    dispatch(toastAdded({ id: toastId, kind: toast.kind, message: toast.message, actionLabel: toast.action?.label }));
    return toastId;
  };
