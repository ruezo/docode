export const WINDOW_FULLSCREEN_MESSAGE_VERSION = 1 as const;

export type WindowFullscreenRequest =
  | {
      readonly type: 'docode:window-fullscreen:get';
      readonly version: typeof WINDOW_FULLSCREEN_MESSAGE_VERSION;
    }
  | {
      readonly active: boolean;
      readonly type: 'docode:window-fullscreen:set';
      readonly version: typeof WINDOW_FULLSCREEN_MESSAGE_VERSION;
    };

export interface WindowFullscreenState {
  readonly active: boolean;
  readonly supported: true;
}

export type WindowFullscreenResponse =
  | { readonly ok: true; readonly state: WindowFullscreenState }
  | {
      readonly error: {
        readonly code: 'invalid-request' | 'untrusted-sender' | 'window-unavailable';
      };
      readonly ok: false;
    };

export function getWindowFullscreenRequest(): WindowFullscreenRequest {
  return {
    type: 'docode:window-fullscreen:get',
    version: WINDOW_FULLSCREEN_MESSAGE_VERSION,
  };
}

export function setWindowFullscreenRequest(active: boolean): WindowFullscreenRequest {
  return {
    active,
    type: 'docode:window-fullscreen:set',
    version: WINDOW_FULLSCREEN_MESSAGE_VERSION,
  };
}

export function isWindowFullscreenRequest(value: unknown): value is WindowFullscreenRequest {
  if (!isRecord(value) || value.version !== WINDOW_FULLSCREEN_MESSAGE_VERSION) return false;
  if (value.type === 'docode:window-fullscreen:get') return Object.keys(value).length === 2;
  return (
    value.type === 'docode:window-fullscreen:set' &&
    typeof value.active === 'boolean' &&
    Object.keys(value).length === 3
  );
}

export function isWindowFullscreenResponse(value: unknown): value is WindowFullscreenResponse {
  if (!isRecord(value) || typeof value.ok !== 'boolean' || Object.keys(value).length !== 2) {
    return false;
  }
  if (value.ok) {
    return (
      isRecord(value.state) &&
      Object.keys(value.state).length === 2 &&
      typeof value.state.active === 'boolean' &&
      value.state.supported === true
    );
  }
  return (
    isRecord(value.error) &&
    Object.keys(value.error).length === 1 &&
    ['invalid-request', 'untrusted-sender', 'window-unavailable'].includes(String(value.error.code))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
