import { describe, expect, it } from 'vitest';
import { IDS, USER_IDS } from '@/data/seed';
import { freshStore } from '@/test/factory';
import { createApi } from './api';
import { columnTasks } from './mutations/tasks';
import { failureSimulationChanged } from '@/store/slices/uiSlice';
import { switchUser } from '@/store/thunks';

const setup = () => {
  const store = freshStore();
  return { store, api: createApi(store, { latency: 0 }) };
};

describe('api facade', () => {
  it('optimistic move applies, then persists on success', async () => {
    const { store, api } = setup();
    const r = await api.moveTaskOptimistic({ id: 't_1', toStatusId: 'st_bl_done' });
    expect(r.ok).toBe(true);
    expect(store.getState().workspace.data.tasks.t_1!.statusId).toBe('st_bl_done');
  });

  it('optimistic move rolls back exactly the touched tasks on network failure', async () => {
    const { store, api } = setup();
    const before = store.getState().workspace.data;
    store.dispatch(failureSimulationChanged(true));

    const pending = api.moveTaskOptimistic({ id: 't_1', toStatusId: 'st_bl_done', toIndex: 0 });
    // applied immediately (optimistic)…
    expect(store.getState().workspace.data.tasks.t_1!.statusId).toBe('st_bl_done');

    const r = await pending;
    expect(!r.ok && r.error.code).toBe('NETWORK');
    // …and fully reverted, including sibling positions and the activity entry
    expect(store.getState().workspace.data.tasks).toEqual(before.tasks);
    expect(store.getState().workspace.data.activity).toEqual(before.activity);
  });

  it('does not apply an invalid move at all', async () => {
    const { store, api } = setup();
    store.dispatch(switchUser(USER_IDS.bob));
    const r = await api.moveTaskOptimistic({ id: 't_1', toListId: IDS.social });
    expect(!r.ok && r.error.code).toBe('FORBIDDEN');
    expect(columnTasks(store.getState().workspace.data, IDS.social, 'st_so_idea').map((t) => t.id)).not.toContain('t_1');
  });

  it('pessimistic mutations do not touch the store when the network fails', async () => {
    const { store, api } = setup();
    store.dispatch(failureSimulationChanged(true));
    const r = await api.updateTask({ id: 't_1', patch: { title: 'nope' } });
    expect(!r.ok && r.error.code).toBe('NETWORK');
    expect(store.getState().workspace.data.tasks.t_1!.title).toBe('Audit onboarding funnel drop-off');
  });

  it('fetchList returns 403 for a denied list', async () => {
    const { store, api } = setup();
    store.dispatch(switchUser(USER_IDS.carol));
    const r = await api.fetchList(IDS.backlog);
    expect(!r.ok && r.error.code).toBe('FORBIDDEN');
  });
});

describe('failure messages (simulated network failure)', () => {
  const failingApi = () => {
    const { store, api } = setup();
    store.dispatch(failureSimulationChanged(true));
    return { store, api };
  };
  const message = (r: { ok: boolean; error?: { message: string } }) => (r.ok ? null : r.error!.message);

  it('says what failed, singular vs plural by count', async () => {
    const { api } = failingApi();
    expect(message(await api.deleteTasks({ ids: ['t_1'] }))).toBe('We were unable to delete your task. Please try again.');
    expect(message(await api.deleteTasks({ ids: ['t_1', 't_2'] }))).toBe('We were unable to delete your tasks. Please try again.');
    expect(message(await api.restoreTasks({ ids: ['t_1', 't_2'] }))).toBe('We were unable to restore your tasks. Please try again.');
    expect(message(await api.deleteTask({ id: 't_1' }))).toBe('We were unable to delete your task. Please try again.');
    expect(message(await api.deleteTask({ id: 't_8a' }))).toBe('We were unable to delete your subtask. Please try again.');
  });

  it('drag & drop: "unable to move your task" and the move is rolled back', async () => {
    const { store, api } = failingApi();
    const r = await api.moveTaskOptimistic({ id: 't_1', toStatusId: 'st_bl_done' });
    expect(message(r)).toBe('We were unable to move your task. Please try again.');
    expect(store.getState().workspace.data.tasks.t_1!.statusId).toBe('st_bl_todo');
  });

  it('covers tasks, containers and statuses', async () => {
    const { api } = failingApi();
    expect(message(await api.createTask({ listId: IDS.backlog, title: 'x' }))).toBe('We were unable to create your task. Please try again.');
    expect(message(await api.createTask({ listId: IDS.sprint, title: 'x', parentTaskId: 't_8' }))).toBe(
      'We were unable to add your subtask. Please try again.',
    );
    expect(message(await api.updateTask({ id: 't_1', patch: { title: 'y' } }))).toBe('We were unable to save your changes. Please try again.');
    expect(message(await api.createContainer({ parentId: IDS.engineering, type: 'folder', name: 'x' }))).toBe(
      'We were unable to create your folder. Please try again.',
    );
    expect(message(await api.archiveContainer({ id: IDS.marketing }))).toBe('We were unable to archive your space. Please try again.');
    expect(message(await api.renameContainer({ id: IDS.backlog, name: 'x' }))).toBe('We were unable to rename your list. Please try again.');
    expect(message(await api.deleteStatus({ id: 'st_sp_review' }))).toBe('We were unable to delete the status. Please try again.');
  });

  it('validation errors keep their specific message (they tell the user what to fix)', async () => {
    const { api } = setup();
    expect(message(await api.createTask({ listId: IDS.backlog, title: '' }))).toBe('Title is required.');
  });
});
