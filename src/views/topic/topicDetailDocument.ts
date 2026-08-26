import type {
  CapabilityDiagnosticCode,
  CapabilityFallback,
  ComposerState,
  LinuxDoCapabilityDetection,
  NativeActionState,
  PostCapabilities,
} from '../../linuxdo/capabilities';
import type { LinuxDoRoute } from '../../linuxdo/routes';
import type {
  NativePostContent,
  TopicCategory,
  TopicExtraction,
  TopicIssueCode,
  TopicPostAuthor,
  TopicPostBoost,
  TopicPostReadState,
  TopicTag,
} from '../../linuxdo/topicAdapter';

export type TopicDetailRoute = Extract<LinuxDoRoute, { readonly kind: 'topic' }>;
export type TopicDetailDocumentState = TopicExtraction['state'];
export type TopicDetailCapabilityCode = CapabilityDiagnosticCode | 'post-capability-not-found';

export interface TopicDetailHeader {
  readonly category: TopicCategory | null;
  readonly closed: boolean;
  readonly id: number;
  readonly pinned: boolean;
  readonly tags: readonly TopicTag[];
  readonly title: string;
  readonly url: string;
}

export interface TopicActionCapabilityModel {
  readonly active: boolean | null;
  readonly code: TopicDetailCapabilityCode | null;
  readonly fallback: CapabilityFallback;
  readonly state: NativeActionState;
}

export interface TopicComposerCapabilityModel {
  readonly code: CapabilityDiagnosticCode | null;
  readonly dirty: boolean;
  readonly fallback: CapabilityFallback;
  readonly fullscreen: boolean;
  readonly state: ComposerState;
  readonly topicId: number | null;
}

export interface TopicInteractionCapabilityModel {
  readonly composer: TopicComposerCapabilityModel;
  readonly currentUserState: 'logged-in' | 'logged-out' | 'unknown';
  readonly diagnosticCodes: readonly CapabilityDiagnosticCode[];
  readonly reply: TopicActionCapabilityModel;
  readonly state: LinuxDoCapabilityDetection['state'];
}

export interface TopicReplyCapabilityModel {
  readonly bookmark: TopicActionCapabilityModel;
  readonly copyLink: TopicActionCapabilityModel;
  readonly like: TopicActionCapabilityModel;
}

export interface TopicReplyFloor {
  readonly loadedOrder: number;
  readonly number: number;
  readonly requested: boolean;
}

export interface TopicReplyDocumentBlock {
  readonly author: TopicPostAuthor | null;
  readonly boosts: readonly TopicPostBoost[];
  readonly capabilities: TopicReplyCapabilityModel;
  readonly completeness: 'complete' | 'partial';
  readonly content: NativePostContent | null;
  readonly floor: TopicReplyFloor;
  readonly id: number;
  readonly permalink: string;
  readonly publishedAt: string | null;
  readonly publishedLabel: string | null;
  readonly reactionCount: number;
  readonly readState: TopicPostReadState;
  readonly replyToPostNumber: number | null;
  readonly topicId: number;
}

export interface TopicLoadedWindow {
  readonly containsRequestedPost: boolean;
  readonly firstPostNumber: number | null;
  readonly hasMorePosts: boolean;
  readonly lastPostNumber: number | null;
  readonly loadedPostCount: number;
  readonly requestedPostNumber: number | null;
}

export interface TopicDetailDiagnostics {
  readonly capabilityCodes: readonly CapabilityDiagnosticCode[];
  readonly errorCode: Extract<TopicExtraction, { readonly state: 'error' }>['code'] | null;
  readonly issueCodes: readonly TopicIssueCode[];
  readonly missingPostCapabilityCount: number;
}

interface TopicDetailDocumentBase {
  readonly capabilities: TopicInteractionCapabilityModel;
  readonly diagnostics: TopicDetailDiagnostics;
  readonly route: TopicDetailRoute;
}

export type TopicDetailDocument =
  | (TopicDetailDocumentBase & {
      readonly loadedWindow: null;
      readonly replies: readonly [];
      readonly state: 'loading';
      readonly topic: null;
    })
  | (TopicDetailDocumentBase & {
      readonly loadedWindow: null;
      readonly replies: readonly [];
      readonly state: 'error';
      readonly topic: TopicDetailHeader | null;
    })
  | (TopicDetailDocumentBase & {
      readonly loadedWindow: TopicLoadedWindow;
      readonly replies: readonly TopicReplyDocumentBlock[];
      readonly state: 'ready';
      readonly topic: TopicDetailHeader;
    });

export function createTopicDetailDocument(
  route: TopicDetailRoute,
  extraction: TopicExtraction,
  detection: LinuxDoCapabilityDetection,
  likeStateOverrides?: ReadonlyMap<number, boolean>,
): TopicDetailDocument {
  const capabilities = createInteractionCapabilities(detection);
  const capabilityPosts =
    detection.state === 'ready'
      ? new Map(detection.posts.map((post) => [postCapabilityIdentity(post), post]))
      : new Map<string, PostCapabilities>();
  const missingPostCapabilityCount =
    extraction.state === 'ready'
      ? extraction.posts.filter((post) => !capabilityPosts.has(postIdentity(post.id, post.number)))
          .length
      : 0;
  const diagnostics: TopicDetailDiagnostics = {
    capabilityCodes: capabilities.diagnosticCodes,
    errorCode: extraction.state === 'error' ? extraction.code : null,
    issueCodes: [...new Set(extraction.issues.map(({ code }) => code))],
    missingPostCapabilityCount,
  };
  const base = { capabilities, diagnostics, route };

  if (extraction.state === 'loading') {
    return { ...base, loadedWindow: null, replies: [], state: 'loading', topic: null };
  }
  if (extraction.state === 'error') {
    return {
      ...base,
      loadedWindow: null,
      replies: [],
      state: 'error',
      topic: extraction.topic ? createHeader(extraction.topic) : null,
    };
  }

  const replies = extraction.posts.map((post) => {
    const postCapabilities = capabilityPosts.get(postIdentity(post.id, post.number));
    return {
      author: post.author,
      capabilities: applyLikeStateOverride(
        postCapabilities
          ? createReplyCapabilities(postCapabilities, detection)
          : unavailableReplyCapabilities(detection),
        likeStateOverrides?.get(post.id),
      ),
      boosts: post.boosts,
      completeness: post.completeness,
      content: post.content,
      floor: {
        loadedOrder: post.loadedOrder,
        number: post.number,
        requested: post.number === extraction.requestedPostNumber,
      },
      id: post.id,
      permalink: post.permalink,
      publishedAt: post.publishedAt,
      publishedLabel: post.publishedLabel,
      reactionCount: post.reactionCount,
      readState: post.readState,
      replyToPostNumber: post.replyToPostNumber,
      topicId: extraction.topic.id,
    };
  });

  return {
    ...base,
    loadedWindow: {
      containsRequestedPost: extraction.containsRequestedPost,
      firstPostNumber: extraction.posts[0]?.number ?? null,
      hasMorePosts: extraction.hasMorePosts,
      lastPostNumber: extraction.posts.at(-1)?.number ?? null,
      loadedPostCount: extraction.posts.length,
      requestedPostNumber: extraction.requestedPostNumber,
    },
    replies,
    state: 'ready',
    topic: createHeader(extraction.topic),
  };
}

function createHeader(topic: TopicDetailHeader): TopicDetailHeader {
  return {
    category: topic.category,
    closed: topic.closed,
    id: topic.id,
    pinned: topic.pinned,
    tags: topic.tags,
    title: topic.title,
    url: topic.url,
  };
}

function createInteractionCapabilities(
  detection: LinuxDoCapabilityDetection,
): TopicInteractionCapabilityModel {
  if (detection.state === 'unsupported') {
    return {
      composer: {
        code: 'unsupported-route',
        dirty: false,
        fallback: 'original-view',
        fullscreen: false,
        state: 'unavailable',
        topicId: null,
      },
      currentUserState: 'unknown',
      diagnosticCodes: ['unsupported-route'],
      reply: unavailableAction('unsupported-route'),
      state: 'unsupported',
    };
  }

  return {
    composer: {
      code: detection.composer.code,
      dirty: detection.composer.dirty,
      fallback: detection.composer.fallback,
      fullscreen: detection.composer.fullscreen,
      state: detection.composer.state,
      topicId: detection.composer.topicId,
    },
    currentUserState: detection.currentUser.state,
    diagnosticCodes: [...new Set(detection.diagnostics.map(({ code }) => code))],
    reply: createActionCapability(detection.reply),
    state: 'ready',
  };
}

function createReplyCapabilities(
  post: PostCapabilities,
  detection: LinuxDoCapabilityDetection,
): TopicReplyCapabilityModel {
  return {
    bookmark: createActionCapability(post.bookmark),
    copyLink: createActionCapability(post.copyLink),
    like: withLikeApiFallback(createActionCapability(post.like), detection),
  };
}

function createActionCapability(
  capability: Pick<TopicActionCapabilityModel, 'active' | 'code' | 'fallback' | 'state'>,
): TopicActionCapabilityModel {
  return {
    active: capability.active,
    code: capability.code,
    fallback: capability.fallback,
    state: capability.state,
  };
}

function unavailableReplyCapabilities(
  detection: LinuxDoCapabilityDetection,
): TopicReplyCapabilityModel {
  const code: TopicDetailCapabilityCode =
    detection.state === 'unsupported' ? 'unsupported-route' : 'post-capability-not-found';
  return {
    bookmark: unavailableAction(code),
    copyLink: unavailableAction(code),
    like: withLikeApiFallback(unavailableAction(code), detection),
  };
}

function applyLikeStateOverride(
  capabilities: TopicReplyCapabilityModel,
  active: boolean | undefined,
): TopicReplyCapabilityModel {
  if (active === undefined) return capabilities;
  const like = capabilities.like;
  if (like.state === 'authentication-required' || like.state === 'disabled') return capabilities;
  return {
    bookmark: capabilities.bookmark,
    copyLink: capabilities.copyLink,
    like: { active, code: like.code, fallback: like.fallback, state: 'available' },
  };
}

function withLikeApiFallback(
  capability: TopicActionCapabilityModel,
  detection: LinuxDoCapabilityDetection,
): TopicActionCapabilityModel {
  if (capability.state !== 'unavailable') return capability;
  if (detection.state !== 'ready' || detection.currentUser.state === 'logged-out') {
    return capability;
  }
  if (
    capability.code !== 'post-capability-not-found' &&
    capability.code !== 'native-control-not-found' &&
    capability.code !== 'current-user-unresolved'
  ) {
    return capability;
  }
  return { active: capability.active, code: capability.code, fallback: null, state: 'available' };
}

function unavailableAction(code: TopicDetailCapabilityCode): TopicActionCapabilityModel {
  return { active: null, code, fallback: 'original-view', state: 'unavailable' };
}

function postCapabilityIdentity(post: PostCapabilities): string {
  return postIdentity(post.postId, post.postNumber);
}

function postIdentity(id: number, number: number): string {
  return `${String(id)}:${String(number)}`;
}
