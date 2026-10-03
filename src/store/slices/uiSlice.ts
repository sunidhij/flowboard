import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { ID } from '@/domain/types';
import { demoReset, listSelected, userSwitched } from './workspaceSlice';

/** Task drawer target: an existing task, or a draft with defaults. */
export type DrawerState = { mode: 'edit'; taskId: ID } | { mode: 'create'; listId: ID; statusId?: ID } | null;

export type ToastKind = 'success' | 'error' | 'info';

/**
 * Serializable toast record. An action button's callback (e.g. Undo) isn't stored in Redux —
 * it lives in `toastActions.ts`, keyed by toast id — so state stays plain data.
 */
export interface ToastState {
  id: ID;
  kind: ToastKind;
  message: string;
  actionLabel?: string;
}

/** Ephemeral UI state — never persisted. */
export interface UiState {
  drawer: DrawerState;
  /** dev toggle: make every save fail (to demo error handling / optimistic rollback) */
  simulateFailures: boolean;
  toasts: ToastState[];
  /** below the `lg` breakpoint the sidebar is an off-canvas panel */
  sidebarOpen: boolean;
}

const MAX_TOASTS = 4;
const initialState: UiState = { drawer: null, simulateFailures: false, toasts: [], sidebarOpen: false };

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    drawerOpened(state, action: PayloadAction<NonNullable<DrawerState>>) {
      state.drawer = action.payload;
    },
    drawerClosed(state) {
      state.drawer = null;
    },
    failureSimulationChanged(state, action: PayloadAction<boolean>) {
      state.simulateFailures = action.payload;
    },
    toastAdded(state, action: PayloadAction<ToastState>) {
      state.toasts = [...state.toasts, action.payload].slice(-MAX_TOASTS);
    },
    toastDismissed(state, action: PayloadAction<ID>) {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload);
    },
    sidebarOpened(state) {
      state.sidebarOpen = true;
    },
    sidebarClosed(state) {
      state.sidebarOpen = false;
    },
  },
  extraReducers: (builder) => {
    // navigating or switching user closes the drawer (and the mobile sidebar); a demo reset clears all UI state
    builder
      .addCase(listSelected, (state) => {
        state.drawer = null;
        state.sidebarOpen = false;
      })
      .addCase(userSwitched, (state) => {
        state.drawer = null;
        state.sidebarOpen = false;
      })
      .addCase(demoReset, () => initialState);
  },
});

export const { drawerOpened, drawerClosed, failureSimulationChanged, toastAdded, toastDismissed, sidebarOpened, sidebarClosed } =
  uiSlice.actions;
export const uiReducer = uiSlice.reducer;
