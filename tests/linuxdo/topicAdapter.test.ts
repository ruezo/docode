// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://linux.do/" }

import { afterEach, describe, expect, it } from 'vitest';

import {
  associateTopicSnapshotPost,
  extractTopic,
  summarizeTopicExtraction,
} from '../../src/linuxdo/topicAdapter';
import { recognizeLinuxDoRoute } from '../../src/linuxdo/routes';

afterEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  window.history.replaceState({}, '', '/');
});

describe('extractTopic', () => {
  it('extracts topic metadata and ordered posts while preserving native rich content', () => {
    setDocumentUrl('/t/synthetic-topic/42/7');
    document.body.innerHTML = topicFixture(
      `${postFixture({ id: 100, number: 1, unread: true })}${postFixture({ id: 106, number: 7 })}`,
      { loading: true },
    );
    const contentRoot = document.querySelector<HTMLElement>('#post_1 .cooked');
    if (!contentRoot) throw new Error('Expected the synthetic cooked content.');
    const contentBeforeExtraction = contentRoot.innerHTML;

    const result = extractTopic(document, recognizeLinuxDoRoute(window.location.href));

    expect(result).toMatchObject({
      containsRequestedPost: true,
      hasMorePosts: true,
      issues: [],
      requestedPostNumber: 7,
      state: 'ready',
      topic: {
        category: {
          id: 4,
          name: 'Develop',
          slug: 'develop',
          url: 'https://linux.do/c/develop/4',
        },
        closed: true,
        id: 42,
        pinned: true,
        tags: [
          {
            id: 7,
            name: 'Testing',
            slug: 'testing',
            url: 'https://linux.do/tag/testing/7',
          },
        ],
        title: 'Synthetic topic',
        url: 'https://linux.do/t/synthetic-topic/42',
      },
    });
    if (result.state !== 'ready') throw new Error('Expected a ready topic extraction.');
    expect(
      result.posts.map(({ id, number, loadedOrder }) => ({ id, number, loadedOrder })),
    ).toEqual([
      { id: 100, loadedOrder: 0, number: 1 },
      { id: 106, loadedOrder: 1, number: 7 },
    ]);
    expect(result.posts.map(({ readState }) => readState)).toEqual(['unread', 'unknown']);
    expect(result.posts[0]).toMatchObject({
      author: {
        avatarUrl: 'https://linux.do/user_avatar/linux.do/first-user/48/1.png',
        displayName: 'First User',
        url: 'https://linux.do/u/first-user',
        username: 'first-user',
      },
      completeness: 'complete',
      permalink: 'https://linux.do/t/synthetic-topic/42',
      publishedAt: '2023-11-14T22:13:20.000Z',
      publishedLabel: 'November 14, 2023',
    });
    expect(result.posts[0]?.content?.root).toBe(contentRoot);
    expect(result.posts[0]?.content?.source).toBe('linuxdo-owned-dom');
    expect(result.posts[0]?.content?.blocks.map(({ kind }) => kind)).toEqual([
      'heading',
      'paragraph',
      'list',
      'quote',
      'code',
      'media',
    ]);
    expect(Object.keys(result.posts[0]?.content ?? {})).toEqual(['blocks', 'root', 'source']);
    expect(contentRoot.innerHTML).toBe(contentBeforeExtraction);
    expect(contentRoot.querySelector('a')?.getAttribute('href')).toBe(
      'https://example.com/reference',
    );
    expect(contentRoot.querySelector('img')?.getAttribute('src')).toBe('/uploads/synthetic.png');
  });

  it('reports partial posts independently without discarding readable neighbors', () => {
    setDocumentUrl('/t/synthetic-topic/42');
    document.body.innerHTML = topicFixture(`
      ${postFixture({ id: 100, number: 1 })}
      <div data-post-number="2">
        <article id="post_2" data-post-id="101">
          <a class="post-date" href="/t/synthetic-topic/42/2">Second post</a>
        </article>
      </div>
    `);

    const result = extractTopic(document, recognizeLinuxDoRoute(window.location.href));

    expect(result).toMatchObject({
      issues: [
        { code: 'missing-post-author', postIndex: 1 },
        { code: 'missing-post-content', postIndex: 1 },
      ],
      state: 'ready',
      posts: [
        { completeness: 'complete', number: 1 },
        { completeness: 'partial', number: 2 },
      ],
    });
    expect(summarizeTopicExtraction(result)).toMatchObject({
      partialPostCount: 1,
      postCount: 2,
      issueCodes: ['missing-post-author', 'missing-post-content'],
    });
  });

  it('isolates malformed, foreign, and duplicate post identities with bounded issues', () => {
    setDocumentUrl('/t/synthetic-topic/42');
    document.body.innerHTML = topicFixture(`
      ${postFixture({ id: 100, number: 1 })}
      ${postFixture({ id: 101, number: 2, permalink: 'https://example.com/t/topic/42/2' })}
      ${postFixture({ id: 102, number: 3, permalink: '/t/other-topic/43/3' })}
      ${postFixture({ id: 100, number: 1 })}
      <div data-post-number="5"><article data-post-id="invalid"></article></div>
    `);

    const result = extractTopic(document, recognizeLinuxDoRoute(window.location.href));

    expect(result).toMatchObject({
      issues: [
        { code: 'missing-post-permalink', postIndex: 1 },
        { code: 'missing-post-permalink', postIndex: 2 },
        { code: 'duplicate-post', postIndex: 3 },
        { code: 'missing-post-identity', postIndex: 4 },
      ],
      state: 'ready',
      posts: [{ id: 100, number: 1 }],
    });
    expect(JSON.stringify(result.issues)).not.toContain('example.com');
  });

  it('distinguishes loading and bounded compatibility failures', () => {
    setDocumentUrl('/t/synthetic-topic/42');
    document.body.innerHTML = '<main aria-busy="true"></main>';
    expect(extractTopic(document, recognizeLinuxDoRoute(window.location.href))).toEqual({
      issues: [],
      posts: [],
      state: 'loading',
      topic: null,
    });

    document.body.innerHTML = '<main>Changed topic markup</main>';
    expect(extractTopic(document, recognizeLinuxDoRoute(window.location.href))).toMatchObject({
      code: 'topic-metadata-not-found',
      state: 'error',
    });

    document.body.innerHTML = topicFixture('');
    expect(extractTopic(document, recognizeLinuxDoRoute(window.location.href))).toMatchObject({
      code: 'post-stream-unreadable',
      state: 'error',
      topic: { id: 42 },
    });

    expect(extractTopic(document, recognizeLinuxDoRoute('https://linux.do/latest'))).toMatchObject({
      code: 'unsupported-route',
      state: 'error',
    });
  });

  it('ignores stale loading markers retained inside a durable topic snapshot', () => {
    setDocumentUrl('/t/synthetic-topic/42');
    document.body.innerHTML = `<main>
      <div class="title-wrapper">
        <h1 data-topic-id="42"><a class="fancy-title" href="/t/synthetic-topic/42">Synthetic topic</a></h1>
      </div>
      <div class="post-stream">${postFixture({ id: 100, number: 1 })}</div>
      <section data-docode-topic-json-source hidden>
        <h1 data-topic-id="42"><a class="fancy-title" href="/t/synthetic-topic/42">Synthetic topic</a></h1>
        <div class="post-stream">
          ${postFixture({ id: 100, number: 1 })}
          <div class="topic-post-loading"><span class="spinner"></span></div>
        </div>
      </section>
    </main>`;

    expect(extractTopic(document, recognizeLinuxDoRoute(window.location.href))).toMatchObject({
      hasMorePosts: false,
      state: 'ready',
    });
  });

  it('selects route-matching metadata and post streams while stale SPA DOM still exists', () => {
    setDocumentUrl('/t/synthetic-topic/42');
    document.body.innerHTML = `<main>
      <h1 data-topic-id="41"><a class="fancy-title" href="/t/stale-topic/41">Stale topic</a></h1>
      <div class="post-stream"><div data-post-number="1"><article data-post-id="90">
        <a class="post-date" href="/t/stale-topic/41">Stale post</a>
      </article></div></div>
      <h1 data-topic-id="42"><a class="fancy-title" href="/t/synthetic-topic/42">Current topic</a></h1>
      <div class="post-stream">${postFixture({ id: 100, number: 1 })}</div>
    </main>`;

    const result = extractTopic(document, recognizeLinuxDoRoute(window.location.href));

    expect(result).toMatchObject({
      posts: [{ id: 100, number: 1 }],
      state: 'ready',
      topic: { id: 42, title: 'Current topic' },
    });
  });

  it('prefers a fresher native stream when a durable snapshot has fewer replies', () => {
    setDocumentUrl('/t/synthetic-topic/42');
    document.body.innerHTML = `<main>
      <div class="title-wrapper">
        <h1 data-topic-id="42"><a class="fancy-title" href="/t/synthetic-topic/42">Current topic</a></h1>
      </div>
      <div class="post-stream">
        ${postFixture({ id: 100, number: 1 })}
        ${postFixture({ id: 101, number: 2 })}
      </div>
      <section data-docode-topic-json-source>
        <h1 data-topic-id="42"><a class="fancy-title" href="/t/synthetic-topic/42">Current topic</a></h1>
        <div class="post-stream">${postFixture({ id: 100, number: 1 })}</div>
      </section>
    </main>`;

    const result = extractTopic(document, recognizeLinuxDoRoute(window.location.href));

    expect(result).toMatchObject({
      posts: [
        { id: 100, number: 1 },
        { id: 101, number: 2 },
      ],
      state: 'ready',
      topic: { id: 42, title: 'Current topic' },
    });
  });

  it('keeps a contiguous durable window ahead of sparse native preloaded samples', () => {
    setDocumentUrl('/t/synthetic-topic/42');
    document.body.innerHTML = `<main>
      <div class="title-wrapper">
        <h1 data-topic-id="42"><a class="fancy-title" href="/t/synthetic-topic/42">Current topic</a></h1>
      </div>
      <div class="post-stream">
        ${postFixture({ id: 100, number: 1 })}
        ${postFixture({ id: 101, number: 2 })}
        ${postFixture({ id: 207, number: 108 })}
        ${postFixture({ id: 603, number: 504 })}
        ${postFixture({ id: 1796, number: 1697 })}
      </div>
      <section data-docode-topic-json-source>
        <h1 data-topic-id="42"><a class="fancy-title" href="/t/synthetic-topic/42">Current topic</a></h1>
        <div class="post-stream">
          ${postFixture({ id: 100, number: 1 })}
          ${postFixture({ id: 101, number: 2 })}
          ${postFixture({ id: 102, number: 3 })}
        </div>
      </section>
    </main>`;

    const result = extractTopic(document, recognizeLinuxDoRoute(window.location.href));

    expect(result).toMatchObject({
      posts: [
        { id: 100, number: 1 },
        { id: 101, number: 2 },
        { id: 102, number: 3 },
      ],
      state: 'ready',
      topic: { id: 42, title: 'Current topic' },
    });
  });

  it('prefers the durable window containing a deep-linked post over an earlier native run', () => {
    setDocumentUrl('/t/synthetic-topic/42/60');
    document.body.innerHTML = `<main>
      <div class="title-wrapper">
        <h1 data-topic-id="42"><a class="fancy-title" href="/t/synthetic-topic/42">Current topic</a></h1>
      </div>
      <div class="post-stream">
        ${Array.from({ length: 10 }, (_, index) =>
          postFixture({ id: 100 + index, number: index + 1 }),
        ).join('')}
      </div>
      <section data-docode-topic-json-source>
        <h1 data-topic-id="42"><a class="fancy-title" href="/t/synthetic-topic/42">Current topic</a></h1>
        <div class="post-stream">
          ${postFixture({ id: 159, number: 60 })}
          ${postFixture({ id: 160, number: 61 })}
        </div>
      </section>
    </main>`;

    const result = extractTopic(document, recognizeLinuxDoRoute(window.location.href));

    expect(result).toMatchObject({
      posts: [
        { id: 159, number: 60 },
        { id: 160, number: 61 },
      ],
      state: 'ready',
      topic: { id: 42, title: 'Current topic' },
    });
  });

  it('reads transient unread state from the current native owner of a durable snapshot post', () => {
    setDocumentUrl('/t/synthetic-topic/42');
    document.body.innerHTML = `<main>
      <div class="title-wrapper">
        <h1 data-topic-id="42"><a class="fancy-title" href="/t/synthetic-topic/42">Current topic</a></h1>
      </div>
      <div class="post-stream">${postFixture({ id: 100, number: 1, unread: true })}</div>
      <section data-docode-topic-json-source>
        <h1 data-topic-id="42"><a class="fancy-title" href="/t/synthetic-topic/42">Current topic</a></h1>
        <div class="post-stream">${postFixture({ id: 100, number: 1, unread: true })}</div>
      </section>
    </main>`;

    const nativeArticle = document.querySelector<HTMLElement>(
      'main > .post-stream article[data-post-id="100"]',
    );
    const snapshotArticle = document.querySelector<HTMLElement>(
      '[data-docode-topic-json-source] article[data-post-id="100"]',
    );
    if (!nativeArticle || !snapshotArticle) {
      throw new Error('Expected native and snapshot post owners.');
    }
    associateTopicSnapshotPost(snapshotArticle, nativeArticle);

    const unreadResult = extractTopic(document, recognizeLinuxDoRoute(window.location.href));

    expect(unreadResult).toMatchObject({
      posts: [{ id: 100, number: 1, readState: 'unread' }],
      state: 'ready',
    });

    nativeArticle.querySelector('.read-state')?.classList.add('read');
    const readResult = extractTopic(document, recognizeLinuxDoRoute(window.location.href));

    expect(readResult).toMatchObject({
      posts: [{ id: 100, number: 1, readState: 'unknown' }],
      state: 'ready',
    });
  });

  it('rebinds snapshot read state to the current native article after virtualization', () => {
    setDocumentUrl('/t/synthetic-topic/42');
    document.body.innerHTML = `<main>
      <div class="title-wrapper">
        <h1 data-topic-id="42"><a class="fancy-title" href="/t/synthetic-topic/42">Current topic</a></h1>
      </div>
      <div class="post-stream">${postFixture({ id: 100, number: 1, unread: true })}</div>
      <section data-docode-topic-json-source>
        <h1 data-topic-id="42"><a class="fancy-title" href="/t/synthetic-topic/42">Current topic</a></h1>
        <div class="post-stream">${postFixture({ id: 100, number: 1, unread: true })}</div>
      </section>
    </main>`;

    const nativeArticle = document.querySelector<HTMLElement>(
      'main > .post-stream article[data-post-id="100"]',
    );
    const snapshotArticle = document.querySelector<HTMLElement>(
      '[data-docode-topic-json-source] article[data-post-id="100"]',
    );
    if (!nativeArticle || !snapshotArticle) {
      throw new Error('Expected native and snapshot post owners.');
    }
    associateTopicSnapshotPost(snapshotArticle, nativeArticle);

    nativeArticle.closest('[data-post-number]')?.remove();
    document
      .querySelector('main > .post-stream')
      ?.insertAdjacentHTML('beforeend', postFixture({ id: 100, number: 1 }));

    const readResult = extractTopic(document, recognizeLinuxDoRoute(window.location.href));
    expect(readResult).toMatchObject({
      posts: [{ id: 100, number: 1, readState: 'unknown' }],
      state: 'ready',
    });

    const currentNativeArticle = document.querySelector<HTMLElement>(
      'main > .post-stream article[data-post-id="100"]',
    );
    currentNativeArticle
      ?.querySelector('.post-infos')
      ?.insertAdjacentHTML('beforeend', '<div class="read-state" title="帖子未读"></div>');

    const unreadResult = extractTopic(document, recognizeLinuxDoRoute(window.location.href));
    expect(unreadResult).toMatchObject({
      posts: [{ id: 100, number: 1, readState: 'unread' }],
      state: 'ready',
    });
  });

  it('tracks whether a deep-linked post is present in the incrementally loaded window', () => {
    setDocumentUrl('/t/synthetic-topic/42/20');
    document.body.innerHTML = topicFixture(
      `${postFixture({ id: 108, number: 9 })}${postFixture({ id: 109, number: 10 })}`,
    );

    const result = extractTopic(document, recognizeLinuxDoRoute(window.location.href));

    expect(summarizeTopicExtraction(result)).toEqual({
      containsRequestedPost: false,
      errorCode: null,
      firstPostNumber: 9,
      hasMorePosts: false,
      issueCodes: [],
      lastPostNumber: 10,
      partialPostCount: 0,
      postCount: 2,
      requestedPostNumber: 20,
      state: 'ready',
    });
  });

  it('reads only the validated DOCode reply-floor annotation and never guesses from reply UI', () => {
    setDocumentUrl('/t/synthetic-topic/42');
    document.body.innerHTML = topicFixture(`
      ${postFixture({ id: 100, number: 1 })}
      ${postFixture({ id: 101, number: 2, replyTab: true })}
      ${postFixture({ id: 102, number: 3, replyToPostNumber: 1, replyTab: true })}
    `);

    const result = extractTopic(document, recognizeLinuxDoRoute(window.location.href));
    if (result.state !== 'ready') throw new Error('Expected readable topic replies.');
    expect(result.posts.map(({ replyToPostNumber }) => replyToPostNumber)).toEqual([null, null, 1]);
  });
});

function topicFixture(posts: string, options: { readonly loading?: boolean } = {}): string {
  return `<main>
    <div class="title-wrapper">
      <h1 data-topic-id="42"><a class="fancy-title" href="/t/synthetic-topic/42">Synthetic topic</a></h1>
      <span class="topic-status"><svg class="d-icon d-icon-lock"></svg></span>
      <span class="topic-status"><svg class="d-icon d-icon-thumbtack"></svg></span>
      <a href="/c/develop/4">Develop</a>
      <a href="/tag/testing/7">Testing</a>
    </div>
    <div class="post-stream">
      ${posts}
      ${options.loading ? '<div class="topic-post-loading"><span class="spinner"></span></div>' : ''}
    </div>
  </main>`;
}

function postFixture(options: {
  readonly id: number;
  readonly number: number;
  readonly permalink?: string;
  readonly replyTab?: boolean;
  readonly replyToPostNumber?: number;
  readonly unread?: boolean;
}): string {
  const permalink =
    options.permalink ??
    (options.number === 1
      ? '/t/synthetic-topic/42'
      : `/t/synthetic-topic/42/${String(options.number)}`);
  return `<div data-post-number="${String(options.number)}"${options.replyToPostNumber ? ` data-docode-reply-to-post-number="${String(options.replyToPostNumber)}"` : ''}>
    <article id="post_${String(options.number)}" data-post-id="${String(options.id)}" data-user-id="11">
      ${options.replyTab ? '<a class="reply-to-tab" role="button" title="Load parent post">First User</a>' : ''}
      <div class="topic-avatar"><img class="avatar" src="/user_avatar/linux.do/first-user/48/1.png" alt=""></div>
      <div class="names">
        <a href="/u/first-user" data-user-card="first-user">First User</a>
      </div>
      <a class="post-date" href="${permalink}" aria-label="November 14, 2023">
        <span class="relative-date" data-time="1700000000000">Nov 14</span>
      </a>
      <div class="topic-meta-data"><div class="post-infos">
        ${options.unread ? '<div class="read-state" title="帖子未读"></div>' : ''}
      </div></div>
      <div class="cooked">
        <h3>Section</h3>
        <p>Rich <a href="https://example.com/reference">reference</a></p>
        <ul><li>Item</li></ul>
        <aside class="quote"><div class="title">First User:</div><blockquote><p>Quote</p></blockquote></aside>
        <pre><code>const safe = true;</code></pre>
        <figure><img src="/uploads/synthetic.png" alt="Synthetic"></figure>
        <div class="cooked-selection-barrier"></div>
      </div>
    </article>
  </div>`;
}

function setDocumentUrl(pathname: string): void {
  window.history.replaceState({}, '', pathname);
}
