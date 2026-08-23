import type { ContentScriptContext } from 'wxt/utils/content-script-context';

export const CONTENT_CONTEXT_PROBE_INTERVAL_MS = 100;

type MonitoredContentScriptContext = Pick<ContentScriptContext, 'isValid' | 'setInterval'>;

export function monitorContentScriptContext(context: MonitoredContentScriptContext): void {
  context.setInterval(() => {
    // Accessing isValid asks WXT to invalidate an isolated world whose extension runtime is gone.
    void context.isValid;
  }, CONTENT_CONTEXT_PROBE_INTERVAL_MS);
}
