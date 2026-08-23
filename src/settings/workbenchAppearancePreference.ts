import { storage } from 'wxt/utils/storage';

export type WorkbenchThemePreference = 'dark' | 'light' | 'system';

export interface WorkbenchAppearancePreference {
  readonly commandCenterLabel: string;
  readonly showTopicAvatars: boolean;
  readonly theme: WorkbenchThemePreference;
  readonly topicDetailBodyColor: string;
  readonly topicListBodyColor: string;
}

export interface WorkbenchAppearancePreferenceRead {
  readonly recoveredInvalidValue: boolean;
  readonly value: WorkbenchAppearancePreference;
}

export interface WorkbenchAppearancePreferenceStore {
  read(): Promise<WorkbenchAppearancePreferenceRead>;
  write(value: WorkbenchAppearancePreference): Promise<void>;
}

export const DEFAULT_WORKBENCH_APPEARANCE: WorkbenchAppearancePreference = {
  commandCenterLabel: 'DOCode',
  showTopicAvatars: true,
  theme: 'system',
  topicDetailBodyColor: '#ce9178',
  topicListBodyColor: '#dcdcaa',
};

const appearanceItem = storage.defineItem<unknown>('local:workbench.appearance', {
  fallback: DEFAULT_WORKBENCH_APPEARANCE,
});

export const workbenchAppearancePreferenceStore: WorkbenchAppearancePreferenceStore = {
  async read() {
    const storedValue = await appearanceItem.getValue();
    if (isWorkbenchAppearancePreference(storedValue)) {
      return { recoveredInvalidValue: false, value: storedValue };
    }

    await appearanceItem.setValue(DEFAULT_WORKBENCH_APPEARANCE);
    return { recoveredInvalidValue: true, value: DEFAULT_WORKBENCH_APPEARANCE };
  },
  async write(value) {
    await appearanceItem.setValue(normalizeWorkbenchAppearancePreference(value));
  },
};

export function normalizeWorkbenchAppearancePreference(
  value: WorkbenchAppearancePreference,
): WorkbenchAppearancePreference {
  return {
    commandCenterLabel: normalizeCommandCenterLabel(value.commandCenterLabel),
    showTopicAvatars: value.showTopicAvatars,
    theme: isWorkbenchThemePreference(value.theme) ? value.theme : 'system',
    topicDetailBodyColor: normalizeHexColor(
      value.topicDetailBodyColor,
      DEFAULT_WORKBENCH_APPEARANCE.topicDetailBodyColor,
    ),
    topicListBodyColor: normalizeHexColor(
      value.topicListBodyColor,
      DEFAULT_WORKBENCH_APPEARANCE.topicListBodyColor,
    ),
  };
}

export function resolveWorkbenchTheme(
  preference: WorkbenchThemePreference,
  systemTheme: Exclude<WorkbenchThemePreference, 'system'>,
): Exclude<WorkbenchThemePreference, 'system'> {
  return preference === 'system' ? systemTheme : preference;
}

function isWorkbenchAppearancePreference(value: unknown): value is WorkbenchAppearancePreference {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    isWorkbenchThemePreference(candidate.theme) &&
    isHexColor(candidate.topicListBodyColor) &&
    isHexColor(candidate.topicDetailBodyColor) &&
    typeof candidate.showTopicAvatars === 'boolean' &&
    isCommandCenterLabel(candidate.commandCenterLabel)
  );
}

function isWorkbenchThemePreference(value: unknown): value is WorkbenchThemePreference {
  return value === 'system' || value === 'dark' || value === 'light';
}

function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[\da-f]{6}$/iu.test(value);
}

function normalizeHexColor(value: string, fallback: string): string {
  return isHexColor(value) ? value.toLowerCase() : fallback;
}

function isCommandCenterLabel(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 64;
}

function normalizeCommandCenterLabel(value: string): string {
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= 64
    ? normalized
    : DEFAULT_WORKBENCH_APPEARANCE.commandCenterLabel;
}
