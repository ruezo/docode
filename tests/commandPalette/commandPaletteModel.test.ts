import { describe, expect, it, vi } from 'vitest';

import {
  createCommandPaletteItems,
  filterCommandPaletteItems,
} from '../../src/commandPalette/commandPaletteModel';
import {
  createWorkbenchCommandRegistry,
  WORKBENCH_COMMAND_IDS,
  type WorkbenchCommandActions,
  type WorkbenchCommandContext,
} from '../../src/commands/workbenchCommands';
import type { LinuxDoNavigationOutcome } from '../../src/linuxdo/navigationAdapter';
import { recognizeLinuxDoRoute, type LinuxDoRoute } from '../../src/linuxdo/routes';
import { createWorkbenchViewContext } from '../../src/ui/workbench/workbenchContext';

describe('command palette model', () => {
  it('creates only executable registered variants for the current context', () => {
    const registry = createWorkbenchCommandRegistry(actions());

    expect(
      createCommandPaletteItems(registry, context('/latest', false)).map(({ id }) => id),
    ).toEqual([
      'quick-open',
      'panel-show',
      'panel-hide',
      'panel-toggle',
      'panel-terminal',
      'mode-code',
      'latest',
      'hot',
      'search-linux-do',
    ]);
    expect(
      createCommandPaletteItems(registry, context('/t/synthetic-topic/42', true, true)).map(
        ({ id }) => id,
      ),
    ).toEqual([
      'quick-open',
      'panel-show',
      'panel-hide',
      'panel-toggle',
      'panel-terminal',
      'panel-outline',
      'mode-code',
      'mode-doc',
      'latest',
      'hot',
      'search-linux-do',
      'reply-to-topic',
      'like-current-post',
      'bookmark-current-post',
    ]);
  });

  it('filters labels, registry-backed command text, groups, and real shortcut labels', () => {
    const registry = createWorkbenchCommandRegistry(actions());
    const items = createCommandPaletteItems(
      registry,
      context('/latest', false),
      new Map([[WORKBENCH_COMMAND_IDS.quickOpen, 'Ctrl+P']]),
    );

    expect(filterCommandPaletteItems(items, '> terminal').map(({ id }) => id)).toEqual([
      'panel-terminal',
    ]);
    expect(filterCommandPaletteItems(items, 'linux do').map(({ id }) => id)).toEqual([
      'latest',
      'hot',
      'search-linux-do',
    ]);
    expect(filterCommandPaletteItems(items, 'ctrl+p').map(({ id }) => id)).toEqual(['quick-open']);
    expect(items.find(({ id }) => id === 'quick-open')?.description).toBe('quick-open');
  });
});

function actions(): WorkbenchCommandActions {
  return {
    copyText: vi.fn(() => Promise.resolve(true)),
    readDiagnostics: vi.fn(() => 'build test\nreply available'),
    loadTopicList: vi.fn<WorkbenchCommandActions['loadTopicList']>(() => Promise.resolve(null)),
    navigate: vi.fn((route: LinuxDoRoute): Promise<LinuxDoNavigationOutcome> =>
      Promise.resolve({ kind: 'navigated', route }),
    ),
    openComposer: vi.fn(() => Promise.resolve({ dirty: false, kind: 'opened' as const })),
    restoreOriginalView: vi.fn(() => Promise.resolve(true)),
    runPostAction: vi.fn<WorkbenchCommandActions['runPostAction']>((request) =>
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
    submitReply: vi.fn<WorkbenchCommandActions['submitReply']>(() =>
      Promise.resolve({ kind: 'submitted', postNumber: null }),
    ),
    toggleTerminal: vi.fn(() => true),
  };
}

function context(pathname: string, topicReady: boolean, withPost = false): WorkbenchCommandContext {
  const capability = { active: false, code: null, fallback: null, state: 'available' } as const;
  return {
    availableReadingModes: topicReady ? ['code', 'doc'] : ['code'],
    currentPost: withPost
      ? {
          capabilities: { bookmark: capability, copyLink: capability, like: capability },
          id: 100,
          number: 1,
          permalink: 'https://linux.do/t/synthetic-topic/42/1',
        }
      : null,
    posts: [],
    tabTarget: null,
    topicInteraction: topicReady
      ? {
          composer: {
            code: null,
            dirty: false,
            fallback: null,
            fullscreen: false,
            state: 'closed',
            topicId: null,
          },
          currentUserState: 'logged-in',
          diagnosticCodes: [],
          reply: capability,
          state: 'ready',
        }
      : null,
    topicReady,
    view: createWorkbenchViewContext(recognizeLinuxDoRoute(`https://linux.do${pathname}`), 4),
  };
}
