import { describe, expect, it, vi } from 'vitest';

import {
  CLEAR_TERMINAL_COMMAND_ID,
  createWorkbenchCommandRegistry,
  getAvailableWorkbenchCommands,
  getWorkbenchTerminalHistoryEntry,
  TAB_ACTION_COMMAND_IDS,
  WORKBENCH_COMMAND_IDS,
  type WorkbenchCommandActions,
  type WorkbenchCommandContext,
} from '../../src/commands/workbenchCommands';
import type { LinuxDoNavigationOutcome } from '../../src/linuxdo/navigationAdapter';
import type { LinuxDoPostActionOutcome } from '../../src/linuxdo/postActionAdapter';
import { recognizeLinuxDoRoute, type LinuxDoRoute } from '../../src/linuxdo/routes';
import { createWorkbenchViewContext } from '../../src/ui/workbench/workbenchContext';
import { createTopicListDocument } from '../../src/views/topicList/topicListDocument';

describe('workbench commands', () => {
  it('registers the exact working foundation and lists only commands available at the entry point', async () => {
    const { actions, registry } = setup();

    expect(registry.commands.map(({ name }) => name)).toEqual([
      'help',
      'doctor',
      'clear',
      'panel',
      'quick-open',
      'command-palette',
      'terminal-toggle',
      'mode',
      'like',
      'bookmark',
      'copy-post-link',
      'reply',
      'tab-close',
      'tab-close-others',
      'tab-close-right',
      'tab-copy-topic-link',
      'tab-open-original-view',
      'latest',
      'ls',
      'search',
      'hot',
      'new',
      'unread',
      'top',
      'open',
      'goto',
    ]);
    const terminalHelp = await dispatch(registry, 'help', listContext(), 'terminal');
    expect(successLines(terminalHelp)).toEqual([
      'Available commands:',
      'help — List available commands',
      'doctor — Print DOCode capability diagnostics',
      'clear — Clear terminal output',
      'panel <show|hide|toggle|outline|terminal> — Control the bottom panel',
      'mode <code|doc> — Set the reading mode',
      'latest — Open latest topics',
      'ls <latest|news|new|unread|top|hot> — List Linux DO topics',
      'search [query|--clear] — Search Linux DO',
      'hot — Open hot topics',
      'new — Open new topics',
      'unread — Open unread topics',
      'top — Open top topics',
      'open </t/slug/id[/floor]> — Open a Linux DO topic URL',
    ]);
    const paletteHelp = await dispatch(registry, 'help', listContext(), 'palette');
    expect(successLines(paletteHelp)).not.toContain('clear — Clear terminal output');
    expect(actions.navigate).not.toHaveBeenCalled();
  });

  it('provides completion metadata from the same contextual availability boundary', () => {
    const { registry } = setup();

    expect(
      getAvailableWorkbenchCommands(registry, listContext(), 'terminal').map(({ name }) => name),
    ).toEqual([
      'help',
      'doctor',
      'clear',
      'panel',
      'mode',
      'latest',
      'ls',
      'search',
      'hot',
      'new',
      'unread',
      'top',
      'open',
    ]);
    expect(
      getAvailableWorkbenchCommands(
        registry,
        topicContext('/t/synthetic-topic/42/2', 4, true),
        'terminal',
      ).map(({ name }) => name),
    ).toEqual([
      'help',
      'doctor',
      'clear',
      'panel',
      'mode',
      'latest',
      'ls',
      'search',
      'hot',
      'new',
      'unread',
      'top',
      'open',
      'goto',
    ]);
    expect(
      getAvailableWorkbenchCommands(registry, listContext(), 'palette').map(({ name }) => name),
    ).not.toContain('clear');
  });

  it('shows Quick Open through the shared non-terminal command ID', async () => {
    const { actions, registry } = setup();

    await expect(
      registry.dispatchById({
        arguments: [],
        commandId: 'docode.quick-open.show',
        context: listContext(),
        source: 'editor-action',
      }),
    ).resolves.toMatchObject({
      commandId: 'docode.quick-open.show',
      output: { text: 'Quick Open shown.' },
      status: 'success',
    });
    expect(actions.showQuickOpen).toHaveBeenCalledOnce();
    await expect(dispatch(registry, 'quick-open', listContext())).resolves.toMatchObject({
      error: { code: 'unavailable' },
      status: 'error',
    });
  });

  it('opens shared search from the palette and exposes real terminal results in Explorer', async () => {
    const { actions, registry } = setup();

    await expect(
      registry.dispatchById({
        arguments: [],
        commandId: 'linuxdo.search.open',
        context: listContext(),
        source: 'palette',
      }),
    ).resolves.toMatchObject({
      output: { text: 'Linux DO search shown in Quick Open.' },
      status: 'success',
    });
    expect(actions.showQuickOpen).toHaveBeenCalledOnce();

    actions.searchTopics.mockResolvedValueOnce({
      items: [
        {
          description: 'Post 7 · @fixture-user',
          id: 'post:42:7',
          kind: 'post',
          label: 'Browser extension result',
          route: recognizeLinuxDoRoute('https://linux.do/t/browser-extension-result/42/7'),
          url: 'https://linux.do/t/browser-extension-result/42/7',
        },
      ],
      kind: 'results',
      query: 'browser extension',
    });

    const results = await dispatch(registry, 'search browser extension', listContext());
    expect(successLines(results)).toEqual([
      ' 1  Browser extension result  Post 7 · @fixture-user  /t/browser-extension-result/42/7',
    ]);
    expect(actions.searchTopics).toHaveBeenCalledWith('browser extension', expect.any(AbortSignal));
    expect(actions.setSearchSession).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'browser extension' }),
    );
    expect(actions.navigate).not.toHaveBeenCalled();

    await expect(dispatch(registry, 'search --clear', listContext())).resolves.toMatchObject({
      output: { text: 'Closed the Explorer SEARCH session.' },
      status: 'success',
    });
    expect(actions.setSearchSession).toHaveBeenLastCalledWith(null);
  });

  it('shows the Command Palette only through its shared non-palette entry points', async () => {
    const { actions, registry } = setup();

    await expect(
      registry.dispatchById({
        arguments: [],
        commandId: 'docode.command-palette.show',
        context: listContext(),
        source: 'editor-action',
      }),
    ).resolves.toMatchObject({
      commandId: 'docode.command-palette.show',
      output: { text: 'Command Palette shown.' },
      status: 'success',
    });
    expect(actions.showCommandPalette).toHaveBeenCalledOnce();
    await expect(
      dispatch(registry, 'command-palette', listContext(), 'palette'),
    ).resolves.toMatchObject({
      error: { code: 'unavailable' },
      status: 'error',
    });
  });

  it('toggles the terminal only through the registered keybinding entry point', async () => {
    const { actions, registry } = setup();

    await expect(
      registry.dispatchById({
        arguments: [],
        commandId: 'docode.terminal.toggle',
        context: listContext(),
        source: 'keybinding',
      }),
    ).resolves.toMatchObject({
      commandId: 'docode.terminal.toggle',
      output: { text: 'Terminal toggled.' },
      status: 'success',
    });
    expect(actions.toggleTerminal).toHaveBeenCalledOnce();
    await expect(
      registry.dispatchById({
        arguments: [],
        commandId: 'docode.terminal.toggle',
        context: listContext(),
        source: 'palette',
      }),
    ).resolves.toMatchObject({ error: { code: 'unavailable' }, status: 'error' });
  });

  it('retains only successful known commands in canonical non-sensitive session history', () => {
    expect(
      getWorkbenchTerminalHistoryEntry('  open\t/t/synthetic-topic/42/7?token=private#reply ', {
        commandId: 'linuxdo.navigation.open-topic',
        status: 'success',
      }),
    ).toBe('open /t/synthetic-topic/42/7');
    expect(
      getWorkbenchTerminalHistoryEntry('goto\t7', {
        commandId: 'linuxdo.navigation.goto-post',
        status: 'success',
      }),
    ).toBe('goto 7');
    expect(
      getWorkbenchTerminalHistoryEntry('open https://name:secret@linux.do/t/topic/42', {
        commandId: 'linuxdo.navigation.open-topic',
        status: 'success',
      }),
    ).toBeNull();
    expect(
      getWorkbenchTerminalHistoryEntry('unknown secret-value', {
        commandId: null,
        error: { code: 'unknown-command', message: 'Unknown command', retryable: false },
        status: 'error',
      }),
    ).toBeNull();
    expect(
      getWorkbenchTerminalHistoryEntry('future token-value', {
        commandId: 'docode.future',
        status: 'success',
      }),
    ).toBeNull();
    expect(
      getWorkbenchTerminalHistoryEntry('future', {
        commandId: 'docode.help',
        status: 'success',
      }),
    ).toBeNull();
  });

  it('returns the clear presentation command ID and validates panel actions', async () => {
    const { actions, registry } = setup();

    await expect(dispatch(registry, 'clear', listContext())).resolves.toEqual({
      commandId: CLEAR_TERMINAL_COMMAND_ID,
      status: 'success',
    });
    await expect(dispatch(registry, 'panel terminal', listContext())).resolves.toMatchObject({
      commandId: 'docode.panel.control',
      output: { text: 'Bottom panel: Terminal.' },
      status: 'success',
    });
    expect(actions.setPanel).toHaveBeenCalledWith('terminal');
    await expect(dispatch(registry, 'panel activity', listContext())).resolves.toMatchObject({
      error: { code: 'invalid-arguments' },
      status: 'error',
    });

    actions.setPanel.mockReturnValueOnce(false);
    await expect(dispatch(registry, 'panel outline', listContext())).resolves.toMatchObject({
      error: { code: 'unavailable' },
      status: 'error',
    });
  });

  it('routes terminal text and palette IDs through the identical panel executor', async () => {
    const { actions, registry } = setup();

    const terminalResult = await dispatch(registry, 'panel terminal', listContext(), 'terminal');
    const paletteResult = await registry.dispatchById({
      arguments: ['terminal'],
      commandId: 'docode.panel.control',
      context: listContext(),
      source: 'palette',
    });

    expect(terminalResult).toMatchObject({
      commandId: 'docode.panel.control',
      output: { text: 'Bottom panel: Terminal.' },
      status: 'success',
    });
    expect(paletteResult).toEqual(terminalResult);
    expect(actions.setPanel).toHaveBeenNthCalledWith(1, 'terminal');
    expect(actions.setPanel).toHaveBeenNthCalledWith(2, 'terminal');
  });

  it('switches Code and Doc through the shared command and rejects removed modes', async () => {
    const { actions, registry } = setup();
    const topic = topicContext('/t/synthetic-topic/42/2', 4, true);

    await expect(dispatch(registry, 'mode doc', topic)).resolves.toMatchObject({
      output: { text: 'Reading mode: Doc.' },
      status: 'success',
    });
    expect(actions.setReadingMode).toHaveBeenCalledWith('doc');
    await expect(dispatch(registry, 'mode Doc', topic)).resolves.toMatchObject({
      output: { text: 'Reading mode: Doc.' },
      status: 'success',
    });
    expect(actions.setReadingMode).toHaveBeenLastCalledWith('doc');
    await expect(dispatch(registry, 'mode focus', topic)).resolves.toMatchObject({
      error: { code: 'invalid-arguments' },
      status: 'error',
    });
    await expect(dispatch(registry, 'mode raw', topic)).resolves.toMatchObject({
      error: { code: 'invalid-arguments' },
      status: 'error',
    });
    expect(actions.restoreOriginalView).not.toHaveBeenCalled();
    await expect(dispatch(registry, 'mode code', listContext())).resolves.toMatchObject({
      output: { text: 'Reading mode: Code.' },
      status: 'success',
    });
    await expect(dispatch(registry, 'mode doc', listContext())).resolves.toMatchObject({
      error: { code: 'unavailable' },
      status: 'error',
    });

    await expect(
      registry.dispatchById({
        arguments: ['doc'],
        commandId: WORKBENCH_COMMAND_IDS.mode,
        context: topic,
        source: 'status-bar',
      }),
    ).resolves.toMatchObject({
      commandId: WORKBENCH_COMMAND_IDS.mode,
      output: { text: 'Reading mode: Doc.' },
      status: 'success',
    });
    expect(actions.setReadingMode).toHaveBeenLastCalledWith('doc');
  });

  it('runs Like and Bookmark for the current loaded post through the shared native adapter', async () => {
    const { actions, registry } = setup();
    const context = topicActionContext();

    await expect(dispatch(registry, 'like', context)).resolves.toMatchObject({
      output: { text: 'Liked post 2.' },
      status: 'success',
    });
    expect(actions.runPostAction).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        action: 'like',
        expectedGeneration: 7,
        postId: 101,
        postNumber: 2,
      }),
    );

    actions.runPostAction.mockResolvedValueOnce({
      action: 'bookmark',
      active: true,
      kind: 'unchanged',
    });
    await expect(dispatch(registry, 'bookmark', context, 'palette')).resolves.toMatchObject({
      output: { text: 'Post 2 is already bookmarked.' },
      status: 'success',
    });
    expect(actions.runPostAction).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ action: 'bookmark', postId: 101 }),
    );
  });

  it('keeps auth-required post actions unavailable and maps stale native results without success', async () => {
    const { actions, registry } = setup();
    const signedOut = topicActionContext('authentication-required');

    await expect(dispatch(registry, 'like', signedOut)).resolves.toMatchObject({
      error: { code: 'authentication-required' },
      status: 'error',
    });
    expect(actions.runPostAction).not.toHaveBeenCalled();

    actions.runPostAction.mockResolvedValueOnce({
      action: 'like',
      code: 'stale-route',
      kind: 'failed',
      message: 'The topic changed before Linux DO confirmed the action.',
      retryable: true,
    });
    await expect(dispatch(registry, 'like', topicActionContext())).resolves.toMatchObject({
      error: { code: 'stale' },
      status: 'error',
    });
  });

  it('navigates latest and hot only after the injected real-route action reports an outcome', async () => {
    const { actions, registry } = setup();
    const context = topicContext('/t/synthetic-topic/42/2', 9, true);

    const latest = await dispatch(registry, 'latest', context);
    expect(latest).toMatchObject({ output: { text: 'Opened latest topics.' }, status: 'success' });
    expect(actions.navigate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ kind: 'topic-list', view: 'latest' }),
      9,
      expect.any(AbortSignal),
    );
    const hot = await dispatch(registry, 'hot', context);
    expect(hot).toMatchObject({ output: { text: 'Opened hot topics.' }, status: 'success' });
    expect(actions.navigate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ kind: 'topic-list', view: 'hot' }),
      9,
      expect.any(AbortSignal),
    );
  });

  it('reads real Linux DO list views and treats news as the canonical new view', async () => {
    const { actions, registry } = setup();
    actions.loadTopicList.mockResolvedValueOnce(topicListDocument('new'));

    const result = await dispatch(registry, 'ls news', listContext());

    expect(successLines(result)).toEqual([' 1  First native topic  /t/first-native-topic/42']);
    expect(actions.loadTopicList).toHaveBeenCalledWith('new', expect.any(AbortSignal));
    expect(
      getWorkbenchTerminalHistoryEntry('ls news', {
        commandId: WORKBENCH_COMMAND_IDS.list,
        status: 'success',
      }),
    ).toBe('ls new');
  });

  it('targets an explicitly loaded floor for real post actions', async () => {
    const { actions, registry } = setup();
    const context = topicActionContext();
    const current = context.posts[0];
    if (!current) throw new Error('Expected a current post fixture.');
    const floorContext: WorkbenchCommandContext = {
      ...context,
      posts: [
        ...context.posts,
        {
          capabilities: current.capabilities,
          id: 107,
          number: 7,
          permalink: 'https://linux.do/t/synthetic-topic/42/7',
        },
      ],
    };

    await expect(dispatch(registry, 'like 7', floorContext)).resolves.toMatchObject({
      output: { text: 'Liked post 7.' },
      status: 'success',
    });
    expect(actions.runPostAction).toHaveBeenCalledWith(
      expect.objectContaining({ postId: 107, postNumber: 7 }),
    );
  });

  it('dispatches post and tab UI actions through registered contextual IDs', async () => {
    const { actions, registry } = setup();
    const postContext = topicActionContext();

    await expect(
      registry.dispatchById({
        arguments: [],
        commandId: WORKBENCH_COMMAND_IDS.like,
        context: postContext,
        source: 'editor-action',
      }),
    ).resolves.toMatchObject({ status: 'success' });
    expect(actions.runPostAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'like', postId: 101, postNumber: 2 }),
    );

    await expect(
      registry.dispatchById({
        arguments: [],
        commandId: WORKBENCH_COMMAND_IDS.copyPostLink,
        context: postContext,
        source: 'context-menu',
      }),
    ).resolves.toMatchObject({ status: 'success' });
    expect(actions.copyText).toHaveBeenCalledWith(
      'https://linux.do/t/synthetic-topic/42/2',
      expect.any(AbortSignal),
    );

    const tabContext: WorkbenchCommandContext = {
      ...listContext(),
      tabTarget: { availableActions: ['close'], viewId: 'topic:42' },
    };
    await expect(
      registry.dispatchById({
        arguments: [],
        commandId: TAB_ACTION_COMMAND_IDS.close,
        context: tabContext,
        source: 'context-menu',
      }),
    ).resolves.toMatchObject({ status: 'success' });
    expect(actions.runTabAction).toHaveBeenCalledWith({ id: 'close', viewId: 'topic:42' });
    await expect(
      registry.dispatchById({
        arguments: [],
        commandId: TAB_ACTION_COMMAND_IDS['copy-topic-link'],
        context: tabContext,
        source: 'context-menu',
      }),
    ).resolves.toMatchObject({ error: { code: 'unavailable' }, status: 'error' });
  });

  it('opens only validated public Linux DO topic URLs and paths', async () => {
    const { actions, registry } = setup();
    const context = listContext();

    await expect(
      dispatch(registry, 'open /t/synthetic-topic/42/7', context),
    ).resolves.toMatchObject({
      output: { text: 'Opened topic 42.' },
      status: 'success',
    });
    expect(actions.navigate).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: 'topic', postNumber: 7, topicId: 42 }),
      3,
      expect.any(AbortSignal),
    );
    await expect(
      dispatch(registry, 'open https://example.com/t/synthetic-topic/42', context),
    ).resolves.toMatchObject({ error: { code: 'invalid-arguments' }, status: 'error' });
    await expect(dispatch(registry, 'open /hot', context)).resolves.toMatchObject({
      error: { code: 'invalid-arguments' },
      status: 'error',
    });
    await expect(
      dispatch(registry, 'open https://name:secret@linux.do/t/synthetic-topic/42', context),
    ).resolves.toMatchObject({ error: { code: 'invalid-arguments' }, status: 'error' });
  });

  it('builds goto from the current real topic and rejects missing or unsafe floors', async () => {
    const { actions, registry } = setup();
    const context = topicContext('/t/synthetic-topic/42/2', 5, true);

    await expect(dispatch(registry, 'goto 11', context)).resolves.toMatchObject({
      output: { text: 'Opened post 11.' },
      status: 'success',
    });
    expect(actions.navigate).toHaveBeenLastCalledWith(
      expect.objectContaining({ href: 'https://linux.do/t/synthetic-topic/42/11' }),
      5,
      expect.any(AbortSignal),
    );
    for (const input of ['goto', 'goto 0', 'goto -1', 'goto 1.5', `goto ${'9'.repeat(30)}`]) {
      await expect(dispatch(registry, input, context)).resolves.toMatchObject({
        error: { code: 'invalid-arguments' },
        status: 'error',
      });
    }
    await expect(dispatch(registry, 'goto 2', listContext())).resolves.toMatchObject({
      error: { code: 'unavailable' },
      status: 'error',
    });
  });

  it.each<readonly [LinuxDoNavigationOutcome, string]>([
    [{ kind: 'stale' }, 'stale'],
    [{ kind: 'failed' }, 'native-action-failed'],
    [{ kind: 'unavailable' }, 'unavailable'],
  ])('maps %j navigation without claiming success', async (outcome, errorCode) => {
    const { actions, registry } = setup();
    actions.navigate.mockResolvedValueOnce(outcome);

    await expect(dispatch(registry, 'hot', listContext())).resolves.toMatchObject({
      error: { code: errorCode },
      status: 'error',
    });
  });

  it('opens the shared native Reply composer from Terminal and maps failures honestly', async () => {
    const { actions, registry } = setup();
    const context = topicReplyContext();

    await expect(dispatch(registry, 'reply', context)).resolves.toMatchObject({
      output: { text: 'Opened the native Linux DO Reply composer.' },
      status: 'success',
    });
    expect(actions.openComposer).toHaveBeenCalledOnce();
    const openRequest = actions.openComposer.mock.calls[0]?.[0];
    expect(openRequest?.expectedGeneration).toBe(7);
    expect(openRequest?.signal).toBeInstanceOf(AbortSignal);

    actions.openComposer.mockResolvedValueOnce({
      code: 'confirmation-timeout',
      kind: 'failed',
      message: 'Linux DO did not confirm that the composer opened.',
      retryable: true,
    });
    await expect(dispatch(registry, 'reply', context)).resolves.toMatchObject({
      error: {
        code: 'native-action-failed',
        message: 'Linux DO did not confirm that the composer opened.',
      },
      status: 'error',
    });
    await expect(
      dispatch(registry, 'reply', topicReplyContext('authentication-required')),
    ).resolves.toMatchObject({
      error: { code: 'authentication-required' },
      status: 'error',
    });
  });

  it('submits topic and floor replies only through the native composer adapter', async () => {
    const { actions, registry } = setup();
    const context = topicReplyContext();

    await expect(dispatch(registry, 'reply 7 hello Linux DO', context)).resolves.toMatchObject({
      output: { text: 'Submitted a native reply to post 7.' },
      status: 'success',
    });
    const floorReplyRequest = actions.submitReply.mock.calls[0]?.[0];
    expect(floorReplyRequest).toMatchObject({
      content: 'hello Linux DO',
      expectedGeneration: 7,
      postNumber: 7,
    });
    expect(floorReplyRequest?.signal).toBeInstanceOf(AbortSignal);

    actions.submitReply.mockResolvedValueOnce({ kind: 'submitted', postNumber: null });
    await expect(dispatch(registry, 'reply hello topic', context)).resolves.toMatchObject({
      output: { text: 'Submitted a native Linux DO topic reply.' },
      status: 'success',
    });
    expect(actions.submitReply).toHaveBeenLastCalledWith(
      expect.objectContaining({ content: 'hello topic' }),
    );
  });
});

function topicListDocument(view: 'hot' | 'latest' | 'new' | 'top' | 'unread') {
  const route = recognizeLinuxDoRoute(`https://linux.do/${view}`);
  if (route.kind !== 'topic-list') throw new Error('Expected a topic-list route fixture.');
  return createTopicListDocument(route, {
    issues: [],
    state: 'ready',
    topics: [
      {
        activity: null,
        category: null,
        completeness: 'complete',
        hasExcerpt: false,
        id: 42,
        participants: [],
        pinned: false,
        readState: 'unknown',
        replyCount: null,
        tags: [],
        title: 'First native topic',
        url: 'https://linux.do/t/first-native-topic/42',
        viewCount: null,
      },
    ],
  });
}

function setup() {
  const actions = {
    copyText: vi.fn(() => Promise.resolve(true)),
    readDiagnostics: vi.fn(() => 'build test\nreply available'),
    loadTopicList: vi.fn<WorkbenchCommandActions['loadTopicList']>(() => Promise.resolve(null)),
    navigate: vi.fn((route: LinuxDoRoute): Promise<LinuxDoNavigationOutcome> =>
      Promise.resolve({ kind: 'navigated', route }),
    ),
    openComposer: vi.fn<WorkbenchCommandActions['openComposer']>(() =>
      Promise.resolve({ dirty: false, kind: 'opened' }),
    ),
    restoreOriginalView: vi.fn(() => Promise.resolve(true)),
    runPostAction: vi.fn<WorkbenchCommandActions['runPostAction']>(
      (request): Promise<LinuxDoPostActionOutcome> =>
        Promise.resolve({ action: request.action, active: true, kind: 'confirmed' }),
    ),
    runTabAction: vi.fn(() => Promise.resolve()),
    setPanel: vi.fn(() => true),
    setReadingMode: vi.fn(() => true),
    searchTopics: vi.fn<WorkbenchCommandActions['searchTopics']>((query) =>
      Promise.resolve({ items: [], kind: 'results', query }),
    ),
    setSearchSession: vi.fn(() => true),
    showCommandPalette: vi.fn(() => true),
    showQuickOpen: vi.fn(() => true),
    submitReply: vi.fn<WorkbenchCommandActions['submitReply']>((request) =>
      Promise.resolve({ kind: 'submitted', postNumber: request.postNumber ?? null }),
    ),
    toggleTerminal: vi.fn(() => true),
  } satisfies WorkbenchCommandActions;
  return { actions, registry: createWorkbenchCommandRegistry(actions) };
}

function listContext(): WorkbenchCommandContext {
  return {
    availableReadingModes: ['code'],
    currentPost: null,
    posts: [],
    tabTarget: null,
    topicInteraction: null,
    topicReady: false,
    view: createWorkbenchViewContext(recognizeLinuxDoRoute('https://linux.do/latest'), 3),
  };
}

function topicContext(
  path: string,
  generation: number,
  topicReady: boolean,
): WorkbenchCommandContext {
  return {
    availableReadingModes: topicReady ? ['code', 'doc'] : [],
    currentPost: null,
    posts: [],
    tabTarget: null,
    topicInteraction: null,
    topicReady,
    view: createWorkbenchViewContext(recognizeLinuxDoRoute(`https://linux.do${path}`), generation),
  };
}

function topicActionContext(
  state: 'authentication-required' | 'available' = 'available',
): WorkbenchCommandContext {
  const base = topicContext('/t/synthetic-topic/42/2', 7, true);
  const fallback = state === 'authentication-required' ? 'native-login' : null;
  const code = state === 'authentication-required' ? 'authentication-required' : null;
  const capability = {
    active: state === 'available' ? false : null,
    code,
    fallback,
    state,
  } as const;
  return {
    ...base,
    currentPost: {
      capabilities: { bookmark: capability, copyLink: capability, like: capability },
      id: 101,
      number: 2,
      permalink: 'https://linux.do/t/synthetic-topic/42/2',
    },
    posts: [
      {
        capabilities: { bookmark: capability, copyLink: capability, like: capability },
        id: 101,
        number: 2,
        permalink: 'https://linux.do/t/synthetic-topic/42/2',
      },
    ],
  };
}

function topicReplyContext(
  state: 'authentication-required' | 'available' = 'available',
): WorkbenchCommandContext {
  const context = topicContext('/t/synthetic-topic/42', 7, true);
  const fallback = state === 'authentication-required' ? 'native-login' : null;
  const code = state === 'authentication-required' ? 'authentication-required' : null;
  return {
    ...context,
    topicInteraction: {
      composer: {
        code,
        dirty: false,
        fallback,
        fullscreen: false,
        state: state === 'available' ? 'closed' : 'authentication-required',
        topicId: state === 'available' ? 42 : null,
      },
      currentUserState: state === 'available' ? 'logged-in' : 'logged-out',
      diagnosticCodes: code ? [code] : [],
      reply: { active: null, code, fallback, state },
      state: 'ready',
    },
  };
}

function dispatch(
  registry: ReturnType<typeof createWorkbenchCommandRegistry>,
  input: string,
  context: WorkbenchCommandContext,
  source: 'palette' | 'terminal' = 'terminal',
) {
  return registry.dispatch({ context, input, source });
}

function successLines(result: Awaited<ReturnType<typeof dispatch>>): readonly string[] {
  return result.status === 'success' && result.output?.kind === 'lines' ? result.output.lines : [];
}
