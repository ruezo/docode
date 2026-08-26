type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export const BOOST_MAX_VISIBLE_LENGTH = 16;

export interface LinuxDoBoostCreated {
  readonly avatarUrl: string | null;
  readonly text: string;
  readonly username: string | null;
}

export type LinuxDoBoostApiOutcome =
  | { readonly boost: LinuxDoBoostCreated; readonly kind: 'created' }
  | {
      readonly code: 'aborted' | 'authentication-required' | 'rejected';
      readonly kind: 'failed';
      readonly message: string;
      readonly retryable: boolean;
    };

type FailedOutcome = Extract<LinuxDoBoostApiOutcome, { readonly kind: 'failed' }>;
type SendResult = FailedOutcome | { readonly kind: 'response'; readonly response: Response };

export function countBoostVisibleLength(raw: string): number {
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  let length = 0;
  const shortcodeStripped = raw.replace(/:[a-z0-9_+-]+(?::t\d)?:/gu, '￼');
  for (const segment of segmenter.segment(shortcodeStripped)) {
    void segment;
    length += 1;
  }
  return length;
}

export class LinuxDoBoostApiClient {
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

  async create(postId: number, raw: string, signal?: AbortSignal): Promise<LinuxDoBoostApiOutcome> {
    if (isAborted(signal)) return aborted();
    const text = raw.trim();
    if (text.length === 0) {
      return failed('rejected', 'Boost text cannot be empty.', false);
    }
    if (countBoostVisibleLength(text) > BOOST_MAX_VISIBLE_LENGTH) {
      return failed(
        'rejected',
        `Boosts are limited to ${String(BOOST_MAX_VISIBLE_LENGTH)} visible characters.`,
        false,
      );
    }
    try {
      const csrf = await this.#readCsrfToken(signal);
      if (typeof csrf !== 'string') return csrf;
      return await this.#writeBoost(postId, text, csrf, signal);
    } catch (error) {
      if (isAborted(signal) || (error instanceof DOMException && error.name === 'AbortError')) {
        return aborted();
      }
      return failed('rejected', 'Linux DO rejected the Boost request.', true);
    }
  }

  async #send(url: URL, init: RequestInit, signal: AbortSignal | undefined): Promise<SendResult> {
    if (!this.#fetch) {
      return failed('rejected', 'Linux DO networking is unavailable in this context.', true);
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
      return failed('rejected', 'Linux DO returned a response from an unexpected origin.', false);
    }
    return { kind: 'response', response };
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
        'rejected',
        `Linux DO did not provide a session token (${String(sent.response.status)}).`,
        true,
      );
    }
    const payload: unknown = await sent.response.json();
    const csrf = isRecord(payload) && typeof payload.csrf === 'string' ? payload.csrf : null;
    if (!csrf) {
      return failed('rejected', 'Linux DO did not provide a session token.', true);
    }
    return csrf;
  }

  async #writeBoost(
    postId: number,
    raw: string,
    csrf: string,
    signal: AbortSignal | undefined,
  ): Promise<LinuxDoBoostApiOutcome> {
    const origin = this.#document.location.origin;
    const url = new URL(`/discourse-boosts/posts/${String(postId)}/boosts`, origin);
    const sent = await this.#send(
      url,
      {
        body: JSON.stringify({ post_id: postId, raw }),
        headers: new Headers({
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrf,
          'X-Requested-With': 'XMLHttpRequest',
        }),
        method: 'POST',
      },
      signal,
    );
    if (sent.kind === 'failed') return sent;
    const { response } = sent;
    if (response.status === 401) {
      return failed('authentication-required', 'Sign in to Linux DO to boost posts.', false);
    }
    if (response.status === 403) {
      return failed(
        'rejected',
        'Linux DO does not allow boosting this post (own posts and archived topics cannot be boosted).',
        false,
      );
    }
    if (response.status === 429) {
      return failed('rejected', 'Linux DO is rate limiting boosts. Try again shortly.', true);
    }
    if (!response.ok) {
      const serverMessage = await readServerErrors(response);
      return failed(
        'rejected',
        serverMessage ?? `Linux DO rejected the Boost request (${String(response.status)}).`,
        response.status >= 500,
      );
    }
    const payload: unknown = await response.json();
    return { boost: extractCreatedBoost(payload, raw, origin), kind: 'created' };
  }
}

function extractCreatedBoost(payload: unknown, raw: string, origin: string): LinuxDoBoostCreated {
  if (!isRecord(payload)) return { avatarUrl: null, text: raw, username: null };
  const user = isRecord(payload.user) ? payload.user : null;
  const username = user && typeof user.username === 'string' ? user.username : null;
  const avatarTemplate =
    user && typeof user.avatar_template === 'string' ? user.avatar_template : null;
  return { avatarUrl: resolveAvatarUrl(avatarTemplate, origin), text: raw, username };
}

function resolveAvatarUrl(template: string | null, origin: string): string | null {
  if (!template) return null;
  try {
    const url = new URL(template.replace('{size}', '24'), origin);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
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
  return failed('aborted', 'The boost was cancelled.', true);
}

function failed(code: FailedOutcome['code'], message: string, retryable: boolean): FailedOutcome {
  return { code, kind: 'failed', message, retryable };
}

function isAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
