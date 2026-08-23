import { describe, expect, it, vi } from 'vitest';

import { CommandRegistry } from '../../src/commands/commandRegistry';
import {
  invalidCommandArguments,
  validCommandArguments,
  type CommandArgumentValidation,
} from '../../src/commands/commandTypes';

describe('command security boundary', () => {
  it('never maps shell, JavaScript, or separator-shaped input to an allow-listed handler', async () => {
    const execute = vi.fn(() => ({ status: 'success' as const }));
    const registry = new CommandRegistry<Record<string, never>>();
    registry.register({
      entryPoints: ['terminal'],
      execute,
      id: 'docode.safe',
      name: 'safe',
      title: 'Safe Command',
      validateArguments: (arguments_) =>
        arguments_.length === 0
          ? validCommandArguments(undefined)
          : invalidCommandArguments('This command accepts no arguments.'),
    });

    const prohibitedInputs = [
      'rm -rf /',
      'node payload.js',
      'eval globalThis.value',
      'Function(payload)',
      'javascript:globalThis.value',
      'safe; rm -rf /',
      'safe | rm -rf /',
      'safe && node payload.js',
      'safe $(globalThis.value)',
    ];
    for (const input of prohibitedInputs) {
      const result = await registry.dispatch({ context: {}, input, source: 'terminal' });
      expect(result.status).toBe('error');
    }
    expect(execute).not.toHaveBeenCalled();
  });

  it('passes punctuation only as literal validated arguments and never interprets it', async () => {
    const received: string[] = [];
    const registry = new CommandRegistry<Record<string, never>>();
    registry.register({
      entryPoints: ['terminal'],
      execute: ({ arguments: argument }) => {
        received.push(argument);
        return { output: { kind: 'text', text: argument }, status: 'success' };
      },
      id: 'docode.inspect',
      name: 'inspect',
      title: 'Inspect Literal Text',
      validateArguments: validateOneLiteral,
    });

    const literal = '$(globalThis.__docodeProbe);<script>';
    await expect(
      registry.dispatch({ context: {}, input: `inspect ${literal}`, source: 'terminal' }),
    ).resolves.toEqual({
      commandId: 'docode.inspect',
      output: { kind: 'text', text: literal },
      status: 'success',
    });
    expect(received).toEqual([literal]);
    expect(Reflect.has(globalThis, '__docodeProbe')).toBe(false);
  });
});

function validateOneLiteral(arguments_: readonly string[]): CommandArgumentValidation<string> {
  const argument = arguments_.length === 1 ? arguments_[0] : undefined;
  return argument
    ? validCommandArguments(argument)
    : invalidCommandArguments('Expected one literal argument.');
}
