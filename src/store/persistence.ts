import { USER_IDS } from '@/data/seed';
import type { Data } from '@/domain/types';
import type { WorkspaceState } from './slices/workspaceSlice';

/**
 * localStorage persistence for the workspace slice (loaded into `preloadedState`, saved by
 * listener middleware). Versioned: an unknown version or a malformed payload falls back to the seed.
 */
export const STORAGE_KEY = 'flowboard:v1';
export const STORAGE_VERSION = 1;

type Persisted = Pick<WorkspaceState, 'data' | 'currentUserId' | 'selectedListId' | 'view' | 'activityOpen' | 'sidebarCollapsed'>;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function isData(v: unknown): v is Data {
  return (
    isRecord(v) &&
    ['containers', 'statuses', 'tasks', 'users'].every((k) => isRecord(v[k])) &&
    Array.isArray(v.grants) &&
    Array.isArray(v.activity)
  );
}

export function loadPersisted(): Persisted | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== STORAGE_VERSION || !isRecord(parsed.state)) return undefined;
    const s = parsed.state;
    if (!isData(s.data)) return undefined;
    return {
      data: s.data,
      currentUserId: typeof s.currentUserId === 'string' && s.data.users[s.currentUserId] ? s.currentUserId : USER_IDS.alice,
      selectedListId: typeof s.selectedListId === 'string' ? s.selectedListId : null,
      view: s.view === 'list' ? 'list' : 'board',
      activityOpen: s.activityOpen === true,
      sidebarCollapsed: s.sidebarCollapsed === true,
    };
  } catch {
    return undefined; // unreadable / blocked storage → start from the seed
  }
}

export function savePersisted(ws: WorkspaceState) {
  const state: Persisted = {
    data: ws.data,
    currentUserId: ws.currentUserId,
    selectedListId: ws.selectedListId,
    view: ws.view,
    activityOpen: ws.activityOpen,
    sidebarCollapsed: ws.sidebarCollapsed,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, version: STORAGE_VERSION }));
  } catch {
    // quota exceeded / storage disabled — the app keeps working in memory
  }
}
