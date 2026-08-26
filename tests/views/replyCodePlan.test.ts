// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://linux.do/t/synthetic-topic/42" }

import { describe, expect, it } from 'vitest';

import type { NativePostContent } from '../../src/linuxdo/topicAdapter';
import {
  countReplyCodeContentLines,
  createReplyCodePlan,
  REPLY_CONTENT_FOLD_LIMIT,
  resolveReplyCodeRegion,
  resolveReplyContentStyle,
  summarizeReplyCodeLines,
} from '../../src/views/topic/replyCodePlan';

const TEXT_BLOCK_POST_ID = 1;
const COMMENT_POST_ID = 3;

describe('replyCodePlan', () => {
  it('keeps the content style deterministic per post at roughly a 7:3 split', () => {
    let textBlockCount = 0;
    for (let postId = 1; postId <= 1_000; postId += 1) {
      const style = resolveReplyContentStyle(postId, 4);
      expect(style).toBe(resolveReplyContentStyle(postId, 4));
      if (style === 'text-block') textBlockCount += 1;
    }
    expect(textBlockCount).toBeGreaterThan(620);
    expect(textBlockCount).toBeLessThan(780);
    expect(resolveReplyContentStyle(TEXT_BLOCK_POST_ID, 4)).toBe('text-block');
    expect(resolveReplyContentStyle(COMMENT_POST_ID, 4)).toBe('comment');
    expect(resolveReplyContentStyle(COMMENT_POST_ID, 1)).toBe('single');
    expect(resolveReplyContentStyle(TEXT_BLOCK_POST_ID, 0)).toBe('single');
  });

  it('classifies oneboxes, image blocks, and standalone links as builder assets', () => {
    const content = createContent(`
      <p>First paragraph</p>
      <aside class="onebox githubrepo" data-onebox-src="https://github.com/discourse/discourse">
        <header class="source"><a href="https://github.com/discourse/discourse">GitHub</a></header>
        <article class="onebox-body"><h3><a href="https://github.com/discourse/discourse">discourse</a></h3></article>
      </aside>
      <aside class="onebox" data-onebox-src="https://example.com/article">
        <article class="onebox-body"><h3><a href="https://example.com/article">Article</a></h3></article>
      </aside>
      <p><img src="/uploads/shot.png" alt="shot.png"></p>
      <p><a href="https://example.com/page">https://example.com/page</a></p>
      <p><a class="mention" href="/u/neo">@neo</a></p>
      <p>Read <a href="https://example.com/inline">this</a> today</p>
    `);
    const plan = createReplyCodePlan(content, TEXT_BLOCK_POST_ID);
    if (!plan) throw new Error('Expected a plan.');
    expect(plan.assets.map(({ kind }) => kind)).toEqual(['github', 'link', 'image', 'link']);
    expect(plan.textLineCount).toBe(3);
    expect(plan.style).toBe('text-block');
  });

  it('counts text-block regions with inline declarations plus builder scaffolding', () => {
    const content = createContent('<p>One</p><p>Two</p><p><img src="/a.png" alt="a"></p>');
    const plan = createReplyCodePlan(content, TEXT_BLOCK_POST_ID);
    if (!plan) throw new Error('Expected a plan.');
    expect(plan.style).toBe('text-block');
    const region = resolveReplyCodeRegion(plan, false);
    expect(region.declOpenInline).toBe(true);
    expect(region.declCloseInline).toBe(true);
    expect(region.contentCallLine).toBe(true);
    // 2 text + new Replies + 1 asset + reply.content(content)
    expect(region.lineCount).toBe(5);
    expect(countReplyCodeContentLines(content, TEXT_BLOCK_POST_ID, false)).toBe(5);
  });

  it('adds standalone declaration lines when the boundary blocks cannot carry markers', () => {
    const content = createContent('<pre>first</pre><p>middle</p><pre>last</pre>');
    const plan = createReplyCodePlan(content, TEXT_BLOCK_POST_ID);
    if (!plan) throw new Error('Expected a plan.');
    const region = resolveReplyCodeRegion(plan, false);
    expect(region.declOpenInline).toBe(false);
    expect(region.declCloseInline).toBe(false);
    // 3 text + open + close + new Replies + reply.content(content)
    expect(region.lineCount).toBe(7);
  });

  it('wraps comment-style posts with javadoc lines and no content call', () => {
    const content = createContent('<p>One</p><p>Two</p>');
    const plan = createReplyCodePlan(content, COMMENT_POST_ID);
    if (!plan) throw new Error('Expected a plan.');
    expect(plan.style).toBe('comment');
    const region = resolveReplyCodeRegion(plan, false);
    expect(region.contentCallLine).toBe(false);
    // /** + 2 text + */ + new Replies
    expect(region.lineCount).toBe(5);
  });

  it('renders single-line posts as one reply.content call', () => {
    const content = createContent('<p>只有一行</p>');
    const plan = createReplyCodePlan(content, COMMENT_POST_ID);
    if (!plan) throw new Error('Expected a plan.');
    expect(plan.style).toBe('single');
    expect(resolveReplyCodeRegion(plan, false).lineCount).toBe(2);
    expect(countReplyCodeContentLines(null, COMMENT_POST_ID, false)).toBe(1);
  });

  it('folds content beyond the limit at element boundaries and expands on demand', () => {
    const paragraphs = Array.from({ length: 9 }, (_, index) => `<p>Line ${String(index)}</p>`);
    const content = createContent(paragraphs.join(''));
    const plan = createReplyCodePlan(content, TEXT_BLOCK_POST_ID);
    if (!plan) throw new Error('Expected a plan.');
    expect(plan.foldable).toBe(true);
    expect(plan.textLineCount).toBe(9);
    const folded = resolveReplyCodeRegion(plan, false);
    expect(folded.visibleTextLines).toHaveLength(REPLY_CONTENT_FOLD_LIMIT);
    expect(folded.hiddenTextElements).toHaveLength(3);
    // 6 text + new Replies + reply.content(content)
    expect(folded.lineCount).toBe(8);
    const expanded = resolveReplyCodeRegion(plan, true);
    expect(expanded.visibleTextLines).toHaveLength(9);
    expect(expanded.hiddenTextElements).toHaveLength(0);
    expect(expanded.lineCount).toBe(11);
  });

  it('does not fold when a single element owns every overflowing line', () => {
    const content = createContent(`<p>${Array.from({ length: 8 }, () => 'x').join('<br>')}</p>`);
    const plan = createReplyCodePlan(content, TEXT_BLOCK_POST_ID);
    if (!plan) throw new Error('Expected a plan.');
    expect(plan.textLineCount).toBe(8);
    expect(plan.foldable).toBe(false);
  });

  it('summarizes the code region in decorated order for the minimap', () => {
    const content = createContent(
      '<p>One</p><p>Two</p><p><a href="https://github.com/a/b">https://github.com/a/b</a></p>',
    );
    const summaries = summarizeReplyCodeLines(content, TEXT_BLOCK_POST_ID, false);
    expect(summaries.map(({ text }) => text)).toEqual([
      'String content = """ One',
      'Two """;',
      'Replies reply = new Replies();',
      'reply.github(https://github.com/a/b);',
      'reply.content(content);',
    ]);
    expect(summaries[2]?.kind).toBe('scaffold');
    const single = summarizeReplyCodeLines(createContent('<p>Solo</p>'), COMMENT_POST_ID, false);
    expect(single.map(({ text }) => text)).toEqual([
      'Replies reply = new Replies();',
      'reply.content("Solo");',
    ]);
  });
});

function createContent(markup: string): NativePostContent {
  const root = document.createElement('div');
  root.className = 'cooked';
  root.innerHTML = markup.trim().replace(/\n\s+/g, '');
  const blocks = Array.from(root.children)
    .filter((element): element is HTMLElement => element instanceof HTMLElement)
    .map((element) => ({ element, kind: 'paragraph' as const }));
  return { blocks, root, source: 'linuxdo-owned-dom' };
}
