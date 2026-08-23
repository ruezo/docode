// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { TopicListExtraction, TopicListItem } from '../../src/linuxdo/topicListAdapter';
import { recognizeLinuxDoRoute } from '../../src/linuxdo/routes';
import {
  TopicListEditorSurface,
  type ReadyTopicListDocument,
} from '../../src/views/topicList/TopicListDocumentView';
import {
  createTopicListDocument,
  type TopicListRoute,
} from '../../src/views/topicList/topicListDocument';

afterEach(cleanup);

describe('TopicListEditorSurface', () => {
  it('renders continuous chained source rows from real metadata', () => {
    render(
      <div data-docode-workbench-root="test">
        <div className="docode-theme-dark-modern">
          <TopicListEditorSurface
            document={readyDocument([
              topic({ id: 42, pinned: true, readState: 'unread', title: 'First topic' }),
              topic({ id: 43, completeness: 'partial', readState: 'read', title: 'Second topic' }),
            ])}
          />
        </div>
      </div>,
    );

    expect(screen.getByRole('list', { name: 'Topic list document' })).toBeDefined();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    const scaffoldLines = [
      ...screen
        .getByRole('list', { name: 'Topic list document' })
        .querySelectorAll(':scope > .docode-topic-list__document > .docode-topic-list__line'),
    ].map((row) => row.textContent);
    expect(scaffoldLines).toEqual([
      'import LinuxDo.Community;',
      '',
      'public class LinuxDo {',
      '',
      '  private final Community community = new Community();',
      '',
      '  public synchronized void init() {',
      '    // /t/topic/1/1 · pinned',
      '    community.config("真诚、友善、团结、专业")',
      '      .from("EVERYONE")',
      '      .to("LINUXDO");',
      '  }',
      '',
      '}',
    ]);
    const firstEntry = screen.getByRole('listitem', {
      name: 'Lines 14–21: First topic (pinned, unread)',
    });
    expect(
      [...firstEntry.querySelectorAll('.docode-topic-list__line')].map((row) => row.textContent),
    ).toEqual([
      '  private void @first_user() {',
      '    // /t/topic-42/42 · pinned · unread',
      '    community.post("First topic")',
      '      .at("2 hours")',
      '      .comments(12)',
      '      .views(1.2K);',
      '  }',
      '',
    ]);
    expect(
      screen
        .getByRole('listitem', { name: 'Lines 22–29: Second topic (read)' })
        .getAttribute('data-completeness'),
    ).toBe('partial');
    expect(screen.getByLabelText('Gutter slot').textContent).toBe(
      Array.from({ length: 30 }, (_, index) => index + 1).join(''),
    );
    const topicLinks = screen.getAllByRole('link', { name: /Open topic from post:/u });
    expect(screen.getAllByRole('link')).toHaveLength(10);
    expect(topicLinks[0]?.getAttribute('data-route-href')).toBe('https://linux.do/t/topic-42/42');
    expect(topicLinks[0]?.hasAttribute('href')).toBe(false);
    expect(topicLinks[0]?.getAttribute('tabindex')).toBe('0');
    expect(topicLinks[1]?.getAttribute('tabindex')).toBe('-1');
    expect(screen.getByText('// /t/topic-42/42 · pinned · unread')).toBeDefined();
    expect(screen.queryByText(/likes/u)).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('uses roving focus and requires the platform-primary modifier to open a topic', async () => {
    const user = userEvent.setup();
    const onNavigateTopic = vi.fn();
    render(
      <TopicListEditorSurface
        document={readyDocument([
          topic({ id: 42, title: 'First topic' }),
          topic({ id: 43, title: 'Second topic' }),
          topic({ id: 44, title: 'Third topic' }),
        ])}
        onNavigateTopic={onNavigateTopic}
        platform="other"
      />,
    );
    const first = screen.getByRole('link', { name: 'Open topic from post: First topic' });
    const second = screen.getByRole('link', { name: 'Open topic from post: Second topic' });
    const third = screen.getByRole('link', { name: 'Open topic from post: Third topic' });

    first.focus();
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(second);
    expect(second.getAttribute('tabindex')).toBe('0');
    expect(first.getAttribute('tabindex')).toBe('-1');
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(third);
    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(first);
    await user.keyboard('{Enter}');
    expect(onNavigateTopic).not.toHaveBeenCalled();
    await user.keyboard('{Control>}{Enter}{/Control}');
    expect(onNavigateTopic).toHaveBeenCalledTimes(1);
    expect(onNavigateTopic).toHaveBeenLastCalledWith(expect.objectContaining({ topicId: 42 }));

    fireEvent.pointerDown(third);
    expect(third.getAttribute('tabindex')).toBe('0');
    expect(
      screen
        .getByRole('listitem', { name: 'Lines 30–37: Third topic' })
        .getAttribute('data-active'),
    ).toBe('true');
  });

  it('opens only on the exact platform modifier and prevents native tab navigation', () => {
    const onNavigateTopic = vi.fn();
    render(
      <TopicListEditorSurface
        document={readyDocument([topic({ id: 42 })])}
        onNavigateTopic={onNavigateTopic}
        platform="mac"
      />,
    );
    const link = screen.getByRole('link', { name: 'Open topic from post: Topic 42' });
    let defaultPrevented: boolean | null = null;
    const observeClick = (event: MouseEvent) => {
      defaultPrevented = event.defaultPrevented;
      event.preventDefault();
    };
    document.addEventListener('click', observeClick);

    fireEvent.click(link);
    expect(defaultPrevented).toBe(true);
    expect(onNavigateTopic).not.toHaveBeenCalled();

    fireEvent.click(link, { ctrlKey: true });
    expect(onNavigateTopic).not.toHaveBeenCalled();

    fireEvent.click(link, { metaKey: true });

    expect(defaultPrevented).toBe(true);
    expect(onNavigateTopic).toHaveBeenCalledTimes(1);
    document.removeEventListener('click', observeClick);
  });

  it('keeps the fixed gutter synchronized with editor scrolling', () => {
    const { container } = render(
      <TopicListEditorSurface document={readyDocument([topic({ id: 42 })])} />,
    );
    const scroll = screen.getByRole('list', { name: 'Topic list document' });
    Object.defineProperty(scroll, 'scrollTop', { configurable: true, value: 96 });

    fireEvent.scroll(scroll);

    const gutterContent = container.querySelector<HTMLElement>(
      '.docode-topic-list__gutter-content',
    );
    if (!gutterContent) throw new Error('Expected the topic-list gutter content.');
    expect(gutterContent.style.transform).toBe('translate3d(0, -96px, 0)');
  });

  it('requests another real page only when scrolling near the document end', () => {
    const onRequestMoreTopics = vi.fn();
    const { rerender } = render(
      <TopicListEditorSurface
        document={readyDocument([topic({ id: 42 })])}
        hasMoreTopics
        onRequestMoreTopics={onRequestMoreTopics}
      />,
    );
    const scroll = screen.getByRole('list', { name: 'Topic list document' });
    Object.defineProperties(scroll, {
      clientHeight: { configurable: true, value: 400 },
      scrollHeight: { configurable: true, value: 1_200 },
      scrollTop: { configurable: true, writable: true, value: 300 },
    });

    fireEvent.scroll(scroll);
    expect(onRequestMoreTopics).not.toHaveBeenCalled();

    scroll.scrollTop = 500;
    fireEvent.scroll(scroll);
    expect(onRequestMoreTopics).toHaveBeenCalledOnce();

    rerender(
      <TopicListEditorSurface
        document={readyDocument([topic({ id: 42 })])}
        hasMoreTopics
        loadingMoreTopics
        onRequestMoreTopics={onRequestMoreTopics}
      />,
    );
    fireEvent.scroll(scroll);
    expect(onRequestMoreTopics).toHaveBeenCalledOnce();
  });

  it('renders a bounded long document with stable topic identities', () => {
    const topics = Array.from({ length: 250 }, (_, index) =>
      topic({ id: index + 1, title: `Topic ${String(index + 1)}` }),
    );

    render(<TopicListEditorSurface document={readyDocument(topics)} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(250);
    expect(
      screen.getByRole('list', { name: 'Topic list document' }).getAttribute('data-line-count'),
    ).toBe('2014');
    expect(
      screen
        .getByRole('listitem', { name: 'Lines 2006–2013: Topic 250' })
        .getAttribute('data-topic-id'),
    ).toBe('250');
  });
});

function readyDocument(topics: readonly TopicListItem[]): ReadyTopicListDocument {
  const extraction: TopicListExtraction = { issues: [], state: 'ready', topics };
  return createTopicListDocument(topicListRoute(), extraction) as ReadyTopicListDocument;
}

function topic(overrides: Partial<TopicListItem>): TopicListItem {
  const id = overrides.id ?? 42;
  return {
    activity: {
      label: '2 hours',
      lastPostNumber: 4,
      timestamp: '2026-08-18T00:00:00.000Z',
      url: `https://linux.do/t/topic-${String(id)}/${String(id)}/4`,
    },
    category: {
      id: 4,
      name: 'Develop',
      slug: 'develop',
      url: 'https://linux.do/c/develop/4',
    },
    completeness: 'complete',
    hasExcerpt: false,
    id,
    participants: [
      {
        isLatestPoster: false,
        isOriginalPoster: true,
        url: 'https://linux.do/u/first-user',
        username: 'first-user',
      },
      {
        isLatestPoster: true,
        isOriginalPoster: false,
        url: 'https://linux.do/u/last-user',
        username: 'last-user',
      },
    ],
    pinned: false,
    readState: 'unknown',
    replyCount: { precision: 'exact', value: 12 },
    tags: [
      {
        id: 7,
        name: 'Testing',
        slug: 'testing',
        url: 'https://linux.do/tag/testing/7',
      },
    ],
    title: `Topic ${String(id)}`,
    url: `https://linux.do/t/topic-${String(id)}/${String(id)}`,
    viewCount: { precision: 'compact', value: 1200 },
    ...overrides,
  };
}

function topicListRoute(): TopicListRoute {
  const route = recognizeLinuxDoRoute('https://linux.do/latest');
  if (route.kind !== 'topic-list') throw new Error('Expected a topic-list route.');
  return route;
}
