import type { CommandMetadata } from '../commands/commandTypes';
import type { VirtualFileSystem, VirtualFileStat } from './virtualFileSystem';

export interface TerminalSuggestion {
  readonly commandId: string;
  readonly detail: string;
  readonly insertText: string;
  readonly label: string;
}

const PATH_COMMANDS = new Set([
  'basename',
  'cat',
  'cd',
  'cp',
  'dirname',
  'find',
  'grep',
  'head',
  'ls',
  'mkdir',
  'mv',
  'rm',
  'sort',
  'stat',
  'tail',
  'touch',
  'tree',
  'uniq',
  'wc',
]);

interface CompletionToken {
  readonly quote: 'double' | 'single' | null;
  readonly start: number;
  readonly value: string;
}

interface CompletionContext {
  readonly current: CompletionToken;
  readonly tokens: readonly string[];
}

export function createCommandSuggestions(
  commands: readonly CommandMetadata[],
  input: string,
  includeAll: boolean,
): readonly TerminalSuggestion[] {
  if (input !== input.trimStart() || /[ \t]/u.test(input)) return [];
  if (!includeAll && input.length === 0) return [];

  return commands
    .filter(({ name }) => name.startsWith(input))
    .filter((command) => input !== command.name || commandAcceptsArguments(command))
    .map((command) => commandSuggestion(command));
}

export function createVirtualLinuxSuggestions(
  commands: readonly CommandMetadata[],
  docodeCommands: readonly CommandMetadata[],
  fileSystem: VirtualFileSystem,
  input: string,
  includeAll: boolean,
): readonly TerminalSuggestion[] {
  const context = readCompletionContext(input);
  if (!context) return [];
  if (context.tokens.length === 0) {
    return createCommandSuggestions(commands, context.current.value, includeAll);
  }

  const commandName = context.tokens[0];
  if (!commandName) return [];
  const command = commands.find(
    ({ aliases, name }) => name === commandName || aliases.includes(commandName),
  );
  if (!command) return [];

  if (command.name === 'docode') {
    if (context.tokens.length !== 1) return [];
    return createCommandSuggestions(docodeCommands, context.current.value, includeAll).map(
      (suggestion) => ({
        ...suggestion,
        commandId: `docode:${suggestion.commandId}`,
        insertText: `${input.slice(0, context.current.start)}${suggestion.insertText}`,
      }),
    );
  }

  const followsRedirection = context.tokens.at(-1) === '>' || context.tokens.at(-1) === '>>';
  if (!PATH_COMMANDS.has(command.name) && !followsRedirection) return [];
  if (context.current.value.startsWith('-')) return [];
  if (!includeAll && context.current.value.length === 0) return [];

  return createPathSuggestions({
    command,
    context,
    directoriesOnly: command.name === 'cd',
    fileSystem,
    input,
  });
}

function createPathSuggestions(options: {
  readonly command: CommandMetadata;
  readonly context: CompletionContext;
  readonly directoriesOnly: boolean;
  readonly fileSystem: VirtualFileSystem;
  readonly input: string;
}): readonly TerminalSuggestion[] {
  const { command, context, directoriesOnly, fileSystem, input } = options;
  const slashIndex = context.current.value.lastIndexOf('/');
  const parentPrefix = slashIndex < 0 ? '' : context.current.value.slice(0, slashIndex + 1);
  const namePrefix = context.current.value.slice(slashIndex + 1);
  let entries: readonly VirtualFileStat[];
  try {
    entries = fileSystem.list(parentPrefix || '.');
  } catch {
    return [];
  }

  return entries
    .filter((entry) => !directoriesOnly || entry.type === 'directory')
    .filter((entry) => basename(entry.path).startsWith(namePrefix))
    .map((entry) => {
      const directory = entry.type === 'directory';
      const name = `${basename(entry.path)}${directory ? '/' : ''}`;
      const completedPath = `${parentPrefix}${name}`;
      return {
        commandId: `${command.id}:${entry.path}`,
        detail: `${directory ? 'Folder' : 'File'} · ${formatShellPath(fileSystem, entry.path)}`,
        insertText: `${input.slice(0, context.current.start)}${encodeCompletion(
          completedPath,
          context.current.quote,
          directory,
        )}`,
        label: name,
      };
    });
}

function readCompletionContext(input: string): CompletionContext | null {
  const tokens: string[] = [];
  let current = '';
  let quote: CompletionToken['quote'] = null;
  let escaping = false;
  let tokenStarted = false;
  let tokenStart = input.length;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character === undefined) continue;
    if (escaping) {
      current += character;
      escaping = false;
      continue;
    }
    if (character === '\\' && quote !== 'single') {
      if (!tokenStarted) {
        tokenStarted = true;
        tokenStart = index;
      }
      escaping = true;
      continue;
    }
    if (character === "'" && quote !== 'double') {
      if (!tokenStarted) {
        tokenStarted = true;
        tokenStart = index;
      }
      quote = quote === 'single' ? null : 'single';
      continue;
    }
    if (character === '"' && quote !== 'single') {
      if (!tokenStarted) {
        tokenStarted = true;
        tokenStart = index;
      }
      quote = quote === 'double' ? null : 'double';
      continue;
    }
    if (quote === null && /[ \t]/u.test(character)) {
      if (tokenStarted) {
        tokens.push(current);
        current = '';
        tokenStarted = false;
        tokenStart = input.length;
      }
      continue;
    }
    if (quote === null && character === '>') {
      if (tokenStarted) {
        tokens.push(current);
        current = '';
        tokenStarted = false;
        tokenStart = input.length;
      }
      const append = input[index + 1] === '>';
      tokens.push(append ? '>>' : '>');
      if (append) index += 1;
      continue;
    }
    if (quote === null && isUnsupportedOperator(character)) return null;
    if (!tokenStarted) {
      tokenStarted = true;
      tokenStart = index;
    }
    current += character;
  }

  if (escaping) return null;
  return {
    current: {
      quote,
      start: tokenStarted ? tokenStart : input.length,
      value: tokenStarted ? current : '',
    },
    tokens,
  };
}

function encodeCompletion(
  value: string,
  quote: CompletionToken['quote'],
  directory: boolean,
): string {
  if (quote === 'single') {
    const escaped = value.replace(/'/gu, "'\\''");
    return directory ? `'${escaped}` : `'${escaped}' `;
  }
  if (quote === 'double') {
    const escaped = value.replace(/[\\"]/gu, '\\$&');
    return directory ? `"${escaped}` : `"${escaped}" `;
  }
  const escaped = value.replace(/[\\\s'"|&;<>`]/gu, '\\$&');
  return directory ? escaped : `${escaped} `;
}

function commandSuggestion(command: CommandMetadata): TerminalSuggestion {
  return {
    commandId: command.id,
    detail: command.title,
    insertText: commandAcceptsArguments(command) ? `${command.name} ` : command.name,
    label: command.help ?? command.name,
  };
}

function commandAcceptsArguments(command: CommandMetadata): boolean {
  return Boolean(command.help && command.help !== command.name);
}

function formatShellPath(fileSystem: VirtualFileSystem, path: string): string {
  return path === fileSystem.home
    ? '~'
    : path.startsWith(`${fileSystem.home}/`)
      ? `~${path.slice(fileSystem.home.length)}`
      : path;
}

function basename(path: string): string {
  return path === '/' ? '/' : (path.split('/').filter(Boolean).at(-1) ?? '/');
}

function isUnsupportedOperator(character: string): boolean {
  return (
    character === '|' ||
    character === '&' ||
    character === ';' ||
    character === '<' ||
    character === '`'
  );
}
