# AI usage log

**Tool:** Claude Code

Claude Code was used as a development assistant throughout the project. It contributed implementation drafts, tests, debugging suggestions, and refactoring suggestions. I reviewed, modified, tested, and made the final decisions for the submitted implementation.

## How I used it

| Phase | Claude Code (implementation) | Me (decisions, review, testing) |
|---|---|---|
| Planning | Read the brief; proposed a layered plan | **Reviewed the plan and cross-checked it with the requirements** before any code was written; chose React + **Redux Toolkit** + dnd-kit and the two stretch goals (optimistic DnD, activity feed)|
| Store and architecture | Proposed and implemented the Redux Toolkit store design | Reviewed and accepted the design: business rules live in pure functions, and reducers only commit results. Decided state is saved locally and lists are opened by id in the URL |
| Domain rules and permissions | Wrote the types, permission evaluation, validators and pure mutations | Checked the permission model against the brief; decided how visibility is shown (badge states, "only you" for admins) and that switching user redirects while *Access denied* is for URLs |
| Product and UX | Implemented each change I specified | Decided: optional folders; required fields; the assignee picker's behaviour; Save closing the drawer; subtasks in the form; toast durations; error wording; a responsive, collapsible sidebar |
| Tests | Wrote the unit, store, component and E2E tests, using a deterministic clock and ids and a fresh store per test | Reviewed test coverage, added/adjusted cases based on product behavior, and verified the final suites |
| UI | Built the Tailwind-only components and the shared token map | Reviewed the interaction design, responsive behavior, accessibility, and visual hierarchy through manual testing |
| Review and quality | Ran tests, type checks, lint and automated browser checks after every change | Reviewed the code structure and prioritised splitting the large files and making Redux action names consistent |

## Issues identified during manual review

The automated tests passed in every case below. These only showed up when I used the app myself.

- **Couldn't find how to create a folder.** Folder creation was hidden behind a hover-only menu. I changed the UI to provide visible creation affordances.
- **"404 NOT_FOUND" after archiving every space.** Archiving a *space* didn't clear the open list, which was then inside an archived subtree. Only archiving the list itself did.
  - Fixed centrally in `AppShell`: if the open list is gone, move to the next visible list. If none is left, show a centred empty state explaining why (no spaces, all archived, no lists, nothing shared) with **Create a space**.
- **The select arrow sat outside the field** in some browsers. Replaced with a shared `Select` that hides the native arrow and draws its own (checked in Chromium and WebKit).

## Product feedback I gave while reviewing the app

- **Permissions UX:**
  - Switching user used to show *Access denied*. Now it redirects to a list the user can see, and *Access denied* is reserved for opening a denied list by URL.
  - The plain lock icon became a three-state visibility badge (public / restricted / private) with tooltips, and "only you" is admin-only.
  - The sidebar tooltips were clipped at the edge; they're now anchored to the row.
- **Task form:**
  - Ticking a subtask didn't enable Save. Subtask changes are now staged in the form, and Save applies everything atomically.
  - Save now closes the drawer.
  - Subtasks can be added while creating a task.
  - Required fields (Title, Status) have an asterisk.
- **Assignees:** I identified that a row of buttons wouldn't scale and specified a typeable multi-select. I then refined it: click-to-open, outside-click dismissal, keyboard behaviour (Enter with no match keeps the list open instead of submitting the form; it reopens after Escape), filtering, hiding already-assigned people, and matching the field's width.
- **Errors:** failures name the operation, singular or plural (*"We were unable to delete your tasks. Please try again."*), and error codes like 403 are never shown.
- **Layout:**
  - The sidebar can be collapsed at every screen size, and the preference is saved.
  - Toasts last 2s, or 4s with Undo.
  - Loading uses one skeleton per view instead of two different ones.

## Code-structure review (improvements I prioritised)

- Split the 348-line `TaskDrawer.tsx` into `CreateTaskForm`, `EditTaskForm`, `DrawerHeader` and a `useTaskForm` hook.
- Pulled `useSelection`, `BulkActionBar`, `SortHeader` and `sortTasks` out of `TaskListView`, and `ContainerMenu` / `AddChildButton` out of `TreeNode`.
- Made Redux action names consistent: slice actions are events (`listSelected`, `drawerClosed`…), thunks are commands.
- Renamed or moved files whose names no longer matched (`SubtaskEditor.tsx`, `ViewSkeletons.tsx`, `SidebarSkeleton.tsx`, `features/containers/`, `components/ui/InlineNameInput.tsx`).
- These were refactors only. The full unit, component and E2E suites passed before and after.
