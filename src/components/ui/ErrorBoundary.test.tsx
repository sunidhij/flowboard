import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { AppCrash, ErrorBoundary, SectionCrash } from './ErrorBoundary';

let shouldThrow = true;
function Bomb() {
  if (shouldThrow) throw new Error('boom');
  return <p>All good</p>;
}

// React (dev) re-reports errors caught by a boundary on window; keep test output clean
const swallow = (e: ErrorEvent) => e.preventDefault();
beforeEach(() => window.addEventListener('error', swallow));
afterEach(() => window.removeEventListener('error', swallow));

describe('ErrorBoundary', () => {
  it('shows the fallback instead of a blank page, and "Try again" re-renders the children', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {}); // React + our componentDidCatch log the error
    const user = userEvent.setup();
    shouldThrow = true;
    render(
      <ErrorBoundary fallback={({ reset }) => <SectionCrash reset={reset} />}>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');

    shouldThrow = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('All good')).toBeInTheDocument();
  });

  it('clears the error when a reset key changes (e.g. navigating to another list)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();
    shouldThrow = true;
    function Harness() {
      const [listId, setListId] = useState('a');
      return (
        <>
          <button onClick={() => setListId('b')}>Go to b</button>
          <ErrorBoundary resetKeys={[listId]} fallback={({ reset }) => <SectionCrash reset={reset} />}>
            <Bomb />
          </ErrorBoundary>
        </>
      );
    }
    render(<Harness />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    shouldThrow = false;
    await user.click(screen.getByRole('button', { name: 'Go to b' }));
    expect(screen.getByText('All good')).toBeInTheDocument();
  });

  it('the app-level fallback offers Reload and Reset demo data', async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    render(<AppCrash onReset={onReset} />);
    expect(screen.getByRole('heading', { name: 'Flowboard ran into a problem' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reset demo data' }));
    expect(onReset).toHaveBeenCalled();
  });
});
