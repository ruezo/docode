import type { LinuxDoRoute } from '../linuxdo/routes';
import type { TopicReadState } from '../linuxdo/topicListAdapter';

export interface NativeDraftEvidence {
  readonly dirty: boolean;
  readonly source: 'native-composer';
}

export interface TopicReadEvidence {
  readonly source: 'topic-list';
  readonly state: TopicReadState;
}

export interface OpenViewEvidence {
  readonly draft?: NativeDraftEvidence;
  readonly read?: TopicReadEvidence;
}

export interface OpenWorkbenchView {
  readonly dirty: boolean;
  readonly dirtySource: NativeDraftEvidence['source'] | null;
  readonly id: string;
  readonly readState: TopicReadState;
  readonly readStateSource: TopicReadEvidence['source'] | null;
  readonly retention: 'persistent' | 'transient';
  readonly route: LinuxDoRoute;
}

export interface OpenViewState {
  readonly activeViewId: string;
  readonly openViews: readonly OpenWorkbenchView[];
}

export function createOpenViewState(
  route: LinuxDoRoute,
  evidence?: OpenViewEvidence,
): OpenViewState {
  const view = createOpenView(route, evidence);
  return { activeViewId: view.id, openViews: [view] };
}

export function openWorkbenchView(
  state: OpenViewState,
  route: LinuxDoRoute,
  evidence?: OpenViewEvidence,
): OpenViewState {
  const id = getOpenViewId(route);
  const existingIndex = state.openViews.findIndex((view) => view.id === id);
  if (existingIndex < 0) {
    return removeStaleTransientViews({
      activeViewId: id,
      openViews: [...state.openViews, createOpenView(route, evidence)],
    });
  }

  const existing = state.openViews[existingIndex];
  if (!existing) return state;
  const updated = applyEvidence({ ...existing, route }, evidence);
  const openViews = [...state.openViews];
  openViews[existingIndex] = updated;
  return removeStaleTransientViews({ activeViewId: id, openViews });
}

export function activateWorkbenchView(state: OpenViewState, viewId: string): OpenViewState {
  if (state.activeViewId === viewId || !state.openViews.some((view) => view.id === viewId)) {
    return state;
  }
  return { ...state, activeViewId: viewId };
}

export function updateWorkbenchViewEvidence(
  state: OpenViewState,
  viewId: string,
  evidence: OpenViewEvidence,
): OpenViewState {
  const index = state.openViews.findIndex((view) => view.id === viewId);
  const current = state.openViews[index];
  if (index < 0 || !current) return state;
  const updated = applyEvidence(current, evidence);
  if (updated === current || equalEvidenceState(current, updated)) return state;
  const openViews = [...state.openViews];
  openViews[index] = updated;
  return { ...state, openViews };
}

export function closeWorkbenchView(state: OpenViewState, viewId: string): OpenViewState {
  const closingIndex = state.openViews.findIndex((view) => view.id === viewId);
  if (closingIndex < 0 || state.openViews.length === 1) return state;

  const openViews = state.openViews.filter((view) => view.id !== viewId);
  if (state.activeViewId !== viewId) return { ...state, openViews };

  const nextActive = openViews[Math.min(closingIndex, openViews.length - 1)];
  return nextActive ? { activeViewId: nextActive.id, openViews } : state;
}

export function closeOtherWorkbenchViews(state: OpenViewState, viewId: string): OpenViewState {
  const retained = state.openViews.find((view) => view.id === viewId);
  if (!retained || state.openViews.length === 1) return state;
  return { activeViewId: retained.id, openViews: [retained] };
}

export function closeWorkbenchViewsToRight(state: OpenViewState, viewId: string): OpenViewState {
  const retainedIndex = state.openViews.findIndex((view) => view.id === viewId);
  if (retainedIndex < 0 || retainedIndex === state.openViews.length - 1) return state;
  const openViews = state.openViews.slice(0, retainedIndex + 1);
  return {
    activeViewId: openViews.some((view) => view.id === state.activeViewId)
      ? state.activeViewId
      : viewId,
    openViews,
  };
}

export function getOpenViewId(route: LinuxDoRoute): string {
  switch (route.kind) {
    case 'topic':
      return `topic:${String(route.topicId)}`;
    case 'topic-list': {
      if (route.view === 'category') return `list:category:${String(route.categoryId)}`;
      if (route.view === 'tag') return `list:tag:${encodeIdentity(route.tagSlug)}`;
      return `list:${route.view}`;
    }
    case 'search':
      return `search:${encodeIdentity(route.query?.trim() ?? '')}`;
    case 'user':
      return `user:${encodeIdentity(route.username)}:${route.section.map(encodeIdentity).join('/')}`;
    case 'category-index':
      return 'category-index';
    case 'tag-index':
      return 'tag-index';
    case 'unsupported':
      return `unsupported:${encodeIdentity(route.href)}`;
  }
}

export function getCloseFallbackView(
  state: OpenViewState,
  viewId: string,
): OpenWorkbenchView | null {
  const closingIndex = state.openViews.findIndex((view) => view.id === viewId);
  if (closingIndex < 0 || state.openViews.length === 1) return null;
  return state.openViews[closingIndex + 1] ?? state.openViews[closingIndex - 1] ?? null;
}

function createOpenView(route: LinuxDoRoute, evidence?: OpenViewEvidence): OpenWorkbenchView {
  return applyEvidence(
    {
      dirty: false,
      dirtySource: null,
      id: getOpenViewId(route),
      readState: 'unknown',
      readStateSource: null,
      retention: isPersistentRoute(route) ? 'persistent' : 'transient',
      route,
    },
    evidence,
  );
}

function removeStaleTransientViews(state: OpenViewState): OpenViewState {
  const openViews = state.openViews.filter(
    (view) => view.retention === 'persistent' || view.id === state.activeViewId,
  );
  return openViews.length === state.openViews.length ? state : { ...state, openViews };
}

function isPersistentRoute(route: LinuxDoRoute): boolean {
  return (
    route.kind === 'topic' ||
    route.kind === 'topic-list' ||
    route.kind === 'search' ||
    route.kind === 'user'
  );
}

function applyEvidence(view: OpenWorkbenchView, evidence?: OpenViewEvidence): OpenWorkbenchView {
  if (view.route.kind !== 'topic' || !evidence) return view;
  return {
    ...view,
    ...(evidence.draft ? { dirty: evidence.draft.dirty, dirtySource: evidence.draft.source } : {}),
    ...(evidence.read
      ? { readState: evidence.read.state, readStateSource: evidence.read.source }
      : {}),
  };
}

function encodeIdentity(value: string): string {
  return encodeURIComponent(value);
}

function equalEvidenceState(left: OpenWorkbenchView, right: OpenWorkbenchView): boolean {
  return (
    left.dirty === right.dirty &&
    left.dirtySource === right.dirtySource &&
    left.readState === right.readState &&
    left.readStateSource === right.readStateSource
  );
}
