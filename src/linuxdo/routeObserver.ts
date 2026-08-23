import { recognizeLinuxDoRoute, type LinuxDoRoute } from './routes';

export type RouteChangeSource =
  'document' | 'hashchange' | 'initial' | 'link' | 'navigation' | 'popstate';

export interface LinuxDoRouteChange {
  readonly current: LinuxDoRoute;
  readonly generation: number;
  readonly previous: LinuxDoRoute | null;
  readonly repeated: boolean;
  readonly source: RouteChangeSource;
}

export type LinuxDoRouteSubscriber = (change: LinuxDoRouteChange) => void;

type RouteWindow = Window & {
  readonly Element: typeof Element;
  readonly EventTarget: typeof EventTarget;
  readonly HTMLAnchorElement: typeof HTMLAnchorElement;
  readonly MutationObserver: typeof MutationObserver;
};

export class LinuxDoRouteObserver {
  readonly #subscribers = new Set<LinuxDoRouteSubscriber>();
  readonly #navigation: EventTarget | null;
  readonly #window: RouteWindow;
  #current: LinuxDoRoute | null = null;
  #generation = 0;
  #headObserver: MutationObserver | null = null;
  #linkCheckTimer: number | null = null;
  #started = false;

  constructor(window: Window) {
    this.#window = window as RouteWindow;
    const navigation: unknown = Reflect.get(window, 'navigation');
    this.#navigation = navigation instanceof this.#window.EventTarget ? navigation : null;
  }

  get current(): LinuxDoRoute | null {
    return this.#current;
  }

  get generation(): number {
    return this.#generation;
  }

  get isStarted(): boolean {
    return this.#started;
  }

  start(): boolean {
    if (this.#started) return false;
    this.#started = true;

    this.#window.addEventListener('popstate', this.#onPopState);
    this.#window.addEventListener('hashchange', this.#onHashChange);
    this.#navigation?.addEventListener('currententrychange', this.#onNavigation);
    this.#window.document.addEventListener('click', this.#onDocumentClick, true);

    this.#headObserver = new this.#window.MutationObserver(this.#onHeadMutation);
    this.#headObserver.observe(this.#window.document.head, {
      attributeFilter: ['content', 'href'],
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true,
    });

    this.#publish('initial', true);
    return true;
  }

  stop(): boolean {
    if (!this.#started) return false;
    this.#started = false;

    this.#window.removeEventListener('popstate', this.#onPopState);
    this.#window.removeEventListener('hashchange', this.#onHashChange);
    this.#navigation?.removeEventListener('currententrychange', this.#onNavigation);
    this.#window.document.removeEventListener('click', this.#onDocumentClick, true);
    this.#headObserver?.disconnect();
    this.#headObserver = null;
    if (this.#linkCheckTimer !== null) this.#window.clearTimeout(this.#linkCheckTimer);
    this.#linkCheckTimer = null;
    return true;
  }

  subscribe(subscriber: LinuxDoRouteSubscriber): () => void {
    this.#subscribers.add(subscriber);
    return () => {
      this.#subscribers.delete(subscriber);
    };
  }

  readonly #onPopState = () => {
    this.#publish('popstate');
  };

  readonly #onHashChange = () => {
    this.#publish('hashchange');
  };

  readonly #onNavigation = () => {
    this.#publish('navigation', true);
  };

  readonly #onHeadMutation = () => {
    this.#publish('document');
  };

  readonly #onDocumentClick = (event: MouseEvent) => {
    const anchor = this.#findNavigatingAnchor(event);
    if (!anchor) return;

    const currentHref = this.#current?.href ?? this.#window.location.href;
    const repeatIfUnchanged = new URL(anchor.href).href === currentHref;
    const generationAtClick = this.#generation;
    if (this.#linkCheckTimer !== null) this.#window.clearTimeout(this.#linkCheckTimer);
    this.#linkCheckTimer = this.#window.setTimeout(() => {
      this.#linkCheckTimer = null;
      this.#publish('link', repeatIfUnchanged && this.#generation === generationAtClick);
    }, 0);
  };

  #findNavigatingAnchor(event: MouseEvent): HTMLAnchorElement | null {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return null;
    }
    const target = event.target;
    if (!(target instanceof this.#window.Element)) return null;
    const anchor = target.closest('a[href]');
    if (
      !(anchor instanceof this.#window.HTMLAnchorElement) ||
      anchor.download.length > 0 ||
      (anchor.target.length > 0 && anchor.target !== '_self')
    ) {
      return null;
    }

    try {
      return new URL(anchor.href).origin === this.#window.location.origin ? anchor : null;
    } catch {
      return null;
    }
  }

  #publish(source: RouteChangeSource, forceRepeated = false): boolean {
    if (!this.#started) return false;
    const current = recognizeLinuxDoRoute(this.#window.location.href);
    const previous = this.#current;
    const repeated = previous?.href === current.href;
    if (repeated && !forceRepeated) return false;

    if (previous !== null) this.#generation += 1;
    this.#current = current;
    const change: LinuxDoRouteChange = {
      current,
      generation: this.#generation,
      previous,
      repeated,
      source,
    };
    for (const subscriber of this.#subscribers) subscriber(change);
    return true;
  }
}
