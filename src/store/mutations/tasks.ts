import { conflict, notFound, ok, validation, type Result } from '@/domain/errors';
import { byPosition, moveId, positionsOf } from '@/domain/ordering';
import { assertListAccess } from '@/domain/permissions';
import { mapStatusToList, statusesOfList } from '@/domain/statusMapping';
import type { Data, ID, Priority, Task } from '@/domain/types';
import { validateTaskFields, type TaskFields } from '@/domain/validators';
import { withActivity, type MutationCtx, type MutationResult } from './context';

/** Top-level, non-archived tasks in one kanban column, ordered. */
export function columnTasks(data: Data, listId: ID, statusId: ID, excludeId?: ID): Task[] {
  return Object.values(data.tasks)
    .filter(
      (t) =>
        !t.archivedAt &&
        !t.parentTaskId &&
        t.primaryListId === listId &&
        t.statusId === statusId &&
        t.id !== excludeId,
    )
    .sort(byPosition);
}

export function subtasksOf(data: Data, parentId: ID, excludeId?: ID): Task[] {
  return Object.values(data.tasks)
    .filter((t) => !t.archivedAt && t.parentTaskId === parentId && t.id !== excludeId)
    .sort(byPosition);
}

/** Siblings a task is ordered against: its column, or its parent's subtasks. */
function siblingsOf(data: Data, task: Pick<Task, 'primaryListId' | 'statusId' | 'parentTaskId'>, excludeId?: ID) {
  return task.parentTaskId
    ? subtasksOf(data, task.parentTaskId, excludeId)
    : columnTasks(data, task.primaryListId, task.statusId, excludeId);
}

/** Write positions 0..n-1 for `orderedIds` into `tasks`, recording prior versions. */
function applyOrder(tasks: Record<ID, Task>, orderedIds: ID[], previous: Record<ID, Task>) {
  const positions = positionsOf(orderedIds);
  for (const id of orderedIds) {
    const t = tasks[id];
    if (!t || t.position === positions[id]) continue;
    previous[id] ??= t;
    tasks[id] = { ...t, position: positions[id]! };
  }
}

function getActiveTask(data: Data, id: ID): Result<Task> {
  const task = data.tasks[id];
  return task && !task.archivedAt ? ok(task) : notFound('Task');
}

const statusName = (data: Data, id: ID) => data.statuses[id]?.name ?? 'Unknown';
const listName = (data: Data, id: ID) => data.containers[id]?.name ?? 'Unknown';

// ─── create ────────────────────────────────────────────────────────────────

export interface CreateTaskInput {
  listId: ID;
  title: string;
  description?: string;
  statusId?: ID;
  priority?: Priority;
  assigneeIds?: ID[];
  dueDate?: string;
  parentTaskId?: ID;
  /** create these subtasks together with the task — all or nothing */
  subtaskTitles?: string[];
}

export function createTask(data: Data, ctx: MutationCtx, input: CreateTaskInput): MutationResult<Task> {
  const created = createSingleTask(data, ctx, input);
  if (!created.ok || !input.subtaskTitles?.length) return created;
  if (input.parentTaskId) return validation('Subtasks can only be one level deep.');

  // pure, so bailing out on the first invalid subtask leaves `data` untouched
  let next = created.data.data;
  for (const [i, title] of input.subtaskTitles.entries()) {
    const sub = createSingleTask(next, ctx, { listId: input.listId, title, parentTaskId: created.data.value.id });
    if (!sub.ok) {
      const message = `Subtask ${i + 1}: ${sub.error.message}`;
      return validation(message, { subtasks: message });
    }
    next = sub.data.data;
  }
  return ok({ data: next, value: created.data.value });
}

function createSingleTask(data: Data, ctx: MutationCtx, input: Omit<CreateTaskInput, 'subtaskTitles'>): MutationResult<Task> {
  const access = assertListAccess(data, ctx.actorId, input.listId);
  if (!access.ok) return access;

  const statusId = input.statusId ?? statusesOfList(data, input.listId)[0]?.id;
  if (!statusId) return validation('This list has no statuses configured.');

  const fields = validateTaskFields(data, input.listId, {
    title: input.title,
    description: input.description,
    statusId,
    priority: input.priority ?? 'none',
    assigneeIds: input.assigneeIds ?? [],
    dueDate: input.dueDate,
    parentTaskId: input.parentTaskId,
  });
  if (!fields.ok) return fields;

  const now = ctx.now();
  const draft = { ...fields.data, primaryListId: input.listId };
  const task: Task = {
    id: ctx.id('t'),
    ...draft,
    position: siblingsOf(data, draft).length,
    createdAt: now,
    updatedAt: now,
  };
  const next = withActivity({ ...data, tasks: { ...data.tasks, [task.id]: task } }, ctx, {
    verb: 'task.created',
    containerId: input.listId,
    taskId: task.id,
    meta: { taskTitle: task.title, to: statusName(data, task.statusId) },
  });
  return ok({ data: next.data, value: task });
}

// ─── update ────────────────────────────────────────────────────────────────

export type TaskPatch = Partial<Omit<TaskFields, 'parentTaskId'>>;

/** Subtask edits staged in the task form and applied together with the task's own fields. */
export interface SubtaskChanges {
  add?: string[];
  remove?: ID[];
  /** tick / untick: maps to the list's first done / todo status */
  setDone?: { id: ID; done: boolean }[];
}

export interface UpdateTaskInput {
  id: ID;
  patch: TaskPatch;
  /** optimistic concurrency: the `updatedAt` the caller last saw */
  expectedUpdatedAt?: string;
  subtasks?: SubtaskChanges;
}

const EDITABLE: (keyof TaskPatch)[] = ['title', 'description', 'statusId', 'priority', 'assigneeIds', 'dueDate'];

/** Update a task and (optionally) its subtasks — all or nothing. */
export function updateTask(data: Data, ctx: MutationCtx, input: UpdateTaskInput): MutationResult<Task> {
  const updated = updateSingleTask(data, ctx, input);
  const changes = input.subtasks;
  if (!updated.ok || !changes) return updated;
  const parent = updated.data.value;
  const hasChanges = Boolean(changes.add?.length || changes.remove?.length || changes.setDone?.length);
  if (!hasChanges) return updated;
  if (parent.parentTaskId) return validation('Subtasks can only be one level deep.');

  const isOwnSubtask = (id: ID) => data.tasks[id]?.parentTaskId === parent.id;
  const fail = (what: string, message: string) => validation(`${what}: ${message}`, { subtasks: `${what}: ${message}` });
  let next = updated.data.data;

  for (const id of changes.remove ?? []) {
    if (!isOwnSubtask(id)) return fail('Subtask', 'not part of this task.');
    const r = deleteTask(next, ctx, { id });
    if (!r.ok) return fail(`“${data.tasks[id]?.title}”`, r.error.message);
    next = r.data.data;
  }

  const statuses = statusesOfList(next, parent.primaryListId);
  for (const { id, done } of changes.setDone ?? []) {
    if (!isOwnSubtask(id)) return fail('Subtask', 'not part of this task.');
    const current = next.statuses[next.tasks[id]!.statusId];
    if ((current?.category === 'done') === done) continue; // already in the requested state
    const target = statuses.find((s) => s.category === (done ? 'done' : 'todo')) ?? statuses[0];
    if (!target) return validation('This list has no statuses configured.');
    const r = updateSingleTask(next, ctx, { id, patch: { statusId: target.id } });
    if (!r.ok) return fail(`“${data.tasks[id]?.title}”`, r.error.message);
    next = r.data.data;
  }

  for (const [i, title] of (changes.add ?? []).entries()) {
    const r = createSingleTask(next, ctx, { listId: parent.primaryListId, title, parentTaskId: parent.id });
    if (!r.ok) return fail(`New subtask ${i + 1}`, r.error.message);
    next = r.data.data;
  }
  return ok({ data: next, value: next.tasks[parent.id]! });
}

function updateSingleTask(data: Data, ctx: MutationCtx, input: Omit<UpdateTaskInput, 'subtasks'>): MutationResult<Task> {
  const found = getActiveTask(data, input.id);
  if (!found.ok) return found;
  const task = found.data;

  const access = assertListAccess(data, ctx.actorId, task.primaryListId);
  if (!access.ok) return access;
  if (input.expectedUpdatedAt && input.expectedUpdatedAt !== task.updatedAt) return conflict();

  const fields = validateTaskFields(
    data,
    task.primaryListId,
    {
      title: input.patch.title ?? task.title,
      description: 'description' in input.patch ? input.patch.description : task.description,
      statusId: input.patch.statusId ?? task.statusId,
      priority: input.patch.priority ?? task.priority,
      assigneeIds: input.patch.assigneeIds ?? task.assigneeIds,
      dueDate: 'dueDate' in input.patch ? input.patch.dueDate : task.dueDate,
      parentTaskId: task.parentTaskId,
    },
    task.id,
  );
  if (!fields.ok) return fields;

  const changed = EDITABLE.filter((k) => JSON.stringify(fields.data[k]) !== JSON.stringify(task[k]));
  if (changed.length === 0) return ok({ data, value: task });

  const tasks = { ...data.tasks };
  const updated: Task = { ...task, ...fields.data, updatedAt: ctx.now() };
  const statusChanged = updated.statusId !== task.statusId;

  if (statusChanged && !task.parentTaskId) {
    // leave the old column without gaps, append to the end of the new one
    applyOrder(tasks, columnTasks(data, task.primaryListId, task.statusId, task.id).map((t) => t.id), {});
    updated.position = columnTasks(data, task.primaryListId, updated.statusId, task.id).length;
  }
  tasks[task.id] = updated;

  const next = withActivity({ ...data, tasks }, ctx, statusChanged
    ? {
        verb: 'task.status_changed',
        containerId: task.primaryListId,
        taskId: task.id,
        meta: { taskTitle: updated.title, from: statusName(data, task.statusId), to: statusName(data, updated.statusId) },
      }
    : {
        verb: 'task.updated',
        containerId: task.primaryListId,
        taskId: task.id,
        meta: { taskTitle: updated.title, fields: changed },
      });
  return ok({ data: next.data, value: updated });
}

// ─── move (drag & drop, change list) ───────────────────────────────────────

export interface MoveTaskInput {
  id: ID;
  /** defaults to the current list */
  toListId?: ID;
  /** defaults to the current status, or the category-mapped status when changing list */
  toStatusId?: ID;
  /** index in the destination column; defaults to the end */
  toIndex?: number;
}

export interface MoveTaskValue {
  task: Task;
  /** prior versions of every task this move touched — enough to roll it back */
  previous: Record<ID, Task>;
  activityId?: ID;
}

export function moveTask(data: Data, ctx: MutationCtx, input: MoveTaskInput): MutationResult<MoveTaskValue> {
  const found = getActiveTask(data, input.id);
  if (!found.ok) return found;
  const task = found.data;

  const source = assertListAccess(data, ctx.actorId, task.primaryListId);
  if (!source.ok) return source;

  const toListId = input.toListId ?? task.primaryListId;
  const listChanged = toListId !== task.primaryListId;
  if (listChanged) {
    if (task.parentTaskId) return validation('Subtasks move with their parent. Move the parent task instead.');
    const target = assertListAccess(data, ctx.actorId, toListId);
    if (!target.ok) return target;
  }

  const toStatusId = input.toStatusId ?? (listChanged ? mapStatusToList(data, task.statusId, toListId) : task.statusId);
  if (!toStatusId || data.statuses[toStatusId]?.listId !== toListId) {
    return validation("Target status doesn't belong to the destination list.");
  }
  const statusChanged = toStatusId !== task.statusId;

  const tasks = { ...data.tasks };
  const previous: Record<ID, Task> = { [task.id]: task };
  const moved: Task = { ...task, primaryListId: toListId, statusId: toStatusId };
  const columnChanged = listChanged || statusChanged;

  if (columnChanged) {
    moved.updatedAt = ctx.now();
    if (!task.parentTaskId) {
      applyOrder(tasks, columnTasks(data, task.primaryListId, task.statusId, task.id).map((t) => t.id), previous);
    }
  }
  tasks[task.id] = moved;

  const destination = siblingsOf({ ...data, tasks }, moved, task.id).map((t) => t.id);
  applyOrder(tasks, moveId(destination, task.id, input.toIndex ?? destination.length), previous);

  if (listChanged) {
    // keep subtasks in the parent's list with a valid status for that list
    for (const sub of subtasksOf(data, task.id)) {
      previous[sub.id] ??= sub;
      tasks[sub.id] = {
        ...tasks[sub.id]!,
        primaryListId: toListId,
        statusId: mapStatusToList(data, sub.statusId, toListId) ?? toStatusId,
        updatedAt: ctx.now(),
      };
    }
  }

  let nextData: Data = { ...data, tasks };
  let activityId: ID | undefined;
  if (columnChanged) {
    const next = withActivity(nextData, ctx, listChanged
      ? {
          verb: 'task.moved',
          containerId: toListId,
          taskId: task.id,
          meta: { taskTitle: task.title, from: listName(data, task.primaryListId), to: listName(data, toListId) },
        }
      : {
          verb: 'task.status_changed',
          containerId: toListId,
          taskId: task.id,
          meta: { taskTitle: task.title, from: statusName(data, task.statusId), to: statusName(data, toStatusId) },
        });
    nextData = next.data;
    activityId = next.activityId;
  }
  return ok({ data: nextData, value: { task: tasks[task.id]!, previous, activityId } });
}

// ─── delete / restore (soft) ───────────────────────────────────────────────

export function deleteTask(data: Data, ctx: MutationCtx, input: { id: ID }): MutationResult<Task> {
  const found = getActiveTask(data, input.id);
  if (!found.ok) return found;
  const task = found.data;
  const access = assertListAccess(data, ctx.actorId, task.primaryListId);
  if (!access.ok) return access;

  const now = ctx.now();
  const tasks = { ...data.tasks, [task.id]: { ...task, archivedAt: now, updatedAt: now } };
  for (const sub of subtasksOf(data, task.id)) tasks[sub.id] = { ...sub, archivedAt: now, updatedAt: now };
  applyOrder(tasks, siblingsOf(data, task, task.id).map((t) => t.id), {});

  const next = withActivity({ ...data, tasks }, ctx, {
    verb: 'task.deleted',
    containerId: task.primaryListId,
    taskId: task.id,
    meta: { taskTitle: task.title },
  });
  return ok({ data: next.data, value: tasks[task.id]! });
}

/** Undo for a delete: un-archive the task (and the subtasks archived with it). */
export function restoreTask(data: Data, ctx: MutationCtx, input: { id: ID }): MutationResult<Task> {
  const task = data.tasks[input.id];
  if (!task || !task.archivedAt) return notFound('Archived task');
  const access = assertListAccess(data, ctx.actorId, task.primaryListId);
  if (!access.ok) return access;
  if (task.parentTaskId && getActiveTask(data, task.parentTaskId).ok === false) {
    return validation('Restore the parent task first.');
  }
  if (!data.statuses[task.statusId] || data.statuses[task.statusId]!.listId !== task.primaryListId) {
    return validation("The task's status no longer exists on its list.");
  }

  const now = ctx.now();
  const restored: Task = { ...task, archivedAt: undefined, updatedAt: now, position: siblingsOf(data, task).length };
  const tasks = { ...data.tasks, [task.id]: restored };
  for (const sub of Object.values(data.tasks)) {
    if (sub.parentTaskId === task.id && sub.archivedAt === task.archivedAt) {
      tasks[sub.id] = { ...sub, archivedAt: undefined, updatedAt: now };
    }
  }
  return ok({ data: { ...data, tasks }, value: restored });
}

// ─── bulk delete / restore ─────────────────────────────────────────────────

/** Delete several tasks at once — all or nothing (one forbidden task cancels the whole batch). */
export function deleteTasks(data: Data, ctx: MutationCtx, input: { ids: ID[] }): MutationResult<Task[]> {
  const ids = [...new Set(input.ids)];
  if (ids.length === 0) return validation('Select at least one task.');
  // a subtask goes with its parent, so don't delete it twice
  const roots = ids.filter((id) => !(data.tasks[id]?.parentTaskId && ids.includes(data.tasks[id]!.parentTaskId!)));
  let next = data;
  const deleted: Task[] = [];
  for (const id of roots) {
    const r = deleteTask(next, ctx, { id });
    if (!r.ok) return r.error.code === 'NOT_FOUND' ? r : { ok: false, error: { ...r.error, message: `“${data.tasks[id]?.title ?? id}”: ${r.error.message}` } };
    next = r.data.data;
    deleted.push(r.data.value);
  }
  return ok({ data: next, value: deleted });
}

/** Undo for a bulk delete. */
export function restoreTasks(data: Data, ctx: MutationCtx, input: { ids: ID[] }): MutationResult<Task[]> {
  let next = data;
  const restored: Task[] = [];
  for (const id of input.ids) {
    const r = restoreTask(next, ctx, { id });
    if (!r.ok) return r;
    next = r.data.data;
    restored.push(r.data.value);
  }
  return ok({ data: next, value: restored });
}
