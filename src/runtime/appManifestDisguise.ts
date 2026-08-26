const MANIFEST_LINK_SELECTOR = 'link[rel~="manifest" i]';
const INJECTED_MANIFEST_ATTRIBUTE = 'data-docode-app-manifest';

let activeAppManifestDisguise: AppManifestDisguise | null = null;
let configuredManifestHref: string | null = null;

export function configureAppManifestDisguise(manifestHref: string): void {
  configuredManifestHref = manifestHref;
}

export function startAppManifestDisguise(document: Document): void {
  if (!configuredManifestHref || activeAppManifestDisguise?.isStarted) return;
  activeAppManifestDisguise = new AppManifestDisguise(document, configuredManifestHref);
  activeAppManifestDisguise.start();
}

export function stopAppManifestDisguise(): void {
  activeAppManifestDisguise?.stop();
  activeAppManifestDisguise = null;
}

interface NativeManifestLinkState {
  readonly crossOrigin: string | null;
  readonly href: string | null;
}

export class AppManifestDisguise {
  readonly #document: Document;
  readonly #manifestHref: string;
  readonly #nativeLinkStates = new Map<HTMLLinkElement, NativeManifestLinkState>();
  #injectedLink: HTMLLinkElement | null = null;
  #observedHead = false;
  #observer: MutationObserver | null = null;

  constructor(document: Document, manifestHref: string) {
    this.#document = document;
    this.#manifestHref = manifestHref;
  }

  get isStarted(): boolean {
    return this.#observer !== null;
  }

  start(): boolean {
    if (this.#observer || !this.#document.defaultView) return false;
    this.#observer = new this.#document.defaultView.MutationObserver(() => {
      this.#observe();
      this.#apply();
    });
    this.#observe();
    this.#apply();
    return true;
  }

  stop(): boolean {
    if (!this.#observer) return false;
    this.#observer.disconnect();
    this.#observer = null;
    this.#observedHead = false;
    for (const link of this.#manifestLinks()) {
      if (link.getAttribute('href') !== this.#manifestHref) continue;
      const nativeState = this.#nativeLinkStates.get(link);
      if (!nativeState) continue;
      if (nativeState.href === null) link.removeAttribute('href');
      else link.setAttribute('href', nativeState.href);
      if (nativeState.crossOrigin === null) link.removeAttribute('crossorigin');
      else link.setAttribute('crossorigin', nativeState.crossOrigin);
    }
    this.#nativeLinkStates.clear();
    this.#injectedLink?.remove();
    this.#injectedLink = null;
    return true;
  }

  #observe(): void {
    if (!this.#observer) return;
    const head = this.#document.head as HTMLHeadElement | null;
    if (this.#observedHead || !head) {
      if (!head) {
        this.#observer.observe(this.#document.documentElement, { childList: true });
      }
      return;
    }
    this.#observer.disconnect();
    this.#observer.observe(head, {
      attributeFilter: ['href', 'rel'],
      attributes: true,
      childList: true,
      subtree: true,
    });
    this.#observedHead = true;
  }

  #apply(): void {
    if (!this.#observer || !(this.#document.head as HTMLHeadElement | null)) return;
    const nativeLinks = this.#manifestLinks().filter(
      (link) => !link.hasAttribute(INJECTED_MANIFEST_ATTRIBUTE),
    );
    for (const link of nativeLinks) {
      if (link.getAttribute('href') === this.#manifestHref) continue;
      if (!this.#nativeLinkStates.has(link)) {
        this.#nativeLinkStates.set(link, {
          crossOrigin: link.getAttribute('crossorigin'),
          href: link.getAttribute('href'),
        });
      }
      link.setAttribute('href', this.#manifestHref);
      link.removeAttribute('crossorigin');
    }
    if (nativeLinks.length > 0) {
      this.#injectedLink?.remove();
      this.#injectedLink = null;
      return;
    }
    if (this.#injectedLink?.isConnected) return;
    const link = this.#injectedLink ?? this.#document.createElement('link');
    link.setAttribute(INJECTED_MANIFEST_ATTRIBUTE, 'true');
    link.setAttribute('rel', 'manifest');
    link.setAttribute('href', this.#manifestHref);
    this.#document.head.append(link);
    this.#injectedLink = link;
  }

  #manifestLinks(): readonly HTMLLinkElement[] {
    return [...this.#document.head.querySelectorAll<HTMLLinkElement>(MANIFEST_LINK_SELECTOR)];
  }
}
