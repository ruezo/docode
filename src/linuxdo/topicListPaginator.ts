import type { TopicListExtraction } from './topicListAdapter';
import { extractTopicListJsonPage } from './topicListJsonAdapter';
import {
  createTopicListDocument,
  type TopicListDocument,
  type TopicListRoute,
} from '../views/topicList/topicListDocument';

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type TopicListPageLoadOutcome =
  | {
      readonly document: TopicListDocument | null;
      readonly hasMore: boolean;
      readonly kind: 'ready';
    }
  | { readonly kind: 'aborted' | 'complete' | 'unavailable' };

interface PaginationSession {
  initialized: boolean;
  nextUrl: URL | null;
  readonly routeHref: string;
}

const MAX_EMPTY_PAGE_HOPS = 4;

export class LinuxDoTopicListPaginator {
  readonly #document: Document;
  readonly #fetch: FetchLike | null;
  #session: PaginationSession | null = null;

  constructor(document: Document, options: { readonly fetch?: FetchLike | null } = {}) {
    this.#document = document;
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
    route: TopicListRoute,
    loadedTopicIds: ReadonlySet<number>,
    signal: AbortSignal,
  ): Promise<TopicListPageLoadOutcome> {
    if (isAborted(signal)) return { kind: 'aborted' };
    if (!this.#fetch) return { kind: 'unavailable' };
    const session =
      this.#session?.routeHref === route.href
        ? this.#session
        : { initialized: false, nextUrl: null, routeHref: route.href };
    this.#session = session;

    for (let hop = 0; hop < MAX_EMPTY_PAGE_HOPS; hop += 1) {
      const requestUrl = session.initialized ? session.nextUrl : createInitialPageUrl(route);
      if (!requestUrl) return { kind: 'complete' };

      const page = await this.#loadPage(requestUrl, signal);
      if (page.kind !== 'ready') return page;
      if (isAborted(signal) || this.#session !== session) return { kind: 'aborted' };

      session.initialized = true;
      session.nextUrl = page.nextUrl;
      const extraction = excludeLoadedTopics(page.extraction, loadedTopicIds);
      if (extraction.state === 'ready') {
        return {
          document: createTopicListDocument(route, extraction),
          hasMore: page.nextUrl !== null,
          kind: 'ready',
        };
      }
      if (page.nextUrl === null) return { kind: 'complete' };
    }

    return { document: null, hasMore: true, kind: 'ready' };
  }

  async #loadPage(
    requestUrl: URL,
    signal: AbortSignal,
  ): Promise<
    | {
        readonly extraction: TopicListExtraction;
        readonly kind: 'ready';
        readonly nextUrl: URL | null;
      }
    | { readonly kind: 'aborted' | 'unavailable' }
  > {
    try {
      const fetch = this.#fetch;
      if (!fetch) return { kind: 'unavailable' };
      const response = await fetch(requestUrl, {
        credentials: 'same-origin',
        headers: new Headers({ Accept: 'application/json' }),
        method: 'GET',
        signal,
      });
      if (isAborted(signal)) return { kind: 'aborted' };
      if (!response.ok) return { kind: 'unavailable' };
      const responseUrl = new URL(response.url || requestUrl.href);
      if (responseUrl.origin !== this.#document.location.origin) return { kind: 'unavailable' };
      const payload: unknown = await response.json();
      if (isAborted(signal)) return { kind: 'aborted' };
      const page = extractTopicListJsonPage(payload, responseUrl.origin);
      if (page.extraction.state === 'error' || page.extraction.state === 'loading') {
        return { kind: 'unavailable' };
      }
      const nextUrl = resolveNextPageUrl(page.moreTopicsUrl, responseUrl);
      if (nextUrl === undefined) return { kind: 'unavailable' };
      return { extraction: page.extraction, kind: 'ready', nextUrl };
    } catch (error) {
      if (isAborted(signal) || (error instanceof DOMException && error.name === 'AbortError')) {
        return { kind: 'aborted' };
      }
      return { kind: 'unavailable' };
    }
  }
}

function isAborted(signal: AbortSignal): boolean {
  return signal.aborted;
}

function createInitialPageUrl(route: TopicListRoute): URL {
  const url = new URL(route.href);
  url.hash = '';
  const pathname = route.view === 'latest' && route.pathname === '/' ? '/latest' : route.pathname;
  const basePath = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  url.pathname = `${basePath}.json`;
  return url;
}

function resolveNextPageUrl(value: string | null, responseUrl: URL): URL | null | undefined {
  if (!value) return null;
  try {
    const nextUrl = new URL(value, responseUrl);
    return nextUrl.origin === responseUrl.origin ? nextUrl : undefined;
  } catch {
    return undefined;
  }
}

function excludeLoadedTopics(
  extraction: TopicListExtraction,
  loadedTopicIds: ReadonlySet<number>,
): TopicListExtraction {
  if (extraction.state !== 'ready') return extraction;
  const topics = extraction.topics.filter(({ id }) => !loadedTopicIds.has(id));
  return topics.length > 0
    ? { issues: extraction.issues, state: 'ready', topics }
    : { issues: [], state: 'empty', topics: [] };
}
