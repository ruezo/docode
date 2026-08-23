import { browser } from '@wxt-dev/browser';

import {
  getStatusRequest,
  isContentResponse,
  restoreOriginalRequest,
  setEnabledRequest,
  type ContentRequest,
  type ContentRuntimeStatus,
} from '../../src/messaging/contracts';

export type PopupStatus =
  | { readonly kind: 'ready'; readonly status: ContentRuntimeStatus }
  | { readonly kind: 'unsupported' };

export interface PopupClient {
  getStatus(): Promise<PopupStatus>;
  restoreOriginal(): Promise<ContentRuntimeStatus>;
  setEnabled(enabled: boolean): Promise<ContentRuntimeStatus>;
}

interface PopupTabsApi {
  query(query: {
    readonly active: true;
    readonly currentWindow: true;
  }): Promise<readonly { readonly id?: number | undefined }[]>;
  sendMessage(tabId: number, request: ContentRequest): Promise<unknown>;
}

const browserTabsApi: PopupTabsApi = {
  query: (query) => browser.tabs.query(query),
  sendMessage: (tabId, request) => browser.tabs.sendMessage(tabId, request),
};

export class BrowserPopupClient implements PopupClient {
  #targetTabId: number | undefined;

  constructor(private readonly tabs: PopupTabsApi = browserTabsApi) {}

  async getStatus(): Promise<PopupStatus> {
    const [tab] = await this.tabs.query({ active: true, currentWindow: true });
    if (tab?.id === undefined) {
      this.#targetTabId = undefined;
      return { kind: 'unsupported' };
    }

    this.#targetTabId = tab.id;
    try {
      return { kind: 'ready', status: await this.#send(getStatusRequest()) };
    } catch (error) {
      if (error instanceof ContentResponseError) throw error;
      this.#targetTabId = undefined;
      return { kind: 'unsupported' };
    }
  }

  setEnabled(enabled: boolean): Promise<ContentRuntimeStatus> {
    return this.#send(setEnabledRequest(enabled));
  }

  restoreOriginal(): Promise<ContentRuntimeStatus> {
    return this.#send(restoreOriginalRequest());
  }

  async #send(request: ContentRequest): Promise<ContentRuntimeStatus> {
    if (this.#targetTabId === undefined) throw new Error('No supported LINUX DO tab is active.');

    const response = await this.tabs.sendMessage(this.#targetTabId, request);
    if (!isContentResponse(response)) {
      throw new ContentResponseError('DOCode received an invalid content response.');
    }
    if (!response.ok) throw new ContentResponseError(response.error.code);
    return response.status;
  }
}

export const browserPopupClient: PopupClient = new BrowserPopupClient();

class ContentResponseError extends Error {}
