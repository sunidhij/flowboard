import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Feedback';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useSession, useTree } from '@/store/hooks';
import { selectEmptyWorkspaceReason, type EmptyWorkspaceReason } from '@/store/selectors';
import { InlineNameInput } from '@/components/ui/InlineNameInput';
import { useContainerCommands } from '../containers/useContainerCommands';

const COPY: Record<EmptyWorkspaceReason, { icon: IconName; title: string; description: string }> = {
  'no-spaces': {
    icon: 'space',
    title: 'No spaces yet',
    description: 'Create a space, then add a list to it to start tracking tasks.',
  },
  'all-archived': {
    icon: 'archive',
    title: 'All spaces are archived',
    description: 'Create a new space to get started, or restore one from “Archived” at the bottom of the sidebar.',
  },
  'no-lists': {
    icon: 'list',
    title: 'No lists yet',
    description: 'Use the + next to a space or folder in the sidebar to create a list.',
  },
  'no-access': {
    icon: 'lock',
    title: 'Nothing shared with you yet',
    description: "You don't have access to any lists — they may be private or archived. Ask an admin for access.",
  },
};

/** Centered empty state shown when there is no list to open. */
export function EmptyWorkspace() {
  const { data, userId } = useSession();
  const tree = useTree();
  const reason = useMemo(() => selectEmptyWorkspaceReason(data, userId), [data, userId]);
  const commands = useContainerCommands();
  const [creating, setCreating] = useState(false);

  if (!reason) return null;
  const copy = COPY[reason];
  const canCreateSpace = (reason === 'no-spaces' || reason === 'all-archived') && tree;

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-md">
        <EmptyState
          icon={copy.icon}
          title={copy.title}
          description={copy.description}
          action={
            canCreateSpace &&
            (creating ? (
              <div className="w-64 text-left">
                <InlineNameInput
                  placeholder="New space name"
                  onSubmit={async (name) => {
                    const err = await commands.create(tree.container.id, 'space', name);
                    if (!err) setCreating(false);
                    return err;
                  }}
                  onCancel={() => setCreating(false)}
                />
              </div>
            ) : (
              <Button variant="primary" onClick={() => setCreating(true)}>
                <Icon name="plus" className="h-4 w-4" /> Create a space
              </Button>
            ))
          }
        />
      </div>
    </div>
  );
}
