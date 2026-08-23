import { recognizeLinuxDoRoute, type LinuxDoRoute } from './routes';
import { DOCODE_PAGINATED_POST_ATTRIBUTE, DOCODE_TOPIC_SNAPSHOT_ATTRIBUTE } from './topicAdapter';

const CAPABILITY_SELECTORS = {
  composerCancel: '.discard-button',
  composerEditor: '.d-editor-input, textarea[aria-label], [contenteditable="true"]',
  composerError: '.popup-tip.bad:not(.hide), .draft-error, .alert-error',
  composerRoot: '#reply-control',
  composerSubmit: 'button.create',
  composerTarget: '.composer-actions-reply-target-link[href]',
  bookmark: '.post-action-menu__bookmark',
  copyLink: '.post-action-menu__copy-link',
  currentUser: '#current-user, .current-user',
  docodeOwnedRoot: `[data-docode-workbench-root], [${DOCODE_TOPIC_SNAPSHOT_ATTRIBUTE}]`,
  header: '.d-header',
  like: '.btn-toggle-reaction-like',
  likeRoot: '.discourse-reactions-actions',
  login: 'button.login-button',
  mainOutlet: '#main-outlet',
  postContainers: '[data-post-number]',
  posts: '.post-stream article[data-post-id], article[data-post-id]',
  postReply: '.post-action-menu__reply',
  reply: '#topic-footer-buttons button.create',
  showMore: '.post-action-menu__show-more',
} as const;

const CAPABILITY_MUTATION_SELECTOR = [
  CAPABILITY_SELECTORS.composerRoot,
  CAPABILITY_SELECTORS.bookmark,
  CAPABILITY_SELECTORS.copyLink,
  CAPABILITY_SELECTORS.currentUser,
  CAPABILITY_SELECTORS.like,
  CAPABILITY_SELECTORS.likeRoot,
  CAPABILITY_SELECTORS.login,
  CAPABILITY_SELECTORS.postContainers,
  CAPABILITY_SELECTORS.posts,
  CAPABILITY_SELECTORS.showMore,
  '.topic-footer-main-buttons',
].join(', ');
const DOCODE_OWNED_PAGINATION_SELECTOR = `[${DOCODE_PAGINATED_POST_ATTRIBUTE}]`;

export type CurrentUserState = 'logged-in' | 'logged-out' | 'unknown';
export type NativeActionState =
  'authentication-required' | 'available' | 'disabled' | 'unavailable';
export type ComposerState =
  'authentication-required' | 'closed' | 'draft' | 'open' | 'saving' | 'unavailable';
export type CapabilityFallback = 'native-login' | 'original-view' | null;
export type CapabilityDiagnosticCode =
  | 'authentication-required'
  | 'composer-not-found'
  | 'current-user-conflict'
  | 'current-user-unresolved'
  | 'native-control-disabled'
  | 'native-control-not-found'
  | 'post-identity-missing'
  | 'unsupported-route';
export type CapabilityFeature =
  'bookmark' | 'composer' | 'copy-link' | 'current-user' | 'like' | 'reply';

export interface CurrentUserCapability {
  readonly state: CurrentUserState;
  readonly username: string | null;
}

export interface NativeActionCapability {
  readonly active: boolean | null;
  readonly code: CapabilityDiagnosticCode | null;
  readonly control: HTMLElement | null;
  readonly fallback: CapabilityFallback;
  readonly revealControl: HTMLElement | null;
  readonly state: NativeActionState;
}

export interface ComposerCapability {
  readonly cancelControl: HTMLElement | null;
  readonly code: CapabilityDiagnosticCode | null;
  readonly dirty: boolean;
  readonly editor: HTMLElement | null;
  readonly errorMessage: string | null;
  readonly fallback: CapabilityFallback;
  readonly fullscreen: boolean;
  readonly root: HTMLElement | null;
  readonly state: ComposerState;
  readonly submitControl: HTMLElement | null;
  readonly topicId: number | null;
}

export interface PostCapabilities {
  readonly bookmark: NativeActionCapability;
  readonly copyLink: NativeActionCapability;
  readonly like: NativeActionCapability;
  readonly postId: number;
  readonly postNumber: number;
}

export interface CapabilityDiagnostic {
  readonly code: CapabilityDiagnosticCode;
  readonly feature: CapabilityFeature;
  readonly postNumber: number | null;
}

export type LinuxDoCapabilityDetection =
  | {
      readonly code: 'unsupported-route';
      readonly diagnostics: readonly [CapabilityDiagnostic];
      readonly state: 'unsupported';
    }
  | {
      readonly composer: ComposerCapability;
      readonly currentUser: CurrentUserCapability;
      readonly diagnostics: readonly CapabilityDiagnostic[];
      readonly posts: readonly PostCapabilities[];
      readonly reply: NativeActionCapability;
      readonly state: 'ready';
    };

export interface CapabilityStatusSummary {
  readonly availableBookmarkCount: number;
  readonly availableCopyLinkCount: number;
  readonly availableLikeCount: number;
  readonly composerState: ComposerState;
  readonly diagnosticCodes: readonly CapabilityDiagnosticCode[];
  readonly generation: number;
  readonly postCount: number;
  readonly replyState: NativeActionState;
  readonly state: LinuxDoCapabilityDetection['state'];
  readonly userState: CurrentUserState;
}

export function isLinuxDoComposerTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest(CAPABILITY_SELECTORS.composerRoot) !== null;
}

export function detectLinuxDoCapabilities(
  document: Document,
  route: LinuxDoRoute,
): LinuxDoCapabilityDetection {
  if (route.kind !== 'topic') {
    return {
      code: 'unsupported-route',
      diagnostics: [{ code: 'unsupported-route', feature: 'current-user', postNumber: null }],
      state: 'unsupported',
    };
  }

  const diagnostics: CapabilityDiagnostic[] = [];
  const currentUser = detectCurrentUser(document, diagnostics);
  const posts = extractPostCapabilities(document, currentUser, diagnostics);
  const reply = detectAuthenticatedAction(
    document.querySelector<HTMLButtonElement>(CAPABILITY_SELECTORS.reply),
    currentUser,
  );
  addDiagnostic(diagnostics, 'reply', reply.code, null);
  const composer = detectComposer(document, currentUser, reply);
  addDiagnostic(diagnostics, 'composer', composer.code, null);

  return { composer, currentUser, diagnostics, posts, reply, state: 'ready' };
}

export function detectLinuxDoComposerCapability(
  document: Document,
  route: LinuxDoRoute,
): ComposerCapability | null {
  if (route.kind !== 'topic') return null;
  const diagnostics: CapabilityDiagnostic[] = [];
  const currentUser = detectCurrentUser(document, diagnostics);
  const reply = detectAuthenticatedAction(
    document.querySelector<HTMLButtonElement>(CAPABILITY_SELECTORS.reply),
    currentUser,
  );
  return detectComposer(document, currentUser, reply);
}

export function detectLinuxDoCurrentUser(document: Document): CurrentUserCapability {
  return detectCurrentUser(document, []);
}

export function detectLinuxDoPostReplyCapability(
  document: Document,
  route: LinuxDoRoute,
  postNumber: number,
): NativeActionCapability {
  if (route.kind !== 'topic') return unavailablePublicAction();
  const currentUser = detectCurrentUser(document, []);
  const article = findNativePostArticle(document, postNumber);
  if (!article) return detectAuthenticatedAction(null, currentUser);
  const control = article.querySelector<HTMLElement>(CAPABILITY_SELECTORS.postReply);
  if (control || currentUser.state !== 'logged-in') {
    return detectAuthenticatedAction(control, currentUser);
  }
  const revealControl = article.querySelector<HTMLElement>(CAPABILITY_SELECTORS.showMore);
  const reveal = detectPublicAction(revealControl);
  return reveal.state === 'available'
    ? { ...reveal, active: null, control: null, revealControl }
    : reveal;
}

export function summarizeCapabilityDetection(
  detection: LinuxDoCapabilityDetection,
  generation: number,
): CapabilityStatusSummary {
  if (detection.state === 'unsupported') {
    return {
      availableBookmarkCount: 0,
      availableCopyLinkCount: 0,
      availableLikeCount: 0,
      composerState: 'unavailable',
      diagnosticCodes: ['unsupported-route'],
      generation,
      postCount: 0,
      replyState: 'unavailable',
      state: 'unsupported',
      userState: 'unknown',
    };
  }

  return {
    availableBookmarkCount: countAvailable(detection.posts, 'bookmark'),
    availableCopyLinkCount: countAvailable(detection.posts, 'copyLink'),
    availableLikeCount: countAvailable(detection.posts, 'like'),
    composerState: detection.composer.state,
    diagnosticCodes: [...new Set(detection.diagnostics.map(({ code }) => code))],
    generation,
    postCount: detection.posts.length,
    replyState: detection.reply.state,
    state: detection.state,
    userState: detection.currentUser.state,
  };
}

export class LinuxDoCapabilityObserver {
  readonly #document: Document;
  readonly #onChange: () => void;
  #observer: MutationObserver | null = null;
  #pending = false;
  #started = false;

  constructor(document: Document, onChange: () => void) {
    this.#document = document;
    this.#onChange = onChange;
  }

  get isStarted(): boolean {
    return this.#started;
  }

  start(): boolean {
    if (this.#started || !this.#document.defaultView) return false;
    const roots = this.#getObservationRoots();
    if (roots.length === 0) return false;

    this.#started = true;
    this.#observer = new this.#document.defaultView.MutationObserver(this.#onMutations);
    for (const root of roots) {
      this.#observer.observe(root, {
        attributeFilter: [
          'aria-disabled',
          'class',
          'data-post-id',
          'data-post-number',
          'data-username',
          'disabled',
          'hidden',
        ],
        attributes: true,
        childList: true,
        subtree: true,
      });
    }
    return true;
  }

  stop(): boolean {
    if (!this.#started) return false;
    this.#started = false;
    this.#pending = false;
    this.#observer?.disconnect();
    this.#observer = null;
    return true;
  }

  readonly #onMutations = (mutations: readonly MutationRecord[]) => {
    if (!this.#started || this.#pending || !mutations.some(isCapabilityMutation)) return;
    this.#pending = true;
    this.#document.defaultView?.queueMicrotask(() => {
      if (!this.#started || !this.#pending) return;
      this.#pending = false;
      this.#onChange();
    });
  };

  #getObservationRoots(): HTMLElement[] {
    const candidates = [
      this.#document.querySelector<HTMLElement>(CAPABILITY_SELECTORS.header),
      this.#document.querySelector<HTMLElement>(CAPABILITY_SELECTORS.mainOutlet),
      this.#document.querySelector<HTMLElement>(CAPABILITY_SELECTORS.composerRoot),
    ].filter((root): root is HTMLElement => root !== null);
    return candidates.filter(
      (candidate, index) =>
        !candidates.some(
          (possibleAncestor, ancestorIndex) =>
            ancestorIndex !== index && possibleAncestor.contains(candidate),
        ),
    );
  }
}

function detectCurrentUser(
  document: Document,
  diagnostics: CapabilityDiagnostic[],
): CurrentUserCapability {
  const loginControl = document.querySelector(CAPABILITY_SELECTORS.login);
  const currentUserRoot = document.querySelector<HTMLElement>(CAPABILITY_SELECTORS.currentUser);
  if (loginControl && currentUserRoot) {
    diagnostics.push({
      code: 'current-user-conflict',
      feature: 'current-user',
      postNumber: null,
    });
    return { state: 'unknown', username: null };
  }
  if (loginControl) return { state: 'logged-out', username: null };
  if (!currentUserRoot) {
    diagnostics.push({
      code: 'current-user-unresolved',
      feature: 'current-user',
      postNumber: null,
    });
    return { state: 'unknown', username: null };
  }

  return { state: 'logged-in', username: extractCurrentUsername(document, currentUserRoot) };
}

function extractCurrentUsername(document: Document, root: HTMLElement): string | null {
  const attributeUsername = normalizeUsername(root.getAttribute('data-username'));
  if (attributeUsername) return attributeUsername;
  const userLink = root.querySelector<HTMLAnchorElement>('a[href^="/u/"]');
  if (!userLink) return null;
  try {
    const route = recognizeLinuxDoRoute(new URL(userLink.href, document.location.href));
    return route.kind === 'user' ? route.username : null;
  } catch {
    return null;
  }
}

function extractPostCapabilities(
  document: Document,
  currentUser: CurrentUserCapability,
  diagnostics: CapabilityDiagnostic[],
): PostCapabilities[] {
  const posts: PostCapabilities[] = [];
  for (const article of document.querySelectorAll<HTMLElement>(CAPABILITY_SELECTORS.posts)) {
    if (article.closest(CAPABILITY_SELECTORS.docodeOwnedRoot)) continue;
    const postId = toPositiveInteger(article.getAttribute('data-post-id'));
    const postNumber = toPositiveInteger(
      article.closest<HTMLElement>('[data-post-number]')?.getAttribute('data-post-number') ?? null,
    );
    if (postId === null || postNumber === null) {
      diagnostics.push({
        code: 'post-identity-missing',
        feature: 'like',
        postNumber: null,
      });
      continue;
    }

    const like = detectLikeAction(article, currentUser);
    const bookmark = detectBookmarkAction(article, currentUser);
    const copyLink = detectPublicAction(
      article.querySelector<HTMLButtonElement>(CAPABILITY_SELECTORS.copyLink),
    );
    addDiagnostic(diagnostics, 'like', like.code, postNumber);
    addDiagnostic(diagnostics, 'bookmark', bookmark.code, postNumber);
    addDiagnostic(diagnostics, 'copy-link', copyLink.code, postNumber);
    posts.push({ bookmark, copyLink, like, postId, postNumber });
  }
  return posts;
}

function findNativePostArticle(document: Document, postNumber: number): HTMLElement | null {
  for (const article of document.querySelectorAll<HTMLElement>(CAPABILITY_SELECTORS.posts)) {
    if (article.closest(CAPABILITY_SELECTORS.docodeOwnedRoot)) continue;
    const number = toPositiveInteger(
      article
        .closest<HTMLElement>(CAPABILITY_SELECTORS.postContainers)
        ?.getAttribute('data-post-number') ?? null,
    );
    if (number === postNumber) return article;
  }
  return null;
}

function detectAuthenticatedAction(
  control: HTMLElement | null,
  currentUser: CurrentUserCapability,
  getActive: (control: HTMLElement) => boolean | null = () => null,
): NativeActionCapability {
  if (currentUser.state === 'logged-out') {
    return {
      active: null,
      code: 'authentication-required',
      control: null,
      fallback: 'native-login',
      revealControl: null,
      state: 'authentication-required',
    };
  }
  if (currentUser.state === 'unknown') {
    return {
      active: null,
      code: 'current-user-unresolved',
      control: null,
      fallback: 'original-view',
      revealControl: null,
      state: 'unavailable',
    };
  }
  return detectPublicAction(control, getActive);
}

function detectLikeAction(
  article: HTMLElement,
  currentUser: CurrentUserCapability,
): NativeActionCapability {
  const control = article.querySelector<HTMLElement>(CAPABILITY_SELECTORS.like);
  const capability = detectAuthenticatedAction(
    control,
    currentUser,
    (element) =>
      element
        .closest(CAPABILITY_SELECTORS.likeRoot)
        ?.classList.contains('has-used-main-reaction') === true,
  );
  if (capability.state !== 'available' || !capability.control) return capability;
  const root = capability.control.closest(CAPABILITY_SELECTORS.likeRoot);
  if (root?.classList.contains('can-toggle-reaction') !== false) return capability;
  return {
    active: capability.active,
    code: 'native-control-disabled',
    control: null,
    fallback: 'original-view',
    revealControl: null,
    state: 'disabled',
  };
}

function detectBookmarkAction(
  article: HTMLElement,
  currentUser: CurrentUserCapability,
): NativeActionCapability {
  const control = article.querySelector<HTMLElement>(CAPABILITY_SELECTORS.bookmark);
  if (control || currentUser.state !== 'logged-in') {
    return detectAuthenticatedAction(control, currentUser, (element) =>
      element.classList.contains('bookmarked'),
    );
  }
  const revealControl = article.querySelector<HTMLElement>(CAPABILITY_SELECTORS.showMore);
  const reveal = detectPublicAction(revealControl);
  return reveal.state === 'available'
    ? { ...reveal, active: null, control: null, revealControl }
    : reveal;
}

function detectPublicAction(
  control: HTMLElement | null,
  getActive: (control: HTMLElement) => boolean | null = () => null,
): NativeActionCapability {
  if (!control) {
    return {
      active: null,
      code: 'native-control-not-found',
      control: null,
      fallback: 'original-view',
      revealControl: null,
      state: 'unavailable',
    };
  }
  if (isDisabledControl(control)) {
    return {
      active: getActive(control),
      code: 'native-control-disabled',
      control: null,
      fallback: 'original-view',
      revealControl: null,
      state: 'disabled',
    };
  }
  return {
    active: getActive(control),
    code: null,
    control,
    fallback: null,
    revealControl: null,
    state: 'available',
  };
}

function unavailablePublicAction(): NativeActionCapability {
  return {
    active: null,
    code: 'native-control-not-found',
    control: null,
    fallback: 'original-view',
    revealControl: null,
    state: 'unavailable',
  };
}

function detectComposer(
  document: Document,
  currentUser: CurrentUserCapability,
  reply: NativeActionCapability,
): ComposerCapability {
  if (currentUser.state === 'logged-out') {
    return {
      cancelControl: null,
      code: 'authentication-required',
      dirty: false,
      editor: null,
      errorMessage: null,
      fallback: 'native-login',
      fullscreen: false,
      root: null,
      state: 'authentication-required',
      submitControl: null,
      topicId: null,
    };
  }
  if (currentUser.state === 'unknown') {
    return {
      cancelControl: null,
      code: 'current-user-unresolved',
      dirty: false,
      editor: null,
      errorMessage: null,
      fallback: 'original-view',
      fullscreen: false,
      root: null,
      state: 'unavailable',
      submitControl: null,
      topicId: null,
    };
  }

  const root = document.querySelector<HTMLElement>(CAPABILITY_SELECTORS.composerRoot);
  if (!root) {
    return {
      cancelControl: null,
      code: 'composer-not-found',
      dirty: false,
      editor: null,
      errorMessage: null,
      fallback: 'original-view',
      fullscreen: false,
      root: null,
      state: 'unavailable',
      submitControl: null,
      topicId: null,
    };
  }
  const editor = root.querySelector<HTMLElement>(CAPABILITY_SELECTORS.composerEditor);
  const state = detectComposerState(root, editor);
  const topicId = state === 'closed' ? null : detectComposerTopicId(document, root);
  const capability: ComposerCapability = {
    cancelControl: root.querySelector<HTMLElement>(CAPABILITY_SELECTORS.composerCancel),
    code: null,
    dirty:
      state === 'draft' || state === 'saving' || (state === 'open' && hasComposerDraft(editor)),
    editor,
    errorMessage: detectComposerError(root),
    fallback: null,
    fullscreen: root.classList.contains('fullscreen'),
    root,
    state,
    submitControl: root.querySelector<HTMLElement>(CAPABILITY_SELECTORS.composerSubmit),
    topicId,
  };
  if (state !== 'closed') return capability;
  if (reply.state === 'available') return capability;
  return {
    cancelControl: null,
    code: reply.code ?? 'native-control-not-found',
    dirty: false,
    editor: null,
    errorMessage: null,
    fallback: reply.fallback,
    fullscreen: false,
    root: null,
    state: 'unavailable',
    submitControl: null,
    topicId: null,
  };
}

function detectComposerState(root: HTMLElement, editor: HTMLElement | null): ComposerState {
  if (root.hidden || root.classList.contains('closed')) return 'closed';
  if (root.classList.contains('saving')) return 'saving';
  if (root.classList.contains('draft')) return 'draft';
  return root.classList.contains('open') || root.classList.contains('fullscreen') || editor
    ? 'open'
    : 'closed';
}

function detectComposerTopicId(document: Document, root: HTMLElement): number | null {
  const target = root.querySelector<HTMLAnchorElement>(CAPABILITY_SELECTORS.composerTarget);
  if (target) {
    try {
      const route = recognizeLinuxDoRoute(new URL(target.href, document.location.href));
      if (route.kind === 'topic') return route.topicId;
    } catch {
      return null;
    }
  }
  const current = recognizeLinuxDoRoute(document.location.href);
  return current.kind === 'topic' ? current.topicId : null;
}

function hasComposerDraft(editor: HTMLElement | null): boolean {
  if (!editor) return false;
  const TextAreaConstructor = editor.ownerDocument.defaultView?.HTMLTextAreaElement;
  const InputConstructor = editor.ownerDocument.defaultView?.HTMLInputElement;
  if (TextAreaConstructor && editor instanceof TextAreaConstructor) return editor.value.length > 0;
  if (InputConstructor && editor instanceof InputConstructor) return editor.value.length > 0;
  return editor.textContent.length > 0;
}

function detectComposerError(root: HTMLElement): string | null {
  for (const element of root.querySelectorAll<HTMLElement>(CAPABILITY_SELECTORS.composerError)) {
    if (
      element.hidden ||
      element.getAttribute('aria-hidden') === 'true' ||
      element.classList.contains('hide') ||
      element.classList.contains('hidden')
    ) {
      continue;
    }
    const text = element.textContent.replace(/\s+/gu, ' ').trim();
    if (text.length > 0) return text.slice(0, 240);
  }
  return null;
}

function isDisabledControl(control: HTMLElement): boolean {
  const ButtonConstructor = control.ownerDocument.defaultView?.HTMLButtonElement;
  const disabledButton = ButtonConstructor
    ? control instanceof ButtonConstructor && control.disabled
    : false;
  return (
    disabledButton ||
    control.hasAttribute('hidden') ||
    control.getAttribute('aria-disabled') === 'true' ||
    control.classList.contains('disabled')
  );
}

function addDiagnostic(
  diagnostics: CapabilityDiagnostic[],
  feature: CapabilityFeature,
  code: CapabilityDiagnosticCode | null,
  postNumber: number | null,
): void {
  if (code) diagnostics.push({ code, feature, postNumber });
}

function countAvailable(
  posts: readonly PostCapabilities[],
  feature: 'bookmark' | 'copyLink' | 'like',
): number {
  return posts.filter((post) => post[feature].state === 'available').length;
}

function isCapabilityMutation(mutation: MutationRecord): boolean {
  if (mutation.type === 'attributes') {
    const element = toElement(mutation.target);
    return (
      element?.closest(DOCODE_OWNED_PAGINATION_SELECTOR) === null &&
      element.matches(CAPABILITY_MUTATION_SELECTOR)
    );
  }
  return [...mutation.addedNodes, ...mutation.removedNodes].some((node) => {
    const element = toElement(node);
    return (
      element !== null &&
      element.closest(DOCODE_OWNED_PAGINATION_SELECTOR) === null &&
      (element.matches(CAPABILITY_MUTATION_SELECTOR) ||
        element.querySelector(CAPABILITY_MUTATION_SELECTOR) !== null)
    );
  });
}

function toElement(node: Node): Element | null {
  const ElementConstructor = node.ownerDocument?.defaultView?.Element;
  return ElementConstructor && node instanceof ElementConstructor ? node : null;
}

function normalizeUsername(value: string | null): string | null {
  const normalized = value?.trim() ?? '';
  return normalized.length > 0 ? normalized : null;
}

function toPositiveInteger(value: string | null): number | null {
  if (!value || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}
