/**
 * User-facing copy for a failed request (network / server), per operation.
 * Format: "We were unable to <action>. Please try again." — singular/plural by count.
 *
 * Validation and permission errors keep their own specific messages (they tell the
 * user what to fix); these only cover "it didn't go through, retry".
 */
import type { ContainerType, Data } from '@/domain/types';
import type { MutationInput, MutationName } from './thunks';

type Describe<K extends MutationName> = (input: MutationInput<K>, data: Data) => string;

export const failureMessage = (action: string) => `We were unable to ${action}. Please try again.`;

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
const containerNoun = (data: Data, id: string): ContainerType | 'item' => data.containers[id]?.type ?? 'item';

export const FAILURE_ACTIONS: { [K in MutationName]: Describe<K> } = {
  createTask: (i) =>
    i.parentTaskId ? 'add your subtask' : i.subtaskTitles?.length ? 'create your task and its subtasks' : 'create your task',
  updateTask: () => 'save your changes',
  moveTask: () => 'move your task',
  deleteTask: (i, data) => (data.tasks[i.id]?.parentTaskId ? 'delete your subtask' : 'delete your task'),
  restoreTask: () => 'restore your task',
  deleteTasks: (i) => plural(i.ids.length, 'delete your task', 'delete your tasks'),
  restoreTasks: (i) => plural(i.ids.length, 'restore your task', 'restore your tasks'),
  createContainer: (i) => `create your ${i.type}`,
  renameContainer: (i, data) => `rename your ${containerNoun(data, i.id)}`,
  archiveContainer: (i, data) => `archive your ${containerNoun(data, i.id)}`,
  restoreContainer: (i, data) => `restore your ${containerNoun(data, i.id)}`,
  reorderContainer: (i, data) => `move your ${containerNoun(data, i.id)}`,
  createStatus: () => 'add the status',
  updateStatus: () => 'update the status',
  moveStatus: () => 'move the status',
  deleteStatus: () => 'delete the status',
};

export function describeFailure<K extends MutationName>(name: K, input: MutationInput<K>, data: Data): string {
  const describe = FAILURE_ACTIONS[name] as Describe<K>;
  return failureMessage(describe(input, data));
}
