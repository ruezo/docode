// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  POST_REPLY_OPEN_EVENT,
  POST_REPLY_OPEN_RESULT_EVENT,
  SPA_NAVIGATE_EVENT,
  SPA_NAVIGATE_RESULT_EVENT,
  dispatchPostReplyOpen,
  handlePostReplyOpen,
  handleSpaNavigate,
  openNativeReplyComposer,
  readPostReplyOpenDetail,
  readPostReplyOpenResult,
  readSpaNavigateResult,
} from '../../src/linuxdo/pageBridge';

interface DiscourseFixture {
  readonly openCalls: object[];
  readonly topic: {
    readonly draft_key: string;
    readonly draft_sequence: number;
    readonly id: number;
    readonly postStream: {
      readonly findPostsByIds: ReturnType<typeof vi.fn>;
      readonly posts: readonly object[];
    };
  };
}

afterEach(() => {
  Reflect.deleteProperty(window, 'Discourse');
  Reflect.deleteProperty(window, 'require');
});

describe('pageBridge post reply', () => {
  it('round-trips the open request through a string CustomEvent payload', () => {
    const details: unknown[] = [];
    const listener = (event: Event) => {
      details.push(readPostReplyOpenDetail(event));
    };
    document.addEventListener(POST_REPLY_OPEN_EVENT, listener);

    dispatchPostReplyOpen(document, { postId: 907, postNumber: 9, topicId: 42 });
    document.dispatchEvent(new CustomEvent(POST_REPLY_OPEN_EVENT, { detail: { postId: 1 } }));
    document.dispatchEvent(
      new CustomEvent(POST_REPLY_OPEN_EVENT, { detail: JSON.stringify({ postId: 0 }) }),
    );

    expect(details).toEqual([{ postId: 907, postNumber: 9, topicId: 42 }, null, null]);
    document.removeEventListener(POST_REPLY_OPEN_EVENT, listener);
  });

  it('opens the native composer with an already loaded post model', async () => {
    const fixture = installDiscourse({ loadedPostNumbers: [9] });

    await expect(
      openNativeReplyComposer(document, { postId: 907, postNumber: 9, topicId: 42 }),
    ).resolves.toBe(true);

    expect(fixture.openCalls).toHaveLength(1);
    expect(fixture.openCalls[0]).toMatchObject({
      action: 'reply',
      draftKey: 'topic_42',
      draftSequence: 3,
    });
    expect(Reflect.get(fixture.openCalls[0] ?? {}, 'post')).toBe(fixture.topic.postStream.posts[0]);
    expect(Reflect.get(fixture.openCalls[0] ?? {}, 'topic')).toBe(fixture.topic);
    expect(fixture.topic.postStream.findPostsByIds).not.toHaveBeenCalled();
  });

  it('loads an unloaded post through the native stream before opening', async () => {
    const fixture = installDiscourse({ loadedPostNumbers: [] });
    const fetchedPost = { id: 907, post_number: 9 };
    fixture.topic.postStream.findPostsByIds.mockResolvedValueOnce([fetchedPost]);

    await expect(
      openNativeReplyComposer(document, { postId: 907, postNumber: 9, topicId: 42 }),
    ).resolves.toBe(true);

    expect(fixture.topic.postStream.findPostsByIds).toHaveBeenCalledWith([907]);
    expect(Reflect.get(fixture.openCalls[0] ?? {}, 'post')).toBe(fetchedPost);
  });

  it('refuses to open against a different topic than requested', async () => {
    const fixture = installDiscourse({ loadedPostNumbers: [9] });

    await expect(
      openNativeReplyComposer(document, { postId: 907, postNumber: 9, topicId: 41 }),
    ).resolves.toBe(false);
    expect(fixture.openCalls).toHaveLength(0);
  });

  it('routes SPA navigation through the Discourse url helper and reports honestly', () => {
    const results: unknown[] = [];
    const listener = (event: Event) => {
      results.push(readSpaNavigateResult(event));
    };
    document.addEventListener(SPA_NAVIGATE_RESULT_EVENT, listener);
    const routeTo = vi.fn();
    Object.defineProperty(window, 'require', {
      configurable: true,
      value: (moduleId: string) =>
        moduleId === 'discourse/lib/url' ? { default: { routeTo } } : null,
      writable: true,
    });

    handleSpaNavigate(
      document,
      new CustomEvent(SPA_NAVIGATE_EVENT, { detail: JSON.stringify({ path: '/t/topic/42' }) }),
    );
    handleSpaNavigate(
      document,
      new CustomEvent(SPA_NAVIGATE_EVENT, {
        detail: JSON.stringify({ path: '//evil.example/x' }),
      }),
    );
    handleSpaNavigate(
      document,
      new CustomEvent(SPA_NAVIGATE_EVENT, {
        detail: JSON.stringify({ path: 'https://evil.example/x' }),
      }),
    );
    Reflect.deleteProperty(window, 'require');
    handleSpaNavigate(
      document,
      new CustomEvent(SPA_NAVIGATE_EVENT, { detail: JSON.stringify({ path: '/hot' }) }),
    );

    expect(routeTo).toHaveBeenCalledExactlyOnceWith('/t/topic/42');
    expect(results).toEqual([
      { ok: true, path: '/t/topic/42' },
      { ok: false, path: '/hot' },
    ]);
    document.removeEventListener(SPA_NAVIGATE_RESULT_EVENT, listener);
  });

  it('always answers an open request with an honest result event', async () => {
    const results: unknown[] = [];
    const listener = (event: Event) => {
      results.push(readPostReplyOpenResult(event));
    };
    document.addEventListener(POST_REPLY_OPEN_RESULT_EVENT, listener);
    const request = new CustomEvent(POST_REPLY_OPEN_EVENT, {
      detail: JSON.stringify({ postId: 907, postNumber: 9, topicId: 42 }),
    });

    await handlePostReplyOpen(document, request);
    installDiscourse({ loadedPostNumbers: [9] });
    await handlePostReplyOpen(document, request);
    await handlePostReplyOpen(document, new CustomEvent(POST_REPLY_OPEN_EVENT, { detail: 7 }));

    expect(results).toEqual([{ ok: false }, { ok: true }]);
    document.removeEventListener(POST_REPLY_OPEN_RESULT_EVENT, listener);
  });
});

function installDiscourse(options: { loadedPostNumbers: readonly number[] }): DiscourseFixture {
  const openCalls: object[] = [];
  const topic = {
    draft_key: 'topic_42',
    draft_sequence: 3,
    id: 42,
    postStream: {
      findPostsByIds: vi.fn(),
      posts: options.loadedPostNumbers.map((postNumber) => ({
        id: postNumber + 898,
        post_number: postNumber,
      })),
    },
  };
  const container = {
    lookup: (name: string) => {
      if (name === 'controller:topic') return { model: topic };
      if (name === 'service:composer') {
        return {
          open: (composerOptions: object) => {
            openCalls.push(composerOptions);
            return Promise.resolve();
          },
        };
      }
      return null;
    },
  };
  Object.defineProperty(window, 'Discourse', {
    configurable: true,
    value: { __container__: container },
    writable: true,
  });
  return { openCalls, topic };
}
