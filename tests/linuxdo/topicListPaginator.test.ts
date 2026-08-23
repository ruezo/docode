// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://linux.do/" }

import { describe, expect, it, vi } from 'vitest';

import { recognizeLinuxDoRoute } from '../../src/linuxdo/routes';
import { LinuxDoTopicListPaginator } from '../../src/linuxdo/topicListPaginator';
import type { TopicListRoute } from '../../src/views/topicList/topicListDocument';

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type FetchMock = ReturnType<typeof vi.fn<FetchLike>>;

describe('LinuxDoTopicListPaginator', () => {
  it('follows the real server cursor and skips the already-rendered first page', async () => {
    const fetch = vi
      .fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(topicPage([topic(1)], '/latest?no_definitions=true&page=1'))
      .mockResolvedValueOnce(topicPage([topic(2)], '/latest?no_definitions=true&page=2'))
      .mockResolvedValueOnce(topicPage([topic(3)], null));
    const paginator = new LinuxDoTopicListPaginator(document, { fetch });
    const route = topicListRoute('https://linux.do/');

    const first = await paginator.loadNext(route, new Set([1]), new AbortController().signal);

    expect(first).toMatchObject({ hasMore: true, kind: 'ready' });
    if (first.kind !== 'ready' || first.document?.state !== 'ready') {
      throw new Error('Expected the first appended topic page.');
    }
    expect(first.document.lines.map(({ topicId }) => topicId)).toEqual([2]);
    expect(requestUrls(fetch)).toEqual([
      'https://linux.do/latest.json',
      'https://linux.do/latest?no_definitions=true&page=1',
    ]);

    const second = await paginator.loadNext(route, new Set([1, 2]), new AbortController().signal);

    expect(second).toMatchObject({ hasMore: false, kind: 'ready' });
    if (second.kind !== 'ready' || second.document?.state !== 'ready') {
      throw new Error('Expected the final appended topic page.');
    }
    expect(second.document.lines.map(({ topicId }) => topicId)).toEqual([3]);
    expect(requestUrls(fetch).at(-1)).toBe('https://linux.do/latest?no_definitions=true&page=2');
    await expect(
      paginator.loadNext(route, new Set([1, 2, 3]), new AbortController().signal),
    ).resolves.toEqual({ kind: 'complete' });
  });

  it('resets pagination for another list route and preserves its query', async () => {
    const fetch = vi
      .fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(topicPage([topic(4)], null))
      .mockResolvedValueOnce(topicPage([topic(5)], null));
    const paginator = new LinuxDoTopicListPaginator(document, { fetch });

    await paginator.loadNext(
      topicListRoute('https://linux.do/top?period=weekly'),
      new Set(),
      new AbortController().signal,
    );
    await paginator.loadNext(
      topicListRoute('https://linux.do/unread'),
      new Set(),
      new AbortController().signal,
    );

    expect(requestUrls(fetch)).toEqual([
      'https://linux.do/top.json?period=weekly',
      'https://linux.do/unread.json',
    ]);
  });

  it('keeps the current cursor retryable after a failure and aborts safely', async () => {
    const fetch = vi
      .fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(topicPage([topic(6)], null));
    const paginator = new LinuxDoTopicListPaginator(document, { fetch });
    const route = topicListRoute('https://linux.do/latest');

    await expect(
      paginator.loadNext(route, new Set(), new AbortController().signal),
    ).resolves.toEqual({ kind: 'unavailable' });
    const retry = await paginator.loadNext(route, new Set(), new AbortController().signal);
    expect(retry).toMatchObject({ hasMore: false, kind: 'ready' });
    expect(requestUrls(fetch)).toEqual([
      'https://linux.do/latest.json',
      'https://linux.do/latest.json',
    ]);

    const controller = new AbortController();
    controller.abort();
    await expect(paginator.loadNext(route, new Set(), controller.signal)).resolves.toEqual({
      kind: 'aborted',
    });
  });
});

function topic(id: number) {
  return {
    highest_post_number: 2,
    id,
    last_posted_at: '2026-08-19T12:00:00.000Z',
    posters: [{ extras: 'original latest', user_id: id }],
    reply_count: 1,
    slug: `topic-${String(id)}`,
    title: `Topic ${String(id)}`,
    views: 10,
  };
}

function topicPage(topics: readonly ReturnType<typeof topic>[], moreTopicsUrl: string | null) {
  return Response.json({
    topic_list: { more_topics_url: moreTopicsUrl, topics },
    users: topics.map(({ id }) => ({ id, username: `user-${String(id)}` })),
  });
}

function topicListRoute(url: string): TopicListRoute {
  const route = recognizeLinuxDoRoute(url);
  if (route.kind !== 'topic-list') throw new Error('Expected a topic-list route.');
  return route;
}

function requestUrls(fetch: FetchMock): string[] {
  return fetch.mock.calls.map(([input]) =>
    input instanceof URL ? input.href : typeof input === 'string' ? input : input.url,
  );
}
