// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://linux.do/latest" }

import { describe, expect, it, vi } from 'vitest';

import { LinuxDoSearchAdapter, createLinuxDoSearchRoute } from '../../src/linuxdo/searchAdapter';

describe('LinuxDoSearchAdapter', () => {
  it('uses the real same-origin grouped-search endpoint and preserves result URLs', async () => {
    document.head.innerHTML =
      '<meta name="discourse-track-view-session-id" content="public-session-id">';
    const requests: {
      readonly init: RequestInit | undefined;
      readonly input: RequestInfo | URL;
    }[] = [];
    const fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ init, input });
      return Promise.resolve(
        new Response(
          JSON.stringify({
            categories: [
              {
                description_text: 'Development discussion',
                id: 4,
                name: 'Develop',
                slug: 'develop',
                topic_url: '/c/develop/4',
              },
            ],
            posts: [
              {
                blurb: '<b>Matched</b> post excerpt',
                id: 101,
                post_number: 3,
                topic_id: 42,
                username: 'alice',
              },
            ],
            tags: [{ id: 7, name: 'Testing', slug: 'testing' }],
            topics: [{ fancy_title: 'A &amp; B', id: 42, slug: 'a-b' }],
            users: [{ id: 9, name: 'Alice Example', username: 'alice' }],
          }),
          { headers: { 'Content-Type': 'application/json' }, status: 200 },
        ),
      );
    });
    const adapter = new LinuxDoSearchAdapter(document, { fetch });

    const outcome = await adapter.search('  browser   extension  ', new AbortController().signal);

    expect(outcome).toMatchObject({ kind: 'results', query: 'browser extension' });
    if (outcome.kind !== 'results') throw new Error('Expected search results.');
    expect(outcome.items.map(({ kind, url }) => [kind, url])).toEqual([
      ['post', 'https://linux.do/t/a-b/42/3'],
      ['category', 'https://linux.do/c/develop/4'],
      ['tag', 'https://linux.do/tag/testing/7'],
      ['user', 'https://linux.do/u/alice'],
    ]);
    expect(outcome.items[0]).toMatchObject({
      description: 'Post 3 · @alice · Matched post excerpt',
      label: 'A & B',
      route: { kind: 'topic', postNumber: 3, topicId: 42 },
    });
    expect(fetch).toHaveBeenCalledOnce();
    const request = requests[0];
    const requestUrl =
      request?.input instanceof URL
        ? request.input.href
        : typeof request?.input === 'string'
          ? request.input
          : request?.input.url;
    expect(requestUrl).toBe('https://linux.do/search/query?term=browser+extension');
    expect(request?.init).toMatchObject({ credentials: 'same-origin', method: 'GET' });
    expect((request?.init?.headers as Headers).get('Discourse-Pageview-Session-Id')).toBe(
      'public-session-id',
    );
  });

  it('reports empty, server, invalid-response, and aborted states without fake results', async () => {
    const emptyFetch = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 })));
    await expect(
      new LinuxDoSearchAdapter(document, { fetch: emptyFetch }).search(
        'none',
        new AbortController().signal,
      ),
    ).resolves.toEqual({ items: [], kind: 'results', query: 'none' });

    const failedFetch = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ message: 'Please wait before searching again.' }), {
          status: 429,
        }),
      ),
    );
    await expect(
      new LinuxDoSearchAdapter(document, { fetch: failedFetch }).search(
        'limited',
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({
      code: 'request-failed',
      kind: 'error',
      message: 'Please wait before searching again.',
      retryable: true,
    });

    const missingEndpointFetch = vi.fn(() => Promise.resolve(new Response('', { status: 404 })));
    await expect(
      new LinuxDoSearchAdapter(document, { fetch: missingEndpointFetch }).search(
        'missing-endpoint',
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({
      code: 'search-unavailable',
      kind: 'error',
      retryable: false,
    });

    const invalidFetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify([]), { status: 200 })),
    );
    await expect(
      new LinuxDoSearchAdapter(document, { fetch: invalidFetch }).search(
        'invalid',
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({ code: 'invalid-response', kind: 'error' });

    const declaredErrorFetch = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            grouped_search_result: { error: 'Search is temporarily unavailable.' },
          }),
          { status: 200 },
        ),
      ),
    );
    await expect(
      new LinuxDoSearchAdapter(document, { fetch: declaredErrorFetch }).search(
        'declared-error',
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({
      code: 'request-failed',
      kind: 'error',
      message: 'Search is temporarily unavailable.',
      retryable: true,
    });

    const controller = new AbortController();
    const abortFetch = vi.fn(() => {
      controller.abort();
      return Promise.reject(new DOMException('Aborted', 'AbortError'));
    });
    await expect(
      new LinuxDoSearchAdapter(document, { fetch: abortFetch }).search('cancel', controller.signal),
    ).resolves.toEqual({ kind: 'aborted', query: 'cancel' });
  });

  it('builds canonical real search routes without retaining unrelated parameters', () => {
    expect(createLinuxDoSearchRoute(' exact query ', document)).toMatchObject({
      href: 'https://linux.do/search?q=exact+query',
      kind: 'search',
      query: 'exact query',
    });
  });

  it('converts untrusted result markup to text without constructing returned elements', async () => {
    let constructed = 0;
    const probeName = 'docode-search-security-probe';
    if (!window.customElements.get(probeName)) {
      window.customElements.define(
        probeName,
        class extends HTMLElement {
          constructor() {
            super();
            constructed += 1;
          }
        },
      );
    }
    const fetch = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            posts: [
              {
                blurb: `<${probeName}>Untrusted</${probeName}> &amp; text &#x1F680; <img src="https://example.com/probe.png" onerror="globalThis.probed=true">`,
                id: 101,
                post_number: 1,
                topic_id: 42,
                username: 'alice',
              },
            ],
            topics: [{ fancy_title: 'Safe &mdash; title', id: 42, slug: 'safe-title' }],
          }),
          { headers: { 'Content-Type': 'application/json' }, status: 200 },
        ),
      ),
    );

    const outcome = await new LinuxDoSearchAdapter(document, { fetch }).search(
      'security',
      new AbortController().signal,
    );

    expect(outcome).toMatchObject({ kind: 'results' });
    if (outcome.kind !== 'results') throw new Error('Expected search results.');
    expect(outcome.items[0]).toMatchObject({
      description: 'Post 1 · @alice · Untrusted & text 🚀',
      label: 'Safe — title',
    });
    expect(constructed).toBe(0);
    expect(Reflect.has(globalThis, 'probed')).toBe(false);
  });
});
