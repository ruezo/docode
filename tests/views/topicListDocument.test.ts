import { describe, expect, it } from 'vitest';

import type { TopicListExtraction, TopicListItem } from '../../src/linuxdo/topicListAdapter';
import { recognizeLinuxDoRoute } from '../../src/linuxdo/routes';
import {
  createTopicListDocument,
  mergeReadyTopicListDocuments,
  type TopicListRoute,
} from '../../src/views/topicList/topicListDocument';

describe('createTopicListDocument', () => {
  it('maps complete real metadata into ordered chained-source entries', () => {
    const extraction = readyExtraction([
      topic({ id: 42, title: 'First topic' }),
      topic({ id: 43, title: 'Second topic' }),
    ]);

    const document = createTopicListDocument(topicListRoute(), extraction);

    expect(document.state).toBe('ready');
    expect(document.route.href).toBe('https://linux.do/latest');
    expect(document.diagnostics).toEqual({ errorCode: null, issueCodes: [] });
    expect(document.prologue).toEqual([
      { kind: 'import', lineNumber: 1 },
      { kind: 'blank', lineNumber: 2 },
      { kind: 'class-open', lineNumber: 3 },
      { kind: 'blank', lineNumber: 4 },
      { kind: 'field', lineNumber: 5 },
      { kind: 'blank', lineNumber: 6 },
      { kind: 'init-open', lineNumber: 7 },
      { kind: 'init-comment', lineNumber: 8 },
      { kind: 'init-config', lineNumber: 9 },
      { kind: 'init-from', lineNumber: 10 },
      { kind: 'init-to', lineNumber: 11 },
      { kind: 'init-close', lineNumber: 12 },
      { kind: 'blank', lineNumber: 13 },
    ]);
    expect(
      document.lines.map(({ focus, lineNumber, topicId }) => ({ focus, lineNumber, topicId })),
    ).toEqual([
      {
        focus: { id: 'docode-topic-42', order: 0, tabIndex: 0 },
        lineNumber: 14,
        topicId: 42,
      },
      {
        focus: { id: 'docode-topic-43', order: 1, tabIndex: -1 },
        lineNumber: 22,
        topicId: 43,
      },
    ]);
    expect(document.epilogue).toEqual([{ kind: 'class-close', lineNumber: 30 }]);
    expect(document.lineCount).toBe(30);
    expect(document.lines[0]?.rows).toEqual([
      { kind: 'method-open', lineNumber: 14, name: 'first_user' },
      { kind: 'comment', lineNumber: 15 },
      {
        kind: 'signature',
        lineNumber: 16,
        terminal: false,
        title: 'First topic',
      },
      {
        kind: 'method',
        lineNumber: 17,
        method: 'at',
        terminal: false,
        value: {
          kind: 'string',
          text: '2 hours',
        },
      },
      {
        kind: 'method',
        lineNumber: 18,
        method: 'comments',
        terminal: false,
        value: {
          kind: 'number',
          precision: 'exact',
          value: 12,
        },
      },
      {
        kind: 'method',
        lineNumber: 19,
        method: 'views',
        terminal: true,
        value: {
          kind: 'number',
          precision: 'compact',
          value: 1200,
        },
      },
      { kind: 'method-close', lineNumber: 20 },
      { kind: 'blank', lineNumber: 21 },
    ]);
    expect(document.lines[0]?.tokens).toEqual([
      { kind: 'title', text: 'First topic', url: 'https://linux.do/t/first-topic/42' },
      { kind: 'category', text: 'Develop', url: 'https://linux.do/c/develop/4' },
      { kind: 'tag', text: 'Testing', url: 'https://linux.do/tag/testing/7' },
      {
        kind: 'participant',
        role: 'original',
        text: 'first-user',
        url: 'https://linux.do/u/first-user',
      },
      {
        kind: 'participant',
        role: 'latest',
        text: 'last-user',
        url: 'https://linux.do/u/last-user',
      },
      { kind: 'count', metric: 'replies', precision: 'exact', value: 12 },
      { kind: 'count', metric: 'views', precision: 'compact', value: 1200 },
      {
        kind: 'activity',
        label: '2 hours',
        lastPostNumber: 4,
        timestamp: '2026-08-18T00:00:00.000Z',
        url: 'https://linux.do/t/first-topic/42/4',
      },
    ]);
  });

  it('preserves unread, new, read, pinned, and unknown states without inferring them', () => {
    const extraction = readyExtraction([
      topic({ id: 50, pinned: true, readState: 'unread' }),
      topic({ id: 51, readState: 'new' }),
      topic({ id: 52, readState: 'read' }),
      topic({ id: 53, readState: 'unknown' }),
    ]);

    const document = createTopicListDocument(topicListRoute(), extraction);

    expect(document.lines.map(({ markers, readState }) => ({ markers, readState }))).toEqual([
      { markers: ['pinned', 'unread'], readState: 'unread' },
      { markers: ['new'], readState: 'new' },
      { markers: ['read'], readState: 'read' },
      { markers: [], readState: 'unknown' },
    ]);
  });

  it('keeps partial topics navigable without inventing missing metadata tokens', () => {
    const partial = topic({
      activity: null,
      category: null,
      completeness: 'partial',
      id: 60,
      participants: [],
      replyCount: null,
      tags: [],
      title: 'Partial topic',
      url: 'https://linux.do/t/partial-topic/60',
      viewCount: null,
    });
    const extraction: TopicListExtraction = {
      issues: [{ code: 'missing-activity', rowIndex: 0 }],
      state: 'ready',
      topics: [partial],
    };

    const document = createTopicListDocument(topicListRoute(), extraction);

    expect(document.diagnostics.issueCodes).toEqual(['missing-activity']);
    expect(document.lines[0]).toMatchObject({
      completeness: 'partial',
      rows: [
        { kind: 'method-open', lineNumber: 14, name: 'topic_60' },
        { kind: 'comment', lineNumber: 15 },
        {
          kind: 'signature',
          lineNumber: 16,
          terminal: true,
          title: 'Partial topic',
        },
        { kind: 'method-close', lineNumber: 17 },
        { kind: 'blank', lineNumber: 18 },
      ],
      tokens: [
        {
          kind: 'title',
          text: 'Partial topic',
          url: 'https://linux.do/t/partial-topic/60',
        },
      ],
      url: 'https://linux.do/t/partial-topic/60',
    });
    expect(document.lineCount).toBe(19);
  });

  it('deduplicates appended pages and rebases their source lines continuously', () => {
    const route = topicListRoute();
    const first = createTopicListDocument(
      route,
      readyExtraction([topic({ id: 42 }), topic({ id: 43 })]),
    );
    const appended = createTopicListDocument(
      route,
      readyExtraction([topic({ id: 43 }), topic({ id: 44 })]),
    );
    if (first.state !== 'ready' || appended.state !== 'ready') {
      throw new Error('Expected ready topic-list documents.');
    }

    const merged = mergeReadyTopicListDocuments(
      first as typeof first & { readonly state: 'ready' },
      appended as typeof appended & { readonly state: 'ready' },
    );

    expect(merged.lines.map(({ lineNumber, topicId }) => ({ lineNumber, topicId }))).toEqual([
      { lineNumber: 14, topicId: 42 },
      { lineNumber: 22, topicId: 43 },
      { lineNumber: 30, topicId: 44 },
    ]);
    expect(merged.lines[2]?.rows.map(({ lineNumber }) => lineNumber)).toEqual([
      30, 31, 32, 33, 34, 35, 36, 37,
    ]);
    expect(merged.epilogue).toEqual([{ kind: 'class-close', lineNumber: 38 }]);
    expect(merged.lineCount).toBe(38);
  });

  it.each([
    [{ issues: [], state: 'loading', topics: [] }, 'loading', null],
    [{ issues: [], state: 'empty', topics: [] }, 'empty', null],
    [
      {
        code: 'topic-list-not-found',
        issues: [],
        state: 'error',
        topics: [],
      },
      'error',
      'topic-list-not-found',
    ],
  ] as const)('preserves %s without creating document lines', (extraction, state, errorCode) => {
    const document = createTopicListDocument(topicListRoute(), extraction);

    expect(document.state).toBe(state);
    expect(document.lines).toEqual([]);
    expect(document.prologue).toEqual([]);
    expect(document.epilogue).toEqual([]);
    expect(document.lineCount).toBe(0);
    expect(document.diagnostics.errorCode).toBe(errorCode);
  });
});

function topic(overrides: Partial<TopicListItem>): TopicListItem {
  const id = overrides.id ?? 42;
  const slug = id === 42 ? 'first-topic' : `topic-${String(id)}`;
  return {
    activity: {
      label: '2 hours',
      lastPostNumber: 4,
      timestamp: '2026-08-18T00:00:00.000Z',
      url: `https://linux.do/t/${slug}/${String(id)}/4`,
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
    url: `https://linux.do/t/${slug}/${String(id)}`,
    viewCount: { precision: 'compact', value: 1200 },
    ...overrides,
  };
}

function readyExtraction(topics: readonly TopicListItem[]): TopicListExtraction {
  return { issues: [], state: 'ready', topics };
}

function topicListRoute(): TopicListRoute {
  const route = recognizeLinuxDoRoute('https://linux.do/latest');
  if (route.kind !== 'topic-list') throw new Error('Expected a topic-list route.');
  return route;
}
