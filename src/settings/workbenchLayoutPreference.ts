import { storage } from 'wxt/utils/storage';

export const DEFAULT_SIDEBAR_WIDTH = 300;
export const MINIMUM_SIDEBAR_WIDTH = 170;
export const MAXIMUM_STORED_SIDEBAR_WIDTH = 4096;

export interface WorkbenchLayoutPreferenceRead {
  readonly recoveredInvalidValue: boolean;
  readonly sidebarWidth: number;
}

export interface WorkbenchLayoutPreferenceStore {
  read(): Promise<WorkbenchLayoutPreferenceRead>;
  writeSidebarWidth(value: number): Promise<void>;
}

const sidebarWidthItem = storage.defineItem<unknown>('local:workbench.sidebarWidth', {
  fallback: DEFAULT_SIDEBAR_WIDTH,
});

export const workbenchLayoutPreferenceStore: WorkbenchLayoutPreferenceStore = {
  async read() {
    const storedValue = await sidebarWidthItem.getValue();
    if (isValidSidebarWidth(storedValue)) {
      return { recoveredInvalidValue: false, sidebarWidth: storedValue };
    }

    await sidebarWidthItem.setValue(DEFAULT_SIDEBAR_WIDTH);
    return { recoveredInvalidValue: true, sidebarWidth: DEFAULT_SIDEBAR_WIDTH };
  },
  async writeSidebarWidth(value) {
    await sidebarWidthItem.setValue(normalizeSidebarWidth(value));
  },
};

function isValidSidebarWidth(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MINIMUM_SIDEBAR_WIDTH &&
    value <= MAXIMUM_STORED_SIDEBAR_WIDTH
  );
}

function normalizeSidebarWidth(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SIDEBAR_WIDTH;
  return Math.round(Math.min(MAXIMUM_STORED_SIDEBAR_WIDTH, Math.max(MINIMUM_SIDEBAR_WIDTH, value)));
}
