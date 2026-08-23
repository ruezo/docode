import { recognizeLinuxDoRoute, type LinuxDoRoute } from './routes';

export type LinuxDoSearchResultKind = 'category' | 'post' | 'tag' | 'user';

export interface LinuxDoSearchResult {
  readonly description: string;
  readonly id: string;
  readonly kind: LinuxDoSearchResultKind;
  readonly label: string;
  readonly route: LinuxDoRoute;
  readonly url: string;
}

export type LinuxDoSearchOutcome =
  | { readonly kind: 'aborted'; readonly query: string }
  | {
      readonly code: 'invalid-response' | 'request-failed' | 'search-unavailable';
      readonly kind: 'error';
      readonly message: string;
      readonly query: string;
      readonly retryable: boolean;
    }
  | {
      readonly items: readonly LinuxDoSearchResult[];
      readonly kind: 'results';
      readonly query: string;
    };

interface LinuxDoSearchAdapterOptions {
  readonly fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

const SEARCH_ENDPOINT = '/search/query';
const MAX_RESULTS = 50;
const HTML_TAG_PATTERN = /<!--[\s\S]*?-->|<\/?[a-z][^>]*>/giu;
const HTML_ENTITY_PATTERN =
  /&(?:#([0-9]{1,7})|#[xX]([0-9a-fA-F]{1,6})|([a-zA-Z][a-zA-Z0-9]{1,31}));/gu;
const HTML_NAMED_ENTITIES: Readonly<Record<string, string>> = Object.freeze({
  amp: '&',
  apos: "'",
  bull: '•',
  copy: '©',
  gt: '>',
  hellip: '…',
  laquo: '«',
  ldquo: '“',
  lsquo: '‘',
  lt: '<',
  mdash: '—',
  middot: '·',
  nbsp: ' ',
  ndash: '–',
  quot: '"',
  raquo: '»',
  rdquo: '”',
  reg: '®',
  rsquo: '’',
  trade: '™',
});

export class LinuxDoSearchAdapter {
  readonly #document: Document;
  readonly #fetch: ((input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) | null;

  constructor(document: Document, options: LinuxDoSearchAdapterOptions = {}) {
    this.#document = document;
    const documentWindow = document.defaultView;
    this.#fetch =
      options.fetch ?? (documentWindow ? (input, init) => documentWindow.fetch(input, init) : null);
  }

  async search(rawQuery: string, signal: AbortSignal): Promise<LinuxDoSearchOutcome> {
    const query = normalizeQuery(rawQuery);
    if (!query) return { items: [], kind: 'results', query };
    if (!this.#fetch || !this.#document.location.origin) {
      return searchError(
        query,
        'search-unavailable',
        'Linux DO search is unavailable right now.',
        true,
      );
    }

    const url = new URL(SEARCH_ENDPOINT, this.#document.location.origin);
    url.searchParams.set('term', query);
    const headers = new Headers({ Accept: 'application/json' });
    const sessionId = this.#document
      .querySelector<HTMLMetaElement>('meta[name="discourse-track-view-session-id"]')
      ?.content.trim();
    if (sessionId) headers.set('Discourse-Pageview-Session-Id', sessionId);

    try {
      const response = await this.#fetch(url, {
        credentials: 'same-origin',
        headers,
        method: 'GET',
        signal,
      });
      if (!response.ok) {
        const message = await readFailureMessage(response);
        if (response.status === 404 || response.status === 410) {
          return searchError(
            query,
            'search-unavailable',
            message ?? 'Linux DO did not expose a compatible search endpoint.',
            false,
          );
        }
        return searchError(
          query,
          'request-failed',
          message ?? searchStatusMessage(response.status),
          response.status >= 500 || response.status === 409 || response.status === 429,
        );
      }
      const payload: unknown = await response.json();
      const declaredError = readSearchPayloadError(payload);
      if (declaredError) {
        return searchError(query, 'request-failed', declaredError, true);
      }
      const items = normalizeSearchResults(payload, this.#document);
      if (!items) {
        return searchError(
          query,
          'invalid-response',
          'Linux DO returned an unreadable search response.',
          true,
        );
      }
      return { items, kind: 'results', query };
    } catch (error: unknown) {
      if (signal.aborted || isAbortError(error)) return { kind: 'aborted', query };
      return searchError(query, 'request-failed', 'Linux DO search could not be reached.', true);
    }
  }
}

export function createLinuxDoSearchRoute(query: string, document: Document): LinuxDoRoute {
  const url = new URL('/search', document.location.origin);
  const normalized = normalizeQuery(query);
  if (normalized) url.searchParams.set('q', normalized);
  return recognizeLinuxDoRoute(url);
}

function normalizeSearchResults(
  payload: unknown,
  document: Document,
): readonly LinuxDoSearchResult[] | null {
  if (!isRecord(payload)) return null;
  const origin = document.location.origin;
  const topicMap = new Map<number, Record<string, unknown>>();
  for (const topic of readRecords(payload.topics)) {
    const id = readPositiveInteger(topic.id);
    if (id !== null) topicMap.set(id, topic);
  }

  const results: LinuxDoSearchResult[] = [];
  for (const post of readRecords(payload.posts)) {
    const topicId = readPositiveInteger(post.topic_id);
    const nestedTopic = isRecord(post.topic) ? post.topic : null;
    const effectiveTopicId = topicId ?? readPositiveInteger(nestedTopic?.id);
    const topic =
      (effectiveTopicId === null ? null : topicMap.get(effectiveTopicId)) ?? nestedTopic;
    const slug = readString(topic?.slug);
    const postNumber = readPositiveInteger(post.post_number);
    if (effectiveTopicId === null || !slug || postNumber === null) continue;
    const path = `/t/${encodeURIComponent(slug)}/${String(effectiveTopicId)}/${String(postNumber)}`;
    const url = new URL(path, origin).href;
    const route = recognizeLinuxDoRoute(url);
    if (route.kind !== 'topic') continue;
    const label =
      cleanText(readString(topic?.fancy_title)) ??
      cleanText(readString(topic?.title)) ??
      `Topic ${String(effectiveTopicId)}`;
    const username = readString(post.username);
    const excerpt = cleanText(readString(post.blurb));
    results.push({
      description: [`Post ${String(postNumber)}`, username ? `@${username}` : null, excerpt]
        .filter((part): part is string => Boolean(part))
        .join(' · '),
      id: `post:${String(readPositiveInteger(post.id) ?? effectiveTopicId)}:${String(postNumber)}`,
      kind: 'post',
      label,
      route,
      url,
    });
  }

  for (const category of readRecords(payload.categories)) {
    const model = isRecord(category.model) ? category.model : category;
    const id = readPositiveInteger(category.id) ?? readPositiveInteger(model.id);
    const slug = readString(category.slug) ?? readString(model.slug);
    const name = cleanText(readString(category.name) ?? readString(model.name));
    if (id === null || !slug || !name) continue;
    const candidate =
      readString(category.topic_url) ??
      readString(model.topic_url) ??
      `/c/${encodeURIComponent(slug)}/${String(id)}`;
    addRouteResult(results, origin, candidate, {
      description:
        cleanText(
          readString(category.description_text) ??
            readString(category.description_excerpt) ??
            readString(model.description_text) ??
            readString(model.description_excerpt),
        ) ?? `Category ${String(id)}`,
      id: `category:${String(id)}`,
      kind: 'category',
      label: name,
    });
  }

  for (const tag of readRecords(payload.tags)) {
    const id = readPositiveInteger(tag.id);
    const name = cleanText(readString(tag.name));
    const slug = readString(tag.slug);
    if (id === null || !name) continue;
    addRouteResult(
      results,
      origin,
      `/tag/${encodeURIComponent(slug ?? `${String(id)}-tag`)}/${String(id)}`,
      {
        description: cleanText(readString(tag.description)) ?? `Tag ${String(id)}`,
        id: `tag:${String(id)}`,
        kind: 'tag',
        label: name,
      },
    );
  }

  for (const user of readRecords(payload.users)) {
    const username = readString(user.username);
    if (!username) continue;
    const name = cleanText(readString(user.name));
    addRouteResult(results, origin, `/u/${encodeURIComponent(username)}`, {
      description: name ? `@${username} · ${name}` : `@${username}`,
      id: `user:${String(readPositiveInteger(user.id) ?? username.toLowerCase())}`,
      kind: 'user',
      label: name ?? username,
    });
  }

  const unique = new Map<string, LinuxDoSearchResult>();
  for (const result of results) unique.set(`${result.kind}:${result.url}`, result);
  return [...unique.values()].slice(0, MAX_RESULTS);
}

function addRouteResult(
  results: LinuxDoSearchResult[],
  origin: string,
  path: string,
  fields: Omit<LinuxDoSearchResult, 'route' | 'url'>,
): void {
  let url: URL;
  try {
    url = new URL(path, origin);
  } catch {
    return;
  }
  if (url.origin !== origin) return;
  const route = recognizeLinuxDoRoute(url);
  if (route.kind === 'unsupported') return;
  results.push({ ...fields, route, url: url.href });
}

function cleanText(value: string | null): string | null {
  if (!value) return null;
  const text = decodeHtmlEntities(value.replace(HTML_TAG_PATTERN, ' '))
    .replace(/\s+/gu, ' ')
    .trim();
  return text || null;
}

function decodeHtmlEntities(value: string): string {
  return value.replace(
    HTML_ENTITY_PATTERN,
    (
      entity,
      decimal: string | undefined,
      hexadecimal: string | undefined,
      named: string | undefined,
    ) => {
      if (named) return HTML_NAMED_ENTITIES[named.toLowerCase()] ?? entity;
      const codePoint = Number.parseInt(decimal ?? hexadecimal ?? '', hexadecimal ? 16 : 10);
      return isSafeCodePoint(codePoint) ? String.fromCodePoint(codePoint) : entity;
    },
  );
}

function isSafeCodePoint(value: number): boolean {
  return (
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= 0x10ffff &&
    (value < 0xd800 || value > 0xdfff)
  );
}

function normalizeQuery(value: string): string {
  return value.replace(/\s+/gu, ' ').trim();
}

function readRecords(value: unknown): readonly Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readPositiveInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function readSearchPayloadError(payload: unknown): string | null {
  if (!isRecord(payload)) return null;
  const groupedResult = isRecord(payload.grouped_search_result)
    ? payload.grouped_search_result
    : null;
  const errors = Array.isArray(payload.errors) ? payload.errors : [];
  const listedError = errors.find(
    (error): error is string => typeof error === 'string' && Boolean(error.trim()),
  );
  return (
    readString(payload.message) ??
    readString(payload.error) ??
    readString(groupedResult?.error) ??
    readString(listedError)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readFailureMessage(response: Response): Promise<string | null> {
  try {
    const payload: unknown = await response.json();
    if (!isRecord(payload)) return null;
    return readString(payload.message) ?? readString(payload.error);
  } catch {
    return null;
  }
}

function searchStatusMessage(status: number): string {
  if (status === 400 || status === 422) return 'Linux DO rejected this search query.';
  if (status === 409) return 'Linux DO search is temporarily overloaded.';
  if (status === 429) return 'Linux DO search is temporarily rate limited.';
  return 'Linux DO search failed.';
}

function searchError(
  query: string,
  code: Extract<LinuxDoSearchOutcome, { readonly kind: 'error' }>['code'],
  message: string,
  retryable: boolean,
): LinuxDoSearchOutcome {
  return { code, kind: 'error', message, query, retryable };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
