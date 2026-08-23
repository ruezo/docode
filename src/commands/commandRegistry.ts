import { parseCommandInput } from './commandParser';
import {
  COMMAND_ENTRY_POINTS,
  availableCommand,
  type CommandArgumentValidation,
  type CommandAvailability,
  type CommandDefinition,
  type CommandDispatchRequest,
  type CommandDispatchResult,
  type CommandEntryPoint,
  type CommandError,
  type CommandHandlerResult,
  type CommandInvocationRequest,
  type CommandMetadata,
} from './commandTypes';

interface PreparedCommand<TContext> {
  readonly execute: (
    context: TContext,
    source: CommandEntryPoint,
    signal: AbortSignal,
  ) => CommandHandlerResult | Promise<CommandHandlerResult>;
}

type PreparedCommandResult<TContext> =
  | { readonly valid: false; readonly message: string }
  | { readonly valid: true; readonly command: PreparedCommand<TContext> };

interface RegisteredCommand<TContext> {
  readonly getAvailability: (context: TContext) => CommandAvailability;
  readonly metadata: CommandMetadata;
  readonly prepare: (arguments_: readonly string[]) => PreparedCommandResult<TContext>;
}

const COMMAND_IDENTIFIER = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/u;
const ABORTED = Symbol('aborted-command');

export class CommandRegistrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CommandRegistrationError';
  }
}

export class CommandRegistry<TContext> {
  readonly #commandsById = new Map<string, RegisteredCommand<TContext>>();
  readonly #commandsByName = new Map<string, RegisteredCommand<TContext>>();

  get commands(): readonly CommandMetadata[] {
    return Array.from(this.#commandsById.values(), ({ metadata }) => metadata);
  }

  register<TArguments>(definition: CommandDefinition<TContext, TArguments>): void {
    const metadata = createMetadata(definition);
    if (this.#commandsById.has(metadata.id) || this.#commandsByName.has(metadata.id)) {
      throw new CommandRegistrationError(`Command ID is already registered: ${metadata.id}`);
    }

    const names = [metadata.name, ...metadata.aliases];
    const duplicateName = names.find(
      (name) => this.#commandsByName.has(name) || this.#commandsById.has(name),
    );
    if (duplicateName) {
      throw new CommandRegistrationError(`Command name is already registered: ${duplicateName}`);
    }

    const command: RegisteredCommand<TContext> = {
      getAvailability: definition.isAvailable ?? availableCommand,
      metadata,
      prepare: (arguments_) => prepareCommand(definition, arguments_),
    };
    this.#commandsById.set(metadata.id, command);
    for (const name of names) this.#commandsByName.set(name, command);
  }

  resolve(nameOrId: string): CommandMetadata | null {
    return (
      this.#commandsByName.get(nameOrId)?.metadata ??
      this.#commandsById.get(nameOrId)?.metadata ??
      null
    );
  }

  getAvailability(id: string, context: TContext, source: CommandEntryPoint): CommandAvailability {
    const command = this.#commandsById.get(id);
    if (!command) {
      return unavailable('unavailable', 'Command is not registered.', false);
    }
    if (!command.metadata.entryPoints.includes(source)) {
      return unavailable('unavailable', 'Command is unavailable from this entry point.', false);
    }
    return safelyResolveAvailability(command, context);
  }

  async dispatch(request: CommandDispatchRequest<TContext>): Promise<CommandDispatchResult> {
    const parsed = parseCommandInput(request.input);
    if (parsed.status === 'empty') return { status: 'empty' };
    if (parsed.status === 'error') {
      return failure(null, 'user-input-error', parsed.error.message, false);
    }

    const command = this.#commandsByName.get(parsed.commandName);
    if (!command) {
      return failure(
        null,
        'unknown-command',
        `Unknown command: ${safeCommandLabel(parsed.commandName)}`,
        false,
      );
    }
    return this.#dispatchCommand(command, parsed.arguments, request);
  }

  async dispatchById(request: CommandInvocationRequest<TContext>): Promise<CommandDispatchResult> {
    const command = this.#commandsById.get(request.commandId);
    if (!command) {
      return failure(
        null,
        'unknown-command',
        `Unknown command: ${safeCommandLabel(request.commandId)}`,
        false,
      );
    }
    return this.#dispatchCommand(command, request.arguments, request);
  }

  async #dispatchCommand(
    command: RegisteredCommand<TContext>,
    arguments_: readonly string[],
    request: Omit<CommandDispatchRequest<TContext>, 'input'>,
  ): Promise<CommandDispatchResult> {
    const { metadata } = command;
    if (!metadata.entryPoints.includes(request.source)) {
      return failure(
        metadata.id,
        'unavailable',
        'Command is unavailable from this entry point.',
        false,
      );
    }

    let prepared: PreparedCommandResult<TContext>;
    try {
      prepared = command.prepare(arguments_);
    } catch {
      return internalFailure(metadata.id);
    }
    if (!prepared.valid) {
      return failure(metadata.id, 'invalid-arguments', prepared.message, false);
    }

    const availability = safelyResolveAvailability(command, request.context);
    if (!availability.available) {
      return failure(metadata.id, availability.code, availability.message, availability.retryable);
    }

    const signal = request.signal ?? new AbortController().signal;
    if (signal.aborted) return abortedFailure(metadata.id);

    try {
      const execution = Promise.resolve(
        prepared.command.execute(request.context, request.source, signal),
      );
      const result = await waitForCommand(execution, signal);
      if (result === ABORTED) return abortedFailure(metadata.id);
      return addCommandId(metadata.id, result);
    } catch (error: unknown) {
      return wasCommandAborted(signal, error)
        ? abortedFailure(metadata.id)
        : internalFailure(metadata.id);
    }
  }
}

function createMetadata<TContext, TArguments>(
  definition: CommandDefinition<TContext, TArguments>,
): CommandMetadata {
  assertIdentifier(definition.id, 'ID');
  assertIdentifier(definition.name, 'name');
  if (!definition.title.trim()) throw new CommandRegistrationError('Command title is required.');
  if (definition.entryPoints.length === 0) {
    throw new CommandRegistrationError('Command must support at least one entry point.');
  }

  const aliases = [...(definition.aliases ?? [])];
  for (const alias of aliases) assertIdentifier(alias, 'alias');
  if (aliases.includes(definition.id)) {
    throw new CommandRegistrationError('Command aliases must not repeat the command ID.');
  }
  if (new Set([definition.name, ...aliases]).size !== aliases.length + 1) {
    throw new CommandRegistrationError('Command names and aliases must be unique.');
  }
  if (new Set(definition.entryPoints).size !== definition.entryPoints.length) {
    throw new CommandRegistrationError('Command entry points must be unique.');
  }
  if (definition.entryPoints.some((entryPoint) => !COMMAND_ENTRY_POINTS.includes(entryPoint))) {
    throw new CommandRegistrationError('Command entry point is not supported.');
  }

  const base = {
    aliases: Object.freeze(aliases),
    entryPoints: Object.freeze([...definition.entryPoints]),
    id: definition.id,
    name: definition.name,
    title: definition.title.trim(),
  };
  return Object.freeze(definition.help?.trim() ? { ...base, help: definition.help.trim() } : base);
}

function assertIdentifier(identifier: string, label: string): void {
  if (!COMMAND_IDENTIFIER.test(identifier)) {
    throw new CommandRegistrationError(
      `Command ${label} must use lowercase letters, numbers, dots, or hyphens: ${identifier}`,
    );
  }
}

function prepareCommand<TContext, TArguments>(
  definition: CommandDefinition<TContext, TArguments>,
  arguments_: readonly string[],
): PreparedCommandResult<TContext> {
  const validation: CommandArgumentValidation<TArguments> =
    definition.validateArguments(arguments_);
  if (!validation.valid) return validation;
  return {
    command: {
      execute: (context, source, signal) =>
        definition.execute({ arguments: validation.value, context, signal, source }),
    },
    valid: true,
  };
}

function safelyResolveAvailability<TContext>(
  command: RegisteredCommand<TContext>,
  context: TContext,
): CommandAvailability {
  try {
    return command.getAvailability(context);
  } catch {
    return unavailable(
      'compatibility-error',
      'Command availability could not be determined.',
      true,
    );
  }
}

function unavailable(
  code: 'authentication-required' | 'compatibility-error' | 'permission-required' | 'unavailable',
  message: string,
  retryable: boolean,
): CommandAvailability {
  return { available: false, code, message, retryable };
}

function failure(
  commandId: string | null,
  code: CommandError['code'],
  message: string,
  retryable: boolean,
): CommandDispatchResult {
  return { commandId, error: { code, message, retryable }, status: 'error' };
}

function abortedFailure(commandId: string): CommandDispatchResult {
  return failure(commandId, 'aborted', 'Command was cancelled.', true);
}

function internalFailure(commandId: string): CommandDispatchResult {
  return failure(commandId, 'internal-error', 'Command failed unexpectedly.', true);
}

function addCommandId(commandId: string, result: CommandHandlerResult): CommandDispatchResult {
  return result.status === 'success'
    ? result.output
      ? { commandId, output: result.output, status: 'success' }
      : { commandId, status: 'success' }
    : { commandId, error: result.error, status: 'error' };
}

function safeCommandLabel(name: string): string {
  return name.length <= 80 ? name : `${name.slice(0, 77)}...`;
}

function waitForCommand(
  execution: Promise<CommandHandlerResult>,
  signal: AbortSignal,
): Promise<CommandHandlerResult | typeof ABORTED> {
  if (signal.aborted) return Promise.resolve(ABORTED);
  return new Promise((resolve, reject) => {
    const abort = () => {
      resolve(ABORTED);
    };
    signal.addEventListener('abort', abort, { once: true });
    void execution.then(
      (result) => {
        signal.removeEventListener('abort', abort);
        resolve(result);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', abort);
        reject(error instanceof Error ? error : new Error('Command execution failed.'));
      },
    );
  });
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function wasCommandAborted(signal: AbortSignal, error: unknown): boolean {
  return signal.aborted || isAbortError(error);
}
