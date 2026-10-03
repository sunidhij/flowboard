export type ID = string;

export type ContainerType = 'workspace' | 'space' | 'folder' | 'list';
export type Visibility = 'public' | 'private';

export interface Container {
  id: ID;
  name: string;
  type: ContainerType;
  /** null only for the workspace root */
  parentId: ID | null;
  /** sibling order, 0..n-1 among active siblings */
  position: number;
  visibility: Visibility;
  /** soft-delete marker; archived containers hide their whole subtree */
  archivedAt?: string;
}

export type StatusCategory = 'todo' | 'in_progress' | 'done';
export const STATUS_CATEGORIES: StatusCategory[] = ['todo', 'in_progress', 'done'];

/** Color tokens, mapped to Tailwind classes in the UI layer. */
export type ColorToken = 'gray' | 'blue' | 'amber' | 'green' | 'red' | 'violet' | 'pink' | 'teal';
export const COLOR_TOKENS: ColorToken[] = ['gray', 'blue', 'teal', 'green', 'amber', 'red', 'pink', 'violet'];
export const STATUS_NAME_MAX = 40;

export interface Status {
  id: ID;
  listId: ID;
  name: string;
  category: StatusCategory;
  color: ColorToken;
  position: number;
}

export type Priority = 'urgent' | 'high' | 'normal' | 'low' | 'none';
export const PRIORITIES: Priority[] = ['urgent', 'high', 'normal', 'low', 'none'];
/** Lower rank sorts first (urgent → none). */
export const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, high: 1, normal: 2, low: 3, none: 4 };

export const TITLE_MAX = 500;
export const DESCRIPTION_MAX = 10_000;
export const CONTAINER_NAME_MAX = 80;

export interface Task {
  id: ID;
  title: string;
  description?: string;
  statusId: ID;
  priority: Priority;
  assigneeIds: ID[];
  /** ISO datetime */
  dueDate?: string;
  /** order within its (list, status) column; subtasks are ordered within their parent */
  position: number;
  primaryListId: ID;
  /** one level of subtasks only */
  parentTaskId?: ID;
  createdAt: string;
  updatedAt: string;
  /** soft-delete marker */
  archivedAt?: string;
}

export type Role = 'admin' | 'member';

export interface User {
  id: ID;
  name: string;
  role: Role;
  avatarColor: ColorToken;
}

export type GrantMode = 'allow' | 'deny';

export interface Grant {
  id: ID;
  resourceId: ID;
  userId: ID;
  mode: GrantMode;
}

export type ActivityVerb =
  | 'task.created'
  | 'task.updated'
  | 'task.status_changed'
  | 'task.moved'
  | 'task.deleted'
  | 'container.created'
  | 'container.renamed'
  | 'container.archived'
  | 'container.restored';

export interface Activity {
  id: ID;
  actorId: ID;
  verb: ActivityVerb;
  /** container the event happened in (the list for task events) — used for permission filtering */
  containerId: ID;
  taskId?: ID;
  /** denormalized labels so the feed still reads well after renames/deletes */
  meta: { taskTitle?: string; from?: string; to?: string; name?: string; fields?: string[] };
  at: string;
}

/** The whole "database". Normalized maps keyed by id. */
export interface Data {
  containers: Record<ID, Container>;
  statuses: Record<ID, Status>;
  tasks: Record<ID, Task>;
  users: Record<ID, User>;
  grants: Grant[];
  /** newest first */
  activity: Activity[];
}
