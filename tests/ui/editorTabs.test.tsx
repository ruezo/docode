// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://linux.do/t/synthetic-topic/42" }

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { recognizeLinuxDoRoute } from '../../src/linuxdo/routes';
import {
  activateWorkbenchView,
  createOpenViewState,
  openWorkbenchView,
} from '../../src/navigation/openViewState';
import type { TabActionRequest } from '../../src/navigation/tabActions';
import { EditorTabs } from '../../src/ui/workbench/WorkbenchChrome';
import { createWorkbenchViewContext } from '../../src/ui/workbench/workbenchContext';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('EditorTabs context menu', () => {
  it('opens from the keyboard, moves menu focus, and restores tab focus with Escape', async () => {
    const state = createState();
    renderTabs(state);
    const topicTab = screen.getByRole('tab', { name: 'topic:42' });
    topicTab.focus();

    fireEvent.keyDown(topicTab, { key: 'F10', shiftKey: true });
    const menu = screen.getByRole('menu', { name: 'topic:42 tab actions' });
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Close' }));
    });

    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Close Others' }));
    fireEvent.keyDown(menu, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Close Others' }));
    fireEvent.keyDown(menu, { key: 'Escape' });
    await waitFor(() => {
      expect(document.activeElement).toBe(topicTab);
    });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('dispatches contextual actions, omits unapproved pinning, and reports real failures', async () => {
    const user = userEvent.setup();
    const state = createState();
    const onRunTabAction = vi.fn((request: { id: string }) =>
      request.id === 'copy-topic-link'
        ? Promise.reject(new Error('clipboard denied'))
        : Promise.resolve(),
    );
    renderTabs(state, onRunTabAction);

    fireEvent.contextMenu(screen.getByRole('tab', { name: 'topic:42' }), {
      clientX: 100,
      clientY: 40,
    });
    expect(screen.queryByText(/pin/i)).toBeNull();
    await user.click(screen.getByRole('menuitem', { name: 'Copy Topic Link' }));
    expect(onRunTabAction).toHaveBeenCalledWith(
      { id: 'copy-topic-link', viewId: 'topic:42' },
      'context-menu',
    );
    expect((await screen.findByRole('alert')).textContent).toBe('Could not copy the topic link.');
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Copy Topic Link' }));

    await user.click(screen.getByRole('menuitem', { name: 'Open Original View' }));
    expect(onRunTabAction).toHaveBeenCalledWith(
      {
        id: 'open-original-view',
        viewId: 'topic:42',
      },
      'context-menu',
    );
    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBeNull();
    });
  });

  it('disables topic-only and unavailable close actions for a sole list view', () => {
    const route = recognizeLinuxDoRoute('https://linux.do/latest');
    renderTabs(
      createOpenViewState(route),
      vi.fn(() => Promise.resolve()),
      false,
    );
    fireEvent.contextMenu(screen.getByRole('tab', { name: 'latest' }));

    expect(screen.getByRole('menuitem', { name: 'Close' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('menuitem', { name: 'Copy Topic Link' }).hasAttribute('disabled')).toBe(
      true,
    );
    expect(
      screen.getByRole('menuitem', { name: 'Open Original View' }).hasAttribute('disabled'),
    ).toBe(true);
  });
});

function createState() {
  let state = createOpenViewState(recognizeLinuxDoRoute('https://linux.do/latest'));
  state = openWorkbenchView(state, recognizeLinuxDoRoute('https://linux.do/t/synthetic-topic/42'));
  state = openWorkbenchView(state, recognizeLinuxDoRoute('https://linux.do/search?q=codex'));
  return activateWorkbenchView(state, 'topic:42');
}

function renderTabs(
  state: ReturnType<typeof createState>,
  onRunTabAction: (request: TabActionRequest) => Promise<void> = vi.fn(() => Promise.resolve()),
  originalViewAvailable = true,
) {
  const active = state.openViews.find(({ id }) => id === state.activeViewId);
  if (!active) throw new Error('Missing active view');
  return render(
    <EditorTabs
      context={createWorkbenchViewContext(active.route, 0)}
      navigationState={state}
      onRunTabAction={onRunTabAction}
      originalViewAvailable={originalViewAvailable}
      windowActive
    />,
  );
}
