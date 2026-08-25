import {
  detectLinuxDoComposerCapability,
  detectLinuxDoCapabilities,
  detectLinuxDoPostReplyCapability,
  type ComposerCapability,
  type NativeActionCapability,
} from './capabilities';
import { TOPIC_REPLY_SHORTCUT_EVENT, dispatchTopicReplyShortcutKeys } from './pageBridge';
import { recognizeLinuxDoRoute, type LinuxDoRoute } from './routes';

export type LinuxDoComposerFailureCode =
  | 'action-in-progress'
  | 'aborted'
  | 'authentication-required'
  | 'confirmation-timeout'
  | 'invalid-content'
  | 'native-control-disabled'
  | 'native-control-not-found'
  | 'native-dispatch-failed'
  | 'stale-route';

export type LinuxDoComposerOpenOutcome =
  | { readonly dirty: boolean; readonly kind: 'opened' | 'unchanged' }
  | {
      readonly code: LinuxDoComposerFailureCode;
      readonly kind: 'failed';
      readonly message: string;
      readonly retryable: boolean;
    };

export interface LinuxDoComposerOpenRequest {
  readonly expectedGeneration: number;
  readonly postNumber?: number;
  readonly signal?: AbortSignal;
}

export interface LinuxDoComposerSubmitRequest extends LinuxDoComposerOpenRequest {
  readonly content: string;
}

export type LinuxDoComposerSubmitOutcome =
  | { readonly kind: 'submitted'; readonly postNumber: number | null }
  | {
      readonly code: LinuxDoComposerFailureCode;
      readonly kind: 'failed';
      readonly message: string;
      readonly retryable: boolean;
    };

export type LinuxDoComposerFeedback =
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'opening'; readonly message: string }
  | { readonly kind: 'submitted'; readonly message: string }
  | { readonly kind: 'submitting'; readonly message: string }
  | null;

export interface LinuxDoComposerSnapshot {
  readonly capability: ComposerCapability | null;
  readonly feedback: LinuxDoComposerFeedback;
}

interface ComposerAdapterOptions {
  readonly confirmationTimeoutMs?: number;
}

interface PendingSubmit {
  readonly baselinePostIds: ReadonlySet<number>;
  responseConfirmed: boolean;
  readonly timeout: number;
}

const DEFAULT_CONFIRMATION_TIMEOUT_MS = 12_000;

export class LinuxDoComposerAdapter {
  readonly #confirmationTimeoutMs: number;
  readonly #document: Document;
  readonly #listeners = new Set<(snapshot: LinuxDoComposerSnapshot) => void>();
  #currentGeneration: number;
  #currentRoute: LinuxDoRoute;
  #disposed = false;
  #feedback: LinuxDoComposerFeedback = null;
  #lastSignature = '';
  #observer: MutationObserver | null = null;
  #openInProgress = false;
  #submitInProgress = false;
  #observedRoot: HTMLElement | null = null;
  #pendingSubmit: PendingSubmit | null = null;
  #performanceObserver: PerformanceObserver | null = null;
  #routeController = new AbortController();
  #started = false;

  constructor(
    document: Document,
    initialRoute: LinuxDoRoute,
    initialGeneration = 0,
    options: ComposerAdapterOptions = {},
  ) {
    this.#document = document;
    this.#currentRoute = initialRoute;
    this.#currentGeneration = initialGeneration;
    this.#confirmationTimeoutMs = options.confirmationTimeoutMs ?? DEFAULT_CONFIRMATION_TIMEOUT_MS;
  }

  get snapshot(): LinuxDoComposerSnapshot {
    return { capability: this.#detectComposer(), feedback: this.#feedback };
  }

  start(): boolean {
    if (this.#started || this.#disposed) return false;
    this.#started = true;
    this.#document.addEventListener('click', this.#onClick, true);
    this.#document.addEventListener('input', this.#onInput, true);
    this.#document.addEventListener('keydown', this.#onKeyDown, true);
    this.refresh();
    return true;
  }

  subscribe(listener: (snapshot: LinuxDoComposerSnapshot) => void): () => void {
    if (this.#disposed) return () => undefined;
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  refresh(): LinuxDoComposerSnapshot {
    this.#bindRoot(this.#detectComposer()?.root ?? null);
    return this.snapshot;
  }

  observe(route: LinuxDoRoute, generation: number): void {
    if (this.#disposed) return;
    const requestContextChanged =
      route.href !== this.#currentRoute.href || generation !== this.#currentGeneration;
    const topicChanged = !sameTopic(route, this.#currentRoute);
    this.#currentRoute = route;
    this.#currentGeneration = generation;
    if (requestContextChanged) {
      this.#routeController.abort('stale-route');
      this.#routeController = new AbortController();
    }
    if (topicChanged) {
      this.#finishSubmit(null);
      this.#feedback = null;
    }
    this.refresh();
    this.#emitIfChanged();
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#routeController.abort('disposed');
    this.#finishSubmit(null);
    this.#observer?.disconnect();
    this.#observer = null;
    this.#observedRoot = null;
    if (this.#started) {
      this.#document.removeEventListener('click', this.#onClick, true);
      this.#document.removeEventListener('input', this.#onInput, true);
      this.#document.removeEventListener('keydown', this.#onKeyDown, true);
    }
    this.#listeners.clear();
  }

  async open(request: LinuxDoComposerOpenRequest): Promise<LinuxDoComposerOpenOutcome> {
    const requestFailure = this.#validateRequest(request);
    if (requestFailure) return requestFailure;
    if (this.#openInProgress) {
      return failed('action-in-progress', 'Linux DO is already opening the Reply composer.', true);
    }
    this.#openInProgress = true;
    try {
      return await this.#open(request);
    } finally {
      this.#openInProgress = false;
    }
  }

  async submit(request: LinuxDoComposerSubmitRequest): Promise<LinuxDoComposerSubmitOutcome> {
    const requestFailure = this.#validateRequest(request);
    if (requestFailure) return requestFailure;
    const content = request.content.trim();
    if (!content || content.length > 32_000 || content.includes('\u0000')) {
      return failed(
        'invalid-content',
        'Reply content must contain 1 to 32,000 safe characters.',
        false,
      );
    }
    if (this.#submitInProgress) {
      return failed('action-in-progress', 'Linux DO is already submitting a reply.', true);
    }
    this.#submitInProgress = true;
    try {
      const opened = await this.open(request);
      if (opened.kind === 'failed') return opened;
      const composer = this.#detectComposer();
      if (
        composer?.state !== 'open' ||
        !composer.editor?.isConnected ||
        !composer.submitControl?.isConnected
      ) {
        return failed(
          'native-control-not-found',
          'Linux DO did not expose a writable native Reply composer.',
          true,
        );
      }
      if (composer.dirty && getComposerEditorValue(composer.editor).trim() !== content) {
        return failed(
          'action-in-progress',
          'The native Linux DO composer already contains a draft. It was left unchanged.',
          false,
        );
      }
      if (!setComposerEditorValue(composer.editor, content)) {
        return failed(
          'native-dispatch-failed',
          'Linux DO did not accept content in the native Reply composer.',
          true,
        );
      }
      const confirmation = this.#waitForSubmit(request);
      try {
        composer.submitControl.click();
      } catch {
        confirmation.cancel();
        return failed(
          'native-dispatch-failed',
          'Linux DO rejected the native Reply submission.',
          true,
        );
      }
      return await confirmation.outcome;
    } finally {
      this.#submitInProgress = false;
    }
  }

  async #open(request: LinuxDoComposerOpenRequest): Promise<LinuxDoComposerOpenOutcome> {
    const detection = detectLinuxDoCapabilities(this.#document, this.#currentRoute);
    if (detection.state !== 'ready') return unavailableComposer(null, null);
    const composer = detection.composer;
    const reply = request.postNumber
      ? detectLinuxDoPostReplyCapability(this.#document, this.#currentRoute, request.postNumber)
      : detection.reply;
    if (composer.state === 'open' || composer.state === 'draft') {
      if (request.postNumber) {
        return failed(
          'action-in-progress',
          'Close or submit the current draft before replying to a specific post.',
          false,
        );
      }
      if (composer.state === 'draft') {
        return this.#dispatchOpen(request, composer, reply, composer.root);
      }
      focusComposerEditor(composer);
      return { dirty: composer.dirty, kind: 'unchanged' };
    }
    if (composer.state === 'saving') {
      return failed('native-control-disabled', 'Linux DO is already submitting this reply.', false);
    }
    if (composer.state !== 'closed') return unavailableComposer(composer, reply);
    if (reply.state !== 'available' || (request.postNumber && !reply.control)) {
      return unavailableComposer(composer, reply);
    }
    return this.#dispatchOpen(request, composer, reply, reply.control);
  }

  async #dispatchOpen(
    request: LinuxDoComposerOpenRequest,
    composer: ComposerCapability,
    reply: NativeActionCapability,
    control: HTMLElement | null,
  ): Promise<LinuxDoComposerOpenOutcome> {
    const topicShortcut =
      !request.postNumber && (!control || control.matches('.post-action-menu__reply'));
    if (!composer.root?.isConnected || (!topicShortcut && !control?.isConnected)) {
      return failed(
        'native-control-not-found',
        'Linux DO did not expose a connected Reply control.',
        true,
      );
    }
    if (reply.state === 'authentication-required') return unavailableComposer(composer, reply);
    if (reply.state === 'disabled') return unavailableComposer(composer, reply);

    const confirmation = this.#waitForOpen(request, composer.root);
    this.#setFeedback({ kind: 'opening', message: 'Opening the Linux DO composer…' });
    try {
      if (topicShortcut) {
        dispatchTopicReplyShortcut(this.#document);
      } else if (control) {
        control.click();
      }
    } catch {
      confirmation.cancel();
      this.#setFeedback({ kind: 'error', message: 'Linux DO rejected the Reply action.' });
      return failed(
        'native-dispatch-failed',
        'Linux DO rejected the Reply action before the composer could open.',
        true,
      );
    }
    const outcome = await confirmation.outcome;
    this.#setFeedback(
      outcome.kind === 'failed' ? { kind: 'error', message: outcome.message } : null,
    );
    return outcome;
  }

  #waitForOpen(
    request: LinuxDoComposerOpenRequest,
    root: HTMLElement,
  ): {
    readonly cancel: () => void;
    readonly outcome: Promise<LinuxDoComposerOpenOutcome>;
  } {
    const window = this.#document.defaultView;
    if (!window) {
      return {
        cancel: () => undefined,
        outcome: Promise.resolve(
          failed('native-dispatch-failed', 'Linux DO composer confirmation is unavailable.', true),
        ),
      };
    }
    const routeSignal = this.#routeController.signal;
    let compatibilityTimeout: number | null = null;
    let finish: ((outcome: LinuxDoComposerOpenOutcome) => void) | null = null;
    const observer = new window.MutationObserver(() => {
      evaluate();
    });
    const timeout = window.setTimeout(() => {
      resolve(
        failed('confirmation-timeout', 'Linux DO did not confirm that the composer opened.', true),
      );
    }, this.#confirmationTimeoutMs);
    const cleanup = () => {
      observer.disconnect();
      if (compatibilityTimeout !== null) window.clearTimeout(compatibilityTimeout);
      window.clearTimeout(timeout);
      request.signal?.removeEventListener('abort', onAbort);
      routeSignal.removeEventListener('abort', onRouteAbort);
    };
    const resolve = (outcome: LinuxDoComposerOpenOutcome) => {
      if (!finish) return;
      const complete = finish;
      finish = null;
      cleanup();
      complete(outcome);
    };
    const onAbort = () => {
      resolve(failed('aborted', 'The Reply action was cancelled.', true));
    };
    const onRouteAbort = () => {
      resolve(
        failed(
          routeSignal.reason === 'stale-route' ? 'stale-route' : 'aborted',
          routeSignal.reason === 'stale-route'
            ? 'The topic changed before Linux DO opened the composer.'
            : 'The Reply action was cancelled.',
          true,
        ),
      );
    };
    const evaluate = () => {
      const invalid = this.#validateRequest(request);
      if (invalid) {
        resolve(invalid);
        return;
      }
      const current = this.#detectComposer();
      if (!root.isConnected) {
        resolve(
          failed(
            'native-control-not-found',
            'Linux DO removed the compatible Reply composer before it opened.',
            true,
          ),
        );
        return;
      }
      if (
        !current ||
        current.state === 'unavailable' ||
        current.state === 'authentication-required'
      ) {
        compatibilityTimeout ??= window.setTimeout(
          () => {
            compatibilityTimeout = null;
            const latest = this.#detectComposer();
            if (!latest || latest.state === 'unavailable') {
              resolve(
                failed(
                  'native-control-not-found',
                  'Linux DO removed the compatible Reply composer before it opened.',
                  true,
                ),
              );
            } else if (latest.state === 'authentication-required') {
              resolve(failed('authentication-required', 'Sign in to Linux DO to reply.', false));
            } else {
              evaluate();
            }
          },
          Math.min(150, Math.max(1, this.#confirmationTimeoutMs / 2)),
        );
        return;
      }
      if (compatibilityTimeout !== null) {
        window.clearTimeout(compatibilityTimeout);
        compatibilityTimeout = null;
      }
      if (current.state !== 'open') return;
      focusComposerEditor(current);
      resolve({ dirty: current.dirty, kind: 'opened' });
    };
    const outcome = new Promise<LinuxDoComposerOpenOutcome>((complete) => {
      finish = complete;
      request.signal?.addEventListener('abort', onAbort, { once: true });
      routeSignal.addEventListener('abort', onRouteAbort, { once: true });
      observer.observe(root, { attributes: true, childList: true, subtree: true });
      evaluate();
    });
    return {
      cancel: () => {
        resolve(failed('aborted', 'The Reply action was cancelled.', true));
      },
      outcome,
    };
  }

  #waitForSubmit(request: LinuxDoComposerSubmitRequest): {
    readonly cancel: () => void;
    readonly outcome: Promise<LinuxDoComposerSubmitOutcome>;
  } {
    const window = this.#document.defaultView;
    if (!window) {
      return {
        cancel: () => undefined,
        outcome: Promise.resolve(
          failed('native-dispatch-failed', 'Linux DO Reply confirmation is unavailable.', true),
        ),
      };
    }
    const routeSignal = this.#routeController.signal;
    let finish: ((outcome: LinuxDoComposerSubmitOutcome) => void) | null = null;
    const listener = ({ feedback }: LinuxDoComposerSnapshot) => {
      if (feedback?.kind === 'submitted') {
        resolve({ kind: 'submitted', postNumber: request.postNumber ?? null });
      } else if (feedback?.kind === 'error') {
        resolve(failed('native-dispatch-failed', feedback.message, true));
      }
    };
    const timeout = window.setTimeout(() => {
      resolve(
        failed(
          'confirmation-timeout',
          'Linux DO did not confirm the native Reply submission.',
          true,
        ),
      );
    }, this.#confirmationTimeoutMs + 100);
    const cleanup = () => {
      window.clearTimeout(timeout);
      this.#listeners.delete(listener);
      request.signal?.removeEventListener('abort', onAbort);
      routeSignal.removeEventListener('abort', onRouteAbort);
    };
    const resolve = (outcome: LinuxDoComposerSubmitOutcome) => {
      if (!finish) return;
      const complete = finish;
      finish = null;
      cleanup();
      complete(outcome);
    };
    const onAbort = () => {
      resolve(failed('aborted', 'The Reply submission was cancelled.', true));
    };
    const onRouteAbort = () => {
      resolve(
        failed(
          routeSignal.reason === 'stale-route' ? 'stale-route' : 'aborted',
          routeSignal.reason === 'stale-route'
            ? 'The topic changed before Linux DO confirmed the reply.'
            : 'The Reply submission was cancelled.',
          true,
        ),
      );
    };
    const outcome = new Promise<LinuxDoComposerSubmitOutcome>((complete) => {
      finish = complete;
      this.#listeners.add(listener);
      request.signal?.addEventListener('abort', onAbort, { once: true });
      routeSignal.addEventListener('abort', onRouteAbort, { once: true });
    });
    return {
      cancel: () => {
        resolve(failed('aborted', 'The Reply submission was cancelled.', true));
      },
      outcome,
    };
  }

  readonly #onClick = (event: MouseEvent) => {
    const capability = this.#detectComposer();
    const target = toElement(event.target);
    if (!capability?.root || !target || !capability.root.contains(target)) return;
    if (capability.submitControl?.contains(target)) this.#beginSubmit(capability);
    else if (capability.cancelControl?.contains(target)) {
      this.#document.defaultView?.queueMicrotask(() => {
        this.#emitIfChanged();
      });
    }
  };

  readonly #onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' || (!event.ctrlKey && !event.metaKey)) return;
    const capability = this.#detectComposer();
    const target = toElement(event.target);
    if (!capability?.root || !target || !capability.root.contains(target)) return;
    this.#beginSubmit(capability);
  };

  readonly #onInput = (event: Event) => {
    const capability = this.#detectComposer();
    const target = toElement(event.target);
    if (!capability?.root || !target || !capability.root.contains(target)) return;
    if (this.#feedback?.kind === 'error' || this.#feedback?.kind === 'submitted') {
      this.#feedback = null;
    }
    this.#emitIfChanged();
  };

  #beginSubmit(capability: ComposerCapability): void {
    if (this.#pendingSubmit || capability.state !== 'open') return;
    const window = this.#document.defaultView;
    if (!window) return;
    const baselinePostIds = new Set(this.#detectPostIds());
    const timeout = window.setTimeout(() => {
      if (!this.#pendingSubmit) return;
      if (this.#hasNewPost(this.#pendingSubmit) && this.#detectComposer()?.state === 'closed') {
        this.#finishSubmit({ kind: 'submitted', message: 'Reply confirmed by Linux DO.' });
        return;
      }
      this.#finishSubmit({
        kind: 'error',
        message:
          'Linux DO did not confirm the reply result. The native draft remains authoritative.',
      });
    }, this.#confirmationTimeoutMs);
    this.#pendingSubmit = { baselinePostIds, responseConfirmed: false, timeout };
    this.#setFeedback({ kind: 'submitting', message: 'Submitting through Linux DO…' });
    this.#startPerformanceObserver();
    window.setTimeout(() => {
      this.#evaluateSubmit();
    }, 0);
  }

  #startPerformanceObserver(): void {
    const window = this.#document.defaultView;
    const Constructor = window?.PerformanceObserver;
    if (!window || typeof Constructor !== 'function') return;
    try {
      this.#performanceObserver = new Constructor((entries) => {
        const response = entries
          .getEntries()
          .find((entry) => isCreatePostResponse(entry, this.#document));
        if (!response || !this.#pendingSubmit) return;
        const responseStatus: unknown = Reflect.get(response, 'responseStatus');
        if (typeof responseStatus === 'number' && responseStatus >= 400) {
          this.#finishSubmit({
            kind: 'error',
            message: 'Linux DO rejected the reply. The native draft remains open.',
          });
          return;
        }
        if (typeof responseStatus === 'number' && responseStatus >= 200) {
          this.#pendingSubmit.responseConfirmed = true;
          this.#evaluateSubmit();
        }
      });
      this.#performanceObserver.observe({ entryTypes: ['resource'] });
    } catch {
      this.#performanceObserver = null;
    }
  }

  #evaluateSubmit(): void {
    const pending = this.#pendingSubmit;
    if (!pending) return;
    const capability = this.#detectComposer();
    if (capability?.errorMessage) {
      this.#finishSubmit({ kind: 'error', message: capability.errorMessage });
      return;
    }
    if (
      capability?.state === 'closed' &&
      (pending.responseConfirmed || this.#hasNewPost(pending))
    ) {
      this.#finishSubmit({ kind: 'submitted', message: 'Reply confirmed by Linux DO.' });
    }
  }

  #finishSubmit(feedback: LinuxDoComposerFeedback): void {
    const pending = this.#pendingSubmit;
    if (pending) this.#document.defaultView?.clearTimeout(pending.timeout);
    this.#pendingSubmit = null;
    this.#performanceObserver?.disconnect();
    this.#performanceObserver = null;
    if (feedback !== null) this.#setFeedback(feedback);
  }

  #hasNewPost(pending: PendingSubmit): boolean {
    return this.#detectPostIds().some((postId) => !pending.baselinePostIds.has(postId));
  }

  #detectPostIds(): number[] {
    const detection = detectLinuxDoCapabilities(this.#document, this.#currentRoute);
    return detection.state === 'ready' ? detection.posts.map(({ postId }) => postId) : [];
  }

  #detectComposer(): ComposerCapability | null {
    return detectLinuxDoComposerCapability(this.#document, this.#currentRoute);
  }

  #bindRoot(root: HTMLElement | null): void {
    if (root === this.#observedRoot) return;
    this.#observer?.disconnect();
    this.#observer = null;
    this.#observedRoot = root;
    const window = this.#document.defaultView;
    if (!root || !window || !this.#started) return;
    this.#observer = new window.MutationObserver(() => {
      this.#evaluateSubmit();
      this.#emitIfChanged();
    });
    this.#observer.observe(root, {
      attributeFilter: ['aria-disabled', 'class', 'disabled', 'hidden'],
      attributes: true,
      childList: true,
      subtree: true,
    });
  }

  #setFeedback(feedback: LinuxDoComposerFeedback): void {
    this.#feedback = feedback;
    this.#emitIfChanged(true);
  }

  #emitIfChanged(force = false): void {
    if (this.#disposed) return;
    const snapshot = this.snapshot;
    const signature = composerSignature(snapshot);
    if (!force && signature === this.#lastSignature) return;
    this.#lastSignature = signature;
    for (const listener of this.#listeners) listener(snapshot);
  }

  #validateRequest(
    request: LinuxDoComposerOpenRequest,
  ): Extract<LinuxDoComposerOpenOutcome, { readonly kind: 'failed' }> | null {
    if (request.signal?.aborted || this.#disposed) {
      return failed('aborted', 'The Reply action was cancelled.', true);
    }
    if (
      request.expectedGeneration !== this.#currentGeneration ||
      this.#currentRoute.kind !== 'topic' ||
      !sameTopic(this.#currentRoute, recognizeLinuxDoRoute(this.#document.location.href))
    ) {
      return failed('stale-route', 'The topic changed before the Reply action could start.', true);
    }
    return null;
  }
}

function unavailableComposer(
  composer: ComposerCapability | null,
  reply: NativeActionCapability | null,
): LinuxDoComposerOpenOutcome {
  if (composer?.state === 'authentication-required' || reply?.state === 'authentication-required') {
    return failed('authentication-required', 'Sign in to Linux DO to reply to this topic.', false);
  }
  if (reply?.state === 'disabled') {
    return failed(
      'native-control-disabled',
      'Linux DO has disabled replies for this topic.',
      false,
    );
  }
  return failed(
    'native-control-not-found',
    'Linux DO did not expose a compatible Reply composer.',
    true,
  );
}

function failed(
  code: LinuxDoComposerFailureCode,
  message: string,
  retryable: boolean,
): Extract<LinuxDoComposerOpenOutcome, { readonly kind: 'failed' }> {
  return { code, kind: 'failed', message, retryable };
}

function focusComposerEditor(capability: ComposerCapability): void {
  capability.editor?.focus();
}

function setComposerEditorValue(editor: HTMLElement, value: string): boolean {
  const window = editor.ownerDocument.defaultView;
  if (!window) return false;
  const TextArea = window.HTMLTextAreaElement;
  const Input = window.HTMLInputElement;
  if (editor instanceof TextArea || editor instanceof Input) {
    if (!Reflect.set(editor, 'value', value)) return false;
  } else if (editor.isContentEditable) {
    editor.textContent = value;
  } else {
    return false;
  }
  const InputEventConstructor: unknown = Reflect.get(window, 'InputEvent');
  const inputEvent =
    typeof InputEventConstructor === 'function'
      ? (Reflect.construct(InputEventConstructor, ['input', { bubbles: true }]) as Event)
      : new window.Event('input', { bubbles: true });
  editor.dispatchEvent(inputEvent);
  return getComposerEditorValue(editor).trim().length > 0;
}

function getComposerEditorValue(editor: HTMLElement): string {
  const window = editor.ownerDocument.defaultView;
  if (!window) return '';
  if (editor instanceof window.HTMLTextAreaElement || editor instanceof window.HTMLInputElement) {
    return editor.value;
  }
  return editor.textContent;
}

function dispatchTopicReplyShortcut(document: Document): void {
  dispatchTopicReplyShortcutKeys(document);
  document.dispatchEvent(new CustomEvent(TOPIC_REPLY_SHORTCUT_EVENT));
}

function sameTopic(left: LinuxDoRoute, right: LinuxDoRoute): boolean {
  return left.kind === 'topic' && right.kind === 'topic' && left.topicId === right.topicId;
}

function toElement(target: EventTarget | null): Element | null {
  const node = target as Node | null;
  const Constructor = node?.ownerDocument?.defaultView?.Element;
  return Constructor && node instanceof Constructor ? node : null;
}

function isCreatePostResponse(entry: PerformanceEntry, document: Document): boolean {
  if (entry.entryType !== 'resource') return false;
  try {
    const url = new URL(entry.name, document.location.href);
    return (
      url.origin === document.location.origin &&
      (url.pathname === '/posts' || url.pathname === '/posts.json')
    );
  } catch {
    return false;
  }
}

function composerSignature(snapshot: LinuxDoComposerSnapshot): string {
  const capability = snapshot.capability;
  return JSON.stringify([
    capability?.state ?? null,
    capability?.dirty ?? false,
    capability?.errorMessage ?? null,
    capability?.fullscreen ?? false,
    capability?.topicId ?? null,
    snapshot.feedback?.kind ?? null,
    snapshot.feedback?.message ?? null,
  ]);
}
