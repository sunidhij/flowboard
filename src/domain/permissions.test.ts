import { describe, expect, it } from 'vitest';
import { IDS, USER_IDS } from '@/data/seed';
import { freshSeed, freshStore, testCtx } from '@/test/factory';
import type { Data } from './types';
import { audienceOf, canViewContainer, visibleListIds, visibleTree, type TreeNode } from './permissions';
import { isListGone, selectActivity, selectColumns, selectEmptyWorkspaceReason, selectTask } from '@/store/selectors';
import { createContainer } from '@/store/mutations/containers';
import { updateTask } from '@/store/mutations/tasks';
import { switchUser, updateTask as updateTaskThunk } from '@/store/thunks';

const { alice, bob, carol } = USER_IDS;

const names = (node: TreeNode | null): string[] =>
  node ? [node.container.name, ...node.children.flatMap(names)] : [];

describe('tree permission filtering', () => {
  it('admin sees the whole workspace', () => {
    expect(names(visibleTree(freshSeed(), alice))).toEqual([
      'Acme Inc.', 'Engineering', 'Q2 Launch', 'Backlog', 'Sprint 12', 'Marketing', 'Campaigns', 'Social',
    ]);
  });

  it('member sees public containers plus private ones they are allowed into', () => {
    expect(visibleListIds(freshSeed(), bob)).toEqual([IDS.backlog, IDS.sprint]);
    expect(names(visibleTree(freshSeed(), bob))).not.toContain('Marketing');
  });

  it('an explicit deny hides a public container', () => {
    const data = freshSeed();
    expect(data.containers[IDS.backlog]!.visibility).toBe('public');
    expect(canViewContainer(data, carol, IDS.backlog)).toBe(false);
    expect(visibleListIds(data, carol)).toEqual([IDS.social]);
  });

  it('private containers need an explicit allow', () => {
    const data = freshSeed();
    expect(canViewContainer(data, bob, IDS.marketing)).toBe(false);
    expect(canViewContainer(data, carol, IDS.marketing)).toBe(true);
  });

  it('a deny on an ancestor hides the entire subtree, even with an allow below', () => {
    const data: Data = {
      ...freshSeed(),
      grants: [
        ...freshSeed().grants,
        { id: 'g1', resourceId: IDS.engineering, userId: bob, mode: 'deny' },
      ],
    };
    expect(canViewContainer(data, bob, IDS.sprint)).toBe(false); // Bob still has allow on Sprint 12
    expect(visibleListIds(data, bob)).toEqual([]);
  });

  it('deny wins over allow on the same resource', () => {
    const data: Data = {
      ...freshSeed(),
      grants: [...freshSeed().grants, { id: 'g2', resourceId: IDS.sprint, userId: bob, mode: 'deny' }],
    };
    expect(canViewContainer(data, bob, IDS.sprint)).toBe(false);
  });

  it('unknown users see nothing', () => {
    expect(visibleTree(freshSeed(), 'u_ghost')).toBeNull();
  });

  it('archived containers disappear from the tree for everyone', () => {
    const data = freshSeed();
    data.containers[IDS.q2Launch] = { ...data.containers[IDS.q2Launch]!, archivedAt: '2026-01-01T00:00:00Z' };
    expect(names(visibleTree(data, alice))).not.toContain('Backlog');
  });
});

describe('task access is enforced in the store layer', () => {
  it('selectors return FORBIDDEN for lists the user cannot see', () => {
    const r = selectColumns(freshSeed(), bob, IDS.social);
    expect(r).toEqual({ ok: false, error: { code: 'FORBIDDEN', message: expect.any(String) } });
  });

  it('a member cannot read a task in a list they cannot see', () => {
    expect(selectTask(freshSeed(), carol, 't_1').ok).toBe(false);
    expect(selectTask(freshSeed(), bob, 't_1').ok).toBe(true);
  });

  it('a member cannot edit a task in a denied list', () => {
    const r = updateTask(freshSeed(), testCtx(bob), { id: 't_14', patch: { title: 'hijack' } });
    expect(!r.ok && r.error.code).toBe('FORBIDDEN');
  });

  it('a member can edit tasks in lists they can see', () => {
    const r = updateTask(freshSeed(), testCtx(bob), { id: 't_8', patch: { priority: 'low' } });
    expect(r.ok).toBe(true);
  });

  it('members cannot manage containers', () => {
    const r = createContainer(freshSeed(), testCtx(bob), { parentId: IDS.q2Launch, type: 'list', name: 'Mine' });
    expect(!r.ok && r.error.code).toBe('FORBIDDEN');
  });

  it('switching users immediately changes what the store returns', () => {
    const store = freshStore();
    const tasksIn = (listId: string) => {
      const { data, currentUserId } = store.getState().workspace;
      return selectColumns(data, currentUserId, listId).ok;
    };
    expect(tasksIn(IDS.social)).toBe(true);
    store.dispatch(switchUser(bob));
    expect(tasksIn(IDS.social)).toBe(false);
    expect(store.dispatch(updateTaskThunk({ id: 't_14', patch: { title: 'x' } })).ok).toBe(false);
  });

  it('activity from lists the user cannot see is filtered out', () => {
    const store = freshStore();
    store.dispatch(updateTaskThunk({ id: 't_14', patch: { priority: 'low' } })); // Alice edits Social
    const { data } = store.getState().workspace;
    expect(selectActivity(data, alice)).toHaveLength(1);
    expect(selectActivity(data, bob)).toHaveLength(0);
    expect(selectActivity(data, carol)).toHaveLength(1);
  });
});

describe('empty workspace reasons', () => {
  const archive = (data: Data, ...ids: string[]): Data => ({
    ...data,
    containers: Object.fromEntries(
      Object.entries(data.containers).map(([id, c]) => [id, ids.includes(id) ? { ...c, archivedAt: '2026-01-01T00:00:00Z' } : c]),
    ),
  });

  it('is null while the user can open at least one list', () => {
    expect(selectEmptyWorkspaceReason(freshSeed(), alice)).toBeNull();
  });

  it('all-archived when every space is archived (admin)', () => {
    const data = archive(freshSeed(), IDS.engineering, IDS.marketing);
    expect(selectEmptyWorkspaceReason(data, alice)).toBe('all-archived');
    // the previously open list is "gone", not forbidden
    expect(isListGone(data, IDS.backlog)).toBe(true);
  });

  it('no-spaces when the workspace has never had a space', () => {
    const seed = freshSeed();
    const data: Data = {
      ...seed,
      containers: { [IDS.workspace]: seed.containers[IDS.workspace]! },
    };
    expect(selectEmptyWorkspaceReason(data, alice)).toBe('no-spaces');
  });

  it('no-lists when active spaces have no lists', () => {
    const data = archive(freshSeed(), IDS.q2Launch, IDS.campaigns);
    expect(selectEmptyWorkspaceReason(data, alice)).toBe('no-lists');
  });

  it('no-access for members, regardless of why', () => {
    const data = archive(freshSeed(), IDS.engineering, IDS.marketing);
    expect(selectEmptyWorkspaceReason(data, bob)).toBe('no-access');
  });

  it('a forbidden list is not "gone"', () => {
    expect(isListGone(freshSeed(), IDS.social)).toBe(false);
  });
});

describe('audienceOf (visibility badge)', () => {
  it('public when every user has access through sharing', () => {
    expect(audienceOf(freshSeed(), bob, IDS.engineering)).toMatchObject({ kind: 'public' });
    expect(audienceOf(freshSeed(), carol, IDS.q2Launch)).toMatchObject({ kind: 'public' });
  });

  it('a "public" container with a deny is reported as restricted', () => {
    const a = audienceOf(freshSeed(), bob, IDS.backlog);
    expect(a).toMatchObject({ kind: 'restricted', memberIds: [bob, alice] });
  });

  it('never "only you" for a member — admins can always see it too, so it is restricted', () => {
    expect(audienceOf(freshSeed(), bob, IDS.sprint)).toEqual({
      kind: 'restricted',
      memberIds: [bob],
      viewerViaAdmin: false,
      adminsAlsoSee: true,
    });
    expect(audienceOf(freshSeed(), carol, IDS.social)).toMatchObject({ kind: 'restricted' });
  });

  it('restricted for an admin looking at something shared with others', () => {
    expect(audienceOf(freshSeed(), alice, IDS.sprint)).toEqual({
      kind: 'restricted',
      memberIds: [bob],
      viewerViaAdmin: true,
      adminsAlsoSee: false,
    });
  });

  it('private for an admin when it is shared with no one', () => {
    const data = freshSeed();
    data.containers.ls_secret = { id: 'ls_secret', name: 'Secret', type: 'list', parentId: IDS.q2Launch, position: 2, visibility: 'private' };
    expect(audienceOf(data, alice, 'ls_secret')).toMatchObject({ kind: 'only-you', memberIds: [], viewerViaAdmin: true });
  });
});

describe('tree pruning for members', () => {
  it('a member does not see a branch that has no list they can open', () => {
    // Carol: Backlog denied, Sprint 12 private → Engineering / Q2 Launch hold nothing for her
    expect(names(visibleTree(freshSeed(), carol))).toEqual(['Acme Inc.', 'Marketing', 'Campaigns', 'Social']);
  });

  it('keeps branches that lead to at least one visible list', () => {
    expect(names(visibleTree(freshSeed(), bob))).toEqual(['Acme Inc.', 'Engineering', 'Q2 Launch', 'Backlog', 'Sprint 12']);
  });

  it('admins still see empty spaces and folders (they need them to add lists)', () => {
    const data = freshSeed();
    data.containers.sp_empty = { id: 'sp_empty', name: 'Empty', type: 'space', parentId: IDS.workspace, position: 2, visibility: 'public' };
    expect(names(visibleTree(data, alice))).toContain('Empty');
    expect(names(visibleTree(data, bob))).not.toContain('Empty');
  });
});
