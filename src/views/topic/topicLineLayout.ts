import type { TopicDetailDocument, TopicReplyDocumentBlock } from './topicDetailDocument';
import { countReplyCodeContentLines } from './replyCodePlan';
import { findOriginalPosterUsername, isOriginalPosterReply } from './topicJavaSource';

type ReadyTopicDetailDocument = Extract<TopicDetailDocument, { readonly state: 'ready' }>;

export const TOPIC_HEADER_LINES = {
  classOpen: 4,
  importLine: 1,
  mottoImportLine: 2,
  metadata: 5,
} as const;

export interface TopicReplyLineLayout {
  readonly annotation: number | null;
  readonly boosts: number | null;
  readonly close: number;
  readonly contentStart: number;
  readonly metadata: number;
  readonly replyTarget: number | null;
  readonly save: number | null;
  readonly signature: number;
}

export interface TopicLineLayout {
  readonly replies: ReadonlyMap<number, TopicReplyLineLayout>;
  readonly topicClose: number;
}

export interface TopicLineLayoutOptions {
  readonly expandedContentPostIds?: ReadonlySet<number>;
  readonly forcedBoostPostIds?: ReadonlySet<number>;
}

export function createTopicLineLayout(
  document: ReadyTopicDetailDocument,
  options: TopicLineLayoutOptions = {},
): TopicLineLayout {
  const originalPoster = findOriginalPosterUsername(document.replies);
  let nextLine = TOPIC_HEADER_LINES.metadata + 1;
  const replies = new Map<number, TopicReplyLineLayout>();
  document.replies.forEach((reply) => {
    const layout = createReplyLineLayout(
      reply,
      nextLine,
      isOriginalPosterReply(reply, originalPoster),
      options.forcedBoostPostIds?.has(reply.id) ?? false,
      options.expandedContentPostIds?.has(reply.id) ?? false,
    );
    replies.set(reply.id, layout);
    nextLine = layout.close + 2;
  });
  return { replies, topicClose: nextLine };
}

export function createFallbackReplyLineLayout(
  reply: TopicReplyDocumentBlock,
): TopicReplyLineLayout {
  return createReplyLineLayout(reply, TOPIC_HEADER_LINES.metadata + 1, false, false, false);
}

function createReplyLineLayout(
  reply: TopicReplyDocumentBlock,
  start: number,
  override: boolean,
  forcedBoostLine: boolean,
  expandedContent: boolean,
): TopicReplyLineLayout {
  const annotation = override ? start : null;
  const signature = override ? start + 1 : start;
  const metadata = signature + 1;
  const contentStart = metadata + 1;
  const afterContent =
    contentStart + countReplyCodeContentLines(reply.content, reply.id, expandedContent);
  const boosts = reply.boosts.length > 0 || forcedBoostLine ? afterContent : null;
  const statement = boosts === null ? afterContent : boosts + 1;
  const replyTarget = reply.replyToPostNumber === null ? null : statement;
  const save = reply.replyToPostNumber === null ? statement : null;
  const close = statement + 1;
  return { annotation, boosts, close, contentStart, metadata, replyTarget, save, signature };
}
