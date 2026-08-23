import { CommandRegistry } from '../commands/commandRegistry';
import {
  invalidCommandArguments,
  validCommandArguments,
  type CommandArgumentValidation,
  type CommandHandlerResult,
} from '../commands/commandTypes';
import {
  VirtualFileSystem,
  VirtualFileSystemError,
  type VirtualFileStat,
} from './virtualFileSystem';

export const VIRTUAL_LINUX_CLEAR_COMMAND_ID = 'docode.terminal.clear';

export interface VirtualLinuxCommandContext {
  readonly fileSystem: VirtualFileSystem;
  readonly history: readonly string[];
  readonly username: string;
}

const ENTRY_POINT = ['terminal'] as const;

export function createVirtualLinuxCommandRegistry(): CommandRegistry<VirtualLinuxCommandContext> {
  const registry = new CommandRegistry<VirtualLinuxCommandContext>();

  registerNoArgument(registry, 'virtual.pwd', 'pwd', 'Print working directory', ({ fileSystem }) =>
    success(fileSystem.cwd),
  );
  registerNoArgument(registry, 'virtual.whoami', 'whoami', 'Print current user', ({ username }) =>
    success(username),
  );
  registerNoArgument(registry, 'virtual.hostname', 'hostname', 'Print virtual host name', () =>
    success('linux.do'),
  );
  registerNoArgument(registry, 'virtual.id', 'id', 'Print virtual user identity', ({ username }) =>
    success(`uid=1000(${username}) gid=1000(${username}) groups=1000(${username}),100(users)`),
  );
  registerNoArgument(registry, 'virtual.uname', 'uname', 'Print virtual system information', () =>
    success('Linux docode 6.8.0-virtual #1 SMP WebExtension x86_64 GNU/Linux'),
  );
  registerNoArgument(registry, 'virtual.date', 'date', 'Print current date and time', () =>
    success(new Date().toString()),
  );
  registerNoArgument(registry, 'virtual.env', 'env', 'Print virtual environment', (context) =>
    successLines(formatEnvironment(context)),
  );
  registry.register<string | null>({
    entryPoints: ENTRY_POINT,
    execute: ({ arguments: name, context }) => {
      const environment = virtualEnvironment(context);
      return name ? success(environment[name] ?? '') : successLines(formatEnvironment(context));
    },
    help: 'printenv [name]',
    id: 'virtual.printenv',
    name: 'printenv',
    title: 'Print virtual environment variables',
    validateArguments: (arguments_) =>
      arguments_.length <= 1
        ? validCommandArguments(arguments_[0] ?? null)
        : invalidCommandArguments('Usage: printenv [name]'),
  });
  registerNoArgument(
    registry,
    'virtual.history',
    'history',
    'List virtual session history',
    ({ history }) =>
      successLines(
        history.map((entry, index) => `${String(index + 1).padStart(4, ' ')}  ${entry}`),
      ),
  );

  registry.register<{ readonly all: boolean; readonly path: string }>({
    entryPoints: ENTRY_POINT,
    execute: ({ arguments: options, context }) =>
      withFileSystem(() => {
        const stats = context.fileSystem.list(options.path);
        return successLines(stats.map((stat) => formatListEntry(stat, options.all)));
      }),
    help: 'ls [-la] [path]',
    id: 'virtual.ls',
    name: 'ls',
    title: 'List directory contents',
    validateArguments: validateLs,
  });

  registry.register<string>({
    entryPoints: ENTRY_POINT,
    execute: ({ arguments: path, context }) =>
      withFileSystem(() => success(context.fileSystem.changeDirectory(path))),
    help: 'cd [path]',
    id: 'virtual.cd',
    name: 'cd',
    title: 'Change working directory',
    validateArguments: (arguments_) =>
      arguments_.length <= 1
        ? validCommandArguments(arguments_[0] ?? '~')
        : invalidCommandArguments('Usage: cd [path]'),
  });

  registry.register<{ readonly paths: readonly string[]; readonly recursive: boolean }>({
    entryPoints: ENTRY_POINT,
    execute: ({ arguments: options, context }) =>
      withFileSystem(() => {
        options.paths.forEach((path) => {
          context.fileSystem.makeDirectory(path, options.recursive);
        });
        return success();
      }),
    help: 'mkdir [-p] <path...>',
    id: 'virtual.mkdir',
    name: 'mkdir',
    title: 'Create directories',
    validateArguments: (arguments_) => validatePathList(arguments_, '-p', 'mkdir'),
  });

  registry.register<readonly string[]>({
    entryPoints: ENTRY_POINT,
    execute: ({ arguments: paths, context }) =>
      withFileSystem(() => {
        paths.forEach((path) => {
          context.fileSystem.touch(path);
        });
        return success();
      }),
    help: 'touch <file...>',
    id: 'virtual.touch',
    name: 'touch',
    title: 'Create files or update timestamps',
    validateArguments: (arguments_) => requireArguments(arguments_, 'Usage: touch <file...>'),
  });

  registry.register<readonly string[]>({
    entryPoints: ENTRY_POINT,
    execute: ({ arguments: paths, context }) =>
      withFileSystem(() =>
        successLines(
          paths.flatMap((path, index) => {
            const content = context.fileSystem.readFile(path).split('\n');
            return paths.length > 1
              ? [`${index > 0 ? '\n' : ''}==> ${path} <==`, ...content]
              : content;
          }),
        ),
      ),
    help: 'cat <file...>',
    id: 'virtual.cat',
    name: 'cat',
    title: 'Print file contents',
    validateArguments: (arguments_) => requireArguments(arguments_, 'Usage: cat <file...>'),
  });

  registry.register<{ readonly count: number; readonly path: string }>({
    entryPoints: ENTRY_POINT,
    execute: ({ arguments: options, context }) =>
      withFileSystem(() =>
        successLines(context.fileSystem.readFile(options.path).split('\n').slice(0, options.count)),
      ),
    help: 'head [-n count] <file>',
    id: 'virtual.head',
    name: 'head',
    title: 'Print the first lines of a file',
    validateArguments: (arguments_) => validateLineRead(arguments_, 'head'),
  });

  registry.register<{ readonly count: number; readonly path: string }>({
    entryPoints: ENTRY_POINT,
    execute: ({ arguments: options, context }) =>
      withFileSystem(() =>
        successLines(context.fileSystem.readFile(options.path).split('\n').slice(-options.count)),
      ),
    help: 'tail [-n count] <file>',
    id: 'virtual.tail',
    name: 'tail',
    title: 'Print the last lines of a file',
    validateArguments: (arguments_) => validateLineRead(arguments_, 'tail'),
  });

  registry.register<{
    readonly append: boolean;
    readonly path: string | null;
    readonly text: string;
  }>({
    entryPoints: ENTRY_POINT,
    execute: ({ arguments: options, context }) =>
      withFileSystem(() => {
        if (!options.path) return success(options.text);
        const previous = options.append ? readOptional(context.fileSystem, options.path) : '';
        context.fileSystem.writeFile(options.path, `${previous}${options.text}\n`);
        return success();
      }),
    help: 'echo <text> [> file | >> file]',
    id: 'virtual.echo',
    name: 'echo',
    title: 'Print text or write a virtual file',
    validateArguments: validateEcho,
  });

  registry.register<{
    readonly ignoreCase: boolean;
    readonly pattern: string;
    readonly path: string;
  }>({
    entryPoints: ENTRY_POINT,
    execute: ({ arguments: options, context }) =>
      withFileSystem(() => {
        const pattern = options.ignoreCase ? options.pattern.toLocaleLowerCase() : options.pattern;
        const lines = context.fileSystem.readFile(options.path).split('\n');
        return successLines(
          lines
            .map((line, index) => ({ index, line }))
            .filter(({ line }) =>
              (options.ignoreCase ? line.toLocaleLowerCase() : line).includes(pattern),
            )
            .map(({ index, line }) => `${String(index + 1)}:${line}`),
        );
      }),
    help: 'grep [-i] <literal> <file>',
    id: 'virtual.grep',
    name: 'grep',
    title: 'Find literal text in a file',
    validateArguments: validateGrep,
  });

  registry.register<{ readonly fragment: string | null; readonly path: string }>({
    entryPoints: ENTRY_POINT,
    execute: ({ arguments: options, context }) =>
      withFileSystem(() => successLines(context.fileSystem.find(options.path, options.fragment))),
    help: 'find [path] [-name fragment]',
    id: 'virtual.find',
    name: 'find',
    title: 'Find virtual files and directories',
    validateArguments: validateFind,
  });

  registry.register<string>({
    entryPoints: ENTRY_POINT,
    execute: ({ arguments: path, context }) =>
      withFileSystem(() => successLines(context.fileSystem.tree(path))),
    help: 'tree [path]',
    id: 'virtual.tree',
    name: 'tree',
    title: 'Display a directory tree',
    validateArguments: (arguments_) =>
      arguments_.length <= 1
        ? validCommandArguments(arguments_[0] ?? '.')
        : invalidCommandArguments('Usage: tree [path]'),
  });

  registry.register<{
    readonly recursive: boolean;
    readonly source: string;
    readonly target: string;
  }>({
    entryPoints: ENTRY_POINT,
    execute: ({ arguments: options, context }) =>
      withFileSystem(() => {
        context.fileSystem.copy(options.source, options.target, options.recursive);
        return success();
      }),
    help: 'cp [-r] <source> <target>',
    id: 'virtual.cp',
    name: 'cp',
    title: 'Copy virtual files or directories',
    validateArguments: validateCopy,
  });

  registry.register<readonly [string, string]>({
    entryPoints: ENTRY_POINT,
    execute: ({ arguments: [source, target], context }) =>
      withFileSystem(() => {
        context.fileSystem.move(source, target);
        return success();
      }),
    help: 'mv <source> <target>',
    id: 'virtual.mv',
    name: 'mv',
    title: 'Move or rename virtual paths',
    validateArguments: (arguments_) =>
      arguments_.length === 2 && arguments_[0] && arguments_[1]
        ? validCommandArguments([arguments_[0], arguments_[1]] as const)
        : invalidCommandArguments('Usage: mv <source> <target>'),
  });

  registry.register<{
    readonly force: boolean;
    readonly paths: readonly string[];
    readonly recursive: boolean;
  }>({
    entryPoints: ENTRY_POINT,
    execute: ({ arguments: options, context }) =>
      withFileSystem(() => {
        options.paths.forEach((path) => {
          context.fileSystem.remove(path, options.recursive, options.force);
        });
        return success();
      }),
    help: 'rm [-rf] <path...>',
    id: 'virtual.rm',
    name: 'rm',
    title: 'Remove virtual paths only',
    validateArguments: validateRemove,
  });

  registry.register<string>({
    entryPoints: ENTRY_POINT,
    execute: ({ arguments: path, context }) =>
      withFileSystem(() => {
        const content = context.fileSystem.readFile(path);
        const bytes = new TextEncoder().encode(content).length;
        const lines = content.length === 0 ? 0 : content.split('\n').length;
        const words = content.trim() ? content.trim().split(/\s+/u).length : 0;
        return success(`${String(lines)} ${String(words)} ${String(bytes)} ${path}`);
      }),
    help: 'wc <file>',
    id: 'virtual.wc',
    name: 'wc',
    title: 'Count lines, words, and bytes',
    validateArguments: (arguments_) =>
      arguments_.length === 1 && arguments_[0]
        ? validCommandArguments(arguments_[0])
        : invalidCommandArguments('Usage: wc <file>'),
  });

  registry.register<string>({
    entryPoints: ENTRY_POINT,
    execute: ({ arguments: path, context }) =>
      success(context.fileSystem.resolve(path).split('/').filter(Boolean).at(-1) ?? '/'),
    help: 'basename <path>',
    id: 'virtual.basename',
    name: 'basename',
    title: 'Print the final path component',
    validateArguments: (arguments_) => validateSinglePath(arguments_, 'basename'),
  });

  registry.register<string>({
    entryPoints: ENTRY_POINT,
    execute: ({ arguments: path, context }) => {
      const resolved = context.fileSystem.resolve(path);
      const segments = resolved.split('/').filter(Boolean);
      segments.pop();
      return success(`/${segments.join('/')}`);
    },
    help: 'dirname <path>',
    id: 'virtual.dirname',
    name: 'dirname',
    title: 'Print the parent path',
    validateArguments: (arguments_) => validateSinglePath(arguments_, 'dirname'),
  });

  registry.register<string>({
    entryPoints: ENTRY_POINT,
    execute: ({ arguments: path, context }) =>
      withFileSystem(() => {
        const stat = context.fileSystem.stat(path);
        const mode = stat.type === 'directory' ? 'directory (0755)' : 'regular file (0644)';
        return successLines([
          `  File: ${stat.path}`,
          `  Size: ${String(stat.size).padEnd(10, ' ')} Type: ${mode}`,
          `Modify: ${new Date(stat.modifiedAt).toISOString()}`,
        ]);
      }),
    help: 'stat <path>',
    id: 'virtual.stat',
    name: 'stat',
    title: 'Display virtual file status',
    validateArguments: (arguments_) => validateSinglePath(arguments_, 'stat'),
  });

  registry.register<{ readonly reverse: boolean; readonly path: string }>({
    entryPoints: ENTRY_POINT,
    execute: ({ arguments: options, context }) =>
      withFileSystem(() => {
        const lines = context.fileSystem
          .readFile(options.path)
          .split('\n')
          .sort((left, right) => left.localeCompare(right));
        if (options.reverse) lines.reverse();
        return successLines(lines);
      }),
    help: 'sort [-r] <file>',
    id: 'virtual.sort',
    name: 'sort',
    title: 'Sort lines in a virtual file',
    validateArguments: (arguments_) => validateSort(arguments_),
  });

  registry.register<string>({
    entryPoints: ENTRY_POINT,
    execute: ({ arguments: path, context }) =>
      withFileSystem(() => {
        const lines = context.fileSystem.readFile(path).split('\n');
        return successLines(
          lines.filter((line, index) => index === 0 || line !== lines[index - 1]),
        );
      }),
    help: 'uniq <file>',
    id: 'virtual.uniq',
    name: 'uniq',
    title: 'Remove adjacent duplicate lines',
    validateArguments: (arguments_) => validateSinglePath(arguments_, 'uniq'),
  });

  registry.register<undefined>({
    entryPoints: ENTRY_POINT,
    execute: () => ({ status: 'success' }),
    help: 'clear',
    id: VIRTUAL_LINUX_CLEAR_COMMAND_ID,
    name: 'clear',
    title: 'Clear terminal output',
    validateArguments: noArguments,
  });

  registry.register<undefined>({
    entryPoints: ENTRY_POINT,
    execute: () =>
      successLines([
        'Virtual Linux commands:',
        ...registry.commands.map(({ help, name, title }) => `${help ?? name} — ${title}`),
        'docode <command> — Run an allow-listed Linux DO command',
        'exit — Leave the virtual Linux session',
      ]),
    help: 'help',
    id: 'virtual.help',
    name: 'help',
    title: 'List virtual Linux commands',
    validateArguments: noArguments,
  });

  return registry;
}

function formatListEntry(stat: VirtualFileStat, detailed: boolean): string {
  const name = `${stat.path.split('/').at(-1) ?? '/'}${stat.type === 'directory' ? '/' : ''}`;
  if (!detailed) return name;
  const permissions = stat.type === 'directory' ? 'drwxr-xr-x' : '-rw-r--r--';
  const modified = new Date(stat.modifiedAt).toISOString().slice(0, 16).replace('T', ' ');
  return `${permissions}  1 ${String(stat.size).padStart(6, ' ')} ${modified} ${name}`;
}

function noArguments(arguments_: readonly string[]): CommandArgumentValidation<undefined> {
  return arguments_.length === 0
    ? validCommandArguments(undefined)
    : invalidCommandArguments('This command accepts no arguments.');
}

function readOptional(fileSystem: VirtualFileSystem, path: string): string {
  try {
    return fileSystem.readFile(path);
  } catch (error) {
    if (error instanceof VirtualFileSystemError && error.message.includes('No such file'))
      return '';
    throw error;
  }
}

function registerNoArgument(
  registry: CommandRegistry<VirtualLinuxCommandContext>,
  id: string,
  name: string,
  title: string,
  execute: (context: VirtualLinuxCommandContext) => CommandHandlerResult,
): void {
  registry.register({
    entryPoints: ENTRY_POINT,
    execute: ({ context }) => execute(context),
    help: name,
    id,
    name,
    title,
    validateArguments: noArguments,
  });
}

function requireArguments(
  arguments_: readonly string[],
  message: string,
): CommandArgumentValidation<readonly string[]> {
  return arguments_.length > 0
    ? validCommandArguments(arguments_)
    : invalidCommandArguments(message);
}

function formatEnvironment(context: VirtualLinuxCommandContext): readonly string[] {
  return Object.entries(virtualEnvironment(context)).map(([name, value]) => `${name}=${value}`);
}

function virtualEnvironment(context: VirtualLinuxCommandContext): Readonly<Record<string, string>> {
  return {
    HOME: context.fileSystem.home,
    LANG: 'C.UTF-8',
    PWD: context.fileSystem.cwd,
    SHELL: '/bin/docode-sh',
    TERM: 'xterm-256color',
    USER: context.username,
  };
}

function success(text?: string): CommandHandlerResult {
  return text === undefined
    ? { status: 'success' }
    : { output: { kind: 'text', text }, status: 'success' };
}

function successLines(lines: readonly string[]): CommandHandlerResult {
  return { output: { kind: 'lines', lines }, status: 'success' };
}

function validateCopy(arguments_: readonly string[]): CommandArgumentValidation<{
  readonly recursive: boolean;
  readonly source: string;
  readonly target: string;
}> {
  const recursive = arguments_[0] === '-r' || arguments_[0] === '-R';
  const paths = recursive ? arguments_.slice(1) : arguments_;
  return paths.length === 2 && paths[0] && paths[1]
    ? validCommandArguments({ recursive, source: paths[0], target: paths[1] })
    : invalidCommandArguments('Usage: cp [-r] <source> <target>');
}

function validateEcho(arguments_: readonly string[]): CommandArgumentValidation<{
  readonly append: boolean;
  readonly path: string | null;
  readonly text: string;
}> {
  const redirectIndex = arguments_.findIndex((argument) => argument === '>' || argument === '>>');
  if (redirectIndex < 0) {
    return validCommandArguments({ append: false, path: null, text: arguments_.join(' ') });
  }
  const path = arguments_[redirectIndex + 1];
  if (!path || redirectIndex + 2 !== arguments_.length) {
    return invalidCommandArguments('Usage: echo <text> [> file | >> file]');
  }
  return validCommandArguments({
    append: arguments_[redirectIndex] === '>>',
    path,
    text: arguments_.slice(0, redirectIndex).join(' '),
  });
}

function validateFind(arguments_: readonly string[]): CommandArgumentValidation<{
  readonly fragment: string | null;
  readonly path: string;
}> {
  const nameIndex = arguments_.indexOf('-name');
  if (nameIndex < 0) {
    return arguments_.length <= 1
      ? validCommandArguments({ fragment: null, path: arguments_[0] ?? '.' })
      : invalidCommandArguments('Usage: find [path] [-name fragment]');
  }
  const fragment = arguments_[nameIndex + 1];
  const path = nameIndex === 0 ? '.' : arguments_[0];
  return fragment && path && nameIndex + 2 === arguments_.length && nameIndex <= 1
    ? validCommandArguments({ fragment, path })
    : invalidCommandArguments('Usage: find [path] [-name fragment]');
}

function validateGrep(arguments_: readonly string[]): CommandArgumentValidation<{
  readonly ignoreCase: boolean;
  readonly path: string;
  readonly pattern: string;
}> {
  const ignoreCase = arguments_[0] === '-i';
  const values = ignoreCase ? arguments_.slice(1) : arguments_;
  return values.length === 2 && values[0] && values[1]
    ? validCommandArguments({ ignoreCase, path: values[1], pattern: values[0] })
    : invalidCommandArguments('Usage: grep [-i] <literal> <file>');
}

function validateLineRead(
  arguments_: readonly string[],
  command: 'head' | 'tail',
): CommandArgumentValidation<{ readonly count: number; readonly path: string }> {
  if (arguments_.length === 1 && arguments_[0]) {
    return validCommandArguments({ count: 10, path: arguments_[0] });
  }
  const count = arguments_[1] && /^[1-9]\d{0,3}$/u.test(arguments_[1]) ? Number(arguments_[1]) : 0;
  return arguments_.length === 3 && arguments_[0] === '-n' && count > 0 && arguments_[2]
    ? validCommandArguments({ count, path: arguments_[2] })
    : invalidCommandArguments(`Usage: ${command} [-n count] <file>`);
}

function validateLs(arguments_: readonly string[]): CommandArgumentValidation<{
  readonly all: boolean;
  readonly path: string;
}> {
  const all = arguments_[0] === '-a' || arguments_[0] === '-l' || arguments_[0] === '-la';
  const values = all ? arguments_.slice(1) : arguments_;
  return values.length <= 1
    ? validCommandArguments({ all, path: values[0] ?? '.' })
    : invalidCommandArguments('Usage: ls [-la] [path]');
}

function validatePathList(
  arguments_: readonly string[],
  recursiveFlag: string,
  command: string,
): CommandArgumentValidation<{ readonly paths: readonly string[]; readonly recursive: boolean }> {
  const recursive = arguments_[0] === recursiveFlag;
  const paths = recursive ? arguments_.slice(1) : arguments_;
  return paths.length > 0
    ? validCommandArguments({ paths, recursive })
    : invalidCommandArguments(`Usage: ${command} [${recursiveFlag}] <path...>`);
}

function validateRemove(arguments_: readonly string[]): CommandArgumentValidation<{
  readonly force: boolean;
  readonly paths: readonly string[];
  readonly recursive: boolean;
}> {
  const option = arguments_[0]?.startsWith('-') ? arguments_[0] : '';
  if (option && !/^-(?:r|f|rf|fr|R|Rf|fR)$/u.test(option)) {
    return invalidCommandArguments('Usage: rm [-rf] <path...>');
  }
  const paths = option ? arguments_.slice(1) : arguments_;
  return paths.length > 0
    ? validCommandArguments({
        force: option.includes('f'),
        paths,
        recursive: option.includes('r') || option.includes('R'),
      })
    : invalidCommandArguments('Usage: rm [-rf] <path...>');
}

function validateSinglePath(
  arguments_: readonly string[],
  command: string,
): CommandArgumentValidation<string> {
  return arguments_.length === 1 && arguments_[0]
    ? validCommandArguments(arguments_[0])
    : invalidCommandArguments(`Usage: ${command} <path>`);
}

function validateSort(arguments_: readonly string[]): CommandArgumentValidation<{
  readonly reverse: boolean;
  readonly path: string;
}> {
  const reverse = arguments_[0] === '-r';
  const values = reverse ? arguments_.slice(1) : arguments_;
  return values.length === 1 && values[0]
    ? validCommandArguments({ path: values[0], reverse })
    : invalidCommandArguments('Usage: sort [-r] <file>');
}

function withFileSystem(operation: () => CommandHandlerResult): CommandHandlerResult {
  try {
    return operation();
  } catch (error) {
    if (error instanceof VirtualFileSystemError) {
      return {
        error: { code: 'user-input-error', message: error.message, retryable: false },
        status: 'error',
      };
    }
    throw error;
  }
}
