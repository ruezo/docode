// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://linux.do/latest" }

import { afterEach, describe, expect, it } from 'vitest';

import {
  SPA_NAVIGATE_EVENT,
  SPA_NAVIGATE_RESULT_EVENT,
  readSpaNavigateDetail,
} from '../../src/linuxdo/pageBridge';
import { installWorkbenchSpaNavigation } from '../../src/linuxdo/spaNavigation';

let cleanup: (() => void)[] = [];

afterEach(() => {
  for (const dispose of cleanup) dispose();
  cleanup = [];
  document.body.innerHTML = '';
});

describe('installWorkbenchSpaNavigation', () => {
  it('claims workbench link clicks when the Discourse SPA bridge routes them', () => {
    const { anchor, requests } = setup('https://linux.do/t/synthetic-topic/42');
    installBridgeResponder(true);

    const event = click(anchor);

    expect(event.defaultPrevented).toBe(true);
    expect(requests).toEqual(['/t/synthetic-topic/42']);
  });

  it('leaves the click to the browser when the bridge cannot route', () => {
    const { anchor, requests } = setup('https://linux.do/hot');
    installBridgeResponder(false);

    const event = click(anchor);

    expect(event.defaultPrevented).toBe(false);
    expect(requests).toEqual(['/hot']);
  });

  it('leaves the click alone when no bridge answers at all', () => {
    const { anchor } = setup('https://linux.do/hot');

    const event = click(anchor);

    expect(event.defaultPrevented).toBe(false);
  });

  it('never hijacks clicks the workbench already handled itself', () => {
    const { anchor, requests } = setup('https://linux.do/hot');
    anchor.addEventListener('click', (event) => {
      event.preventDefault();
    });

    const event = click(anchor);

    expect(event.defaultPrevented).toBe(true);
    expect(requests).toEqual([]);
  });

  it('ignores anchors outside the workbench root', () => {
    const { requests } = setup('https://linux.do/hot');
    const outside = document.createElement('a');
    outside.href = 'https://linux.do/top';
    document.body.append(outside);

    const event = click(outside);

    expect(event.defaultPrevented).toBe(false);
    expect(requests).toEqual([]);
  });

  it('leaves modified, external, unsupported, and same-route clicks alone', () => {
    const { anchor, requests, root } = setup('https://linux.do/hot');
    installBridgeResponder(true);

    const modified = click(anchor, { ctrlKey: true });
    expect(modified.defaultPrevented).toBe(false);

    const external = appendAnchor(root, 'https://example.com/elsewhere');
    expect(click(external).defaultPrevented).toBe(false);

    const upload = appendAnchor(root, 'https://linux.do/uploads/default/original/x.png');
    expect(click(upload).defaultPrevented).toBe(false);

    const active = appendAnchor(root, 'https://linux.do/latest');
    expect(click(active).defaultPrevented).toBe(true);

    expect(requests).toEqual([]);
  });
});

function setup(href: string) {
  const root = document.createElement('div');
  document.body.append(root);
  const requests: string[] = [];
  const onNavigate = (event: Event) => {
    const detail = readSpaNavigateDetail(event);
    if (detail) requests.push(detail.path);
  };
  document.addEventListener(SPA_NAVIGATE_EVENT, onNavigate);
  const remove = installWorkbenchSpaNavigation(document, root);
  cleanup.push(() => {
    remove();
    document.removeEventListener(SPA_NAVIGATE_EVENT, onNavigate);
  });
  return { anchor: appendAnchor(root, href), requests, root };
}

function installBridgeResponder(ok: boolean): void {
  const onNavigate = (event: Event) => {
    const detail = readSpaNavigateDetail(event);
    if (!detail) return;
    document.dispatchEvent(
      new CustomEvent(SPA_NAVIGATE_RESULT_EVENT, {
        detail: JSON.stringify({ ok, path: detail.path }),
      }),
    );
  };
  document.addEventListener(SPA_NAVIGATE_EVENT, onNavigate);
  cleanup.push(() => {
    document.removeEventListener(SPA_NAVIGATE_EVENT, onNavigate);
  });
}

function appendAnchor(root: HTMLElement, href: string): HTMLAnchorElement {
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.textContent = href;
  root.append(anchor);
  return anchor;
}

function click(anchor: HTMLAnchorElement, init: MouseEventInit = {}): MouseEvent {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, ...init });
  anchor.dispatchEvent(event);
  return event;
}
