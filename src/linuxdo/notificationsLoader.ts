type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const NOTIFICATIONS_LIMIT = 12;

const NOTIFICATION_TYPE_LABELS = new Map<number, string>([
  [1, 'mentioned'],
  [2, 'replied'],
  [3, 'quoted'],
  [4, 'edited'],
  [5, 'liked'],
  [6, 'message'],
  [9, 'posted'],
  [11, 'linked'],
  [12, 'badge'],
  [15, 'watching'],
  [24, 'bookmark'],
  [25, 'reaction'],
]);

export interface LinuxDoNotificationItem {
  readonly id: number;
  readonly kind: string;
  readonly label: string;
  readonly read: boolean;
  readonly url: string;
  readonly username: string | null;
}

export type NotificationsLoadOutcome =
  | { readonly kind: 'ready'; readonly notifications: readonly LinuxDoNotificationItem[] }
  | { readonly kind: 'aborted' | 'authentication-required' | 'unavailable' };

export class LinuxDoNotificationsLoader {
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

  async load(signal: AbortSignal): Promise<NotificationsLoadOutcome> {
    if (isAborted(signal)) return { kind: 'aborted' };
    if (!this.#fetch) return { kind: 'unavailable' };
    const origin = this.#document.location.origin;
    const url = new URL('/notifications.json', origin);
    url.searchParams.set('limit', String(NOTIFICATIONS_LIMIT));
    url.searchParams.set('recent', 'true');
    try {
      const response = await this.#fetch(url, {
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
      const notifications = extractNotifications(payload, origin);
      if (notifications === null) return { kind: 'unavailable' };
      return { kind: 'ready', notifications };
    } catch (error) {
      if (isAborted(signal) || (error instanceof DOMException && error.name === 'AbortError')) {
        return { kind: 'aborted' };
      }
      return { kind: 'unavailable' };
    }
  }
}

function extractNotifications(
  payload: unknown,
  origin: string,
): readonly LinuxDoNotificationItem[] | null {
  if (!isRecord(payload) || !Array.isArray(payload.notifications)) return null;
  const notifications: LinuxDoNotificationItem[] = [];
  for (const entry of payload.notifications.slice(0, NOTIFICATIONS_LIMIT)) {
    const item = extractNotification(entry, origin);
    if (item) notifications.push(item);
  }
  return notifications;
}

function extractNotification(entry: unknown, origin: string): LinuxDoNotificationItem | null {
  if (!isRecord(entry)) return null;
  const { id, notification_type: type, read } = entry;
  if (typeof id !== 'number' || !Number.isSafeInteger(id)) return null;
  if (typeof read !== 'boolean') return null;
  const data = isRecord(entry.data) ? entry.data : {};
  const label =
    readString(data.topic_title) ??
    readString(entry.fancy_title) ??
    readString(data.badge_name) ??
    readString(data.group_name) ??
    'Notification';
  return {
    id,
    kind:
      (typeof type === 'number' ? NOTIFICATION_TYPE_LABELS.get(type) : undefined) ?? 'notification',
    label,
    read,
    url: buildNotificationUrl(entry, data, origin),
    username: readString(data.display_username) ?? readString(data.original_username),
  };
}

function buildNotificationUrl(
  entry: Record<string, unknown>,
  data: Record<string, unknown>,
  origin: string,
): string {
  const topicId = entry.topic_id;
  if (typeof topicId === 'number' && Number.isSafeInteger(topicId) && topicId > 0) {
    const slug = readString(entry.slug) ?? 'topic';
    const postNumber = entry.post_number;
    const postSuffix =
      typeof postNumber === 'number' && Number.isSafeInteger(postNumber) && postNumber > 0
        ? `/${String(postNumber)}`
        : '';
    return new URL(`/t/${slug}/${String(topicId)}${postSuffix}`, origin).href;
  }
  const badgeId = data.badge_id;
  if (typeof badgeId === 'number' && Number.isSafeInteger(badgeId) && badgeId > 0) {
    const badgeSlug = readString(data.badge_slug);
    return new URL(
      badgeSlug ? `/badges/${String(badgeId)}/${badgeSlug}` : '/my/notifications',
      origin,
    ).href;
  }
  return new URL('/my/notifications', origin).href;
}

function isAborted(signal: AbortSignal): boolean {
  return signal.aborted;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
