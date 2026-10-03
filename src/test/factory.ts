import { buildSeed, USER_IDS } from '@/data/seed';
import { createAppStore, type CreateAppStoreOptions } from '@/store/store';
import type { MutationCtx } from '@/store/mutations/context';
import type { ID } from '@/domain/types';

export const FIXED_NOW = new Date('2026-06-01T10:00:00.000Z');

/** Deterministic clock + ids so tests are isolated and reproducible. */
export function testCtx(actorId: ID = USER_IDS.alice): MutationCtx {
  let tick = 0;
  let seq = 0;
  return {
    actorId,
    now: () => new Date(FIXED_NOW.getTime() + ++tick * 1000).toISOString(),
    id: (prefix) => `${prefix}_test${++seq}`,
  };
}

export const freshSeed = () => buildSeed(FIXED_NOW);

/** A brand-new, non-persisted store per test. */
export function freshStore(options: CreateAppStoreOptions = {}) {
  const ctx = testCtx();
  return createAppStore({ data: freshSeed(), persist: false, now: ctx.now, id: ctx.id, ...options });
}
