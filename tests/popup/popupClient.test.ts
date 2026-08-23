import { describe, expect, it, vi } from 'vitest';

import { BrowserPopupClient } from '../../entrypoints/popup/popupClient';
import { isContentRequest, type ContentRequest } from '../../src/messaging/contracts';

const readyResponse = {
  ok: true,
  status: {
    capabilities: null,
    enabled: true,
    mounted: true,
    route: { family: 'latest', generation: 0 },
    storageRecovered: false,
    supported: true,
    topic: null,
    topicList: {
      errorCode: 'topic-list-not-found',
      issueCodes: [],
      partialTopicCount: 0,
      state: 'error',
      topicCount: 0,
    },
  },
} as const;

describe('BrowserPopupClient', () => {
  it('discovers a supported tab through the allow-listed content message without tabs permission', async () => {
    const tabs = createTabsApi({ queryResult: [{ id: 42 }] });
    const client = new BrowserPopupClient(tabs);

    await expect(client.getStatus()).resolves.toEqual({
      kind: 'ready',
      status: readyResponse.status,
    });
    expect(tabs.sendMessage).toHaveBeenCalledWith(42, {
      type: 'docode:get-status',
      version: 1,
    });
  });

  it('treats a missing tab or missing content receiver as unsupported', async () => {
    const noTabClient = new BrowserPopupClient(createTabsApi({ queryResult: [] }));
    const noReceiverClient = new BrowserPopupClient(
      createTabsApi({ sendError: new Error('No receiver') }),
    );

    await expect(noTabClient.getStatus()).resolves.toEqual({ kind: 'unsupported' });
    await expect(noReceiverClient.getStatus()).resolves.toEqual({ kind: 'unsupported' });
  });

  it('rejects invalid and explicit error responses instead of reporting fake success', async () => {
    const invalidClient = new BrowserPopupClient(createTabsApi({ response: { ok: true } }));
    const errorClient = new BrowserPopupClient(
      createTabsApi({
        response: {
          error: { code: 'storage-error' },
          ok: false,
        },
      }),
    );

    await expect(invalidClient.getStatus()).rejects.toThrow('invalid content response');
    await expect(errorClient.getStatus()).rejects.toThrow('storage-error');
  });

  it('keeps the verified target for subsequent state changes', async () => {
    const tabs = createTabsApi();
    const client = new BrowserPopupClient(tabs);
    await client.getStatus();

    await client.setEnabled(false);
    await client.restoreOriginal();

    const requests = tabs.sendMessage.mock.calls.map(([, request]) => request);
    expect(requests).toHaveLength(3);
    expect(requests.every(isContentRequest)).toBe(true);
    expect(requests[1]).toEqual({ enabled: false, type: 'docode:set-enabled', version: 1 });
    expect(requests[2]).toEqual({ type: 'docode:restore-original', version: 1 });
  });
});

interface TabsApiOptions {
  readonly queryResult?: readonly { readonly id?: number | undefined }[];
  readonly response?: unknown;
  readonly sendError?: Error;
}

function createTabsApi(options: TabsApiOptions = {}) {
  return {
    query: vi.fn(() => Promise.resolve(options.queryResult ?? [{ id: 42 }])),
    sendMessage: vi.fn((_tabId: number, request: ContentRequest) => {
      if (options.sendError) return Promise.reject(options.sendError);
      expect(isContentRequest(request)).toBe(true);
      return Promise.resolve(options.response ?? readyResponse);
    }),
  };
}
