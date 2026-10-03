import clsx from 'clsx';
import { Fragment, useMemo } from 'react';
import { Button, IconButton } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Spinner';
import { useAppDispatch, useAppSelector } from '@/store/context';
import { drawerOpened, sidebarOpened, failureSimulationChanged } from '@/store/slices/uiSlice';
import { activityToggled, sidebarExpanded, viewChanged } from '@/store/slices/workspaceSlice';
import type { ViewMode } from '@/store/slices/workspaceSlice';
import { useSession } from '@/store/hooks';
import { selectList } from '@/store/selectors';
import { VisibilityBadge } from '../sidebar/VisibilityBadge';
import { DESKTOP_QUERY, useMediaQuery } from '@/components/ui/useMediaQuery';
import { UserSwitcher } from './UserSwitcher';

const VIEWS: { id: ViewMode; label: string; icon: 'board' | 'table' }[] = [
  { id: 'board', label: 'Kanban', icon: 'board' },
  { id: 'list', label: 'List', icon: 'table' },
];

export function TopBar({ ready }: { ready: boolean }) {
  const { data, userId } = useSession();
  const listId = useAppSelector((s) => s.workspace.selectedListId);
  const view = useAppSelector((s) => s.workspace.view);
  const activityOpen = useAppSelector((s) => s.workspace.activityOpen);
  const simulateFailures = useAppSelector((s) => s.ui.simulateFailures);
  const sidebarIsCollapsed = useAppSelector((s) => s.workspace.sidebarCollapsed);
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const dispatch = useAppDispatch();

  const list = useMemo(() => (listId ? selectList(data, userId, listId) : null), [data, userId, listId]);
  const canUseList = Boolean(list?.ok);

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-surface-border bg-white px-3 sm:gap-3 sm:px-5 lg:gap-4">
      {isDesktop ? (
        sidebarIsCollapsed && (
          <IconButton label="Show sidebar" onClick={() => dispatch(sidebarExpanded())}>
            <Icon name="menu" className="h-5 w-5" />
          </IconButton>
        )
      ) : (
        <IconButton label="Open menu" onClick={() => dispatch(sidebarOpened())}>
          <Icon name="menu" className="h-5 w-5" />
        </IconButton>
      )}

      <div className="min-w-0 flex-1">
        {!ready ? (
          <Skeleton className="h-5 w-32 sm:w-48" />
        ) : list?.ok ? (
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
            {/* ancestors only where there's room — and they truncate before the list name does */}
            <span className="hidden min-w-0 shrink items-center gap-1.5 xl:flex">
              {list.data.path.slice(1, -1).map((c) => (
                <Fragment key={c.id}>
                  <span className="truncate text-ink-muted">{c.name}</span>
                  <Icon name="chevronRight" className="h-3.5 w-3.5 text-ink-subtle" />
                </Fragment>
              ))}
            </span>
            <h1 className="max-w-full shrink-0 truncate text-[15px] font-semibold text-ink">{list.data.list.name}</h1>
            <VisibilityBadge containerId={list.data.list.id} align="start" />
          </nav>
        ) : (
          <span className="text-sm text-ink-muted">Flowboard</span>
        )}
      </div>

      {canUseList && (
        <>
          <div role="tablist" aria-label="View" className="flex shrink-0 rounded-lg bg-surface-sunken p-0.5">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                role="tab"
                type="button"
                aria-label={v.label}
                title={v.label}
                aria-selected={view === v.id}
                onClick={() => dispatch(viewChanged(v.id))}
                className={clsx(
                  'flex h-7 items-center gap-1.5 rounded-md px-2 text-[13px] font-medium transition-colors sm:px-2.5',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                  view === v.id ? 'bg-white text-ink shadow-card' : 'text-ink-muted hover:text-ink',
                )}
              >
                <Icon name={v.icon} className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{v.label}</span>
              </button>
            ))}
          </div>
          <Button
            size="sm"
            variant="ghost"
            aria-label="Activity"
            title="Activity"
            aria-pressed={activityOpen}
            onClick={() => dispatch(activityToggled())}
            className={clsx('shrink-0', activityOpen && 'bg-surface-sunken text-ink')}
          >
            <Icon name="activity" className="h-4 w-4" />
            <span className="hidden md:inline">Activity</span>
          </Button>
          <Button
            size="sm"
            variant="primary"
            aria-label="New task"
            title="New task"
            className="shrink-0"
            onClick={() => listId && dispatch(drawerOpened({ mode: 'create', listId }))}
          >
            <Icon name="plus" className="h-4 w-4" />
            <span className="hidden sm:inline">New task</span>
          </Button>
        </>
      )}

      <div className="hidden h-6 w-px shrink-0 bg-surface-border md:block" />

      <label
        className={clsx(
          // dev-only control: hidden on phones to leave room for the list name
          'hidden shrink-0 cursor-pointer select-none items-center gap-2 rounded-lg px-2 py-1 text-xs font-medium transition-colors sm:flex',
          simulateFailures ? 'bg-red-50 text-red-700' : 'text-ink-subtle hover:text-ink-muted',
        )}
        title="Simulate failures — dev tool: make every save fail to demo error handling and optimistic rollback"
      >
        <input
          type="checkbox"
          aria-label="Simulate failures"
          className="peer sr-only"
          checked={simulateFailures}
          onChange={(e) => dispatch(failureSimulationChanged(e.target.checked))}
        />
        <span
          className={clsx(
            'relative h-4 w-7 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500',
            simulateFailures ? 'bg-red-500' : 'bg-slate-300',
          )}
        >
          <span
            className={clsx(
              'absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all',
              simulateFailures ? 'left-3.5' : 'left-0.5',
            )}
          />
        </span>
        <span className="hidden xl:inline">Simulate failures</span>
      </label>

      <UserSwitcher />
    </header>
  );
}
