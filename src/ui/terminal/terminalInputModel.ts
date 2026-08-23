import type { CommandMetadata } from '../../commands/commandTypes';
import {
  createCommandSuggestions,
  type TerminalSuggestion,
} from '../../terminal/terminalCompletions';

export type { TerminalSuggestion } from '../../terminal/terminalCompletions';

export const MAX_TERMINAL_HISTORY_ENTRIES = 50;

export function appendTerminalHistory(
  history: readonly string[],
  entry: string | null,
): readonly string[] {
  if (!entry) return history;
  const withoutDuplicate = history.filter((value) => value !== entry);
  return [...withoutDuplicate, entry].slice(-MAX_TERMINAL_HISTORY_ENTRIES);
}

export function createTerminalSuggestions(
  commands: readonly CommandMetadata[],
  input: string,
  includeAll: boolean,
): readonly TerminalSuggestion[] {
  return createCommandSuggestions(commands, input, includeAll);
}
