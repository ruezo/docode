export interface TopicViewportState {
  readonly clientHeight: number;
  readonly currentPostId: number | null;
  readonly scrollHeight: number;
  readonly scrollProgress: number;
  readonly scrollTop: number;
  readonly start: number;
  readonly size: number;
}

export interface TopicScrollRequest {
  readonly progress: number;
  readonly scrollTop?: number;
  readonly sequence: number;
}

export function createTopicViewportState(
  metrics: {
    readonly clientHeight: number;
    readonly scrollHeight: number;
    readonly scrollTop: number;
  },
  currentPostId: number | null,
): TopicViewportState {
  const clientHeight = Math.max(0, metrics.clientHeight);
  const scrollHeight = Math.max(clientHeight, metrics.scrollHeight);
  const maximumScrollTop = Math.max(0, scrollHeight - clientHeight);
  const scrollTop = clamp(metrics.scrollTop, 0, maximumScrollTop);
  return {
    clientHeight,
    currentPostId,
    scrollHeight,
    scrollProgress: maximumScrollTop > 0 ? scrollTop / maximumScrollTop : 0,
    scrollTop,
    start: scrollHeight > 0 ? scrollTop / scrollHeight : 0,
    size: scrollHeight > 0 ? clamp(clientHeight / scrollHeight, 0, 1) : 1,
  };
}

export function getScrollTopForProgress(
  progress: number,
  scrollHeight: number,
  clientHeight: number,
): number {
  return clamp(progress, 0, 1) * Math.max(0, scrollHeight - clientHeight);
}

export function clampProgress(progress: number): number {
  return clamp(progress, 0, 1);
}

export function findViewportPostId(
  surface: HTMLElement,
  replies: readonly { readonly id: number }[],
  elements: ReadonlyMap<number, HTMLElement>,
  fallbackPostId: number | null,
): number | null {
  const surfaceRect = surface.getBoundingClientRect();
  if (surfaceRect.height <= 0) return fallbackPostId;
  const viewportCenter = surfaceRect.top + Math.min(surfaceRect.height, surface.clientHeight) / 2;
  const connectedReplies = replies.filter(({ id }) => elements.has(id));
  let lower = 0;
  let upper = connectedReplies.length - 1;
  let nearest: { readonly distance: number; readonly postId: number } | null = null;
  while (lower <= upper) {
    const middle = Math.floor((lower + upper) / 2);
    const reply = connectedReplies[middle];
    const element = reply ? elements.get(reply.id) : undefined;
    if (!reply || !element) break;
    const rect = element.getBoundingClientRect();
    const distance = distanceFromViewportCenter(rect, viewportCenter);
    if (!nearest || distance < nearest.distance) nearest = { distance, postId: reply.id };
    if (distance === 0) return reply.id;
    if (rect.bottom < viewportCenter) lower = middle + 1;
    else upper = middle - 1;
  }
  for (const index of new Set([lower - 1, lower, upper, upper + 1])) {
    const reply = connectedReplies[index];
    const element = reply ? elements.get(reply.id) : undefined;
    if (!reply || !element) continue;
    const distance = distanceFromViewportCenter(element.getBoundingClientRect(), viewportCenter);
    if (!nearest || distance < nearest.distance) nearest = { distance, postId: reply.id };
  }
  return nearest?.postId ?? fallbackPostId;
}

function distanceFromViewportCenter(rect: DOMRect, viewportCenter: number): number {
  if (viewportCenter < rect.top) return rect.top - viewportCenter;
  if (viewportCenter > rect.bottom) return viewportCenter - rect.bottom;
  return 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
