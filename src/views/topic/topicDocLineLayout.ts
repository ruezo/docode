import type { TopicDetailDocument, TopicReplyDocumentBlock } from './topicDetailDocument';
import { countNativeContentLines } from './nativeContentPresentation';

type ReadyTopicDetailDocument = Extract<TopicDetailDocument, { readonly state: 'ready' }>;

export const TOPIC_DOC_HEADER_LINES = {
  blank: 3,
  metadata: 2,
  title: 1,
} as const;

export const TOPIC_DOC_REPLIES_SECTION_LABEL = '回复';

export interface TopicDocReplyLineLayout {
  readonly blank: number;
  readonly contentStart: number;
  readonly heading: number;
  readonly replyTarget: number | null;
  readonly sectionBlank: number | null;
  readonly sectionHeading: number | null;
}

export interface TopicDocLineLayout {
  readonly lastLine: number;
  readonly replies: ReadonlyMap<number, TopicDocReplyLineLayout>;
}

export function createTopicDocLineLayout(document: ReadyTopicDetailDocument): TopicDocLineLayout {
  let nextLine = TOPIC_DOC_HEADER_LINES.blank + 1;
  let sectionEmitted = false;
  const replies = new Map<number, TopicDocReplyLineLayout>();
  document.replies.forEach((reply) => {
    const withSection = !sectionEmitted && reply.floor.number > 1;
    sectionEmitted ||= withSection;
    const layout = createDocReplyLineLayout(reply, nextLine, withSection);
    replies.set(reply.id, layout);
    nextLine = layout.blank + 1;
  });
  return { lastLine: Math.max(nextLine - 1, TOPIC_DOC_HEADER_LINES.blank), replies };
}

export function createFallbackDocReplyLineLayout(
  reply: TopicReplyDocumentBlock,
): TopicDocReplyLineLayout {
  return createDocReplyLineLayout(reply, TOPIC_DOC_HEADER_LINES.blank + 1, false);
}

export function createDocReplyHeadingLabel(reply: TopicReplyDocumentBlock): string {
  return `楼 ${String(reply.floor.number)}`;
}

function createDocReplyLineLayout(
  reply: TopicReplyDocumentBlock,
  start: number,
  withSection: boolean,
): TopicDocReplyLineLayout {
  const sectionHeading = withSection ? start : null;
  const sectionBlank = withSection ? start + 1 : null;
  const heading = withSection ? start + 2 : start;
  const contentStart = heading + 1;
  const afterContent = contentStart + countNativeContentLines(reply.content);
  const replyTarget = reply.replyToPostNumber === null ? null : afterContent;
  const blank = (replyTarget ?? afterContent - 1) + 1;
  return { blank, contentStart, heading, replyTarget, sectionBlank, sectionHeading };
}
