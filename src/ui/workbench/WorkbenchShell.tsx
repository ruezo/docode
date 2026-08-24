import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';

import {
  COMMAND_PALETTE_COMMAND_ID,
  createWorkbenchCommandRegistry,
  getAvailableWorkbenchCommands,
  QUICK_OPEN_COMMAND_ID,
  TAB_ACTION_COMMAND_IDS,
  TOGGLE_TERMINAL_COMMAND_ID,
  WORKBENCH_COMMAND_IDS,
  type PanelCommandAction,
} from '../../commands/workbenchCommands';
import type { CommandEntryPoint } from '../../commands/commandTypes';
import {
  detectWorkbenchPlatform,
  getWorkbenchAriaKeyShortcut,
  getWorkbenchShortcutLabels,
  installWorkbenchKeybindings,
} from '../../keybindings/keybindingCoordinator';
import type { LinuxDoNavigationOutcome } from '../../linuxdo/navigationAdapter';
import type {
  LinuxDoComposerFeedback,
  LinuxDoComposerOpenOutcome,
  LinuxDoComposerOpenRequest,
  LinuxDoComposerSubmitOutcome,
  LinuxDoComposerSubmitRequest,
} from '../../linuxdo/composerAdapter';
import type { LinuxDoSimpleTopicListView } from '../../linuxdo/explorerTopicLoader';
import type { ComposerCapability } from '../../linuxdo/capabilities';
import type {
  LinuxDoPostActionOutcome,
  LinuxDoPostActionRequest,
} from '../../linuxdo/postActionAdapter';
import type { LinuxDoSearchOutcome, LinuxDoSearchResult } from '../../linuxdo/searchAdapter';
import type { RouteChangeSource } from '../../linuxdo/routeObserver';
import { recognizeLinuxDoRoute, type LinuxDoRoute } from '../../linuxdo/routes';
import type { TopicListPageLoadOutcome } from '../../linuxdo/topicListPaginator';
import type { TopicPostPageLoadOutcome } from '../../linuxdo/topicPaginator';
import type { OpenViewEvidence, OpenViewState } from '../../navigation/openViewState';
import { createQuickOpenCollection, type QuickOpenItem } from '../../quickOpen/quickOpenModel';
import {
  isTabActionAvailable,
  type TabActionId,
  type TabActionRequest,
} from '../../navigation/tabActions';
import type { NativeContentTransfer } from '../../runtime/nativeContentTransfer';
import { Codicon } from '../icons/codicon';
import { WorkbenchTooltip } from '../hover/WorkbenchTooltip';
import { CommandPalette } from '../commandPalette/CommandPalette';
import { QuickOpen } from '../quickOpen/QuickOpen';
import { TerminalView } from '../terminal/TerminalView';
import { EditorTabs, PanelFrame, StatusFrame, type PanelTab } from './WorkbenchChrome';
import { NativeComposerSurface } from './NativeComposerSurface';
import { WorkbenchStateSurface, type WorkbenchStateActions } from './WorkbenchStateSurface';
import { WorkbenchActivityBar } from './WorkbenchActivityBar';
import { WorkbenchBreadcrumbs } from './WorkbenchBreadcrumbs';
import { WorkbenchExplorer } from './WorkbenchExplorer';
import { WorkbenchTitleBar } from './WorkbenchTitleBar';
import type { WorkbenchViewContext } from './workbenchContext';
import type { WorkbenchSurfaceState } from './workbenchSurfaceState';
import { createWorkbenchStatusModel } from './workbenchStatus';
import {
  TopicCodeEditorSurface,
  type TopicCursorPosition,
  type ReadyTopicDetailDocument,
  type TopicReplyFocusRequest,
} from '../../views/topic/TopicCodeDocumentView';
import { createTopicLineLayout } from '../../views/topic/topicLineLayout';
import { TopicMinimapView } from '../../views/topic/TopicMinimapView';
import { TopicOutlineView } from '../../views/topic/TopicOutlineView';
import type {
  TopicDetailDocument,
  TopicReplyDocumentBlock,
} from '../../views/topic/topicDetailDocument';
import type {
  ResolveTopicPostCommand,
  RunTopicPostCommand,
  TopicPostCommandId,
} from '../../views/topic/TopicPostAffordances';
import {
  createTopicOverviewBaseModels,
  positionTopicOverviewModels,
  type TopicOverviewPositionEvidence,
} from '../../views/topic/topicOverviewModel';
import type { TopicScrollRequest, TopicViewportState } from '../../views/topic/topicViewport';
import {
  TopicListEditorSurface,
  type ReadyTopicListDocument,
  type TopicListScrollRequest,
} from '../../views/topicList/TopicListDocumentView';
import {
  createTopicListViewportMemory,
  getTopicListViewportStorage,
} from '../../views/topicList/topicListViewportMemory';
import {
  mergeReadyTopicListDocuments,
  type TopicListDocument,
  type TopicListDocumentLine,
  type TopicListRoute,
} from '../../views/topicList/topicListDocument';
import { SearchDocumentView } from '../../views/search/SearchDocumentView';
import {
  DEFAULT_SIDEBAR_WIDTH,
  MINIMUM_SIDEBAR_WIDTH,
} from '../../settings/workbenchLayoutPreference';
import {
  DEFAULT_WORKBENCH_APPEARANCE,
  resolveWorkbenchTheme,
  type WorkbenchAppearancePreference,
} from '../../settings/workbenchAppearancePreference';
import { SettingsEditor } from '../settings/SettingsEditor';
import {
  applyWorkbenchPresentationMode,
  createWorkbenchModeState,
  getTopicReadingMode,
  type WorkbenchMode,
  type WorkbenchPresentationMode,
} from './workbenchMode';

const PANEL_MINIMUM_HEIGHT = 77;
const EDITOR_MINIMUM_HEIGHT = 120;
const ACTIVITY_BAR_WIDTH = 48;
const SIDEBAR_OVERLAY_BREAKPOINT = 720;
const EDITOR_MINIMUM_WIDTH = 300;
const TITLE_BAR_HEIGHT = 35;
const STATUS_BAR_HEIGHT = 22;
const SASH_SIZE = 4;
const PANEL_PREFERRED_RATIO = 0.125;
const KEYBOARD_RESIZE_STEP = 10;
const TAB_ACTION_IDS = Object.keys(TAB_ACTION_COMMAND_IDS) as readonly TabActionId[];

interface PanelResizeSession {
  readonly pointerId: number;
  readonly startHeight: number;
  readonly startY: number;
}

interface SidebarResizeSession {
  readonly lastWidth: number;
  readonly pointerId: number;
  readonly startWidth: number;
  readonly startX: number;
}

interface TopicPositionState {
  readonly evidence: TopicOverviewPositionEvidence;
  readonly topicId: number;
}

interface TopicFocusState extends TopicReplyFocusRequest {
  readonly topicId: number;
}

interface TopicViewportRecord extends TopicViewportState {
  readonly topicId: number;
}

interface TopicScrollState extends TopicScrollRequest {
  readonly topicId: number;
}

interface TopicCursorState {
  readonly position: TopicCursorPosition;
  readonly topicId: number;
}

interface TopicListPaginationState {
  readonly document: ReadyTopicListDocument;
  readonly hasMore: boolean;
  readonly routeHref: string;
  readonly status: 'error' | 'idle' | 'loading';
}

interface ExplorerSearchSession {
  readonly items: readonly LinuxDoSearchResult[];
  readonly query: string;
}

interface TopicPaginationState {
  readonly earlierStatus: 'complete' | 'error' | 'idle' | 'loading';
  readonly hasEarlier: boolean;
  readonly hasMore: boolean;
  readonly status: 'complete' | 'error' | 'idle' | 'loading';
  readonly topicId: number;
}

type PanelViewId = 'outline' | 'terminal';
type WorkbenchOverlay = 'command-palette' | 'quick-open';

const PROBLEMS_PANEL_TAB: PanelTab = { disabled: true, id: 'problems', label: 'Problems' };
const OUTPUT_PANEL_TAB: PanelTab = { disabled: true, id: 'output', label: 'Output' };
const DEBUG_CONSOLE_PANEL_TAB: PanelTab = {
  disabled: true,
  id: 'debug-console',
  label: 'Debug Console',
};
const TERMINAL_PANEL_TAB: PanelTab = { id: 'terminal', label: 'Terminal' };
const PORTS_PANEL_TAB: PanelTab = { disabled: true, id: 'ports', label: 'Ports' };
const OUTLINE_PANEL_TAB: PanelTab = { id: 'outline', label: 'Outline' };

interface WorkbenchShellProps {
  readonly actions: WorkbenchStateActions;
  readonly context: WorkbenchViewContext;
  readonly initialAppearance?: WorkbenchAppearancePreference | undefined;
  readonly initialSidebarWidth?: number | undefined;
  readonly nativeContentTransfer: NativeContentTransfer | null;
  readonly nativeComposer: ComposerCapability | null;
  readonly nativeComposerFeedback: LinuxDoComposerFeedback;
  readonly navigationState: OpenViewState;
  readonly onNavigateRoute: (
    route: LinuxDoRoute,
    expectedGeneration: number,
    signal: AbortSignal,
  ) => Promise<LinuxDoNavigationOutcome>;
  readonly onCopyText: (text: string, signal: AbortSignal) => Promise<boolean>;
  readonly onLoadExplorerTopics?: (signal: AbortSignal) => Promise<TopicListDocument | null>;
  readonly onLoadTopicList: (
    view: LinuxDoSimpleTopicListView,
    signal: AbortSignal,
  ) => Promise<TopicListDocument | null>;
  readonly onLoadMoreTopics?: (
    route: TopicListRoute,
    loadedTopicIds: ReadonlySet<number>,
    signal: AbortSignal,
  ) => Promise<TopicListPageLoadOutcome>;
  readonly onLoadEarlierPosts?: (
    route: Extract<LinuxDoRoute, { readonly kind: 'topic' }>,
    loadedPostIds: ReadonlySet<number>,
    signal: AbortSignal,
  ) => Promise<TopicPostPageLoadOutcome>;
  readonly onLoadMorePosts?: (
    route: Extract<LinuxDoRoute, { readonly kind: 'topic' }>,
    loadedPostIds: ReadonlySet<number>,
    incompletePostIds: ReadonlySet<number>,
    signal: AbortSignal,
  ) => Promise<TopicPostPageLoadOutcome>;
  readonly onOpenComposer: (
    request: LinuxDoComposerOpenRequest,
  ) => Promise<LinuxDoComposerOpenOutcome>;
  readonly onSubmitReply: (
    request: LinuxDoComposerSubmitRequest,
  ) => Promise<LinuxDoComposerSubmitOutcome>;
  readonly onPrepareOpenView: (route: LinuxDoRoute, evidence: OpenViewEvidence) => void;
  readonly onRunPostAction: (
    request: LinuxDoPostActionRequest,
  ) => Promise<LinuxDoPostActionOutcome>;
  readonly onRunTabAction: (request: TabActionRequest) => Promise<void>;
  readonly onSearch: (query: string, signal: AbortSignal) => Promise<LinuxDoSearchOutcome>;
  readonly onAppearanceChange?:
    ((preference: WorkbenchAppearancePreference) => Promise<void>) | undefined;
  readonly onSidebarWidthChange?: ((width: number) => Promise<void>) | undefined;
  readonly routeSource: RouteChangeSource;
  readonly surfaceState: WorkbenchSurfaceState;
  readonly topicDetailDocument: TopicDetailDocument | null;
  readonly topicListDocument: TopicListDocument | null;
  readonly terminalUsername: string | null;
  readonly viewRevision: number;
}

export function WorkbenchShell({
  actions,
  context,
  initialAppearance = DEFAULT_WORKBENCH_APPEARANCE,
  initialSidebarWidth = DEFAULT_SIDEBAR_WIDTH,
  nativeContentTransfer,
  nativeComposer,
  nativeComposerFeedback,
  navigationState,
  onNavigateRoute,
  onCopyText,
  onLoadExplorerTopics,
  onLoadTopicList,
  onLoadEarlierPosts,
  onLoadMorePosts,
  onLoadMoreTopics,
  onOpenComposer,
  onSubmitReply,
  onPrepareOpenView,
  onRunPostAction,
  onRunTabAction,
  onSearch,
  onAppearanceChange,
  onSidebarWidthChange,
  routeSource,
  surfaceState,
  topicDetailDocument,
  topicListDocument,
  terminalUsername,
  viewRevision,
}: WorkbenchShellProps) {
  const [appearance, setAppearance] = useState(initialAppearance);
  const [appearancePersistenceError, setAppearancePersistenceError] = useState<string | null>(null);
  const [appearancePersistencePending, setAppearancePersistencePending] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [systemTheme, setSystemTheme] = useState<'dark' | 'light'>(() => getSystemTheme());
  const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [sidebarOpen, setSidebarOpen] = useState(
    () => window.innerWidth > SIDEBAR_OVERLAY_BREAKPOINT,
  );
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    clampSidebarWidth(initialSidebarWidth, window.innerWidth),
  );
  const [panelHeight, setPanelHeight] = useState(() => getPreferredPanelHeight(window.innerHeight));
  const [panelMaximized, setPanelMaximized] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [overlay, setOverlay] = useState<WorkbenchOverlay | null>(null);
  const [overlayReturnFocus, setOverlayReturnFocus] = useState<HTMLElement | null>(null);
  const [selectedPanel, setSelectedPanel] = useState<PanelViewId>(() =>
    context.route.kind === 'topic' ? 'outline' : 'terminal',
  );
  const [terminalFocusRequest, setTerminalFocusRequest] = useState(0);
  const [terminalClearRequest, setTerminalClearRequest] = useState(0);
  const [terminalSession, setTerminalSession] = useState(0);
  const [explorerSearchSession, setExplorerSearchSession] = useState<ExplorerSearchSession | null>(
    null,
  );
  const [modeState, setModeState] = useState(createWorkbenchModeState);
  const [modeError, setModeError] = useState<string | null>(null);
  const [layoutPersistenceError, setLayoutPersistenceError] = useState<string | null>(null);
  const [layoutPersistencePending, setLayoutPersistencePending] = useState(false);
  const [loadedExplorerTopicDocument, setLoadedExplorerTopicDocument] =
    useState<TopicListDocument | null>(null);
  const [topicListPagination, setTopicListPagination] = useState<TopicListPaginationState | null>(
    null,
  );
  const [topicPagination, setTopicPagination] = useState<TopicPaginationState | null>(null);
  const [resizing, setResizing] = useState<'panel' | 'sidebar' | null>(null);
  const [windowActive, setWindowActive] = useState(() => document.hasFocus());
  const [topicPosition, setTopicPosition] = useState<TopicPositionState | null>(null);
  const [topicCursor, setTopicCursor] = useState<TopicCursorState | null>(null);
  const [topicFocusRequest, setTopicFocusRequest] = useState<TopicFocusState | null>(null);
  const [topicViewport, setTopicViewport] = useState<TopicViewportRecord | null>(null);
  const [topicScrollRequest, setTopicScrollRequest] = useState<TopicScrollState | null>(null);
  const [composerReturnFocus, setComposerReturnFocus] = useState<HTMLElement | null>(null);
  const panelResizeSession = useRef<PanelResizeSession | null>(null);
  const panelRestoreHeight = useRef<number | null>(null);
  const sidebarResizeSession = useRef<SidebarResizeSession | null>(null);
  const sidebarWidthWrite = useRef<Promise<void>>(Promise.resolve());
  const sidebarWidthWriteRevision = useRef(0);
  const appearanceWrite = useRef<Promise<void>>(Promise.resolve());
  const appearanceWriteRevision = useRef(0);
  const routeNavigationController = useRef<AbortController | null>(null);
  const topicListPaginationController = useRef<AbortController | null>(null);
  const [topicListViewportMemory] = useState(() =>
    createTopicListViewportMemory(getTopicListViewportStorage(window)),
  );
  const topicPaginationController = useRef<AbortController | null>(null);
  const composerWasVisible = useRef(isNativeComposerVisible(nativeComposer));
  const workbenchElement = useRef<HTMLDivElement>(null);
  const panelToggle = useRef<HTMLButtonElement>(null);
  const commandPaletteTrigger = useRef<HTMLButtonElement>(null);
  const quickOpenTrigger = useRef<HTMLButtonElement>(null);
  const replyAction = useRef<HTMLButtonElement>(null);
  const modeDispatchActive = useRef(true);
  const originalViewAction = actions.onUseOriginal;
  const resolvedTheme = resolveWorkbenchTheme(appearance.theme, systemTheme);
  const explorerTopicDocument =
    context.route.kind === 'topic-list' ? topicListDocument : loadedExplorerTopicDocument;
  const keybindingPlatform = useMemo(() => detectWorkbenchPlatform(window.navigator), []);
  const shortcutLabels = useMemo(
    () => getWorkbenchShortcutLabels(keybindingPlatform),
    [keybindingPlatform],
  );
  const panelMaximum = getPanelMaximum(viewportHeight);
  const sidebarMaximum = getSidebarMaximum(viewportWidth);
  const baseReadyTopicList = getReadyTopicList(surfaceState, topicListDocument);
  const readyTopicList = useMemo(() => {
    if (!baseReadyTopicList || topicListPagination?.routeHref !== baseReadyTopicList.route.href) {
      return baseReadyTopicList;
    }
    return mergeReadyTopicListDocuments(baseReadyTopicList, topicListPagination.document);
  }, [baseReadyTopicList, topicListPagination]);
  const loadingMoreTopics =
    context.route.kind === 'topic-list' &&
    topicListPagination?.routeHref === context.route.href &&
    topicListPagination.status === 'loading';
  const hasMoreTopics =
    context.route.kind === 'topic-list' &&
    Boolean(onLoadMoreTopics) &&
    (topicListPagination?.routeHref !== context.route.href || topicListPagination.hasMore);
  const readyTopicDetail = getReadyTopicDetail(surfaceState, topicDetailDocument);
  const topicId = topicDetailDocument?.topic?.id ?? null;
  const positionEvidence = topicPosition?.topicId === topicId ? topicPosition.evidence : null;
  const activeTopicPagination =
    context.route.kind === 'topic' && topicPagination?.topicId === context.route.topicId
      ? topicPagination
      : null;
  const loadingEarlierPosts = activeTopicPagination?.earlierStatus === 'loading';
  const loadingMorePosts = activeTopicPagination?.status === 'loading';
  const hasEarlierPosts =
    context.route.kind === 'topic' &&
    Boolean(onLoadEarlierPosts) &&
    (activeTopicPagination?.hasEarlier ??
      (readyTopicDetail?.loadedWindow.firstPostNumber !== null &&
        readyTopicDetail?.loadedWindow.firstPostNumber !== undefined &&
        readyTopicDetail.loadedWindow.firstPostNumber > 1));
  const hasMorePosts =
    context.route.kind === 'topic' &&
    Boolean(onLoadMorePosts) &&
    (activeTopicPagination?.hasMore ?? true);
  const topicOverviewDocument = useMemo(() => {
    if (topicDetailDocument?.state !== 'ready') return topicDetailDocument;
    return {
      ...topicDetailDocument,
      loadedWindow: { ...topicDetailDocument.loadedWindow, hasMorePosts },
    };
  }, [hasMorePosts, topicDetailDocument]);
  const topicOverviewBase = useMemo(
    () =>
      topicOverviewDocument
        ? createTopicOverviewBaseModels(
            topicOverviewDocument,
            getTopicReadingMode(modeState, navigationState.activeViewId),
          )
        : null,
    [modeState, navigationState.activeViewId, topicOverviewDocument],
  );
  const topicOverview = useMemo(
    () =>
      topicOverviewBase && topicOverviewDocument
        ? positionTopicOverviewModels(topicOverviewBase, topicOverviewDocument, positionEvidence)
        : null,
    [positionEvidence, topicOverviewBase, topicOverviewDocument],
  );
  const topicLineLayout = useMemo(
    () => (readyTopicDetail ? createTopicLineLayout(readyTopicDetail) : null),
    [readyTopicDetail],
  );
  const editorFocusRequest =
    topicFocusRequest && topicFocusRequest.topicId === readyTopicDetail?.topic.id
      ? topicFocusRequest
      : null;
  const editorScrollRequest =
    topicScrollRequest && topicScrollRequest.topicId === readyTopicDetail?.topic.id
      ? topicScrollRequest
      : null;
  const currentTopicViewport = topicViewport?.topicId === topicId ? topicViewport : null;
  const currentCommandPost = readyTopicDetail
    ? (readyTopicDetail.replies.find(({ id }) => id === positionEvidence?.postId) ??
      readyTopicDetail.replies.find(({ floor }) => floor.requested) ??
      readyTopicDetail.replies[0] ??
      null)
    : null;
  const currentTopicCursor =
    topicCursor?.topicId === topicId && topicCursor.position.postId === currentCommandPost?.id
      ? topicCursor.position
      : currentCommandPost
        ? {
            column: 1,
            lineNumber: topicLineLayout?.replies.get(currentCommandPost.id)?.signature ?? 1,
          }
        : null;
  const terminalShortcutLabel = shortcutLabels.get(TOGGLE_TERMINAL_COMMAND_ID);
  const terminalAriaKeyShortcut = getWorkbenchAriaKeyShortcut(
    TOGGLE_TERMINAL_COMMAND_ID,
    keybindingPlatform,
  );
  const terminalPanelTab: PanelTab = {
    ...TERMINAL_PANEL_TAB,
    ...(terminalAriaKeyShortcut ? { ariaKeyShortcuts: terminalAriaKeyShortcut } : {}),
    ...(terminalShortcutLabel ? { shortcutLabel: terminalShortcutLabel } : {}),
  };
  const panelTabs = [
    PROBLEMS_PANEL_TAB,
    OUTPUT_PANEL_TAB,
    DEBUG_CONSOLE_PANEL_TAB,
    terminalPanelTab,
    PORTS_PANEL_TAB,
    ...(context.route.kind === 'topic' ? [OUTLINE_PANEL_TAB] : []),
  ];
  const activePanel: PanelViewId =
    selectedPanel === 'outline' && context.route.kind !== 'topic' ? 'terminal' : selectedPanel;
  const activeViewId = navigationState.activeViewId;
  const currentReadingMode = getTopicReadingMode(modeState, activeViewId);
  const modeViewReady = readyTopicList !== null || readyTopicDetail !== null;
  const currentPresentationMode: WorkbenchPresentationMode = currentReadingMode;
  const availableReadingModes = useMemo<readonly WorkbenchMode[]>(() => {
    if (!modeViewReady) return [];
    return ['code', ...(readyTopicDetail ? (['doc'] as const) : [])];
  }, [modeViewReady, readyTopicDetail]);
  const quickOpenCollection = useMemo(
    () =>
      createQuickOpenCollection(
        navigationState,
        context.route.kind === 'topic-list'
          ? (readyTopicList ?? topicListDocument)
          : explorerTopicDocument,
      ),
    [context.route.kind, explorerTopicDocument, navigationState, readyTopicList, topicListDocument],
  );

  const routePaginationScope =
    context.route.kind === 'topic' ? `topic:${String(context.route.topicId)}` : context.route.href;
  useEffect(() => {
    return () => {
      topicListPaginationController.current?.abort();
      topicListPaginationController.current = null;
      topicPaginationController.current?.abort();
      topicPaginationController.current = null;
    };
  }, [routePaginationScope]);

  useEffect(() => {
    if (
      context.route.kind === 'topic-list' ||
      loadedExplorerTopicDocument?.state === 'ready' ||
      !onLoadExplorerTopics
    ) {
      return;
    }
    const controller = new AbortController();
    void onLoadExplorerTopics(controller.signal).then((document) => {
      if (!controller.signal.aborted && document?.state === 'ready') {
        setLoadedExplorerTopicDocument(document);
      }
    });
    return () => {
      controller.abort();
    };
  }, [context.route.kind, loadedExplorerTopicDocument, onLoadExplorerTopics]);

  const activateRoute = useCallback(
    (route: LinuxDoRoute) => {
      if (route.kind === 'unsupported') return;
      routeNavigationController.current?.abort();
      const controller = new AbortController();
      routeNavigationController.current = controller;
      void onNavigateRoute(route, context.generation, controller.signal).then(() => {
        if (routeNavigationController.current === controller) {
          routeNavigationController.current = null;
        }
      });
    },
    [context.generation, onNavigateRoute],
  );

  const navigateTopicFromList = useCallback(
    (line: TopicListDocumentLine) => {
      const route = recognizeLinuxDoRoute(line.url);
      if (route.kind !== 'topic') return;
      if (readyTopicList) {
        setLoadedExplorerTopicDocument(readyTopicList);
      }
      onPrepareOpenView(route, {
        read: { source: 'topic-list', state: line.readState },
      });
      activateRoute(route);
    },
    [activateRoute, onPrepareOpenView, readyTopicList],
  );

  const requestMoreTopics = useCallback(() => {
    if (
      context.route.kind !== 'topic-list' ||
      !readyTopicList ||
      !onLoadMoreTopics ||
      topicListPaginationController.current ||
      topicListPagination?.hasMore === false
    ) {
      return;
    }
    const route = context.route;
    const routeHref = route.href;
    const controller = new AbortController();
    topicListPaginationController.current = controller;
    setTopicListPagination((current) => ({
      document: current?.routeHref === routeHref ? current.document : readyTopicList,
      hasMore: current?.routeHref === routeHref ? current.hasMore : true,
      routeHref,
      status: 'loading',
    }));
    const loadedTopicIds = new Set(readyTopicList.lines.map(({ topicId }) => topicId));
    const finish = (outcome: TopicListPageLoadOutcome) => {
      if (topicListPaginationController.current === controller) {
        topicListPaginationController.current = null;
      }
      if (controller.signal.aborted) return;
      setTopicListPagination((current) => {
        if (current?.routeHref !== routeHref) return current;
        switch (outcome.kind) {
          case 'ready':
            return {
              document:
                outcome.document?.state === 'ready'
                  ? mergeReadyTopicListDocuments(
                      current.document,
                      outcome.document as ReadyTopicListDocument,
                    )
                  : current.document,
              hasMore: outcome.hasMore,
              routeHref,
              status: 'idle',
            };
          case 'complete':
            return { ...current, hasMore: false, status: 'idle' };
          case 'unavailable':
            return { ...current, status: 'error' };
          case 'aborted':
            return { ...current, status: 'idle' };
        }
      });
    };
    void onLoadMoreTopics(route, loadedTopicIds, controller.signal).then(finish, () => {
      finish({ kind: 'unavailable' });
    });
  }, [context.route, onLoadMoreTopics, readyTopicList, topicListPagination?.hasMore]);

  const requestMorePosts = useCallback(() => {
    if (
      context.route.kind !== 'topic' ||
      !readyTopicDetail ||
      !onLoadMorePosts ||
      topicPaginationController.current ||
      activeTopicPagination?.hasMore === false
    ) {
      return;
    }
    const route = context.route;
    const routeTopicId = route.topicId;
    const controller = new AbortController();
    topicPaginationController.current = controller;
    setTopicPagination((current) => ({
      earlierStatus: current?.topicId === routeTopicId ? current.earlierStatus : 'idle',
      hasEarlier:
        current?.topicId === routeTopicId
          ? current.hasEarlier
          : readyTopicDetail.loadedWindow.firstPostNumber !== null &&
            readyTopicDetail.loadedWindow.firstPostNumber > 1,
      hasMore: current?.topicId === routeTopicId ? current.hasMore : true,
      status: 'loading',
      topicId: routeTopicId,
    }));
    const loadedPostIds = new Set(readyTopicDetail.replies.map(({ id }) => id));
    const incompletePostIds = new Set(
      readyTopicDetail.replies.filter(({ content }) => !content).map(({ id }) => id),
    );
    const finish = (outcome: TopicPostPageLoadOutcome) => {
      if (topicPaginationController.current === controller) {
        topicPaginationController.current = null;
      }
      if (controller.signal.aborted) return;
      setTopicPagination((current) => {
        if (current?.topicId !== routeTopicId) return current;
        switch (outcome.kind) {
          case 'ready':
            if (outcome.loadedPostCount === 0) {
              return { ...current, hasMore: false, status: 'complete' };
            }
            return {
              ...current,
              hasMore: outcome.hasMore,
              status: outcome.hasMore ? 'idle' : 'complete',
            };
          case 'complete':
            return { ...current, hasMore: false, status: 'complete' };
          case 'unavailable':
            return { ...current, status: 'error' };
          case 'aborted':
            return { ...current, status: 'idle' };
        }
      });
    };
    void onLoadMorePosts(route, loadedPostIds, incompletePostIds, controller.signal).then(
      finish,
      () => {
        finish({ kind: 'unavailable' });
      },
    );
  }, [activeTopicPagination?.hasMore, context.route, onLoadMorePosts, readyTopicDetail]);

  const requestEarlierPosts = useCallback(() => {
    if (
      context.route.kind !== 'topic' ||
      !readyTopicDetail ||
      !onLoadEarlierPosts ||
      topicPaginationController.current ||
      activeTopicPagination?.hasEarlier === false
    ) {
      return;
    }
    const route = context.route;
    const routeTopicId = route.topicId;
    const controller = new AbortController();
    topicPaginationController.current = controller;
    setTopicPagination((current) => ({
      earlierStatus: 'loading',
      hasEarlier:
        current?.topicId === routeTopicId
          ? current.hasEarlier
          : readyTopicDetail.loadedWindow.firstPostNumber !== null &&
            readyTopicDetail.loadedWindow.firstPostNumber > 1,
      hasMore: current?.topicId === routeTopicId ? current.hasMore : true,
      status: current?.topicId === routeTopicId ? current.status : 'idle',
      topicId: routeTopicId,
    }));
    const loadedPostIds = new Set(readyTopicDetail.replies.map(({ id }) => id));
    const finish = (outcome: TopicPostPageLoadOutcome) => {
      if (topicPaginationController.current === controller) {
        topicPaginationController.current = null;
      }
      if (controller.signal.aborted) return;
      setTopicPagination((current) => {
        if (current?.topicId !== routeTopicId) return current;
        switch (outcome.kind) {
          case 'ready':
            return {
              ...current,
              earlierStatus: outcome.hasMore ? 'idle' : 'complete',
              hasEarlier: outcome.hasMore,
              hasMore: outcome.hasLater ?? current.hasMore,
              status: outcome.hasLater === false ? 'complete' : current.status,
            };
          case 'complete':
            return { ...current, earlierStatus: 'complete', hasEarlier: false };
          case 'unavailable':
            return { ...current, earlierStatus: 'error' };
          case 'aborted':
            return { ...current, earlierStatus: 'idle' };
        }
      });
    };
    void onLoadEarlierPosts(route, loadedPostIds, controller.signal).then(finish, () => {
      finish({ kind: 'unavailable' });
    });
  }, [activeTopicPagination?.hasEarlier, context.route, onLoadEarlierPosts, readyTopicDetail]);

  const updateTopicPosition = useCallback(
    (postId: number, source: TopicOverviewPositionEvidence['source']) => {
      if (topicId === null) return;
      setTopicPosition((current) =>
        current?.topicId === topicId && current.evidence.postId === postId
          ? current
          : { evidence: { postId, source }, topicId },
      );
    },
    [topicId],
  );

  const selectTopicPost = useCallback(
    (postId: number) => {
      updateTopicPosition(postId, 'focus');
    },
    [updateTopicPosition],
  );

  const navigateTopicPost = useCallback(
    (postId: number) => {
      if (topicId === null) return;
      selectTopicPost(postId);
      setTopicFocusRequest((current) => ({
        postId,
        sequence: (current?.sequence ?? 0) + 1,
        topicId,
      }));
    },
    [selectTopicPost, topicId],
  );

  const trackActiveTopicPost = useCallback(
    (postId: number | null) => {
      if (postId !== null) selectTopicPost(postId);
    },
    [selectTopicPost],
  );

  const trackTopicCursor = useCallback(
    (position: TopicCursorPosition) => {
      if (topicId === null) return;
      setTopicCursor((current) =>
        current?.topicId === topicId &&
        current.position.lineNumber === position.lineNumber &&
        current.position.column === position.column
          ? current
          : { position, topicId },
      );
    },
    [topicId],
  );

  const readyTopicListHref = readyTopicList?.route.href ?? null;
  const trackTopicListViewport = useCallback(
    (scrollTop: number) => {
      if (readyTopicListHref === null) return;
      topicListViewportMemory.track(readyTopicListHref, scrollTop);
    },
    [readyTopicListHref, topicListViewportMemory],
  );

  const topicListScrollRequest = useMemo<TopicListScrollRequest | null>(
    () =>
      readyTopicListHref === null
        ? null
        : { scrollTop: topicListViewportMemory.read(readyTopicListHref), sequence: 1 },
    [readyTopicListHref, topicListViewportMemory],
  );

  useEffect(() => {
    const flush = () => {
      topicListViewportMemory.flush();
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [readyTopicListHref, topicListViewportMemory]);

  const trackTopicViewport = useCallback(
    (viewport: TopicViewportState) => {
      if (topicId === null) return;
      setTopicViewport((current) => {
        const next = { ...viewport, topicId };
        return current && equalTopicViewport(current, next) ? current : next;
      });
      if (viewport.currentPostId !== null) {
        updateTopicPosition(viewport.currentPostId, 'viewport');
      }
    },
    [topicId, updateTopicPosition],
  );

  const scrollTopicToProgress = useCallback(
    (progress: number) => {
      if (topicId === null) return;
      setTopicScrollRequest((current) => ({
        progress,
        sequence: (current?.sequence ?? 0) + 1,
        topicId,
      }));
    },
    [topicId],
  );

  useEffect(() => {
    const media = getColorSchemeMedia();
    if (!media) return;
    const synchronizeTheme = () => {
      setSystemTheme(media.matches ? 'dark' : 'light');
    };
    synchronizeTheme();
    media.addEventListener('change', synchronizeTheme);
    return () => {
      media.removeEventListener('change', synchronizeTheme);
    };
  }, []);

  useEffect(() => {
    const workbenchRoot = workbenchElement.current?.closest<HTMLElement>(
      '[data-docode-workbench-root]',
    );
    if (!workbenchRoot) return;
    workbenchRoot.classList.add('docode-theme-dark-modern');
    workbenchRoot.classList.toggle('docode-theme-light-modern', resolvedTheme === 'light');
    workbenchRoot.dataset.colorTheme = resolvedTheme;
    return () => {
      workbenchRoot.classList.remove('docode-theme-dark-modern', 'docode-theme-light-modern');
      delete workbenchRoot.dataset.colorTheme;
    };
  }, [resolvedTheme]);

  useEffect(() => {
    const onResize = () => {
      const nextViewportHeight = window.innerHeight;
      const nextViewportWidth = window.innerWidth;
      setViewportHeight(nextViewportHeight);
      setViewportWidth(nextViewportWidth);
      setPanelHeight((current) =>
        panelMaximized
          ? getPanelMaximum(nextViewportHeight)
          : clampPanelHeight(current, nextViewportHeight),
      );
      setSidebarWidth((current) => clampSidebarWidth(current, nextViewportWidth));
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, [panelMaximized]);

  useEffect(
    () => () => {
      modeDispatchActive.current = false;
      routeNavigationController.current?.abort();
    },
    [],
  );

  useLayoutEffect(() => {
    if (!panelOpen) panelToggle.current?.focus();
  }, [panelOpen]);

  useLayoutEffect(() => {
    const visible = isNativeComposerVisible(nativeComposer);
    const wasVisible = composerWasVisible.current;
    composerWasVisible.current = visible;
    if (!wasVisible || visible) return;

    const target = composerReturnFocus;
    setComposerReturnFocus(null);
    window.requestAnimationFrame(() => {
      if (target?.isConnected && !target.closest('[hidden]')) target.focus();
      else replyAction.current?.focus();
    });
  }, [composerReturnFocus, nativeComposer]);

  useEffect(() => {
    const onFocus = () => {
      setWindowActive(true);
    };
    const onBlur = () => {
      setWindowActive(false);
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  const setClampedPanelHeight = useCallback(
    (height: number) => {
      panelRestoreHeight.current = null;
      setPanelMaximized(false);
      setPanelHeight(clamp(height, PANEL_MINIMUM_HEIGHT, panelMaximum));
    },
    [panelMaximum],
  );

  const togglePanelMaximize = useCallback(() => {
    if (panelMaximized) {
      setPanelHeight(
        clamp(
          panelRestoreHeight.current ?? getPreferredPanelHeight(viewportHeight),
          PANEL_MINIMUM_HEIGHT,
          panelMaximum,
        ),
      );
      panelRestoreHeight.current = null;
      setPanelMaximized(false);
      return;
    }
    panelRestoreHeight.current = panelHeight;
    setPanelHeight(panelMaximum);
    setPanelMaximized(true);
  }, [panelHeight, panelMaximum, panelMaximized, viewportHeight]);

  const setClampedSidebarWidth = useCallback(
    (width: number) => {
      setSidebarWidth(Math.round(clamp(width, MINIMUM_SIDEBAR_WIDTH, sidebarMaximum)));
    },
    [sidebarMaximum],
  );

  const commitSidebarWidth = useCallback(
    (width: number) => {
      const clampedWidth = Math.round(clamp(width, MINIMUM_SIDEBAR_WIDTH, sidebarMaximum));
      setSidebarWidth(clampedWidth);
      if (!onSidebarWidthChange) return;

      const revision = sidebarWidthWriteRevision.current + 1;
      sidebarWidthWriteRevision.current = revision;
      setLayoutPersistencePending(true);
      const write = sidebarWidthWrite.current.then(
        () => onSidebarWidthChange(clampedWidth),
        () => onSidebarWidthChange(clampedWidth),
      );
      sidebarWidthWrite.current = write.then(
        () => undefined,
        () => undefined,
      );
      void write.then(
        () => {
          if (modeDispatchActive.current && sidebarWidthWriteRevision.current === revision) {
            setLayoutPersistenceError(null);
            setLayoutPersistencePending(false);
          }
        },
        () => {
          if (modeDispatchActive.current && sidebarWidthWriteRevision.current === revision) {
            setLayoutPersistenceError('Unable to save the Explorer width.');
            setLayoutPersistencePending(false);
          }
        },
      );
    },
    [onSidebarWidthChange, sidebarMaximum],
  );

  const commitAppearance = useCallback(
    (preference: WorkbenchAppearancePreference) => {
      setAppearance(preference);
      if (!onAppearanceChange) return;

      const revision = appearanceWriteRevision.current + 1;
      appearanceWriteRevision.current = revision;
      setAppearancePersistencePending(true);
      const write = appearanceWrite.current.then(
        () => onAppearanceChange(preference),
        () => onAppearanceChange(preference),
      );
      appearanceWrite.current = write.then(
        () => undefined,
        () => undefined,
      );
      void write.then(
        () => {
          if (modeDispatchActive.current && appearanceWriteRevision.current === revision) {
            setAppearancePersistenceError(null);
            setAppearancePersistencePending(false);
          }
        },
        () => {
          if (modeDispatchActive.current && appearanceWriteRevision.current === revision) {
            setAppearancePersistenceError('Unable to save the appearance settings.');
            setAppearancePersistencePending(false);
          }
        },
      );
    },
    [onAppearanceChange],
  );

  const selectPanel = useCallback((id: string, focusContent: boolean) => {
    if (id !== 'outline' && id !== 'terminal') return;
    setSelectedPanel(id);
    setPanelOpen(true);
    if (id === 'terminal' && focusContent) {
      setTerminalFocusRequest((current) => current + 1);
    }
  }, []);

  const closePanel = useCallback(() => {
    setPanelOpen(false);
  }, []);

  const setPanelFromCommand = useCallback(
    (action: PanelCommandAction): boolean => {
      switch (action) {
        case 'hide':
          setPanelOpen(false);
          return true;
        case 'show':
          setPanelOpen(true);
          if (activePanel === 'terminal') {
            setTerminalFocusRequest((current) => current + 1);
          }
          return true;
        case 'toggle':
          setPanelOpen((current) => !current);
          if (activePanel === 'terminal') {
            setTerminalFocusRequest((current) => current + 1);
          }
          return true;
        case 'outline':
          if (context.route.kind !== 'topic') return false;
          selectPanel('outline', false);
          return true;
        case 'terminal':
          selectPanel('terminal', true);
          return true;
      }
    },
    [activePanel, context.route.kind, selectPanel],
  );

  const setReadingMode = useCallback(
    (mode: WorkbenchPresentationMode): boolean => {
      if (!modeViewReady || (mode === 'doc' && !readyTopicDetail)) return false;
      setModeState(
        (current) =>
          applyWorkbenchPresentationMode(current, mode, activeViewId, readyTopicDetail !== null) ??
          current,
      );
      return true;
    },
    [activeViewId, modeViewReady, readyTopicDetail],
  );

  const restoreOriginalView = useCallback(
    async (signal: AbortSignal): Promise<boolean> => {
      if (!originalViewAction || signal.aborted) return false;
      await originalViewAction();
      return true;
    },
    [originalViewAction],
  );

  const toggleTerminal = useCallback((): boolean => {
    if (panelOpen && activePanel === 'terminal') {
      setPanelOpen(false);
      return true;
    }
    selectPanel('terminal', true);
    return true;
  }, [activePanel, panelOpen, selectPanel]);

  const showQuickOpen = useCallback((): boolean => {
    if (!context.supported) return false;
    setOverlayReturnFocus((current) => {
      if (current) return current;
      return document.activeElement instanceof HTMLElement ? document.activeElement : null;
    });
    setOverlay('quick-open');
    return true;
  }, [context.supported]);

  const showCommandPalette = useCallback((): boolean => {
    if (!context.supported) return false;
    setOverlayReturnFocus((current) => {
      if (current) return current;
      return document.activeElement instanceof HTMLElement ? document.activeElement : null;
    });
    setOverlay('command-palette');
    return true;
  }, [context.supported]);

  const dismissOverlay = useCallback(() => {
    const activeElement = document.activeElement;
    const shouldRestoreFocus =
      !(activeElement instanceof HTMLElement) ||
      activeElement === document.body ||
      activeElement.closest('.docode-quick-open__overlay') !== null;
    setOverlay(null);
    const target = overlayReturnFocus;
    setOverlayReturnFocus(null);
    if (!shouldRestoreFocus) return;
    window.requestAnimationFrame(() => {
      if (target?.isConnected && !target.closest('[hidden]')) target.focus();
      else if (overlay === 'command-palette') commandPaletteTrigger.current?.focus();
      else quickOpenTrigger.current?.focus();
    });
  }, [overlay, overlayReturnFocus]);

  const openComposerWithFocusBoundary = useCallback(
    async (request: LinuxDoComposerOpenRequest) => {
      const activeElement = document.activeElement;
      setComposerReturnFocus(
        getComposerReturnFocus(activeElement instanceof HTMLElement ? activeElement : null),
      );
      const outcome = await onOpenComposer(request);
      if (outcome.kind === 'failed') setComposerReturnFocus(null);
      return outcome;
    },
    [onOpenComposer],
  );

  const navigateFromStatus = useCallback(
    (href: string) => {
      const route = recognizeLinuxDoRoute(href);
      activateRoute(route);
    },
    [activateRoute],
  );

  const commandContext = useMemo(
    () => ({
      availableReadingModes,
      currentPost: currentCommandPost
        ? {
            capabilities: currentCommandPost.capabilities,
            id: currentCommandPost.id,
            number: currentCommandPost.floor.number,
            permalink: currentCommandPost.permalink,
          }
        : null,
      posts:
        readyTopicDetail?.replies.map((reply) => ({
          capabilities: reply.capabilities,
          id: reply.id,
          number: reply.floor.number,
          permalink: reply.permalink,
        })) ?? [],
      tabTarget: null,
      topicInteraction: readyTopicDetail?.capabilities ?? null,
      topicReady: readyTopicDetail !== null,
      view: context,
    }),
    [availableReadingModes, context, currentCommandPost, readyTopicDetail],
  );
  const commandRegistry = useMemo(
    () =>
      createWorkbenchCommandRegistry({
        copyText: onCopyText,
        loadTopicList: onLoadTopicList,
        navigate: onNavigateRoute,
        openComposer: openComposerWithFocusBoundary,
        restoreOriginalView,
        runPostAction: onRunPostAction,
        runTabAction: onRunTabAction,
        setPanel: setPanelFromCommand,
        setReadingMode,
        searchTopics: onSearch,
        setSearchSession: (session) => {
          setExplorerSearchSession(session);
          return true;
        },
        showCommandPalette,
        showQuickOpen,
        submitReply: onSubmitReply,
        toggleTerminal,
      }),
    [
      onNavigateRoute,
      onCopyText,
      onLoadTopicList,
      openComposerWithFocusBoundary,
      onRunPostAction,
      onRunTabAction,
      restoreOriginalView,
      setPanelFromCommand,
      setReadingMode,
      onSearch,
      showCommandPalette,
      showQuickOpen,
      onSubmitReply,
      toggleTerminal,
    ],
  );
  const createPostCommandContext = useCallback(
    (reply: TopicReplyDocumentBlock) => ({
      ...commandContext,
      currentPost: {
        capabilities: reply.capabilities,
        id: reply.id,
        number: reply.floor.number,
        permalink: reply.permalink,
      },
    }),
    [commandContext],
  );
  const resolvePostCommand = useCallback<ResolveTopicPostCommand>(
    (commandId, reply, source) => {
      const registryId = getTopicPostCommandId(commandId);
      const availability = commandRegistry.getAvailability(
        registryId,
        createPostCommandContext(reply),
        source,
      );
      return availability.available
        ? {
            available: true,
            message: commandRegistry.resolve(registryId)?.title ?? 'Action available',
          }
        : { available: false, message: availability.message };
    },
    [commandRegistry, createPostCommandContext],
  );
  const runPostCommand = useCallback<RunTopicPostCommand>(
    async ({ commandId, reply, signal, source }) => {
      const result = await commandRegistry.dispatchById({
        arguments: [],
        commandId: getTopicPostCommandId(commandId),
        context: createPostCommandContext(reply),
        signal,
        source,
      });
      return result.status === 'success'
        ? { kind: 'success' }
        : {
            kind: 'failed',
            message:
              result.status === 'error'
                ? result.error.message
                : 'The post action did not complete.',
          };
    },
    [commandRegistry, createPostCommandContext],
  );
  const createTabCommandContext = useCallback(
    (viewId: string) => ({
      ...commandContext,
      tabTarget: {
        availableActions: TAB_ACTION_IDS.filter((actionId) =>
          isTabActionAvailable(navigationState, actionId, viewId, originalViewAction !== null),
        ),
        viewId,
      },
    }),
    [commandContext, navigationState, originalViewAction],
  );
  const runTabCommand = useCallback(
    async (
      request: TabActionRequest,
      source: Extract<CommandEntryPoint, 'context-menu' | 'editor-action'>,
    ) => {
      const result = await commandRegistry.dispatchById({
        arguments: [],
        commandId: TAB_ACTION_COMMAND_IDS[request.id],
        context: createTabCommandContext(request.viewId),
        source,
      });
      if (result.status !== 'success') {
        throw new Error(
          result.status === 'error' ? result.error.message : 'The tab action did not complete.',
        );
      }
    },
    [commandRegistry, createTabCommandContext],
  );
  useEffect(
    () =>
      installWorkbenchKeybindings({
        dispatch: ({ arguments: arguments_, commandId }) => {
          void commandRegistry.dispatchById({
            arguments: arguments_,
            commandId,
            context: commandContext,
            source: 'keybinding',
          });
        },
        document,
        enabled: () => context.supported,
        platform: keybindingPlatform,
      }),
    [commandContext, commandRegistry, context.supported, keybindingPlatform],
  );
  const executeTerminalCommand = useCallback(
    (input: string, signal: AbortSignal) =>
      commandRegistry.dispatch({ context: commandContext, input, signal, source: 'terminal' }),
    [commandContext, commandRegistry],
  );
  const terminalCommands = useMemo(
    () => getAvailableWorkbenchCommands(commandRegistry, commandContext, 'terminal'),
    [commandContext, commandRegistry],
  );
  const replyAvailability = commandRegistry.getAvailability(
    WORKBENCH_COMMAND_IDS.reply,
    commandContext,
    'editor-action',
  );
  const replyPending = nativeComposerFeedback?.kind === 'opening';
  const replyActionLabel = replyPending
    ? nativeComposerFeedback.message
    : replyAvailability.available
      ? 'Reply to topic with Linux DO composer'
      : replyAvailability.message;

  const selectReadingMode = useCallback(
    (mode: WorkbenchMode) => {
      setModeError(null);
      void commandRegistry
        .dispatchById({
          arguments: [mode],
          commandId: WORKBENCH_COMMAND_IDS.mode,
          context: commandContext,
          source: 'status-bar',
        })
        .then((result) => {
          if (!modeDispatchActive.current) return;
          setModeError(result.status === 'error' ? result.error.message : null);
        });
    },
    [commandContext, commandRegistry],
  );
  const topicPaginationStatus =
    activeTopicPagination?.earlierStatus === 'loading' ||
    activeTopicPagination?.status === 'loading'
      ? 'loading'
      : activeTopicPagination?.earlierStatus === 'error' ||
          activeTopicPagination?.status === 'error'
        ? 'error'
        : (activeTopicPagination?.status ?? activeTopicPagination?.earlierStatus ?? 'idle');

  const statusModel = createWorkbenchStatusModel({
    activeMode: modeViewReady ? currentPresentationMode : null,
    availableModes: availableReadingModes,
    composerFeedback: nativeComposerFeedback,
    context,
    layoutError: layoutPersistenceError ?? appearancePersistenceError,
    editor: readyTopicDetail
      ? {
          cursor: currentReadingMode === 'code' ? currentTopicCursor : null,
          loadedReplyCount: readyTopicDetail.loadedWindow.loadedPostCount,
        }
      : null,
    modeError,
    modePending: null,
    surfaceState,
    topicListPaginationError:
      context.route.kind === 'topic-list' &&
      topicListPagination?.routeHref === context.route.href &&
      topicListPagination.status === 'error'
        ? 'Linux DO did not return the next topic page. Scroll near the end to retry or use the original site.'
        : null,
    topicPagination: activeTopicPagination ? { status: topicPaginationStatus } : null,
    topic: readyTopicDetail
      ? {
          category: readyTopicDetail.topic.category,
          currentPost: currentCommandPost
            ? {
                bookmark: currentCommandPost.capabilities.bookmark,
                like: currentCommandPost.capabilities.like,
                number: currentCommandPost.floor.number,
                permalink: currentCommandPost.permalink,
              }
            : null,
          interaction: readyTopicDetail.capabilities,
          loadedWindow: readyTopicDetail.loadedWindow,
        }
      : null,
  });

  const shellStyle = useMemo(
    () =>
      ({
        '--docode-panel-height': `${String(panelHeight)}px`,
        '--docode-sidebar-width': `${String(sidebarWidth)}px`,
        ...(appearance.topicListBodyColor !== DEFAULT_WORKBENCH_APPEARANCE.topicListBodyColor
          ? { '--docode-color-topic-list-body': appearance.topicListBodyColor }
          : {}),
        ...(appearance.topicDetailBodyColor !== DEFAULT_WORKBENCH_APPEARANCE.topicDetailBodyColor
          ? { '--docode-color-topic-detail-body': appearance.topicDetailBodyColor }
          : {}),
      }) as CSSProperties,
    [appearance.topicDetailBodyColor, appearance.topicListBodyColor, panelHeight, sidebarWidth],
  );

  return (
    <div
      ref={workbenchElement}
      aria-label="DOCode workbench"
      className={`docode-workbench docode-theme-dark-modern${resolvedTheme === 'light' ? ' docode-theme-light-modern' : ''}`}
      data-appearance-storage-error={appearancePersistenceError ? 'true' : undefined}
      data-appearance-storage-pending={appearancePersistencePending ? 'true' : 'false'}
      data-color-theme={resolvedTheme}
      data-open-view-count={navigationState.openViews.length}
      data-panel-maximized={panelMaximized ? 'true' : 'false'}
      data-panel-open={panelOpen ? 'true' : 'false'}
      data-layout-storage-error={layoutPersistenceError ? 'true' : undefined}
      data-layout-storage-pending={layoutPersistencePending ? 'true' : 'false'}
      data-reading-mode={currentPresentationMode}
      data-route-kind={context.route.kind}
      data-route-generation={context.generation}
      data-route-source={routeSource}
      data-resizing={resizing ?? undefined}
      data-sidebar-open={sidebarOpen ? 'true' : 'false'}
      data-supported={context.supported ? 'true' : 'false'}
      role="region"
      style={shellStyle}
    >
      <WorkbenchTitleBar
        commandCenterLabel={appearance.commandCenterLabel}
        commandCenterRef={quickOpenTrigger}
        context={context}
        onOpenCommandPalette={() => {
          void commandRegistry.dispatchById({
            arguments: [],
            commandId: COMMAND_PALETTE_COMMAND_ID,
            context: commandContext,
            source: 'editor-action',
          });
        }}
        onOpenQuickOpen={() => {
          void commandRegistry.dispatchById({
            arguments: [],
            commandId: QUICK_OPEN_COMMAND_ID,
            context: commandContext,
            source: 'editor-action',
          });
        }}
        onTogglePanel={() => {
          setPanelOpen((current) => !current);
        }}
        onToggleSidebar={() => {
          setSidebarOpen((current) => !current);
        }}
        panelOpen={panelOpen}
        quickInputOpen={overlay !== null}
        quickOpenAriaKeyShortcuts={
          getWorkbenchAriaKeyShortcut(QUICK_OPEN_COMMAND_ID, keybindingPlatform) ?? undefined
        }
        quickOpenTooltip={`Quick Open (${shortcutLabels.get(QUICK_OPEN_COMMAND_ID) ?? ''})`}
        sidebarOpen={sidebarOpen}
      />
      <div className="docode-workbench__main">
        <WorkbenchActivityBar
          onOpenExplorer={() => {
            setSidebarOpen((current) => !current);
          }}
          onOpenQuickOpen={() => {
            void commandRegistry.dispatchById({
              arguments: [],
              commandId: QUICK_OPEN_COMMAND_ID,
              context: commandContext,
              source: 'editor-action',
            });
          }}
          onRestoreOriginal={
            originalViewAction
              ? () => {
                  setModeError(null);
                  void restoreOriginalView(new AbortController().signal)
                    .then((restored) => {
                      if (!restored && modeDispatchActive.current) {
                        setModeError('Original Linux DO could not be restored right now.');
                      }
                    })
                    .catch(() => {
                      if (modeDispatchActive.current) {
                        setModeError('Original Linux DO could not be restored right now.');
                      }
                    });
                }
              : null
          }
          onOpenSettings={() => {
            setOverlay(null);
            setSettingsOpen(true);
          }}
          settingsOpen={settingsOpen}
          sidebarOpen={sidebarOpen}
        />
        {sidebarOpen ? (
          <WorkbenchExplorer
            context={context}
            navigationState={navigationState}
            onCloseView={(viewId) => {
              void runTabCommand({ id: 'close', viewId }, 'editor-action');
            }}
            onNavigateRoute={activateRoute}
            onOpenQuickOpen={() => {
              void commandRegistry.dispatchById({
                arguments: [],
                commandId: QUICK_OPEN_COMMAND_ID,
                context: commandContext,
                source: 'editor-action',
              });
            }}
            onRefresh={() => {
              void actions.onRetry();
            }}
            onClearSearch={() => {
              setExplorerSearchSession(null);
            }}
            searchSession={explorerSearchSession}
          />
        ) : null}
        {sidebarOpen ? (
          <div
            aria-label="Resize primary side bar"
            aria-orientation="vertical"
            aria-valuemax={sidebarMaximum}
            aria-valuemin={MINIMUM_SIDEBAR_WIDTH}
            aria-valuenow={sidebarWidth}
            className="docode-workbench__sidebar-sash"
            onDoubleClick={() => {
              commitSidebarWidth(DEFAULT_SIDEBAR_WIDTH);
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight')
                commitSidebarWidth(sidebarWidth + KEYBOARD_RESIZE_STEP);
              else if (event.key === 'ArrowLeft')
                commitSidebarWidth(sidebarWidth - KEYBOARD_RESIZE_STEP);
              else if (event.key === 'Home') commitSidebarWidth(MINIMUM_SIDEBAR_WIDTH);
              else if (event.key === 'End') commitSidebarWidth(sidebarMaximum);
              else return;
              event.preventDefault();
            }}
            onLostPointerCapture={(event) => {
              const session = sidebarResizeSession.current;
              if (session?.pointerId !== event.pointerId) return;
              sidebarResizeSession.current = null;
              commitSidebarWidth(session.lastWidth);
              setResizing(null);
            }}
            onPointerCancel={(event) => {
              const session = sidebarResizeSession.current;
              if (session?.pointerId !== event.pointerId) return;
              sidebarResizeSession.current = null;
              commitSidebarWidth(session.lastWidth);
              setResizing(null);
            }}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              sidebarResizeSession.current = {
                lastWidth: sidebarWidth,
                pointerId: event.pointerId,
                startWidth: sidebarWidth,
                startX: event.clientX,
              };
              setResizing('sidebar');
              event.preventDefault();
            }}
            onPointerMove={(event) => {
              const session = sidebarResizeSession.current;
              if (session?.pointerId !== event.pointerId) return;
              const nextWidth = Math.round(
                clamp(
                  session.startWidth + event.clientX - session.startX,
                  MINIMUM_SIDEBAR_WIDTH,
                  sidebarMaximum,
                ),
              );
              sidebarResizeSession.current = { ...session, lastWidth: nextWidth };
              setClampedSidebarWidth(nextWidth);
            }}
            onPointerUp={(event) => {
              const session = sidebarResizeSession.current;
              if (session?.pointerId !== event.pointerId) return;
              sidebarResizeSession.current = null;
              commitSidebarWidth(session.lastWidth);
              setResizing(null);
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
            }}
            role="separator"
            tabIndex={0}
          />
        ) : null}
        <div className="docode-workbench__body" data-panel-open={panelOpen ? 'true' : 'false'}>
          <main
            aria-label="Editor region"
            className="docode-workbench__editor"
            data-settings-open={settingsOpen ? 'true' : 'false'}
          >
            {!settingsOpen &&
            (surfaceState.kind === 'loading' ||
              loadingMoreTopics ||
              loadingEarlierPosts ||
              loadingMorePosts) ? (
              <div
                aria-label={
                  loadingEarlierPosts
                    ? 'Loading earlier replies…'
                    : loadingMorePosts
                      ? 'Loading more replies…'
                      : loadingMoreTopics
                        ? 'Loading more topics…'
                        : surfaceState.title
                }
                aria-valuetext={
                  loadingEarlierPosts
                    ? 'Reading earlier Linux DO topic replies.'
                    : loadingMorePosts
                      ? 'Reading the next Linux DO topic replies.'
                      : loadingMoreTopics
                        ? 'Reading the next Linux DO topic page.'
                        : surfaceState.description
                }
                className="docode-workbench__editor-progress"
                role="progressbar"
              >
                <div className="docode-workbench__editor-progress-bit" />
              </div>
            ) : null}
            <div className="docode-workbench__editor-title">
              {settingsOpen ? (
                <div className="docode-workbench__settings-tab" data-active="true">
                  <Codicon name="settings-gear" />
                  <span className="docode-workbench__settings-tab-label">Settings</span>
                  <button
                    aria-label="Close Settings"
                    className="docode-workbench__settings-tab-close"
                    onClick={() => {
                      setSettingsOpen(false);
                    }}
                    type="button"
                  >
                    <Codicon name="close" />
                  </button>
                </div>
              ) : (
                <>
                  <EditorTabs
                    context={context}
                    navigationState={navigationState}
                    onRunTabAction={runTabCommand}
                    originalViewAvailable={actions.onUseOriginal !== null}
                    windowActive={windowActive}
                  />
                  <button
                    aria-busy={replyPending}
                    aria-label={replyActionLabel}
                    className="docode-workbench__quick-open-trigger"
                    data-docode-tooltip={
                      replyPending
                        ? nativeComposerFeedback.message
                        : replyAvailability.available
                          ? 'Reply to Topic'
                          : replyAvailability.message
                    }
                    disabled={!replyAvailability.available || replyPending}
                    onClick={() => {
                      void commandRegistry.dispatchById({
                        arguments: [],
                        commandId: WORKBENCH_COMMAND_IDS.reply,
                        context: commandContext,
                        source: 'editor-action',
                      });
                    }}
                    ref={replyAction}
                    type="button"
                  >
                    <Codicon name="source-control" />
                  </button>
                  <button
                    aria-label={panelOpen ? 'Hide Bottom Panel' : 'Show Bottom Panel'}
                    aria-pressed={panelOpen}
                    className="docode-workbench__quick-open-trigger"
                    data-docode-tooltip={panelOpen ? 'Hide Bottom Panel' : 'Show Bottom Panel'}
                    onClick={() => {
                      if (panelOpen) closePanel();
                      else {
                        setPanelOpen(true);
                        if (activePanel === 'terminal') {
                          setTerminalFocusRequest((current) => current + 1);
                        }
                      }
                    }}
                    ref={panelToggle}
                    type="button"
                  >
                    <Codicon name="split-horizontal" />
                  </button>
                  <button
                    aria-label="Open Command Palette"
                    aria-keyshortcuts={
                      getWorkbenchAriaKeyShortcut(COMMAND_PALETTE_COMMAND_ID, keybindingPlatform) ??
                      undefined
                    }
                    className="docode-workbench__quick-open-trigger"
                    data-docode-tooltip={`More Actions (${shortcutLabels.get(COMMAND_PALETTE_COMMAND_ID) ?? ''})`}
                    disabled={!context.supported}
                    onClick={() => {
                      void commandRegistry.dispatchById({
                        arguments: [],
                        commandId: COMMAND_PALETTE_COMMAND_ID,
                        context: commandContext,
                        source: 'editor-action',
                      });
                    }}
                    ref={commandPaletteTrigger}
                    type="button"
                  >
                    <Codicon name="ellipsis" />
                  </button>
                </>
              )}
            </div>
            {settingsOpen ? (
              <SettingsEditor
                onChange={commitAppearance}
                preference={appearance}
                resolvedTheme={resolvedTheme}
              />
            ) : (
              <>
                <WorkbenchBreadcrumbs
                  context={context}
                  currentPostHref={currentCommandPost?.permalink ?? null}
                  currentPostNumber={currentCommandPost?.floor.number ?? null}
                />
                <div className="docode-workbench__editor-grid">
                  {readyTopicList ? (
                    <TopicListEditorSurface
                      document={readyTopicList}
                      hasMoreTopics={hasMoreTopics}
                      loadingMoreTopics={loadingMoreTopics}
                      onNavigateTopic={navigateTopicFromList}
                      onRequestMoreTopics={requestMoreTopics}
                      onViewportChange={trackTopicListViewport}
                      platform={keybindingPlatform}
                      scrollRequest={topicListScrollRequest}
                    />
                  ) : readyTopicDetail && nativeContentTransfer ? (
                    <TopicCodeEditorSurface
                      document={readyTopicDetail}
                      earlierPaginationStatus={activeTopicPagination?.earlierStatus ?? 'idle'}
                      focusRequest={editorFocusRequest}
                      hasEarlierPosts={hasEarlierPosts}
                      hasMorePosts={hasMorePosts}
                      key={readyTopicDetail.topic.id}
                      loadingEarlierPosts={loadingEarlierPosts}
                      loadingMorePosts={loadingMorePosts}
                      mode={currentReadingMode}
                      nativeContentTransfer={nativeContentTransfer}
                      onActiveReplyChange={trackActiveTopicPost}
                      onCursorChange={trackTopicCursor}
                      onRequestEarlierPosts={requestEarlierPosts}
                      onRequestMorePosts={requestMorePosts}
                      onResolvePostCommand={resolvePostCommand}
                      onRunPostCommand={runPostCommand}
                      onViewportChange={trackTopicViewport}
                      paginationStatus={activeTopicPagination?.status ?? 'idle'}
                      revision={viewRevision}
                      scrollRequest={editorScrollRequest}
                      showAuthorAvatars={appearance.showTopicAvatars}
                    />
                  ) : context.route.kind === 'search' ? (
                    <SearchDocumentView
                      expectedGeneration={context.generation}
                      onNavigate={onNavigateRoute}
                      onSearch={onSearch}
                      query={context.route.query}
                    />
                  ) : (
                    <>
                      <aside className="docode-workbench__gutter" aria-label="Gutter slot" />
                      <section
                        className="docode-workbench__editor-content"
                        id="docode-workbench-editor-content"
                        aria-label="Editor content slot"
                      >
                        <WorkbenchStateSurface
                          key={`${surfaceState.kind}:${surfaceState.code ?? 'none'}`}
                          actions={actions}
                          state={surfaceState}
                        />
                      </section>
                    </>
                  )}
                  {context.route.kind === 'topic' ? (
                    <TopicMinimapView
                      model={topicOverview?.minimap ?? null}
                      onNavigatePost={navigateTopicPost}
                      onScrollProgress={scrollTopicToProgress}
                      viewport={currentTopicViewport}
                    />
                  ) : (
                    <aside className="docode-workbench__minimap" aria-label="Minimap slot" />
                  )}
                </div>
              </>
            )}
          </main>

          <div
            aria-label="Resize bottom panel"
            aria-orientation="horizontal"
            aria-valuemax={panelMaximum}
            aria-valuemin={PANEL_MINIMUM_HEIGHT}
            aria-valuenow={panelHeight}
            className="docode-workbench__sash"
            hidden={!panelOpen}
            onDoubleClick={() => {
              setClampedPanelHeight(getPreferredPanelHeight(viewportHeight));
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowUp')
                setClampedPanelHeight(panelHeight + KEYBOARD_RESIZE_STEP);
              else if (event.key === 'ArrowDown')
                setClampedPanelHeight(panelHeight - KEYBOARD_RESIZE_STEP);
              else if (event.key === 'Home') setClampedPanelHeight(PANEL_MINIMUM_HEIGHT);
              else if (event.key === 'End') setClampedPanelHeight(panelMaximum);
              else return;
              event.preventDefault();
            }}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              panelResizeSession.current = {
                pointerId: event.pointerId,
                startHeight: panelHeight,
                startY: event.clientY,
              };
              setResizing('panel');
              event.preventDefault();
            }}
            onPointerMove={(event) => {
              const session = panelResizeSession.current;
              if (session?.pointerId !== event.pointerId) return;
              setClampedPanelHeight(session.startHeight + session.startY - event.clientY);
            }}
            onPointerUp={(event) => {
              const session = panelResizeSession.current;
              if (session?.pointerId !== event.pointerId) return;
              panelResizeSession.current = null;
              setResizing(null);
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
            }}
            role="separator"
            tabIndex={0}
          />

          <PanelFrame
            activeTabId={activePanel}
            actions={
              <>
                {activePanel === 'terminal' ? (
                  <>
                    <span
                      aria-label="Active Terminal Session: linux.do"
                      className="docode-workbench__terminal-session"
                      role="status"
                    >
                      <Codicon name="terminal" />
                      <span>linux.do</span>
                    </span>
                    <button
                      aria-label="New Terminal Session"
                      className="docode-workbench__panel-action"
                      data-docode-tooltip="New Terminal Session"
                      onClick={() => {
                        setTerminalSession((current) => current + 1);
                        setTerminalFocusRequest((current) => current + 1);
                      }}
                      type="button"
                    >
                      <Codicon name="add" />
                    </button>
                    <button
                      aria-label="Clear Terminal"
                      className="docode-workbench__panel-action"
                      data-docode-tooltip="Clear Terminal"
                      onClick={() => {
                        setTerminalClearRequest((current) => current + 1);
                      }}
                      type="button"
                    >
                      <Codicon name="trash" />
                    </button>
                    <button
                      aria-label="More Terminal Actions"
                      className="docode-workbench__panel-action"
                      data-docode-tooltip="More Terminal Actions"
                      onClick={() => {
                        void commandRegistry.dispatchById({
                          arguments: [],
                          commandId: COMMAND_PALETTE_COMMAND_ID,
                          context: commandContext,
                          source: 'editor-action',
                        });
                      }}
                      type="button"
                    >
                      <Codicon name="ellipsis" />
                    </button>
                    <span aria-hidden="true" className="docode-workbench__panel-action-separator" />
                  </>
                ) : null}
                <button
                  aria-label={
                    panelMaximized ? 'Restore Bottom Panel Size' : 'Maximize Bottom Panel'
                  }
                  aria-pressed={panelMaximized}
                  className="docode-workbench__panel-action"
                  data-docode-tooltip={
                    panelMaximized ? 'Restore Panel Size' : 'Maximize Panel Size'
                  }
                  onClick={togglePanelMaximize}
                  type="button"
                >
                  <Codicon name={panelMaximized ? 'screen-normal' : 'screen-full'} />
                </button>
              </>
            }
            context={context}
            onClose={closePanel}
            onSelectTab={selectPanel}
            open={panelOpen}
            tabs={panelTabs}
          >
            {context.route.kind === 'topic' ? (
              <div
                className="docode-workbench__panel-view"
                hidden={activePanel !== 'outline'}
                key="outline"
              >
                <TopicOutlineView
                  model={topicOverview?.outline ?? null}
                  onNavigatePost={navigateTopicPost}
                  onSelectPost={selectTopicPost}
                  range={topicOverview?.minimap.range ?? null}
                />
              </div>
            ) : null}
            {context.supported ? (
              <div
                className="docode-workbench__panel-view"
                hidden={activePanel !== 'terminal'}
                key="terminal"
              >
                <TerminalView
                  clearRequest={terminalClearRequest}
                  commands={terminalCommands}
                  executeCommand={executeTerminalCommand}
                  focusRequest={terminalFocusRequest}
                  key={terminalSession}
                  username={terminalUsername}
                />
              </div>
            ) : (
              <div className="docode-workbench__panel-view" hidden={activePanel !== 'terminal'}>
                <div className="docode-workbench__panel-message" role="status">
                  Terminal unavailable on this route.
                </div>
              </div>
            )}
          </PanelFrame>
        </div>
      </div>
      <StatusFrame
        model={statusModel}
        onNavigate={navigateFromStatus}
        onSelectMode={(mode) => {
          selectReadingMode(mode);
        }}
      />
      {nativeContentTransfer ? (
        <NativeComposerSurface
          capability={nativeComposer}
          feedback={nativeComposerFeedback}
          nativeContentTransfer={nativeContentTransfer}
          revision={viewRevision}
        />
      ) : null}
      {overlay === 'command-palette' ? (
        <CommandPalette
          context={commandContext}
          onDismiss={dismissOverlay}
          registry={commandRegistry}
          shortcuts={shortcutLabels}
        />
      ) : null}
      {overlay === 'quick-open' ? (
        <QuickOpen
          collection={quickOpenCollection}
          onDismiss={dismissOverlay}
          onOpenItem={(item: QuickOpenItem, signal) =>
            onNavigateRoute(item.route, context.generation, signal)
          }
          onSearch={onSearch}
        />
      ) : null}
      <WorkbenchTooltip />
    </div>
  );
}

function getTopicPostCommandId(commandId: TopicPostCommandId): string {
  switch (commandId) {
    case 'like':
      return WORKBENCH_COMMAND_IDS.like;
    case 'bookmark':
      return WORKBENCH_COMMAND_IDS.bookmark;
    case 'reply':
      return WORKBENCH_COMMAND_IDS.reply;
    case 'copy-link':
      return WORKBENCH_COMMAND_IDS.copyPostLink;
  }
}

function isNativeComposerVisible(capability: ComposerCapability | null): boolean {
  return (
    capability?.state === 'draft' || capability?.state === 'open' || capability?.state === 'saving'
  );
}

function getComposerReturnFocus(activeElement: HTMLElement | null): HTMLElement | null {
  const reply = activeElement?.closest<HTMLElement>('.docode-topic-code__reply');
  if (reply) return reply;
  if (
    activeElement &&
    activeElement !== activeElement.ownerDocument.body &&
    activeElement.closest('[role="dialog"], [role="menu"], .docode-native-composer') === null
  ) {
    return activeElement;
  }
  return null;
}

function getReadyTopicList(
  surfaceState: WorkbenchSurfaceState,
  document: TopicListDocument | null,
): ReadyTopicListDocument | null {
  return surfaceState.kind === 'ready' && document?.state === 'ready'
    ? (document as ReadyTopicListDocument)
    : null;
}

function getReadyTopicDetail(
  surfaceState: WorkbenchSurfaceState,
  document: TopicDetailDocument | null,
): ReadyTopicDetailDocument | null {
  return surfaceState.kind === 'ready' && document?.state === 'ready' ? document : null;
}

function getPreferredPanelHeight(viewportHeight: number): number {
  return clampPanelHeight(Math.round(viewportHeight * PANEL_PREFERRED_RATIO), viewportHeight);
}

function getSystemTheme(): 'dark' | 'light' {
  return getColorSchemeMedia()?.matches === false ? 'light' : 'dark';
}

function getColorSchemeMedia(): MediaQueryList | null {
  const matchMedia = (
    window as unknown as {
      matchMedia?: (query: string) => MediaQueryList;
    }
  ).matchMedia;
  return matchMedia?.call(window, '(prefers-color-scheme: dark)') ?? null;
}

function clampPanelHeight(height: number, viewportHeight: number): number {
  return clamp(height, PANEL_MINIMUM_HEIGHT, getPanelMaximum(viewportHeight));
}

function getPanelMaximum(viewportHeight: number): number {
  return Math.max(
    PANEL_MINIMUM_HEIGHT,
    viewportHeight - TITLE_BAR_HEIGHT - STATUS_BAR_HEIGHT - SASH_SIZE - EDITOR_MINIMUM_HEIGHT,
  );
}

function clampSidebarWidth(width: number, viewportWidth: number): number {
  return Math.round(clamp(width, MINIMUM_SIDEBAR_WIDTH, getSidebarMaximum(viewportWidth)));
}

function getSidebarMaximum(viewportWidth: number): number {
  const reservedWidth =
    viewportWidth <= SIDEBAR_OVERLAY_BREAKPOINT
      ? ACTIVITY_BAR_WIDTH
      : ACTIVITY_BAR_WIDTH + EDITOR_MINIMUM_WIDTH;
  return Math.max(MINIMUM_SIDEBAR_WIDTH, viewportWidth - reservedWidth);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function equalTopicViewport(left: TopicViewportRecord, right: TopicViewportRecord): boolean {
  return (
    left.topicId === right.topicId &&
    left.clientHeight === right.clientHeight &&
    left.currentPostId === right.currentPostId &&
    left.scrollHeight === right.scrollHeight &&
    left.scrollTop === right.scrollTop
  );
}
