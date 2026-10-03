import { notFound, ok, validation } from '@/domain/errors';
import { byPosition, moveId, positionsOf } from '@/domain/ordering';
import { assertCanManageContainers, isActive } from '@/domain/permissions';
import { defaultStatuses } from '@/domain/statusMapping';
import type { Container, ContainerType, Data, ID, Visibility } from '@/domain/types';
import { validateContainerName, validateParent } from '@/domain/validators';
import { withActivity, type MutationCtx, type MutationResult } from './context';

export function activeChildren(data: Data, parentId: ID, excludeId?: ID): Container[] {
  return Object.values(data.containers)
    .filter((c) => c.parentId === parentId && !c.archivedAt && c.id !== excludeId)
    .sort(byPosition);
}

function reindex(containers: Record<ID, Container>, orderedIds: ID[]) {
  const positions = positionsOf(orderedIds);
  for (const id of orderedIds) {
    const c = containers[id];
    if (c && c.position !== positions[id]) containers[id] = { ...c, position: positions[id]! };
  }
}

export interface CreateContainerInput {
  parentId: ID;
  type: ContainerType;
  name: string;
  visibility?: Visibility;
}

export function createContainer(data: Data, ctx: MutationCtx, input: CreateContainerInput): MutationResult<Container> {
  const perm = assertCanManageContainers(data, ctx.actorId);
  if (!perm.ok) return perm;
  const parent = validateParent(data, input.parentId, input.type);
  if (!parent.ok) return parent;
  const name = validateContainerName(input.name);
  if (!name.ok) return name;

  const container: Container = {
    id: ctx.id(input.type.slice(0, 2)),
    name: name.data,
    type: input.type,
    parentId: input.parentId,
    position: activeChildren(data, input.parentId).length,
    visibility: input.visibility ?? 'public',
  };
  const statuses = { ...data.statuses };
  if (container.type === 'list') {
    for (const s of defaultStatuses(container.id, () => ctx.id('st'))) statuses[s.id] = s;
  }
  const next = withActivity(
    { ...data, statuses, containers: { ...data.containers, [container.id]: container } },
    ctx,
    { verb: 'container.created', containerId: container.id, meta: { name: container.name, to: container.type } },
  );
  return ok({ data: next.data, value: container });
}

function getActiveContainer(data: Data, id: ID) {
  const c = data.containers[id];
  return c && isActive(data, id) ? ok(c) : notFound('Container');
}

export function renameContainer(data: Data, ctx: MutationCtx, input: { id: ID; name: string }): MutationResult<Container> {
  const perm = assertCanManageContainers(data, ctx.actorId);
  if (!perm.ok) return perm;
  const found = getActiveContainer(data, input.id);
  if (!found.ok) return found;
  const name = validateContainerName(input.name);
  if (!name.ok) return name;
  if (name.data === found.data.name) return ok({ data, value: found.data });

  const renamed = { ...found.data, name: name.data };
  const next = withActivity({ ...data, containers: { ...data.containers, [renamed.id]: renamed } }, ctx, {
    verb: 'container.renamed',
    containerId: renamed.id,
    meta: { from: found.data.name, to: renamed.name, name: renamed.name },
  });
  return ok({ data: next.data, value: renamed });
}

/** Soft-delete. Descendants (and their tasks) disappear because `isActive` checks ancestors. */
export function archiveContainer(data: Data, ctx: MutationCtx, input: { id: ID }): MutationResult<Container> {
  const perm = assertCanManageContainers(data, ctx.actorId);
  if (!perm.ok) return perm;
  const found = getActiveContainer(data, input.id);
  if (!found.ok) return found;
  if (found.data.type === 'workspace') return validation('The workspace cannot be archived.');

  const archived = { ...found.data, archivedAt: ctx.now() };
  const containers = { ...data.containers, [archived.id]: archived };
  reindex(containers, activeChildren(data, archived.parentId!, archived.id).map((c) => c.id));

  const next = withActivity({ ...data, containers }, ctx, {
    verb: 'container.archived',
    containerId: archived.id,
    meta: { name: archived.name, to: archived.type },
  });
  return ok({ data: next.data, value: archived });
}

export function restoreContainer(data: Data, ctx: MutationCtx, input: { id: ID }): MutationResult<Container> {
  const perm = assertCanManageContainers(data, ctx.actorId);
  if (!perm.ok) return perm;
  const c = data.containers[input.id];
  if (!c || !c.archivedAt) return notFound('Archived container');
  if (!c.parentId || !isActive(data, c.parentId)) return validation('Restore its parent first.');

  const restored: Container = { ...c, archivedAt: undefined, position: activeChildren(data, c.parentId).length };
  const next = withActivity({ ...data, containers: { ...data.containers, [c.id]: restored } }, ctx, {
    verb: 'container.restored',
    containerId: c.id,
    meta: { name: c.name, to: c.type },
  });
  return ok({ data: next.data, value: restored });
}

/** Reorder among active siblings (same parent only — re-parenting is not supported). */
export function reorderContainer(
  data: Data,
  ctx: MutationCtx,
  input: { id: ID; toIndex: number },
): MutationResult<Container> {
  const perm = assertCanManageContainers(data, ctx.actorId);
  if (!perm.ok) return perm;
  const found = getActiveContainer(data, input.id);
  if (!found.ok) return found;
  if (!found.data.parentId) return validation('The workspace cannot be reordered.');

  const containers = { ...data.containers };
  const siblings = activeChildren(data, found.data.parentId).map((c) => c.id);
  reindex(containers, moveId(siblings, input.id, input.toIndex));
  return ok({ data: { ...data, containers }, value: containers[input.id]! });
}
