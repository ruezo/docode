// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';

import { createContentMessageHandler } from '../../src/messaging/contentMessages';
import { getStatusRequest, setEnabledRequest } from '../../src/messaging/contracts';
import { ContentController } from '../../src/runtime/contentController';
import { disableContentRuntime } from '../../src/runtime/contentRuntime';
import type { EnabledPreferenceStore } from '../../src/settings/enabledPreference';

const linuxDoLocation = { hostname: 'linux.do', protocol: 'https:' };

afterEach(() => {
  disableContentRuntime(document);
  document.documentElement.removeAttribute('data-docode-runtime');
});

describe('content message handler', () => {
  it('rejects foreign and malformed messages', async () => {
    const handler = createContentMessageHandler(
      new ContentController(document, linuxDoLocation, createPreferenceStore(true)),
      'extension-id',
    );

    await expect(handler(getStatusRequest(), { id: 'foreign-id' })).resolves.toBeUndefined();
    await expect(handler({ type: 'execute' }, { id: 'extension-id' })).resolves.toEqual({
      error: { code: 'invalid-request' },
      ok: false,
    });
  });

  it('changes real runtime ownership only after a valid setting request', async () => {
    const controller = new ContentController(
      document,
      linuxDoLocation,
      createPreferenceStore(true),
    );
    await controller.initialize();
    const handler = createContentMessageHandler(controller, 'extension-id');

    const response = await handler(setEnabledRequest(false), { id: 'extension-id' });

    expect(response).toEqual({
      ok: true,
      status: {
        capabilities: null,
        enabled: false,
        mounted: false,
        route: null,
        storageRecovered: false,
        supported: true,
        topic: null,
        topicList: null,
      },
    });
    expect(document.documentElement.hasAttribute('data-docode-runtime')).toBe(false);
  });
});

function createPreferenceStore(initialValue: boolean): EnabledPreferenceStore {
  let value = initialValue;
  return {
    read: () => Promise.resolve({ recoveredInvalidValue: false, value }),
    write: (nextValue) => {
      value = nextValue;
      return Promise.resolve();
    },
  };
}
