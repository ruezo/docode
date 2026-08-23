// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';

import {
  NATIVE_CONTENT_TRANSFER_MOUNT_EVENT,
  NATIVE_CONTENT_TRANSFER_MARKER,
  NativeContentTransfer,
  NativeContentTransferError,
} from '../../src/runtime/nativeContentTransfer';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('NativeContentTransfer', () => {
  it('moves an exact native node and restores its source position', async () => {
    document.body.innerHTML = `<main id="source"><span id="before"></span><div class="cooked">content</div><span id="after"></span></main><div id="host"></div>`;
    const source = requireElement('#source');
    const content = requireElement('.cooked');
    const host = requireElement('#host');
    const transfer = new NativeContentTransfer(document);

    const restore = transfer.mount(content, host);

    expect(host.firstElementChild).toBe(content);
    expect(content.hasAttribute(NATIVE_CONTENT_TRANSFER_MARKER)).toBe(true);
    expect(source.children).toHaveLength(2);
    expect(source.childNodes[1]?.nodeType).toBe(Node.COMMENT_NODE);
    restore();
    expect([...source.children].map(({ id, className }) => id || className)).toEqual([
      'before',
      'cooked',
      'after',
    ]);
    expect(source.children[1]).toBe(content);
    expect(host.children).toHaveLength(0);
    await Promise.resolve();
    expect(content.hasAttribute(NATIVE_CONTENT_TRANSFER_MARKER)).toBe(false);
    restore();
    expect(host.children).toHaveLength(0);
  });

  it('restores all mounted content and can be reused before disposal', () => {
    document.body.innerHTML = `<main><div id="one"></div><div id="two"></div></main><div id="host-one"></div><div id="host-two"></div>`;
    const one = requireElement('#one');
    const two = requireElement('#two');
    const transfer = new NativeContentTransfer(document);

    transfer.mount(one, requireElement('#host-one'));
    transfer.mount(two, requireElement('#host-two'));
    expect(transfer.restoreAll()).toBe(2);
    expect(document.querySelector('main')?.children[0]).toBe(one);
    expect(document.querySelector('main')?.children[1]).toBe(two);

    transfer.mount(one, requireElement('#host-one'));
    expect(one.hasAttribute(NATIVE_CONTENT_TRANSFER_MARKER)).toBe(true);
    expect(transfer.dispose()).toBe(true);
    expect(document.querySelector('main')?.children[0]).toBe(one);
    expect(one.hasAttribute(NATIVE_CONTENT_TRANSFER_MARKER)).toBe(false);
    expect(transfer.dispose()).toBe(false);
    expect(() => transfer.mount(one, requireElement('#host-one'))).toThrow(
      NativeContentTransferError,
    );
  });

  it('resolves transferred content through its unchanged native source owner', () => {
    document.body.innerHTML = `<main><article id="post"><div id="native-parent"><div class="cooked">content</div></div></article></main><div id="host"></div>`;
    const article = requireElement('#post');
    const content = requireElement('.cooked');
    const transfer = new NativeContentTransfer(document);

    transfer.mount(content, requireElement('#host'));

    expect(article.querySelector('.cooked')).toBeNull();
    expect(transfer.resolveSourceElement(article)).toBe(content);
    expect(transfer.resolveSourceElement(requireElement('#host'))).toBeNull();
  });

  it('reads restored source content without leaving the visible host empty', () => {
    document.body.innerHTML = `<main id="source"><div class="cooked">content</div></main><div id="host"></div>`;
    const source = requireElement('#source');
    const content = requireElement('.cooked');
    const host = requireElement('#host');
    const transfer = new NativeContentTransfer(document);
    let mountEvents = 0;
    content.addEventListener(NATIVE_CONTENT_TRANSFER_MOUNT_EVENT, () => {
      mountEvents += 1;
    });

    transfer.mount(content, host);
    const readContent = transfer.readWithContentRestored(() => {
      expect(source.querySelector('.cooked')).toBe(content);
      expect(host.children).toHaveLength(0);
      return content.textContent;
    });

    expect(readContent).toBe('content');
    expect(host.firstElementChild).toBe(content);
    expect(source.querySelector('.cooked')).toBeNull();
    expect(content.hasAttribute(NATIVE_CONTENT_TRANSFER_MARKER)).toBe(true);
    expect(mountEvents).toBe(2);
  });

  it('re-adopts visible content when a restored read fails', () => {
    document.body.innerHTML = `<main><div class="cooked"></div></main><div id="host"></div>`;
    const content = requireElement('.cooked');
    const host = requireElement('#host');
    const transfer = new NativeContentTransfer(document);

    transfer.mount(content, host);

    expect(() =>
      transfer.readWithContentRestored(() => {
        throw new Error('read failed');
      }),
    ).toThrow('read failed');
    expect(host.firstElementChild).toBe(content);
  });

  it('does not overwrite a concurrent native move', () => {
    document.body.innerHTML = `<main id="source"><div class="cooked"></div></main><div id="host"></div><section id="native-next"></section>`;
    const content = requireElement('.cooked');
    const source = requireElement('#source');
    const nativeNext = requireElement('#native-next');
    const transfer = new NativeContentTransfer(document);

    transfer.mount(content, requireElement('#host'));
    nativeNext.append(content);

    expect(transfer.restore(content)).toBe(true);
    expect(content.parentElement).toBe(nativeNext);
    expect(source.childNodes).toHaveLength(0);
  });

  it('detaches stale content when its source was removed during navigation', () => {
    document.body.innerHTML = `<main id="source"><div class="cooked"></div></main><div id="host"></div>`;
    const content = requireElement('.cooked');
    const source = requireElement('#source');
    const transfer = new NativeContentTransfer(document);

    transfer.mount(content, requireElement('#host'));
    source.remove();

    expect(transfer.restore(content)).toBe(true);
    expect(content.isConnected).toBe(false);
  });
});

function requireElement(selector: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`Missing fixture element: ${selector}`);
  return element;
}
