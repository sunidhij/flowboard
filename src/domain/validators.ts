import { ok, validation, type Result } from './errors';
import {
  CONTAINER_NAME_MAX,
  DESCRIPTION_MAX,
  PRIORITIES,
  TITLE_MAX,
  type ContainerType,
  type Data,
  type ID,
  type Priority,
  type Task,
} from './types';
import { isActive } from './permissions';

/**
 * The only legal parent → child relationships. Lists hold tasks, not containers.
 * Folders are optional: a list may sit directly in a space (deliberate extension of
 * the brief's strict workspace → space → folder → list chain, as in ClickUp).
 */
export const CHILD_TYPES: Record<ContainerType, ContainerType[]> = {
  workspace: ['space'],
  space: ['folder', 'list'],
  folder: ['list'],
  list: [],
};

export function validateParent(data: Data, parentId: ID | null, childType: ContainerType): Result<true> {
  if (childType === 'workspace') return validation('Only one workspace is supported.');
  if (!parentId) return validation(`A ${childType} needs a parent.`);
  const parent = data.containers[parentId];
  if (!parent || !isActive(data, parentId)) return validation('Parent container does not exist or is archived.');
  const allowed = CHILD_TYPES[parent.type];
  if (!allowed.includes(childType)) {
    return validation(
      allowed.length
        ? `A ${parent.type} can only contain ${allowed.map((t) => `${t}s`).join(' or ')}, not ${childType}s.`
        : `A ${parent.type} cannot contain other containers.`,
    );
  }
  return ok(true);
}

export function validateContainerName(raw: string): Result<string> {
  const name = raw.trim();
  if (!name) return validation('Name is required.', { name: 'Name is required.' });
  if (name.length > CONTAINER_NAME_MAX) {
    const msg = `Name must be at most ${CONTAINER_NAME_MAX} characters.`;
    return validation(msg, { name: msg });
  }
  return ok(name);
}

export interface TaskFields {
  title: string;
  description?: string;
  statusId: ID;
  priority: Priority;
  assigneeIds: ID[];
  dueDate?: string;
  parentTaskId?: ID;
}

/**
 * Validate and normalize task fields against a list. Returns all field errors at once
 * so forms can show them inline.
 */
export function validateTaskFields(
  data: Data,
  listId: ID,
  input: TaskFields,
  selfId?: ID,
): Result<TaskFields> {
  const fields: Record<string, string> = {};
  const title = input.title.trim();
  if (!title) fields.title = 'Title is required.';
  else if (title.length > TITLE_MAX) fields.title = `Title must be at most ${TITLE_MAX} characters.`;

  const description = input.description?.trim() || undefined;
  if (description && description.length > DESCRIPTION_MAX)
    fields.description = `Description must be at most ${DESCRIPTION_MAX} characters.`;

  const status = data.statuses[input.statusId];
  if (!status || status.listId !== listId) fields.statusId = "Status doesn't belong to this list.";

  if (!PRIORITIES.includes(input.priority)) fields.priority = 'Unknown priority.';

  const assigneeIds = [...new Set(input.assigneeIds)];
  if (assigneeIds.some((id) => !data.users[id])) fields.assigneeIds = 'Unknown assignee.';

  let dueDate: string | undefined;
  if (input.dueDate) {
    const d = new Date(input.dueDate);
    if (Number.isNaN(d.getTime())) fields.dueDate = 'Due date must be a valid date.';
    else dueDate = d.toISOString();
  }

  if (input.parentTaskId) {
    const parent: Task | undefined = data.tasks[input.parentTaskId];
    if (!parent || parent.archivedAt) fields.parentTaskId = 'Parent task not found.';
    else if (parent.id === selfId) fields.parentTaskId = 'A task cannot be its own parent.';
    else if (parent.parentTaskId) fields.parentTaskId = 'Subtasks can only be one level deep.';
    else if (parent.primaryListId !== listId) fields.parentTaskId = 'Subtasks must live in the same list as their parent.';
  }

  const firstError = Object.values(fields)[0];
  if (firstError) return validation(firstError, fields);
  return ok({ ...input, title, description, assigneeIds, dueDate });
}
