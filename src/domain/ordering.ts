/** Pure helpers for sibling ordering. Positions are always re-indexed to 0..n-1. */

export function byPosition<T extends { position: number; id: string }>(a: T, b: T): number {
  return a.position - b.position || a.id.localeCompare(b.id);
}

/** Return `ids` with `id` removed and re-inserted at `toIndex` (clamped). */
export function moveId(ids: readonly string[], id: string, toIndex: number): string[] {
  const without = ids.filter((x) => x !== id);
  const index = Math.max(0, Math.min(toIndex, without.length));
  without.splice(index, 0, id);
  return without;
}

/** Map an ordered id list to `{ id: position }`. */
export function positionsOf(ids: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {};
  ids.forEach((id, i) => {
    out[id] = i;
  });
  return out;
}
