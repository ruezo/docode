import type { Browser } from '@wxt-dev/browser';

import { isLinuxDoUrl } from '../linuxdo/host';
import {
  isWindowFullscreenRequest,
  type WindowFullscreenResponse,
} from './windowFullscreenContracts';

export type BrowserWindowState =
  'fullscreen' | 'locked-fullscreen' | 'maximized' | 'minimized' | 'normal';

export interface BrowserWindowGateway {
  get(windowId: number): Promise<{ readonly state?: BrowserWindowState | undefined }>;
  update(
    windowId: number,
    state: 'fullscreen' | 'maximized' | 'normal',
  ): Promise<{ readonly state?: BrowserWindowState | undefined }>;
}

export interface WindowFullscreenMessageController {
  forgetWindow(windowId: number): void;
  handle(
    message: unknown,
    sender: Browser.runtime.MessageSender,
  ): Promise<WindowFullscreenResponse | undefined>;
}

export function createWindowFullscreenMessageController(
  windows: BrowserWindowGateway,
  extensionId: string,
): WindowFullscreenMessageController {
  const restoreStates = new Map<number, 'maximized' | 'normal'>();

  return {
    forgetWindow(windowId) {
      restoreStates.delete(windowId);
    },
    async handle(message, sender) {
      if (sender.id !== extensionId) return undefined;
      if (!isTrustedLinuxDoSender(sender)) {
        return { error: { code: 'untrusted-sender' }, ok: false };
      }
      if (!isWindowFullscreenRequest(message)) {
        return { error: { code: 'invalid-request' }, ok: false };
      }

      const windowId = sender.tab?.windowId;
      if (windowId === undefined || windowId < 0) {
        return { error: { code: 'window-unavailable' }, ok: false };
      }

      try {
        const currentWindow = await windows.get(windowId);
        if (message.type === 'docode:window-fullscreen:get') {
          return fullscreenStateResponse(currentWindow.state);
        }

        if (message.active) {
          if (!isFullscreenState(currentWindow.state)) {
            restoreStates.set(
              windowId,
              currentWindow.state === 'maximized' ? 'maximized' : 'normal',
            );
            return fullscreenStateResponse((await windows.update(windowId, 'fullscreen')).state);
          }
          return fullscreenStateResponse(currentWindow.state);
        }

        if (!isFullscreenState(currentWindow.state)) {
          return fullscreenStateResponse(currentWindow.state);
        }
        const restoreState = restoreStates.get(windowId) ?? 'normal';
        const restoredWindow = await windows.update(windowId, restoreState);
        restoreStates.delete(windowId);
        return fullscreenStateResponse(restoredWindow.state);
      } catch {
        return { error: { code: 'window-unavailable' }, ok: false };
      }
    },
  };
}

export function isTrustedLinuxDoSender(sender: Browser.runtime.MessageSender): boolean {
  if (sender.frameId !== undefined && sender.frameId !== 0) return false;
  return (
    (typeof sender.url === 'string' && isLinuxDoUrl(sender.url)) ||
    sender.origin === 'https://linux.do'
  );
}

function fullscreenStateResponse(state: BrowserWindowState | undefined): WindowFullscreenResponse {
  return {
    ok: true,
    state: { active: isFullscreenState(state), supported: true },
  };
}

function isFullscreenState(state: BrowserWindowState | undefined): boolean {
  return state === 'fullscreen' || state === 'locked-fullscreen';
}
