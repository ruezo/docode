import { describe, expect, it, vi } from 'vitest';

import { CommandRegistrationError, CommandRegistry } from '../../src/commands/commandRegistry';
import {
  invalidCommandArguments,
  validCommandArguments,
  type CommandArgumentValidation,
  type CommandDefinition,
} from '../../src/commands/commandTypes';

interface TestContext {
  readonly authenticated: boolean;
  readonly route: 'list' | 'topic';
}

const context: TestContext = { authenticated: true, route: 'topic' };

describe('CommandRegistry', () => {
  it('registers stable metadata, exact aliases, and typed execution', async () => {
    const registry = new CommandRegistry<TestContext>();
    const execute = vi.fn(
      ({ arguments: floor, context: current, signal, source }: CommandExecutionRequest) => ({
        output: {
          kind: 'text' as const,
          text: `${current.route}:${String(floor)}:${source}:${String(signal.aborted)}`,
        },
        status: 'success' as const,
      }),
    );
    registry.register({
      aliases: ['go'],
      entryPoints: ['terminal', 'palette'],
      execute,
      help: 'Go to a loaded floor.',
      id: 'linuxdo.goto',
      name: 'goto',
      title: 'Linux DO: Go to Floor',
      validateArguments: validateFloor,
    });

    expect(registry.commands).toEqual([
      {
        aliases: ['go'],
        entryPoints: ['terminal', 'palette'],
        help: 'Go to a loaded floor.',
        id: 'linuxdo.goto',
        name: 'goto',
        title: 'Linux DO: Go to Floor',
      },
    ]);
    expect(Object.isFrozen(registry.commands[0])).toBe(true);
    expect(registry.resolve('go')?.id).toBe('linuxdo.goto');
    expect(registry.resolve('linuxdo.goto')?.name).toBe('goto');
    expect(await registry.dispatch({ context, input: 'go 42', source: 'terminal' })).toEqual({
      commandId: 'linuxdo.goto',
      output: { kind: 'text', text: 'topic:42:terminal:false' },
      status: 'success',
    });
    expect(
      await registry.dispatchById({
        arguments: ['7'],
        commandId: 'linuxdo.goto',
        context,
        source: 'palette',
      }),
    ).toEqual({
      commandId: 'linuxdo.goto',
      output: { kind: 'text', text: 'topic:7:palette:false' },
      status: 'success',
    });
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('rejects invalid definitions and duplicate IDs, names, or aliases', () => {
    const registry = new CommandRegistry<TestContext>();
    registry.register(noArgumentCommand('docode.help', 'help'));

    expect(() => {
      registry.register(noArgumentCommand('docode.help', 'different'));
    }).toThrow(/ID is already registered/u);
    expect(() => {
      registry.register(noArgumentCommand('docode.other', 'help'));
    }).toThrow(/name is already registered/u);
    expect(() => {
      registry.register({ ...noArgumentCommand('docode.other', 'other'), aliases: ['help'] });
    }).toThrow(/name is already registered/u);
    expect(() => {
      registry.register(noArgumentCommand('help', 'other'));
    }).toThrow(/ID is already registered/u);
    expect(() => {
      registry.register(noArgumentCommand('docode.other', 'docode.help'));
    }).toThrow(/name is already registered/u);
    expect(() => {
      registry.register(noArgumentCommand('Invalid ID', 'invalid'));
    }).toThrow(CommandRegistrationError);
    expect(() => {
      registry.register({
        ...noArgumentCommand('docode.aliases', 'aliases'),
        aliases: ['same', 'same'],
      });
    }).toThrow(/must be unique/u);
    expect(() => {
      registry.register({
        ...noArgumentCommand('docode.alias-id', 'alias-id'),
        aliases: ['docode.alias-id'],
      });
    }).toThrow(/must not repeat the command ID/u);
    expect(() => {
      registry.register({
        ...noArgumentCommand('docode.sources', 'sources'),
        entryPoints: ['terminal', 'terminal'],
      });
    }).toThrow(/entry points must be unique/u);
  });

  it('does not execute empty, unknown, malformed, invalid, or wrong-entry-point input', async () => {
    const execute = vi.fn(() => ({ status: 'success' as const }));
    const registry = new CommandRegistry<TestContext>();
    registry.register({
      ...noArgumentCommand('docode.clear', 'clear'),
      execute,
    });

    await expect(registry.dispatch({ context, input: ' ', source: 'terminal' })).resolves.toEqual({
      status: 'empty',
    });
    await expect(
      registry.dispatch({ context, input: 'missing', source: 'terminal' }),
    ).resolves.toMatchObject({
      commandId: null,
      error: { code: 'unknown-command' },
      status: 'error',
    });
    await expect(
      registry.dispatch({ context, input: 'clear extra', source: 'terminal' }),
    ).resolves.toMatchObject({
      commandId: 'docode.clear',
      error: { code: 'invalid-arguments' },
      status: 'error',
    });
    await expect(
      registry.dispatch({ context, input: 'clear\nhelp', source: 'terminal' }),
    ).resolves.toMatchObject({
      commandId: null,
      error: { code: 'user-input-error' },
      status: 'error',
    });
    await expect(
      registry.dispatch({ context, input: 'clear', source: 'palette' }),
    ).resolves.toMatchObject({
      commandId: 'docode.clear',
      error: { code: 'unavailable' },
      status: 'error',
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it('checks explicit availability before execution', async () => {
    const execute = vi.fn(() => ({ status: 'success' as const }));
    const registry = new CommandRegistry<TestContext>();
    registry.register({
      ...noArgumentCommand('linuxdo.reply', 'reply'),
      execute,
      isAvailable: (current) =>
        current.authenticated
          ? { available: true }
          : {
              available: false,
              code: 'authentication-required',
              message: 'Sign in to Linux DO to reply.',
              retryable: false,
            },
    });

    const signedOut = { authenticated: false, route: 'topic' } as const;
    expect(registry.getAvailability('linuxdo.reply', signedOut, 'terminal')).toEqual({
      available: false,
      code: 'authentication-required',
      message: 'Sign in to Linux DO to reply.',
      retryable: false,
    });
    await expect(
      registry.dispatch({ context: signedOut, input: 'reply', source: 'terminal' }),
    ).resolves.toMatchObject({
      commandId: 'linuxdo.reply',
      error: { code: 'authentication-required' },
      status: 'error',
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it('preserves structured native, stale, and safe display results', async () => {
    const registry = new CommandRegistry<TestContext>();
    registry.register({
      ...noArgumentCommand('linuxdo.like', 'like'),
      execute: () => ({
        error: {
          code: 'native-action-failed',
          message: 'Linux DO did not confirm the Like.',
          retryable: true,
        },
        status: 'error',
      }),
    });
    registry.register({
      ...noArgumentCommand('linuxdo.stale', 'stale'),
      execute: () => ({
        error: { code: 'stale', message: 'The route changed.', retryable: true },
        status: 'error',
      }),
    });
    registry.register({
      ...noArgumentCommand('docode.lines', 'lines'),
      execute: () => ({
        output: { kind: 'lines', lines: ['one', '<b>plain text only</b>'] },
        status: 'success',
      }),
    });

    await expect(
      registry.dispatch({ context, input: 'like', source: 'terminal' }),
    ).resolves.toMatchObject({ error: { code: 'native-action-failed' }, status: 'error' });
    await expect(
      registry.dispatch({ context, input: 'stale', source: 'terminal' }),
    ).resolves.toMatchObject({ error: { code: 'stale' }, status: 'error' });
    await expect(
      registry.dispatch({ context, input: 'lines', source: 'terminal' }),
    ).resolves.toEqual({
      commandId: 'docode.lines',
      output: { kind: 'lines', lines: ['one', '<b>plain text only</b>'] },
      status: 'success',
    });
  });

  it('returns cancellation before or during execution and passes the same AbortSignal', async () => {
    const registry = new CommandRegistry<TestContext>();
    const execute = vi.fn(
      ({ signal }: { readonly signal: AbortSignal }) =>
        new Promise<CommandHandlerResult>((resolve) => {
          signal.addEventListener(
            'abort',
            () => {
              resolve({ status: 'success' });
            },
            { once: true },
          );
        }),
    );
    registry.register({ ...noArgumentCommand('docode.wait', 'wait'), execute });

    const alreadyAborted = new AbortController();
    alreadyAborted.abort();
    await expect(
      registry.dispatch({
        context,
        input: 'wait',
        signal: alreadyAborted.signal,
        source: 'terminal',
      }),
    ).resolves.toMatchObject({ error: { code: 'aborted' }, status: 'error' });
    expect(execute).not.toHaveBeenCalled();

    const active = new AbortController();
    const pending = registry.dispatch({
      context,
      input: 'wait',
      signal: active.signal,
      source: 'terminal',
    });
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ signal: active.signal }));
    active.abort();
    await expect(pending).resolves.toMatchObject({
      commandId: 'docode.wait',
      error: { code: 'aborted' },
      status: 'error',
    });
  });

  it('contains validator, availability, and execution exceptions behind generic errors', async () => {
    const registry = new CommandRegistry<TestContext>();
    registry.register({
      ...noArgumentCommand('docode.validation-error', 'validation-error'),
      validateArguments: () => {
        throw new Error('private validation detail');
      },
    });
    registry.register({
      ...noArgumentCommand('docode.availability-error', 'availability-error'),
      isAvailable: () => {
        throw new Error('private availability detail');
      },
    });
    registry.register({
      ...noArgumentCommand('docode.execution-error', 'execution-error'),
      execute: () => {
        throw new Error('private execution detail');
      },
    });

    await expect(
      registry.dispatch({ context, input: 'validation-error', source: 'terminal' }),
    ).resolves.toEqual({
      commandId: 'docode.validation-error',
      error: { code: 'internal-error', message: 'Command failed unexpectedly.', retryable: true },
      status: 'error',
    });
    await expect(
      registry.dispatch({ context, input: 'availability-error', source: 'terminal' }),
    ).resolves.toMatchObject({
      error: {
        code: 'compatibility-error',
        message: 'Command availability could not be determined.',
      },
      status: 'error',
    });
    await expect(
      registry.dispatch({ context, input: 'execution-error', source: 'terminal' }),
    ).resolves.toEqual({
      commandId: 'docode.execution-error',
      error: { code: 'internal-error', message: 'Command failed unexpectedly.', retryable: true },
      status: 'error',
    });
  });
});

type CommandExecutionRequest = Parameters<CommandDefinition<TestContext, number>['execute']>[0];
type CommandHandlerResult = Awaited<
  ReturnType<CommandDefinition<TestContext, undefined>['execute']>
>;

function validateFloor(arguments_: readonly string[]): CommandArgumentValidation<number> {
  if (arguments_.length !== 1) return invalidCommandArguments('Expected one floor number.');
  const floor = Number(arguments_[0]);
  return Number.isSafeInteger(floor) && floor > 0 && floor <= 100_000
    ? validCommandArguments(floor)
    : invalidCommandArguments('Floor must be an integer from 1 to 100000.');
}

function noArgumentCommand(id: string, name: string): CommandDefinition<TestContext, undefined> {
  return {
    entryPoints: ['terminal'],
    execute: () => ({ status: 'success' }),
    id,
    name,
    title: name,
    validateArguments: (arguments_) =>
      arguments_.length === 0
        ? validCommandArguments(undefined)
        : invalidCommandArguments('This command accepts no arguments.'),
  };
}
