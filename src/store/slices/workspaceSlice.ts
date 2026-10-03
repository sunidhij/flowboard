import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { buildSeed, USER_IDS } from '@/data/seed';
import type { Data, ID, Task } from '@/domain/types';

export type ViewMode = 'board' | 'list';

/**
 * The persisted part of the app: the "database" plus who is acting and what they're looking at.
 * Domain changes never happen in these reducers directly — thunks run a pure, validated mutation
 * (`store/mutations/*`) and commit its result with `dataCommitted`.
 */
export interface WorkspaceState {
  data: Data;
  currentUserId: ID;
  selectedListId: ID | null;
  view: ViewMode;
  activityOpen: boolean;
  /** desktop (lg+) sidebar collapsed — a saved preference; small screens use the off-canvas `ui.sidebarOpen` */
  sidebarCollapsed: boolean;
  /** how the last selection should be reflected in browser history (not persisted) */
  navReplace: boolean;
}

export const initialWorkspace = (overrides: Partial<WorkspaceState> = {}): WorkspaceState => ({
  data: buildSeed(),
  currentUserId: USER_IDS.alice,
  selectedListId: null,
  view: 'board',
  activityOpen: false,
  sidebarCollapsed: false,
  navReplace: false,
  ...overrides,
});

const workspaceSlice = createSlice({
  name: 'workspace',
  initialState: initialWorkspace,
  reducers: {
    /** Commit the output of a validated mutation. */
    dataCommitted(state, action: PayloadAction<Data>) {
      state.data = action.payload;
    },
    /** Roll back an optimistic move: put prior task versions back and drop its activity entry. */
    tasksReverted(state, action: PayloadAction<{ previous: Record<ID, Task>; activityId?: ID }>) {
      Object.assign(state.data.tasks, action.payload.previous);
      const { activityId } = action.payload;
      if (activityId) state.data.activity = state.data.activity.filter((a) => a.id !== activityId);
    },
    userSwitched(state, action: PayloadAction<{ userId: ID; selectedListId: ID | null; replace: boolean }>) {
      state.currentUserId = action.payload.userId;
      state.selectedListId = action.payload.selectedListId;
      state.navReplace = action.payload.replace;
    },
    /** `replace` swaps the current history entry instead of adding one (redirects). */
    listSelected: {
      reducer(state, action: PayloadAction<{ listId: ID | null; replace: boolean }>) {
        state.selectedListId = action.payload.listId;
        state.navReplace = action.payload.replace;
      },
      prepare: (listId: ID | null, options?: { replace?: boolean }) => ({
        payload: { listId, replace: Boolean(options?.replace) },
      }),
    },
    viewChanged(state, action: PayloadAction<ViewMode>) {
      state.view = action.payload;
    },
    activityToggled(state) {
      state.activityOpen = !state.activityOpen;
    },
    sidebarCollapsed(state) {
      state.sidebarCollapsed = true;
    },
    sidebarExpanded(state) {
      state.sidebarCollapsed = false;
    },
    /** Back to the original demo data (the fresh seed is built in `prepare`, keeping the reducer pure). */
    demoReset: {
      reducer: (_state, action: PayloadAction<Data>) => initialWorkspace({ data: action.payload }),
      prepare: () => ({ payload: buildSeed() }),
    },
  },
});

export const {
  dataCommitted,
  tasksReverted,
  userSwitched,
  listSelected,
  viewChanged,
  activityToggled,
  sidebarCollapsed,
  sidebarExpanded,
  demoReset,
} =
  workspaceSlice.actions;
export const workspaceReducer = workspaceSlice.reducer;
