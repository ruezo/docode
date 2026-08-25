// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://linux.do/latest" }

import { act } from 'react';
import { fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { recognizeLinuxDoRoute } from '../../src/linuxdo/routes';
import { NATIVE_CONTENT_TRANSFER_MOUNT_EVENT } from '../../src/runtime/nativeContentTransfer';
import {
  hasWorkbenchRoot,
  mountWorkbench,
  type MountedWorkbench,
} from '../../src/ui/workbench/mountWorkbench';

let mounted: MountedWorkbench | null = null;
const performanceObserverDescriptor = Object.getOwnPropertyDescriptor(
  window,
  'PerformanceObserver',
);

afterEach(() => {
  act(() => {
    mounted?.unmount();
  });
  mounted = null;
  document.body.innerHTML = '';
  window.history.replaceState({}, '', '/latest');
  vi.unstubAllGlobals();
  if (performanceObserverDescriptor) {
    Object.defineProperty(window, 'PerformanceObserver', performanceObserverDescriptor);
  } else {
    Reflect.deleteProperty(window, 'PerformanceObserver');
  }
});

describe('mountWorkbench', () => {
  it('waits for delayed unread-list DOM and becomes ready without requiring Retry', async () => {
    document.body.innerHTML = '<main id="main-outlet"></main>';
    const route = recognizeLinuxDoRoute('https://linux.do/unread');

    act(() => {
      mounted = mountWorkbench(document, 'unread-settle-owner', route);
    });

    expect(document.querySelector('.docode-workbench__editor-progress')).not.toBeNull();
    expect(document.body.textContent).not.toContain('Unable to read topics');

    document
      .querySelector('#main-outlet')
      ?.replaceWith(createReadyTopicListFixture(43, 'Unread topic', 6));

    await waitFor(() => {
      expect(document.querySelector('.docode-workbench__editor-progress')).toBeNull();
      expect(document.querySelector('.docode-workbench')?.textContent).toContain('Unread topic');
    });
    expect(document.body.textContent).not.toContain('Unable to read topics');
  });

  it('keeps SPA list transitions loading until the new list DOM is committed', async () => {
    document.body.append(createReadyTopicListFixture(42, 'Latest topic'));
    act(() => {
      mounted = mountWorkbench(
        document,
        'list-spa-settle-owner',
        recognizeLinuxDoRoute('https://linux.do/latest'),
      );
    });
    expect(document.querySelector('.docode-workbench')?.textContent).toContain('Latest topic');

    const pendingMainOutlet = document.createElement('main');
    pendingMainOutlet.id = 'main-outlet';
    document.querySelector('#main-outlet')?.replaceWith(pendingMainOutlet);
    act(() => {
      mounted?.updateRoute(recognizeLinuxDoRoute('https://linux.do/unread'), 1, 'document');
    });

    expect(document.querySelector('.docode-workbench__editor-progress')).not.toBeNull();
    expect(document.querySelector('.docode-workbench')?.textContent).not.toContain(
      'Unable to read topics',
    );
    expect(document.querySelector('.docode-workbench')?.textContent).not.toContain('Latest topic');

    document
      .querySelector('#main-outlet')
      ?.replaceWith(createReadyTopicListFixture(43, 'Unread topic', 6));

    await waitFor(() => {
      expect(document.querySelector('.docode-workbench__editor-progress')).toBeNull();
      expect(document.querySelector('.docode-workbench')?.textContent).toContain('Unread topic');
    });
  });

  it('exposes a real list error after the deadline and lets Retry start a fresh window', async () => {
    vi.useFakeTimers();
    try {
      document.body.innerHTML = '<main id="main-outlet"></main>';
      act(() => {
        mounted = mountWorkbench(
          document,
          'list-settle-timeout-owner',
          recognizeLinuxDoRoute('https://linux.do/unread'),
        );
      });
      expect(document.body.textContent).not.toContain('Unable to read topics');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(9_000);
      });

      expect(document.body.textContent).toContain('Unable to read topics');
      expect(document.body.textContent).toContain(
        'Linux DO did not expose the expected topic list.',
      );

      const retry = document.querySelector<HTMLButtonElement>(
        '.docode-workbench__state-actions button',
      );
      if (!retry) throw new Error('Missing list Retry action.');
      fireEvent.click(retry);
      expect(document.body.textContent).not.toContain('Unable to read topics');
      expect(document.querySelector('.docode-workbench__editor-progress')).not.toBeNull();

      document
        .querySelector('#main-outlet')
        ?.replaceWith(createReadyTopicListFixture(43, 'Unread topic', 6));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60);
      });

      expect(document.querySelector('.docode-workbench__editor-progress')).toBeNull();
      expect(document.querySelector('.docode-workbench')?.textContent).toContain('Unread topic');
    } finally {
      vi.useRealTimers();
    }
  });

  it('waits for delayed topic DOM and becomes ready without requiring Retry', async () => {
    document.body.innerHTML = '<main id="main-outlet"></main>';
    const route = recognizeLinuxDoRoute('https://linux.do/t/synthetic-topic/42');

    act(() => {
      mounted = mountWorkbench(document, 'topic-settle-owner', route);
    });

    expect(document.querySelector('.docode-workbench__editor-progress')).not.toBeNull();
    expect(document.body.textContent).not.toContain('Unable to read this topic');
    expect(document.body.textContent).toContain('Loading topic outline…');
    expect(document.body.textContent).toContain('Loading topic minimap…');

    document.querySelector('#main-outlet')?.replaceWith(createReadyTopicFixture());

    await waitFor(() => {
      expect(document.querySelector('.docode-workbench__editor-progress')).toBeNull();
      expect(document.body.textContent).toContain('Synthetic topic');
      expect(document.body.textContent).toContain('Native content');
    });
    expect(document.body.textContent).not.toContain('Unable to read this topic');
  });

  it('recovers the initial topic from validated preloaded state without Retry', async () => {
    document.body.innerHTML = '<script id="data-preloaded" type="application/json"></script>';
    const topicPayload = {
      id: 42,
      title: 'Preloaded topic',
      post_stream: {
        posts: [
          {
            cooked: '<p>Recovered native content</p>',
            created_at: '2026-08-20T12:00:00.000Z',
            id: 100,
            name: 'Alice',
            post_number: 1,
            topic_id: 42,
            user_id: 1,
            username: 'alice',
          },
        ],
        stream: [100],
      },
    };
    const preloaded = document.querySelector('#data-preloaded');
    if (!preloaded) throw new Error('Missing preloaded-state fixture.');
    preloaded.textContent = JSON.stringify({ topic_42: JSON.stringify(topicPayload) });

    act(() => {
      mounted = mountWorkbench(
        document,
        'topic-preloaded-owner',
        recognizeLinuxDoRoute('https://linux.do/t/synthetic-topic/42'),
      );
    });

    expect(document.querySelector('.docode-workbench__editor-progress')).not.toBeNull();
    await waitFor(() => {
      expect(document.querySelector('.docode-workbench__editor-progress')).toBeNull();
      expect(document.querySelector('.docode-workbench')?.textContent).toContain(
        'Recovered native content',
      );
    });
    expect(document.body.textContent).not.toContain('Unable to read this topic');
    expect(document.querySelector('[data-docode-topic-json-source]')).not.toBeNull();

    act(() => {
      mounted?.unmount();
      mounted = null;
    });
    expect(document.querySelector('[data-docode-topic-json-source]')).toBeNull();
  });

  it('retries initial topic recovery automatically while the route is settling', async () => {
    document.body.innerHTML = '<main id="main-outlet"></main>';
    const fetch = vi
      .fn<typeof window.fetch>()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockImplementation(() =>
        Promise.resolve(
          Response.json({
            id: 42,
            title: 'Automatically recovered topic',
            post_stream: {
              posts: [
                {
                  cooked: '<p>Recovered after a transient failure</p>',
                  created_at: '2026-08-20T12:00:00.000Z',
                  id: 100,
                  name: 'Alice',
                  post_number: 1,
                  topic_id: 42,
                  user_id: 1,
                  username: 'alice',
                },
              ],
              stream: [100],
            },
          }),
        ),
      );
    vi.stubGlobal('fetch', fetch);

    act(() => {
      mounted = mountWorkbench(
        document,
        'topic-transient-recovery-owner',
        recognizeLinuxDoRoute('https://linux.do/t/synthetic-topic/42'),
      );
    });

    expect(document.querySelector('.docode-workbench__editor-progress')).not.toBeNull();
    await waitFor(() => {
      expect(fetch.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(document.querySelector('.docode-workbench__editor-progress')).toBeNull();
      expect(document.querySelector('.docode-workbench')?.textContent).toContain(
        'Recovered after a transient failure',
      );
    });
    expect(document.body.textContent).not.toContain('Unable to read this topic');
  });

  it('keeps SPA topic transitions loading until the matching topic DOM is committed', async () => {
    document.body.append(createReadyTopicFixture());
    act(() => {
      mounted = mountWorkbench(
        document,
        'topic-spa-settle-owner',
        recognizeLinuxDoRoute('https://linux.do/t/synthetic-topic/42'),
      );
    });
    expect(document.body.textContent).toContain('Native content');

    act(() => {
      mounted?.updateRoute(
        recognizeLinuxDoRoute('https://linux.do/t/next-topic/43'),
        1,
        'document',
      );
    });
    expect(document.querySelector('.docode-workbench__editor-progress')).not.toBeNull();
    expect(document.querySelector('.docode-workbench')?.textContent).not.toContain(
      'Unable to read this topic',
    );
    expect(document.querySelector('.docode-workbench')?.textContent).not.toContain(
      'Native content',
    );

    document
      .querySelector('#main-outlet')
      ?.replaceWith(createReadyTopicFixture(43, 'Next topic', 'Next native content'));

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 60));
    });
    expect(document.querySelector('.docode-workbench__editor-progress')).toBeNull();
    expect(document.querySelector('.docode-workbench')?.textContent).toContain('Next topic');
    expect(document.querySelector('.docode-workbench')?.textContent).toContain(
      'Next native content',
    );
    expect(document.querySelector('.docode-workbench')?.textContent).not.toContain(
      'Unable to read this topic',
    );
  });

  it('exposes a real compatibility error after the bounded topic settle window expires', async () => {
    vi.useFakeTimers();
    try {
      document.body.innerHTML = '<main id="main-outlet"></main>';
      act(() => {
        mounted = mountWorkbench(
          document,
          'topic-settle-timeout-owner',
          recognizeLinuxDoRoute('https://linux.do/t/synthetic-topic/42'),
        );
      });
      expect(document.body.textContent).not.toContain('Unable to read this topic');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(9_000);
      });

      expect(document.body.textContent).toContain('Unable to read this topic');
      expect(document.body.textContent).toContain(
        'Linux DO did not expose readable topic metadata.',
      );
      expect(document.querySelector('.docode-workbench__editor-progress')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('owns one root and removes only that root during cleanup', () => {
    document.body.innerHTML = `<main id="native">
      <table class="topic-list"><tbody>
        <tr data-topic-id="42">
          <td><a href="/t/synthetic-topic/42">Synthetic topic</a></td>
          <td class="posts">1</td>
          <td class="views">2</td>
          <td class="activity"><a href="/t/synthetic-topic/42/2">now</a></td>
        </tr>
      </tbody></table>
    </main>`;

    act(() => {
      mounted = mountWorkbench(
        document,
        'owner-one',
        recognizeLinuxDoRoute('https://linux.do/latest'),
      );
    });

    expect(mounted).not.toBeNull();
    expect(hasWorkbenchRoot(document)).toBe(true);
    expect(
      document
        .querySelector('[data-docode-workbench-root]')
        ?.getAttribute('data-docode-workbench-root'),
    ).toBe('owner-one');
    expect(document.querySelector('#native')?.textContent).toContain('Synthetic topic');
    expect(document.querySelector('[role="listitem"]')?.textContent).toContain('Synthetic topic');
    expect(
      mountWorkbench(document, 'owner-two', recognizeLinuxDoRoute('https://linux.do/latest')),
    ).toBeNull();

    act(() => {
      expect(
        mounted?.updateRoute(recognizeLinuxDoRoute('https://linux.do/hot'), 1, 'popstate'),
      ).toBe(true);
    });
    expect(document.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toContain(
      'hot',
    );
    expect(document.querySelector('.docode-workbench')?.getAttribute('data-route-generation')).toBe(
      '1',
    );
    expect(document.querySelector('.docode-workbench')?.getAttribute('data-route-source')).toBe(
      'popstate',
    );

    act(() => {
      expect(mounted?.unmount()).toBe(true);
    });
    expect(hasWorkbenchRoot(document)).toBe(false);
    expect(document.querySelector('#native')?.textContent).toContain('Synthetic topic');
    expect(mounted?.unmount()).toBe(false);
    expect(mounted?.updateRoute(recognizeLinuxDoRoute('https://linux.do/top'), 2)).toBe(false);
  });

  it('restores a committed Explorer width when the workbench is reconstructed', async () => {
    document.body.innerHTML = '<main><div class="topic-list"></div></main>';
    let storedWidth = 236;
    const writeSidebarWidth = vi.fn((width: number) => {
      storedWidth = width;
      return Promise.resolve();
    });
    const mount = () =>
      mountWorkbench(document, 'layout-owner', recognizeLinuxDoRoute('https://linux.do/latest'), {
        initialSidebarWidth: storedWidth,
        onSidebarWidthChange: writeSidebarWidth,
        useOriginalView: null,
      });

    act(() => {
      mounted = mount();
    });
    const firstSash = document.querySelector<HTMLElement>('[aria-label="Resize primary side bar"]');
    if (!firstSash) throw new Error('Missing primary side bar sash.');
    expect(firstSash.getAttribute('aria-valuenow')).toBe('236');

    fireEvent.keyDown(firstSash, { key: 'ArrowRight' });
    await waitFor(() => {
      expect(writeSidebarWidth).toHaveBeenLastCalledWith(246);
    });

    act(() => {
      mounted?.unmount();
      mounted = null;
      mounted = mount();
    });
    expect(
      document
        .querySelector<HTMLElement>('[aria-label="Resize primary side bar"]')
        ?.getAttribute('aria-valuenow'),
    ).toBe('246');
  });

  it('does not render the removed reading-mode toolbar on a topic list', () => {
    document.body.innerHTML = `<main><table class="topic-list"><tbody>
      <tr data-topic-id="42"><td><a href="/t/synthetic-topic/42">Synthetic topic</a></td>
      <td class="posts">1</td><td class="views">2</td>
      <td class="activity"><a href="/t/synthetic-topic/42/2">now</a></td></tr>
    </tbody></table></main>`;

    act(() => {
      mounted = mountWorkbench(
        document,
        'list-mode-owner',
        recognizeLinuxDoRoute('https://linux.do/latest'),
      );
    });
    expect(document.querySelector('.docode-workbench__mode-toolbar')).toBeNull();
    expect(document.querySelector('.docode-topic-code__mode-toolbar')).toBeNull();
    expect(document.querySelector('button[data-docode-tooltip="Focus mode"]')).toBeNull();
  });

  it('appends the server-provided next topic page when the editor reaches the end', async () => {
    document.body.innerHTML = `<main><table class="topic-list"><tbody>
      <tr data-topic-id="1"><td><a class="title raw-topic-link" href="/t/topic-1/1">Topic 1</a></td>
      <td class="posts">1</td><td class="views">10</td>
      <td class="activity"><a href="/t/topic-1/1/2">now</a></td></tr>
    </tbody></table></main>`;
    const fetchDescriptor = Object.getOwnPropertyDescriptor(window, 'fetch');
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      (input) => {
        const href =
          input instanceof URL ? input.href : typeof input === 'string' ? input : input.url;
        if (href === 'https://linux.do/categories.json') {
          return Promise.resolve(Response.json({ category_list: { categories: [] } }));
        }
        if (href === 'https://linux.do/latest.json') {
          return Promise.resolve(
            Response.json({
              topic_list: {
                more_topics_url: '/latest?no_definitions=true&page=1',
                topics: [jsonTopic(1)],
              },
              users: [{ id: 1, username: 'user-1' }],
            }),
          );
        }
        return Promise.resolve(
          Response.json({
            topic_list: { more_topics_url: null, topics: [jsonTopic(2)] },
            users: [{ id: 2, username: 'user-2' }],
          }),
        );
      },
    );
    Object.defineProperty(window, 'fetch', { configurable: true, value: fetch });

    try {
      act(() => {
        mounted = mountWorkbench(
          document,
          'pagination-owner',
          recognizeLinuxDoRoute('https://linux.do/'),
        );
      });
      const scroll = document.querySelector<HTMLElement>('.docode-topic-list__scroll');
      if (!scroll) throw new Error('Missing topic-list editor scroll surface.');
      Object.defineProperties(scroll, {
        clientHeight: { configurable: true, value: 400 },
        scrollHeight: { configurable: true, value: 1_200 },
      });
      scroll.scrollTop = 500;
      await act(
        () =>
          new Promise<void>((resolve) => {
            fireEvent.scroll(scroll);
            window.requestAnimationFrame(() => {
              resolve();
            });
          }),
      );

      await waitFor(() => {
        expect(document.querySelectorAll('.docode-topic-list__entry')).toHaveLength(2);
      });
      expect(document.querySelector('.docode-topic-list__document')?.textContent).toContain(
        'Topic 2',
      );
      expect(
        fetch.mock.calls
          .map(([input]) =>
            input instanceof URL ? input.href : typeof input === 'string' ? input : input.url,
          )
          .filter((href) => href !== 'https://linux.do/categories.json'),
      ).toEqual([
        'https://linux.do/latest.json',
        'https://linux.do/latest?no_definitions=true&page=1',
      ]);
      expect(
        document.querySelector('[role="progressbar"][aria-label="Loading more topics…"]'),
      ).toBeNull();
    } finally {
      if (fetchDescriptor) Object.defineProperty(window, 'fetch', fetchDescriptor);
      else Reflect.deleteProperty(window, 'fetch');
    }
  });

  it('shows topic continuation progress and removes appended replies during restoration', async () => {
    window.history.replaceState({}, '', '/t/synthetic-topic/42');
    document.body.innerHTML = `<main>
      <h1 data-topic-id="42"><a href="/t/synthetic-topic/42">Synthetic topic</a></h1>
      <div class="post-stream"><div data-post-number="1"><article data-post-id="100">
        <div class="names"><a data-user-card="alice" href="/u/alice">Alice</a></div>
        <a class="post-date" href="/t/synthetic-topic/42"><span data-time="2026-08-18T00:00:00Z">now</span></a>
        <div class="cooked"><p>First reply</p></div>
      </article></div></div>
    </main>`;
    const fetchDescriptor = Object.getOwnPropertyDescriptor(window, 'fetch');
    let resolvePosts: ((response: Response) => void) | null = null;
    const pendingPosts = new Promise<Response>((resolve) => {
      resolvePosts = resolve;
    });
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      (input) => {
        const url = new URL(
          input instanceof URL ? input.href : typeof input === 'string' ? input : input.url,
          document.location.href,
        );
        if (url.pathname === '/latest.json') {
          return Promise.resolve(
            Response.json({
              topic_list: { more_topics_url: null, topics: [jsonTopic(42)] },
              users: [{ id: 42, username: 'alice' }],
            }),
          );
        }
        if (url.pathname === '/t/synthetic-topic/42.json') {
          return Promise.resolve(
            Response.json({ post_stream: { posts: [jsonPost(100, 1)], stream: [100, 101] } }),
          );
        }
        if (url.pathname === '/t/42/posts.json') return pendingPosts;
        return Promise.resolve(new Response(null, { status: 404 }));
      },
    );
    Object.defineProperty(window, 'fetch', { configurable: true, value: fetch });

    try {
      act(() => {
        mounted = mountWorkbench(
          document,
          'topic-pagination-owner',
          recognizeLinuxDoRoute('https://linux.do/t/synthetic-topic/42'),
        );
      });
      const scroll = document.querySelector<HTMLElement>('.docode-topic-code__surface');
      if (!scroll) throw new Error('Missing topic editor scroll surface.');
      Object.defineProperties(scroll, {
        clientHeight: { configurable: true, value: 400 },
        scrollHeight: { configurable: true, value: 1_200 },
      });
      scroll.scrollTop = 500;
      fireEvent.scroll(scroll);

      await waitFor(() => {
        expect(
          fetch.mock.calls
            .map(([input]) =>
              input instanceof URL ? input.href : typeof input === 'string' ? input : input.url,
            )
            .filter((url) => url.includes('/t/')),
        ).toEqual([
          'https://linux.do/t/synthetic-topic/42.json',
          'https://linux.do/t/42/posts.json?post_ids%5B%5D=101',
        ]);
        expect(
          document.querySelector('[role="progressbar"][aria-label="Loading more replies…"]'),
        ).not.toBeNull();
      });
      await act(async () => {
        resolvePosts?.(Response.json({ post_stream: { posts: [jsonPost(101, 2)] } }));
        await pendingPosts;
      });
      await waitFor(() => {
        expect(document.querySelectorAll('.docode-topic-code__reply')).toHaveLength(2);
      });
      expect(document.querySelector('.docode-topic-code__surface')?.textContent).toContain(
        'Second reply',
      );
      expect(document.querySelector('.docode-workbench__status-item--replies')?.textContent).toBe(
        'Replies 2 · End',
      );
      expect(document.querySelector('[data-docode-paginated-post]')).not.toBeNull();

      const nativeStream = document.querySelector<HTMLElement>('main .post-stream');
      if (!nativeStream) throw new Error('Missing native topic stream.');
      const stableSnapshot = document.querySelector('[data-docode-topic-json-source]');
      nativeStream.innerHTML = `<div data-post-number="1"><article data-post-id="100">
        <div class="names"><a data-user-card="alice" href="/u/alice">Alice</a></div>
        <a class="post-date" href="/t/synthetic-topic/42"><span data-time="2026-08-18T00:00:00Z">now</span></a>
        <div class="cooked"><p>First reply after native rebuild</p></div>
      </article></div>`;
      act(() => {
        mounted?.updateRoute(
          recognizeLinuxDoRoute('https://linux.do/t/synthetic-topic/42/15'),
          1,
          'navigation',
        );
      });
      await waitFor(() => {
        expect(document.querySelector('[data-docode-topic-json-source]')).toBe(stableSnapshot);
        expect(document.querySelectorAll('.docode-topic-code__reply')).toHaveLength(2);
        expect(document.querySelector('.docode-topic-code__surface')?.textContent).toContain(
          'Second reply',
        );
      });

      act(() => {
        mounted?.unmount();
      });
      mounted = null;
      expect(document.querySelector('[data-docode-paginated-post]')).toBeNull();
      expect(document.querySelector('[data-post-id="100"] .cooked')?.textContent).toBe(
        'First reply after native rebuild',
      );
    } finally {
      if (fetchDescriptor) Object.defineProperty(window, 'fetch', fetchDescriptor);
      else Reflect.deleteProperty(window, 'fetch');
    }
  });

  it('primes real reply targets once and removes owned hover state during restoration', async () => {
    window.history.replaceState({}, '', '/t/synthetic-topic/42');
    document.body.append(createReadyTopicFixture());
    document.querySelector('.post-stream')?.insertAdjacentHTML(
      'beforeend',
      `<div data-post-number="2"><article data-post-id="101">
        <div class="names"><a data-user-card="bob" href="/u/bob">Bob</a></div>
        <a class="post-date" href="/t/synthetic-topic/42/2"><span data-time="2026-08-18T01:00:00Z">later</span></a>
        <div class="cooked"><p>Second reply</p></div>
        <button class="post-action-menu__copy-link">Copy</button>
      </article></div>`,
    );
    const fetchDescriptor = Object.getOwnPropertyDescriptor(window, 'fetch');
    const fetch = vi.fn((input: RequestInfo | URL) => {
      const url = new URL(
        input instanceof URL ? input.href : typeof input === 'string' ? input : input.url,
        document.location.href,
      );
      return Promise.resolve(
        url.pathname === '/t/synthetic-topic/42.json'
          ? Response.json({
              post_stream: {
                posts: [jsonPost(100, 1), { ...jsonPost(101, 2), reply_to_post_number: 1 }],
                stream: [100, 101],
              },
            })
          : new Response(null, { status: 404 }),
      );
    });
    Object.defineProperty(window, 'fetch', { configurable: true, value: fetch });

    try {
      act(() => {
        mounted = mountWorkbench(
          document,
          'reply-target-owner',
          recognizeLinuxDoRoute(window.location.href),
        );
      });
      const reference = await waitFor(() => {
        const element = document.querySelector<HTMLButtonElement>(
          '[aria-label="Preview replied-to post 1"]',
        );
        expect(element).not.toBeNull();
        return element;
      });
      if (!reference) throw new Error('Missing reply-target reference.');
      expect(
        fetch.mock.calls.filter(([input]) => {
          const url = new URL(
            input instanceof URL ? input.href : typeof input === 'string' ? input : input.url,
            document.location.href,
          );
          return url.pathname === '/t/synthetic-topic/42.json';
        }),
      ).toHaveLength(1);
      expect(
        document
          .querySelector('[data-docode-topic-json-source] [data-post-number="2"]')
          ?.getAttribute('data-docode-reply-to-post-number'),
      ).toBe('1');
      expect(
        document
          .querySelector('main .post-stream [data-post-number="2"]')
          ?.getAttribute('data-docode-reply-to-post-number'),
      ).toBeNull();

      fireEvent.pointerEnter(reference);
      await waitFor(() => {
        expect(document.querySelector('.docode-topic-code__reply-hover')?.textContent).toContain(
          '"Native content"',
        );
      });

      act(() => {
        mounted?.unmount();
      });
      mounted = null;
      expect(document.querySelector('.docode-topic-code__reply-hover')).toBeNull();
      expect(
        document
          .querySelector('[data-post-number="2"]')
          ?.getAttribute('data-docode-reply-to-post-number'),
      ).toBeNull();
    } finally {
      if (fetchDescriptor) Object.defineProperty(window, 'fetch', fetchDescriptor);
      else Reflect.deleteProperty(window, 'fetch');
    }
  });

  it('dispatches the independent native-view recovery action from the Activity Bar', async () => {
    document.body.innerHTML = `<main><table class="topic-list"><tbody>
      <tr data-topic-id="42"><td><a href="/t/synthetic-topic/42">Synthetic topic</a></td>
      <td class="posts">1</td><td class="views">2</td>
      <td class="activity"><a href="/t/synthetic-topic/42/2">now</a></td></tr>
    </tbody></table></main>`;
    let finishRestore: (() => void) | null = null;
    const useOriginalView = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishRestore = resolve;
        }),
    );
    act(() => {
      mounted = mountWorkbench(
        document,
        'raw-mode-owner',
        recognizeLinuxDoRoute('https://linux.do/latest'),
        { useOriginalView },
      );
    });
    const originalAction = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Return to native Linux DO"]',
    );
    if (!originalAction) throw new Error('Missing native Linux DO recovery action');

    fireEvent.click(originalAction);
    await waitFor(() => {
      expect(useOriginalView).toHaveBeenCalledOnce();
    });
    act(() => {
      finishRestore?.();
    });
    await act(async () => Promise.resolve());
  });

  it('opens, switches, and closes route-backed views without reordering or losing focus', async () => {
    document.body.innerHTML = `<main><table class="topic-list"><tbody>
      <tr class="unread-posts" data-topic-id="42"><td><a href="/t/synthetic-topic/42">Synthetic topic</a></td>
      <td class="posts">1</td><td class="views">2</td>
      <td class="activity"><a href="/t/synthetic-topic/42/2">now</a></td></tr>
    </tbody></table></main>`;
    let generation = 0;

    act(() => {
      mounted = mountWorkbench(
        document,
        'navigation-owner',
        recognizeLinuxDoRoute('https://linux.do/latest'),
      );
    });

    const navigate = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>('a[href]');
      if (!anchor?.closest('[data-docode-workbench-root]')) return;
      event.preventDefault();
      mounted?.updateRoute(recognizeLinuxDoRoute(anchor.href), ++generation);
    };
    document.addEventListener('click', navigate);
    try {
      const topicLink = document.querySelector<HTMLAnchorElement>('.docode-topic-list__topic-link');
      act(() => {
        if (topicLink) fireEvent.click(topicLink, { ctrlKey: true });
      });
      expect(tabLabels()).toEqual(['latest', 'topic:42']);
      expect(activeTab()?.closest('.docode-workbench__tab')?.getAttribute('data-read-state')).toBe(
        'unread',
      );

      act(() => {
        mounted?.updateRoute(recognizeLinuxDoRoute('https://linux.do/hot'), ++generation);
        mounted?.updateRoute(
          recognizeLinuxDoRoute('https://linux.do/t/renamed-topic/42/7'),
          ++generation,
        );
      });
      expect(tabLabels()).toEqual(['latest', 'topic:42', 'hot']);
      expect(activeTab()?.textContent).toContain('topic:42');
      expect(activeTab()?.getAttribute('href')).toBe('https://linux.do/t/renamed-topic/42/7');

      const latest = Array.from(document.querySelectorAll<HTMLAnchorElement>('[role="tab"]')).find(
        (tab) => tab.textContent.includes('latest'),
      );
      act(() => {
        latest?.click();
      });
      expect(activeTab()?.textContent).toContain('latest');

      const closeHot = document.querySelector<HTMLButtonElement>('button[aria-label="Close hot"]');
      act(() => {
        closeHot?.focus();
        closeHot?.click();
      });
      expect(tabLabels()).toEqual(['latest', 'topic:42']);
      await waitFor(() => {
        expect(document.activeElement).toBe(activeTab());
      });

      act(() => {
        mounted?.updateRoute(recognizeLinuxDoRoute('https://linux.do/hot'), ++generation);
      });
      const closeActiveHot = document.querySelector<HTMLAnchorElement>('a[aria-label="Close hot"]');
      act(() => {
        closeActiveHot?.focus();
        closeActiveHot?.click();
      });
      expect(tabLabels()).toEqual(['latest', 'topic:42']);
      expect(activeTab()?.textContent).toContain('topic:42');
      await waitFor(() => {
        expect(document.activeElement).toBe(activeTab());
      });
    } finally {
      document.removeEventListener('click', navigate);
    }
  });

  it('renders exact native topic content and shares mode changes with terminal commands', async () => {
    document.body.innerHTML = `<header class="d-header"><button class="login-button">Log in</button></header>
      <main><h1 data-topic-id="42"><a href="/t/synthetic-topic/42">Synthetic topic</a></h1>
        <a href="/c/develop/4">Develop</a>
        <div class="post-stream"><div data-post-number="1"><article data-post-id="100">
          <div class="names"><a data-user-card="alice" href="/u/alice">Alice</a></div>
          <a class="post-date" href="/t/synthetic-topic/42"><span data-time="2026-08-18T00:00:00Z">now</span></a>
          <div id="native-parent"><div class="cooked"><p>Native rich content</p></div></div>
          <button class="post-action-menu__copy-link">Copy</button>
        </article></div></div><div id="topic-footer-buttons"><div class="topic-footer-main-buttons"><button class="btn-primary create">Reply</button></div></div>
      </main><div id="reply-control" class="closed"></div>`;
    const nativeRoot = document.querySelector<HTMLElement>('.cooked');
    const nativeParent = document.querySelector<HTMLElement>('#native-parent');
    if (!nativeRoot || !nativeParent) throw new Error('Missing native topic fixture');
    const topicRoute = recognizeLinuxDoRoute('https://linux.do/t/synthetic-topic/42');
    if (topicRoute.kind !== 'topic') throw new Error('Expected a topic route fixture');
    let transferMountCount = 0;
    nativeRoot.addEventListener(NATIVE_CONTENT_TRANSFER_MOUNT_EVENT, () => {
      transferMountCount += 1;
    });

    act(() => {
      mounted = mountWorkbench(document, 'topic-owner', topicRoute);
    });
    expect(document.querySelector('.docode-topic-code__content-slot > .cooked')).toBe(nativeRoot);
    expect(nativeParent.querySelector('.cooked')).toBeNull();
    expect(transferMountCount).toBe(1);

    act(() => {
      for (let refresh = 0; refresh < 25; refresh += 1) {
        expect(mounted?.refresh()).toBe(true);
      }
    });
    await waitFor(() => {
      expect(document.querySelector('.docode-topic-code__content-slot > .cooked')).toBe(nativeRoot);
    });
    expect(nativeParent.querySelector('.cooked')).toBeNull();
    expect(transferMountCount).toBe(1);
    expect(document.querySelectorAll('.docode-topic-code__line-number-layer')).toHaveLength(1);
    expect(mounted?.readTopic(topicRoute)).toMatchObject({
      posts: [{ completeness: 'complete', content: { root: nativeRoot } }],
      state: 'ready',
    });

    const statusCategory = document.querySelector<HTMLButtonElement>(
      '[data-docode-workbench-root] button[aria-label="Current category: Develop"]',
    );
    const statusFloor = document.querySelector<HTMLButtonElement>(
      '[data-docode-workbench-root] button[aria-label="Current post 1"]',
    );
    const statusMode = document.querySelector<HTMLButtonElement>(
      '[data-docode-workbench-root] .docode-workbench__status-item--mode',
    );
    const statusActivity = document.querySelector<HTMLElement>(
      '[data-docode-workbench-root] .docode-workbench__status-item--activity',
    );
    expect(statusCategory?.hasAttribute('href')).toBe(false);
    expect(statusFloor?.hasAttribute('href')).toBe(false);
    expect(
      document.querySelector('[data-docode-workbench-root] .docode-workbench__statusbar a[href]'),
    ).toBeNull();
    expect(statusFloor?.dataset.docodeTooltip).toContain('Loaded Linux DO window: posts 1–1.');
    expect(statusActivity?.textContent).toContain('Sign in for actions');
    expect(statusActivity?.dataset.docodeTooltip).toContain('Like: sign-in required');
    expect(statusMode?.getAttribute('aria-label')).toBe('Change reading mode');
    expect(statusMode?.getAttribute('aria-description')).toContain('Activate to switch to Doc');
    if (!statusMode) throw new Error('Missing status reading-mode command');
    fireEvent.click(statusMode);
    await waitFor(() => {
      expect(document.querySelector('.docode-topic-code__surface')?.getAttribute('data-mode')).toBe(
        'doc',
      );
      expect(statusMode.textContent).toContain('Doc');
    });
    fireEvent.click(statusMode);
    await waitFor(() => {
      expect(document.querySelector('.docode-topic-code__surface')?.getAttribute('data-mode')).toBe(
        'code',
      );
      expect(statusMode.textContent).toContain('Code');
    });

    act(() => {
      expect(mounted?.refresh()).toBe(true);
    });
    expect(document.querySelector('.docode-topic-code__content-slot > .cooked')).toBe(nativeRoot);
    expect(nativeParent.querySelector('.cooked')).toBeNull();

    const terminalTab = Array.from(
      document.querySelectorAll<HTMLButtonElement>('.docode-workbench__panel-tab'),
    ).find((tab) => tab.textContent.trim() === 'Terminal');
    if (!terminalTab) throw new Error('Missing Terminal panel tab');
    fireEvent.click(terminalTab);
    expect(document.querySelector('.docode-terminal__prompt-label')?.textContent).toBe(
      'linux.do %',
    );
    const terminalInput = document.querySelector<HTMLInputElement>('.docode-terminal__input');
    const terminalForm = terminalInput?.closest('form');
    if (!terminalInput || !terminalForm) throw new Error('Missing terminal command prompt');
    const topicSurface = document.querySelector<HTMLElement>('.docode-topic-code__surface');
    if (!topicSurface) throw new Error('Missing topic surface');
    Object.defineProperties(topicSurface, {
      clientHeight: { configurable: true, value: 400 },
      scrollHeight: { configurable: true, value: 800 },
    });
    topicSurface.scrollTop = 120;
    fireEvent.scroll(topicSurface);
    fireEvent.change(terminalInput, { target: { value: 'mode doc' } });
    fireEvent.submit(terminalForm);
    await waitFor(() => {
      expect(document.querySelector('.docode-topic-code__surface')?.getAttribute('data-mode')).toBe(
        'doc',
      );
      expect(document.querySelector('.docode-terminal')?.textContent).toContain(
        'Reading mode: Doc.',
      );
    });
    expect(document.querySelector('.docode-topic-code__content-slot > .cooked')).toBe(nativeRoot);
    expect(topicSurface.scrollTop).toBe(120);

    expect(document.querySelector('.docode-topic-code__surface')).toBe(topicSurface);
    expect(topicSurface.getAttribute('data-mode')).toBe('doc');
    expect(topicSurface.scrollTop).toBe(120);
    expect(document.querySelector('.docode-topic-code__content-slot > .cooked')).toBe(nativeRoot);
    expect(document.querySelector('.docode-workbench')?.getAttribute('data-panel-open')).toBe(
      'true',
    );
    expect(document.querySelector('.docode-workbench__mode-toolbar')).toBeNull();
    expect(document.querySelector('.docode-topic-code__mode-toolbar')).toBeNull();
    expect(topicSurface.scrollTop).toBe(120);
    expect(document.querySelector('.docode-workbench')?.getAttribute('data-panel-open')).toBe(
      'true',
    );

    act(() => {
      expect(mounted?.unmount()).toBe(true);
    });
    expect(nativeParent.querySelector('.cooked')).toBe(nativeRoot);
    expect(hasWorkbenchRoot(document)).toBe(false);
  });

  it('routes post UI and terminal actions through confirmed native Like and Bookmark state', async () => {
    const emitLikeResponse = installLikeResponseObserver();
    window.history.replaceState({}, '', '/t/synthetic-topic/42');
    document.body.innerHTML = `<header class="d-header"><div id="current-user" data-username="fixture-user"></div></header>
      <main id="main-outlet"><h1 data-topic-id="42"><a href="/t/synthetic-topic/42">Synthetic topic</a></h1>
        <div class="post-stream"><div data-post-number="1"><article data-post-id="100">
          <div class="names"><a data-user-card="alice" href="/u/alice">Alice</a></div>
          <a class="post-date" href="/t/synthetic-topic/42"><span data-time="2026-08-18T00:00:00Z">now</span></a>
          <div class="cooked"><p>Native rich content</p></div>
          <div class="discourse-reactions-actions can-toggle-reaction"><button class="btn-toggle-reaction-like">Like</button></div>
          <button class="post-action-menu__bookmark bookmark">Bookmark</button>
          <button class="post-action-menu__copy-link">Copy</button>
        </article></div></div><div id="topic-footer-buttons"><div class="topic-footer-main-buttons"><button class="btn-primary create">Reply</button></div></div>
      </main><div id="reply-control" class="closed"></div>`;
    const nativeLike = document.querySelector<HTMLButtonElement>('.btn-toggle-reaction-like');
    const nativeBookmark = document.querySelector<HTMLButtonElement>('.post-action-menu__bookmark');
    const reactionRoot = document.querySelector('.discourse-reactions-actions');
    if (!nativeLike || !nativeBookmark || !reactionRoot) throw new Error('Missing action fixture');
    const likeClick = vi.spyOn(nativeLike, 'click');
    const bookmarkClick = vi.spyOn(nativeBookmark, 'click');
    nativeLike.addEventListener('click', () => {
      window.setTimeout(() => {
        reactionRoot.classList.toggle('has-used-main-reaction');
        emitLikeResponse();
      }, 5);
    });
    nativeBookmark.addEventListener('click', () => {
      window.setTimeout(() => {
        nativeBookmark.classList.add('bookmarked');
      }, 5);
    });

    act(() => {
      mounted = mountWorkbench(
        document,
        'native-action-owner',
        recognizeLinuxDoRoute(window.location.href),
      );
    });

    const like = document.querySelector<HTMLButtonElement>(
      '[data-docode-workbench-root] button[data-action="like"]',
    );
    const bookmark = document.querySelector<HTMLButtonElement>(
      '[data-docode-workbench-root] button[data-action="bookmark"]',
    );
    if (!like || !bookmark) throw new Error('Missing DOCode action controls');
    fireEvent.click(like);
    expect(like.disabled).toBe(true);
    expect(like.getAttribute('data-state')).toBe('pending');
    await waitFor(
      () => {
        const confirmedLike = document.querySelector<HTMLElement>(
          '[data-docode-workbench-root] [data-action="like"]',
        );
        expect(confirmedLike?.textContent).toContain('unlike');
        expect(confirmedLike?.getAttribute('aria-pressed')).toBe('true');
        expect(
          confirmedLike
            ?.querySelector('.docode-topic-code__action-label')
            ?.getAttribute('data-replacing'),
        ).toBe('true');
      },
      { timeout: 2_000 },
    );
    expect(likeClick).toHaveBeenCalledOnce();

    fireEvent.click(bookmark);
    await waitFor(
      () => {
        expect(
          document.querySelector('[data-docode-workbench-root] [data-action="bookmark"]')
            ?.textContent,
        ).toContain('bookmarked');
      },
      { timeout: 2_000 },
    );
    expect(bookmarkClick).toHaveBeenCalledOnce();

    const terminalTab = Array.from(
      document.querySelectorAll<HTMLButtonElement>('.docode-workbench__panel-tab'),
    ).find((tab) => tab.textContent.trim() === 'Terminal');
    if (!terminalTab) throw new Error('Missing Terminal panel tab');
    fireEvent.click(terminalTab);
    expect(document.querySelector('.docode-terminal__prompt-label')?.textContent).toBe(
      'linux.do/fixture-user %',
    );
    const terminalInput = document.querySelector<HTMLInputElement>('.docode-terminal__input');
    const terminalForm = terminalInput?.closest('form');
    if (!terminalInput || !terminalForm) throw new Error('Missing terminal command prompt');
    fireEvent.change(terminalInput, { target: { value: 'like' } });
    fireEvent.submit(terminalForm);
    await waitFor(
      () => {
        expect(document.querySelector('.docode-terminal')?.textContent).toContain(
          'Removed Like from post 1.',
        );
      },
      { timeout: 2_000 },
    );
    expect(likeClick).toHaveBeenCalledTimes(2);
    await waitFor(() => {
      const confirmedUnlike = document.querySelector<HTMLElement>(
        '[data-docode-workbench-root] [data-action="like"]',
      );
      expect(confirmedUnlike?.textContent).toContain('like');
      expect(confirmedUnlike?.textContent).not.toContain('unlike');
      expect(confirmedUnlike?.getAttribute('aria-pressed')).toBe('false');
      expect(
        confirmedUnlike
          ?.querySelector('.docode-topic-code__action-label')
          ?.getAttribute('data-replacing'),
      ).toBe('true');
    });
  });

  it('opens, tracks, submits, cancels, and restores the exact native Reply composer', async () => {
    const emitPostResponse = installPostResponseObserver();
    window.history.replaceState({}, '', '/t/synthetic-topic/42');
    document.body.innerHTML = `<header class="d-header"><div id="current-user" data-username="fixture-user"></div></header>
      <main id="main-outlet"><h1 data-topic-id="42"><a href="/t/synthetic-topic/42">Synthetic topic</a></h1>
        <div class="post-stream"><div data-post-number="1"><article data-post-id="100">
          <div class="names"><a data-user-card="alice" href="/u/alice">Alice</a></div>
          <a class="post-date" href="/t/synthetic-topic/42"><span data-time="2026-08-18T00:00:00Z">now</span></a>
          <div class="cooked"><p>Native rich content</p></div>
          <button class="post-action-menu__copy-link">Copy</button>
        </article></div></div>
        <div id="topic-footer-buttons"><div class="topic-footer-main-buttons"><button class="btn-primary create">Reply</button></div></div>
      </main><div id="native-composer-source"><div id="reply-control" class="closed hide-preview">
        <div class="reply-area"><textarea class="d-editor-input" aria-label="Reply"></textarea>
          <div class="submit-panel"><button class="btn-primary create">Reply</button><button class="discard-button">Discard</button></div>
        </div>
      </div></div>`;
    const replyControl = document.querySelector<HTMLElement>('#reply-control');
    const nativeReply = document.querySelector<HTMLButtonElement>('#topic-footer-buttons .create');
    const editor = document.querySelector<HTMLTextAreaElement>('.d-editor-input');
    const submit = document.querySelector<HTMLButtonElement>('#reply-control button.create');
    const discard = document.querySelector<HTMLButtonElement>('#reply-control .discard-button');
    const source = document.querySelector('#native-composer-source');
    if (!replyControl || !nativeReply || !editor || !submit || !discard || !source) {
      throw new Error('Missing native composer fixture');
    }
    nativeReply.addEventListener('click', () => {
      replyControl.className = 'open hide-preview';
    });
    discard.addEventListener('click', () => {
      editor.value = '';
      replyControl.className = 'closed hide-preview';
    });
    submit.addEventListener('click', () => {
      replyControl.className = 'saving hide-preview';
      document.querySelector('.post-stream')?.insertAdjacentHTML(
        'beforeend',
        `<div data-post-number="2"><article data-post-id="101">
          <div class="names"><a data-user-card="fixture-user" href="/u/fixture-user">Fixture User</a></div>
          <a class="post-date" href="/t/synthetic-topic/42/2"><span data-time="2026-08-18T00:01:00Z">now</span></a>
          <div class="cooked"><p>Confirmed native reply</p></div>
          <button class="post-action-menu__copy-link">Copy</button>
        </article></div>`,
      );
      editor.value = '';
      replyControl.className = 'closed hide-preview';
      emitPostResponse(200);
    });

    act(() => {
      mounted = mountWorkbench(
        document,
        'native-composer-owner',
        recognizeLinuxDoRoute(window.location.href),
      );
    });
    const replyAction = document.querySelector<HTMLButtonElement>(
      '[data-docode-workbench-root] button[aria-label="Reply to topic with Linux DO composer"]',
    );
    if (!replyAction) throw new Error('Missing DOCode Reply action');
    fireEvent.click(replyAction);
    await waitFor(() => {
      expect(document.querySelector('.docode-native-composer #reply-control')).toBe(replyControl);
      expect(document.activeElement).toBe(editor);
    });

    fireEvent.input(editor, { target: { value: 'Authoritative native draft' } });
    await waitFor(() => {
      expect(activeTab()?.closest('.docode-workbench__tab')?.getAttribute('data-dirty')).toBe(
        'true',
      );
      expect(document.querySelector('.docode-native-composer')?.getAttribute('data-dirty')).toBe(
        'true',
      );
    });

    discard.focus();
    fireEvent.click(discard);
    await waitFor(() => {
      expect(document.querySelector('.docode-native-composer')).toBeNull();
      expect(activeTab()?.closest('.docode-workbench__tab')?.getAttribute('data-dirty')).toBeNull();
      expect(replyControl.parentElement).toBe(source);
      expect(document.activeElement).toBe(replyAction);
    });

    fireEvent.click(replyAction);
    await waitFor(() => {
      expect(document.querySelector('.docode-native-composer #reply-control')).toBe(replyControl);
    });
    fireEvent.input(editor, { target: { value: 'Confirmed native reply' } });
    submit.focus();
    fireEvent.click(submit);
    await waitFor(() => {
      expect(document.querySelectorAll('.docode-topic-code__reply')).toHaveLength(2);
      expect(document.querySelector('.docode-topic-code__surface')?.textContent).toContain(
        'Confirmed native reply',
      );
      expect(document.querySelector('.docode-native-composer')).toBeNull();
      expect(activeTab()?.closest('.docode-workbench__tab')?.getAttribute('data-dirty')).toBeNull();
      expect(document.activeElement).toBe(replyAction);
    });

    act(() => {
      expect(mounted?.unmount()).toBe(true);
    });
    expect(replyControl.parentElement).toBe(source);
    expect(document.querySelector('#main-outlet .cooked')?.textContent).toContain(
      'Native rich content',
    );
  });

  it('uses the browser clipboard and the existing original-view action from the tab menu', async () => {
    document.body.innerHTML = '<main></main>';
    const writeText = vi.fn(() => Promise.resolve());
    const useOriginalView = vi.fn(() => Promise.resolve());
    const clipboardDescriptor = Object.getOwnPropertyDescriptor(window.navigator, 'clipboard');
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    try {
      act(() => {
        mounted = mountWorkbench(
          document,
          'action-owner',
          recognizeLinuxDoRoute('https://linux.do/t/synthetic-topic/42/7'),
          { useOriginalView },
        );
      });

      openActiveTabMenu();
      act(() => {
        menuItem('Copy Topic Link')?.click();
      });
      await waitFor(() => {
        expect(writeText).toHaveBeenCalledWith('https://linux.do/t/synthetic-topic/42/7');
      });

      openActiveTabMenu();
      act(() => {
        menuItem('Open Original View')?.click();
      });
      await waitFor(() => {
        expect(useOriginalView).toHaveBeenCalledOnce();
      });
    } finally {
      if (clipboardDescriptor) {
        Object.defineProperty(window.navigator, 'clipboard', clipboardDescriptor);
      } else {
        Reflect.deleteProperty(window.navigator, 'clipboard');
      }
    }
  });

  it('confirms terminal navigation only after the scoped route target is observed', async () => {
    document.body.innerHTML = `<main><table class="topic-list"><tbody>
      <tr data-topic-id="42"><td><a href="/t/synthetic-topic/42">Synthetic topic</a></td>
      <td class="posts">1</td><td class="views">2</td>
      <td class="activity"><a href="/t/synthetic-topic/42/2">now</a></td></tr>
    </tbody></table></main>`;
    let generation = 0;
    let redirectToTop = false;
    act(() => {
      mounted = mountWorkbench(
        document,
        'command-navigation-owner',
        recognizeLinuxDoRoute('https://linux.do/latest'),
      );
    });
    const navigate = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLAnchorElement) || !target.dataset.docodeCommandNavigation) return;
      event.preventDefault();
      const route = recognizeLinuxDoRoute(redirectToTop ? 'https://linux.do/top' : target.href);
      window.history.pushState({}, '', route.href);
      mounted?.updateRoute(route, ++generation, 'link');
    };
    document.addEventListener('click', navigate);

    try {
      const input = document.querySelector<HTMLInputElement>('.docode-terminal__input');
      const form = input?.closest('form');
      if (!input || !form) throw new Error('Missing terminal command prompt');
      fireEvent.change(input, { target: { value: 'hot' } });
      fireEvent.submit(form);
      await waitFor(() => {
        expect(activeTab()?.textContent).toContain('hot');
        expect(document.querySelector('.docode-terminal')?.textContent).toContain(
          'Opened hot topics.',
        );
      });

      redirectToTop = true;
      fireEvent.change(input, { target: { value: 'latest' } });
      fireEvent.submit(form);
      await waitFor(() => {
        expect(activeTab()?.textContent).toContain('top');
        expect(document.querySelector('.docode-terminal')?.textContent).toContain(
          'Navigation context changed before the target was confirmed.',
        );
      });
      expect(document.querySelector('.docode-terminal')?.textContent).not.toContain(
        'Opened latest topics.',
      );
    } finally {
      document.removeEventListener('click', navigate);
    }
  });

  it('opens a loaded topic from Quick Open through confirmed shared navigation', async () => {
    document.body.innerHTML = `<main><table class="topic-list"><tbody>
      <tr data-topic-id="42"><td><a href="/t/synthetic-topic/42">Synthetic topic</a></td>
      <td class="posts">1</td><td class="views">2</td>
      <td class="activity"><a href="/t/synthetic-topic/42/2">now</a></td></tr>
      <tr data-topic-id="43"><td><a href="/t/second-topic/43">Second topic</a></td>
      <td class="posts">3</td><td class="views">4</td>
      <td class="activity"><a href="/t/second-topic/43/2">later</a></td></tr>
    </tbody></table></main>`;
    let generation = 0;
    const navigatedHrefs: string[] = [];
    act(() => {
      mounted = mountWorkbench(
        document,
        'quick-open-navigation-owner',
        recognizeLinuxDoRoute('https://linux.do/latest'),
      );
    });
    const navigate = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLAnchorElement) || !target.dataset.docodeCommandNavigation) return;
      event.preventDefault();
      navigatedHrefs.push(target.href);
      mounted?.updateRoute(recognizeLinuxDoRoute(target.href), ++generation, 'link');
    };
    document.addEventListener('click', navigate);

    try {
      const trigger = document.querySelector<HTMLButtonElement>(
        '[aria-label="Search files and Linux DO topics"]',
      );
      if (!trigger) throw new Error('Missing Quick Open trigger');
      fireEvent.click(trigger);
      const input = await waitFor(() => {
        const element = document.querySelector<HTMLInputElement>(
          '[role="dialog"][aria-label="Quick Open"] [role="combobox"]',
        );
        if (!element) throw new Error('Missing Quick Open input');
        return element;
      });
      expect(document.activeElement).toBe(input);
      fireEvent.change(input, { target: { value: 'second topic' } });
      expect(document.querySelectorAll('[role="option"]')).toHaveLength(1);
      await act(async () => {
        fireEvent.keyDown(input, { key: 'Enter' });
        await Promise.resolve();
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(document.querySelector('[role="dialog"][aria-label="Quick Open"]')).toBeNull();
        expect(activeTab()?.textContent).toContain('topic:43');
      });
      expect(navigatedHrefs).toEqual(['https://linux.do/t/second-topic/43']);
      expect(tabLabels()).toEqual(['latest', 'topic:43']);
    } finally {
      document.removeEventListener('click', navigate);
    }
  });
});

function jsonTopic(id: number) {
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

function createReadyTopicFixture(
  topicId = 42,
  title = 'Synthetic topic',
  content = 'Native content',
): HTMLElement {
  const container = document.createElement('main');
  container.id = 'main-outlet';
  container.innerHTML = `<h1 data-topic-id="${String(topicId)}">
    <a class="fancy-title" href="/t/${topicId === 42 ? 'synthetic-topic' : 'next-topic'}/${String(topicId)}">${title}</a>
  </h1><div class="post-stream"><div data-post-number="1"><article data-post-id="100">
    <div class="names"><a data-user-card="alice" href="/u/alice">Alice</a></div>
    <a class="post-date" href="/t/${topicId === 42 ? 'synthetic-topic' : 'next-topic'}/${String(topicId)}"><span data-time="2026-08-18T00:00:00Z">now</span></a>
    <div class="cooked"><p>${content}</p></div>
    <button class="post-action-menu__copy-link">Copy</button>
  </article></div></div>`;
  return container;
}

function createReadyTopicListFixture(
  topicId: number,
  title: string,
  firstUnreadPostNumber: number | null = null,
): HTMLElement {
  const container = document.createElement('main');
  container.id = 'main-outlet';
  const topicPath = `/t/topic-${String(topicId)}/${String(topicId)}`;
  const titlePath =
    firstUnreadPostNumber === null ? topicPath : `${topicPath}/${String(firstUnreadPostNumber)}`;
  container.innerHTML = `<table class="topic-list"><tbody>
    <tr class="topic-list-item${firstUnreadPostNumber === null ? '' : ' unread-posts'}" data-topic-id="${String(topicId)}">
      <td class="main-link"><a class="title raw-topic-link" href="${titlePath}">${title}</a></td>
      <td class="posts">1</td><td class="views">10</td>
      <td class="activity"><a href="${topicPath}/2"><span data-time="2026-08-18T00:00:00Z">now</span></a></td>
    </tr>
  </tbody></table>`;
  return container;
}

function jsonPost(id: number, postNumber: number) {
  return {
    cooked: `<p>${postNumber === 1 ? 'First' : 'Second'} reply</p>`,
    created_at: '2026-08-18T00:00:00.000Z',
    id,
    name: postNumber === 1 ? 'Alice' : 'Bob',
    post_number: postNumber,
    topic_id: 42,
    user_id: postNumber,
    username: postNumber === 1 ? 'alice' : 'bob',
  };
}

function installLikeResponseObserver(): () => void {
  let callbacks: PerformanceObserverCallback[] = [];
  Object.defineProperty(window, 'PerformanceObserver', {
    configurable: true,
    value: class {
      readonly #callback: PerformanceObserverCallback;

      constructor(callback: PerformanceObserverCallback) {
        this.#callback = callback;
        callbacks.push(callback);
      }

      disconnect() {
        callbacks = callbacks.filter((callback) => callback !== this.#callback);
      }

      observe() {
        return undefined;
      }
    },
  });
  return () => {
    const entry = {
      entryType: 'resource',
      name: 'https://linux.do/discourse-reactions/posts/100/custom-reactions/heart/toggle.json',
      responseStatus: 200,
    } as unknown as PerformanceEntry;
    const entries = { getEntries: () => [entry] } as PerformanceObserverEntryList;
    for (const callback of [...callbacks]) {
      callback(entries, {} as PerformanceObserver);
    }
  };
}

function installPostResponseObserver(): (status?: number) => void {
  let callbacks: PerformanceObserverCallback[] = [];
  Object.defineProperty(window, 'PerformanceObserver', {
    configurable: true,
    value: class {
      readonly #callback: PerformanceObserverCallback;

      constructor(callback: PerformanceObserverCallback) {
        this.#callback = callback;
        callbacks.push(callback);
      }

      disconnect() {
        callbacks = callbacks.filter((callback) => callback !== this.#callback);
      }

      observe() {
        return undefined;
      }
    },
  });
  return (status = 200) => {
    const entry = {
      entryType: 'resource',
      name: 'https://linux.do/posts',
      responseStatus: status,
    } as unknown as PerformanceEntry;
    const entries = { getEntries: () => [entry] } as PerformanceObserverEntryList;
    for (const callback of [...callbacks]) callback(entries, {} as PerformanceObserver);
  };
}

function activeTab(): HTMLAnchorElement | null {
  return document.querySelector<HTMLAnchorElement>('[role="tab"][aria-selected="true"]');
}

function tabLabels(): string[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>('.docode-workbench__tabs [role="tab"]'),
  ).map((tab) => tab.querySelector('.docode-workbench__tab-label')?.textContent.trim() ?? '');
}

function openActiveTabMenu(): void {
  act(() => {
    activeTab()?.dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, clientX: 100, clientY: 40 }),
    );
  });
}

function menuItem(label: string): HTMLButtonElement | null {
  return (
    Array.from(
      document.querySelectorAll<HTMLButtonElement>('.docode-workbench__tab-menu-item'),
    ).find((item) => item.textContent.trim() === label) ?? null
  );
}
