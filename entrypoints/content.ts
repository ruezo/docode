import { browser, type Browser } from '@wxt-dev/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';

import { LINUX_DO_MATCH_PATTERN } from '../src/linuxdo/host';
import { createContentMessageHandler } from '../src/messaging/contentMessages';
import {
  configureAppManifestDisguise,
  startAppManifestDisguise,
} from '../src/runtime/appManifestDisguise';
import { monitorContentScriptContext } from '../src/runtime/contentContextMonitor';
import { ContentController } from '../src/runtime/contentController';
import { disableContentRuntime } from '../src/runtime/contentRuntime';

export default defineContentScript({
  matches: [LINUX_DO_MATCH_PATTERN],
  runAt: 'document_start',
  async main(context) {
    configureAppManifestDisguise(browser.runtime.getURL('/docode.webmanifest'));
    startAppManifestDisguise(document);
    monitorContentScriptContext(context);

    const controller = new ContentController(document, window.location);
    const messageHandler = createContentMessageHandler(controller, browser.runtime.id);
    const messageListener = (
      message: unknown,
      sender: Browser.runtime.MessageSender,
      sendResponse: (response?: unknown) => void,
    ) => {
      if (!context.isValid) return false;

      void messageHandler(message, sender).then(
        (response) => {
          if (context.isValid) sendResponse(response);
        },
        () => {
          if (context.isValid) {
            sendResponse({ error: { code: 'storage-error' }, ok: false });
          }
        },
      );
      return true;
    };
    browser.runtime.onMessage.addListener(messageListener);

    context.onInvalidated(() => {
      try {
        browser.runtime.onMessage.removeListener(messageListener);
      } catch (error) {
        if (!context.signal.aborted) throw error;
      }
      disableContentRuntime(document);
    });

    await controller.initialize(context.signal);
  },
});
