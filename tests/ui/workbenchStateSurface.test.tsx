// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WorkbenchStateSurface } from '../../src/ui/workbench/WorkbenchStateSurface';
import type { WorkbenchSurfaceState } from '../../src/ui/workbench/workbenchSurfaceState';

afterEach(cleanup);

const errorState: WorkbenchSurfaceState = {
  code: 'topic-list-not-found',
  description: 'Linux DO did not expose the expected topic list.',
  icon: 'error',
  kind: 'error',
  retryLabel: 'Retry',
  title: 'Unable to read topics',
};

describe('WorkbenchStateSurface', () => {
  it('offers only real recovery callbacks and preserves errors', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const onUseOriginal = vi.fn(() => Promise.reject(new Error('storage failed')));
    render(<WorkbenchStateSurface actions={{ onRetry, onUseOriginal }} state={errorState} />);

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();

    await user.click(screen.getByRole('button', { name: 'Use Original Linux DO' }));
    expect(onUseOriginal).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(screen.getByText(/recovery action failed/u)).toBeDefined();
    });
  });

  it('does not render placeholder content for a ready surface', () => {
    const { container } = render(
      <WorkbenchStateSurface
        actions={{ onRetry: vi.fn(), onUseOriginal: null }}
        state={{
          code: null,
          description: '',
          icon: null,
          kind: 'ready',
          retryLabel: null,
          title: '',
        }}
      />,
    );

    expect(container.childElementCount).toBe(0);
  });

  it('does not render a centered loading takeover', () => {
    const { container } = render(
      <WorkbenchStateSurface
        actions={{ onRetry: vi.fn(), onUseOriginal: null }}
        state={{
          code: 'topic-list-loading',
          description: 'Waiting for Linux DO to finish rendering this view.',
          icon: 'loading',
          kind: 'loading',
          retryLabel: null,
          title: 'Loading topics…',
        }}
      />,
    );

    expect(container.childElementCount).toBe(0);
    expect(screen.queryByText('Loading topics…')).toBeNull();
  });
});
