import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { IDS, USER_IDS } from '@/data/seed';
import { App } from '@/App';
import { renderWithStore } from '@/test/render';
import { listPath, parseListId } from './useUrlSync';
import { archiveContainer, switchUser } from '@/store/thunks';

describe('list URLs', () => {
  it('round-trips ids and rejects other paths', () => {
    expect(listPath(IDS.backlog)).toBe('/lists/ls_backlog');
    expect(parseListId('/lists/ls_backlog')).toBe('ls_backlog');
    expect(parseListId('/lists/ls_backlog/')).toBe('ls_backlog');
    expect(parseListId(listPath('a b/c'))).toBe('a b/c');
    expect(listPath(null)).toBe('/');
    expect(parseListId('/')).toBeNull();
    expect(parseListId('/lists/')).toBeNull();
    expect(parseListId('/lists/%E0%A4%A')).toBeNull(); // malformed escape
  });
});

describe('URL-driven navigation', () => {
  it('opens the list in the URL on load (over the persisted selection)', async () => {
    window.history.replaceState(null, '', '/lists/ls_social');
    const { store } = renderWithStore(<App />, { selectedListId: IDS.backlog });
    expect(await screen.findByRole('region', { name: /^Ideas column/ })).toBeInTheDocument();
    expect(store.getState().workspace.selectedListId).toBe(IDS.social);
    expect(window.location.pathname).toBe('/lists/ls_social');
  });

  it('selecting a list updates the URL; back/forward re-selects', async () => {
    const user = userEvent.setup();
    const { store } = renderWithStore(<App />, { selectedListId: IDS.backlog });
    await screen.findByRole('region', { name: /^To do column/ });
    expect(window.location.pathname).toBe('/lists/ls_backlog');

    const sidebar = screen.getByRole('navigation', { name: 'Workspace' });
    await user.click(within(sidebar).getByRole('button', { name: 'List Social' }));
    expect(window.location.pathname).toBe('/lists/ls_social');

    // simulate the browser back button
    act(() => {
      window.history.replaceState(null, '', '/lists/ls_backlog');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(store.getState().workspace.selectedListId).toBe(IDS.backlog);
  });

  it('a member opening a link to a list they cannot access gets a 403, not the list', async () => {
    window.history.replaceState(null, '', '/lists/ls_sprint');
    renderWithStore(<App />, { currentUserId: USER_IDS.carol });
    expect(await screen.findByText('Access denied')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /column/ })).not.toBeInTheDocument();
    // the URL stays as typed, so the 403 is clearly about that link
    expect(window.location.pathname).toBe('/lists/ls_sprint');
  });

  it('switching user redirects to a list they can see — "Access denied" is only for URLs', async () => {
    window.history.replaceState(null, '', '/lists/ls_backlog');
    const { store } = renderWithStore(<App />);
    await screen.findByRole('region', { name: /^To do column/ });
    const before = window.history.length;

    act(() => void store.dispatch(switchUser(USER_IDS.carol)));
    expect(await screen.findByRole('region', { name: /^Ideas column/ })).toBeInTheDocument();
    expect(screen.queryByText('Access denied')).not.toBeInTheDocument();
    expect(window.location.pathname).toBe('/lists/ls_social');
    expect(window.history.length).toBe(before); // replaced: Back won't land on Backlog as Carol

    // …but explicitly navigating to the denied list (Back / pasted link) still shows it
    act(() => {
      window.history.pushState(null, '', '/lists/ls_backlog');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(await screen.findByText('Access denied')).toBeInTheDocument();
  });

  it('a member with no visible lists lands on the empty state after a switch', async () => {
    const { store } = renderWithStore(<App />, { selectedListId: IDS.backlog });
    await screen.findByRole('region', { name: /^To do column/ });
    act(() => {
      store.dispatch(archiveContainer({ id: IDS.marketing }));
      store.dispatch(switchUser(USER_IDS.carol));
    });
    expect(await screen.findByText('Nothing shared with you yet')).toBeInTheDocument();
    expect(screen.queryByText('Access denied')).not.toBeInTheDocument();
  });

  it('an unknown list id shows "not found" and redirects without leaving the dead link in history', async () => {
    window.history.replaceState(null, '', '/lists/ls_nope');
    const before = window.history.length;
    renderWithStore(<App />);
    expect(await screen.findByText(/List not found/)).toBeInTheDocument();
    await waitFor(() => expect(window.location.pathname).toBe('/lists/ls_backlog'));
    expect(window.history.length).toBe(before); // replaced, not pushed
  });
});
