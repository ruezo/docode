import type { TopicDetailDocument, TopicReplyDocumentBlock } from './topicDetailDocument';
import { countNativeContentLines } from './nativeContentPresentation';
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
  readonly close: number;
  readonly contentStart: number;
  readonly metadata: number;
  readonly replyTarget: number | null;
  readonly signature: number;
}

export interface TopicLineLayout {
  readonly replies: ReadonlyMap<number, TopicReplyLineLayout>;
  readonly topicClose: number;
}

export function createTopicLineLayout(document: ReadyTopicDetailDocument): TopicLineLayout {
  const originalPoster = findOriginalPosterUsername(document.replies);
  let nextLine = TOPIC_HEADER_LINES.metadata + 1;
  const replies = new Map<number, TopicReplyLineLayout>();
  document.replies.forEach((reply) => {
    const layout = createReplyLineLayout(
      reply,
      nextLine,
      isOriginalPosterReply(reply, originalPoster),
    );
    replies.set(reply.id, layout);
    nextLine = layout.close + 1;
  });
  return { replies, topicClose: nextLine };
}

export function createFallbackReplyLineLayout(
  reply: TopicReplyDocumentBlock,
): TopicReplyLineLayout {
  return createReplyLineLayout(reply, TOPIC_HEADER_LINES.metadata + 1, false);
}

function createReplyLineLayout(
  reply: TopicReplyDocumentBlock,
  start: number,
  override: boolean,
): TopicReplyLineLayout {
  const annotation = override ? start : null;
  const signature = override ? start + 1 : start;
  const metadata = signature + 1;
  const contentStart = metadata + 1;
  const afterContent = contentStart + countNativeContentLines(reply.content);
  const replyTarget = reply.replyToPostNumber === null ? null : afterContent;
  const close = (replyTarget ?? afterContent - 1) + 1;
  return { annotation, close, contentStart, metadata, replyTarget, signature };
}
