import { useEffect, useState } from 'react';

/** Subscribe to a CSS media query (e.g. Tailwind's `lg` = `(min-width: 1024px)`). */
export function useMediaQuery(query: string): boolean {
  const get = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
  const [matches, setMatches] = useState(get);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** Tailwind `lg` breakpoint: the sidebar is a permanent column at/above it, an off-canvas panel below. */
export const DESKTOP_QUERY = '(min-width: 1024px)';
