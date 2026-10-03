import clsx from 'clsx';
import { useState } from 'react';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { TreeNode as Node } from '@/domain/permissions';
import { CHILD_TYPES } from '@/domain/validators';
import type { ContainerType } from '@/domain/types';
import { Icon } from '@/components/ui/Icon';
import { useAppDispatch, useAppSelector } from '@/store/context';
import { listSelected } from '@/store/slices/workspaceSlice';
import { InlineNameInput } from '@/components/ui/InlineNameInput';
import { capitalize, useContainerCommands } from '../containers/useContainerCommands';
import { AddChildButton } from './AddChildButton';
import { ContainerMenu } from './ContainerMenu';
import { TYPE_ICON } from './treeShared';
import { useAudience, VisibilityBadge } from './VisibilityBadge';

/** indentation per depth (space=0) — static classes so Tailwind can see them */
const INDENT = ['pl-2', 'pl-6', 'pl-10', 'pl-14'];
const CHILD_INDENT = ['pl-7', 'pl-11', 'pl-[3.75rem]', 'pl-16'];

export function TreeChildren({ nodes, depth, canManage }: { nodes: Node[]; depth: number; canManage: boolean }) {
  return (
    <SortableContext items={nodes.map((n) => n.container.id)} strategy={verticalListSortingStrategy}>
      <ul role="group" className="space-y-px">
        {nodes.map((n) => (
          <TreeNode key={n.container.id} node={n} depth={depth} canManage={canManage} />
        ))}
      </ul>
    </SortableContext>
  );
}

export function TreeNode({ node, depth, canManage }: { node: Node; depth: number; canManage: boolean }) {
  const { container, children } = node;
  const selectedListId = useAppSelector((s) => s.workspace.selectedListId);
  const dispatch = useAppDispatch();
  const commands = useContainerCommands();
  const [expanded, setExpanded] = useState(true);
  const [mode, setMode] = useState<'idle' | 'rename'>('idle');
  /** which child type the inline "new …" field is creating */
  const [adding, setAdding] = useState<ContainerType | null>(null);

  const isList = container.type === 'list';
  const isSelected = isList && selectedListId === container.id;
  const childTypes = CHILD_TYPES[container.type];
  const audience = useAudience(container.id);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: container.id,
    data: { parentId: container.parentId },
    disabled: !canManage || mode !== 'idle' || adding !== null,
  });

  const startAdding = (type: ContainerType) => {
    setExpanded(true);
    setAdding(type);
  };

  const activate = () => {
    if (isList) dispatch(listSelected(container.id));
    else setExpanded((e) => !e);
  };

  return (
    <li
      ref={setNodeRef}
      // dnd-kit requires inline transform/transition for drag movement (documented exception)
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={clsx('relative', isDragging && 'z-10 opacity-60')}
      role="treeitem"
      aria-expanded={isList ? undefined : expanded}
      aria-selected={isSelected}
    >
      {mode === 'rename' ? (
        <div className={clsx('pr-2', INDENT[depth])}>
          <InlineNameInput
            initial={container.name}
            placeholder={`Rename ${container.type}`}
            onSubmit={async (name) => {
              const err = await commands.rename(container.id, name);
              if (!err) setMode('idle');
              return err;
            }}
            onCancel={() => setMode('idle')}
          />
        </div>
      ) : (
        <div
          {...attributes}
          {...listeners}
          role="button"
          tabIndex={0}
          aria-label={`${capitalize(container.type)} ${container.name}`}
          aria-description={audience.text}
          aria-roledescription={canManage ? 'sortable tree item' : undefined}
          onClick={activate}
          onKeyDown={(e) => {
            listeners?.onKeyDown?.(e); // keep dnd-kit's keyboard sensor (Space to pick up)
            if (e.key === 'Enter') activate();
            if (e.key === 'F2' && canManage) setMode('rename');
          }}
          className={clsx(
            'group relative flex h-8 cursor-pointer select-none items-center gap-1.5 rounded-md pr-1 text-[13px] transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500',
            INDENT[depth],
            isSelected
              ? 'bg-brand-50 font-semibold text-brand-700'
              : 'text-ink-muted hover:bg-surface-sunken hover:text-ink active:bg-surface-border',
          )}
        >
          {isList ? (
            <span className="w-4" />
          ) : (
            <span
              className="flex h-4 w-4 items-center justify-center rounded text-ink-subtle hover:bg-surface-border"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((v) => !v);
              }}
              aria-hidden
            >
              <Icon name={expanded ? 'chevronDown' : 'chevronRight'} className="h-3.5 w-3.5" />
            </span>
          )}
          <Icon
            name={TYPE_ICON[container.type]}
            className={clsx('h-4 w-4', isSelected ? 'text-brand-600' : container.type === 'space' ? 'text-violet-500' : 'text-ink-subtle')}
          />
          <span className={clsx('min-w-0 flex-1 truncate', container.type === 'space' && !isSelected && 'font-medium text-ink')}>
            {container.name}
          </span>
          {/* anchored to the row (relative) so the tooltip never overflows the sidebar */}
          <VisibilityBadge containerId={container.id} anchor="container" />
          {canManage && childTypes.length > 0 && (
            <AddChildButton containerName={container.name} types={childTypes} onPick={startAdding} />
          )}
          {canManage && <ContainerMenu container={container} onAdd={startAdding} onRename={() => setMode('rename')} />}
        </div>
      )}

      {!isList && expanded && (
        <>
          {children.length > 0 && <TreeChildren nodes={children} depth={depth + 1} canManage={canManage} />}
          {adding && (
            <div className={clsx('pr-2', CHILD_INDENT[depth])}>
              <InlineNameInput
                placeholder={`New ${adding} name`}
                onSubmit={async (name) => {
                  const err = await commands.create(container.id, adding, name);
                  if (!err) setAdding(null);
                  return err;
                }}
                onCancel={() => setAdding(null)}
              />
            </div>
          )}
          {children.length === 0 && !adding && childTypes.length > 0 && (
            <div className={clsx('flex items-center gap-3 py-1', CHILD_INDENT[depth])}>
              {canManage ? (
                childTypes.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => startAdding(type)}
                    className="flex items-center gap-1 rounded text-[12px] font-medium text-brand-600 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    <Icon name="plus" className="h-3.5 w-3.5" /> Add {type}
                  </button>
                ))
              ) : (
                <p className="text-[12px] italic text-ink-subtle">Empty</p>
              )}
            </div>
          )}
        </>
      )}

    </li>
  );
}
