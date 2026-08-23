import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';

import { DEFAULT_ENABLED, enabledPreferenceStore } from '../../src/settings/enabledPreference';

beforeEach(() => {
  fakeBrowser.reset();
});

describe('enabled preference', () => {
  it('defaults to enabled and persists a boolean value', async () => {
    await expect(enabledPreferenceStore.read()).resolves.toEqual({
      recoveredInvalidValue: false,
      value: DEFAULT_ENABLED,
    });

    await enabledPreferenceStore.write(false);

    await expect(enabledPreferenceStore.read()).resolves.toEqual({
      recoveredInvalidValue: false,
      value: false,
    });
  });

  it('repairs an invalid stored value to the safe default', async () => {
    await fakeBrowser.storage.local.set({ enabled: 'invalid' });

    await expect(enabledPreferenceStore.read()).resolves.toEqual({
      recoveredInvalidValue: true,
      value: DEFAULT_ENABLED,
    });
    await expect(fakeBrowser.storage.local.get('enabled')).resolves.toEqual({
      enabled: DEFAULT_ENABLED,
    });
  });
});
