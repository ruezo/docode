type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const LIKE_ACTION_TYPE_ID = 2;

export type LinuxDoLikeApiFailureCode =
  'aborted' | 'authentication-required' | 'native-control-disabled' | 'native-dispatch-failed';

export type LinuxDoLikeApiOutcome =
  | { readonly active: boolean; readonly kind: 'confirmed' }
  | {
      readonly code: LinuxDoLikeApiFailureCode;
      readonly kind: 'failed';
      readonly message: string;
      readonly retryable: boolean;
    };

interface LikeState {
  readonly acted: boolean;
  readonly canUndo: boolean | null;
  readonly kind: 'state';
}
type FailedOutcome = Extract<LinuxDoLikeApiOutcome, { readonly kind: 'failed' }>;
type SendResult = FailedOutcome | { readonly kind: 'response'; readonly response: Response };

export class LinuxDoLikeApiClient {
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

  async toggle(postId: number, signal?: AbortSignal): Promise<LinuxDoLikeApiOutcome> {
    if (isAborted(signal)) return aborted();
    if (!this.#fetch) {
      return failed(
        'native-dispatch-failed',
        'Linux DO networking is unavailable in this context.',
        true,
      );
    }
    try {
      const state = await this.#readLikeState(postId, signal);
      if (state.kind === 'failed') return state;
      if (state.acted && state.canUndo === false) {
        return failed(
          'native-control-disabled',
          'Linux DO no longer allows removing the Like from this post.',
          false,
        );
      }
      const csrf = await this.#readCsrfToken(signal);
      if (typeof csrf !== 'string') return csrf;
      return await this.#writeLike(postId, state.acted, csrf, signal);
    } catch (error) {
      if (isAborted(signal) || (error instanceof DOMException && error.name === 'AbortError')) {
        return aborted();
      }
      return failed('native-dispatch-failed', 'Linux DO rejected the Like request.', true);
    }
  }

  async #send(url: URL, init: RequestInit, signal: AbortSignal | undefined): Promise<SendResult> {
    if (!this.#fetch) {
      return failed(
        'native-dispatch-failed',
        'Linux DO networking is unavailable in this context.',
        true,
      );
    }
    const origin = this.#document.location.origin;
    const response = await this.#fetch(url, {
      ...init,
      credentials: 'same-origin',
      signal: signal ?? null,
    });
    if (isAborted(signal)) return aborted();
    const responseUrl = new URL(response.url || url.href);
    if (responseUrl.origin !== origin) {
      return failed(
        'native-dispatch-failed',
        'Linux DO returned a response from an unexpected origin.',
        false,
      );
    }
    return { kind: 'response', response };
  }

  async #readLikeState(
    postId: number,
    signal: AbortSignal | undefined,
  ): Promise<FailedOutcome | LikeState> {
    const url = new URL(`/posts/${String(postId)}.json`, this.#document.location.origin);
    const sent = await this.#send(
      url,
      { headers: new Headers({ Accept: 'application/json' }), method: 'GET' },
      signal,
    );
    if (sent.kind === 'failed') return sent;
    const { response } = sent;
    if (response.status === 401 || response.status === 403) {
      return failed('authentication-required', 'Sign in to Linux DO to like posts.', false);
    }
    if (response.status === 404) {
      return failed('native-dispatch-failed', 'Linux DO could not find this post.', false);
    }
    if (!response.ok) {
      return failed(
        'native-dispatch-failed',
        `Linux DO rejected the Like state lookup (${String(response.status)}).`,
        true,
      );
    }
    const payload: unknown = await response.json();
    if (!isRecord(payload)) {
      return failed('native-dispatch-failed', 'Linux DO returned an unreadable post state.', true);
    }
    let acted = false;
    let canUndo: boolean | null = null;
    const summary = Array.isArray(payload.actions_summary) ? payload.actions_summary : [];
    for (const entry of summary) {
      if (!isRecord(entry) || entry.id !== LIKE_ACTION_TYPE_ID) continue;
      acted = entry.acted === true;
      canUndo = typeof entry.can_undo === 'boolean' ? entry.can_undo : null;
    }
    return { acted, canUndo, kind: 'state' };
  }

  async #readCsrfToken(signal: AbortSignal | undefined): Promise<FailedOutcome | string> {
    const url = new URL('/session/csrf.json', this.#document.location.origin);
    const sent = await this.#send(
      url,
      {
        headers: new Headers({ Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' }),
        method: 'GET',
      },
      signal,
    );
    if (sent.kind === 'failed') return sent;
    if (!sent.response.ok) {
      return failed(
        'native-dispatch-failed',
        `Linux DO did not provide a session token (${String(sent.response.status)}).`,
        true,
      );
    }
    const payload: unknown = await sent.response.json();
    const csrf = isRecord(payload) && typeof payload.csrf === 'string' ? payload.csrf : null;
    if (!csrf) {
      return failed('native-dispatch-failed', 'Linux DO did not provide a session token.', true);
    }
    return csrf;
  }

  async #writeLike(
    postId: number,
    acted: boolean,
    csrf: string,
    signal: AbortSignal | undefined,
  ): Promise<LinuxDoLikeApiOutcome> {
    const origin = this.#document.location.origin;
    const headers = new Headers({
      Accept: 'application/json',
      'X-CSRF-Token': csrf,
      'X-Requested-With': 'XMLHttpRequest',
    });
    let sent: SendResult;
    if (acted) {
      const url = new URL(`/post_actions/${String(postId)}.json`, origin);
      url.searchParams.set('post_action_type_id', String(LIKE_ACTION_TYPE_ID));
      sent = await this.#send(url, { headers, method: 'DELETE' }, signal);
    } else {
      const body = new URLSearchParams({
        flag_topic: 'false',
        id: String(postId),
        post_action_type_id: String(LIKE_ACTION_TYPE_ID),
      });
      sent = await this.#send(
        new URL('/post_actions.json', origin),
        { body, headers, method: 'POST' },
        signal,
      );
    }
    if (sent.kind === 'failed') return sent;
    const { response } = sent;
    if (response.ok) return { active: !acted, kind: 'confirmed' };
    const serverMessage = await readServerErrors(response);
    if (response.status === 401) {
      return failed('authentication-required', 'Sign in to Linux DO to like posts.', false);
    }
    if (response.status === 403) {
      return serverMessage
        ? failed('native-dispatch-failed', serverMessage, false)
        : failed('authentication-required', 'Sign in to Linux DO to like posts.', false);
    }
    if (response.status === 429) {
      return failed(
        'native-dispatch-failed',
        'Linux DO is rate limiting actions. Try again shortly.',
        true,
      );
    }
    return failed(
      'native-dispatch-failed',
      serverMessage ?? `Linux DO rejected the Like request (${String(response.status)}).`,
      response.status >= 500,
    );
  }
}

async function readServerErrors(response: Response): Promise<string | null> {
  try {
    const payload: unknown = await response.json();
    if (!isRecord(payload) || !Array.isArray(payload.errors)) return null;
    const messages = payload.errors.filter(
      (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0,
    );
    return messages.length > 0 ? messages.join(' ') : null;
  } catch {
    return null;
  }
}

function aborted(): FailedOutcome {
  return failed('aborted', 'The action was cancelled.', true);
}

function failed(
  code: LinuxDoLikeApiFailureCode,
  message: string,
  retryable: boolean,
): FailedOutcome {
  return { code, kind: 'failed', message, retryable };
}

function isAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
