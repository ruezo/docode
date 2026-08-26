import type { Browser } from '@wxt-dev/browser';

import { isWindowCommandRequest, type WindowCommandResponse } from './windowCommandContracts';
import { isTrustedLinuxDoSender } from './windowFullscreenMessages';

export interface BrowserWindowCommandGateway {
  closeTab(tabId: number): Promise<void>;
  minimizeWindow(windowId: number): Promise<unknown>;
}

export interface WindowCommandMessageController {
  handle(
    message: unknown,
    sender: Browser.runtime.MessageSender,
  ): Promise<WindowCommandResponse | undefined>;
}

export function createWindowCommandMessageController(
  gateway: BrowserWindowCommandGateway,
  extensionId: string,
): WindowCommandMessageController {
  return {
    async handle(message, sender) {
      if (sender.id !== extensionId) return undefined;
      if (!isTrustedLinuxDoSender(sender)) {
        return { error: { code: 'untrusted-sender' }, ok: false };
      }
      if (!isWindowCommandRequest(message)) {
        return { error: { code: 'invalid-request' }, ok: false };
      }

      try {
        if (message.command === 'close') {
          const tabId = sender.tab?.id;
          if (tabId === undefined || tabId < 0) {
            return { error: { code: 'window-unavailable' }, ok: false };
          }
          await gateway.closeTab(tabId);
          return { ok: true };
        }

        const windowId = sender.tab?.windowId;
        if (windowId === undefined || windowId < 0) {
          return { error: { code: 'window-unavailable' }, ok: false };
        }
        await gateway.minimizeWindow(windowId);
        return { ok: true };
      } catch {
        return { error: { code: 'window-unavailable' }, ok: false };
      }
    },
  };
}
