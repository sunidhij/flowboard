import { useState } from 'react';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { CHILD_TYPES } from '@/domain/validators';
import type { Container, ContainerType } from '@/domain/types';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Icon } from '@/components/ui/Icon';
import { useContainerCommands } from '../containers/useContainerCommands';
import { ROW_ACTION, stop, TYPE_ICON } from './treeShared';

/** Admin "⋯" menu on a tree row: New <child>, Rename, Archive (with confirmation + undo toast). */
export function ContainerMenu({
  container,
  onAdd,
  onRename,
}: {
  container: Container;
  onAdd: (type: ContainerType) => void;
  onRename: () => void;
}) {
  const commands = useContainerCommands();
  const [confirmArchive, setConfirmArchive] = useState(false);
  const childTypes = CHILD_TYPES[container.type];
  const itemClass = 'flex w-full items-center gap-2 rounded-md px-2 py-1.5 data-[focus]:bg-surface-muted';

  return (
    // event boundary: the menu and dialog are portalled, but their events still bubble through
    // the React tree to the row (open list / start drag) — stop them here
    <span className="contents" onClick={stop} onPointerDown={stop} onKeyDown={stop}>
      <Menu>
        <MenuButton aria-label={`Actions for ${container.name}`} className={ROW_ACTION}>
          <Icon name="dots" className="h-4 w-4" />
        </MenuButton>
        <MenuItems
          anchor="bottom start"
          className="z-40 w-44 rounded-lg border border-surface-border bg-white p-1 text-[13px] shadow-lift focus:outline-none"
        >
          {childTypes.map((type) => (
            <MenuItem key={type}>
              <button type="button" onClick={() => onAdd(type)} className={`${itemClass} text-ink`}>
                <Icon name={TYPE_ICON[type]} className="h-4 w-4 text-ink-subtle" /> New {type}
              </button>
            </MenuItem>
          ))}
          <MenuItem>
            <button type="button" onClick={onRename} className={`${itemClass} text-ink`}>
              <Icon name="pencil" className="h-4 w-4 text-ink-subtle" /> Rename
            </button>
          </MenuItem>
          <MenuItem>
            <button type="button" onClick={() => setConfirmArchive(true)} className={`${itemClass} text-red-600 data-[focus]:bg-red-50`}>
              <Icon name="archive" className="h-4 w-4" /> Archive
            </button>
          </MenuItem>
        </MenuItems>
      </Menu>

      <ConfirmDialog
        open={confirmArchive}
        title={`Archive “${container.name}”?`}
        description={
          container.type === 'list'
            ? 'The list and its tasks will be hidden for everyone. You can undo or restore it later.'
            : `This ${container.type} and everything inside it will be hidden for everyone. You can undo or restore it later.`
        }
        confirmLabel="Archive"
        onConfirm={() => commands.archive(container)}
        onClose={() => setConfirmArchive(false)}
      />
    </span>
  );
}
