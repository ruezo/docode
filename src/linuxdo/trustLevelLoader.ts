type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface LinuxDoTrustLevelSnapshot {
  readonly daysVisited: number;
  readonly likesGiven: number;
  readonly likesReceived: number;
  readonly postCount: number;
  readonly postsReadCount: number;
  readonly timeReadSeconds: number;
  readonly topicCount: number;
  readonly topicsEntered: number;
  readonly trustLevel: number;
  readonly username: string;
}

export type TrustLevelLoadOutcome =
  | { readonly kind: 'ready'; readonly snapshot: LinuxDoTrustLevelSnapshot }
  | { readonly kind: 'aborted' | 'authentication-required' | 'unavailable' };

export class LinuxDoTrustLevelLoader {
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

  async load(username: string, signal: AbortSignal): Promise<TrustLevelLoadOutcome> {
    if (isAborted(signal)) return { kind: 'aborted' };
    if (!this.#fetch || !isUsername(username)) return { kind: 'unavailable' };
    const encoded = encodeURIComponent(username.toLowerCase());
    const [profile, summary] = await Promise.all([
      this.#loadJson(`/u/${encoded}.json`, signal),
      this.#loadJson(`/u/${encoded}/summary.json`, signal),
    ]);
    if (profile.kind !== 'ready') return { kind: profile.kind };
    if (summary.kind !== 'ready') return { kind: summary.kind };
    const snapshot = extractSnapshot(profile.payload, summary.payload);
    return snapshot === null ? { kind: 'unavailable' } : { kind: 'ready', snapshot };
  }

  async #loadJson(
    path: string,
    signal: AbortSignal,
  ): Promise<
    | { readonly kind: 'ready'; readonly payload: unknown }
    | { readonly kind: 'aborted' | 'authentication-required' | 'unavailable' }
  > {
    const fetch = this.#fetch;
    if (!fetch) return { kind: 'unavailable' };
    const origin = this.#document.location.origin;
    const url = new URL(path, origin);
    try {
      const response = await fetch(url, {
        credentials: 'same-origin',
        headers: new Headers({ Accept: 'application/json' }),
        method: 'GET',
        signal,
      });
      if (isAborted(signal)) return { kind: 'aborted' };
      if (response.status === 401 || response.status === 403) {
        return { kind: 'authentication-required' };
      }
      if (!response.ok) return { kind: 'unavailable' };
      const responseUrl = new URL(response.url || url.href);
      if (responseUrl.origin !== origin) return { kind: 'unavailable' };
      const payload: unknown = await response.json();
      if (isAborted(signal)) return { kind: 'aborted' };
      return { kind: 'ready', payload };
    } catch (error) {
      if (isAborted(signal) || (error instanceof DOMException && error.name === 'AbortError')) {
        return { kind: 'aborted' };
      }
      return { kind: 'unavailable' };
    }
  }
}

function extractSnapshot(
  profilePayload: unknown,
  summaryPayload: unknown,
): LinuxDoTrustLevelSnapshot | null {
  if (!isRecord(profilePayload) || !isRecord(profilePayload.user)) return null;
  if (!isRecord(summaryPayload) || !isRecord(summaryPayload.user_summary)) return null;
  const user = profilePayload.user;
  const summary = summaryPayload.user_summary;
  const trustLevel = readCount(user.trust_level);
  const username = typeof user.username === 'string' ? user.username.trim() : '';
  if (trustLevel === null || trustLevel > 4 || username.length === 0) return null;
  const daysVisited = readCount(summary.days_visited);
  const likesGiven = readCount(summary.likes_given);
  const likesReceived = readCount(summary.likes_received);
  const postCount = readCount(summary.post_count);
  const postsReadCount = readCount(summary.posts_read_count);
  const timeReadSeconds = readCount(summary.time_read);
  const topicCount = readCount(summary.topic_count);
  const topicsEntered = readCount(summary.topics_entered);
  if (
    daysVisited === null ||
    likesGiven === null ||
    likesReceived === null ||
    postCount === null ||
    postsReadCount === null ||
    timeReadSeconds === null ||
    topicCount === null ||
    topicsEntered === null
  ) {
    return null;
  }
  return {
    daysVisited,
    likesGiven,
    likesReceived,
    postCount,
    postsReadCount,
    timeReadSeconds,
    topicCount,
    topicsEntered,
    trustLevel,
    username,
  };
}

function isAborted(signal: AbortSignal): boolean {
  return signal.aborted;
}

function isUsername(value: string): boolean {
  return /^[\w.-]{1,60}$/u.test(value);
}

function readCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
