// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://linux.do/t/synthetic-topic/42" }

import { describe, expect, it, vi } from 'vitest';

import {
  extractLinuxDoUserCard,
  loadLinuxDoUserCard,
  resolveLinuxDoAvatarUrl,
} from '../../src/linuxdo/userCardAdapter';

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

describe('userCardAdapter', () => {
  it('normalizes only real public user-card fields and strips rich profile markup', () => {
    expect(
      extractLinuxDoUserCard(
        document,
        {
          user: {
            avatar_template: '/user_avatar/linux.do/fist2005/{size}/1.png',
            bio_excerpt: '<script>unsafe()</script><p>Builds <strong>browser tools</strong>.</p>',
            created_at: '2024-01-07T12:00:00.000Z',
            featured_user_badges: [
              { description: 'Reached trust level one', name: 'Basic' },
              { description: 'duplicate', name: 'Basic' },
              { display_name: 'First Link' },
            ],
            last_posted_at: '2026-08-21T10:00:00.000Z',
            last_seen_at: '2026-08-21T11:00:00.000Z',
            location: 'Earth',
            name: 'Fist User',
            recent_time_read: 120,
            time_read: 8_640,
            title: 'Builder',
            topic_post_count: 5,
            trust_level: 2,
            username: 'fist2005',
            website: 'https://example.com/portfolio',
          },
        },
        'fist2005',
      ),
    ).toEqual({
      avatarUrl: 'https://linux.do/user_avatar/linux.do/fist2005/96/1.png',
      badges: [
        { description: 'Reached trust level one', name: 'Basic' },
        { description: null, name: 'First Link' },
      ],
      bioExcerpt: 'Builds browser tools.',
      createdAt: '2024-01-07T12:00:00.000Z',
      displayName: 'Fist User',
      lastPostedAt: '2026-08-21T10:00:00.000Z',
      lastSeenAt: '2026-08-21T11:00:00.000Z',
      location: 'Earth',
      recentTimeReadSeconds: 120,
      timeReadSeconds: 8_640,
      title: 'Builder',
      topicPostCount: 5,
      trustLevel: 2,
      username: 'fist2005',
      websiteUrl: 'https://example.com/portfolio',
    });
  });

  it('uses the exact same-origin card route and preserves request cancellation', async () => {
    const fetcher = vi.fn<FetchLike>(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            user: {
              avatar_template: '/user_avatar/linux.do/fist2005/{size}/1.png',
              username: 'fist2005',
            },
          }),
          { headers: { 'content-type': 'application/json' }, status: 200 },
        ),
      ),
    );
    const controller = new AbortController();

    await expect(
      loadLinuxDoUserCard(document, 'fist2005', controller.signal, fetcher),
    ).resolves.toMatchObject({ kind: 'ready' });
    const [endpoint, init] = fetcher.mock.calls[0] ?? [];
    expect(endpoint).toHaveProperty('href', 'https://linux.do/u/fist2005/card.json');
    expect(init).toMatchObject({ credentials: 'same-origin', method: 'GET' });

    controller.abort();
    await expect(
      loadLinuxDoUserCard(document, 'fist2005', controller.signal, fetcher),
    ).resolves.toEqual({ kind: 'aborted' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('rejects mismatched identities, insecure avatars, executable websites, and failures', async () => {
    expect(
      extractLinuxDoUserCard(document, { user: { username: 'different-user' } }, 'fist2005'),
    ).toBeNull();
    expect(resolveLinuxDoAvatarUrl('javascript:alert(1)', document.location.href, 48)).toBeNull();
    expect(
      resolveLinuxDoAvatarUrl(
        'https://cdn.example.com/avatar/{size}.png',
        document.location.href,
        48,
      ),
    ).toBe('https://cdn.example.com/avatar/48.png');
    expect(
      resolveLinuxDoAvatarUrl(
        'https://user:secret@cdn.example.com/avatar.png',
        document.location.href,
        48,
      ),
    ).toBeNull();
    expect(
      resolveLinuxDoAvatarUrl('http://cdn.example.com/avatar.png', document.location.href, 48),
    ).toBeNull();
    expect(
      extractLinuxDoUserCard(
        document,
        { user: { username: 'fist2005', website: 'javascript:alert(1)' } },
        'fist2005',
      )?.websiteUrl,
    ).toBeNull();
    const fetcher = vi.fn<FetchLike>(() => Promise.resolve(new Response('', { status: 503 })));
    await expect(
      loadLinuxDoUserCard(document, 'fist2005', new AbortController().signal, fetcher),
    ).resolves.toEqual({ kind: 'unavailable' });
  });
});
