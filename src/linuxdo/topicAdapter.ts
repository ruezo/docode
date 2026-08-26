import { isLinuxDoLocation } from './host';
import { recognizeLinuxDoRoute, type LinuxDoRoute } from './routes';

export const TOPIC_LOADING_SELECTOR =
  'main[aria-busy="true"], .topic-loading-container, .topic-post-loading, .post-stream [role="progressbar"], .post-stream .spinner';

const TOPIC_SELECTORS = {
  author: '.names a[data-user-card][href], a[data-user-card][href]:not([aria-hidden="true"])',
  category: 'a[href^="/c/"]',
  closed: '.topic-status .d-icon-lock, .topic-status .d-icon-lock.svg-icon',
  content: '.cooked',
  loading: TOPIC_LOADING_SELECTOR,
  permalink: 'a.post-date[href]',
  pinned:
    '.topic-status .d-icon-thumbtack, .topic-status .d-icon-thumbtack.svg-icon, .topic-status .d-icon-thumbtack-unpin',
  posts: '.post-stream article[data-post-id], article[data-post-id]',
  postStream: '.post-stream',
  readState: '.topic-meta-data .post-infos .read-state',
  tags: 'a[href^="/tag/"]',
  timestamp: 'a.post-date [data-time], [data-time].relative-date',
  title: 'main h1[data-topic-id], h1[data-topic-id]',
  titleLink: 'a.fancy-title[href], a[href]',
} as const;

const IGNORED_CONTENT_CLASSES = [
  'cooked-selection-barrier',
  'docode-topic-code__image-trigger',
  'docode-topic-code__scaffold-line',
] as const;
export const DOCODE_PAGINATED_POST_ATTRIBUTE = 'data-docode-paginated-post';
export const DOCODE_PAGINATED_CONTENT_ATTRIBUTE = 'data-docode-paginated-content';
export const DOCODE_REPLY_TO_POST_ATTRIBUTE = 'data-docode-reply-to-post-number';
export const DOCODE_TOPIC_SNAPSHOT_ATTRIBUTE = 'data-docode-topic-json-source';

const topicSnapshotNativeOwners = new WeakMap<HTMLElement, HTMLElement>();

const nativeContentCache = new WeakMap<
  HTMLElement,
  {
    readonly children: readonly HTMLElement[];
    readonly content: NativePostContent;
    readonly source: NativePostContent['source'];
  }
>();

export interface TopicCategory {
  readonly id: number;
  readonly name: string;
  readonly slug: string | null;
  readonly url: string;
}

export interface TopicTag {
  readonly id: number | null;
  readonly name: string;
  readonly slug: string;
  readonly url: string;
}

export interface TopicMetadata {
  readonly category: TopicCategory | null;
  readonly closed: boolean;
  readonly id: number;
  readonly pinned: boolean;
  readonly tags: readonly TopicTag[];
  readonly title: string;
  readonly url: string;
}

export type NativePostContentBlockKind =
  | 'code'
  | 'details'
  | 'heading'
  | 'horizontal-rule'
  | 'list'
  | 'media'
  | 'paragraph'
  | 'quote'
  | 'table'
  | 'other';

export interface NativePostContentBlock {
  readonly element: HTMLElement;
  readonly kind: NativePostContentBlockKind;
}

/** A read-only view of Linux DO-owned, already-rendered content. */
export interface NativePostContent {
  readonly blocks: readonly NativePostContentBlock[];
  readonly root: HTMLElement;
  readonly source: 'linuxdo-owned-dom' | 'linuxdo-same-origin-json';
}

export interface TopicPostAuthor {
  readonly avatarUrl: string | null;
  readonly displayName: string;
  readonly url: string;
  readonly username: string;
}

export type TopicPostReadState = 'unread' | 'unknown';

export interface TopicPostBoost {
  readonly avatarUrl: string | null;
  readonly text: string;
  readonly username: string | null;
}

export interface TopicPost {
  readonly author: TopicPostAuthor | null;
  readonly boosts: readonly TopicPostBoost[];
  readonly completeness: 'complete' | 'partial';
  readonly content: NativePostContent | null;
  readonly id: number;
  readonly loadedOrder: number;
  readonly number: number;
  readonly permalink: string;
  readonly publishedAt: string | null;
  readonly publishedLabel: string | null;
  readonly reactionCount: number;
  readonly readState: TopicPostReadState;
  readonly replyToPostNumber: number | null;
}

export type TopicIssueCode =
  | 'duplicate-post'
  | 'missing-post-author'
  | 'missing-post-content'
  | 'missing-post-identity'
  | 'missing-post-permalink';

export interface TopicIssue {
  readonly code: TopicIssueCode;
  readonly postIndex: number;
}

export type TopicExtraction =
  | {
      readonly issues: readonly [];
      readonly posts: readonly [];
      readonly state: 'loading';
      readonly topic: null;
    }
  | {
      readonly code:
        | 'post-stream-not-found'
        | 'post-stream-unreadable'
        | 'topic-metadata-not-found'
        | 'unsupported-route';
      readonly issues: readonly TopicIssue[];
      readonly posts: readonly [];
      readonly state: 'error';
      readonly topic: TopicMetadata | null;
    }
  | {
      readonly containsRequestedPost: boolean;
      readonly hasMorePosts: boolean;
      readonly issues: readonly TopicIssue[];
      readonly posts: readonly TopicPost[];
      readonly requestedPostNumber: number | null;
      readonly state: 'ready';
      readonly topic: TopicMetadata;
    };

export interface TopicStatusSummary {
  readonly containsRequestedPost: boolean;
  readonly errorCode: Extract<TopicExtraction, { state: 'error' }>['code'] | null;
  readonly firstPostNumber: number | null;
  readonly hasMorePosts: boolean;
  readonly issueCodes: readonly TopicIssueCode[];
  readonly lastPostNumber: number | null;
  readonly partialPostCount: number;
  readonly postCount: number;
  readonly requestedPostNumber: number | null;
  readonly state: TopicExtraction['state'];
}

export type NativePostContentResolver = (sourceOwner: HTMLElement) => HTMLElement | null;

export interface TopicExtractionOptions {
  readonly resolveNativeContent?: NativePostContentResolver | undefined;
}

export function associateTopicSnapshotPost(
  snapshotArticle: HTMLElement,
  nativeArticle: HTMLElement,
): void {
  topicSnapshotNativeOwners.set(snapshotArticle, nativeArticle);
}

export function extractTopic(
  document: Document,
  route: LinuxDoRoute,
  options: TopicExtractionOptions = {},
): TopicExtraction {
  if (route.kind !== 'topic') {
    return {
      code: 'unsupported-route',
      issues: [],
      posts: [],
      state: 'error',
      topic: null,
    };
  }

  const topicRoot = findTopicSnapshotSource(document, route) ?? document;
  const topicMatch = Array.from(
    topicRoot.querySelectorAll<HTMLElement>(TOPIC_SELECTORS.title),
  ).flatMap((titleElement) => {
    const topic = extractTopicMetadata(document, titleElement, route);
    return topic ? [{ titleElement, topic }] : [];
  })[0];
  if (!topicMatch) {
    return findLiveTopicLoadingIndicator(document)
      ? { issues: [], posts: [], state: 'loading', topic: null }
      : {
          code: 'topic-metadata-not-found',
          issues: [],
          posts: [],
          state: 'error',
          topic: null,
        };
  }

  const { topic } = topicMatch;
  const postStream = findTopicPostStream(document, route);
  if (!postStream) {
    return findLiveTopicLoadingIndicator(document)
      ? { issues: [], posts: [], state: 'loading', topic: null }
      : {
          code: 'post-stream-not-found',
          issues: [],
          posts: [],
          state: 'error',
          topic,
        };
  }

  const issues: TopicIssue[] = [];
  const posts: TopicPost[] = [];
  const postIdentities = new Set<string>();
  const articles = Array.from(postStream.querySelectorAll<HTMLElement>(TOPIC_SELECTORS.posts));
  articles.forEach((article, postIndex) => {
    const post = extractPost(
      document,
      article,
      route.topicId,
      postIndex,
      issues,
      options.resolveNativeContent,
    );
    if (!post) return;
    const identity = [post.id, post.number].join(':');
    if (postIdentities.has(identity)) {
      issues.push({ code: 'duplicate-post', postIndex });
      return;
    }
    postIdentities.add(identity);
    posts.push(post);
  });

  if (posts.length === 0) {
    return findLiveTopicLoadingIndicator(document)
      ? { issues: [], posts: [], state: 'loading', topic: null }
      : {
          code: 'post-stream-unreadable',
          issues,
          posts: [],
          state: 'error',
          topic,
        };
  }

  return {
    containsRequestedPost:
      route.postNumber === null || posts.some(({ number }) => number === route.postNumber),
    hasMorePosts: findLiveTopicLoadingIndicator(document) !== null,
    issues,
    posts,
    requestedPostNumber: route.postNumber,
    state: 'ready',
    topic,
  };
}

function findLiveTopicLoadingIndicator(document: Document): Element | null {
  return (
    Array.from(document.querySelectorAll(TOPIC_SELECTORS.loading)).find(
      (element) => element.closest(`[${DOCODE_TOPIC_SNAPSHOT_ATTRIBUTE}]`) === null,
    ) ?? null
  );
}

export function findTopicPostStream(
  document: Document,
  route: Extract<LinuxDoRoute, { readonly kind: 'topic' }>,
): HTMLElement | null {
  const streams = Array.from(document.querySelectorAll<HTMLElement>(TOPIC_SELECTORS.postStream));
  const matching = streams
    .map((stream, documentOrder) => {
      const coverage = measureRouteMatchingPostCoverage(
        document,
        stream,
        route.topicId,
        route.postNumber ?? 1,
      );
      return {
        ...coverage,
        documentOrder,
        snapshot: stream.closest(`[${DOCODE_TOPIC_SNAPSHOT_ATTRIBUTE}]`) !== null,
        stream,
      };
    })
    .filter(({ postCount }) => postCount > 0)
    .sort(
      (left, right) =>
        Number(right.containsAnchor) - Number(left.containsAnchor) ||
        right.contiguousPostCount - left.contiguousPostCount ||
        Number(right.snapshot) - Number(left.snapshot) ||
        right.postCount - left.postCount ||
        left.documentOrder - right.documentOrder,
    )[0];
  return matching?.stream ?? (streams.length === 1 ? (streams[0] ?? null) : null);
}

function measureRouteMatchingPostCoverage(
  document: Document,
  stream: HTMLElement,
  topicId: number,
  anchorPostNumber: number,
): {
  readonly containsAnchor: boolean;
  readonly contiguousPostCount: number;
  readonly postCount: number;
} {
  const identities = new Set<string>();
  const postNumbers = new Set<number>();
  Array.from(stream.querySelectorAll<HTMLElement>(TOPIC_SELECTORS.posts)).forEach((article) => {
    const id = toPositiveInteger(article.getAttribute('data-post-id'));
    const number = toPositiveInteger(
      article.closest<HTMLElement>('[data-post-number]')?.getAttribute('data-post-number') ?? null,
    );
    const matchesTopic = Array.from(
      article.querySelectorAll<HTMLAnchorElement>(TOPIC_SELECTORS.permalink),
    ).some((link) => {
      const url = toSupportedUrl(link.getAttribute('href'), document.location.href);
      const linkRoute = url ? recognizeLinuxDoRoute(url) : null;
      return linkRoute?.kind === 'topic' && linkRoute.topicId === topicId;
    });
    if (id !== null && number !== null && matchesTopic) {
      identities.add(`${String(id)}:${String(number)}`);
      postNumbers.add(number);
    }
  });
  const containsAnchor = postNumbers.has(anchorPostNumber);
  let contiguousPostCount = 0;
  if (containsAnchor) {
    contiguousPostCount = 1;
    for (let number = anchorPostNumber - 1; postNumbers.has(number); number -= 1) {
      contiguousPostCount += 1;
    }
    for (let number = anchorPostNumber + 1; postNumbers.has(number); number += 1) {
      contiguousPostCount += 1;
    }
  } else {
    const sortedNumbers = [...postNumbers].sort((left, right) => left - right);
    let run = 0;
    let previous: number | null = null;
    sortedNumbers.forEach((number) => {
      run = previous !== null && number === previous + 1 ? run + 1 : 1;
      contiguousPostCount = Math.max(contiguousPostCount, run);
      previous = number;
    });
  }
  return { containsAnchor, contiguousPostCount, postCount: identities.size };
}

function findTopicSnapshotSource(
  document: Document,
  route: Extract<LinuxDoRoute, { kind: 'topic' }>,
) {
  return Array.from(
    document.querySelectorAll<HTMLElement>(`[${DOCODE_TOPIC_SNAPSHOT_ATTRIBUTE}]`),
  ).find((source) =>
    Array.from(source.querySelectorAll<HTMLElement>(TOPIC_SELECTORS.title)).some((title) => {
      const id = toPositiveInteger(title.getAttribute('data-topic-id'));
      return id === route.topicId;
    }),
  );
}

export function summarizeTopicExtraction(extraction: TopicExtraction): TopicStatusSummary {
  const posts = extraction.state === 'ready' ? extraction.posts : [];
  return {
    containsRequestedPost: extraction.state === 'ready' && extraction.containsRequestedPost,
    errorCode: extraction.state === 'error' ? extraction.code : null,
    firstPostNumber: posts.at(0)?.number ?? null,
    hasMorePosts: extraction.state === 'ready' && extraction.hasMorePosts,
    issueCodes: [...new Set(extraction.issues.map(({ code }) => code))],
    lastPostNumber: posts.at(-1)?.number ?? null,
    partialPostCount: posts.filter(({ completeness }) => completeness === 'partial').length,
    postCount: posts.length,
    requestedPostNumber: extraction.state === 'ready' ? extraction.requestedPostNumber : null,
    state: extraction.state,
  };
}

function extractTopicMetadata(
  document: Document,
  titleElement: HTMLElement,
  route: Extract<LinuxDoRoute, { kind: 'topic' }>,
): TopicMetadata | null {
  const id = toPositiveInteger(titleElement.getAttribute('data-topic-id'));
  const title = normalizeText(titleElement.textContent);
  const titleLink = Array.from(
    titleElement.querySelectorAll<HTMLAnchorElement>(TOPIC_SELECTORS.titleLink),
  ).find((link) => {
    const url = toSupportedUrl(link.getAttribute('href'), document.location.href);
    const linkRoute = url ? recognizeLinuxDoRoute(url) : null;
    return linkRoute?.kind === 'topic' && linkRoute.topicId === route.topicId;
  });
  const url = toSupportedUrl(titleLink?.getAttribute('href') ?? null, document.location.href);
  if (id !== route.topicId || !title || !url) return null;

  const wrapper = titleElement.parentElement ?? titleElement;
  return {
    category: extractCategory(document, wrapper),
    closed: wrapper.querySelector(TOPIC_SELECTORS.closed) !== null,
    id,
    pinned: wrapper.querySelector(TOPIC_SELECTORS.pinned) !== null,
    tags: extractTags(document, wrapper),
    title,
    url: url.href,
  };
}

function extractPost(
  document: Document,
  article: HTMLElement,
  topicId: number,
  postIndex: number,
  issues: TopicIssue[],
  resolveNativeContent: NativePostContentResolver | undefined,
): TopicPost | null {
  const id = toPositiveInteger(article.getAttribute('data-post-id'));
  const numberContainer = article.closest<HTMLElement>('[data-post-number]');
  const number = toPositiveInteger(numberContainer?.getAttribute('data-post-number') ?? null);
  if (id === null || number === null) {
    issues.push({ code: 'missing-post-identity', postIndex });
    return null;
  }

  const permalinkLink = article.querySelector<HTMLAnchorElement>(TOPIC_SELECTORS.permalink);
  const permalinkUrl = toSupportedUrl(
    permalinkLink?.getAttribute('href') ?? null,
    document.location.href,
  );
  const permalinkRoute = permalinkUrl ? recognizeLinuxDoRoute(permalinkUrl) : null;
  const expectedPermalinkNumber = number === 1 ? null : number;
  if (
    !permalinkUrl ||
    permalinkRoute?.kind !== 'topic' ||
    permalinkRoute.topicId !== topicId ||
    permalinkRoute.postNumber !== expectedPermalinkNumber
  ) {
    issues.push({ code: 'missing-post-permalink', postIndex });
    return null;
  }

  const author = extractAuthor(document, article);
  const nativeOwner = resolveCurrentNativePostOwner(document, article, id);
  const readState = extractPostReadState(nativeOwner);
  const belongsToSnapshot = article.closest(`[${DOCODE_TOPIC_SNAPSHOT_ATTRIBUTE}]`) !== null;
  const associatedNativeOwner = belongsToSnapshot
    ? (topicSnapshotNativeOwners.get(article) ?? null)
    : null;
  const associatedTransferredContentRoot = associatedNativeOwner
    ? resolveNativeContent?.(associatedNativeOwner)
    : null;
  const paginatedContentRoot = article.querySelector<HTMLElement>(
    `${TOPIC_SELECTORS.content}[${DOCODE_PAGINATED_CONTENT_ATTRIBUTE}]`,
  );
  const localContentRoot = article.querySelector<HTMLElement>(TOPIC_SELECTORS.content);
  const transferredLocalContentRoot = belongsToSnapshot ? resolveNativeContent?.(article) : null;
  const snapshotContentRoot = paginatedContentRoot ?? localContentRoot;
  const ownedNativeContentRoot = nativeOwner?.querySelector<HTMLElement>(TOPIC_SELECTORS.content);
  const transferredContentRoot = nativeOwner ? resolveNativeContent?.(nativeOwner) : null;
  const stableTransferredContentRoot = [
    associatedTransferredContentRoot,
    transferredContentRoot,
    transferredLocalContentRoot,
  ].find((root) => root?.matches(TOPIC_SELECTORS.content)) as HTMLElement | undefined;
  const readableNativeContentRoot = ownedNativeContentRoot?.hasChildNodes()
    ? ownedNativeContentRoot
    : null;
  const nativeContentRoot = stableTransferredContentRoot ?? readableNativeContentRoot;
  const contentRoot = belongsToSnapshot
    ? resolveNativeContent
      ? (nativeContentRoot ?? snapshotContentRoot ?? ownedNativeContentRoot)
      : (snapshotContentRoot ?? ownedNativeContentRoot)
    : (paginatedContentRoot ?? localContentRoot ?? nativeContentRoot);
  const content = contentRoot
    ? extractNativeContent(
        contentRoot,
        article.closest(`[${DOCODE_PAGINATED_POST_ATTRIBUTE}]`) ||
          contentRoot.hasAttribute(DOCODE_PAGINATED_CONTENT_ATTRIBUTE)
          ? 'linuxdo-same-origin-json'
          : 'linuxdo-owned-dom',
      )
    : null;
  if (!author) issues.push({ code: 'missing-post-author', postIndex });
  if (!content) issues.push({ code: 'missing-post-content', postIndex });

  const timestampElement = article.querySelector<HTMLElement>(TOPIC_SELECTORS.timestamp);
  const timeValue = timestampElement?.getAttribute('data-time') ?? null;
  const publishedLabel = normalizeText(
    permalinkLink?.getAttribute('aria-label') ?? permalinkLink?.textContent,
  );

  return {
    author,
    boosts: extractPostBoosts(document, article, nativeOwner),
    completeness: author && content ? 'complete' : 'partial',
    content,
    id,
    loadedOrder: postIndex,
    number,
    permalink: permalinkUrl.href,
    publishedAt: toIsoTimestamp(timeValue),
    publishedLabel: publishedLabel || null,
    reactionCount: extractPostReactionCount(article, nativeOwner),
    readState,
    replyToPostNumber: readReplyToPostNumber(numberContainer),
  };
}

const POST_BOOST_LIMIT = 100;
const POST_BOOST_TEXT_LIMIT = 120;

function extractPostBoosts(
  document: Document,
  article: HTMLElement,
  nativeOwner: HTMLElement | null,
): readonly TopicPostBoost[] {
  const host =
    (nativeOwner?.querySelector('.discourse-boosts__list') ? nativeOwner : null) ??
    (article.querySelector('.discourse-boosts__list') ? article : null);
  if (!host) return [];
  const boosts: TopicPostBoost[] = [];
  for (const bubble of Array.from(
    host.querySelectorAll('.discourse-boosts__list .discourse-boosts__bubble'),
  ).slice(0, POST_BOOST_LIMIT)) {
    const text = normalizeText(
      bubble.querySelector('.discourse-boosts__cooked')?.textContent,
    ).slice(0, POST_BOOST_TEXT_LIMIT);
    if (!text) continue;
    const avatarUrl = toHttpsImageUrl(
      bubble.querySelector('img.avatar')?.getAttribute('src') ?? null,
      document.location.href,
    );
    const username = normalizeText(
      bubble.querySelector('[data-user-card]')?.getAttribute('data-user-card'),
    );
    boosts.push({ avatarUrl: avatarUrl?.href ?? null, text, username: username || null });
  }
  return boosts;
}

function extractPostReactionCount(article: HTMLElement, nativeOwner: HTMLElement | null): number {
  const paginatedCount = Number(article.getAttribute('data-docode-reaction-count'));
  if (Number.isSafeInteger(paginatedCount) && paginatedCount > 0) return paginatedCount;
  const counter =
    nativeOwner?.querySelector('.discourse-reactions-counter') ??
    article.querySelector('.discourse-reactions-counter');
  if (!counter) return 0;
  const label = counter.getAttribute('aria-label') ?? '';
  const labelMatch = /^(\d+)\s/u.exec(label);
  if (labelMatch) {
    const parsed = Number(labelMatch[1]);
    if (Number.isSafeInteger(parsed) && parsed > 0) return parsed;
  }
  const text = normalizeText(counter.querySelector('.reactions-counter')?.textContent);
  const parsedText = Number(text);
  return Number.isSafeInteger(parsedText) && parsedText > 0 ? parsedText : 0;
}

function resolveCurrentNativePostOwner(
  document: Document,
  article: HTMLElement,
  postId: number,
): HTMLElement | null {
  const associatedOwner = topicSnapshotNativeOwners.get(article);
  if (associatedOwner && isCurrentNativePostOwner(associatedOwner)) return associatedOwner;
  if (isCurrentNativePostOwner(article)) return article;

  return (
    Array.from(
      document.querySelectorAll<HTMLElement>(`article[data-post-id="${String(postId)}"]`),
    ).find(isCurrentNativePostOwner) ?? null
  );
}

function isCurrentNativePostOwner(article: HTMLElement): boolean {
  return (
    article.isConnected &&
    article.closest(
      `[${DOCODE_TOPIC_SNAPSHOT_ATTRIBUTE}], [${DOCODE_PAGINATED_POST_ATTRIBUTE}], [data-docode-workbench-root]`,
    ) === null
  );
}

function extractPostReadState(nativeOwner: HTMLElement | null): TopicPostReadState {
  const readStateElement = nativeOwner?.querySelector(TOPIC_SELECTORS.readState);
  return readStateElement && !readStateElement.classList.contains('read') ? 'unread' : 'unknown';
}

function readReplyToPostNumber(numberContainer: HTMLElement | null): number | null {
  const value = toPositiveInteger(
    numberContainer?.getAttribute(DOCODE_REPLY_TO_POST_ATTRIBUTE) ?? null,
  );
  return value !== null && value < Number(numberContainer?.dataset.postNumber) ? value : null;
}

function extractAuthor(document: Document, article: HTMLElement): TopicPostAuthor | null {
  const candidates = Array.from(
    article.querySelectorAll<HTMLAnchorElement>(TOPIC_SELECTORS.author),
  );
  for (const link of candidates) {
    const url = toSupportedUrl(link.getAttribute('href'), document.location.href);
    const route = url ? recognizeLinuxDoRoute(url) : null;
    if (!url || route?.kind !== 'user') continue;
    const displayName = normalizeText(link.textContent) || route.username;
    const avatarUrl = toHttpsImageUrl(
      article
        .querySelector<HTMLImageElement>('.topic-avatar img.avatar[src], .topic-avatar img[src]')
        ?.getAttribute('src') ?? null,
      document.location.href,
    );
    return {
      avatarUrl: avatarUrl?.href ?? null,
      displayName,
      url: url.href,
      username: route.username,
    };
  }
  return null;
}

function extractNativeContent(
  root: HTMLElement,
  source: NativePostContent['source'],
): NativePostContent {
  const children = Array.from(root.children).filter(
    (element): element is HTMLElement =>
      element instanceof HTMLElement &&
      !IGNORED_CONTENT_CLASSES.some((className) => element.classList.contains(className)),
  );
  const cached = nativeContentCache.get(root);
  if (
    cached?.source === source &&
    cached.children.length === children.length &&
    cached.children.every((element, index) => element === children[index])
  ) {
    return cached.content;
  }
  const content: NativePostContent = {
    blocks: children.map((element) => ({ element, kind: classifyContentBlock(element) })),
    root,
    source,
  };
  nativeContentCache.set(root, { children, content, source });
  return content;
}

function classifyContentBlock(element: HTMLElement): NativePostContentBlockKind {
  const tagName = element.tagName.toLowerCase();
  if (/^h[1-6]$/.test(tagName)) return 'heading';
  if (tagName === 'p') return 'paragraph';
  if (tagName === 'ul' || tagName === 'ol') return 'list';
  if (tagName === 'blockquote' || element.matches('aside.quote')) return 'quote';
  if (tagName === 'pre' || tagName === 'code') return 'code';
  if (tagName === 'table') return 'table';
  if (tagName === 'details') return 'details';
  if (tagName === 'hr') return 'horizontal-rule';
  if (['figure', 'img', 'video', 'audio'].includes(tagName)) return 'media';
  return 'other';
}

function extractCategory(document: Document, wrapper: HTMLElement): TopicCategory | null {
  const link = wrapper.querySelector<HTMLAnchorElement>(TOPIC_SELECTORS.category);
  const url = toSupportedUrl(link?.getAttribute('href') ?? null, document.location.href);
  const route = url ? recognizeLinuxDoRoute(url) : null;
  const name = normalizeText(link?.textContent);
  if (!url || route?.kind !== 'topic-list' || route.view !== 'category' || !name) return null;
  return {
    id: route.categoryId,
    name,
    slug: route.categorySlug,
    url: url.href,
  };
}

function extractTags(document: Document, wrapper: HTMLElement): TopicTag[] {
  const tags = new Map<string, TopicTag>();
  for (const link of wrapper.querySelectorAll<HTMLAnchorElement>(TOPIC_SELECTORS.tags)) {
    const url = toSupportedUrl(link.getAttribute('href'), document.location.href);
    const route = url ? recognizeLinuxDoRoute(url) : null;
    const name = normalizeText(link.textContent);
    if (!url || route?.kind !== 'topic-list' || route.view !== 'tag' || !name) continue;
    tags.set(route.tagSlug, {
      id: route.tagId,
      name,
      slug: route.tagSlug,
      url: url.href,
    });
  }
  return [...tags.values()];
}

function toIsoTimestamp(value: string | null): string | null {
  if (!value) return null;
  const numericValue = Number(value);
  const timestamp = Number.isFinite(numericValue) ? numericValue : Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  const date = new Date(timestamp);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

function toPositiveInteger(value: string | null): number | null {
  if (!value || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function toSupportedUrl(href: string | null, baseHref: string): URL | null {
  if (!href) return null;
  try {
    const url = new URL(href, baseHref);
    return isLinuxDoLocation(url) ? url : null;
  } catch {
    return null;
  }
}

function toHttpsImageUrl(href: string | null, baseHref: string): URL | null {
  if (!href) return null;
  try {
    const url = new URL(href, baseHref);
    return url.protocol === 'https:' && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
}

function normalizeText(value: string | null | undefined): string {
  return value?.replace(/\s+/g, ' ').trim() ?? '';
}
