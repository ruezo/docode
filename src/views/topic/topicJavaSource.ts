import { sanitizeJavaIdentifier } from '../javaIdentifier';
import type { TopicReplyDocumentBlock } from './topicDetailDocument';

export function createReplyMethodName(reply: TopicReplyDocumentBlock): string {
  const base = reply.author
    ? sanitizeJavaIdentifier(reply.author.username)
    : `post_${String(reply.id)}`;
  return `${base}_${String(reply.floor.number)}`;
}

export function findOriginalPosterUsername(
  replies: readonly TopicReplyDocumentBlock[],
): string | null {
  return replies.find(({ floor }) => floor.number === 1)?.author?.username ?? null;
}

export function isOriginalPosterReply(
  reply: TopicReplyDocumentBlock,
  originalPosterUsername: string | null,
): boolean {
  return (
    originalPosterUsername !== null &&
    reply.floor.number !== 1 &&
    reply.author?.username === originalPosterUsername
  );
}
