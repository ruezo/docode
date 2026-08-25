import type { LinuxDoNavigationOutcome } from '../linuxdo/navigationAdapter';
import type {
  LinuxDoComposerOpenOutcome,
  LinuxDoComposerOpenRequest,
  LinuxDoComposerSubmitOutcome,
  LinuxDoComposerSubmitRequest,
} from '../linuxdo/composerAdapter';
import type { LinuxDoSimpleTopicListView } from '../linuxdo/explorerTopicLoader';
import type {
  LinuxDoPostAction,
  LinuxDoPostActionOutcome,
  LinuxDoPostActionRequest,
} from '../linuxdo/postActionAdapter';
import { recognizeLinuxDoRoute, type LinuxDoRoute } from '../linuxdo/routes';
import type { LinuxDoSearchResult, LinuxDoSearchOutcome } from '../linuxdo/searchAdapter';
import type { TabActionId, TabActionRequest } from '../navigation/tabActions';
import type { WorkbenchMode, WorkbenchPresentationMode } from '../ui/workbench/workbenchMode';
import type {
  TopicInteractionCapabilityModel,
  TopicReplyCapabilityModel,
} from '../views/topic/topicDetailDocument';
import type { WorkbenchViewContext } from '../ui/workbench/workbenchContext';
import type { TopicListDocument } from '../views/topicList/topicListDocument';
import { parseCommandInput } from './commandParser';
import { CommandRegistry } from './commandRegistry';
import {
  availableCommand,
  invalidCommandArguments,
  validCommandArguments,
  type CommandDispatchResult,
  type CommandEntryPoint,
  type CommandHandlerResult,
  type CommandMetadata,
} from './commandTypes';

interface ReplyCommandArguments {
  readonly content: string | null;
  readonly floor: number | null;
}

type SearchCommandArguments =
  | { readonly kind: 'clear' }
  | { readonly kind: 'query'; readonly query: string }
  | { readonly kind: 'quick-open' };

export type PanelCommandAction = 'hide' | 'outline' | 'show' | 'terminal' | 'toggle';
export const CLEAR_TERMINAL_COMMAND_ID = 'docode.terminal.clear';
export const COMMAND_PALETTE_COMMAND_ID = 'docode.command-palette.show';
export const QUICK_OPEN_COMMAND_ID = 'docode.quick-open.show';
export const TOGGLE_TERMINAL_COMMAND_ID = 'docode.terminal.toggle';

export const WORKBENCH_COMMAND_IDS = {
  clear: CLEAR_TERMINAL_COMMAND_ID,
  copyPostLink: 'linuxdo.post.copy-link',
  doctor: 'docode.diagnostics.doctor',
  commandPalette: COMMAND_PALETTE_COMMAND_ID,
  goto: 'linuxdo.navigation.goto-post',
  help: 'docode.help',
  hot: 'linuxdo.navigation.hot',
  like: 'linuxdo.post.like',
  latest: 'linuxdo.navigation.latest',
  list: 'linuxdo.list.read',
  mode: 'docode.mode.set',
  open: 'linuxdo.navigation.open-topic',
  panel: 'docode.panel.control',
  bookmark: 'linuxdo.post.bookmark',
  quickOpen: QUICK_OPEN_COMMAND_ID,
  reply: 'linuxdo.composer.reply',
  search: 'linuxdo.search.open',
  new: 'linuxdo.navigation.new',
  top: 'linuxdo.navigation.top',
  unread: 'linuxdo.navigation.unread',
  toggleTerminal: TOGGLE_TERMINAL_COMMAND_ID,
} as const;

export const TAB_ACTION_COMMAND_IDS: Readonly<Record<TabActionId, string>> = {
  close: 'docode.tab.close',
  'close-others': 'docode.tab.close-others',
  'close-right': 'docode.tab.close-right',
  'copy-topic-link': 'docode.tab.copy-topic-link',
  'open-original-view': 'docode.tab.open-original-view',
};

export interface WorkbenchCommandContext {
  readonly currentPost: {
    readonly capabilities: TopicReplyCapabilityModel;
    readonly id: number;
    readonly number: number;
    readonly permalink: string;
  } | null;
  readonly posts: readonly {
    readonly capabilities: TopicReplyCapabilityModel;
    readonly id: number;
    readonly number: number;
    readonly permalink: string;
  }[];
  readonly tabTarget: {
    readonly availableActions: readonly TabActionId[];
    readonly viewId: string;
  } | null;
  readonly topicInteraction: TopicInteractionCapabilityModel | null;
  readonly topicReady: boolean;
  readonly availableReadingModes: readonly WorkbenchMode[];
  readonly view: WorkbenchViewContext;
}

export interface WorkbenchCommandActions {
  readonly copyText: (text: string, signal: AbortSignal) => Promise<boolean>;
  readonly readDiagnostics: () => string;
  readonly navigate: (
    route: LinuxDoRoute,
    expectedGeneration: number,
    signal: AbortSignal,
  ) => Promise<LinuxDoNavigationOutcome>;
  readonly openComposer: (
    request: LinuxDoComposerOpenRequest,
  ) => Promise<LinuxDoComposerOpenOutcome>;
  readonly submitReply: (
    request: LinuxDoComposerSubmitRequest,
  ) => Promise<LinuxDoComposerSubmitOutcome>;
  readonly loadTopicList: (
    view: LinuxDoSimpleTopicListView,
    signal: AbortSignal,
  ) => Promise<TopicListDocument | null>;
  readonly runPostAction: (request: LinuxDoPostActionRequest) => Promise<LinuxDoPostActionOutcome>;
  readonly setPanel: (action: PanelCommandAction) => boolean;
  readonly restoreOriginalView: (signal: AbortSignal) => Promise<boolean>;
  readonly runTabAction: (request: TabActionRequest) => Promise<void>;
  readonly setReadingMode: (mode: WorkbenchPresentationMode) => boolean;
  readonly searchTopics: (query: string, signal: AbortSignal) => Promise<LinuxDoSearchOutcome>;
  readonly setSearchSession: (
    session: { readonly items: readonly LinuxDoSearchResult[]; readonly query: string } | null,
  ) => boolean;
  readonly showCommandPalette: () => boolean;
  readonly showQuickOpen: () => boolean;
  readonly toggleTerminal: () => boolean;
}

const TERMINAL_AND_PALETTE: readonly [CommandEntryPoint, ...CommandEntryPoint[]] = [
  'terminal',
  'palette',
];

export function createWorkbenchCommandRegistry(
  actions: WorkbenchCommandActions,
): CommandRegistry<WorkbenchCommandContext> {
  const registry = new CommandRegistry<WorkbenchCommandContext>();

  registry.register<undefined>({
    entryPoints: TERMINAL_AND_PALETTE,
    execute: ({ context, source }) => ({
      output: {
        kind: 'lines',
        lines: [
          'Available commands:',
          ...getAvailableWorkbenchCommands(registry, context, source).map(
            ({ help, name, title }) => `${help ?? name} — ${title}`,
          ),
        ],
      },
      status: 'success',
    }),
    help: 'help',
    id: WORKBENCH_COMMAND_IDS.help,
    isAvailable: supportedContext,
    name: 'help',
    title: 'List available commands',
    validateArguments: noArguments,
  });

  registry.register<undefined>({
    entryPoints: ['terminal'],
    execute: ({ context }) => {
      const documentElement = globalThis.document.documentElement;
      return {
        output: {
          kind: 'lines',
          lines: [
            ...actions.readDiagnostics().split('\n'),
            `ui composer=${context.topicInteraction?.composer.state ?? 'none'} reply=${context.topicInteraction?.reply.state ?? 'none'}`,
            `ui render=${documentElement.getAttribute('data-docode-render-revision') ?? '-'} observer=${documentElement.getAttribute('data-docode-observer-roots') ?? 'off'}/${documentElement.getAttribute('data-docode-observer-hits') ?? '0'}`,
          ],
        },
        status: 'success',
      };
    },
    help: 'doctor',
    id: WORKBENCH_COMMAND_IDS.doctor,
    isAvailable: supportedContext,
    name: 'doctor',
    title: 'Print DOCode capability diagnostics',
    validateArguments: noArguments,
  });

  registry.register<undefined>({
    entryPoints: ['terminal'],
    execute: () => ({ status: 'success' }),
    help: 'clear',
    id: WORKBENCH_COMMAND_IDS.clear,
    isAvailable: supportedContext,
    name: 'clear',
    title: 'Clear terminal output',
    validateArguments: noArguments,
  });

  registry.register<PanelCommandAction>({
    entryPoints: ['terminal', 'palette'],
    execute: ({ arguments: action }) =>
      actions.setPanel(action)
        ? success(`Bottom panel: ${panelResultLabel(action)}.`)
        : unavailable('That panel view is unavailable in the current context.'),
    help: 'panel <show|hide|toggle|outline|terminal>',
    id: WORKBENCH_COMMAND_IDS.panel,
    isAvailable: supportedContext,
    name: 'panel',
    title: 'Control the bottom panel',
    validateArguments: (arguments_) =>
      oneOf<PanelCommandAction>(arguments_, ['show', 'hide', 'toggle', 'outline', 'terminal']),
  });

  registry.register<undefined>({
    entryPoints: ['palette', 'keybinding', 'editor-action'],
    execute: () =>
      actions.showQuickOpen()
        ? success('Quick Open shown.')
        : unavailable('Quick Open is unavailable in the current context.'),
    id: WORKBENCH_COMMAND_IDS.quickOpen,
    isAvailable: supportedContext,
    name: 'quick-open',
    title: 'Show Quick Open',
    validateArguments: noArguments,
  });

  registry.register<undefined>({
    entryPoints: ['keybinding', 'editor-action'],
    execute: () =>
      actions.showCommandPalette()
        ? success('Command Palette shown.')
        : unavailable('Command Palette is unavailable in the current context.'),
    id: WORKBENCH_COMMAND_IDS.commandPalette,
    isAvailable: supportedContext,
    name: 'command-palette',
    title: 'Show Command Palette',
    validateArguments: noArguments,
  });

  registry.register<undefined>({
    entryPoints: ['keybinding'],
    execute: () =>
      actions.toggleTerminal()
        ? success('Terminal toggled.')
        : unavailable('Terminal is unavailable in the current context.'),
    id: WORKBENCH_COMMAND_IDS.toggleTerminal,
    isAvailable: supportedContext,
    name: 'terminal-toggle',
    title: 'Toggle Terminal',
    validateArguments: noArguments,
  });

  registry.register<WorkbenchMode>({
    entryPoints: ['terminal', 'palette', 'status-bar'],
    execute: ({ arguments: mode, context }) => {
      if (!context.availableReadingModes.includes(mode)) {
        return unavailable(`${modeLabel(mode)} mode is unavailable in the current view.`);
      }
      if (!actions.setReadingMode(mode)) {
        return unavailable('Reading mode is unavailable in the current view.');
      }
      return success(`Reading mode: ${modeLabel(mode)}.`);
    },
    help: 'mode <code|doc>',
    id: WORKBENCH_COMMAND_IDS.mode,
    isAvailable: readingModeContext,
    name: 'mode',
    title: 'Set the reading mode',
    validateArguments: readingModeArguments,
  });

  registerPostAction(registry, actions, 'like', {
    help: 'like [floor]',
    id: WORKBENCH_COMMAND_IDS.like,
    name: 'like',
    title: 'Linux DO: Toggle Like on Current Post',
  });
  registerPostAction(registry, actions, 'bookmark', {
    help: 'bookmark [floor]',
    id: WORKBENCH_COMMAND_IDS.bookmark,
    name: 'bookmark',
    title: 'Linux DO: Bookmark Current Post',
  });

  registry.register<undefined>({
    entryPoints: ['context-menu', 'editor-action'],
    execute: async ({ context, signal }) => {
      const post = context.currentPost;
      if (!post) return unavailable('A loaded post is required to copy its link.');
      return (await actions.copyText(post.permalink, signal))
        ? success(`Copied post ${String(post.number)} link.`)
        : failure('native-action-failed', 'The post link could not be copied.', true);
    },
    id: WORKBENCH_COMMAND_IDS.copyPostLink,
    isAvailable: copyPostLinkAvailability,
    name: 'copy-post-link',
    title: 'Linux DO: Copy Post Link',
    validateArguments: noArguments,
  });

  registry.register<ReplyCommandArguments>({
    entryPoints: ['terminal', 'palette', 'context-menu', 'editor-action'],
    execute: async ({ arguments: reply, context, signal }) => {
      const request = {
        expectedGeneration: context.view.generation,
        ...(reply.floor === null ? {} : { postNumber: reply.floor }),
        signal,
      };
      if (reply.content === null) {
        return composerResult(await actions.openComposer(request));
      }
      return composerSubmitResult(
        await actions.submitReply({ ...request, content: reply.content }),
      );
    },
    help: 'reply [floor] [content]',
    id: WORKBENCH_COMMAND_IDS.reply,
    isAvailable: composerAvailability,
    name: 'reply',
    title: 'Linux DO: Open or submit a native reply',
    validateArguments: replyArguments,
  });

  registerTabAction(registry, actions, 'close', 'Close');
  registerTabAction(registry, actions, 'close-others', 'Close Others');
  registerTabAction(registry, actions, 'close-right', 'Close to the Right');
  registerTabAction(registry, actions, 'copy-topic-link', 'Copy Topic Link');
  registerTabAction(registry, actions, 'open-original-view', 'Open Original View');

  registerStaticNavigation(registry, actions, {
    help: 'latest',
    id: WORKBENCH_COMMAND_IDS.latest,
    name: 'latest',
    route: recognizeLinuxDoRoute('https://linux.do/latest'),
    successLabel: 'latest topics',
    title: 'Open latest topics',
  });

  registry.register<LinuxDoSimpleTopicListView>({
    entryPoints: TERMINAL_AND_PALETTE,
    execute: async ({ arguments: view, signal }) => {
      const document = await actions.loadTopicList(view, signal);
      if (signal.aborted) return failure('aborted', 'Command was cancelled.', true);
      if (document?.state !== 'ready') {
        return unavailable(`Linux DO ${view} topics could not be read safely.`);
      }
      return {
        output: { kind: 'lines', lines: formatTopicList(document) },
        status: 'success',
      };
    },
    help: 'ls <latest|news|new|unread|top|hot>',
    id: WORKBENCH_COMMAND_IDS.list,
    isAvailable: supportedContext,
    name: 'ls',
    title: 'List Linux DO topics',
    validateArguments: topicListView,
  });

  registry.register<SearchCommandArguments>({
    entryPoints: TERMINAL_AND_PALETTE,
    execute: async ({ arguments: search, signal }) => {
      if (search.kind === 'quick-open') {
        return actions.showQuickOpen()
          ? success('Linux DO search shown in Quick Open.')
          : unavailable('Linux DO search is unavailable in the current context.');
      }
      if (search.kind === 'clear') {
        return actions.setSearchSession(null)
          ? success('Closed the Explorer SEARCH session.')
          : unavailable('The Explorer SEARCH session could not be closed.');
      }
      const outcome = await actions.searchTopics(search.query, signal);
      if (outcome.kind === 'aborted') return failure('aborted', 'Search was cancelled.', true);
      if (outcome.kind === 'error') {
        return failure('native-action-failed', outcome.message, outcome.retryable);
      }
      actions.setSearchSession({ items: outcome.items, query: outcome.query });
      return {
        output: {
          kind: 'lines',
          lines:
            outcome.items.length === 0
              ? [`No Linux DO results for “${outcome.query}”.`]
              : outcome.items.map(
                  ({ description, label, route }, index) =>
                    `${String(index + 1).padStart(2, ' ')}  ${label}  ${description}  ${route.pathname}`,
                ),
        },
        status: 'success',
      };
    },
    help: 'search [query|--clear]',
    id: WORKBENCH_COMMAND_IDS.search,
    isAvailable: supportedContext,
    name: 'search',
    title: 'Search Linux DO',
    validateArguments: searchArguments,
  });
  registerStaticNavigation(registry, actions, {
    help: 'hot',
    id: WORKBENCH_COMMAND_IDS.hot,
    name: 'hot',
    route: recognizeLinuxDoRoute('https://linux.do/hot'),
    successLabel: 'hot topics',
    title: 'Open hot topics',
  });
  registerStaticNavigation(registry, actions, {
    help: 'new',
    id: WORKBENCH_COMMAND_IDS.new,
    name: 'new',
    route: recognizeLinuxDoRoute('https://linux.do/new'),
    successLabel: 'new topics',
    title: 'Open new topics',
  });
  registerStaticNavigation(registry, actions, {
    help: 'unread',
    id: WORKBENCH_COMMAND_IDS.unread,
    name: 'unread',
    route: recognizeLinuxDoRoute('https://linux.do/unread'),
    successLabel: 'unread topics',
    title: 'Open unread topics',
  });
  registerStaticNavigation(registry, actions, {
    help: 'top',
    id: WORKBENCH_COMMAND_IDS.top,
    name: 'top',
    route: recognizeLinuxDoRoute('https://linux.do/top'),
    successLabel: 'top topics',
    title: 'Open top topics',
  });

  registry.register({
    entryPoints: TERMINAL_AND_PALETTE,
    execute: ({ arguments: target, context, signal }) =>
      navigate(actions, target, context, signal, `topic ${String(target.topicId)}`),
    help: 'open </t/slug/id[/floor]>',
    id: WORKBENCH_COMMAND_IDS.open,
    isAvailable: supportedContext,
    name: 'open',
    title: 'Open a Linux DO topic URL',
    validateArguments: validateTopicRoute,
  });

  registry.register({
    entryPoints: TERMINAL_AND_PALETTE,
    execute: ({ arguments: floor, context, signal }) => {
      const current = context.view.route;
      if (current.kind !== 'topic') {
        return unavailable('A topic must be active to navigate to a post.');
      }
      const target = recognizeLinuxDoRoute(
        `https://linux.do/t/${encodeURIComponent(current.topicSlug)}/${String(current.topicId)}/${String(floor)}`,
      );
      return navigate(actions, target, context, signal, `post ${String(floor)}`);
    },
    help: 'goto <floor>',
    id: WORKBENCH_COMMAND_IDS.goto,
    isAvailable: topicReadyContext,
    name: 'goto',
    title: 'Open a post floor in the current topic',
    validateArguments: positiveInteger,
  });

  return registry;
}

export function getAvailableWorkbenchCommands(
  registry: CommandRegistry<WorkbenchCommandContext>,
  context: WorkbenchCommandContext,
  source: CommandEntryPoint,
): readonly CommandMetadata[] {
  return registry.commands.filter(
    ({ id }) => registry.getAvailability(id, context, source).available,
  );
}

export function getWorkbenchTerminalHistoryEntry(
  input: string,
  result: CommandDispatchResult,
): string | null {
  if (result.status !== 'success') return null;
  const parsed = parseCommandInput(input);
  if (parsed.status !== 'parsed') return null;

  switch (result.commandId) {
    case WORKBENCH_COMMAND_IDS.help:
      return parsed.commandName === 'help' && parsed.arguments.length === 0 ? 'help' : null;
    case WORKBENCH_COMMAND_IDS.clear:
      return parsed.commandName === 'clear' && parsed.arguments.length === 0 ? 'clear' : null;
    case WORKBENCH_COMMAND_IDS.latest:
      return parsed.commandName === 'latest' && parsed.arguments.length === 0 ? 'latest' : null;
    case WORKBENCH_COMMAND_IDS.hot:
      return parsed.commandName === 'hot' && parsed.arguments.length === 0 ? 'hot' : null;
    case WORKBENCH_COMMAND_IDS.new:
      return parsed.commandName === 'new' && parsed.arguments.length === 0 ? 'new' : null;
    case WORKBENCH_COMMAND_IDS.top:
      return parsed.commandName === 'top' && parsed.arguments.length === 0 ? 'top' : null;
    case WORKBENCH_COMMAND_IDS.unread:
      return parsed.commandName === 'unread' && parsed.arguments.length === 0 ? 'unread' : null;
    case WORKBENCH_COMMAND_IDS.list: {
      if (parsed.commandName !== 'ls') return null;
      const validation = topicListView(parsed.arguments);
      return validation.valid ? `ls ${validation.value}` : null;
    }
    case WORKBENCH_COMMAND_IDS.like:
      return historyOptionalFloor(parsed.commandName, parsed.arguments, 'like');
    case WORKBENCH_COMMAND_IDS.bookmark:
      return historyOptionalFloor(parsed.commandName, parsed.arguments, 'bookmark');
    case WORKBENCH_COMMAND_IDS.reply:
      return parsed.commandName === 'reply' && replyArguments(parsed.arguments).valid
        ? input.trim()
        : null;
    case WORKBENCH_COMMAND_IDS.search: {
      if (parsed.commandName !== 'search') return null;
      const validation = searchArguments(parsed.arguments);
      if (!validation.valid) return null;
      if (validation.value.kind === 'quick-open') return 'search';
      if (validation.value.kind === 'clear') return 'search --clear';
      return `search ${validation.value.query}`;
    }
    case WORKBENCH_COMMAND_IDS.panel: {
      if (parsed.commandName !== 'panel') return null;
      const validation = oneOf<PanelCommandAction>(parsed.arguments, [
        'show',
        'hide',
        'toggle',
        'outline',
        'terminal',
      ]);
      return validation.valid ? `panel ${validation.value}` : null;
    }
    case WORKBENCH_COMMAND_IDS.mode: {
      if (parsed.commandName !== 'mode') return null;
      const validation = readingModeArguments(parsed.arguments);
      return validation.valid ? `mode ${validation.value}` : null;
    }
    case WORKBENCH_COMMAND_IDS.goto: {
      if (parsed.commandName !== 'goto') return null;
      const validation = positiveInteger(parsed.arguments);
      return validation.valid ? `goto ${String(validation.value)}` : null;
    }
    case WORKBENCH_COMMAND_IDS.open: {
      if (parsed.commandName !== 'open') return null;
      const validation = validateTopicRoute(parsed.arguments);
      return validation.valid ? `open ${validation.value.pathname}` : null;
    }
    default:
      return null;
  }
}

function registerPostAction(
  registry: CommandRegistry<WorkbenchCommandContext>,
  actions: WorkbenchCommandActions,
  action: LinuxDoPostAction,
  command: {
    readonly help: string;
    readonly id: string;
    readonly name: string;
    readonly title: string;
  },
): void {
  registry.register<number | null>({
    entryPoints: ['terminal', 'palette', 'context-menu', 'editor-action'],
    execute: async ({ arguments: floor, context, signal }) => {
      const post =
        floor === null
          ? context.currentPost
          : (context.posts.find(({ number }) => number === floor) ?? null);
      if (!post) {
        return unavailable(
          floor === null
            ? 'A loaded current post is required for this action.'
            : `Post ${String(floor)} is not loaded in the current topic.`,
        );
      }
      const capability = post.capabilities[action];
      if (capability.state !== 'available') return postCapabilityFailure(capability.state, action);
      return postActionResult(
        await actions.runPostAction({
          action,
          expectedGeneration: context.view.generation,
          postId: post.id,
          postNumber: post.number,
          signal,
        }),
        post.number,
      );
    },
    help: command.help,
    id: command.id,
    isAvailable: (context) => postActionAvailability(context, action),
    name: command.name,
    title: command.title,
    validateArguments: optionalPositiveInteger,
  });
}

function registerTabAction(
  registry: CommandRegistry<WorkbenchCommandContext>,
  actions: WorkbenchCommandActions,
  action: TabActionId,
  title: string,
): void {
  registry.register<undefined>({
    entryPoints: ['context-menu', 'editor-action'],
    execute: async ({ context }) => {
      const target = context.tabTarget;
      if (!target) return unavailable('A valid editor tab is required for this action.');
      await actions.runTabAction({ id: action, viewId: target.viewId });
      return success(`${title} completed.`);
    },
    id: TAB_ACTION_COMMAND_IDS[action],
    isAvailable: (context) => tabActionAvailability(context, action),
    name: `tab-${action}`,
    title,
    validateArguments: noArguments,
  });
}

function postActionAvailability(context: WorkbenchCommandContext, action: LinuxDoPostAction) {
  if (
    context.view.route.kind !== 'topic' ||
    !context.topicReady ||
    (!context.currentPost && context.posts.length === 0)
  ) {
    return {
      available: false as const,
      code: 'unavailable' as const,
      message: 'A loaded post is required for this action.',
      retryable: true,
    };
  }
  const capabilities = [
    ...(context.currentPost ? [context.currentPost.capabilities[action]] : []),
    ...context.posts.map((post) => post.capabilities[action]),
  ];
  if (capabilities.some(({ state }) => state === 'available')) return availableCommand();
  const capability = capabilities[0];
  if (!capability) {
    return {
      available: false as const,
      code: 'unavailable' as const,
      message: 'A loaded post is required for this action.',
      retryable: true,
    };
  }
  switch (capability.state) {
    case 'authentication-required':
      return {
        available: false as const,
        code: 'authentication-required' as const,
        message: 'Sign in to Linux DO to use this action.',
        retryable: false,
      };
    case 'disabled':
      return {
        available: false as const,
        code: 'compatibility-error' as const,
        message: 'Linux DO has disabled this action for the current post.',
        retryable: false,
      };
    case 'unavailable':
      return {
        available: false as const,
        code: 'compatibility-error' as const,
        message: 'Linux DO did not expose this action for the current post.',
        retryable: true,
      };
    case 'available':
      return availableCommand();
  }
}

function copyPostLinkAvailability(context: WorkbenchCommandContext) {
  return context.view.route.kind === 'topic' && context.topicReady && context.currentPost
    ? availableCommand()
    : {
        available: false as const,
        code: 'unavailable' as const,
        message: 'A loaded post is required to copy its link.',
        retryable: true,
      };
}

function tabActionAvailability(context: WorkbenchCommandContext, action: TabActionId) {
  return context.tabTarget?.availableActions.includes(action)
    ? availableCommand()
    : {
        available: false as const,
        code: 'unavailable' as const,
        message: 'That tab action is unavailable in the current context.',
        retryable: true,
      };
}

function postActionResult(
  outcome: LinuxDoPostActionOutcome,
  postNumber: number,
): CommandHandlerResult {
  if (outcome.kind === 'confirmed') {
    if (outcome.action === 'bookmark') return success(`Bookmarked post ${String(postNumber)}.`);
    return success(
      outcome.active
        ? `Liked post ${String(postNumber)}.`
        : `Removed Like from post ${String(postNumber)}.`,
    );
  }
  if (outcome.kind === 'unchanged') {
    return success(`Post ${String(postNumber)} is already bookmarked.`);
  }
  const code =
    outcome.code === 'aborted'
      ? 'aborted'
      : outcome.code === 'stale-route'
        ? 'stale'
        : outcome.code === 'authentication-required'
          ? 'unavailable'
          : 'native-action-failed';
  return failure(code, outcome.message, outcome.retryable);
}

function postCapabilityFailure(
  state: TopicReplyCapabilityModel[LinuxDoPostAction]['state'],
  action: LinuxDoPostAction,
): CommandHandlerResult {
  switch (state) {
    case 'authentication-required':
      return failure('unavailable', `Sign in to Linux DO to ${action} this post.`, false);
    case 'disabled':
      return failure(
        'unavailable',
        `Linux DO has disabled ${action} for the selected post.`,
        false,
      );
    case 'unavailable':
      return failure(
        'unavailable',
        `Linux DO did not expose ${action} for the selected post.`,
        true,
      );
    case 'available':
      return failure('unavailable', `Linux DO ${action} is unavailable right now.`, true);
  }
}

function composerAvailability(context: WorkbenchCommandContext) {
  if (context.view.route.kind !== 'topic' || !context.topicReady || !context.topicInteraction) {
    return {
      available: false as const,
      code: 'unavailable' as const,
      message: 'A ready topic is required to open the Reply composer.',
      retryable: true,
    };
  }
  const { composer, reply } = context.topicInteraction;
  if (composer.state === 'open' || composer.state === 'draft') return availableCommand();
  if (composer.state === 'saving' || reply.state === 'disabled') {
    return {
      available: false as const,
      code: 'compatibility-error' as const,
      message: 'Linux DO is not accepting another Reply action right now.',
      retryable: false,
    };
  }
  if (composer.state === 'authentication-required' || reply.state === 'authentication-required') {
    return {
      available: false as const,
      code: 'authentication-required' as const,
      message: 'Sign in to Linux DO to reply to this topic.',
      retryable: false,
    };
  }
  return composer.state === 'closed' && reply.state === 'available'
    ? availableCommand()
    : {
        available: false as const,
        code: 'compatibility-error' as const,
        message: 'Linux DO did not expose a compatible Reply composer.',
        retryable: true,
      };
}

function composerResult(outcome: LinuxDoComposerOpenOutcome): CommandHandlerResult {
  if (outcome.kind !== 'failed') {
    return success(
      outcome.kind === 'opened'
        ? 'Opened the native Linux DO Reply composer.'
        : 'Focused the native Linux DO Reply composer.',
    );
  }
  const code =
    outcome.code === 'aborted'
      ? 'aborted'
      : outcome.code === 'stale-route'
        ? 'stale'
        : outcome.code === 'authentication-required'
          ? 'unavailable'
          : 'native-action-failed';
  return failure(code, outcome.message, outcome.retryable);
}

function composerSubmitResult(outcome: LinuxDoComposerSubmitOutcome): CommandHandlerResult {
  if (outcome.kind === 'submitted') {
    return success(
      outcome.postNumber === null
        ? 'Submitted a native Linux DO topic reply.'
        : `Submitted a native reply to post ${String(outcome.postNumber)}.`,
    );
  }
  const code =
    outcome.code === 'aborted'
      ? 'aborted'
      : outcome.code === 'stale-route'
        ? 'stale'
        : outcome.code === 'authentication-required'
          ? 'unavailable'
          : outcome.code === 'invalid-content'
            ? 'user-input-error'
            : 'native-action-failed';
  return failure(code, outcome.message, outcome.retryable);
}

function registerStaticNavigation(
  registry: CommandRegistry<WorkbenchCommandContext>,
  actions: WorkbenchCommandActions,
  command: {
    readonly help: string;
    readonly id: string;
    readonly name: string;
    readonly route: LinuxDoRoute;
    readonly successLabel: string;
    readonly title: string;
  },
): void {
  registry.register({
    entryPoints: TERMINAL_AND_PALETTE,
    execute: ({ context, signal }) =>
      navigate(actions, command.route, context, signal, command.successLabel),
    help: command.help,
    id: command.id,
    isAvailable: supportedContext,
    name: command.name,
    title: command.title,
    validateArguments: noArguments,
  });
}

async function navigate(
  actions: WorkbenchCommandActions,
  target: LinuxDoRoute,
  context: WorkbenchCommandContext,
  signal: AbortSignal,
  successLabel: string,
): Promise<CommandHandlerResult> {
  const outcome = await actions.navigate(target, context.view.generation, signal);
  switch (outcome.kind) {
    case 'navigated':
      return success(`Opened ${successLabel}.`);
    case 'unchanged':
      return success(`Already at ${successLabel}.`);
    case 'aborted':
      return failure('aborted', 'Command was cancelled.', true);
    case 'stale':
      return failure('stale', 'Navigation context changed before the target was confirmed.', true);
    case 'failed':
      return failure('native-action-failed', 'Linux DO navigation was not confirmed.', true);
    case 'unavailable':
      return unavailable('Linux DO navigation is unavailable right now.');
  }
}

function noArguments(arguments_: readonly string[]) {
  return arguments_.length === 0
    ? validCommandArguments(undefined)
    : invalidCommandArguments('This command does not accept arguments.');
}

function oneOf<const Value extends string>(
  arguments_: readonly string[],
  values: readonly Value[],
) {
  const [value] = arguments_;
  return arguments_.length === 1 && value && values.includes(value as Value)
    ? validCommandArguments(value as Value)
    : invalidCommandArguments(`Expected one of: ${values.join(', ')}.`);
}

function readingModeArguments(arguments_: readonly string[]) {
  return oneOf<WorkbenchMode>(
    arguments_.map((argument) => argument.toLowerCase()),
    ['code', 'doc'],
  );
}

function positiveInteger(arguments_: readonly string[]) {
  const [value] = arguments_;
  if (arguments_.length !== 1 || !value || !/^[1-9]\d*$/u.test(value)) {
    return invalidCommandArguments('Expected one positive floor number.');
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed)
    ? validCommandArguments(parsed)
    : invalidCommandArguments('Floor number is outside the supported range.');
}

function optionalPositiveInteger(arguments_: readonly string[]) {
  if (arguments_.length === 0) return validCommandArguments<number | null>(null);
  const validation = positiveInteger(arguments_);
  return validation.valid ? validCommandArguments<number | null>(validation.value) : validation;
}

function replyArguments(arguments_: readonly string[]) {
  if (arguments_.length === 0) {
    return validCommandArguments<ReplyCommandArguments>({ content: null, floor: null });
  }
  const [first, ...rest] = arguments_;
  const floorCandidate = first && /^[1-9]\d*$/u.test(first) ? Number(first) : null;
  if (floorCandidate !== null && !Number.isSafeInteger(floorCandidate)) {
    return invalidCommandArguments('Floor number is outside the supported range.');
  }
  const contentTokens = floorCandidate === null ? arguments_ : rest;
  if (contentTokens.length === 0) {
    return validCommandArguments<ReplyCommandArguments>({ content: null, floor: floorCandidate });
  }
  const content = contentTokens.join(' ').replace(/\s+/gu, ' ').trim();
  if (!content || content.includes('\u0000')) {
    return invalidCommandArguments('Expected safe reply content.');
  }
  if (content.length > 32_000) {
    return invalidCommandArguments('Reply content must be 32,000 characters or fewer.');
  }
  return validCommandArguments<ReplyCommandArguments>({ content, floor: floorCandidate });
}

function topicListView(arguments_: readonly string[]) {
  const [rawView] = arguments_;
  if (arguments_.length !== 1 || !rawView) {
    return invalidCommandArguments('Expected one list: latest, news, new, unread, top, or hot.');
  }
  const view = rawView === 'news' ? 'new' : rawView;
  return ['hot', 'latest', 'new', 'top', 'unread'].includes(view)
    ? validCommandArguments(view as LinuxDoSimpleTopicListView)
    : invalidCommandArguments('Expected one list: latest, news, new, unread, top, or hot.');
}

function formatTopicList(document: TopicListDocument): readonly string[] {
  if (document.lines.length === 0) return [`Linux DO ${document.route.view} has no topics.`];
  return document.lines.map((line, index) => {
    const title = line.rows.find((row) => row.kind === 'signature')?.title;
    let path = line.url;
    try {
      path = new URL(line.url).pathname;
    } catch {
      // The adapter already validates same-origin URLs; retain the source if URL parsing changes.
    }
    return `${String(index + 1).padStart(2, ' ')}  ${title ?? `Topic ${String(line.topicId)}`}  ${path}`;
  });
}

function searchArguments(arguments_: readonly string[]) {
  if (arguments_.length === 0) {
    return validCommandArguments<SearchCommandArguments>({ kind: 'quick-open' });
  }
  if (arguments_.length === 1 && ['--clear', '--close'].includes(arguments_[0] ?? '')) {
    return validCommandArguments<SearchCommandArguments>({ kind: 'clear' });
  }
  const query = searchQuery(arguments_);
  return query.valid && query.value
    ? validCommandArguments<SearchCommandArguments>({ kind: 'query', query: query.value })
    : invalidCommandArguments(query.valid ? 'Expected a Linux DO search query.' : query.message);
}

function historyOptionalFloor(
  commandName: string,
  arguments_: readonly string[],
  expectedName: 'bookmark' | 'like',
): string | null {
  if (commandName !== expectedName) return null;
  const validation = optionalPositiveInteger(arguments_);
  if (!validation.valid) return null;
  return validation.value === null ? expectedName : `${expectedName} ${String(validation.value)}`;
}

function searchQuery(arguments_: readonly string[]) {
  if (arguments_.length === 0) return validCommandArguments<string | null>(null);
  const query = arguments_.join(' ').replace(/\s+/gu, ' ').trim();
  if (!query || query.includes('\u0000')) {
    return invalidCommandArguments('Expected a valid Linux DO search query.');
  }
  if (query.length > 500) {
    return invalidCommandArguments('Search query must be 500 characters or fewer.');
  }
  return validCommandArguments<string | null>(query);
}

function validateTopicRoute(arguments_: readonly string[]) {
  const [value] = arguments_;
  if (arguments_.length !== 1 || !value) {
    return invalidCommandArguments('Expected one Linux DO topic URL or path.');
  }
  let url: URL;
  try {
    url = new URL(value, 'https://linux.do');
  } catch {
    return invalidCommandArguments('Expected a valid Linux DO topic URL or path.');
  }
  if (url.origin !== 'https://linux.do' || url.username || url.password) {
    return invalidCommandArguments('Only public https://linux.do topic URLs are supported.');
  }
  const route = recognizeLinuxDoRoute(url);
  return route.kind === 'topic'
    ? validCommandArguments(route)
    : invalidCommandArguments('Expected a supported Linux DO topic URL or path.');
}

function supportedContext(context: WorkbenchCommandContext) {
  return context.view.supported
    ? availableCommand()
    : {
        available: false as const,
        code: 'unavailable' as const,
        message: 'Commands are unavailable on this route.',
        retryable: false,
      };
}

function topicReadyContext(context: WorkbenchCommandContext) {
  return context.view.route.kind === 'topic' && context.topicReady
    ? availableCommand()
    : {
        available: false as const,
        code: 'unavailable' as const,
        message: 'A ready topic is required for this command.',
        retryable: true,
      };
}

function readingModeContext(context: WorkbenchCommandContext) {
  return context.availableReadingModes.length > 0
    ? availableCommand()
    : {
        available: false as const,
        code: 'unavailable' as const,
        message: 'Reading modes are unavailable in the current view.',
        retryable: true,
      };
}

function success(text: string): CommandHandlerResult {
  return { output: { kind: 'text', text }, status: 'success' };
}

function unavailable(message: string): CommandHandlerResult {
  return failure('unavailable', message, true);
}

function failure(
  code: 'aborted' | 'native-action-failed' | 'stale' | 'unavailable' | 'user-input-error',
  message: string,
  retryable: boolean,
): CommandHandlerResult {
  return { error: { code, message, retryable }, status: 'error' };
}

function panelResultLabel(action: PanelCommandAction): string {
  switch (action) {
    case 'hide':
      return 'hidden';
    case 'outline':
      return 'Outline';
    case 'show':
      return 'shown';
    case 'terminal':
      return 'Terminal';
    case 'toggle':
      return 'toggled';
  }
}

function modeLabel(mode: WorkbenchMode): 'Code' | 'Doc' {
  switch (mode) {
    case 'code':
      return 'Code';
    case 'doc':
      return 'Doc';
  }
}
