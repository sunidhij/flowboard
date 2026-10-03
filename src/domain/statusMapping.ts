import type { Data, ID, Status } from './types';
import { byPosition } from './ordering';

export function statusesOfList(data: Data, listId: ID): Status[] {
  return Object.values(data.statuses)
    .filter((s) => s.listId === listId)
    .sort(byPosition);
}

/**
 * When a task moves to another list its status id is meaningless there.
 * Map it to the first status in the target list with the same category,
 * falling back to the target list's first status.
 */
export function mapStatusToList(data: Data, fromStatusId: ID, targetListId: ID): ID | undefined {
  const target = statusesOfList(data, targetListId);
  const from = data.statuses[fromStatusId];
  if (from?.listId === targetListId) return from.id;
  return (from && target.find((s) => s.category === from.category))?.id ?? target[0]?.id;
}

export function defaultStatuses(listId: ID, makeId: () => ID): Status[] {
  return [
    { id: makeId(), listId, name: 'To do', category: 'todo', color: 'gray', position: 0 },
    { id: makeId(), listId, name: 'In progress', category: 'in_progress', color: 'amber', position: 1 },
    { id: makeId(), listId, name: 'Done', category: 'done', color: 'green', position: 2 },
  ];
}
