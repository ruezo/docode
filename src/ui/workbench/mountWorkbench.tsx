import { createRoot, type Root } from 'react-dom/client';

import type { RouteChangeSource } from '../../linuxdo/routeObserver';
import type { LinuxDoRoute } from '../../linuxdo/routes';
import { LinuxDoNavigationAdapter } from '../../linuxdo/navigationAdapter';
import {
  LinuxDoComposerAdapter,
  type LinuxDoComposerOpenRequest,
  type LinuxDoComposerSubmitRequest,
} from '../../linuxdo/composerAdapter';
import {
  LinuxDoPostActionAdapter,
  type LinuxDoPostActionRequest,
} from '../../linuxdo/postActionAdapter';
import { LinuxDoSearchAdapter } from '../../linuxdo/searchAdapter';
import { LinuxDoExplorerTopicLoader } from '../../linuxdo/explorerTopicLoader';
import { LinuxDoBoostApiClient } from '../../linuxdo/boostApiClient';
import { LinuxDoNotificationsLoader } from '../../linuxdo/notificationsLoader';
import {
  LinuxDoTrustLevelLoader,
  type TrustLevelLoadOutcome,
} from '../../linuxdo/trustLevelLoader';
import { LinuxDoTaxonomyLoader } from '../../linuxdo/taxonomyLoader';
import { installWorkbenchSpaNavigation } from '../../linuxdo/spaNavigation';
import { LinuxDoTopicListPaginator } from '../../linuxdo/topicListPaginator';
import { LinuxDoTopicPaginator } from '../../linuxdo/topicPaginator';
import {
  detectLinuxDoCurrentUser,
  detectLinuxDoUnreadNotifications,
  readLinuxDoCurrentUserAvatarUrl,
} from '../../linuxdo/capabilities';
import { createBrowseHistoryStore } from '../../settings/browseHistoryStore';
import type { WorkbenchAppearancePreference } from '../../settings/workbenchAppearancePreference';
import { extractTopic, type TopicExtraction } from '../../linuxdo/topicAdapter';
import { WorkbenchNavigationCoordinator } from '../../navigation/navigationCoordinator';
import type { TabActionRequest } from '../../navigation/tabActions';
import { NativeContentTransfer } from '../../runtime/nativeContentTransfer';
import '../icons/codicon.css';
import '../icons/setiFileIcon.css';
import '../theme/darkModern.css';
import '../theme/lightModern.css';
import '../theme/monokai.css';
import '../theme/dracula.css';
import '../theme/githubLight.css';
import '../theme/solarizedDark.css';
import '../hover/workbenchTooltip.css';
import '../settings/settingsEditor.css';
import '../../views/trust/trustLevelPanel.css';
import { WorkbenchShell } from './WorkbenchShell';
import { createWorkbenchViewContext } from './workbenchContext';
import { createWorkbenchViewSnapshot } from './workbenchSurfaceState';
import './workbenchShell.css';
import '../terminal/terminalView.css';
import '../quickOpen/quickOpen.css';
import '../../views/topic/topicCodeDocument.css';
import '../../views/topicList/topicListDocument.css';
import '../../views/search/searchDocument.css';

const WORKBENCH_ROOT_MARKER = 'data-docode-workbench-root';
const ROUTE_SETTLE_RETRY_DELAYS = [50, 100, 200, 400, 800, 1_600, 2_400, 3_200] as const;

interface RouteSettleState {
  readonly generation: number;
  readonly href: string;
  expired: boolean;
  nextRetryIndex: number;
  timerId: number | null;
}

export interface MountedWorkbench {
  readonly element: HTMLElement;
  readonly readTopic: (route: Extract<LinuxDoRoute, { readonly kind: 'topic' }>) => TopicExtraction;
  readonly refresh: () => boolean;
  readonly unmount: () => boolean;
  readonly updateRoute: (
    route: LinuxDoRoute,
    generation: number,
    source?: RouteChangeSource,
  ) => boolean;
}

export interface WorkbenchMountActions {
  readonly initialAppearance?: WorkbenchAppearancePreference;
  readonly initialSidebarWidth?: number;
  readonly onAppearanceChange?: (preference: WorkbenchAppearancePreference) => Promise<void>;
  readonly onSidebarWidthChange?: (width: number) => Promise<void>;
  readonly useOriginalView: (() => Promise<void>) | null;
}

export function hasWorkbenchRoot(document: Document): boolean {
  return document.querySelector(`[${WORKBENCH_ROOT_MARKER}]`) !== null;
}

export function mountWorkbench(
  document: Document,
  ownerToken: string,
  initialRoute: LinuxDoRoute,
  actions: WorkbenchMountActions = { useOriginalView: null },
): MountedWorkbench | null {
  const activeWindow: unknown = Reflect.get(globalThis, 'window');
  if (
    !document.defaultView ||
    document.defaultView !== activeWindow ||
    hasWorkbenchRoot(document)
  ) {
    return null;
  }

  const element = document.createElement('div');
  element.setAttribute(WORKBENCH_ROOT_MARKER, ownerToken);
  document.body.append(element);
  const removeSpaNavigation = installWorkbenchSpaNavigation(document, element);
  let root: Root | null = createRoot(element);
  const navigation = new WorkbenchNavigationCoordinator(initialRoute);
  const commandNavigation = new LinuxDoNavigationAdapter(document, element, initialRoute);
  const composer = new LinuxDoComposerAdapter(document, initialRoute);
  const postActions = new LinuxDoPostActionAdapter(document, initialRoute);
  const likeStateOverrides = new Map<number, boolean>();
  const search = new LinuxDoSearchAdapter(document);
  const explorerTopics = new LinuxDoExplorerTopicLoader(document);
  const notificationsLoader = new LinuxDoNotificationsLoader(document);
  const trustLevelLoader = new LinuxDoTrustLevelLoader(document);
  const boostApiClient = new LinuxDoBoostApiClient(document);
  const sendBoost = (postId: number, raw: string, signal: AbortSignal) =>
    boostApiClient.create(postId, raw, signal);
  const loadTrustLevel = (signal: AbortSignal): Promise<TrustLevelLoadOutcome> => {
    const trustUser = detectLinuxDoCurrentUser(document);
    if (trustUser.state !== 'logged-in' || !trustUser.username) {
      return Promise.resolve({ kind: 'authentication-required' });
    }
    return trustLevelLoader.load(trustUser.username, signal);
  };
  const taxonomyLoader = new LinuxDoTaxonomyLoader(document);
  const browseHistory = createBrowseHistoryStore();
  const topicListPaginator = new LinuxDoTopicListPaginator(document);
  const nativeContentTransfer = new NativeContentTransfer(document);
  const resolveNativeContent = (sourceOwner: HTMLElement): HTMLElement | null =>
    nativeContentTransfer.resolveSourceElement(sourceOwner);
  const topicPaginator = new LinuxDoTopicPaginator(document, { resolveNativeContent });
  let viewRevision = 0;
  let lastComposerTopicId: number | null = null;
  let replyTargetController: AbortController | null = null;
  let replyTargetTopicId: number | null = null;
  let routeSettleState: RouteSettleState | null = null;
  const copyText = async (text: string, signal: AbortSignal): Promise<boolean> => {
    if (signal.aborted) return false;
    const clipboard = document.defaultView?.navigator.clipboard;
    if (!clipboard?.writeText) return false;
    try {
      await clipboard.writeText(text);
      return !signal.aborted;
    } catch {
      return false;
    }
  };
  const runTabAction = async ({ id, viewId }: TabActionRequest): Promise<void> => {
    switch (id) {
      case 'close':
      case 'close-others':
      case 'close-right': {
        const result =
          id === 'close'
            ? navigation.requestClose(viewId)
            : id === 'close-others'
              ? navigation.requestCloseOtherViews(viewId)
              : navigation.requestCloseViewsToRight(viewId);
        if (result.kind === 'closed') renderCurrent();
        return;
      }
      case 'copy-topic-link': {
        const view = navigation.snapshot.viewState.openViews.find(({ id }) => id === viewId);
        if (view?.route.kind !== 'topic') throw new Error('The selected tab is not a topic.');
        if (!(await copyText(view.route.href, new AbortController().signal))) {
          throw new Error('Clipboard writing is unavailable.');
        }
        return;
      }
      case 'open-original-view':
        if (!actions.useOriginalView) throw new Error('Original view recovery is unavailable.');
        await actions.useOriginalView();
    }
  };
  const runPostAction = async (request: LinuxDoPostActionRequest) => {
    const outcome = await postActions.execute(request);
    if (request.action === 'like' && outcome.kind === 'confirmed') {
      likeStateOverrides.set(request.postId, outcome.active);
    }
    renderCurrent();
    return outcome;
  };
  const loadExplorerTopics = async (signal: AbortSignal) => {
    const outcome = await explorerTopics.load(signal);
    return outcome.kind === 'ready' ? outcome.document : null;
  };
  const loadTopicList = async (
    view: Parameters<LinuxDoExplorerTopicLoader['loadView']>[0],
    signal: AbortSignal,
  ) => {
    const outcome = await explorerTopics.loadView(view, signal);
    return outcome.kind === 'ready' ? outcome.document : null;
  };
  const openComposer = async (request: LinuxDoComposerOpenRequest) => {
    const outcome = await composer.open(request);
    renderCurrent();
    if (outcome.kind !== 'failed') {
      focusMountedComposerEditor();
    }
    return outcome;
  };
  const submitReply = async (request: LinuxDoComposerSubmitRequest) => {
    const outcome = await composer.submit(request);
    renderCurrent();
    return outcome;
  };
  const focusMountedComposerEditor = (attempt = 0): void => {
    document.defaultView?.requestAnimationFrame(() => {
      if (!root) return;
      const editor = composer.snapshot.capability?.editor;
      if (editor?.isConnected && element.contains(editor)) {
        editor.focus();
        return;
      }
      if (attempt < 7) focusMountedComposerEditor(attempt + 1);
    });
  };
  const synchronizeComposerEvidence = (snapshot: ReturnType<typeof composer.refresh>) => {
    const capability = snapshot.capability;
    const activeRoute = navigation.snapshot.route;
    const activeTopicId = activeRoute.kind === 'topic' ? activeRoute.topicId : null;
    const topicId = capability?.topicId ?? lastComposerTopicId ?? activeTopicId;
    if (topicId !== null) {
      navigation.updateViewEvidence(`topic:${String(topicId)}`, {
        draft: { dirty: capability?.dirty ?? false, source: 'native-composer' },
      });
    }
    lastComposerTopicId = capability?.state === 'closed' ? null : (capability?.topicId ?? topicId);
  };
  const cancelRouteSettle = (): void => {
    const timerId = routeSettleState?.timerId;
    if (timerId !== null && timerId !== undefined) document.defaultView?.clearTimeout(timerId);
    routeSettleState = null;
  };
  const isRouteSettling = (route: LinuxDoRoute, generation: number): boolean =>
    (route.kind === 'topic' || route.kind === 'topic-list') &&
    routeSettleState?.href === route.href &&
    routeSettleState.generation === generation &&
    !routeSettleState.expired;
  const scheduleRouteSettleRetry = (): void => {
    const state = routeSettleState;
    const delay = state ? ROUTE_SETTLE_RETRY_DELAYS[state.nextRetryIndex] : undefined;
    if (!state || delay === undefined || state.timerId !== null) return;
    state.nextRetryIndex += 1;
    state.timerId =
      document.defaultView?.setTimeout(() => {
        if (!root || routeSettleState !== state) return;
        state.timerId = null;
        if (state.nextRetryIndex >= ROUTE_SETTLE_RETRY_DELAYS.length) state.expired = true;
        if (!state.expired) primeReplyTargets(navigation.snapshot.route);
        renderCurrent();
        if (!state.expired && routeSettleState === state) scheduleRouteSettleRetry();
      }, delay) ?? null;
  };
  const beginRouteSettle = (route: LinuxDoRoute, generation: number): void => {
    cancelRouteSettle();
    if (route.kind !== 'topic' && route.kind !== 'topic-list') return;
    routeSettleState = {
      expired: false,
      generation,
      href: route.href,
      nextRetryIndex: 0,
      timerId: null,
    };
    scheduleRouteSettleRetry();
  };
  const renderCurrent = (): boolean => {
    if (!root) return false;
    const composerSnapshot = composer.refresh();
    const currentUser = detectLinuxDoCurrentUser(document);
    synchronizeComposerEvidence(composerSnapshot);
    const current = navigation.snapshot;
    const view = createWorkbenchViewSnapshot(document, current.route, {
      deferTopicCompatibilityError: isRouteSettling(current.route, current.generation),
      deferTopicListCompatibilityError: isRouteSettling(current.route, current.generation),
      likeStateOverrides,
      resolveNativeContent,
    });
    if (
      view.surfaceState.kind !== 'loading' &&
      isRouteSettling(current.route, current.generation)
    ) {
      cancelRouteSettle();
    }
    viewRevision += 1;
    document.documentElement.setAttribute('data-docode-render-revision', String(viewRevision));
    const nextWorkbench = (
      <WorkbenchShell
        actions={{
          onRetry: () => {
            const current = navigation.snapshot;
            beginRouteSettle(current.route, current.generation);
            if (!renderCurrent()) throw new Error('Workbench is not mounted.');
          },
          onUseOriginal: actions.useOriginalView,
        }}
        context={createWorkbenchViewContext(current.route, current.generation)}
        initialAppearance={actions.initialAppearance}
        initialSidebarWidth={actions.initialSidebarWidth}
        nativeContentTransfer={nativeContentTransfer}
        nativeComposer={composerSnapshot.capability ?? view.nativeComposer}
        nativeComposerFeedback={composerSnapshot.feedback}
        navigationState={current.viewState}
        onAppearanceChange={actions.onAppearanceChange}
        onCopyText={copyText}
        onLoadExplorerTopics={loadExplorerTopics}
        onLoadNotifications={(signal) => notificationsLoader.load(signal)}
        onLoadCategories={(signal) => taxonomyLoader.loadCategories(signal)}
        onLoadTags={(signal) => taxonomyLoader.loadTags(signal)}
        onLoadHistory={() => browseHistory.read()}
        onRecordHistory={(input, limit) => browseHistory.record(input, limit)}
        onRemoveHistoryEntry={(viewId) => browseHistory.remove(viewId)}
        onClearHistory={() => browseHistory.clear()}
        onLoadTopicList={loadTopicList}
        onLoadMoreTopics={(route, loadedTopicIds, signal) =>
          topicListPaginator.loadNext(route, loadedTopicIds, signal)
        }
        onLoadEarlierPosts={async (route, loadedPostIds, signal) => {
          const outcome = await topicPaginator.loadPrevious(route, loadedPostIds, signal);
          if (outcome.kind === 'ready' && outcome.loadedPostCount > 0) renderCurrent();
          return outcome;
        }}
        onLoadMorePosts={async (route, loadedPostIds, incompletePostIds, signal) => {
          const outcome = await topicPaginator.loadNext(
            route,
            loadedPostIds,
            incompletePostIds,
            signal,
          );
          if (outcome.kind === 'ready' && outcome.loadedPostCount > 0) renderCurrent();
          return outcome;
        }}
        onNavigateRoute={(route, expectedGeneration, signal) =>
          commandNavigation.navigate(route, expectedGeneration, signal)
        }
        onPrepareOpenView={(route, evidence) => {
          navigation.prepareOpen(route, evidence);
        }}
        onOpenComposer={openComposer}
        onSubmitReply={submitReply}
        onRunPostAction={runPostAction}
        onSearch={(query, signal) => search.search(query, signal)}
        onSidebarWidthChange={actions.onSidebarWidthChange}
        onRunTabAction={runTabAction}
        routeSource={current.lastSource}
        surfaceState={view.surfaceState}
        topicDetailDocument={view.topicDetailDocument}
        topicListDocument={view.topicListDocument}
        currentUserAvatarUrl={readLinuxDoCurrentUserAvatarUrl(document)}
        onLoadTrustLevel={loadTrustLevel}
        onSendBoost={sendBoost}
        terminalUsername={currentUser.username}
        unreadNotifications={detectLinuxDoUnreadNotifications(document)}
        viewRevision={viewRevision}
      />
    );
    root.render(nextWorkbench);
    return true;
  };
  const primeReplyTargets = (route: LinuxDoRoute): void => {
    if (route.kind !== 'topic') {
      replyTargetController?.abort();
      replyTargetController = null;
      replyTargetTopicId = null;
      return;
    }
    if (
      replyTargetController &&
      !replyTargetController.signal.aborted &&
      replyTargetTopicId === route.topicId
    ) {
      return;
    }
    replyTargetController?.abort();
    const controller = new AbortController();
    replyTargetController = controller;
    replyTargetTopicId = route.topicId;
    void topicPaginator.loadReplyTargets(route, controller.signal).then((outcome) => {
      if (replyTargetController === controller) {
        replyTargetController = null;
        replyTargetTopicId = null;
      }
      if (
        !root ||
        controller.signal.aborted ||
        !isSameTopicRoute(navigation.snapshot.route, route) ||
        outcome.kind !== 'ready'
      ) {
        return;
      }
      renderCurrent();
    });
  };
  const handleComposerSnapshot = (snapshot: ReturnType<typeof composer.refresh>) => {
    synchronizeComposerEvidence(snapshot);
    renderCurrent();
  };
  const unsubscribeComposer = composer.subscribe(handleComposerSnapshot);
  composer.start();
  beginRouteSettle(initialRoute, navigation.snapshot.generation);
  renderCurrent();
  primeReplyTargets(initialRoute);

  return {
    element,
    readTopic: (route) => extractTopic(document, route, { resolveNativeContent }),
    refresh: renderCurrent,
    unmount: () => {
      if (!root) return false;
      root.unmount();
      root = null;
      navigation.dispose();
      commandNavigation.dispose();
      unsubscribeComposer();
      composer.dispose();
      postActions.dispose();
      replyTargetController?.abort();
      replyTargetController = null;
      replyTargetTopicId = null;
      topicPaginator.dispose();
      cancelRouteSettle();
      nativeContentTransfer.dispose();
      removeSpaNavigation();
      if (element.getAttribute(WORKBENCH_ROOT_MARKER) === ownerToken) element.remove();
      return true;
    },
    updateRoute: (route, generation, source = 'document') => {
      const previousRoute = navigation.snapshot.route;
      if (route.href !== previousRoute.href && !isSameTopicRoute(previousRoute, route)) {
        replyTargetController?.abort();
        replyTargetController = null;
        replyTargetTopicId = null;
        topicPaginator.reset();
        likeStateOverrides.clear();
      }
      commandNavigation.observe(route, generation);
      composer.observe(route, generation);
      postActions.observe(route, generation);
      navigation.reconcile(route, generation, source);
      beginRouteSettle(route, generation);
      const rendered = renderCurrent();
      primeReplyTargets(route);
      return rendered;
    },
  };
}

function isSameTopicRoute(left: LinuxDoRoute, right: LinuxDoRoute): boolean {
  return left.kind === 'topic' && right.kind === 'topic' && left.topicId === right.topicId;
}
