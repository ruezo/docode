import { getCloseFallbackView, type OpenViewState, type OpenWorkbenchView } from './openViewState';

export type TabActionId =
  'close' | 'close-others' | 'close-right' | 'copy-topic-link' | 'open-original-view';

export interface TabActionRequest {
  readonly id: TabActionId;
  readonly viewId: string;
}

export function isTabActionAvailable(
  state: OpenViewState,
  actionId: TabActionId,
  viewId: string,
  originalViewAvailable: boolean,
): boolean {
  const viewIndex = state.openViews.findIndex((view) => view.id === viewId);
  if (viewIndex < 0) return false;
  switch (actionId) {
    case 'close':
    case 'close-others':
      return state.openViews.length > 1;
    case 'close-right':
      return viewIndex < state.openViews.length - 1;
    case 'copy-topic-link':
      return state.openViews[viewIndex]?.route.kind === 'topic';
    case 'open-original-view':
      return originalViewAvailable;
  }
}

export function getTabActionNavigationTarget(
  state: OpenViewState,
  actionId: Extract<TabActionId, 'close' | 'close-others' | 'close-right'>,
  viewId: string,
): OpenWorkbenchView | null {
  const viewIndex = state.openViews.findIndex((view) => view.id === viewId);
  if (viewIndex < 0) return null;
  const view = state.openViews[viewIndex];
  if (!view) return null;

  switch (actionId) {
    case 'close':
      return state.activeViewId === viewId ? getCloseFallbackView(state, viewId) : null;
    case 'close-others':
      return state.activeViewId === viewId ? null : view;
    case 'close-right': {
      const activeIndex = state.openViews.findIndex(
        (candidate) => candidate.id === state.activeViewId,
      );
      return activeIndex > viewIndex ? view : null;
    }
  }
}
