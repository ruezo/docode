// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';

import { LinuxDoTrustLevelLoader } from '../../src/linuxdo/trustLevelLoader';

const PROFILE_PAYLOAD = {
  user: { id: 1, trust_level: 2, username: 'ruez' },
};

const SUMMARY_PAYLOAD = {
  user_summary: {
    days_visited: 120,
    likes_given: 260,
    likes_received: 90,
    post_count: 210,
    posts_read_count: 17_000,
    time_read: 480_000,
    topic_count: 6,
    topics_entered: 1_800,
  },
};

function requestUrl(input: RequestInfo | URL): string {
  if (input instanceof URL) return input.href;
  return typeof input === 'string' ? input : input.url;
}

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  });
}

describe('LinuxDoTrustLevelLoader', () => {
  it('combines the profile and summary endpoints into one snapshot', async () => {
    const fetch = vi.fn((input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url.endsWith('/u/ruez.json')) {
        return Promise.resolve(jsonResponse(PROFILE_PAYLOAD));
      }
      if (url.endsWith('/u/ruez/summary.json')) {
        return Promise.resolve(jsonResponse(SUMMARY_PAYLOAD));
      }
      return Promise.resolve(new Response('missing', { status: 404 }));
    });
    const loader = new LinuxDoTrustLevelLoader(document, { fetch });

    const outcome = await loader.load('Ruez', new AbortController().signal);

    expect(outcome).toEqual({
      kind: 'ready',
      snapshot: {
        daysVisited: 120,
        likesGiven: 260,
        likesReceived: 90,
        postCount: 210,
        postsReadCount: 17_000,
        timeReadSeconds: 480_000,
        topicCount: 6,
        topicsEntered: 1_800,
        trustLevel: 2,
        username: 'ruez',
      },
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    const requested = fetch.mock.calls.map(([input]) => new URL(requestUrl(input)).pathname);
    expect(requested).toContain('/u/ruez.json');
    expect(requested).toContain('/u/ruez/summary.json');
  });

  it('maps authentication challenges and malformed payloads onto safe outcomes', async () => {
    const unauthorized = new LinuxDoTrustLevelLoader(document, {
      fetch: () => Promise.resolve(new Response('denied', { status: 403 })),
    });
    expect(await unauthorized.load('ruez', new AbortController().signal)).toEqual({
      kind: 'authentication-required',
    });

    const malformed = new LinuxDoTrustLevelLoader(document, {
      fetch: (input) =>
        Promise.resolve(
          jsonResponse(
            requestUrl(input).endsWith('summary.json')
              ? { user_summary: { days_visited: 'many' } }
              : PROFILE_PAYLOAD,
          ),
        ),
    });
    expect(await malformed.load('ruez', new AbortController().signal)).toEqual({
      kind: 'unavailable',
    });

    const invalidUsername = new LinuxDoTrustLevelLoader(document, {
      fetch: () => Promise.reject(new Error('should not be called')),
    });
    expect(await invalidUsername.load('../admin', new AbortController().signal)).toEqual({
      kind: 'unavailable',
    });
  });

  it('reports aborted loads instead of failing', async () => {
    const controller = new AbortController();
    const loader = new LinuxDoTrustLevelLoader(document, {
      fetch: () => {
        controller.abort();
        return Promise.reject(new DOMException('aborted', 'AbortError'));
      },
    });
    expect(await loader.load('ruez', controller.signal)).toEqual({ kind: 'aborted' });
  });
});
