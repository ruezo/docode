import { recognizeLinuxDoRoute, type LinuxDoRoute } from '../linuxdo/routes';
import {
  getOpenViewId,
  type OpenViewState,
  type OpenWorkbenchView,
} from '../navigation/openViewState';
import type { CodiconName } from '../ui/icons/codicon';
import type { LinuxDoSearchResult } from '../linuxdo/searchAdapter';
import { createWorkbenchViewContext } from '../ui/workbench/workbenchContext';
import type {
  TopicListDocument,
  TopicListDocumentLine,
} from '../views/topicList/topicListDocument';

export type QuickOpenItemSource = 'open-view' | 'search' | 'topic-list';
export type QuickOpenTopicState = 'empty' | 'error' | 'loading' | 'ready' | 'unavailable';

export interface QuickOpenItem {
  readonly active: boolean;
  readonly description: string;
  readonly groupLabel: string;
  readonly icon: CodiconName;
  readonly id: string;
  readonly label: string;
  readonly readState: TopicListDocumentLine['readState'];
  readonly route: LinuxDoRoute;
  readonly source: QuickOpenItemSource;
}

export interface QuickOpenCollection {
  readonly items: readonly QuickOpenItem[];
  readonly topicMessage: string | null;
  readonly topicState: QuickOpenTopicState;
}

export function createQuickOpenCollection(
  navigation: OpenViewState,
  topicDocument: TopicListDocument | null,
): QuickOpenCollection {
  const topicLines = topicDocument?.state === 'ready' ? topicDocument.lines : [];
  const topicLinesById = new Map(topicLines.map((line) => [line.topicId, line]));
  const openItems = navigation.openViews.flatMap((view) => {
    if (view.route.kind === 'unsupported') return [];
    return [createOpenViewItem(view, navigation.activeViewId, topicLinesById.get(topicId(view)))];
  });
  const openViewIds = new Set(openItems.map(({ route }) => getOpenViewId(route)));
  const topicItems = topicLines.flatMap((line) => {
    const route = recognizeLinuxDoRoute(line.url);
    if (route.kind !== 'topic' || openViewIds.has(getOpenViewId(route))) return [];
    const title = getTopicTitle(line);
    return [
      {
        active: false,
        description: `Topic ${String(line.topicId)} · ${route.pathname}`,
        groupLabel: topicDocument ? topicGroupLabel(topicDocument) : 'Topics',
        icon: 'file' as const,
        id: `topic-list:${String(line.topicId)}`,
        label: title ?? `Topic ${String(line.topicId)}`,
        readState: line.readState,
        route,
        source: 'topic-list' as const,
      },
    ];
  });
  const topicStatus = getTopicStatus(topicDocument);
  return {
    items: [...openItems, ...topicItems],
    topicMessage: topicStatus.message,
    topicState: topicStatus.state,
  };
}

export function filterQuickOpenItems(
  items: readonly QuickOpenItem[],
  query: string,
): readonly QuickOpenItem[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return items;
  return items.filter((item) =>
    `${item.label}\n${item.description}\n${item.route.pathname}`.toLowerCase().includes(normalized),
  );
}

export function createSearchQuickOpenItems(
  results: readonly LinuxDoSearchResult[],
  existingItems: readonly QuickOpenItem[],
): readonly QuickOpenItem[] {
  const existingViewIds = new Set(existingItems.map(({ route }) => getOpenViewId(route)));
  return results.flatMap((result) => {
    if (result.kind !== 'post' && existingViewIds.has(getOpenViewId(result.route))) return [];
    return [
      {
        active: false,
        description: `${result.description} · ${result.route.pathname}`,
        groupLabel: searchGroupLabel(result),
        icon: searchIcon(result),
        id: `search:${result.id}`,
        label: result.label,
        readState: 'unknown' as const,
        route: result.route,
        source: 'search' as const,
      },
    ];
  });
}

function createOpenViewItem(
  view: OpenWorkbenchView,
  activeViewId: string,
  topicLine: TopicListDocumentLine | undefined,
): QuickOpenItem {
  const context = createWorkbenchViewContext(view.route, 0);
  const topicTitle = topicLine ? getTopicTitle(topicLine) : null;
  return {
    active: view.id === activeViewId,
    description: `Open view · ${context.statusLabel} · ${context.canonicalPath}`,
    groupLabel: 'Open Views',
    icon: context.icon,
    id: `open-view:${view.id}`,
    label: topicTitle ?? context.label,
    readState: view.readState,
    route: view.route,
    source: 'open-view',
  };
}

function getTopicStatus(document: TopicListDocument | null): {
  readonly message: string | null;
  readonly state: QuickOpenTopicState;
} {
  switch (document?.state) {
    case 'ready':
      return { message: null, state: 'ready' };
    case 'loading':
      return { message: 'Linux DO topic suggestions are still loading.', state: 'loading' };
    case 'empty':
      return { message: 'Linux DO returned no topic suggestions for this view.', state: 'empty' };
    case 'error':
      return { message: 'Linux DO topic suggestions are unavailable.', state: 'error' };
    case undefined:
      return { message: null, state: 'unavailable' };
  }
}

function topicGroupLabel(document: TopicListDocument): string {
  const { route } = document;
  if (route.view === 'category') return 'Topics in Category';
  if (route.view === 'tag') return `Topics tagged ${route.tagSlug}`;
  return `${route.view.charAt(0).toUpperCase()}${route.view.slice(1)} Topics`;
}

function topicId(view: OpenWorkbenchView): number {
  return view.route.kind === 'topic' ? view.route.topicId : -1;
}

function getTopicTitle(line: TopicListDocumentLine): string | null {
  for (const token of line.tokens) {
    if (token.kind === 'title') return token.text;
  }
  return null;
}

function searchGroupLabel(result: LinuxDoSearchResult): string {
  switch (result.kind) {
    case 'post':
      return 'Linux DO Posts';
    case 'category':
      return 'Linux DO Categories';
    case 'tag':
      return 'Linux DO Tags';
    case 'user':
      return 'Linux DO Users';
  }
}

function searchIcon(result: LinuxDoSearchResult): CodiconName {
  switch (result.kind) {
    case 'post':
      return 'comment-discussion';
    case 'category':
      return 'folder';
    case 'tag':
      return 'tag';
    case 'user':
      return 'account';
  }
}
