// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  COMMAND_PALETTE_COMMAND_ID,
  QUICK_OPEN_COMMAND_ID,
  TOGGLE_TERMINAL_COMMAND_ID,
} from '../../src/commands/workbenchCommands';
import {
  detectWorkbenchPlatform,
  getWorkbenchAriaKeyShortcut,
  getWorkbenchShortcutLabels,
  installWorkbenchKeybindings,
} from '../../src/keybindings/keybindingCoordinator';

afterEach(() => {
  document.body.replaceChildren();
});

describe('workbench keybinding coordinator', () => {
  it('dispatches the exact non-repeating primary-modifier matrix and cleans up', () => {
    const target = document.body.appendChild(document.createElement('button'));
    const dispatch = vi.fn();
    const dispose = installWorkbenchKeybindings({
      dispatch,
      document,
      enabled: () => true,
      platform: 'other',
    });

    expect(key(target, 'KeyP', { ctrlKey: true }).defaultPrevented).toBe(true);
    expect(key(target, 'KeyP', { ctrlKey: true, shiftKey: true }).defaultPrevented).toBe(true);
    expect(key(target, 'Backquote', { ctrlKey: true }).defaultPrevented).toBe(true);
    expect(dispatch).toHaveBeenNthCalledWith(1, {
      arguments: [],
      commandId: QUICK_OPEN_COMMAND_ID,
    });
    expect(dispatch).toHaveBeenNthCalledWith(2, {
      arguments: [],
      commandId: COMMAND_PALETTE_COMMAND_ID,
    });
    expect(dispatch).toHaveBeenNthCalledWith(3, {
      arguments: [],
      commandId: TOGGLE_TERMINAL_COMMAND_ID,
    });

    for (const event of [
      key(target, 'KeyP', { altKey: true, ctrlKey: true }),
      key(target, 'KeyP', { ctrlKey: true, metaKey: true }),
      key(target, 'KeyP', { ctrlKey: true, repeat: true }),
      key(target, 'KeyP', { ctrlKey: true, isComposing: true }),
      key(target, 'KeyL', { ctrlKey: true }),
      key(target, 'ArrowLeft', { altKey: true }),
    ]) {
      expect(event.defaultPrevented).toBe(false);
    }
    expect(dispatch).toHaveBeenCalledTimes(3);

    dispose();
    expect(key(target, 'KeyP', { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(dispatch).toHaveBeenCalledTimes(3);
  });

  it('uses Command on macOS and does not claim shortcuts while disabled', () => {
    const target = document.body.appendChild(document.createElement('button'));
    const dispatch = vi.fn();
    let enabled = true;
    const dispose = installWorkbenchKeybindings({
      dispatch,
      document,
      enabled: () => enabled,
      platform: 'mac',
    });

    expect(key(target, 'KeyP', { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(key(target, 'KeyP', { metaKey: true }).defaultPrevented).toBe(true);
    enabled = false;
    expect(key(target, 'KeyP', { metaKey: true, shiftKey: true }).defaultPrevented).toBe(false);
    expect(dispatch).toHaveBeenCalledTimes(1);
    dispose();
  });

  it('preserves native editable and composer contexts while allowing terminal toggle', () => {
    const input = document.body.appendChild(document.createElement('input'));
    const composer = document.body.appendChild(document.createElement('div'));
    composer.id = 'reply-control';
    const composerEditor = composer.appendChild(document.createElement('textarea'));
    const terminal = document.body.appendChild(document.createElement('div'));
    terminal.className = 'docode-terminal';
    const terminalInput = terminal.appendChild(document.createElement('input'));
    const dispatch = vi.fn();
    const dispose = installWorkbenchKeybindings({
      dispatch,
      document,
      enabled: () => true,
      platform: 'other',
    });

    expect(key(input, 'KeyP', { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(key(composerEditor, 'KeyP', { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(key(composerEditor, 'Backquote', { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(key(terminalInput, 'KeyP', { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(key(terminalInput, 'Backquote', { ctrlKey: true }).defaultPrevented).toBe(true);
    expect(dispatch).toHaveBeenCalledOnce();
    expect(dispatch).toHaveBeenCalledWith({
      arguments: [],
      commandId: TOGGLE_TERMINAL_COMMAND_ID,
    });
    dispose();
  });

  it('exposes platform-accurate visible and accessible shortcut labels', () => {
    expect(getWorkbenchShortcutLabels('other')).toEqual(
      new Map([
        [QUICK_OPEN_COMMAND_ID, 'Ctrl+P'],
        [COMMAND_PALETTE_COMMAND_ID, 'Ctrl+Shift+P'],
        [TOGGLE_TERMINAL_COMMAND_ID, 'Ctrl+`'],
      ]),
    );
    expect(getWorkbenchShortcutLabels('mac')).toEqual(
      new Map([
        [QUICK_OPEN_COMMAND_ID, '⌘P'],
        [COMMAND_PALETTE_COMMAND_ID, '⇧⌘P'],
        [TOGGLE_TERMINAL_COMMAND_ID, '⌘`'],
      ]),
    );
    expect(getWorkbenchAriaKeyShortcut(QUICK_OPEN_COMMAND_ID, 'other')).toBe('Control+P');
    expect(getWorkbenchAriaKeyShortcut(COMMAND_PALETTE_COMMAND_ID, 'mac')).toBe('Meta+Shift+P');
    expect(getWorkbenchAriaKeyShortcut(TOGGLE_TERMINAL_COMMAND_ID, 'other')).toBe('Control+`');
    expect(detectWorkbenchPlatform({ platform: 'MacIntel', userAgent: '' } as Navigator)).toBe(
      'mac',
    );
  });
});

function key(
  target: Element,
  code: string,
  options: Partial<KeyboardEventInit> = {},
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    code,
    key: code === 'KeyP' ? 'p' : code === 'Backquote' ? '`' : '',
    ...options,
  });
  target.dispatchEvent(event);
  return event;
}
