import type { LinuxDoRoute } from './routes';
import { resolveLinuxDoAvatarUrl } from './userCardAdapter';
import {
  extractTopicJsonPage,
  extractTopicJsonPosts,
  type TopicJsonPost,
} from './topicJsonAdapter';
import {
  DOCODE_PAGINATED_CONTENT_ATTRIBUTE,
  DOCODE_PAGINATED_POST_ATTRIBUTE,
  DOCODE_REPLY_TO_POST_ATTRIBUTE,
  DOCODE_TOPIC_SNAPSHOT_ATTRIBUTE,
  TOPIC_LOADING_SELECTOR,
  associateTopicSnapshotPost,
  extractTopic,
  findTopicPostStream,
  type NativePostContentResolver,
  type TopicMetadata,
} from './topicAdapter';

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type TopicRoute = Extract<LinuxDoRoute, { readonly kind: 'topic' }>;

export type TopicPostPageLoadOutcome =
  | {
      readonly hasLater?: boolean;
      readonly hasMore: boolean;
      readonly kind: 'ready';
      readonly loadedPostCount: number;
    }
  | { readonly kind: 'aborted' | 'complete' | 'unavailable' };

export type TopicReplyTargetLoadOutcome =
  | {
      readonly annotatedPostCount: number;
      readonly changedPostCount: number;
      readonly kind: 'ready';
    }
  | { readonly kind: 'aborted' | 'unavailable' };

type InitialPageOutcome =
  | {
      readonly id: number | null;
      readonly kind: 'ready';
      readonly postIds: readonly number[];
      readonly posts: readonly TopicJsonPost[];
      readonly title: string | null;
    }
  | { readonly kind: 'aborted' | 'unavailable' };

interface PaginationSession {
  anchorPostId: number | null;
  readonly cachedPosts: Map<number, TopicJsonPost>;
  cursor: number;
  exhausted: boolean;
  readonly initializationController: AbortController;
  initialization: Promise<InitialPageOutcome> | null;
  initialized: boolean;
  postIds: readonly number[];
  previousCursor: number;
  previousExhausted: boolean;
  readonly routeTopicId: number;
  title: string | null;
  topicId: number | null;
}

const PAGE_SIZE = 20;
const MAX_EMPTY_PAGE_HOPS = 4;
const BLOCKED_CONTENT_SELECTOR =
  'base, button, embed, form, iframe, input, link, meta, object, script, style, textarea';
const URL_ATTRIBUTES = new Set(['action', 'formaction', 'href', 'poster', 'src', 'xlink:href']);

export class LinuxDoTopicPaginator {
  readonly #document: Document;
  readonly #fetch: FetchLike | null;
  readonly #resolveNativeContent: NativePostContentResolver | undefined;
  readonly #ownedContents = new Set<HTMLElement>();
  readonly #ownedPosts = new Set<HTMLElement>();
  readonly #replyTargetAnnotations = new Map<HTMLElement, string | null>();
  #snapshotSource: HTMLElement | null = null;
  #session: PaginationSession | null = null;

  constructor(
    document: Document,
    options: {
      readonly fetch?: FetchLike | null;
      readonly resolveNativeContent?: NativePostContentResolver | undefined;
    } = {},
  ) {
    this.#document = document;
    this.#resolveNativeContent = options.resolveNativeContent;
    const documentWindow = document.defaultView;
    const documentFetch: unknown = documentWindow ? Reflect.get(documentWindow, 'fetch') : null;
    this.#fetch =
      options.fetch ??
      (typeof documentFetch === 'function' && documentWindow
        ? (input, init) =>
            Reflect.apply(documentFetch, documentWindow, [input, init]) as Promise<Response>
        : null);
  }

  async loadNext(
    route: TopicRoute,
    loadedPostIds: ReadonlySet<number>,
    incompletePostIds: ReadonlySet<number>,
    signal: AbortSignal,
  ): Promise<TopicPostPageLoadOutcome> {
    if (signal.aborted) return { kind: 'aborted' };
    if (!this.#document.defaultView?.DOMParser) return { kind: 'unavailable' };
    const session = this.#getSession(route);
    this.#session = session;

    const initialization = await this.#ensureInitialized(route, session, signal);
    if (initialization.kind !== 'ready') return initialization;
    if (!topicStreamOverlapsLoadedPosts(session.postIds, loadedPostIds)) {
      return { kind: 'unavailable' };
    }
    this.#ensureInitialSnapshotSource(route, initialization);
    this.#annotateReplyTargets(route, [...session.cachedPosts.values()]);

    const effectiveLoadedPostIds = readTopicStreamPostIds(this.#document, route);
    synchronizePaginationWindow(session, effectiveLoadedPostIds, route);
    const availableHydrationIds = session.postIds.filter(
      (id) => effectiveLoadedPostIds.has(id) && incompletePostIds.has(id),
    );
    const hydrationIds = availableHydrationIds.slice(0, PAGE_SIZE);
    if (hydrationIds.length > 0) {
      const posts = await this.#readPosts(route, session, hydrationIds, signal);
      if (posts.kind !== 'ready') return posts;
      const loadedPostCount = this.#hydratePosts(route, posts.posts);
      if (loadedPostCount === null) return { kind: 'unavailable' };
      if (loadedPostCount === 0) return { kind: 'unavailable' };
      return {
        hasMore:
          hydrationIds.length < availableHydrationIds.length ||
          session.cursor < session.postIds.length - 1,
        kind: 'ready',
        loadedPostCount,
      };
    }
    if (session.exhausted) return { kind: 'complete' };
    for (let hop = 0; hop < MAX_EMPTY_PAGE_HOPS; hop += 1) {
      const pageStartIndex = session.cursor + 1;
      const pageEndIndex = Math.min(session.postIds.length, pageStartIndex + PAGE_SIZE);
      const candidateIds = session.postIds
        .slice(pageStartIndex, pageEndIndex)
        .filter((id) => !effectiveLoadedPostIds.has(id));
      if (candidateIds.length === 0) {
        session.cursor = Math.max(session.cursor, pageEndIndex - 1);
        if (session.cursor >= session.postIds.length - 1) {
          session.exhausted = true;
          return { kind: 'complete' };
        }
        continue;
      }
      const posts = await this.#readPosts(route, session, candidateIds, signal);
      if (posts.kind !== 'ready') return posts;
      const lastCandidateId = candidateIds.at(-1);
      if (lastCandidateId !== undefined) {
        session.cursor = Math.max(session.cursor, session.postIds.indexOf(lastCandidateId));
      }
      if (posts.posts.length === 0) continue;
      const loadedPostCount = this.#insertPosts(route, session, posts.posts);
      if (loadedPostCount === null) return { kind: 'unavailable' };
      if (loadedPostCount === 0) continue;
      return {
        hasMore: session.cursor < session.postIds.length - 1,
        kind: 'ready',
        loadedPostCount,
      };
    }
    session.exhausted = true;
    return { kind: 'complete' };
  }

  async loadPrevious(
    route: TopicRoute,
    loadedPostIds: ReadonlySet<number>,
    signal: AbortSignal,
  ): Promise<TopicPostPageLoadOutcome> {
    if (signal.aborted) return { kind: 'aborted' };
    if (!this.#document.defaultView?.DOMParser) return { kind: 'unavailable' };
    const session = this.#getSession(route);
    this.#session = session;

    const initialization = await this.#ensureInitialized(route, session, signal);
    if (initialization.kind !== 'ready') return initialization;
    if (!topicStreamOverlapsLoadedPosts(session.postIds, loadedPostIds)) {
      return { kind: 'unavailable' };
    }
    this.#ensureInitialSnapshotSource(route, initialization);
    this.#annotateReplyTargets(route, [...session.cachedPosts.values()]);

    const effectiveLoadedPostIds = readTopicStreamPostIds(this.#document, route);
    const window = synchronizePaginationWindow(session, effectiveLoadedPostIds, route);
    if (!window) return { kind: 'unavailable' };
    const hasLater = window.lastIndex < session.postIds.length - 1;
    if (session.previousExhausted || session.previousCursor <= 0) {
      session.previousExhausted = true;
      return { kind: 'complete' };
    }
    for (let hop = 0; hop < MAX_EMPTY_PAGE_HOPS; hop += 1) {
      const startIndex = Math.max(0, session.previousCursor - PAGE_SIZE);
      const candidateIds = session.postIds
        .slice(startIndex, session.previousCursor)
        .filter((id) => !effectiveLoadedPostIds.has(id));
      session.previousCursor = startIndex;
      if (candidateIds.length === 0) {
        if (startIndex === 0) {
          session.previousExhausted = true;
          return { kind: 'complete' };
        }
        continue;
      }
      const posts = await this.#readPosts(route, session, candidateIds, signal);
      if (posts.kind !== 'ready') return posts;
      if (posts.posts.length === 0) continue;
      const loadedPostCount = this.#insertPosts(route, session, posts.posts);
      if (loadedPostCount === null) return { kind: 'unavailable' };
      if (loadedPostCount === 0) continue;
      const hasMore = session.previousCursor > 0;
      if (!hasMore) session.previousExhausted = true;
      return { hasLater, hasMore, kind: 'ready', loadedPostCount };
    }
    session.previousExhausted = session.previousCursor <= 0;
    return session.previousExhausted ? { kind: 'complete' } : { kind: 'unavailable' };
  }

  async loadReplyTargets(
    route: TopicRoute,
    signal: AbortSignal,
  ): Promise<TopicReplyTargetLoadOutcome> {
    if (signal.aborted) return { kind: 'aborted' };
    if (!this.#document.defaultView?.DOMParser) return { kind: 'unavailable' };
    const session = this.#getSession(route);
    this.#session = session;
    const initialization = await this.#ensureInitialized(route, session, signal);
    if (initialization.kind !== 'ready') return initialization;
    this.#ensureInitialSnapshotSource(route, initialization);

    const loadedIds = new Set(
      Array.from(
        findTopicPostStream(this.#document, route)?.querySelectorAll<HTMLElement>(
          'article[data-post-id]',
        ) ?? [],
      ).flatMap((article) => {
        const value = Number(article.dataset.postId);
        return Number.isSafeInteger(value) && value > 0 ? [value] : [];
      }),
    );
    const posts: TopicJsonPost[] = [];
    const relevantIds = session.postIds.filter((id) => loadedIds.has(id));
    for (let index = 0; index < relevantIds.length; index += PAGE_SIZE) {
      const outcome = await this.#readPosts(
        route,
        session,
        relevantIds.slice(index, index + PAGE_SIZE),
        signal,
      );
      if (outcome.kind !== 'ready') return outcome;
      posts.push(...outcome.posts);
    }
    if (this.#hydratePosts(route, posts) === null) return { kind: 'unavailable' };
    return { ...this.#annotateReplyTargets(route, posts), kind: 'ready' };
  }

  dispose(): void {
    this.reset();
  }

  reset(): void {
    this.#session?.initializationController.abort();
    this.#session = null;
    this.#replyTargetAnnotations.forEach((value, element) => {
      if (value === null) element.removeAttribute(DOCODE_REPLY_TO_POST_ATTRIBUTE);
      else element.setAttribute(DOCODE_REPLY_TO_POST_ATTRIBUTE, value);
    });
    this.#replyTargetAnnotations.clear();
    this.#ownedContents.forEach((content) => {
      content.remove();
    });
    this.#ownedContents.clear();
    this.#ownedPosts.forEach((post) => {
      post.remove();
    });
    this.#ownedPosts.clear();
    this.#snapshotSource?.remove();
    this.#snapshotSource = null;
  }

  #getSession(route: TopicRoute): PaginationSession {
    if (this.#session?.routeTopicId === route.topicId) return this.#session;
    if (this.#session) this.reset();
    return {
      anchorPostId: null,
      cachedPosts: new Map<number, TopicJsonPost>(),
      cursor: -1,
      exhausted: false,
      initialization: null,
      initializationController: new AbortController(),
      initialized: false,
      postIds: [],
      previousCursor: Number.POSITIVE_INFINITY,
      previousExhausted: false,
      routeTopicId: route.topicId,
      title: null,
      topicId: null,
    };
  }

  async #ensureInitialized(
    route: TopicRoute,
    session: PaginationSession,
    signal: AbortSignal,
  ): Promise<InitialPageOutcome> {
    if (signal.aborted) return { kind: 'aborted' };
    if (session.initialized) {
      return {
        id: session.topicId,
        kind: 'ready',
        postIds: session.postIds,
        posts: [...session.cachedPosts.values()],
        title: session.title,
      };
    }
    if (!session.initialization) {
      const initialization = this.#loadInitialPage(
        route,
        session.initializationController.signal,
      ).then((page) => {
        if (
          page.kind === 'ready' &&
          isPaginationSessionCurrent(
            this.#session,
            session,
            session.initializationController.signal,
          )
        ) {
          session.initialized = true;
          session.postIds = page.postIds;
          session.title = page.title;
          session.topicId = page.id;
          page.posts.forEach((post) => session.cachedPosts.set(post.id, post));
        }
        return page;
      });
      session.initialization = initialization;
      void initialization.then(() => {
        if (session.initialization === initialization) session.initialization = null;
      });
    }
    const initialization = session.initialization;
    const outcome = await waitForInitialization(initialization, signal);
    if (outcome.kind !== 'ready') return outcome;
    return isPaginationSessionCurrent(this.#session, session, signal)
      ? outcome
      : { kind: 'aborted' };
  }

  async #readPosts(
    route: TopicRoute,
    session: PaginationSession,
    postIds: readonly number[],
    signal: AbortSignal,
  ): Promise<
    | { readonly kind: 'ready'; readonly posts: readonly TopicJsonPost[] }
    | { readonly kind: 'aborted' | 'unavailable' }
  > {
    const missingIds = postIds.filter((id) => !session.cachedPosts.has(id));
    if (missingIds.length > 0) {
      const posts = await this.#loadPosts(route, missingIds, signal);
      if (posts.kind !== 'ready') return posts;
      if (!isPaginationSessionCurrent(this.#session, session, signal)) {
        return { kind: 'aborted' };
      }
      posts.posts.forEach((post) => session.cachedPosts.set(post.id, post));
    }
    return {
      kind: 'ready',
      posts: postIds.flatMap((id) => {
        const post = session.cachedPosts.get(id);
        return post ? [post] : [];
      }),
    };
  }

  async #loadInitialPage(route: TopicRoute, signal: AbortSignal): Promise<InitialPageOutcome> {
    const preloaded = this.#readPreloadedTopic(route);
    if (preloaded) {
      return {
        id: preloaded.id,
        kind: 'ready',
        postIds: preloaded.postIds,
        posts: preloaded.posts,
        title: preloaded.title,
      };
    }
    if (!this.#fetch) return { kind: 'unavailable' };
    const url = new URL(
      `/t/${encodeURIComponent(route.topicSlug)}/${String(route.topicId)}.json`,
      this.#document.location.origin,
    );
    const payload = await this.#loadJson(url, signal);
    if (payload.kind !== 'ready') return payload;
    const page = extractTopicJsonPage(payload.payload, route.topicId);
    return page
      ? { id: page.id, kind: 'ready', postIds: page.postIds, posts: page.posts, title: page.title }
      : { kind: 'unavailable' };
  }

  #readPreloadedTopic(route: TopicRoute) {
    const serialized = this.#document.querySelector('#data-preloaded')?.textContent;
    if (!serialized) return null;
    try {
      const registry = JSON.parse(serialized) as unknown;
      if (!registry || typeof registry !== 'object' || Array.isArray(registry)) return null;
      const topicPayload = Reflect.get(registry, `topic_${String(route.topicId)}`) as unknown;
      const parsed =
        typeof topicPayload === 'string' ? (JSON.parse(topicPayload) as unknown) : topicPayload;
      return extractTopicJsonPage(parsed, route.topicId);
    } catch {
      return null;
    }
  }

  #ensureInitialSnapshotSource(
    route: TopicRoute,
    page: Extract<InitialPageOutcome, { kind: 'ready' }>,
  ): void {
    if (
      this.#snapshotSource ||
      (page.id !== null && page.id !== route.topicId) ||
      page.posts.length === 0
    ) {
      return;
    }
    const nativeExtraction = extractTopic(this.#document, route, {
      resolveNativeContent: this.#resolveNativeContent,
    });
    const titleText =
      page.title ?? (nativeExtraction.state === 'ready' ? nativeExtraction.topic.title : null);
    if (!titleText) return;
    const source = this.#document.createElement('div');
    source.hidden = true;
    source.setAttribute(DOCODE_TOPIC_SNAPSHOT_ATTRIBUTE, '');
    const nativeStream =
      nativeExtraction.state === 'ready' ? findTopicPostStream(this.#document, route) : null;
    const loadedPostIds = nativeStream
      ? readPostIdsFromStream(nativeStream)
      : new Set(page.posts.map(({ id }) => id));
    const initialWindow = resolveLoadedTopicWindow(
      page.postIds,
      loadedPostIds,
      page.posts,
      route,
      null,
    );
    if (!initialWindow) return;
    const session = this.#getSession(route);
    sessionAnchorFromWindow(session, initialWindow);
    const visiblePostIds = new Set(
      page.postIds.slice(initialWindow.firstIndex, initialWindow.lastIndex + 1),
    );
    const authoritativeIndex = new Map(page.postIds.map((id, index) => [id, index]));
    const visiblePosts = page.posts
      .filter(({ id }) => visiblePostIds.has(id))
      .sort(
        (left, right) =>
          (authoritativeIndex.get(left.id) ?? Number.POSITIVE_INFINITY) -
          (authoritativeIndex.get(right.id) ?? Number.POSITIVE_INFINITY),
      );
    const title = createSnapshotTitle(
      this.#document,
      route,
      titleText,
      nativeExtraction.state === 'ready' ? nativeExtraction.topic : null,
    );
    const stream = nativeStream
      ? cloneTopicStream(this.#document, nativeStream, visiblePostIds, this.#resolveNativeContent)
      : createJsonTopicStream(this.#document, route, visiblePosts, this.#ownedPosts);
    source.append(title, stream);
    this.#document.body.append(source);
    this.#snapshotSource = source;
  }

  async #loadPosts(
    route: TopicRoute,
    postIds: readonly number[],
    signal: AbortSignal,
  ): Promise<
    | { readonly kind: 'ready'; readonly posts: readonly TopicJsonPost[] }
    | { readonly kind: 'aborted' | 'unavailable' }
  > {
    const url = new URL(`/t/${String(route.topicId)}/posts.json`, this.#document.location.origin);
    postIds.forEach((id) => {
      url.searchParams.append('post_ids[]', String(id));
    });
    const payload = await this.#loadJson(url, signal);
    if (payload.kind !== 'ready') return payload;
    const posts = extractTopicJsonPosts(payload.payload, route.topicId);
    return posts ? { kind: 'ready', posts } : { kind: 'unavailable' };
  }

  async #loadJson(
    url: URL,
    signal: AbortSignal,
  ): Promise<
    | { readonly kind: 'ready'; readonly payload: unknown }
    | { readonly kind: 'aborted' | 'unavailable' }
  > {
    try {
      const response = await this.#fetch?.(url, {
        credentials: 'same-origin',
        headers: new Headers({ Accept: 'application/json' }),
        method: 'GET',
        signal,
      });
      if (signal.aborted) return { kind: 'aborted' };
      if (!response?.ok) return { kind: 'unavailable' };
      const responseUrl = new URL(response.url || url.href);
      if (responseUrl.origin !== this.#document.location.origin) return { kind: 'unavailable' };
      const payload = (await response.json()) as unknown;
      return readAbortState(signal) ? { kind: 'aborted' } : { kind: 'ready', payload };
    } catch (error) {
      if (signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
        return { kind: 'aborted' };
      }
      return { kind: 'unavailable' };
    }
  }

  #hydratePosts(route: TopicRoute, posts: readonly TopicJsonPost[]): number | null {
    const stream = findTopicPostStream(this.#document, route);
    if (!stream) return null;
    const articles = Array.from(stream.querySelectorAll<HTMLElement>('article[data-post-id]'));
    let hydrated = 0;
    posts.forEach((post) => {
      const article = articles.find((candidate) => Number(candidate.dataset.postId) === post.id);
      const transferredContent = article ? this.#resolveNativeContent?.(article) : null;
      if (!article || article.querySelector('.cooked') || transferredContent?.matches('.cooked')) {
        return;
      }
      const numberContainer = article.closest<HTMLElement>('[data-post-number]');
      if (Number(numberContainer?.dataset.postNumber) !== post.number) return;
      if (numberContainer) this.#setReplyTargetAnnotation(numberContainer, post.replyToPostNumber);
      const content = createCookedContent(this.#document, post.cooked);
      content.setAttribute(DOCODE_PAGINATED_CONTENT_ATTRIBUTE, '');
      article.append(content);
      this.#ownedContents.add(content);
      hydrated += 1;
    });
    return hydrated;
  }

  #insertPosts(
    route: TopicRoute,
    session: PaginationSession,
    posts: readonly TopicJsonPost[],
  ): number | null {
    const stream = findTopicPostStream(this.#document, route);
    if (!stream) return null;
    const authoritativeIndex = new Map(session.postIds.map((id, index) => [id, index]));
    const existingPostIds = readPostIdsFromStream(stream);
    let inserted = 0;
    [...posts]
      .sort(
        (left, right) =>
          (authoritativeIndex.get(left.id) ?? Number.POSITIVE_INFINITY) -
          (authoritativeIndex.get(right.id) ?? Number.POSITIVE_INFINITY),
      )
      .forEach((post) => {
        if (existingPostIds.has(post.id)) return;
        const wrapper = createPostElement(this.#document, route, post);
        this.#ownedPosts.add(wrapper);
        const postIndex = authoritativeIndex.get(post.id) ?? Number.POSITIVE_INFINITY;
        const nextWrapper = readTopicPostWrappers(stream).find((candidate) => {
          const candidateId = Number(
            candidate.querySelector<HTMLElement>('article[data-post-id]')?.dataset.postId,
          );
          return (authoritativeIndex.get(candidateId) ?? Number.POSITIVE_INFINITY) > postIndex;
        });
        stream.insertBefore(wrapper, nextWrapper ?? null);
        existingPostIds.add(post.id);
        inserted += 1;
      });
    return inserted;
  }

  #annotateReplyTargets(
    route: TopicRoute,
    posts: readonly TopicJsonPost[],
  ): {
    readonly annotatedPostCount: number;
    readonly changedPostCount: number;
  } {
    const stream = findTopicPostStream(this.#document, route);
    if (!stream) return { annotatedPostCount: 0, changedPostCount: 0 };
    const postsById = new Map(posts.map((post) => [post.id, post]));
    let annotated = 0;
    let changed = 0;
    stream.querySelectorAll<HTMLElement>('article[data-post-id]').forEach((article) => {
      const post = postsById.get(Number(article.dataset.postId));
      if (!post) return;
      const wrapper = article.closest<HTMLElement>('[data-post-number]');
      if (!wrapper || Number(wrapper.dataset.postNumber) !== post.number) return;
      if (post.replyToPostNumber !== null) annotated += 1;
      if (this.#setReplyTargetAnnotation(wrapper, post.replyToPostNumber)) changed += 1;
    });
    return { annotatedPostCount: annotated, changedPostCount: changed };
  }

  #setReplyTargetAnnotation(element: HTMLElement, postNumber: number | null): boolean {
    if (!this.#replyTargetAnnotations.has(element)) {
      this.#replyTargetAnnotations.set(
        element,
        element.getAttribute(DOCODE_REPLY_TO_POST_ATTRIBUTE),
      );
    }
    const next = postNumber === null ? null : String(postNumber);
    if (element.getAttribute(DOCODE_REPLY_TO_POST_ATTRIBUTE) === next) return false;
    if (next === null) element.removeAttribute(DOCODE_REPLY_TO_POST_ATTRIBUTE);
    else element.setAttribute(DOCODE_REPLY_TO_POST_ATTRIBUTE, next);
    return true;
  }
}

interface LoadedTopicWindow {
  readonly anchorPostId: number;
  readonly firstIndex: number;
  readonly lastIndex: number;
}

function synchronizePaginationWindow(
  session: PaginationSession,
  loadedPostIds: ReadonlySet<number>,
  route: TopicRoute,
): LoadedTopicWindow | null {
  const window = resolveLoadedTopicWindow(
    session.postIds,
    loadedPostIds,
    [...session.cachedPosts.values()],
    route,
    session.anchorPostId,
  );
  if (!window) return null;
  sessionAnchorFromWindow(session, window);
  return window;
}

function resolveLoadedTopicWindow(
  postIds: readonly number[],
  loadedPostIds: ReadonlySet<number>,
  posts: readonly TopicJsonPost[],
  route: TopicRoute,
  preferredAnchorPostId: number | null,
): LoadedTopicWindow | null {
  const postsByNumber = new Map(posts.map((post) => [post.number, post.id]));
  const routeAnchorPostId = postsByNumber.get(route.postNumber ?? 1) ?? null;
  const anchorPostId =
    (preferredAnchorPostId !== null && loadedPostIds.has(preferredAnchorPostId)
      ? preferredAnchorPostId
      : null) ??
    (routeAnchorPostId !== null && loadedPostIds.has(routeAnchorPostId)
      ? routeAnchorPostId
      : null) ??
    postIds.find((id) => loadedPostIds.has(id)) ??
    null;
  if (anchorPostId === null) return null;
  const anchorIndex = postIds.indexOf(anchorPostId);
  if (anchorIndex < 0) return null;
  let firstIndex = anchorIndex;
  let lastIndex = anchorIndex;
  while (firstIndex > 0 && loadedPostIds.has(postIds[firstIndex - 1] ?? -1)) firstIndex -= 1;
  while (lastIndex < postIds.length - 1 && loadedPostIds.has(postIds[lastIndex + 1] ?? -1)) {
    lastIndex += 1;
  }
  return { anchorPostId, firstIndex, lastIndex };
}

function sessionAnchorFromWindow(session: PaginationSession, window: LoadedTopicWindow): void {
  if (session.anchorPostId !== window.anchorPostId) {
    session.anchorPostId = window.anchorPostId;
    session.cursor = window.lastIndex;
    session.previousCursor = window.firstIndex;
    session.exhausted = false;
    session.previousExhausted = false;
  } else {
    session.cursor = Math.max(session.cursor, window.lastIndex);
    session.previousCursor = Math.min(session.previousCursor, window.firstIndex);
  }
  if (session.cursor >= session.postIds.length - 1) session.exhausted = true;
  if (session.previousCursor <= 0) session.previousExhausted = true;
}

function topicStreamOverlapsLoadedPosts(
  postIds: readonly number[],
  loadedPostIds: ReadonlySet<number>,
): boolean {
  return loadedPostIds.size === 0 || postIds.some((id) => loadedPostIds.has(id));
}

function readTopicStreamPostIds(document: Document, route: TopicRoute): ReadonlySet<number> {
  const stream = findTopicPostStream(document, route);
  return stream ? readPostIdsFromStream(stream) : new Set<number>();
}

function readPostIdsFromStream(stream: HTMLElement): Set<number> {
  return new Set(
    Array.from(stream.querySelectorAll<HTMLElement>('article[data-post-id]')).flatMap((article) => {
      const value = Number(article.dataset.postId);
      return Number.isSafeInteger(value) && value > 0 ? [value] : [];
    }),
  );
}

function readTopicPostWrappers(stream: HTMLElement): HTMLElement[] {
  const wrappers = new Set<HTMLElement>();
  stream.querySelectorAll<HTMLElement>('article[data-post-id]').forEach((article) => {
    let candidate = article.parentElement;
    while (candidate && candidate.parentElement !== stream) candidate = candidate.parentElement;
    if (candidate?.parentElement === stream) wrappers.add(candidate);
  });
  return [...wrappers];
}

function createSnapshotTitle(
  document: Document,
  route: TopicRoute,
  titleText: string,
  metadata: TopicMetadata | null,
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'topic-title-wrapper';
  const title = document.createElement('h1');
  title.dataset.topicId = String(route.topicId);
  const titleLink = document.createElement('a');
  titleLink.className = 'fancy-title';
  titleLink.href = `/t/${encodeURIComponent(route.topicSlug)}/${String(route.topicId)}`;
  titleLink.textContent = titleText;
  title.append(titleLink);
  wrapper.append(title);

  if (metadata?.closed || metadata?.pinned) {
    const status = document.createElement('span');
    status.className = 'topic-status';
    if (metadata.closed) status.append(createSnapshotStatusIcon(document, 'lock'));
    if (metadata.pinned) status.append(createSnapshotStatusIcon(document, 'thumbtack'));
    wrapper.append(status);
  }
  if (metadata?.category) {
    wrapper.append(
      createSnapshotMetadataLink(document, metadata.category.url, metadata.category.name),
    );
  }
  metadata?.tags.forEach((tag) => {
    wrapper.append(createSnapshotMetadataLink(document, tag.url, tag.name));
  });
  return wrapper;
}

function createSnapshotStatusIcon(document: Document, name: 'lock' | 'thumbtack'): SVGElement {
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.classList.add('d-icon', `d-icon-${name}`);
  icon.setAttribute('aria-hidden', 'true');
  return icon;
}

function createSnapshotMetadataLink(document: Document, url: string, label: string): HTMLElement {
  const link = document.createElement('a');
  const parsedUrl = new URL(url);
  link.setAttribute('href', `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`);
  link.textContent = label;
  return link;
}

function cloneTopicStream(
  document: Document,
  nativeStream: HTMLElement,
  visiblePostIds: ReadonlySet<number>,
  resolveNativeContent: NativePostContentResolver | undefined,
): HTMLElement {
  const stream = document.importNode(nativeStream, true);
  stream.querySelectorAll(TOPIC_LOADING_SELECTOR).forEach((element) => {
    element.remove();
  });
  stream.querySelectorAll<HTMLElement>('[id]').forEach((element) => {
    element.removeAttribute('id');
  });
  stream
    .querySelectorAll<HTMLElement>('[data-docode-native-content-transfer]')
    .forEach((element) => {
      element.removeAttribute('data-docode-native-content-transfer');
    });
  readTopicPostWrappers(stream).forEach((wrapper) => {
    const postId = Number(
      wrapper.querySelector<HTMLElement>('article[data-post-id]')?.dataset.postId,
    );
    if (!visiblePostIds.has(postId)) wrapper.remove();
  });
  const nativeArticles = new Map(
    Array.from(nativeStream.querySelectorAll<HTMLElement>('article[data-post-id]')).map(
      (article) => [Number(article.dataset.postId), article],
    ),
  );
  stream.querySelectorAll<HTMLElement>('article[data-post-id]').forEach((snapshotArticle) => {
    const postId = Number(snapshotArticle.dataset.postId);
    const article = nativeArticles.get(postId);
    if (!article) return;
    const clonedContent = snapshotArticle.querySelector<HTMLElement>('.cooked');
    const nativeContent = resolveNativeContent?.(article) ?? article.querySelector('.cooked');
    const cooked = nativeContent?.innerHTML ?? clonedContent?.innerHTML;
    clonedContent?.remove();
    if (cooked !== undefined) {
      snapshotArticle.append(createCookedContent(document, cooked));
    }
    associateTopicSnapshotPost(snapshotArticle, article);
  });
  return stream;
}

function createJsonTopicStream(
  document: Document,
  route: TopicRoute,
  posts: readonly TopicJsonPost[],
  ownedPosts: Set<HTMLElement>,
): HTMLElement {
  const stream = document.createElement('div');
  stream.className = 'post-stream';
  posts.forEach((post) => {
    const wrapper = createPostElement(document, route, post);
    ownedPosts.add(wrapper);
    stream.append(wrapper);
  });
  return stream;
}

function createPostElement(
  document: Document,
  route: TopicRoute,
  post: TopicJsonPost,
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.setAttribute(DOCODE_PAGINATED_POST_ATTRIBUTE, '');
  wrapper.dataset.postNumber = String(post.number);
  if (post.replyToPostNumber !== null) {
    wrapper.setAttribute(DOCODE_REPLY_TO_POST_ATTRIBUTE, String(post.replyToPostNumber));
  }
  const article = document.createElement('article');
  article.id = `post_${String(post.number)}`;
  article.dataset.postId = String(post.id);
  if (post.userId !== null) article.dataset.userId = String(post.userId);

  const names = document.createElement('div');
  names.className = 'names';
  const author = document.createElement('a');
  author.dataset.userCard = post.username;
  author.href = `/u/${encodeURIComponent(post.username)}`;
  author.textContent = post.displayName;
  names.append(author);

  const avatarUrl = resolveLinuxDoAvatarUrl(post.avatarTemplate, document.location.href, 48);
  const avatar = avatarUrl ? document.createElement('div') : null;
  if (avatar && avatarUrl) {
    avatar.className = 'topic-avatar';
    const image = document.createElement('img');
    image.alt = '';
    image.className = 'avatar';
    image.decoding = 'async';
    image.src = avatarUrl;
    avatar.append(image);
  }

  const date = document.createElement('a');
  date.className = 'post-date';
  date.href =
    post.number === 1
      ? `/t/${encodeURIComponent(route.topicSlug)}/${String(route.topicId)}`
      : `/t/${encodeURIComponent(route.topicSlug)}/${String(route.topicId)}/${String(post.number)}`;
  date.setAttribute('aria-label', formatPublishedLabel(post.createdAt));
  const timestamp = document.createElement('span');
  timestamp.className = 'relative-date';
  timestamp.dataset.time = post.createdAt;
  timestamp.textContent = formatPublishedLabel(post.createdAt);
  date.append(timestamp);

  article.append(
    ...(avatar ? [avatar] : []),
    names,
    date,
    createCookedContent(document, post.cooked),
  );
  wrapper.append(article);
  return wrapper;
}

function createCookedContent(document: Document, cooked: string): HTMLElement {
  const Parser = document.defaultView?.DOMParser;
  if (!Parser) throw new Error('DOMParser is unavailable.');
  const parsed = new Parser().parseFromString(cooked, 'text/html');
  const base = parsed.createElement('base');
  base.href = document.baseURI;
  parsed.head.prepend(base);
  parsed.body.querySelectorAll(BLOCKED_CONTENT_SELECTOR).forEach((element) => {
    element.remove();
  });
  parsed.body.querySelectorAll<HTMLElement>('*').forEach((element) => {
    sanitizeElement(element);
  });
  const root = document.createElement('div');
  root.className = 'cooked';
  Array.from(parsed.body.childNodes).forEach((node) => {
    root.append(document.importNode(node, true));
  });
  if (!root.hasChildNodes()) root.append(document.createElement('p'));
  return root;
}

function sanitizeElement(element: HTMLElement): void {
  Array.from(element.attributes).forEach((attribute) => {
    const name = attribute.name.toLowerCase();
    if (name.startsWith('on') || name === 'srcdoc' || name === 'style') {
      element.removeAttribute(attribute.name);
      return;
    }
    if (URL_ATTRIBUTES.has(name) && !isSafeContentUrl(attribute.value, element, name)) {
      element.removeAttribute(attribute.name);
    }
  });
  if (element.tagName === 'A' && element.getAttribute('target') === '_blank') {
    element.setAttribute('rel', 'noopener noreferrer');
  }
}

function isSafeContentUrl(value: string, element: HTMLElement, attributeName: string): boolean {
  try {
    const url = new URL(value, element.ownerDocument.baseURI);
    if (url.protocol === 'https:' || url.protocol === 'http:') return true;
    return (
      attributeName === 'src' &&
      element.tagName === 'IMG' &&
      url.protocol === 'data:' &&
      /^data:image\//iu.test(value)
    );
  } catch {
    return false;
  }
}

function formatPublishedLabel(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function isPaginationSessionCurrent(
  current: PaginationSession | null,
  expected: PaginationSession,
  signal: AbortSignal,
): boolean {
  return current === expected && !readAbortState(signal);
}

function readAbortState(signal: AbortSignal): boolean {
  return signal.aborted;
}

function waitForInitialization(
  initialization: Promise<InitialPageOutcome>,
  signal: AbortSignal,
): Promise<InitialPageOutcome> {
  if (signal.aborted) return Promise.resolve({ kind: 'aborted' });
  return new Promise((resolve) => {
    const abort = () => {
      signal.removeEventListener('abort', abort);
      resolve({ kind: 'aborted' });
    };
    signal.addEventListener('abort', abort, { once: true });
    void initialization.then((outcome) => {
      signal.removeEventListener('abort', abort);
      resolve(signal.aborted ? { kind: 'aborted' } : outcome);
    });
  });
}
