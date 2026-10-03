import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { createApi } from './store/api';
import { createAppStore, STORAGE_KEY } from './store/store';
import { AppProvider } from './store/context';
import { AppCrash, ErrorBoundary } from './components/ui/ErrorBoundary';
import './index.css';

const store = createAppStore({ persist: true });
const api = createApi(store, { latency: 350 });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* last resort: works even if the store itself is what broke (e.g. corrupted saved data) */}
    <ErrorBoundary
      fallback={() => (
        <AppCrash
          onReset={() => {
            localStorage.removeItem(STORAGE_KEY);
            window.location.reload();
          }}
        />
      )}
    >
      <AppProvider store={store} api={api}>
        <App />
      </AppProvider>
    </ErrorBoundary>
  </StrictMode>,
);
