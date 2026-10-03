import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import type { ContainerType } from '@/domain/types';
import { Icon } from '@/components/ui/Icon';
import { ROW_ACTION, stop, TYPE_ICON } from './treeShared';

/** Row "+" — a direct button when only one child type is allowed, a small menu otherwise (spaces). */
export function AddChildButton({
  containerName,
  types,
  onPick,
}: {
  containerName: string;
  types: ContainerType[];
  onPick: (type: ContainerType) => void;
}) {
  if (types.length === 1) {
    const [type] = types as [ContainerType];
    return (
      <button
        type="button"
        aria-label={`New ${type} in ${containerName}`}
        title={`New ${type}`}
        onClick={(e) => {
          e.stopPropagation();
          onPick(type);
        }}
        onPointerDown={stop}
        onKeyDown={stop}
        className={ROW_ACTION}
      >
        <Icon name="plus" className="h-3.5 w-3.5" />
      </button>
    );
  }
  return (
    <Menu>
      <MenuButton
        aria-label={`Add to ${containerName}`}
        title={`New ${types.join(' or ')}`}
        onClick={stop}
        onPointerDown={stop}
        onKeyDown={stop}
        className={ROW_ACTION}
      >
        <Icon name="plus" className="h-3.5 w-3.5" />
      </MenuButton>
      <MenuItems
        anchor="bottom start"
        className="z-40 w-40 rounded-lg border border-surface-border bg-white p-1 text-[13px] shadow-lift focus:outline-none"
        onClick={stop}
      >
        {types.map((type) => (
          <MenuItem key={type}>
            <button
              type="button"
              onClick={() => onPick(type)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-ink data-[focus]:bg-surface-muted"
            >
              <Icon name={TYPE_ICON[type]} className="h-4 w-4 text-ink-subtle" /> New {type}
            </button>
          </MenuItem>
        ))}
      </MenuItems>
    </Menu>
  );
}
