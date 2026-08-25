import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

import { Codicon } from '../../ui/icons/codicon';
import type {
  TopicActionCapabilityModel,
  TopicDetailDocument,
  TopicReplyCapabilityModel,
  TopicReplyDocumentBlock,
} from './topicDetailDocument';

type ReadyTopicDetailDocument = TopicDetailDocument & { readonly state: 'ready' };

export type TopicPostCommandId = 'bookmark' | 'copy-link' | 'like' | 'reply';
export type TopicPostCommandSource = 'context-menu' | 'editor-action';

export interface TopicPostCommandAvailability {
  readonly available: boolean;
  readonly message: string;
}

export type ResolveTopicPostCommand = (
  commandId: TopicPostCommandId,
  reply: TopicReplyDocumentBlock,
  source: TopicPostCommandSource,
) => TopicPostCommandAvailability;

export type RunTopicPostCommand = (request: {
  readonly commandId: TopicPostCommandId;
  readonly reply: TopicReplyDocumentBlock;
  readonly signal: AbortSignal;
  readonly source: TopicPostCommandSource;
}) => Promise<{ readonly kind: 'failed'; readonly message: string } | { readonly kind: 'success' }>;

export interface TopicPostMenuRequest {
  readonly left: number;
  readonly returnFocus: HTMLElement;
  readonly sequence: number;
  readonly top: number;
}

interface CommandFeedback {
  readonly commandId: TopicPostCommandId;
  readonly kind: 'failed' | 'pending' | 'success';
  readonly message: string;
}

const POST_MENU_GROUPS: readonly (readonly TopicPostCommandId[])[] = [
  ['reply'],
  ['like', 'bookmark'],
  ['copy-link'],
];
const POST_MENU_WIDTH = 220;
const POST_MENU_HEIGHT = 132;
const POST_MENU_MARGIN = 4;

export function PostActionStrip({
  compact = false,
  menuRequest,
  onDismissMenu,
  onOpenMenu,
  onResolvePostCommand,
  onRunPostCommand,
  reply,
}: {
  readonly compact?: boolean;
  readonly menuRequest: TopicPostMenuRequest | null;
  readonly onDismissMenu: (restoreFocus: boolean) => void;
  readonly onOpenMenu: (left: number, top: number, returnFocus: HTMLElement) => void;
  readonly onResolvePostCommand?: ResolveTopicPostCommand | undefined;
  readonly onRunPostCommand?: RunTopicPostCommand | undefined;
  readonly reply: TopicReplyDocumentBlock;
}) {
  const controller = useRef<AbortController | null>(null);
  const menu = useRef<HTMLDivElement | null>(null);
  const mounted = useRef(true);
  const [feedback, setFeedback] = useState<CommandFeedback | null>(null);

  useEffect(
    () => () => {
      mounted.current = false;
      controller.current?.abort();
    },
    [],
  );

  useEffect(() => {
    if (!menuRequest) return;
    const firstItem = menu.current?.querySelector<HTMLElement>(
      '[role="menuitem"]:not([aria-disabled="true"])',
    );
    (firstItem ?? menu.current)?.focus();
    const dismiss = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) onDismissMenu(false);
    };
    const dismissOnBlur = () => {
      onDismissMenu(false);
    };
    document.addEventListener('pointerdown', dismiss, true);
    window.addEventListener('blur', dismissOnBlur);
    return () => {
      document.removeEventListener('pointerdown', dismiss, true);
      window.removeEventListener('blur', dismissOnBlur);
    };
  }, [menuRequest, onDismissMenu]);

  const resolve = (commandId: TopicPostCommandId, source: TopicPostCommandSource) =>
    onResolvePostCommand?.(commandId, reply, source) ??
    defaultPostCommandAvailability(commandId, reply);
  const run = async (commandId: TopicPostCommandId, source: TopicPostCommandSource) => {
    if (feedback?.kind === 'pending' || !onRunPostCommand) return;
    const nextController = new AbortController();
    controller.current = nextController;
    setFeedback({
      commandId,
      kind: 'pending',
      message: commandId === 'copy-link' ? 'Copying post link' : 'Waiting for Linux DO',
    });
    const outcome = await onRunPostCommand({
      commandId,
      reply,
      signal: nextController.signal,
      source,
    });
    if (
      !mounted.current ||
      controller.current !== nextController ||
      nextController.signal.aborted
    ) {
      return;
    }
    controller.current = null;
    setFeedback({
      commandId,
      kind: outcome.kind === 'failed' ? 'failed' : 'success',
      message: outcome.kind === 'failed' ? outcome.message : 'Completed',
    });
    if (outcome.kind === 'success' && source === 'context-menu') {
      onDismissMenu(commandId !== 'reply');
    } else if (outcome.kind === 'failed' && source === 'context-menu') {
      window.requestAnimationFrame(() => {
        menu.current?.querySelector<HTMLElement>(`[data-post-command="${commandId}"]`)?.focus();
      });
    }
  };

  return (
    <>
      <div
        aria-label={`Post ${String(reply.floor.number)} actions`}
        className="docode-topic-code__action-strip"
        role="group"
      >
        <a
          aria-label={`Post ${String(reply.floor.number)} permalink`}
          className="docode-topic-code__permalink-action"
          href={reply.permalink}
        >
          {compact ? 'permalink' : 'Permalink'}
        </a>
        {postActionEntries(reply.capabilities).map(({ capability, id, label }) => (
          <NativePostAction
            action={id}
            availability={resolve(id, 'editor-action')}
            capability={capability}
            feedback={feedback?.commandId === id ? feedback : null}
            key={id}
            label={label}
            compact={compact}
            onRun={() => void run(id, 'editor-action')}
            runnable={onRunPostCommand !== undefined}
          />
        ))}
        <button
          aria-expanded={menuRequest !== null}
          aria-haspopup="menu"
          aria-label={`More actions for post ${String(reply.floor.number)}`}
          className="docode-topic-code__more-actions"
          data-docode-tooltip="More Actions"
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            onOpenMenu(rect.left, rect.bottom, event.currentTarget);
          }}
          type="button"
        >
          <Codicon name="ellipsis" />
        </button>
      </div>
      {menuRequest ? (
        <div
          aria-label={`Post ${String(reply.floor.number)} actions menu`}
          className="docode-workbench__tab-menu docode-topic-code__post-menu"
          data-pending={feedback?.kind === 'pending' ? 'true' : undefined}
          onContextMenu={(event) => {
            event.preventDefault();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              onDismissMenu(true);
              event.preventDefault();
              return;
            }
            if (event.key === 'Tab') {
              event.preventDefault();
              return;
            }
            movePostMenuFocus(event);
          }}
          ref={menu}
          role="menu"
          style={{
            left: clamp(menuRequest.left, POST_MENU_MARGIN, window.innerWidth - POST_MENU_WIDTH),
            top: clamp(menuRequest.top, POST_MENU_MARGIN, window.innerHeight - POST_MENU_HEIGHT),
          }}
          tabIndex={-1}
        >
          {POST_MENU_GROUPS.map((group, groupIndex) => (
            <div className="docode-workbench__tab-menu-group" key={group[0]} role="group">
              {groupIndex > 0 ? (
                <div className="docode-workbench__tab-menu-separator" role="separator" />
              ) : null}
              {group.map((commandId) => {
                const availability = resolve(commandId, 'context-menu');
                const disabled = feedback?.kind === 'pending' || !availability.available;
                return (
                  <button
                    aria-disabled={disabled}
                    className="docode-workbench__tab-menu-item"
                    data-docode-tooltip={
                      disabled
                        ? feedback?.kind === 'pending'
                          ? feedback.message
                          : availability.message
                        : undefined
                    }
                    data-post-command={commandId}
                    disabled={disabled}
                    key={commandId}
                    onClick={() => void run(commandId, 'context-menu')}
                    onPointerMove={(event) => {
                      event.currentTarget.focus();
                    }}
                    role="menuitem"
                    tabIndex={-1}
                    type="button"
                  >
                    {postMenuLabel(commandId, reply)}
                  </button>
                );
              })}
            </div>
          ))}
          {feedback?.kind === 'failed' ? (
            <div className="docode-workbench__tab-menu-error" role="alert">
              {feedback.message}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function NativePostAction({
  action,
  availability,
  capability,
  compact,
  feedback,
  label,
  onRun,
  runnable,
}: {
  readonly action: TopicPostCommandId;
  readonly availability: TopicPostCommandAvailability;
  readonly capability: TopicActionCapabilityModel;
  readonly compact: boolean;
  readonly feedback: CommandFeedback | null;
  readonly label: string;
  readonly onRun: () => void;
  readonly runnable: boolean;
}) {
  const active = capability.active;
  const pending = feedback?.kind === 'pending';
  const canRun = availability.available && runnable && !(action === 'bookmark' && active === true);
  const visibleLabel = postActionLabel(action, label, compact, active, canRun);
  const accessibleLabel = postActionLabel(action, label, false, active, canRun);
  const stateLabel = pending
    ? feedback.message
    : feedback?.kind === 'failed'
      ? feedback.message
      : active === true
        ? action === 'like'
          ? 'liked on Linux DO'
          : action === 'bookmark'
            ? 'bookmarked on Linux DO'
            : availability.message
        : action === 'copy-link'
          ? capabilityStateLabel(capability)
          : availability.message;
  const state = pending ? 'pending' : feedback?.kind === 'failed' ? 'error' : capability.state;
  const shortState = pending
    ? 'pending'
    : feedback?.kind === 'failed'
      ? 'failed'
      : shortPostActionState(capability, action, active);

  if (!canRun) {
    return (
      <span
        className="docode-topic-code__action-capability"
        data-action={action}
        data-active={active === true ? 'true' : undefined}
        data-docode-tooltip={`${accessibleLabel}: ${stateLabel}`}
        data-secondary-action="true"
        data-state={state}
      >
        <PostActionLabel label={visibleLabel} />
        <span className="docode-sr-only">: {stateLabel}</span>
        {shortState ? (
          <span aria-hidden="true" className="docode-topic-code__action-state">
            {shortState}
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <button
      aria-label={`${accessibleLabel}: ${stateLabel}`}
      aria-pressed={active ?? false}
      className="docode-topic-code__action-capability"
      data-action={action}
      data-active={active === true ? 'true' : undefined}
      data-docode-tooltip={`${accessibleLabel}: ${stateLabel}`}
      data-secondary-action="true"
      data-state={state}
      disabled={pending}
      onClick={onRun}
      type="button"
    >
      <PostActionLabel label={visibleLabel} />
      {shortState ? (
        <span aria-hidden="true" className="docode-topic-code__action-state">
          {shortState}
        </span>
      ) : null}
    </button>
  );
}

function PostActionLabel({ label }: { readonly label: string }) {
  const previousLabel = useRef(label);
  const [replacing, setReplacing] = useState(false);

  useEffect(() => {
    if (previousLabel.current === label) return;
    previousLabel.current = label;
    setReplacing(true);
    const reset = window.setTimeout(() => {
      setReplacing(false);
    }, 180);
    return () => {
      window.clearTimeout(reset);
    };
  }, [label]);

  return (
    <span
      className="docode-topic-code__action-label"
      data-replacing={replacing ? 'true' : undefined}
      key={label}
      onAnimationEnd={() => {
        setReplacing(false);
      }}
    >
      {label}
    </span>
  );
}

function movePostMenuFocus(event: KeyboardEvent<HTMLDivElement>): void {
  if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
  const items = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>(
      '[role="menuitem"]:not([aria-disabled="true"])',
    ),
  );
  if (items.length === 0) return;
  const currentIndex = items.indexOf(document.activeElement as HTMLElement);
  const targetIndex =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? items.length - 1
        : event.key === 'ArrowUp'
          ? (Math.max(currentIndex, 0) - 1 + items.length) % items.length
          : (currentIndex + 1) % items.length;
  items[targetIndex]?.focus();
  event.preventDefault();
}

function postMenuLabel(commandId: TopicPostCommandId, reply: TopicReplyDocumentBlock): string {
  switch (commandId) {
    case 'reply':
      return `Reply to Post ${String(reply.floor.number)}`;
    case 'like':
      return reply.capabilities.like.active ? 'Remove Like' : 'Like';
    case 'bookmark':
      return reply.capabilities.bookmark.active ? 'Bookmarked' : 'Bookmark';
    case 'copy-link':
      return 'Copy Post Link';
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(value, Math.max(minimum, maximum)));
}

function defaultPostCommandAvailability(
  commandId: TopicPostCommandId,
  reply: TopicReplyDocumentBlock,
): TopicPostCommandAvailability {
  if (commandId === 'like' || commandId === 'bookmark') {
    const capability = reply.capabilities[commandId];
    return {
      available: capability.state === 'available',
      message: capabilityStateLabel(capability),
    };
  }
  return {
    available: commandId === 'copy-link',
    message:
      commandId === 'copy-link'
        ? 'Copy the canonical Linux DO post link'
        : 'Reply is unavailable in the current context.',
  };
}

export function TopicLoadingBoundary({
  document,
  hasMore,
  loading,
  position,
  status,
}: {
  readonly document: ReadyTopicDetailDocument;
  readonly hasMore: boolean;
  readonly loading: boolean;
  readonly position: 'end' | 'start';
  readonly status: 'complete' | 'error' | 'idle' | 'loading';
}) {
  const message = loadingBoundaryMessage(document, hasMore, loading, position, status);
  // The workbench progress bar already reports pagination activity. Keeping a
  // second loading row in the document changes scroll height while a request is
  // in flight and makes the editor viewport jump when that temporary row exits.
  if (!message || message.state === 'loading') return null;
  return (
    <div
      className="docode-topic-code__loading-boundary"
      data-position={position}
      data-state={message.state}
    >
      <span aria-hidden="true" className="docode-topic-code__loading-gutter" />
      <div aria-live="polite" className="docode-topic-code__loading-message" role="status">
        <span aria-hidden="true" className="docode-topic-code__loading-indicator" />
        {message.label}
      </div>
    </div>
  );
}

function postActionEntries(capabilities: TopicReplyCapabilityModel) {
  return [
    { capability: capabilities.like, id: 'like', label: 'Like' },
    { capability: capabilities.bookmark, id: 'bookmark', label: 'Bookmark' },
    { capability: capabilities.copyLink, id: 'copy-link', label: 'Copy Link' },
  ] as const;
}

function capabilityStateLabel(capability: TopicActionCapabilityModel): string {
  switch (capability.state) {
    case 'available':
      return 'available in original Linux DO';
    case 'authentication-required':
      return 'sign in required on Linux DO';
    case 'disabled':
      return 'disabled by Linux DO';
    case 'unavailable':
      return capability.fallback === 'original-view'
        ? 'unavailable in DOCode; use original Linux DO'
        : 'unavailable';
  }
}

function shortCapabilityState(capability: TopicActionCapabilityModel): string {
  switch (capability.state) {
    case 'available':
      return 'available';
    case 'authentication-required':
      return 'sign in';
    case 'disabled':
      return 'disabled';
    case 'unavailable':
      return 'unavailable';
  }
}

function shortPostActionState(
  capability: TopicActionCapabilityModel,
  action: TopicPostCommandId,
  active: boolean | null,
): string {
  if (active === true) {
    if (action === 'like') return '';
    if (action === 'bookmark') return 'bookmarked';
  }
  return shortCapabilityState(capability);
}

function postActionLabel(
  action: TopicPostCommandId,
  label: string,
  compact: boolean,
  active: boolean | null,
  canRun: boolean,
): string {
  if (action === 'like' && active === true) {
    if (canRun) return compact ? 'unlike' : 'Unlike';
    return compact ? 'liked' : 'Liked';
  }
  return compact ? compactPostActionLabel(action) : label;
}

function compactPostActionLabel(action: TopicPostCommandId): string {
  return action === 'copy-link' ? 'copy' : action;
}

function loadingBoundaryMessage(
  document: ReadyTopicDetailDocument,
  hasMore: boolean,
  loading: boolean,
  position: 'end' | 'start',
  status: 'complete' | 'error' | 'idle' | 'loading',
): {
  readonly label: string;
  readonly state: 'available' | 'error' | 'loading' | 'unavailable';
} | null {
  const { containsRequestedPost, firstPostNumber, lastPostNumber, requestedPostNumber } =
    document.loadedWindow;
  if (firstPostNumber === null || lastPostNumber === null) return null;
  if (position === 'start') {
    if (firstPostNumber <= 1) return null;
    if (loading) return { label: 'Loading earlier replies…', state: 'loading' };
    if (status === 'error') {
      return {
        label: 'Earlier replies could not be loaded. Scroll away and back to retry.',
        state: 'error',
      };
    }
    return hasMore
      ? { label: 'Earlier replies available. Scroll to the top to load.', state: 'available' }
      : {
          label: `Loaded range starts at post ${String(firstPostNumber)}; earlier replies are unavailable.`,
          state: 'unavailable',
        };
  }
  if (!containsRequestedPost && requestedPostNumber !== null) {
    if (loading) {
      return {
        label: `Loading requested post ${String(requestedPostNumber)}…`,
        state: 'loading',
      };
    }
    return {
      label: `Requested post ${String(requestedPostNumber)} is not available in the loaded Linux DO content.`,
      state: 'unavailable',
    };
  }
  if (loading) return { label: 'Loading later replies…', state: 'loading' };
  if (status === 'error') {
    return {
      label: 'Later replies could not be loaded. Scroll away and back to retry.',
      state: 'error',
    };
  }
  return null;
}
