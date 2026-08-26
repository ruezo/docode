import { describe, expect, it } from 'vitest';

import { recognizeLinuxDoRoute } from '../../src/linuxdo/routes';
import { createWorkbenchViewContext } from '../../src/ui/workbench/workbenchContext';
import { createWorkbenchStatusModel } from '../../src/ui/workbench/workbenchStatus';
import type { WorkbenchSurfaceState } from '../../src/ui/workbench/workbenchSurfaceState';
import type { TopicActionCapabilityModel } from '../../src/views/topic/topicDetailDocument';

const readyState: WorkbenchSurfaceState = {
  code: null,
  description: '',
  icon: null,
  kind: 'ready',
  retryLabel: null,
  title: '',
};

const availableAction = {
  active: false,
  code: null,
  fallback: null,
  state: 'available',
} as const;

const authenticationAction = {
  active: null,
  code: 'authentication-required',
  fallback: 'native-login',
  state: 'authentication-required',
} as const;

describe('createWorkbenchStatusModel', () => {
  it.each([
    ['loading', 'Loading', 'standard'],
    ['empty', 'No topics', 'standard'],
    ['error', 'Read error', 'error'],
    ['unsupported', 'Unsupported', 'warning'],
  ] as const)(
    'exposes the real %s surface state without fabricated values',
    (kind, label, tone) => {
      const model = createWorkbenchStatusModel({
        ...baseInput('https://linux.do/latest'),
        surfaceState: surface(kind),
      });

      expect(model.state).toBe(kind);
      expect(model.activity).toMatchObject({ label, tone });
      expect(model.category).toBeNull();
      expect(model.floor).toBeNull();
      expect(model.mode).toBeNull();
    },
  );

  it('exposes exact topic category, current floor, loaded window, mode, and sign-in state', () => {
    const model = createWorkbenchStatusModel({
      ...baseInput('https://linux.do/t/synthetic-topic/42/2'),
      activeMode: 'code',
      availableModes: ['code', 'doc'],
      editor: { cursor: { column: 1, lineNumber: 111 }, loadedReplyCount: 132 },
      topic: topic('logged-out'),
    });

    expect(model.route).toMatchObject({
      href: 'https://linux.do/t/synthetic-topic/42/2',
      label: 'Topic 42 · Post 2',
    });
    expect(model.category).toMatchObject({
      href: 'https://linux.do/c/develop/4',
      label: 'Develop',
    });
    expect(model.floor).toMatchObject({
      href: 'https://linux.do/t/synthetic-topic/42/2',
      label: 'Post 2',
      title: 'Current visible post: 2. Loaded Linux DO window: posts 1–4.',
    });
    expect(model.mode).toMatchObject({ active: 'code', label: 'Code', next: 'doc' });
    expect(model.cursor).toEqual({
      label: 'Ln 111, Col 1',
      title: 'Virtual topic document position: line 111, column 1.',
    });
    expect(model.replies?.label).toBe('Replies 132');
    expect(model.encoding?.label).toBe('UTF-8');
    expect(model.activity).toMatchObject({
      label: 'Sign in for actions',
      tone: 'warning',
    });
    expect(model.activity?.title).toContain('Like: sign-in required');
  });

  it('cycles only implemented workbench modes and reports exact ready or limited actions', () => {
    const doc = createWorkbenchStatusModel({
      ...baseInput('https://linux.do/t/synthetic-topic/42'),
      activeMode: 'doc',
      availableModes: ['code', 'doc'],
      topic: topic('logged-in'),
    });
    expect(doc.mode).toMatchObject({ active: 'doc', next: 'code' });
    expect(doc.activity).toMatchObject({ label: 'Actions ready', tone: 'standard' });

    const limited = createWorkbenchStatusModel({
      ...baseInput('https://linux.do/t/synthetic-topic/42'),
      activeMode: 'code',
      availableModes: ['code', 'doc'],
      topic: topic('logged-in', { bookmark: { ...availableAction, state: 'disabled' } }),
    });
    expect(limited.mode).toMatchObject({ active: 'code', next: 'doc' });
    expect(limited.activity).toMatchObject({ label: 'Actions limited', tone: 'warning' });
    expect(limited.activity?.title).toContain('Bookmark: disabled by Linux DO');
  });

  it('prioritizes real Composer feedback and native draft state over capability readiness', () => {
    const opening = createWorkbenchStatusModel({
      ...baseInput('https://linux.do/t/synthetic-topic/42'),
      composerFeedback: { kind: 'opening', message: 'Opening the Linux DO composer…' },
      topic: topic('logged-in'),
    });
    expect(opening.activity).toMatchObject({ label: 'Opening Reply', spin: true });

    const draftTopic = topic('logged-in');
    const draft = createWorkbenchStatusModel({
      ...baseInput('https://linux.do/t/synthetic-topic/42'),
      topic: {
        ...draftTopic,
        interaction: {
          ...draftTopic.interaction,
          composer: { ...draftTopic.interaction.composer, dirty: true, state: 'draft' },
        },
      },
    });
    expect(draft.activity).toMatchObject({ label: 'Reply draft', spin: false });
  });

  it('reports topic pagination progress, failure, and a confirmed end', () => {
    const loading = createWorkbenchStatusModel({
      ...baseInput('https://linux.do/t/synthetic-topic/42'),
      editor: { cursor: null, loadedReplyCount: 20 },
      topic: topic('logged-in'),
      topicPagination: { status: 'loading' },
    });
    expect(loading.activity).toMatchObject({ label: 'Loading replies', spin: true });

    const failed = createWorkbenchStatusModel({
      ...baseInput('https://linux.do/t/synthetic-topic/42'),
      editor: { cursor: null, loadedReplyCount: 20 },
      topic: topic('logged-in'),
      topicPagination: { status: 'error' },
    });
    expect(failed.activity).toMatchObject({
      label: 'More replies unavailable',
      tone: 'warning',
    });

    const complete = createWorkbenchStatusModel({
      ...baseInput('https://linux.do/t/synthetic-topic/42'),
      editor: { cursor: null, loadedReplyCount: 24 },
      topic: topic('logged-in'),
      topicPagination: { status: 'complete' },
    });
    expect(complete.replies).toMatchObject({ label: 'Replies 24 · End' });
    expect(complete.replies?.title).toContain('end of this topic');
  });

  it('surfaces the trust level badge only when a numeric level is known', () => {
    const withTrust = createWorkbenchStatusModel({
      ...baseInput('https://linux.do/latest'),
      trustLevel: 2,
    });
    expect(withTrust.trust).toMatchObject({ label: 'TL2' });
    expect(withTrust.trust?.title).toContain('build progress');

    const withoutTrust = createWorkbenchStatusModel({
      ...baseInput('https://linux.do/latest'),
      trustLevel: null,
    });
    expect(withoutTrust.trust).toBeNull();
    expect(createWorkbenchStatusModel(baseInput('https://linux.do/latest')).trust).toBeNull();
  });
});

function baseInput(href: string) {
  return {
    activeMode: null,
    availableModes: [],
    composerFeedback: null,
    context: createWorkbenchViewContext(recognizeLinuxDoRoute(href), 3),
    modeError: null,
    modePending: null,
    surfaceState: readyState,
    topic: null,
  } as const;
}

function surface(kind: Exclude<WorkbenchSurfaceState['kind'], 'ready'>): WorkbenchSurfaceState {
  return {
    code: `${kind}-code`,
    description: `${kind} description`,
    icon: kind === 'error' ? 'error' : kind === 'unsupported' ? 'warning' : 'info',
    kind,
    retryLabel: kind === 'empty' ? 'Refresh' : kind === 'error' ? 'Retry' : null,
    title: `${kind} title`,
  };
}

function topic(
  currentUserState: 'logged-in' | 'logged-out',
  overrides: { readonly bookmark?: TopicActionCapabilityModel } = {},
) {
  const postAction: TopicActionCapabilityModel =
    currentUserState === 'logged-in' ? availableAction : authenticationAction;
  return {
    category: {
      name: 'Develop',
      url: 'https://linux.do/c/develop/4',
    },
    currentPost: {
      bookmark: overrides.bookmark ?? postAction,
      like: postAction,
      number: 2,
      permalink: 'https://linux.do/t/synthetic-topic/42/2',
    },
    interaction: {
      composer: {
        code: currentUserState === 'logged-in' ? null : 'authentication-required',
        dirty: false,
        fallback: currentUserState === 'logged-in' ? null : 'native-login',
        fullscreen: false,
        state: currentUserState === 'logged-in' ? 'closed' : 'authentication-required',
        topicId: 42,
      },
      currentUserState,
      diagnosticCodes:
        currentUserState === 'logged-in' ? [] : (['authentication-required'] as const),
      reply: postAction,
      state: 'ready',
    },
    loadedWindow: {
      containsRequestedPost: true,
      firstPostNumber: 1,
      hasMorePosts: true,
      lastPostNumber: 4,
      loadedPostCount: 4,
      requestedPostNumber: 2,
    },
  } as const;
}
