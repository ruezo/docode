import type { LinuxDoComposerFeedback } from '../../linuxdo/composerAdapter';
import type { CodiconName } from '../icons/codicon';
import type {
  TopicActionCapabilityModel,
  TopicInteractionCapabilityModel,
  TopicLoadedWindow,
} from '../../views/topic/topicDetailDocument';
import {
  getWorkbenchModeLabel,
  type WorkbenchMode,
  type WorkbenchPresentationMode,
} from './workbenchMode';
import type { WorkbenchSurfaceState } from './workbenchSurfaceState';
import type { WorkbenchViewContext } from './workbenchContext';

export interface WorkbenchStatusLink {
  readonly ariaLabel: string;
  readonly href: string;
  readonly icon: CodiconName;
  readonly label: string;
  readonly title: string;
}

export interface WorkbenchStatusMode {
  readonly active: WorkbenchPresentationMode;
  readonly ariaLabel: string;
  readonly description: string;
  readonly label: string;
  readonly next: WorkbenchPresentationMode | null;
  readonly pending: boolean;
  readonly title: string;
}

export interface WorkbenchStatusIndicator {
  readonly icon: CodiconName;
  readonly label: string;
  readonly spin: boolean;
  readonly title: string;
  readonly tone: 'error' | 'standard' | 'warning';
}

export interface WorkbenchStatusText {
  readonly label: string;
  readonly title: string;
}

export interface WorkbenchStatusTrust {
  readonly ariaLabel: string;
  readonly label: string;
  readonly title: string;
}

export interface WorkbenchStatusModel {
  readonly activity: WorkbenchStatusIndicator | null;
  readonly category: WorkbenchStatusLink | null;
  readonly cursor: WorkbenchStatusText | null;
  readonly encoding: WorkbenchStatusText | null;
  readonly floor: WorkbenchStatusLink | null;
  readonly mode: WorkbenchStatusMode | null;
  readonly route: WorkbenchStatusLink;
  readonly replies: WorkbenchStatusText | null;
  readonly state: WorkbenchSurfaceState['kind'];
  readonly trust: WorkbenchStatusTrust | null;
}

interface WorkbenchStatusTopic {
  readonly category: { readonly name: string; readonly url: string } | null;
  readonly currentPost: {
    readonly bookmark: TopicActionCapabilityModel;
    readonly like: TopicActionCapabilityModel;
    readonly number: number;
    readonly permalink: string;
  } | null;
  readonly interaction: TopicInteractionCapabilityModel;
  readonly loadedWindow: TopicLoadedWindow;
}

interface WorkbenchStatusInput {
  readonly activeMode: WorkbenchPresentationMode | null;
  readonly availableModes: readonly WorkbenchMode[];
  readonly composerFeedback: LinuxDoComposerFeedback;
  readonly context: WorkbenchViewContext;
  readonly layoutError?: string | null;
  readonly editor?: {
    readonly cursor: { readonly column: number; readonly lineNumber: number } | null;
    readonly loadedReplyCount: number;
  } | null;
  readonly modeError: string | null;
  readonly modePending: WorkbenchMode | null;
  readonly surfaceState: WorkbenchSurfaceState;
  readonly topicListPaginationError?: string | null;
  readonly topicPagination?: {
    readonly status: 'complete' | 'error' | 'idle' | 'loading';
  } | null;
  readonly topic: WorkbenchStatusTopic | null;
  readonly trustLevel?: number | null;
}

export function createWorkbenchStatusModel(input: WorkbenchStatusInput): WorkbenchStatusModel {
  const { context, topic } = input;
  return {
    activity: createActivity(input),
    category: topic?.category
      ? {
          ariaLabel: `Current category: ${topic.category.name}`,
          href: topic.category.url,
          icon: 'symbol-field',
          label: topic.category.name,
          title: `Open Linux DO category: ${topic.category.name}`,
        }
      : null,
    cursor: input.editor?.cursor
      ? {
          label: `Ln ${String(input.editor.cursor.lineNumber)}, Col ${String(input.editor.cursor.column)}`,
          title: `Virtual topic document position: line ${String(input.editor.cursor.lineNumber)}, column ${String(input.editor.cursor.column)}.`,
        }
      : null,
    encoding: input.editor
      ? {
          label: 'UTF-8',
          title: 'Linux DO topic text is presented as UTF-8.',
        }
      : null,
    floor: topic?.currentPost
      ? {
          ariaLabel: `Current post ${String(topic.currentPost.number)}`,
          href: topic.currentPost.permalink,
          icon: 'symbol-method',
          label: `Post ${String(topic.currentPost.number)}`,
          title: floorTitle(topic.currentPost.number, topic.loadedWindow),
        }
      : null,
    mode: createMode(input),
    replies: input.editor
      ? {
          label: `Replies ${String(input.editor.loadedReplyCount)}${input.topicPagination?.status === 'complete' ? ' · End' : ''}`,
          title:
            input.topicPagination?.status === 'complete'
              ? `${String(input.editor.loadedReplyCount)} replies are loaded. Linux DO reports that the end of this topic has been reached.`
              : `${String(input.editor.loadedReplyCount)} replies are loaded in the current Linux DO window.`,
        }
      : null,
    route: {
      ariaLabel: `Current view: ${context.statusLabel}`,
      href: context.route.href,
      icon: context.icon,
      label: context.statusLabel,
      title: `Current Linux DO route: ${context.canonicalPath}`,
    },
    state: input.surfaceState.kind,
    trust:
      typeof input.trustLevel === 'number'
        ? {
            ariaLabel: `Trust level ${String(input.trustLevel)}. Open trust level build progress.`,
            label: `TL${String(input.trustLevel)}`,
            title: `Linux DO trust level ${String(input.trustLevel)}. Activate to open the build progress panel.`,
          }
        : null,
  };
}

function createMode(input: WorkbenchStatusInput): WorkbenchStatusMode | null {
  if (!input.activeMode || input.availableModes.length === 0) return null;
  const modes: readonly WorkbenchPresentationMode[] = input.availableModes;
  const currentIndex = modes.indexOf(input.activeMode);
  const next =
    modes.length > 1 && currentIndex >= 0
      ? (modes[(currentIndex + 1) % modes.length] ?? null)
      : null;
  const activeLabel = getWorkbenchModeLabel(input.activeMode);
  const nextLabel = next ? getWorkbenchModeLabel(next) : null;
  const detail = nextLabel ? ` Activate to switch to ${nextLabel}.` : '';
  return {
    active: input.activeMode,
    ariaLabel: 'Change reading mode',
    description: `Current reading mode: ${activeLabel}.${detail}`,
    label: activeLabel,
    next,
    pending: input.modePending !== null,
    title: `Reading mode: ${activeLabel}.${detail}`,
  };
}

function createActivity(input: WorkbenchStatusInput): WorkbenchStatusIndicator | null {
  const surfaceActivity = createSurfaceActivity(input.surfaceState);
  if (surfaceActivity) return surfaceActivity;
  if (input.topicPagination?.status === 'loading') {
    return {
      ...indicator(
        'loading',
        'Loading replies',
        'Reading the next replies from Linux DO.',
        'standard',
      ),
      spin: true,
    };
  }
  if (input.topicPagination?.status === 'error') {
    return indicator(
      'warning',
      'More replies unavailable',
      'Linux DO did not return the next replies. Scroll near the end to retry or use the original site.',
      'warning',
    );
  }
  if (input.composerFeedback) return createComposerActivity(input.composerFeedback);
  if (input.modeError) {
    return indicator('error', 'Mode error', input.modeError, 'error');
  }
  if (input.layoutError) {
    return indicator('warning', 'Layout not saved', input.layoutError, 'warning');
  }
  if (input.topicListPaginationError) {
    return indicator(
      'warning',
      'More topics unavailable',
      input.topicListPaginationError,
      'warning',
    );
  }
  return input.topic ? createActionActivity(input.topic) : null;
}

function createSurfaceActivity(state: WorkbenchSurfaceState): WorkbenchStatusIndicator | null {
  switch (state.kind) {
    case 'ready':
      return null;
    case 'loading':
      return { ...indicator('loading', 'Loading', state.description, 'standard'), spin: true };
    case 'empty':
      return indicator('info', 'No topics', state.description, 'standard');
    case 'error':
      return indicator('error', 'Read error', state.description, 'error');
    case 'unsupported':
      return indicator('warning', 'Unsupported', state.description, 'warning');
  }
}

function createComposerActivity(
  feedback: Exclude<LinuxDoComposerFeedback, null>,
): WorkbenchStatusIndicator {
  switch (feedback.kind) {
    case 'opening':
      return { ...indicator('loading', 'Opening Reply', feedback.message, 'standard'), spin: true };
    case 'submitting':
      return {
        ...indicator('loading', 'Submitting Reply', feedback.message, 'standard'),
        spin: true,
      };
    case 'submitted':
      return indicator('check', 'Reply submitted', feedback.message, 'standard');
    case 'error':
      return indicator('error', 'Reply failed', feedback.message, 'error');
  }
}

function createActionActivity(topic: WorkbenchStatusTopic): WorkbenchStatusIndicator {
  const { currentPost, interaction } = topic;
  if (interaction.composer.state === 'open' || interaction.composer.state === 'draft') {
    const label = interaction.composer.dirty ? 'Reply draft' : 'Reply open';
    const title = interaction.composer.dirty
      ? 'The native Linux DO Reply composer contains an unsent draft.'
      : 'The native Linux DO Reply composer is open.';
    return indicator('edit', label, title, 'standard');
  }
  if (interaction.composer.state === 'saving') {
    return {
      ...indicator(
        'loading',
        'Reply saving',
        'The native Linux DO Reply composer is saving.',
        'standard',
      ),
      spin: true,
    };
  }

  const capabilityDetails = [
    currentPost ? `Like: ${capabilityLabel(currentPost.like)}` : null,
    currentPost ? `Bookmark: ${capabilityLabel(currentPost.bookmark)}` : null,
    `Reply: ${capabilityLabel(interaction.reply)}`,
  ].filter((detail): detail is string => detail !== null);
  const title = capabilityDetails.join(' · ');

  if (interaction.currentUserState === 'logged-out') {
    return indicator(
      'warning',
      'Sign in for actions',
      `${title}. Linux DO sign-in is required for account actions.`,
      'warning',
    );
  }
  const actionCapabilities = [
    ...(currentPost ? [currentPost.like, currentPost.bookmark] : []),
    interaction.reply,
  ];
  const allAvailable =
    interaction.currentUserState === 'logged-in' &&
    actionCapabilities.length > 0 &&
    actionCapabilities.every(({ state }) => state === 'available');
  return allAvailable
    ? indicator('check', 'Actions ready', title, 'standard')
    : indicator(
        'warning',
        'Actions limited',
        `${title}. Use the original Linux DO view when a native action is unavailable.`,
        'warning',
      );
}

function indicator(
  icon: CodiconName,
  label: string,
  title: string,
  tone: WorkbenchStatusIndicator['tone'],
): WorkbenchStatusIndicator {
  return { icon, label, spin: false, title, tone };
}

function capabilityLabel(capability: TopicActionCapabilityModel): string {
  switch (capability.state) {
    case 'available':
      return capability.active === true ? 'active' : 'available';
    case 'authentication-required':
      return 'sign-in required';
    case 'disabled':
      return 'disabled by Linux DO';
    case 'unavailable':
      return 'unavailable';
  }
}

function floorTitle(postNumber: number, loadedWindow: TopicLoadedWindow): string {
  const first = loadedWindow.firstPostNumber;
  const last = loadedWindow.lastPostNumber;
  const range =
    first !== null && last !== null
      ? ` Loaded Linux DO window: posts ${String(first)}–${String(last)}.`
      : '';
  return `Current visible post: ${String(postNumber)}.${range}`;
}
