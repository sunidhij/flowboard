import { useMemo, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { canManageContainers } from '@/domain/permissions';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/Button';
import { useAppDispatch } from '@/store/context';
import { reorderContainer } from '@/store/thunks';
import { sidebarClosed } from '@/store/slices/uiSlice';
import { sidebarCollapsed } from '@/store/slices/workspaceSlice';
import { DESKTOP_QUERY, useMediaQuery } from '@/components/ui/useMediaQuery';
import { useCurrentUser, useNotify, useSession, useTree } from '@/store/hooks';
import { selectArchivedContainers } from '@/store/selectors';
import { activeChildren } from '@/store/mutations/containers';
import { InlineNameInput } from '@/components/ui/InlineNameInput';
import { SidebarHeader, SpacesLabel } from './SidebarHeader';
import { TreeChildren } from './TreeNode';
import { useContainerCommands } from '../containers/useContainerCommands';

/** Only allow dropping onto siblings (same parent) — the tree never re-parents via drag. */
const siblingsOnly: CollisionDetection = (args) => {
  const parentId = args.active.data.current?.parentId;
  return closestCenter({
    ...args,
    droppableContainers: args.droppableContainers.filter((c) => c.data.current?.parentId === parentId),
  });
};

export function Sidebar() {
  const tree = useTree();
  const { data, userId } = useSession();
  const user = useCurrentUser();
  const canManage = canManageContainers(data, userId);
  const dispatch = useAppDispatch();
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const notify = useNotify();
  const commands = useContainerCommands();
  const [addingSpace, setAddingSpace] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates, keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] } }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const parentId = active.data.current?.parentId as string | undefined;
    if (!parentId || parentId !== over.data.current?.parentId) return;
    const toIndex = activeChildren(data, parentId).findIndex((c) => c.id === over.id);
    // reorder is local-only and instant (no network simulation) — still validated by the store
    notify(dispatch(reorderContainer({ id: String(active.id), toIndex })));
  };

  return (
    <>
      <SidebarHeader desktop={isDesktop} onClose={() => dispatch(isDesktop ? sidebarCollapsed() : sidebarClosed())} />

      <div className="flex h-11 items-center justify-between px-4 pb-1 pt-4">
        <SpacesLabel />
        {canManage && tree && (
          <IconButton label="New space" className="h-6 w-6" onClick={() => setAddingSpace(true)}>
            <Icon name="plus" className="h-3.5 w-3.5" />
          </IconButton>
        )}
      </div>

      <nav aria-label="Workspace" className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        <div role="tree" aria-label="Spaces, folders and lists">
          <DndContext sensors={sensors} collisionDetection={siblingsOnly} onDragEnd={onDragEnd}>
            {tree && <TreeChildren nodes={tree.children} depth={0} canManage={canManage} />}
          </DndContext>
        </div>
        {addingSpace && tree && (
          <div className="px-2">
            <InlineNameInput
              placeholder="New space name"
              onSubmit={async (name) => {
                const err = await commands.create(tree.container.id, 'space', name);
                if (!err) setAddingSpace(false);
                return err;
              }}
              onCancel={() => setAddingSpace(false)}
            />
          </div>
        )}
        {tree && tree.children.length === 0 && !addingSpace && (
          <p className="px-3 py-4 text-center text-xs text-ink-subtle">
            {canManage ? 'No active spaces. Use + to create one.' : 'No spaces you can access.'}
          </p>
        )}
        {canManage && <ArchivedSection />}
      </nav>

      <div className="border-t border-surface-border px-4 py-3 text-[11px] leading-snug text-ink-muted">
        {user.role === 'admin' ? (
          <>
            <span className="font-semibold text-ink">Admin view.</span> You see every space, including private ones.
          </>
        ) : (
          <>
            <span className="font-semibold text-ink">Member view.</span> Only spaces and lists you’ve been granted are shown.
          </>
        )}
      </div>
    </>
  );
}

function ArchivedSection() {
  const { data, userId } = useSession();
  const archived = useMemo(() => selectArchivedContainers(data, userId), [data, userId]);
  const commands = useContainerCommands();
  const [open, setOpen] = useState(false);
  if (!archived.ok || archived.data.length === 0) return null;

  return (
    <div className="mt-4 border-t border-surface-border pt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle hover:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <Icon name={open ? 'chevronDown' : 'chevronRight'} className="h-3.5 w-3.5" />
        Archived ({archived.data.length})
      </button>
      {open && (
        <ul className="mt-1 space-y-px">
          {archived.data.map((c) => (
            <li key={c.id} className="group flex h-8 items-center gap-2 rounded-md pl-7 pr-1 text-[13px] text-ink-subtle hover:bg-surface-sunken">
              <Icon name="archive" className="h-3.5 w-3.5" />
              <span className="min-w-0 flex-1 truncate line-through decoration-slate-300">{c.name}</span>
              <IconButton label={`Restore ${c.name}`} className="h-6 w-6" onClick={() => commands.restore(c)}>
                <Icon name="restore" className="h-3.5 w-3.5" />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
