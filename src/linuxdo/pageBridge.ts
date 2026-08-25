export const TOPIC_REPLY_SHORTCUT_EVENT = 'docode:topic-reply-shortcut';
export const POST_REPLY_OPEN_EVENT = 'docode:post-reply-open';
export const POST_REPLY_OPEN_RESULT_EVENT = 'docode:post-reply-open-result';
export const SPA_NAVIGATE_EVENT = 'docode:spa-navigate';
export const SPA_NAVIGATE_RESULT_EVENT = 'docode:spa-navigate-result';

export interface PostReplyOpenDetail {
  readonly postId: number;
  readonly postNumber: number;
  readonly topicId: number;
}

export interface PostReplyOpenResult {
  readonly ok: boolean;
}

export interface SpaNavigateDetail {
  readonly path: string;
}

export interface SpaNavigateResult {
  readonly ok: boolean;
  readonly path: string;
}

interface EmberOwner {
  readonly lookup: (name: string) => unknown;
}

export function dispatchTopicReplyShortcutKeys(document: Document): void {
  const target = document.body;
  for (const type of ['keydown', 'keypress', 'keyup'] as const) {
    const event = new KeyboardEvent(type, {
      bubbles: true,
      cancelable: true,
      code: 'KeyR',
      key: 'R',
      shiftKey: true,
    });
    Object.defineProperty(event, 'keyCode', { value: 82 });
    Object.defineProperty(event, 'which', { value: 82 });
    target.dispatchEvent(event);
  }
}

export function dispatchPostReplyOpen(document: Document, detail: PostReplyOpenDetail): void {
  document.dispatchEvent(
    new CustomEvent(POST_REPLY_OPEN_EVENT, { detail: JSON.stringify(detail) }),
  );
}

export function readPostReplyOpenDetail(event: Event): PostReplyOpenDetail | null {
  const parsed = parseDetail(event);
  const postId = readPositiveInteger(parsed, 'postId');
  const postNumber = readPositiveInteger(parsed, 'postNumber');
  const topicId = readPositiveInteger(parsed, 'topicId');
  return postId !== null && postNumber !== null && topicId !== null
    ? { postId, postNumber, topicId }
    : null;
}

export function readPostReplyOpenResult(event: Event): PostReplyOpenResult | null {
  const parsed = parseDetail(event);
  if (parsed === null || typeof parsed !== 'object') return null;
  const ok: unknown = Reflect.get(parsed, 'ok');
  return typeof ok === 'boolean' ? { ok } : null;
}

export function dispatchSpaNavigate(document: Document, detail: SpaNavigateDetail): void {
  document.dispatchEvent(new CustomEvent(SPA_NAVIGATE_EVENT, { detail: JSON.stringify(detail) }));
}

export function readSpaNavigateDetail(event: Event): SpaNavigateDetail | null {
  const parsed = parseDetail(event);
  if (parsed === null || typeof parsed !== 'object') return null;
  const path: unknown = Reflect.get(parsed, 'path');
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) return null;
  return { path };
}

export function readSpaNavigateResult(event: Event): SpaNavigateResult | null {
  const parsed = parseDetail(event);
  if (parsed === null || typeof parsed !== 'object') return null;
  const ok: unknown = Reflect.get(parsed, 'ok');
  const path: unknown = Reflect.get(parsed, 'path');
  return typeof ok === 'boolean' && typeof path === 'string' ? { ok, path } : null;
}

export function handleSpaNavigate(document: Document, event: Event): void {
  const detail = readSpaNavigateDetail(event);
  if (!detail) return;
  const ok = safeRouteThroughDiscourse(document, detail.path);
  document.dispatchEvent(
    new CustomEvent(SPA_NAVIGATE_RESULT_EVENT, {
      detail: JSON.stringify({ ok, path: detail.path }),
    }),
  );
}

function safeRouteThroughDiscourse(document: Document, path: string): boolean {
  try {
    return routeThroughDiscourse(document, path);
  } catch {
    return false;
  }
}

function routeThroughDiscourse(document: Document, path: string): boolean {
  const window = document.defaultView;
  if (!window) return false;
  const loader: unknown = Reflect.get(window, 'require');
  if (typeof loader !== 'function') return false;
  const module: unknown = Reflect.apply(loader, window, ['discourse/lib/url']);
  if (module === null || typeof module !== 'object') return false;
  const url: unknown = Reflect.get(module, 'default');
  if (url === null || typeof url !== 'object') return false;
  const routeTo: unknown = Reflect.get(url, 'routeTo');
  if (typeof routeTo !== 'function') return false;
  Reflect.apply(routeTo, url, [path]);
  return true;
}

export async function handlePostReplyOpen(document: Document, event: Event): Promise<void> {
  const detail = readPostReplyOpenDetail(event);
  if (!detail) return;
  const ok = await openNativeReplyComposer(document, detail).catch(() => false);
  document.dispatchEvent(
    new CustomEvent(POST_REPLY_OPEN_RESULT_EVENT, { detail: JSON.stringify({ ok }) }),
  );
}

export async function openNativeReplyComposer(
  document: Document,
  detail: PostReplyOpenDetail,
): Promise<boolean> {
  const window = document.defaultView;
  if (!window) return false;
  const owner = resolveEmberOwner(window);
  if (!owner) return false;
  const topic = resolveTopicModel(owner, detail.topicId);
  if (!topic) return false;
  const post = await resolvePostModel(topic, detail);
  if (!post) return false;
  const open = resolveComposerOpener(owner);
  if (!open) return false;
  await Promise.resolve(
    open({
      action: resolveReplyAction(window),
      draftKey: readEmberProperty(topic, 'draft_key'),
      draftSequence: readEmberProperty(topic, 'draft_sequence'),
      post,
      topic,
    }),
  );
  return true;
}

function parseDetail(event: Event): unknown {
  const raw: unknown = Reflect.get(event, 'detail');
  if (typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readPositiveInteger(source: unknown, key: string): number | null {
  if (source === null || typeof source !== 'object') return null;
  const value: unknown = Reflect.get(source, key);
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function resolveEmberOwner(window: Window): EmberOwner | null {
  return resolveLoaderOwner(window) ?? resolveGlobalOwner(window);
}

function resolveLoaderOwner(window: Window): EmberOwner | null {
  const loader: unknown = Reflect.get(window, 'require');
  if (typeof loader !== 'function') return null;
  for (const moduleId of ['discourse/lib/get-owner', 'discourse-common/lib/get-owner']) {
    const owner = resolveModuleOwner(loader, window, moduleId);
    if (owner) return owner;
  }
  return null;
}

function resolveModuleOwner(loader: unknown, window: Window, moduleId: string): EmberOwner | null {
  if (typeof loader !== 'function') return null;
  try {
    const module: unknown = Reflect.apply(loader, window, [moduleId]);
    if (module === null || typeof module !== 'object') return null;
    const resolve: unknown = Reflect.get(module, 'getOwnerWithFallback');
    if (typeof resolve !== 'function') return null;
    return toEmberOwner(Reflect.apply(resolve, module, [null]));
  } catch {
    return null;
  }
}

function resolveGlobalOwner(window: Window): EmberOwner | null {
  const discourse: unknown = Reflect.get(window, 'Discourse');
  if (discourse === null || typeof discourse !== 'object') return null;
  return toEmberOwner(Reflect.get(discourse, '__container__'));
}

function toEmberOwner(candidate: unknown): EmberOwner | null {
  if (candidate === null || typeof candidate !== 'object') return null;
  const lookup: unknown = Reflect.get(candidate, 'lookup');
  if (typeof lookup !== 'function') return null;
  return {
    lookup: (name: string) => Reflect.apply(lookup, candidate, [name]) as unknown,
  };
}

function ownerLookup(owner: EmberOwner, name: string): unknown {
  try {
    return owner.lookup(name);
  } catch {
    return null;
  }
}

function resolveTopicModel(owner: EmberOwner, topicId: number): object | null {
  const controller = ownerLookup(owner, 'controller:topic');
  const model = readEmberProperty(controller, 'model');
  if (model === null || typeof model !== 'object') return null;
  const id = readEmberProperty(model, 'id');
  return typeof id === 'number' && id === topicId ? model : null;
}

async function resolvePostModel(
  topic: object,
  detail: PostReplyOpenDetail,
): Promise<object | null> {
  const stream = readEmberProperty(topic, 'postStream');
  if (stream === null || typeof stream !== 'object') return null;
  const loaded = findLoadedPost(stream, detail.postNumber);
  if (loaded) return loaded;
  const find: unknown = Reflect.get(stream, 'findPostsByIds');
  if (typeof find !== 'function') return null;
  const outcome: unknown = await Promise.resolve(
    Reflect.apply(find, stream, [[detail.postId]]) as unknown,
  );
  for (const entry of toArray(outcome)) {
    if (entry !== null && typeof entry === 'object') return entry;
  }
  return null;
}

function findLoadedPost(stream: object, postNumber: number): object | null {
  for (const entry of toArray(readEmberProperty(stream, 'posts'))) {
    if (entry === null || typeof entry !== 'object') continue;
    if (readEmberProperty(entry, 'post_number') === postNumber) return entry;
  }
  return null;
}

function resolveComposerOpener(owner: EmberOwner): ((options: object) => unknown) | null {
  for (const name of ['service:composer', 'controller:composer']) {
    const candidate = ownerLookup(owner, name);
    if (candidate === null || typeof candidate !== 'object') continue;
    const open: unknown = Reflect.get(candidate, 'open');
    if (typeof open !== 'function') continue;
    return (options: object) => Reflect.apply(open, candidate, [options]) as unknown;
  }
  return null;
}

function resolveReplyAction(window: Window): string {
  const loader: unknown = Reflect.get(window, 'require');
  if (typeof loader !== 'function') return 'reply';
  try {
    const module: unknown = Reflect.apply(loader, window, ['discourse/models/composer']);
    if (module === null || typeof module !== 'object') return 'reply';
    const model: unknown = Reflect.get(module, 'default');
    if (model === null || typeof model !== 'object') return 'reply';
    const action: unknown = Reflect.get(model, 'REPLY');
    return typeof action === 'string' && action.length > 0 ? action : 'reply';
  } catch {
    return 'reply';
  }
}

function toArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value === null || typeof value !== 'object') return [];
  const convert: unknown = Reflect.get(value, 'toArray');
  if (typeof convert !== 'function') return [];
  const converted: unknown = Reflect.apply(convert, value, []);
  return Array.isArray(converted) ? converted : [];
}

function readEmberProperty(target: unknown, name: string): unknown {
  if (target === null || typeof target !== 'object') return null;
  const getter: unknown = Reflect.get(target, 'get');
  if (typeof getter === 'function') {
    try {
      return Reflect.apply(getter, target, [name]) as unknown;
    } catch {
      return null;
    }
  }
  return Reflect.get(target, name) as unknown;
}
