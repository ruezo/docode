import type { NativePostContent } from '../../linuxdo/topicAdapter';
import { NATIVE_CONTENT_TRANSFER_MOUNT_EVENT } from '../../runtime/nativeContentTransfer';
import { presentNativeCodeBlocks } from './codeBlockPresentation';

const LINE_ATTRIBUTE = 'data-docode-editor-line';
const LINE_COUNT_ATTRIBUTE = 'data-docode-editor-line-count';
const LINE_KIND_ATTRIBUTE = 'data-docode-editor-line-kind';
const LINE_NUMBER_ATTRIBUTE = 'data-docode-line-number';
const LINE_SPAN_PROPERTY = '--docode-topic-native-line-span';
const IMAGE_ATTRIBUTE = 'data-docode-image-source';
const IMAGE_TRIGGER_ATTRIBUTE = 'data-docode-image-trigger';
const PREVIEW_ATTRIBUTE = 'data-docode-image-preview';
const PREVIEW_FULLSCREEN_BUTTON_ATTRIBUTE = 'data-docode-image-fullscreen-button';
const FULLSCREEN_ATTRIBUTE = 'data-docode-image-fullscreen';
const FULLSCREEN_TOOLBAR_ATTRIBUTE = 'data-docode-image-toolbar';
const FULLSCREEN_VIEWPORT_ATTRIBUTE = 'data-docode-image-viewport';
const FULLSCREEN_CANVAS_ATTRIBUTE = 'data-docode-image-canvas';
const FULLSCREEN_ACTION_ATTRIBUTE = 'data-docode-image-action';
const PREVIEW_HIDE_DELAY = 120;
const IMAGE_SCALE_MIN = 0.05;
const IMAGE_SCALE_MAX = 8;
const IMAGE_WHEEL_SENSITIVITY = 0.002;
const INLINE_IMAGE_SELECTOR = '.emoji, .avatar, [data-emoji]';
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
const activeLineNumberLayers = new WeakMap<HTMLElement, () => void>();

export type NativeContentLineKind = 'code' | 'heading' | 'media' | 'quote' | 'text';

export interface NativeContentLineSummary {
  readonly indent: number;
  readonly kind: NativeContentLineKind;
  readonly text: string;
}

interface ImageDragSession {
  readonly pointerId: number;
  readonly startClientX: number;
  readonly startClientY: number;
  readonly startPanX: number;
  readonly startPanY: number;
}

export function countNativeContentLines(content: NativePostContent | null): number {
  return content
    ? getNativeLineElements(content).reduce(
        (count, element) => count + nativeElementLineTexts(element).length,
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
      indent: nativeLineIndent(element),
      kind: nativeLineKind(element),
      text,
    })),
  );
}

export function presentNativeContent(
  content: NativePostContent,
  firstLine: number,
  workbenchRoot: HTMLElement,
): () => void {
  const restoreLines = decorateLines(content, firstLine);
  const restoreCodeBlocks = presentNativeCodeBlocks(content.root);
  const restoreImages = decorateImages(content.root, workbenchRoot);
  const restoreLineNumbers = decorateLineNumbers(content.root);
  return () => {
    restoreLineNumbers();
    restoreImages();
    restoreCodeBlocks();
    restoreLines();
  };
}

function decorateLines(content: NativePostContent, firstLine: number): () => void {
  const lines = getNativeLineElements(content);
  const previous = lines.map((element) => ({
    count: element.getAttribute(LINE_COUNT_ATTRIBUTE),
    kind: element.getAttribute(LINE_KIND_ATTRIBUTE),
    line: element.getAttribute(LINE_ATTRIBUTE),
    styleAttribute: element.getAttribute('style'),
    spanPriority: element.style.getPropertyPriority(LINE_SPAN_PROPERTY),
    spanValue: element.style.getPropertyValue(LINE_SPAN_PROPERTY),
  }));
  let nextLine = firstLine;
  lines.forEach((element) => {
    const lineCount = nativeElementLineTexts(element).length;
    element.setAttribute(LINE_ATTRIBUTE, String(nextLine));
    element.setAttribute(LINE_COUNT_ATTRIBUTE, String(lineCount));
    element.setAttribute(LINE_KIND_ATTRIBUTE, nativeLineKind(element));
    element.style.setProperty(LINE_SPAN_PROPERTY, String(lineCount));
    nextLine += lineCount;
  });
  return () => {
    lines.forEach((element, index) => {
      const value = previous[index];
      element.classList.remove('docode-topic-code__active-line');
      if (value?.line == null) element.removeAttribute(LINE_ATTRIBUTE);
      else element.setAttribute(LINE_ATTRIBUTE, value.line);
      if (value?.count == null) element.removeAttribute(LINE_COUNT_ATTRIBUTE);
      else element.setAttribute(LINE_COUNT_ATTRIBUTE, value.count);
      if (value?.kind == null) element.removeAttribute(LINE_KIND_ATTRIBUTE);
      else element.setAttribute(LINE_KIND_ATTRIBUTE, value.kind);
      if (!value?.spanValue) element.style.removeProperty(LINE_SPAN_PROPERTY);
      else element.style.setProperty(LINE_SPAN_PROPERTY, value.spanValue, value.spanPriority);
      if (value?.styleAttribute == null && element.style.length === 0) {
        element.removeAttribute('style');
      }
    });
  };
}

function decorateLineNumbers(root: HTMLElement): () => void {
  const host = root.parentElement;
  if (!host?.classList.contains('docode-topic-code__content-slot')) return () => undefined;

  activeLineNumberLayers.get(host)?.();

  const elements = Array.from(root.querySelectorAll<HTMLElement>(`[${LINE_ATTRIBUTE}]`));
  const activeLine = root.ownerDocument.createElement('span');
  activeLine.className = 'docode-topic-code__active-line-overlay';
  activeLine.hidden = true;
  activeLine.setAttribute('aria-hidden', 'true');
  const layer = root.ownerDocument.createElement('span');
  layer.className = 'docode-topic-code__line-number-layer';
  layer.setAttribute('aria-hidden', 'true');
  const lines = elements.flatMap((element) => {
    const firstLine = Number(element.getAttribute(LINE_ATTRIBUTE));
    const lineCount = readLineCount(element);
    return Array.from({ length: lineCount }, (_, offset) => {
      const number = root.ownerDocument.createElement('span');
      const value = String(firstLine + offset);
      number.className = 'docode-topic-code__line-number';
      number.setAttribute(LINE_NUMBER_ATTRIBUTE, value);
      number.textContent = value;
      layer.append(number);
      return { element, number, offset };
    });
  });
  host.append(activeLine, layer);

  const layout = () => {
    if (root.parentElement !== host || !root.isConnected || !host.isConnected) return;
    const hostTop = host.getBoundingClientRect().top;
    const lineHeight = readLineHeight(host);
    lines.forEach(({ element, number, offset }) => {
      const top = element.getBoundingClientRect().top - hostTop + offset * lineHeight;
      number.style.transform = `translateY(${String(top)}px)`;
    });
    const activeNumber = layer.querySelector<HTMLElement>(
      '.docode-topic-code__line-number--active',
    );
    if (activeNumber) activeLine.style.transform = activeNumber.style.transform;
  };
  layout();
  const view = root.ownerDocument.defaultView;
  let frame: number | null = null;
  const scheduleLayout = () => {
    if (!view || frame !== null) return;
    frame = view.requestAnimationFrame(() => {
      frame = null;
      layout();
    });
  };
  const ResizeObserverConstructor = view?.ResizeObserver;
  const resizeObserver = ResizeObserverConstructor
    ? new ResizeObserverConstructor(scheduleLayout)
    : null;
  resizeObserver?.observe(host);
  resizeObserver?.observe(root);
  elements.forEach((element) => resizeObserver?.observe(element));
  scheduleLayout();
  root.addEventListener('load', scheduleLayout, true);
  root.addEventListener('toggle', scheduleLayout, true);
  root.addEventListener(NATIVE_CONTENT_TRANSFER_MOUNT_EVENT, scheduleLayout);

  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    if (frame !== null) view?.cancelAnimationFrame(frame);
    resizeObserver?.disconnect();
    root.removeEventListener('load', scheduleLayout, true);
    root.removeEventListener('toggle', scheduleLayout, true);
    root.removeEventListener(NATIVE_CONTENT_TRANSFER_MOUNT_EVENT, scheduleLayout);
    activeLine.remove();
    layer.remove();
    if (activeLineNumberLayers.get(host) === dispose) activeLineNumberLayers.delete(host);
  };
  activeLineNumberLayers.set(host, dispose);
  return dispose;
}

function readLineCount(element: HTMLElement): number {
  const value = Number(element.getAttribute(LINE_COUNT_ATTRIBUTE));
  return Number.isInteger(value) && value > 0 ? value : 1;
}

function readLineHeight(element: HTMLElement): number {
  const value = Number.parseFloat(
    element.ownerDocument.defaultView
      ?.getComputedStyle(element)
      .getPropertyValue('--docode-topic-line-height') ?? '',
  );
  return Number.isFinite(value) && value > 0 ? value : 20;
}

function getNativeLineElements(content: NativePostContent): HTMLElement[] {
  return content.blocks.flatMap(({ element }) => getBlockLineElements(element));
}

function getBlockLineElements(element: HTMLElement): HTMLElement[] {
  const tagName = element.tagName.toLowerCase();
  if (element.matches('aside.quote')) {
    const title = element.querySelector<HTMLElement>(':scope > .title');
    const body = element.querySelector<HTMLElement>(':scope > blockquote');
    const bodyLines = body ? getBlockLineElements(body) : [];
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
    return children.length > 0 ? children.flatMap(getBlockLineElements) : [element];
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

function nativeLineIndent(element: HTMLElement): number {
  return element.matches('li, summary') || element.closest('blockquote') ? 1 : 0;
}

function nativeLineKind(element: HTMLElement): NativeContentLineKind {
  const tagName = element.tagName.toLowerCase();
  if (element.closest('aside.quote, blockquote')) return 'quote';
  if (/^h[1-6]$/.test(tagName)) return 'heading';
  if (tagName === 'pre' || tagName === 'code') return 'code';
  if (tagName === 'figure' || element.matches('img, video, audio')) return 'media';
  return 'text';
}

function nativeLineText(element: HTMLElement): string {
  if (element.matches('figure, img, video, audio')) {
    const media = element.matches('img, video, audio')
      ? element
      : element.querySelector<HTMLElement>('img, video, audio');
    if (media instanceof HTMLImageElement) {
      return `image: ${getImageLabel(media)}`;
    }
    const mediaLabel = normalizeLineText(media?.getAttribute('aria-label'));
    if (mediaLabel) return mediaLabel;
  }
  const text = normalizeLineText(element.textContent);
  if (element.matches('li')) return text ? `· ${text}` : '·';
  if (element.matches('summary')) return text ? `▾ ${text}` : '▾';
  return text || ' ';
}

function nativeElementLineTexts(element: HTMLElement): readonly string[] {
  const tagName = element.tagName.toLowerCase();
  const containsBreak = element.querySelector('br') !== null;
  const preformattedText = tagName === 'pre' ? element.textContent : null;
  if (!containsBreak && !preformattedText?.includes('\n')) return [nativeLineText(element)];

  const text = containsBreak ? readTextWithBreaks(element) : (preformattedText ?? '');
  return text
    .replace(/\r\n?/gu, '\n')
    .split('\n')
    .map((line) => {
      const normalized = normalizeLineText(line);
      if (element.matches('li')) return normalized ? `· ${normalized}` : '·';
      if (element.matches('summary')) return normalized ? `▾ ${normalized}` : '▾';
      return normalized || ' ';
    });
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
    node.childNodes.forEach(append);
  };
  element.childNodes.forEach(append);
  return text;
}

function normalizeLineText(value: string | null | undefined): string {
  return value?.replace(/\s+/g, ' ').trim() ?? '';
}

function decorateImages(root: HTMLElement, workbenchRoot: HTMLElement): () => void {
  const cleanups: (() => void)[] = [];
  const images = Array.from(root.querySelectorAll<HTMLImageElement>('img')).filter(
    (image) => !image.matches(INLINE_IMAGE_SELECTOR),
  );
  images.forEach((source) => {
    const ownerLink = source.closest<HTMLAnchorElement>('a[href]');
    const previousImageMarker = source.getAttribute(IMAGE_ATTRIBUTE);
    const previousLinkClass = ownerLink?.getAttribute('class') ?? null;
    const previousLinkLabel = ownerLink?.getAttribute('data-docode-image-label') ?? null;
    const trigger = source.ownerDocument.createElement('span');
    const label = getImageLabel(source);
    trigger.setAttribute(IMAGE_TRIGGER_ATTRIBUTE, '');
    trigger.className = 'docode-topic-code__image-trigger';
    trigger.textContent = `image: ${label}`;
    const sourceLine = source.getAttribute(LINE_ATTRIBUTE);
    if (sourceLine) {
      trigger.setAttribute(LINE_ATTRIBUTE, sourceLine);
      source.removeAttribute(LINE_ATTRIBUTE);
    }
    source.before(trigger);
    source.setAttribute(IMAGE_ATTRIBUTE, '');

    const focusTarget = ownerLink && root.contains(ownerLink) ? ownerLink : trigger;
    if (focusTarget === trigger) {
      trigger.tabIndex = 0;
      trigger.setAttribute('role', 'button');
      trigger.setAttribute('aria-label', `Preview image: ${label}`);
    } else {
      ownerLink?.classList.add('docode-topic-code__image-link');
      ownerLink?.setAttribute('data-docode-image-label', label);
    }

    const preview = source.ownerDocument.createElement('span');
    preview.setAttribute(PREVIEW_ATTRIBUTE, '');
    preview.className = 'docode-topic-code__image-preview';
    preview.hidden = true;
    preview.setAttribute('role', 'group');
    preview.setAttribute('aria-label', `Image preview: ${label}`);
    const previewImage = cloneImage(source, 'docode-topic-code__image-preview-content');
    const fullscreenButton = createImageActionButton(
      source.ownerDocument,
      'docode-topic-code__image-preview-action',
      `Open full-screen image: ${label}`,
      'screen-full',
    );
    fullscreenButton.setAttribute(PREVIEW_FULLSCREEN_BUTTON_ATTRIBUTE, '');
    preview.append(previewImage);
    preview.append(fullscreenButton);
    workbenchRoot.append(preview);

    const fullscreen = source.ownerDocument.createElement('div');
    fullscreen.setAttribute(FULLSCREEN_ATTRIBUTE, '');
    fullscreen.className = 'docode-topic-code__image-fullscreen';
    fullscreen.hidden = true;
    fullscreen.setAttribute('role', 'dialog');
    fullscreen.setAttribute('aria-modal', 'true');
    fullscreen.setAttribute('aria-label', `Full-screen image: ${label}`);
    const currentSourceUrl = resolveImageUrl(source.currentSrc || source.src, source.ownerDocument);
    const originalSourceUrl = resolveOriginalImageUrl(source, ownerLink) ?? currentSourceUrl;
    const fullscreenViewport = source.ownerDocument.createElement('div');
    fullscreenViewport.setAttribute(FULLSCREEN_VIEWPORT_ATTRIBUTE, '');
    fullscreenViewport.className = 'docode-topic-code__image-fullscreen-viewport';
    const fullscreenCanvas = source.ownerDocument.createElement('div');
    fullscreenCanvas.setAttribute(FULLSCREEN_CANVAS_ATTRIBUTE, '');
    fullscreenCanvas.className = 'docode-topic-code__image-fullscreen-canvas';
    const fullscreenImage = cloneImage(
      source,
      'docode-topic-code__image-fullscreen-content',
      originalSourceUrl,
    );
    fullscreenImage.draggable = false;
    fullscreenCanvas.append(fullscreenImage);
    fullscreenViewport.append(fullscreenCanvas);
    const toolbar = source.ownerDocument.createElement('div');
    toolbar.setAttribute(FULLSCREEN_TOOLBAR_ATTRIBUTE, '');
    toolbar.className = 'docode-topic-code__image-fullscreen-toolbar';
    toolbar.setAttribute('role', 'toolbar');
    toolbar.setAttribute('aria-label', `Image tools: ${label}`);
    const zoomOutButton = createImageActionButton(
      source.ownerDocument,
      'docode-topic-code__image-viewer-action',
      `Zoom out image: ${label}`,
      'zoom-out',
      'zoom-out',
    );
    const actualSizeButton = createImageTextActionButton(
      source.ownerDocument,
      `Show image at actual size: ${label}`,
      'actual-size',
      '100%',
    );
    const zoomInButton = createImageActionButton(
      source.ownerDocument,
      'docode-topic-code__image-viewer-action',
      `Zoom in image: ${label}`,
      'zoom-in',
      'zoom-in',
    );
    const fitButton = createImageActionButton(
      source.ownerDocument,
      'docode-topic-code__image-viewer-action',
      `Fit image to viewer: ${label}`,
      'screen-normal',
      'fit',
    );
    const resetButton = createImageActionButton(
      source.ownerDocument,
      'docode-topic-code__image-viewer-action',
      `Reset image view: ${label}`,
      'refresh',
      'reset',
    );
    const rotateLeftButton = createImageActionButton(
      source.ownerDocument,
      'docode-topic-code__image-viewer-action docode-topic-code__image-viewer-action--reverse',
      `Rotate image left: ${label}`,
      'redo',
      'rotate-left',
    );
    const rotateRightButton = createImageActionButton(
      source.ownerDocument,
      'docode-topic-code__image-viewer-action',
      `Rotate image right: ${label}`,
      'redo',
      'rotate-right',
    );
    const flipHorizontalButton = createImageActionButton(
      source.ownerDocument,
      'docode-topic-code__image-viewer-action',
      `Flip image horizontally: ${label}`,
      'mirror',
      'flip-horizontal',
    );
    const flipVerticalButton = createImageActionButton(
      source.ownerDocument,
      'docode-topic-code__image-viewer-action docode-topic-code__image-viewer-action--vertical',
      `Flip image vertically: ${label}`,
      'mirror',
      'flip-vertical',
    );
    const closeButton = createImageActionButton(
      source.ownerDocument,
      'docode-topic-code__image-viewer-action docode-topic-code__image-fullscreen-close',
      `Close full-screen image: ${label}`,
      'close',
      'close',
    );
    toolbar.append(
      zoomOutButton,
      actualSizeButton,
      zoomInButton,
      fitButton,
      resetButton,
      createImageToolbarSeparator(source.ownerDocument),
      rotateLeftButton,
      rotateRightButton,
      flipHorizontalButton,
      flipVerticalButton,
      createImageToolbarSeparator(source.ownerDocument),
      closeButton,
    );
    fullscreen.append(fullscreenViewport, toolbar);
    workbenchRoot.append(fullscreen);

    const view = source.ownerDocument.defaultView;
    let hideTimer: number | null = null;
    let previousFocus: HTMLElement | null = null;
    let layoutFrame: number | null = null;
    let imageScale = 1;
    let imageRotation = 0;
    let imageFlipX = 1;
    let imageFlipY = 1;
    let imagePanX = 0;
    let imagePanY = 0;
    let imageSizing: 'actual' | 'custom' | 'fit' = 'fit';
    let dragSession: ImageDragSession | null = null;
    let usingOriginalSource = originalSourceUrl !== null && originalSourceUrl !== currentSourceUrl;
    const cancelHide = () => {
      if (hideTimer !== null) view?.clearTimeout(hideTimer);
      hideTimer = null;
    };

    const show = () => {
      cancelHide();
      if (!fullscreen.hidden) return;
      const rect = trigger.getBoundingClientRect();
      const viewportWidth = view?.innerWidth ?? 0;
      const viewportHeight = view?.innerHeight ?? 0;
      preview.hidden = false;
      const previewRect = preview.getBoundingClientRect();
      const left = Math.min(
        Math.max(8, rect.left),
        Math.max(8, viewportWidth - previewRect.width - 8),
      );
      const below = rect.bottom + 6;
      const top =
        below + previewRect.height <= viewportHeight - 8
          ? below
          : Math.max(8, rect.top - previewRect.height - 6);
      preview.style.left = `${String(left)}px`;
      preview.style.top = `${String(top)}px`;
    };
    const hide = () => {
      cancelHide();
      preview.hidden = true;
    };
    const scheduleHide = () => {
      cancelHide();
      hideTimer = view?.setTimeout(hide, PREVIEW_HIDE_DELAY) ?? null;
    };
    const readDimensions = () => ({
      height:
        fullscreenImage.naturalHeight ||
        source.naturalHeight ||
        Number(source.getAttribute('height')) ||
        1,
      width:
        fullscreenImage.naturalWidth ||
        source.naturalWidth ||
        Number(source.getAttribute('width')) ||
        1,
    });
    const applyImageTransform = () => {
      fullscreenImage.style.transform = `translate(calc(-50% + ${String(imagePanX)}px), calc(-50% + ${String(imagePanY)}px)) rotate(${String(imageRotation)}deg) scale(${String(imageFlipX)}, ${String(imageFlipY)})`;
      fullscreen.dataset.docodeImageRotation = String(imageRotation);
      fullscreen.dataset.docodeImageFlipX = String(imageFlipX);
      fullscreen.dataset.docodeImageFlipY = String(imageFlipY);
      fullscreen.dataset.docodeImagePanX = imagePanX.toFixed(1);
      fullscreen.dataset.docodeImagePanY = imagePanY.toFixed(1);
    };
    const applyImageView = () => {
      layoutFrame = null;
      const { height, width } = readDimensions();
      const sideways = Math.abs(imageRotation % 180) === 90;
      const viewportStyle = view?.getComputedStyle(fullscreenViewport);
      const horizontalPadding =
        Number.parseFloat(viewportStyle?.paddingLeft ?? '') +
        Number.parseFloat(viewportStyle?.paddingRight ?? '');
      const verticalPadding =
        Number.parseFloat(viewportStyle?.paddingTop ?? '') +
        Number.parseFloat(viewportStyle?.paddingBottom ?? '');
      const availableWidth = Math.max(
        1,
        (fullscreenViewport.clientWidth || (view?.innerWidth ?? width)) -
          (Number.isFinite(horizontalPadding) ? horizontalPadding : 0),
      );
      const availableHeight = Math.max(
        1,
        (fullscreenViewport.clientHeight || (view?.innerHeight ?? height)) -
          (Number.isFinite(verticalPadding) ? verticalPadding : 0),
      );
      if (imageSizing === 'fit') {
        const visualWidth = sideways ? height : width;
        const visualHeight = sideways ? width : height;
        imageScale = Math.min(
          1,
          Math.max(
            IMAGE_SCALE_MIN,
            Math.min(availableWidth / visualWidth, availableHeight / visualHeight),
          ),
        );
      }
      const renderedWidth = width * imageScale;
      const renderedHeight = height * imageScale;
      fullscreenCanvas.style.width = '100%';
      fullscreenCanvas.style.height = '100%';
      fullscreenImage.style.width = `${String(renderedWidth)}px`;
      fullscreenImage.style.height = `${String(renderedHeight)}px`;
      applyImageTransform();
      fullscreen.dataset.docodeImageScale = imageScale.toFixed(3);
      fullscreen.dataset.docodeImageSizing = imageSizing;
      fullscreen.dataset.docodeImageSource = usingOriginalSource ? 'original' : 'current';
      actualSizeButton.textContent = `${String(Math.round(imageScale * 100))}%`;
      zoomOutButton.disabled = imageScale <= IMAGE_SCALE_MIN;
      zoomInButton.disabled = imageScale >= IMAGE_SCALE_MAX;
    };
    const scheduleImageView = () => {
      if (!view || layoutFrame !== null) return;
      layoutFrame = view.requestAnimationFrame(applyImageView);
    };
    const centerImageView = () => {
      imagePanX = 0;
      imagePanY = 0;
      applyImageTransform();
    };
    const fitImage = () => {
      imageSizing = 'fit';
      applyImageView();
      centerImageView();
    };
    const showActualSize = () => {
      imageSizing = 'actual';
      imageScale = 1;
      applyImageView();
      centerImageView();
    };
    const zoomImage = (factor: number, anchor?: Readonly<{ clientX: number; clientY: number }>) => {
      const viewportRect = fullscreenViewport.getBoundingClientRect();
      const clientX = anchor?.clientX ?? viewportRect.left + viewportRect.width / 2;
      const clientY = anchor?.clientY ?? viewportRect.top + viewportRect.height / 2;
      const imageBefore = fullscreenImage.getBoundingClientRect();
      const pointOffsetX = (clientX - (imageBefore.left + imageBefore.width / 2)) / imageScale;
      const pointOffsetY = (clientY - (imageBefore.top + imageBefore.height / 2)) / imageScale;
      imageSizing = 'custom';
      imageScale = Math.min(IMAGE_SCALE_MAX, Math.max(IMAGE_SCALE_MIN, imageScale * factor));
      const canvasRect = fullscreenCanvas.getBoundingClientRect();
      imagePanX = clientX - (canvasRect.left + canvasRect.width / 2) - pointOffsetX * imageScale;
      imagePanY = clientY - (canvasRect.top + canvasRect.height / 2) - pointOffsetY * imageScale;
      applyImageView();
    };
    const finishImageDrag = (pointerId: number, releaseCapture: boolean) => {
      if (dragSession?.pointerId !== pointerId) return;
      dragSession = null;
      fullscreen.dataset.docodeImageDragging = 'false';
      if (
        releaseCapture &&
        typeof fullscreenImage.hasPointerCapture === 'function' &&
        fullscreenImage.hasPointerCapture(pointerId)
      ) {
        fullscreenImage.releasePointerCapture(pointerId);
      }
    };
    const handleImagePointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || !event.isPrimary) return;
      dragSession = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startPanX: imagePanX,
        startPanY: imagePanY,
      };
      fullscreen.dataset.docodeImageDragging = 'true';
      if (typeof fullscreenImage.setPointerCapture === 'function') {
        fullscreenImage.setPointerCapture(event.pointerId);
      }
      event.preventDefault();
      event.stopPropagation();
    };
    const handleImagePointerMove = (event: PointerEvent) => {
      const session = dragSession;
      if (session?.pointerId !== event.pointerId) return;
      imagePanX = session.startPanX + event.clientX - session.startClientX;
      imagePanY = session.startPanY + event.clientY - session.startClientY;
      applyImageTransform();
      event.preventDefault();
      event.stopPropagation();
    };
    const handleImagePointerUp = (event: PointerEvent) => {
      if (dragSession?.pointerId !== event.pointerId) return;
      finishImageDrag(event.pointerId, true);
      event.preventDefault();
      event.stopPropagation();
    };
    const handleImagePointerCancel = (event: PointerEvent) => {
      finishImageDrag(event.pointerId, false);
    };
    const handleImageWheel = (event: WheelEvent) => {
      if (fullscreen.hidden || event.deltaY === 0) return;
      const deltaUnit =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? Math.max(1, fullscreenViewport.clientHeight)
            : 1;
      const delta = Math.max(-120, Math.min(120, event.deltaY * deltaUnit));
      zoomImage(Math.exp(-delta * IMAGE_WHEEL_SENSITIVITY), {
        clientX: event.clientX,
        clientY: event.clientY,
      });
      event.preventDefault();
      event.stopPropagation();
    };
    const resetImage = () => {
      imageRotation = 0;
      imageFlipX = 1;
      imageFlipY = 1;
      fitImage();
    };
    const rotateImage = (degrees: number) => {
      imageRotation = (imageRotation + degrees + 360) % 360;
      applyImageView();
    };
    const flipImage = (axis: 'horizontal' | 'vertical') => {
      if (axis === 'horizontal') imageFlipX *= -1;
      else imageFlipY *= -1;
      applyImageView();
    };
    const openFullscreen = (focusReturn: HTMLElement) => {
      cancelHide();
      previousFocus = focusReturn;
      preview.hidden = true;
      fullscreen.hidden = false;
      fullscreen.dataset.docodeImageDragging = 'false';
      resetImage();
      scheduleImageView();
      closeButton.focus();
    };
    const closeFullscreen = () => {
      if (fullscreen.hidden) return;
      if (dragSession) finishImageDrag(dragSession.pointerId, true);
      fullscreen.hidden = true;
      const focus = previousFocus;
      previousFocus = null;
      if (focus === fullscreenButton) show();
      if (focus?.isConnected) focus.focus();
    };
    const handleFullscreenClick = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      openFullscreen(fullscreenButton);
    };
    const handleCloseClick = () => {
      closeFullscreen();
    };
    const handleFullscreenBackdrop = (event: PointerEvent) => {
      if (event.target === fullscreen || event.target === fullscreenViewport) closeFullscreen();
    };
    const handleFullscreenKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeFullscreen();
        return;
      }
      if (event.key === 'Tab') {
        const controls = Array.from(
          toolbar.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
        );
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && source.ownerDocument.activeElement === first && last) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && source.ownerDocument.activeElement === last && first) {
          event.preventDefault();
          first.focus();
        }
        return;
      }
      if (event.key === '+' || event.key === '=') zoomImage(1.25);
      else if (event.key === '-') zoomImage(0.8);
      else if (event.key === '0') resetImage();
      else if (event.key === '1') showActualSize();
      else if (event.key.toLowerCase() === 'r') rotateImage(event.shiftKey ? -90 : 90);
      else if (event.key.toLowerCase() === 'h') flipImage('horizontal');
      else if (event.key.toLowerCase() === 'v') flipImage('vertical');
      else return;
      event.preventDefault();
      event.stopPropagation();
    };
    const handleZoomOutClick = () => {
      zoomImage(0.8);
    };
    const handleZoomInClick = () => {
      zoomImage(1.25);
    };
    const handleRotateLeftClick = () => {
      rotateImage(-90);
    };
    const handleRotateRightClick = () => {
      rotateImage(90);
    };
    const handleFlipHorizontalClick = () => {
      flipImage('horizontal');
    };
    const handleFlipVerticalClick = () => {
      flipImage('vertical');
    };
    const handleOriginalLoadFailure = () => {
      if (!usingOriginalSource || !currentSourceUrl) return;
      usingOriginalSource = false;
      fullscreenImage.src = currentSourceUrl;
      fullscreen.dataset.docodeImageSource = 'current';
    };
    const handleImageLoad = () => {
      if (!fullscreen.hidden) fitImage();
    };
    const handleResize = () => {
      if (!fullscreen.hidden && imageSizing === 'fit') scheduleImageView();
    };
    const handleTriggerKeydown = (event: KeyboardEvent) => {
      if (focusTarget !== trigger || (event.key !== 'Enter' && event.key !== ' ')) return;
      event.preventDefault();
      openFullscreen(trigger);
    };
    focusTarget.addEventListener('pointerenter', show);
    focusTarget.addEventListener('pointerleave', scheduleHide);
    focusTarget.addEventListener('focusin', show);
    focusTarget.addEventListener('focusout', scheduleHide);
    focusTarget.addEventListener('keydown', handleTriggerKeydown);
    preview.addEventListener('pointerenter', cancelHide);
    preview.addEventListener('pointerleave', scheduleHide);
    preview.addEventListener('focusin', show);
    preview.addEventListener('focusout', scheduleHide);
    fullscreenButton.addEventListener('click', handleFullscreenClick);
    zoomOutButton.addEventListener('click', handleZoomOutClick);
    actualSizeButton.addEventListener('click', showActualSize);
    zoomInButton.addEventListener('click', handleZoomInClick);
    fitButton.addEventListener('click', fitImage);
    resetButton.addEventListener('click', resetImage);
    rotateLeftButton.addEventListener('click', handleRotateLeftClick);
    rotateRightButton.addEventListener('click', handleRotateRightClick);
    flipHorizontalButton.addEventListener('click', handleFlipHorizontalClick);
    flipVerticalButton.addEventListener('click', handleFlipVerticalClick);
    closeButton.addEventListener('click', handleCloseClick);
    fullscreen.addEventListener('pointerdown', handleFullscreenBackdrop);
    fullscreen.addEventListener('keydown', handleFullscreenKeydown);
    fullscreenViewport.addEventListener('wheel', handleImageWheel, { passive: false });
    fullscreenImage.addEventListener('pointerdown', handleImagePointerDown);
    fullscreenImage.addEventListener('pointermove', handleImagePointerMove);
    fullscreenImage.addEventListener('pointerup', handleImagePointerUp);
    fullscreenImage.addEventListener('pointercancel', handleImagePointerCancel);
    fullscreenImage.addEventListener('lostpointercapture', handleImagePointerCancel);
    fullscreenImage.addEventListener('error', handleOriginalLoadFailure);
    fullscreenImage.addEventListener('load', handleImageLoad);
    view?.addEventListener('resize', handleResize);
    cleanups.push(() => {
      cancelHide();
      if (layoutFrame !== null) view?.cancelAnimationFrame(layoutFrame);
      focusTarget.removeEventListener('pointerenter', show);
      focusTarget.removeEventListener('pointerleave', scheduleHide);
      focusTarget.removeEventListener('focusin', show);
      focusTarget.removeEventListener('focusout', scheduleHide);
      focusTarget.removeEventListener('keydown', handleTriggerKeydown);
      preview.removeEventListener('pointerenter', cancelHide);
      preview.removeEventListener('pointerleave', scheduleHide);
      preview.removeEventListener('focusin', show);
      preview.removeEventListener('focusout', scheduleHide);
      fullscreenButton.removeEventListener('click', handleFullscreenClick);
      zoomOutButton.removeEventListener('click', handleZoomOutClick);
      actualSizeButton.removeEventListener('click', showActualSize);
      zoomInButton.removeEventListener('click', handleZoomInClick);
      fitButton.removeEventListener('click', fitImage);
      resetButton.removeEventListener('click', resetImage);
      rotateLeftButton.removeEventListener('click', handleRotateLeftClick);
      rotateRightButton.removeEventListener('click', handleRotateRightClick);
      flipHorizontalButton.removeEventListener('click', handleFlipHorizontalClick);
      flipVerticalButton.removeEventListener('click', handleFlipVerticalClick);
      closeButton.removeEventListener('click', handleCloseClick);
      fullscreen.removeEventListener('pointerdown', handleFullscreenBackdrop);
      fullscreen.removeEventListener('keydown', handleFullscreenKeydown);
      fullscreenViewport.removeEventListener('wheel', handleImageWheel);
      fullscreenImage.removeEventListener('pointerdown', handleImagePointerDown);
      fullscreenImage.removeEventListener('pointermove', handleImagePointerMove);
      fullscreenImage.removeEventListener('pointerup', handleImagePointerUp);
      fullscreenImage.removeEventListener('pointercancel', handleImagePointerCancel);
      fullscreenImage.removeEventListener('lostpointercapture', handleImagePointerCancel);
      fullscreenImage.removeEventListener('error', handleOriginalLoadFailure);
      fullscreenImage.removeEventListener('load', handleImageLoad);
      view?.removeEventListener('resize', handleResize);
      if (dragSession) finishImageDrag(dragSession.pointerId, true);
      previousFocus = null;
      if (previousImageMarker === null) source.removeAttribute(IMAGE_ATTRIBUTE);
      else source.setAttribute(IMAGE_ATTRIBUTE, previousImageMarker);
      if (sourceLine) source.setAttribute(LINE_ATTRIBUTE, sourceLine);
      trigger.remove();
      preview.remove();
      fullscreen.remove();
      if (ownerLink) {
        if (previousLinkClass === null) ownerLink.removeAttribute('class');
        else ownerLink.setAttribute('class', previousLinkClass);
        if (previousLinkLabel === null) ownerLink.removeAttribute('data-docode-image-label');
        else ownerLink.setAttribute('data-docode-image-label', previousLinkLabel);
      }
    });
  });
  return () => {
    cleanups.reverse().forEach((cleanup) => {
      cleanup();
    });
  };
}

function cloneImage(
  source: HTMLImageElement,
  className: string,
  sourceUrl?: string | null,
): HTMLImageElement {
  const image = source.cloneNode(false) as HTMLImageElement;
  image.removeAttribute('id');
  image.removeAttribute(IMAGE_ATTRIBUTE);
  image.removeAttribute('style');
  Array.from(image.attributes).forEach(({ name }) => {
    if (name.toLowerCase().startsWith('on')) image.removeAttribute(name);
  });
  if (sourceUrl) {
    image.removeAttribute('srcset');
    image.removeAttribute('sizes');
    image.removeAttribute('loading');
    image.removeAttribute('width');
    image.removeAttribute('height');
    image.src = sourceUrl;
  }
  image.className = className;
  return image;
}

type ImageActionIcon =
  | 'close'
  | 'mirror'
  | 'redo'
  | 'refresh'
  | 'screen-full'
  | 'screen-normal'
  | 'zoom-in'
  | 'zoom-out';

function createImageActionButton(
  document: Document,
  className: string,
  label: string,
  icon: ImageActionIcon,
  action?: string,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.setAttribute('aria-label', label);
  if (action) button.setAttribute(FULLSCREEN_ACTION_ATTRIBUTE, action);
  const glyph = document.createElement('span');
  glyph.className = `codicon codicon-${icon} docode-codicon`;
  glyph.setAttribute('aria-hidden', 'true');
  button.append(glyph);
  return button;
}

function createImageTextActionButton(
  document: Document,
  label: string,
  action: string,
  text: string,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'docode-topic-code__image-viewer-action docode-topic-code__image-viewer-scale';
  button.setAttribute('aria-label', label);
  button.setAttribute(FULLSCREEN_ACTION_ATTRIBUTE, action);
  button.textContent = text;
  return button;
}

function createImageToolbarSeparator(document: Document): HTMLSpanElement {
  const separator = document.createElement('span');
  separator.className = 'docode-topic-code__image-viewer-separator';
  separator.setAttribute('role', 'separator');
  return separator;
}

function resolveOriginalImageUrl(
  image: HTMLImageElement,
  ownerLink: HTMLAnchorElement | null,
): string | null {
  for (const attribute of ['data-original-src', 'data-orig-src', 'data-large-src']) {
    const value = resolveImageUrl(image.getAttribute(attribute), image.ownerDocument);
    if (value) return value;
  }
  if (
    ownerLink?.matches(
      '.lightbox, [data-download-href], [data-original-href], [data-docode-image-original]',
    )
  ) {
    return (
      resolveImageUrl(ownerLink.getAttribute('data-original-href'), image.ownerDocument) ??
      resolveImageUrl(ownerLink.getAttribute('data-download-href'), image.ownerDocument) ??
      resolveImageUrl(ownerLink.getAttribute('href'), image.ownerDocument)
    );
  }
  return null;
}

function resolveImageUrl(value: string | null | undefined, document: Document): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, document.baseURI);
    return ['blob:', 'data:', 'http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function getImageLabel(image: HTMLImageElement): string {
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
