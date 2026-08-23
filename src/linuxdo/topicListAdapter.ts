import { recognizeLinuxDoRoute, type LinuxDoRoute } from './routes';
import { isLinuxDoLocation } from './host';

const TOPIC_LIST_SELECTORS = {
  activityCell: 'td.activity',
  activityTime: '[data-time]',
  loading: 'main[aria-busy="true"], [role="progressbar"], .loading-container, .spinner',
  newBadge: '.badge-notification.new-topic',
  repliesCell: 'td.posts',
  rows: 'tbody tr',
  table: 'main table.topic-list, table.topic-list',
  topicTitle: 'td.main-link a.title[href], a.title.raw-topic-link[href]',
  unreadBadge: '.badge-notification.unread-posts',
  viewsCell: 'td.views',
} as const;
const DOCODE_OWNED_ROOT_SELECTOR = '[data-docode-workbench-root]';

export interface TopicListCategory {
  readonly id: number;
  readonly name: string;
  readonly slug: string | null;
  readonly url: string;
}

export interface TopicListCount {
  readonly precision: 'compact' | 'exact';
  readonly value: number;
}

export interface TopicListParticipant {
  readonly isLatestPoster: boolean;
  readonly isOriginalPoster: boolean;
  readonly url: string;
  readonly username: string;
}

export interface TopicListTag {
  readonly id: number | null;
  readonly name: string;
  readonly slug: string;
  readonly url: string;
}

export interface TopicListActivity {
  readonly label: string;
  readonly lastPostNumber: number | null;
  readonly timestamp: string | null;
  readonly url: string | null;
}

export interface TopicListItem {
  readonly activity: TopicListActivity | null;
  readonly category: TopicListCategory | null;
  readonly completeness: 'complete' | 'partial';
  readonly hasExcerpt: boolean;
  readonly id: number;
  readonly participants: readonly TopicListParticipant[];
  readonly pinned: boolean;
  readonly readState: TopicReadState;
  readonly replyCount: TopicListCount | null;
  readonly tags: readonly TopicListTag[];
  readonly title: string;
  readonly url: string;
  readonly viewCount: TopicListCount | null;
}

export type TopicReadState = 'new' | 'read' | 'unknown' | 'unread';

export type TopicListIssueCode =
  | 'duplicate-topic'
  | 'missing-activity'
  | 'missing-participants'
  | 'missing-reply-count'
  | 'missing-topic-identity'
  | 'missing-view-count';

export interface TopicListIssue {
  readonly code: TopicListIssueCode;
  readonly rowIndex: number;
}

export type TopicListExtraction =
  | {
      readonly issues: readonly [];
      readonly state: 'empty' | 'loading';
      readonly topics: readonly [];
    }
  | {
      readonly code: 'topic-list-not-found' | 'topic-rows-unreadable' | 'unsupported-route';
      readonly issues: readonly TopicListIssue[];
      readonly state: 'error';
      readonly topics: readonly [];
    }
  | {
      readonly issues: readonly TopicListIssue[];
      readonly state: 'ready';
      readonly topics: readonly TopicListItem[];
    };

export interface TopicListStatusSummary {
  readonly errorCode: Extract<TopicListExtraction, { state: 'error' }>['code'] | null;
  readonly issueCodes: readonly TopicListIssueCode[];
  readonly partialTopicCount: number;
  readonly state: TopicListExtraction['state'];
  readonly topicCount: number;
}

export function extractTopicList(document: Document, route: LinuxDoRoute): TopicListExtraction {
  if (route.kind !== 'topic-list') {
    return { code: 'unsupported-route', issues: [], state: 'error', topics: [] };
  }

  const table = document.querySelector<HTMLTableElement>(TOPIC_LIST_SELECTORS.table);
  if (!table) {
    return hasNativeTopicListLoadingEvidence(document)
      ? { issues: [], state: 'loading', topics: [] }
      : { code: 'topic-list-not-found', issues: [], state: 'error', topics: [] };
  }

  const rows = Array.from(table.querySelectorAll<HTMLTableRowElement>(TOPIC_LIST_SELECTORS.rows));
  if (rows.length === 0) return { issues: [], state: 'empty', topics: [] };

  const issues: TopicListIssue[] = [];
  const topics: TopicListItem[] = [];
  const topicIds = new Set<number>();
  rows.forEach((row, rowIndex) => {
    const topic = extractTopicListItem(document, row, rowIndex, issues);
    if (!topic) return;
    if (topicIds.has(topic.id)) {
      issues.push({ code: 'duplicate-topic', rowIndex });
      return;
    }
    topicIds.add(topic.id);
    topics.push(topic);
  });

  return topics.length === 0
    ? { code: 'topic-rows-unreadable', issues, state: 'error', topics: [] }
    : { issues, state: 'ready', topics };
}

function hasNativeTopicListLoadingEvidence(document: Document): boolean {
  return Array.from(document.querySelectorAll(TOPIC_LIST_SELECTORS.loading)).some(
    (element) => element.closest(DOCODE_OWNED_ROOT_SELECTOR) === null,
  );
}

export function summarizeTopicListExtraction(
  extraction: TopicListExtraction,
): TopicListStatusSummary {
  return {
    errorCode: extraction.state === 'error' ? extraction.code : null,
    issueCodes: [...new Set(extraction.issues.map(({ code }) => code))],
    partialTopicCount:
      extraction.state === 'ready'
        ? extraction.topics.filter(({ completeness }) => completeness === 'partial').length
        : 0,
    state: extraction.state,
    topicCount: extraction.topics.length,
  };
}

function extractTopicListItem(
  document: Document,
  row: HTMLTableRowElement,
  rowIndex: number,
  issues: TopicListIssue[],
): TopicListItem | null {
  const links = Array.from(row.querySelectorAll<HTMLAnchorElement>('a[href]')).flatMap((link) => {
    const url = toSupportedUrl(link.getAttribute('href'), document.baseURI);
    return url ? [{ link, route: recognizeLinuxDoRoute(url), url }] : [];
  });
  const topicIdAttribute = toPositiveInteger(row.getAttribute('data-topic-id'));
  const semanticTitleLink = row.querySelector<HTMLAnchorElement>(TOPIC_LIST_SELECTORS.topicTitle);
  const topicLink = semanticTitleLink
    ? links.find(({ link }) => link === semanticTitleLink)
    : (links.find(
        ({ route }) =>
          route.kind === 'topic' &&
          route.postNumber === null &&
          (topicIdAttribute === null || route.topicId === topicIdAttribute),
      ) ?? links.find(({ route }) => route.kind === 'topic' && route.postNumber === null));
  const title = normalizeText(topicLink?.link.textContent);
  if (topicLink?.route.kind !== 'topic' || !title) {
    issues.push({ code: 'missing-topic-identity', rowIndex });
    return null;
  }
  const topicId = topicIdAttribute ?? topicLink.route.topicId;
  if (topicId !== topicLink.route.topicId) {
    issues.push({ code: 'missing-topic-identity', rowIndex });
    return null;
  }

  const category = extractCategory(links);
  const tags = extractTags(links);
  const participants = extractParticipants(links);
  const replyCount = extractCount(row.querySelector(TOPIC_LIST_SELECTORS.repliesCell));
  const viewCount = extractCount(row.querySelector(TOPIC_LIST_SELECTORS.viewsCell));
  const activity = extractActivity(row, links, topicId);

  if (participants.length === 0) issues.push({ code: 'missing-participants', rowIndex });
  if (!replyCount) issues.push({ code: 'missing-reply-count', rowIndex });
  if (!viewCount) issues.push({ code: 'missing-view-count', rowIndex });
  if (!activity) issues.push({ code: 'missing-activity', rowIndex });

  return {
    activity,
    category,
    completeness:
      participants.length > 0 && replyCount && viewCount && activity ? 'complete' : 'partial',
    hasExcerpt: row.classList.contains('has-excerpt'),
    id: topicId,
    participants,
    pinned: row.classList.contains('pinned'),
    readState: extractReadState(row),
    replyCount,
    tags,
    title,
    url: topicLink.url.href,
    viewCount,
  };
}

function extractReadState(row: HTMLTableRowElement): TopicListItem['readState'] {
  if (row.classList.contains('unseen-topic') || row.querySelector(TOPIC_LIST_SELECTORS.newBadge)) {
    return 'new';
  }
  if (
    row.classList.contains('unread-posts') ||
    row.querySelector(TOPIC_LIST_SELECTORS.unreadBadge)
  ) {
    return 'unread';
  }
  return row.classList.contains('visited') ? 'read' : 'unknown';
}

interface ExtractedLink {
  readonly link: HTMLAnchorElement;
  readonly route: LinuxDoRoute;
  readonly url: URL;
}

function extractCategory(links: readonly ExtractedLink[]): TopicListCategory | null {
  const categoryLink = links.find(
    (
      candidate,
    ): candidate is ExtractedLink & {
      readonly route: Extract<LinuxDoRoute, { view: 'category' }>;
    } => candidate.route.kind === 'topic-list' && candidate.route.view === 'category',
  );
  const name = normalizeText(categoryLink?.link.textContent);
  return categoryLink && name
    ? {
        id: categoryLink.route.categoryId,
        name,
        slug: categoryLink.route.categorySlug,
        url: categoryLink.url.href,
      }
    : null;
}

function extractTags(links: readonly ExtractedLink[]): TopicListTag[] {
  const tags = new Map<string, TopicListTag>();
  for (const candidate of links) {
    if (candidate.route.kind !== 'topic-list' || candidate.route.view !== 'tag') continue;
    const name = normalizeText(candidate.link.textContent);
    if (!name || tags.has(candidate.route.tagSlug)) continue;
    tags.set(candidate.route.tagSlug, {
      id: candidate.route.tagId,
      name,
      slug: candidate.route.tagSlug,
      url: candidate.url.href,
    });
  }
  return [...tags.values()];
}

function extractParticipants(links: readonly ExtractedLink[]): TopicListParticipant[] {
  const participants = new Map<string, TopicListParticipant>();
  for (const candidate of links) {
    if (candidate.route.kind !== 'user' || participants.has(candidate.route.username)) continue;
    participants.set(candidate.route.username, {
      isLatestPoster: candidate.link.classList.contains('latest'),
      isOriginalPoster: participants.size === 0,
      url: candidate.url.href,
      username: candidate.route.username,
    });
  }
  return [...participants.values()];
}

function extractActivity(
  row: HTMLTableRowElement,
  links: readonly ExtractedLink[],
  topicId: number,
): TopicListActivity | null {
  const cell = row.querySelector<HTMLElement>(TOPIC_LIST_SELECTORS.activityCell);
  if (!cell) return null;
  const activityLink = links.find(
    ({ link, route }) => cell.contains(link) && route.kind === 'topic' && route.topicId === topicId,
  );
  const label = normalizeText(activityLink?.link.textContent ?? cell.textContent);
  if (!label) return null;
  const timeValue = cell
    .querySelector(TOPIC_LIST_SELECTORS.activityTime)
    ?.getAttribute('data-time');

  return {
    label,
    lastPostNumber: activityLink?.route.kind === 'topic' ? activityLink.route.postNumber : null,
    timestamp: toIsoTimestamp(timeValue ?? null),
    url: activityLink?.url.href ?? null,
  };
}

function extractCount(container: Element | null): TopicListCount | null {
  if (!container) return null;
  const exactText =
    container.querySelector('[aria-label]')?.getAttribute('aria-label') ??
    container.querySelector('[title]')?.getAttribute('title') ??
    container.getAttribute('aria-label') ??
    container.getAttribute('title');
  const exactValue = extractFirstInteger(exactText);
  if (exactValue !== null) return { precision: 'exact', value: exactValue };

  const compactValue = parseCompactCount(normalizeText(container.textContent));
  return compactValue === null ? null : { precision: 'compact', value: compactValue };
}

function extractFirstInteger(value: string | null): number | null {
  const match = value?.match(/\d[\d,.\s]*/)?.[0];
  if (!match) return null;
  const digits = match.replace(/\D/g, '');
  const parsed = Number(digits);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function parseCompactCount(value: string): number | null {
  const match = /^(\d+(?:[.,]\d+)?)\s*([km])?$/.exec(value.toLowerCase());
  if (!match) return null;
  const amount = Number(match[1]?.replace(',', '.'));
  if (!Number.isFinite(amount)) return null;
  const multiplier = match[2] === 'm' ? 1_000_000 : match[2] === 'k' ? 1_000 : 1;
  const parsed = Math.round(amount * multiplier);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function toIsoTimestamp(value: string | null): string | null {
  if (!value) return null;
  const numericValue = Number(value);
  const timestamp = Number.isFinite(numericValue) ? numericValue : Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  const date = new Date(timestamp);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

function toPositiveInteger(value: string | null): number | null {
  if (!value || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function toSupportedUrl(href: string | null, baseHref: string): URL | null {
  if (!href) return null;
  try {
    const url = new URL(href, baseHref);
    return isLinuxDoLocation(url) ? url : null;
  } catch {
    return null;
  }
}

function normalizeText(value: string | null | undefined): string {
  return value?.replace(/\s+/g, ' ').trim() ?? '';
}
