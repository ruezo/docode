import { describe, expect, it, vi } from 'vitest';

import type { ContentRuntimeStatus } from '../../src/messaging/contracts';
import {
  createToggleCommandHandler,
  TOGGLE_DOCODE_COMMAND,
} from '../../src/messaging/toggleCommand';

function status(enabled: boolean): ContentRuntimeStatus {
  return {
    capabilities: null,
    enabled,
    mounted: enabled,
    route: null,
    storageRecovered: false,
    supported: true,
    topic: null,
    topicList: null,
  };
}

describe('createToggleCommandHandler', () => {
  it('flips the active tab between workbench and native Linux DO', async () => {
    const sendMessage = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: status(true) })
      .mockResolvedValueOnce({ ok: true, status: status(false) });
    const query = vi.fn().mockResolvedValue([{ id: 7 }]);
    const handle = createToggleCommandHandler({ query, sendMessage });

    await expect(handle(TOGGLE_DOCODE_COMMAND)).resolves.toBe(true);

    expect(query).toHaveBeenCalledWith({ active: true, currentWindow: true });
    expect(sendMessage).toHaveBeenNthCalledWith(1, 7, {
      type: 'docode:get-status',
      version: 1,
    });
    expect(sendMessage).toHaveBeenNthCalledWith(2, 7, {
      enabled: false,
      type: 'docode:set-enabled',
      version: 1,
    });
  });

  it('re-enables the workbench when the page is showing native Linux DO', async () => {
    const sendMessage = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: status(false) })
      .mockResolvedValueOnce({ ok: true, status: status(true) });
    const handle = createToggleCommandHandler({
      query: vi.fn().mockResolvedValue([{ id: 3 }]),
      sendMessage,
    });

    await expect(handle(TOGGLE_DOCODE_COMMAND)).resolves.toBe(true);

    expect(sendMessage).toHaveBeenLastCalledWith(3, {
      enabled: true,
      type: 'docode:set-enabled',
      version: 1,
    });
  });

  it('ignores unrelated commands without touching any tab', async () => {
    const query = vi.fn();
    const sendMessage = vi.fn();
    const handle = createToggleCommandHandler({ query, sendMessage });

    await expect(handle('other-command')).resolves.toBe(false);

    expect(query).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('gives up quietly when no active tab is available', async () => {
    const sendMessage = vi.fn();
    const handle = createToggleCommandHandler({
      query: vi.fn().mockResolvedValue([]),
      sendMessage,
    });

    await expect(handle(TOGGLE_DOCODE_COMMAND)).resolves.toBe(false);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('gives up quietly when the tab has no DOCode content script', async () => {
    const handle = createToggleCommandHandler({
      query: vi.fn().mockResolvedValue([{ id: 9 }]),
      sendMessage: vi.fn().mockRejectedValue(new Error('no receiving end')),
    });

    await expect(handle(TOGGLE_DOCODE_COMMAND)).resolves.toBe(false);
  });

  it('does not toggle when the status response is malformed', async () => {
    const sendMessage = vi.fn().mockResolvedValue({ ok: true, status: { enabled: true } });
    const handle = createToggleCommandHandler({
      query: vi.fn().mockResolvedValue([{ id: 5 }]),
      sendMessage,
    });

    await expect(handle(TOGGLE_DOCODE_COMMAND)).resolves.toBe(false);
    expect(sendMessage).toHaveBeenCalledOnce();
  });
});
