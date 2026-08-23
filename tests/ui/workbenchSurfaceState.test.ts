// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://linux.do/latest" }

import { afterEach, describe, expect, it } from 'vitest';

import { recognizeLinuxDoRoute } from '../../src/linuxdo/routes';
import {
  createWorkbenchSurfaceState,
  createWorkbenchViewSnapshot,
} from '../../src/ui/workbench/workbenchSurfaceState';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('createWorkbenchSurfaceState', () => {
  it('maps real topic-list loading, empty, ready, and compatibility errors', () => {
    const route = recognizeLinuxDoRoute('https://linux.do/latest');

    document.body.innerHTML = '<main aria-busy="true"></main>';
    expect(createWorkbenchSurfaceState(document, route)).toMatchObject({
      code: 'topic-list-loading',
      kind: 'loading',
      retryLabel: null,
      title: 'Loading topics…',
    });

    document.body.innerHTML = '<main><table class="topic-list"><tbody></tbody></table></main>';
    expect(createWorkbenchSurfaceState(document, route)).toMatchObject({
      code: 'topic-list-empty',
      kind: 'empty',
      retryLabel: 'Refresh',
      title: 'No topics',
    });

    document.body.innerHTML = readyTopicListFixture();
    expect(createWorkbenchSurfaceState(document, route)).toMatchObject({ kind: 'ready' });
    expect(createWorkbenchViewSnapshot(document, route).topicListDocument).toMatchObject({
      lines: [{ lineNumber: 14, topicId: 42 }],
      state: 'ready',
    });

    document.body.innerHTML = '<main></main>';
    expect(createWorkbenchSurfaceState(document, route)).toMatchObject({
      code: 'topic-list-not-found',
      kind: 'error',
      retryLabel: 'Retry',
      title: 'Unable to read topics',
    });

    const deferred = createWorkbenchViewSnapshot(document, route, {
      deferTopicListCompatibilityError: true,
    });
    expect(deferred.surfaceState).toMatchObject({
      code: 'topic-list-loading',
      kind: 'loading',
      retryLabel: null,
      title: 'Loading topics…',
    });
    expect(deferred.topicListDocument).toMatchObject({ lines: [], state: 'loading' });
  });

  it('keeps an authenticated unread title deep link ready for real navigation', () => {
    const route = recognizeLinuxDoRoute('https://linux.do/unread');
    document.body.innerHTML = `<main><table class="topic-list"><tbody>
      <tr class="topic-list-item unread-posts" data-topic-id="43">
        <td class="main-link"><a class="title raw-link raw-topic-link" href="/t/unread-topic/43/6">Unread topic</a></td>
        <td class="posts">5</td><td class="views">80</td>
        <td class="activity"><a href="/t/unread-topic/43/8">now</a></td>
      </tr>
    </tbody></table></main>`;

    const snapshot = createWorkbenchViewSnapshot(document, route);

    expect(snapshot.surfaceState).toMatchObject({ kind: 'ready' });
    expect(snapshot.topicListDocument).toMatchObject({
      lines: [
        {
          readState: 'unread',
          topicId: 43,
          url: 'https://linux.do/t/unread-topic/43/6',
        },
      ],
      state: 'ready',
    });
  });

  it('maps real topic loading and post-stream errors without exposing page content', () => {
    const route = recognizeLinuxDoRoute('https://linux.do/t/synthetic-topic/42');

    document.body.innerHTML = '<main aria-busy="true"></main>';
    expect(createWorkbenchSurfaceState(document, route)).toMatchObject({
      code: 'topic-loading',
      kind: 'loading',
      title: 'Loading topic…',
    });

    document.body.innerHTML = `<main><h1 data-topic-id="42">
      <a class="fancy-title" href="/t/synthetic-topic/42">Private fixture title</a>
    </h1></main>`;
    expect(createWorkbenchSurfaceState(document, route)).toEqual({
      code: 'post-stream-not-found',
      description: 'Linux DO did not expose the expected post stream.',
      icon: 'error',
      kind: 'error',
      retryLabel: 'Retry',
      title: 'Unable to read this topic',
    });

    const deferred = createWorkbenchViewSnapshot(document, route, {
      deferTopicCompatibilityError: true,
    });
    expect(deferred.surfaceState).toMatchObject({
      code: 'topic-loading',
      kind: 'loading',
      retryLabel: null,
      title: 'Loading topic…',
    });
    expect(deferred.topicDetailDocument).toMatchObject({
      replies: [],
      state: 'loading',
      topic: null,
    });
  });

  it('provides one ready topic-detail snapshot with native content identity', () => {
    const route = recognizeLinuxDoRoute('https://linux.do/t/synthetic-topic/42');
    document.body.innerHTML = `<header class="d-header"><button class="login-button">Log in</button></header>
      <main><h1 data-topic-id="42"><a href="/t/synthetic-topic/42">Synthetic topic</a></h1>
        <div class="post-stream"><div data-post-number="1"><article data-post-id="100">
          <div class="names"><a data-user-card="alice" href="/u/alice">Alice</a></div>
          <a class="post-date" href="/t/synthetic-topic/42"><span data-time="2026-08-18T00:00:00Z">now</span></a>
          <div class="cooked"><p>Native content</p></div><button class="post-action-menu__copy-link">Copy</button>
        </article></div></div><div id="topic-footer-buttons"><div class="topic-footer-main-buttons"><button class="btn-primary create">Reply</button></div></div>
      </main><div id="reply-control" class="closed"></div>`;
    const nativeRoot = document.querySelector('.cooked');
    const snapshot = createWorkbenchViewSnapshot(document, route);

    expect(snapshot.surfaceState.kind).toBe('ready');
    expect(snapshot.topicListDocument).toBeNull();
    expect(snapshot.topicDetailDocument).toMatchObject({
      loadedWindow: { loadedPostCount: 1 },
      state: 'ready',
      topic: { id: 42, title: 'Synthetic topic' },
    });
    expect(
      snapshot.topicDetailDocument?.state === 'ready'
        ? snapshot.topicDetailDocument.replies[0]?.content?.root
        : null,
    ).toBe(nativeRoot);
  });

  it('distinguishes unsupported paths from recognized views without a renderer', () => {
    expect(
      createWorkbenchSurfaceState(document, recognizeLinuxDoRoute('https://linux.do/unknown')),
    ).toMatchObject({ code: 'unsupported-path', kind: 'unsupported', title: 'Unsupported route' });
    expect(
      createWorkbenchSurfaceState(document, recognizeLinuxDoRoute('https://linux.do/categories')),
    ).toMatchObject({
      code: 'view-not-implemented',
      kind: 'unsupported',
      title: 'View not available',
    });
  });
});

function readyTopicListFixture(): string {
  return `<main><table class="topic-list"><tbody>
    <tr data-topic-id="42">
      <td class="main-link"><a href="/t/synthetic-topic/42">Synthetic topic</a></td>
      <td class="posts" title="1 reply">1</td>
      <td class="views" title="2 views">2</td>
      <td class="activity"><a href="/t/synthetic-topic/42/2"><span data-time="2026-08-18T00:00:00Z">now</span></a></td>
    </tr>
  </tbody></table></main>`;
}
