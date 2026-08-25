// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://linux.do/t/synthetic-topic/42" }

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LinuxDoComposerAdapter } from '../../src/linuxdo/composerAdapter';
import {
  POST_REPLY_OPEN_EVENT,
  POST_REPLY_OPEN_RESULT_EVENT,
  readPostReplyOpenDetail,
} from '../../src/linuxdo/pageBridge';
import { recognizeLinuxDoRoute } from '../../src/linuxdo/routes';

const performanceCallbacks = new Set<PerformanceObserverCallback>();
let originalPerformanceObserver: typeof window.PerformanceObserver;

beforeEach(() => {
  originalPerformanceObserver = window.PerformanceObserver;
  class FixturePerformanceObserver {
    readonly #callback: PerformanceObserverCallback;

    constructor(callback: PerformanceObserverCallback) {
      this.#callback = callback;
      performanceCallbacks.add(callback);
    }

    disconnect(): void {
      performanceCallbacks.delete(this.#callback);
    }

    observe(): void {
      return undefined;
    }

    takeRecords(): PerformanceEntryList {
      return [];
    }
  }
  Object.defineProperty(window, 'PerformanceObserver', {
    configurable: true,
    value: FixturePerformanceObserver,
  });
  document.body.innerHTML = composerFixture('logged-in');
});

afterEach(() => {
  performanceCallbacks.clear();
  Object.defineProperty(window, 'PerformanceObserver', {
    configurable: true,
    value: originalPerformanceObserver,
  });
  document.body.innerHTML = '';
  window.history.replaceState({}, '', '/t/synthetic-topic/42');
});

describe('LinuxDoComposerAdapter', () => {
  it('opens and focuses the exact native Linux DO composer before confirming', async () => {
    const adapter = createAdapter();
    const reply = getButton('#topic-footer-buttons .create');
    const root = getElement('#reply-control');
    const editor = getTextArea();
    const nativeClick = vi.fn(() => {
      root.className = 'open hide-preview';
    });
    reply.addEventListener('click', nativeClick);

    const outcome = await adapter.open({ expectedGeneration: 0 });

    expect(outcome).toEqual({ dirty: false, kind: 'opened' });
    expect(nativeClick).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(editor);
    expect(adapter.snapshot.capability?.root).toBe(root);
    adapter.dispose();
  });

  it('opens a topic reply through the Shift+R shortcut when only floor Reply controls exist', async () => {
    document.querySelector('#topic-footer-buttons')?.remove();
    const postReply = document.createElement('button');
    postReply.className = 'post-action-menu__reply';
    postReply.textContent = 'Reply';
    document.querySelector('nav.post-controls')?.append(postReply);
    const postReplyClick = vi.fn();
    postReply.addEventListener('click', postReplyClick);
    const root = getElement('#reply-control');
    const shortcutKeys: string[] = [];
    document.body.addEventListener('keypress', (event) => {
      shortcutKeys.push(
        `${event.shiftKey ? 'shift+' : ''}${event.key}:${String(Reflect.get(event, 'which'))}`,
      );
      if (event.shiftKey && event.key === 'R') root.className = 'open hide-preview';
    });
    const adapter = createAdapter();

    const outcome = await adapter.open({ expectedGeneration: 0 });

    expect(outcome).toEqual({ dirty: false, kind: 'opened' });
    expect(postReplyClick).not.toHaveBeenCalled();
    expect(shortcutKeys).toEqual(['shift+R:82']);
    adapter.dispose();
  });

  it('opens a topic reply through the shortcut when no Reply control is rendered at all', async () => {
    document.querySelector('#topic-footer-buttons')?.remove();
    const root = getElement('#reply-control');
    document.body.addEventListener('keypress', (event) => {
      if (event.shiftKey && event.key === 'R') root.className = 'open hide-preview';
    });
    const adapter = createAdapter();

    await expect(adapter.open({ expectedGeneration: 0 })).resolves.toEqual({
      dirty: false,
      kind: 'opened',
    });
    adapter.dispose();
  });

  it('rejects duplicate open dispatch and releases the guard after confirmation', async () => {
    const adapter = createAdapter();
    const reply = getButton('#topic-footer-buttons .create');
    const root = getElement('#reply-control');
    const nativeClick = vi.fn();
    reply.addEventListener('click', nativeClick);

    const pending = adapter.open({ expectedGeneration: 0 });
    await expect(adapter.open({ expectedGeneration: 0 })).resolves.toMatchObject({
      code: 'action-in-progress',
      kind: 'failed',
      retryable: true,
    });
    expect(nativeClick).toHaveBeenCalledOnce();

    root.className = 'open hide-preview';
    await expect(pending).resolves.toEqual({ dirty: false, kind: 'opened' });
    await expect(adapter.open({ expectedGeneration: 0 })).resolves.toEqual({
      dirty: false,
      kind: 'unchanged',
    });
    expect(nativeClick).toHaveBeenCalledOnce();
    adapter.dispose();
  });

  it('resumes a real minimized draft without clicking the topic Reply control', async () => {
    const adapter = createAdapter();
    const reply = getButton('#topic-footer-buttons .create');
    const root = getElement('#reply-control');
    const editor = getTextArea();
    editor.value = 'Existing native draft';
    root.className = 'draft hide-preview';
    const replyClick = vi.fn();
    reply.addEventListener('click', replyClick);
    root.addEventListener('click', () => {
      root.className = 'open hide-preview';
    });

    await expect(adapter.open({ expectedGeneration: 0 })).resolves.toEqual({
      dirty: true,
      kind: 'opened',
    });
    expect(replyClick).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(editor);
    adapter.dispose();
  });

  it('never dispatches logged-out, stale, or disabled Reply controls', async () => {
    document.body.innerHTML = composerFixture('logged-out');
    const loggedOut = createAdapter();
    const loggedOutReply = getButton('#topic-footer-buttons .create');
    const click = vi.fn();
    loggedOutReply.addEventListener('click', click);
    await expect(loggedOut.open({ expectedGeneration: 0 })).resolves.toMatchObject({
      code: 'authentication-required',
      kind: 'failed',
    });
    expect(click).not.toHaveBeenCalled();
    loggedOut.dispose();

    document.body.innerHTML = composerFixture('logged-in');
    const stale = createAdapter();
    stale.observe(recognizeLinuxDoRoute('https://linux.do/t/synthetic-topic/42'), 2);
    await expect(stale.open({ expectedGeneration: 0 })).resolves.toMatchObject({
      code: 'stale-route',
      kind: 'failed',
    });
    stale.dispose();
  });

  it('aborts same-topic route changes and permits a fresh retry in the new generation', async () => {
    const adapter = createAdapter();
    const reply = getButton('#topic-footer-buttons .create');
    const root = getElement('#reply-control');
    const nativeClick = vi.fn();
    reply.addEventListener('click', nativeClick);
    const pending = adapter.open({ expectedGeneration: 0 });

    window.history.replaceState({}, '', '/t/synthetic-topic/42/2');
    adapter.observe(recognizeLinuxDoRoute(window.location.href), 1);

    await expect(pending).resolves.toMatchObject({ code: 'stale-route', kind: 'failed' });
    expect(nativeClick).toHaveBeenCalledOnce();

    reply.addEventListener('click', () => {
      root.className = 'open hide-preview';
    });
    await expect(adapter.open({ expectedGeneration: 1 })).resolves.toEqual({
      dirty: false,
      kind: 'opened',
    });
    expect(nativeClick).toHaveBeenCalledTimes(2);
    adapter.dispose();
  });

  it('aborts through the caller signal and permits a fresh open afterward', async () => {
    const adapter = createAdapter();
    const reply = getButton('#topic-footer-buttons .create');
    const root = getElement('#reply-control');
    const nativeClick = vi.fn();
    reply.addEventListener('click', nativeClick);
    const controller = new AbortController();
    const pending = adapter.open({ expectedGeneration: 0, signal: controller.signal });

    controller.abort();

    await expect(pending).resolves.toMatchObject({ code: 'aborted', kind: 'failed' });
    reply.addEventListener('click', () => {
      root.className = 'open hide-preview';
    });
    await expect(adapter.open({ expectedGeneration: 0 })).resolves.toEqual({
      dirty: false,
      kind: 'opened',
    });
    expect(nativeClick).toHaveBeenCalledTimes(2);
    adapter.dispose();
  });

  it('fails promptly when Linux DO removes the compatible Composer binding', async () => {
    const adapter = createAdapter();
    const root = getElement('#reply-control');
    const pending = adapter.open({ expectedGeneration: 0 });

    getButton('#topic-footer-buttons .create').remove();
    root.hidden = true;

    await expect(pending).resolves.toMatchObject({
      code: 'confirmation-timeout',
      kind: 'failed',
      message: 'Linux DO did not confirm that the composer opened.',
      retryable: true,
    });
    root.hidden = false;
    const replacement = document.createElement('button');
    replacement.className = 'btn-primary create';
    replacement.textContent = 'Reply';
    replacement.addEventListener('click', () => {
      root.className = 'open hide-preview';
    });
    document.querySelector('.topic-footer-main-buttons')?.append(replacement);
    await expect(adapter.open({ expectedGeneration: 0 })).resolves.toEqual({
      dirty: false,
      kind: 'opened',
    });
    adapter.dispose();
  });

  it('derives dirty state only from the native editor and draft class', async () => {
    const adapter = createAdapter();
    const changes = vi.fn();
    adapter.subscribe(changes);
    const root = getElement('#reply-control');
    const editor = getTextArea();
    root.className = 'open hide-preview';
    await mutationTurn();
    expect(adapter.snapshot.capability?.dirty).toBe(false);

    editor.value = 'Authoritative native draft';
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    expect(adapter.snapshot.capability).toMatchObject({ dirty: true, state: 'open', topicId: 42 });
    expect(changes).toHaveBeenCalled();

    editor.value = '';
    root.className = 'draft hide-preview';
    await mutationTurn();
    expect(adapter.snapshot.capability).toMatchObject({ dirty: true, state: 'draft' });
    adapter.dispose();
  });

  it('confirms submission only after the native response and composer closure', async () => {
    const adapter = createAdapter();
    const root = getElement('#reply-control');
    const editor = getTextArea();
    const submit = getButton('#reply-control button.create');
    root.className = 'open hide-preview';
    editor.value = 'A real reply';
    const states: string[] = [];
    adapter.subscribe(({ feedback }) => {
      if (feedback) states.push(feedback.kind);
    });
    submit.addEventListener('click', () => {
      root.className = 'saving hide-preview';
      root.className = 'closed hide-preview';
      editor.value = '';
      document
        .querySelector('.post-stream')
        ?.insertAdjacentHTML(
          'beforeend',
          '<div data-post-number="2"><article data-post-id="101"></article></div>',
        );
      emitPostResponse(200);
    });

    submit.click();
    await mutationTurn();

    expect(states).toContain('submitting');
    expect(states).toContain('submitted');
    expect(adapter.snapshot.feedback).toEqual({
      kind: 'submitted',
      message: 'Reply confirmed by Linux DO.',
    });
    expect(adapter.snapshot.capability).toMatchObject({ dirty: false, state: 'closed' });
    adapter.dispose();
  });

  it('opens a real floor Reply control and submits through the native composer', async () => {
    const adapter = createAdapter();
    const root = getElement('#reply-control');
    const editor = getTextArea();
    const postControls = getElement('.post-controls');
    const postReply = document.createElement('button');
    postReply.className = 'post-action-menu__reply';
    postReply.textContent = 'Reply to post';
    postControls.append(postReply);
    postReply.addEventListener('click', () => {
      root.className = 'open hide-preview';
    });
    getButton('#reply-control button.create').addEventListener('click', () => {
      root.className = 'closed hide-preview';
      editor.value = '';
      document
        .querySelector('.post-stream')
        ?.insertAdjacentHTML(
          'beforeend',
          '<div data-post-number="2"><article data-post-id="101"></article></div>',
        );
      emitPostResponse(200);
    });

    await expect(
      adapter.submit({ content: 'Native floor reply', expectedGeneration: 0, postNumber: 1 }),
    ).resolves.toEqual({ kind: 'submitted', postNumber: 1 });
    expect(editor.value).toBe('');
    expect(adapter.snapshot.feedback).toEqual({
      kind: 'submitted',
      message: 'Reply confirmed by Linux DO.',
    });
    adapter.dispose();
  });

  it('opens a post reply through the page bridge when the floor is not rendered', async () => {
    const adapter = createAdapter();
    const events = new AbortController();
    const root = getElement('#reply-control');
    const footerReplyClick = vi.fn();
    getButton('#topic-footer-buttons .create').addEventListener('click', footerReplyClick);
    const details: unknown[] = [];
    document.addEventListener(
      POST_REPLY_OPEN_EVENT,
      (event) => {
        details.push(readPostReplyOpenDetail(event));
        root.className = 'open hide-preview';
      },
      { signal: events.signal },
    );

    await expect(
      adapter.open({ expectedGeneration: 0, postId: 907, postNumber: 9 }),
    ).resolves.toEqual({ dirty: false, kind: 'opened' });
    expect(details).toEqual([{ postId: 907, postNumber: 9, topicId: 42 }]);
    expect(footerReplyClick).not.toHaveBeenCalled();
    events.abort();
    adapter.dispose();
  });

  it('fails fast when the page bridge cannot target the requested post', async () => {
    const adapter = createAdapter();
    const events = new AbortController();
    document.addEventListener(
      POST_REPLY_OPEN_EVENT,
      () => {
        document.dispatchEvent(
          new CustomEvent(POST_REPLY_OPEN_RESULT_EVENT, {
            detail: JSON.stringify({ ok: false }),
          }),
        );
      },
      { signal: events.signal },
    );

    await expect(
      adapter.open({ expectedGeneration: 0, postId: 907, postNumber: 9 }),
    ).resolves.toMatchObject({
      code: 'native-dispatch-failed',
      kind: 'failed',
      message: 'Linux DO could not open a Reply composer for this post.',
    });
    events.abort();
    adapter.dispose();
  });

  it('falls back to the rendered floor Reply control when the bridge reports failure', async () => {
    const adapter = createAdapter();
    const events = new AbortController();
    const root = getElement('#reply-control');
    const postReply = document.createElement('button');
    postReply.className = 'post-action-menu__reply';
    postReply.textContent = 'Reply to post';
    getElement('.post-controls').append(postReply);
    const postReplyClick = vi.fn(() => {
      root.className = 'open hide-preview';
    });
    postReply.addEventListener('click', postReplyClick);
    document.addEventListener(
      POST_REPLY_OPEN_EVENT,
      () => {
        document.dispatchEvent(
          new CustomEvent(POST_REPLY_OPEN_RESULT_EVENT, {
            detail: JSON.stringify({ ok: false }),
          }),
        );
      },
      { signal: events.signal },
    );

    await expect(
      adapter.open({ expectedGeneration: 0, postId: 100, postNumber: 1 }),
    ).resolves.toEqual({ dirty: false, kind: 'opened' });
    expect(postReplyClick).toHaveBeenCalledOnce();
    events.abort();
    adapter.dispose();
  });

  it('rejects a post reply without a post id when the floor is not rendered', async () => {
    const adapter = createAdapter();

    await expect(adapter.open({ expectedGeneration: 0, postNumber: 9 })).resolves.toMatchObject({
      code: 'native-control-not-found',
      kind: 'failed',
    });
    adapter.dispose();
  });

  it('surfaces a native submission failure and keeps the real draft open', async () => {
    const adapter = createAdapter();
    const root = getElement('#reply-control');
    const editor = getTextArea();
    const submit = getButton('#reply-control button.create');
    root.className = 'open hide-preview';
    editor.value = 'Draft that must survive';
    submit.addEventListener('click', () => {
      emitPostResponse(422);
    });

    submit.click();
    await mutationTurn();

    expect(adapter.snapshot.feedback).toEqual({
      kind: 'error',
      message: 'Linux DO rejected the reply. The native draft remains open.',
    });
    expect(adapter.snapshot.capability).toMatchObject({ dirty: true, state: 'open' });
    expect(editor.value).toBe('Draft that must survive');

    editor.value = 'Edited after failure';
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    expect(adapter.snapshot.feedback).toBeNull();
    adapter.dispose();
  });

  it('observes native cancel completion without clearing or simulating the draft itself', async () => {
    const adapter = createAdapter();
    const root = getElement('#reply-control');
    const editor = getTextArea();
    const cancel = getButton('#reply-control .discard-button');
    root.className = 'open hide-preview';
    editor.value = 'Discard through Linux DO';
    cancel.addEventListener('click', () => {
      editor.value = '';
      root.className = 'closed hide-preview';
    });

    cancel.click();
    await mutationTurn();

    expect(adapter.snapshot.capability).toMatchObject({ dirty: false, state: 'closed' });
    expect(adapter.snapshot.feedback).toBeNull();
    adapter.dispose();
  });
});

function createAdapter(): LinuxDoComposerAdapter {
  const adapter = new LinuxDoComposerAdapter(
    document,
    recognizeLinuxDoRoute(window.location.href),
    0,
    { confirmationTimeoutMs: 80 },
  );
  adapter.start();
  return adapter;
}

function composerFixture(user: 'logged-in' | 'logged-out'): string {
  const header =
    user === 'logged-in'
      ? '<header class="d-header"><div id="current-user" data-username="fixture-user"></div></header>'
      : '<header class="d-header"><button class="login-button">Log in</button></header>';
  return `${header}<main id="main-outlet">
    <div class="post-stream"><div data-post-number="1"><article data-post-id="100">
      <div class="cooked">Post</div><nav class="post-controls">
        <div class="discourse-reactions-actions can-toggle-reaction"><button class="btn-toggle-reaction-like">Like</button></div>
        <button class="post-action-menu__copy-link">Copy</button>
      </nav></article></div></div>
    <div id="topic-footer-buttons"><div class="topic-footer-main-buttons">
      <button class="btn-primary create">Reply</button>
    </div></div>
  </main>
  <div id="reply-control" class="closed hide-preview">
    <div class="reply-area"><div class="d-editor-textarea-wrapper">
      <textarea class="d-editor-input" aria-label="Reply"></textarea>
    </div><div class="submit-panel"><div class="save-or-cancel">
      <button class="btn-primary create">Reply</button>
      <button class="discard-button">Discard</button>
    </div></div></div>
  </div>`;
}

function emitPostResponse(responseStatus: number): void {
  const entry = {
    entryType: 'resource',
    name: 'https://linux.do/posts',
    responseStatus,
  } as unknown as PerformanceEntry;
  const entries = { getEntries: () => [entry] } as PerformanceObserverEntryList;
  for (const callback of [...performanceCallbacks]) callback(entries, {} as PerformanceObserver);
}

function getButton(selector: string): HTMLButtonElement {
  const button = document.querySelector<HTMLButtonElement>(selector);
  if (!button) throw new Error(`Missing button: ${selector}`);
  return button;
}

function getElement(selector: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
}

function getTextArea(): HTMLTextAreaElement {
  const editor = document.querySelector<HTMLTextAreaElement>('#reply-control .d-editor-input');
  if (!editor) throw new Error('Missing native composer editor');
  return editor;
}

async function mutationTurn(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => window.setTimeout(resolve, 0));
}
