import { describe, expect, it } from 'vitest';

import type { CommandMetadata } from '../../src/commands/commandTypes';
import {
  MAX_TERMINAL_HISTORY_ENTRIES,
  appendTerminalHistory,
  createTerminalSuggestions,
} from '../../src/ui/terminal/terminalInputModel';

describe('terminal input model', () => {
  it('keeps a bounded recent unique history entirely in memory', () => {
    let history: readonly string[] = [];
    for (let index = 0; index < MAX_TERMINAL_HISTORY_ENTRIES + 5; index += 1) {
      history = appendTerminalHistory(history, `goto ${String(index + 1)}`);
    }

    expect(history).toHaveLength(MAX_TERMINAL_HISTORY_ENTRIES);
    expect(history[0]).toBe('goto 6');
    history = appendTerminalHistory(history, 'goto 12');
    expect(history).toHaveLength(MAX_TERMINAL_HISTORY_ENTRIES);
    expect(history.at(-1)).toBe('goto 12');
    expect(history.filter((entry) => entry === 'goto 12')).toHaveLength(1);
    expect(appendTerminalHistory(history, null)).toBe(history);
  });

  it('derives command-name completions without inventing argument values', () => {
    const commands = [
      command('docode.help', 'help', 'help', 'List available commands'),
      command('docode.mode.set', 'mode', 'mode <code|doc>', 'Set topic reading mode'),
      command('linuxdo.navigation.open-topic', 'open', 'open </t/slug/id>', 'Open topic'),
    ];

    expect(createTerminalSuggestions(commands, 'm', false)).toEqual([
      {
        commandId: 'docode.mode.set',
        detail: 'Set topic reading mode',
        insertText: 'mode ',
        label: 'mode <code|doc>',
      },
    ]);
    expect(createTerminalSuggestions(commands, 'help', false)).toEqual([]);
    expect(createTerminalSuggestions(commands, 'mode', false)).toHaveLength(1);
    expect(createTerminalSuggestions(commands, 'mode ', false)).toEqual([]);
    expect(createTerminalSuggestions(commands, 'M', false)).toEqual([]);
  });

  it('shows all supplied available commands only after explicit empty-input completion', () => {
    const commands = [
      command('docode.help', 'help', 'help', 'List available commands'),
      command('docode.panel.control', 'panel', 'panel <show|hide>', 'Control panel'),
    ];

    expect(createTerminalSuggestions(commands, '', false)).toEqual([]);
    expect(createTerminalSuggestions(commands, '', true).map(({ commandId }) => commandId)).toEqual(
      ['docode.help', 'docode.panel.control'],
    );
  });
});

function command(id: string, name: string, help: string, title: string): CommandMetadata {
  return { aliases: [], entryPoints: ['terminal'], help, id, name, title };
}
