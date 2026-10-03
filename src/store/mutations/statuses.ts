import { notFound, ok, validation, type Result } from '@/domain/errors';
import { byPosition, moveId, positionsOf } from '@/domain/ordering';
import { assertCanManageContainers, isActive } from '@/domain/permissions';
import { statusesOfList } from '@/domain/statusMapping';
import {
  COLOR_TOKENS,
  STATUS_CATEGORIES,
  STATUS_NAME_MAX,
  type ColorToken,
  type Data,
  type ID,
  type Status,
  type StatusCategory,
  type Task,
} from '@/domain/types';
import type { MutationCtx, MutationResult } from './context';

/**
 * Status configuration (admin only). Invariants:
 *  - every list keeps at least one status per category (todo / in_progress / done)
 *  - names are unique per list (case-insensitive)
 *  - tasks only ever point at a status of their own list — deleting a status moves its tasks
 */

export const CATEGORY_NAME: Record<StatusCategory, string> = {
  todo: 'Not started',
  in_progress: 'Active',
  done: 'Completed',
};

function assertList(data: Data, listId: ID): Result<true> {
  const list = data.containers[listId];
  return list && list.type === 'list' && isActive(data, listId) ? ok(true) : notFound('List');
}

function validateName(data: Data, listId: ID, raw: string, selfId?: ID): Result<string> {
  const name = raw.trim();
  const fail = (msg: string) => validation(msg, { name: msg });
  if (!name) return fail('Status name is required.');
  if (name.length > STATUS_NAME_MAX) return fail(`Status name must be at most ${STATUS_NAME_MAX} characters.`);
  const clash = statusesOfList(data, listId).some((s) => s.id !== selfId && s.name.toLowerCase() === name.toLowerCase());
  if (clash) return fail(`This list already has a “${name}” status.`);
  return ok(name);
}

function withOrder(statuses: Record<ID, Status>, orderedIds: ID[]) {
  const positions = positionsOf(orderedIds);
  for (const id of orderedIds) {
    const s = statuses[id];
    if (s && s.position !== positions[id]) statuses[id] = { ...s, position: positions[id]! };
  }
}

export interface CreateStatusInput {
  listId: ID;
  name: string;
  category: StatusCategory;
  color: ColorToken;
}

/** New statuses are placed after the last status of the same category, so the board stays grouped. */
export function createStatus(data: Data, ctx: MutationCtx, input: CreateStatusInput): MutationResult<Status> {
  const perm = assertCanManageContainers(data, ctx.actorId);
  if (!perm.ok) return perm;
  const list = assertList(data, input.listId);
  if (!list.ok) return list;
  const name = validateName(data, input.listId, input.name);
  if (!name.ok) return name;
  if (!STATUS_CATEGORIES.includes(input.category)) return validation('Unknown status category.');
  if (!COLOR_TOKENS.includes(input.color)) return validation('Unknown color.');

  const existing = statusesOfList(data, input.listId);
  const status: Status = { id: ctx.id('st'), listId: input.listId, name: name.data, category: input.category, color: input.color, position: 0 };
  const catRank = (c: StatusCategory) => STATUS_CATEGORIES.indexOf(c);
  let insertAt = existing.findIndex((s) => catRank(s.category) > catRank(input.category));
  if (insertAt === -1) insertAt = existing.length;
  const ordered = existing.map((s) => s.id);
  ordered.splice(insertAt, 0, status.id);

  const statuses = { ...data.statuses, [status.id]: status };
  withOrder(statuses, ordered);
  return ok({ data: { ...data, statuses }, value: statuses[status.id]! });
}

export function updateStatus(
  data: Data,
  ctx: MutationCtx,
  input: { id: ID; name?: string; color?: ColorToken },
): MutationResult<Status> {
  const perm = assertCanManageContainers(data, ctx.actorId);
  if (!perm.ok) return perm;
  const status = data.statuses[input.id];
  if (!status) return notFound('Status');
  const list = assertList(data, status.listId);
  if (!list.ok) return list;

  let name = status.name;
  if (input.name !== undefined) {
    const r = validateName(data, status.listId, input.name, status.id);
    if (!r.ok) return r;
    name = r.data;
  }
  if (input.color !== undefined && !COLOR_TOKENS.includes(input.color)) return validation('Unknown color.');

  const updated: Status = { ...status, name, color: input.color ?? status.color };
  return ok({ data: { ...data, statuses: { ...data.statuses, [status.id]: updated } }, value: updated });
}

export function moveStatus(data: Data, ctx: MutationCtx, input: { id: ID; toIndex: number }): MutationResult<Status> {
  const perm = assertCanManageContainers(data, ctx.actorId);
  if (!perm.ok) return perm;
  const status = data.statuses[input.id];
  if (!status) return notFound('Status');
  const list = assertList(data, status.listId);
  if (!list.ok) return list;

  const statuses = { ...data.statuses };
  withOrder(statuses, moveId(statusesOfList(data, status.listId).map((s) => s.id), status.id, input.toIndex));
  return ok({ data: { ...data, statuses }, value: statuses[status.id]! });
}

/** Where a deleted status's tasks would go (another status of the same category), or null if it's the last one. */
export function fallbackStatus(data: Data, statusId: ID): Status | null {
  const status = data.statuses[statusId];
  if (!status) return null;
  return statusesOfList(data, status.listId).find((s) => s.id !== statusId && s.category === status.category) ?? null;
}

export function deleteStatus(
  data: Data,
  ctx: MutationCtx,
  input: { id: ID },
): MutationResult<{ status: Status; movedTo: Status; movedCount: number }> {
  const perm = assertCanManageContainers(data, ctx.actorId);
  if (!perm.ok) return perm;
  const status = data.statuses[input.id];
  if (!status) return notFound('Status');
  const list = assertList(data, status.listId);
  if (!list.ok) return list;

  const target = fallbackStatus(data, status.id);
  if (!target) {
    return validation(`A list needs at least one “${CATEGORY_NAME[status.category]}” status. Add another one before deleting “${status.name}”.`);
  }

  // move every task (including archived ones, so a later restore stays valid) to the fallback status
  const tasks: Record<ID, Task> = { ...data.tasks };
  const onTarget = Object.values(data.tasks)
    .filter((t) => t.statusId === target.id && !t.parentTaskId && !t.archivedAt)
    .sort(byPosition);
  let nextPos = onTarget.length;
  let movedCount = 0;
  const now = ctx.now();
  for (const t of Object.values(data.tasks).sort(byPosition)) {
    if (t.statusId !== status.id) continue;
    const topLevelActive = !t.parentTaskId && !t.archivedAt;
    tasks[t.id] = { ...t, statusId: target.id, updatedAt: now, ...(topLevelActive ? { position: nextPos++ } : {}) };
    if (!t.archivedAt) movedCount++;
  }

  const statuses = { ...data.statuses };
  delete statuses[status.id];
  withOrder(statuses, statusesOfList({ ...data, statuses }, status.listId).map((s) => s.id));
  return ok({ data: { ...data, statuses, tasks }, value: { status, movedTo: target, movedCount } });
}
