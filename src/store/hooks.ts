import { createSelector } from '@reduxjs/toolkit';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AppError, Result } from '@/domain/errors';
import type { ID, User } from '@/domain/types';
import { useApi, useAppDispatch, useAppSelector } from './context';
import * as sel from './selectors';
import type { RootState } from './store';
import { pushToast, type ToastInput } from './thunks';

/** Base selectors on the Redux state. */
export const selectData = (s: RootState) => s.workspace.data;
export const selectCurrentUserId = (s: RootState) => s.workspace.currentUserId;

/** Memoised (createSelector): recomputed only when data or the acting user changes. */
export const selectVisibleTree = createSelector([selectData, selectCurrentUserId], (data, userId) => sel.selectTree(data, userId));
export const selectUsers = createSelector([(s: RootState) => s.workspace.data.users], (users) => Object.values(users));

export function useSession() {
  const data = useAppSelector(selectData);
  const userId = useAppSelector(selectCurrentUserId);
  return { data, userId };
}

export function useCurrentUser(): User {
  const { data, userId } = useSession();
  return data.users[userId]!;
}

export const useUsers = (): User[] => useAppSelector(selectUsers);

export const useTree = () => useAppSelector(selectVisibleTree);

/*
 * Parameterised derivations (per list / per task) use useMemo: a single shared createSelector
 * would thrash between different listIds across components.
 */
export function useListView(listId: ID) {
  const { data, userId } = useSession();
  return useMemo(() => sel.selectList(data, userId, listId), [data, userId, listId]);
}

export function useColumns(listId: ID) {
  const { data, userId } = useSession();
  return useMemo(() => sel.selectColumns(data, userId, listId), [data, userId, listId]);
}

export function useListTasks(listId: ID) {
  const { data, userId } = useSession();
  return useMemo(() => sel.selectListTasks(data, userId, listId), [data, userId, listId]);
}

export function useActivity(scope: { listId?: ID; taskId?: ID }) {
  const { data, userId } = useSession();
  const { listId, taskId } = scope;
  return useMemo(() => sel.selectActivity(data, userId, { listId, taskId }), [data, userId, listId, taskId]);
}

/** Turn a Result into a toast. Returns the result for chaining. */
export function useNotify() {
  const dispatch = useAppDispatch();
  return useCallback(
    <T,>(result: Result<T>, success?: string | ((data: T) => ToastInput)) => {
      if (!result.ok) dispatch(pushToast({ kind: 'error', message: result.error.message }));
      else if (typeof success === 'string') dispatch(pushToast({ kind: 'success', message: success }));
      else if (success) dispatch(pushToast(success(result.data)));
      return result;
    },
    [dispatch],
  );
}

export type LoadState = { status: 'loading' } | { status: 'ready' } | { status: 'error'; error: AppError };

/**
 * Simulated fetch of a list whenever the list or the acting user changes.
 * The fetch re-checks permissions, so opening a denied list yields a 403.
 */
export function useListLoader(listId: ID | null): LoadState {
  const api = useApi();
  const userId = useAppSelector(selectCurrentUserId);
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    if (!listId) return;
    let cancelled = false;
    setState({ status: 'loading' });
    api.fetchList(listId).then((r) => {
      if (!cancelled) setState(r.ok ? { status: 'ready' } : { status: 'error', error: r.error });
    });
    return () => {
      cancelled = true;
    };
  }, [api, listId, userId]);

  return state;
}
