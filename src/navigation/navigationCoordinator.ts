import type { LinuxDoRoute } from '../linuxdo/routes';
import type { RouteChangeSource } from '../linuxdo/routeObserver';
import {
  closeOtherWorkbenchViews,
  closeWorkbenchView,
  closeWorkbenchViewsToRight,
  createOpenViewState,
  getCloseFallbackView,
  getOpenViewId,
  openWorkbenchView,
  updateWorkbenchViewEvidence,
  type OpenViewEvidence,
  type OpenViewState,
  type OpenWorkbenchView,
} from './openViewState';

export interface NavigationSnapshot {
  readonly generation: number;
  readonly lastSource: RouteChangeSource;
  readonly route: LinuxDoRoute;
  readonly viewState: OpenViewState;
}

export type CloseViewResult =
  | { readonly kind: 'closed' }
  | { readonly kind: 'ignored' }
  | { readonly kind: 'navigate'; readonly target: OpenWorkbenchView };

type PendingMutationKind = 'close' | 'close-others' | 'close-right';

interface PendingMutation {
  readonly kind: PendingMutationKind;
  readonly targetId: string;
  readonly viewId: string;
}

interface PendingOpen {
  readonly evidence: OpenViewEvidence;
  readonly id: string;
}

export class WorkbenchNavigationCoordinator {
  #disposed = false;
  #generation: number;
  #lastSource: RouteChangeSource = 'initial';
  #pendingMutation: PendingMutation | null = null;
  #pendingOpen: PendingOpen | null = null;
  #route: LinuxDoRoute;
  #viewState: OpenViewState;

  constructor(initialRoute: LinuxDoRoute, generation = 0) {
    this.#route = initialRoute;
    this.#generation = generation;
    this.#viewState = createOpenViewState(initialRoute);
  }

  get snapshot(): NavigationSnapshot {
    return {
      generation: this.#generation,
      lastSource: this.#lastSource,
      route: this.#route,
      viewState: this.#viewState,
    };
  }

  prepareOpen(route: LinuxDoRoute, evidence: OpenViewEvidence): boolean {
    if (this.#disposed) return false;
    this.#pendingOpen = { evidence, id: getOpenViewId(route) };
    return true;
  }

  updateViewEvidence(viewId: string, evidence: OpenViewEvidence): boolean {
    if (this.#disposed) return false;
    const next = updateWorkbenchViewEvidence(this.#viewState, viewId, evidence);
    if (next === this.#viewState) return false;
    this.#viewState = next;
    return true;
  }

  requestClose(viewId: string): CloseViewResult {
    if (this.#disposed) return { kind: 'ignored' };
    if (viewId !== this.#viewState.activeViewId) {
      const next = closeWorkbenchView(this.#viewState, viewId);
      if (next === this.#viewState) return { kind: 'ignored' };
      this.#viewState = next;
      return { kind: 'closed' };
    }

    const target = getCloseFallbackView(this.#viewState, viewId);
    if (!target) return { kind: 'ignored' };
    this.#pendingMutation = { kind: 'close', targetId: target.id, viewId };
    return { kind: 'navigate', target };
  }

  requestCloseOtherViews(viewId: string): CloseViewResult {
    return this.#requestBulkClose('close-others', viewId, closeOtherWorkbenchViews);
  }

  requestCloseViewsToRight(viewId: string): CloseViewResult {
    return this.#requestBulkClose('close-right', viewId, closeWorkbenchViewsToRight);
  }

  reconcile(
    route: LinuxDoRoute,
    generation: number,
    source: RouteChangeSource,
  ): NavigationSnapshot {
    if (this.#disposed) return this.snapshot;

    const routeId = getOpenViewId(route);
    const evidence = this.#pendingOpen?.id === routeId ? this.#pendingOpen.evidence : undefined;
    this.#pendingOpen = null;
    this.#route = route;
    this.#generation = generation;
    this.#lastSource = source;
    this.#viewState = openWorkbenchView(this.#viewState, route, evidence);

    if (this.#pendingMutation) {
      if (this.#pendingMutation.targetId === routeId) {
        this.#viewState = applyMutation(this.#viewState, this.#pendingMutation);
      }
      this.#pendingMutation = null;
    }
    return this.snapshot;
  }

  dispose(): boolean {
    if (this.#disposed) return false;
    this.#disposed = true;
    this.#pendingMutation = null;
    this.#pendingOpen = null;
    return true;
  }

  #requestBulkClose(
    kind: Extract<PendingMutationKind, 'close-others' | 'close-right'>,
    viewId: string,
    mutate: (state: OpenViewState, viewId: string) => OpenViewState,
  ): CloseViewResult {
    if (this.#disposed) return { kind: 'ignored' };
    const next = mutate(this.#viewState, viewId);
    if (next === this.#viewState) return { kind: 'ignored' };
    if (next.activeViewId === this.#viewState.activeViewId) {
      this.#viewState = next;
      return { kind: 'closed' };
    }

    const target = this.#viewState.openViews.find((view) => view.id === next.activeViewId);
    if (!target) return { kind: 'ignored' };
    this.#pendingMutation = { kind, targetId: target.id, viewId };
    return { kind: 'navigate', target };
  }
}

function applyMutation(state: OpenViewState, pending: PendingMutation): OpenViewState {
  switch (pending.kind) {
    case 'close':
      return closeWorkbenchView(state, pending.viewId);
    case 'close-others':
      return closeOtherWorkbenchViews(state, pending.viewId);
    case 'close-right':
      return closeWorkbenchViewsToRight(state, pending.viewId);
  }
}
