import type { Result } from '@/domain/errors';
import type { Activity, Data, ID } from '@/domain/types';

/** Everything a mutation needs besides the data: who is acting, a clock, an id factory. */
export interface MutationCtx {
  actorId: ID;
  now: () => string;
  id: (prefix: string) => ID;
}

/** Mutations are pure: (data, ctx, input) → new data + a return value, or an error. */
export type MutationResult<T> = Result<{ data: Data; value: T }>;

export const ACTIVITY_LIMIT = 200;

export function withActivity(
  data: Data,
  ctx: MutationCtx,
  entry: Omit<Activity, 'id' | 'actorId' | 'at'>,
): { data: Data; activityId: ID } {
  const activity: Activity = { ...entry, id: ctx.id('act'), actorId: ctx.actorId, at: ctx.now() };
  return {
    data: { ...data, activity: [activity, ...data.activity].slice(0, ACTIVITY_LIMIT) },
    activityId: activity.id,
  };
}
