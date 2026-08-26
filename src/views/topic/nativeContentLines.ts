import type { NativePostContent } from '../../linuxdo/topicAdapter';

export const NATIVE_INLINE_IMAGE_SELECTOR = '.emoji, .avatar, [data-emoji]';
export const NATIVE_ONEBOX_SELECTOR = 'aside.onebox';
export const NATIVE_SCAFFOLD_ATTRIBUTE = 'data-docode-scaffold';
export const NATIVE_INJECTED_INLINE_SELECTOR =
  '.docode-topic-code__content-decl, .docode-topic-code__content-fold';

const BLOCK_LINE_TAGS = new Set([
  'blockquote',
  'details',
  'div',
  'figure',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'ol',
  'p',
  'pre',
  'table',
  'ul',
]);

export type NativeContentLineKind =
  'blank' | 'code' | 'heading' | 'link' | 'media' | 'quote' | 'scaffold' | 'text';

export interface NativeContentLineSummary {
  readonly indent: number;
  readonly kind: NativeContentLineKind;
  readonly text: string;
}

export function countNativeContentLines(content: NativePostContent | null): number {
  return content
    ? getNativeLineElements(content).reduce(
        (count, element) => count + countNativeElementLines(element),
        0,
      )
    : 1;
}

export function summarizeNativeContentLines(
  content: NativePostContent | null,
): readonly NativeContentLineSummary[] {
  if (!content) return [{ indent: 0, kind: 'text', text: 'Content unavailable' }];
  return getNativeLineElements(content).flatMap((element) =>
    nativeElementLineTexts(element).map((text) => ({
      indent: readNativeLineIndent(element),
      kind: readNativeContentLineKind(element),
      text,
    })),
  );
}

export function getNativeLineElements(content: NativePostContent): HTMLElement[] {
  return content.blocks.flatMap(({ element }) => getNativeBlockLineElements(element));
}

export function getNativeBlockLineElements(element: HTMLElement): HTMLElement[] {
  const tagName = element.tagName.toLowerCase();
  if (element.matches('aside.quote')) {
    const title = element.querySelector<HTMLElement>(':scope > .title');
    const body = element.querySelector<HTMLElement>(':scope > blockquote');
    const bodyLines = body ? getNativeBlockLineElements(body) : [];
    const lines = [...(title ? [title] : []), ...bodyLines];
    return lines.length > 0 ? lines : [element];
  }
  if (tagName === 'ul' || tagName === 'ol') {
    const items = Array.from(element.querySelectorAll<HTMLElement>('li'));
    return items.length > 0 ? items : [element];
  }
  if (tagName === 'blockquote') {
    const children = Array.from(element.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement && isBlockLineElement(child),
    );
    return children.length > 0 ? children.flatMap(getNativeBlockLineElements) : [element];
  }
  if (tagName === 'table') {
    const rows = Array.from(element.querySelectorAll<HTMLElement>('tr'));
    return rows.length > 0 ? rows : [element];
  }
  if (tagName === 'details') {
    const children = Array.from(element.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement,
    );
    return children.length > 0 ? children : [element];
  }
  return [element];
}

function isBlockLineElement(element: HTMLElement): boolean {
  return BLOCK_LINE_TAGS.has(element.tagName.toLowerCase());
}

export function readNativeLineIndent(element: HTMLElement): number {
  return element.matches('li, summary') || element.closest('blockquote') ? 1 : 0;
}

export function readNativeContentLineKind(element: HTMLElement): NativeContentLineKind {
  if (element.hasAttribute(NATIVE_SCAFFOLD_ATTRIBUTE)) return 'scaffold';
  const tagName = element.tagName.toLowerCase();
  if (element.matches(NATIVE_ONEBOX_SELECTOR)) return 'link';
  if (element.closest('aside.quote, blockquote')) return 'quote';
  if (/^h[1-6]$/.test(tagName)) return 'heading';
  if (tagName === 'pre' || tagName === 'code') return 'code';
  if (tagName === 'figure' || element.matches('img, video, audio')) return 'media';
  const text = normalizeNativeLineText(readNativeOwnText(element));
  if (!text && element.querySelector(`img:not(${NATIVE_INLINE_IMAGE_SELECTOR}), video, audio`)) {
    return 'media';
  }
  if (!text && !element.querySelector('img, video, audio')) return 'blank';
  return 'text';
}

export function nativeLineText(element: HTMLElement): string {
  if (element.matches(NATIVE_ONEBOX_SELECTOR)) return readOneboxLabel(element);
  if (element.matches('figure, img, video, audio')) {
    const media = element.matches('img, video, audio')
      ? element
      : element.querySelector<HTMLElement>('img, video, audio');
    if (media instanceof HTMLImageElement) {
      return `image: ${getNativeImageLabel(media)}`;
    }
    const mediaLabel = normalizeNativeLineText(media?.getAttribute('aria-label'));
    if (mediaLabel) return mediaLabel;
  }
  const text = normalizeNativeLineText(readNativeOwnText(element));
  if (element.matches('li')) return text ? `· ${text}` : '·';
  if (element.matches('summary')) return text ? `▾ ${text}` : '▾';
  return text || ' ';
}

export function nativeElementLineTexts(element: HTMLElement): readonly string[] {
  if (element.matches(NATIVE_ONEBOX_SELECTOR)) return [nativeLineText(element)];
  const tagName = element.tagName.toLowerCase();
  const containsBreak = element.querySelector('br') !== null;
  const preformattedText = tagName === 'pre' ? element.textContent : null;
  if (!containsBreak && !preformattedText?.includes('\n')) return [nativeLineText(element)];

  const text = containsBreak ? readTextWithBreaks(element) : (preformattedText ?? '');
  return text
    .replace(/\r\n?/gu, '\n')
    .split('\n')
    .map((line) => {
      const normalized = normalizeNativeLineText(line);
      if (element.matches('li')) return normalized ? `· ${normalized}` : '·';
      if (element.matches('summary')) return normalized ? `▾ ${normalized}` : '▾';
      return normalized || ' ';
    });
}

export function countNativeElementLines(element: HTMLElement): number {
  return nativeElementLineTexts(element).length;
}

function readTextWithBreaks(element: HTMLElement): string {
  let text = '';
  const append = (node: Node): void => {
    if (node instanceof Text) {
      text += node.data;
      return;
    }
    if (node instanceof HTMLBRElement) {
      text += '\n';
      return;
    }
    if (node instanceof HTMLElement && node.matches(NATIVE_INJECTED_INLINE_SELECTOR)) return;
    node.childNodes.forEach(append);
  };
  element.childNodes.forEach(append);
  return text;
}

export function readNativeOwnText(element: HTMLElement): string {
  if (!element.querySelector(NATIVE_INJECTED_INLINE_SELECTOR)) return element.textContent;
  let text = '';
  const append = (node: Node): void => {
    if (node instanceof Text) {
      text += node.data;
      return;
    }
    if (node instanceof HTMLElement && node.matches(NATIVE_INJECTED_INLINE_SELECTOR)) return;
    node.childNodes.forEach(append);
  };
  element.childNodes.forEach(append);
  return text;
}

export function normalizeNativeLineText(value: string | null | undefined): string {
  return value?.replace(/\s+/g, ' ').trim() ?? '';
}

export function readOneboxHref(onebox: HTMLElement): string | null {
  const candidates = [
    onebox.getAttribute('data-onebox-src'),
    onebox
      .querySelector(':scope > .onebox-body h3 a[href], :scope > .onebox-body h4 a[href]')
      ?.getAttribute('href'),
    onebox.querySelector(':scope > header.source a[href]')?.getAttribute('href'),
    onebox.querySelector('a[href]')?.getAttribute('href'),
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const url = new URL(candidate);
      if (url.protocol === 'https:' || url.protocol === 'http:') return url.href;
    } catch {
      continue;
    }
  }
  return null;
}

export function readOneboxLabel(onebox: HTMLElement): string {
  const title = normalizeNativeLineText(
    onebox.querySelector(':scope > .onebox-body h3, :scope > .onebox-body h4')?.textContent,
  );
  if (title) return title;
  const source = normalizeNativeLineText(
    onebox.querySelector(':scope > header.source')?.textContent,
  );
  return source || (readOneboxHref(onebox) ?? 'external link');
}

export function isGitHubHref(href: string): boolean {
  try {
    const { hostname } = new URL(href);
    return hostname === 'github.com' || hostname.endsWith('.github.com');
  } catch {
    return false;
  }
}

export function getNativeImageLabel(image: HTMLImageElement): string {
  const alt = image.alt.trim();
  if (alt) return alt;
  const title = image.title.trim();
  if (title) return title;
  try {
    const pathname = new URL(image.currentSrc || image.src, image.ownerDocument.baseURI).pathname;
    return pathname.split('/').filter(Boolean).at(-1) ?? 'preview';
  } catch {
    return 'preview';
  }
}
