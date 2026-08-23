// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  beginStartupPresentation,
  waitForInitialDocument,
} from '../../src/runtime/startupPresentation';

const STARTUP_MARKER = 'data-docode-startup';

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.removeAttribute(STARTUP_MARKER);
});

describe('startup presentation', () => {
  it('uses an owner-scoped marker and removes it exactly once', () => {
    const presentation = beginStartupPresentation(document, 'owner-a');

    expect(presentation).not.toBeNull();
    expect(document.documentElement.getAttribute(STARTUP_MARKER)).toBe('owner-a');
    expect(beginStartupPresentation(document, 'owner-b')).toBeNull();
    expect(presentation?.end()).toBe(true);
    expect(document.documentElement.hasAttribute(STARTUP_MARKER)).toBe(false);
    expect(presentation?.end()).toBe(false);
  });

  it('does not remove a marker whose ownership changed', () => {
    const presentation = beginStartupPresentation(document, 'owner-a');
    document.documentElement.setAttribute(STARTUP_MARKER, 'owner-b');

    expect(presentation?.end()).toBe(true);
    expect(document.documentElement.getAttribute(STARTUP_MARKER)).toBe('owner-b');
  });

  it('waits for initial parsing even when the body element already exists', async () => {
    const readyState = vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
    let settled = false;
    const waiting = waitForInitialDocument(document).then((ready) => {
      settled = true;
      return ready;
    });

    await Promise.resolve();
    expect(document.body).not.toBeNull();
    expect(settled).toBe(false);

    readyState.mockReturnValue('interactive');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await expect(waiting).resolves.toBe(true);

    expect(settled).toBe(true);
  });

  it('stops waiting and removes readiness listeners when startup is invalidated', async () => {
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
    const removeEventListener = vi.spyOn(document, 'removeEventListener');
    const abortController = new AbortController();
    const waiting = waitForInitialDocument(document, abortController.signal);

    abortController.abort('content script invalidated');

    await expect(waiting).resolves.toBe(false);
    expect(removeEventListener).toHaveBeenCalledWith('DOMContentLoaded', expect.any(Function));
    expect(removeEventListener).toHaveBeenCalledWith('readystatechange', expect.any(Function));
  });
});
