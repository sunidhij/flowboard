import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';

interface Props {
  children: ReactNode;
  /** render the fallback; `reset` re-mounts the children */
  fallback: (props: { error: Error; reset: () => void }) => ReactNode;
  /** when any of these change, a caught error is cleared (e.g. navigating to another list) */
  resetKeys?: unknown[];
}

interface State {
  error: Error | null;
}

/**
 * Catches render errors below it so one broken view doesn't blank the whole app.
 * (React still requires a class component for this.)
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // a real app would report this to an error tracker
    console.error('Flowboard crashed while rendering:', error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && !sameKeys(prev.resetKeys, this.props.resetKeys)) this.reset();
  }

  reset = () => this.setState({ error: null });

  render() {
    return this.state.error ? this.props.fallback({ error: this.state.error, reset: this.reset }) : this.props.children;
  }
}

const sameKeys = (a: unknown[] = [], b: unknown[] = []) => a.length === b.length && a.every((v, i) => Object.is(v, b[i]));

/** Fallback for a section of the page (the rest of the app keeps working). */
export function SectionCrash({ reset, title = 'Something went wrong' }: { reset: () => void; title?: string }) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div role="alert" className="flex max-w-sm flex-col items-center text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600">
          <Icon name="alert" className="h-6 w-6" />
        </span>
        <h2 className="mt-3 text-sm font-semibold text-ink">{title}</h2>
        <p className="mt-1 text-sm text-ink-muted">This part of the page couldn’t be displayed. Your data is safe.</p>
        <Button className="mt-4" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  );
}

/** Last-resort full-page fallback (used outside the store provider, so it doesn't depend on app state). */
export function AppCrash({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-muted p-6">
      <div role="alert" className="flex max-w-md flex-col items-center rounded-xl border border-surface-border bg-white p-8 text-center shadow-card">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600">
          <Icon name="alert" className="h-6 w-6" />
        </span>
        <h1 className="mt-3 text-base font-semibold text-ink">Flowboard ran into a problem</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Reload to try again. If it keeps happening, the saved demo data may be corrupted. Resetting it restores the original
          demo data.
        </p>
        <div className="mt-5 flex gap-2">
          <Button onClick={onReset}>Reset demo data</Button>
          <Button variant="primary" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      </div>
    </div>
  );
}
