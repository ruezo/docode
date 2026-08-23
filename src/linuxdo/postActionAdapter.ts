import { detectLinuxDoCapabilities, type NativeActionCapability } from './capabilities';
import { recognizeLinuxDoRoute, type LinuxDoRoute } from './routes';

export type LinuxDoPostAction = 'bookmark' | 'like';
export type LinuxDoPostActionFailureCode =
  | 'action-in-progress'
  | 'aborted'
  | 'authentication-required'
  | 'confirmation-timeout'
  | 'native-control-disabled'
  | 'native-control-not-found'
  | 'native-dispatch-failed'
  | 'stale-route';

export type LinuxDoPostActionOutcome =
  | {
      readonly action: LinuxDoPostAction;
      readonly active: boolean;
      readonly kind: 'confirmed';
    }
  | {
      readonly action: LinuxDoPostAction;
      readonly active: boolean;
      readonly kind: 'unchanged';
    }
  | {
      readonly action: LinuxDoPostAction;
      readonly code: LinuxDoPostActionFailureCode;
      readonly kind: 'failed';
      readonly message: string;
      readonly retryable: boolean;
    };

export interface LinuxDoPostActionRequest {
  readonly action: LinuxDoPostAction;
  readonly expectedGeneration: number;
  readonly postId: number;
  readonly postNumber: number;
  readonly signal?: AbortSignal;
}

interface LinuxDoPostActionAdapterOptions {
  readonly confirmationTimeoutMs?: number;
  readonly settleDelayMs?: number;
}

const DEFAULT_CONFIRMATION_TIMEOUT_MS = 8_000;
const DEFAULT_SETTLE_DELAY_MS = 600;

export class LinuxDoPostActionAdapter {
  readonly #confirmationTimeoutMs: number;
  readonly #document: Document;
  readonly #settleDelayMs: number;
  #currentGeneration: number;
  #currentRoute: LinuxDoRoute;
  #disposed = false;
  #pendingActions = new Set<string>();
  #routeController = new AbortController();

  constructor(
    document: Document,
    initialRoute: LinuxDoRoute,
    initialGeneration = 0,
    options: LinuxDoPostActionAdapterOptions = {},
  ) {
    this.#document = document;
    this.#currentRoute = initialRoute;
    this.#currentGeneration = initialGeneration;
    this.#confirmationTimeoutMs = options.confirmationTimeoutMs ?? DEFAULT_CONFIRMATION_TIMEOUT_MS;
    this.#settleDelayMs = options.settleDelayMs ?? DEFAULT_SETTLE_DELAY_MS;
  }

  observe(route: LinuxDoRoute, generation: number): void {
    if (this.#disposed) return;
    const changed =
      route.href !== this.#currentRoute.href || generation !== this.#currentGeneration;
    this.#currentRoute = route;
    this.#currentGeneration = generation;
    if (!changed) return;
    this.#routeController.abort('stale-route');
    this.#routeController = new AbortController();
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#routeController.abort('disposed');
  }

  async execute(request: LinuxDoPostActionRequest): Promise<LinuxDoPostActionOutcome> {
    const failure = this.#validateRequest(request);
    if (failure) return failure;

    const pendingKey = `${request.action}:${String(request.postId)}:${String(request.postNumber)}`;
    if (this.#pendingActions.has(pendingKey)) {
      return failed(
        request.action,
        'action-in-progress',
        `Linux DO is already processing ${request.action === 'like' ? 'Like' : 'Bookmark'} for this post.`,
        true,
      );
    }
    this.#pendingActions.add(pendingKey);
    try {
      return await this.#execute(request);
    } finally {
      this.#pendingActions.delete(pendingKey);
    }
  }

  async #execute(request: LinuxDoPostActionRequest): Promise<LinuxDoPostActionOutcome> {
    let capability = this.#findCapability(request);
    if (capability?.state !== 'available') {
      return unavailableOutcome(request.action, capability);
    }
    const routeSignal = this.#routeController.signal;
    if (!capability.control && request.action === 'bookmark' && capability.revealControl) {
      const revealed = await this.#revealBookmarkCapability(request, capability, routeSignal);
      if (revealed.kind === 'failed') return revealed.outcome;
      capability = revealed.capability;
    }
    if (!capability.control) return unavailableOutcome(request.action, capability);
    if (capability.active === null) {
      return failed(
        request.action,
        'native-control-not-found',
        'Linux DO did not expose a verifiable action state.',
        true,
      );
    }

    const expectedActive = request.action === 'bookmark' ? true : !capability.active;
    if (capability.active === expectedActive) {
      return { action: request.action, active: expectedActive, kind: 'unchanged' };
    }

    if (!capability.control.isConnected) {
      return failed(
        request.action,
        'native-control-not-found',
        'The Linux DO action control is no longer available.',
        true,
      );
    }

    const observationRoot = capability.control.closest<HTMLElement>('[data-post-number]');
    if (!observationRoot) {
      return failed(
        request.action,
        'native-control-not-found',
        'The Linux DO post action is no longer bound to its post.',
        true,
      );
    }
    const confirmation = this.#waitForConfirmation(
      request,
      expectedActive,
      routeSignal,
      observationRoot,
    );
    if (!confirmation.ready) return confirmation.outcome;
    try {
      capability.control.click();
    } catch {
      confirmation.cancel();
      return failed(
        request.action,
        'native-dispatch-failed',
        'Linux DO rejected the native action before it could start.',
        true,
      );
    }
    return confirmation.outcome;
  }

  #validateRequest(request: LinuxDoPostActionRequest): LinuxDoPostActionOutcome | null {
    if (request.signal?.aborted || this.#disposed) {
      return failed(request.action, 'aborted', 'The action was cancelled.', true);
    }
    if (
      request.expectedGeneration !== this.#currentGeneration ||
      this.#currentRoute.kind !== 'topic' ||
      !sameTopic(this.#currentRoute, recognizeLinuxDoRoute(this.#document.location.href))
    ) {
      return failed(
        request.action,
        'stale-route',
        'The topic changed before the Linux DO action could start.',
        true,
      );
    }
    return null;
  }

  #findCapability(request: LinuxDoPostActionRequest): NativeActionCapability | null {
    const detection = detectLinuxDoCapabilities(this.#document, this.#currentRoute);
    if (detection.state !== 'ready') return null;
    const post = detection.posts.find(
      ({ postId, postNumber }) => postId === request.postId && postNumber === request.postNumber,
    );
    return post?.[request.action] ?? null;
  }

  async #revealBookmarkCapability(
    request: LinuxDoPostActionRequest,
    capability: NativeActionCapability,
    routeSignal: AbortSignal,
  ): Promise<
    | { readonly capability: NativeActionCapability; readonly kind: 'revealed' }
    | { readonly kind: 'failed'; readonly outcome: LinuxDoPostActionOutcome }
  > {
    const window = this.#document.defaultView;
    const revealControl = capability.revealControl;
    const observationRoot = revealControl?.closest<HTMLElement>('[data-post-number]');
    if (!window || !revealControl?.isConnected || !observationRoot) {
      return {
        kind: 'failed',
        outcome: failed(
          request.action,
          'native-control-not-found',
          'The Linux DO Bookmark control could not be revealed.',
          true,
        ),
      };
    }

    return new Promise((resolve) => {
      let finished = false;
      const observer = new window.MutationObserver(() => {
        evaluate();
      });
      const timeout = window.setTimeout(
        () => {
          finish({
            kind: 'failed',
            outcome: failed(
              request.action,
              'native-control-not-found',
              'Linux DO did not reveal Bookmark for this post.',
              true,
            ),
          });
        },
        Math.min(this.#confirmationTimeoutMs, 2_000),
      );
      const cleanup = () => {
        observer.disconnect();
        window.clearTimeout(timeout);
        request.signal?.removeEventListener('abort', onAbort);
        routeSignal.removeEventListener('abort', onRouteAbort);
      };
      const finish = (
        result:
          | { readonly capability: NativeActionCapability; readonly kind: 'revealed' }
          | { readonly kind: 'failed'; readonly outcome: LinuxDoPostActionOutcome },
      ) => {
        if (finished) return;
        finished = true;
        cleanup();
        resolve(result);
      };
      const onAbort = () => {
        finish({
          kind: 'failed',
          outcome: failed(request.action, 'aborted', 'The action was cancelled.', true),
        });
      };
      const onRouteAbort = () => {
        finish({
          kind: 'failed',
          outcome: failed(
            request.action,
            routeSignal.reason === 'stale-route' ? 'stale-route' : 'aborted',
            routeSignal.reason === 'stale-route'
              ? 'The topic changed before Bookmark could be revealed.'
              : 'The action was cancelled.',
            true,
          ),
        });
      };
      const evaluate = () => {
        const invalid = this.#validateRequest(request);
        if (invalid) {
          finish({ kind: 'failed', outcome: invalid });
          return;
        }
        const current = this.#findCapability(request);
        if (current?.state === 'available' && current.control && current.active !== null) {
          finish({ capability: current, kind: 'revealed' });
        }
      };

      request.signal?.addEventListener('abort', onAbort, { once: true });
      routeSignal.addEventListener('abort', onRouteAbort, { once: true });
      observer.observe(observationRoot, { attributes: true, childList: true, subtree: true });
      try {
        revealControl.click();
      } catch {
        finish({
          kind: 'failed',
          outcome: failed(
            request.action,
            'native-dispatch-failed',
            'Linux DO rejected the Bookmark reveal action.',
            true,
          ),
        });
      }
      evaluate();
    });
  }

  #waitForConfirmation(
    request: LinuxDoPostActionRequest,
    expectedActive: boolean,
    routeSignal: AbortSignal,
    observationRoot: HTMLElement,
  ): {
    readonly cancel: () => void;
    readonly outcome: Promise<LinuxDoPostActionOutcome>;
    readonly ready: boolean;
  } {
    const window = this.#document.defaultView;
    if (!window) {
      return {
        cancel: () => undefined,
        outcome: Promise.resolve(
          failed(
            request.action,
            'native-dispatch-failed',
            'Linux DO action confirmation is unavailable.',
            true,
          ),
        ),
        ready: false,
      };
    }

    const PerformanceObserverConstructor = window.PerformanceObserver;
    if (request.action === 'like' && typeof PerformanceObserverConstructor !== 'function') {
      return {
        cancel: () => undefined,
        outcome: Promise.resolve(
          failed(
            request.action,
            'native-dispatch-failed',
            'This browser cannot safely confirm the Linux DO Like result.',
            false,
          ),
        ),
        ready: false,
      };
    }

    let finish: ((outcome: LinuxDoPostActionOutcome) => void) | null = null;
    let confirmationReady = true;
    let compatibilityTimer: number | null = null;
    let likeResponseConfirmed = request.action !== 'like';
    let performanceObserver: PerformanceObserver | null = null;
    let settleTimer: number | null = null;
    let timeoutTimer: number | null = null;
    const observer = new window.MutationObserver(() => {
      evaluate();
    });
    const cleanup = () => {
      observer.disconnect();
      performanceObserver?.disconnect();
      if (compatibilityTimer !== null) window.clearTimeout(compatibilityTimer);
      if (settleTimer !== null) window.clearTimeout(settleTimer);
      if (timeoutTimer !== null) window.clearTimeout(timeoutTimer);
      request.signal?.removeEventListener('abort', onAbort);
      routeSignal.removeEventListener('abort', onRouteAbort);
    };
    const resolve = (outcome: LinuxDoPostActionOutcome) => {
      if (!finish) return;
      const resolveOutcome = finish;
      finish = null;
      cleanup();
      resolveOutcome(outcome);
    };
    const onAbort = () => {
      resolve(failed(request.action, 'aborted', 'The action was cancelled.', true));
    };
    const onRouteAbort = () => {
      resolve(
        failed(
          request.action,
          routeSignal.reason === 'stale-route' ? 'stale-route' : 'aborted',
          routeSignal.reason === 'stale-route'
            ? 'The topic changed before Linux DO confirmed the action.'
            : 'The action was cancelled.',
          true,
        ),
      );
    };
    const confirmCompatibilityLoss = () => {
      compatibilityTimer = null;
      const invalid = this.#validateRequest(request);
      if (invalid) {
        resolve(invalid);
        return;
      }
      const current = this.#findCapability(request);
      if (!current || current.state === 'unavailable') {
        resolve(
          failed(
            request.action,
            'native-control-not-found',
            'Linux DO removed the compatible action binding before confirmation.',
            true,
          ),
        );
        return;
      }
      if (current.state === 'authentication-required') {
        resolve(unavailableOutcome(request.action, current));
        return;
      }
      evaluate();
    };
    const scheduleCompatibilityCheck = () => {
      compatibilityTimer ??= window.setTimeout(confirmCompatibilityLoss, this.#settleDelayMs);
    };
    const clearCompatibilityCheck = () => {
      if (compatibilityTimer === null) return;
      window.clearTimeout(compatibilityTimer);
      compatibilityTimer = null;
    };
    const confirmSettledState = () => {
      settleTimer = null;
      const invalid = this.#validateRequest(request);
      if (invalid) {
        resolve(invalid);
        return;
      }
      const current = this.#findCapability(request);
      if (
        !current ||
        current.state === 'unavailable' ||
        current.state === 'authentication-required'
      ) {
        scheduleCompatibilityCheck();
        return;
      }
      clearCompatibilityCheck();
      if (
        likeResponseConfirmed &&
        current.state === 'available' &&
        current.active === expectedActive
      ) {
        resolve({ action: request.action, active: expectedActive, kind: 'confirmed' });
      }
    };
    const evaluate = () => {
      if (!finish) return;
      const invalid = this.#validateRequest(request);
      if (invalid) {
        resolve(invalid);
        return;
      }
      const current = this.#findCapability(request);
      if (
        !current ||
        current.state === 'unavailable' ||
        current.state === 'authentication-required'
      ) {
        if (settleTimer !== null) {
          window.clearTimeout(settleTimer);
          settleTimer = null;
        }
        scheduleCompatibilityCheck();
        return;
      }
      clearCompatibilityCheck();
      if (
        likeResponseConfirmed &&
        current.state === 'available' &&
        current.active === expectedActive
      ) {
        settleTimer ??= window.setTimeout(confirmSettledState, this.#settleDelayMs);
      } else if (settleTimer !== null) {
        window.clearTimeout(settleTimer);
        settleTimer = null;
      }
    };
    const outcome = new Promise<LinuxDoPostActionOutcome>((resolveOutcome) => {
      finish = resolveOutcome;
      request.signal?.addEventListener('abort', onAbort, { once: true });
      routeSignal.addEventListener('abort', onRouteAbort, { once: true });
      if (request.action === 'like') {
        try {
          performanceObserver = new PerformanceObserverConstructor((entries) => {
            const response = entries
              .getEntries()
              .find((entry) => isLikeToggleResponse(entry, request.postId, this.#document));
            if (!response) return;
            const responseStatus: unknown = Reflect.get(response, 'responseStatus');
            if (typeof responseStatus === 'number' && responseStatus >= 400) {
              resolve(
                failed(
                  request.action,
                  'native-dispatch-failed',
                  'Linux DO rejected the Like request.',
                  true,
                ),
              );
              return;
            }
            likeResponseConfirmed = true;
            evaluate();
          });
          performanceObserver.observe({ entryTypes: ['resource'] });
        } catch {
          confirmationReady = false;
          resolve(
            failed(
              request.action,
              'native-dispatch-failed',
              'This browser cannot safely confirm the Linux DO Like result.',
              false,
            ),
          );
          return;
        }
      }
      observer.observe(observationRoot, {
        attributeFilter: ['aria-disabled', 'class', 'disabled', 'hidden', 'title'],
        attributes: true,
        childList: true,
        subtree: true,
      });
      timeoutTimer = window.setTimeout(() => {
        resolve(
          failed(
            request.action,
            'confirmation-timeout',
            'Linux DO did not confirm the action result.',
            true,
          ),
        );
      }, this.#confirmationTimeoutMs);
      evaluate();
    });

    return {
      cancel: () => {
        resolve(failed(request.action, 'aborted', 'The action was cancelled.', true));
      },
      outcome,
      ready: confirmationReady,
    };
  }
}

function unavailableOutcome(
  action: LinuxDoPostAction,
  capability: NativeActionCapability | null,
): LinuxDoPostActionOutcome {
  switch (capability?.state) {
    case 'authentication-required':
      return failed(
        action,
        'authentication-required',
        `Sign in to Linux DO to ${action === 'like' ? 'like this post' : 'bookmark this post'}.`,
        false,
      );
    case 'disabled':
      return failed(
        action,
        'native-control-disabled',
        `Linux DO has disabled ${action === 'like' ? 'Like' : 'Bookmark'} for this post.`,
        false,
      );
    default:
      return failed(
        action,
        'native-control-not-found',
        `Linux DO did not expose ${action === 'like' ? 'Like' : 'Bookmark'} for this post.`,
        true,
      );
  }
}

function failed(
  action: LinuxDoPostAction,
  code: LinuxDoPostActionFailureCode,
  message: string,
  retryable: boolean,
): LinuxDoPostActionOutcome {
  return { action, code, kind: 'failed', message, retryable };
}

function sameTopic(left: LinuxDoRoute, right: LinuxDoRoute): boolean {
  return left.kind === 'topic' && right.kind === 'topic' && left.topicId === right.topicId;
}

function isLikeToggleResponse(
  entry: PerformanceEntry,
  postId: number,
  document: Document,
): boolean {
  if (entry.entryType !== 'resource') return false;
  try {
    const url = new URL(entry.name, document.location.href);
    const prefix = `/discourse-reactions/posts/${String(postId)}/custom-reactions/`;
    return (
      url.origin === document.location.origin &&
      url.pathname.startsWith(prefix) &&
      url.pathname.endsWith('/toggle.json')
    );
  } catch {
    return false;
  }
}
