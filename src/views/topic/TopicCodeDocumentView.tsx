import {
  Fragment,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';

import type { NativeContentTransfer } from '../../runtime/nativeContentTransfer';
import type { TopicPostAuthor, TopicPostBoost } from '../../linuxdo/topicAdapter';
import type { LinuxDoBoostApiOutcome } from '../../linuxdo/boostApiClient';
import { loadLinuxDoUserCard, type LinuxDoUserCard } from '../../linuxdo/userCardAdapter';
import { Codicon } from '../../ui/icons/codicon';
import type { TopicReadingMode } from '../../ui/workbench/workbenchMode';
import {
  PostActionStrip,
  TopicLoadingBoundary,
  type ResolveTopicPostCommand,
  type RunTopicPostCommand,
  type TopicPostMenuRequest,
} from './TopicPostAffordances';
import type { TopicDetailDocument, TopicReplyDocumentBlock } from './topicDetailDocument';
import {
  presentNativeContent,
  summarizeNativeContentLines,
  type ReplyCodeStructureOptions,
} from './nativeContentPresentation';
import { createReplyCodePlan } from './replyCodePlan';
import { createReplyMethodName } from './topicJavaSource';
import { createShareCardModel, type ShareCardModel } from './shareCard';
import { ShareCardDialog } from './ShareCardDialog';
import {
  createDocReplyHeadingLabel,
  createFallbackDocReplyLineLayout,
  createTopicDocLineLayout,
  TOPIC_DOC_HEADER_LINES,
  TOPIC_DOC_REPLIES_SECTION_LABEL,
  type TopicDocReplyLineLayout,
} from './topicDocLineLayout';
import {
  createFallbackReplyLineLayout,
  createTopicLineLayout,
  TOPIC_HEADER_LINES,
  type TopicReplyLineLayout,
} from './topicLineLayout';
import {
  createTopicViewportState,
  findViewportPostId,
  getScrollTopForProgress,
  type TopicScrollRequest,
  type TopicViewportState,
} from './topicViewport';

export type ReadyTopicDetailDocument = TopicDetailDocument & { readonly state: 'ready' };
export type { TopicReadingMode } from '../../ui/workbench/workbenchMode';

interface ActiveReplySelection {
  readonly id: number | null;
  readonly topicId: number;
  readonly userDriven: boolean;
}

interface CollapsedReplySelection {
  readonly ids: ReadonlySet<number>;
  readonly topicId: number;
}

interface ViewportReplyAnchor {
  readonly offsetTop: number;
  readonly postId: number;
  readonly scrollTop: number;
  readonly topicId: number;
}

interface PaginationViewportCheckpoint {
  readonly anchor: ViewportReplyAnchor | null;
  readonly direction: 'next' | 'previous';
  readonly distanceFromEnd: number;
  readonly interactionRevision: number;
  readonly replyCount: number;
  readonly scrollTop: number;
  readonly topicId: number;
}

export interface TopicReplyFocusRequest {
  readonly postId: number;
  readonly sequence: number;
}

export interface TopicCursorPosition {
  readonly column: number;
  readonly lineNumber: number;
  readonly postId: number;
}

export type SendTopicBoost = (
  postId: number,
  raw: string,
  signal: AbortSignal,
) => Promise<LinuxDoBoostApiOutcome>;

const EMPTY_LOCAL_BOOSTS: readonly TopicPostBoost[] = [];

interface TopicCodeEditorSurfaceProps {
  readonly currentUserAvatarUrl?: string | null;
  readonly currentUsername?: string | null;
  readonly document: ReadyTopicDetailDocument;
  readonly earlierPaginationStatus?: 'complete' | 'error' | 'idle' | 'loading';
  readonly focusRequest?: TopicReplyFocusRequest | null;
  readonly hasEarlierPosts?: boolean;
  readonly hasMorePosts?: boolean;
  readonly loadingEarlierPosts?: boolean;
  readonly loadingMorePosts?: boolean;
  readonly paginationStatus?: 'complete' | 'error' | 'idle' | 'loading';
  readonly mode?: TopicReadingMode;
  readonly nativeContentTransfer: NativeContentTransfer;
  readonly onActiveReplyChange?: (postId: number | null) => void;
  readonly onCursorChange?: (position: TopicCursorPosition) => void;
  readonly onRequestEarlierPosts?: () => void;
  readonly onRequestMorePosts?: () => void;
  readonly onResolvePostCommand?: ResolveTopicPostCommand | undefined;
  readonly onRunPostCommand?: RunTopicPostCommand | undefined;
  readonly onSendBoost?: SendTopicBoost | undefined;
  readonly onViewportChange?: (viewport: TopicViewportState) => void;
  readonly revision: number;
  readonly scrollRequest?: TopicScrollRequest | null;
  readonly showAuthorAvatars?: boolean;
}

export const TopicCodeEditorSurface = memo(function TopicCodeEditorSurface({
  currentUserAvatarUrl = null,
  currentUsername = null,
  document,
  earlierPaginationStatus = 'idle',
  focusRequest = null,
  hasEarlierPosts = false,
  hasMorePosts,
  loadingEarlierPosts = false,
  loadingMorePosts = false,
  paginationStatus = 'idle',
  mode: controlledMode,
  nativeContentTransfer,
  onActiveReplyChange,
  onCursorChange,
  onRequestEarlierPosts,
  onRequestMorePosts,
  onResolvePostCommand,
  onRunPostCommand,
  onSendBoost,
  onViewportChange,
  revision,
  scrollRequest = null,
  showAuthorAvatars = true,
}: TopicCodeEditorSurfaceProps) {
  const resolvedHasMorePosts = hasMorePosts ?? document.loadedWindow.hasMorePosts;
  const [shareCard, setShareCard] = useState<{
    readonly model: ShareCardModel;
    readonly postNumber: number;
  } | null>(null);
  const [collapsedReplies, setCollapsedReplies] = useState<CollapsedReplySelection>(() => ({
    ids: new Set(),
    topicId: document.topic.id,
  }));
  const mode = controlledMode ?? 'code';
  const collapsedReplyIds =
    collapsedReplies.topicId === document.topic.id ? collapsedReplies.ids : new Set<number>();
  const [activeReply, setActiveReply] = useState<ActiveReplySelection>(() => ({
    id: preferredReplyId(document),
    topicId: document.topic.id,
    userDriven: false,
  }));
  const [paginationSelectionLocked, setPaginationSelectionLocked] = useState(false);
  const appliedFocusRequestSequence = useRef<number | null>(null);
  const appliedScrollRequestSequence = useRef<number | null>(null);
  const paginationRequestPending = useRef(false);
  const paginationViewportCheckpoint = useRef<PaginationViewportCheckpoint | null>(null);
  const previousPaginationLoading = useRef({
    next: loadingMorePosts,
    previous: loadingEarlierPosts,
  });
  const replyElements = useRef(new Map<number, HTMLElement>());
  const viewportActiveTrackingLock = useRef(0);
  const selectionRouteHref = useRef(document.route.href);
  const surface = useRef<HTMLElement>(null);
  const viewportInteractionRevision = useRef(0);
  const viewportReplyAnchor = useRef<ViewportReplyAnchor | null>(null);
  const positionedRouteHref = useRef<string | null>(null);
  const preferredActiveReplyId = preferredReplyId(document);
  const openShareCard = useCallback(
    (reply: TopicReplyDocumentBlock, layout: TopicReplyLineLayout) => {
      setShareCard({
        model: createShareCardModel({
          annotated: layout.annotation !== null,
          reply,
          startLine: layout.annotation ?? layout.signature,
        }),
        postNumber: reply.floor.number,
      });
    },
    [],
  );
  const closeShareCard = useCallback(() => {
    setShareCard(null);
  }, []);
  const requestedReplyId = document.replies.find(({ floor }) => floor.requested)?.id ?? null;
  const activeReplyStillLoaded = document.replies.some(({ id }) => id === activeReply.id);
  const paginationTransitionActive =
    loadingEarlierPosts || loadingMorePosts || paginationSelectionLocked;
  const resolvedActiveReplyId =
    activeReply.topicId === document.topic.id &&
    (activeReply.userDriven || paginationTransitionActive) &&
    activeReplyStillLoaded
      ? activeReply.id
      : preferredActiveReplyId;
  const [boostEditor, setBoostEditor] = useState<{
    readonly postId: number;
    readonly topicId: number;
  } | null>(null);
  const [sentBoosts, setSentBoosts] = useState<{
    readonly byPost: ReadonlyMap<number, readonly TopicPostBoost[]>;
    readonly topicId: number;
  }>(() => ({ byPost: new Map(), topicId: document.topic.id }));
  const activeBoostEditorPostId =
    boostEditor?.topicId === document.topic.id ? boostEditor.postId : null;
  const sentBoostsByPost = useMemo(
    () =>
      sentBoosts.topicId === document.topic.id
        ? sentBoosts.byPost
        : new Map<number, readonly TopicPostBoost[]>(),
    [document.topic.id, sentBoosts],
  );
  const openBoostEditor = useCallback(
    (postId: number) => {
      setBoostEditor({ postId, topicId: document.topic.id });
    },
    [document.topic.id],
  );
  const closeBoostEditor = useCallback(() => {
    setBoostEditor(null);
  }, []);
  const recordSentBoost = useCallback(
    (postId: number, boost: TopicPostBoost) => {
      setSentBoosts((current) => {
        const base =
          current.topicId === document.topic.id
            ? current.byPost
            : new Map<number, readonly TopicPostBoost[]>();
        const next = new Map(base);
        next.set(postId, [...(next.get(postId) ?? []), boost]);
        return { byPost: next, topicId: document.topic.id };
      });
    },
    [document.topic.id],
  );
  const forcedBoostPostIds = useMemo(() => {
    const ids = new Set<number>(sentBoostsByPost.keys());
    if (activeBoostEditorPostId !== null) ids.add(activeBoostEditorPostId);
    return ids;
  }, [activeBoostEditorPostId, sentBoostsByPost]);
  const [expandedContentPosts, setExpandedContentPosts] = useState<CollapsedReplySelection>(() => ({
    ids: new Set<number>(),
    topicId: document.topic.id,
  }));
  const expandedContentPostIds = useMemo(
    () =>
      expandedContentPosts.topicId === document.topic.id
        ? expandedContentPosts.ids
        : new Set<number>(),
    [document.topic.id, expandedContentPosts],
  );
  const toggleContentFold = useCallback(
    (replyId: number) => {
      setExpandedContentPosts((current) => {
        const next = new Set(
          current.topicId === document.topic.id ? current.ids : new Set<number>(),
        );
        if (next.has(replyId)) next.delete(replyId);
        else next.add(replyId);
        return { ids: next, topicId: document.topic.id };
      });
    },
    [document.topic.id],
  );
  const lineLayout = useMemo(
    () => createTopicLineLayout(document, { expandedContentPostIds, forcedBoostPostIds }),
    [document, expandedContentPostIds, forcedBoostPostIds],
  );
  const docLineLayout = useMemo(() => createTopicDocLineLayout(document), [document]);
  const repliesByFloor = useMemo(
    () => new Map(document.replies.map((reply) => [reply.floor.number, reply])),
    [document.replies],
  );
  const publishViewport = useCallback(
    (trackActiveReply = true, allowPaginationRequest = true) => {
      const element = surface.current;
      if (!element) return;
      const checkpoint = paginationViewportCheckpoint.current;
      const preservePaginationViewport =
        checkpoint?.topicId === document.topic.id &&
        checkpoint.interactionRevision === viewportInteractionRevision.current;
      const viewportPostId = findViewportPostId(
        element,
        document.replies,
        replyElements.current,
        resolvedActiveReplyId,
      );
      const viewportReply =
        viewportPostId === null ? null : replyElements.current.get(viewportPostId);
      if (!preservePaginationViewport && viewportPostId !== null && viewportReply) {
        const surfaceRect = element.getBoundingClientRect();
        const replyRect = viewportReply.getBoundingClientRect();
        if (surfaceRect.height > 0 && replyRect.height > 0) {
          viewportReplyAnchor.current = {
            offsetTop: replyRect.top - surfaceRect.top,
            postId: viewportPostId,
            scrollTop: element.scrollTop,
            topicId: document.topic.id,
          };
        }
      }
      const shouldTrackActiveReply =
        trackActiveReply && !preservePaginationViewport && viewportActiveTrackingLock.current === 0;
      const currentPostId = shouldTrackActiveReply ? viewportPostId : resolvedActiveReplyId;
      if (shouldTrackActiveReply && currentPostId !== null) {
        setActiveReply((current) =>
          current.id === currentPostId && current.topicId === document.topic.id
            ? current
            : { id: currentPostId, topicId: document.topic.id, userDriven: true },
        );
      }
      onViewportChange?.(
        createTopicViewportState(
          {
            clientHeight: element.clientHeight,
            scrollHeight: element.scrollHeight,
            scrollTop: preservePaginationViewport ? checkpoint.scrollTop : element.scrollTop,
          },
          currentPostId,
        ),
      );
      const paginationDirection =
        allowPaginationRequest &&
        hasEarlierPosts &&
        earlierPaginationStatus === 'idle' &&
        !loadingEarlierPosts &&
        !paginationRequestPending.current &&
        onRequestEarlierPosts &&
        isNearTopicStart(element)
          ? 'previous'
          : allowPaginationRequest &&
              resolvedHasMorePosts &&
              paginationStatus === 'idle' &&
              !loadingMorePosts &&
              !paginationRequestPending.current &&
              onRequestMorePosts &&
              isNearTopicEnd(element)
            ? 'next'
            : null;
      if (paginationDirection) {
        paginationViewportCheckpoint.current = {
          anchor:
            viewportReplyAnchor.current?.topicId === document.topic.id
              ? viewportReplyAnchor.current
              : null,
          direction: paginationDirection,
          distanceFromEnd: Math.max(
            0,
            element.scrollHeight - element.clientHeight - element.scrollTop,
          ),
          interactionRevision: viewportInteractionRevision.current,
          replyCount: document.replies.length,
          scrollTop: element.scrollTop,
          topicId: document.topic.id,
        };
        paginationRequestPending.current = true;
        setActiveReply((current) =>
          current.topicId === document.topic.id && current.userDriven
            ? current
            : {
                id: current.topicId === document.topic.id ? current.id : resolvedActiveReplyId,
                topicId: document.topic.id,
                userDriven: true,
              },
        );
        setPaginationSelectionLocked(true);
        if (paginationDirection === 'previous') onRequestEarlierPosts?.();
        else onRequestMorePosts?.();
      }
    },
    [
      document.replies,
      document.topic.id,
      earlierPaginationStatus,
      hasEarlierPosts,
      resolvedHasMorePosts,
      loadingEarlierPosts,
      loadingMorePosts,
      onRequestEarlierPosts,
      onRequestMorePosts,
      onViewportChange,
      paginationStatus,
      resolvedActiveReplyId,
    ],
  );
  const publishViewportRef = useRef(publishViewport);
  const lockViewportActiveTracking = useCallback(() => {
    const lock = viewportActiveTrackingLock.current + 1;
    viewportActiveTrackingLock.current = lock;
    requestFrame(() => {
      requestFrame(() => {
        if (viewportActiveTrackingLock.current !== lock) return;
        viewportActiveTrackingLock.current = 0;
        publishViewportRef.current(false, false);
      });
    });
  }, []);
  const registerReplyElement = useCallback((replyId: number, element: HTMLElement | null) => {
    if (element) replyElements.current.set(replyId, element);
    else replyElements.current.delete(replyId);
  }, []);
  const focusActiveReply = useCallback(
    (replyId: number) => {
      setActiveReply((current) =>
        current.id === replyId && current.topicId === document.topic.id && current.userDriven
          ? current
          : { id: replyId, topicId: document.topic.id, userDriven: true },
      );
    },
    [document.topic.id],
  );
  const publishCursorLine = useCallback(
    (
      replyId: number,
      target: EventTarget | null,
      fallbackLine: number,
      pointerClientY?: number,
    ) => {
      const root = surface.current;
      const replyElement = replyElements.current.get(replyId);
      if (!root || !replyElement) return;
      root.querySelectorAll('.docode-topic-code__active-line').forEach((element) => {
        element.classList.remove('docode-topic-code__active-line');
      });
      root.querySelectorAll('.docode-topic-code__line-number--active').forEach((element) => {
        element.classList.remove('docode-topic-code__line-number--active');
      });
      root
        .querySelectorAll<HTMLElement>('.docode-topic-code__active-line-overlay')
        .forEach((element) => {
          element.hidden = true;
        });
      const targetElement = target instanceof Element ? target : null;
      const candidate = targetElement?.closest<HTMLElement>('[data-docode-editor-line]');
      const lineElement =
        candidate && replyElement.contains(candidate)
          ? candidate
          : replyElement.querySelector<HTMLElement>(
              `[data-docode-editor-line="${String(fallbackLine)}"]`,
            );
      const firstLine = Number(lineElement?.dataset.docodeEditorLine ?? fallbackLine);
      const lineCount = Math.max(1, Number(lineElement?.dataset.docodeEditorLineCount ?? 1));
      const lineOffset =
        lineElement && pointerClientY !== undefined && lineCount > 1
          ? getNativeLineOffset(lineElement, pointerClientY, lineCount)
          : 0;
      const lineNumber = firstLine + lineOffset;
      lineElement?.classList.add('docode-topic-code__active-line');
      const activeNumber = replyElement.querySelector<HTMLElement>(
        `[data-docode-line-number="${String(lineNumber)}"]`,
      );
      activeNumber?.classList.add('docode-topic-code__line-number--active');
      const contentHost = lineElement?.closest<HTMLElement>('.docode-topic-code__content-slot');
      const activeLineOverlay = contentHost?.querySelector<HTMLElement>(
        ':scope > .docode-topic-code__active-line-overlay',
      );
      if (activeLineOverlay && activeNumber) {
        activeLineOverlay.style.transform = activeNumber.style.transform;
        activeLineOverlay.hidden = false;
      }
      onCursorChange?.({ column: 1, lineNumber, postId: replyId });
    },
    [onCursorChange],
  );
  const clearCursorLine = useCallback(() => {
    const root = surface.current;
    root?.querySelectorAll('.docode-topic-code__active-line').forEach((element) => {
      element.classList.remove('docode-topic-code__active-line');
    });
    root?.querySelectorAll('.docode-topic-code__line-number--active').forEach((element) => {
      element.classList.remove('docode-topic-code__line-number--active');
    });
    root
      ?.querySelectorAll<HTMLElement>('.docode-topic-code__active-line-overlay')
      .forEach((element) => {
        element.hidden = true;
      });
  }, []);
  const toggleReplyCollapsed = useCallback(
    (replyId: number) => {
      setCollapsedReplies((current) => {
        const next = new Set(
          current.topicId === document.topic.id ? current.ids : new Set<number>(),
        );
        if (next.has(replyId)) next.delete(replyId);
        else next.add(replyId);
        return { ids: next, topicId: document.topic.id };
      });
    },
    [document.topic.id],
  );

  useLayoutEffect(() => {
    publishViewportRef.current = publishViewport;
  }, [publishViewport]);

  useLayoutEffect(() => {
    if (selectionRouteHref.current === document.route.href) return;
    selectionRouteHref.current = document.route.href;
    const replacesEarlierPaginationAnchor =
      paginationRequestPending.current &&
      paginationViewportCheckpoint.current?.topicId === document.topic.id &&
      paginationViewportCheckpoint.current.direction === 'previous';
    if (replacesEarlierPaginationAnchor) {
      viewportInteractionRevision.current += 1;
      paginationRequestPending.current = false;
      paginationViewportCheckpoint.current = null;
      setPaginationSelectionLocked(false);
    } else if (
      paginationTransitionActive ||
      (paginationRequestPending.current &&
        paginationViewportCheckpoint.current?.topicId === document.topic.id)
    ) {
      return;
    }
    setActiveReply({ id: preferredActiveReplyId, topicId: document.topic.id, userDriven: false });
  }, [document.route.href, document.topic.id, paginationTransitionActive, preferredActiveReplyId]);

  useLayoutEffect(() => {
    const checkpointDirection = paginationViewportCheckpoint.current?.direction ?? null;
    const directionLoading =
      checkpointDirection === 'previous' ? loadingEarlierPosts : loadingMorePosts;
    const previousDirectionLoading =
      checkpointDirection === null ? false : previousPaginationLoading.current[checkpointDirection];
    const directionStatus =
      checkpointDirection === 'previous' ? earlierPaginationStatus : paginationStatus;
    const directionHasMore =
      checkpointDirection === 'previous' ? hasEarlierPosts : resolvedHasMorePosts;
    const completedPagination =
      (previousDirectionLoading && !directionLoading) ||
      (paginationRequestPending.current &&
        paginationSelectionLocked &&
        (directionStatus === 'complete' || directionStatus === 'error'));
    if (!directionHasMore || completedPagination) paginationRequestPending.current = false;
    previousPaginationLoading.current = {
      next: loadingMorePosts,
      previous: loadingEarlierPosts,
    };
    if (!completedPagination) return;

    const element = surface.current;
    const checkpoint = paginationViewportCheckpoint.current;
    if (
      element &&
      checkpoint?.topicId === document.topic.id &&
      checkpoint.interactionRevision === viewportInteractionRevision.current
    ) {
      positionedRouteHref.current = document.route.href;
      if (document.replies.length === checkpoint.replyCount) {
        const maximumScrollTop = Math.max(0, element.scrollHeight - element.clientHeight);
        element.scrollTop =
          checkpoint.direction === 'previous'
            ? Math.min(checkpoint.scrollTop, maximumScrollTop)
            : Math.max(0, maximumScrollTop - checkpoint.distanceFromEnd);
      } else {
        const reply = checkpoint.anchor
          ? replyElements.current.get(checkpoint.anchor.postId)
          : undefined;
        if (reply && checkpoint.anchor) {
          const offsetTop = reply.getBoundingClientRect().top - element.getBoundingClientRect().top;
          element.scrollTop += offsetTop - checkpoint.anchor.offsetTop;
        } else {
          element.scrollTop = checkpoint.scrollTop;
        }
      }
    }
    paginationViewportCheckpoint.current = null;
    setPaginationSelectionLocked(false);
    publishViewportRef.current(false, false);
  }, [
    earlierPaginationStatus,
    document.replies.length,
    document.route.href,
    document.topic.id,
    hasEarlierPosts,
    resolvedHasMorePosts,
    loadingEarlierPosts,
    loadingMorePosts,
    paginationSelectionLocked,
    paginationStatus,
    revision,
  ]);

  useLayoutEffect(() => {
    const element = surface.current;
    const anchor = viewportReplyAnchor.current;
    if (
      element &&
      anchor?.topicId === document.topic.id &&
      Math.abs(element.scrollTop - anchor.scrollTop) < 0.5
    ) {
      const reply = replyElements.current.get(anchor.postId);
      if (reply) {
        const offsetTop = reply.getBoundingClientRect().top - element.getBoundingClientRect().top;
        const offsetChange = offsetTop - anchor.offsetTop;
        if (Math.abs(offsetChange) >= 0.5) element.scrollTop += offsetChange;
      }
    }
    publishViewportRef.current(false);
  }, [document.topic.id, revision]);

  useLayoutEffect(() => {
    publishViewportRef.current(false);
  }, [mode]);

  useLayoutEffect(() => {
    if (positionedRouteHref.current === document.route.href) return;
    if (requestedReplyId === null) return;
    const routeHref = document.route.href;
    let frame: number | null = null;
    let attempts = 0;
    const positionRequestedReply = () => {
      frame = null;
      const scrollSurface = surface.current;
      const element = replyElements.current.get(requestedReplyId);
      if (positionedRouteHref.current === routeHref) {
        return;
      }
      if (
        scrollSurface &&
        element?.isConnected &&
        scrollElementIntoSurface(scrollSurface, element, 'center')
      ) {
        positionedRouteHref.current = routeHref;
        publishViewportRef.current();
        return;
      }
      attempts += 1;
      if (attempts < 4) frame = requestFrame(positionRequestedReply);
    };
    frame = requestFrame(positionRequestedReply);
    return () => {
      if (frame !== null) cancelFrame(frame);
    };
  }, [document.route.href, document.topic.id, requestedReplyId]);

  useLayoutEffect(() => {
    if (!focusRequest || appliedFocusRequestSequence.current === focusRequest.sequence) return;
    const target = document.replies.find(({ id }) => id === focusRequest.postId);
    const routePostNumber = document.route.postNumber ?? 1;
    if (target && target.floor.number !== routePostNumber) return;
    const element = target ? replyElements.current.get(target.id) : undefined;
    if (!target || !element) return;
    appliedFocusRequestSequence.current = focusRequest.sequence;
    lockViewportActiveTracking();
    setActiveReply({ id: target.id, topicId: document.topic.id, userDriven: true });
    if (surface.current) scrollElementIntoSurface(surface.current, element, 'nearest');
    element.focus({ preventScroll: true });
  }, [
    document.replies,
    document.route.href,
    document.route.postNumber,
    document.topic.id,
    focusRequest,
    lockViewportActiveTracking,
  ]);

  useLayoutEffect(() => {
    const element = surface.current;
    if (
      !scrollRequest ||
      !element ||
      appliedScrollRequestSequence.current === scrollRequest.sequence
    ) {
      return;
    }
    appliedScrollRequestSequence.current = scrollRequest.sequence;
    element.scrollTop =
      scrollRequest.scrollTop ??
      getScrollTopForProgress(scrollRequest.progress, element.scrollHeight, element.clientHeight);
    publishViewport();
  }, [publishViewport, scrollRequest]);

  useEffect(() => {
    const element = surface.current;
    if (!element) return;
    let frame: number | null = null;
    let trackActiveReply = false;
    const publishInFrame = (trackActive: boolean) => {
      trackActiveReply ||= trackActive;
      if (frame !== null) return;
      frame = requestFrame(() => {
        frame = null;
        const shouldTrackActiveReply = trackActiveReply;
        trackActiveReply = false;
        publishViewport(shouldTrackActiveReply);
      });
    };
    const onScroll = () => {
      publishInFrame(true);
    };
    const resizeObserver = createResizeObserver(() => {
      publishInFrame(false);
    });
    element.addEventListener('scroll', onScroll, { passive: true });
    resizeObserver?.observe(element);
    return () => {
      element.removeEventListener('scroll', onScroll);
      resizeObserver?.disconnect();
      if (frame !== null) cancelFrame(frame);
    };
  }, [publishViewport]);

  useEffect(() => {
    const element = surface.current;
    if (!element) return;
    const recordInteraction = () => {
      viewportInteractionRevision.current += 1;
      paginationViewportCheckpoint.current = null;
      setPaginationSelectionLocked(false);
    };
    const recordKeyboardInteraction = (event: KeyboardEvent) => {
      if (!isViewportNavigationKey(event.key)) return;
      recordInteraction();
    };
    element.addEventListener('keydown', recordKeyboardInteraction);
    element.addEventListener('pointerdown', recordInteraction, { passive: true });
    element.addEventListener('touchstart', recordInteraction, { passive: true });
    element.addEventListener('wheel', recordInteraction, { passive: true });
    return () => {
      element.removeEventListener('keydown', recordKeyboardInteraction);
      element.removeEventListener('pointerdown', recordInteraction);
      element.removeEventListener('touchstart', recordInteraction);
      element.removeEventListener('wheel', recordInteraction);
    };
  }, []);

  useEffect(() => {
    onActiveReplyChange?.(resolvedActiveReplyId);
  }, [onActiveReplyChange, resolvedActiveReplyId]);

  useEffect(() => {
    paginationRequestPending.current = false;
    paginationViewportCheckpoint.current = null;
  }, [document.topic.id]);

  useEffect(() => {
    clearCursorLine();
  }, [clearCursorLine, document.route.href]);

  useEffect(
    () => () => {
      clearCursorLine();
    },
    [clearCursorLine],
  );

  const focusReply = useCallback(
    (replyId: number, position: 'end' | 'next' | 'previous' | 'start') => {
      const currentIndex = document.replies.findIndex(({ id }) => id === replyId);
      if (currentIndex < 0) return;
      const targetIndex =
        position === 'start'
          ? 0
          : position === 'end'
            ? document.replies.length - 1
            : position === 'next'
              ? Math.min(currentIndex + 1, document.replies.length - 1)
              : Math.max(currentIndex - 1, 0);
      const target = document.replies[targetIndex];
      if (!target) return;
      const element = replyElements.current.get(target.id);
      lockViewportActiveTracking();
      if (element && surface.current) {
        scrollElementIntoSurface(surface.current, element, 'nearest');
        element.focus({ preventScroll: true });
      }
      setActiveReply({ id: target.id, topicId: document.topic.id, userDriven: true });
    },
    [document.replies, document.topic.id, lockViewportActiveTracking],
  );

  return (
    <section
      aria-label={mode === 'code' ? 'Topic code document' : 'Topic document'}
      className="docode-topic-code__surface"
      data-mode={mode}
      data-post-count={document.replies.length}
      id="docode-workbench-editor-content"
      ref={surface}
      role="document"
    >
      <TopicHeader document={document} mode={mode} />
      <TopicLoadingBoundary
        document={document}
        hasMore={hasEarlierPosts}
        loading={loadingEarlierPosts}
        position="start"
        status={earlierPaginationStatus}
      />
      <div className="docode-topic-code__replies">
        {document.replies.map((reply) => (
          <Fragment key={`${String(reply.id)}:${String(reply.floor.number)}`}>
            <TopicReply
              active={reply.id === resolvedActiveReplyId}
              boostEditorOpen={reply.id === activeBoostEditorPostId}
              collapsed={collapsedReplyIds.has(reply.id)}
              contentExpanded={expandedContentPostIds.has(reply.id)}
              onToggleContentFold={toggleContentFold}
              currentUserAvatarUrl={currentUserAvatarUrl}
              currentUsername={currentUsername}
              localBoosts={sentBoostsByPost.get(reply.id) ?? EMPTY_LOCAL_BOOSTS}
              onBoostSent={recordSentBoost}
              onCloseBoostEditor={closeBoostEditor}
              onOpenBoostEditor={openBoostEditor}
              docLineLayout={
                docLineLayout.replies.get(reply.id) ?? createFallbackDocReplyLineLayout(reply)
              }
              lineLayout={lineLayout.replies.get(reply.id) ?? createFallbackReplyLineLayout(reply)}
              mode={mode}
              nativeContentTransfer={nativeContentTransfer}
              onFocus={focusActiveReply}
              onCursorLine={publishCursorLine}
              onMoveFocus={focusReply}
              onResolvePostCommand={onResolvePostCommand}
              onRunPostCommand={onRunPostCommand}
              onSendBoost={onSendBoost}
              onOpenShareCard={openShareCard}
              onToggleCollapsed={toggleReplyCollapsed}
              registerElement={registerReplyElement}
              reply={reply}
              replyTarget={
                reply.replyToPostNumber === null
                  ? null
                  : (repliesByFloor.get(reply.replyToPostNumber) ?? null)
              }
              revision={revision}
              showAuthorAvatar={showAuthorAvatars}
            />
            {mode === 'code' ? (
              <div
                aria-hidden="true"
                className="docode-topic-code__method-gap"
                data-docode-editor-line={
                  (lineLayout.replies.get(reply.id) ?? createFallbackReplyLineLayout(reply)).close +
                  1
                }
              />
            ) : null}
          </Fragment>
        ))}
      </div>
      <TopicLoadingBoundary
        document={document}
        hasMore={resolvedHasMorePosts}
        loading={loadingMorePosts}
        position="end"
        status={paginationStatus}
      />
      {mode === 'code' ? (
        <div
          aria-hidden="true"
          className="docode-topic-code__topic-close"
          data-docode-editor-line={lineLayout.topicClose}
        >
          <span />
          <code>{'}'}</code>
        </div>
      ) : null}
      {shareCard ? (
        <ShareCardDialog
          model={shareCard.model}
          onClose={closeShareCard}
          postNumber={shareCard.postNumber}
        />
      ) : null}
    </section>
  );
});

function TopicHeader({
  document,
  mode,
}: {
  readonly document: ReadyTopicDetailDocument;
  readonly mode: TopicReadingMode;
}) {
  const { topic } = document;
  return (
    <header className="docode-topic-code__topic-header">
      <span aria-hidden="true" className="docode-workbench__gutter docode-topic-code__topic-gutter">
        1
      </span>
      <div className="docode-topic-code__topic-heading">
        {mode === 'code' ? (
          <>
            <div aria-hidden="true" className="docode-topic-code__editor-line">
              <span className="docode-topic-code__declaration">import</span>
              <span className="docode-topic-code__punctuation docode-topic-code__import-path">
                {' LinuxDo.'}
              </span>
              <span className="docode-topic-code__keyword">Topic</span>
              <span className="docode-topic-code__punctuation">;</span>
            </div>
            <div
              aria-hidden="true"
              className="docode-topic-code__editor-line"
              data-docode-editor-line={TOPIC_HEADER_LINES.mottoImportLine}
            >
              <span className="docode-topic-code__declaration">import</span>
              <span className="docode-topic-code__punctuation docode-topic-code__import-path">
                {' Sincere.friendly.united.'}
              </span>
              <span className="docode-topic-code__keyword">professional</span>
              <span className="docode-topic-code__punctuation">;</span>
            </div>
            <div
              aria-hidden="true"
              className="docode-topic-code__editor-line"
              data-docode-editor-line="3"
            />
          </>
        ) : null}
        <div className="docode-topic-code__heading-row">
          {mode === 'code' ? (
            <h1
              className="docode-topic-code__signature docode-topic-code__editor-line"
              data-docode-editor-line={TOPIC_HEADER_LINES.classOpen}
            >
              <span className="docode-topic-code__declaration">public class </span>
              <a className="docode-topic-code__title" href={topic.url}>
                {topic.title}
              </a>{' '}
              <span className="docode-topic-code__punctuation">{'{'}</span>
            </h1>
          ) : (
            <h1
              className="docode-topic-code__signature docode-topic-code__editor-line docode-topic-code__md-heading"
              data-docode-editor-line={TOPIC_DOC_HEADER_LINES.title}
            >
              <span aria-hidden="true" className="docode-topic-code__md-marker">
                {'# '}
              </span>
              <a className="docode-topic-code__title" href={topic.url}>
                {topic.title}
              </a>
            </h1>
          )}
        </div>
        <div
          className="docode-topic-code__metadata docode-topic-code__topic-metadata"
          data-docode-editor-line={
            mode === 'code' ? TOPIC_HEADER_LINES.metadata : TOPIC_DOC_HEADER_LINES.metadata
          }
        >
          {mode === 'code' ? (
            <span aria-hidden="true" className="docode-topic-code__comment-marker">
              {'//'}
            </span>
          ) : (
            <span aria-hidden="true" className="docode-topic-code__md-quote-marker">
              {'> '}
            </span>
          )}
          {topic.category ? (
            <a href={topic.category.url}>{topic.category.name}</a>
          ) : (
            <span>category unavailable</span>
          )}
          {topic.tags.map((tag) => (
            <a href={tag.url} key={tag.slug}>
              #{tag.name}
            </a>
          ))}
          <span>{loadedWindowLabel(document)}</span>
          {topic.pinned ? <span>pinned</span> : null}
          {topic.closed ? <span>closed</span> : null}
        </div>
        {mode === 'doc' ? (
          <div
            aria-hidden="true"
            className="docode-topic-code__editor-line"
            data-docode-editor-line={TOPIC_DOC_HEADER_LINES.blank}
          />
        ) : null}
      </div>
    </header>
  );
}

interface TopicReplyProps {
  readonly active: boolean;
  readonly collapsed: boolean;
  readonly docLineLayout: TopicDocReplyLineLayout;
  readonly mode: TopicReadingMode;
  readonly nativeContentTransfer: NativeContentTransfer;
  readonly lineLayout: TopicReplyLineLayout;
  readonly onFocus: (replyId: number) => void;
  readonly onCursorLine: (
    replyId: number,
    target: EventTarget | null,
    fallbackLine: number,
    pointerClientY?: number,
  ) => void;
  readonly boostEditorOpen: boolean;
  readonly currentUserAvatarUrl: string | null;
  readonly currentUsername: string | null;
  readonly localBoosts: readonly TopicPostBoost[];
  readonly onBoostSent: (postId: number, boost: TopicPostBoost) => void;
  readonly contentExpanded: boolean;
  readonly onCloseBoostEditor: () => void;
  readonly onOpenBoostEditor?: ((postId: number) => void) | undefined;
  readonly onMoveFocus: (replyId: number, position: 'end' | 'next' | 'previous' | 'start') => void;
  readonly onToggleContentFold: (replyId: number) => void;
  readonly onOpenShareCard: (reply: TopicReplyDocumentBlock, layout: TopicReplyLineLayout) => void;
  readonly onResolvePostCommand?: ResolveTopicPostCommand | undefined;
  readonly onRunPostCommand?: RunTopicPostCommand | undefined;
  readonly onSendBoost?: SendTopicBoost | undefined;
  readonly onToggleCollapsed: (replyId: number) => void;
  readonly registerElement: (replyId: number, element: HTMLElement | null) => void;
  readonly reply: TopicReplyDocumentBlock;
  readonly replyTarget: TopicReplyDocumentBlock | null;
  readonly revision: number;
  readonly showAuthorAvatar: boolean;
}

const TopicReply = memo(function TopicReply({
  active,
  boostEditorOpen,
  collapsed,
  contentExpanded,
  currentUserAvatarUrl,
  currentUsername,
  docLineLayout,
  localBoosts,
  mode,
  nativeContentTransfer,
  lineLayout,
  onBoostSent,
  onCloseBoostEditor,
  onFocus,
  onCursorLine,
  onMoveFocus,
  onOpenBoostEditor,
  onOpenShareCard,
  onResolvePostCommand,
  onRunPostCommand,
  onSendBoost,
  onToggleCollapsed,
  onToggleContentFold,
  registerElement,
  reply,
  replyTarget,
  revision,
  showAuthorAvatar,
}: TopicReplyProps) {
  const headingId = `docode-topic-reply-${String(reply.id)}`;
  const contentId = `${headingId}-content`;
  const codeCollapsed = mode === 'code' && collapsed;
  const methodName = createReplyMethodName(reply);
  const codePlan = useMemo(
    () => createReplyCodePlan(reply.content, reply.id),
    [reply.content, reply.id],
  );
  const handleToggleContentFold = useCallback(() => {
    onToggleContentFold(reply.id);
  }, [onToggleContentFold, reply.id]);
  const codeStructure = useMemo<ReplyCodeStructureOptions | null>(
    () =>
      mode === 'code' && codePlan
        ? { expanded: contentExpanded, onToggleFold: handleToggleContentFold, plan: codePlan }
        : null,
    [codePlan, contentExpanded, handleToggleContentFold, mode],
  );
  const [menuRequest, setMenuRequest] = useState<TopicPostMenuRequest | null>(null);
  const openPostMenu = useCallback((left: number, top: number, returnFocus: HTMLElement) => {
    setMenuRequest((current) => ({
      left,
      returnFocus,
      sequence: (current?.sequence ?? 0) + 1,
      top,
    }));
  }, []);
  const dismissPostMenu = useCallback(
    (restoreFocus: boolean) => {
      const target = menuRequest?.returnFocus ?? null;
      setMenuRequest(null);
      if (restoreFocus && target) {
        requestFrame(() => {
          if (!target.isConnected) return;
          const replyElement = target.closest<HTMLElement>('.docode-topic-code__reply');
          if (replyElement && getComputedStyle(target).visibility === 'hidden') {
            replyElement.focus();
            requestFrame(() => {
              if (target.isConnected) target.focus();
            });
            return;
          }
          target.focus();
        });
      }
    },
    [menuRequest],
  );
  return (
    <article
      aria-labelledby={headingId}
      className="docode-topic-code__reply"
      data-active={active ? 'true' : undefined}
      data-annotated={mode === 'code' && lineLayout.annotation !== null ? 'true' : undefined}
      data-collapsed={codeCollapsed ? 'true' : undefined}
      data-doc-section={
        mode === 'doc' && docLineLayout.sectionHeading !== null ? 'true' : undefined
      }
      data-completeness={reply.completeness}
      data-post-id={reply.id}
      data-post-number={reply.floor.number}
      data-read-state={reply.readState}
      data-requested={reply.floor.requested ? 'true' : undefined}
      onContextMenu={(event) => {
        if (shouldPreserveNativeContextMenu(event.target)) return;
        event.preventDefault();
        onFocus(reply.id);
        openPostMenu(event.clientX, event.clientY, event.currentTarget);
      }}
      onClick={(event) => {
        onFocus(reply.id);
        const lineTarget =
          event.target instanceof Element
            ? event.target.closest<HTMLElement>('[data-docode-editor-line]')
            : null;
        if (mode === 'code' && lineTarget && event.currentTarget.contains(lineTarget))
          onCursorLine(reply.id, event.target, lineLayout.signature, event.clientY);
      }}
      onFocus={(event: ReactFocusEvent<HTMLElement>) => {
        onFocus(reply.id);
        if (mode === 'code' && event.target === event.currentTarget)
          onCursorLine(reply.id, event.target, lineLayout.signature);
      }}
      onKeyDown={(event) => {
        if (
          event.target === event.currentTarget &&
          (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey))
        ) {
          const rect = event.currentTarget.getBoundingClientRect();
          openPostMenu(rect.left + 16, rect.top + 24, event.currentTarget);
          event.preventDefault();
          return;
        }
        handleReplyKeyDown(event, (position) => {
          onMoveFocus(reply.id, position);
        });
      }}
      ref={(element) => {
        registerElement(reply.id, element);
      }}
      tabIndex={active ? 0 : -1}
    >
      <div className="docode-topic-code__reply-gutter">
        {mode === 'code' ? (
          <button
            aria-controls={contentId}
            aria-expanded={!codeCollapsed}
            aria-label={`${codeCollapsed ? 'Expand' : 'Collapse'} reply ${String(reply.floor.number)}`}
            className="docode-topic-code__fold"
            data-docode-tooltip={`${codeCollapsed ? 'Expand' : 'Collapse'} reply #${String(reply.floor.number)}`}
            onClick={(event) => {
              event.stopPropagation();
              onFocus(reply.id);
              onToggleCollapsed(reply.id);
            }}
            type="button"
          >
            <Codicon name={codeCollapsed ? 'chevron-right' : 'chevron-down'} />
          </button>
        ) : null}
        <a
          aria-current={reply.floor.requested ? 'location' : undefined}
          aria-label={`Open post ${String(reply.floor.number)}`}
          className="docode-topic-code__floor"
          href={reply.permalink}
        >
          {mode === 'code' ? lineLayout.signature : docLineLayout.heading}
        </a>
      </div>
      <div className="docode-topic-code__reply-body">
        <header className="docode-topic-code__reply-header" id={headingId}>
          {mode === 'code' && lineLayout.annotation !== null ? (
            <div
              aria-hidden="true"
              className="docode-topic-code__editor-line docode-topic-code__annotation-line"
              data-docode-editor-line={lineLayout.annotation}
            >
              <span className="docode-topic-code__annotation">@Override</span>
            </div>
          ) : null}
          {mode === 'code' ? (
            <div
              className="docode-topic-code__signature"
              data-docode-editor-line={lineLayout.signature}
            >
              <span className="docode-topic-code__declaration">private </span>
              {reply.replyToPostNumber === null ? (
                <span className="docode-topic-code__declaration">void </span>
              ) : (
                <span className="docode-topic-code__keyword">Replies </span>
              )}
              {reply.author ? (
                <>
                  {showAuthorAvatar ? <AuthorProfileAvatar author={reply.author} /> : null}
                  <a className="docode-topic-code__author" href={reply.author.url}>
                    {methodName}
                  </a>
                </>
              ) : (
                <span className="docode-topic-code__author">{methodName}</span>
              )}
              <span className="docode-topic-code__punctuation docode-topic-code__bracket">
                {'() {'}
              </span>
              {codeCollapsed ? (
                <>
                  <span className="docode-topic-code__fold-placeholder"> … </span>
                  <span className="docode-topic-code__punctuation docode-topic-code__bracket">
                    {'}'}
                  </span>
                </>
              ) : null}
            </div>
          ) : (
            <>
              {docLineLayout.sectionHeading !== null ? (
                <>
                  <div
                    aria-hidden="true"
                    className="docode-topic-code__editor-line docode-topic-code__md-heading docode-topic-code__md-section"
                    data-docode-editor-line={docLineLayout.sectionHeading}
                  >
                    <span className="docode-topic-code__md-marker">{'## '}</span>
                    {TOPIC_DOC_REPLIES_SECTION_LABEL}
                  </div>
                  <div
                    aria-hidden="true"
                    className="docode-topic-code__editor-line"
                    data-docode-editor-line={docLineLayout.sectionBlank ?? undefined}
                  />
                </>
              ) : null}
              <div
                className="docode-topic-code__signature docode-topic-code__md-heading"
                data-docode-editor-line={docLineLayout.heading}
              >
                <span aria-hidden="true" className="docode-topic-code__md-marker">
                  {'### '}
                </span>
                <a className="docode-topic-code__md-floor" href={reply.permalink}>
                  {createDocReplyHeadingLabel(reply)}
                </a>
                {reply.author ? (
                  <>
                    {' · '}
                    <a className="docode-topic-code__author" href={reply.author.url}>
                      @{reply.author.username}
                    </a>
                  </>
                ) : null}
                {reply.publishedLabel ? (
                  <>
                    {' · '}
                    <time dateTime={reply.publishedAt ?? undefined}>{reply.publishedLabel}</time>
                  </>
                ) : null}
                {reply.completeness === 'partial' ? <>{' · '}partially loaded</> : null}
              </div>
            </>
          )}
          {mode === 'code' && !codeCollapsed ? (
            <div
              className="docode-topic-code__metadata docode-topic-code__reply-metadata"
              data-docode-editor-line={lineLayout.metadata}
            >
              <span aria-hidden="true" className="docode-topic-code__comment-marker">
                {'//'}
              </span>
              <a href={reply.permalink}>#{reply.floor.number}</a>
              {reply.author?.displayName ? (
                <>
                  <span aria-hidden="true" className="docode-topic-code__metadata-separator">
                    ·
                  </span>
                  <span>{reply.author.displayName}</span>
                </>
              ) : null}
              {reply.publishedLabel ? (
                <>
                  <span aria-hidden="true" className="docode-topic-code__metadata-separator">
                    ·
                  </span>
                  <time dateTime={reply.publishedAt ?? undefined}>{reply.publishedLabel}</time>
                </>
              ) : null}
              {reply.reactionCount > 0 ? (
                <>
                  <span aria-hidden="true" className="docode-topic-code__metadata-separator">
                    ·
                  </span>
                  <span
                    className="docode-topic-code__reaction-count"
                    title={`${String(reply.reactionCount)} reactions`}
                  >
                    <span aria-hidden="true" className="docode-topic-code__reaction-heart">
                      ♥
                    </span>
                    {reply.reactionCount}
                  </span>
                </>
              ) : null}
              {reply.completeness === 'partial' ? (
                <>
                  <span aria-hidden="true" className="docode-topic-code__metadata-separator">
                    ·
                  </span>
                  <span>partially loaded</span>
                </>
              ) : null}
              {reply.readState === 'unread' ? (
                <>
                  <span aria-hidden="true" className="docode-topic-code__metadata-separator">
                    ·
                  </span>
                  <span className="docode-topic-code__unread-annotation" title="Unread post">
                    @unread
                  </span>
                </>
              ) : null}
              {lineLayout.boosts === null &&
              onSendBoost !== undefined &&
              currentUsername !== null ? (
                <button
                  aria-label={`Boost post ${String(reply.floor.number)}`}
                  className="docode-topic-code__metadata-boost"
                  data-docode-tooltip="Send a quick Boost reply"
                  onClick={() => {
                    onOpenBoostEditor?.(reply.id);
                  }}
                  type="button"
                >
                  <Codicon name="rocket" />
                </button>
              ) : null}
            </div>
          ) : null}
          <div className="docode-topic-code__reply-actions">
            <PostActionStrip
              compact
              menuRequest={menuRequest}
              onDismissMenu={dismissPostMenu}
              onOpenMenu={openPostMenu}
              onResolvePostCommand={onResolvePostCommand}
              onRunPostCommand={onRunPostCommand}
              onShareCard={() => {
                onOpenShareCard(reply, lineLayout);
              }}
              reply={reply}
            />
          </div>
        </header>
        <div className="docode-topic-code__content-indent" hidden={codeCollapsed} id={contentId}>
          {!codeCollapsed ? (
            reply.content ? (
              <NativeContentSlot
                codeStructure={codeStructure}
                content={reply.content}
                firstLine={mode === 'code' ? lineLayout.contentStart : docLineLayout.contentStart}
                nativeContentTransfer={nativeContentTransfer}
                revision={revision}
                root={reply.content.root}
              />
            ) : (
              <p
                className="docode-topic-code__missing-content"
                data-docode-editor-line={
                  mode === 'code' ? lineLayout.contentStart : docLineLayout.contentStart
                }
                role="status"
              >
                Content is not available in the loaded Linux DO post.
              </p>
            )
          ) : null}
          {!codeCollapsed && mode === 'code' && lineLayout.boosts !== null ? (
            <BoostBubbles
              boosts={reply.boosts}
              currentUserAvatarUrl={currentUserAvatarUrl}
              currentUsername={currentUsername}
              editing={boostEditorOpen}
              lineNumber={lineLayout.boosts}
              localBoosts={localBoosts}
              onBoostSent={onBoostSent}
              onCloseEditor={onCloseBoostEditor}
              onOpenEditor={(postId) => onOpenBoostEditor?.(postId)}
              onSendBoost={onSendBoost}
              postAuthorUsername={reply.author?.username ?? null}
              postId={reply.id}
              postNumber={reply.floor.number}
            />
          ) : null}
          {!codeCollapsed &&
          (mode === 'code' ? lineLayout.replyTarget : docLineLayout.replyTarget) !== null &&
          reply.replyToPostNumber !== null ? (
            <ReplyTargetReference
              key={reply.replyToPostNumber}
              lineNumber={
                (mode === 'code' ? lineLayout.replyTarget : docLineLayout.replyTarget) ?? 0
              }
              mode={mode}
              target={replyTarget}
              targetPostNumber={reply.replyToPostNumber}
            />
          ) : null}
          {!codeCollapsed && mode === 'code' && lineLayout.save !== null ? (
            <div
              aria-hidden="true"
              className="docode-topic-code__editor-line docode-topic-code__save-line"
              data-docode-editor-line={lineLayout.save}
            >
              <span className="docode-topic-code__code-method">save</span>
              <span className="docode-topic-code__punctuation">(</span>
              <span className="docode-topic-code__code-plain">reply</span>
              <span className="docode-topic-code__punctuation">);</span>
            </div>
          ) : null}
        </div>
        {mode === 'code' && !codeCollapsed ? (
          <div
            aria-hidden="true"
            className="docode-topic-code__reply-close"
            data-docode-editor-line={lineLayout.close}
          >
            <span className="docode-topic-code__bracket">{'}'}</span>
          </div>
        ) : null}
        {mode === 'doc' ? (
          <div
            aria-hidden="true"
            className="docode-topic-code__editor-line docode-topic-code__doc-blank"
            data-docode-editor-line={docLineLayout.blank}
          />
        ) : null}
      </div>
    </article>
  );
}, areTopicReplyPropsEqual);

function BoostBubbles({
  boosts: nativeBoosts,
  currentUserAvatarUrl,
  currentUsername,
  editing,
  lineNumber,
  localBoosts,
  onBoostSent,
  onCloseEditor,
  onOpenEditor,
  onSendBoost,
  postAuthorUsername,
  postId,
  postNumber,
}: {
  readonly boosts: TopicReplyDocumentBlock['boosts'];
  readonly currentUserAvatarUrl: string | null;
  readonly currentUsername: string | null;
  readonly editing: boolean;
  readonly lineNumber: number;
  readonly localBoosts: readonly TopicPostBoost[];
  readonly onBoostSent: (postId: number, boost: TopicPostBoost) => void;
  readonly onCloseEditor: () => void;
  readonly onOpenEditor: (postId: number) => void;
  readonly onSendBoost: SendTopicBoost | undefined;
  readonly postAuthorUsername: string | null;
  readonly postId: number;
  readonly postNumber: number;
}) {
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const sendController = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      sendController.current?.abort();
    },
    [],
  );
  const boosts = useMemo(
    () => [
      ...nativeBoosts,
      ...localBoosts.filter(
        (local) =>
          !nativeBoosts.some(
            (native) =>
              native.username !== null &&
              native.username.toLowerCase() === local.username?.toLowerCase(),
          ),
      ),
    ],
    [localBoosts, nativeBoosts],
  );
  const alreadyBoosted =
    currentUsername !== null &&
    boosts.some((boost) => boost.username?.toLowerCase() === currentUsername.toLowerCase());
  const canBoost = onSendBoost !== undefined && currentUsername !== null && !alreadyBoosted;
  const closeEditor = () => {
    sendController.current?.abort();
    setDraft('');
    setPending(false);
    setSendError(null);
    onCloseEditor();
  };
  const submitBoost = () => {
    if (!onSendBoost || pending) return;
    const raw = draft.trim();
    if (raw.length === 0) return;
    const controller = new AbortController();
    sendController.current = controller;
    setPending(true);
    setSendError(null);
    void onSendBoost(postId, raw, controller.signal).then(
      (outcome) => {
        if (controller.signal.aborted) return;
        setPending(false);
        if (outcome.kind === 'created') {
          onBoostSent(postId, {
            avatarUrl: outcome.boost.avatarUrl ?? currentUserAvatarUrl,
            text: outcome.boost.text,
            username: outcome.boost.username ?? currentUsername,
          });
          setDraft('');
          setSendError(null);
          onCloseEditor();
          return;
        }
        if (outcome.code === 'aborted') return;
        setSendError(outcome.message);
      },
      () => {
        if (controller.signal.aborted) return;
        setPending(false);
        setSendError('Linux DO rejected the Boost request.');
      },
    );
  };
  return (
    <div
      className="docode-topic-code__boosts-line"
      data-docode-editor-line={lineNumber}
      data-docode-soft-wrap="true"
      data-post-boosts={postNumber}
    >
      <span aria-hidden="true" className="docode-topic-code__boosts-label">
        {`// boosts(${String(boosts.length)}):`}
      </span>
      <span className="docode-sr-only">
        {`${String(boosts.length)} quick replies to post ${String(postNumber)}`}
      </span>
      {boosts.map((boost, index) => (
        <span
          className="docode-topic-code__boost"
          key={`${boost.username ?? 'anonymous'}:${String(index)}`}
        >
          {boost.avatarUrl ? (
            <img alt="" decoding="async" loading="lazy" src={boost.avatarUrl} />
          ) : null}
          <span className="docode-topic-code__boost-text">{boost.text}</span>
          <span aria-hidden="true" className="docode-topic-code__boost-preview">
            {boost.avatarUrl ? (
              <img alt="" decoding="async" loading="lazy" src={boost.avatarUrl} />
            ) : null}
            <span className="docode-topic-code__boost-preview-body">
              {boost.username ? (
                <span className="docode-topic-code__boost-preview-user">{`@${boost.username}`}</span>
              ) : null}
              <span className="docode-topic-code__boost-preview-text">{boost.text}</span>
            </span>
          </span>
        </span>
      ))}
      {canBoost && !editing ? (
        <button
          aria-label={`Boost post ${String(postNumber)}`}
          className="docode-topic-code__boost-add"
          data-docode-tooltip="Send a quick Boost reply"
          onClick={() => {
            onOpenEditor(postId);
          }}
          type="button"
        >
          <Codicon name="rocket" />
        </button>
      ) : null}
      {canBoost && editing ? (
        <span className="docode-topic-code__boost-editor" data-pending={pending ? 'true' : 'false'}>
          {currentUserAvatarUrl ? (
            <img
              alt=""
              className="docode-topic-code__boost-editor-avatar"
              decoding="async"
              src={currentUserAvatarUrl}
            />
          ) : null}
          <input
            aria-label={`Boost text for post ${String(postNumber)}`}
            autoFocus
            className="docode-topic-code__boost-input"
            disabled={pending}
            maxLength={64}
            onBlur={() => {
              if (draft.trim().length === 0 && !pending) closeEditor();
            }}
            onChange={(event) => {
              setDraft(event.currentTarget.value);
              setSendError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                submitBoost();
                return;
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                closeEditor();
              }
            }}
            placeholder={postAuthorUsername ? `Boost ${postAuthorUsername}…` : 'Boost…'}
            spellCheck={false}
            type="text"
            value={draft}
          />
          {pending ? (
            <span className="docode-topic-code__boost-editor-action" data-role="pending">
              <Codicon name="loading" spin />
            </span>
          ) : (
            <>
              <button
                aria-label={`Send boost for post ${String(postNumber)}`}
                className="docode-topic-code__boost-editor-action"
                data-role="send"
                disabled={draft.trim().length === 0}
                onClick={submitBoost}
                type="button"
              >
                <Codicon name="check" />
              </button>
              <button
                aria-label={`Cancel boost for post ${String(postNumber)}`}
                className="docode-topic-code__boost-editor-action"
                data-role="cancel"
                onClick={closeEditor}
                type="button"
              >
                <Codicon name="close" />
              </button>
            </>
          )}
        </span>
      ) : null}
      {sendError !== null && editing ? (
        <span className="docode-topic-code__boost-error" role="alert">
          {sendError}
        </span>
      ) : null}
    </div>
  );
}

function areTopicReplyPropsEqual(
  previous: Readonly<TopicReplyProps>,
  next: Readonly<TopicReplyProps>,
): boolean {
  return (
    previous.active === next.active &&
    previous.boostEditorOpen === next.boostEditorOpen &&
    previous.collapsed === next.collapsed &&
    previous.contentExpanded === next.contentExpanded &&
    previous.onToggleContentFold === next.onToggleContentFold &&
    previous.currentUserAvatarUrl === next.currentUserAvatarUrl &&
    previous.currentUsername === next.currentUsername &&
    previous.localBoosts === next.localBoosts &&
    previous.onBoostSent === next.onBoostSent &&
    previous.onCloseBoostEditor === next.onCloseBoostEditor &&
    previous.onOpenBoostEditor === next.onOpenBoostEditor &&
    previous.onOpenShareCard === next.onOpenShareCard &&
    previous.onSendBoost === next.onSendBoost &&
    previous.docLineLayout === next.docLineLayout &&
    previous.mode === next.mode &&
    previous.lineLayout === next.lineLayout &&
    previous.nativeContentTransfer === next.nativeContentTransfer &&
    previous.onFocus === next.onFocus &&
    previous.onCursorLine === next.onCursorLine &&
    previous.onMoveFocus === next.onMoveFocus &&
    previous.onToggleCollapsed === next.onToggleCollapsed &&
    previous.registerElement === next.registerElement &&
    previous.reply === next.reply &&
    previous.replyTarget === next.replyTarget &&
    previous.revision === next.revision &&
    previous.showAuthorAvatar === next.showAuthorAvatar
  );
}

interface WorkbenchHoverPosition {
  readonly left: number;
  readonly top: number;
}

function useWorkbenchHover() {
  const anchor = useRef<HTMLButtonElement>(null);
  const hover = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<WorkbenchHoverPosition | null>(null);
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  const registerAnchor = useCallback((element: HTMLButtonElement | null) => {
    anchor.current = element;
    const nextPortalHost = element?.closest<HTMLElement>('[data-docode-workbench-root]') ?? null;
    setPortalHost((current) => (current === nextPortalHost ? current : nextPortalHost));
  }, []);
  const registerHover = useCallback((element: HTMLDivElement | null) => {
    hover.current = element;
  }, []);
  const getOwnerDocument = useCallback(() => anchor.current?.ownerDocument ?? null, []);
  const cancelClose = useCallback(() => {
    if (closeTimer.current === null) return;
    anchor.current?.ownerDocument.defaultView?.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }, []);
  const show = useCallback(() => {
    cancelClose();
    setOpen(true);
  }, [cancelClose]);
  const hide = useCallback(() => {
    cancelClose();
    setOpen(false);
    setPosition(null);
  }, [cancelClose]);
  const scheduleHide = useCallback(() => {
    cancelClose();
    closeTimer.current = anchor.current?.ownerDocument.defaultView?.setTimeout(hide, 120) ?? null;
  }, [cancelClose, hide]);
  const updatePosition = useCallback(() => {
    const anchorElement = anchor.current;
    const hoverElement = hover.current;
    const view = anchorElement?.ownerDocument.defaultView;
    if (!anchorElement || !hoverElement || !view) return;
    const anchorRect = anchorElement.getBoundingClientRect();
    const hoverRect = hoverElement.getBoundingClientRect();
    const margin = 8;
    const left = Math.max(
      margin,
      Math.min(anchorRect.left, view.innerWidth - hoverRect.width - margin),
    );
    const below = anchorRect.bottom + 4;
    const top =
      below + hoverRect.height <= view.innerHeight - margin
        ? below
        : Math.max(margin, anchorRect.top - hoverRect.height - 4);
    setPosition({ left, top });
  }, []);

  useLayoutEffect(() => {
    if (!open || !portalHost) return;
    updatePosition();
  }, [open, portalHost, updatePosition]);

  useEffect(() => {
    const view = anchor.current?.ownerDocument.defaultView;
    if (!open || !view) return;
    view.addEventListener('resize', updatePosition);
    view.addEventListener('scroll', updatePosition, true);
    return () => {
      view.removeEventListener('resize', updatePosition);
      view.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, updatePosition]);

  useEffect(
    () => () => {
      cancelClose();
    },
    [cancelClose],
  );

  const handleEscape = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      if (event.key !== 'Escape' || !open) return;
      hide();
      anchor.current?.focus();
      event.preventDefault();
      event.stopPropagation();
    },
    [hide, open],
  );

  return {
    cancelClose,
    getOwnerDocument,
    handleEscape,
    hide,
    open,
    portalHost,
    position,
    registerAnchor,
    registerHover,
    scheduleHide,
    show,
  } as const;
}

type AuthorProfileState =
  | { readonly kind: 'idle' | 'loading' | 'unavailable' }
  | { readonly card: LinuxDoUserCard; readonly kind: 'ready' };

function AuthorProfileAvatar({ author }: { readonly author: TopicPostAuthor }) {
  if (!author.avatarUrl) return null;
  return (
    <AuthorProfileAvatarContent
      author={author}
      avatarUrl={author.avatarUrl}
      key={author.username}
    />
  );
}

function AuthorProfileAvatarContent({
  author,
  avatarUrl,
}: {
  readonly author: TopicPostAuthor;
  readonly avatarUrl: string;
}) {
  const {
    cancelClose,
    getOwnerDocument,
    handleEscape,
    hide,
    open,
    portalHost,
    position,
    registerAnchor,
    registerHover,
    scheduleHide,
    show: showHover,
  } = useWorkbenchHover();
  const request = useRef<AbortController | null>(null);
  const [profile, setProfile] = useState<AuthorProfileState>({ kind: 'idle' });
  const hoverId = `docode-author-profile-hover-${author.username}`;

  useEffect(
    () => () => {
      request.current?.abort();
      request.current = null;
    },
    [],
  );

  const ensureProfile = useCallback(() => {
    if (profile.kind !== 'idle' || request.current) return;
    const ownerDocument = getOwnerDocument();
    if (!ownerDocument) return;
    const nextRequest = new AbortController();
    request.current = nextRequest;
    setProfile({ kind: 'loading' });
    void loadLinuxDoUserCard(ownerDocument, author.username, nextRequest.signal).then((outcome) => {
      if (request.current !== nextRequest || nextRequest.signal.aborted) return;
      request.current = null;
      setProfile(
        outcome.kind === 'ready' ? { card: outcome.card, kind: 'ready' } : { kind: 'unavailable' },
      );
    });
  }, [author.username, getOwnerDocument, profile.kind]);
  const show = useCallback(() => {
    showHover();
    ensureProfile();
  }, [ensureProfile, showHover]);

  const resolvedAvatarUrl = profile.kind === 'ready' ? profile.card.avatarUrl : null;
  return (
    <>
      <button
        aria-controls={open ? hoverId : undefined}
        aria-expanded={open}
        aria-label={`Show profile for @${author.username}`}
        className="docode-topic-code__author-avatar"
        onBlur={scheduleHide}
        onClick={() => {
          if (open) hide();
          else show();
        }}
        onFocus={show}
        onKeyDown={handleEscape}
        onPointerEnter={show}
        onPointerLeave={scheduleHide}
        ref={registerAnchor}
        type="button"
      >
        <img alt="" decoding="async" src={avatarUrl} />
      </button>
      {open && portalHost
        ? createPortal(
            <div
              aria-label={`Linux DO profile for @${author.username}`}
              className="docode-topic-code__reply-hover docode-topic-code__profile-hover"
              id={hoverId}
              onKeyDown={handleEscape}
              onPointerEnter={cancelClose}
              onPointerLeave={scheduleHide}
              ref={registerHover}
              role="tooltip"
              style={{
                left: position?.left ?? 0,
                top: position?.top ?? 0,
                visibility: position ? 'visible' : 'hidden',
              }}
            >
              <div className="docode-topic-code__profile-signature">
                <img alt="" decoding="async" src={resolvedAvatarUrl ?? avatarUrl} />
                <div>
                  <div>
                    <span className="docode-topic-code__reply-hover-kind">(user)</span>{' '}
                    <span className="docode-topic-code__keyword">profile</span>{' '}
                    <span className="docode-topic-code__author">@{author.username}</span>{' '}
                    <span className="docode-topic-code__punctuation">{'{'}</span>
                  </div>
                  <div className="docode-topic-code__reply-hover-metadata">
                    <span className="docode-topic-code__comment-marker">{'//'}</span>{' '}
                    {profile.kind === 'ready' ? profile.card.displayName : author.displayName}
                    {profile.kind === 'ready' && profile.card.title
                      ? ` · ${profile.card.title}`
                      : null}
                  </div>
                </div>
              </div>
              <AuthorProfileDocumentation author={author} profile={profile} />
            </div>,
            portalHost,
          )
        : null}
    </>
  );
}

function AuthorProfileDocumentation({
  author,
  profile,
}: {
  readonly author: TopicPostAuthor;
  readonly profile: AuthorProfileState;
}) {
  if (profile.kind === 'ready') {
    return <ReadyAuthorProfileDocumentation card={profile.card} />;
  }
  if (profile.kind === 'idle' || profile.kind === 'loading') {
    return (
      <div className="docode-topic-code__reply-hover-documentation">Loading Linux DO profile…</div>
    );
  }
  return (
    <div className="docode-topic-code__reply-hover-documentation">
      Profile details are unavailable. Open @{author.username} on Linux DO for the native profile.
    </div>
  );
}

function ReadyAuthorProfileDocumentation({ card }: { readonly card: LinuxDoUserCard }) {
  const metadata = [
    card.createdAt ? `joined ${formatProfileDate(card.createdAt)}` : null,
    card.lastPostedAt ? `last post ${formatProfileDate(card.lastPostedAt)}` : null,
    card.lastSeenAt ? `seen ${formatProfileDate(card.lastSeenAt)}` : null,
    card.topicPostCount !== null ? `${String(card.topicPostCount)} posts in topic` : null,
    card.trustLevel !== null ? `trust level ${String(card.trustLevel)}` : null,
    card.timeReadSeconds !== null ? `read ${formatReadDuration(card.timeReadSeconds)}` : null,
  ].filter((value): value is string => Boolean(value));
  return (
    <div className="docode-topic-code__reply-hover-documentation">
      {card.bioExcerpt ? (
        <div className="docode-topic-code__profile-bio">{card.bioExcerpt}</div>
      ) : null}
      {metadata.length > 0 ? (
        <div className="docode-topic-code__profile-metadata">{metadata.join(' · ')}</div>
      ) : null}
      {card.location || card.websiteUrl ? (
        <div className="docode-topic-code__profile-metadata">
          {[card.location, card.websiteUrl].filter(Boolean).join(' · ')}
        </div>
      ) : null}
      {card.badges.length > 0 ? (
        <div className="docode-topic-code__profile-badges">
          <span className="docode-topic-code__keyword">badges</span>
          <span className="docode-topic-code__punctuation">: [</span>
          {card.badges.map((badge, index) => (
            <span key={badge.name} title={badge.description ?? undefined}>
              {index > 0 ? ', ' : null}
              <span className="docode-topic-code__reply-hover-content">
                &quot;{badge.name}&quot;
              </span>
            </span>
          ))}
          <span className="docode-topic-code__punctuation">]</span>
        </div>
      ) : null}
      {!card.bioExcerpt && metadata.length === 0 && !card.location && !card.websiteUrl ? (
        <span>Linux DO returned no public profile details for this user.</span>
      ) : null}
    </div>
  );
}

function formatProfileDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function formatReadDuration(seconds: number): string {
  if (seconds < 60) return `${String(seconds)}s`;
  if (seconds < 3_600) return `${String(Math.round(seconds / 60))}m`;
  if (seconds < 86_400) return `${String(Math.round(seconds / 3_600))}h`;
  return `${String(Math.round(seconds / 86_400))}d`;
}

function ReplyTargetReference({
  lineNumber,
  mode = 'code',
  target,
  targetPostNumber,
}: {
  readonly lineNumber: number;
  readonly mode?: TopicReadingMode;
  readonly target: TopicReplyDocumentBlock | null;
  readonly targetPostNumber: number;
}) {
  const {
    cancelClose,
    handleEscape,
    hide,
    open,
    portalHost,
    position,
    registerAnchor,
    registerHover,
    scheduleHide,
    show,
  } = useWorkbenchHover();
  const hoverId = `docode-reply-target-hover-${String(lineNumber)}-${String(targetPostNumber)}`;
  const previewLines = useMemo(
    () =>
      target
        ? summarizeNativeContentLines(target.content)
            .map(({ text }) => text.trim())
            .filter(Boolean)
            .slice(0, 8)
        : [],
    [target],
  );
  return (
    <div className="docode-topic-code__reply-target-line" data-docode-editor-line={lineNumber}>
      <button
        aria-describedby={open ? hoverId : undefined}
        aria-expanded={open}
        aria-controls={hoverId}
        aria-label={`Preview replied-to post ${String(targetPostNumber)}`}
        className="docode-topic-code__reply-target"
        onBlur={scheduleHide}
        onClick={() => {
          if (open) hide();
          else show();
        }}
        onFocus={show}
        onKeyDown={handleEscape}
        onPointerEnter={show}
        onPointerLeave={scheduleHide}
        ref={registerAnchor}
        type="button"
      >
        {mode === 'code' ? (
          <>
            <span className="docode-topic-code__keyword">return</span>{' '}
            <span className="docode-topic-code__reply-target-floor">#{targetPostNumber}</span>
            {target?.author ? (
              <span className="docode-topic-code__reply-target-author">
                {' '}
                · @{target.author.username}
              </span>
            ) : null}
            <span className="docode-topic-code__punctuation">;</span>
          </>
        ) : (
          <>
            <span className="docode-topic-code__md-quote-marker">{'> '}</span>
            <span className="docode-topic-code__reply-target-floor">
              回复 楼 {targetPostNumber}
            </span>
            {target?.author ? (
              <span className="docode-topic-code__reply-target-author">
                {' '}
                · @{target.author.username}
              </span>
            ) : null}
          </>
        )}
      </button>
      {open && portalHost
        ? createPortal(
            <div
              className="docode-topic-code__reply-hover"
              id={hoverId}
              onKeyDown={handleEscape}
              onPointerEnter={cancelClose}
              onPointerLeave={scheduleHide}
              ref={registerHover}
              role="tooltip"
              style={{
                left: position?.left ?? 0,
                top: position?.top ?? 0,
                visibility: position ? 'visible' : 'hidden',
              }}
            >
              <div className="docode-topic-code__reply-hover-signature">
                <div>
                  <span className="docode-topic-code__reply-hover-kind">(reply)</span>{' '}
                  <span className="docode-topic-code__declaration">
                    private {target && target.replyToPostNumber !== null ? 'Replies' : 'void'}{' '}
                  </span>
                  <span className="docode-topic-code__author">
                    {target ? createReplyMethodName(target) : `post_${String(targetPostNumber)}`}
                  </span>
                  <span className="docode-topic-code__punctuation">{'() {'}</span>
                </div>
                <div className="docode-topic-code__reply-hover-metadata">
                  <span className="docode-topic-code__comment-marker">{'//'}</span>{' '}
                  <span>#{targetPostNumber}</span>
                  {target?.author?.displayName ? <span> · {target.author.displayName}</span> : null}
                  {target?.publishedLabel ? <span> · {target.publishedLabel}</span> : null}
                </div>
              </div>
              <div className="docode-topic-code__reply-hover-documentation">
                {target ? (
                  previewLines.length > 0 ? (
                    previewLines.map((line, index) => (
                      <div className="docode-topic-code__reply-hover-content" key={index}>
                        &quot;{line}&quot;
                      </div>
                    ))
                  ) : (
                    <span>Post #{targetPostNumber} has no readable loaded text.</span>
                  )
                ) : (
                  <span>
                    Post #{targetPostNumber} is outside the currently loaded reply window.
                  </span>
                )}
              </div>
            </div>,
            portalHost,
          )
        : null}
    </div>
  );
}

interface NativeContentSlotProps {
  readonly codeStructure: ReplyCodeStructureOptions | null;
  readonly content: NonNullable<TopicReplyDocumentBlock['content']>;
  readonly firstLine: number;
  readonly nativeContentTransfer: NativeContentTransfer;
  readonly revision: number;
  readonly root: HTMLElement;
}

function NativeContentSlot({
  codeStructure,
  content,
  firstLine,
  nativeContentTransfer,
  revision,
  root,
}: NativeContentSlotProps) {
  const host = useRef<HTMLDivElement>(null);
  const restoreTransfer = useRef<(() => void) | null>(null);
  const mountTransfer = useCallback(() => {
    if (!host.current) return null;
    return nativeContentTransfer.mount(root, host.current);
  }, [nativeContentTransfer, root]);

  useLayoutEffect(() => {
    restoreTransfer.current = mountTransfer();
    return () => {
      restoreTransfer.current?.();
      restoreTransfer.current = null;
    };
  }, [mountTransfer]);

  useLayoutEffect(() => {
    if (!host.current || root.parentNode !== host.current) return;
    const workbenchRoot = host.current.closest<HTMLElement>('[data-docode-workbench-root]');
    if (!workbenchRoot) return;
    return presentNativeContent(content, firstLine, workbenchRoot, codeStructure);
  }, [codeStructure, content, firstLine, root]);

  useLayoutEffect(() => {
    if (!host.current || root.parentNode === host.current) return;
    restoreTransfer.current?.();
    restoreTransfer.current = mountTransfer();
  }, [mountTransfer, revision, root]);

  return <div className="docode-topic-code__content-slot" ref={host} />;
}

function isNearTopicEnd(element: HTMLElement): boolean {
  return (
    element.clientHeight > 0 &&
    element.scrollHeight > 0 &&
    element.scrollTop + element.clientHeight >= element.scrollHeight - 320
  );
}

function isNearTopicStart(element: HTMLElement): boolean {
  return element.clientHeight > 0 && element.scrollHeight > 0 && element.scrollTop <= 320;
}

function isViewportNavigationKey(key: string): boolean {
  return ['ArrowDown', 'ArrowUp', 'End', 'Home', 'PageDown', 'PageUp', ' '].includes(key);
}

function getNativeLineOffset(element: HTMLElement, clientY: number, lineCount: number): number {
  const rect = element.getBoundingClientRect();
  const lineHeight = rect.height > 0 ? rect.height / lineCount : 20;
  return Math.min(lineCount - 1, Math.max(0, Math.floor((clientY - rect.top) / lineHeight)));
}

function loadedWindowLabel(document: ReadyTopicDetailDocument): string {
  const { firstPostNumber, lastPostNumber, loadedPostCount } = document.loadedWindow;
  if (firstPostNumber === null || lastPostNumber === null) return 'no loaded posts';
  if (firstPostNumber === lastPostNumber) return `post ${String(firstPostNumber)} loaded`;
  return `posts ${String(firstPostNumber)}–${String(lastPostNumber)} loaded (${String(loadedPostCount)})`;
}

function preferredReplyId(document: ReadyTopicDetailDocument): number | null {
  return (
    document.replies.find(({ floor }) => floor.requested)?.id ?? document.replies[0]?.id ?? null
  );
}

function scrollElementIntoSurface(
  surface: HTMLElement,
  element: HTMLElement,
  block: Extract<ScrollLogicalPosition, 'center' | 'nearest'>,
): boolean {
  const surfaceRect = surface.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  if (surfaceRect.height <= 0 || elementRect.height <= 0) return false;
  if (block === 'center') {
    const elementCenter =
      surface.scrollTop + elementRect.top - surfaceRect.top + elementRect.height / 2;
    surface.scrollTop = Math.max(0, elementCenter - surface.clientHeight / 2);
    return true;
  }
  const visibleBottom = surfaceRect.top + Math.min(surfaceRect.height, surface.clientHeight);
  if (elementRect.top < surfaceRect.top) {
    surface.scrollTop += elementRect.top - surfaceRect.top;
  } else if (elementRect.bottom > visibleBottom) {
    surface.scrollTop += elementRect.bottom - visibleBottom;
  }
  return true;
}

function shouldPreserveNativeContextMenu(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest('a, input, textarea, select, img, video, audio')) return true;
  const selection = target.ownerDocument.getSelection();
  return selection !== null && !selection.isCollapsed;
}

function requestFrame(callback: FrameRequestCallback): number {
  const requestAnimationFrame: unknown = Reflect.get(window, 'requestAnimationFrame');
  return typeof requestAnimationFrame === 'function'
    ? (Reflect.apply(requestAnimationFrame, window, [callback]) as number)
    : window.setTimeout(() => {
        callback(performance.now());
      }, 0);
}

function cancelFrame(handle: number): void {
  const cancelAnimationFrame: unknown = Reflect.get(window, 'cancelAnimationFrame');
  if (typeof cancelAnimationFrame === 'function') {
    Reflect.apply(cancelAnimationFrame, window, [handle]);
  } else {
    window.clearTimeout(handle);
  }
}

function createResizeObserver(callback: ResizeObserverCallback): ResizeObserver | null {
  const ResizeObserverConstructor: unknown = Reflect.get(window, 'ResizeObserver');
  return typeof ResizeObserverConstructor === 'function'
    ? (Reflect.construct(ResizeObserverConstructor, [callback]) as ResizeObserver)
    : null;
}

function handleReplyKeyDown(
  event: ReactKeyboardEvent<HTMLElement>,
  onMoveFocus: (position: 'end' | 'next' | 'previous' | 'start') => void,
): void {
  if (event.currentTarget !== event.target) return;
  const position =
    event.key === 'ArrowDown'
      ? 'next'
      : event.key === 'ArrowUp'
        ? 'previous'
        : event.key === 'Home'
          ? 'start'
          : event.key === 'End'
            ? 'end'
            : null;
  if (!position) return;
  event.preventDefault();
  onMoveFocus(position);
}
