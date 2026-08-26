// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  INITIAL_VIM_NAVIGATION_STATE,
  installVimNavigation,
  resolveVimNavigation,
  VIM_NAVIGATION_SEQUENCE_TIMEOUT,
  type VimNavigationState,
} from '../../src/keybindings/vimNavigation';

afterEach(() => {
  document.body.innerHTML = '';
});

function keyEvent(key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key, ...init });
}

describe('vim navigation', () => {
  it('maps single keys onto post navigation and quick open actions', () => {
    expect(resolveVimNavigation(keyEvent('j'), INITIAL_VIM_NAVIGATION_STATE, 0).action).toBe(
      'next-post',
    );
    expect(resolveVimNavigation(keyEvent('k'), INITIAL_VIM_NAVIGATION_STATE, 0).action).toBe(
      'previous-post',
    );
    expect(
      resolveVimNavigation(keyEvent('G', { shiftKey: true }), INITIAL_VIM_NAVIGATION_STATE, 0)
        .action,
    ).toBe('last-post');
    expect(resolveVimNavigation(keyEvent('/'), INITIAL_VIM_NAVIGATION_STATE, 0).action).toBe(
      'quick-open',
    );
  });

  it('requires a double g within the sequence timeout to jump to the first post', () => {
    const first = resolveVimNavigation(keyEvent('g'), INITIAL_VIM_NAVIGATION_STATE, 100);
    expect(first.action).toBeNull();
    expect(first.state.pendingFirstPostAt).toBe(100);
    expect(resolveVimNavigation(keyEvent('g'), first.state, 400).action).toBe('first-post');
    const expired: VimNavigationState = { pendingFirstPostAt: 100 };
    const late = resolveVimNavigation(
      keyEvent('g'),
      expired,
      100 + VIM_NAVIGATION_SEQUENCE_TIMEOUT + 1,
    );
    expect(late.action).toBeNull();
    expect(late.state.pendingFirstPostAt).toBe(100 + VIM_NAVIGATION_SEQUENCE_TIMEOUT + 1);
    const interrupted = resolveVimNavigation(keyEvent('j'), first.state, 200);
    expect(interrupted.action).toBe('next-post');
    expect(interrupted.state.pendingFirstPostAt).toBeNull();
  });

  it('never fires with modifiers, IME composition, or editable targets', () => {
    expect(
      resolveVimNavigation(keyEvent('j', { ctrlKey: true }), INITIAL_VIM_NAVIGATION_STATE, 0)
        .action,
    ).toBeNull();
    expect(
      resolveVimNavigation(keyEvent('j', { metaKey: true }), INITIAL_VIM_NAVIGATION_STATE, 0)
        .action,
    ).toBeNull();
    expect(
      resolveVimNavigation(keyEvent('j', { altKey: true }), INITIAL_VIM_NAVIGATION_STATE, 0).action,
    ).toBeNull();
    expect(
      resolveVimNavigation(keyEvent('j', { isComposing: true }), INITIAL_VIM_NAVIGATION_STATE, 0)
        .action,
    ).toBeNull();

    document.body.innerHTML = '<input type="text">';
    const input = document.querySelector('input');
    if (!input) throw new Error('Missing input fixture.');
    const event = keyEvent('j');
    Object.defineProperty(event, 'target', { value: input });
    expect(resolveVimNavigation(event, INITIAL_VIM_NAVIGATION_STATE, 0).action).toBeNull();
  });

  it('installs a capture listener that dispatches actions and honors the enabled gate', () => {
    const onAction = vi.fn();
    let enabled = true;
    const uninstall = installVimNavigation({
      document,
      enabled: () => enabled,
      now: () => 0,
      onAction,
    });

    document.body.dispatchEvent(keyEvent('j'));
    expect(onAction).toHaveBeenLastCalledWith('next-post');

    enabled = false;
    document.body.dispatchEvent(keyEvent('k'));
    expect(onAction).toHaveBeenCalledTimes(1);

    enabled = true;
    uninstall();
    document.body.dispatchEvent(keyEvent('k'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
