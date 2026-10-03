import { describe, expect, it } from 'vitest';
import { IDS, USER_IDS } from '@/data/seed';
import { statusesOfList } from '@/domain/statusMapping';
import type { Data } from '@/domain/types';
import { freshSeed, testCtx } from '@/test/factory';
import { createStatus, deleteStatus, moveStatus, updateStatus } from './statuses';
import { columnTasks, createTask } from './tasks';

const ctx = testCtx();
const names = (data: Data, listId: string) => statusesOfList(data, listId).map((s) => s.name);

/** The core invariant from the brief: tasks only use statuses defined on their list. */
const everyTaskUsesOwnListStatus = (data: Data) =>
  Object.values(data.tasks).every((t) => data.statuses[t.statusId]?.listId === t.primaryListId);

describe('status configuration', () => {
  it('admin can add a status; it is placed after the last status of its category', () => {
    const r = createStatus(freshSeed(), ctx, { listId: IDS.backlog, name: 'In review', category: 'in_progress', color: 'violet' });
    if (!r.ok) throw new Error(r.error.message);
    expect(names(r.data.data, IDS.backlog)).toEqual(['To do', 'In progress', 'In review', 'Done']);
    expect(statusesOfList(r.data.data, IDS.backlog).map((s) => s.position)).toEqual([0, 1, 2, 3]);
    // and tasks can use it
    expect(createTask(r.data.data, ctx, { listId: IDS.backlog, title: 'x', statusId: r.data.value.id }).ok).toBe(true);
  });

  it('members cannot configure statuses', () => {
    const r = createStatus(freshSeed(), testCtx(USER_IDS.bob), { listId: IDS.backlog, name: 'Blocked', category: 'in_progress', color: 'red' });
    expect(!r.ok && r.error.code).toBe('FORBIDDEN');
    expect(updateStatus(freshSeed(), testCtx(USER_IDS.bob), { id: 'st_bl_todo', name: 'Nope' }).ok).toBe(false);
  });

  it('validates names: required, max length, unique per list (case-insensitive)', () => {
    const add = (name: string) => createStatus(freshSeed(), ctx, { listId: IDS.backlog, name, category: 'todo', color: 'gray' });
    expect(add('  ').ok).toBe(false);
    expect(add('x'.repeat(41)).ok).toBe(false);
    const dup = add('done');
    expect(!dup.ok && dup.error.fields?.name).toMatch(/already has a “done” status/);
    // same name in another list is fine
    expect(createStatus(freshSeed(), ctx, { listId: IDS.social, name: 'Done', category: 'done', color: 'green' }).ok).toBe(true);
    // renaming to its own name (different case) is fine
    expect(updateStatus(freshSeed(), ctx, { id: 'st_bl_done', name: 'DONE' }).ok).toBe(true);
  });

  it('reorders statuses', () => {
    const r = moveStatus(freshSeed(), ctx, { id: 'st_bl_done', toIndex: 0 });
    if (!r.ok) throw new Error(r.error.message);
    expect(names(r.data.data, IDS.backlog)).toEqual(['Done', 'To do', 'In progress']);
  });

  it('cannot delete the last status of a category (minimum todo / in_progress / done)', () => {
    const r = deleteStatus(freshSeed(), ctx, { id: 'st_bl_done' });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.message).toMatch(/at least one “Completed” status/);
  });

  it('deleting a status moves its tasks to another status of the same category', () => {
    // Sprint 12 has two in_progress statuses: In progress (t_8, t_8b) and In review (t_9)
    const r = deleteStatus(freshSeed(), ctx, { id: 'st_sp_review' });
    if (!r.ok) throw new Error(r.error.message);
    const data = r.data.data;
    expect(r.data.value).toMatchObject({ movedTo: { id: 'st_sp_prog' }, movedCount: 1 });
    expect(names(data, IDS.sprint)).toEqual(['To do', 'In progress', 'Done']);
    expect(columnTasks(data, IDS.sprint, 'st_sp_prog').map((t) => [t.id, t.position])).toEqual([
      ['t_8', 0],
      ['t_9', 1],
    ]);
    expect(everyTaskUsesOwnListStatus(data)).toBe(true);
  });

  it('also re-points archived tasks so restoring them stays valid', () => {
    const data = freshSeed();
    data.tasks.t_9 = { ...data.tasks.t_9!, archivedAt: '2026-01-01T00:00:00Z' };
    const r = deleteStatus(data, ctx, { id: 'st_sp_review' });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.data.data.tasks.t_9!.statusId).toBe('st_sp_prog');
    expect(r.data.value.movedCount).toBe(0);
  });
});
