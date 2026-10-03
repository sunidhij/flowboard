import clsx from 'clsx';
import { useMemo } from 'react';
import { audienceOf, type AudienceKind } from '@/domain/permissions';
import type { ID } from '@/domain/types';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Tooltip } from '@/components/ui/Tooltip';
import { useSession } from '@/store/hooks';

const META: Record<AudienceKind, { icon: IconName; text: string; tone: string }> = {
  public: { icon: 'globe', text: 'Visible to everyone in the workspace', tone: 'text-ink-subtle' },
  restricted: { icon: 'users', text: 'Visible only to selected members', tone: 'text-amber-600' },
  'only-you': { icon: 'lock', text: 'Visible only to you', tone: 'text-violet-600' },
};

/** Effective audience of a container for the current user, plus its tooltip text. */
export function useAudience(containerId: ID) {
  const { data, userId } = useSession();
  return useMemo(() => {
    const audience = audienceOf(data, userId, containerId);
    return { audience, text: META[audience.kind].text };
  }, [data, userId, containerId]);
}

/**
 * Globe = public, people = restricted, lock = private (only you).
 * `anchor="container"` keeps the tooltip inside the row's bounds (sidebar).
 */
export function VisibilityBadge({
  containerId,
  align = 'end',
  anchor = 'trigger',
  className,
}: {
  containerId: ID;
  align?: 'start' | 'end';
  anchor?: 'trigger' | 'container';
  className?: string;
}) {
  const { audience, text } = useAudience(containerId);
  const meta = META[audience.kind];
  return (
    <Tooltip align={align} anchor={anchor} content={text}>
      <span className={clsx('inline-flex h-5 w-5 items-center justify-center', meta.tone, className)} aria-hidden>
        <Icon name={meta.icon} className="h-3.5 w-3.5" />
      </span>
    </Tooltip>
  );
}
