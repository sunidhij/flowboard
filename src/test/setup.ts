import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom lacks ResizeObserver, which Headless UI's anchored menus use
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// jsdom lacks matchMedia: report a desktop-width viewport (min-width queries match) so the
// sidebar renders as a permanent column, as it does at the E2E viewport
window.matchMedia ??= ((query: string) => ({
  matches: /min-width/.test(query),
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia;

afterEach(() => {
  cleanup();
  localStorage.clear();
  window.history.replaceState(null, '', '/'); // routes are URL-driven; isolate tests
});
