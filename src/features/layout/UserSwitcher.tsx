import clsx from 'clsx';
import { Menu, MenuButton, MenuItem, MenuItems, MenuSeparator } from '@headlessui/react';
import { visibleListIds } from '@/domain/permissions';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import { useAppDispatch } from '@/store/context';
import { demoReset } from '@/store/slices/workspaceSlice';
import { pushToast, switchUser } from '@/store/thunks';
import { useCurrentUser, useSession, useUsers } from '@/store/hooks';

function RoleBadge({ role }: { role: 'admin' | 'member' }) {
  return (
    <span
      className={clsx(
        'rounded px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide',
        role === 'admin' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-600',
      )}
    >
      {role}
    </span>
  );
}

export function UserSwitcher() {
  const current = useCurrentUser();
  const users = useUsers();
  const { data } = useSession();
  const dispatch = useAppDispatch();

  return (
    <Menu as="div" className="relative">
      <MenuButton
        aria-label={`Current user: ${current.name}. Switch user`}
        className={clsx(
          'flex shrink-0 items-center gap-2 rounded-lg p-1 ring-1 md:pr-2 ring-inset ring-surface-border transition-colors',
          'hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 data-[open]:bg-surface-muted',
        )}
      >
        <Avatar user={current} size="md" className="ring-0" />
        <span className="hidden text-left leading-tight md:block">
          <span className="block text-[13px] font-semibold text-ink">{current.name.split(' ')[0]}</span>
          <span className="block text-[11px] text-ink-muted">Viewing as {current.role}</span>
        </span>
        <Icon name="chevronDown" className="hidden h-4 w-4 text-ink-subtle md:block" />
      </MenuButton>
      <MenuItems
        anchor="bottom end"
        className="z-40 mt-1 w-72 rounded-xl border border-surface-border bg-white p-1.5 shadow-lift focus:outline-none"
      >
        <p className="px-2.5 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Switch user</p>
        {users.map((u) => {
          const lists = visibleListIds(data, u.id).length;
          return (
            <MenuItem key={u.id}>
              <button
                type="button"
                onClick={() => {
                  const r = dispatch(switchUser(u.id));
                  if (!r.ok || u.id === current.id) return;
                  const { redirectedFrom, openedListId } = r.data;
                  const from = redirectedFrom ? data.containers[redirectedFrom]?.name : null;
                  const to = openedListId ? data.containers[openedListId]?.name : null;
                  dispatch(pushToast({
                    kind: 'info',
                    message: from
                      ? `Now viewing as ${u.name}. “${from}” isn’t shared with them${to ? `, so “${to}” was opened` : ''}.`
                      : `Now viewing as ${u.name}`,
                  }));
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left data-[focus]:bg-surface-muted"
              >
                <Avatar user={u} size="md" className="ring-0" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                    {u.name} <RoleBadge role={u.role} />
                  </span>
                  <span className="block text-xs text-ink-muted">
                    {u.role === 'admin' ? 'Sees and edits everything' : `Can see ${lists} list${lists === 1 ? '' : 's'}`}
                  </span>
                </span>
                {u.id === current.id && <Icon name="check" className="h-4 w-4 text-brand-600" />}
              </button>
            </MenuItem>
          );
        })}
        <MenuSeparator className="my-1 h-px bg-surface-border" />
        <MenuItem>
          <button
            type="button"
            onClick={() => {
              dispatch(demoReset());
              dispatch(pushToast({ kind: 'info', message: 'Demo data reset to the original seed.' }));
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-ink-muted data-[focus]:bg-surface-muted data-[focus]:text-ink"
          >
            <Icon name="reset" className="h-4 w-4" />
            Reset demo data
          </button>
        </MenuItem>
      </MenuItems>
    </Menu>
  );
}
