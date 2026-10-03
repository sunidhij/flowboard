import { Skeleton } from '@/components/ui/Spinner';
import { SidebarHeader, SpacesLabel } from './SidebarHeader';

/** Same frame as the real sidebar (header, "Spaces" label, tree rows, footer) with placeholders. */
export function SidebarSkeleton() {
  return (
    <>
      <SidebarHeader />
      <div className="flex h-11 items-center px-4 pb-1 pt-4">
        <SpacesLabel />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden pb-4">
        <TreeSkeleton />
      </div>
      <div className="space-y-1.5 border-t border-surface-border px-4 py-3">
        <Skeleton className="h-2.5 w-40" />
        <Skeleton className="h-2.5 w-28" />
      </div>
    </>
  );
}

/** Placeholder rows shaped like the sidebar tree (row height, indentation, icon + label). */
const TREE_ROWS: { depth: 0 | 1 | 2; width: string; chevron: boolean }[] = [
  { depth: 0, width: 'w-24', chevron: true },
  { depth: 1, width: 'w-20', chevron: true },
  { depth: 2, width: 'w-16', chevron: false },
  { depth: 2, width: 'w-20', chevron: false },
  { depth: 0, width: 'w-20', chevron: true },
  { depth: 1, width: 'w-24', chevron: true },
  { depth: 2, width: 'w-14', chevron: false },
];
const ROW_INDENT = ['pl-2', 'pl-6', 'pl-10'];

function TreeSkeleton() {
  return (
    <div className="space-y-px px-2" aria-busy="true" aria-label="Loading workspace">
      {TREE_ROWS.map((row, i) => (
        <div key={i} className={`flex h-8 items-center gap-1.5 pr-1 ${ROW_INDENT[row.depth]}`}>
          {row.chevron ? <Skeleton className="h-3 w-4" /> : <span className="w-4" />}
          <Skeleton className="h-4 w-4" />
          <Skeleton className={`h-3 ${row.width}`} />
        </div>
      ))}
    </div>
  );
}
