import { useCallback } from 'react';
import type { Container, ContainerType, ID } from '@/domain/types';
import { useApi, useAppDispatch } from '@/store/context';
import { listSelected } from '@/store/slices/workspaceSlice';
import { pushToast } from '@/store/thunks';
import { useNotify } from '@/store/hooks';

/** Container commands with consistent toasts (incl. undo for archive). Business rules live in the store. */
export function useContainerCommands() {
  const api = useApi();
  const notify = useNotify();
  const dispatch = useAppDispatch();

  const create = useCallback(
    async (parentId: ID, type: ContainerType, name: string): Promise<string | null> => {
      const r = await api.createContainer({ parentId, type, name });
      if (!r.ok) return r.error.fields?.name ?? r.error.message; // shown inline under the field (keeps it open to retry)
      dispatch(pushToast({ kind: 'success', message: `${capitalize(type)} “${r.data.name}” created` }));
      if (type === 'list') dispatch(listSelected(r.data.id));
      return null;
    },
    [api, dispatch],
  );

  const rename = useCallback(
    async (id: ID, name: string): Promise<string | null> => {
      const r = await api.renameContainer({ id, name });
      if (!r.ok) return r.error.fields?.name ?? r.error.message; // shown inline under the field (keeps it open to retry)
      return null;
    },
    [api],
  );

  const archive = useCallback(
    async (container: Container) => {
      const r = await api.archiveContainer({ id: container.id });
      notify(r, () => ({
        kind: 'success',
        message: `“${container.name}” archived`,
        action: {
          label: 'Undo',
          run: async () => {
            notify(await api.restoreContainer({ id: container.id }), `“${container.name}” restored`);
          },
        },
      }));
      // if the open list was inside, AppShell moves to the next visible list (or the empty state)
    },
    [api, notify],
  );

  const restore = useCallback(
    async (container: Container) => {
      notify(await api.restoreContainer({ id: container.id }), `“${container.name}” restored`);
    },
    [api, notify],
  );

  return { create, rename, archive, restore };
}

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
