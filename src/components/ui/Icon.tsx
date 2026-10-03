import clsx from 'clsx';

/** Small inline icon set (stroke icons, 24px grid) — avoids an icon-library dependency. */
const PATHS = {
  chevronRight: 'M9 6l6 6-6 6',
  chevronDown: 'M6 9l6 6 6-6',
  plus: 'M12 5v14M5 12h14',
  dots: 'M5 12h.01M12 12h.01M19 12h.01',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3.6 9h16.8M3.6 15h16.8M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18',
  space: 'M4 5h16v14H4zM4 9h16',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  menu: 'M4 6h16M4 12h16M4 18h16',
  collapseLeft: 'M11 17l-5-5 5-5M18 17l-5-5 5-5',
  board: 'M4 4h5v16H4zM10 4h5v10h-5zM16 4h4v7h-4z',
  table: 'M4 5h16v14H4zM4 10h16M4 15h16M10 5v14',
  x: 'M6 6l12 12M18 6L6 18',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  archive: 'M4 5h16v4H4zM5 9v10h14V9M10 13h4',
  restore: 'M4 12a8 8 0 1 0 3-6.2M4 4v4h4',
  pencil: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  calendar: 'M5 6h14v14H5zM5 10h14M9 3v4M15 3v4',
  activity: 'M3 12h4l3-8 4 16 3-8h4',
  alert: 'M12 9v4M12 17h.01M10.3 3.9L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  check: 'M5 12l5 5L20 7',
  info: 'M12 16v-4M12 8h.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  grip: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
  arrowUp: 'M12 19V5M5 12l7-7 7 7',
  arrowDown: 'M12 5v14M19 12l-7 7-7-7',
  sort: 'M8 9l4-4 4 4M16 15l-4 4-4-4',
  users: 'M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 20v-2a4 4 0 0 0-3-3.9M16 2.1a4 4 0 0 1 0 7.8',
  bolt: 'M13 2L3 14h9l-1 8 10-12h-9z',
  subtask: 'M6 4v10a2 2 0 0 0 2 2h10M14 12l4 4-4 4',
  reset: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={name === 'dots' || name === 'grip' ? 3 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={clsx('shrink-0', className ?? 'h-4 w-4')}
      aria-hidden
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
