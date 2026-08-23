import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';

import {
  DEFAULT_WORKBENCH_APPEARANCE,
  normalizeWorkbenchAppearancePreference,
  resolveWorkbenchTheme,
  workbenchAppearancePreferenceStore,
} from '../../src/settings/workbenchAppearancePreference';

beforeEach(() => {
  fakeBrowser.reset();
});

describe('workbench appearance preference', () => {
  it('defaults to the system theme and persists independent editor appearance settings', async () => {
    await expect(workbenchAppearancePreferenceStore.read()).resolves.toEqual({
      recoveredInvalidValue: false,
      value: DEFAULT_WORKBENCH_APPEARANCE,
    });

    const preference = {
      commandCenterLabel: 'Linux DO',
      showTopicAvatars: false,
      theme: 'light' as const,
      topicDetailBodyColor: '#112233',
      topicListBodyColor: '#445566',
    };
    await workbenchAppearancePreferenceStore.write(preference);

    await expect(workbenchAppearancePreferenceStore.read()).resolves.toEqual({
      recoveredInvalidValue: false,
      value: preference,
    });
  });

  it('normalizes writes and repairs invalid external values', async () => {
    expect(
      normalizeWorkbenchAppearancePreference({
        ...DEFAULT_WORKBENCH_APPEARANCE,
        commandCenterLabel: '  Community  ',
        topicDetailBodyColor: '#ABCDEF',
        topicListBodyColor: 'invalid',
      }),
    ).toEqual({
      ...DEFAULT_WORKBENCH_APPEARANCE,
      commandCenterLabel: 'Community',
      topicDetailBodyColor: '#abcdef',
    });

    await fakeBrowser.storage.local.set({
      'workbench.appearance': {
        ...DEFAULT_WORKBENCH_APPEARANCE,
        showTopicAvatars: 'yes',
      },
    });
    await expect(workbenchAppearancePreferenceStore.read()).resolves.toEqual({
      recoveredInvalidValue: true,
      value: DEFAULT_WORKBENCH_APPEARANCE,
    });
    await expect(fakeBrowser.storage.local.get('workbench.appearance')).resolves.toEqual({
      'workbench.appearance': DEFAULT_WORKBENCH_APPEARANCE,
    });
  });

  it('resolves explicit themes and follows the current system theme in system mode', () => {
    expect(resolveWorkbenchTheme('system', 'light')).toBe('light');
    expect(resolveWorkbenchTheme('system', 'dark')).toBe('dark');
    expect(resolveWorkbenchTheme('light', 'dark')).toBe('light');
    expect(resolveWorkbenchTheme('dark', 'light')).toBe('dark');
  });
});
