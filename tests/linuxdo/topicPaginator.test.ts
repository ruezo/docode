// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://linux.do/t/synthetic-topic/42" }

import { afterEach, describe, expect, it, vi } from 'vitest';

import { detectLinuxDoCapabilities } from '../../src/linuxdo/capabilities';
import { recognizeLinuxDoRoute } from '../../src/linuxdo/routes';
import { NativeContentTransfer } from '../../src/runtime/nativeContentTransfer';
import { extractTopic } from '../../src/linuxdo/topicAdapter';
import { LinuxDoTopicPaginator } from '../../src/linuxdo/topicPaginator';

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

afterEach(() => {
  document.body.innerHTML = '';
});

describe('LinuxDoTopicPaginator', () => {
  it('recovers a connected initial source from route-matching preloaded topic data', async () => {
    document.body.innerHTML = `<script id="data-preloaded" type="application/json"></script>`;
    const payload = {
      id: 42,
      title: 'Recovered topic',
      post_stream: {
        posts: [post(100, 1), post(101, 2, { reply_to_post_number: 1 })],
        stream: [100, 101],
      },
    };
    const registry = { topic_42: JSON.stringify(payload) };
    const preloaded = document.querySelector('#data-preloaded');
    if (!preloaded) throw new Error('Missing preloaded-state fixture.');
    preloaded.textContent = JSON.stringify(registry);
    const paginator = new LinuxDoTopicPaginator(document, { fetch: null });
    const route = topicRoute();

    await expect(paginator.loadReplyTargets(route, new AbortController().signal)).resolves.toEqual({
      annotatedPostCount: 1,
      changedPostCount: 0,
      kind: 'ready',
    });

    const extraction = extractTopic(document, route);
    expect(extraction).toMatchObject({
      posts: [
        { content: { source: 'linuxdo-same-origin-json' }, id: 100, number: 1 },
        { id: 101, number: 2, replyToPostNumber: 1 },
      ],
      state: 'ready',
      topic: { id: 42, title: 'Recovered topic' },
    });
    expect(document.querySelector('[data-docode-topic-json-source]')?.hasAttribute('hidden')).toBe(
      true,
    );

    paginator.reset();
    expect(document.querySelector('[data-docode-topic-json-source]')).toBeNull();
    expect(document.querySelector('[data-docode-paginated-post]')).toBeNull();
  });

  it('recovers the initial topic from the existing same-origin topic endpoint', async () => {
    document.body.innerHTML = '<main id="main-outlet"></main>';
    const fetch = vi.fn<FetchLike>().mockResolvedValue(
      Response.json({
        id: 42,
        title: 'Fetched topic',
        post_stream: {
          posts: [post(100, 1)],
          stream: [100],
        },
      }),
    );
    const paginator = new LinuxDoTopicPaginator(document, { fetch });
    const route = topicRoute();

    await expect(paginator.loadReplyTargets(route, new AbortController().signal)).resolves.toEqual({
      annotatedPostCount: 0,
      changedPostCount: 0,
      kind: 'ready',
    });

    expect(requestUrls(fetch)).toEqual(['https://linux.do/t/synthetic-topic/42.json']);
    expect(extractTopic(document, route)).toMatchObject({
      posts: [{ content: { source: 'linuxdo-same-origin-json' }, id: 100, number: 1 }],
      state: 'ready',
      topic: { id: 42, title: 'Fetched topic' },
    });

    paginator.dispose();
  });

  it('preserves native topic metadata in the durable pagination snapshot', async () => {
    setupTopic();
    const title = document.querySelector('main > h1');
    if (!title) throw new Error('Missing native title fixture.');
    const wrapper = document.createElement('div');
    title.before(wrapper);
    wrapper.append(title);
    wrapper.insertAdjacentHTML(
      'beforeend',
      `<span class="topic-status">
        <svg class="d-icon d-icon-lock"></svg>
        <svg class="d-icon d-icon-thumbtack"></svg>
      </span>
      <a href="/c/develop/4">Develop</a>
      <a href="/tag/testing/7">Testing</a>`,
    );
    const fetch = vi.fn<FetchLike>().mockResolvedValue(
      Response.json({
        id: 42,
        title: 'Synthetic topic',
        post_stream: { posts: [post(100, 1)], stream: [100] },
      }),
    );
    const paginator = new LinuxDoTopicPaginator(document, { fetch });
    const route = topicRoute();

    await expect(paginator.loadReplyTargets(route, new AbortController().signal)).resolves.toEqual({
      annotatedPostCount: 0,
      changedPostCount: 0,
      kind: 'ready',
    });

    expect(extractTopic(document, route)).toMatchObject({
      state: 'ready',
      topic: {
        category: { id: 4, name: 'Develop', slug: 'develop' },
        closed: true,
        pinned: true,
        tags: [{ id: 7, name: 'Testing', slug: 'testing' }],
      },
    });

    paginator.dispose();
  });

  it('does not preserve transient native loading markers in the durable snapshot', async () => {
    setupTopic();
    document
      .querySelector('.post-stream')
      ?.insertAdjacentHTML(
        'beforeend',
        '<div class="topic-post-loading"><span class="spinner"></span></div>',
      );
    const fetch = vi.fn<FetchLike>().mockResolvedValue(
      Response.json({
        id: 42,
        title: 'Synthetic topic',
        post_stream: { posts: [post(100, 1)], stream: [100] },
      }),
    );
    const paginator = new LinuxDoTopicPaginator(document, { fetch });
    const route = topicRoute();

    await expect(paginator.loadReplyTargets(route, new AbortController().signal)).resolves.toEqual({
      annotatedPostCount: 0,
      changedPostCount: 0,
      kind: 'ready',
    });

    expect(
      document.querySelector('[data-docode-topic-json-source] .topic-post-loading'),
    ).toBeNull();

    paginator.dispose();
  });

  it('loads the real topic stream, appends missing replies, and reports the end', async () => {
    setupTopic();
    const nativeContent = document.querySelector<HTMLElement>('main .post-stream .cooked');
    if (!nativeContent) throw new Error('Missing native content fixture.');
    const fetch = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(
        Response.json({ post_stream: { posts: [post(100, 1)], stream: [100, 101, 102] } }),
      )
      .mockResolvedValueOnce(
        Response.json({ post_stream: { posts: [post(101, 2), unsafePost(102, 3)] } }),
      );
    const paginator = new LinuxDoTopicPaginator(document, { fetch });
    const route = topicRoute();

    await expect(
      paginator.loadNext(route, new Set([100]), new Set(), new AbortController().signal),
    ).resolves.toEqual({ hasMore: false, kind: 'ready', loadedPostCount: 2 });

    expect(requestUrls(fetch)).toEqual([
      'https://linux.do/t/synthetic-topic/42.json',
      'https://linux.do/t/42/posts.json?post_ids%5B%5D=101&post_ids%5B%5D=102',
    ]);
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({ credentials: 'same-origin', method: 'GET' });
    expect(document.querySelectorAll('[data-docode-paginated-post]')).toHaveLength(2);
    expect(document.querySelector('[data-post-id="102"] script')).toBeNull();
    expect(document.querySelector('[data-post-id="102"] [onclick]')).toBeNull();
    expect(document.querySelector('[data-post-id="102"] .cooked a')?.hasAttribute('href')).toBe(
      false,
    );

    const extraction = extractTopic(document, route);
    expect(extraction.state).toBe('ready');
    if (extraction.state !== 'ready') throw new Error('Expected readable topic replies.');
    expect(extraction.posts.map(({ id }) => id)).toEqual([100, 101, 102]);
    expect(extraction.posts.slice(1).map(({ content }) => content?.source)).toEqual([
      'linuxdo-same-origin-json',
      'linuxdo-same-origin-json',
    ]);
    expect(extraction.posts[0]?.content?.root).not.toBe(nativeContent);
    expect(extraction.posts[0]?.content?.root.textContent).toBe(nativeContent.textContent);
    expect(
      document.querySelector('[data-docode-topic-json-source] [data-post-id="100"] .cooked')
        ?.textContent,
    ).toBe('Post 1');
    const capabilities = detectLinuxDoCapabilities(document, route);
    expect(capabilities.state).toBe('ready');
    if (capabilities.state === 'ready') expect(capabilities.posts).toHaveLength(1);
    const nativeMain = document.querySelector('main');
    const nativeStream = Array.from(nativeMain?.children ?? []).find((element) =>
      element.matches('.post-stream'),
    );
    expect(nativeStream?.querySelectorAll('article[data-post-id]')).toHaveLength(1);
    await expect(
      paginator.loadNext(route, new Set([100, 101, 102]), new Set(), new AbortController().signal),
    ).resolves.toEqual({ kind: 'complete' });

    paginator.dispose();
    expect(document.querySelectorAll('[data-docode-paginated-post]')).toHaveLength(0);
    expect(document.querySelector('[data-post-id="100"]')).not.toBeNull();
  });

  it('fills a contiguous topic window without treating remote preloaded samples as loaded pages', async () => {
    setupTopicRange(1, 3);
    document.querySelector('.post-stream')?.insertAdjacentHTML(
      'beforeend',
      `<div data-post-number="30">
        <article data-post-id="129" data-user-id="30">
          <div class="names"><a data-user-card="user-30" href="/u/user-30">User 30</a></div>
          <a class="post-date" href="/t/synthetic-topic/42/30"><span data-time="2026-08-20T12:00:00.000Z">now</span></a>
          <div class="cooked"><p>Post 30</p></div>
        </article>
      </div>`,
    );
    const postIds = Array.from({ length: 30 }, (_, index) => 100 + index);
    const fetch = vi.fn<FetchLike>().mockImplementation((input) => {
      const url = new URL(
        input instanceof URL ? input.href : typeof input === 'string' ? input : input.url,
      );
      if (url.pathname.endsWith('/posts.json')) {
        return Promise.resolve(
          Response.json({
            post_stream: {
              posts: url.searchParams.getAll('post_ids[]').map((value) => {
                const id = Number(value);
                return post(id, id - 99);
              }),
            },
          }),
        );
      }
      return Promise.resolve(
        Response.json({
          id: 42,
          title: 'Synthetic topic',
          post_stream: {
            posts: [post(100, 1), post(101, 2), post(102, 3), post(129, 30)],
            stream: postIds,
          },
        }),
      );
    });
    const paginator = new LinuxDoTopicPaginator(document, { fetch });
    const route = topicRoute();

    await expect(
      paginator.loadNext(
        route,
        new Set([100, 101, 102, 129]),
        new Set(),
        new AbortController().signal,
      ),
    ).resolves.toEqual({ hasMore: true, kind: 'ready', loadedPostCount: 20 });
    let extraction = extractTopic(document, route);
    if (extraction.state !== 'ready') throw new Error('Expected a contiguous topic snapshot.');
    expect(extraction.posts.map(({ number }) => number)).toEqual(
      Array.from({ length: 23 }, (_, index) => index + 1),
    );

    await expect(
      paginator.loadNext(
        route,
        new Set(extraction.posts.map(({ id }) => id)),
        new Set(),
        new AbortController().signal,
      ),
    ).resolves.toEqual({ hasMore: false, kind: 'ready', loadedPostCount: 7 });
    extraction = extractTopic(document, route);
    if (extraction.state !== 'ready') throw new Error('Expected the completed topic snapshot.');
    expect(extraction.posts.map(({ number }) => number)).toEqual(
      Array.from({ length: 30 }, (_, index) => index + 1),
    );
    expect(requestUrls(fetch)).toEqual([
      'https://linux.do/t/synthetic-topic/42.json',
      `https://linux.do/t/42/posts.json?${postIds
        .slice(3, 23)
        .map((id) => `post_ids%5B%5D=${String(id)}`)
        .join('&')}`,
      `https://linux.do/t/42/posts.json?${postIds
        .slice(23, 29)
        .map((id) => `post_ids%5B%5D=${String(id)}`)
        .join('&')}`,
    ]);

    paginator.dispose();
    const restored = extractTopic(document, route);
    if (restored.state !== 'ready') throw new Error('Expected restored native topic samples.');
    expect(restored.posts.map(({ number }) => number)).toEqual([1, 2, 3, 30]);
  });

  it('loads and prepends earlier replies from a partial topic window', async () => {
    setupTopicRange(18, 19);
    const postIds = Array.from({ length: 19 }, (_, index) => 100 + index);
    const fetch = vi.fn<FetchLike>().mockImplementation((input) => {
      const url = new URL(
        input instanceof URL ? input.href : typeof input === 'string' ? input : input.url,
      );
      if (url.pathname.endsWith('/posts.json')) {
        return Promise.resolve(
          Response.json({
            post_stream: {
              posts: url.searchParams.getAll('post_ids[]').map((value) => {
                const id = Number(value);
                return post(id, id - 99);
              }),
            },
          }),
        );
      }
      return Promise.resolve(
        Response.json({
          id: 42,
          title: 'Synthetic topic',
          post_stream: {
            posts: [post(117, 18), post(118, 19)],
            stream: postIds,
          },
        }),
      );
    });
    const paginator = new LinuxDoTopicPaginator(document, { fetch });
    const route = topicRoute(18);

    await expect(
      paginator.loadPrevious(route, new Set([117, 118]), new AbortController().signal),
    ).resolves.toEqual({
      hasLater: false,
      hasMore: false,
      kind: 'ready',
      loadedPostCount: 17,
    });

    expect(requestUrls(fetch)).toEqual([
      'https://linux.do/t/synthetic-topic/42.json',
      `https://linux.do/t/42/posts.json?${postIds
        .slice(0, 17)
        .map((id) => `post_ids%5B%5D=${String(id)}`)
        .join('&')}`,
    ]);
    const extraction = extractTopic(document, route);
    if (extraction.state !== 'ready') throw new Error('Expected readable earlier replies.');
    expect(extraction.posts.map(({ number }) => number)).toEqual(
      Array.from({ length: 19 }, (_, index) => index + 1),
    );
    expect(document.querySelectorAll('[data-docode-paginated-post]')).toHaveLength(17);

    await expect(
      paginator.loadPrevious(
        route,
        new Set(extraction.posts.map(({ id }) => id)),
        new AbortController().signal,
      ),
    ).resolves.toEqual({ kind: 'complete' });

    paginator.dispose();
    const restored = extractTopic(document, route);
    if (restored.state !== 'ready') throw new Error('Expected restored native topic replies.');
    expect(restored.posts.map(({ number }) => number)).toEqual([18, 19]);
  });

  it('rejects a stale topic stream before appending unrelated posts', async () => {
    setupTopic();
    const fetch = vi.fn<FetchLike>().mockResolvedValue(
      Response.json({
        post_stream: {
          posts: [post(900, 1), post(901, 2)],
          stream: [900, 901],
        },
      }),
    );
    const paginator = new LinuxDoTopicPaginator(document, { fetch });
    const route = topicRoute();

    await expect(
      paginator.loadNext(route, new Set([100]), new Set(), new AbortController().signal),
    ).resolves.toEqual({ kind: 'unavailable' });

    expect(document.querySelectorAll('[data-docode-paginated-post]')).toHaveLength(0);
    const extraction = extractTopic(document, route);
    expect(extraction).toMatchObject({
      posts: [{ id: 100, number: 1 }],
      state: 'ready',
    });

    paginator.dispose();
  });

  it('preserves a 132-post snapshot when Linux DO rebuilds its native stream at exhaustion', async () => {
    setupTopic();
    const postIds = Array.from({ length: 132 }, (_, index) => 100 + index);
    const fetch = vi.fn<FetchLike>().mockImplementation((input) => {
      const url = new URL(
        input instanceof URL ? input.href : typeof input === 'string' ? input : input.url,
      );
      if (url.pathname.endsWith('/posts.json')) {
        return Promise.resolve(
          Response.json({
            post_stream: {
              posts: url.searchParams.getAll('post_ids[]').map((value) => {
                const id = Number(value);
                return post(id, id - 99);
              }),
            },
          }),
        );
      }
      return Promise.resolve(
        Response.json({
          id: 42,
          title: 'Synthetic topic',
          post_stream: { posts: [post(100, 1)], stream: postIds },
        }),
      );
    });
    const paginator = new LinuxDoTopicPaginator(document, { fetch });
    const route = topicRoute();
    let loadedPostIds = new Set([100]);
    let lastOutcome: Awaited<ReturnType<typeof paginator.loadNext>> = { kind: 'complete' };

    for (let page = 0; page < 7; page += 1) {
      lastOutcome = await paginator.loadNext(
        route,
        loadedPostIds,
        new Set(),
        new AbortController().signal,
      );
      const extraction = extractTopic(document, route);
      if (extraction.state !== 'ready') throw new Error('Expected a stable topic snapshot.');
      loadedPostIds = new Set(extraction.posts.map(({ id }) => id));
    }

    expect(lastOutcome).toEqual({ hasMore: false, kind: 'ready', loadedPostCount: 11 });
    expect(loadedPostIds.size).toBe(132);
    const snapshotBeforeFloorRouteChange = document.querySelector(
      '[data-docode-topic-json-source]',
    );
    const nativeStream = document.querySelector<HTMLElement>('main .post-stream');
    if (!nativeStream) throw new Error('Missing native stream fixture.');
    nativeStream.innerHTML = `
      <div data-post-number="15">
        <article data-post-id="114" data-user-id="15">
          <div class="names"><a data-user-card="user-15" href="/u/user-15">User 15</a></div>
          <a class="post-date" href="/t/synthetic-topic/42/15"><span data-time="2026-08-20T12:00:00.000Z">now</span></a>
          <div class="cooked"><p>Post 15</p></div>
        </article>
      </div>`;

    const floorRoute = topicRoute(15);
    await expect(
      paginator.loadNext(floorRoute, loadedPostIds, new Set(), new AbortController().signal),
    ).resolves.toEqual({ kind: 'complete' });
    expect(document.querySelector('[data-docode-topic-json-source]')).toBe(
      snapshotBeforeFloorRouteChange,
    );

    const afterNativeRebuild = extractTopic(document, floorRoute);
    if (afterNativeRebuild.state !== 'ready') throw new Error('Expected the snapshot to survive.');
    expect(afterNativeRebuild.posts).toHaveLength(132);
    expect(afterNativeRebuild.posts.every(({ completeness }) => completeness === 'complete')).toBe(
      true,
    );
    expect(afterNativeRebuild.posts.at(0)?.content?.root.textContent).toBe('Post 1');
    expect(afterNativeRebuild.posts.at(0)?.number).toBe(1);
    expect(afterNativeRebuild.posts.at(-1)?.number).toBe(132);
    await expect(
      paginator.loadNext(floorRoute, loadedPostIds, new Set(), new AbortController().signal),
    ).resolves.toEqual({ kind: 'complete' });
    const exhaustedExtraction = extractTopic(document, route);
    expect(exhaustedExtraction.state).toBe('ready');
    if (exhaustedExtraction.state === 'ready') {
      expect(exhaustedExtraction.posts.at(-1)?.number).toBe(132);
    }

    paginator.dispose();
    expect(extractTopic(document, route)).toMatchObject({
      posts: [{ number: 15 }],
      state: 'ready',
    });
  });

  it('keeps the same complete snapshot content while native posts are rebuilt', async () => {
    setupTopic();
    const originalContentRoot = document.querySelector<HTMLElement>('main .post-stream .cooked');
    if (!originalContentRoot) throw new Error('Expected native topic content.');
    const transfer = new NativeContentTransfer(document);
    const resolveNativeContent = (owner: HTMLElement) => transfer.resolveSourceElement(owner);
    const fetch = vi.fn<FetchLike>().mockResolvedValue(
      Response.json({
        id: 42,
        title: 'Synthetic topic',
        post_stream: { posts: [post(100, 1)], stream: [100] },
      }),
    );
    const paginator = new LinuxDoTopicPaginator(document, { fetch, resolveNativeContent });
    const route = topicRoute();

    await expect(paginator.loadReplyTargets(route, new AbortController().signal)).resolves.toEqual({
      annotatedPostCount: 0,
      changedPostCount: 0,
      kind: 'ready',
    });

    const firstExtraction = extractTopic(document, route, { resolveNativeContent });
    if (firstExtraction.state !== 'ready') throw new Error('Expected a readable snapshot.');
    const stableContentRoot = firstExtraction.posts[0]?.content?.root;
    if (!stableContentRoot) throw new Error('Expected snapshot content.');
    expect(stableContentRoot).toBe(originalContentRoot);
    const host = document.createElement('div');
    host.setAttribute('data-docode-workbench-root', '');
    document.body.append(host);
    const restore = transfer.mount(stableContentRoot, host);

    const nativeStream = document.querySelector<HTMLElement>('main .post-stream');
    if (!nativeStream) throw new Error('Missing native stream fixture.');
    for (let refresh = 0; refresh < 4; refresh += 1) {
      nativeStream.innerHTML = refresh % 2 === 0 ? '' : createNativePostFixture(1, 'Transient');
      const extraction = extractTopic(document, route, { resolveNativeContent });
      if (extraction.state !== 'ready') throw new Error('Expected a stable snapshot refresh.');
      expect(extraction.posts[0]?.completeness).toBe('complete');
      expect(extraction.posts[0]?.content?.root).toBe(stableContentRoot);
      expect(extraction.posts[0]?.content?.root.textContent).toBe('Post 1');
    }

    await expect(paginator.loadReplyTargets(route, new AbortController().signal)).resolves.toEqual({
      annotatedPostCount: 0,
      changedPostCount: 0,
      kind: 'ready',
    });
    expect(
      document.querySelectorAll('[data-docode-topic-json-source] [data-post-id="100"] .cooked'),
    ).toHaveLength(1);
    expect(host.querySelectorAll('.cooked')).toHaveLength(1);
    expect(document.querySelectorAll('main .post-stream .cooked')).toHaveLength(1);
    expect(document.querySelector('main .post-stream .cooked')?.textContent).toBe('Transient');

    restore();
    transfer.dispose();
    paginator.dispose();
  });

  it('hydrates an already-rendered partial reply before requesting later posts', async () => {
    setupTopic();
    document.querySelector('.post-stream')?.insertAdjacentHTML(
      'beforeend',
      `<div data-post-number="2"><article data-post-id="101" data-user-id="2">
        <div class="names"><a data-user-card="user-2" href="/u/user-2">User 2</a></div>
        <a class="post-date" href="/t/synthetic-topic/42/2"><span data-time="2026-08-20T12:00:00.000Z">now</span></a>
      </article></div>`,
    );
    const fetch = vi.fn<FetchLike>().mockResolvedValueOnce(
      Response.json({
        post_stream: { posts: [post(100, 1), post(101, 2)], stream: [100, 101] },
      }),
    );
    const paginator = new LinuxDoTopicPaginator(document, { fetch });
    const route = topicRoute();

    await expect(
      paginator.loadNext(route, new Set([100, 101]), new Set([101]), new AbortController().signal),
    ).resolves.toEqual({ hasMore: false, kind: 'ready', loadedPostCount: 1 });
    expect(document.querySelector('[data-post-id="101"] .cooked')?.textContent).toBe('Post 2');
    const extraction = extractTopic(document, route);
    if (extraction.state !== 'ready') throw new Error('Expected hydrated topic replies.');
    expect(extraction.posts[1]?.content?.source).toBe('linuxdo-same-origin-json');
    expect(fetch).toHaveBeenCalledTimes(1);

    paginator.dispose();
    expect(document.querySelector('[data-post-id="101"] .cooked')).toBeNull();
  });

  it('shares topic initialization, annotates real reply targets, and restores prior DOM state', async () => {
    setupTopic();
    document.querySelector('.post-stream')?.insertAdjacentHTML(
      'beforeend',
      `<div data-post-number="2" data-docode-reply-to-post-number="9">
        <article data-post-id="101" data-user-id="2">
          <div class="names"><a data-user-card="user-2" href="/u/user-2">User 2</a></div>
          <a class="post-date" href="/t/synthetic-topic/42/2"><span data-time="2026-08-20T12:00:00.000Z">now</span></a>
          <div class="cooked"><p>Post 2</p></div>
        </article>
      </div>`,
    );
    const fetch = vi.fn<FetchLike>().mockResolvedValue(
      Response.json({
        post_stream: {
          posts: [post(100, 1), post(101, 2, { reply_to_post_number: 1 })],
          stream: [100, 101],
        },
      }),
    );
    const paginator = new LinuxDoTopicPaginator(document, { fetch });
    const route = topicRoute();

    const [targets, continuation] = await Promise.all([
      paginator.loadReplyTargets(route, new AbortController().signal),
      paginator.loadNext(route, new Set([100, 101]), new Set(), new AbortController().signal),
    ]);

    expect(targets).toEqual({ annotatedPostCount: 1, changedPostCount: 0, kind: 'ready' });
    expect(continuation).toEqual({ kind: 'complete' });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(
      document
        .querySelector('[data-docode-topic-json-source] [data-post-number="2"]')
        ?.getAttribute('data-docode-reply-to-post-number'),
    ).toBe('1');
    expect(
      document
        .querySelector('main .post-stream [data-post-number="2"]')
        ?.getAttribute('data-docode-reply-to-post-number'),
    ).toBe('9');
    const extraction = extractTopic(document, route);
    if (extraction.state !== 'ready') throw new Error('Expected readable topic replies.');
    expect(extraction.posts[1]?.replyToPostNumber).toBe(1);

    paginator.dispose();
    expect(
      document
        .querySelector('[data-post-number="2"]')
        ?.getAttribute('data-docode-reply-to-post-number'),
    ).toBe('9');
  });

  it('stops the route session after a bounded run of empty readable pages', async () => {
    setupTopic();
    const stream = Array.from({ length: 82 }, (_, index) => 100 + index);
    const fetch = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(Response.json({ post_stream: { posts: [post(100, 1)], stream } }))
      .mockImplementation(() =>
        Promise.resolve(Response.json({ post_stream: { posts: [post(100, 1)] } })),
      );
    const paginator = new LinuxDoTopicPaginator(document, { fetch });
    const route = topicRoute();

    await expect(
      paginator.loadNext(route, new Set([100]), new Set(), new AbortController().signal),
    ).resolves.toEqual({ kind: 'complete' });
    expect(fetch).toHaveBeenCalledTimes(5);

    await expect(
      paginator.loadNext(route, new Set([100]), new Set(), new AbortController().signal),
    ).resolves.toEqual({ kind: 'complete' });
    expect(fetch).toHaveBeenCalledTimes(5);
    expect(document.querySelectorAll('[data-docode-paginated-post]')).toHaveLength(0);
  });

  it('keeps failures retryable and aborts without mutating the post stream', async () => {
    setupTopic();
    const fetch = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(
        Response.json({ post_stream: { posts: [post(100, 1)], stream: [100] } }),
      );
    const paginator = new LinuxDoTopicPaginator(document, { fetch });
    const route = topicRoute();

    await expect(
      paginator.loadNext(route, new Set([100]), new Set(), new AbortController().signal),
    ).resolves.toEqual({ kind: 'unavailable' });
    await expect(
      paginator.loadNext(route, new Set([100]), new Set(), new AbortController().signal),
    ).resolves.toEqual({ kind: 'complete' });

    const controller = new AbortController();
    controller.abort();
    await expect(
      paginator.loadNext(route, new Set([100]), new Set(), controller.signal),
    ).resolves.toEqual({ kind: 'aborted' });
    expect(document.querySelectorAll('[data-docode-paginated-post]')).toHaveLength(0);
  });
});

function setupTopic(): void {
  setupTopicRange(1, 1);
}

function setupTopicRange(firstPostNumber: number, lastPostNumber: number): void {
  const posts = Array.from(
    { length: lastPostNumber - firstPostNumber + 1 },
    (_, index) => firstPostNumber + index,
  )
    .map(
      (postNumber) => `<div data-post-number="${String(postNumber)}">
          <article data-post-id="${String(99 + postNumber)}" data-user-id="${String(postNumber)}">
            <div class="names"><a data-user-card="user-${String(postNumber)}" href="/u/user-${String(postNumber)}">User ${String(postNumber)}</a></div>
            <a class="post-date" href="/t/synthetic-topic/42${
              postNumber === 1 ? '' : `/${String(postNumber)}`
            }"><span class="relative-date" data-time="2026-08-20T12:00:00.000Z">now</span></a>
            <div class="cooked"><p>Post ${String(postNumber)}</p></div>
          </article>
        </div>`,
    )
    .join('');
  document.body.innerHTML = `
    <main>
      <h1 data-topic-id="42"><a class="fancy-title" href="/t/synthetic-topic/42">Synthetic topic</a></h1>
      <div class="post-stream">${posts}</div>
    </main>`;
}

function createNativePostFixture(postNumber: number, content: string): string {
  return `<div data-post-number="${String(postNumber)}">
    <article data-post-id="${String(99 + postNumber)}" data-user-id="${String(postNumber)}">
      <div class="names"><a data-user-card="user-${String(postNumber)}" href="/u/user-${String(postNumber)}">User ${String(postNumber)}</a></div>
      <a class="post-date" href="/t/synthetic-topic/42"><span class="relative-date" data-time="2026-08-20T12:00:00.000Z">now</span></a>
      <div class="cooked"><p>${content}</p></div>
    </article>
  </div>`;
}

function post(id: number, postNumber: number, overrides: Record<string, unknown> = {}) {
  return {
    cooked: `<p>Post ${String(postNumber)}</p>`,
    created_at: '2026-08-20T12:00:00.000Z',
    id,
    name: `User ${String(postNumber)}`,
    post_number: postNumber,
    topic_id: 42,
    user_id: postNumber,
    username: `user-${String(postNumber)}`,
    ...overrides,
  };
}

function unsafePost(id: number, postNumber: number) {
  return {
    ...post(id, postNumber),
    cooked:
      '<script>unsafe()</script><p onclick="unsafe()">Safe text</p><a href="javascript:unsafe()">Unsafe link</a>',
  };
}

function topicRoute(postNumber: number | null = null) {
  const suffix = postNumber === null ? '' : `/${String(postNumber)}`;
  const route = recognizeLinuxDoRoute(`https://linux.do/t/synthetic-topic/42${suffix}`);
  if (route.kind !== 'topic') throw new Error('Expected a topic route.');
  return route;
}

function requestUrls(fetch: ReturnType<typeof vi.fn<FetchLike>>): string[] {
  return fetch.mock.calls.map(([input]) =>
    input instanceof URL ? input.href : typeof input === 'string' ? input : input.url,
  );
}
