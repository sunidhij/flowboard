import type { ID } from '@/domain/types';

/**
 * Callbacks for toast action buttons (e.g. "Undo"). Functions aren't serializable, so they're kept
 * here, keyed by toast id, instead of in the Redux state.
 */
const callbacks = new Map<ID, () => void>();

export const registerToastAction = (toastId: ID, run: () => void) => void callbacks.set(toastId, run);

export function runToastAction(toastId: ID) {
  callbacks.get(toastId)?.();
  callbacks.delete(toastId);
}

export const forgetToastAction = (toastId: ID) => void callbacks.delete(toastId);
