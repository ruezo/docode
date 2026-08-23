import { describe, expect, it, vi } from 'vitest';

import { BrowserWindowFullscreenClient } from '../../src/platform/browserWindowFullscreen';

describe('browser window full-screen client', () => {
  it('reads and changes validated window state', async () => {
    const sendMessage = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, state: { active: true, supported: true } })
      .mockResolvedValueOnce({ ok: true, state: { active: false, supported: true } });
    const client = new BrowserWindowFullscreenClient({ sendMessage });

    await expect(client.getState()).resolves.toEqual({ active: true, supported: true });
    await expect(client.setActive(false)).resolves.toEqual({ active: false, supported: true });
    expect(sendMessage.mock.calls[1]?.[0]).toEqual({
      active: false,
      type: 'docode:window-fullscreen:set',
      version: 1,
    });
  });

  it('uses an unsupported read fallback but rejects failed mutations', async () => {
    const client = new BrowserWindowFullscreenClient({
      sendMessage: () => Promise.resolve(undefined),
    });

    await expect(client.getState()).resolves.toEqual({ active: false, supported: false });
    await expect(client.setActive(true)).rejects.toThrow();
  });
});
