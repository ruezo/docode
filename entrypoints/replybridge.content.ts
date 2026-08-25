import { defineContentScript } from 'wxt/utils/define-content-script';

import { LINUX_DO_MATCH_PATTERN } from '../src/linuxdo/host';
import {
  POST_REPLY_OPEN_EVENT,
  SPA_NAVIGATE_EVENT,
  TOPIC_REPLY_SHORTCUT_EVENT,
  dispatchTopicReplyShortcutKeys,
  handlePostReplyOpen,
  handleSpaNavigate,
} from '../src/linuxdo/pageBridge';

export default defineContentScript({
  matches: [LINUX_DO_MATCH_PATTERN],
  runAt: 'document_start',
  world: 'MAIN',
  main() {
    document.addEventListener(TOPIC_REPLY_SHORTCUT_EVENT, () => {
      dispatchTopicReplyShortcutKeys(document);
    });
    document.addEventListener(POST_REPLY_OPEN_EVENT, (event) => {
      void handlePostReplyOpen(document, event);
    });
    document.addEventListener(SPA_NAVIGATE_EVENT, (event) => {
      handleSpaNavigate(document, event);
    });
  },
});
