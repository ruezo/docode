// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://linux.do/latest" }

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { recognizeLinuxDoRoute } from '../../src/linuxdo/routes';
import type { BrowseHistoryEntry } from '../../src/settings/browseHistoryStore';
import { WorkbenchHistory } from '../../src/ui/workbench/WorkbenchHistory';
import { formatBrowseHistoryTime } from '../../src/ui/workbench/workbenchHistoryTime';
import { createWorkbenchViewContext } from '../../src/ui/workbench/workbenchContext';

afterEach(() => {
  cleanup();
});

const NOW = Date.now();

const ENTRIES: readonly BrowseHistoryEntry[] = [
  {
    kind: 'topic',
    path: '/t/example-topic/42',
    title: 'Example topic',
    viewId: 'topic:42',
    visitedAt: NOW - 5 * 60_000,
    visits: 3,
  },
  {
    kind: 'topic-list',
    path: '/latest',
    title: 'Latest topics',
    viewId: 'list:latest',
    visitedAt: NOW - 2 * 3_600_000,
    visits: 1,
  },
];

function renderHistory(overrides: Partial<Parameters<typeof WorkbenchHistory>[0]> = {}) {
  const onNavigateRoute = vi.fn();
  const onRemoveEntry = vi.fn();
  const onClearHistory = vi.fn();
  const onRefresh = vi.fn();
  render(
    <WorkbenchHistory
      context={createWorkbenchViewContext(recognizeLinuxDoRoute('https://linux.do/latest'), 0)}
      entries={ENTRIES}
      historyLimit={100}
      now={NOW}
      onClearHistory={onClearHistory}
      onNavigateRoute={onNavigateRoute}
      onRefresh={onRefresh}
      onRemoveEntry={onRemoveEntry}
      {...overrides}
    />,
  );
  return { onClearHistory, onNavigateRoute, onRefresh, onRemoveEntry };
}

describe('WorkbenchHistory', () => {
  it('renders history entries as a Source Control style graph with times and counts', () => {
    renderHistory();
    expect(screen.getByText('SOURCE CONTROL')).toBeDefined();
    const rows = screen.getAllByRole('treeitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toBe('Example topic5m ago');
    expect(rows[1]?.textContent).toBe('Latest topics2h ago');
    expect(rows[0]?.getAttribute('aria-label')).toBe('Example topic, visited 5m ago, 3 visits');
    expect(rows[0]?.querySelector('.docode-workbench__history-dot')).not.toBeNull();
    expect(screen.getByText('Browse History')).toBeDefined();
    expect(document.querySelector('.docode-workbench__explorer-count')?.textContent).toBe('2');
  });

  it('marks the entry matching the current route as active', () => {
    renderHistory();
    const active = document.querySelector('.docode-workbench__history-row[data-active="true"]');
    expect(active?.textContent).toContain('Latest topics');
    expect(
      screen.getByRole('treeitem', { name: /Latest topics/u }).getAttribute('aria-current'),
    ).toBe('page');
  });

  it('navigates to the recorded route when an entry is clicked', () => {
    const { onNavigateRoute } = renderHistory();
    fireEvent.click(screen.getByRole('treeitem', { name: /Example topic/u }));
    expect(onNavigateRoute).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'topic', topicId: 42 }),
    );
  });

  it('supports removing a single entry and clearing everything', () => {
    const { onClearHistory, onRemoveEntry } = renderHistory();
    fireEvent.click(
      screen.getByRole('button', { name: 'Remove Example topic from Browse History' }),
    );
    expect(onRemoveEntry).toHaveBeenCalledWith('topic:42');
    fireEvent.click(screen.getByRole('button', { name: 'Clear Browse History' }));
    expect(onClearHistory).toHaveBeenCalledOnce();
  });

  it('shows loading, empty, and disabled states', () => {
    renderHistory({ entries: null });
    expect(screen.getByText('Loading browse history…')).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Clear Browse History' }).hasAttribute('disabled'),
    ).toBe(true);
    cleanup();

    renderHistory({ entries: [] });
    expect(screen.getByText(/No browse history yet/u)).toBeDefined();
    cleanup();

    renderHistory({ historyLimit: 0 });
    expect(screen.getByText(/Browse history is turned off/u)).toBeDefined();
    expect(screen.queryAllByRole('treeitem')).toHaveLength(0);
  });
});

describe('formatBrowseHistoryTime', () => {
  it('formats elapsed time into compact age labels', () => {
    const now = 1_700_000_000_000;
    expect(formatBrowseHistoryTime(now - 30_000, now)).toBe('just now');
    expect(formatBrowseHistoryTime(now - 5 * 60_000, now)).toBe('5m ago');
    expect(formatBrowseHistoryTime(now - 3 * 3_600_000, now)).toBe('3h ago');
    expect(formatBrowseHistoryTime(now - 2 * 86_400_000, now)).toBe('2d ago');
    expect(formatBrowseHistoryTime(now - 40 * 86_400_000, now)).toBe(
      new Date(now - 40 * 86_400_000).toLocaleDateString(),
    );
  });
});
