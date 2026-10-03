import { useEffect, useState } from 'react';
import { Toaster } from './components/ui/Toaster';
import { AppShell } from './features/layout/AppShell';
import { useApi } from './store/context';
import { useUrlSync } from './store/useUrlSync';
import { prefetchViews } from './lazy';

export function App() {
  const api = useApi();
  useUrlSync();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.loadWorkspace().then(() => {
      if (cancelled) return;
      setReady(true);
      prefetchViews(); // warm the code-split views while the user looks at the first screen
    });
    return () => {
      cancelled = true;
    };
  }, [api]);

  return (
    <>
      <AppShell ready={ready} />
      <Toaster />
    </>
  );
}
