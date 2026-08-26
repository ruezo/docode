import { browser, type Browser } from '@wxt-dev/browser';
import { defineBackground } from 'wxt/utils/define-background';

import { createToggleCommandHandler } from '../src/messaging/toggleCommand';
import { isWindowCommandRequest } from '../src/messaging/windowCommandContracts';
import { createWindowCommandMessageController } from '../src/messaging/windowCommandMessages';
import { createWindowFullscreenMessageController } from '../src/messaging/windowFullscreenMessages';

export default defineBackground(() => {
  const toggleCommand = createToggleCommandHandler({
    query: (query) => browser.tabs.query(query),
    sendMessage: (tabId, request) => browser.tabs.sendMessage(tabId, request),
  });
  browser.commands.onCommand.addListener((command) => {
    void toggleCommand(command);
  });

  const controller = createWindowFullscreenMessageController(
    {
      get: (windowId) => browser.windows.get(windowId),
      update: (windowId, state) => browser.windows.update(windowId, { state }),
    },
    browser.runtime.id,
  );
  const windowCommands = createWindowCommandMessageController(
    {
      closeTab: async (tabId) => {
        await browser.tabs.remove(tabId);
      },
      minimizeWindow: (windowId) => browser.windows.update(windowId, { state: 'minimized' }),
    },
    browser.runtime.id,
  );
  const messageListener = (
    message: unknown,
    sender: Browser.runtime.MessageSender,
    sendResponse: (response?: unknown) => void,
  ) => {
    const handler = isWindowCommandRequest(message) ? windowCommands : controller;
    void handler.handle(message, sender).then(
      (response) => {
        sendResponse(response);
      },
      () => {
        sendResponse({ error: { code: 'window-unavailable' }, ok: false });
      },
    );
    return true;
  };
  const windowRemovedListener = (windowId: number) => {
    controller.forgetWindow(windowId);
  };

  browser.runtime.onMessage.addListener(messageListener);
  browser.windows.onRemoved.addListener(windowRemovedListener);
});
