// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';

import {
  BOOST_MAX_VISIBLE_LENGTH,
  countBoostVisibleLength,
  LinuxDoBoostApiClient,
} from '../../src/linuxdo/boostApiClient';

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
    status,
  });
}

function requestUrl(input: RequestInfo | URL): string {
  if (input instanceof URL) return input.href;
  return typeof input === 'string' ? input : input.url;
}

describe('countBoostVisibleLength', () => {
  it('counts grapheme clusters and emoji shortcodes as single visible characters', () => {
    expect(countBoostVisibleLength('前排合影')).toBe(4);
    expect(countBoostVisibleLength(':tada: 支持')).toBe(4);
    expect(countBoostVisibleLength('👨‍👩‍👧‍👦👍🏻')).toBe(2);
    expect(countBoostVisibleLength('a'.repeat(BOOST_MAX_VISIBLE_LENGTH))).toBe(
      BOOST_MAX_VISIBLE_LENGTH,
    );
  });
});

describe('LinuxDoBoostApiClient', () => {
  it('sends the CSRF token and JSON payload to the boosts endpoint', async () => {
    const calls: { body: string | null; headers: Headers; method: string; url: string }[] = [];
    const fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input);
      calls.push({
        body: typeof init?.body === 'string' ? init.body : null,
        headers: new Headers(init?.headers),
        method: init?.method ?? 'GET',
        url,
      });
      if (url.endsWith('/session/csrf.json')) {
        return Promise.resolve(jsonResponse({ csrf: 'token-1' }));
      }
      return Promise.resolve(
        jsonResponse({
          can_delete: true,
          cooked: '<p>前排合影</p>',
          id: 991,
          user: { avatar_template: '/user_avatar/linux.do/ruez/{size}/2.png', username: 'ruez' },
        }),
      );
    });
    const client = new LinuxDoBoostApiClient(document, { fetch });

    const outcome = await client.create(206, ' 前排合影 ');

    expect(outcome).toEqual({
      boost: {
        avatarUrl: `${document.location.origin}/user_avatar/linux.do/ruez/24/2.png`,
        text: '前排合影',
        username: 'ruez',
      },
      kind: 'created',
    });
    expect(calls).toHaveLength(2);
    const write = calls[1];
    expect(write?.url.endsWith('/discourse-boosts/posts/206/boosts')).toBe(true);
    expect(write?.method).toBe('POST');
    expect(write?.headers.get('X-CSRF-Token')).toBe('token-1');
    expect(write?.headers.get('Content-Type')).toBe('application/json');
    expect(JSON.parse(write?.body ?? '{}')).toEqual({ post_id: 206, raw: '前排合影' });
  });

  it('rejects empty or overlong boosts locally without touching the network', async () => {
    const fetch = vi.fn(() => Promise.reject(new Error('should not be called')));
    const client = new LinuxDoBoostApiClient(document, { fetch });

    const empty = await client.create(206, '   ');
    expect(empty).toMatchObject({ code: 'rejected', kind: 'failed' });
    const overlong = await client.create(206, '这是一条超过十六个可见字符限制的超长快捷回复');
    expect(overlong).toMatchObject({ code: 'rejected', kind: 'failed' });
    expect(overlong.kind === 'failed' && overlong.message.includes('16')).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('maps server denials onto explicit failure codes and messages', async () => {
    const respond = (writeResponse: Response) => {
      return new LinuxDoBoostApiClient(document, {
        fetch: (input: RequestInfo | URL) =>
          Promise.resolve(
            requestUrl(input).endsWith('/session/csrf.json')
              ? jsonResponse({ csrf: 'token-1' })
              : writeResponse,
          ),
      });
    };

    expect(
      await respond(new Response('denied', { status: 401 })).create(206, '支持'),
    ).toMatchObject({ code: 'authentication-required', kind: 'failed' });
    expect(
      await respond(new Response('denied', { status: 403 })).create(206, '支持'),
    ).toMatchObject({ code: 'rejected', kind: 'failed', retryable: false });
    expect(await respond(new Response('slow', { status: 429 })).create(206, '支持')).toMatchObject({
      code: 'rejected',
      kind: 'failed',
      retryable: true,
    });
    const duplicate = await respond(
      jsonResponse({ errors: ['你已经 Boost 过这个帖子了'] }, 422),
    ).create(206, '支持');
    expect(duplicate).toEqual({
      code: 'rejected',
      kind: 'failed',
      message: '你已经 Boost 过这个帖子了',
      retryable: false,
    });
  });
});
