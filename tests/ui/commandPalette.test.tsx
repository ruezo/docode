// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createWorkbenchCommandRegistry,
  type WorkbenchCommandActions,
  type WorkbenchCommandContext,
} from '../../src/commands/workbenchCommands';
import type { LinuxDoNavigationOutcome } from '../../src/linuxdo/navigationAdapter';
import { recognizeLinuxDoRoute, type LinuxDoRoute } from '../../src/linuxdo/routes';
import { CommandPalette } from '../../src/ui/commandPalette/CommandPalette';
import { createWorkbenchViewContext } from '../../src/ui/workbench/workbenchContext';

afterEach(cleanup);

describe('CommandPalette', () => {
  it('filters groups, keeps focus in the full-width input, and dismisses with Escape', async () => {
    const user = userEvent.setup();
    const { context, onDismiss, registry } = setup();
    render(<CommandPalette context={context} onDismiss={onDismiss} registry={registry} />);
    const input = screen.getByRole('combobox', { name: 'Type the name of a command' });

    expect(document.activeElement).toBe(input);
    expect(screen.getAllByRole('option')).toHaveLength(9);
    expect(screen.getAllByText('DOCode')).toHaveLength(1);
    expect(screen.getAllByText('Linux DO')).toHaveLength(1);
    await user.type(input, 'hot');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByText('Hot', { selector: 'strong' })).toBeDefined();
    await user.keyboard('{Tab}');
    expect(document.activeElement).toBe(input);
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(input);
    expect(screen.queryByRole('button', { name: 'Close Command Palette' })).toBeNull();
    expect(screen.getByText('1 result').classList.contains('docode-sr-only')).toBe(true);
    await user.keyboard('{Escape}');
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('dispatches a selected command by stable ID through the shared action', async () => {
    const user = userEvent.setup();
    const { actions, context, onDismiss, registry } = setup();
    render(<CommandPalette context={context} onDismiss={onDismiss} registry={registry} />);

    await user.type(screen.getByRole('combobox'), 'show terminal');
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(actions.setPanel).toHaveBeenCalledWith('terminal');
      expect(onDismiss).toHaveBeenCalledOnce();
    });
  });

  it('shows pending and real dispatch failure without claiming success', async () => {
    const user = userEvent.setup();
    let resolveNavigation: ((value: LinuxDoNavigationOutcome) => void) | undefined;
    const pendingNavigation = new Promise<LinuxDoNavigationOutcome>((resolve) => {
      resolveNavigation = resolve;
    });
    const { actions, context, onDismiss, registry } = setup();
    actions.navigate.mockReturnValueOnce(pendingNavigation);
    render(<CommandPalette context={context} onDismiss={onDismiss} registry={registry} />);
    const input = screen.getByRole('combobox');

    await user.type(input, 'hot');
    await user.keyboard('{Enter}');
    expect(screen.getByRole('dialog', { name: 'Command Palette' }).getAttribute('aria-busy')).toBe(
      'true',
    );
    resolveNavigation?.({ kind: 'stale' });
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Navigation context changed before the target was confirmed.',
    );
    expect(onDismiss).not.toHaveBeenCalled();
  });
});

function setup() {
  const actions = {
    copyText: vi.fn(() => Promise.resolve(true)),
    readDiagnostics: vi.fn(() => 'build test'),
    loadTopicList: vi.fn<WorkbenchCommandActions['loadTopicList']>(() => Promise.resolve(null)),
    navigate: vi.fn((route: LinuxDoRoute): Promise<LinuxDoNavigationOutcome> =>
      Promise.resolve({ kind: 'navigated', route }),
    ),
    openComposer: vi.fn(() => Promise.resolve({ dirty: false, kind: 'opened' as const })),
    restoreOriginalView: vi.fn(() => Promise.resolve(true)),
    runPostAction: vi.fn<WorkbenchCommandActions['runPostAction']>((request) =>
      Promise.resolve({ action: request.action, active: true, kind: 'confirmed' }),
    ),
    runTabAction: vi.fn(() => Promise.resolve()),
    setPanel: vi.fn(() => true),
    setReadingMode: vi.fn(() => true),
    searchTopics: vi.fn<WorkbenchCommandActions['searchTopics']>((query) =>
      Promise.resolve({ items: [], kind: 'results', query }),
    ),
    setSearchSession: vi.fn(() => true),
    showCommandPalette: vi.fn(() => true),
    showQuickOpen: vi.fn(() => true),
    submitReply: vi.fn<WorkbenchCommandActions['submitReply']>(() =>
      Promise.resolve({ kind: 'submitted', postNumber: null }),
    ),
    toggleTerminal: vi.fn(() => true),
  } satisfies WorkbenchCommandActions;
  const context: WorkbenchCommandContext = {
    availableReadingModes: ['code'],
    currentPost: null,
    posts: [],
    tabTarget: null,
    topicInteraction: null,
    topicReady: false,
    view: createWorkbenchViewContext(recognizeLinuxDoRoute('https://linux.do/latest'), 3),
  };
  return {
    actions,
    context,
    onDismiss: vi.fn(),
    registry: createWorkbenchCommandRegistry(actions),
  };
}
