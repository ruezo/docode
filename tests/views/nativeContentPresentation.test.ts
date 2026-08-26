// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { NativePostContent } from '../../src/linuxdo/topicAdapter';
import { NativeContentTransfer } from '../../src/runtime/nativeContentTransfer';
import {
  countNativeContentLines,
  presentNativeContent,
  summarizeNativeContentLines,
} from '../../src/views/topic/nativeContentPresentation';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('nativeContentPresentation', () => {
  it('maps a semantic Linux DO quote title and body onto compact editor lines', () => {
    const root = document.createElement('div');
    root.className = 'cooked';
    root.innerHTML = `<aside class="quote" data-username="ander">
      <div class="title"><img class="avatar" alt="" src="/avatar.png">Ander:</div>
      <blockquote><p>cannot identify you with this ID</p><p>Second quoted line</p></blockquote>
    </aside>`;
    const quote = root.querySelector<HTMLElement>('aside.quote');
    if (!quote) throw new Error('Missing semantic quote fixture.');
    const content: NativePostContent = {
      blocks: [{ element: quote, kind: 'quote' }],
      root,
      source: 'linuxdo-owned-dom',
    };

    expect(countNativeContentLines(content)).toBe(3);
    expect(summarizeNativeContentLines(content)).toEqual([
      { indent: 0, kind: 'quote', text: 'Ander:' },
      { indent: 1, kind: 'quote', text: 'cannot identify you with this ID' },
      { indent: 1, kind: 'quote', text: 'Second quoted line' },
    ]);
    expect(root.querySelector<HTMLElement>('.title')?.textContent.trim()).toBe('Ander:');
    expect(root.querySelectorAll('blockquote > p')).toHaveLength(2);
  });

  it('keeps a missing native body explicit as one honest editor line', () => {
    expect(countNativeContentLines(null)).toBe(1);
    expect(summarizeNativeContentLines(null)).toEqual([
      { indent: 0, kind: 'text', text: 'Content unavailable' },
    ]);
  });

  it('classifies empty paragraphs as blank and image-only paragraphs as media', () => {
    const root = document.createElement('div');
    root.className = 'cooked';
    root.innerHTML = `<p></p>
      <p><a class="lightbox" href="/i.png"><img src="/i.png" alt="se_blast"></a></p>
      <p>想起了这个游戏</p>
      <p><img class="emoji" src="/e.png" alt=":smile:"></p>`;
    const [blank, imageOnly, text, emojiOnly] = Array.from(root.children) as HTMLElement[];
    if (!blank || !imageOnly || !text || !emojiOnly) throw new Error('Missing block fixtures.');
    const content: NativePostContent = {
      blocks: [
        { element: blank, kind: 'paragraph' },
        { element: imageOnly, kind: 'media' },
        { element: text, kind: 'paragraph' },
        { element: emojiOnly, kind: 'paragraph' },
      ],
      root,
      source: 'linuxdo-owned-dom',
    };

    expect(summarizeNativeContentLines(content).map(({ kind }) => kind)).toEqual([
      'blank',
      'media',
      'text',
      'text',
    ]);
  });

  it('counts explicit native hard breaks as visible editor lines', () => {
    const root = document.createElement('div');
    root.className = 'cooked';
    root.innerHTML = '<p>First line<br>Second <strong>line</strong><br><br>Fourth line</p>';
    const paragraph = root.querySelector<HTMLElement>('p');
    if (!paragraph) throw new Error('Missing hard-break fixture.');
    const content: NativePostContent = {
      blocks: [{ element: paragraph, kind: 'paragraph' }],
      root,
      source: 'linuxdo-owned-dom',
    };

    expect(countNativeContentLines(content)).toBe(4);
    expect(summarizeNativeContentLines(content)).toEqual([
      { indent: 0, kind: 'text', text: 'First line' },
      { indent: 0, kind: 'text', text: 'Second line' },
      { indent: 0, kind: 'text', text: ' ' },
      { indent: 0, kind: 'text', text: 'Fourth line' },
    ]);
  });

  it('presents a Discourse onebox card as one reversible VS Code-style link line', () => {
    document.body.innerHTML = `<main id="source"><div class="cooked"></div></main>
      <div data-docode-workbench-root><div class="docode-topic-code__content-slot"></div></div>`;
    const root = requireElement('.cooked');
    root.innerHTML = `<aside class="onebox githubrepo" data-onebox-src="https://github.com/ruezo/docode">
      <header class="source"><a href="https://github.com/ruezo/docode">github.com</a></header>
      <article class="onebox-body"><h3><a href="https://github.com/ruezo/docode">GitHub - ruezo/docode</a></h3><p>Card description<br>with breaks</p></article>
    </aside>
    <aside class="onebox"><header class="source"><a href="https://example.com/page">example.com</a></header><article class="onebox-body"><p>No title card</p></article></aside>
    <aside class="onebox"><header class="source"><a href="javascript:alert(1)">bad</a></header></aside>`;
    const [githubOnebox, plainOnebox, unsafeOnebox] = Array.from(root.children) as HTMLElement[];
    if (!githubOnebox || !plainOnebox || !unsafeOnebox) throw new Error('Missing onebox fixture.');
    const workbenchRoot = requireElement('[data-docode-workbench-root]');
    const content: NativePostContent = {
      blocks: [
        { element: githubOnebox, kind: 'paragraph' },
        { element: plainOnebox, kind: 'paragraph' },
        { element: unsafeOnebox, kind: 'paragraph' },
      ],
      root,
      source: 'linuxdo-owned-dom',
    };

    expect(countNativeContentLines(content)).toBe(3);
    expect(summarizeNativeContentLines(content)).toEqual([
      { indent: 0, kind: 'link', text: 'GitHub - ruezo/docode' },
      { indent: 0, kind: 'link', text: 'example.com' },
      { indent: 0, kind: 'link', text: 'bad' },
    ]);

    const restore = presentNativeContent(content, 12, workbenchRoot);
    const githubLink = githubOnebox.querySelector<HTMLAnchorElement>(
      ':scope > .docode-topic-code__onebox-link',
    );
    expect(githubOnebox.getAttribute('data-docode-onebox')).toBe('true');
    expect(githubOnebox.getAttribute('data-docode-editor-line-kind')).toBe('link');
    expect(githubOnebox.getAttribute('data-docode-editor-line-count')).toBe('1');
    expect(githubLink?.href).toBe('https://github.com/ruezo/docode');
    expect(githubLink?.target).toBe('_blank');
    expect(githubLink?.rel).toBe('noopener noreferrer');
    expect(githubLink?.querySelector('.codicon-github')?.getAttribute('aria-hidden')).toBe('true');
    expect(githubLink?.querySelector('.docode-topic-code__onebox-label')?.textContent).toBe(
      'GitHub - ruezo/docode',
    );
    const plainLink = plainOnebox.querySelector<HTMLAnchorElement>(
      ':scope > .docode-topic-code__onebox-link',
    );
    expect(plainLink?.href).toBe('https://example.com/page');
    expect(plainLink?.querySelector('.codicon-link-external')).not.toBeNull();
    expect(plainLink?.querySelector('.docode-topic-code__onebox-label')?.textContent).toBe(
      'example.com',
    );
    expect(unsafeOnebox.hasAttribute('data-docode-onebox')).toBe(false);
    expect(unsafeOnebox.querySelector('.docode-topic-code__onebox-link')).toBeNull();

    restore();
    expect(root.querySelectorAll('.docode-topic-code__onebox-link')).toHaveLength(0);
    expect(githubOnebox.hasAttribute('data-docode-onebox')).toBe(false);
    expect(githubOnebox.querySelector(':scope > header.source')).not.toBeNull();
  });

  it('realigns one line-number layer after native content is restored and re-adopted', async () => {
    document.body.innerHTML = `<main id="source"><div class="cooked"><p>Content</p></div></main>
      <div data-docode-workbench-root><div class="docode-topic-code__content-slot"></div></div>`;
    const root = requireElement('.cooked');
    const paragraph = requireElement('.cooked > p');
    const host = requireElement('.docode-topic-code__content-slot');
    const workbenchRoot = requireElement('[data-docode-workbench-root]');
    const transfer = new NativeContentTransfer(document);
    vi.spyOn(host, 'getBoundingClientRect').mockReturnValue(rect(100, 200));
    let paragraphTop = 140;
    vi.spyOn(paragraph, 'getBoundingClientRect').mockImplementation(() => rect(paragraphTop, 20));
    const content: NativePostContent = {
      blocks: [{ element: paragraph, kind: 'paragraph' }],
      root,
      source: 'linuxdo-owned-dom',
    };

    const restoreTransfer = transfer.mount(root, host);
    const restorePresentation = presentNativeContent(content, 12, workbenchRoot);
    await nextPaint();
    expect(requireElement('[data-docode-line-number="12"]').style.transform).toBe(
      'translateY(40px)',
    );

    paragraphTop = 260;
    transfer.readWithContentRestored(() => undefined);
    await nextPaint();

    expect(requireElement('[data-docode-line-number="12"]').style.transform).toBe(
      'translateY(160px)',
    );
    expect(document.querySelectorAll('.docode-topic-code__line-number-layer')).toHaveLength(1);
    restorePresentation();
    restoreTransfer();
  });

  it('replaces a stale line-number layer when the same content slot is presented again', async () => {
    document.body.innerHTML = `<main id="source"><div class="cooked"><p>Content</p></div></main>
      <div data-docode-workbench-root><div class="docode-topic-code__content-slot"></div></div>`;
    const root = requireElement('.cooked');
    const paragraph = requireElement('.cooked > p');
    const host = requireElement('.docode-topic-code__content-slot');
    const workbenchRoot = requireElement('[data-docode-workbench-root]');
    const transfer = new NativeContentTransfer(document);
    vi.spyOn(host, 'getBoundingClientRect').mockReturnValue(rect(100, 200));
    vi.spyOn(paragraph, 'getBoundingClientRect').mockReturnValue(rect(140, 20));
    const content: NativePostContent = {
      blocks: [{ element: paragraph, kind: 'paragraph' }],
      root,
      source: 'linuxdo-owned-dom',
    };

    const restoreTransfer = transfer.mount(root, host);
    const restoreFirstPresentation = presentNativeContent(content, 12, workbenchRoot);
    const restoreSecondPresentation = presentNativeContent(content, 12, workbenchRoot);
    await nextPaint();

    expect(document.querySelectorAll('.docode-topic-code__line-number-layer')).toHaveLength(1);
    expect(document.querySelectorAll('[data-docode-line-number="12"]')).toHaveLength(1);
    restoreFirstPresentation();
    expect(document.querySelectorAll('.docode-topic-code__line-number-layer')).toHaveLength(1);
    restoreSecondPresentation();
    expect(document.querySelectorAll('.docode-topic-code__line-number-layer')).toHaveLength(0);
    restoreTransfer();
  });
});

function requireElement(selector: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`Missing fixture element: ${selector}`);
  return element;
}

function rect(top: number, height: number): DOMRect {
  return {
    bottom: top + height,
    height,
    left: 0,
    right: 400,
    toJSON: () => undefined,
    top,
    width: 400,
    x: 0,
    y: top,
  };
}

async function nextPaint(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  });
}
