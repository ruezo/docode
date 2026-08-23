export const COMMAND_ENTRY_POINTS = [
  'terminal',
  'palette',
  'keybinding',
  'context-menu',
  'editor-action',
  'status-bar',
] as const;

export type CommandEntryPoint = (typeof COMMAND_ENTRY_POINTS)[number];

export type CommandErrorCode =
  | 'aborted'
  | 'authentication-required'
  | 'compatibility-error'
  | 'internal-error'
  | 'invalid-arguments'
  | 'native-action-failed'
  | 'permission-required'
  | 'stale'
  | 'unavailable'
  | 'unknown-command'
  | 'user-input-error';

export interface CommandError {
  readonly code: CommandErrorCode;
  readonly message: string;
  readonly retryable: boolean;
}

export type CommandAvailabilityErrorCode = Extract<
  CommandErrorCode,
  'authentication-required' | 'compatibility-error' | 'permission-required' | 'unavailable'
>;

export type CommandAvailability =
  | { readonly available: true }
  | {
      readonly available: false;
      readonly code: CommandAvailabilityErrorCode;
      readonly message: string;
      readonly retryable: boolean;
    };

export type CommandOutput =
  | { readonly kind: 'lines'; readonly lines: readonly string[] }
  | { readonly kind: 'text'; readonly text: string };

export type CommandHandlerResult =
  | { readonly status: 'error'; readonly error: CommandError }
  | { readonly status: 'success'; readonly output?: CommandOutput };

export type CommandDispatchResult =
  | { readonly status: 'empty' }
  | { readonly status: 'error'; readonly commandId: string | null; readonly error: CommandError }
  | { readonly status: 'success'; readonly commandId: string; readonly output?: CommandOutput };

export type CommandArgumentValidation<TArguments> =
  | { readonly valid: true; readonly value: TArguments }
  | { readonly valid: false; readonly message: string };

export interface CommandExecutionRequest<TContext, TArguments> {
  readonly arguments: TArguments;
  readonly context: TContext;
  readonly signal: AbortSignal;
  readonly source: CommandEntryPoint;
}

export interface CommandDefinition<TContext, TArguments> {
  readonly aliases?: readonly string[];
  readonly entryPoints: readonly [CommandEntryPoint, ...CommandEntryPoint[]];
  readonly execute: (
    request: CommandExecutionRequest<TContext, TArguments>,
  ) => CommandHandlerResult | Promise<CommandHandlerResult>;
  readonly help?: string;
  readonly id: string;
  readonly isAvailable?: (context: TContext) => CommandAvailability;
  readonly name: string;
  readonly title: string;
  readonly validateArguments: (
    arguments_: readonly string[],
  ) => CommandArgumentValidation<TArguments>;
}

export interface CommandMetadata {
  readonly aliases: readonly string[];
  readonly entryPoints: readonly CommandEntryPoint[];
  readonly help?: string;
  readonly id: string;
  readonly name: string;
  readonly title: string;
}

export interface CommandDispatchRequest<TContext> {
  readonly context: TContext;
  readonly input: string;
  readonly signal?: AbortSignal;
  readonly source: CommandEntryPoint;
}

export interface CommandInvocationRequest<TContext> {
  readonly arguments: readonly string[];
  readonly commandId: string;
  readonly context: TContext;
  readonly signal?: AbortSignal;
  readonly source: CommandEntryPoint;
}

export function availableCommand(): CommandAvailability {
  return { available: true };
}

export function validCommandArguments<TArguments>(
  value: TArguments,
): CommandArgumentValidation<TArguments> {
  return { valid: true, value };
}

export function invalidCommandArguments(message: string): CommandArgumentValidation<never> {
  return { message, valid: false };
}
