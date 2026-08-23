import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LinuxDoRouteObserver, type LinuxDoRouteChange } from '../../src/linuxdo/routeObserver';

const doms: JSDOM[] = [];

afterEach(() => {
  for (const dom of doms.splice(0)) dom.window.close();
});

describe('LinuxDoRouteObserver', () => {
  it('publishes one normalized initial route and starts idempotently', () => {
    const dom = createDom('https://linux.do/latest');
    const observer = new LinuxDoRouteObserver(toRouteWindow(dom));
    const changes: LinuxDoRouteChange[] = [];
    observer.subscribe((change) => changes.push(change));

    expect(observer.start()).toBe(true);
    expect(observer.start()).toBe(false);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      current: { kind: 'topic-list', view: 'latest' },
      generation: 0,
      previous: null,
      repeated: false,
      source: 'initial',
    });
  });

  it('observes Discourse-style link navigation and repeated same-route transitions', async () => {
    const dom = createDom('https://linux.do/latest', '<a id="route" href="/hot">Hot</a>');
    const observer = new LinuxDoRouteObserver(toRouteWindow(dom));
    const subscriber = vi.fn<(change: LinuxDoRouteChange) => void>();
    observer.subscribe(subscriber);
    dom.window.document.addEventListener('click', (event) => {
      event.preventDefault();
      const anchor = event.target;
      if (anchor instanceof dom.window.HTMLAnchorElement) {
        dom.window.history.pushState({}, '', anchor.href);
      }
    });
    observer.start();

    dom.window.document.querySelector<HTMLElement>('#route')?.click();
    await waitForLinkCheck(dom);
    expect(subscriber.mock.calls.at(-1)?.[0]).toMatchObject({
      current: { kind: 'topic-list', view: 'hot' },
      generation: 1,
      repeated: false,
      source: 'link',
    });

    dom.window.document.querySelector<HTMLAnchorElement>('#route')?.setAttribute('href', '/hot');
    dom.window.document.querySelector<HTMLElement>('#route')?.click();
    await waitForLinkCheck(dom);
    expect(subscriber).toHaveBeenLastCalledWith(
      expect.objectContaining({ generation: 2, repeated: true, source: 'link' }),
    );
  });

  it('observes Back/Forward, hash, Navigation API, and canonical head changes', async () => {
    const dom = createDom(
      'https://linux.do/latest',
      '',
      '<link rel="canonical" href="https://linux.do/latest">',
    );
    const navigation = new dom.window.EventTarget();
    Object.defineProperty(dom.window, 'navigation', { configurable: true, value: navigation });
    const observer = new LinuxDoRouteObserver(toRouteWindow(dom));
    const changes: LinuxDoRouteChange[] = [];
    observer.subscribe((change) => changes.push(change));
    observer.start();

    dom.window.history.pushState({}, '', '/top');
    dom.window.dispatchEvent(new dom.window.PopStateEvent('popstate'));
    dom.window.history.replaceState({}, '', '/top#period');
    dom.window.dispatchEvent(new dom.window.HashChangeEvent('hashchange'));
    dom.window.history.replaceState({}, '', '/search?expanded=true&q=observer');
    navigation.dispatchEvent(new dom.window.Event('currententrychange'));
    dom.window.history.replaceState({}, '', '/u/synthetic-user');
    dom.window.document
      .querySelector('link[rel="canonical"]')
      ?.setAttribute('href', '/u/synthetic-user');
    await waitForMutation(dom);

    expect(changes.map(({ source }) => source)).toEqual([
      'initial',
      'popstate',
      'hashchange',
      'navigation',
      'document',
    ]);
    expect(changes.at(-1)).toMatchObject({
      current: { kind: 'user', username: 'synthetic-user' },
      generation: 4,
    });
  });

  it('stops every listener, observer, and pending link check', async () => {
    const dom = createDom('https://linux.do/latest', '<a id="route" href="/hot">Hot</a>');
    const observer = new LinuxDoRouteObserver(toRouteWindow(dom));
    const subscriber = vi.fn<(change: LinuxDoRouteChange) => void>();
    const unsubscribe = observer.subscribe(subscriber);
    observer.start();
    dom.window.document.querySelector<HTMLElement>('#route')?.click();

    expect(observer.stop()).toBe(true);
    expect(observer.stop()).toBe(false);
    dom.window.history.pushState({}, '', '/top');
    dom.window.dispatchEvent(new dom.window.PopStateEvent('popstate'));
    dom.window.document.head.append(dom.window.document.createElement('meta'));
    await waitForLinkCheck(dom);

    expect(subscriber).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it('publishes a repeated Navigation API entry change once', () => {
    const dom = createDom('https://linux.do/latest');
    const navigation = new dom.window.EventTarget();
    Object.defineProperty(dom.window, 'navigation', { configurable: true, value: navigation });
    const observer = new LinuxDoRouteObserver(toRouteWindow(dom));
    const changes: LinuxDoRouteChange[] = [];
    observer.subscribe((change) => changes.push(change));
    observer.start();

    navigation.dispatchEvent(new dom.window.Event('currententrychange'));

    expect(changes).toHaveLength(2);
    expect(changes[1]).toMatchObject({
      current: { kind: 'topic-list', view: 'latest' },
      generation: 1,
      repeated: true,
      source: 'navigation',
    });
  });
});

function createDom(href: string, body = '', head = ''): JSDOM {
  const dom = new JSDOM(`<!doctype html><html><head>${head}</head><body>${body}</body></html>`, {
    url: href,
  });
  doms.push(dom);
  return dom;
}

function waitForLinkCheck(dom: JSDOM): Promise<void> {
  return new Promise((resolve) => dom.window.setTimeout(resolve, 5));
}

function waitForMutation(dom: JSDOM): Promise<void> {
  return new Promise((resolve) => {
    dom.window.queueMicrotask(resolve);
  });
}

function toRouteWindow(dom: JSDOM): Window {
  return dom.window as unknown as Window;
}
