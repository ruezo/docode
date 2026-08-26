import { storage } from 'wxt/utils/storage';

import {
  DEFAULT_BROWSE_HISTORY_LIMIT,
  MAXIMUM_BROWSE_HISTORY_LIMIT,
  normalizeBrowseHistoryLimit,
} from './browseHistoryStore';

export type WorkbenchThemeId =
  'dark' | 'dracula' | 'github-light' | 'light' | 'monokai' | 'solarized-dark';

export type WorkbenchThemePreference = WorkbenchThemeId | 'system';

interface WorkbenchThemeDefinition {
  readonly appearance: 'dark' | 'light';
  readonly className: string | null;
  readonly label: string;
  readonly topicDetailBodyColor: string;
  readonly topicListBodyColor: string;
}

export const WORKBENCH_THEMES: Readonly<Record<WorkbenchThemeId, WorkbenchThemeDefinition>> = {
  dark: {
    appearance: 'dark',
    className: null,
    label: 'Dark Modern',
    topicDetailBodyColor: '#ce9178',
    topicListBodyColor: '#dcdcaa',
  },
  dracula: {
    appearance: 'dark',
    className: 'docode-theme-dracula',
    label: 'Dracula',
    topicDetailBodyColor: '#f1fa8c',
    topicListBodyColor: '#50fa7b',
  },
  'github-light': {
    appearance: 'light',
    className: 'docode-theme-github-light',
    label: 'GitHub Light',
    topicDetailBodyColor: '#0a3069',
    topicListBodyColor: '#6639ba',
  },
  light: {
    appearance: 'light',
    className: 'docode-theme-light-modern',
    label: 'Light Modern',
    topicDetailBodyColor: '#a31515',
    topicListBodyColor: '#795e26',
  },
  monokai: {
    appearance: 'dark',
    className: 'docode-theme-monokai',
    label: 'Monokai',
    topicDetailBodyColor: '#e6db74',
    topicListBodyColor: '#a6e22e',
  },
  'solarized-dark': {
    appearance: 'dark',
    className: 'docode-theme-solarized-dark',
    label: 'Solarized Dark',
    topicDetailBodyColor: '#2aa198',
    topicListBodyColor: '#b58900',
  },
};

export const WORKBENCH_THEME_IDS = Object.keys(WORKBENCH_THEMES) as readonly WorkbenchThemeId[];

export function getWorkbenchThemeClassName(theme: WorkbenchThemeId): string {
  const themeClassName = WORKBENCH_THEMES[theme].className;
  return themeClassName === null
    ? 'docode-theme-dark-modern'
    : `docode-theme-dark-modern ${themeClassName}`;
}

export interface WorkbenchAppearancePreference {
  readonly commandCenterLabel: string;
  readonly historyLimit: number;
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
  historyLimit: DEFAULT_BROWSE_HISTORY_LIMIT,
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
      return {
        recoveredInvalidValue: false,
        value: normalizeWorkbenchAppearancePreference(storedValue),
      };
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
    historyLimit: normalizeBrowseHistoryLimit(value.historyLimit),
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
  systemTheme: 'dark' | 'light',
): WorkbenchThemeId {
  return preference === 'system' ? systemTheme : preference;
}

export function getWorkbenchThemeAppearance(theme: WorkbenchThemeId): 'dark' | 'light' {
  return WORKBENCH_THEMES[theme].appearance;
}

function isWorkbenchAppearancePreference(value: unknown): value is WorkbenchAppearancePreference {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    isWorkbenchThemePreference(candidate.theme) &&
    isHexColor(candidate.topicListBodyColor) &&
    isHexColor(candidate.topicDetailBodyColor) &&
    typeof candidate.showTopicAvatars === 'boolean' &&
    isCommandCenterLabel(candidate.commandCenterLabel) &&
    (candidate.historyLimit === undefined || isHistoryLimit(candidate.historyLimit))
  );
}

function isHistoryLimit(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAXIMUM_BROWSE_HISTORY_LIMIT
  );
}

function isWorkbenchThemePreference(value: unknown): value is WorkbenchThemePreference {
  return value === 'system' || WORKBENCH_THEME_IDS.includes(value as WorkbenchThemeId);
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
