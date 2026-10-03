# Flowboard

A mini project-management app for a single workspace: **Workspace → Space → (Folder) → List → Tasks**, a **Kanban board** and a **list view** for each list, and a grant-based permission model. There's no backend; a typed client store seeded from fixtures stands in for the API and database.

**Stack:** React 18 · TypeScript (strict) · Vite · Tailwind CSS · Redux Toolkit · dnd-kit · Headless UI · Vitest + Testing Library · Playwright

---

## 1. How to run locally

**Prerequisites**
- **Node.js 22.22.2 or newer** (or 24.15+ / 26+). The test tools (Vitest, jsdom) need it; the app alone runs on 22.12+. Check with `node -v`.
- **npm**, which comes with Node.js.
- **Git**, to clone the repository.
- For the end-to-end tests only: Playwright's Chromium, a one-time download with `npx playwright install chromium`. On Linux, use `npx playwright install --with-deps chromium` to install its system libraries too.

**Run**

```bash
git clone <repository-url>
cd flowboard
npm install
npm run dev            # http://localhost:5173
```

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check + production build |
| `npm run lint` | ESLint |
| `npm test` | Unit, store and component tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright; needs the Chromium download above) |

Use the user switcher (top right) to switch between **Alice** (admin), **Bob** and **Carol** (members). **Reset demo data** in the same menu restores the seed.

---

## 2. Architecture

![Flowboard architecture: UI components read through permission-filtered selectors and write through a fake async API into Redux Toolkit thunks, which run pure domain mutations and commit results to slices persisted in localStorage](docs/architecture.png)

The app has three layers: React components for the UI, a Redux Toolkit store for state, and pure domain functions that hold every business rule. Components read through selectors that filter everything by the current user's permissions, so the UI never receives data it shouldn't show. Writes go through a fake async API into thunks, which run a pure mutation (permission check, then validation, then integrity rules) and commit the result to the store only if it succeeds. Because the rules live outside React and Redux, they're unit-tested on their own, and replacing the fake API with a real backend wouldn't change any component. The workspace state is saved to localStorage, so changes survive a reload.

---

## 3. Data model

Entities are stored normalised as `Record<id, Entity>` (`src/domain/types.ts`).

| Entity | Fields |
|---|---|
| `Container` | `id, name, type: workspace\|space\|folder\|list, parentId, position, visibility: public\|private, archivedAt?` |
| `Status` | `id, listId, name, category: todo\|in_progress\|done, color, position` — each list owns its set |
| `Task` | `id, title (≤500), description?, statusId, priority: urgent\|high\|normal\|low\|none, assigneeIds[], dueDate? (ISO), position, primaryListId, parentTaskId?, createdAt, updatedAt, archivedAt?` |
| `User` | `id, name, role: admin\|member, avatarColor` |
| `Grant` | `id, resourceId, userId, mode: allow\|deny` |
| `Activity` | `id, actorId, verb, containerId, taskId?, meta, at` |

**Seed** (`src/data/seed.ts`): 1 workspace, 2 spaces, 2 folders, 3 lists, 20 tasks (2 of them subtasks), 3 users, 3 grants.

```
Acme Inc.
├─ Engineering (public)
│  └─ Q2 Launch
│     ├─ Backlog   (public)     Carol: DENY
│     └─ Sprint 12 (private)    Bob: ALLOW
└─ Marketing (private)          Carol: ALLOW
   └─ Campaigns
      └─ Social
```

**Rules enforced in the store:**
- **Hierarchy:**
  - The valid parents are `workspace→space`, `space→folder`, `space→list` and `folder→list`. Lists hold tasks, never containers.
  - Siblings are ordered by `position`, which is re-indexed after every move.
- **Tasks:**
  - The title is required and at most 500 characters.
  - The status must belong to the task's list.
  - Priority must be in the enum.
  - Assignees must exist.
  - The due date must be a valid date.
- **Moving a task to another list:** its status is remapped to the same category in the target list, and subtasks move with it (one level of subtasks only).
- **Statuses:**
  - New lists get `todo / in_progress / done` statuses.
  - Admins can add, rename, recolour, reorder or delete statuses, but every list keeps at least one status per category.
  - Deleting a status moves its tasks to another status of the same category.
- **Soft-delete (my choice):**
  - Containers and tasks get `archivedAt` instead of being removed. Archiving a container hides its whole subtree.
  - Every delete asks for confirmation and offers Undo.
  - *Why:* no data is lost, and Undo is trivial.

---

## 4. How permissions are enforced in the client

**Rules** (`src/domain/permissions.ts`):
- **Admins** see and edit everything.
- **Members:** a container is visible only if its parent is visible, there's no `deny` grant for them on it (deny beats allow), and it's `public` or they have an `allow` grant. A hidden ancestor hides the whole subtree.
- **Members** can create, edit, move and delete tasks in lists they can see. Managing spaces, folders, lists and statuses is admin-only.

**Enforcement is in the store, not only the UI:**
- **Reads:** every selector (`selectTree`, `selectColumns`, `selectTask`, `selectActivity`…) filters by the acting user. Opening a denied list returns `{ ok: false, error: { code: 'FORBIDDEN', message } }` (treated as 403), and the page shows an *Access denied* state.
- **Writes:** every mutation starts with `assertListAccess` or `assertCanManageContainers` and returns `FORBIDDEN` on failure. Hiding controls in the UI is only cosmetic; calling the store directly as a member is still refused (covered by unit tests).
- **Switching users** updates the tree and boards immediately. If the new user can't open the current list, they're moved to one they can see. *Access denied* is shown when a denied list is opened by URL.

**How I'd extend the model:**
- **Teams:** a `Team { id, memberIds }` entity, with grants targeting a user or a team. A user's own deny would beat a team allow.
- **Roles per resource** (viewer / editor / owner), with `canEdit` separate from `canView`.

---

## 5. Important technical decisions

- **Business rules in pure functions** (`domain/`, `store/mutations/`), separate from React and Redux, so they're unit-tested in isolation, and reducers only commit results.
- **Redux Toolkit:** thunks that return a consistent `Result`, event-style slice actions, and `createSelector` for derived data. Toast callbacks are kept outside the store so state stays serializable.
- **Persistence:**
  - The `workspace` slice is saved to `localStorage`.
  - Saved data is shape-checked on load and falls back to the seed if invalid.
- **A fake async API** (`store/api.ts`): it exercises real loading, error and optimistic-update paths, and marks where a real backend would plug in.
- **Lists are addressable by id** (`/lists/:listId`). The URL is never trusted: access is re-checked for the current user on every load.
- **Error handling:**
  - One error shape everywhere: `{ code, message, fields? }`.
  - Messages are plain language; error codes are never shown.
  - Error boundaries keep a rendering failure from blanking the app.

---

## 6. Assumptions and deviations

| Topic | Brief | What Flowboard does | Why |
|---|---|---|---|
| **Folders** | `workspace → space → folder → list` | **Deviation:** folders are optional; a list can sit directly in a space | Not every space needs a folder level.|
| **Who manages containers** | Members *"can edit tasks"* | Creating, renaming, archiving and reordering containers, and configuring statuses, are admin-only | The members row grants task editing only |
| **Access denied** | A denied resource shows a clear error | Shown when a denied list is opened by URL; switching user redirects instead | Switching is navigation; a link is an explicit request |
| **Statuses** | Minimum todo / in_progress / done per list | At least one per category is enforced; a status's category can't be changed | Changing a category could silently break the minimum |
| **Reordering** | *"Reorder siblings"* | Reorder within the same parent at every level; no re-parenting | The brief asks for siblings only |
| **Required fields** | `title`, `status` | Validated in the store and marked in the form | Validation lives in the store |

---

## 7. Stretch goals attempted

1. **Optimistic UI on drag-and-drop, with rollback.** A move is applied immediately, then "persisted". On failure, exactly the tasks it touched are restored and its activity entry is removed. Try it with the **Simulate failures** toggle.
2. **Activity feed.** Task and container changes are logged (e.g. "Alice moved *Fix login* from To do to Done"). They're shown per list and per task, and filtered by permission.
3. **Deployed preview on Cloudflare Pages.** 
   - **Live URL:** _to be added once deployed_

---

## 8. DnD `style=` exceptions

The only inline styles in the codebase are the `transform`/`transition` values that dnd-kit computes for draggable items:
- `features/board/TaskCard.tsx` (`SortableTaskCard`)
- `features/sidebar/TreeNode.tsx` (sortable tree rows)

Everything else is Tailwind utility classes. `src/index.css` contains only the three `@tailwind` directives that Tailwind requires.

---

## 9. Trade-offs: what I cut, and what I'd do in week 2

**Cut or simplified**
- **No grant-management UI.** Grants come from the seed.
- **Container drag-and-drop is reorder-only.** There's no moving a folder or list to another parent.
- **Plain-text descriptions**, with no markdown rendering.

**What I would do in Week 2**
1. **Check assignees against list access.** Today the store only checks that an assignee exists, so a user can be assigned a task in a list they can't see.
2. **Stop activity entries from exposing task titles after a move.** Entries are filtered by the list they were logged in.
   - *Fix:* also filter by the task's current list, or redact the title for readers who can no longer see the task.
3. A permission management system.
4. Search and filters (assignee, priority, overdue).
5. Drag-to-reorder status columns, and safe category changes.
7. List virtualisation, and Activity pagination.
---

## 10. AI usage log

**Full details (a phase-by-phase split of my work vs the AI's, the issues I identified and the product feedback I gave) are in [`AI_USAGE.md`](./AI_USAGE.md).**

- **Tool:** Claude Code, used as a development assistant throughout the project.
- **Where it helped:** implementation drafts, tests, debugging suggestions and refactoring suggestions.
- **My role:**
  - reviewed the plan and cross-checked it against the requirements before any code was written
  - made the product and architecture decisions (e.g. Redux Toolkit, optional folders, how permissions behave)
  - reviewed and tested every change
- **Where I corrected it:** manual testing caught issues the automated tests missed (hidden folder creation, a 404 after archiving every space, a select arrow outside its field), and I refined the permissions UX, task form, assignee picker and error messages.
- **Code structure:** I prioritised splitting the large files and making Redux action names consistent.
