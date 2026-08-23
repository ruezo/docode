import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';

import {
  DEFAULT_SIDEBAR_WIDTH,
  MAXIMUM_STORED_SIDEBAR_WIDTH,
  MINIMUM_SIDEBAR_WIDTH,
  workbenchLayoutPreferenceStore,
} from '../../src/settings/workbenchLayoutPreference';

beforeEach(() => {
  fakeBrowser.reset();
});

describe('workbench layout preference', () => {
  it('defaults to the VS Code side bar width and persists a valid resized width', async () => {
    await expect(workbenchLayoutPreferenceStore.read()).resolves.toEqual({
      recoveredInvalidValue: false,
      sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
    });

    await workbenchLayoutPreferenceStore.writeSidebarWidth(248);

    await expect(workbenchLayoutPreferenceStore.read()).resolves.toEqual({
      recoveredInvalidValue: false,
      sidebarWidth: 248,
    });
  });

  it('normalizes writes and repairs invalid external values', async () => {
    await workbenchLayoutPreferenceStore.writeSidebarWidth(MINIMUM_SIDEBAR_WIDTH - 20);
    await expect(workbenchLayoutPreferenceStore.read()).resolves.toMatchObject({
      sidebarWidth: MINIMUM_SIDEBAR_WIDTH,
    });

    await workbenchLayoutPreferenceStore.writeSidebarWidth(MAXIMUM_STORED_SIDEBAR_WIDTH + 20);
    await expect(workbenchLayoutPreferenceStore.read()).resolves.toMatchObject({
      sidebarWidth: MAXIMUM_STORED_SIDEBAR_WIDTH,
    });

    await fakeBrowser.storage.local.set({ 'workbench.sidebarWidth': 'invalid' });
    await expect(workbenchLayoutPreferenceStore.read()).resolves.toEqual({
      recoveredInvalidValue: true,
      sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
    });
    await expect(fakeBrowser.storage.local.get('workbench.sidebarWidth')).resolves.toEqual({
      'workbench.sidebarWidth': DEFAULT_SIDEBAR_WIDTH,
    });
  });
});
