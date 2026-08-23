import { describe, expect, it, vi } from 'vitest';

import type { CommandDispatchResult } from '../../src/commands/commandTypes';
import { WORKBENCH_COMMAND_IDS } from '../../src/commands/workbenchCommands';
import { TerminalSession } from '../../src/terminal/terminalSession';

const signal = new AbortController().signal;

describe('TerminalSession', () => {
  it('enters an isolated virtual Linux session and preserves filesystem state', async () => {
    const executeDocode = vi.fn(() => Promise.resolve<CommandDispatchResult>({ status: 'empty' }));
    const session = new TerminalSession('fixture-user');

    const entered = await session.execute('ld', signal, executeDocode);
    expect(entered.result.status).toBe('success');
    expect(session.mode).toBe('linux');
    expect(session.prompt).toBe('fixture-user@linux.do:~$');

    await session.execute('mkdir notes', signal, executeDocode);
    await session.execute('cd notes', signal, executeDocode);
    await session.execute('echo "hello world" > greeting.txt', signal, executeDocode);
    const read = await session.execute('cat greeting.txt', signal, executeDocode);

    expect(session.prompt).toBe('fixture-user@linux.do:~/notes$');
    expect(read.result).toMatchObject({
      output: { kind: 'lines', lines: ['hello world', ''] },
      status: 'success',
    });
    expect(executeDocode).not.toHaveBeenCalled();
  });

  it('supports quoted and escaped virtual shell arguments without executing a host shell', async () => {
    const session = new TerminalSession('fixture-user');
    const executeDocode = vi.fn(() => Promise.resolve<CommandDispatchResult>({ status: 'empty' }));

    await session.execute('ld', signal, executeDocode);
    await session.execute('echo "first value" > values.txt', signal, executeDocode);
    await session.execute("echo 'second value' >> values.txt", signal, executeDocode);
    await session.execute('echo escaped\\ value >> values.txt', signal, executeDocode);
    const read = await session.execute('cat values.txt', signal, executeDocode);
    const rejected = await session.execute('echo unsafe | sh', signal, executeDocode);

    expect(read.result).toMatchObject({
      output: { kind: 'lines', lines: ['first value', 'second value', 'escaped value', ''] },
      status: 'success',
    });
    expect(rejected.result).toMatchObject({
      error: { code: 'user-input-error', message: 'Unsupported virtual shell operator: |' },
      status: 'error',
    });
    expect(executeDocode).not.toHaveBeenCalled();
  });

  it('bridges only explicit docode commands and exits without invoking a host shell', async () => {
    const executeDocode = vi.fn((input: string) =>
      Promise.resolve<CommandDispatchResult>({
        commandId: WORKBENCH_COMMAND_IDS.help,
        output: { kind: 'text', text: input },
        status: 'success',
      }),
    );
    const session = new TerminalSession('fixture-user');

    await session.execute('ld', signal, executeDocode);
    const rejected = await session.execute('sh', signal, executeDocode);
    const bridged = await session.execute('docode help', signal, executeDocode);
    const exited = await session.execute('exit', signal, executeDocode);

    expect(rejected.result).toMatchObject({
      error: { code: 'unknown-command' },
      status: 'error',
    });
    expect(bridged.historyEntry).toBe('docode help');
    expect(executeDocode).toHaveBeenCalledOnce();
    expect(executeDocode).toHaveBeenCalledWith('help', signal);
    expect(exited.result.status).toBe('success');
    expect(session.mode).toBe('docode');
    expect(session.prompt).toBe('linux.do/fixture-user %');
  });

  it('exposes mode-specific completion metadata', async () => {
    const session = new TerminalSession();
    const executeDocode = () => Promise.resolve<CommandDispatchResult>({ status: 'empty' });

    expect(session.getCommands([]).map(({ name }) => name)).toEqual(['ld']);
    await session.execute('ld', signal, executeDocode);

    const names = session.getCommands([]).map(({ name }) => name);
    expect(names).toContain('ls');
    expect(names).toContain('grep');
    expect(names).toContain('docode');
    expect(names).toContain('exit');
    expect(names).not.toContain('sh');
  });

  it('refreshes contextual virtual-path completion after filesystem mutation and mode exit', async () => {
    const session = new TerminalSession('fixture-user');
    const executeDocode = () => Promise.resolve<CommandDispatchResult>({ status: 'empty' });

    await session.execute('ld', signal, executeDocode);
    expect(session.getSuggestions([], 'cd work', false)[0]).toMatchObject({
      detail: 'Folder · ~/workspace',
      insertText: 'cd workspace/',
      label: 'workspace/',
    });
    expect(session.getSuggestions([], 'cd READ', false)).toEqual([]);
    expect(session.getSuggestions([], 'cat READ', false)[0]).toMatchObject({
      detail: 'File · ~/README.md',
      insertText: 'cat README.md ',
      label: 'README.md',
    });

    await session.execute('mkdir source', signal, executeDocode);
    expect(session.getSuggestions([], 'cd so', false)[0]).toMatchObject({
      insertText: 'cd source/',
      label: 'source/',
    });

    await session.execute('exit', signal, executeDocode);
    expect(session.getSuggestions([], 'cd so', false)).toEqual([]);
  });

  it('provides common Linux-style inspection and text commands inside the virtual session', async () => {
    const session = new TerminalSession('fixture-user');
    const executeDocode = () => Promise.resolve<CommandDispatchResult>({ status: 'empty' });

    await session.execute('ld', signal, executeDocode);
    await session.execute('echo beta > values.txt', signal, executeDocode);
    await session.execute('echo alpha >> values.txt', signal, executeDocode);
    await session.execute('echo alpha >> values.txt', signal, executeDocode);

    const hostname = await session.execute('hostname', signal, executeDocode);
    const identity = await session.execute('id', signal, executeDocode);
    const home = await session.execute('printenv HOME', signal, executeDocode);
    const sorted = await session.execute('sort values.txt', signal, executeDocode);
    const unique = await session.execute('uniq values.txt', signal, executeDocode);
    const stat = await session.execute('stat values.txt', signal, executeDocode);

    expect(hostname.result).toMatchObject({
      output: { kind: 'text', text: 'linux.do' },
      status: 'success',
    });
    expect(identity.result.status).toBe('success');
    expect(identity.result.status === 'success' ? identity.result.output : undefined).toEqual({
      kind: 'text',
      text: 'uid=1000(fixture-user) gid=1000(fixture-user) groups=1000(fixture-user),100(users)',
    });
    expect(home.result).toMatchObject({
      output: { kind: 'text', text: '/home/fixture-user' },
      status: 'success',
    });
    expect(sorted.result).toMatchObject({
      output: { kind: 'lines', lines: ['', 'alpha', 'alpha', 'beta'] },
      status: 'success',
    });
    expect(unique.result).toMatchObject({
      output: { kind: 'lines', lines: ['beta', 'alpha', ''] },
      status: 'success',
    });
    expect(stat.result.status).toBe('success');
    const statOutput = stat.result.status === 'success' ? stat.result.output : undefined;
    expect(statOutput?.kind).toBe('lines');
    expect(statOutput?.kind === 'lines' ? statOutput.lines : []).toContain(
      '  File: /home/fixture-user/values.txt',
    );
  });
});
