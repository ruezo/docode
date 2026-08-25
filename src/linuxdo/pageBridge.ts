export const TOPIC_REPLY_SHORTCUT_EVENT = 'docode:topic-reply-shortcut';

export function dispatchTopicReplyShortcutKeys(document: Document): void {
  const target = document.body;
  for (const type of ['keydown', 'keypress', 'keyup'] as const) {
    const event = new KeyboardEvent(type, {
      bubbles: true,
      cancelable: true,
      code: 'KeyR',
      key: 'R',
      shiftKey: true,
    });
    Object.defineProperty(event, 'keyCode', { value: 82 });
    Object.defineProperty(event, 'which', { value: 82 });
    target.dispatchEvent(event);
  }
}
