import { describe, expect, it, vi } from 'vitest';

import { windowCommandRequest } from '../../src/messaging/windowCommandContracts';
import { BrowserWindowCommandClient } from '../../src/platform/browserWindowCommands';

describe('BrowserWindowCommandClient', () => {
  it('sends versioned close and minimize requests over the runtime channel', async () => {
    const sendMessage = vi.fn(() => Promise.resolve({ ok: true }));
    const client = new BrowserWindowCommandClient({ sendMessage });

    await expect(client.closeWindow()).resolves.toBeUndefined();
    expect(sendMessage).toHaveBeenLastCalledWith(windowCommandRequest('close'));

    await expect(client.minimizeWindow()).resolves.toBeUndefined();
    expect(sendMessage).toHaveBeenLastCalledWith(windowCommandRequest('minimize'));
  });

  it('rejects error responses and malformed responses', async () => {
    const client = new BrowserWindowCommandClient({
      sendMessage: vi.fn(() =>
        Promise.resolve({ error: { code: 'window-unavailable' }, ok: false }),
      ),
    });
    await expect(client.minimizeWindow()).rejects.toThrow('window-unavailable');

    const malformed = new BrowserWindowCommandClient({
      sendMessage: vi.fn(() => Promise.resolve({ weird: true })),
    });
    await expect(malformed.closeWindow()).rejects.toThrow('invalid-response');
  });
});
