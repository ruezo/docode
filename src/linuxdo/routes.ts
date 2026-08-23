import { isLinuxDoLocation } from './host';

interface RouteBase {
  readonly hash: string;
  readonly href: string;
  readonly pathname: string;
  readonly search: string;
}

export type TopicListView = 'category' | 'hot' | 'latest' | 'new' | 'tag' | 'top' | 'unread';
export type LinuxDoRouteFamily =
  TopicListView | 'category-index' | 'search' | 'tag-index' | 'topic' | 'unsupported' | 'user';

export type LinuxDoRoute =
  | (RouteBase & {
      readonly categoryId: number;
      readonly categorySlug: string | null;
      readonly kind: 'topic-list';
      readonly view: 'category';
    })
  | (RouteBase & {
      readonly kind: 'topic-list';
      readonly tagId: number | null;
      readonly tagSlug: string;
      readonly view: 'tag';
    })
  | (RouteBase & {
      readonly kind: 'topic-list';
      readonly view: 'hot' | 'latest' | 'new' | 'top' | 'unread';
    })
  | (RouteBase & { readonly kind: 'category-index' })
  | (RouteBase & { readonly kind: 'tag-index' })
  | (RouteBase & {
      readonly kind: 'topic';
      readonly postNumber: number | null;
      readonly topicId: number;
      readonly topicSlug: string;
    })
  | (RouteBase & {
      readonly kind: 'search';
      readonly query: string | null;
    })
  | (RouteBase & {
      readonly kind: 'user';
      readonly section: readonly string[];
      readonly username: string;
    })
  | (RouteBase & {
      readonly kind: 'unsupported';
      readonly reason: 'malformed-path' | 'unsupported-origin' | 'unsupported-path';
    });

export function recognizeLinuxDoRoute(input: string | URL): LinuxDoRoute {
  const url = toUrl(input);
  if (!url) return unsupportedRoute('malformed-path', String(input));

  const base = routeBase(url);
  if (!isLinuxDoLocation(url))
    return { ...base, kind: 'unsupported', reason: 'unsupported-origin' };

  const segments = decodePathSegments(url.pathname);
  if (!segments) return { ...base, kind: 'unsupported', reason: 'malformed-path' };
  if (segments.length === 0 || (segments.length === 1 && segments[0] === 'latest')) {
    return { ...base, kind: 'topic-list', view: 'latest' };
  }
  if (
    segments.length === 1 &&
    (segments[0] === 'hot' ||
      segments[0] === 'new' ||
      segments[0] === 'top' ||
      segments[0] === 'unread')
  ) {
    return { ...base, kind: 'topic-list', view: segments[0] };
  }
  if (segments.length === 1 && segments[0] === 'categories') {
    return { ...base, kind: 'category-index' };
  }
  if (segments.length === 1 && segments[0] === 'tags') {
    return { ...base, kind: 'tag-index' };
  }
  if (segments[0] === 'c') return recognizeCategoryRoute(base, segments);
  if (segments[0] === 'tag') return recognizeTagRoute(base, segments);
  if (segments[0] === 't') return recognizeTopicRoute(base, segments);
  if (segments.length === 1 && segments[0] === 'search') {
    return { ...base, kind: 'search', query: url.searchParams.get('q') };
  }
  if (segments[0] === 'u') return recognizeUserRoute(base, segments);
  return { ...base, kind: 'unsupported', reason: 'unsupported-path' };
}

export interface LinuxDoTopicListRouteFile {
  readonly access: 'authentication-dependent' | 'public';
  readonly label: 'hot' | 'latest' | 'new' | 'top' | 'unread';
  readonly route: Extract<LinuxDoRoute, { readonly kind: 'topic-list' }>;
}

const TOPIC_LIST_ROUTE_FILE_DEFINITIONS = [
  { access: 'public', label: 'latest' },
  { access: 'authentication-dependent', label: 'unread' },
  { access: 'authentication-dependent', label: 'new' },
  { access: 'public', label: 'top' },
  { access: 'public', label: 'hot' },
] as const;

const TOPIC_LIST_ROUTE_FILES: readonly LinuxDoTopicListRouteFile[] =
  TOPIC_LIST_ROUTE_FILE_DEFINITIONS.map(({ access, label }) => {
    const route = recognizeLinuxDoRoute(`https://linux.do/${label}`);
    if (route.kind !== 'topic-list') {
      throw new Error(`Invalid Linux DO topic-list route file: ${label}`);
    }
    return { access, label, route };
  });

export function getLinuxDoTopicListRouteFiles(): readonly LinuxDoTopicListRouteFile[] {
  return TOPIC_LIST_ROUTE_FILES;
}

export function getLinuxDoRouteFamily(route: LinuxDoRoute): LinuxDoRouteFamily {
  return route.kind === 'topic-list' ? route.view : route.kind;
}

function recognizeCategoryRoute(base: RouteBase, segments: readonly string[]): LinuxDoRoute {
  if (segments.length < 2) return { ...base, kind: 'unsupported', reason: 'malformed-path' };

  const categoryId = toPositiveInteger(segments.at(-1));
  if (categoryId === null) return { ...base, kind: 'unsupported', reason: 'malformed-path' };
  const slugSegments = segments.slice(1, -1);
  if (slugSegments.some((segment) => segment.length === 0)) {
    return { ...base, kind: 'unsupported', reason: 'malformed-path' };
  }

  return {
    ...base,
    categoryId,
    categorySlug: slugSegments.length === 0 ? null : slugSegments.join('/'),
    kind: 'topic-list',
    view: 'category',
  };
}

function recognizeTagRoute(base: RouteBase, segments: readonly string[]): LinuxDoRoute {
  const tagSlug = segments[1];
  if (segments.length < 2 || segments.length > 3 || !tagSlug) {
    return { ...base, kind: 'unsupported', reason: 'malformed-path' };
  }

  const tagId = segments.length === 3 ? toPositiveInteger(segments[2]) : null;
  if (segments.length === 3 && tagId === null) {
    return { ...base, kind: 'unsupported', reason: 'malformed-path' };
  }
  return {
    ...base,
    kind: 'topic-list',
    tagId,
    tagSlug,
    view: 'tag',
  };
}

function recognizeTopicRoute(base: RouteBase, segments: readonly string[]): LinuxDoRoute {
  const topicSlug = segments[1];
  if (segments.length < 3 || segments.length > 4 || !topicSlug) {
    return { ...base, kind: 'unsupported', reason: 'malformed-path' };
  }

  const topicId = toPositiveInteger(segments[2]);
  const postNumber = segments.length === 4 ? toPositiveInteger(segments[3]) : null;
  if (topicId === null || (segments.length === 4 && postNumber === null)) {
    return { ...base, kind: 'unsupported', reason: 'malformed-path' };
  }

  return {
    ...base,
    kind: 'topic',
    postNumber,
    topicId,
    topicSlug,
  };
}

function recognizeUserRoute(base: RouteBase, segments: readonly string[]): LinuxDoRoute {
  const username = segments[1];
  if (segments.length < 2 || !username) {
    return { ...base, kind: 'unsupported', reason: 'malformed-path' };
  }
  return {
    ...base,
    kind: 'user',
    section: segments.slice(2),
    username,
  };
}

function decodePathSegments(pathname: string): string[] | null {
  try {
    return pathname
      .split('/')
      .filter((segment) => segment.length > 0)
      .map((segment) => decodeURIComponent(segment));
  } catch {
    return null;
  }
}

function routeBase(url: URL): RouteBase {
  return {
    hash: url.hash,
    href: url.href,
    pathname: url.pathname,
    search: url.search,
  };
}

function toPositiveInteger(value: string | undefined): number | null {
  if (!value || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function toUrl(input: string | URL): URL | null {
  if (input instanceof URL) return input;
  try {
    return new URL(input);
  } catch {
    return null;
  }
}

function unsupportedRoute(
  reason: Extract<LinuxDoRoute, { kind: 'unsupported' }>['reason'],
  href: string,
): LinuxDoRoute {
  return { hash: '', href, kind: 'unsupported', pathname: '', reason, search: '' };
}
