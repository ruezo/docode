// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://linux.do/t/synthetic-topic/42/2" }

import { cleanup, fireEvent, render, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { detectLinuxDoCapabilities } from '../../src/linuxdo/capabilities';
import { recognizeLinuxDoRoute } from '../../src/linuxdo/routes';
import { extractTopic } from '../../src/linuxdo/topicAdapter';
import { NativeContentTransfer } from '../../src/runtime/nativeContentTransfer';
import {
  TopicCodeEditorSurface,
  type ReadyTopicDetailDocument,
} from '../../src/views/topic/TopicCodeDocumentView';
import { createTopicDetailDocument } from '../../src/views/topic/topicDetailDocument';
import { findViewportPostId } from '../../src/views/topic/topicViewport';
import type {
  ResolveTopicPostCommand,
  RunTopicPostCommand,
} from '../../src/views/topic/TopicPostAffordances';

const originalWindowFetch: unknown = Reflect.get(window, 'fetch');
type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  window.history.replaceState({}, '', '/t/synthetic-topic/42/2');
  if (typeof originalWindowFetch === 'function') {
    Reflect.set(window, 'fetch', originalWindowFetch);
  } else {
    Reflect.deleteProperty(window, 'fetch');
  }
});

function rect(top: number, height: number): DOMRect {
  return {
    bottom: top + height,
    height,
    left: 0,
    right: 100,
    toJSON: () => ({}),
    top,
    width: 100,
    x: 0,
    y: top,
  };
}

describe('TopicCodeEditorSurface', () => {
  it('shows real author avatars and a keyboard-accessible VS Code profile hover', async () => {
    const fetcher = vi.fn<FetchLike>(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            user: {
              avatar_template: '/user_avatar/linux.do/alice/{size}/1.png',
              bio_excerpt: '<script>unsafe()</script><p>Builds <strong>browser tools</strong>.</p>',
              created_at: '2024-01-07T12:00:00.000Z',
              featured_user_badges: [{ description: 'First public link', name: 'First Link' }],
              location: 'Earth',
              name: 'Alice Example',
              time_read: 86_400,
              title: 'Builder',
              topic_post_count: 5,
              trust_level: 2,
              username: 'alice',
              website: 'https://example.com/portfolio',
            },
          }),
          { headers: { 'content-type': 'application/json' }, status: 200 },
        ),
      ),
    );
    Reflect.set(window, 'fetch', fetcher);
    const { detail } = setupTopic();
    const view = render(
      <div data-docode-workbench-root="unit-test">
        <TopicCodeEditorSurface
          document={detail}
          nativeContentTransfer={new NativeContentTransfer(document)}
          revision={1}
        />
      </div>,
    );
    const rendered = within(view.container);
    const trigger = rendered.getByRole('button', { name: 'Show profile for @alice' });
    const avatar = trigger.querySelector('img');

    expect(avatar?.getAttribute('src')).toBe(
      'https://linux.do/user_avatar/linux.do/alice/48/1.png',
    );
    trigger.focus();
    const hover = await rendered.findByRole('tooltip', {
      name: 'Linux DO profile for @alice',
    });
    await waitFor(() => {
      expect(within(hover).getByText('Builds browser tools.')).toBeDefined();
    });
    expect(hover.textContent).toContain('(user) profile @alice {');
    expect(hover.textContent).toContain('Alice Example · Builder');
    expect(hover.textContent).toContain('5 posts in topic');
    expect(hover.textContent).toContain('trust level 2');
    expect(hover.textContent).toContain('read 1d');
    expect(hover.textContent).toContain('Earth · https://example.com/portfolio');
    expect(hover.textContent).toContain('badges: ["First Link"]');
    expect(hover.textContent).not.toContain('unsafe()');
    const [endpoint, init] = fetcher.mock.calls[0] ?? [];
    expect(endpoint).toHaveProperty('href', 'https://linux.do/u/alice/card.json');
    expect(init).toMatchObject({ credentials: 'same-origin', method: 'GET' });

    fireEvent.keyDown(trigger, { key: 'Escape' });
    await waitFor(() => {
      expect(rendered.queryByRole('tooltip')).toBeNull();
      expect(document.activeElement).toBe(trigger);
    });
  });

  it('aborts an in-flight author profile request when the topic view unmounts', async () => {
    const requestSignals: AbortSignal[] = [];
    const fetcher = vi.fn<FetchLike>(
      (input, init) =>
        new Promise<Response>(() => {
          void input;
          if (init?.signal) requestSignals.push(init.signal);
        }),
    );
    Reflect.set(window, 'fetch', fetcher);
    const { detail } = setupTopic();
    const view = render(
      <div data-docode-workbench-root="unit-test">
        <TopicCodeEditorSurface
          document={detail}
          nativeContentTransfer={new NativeContentTransfer(document)}
          revision={1}
        />
      </div>,
    );

    fireEvent.pointerEnter(
      within(view.container).getByRole('button', { name: 'Show profile for @alice' }),
    );
    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(requestSignals).toHaveLength(1);
    });
    view.unmount();
    expect(requestSignals[0]?.aborted).toBe(true);
  });

  it('requests the next reply page once when the editor reaches its end', async () => {
    const { detail } = setupTopic();
    const onRequestMorePosts = vi.fn();
    const transfer = new NativeContentTransfer(document);
    const view = render(
      <div data-docode-workbench-root="unit-test">
        <TopicCodeEditorSurface
          document={detail}
          hasMorePosts
          nativeContentTransfer={transfer}
          onRequestMorePosts={onRequestMorePosts}
          revision={1}
        />
      </div>,
    );
    const surface = view.container.querySelector<HTMLElement>('.docode-topic-code__surface');
    if (!surface) throw new Error('Missing topic scroll surface.');
    Object.defineProperty(surface, 'clientHeight', { configurable: true, value: 600 });
    Object.defineProperty(surface, 'scrollHeight', { configurable: true, value: 1_000 });
    surface.scrollTop = 500;
    fireEvent.scroll(surface);

    await waitFor(() => {
      expect(onRequestMorePosts).toHaveBeenCalledTimes(1);
    });
  });

  it('finds the viewport reply with logarithmically bounded layout reads', () => {
    const surface = document.createElement('section');
    Object.defineProperty(surface, 'clientHeight', { configurable: true, value: 900 });
    vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue(rect(0, 900));
    const replies = Array.from({ length: 1_000 }, (_, index) => ({ id: index + 1 }));
    const elements = new Map<number, HTMLElement>();
    let layoutReads = 0;
    for (const reply of replies) {
      const element = document.createElement('article');
      vi.spyOn(element, 'getBoundingClientRect').mockImplementation(() => {
        layoutReads += 1;
        return rect((reply.id - 1) * 100, 100);
      });
      elements.set(reply.id, element);
    }

    expect(findViewportPostId(surface, replies, elements, null)).toBe(5);
    expect(layoutReads).toBeLessThanOrEqual(16);
  });

  it('renders real reply framing and an accessible cloned-image viewer', async () => {
    const { detail, nativeRoots, sourceParents } = setupTopic();
    const originalMarkup = nativeRoots.map((root) => root.innerHTML);
    const transfer = new NativeContentTransfer(document);
    const view = render(
      <div data-docode-workbench-root="unit-test">
        <TopicCodeEditorSurface document={detail} nativeContentTransfer={transfer} revision={1} />
      </div>,
    );
    const rendered = within(view.container);

    expect(rendered.getByRole('document', { name: 'Topic code document' })).toBeDefined();
    expect(rendered.getByRole('link', { name: 'Synthetic topic' }).getAttribute('href')).toBe(
      'https://linux.do/t/synthetic-topic/42',
    );
    expect(rendered.getByRole('link', { name: 'Open post 2' }).getAttribute('aria-current')).toBe(
      'location',
    );
    expect(rendered.getByRole('link', { name: 'alice_1' }).getAttribute('href')).toBe(
      'https://linux.do/u/alice',
    );
    expect(document.querySelectorAll('.docode-topic-code__content-slot > .cooked')).toHaveLength(2);
    expect(document.querySelectorAll('.docode-topic-code__content-slot > .cooked')[0]).toBe(
      nativeRoots[0],
    );
    expect(document.querySelectorAll('.docode-topic-code__content-slot > .cooked')[1]).toBe(
      nativeRoots[1],
    );
    expect(rendered.getByRole('link', { name: 'native link' })).toBe(
      nativeRoots[0]?.querySelector('a'),
    );
    expect(nativeRoots[0]?.querySelector('img')?.getAttribute('onerror')).toBe('unsafe()');
    const firstContentLines = Array.from(
      nativeRoots[0]?.querySelectorAll<HTMLElement>('[data-docode-editor-line]') ?? [],
      (element) => Number(element.dataset.docodeEditorLine),
    );
    expect(firstContentLines).toEqual([8, 9, 10, 11, 12, 13, 14, 15]);
    expect(nativeRoots[0]?.querySelector('p')?.dataset.docodeEditorLineKind).toBe('text');
    const nativeCode = nativeRoots[0]?.querySelector<HTMLElement>('code');
    const nativeKeyword = nativeCode?.querySelector<HTMLElement>('.hljs-keyword');
    const nativePre = nativeCode?.closest<HTMLElement>('pre');
    expect(nativePre?.dataset.docodeCodeLanguage).toBe('typescript');
    expect(nativePre?.dataset.docodeCodeLanguageLabel).toBe('TypeScript');
    expect(nativePre?.getAttribute('aria-label')).toBe('TypeScript code block');
    expect(nativePre?.querySelector('code')).toBe(nativeCode);
    expect(nativePre?.querySelector('.hljs-keyword')).toBe(nativeKeyword);
    expect(
      Array.from(
        view.container.querySelectorAll<HTMLElement>('[data-docode-line-number]'),
        (element) => Number(element.dataset.docodeLineNumber),
      ),
    ).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 21, 22, 23, 24, 25]);
    const sourceImage = nativeRoots[0]?.querySelector<HTMLImageElement>('img');
    const imageTrigger = view.container.querySelector<HTMLElement>('[data-docode-image-trigger]');
    const imagePreview = view.container.querySelector<HTMLElement>('[data-docode-image-preview]');
    const fullscreen = view.container.querySelector<HTMLElement>('[data-docode-image-fullscreen]');
    expect(sourceImage?.hasAttribute('data-docode-image-source')).toBe(true);
    expect(imageTrigger?.textContent).toBe('image: image.png');
    expect(imageTrigger?.dataset.docodeEditorLine).toBe('14');
    expect(imageTrigger?.getAttribute('role')).toBe('button');
    expect(imageTrigger?.getAttribute('aria-label')).toBe('Preview image: image.png');
    expect(imagePreview?.hidden).toBe(true);
    expect(fullscreen?.hidden).toBe(true);
    if (!imageTrigger || !imagePreview || !fullscreen) {
      throw new Error('Missing image viewer presentation.');
    }
    imageTrigger.focus();
    fireEvent.keyDown(imageTrigger, { key: 'Enter' });
    expect(fullscreen.hidden).toBe(false);
    fireEvent.keyDown(fullscreen, { key: 'Escape' });
    expect(fullscreen.hidden).toBe(true);
    expect(document.activeElement).toBe(imageTrigger);
    fireEvent.pointerEnter(imageTrigger);
    expect(imagePreview.hidden).toBe(false);
    const previewImage = imagePreview.querySelector('img');
    expect(previewImage).not.toBe(sourceImage);
    expect(previewImage?.hasAttribute('onerror')).toBe(false);
    const fullscreenButton = within(imagePreview).getByRole('button', {
      name: 'Open full-screen image: image.png',
    });
    fireEvent.click(fullscreenButton);
    expect(fullscreen.hidden).toBe(false);
    const fullscreenImage = fullscreen.querySelector<HTMLImageElement>('img');
    if (!fullscreenImage) throw new Error('Missing full-screen image clone.');
    expect(fullscreenImage).not.toBe(sourceImage);
    expect(fullscreenImage.src).toBe('https://linux.do/uploads/default/original/1x/original.png');
    expect(fullscreenImage.hasAttribute('onerror')).toBe(false);
    expect(fullscreen.dataset.docodeImageSource).toBe('original');
    const imageTools = within(fullscreen).getByRole('toolbar', { name: 'Image tools: image.png' });
    const actualSizeButton = within(imageTools).getByRole('button', {
      name: 'Show image at actual size: image.png',
    });
    const zoomInButton = within(imageTools).getByRole('button', {
      name: 'Zoom in image: image.png',
    });
    const rotateLeftButton = within(imageTools).getByRole('button', {
      name: 'Rotate image left: image.png',
    });
    const rotateRightButton = within(imageTools).getByRole('button', {
      name: 'Rotate image right: image.png',
    });
    const flipHorizontalButton = within(imageTools).getByRole('button', {
      name: 'Flip image horizontally: image.png',
    });
    const flipVerticalButton = within(imageTools).getByRole('button', {
      name: 'Flip image vertically: image.png',
    });
    const resetButton = within(imageTools).getByRole('button', {
      name: 'Reset image view: image.png',
    });
    fireEvent.click(actualSizeButton);
    expect(fullscreen.dataset.docodeImageScale).toBe('1.000');
    fireEvent.click(zoomInButton);
    expect(fullscreen.dataset.docodeImageScale).toBe('1.250');
    fireEvent.click(rotateRightButton);
    expect(fullscreen.dataset.docodeImageRotation).toBe('90');
    fireEvent.click(rotateLeftButton);
    expect(fullscreen.dataset.docodeImageRotation).toBe('0');
    fireEvent.click(flipHorizontalButton);
    expect(fullscreen.dataset.docodeImageFlipX).toBe('-1');
    fireEvent.click(flipVerticalButton);
    expect(fullscreen.dataset.docodeImageFlipY).toBe('-1');
    fireEvent.click(resetButton);
    expect(fullscreen.dataset.docodeImageRotation).toBe('0');
    expect(fullscreen.dataset.docodeImageFlipX).toBe('1');
    expect(fullscreen.dataset.docodeImageFlipY).toBe('1');
    fireEvent.keyDown(fullscreen, { key: 'r' });
    expect(fullscreen.dataset.docodeImageRotation).toBe('90');
    fireEvent.error(fullscreenImage);
    expect(fullscreenImage.src).toBe('https://linux.do/image.png');
    expect(fullscreen.dataset.docodeImageSource).toBe('current');
    const fullscreenViewport = fullscreen.querySelector<HTMLElement>(
      '[data-docode-image-viewport]',
    );
    if (!fullscreenViewport) throw new Error('Missing full-screen image viewport.');
    const wheelEvent = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      clientX: 420,
      clientY: 260,
      deltaY: -100,
    });
    fullscreenViewport.dispatchEvent(wheelEvent);
    expect(wheelEvent.defaultPrevented).toBe(true);
    expect(Number(fullscreen.dataset.docodeImageScale)).toBeGreaterThan(1);
    expect(fullscreen.dataset.docodeImageSizing).toBe('custom');
    fireEvent.click(resetButton);
    expect(fullscreen.dataset.docodeImagePanX).toBe('0.0');
    expect(fullscreen.dataset.docodeImagePanY).toBe('0.0');
    fireEvent.pointerDown(fullscreenImage, {
      button: 2,
      clientX: 100,
      clientY: 100,
      isPrimary: true,
      pointerId: 5,
    });
    expect(fullscreen.dataset.docodeImageDragging).toBe('false');
    fireEvent.pointerDown(fullscreenImage, {
      button: 0,
      clientX: 100,
      clientY: 100,
      isPrimary: false,
      pointerId: 6,
    });
    expect(fullscreen.dataset.docodeImageDragging).toBe('false');
    fireEvent.pointerDown(fullscreenImage, {
      button: 0,
      clientX: 100,
      clientY: 100,
      isPrimary: true,
      pointerId: 7,
    });
    expect(fullscreen.dataset.docodeImageDragging).toBe('true');
    fireEvent.pointerMove(fullscreenImage, {
      clientX: 80,
      clientY: 70,
      isPrimary: true,
      pointerId: 7,
    });
    expect(fullscreen.dataset.docodeImagePanX).toBe('-20.0');
    expect(fullscreen.dataset.docodeImagePanY).toBe('-30.0');
    fireEvent.pointerUp(fullscreenImage, { button: 0, isPrimary: true, pointerId: 7 });
    expect(fullscreen.dataset.docodeImageDragging).toBe('false');
    fireEvent.click(resetButton);
    expect(fullscreen.dataset.docodeImagePanX).toBe('0.0');
    expect(fullscreen.dataset.docodeImagePanY).toBe('0.0');
    const closeButton = within(fullscreen).getByRole('button', {
      name: 'Close full-screen image: image.png',
    });
    expect(document.activeElement).toBe(closeButton);
    fireEvent.keyDown(fullscreen, { key: 'Escape' });
    expect(fullscreen.hidden).toBe(true);
    expect(document.activeElement).toBe(fullscreenButton);
    expect(imagePreview.hidden).toBe(false);

    fireEvent.click(fullscreenButton);
    fireEvent.click(closeButton);
    expect(fullscreen.hidden).toBe(true);
    fireEvent.click(fullscreenButton);
    fireEvent.pointerDown(fullscreen);
    expect(fullscreen.hidden).toBe(true);

    fireEvent.pointerLeave(imagePreview);
    await waitFor(() => {
      expect(imagePreview.hidden).toBe(true);
    });

    view.unmount();
    expect(sourceParents[0]?.querySelector('.cooked')).toBe(nativeRoots[0]);
    expect(sourceParents[1]?.querySelector('.cooked')).toBe(nativeRoots[1]);
    expect(nativeRoots.map((root) => root.innerHTML)).toEqual(originalMarkup);
    expect(nativeRoots[0]?.querySelector('[data-docode-editor-line-kind]')).toBeNull();
    expect(document.querySelector('[data-docode-image-preview]')).toBeNull();
    expect(document.querySelector('[data-docode-image-fullscreen]')).toBeNull();
    expect(document.querySelector('[data-docode-line-number]')).toBeNull();
  });

  it('renders replies as foldable source functions without giving actions a document line', async () => {
    const user = userEvent.setup();
    const onCursorChange = vi.fn();
    const { detail, nativeRoots, sourceParents } = setupTopic();
    const transfer = new NativeContentTransfer(document);
    const view = render(
      <div data-docode-workbench-root="unit-test">
        <TopicCodeEditorSurface
          document={detail}
          nativeContentTransfer={transfer}
          onCursorChange={onCursorChange}
          revision={1}
        />
      </div>,
    );
    const firstReply = view.container.querySelector<HTMLElement>('[data-post-number="1"]');
    const firstRoot = nativeRoots[0];
    if (!firstReply || !firstRoot) throw new Error('Missing first reply fixture.');
    const signature = firstReply.querySelector<HTMLElement>('.docode-topic-code__signature');
    const metadata = firstReply.querySelector<HTMLElement>('.docode-topic-code__reply-metadata');
    const actionStrip = firstReply.querySelector<HTMLElement>('.docode-topic-code__action-strip');
    const bodyLine = firstRoot.querySelector<HTMLElement>('p');

    expect(signature?.textContent).toBe('private void alice_1() {');
    expect(signature?.dataset.docodeEditorLine).toBe('6');
    expect(metadata?.textContent).toBe('//#1·Alice·now');
    expect(metadata?.dataset.docodeEditorLine).toBe('7');
    expect(firstReply.querySelector('.docode-topic-code__blank-line')).toBeNull();
    expect(actionStrip?.closest('[data-docode-editor-line]')).toBeNull();
    expect(actionStrip?.textContent).toContain('permalink');
    expect(actionStrip?.textContent).toContain('copy');
    expect(bodyLine?.dataset.docodeEditorLine).toBe('9');
    expect(bodyLine?.dataset.docodeEditorLineKind).toBe('text');

    if (!bodyLine) throw new Error('Missing body line fixture.');
    fireEvent.pointerMove(bodyLine);
    expect(bodyLine.classList.contains('docode-topic-code__active-line')).toBe(false);
    expect(firstReply.getAttribute('data-active')).toBeNull();
    expect(onCursorChange).not.toHaveBeenCalled();

    fireEvent.click(bodyLine);
    expect(bodyLine.classList.contains('docode-topic-code__active-line')).toBe(true);
    expect(firstReply.getAttribute('data-active')).toBe('true');
    expect(onCursorChange).toHaveBeenLastCalledWith({ column: 1, lineNumber: 9, postId: 100 });

    const fold = within(firstReply).getByRole('button', { name: 'Collapse reply 1' });
    await user.click(fold);
    expect(fold.getAttribute('aria-expanded')).toBe('false');
    expect(firstReply.getAttribute('data-collapsed')).toBe('true');
    expect(signature?.textContent).toBe('private void alice_1() { … }');
    expect(firstReply.querySelector('.docode-topic-code__reply-metadata')).toBeNull();
    expect(firstReply.querySelector('.docode-topic-code__reply-close')).toBeNull();
    expect(sourceParents[0]?.querySelector('.cooked')).toBe(firstRoot);

    await user.click(within(firstReply).getByRole('button', { name: 'Expand reply 1' }));
    expect(firstReply.getAttribute('data-collapsed')).toBeNull();
    expect(firstReply.querySelector('.docode-topic-code__content-slot > .cooked')).toBe(firstRoot);
  });

  it('renders native unread evidence as inline source metadata and removes it without a new line', () => {
    const { detail } = setupTopic();
    const unreadDetail: ReadyTopicDetailDocument = {
      ...detail,
      replies: detail.replies.map((reply, index) => ({
        ...reply,
        readState: index === 0 ? 'unread' : 'unknown',
      })),
    };
    const transfer = new NativeContentTransfer(document);
    const view = render(
      <div data-docode-workbench-root="unit-test">
        <TopicCodeEditorSurface
          document={unreadDetail}
          nativeContentTransfer={transfer}
          revision={1}
        />
      </div>,
    );
    const firstReply = view.container.querySelector<HTMLElement>('[data-post-number="1"]');
    const secondReply = view.container.querySelector<HTMLElement>('[data-post-number="2"]');
    if (!firstReply || !secondReply) throw new Error('Missing unread reply fixture.');
    const lineCount = view.container.querySelectorAll('[data-docode-editor-line]').length;

    expect(firstReply.dataset.readState).toBe('unread');
    expect(firstReply.querySelector('.docode-topic-code__reply-metadata')?.textContent).toBe(
      '//#1·Alice·now·@unread',
    );
    expect(firstReply.querySelector('.docode-topic-code__unread-annotation')?.textContent).toBe(
      '@unread',
    );
    expect(secondReply.dataset.readState).toBe('unknown');
    expect(secondReply.querySelector('.docode-topic-code__unread-annotation')).toBeNull();

    view.rerender(
      <div data-docode-workbench-root="unit-test">
        <TopicCodeEditorSurface
          document={{
            ...unreadDetail,
            replies: unreadDetail.replies.map((reply) => ({ ...reply, readState: 'unknown' })),
          }}
          nativeContentTransfer={transfer}
          revision={2}
        />
      </div>,
    );

    expect(
      view.container.querySelector('[data-post-number="1"]')?.getAttribute('data-read-state'),
    ).toBe('unknown');
    expect(view.container.querySelector('.docode-topic-code__unread-annotation')).toBeNull();
    expect(view.container.querySelectorAll('[data-docode-editor-line]')).toHaveLength(lineCount);
  });

  it('renders reaction counts and boost bubbles as read-only source metadata', () => {
    const { detail } = setupTopic();
    const boostedDetail: ReadyTopicDetailDocument = {
      ...detail,
      replies: detail.replies.map((reply, index) =>
        index === 0
          ? {
              ...reply,
              boosts: [
                {
                  avatarUrl: 'https://cdn.ldstatic.com/user_avatar/linux.do/sunking/24/2.png',
                  text: '前排合影',
                  username: 'sunking',
                },
                { avatarUrl: null, text: '打卡', username: null },
              ],
              reactionCount: 333,
            }
          : reply,
      ),
    };
    const view = render(
      <div data-docode-workbench-root="unit-test">
        <TopicCodeEditorSurface
          document={boostedDetail}
          nativeContentTransfer={new NativeContentTransfer(document)}
          revision={1}
        />
      </div>,
    );
    const firstReply = view.container.querySelector<HTMLElement>('[data-post-number="1"]');
    const secondReply = view.container.querySelector<HTMLElement>('[data-post-number="2"]');
    if (!firstReply || !secondReply) throw new Error('Missing boost reply fixture.');

    const reactionCount = firstReply.querySelector('.docode-topic-code__reaction-count');
    expect(reactionCount?.textContent).toBe('♥333');
    expect(
      reactionCount
        ?.querySelector('.docode-topic-code__reaction-heart')
        ?.getAttribute('aria-hidden'),
    ).toBe('true');
    const boosts = firstReply.querySelector('.docode-topic-code__boosts-line');
    expect(Number(boosts?.getAttribute('data-docode-editor-line'))).toBeGreaterThan(0);
    expect(boosts?.getAttribute('data-docode-soft-wrap')).toBe('true');
    expect(boosts?.querySelector('.docode-topic-code__boosts-label')?.textContent).toBe(
      '// boosts(2):',
    );
    const bubbles = Array.from(boosts?.querySelectorAll('.docode-topic-code__boost') ?? []);
    expect(
      bubbles.map((bubble) => bubble.querySelector('.docode-topic-code__boost-text')?.textContent),
    ).toEqual(['前排合影', '打卡']);
    expect(boosts?.textContent).toContain('2 quick replies to post 1');
    expect(bubbles[0]?.getAttribute('data-docode-tooltip')).toBeNull();
    const preview = bubbles[0]?.querySelector('.docode-topic-code__boost-preview');
    expect(preview?.getAttribute('aria-hidden')).toBe('true');
    expect(preview?.querySelector('.docode-topic-code__boost-preview-user')?.textContent).toBe(
      '@sunking',
    );
    expect(preview?.querySelector('.docode-topic-code__boost-preview-text')?.textContent).toBe(
      '前排合影',
    );
    expect(preview?.querySelector('img')?.getAttribute('src')).toBe(
      'https://cdn.ldstatic.com/user_avatar/linux.do/sunking/24/2.png',
    );
    expect(bubbles[1]?.querySelector('.docode-topic-code__boost-preview-user')).toBeNull();
    expect(bubbles[0]?.querySelector('img')?.getAttribute('src')).toBe(
      'https://cdn.ldstatic.com/user_avatar/linux.do/sunking/24/2.png',
    );
    expect(bubbles[1]?.querySelector('img')).toBeNull();
    expect(secondReply.querySelector('.docode-topic-code__boosts-line')).toBeNull();
    expect(secondReply.querySelector('.docode-topic-code__reaction-count')).toBeNull();
  });

  it('sends a boost from the inline editor and appends the confirmed bubble', async () => {
    const { detail } = setupTopic();
    const boostedDetail: ReadyTopicDetailDocument = {
      ...detail,
      replies: detail.replies.map((reply, index) =>
        index === 0
          ? {
              ...reply,
              boosts: [{ avatarUrl: null, text: '前排合影', username: 'sunking' }],
              reactionCount: 0,
            }
          : reply,
      ),
    };
    const firstReplyBlock = boostedDetail.replies[0];
    if (!firstReplyBlock) throw new Error('Missing boosted reply.');
    const onSendBoost = vi.fn((postId: number, raw: string, signal: AbortSignal) => {
      void postId;
      void raw;
      void signal;
      return Promise.resolve({
        boost: {
          avatarUrl: 'https://linux.do/user_avatar/linux.do/ruez/24/2.png',
          text: '打卡',
          username: 'ruez',
        },
        kind: 'created' as const,
      });
    });
    const view = render(
      <div data-docode-workbench-root="unit-test">
        <TopicCodeEditorSurface
          currentUsername="ruez"
          document={boostedDetail}
          nativeContentTransfer={new NativeContentTransfer(document)}
          onSendBoost={onSendBoost}
          revision={1}
        />
      </div>,
    );
    const boostsLine = view.container.querySelector<HTMLElement>(
      '[data-post-number="1"] .docode-topic-code__boosts-line',
    );
    if (!boostsLine) throw new Error('Missing boosts line.');
    const addButton = within(boostsLine).getByRole('button', { name: 'Boost post 1' });
    fireEvent.click(addButton);
    const input = within(boostsLine).getByRole('textbox', { name: 'Boost text for post 1' });
    fireEvent.change(input, { target: { value: '打卡' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSendBoost).toHaveBeenCalledTimes(1);
    expect(onSendBoost.mock.calls[0]?.[0]).toBe(firstReplyBlock.id);
    expect(onSendBoost.mock.calls[0]?.[1]).toBe('打卡');
    expect(onSendBoost.mock.calls[0]?.[2]).toBeInstanceOf(AbortSignal);

    await waitFor(() => {
      expect(
        within(boostsLine).queryAllByText('打卡', { selector: '.docode-topic-code__boost-text' })
          .length,
      ).toBe(1);
    });
    expect(boostsLine.querySelector('.docode-topic-code__boosts-label')?.textContent).toBe(
      '// boosts(2):',
    );
    expect(within(boostsLine).queryByRole('button', { name: 'Boost post 1' })).toBeNull();
    expect(within(boostsLine).queryByRole('textbox')).toBeNull();
  });

  it('hides the boost entry for signed-out readers and surfaces send failures inline', async () => {
    const { detail } = setupTopic();
    const boostedDetail: ReadyTopicDetailDocument = {
      ...detail,
      replies: detail.replies.map((reply, index) =>
        index === 0
          ? {
              ...reply,
              boosts: [{ avatarUrl: null, text: '前排合影', username: 'sunking' }],
              reactionCount: 0,
            }
          : reply,
      ),
    };
    const loggedOut = render(
      <div data-docode-workbench-root="unit-test">
        <TopicCodeEditorSurface
          currentUsername={null}
          document={boostedDetail}
          nativeContentTransfer={new NativeContentTransfer(document)}
          onSendBoost={vi.fn()}
          revision={1}
        />
      </div>,
    );
    expect(loggedOut.container.querySelector('.docode-topic-code__boost-add')).toBeNull();
    cleanup();

    const alreadyBoosted = render(
      <div data-docode-workbench-root="unit-test">
        <TopicCodeEditorSurface
          currentUsername="Sunking"
          document={boostedDetail}
          nativeContentTransfer={new NativeContentTransfer(document)}
          onSendBoost={vi.fn()}
          revision={1}
        />
      </div>,
    );
    expect(alreadyBoosted.container.querySelector('.docode-topic-code__boost-add')).toBeNull();
    cleanup();

    const onSendBoost = vi.fn(() =>
      Promise.resolve({
        code: 'rejected' as const,
        kind: 'failed' as const,
        message: 'Linux DO is rate limiting boosts. Try again shortly.',
        retryable: true,
      }),
    );
    const failing = render(
      <div data-docode-workbench-root="unit-test">
        <TopicCodeEditorSurface
          currentUsername="ruez"
          document={boostedDetail}
          nativeContentTransfer={new NativeContentTransfer(document)}
          onSendBoost={onSendBoost}
          revision={1}
        />
      </div>,
    );
    const boostsLine = failing.container.querySelector<HTMLElement>(
      '[data-post-number="1"] .docode-topic-code__boosts-line',
    );
    if (!boostsLine) throw new Error('Missing boosts line.');
    fireEvent.click(within(boostsLine).getByRole('button', { name: 'Boost post 1' }));
    const input = within(boostsLine).getByRole('textbox', { name: 'Boost text for post 1' });
    fireEvent.change(input, { target: { value: '支持' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => {
      expect(within(boostsLine).getByRole('alert').textContent).toBe(
        'Linux DO is rate limiting boosts. Try again shortly.',
      );
    });
    fireEvent.keyDown(within(boostsLine).getByRole('textbox'), { key: 'Escape' });
    expect(within(boostsLine).queryByRole('textbox')).toBeNull();
    expect(within(boostsLine).getByRole('button', { name: 'Boost post 1' })).toBeDefined();
  });

  it('grows a boosts line from the metadata entry on boost-less posts and keeps it after sending', async () => {
    const { detail } = setupTopic();
    const onSendBoost = vi.fn((postId: number, raw: string, signal: AbortSignal) => {
      void postId;
      void raw;
      void signal;
      return Promise.resolve({
        boost: { avatarUrl: null, text: '前排', username: 'ruez' },
        kind: 'created' as const,
      });
    });
    const view = render(
      <div data-docode-workbench-root="unit-test">
        <TopicCodeEditorSurface
          currentUserAvatarUrl="https://linux.do/user_avatar/linux.do/ruez/24/2.png"
          currentUsername="ruez"
          document={detail}
          nativeContentTransfer={new NativeContentTransfer(document)}
          onSendBoost={onSendBoost}
          revision={1}
        />
      </div>,
    );
    const firstReply = view.container.querySelector<HTMLElement>('[data-post-number="1"]');
    if (!firstReply) throw new Error('Missing first reply.');
    expect(firstReply.querySelector('.docode-topic-code__boosts-line')).toBeNull();
    const secondReplyCloseBefore = Number(
      view.container
        .querySelector('[data-post-number="2"] .docode-topic-code__reply-close')
        ?.getAttribute('data-docode-editor-line'),
    );

    const metadataEntry = within(firstReply).getByRole('button', { name: 'Boost post 1' });
    fireEvent.click(metadataEntry);
    const boostsLine = firstReply.querySelector<HTMLElement>('.docode-topic-code__boosts-line');
    if (!boostsLine) throw new Error('Boosts line did not materialize.');
    expect(boostsLine.querySelector('.docode-topic-code__boosts-label')?.textContent).toBe(
      '// boosts(0):',
    );
    expect(Number(boostsLine.getAttribute('data-docode-editor-line'))).toBeGreaterThan(0);
    expect(
      boostsLine.querySelector('.docode-topic-code__boost-editor-avatar')?.getAttribute('src'),
    ).toBe('https://linux.do/user_avatar/linux.do/ruez/24/2.png');
    const secondReplyCloseWhileEditing = Number(
      view.container
        .querySelector('[data-post-number="2"] .docode-topic-code__reply-close')
        ?.getAttribute('data-docode-editor-line'),
    );
    expect(secondReplyCloseWhileEditing).toBe(secondReplyCloseBefore + 1);
    expect(within(firstReply).queryByRole('button', { name: 'Boost post 1' })).toBeNull();

    const input = within(boostsLine).getByRole('textbox', { name: 'Boost text for post 1' });
    fireEvent.change(input, { target: { value: '前排' } });
    fireEvent.click(within(boostsLine).getByRole('button', { name: 'Send boost for post 1' }));
    await waitFor(() => {
      expect(
        within(boostsLine).queryAllByText('前排', { selector: '.docode-topic-code__boost-text' })
          .length,
      ).toBe(1);
    });
    expect(boostsLine.querySelector('.docode-topic-code__boosts-label')?.textContent).toBe(
      '// boosts(1):',
    );
    expect(within(boostsLine).queryByRole('textbox')).toBeNull();
    expect(firstReply.querySelector('.docode-topic-code__boosts-line')).not.toBeNull();
  });

  it('dissolves an empty grown boosts line on Escape or on blur without input', () => {
    const { detail } = setupTopic();
    const view = render(
      <div data-docode-workbench-root="unit-test">
        <TopicCodeEditorSurface
          currentUsername="ruez"
          document={detail}
          nativeContentTransfer={new NativeContentTransfer(document)}
          onSendBoost={vi.fn()}
          revision={1}
        />
      </div>,
    );
    const firstReply = view.container.querySelector<HTMLElement>('[data-post-number="1"]');
    if (!firstReply) throw new Error('Missing first reply.');

    fireEvent.click(within(firstReply).getByRole('button', { name: 'Boost post 1' }));
    let input = within(firstReply).getByRole('textbox', { name: 'Boost text for post 1' });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(firstReply.querySelector('.docode-topic-code__boosts-line')).toBeNull();
    expect(within(firstReply).getByRole('button', { name: 'Boost post 1' })).toBeDefined();

    fireEvent.click(within(firstReply).getByRole('button', { name: 'Boost post 1' }));
    input = within(firstReply).getByRole('textbox', { name: 'Boost text for post 1' });
    fireEvent.blur(input);
    expect(firstReply.querySelector('.docode-topic-code__boosts-line')).toBeNull();

    fireEvent.click(within(firstReply).getByRole('button', { name: 'Boost post 1' }));
    input = within(firstReply).getByRole('textbox', { name: 'Boost text for post 1' });
    fireEvent.change(input, { target: { value: '草稿' } });
    fireEvent.blur(input);
    expect(firstReply.querySelector('.docode-topic-code__boosts-line')).not.toBeNull();
  });

  it('renders a real reply-floor source line and a safe VS Code-style hover preview', () => {
    const { detail, nativeRoots } = setupTopic();
    const linkedDetail: ReadyTopicDetailDocument = {
      ...detail,
      replies: detail.replies.map((reply) =>
        reply.floor.number === 2 ? { ...reply, replyToPostNumber: 1 } : reply,
      ),
    };
    const transfer = new NativeContentTransfer(document);
    const view = render(
      <div data-docode-workbench-root="unit-test">
        <TopicCodeEditorSurface
          document={linkedDetail}
          nativeContentTransfer={transfer}
          revision={1}
        />
      </div>,
    );
    const rendered = within(view.container);
    const reference = rendered.getByRole('button', { name: 'Preview replied-to post 1' });

    expect(reference.textContent).toBe('return #1 · @alice;');
    expect(
      reference.closest('[data-docode-editor-line]')?.getAttribute('data-docode-editor-line'),
    ).toBe('26');
    expect(
      view.container
        .querySelector('[data-post-number="2"] .docode-topic-code__reply-close')
        ?.getAttribute('data-docode-editor-line'),
    ).toBe('27');

    fireEvent.pointerEnter(reference);
    const hover = within(document.body).getByRole('tooltip');
    expect(hover.textContent).toContain('(reply) private void alice_1() {');
    expect(hover.textContent).toContain('// #1 · Alice · now');
    expect(hover.textContent).toContain('"Body native link"');
    expect(within(hover).queryByRole('link')).toBeNull();
    expect(nativeRoots[0]?.closest('.docode-topic-code__content-slot')).not.toBeNull();

    fireEvent.keyDown(reference, { key: 'Escape' });
    expect(within(document.body).queryByRole('tooltip')).toBeNull();
    expect(document.activeElement).toBe(reference);

    const unloadedDetail: ReadyTopicDetailDocument = {
      ...linkedDetail,
      replies: linkedDetail.replies.map((reply) =>
        reply.floor.number === 2 ? { ...reply, replyToPostNumber: 77 } : reply,
      ),
    };
    view.rerender(
      <div data-docode-workbench-root="unit-test">
        <TopicCodeEditorSurface
          document={unloadedDetail}
          nativeContentTransfer={transfer}
          revision={2}
        />
      </div>,
    );
    const unloadedReference = within(view.container).getByRole('button', {
      name: 'Preview replied-to post 77',
    });
    fireEvent.pointerEnter(unloadedReference);
    expect(within(document.body).getByRole('tooltip').textContent).toContain(
      'Post #77 is outside the currently loaded reply window.',
    );
  });

  it('keeps hard-broken native text above an independently positioned active line', () => {
    const onCursorChange = vi.fn();
    const { detail, nativeRoots } = setupTopic();
    const paragraph = nativeRoots[0]?.querySelector<HTMLElement>('p');
    if (!paragraph) throw new Error('Missing paragraph fixture.');
    paragraph.append(document.createElement('br'), 'Second visible line');
    vi.spyOn(paragraph, 'getBoundingClientRect').mockReturnValue(rect(100, 40));
    const transfer = new NativeContentTransfer(document);
    const view = render(
      <div data-docode-workbench-root="unit-test">
        <TopicCodeEditorSurface
          document={detail}
          nativeContentTransfer={transfer}
          onCursorChange={onCursorChange}
          revision={1}
        />
      </div>,
    );

    expect(paragraph.dataset.docodeEditorLine).toBe('9');
    expect(paragraph.dataset.docodeEditorLineCount).toBe('2');
    expect(paragraph.style.getPropertyValue('--docode-topic-native-line-span')).toBe('2');
    expect(view.container.querySelector('[data-docode-line-number="10"]')?.textContent).toBe('10');
    expect(
      view.container
        .querySelector('.docode-topic-code__reply-close')
        ?.getAttribute('data-docode-editor-line'),
    ).toBe('18');

    fireEvent.pointerMove(paragraph, { clientY: 125 });
    const overlay = view.container.querySelector<HTMLElement>(
      '.docode-topic-code__active-line-overlay',
    );
    expect(overlay?.hidden).toBe(true);
    expect(paragraph.classList.contains('docode-topic-code__active-line')).toBe(false);
    expect(onCursorChange).not.toHaveBeenCalled();

    fireEvent.click(paragraph, { clientY: 125 });
    expect(overlay?.hidden).toBe(false);
    expect(paragraph.classList.contains('docode-topic-code__active-line')).toBe(true);
    expect(
      view.container
        .querySelector('[data-docode-line-number="10"]')
        ?.classList.contains('docode-topic-code__line-number--active'),
    ).toBe(true);
    expect(onCursorChange).toHaveBeenLastCalledWith({ column: 1, lineNumber: 10, postId: 100 });

    view.unmount();
    expect(paragraph.hasAttribute('data-docode-editor-line-count')).toBe(false);
    expect(paragraph.style.getPropertyValue('--docode-topic-native-line-span')).toBe('');
  });

  it('repositions native line numbers when rich content changes size', async () => {
    const resizeObserverDescriptor = Object.getOwnPropertyDescriptor(window, 'ResizeObserver');
    const resizeObservers: { callback: ResizeObserverCallback; instance: ResizeObserver }[] = [];
    const notifyResize = (): void => {
      for (const { callback, instance } of [...resizeObservers]) callback([], instance);
    };
    Object.defineProperty(window, 'ResizeObserver', {
      configurable: true,
      value: class {
        constructor(callback: ResizeObserverCallback) {
          resizeObservers.push({ callback, instance: this });
        }

        disconnect(): void {
          return undefined;
        }

        observe(): void {
          return undefined;
        }

        unobserve(): void {
          return undefined;
        }
      },
    });
    const { detail, nativeRoots } = setupTopic();
    const paragraph = nativeRoots[0]?.querySelector<HTMLElement>('p');
    if (!paragraph) throw new Error('Missing paragraph fixture.');
    let paragraphTop = 100;
    vi.spyOn(paragraph, 'getBoundingClientRect').mockImplementation(() => rect(paragraphTop, 20));
    const transfer = new NativeContentTransfer(document);

    try {
      const view = render(
        <div data-docode-workbench-root="unit-test">
          <TopicCodeEditorSurface document={detail} nativeContentTransfer={transfer} revision={1} />
        </div>,
      );
      const firstContentLine = view.container.querySelector<HTMLElement>(
        '[data-docode-line-number="9"]',
      );
      await waitFor(() => {
        expect(firstContentLine?.style.transform).toBe('translateY(100px)');
      });

      paragraphTop = 148;
      notifyResize();
      await waitFor(() => {
        expect(firstContentLine?.style.transform).toBe('translateY(148px)');
      });
    } finally {
      if (resizeObserverDescriptor) {
        Object.defineProperty(window, 'ResizeObserver', resizeObserverDescriptor);
      } else {
        Reflect.deleteProperty(window, 'ResizeObserver');
      }
    }
  });

  it('keeps native roots mounted across revisions and recovers after an external restore', () => {
    const { detail, nativeRoots, sourceParents } = setupTopic();
    const transfer = new NativeContentTransfer(document);
    const mount = vi.spyOn(transfer, 'mount');
    const view = render(
      <TopicCodeEditorSurface document={detail} nativeContentTransfer={transfer} revision={1} />,
    );

    expect(mount).toHaveBeenCalledTimes(2);
    const refreshedDetail: ReadyTopicDetailDocument = {
      ...detail,
      replies: detail.replies.map((reply) => ({
        ...reply,
        content: reply.content
          ? {
              ...reply.content,
              blocks: [...reply.content.blocks],
            }
          : null,
      })),
    };
    view.rerender(
      <TopicCodeEditorSurface
        document={refreshedDetail}
        nativeContentTransfer={transfer}
        revision={2}
      />,
    );

    expect(mount).toHaveBeenCalledTimes(2);
    expect(document.querySelector('.docode-topic-code__content-slot > .cooked')).toBe(
      nativeRoots[0],
    );
    expect(sourceParents[0]?.querySelector('.cooked')).toBeNull();

    expect(transfer.restoreAll()).toBe(2);
    expect(sourceParents[0]?.querySelector('.cooked')).toBe(nativeRoots[0]);
    view.rerender(
      <TopicCodeEditorSurface
        document={refreshedDetail}
        nativeContentTransfer={transfer}
        revision={3}
      />,
    );
    expect(mount).toHaveBeenCalledTimes(4);
    expect(document.querySelector('.docode-topic-code__content-slot > .cooked')).toBe(
      nativeRoots[0],
    );
  });

  it('keeps native rich-content links keyboard reachable', async () => {
    const user = userEvent.setup();
    const { detail, nativeRoots } = setupTopic();
    const transfer = new NativeContentTransfer(document);
    render(
      <TopicCodeEditorSurface document={detail} nativeContentTransfer={transfer} revision={1} />,
    );
    const nativeLink = nativeRoots[0]?.querySelector<HTMLAnchorElement>('a');
    if (!nativeLink) throw new Error('Missing native link');

    nativeLink.focus();
    expect(document.activeElement).toBe(nativeLink);
    await user.keyboard('{Tab}');
    expect(document.activeElement).not.toBe(document.body);
  });

  it('preserves native mention links as exact interactive content in Code and Doc modes', () => {
    const { detail, nativeRoots } = setupTopic();
    const paragraph = nativeRoots[0]?.querySelector('p');
    const quote = nativeRoots[0]?.querySelector('blockquote');
    if (!paragraph || !quote) throw new Error('Missing rich-content fixture.');
    const mention = document.createElement('a');
    mention.className = 'mention';
    mention.dataset.userCard = 'kaluoer111';
    mention.href = '/u/kaluoer111';
    mention.textContent = '@kaluoer111';
    const quotedMention = mention.cloneNode(true) as HTMLAnchorElement;
    quotedMention.className = 'mention-group';
    paragraph.append(' ', mention);
    quote.append(' ', quotedMention);
    const transfer = new NativeContentTransfer(document);
    const view = render(
      <div data-docode-workbench-root="unit-test">
        <TopicCodeEditorSurface document={detail} nativeContentTransfer={transfer} revision={1} />
      </div>,
    );
    const rendered = within(view.container);
    const surface = rendered.getByRole('document', { name: 'Topic code document' });

    expect(surface.getAttribute('data-mode')).toBe('code');
    expect(rendered.getAllByRole('link', { name: '@kaluoer111' })).toEqual([
      mention,
      quotedMention,
    ]);
    expect(mention.href).toBe('https://linux.do/u/kaluoer111');
    expect(mention.dataset.userCard).toBe('kaluoer111');
    expect(mention.closest('.docode-topic-code__content-slot')).not.toBeNull();

    mention.focus();
    expect(document.activeElement).toBe(mention);
    view.rerender(
      <div data-docode-workbench-root="unit-test">
        <TopicCodeEditorSurface
          document={detail}
          mode="doc"
          nativeContentTransfer={transfer}
          revision={1}
        />
      </div>,
    );
    expect(surface.getAttribute('data-mode')).toBe('doc');
    expect(rendered.getAllByRole('link', { name: '@kaluoer111' })).toEqual([
      mention,
      quotedMention,
    ]);
    view.rerender(
      <div data-docode-workbench-root="unit-test">
        <TopicCodeEditorSurface
          document={detail}
          mode="code"
          nativeContentTransfer={transfer}
          revision={1}
        />
      </div>,
    );
    expect(surface.getAttribute('data-mode')).toBe('code');
    expect(rendered.getAllByRole('link', { name: '@kaluoer111' })).toEqual([
      mention,
      quotedMention,
    ]);

    view.unmount();
    expect(nativeRoots[0]?.contains(mention)).toBe(true);
    expect(nativeRoots[0]?.contains(quotedMention)).toBe(true);
  });

  it('switches Code and Doc presentation without replacing content or scroll state', () => {
    const { detail, nativeRoots } = setupTopic();
    const transfer = new NativeContentTransfer(document);
    const view = render(
      <TopicCodeEditorSurface document={detail} nativeContentTransfer={transfer} revision={1} />,
    );
    const rendered = within(view.container);
    const surface = rendered.getByRole('document', { name: 'Topic code document' });
    const firstNativeRoot = nativeRoots[0];
    surface.scrollTop = 120;

    view.rerender(
      <TopicCodeEditorSurface
        document={detail}
        mode="doc"
        nativeContentTransfer={transfer}
        revision={1}
      />,
    );
    const docSurface = rendered.getByRole('document', { name: 'Topic document' });

    expect(docSurface).toBe(surface);
    expect(docSurface.getAttribute('data-mode')).toBe('doc');
    expect(docSurface.scrollTop).toBe(120);
    expect(view.container.querySelectorAll('.docode-topic-code__keyword')).toHaveLength(0);
    expect(view.container.querySelectorAll('.docode-topic-code__reply-close')).toHaveLength(0);
    expect(view.container.querySelectorAll('.docode-topic-code__md-heading')).toHaveLength(4);
    expect(view.container.querySelector('.docode-topic-code__md-section')?.textContent).toBe(
      '## 回复',
    );
    const docTitle = view.container.querySelector(
      '.docode-topic-code__heading-row .docode-topic-code__md-heading',
    );
    expect(docTitle?.getAttribute('data-docode-editor-line')).toBe('1');
    expect(docTitle?.textContent).toBe(`# ${detail.topic.title}`);
    const firstDocHeading = view.container.querySelector(
      '.docode-topic-code__reply .docode-topic-code__signature',
    );
    expect(firstDocHeading?.getAttribute('data-docode-editor-line')).toBe('4');
    expect(firstDocHeading?.textContent).toMatch(/^### 楼 1 · @/u);
    expect(view.container.querySelector('.docode-topic-code__floor')?.textContent).toBe('4');
    expect(view.container.querySelector('.docode-topic-code__content-slot > .cooked')).toBe(
      firstNativeRoot,
    );

    view.rerender(
      <TopicCodeEditorSurface
        document={detail}
        mode="code"
        nativeContentTransfer={transfer}
        revision={1}
      />,
    );
    expect(surface.getAttribute('data-mode')).toBe('code');
    expect(surface.scrollTop).toBe(120);
    expect(view.container.querySelector('.docode-topic-code__content-slot > .cooked')).toBe(
      firstNativeRoot,
    );
    expect(rendered.queryByRole('button', { name: 'Code' })).toBeNull();
    expect(rendered.queryByRole('button', { name: 'Doc' })).toBeNull();
  });

  it('exposes real permalinks, honest capability states, and keyboard post focus', async () => {
    const user = userEvent.setup();
    const { detail } = setupTopic();
    const transfer = new NativeContentTransfer(document);
    const view = render(
      <TopicCodeEditorSurface document={detail} nativeContentTransfer={transfer} revision={1} />,
    );
    const rendered = within(view.container);
    const replies = rendered.getAllByRole('article');
    const firstActions = rendered.getByRole('group', { name: 'Post 1 actions' });

    expect(replies[0]?.getAttribute('tabindex')).toBe('-1');
    expect(replies[1]?.getAttribute('tabindex')).toBe('0');
    expect(
      within(firstActions).getByRole('link', { name: 'Post 1 permalink' }).getAttribute('href'),
    ).toBe('https://linux.do/t/synthetic-topic/42');
    expect(tooltipElements(firstActions, 'Like: sign in required on Linux DO')).toHaveLength(1);
    expect(tooltipElements(firstActions, 'Bookmark: sign in required on Linux DO')).toHaveLength(1);
    expect(tooltipElements(firstActions, 'Copy Link: available in original Linux DO')).toHaveLength(
      1,
    );
    expect(
      within(firstActions).getByRole('button', { name: 'More actions for post 1' }),
    ).toBeDefined();
    expect(view.container.querySelector('.docode-topic-code__loading-boundary')).toBeNull();

    replies[1]?.focus();
    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(replies[0]);
    expect(replies[0]?.getAttribute('data-active')).toBe('true');
    expect(replies[0]?.getAttribute('tabindex')).toBe('0');
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(replies[1]);
    expect(replies[1]?.getAttribute('data-active')).toBe('true');

    const nativeLink = rendered.getByRole('link', { name: 'native link' });
    nativeLink.focus();
    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(nativeLink);
  });

  it('shows pending, confirmed, and failed states from the shared real-action result', async () => {
    const user = userEvent.setup();
    const detail = setupLoggedInTopic();
    const pendingLike: {
      resolve?: (outcome: { readonly kind: 'failed'; readonly message: string }) => void;
    } = {};
    const onResolvePostCommand = vi.fn<ResolveTopicPostCommand>(() => ({
      available: true,
      message: 'available in original Linux DO',
    }));
    const onRunPostCommand = vi.fn<RunTopicPostCommand>((request) => {
      if (request.commandId === 'bookmark') {
        return Promise.resolve({ kind: 'success' } as const);
      }
      return new Promise<{ readonly kind: 'failed'; readonly message: string }>((resolve) => {
        pendingLike.resolve = resolve;
      });
    });
    const transfer = new NativeContentTransfer(document);
    const view = render(
      <TopicCodeEditorSurface
        document={detail}
        nativeContentTransfer={transfer}
        onResolvePostCommand={onResolvePostCommand}
        onRunPostCommand={onRunPostCommand}
        revision={1}
      />,
    );
    const actions = within(within(view.container).getByRole('group', { name: 'Post 1 actions' }));

    const like = actions.getByRole('button', { name: 'Like: available in original Linux DO' });
    await user.click(like);
    const pendingLikeButton = actions.getByRole('button', {
      name: 'Like: Waiting for Linux DO',
    });
    expect(pendingLikeButton.hasAttribute('disabled')).toBe(true);
    await user.click(pendingLikeButton);
    expect(onRunPostCommand).toHaveBeenCalledTimes(1);
    const likeRequest = onRunPostCommand.mock.calls[0]?.[0];
    expect(likeRequest?.commandId).toBe('like');
    expect(likeRequest?.reply.id).toBe(100);
    expect(likeRequest?.source).toBe('editor-action');

    pendingLike.resolve?.({
      kind: 'failed',
      message: 'Linux DO did not confirm the action result.',
    });
    expect(
      (
        await actions.findByRole('button', {
          name: 'Like: Linux DO did not confirm the action result.',
        })
      ).hasAttribute('disabled'),
    ).toBe(false);

    await user.click(
      actions.getByRole('button', { name: 'Bookmark: available in original Linux DO' }),
    );
    const confirmedDetail: ReadyTopicDetailDocument = {
      ...detail,
      replies: detail.replies.map((reply) =>
        reply.id === 100
          ? {
              ...reply,
              capabilities: {
                ...reply.capabilities,
                bookmark: { ...reply.capabilities.bookmark, active: true },
              },
            }
          : reply,
      ),
    };
    view.rerender(
      <TopicCodeEditorSurface
        document={confirmedDetail}
        nativeContentTransfer={transfer}
        onResolvePostCommand={onResolvePostCommand}
        onRunPostCommand={onRunPostCommand}
        revision={2}
      />,
    );
    await waitFor(() => {
      expect(tooltipElements(view.container, 'Bookmark: bookmarked on Linux DO')).toHaveLength(1);
    });
    expect(actions.queryByRole('button', { name: /Bookmark/u })).toBeNull();
  });

  it('replaces Like with Unlike only after confirmed Linux DO state changes', async () => {
    const detail = setupLoggedInTopic();
    const transfer = new NativeContentTransfer(document);
    const onResolvePostCommand = vi.fn<ResolveTopicPostCommand>(() => ({
      available: true,
      message: 'available in original Linux DO',
    }));
    const onRunPostCommand = vi.fn<RunTopicPostCommand>(() => Promise.resolve({ kind: 'success' }));
    const view = render(
      <TopicCodeEditorSurface
        document={detail}
        nativeContentTransfer={transfer}
        onResolvePostCommand={onResolvePostCommand}
        onRunPostCommand={onRunPostCommand}
        revision={1}
      />,
    );
    const actions = within(within(view.container).getByRole('group', { name: 'Post 1 actions' }));

    expect(
      actions.getByRole('button', { name: 'Like: available in original Linux DO' }),
    ).toBeDefined();
    const likedDetail: ReadyTopicDetailDocument = {
      ...detail,
      replies: detail.replies.map((reply) =>
        reply.id === 100
          ? {
              ...reply,
              capabilities: {
                ...reply.capabilities,
                like: { ...reply.capabilities.like, active: true },
              },
            }
          : reply,
      ),
    };
    view.rerender(
      <TopicCodeEditorSurface
        document={likedDetail}
        nativeContentTransfer={transfer}
        onResolvePostCommand={onResolvePostCommand}
        onRunPostCommand={onRunPostCommand}
        revision={2}
      />,
    );

    const unlike = await actions.findByRole('button', { name: 'Unlike: liked on Linux DO' });
    expect(unlike.textContent).toContain('unlike');
    expect(unlike.getAttribute('aria-pressed')).toBe('true');
    expect(
      unlike.querySelector('.docode-topic-code__action-label')?.getAttribute('data-replacing'),
    ).toBe('true');
    const replacingLabel = unlike.querySelector('.docode-topic-code__action-label');
    expect(replacingLabel).not.toBeNull();
    if (replacingLabel) fireEvent.animationEnd(replacingLabel);
    await waitFor(() => {
      expect(
        unlike.querySelector('.docode-topic-code__action-label')?.hasAttribute('data-replacing'),
      ).toBe(false);
    });

    view.rerender(
      <TopicCodeEditorSurface
        document={detail}
        nativeContentTransfer={transfer}
        onResolvePostCommand={onResolvePostCommand}
        onRunPostCommand={onRunPostCommand}
        revision={3}
      />,
    );
    const like = await actions.findByRole('button', {
      name: 'Like: available in original Linux DO',
    });
    expect(like.getAttribute('aria-pressed')).toBe('false');
    expect(
      like.querySelector('.docode-topic-code__action-label')?.getAttribute('data-replacing'),
    ).toBe('true');
  });

  it('opens post actions by keyboard or pointer, preserves native link menus, and restores focus', async () => {
    const user = userEvent.setup();
    const detail = setupLoggedInTopic();
    const onResolvePostCommand = vi.fn<ResolveTopicPostCommand>((commandId) => ({
      available: commandId !== 'bookmark',
      message: commandId === 'bookmark' ? 'Bookmark is disabled by Linux DO.' : 'Available',
    }));
    const onRunPostCommand = vi.fn<RunTopicPostCommand>(() => Promise.resolve({ kind: 'success' }));
    const view = render(
      <TopicCodeEditorSurface
        document={detail}
        nativeContentTransfer={new NativeContentTransfer(document)}
        onResolvePostCommand={onResolvePostCommand}
        onRunPostCommand={onRunPostCommand}
        revision={1}
      />,
    );
    const reply = view.container.querySelector<HTMLElement>('[data-post-id="100"]');
    if (!reply) throw new Error('Missing rendered reply.');
    reply.focus();

    fireEvent.keyDown(reply, { key: 'F10', shiftKey: true });
    const menu = within(view.container).getByRole('menu', { name: 'Post 1 actions menu' });
    await waitFor(() => {
      expect(document.activeElement).toBe(
        within(menu).getByRole('menuitem', { name: 'Reply to Post 1' }),
      );
    });
    expect(within(menu).getByRole('menuitem', { name: 'Bookmark' }).hasAttribute('disabled')).toBe(
      true,
    );
    expect(
      within(menu).getByRole('menuitem', { name: 'Bookmark' }).getAttribute('data-docode-tooltip'),
    ).toBe('Bookmark is disabled by Linux DO.');
    expect(
      within(menu)
        .getByRole('menuitem', { name: 'Reply to Post 1' })
        .hasAttribute('data-docode-tooltip'),
    ).toBe(false);
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(within(menu).getByRole('menuitem', { name: 'Like' }));
    fireEvent.keyDown(menu, { key: 'Tab' });
    expect(document.activeElement).toBe(within(menu).getByRole('menuitem', { name: 'Like' }));
    fireEvent.keyDown(menu, { key: 'Escape' });
    await waitFor(() => {
      expect(document.activeElement).toBe(reply);
    });

    fireEvent.contextMenu(view.getByRole('link', { name: 'native link' }));
    expect(within(view.container).queryByRole('menu')).toBeNull();
    fireEvent.contextMenu(reply, { clientX: 90, clientY: 70 });
    await user.click(within(view.container).getByRole('menuitem', { name: 'Copy Post Link' }));
    const copyRequest = onRunPostCommand.mock.calls[0]?.[0];
    expect(copyRequest?.commandId).toBe('copy-link');
    expect(copyRequest?.reply.id).toBe(100);
    expect(copyRequest?.source).toBe('context-menu');
    await waitFor(() => {
      expect(within(view.container).queryByRole('menu')).toBeNull();
      expect(document.activeElement).toBe(reply);
    });
  });

  it('holds post menu actions disabled while a registered command is pending and reports failure', async () => {
    const user = userEvent.setup();
    const detail = setupLoggedInTopic();
    const pending: {
      finish?: (outcome: { readonly kind: 'failed'; readonly message: string }) => void;
    } = {};
    const onRunPostCommand = vi.fn<RunTopicPostCommand>(
      () =>
        new Promise((resolve) => {
          pending.finish = resolve;
        }),
    );
    const view = render(
      <TopicCodeEditorSurface
        document={detail}
        nativeContentTransfer={new NativeContentTransfer(document)}
        onResolvePostCommand={() => ({ available: true, message: 'Available' })}
        onRunPostCommand={onRunPostCommand}
        revision={1}
      />,
    );

    await user.click(view.getByRole('button', { name: 'More actions for post 1' }));
    const menu = within(view.container).getByRole('menu', { name: 'Post 1 actions menu' });
    await user.click(within(menu).getByRole('menuitem', { name: 'Like' }));
    await waitFor(() => {
      expect(
        within(menu)
          .getAllByRole('menuitem')
          .every((item) => item.hasAttribute('disabled')),
      ).toBe(true);
    });
    expect(
      within(menu).getByRole('menuitem', { name: 'Like' }).getAttribute('data-docode-tooltip'),
    ).toBe('Waiting for Linux DO');
    pending.finish?.({ kind: 'failed', message: 'Linux DO rejected the action.' });
    expect((await within(menu).findByRole('alert')).textContent).toBe(
      'Linux DO rejected the action.',
    );
    expect(within(menu).getByRole('menuitem', { name: 'Like' }).hasAttribute('disabled')).toBe(
      false,
    );
    await waitFor(() => {
      expect(document.activeElement).toBe(within(menu).getByRole('menuitem', { name: 'Like' }));
    });
  });

  it('focuses a loaded real reply after the outline route reaches the requested floor', () => {
    const { detail } = setupTopic();
    const onActiveReplyChange = vi.fn();
    const transfer = new NativeContentTransfer(document);
    const view = render(
      <TopicCodeEditorSurface
        document={detail}
        nativeContentTransfer={transfer}
        onActiveReplyChange={onActiveReplyChange}
        revision={1}
      />,
    );
    const firstReply = within(view.container).getAllByRole('article')[0];

    view.rerender(
      <TopicCodeEditorSurface
        document={detail}
        focusRequest={{ postId: 100, sequence: 1 }}
        nativeContentTransfer={transfer}
        onActiveReplyChange={onActiveReplyChange}
        revision={1}
      />,
    );

    expect(document.activeElement).not.toBe(firstReply);

    const routedDetail = {
      ...detail,
      route: recognizeLinuxDoRoute('https://linux.do/t/synthetic-topic/42'),
    } as ReadyTopicDetailDocument;
    view.rerender(
      <TopicCodeEditorSurface
        document={routedDetail}
        focusRequest={{ postId: 100, sequence: 1 }}
        nativeContentTransfer={transfer}
        onActiveReplyChange={onActiveReplyChange}
        revision={2}
      />,
    );

    expect(document.activeElement).toBe(firstReply);
    expect(firstReply?.getAttribute('data-active')).toBe('true');
    expect(firstReply?.getAttribute('tabindex')).toBe('0');
    expect(onActiveReplyChange).toHaveBeenLastCalledWith(100);
  });

  it('resets a user-driven selection when a same-topic deep link requests another floor', async () => {
    const { detail } = setupTopic();
    const transfer = new NativeContentTransfer(document);
    const view = render(
      <TopicCodeEditorSurface document={detail} nativeContentTransfer={transfer} revision={1} />,
    );
    const replies = within(view.container).getAllByRole('article');
    const firstReply = replies[0];
    const secondReply = replies[1];
    if (!firstReply || !secondReply) throw new Error('Missing topic replies.');
    firstReply.focus();
    await waitFor(() => {
      expect(firstReply.getAttribute('data-active')).toBe('true');
    });

    const rerouted = {
      ...detail,
      route: {
        ...detail.route,
        href: `${detail.route.href}?docode_navigation=1`,
        search: '?docode_navigation=1',
      },
    };
    view.rerender(
      <TopicCodeEditorSurface document={rerouted} nativeContentTransfer={transfer} revision={2} />,
    );

    await waitFor(() => {
      const currentSecondReply = within(view.container).getAllByRole('article')[1];
      expect(currentSecondReply?.getAttribute('data-active')).toBe('true');
      expect(currentSecondReply?.getAttribute('tabindex')).toBe('0');
    });
  });

  it('publishes coalesced viewport state and applies minimap scroll requests without a loop', async () => {
    const { detail } = setupTopic();
    const onViewportChange = vi.fn();
    const transfer = new NativeContentTransfer(document);
    const view = render(
      <TopicCodeEditorSurface
        document={detail}
        nativeContentTransfer={transfer}
        onViewportChange={onViewportChange}
        revision={1}
      />,
    );
    const surface = within(view.container).getByRole('document', { name: 'Topic code document' });
    const replies = within(view.container).getAllByRole('article');
    const firstReply = replies[0];
    const secondReply = replies[1];
    if (!firstReply || !secondReply) throw new Error('Missing topic replies');
    defineScrollGeometry(surface, { clientHeight: 200, scrollHeight: 1_000 });
    mockViewportRect(surface, 0, 200);
    mockViewportRect(firstReply, () => -surface.scrollTop, 400);
    mockViewportRect(secondReply, () => 400 - surface.scrollTop, 500);

    await waitFor(() => {
      expect(surface.scrollTop).toBe(550);
    });
    surface.scrollTop = 0;
    fireEvent.scroll(surface);
    await waitFor(() => {
      expect(onViewportChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          currentPostId: 100,
          scrollProgress: 0,
          size: 0.2,
        }),
      );
    });

    view.rerender(
      <TopicCodeEditorSurface
        document={detail}
        nativeContentTransfer={transfer}
        onViewportChange={onViewportChange}
        revision={1}
        scrollRequest={{ progress: 0.75, sequence: 1 }}
      />,
    );
    await waitFor(() => {
      expect(surface.scrollTop).toBe(600);
      expect(onViewportChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          currentPostId: 101,
          scrollProgress: 0.75,
          scrollTop: 600,
        }),
      );
    });
    surface.scrollTop = 125;
    view.rerender(
      <TopicCodeEditorSurface
        document={detail}
        nativeContentTransfer={transfer}
        onViewportChange={onViewportChange}
        revision={2}
        scrollRequest={{ progress: 0.75, sequence: 1 }}
      />,
    );
    expect(surface.scrollTop).toBe(125);
    expect(onViewportChange.mock.calls.length).toBeLessThan(10);
  });

  it('keeps the same reply anchored while an incremental refresh changes preceding layout', () => {
    const { detail } = setupTopic();
    const transfer = new NativeContentTransfer(document);
    const view = render(
      <TopicCodeEditorSurface document={detail} nativeContentTransfer={transfer} revision={1} />,
    );
    const surface = view.getByRole('document', { name: 'Topic code document' });
    const replies = Array.from(
      view.container.querySelectorAll<HTMLElement>('.docode-topic-code__reply'),
    );
    let precedingLayoutHeight = 0;
    Object.defineProperties(surface, {
      clientHeight: { configurable: true, value: 200 },
      scrollHeight: { configurable: true, value: 600 },
    });
    vi.spyOn(surface, 'getBoundingClientRect').mockImplementation(() => rect(0, 200));
    replies.forEach((reply, index) => {
      vi.spyOn(reply, 'getBoundingClientRect').mockImplementation(() =>
        rect(precedingLayoutHeight + index * 100 - surface.scrollTop, 100),
      );
    });
    surface.scrollTop = 50;

    view.rerender(
      <TopicCodeEditorSurface document={detail} nativeContentTransfer={transfer} revision={2} />,
    );
    precedingLayoutHeight = 80;
    view.rerender(
      <TopicCodeEditorSurface document={detail} nativeContentTransfer={transfer} revision={3} />,
    );

    expect(surface.scrollTop).toBe(130);
    expect(replies[1]?.getBoundingClientRect().top).toBe(50);
  });

  it('keeps the first visible reply anchored while earlier replies are prepended', async () => {
    window.history.replaceState({}, '', '/t/synthetic-topic/42');
    document.body.innerHTML = longTopicFixture(18, 2);
    const route = recognizeLinuxDoRoute(document.location.href);
    if (route.kind !== 'topic') throw new Error('Expected topic route');
    const partialDetail = createTopicDetailDocument(
      route,
      extractTopic(document, route),
      detectLinuxDoCapabilities(document, route),
    );
    if (partialDetail.state !== 'ready') throw new Error('Expected partial topic detail');
    const onRequestEarlierPosts = vi.fn();
    const transfer = new NativeContentTransfer(document);
    const view = render(
      <TopicCodeEditorSurface
        document={partialDetail}
        nativeContentTransfer={transfer}
        onRequestEarlierPosts={onRequestEarlierPosts}
        revision={1}
      />,
    );
    const surface = view.getByRole('document', { name: 'Topic code document' });
    const firstVisibleReply = view.container.querySelector<HTMLElement>(
      '.docode-topic-code__reply[data-post-id="1018"]',
    );
    if (!firstVisibleReply) throw new Error('Missing first visible reply.');
    let precedingLayoutHeight = 0;
    defineScrollGeometry(surface, { clientHeight: 200, scrollHeight: 600 });
    mockViewportRect(surface, 0, 200);
    mockViewportRect(firstVisibleReply, () => precedingLayoutHeight - surface.scrollTop, 300);
    surface.scrollTop = 0;
    fireEvent.scroll(surface);

    view.rerender(
      <TopicCodeEditorSurface
        document={partialDetail}
        hasEarlierPosts
        nativeContentTransfer={transfer}
        onRequestEarlierPosts={onRequestEarlierPosts}
        revision={1}
      />,
    );
    fireEvent.scroll(surface);
    await waitFor(() => {
      expect(onRequestEarlierPosts).toHaveBeenCalledTimes(1);
    });
    view.rerender(
      <TopicCodeEditorSurface
        document={partialDetail}
        hasEarlierPosts
        loadingEarlierPosts
        nativeContentTransfer={transfer}
        onRequestEarlierPosts={onRequestEarlierPosts}
        revision={1}
      />,
    );

    const firstReply = partialDetail.replies[0];
    if (!firstReply) throw new Error('Missing partial reply.');
    const expandedDetail: ReadyTopicDetailDocument = {
      ...partialDetail,
      loadedWindow: {
        ...partialDetail.loadedWindow,
        firstPostNumber: 17,
        loadedPostCount: partialDetail.loadedWindow.loadedPostCount + 1,
      },
      replies: [
        {
          ...firstReply,
          content: null,
          floor: { loadedOrder: 0, number: 17, requested: false },
          id: 1017,
          permalink: 'https://linux.do/t/synthetic-topic/42/17',
        },
        ...partialDetail.replies,
      ],
    };
    precedingLayoutHeight = 160;
    Object.defineProperty(surface, 'scrollHeight', { configurable: true, value: 760 });
    view.rerender(
      <TopicCodeEditorSurface
        document={expandedDetail}
        earlierPaginationStatus="complete"
        nativeContentTransfer={transfer}
        onRequestEarlierPosts={onRequestEarlierPosts}
        revision={2}
      />,
    );

    expect(surface.scrollTop).toBe(160);
    expect(firstVisibleReply.getBoundingClientRect().top).toBe(0);
  });

  it('lets explicit floor navigation replace a pending earlier-pagination anchor', async () => {
    window.history.replaceState({}, '', '/t/synthetic-topic/42/18');
    document.body.innerHTML = longTopicFixture(18, 2);
    const route = recognizeLinuxDoRoute(document.location.href);
    if (route.kind !== 'topic') throw new Error('Expected topic route');
    const partialDetail = createTopicDetailDocument(
      route,
      extractTopic(document, route),
      detectLinuxDoCapabilities(document, route),
    );
    if (partialDetail.state !== 'ready') throw new Error('Expected partial topic detail');
    const onRequestEarlierPosts = vi.fn();
    const transfer = new NativeContentTransfer(document);
    const view = render(
      <TopicCodeEditorSurface
        document={partialDetail}
        hasEarlierPosts
        nativeContentTransfer={transfer}
        onRequestEarlierPosts={onRequestEarlierPosts}
        revision={1}
      />,
    );
    const surface = view.getByRole('document', { name: 'Topic code document' });
    const replies = Array.from(
      view.container.querySelectorAll<HTMLElement>('.docode-topic-code__reply'),
    );
    const firstReply = replies[0];
    const secondReply = replies[1];
    if (!firstReply || !secondReply) throw new Error('Missing partial topic replies.');
    defineScrollGeometry(surface, { clientHeight: 200, scrollHeight: 600 });
    mockViewportRect(surface, 0, 200);
    mockViewportRect(firstReply, () => -surface.scrollTop, 300);
    mockViewportRect(secondReply, () => 300 - surface.scrollTop, 300);
    surface.scrollTop = 0;
    fireEvent.scroll(surface);
    await waitFor(() => {
      expect(onRequestEarlierPosts).toHaveBeenCalledTimes(1);
    });

    const rerouted = requestTopicFloor(partialDetail, 19);
    view.rerender(
      <TopicCodeEditorSurface
        document={rerouted}
        hasEarlierPosts
        loadingEarlierPosts
        nativeContentTransfer={transfer}
        onRequestEarlierPosts={onRequestEarlierPosts}
        revision={1}
      />,
    );

    await waitFor(() => {
      expect(surface.scrollTop).toBeGreaterThan(0);
      expect(secondReply.getAttribute('data-active')).toBe('true');
      expect(secondReply.getAttribute('data-requested')).toBe('true');
    });
  });

  it('preserves the distance from the document end when exhausted continuation removes layout', async () => {
    const { detail } = setupTopic();
    const onRequestMorePosts = vi.fn();
    const transfer = new NativeContentTransfer(document);
    const view = render(
      <TopicCodeEditorSurface
        document={detail}
        hasMorePosts
        nativeContentTransfer={transfer}
        onRequestMorePosts={onRequestMorePosts}
        revision={1}
      />,
    );
    const surface = view.getByRole('document', { name: 'Topic code document' });
    const replies = Array.from(
      view.container.querySelectorAll<HTMLElement>('.docode-topic-code__reply'),
    );
    const firstReply = replies[0];
    const secondReply = replies[1];
    if (!firstReply || !secondReply) throw new Error('Missing topic replies.');
    defineScrollGeometry(surface, { clientHeight: 200, scrollHeight: 600 });
    mockViewportRect(surface, 0, 200);
    mockViewportRect(firstReply, () => -surface.scrollTop, 300);
    mockViewportRect(secondReply, () => 300 - surface.scrollTop, 300);
    surface.scrollTop = 320;
    fireEvent.scroll(surface);

    await waitFor(() => {
      expect(onRequestMorePosts).toHaveBeenCalledTimes(1);
      expect(secondReply.getAttribute('data-active')).toBe('true');
    });
    const preRequestDistanceFromEnd =
      surface.scrollHeight - surface.clientHeight - surface.scrollTop;
    const rerouted = requestTopicFloor(detail, 1);
    view.rerender(
      <TopicCodeEditorSurface
        document={rerouted}
        hasMorePosts
        loadingMorePosts
        nativeContentTransfer={transfer}
        onRequestMorePosts={onRequestMorePosts}
        revision={1}
      />,
    );
    expect(within(view.container).getAllByRole('article')[1]?.getAttribute('data-active')).toBe(
      'true',
    );
    Object.defineProperty(surface, 'scrollHeight', { configurable: true, value: 480 });
    surface.scrollTop = 120;
    fireEvent.scroll(surface);
    view.rerender(
      <TopicCodeEditorSurface
        document={rerouted}
        hasMorePosts={false}
        loadingMorePosts={false}
        nativeContentTransfer={transfer}
        onRequestMorePosts={onRequestMorePosts}
        revision={1}
      />,
    );

    expect(surface.scrollTop).toBe(480 - surface.clientHeight - preRequestDistanceFromEnd);
    expect(within(view.container).getAllByRole('article')[1]?.getAttribute('data-active')).toBe(
      'true',
    );
    fireEvent.scroll(surface);
    await waitFor(() => {
      expect(onRequestMorePosts).toHaveBeenCalledTimes(1);
    });
  });

  it('releases the pagination viewport checkpoint when a request fails without a rendered loading frame', async () => {
    const { detail } = setupTopic();
    const onRequestMorePosts = vi.fn();
    const onViewportChange = vi.fn();
    const transfer = new NativeContentTransfer(document);
    const view = render(
      <TopicCodeEditorSurface
        document={detail}
        hasMorePosts
        nativeContentTransfer={transfer}
        onRequestMorePosts={onRequestMorePosts}
        onViewportChange={onViewportChange}
        paginationStatus="idle"
        revision={1}
      />,
    );
    const surface = view.getByRole('document', { name: 'Topic code document' });
    const replies = Array.from(
      view.container.querySelectorAll<HTMLElement>('.docode-topic-code__reply'),
    );
    const firstReply = replies[0];
    const secondReply = replies[1];
    if (!firstReply || !secondReply) throw new Error('Missing topic replies.');
    defineScrollGeometry(surface, { clientHeight: 200, scrollHeight: 600 });
    mockViewportRect(surface, 0, 200);
    mockViewportRect(firstReply, () => -surface.scrollTop, 300);
    mockViewportRect(secondReply, () => 300 - surface.scrollTop, 300);
    surface.scrollTop = 320;
    fireEvent.scroll(surface);
    await waitFor(() => {
      expect(onRequestMorePosts).toHaveBeenCalledTimes(1);
    });

    view.rerender(
      <TopicCodeEditorSurface
        document={detail}
        hasMorePosts
        nativeContentTransfer={transfer}
        onRequestMorePosts={onRequestMorePosts}
        onViewportChange={onViewportChange}
        paginationStatus="error"
        revision={1}
        scrollRequest={{ progress: 0, sequence: 1 }}
      />,
    );

    await waitFor(() => {
      expect(surface.scrollTop).toBe(0);
      expect(onViewportChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ scrollProgress: 0, scrollTop: 0 }),
      );
    });
  });

  it('keeps deliberate user scrolling authoritative while continuation is pending', async () => {
    const { detail } = setupTopic();
    const onRequestMorePosts = vi.fn();
    const transfer = new NativeContentTransfer(document);
    const view = render(
      <TopicCodeEditorSurface
        document={detail}
        hasMorePosts
        nativeContentTransfer={transfer}
        onRequestMorePosts={onRequestMorePosts}
        revision={1}
      />,
    );
    const surface = view.getByRole('document', { name: 'Topic code document' });
    const replies = Array.from(
      view.container.querySelectorAll<HTMLElement>('.docode-topic-code__reply'),
    );
    const firstReply = replies[0];
    const secondReply = replies[1];
    if (!firstReply || !secondReply) throw new Error('Missing topic replies.');
    defineScrollGeometry(surface, { clientHeight: 200, scrollHeight: 600 });
    mockViewportRect(surface, 0, 200);
    mockViewportRect(firstReply, () => -surface.scrollTop, 300);
    mockViewportRect(secondReply, () => 300 - surface.scrollTop, 300);
    surface.scrollTop = 320;
    fireEvent.scroll(surface);
    await waitFor(() => {
      expect(onRequestMorePosts).toHaveBeenCalledTimes(1);
    });
    view.rerender(
      <TopicCodeEditorSurface
        document={detail}
        hasMorePosts
        loadingMorePosts
        nativeContentTransfer={transfer}
        onRequestMorePosts={onRequestMorePosts}
        revision={1}
      />,
    );
    fireEvent.wheel(surface);
    surface.scrollTop = 180;
    fireEvent.scroll(surface);
    view.rerender(
      <TopicCodeEditorSurface
        document={detail}
        hasMorePosts={false}
        loadingMorePosts={false}
        nativeContentTransfer={transfer}
        onRequestMorePosts={onRequestMorePosts}
        revision={1}
      />,
    );

    expect(surface.scrollTop).toBe(180);
  });

  it('updates incremental ranges and capability states from refreshed Linux DO evidence', () => {
    document.body.innerHTML = topicFixture().replace(
      'class="post-action-menu__copy-link">Copy</button>',
      'class="post-action-menu__copy-link" disabled>Copy</button>',
    );
    document.querySelector('.login-button')?.replaceWith(
      Object.assign(document.createElement('div'), {
        id: 'current-user',
        textContent: 'Fixture user',
      }),
    );
    const route = recognizeLinuxDoRoute(document.location.href);
    if (route.kind !== 'topic') throw new Error('Expected topic route');
    const firstDetail = createTopicDetailDocument(
      route,
      extractTopic(document, route),
      detectLinuxDoCapabilities(document, route),
    );
    if (firstDetail.state !== 'ready') throw new Error('Expected ready topic detail');
    const firstNativeRoot = firstDetail.replies[0]?.content?.root;
    const transfer = new NativeContentTransfer(document);
    const view = render(
      <TopicCodeEditorSurface
        document={firstDetail}
        nativeContentTransfer={transfer}
        revision={1}
      />,
    );
    const rendered = within(view.container);

    expect(tooltipElements(view.container, 'Copy Link: disabled by Linux DO')).toHaveLength(1);
    expect(tooltipElements(view.container, 'Like: available in original Linux DO')).toHaveLength(2);
    expect(
      tooltipElements(view.container, 'Bookmark: unavailable in DOCode; use original Linux DO'),
    ).toHaveLength(2);
    expect(
      view.container.querySelector('.docode-topic-code__loading-boundary[data-state="loading"]'),
    ).toBeNull();

    transfer.restoreAll();
    const loading = document.querySelector('.topic-post-loading');
    loading?.insertAdjacentHTML('beforebegin', thirdPostFixture());
    loading?.remove();
    const nextDetail = createTopicDetailDocument(
      route,
      extractTopic(document, route),
      detectLinuxDoCapabilities(document, route),
    );
    if (nextDetail.state !== 'ready') throw new Error('Expected refreshed topic detail');
    view.rerender(
      <TopicCodeEditorSurface
        document={nextDetail}
        nativeContentTransfer={transfer}
        revision={2}
      />,
    );

    expect(rendered.getAllByRole('article')).toHaveLength(3);
    expect(rendered.getByText('posts 1–3 loaded (3)')).toBeDefined();
    expect(view.container.querySelector('.docode-topic-code__loading-boundary')).toBeNull();
    expect(view.container.querySelector('.docode-topic-code__content-slot > .cooked')).toBe(
      firstNativeRoot,
    );
    expect(document.querySelectorAll('.docode-topic-code__content-slot > .cooked')).toHaveLength(3);
  });

  it('renders only the current long loaded window and exposes both incomplete edges', () => {
    window.history.replaceState({}, '', '/t/synthetic-topic/42/60');
    document.body.innerHTML = longTopicFixture(21, 80);
    const route = recognizeLinuxDoRoute(document.location.href);
    if (route.kind !== 'topic') throw new Error('Expected topic route');
    const detail = createTopicDetailDocument(
      route,
      extractTopic(document, route),
      detectLinuxDoCapabilities(document, route),
    );
    if (detail.state !== 'ready') throw new Error('Expected ready topic detail');
    const started = performance.now();
    const view = render(
      <TopicCodeEditorSurface
        document={detail}
        nativeContentTransfer={new NativeContentTransfer(document)}
        revision={1}
      />,
    );

    expect(view.container.querySelectorAll('.docode-topic-code__reply')).toHaveLength(80);
    expect(view.container.textContent).toContain('posts 21–100 loaded (80)');
    expect(view.container.textContent).toContain('Loaded range starts at post 21');
    expect(view.container.querySelector('[data-position="end"]')).toBeNull();
    expect(performance.now() - started).toBeLessThan(5_000);
  });
});

function setupTopic(): {
  readonly detail: ReadyTopicDetailDocument;
  readonly nativeRoots: readonly HTMLElement[];
  readonly sourceParents: readonly HTMLElement[];
} {
  document.body.innerHTML = topicFixture();
  const route = recognizeLinuxDoRoute(document.location.href);
  if (route.kind !== 'topic') throw new Error('Expected topic route');
  const extraction = extractTopic(document, route);
  const detail = createTopicDetailDocument(
    route,
    extraction,
    detectLinuxDoCapabilities(document, route),
  );
  if (detail.state !== 'ready') throw new Error('Expected ready topic detail');
  const nativeRoots = detail.replies.flatMap(({ content }) => (content ? [content.root] : []));
  const sourceParents = nativeRoots.map((root) => {
    const parent = root.parentElement;
    if (!parent) throw new Error('Missing native content parent');
    return parent;
  });
  return { detail, nativeRoots, sourceParents };
}

function requestTopicFloor(
  detail: ReadyTopicDetailDocument,
  postNumber: number,
): ReadyTopicDetailDocument {
  const route = recognizeLinuxDoRoute(
    `https://linux.do/t/synthetic-topic/${String(detail.topic.id)}/${String(postNumber)}`,
  );
  if (route.kind !== 'topic') throw new Error('Expected topic route');
  return {
    ...detail,
    loadedWindow: {
      ...detail.loadedWindow,
      containsRequestedPost: detail.replies.some(({ floor }) => floor.number === postNumber),
      requestedPostNumber: postNumber,
    },
    replies: detail.replies.map((reply) => ({
      ...reply,
      floor: { ...reply.floor, requested: reply.floor.number === postNumber },
    })),
    route,
  };
}

function tooltipElements(container: HTMLElement, content: string): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-docode-tooltip]')).filter(
    (element) => element.dataset.docodeTooltip === content,
  );
}

function setupLoggedInTopic(): ReadyTopicDetailDocument {
  document.body.innerHTML = topicFixture();
  document.querySelector('.login-button')?.replaceWith(
    Object.assign(document.createElement('div'), {
      id: 'current-user',
      textContent: 'Fixture user',
    }),
  );
  for (const like of document.querySelectorAll('.btn-toggle-reaction-like')) {
    const root = document.createElement('div');
    root.className = 'discourse-reactions-actions can-toggle-reaction';
    like.replaceWith(root);
    root.append(like);
    const bookmark = document.createElement('button');
    bookmark.className = 'post-action-menu__bookmark bookmark';
    bookmark.textContent = 'Bookmark';
    root.after(bookmark);
  }
  const route = recognizeLinuxDoRoute(document.location.href);
  if (route.kind !== 'topic') throw new Error('Expected topic route');
  const detail = createTopicDetailDocument(
    route,
    extractTopic(document, route),
    detectLinuxDoCapabilities(document, route),
  );
  if (detail.state !== 'ready') throw new Error('Expected ready topic detail');
  return detail;
}

function topicFixture(): string {
  return `<header class="d-header"><button class="login-button">Log in</button></header>
    <main id="main-outlet">
      <div class="title-wrapper">
        <h1 data-topic-id="42"><a class="fancy-title" href="/t/synthetic-topic/42">Synthetic topic</a></h1>
        <a href="/c/develop/4">Develop</a><a href="/tag/testing/7">Testing</a>
      </div>
      <div class="post-stream">
        <div data-post-number="1"><article data-post-id="100">
          <div class="topic-avatar"><img class="avatar" src="/user_avatar/linux.do/alice/48/1.png" alt=""></div>
          <div class="names"><a data-user-card="alice" href="/u/alice">Alice</a></div>
          <a class="post-date" href="/t/synthetic-topic/42"><span class="relative-date" data-time="2026-08-18T00:00:00Z">now</span></a>
          <div class="topic-body"><div class="cooked"><h2>Heading</h2><p>Body <a href="/t/linked-topic/77">native link</a></p><blockquote>Quote</blockquote><pre><code class="language-ts hljs"><span class="hljs-keyword">const</span> <span class="hljs-variable">value</span> = <span class="hljs-number">1</span>;</code></pre><img width="160" height="90" src="/image.png" data-original-src="/uploads/default/original/1x/original.png" onerror="unsafe()"></div></div>
          <button class="btn-toggle-reaction-like">Like</button><button class="post-action-menu__copy-link">Copy</button>
        </article></div>
        <div data-post-number="2"><article data-post-id="101">
          <div class="topic-avatar"><img class="avatar" src="/user_avatar/linux.do/bob/48/2.png" alt=""></div>
          <div class="names"><a data-user-card="bob" href="/u/bob">Bob</a></div>
          <a class="post-date" href="/t/synthetic-topic/42/2"><span class="relative-date" data-time="2026-08-18T01:00:00Z">later</span></a>
          <div class="topic-body"><div class="cooked"><ul><li>Second reply</li></ul><table><tbody><tr><td>Cell</td></tr></tbody></table></div></div>
          <button class="btn-toggle-reaction-like">Like</button><button class="post-action-menu__copy-link">Copy</button>
        </article></div>
        <div class="topic-post-loading"><span class="spinner"></span></div>
      </div>
      <div id="topic-footer-buttons"><div class="topic-footer-main-buttons"><button class="btn-primary create">Reply</button></div></div>
    </main><div id="reply-control" class="closed"></div>`;
}

function thirdPostFixture(): string {
  return `<div data-post-number="3"><article data-post-id="102">
    <div class="topic-avatar"><img class="avatar" src="/user_avatar/linux.do/carol/48/3.png" alt=""></div>
    <div class="names"><a data-user-card="carol" href="/u/carol">Carol</a></div>
    <a class="post-date" href="/t/synthetic-topic/42/3"><span class="relative-date" data-time="2026-08-18T02:00:00Z">latest</span></a>
    <div class="topic-body"><div class="cooked"><p>Incrementally loaded reply</p></div></div>
    <button class="post-action-menu__copy-link">Copy</button>
  </article></div>`;
}

function longTopicFixture(firstPostNumber: number, count: number): string {
  const posts = Array.from({ length: count }, (_, index) => {
    const number = firstPostNumber + index;
    const permalink =
      number === 1 ? '/t/synthetic-topic/42' : `/t/synthetic-topic/42/${String(number)}`;
    return `<div data-post-number="${String(number)}"><article data-post-id="${String(1_000 + number)}">
      <div class="topic-avatar"><img class="avatar" src="/user_avatar/linux.do/fixture-user/48/4.png" alt=""></div>
      <div class="names"><a data-user-card="fixture-user" href="/u/fixture-user">Fixture User</a></div>
      <a class="post-date" href="${permalink}"><span data-time="2026-08-18T00:00:00Z">now</span></a>
      <div class="cooked"><p>Loaded post ${String(number)}</p></div>
      <button class="post-action-menu__copy-link">Copy</button>
    </article></div>`;
  }).join('');
  return `<header class="d-header"><button class="login-button">Log in</button></header>
    <main id="main-outlet"><h1 data-topic-id="42"><a href="/t/synthetic-topic/42">Synthetic topic</a></h1>
      <div class="post-stream">${posts}<div class="topic-post-loading"><span class="spinner"></span></div></div>
      <div id="topic-footer-buttons"><div class="topic-footer-main-buttons"><button class="btn-primary create">Reply</button></div></div>
    </main><div id="reply-control" class="closed"></div>`;
}

function defineScrollGeometry(
  element: HTMLElement,
  values: { readonly clientHeight: number; readonly scrollHeight: number },
): void {
  Object.defineProperties(element, {
    clientHeight: { configurable: true, value: values.clientHeight },
    scrollHeight: { configurable: true, value: values.scrollHeight },
    scrollTop: { configurable: true, value: 0, writable: true },
  });
}

function mockViewportRect(element: Element, top: number | (() => number), height: number): void {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => {
      const resolvedTop = typeof top === 'function' ? top() : top;
      return {
        bottom: resolvedTop + height,
        height,
        left: 0,
        right: 800,
        toJSON: () => undefined,
        top: resolvedTop,
        width: 800,
        x: 0,
        y: resolvedTop,
      };
    },
  });
}
