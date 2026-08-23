import type { Browser } from '@wxt-dev/browser';
import { describe, expect, it, vi } from 'vitest';

import {
  getWindowFullscreenRequest,
  setWindowFullscreenRequest,
} from '../../src/messaging/windowFullscreenContracts';
import {
  createWindowFullscreenMessageController,
  type BrowserWindowGateway,
  type BrowserWindowState,
} from '../../src/messaging/windowFullscreenMessages';

describe('window full-screen message controller', () => {
  it('rejects foreign, non-Linux-DO, iframe, and malformed requests', async () => {
    const controller = createWindowFullscreenMessageController(
      createGateway('normal'),
      'extension-id',
    );

    await expect(
      controller.handle(getWindowFullscreenRequest(), sender({ id: 'foreign-id' })),
    ).resolves.toBeUndefined();
    await expect(
      controller.handle(getWindowFullscreenRequest(), sender({ url: 'https://example.com/' })),
    ).resolves.toEqual({ error: { code: 'untrusted-sender' }, ok: false });
    await expect(
      controller.handle(getWindowFullscreenRequest(), sender({ frameId: 1 })),
    ).resolves.toEqual({ error: { code: 'untrusted-sender' }, ok: false });
    await expect(controller.handle({ type: 'execute' }, sender())).resolves.toEqual({
      error: { code: 'invalid-request' },
      ok: false,
    });
  });

  it('enters browser-window full screen and restores the prior maximized state', async () => {
    let state: BrowserWindowState = 'maximized';
    const update = vi.fn<BrowserWindowGateway['update']>((_windowId, nextState) => {
      state = nextState;
      return Promise.resolve({ state });
    });
    const gateway: BrowserWindowGateway = {
      get: vi.fn(() => Promise.resolve({ state })),
      update,
    };
    const controller = createWindowFullscreenMessageController(gateway, 'extension-id');

    await expect(controller.handle(setWindowFullscreenRequest(true), sender())).resolves.toEqual({
      ok: true,
      state: { active: true, supported: true },
    });
    expect(update).toHaveBeenCalledWith(17, 'fullscreen');

    await expect(controller.handle(getWindowFullscreenRequest(), sender())).resolves.toEqual({
      ok: true,
      state: { active: true, supported: true },
    });

    await expect(controller.handle(setWindowFullscreenRequest(false), sender())).resolves.toEqual({
      ok: true,
      state: { active: false, supported: true },
    });
    expect(update).toHaveBeenLastCalledWith(17, 'maximized');
  });

  it('reports missing windows and browser failures without fake success', async () => {
    const controller = createWindowFullscreenMessageController(
      {
        get: () => Promise.reject(new Error('closed')),
        update: () => Promise.reject(new Error('closed')),
      },
      'extension-id',
    );

    await expect(controller.handle(getWindowFullscreenRequest(), sender())).resolves.toEqual({
      error: { code: 'window-unavailable' },
      ok: false,
    });
    await expect(
      controller.handle(getWindowFullscreenRequest(), sender({ windowId: -1 })),
    ).resolves.toEqual({ error: { code: 'window-unavailable' }, ok: false });
  });
});

function createGateway(initialState: BrowserWindowState): BrowserWindowGateway {
  let state = initialState;
  return {
    get: () => Promise.resolve({ state }),
    update: (_windowId, nextState) => {
      state = nextState;
      return Promise.resolve({ state });
    },
  };
}

function sender(
  overrides: {
    readonly frameId?: number;
    readonly id?: string;
    readonly url?: string;
    readonly windowId?: number;
  } = {},
): Browser.runtime.MessageSender {
  return {
    frameId: overrides.frameId ?? 0,
    id: overrides.id ?? 'extension-id',
    tab: { windowId: overrides.windowId ?? 17 },
    url: overrides.url ?? 'https://linux.do/t/topic/1',
  } as Browser.runtime.MessageSender;
}
