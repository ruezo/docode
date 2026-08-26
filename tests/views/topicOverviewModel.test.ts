// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://linux.do/t/synthetic-topic/42" }

import { describe, expect, it } from 'vitest';

import type {
  NativePostContent,
  NativePostContentBlockKind,
  TopicPostAuthor,
} from '../../src/linuxdo/topicAdapter';
import type {
  TopicDetailDocument,
  TopicReplyDocumentBlock,
} from '../../src/views/topic/topicDetailDocument';
import {
  createTopicOverviewBaseModels,
  createTopicOverviewModels,
  positionTopicOverviewModels,
} from '../../src/views/topic/topicOverviewModel';

type ReadyTopicDocument = Extract<TopicDetailDocument, { readonly state: 'ready' }>;

describe('createTopicOverviewModels', () => {
  it('derives real post order, authors, headings, markers, and current position', () => {
    const author: TopicPostAuthor = {
      avatarUrl: null,
      displayName: 'Fixture Author',
      url: 'https://linux.do/u/fixture-author',
      username: 'fixture-author',
    };
    const firstContent = createContent([
      ['heading', '  Reliable   heading  ', 'h2'],
      ['paragraph', 'Body', 'p'],
      ['code', 'const value = 1;', 'pre'],
      ['media', 'Image', 'figure'],
    ]);
    const detail = readyDocument(
      42,
      [
        reply(100, 1, { author, content: firstContent }),
        reply(101, 2, { completeness: 'partial', requested: true }),
      ],
      { requestedPostNumber: 2 },
    );

    const models = createTopicOverviewModels(detail, { postId: 101, source: 'focus' });

    expect(models.outline).toMatchObject({
      currentPosition: { loadedOrder: 1, postId: 101, postNumber: 2, source: 'focus' },
      diagnosticCode: null,
      state: 'ready',
      topic: { id: 42, title: 'Topic 42' },
    });
    expect(models.outline.entries).toEqual([
      {
        author,
        completeness: 'complete',
        headings: [
          {
            id: 'post:100:heading:0',
            label: 'Reliable heading',
            level: 2,
            source: 'linuxdo-heading',
          },
        ],
        id: 'post:100',
        loadedOrder: 0,
        markers: ['original-post', 'heading', 'code', 'media'],
        permalink: 'https://linux.do/t/topic-42/42',
        postId: 100,
        postNumber: 1,
      },
      {
        author: null,
        completeness: 'partial',
        headings: [],
        id: 'post:101',
        loadedOrder: 1,
        markers: ['partial', 'requested', 'current'],
        permalink: 'https://linux.do/t/topic-42/42/2',
        postId: 101,
        postNumber: 2,
      },
    ]);
    expect(models.minimap.range).toEqual({
      after: 'complete',
      before: 'complete',
      containsRequestedPost: true,
      firstPostNumber: 1,
      lastPostNumber: 2,
      loadedPostCount: 2,
      requestedPostNumber: 2,
      scope: 'loaded-window',
    });
    expect(models.minimap.lineCount).toBe(24);
    expect(models.minimap.points.map(({ position }) => position)).toEqual([5 / 23, 17 / 23]);
    expect(models.minimap.lines[0]?.tokens.map(({ text }) => text).join('')).toBe(
      'import LinuxDo.Topic;',
    );
    expect(
      models.minimap.lines
        .find(({ id }) => id === 'topic:signature')
        ?.tokens.map(({ text }) => text)
        .join(''),
    ).toBe('public class Topic 42 {');
    expect(
      models.minimap.lines
        .find(({ id }) => id === 'post:100:signature')
        ?.tokens.map(({ text }) => text)
        .join(''),
    ).toBe('private void fixture_author_1() {');
    expect(models.minimap.lines.find(({ id }) => id === 'post:100:metadata')).toMatchObject({
      lineNumber: 7,
      tokens: [{ text: '// #1 · Fixture Author', tone: 'metadata' }],
    });
    expect(models.minimap.lines.some(({ id }) => id.endsWith(':blank'))).toBe(false);
    expect(
      models.minimap.lines.find(({ id }) => id === 'post:100:content:1')?.tokens[0]?.tone,
    ).toBe('string');
    expect(models.minimap.lines.some(({ id }) => id.endsWith(':actions'))).toBe(false);
    expect(
      models.minimap.lines.some((line) =>
        line.tokens.some(
          ({ text, tone }) => text.includes('Reliable heading') && tone === 'heading',
        ),
      ),
    ).toBe(true);
    expect(models.minimap.lines.at(-1)).toMatchObject({ lineNumber: 24, position: 1 });
    expect(
      models.minimap.lines
        .at(-1)
        ?.tokens.map(({ text }) => text)
        .join(''),
    ).toBe('}');
    expect(JSON.stringify(models)).not.toContain('element');
    expect(models.outline.entries[0]?.author).not.toBe(author);
  });

  it('annotates later original-poster replies with @Override', () => {
    const author: TopicPostAuthor = {
      avatarUrl: null,
      displayName: 'Fixture Author',
      url: 'https://linux.do/u/fixture-author',
      username: 'fixture-author',
    };
    const detail = readyDocument(42, [
      reply(100, 1, { author }),
      reply(101, 2, { author }),
      { ...reply(102, 3), replyToPostNumber: 2 },
    ]);

    const models = createTopicOverviewModels(detail, null);
    const signatureTokens = (id: string) =>
      models.minimap.lines.find((line) => line.id === id)?.tokens.map(({ text }) => text) ?? [];

    expect(signatureTokens('post:100:signature')).toEqual([
      'private void ',
      'fixture_author_1',
      '() {',
    ]);
    expect(
      models.minimap.lines
        .find(({ id }) => id === 'post:101:annotation')
        ?.tokens.map(({ text }) => text),
    ).toEqual(['@Override']);
    expect(signatureTokens('post:101:signature')).toEqual([
      'private void ',
      'fixture_author_2',
      '() {',
    ]);
    expect(signatureTokens('post:102:signature')).toEqual([
      'private Replies ',
      'post_102_3',
      '() {',
    ]);
  });

  it('models doc mode as a Markdown document with section and reply headings', () => {
    const author: TopicPostAuthor = {
      avatarUrl: null,
      displayName: 'Fixture Author',
      url: 'https://linux.do/u/fixture-author',
      username: 'fixture-author',
    };
    const detail = readyDocument(42, [
      reply(100, 1, { author }),
      reply(101, 2, { author }),
      { ...reply(102, 3), replyToPostNumber: 2 },
    ]);

    const models = createTopicOverviewBaseModels(detail, 'doc');
    const lineById = (id: string) => models.minimap.lines.find((line) => line.id === id);

    expect(models.minimap.lineCount).toBe(15);
    expect(lineById('doc:title')).toMatchObject({
      lineNumber: 1,
      tokens: [{ text: '# Topic 42', tone: 'heading' }],
    });
    expect(lineById('doc:metadata')?.lineNumber).toBe(2);
    expect(lineById('doc:metadata')?.tokens[0]?.tone).toBe('quote');
    expect(lineById('post:100:heading')).toMatchObject({
      lineNumber: 4,
      tokens: [{ text: '### 楼 1 · @fixture-author', tone: 'heading' }],
    });
    expect(lineById('post:101:section')).toMatchObject({
      lineNumber: 7,
      tokens: [{ text: '## 回复', tone: 'heading' }],
    });
    expect(lineById('post:101:heading')?.lineNumber).toBe(9);
    expect(lineById('post:102:heading')).toMatchObject({
      lineNumber: 12,
      tokens: [{ text: '### 楼 3', tone: 'heading' }],
    });
    expect(lineById('post:102:reply-target')).toMatchObject({
      lineNumber: 14,
      tokens: [{ text: '> 回复 楼 2', tone: 'quote' }],
    });
    expect(models.minimap.lines.some(({ id }) => id === 'topic:import')).toBe(false);
    expect(models.minimap.points.map(({ position }) => position)).toEqual([
      3 / 14,
      8 / 14,
      11 / 14,
    ]);
    expect(
      createTopicOverviewBaseModels(detail).minimap.lines.some(({ id }) => id === 'topic:import'),
    ).toBe(true);
  });

  it('models a long loaded window without requiring post content DOM', () => {
    const replies = Array.from({ length: 1_000 }, (_, index) => reply(10_000 + index, 101 + index));
    const detail = readyDocument(42, replies, {
      containsRequestedPost: false,
      hasMorePosts: true,
      requestedPostNumber: 2_000,
    });

    const models = createTopicOverviewModels(detail, { postId: 10_500, source: 'viewport' });

    expect(models.outline.entries).toHaveLength(1_000);
    expect(models.outline.entries.every(({ headings }) => headings.length === 0)).toBe(true);
    expect(models.minimap.points).toHaveLength(1_000);
    expect(models.minimap.lineCount).toBe(6_006);
    expect(models.minimap.lines.length).toBeLessThanOrEqual(800);
    expect(models.minimap.lines[0]?.lineNumber).toBe(1);
    expect(models.minimap.lines.at(-1)?.lineNumber).toBe(6_006);
    expect(models.minimap.points[0]?.position).toBeCloseTo(5 / 6_005);
    expect(models.minimap.points[500]?.position).toBeCloseTo(3_005 / 6_005);
    expect(models.minimap.points.at(-1)?.position).toBeCloseTo(5_999 / 6_005);
    expect(models.minimap.range).toMatchObject({
      after: 'loading',
      before: 'not-loaded',
      firstPostNumber: 101,
      lastPostNumber: 1_100,
      loadedPostCount: 1_000,
      scope: 'loaded-window',
    });
    expect(models.minimap.currentPosition).toMatchObject({
      postId: 10_500,
      postNumber: 601,
      source: 'viewport',
    });
  });

  it('keeps partial and missing-range evidence explicit without inventing current markers', () => {
    const detail = readyDocument(
      42,
      [reply(200, 21, { completeness: 'partial' }), reply(201, 22)],
      {
        containsRequestedPost: false,
        hasMorePosts: true,
        requestedPostNumber: 60,
      },
    );

    const models = createTopicOverviewModels(detail, { postId: 999, source: 'viewport' });

    expect(models.outline.currentPosition).toBeNull();
    expect(models.outline.entries[0]?.markers).toEqual(['partial']);
    expect(models.outline.entries.flatMap(({ markers }) => markers)).not.toContain('requested');
    expect(models.outline.entries.flatMap(({ markers }) => markers)).not.toContain('current');
    expect(models.minimap.range).toEqual({
      after: 'loading',
      before: 'not-loaded',
      containsRequestedPost: false,
      firstPostNumber: 21,
      lastPostNumber: 22,
      loadedPostCount: 2,
      requestedPostNumber: 60,
      scope: 'loaded-window',
    });
  });

  it('rebuilds from changing windows and topics without retaining stale positions', () => {
    const initial = readyDocument(42, [reply(100, 1), reply(101, 2)]);
    const expanded = readyDocument(42, [reply(100, 1), reply(101, 2), reply(102, 3)]);
    const changedTopic = readyDocument(43, [reply(300, 1)]);

    const initialModels = createTopicOverviewModels(initial, { postId: 101, source: 'focus' });
    const expandedModels = createTopicOverviewModels(expanded, {
      postId: 101,
      source: 'focus',
    });
    const changedModels = createTopicOverviewModels(changedTopic, {
      postId: 101,
      source: 'focus',
    });

    expect(initialModels.minimap.lineCount).toBe(18);
    expect(initialModels.minimap.points.map(({ position }) => position)).toEqual([5 / 17, 11 / 17]);
    expect(expandedModels.minimap.lineCount).toBe(24);
    expect(expandedModels.minimap.points.map(({ position }) => position)).toEqual([
      5 / 23,
      11 / 23,
      17 / 23,
    ]);
    expect(expandedModels.outline.entries[1]?.markers).toContain('current');
    expect(changedModels.outline.topic?.id).toBe(43);
    expect(changedModels.outline.entries.map(({ id }) => id)).toEqual(['post:300']);
    expect(changedModels.outline.currentPosition).toBeNull();
    expect(changedModels.minimap.points[0]?.markers).toEqual(['original-post']);
    expect(changedModels.minimap.points[0]?.position).toBe(5 / 11);
  });

  it('repositions current reply markers without rebuilding static outline or minimap content', () => {
    const detail = readyDocument(42, [reply(100, 1), reply(101, 2)]);
    const base = createTopicOverviewBaseModels(detail);
    const first = positionTopicOverviewModels(base, detail, { postId: 100, source: 'viewport' });
    const second = positionTopicOverviewModels(base, detail, { postId: 101, source: 'focus' });

    expect(first.minimap.lines).toBe(base.minimap.lines);
    expect(second.minimap.lines).toBe(base.minimap.lines);
    expect(first.outline.entries[0]?.markers).toContain('current');
    expect(first.outline.entries[1]?.markers).not.toContain('current');
    expect(second.outline.entries[0]?.markers).not.toContain('current');
    expect(second.outline.entries[1]?.markers).toContain('current');
    expect(second.minimap.currentPosition).toMatchObject({
      postId: 101,
      postNumber: 2,
      source: 'focus',
    });
  });

  it('returns bounded empty loading and error models', () => {
    const loading: TopicDetailDocument = {
      capabilities: interactionCapabilities(),
      diagnostics: {
        capabilityCodes: [],
        errorCode: null,
        issueCodes: [],
        missingPostCapabilityCount: 0,
      },
      loadedWindow: null,
      replies: [],
      route: topicRoute(42),
      state: 'loading',
      topic: null,
    };
    const error: TopicDetailDocument = {
      ...loading,
      diagnostics: { ...loading.diagnostics, errorCode: 'post-stream-not-found' },
      state: 'error',
      topic: topicHeader(42),
    };

    expect(createTopicOverviewModels(loading, null)).toMatchObject({
      minimap: { currentPosition: null, points: [], range: null, state: 'loading', topicId: null },
      outline: { currentPosition: null, entries: [], state: 'loading', topic: null },
    });
    expect(createTopicOverviewModels(error, { postId: 100, source: 'focus' })).toMatchObject({
      minimap: {
        currentPosition: null,
        diagnosticCode: 'post-stream-not-found',
        points: [],
        state: 'error',
        topicId: 42,
      },
      outline: {
        currentPosition: null,
        diagnosticCode: 'post-stream-not-found',
        entries: [],
        state: 'error',
        topic: { id: 42 },
      },
    });
  });
});

interface ReplyOptions {
  readonly author?: TopicPostAuthor;
  readonly completeness?: TopicReplyDocumentBlock['completeness'];
  readonly content?: NativePostContent;
  readonly requested?: boolean;
}

function reply(id: number, number: number, options: ReplyOptions = {}): TopicReplyDocumentBlock {
  return {
    author: options.author ?? null,
    boosts: [],
    capabilities: replyCapabilities(),
    completeness: options.completeness ?? 'complete',
    content: options.content ?? null,
    floor: { loadedOrder: 0, number, requested: options.requested ?? false },
    id,
    reactionCount: 0,
    permalink: postUrl(42, number),
    publishedAt: null,
    publishedLabel: null,
    readState: 'unknown',
    replyToPostNumber: null,
    topicId: 42,
  };
}

interface ReadyDocumentOptions {
  readonly containsRequestedPost?: boolean;
  readonly hasMorePosts?: boolean;
  readonly requestedPostNumber?: number | null;
}

function readyDocument(
  topicId: number,
  replies: readonly TopicReplyDocumentBlock[],
  options: ReadyDocumentOptions = {},
): ReadyTopicDocument {
  const normalizedReplies = replies.map((item, loadedOrder) => ({
    ...item,
    floor: { ...item.floor, loadedOrder },
    permalink: postUrl(topicId, item.floor.number),
    topicId,
  }));
  return {
    capabilities: interactionCapabilities(),
    diagnostics: {
      capabilityCodes: [],
      errorCode: null,
      issueCodes: [],
      missingPostCapabilityCount: 0,
    },
    loadedWindow: {
      containsRequestedPost: options.containsRequestedPost ?? true,
      firstPostNumber: normalizedReplies[0]?.floor.number ?? null,
      hasMorePosts: options.hasMorePosts ?? false,
      lastPostNumber: normalizedReplies.at(-1)?.floor.number ?? null,
      loadedPostCount: normalizedReplies.length,
      requestedPostNumber: options.requestedPostNumber ?? null,
    },
    replies: normalizedReplies,
    route: topicRoute(topicId),
    state: 'ready',
    topic: topicHeader(topicId),
  };
}

function createContent(
  blocks: readonly [NativePostContentBlockKind, string, keyof HTMLElementTagNameMap][],
): NativePostContent {
  const root = document.createElement('div');
  root.className = 'cooked';
  const contentBlocks = blocks.map(([kind, text, tagName]) => {
    const element = document.createElement(tagName);
    element.textContent = text;
    root.append(element);
    return { element, kind };
  });
  return { blocks: contentBlocks, root, source: 'linuxdo-owned-dom' };
}

function topicHeader(id: number): ReadyTopicDocument['topic'] {
  return {
    category: null,
    closed: false,
    id,
    pinned: false,
    tags: [],
    title: `Topic ${String(id)}`,
    url: `https://linux.do/t/topic-${String(id)}/${String(id)}`,
  };
}

function topicRoute(id: number): ReadyTopicDocument['route'] {
  return {
    hash: '',
    href: `https://linux.do/t/topic-${String(id)}/${String(id)}`,
    kind: 'topic',
    pathname: `/t/topic-${String(id)}/${String(id)}`,
    postNumber: null,
    search: '',
    topicId: id,
    topicSlug: `topic-${String(id)}`,
  };
}

function postUrl(topicId: number, postNumber: number): string {
  const base = `https://linux.do/t/topic-${String(topicId)}/${String(topicId)}`;
  return postNumber === 1 ? base : `${base}/${String(postNumber)}`;
}

function interactionCapabilities(): ReadyTopicDocument['capabilities'] {
  return {
    composer: {
      code: null,
      dirty: false,
      fallback: null,
      fullscreen: false,
      state: 'closed',
      topicId: null,
    },
    currentUserState: 'logged-in',
    diagnosticCodes: [],
    reply: { active: null, code: null, fallback: null, state: 'available' },
    state: 'ready',
  };
}

function replyCapabilities(): TopicReplyDocumentBlock['capabilities'] {
  const unavailable = {
    active: null,
    code: 'post-capability-not-found' as const,
    fallback: 'original-view' as const,
    state: 'unavailable' as const,
  };
  return { bookmark: unavailable, copyLink: unavailable, like: unavailable };
}
