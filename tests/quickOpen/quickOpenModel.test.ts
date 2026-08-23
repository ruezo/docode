import { describe, expect, it } from 'vitest';

import type { TopicListExtraction, TopicListItem } from '../../src/linuxdo/topicListAdapter';
import { recognizeLinuxDoRoute } from '../../src/linuxdo/routes';
import { createOpenViewState, openWorkbenchView } from '../../src/navigation/openViewState';
import {
  createQuickOpenCollection,
  filterQuickOpenItems,
} from '../../src/quickOpen/quickOpenModel';
import {
  createTopicListDocument,
  type TopicListDocument,
  type TopicListRoute,
} from '../../src/views/topicList/topicListDocument';

describe('quick open model', () => {
  it('combines stable open views with real loaded topics and removes route duplicates', () => {
    let navigation = createOpenViewState(recognizeLinuxDoRoute('https://linux.do/latest'));
    navigation = openWorkbenchView(
      navigation,
      recognizeLinuxDoRoute('https://linux.do/t/first-topic/42'),
      { read: { source: 'topic-list', state: 'unread' } },
    );
    navigation = openWorkbenchView(
      navigation,
      recognizeLinuxDoRoute('https://linux.do/search?q=codex'),
    );
    const document = topicDocument('ready', [
      topic({ id: 42, title: 'First real topic' }),
      topic({ id: 43, title: 'Second real topic' }),
    ]);

    const collection = createQuickOpenCollection(navigation, document);

    expect(collection.topicState).toBe('ready');
    expect(collection.items.map(({ id, label, source }) => ({ id, label, source }))).toEqual([
      { id: 'open-view:list:latest', label: 'latest', source: 'open-view' },
      { id: 'open-view:topic:42', label: 'First real topic', source: 'open-view' },
      { id: 'open-view:search:codex', label: 'search:codex', source: 'open-view' },
      { id: 'topic-list:43', label: 'Second real topic', source: 'topic-list' },
    ]);
    expect(collection.items.filter(({ active }) => active).map(({ id }) => id)).toEqual([
      'open-view:search:codex',
    ]);
    expect(collection.items[1]).toMatchObject({
      description: 'Open view · Topic 42 · /t/first-topic/42',
      readState: 'unread',
    });
    expect(collection.items[3]).toMatchObject({
      description: 'Topic 43 · /t/topic-43/43',
      groupLabel: 'Latest Topics',
    });
  });

  it('filters case-insensitively over real labels, context, and canonical paths', () => {
    const navigation = createOpenViewState(recognizeLinuxDoRoute('https://linux.do/latest'));
    const items = createQuickOpenCollection(
      navigation,
      topicDocument('ready', [topic({ id: 43, title: 'Typed APIs on Linux' })]),
    ).items;

    expect(filterQuickOpenItems(items, '  typed api  ').map(({ id }) => id)).toEqual([
      'topic-list:43',
    ]);
    expect(filterQuickOpenItems(items, '/LATEST').map(({ id }) => id)).toEqual([
      'open-view:list:latest',
    ]);
    expect(filterQuickOpenItems(items, 'missing')).toEqual([]);
    expect(filterQuickOpenItems(items, '')).toBe(items);
  });

  it.each([
    ['loading', 'Linux DO topic suggestions are still loading.'],
    ['empty', 'Linux DO returned no topic suggestions for this view.'],
    ['error', 'Linux DO topic suggestions are unavailable.'],
  ] as const)('preserves an honest %s topic provider alongside open views', (state, message) => {
    const navigation = createOpenViewState(recognizeLinuxDoRoute('https://linux.do/latest'));
    const collection = createQuickOpenCollection(navigation, topicDocument(state));

    expect(collection.items.map(({ id }) => id)).toEqual(['open-view:list:latest']);
    expect(collection.topicState).toBe(state);
    expect(collection.topicMessage).toBe(message);
  });

  it('uses only open views when no topic document exists and excludes unsupported routes', () => {
    const unsupported = createOpenViewState(recognizeLinuxDoRoute('https://linux.do/unknown'));
    expect(createQuickOpenCollection(unsupported, null)).toEqual({
      items: [],
      topicMessage: null,
      topicState: 'unavailable',
    });

    const latest = createOpenViewState(recognizeLinuxDoRoute('https://linux.do/latest'));
    expect(createQuickOpenCollection(latest, null)).toMatchObject({
      items: [{ id: 'open-view:list:latest' }],
      topicState: 'unavailable',
    });
  });
});

function topicDocument(
  state: 'empty' | 'error' | 'loading' | 'ready',
  topics: readonly TopicListItem[] = [],
): TopicListDocument {
  let extraction: TopicListExtraction;
  switch (state) {
    case 'error':
      extraction = { code: 'topic-list-not-found', issues: [], state, topics: [] };
      break;
    case 'ready':
      extraction = { issues: [], state, topics };
      break;
    case 'empty':
    case 'loading':
      extraction = { issues: [], state, topics: [] };
      break;
  }
  return createTopicListDocument(topicListRoute(), extraction);
}

function topic(overrides: Partial<TopicListItem>): TopicListItem {
  const id = overrides.id ?? 42;
  const slug = id === 42 ? 'first-topic' : `topic-${String(id)}`;
  return {
    activity: null,
    category: null,
    completeness: 'complete',
    hasExcerpt: false,
    id,
    participants: [],
    pinned: false,
    readState: 'unknown',
    replyCount: null,
    tags: [],
    title: `Topic ${String(id)}`,
    url: `https://linux.do/t/${slug}/${String(id)}`,
    viewCount: null,
    ...overrides,
  };
}

function topicListRoute(): TopicListRoute {
  const route = recognizeLinuxDoRoute('https://linux.do/latest');
  if (route.kind !== 'topic-list') throw new Error('Expected topic-list route.');
  return route;
}
