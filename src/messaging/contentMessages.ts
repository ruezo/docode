import type { Browser } from '@wxt-dev/browser';

import { ContentController, ContentControllerError } from '../runtime/contentController';
import { isContentRequest, type ContentResponse, type ContentRuntimeStatus } from './contracts';

export type ContentMessageHandler = (
  message: unknown,
  sender: Browser.runtime.MessageSender,
) => Promise<ContentResponse | undefined>;

export function createContentMessageHandler(
  controller: ContentController,
  extensionId: string,
): ContentMessageHandler {
  return async (message, sender) => {
    if (sender.id !== extensionId) return undefined;
    if (!isContentRequest(message)) {
      return { error: { code: 'invalid-request' }, ok: false };
    }

    try {
      let status: ContentRuntimeStatus;
      switch (message.type) {
        case 'docode:get-status':
          status = await controller.getStatus();
          break;
        case 'docode:set-enabled':
          status = await controller.setEnabled(message.enabled);
          break;
        case 'docode:restore-original':
          status = await controller.restoreOriginal();
          break;
      }
      return { ok: true, status };
    } catch (error) {
      const code = error instanceof ContentControllerError ? error.code : 'storage-error';
      return { error: { code }, ok: false };
    }
  };
}
