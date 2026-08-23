import { isLinuxDoLocation } from './host';

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type JsonRecord = Readonly<Record<string, unknown>>;

export interface LinuxDoUserBadge {
  readonly description: string | null;
  readonly name: string;
}

export interface LinuxDoUserCard {
  readonly avatarUrl: string | null;
  readonly badges: readonly LinuxDoUserBadge[];
  readonly bioExcerpt: string | null;
  readonly createdAt: string | null;
  readonly displayName: string;
  readonly lastPostedAt: string | null;
  readonly lastSeenAt: string | null;
  readonly location: string | null;
  readonly recentTimeReadSeconds: number | null;
  readonly timeReadSeconds: number | null;
  readonly title: string | null;
  readonly topicPostCount: number | null;
  readonly trustLevel: number | null;
  readonly username: string;
  readonly websiteUrl: string | null;
}

export type LinuxDoUserCardLoadOutcome =
  | { readonly card: LinuxDoUserCard; readonly kind: 'ready' }
  | { readonly kind: 'aborted' | 'unavailable' };

export async function loadLinuxDoUserCard(
  document: Document,
  username: string,
  signal: AbortSignal,
  fetchOverride?: FetchLike | null,
): Promise<LinuxDoUserCardLoadOutcome> {
  if (
    isAbortSignalAborted(signal) ||
    !isSafeUsername(username) ||
    !isLinuxDoLocation(document.location)
  ) {
    return isAbortSignalAborted(signal) ? { kind: 'aborted' } : { kind: 'unavailable' };
  }
  const documentWindow = document.defaultView;
  const documentFetch: unknown = documentWindow ? Reflect.get(documentWindow, 'fetch') : null;
  const fetcher =
    fetchOverride ??
    (typeof documentFetch === 'function' && documentWindow
      ? (input: RequestInfo | URL, init?: RequestInit) =>
          Reflect.apply(documentFetch, documentWindow, [input, init]) as Promise<Response>
      : null);
  if (!fetcher) return { kind: 'unavailable' };

  const endpoint = new URL(`/u/${encodeURIComponent(username)}/card.json`, document.location.href);
  try {
    const response = await fetcher(endpoint, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      method: 'GET',
      signal,
    });
    if (isAbortSignalAborted(signal)) return { kind: 'aborted' };
    if (!response.ok) return { kind: 'unavailable' };
    const payload: unknown = await response.json();
    if (isAbortSignalAborted(signal)) return { kind: 'aborted' };
    const card = extractLinuxDoUserCard(document, payload, username);
    return card ? { card, kind: 'ready' } : { kind: 'unavailable' };
  } catch {
    return isAbortSignalAborted(signal) ? { kind: 'aborted' } : { kind: 'unavailable' };
  }
}

function isAbortSignalAborted(signal: AbortSignal): boolean {
  return signal.aborted;
}

export function extractLinuxDoUserCard(
  document: Document,
  payload: unknown,
  expectedUsername: string,
): LinuxDoUserCard | null {
  const root = toRecord(payload);
  const user = toRecord(root?.user);
  const username = normalizeText(user?.username);
  if (
    !user ||
    !isSafeUsername(expectedUsername) ||
    !isSafeUsername(username) ||
    username.toLocaleLowerCase() !== expectedUsername.toLocaleLowerCase()
  ) {
    return null;
  }
  return {
    avatarUrl: resolveLinuxDoAvatarUrl(user.avatar_template, document.location.href, 96),
    badges: extractBadges(user.featured_user_badges),
    bioExcerpt: toPlainText(document, user.bio_excerpt),
    createdAt: toIsoTimestamp(user.created_at),
    displayName: normalizeText(user.name) || username,
    lastPostedAt: toIsoTimestamp(user.last_posted_at),
    lastSeenAt: toIsoTimestamp(user.last_seen_at),
    location: normalizeText(user.location) || null,
    recentTimeReadSeconds: toNonNegativeInteger(user.recent_time_read),
    timeReadSeconds: toNonNegativeInteger(user.time_read),
    title: normalizeText(user.title) || null,
    topicPostCount: toNonNegativeInteger(user.topic_post_count),
    trustLevel: toTrustLevel(user.trust_level),
    username,
    websiteUrl: toWebsiteUrl(user.website),
  };
}

export function resolveLinuxDoAvatarUrl(
  value: unknown,
  baseHref: string,
  size: number,
): string | null {
  if (typeof value !== 'string' || !Number.isSafeInteger(size) || size < 16 || size > 512) {
    return null;
  }
  const candidate = value.trim().replaceAll('{size}', String(size));
  if (!candidate) return null;
  try {
    const url = new URL(candidate, baseHref);
    return isLinuxDoLocation(url) ? url.href : null;
  } catch {
    return null;
  }
}

function extractBadges(value: unknown): readonly LinuxDoUserBadge[] {
  if (!Array.isArray(value)) return [];
  const badges: LinuxDoUserBadge[] = [];
  const names = new Set<string>();
  for (const item of value) {
    const badge = toRecord(item);
    const name = normalizeText(badge?.name) || normalizeText(badge?.display_name);
    if (!name || names.has(name)) continue;
    names.add(name);
    badges.push({
      description: normalizeText(badge?.description) || null,
      name,
    });
    if (badges.length === 12) break;
  }
  return badges;
}

function isSafeUsername(value: string): boolean {
  return Boolean(value) && value.length <= 100 && !/[\s/\\?#]/u.test(value);
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/gu, ' ').trim() : '';
}

function toIsoTimestamp(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function toNonNegativeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function toPlainText(document: Document, value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const Parser = document.defaultView?.DOMParser;
  if (!Parser) return null;
  const parsed = new Parser().parseFromString(value, 'text/html');
  parsed.body.querySelectorAll('script, style, template, noscript').forEach((element) => {
    element.remove();
  });
  return normalizeText(parsed.body.textContent) || null;
}

function toRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function toTrustLevel(value: unknown): number | null {
  const trustLevel = toNonNegativeInteger(value);
  return trustLevel !== null && trustLevel <= 4 ? trustLevel : null;
}

function toWebsiteUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}
