// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://linux.do/t/synthetic-topic/42" }

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  LinuxDoPostActionAdapter,
  type LinuxDoPostAction,
} from '../../src/linuxdo/postActionAdapter';
import type { LinuxDoLikeApiOutcome } from '../../src/linuxdo/postActionApiClient';
import { recognizeLinuxDoRoute } from '../../src/linuxdo/routes';

const performanceObserverDescriptor = Object.getOwnPropertyDescriptor(
  window,
  'PerformanceObserver',
);
let performanceObserverCallbacks: PerformanceObserverCallback[] = [];

beforeEach(() => {
  performanceObserverCallbacks = [];
  Object.defineProperty(window, 'PerformanceObserver', {
    configurable: true,
    value: class {
      readonly #callback: PerformanceObserverCallback;

      constructor(callback: PerformanceObserverCallback) {
        this.#callback = callback;
        performanceObserverCallbacks.push(callback);
      }

      disconnect() {
        performanceObserverCallbacks = performanceObserverCallbacks.filter(
          (callback) => callback !== this.#callback,
        );
      }

      observe() {
        return undefined;
      }
    },
  });
});

afterEach(() => {
  document.body.innerHTML = '';
  window.history.replaceState({}, '', '/t/synthetic-topic/42');
  vi.restoreAllMocks();
  if (performanceObserverDescriptor) {
    Object.defineProperty(window, 'PerformanceObserver', performanceObserverDescriptor);
  } else {
    Reflect.deleteProperty(window, 'PerformanceObserver');
  }
});

describe('LinuxDoPostActionAdapter', () => {
  it.each<LinuxDoPostAction>(['like', 'bookmark'])(
    'waits for the real %s state before confirming success',
    async (action) => {
      document.body.innerHTML = actionFixture('logged-in');
      const control = actionControl(action);
      const adapter = createAdapter();
      let settled = false;

      control.addEventListener('click', () => {
        expect(settled).toBe(false);
        window.setTimeout(() => {
          setActionActive(action, true);
          if (action === 'like') emitLikeResponse();
        }, 1);
      });
      const outcomePromise = adapter.execute(request(action)).then((outcome) => {
        settled = true;
        return outcome;
      });

      await Promise.resolve();
      expect(settled).toBe(false);
      await expect(outcomePromise).resolves.toEqual({ action, active: true, kind: 'confirmed' });
      expect(control).toHaveProperty('isConnected', true);
      adapter.dispose();
    },
  );

  it('does not finalize an optimistic Like that Linux DO rolls back', async () => {
    document.body.innerHTML = actionFixture('logged-in');
    const control = actionControl('like');
    const adapter = createAdapter({ confirmationTimeoutMs: 35, settleDelayMs: 12 });
    control.addEventListener('click', () => {
      setActionActive('like', true);
      emitLikeResponse();
      window.setTimeout(() => {
        setActionActive('like', false);
      }, 2);
    });

    await expect(adapter.execute(request('like'))).resolves.toMatchObject({
      action: 'like',
      code: 'confirmation-timeout',
      kind: 'failed',
    });
    adapter.dispose();
  });

  it('does not click Like when response confirmation is unavailable', async () => {
    document.body.innerHTML = actionFixture('logged-in');
    Reflect.deleteProperty(window, 'PerformanceObserver');
    const control = actionControl('like');
    const click = vi.spyOn(control, 'click');
    const adapter = createAdapter();

    await expect(adapter.execute(request('like'))).resolves.toMatchObject({
      code: 'native-dispatch-failed',
      kind: 'failed',
      retryable: false,
    });
    expect(click).not.toHaveBeenCalled();
    adapter.dispose();
  });

  it('maps a completed failing Like response without waiting for optimistic DOM state', async () => {
    document.body.innerHTML = actionFixture('logged-in');
    const control = actionControl('like');
    const adapter = createAdapter();
    control.addEventListener('click', () => {
      setActionActive('like', true);
      emitLikeResponse(403);
    });

    await expect(adapter.execute(request('like'))).resolves.toMatchObject({
      code: 'native-dispatch-failed',
      kind: 'failed',
      message: 'Linux DO rejected the Like request.',
    });
    adapter.dispose();
  });

  it('rejects duplicate native dispatch while the same post action is pending', async () => {
    document.body.innerHTML = actionFixture('logged-in');
    const control = actionControl('like');
    const click = vi.spyOn(control, 'click');
    const adapter = createAdapter();

    const pending = adapter.execute(request('like'));
    await expect(adapter.execute(request('like'))).resolves.toMatchObject({
      code: 'action-in-progress',
      kind: 'failed',
      retryable: true,
    });
    expect(click).toHaveBeenCalledOnce();

    setActionActive('like', true);
    emitLikeResponse();
    await expect(pending).resolves.toEqual({ action: 'like', active: true, kind: 'confirmed' });
    expect(click).toHaveBeenCalledOnce();
    adapter.dispose();
  });

  it('rejects logged-out dispatch without clicking a deferred-login native action', async () => {
    document.body.innerHTML = actionFixture('logged-out');
    const nativeLike = actionControl('like');
    const click = vi.spyOn(nativeLike, 'click');
    const adapter = createAdapter();

    await expect(adapter.execute(request('like'))).resolves.toMatchObject({
      code: 'authentication-required',
      kind: 'failed',
      retryable: false,
    });
    expect(click).not.toHaveBeenCalled();
    adapter.dispose();
  });

  it('aborts pending confirmation as stale when the observed route changes', async () => {
    document.body.innerHTML = actionFixture('logged-in');
    const adapter = createAdapter({ confirmationTimeoutMs: 100 });
    const pending = adapter.execute(request('bookmark'));

    adapter.observe(recognizeLinuxDoRoute('https://linux.do/hot'), 4);

    await expect(pending).resolves.toMatchObject({ code: 'stale-route', kind: 'failed' });
    adapter.dispose();
  });

  it('aborts through the caller signal and permits a fresh action afterward', async () => {
    document.body.innerHTML = actionFixture('logged-in');
    const control = actionControl('bookmark');
    const click = vi.spyOn(control, 'click');
    const controller = new AbortController();
    const adapter = createAdapter();
    const pending = adapter.execute({ ...request('bookmark'), signal: controller.signal });

    controller.abort();

    await expect(pending).resolves.toMatchObject({ code: 'aborted', kind: 'failed' });
    control.addEventListener('click', () => {
      control.classList.add('bookmarked');
    });
    await expect(adapter.execute(request('bookmark'))).resolves.toEqual({
      action: 'bookmark',
      active: true,
      kind: 'confirmed',
    });
    expect(click).toHaveBeenCalledTimes(2);
    adapter.dispose();
  });

  it('fails promptly when Linux DO removes the pending action binding', async () => {
    document.body.innerHTML = actionFixture('logged-in');
    const adapter = createAdapter({ confirmationTimeoutMs: 1_000 });
    const pending = adapter.execute(request('bookmark'));

    actionControl('bookmark').remove();

    await expect(pending).resolves.toMatchObject({
      code: 'native-control-not-found',
      kind: 'failed',
      message: 'Linux DO removed the compatible action binding before confirmation.',
      retryable: true,
    });
    const replacement = document.createElement('button');
    replacement.className = 'post-action-menu__bookmark bookmark';
    replacement.textContent = 'Bookmark';
    replacement.addEventListener('click', () => {
      replacement.classList.add('bookmarked');
    });
    document.querySelector('nav.post-controls')?.append(replacement);
    await expect(adapter.execute(request('bookmark'))).resolves.toEqual({
      action: 'bookmark',
      active: true,
      kind: 'confirmed',
    });
    adapter.dispose();
  });

  it('likes an unrendered post through the Like API fallback', async () => {
    document.body.innerHTML = actionFixture('logged-in');
    document.querySelector('article')?.remove();
    const toggles: number[] = [];
    const adapter = createAdapter({
      likeApi: {
        toggle: (postId) => {
          toggles.push(postId);
          return Promise.resolve({ active: true, kind: 'confirmed' });
        },
      },
    });

    await expect(adapter.execute(request('like'))).resolves.toEqual({
      action: 'like',
      active: true,
      kind: 'confirmed',
    });
    expect(toggles).toEqual([100]);
    adapter.dispose();
  });

  it('falls back to the Like API when the rendered post lacks a Like control', async () => {
    document.body.innerHTML = actionFixture('logged-in');
    document.querySelector('.discourse-reactions-actions')?.remove();
    const adapter = createAdapter({
      likeApi: { toggle: () => Promise.resolve({ active: false, kind: 'confirmed' }) },
    });

    await expect(adapter.execute(request('like'))).resolves.toEqual({
      action: 'like',
      active: false,
      kind: 'confirmed',
    });
    adapter.dispose();
  });

  it('maps Like API failures onto post action outcomes', async () => {
    document.body.innerHTML = actionFixture('logged-in');
    document.querySelector('article')?.remove();
    const adapter = createAdapter({
      likeApi: {
        toggle: () =>
          Promise.resolve({
            code: 'authentication-required',
            kind: 'failed',
            message: 'Sign in to Linux DO to like posts.',
            retryable: false,
          }),
      },
    });

    await expect(adapter.execute(request('like'))).resolves.toEqual({
      action: 'like',
      code: 'authentication-required',
      kind: 'failed',
      message: 'Sign in to Linux DO to like posts.',
      retryable: false,
    });
    adapter.dispose();
  });

  it('keeps the legacy unavailable outcome when the Like API is disabled', async () => {
    document.body.innerHTML = actionFixture('logged-in');
    document.querySelector('article')?.remove();
    const adapter = createAdapter({ likeApi: null });

    await expect(adapter.execute(request('like'))).resolves.toMatchObject({
      code: 'native-control-not-found',
      kind: 'failed',
    });
    adapter.dispose();
  });

  it('rejects an already stale generation before touching the native control', async () => {
    document.body.innerHTML = actionFixture('logged-in');
    const control = actionControl('bookmark');
    const click = vi.spyOn(control, 'click');
    const adapter = createAdapter();

    await expect(
      adapter.execute({ ...request('bookmark'), expectedGeneration: 2 }),
    ).resolves.toMatchObject({ code: 'stale-route', kind: 'failed' });
    expect(click).not.toHaveBeenCalled();
    adapter.dispose();
  });

  it('reports an existing real bookmark without dispatching a duplicate create', async () => {
    document.body.innerHTML = actionFixture('logged-in');
    setActionActive('bookmark', true);
    const control = actionControl('bookmark');
    const click = vi.spyOn(control, 'click');
    const adapter = createAdapter();

    await expect(adapter.execute(request('bookmark'))).resolves.toEqual({
      action: 'bookmark',
      active: true,
      kind: 'unchanged',
    });
    expect(click).not.toHaveBeenCalled();
    adapter.dispose();
  });

  it('reveals a collapsed native Bookmark control before dispatching it', async () => {
    document.body.innerHTML = actionFixture('logged-in');
    actionControl('bookmark').remove();
    const article = document.querySelector('article');
    if (!article) throw new Error('Missing post fixture');
    const showMore = document.createElement('button');
    showMore.className = 'post-action-menu__show-more show-more-actions';
    showMore.textContent = 'Show more';
    article.append(showMore);
    const revealClick = vi.spyOn(showMore, 'click');
    let bookmarkClickCount = 0;
    showMore.addEventListener('click', () => {
      const bookmark = document.createElement('button');
      bookmark.className = 'post-action-menu__bookmark bookmark';
      bookmark.textContent = 'Bookmark';
      bookmark.addEventListener('click', () => {
        bookmarkClickCount += 1;
        bookmark.classList.add('bookmarked');
      });
      showMore.replaceWith(bookmark);
    });
    const adapter = createAdapter();

    await expect(adapter.execute(request('bookmark'))).resolves.toEqual({
      action: 'bookmark',
      active: true,
      kind: 'confirmed',
    });
    expect(revealClick).toHaveBeenCalledOnce();
    expect(bookmarkClickCount).toBe(1);
    adapter.dispose();
  });
});

function createAdapter(
  options: {
    confirmationTimeoutMs?: number;
    likeApi?: {
      toggle(postId: number, signal?: AbortSignal): Promise<LinuxDoLikeApiOutcome>;
    } | null;
    settleDelayMs?: number;
  } = {},
) {
  return new LinuxDoPostActionAdapter(document, recognizeLinuxDoRoute(window.location.href), 3, {
    confirmationTimeoutMs: 100,
    settleDelayMs: 1,
    ...options,
  });
}

function request(action: LinuxDoPostAction) {
  return { action, expectedGeneration: 3, postId: 100, postNumber: 1 } as const;
}

function actionControl(action: LinuxDoPostAction): HTMLElement {
  const selector = action === 'like' ? '.btn-toggle-reaction-like' : '.post-action-menu__bookmark';
  const control = document.querySelector<HTMLElement>(selector);
  if (!control) throw new Error(`Missing ${action} control.`);
  return control;
}

function setActionActive(action: LinuxDoPostAction, active: boolean): void {
  const target =
    action === 'like'
      ? document.querySelector('.discourse-reactions-actions')
      : actionControl('bookmark');
  target?.classList.toggle(action === 'like' ? 'has-used-main-reaction' : 'bookmarked', active);
}

function actionFixture(user: 'logged-in' | 'logged-out'): string {
  const header =
    user === 'logged-in'
      ? '<header class="d-header"><div id="current-user" data-username="fixture-user"></div></header>'
      : '<header class="d-header"><button class="login-button">Log in</button></header>';
  return `${header}<main id="main-outlet"><div class="post-stream"><div data-post-number="1">
    <article data-post-id="100"><div class="cooked">Post</div><nav class="post-controls">
      <div class="discourse-reactions-actions can-toggle-reaction">
        <button class="btn-toggle-reaction-like">Like</button>
      </div>
      <button class="post-action-menu__bookmark bookmark">Bookmark</button>
    </nav></article></div></div><div id="topic-footer-buttons"><div class="topic-footer-main-buttons">
      <button class="btn-primary create">Reply</button>
    </div></div></main><div id="reply-control" class="closed"></div>`;
}

function emitLikeResponse(responseStatus = 200): void {
  const entry = {
    entryType: 'resource',
    name: 'https://linux.do/discourse-reactions/posts/100/custom-reactions/heart/toggle.json',
    responseStatus,
  } as unknown as PerformanceEntry;
  const entries = { getEntries: () => [entry] } as PerformanceObserverEntryList;
  for (const callback of [...performanceObserverCallbacks]) {
    callback(entries, {} as PerformanceObserver);
  }
}
