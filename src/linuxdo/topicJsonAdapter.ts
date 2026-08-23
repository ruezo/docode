type JsonRecord = Readonly<Record<string, unknown>>;

export interface TopicJsonPost {
  readonly avatarTemplate: string | null;
  readonly cooked: string;
  readonly createdAt: string;
  readonly displayName: string;
  readonly id: number;
  readonly number: number;
  readonly replyToPostNumber: number | null;
  readonly topicId: number;
  readonly userId: number | null;
  readonly username: string;
}

export interface TopicJsonPage {
  readonly id: number | null;
  readonly postIds: readonly number[];
  readonly posts: readonly TopicJsonPost[];
  readonly title: string | null;
}

export function extractTopicJsonPage(payload: unknown, topicId: number): TopicJsonPage | null {
  const root = toRecord(payload);
  const postStream = toRecord(root?.post_stream);
  const stream = postStream?.stream;
  if (!Array.isArray(stream)) return null;
  const postIds = stream.map(toPositiveInteger);
  if (postIds.some((id) => id === null) || new Set(postIds).size !== postIds.length) return null;
  const posts = extractTopicJsonPosts(payload, topicId);
  return posts
    ? {
        id: toPositiveInteger(root?.id),
        postIds: postIds as number[],
        posts,
        title: normalizeText(root?.title) || null,
      }
    : null;
}

export function extractTopicJsonPosts(
  payload: unknown,
  topicId: number,
): readonly TopicJsonPost[] | null {
  const root = toRecord(payload);
  const postStream = toRecord(root?.post_stream);
  if (!Array.isArray(postStream?.posts)) return null;
  const posts = postStream.posts.map((value) => extractPost(value, topicId));
  if (posts.some((post) => post === null)) return null;
  const ready = posts as TopicJsonPost[];
  return new Set(ready.map(({ id }) => id)).size === ready.length ? ready : null;
}

function extractPost(value: unknown, topicId: number): TopicJsonPost | null {
  const post = toRecord(value);
  const id = toPositiveInteger(post?.id);
  const number = toPositiveInteger(post?.post_number);
  const postTopicId = toPositiveInteger(post?.topic_id);
  const username = normalizeUsername(post?.username);
  const createdAt = toIsoTimestamp(post?.created_at);
  if (
    !post ||
    id === null ||
    number === null ||
    postTopicId !== topicId ||
    !username ||
    !createdAt ||
    typeof post.cooked !== 'string'
  ) {
    return null;
  }
  const displayName = normalizeText(post.name) || username;
  const avatarTemplate = normalizeAvatarTemplate(post.avatar_template);
  const userId = post.user_id === null ? null : toPositiveInteger(post.user_id);
  const replyToPostNumber = toOptionalPositiveInteger(post.reply_to_post_number);
  if (post.user_id !== null && post.user_id !== undefined && userId === null) return null;
  if (replyToPostNumber === undefined || (replyToPostNumber ?? 0) >= number) return null;
  return {
    avatarTemplate,
    cooked: post.cooked,
    createdAt,
    displayName,
    id,
    number,
    replyToPostNumber,
    topicId,
    userId,
    username,
  };
}

function normalizeAvatarTemplate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const template = value.trim();
  return template && template.length <= 2_048 ? template : null;
}

function toOptionalPositiveInteger(value: unknown): number | null | undefined {
  if (value === null || value === undefined) return null;
  return toPositiveInteger(value) ?? undefined;
}

function toRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function toPositiveInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function toIsoTimestamp(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/gu, ' ').trim() : '';
}

function normalizeUsername(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const username = value.trim();
  return username && !/[\s/\\?#]/u.test(username) ? username : null;
}
