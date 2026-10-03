import { Skeleton } from '@/components/ui/Spinner';

/**
 * The single loading state for each view — used on first load, while a list loads, and as the
 * lazy-chunk fallback, so there's never a second, different skeleton. Both fill the content area
 * and mirror the real layout (column / table geometry) to avoid a jump when data arrives.
 */

const COLUMN_CARDS = [5, 3, 4, 2, 3];
const TITLE_WIDTHS = ['w-11/12', 'w-3/4', 'w-5/6', 'w-2/3'];

export function BoardSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 gap-3 overflow-hidden p-5" aria-busy="true" aria-label="Loading kanban">
      {COLUMN_CARDS.map((cards, c) => (
        <div key={c} className="flex h-full w-72 shrink-0 flex-col rounded-xl bg-surface-sunken/70">
          <div className="flex items-center gap-2 px-3 pb-2 pt-3">
            <Skeleton className="h-2 w-2 rounded-full bg-surface-border" />
            <Skeleton className="h-3.5 w-20 bg-surface-border" />
            <Skeleton className="h-4 w-5 rounded-pill bg-surface-border" />
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden px-2 pb-3">
            {Array.from({ length: cards }, (_, i) => (
              <div key={i} className="shrink-0 space-y-2 rounded-card border border-surface-border bg-white p-3 shadow-card">
                <Skeleton className={`h-3.5 ${TITLE_WIDTHS[(c + i) % TITLE_WIDTHS.length]}`} />
                <div className="flex items-center gap-2 pt-1">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="ml-auto h-5 w-5 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-5" aria-busy="true" aria-label="Loading list">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-surface-border bg-white shadow-card">
        <div className="flex h-9 shrink-0 items-center gap-4 border-b border-surface-border bg-surface-muted px-4">
          <Skeleton className="h-4 w-4 bg-surface-border" />
          <Skeleton className="h-3 w-12 bg-surface-border" />
          <Skeleton className="ml-auto h-3 w-14 bg-surface-border" />
          <Skeleton className="h-3 w-16 bg-surface-border" />
          <Skeleton className="h-3 w-14 bg-surface-border" />
          <Skeleton className="h-3 w-14 bg-surface-border" />
        </div>
        <div className="min-h-0 flex-1 divide-y divide-surface-border overflow-hidden">
          {Array.from({ length: 16 }, (_, i) => (
            <div key={i} className="flex h-11 items-center gap-4 px-4">
              <Skeleton className="h-4 w-4" />
              <Skeleton className={`h-3.5 ${['w-64', 'w-48', 'w-56', 'w-40'][i % 4]}`} />
              <Skeleton className="ml-auto h-5 w-20 rounded-pill" />
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-4 w-14" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
