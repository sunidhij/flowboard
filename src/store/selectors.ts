/**
 * Read-side of the store. Every selector takes the acting user and applies
 * permission filtering — the UI never sees data the user may not access.
 */
import { forbidden, notFound, ok, type Result } from '@/domain/errors';
import { byPosition } from '@/domain/ordering';
import {
  assertListAccess,
  canManageContainers,
  canViewContainer,
  isActive,
  visibleListIds,
  visibleTree,
  type TreeNode,
} from '@/domain/permissions';
import { statusesOfList } from '@/domain/statusMapping';
import type { Activity, Container, Data, ID, Status, Task } from '@/domain/types';
import { columnTasks, subtasksOf } from './mutations/tasks';

export function selectTree(data: Data, userId: ID): TreeNode | null {
  return visibleTree(data, userId);
}

/** Ancestors from workspace down to (and including) the container. */
export function selectPath(data: Data, containerId: ID): Container[] {
  const path: Container[] = [];
  let node = data.containers[containerId];
  while (node) {
    path.unshift(node);
    node = node.parentId ? data.containers[node.parentId] : undefined;
  }
  return path;
}

export interface ListView {
  list: Container;
  statuses: Status[];
  path: Container[];
}

export function selectList(data: Data, userId: ID, listId: ID): Result<ListView> {
  const access = assertListAccess(data, userId, listId);
  if (!access.ok) return access;
  return ok({ list: access.data, statuses: statusesOfList(data, listId), path: selectPath(data, listId) });
}

/** Top-level tasks of a list, grouped by status column (every status present, possibly empty). */
export function selectColumns(data: Data, userId: ID, listId: ID): Result<Record<ID, Task[]>> {
  const view = selectList(data, userId, listId);
  if (!view.ok) return view;
  return ok(Object.fromEntries(view.data.statuses.map((s) => [s.id, columnTasks(data, listId, s.id)])));
}

export function selectListTasks(data: Data, userId: ID, listId: ID): Result<Task[]> {
  const access = assertListAccess(data, userId, listId);
  if (!access.ok) return access;
  return ok(
    Object.values(data.tasks)
      .filter((t) => !t.archivedAt && !t.parentTaskId && t.primaryListId === listId)
      .sort(byPosition),
  );
}

export function selectTask(data: Data, userId: ID, taskId: ID): Result<Task> {
  const task = data.tasks[taskId];
  if (!task || task.archivedAt) return notFound('Task');
  const access = assertListAccess(data, userId, task.primaryListId);
  return access.ok ? ok(task) : access;
}

export function selectSubtasks(data: Data, userId: ID, taskId: ID): Task[] {
  const parent = selectTask(data, userId, taskId);
  return parent.ok ? subtasksOf(data, taskId) : [];
}

export function selectSubtaskCounts(data: Data, taskId: ID): { done: number; total: number } {
  const subs = subtasksOf(data, taskId);
  return {
    total: subs.length,
    done: subs.filter((s) => data.statuses[s.statusId]?.category === 'done').length,
  };
}

/** Lists the user can move a task into, labelled with their path. */
export function selectMoveTargets(data: Data, userId: ID): { id: ID; label: string }[] {
  return visibleListIds(data, userId).map((id) => ({
    id,
    label: selectPath(data, id)
      .slice(1)
      .map((c) => c.name)
      .join(' / '),
  }));
}

export function selectFirstVisibleList(data: Data, userId: ID): ID | null {
  return visibleListIds(data, userId)[0] ?? null;
}

/** True when the list no longer exists or it (or an ancestor) was archived — unlike FORBIDDEN, it won't come back by switching user. */
export function isListGone(data: Data, listId: ID): boolean {
  return !data.containers[listId] || !isActive(data, listId);
}

/**
 * Why there is no list to open, so the empty state can say something useful.
 * - no-spaces: the workspace has never had a space
 * - all-archived: spaces exist but every one is archived
 * - no-lists: active spaces exist but none contains a list
 * - no-access: a member who can't see any list
 */
export type EmptyWorkspaceReason = 'no-spaces' | 'all-archived' | 'no-lists' | 'no-access';

export function selectEmptyWorkspaceReason(data: Data, userId: ID): EmptyWorkspaceReason | null {
  if (visibleListIds(data, userId).length > 0) return null;
  if (!canManageContainers(data, userId)) return 'no-access';
  const spaces = Object.values(data.containers).filter((c) => c.type === 'space');
  if (spaces.length === 0) return 'no-spaces';
  if (spaces.every((s) => !isActive(data, s.id))) return 'all-archived';
  return 'no-lists';
}

/** Activity the user is allowed to see, optionally scoped to a list or task. */
export function selectActivity(
  data: Data,
  userId: ID,
  scope: { listId?: ID; taskId?: ID } = {},
  limit = 50,
): Activity[] {
  const out: Activity[] = [];
  for (const a of data.activity) {
    if (scope.taskId && a.taskId !== scope.taskId) continue;
    if (scope.listId && a.containerId !== scope.listId) continue;
    if (!canViewContainer(data, userId, a.containerId)) continue;
    out.push(a);
    if (out.length >= limit) break;
  }
  return out;
}

/** Archived containers an admin can restore (only those whose parent is still active). */
export function selectArchivedContainers(data: Data, userId: ID): Result<Container[]> {
  if (!canManageContainers(data, userId)) return forbidden();
  return ok(
    Object.values(data.containers)
      .filter((c) => c.archivedAt && c.parentId && isActive(data, c.parentId))
      .sort((a, b) => (b.archivedAt ?? '').localeCompare(a.archivedAt ?? '')),
  );
}
