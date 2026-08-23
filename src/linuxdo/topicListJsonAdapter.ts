import type { TopicListExtraction, TopicListIssue, TopicListItem } from './topicListAdapter';

export interface TopicListJsonPage {
  readonly extraction: TopicListExtraction;
  readonly moreTopicsUrl: string | null;
}

export function extractTopicListJsonPage(payload: unknown, origin: string): TopicListJsonPage {
  if (!isRecord(payload) || !isRecord(payload.topic_list)) return unreadableTopicListPage();
  const rawTopics = payload.topic_list.topics;
  if (!Array.isArray(rawTopics)) return unreadableTopicListPage();
  const moreTopicsUrl = readString(payload.topic_list.more_topics_url);
  if (rawTopics.length === 0) {
    return { extraction: { issues: [], state: 'empty', topics: [] }, moreTopicsUrl };
  }

  const users = new Map<number, string>();
  for (const user of readRecords(payload.users)) {
    const id = readPositiveInteger(user.id);
    const username = readString(user.username);
    if (id !== null && username) users.set(id, username);
  }

  const issues: TopicListIssue[] = [];
  const topics: TopicListItem[] = [];
  const topicIds = new Set<number>();
  readRecords(rawTopics).forEach((topic, rowIndex) => {
    const item = normalizeTopic(topic, rowIndex, origin, users, issues);
    if (!item) return;
    if (topicIds.has(item.id)) {
      issues.push({ code: 'duplicate-topic', rowIndex });
      return;
    }
    topicIds.add(item.id);
    topics.push(item);
  });
  return {
    extraction:
      topics.length > 0
        ? { issues, state: 'ready', topics }
        : { code: 'topic-rows-unreadable', issues, state: 'error', topics: [] },
    moreTopicsUrl,
  };
}

function normalizeTopic(
  topic: Record<string, unknown>,
  rowIndex: number,
  origin: string,
  users: ReadonlyMap<number, string>,
  issues: TopicListIssue[],
): TopicListItem | null {
  const id = readPositiveInteger(topic.id);
  const slug = readString(topic.slug);
  const title = readString(topic.title);
  if (id === null || !slug || !title) {
    issues.push({ code: 'missing-topic-identity', rowIndex });
    return null;
  }

  const topicUrl = new URL(`/t/${encodeURIComponent(slug)}/${String(id)}`, origin).href;
  const participants = normalizeParticipants(topic, origin, users);
  const replyCount = readNonNegativeInteger(topic.reply_count);
  const viewCount = readNonNegativeInteger(topic.views);
  const highestPostNumber = readPositiveInteger(topic.highest_post_number);
  const timestamp = normalizeTimestamp(readString(topic.last_posted_at));
  const activity = timestamp
    ? {
        label: formatActivityLabel(timestamp),
        lastPostNumber: highestPostNumber,
        timestamp,
        url: highestPostNumber ? `${topicUrl}/${String(highestPostNumber)}` : topicUrl,
      }
    : null;

  if (participants.length === 0) issues.push({ code: 'missing-participants', rowIndex });
  if (replyCount === null) issues.push({ code: 'missing-reply-count', rowIndex });
  if (viewCount === null) issues.push({ code: 'missing-view-count', rowIndex });
  if (!activity) issues.push({ code: 'missing-activity', rowIndex });

  return {
    activity,
    category: null,
    completeness:
      participants.length > 0 && replyCount !== null && viewCount !== null && activity
        ? 'complete'
        : 'partial',
    hasExcerpt: Boolean(readString(topic.excerpt)),
    id,
    participants,
    pinned: topic.pinned === true,
    readState:
      topic.unseen === true
        ? 'new'
        : (readNonNegativeInteger(topic.unread_posts) ?? 0) > 0
          ? 'unread'
          : readPositiveInteger(topic.last_read_post_number) !== null
            ? 'read'
            : 'unknown',
    replyCount: replyCount === null ? null : { precision: 'exact', value: replyCount },
    tags: normalizeTags(topic.tags, origin),
    title,
    url: topicUrl,
    viewCount: viewCount === null ? null : { precision: 'exact', value: viewCount },
  };
}

function normalizeParticipants(
  topic: Record<string, unknown>,
  origin: string,
  users: ReadonlyMap<number, string>,
): TopicListItem['participants'] {
  const lastPoster = readString(topic.last_poster_username);
  const participants = new Map<string, TopicListItem['participants'][number]>();
  readRecords(topic.posters).forEach((poster, index) => {
    const userId = readPositiveInteger(poster.user_id);
    const username = readString(poster.username) ?? (userId === null ? null : users.get(userId));
    if (!username || participants.has(username)) return;
    const extras = readString(poster.extras)?.toLowerCase() ?? '';
    participants.set(username, {
      isLatestPoster: username === lastPoster || extras.includes('latest'),
      isOriginalPoster: index === 0 || extras.includes('original'),
      url: new URL(`/u/${encodeURIComponent(username)}`, origin).href,
      username,
    });
  });
  return [...participants.values()];
}

function normalizeTags(value: unknown, origin: string): TopicListItem['tags'] {
  if (!Array.isArray(value)) return [];
  const tags = new Map<string, TopicListItem['tags'][number]>();
  for (const rawTag of value) {
    const record = isRecord(rawTag) ? rawTag : null;
    const slug = record ? readString(record.slug) : readString(rawTag);
    const name = record ? (readString(record.name) ?? slug) : slug;
    if (!slug || !name || tags.has(slug)) continue;
    tags.set(slug, {
      id: record ? readPositiveInteger(record.id) : null,
      name,
      slug,
      url: new URL(`/tag/${encodeURIComponent(slug)}`, origin).href,
    });
  }
  return [...tags.values()];
}

function formatActivityLabel(timestamp: string): string {
  const elapsed = Math.max(0, Date.now() - Date.parse(timestamp));
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${String(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${String(hours)}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${String(days)}d`;
  return timestamp.slice(0, 10);
}

function normalizeTimestamp(value: string | null): string | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString();
}

function unreadableTopicListPage(): TopicListJsonPage {
  return {
    extraction: { code: 'topic-rows-unreadable', issues: [], state: 'error', topics: [] },
    moreTopicsUrl: null,
  };
}

function readRecords(value: unknown): readonly Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function readPositiveInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function readNonNegativeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
