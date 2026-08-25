type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface LinuxDoCategoryItem {
  readonly color: string | null;
  readonly description: string | null;
  readonly id: number;
  readonly name: string;
  readonly slug: string;
  readonly topicCount: number;
  readonly url: string;
}

export interface LinuxDoTagItem {
  readonly count: number;
  readonly name: string;
  readonly url: string;
}

export type CategoriesLoadOutcome =
  | { readonly categories: readonly LinuxDoCategoryItem[]; readonly kind: 'ready' }
  | { readonly kind: 'aborted' | 'unavailable' };

export type TagsLoadOutcome =
  | { readonly kind: 'ready'; readonly tags: readonly LinuxDoTagItem[] }
  | { readonly kind: 'aborted' | 'unavailable' };

export class LinuxDoTaxonomyLoader {
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

  async loadCategories(signal: AbortSignal): Promise<CategoriesLoadOutcome> {
    const payload = await this.#loadJson('/categories.json', signal);
    if (payload.kind !== 'ready') return payload;
    const categories = extractCategories(payload.value, payload.origin);
    if (categories === null) return { kind: 'unavailable' };
    return { categories, kind: 'ready' };
  }

  async loadTags(signal: AbortSignal): Promise<TagsLoadOutcome> {
    const payload = await this.#loadJson('/tags.json', signal);
    if (payload.kind !== 'ready') return payload;
    const tags = extractTags(payload.value, payload.origin);
    if (tags === null) return { kind: 'unavailable' };
    return { kind: 'ready', tags };
  }

  async #loadJson(
    pathname: '/categories.json' | '/tags.json',
    signal: AbortSignal,
  ): Promise<
    | { readonly kind: 'ready'; readonly origin: string; readonly value: unknown }
    | { readonly kind: 'aborted' | 'unavailable' }
  > {
    if (isAborted(signal)) return { kind: 'aborted' };
    if (!this.#fetch) return { kind: 'unavailable' };
    const origin = this.#document.location.origin;
    const url = new URL(pathname, origin);
    try {
      const response = await this.#fetch(url, {
        credentials: 'same-origin',
        headers: new Headers({ Accept: 'application/json' }),
        method: 'GET',
        signal,
      });
      if (isAborted(signal)) return { kind: 'aborted' };
      if (!response.ok) return { kind: 'unavailable' };
      const responseUrl = new URL(response.url || url.href);
      if (responseUrl.origin !== origin) return { kind: 'unavailable' };
      const value: unknown = await response.json();
      if (isAborted(signal)) return { kind: 'aborted' };
      return { kind: 'ready', origin, value };
    } catch (error) {
      if (isAborted(signal) || (error instanceof DOMException && error.name === 'AbortError')) {
        return { kind: 'aborted' };
      }
      return { kind: 'unavailable' };
    }
  }
}

function extractCategories(
  payload: unknown,
  origin: string,
): readonly LinuxDoCategoryItem[] | null {
  if (!isRecord(payload) || !isRecord(payload.category_list)) return null;
  const entries = payload.category_list.categories;
  if (!Array.isArray(entries)) return null;
  const categories: LinuxDoCategoryItem[] = [];
  for (const entry of entries) {
    const category = extractCategory(entry, origin);
    if (category) categories.push(category);
  }
  return categories;
}

function extractCategory(entry: unknown, origin: string): LinuxDoCategoryItem | null {
  if (!isRecord(entry)) return null;
  const parent = entry.parent_category_id;
  if (typeof parent === 'number') return null;
  const id = readPositiveInteger(entry.id);
  const name = readString(entry.name);
  const slug = readString(entry.slug);
  if (id === null || !name || !slug || slug.includes('/')) return null;
  const topicCount = readPositiveInteger(entry.topic_count) ?? 0;
  return {
    color: readHexColor(entry.color),
    description: readString(entry.description_text) ?? readString(entry.description),
    id,
    name,
    slug,
    topicCount,
    url: new URL(`/c/${encodeURIComponent(slug)}/${String(id)}`, origin).href,
  };
}

function extractTags(payload: unknown, origin: string): readonly LinuxDoTagItem[] | null {
  if (!isRecord(payload)) return null;
  const sources: unknown[] = [];
  if (Array.isArray(payload.tags)) sources.push(...(payload.tags as unknown[]));
  const extras = payload.extras;
  if (isRecord(extras) && Array.isArray(extras.tag_groups)) {
    for (const group of extras.tag_groups) {
      if (isRecord(group) && Array.isArray(group.tags)) sources.push(...(group.tags as unknown[]));
    }
  }
  if (sources.length === 0 && !Array.isArray(payload.tags)) return null;
  const tags = new Map<string, LinuxDoTagItem>();
  for (const entry of sources) {
    const tag = extractTag(entry, origin);
    if (tag && !tags.has(tag.name)) tags.set(tag.name, tag);
  }
  return [...tags.values()].sort(
    (left, right) => right.count - left.count || left.name.localeCompare(right.name),
  );
}

function extractTag(entry: unknown, origin: string): LinuxDoTagItem | null {
  if (!isRecord(entry)) return null;
  const name = readString(entry.name) ?? readString(entry.text) ?? readString(entry.id);
  if (!name) return null;
  return {
    count: readPositiveInteger(entry.count) ?? readPositiveInteger(entry.topic_count) ?? 0,
    name,
    url: new URL(`/tag/${encodeURIComponent(name)}`, origin).href,
  };
}

function isAborted(signal: AbortSignal): boolean {
  return signal.aborted;
}

function readHexColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/^#/u, '');
  return /^(?:[0-9a-f]{3}|[0-9a-f]{6})$/iu.test(normalized) ? `#${normalized}` : null;
}

function readPositiveInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
