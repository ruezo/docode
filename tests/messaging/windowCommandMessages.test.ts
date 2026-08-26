import type { Browser } from '@wxt-dev/browser';
import { describe, expect, it, vi } from 'vitest';

import {
  isWindowCommandRequest,
  isWindowCommandResponse,
  windowCommandRequest,
} from '../../src/messaging/windowCommandContracts';
import {
  createWindowCommandMessageController,
  type BrowserWindowCommandGateway,
} from '../../src/messaging/windowCommandMessages';

describe('window command contracts', () => {
  it('accepts only well-formed requests and responses', () => {
    expect(isWindowCommandRequest(windowCommandRequest('close'))).toBe(true);
    expect(isWindowCommandRequest(windowCommandRequest('minimize'))).toBe(true);
    expect(isWindowCommandRequest({ command: 'close', type: 'docode:window-command' })).toBe(false);
    expect(
      isWindowCommandRequest({ command: 'maximize', type: 'docode:window-command', version: 1 }),
    ).toBe(false);
    expect(
      isWindowCommandRequest({
        command: 'close',
        extra: 1,
        type: 'docode:window-command',
        version: 1,
      }),
    ).toBe(false);

    expect(isWindowCommandResponse({ ok: true })).toBe(true);
    expect(isWindowCommandResponse({ error: { code: 'window-unavailable' }, ok: false })).toBe(
      true,
    );
    expect(isWindowCommandResponse({ ok: true, extra: 1 })).toBe(false);
    expect(isWindowCommandResponse({ error: { code: 'nope' }, ok: false })).toBe(false);
  });
});

describe('window command message controller', () => {
  it('rejects foreign, non-Linux-DO, iframe, and malformed requests', async () => {
    const controller = createWindowCommandMessageController(createGateway(), 'extension-id');

    await expect(
      controller.handle(windowCommandRequest('close'), sender({ id: 'foreign-id' })),
    ).resolves.toBeUndefined();
    await expect(
      controller.handle(windowCommandRequest('close'), sender({ url: 'https://example.com/' })),
    ).resolves.toEqual({ error: { code: 'untrusted-sender' }, ok: false });
    await expect(
      controller.handle(windowCommandRequest('minimize'), sender({ frameId: 1 })),
    ).resolves.toEqual({ error: { code: 'untrusted-sender' }, ok: false });
    await expect(controller.handle({ type: 'execute' }, sender())).resolves.toEqual({
      error: { code: 'invalid-request' },
      ok: false,
    });
  });

  it('closes the requesting tab', async () => {
    const gateway = createGateway();
    const controller = createWindowCommandMessageController(gateway, 'extension-id');

    await expect(controller.handle(windowCommandRequest('close'), sender())).resolves.toEqual({
      ok: true,
    });
    expect(gateway.closeTab).toHaveBeenCalledWith(9);
    expect(gateway.minimizeWindow).not.toHaveBeenCalled();
  });

  it('minimizes the requesting window', async () => {
    const gateway = createGateway();
    const controller = createWindowCommandMessageController(gateway, 'extension-id');

    await expect(controller.handle(windowCommandRequest('minimize'), sender())).resolves.toEqual({
      ok: true,
    });
    expect(gateway.minimizeWindow).toHaveBeenCalledWith(17);
    expect(gateway.closeTab).not.toHaveBeenCalled();
  });

  it('reports window-unavailable when the sender tab is missing or the gateway fails', async () => {
    const failing: BrowserWindowCommandGateway = {
      closeTab: vi.fn(() => Promise.reject(new Error('gone'))),
      minimizeWindow: vi.fn(() => Promise.reject(new Error('gone'))),
    };
    const controller = createWindowCommandMessageController(failing, 'extension-id');

    await expect(
      controller.handle(windowCommandRequest('close'), senderWithoutTab()),
    ).resolves.toEqual({ error: { code: 'window-unavailable' }, ok: false });
    await expect(
      controller.handle(windowCommandRequest('minimize'), senderWithoutTab()),
    ).resolves.toEqual({ error: { code: 'window-unavailable' }, ok: false });
    await expect(controller.handle(windowCommandRequest('close'), sender())).resolves.toEqual({
      error: { code: 'window-unavailable' },
      ok: false,
    });
    await expect(controller.handle(windowCommandRequest('minimize'), sender())).resolves.toEqual({
      error: { code: 'window-unavailable' },
      ok: false,
    });
  });
});

function createGateway() {
  return {
    closeTab: vi.fn<BrowserWindowCommandGateway['closeTab']>(() => Promise.resolve()),
    minimizeWindow: vi.fn<BrowserWindowCommandGateway['minimizeWindow']>(() => Promise.resolve({})),
  };
}

function sender(
  overrides: {
    readonly frameId?: number;
    readonly id?: string;
    readonly url?: string;
  } = {},
): Browser.runtime.MessageSender {
  return {
    frameId: overrides.frameId ?? 0,
    id: overrides.id ?? 'extension-id',
    tab: { id: 9, windowId: 17 },
    url: overrides.url ?? 'https://linux.do/t/topic/1',
  } as Browser.runtime.MessageSender;
}

function senderWithoutTab(): Browser.runtime.MessageSender {
  return {
    frameId: 0,
    id: 'extension-id',
    url: 'https://linux.do/t/topic/1',
  };
}
