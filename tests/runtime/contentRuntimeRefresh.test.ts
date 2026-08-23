// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://linux.do/t/synthetic-topic/42" }

import { afterEach, describe, expect, it, vi } from 'vitest';

const workbench = vi.hoisted(() => ({
  refresh: vi.fn(() => true),
  unmount: vi.fn(() => true),
}));

vi.mock('../../src/ui/workbench/mountWorkbench', () => ({
  hasWorkbenchRoot: () => false,
  mountWorkbench: () => ({
    element: document.createElement('div'),
    readTopic: () => ({
      code: 'post-stream-not-found',
      issues: [],
      posts: [],
      state: 'error',
      topic: null,
    }),
    refresh: workbench.refresh,
    unmount: workbench.unmount,
    updateRoute: () => true,
  }),
}));

import { ContentRuntime } from '../../src/runtime/contentRuntime';

afterEach(() => {
  workbench.refresh.mockClear();
  workbench.unmount.mockClear();
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('data-docode-runtime');
  document.documentElement.removeAttribute('data-docode-presentation');
  document.head.querySelectorAll('[data-docode-owned-style]').forEach((element) => {
    element.remove();
  });
});

describe('ContentRuntime refresh scheduling', () => {
  it('coalesces a burst of native mutations into one animation-frame refresh', async () => {
    document.body.innerHTML = `<main>
      <h1 data-topic-id="42"><a href="/t/synthetic-topic/42">Synthetic topic</a></h1>
      <div class="post-stream"></div>
    </main>`;
    const requestAnimationFrameDescriptor = Object.getOwnPropertyDescriptor(
      window,
      'requestAnimationFrame',
    );
    const frames: FrameRequestCallback[] = [];
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: (callback: FrameRequestCallback) => {
        frames.push(callback);
        return frames.length;
      },
    });
    const runtime = new ContentRuntime(document);

    try {
      const stream = document.querySelector('.post-stream');
      if (!stream) throw new Error('Missing post stream fixture.');
      for (let postId = 1; postId <= 3; postId += 1) {
        const article = document.createElement('article');
        article.dataset.postId = String(postId);
        stream.append(article);
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
      await Promise.resolve();

      expect(frames).toHaveLength(1);
      expect(workbench.refresh).not.toHaveBeenCalled();
      frames[0]?.(16);
      expect(workbench.refresh).toHaveBeenCalledOnce();
    } finally {
      runtime.unmount();
      if (requestAnimationFrameDescriptor) {
        Object.defineProperty(window, 'requestAnimationFrame', requestAnimationFrameDescriptor);
      } else {
        Reflect.deleteProperty(window, 'requestAnimationFrame');
      }
    }
  });
});
