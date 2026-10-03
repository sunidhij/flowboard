import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { createApi } from '@/store/api';
import { AppProvider } from '@/store/context';
import type { CreateAppStoreOptions } from '@/store/store';
import { freshStore } from './factory';

/** Render with a fresh store and a zero-latency fake API. */
export function renderWithStore(ui: ReactElement, options: CreateAppStoreOptions = {}) {
  const store = freshStore(options);
  const api = createApi(store, { latency: 0 });
  const utils = render(
    <AppProvider store={store} api={api}>
      {ui}
    </AppProvider>,
  );
  return { ...utils, store, api };
}
