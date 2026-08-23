import { browser, type Browser } from '@wxt-dev/browser';
import { defineBackground } from 'wxt/utils/define-background';

import { createWindowFullscreenMessageController } from '../src/messaging/windowFullscreenMessages';

export default defineBackground(() => {
  const controller = createWindowFullscreenMessageController(
    {
      get: (windowId) => browser.windows.get(windowId),
      update: (windowId, state) => browser.windows.update(windowId, { state }),
    },
    browser.runtime.id,
  );
  const messageListener = (
    message: unknown,
    sender: Browser.runtime.MessageSender,
    sendResponse: (response?: unknown) => void,
  ) => {
    void controller.handle(message, sender).then(
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
