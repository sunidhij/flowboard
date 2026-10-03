import { lazy } from 'react';

/**
 * Code-split views that aren't needed for the first paint. Each has its own chunk;
 * `prefetchViews()` warms them once the app is idle so opening them feels instant.
 * (The sidebar, top bar and store stay in the entry chunk.)
 */
const loaders = {
  board: () => import('./features/board/KanbanBoard'),
  list: () => import('./features/list/TaskListView'),
  drawer: () => import('./features/task/TaskDrawer'),
  activity: () => import('./features/activity/ActivityFeed'),
};

export const KanbanBoard = lazy(() => loaders.board().then((m) => ({ default: m.KanbanBoard })));
export const TaskListView = lazy(() => loaders.list().then((m) => ({ default: m.TaskListView })));
export const TaskDrawer = lazy(() => loaders.drawer().then((m) => ({ default: m.TaskDrawer })));
export const ActivityFeed = lazy(() => loaders.activity().then((m) => ({ default: m.ActivityFeed })));

let prefetched = false;
export function prefetchViews() {
  if (prefetched) return;
  prefetched = true;
  const run = () => Object.values(loaders).forEach((load) => void load().catch(() => {}));
  if ('requestIdleCallback' in window) window.requestIdleCallback(run);
  else setTimeout(run, 200);
}
