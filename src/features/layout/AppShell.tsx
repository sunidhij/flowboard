import clsx from 'clsx';
import { Suspense, useEffect } from 'react';
import { DESKTOP_QUERY, useMediaQuery } from '@/components/ui/useMediaQuery';
import { sidebarClosed } from '@/store/slices/uiSlice';
import { BoardSkeleton, ListSkeleton } from '../list/ViewSkeletons';
import { useAppDispatch, useAppSelector } from '@/store/context';
import { listSelected } from '@/store/slices/workspaceSlice';
import { pushToast } from '@/store/thunks';
import { useSession } from '@/store/hooks';
import { isListGone, selectFirstVisibleList } from '@/store/selectors';
import { Sidebar } from '../sidebar/Sidebar';
import { SidebarSkeleton } from '../sidebar/SidebarSkeleton';
import { ListPage } from '../list/ListPage';
import { TaskDrawer } from '@/lazy';
import { ErrorBoundary, SectionCrash } from '@/components/ui/ErrorBoundary';
import { EmptyWorkspace } from './EmptyWorkspace';
import { TopBar } from './TopBar';

/** App chrome: sidebar + top bar + main content. */
export function AppShell({ ready }: { ready: boolean }) {
  const selectedListId = useAppSelector((s) => s.workspace.selectedListId);
  const dispatch = useAppDispatch();
  const view = useAppSelector((s) => s.workspace.view);
  const sidebarOpen = useAppSelector((s) => s.ui.sidebarOpen);
  const collapsed = useAppSelector((s) => s.workspace.sidebarCollapsed);
  const isDesktop = useMediaQuery(DESKTOP_QUERY);

  // Escape closes the mobile sidebar; growing to desktop width resets it
  useEffect(() => {
    if (isDesktop && sidebarOpen) dispatch(sidebarClosed());
    if (!sidebarOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && dispatch(sidebarClosed());
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sidebarOpen, isDesktop, dispatch]);
  const { data, userId } = useSession();

  // Keep a sensible list open:
  // - first visit / after a reset → open the first list the user can see
  // - the open list was archived (directly or via its folder/space) → move on, or clear
  // A FORBIDDEN list is only ever selected via the URL (switchUser redirects), and stays selected
  // on purpose so the "Access denied" state explains the link.
  useEffect(() => {
    if (!ready) return;
    if (!selectedListId || isListGone(data, selectedListId)) {
      // e.g. a pasted /lists/<id> that never existed (archived lists already got an "archived" toast)
      if (selectedListId && !data.containers[selectedListId]) {
        dispatch(pushToast({ kind: 'error', message: 'List not found. It may have been deleted, or the link is wrong.' }));
      }
      const next = selectFirstVisibleList(data, userId);
      if (next !== selectedListId) dispatch(listSelected(next, { replace: true })); // don't leave a dead link in history
    }
  }, [ready, selectedListId, data, userId, dispatch]);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* below lg the sidebar slides in over the content; at lg+ it's a permanent column */}
      {sidebarOpen && !isDesktop && (
        <div className="fixed inset-0 z-30 bg-slate-900/30 lg:hidden" aria-hidden onClick={() => dispatch(sidebarClosed())} />
      )}
      <aside
        aria-label="Sidebar"
        // closed + off-screen on small screens → not focusable / not announced
        {...((isDesktop ? collapsed : !sidebarOpen) ? { inert: '', 'aria-hidden': true } : {})}
        className={clsx(
          'fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-surface-border bg-white transition-transform duration-200',
          'lg:static lg:z-auto lg:translate-x-0 lg:shadow-none',
          collapsed && 'lg:hidden', // desktop: collapsed → the board takes the full width
          sidebarOpen ? 'translate-x-0 shadow-lift' : '-translate-x-full',
        )}
      >
        {ready ? <Sidebar /> : <SidebarSkeleton />}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar ready={ready} />
        <main className="flex min-h-0 flex-1">
          {!ready ? (
            // same skeleton as the list loader → one continuous loading state, no flash between two designs
            <div className="flex min-w-0 flex-1 flex-col">{view === 'board' ? <BoardSkeleton /> : <ListSkeleton />}</div>
          ) : selectedListId && !isListGone(data, selectedListId) ? (
            // a crash in the board/list keeps the sidebar & top bar usable; navigating away clears it
            <ErrorBoundary resetKeys={[selectedListId, userId]} fallback={({ reset }) => <SectionCrash reset={reset} />}>
              <ListPage key={selectedListId} listId={selectedListId} />
            </ErrorBoundary>
          ) : (
            <EmptyWorkspace />
          )}
        </main>
      </div>
      {ready && (
        <Suspense fallback={null}>
          <TaskDrawer />
        </Suspense>
      )}
    </div>
  );
}
