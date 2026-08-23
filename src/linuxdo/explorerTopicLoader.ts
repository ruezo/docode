import {
  createTopicListDocument,
  type TopicListDocument,
} from '../views/topicList/topicListDocument';
import { extractTopicList } from './topicListAdapter';
import { extractTopicListJsonPage } from './topicListJsonAdapter';
import { recognizeLinuxDoRoute, type TopicListView } from './routes';

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type ExplorerTopicLoadOutcome =
  | { readonly document: TopicListDocument; readonly kind: 'ready' }
  | { readonly kind: 'aborted' | 'unavailable' };

export const LINUX_DO_SIMPLE_TOPIC_LIST_VIEWS = [
  'hot',
  'latest',
  'new',
  'top',
  'unread',
] as const satisfies readonly TopicListView[];

export type LinuxDoSimpleTopicListView = (typeof LINUX_DO_SIMPLE_TOPIC_LIST_VIEWS)[number];

export class LinuxDoExplorerTopicLoader {
  readonly #document: Document;
  readonly #fetch: FetchLike | null;

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

  async load(signal: AbortSignal): Promise<ExplorerTopicLoadOutcome> {
    return this.loadView('latest', signal);
  }

  async loadView(view: string, signal: AbortSignal): Promise<ExplorerTopicLoadOutcome> {
    if (signal.aborted) return { kind: 'aborted' };
    if (!isReviewedTopicListView(view)) return { kind: 'unavailable' };
    const Parser = this.#document.defaultView?.DOMParser;
    if (!this.#fetch || !Parser) return { kind: 'unavailable' };
    const jsonOutcome = await this.#loadJson(view, signal);
    if (jsonOutcome.kind !== 'unavailable') return jsonOutcome;
    return this.#loadHtml(view, signal, Parser);
  }

  async #loadJson(
    view: LinuxDoSimpleTopicListView,
    signal: AbortSignal,
  ): Promise<ExplorerTopicLoadOutcome> {
    const url = new URL(`/${view}.json`, this.#document.location.origin);
    try {
      const response = await this.#fetch?.(url, {
        credentials: 'same-origin',
        headers: new Headers({ Accept: 'application/json' }),
        method: 'GET',
        signal,
      });
      if (isAborted(signal)) return { kind: 'aborted' };
      if (!response?.ok) return { kind: 'unavailable' };
      const responseUrl = new URL(response.url || url.href);
      if (responseUrl.origin !== this.#document.location.origin) return { kind: 'unavailable' };
      const payload: unknown = await response.json();
      if (isAborted(signal)) return { kind: 'aborted' };
      const extraction = extractTopicListJsonPage(payload, responseUrl.origin).extraction;
      if (extraction.state !== 'ready') return { kind: 'unavailable' };
      const route = recognizeLinuxDoRoute(new URL(`/${view}`, responseUrl.origin));
      if (route.kind !== 'topic-list' || route.view !== view) return { kind: 'unavailable' };
      return { document: createTopicListDocument(route, extraction), kind: 'ready' };
    } catch (error) {
      if (isAborted(signal) || (error instanceof DOMException && error.name === 'AbortError')) {
        return { kind: 'aborted' };
      }
      return { kind: 'unavailable' };
    }
  }

  async #loadHtml(
    view: LinuxDoSimpleTopicListView,
    signal: AbortSignal,
    Parser: typeof DOMParser,
  ): Promise<ExplorerTopicLoadOutcome> {
    const url = new URL(`/${view}`, this.#document.location.origin);
    try {
      const response = await this.#fetch?.(url, {
        credentials: 'same-origin',
        headers: new Headers({ Accept: 'text/html' }),
        method: 'GET',
        signal,
      });
      if (isAborted(signal)) return { kind: 'aborted' };
      if (!response?.ok) return { kind: 'unavailable' };
      const responseUrl = new URL(response.url || url.href);
      if (responseUrl.origin !== this.#document.location.origin) return { kind: 'unavailable' };
      const html = await response.text();
      if (isAborted(signal)) return { kind: 'aborted' };
      const parsed = new Parser().parseFromString(html, 'text/html');
      const base = parsed.createElement('base');
      base.href = responseUrl.href;
      parsed.head.prepend(base);
      const route = recognizeLinuxDoRoute(responseUrl);
      if (route.kind !== 'topic-list' || route.view !== view) return { kind: 'unavailable' };
      const extraction = extractTopicList(parsed, route);
      if (extraction.state !== 'ready') return { kind: 'unavailable' };
      return { document: createTopicListDocument(route, extraction), kind: 'ready' };
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

function isReviewedTopicListView(view: string): view is LinuxDoSimpleTopicListView {
  return (LINUX_DO_SIMPLE_TOPIC_LIST_VIEWS as readonly string[]).includes(view);
}
