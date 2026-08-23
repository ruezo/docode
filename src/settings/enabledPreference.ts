import { storage } from 'wxt/utils/storage';

export const DEFAULT_ENABLED = true;

export interface EnabledPreferenceRead {
  readonly recoveredInvalidValue: boolean;
  readonly value: boolean;
}

export interface EnabledPreferenceStore {
  read(): Promise<EnabledPreferenceRead>;
  write(value: boolean): Promise<void>;
}

const enabledItem = storage.defineItem<unknown>('local:enabled', {
  fallback: DEFAULT_ENABLED,
});

export const enabledPreferenceStore: EnabledPreferenceStore = {
  async read() {
    const storedValue = await enabledItem.getValue();
    if (typeof storedValue === 'boolean') {
      return { recoveredInvalidValue: false, value: storedValue };
    }

    await enabledItem.setValue(DEFAULT_ENABLED);
    return { recoveredInvalidValue: true, value: DEFAULT_ENABLED };
  },
  async write(value) {
    await enabledItem.setValue(value);
  },
};
