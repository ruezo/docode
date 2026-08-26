import { isLinuxDoComposerTarget } from '../linuxdo/capabilities';

export type VimNavigationAction =
  'first-post' | 'last-post' | 'next-post' | 'previous-post' | 'quick-open';

export interface VimNavigationState {
  readonly pendingFirstPostAt: number | null;
}

export interface VimNavigationResolution {
  readonly action: VimNavigationAction | null;
  readonly state: VimNavigationState;
}

interface InstallVimNavigationOptions {
  readonly document: Document;
  readonly enabled: () => boolean;
  readonly now?: () => number;
  readonly onAction: (action: VimNavigationAction) => void;
}

export const VIM_NAVIGATION_SEQUENCE_TIMEOUT = 1_000;

export const INITIAL_VIM_NAVIGATION_STATE: VimNavigationState = { pendingFirstPostAt: null };

export function installVimNavigation({
  document,
  enabled,
  now = () => Date.now(),
  onAction,
}: InstallVimNavigationOptions): () => void {
  let state = INITIAL_VIM_NAVIGATION_STATE;
  const onKeyDown = (event: KeyboardEvent) => {
    if (!enabled()) {
      state = INITIAL_VIM_NAVIGATION_STATE;
      return;
    }
    const resolution = resolveVimNavigation(event, state, now());
    state = resolution.state;
    if (resolution.action === null) return;
    event.preventDefault();
    event.stopPropagation();
    onAction(resolution.action);
  };
  document.addEventListener('keydown', onKeyDown, true);
  return () => {
    document.removeEventListener('keydown', onKeyDown, true);
  };
}

export function resolveVimNavigation(
  event: KeyboardEvent,
  state: VimNavigationState,
  timestamp: number,
): VimNavigationResolution {
  if (
    event.defaultPrevented ||
    event.isComposing ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    blocksVimNavigationTarget(event.target)
  ) {
    return { action: null, state: INITIAL_VIM_NAVIGATION_STATE };
  }
  const pendingFirstPost =
    state.pendingFirstPostAt !== null &&
    timestamp - state.pendingFirstPostAt <= VIM_NAVIGATION_SEQUENCE_TIMEOUT;
  switch (event.key) {
    case 'j':
      return { action: 'next-post', state: INITIAL_VIM_NAVIGATION_STATE };
    case 'k':
      return { action: 'previous-post', state: INITIAL_VIM_NAVIGATION_STATE };
    case 'g':
      if (event.repeat) return { action: null, state: INITIAL_VIM_NAVIGATION_STATE };
      if (pendingFirstPost) return { action: 'first-post', state: INITIAL_VIM_NAVIGATION_STATE };
      return { action: null, state: { pendingFirstPostAt: timestamp } };
    case 'G':
      if (event.repeat) return { action: null, state: INITIAL_VIM_NAVIGATION_STATE };
      return { action: 'last-post', state: INITIAL_VIM_NAVIGATION_STATE };
    case '/':
      if (event.repeat) return { action: null, state: INITIAL_VIM_NAVIGATION_STATE };
      return { action: 'quick-open', state: INITIAL_VIM_NAVIGATION_STATE };
    default:
      return { action: null, state: INITIAL_VIM_NAVIGATION_STATE };
  }
}

function blocksVimNavigationTarget(target: EventTarget | null): boolean {
  if (isLinuxDoComposerTarget(target)) return true;
  if (!(target instanceof Element)) return false;
  return (
    target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])') !==
    null
  );
}
