import { describe, expect, it } from 'vitest';
import { IDS, USER_IDS } from '@/data/seed';
import { TITLE_MAX, type Data } from '@/domain/types';
import { freshSeed, testCtx } from '@/test/factory';
import { columnTasks, createTask, deleteTask, deleteTasks, moveTask, restoreTask, restoreTasks, subtasksOf, updateTask } from './tasks';

const ctx = testCtx();
const ids = (data: Data, listId: string, statusId: string) => columnTasks(data, listId, statusId).map((t) => t.id);
const positions = (data: Data, listId: string, statusId: string) =>
  columnTasks(data, listId, statusId).map((t) => t.position);

function expectError<T>(r: { ok: boolean; error?: { code: string } } & T, code: string) {
  expect(r.ok).toBe(false);
  expect(r.error?.code).toBe(code);
}

describe('createTask', () => {
  it('creates a task at the end of the default (first) status column', () => {
    const r = createTask(freshSeed(), ctx, { listId: IDS.backlog, title: '  New thing  ' });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.data.value).toMatchObject({ title: 'New thing', statusId: 'st_bl_todo', priority: 'none', position: 4 });
    expect(r.data.data.activity[0]).toMatchObject({ verb: 'task.created', taskId: r.data.value.id });
  });

  it('rejects empty and over-long titles', () => {
    expectError(createTask(freshSeed(), ctx, { listId: IDS.backlog, title: '   ' }), 'VALIDATION');
    const tooLong = createTask(freshSeed(), ctx, { listId: IDS.backlog, title: 'x'.repeat(TITLE_MAX + 1) });
    expectError(tooLong, 'VALIDATION');
    expect(!tooLong.ok && tooLong.error.fields?.title).toMatch(/500/);
    expect(createTask(freshSeed(), ctx, { listId: IDS.backlog, title: 'x'.repeat(TITLE_MAX) }).ok).toBe(true);
  });

  it('rejects a status from another list', () => {
    expectError(createTask(freshSeed(), ctx, { listId: IDS.backlog, title: 'x', statusId: 'st_sp_todo' }), 'VALIDATION');
  });

  it('rejects unknown assignees and invalid dates', () => {
    expectError(createTask(freshSeed(), ctx, { listId: IDS.backlog, title: 'x', assigneeIds: ['u_nope'] }), 'VALIDATION');
    expectError(createTask(freshSeed(), ctx, { listId: IDS.backlog, title: 'x', dueDate: 'not-a-date' }), 'VALIDATION');
  });

  it('rejects lists that do not exist or are not lists', () => {
    expectError(createTask(freshSeed(), ctx, { listId: 'ls_missing', title: 'x' }), 'NOT_FOUND');
    expectError(createTask(freshSeed(), ctx, { listId: IDS.q2Launch, title: 'x' }), 'NOT_FOUND');
  });

  it('allows one level of subtasks only, in the same list', () => {
    expect(createTask(freshSeed(), ctx, { listId: IDS.sprint, title: 'sub', parentTaskId: 't_8' }).ok).toBe(true);
    expectError(createTask(freshSeed(), ctx, { listId: IDS.sprint, title: 'subsub', parentTaskId: 't_8a' }), 'VALIDATION');
    expectError(createTask(freshSeed(), ctx, { listId: IDS.backlog, title: 'cross', parentTaskId: 't_8' }), 'VALIDATION');
  });
});

describe('createTask with subtasks', () => {
  it('creates the task and its subtasks together', () => {
    const r = createTask(freshSeed(), ctx, { listId: IDS.backlog, title: 'Launch', subtaskTitles: ['Write copy', 'Ship'] });
    if (!r.ok) throw new Error(r.error.message);
    expect(subtasksOf(r.data.data, r.data.value.id).map((t) => [t.title, t.position])).toEqual([
      ['Write copy', 0],
      ['Ship', 1],
    ]);
  });

  it('is all-or-nothing: one invalid subtask creates nothing', () => {
    const data = freshSeed();
    const r = createTask(data, ctx, { listId: IDS.backlog, title: 'Launch', subtaskTitles: ['ok', 'x'.repeat(TITLE_MAX + 1)] });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.fields?.subtasks).toMatch(/^Subtask 2: Title must be at most 500/);
    // nothing leaked into the data
    expect(Object.values(data.tasks).some((t) => t.title === 'Launch')).toBe(false);
  });

  it('rejects subtasks of a subtask', () => {
    expectError(
      createTask(freshSeed(), ctx, { listId: IDS.sprint, title: 'sub', parentTaskId: 't_8', subtaskTitles: ['deeper'] }),
      'VALIDATION',
    );
  });
});

describe('updateTask', () => {
  it('records the changed fields in the activity feed', () => {
    const r = updateTask(freshSeed(), ctx, { id: 't_1', patch: { priority: 'urgent', title: 'Renamed' } });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.data.data.activity[0]).toMatchObject({ verb: 'task.updated', meta: { fields: ['title', 'priority'] } });
  });

  it('is a no-op (no activity) when nothing changed', () => {
    const data = freshSeed();
    const r = updateTask(data, ctx, { id: 't_1', patch: { title: data.tasks.t_1!.title } });
    expect(r.ok && r.data.data).toBe(data);
  });

  it('changing status moves the task to the end of the new column and closes the gap', () => {
    const r = updateTask(freshSeed(), ctx, { id: 't_1', patch: { statusId: 'st_bl_done' } });
    if (!r.ok) throw new Error(r.error.message);
    expect(ids(r.data.data, IDS.backlog, 'st_bl_done')).toEqual(['t_6', 't_1']);
    expect(positions(r.data.data, IDS.backlog, 'st_bl_todo')).toEqual([0, 1, 2]);
  });

  it('detects conflicting (stale) updates', () => {
    const data = freshSeed();
    const seen = data.tasks.t_1!.updatedAt;
    const first = updateTask(data, ctx, { id: 't_1', patch: { title: 'A' }, expectedUpdatedAt: seen });
    if (!first.ok) throw new Error(first.error.message);
    const second = updateTask(first.data.data, ctx, { id: 't_1', patch: { title: 'B' }, expectedUpdatedAt: seen });
    expectError(second, 'CONFLICT');
  });

  it('cannot update a deleted task', () => {
    const del = deleteTask(freshSeed(), ctx, { id: 't_1' });
    if (!del.ok) throw new Error(del.error.message);
    expectError(updateTask(del.data.data, ctx, { id: 't_1', patch: { title: 'zombie' } }), 'NOT_FOUND');
  });
});

describe('updateTask with staged subtask changes', () => {
  it('ticks, unticks, adds and removes subtasks together with the task fields', () => {
    // t_8 (Sprint 12) has t_8a (done) and t_8b (in progress)
    const r = updateTask(freshSeed(), ctx, {
      id: 't_8',
      patch: { priority: 'high' },
      subtasks: { setDone: [{ id: 't_8a', done: false }, { id: 't_8b', done: true }], add: ['Docs'], remove: [] },
    });
    if (!r.ok) throw new Error(r.error.message);
    const data = r.data.data;
    expect(data.tasks.t_8!.priority).toBe('high');
    expect(data.tasks.t_8a!.statusId).toBe('st_sp_todo');
    expect(data.tasks.t_8b!.statusId).toBe('st_sp_done');
    expect(subtasksOf(data, 't_8').map((t) => t.title)).toEqual(['SAML metadata endpoint', 'Session handoff to SPA', 'Docs']);
  });

  it('removes subtasks (soft delete)', () => {
    const r = updateTask(freshSeed(), ctx, { id: 't_8', patch: {}, subtasks: { remove: ['t_8a'] } });
    if (!r.ok) throw new Error(r.error.message);
    expect(subtasksOf(r.data.data, 't_8').map((t) => t.id)).toEqual(['t_8b']);
  });

  it('is all-or-nothing: an invalid new subtask rolls back the field change too', () => {
    const r = updateTask(freshSeed(), ctx, {
      id: 't_8',
      patch: { title: 'Renamed' },
      subtasks: { setDone: [{ id: 't_8b', done: true }], add: ['x'.repeat(TITLE_MAX + 1)] },
    });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.fields?.subtasks).toMatch(/^New subtask 1: Title must be at most 500/);
  });

  it("refuses to touch another task's subtasks", () => {
    expectError(updateTask(freshSeed(), ctx, { id: 't_1', patch: {}, subtasks: { remove: ['t_8a'] } }), 'VALIDATION');
  });
});

describe('moveTask', () => {
  it('reorders within a column', () => {
    const r = moveTask(freshSeed(), ctx, { id: 't_7', toIndex: 0 });
    if (!r.ok) throw new Error(r.error.message);
    expect(ids(r.data.data, IDS.backlog, 'st_bl_todo')).toEqual(['t_7', 't_1', 't_2', 't_3']);
    expect(positions(r.data.data, IDS.backlog, 'st_bl_todo')).toEqual([0, 1, 2, 3]);
    expect(r.data.value.activityId).toBeUndefined(); // pure reorders don't spam the feed
  });

  it('moves across columns at a given index and re-indexes both columns', () => {
    const r = moveTask(freshSeed(), ctx, { id: 't_2', toStatusId: 'st_bl_prog', toIndex: 1 });
    if (!r.ok) throw new Error(r.error.message);
    const data = r.data.data;
    expect(ids(data, IDS.backlog, 'st_bl_prog')).toEqual(['t_4', 't_2', 't_5']);
    expect(positions(data, IDS.backlog, 'st_bl_todo')).toEqual([0, 1, 2]);
    expect(data.activity[0]).toMatchObject({ verb: 'task.status_changed', meta: { from: 'To do', to: 'In progress' } });
  });

  it('returns every touched task so the move can be rolled back', () => {
    const before = freshSeed();
    const r = moveTask(before, ctx, { id: 't_2', toStatusId: 'st_bl_prog', toIndex: 0 });
    if (!r.ok) throw new Error(r.error.message);
    const reverted = { ...r.data.data.tasks, ...r.data.value.previous };
    expect(reverted).toEqual(before.tasks);
  });

  it('moving to another list remaps the status by category and carries subtasks', () => {
    const r = moveTask(freshSeed(), ctx, { id: 't_8', toListId: IDS.backlog });
    if (!r.ok) throw new Error(r.error.message);
    const data = r.data.data;
    expect(data.tasks.t_8).toMatchObject({ primaryListId: IDS.backlog, statusId: 'st_bl_prog' });
    expect(data.tasks.t_8a).toMatchObject({ primaryListId: IDS.backlog, statusId: 'st_bl_done' });
    expect(data.tasks.t_8b).toMatchObject({ primaryListId: IDS.backlog, statusId: 'st_bl_prog' });
    expect(data.activity[0]).toMatchObject({ verb: 'task.moved', meta: { from: 'Sprint 12', to: 'Backlog' } });
  });

  it('rejects a status that does not belong to the destination list', () => {
    expectError(moveTask(freshSeed(), ctx, { id: 't_1', toStatusId: 'st_sp_done' }), 'VALIDATION');
  });

  it('rejects moving into a list the user cannot see', () => {
    expectError(moveTask(freshSeed(), testCtx(USER_IDS.bob), { id: 't_1', toListId: IDS.social }), 'FORBIDDEN');
  });

  it('rejects moving a subtask to another list on its own', () => {
    expectError(moveTask(freshSeed(), ctx, { id: 't_8a', toListId: IDS.backlog }), 'VALIDATION');
  });

  it('clamps out-of-range indexes', () => {
    const r = moveTask(freshSeed(), ctx, { id: 't_1', toIndex: 99 });
    if (!r.ok) throw new Error(r.error.message);
    expect(ids(r.data.data, IDS.backlog, 'st_bl_todo').at(-1)).toBe('t_1');
  });
});

describe('deleteTask / restoreTask', () => {
  it('soft-deletes the task with its subtasks and restores both', () => {
    const del = deleteTask(freshSeed(), ctx, { id: 't_8' });
    if (!del.ok) throw new Error(del.error.message);
    expect(del.data.data.tasks.t_8!.archivedAt).toBeDefined();
    expect(subtasksOf(del.data.data, 't_8')).toHaveLength(0);
    expect(ids(del.data.data, IDS.sprint, 'st_sp_prog')).toEqual([]);

    const res = restoreTask(del.data.data, ctx, { id: 't_8' });
    if (!res.ok) throw new Error(res.error.message);
    expect(subtasksOf(res.data.data, 't_8').map((t) => t.id)).toEqual(['t_8a', 't_8b']);
  });

  it('cannot restore a subtask while its parent is deleted', () => {
    const del = deleteTask(freshSeed(), ctx, { id: 't_8' });
    if (!del.ok) throw new Error(del.error.message);
    expectError(restoreTask(del.data.data, ctx, { id: 't_8a' }), 'VALIDATION');
  });
});

describe('deleteTasks / restoreTasks (bulk)', () => {
  it('deletes several tasks at once and undoes them together', () => {
    const del = deleteTasks(freshSeed(), ctx, { ids: ['t_1', 't_2', 't_2'] });
    if (!del.ok) throw new Error(del.error.message);
    expect(del.data.value.map((t) => t.id)).toEqual(['t_1', 't_2']);
    expect(ids(del.data.data, IDS.backlog, 'st_bl_todo')).toEqual(['t_3', 't_7']);
    const res = restoreTasks(del.data.data, ctx, { ids: ['t_1', 't_2'] });
    if (!res.ok) throw new Error(res.error.message);
    expect(ids(res.data.data, IDS.backlog, 'st_bl_todo').sort()).toEqual(['t_1', 't_2', 't_3', 't_7']);
  });

  it('is all-or-nothing: one task the user cannot access cancels the batch', () => {
    const r = deleteTasks(freshSeed(), testCtx(USER_IDS.bob), { ids: ['t_1', 't_14'] });
    expect(!r.ok && r.error.code).toBe('FORBIDDEN');
  });

  it('a subtask selected with its parent is deleted once, with the parent', () => {
    const r = deleteTasks(freshSeed(), ctx, { ids: ['t_8', 't_8a'] });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.data.value.map((t) => t.id)).toEqual(['t_8']);
    expect(r.data.data.tasks.t_8a!.archivedAt).toBeDefined();
  });
});
