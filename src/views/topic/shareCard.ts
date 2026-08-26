import { sanitizeJavaIdentifier } from '../javaIdentifier';
import type { TopicReplyDocumentBlock } from './topicDetailDocument';
import { summarizeReplyCodeLines } from './replyCodePlan';

export type ShareCardTone =
  | 'annotation'
  | 'comment'
  | 'constant'
  | 'declaration'
  | 'heading'
  | 'keyword'
  | 'link'
  | 'media'
  | 'method'
  | 'plain'
  | 'punctuation'
  | 'quote'
  | 'string'
  | 'variable';

export interface ShareCardSegment {
  readonly text: string;
  readonly tone: ShareCardTone;
}

export interface ShareCardLine {
  readonly indent: number;
  readonly number: number;
  readonly segments: readonly ShareCardSegment[];
}

export interface ShareCardModel {
  readonly avatarUrl: string | null;
  readonly fileName: string;
  readonly lines: readonly ShareCardLine[];
  readonly permalinkLabel: string;
  readonly truncatedLineCount: number;
}

export interface ShareCardInput {
  readonly annotated: boolean;
  readonly reply: TopicReplyDocumentBlock;
  readonly startLine: number;
}

export const SHARE_CARD_MAX_CONTENT_LINES = 24;

export function createShareCardModel(input: ShareCardInput): ShareCardModel {
  const { annotated, reply, startLine } = input;
  const methodName = reply.author
    ? sanitizeJavaIdentifier(reply.author.username)
    : `post_${String(reply.id)}`;
  const lines: ShareCardLine[] = [];
  let lineNumber = startLine;
  const push = (indent: number, segments: readonly ShareCardSegment[]) => {
    lines.push({ indent, number: lineNumber, segments });
    lineNumber += 1;
  };

  if (annotated) push(1, [segment('annotation', '@Override')]);
  push(1, [
    segment('declaration', 'private '),
    reply.replyToPostNumber === null
      ? segment('declaration', 'void ')
      : segment('keyword', 'Replies '),
    segment('method', methodName),
    segment('punctuation', '() {'),
  ]);
  push(2, [segment('comment', shareCardMetadataComment(reply))]);

  const summaries = summarizeReplyCodeLines(reply.content, reply.id, true);
  const visible =
    summaries.length > SHARE_CARD_MAX_CONTENT_LINES
      ? summaries.slice(0, SHARE_CARD_MAX_CONTENT_LINES - 1)
      : summaries;
  const truncatedLineCount = summaries.length - visible.length;
  for (const summary of visible) {
    push(2 + summary.indent, contentSegments(summary.kind, summary.text));
  }
  if (truncatedLineCount > 0) {
    push(2, [
      segment('comment', `// ⋯ ${String(truncatedLineCount)} more lines — read on linux.do`),
    ]);
    lineNumber += truncatedLineCount - 1;
  }

  if (reply.replyToPostNumber === null) {
    push(2, [
      segment('method', 'save'),
      segment('punctuation', '('),
      segment('variable', 'reply'),
      segment('punctuation', ');'),
    ]);
  } else {
    push(2, [
      segment('keyword', 'return '),
      segment('constant', `#${String(reply.replyToPostNumber)}`),
      segment('punctuation', ';'),
    ]);
  }
  push(1, [segment('punctuation', '}')]);

  return {
    avatarUrl: reply.author?.avatarUrl ?? null,
    fileName: `${methodName}.java`,
    lines,
    permalinkLabel: shareCardPermalinkLabel(reply),
    truncatedLineCount,
  };
}

function shareCardMetadataComment(reply: TopicReplyDocumentBlock): string {
  const parts = [
    `#${String(reply.floor.number)}`,
    reply.author?.displayName ?? reply.author?.username ?? null,
    reply.publishedLabel,
    reply.reactionCount > 0 ? `✦ ${String(reply.reactionCount)}` : null,
  ].filter((part): part is string => Boolean(part));
  return `// ${parts.join(' · ')}`;
}

function shareCardPermalinkLabel(reply: TopicReplyDocumentBlock): string {
  try {
    const url = new URL(reply.permalink, 'https://linux.do');
    return `${url.host}${url.pathname}`;
  } catch {
    return 'linux.do';
  }
}

const BUILDER_CALL_PATTERN = /^reply\.(content|github|image|link)\(/u;

function contentSegments(
  kind: ReturnType<typeof summarizeReplyCodeLines>[number]['kind'],
  text: string,
): readonly ShareCardSegment[] {
  if (text === 'Replies reply = new Replies();') {
    return [
      segment('keyword', 'Replies'),
      segment('plain', ' reply = '),
      segment('keyword', 'new'),
      segment('plain', ' '),
      segment('keyword', 'Replies'),
      segment('punctuation', '();'),
    ];
  }
  if (text === 'reply.content(content);') {
    return [
      segment('plain', 'reply.content('),
      segment('variable', 'content'),
      segment('punctuation', ');'),
    ];
  }
  if (text.startsWith('reply.content("') && text.endsWith('");')) {
    return [
      segment('plain', 'reply.content('),
      segment('string', text.slice('reply.content('.length, -2)),
      segment('punctuation', ');'),
    ];
  }
  const builderCall = BUILDER_CALL_PATTERN.exec(text);
  if (builderCall && text.endsWith(');')) {
    const prefix = `reply.${builderCall[1] ?? ''}(`;
    return [
      segment('plain', prefix),
      segment(contentTone(kind), text.slice(prefix.length, -2)),
      segment('punctuation', ');'),
    ];
  }
  if (text === '/**' || text === '*/' || text === '*' || text.startsWith('* ')) {
    return [segment('comment', text)];
  }
  if (text.startsWith('String content = """')) {
    return [
      segment('declaration', 'String'),
      segment('plain', ' content = '),
      segment('string', text.slice('String content = '.length)),
    ];
  }
  if (text === '""";') return [segment('string', '"""'), segment('punctuation', ';')];
  if (text.endsWith(' """;')) {
    return [segment(contentTone(kind), text.slice(0, -1)), segment('punctuation', ';')];
  }
  return [segment(contentTone(kind), text)];
}

function contentTone(
  kind: ReturnType<typeof summarizeReplyCodeLines>[number]['kind'],
): ShareCardTone {
  switch (kind) {
    case 'blank':
    case 'text':
      return 'string';
    case 'code':
    case 'scaffold':
      return 'plain';
    case 'heading':
      return 'heading';
    case 'link':
      return 'link';
    case 'media':
      return 'media';
    case 'quote':
      return 'quote';
  }
}

function segment(tone: ShareCardTone, text: string): ShareCardSegment {
  return { text, tone };
}
