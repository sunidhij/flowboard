import { PRIORITY_RANK, type ID, type Task } from '@/domain/types';

export type SortKey = 'dueDate' | 'priority';
export type Sort = { key: SortKey; dir: 'asc' | 'desc' } | null;

/** Clicking a header cycles: ascending → descending → off. */
export const nextSort = (current: Sort, key: SortKey): Sort =>
  current?.key !== key ? { key, dir: 'asc' } : current.dir === 'asc' ? { key, dir: 'desc' } : null;

/** Status order, then manual position. Sorting by a key keeps this as the tiebreaker. */
export function sortTasks(tasks: Task[], statusOrder: Map<ID, number>, sort: Sort): Task[] {
  const base = (a: Task, b: Task) =>
    (statusOrder.get(a.statusId) ?? 0) - (statusOrder.get(b.statusId) ?? 0) || a.position - b.position;
  if (!sort) return [...tasks].sort(base);
  const dir = sort.dir === 'asc' ? 1 : -1;
  return [...tasks].sort((a, b) => {
    if (sort.key === 'priority') return dir * (PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]) || base(a, b);
    // tasks without a due date always go last, whatever the direction
    if (!a.dueDate || !b.dueDate) return (a.dueDate ? -1 : 0) + (b.dueDate ? 1 : 0) || base(a, b);
    return dir * a.dueDate.localeCompare(b.dueDate) || base(a, b);
  });
}
