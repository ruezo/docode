import { browser } from '@wxt-dev/browser';

import {
  isWindowCommandResponse,
  windowCommandRequest,
  type WindowCommand,
} from '../messaging/windowCommandContracts';

export interface WindowCommandClient {
  closeWindow(): Promise<void>;
  minimizeWindow(): Promise<void>;
}

interface RuntimeMessagingApi {
  sendMessage(message: unknown): Promise<unknown>;
}

const browserRuntimeMessaging: RuntimeMessagingApi = {
  sendMessage: (message) => browser.runtime.sendMessage(message),
};

export class BrowserWindowCommandClient implements WindowCommandClient {
  constructor(private readonly runtime: RuntimeMessagingApi = browserRuntimeMessaging) {}

  closeWindow(): Promise<void> {
    return this.#send('close');
  }

  minimizeWindow(): Promise<void> {
    return this.#send('minimize');
  }

  async #send(command: WindowCommand): Promise<void> {
    const response = await this.runtime.sendMessage(windowCommandRequest(command));
    if (!isWindowCommandResponse(response)) {
      throw new WindowCommandClientError('invalid-response');
    }
    if (!response.ok) throw new WindowCommandClientError(response.error.code);
  }
}

export const browserWindowCommandClient: WindowCommandClient = new BrowserWindowCommandClient();

class WindowCommandClientError extends Error {}
