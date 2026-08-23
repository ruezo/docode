import type {
  TopicListExtraction,
  TopicListIssueCode,
  TopicListItem,
} from '../../linuxdo/topicListAdapter';
import type { LinuxDoRoute } from '../../linuxdo/routes';
import { sanitizeJavaIdentifier } from '../javaIdentifier';

export type TopicListRoute = Extract<LinuxDoRoute, { readonly kind: 'topic-list' }>;

export type TopicListDocumentState = TopicListExtraction['state'];
export type TopicListLineMarker = 'new' | 'pinned' | 'read' | 'unread';

export type TopicListSourceValue =
  | {
      readonly kind: 'number';
      readonly precision: 'compact' | 'exact';
      readonly value: number;
    }
  | {
      readonly kind: 'string';
      readonly text: string;
    };

export type TopicListSourceRow =
  | {
      readonly kind: 'blank';
      readonly lineNumber: number;
    }
  | {
      readonly kind: 'comment';
      readonly lineNumber: number;
    }
  | {
      readonly kind: 'method';
      readonly lineNumber: number;
      readonly method: 'at' | 'comments' | 'views';
      readonly terminal: boolean;
      readonly value: TopicListSourceValue;
    }
  | {
      readonly kind: 'method-close';
      readonly lineNumber: number;
    }
  | {
      readonly kind: 'method-open';
      readonly lineNumber: number;
      readonly name: string;
    }
  | {
      readonly kind: 'signature';
      readonly lineNumber: number;
      readonly terminal: boolean;
      readonly title: string;
    };

export interface TopicListScaffoldRow {
  readonly kind:
    | 'blank'
    | 'class-close'
    | 'class-open'
    | 'field'
    | 'import'
    | 'init-close'
    | 'init-comment'
    | 'init-config'
    | 'init-from'
    | 'init-open'
    | 'init-to';
  readonly lineNumber: number;
}

export interface TopicListLineFocus {
  readonly id: string;
  readonly order: number;
  readonly tabIndex: -1 | 0;
}

export type TopicListPresentationToken =
  | {
      readonly kind: 'activity';
      readonly label: string;
      readonly lastPostNumber: number | null;
      readonly timestamp: string | null;
      readonly url: string | null;
    }
  | {
      readonly kind: 'category' | 'tag' | 'title';
      readonly text: string;
      readonly url: string;
    }
  | {
      readonly kind: 'count';
      readonly metric: 'replies' | 'views';
      readonly precision: 'compact' | 'exact';
      readonly value: number;
    }
  | {
      readonly kind: 'participant';
      readonly role: 'latest' | 'original' | 'original-latest' | 'participant';
      readonly text: string;
      readonly url: string;
    };

export interface TopicListDocumentLine {
  readonly completeness: TopicListItem['completeness'];
  readonly focus: TopicListLineFocus;
  readonly hasExcerpt: boolean;
  readonly lineNumber: number;
  readonly markers: readonly TopicListLineMarker[];
  readonly readState: TopicListItem['readState'];
  readonly rows: readonly TopicListSourceRow[];
  readonly tokens: readonly TopicListPresentationToken[];
  readonly topicId: number;
  readonly url: string;
}

export interface TopicListDocument {
  readonly diagnostics: {
    readonly errorCode: Extract<TopicListExtraction, { readonly state: 'error' }>['code'] | null;
    readonly issueCodes: readonly TopicListIssueCode[];
  };
  readonly epilogue: readonly TopicListScaffoldRow[];
  readonly lines: readonly TopicListDocumentLine[];
  readonly lineCount: number;
  readonly prologue: readonly TopicListScaffoldRow[];
  readonly route: TopicListRoute;
  readonly state: TopicListDocumentState;
}

const PROLOGUE_KINDS: readonly TopicListScaffoldRow['kind'][] = [
  'import',
  'blank',
  'class-open',
  'blank',
  'field',
  'blank',
  'init-open',
  'init-comment',
  'init-config',
  'init-from',
  'init-to',
  'init-close',
  'blank',
];

export function createTopicListDocument(
  route: TopicListRoute,
  extraction: TopicListExtraction,
): TopicListDocument {
  const ready = extraction.state === 'ready';
  const prologue = ready ? createPrologue() : [];
  const lines = ready ? createLines(extraction.topics, (prologue.at(-1)?.lineNumber ?? 0) + 1) : [];
  const epilogue = ready ? createEpilogue(prologue, lines) : [];
  return {
    diagnostics: {
      errorCode: extraction.state === 'error' ? extraction.code : null,
      issueCodes: [...new Set(extraction.issues.map(({ code }) => code))],
    },
    epilogue,
    lineCount: epilogue.at(-1)?.lineNumber ?? 0,
    lines,
    prologue,
    route,
    state: extraction.state,
  };
}

function createPrologue(): TopicListScaffoldRow[] {
  return PROLOGUE_KINDS.map((kind, index) => ({ kind, lineNumber: index + 1 }));
}

function createEpilogue(
  prologue: readonly TopicListScaffoldRow[],
  lines: readonly TopicListDocumentLine[],
): TopicListScaffoldRow[] {
  const lastLineNumber = lines.at(-1)?.rows.at(-1)?.lineNumber ?? prologue.at(-1)?.lineNumber ?? 0;
  return [{ kind: 'class-close', lineNumber: lastLineNumber + 1 }];
}

export function mergeReadyTopicListDocuments(
  primary: TopicListDocument & { readonly state: 'ready' },
  additional: TopicListDocument & { readonly state: 'ready' },
): TopicListDocument & { readonly state: 'ready' } {
  if (primary.route.href !== additional.route.href) return primary;
  const seen = new Set<number>();
  const sourceLines = [...primary.lines, ...additional.lines].filter(({ topicId }) => {
    if (seen.has(topicId)) return false;
    seen.add(topicId);
    return true;
  });
  let nextLineNumber = (primary.prologue.at(-1)?.lineNumber ?? 0) + 1;
  const lines = sourceLines.map((line, index) => {
    const rebased = rebaseLine(line, index, nextLineNumber);
    nextLineNumber = (rebased.rows.at(-1)?.lineNumber ?? nextLineNumber) + 1;
    return rebased;
  });
  const epilogue = createEpilogue(primary.prologue, lines);
  return {
    diagnostics: {
      errorCode: null,
      issueCodes: [
        ...new Set([...primary.diagnostics.issueCodes, ...additional.diagnostics.issueCodes]),
      ],
    },
    epilogue,
    lineCount: epilogue.at(-1)?.lineNumber ?? 0,
    lines,
    prologue: primary.prologue,
    route: primary.route,
    state: 'ready',
  };
}

function createLines(
  topics: readonly TopicListItem[],
  firstLineNumber: number,
): TopicListDocumentLine[] {
  let nextLineNumber = firstLineNumber;
  return topics.map((topic, index) => {
    const line = createLine(topic, index, nextLineNumber);
    nextLineNumber = (line.rows.at(-1)?.lineNumber ?? nextLineNumber) + 1;
    return line;
  });
}

function createLine(
  topic: TopicListItem,
  index: number,
  lineNumber: number,
): TopicListDocumentLine {
  const rows = createSourceRows(topic, lineNumber);
  return {
    completeness: topic.completeness,
    focus: {
      id: `docode-topic-${String(topic.id)}`,
      order: index,
      tabIndex: index === 0 ? 0 : -1,
    },
    hasExcerpt: topic.hasExcerpt,
    lineNumber,
    markers: createMarkers(topic),
    readState: topic.readState,
    rows,
    tokens: createTokens(topic),
    topicId: topic.id,
    url: topic.url,
  };
}

function rebaseLine(
  line: TopicListDocumentLine,
  index: number,
  lineNumber: number,
): TopicListDocumentLine {
  const offset = lineNumber - line.lineNumber;
  return {
    ...line,
    focus: { ...line.focus, order: index, tabIndex: index === 0 ? 0 : -1 },
    lineNumber,
    rows: line.rows.map((row) => ({ ...row, lineNumber: row.lineNumber + offset })),
  };
}

function createSourceRows(topic: TopicListItem, lineNumber: number): TopicListSourceRow[] {
  const methods: Omit<
    Extract<TopicListSourceRow, { readonly kind: 'method' }>,
    'lineNumber' | 'terminal'
  >[] = [];
  if (topic.activity) {
    methods.push({
      kind: 'method',
      method: 'at',
      value: { kind: 'string', text: topic.activity.label },
    });
  }
  if (topic.replyCount) {
    methods.push({
      kind: 'method',
      method: 'comments',
      value: { kind: 'number', ...topic.replyCount },
    });
  }
  if (topic.viewCount) {
    methods.push({
      kind: 'method',
      method: 'views',
      value: { kind: 'number', ...topic.viewCount },
    });
  }

  const rows: TopicListSourceRow[] = [
    { kind: 'method-open', lineNumber, name: createMethodName(topic) },
    { kind: 'comment', lineNumber: lineNumber + 1 },
    {
      kind: 'signature',
      lineNumber: lineNumber + 2,
      terminal: methods.length === 0,
      title: topic.title,
    },
  ];
  methods.forEach((method, index) => {
    rows.push({
      ...method,
      lineNumber: lineNumber + index + 3,
      terminal: index === methods.length - 1,
    });
  });
  rows.push({ kind: 'method-close', lineNumber: lineNumber + methods.length + 3 });
  rows.push({ kind: 'blank', lineNumber: lineNumber + methods.length + 4 });
  return rows;
}

function findOriginalPoster(topic: TopicListItem): TopicListItem['participants'][number] | null {
  return (
    topic.participants.find(({ isOriginalPoster }) => isOriginalPoster) ??
    topic.participants[0] ??
    null
  );
}

function createMethodName(topic: TopicListItem): string {
  const author = findOriginalPoster(topic);
  return author ? sanitizeJavaIdentifier(author.username) : `topic_${String(topic.id)}`;
}

function createMarkers(topic: TopicListItem): TopicListLineMarker[] {
  const markers: TopicListLineMarker[] = [];
  if (topic.pinned) markers.push('pinned');
  if (topic.readState !== 'unknown') markers.push(topic.readState);
  return markers;
}

function createTokens(topic: TopicListItem): TopicListPresentationToken[] {
  const tokens: TopicListPresentationToken[] = [
    { kind: 'title', text: topic.title, url: topic.url },
  ];
  if (topic.category) {
    tokens.push({ kind: 'category', text: topic.category.name, url: topic.category.url });
  }
  for (const tag of topic.tags) {
    tokens.push({ kind: 'tag', text: tag.name, url: tag.url });
  }
  for (const participant of topic.participants) {
    tokens.push({
      kind: 'participant',
      role: getParticipantRole(participant),
      text: participant.username,
      url: participant.url,
    });
  }
  if (topic.replyCount) {
    tokens.push({ kind: 'count', metric: 'replies', ...topic.replyCount });
  }
  if (topic.viewCount) {
    tokens.push({ kind: 'count', metric: 'views', ...topic.viewCount });
  }
  if (topic.activity) {
    tokens.push({ kind: 'activity', ...topic.activity });
  }
  return tokens;
}

function getParticipantRole(
  participant: TopicListItem['participants'][number],
): Extract<TopicListPresentationToken, { readonly kind: 'participant' }>['role'] {
  if (participant.isOriginalPoster && participant.isLatestPoster) return 'original-latest';
  if (participant.isOriginalPoster) return 'original';
  if (participant.isLatestPoster) return 'latest';
  return 'participant';
}
