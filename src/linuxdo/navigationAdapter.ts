import type { LinuxDoRoute } from './routes';

export type LinuxDoNavigationOutcome =
  | { readonly kind: 'aborted' }
  | { readonly kind: 'failed' }
  | { readonly kind: 'navigated'; readonly route: LinuxDoRoute }
  | { readonly kind: 'stale' }
  | { readonly kind: 'unchanged'; readonly route: LinuxDoRoute }
  | { readonly kind: 'unavailable' };

interface NavigationRequest {
  readonly abort: () => void;
  readonly expectedGeneration: number;
  readonly resolve: (outcome: LinuxDoNavigationOutcome) => void;
  readonly signal: AbortSignal;
  readonly target: LinuxDoRoute;
  readonly timeout: number;
}

interface LinuxDoNavigationAdapterOptions {
  readonly activate?: (anchor: HTMLAnchorElement) => void;
  readonly timeoutMilliseconds?: number;
}

const DEFAULT_NAVIGATION_TIMEOUT = 5_000;

export class LinuxDoNavigationAdapter {
  readonly #activate: (anchor: HTMLAnchorElement) => void;
  readonly #document: Document;
  readonly #owner: HTMLElement;
  readonly #timeoutMilliseconds: number;
  #currentGeneration: number;
  #currentRoute: LinuxDoRoute;
  #disposed = false;
  #request: NavigationRequest | null = null;

  constructor(
    document: Document,
    owner: HTMLElement,
    initialRoute: LinuxDoRoute,
    initialGeneration = 0,
    options: LinuxDoNavigationAdapterOptions = {},
  ) {
    this.#activate =
      options.activate ??
      ((anchor) => {
        anchor.click();
      });
    this.#document = document;
    this.#owner = owner;
    this.#currentRoute = initialRoute;
    this.#currentGeneration = initialGeneration;
    this.#timeoutMilliseconds = options.timeoutMilliseconds ?? DEFAULT_NAVIGATION_TIMEOUT;
  }

  navigate(
    target: LinuxDoRoute,
    expectedGeneration: number,
    signal: AbortSignal,
  ): Promise<LinuxDoNavigationOutcome> {
    const activeWindow = this.#document.defaultView;
    if (this.#disposed || !activeWindow || !isNavigableRoute(target) || this.#request !== null) {
      return Promise.resolve({ kind: 'unavailable' });
    }
    if (signal.aborted) return Promise.resolve({ kind: 'aborted' });
    if (expectedGeneration !== this.#currentGeneration) {
      return Promise.resolve({ kind: 'stale' });
    }
    if (sameNavigationTarget(this.#currentRoute, target)) {
      return Promise.resolve({ kind: 'unchanged', route: this.#currentRoute });
    }

    return new Promise((resolve) => {
      const abort = () => {
        this.#settle({ kind: 'aborted' });
      };
      const timeout = activeWindow.setTimeout(() => {
        this.#settle({ kind: 'failed' });
      }, this.#timeoutMilliseconds);
      this.#request = { abort, expectedGeneration, resolve, signal, target, timeout };
      signal.addEventListener('abort', abort, { once: true });

      const anchor = this.#document.createElement('a');
      anchor.dataset.docodeCommandNavigation = 'true';
      anchor.href = target.href;
      anchor.hidden = true;
      anchor.tabIndex = -1;
      this.#owner.append(anchor);
      try {
        this.#activate(anchor);
      } catch {
        this.#settle({ kind: 'failed' });
      } finally {
        anchor.remove();
      }
    });
  }

  observe(route: LinuxDoRoute, generation: number): void {
    if (this.#disposed) return;
    this.#currentRoute = route;
    this.#currentGeneration = generation;
    const request = this.#request;
    if (!request || generation <= request.expectedGeneration) return;
    this.#settle(
      sameNavigationTarget(route, request.target)
        ? { kind: 'navigated', route }
        : { kind: 'stale' },
    );
  }

  dispose(): boolean {
    if (this.#disposed) return false;
    this.#disposed = true;
    this.#settle({ kind: 'unavailable' });
    return true;
  }

  #settle(outcome: LinuxDoNavigationOutcome): void {
    const request = this.#request;
    if (!request) return;
    this.#request = null;
    this.#document.defaultView?.clearTimeout(request.timeout);
    request.signal.removeEventListener('abort', request.abort);
    request.resolve(outcome);
  }
}

function isNavigableRoute(route: LinuxDoRoute): boolean {
  if (route.kind === 'unsupported') return false;
  try {
    const url = new URL(route.href);
    return url.origin === 'https://linux.do' && !url.username && !url.password;
  } catch {
    return false;
  }
}

function sameNavigationTarget(current: LinuxDoRoute, target: LinuxDoRoute): boolean {
  if (current.kind !== target.kind) return false;
  switch (target.kind) {
    case 'topic-list':
      if (current.kind !== 'topic-list' || current.view !== target.view) return false;
      if (target.view === 'category') {
        return current.view === 'category' && current.categoryId === target.categoryId;
      }
      if (target.view === 'tag') {
        return (
          current.view === 'tag' &&
          current.tagSlug === target.tagSlug &&
          current.tagId === target.tagId
        );
      }
      return true;
    case 'topic':
      return (
        current.kind === 'topic' &&
        current.topicId === target.topicId &&
        current.postNumber === target.postNumber
      );
    case 'search':
      return current.kind === 'search' && current.query === target.query;
    case 'user':
      return (
        current.kind === 'user' &&
        current.username === target.username &&
        current.section.join('/') === target.section.join('/')
      );
    case 'category-index':
    case 'tag-index':
      return true;
    case 'unsupported':
      return false;
  }
}
