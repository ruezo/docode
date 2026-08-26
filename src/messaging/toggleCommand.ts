import { getStatusRequest, isContentResponse, setEnabledRequest } from './contracts';

export const TOGGLE_DOCODE_COMMAND = 'toggle-docode';

export interface ToggleCommandTabs {
  query(query: {
    readonly active: boolean;
    readonly currentWindow: boolean;
  }): Promise<readonly { readonly id?: number | undefined }[]>;
  sendMessage(tabId: number, request: unknown): Promise<unknown>;
}

export type ToggleCommandHandler = (command: string) => Promise<boolean>;

export function createToggleCommandHandler(tabs: ToggleCommandTabs): ToggleCommandHandler {
  return async (command) => {
    if (command !== TOGGLE_DOCODE_COMMAND) return false;
    try {
      const [tab] = await tabs.query({ active: true, currentWindow: true });
      if (tab?.id === undefined) return false;
      const current = await tabs.sendMessage(tab.id, getStatusRequest());
      if (!isContentResponse(current) || !current.ok) return false;
      const outcome = await tabs.sendMessage(tab.id, setEnabledRequest(!current.status.enabled));
      return isContentResponse(outcome) && outcome.ok;
    } catch {
      return false;
    }
  };
}
