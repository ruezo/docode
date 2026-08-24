import vscodeFaviconPng from '../../assets/vscode-favicon.png?inline';
import type { LinuxDoRoute } from '../linuxdo/routes';

export const VSCODE_FAVICON_DATA_URI: string = vscodeFaviconPng;

const DISGUISED_TITLE_SUFFIX = ' - docode - Visual Studio Code';
const DEFAULT_FILE_NAME = 'LinuxDo';
const FAVICON_LINK_SELECTOR = 'link[rel~="icon" i]';
const NATIVE_UNREAD_PREFIX_PATTERN = /^\(\d+\)\s*/u;
const NATIVE_SITE_SUFFIX_PATTERN = /\s*-\s*LINUX DO\s*$/iu;

export class TabDisguise {
  readonly #document: Document;
  readonly #nativeIconHrefs = new Map<HTMLLinkElement, string>();
  #nativeTitle: string;
  #observer: MutationObserver | null = null;
  #route: LinuxDoRoute | null;

  constructor(document: Document, initialRoute: LinuxDoRoute | null) {
    this.#document = document;
    this.#nativeTitle = document.title;
    this.#route = initialRoute;
  }

  get isStarted(): boolean {
    return this.#observer !== null;
  }

  start(): boolean {
    if (this.#observer || !this.#document.defaultView) return false;
    this.#observer = new this.#document.defaultView.MutationObserver(() => {
      this.#apply();
    });
    this.#observer.observe(this.#document.head, {
      attributeFilter: ['href', 'rel'],
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true,
    });
    this.#apply();
    return true;
  }

  updateRoute(route: LinuxDoRoute | null): void {
    this.#route = route;
    if (this.#observer) this.#apply();
  }

  stop(): boolean {
    if (!this.#observer) return false;
    this.#observer.disconnect();
    this.#observer = null;
    for (const link of this.#iconLinks()) {
      if (link.getAttribute('href') !== VSCODE_FAVICON_DATA_URI) continue;
      const nativeHref = this.#nativeIconHrefs.get(link);
      if (nativeHref !== undefined) link.setAttribute('href', nativeHref);
    }
    this.#nativeIconHrefs.clear();
    if (this.#document.title.endsWith(DISGUISED_TITLE_SUFFIX)) {
      this.#document.title = this.#nativeTitle;
    }
    return true;
  }

  #apply(): void {
    if (!this.#observer) return;
    const currentTitle = this.#document.title;
    if (!currentTitle.endsWith(DISGUISED_TITLE_SUFFIX)) this.#nativeTitle = currentTitle;
    const disguisedTitle = this.#disguisedTitle();
    if (currentTitle !== disguisedTitle) this.#document.title = disguisedTitle;
    for (const link of this.#iconLinks()) {
      const href = link.getAttribute('href');
      if (href === VSCODE_FAVICON_DATA_URI) continue;
      if (href !== null) this.#nativeIconHrefs.set(link, href);
      link.setAttribute('href', VSCODE_FAVICON_DATA_URI);
    }
  }

  #disguisedTitle(): string {
    const fileName = this.#route?.kind === 'topic' ? this.#topicFileName() : DEFAULT_FILE_NAME;
    return `${fileName}.java${DISGUISED_TITLE_SUFFIX}`;
  }

  #topicFileName(): string {
    const subject = this.#nativeTitle
      .replace(NATIVE_UNREAD_PREFIX_PATTERN, '')
      .replace(NATIVE_SITE_SUFFIX_PATTERN, '')
      .trim();
    return subject === '' || /^LINUX DO$/iu.test(subject) ? DEFAULT_FILE_NAME : subject;
  }

  #iconLinks(): readonly HTMLLinkElement[] {
    return [...this.#document.head.querySelectorAll<HTMLLinkElement>(FAVICON_LINK_SELECTOR)];
  }
}
