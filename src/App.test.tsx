import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { IDS } from '@/data/seed';
import { App } from './App';
import { renderWithStore } from './test/render';
import { failureSimulationChanged } from '@/store/slices/uiSlice';
import { viewChanged } from '@/store/slices/workspaceSlice';
import { archiveContainer, switchUser } from '@/store/thunks';

const sidebar = () => screen.getByRole('navigation', { name: 'Workspace' });

async function switchTo(user: ReturnType<typeof userEvent.setup>, name: RegExp) {
  await user.click(screen.getByRole('button', { name: /Current user/ }));
  await user.click(await screen.findByRole('menuitem', { name }));
}

describe('App', () => {
  it('switching users immediately changes the tree and the board', async () => {
    const user = userEvent.setup();
    renderWithStore(<App />);

    // admin sees the private space (after the simulated workspace load)
    await screen.findByRole('navigation', { name: 'Workspace' });
    expect(await within(sidebar()).findByText('Marketing')).toBeInTheDocument();
    expect(await screen.findByRole('region', { name: /^To do column/ })).toBeInTheDocument();

    await switchTo(user, /Bob Chen/);
    await waitFor(() => expect(within(sidebar()).queryByText('Marketing')).not.toBeInTheDocument());
    expect(within(sidebar()).getByText('Sprint 12')).toBeInTheDocument();

    await switchTo(user, /Carol Diaz/);
    expect(within(sidebar()).queryByText('Backlog')).not.toBeInTheDocument();
    // Carol can't open Backlog → she's taken to her own list, with an explanation (no "Access denied")
    expect(await screen.findByRole('region', { name: /^Ideas column/ })).toBeInTheDocument();
    expect(screen.queryByText('Access denied')).not.toBeInTheDocument();
    expect(screen.getByText('“Backlog” isn’t shared with Carol Diaz, so “Social” was opened.')).toBeInTheDocument();
    expect(screen.queryByText(/Now viewing as/)).not.toBeInTheDocument();
  });

  it('switching to a user who can see the open list keeps it open', async () => {
    const user = userEvent.setup();
    const { store } = renderWithStore(<App />, { selectedListId: IDS.sprint });
    await screen.findByRole('region', { name: /^In review column/ });
    await switchTo(user, /Bob Chen/);
    expect(store.getState().workspace.selectedListId).toBe(IDS.sprint);
    expect(screen.queryByText(/Now viewing as/)).not.toBeInTheDocument(); // plain switch: no snackbar
  });

  it('admin can build a space → folder → list hierarchy from the sidebar', async () => {
    const user = userEvent.setup();
    const { store } = renderWithStore(<App />);

    await user.click(await screen.findByRole('button', { name: 'New space' }));
    await user.type(screen.getByPlaceholderText('New space name'), 'Design{Enter}');

    // empty space offers an inline "Add folder"
    await user.click(await within(sidebar()).findByRole('button', { name: 'Add folder' }));
    await user.type(screen.getByPlaceholderText('New folder name'), 'Website{Enter}');

    // folders also have a direct "+" on the row
    await user.click(await screen.findByRole('button', { name: 'New list in Website' }));
    await user.type(screen.getByPlaceholderText('New list name'), 'Ideas{Enter}');

    expect(await within(sidebar()).findByText('Ideas')).toBeInTheDocument();
    const byName = (n: string) => Object.values(store.getState().workspace.data.containers).find((c) => c.name === n)!;
    expect(byName('Website')).toMatchObject({ type: 'folder', parentId: byName('Design').id });
    expect(byName('Ideas')).toMatchObject({ type: 'list', parentId: byName('Website').id });
    // the new list opens straight away
    expect(store.getState().workspace.selectedListId).toBe(byName('Ideas').id);
  });

  it('sidebar name field: × in the error state removes the input entirely', async () => {
    const user = userEvent.setup();
    const { store } = renderWithStore(<App />);

    // create: too-long name → error → × closes the field, nothing created
    await user.click(await screen.findByRole('button', { name: 'New space' }));
    await user.type(screen.getByPlaceholderText('New space name'), `${'x'.repeat(85)}{Enter}`);
    expect(await screen.findByText(/at most 80 characters/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByPlaceholderText('New space name')).not.toBeInTheDocument();
    expect(screen.queryByText(/at most 80 characters/)).not.toBeInTheDocument();
    expect(Object.values(store.getState().workspace.data.containers).filter((c) => c.type === 'space')).toHaveLength(2);

    // rename with a network failure → × closes the field, original name kept
    act(() => store.dispatch(failureSimulationChanged(true)));
    within(sidebar()).getByRole('button', { name: 'Space Engineering' }).focus();
    await user.keyboard('{F2}');
    const rename = screen.getByPlaceholderText('Rename space');
    await user.clear(rename);
    await user.type(rename, 'Eng{Enter}');
    expect(await screen.findByText('We were unable to rename your space. Please try again.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByPlaceholderText('Rename space')).not.toBeInTheDocument();
    expect(within(sidebar()).getByRole('button', { name: 'Space Engineering' })).toBeInTheDocument();
  });

  it('admin can add a list directly to a space (folders are optional)', async () => {
    const user = userEvent.setup();
    const { store } = renderWithStore(<App />);

    // the row "+" on a space offers both folder and list
    await user.click(await screen.findByRole('button', { name: 'Add to Engineering' }));
    expect(await screen.findByRole('menuitem', { name: 'New folder' })).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'New list' }));
    await user.type(screen.getByPlaceholderText('New list name'), 'Inbox{Enter}');

    expect(await within(sidebar()).findByText('Inbox')).toBeInTheDocument();
    const inbox = Object.values(store.getState().workspace.data.containers).find((c) => c.name === 'Inbox')!;
    expect(inbox).toMatchObject({ type: 'list', parentId: IDS.engineering });
    // it opens as a normal board with the default statuses
    expect(await screen.findByRole('region', { name: /^To do column/ })).toBeInTheDocument();
  });

  it('archiving the space of the open list moves to the next visible list (no 404)', async () => {
    const { store } = renderWithStore(<App />, { selectedListId: IDS.backlog });
    expect(await screen.findByRole('region', { name: /^To do column/ })).toBeInTheDocument();

    act(() => void store.dispatch(archiveContainer({ id: IDS.engineering })));

    await waitFor(() => expect(store.getState().workspace.selectedListId).toBe(IDS.social));
    expect(await screen.findByRole('region', { name: /^Ideas column/ })).toBeInTheDocument();
    expect(screen.queryByText(/NOT_FOUND/)).not.toBeInTheDocument();
  });

  it('shows a centered empty state when every space is archived, and lets you start again', async () => {
    const user = userEvent.setup();
    const { store } = renderWithStore(<App />, { selectedListId: IDS.backlog });
    await screen.findByRole('region', { name: /^To do column/ });

    act(() => {
      store.dispatch(archiveContainer({ id: IDS.engineering }));
      store.dispatch(archiveContainer({ id: IDS.marketing }));
    });

    expect(await screen.findByText('All spaces are archived')).toBeInTheDocument();
    expect(screen.queryByText(/NOT_FOUND/)).not.toBeInTheDocument();
    expect(store.getState().workspace.selectedListId).toBeNull();

    // create a space from the empty state, then a list in it
    await user.click(screen.getByRole('button', { name: 'Create a space' }));
    await user.type(screen.getAllByPlaceholderText('New space name')[0]!, 'Fresh start{Enter}');
    expect(await screen.findByText('No lists yet')).toBeInTheDocument();
    await user.click(await within(sidebar()).findByRole('button', { name: 'Add list' }));
    await user.type(screen.getByPlaceholderText('New list name'), 'Todo{Enter}');
    expect(await screen.findByRole('region', { name: /^To do column/ })).toBeInTheDocument();
  });

  it('members with nothing visible get an "ask an admin" empty state', async () => {
    const { store } = renderWithStore(<App />, { selectedListId: IDS.backlog });
    await screen.findByRole('region', { name: /^To do column/ });
    act(() => {
      store.dispatch(archiveContainer({ id: IDS.engineering }));
      store.dispatch(archiveContainer({ id: IDS.marketing }));
      store.dispatch(switchUser('u_bob'));
    });
    expect(await screen.findByText('Nothing shared with you yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create a space' })).not.toBeInTheDocument();
  });

  it('admin can add a custom status from the board; members cannot configure statuses', async () => {
    const user = userEvent.setup();
    const { store } = renderWithStore(<App />, { selectedListId: IDS.backlog });

    await user.click(await screen.findByRole('button', { name: 'Add status' }));
    await user.type(screen.getByLabelText('Name'), 'Blocked');
    await user.selectOptions(screen.getByLabelText('Category'), 'in_progress');
    await user.click(screen.getByRole('radio', { name: 'red' }));
    await user.click(within(screen.getByRole('form', { name: 'Add status' })).getByRole('button', { name: 'Add status' }));

    expect(await screen.findByRole('region', { name: /^Blocked column/ })).toBeInTheDocument();
    const blocked = Object.values(store.getState().workspace.data.statuses).find((s) => s.name === 'Blocked');
    expect(blocked).toMatchObject({ listId: IDS.backlog, category: 'in_progress', color: 'red' });

    act(() => void store.dispatch(switchUser('u_bob')));
    await screen.findByRole('region', { name: /^Blocked column/ });
    expect(screen.queryByRole('button', { name: 'Add status' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Status options for/ })).not.toBeInTheDocument();
  });

  it('the sidebar can be collapsed and shown again on desktop', async () => {
    const user = userEvent.setup();
    const { store } = renderWithStore(<App />, { selectedListId: IDS.backlog });
    await screen.findByRole('navigation', { name: 'Workspace' });
    expect(screen.queryByRole('button', { name: 'Show sidebar' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    // hidden (and inert) — the board keeps working
    expect(screen.queryByRole('navigation', { name: 'Workspace' })).not.toBeInTheDocument();
    expect(store.getState().workspace.sidebarCollapsed).toBe(true);
    expect(screen.getByRole('region', { name: /^To do column/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show sidebar' }));
    expect(await screen.findByRole('navigation', { name: 'Workspace' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show sidebar' })).not.toBeInTheDocument();
  });

  it('hides container management controls from members', async () => {
    const user = userEvent.setup();
    renderWithStore(<App />);
    expect(await screen.findByRole('button', { name: 'New space' })).toBeInTheDocument();
    await switchTo(user, /Bob Chen/);
    expect(screen.queryByRole('button', { name: 'New space' })).not.toBeInTheDocument();
    expect(within(sidebar()).queryByRole('button', { name: /Actions for/ })).not.toBeInTheDocument(); // container menus
    // …but members can still delete tasks, so card menus remain
    expect(screen.getAllByRole('button', { name: /^Actions for / }).length).toBeGreaterThan(0);
  });
});

describe('Task drawer', () => {
  it('opens from a card, closes on Escape and returns focus to the card', async () => {
    const user = userEvent.setup();
    renderWithStore(<App />, { selectedListId: IDS.backlog });

    const cardEl = await screen.findByRole('button', { name: /^Migrate CI to cached runners\./ });
    cardEl.focus();
    await user.keyboard('{Enter}');

    const title = await screen.findByLabelText('Title');
    expect(title).toHaveValue('Migrate CI to cached runners');
    await waitFor(() => expect(title).toHaveFocus());

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByLabelText('Title')).not.toBeInTheDocument());
    await waitFor(() => expect(cardEl).toHaveFocus());
  });

  it('keeps the drawer open on validation errors, and closes it after a successful save', async () => {
    const user = userEvent.setup();
    const { store } = renderWithStore(<App />, { selectedListId: IDS.backlog });

    await user.click(await screen.findByRole('button', { name: /^Write ADR for event bus\./ }));
    const title = await screen.findByLabelText('Title');
    await user.clear(title);
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Title is required.')).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toBeInTheDocument(); // still open

    await user.type(title, 'Write ADR for the event bus');
    await user.click(screen.getByRole('radio', { name: /Urgent/ }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Changes saved')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByLabelText('Title')).not.toBeInTheDocument());
    expect(store.getState().workspace.data.tasks.t_5).toMatchObject({ title: 'Write ADR for the event bus', priority: 'urgent' });
  });

  it('ticking a subtask in the edit form enables Save; Discard reverts; Save applies it', async () => {
    const user = userEvent.setup();
    const { store } = renderWithStore(<App />, { selectedListId: IDS.sprint });

    await user.click(await screen.findByRole('button', { name: /^Ship SSO login flow\./ }));
    const save = await screen.findByRole('button', { name: 'Save changes' });
    expect(save).toBeDisabled();

    const tick = screen.getByRole('checkbox', { name: /Session handoff to SPA/ });
    await user.click(tick);
    expect(save).toBeEnabled();
    expect(store.getState().workspace.data.tasks.t_8b!.statusId).toBe('st_sp_prog'); // staged, not saved yet

    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(screen.getByRole('checkbox', { name: /Session handoff to SPA/ })).not.toBeChecked();
    expect(save).toBeDisabled();

    await user.click(screen.getByRole('checkbox', { name: /Session handoff to SPA/ }));
    await user.click(save);
    await waitFor(() => expect(screen.queryByLabelText('Title', { exact: true })).not.toBeInTheDocument());
    expect(store.getState().workspace.data.tasks.t_8b!.statusId).toBe('st_sp_done');
  });

  it('deletes a task from the card ⋯ menu, with confirmation and Undo', async () => {
    const user = userEvent.setup();
    const { store } = renderWithStore(<App />, { selectedListId: IDS.backlog });

    await user.click(await screen.findByRole('button', { name: 'Actions for Write ADR for event bus' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    // the menu must not open the drawer
    expect(screen.queryByLabelText('Title', { exact: true })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Delete task' }));

    await waitFor(() => expect(screen.queryByRole('button', { name: /^Write ADR for event bus\./ })).not.toBeInTheDocument());
    expect(store.getState().workspace.data.tasks.t_5!.archivedAt).toBeDefined();
    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    expect(await screen.findByRole('button', { name: /^Write ADR for event bus\./ })).toBeInTheDocument();
  });

  it('list view: select several tasks (or all) and delete them together', async () => {
    const user = userEvent.setup();
    const { store } = renderWithStore(<App />, { selectedListId: IDS.backlog });
    act(() => store.dispatch(viewChanged('list')));

    await user.click(await screen.findByRole('checkbox', { name: 'Select Write ADR for event bus' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select Evaluate feature-flag vendors' }));
    expect(screen.getByText('2 tasks selected')).toBeInTheDocument();
    // checking a row doesn't open the drawer
    expect(screen.queryByLabelText('Title', { exact: true })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete 2 tasks' }));
    await user.click(await within(await screen.findByRole('dialog')).findByRole('button', { name: 'Delete 2 tasks' }));
    expect(await screen.findByText('2 tasks deleted')).toBeInTheDocument();
    expect(store.getState().workspace.data.tasks.t_5!.archivedAt).toBeDefined();
    expect(store.getState().workspace.data.tasks.t_3!.archivedAt).toBeDefined();
    expect(screen.queryByText(/tasks selected/)).not.toBeInTheDocument();

    // select all → everything on the page
    await user.click(screen.getByRole('checkbox', { name: 'Select all tasks' }));
    expect(screen.getByText('5 tasks selected')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Deselect all tasks' }));
    expect(screen.queryByText(/tasks selected/)).not.toBeInTheDocument();
  });

  it('assignees: type to filter, pick several, remove with × or Backspace, then save', async () => {
    const user = userEvent.setup();
    const { store } = renderWithStore(<App />, { selectedListId: IDS.backlog });
    // while the list is open Headless UI makes the rest of the form inert, so read chips after closing it
    const chips = async () => {
      if (input.getAttribute('aria-expanded') === 'true') await user.keyboard('{Escape}');
      return screen.queryAllByRole('button', { name: /^Remove / }).map((b) => b.getAttribute('aria-label')!.replace('Remove ', ''));
    };

    // t_2 "Design empty states for dashboards" is assigned to Bob
    await user.click(await screen.findByRole('button', { name: /^Design empty states for dashboards\./ }));
    const input = await screen.findByRole('combobox', { name: 'Assignees' });
    expect(await chips()).toEqual(['Bob Chen']);

    // assigned people aren't offered again; the list is names only
    await user.click(input);
    expect((await screen.findAllByRole('option')).map((o) => o.textContent)).toEqual(['Alice Martin', 'Carol Diaz']);

    // typing filters; picking adds (doesn't replace) and clears the query
    await user.type(input, 'car');
    const options = await screen.findAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['Carol Diaz']);
    await user.click(options[0]!);
    expect(input).toHaveValue('');
    expect(await chips()).toEqual(['Bob Chen', 'Carol Diaz']);

    await user.type(input, 'zzz');
    expect(await screen.findByText('No people match “zzz”')).toBeInTheDocument();
    await user.clear(input);

    await user.type(input, 'ali{Enter}');
    expect(await chips()).toEqual(['Bob Chen', 'Carol Diaz', 'Alice Martin']);
    await user.click(input);
    expect(await screen.findByText('Everyone is already assigned')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await user.click(input);
    await user.keyboard('{Backspace}'); // empty query → removes the last chip
    expect(await chips()).toEqual(['Bob Chen', 'Carol Diaz']);
    await user.click(screen.getByRole('button', { name: 'Remove Bob Chen' }));
    expect(await chips()).toEqual(['Carol Diaz']);

    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(store.getState().workspace.data.tasks.t_2!.assigneeIds).toEqual(['u_carol']));
  });

  it('assignee picker: opens on click, Enter with no match keeps the empty state (and does not submit), outside click closes', async () => {
    const user = userEvent.setup();
    const { store } = renderWithStore(<App />, { selectedListId: IDS.backlog });
    await user.click(await screen.findByRole('button', { name: /^Design empty states for dashboards\./ }));
    const input = await screen.findByRole('combobox', { name: 'Assignees' });

    await user.click(input); // no need to use the arrow
    expect(await screen.findByRole('listbox')).toBeInTheDocument();

    await user.type(input, 'zzz{Enter}');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getByText('No people match “zzz”')).toBeInTheDocument();
    // (the rest of the form is inert while the list is open, hence hidden: true)
    expect(screen.getByRole('button', { name: 'Save changes', hidden: true })).toBeDisabled(); // nothing changed, nothing submitted
    expect(store.getState().workspace.data.tasks.t_2!.assigneeIds).toEqual(['u_bob']);

    await user.click(screen.getByText('Description', { selector: 'label' }));
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
  });

  it('creates subtasks from the new-task form (Enter adds, the typed-but-not-entered one is kept too)', async () => {
    const user = userEvent.setup();
    const { store } = renderWithStore(<App />, { selectedListId: IDS.backlog });

    await user.click(await screen.findByRole('button', { name: 'New task' }));
    await user.type(await screen.findByLabelText('Title'), 'Plan the offsite');
    const subInput = screen.getByLabelText('New subtask title');
    await user.type(subInput, 'Book venue{Enter}');
    await user.type(subInput, 'Send invites{Enter}');
    await user.type(subInput, 'Order food'); // no Enter — still included on submit
    expect(screen.getByLabelText('Title')).toHaveValue('Plan the offsite'); // Enter didn't submit the form

    await user.click(screen.getByRole('button', { name: 'Create task' }));
    expect(await screen.findByText('Task “Plan the offsite” created with 3 subtasks')).toBeInTheDocument();

    const parent = Object.values(store.getState().workspace.data.tasks).find((t) => t.title === 'Plan the offsite')!;
    const subs = Object.values(store.getState().workspace.data.tasks).filter((t) => t.parentTaskId === parent.id);
    expect(subs.map((s) => s.title).sort()).toEqual(['Book venue', 'Order food', 'Send invites']);
    // card shows the subtask counter
    const card = await screen.findByRole('button', { name: /^Plan the offsite\./ });
    expect(within(card).getByText('0/3')).toBeInTheDocument();
  });

  it('creates a task in the column it was opened from', async () => {
    const user = userEvent.setup();
    const { store } = renderWithStore(<App />, { selectedListId: IDS.backlog });

    await user.click(await screen.findByRole('button', { name: 'Add task to Done' }));
    // required fields are announced as required (the visual asterisk is aria-hidden)
    expect(await screen.findByLabelText('Title')).toHaveAttribute('aria-required', 'true');
    expect(screen.getByLabelText('Status')).toHaveAttribute('aria-required', 'true');
    expect(screen.getByLabelText('Due date')).not.toHaveAttribute('aria-required');
    await user.type(await screen.findByLabelText('Title'), 'Ship the release notes');
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    const done = await screen.findByRole('region', { name: /^Done column/ });
    expect(await within(done).findByText('Ship the release notes')).toBeInTheDocument();
    const created = Object.values(store.getState().workspace.data.tasks).find((t) => t.title === 'Ship the release notes');
    expect(created?.statusId).toBe('st_bl_done');
  });
});