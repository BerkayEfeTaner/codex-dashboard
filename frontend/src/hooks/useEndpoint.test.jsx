import { StrictMode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useEndpoint } from './useEndpoint.js';

function Harness({ fetcher, options }) {
  const { data, loading, refreshing, error } = useEndpoint(fetcher, null, options);

  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="refreshing">{String(refreshing)}</span>
      <span data-testid="error">{error || 'none'}</span>
      <span data-testid="value">{data?.message || 'empty'}</span>
    </div>
  );
}

describe('useEndpoint', () => {
  it('settles the initial loading state under StrictMode', async () => {
    const fetcher = vi.fn().mockResolvedValue({ message: 'ready' });

    render(
      <StrictMode>
        <Harness fetcher={fetcher} />
      </StrictMode>
    );

    await waitFor(() => expect(screen.getByTestId('value')).toHaveTextContent('ready'));
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
    expect(screen.getByTestId('refreshing')).toHaveTextContent('false');
    expect(screen.getByTestId('error')).toHaveTextContent('none');
  });

  it('refreshes again when the window regains focus', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ message: 'ready' })
      .mockResolvedValueOnce({ message: 'fresh' });

    render(<Harness fetcher={fetcher} options={{ pollIntervalMs: 30000 }} />);

    await waitFor(() => expect(screen.getByTestId('value')).toHaveTextContent('ready'));

    fireEvent.focus(window);

    await waitFor(() => expect(screen.getByTestId('value')).toHaveTextContent('fresh'));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
