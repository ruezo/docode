export const WINDOW_COMMAND_MESSAGE_VERSION = 1 as const;

export type WindowCommand = 'close' | 'minimize';

export interface WindowCommandRequest {
  readonly command: WindowCommand;
  readonly type: 'docode:window-command';
  readonly version: typeof WINDOW_COMMAND_MESSAGE_VERSION;
}

export type WindowCommandResponse =
  | { readonly ok: true }
  | {
      readonly error: {
        readonly code: 'invalid-request' | 'untrusted-sender' | 'window-unavailable';
      };
      readonly ok: false;
    };

export function windowCommandRequest(command: WindowCommand): WindowCommandRequest {
  return {
    command,
    type: 'docode:window-command',
    version: WINDOW_COMMAND_MESSAGE_VERSION,
  };
}

export function isWindowCommandRequest(value: unknown): value is WindowCommandRequest {
  return (
    isRecord(value) &&
    value.type === 'docode:window-command' &&
    value.version === WINDOW_COMMAND_MESSAGE_VERSION &&
    (value.command === 'close' || value.command === 'minimize') &&
    Object.keys(value).length === 3
  );
}

export function isWindowCommandResponse(value: unknown): value is WindowCommandResponse {
  if (!isRecord(value) || typeof value.ok !== 'boolean') return false;
  if (value.ok) return Object.keys(value).length === 1;
  return (
    Object.keys(value).length === 2 &&
    isRecord(value.error) &&
    Object.keys(value.error).length === 1 &&
    ['invalid-request', 'untrusted-sender', 'window-unavailable'].includes(String(value.error.code))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
