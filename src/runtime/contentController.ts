import type { ContentRuntimeStatus } from '../messaging/contracts';
import { enabledPreferenceStore, type EnabledPreferenceStore } from '../settings/enabledPreference';
import {
  workbenchLayoutPreferenceStore,
  type WorkbenchLayoutPreferenceStore,
} from '../settings/workbenchLayoutPreference';
import {
  workbenchAppearancePreferenceStore,
  type WorkbenchAppearancePreferenceStore,
} from '../settings/workbenchAppearancePreference';
import {
  bootstrapContentRuntime,
  disableContentRuntime,
  getContentRuntimeCapabilityStatus,
  getContentRuntimeRouteStatus,
  getContentRuntimeTopicListStatus,
  getContentRuntimeTopicStatus,
  isContentRuntimeMounted,
} from './contentRuntime';
import { beginStartupPresentation, waitForInitialDocument } from './startupPresentation';

type RuntimeLocation = Pick<Location, 'hostname' | 'protocol'> & { readonly port?: string };
type ContentControllerErrorCode = 'runtime-conflict' | 'storage-error';

export class ContentControllerError extends Error {
  constructor(readonly code: ContentControllerErrorCode) {
    super(
      code === 'storage-error'
        ? 'Unable to access DOCode settings.'
        : 'Runtime ownership conflict.',
    );
    this.name = 'ContentControllerError';
  }
}

export class ContentController {
  #storageRecovered = false;

  constructor(
    readonly document: Document,
    readonly location: RuntimeLocation,
    readonly preferenceStore: EnabledPreferenceStore = enabledPreferenceStore,
    readonly layoutPreferenceStore: WorkbenchLayoutPreferenceStore = workbenchLayoutPreferenceStore,
    readonly appearancePreferenceStore: WorkbenchAppearancePreferenceStore = workbenchAppearancePreferenceStore,
  ) {}

  async initialize(signal?: AbortSignal): Promise<void> {
    const startupPresentation = beginStartupPresentation(this.document);
    try {
      const preference = await this.preferenceStore.read();
      if (signal?.aborted) return;
      this.#storageRecovered ||= preference.recoveredInvalidValue;
      if (preference.value && !(await waitForInitialDocument(this.document, signal))) {
        return;
      }
      await this.#applyEnabled(preference.value, signal);
    } catch {
      if (!signal?.aborted) {
        disableContentRuntime(this.document);
      }
    } finally {
      startupPresentation?.end();
    }
  }

  async getStatus(): Promise<ContentRuntimeStatus> {
    const preference = await this.#readPreference();
    this.#storageRecovered ||= preference.recoveredInvalidValue;

    return {
      capabilities: getContentRuntimeCapabilityStatus(this.document),
      enabled: preference.value,
      mounted: isContentRuntimeMounted(this.document),
      route: getContentRuntimeRouteStatus(this.document),
      storageRecovered: this.#storageRecovered,
      supported: true,
      topic: getContentRuntimeTopicStatus(this.document),
      topicList: getContentRuntimeTopicListStatus(this.document),
    };
  }

  async setEnabled(enabled: boolean): Promise<ContentRuntimeStatus> {
    try {
      await this.preferenceStore.write(enabled);
    } catch {
      throw new ContentControllerError('storage-error');
    }

    this.#storageRecovered = false;
    await this.#applyEnabled(enabled);
    return this.getStatus();
  }

  restoreOriginal(): Promise<ContentRuntimeStatus> {
    return this.setEnabled(false);
  }

  async #applyEnabled(enabled: boolean, signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) return;
    if (!enabled) {
      disableContentRuntime(this.document);
      return;
    }

    const [layoutPreference, appearancePreference] = await Promise.all([
      this.#readLayoutPreference(),
      this.#readAppearancePreference(),
    ]);
    if (signal?.aborted) return;
    this.#storageRecovered ||=
      layoutPreference.recoveredInvalidValue || appearancePreference.recoveredInvalidValue;
    const result = await bootstrapContentRuntime({
      document: this.document,
      initialAppearance: appearancePreference.value,
      initialSidebarWidth: layoutPreference.sidebarWidth,
      location: this.location,
      persistAppearance: (preference) => this.appearancePreferenceStore.write(preference),
      persistSidebarWidth: (width) => this.layoutPreferenceStore.writeSidebarWidth(width),
      readEnabledState: () => Promise.resolve(!signal?.aborted),
      ...(signal ? { signal } : {}),
      useOriginalView: async () => {
        await this.setEnabled(false);
      },
    });

    if (result.status === 'marker-conflict' || result.status === 'unsupported-host') {
      throw new ContentControllerError('runtime-conflict');
    }
  }

  async #readPreference() {
    try {
      return await this.preferenceStore.read();
    } catch {
      throw new ContentControllerError('storage-error');
    }
  }

  async #readLayoutPreference() {
    try {
      return await this.layoutPreferenceStore.read();
    } catch {
      throw new ContentControllerError('storage-error');
    }
  }

  async #readAppearancePreference() {
    try {
      return await this.appearancePreferenceStore.read();
    } catch {
      throw new ContentControllerError('storage-error');
    }
  }
}
