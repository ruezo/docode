// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { recognizeLinuxDoRoute } from '../../src/linuxdo/routes';
import { createOpenViewState } from '../../src/navigation/openViewState';
import { WorkbenchShell } from '../../src/ui/workbench/WorkbenchShell';
import { createWorkbenchViewContext } from '../../src/ui/workbench/workbenchContext';
import {
  createWorkbenchSurfaceState,
  type WorkbenchSurfaceState,
} from '../../src/ui/workbench/workbenchSurfaceState';

afterEach(cleanup);

describe('WorkbenchShell', () => {
  it('renders task-scoped chrome with meaningful current-route labels', () => {
    renderShell('https://linux.do/t/synthetic-topic/42/7');

    expect(screen.getByLabelText('DOCode workbench')).toBeDefined();
    expect(screen.getByRole('main', { name: 'Editor region' })).toBeDefined();
    expect(screen.getByLabelText('Gutter slot')).toBeDefined();
    expect(screen.getByRole('region', { name: 'Editor content slot' })).toBeDefined();
    expect(screen.getByRole('complementary', { name: 'Topic minimap' })).toBeDefined();
    expect(screen.getByRole('region', { name: 'Bottom panel' })).toBeDefined();
    expect(screen.getByRole('contentinfo', { name: 'DOCode status' })).toBeDefined();
    expect(screen.getByRole('tab', { name: 'topic:42' }).getAttribute('data-docode-tooltip')).toBe(
      'topic:42 — /t/synthetic-topic/42/7',
    );
    expect(screen.getByRole('tab', { name: 'Outline' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Terminal' }).getAttribute('aria-selected')).toBe(
      'false',
    );
    expect(screen.getByText('Topic 42 · Post 7')).toBeDefined();
    expect(
      screen.getByText('DOCode', { selector: '.docode-workbench__status-item' }),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Linux DO' }).hasAttribute('href')).toBe(false);
    expect(
      screen.getByRole('contentinfo', { name: 'DOCode status' }).querySelector('a[href]'),
    ).toBeNull();
  });

  it('renders the standard English Panel tabs in VS Code order without faking views', () => {
    renderShell('https://linux.do/latest');

    const tabList = screen.getByRole('tablist', { name: 'Panel views' });
    const tabs = Array.from(tabList.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'Problems',
      'Output',
      'Debug Console',
      'Terminal',
      'Ports',
    ]);
    expect(tabs.filter((tab) => tab.disabled).map((tab) => tab.textContent)).toEqual([
      'Problems',
      'Output',
      'Debug Console',
      'Ports',
    ]);
    expect(screen.getByRole('tab', { name: 'Terminal' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Problems' }).getAttribute('data-docode-tooltip')).toBe(
      'Problems unavailable',
    );
  });

  it('keeps the workbench visible and exposes loading as an indeterminate editor progress line', () => {
    const { container } = renderShell('https://linux.do/latest', {
      code: 'topic-list-loading',
      description: 'Waiting for Linux DO to finish rendering this view.',
      icon: 'loading',
      kind: 'loading',
      retryLabel: null,
      title: 'Loading topics…',
    });

    const progress = screen.getByRole('progressbar', { name: 'Loading topics…' });
    expect(progress.getAttribute('aria-valuetext')).toBe(
      'Waiting for Linux DO to finish rendering this view.',
    );
    expect(progress.hasAttribute('aria-valuenow')).toBe(false);
    expect(progress.querySelector('.docode-workbench__editor-progress-bit')).not.toBeNull();
    expect(container.querySelector('.docode-workbench__state-surface')).toBeNull();
    expect(screen.getByRole('main', { name: 'Editor region' })).toBeDefined();
  });

  it('matches the supplied editor-action glyph order without exposing fake commands', () => {
    const { container } = renderShell('https://linux.do/latest');
    const actions = container.querySelectorAll(
      '.docode-workbench__editor-title > .docode-workbench__quick-open-trigger',
    );

    expect(actions).toHaveLength(3);
    expect(Array.from(actions, (action) => action.firstElementChild?.classList[1])).toEqual([
      'codicon-source-control',
      'codicon-split-horizontal',
      'codicon-ellipsis',
    ]);
    expect(screen.getByRole('button', { name: 'Search files and Linux DO topics' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Open Quick Open' })).toBeNull();
  });

  it('resizes the primary side bar from its edge with keyboard limits and reset', async () => {
    const user = userEvent.setup();
    const onSidebarWidthChange = vi.fn(() => Promise.resolve());
    renderShell('https://linux.do/latest', undefined, null, undefined, {
      onSidebarWidthChange,
    });
    const sash = screen.getByRole('separator', { name: 'Resize primary side bar' });

    expect(sash.getAttribute('aria-valuemin')).toBe('170');
    expect(sash.getAttribute('aria-valuenow')).toBe('300');
    expect(sash.getAttribute('aria-valuemax')).toBe('676');

    const releasePointerCapture = vi.fn();
    sash.setPointerCapture = vi.fn();
    sash.hasPointerCapture = vi.fn(() => true);
    sash.releasePointerCapture = releasePointerCapture;
    fireEvent.pointerDown(sash, { button: 0, clientX: 348, pointerId: 7 });
    fireEvent.pointerMove(sash, { clientX: 408, pointerId: 7 });
    fireEvent.pointerUp(sash, { clientX: 408, pointerId: 7 });
    expect(sash.getAttribute('aria-valuenow')).toBe('360');
    expect(releasePointerCapture).toHaveBeenCalledWith(7);
    await waitFor(() => {
      expect(onSidebarWidthChange).toHaveBeenLastCalledWith(360);
    });

    sash.focus();
    await user.keyboard('{ArrowRight}');
    expect(sash.getAttribute('aria-valuenow')).toBe('370');
    await user.keyboard('{Home}');
    expect(sash.getAttribute('aria-valuenow')).toBe('170');
    await user.keyboard('{End}');
    expect(sash.getAttribute('aria-valuenow')).toBe('676');
    fireEvent.doubleClick(sash);
    expect(sash.getAttribute('aria-valuenow')).toBe('300');
    await waitFor(() => {
      expect(onSidebarWidthChange).toHaveBeenLastCalledWith(300);
    });
  });

  it('starts from a stored side bar width and reports a failed persistence write', async () => {
    renderShell('https://linux.do/latest', undefined, null, undefined, {
      initialSidebarWidth: 244,
      onSidebarWidthChange: () => Promise.reject(new Error('storage unavailable')),
    });
    const sash = screen.getByRole('separator', { name: 'Resize primary side bar' });

    expect(sash.getAttribute('aria-valuenow')).toBe('244');
    fireEvent.keyDown(sash, { key: 'ArrowRight' });

    expect(sash.getAttribute('aria-valuenow')).toBe('254');
    await waitFor(() => {
      expect(
        screen.getByLabelText('DOCode workbench').getAttribute('data-layout-storage-error'),
      ).toBe('true');
    });
  });

  it('routes status commands through the Linux DO adapter without visible anchors', async () => {
    const user = userEvent.setup();
    const onNavigateRoute = vi.fn<Parameters<typeof WorkbenchShell>[0]['onNavigateRoute']>(
      (route) => Promise.resolve({ kind: 'navigated', route }),
    );
    renderShell('https://linux.do/hot', undefined, null, onNavigateRoute);

    await user.click(screen.getByRole('button', { name: 'Linux DO' }));

    expect(onNavigateRoute).toHaveBeenCalledTimes(1);
    expect(onNavigateRoute.mock.calls[0]?.[0]).toMatchObject({
      href: 'https://linux.do/',
      kind: 'topic-list',
      view: 'latest',
    });
    expect(onNavigateRoute.mock.calls[0]?.[1]).toBe(0);
    expect(onNavigateRoute.mock.calls[0]?.[2]).toBeInstanceOf(AbortSignal);

    const currentView = screen.getByRole('button', { name: /Current view:/u });
    currentView.focus();
    await user.keyboard('{Enter}');
    expect(onNavigateRoute).toHaveBeenCalledTimes(2);
    expect(onNavigateRoute.mock.calls[1]?.[0]).toMatchObject({
      href: 'https://linux.do/hot',
      kind: 'topic-list',
      view: 'hot',
    });
  });

  it('uses honest disabled chrome for an unsupported Linux DO route', () => {
    renderShell('https://linux.do/unknown');

    expect(screen.getByRole('tab', { name: 'unsupported' }).getAttribute('aria-disabled')).toBe(
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Terminal' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('Unsupported Linux DO route')).toBeDefined();
    expect(screen.getByLabelText('DOCode workbench').getAttribute('data-supported')).toBe('false');
  });

  it('disables the shared Reply editor action while Linux DO is opening Composer', () => {
    renderShell('https://linux.do/t/synthetic-topic/42', undefined, {
      kind: 'opening',
      message: 'Opening the Linux DO composer…',
    });

    const reply = screen.getByRole('button', { name: 'Opening the Linux DO composer…' });
    expect(reply.hasAttribute('disabled')).toBe(true);
    expect(reply.getAttribute('aria-busy')).toBe('true');
  });

  it('supports bounded keyboard resizing and exposes the current sash value', async () => {
    const user = userEvent.setup();
    renderShell('https://linux.do/latest');
    const sash = screen.getByRole('separator', { name: 'Resize bottom panel' });
    const expectedInitialHeight = Math.round(window.innerHeight * 0.125);
    const expectedMaximum = window.innerHeight - 35 - 22 - 4 - 120;

    expect(sash.getAttribute('aria-valuemin')).toBe('77');
    expect(sash.getAttribute('aria-valuenow')).toBe(String(expectedInitialHeight));
    expect(sash.getAttribute('aria-valuemax')).toBe(String(expectedMaximum));

    sash.focus();
    await user.keyboard('{ArrowUp}');
    expect(sash.getAttribute('aria-valuenow')).toBe(String(expectedInitialHeight + 10));
    await user.keyboard('{ArrowDown}');
    expect(sash.getAttribute('aria-valuenow')).toBe(String(expectedInitialHeight));
    await user.keyboard('{Home}');
    expect(sash.getAttribute('aria-valuenow')).toBe('77');
    await user.keyboard('{End}');
    expect(sash.getAttribute('aria-valuenow')).toBe(String(expectedMaximum));
  });

  it('switches panel tabs with the keyboard and focuses the selected terminal prompt', async () => {
    const user = userEvent.setup();
    renderShell('https://linux.do/t/synthetic-topic/42/7');
    const outline = screen.getByRole('tab', { name: 'Outline' });

    outline.focus();
    await user.keyboard('{ArrowRight}');
    const terminal = screen.getByRole('tab', { name: 'Terminal' });
    expect(terminal.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(terminal);

    await user.click(outline);
    await user.click(terminal);
    const input = screen.getByRole('combobox', { name: 'Linux DO command input' });
    expect(document.activeElement).toBe(input);
    await user.type(input, 'missing');
    await user.keyboard('{Enter}');
    expect(await screen.findByText('Unknown command: missing')).toBeDefined();
    await user.click(outline);
    await user.click(terminal);
    expect(screen.getByText('Unknown command: missing')).toBeDefined();
  });

  it('exposes real VS Code-shaped Terminal session actions and viewer prompt', async () => {
    const user = userEvent.setup();
    const { container } = renderShell('https://linux.do/latest');

    expect(screen.getByText('linux.do/fixture-user %')).toBeDefined();
    expect(container.querySelector('.docode-workbench__terminal-session')?.textContent).toBe(
      'linux.do',
    );
    expect(screen.getByRole('button', { name: 'New Terminal Session' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Clear Terminal' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'More Terminal Actions' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Maximize Bottom Panel' })).toBeDefined();

    const input = screen.getByRole('combobox', { name: 'Linux DO command input' });
    await user.type(input, 'missing{Enter}');
    expect(await screen.findByText('Unknown command: missing')).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Clear Terminal' }));
    await waitFor(() => {
      expect(screen.queryByText('Unknown command: missing')).toBeNull();
      expect(document.activeElement).toBe(input);
    });

    await user.click(screen.getByRole('button', { name: 'Maximize Bottom Panel' }));
    expect(screen.getByRole('button', { name: 'Restore Bottom Panel Size' })).toBeDefined();
  });

  it('closes, restores focus to, and reopens the bottom panel without losing editor space', async () => {
    const user = userEvent.setup();
    renderShell('https://linux.do/latest');

    expect(screen.getByRole('tab', { name: 'Terminal' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    const input = screen.getByRole('combobox', { name: 'Linux DO command input' });
    await user.type(input, 'missing');
    await user.keyboard('{Enter}');
    expect(await screen.findByText('Unknown command: missing')).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Close Bottom Panel' }));
    const showPanel = await screen.findByRole('button', { name: 'Show Bottom Panel' });
    expect(document.activeElement).toBe(showPanel);
    expect(screen.queryByRole('region', { name: 'Bottom panel' })).toBeNull();
    expect(screen.queryByRole('separator', { name: 'Resize bottom panel' })).toBeNull();
    expect(screen.getByLabelText('DOCode workbench').getAttribute('data-panel-open')).toBe('false');

    await user.click(showPanel);
    expect(screen.getByRole('region', { name: 'Bottom panel' })).toBeDefined();
    expect(document.activeElement).toBe(
      screen.getByRole('combobox', { name: 'Linux DO command input' }),
    );
    expect(screen.getByText('Unknown command: missing')).toBeDefined();
  });

  it('opens Quick Open through the title-bar Command Center and restores trigger focus', async () => {
    const user = userEvent.setup();
    renderShell('https://linux.do/latest');
    const trigger = screen.getByRole('button', { name: 'Search files and Linux DO topics' });
    expect(trigger.textContent).toBe('DOCode');
    expect(trigger.querySelectorAll('.codicon')).toHaveLength(0);
    expect(trigger.getAttribute('aria-hidden')).toBeNull();

    await user.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Quick Open' })).toBeDefined();
    expect(trigger.isConnected).toBe(true);
    expect(trigger.getAttribute('aria-hidden')).toBe('true');
    expect(trigger.tabIndex).toBe(-1);
    expect(document.activeElement).toBe(
      screen.getByRole('combobox', {
        name: 'Search open views, loaded topics, and Linux DO',
      }),
    );
    expect(screen.getByRole('option', { name: /latest/u }).getAttribute('aria-selected')).toBe(
      'true',
    );
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(document.activeElement).toBe(trigger);
    });
    expect(trigger.getAttribute('aria-hidden')).toBeNull();
    expect(trigger.tabIndex).toBe(0);

    await user.click(trigger);
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Quick Open' })).toBeNull();
      expect(document.activeElement).toBe(trigger);
    });
  });

  it('runs the Command Palette, transitions to Quick Open, and restores original focus', async () => {
    const user = userEvent.setup();
    renderShell('https://linux.do/latest');
    const trigger = screen.getByRole('button', { name: 'Open Command Palette' });
    const commandCenter = screen.getByRole('button', {
      name: 'Search files and Linux DO topics',
    });
    expect(trigger.textContent).toBe('');
    expect(trigger.querySelectorAll('.codicon')).toHaveLength(1);

    await user.click(trigger);
    const paletteInput = screen.getByRole('combobox', { name: 'Type the name of a command' });
    expect(commandCenter.getAttribute('aria-hidden')).toBe('true');
    expect(commandCenter.tabIndex).toBe(-1);
    expect(document.activeElement).toBe(paletteInput);
    await user.type(paletteInput, 'quick open');
    await user.keyboard('{Enter}');

    const quickOpenInput = await screen.findByRole('combobox', {
      name: 'Search open views, loaded topics, and Linux DO',
    });
    expect(commandCenter.getAttribute('aria-hidden')).toBe('true');
    expect(screen.queryByRole('dialog', { name: 'Command Palette' })).toBeNull();
    expect(document.activeElement).toBe(quickOpenInput);
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(document.activeElement).toBe(trigger);
    });
    expect(commandCenter.getAttribute('aria-hidden')).toBeNull();
    expect(commandCenter.tabIndex).toBe(0);
  });

  it('keeps command-directed focus when the Command Palette closes', async () => {
    const user = userEvent.setup();
    renderShell('https://linux.do/t/synthetic-topic/42/7');

    await user.click(screen.getByRole('button', { name: 'Open Command Palette' }));
    const paletteInput = screen.getByRole('combobox', { name: 'Type the name of a command' });
    await user.type(paletteInput, 'show terminal');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Command Palette' })).toBeNull();
      expect(document.activeElement).toBe(
        screen.getByRole('combobox', { name: 'Linux DO command input' }),
      );
    });
  });

  it('opens Quick Open and Command Palette through scoped shortcuts with labels', async () => {
    const user = userEvent.setup();
    renderShell('https://linux.do/latest');
    const quickOpenTrigger = screen.getByRole('button', {
      name: 'Search files and Linux DO topics',
    });

    quickOpenTrigger.focus();
    const quickOpenEvent = dispatchShortcut(quickOpenTrigger, 'KeyP');
    expect(quickOpenEvent.defaultPrevented).toBe(true);
    expect(await screen.findByRole('dialog', { name: 'Quick Open' })).toBeDefined();
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(document.activeElement).toBe(quickOpenTrigger);
    });

    const paletteEvent = dispatchShortcut(quickOpenTrigger, 'KeyP', { shiftKey: true });
    expect(paletteEvent.defaultPrevented).toBe(true);
    expect(await screen.findByRole('dialog', { name: 'Command Palette' })).toBeDefined();
    expect(screen.getByRole('option', { name: /Show Quick Open/u }).textContent).toContain(
      'Ctrl+P',
    );
    await user.keyboard('{Escape}');
  });

  it('toggles and focuses the terminal while preserving editable and browser shortcuts', async () => {
    renderShell('https://linux.do/latest');
    const trigger = screen.getByRole('button', {
      name: 'Search files and Linux DO topics',
    });

    trigger.focus();
    expect(dispatchShortcut(trigger, 'Backquote').defaultPrevented).toBe(true);
    const showPanel = await screen.findByRole('button', { name: 'Show Bottom Panel' });
    expect(document.activeElement).toBe(showPanel);
    expect(dispatchShortcut(showPanel, 'Backquote').defaultPrevented).toBe(true);
    const terminalInput = screen.getByRole('combobox', { name: 'Linux DO command input' });
    await waitFor(() => {
      expect(document.activeElement).toBe(terminalInput);
    });
    expect(dispatchShortcut(terminalInput, 'KeyP').defaultPrevented).toBe(false);
    expect(screen.queryByRole('dialog', { name: 'Quick Open' })).toBeNull();
    expect(dispatchShortcut(terminalInput, 'Backquote').defaultPrevented).toBe(true);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Show Bottom Panel' })).toBeDefined();
    });

    const composer = document.body.appendChild(document.createElement('div'));
    composer.id = 'reply-control';
    const composerInput = composer.appendChild(document.createElement('textarea'));
    expect(dispatchShortcut(composerInput, 'KeyP').defaultPrevented).toBe(false);
    expect(dispatchShortcut(composerInput, 'Backquote').defaultPrevented).toBe(false);
    expect(screen.queryByRole('dialog')).toBeNull();

    const historyEvent = dispatchShortcut(trigger, 'ArrowLeft', {
      altKey: true,
      ctrlKey: false,
    });
    expect(historyEvent.defaultPrevented).toBe(false);
    const browserEvent = dispatchShortcut(trigger, 'KeyL');
    expect(browserEvent.defaultPrevented).toBe(false);
  });

  it('does not claim workbench shortcuts on unsupported routes', () => {
    renderShell('https://linux.do/unknown');
    const target = screen.getByRole('button', { name: 'Linux DO' });
    const event = dispatchShortcut(target, 'KeyP');

    expect(event.defaultPrevented).toBe(false);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it.each([
    {
      href: 'https://linux.do/latest',
      state: {
        code: 'topic-list-empty',
        description: 'Linux DO returned no topics for this view.',
        icon: 'info',
        kind: 'empty',
        retryLabel: 'Refresh',
        title: 'No topics',
      } satisfies WorkbenchSurfaceState,
    },
    {
      href: 'https://linux.do/t/synthetic-topic/42',
      state: {
        code: 'post-stream-not-found',
        description: 'Linux DO did not expose the expected post stream.',
        icon: 'error',
        kind: 'error',
        retryLabel: 'Retry',
        title: 'Unable to read this topic',
      } satisfies WorkbenchSurfaceState,
    },
  ])('does not render terminal completion prompts for $state.kind context', async (row) => {
    const user = userEvent.setup();
    renderShell(row.href, row.state);
    if (row.href.includes('/t/')) {
      await user.click(screen.getByRole('tab', { name: 'Terminal' }));
    }
    const input = screen.getByRole('combobox', { name: 'Linux DO command input' });

    await user.click(input);
    await user.keyboard('{Tab}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.queryByRole('option')).toBeNull();
    expect(input.getAttribute('aria-expanded')).toBeNull();
    expect((input as HTMLInputElement).value).toBe('');
    expect(document.activeElement).toBe(input);
  });
});

function renderShell(
  href: string,
  surfaceState?: WorkbenchSurfaceState,
  nativeComposerFeedback: Parameters<typeof WorkbenchShell>[0]['nativeComposerFeedback'] = null,
  onNavigateRoute?: Parameters<typeof WorkbenchShell>[0]['onNavigateRoute'],
  layout: Pick<
    Parameters<typeof WorkbenchShell>[0],
    'initialSidebarWidth' | 'onSidebarWidthChange'
  > = {},
) {
  const route = recognizeLinuxDoRoute(href);
  return render(
    <WorkbenchShell
      actions={{ onRetry: () => undefined, onUseOriginal: null }}
      context={createWorkbenchViewContext(route, 0)}
      initialSidebarWidth={layout.initialSidebarWidth}
      nativeContentTransfer={null}
      nativeComposer={null}
      nativeComposerFeedback={nativeComposerFeedback}
      navigationState={createOpenViewState(route)}
      onCopyText={() => Promise.resolve(true)}
      onLoadTopicList={() => Promise.resolve(null)}
      onNavigateRoute={
        onNavigateRoute ??
        ((target) => Promise.resolve({ kind: 'unchanged' as const, route: target }))
      }
      onOpenComposer={() => Promise.resolve({ dirty: false, kind: 'opened' })}
      onSubmitReply={() => Promise.resolve({ kind: 'submitted', postNumber: null })}
      onPrepareOpenView={() => undefined}
      onRunPostAction={(request) =>
        Promise.resolve({ action: request.action, active: true, kind: 'confirmed' })
      }
      onRunTabAction={() => Promise.resolve()}
      onSearch={(query) => Promise.resolve({ items: [], kind: 'results', query })}
      onSidebarWidthChange={layout.onSidebarWidthChange}
      routeSource="initial"
      surfaceState={surfaceState ?? createWorkbenchSurfaceState(document, route)}
      topicDetailDocument={null}
      topicListDocument={null}
      terminalUsername="fixture-user"
      viewRevision={0}
    />,
  );
}

function dispatchShortcut(
  target: Element,
  code: string,
  options: Partial<KeyboardEventInit> = {},
): KeyboardEvent {
  const event = createShortcut(code, options);
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

function createShortcut(code: string, options: Partial<KeyboardEventInit> = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    code,
    ctrlKey: true,
    key: code === 'KeyP' ? 'p' : code === 'Backquote' ? '`' : '',
    ...options,
  });
}
