import { createContext, useContext, type ReactNode } from 'react';
import { Provider, useDispatch, useSelector } from 'react-redux';
import type { Api } from './api';
import type { AppDispatch, AppStore, RootState } from './store';

/** Typed react-redux hooks. */
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();

const ApiContext = createContext<Api | null>(null);

/** Redux store + the fake async API (stands in for the network). */
export function AppProvider({ store, api, children }: { store: AppStore; api: Api; children: ReactNode }) {
  return (
    <Provider store={store}>
      <ApiContext.Provider value={api}>{children}</ApiContext.Provider>
    </Provider>
  );
}

export function useApi(): Api {
  const api = useContext(ApiContext);
  if (!api) throw new Error('useApi must be used inside <AppProvider>');
  return api;
}
