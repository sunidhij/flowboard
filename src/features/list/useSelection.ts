import { useCallback, useMemo, useState } from 'react';
import type { ID } from '@/domain/types';

/**
 * Multi-select over a list of items. `selected` only contains items that are still present,
 * so selections of tasks that were deleted / moved / hidden drop out automatically.
 */
export function useSelection<T extends { id: ID }>(items: T[]) {
  const [picked, setPicked] = useState<Set<ID>>(() => new Set());
  const selected = useMemo(() => items.filter((i) => picked.has(i.id)), [items, picked]);

  const isSelected = useCallback((id: ID) => picked.has(id), [picked]);

  const toggle = useCallback(
    (id: ID) =>
      setPicked((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    [],
  );

  /** Select every item in `subset` (e.g. the visible page), or deselect them all if they're already selected. */
  const toggleAll = useCallback(
    (subset: T[]) =>
      setPicked((prev) => {
        const all = subset.every((i) => prev.has(i.id));
        const next = new Set(prev);
        for (const i of subset) {
          if (all) next.delete(i.id);
          else next.add(i.id);
        }
        return next;
      }),
    [],
  );

  const clear = useCallback(() => setPicked(new Set()), []);

  /** For a header checkbox: are all / some of `subset` selected? */
  const stateOf = (subset: T[]) => {
    const count = subset.filter((i) => picked.has(i.id)).length;
    return { all: subset.length > 0 && count === subset.length, some: count > 0 && count < subset.length };
  };

  return { selected, isSelected, toggle, toggleAll, clear, stateOf };
}
