import { describe, expect, it } from 'vitest';
import { IDS, USER_IDS } from '@/data/seed';
import { visibleListIds } from '@/domain/permissions';
import { statusesOfList } from '@/domain/statusMapping';
import { freshSeed, testCtx } from '@/test/factory';
import { activeChildren, archiveContainer, createContainer, renameContainer, reorderContainer, restoreContainer } from './containers';
import { createTask } from './tasks';

const ctx = testCtx();

describe('container hierarchy rules', () => {
  it.each([
    ['space', IDS.workspace],
    ['folder', IDS.engineering],
    ['list', IDS.q2Launch],
    ['list', IDS.engineering], // folders are optional: lists may sit directly in a space
  ] as const)('allows a %s under %s', (type, parentId) => {
    expect(createContainer(freshSeed(), ctx, { parentId, type, name: 'New' }).ok).toBe(true);
  });

  it.each([
    ['list', IDS.workspace, /workspace can only contain spaces/],
    ['folder', IDS.workspace, /workspace can only contain spaces/],
    ['folder', IDS.q2Launch, /folder can only contain lists/],
    ['space', IDS.engineering, /space can only contain folders or lists/],
    ['space', IDS.backlog, /list cannot contain/],
    ['folder', 'missing', /does not exist/],
  ] as const)('rejects a %s under %s', (type, parentId, message) => {
    const r = createContainer(freshSeed(), ctx, { parentId, type, name: 'Bad' });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatchObject({ code: 'VALIDATION', message: expect.stringMatching(message) });
  });

  it('new lists get a default todo / in_progress / done status set', () => {
    const r = createContainer(freshSeed(), ctx, { parentId: IDS.q2Launch, type: 'list', name: 'QA' });
    if (!r.ok) throw new Error(r.error.message);
    expect(statusesOfList(r.data.data, r.data.value.id).map((s) => s.category)).toEqual(['todo', 'in_progress', 'done']);
  });

  it('a list directly in a space behaves like any other list (tasks, visibility, archive)', () => {
    const r = createContainer(freshSeed(), ctx, { parentId: IDS.marketing, type: 'list', name: 'Inbox' });
    if (!r.ok) throw new Error(r.error.message);
    const listId = r.data.value.id;
    // ordered after the existing folder among the space's children
    expect(activeChildren(r.data.data, IDS.marketing).map((c) => c.name)).toEqual(['Campaigns', 'Inbox']);
    expect(createTask(r.data.data, ctx, { listId, title: 'Triage' }).ok).toBe(true);
    // inherits the private space's visibility: Carol (allowed) sees it, Bob does not
    expect(visibleListIds(r.data.data, USER_IDS.carol)).toContain(listId);
    expect(visibleListIds(r.data.data, USER_IDS.bob)).not.toContain(listId);
    // archiving the space hides it too
    const archived = archiveContainer(r.data.data, ctx, { id: IDS.marketing });
    if (!archived.ok) throw new Error(archived.error.message);
    expect(visibleListIds(archived.data.data, ctx.actorId)).not.toContain(listId);
  });

  it('validates names', () => {
    expect(renameContainer(freshSeed(), ctx, { id: IDS.backlog, name: '  ' }).ok).toBe(false);
    expect(renameContainer(freshSeed(), ctx, { id: IDS.backlog, name: 'x'.repeat(81) }).ok).toBe(false);
    const r = renameContainer(freshSeed(), ctx, { id: IDS.backlog, name: ' Icebox ' });
    expect(r.ok && r.data.value.name).toBe('Icebox');
  });
});

describe('archive (soft delete)', () => {
  it('archiving a folder hides its lists and blocks task mutations inside', () => {
    const r = archiveContainer(freshSeed(), ctx, { id: IDS.q2Launch });
    if (!r.ok) throw new Error(r.error.message);
    expect(visibleListIds(r.data.data, ctx.actorId)).toEqual([IDS.social]);
    const t = createTask(r.data.data, ctx, { listId: IDS.backlog, title: 'x' });
    expect(!t.ok && t.error.code).toBe('NOT_FOUND');
    // the tasks themselves are untouched, so restore brings everything back
    expect(r.data.data.tasks.t_1!.archivedAt).toBeUndefined();
  });

  it('restores to the end of its siblings', () => {
    const archived = archiveContainer(freshSeed(), ctx, { id: IDS.backlog });
    if (!archived.ok) throw new Error(archived.error.message);
    expect(archived.data.data.containers[IDS.sprint]!.position).toBe(0);
    const restored = restoreContainer(archived.data.data, ctx, { id: IDS.backlog });
    if (!restored.ok) throw new Error(restored.error.message);
    expect(activeChildren(restored.data.data, IDS.q2Launch).map((c) => c.id)).toEqual([IDS.sprint, IDS.backlog]);
  });

  it('cannot restore a child while its parent is archived', () => {
    const a = archiveContainer(freshSeed(), ctx, { id: IDS.backlog });
    if (!a.ok) throw new Error(a.error.message);
    const b = archiveContainer(a.data.data, ctx, { id: IDS.q2Launch });
    if (!b.ok) throw new Error(b.error.message);
    expect(restoreContainer(b.data.data, ctx, { id: IDS.backlog }).ok).toBe(false);
  });

  it('the workspace cannot be archived', () => {
    expect(archiveContainer(freshSeed(), ctx, { id: IDS.workspace }).ok).toBe(false);
  });
});

describe('sibling reorder (every level, same parent only)', () => {
  it('reorders lists within their folder', () => {
    const r = reorderContainer(freshSeed(), ctx, { id: IDS.sprint, toIndex: 0 });
    if (!r.ok) throw new Error(r.error.message);
    expect(activeChildren(r.data.data, IDS.q2Launch).map((c) => c.name)).toEqual(['Sprint 12', 'Backlog']);
  });

  it('reorders folders and lists mixed within a space', () => {
    const added = createContainer(freshSeed(), ctx, { parentId: IDS.engineering, type: 'list', name: 'Inbox' });
    if (!added.ok) throw new Error(added.error.message);
    const r = reorderContainer(added.data.data, ctx, { id: added.data.value.id, toIndex: 0 });
    if (!r.ok) throw new Error(r.error.message);
    expect(activeChildren(r.data.data, IDS.engineering).map((c) => c.name)).toEqual(['Inbox', 'Q2 Launch']);
  });

  it('never moves an item to another parent', () => {
    const r = reorderContainer(freshSeed(), ctx, { id: IDS.backlog, toIndex: 5 });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.data.data.containers[IDS.backlog]!.parentId).toBe(IDS.q2Launch);
  });

  it('members cannot reorder', () => {
    const r = reorderContainer(freshSeed(), testCtx(USER_IDS.bob), { id: IDS.sprint, toIndex: 0 });
    expect(!r.ok && r.error.code).toBe('FORBIDDEN');
  });
});

describe('sibling reorder', () => {
  it('moves a sibling and re-indexes positions', () => {
    const r = reorderContainer(freshSeed(), ctx, { id: IDS.marketing, toIndex: 0 });
    if (!r.ok) throw new Error(r.error.message);
    expect(activeChildren(r.data.data, IDS.workspace).map((c) => [c.id, c.position])).toEqual([
      [IDS.marketing, 0],
      [IDS.engineering, 1],
    ]);
  });
});
