// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://linux.do/t/current-topic/42" }

import { describe, expect, it, vi } from 'vitest';

import { LinuxDoExplorerTopicLoader } from '../../src/linuxdo/explorerTopicLoader';

describe('LinuxDoExplorerTopicLoader', () => {
  it('loads the real latest topic payload through the verified same-origin endpoint', async () => {
    const fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;
      return Promise.resolve(
        Response.json({
          topic_list: {
            topics: [
              {
                highest_post_number: 9,
                id: 77,
                last_posted_at: '2026-08-19T12:00:00.000Z',
                last_poster_username: 'latest-user',
                pinned: true,
                posters: [
                  { extras: 'original', user_id: 1 },
                  { extras: 'latest', user_id: 2 },
                ],
                reply_count: 8,
                slug: 'loaded-topic',
                tags: ['testing'],
                title: 'Loaded topic',
                unread_posts: 3,
                views: 120,
              },
            ],
          },
          users: [
            { id: 1, username: 'original-user' },
            { id: 2, username: 'latest-user' },
          ],
        }),
      );
    });
    const loader = new LinuxDoExplorerTopicLoader(document, { fetch });

    const outcome = await loader.load(new AbortController().signal);

    expect(outcome).toMatchObject({ kind: 'ready' });
    if (outcome.kind !== 'ready') throw new Error('Expected an Explorer topic document.');
    expect(outcome.document.route.href).toBe('https://linux.do/latest');
    expect(outcome.document.lines).toHaveLength(1);
    expect(outcome.document.lines[0]).toMatchObject({
      readState: 'unread',
      topicId: 77,
      url: 'https://linux.do/t/loaded-topic/77',
    });
    expect(outcome.document.lines[0]?.tokens).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'tag', text: 'testing' }),
        expect.objectContaining({ kind: 'participant', text: 'original-user' }),
        expect.objectContaining({ kind: 'participant', text: 'latest-user' }),
        expect.objectContaining({ kind: 'count', metric: 'replies', value: 8 }),
        expect.objectContaining({ kind: 'count', metric: 'views', value: 120 }),
      ]),
    );
    expect(fetch).toHaveBeenCalledOnce();
    const [requestUrl, requestInit] = fetch.mock.calls[0] ?? [];
    expect(requestUrl).toEqual(new URL('https://linux.do/latest.json'));
    expect(requestInit).toMatchObject({ credentials: 'same-origin', method: 'GET' });
    expect((requestInit?.headers as Headers).get('Accept')).toBe('application/json');
  });

  it('falls back to the semantic latest page when the JSON response is unavailable', async () => {
    const fetch = vi
      .fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(new Response('', { status: 403 }))
      .mockResolvedValueOnce(
        new Response(
          `<table class="topic-list"><tbody>
            <tr class="unread-posts" data-topic-id="77">
              <td><a href="/t/loaded-topic/77">Loaded topic</a></td>
              <td class="posts">8</td><td class="views">120</td>
              <td class="activity"><a href="/t/loaded-topic/77/8">now</a></td>
            </tr>
          </tbody></table>`,
          { headers: { 'Content-Type': 'text/html' }, status: 200 },
        ),
      );
    const loader = new LinuxDoExplorerTopicLoader(document, { fetch });

    const outcome = await loader.load(new AbortController().signal);

    expect(outcome).toMatchObject({ kind: 'ready' });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(
      fetch.mock.calls.map(([url]) =>
        url instanceof URL ? url.href : typeof url === 'string' ? url : url.url,
      ),
    ).toEqual(['https://linux.do/latest.json', 'https://linux.do/latest']);
  });

  it('loads each allow-listed Linux DO view without broadening the integration surface', async () => {
    const fetch = vi.fn(() =>
      Promise.resolve(
        Response.json({
          topic_list: {
            topics: [
              {
                id: 88,
                slug: 'hot-topic',
                title: 'Hot topic',
              },
            ],
          },
          users: [],
        }),
      ),
    );
    const loader = new LinuxDoExplorerTopicLoader(document, { fetch });

    const outcome = await loader.loadView('hot', new AbortController().signal);

    expect(outcome).toMatchObject({ kind: 'ready' });
    if (outcome.kind !== 'ready') throw new Error('Expected an Explorer topic document.');
    expect(outcome.document.route).toMatchObject({ kind: 'topic-list', view: 'hot' });
    expect(fetch).toHaveBeenCalledWith(
      new URL('https://linux.do/hot.json'),
      expect.objectContaining({ credentials: 'same-origin', method: 'GET' }),
    );
  });

  it('returns unavailable or aborted without inventing Explorer entries', async () => {
    const failed = new LinuxDoExplorerTopicLoader(document, {
      fetch: vi.fn(() => Promise.resolve(new Response('', { status: 403 }))),
    });
    await expect(failed.load(new AbortController().signal)).resolves.toEqual({
      kind: 'unavailable',
    });

    const redirectedResponse = new Response(
      '<table class="topic-list"><tbody><tr data-topic-id="88"><td><a href="/t/foreign/88">Foreign</a></td></tr></tbody></table>',
      { status: 200 },
    );
    Object.defineProperty(redirectedResponse, 'url', { value: 'https://example.com/latest' });
    const redirected = new LinuxDoExplorerTopicLoader(document, {
      fetch: vi.fn(() => Promise.resolve(redirectedResponse)),
    });
    await expect(redirected.load(new AbortController().signal)).resolves.toEqual({
      kind: 'unavailable',
    });

    const controller = new AbortController();
    controller.abort();
    await expect(failed.load(controller.signal)).resolves.toEqual({ kind: 'aborted' });
  });
});
