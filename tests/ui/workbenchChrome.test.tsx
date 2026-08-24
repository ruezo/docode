// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { recognizeLinuxDoRoute } from '../../src/linuxdo/routes';
import type { WindowFullscreenClient } from '../../src/platform/browserWindowFullscreen';
import { detectWorkbenchOperatingSystem } from '../../src/platform/workbenchPlatform';
import { WorkbenchActivityBar } from '../../src/ui/workbench/WorkbenchActivityBar';
import { WorkbenchTitleBar } from '../../src/ui/workbench/WorkbenchTitleBar';
import { createWorkbenchViewContext } from '../../src/ui/workbench/workbenchContext';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Reflect.deleteProperty(HTMLElement.prototype, 'requestFullscreen');
  Reflect.deleteProperty(document, 'exitFullscreen');
  Reflect.deleteProperty(document, 'fullscreenElement');
  Reflect.deleteProperty(document, 'fullscreenEnabled');
});

describe('platform workbench chrome', () => {
  it('detects macOS, Windows, and Linux without relying on extension permissions', () => {
    expect(detectWorkbenchOperatingSystem(navigatorFor('MacIntel', 'Mozilla/5.0'))).toBe('mac');
    expect(detectWorkbenchOperatingSystem(navigatorFor('Win32', 'Mozilla/5.0'))).toBe('windows');
    expect(
      detectWorkbenchOperatingSystem(navigatorFor('Linux x86_64', 'Mozilla/5.0', 'Windows')),
    ).toBe('windows');
    expect(detectWorkbenchOperatingSystem(navigatorFor('Linux x86_64', 'Mozilla/5.0'))).toBe(
      'linux',
    );
  });

  it('renders macOS traffic lights and keeps browser history controls real', () => {
    const { container } = renderTitleBar('mac');

    expect(container.querySelectorAll('.docode-workbench__traffic-light')).toHaveLength(3);
    expect(container.querySelectorAll('.docode-workbench__window-control')).toHaveLength(0);
    expect(
      Array.from(container.querySelectorAll('.docode-workbench__traffic-light-glyph'), (glyph) =>
        glyph.getAttribute('data-glyph'),
      ),
    ).toEqual(['close', 'minimize', 'zoom']);
    expect(
      container.querySelector('.docode-workbench__titlebar')?.getAttribute('data-platform'),
    ).toBe('mac');
    expect(screen.getByRole('button', { name: 'Go Back' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Go Forward' })).toBeDefined();
  });

  it('toggles real workbench full screen from the macOS green traffic light', async () => {
    let fullscreenElement: Element | null = null;
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    const exitFullscreen = vi.fn().mockResolvedValue(undefined);
    installFullscreenApi(requestFullscreen, exitFullscreen, () => fullscreenElement);
    const { container } = renderTitleBar('mac');
    const root = container.querySelector<HTMLElement>('[data-docode-workbench-root]');
    if (!root) throw new Error('Missing workbench root fixture.');

    const enter = await screen.findByRole('button', { name: 'Enter Full Screen' });
    expect(enter.getAttribute('aria-pressed')).toBe('false');
    expect(enter.getAttribute('data-fullscreen-active')).toBe('false');
    fireEvent.click(enter);
    expect(requestFullscreen).toHaveBeenCalledOnce();
    expect(requestFullscreen.mock.instances[0]).toBe(document.documentElement);
    expect(enter.getAttribute('aria-pressed')).toBe('false');

    fullscreenElement = document.documentElement;
    act(() => {
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    const exit = await screen.findByRole('button', { name: 'Exit Full Screen' });
    expect(exit.getAttribute('aria-pressed')).toBe('true');
    expect(exit.getAttribute('data-fullscreen-active')).toBe('true');
    fireEvent.click(exit);
    expect(exitFullscreen).toHaveBeenCalledOnce();

    fullscreenElement = null;
    act(() => {
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    expect(
      (await screen.findByRole('button', { name: 'Enter Full Screen' })).getAttribute(
        'aria-pressed',
      ),
    ).toBe('false');
  });

  it('keeps rejected full-screen requests honest and reports the failure', async () => {
    const requestFullscreen = vi.fn().mockRejectedValue(new Error('denied'));
    installFullscreenApi(requestFullscreen, vi.fn().mockResolvedValue(undefined), () => null);
    renderTitleBar('mac');

    const enter = await screen.findByRole('button', { name: 'Enter Full Screen' });
    fireEvent.click(enter);

    expect((await screen.findByRole('status')).textContent).toBe('Unable to enter full screen.');
    expect(enter.getAttribute('aria-pressed')).toBe('false');
  });

  it('retains the active state when exiting full screen is rejected', async () => {
    let fullscreenElement: Element | null = null;
    const exitFullscreen = vi.fn().mockRejectedValue(new Error('denied'));
    installFullscreenApi(
      vi.fn().mockResolvedValue(undefined),
      exitFullscreen,
      () => fullscreenElement,
    );
    const { container } = renderTitleBar('mac');
    const root = container.querySelector<HTMLElement>('[data-docode-workbench-root]');
    if (!root) throw new Error('Missing workbench root fixture.');
    fullscreenElement = document.documentElement;
    act(() => {
      document.dispatchEvent(new Event('fullscreenchange'));
    });

    const exit = await screen.findByRole('button', { name: 'Exit Full Screen' });
    fireEvent.click(exit);

    expect((await screen.findByRole('status')).textContent).toBe('Unable to exit full screen.');
    expect(exitFullscreen).toHaveBeenCalledOnce();
    expect(exit.getAttribute('aria-pressed')).toBe('true');
  });

  it('disables unsupported full screen and removes its change listener on unmount', async () => {
    const removeEventListener = vi.spyOn(document, 'removeEventListener');
    const unsupported = renderTitleBar('mac');
    expect(
      screen.getByRole('button', { name: 'Full Screen unavailable' }).hasAttribute('disabled'),
    ).toBe(true);
    unsupported.unmount();

    installFullscreenApi(vi.fn(), vi.fn(), () => null, false);
    const policyDisabled = renderTitleBar('mac');
    expect(
      screen.getByRole('button', { name: 'Full Screen unavailable' }).hasAttribute('disabled'),
    ).toBe(true);
    policyDisabled.unmount();

    installFullscreenApi(vi.fn(), vi.fn(), () => null);
    const supported = renderTitleBar('mac');
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Enter Full Screen' }).hasAttribute('disabled'),
      ).toBe(false);
    });
    supported.unmount();
    expect(removeEventListener).toHaveBeenCalledWith('fullscreenchange', expect.any(Function));
  });

  it('uses browser-window full screen when the extension service is available', async () => {
    let active = false;
    const setActive = vi.fn<WindowFullscreenClient['setActive']>((nextActive) => {
      active = nextActive;
      return Promise.resolve({ active, supported: true });
    });
    const client: WindowFullscreenClient = {
      getState: vi.fn(() => Promise.resolve({ active, supported: true })),
      setActive,
    };
    renderTitleBar('mac', { windowFullscreenClient: client });

    fireEvent.click(await screen.findByRole('button', { name: 'Enter Full Screen' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Exit Full Screen' })).toBeDefined();
    });
    expect(setActive).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByRole('button', { name: 'Exit Full Screen' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Enter Full Screen' })).toBeDefined();
    });
    expect(setActive).toHaveBeenCalledWith(false);
  });

  it('uses the compact workspace Command Center and keeps navigation beside it', () => {
    const onOpenQuickOpen = vi.fn();
    const { container } = renderTitleBar('mac', { onOpenQuickOpen });
    const titlebarLeft = container.querySelector('.docode-workbench__titlebar-left');
    const titlebarCenter = container.querySelector('.docode-workbench__titlebar-center');
    const commandCenter = screen.getByRole('button', { name: 'Search files and Linux DO topics' });

    expect(titlebarLeft?.querySelectorAll('.docode-workbench__traffic-light')).toHaveLength(3);
    expect(titlebarLeft?.querySelector('[aria-label="Go Back"]')).toBeNull();
    expect(titlebarCenter?.querySelector('[aria-label="Go Back"]')).not.toBeNull();
    expect(titlebarCenter?.querySelector('[aria-label="Go Forward"]')).not.toBeNull();
    expect(commandCenter.textContent).toBe('DOCode');
    expect(commandCenter.querySelector('.codicon-search')).toBeNull();

    fireEvent.click(commandCenter);
    expect(onOpenQuickOpen).toHaveBeenCalledOnce();
  });

  it('renders the default Windows menu and keeps minimize and close as visual controls', () => {
    const { container } = renderTitleBar('windows');

    expect(
      container.querySelector('.docode-workbench__titlebar')?.getAttribute('data-platform'),
    ).toBe('windows');
    expect(container.querySelectorAll('.docode-workbench__menubar-item')).toHaveLength(8);
    const controls = container.querySelectorAll('.docode-workbench__window-control');
    expect(controls).toHaveLength(3);
    expect(Array.from(controls, (control) => control.firstElementChild?.classList[1])).toEqual([
      'codicon-chrome-minimize',
      'codicon-chrome-maximize',
      'codicon-chrome-close',
    ]);
    expect(controls[0]?.tagName).toBe('SPAN');
    expect(controls[1]?.tagName).toBe('BUTTON');
    expect(controls[2]?.tagName).toBe('SPAN');
    expect(screen.queryByRole('button', { name: /minimize|close window/iu })).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Full Screen unavailable' }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('toggles browser-window full screen from the Windows maximize control', async () => {
    let active = false;
    const setActive = vi.fn<WindowFullscreenClient['setActive']>((nextActive) => {
      active = nextActive;
      return Promise.resolve({ active, supported: true });
    });
    const client: WindowFullscreenClient = {
      getState: vi.fn(() => Promise.resolve({ active, supported: true })),
      setActive,
    };
    const { container } = renderTitleBar('windows', { windowFullscreenClient: client });

    const enter = await screen.findByRole('button', { name: 'Enter Full Screen' });
    expect(enter.classList.contains('docode-workbench__window-control')).toBe(true);
    expect(enter.querySelector('.codicon-chrome-maximize')).not.toBeNull();
    fireEvent.click(enter);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Exit Full Screen' })).toBeDefined();
    });
    expect(setActive).toHaveBeenCalledWith(true);
    const exit = screen.getByRole('button', { name: 'Exit Full Screen' });
    expect(exit.getAttribute('aria-pressed')).toBe('true');
    expect(exit.querySelector('.codicon-chrome-restore')).not.toBeNull();
    expect(exit.querySelector('.codicon-chrome-maximize')).toBeNull();

    fireEvent.click(exit);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Enter Full Screen' })).toBeDefined();
    });
    expect(setActive).toHaveBeenCalledWith(false);
    expect(container.querySelectorAll('.codicon-chrome-maximize')).toHaveLength(1);
  });

  it('selects Windows chrome from the real navigator fingerprint by default', () => {
    vi.spyOn(window.navigator, 'platform', 'get').mockReturnValue('Win32');
    const { container } = renderTitleBar();

    expect(
      container.querySelector('.docode-workbench__titlebar')?.getAttribute('data-platform'),
    ).toBe('windows');
    expect(container.querySelectorAll('.docode-workbench__window-control')).toHaveLength(3);
    expect(container.querySelectorAll('.docode-workbench__traffic-light')).toHaveLength(0);
  });

  it('renders the VS Code layout-control order and keeps every exposed action honest', () => {
    const onOpenCommandPalette = vi.fn();
    const onTogglePanel = vi.fn();
    const onToggleSidebar = vi.fn();
    const { container } = renderTitleBar('mac', {
      onOpenCommandPalette,
      onTogglePanel,
      onToggleSidebar,
    });

    const controls = container.querySelectorAll(
      '.docode-workbench__layout-controls > .docode-workbench__titlebar-action',
    );
    expect(controls).toHaveLength(4);
    expect(Array.from(controls, (control) => control.firstElementChild?.classList[1])).toEqual([
      'codicon-layout',
      'codicon-layout-sidebar-left',
      'codicon-layout-panel',
      'codicon-layout-sidebar-right-off',
    ]);
    expect(container.querySelector('.docode-workbench__titlebar-divider')).toBeNull();
    expect(
      screen
        .getByRole('button', { name: 'Secondary Side Bar unavailable' })
        .hasAttribute('disabled'),
    ).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Customize Layout' }));
    expect(screen.getByRole('menu', { name: 'Customize Layout' })).toBeDefined();
    expect(
      screen
        .getByRole('menuitemcheckbox', { name: 'Primary Side Bar' })
        .getAttribute('aria-checked'),
    ).toBe('true');
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Primary Side Bar' }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Panel' }));
    expect(onToggleSidebar).toHaveBeenCalledOnce();
    expect(onTogglePanel).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Open Command Palette...' }));
    expect(onOpenCommandPalette).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu', { name: 'Customize Layout' })).toBeNull();
  });

  it('renders the requested Activity Bar stack without blank or unrelated entries', () => {
    const { container } = render(
      <WorkbenchActivityBar
        onOpenExplorer={vi.fn()}
        onOpenQuickOpen={vi.fn()}
        onOpenSettings={vi.fn()}
        onRestoreOriginal={vi.fn()}
        settingsOpen={false}
        sidebarOpen
      />,
    );

    const groups = container.querySelectorAll('.docode-workbench__activity-group');
    expect(groups[0]?.querySelectorAll('.docode-workbench__activity-action')).toHaveLength(6);
    expect(groups[1]?.querySelectorAll('.docode-workbench__activity-action')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Explorer' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(
      screen.getByRole('button', { name: /Run and Debug unavailable/u }).hasAttribute('disabled'),
    ).toBe(true);
    expect(
      screen.getByRole('button', { name: /Extensions unavailable/u }).hasAttribute('disabled'),
    ).toBe(true);
    expect(
      screen
        .getByRole('button', { name: 'Search and Quick Open' })
        .querySelector('.codicon-search'),
    ).not.toBeNull();
    expect(screen.queryByRole('button', { name: /Containers unavailable/u })).toBeNull();
    expect(screen.queryByRole('button', { name: /Python unavailable/u })).toBeNull();
    expect(container.querySelector('[data-tone="warning"]')).not.toBeNull();
    expect(container.querySelector('[data-tone="sync"]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Settings' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
    expect(screen.getByRole('link', { name: 'Linux DO account' }).getAttribute('href')).toBe(
      'https://linux.do/my/activity',
    );
  });
});

function renderTitleBar(
  platform?: 'mac' | 'windows',
  callbacks: {
    readonly onOpenCommandPalette?: () => void;
    readonly onOpenQuickOpen?: () => void;
    readonly onTogglePanel?: () => void;
    readonly onToggleSidebar?: () => void;
    readonly windowFullscreenClient?: WindowFullscreenClient;
  } = {},
) {
  return render(
    <div data-docode-workbench-root="test">
      <WorkbenchTitleBar
        context={createWorkbenchViewContext(recognizeLinuxDoRoute('https://linux.do/latest'), 0)}
        onOpenCommandPalette={callbacks.onOpenCommandPalette ?? vi.fn()}
        onOpenQuickOpen={callbacks.onOpenQuickOpen ?? vi.fn()}
        onTogglePanel={callbacks.onTogglePanel ?? vi.fn()}
        onToggleSidebar={callbacks.onToggleSidebar ?? vi.fn()}
        panelOpen
        {...(platform ? { platform } : {})}
        sidebarOpen
        windowFullscreenClient={
          callbacks.windowFullscreenClient ?? unavailableWindowFullscreenClient
        }
      />
    </div>,
  );
}

const unavailableWindowFullscreenClient: WindowFullscreenClient = {
  getState: () => Promise.resolve({ active: false, supported: false }),
  setActive: () => Promise.reject(new Error('Window full screen unavailable.')),
};

function installFullscreenApi(
  requestFullscreen: () => Promise<void>,
  exitFullscreen: () => Promise<void>,
  readFullscreenElement: () => Element | null,
  fullscreenEnabled = true,
) {
  Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
    configurable: true,
    value: requestFullscreen,
  });
  Object.defineProperty(document, 'exitFullscreen', {
    configurable: true,
    value: exitFullscreen,
  });
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    get: readFullscreenElement,
  });
  Object.defineProperty(document, 'fullscreenEnabled', {
    configurable: true,
    value: fullscreenEnabled,
  });
}

function navigatorFor(platform: string, userAgent: string, clientPlatform?: string): Navigator {
  return {
    platform,
    userAgent,
    ...(clientPlatform ? { userAgentData: { platform: clientPlatform } } : {}),
  } as unknown as Navigator;
}
