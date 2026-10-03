import { useEffect, useRef } from 'react';
import type { ID } from '@/domain/types';
import { useAppDispatch, useAppSelector } from './context';
import { listSelected } from './slices/workspaceSlice';

/**
 * Minimal routing: the open list lives in the URL as `/lists/:listId`
 * (History API — one route doesn't justify a router dependency).
 *
 *  - on load, a list id in the URL wins over the persisted selection
 *  - selecting a list pushes a history entry; back/forward re-select it
 *  - the URL is never trusted: ListPage re-checks access for the current user,
 *    so pasting a link (or switching user on it) yields the 403 / not-found states
 *
 * Effects are idempotent so React StrictMode's double invocation is harmless.
 */
const LIST_PATH = /^\/lists\/([^/]+)\/?$/;

export const listPath = (listId: ID | null) => (listId ? `/lists/${encodeURIComponent(listId)}` : '/');

export function parseListId(pathname: string): ID | null {
  const match = LIST_PATH.exec(pathname);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]!);
  } catch {
    return null; // malformed escape sequence
  }
}

export function useUrlSync() {
  const selectedListId = useAppSelector((s) => s.workspace.selectedListId);
  const navReplace = useAppSelector((s) => s.workspace.navReplace);
  const dispatch = useAppDispatch();
  /** list id from the URL at load time, until the store has adopted it */
  const fromUrl = useRef<ID | null | undefined>(undefined);
  if (fromUrl.current === undefined) fromUrl.current = parseListId(window.location.pathname);

  // state → URL
  useEffect(() => {
    const initial = fromUrl.current;
    if (initial) {
      if (selectedListId !== initial) {
        dispatch(listSelected(initial, { replace: true }));
        return;
      }
      fromUrl.current = null; // adopted
    }
    const target = listPath(selectedListId);
    if (window.location.pathname === target) return;
    // replace for redirects, and when leaving a non-list URL like "/" (no pointless history entry)
    if (navReplace || !parseListId(window.location.pathname)) window.history.replaceState(null, '', target);
    else window.history.pushState(null, '', target);
  }, [selectedListId, navReplace, dispatch]);

  // URL → state (browser back / forward)
  useEffect(() => {
    const onPop = () => dispatch(listSelected(parseListId(window.location.pathname), { replace: true }));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [dispatch]);
}
