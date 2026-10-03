import { formatDistanceToNowStrict } from 'date-fns';
import type { Activity, ID } from '@/domain/types';
import { Avatar } from '@/components/ui/Avatar';
import { IconButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { useAppDispatch } from '@/store/context';
import { drawerOpened } from '@/store/slices/uiSlice';
import { activityToggled } from '@/store/slices/workspaceSlice';
import { useActivity, useSession } from '@/store/hooks';
import { describeActivity } from './describe';

export function ActivityItems({ items, compact }: { items: Activity[]; compact?: boolean }) {
  const { data } = useSession();
  const dispatch = useAppDispatch();
  return (
    <ol className="space-y-3">
      {items.map((a) => {
        const actor = data.users[a.actorId];
        const d = describeActivity(a);
        const linkable = a.taskId && data.tasks[a.taskId] && !data.tasks[a.taskId]!.archivedAt && !compact;
        return (
          <li key={a.id} className="flex gap-2.5">
            {actor && <Avatar user={actor} size="xs" className="mt-0.5 ring-0" />}
            <div className="min-w-0 text-[13px] leading-snug text-ink-muted">
              <span className="font-semibold text-ink">{actor?.name.split(' ')[0] ?? 'Someone'}</span> {d.verb}{' '}
              {d.subject &&
                (linkable ? (
                  <button
                    type="button"
                    onClick={() => dispatch(drawerOpened({ mode: 'edit', taskId: a.taskId! }))}
                    className="rounded font-medium text-ink hover:text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    {d.subject}
                  </button>
                ) : (
                  <span className="font-medium text-ink">{d.subject}</span>
                ))}{' '}
              {d.detail}
              <time dateTime={a.at} className="mt-0.5 block text-[11px] text-ink-subtle" title={new Date(a.at).toLocaleString()}>
                {formatDistanceToNowStrict(new Date(a.at), { addSuffix: true })}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function ActivityFeed({ listId }: { listId: ID }) {
  const items = useActivity({ listId });
  const dispatch = useAppDispatch();
  return (
    <aside
      aria-label="Activity"
      // below lg it overlays the board instead of squeezing it
      className="fixed bottom-0 right-0 top-14 z-30 flex w-full max-w-sm flex-col border-l border-surface-border bg-white shadow-drawer lg:static lg:z-auto lg:w-80 lg:max-w-none lg:shrink-0 lg:shadow-none"
    >
      <div className="flex h-12 items-center justify-between border-b border-surface-border px-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Icon name="activity" className="h-4 w-4 text-ink-subtle" /> Activity
        </h2>
        <IconButton label="Close activity" onClick={() => dispatch(activityToggled())}>
          <Icon name="x" className="h-4 w-4" />
        </IconButton>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {items.length === 0 ? (
          <EmptyState compact icon="activity" title="No activity yet" description="Changes to tasks in this list will show up here." />
        ) : (
          <ActivityItems items={items} />
        )}
      </div>
    </aside>
  );
}
