// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Popup } from '../../entrypoints/popup/popup';
import type { PopupClient } from '../../entrypoints/popup/popupClient';
import type { ContentRuntimeStatus } from '../../src/messaging/contracts';

afterEach(cleanup);

describe('Popup', () => {
  it('presents the retained controls inside a compact mini workbench', async () => {
    const { container } = render(<Popup client={createClient()} />);

    expect(await screen.findByRole('heading', { name: 'DOCODE' })).toBeTruthy();
    expect(screen.getByText('v1.0.0')).toBeTruthy();
    expect(screen.getByText('LINUX DO, in editor mode.')).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Activity bar' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'DOCODE, active' })).toBeTruthy();
    expect(container.querySelectorAll('.docode-popup__activity-item')).toHaveLength(4);
    expect(screen.queryByRole('img', { name: 'Linux DO' })).toBeNull();
    expect(screen.queryByText('Connected')).toBeNull();
    expect(screen.queryByText(/Open Community/)).toBeNull();
    expect(screen.queryByText(/Browse Linux DO/)).toBeNull();
    expect(screen.queryByText(/Command Palette/)).toBeNull();
    expect(screen.queryByText(/Run commands/)).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Enabled on LINUX DO' })).toHaveProperty(
      'checked',
      true,
    );
    expect(screen.getByRole('button', { name: /Use original LINUX DO/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Documentation/ })).toHaveProperty('disabled', true);
    const statusBar = screen.getByRole('contentinfo', { name: 'DOCode status' });
    expect(statusBar.textContent).toContain('docode connected');
    expect(statusBar.textContent).toContain('LINUX DO');
    expect(statusBar.querySelector('.codicon-settings-gear')).toBeNull();
    expect(container.textContent).not.toContain('Linux DO');
  });

  it('renders mutually exclusive native platform decorations', async () => {
    const { container, rerender } = render(<Popup client={createClient()} platform="mac" />);

    await screen.findByRole('heading', { name: 'DOCODE' });
    expect(container.querySelector('.docode-popup')?.getAttribute('data-platform')).toBe('mac');
    expect(container.querySelectorAll('.docode-popup__traffic-light')).toHaveLength(3);
    expect(container.querySelector('.docode-popup__window-controls')).toBeNull();

    rerender(<Popup client={createClient()} platform="windows" />);
    expect(container.querySelector('.docode-popup')?.getAttribute('data-platform')).toBe('windows');
    expect(container.querySelector('.docode-popup__traffic-lights')).toBeNull();
    expect(
      container.querySelectorAll('.docode-popup__window-controls > .docode-codicon'),
    ).toHaveLength(3);

    rerender(<Popup client={createClient()} platform="linux" />);
    expect(container.querySelector('.docode-popup')?.getAttribute('data-platform')).toBe('linux');
    expect(container.querySelector('.docode-popup__traffic-lights')).toBeNull();
    expect(container.querySelector('.docode-popup__window-controls')).toBeNull();
  });

  it('shows the supported enabled state and disables real ownership through the toggle', async () => {
    const setEnabled = vi.fn(() => Promise.resolve(status({ enabled: false, mounted: false })));
    const client = createClient({ setEnabled });
    const user = userEvent.setup();
    render(<Popup client={client} />);

    const toggle = await screen.findByRole('checkbox', { name: 'Enabled on LINUX DO' });
    expect(toggle).toHaveProperty('checked', true);
    expect(screen.queryByText('DOCode owns the current page runtime.')).toBeNull();
    expect(screen.getByText('Editor mode active')).toBeTruthy();

    await user.click(toggle);

    expect(setEnabled).toHaveBeenCalledWith(false);
    await waitFor(() => {
      expect(toggle).toHaveProperty('checked', false);
    });
    expect(screen.getByText('Original LINUX DO is active.').textContent).toBe(
      'Original LINUX DO is active.',
    );
  });

  it('offers explicit original-view recovery', async () => {
    const restoreOriginal = vi.fn(() =>
      Promise.resolve(status({ enabled: false, mounted: false })),
    );
    const client = createClient({ restoreOriginal });
    const user = userEvent.setup();
    render(<Popup client={client} />);

    await user.click(await screen.findByRole('button', { name: /Use original LINUX DO/ }));

    expect(restoreOriginal).toHaveBeenCalledOnce();
    expect((await screen.findByText('Original LINUX DO is active.')).textContent).toBe(
      'Original LINUX DO is active.',
    );
  });

  it('shows unsupported and recovered-storage states honestly', async () => {
    const unsupportedClient = createClient({
      getStatus: () => Promise.resolve({ kind: 'unsupported' }),
    });
    const { rerender } = render(<Popup client={unsupportedClient} />);

    expect((await screen.findByText('Open a LINUX DO tab to use DOCODE.')).textContent).toBe(
      'Open a LINUX DO tab to use DOCODE.',
    );

    rerender(
      <Popup
        client={createClient({
          getStatus: () =>
            Promise.resolve({
              kind: 'ready',
              status: status({ storageRecovered: true }),
            }),
        })}
      />,
    );

    expect(
      (await screen.findByText('An invalid saved setting was reset safely.')).textContent,
    ).toBe('An invalid saved setting was reset safely.');
  });

  it('surfaces transport failure and supports retry', async () => {
    const getStatus = vi
      .fn<PopupClient['getStatus']>()
      .mockRejectedValueOnce(new Error('content unavailable'))
      .mockResolvedValueOnce({ kind: 'ready', status: status() });
    const client = createClient({ getStatus });
    const user = userEvent.setup();
    render(<Popup client={client} />);

    expect((await screen.findByRole('alert')).textContent).toContain(
      'DOCODE could not reach the active tab.',
    );
    await user.click(screen.getByRole('button', { name: /Retry/u }));

    expect(await screen.findByRole('checkbox', { name: 'Enabled on LINUX DO' })).toHaveProperty(
      'checked',
      true,
    );
    expect(getStatus).toHaveBeenCalledTimes(2);
  });
});

function createClient(overrides: Partial<PopupClient> = {}): PopupClient {
  return {
    getStatus: () => Promise.resolve({ kind: 'ready', status: status() }),
    restoreOriginal: () => Promise.resolve(status({ enabled: false, mounted: false })),
    setEnabled: (enabled) => Promise.resolve(status({ enabled, mounted: enabled })),
    ...overrides,
  };
}

function status(overrides: Partial<ContentRuntimeStatus> = {}): ContentRuntimeStatus {
  return {
    capabilities: null,
    enabled: true,
    mounted: true,
    route: { family: 'latest', generation: 0 },
    storageRecovered: false,
    supported: true,
    topic: null,
    topicList: null,
    ...overrides,
  };
}
