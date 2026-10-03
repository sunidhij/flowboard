import { Suspense, useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import clsx from 'clsx';
import type { AppError } from '@/domain/errors';
import { Icon } from '@/components/ui/Icon';
import { BoardSkeleton, ListSkeleton } from './ViewSkeletons';
import type { ID } from '@/domain/types';
import { useAppDispatch, useAppSelector } from '@/store/context';
import { listSelected } from '@/store/slices/workspaceSlice';
import { useListLoader, useListView, useSession } from '@/store/hooks';
import { selectFirstVisibleList } from '@/store/selectors';
import { ActivityFeed, KanbanBoard, TaskListView } from '@/lazy';

/** Loads the selected list (simulated fetch) and renders the active view. */
export function ListPage({ listId }: { listId: ID }) {
  const load = useListLoader(listId);
  const view = useAppSelector((s) => s.workspace.view);
  const activityOpen = useAppSelector((s) => s.workspace.activityOpen);
  // permission is re-checked on every render from the store, not just at load time
  const listView = useListView(listId);

  let content;
  if (load.status === 'loading') content = view === 'board' ? <BoardSkeleton /> : <ListSkeleton />;
  else if (load.status === 'error' || !listView.ok) {
    const error = load.status === 'error' ? load.error : !listView.ok ? listView.error : null;
    content = <DeniedState error={error!} />;
  } else {
    // code-split views: their skeleton doubles as the chunk-loading fallback
    content =
      view === 'board' ? (
        <Suspense fallback={<BoardSkeleton />}>
          <KanbanBoard listId={listId} />
        </Suspense>
      ) : (
        <Suspense fallback={<ListSkeleton />}>
          <TaskListView listId={listId} />
        </Suspense>
      );
  }

  const showFeed = activityOpen && load.status === 'ready' && listView.ok;

  return (
    <div className="flex min-w-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">{content}</div>
      {showFeed && (
        <Suspense fallback={<aside aria-busy="true" className="w-80 shrink-0 border-l border-surface-border bg-white" />}>
          <ActivityFeed listId={listId} />
        </Suspense>
      )}
    </div>
  );
}

/** Centered state for a list the user can't open (no access, or it no longer exists). */
function DeniedState({ error }: { error: AppError }) {
  const { data, userId } = useSession();
  const dispatch = useAppDispatch();
  const fallback = useMemo(() => selectFirstVisibleList(data, userId), [data, userId]);
  const forbidden = error.code === 'FORBIDDEN';

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div role="alert" className="flex max-w-sm flex-col items-center text-center">
        <span
          className={clsx(
            'flex h-12 w-12 items-center justify-center rounded-xl',
            forbidden ? 'bg-amber-50 text-amber-600' : 'bg-surface-sunken text-ink-subtle',
          )}
        >
          <Icon name={forbidden ? 'lock' : 'alert'} className="h-6 w-6" />
        </span>
        <h2 className="mt-3 text-sm font-semibold text-ink">{forbidden ? 'Access denied' : 'This list isn’t available'}</h2>
        <p className="mt-1 text-sm text-ink-muted">
          {forbidden ? 'You don’t have access to this list. Ask an admin to share it with you.' : error.message}
        </p>
        {fallback && (
          <Button className="mt-4" onClick={() => dispatch(listSelected(fallback))}>
            Go to {data.containers[fallback]?.name}
          </Button>
        )}
      </div>
    </div>
  );
}
