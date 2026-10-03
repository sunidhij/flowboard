import type { Activity } from '@/domain/types';

const FIELD_LABEL: Record<string, string> = {
  title: 'title',
  description: 'description',
  priority: 'priority',
  assigneeIds: 'assignees',
  dueDate: 'due date',
  statusId: 'status',
};

/** Human sentence for an activity entry, minus the actor (rendered separately). */
export function describeActivity(a: Activity): { verb: string; subject?: string; detail?: string } {
  const { meta } = a;
  switch (a.verb) {
    case 'task.created':
      return { verb: 'created', subject: meta.taskTitle, detail: meta.to ? `in ${meta.to}` : undefined };
    case 'task.updated':
      return {
        verb: 'updated',
        subject: meta.taskTitle,
        detail: meta.fields?.length ? `(${meta.fields.map((f) => FIELD_LABEL[f] ?? f).join(', ')})` : undefined,
      };
    case 'task.status_changed':
      return { verb: 'moved', subject: meta.taskTitle, detail: `from ${meta.from} to ${meta.to}` };
    case 'task.moved':
      return { verb: 'moved', subject: meta.taskTitle, detail: `from list ${meta.from} to ${meta.to}` };
    case 'task.deleted':
      return { verb: 'deleted', subject: meta.taskTitle };
    case 'container.created':
      return { verb: `created ${meta.to}`, subject: meta.name };
    case 'container.renamed':
      return { verb: 'renamed', subject: meta.from, detail: `to ${meta.to}` };
    case 'container.archived':
      return { verb: `archived ${meta.to}`, subject: meta.name };
    case 'container.restored':
      return { verb: `restored ${meta.to}`, subject: meta.name };
  }
}
