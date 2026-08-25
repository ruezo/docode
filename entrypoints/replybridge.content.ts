import { defineContentScript } from 'wxt/utils/define-content-script';

import { LINUX_DO_MATCH_PATTERN } from '../src/linuxdo/host';
import {
  TOPIC_REPLY_SHORTCUT_EVENT,
  dispatchTopicReplyShortcutKeys,
} from '../src/linuxdo/pageBridge';

export default defineContentScript({
  matches: [LINUX_DO_MATCH_PATTERN],
  runAt: 'document_start',
  world: 'MAIN',
  main() {
    document.addEventListener(TOPIC_REPLY_SHORTCUT_EVENT, () => {
      dispatchTopicReplyShortcutKeys(document);
    });
  },
});
