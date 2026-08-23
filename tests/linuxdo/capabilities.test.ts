// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://linux.do/t/synthetic-topic/42" }

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  detectLinuxDoComposerCapability,
  detectLinuxDoCapabilities,
  detectLinuxDoCurrentUser,
  detectLinuxDoPostReplyCapability,
  LinuxDoCapabilityObserver,
  summarizeCapabilityDetection,
} from '../../src/linuxdo/capabilities';
import { DOCODE_PAGINATED_POST_ATTRIBUTE } from '../../src/linuxdo/topicAdapter';
import { recognizeLinuxDoRoute } from '../../src/linuxdo/routes';

afterEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  window.history.replaceState({}, '', '/t/synthetic-topic/42');
});

describe('detectLinuxDoCapabilities', () => {
  it('resolves the current viewer independently of the active Linux DO route', () => {
    window.history.replaceState({}, '', '/latest');
    document.body.innerHTML =
      '<header class="d-header"><div id="current-user" data-username="fixture-user"></div></header>';

    expect(detectLinuxDoCurrentUser(document)).toEqual({
      state: 'logged-in',
      username: 'fixture-user',
    });

    document.body.innerHTML =
      '<header class="d-header"><button class="login-button">Log in</button></header>';
    expect(detectLinuxDoCurrentUser(document)).toEqual({
      state: 'logged-out',
      username: null,
    });
  });

  it('detects Composer state without enumerating the loaded post window', () => {
    document.body.innerHTML = capabilityFixture({ composerOpen: true, user: 'logged-in' });
    const queryAll = vi.spyOn(document, 'querySelectorAll');

    const composer = detectLinuxDoComposerCapability(
      document,
      recognizeLinuxDoRoute(window.location.href),
    );

    expect(composer).toMatchObject({ state: 'open', topicId: 42 });
    expect(queryAll).not.toHaveBeenCalled();
  });

  it('reports logged-out actions independently and keeps the public copy-link binding', () => {
    document.body.innerHTML = capabilityFixture({ user: 'logged-out' });

    const result = detectLinuxDoCapabilities(document, recognizeLinuxDoRoute(window.location.href));

    expect(result).toMatchObject({
      composer: {
        code: 'authentication-required',
        fallback: 'native-login',
        root: null,
        state: 'authentication-required',
      },
      currentUser: { state: 'logged-out', username: null },
      posts: [
        {
          bookmark: {
            code: 'authentication-required',
            control: null,
            fallback: 'native-login',
            state: 'authentication-required',
          },
          copyLink: { code: null, fallback: null, state: 'available' },
          like: {
            code: 'authentication-required',
            control: null,
            fallback: 'native-login',
            state: 'authentication-required',
          },
          postId: 100,
          postNumber: 1,
        },
      ],
      reply: {
        code: 'authentication-required',
        control: null,
        fallback: 'native-login',
        state: 'authentication-required',
      },
      state: 'ready',
    });
    if (result.state !== 'ready') throw new Error('Expected ready capabilities.');
    expect(result.posts[0]?.copyLink.control).toBe(
      document.querySelector('.post-action-menu__copy-link'),
    );
    expect(result.diagnostics).toEqual([
      { code: 'authentication-required', feature: 'like', postNumber: 1 },
      { code: 'authentication-required', feature: 'bookmark', postNumber: 1 },
      { code: 'authentication-required', feature: 'reply', postNumber: null },
      { code: 'authentication-required', feature: 'composer', postNumber: null },
    ]);
  });

  it('keeps available logged-in features working when bookmark binding is absent', () => {
    document.body.innerHTML = capabilityFixture({ user: 'logged-in' });

    const result = detectLinuxDoCapabilities(document, recognizeLinuxDoRoute(window.location.href));

    expect(result).toMatchObject({
      composer: { code: null, fallback: null, state: 'closed' },
      currentUser: { state: 'logged-in', username: 'fixture-user' },
      posts: [
        {
          bookmark: {
            code: 'native-control-not-found',
            fallback: 'original-view',
            state: 'unavailable',
          },
          copyLink: { code: null, state: 'available' },
          like: { code: null, state: 'available' },
        },
      ],
      reply: { code: null, state: 'available' },
      state: 'ready',
    });
    expect(summarizeCapabilityDetection(result, 3)).toEqual({
      availableBookmarkCount: 0,
      availableCopyLinkCount: 1,
      availableLikeCount: 1,
      composerState: 'closed',
      diagnosticCodes: ['native-control-not-found'],
      generation: 3,
      postCount: 1,
      replyState: 'available',
      state: 'ready',
      userState: 'logged-in',
    });
  });

  it('binds an explicit floor Reply only to its real native post control', () => {
    document.body.innerHTML = capabilityFixture({ user: 'logged-in' });
    document
      .querySelector('.post-controls')
      ?.insertAdjacentHTML(
        'beforeend',
        '<button class="post-action-menu__reply">Reply to post</button>',
      );
    const route = recognizeLinuxDoRoute(window.location.href);

    const available = detectLinuxDoPostReplyCapability(document, route, 1);

    expect(available).toMatchObject({ code: null, state: 'available' });
    expect(available.control).toBe(document.querySelector('.post-action-menu__reply'));
    expect(detectLinuxDoPostReplyCapability(document, route, 2)).toMatchObject({
      code: 'native-control-not-found',
      state: 'unavailable',
    });
  });

  it('reads confirmed Like and Bookmark state from current native controls', () => {
    document.body.innerHTML = capabilityFixture({ user: 'logged-in' });
    const like = document.querySelector('.btn-toggle-reaction-like');
    if (!like) throw new Error('Missing Like fixture');
    const reactionRoot = document.createElement('div');
    reactionRoot.className =
      'discourse-reactions-actions can-toggle-reaction has-used-main-reaction';
    like.replaceWith(reactionRoot);
    reactionRoot.append(like);
    reactionRoot.insertAdjacentHTML(
      'afterend',
      '<button class="post-action-menu__bookmark bookmark bookmarked">Bookmark</button>',
    );

    const result = detectLinuxDoCapabilities(document, recognizeLinuxDoRoute(window.location.href));

    expect(result.state === 'ready' ? result.posts[0] : null).toMatchObject({
      bookmark: { active: true, state: 'available' },
      like: { active: true, state: 'available' },
    });

    reactionRoot.classList.remove('can-toggle-reaction');
    const disabled = detectLinuxDoCapabilities(
      document,
      recognizeLinuxDoRoute(window.location.href),
    );
    expect(disabled.state === 'ready' ? disabled.posts[0]?.like : null).toMatchObject({
      active: true,
      code: 'native-control-disabled',
      state: 'disabled',
    });
  });

  it('excludes DOCode-owned reply framing from native post capability detection', () => {
    document.body.innerHTML = `${capabilityFixture({ user: 'logged-in' })}
      <div data-docode-workbench-root="owner"><div data-post-number="1">
        <article data-post-id="100"><button class="post-action-menu__copy-link">Copy</button></article>
      </div></div>`;

    const result = detectLinuxDoCapabilities(document, recognizeLinuxDoRoute(window.location.href));

    expect(result.state === 'ready' ? result.posts : []).toHaveLength(1);
    expect(result.state === 'ready' ? result.posts[0]?.copyLink.control : null).toBe(
      document.querySelector('.post-stream .post-action-menu__copy-link'),
    );
  });

  it('detects an open native composer without simulating submission', () => {
    document.body.innerHTML = capabilityFixture({ composerOpen: true, user: 'logged-in' });

    const result = detectLinuxDoCapabilities(document, recognizeLinuxDoRoute(window.location.href));

    expect(result).toMatchObject({
      composer: { code: null, fallback: null, state: 'open' },
      state: 'ready',
    });
    if (result.state !== 'ready') throw new Error('Expected ready capabilities.');
    expect(result.composer.root).toBe(document.querySelector('#reply-control'));
  });

  it('reads native draft, target, fullscreen, controls, and visible error evidence', () => {
    document.body.innerHTML = capabilityFixture({ composerOpen: true, user: 'logged-in' });
    const root = document.querySelector<HTMLElement>('#reply-control');
    const editor = document.querySelector<HTMLTextAreaElement>('.d-editor-input');
    if (!root || !editor) throw new Error('Missing composer fixture');
    root.classList.add('fullscreen');
    editor.value = 'Native draft';
    root.insertAdjacentHTML(
      'afterbegin',
      '<a class="composer-actions-reply-target-link" href="/t/other-topic/99">Other</a><div class="popup-tip bad">Native validation error</div>',
    );
    root.insertAdjacentHTML(
      'beforeend',
      '<button class="btn-primary create">Reply</button><button class="discard-button">Discard</button>',
    );

    const result = detectLinuxDoCapabilities(document, recognizeLinuxDoRoute(window.location.href));

    expect(result.state === 'ready' ? result.composer : null).toMatchObject({
      dirty: true,
      errorMessage: 'Native validation error',
      fullscreen: true,
      state: 'open',
      topicId: 99,
    });
    if (result.state !== 'ready') throw new Error('Expected ready capabilities.');
    expect(result.composer.editor).toBe(editor);
    expect(result.composer.submitControl).toBe(root.querySelector('button.create'));
    expect(result.composer.cancelControl).toBe(root.querySelector('.discard-button'));

    root.className = 'draft hide-preview';
    editor.value = '';
    expect(
      detectLinuxDoCapabilities(document, recognizeLinuxDoRoute(window.location.href)),
    ).toMatchObject({ composer: { dirty: true, state: 'draft' } });
  });

  it('bounds unknown-user, disabled-control, malformed-post, and unsupported-route failures', () => {
    document.body.innerHTML = capabilityFixture({ disabledCopyLink: true, user: 'unknown' });
    document
      .querySelector('.post-stream')
      ?.insertAdjacentHTML(
        'beforeend',
        '<div data-post-number="2"><article data-post-id="invalid"></article></div>',
      );

    const result = detectLinuxDoCapabilities(document, recognizeLinuxDoRoute(window.location.href));

    expect(result).toMatchObject({
      currentUser: { state: 'unknown' },
      posts: [
        {
          copyLink: { code: 'native-control-disabled', state: 'disabled' },
          like: { code: 'current-user-unresolved', state: 'unavailable' },
          postId: 100,
          postNumber: 1,
        },
      ],
      state: 'ready',
    });
    if (result.state !== 'ready') throw new Error('Expected ready capabilities.');
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        { code: 'current-user-unresolved', feature: 'current-user', postNumber: null },
        { code: 'post-identity-missing', feature: 'like', postNumber: null },
        { code: 'current-user-unresolved', feature: 'reply', postNumber: null },
        { code: 'current-user-unresolved', feature: 'composer', postNumber: null },
      ]),
    );
    expect(JSON.stringify(result)).not.toContain('Synthetic private content');

    expect(
      detectLinuxDoCapabilities(document, recognizeLinuxDoRoute('https://linux.do/latest')),
    ).toEqual({
      code: 'unsupported-route',
      diagnostics: [{ code: 'unsupported-route', feature: 'current-user', postNumber: null }],
      state: 'unsupported',
    });
  });
});

describe('LinuxDoCapabilityObserver', () => {
  it('coalesces only relevant mutations across narrow roots and disconnects cleanly', async () => {
    document.body.innerHTML = capabilityFixture({ user: 'logged-in' });
    const onChange = vi.fn();
    const observer = new LinuxDoCapabilityObserver(document, onChange);

    expect(observer.start()).toBe(true);
    expect(observer.start()).toBe(false);
    document.querySelector('.cooked')?.append(document.createTextNode('irrelevant mutation'));
    await nextMutationTurn();
    expect(onChange).not.toHaveBeenCalled();

    const like = document.querySelector('.btn-toggle-reaction-like');
    like?.classList.add('disabled');
    like?.setAttribute('aria-disabled', 'true');
    await nextMutationTurn();
    expect(onChange).toHaveBeenCalledOnce();

    expect(observer.stop()).toBe(true);
    expect(observer.stop()).toBe(false);
    like?.classList.remove('disabled');
    await nextMutationTurn();
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('does not install a broad fallback observer when verified roots are absent', () => {
    document.body.innerHTML = '<div>Unrelated page</div>';
    const observer = new LinuxDoCapabilityObserver(document, vi.fn());

    expect(observer.start()).toBe(false);
    expect(observer.isStarted).toBe(false);
  });

  it('ignores directly rendered DOCode-owned paginated post capabilities', async () => {
    document.body.innerHTML = capabilityFixture({ user: 'logged-in' });
    const onChange = vi.fn();
    const observer = new LinuxDoCapabilityObserver(document, onChange);
    expect(observer.start()).toBe(true);

    const wrapper = document.createElement('div');
    wrapper.setAttribute(DOCODE_PAGINATED_POST_ATTRIBUTE, '');
    wrapper.innerHTML = `<article data-post-id="202"><button class="post-action-menu__copy-link">Copy</button></article>`;
    document.querySelector('#main-outlet')?.append(wrapper);
    await nextMutationTurn();

    expect(onChange).not.toHaveBeenCalled();
    observer.stop();
  });
});

function capabilityFixture(options: {
  readonly composerOpen?: boolean;
  readonly disabledCopyLink?: boolean;
  readonly user: 'logged-in' | 'logged-out' | 'unknown';
}): string {
  const userControl =
    options.user === 'logged-in'
      ? '<div class="d-header"><div id="current-user" data-username="fixture-user"></div></div>'
      : options.user === 'logged-out'
        ? '<div class="d-header"><button class="login-button">Log in</button></div>'
        : '<div class="d-header"></div>';
  const composerClass = options.composerOpen ? 'open' : 'closed hide-preview';
  const composerEditor = options.composerOpen
    ? '<textarea class="d-editor-input" aria-label="Reply"></textarea>'
    : '';
  const copyLinkDisabled = options.disabledCopyLink ? ' disabled aria-disabled="true"' : '';
  return `${userControl}
    <div id="main-outlet">
      <div id="topic" class="topic-area">
        <div class="post-stream">
          <div data-post-number="1">
            <article data-post-id="100">
              <div class="cooked">Synthetic private content</div>
              <nav class="post-controls">
                <button class="btn-toggle-reaction-like">Like</button>
                <button class="post-action-menu__copy-link"${copyLinkDisabled}>Copy link</button>
              </nav>
            </article>
          </div>
        </div>
        <div id="topic-footer-buttons"><div class="topic-footer-main-buttons"><button class="btn-primary create">Reply</button></div></div>
      </div>
    </div>
    <div id="reply-control" class="${composerClass}">${composerEditor}</div>`;
}

async function nextMutationTurn(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => window.setTimeout(resolve, 0));
}
