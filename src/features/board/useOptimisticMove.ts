import { useCallback } from 'react';
import type { MoveTaskInput } from '@/store/mutations/tasks';
import { useApi } from '@/store/context';
import { useNotify } from '@/store/hooks';

/**
 * Optimistic drag & drop: the store applies the move immediately (still fully
 * validated + permission-checked), the fake API "persists" it, and on failure
 * the api facade rolls back exactly the tasks the move touched.
 */
export function useOptimisticMove() {
  const api = useApi();
  const notify = useNotify();
  return useCallback(
    async (input: MoveTaskInput) => {
      const result = await api.moveTaskOptimistic(input);
      notify(result); // on failure the card is already back in place; the message says to retry
      return result;
    },
    [api, notify],
  );
}
