import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { LinuxDoRouteChange } from '../../src/linuxdo/routeObserver';
import {
  bootstrapContentRuntime,
  disableContentRuntime,
  getContentRuntimeCapabilityStatus,
} from '../../src/runtime/contentRuntime';

const doms: JSDOM[] = [];

afterEach(() => {
  for (const dom of doms.splice(0)) {
    disableContentRuntime(dom.window.document);
    dom.window.close();
  }
});

describe('content runtime route lifecycle', () => {
  it('normalizes route changes, invalidates stale work, and removes observation on disable', async () => {
    const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
      url: 'https://linux.do/latest',
    });
    doms.push(dom);
    const result = await bootstrapContentRuntime({
      document: dom.window.document,
      location: { hostname: 'linux.do', protocol: 'https:' },
      readEnabledState: () => Promise.resolve(true),
    });
    if (result.status !== 'mounted') throw new Error('Expected the route runtime to mount.');

    expect(result.runtime.currentRoute).toMatchObject({ kind: 'topic-list', view: 'latest' });
    const routeSubscriber = vi.fn<(change: LinuxDoRouteChange) => void>();
    result.runtime.subscribeToRoutes(routeSubscriber);
    const generation = result.runtime.captureGeneration();

    dom.window.history.pushState({}, '', '/hot');
    dom.window.dispatchEvent(new dom.window.PopStateEvent('popstate'));

    expect(result.runtime.isCurrentGeneration(generation)).toBe(false);
    expect(result.runtime.currentRoute).toMatchObject({ kind: 'topic-list', view: 'hot' });
    expect(routeSubscriber).toHaveBeenCalledOnce();
    expect(routeSubscriber.mock.calls[0]?.[0]).toMatchObject({
      current: { kind: 'topic-list', view: 'hot' },
      generation: 1,
      source: 'popstate',
    });

    expect(disableContentRuntime(dom.window.document)).toBe(true);
    dom.window.history.pushState({}, '', '/top');
    dom.window.dispatchEvent(new dom.window.PopStateEvent('popstate'));
    expect(routeSubscriber).toHaveBeenCalledOnce();
    expect(dom.window.document.documentElement.hasAttribute('data-docode-runtime')).toBe(false);
  });

  it('updates bounded capability status and disconnects its scoped observer on disable', async () => {
    const dom = new JSDOM(
      `<!doctype html><html><head></head><body>
        <header class="d-header"><div id="current-user" data-username="fixture-user"></div></header>
        <div id="main-outlet"><div class="post-stream"><div data-post-number="1">
          <article data-post-id="100"><nav class="post-controls">
            <button class="btn-toggle-reaction-like">Like</button>
            <button class="post-action-menu__copy-link">Copy</button>
          </nav></article>
        </div></div><div id="topic-footer-buttons"><div class="topic-footer-main-buttons"><button class="btn-primary create">Reply</button></div></div></div>
        <div id="reply-control" class="closed"></div>
      </body></html>`,
      { url: 'https://linux.do/t/synthetic-topic/42' },
    );
    doms.push(dom);
    const result = await bootstrapContentRuntime({
      document: dom.window.document,
      location: { hostname: 'linux.do', protocol: 'https:' },
      readEnabledState: () => Promise.resolve(true),
    });
    if (result.status !== 'mounted') throw new Error('Expected the capability runtime to mount.');

    expect(getContentRuntimeCapabilityStatus(dom.window.document)).toMatchObject({
      availableCopyLinkCount: 1,
      availableLikeCount: 1,
      generation: 0,
      postCount: 1,
      state: 'ready',
      userState: 'logged-in',
    });

    const like = dom.window.document.querySelector('.btn-toggle-reaction-like');
    like?.classList.add('disabled');
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));
    expect(getContentRuntimeCapabilityStatus(dom.window.document)).toMatchObject({
      availableCopyLinkCount: 1,
      availableLikeCount: 0,
      diagnosticCodes: ['native-control-disabled', 'native-control-not-found'],
      generation: 1,
    });

    expect(disableContentRuntime(dom.window.document)).toBe(true);
    const generationAfterDisable = result.runtime.capabilityGeneration;
    like?.classList.remove('disabled');
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));
    expect(result.runtime.capabilityGeneration).toBe(generationAfterDisable);
    expect(getContentRuntimeCapabilityStatus(dom.window.document)).toBeNull();
  });

  it('drops a queued compatibility refresh when disable invalidates the runtime', async () => {
    const dom = new JSDOM(
      `<!doctype html><html><head></head><body><main id="main-outlet">
        <div class="post-stream"><div data-post-number="1"><article data-post-id="100">
          <div class="cooked"><p>Native content</p></div>
        </article></div></div>
      </main></body></html>`,
      { url: 'https://linux.do/t/synthetic-topic/42' },
    );
    doms.push(dom);
    const result = await bootstrapContentRuntime({
      document: dom.window.document,
      location: { hostname: 'linux.do', protocol: 'https:' },
      readEnabledState: () => Promise.resolve(true),
    });
    if (result.status !== 'mounted')
      throw new Error('Expected the compatibility runtime to mount.');
    const capabilityGeneration = result.runtime.capabilityGeneration;

    dom.window.document
      .querySelector('article')
      ?.insertAdjacentHTML(
        'beforeend',
        '<button class="post-action-menu__copy-link">Copy</button>',
      );
    expect(disableContentRuntime(dom.window.document)).toBe(true);
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));

    expect(result.runtime.capabilityGeneration).toBe(capabilityGeneration);
    expect(getContentRuntimeCapabilityStatus(dom.window.document)).toBeNull();
    expect(dom.window.document.querySelector('[data-docode-workbench-root]')).toBeNull();
  });
});
