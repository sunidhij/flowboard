import { combineReducers, configureStore, createListenerMiddleware } from '@reduxjs/toolkit';
import { nanoid } from 'nanoid';
import type { Data, ID } from '@/domain/types';
import { loadPersisted, savePersisted } from './persistence';
import { initialWorkspace, workspaceReducer } from './slices/workspaceSlice';
import { uiReducer } from './slices/uiSlice';
import type { ThunkExtra } from './thunks';

export { STORAGE_KEY } from './persistence';

const rootReducer = combineReducers({ workspace: workspaceReducer, ui: uiReducer });

export type RootState = ReturnType<typeof rootReducer>;

export interface CreateAppStoreOptions {
  data?: Data;
  currentUserId?: ID;
  selectedListId?: ID | null;
  /** load from / save to localStorage (off in tests) */
  persist?: boolean;
  now?: () => string;
  id?: (prefix: string) => ID;
}

/**
 * Store factory — the app creates one with persistence; every test creates a fresh, isolated one
 * with a deterministic clock / id factory (passed to thunks as `extraArgument`).
 */
export function createAppStore(options: CreateAppStoreOptions = {}) {
  const extra: ThunkExtra = {
    now: options.now ?? (() => new Date().toISOString()),
    id: options.id ?? ((prefix) => `${prefix}_${nanoid(8)}`),
  };
  const persisted = options.persist ? loadPersisted() : undefined;
  const workspace = initialWorkspace({
    ...persisted,
    ...(options.data && { data: options.data }),
    ...(options.currentUserId && { currentUserId: options.currentUserId }),
    ...(options.selectedListId !== undefined && { selectedListId: options.selectedListId }),
  });

  // persist the workspace slice whenever it changes
  const persistence = createListenerMiddleware<RootState>();
  if (options.persist) {
    persistence.startListening({
      predicate: (_action, current, previous) => current.workspace !== previous.workspace,
      effect: (_action, api) => savePersisted(api.getState().workspace),
    });
  }

  return configureStore({
    reducer: rootReducer,
    preloadedState: { workspace },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ thunk: { extraArgument: extra } }).prepend(persistence.middleware),
  });
}

export type AppStore = ReturnType<typeof createAppStore>;
export type AppDispatch = AppStore['dispatch'];
