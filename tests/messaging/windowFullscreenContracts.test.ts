import { describe, expect, it } from 'vitest';

import {
  getWindowFullscreenRequest,
  isWindowFullscreenRequest,
  isWindowFullscreenResponse,
  setWindowFullscreenRequest,
} from '../../src/messaging/windowFullscreenContracts';

describe('window full-screen message contracts', () => {
  it('accepts only exact request shapes', () => {
    expect(isWindowFullscreenRequest(getWindowFullscreenRequest())).toBe(true);
    expect(isWindowFullscreenRequest(setWindowFullscreenRequest(true))).toBe(true);
    expect(
      isWindowFullscreenRequest({ ...getWindowFullscreenRequest(), command: 'arbitrary' }),
    ).toBe(false);
    expect(
      isWindowFullscreenRequest({ ...setWindowFullscreenRequest(false), active: 'false' }),
    ).toBe(false);
  });

  it('accepts only exact response shapes', () => {
    expect(
      isWindowFullscreenResponse({
        ok: true,
        state: { active: true, supported: true },
      }),
    ).toBe(true);
    expect(
      isWindowFullscreenResponse({
        ok: false,
        error: { code: 'window-unavailable' },
      }),
    ).toBe(true);
    expect(
      isWindowFullscreenResponse({
        ok: true,
        state: { active: true, supported: true, windowId: 1 },
      }),
    ).toBe(false);
  });
});
