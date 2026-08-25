// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://linux.do/t/synthetic-topic/42/2" }

import { afterEach, describe, expect, it } from 'vitest';

import {
  detectLinuxDoCapabilities,
  type LinuxDoCapabilityDetection,
} from '../../src/linuxdo/capabilities';
import { recognizeLinuxDoRoute } from '../../src/linuxdo/routes';
import { extractTopic, type TopicExtraction } from '../../src/linuxdo/topicAdapter';
import {
  createTopicDetailDocument,
  type TopicDetailRoute,
} from '../../src/views/topic/topicDetailDocument';

afterEach(() => {
  document.body.innerHTML = '';
  window.history.replaceState({}, '', '/t/synthetic-topic/42/2');
});

describe('createTopicDetailDocument', () => {
  it('preserves topic identity, native rich blocks, floor positions, and logged-out capabilities', () => {
    document.body.innerHTML = topicFixture();
    const route = topicRoute();
    const extraction = extractTopic(document, route);
    const detection = detectLinuxDoCapabilities(document, route);
    const firstContentRoot = document.querySelector<HTMLElement>('#post_1 .cooked');

    const model = createTopicDetailDocument(route, extraction, detection);

    expect(model).toMatchObject({
      capabilities: {
        composer: { fallback: 'native-login', state: 'authentication-required' },
        currentUserState: 'logged-out',
        reply: { fallback: 'native-login', state: 'authentication-required' },
        state: 'ready',
      },
      diagnostics: {
        errorCode: null,
        issueCodes: [],
        missingPostCapabilityCount: 0,
      },
      loadedWindow: {
        containsRequestedPost: true,
        firstPostNumber: 1,
        hasMorePosts: true,
        lastPostNumber: 2,
        loadedPostCount: 2,
        requestedPostNumber: 2,
      },
      state: 'ready',
      topic: {
        category: { id: 4, name: 'Develop' },
        closed: true,
        id: 42,
        pinned: true,
        tags: [{ id: 7, name: 'Testing' }],
        title: 'Synthetic topic',
        url: 'https://linux.do/t/synthetic-topic/42',
      },
    });
    if (model.state !== 'ready') throw new Error('Expected a ready topic model.');
    expect(model.replies.map(({ floor, id, topicId }) => ({ floor, id, topicId }))).toEqual([
      { floor: { loadedOrder: 0, number: 1, requested: false }, id: 100, topicId: 42 },
      { floor: { loadedOrder: 1, number: 2, requested: true }, id: 101, topicId: 42 },
    ]);
    expect(model.replies.map(({ replyToPostNumber }) => replyToPostNumber)).toEqual([null, 1]);
    expect(model.replies.map(({ readState }) => readState)).toEqual(['unread', 'unknown']);
    expect(model.replies[0]?.content?.root).toBe(firstContentRoot);
    expect(model.replies[0]?.content?.source).toBe('linuxdo-owned-dom');
    expect(model.replies[0]?.content?.blocks.map(({ kind }) => kind)).toEqual([
      'heading',
      'paragraph',
      'list',
      'quote',
      'code',
      'media',
      'table',
      'details',
      'horizontal-rule',
      'other',
    ]);
    expect(model.replies[0]?.capabilities).toEqual({
      bookmark: {
        active: null,
        code: 'authentication-required',
        fallback: 'native-login',
        state: 'authentication-required',
      },
      copyLink: { active: null, code: null, fallback: null, state: 'available' },
      like: {
        active: null,
        code: 'authentication-required',
        fallback: 'native-login',
        state: 'authentication-required',
      },
    });
  });

  it('keeps unsafe content Linux DO-owned without flattening or serializing it', () => {
    document.body.innerHTML = topicFixture({ unsafeContent: true });
    const route = topicRoute();
    const extraction = extractTopic(document, route);
    const model = createTopicDetailDocument(
      route,
      extraction,
      detectLinuxDoCapabilities(document, route),
    );

    if (model.state !== 'ready') throw new Error('Expected a ready topic model.');
    const content = model.replies[0]?.content;
    const sourceRoot = document.querySelector<HTMLElement>('#post_1 .cooked');
    expect(content?.root).toBe(sourceRoot);
    expect(content?.blocks.at(-1)?.element.querySelector('img')?.getAttribute('onerror')).toBe(
      'untrusted()',
    );
    expect(Object.keys(content ?? {})).toEqual(['blocks', 'root', 'source']);
    expect('html' in (content ?? {})).toBe(false);
  });

  it('preserves partial neighboring replies and reports missing capability bindings honestly', () => {
    document.body.innerHTML = topicFixture({ partialSecond: true });
    const route = topicRoute();
    const extraction = extractTopic(document, route);
    document.querySelector('#post_2')?.parentElement?.removeAttribute('data-post-number');
    const detection = detectLinuxDoCapabilities(document, route);

    const model = createTopicDetailDocument(route, extraction, detection);

    if (model.state !== 'ready') throw new Error('Expected a ready topic model.');
    expect(model.diagnostics).toMatchObject({
      issueCodes: ['missing-post-author', 'missing-post-content'],
      missingPostCapabilityCount: 1,
    });
    expect(model.replies).toHaveLength(2);
    expect(model.replies[1]).toMatchObject({
      author: null,
      capabilities: {
        bookmark: { code: 'post-capability-not-found', state: 'unavailable' },
        copyLink: { code: 'post-capability-not-found', state: 'unavailable' },
        like: { code: 'post-capability-not-found', state: 'unavailable' },
      },
      completeness: 'partial',
      content: null,
      floor: { number: 2, requested: true },
      id: 101,
    });
  });

  it('keeps Like actionable through the API fallback for signed-in unbound posts', () => {
    document.body.innerHTML = topicFixture({ partialSecond: true });
    document.querySelector('.d-header')?.replaceChildren();
    const currentUser = document.createElement('div');
    currentUser.id = 'current-user';
    currentUser.setAttribute('data-username', 'fixture-user');
    document.querySelector('.d-header')?.append(currentUser);
    const route = topicRoute();
    const extraction = extractTopic(document, route);
    document.querySelector('#post_2')?.parentElement?.removeAttribute('data-post-number');
    const detection = detectLinuxDoCapabilities(document, route);

    const model = createTopicDetailDocument(route, extraction, detection);

    if (model.state !== 'ready') throw new Error('Expected a ready topic model.');
    expect(model.replies[1]?.capabilities).toMatchObject({
      bookmark: { code: 'post-capability-not-found', state: 'unavailable' },
      copyLink: { code: 'post-capability-not-found', state: 'unavailable' },
      like: { code: 'post-capability-not-found', fallback: null, state: 'available' },
    });
  });

  it('keeps Like actionable through the API when the current user cannot be resolved', () => {
    document.body.innerHTML = topicFixture();
    document.querySelector('.d-header')?.replaceChildren();
    const route = topicRoute();
    const extraction = extractTopic(document, route);
    const detection = detectLinuxDoCapabilities(document, route);

    const model = createTopicDetailDocument(route, extraction, detection);

    if (model.state !== 'ready') throw new Error('Expected a ready topic model.');
    expect(model.capabilities.currentUserState).toBe('unknown');
    expect(model.replies[0]?.capabilities.like).toMatchObject({
      code: 'current-user-unresolved',
      state: 'available',
    });
    expect(model.replies[0]?.capabilities.bookmark.state).toBe('unavailable');
  });

  it('reflects confirmed Like overrides even for posts without native bindings', () => {
    document.body.innerHTML = topicFixture({ partialSecond: true });
    document.querySelector('.d-header')?.replaceChildren();
    const currentUser = document.createElement('div');
    currentUser.id = 'current-user';
    currentUser.setAttribute('data-username', 'fixture-user');
    document.querySelector('.d-header')?.append(currentUser);
    const route = topicRoute();
    const extraction = extractTopic(document, route);
    document.querySelector('#post_2')?.parentElement?.removeAttribute('data-post-number');
    const detection = detectLinuxDoCapabilities(document, route);

    const model = createTopicDetailDocument(route, extraction, detection, new Map([[101, true]]));

    if (model.state !== 'ready') throw new Error('Expected a ready topic model.');
    expect(model.replies[1]?.capabilities.like).toMatchObject({
      active: true,
      state: 'available',
    });
    expect(model.replies[0]?.capabilities.like.active).not.toBe(true);
  });

  it('retains an incremental loaded window when the requested floor is not present', () => {
    window.history.replaceState({}, '', '/t/synthetic-topic/42/8');
    document.body.innerHTML = topicFixture();
    const route = topicRoute();
    const extraction = extractTopic(document, route);

    const model = createTopicDetailDocument(
      route,
      extraction,
      detectLinuxDoCapabilities(document, route),
    );

    expect(model).toMatchObject({
      loadedWindow: {
        containsRequestedPost: false,
        firstPostNumber: 1,
        hasMorePosts: true,
        lastPostNumber: 2,
        loadedPostCount: 2,
        requestedPostNumber: 8,
      },
      state: 'ready',
    });
  });

  it('preserves loading and bounded error states without creating replies', () => {
    const route = topicRoute();
    const detection = unsupportedCapabilities();
    const loading: TopicExtraction = {
      issues: [],
      posts: [],
      state: 'loading',
      topic: null,
    };
    const error: TopicExtraction = {
      code: 'post-stream-not-found',
      issues: [],
      posts: [],
      state: 'error',
      topic: {
        category: null,
        closed: false,
        id: 42,
        pinned: false,
        tags: [],
        title: 'Synthetic topic',
        url: 'https://linux.do/t/synthetic-topic/42',
      },
    };

    expect(createTopicDetailDocument(route, loading, detection)).toMatchObject({
      capabilities: { state: 'unsupported' },
      loadedWindow: null,
      replies: [],
      state: 'loading',
      topic: null,
    });
    expect(createTopicDetailDocument(route, error, detection)).toMatchObject({
      diagnostics: { errorCode: 'post-stream-not-found' },
      loadedWindow: null,
      replies: [],
      state: 'error',
      topic: { id: 42, title: 'Synthetic topic' },
    });
  });
});

interface TopicFixtureOptions {
  readonly partialSecond?: boolean;
  readonly unsafeContent?: boolean;
}

function topicFixture(options: TopicFixtureOptions = {}): string {
  return `<header class="d-header"><button class="login-button">Log in</button></header>
    <div id="main-outlet"><main>
      <div class="title-wrapper">
        <h1 data-topic-id="42"><a class="fancy-title" href="/t/synthetic-topic/42">Synthetic topic</a></h1>
        <span class="topic-status"><svg class="d-icon d-icon-lock"></svg></span>
        <span class="topic-status"><svg class="d-icon d-icon-thumbtack"></svg></span>
        <a href="/c/develop/4">Develop</a>
        <a href="/tag/testing/7">Testing</a>
      </div>
      <div class="post-stream">
        ${postFixture(1, 100, false, options.unsafeContent === true)}
        <div data-post-number="2" data-docode-reply-to-post-number="1">${postFixture(2, 101, options.partialSecond === true, false, true)}</div>
        <div class="topic-post-loading"><span class="spinner"></span></div>
      </div>
      <div id="topic-footer-buttons"><div class="topic-footer-main-buttons"><button class="btn-primary create">Reply</button></div></div>
    </main></div>
    <div id="reply-control" class="closed"></div>`;
}

function postFixture(
  number: number,
  id: number,
  partial: boolean,
  unsafeContent: boolean,
  wrapped = false,
): string {
  const wrapperStart = wrapped ? '' : `<div data-post-number="${String(number)}">`;
  const wrapperEnd = wrapped ? '' : '</div>';
  const author = partial
    ? ''
    : '<div class="names"><a href="/u/fixture-user" data-user-card="fixture-user">Fixture User</a></div>';
  const content = partial
    ? ''
    : `<div class="cooked">
        <h2>Heading</h2><p>Paragraph</p><ul><li>Item</li></ul><blockquote>Quote</blockquote>
        <pre><code>const safe = true;</code></pre><figure><img src="/image.png" alt="Image"></figure>
        <table><tbody><tr><td>Cell</td></tr></tbody></table><details><summary>More</summary></details><hr>
        <div>${unsafeContent ? '<img src="invalid" onerror="untrusted()">' : 'Other'}</div>
      </div>`;
  const permalink =
    number === 1 ? '/t/synthetic-topic/42' : `/t/synthetic-topic/42/${String(number)}`;
  return `${wrapperStart}<article id="post_${String(number)}" data-post-id="${String(id)}">
      ${author}
      <a class="post-date" href="${permalink}" aria-label="August 18, 2026"><span data-time="1787011200000">now</span></a>
      <div class="topic-meta-data"><div class="post-infos">
        ${number === 1 ? '<div class="read-state" title="帖子未读"></div>' : ''}
      </div></div>
      ${content}
      <nav><button class="btn-toggle-reaction-like">Like</button><button class="post-action-menu__copy-link">Copy link</button></nav>
    </article>${wrapperEnd}`;
}

function topicRoute(): TopicDetailRoute {
  const route = recognizeLinuxDoRoute(window.location.href);
  if (route.kind !== 'topic') throw new Error('Expected a topic route.');
  return route;
}

function unsupportedCapabilities(): LinuxDoCapabilityDetection {
  return {
    code: 'unsupported-route',
    diagnostics: [{ code: 'unsupported-route', feature: 'current-user', postNumber: null }],
    state: 'unsupported',
  };
}
