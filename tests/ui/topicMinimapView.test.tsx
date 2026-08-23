// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TopicMinimapView } from '../../src/views/topic/TopicMinimapView';
import type { TopicMinimapModel } from '../../src/views/topic/topicOverviewModel';
import type { TopicViewportState } from '../../src/views/topic/topicViewport';

afterEach(cleanup);

describe('TopicMinimapView', () => {
  it('renders content-derived microtext, real permalinks, and proportional slider state', () => {
    const view = renderMinimap();

    expect(screen.getByRole('complementary', { name: 'Topic minimap' })).toBeDefined();
    const firstMark = screen.getByRole('link', { name: 'Open post 1 from minimap' });
    const secondMark = screen.getByRole('link', { name: 'Open post 2 from minimap' });
    expect(firstMark.getAttribute('href')).toBe('https://linux.do/t/synthetic-topic/42');
    expect(firstMark.getAttribute('data-markers')).toContain('original-post');
    expect(secondMark.getAttribute('aria-current')).toBe('location');
    const glyphLayer = view.container.querySelector('.docode-topic-minimap__glyph-layer');
    const glyphLines = Array.from(
      view.container.querySelectorAll<HTMLElement>('.docode-topic-minimap__glyph-line'),
    );
    expect(glyphLayer?.getAttribute('aria-hidden')).toBe('true');
    expect(glyphLines).toHaveLength(5);
    expect(glyphLines[0]?.textContent).toBe('topic Synthetic topic {');
    expect(glyphLines[0]?.querySelector('[data-tone="keyword"]')?.textContent).toBe('topic ');
    expect(glyphLines[2]?.textContent).toBe('Rendered rich content.');
    expect(glyphLines.at(-1)?.getAttribute('data-line-number')).toBe('8');
    expect(glyphLines.at(-1)?.textContent).toBe('}');
    const slider = screen.getByRole('slider', { name: 'Topic viewport' });
    expect(slider.getAttribute('aria-valuemin')).toBe('1');
    expect(slider.getAttribute('aria-valuemax')).toBe('2');
    expect(slider.getAttribute('aria-valuenow')).toBe('2');
    expect(slider.style.getPropertyValue('--docode-minimap-slider-progress')).toBe('0.5');
    expect(slider.style.getPropertyValue('--docode-minimap-slider-size')).toBe('25%');
  });

  it('preserves mark anchor semantics and focuses loaded content only on primary activation', () => {
    const onNavigatePost = vi.fn();
    renderMinimap({ onNavigatePost });
    const firstMark = screen.getByRole('link', { name: 'Open post 1 from minimap' });
    let defaultPrevented: boolean | null = null;
    const preventNavigation = (event: MouseEvent) => {
      defaultPrevented ??= event.defaultPrevented;
      event.preventDefault();
    };
    document.addEventListener('click', preventNavigation);

    fireEvent.click(firstMark, { button: 0 });
    fireEvent.click(firstMark, { button: 0, ctrlKey: true });
    document.removeEventListener('click', preventNavigation);

    expect(defaultPrevented).toBe(false);
    expect(onNavigatePost).toHaveBeenCalledTimes(1);
    expect(onNavigatePost).toHaveBeenCalledWith(100);
  });

  it('maps track clicks, slider dragging, and keyboard movement to bounded scroll progress', async () => {
    const user = userEvent.setup();
    const onScrollProgress = vi.fn();
    const view = renderMinimap({ onScrollProgress });
    const track = view.container.querySelector<HTMLElement>('.docode-topic-minimap__track');
    const slider = screen.getByRole('slider', { name: 'Topic viewport' });
    if (!track) throw new Error('Missing minimap track');
    mockRect(track, { height: 100, top: 0 });
    mockRect(slider, { height: 20, top: 20 });
    Object.assign(slider, {
      hasPointerCapture: () => true,
      releasePointerCapture: () => undefined,
      setPointerCapture: () => undefined,
    });

    fireEvent.pointerDown(track, { button: 0, clientY: 50, pointerId: 1 });
    expect(onScrollProgress).toHaveBeenLastCalledWith(0.5);

    fireEvent.pointerDown(slider, { button: 0, clientY: 25, pointerId: 2 });
    fireEvent.pointerMove(slider, { buttons: 1, clientY: 85, pointerId: 2 });
    expect(onScrollProgress).toHaveBeenLastCalledWith(1);
    fireEvent.pointerUp(slider, { button: 0, clientY: 85, pointerId: 2 });
    expect(slider.hasAttribute('data-dragging')).toBe(false);

    slider.focus();
    await user.keyboard('{Home}');
    expect(onScrollProgress).toHaveBeenLastCalledWith(0);
    await user.keyboard('{End}');
    expect(onScrollProgress).toHaveBeenLastCalledWith(1);
    await user.keyboard('{ArrowUp}');
    expect(onScrollProgress).toHaveBeenLastCalledWith(0);
  });

  it('renders honest loading, error, and empty states', () => {
    const view = renderMinimap({ model: null });
    expect(screen.getByText('Loading topic minimap…')).toBeDefined();

    view.rerender(
      <TopicMinimapView
        model={{ ...model([]), diagnosticCode: 'post-stream-not-found', state: 'error' }}
        onNavigatePost={() => undefined}
        onScrollProgress={() => undefined}
        viewport={null}
      />,
    );
    expect(screen.getByText('Topic minimap unavailable.')).toBeDefined();

    view.rerender(
      <TopicMinimapView
        model={model([])}
        onNavigatePost={() => undefined}
        onScrollProgress={() => undefined}
        viewport={null}
      />,
    );
    expect(screen.getByText('No loaded posts to map.')).toBeDefined();
  });
});

function renderMinimap(
  overrides: {
    readonly model?: TopicMinimapModel | null;
    readonly onNavigatePost?: (postId: number) => void;
    readonly onScrollProgress?: (progress: number) => void;
    readonly viewport?: TopicViewportState | null;
  } = {},
) {
  return render(
    <TopicMinimapView
      model={overrides.model === undefined ? model() : overrides.model}
      onNavigatePost={overrides.onNavigatePost ?? (() => undefined)}
      onScrollProgress={overrides.onScrollProgress ?? (() => undefined)}
      viewport={overrides.viewport === undefined ? viewport() : overrides.viewport}
    />,
  );
}

function model(points: TopicMinimapModel['points'] = defaultPoints()): TopicMinimapModel {
  return {
    currentPosition: {
      loadedOrder: 1,
      postId: 101,
      postNumber: 2,
      source: 'viewport',
    },
    diagnosticCode: null,
    lineCount: 8,
    lines: [
      {
        id: 'topic:signature',
        indent: 0,
        lineNumber: 1,
        position: 0,
        postId: null,
        tokens: [
          { text: 'topic ', tone: 'keyword' },
          { text: 'Synthetic topic', tone: 'link' },
          { text: ' {', tone: 'punctuation' },
        ],
      },
      {
        id: 'post:100:signature',
        indent: 0,
        lineNumber: 3,
        position: 2 / 7,
        postId: 100,
        tokens: [
          { text: 'reply ', tone: 'keyword' },
          { text: '@fixture-user', tone: 'link' },
          { text: ' {', tone: 'punctuation' },
        ],
      },
      {
        id: 'post:100:content:0',
        indent: 0,
        lineNumber: 6,
        position: 5 / 7,
        postId: 100,
        tokens: [{ text: 'Rendered rich content.', tone: 'text' }],
      },
      {
        id: 'post:100:close',
        indent: 0,
        lineNumber: 7,
        position: 6 / 7,
        postId: 100,
        tokens: [{ text: '}', tone: 'punctuation' }],
      },
      {
        id: 'topic:close',
        indent: 0,
        lineNumber: 8,
        position: 1,
        postId: null,
        tokens: [{ text: '}', tone: 'punctuation' }],
      },
    ],
    points,
    range: {
      after: 'complete',
      before: 'complete',
      containsRequestedPost: true,
      firstPostNumber: 1,
      lastPostNumber: 2,
      loadedPostCount: 2,
      requestedPostNumber: 2,
      scope: 'loaded-window',
    },
    state: 'ready',
    topicId: 42,
  };
}

function defaultPoints(): TopicMinimapModel['points'] {
  return [
    {
      id: 'post:100',
      loadedOrder: 0,
      markers: ['original-post', 'heading', 'code'],
      permalink: 'https://linux.do/t/synthetic-topic/42',
      position: 0,
      postId: 100,
      postNumber: 1,
    },
    {
      id: 'post:101',
      loadedOrder: 1,
      markers: ['current', 'media', 'requested'],
      permalink: 'https://linux.do/t/synthetic-topic/42/2',
      position: 1,
      postId: 101,
      postNumber: 2,
    },
  ];
}

function viewport(): TopicViewportState {
  return {
    clientHeight: 200,
    currentPostId: 101,
    scrollHeight: 800,
    scrollProgress: 0.5,
    scrollTop: 300,
    size: 0.25,
    start: 0.375,
  };
}

function mockRect(
  element: Element,
  values: { readonly height: number; readonly top: number },
): void {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      bottom: values.top + values.height,
      height: values.height,
      left: 0,
      right: 96,
      toJSON: () => undefined,
      top: values.top,
      width: 96,
      x: 0,
      y: values.top,
    }),
  });
}
