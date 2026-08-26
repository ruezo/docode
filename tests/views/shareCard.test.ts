// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://linux.do/t/synthetic-topic/42" }

import { describe, expect, it } from 'vitest';

import type { NativePostContent } from '../../src/linuxdo/topicAdapter';
import type { TopicReplyDocumentBlock } from '../../src/views/topic/topicDetailDocument';
import {
  createShareCardModel,
  SHARE_CARD_MAX_CONTENT_LINES,
} from '../../src/views/topic/shareCard';

const TEXT_BLOCK_POST_ID = 1;

describe('createShareCardModel', () => {
  it('builds a root-reply card with signature, metadata, builder body, save, and close', () => {
    const model = createShareCardModel({
      annotated: false,
      reply: createReply({
        content: createContent('<p>One</p><p>Two</p>'),
        id: TEXT_BLOCK_POST_ID,
      }),
      startLine: 8,
    });

    expect(model.fileName).toBe('Ander.java');
    expect(model.avatarUrl).toBeNull();
    expect(model.permalinkLabel).toBe('linux.do/t/synthetic-topic/42/5');
    expect(model.truncatedLineCount).toBe(0);
    expect(model.lines.map(({ number }) => number)).toEqual([8, 9, 10, 11, 12, 13, 14, 15]);
    expect(model.lines.map((line) => line.segments.map(({ text }) => text).join(''))).toEqual([
      'private void Ander() {',
      '// #5 · Ander · 3 days ago · ✦ 12',
      'String content = """ One',
      'Two """;',
      'Replies reply = new Replies();',
      'reply.content(content);',
      'save(reply);',
      '}',
    ]);
    expect(model.lines[0]?.segments.map(({ tone }) => tone)).toEqual([
      'declaration',
      'declaration',
      'method',
      'punctuation',
    ]);
    expect(model.lines[2]?.segments.map(({ tone }) => tone)).toEqual([
      'declaration',
      'plain',
      'string',
    ]);
    expect(model.lines[4]?.segments.map(({ tone }) => tone)).toEqual([
      'keyword',
      'plain',
      'keyword',
      'plain',
      'keyword',
      'punctuation',
    ]);
    expect(model.lines[5]?.segments.map(({ tone }) => tone)).toEqual([
      'plain',
      'variable',
      'punctuation',
    ]);
  });

  it('tokenizes single-line replies as a string argument to reply.content', () => {
    const model = createShareCardModel({
      annotated: false,
      reply: createReply({ content: createContent('<p>Hi</p>'), id: TEXT_BLOCK_POST_ID }),
      startLine: 4,
    });

    const contentLine = model.lines.find((line) =>
      line.segments.some(({ text }) => text.includes('"Hi"')),
    );
    if (!contentLine) throw new Error('Expected a reply.content line.');
    expect(contentLine.segments.map(({ text, tone }) => `${tone}:${text}`)).toEqual([
      'plain:reply.content(',
      'string:"Hi"',
      'punctuation:);',
    ]);
  });

  it('renders reply-target posts with @Override, Replies signature, and a return statement', () => {
    const model = createShareCardModel({
      annotated: true,
      reply: createReply({
        content: createContent('<p>Nice</p>'),
        id: TEXT_BLOCK_POST_ID,
        replyToPostNumber: 2,
      }),
      startLine: 20,
    });

    const texts = model.lines.map((line) => line.segments.map(({ text }) => text).join(''));
    expect(texts[0]).toBe('@Override');
    expect(texts[1]).toBe('private Replies Ander() {');
    expect(texts.at(-2)).toBe('return #2;');
    expect(texts.at(-1)).toBe('}');
  });

  it('caps long bodies and keeps the closing lines on their real document numbers', () => {
    const paragraphs = Array.from(
      { length: 40 },
      (_, index) => `<p>Line ${String(index + 1)}</p>`,
    ).join('');
    const model = createShareCardModel({
      annotated: false,
      reply: createReply({ content: createContent(paragraphs), id: TEXT_BLOCK_POST_ID }),
      startLine: 1,
    });

    const contentLines = model.lines.length - 4;
    expect(contentLines).toBe(SHARE_CARD_MAX_CONTENT_LINES);
    expect(model.truncatedLineCount).toBeGreaterThan(0);
    const truncation = model.lines.at(-3);
    expect(truncation?.segments[0]?.text).toContain('more lines — read on linux.do');
    const close = model.lines.at(-1);
    const save = model.lines.at(-2);
    if (!close || !save || !truncation) throw new Error('Expected trailing lines.');
    expect(save.number).toBe(truncation.number + model.truncatedLineCount);
    expect(close.number).toBe(save.number + 1);
  });
});

function createReply(overrides: {
  readonly content: NativePostContent | null;
  readonly id: number;
  readonly replyToPostNumber?: number | null;
}): TopicReplyDocumentBlock {
  return {
    author: {
      avatarUrl: null,
      displayName: 'Ander',
      url: 'https://linux.do/u/ander',
      username: 'Ander',
    },
    boosts: [],
    capabilities: {
      bookmark: { active: false, state: 'available' },
      copyLink: { state: 'available' },
      like: { active: false, state: 'available' },
      reply: { state: 'available' },
    },
    completeness: 'complete',
    content: overrides.content,
    floor: { loadedOrder: 5, number: 5, requested: false },
    id: overrides.id,
    permalink: 'https://linux.do/t/synthetic-topic/42/5',
    publishedAt: '2026-08-23T00:00:00Z',
    publishedLabel: '3 days ago',
    reactionCount: 12,
    readState: 'read',
    replyToPostNumber: overrides.replyToPostNumber ?? null,
    topicId: 42,
  } as unknown as TopicReplyDocumentBlock;
}

function createContent(markup: string): NativePostContent {
  const root = document.createElement('div');
  root.className = 'cooked';
  root.innerHTML = markup.trim().replace(/\n\s+/g, '');
  const blocks = Array.from(root.children)
    .filter((element): element is HTMLElement => element instanceof HTMLElement)
    .map((element) => ({ element, kind: 'paragraph' as const }));
  return { blocks, root, source: 'linuxdo-owned-dom' };
}
