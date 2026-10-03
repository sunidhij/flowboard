import type { Container, Data, Grant, Priority, Status, Task, User } from '@/domain/types';

/**
 * Seed fixtures: 1 workspace, 2 spaces, 2 folders, 3 lists, 20 tasks (incl. subtasks), 3 users, sample grants.
 *
 *  Acme Inc. (workspace)
 *  ├─ Engineering (space, public)
 *  │  └─ Q2 Launch (folder)
 *  │     ├─ Backlog   (list, public)         ← Carol has a DENY grant
 *  │     └─ Sprint 12 (list, private)        ← Bob has an ALLOW grant
 *  └─ Marketing (space, private)             ← Carol has an ALLOW grant
 *     └─ Campaigns (folder)
 *        └─ Social (list)
 *
 *  Alice (admin) sees everything · Bob sees Backlog + Sprint 12 · Carol sees only Social
 */

export const USER_IDS = { alice: 'u_alice', bob: 'u_bob', carol: 'u_carol' } as const;
export const IDS = {
  workspace: 'ws_acme',
  engineering: 'sp_eng',
  marketing: 'sp_mkt',
  q2Launch: 'fd_q2',
  campaigns: 'fd_campaigns',
  backlog: 'ls_backlog',
  sprint: 'ls_sprint',
  social: 'ls_social',
} as const;

const users: User[] = [
  { id: USER_IDS.alice, name: 'Alice Martin', role: 'admin', avatarColor: 'violet' },
  { id: USER_IDS.bob, name: 'Bob Chen', role: 'member', avatarColor: 'blue' },
  { id: USER_IDS.carol, name: 'Carol Diaz', role: 'member', avatarColor: 'pink' },
];

const containers: Container[] = [
  { id: IDS.workspace, name: 'Acme Inc.', type: 'workspace', parentId: null, position: 0, visibility: 'public' },
  { id: IDS.engineering, name: 'Engineering', type: 'space', parentId: IDS.workspace, position: 0, visibility: 'public' },
  { id: IDS.marketing, name: 'Marketing', type: 'space', parentId: IDS.workspace, position: 1, visibility: 'private' },
  { id: IDS.q2Launch, name: 'Q2 Launch', type: 'folder', parentId: IDS.engineering, position: 0, visibility: 'public' },
  { id: IDS.campaigns, name: 'Campaigns', type: 'folder', parentId: IDS.marketing, position: 0, visibility: 'public' },
  { id: IDS.backlog, name: 'Backlog', type: 'list', parentId: IDS.q2Launch, position: 0, visibility: 'public' },
  { id: IDS.sprint, name: 'Sprint 12', type: 'list', parentId: IDS.q2Launch, position: 1, visibility: 'private' },
  { id: IDS.social, name: 'Social', type: 'list', parentId: IDS.campaigns, position: 0, visibility: 'public' },
];

const statuses: Status[] = [
  { id: 'st_bl_todo', listId: IDS.backlog, name: 'To do', category: 'todo', color: 'gray', position: 0 },
  { id: 'st_bl_prog', listId: IDS.backlog, name: 'In progress', category: 'in_progress', color: 'amber', position: 1 },
  { id: 'st_bl_done', listId: IDS.backlog, name: 'Done', category: 'done', color: 'green', position: 2 },

  { id: 'st_sp_todo', listId: IDS.sprint, name: 'To do', category: 'todo', color: 'gray', position: 0 },
  { id: 'st_sp_prog', listId: IDS.sprint, name: 'In progress', category: 'in_progress', color: 'amber', position: 1 },
  { id: 'st_sp_review', listId: IDS.sprint, name: 'In review', category: 'in_progress', color: 'violet', position: 2 },
  { id: 'st_sp_done', listId: IDS.sprint, name: 'Done', category: 'done', color: 'green', position: 3 },

  { id: 'st_so_idea', listId: IDS.social, name: 'Ideas', category: 'todo', color: 'gray', position: 0 },
  { id: 'st_so_draft', listId: IDS.social, name: 'Drafting', category: 'in_progress', color: 'blue', position: 1 },
  { id: 'st_so_sched', listId: IDS.social, name: 'Scheduled', category: 'in_progress', color: 'teal', position: 2 },
  { id: 'st_so_pub', listId: IDS.social, name: 'Published', category: 'done', color: 'green', position: 3 },
];

const grants: Grant[] = [
  { id: 'g_bob_sprint', resourceId: IDS.sprint, userId: USER_IDS.bob, mode: 'allow' },
  { id: 'g_carol_mkt', resourceId: IDS.marketing, userId: USER_IDS.carol, mode: 'allow' },
  { id: 'g_carol_backlog', resourceId: IDS.backlog, userId: USER_IDS.carol, mode: 'deny' },
];

type TaskSeed = [
  id: string,
  title: string,
  listId: string,
  statusId: string,
  priority: Priority,
  assignees: string[],
  dueInDays: number | null,
  parentTaskId?: string,
  description?: string,
];

const { alice: A, bob: B, carol: C } = USER_IDS;

const taskSeeds: TaskSeed[] = [
  // Backlog
  ['t_1', 'Audit onboarding funnel drop-off', IDS.backlog, 'st_bl_todo', 'high', [A], 5, undefined,
    'Pull the last 30 days of funnel data and flag steps with > 20% drop-off.'],
  ['t_2', 'Design empty states for dashboards', IDS.backlog, 'st_bl_todo', 'normal', [B], 9],
  ['t_3', 'Evaluate feature-flag vendors', IDS.backlog, 'st_bl_todo', 'low', [], null],
  ['t_4', 'Migrate CI to cached runners', IDS.backlog, 'st_bl_prog', 'urgent', [B, A], -1, undefined,
    'Builds take 14 minutes on average. Target is under 6.'],
  ['t_5', 'Write ADR for event bus', IDS.backlog, 'st_bl_prog', 'normal', [A], 3],
  ['t_6', 'Clean up deprecated API routes', IDS.backlog, 'st_bl_done', 'low', [B], -6],
  ['t_7', 'Accessibility pass on settings page', IDS.backlog, 'st_bl_todo', 'none', [], 21],

  // Sprint 12 (private)
  ['t_8', 'Ship SSO login flow', IDS.sprint, 'st_sp_prog', 'urgent', [B], 2, undefined,
    'SAML + OIDC. Behind the `sso` feature flag until security review is done.'],
  ['t_9', 'Fix race condition in autosave', IDS.sprint, 'st_sp_review', 'high', [A, B], 0],
  ['t_10', 'Add rate limiting to public API', IDS.sprint, 'st_sp_todo', 'high', [A], 4],
  ['t_11', 'Instrument checkout latency', IDS.sprint, 'st_sp_todo', 'normal', [B], 6],
  ['t_12', 'Upgrade React to latest minor', IDS.sprint, 'st_sp_done', 'low', [A], -2],
  ['t_13', 'Load test search service', IDS.sprint, 'st_sp_todo', 'normal', [], 8],
  ['t_8a', 'SAML metadata endpoint', IDS.sprint, 'st_sp_done', 'normal', [B], 1, 't_8'],
  ['t_8b', 'Session handoff to SPA', IDS.sprint, 'st_sp_prog', 'high', [B], 2, 't_8'],

  // Social (private space)
  ['t_14', 'Launch teaser video for Q2', IDS.social, 'st_so_draft', 'high', [C], 3, undefined,
    '30s cut for LinkedIn and X. Needs legal sign-off on music.'],
  ['t_15', 'Customer story: Northwind', IDS.social, 'st_so_idea', 'normal', [C], 12],
  ['t_16', 'Weekly product tips thread', IDS.social, 'st_so_sched', 'low', [C, A], 1],
  ['t_17', 'Recap post: community meetup', IDS.social, 'st_so_pub', 'none', [C], -4],
  ['t_18', 'Refresh social banner assets', IDS.social, 'st_so_idea', 'urgent', [], -2],
];

function buildTasks(now: Date): Task[] {
  const day = 24 * 60 * 60 * 1000;
  const created = new Date(now.getTime() - 14 * day).toISOString();
  const positions = new Map<string, number>();

  return taskSeeds.map(([id, title, listId, statusId, priority, assigneeIds, dueInDays, parentTaskId, description]) => {
    const columnKey = parentTaskId ? `sub:${parentTaskId}` : `${listId}:${statusId}`;
    const position = positions.get(columnKey) ?? 0;
    positions.set(columnKey, position + 1);
    let dueDate: string | undefined;
    if (dueInDays !== null) {
      const d = new Date(now.getTime() + dueInDays * day);
      d.setHours(17, 0, 0, 0);
      dueDate = d.toISOString();
    }
    return {
      id,
      title,
      description,
      statusId,
      priority,
      assigneeIds,
      dueDate,
      position,
      primaryListId: listId,
      parentTaskId,
      createdAt: created,
      updatedAt: created,
    };
  });
}

const byId = <T extends { id: string }>(items: T[]): Record<string, T> =>
  Object.fromEntries(items.map((item) => [item.id, item]));

export function buildSeed(now: Date = new Date()): Data {
  return {
    users: byId(users),
    containers: byId(containers),
    statuses: byId(statuses),
    tasks: byId(buildTasks(now)),
    grants: [...grants],
    activity: [],
  };
}
