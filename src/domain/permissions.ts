import { forbidden, notFound, ok, type Result } from './errors';
import type { Container, Data, ID, User } from './types';
import { byPosition } from './ordering';

/**
 * Permission model
 * - admins see and edit everything
 * - members: a container is visible iff its parent is visible AND
 *     there is no `deny` grant for the user on it AND
 *     (it is public OR the user has an `allow` grant on it)
 *   → evaluated top-down, so a deny/missing allow on an ancestor hides the whole subtree
 * - members may mutate tasks in lists they can see; container management is admin-only
 *
 * Archiving is orthogonal to permissions: see `isActive`.
 */

export function getUser(data: Data, userId: ID): User | undefined {
  return data.users[userId];
}

export function isAdmin(data: Data, userId: ID): boolean {
  return getUser(data, userId)?.role === 'admin';
}

function grantFor(data: Data, userId: ID, resourceId: ID) {
  // a deny always wins over an allow on the same resource
  let mode: 'allow' | 'deny' | undefined;
  for (const g of data.grants) {
    if (g.userId !== userId || g.resourceId !== resourceId) continue;
    if (g.mode === 'deny') return 'deny';
    mode = 'allow';
  }
  return mode;
}

/** True when the container and all of its ancestors are not archived. */
export function isActive(data: Data, containerId: ID): boolean {
  let node: Container | undefined = data.containers[containerId];
  while (node) {
    if (node.archivedAt) return false;
    node = node.parentId ? data.containers[node.parentId] : undefined;
  }
  return Boolean(data.containers[containerId]);
}

/** Visibility ignoring archive state. Unknown users see nothing. */
export function canViewContainer(data: Data, userId: ID, containerId: ID): boolean {
  const user = getUser(data, userId);
  if (!user) return false;
  return user.role === 'admin' || canViewByGrants(data, userId, containerId);
}

/** The member rules alone (no admin bypass) — used to tell "invited" from "sees it as an admin". */
function canViewByGrants(data: Data, userId: ID, containerId: ID): boolean {
  const node = data.containers[containerId];
  if (!node) return false;
  if (node.type === 'workspace') return true; // every user is a workspace member
  if (!node.parentId || !canViewByGrants(data, userId, node.parentId)) return false;

  const grant = grantFor(data, userId, node.id);
  if (grant === 'deny') return false;
  return node.visibility === 'public' || grant === 'allow';
}

export type AudienceKind = 'public' | 'restricted' | 'only-you';

export interface Audience {
  kind: AudienceKind;
  /** users who can see it through sharing (public / allow grants), viewer first — admin bypass excluded */
  memberIds: ID[];
  /** the viewer only sees it because they are an admin */
  viewerViaAdmin: boolean;
  /** some admins can see it without being in `memberIds` */
  adminsAlsoSee: boolean;
}

/**
 * Who a container is shared with, from the viewer's perspective. Uses the effective
 * rules (not just the `visibility` flag), so a "public" list with a deny grant is
 * reported as restricted. Admin bypass is reported separately so "only you" is
 * meaningful for members even though admins can open everything.
 *  - public:     shared with every user
 *  - only-you:   admins only — shared with no one but the admin viewer. For a member,
 *                admins can always see it too, so it is never "only you" → restricted.
 *  - restricted: anything in between
 */
export function audienceOf(data: Data, viewerId: ID, containerId: ID): Audience {
  const all = Object.keys(data.users);
  const memberIds = all
    .filter((id) => canViewByGrants(data, id, containerId))
    .sort((a, b) => (a === viewerId ? -1 : b === viewerId ? 1 : 0));
  const viewerViaAdmin = isAdmin(data, viewerId) && !memberIds.includes(viewerId);
  const adminsAlsoSee = all.some((id) => isAdmin(data, id) && id !== viewerId && !memberIds.includes(id));

  let kind: AudienceKind = 'restricted';
  if (memberIds.length === all.length) kind = 'public';
  else if (isAdmin(data, viewerId) && memberIds.every((id) => id === viewerId)) kind = 'only-you';
  return { kind, memberIds, viewerViaAdmin, adminsAlsoSee };
}

/** Visible and not archived — what the tree / boards should show. */
export function canSeeContainer(data: Data, userId: ID, containerId: ID): boolean {
  return isActive(data, containerId) && canViewContainer(data, userId, containerId);
}

export function canManageContainers(data: Data, userId: ID): boolean {
  return isAdmin(data, userId);
}

/** Guard used by every task read/mutation. */
export function assertListAccess(data: Data, userId: ID, listId: ID): Result<Container> {
  const list = data.containers[listId];
  if (!list || list.type !== 'list' || !isActive(data, listId)) return notFound('List');
  if (!canViewContainer(data, userId, listId)) return forbidden("You don't have access to this list.");
  return ok(list);
}

export function assertCanManageContainers(data: Data, userId: ID): Result<true> {
  return canManageContainers(data, userId) ? ok(true) : forbidden('Only workspace admins can manage spaces, folders and lists.');
}

export interface TreeNode {
  container: Container;
  children: TreeNode[];
}

/**
 * The container tree filtered to what `userId` may see (archived nodes excluded).
 * For members, spaces/folders that contain no list they can open are pruned too —
 * an empty branch is just noise to someone who can't manage containers. Admins keep
 * every branch (they need empty spaces/folders to add lists to).
 */
export function visibleTree(data: Data, userId: ID): TreeNode | null {
  const tree = permittedTree(data, userId);
  if (!tree || isAdmin(data, userId)) return tree;
  const prune = (n: TreeNode): TreeNode | null => {
    if (n.container.type === 'list') return n;
    const children = n.children.map(prune).filter((c): c is TreeNode => c !== null);
    return children.length || n.container.type === 'workspace' ? { ...n, children } : null;
  };
  return prune(tree);
}

/** Every container the user may view, without pruning empty branches. */
function permittedTree(data: Data, userId: ID): TreeNode | null {
  const root = Object.values(data.containers).find((c) => c.type === 'workspace');
  if (!root || !canSeeContainer(data, userId, root.id)) return null;

  const childrenOf = new Map<ID, Container[]>();
  for (const c of Object.values(data.containers)) {
    if (!c.parentId) continue;
    const list = childrenOf.get(c.parentId) ?? [];
    list.push(c);
    childrenOf.set(c.parentId, list);
  }

  const build = (c: Container): TreeNode => ({
    container: c,
    children: (childrenOf.get(c.id) ?? [])
      .filter((child) => !child.archivedAt && canViewContainer(data, userId, child.id))
      .sort(byPosition)
      .map(build),
  });
  return build(root);
}

/** Ids of every list the user can currently open, in tree order. */
export function visibleListIds(data: Data, userId: ID): ID[] {
  const out: ID[] = [];
  const walk = (n: TreeNode) => {
    if (n.container.type === 'list') out.push(n.container.id);
    n.children.forEach(walk);
  };
  const tree = visibleTree(data, userId);
  if (tree) walk(tree);
  return out;
}
