// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TopicOutlineView } from '../../src/views/topic/TopicOutlineView';
import type {
  TopicMinimapRange,
  TopicOutlineEntry,
  TopicOutlineModel,
} from '../../src/views/topic/topicOverviewModel';

afterEach(cleanup);

describe('TopicOutlineView', () => {
  it('renders VS Code-density tree rows from real post and heading permalinks', () => {
    renderOutline(readyModel(entries(), 100), range());

    const tree = screen.getByRole('tree', { name: 'Outline for Synthetic topic' });
    const items = within(tree).getAllByRole('treeitem');
    expect(items).toHaveLength(3);
    expect(items[0]?.getAttribute('href')).toBe('https://linux.do/t/synthetic-topic/42');
    expect(items[0]?.getAttribute('aria-level')).toBe('1');
    expect(items[0]?.getAttribute('aria-current')).toBe('location');
    expect(items[0]?.getAttribute('aria-expanded')).toBe('true');
    expect(items[0]?.textContent).toContain('Post 1');
    expect(items[0]?.textContent).toContain('@alice');
    expect(items[0]?.textContent).toContain('original · code');
    expect(items[1]?.getAttribute('href')).toBe('https://linux.do/t/synthetic-topic/42');
    expect(items[1]?.getAttribute('aria-level')).toBe('2');
    expect(items[1]?.hasAttribute('aria-expanded')).toBe(false);
    expect(items[1]?.textContent).toContain('Heading');
    expect(items[2]?.getAttribute('href')).toBe('https://linux.do/t/synthetic-topic/42/2');
    expect(screen.getByText('Loading additional posts…')).toBeDefined();
  });

  it('supports roving tree focus and parent-child keyboard movement', async () => {
    const user = userEvent.setup();
    const onSelectPost = vi.fn();
    renderOutline(readyModel(entries(), 100), range(), { onSelectPost });
    const items = screen.getAllByRole('treeitem');

    items[0]?.focus();
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(items[1]);
    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(items[0]);
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(items[1]);
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(items[2]);
    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(items[0]);
    expect(onSelectPost).toHaveBeenLastCalledWith(100);
    expect(items[0]?.getAttribute('data-selected')).toBe('true');
  });

  it('collapses and expands heading children with tree keyboard and pointer controls', async () => {
    const user = userEvent.setup();
    renderOutline(readyModel(entries(), 100), range());
    const firstPost = screen.getByRole('treeitem', { name: 'Open post 1 by @alice' });

    firstPost.focus();
    await user.keyboard('{ArrowLeft}');
    expect(firstPost.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('treeitem', { name: 'Open heading Heading in post 1' })).toBeNull();

    await user.keyboard('{ArrowRight}');
    expect(firstPost.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('treeitem', { name: 'Open heading Heading in post 1' })).toBeDefined();

    const twistie = firstPost.querySelector<HTMLElement>('[data-outline-twistie="true"]');
    if (!twistie) throw new Error('Missing Outline twistie.');
    await user.click(twistie);
    expect(firstPost.getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps native link semantics while requesting editor focus only for primary navigation', () => {
    const onNavigatePost = vi.fn();
    renderOutline(readyModel(entries(), 100), range(), { onNavigatePost });
    const postTwo = screen.getByRole('treeitem', { name: 'Open post 2 by @bob' });
    let primaryWasPrevented: boolean | null = null;
    const inspectPrimary = (event: MouseEvent) => {
      primaryWasPrevented ??= event.defaultPrevented;
      event.preventDefault();
    };
    document.addEventListener('click', inspectPrimary);

    fireEvent.click(postTwo, { button: 0 });
    expect(primaryWasPrevented).toBe(false);
    expect(onNavigatePost).toHaveBeenCalledWith(101);

    fireEvent.click(postTwo, { button: 0, ctrlKey: true });
    document.removeEventListener('click', inspectPrimary);
    expect(onNavigatePost).toHaveBeenCalledTimes(1);
  });

  it('preserves focus across incremental updates and admits newly loaded posts', async () => {
    const user = userEvent.setup();
    const firstModel = readyModel(entries(), 101);
    const view = renderOutline(firstModel, range());
    const secondPost = screen.getByRole('treeitem', { name: 'Open post 2 by @bob' });
    secondPost.focus();

    view.rerender(
      <TopicOutlineView
        model={readyModel([...entries(), postEntry(102, 3, 'carol')], 101)}
        onNavigatePost={() => undefined}
        onSelectPost={() => undefined}
        range={{ ...range(), after: 'complete', lastPostNumber: 3, loadedPostCount: 3 }}
      />,
    );

    expect(document.activeElement).toBe(secondPost);
    expect(screen.getAllByRole('treeitem')).toHaveLength(4);
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(
      screen.getByRole('treeitem', { name: 'Open post 3 by @carol' }),
    );
    expect(screen.queryByText('Loading additional posts…')).toBeNull();
  });

  it('renders honest loading, error, and empty states', () => {
    const view = renderOutline(null, null);
    expect(screen.getByText('Loading topic outline…')).toBeDefined();

    view.rerender(
      <TopicOutlineView
        model={{ ...readyModel([]), diagnosticCode: 'post-stream-not-found', state: 'error' }}
        onNavigatePost={() => undefined}
        onSelectPost={() => undefined}
        range={null}
      />,
    );
    expect(screen.getByText('Topic outline unavailable.')).toBeDefined();

    view.rerender(
      <TopicOutlineView
        model={readyModel([])}
        onNavigatePost={() => undefined}
        onSelectPost={() => undefined}
        range={null}
      />,
    );
    expect(screen.getByText('No loaded posts to outline.')).toBeDefined();
  });
});

function renderOutline(
  model: TopicOutlineModel | null,
  topicRange: TopicMinimapRange | null,
  callbacks: {
    readonly onNavigatePost?: (postId: number) => void;
    readonly onSelectPost?: (postId: number) => void;
  } = {},
) {
  return render(
    <TopicOutlineView
      model={model}
      onNavigatePost={callbacks.onNavigatePost ?? (() => undefined)}
      onSelectPost={callbacks.onSelectPost ?? (() => undefined)}
      range={topicRange}
    />,
  );
}

function readyModel(
  topicEntries: readonly TopicOutlineEntry[],
  currentPostId: number | null = null,
): TopicOutlineModel {
  const currentEntry = topicEntries.find(({ postId }) => postId === currentPostId);
  return {
    currentPosition: currentEntry
      ? {
          loadedOrder: currentEntry.loadedOrder,
          postId: currentEntry.postId,
          postNumber: currentEntry.postNumber,
          source: 'focus',
        }
      : null,
    diagnosticCode: null,
    entries: topicEntries,
    state: 'ready',
    topic: { id: 42, title: 'Synthetic topic', url: 'https://linux.do/t/synthetic-topic/42' },
  };
}

function entries(): readonly TopicOutlineEntry[] {
  return [
    {
      ...postEntry(100, 1, 'alice'),
      headings: [
        {
          id: 'post:100:heading:0',
          label: 'Heading',
          level: 2,
          source: 'linuxdo-heading',
        },
      ],
      markers: ['original-post', 'heading', 'code', 'current'],
    },
    postEntry(101, 2, 'bob'),
  ];
}

function postEntry(postId: number, postNumber: number, username: string): TopicOutlineEntry {
  return {
    author: {
      avatarUrl: null,
      displayName: username.charAt(0).toUpperCase() + username.slice(1),
      url: `https://linux.do/u/${username}`,
      username,
    },
    completeness: 'complete',
    headings: [],
    id: `post:${String(postId)}`,
    loadedOrder: postNumber - 1,
    markers: [],
    permalink:
      postNumber === 1
        ? 'https://linux.do/t/synthetic-topic/42'
        : `https://linux.do/t/synthetic-topic/42/${String(postNumber)}`,
    postId,
    postNumber,
  };
}

function range(): TopicMinimapRange {
  return {
    after: 'loading',
    before: 'complete',
    containsRequestedPost: true,
    firstPostNumber: 1,
    lastPostNumber: 2,
    loadedPostCount: 2,
    requestedPostNumber: 1,
    scope: 'loaded-window',
  };
}
