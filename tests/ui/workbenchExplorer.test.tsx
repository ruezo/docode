// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { recognizeLinuxDoRoute } from '../../src/linuxdo/routes';
import { createOpenViewState } from '../../src/navigation/openViewState';
import { WorkbenchExplorer } from '../../src/ui/workbench/WorkbenchExplorer';
import { createWorkbenchViewContext } from '../../src/ui/workbench/workbenchContext';
import {
  createWorkbenchVirtualFile,
  WORKBENCH_FILE_EXTENSIONS,
} from '../../src/ui/workbench/workbenchFileType';

afterEach(cleanup);

describe('WorkbenchExplorer', () => {
  it('shows canonical topic-list route files instead of topic titles', () => {
    const route = recognizeLinuxDoRoute('https://linux.do/latest');
    const onNavigateRoute = vi.fn();
    render(
      <WorkbenchExplorer
        categories={null}
        context={createWorkbenchViewContext(route, 4)}
        navigationState={createOpenViewState(route)}
        onClearSearch={vi.fn()}
        onCloseView={vi.fn()}
        onNavigateRoute={onNavigateRoute}
        onOpenTagFilter={vi.fn()}
        onRefresh={vi.fn()}
        searchSession={null}
      />,
    );

    expect(screen.getByRole('heading', { name: 'DOCODE' })).toBeDefined();
    const tree = screen.getByRole('tree', { name: 'Linux DO list routes' });
    expect(tree.querySelectorAll('[role="treeitem"]')).toHaveLength(5);
    const expectedRouteFiles = ['latest', 'unread', 'new', 'top', 'hot'].map(
      (label) => createWorkbenchVirtualFile(label, `list:${label}`).name,
    );
    expect(
      ['latest', 'unread', 'new', 'top', 'hot'].map(
        (label) =>
          screen
            .getByRole('treeitem', { name: label })
            .querySelector('.docode-workbench__explorer-label')?.textContent,
      ),
    ).toEqual(expectedRouteFiles);
    expect(
      Array.from(tree.querySelectorAll<HTMLElement>('[data-file-extension]')).map(
        (icon) => icon.dataset.fileExtension,
      ),
    ).toEqual(
      ['latest', 'unread', 'new', 'top', 'hot'].map(
        (label) => createWorkbenchVirtualFile(label, `list:${label}`).extension,
      ),
    );
    expect(screen.getByRole('treeitem', { name: 'latest' }).getAttribute('aria-current')).toBe(
      'page',
    );
    expect(screen.getByRole('treeitem', { name: 'new' }).getAttribute('data-access')).toBe(
      'authentication-dependent',
    );
    expect(screen.getByRole('treeitem', { name: 'unread' }).getAttribute('data-access')).toBe(
      'authentication-dependent',
    );
    expect(screen.queryByText('First topic')).toBeNull();

    fireEvent.click(screen.getByRole('treeitem', { name: 'hot' }));
    expect(onNavigateRoute).toHaveBeenCalledWith(
      expect.objectContaining({ href: 'https://linux.do/hot', kind: 'topic-list', view: 'hot' }),
    );
  });

  it('lists Linux DO categories as navigable folder rows with color swatches', () => {
    const route = recognizeLinuxDoRoute('https://linux.do/c/develop/4');
    const onNavigateRoute = vi.fn();
    const onOpenTagFilter = vi.fn();
    render(
      <WorkbenchExplorer
        categories={[
          {
            color: '#0088cc',
            description: '开发调优相关讨论',
            id: 4,
            name: '开发调优',
            slug: 'develop',
            topicCount: 128,
            url: 'https://linux.do/c/develop/4',
          },
          {
            color: null,
            description: null,
            id: 14,
            name: '资源荟萃',
            slug: 'resource',
            topicCount: 0,
            url: 'https://linux.do/c/resource/14',
          },
        ]}
        context={createWorkbenchViewContext(route, 4)}
        navigationState={createOpenViewState(route)}
        onClearSearch={vi.fn()}
        onCloseView={vi.fn()}
        onNavigateRoute={onNavigateRoute}
        onOpenTagFilter={onOpenTagFilter}
        onRefresh={vi.fn()}
        searchSession={null}
      />,
    );

    expect(screen.getByText('Category Lists')).toBeDefined();
    const tree = screen.getByRole('tree', { name: 'Linux DO categories' });
    expect(tree.querySelectorAll('[role="treeitem"]')).toHaveLength(2);
    const develop = screen.getByRole('treeitem', { name: '开发调优' });
    expect(develop.getAttribute('aria-current')).toBe('page');
    expect(develop.getAttribute('title')).toBeNull();
    expect(develop.getAttribute('data-docode-tooltip')).toBe('开发调优 — 开发调优相关讨论');
    expect(develop.querySelector('.docode-workbench__explorer-label')?.textContent).toBe(
      'develop.png',
    );
    const developIcon = develop.querySelector<HTMLElement>('[data-file-extension]');
    expect(developIcon?.dataset.fileExtension).toBe('png');
    expect(developIcon?.dataset.setiIcon).toBe('_image');
    expect(develop.querySelector('.docode-workbench__explorer-category-count')?.textContent).toBe(
      '128',
    );
    const resource = screen.getByRole('treeitem', { name: '资源荟萃' });
    expect(resource.getAttribute('aria-current')).toBeNull();
    expect(resource.getAttribute('data-docode-tooltip')).toBe('资源荟萃');
    expect(resource.querySelector('.docode-workbench__explorer-label')?.textContent).toBe(
      'resource.csv',
    );
    expect(resource.querySelector<HTMLElement>('[data-file-extension]')?.dataset.setiIcon).toBe(
      '_csv',
    );
    expect(resource.querySelector('.docode-workbench__explorer-category-count')).toBeNull();

    fireEvent.click(resource);
    expect(onNavigateRoute).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryId: 14,
        categorySlug: 'resource',
        kind: 'topic-list',
        view: 'category',
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Filter topics by tag' }));
    expect(onOpenTagFilter).toHaveBeenCalledOnce();
  });

  it('reports category loading and unavailable states inside the section', () => {
    const route = recognizeLinuxDoRoute('https://linux.do/latest');
    const loading = render(
      <WorkbenchExplorer
        categories={null}
        context={createWorkbenchViewContext(route, 4)}
        navigationState={createOpenViewState(route)}
        onClearSearch={vi.fn()}
        onCloseView={vi.fn()}
        onNavigateRoute={vi.fn()}
        onOpenTagFilter={vi.fn()}
        onRefresh={vi.fn()}
        searchSession={null}
      />,
    );
    expect(loading.getByText('Loading Linux DO categories…')).toBeDefined();
    loading.unmount();

    render(
      <WorkbenchExplorer
        categories={[]}
        context={createWorkbenchViewContext(route, 4)}
        navigationState={createOpenViewState(route)}
        onClearSearch={vi.fn()}
        onCloseView={vi.fn()}
        onNavigateRoute={vi.fn()}
        onOpenTagFilter={vi.fn()}
        onRefresh={vi.fn()}
        searchSession={null}
      />,
    );
    expect(screen.getByText('Linux DO categories are unavailable.')).toBeDefined();
  });

  it('closes an open editor from the Open Editors row', () => {
    const route = recognizeLinuxDoRoute('https://linux.do/latest');
    const navigationState = createOpenViewState(route);
    const onCloseView = vi.fn();
    render(
      <WorkbenchExplorer
        categories={null}
        context={createWorkbenchViewContext(route, 4)}
        navigationState={navigationState}
        onClearSearch={vi.fn()}
        onCloseView={onCloseView}
        onNavigateRoute={vi.fn()}
        onOpenTagFilter={vi.fn()}
        onRefresh={vi.fn()}
        searchSession={null}
      />,
    );

    const openView = navigationState.openViews[0];
    expect(openView).toBeDefined();
    const label = createWorkbenchVirtualFile(
      createWorkbenchViewContext(route, 4).label,
      `view:${openView?.id ?? ''}`,
    ).name;

    fireEvent.click(screen.getByRole('button', { name: `Close ${label}` }));
    expect(onCloseView).toHaveBeenCalledWith(openView?.id);
  });

  it('uses only the approved file types and keeps assignments stable', () => {
    const first = createWorkbenchVirtualFile('topic:2781292', 'view:topic:2781292');
    const second = createWorkbenchVirtualFile('topic:2781292', 'view:topic:2781292');

    expect(first).toEqual(second);
    expect(first.name).toBe(`topic:2781292.${first.extension}`);
    expect(WORKBENCH_FILE_EXTENSIONS).toEqual([
      'xml',
      'py',
      'java',
      'go',
      'c',
      'cpp',
      'toml',
      'yaml',
      'ts',
      'tsx',
      'dart',
      'kt',
      'md',
      'json',
    ]);
  });

  it('renders a transient SEARCH folder and removes it through the explicit close action', () => {
    const route = recognizeLinuxDoRoute('https://linux.do/latest');
    const resultRoute = recognizeLinuxDoRoute('https://linux.do/t/search-result/42/7');
    const onClearSearch = vi.fn();
    const onNavigateRoute = vi.fn();
    render(
      <WorkbenchExplorer
        categories={null}
        context={createWorkbenchViewContext(route, 4)}
        navigationState={createOpenViewState(route)}
        onClearSearch={onClearSearch}
        onCloseView={vi.fn()}
        onNavigateRoute={onNavigateRoute}
        onOpenTagFilter={vi.fn()}
        onRefresh={vi.fn()}
        searchSession={{
          items: [
            {
              description: 'Post 7 · @fixture-user',
              id: 'post:42:7',
              kind: 'post',
              label: 'Search result',
              route: resultRoute,
              url: resultRoute.href,
            },
          ],
          query: 'browser extension',
        }}
      />,
    );

    expect(screen.getByText('Search: browser extension')).toBeDefined();
    const tree = screen.getByRole('tree', { name: 'Search results for browser extension' });
    const result = screen.getByRole('treeitem', {
      name: 'Search result, Post 7 · @fixture-user',
    });
    expect(tree.contains(result)).toBe(true);
    expect(result.querySelector('.docode-workbench__explorer-label')?.textContent).toMatch(
      /^Search result\.(?:xml|py|java|go|c|cpp|toml|yaml|ts|tsx|dart|kt|md|json)$/u,
    );

    fireEvent.click(result);
    expect(onNavigateRoute).toHaveBeenCalledWith(resultRoute);
    fireEvent.click(screen.getByRole('button', { name: 'Close Search Results' }));
    expect(onClearSearch).toHaveBeenCalledOnce();
  });
});
