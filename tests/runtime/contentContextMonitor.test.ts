import { describe, expect, it, vi } from 'vitest';

import {
  CONTENT_CONTEXT_PROBE_INTERVAL_MS,
  monitorContentScriptContext,
} from '../../src/runtime/contentContextMonitor';

describe('content-script context monitor', () => {
  it('registers a bounded WXT interval that keeps probing context validity', () => {
    let scheduledProbe: (() => void) | undefined;
    let validityReads = 0;
    const setInterval = vi.fn((handler: () => void) => {
      scheduledProbe = handler;
      return 1;
    });

    monitorContentScriptContext({
      get isValid() {
        validityReads += 1;
        return true;
      },
      setInterval,
    });

    expect(setInterval).toHaveBeenCalledOnce();
    expect(setInterval).toHaveBeenCalledWith(
      expect.any(Function),
      CONTENT_CONTEXT_PROBE_INTERVAL_MS,
    );
    expect(validityReads).toBe(0);

    scheduledProbe?.();
    scheduledProbe?.();

    expect(validityReads).toBe(2);
  });
});
