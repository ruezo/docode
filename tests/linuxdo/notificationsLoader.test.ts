// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://linux.do/latest" }

import { describe, expect, it, vi } from 'vitest';

import { LinuxDoNotificationsLoader } from '../../src/linuxdo/notificationsLoader';

function jsonResponse(payload: unknown, status = 200, url = 'https://linux.do/notifications.json') {
  return {
    json: () => Promise.resolve(payload),
    ok: status >= 200 && status < 300,
    status,
    url,
  } as unknown as Response;
}

describe('LinuxDoNotificationsLoader', () => {
  it('maps real notification payloads into safe menu items', async () => {
    const fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        notifications: [
          {
            created_at: '2026-08-24T02:00:00Z',
            data: { display_username: 'alice', topic_title: 'DOCode 反馈' },
            id: 11,
            notification_type: 2,
            post_number: 5,
            read: false,
            slug: 'docode-feedback',
            topic_id: 42,
          },
          {
            data: { badge_id: 9, badge_name: 'First Like', badge_slug: 'first-like' },
            id: 12,
            notification_type: 12,
            read: true,
          },
          { id: 'broken' },
          {
            data: {},
            id: 13,
            notification_type: 999,
            read: true,
          },
        ],
      }),
    );
    const loader = new LinuxDoNotificationsLoader(document, { fetch });

    const outcome = await loader.load(new AbortController().signal);

    expect(outcome).toEqual({
      kind: 'ready',
      notifications: [
        {
          id: 11,
          kind: 'replied',
          label: 'DOCode 反馈',
          read: false,
          url: 'https://linux.do/t/docode-feedback/42/5',
          username: 'alice',
        },
        {
          id: 12,
          kind: 'badge',
          label: 'First Like',
          read: true,
          url: 'https://linux.do/badges/9/first-like',
          username: null,
        },
        {
          id: 13,
          kind: 'notification',
          label: 'Notification',
          read: true,
          url: 'https://linux.do/my/notifications',
          username: null,
        },
      ],
    });
    const requested = new URL(String(fetch.mock.calls[0]?.[0]));
    expect(requested.pathname).toBe('/notifications.json');
    expect(requested.searchParams.get('recent')).toBe('true');
  });

  it('reports authentication, malformed payloads, and aborts distinctly', async () => {
    const denied = new LinuxDoNotificationsLoader(document, {
      fetch: vi.fn().mockResolvedValue(jsonResponse({}, 403)),
    });
    expect(await denied.load(new AbortController().signal)).toEqual({
      kind: 'authentication-required',
    });

    const malformed = new LinuxDoNotificationsLoader(document, {
      fetch: vi.fn().mockResolvedValue(jsonResponse({ unexpected: true })),
    });
    expect(await malformed.load(new AbortController().signal)).toEqual({ kind: 'unavailable' });

    const crossOrigin = new LinuxDoNotificationsLoader(document, {
      fetch: vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ notifications: [] }, 200, 'https://evil.example/notifications.json'),
        ),
    });
    expect(await crossOrigin.load(new AbortController().signal)).toEqual({ kind: 'unavailable' });

    const aborted = new AbortController();
    aborted.abort();
    const loader = new LinuxDoNotificationsLoader(document, { fetch: vi.fn() });
    expect(await loader.load(aborted.signal)).toEqual({ kind: 'aborted' });
  });
});
