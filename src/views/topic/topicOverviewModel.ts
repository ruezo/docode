import type { TopicPostAuthor } from '../../linuxdo/topicAdapter';
import type { TopicDetailDocument, TopicReplyDocumentBlock } from './topicDetailDocument';
import { createReplyMethodName } from './topicJavaSource';
import { createTopicLineLayout, TOPIC_HEADER_LINES, type TopicLineLayout } from './topicLineLayout';
import { summarizeNativeContentLines } from './nativeContentPresentation';

export type TopicOverviewState = TopicDetailDocument['state'];

export type TopicOverviewMarkerKind =
  'code' | 'current' | 'heading' | 'media' | 'original-post' | 'partial' | 'requested';

export interface TopicOverviewPositionEvidence {
  readonly postId: number;
  readonly source: 'focus' | 'viewport';
}

export interface TopicOverviewCurrentPosition {
  readonly loadedOrder: number;
  readonly postId: number;
  readonly postNumber: number;
  readonly source: TopicOverviewPositionEvidence['source'];
}

export interface TopicOutlineHeading {
  readonly id: string;
  readonly label: string;
  readonly level: number;
  readonly source: 'linuxdo-heading';
}

export interface TopicOutlineEntry {
  readonly author: TopicPostAuthor | null;
  readonly completeness: TopicReplyDocumentBlock['completeness'];
  readonly headings: readonly TopicOutlineHeading[];
  readonly id: string;
  readonly loadedOrder: number;
  readonly markers: readonly TopicOverviewMarkerKind[];
  readonly permalink: string;
  readonly postId: number;
  readonly postNumber: number;
}

export interface TopicOutlineModel {
  readonly currentPosition: TopicOverviewCurrentPosition | null;
  readonly diagnosticCode: TopicDetailDocument['diagnostics']['errorCode'];
  readonly entries: readonly TopicOutlineEntry[];
  readonly state: TopicOverviewState;
  readonly topic: {
    readonly id: number;
    readonly title: string;
    readonly url: string;
  } | null;
}

export interface TopicMinimapPoint {
  readonly id: string;
  readonly loadedOrder: number;
  readonly markers: readonly TopicOverviewMarkerKind[];
  readonly permalink: string;
  readonly position: number;
  readonly postId: number;
  readonly postNumber: number;
}

export type TopicMinimapTokenTone =
  | 'code'
  | 'heading'
  | 'keyword'
  | 'link'
  | 'media'
  | 'metadata'
  | 'punctuation'
  | 'quote'
  | 'string'
  | 'text';

export interface TopicMinimapToken {
  readonly text: string;
  readonly tone: TopicMinimapTokenTone;
}

export interface TopicMinimapLine {
  readonly id: string;
  readonly indent: number;
  readonly lineNumber: number;
  readonly position: number;
  readonly postId: number | null;
  readonly tokens: readonly TopicMinimapToken[];
}

export interface TopicMinimapRange {
  readonly after: 'complete' | 'loading';
  readonly before: 'complete' | 'not-loaded';
  readonly containsRequestedPost: boolean;
  readonly firstPostNumber: number;
  readonly lastPostNumber: number;
  readonly loadedPostCount: number;
  readonly requestedPostNumber: number | null;
  readonly scope: 'loaded-window';
}

export interface TopicMinimapModel {
  readonly currentPosition: TopicOverviewCurrentPosition | null;
  readonly diagnosticCode: TopicDetailDocument['diagnostics']['errorCode'];
  readonly lineCount: number;
  readonly lines: readonly TopicMinimapLine[];
  readonly points: readonly TopicMinimapPoint[];
  readonly range: TopicMinimapRange | null;
  readonly state: TopicOverviewState;
  readonly topicId: number | null;
}

export interface TopicOverviewModels {
  readonly minimap: TopicMinimapModel;
  readonly outline: TopicOutlineModel;
}

export function createTopicOverviewModels(
  document: TopicDetailDocument,
  positionEvidence: TopicOverviewPositionEvidence | null,
): TopicOverviewModels {
  return positionTopicOverviewModels(
    createTopicOverviewBaseModels(document),
    document,
    positionEvidence,
  );
}

export function createTopicOverviewBaseModels(document: TopicDetailDocument): TopicOverviewModels {
  if (document.state !== 'ready') return createUnavailableModels(document);

  const entries = document.replies.map((reply) => createOutlineEntry(reply, null));
  const lineLayout = createTopicLineLayout(document);
  const lineCount = lineLayout.topicClose;
  const lineDivisor = Math.max(lineCount - 1, 1);
  const points = entries.map((entry) => ({
    id: entry.id,
    loadedOrder: entry.loadedOrder,
    markers: entry.markers,
    permalink: entry.permalink,
    position: ((lineLayout.replies.get(entry.postId)?.signature ?? 1) - 1) / lineDivisor,
    postId: entry.postId,
    postNumber: entry.postNumber,
  }));
  const lines = sampleMinimapLines(createMinimapLines(document, lineLayout));
  const { loadedWindow, topic } = document;
  const hasLoadedRange =
    loadedWindow.firstPostNumber !== null && loadedWindow.lastPostNumber !== null;

  return {
    minimap: {
      currentPosition: null,
      diagnosticCode: null,
      lineCount,
      lines,
      points,
      range: hasLoadedRange
        ? {
            after: loadedWindow.hasMorePosts ? 'loading' : 'complete',
            before: loadedWindow.firstPostNumber === 1 ? 'complete' : 'not-loaded',
            containsRequestedPost: loadedWindow.containsRequestedPost,
            firstPostNumber: loadedWindow.firstPostNumber,
            lastPostNumber: loadedWindow.lastPostNumber,
            loadedPostCount: loadedWindow.loadedPostCount,
            requestedPostNumber: loadedWindow.requestedPostNumber,
            scope: 'loaded-window',
          }
        : null,
      state: 'ready',
      topicId: topic.id,
    },
    outline: {
      currentPosition: null,
      diagnosticCode: null,
      entries,
      state: 'ready',
      topic: { id: topic.id, title: topic.title, url: topic.url },
    },
  };
}

export function positionTopicOverviewModels(
  models: TopicOverviewModels,
  document: TopicDetailDocument,
  positionEvidence: TopicOverviewPositionEvidence | null,
): TopicOverviewModels {
  if (document.state !== 'ready' || !positionEvidence) return models;
  const currentReply = document.replies.find(({ id }) => id === positionEvidence.postId);
  if (!currentReply) return models;
  const currentPosition: TopicOverviewCurrentPosition = {
    loadedOrder: currentReply.floor.loadedOrder,
    postId: currentReply.id,
    postNumber: currentReply.floor.number,
    source: positionEvidence.source,
  };
  const markCurrent = <
    Model extends { readonly markers: readonly TopicOverviewMarkerKind[]; readonly postId: number },
  >(
    model: Model,
  ): Model =>
    model.postId === currentReply.id
      ? {
          ...model,
          markers: [...model.markers.filter((marker) => marker !== 'current'), 'current'],
        }
      : model;
  return {
    minimap: {
      ...models.minimap,
      currentPosition,
      points: models.minimap.points.map(markCurrent),
    },
    outline: {
      ...models.outline,
      currentPosition,
      entries: models.outline.entries.map(markCurrent),
    },
  };
}

function createUnavailableModels(document: TopicDetailDocument): TopicOverviewModels {
  const diagnosticCode = document.diagnostics.errorCode;
  return {
    minimap: {
      currentPosition: null,
      diagnosticCode,
      lineCount: 0,
      lines: [],
      points: [],
      range: null,
      state: document.state,
      topicId: document.topic?.id ?? null,
    },
    outline: {
      currentPosition: null,
      diagnosticCode,
      entries: [],
      state: document.state,
      topic: document.topic
        ? {
            id: document.topic.id,
            title: document.topic.title,
            url: document.topic.url,
          }
        : null,
    },
  };
}

const MAX_RENDERED_MINIMAP_LINES = 800;

function createMinimapLines(
  document: Extract<TopicDetailDocument, { readonly state: 'ready' }>,
  lineLayout: TopicLineLayout,
): TopicMinimapLine[] {
  const lineCount = lineLayout.topicClose;
  const lines: Omit<TopicMinimapLine, 'position'>[] = [
    minimapLine('topic:import', TOPIC_HEADER_LINES.importLine, null, 0, [
      token('keyword', 'import '),
      token('text', 'LinuxDo.Topic;'),
    ]),
    minimapLine('topic:import-motto', TOPIC_HEADER_LINES.mottoImportLine, null, 0, [
      token('keyword', 'import '),
      token('text', 'Sincere.friendly.united.professional;'),
    ]),
    minimapLine('topic:signature', TOPIC_HEADER_LINES.classOpen, null, 0, [
      token('keyword', 'public class '),
      token('link', document.topic.title),
      token('punctuation', ' {'),
    ]),
    minimapLine('topic:metadata', TOPIC_HEADER_LINES.metadata, null, 1, [
      token(
        'metadata',
        `// ${[
          `#${String(document.topic.id)}`,
          document.topic.category?.name ?? null,
          ...document.topic.tags.map(({ name }) => `#${name}`),
        ]
          .filter((part): part is string => Boolean(part))
          .join(' · ')}`,
      ),
    ]),
  ];

  document.replies.forEach((reply) => {
    const layout = lineLayout.replies.get(reply.id);
    if (!layout) return;
    if (layout.annotation !== null) {
      lines.push(
        minimapLine(`post:${String(reply.id)}:annotation`, layout.annotation, reply.id, 1, [
          token('keyword', '@Override'),
        ]),
      );
    }
    lines.push(
      minimapLine(`post:${String(reply.id)}:signature`, layout.signature, reply.id, 1, [
        token('keyword', reply.replyToPostNumber === null ? 'private void ' : 'private Replies '),
        token('link', createReplyMethodName(reply)),
        token('punctuation', '() {'),
      ]),
      minimapLine(`post:${String(reply.id)}:metadata`, layout.metadata, reply.id, 2, [
        token(
          'metadata',
          `// ${[`#${String(reply.floor.number)}`, reply.author?.displayName, reply.publishedLabel]
            .filter((part): part is string => Boolean(part))
            .join(' · ')}`,
        ),
      ]),
    );
    summarizeNativeContentLines(reply.content).forEach((summary, index) => {
      lines.push(
        minimapLine(
          `post:${String(reply.id)}:content:${String(index)}`,
          layout.contentStart + index,
          reply.id,
          summary.indent + 2,
          [token(summary.kind === 'text' ? 'string' : summary.kind, summary.text)],
        ),
      );
    });
    lines.push(
      minimapLine(`post:${String(reply.id)}:close`, layout.close, reply.id, 1, [
        token('punctuation', '}'),
      ]),
    );
  });
  lines.push(minimapLine('topic:close', lineCount, null, 0, [token('punctuation', '}')]));
  const divisor = Math.max(lineCount - 1, 1);
  return lines.map((line) => ({ ...line, position: (line.lineNumber - 1) / divisor }));
}

function minimapLine(
  id: string,
  lineNumber: number,
  postId: number | null,
  indent: number,
  tokens: readonly TopicMinimapToken[],
): Omit<TopicMinimapLine, 'position'> {
  return { id, indent, lineNumber, postId, tokens };
}

function token(tone: TopicMinimapTokenTone, text: string): TopicMinimapToken {
  return { text: text.slice(0, 160), tone };
}

function sampleMinimapLines(lines: readonly TopicMinimapLine[]): TopicMinimapLine[] {
  if (lines.length <= MAX_RENDERED_MINIMAP_LINES) return [...lines];
  const stride = Math.ceil((lines.length - 2) / (MAX_RENDERED_MINIMAP_LINES - 2));
  const first = lines[0];
  const last = lines.at(-1);
  if (!first || !last) return [];
  const middle = lines
    .slice(1, -1)
    .filter((_line, index) => index % stride === 0)
    .slice(0, MAX_RENDERED_MINIMAP_LINES - 2);
  return [first, ...middle, last];
}

function createOutlineEntry(
  reply: TopicReplyDocumentBlock,
  currentPosition: TopicOverviewCurrentPosition | null,
): TopicOutlineEntry {
  const headings = extractHeadings(reply);
  return {
    author: reply.author ? { ...reply.author } : null,
    completeness: reply.completeness,
    headings,
    id: `post:${String(reply.id)}`,
    loadedOrder: reply.floor.loadedOrder,
    markers: createMarkers(reply, headings.length > 0, currentPosition?.postId === reply.id),
    permalink: reply.permalink,
    postId: reply.id,
    postNumber: reply.floor.number,
  };
}

function extractHeadings(reply: TopicReplyDocumentBlock): TopicOutlineHeading[] {
  if (!reply.content) return [];
  return reply.content.blocks.flatMap((block, blockIndex) => {
    if (block.kind !== 'heading') return [];
    const label = normalizeText(block.element.textContent);
    if (!label) return [];
    const level = headingLevel(block.element);
    return [
      {
        id: `post:${String(reply.id)}:heading:${String(blockIndex)}`,
        label,
        level,
        source: 'linuxdo-heading' as const,
      },
    ];
  });
}

function createMarkers(
  reply: TopicReplyDocumentBlock,
  hasHeading: boolean,
  current: boolean,
): TopicOverviewMarkerKind[] {
  const blockKinds = new Set(reply.content?.blocks.map(({ kind }) => kind) ?? []);
  return [
    reply.floor.number === 1 ? ('original-post' as const) : null,
    hasHeading ? ('heading' as const) : null,
    blockKinds.has('code') ? ('code' as const) : null,
    blockKinds.has('media') ? ('media' as const) : null,
    reply.completeness === 'partial' ? ('partial' as const) : null,
    reply.floor.requested ? ('requested' as const) : null,
    current ? ('current' as const) : null,
  ].filter((marker): marker is TopicOverviewMarkerKind => marker !== null);
}

function headingLevel(element: HTMLElement): number {
  const match = /^h([1-6])$/i.exec(element.tagName);
  return match ? Number(match[1]) : 1;
}

function normalizeText(value: string | null): string {
  return value?.replace(/\s+/g, ' ').trim() ?? '';
}
