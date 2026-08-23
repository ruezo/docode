import { browser } from '@wxt-dev/browser';

import {
  getWindowFullscreenRequest,
  isWindowFullscreenResponse,
  setWindowFullscreenRequest,
} from '../messaging/windowFullscreenContracts';

export interface WindowFullscreenClientState {
  readonly active: boolean;
  readonly supported: boolean;
}

export interface WindowFullscreenClient {
  getState(): Promise<WindowFullscreenClientState>;
  setActive(active: boolean): Promise<WindowFullscreenClientState>;
}

interface RuntimeMessagingApi {
  sendMessage(message: unknown): Promise<unknown>;
}

const browserRuntimeMessaging: RuntimeMessagingApi = {
  sendMessage: (message) => browser.runtime.sendMessage(message),
};

export class BrowserWindowFullscreenClient implements WindowFullscreenClient {
  constructor(private readonly runtime: RuntimeMessagingApi = browserRuntimeMessaging) {}

  async getState(): Promise<WindowFullscreenClientState> {
    try {
      return await this.#send(getWindowFullscreenRequest());
    } catch {
      return { active: false, supported: false };
    }
  }

  setActive(active: boolean): Promise<WindowFullscreenClientState> {
    return this.#send(setWindowFullscreenRequest(active));
  }

  async #send(message: unknown): Promise<WindowFullscreenClientState> {
    const response = await this.runtime.sendMessage(message);
    if (!isWindowFullscreenResponse(response)) {
      throw new WindowFullscreenClientError('invalid-response');
    }
    if (!response.ok) throw new WindowFullscreenClientError(response.error.code);
    return response.state;
  }
}

export const browserWindowFullscreenClient: WindowFullscreenClient =
  new BrowserWindowFullscreenClient();

class WindowFullscreenClientError extends Error {}
