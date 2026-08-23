import { parseCommandInput } from '../commands/commandParser';
import type { CommandDispatchResult, CommandMetadata } from '../commands/commandTypes';
import { getWorkbenchTerminalHistoryEntry } from '../commands/workbenchCommands';
import {
  createVirtualLinuxCommandRegistry,
  type VirtualLinuxCommandContext,
} from './virtualLinuxCommands';
import {
  createCommandSuggestions,
  createVirtualLinuxSuggestions,
  type TerminalSuggestion,
} from './terminalCompletions';
import { VirtualFileSystem } from './virtualFileSystem';
import { parseVirtualShellInput } from './virtualShellParser';

export type TerminalSessionMode = 'docode' | 'linux';

export interface TerminalSessionExecution {
  readonly historyEntry: string | null;
  readonly result: CommandDispatchResult;
}

export type ExecuteDocodeCommand = (
  input: string,
  signal: AbortSignal,
) => Promise<CommandDispatchResult>;

const ENTRY_POINTS = ['terminal'] as const;
const ENTER_LINUX_COMMAND_ID = 'docode.terminal.enter-linux';
const EXIT_LINUX_COMMAND_ID = 'docode.terminal.exit-linux';
const DOCODE_BRIDGE_COMMAND_ID = 'docode.terminal.run-docode';
const MAX_VIRTUAL_HISTORY = 100;

const ENTER_LINUX_COMMAND = metadata({
  aliases: ['linux'],
  help: 'ld',
  id: ENTER_LINUX_COMMAND_ID,
  name: 'ld',
  title: 'Enter the virtual Linux session',
});

const EXIT_LINUX_COMMAND = metadata({
  help: 'exit',
  id: EXIT_LINUX_COMMAND_ID,
  name: 'exit',
  title: 'Leave the virtual Linux session',
});

const DOCODE_BRIDGE_COMMAND = metadata({
  help: 'docode <command>',
  id: DOCODE_BRIDGE_COMMAND_ID,
  name: 'docode',
  title: 'Run an allow-listed Linux DO command',
});

export class TerminalSession {
  readonly #virtualRegistry = createVirtualLinuxCommandRegistry();
  #fileSystem: VirtualFileSystem | null = null;
  #mode: TerminalSessionMode = 'docode';
  #username: string;
  #virtualHistory: readonly string[] = [];

  constructor(username: string | null = null) {
    this.#username = normalizeUsername(username);
  }

  get mode(): TerminalSessionMode {
    return this.#mode;
  }

  get prompt(): string {
    return this.getPrompt();
  }

  getPrompt(username?: string | null): string {
    const displayUsername = username === undefined ? this.#username : normalizeUsername(username);
    if (this.#mode === 'docode') {
      return displayUsername === 'guest' ? 'linux.do %' : `linux.do/${displayUsername} %`;
    }
    const fileSystem = this.#getFileSystem();
    const cwd =
      fileSystem.cwd === fileSystem.home
        ? '~'
        : fileSystem.cwd.startsWith(`${fileSystem.home}/`)
          ? `~${fileSystem.cwd.slice(fileSystem.home.length)}`
          : fileSystem.cwd;
    return `${displayUsername}@linux.do:${cwd}$`;
  }

  setUsername(username: string | null): void {
    this.#username = normalizeUsername(username);
  }

  getCommands(docodeCommands: readonly CommandMetadata[]): readonly CommandMetadata[] {
    return this.#mode === 'docode'
      ? [ENTER_LINUX_COMMAND, ...docodeCommands]
      : [...this.#virtualRegistry.commands, DOCODE_BRIDGE_COMMAND, EXIT_LINUX_COMMAND];
  }

  getSuggestions(
    docodeCommands: readonly CommandMetadata[],
    input: string,
    includeAll: boolean,
  ): readonly TerminalSuggestion[] {
    if (this.#mode === 'docode') {
      return createCommandSuggestions(this.getCommands(docodeCommands), input, includeAll);
    }
    return createVirtualLinuxSuggestions(
      this.getCommands(docodeCommands),
      docodeCommands,
      this.#getFileSystem(),
      input,
      includeAll,
    );
  }

  async execute(
    input: string,
    signal: AbortSignal,
    executeDocodeCommand: ExecuteDocodeCommand,
  ): Promise<TerminalSessionExecution> {
    const parsed =
      this.#mode === 'docode' ? parseCommandInput(input) : parseVirtualShellInput(input);
    if (parsed.status === 'empty') return { historyEntry: null, result: { status: 'empty' } };
    if (parsed.status === 'error') {
      return {
        historyEntry: null,
        result: failure(null, 'user-input-error', parsed.error.message),
      };
    }

    if (this.#mode === 'docode') {
      if (parsed.commandName === 'ld' || parsed.commandName === 'linux') {
        if (parsed.arguments.length > 0) {
          return {
            historyEntry: null,
            result: failure(ENTER_LINUX_COMMAND_ID, 'invalid-arguments', 'Usage: ld'),
          };
        }
        this.#mode = 'linux';
        this.#getFileSystem();
        return {
          historyEntry: 'ld',
          result: success(ENTER_LINUX_COMMAND_ID, [
            'DOCode virtual Linux session',
            'Extension-local filesystem ready. No host shell is executed.',
            'Run `help` for virtual commands, `docode help` for Linux DO commands, or `exit` to leave.',
          ]),
        };
      }
      const result = await executeDocodeCommand(input, signal);
      return {
        historyEntry: getWorkbenchTerminalHistoryEntry(input, result),
        result,
      };
    }

    if (parsed.commandName === 'exit') {
      if (parsed.arguments.length > 0) {
        return {
          historyEntry: null,
          result: failure(EXIT_LINUX_COMMAND_ID, 'invalid-arguments', 'Usage: exit'),
        };
      }
      this.#recordVirtualHistory('exit');
      this.#mode = 'docode';
      return {
        historyEntry: 'exit',
        result: success(EXIT_LINUX_COMMAND_ID, ['Left the virtual Linux session.']),
      };
    }

    if (parsed.commandName === 'docode') {
      if (parsed.arguments.length === 0) {
        return {
          historyEntry: null,
          result: failure(DOCODE_BRIDGE_COMMAND_ID, 'invalid-arguments', 'Usage: docode <command>'),
        };
      }
      const nestedInput = parsed.arguments.join(' ');
      const result = await executeDocodeCommand(nestedInput, signal);
      const nestedHistory = getWorkbenchTerminalHistoryEntry(nestedInput, result);
      const historyEntry = nestedHistory ? `docode ${nestedHistory}` : null;
      if (historyEntry) this.#recordVirtualHistory(historyEntry);
      return { historyEntry, result };
    }

    const canonicalInput = input.trim();
    this.#recordVirtualHistory(canonicalInput);
    const command = this.#virtualRegistry.resolve(parsed.commandName);
    if (!command) {
      return {
        historyEntry: null,
        result: failure(null, 'unknown-command', `Unknown command: ${parsed.commandName}`),
      };
    }
    const result = await this.#virtualRegistry.dispatchById({
      arguments: parsed.arguments,
      commandId: command.id,
      context: this.#createVirtualContext(),
      signal,
      source: 'terminal',
    });
    return {
      historyEntry: result.status === 'success' ? canonicalInput : null,
      result,
    };
  }

  #createVirtualContext(): VirtualLinuxCommandContext {
    return {
      fileSystem: this.#getFileSystem(),
      history: this.#virtualHistory,
      username: this.#username,
    };
  }

  #getFileSystem(): VirtualFileSystem {
    this.#fileSystem ??= new VirtualFileSystem(this.#username);
    return this.#fileSystem;
  }

  #recordVirtualHistory(input: string): void {
    this.#virtualHistory = [...this.#virtualHistory.slice(-(MAX_VIRTUAL_HISTORY - 1)), input];
  }
}

function failure(
  commandId: string | null,
  code: 'invalid-arguments' | 'unknown-command' | 'user-input-error',
  message: string,
): CommandDispatchResult {
  return {
    commandId,
    error: { code, message, retryable: false },
    status: 'error',
  };
}

function metadata(command: {
  readonly aliases?: readonly string[];
  readonly help: string;
  readonly id: string;
  readonly name: string;
  readonly title: string;
}): CommandMetadata {
  return Object.freeze({
    aliases: Object.freeze([...(command.aliases ?? [])]),
    entryPoints: ENTRY_POINTS,
    help: command.help,
    id: command.id,
    name: command.name,
    title: command.title,
  });
}

function normalizeUsername(username: string | null): string {
  const normalized = username
    ?.trim()
    .replace(/[^a-zA-Z0-9._-]+/gu, '-')
    .slice(0, 64);
  return normalized?.length ? normalized : 'guest';
}

function success(commandId: string, lines: readonly string[]): CommandDispatchResult {
  return { commandId, output: { kind: 'lines', lines }, status: 'success' };
}
