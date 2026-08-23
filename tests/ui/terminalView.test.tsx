// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CommandDispatchResult, CommandMetadata } from '../../src/commands/commandTypes';
import { CLEAR_TERMINAL_COMMAND_ID } from '../../src/commands/workbenchCommands';
import { TerminalView } from '../../src/ui/terminal/TerminalView';

afterEach(cleanup);

describe('TerminalView', () => {
  it('renders the Linux DO identity prompt without permanent product explainer text', () => {
    renderTerminal(() => Promise.resolve({ status: 'empty' }));

    expect(screen.getByRole('region', { name: 'Linux DO command terminal' })).toBeDefined();
    expect(screen.getByRole('log')).toBeDefined();
    expect(screen.queryByText(/Registered actions only; no shell execution/u)).toBeNull();
    expect(screen.getByText('linux.do %')).toBeDefined();
    expect(screen.getByRole('combobox', { name: 'Linux DO command input' })).toBeDefined();
    expect(
      screen
        .getByRole('combobox', { name: 'Linux DO command input' })
        .hasAttribute('aria-controls'),
    ).toBe(false);
    expect(screen.queryByText('$')).toBeNull();
  });

  it('uses a safely resolved Linux DO username in current and submitted prompts', async () => {
    const user = userEvent.setup();
    renderTerminal(
      () =>
        Promise.resolve({
          commandId: 'docode.fixture',
          output: { kind: 'text', text: 'done' },
          status: 'success',
        }),
      0,
      [],
      'fixture-user',
    );

    const input = screen.getByRole('combobox', { name: 'Linux DO command input' });
    expect(screen.getByText('linux.do/fixture-user %')).toBeDefined();
    await user.type(input, 'help{Enter}');
    expect(await screen.findByText('done')).toBeDefined();
    expect(screen.getAllByText('linux.do/fixture-user %')).toHaveLength(2);
  });

  it('renders success lines and unsafe-looking output only as text', async () => {
    const user = userEvent.setup();
    const execute = vi.fn((): Promise<CommandDispatchResult> =>
      Promise.resolve({
        commandId: 'docode.fixture',
        output: { kind: 'lines', lines: ['first line', '<img src=x onerror=alert(1)>'] },
        status: 'success',
      }),
    );
    const rendered = renderTerminal(execute);
    const input = screen.getByRole('combobox', { name: 'Linux DO command input' });

    await user.type(input, 'fixture');
    await user.keyboard('{Enter}');

    expect(await screen.findByText('first line')).toBeDefined();
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeDefined();
    expect(rendered.container.querySelector('img')).toBeNull();
    expect(execute).toHaveBeenCalledWith('fixture', expect.any(AbortSignal));
    expect(document.activeElement).toBe(input);
  });

  it('shows structured errors without exposing markup', async () => {
    const user = userEvent.setup();
    renderTerminal(() =>
      Promise.resolve({
        commandId: null,
        error: { code: 'unknown-command', message: 'Unknown command: missing', retryable: false },
        status: 'error',
      }),
    );
    const input = screen.getByRole('combobox', { name: 'Linux DO command input' });

    await user.type(input, 'missing');
    await user.keyboard('{Enter}');

    const error = await screen.findByText('Unknown command: missing');
    expect(error.closest('[data-state]')?.getAttribute('data-state')).toBe('error');
  });

  it('exposes pending state and cancels through the supplied signal', async () => {
    const user = userEvent.setup();
    const receivedSignals: AbortSignal[] = [];
    renderTerminal(
      (input, signal) =>
        new Promise<CommandDispatchResult>((resolve) => {
          receivedSignals.push(signal);
          signal.addEventListener(
            'abort',
            () => {
              resolve({
                commandId: 'docode.wait',
                error: { code: 'aborted', message: 'Command was cancelled.', retryable: true },
                status: 'error',
              });
            },
            { once: true },
          );
        }),
    );
    const input = screen.getByRole('combobox', { name: 'Linux DO command input' });

    await user.type(input, 'wait');
    await user.keyboard('{Enter}');
    expect(await screen.findByText('Running registered command…')).toBeDefined();
    expect(input.getAttribute('aria-disabled')).toBe('true');
    expect(input.hasAttribute('readonly')).toBe(true);
    expect(document.activeElement).toBe(input);
    await user.click(screen.getByRole('button', { name: 'Cancel running command' }));

    expect(receivedSignals[0]?.aborted).toBe(true);
    expect(await screen.findByText('Command was cancelled.')).toBeDefined();
    expect(input.getAttribute('aria-disabled')).toBe('false');
    expect(input.hasAttribute('readonly')).toBe(false);
  });

  it('drops an empty result and honors explicit focus requests', async () => {
    const user = userEvent.setup();
    const rendered = renderTerminal(() => Promise.resolve({ status: 'empty' }), 0);
    const input = screen.getByRole('combobox', { name: 'Linux DO command input' });
    fireEvent.change(input, { target: { value: '   ' } });
    input.focus();
    await user.keyboard('{Enter}');
    expect(screen.queryByText('Command completed.')).toBeNull();
    expect(screen.queryByText('Running registered command…')).toBeNull();

    rendered.rerender(
      <TerminalView executeCommand={() => Promise.resolve({ status: 'empty' })} focusRequest={1} />,
    );
    expect(document.activeElement).toBe(input);
  });

  it('focuses the command input from the terminal surface without stealing text selection', () => {
    renderTerminal(() => Promise.resolve({ status: 'empty' }));
    const terminal = screen.getByRole('region', { name: 'Linux DO command terminal' });
    const input = screen.getByRole('combobox', { name: 'Linux DO command input' });

    input.blur();
    fireEvent.click(terminal);
    expect(document.activeElement).toBe(input);

    input.blur();
    const prompt = screen.getByText('linux.do %');
    const range = document.createRange();
    range.selectNodeContents(prompt);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    fireEvent.click(terminal);
    expect(document.activeElement).not.toBe(input);
    selection?.removeAllRanges();
  });

  it('does not reclaim focus after a registered command moves it outside the terminal', async () => {
    const user = userEvent.setup();
    const commandTarget = document.body.appendChild(document.createElement('button'));
    commandTarget.textContent = 'Command target';
    renderTerminal(() => {
      commandTarget.focus();
      return Promise.resolve({ commandId: 'docode.fixture', status: 'success' });
    });
    const input = screen.getByRole('combobox', { name: 'Linux DO command input' });

    await user.type(input, 'fixture{Enter}');
    await screen.findByText('Command completed.');
    expect(document.activeElement).toBe(commandTarget);
    commandTarget.remove();
  });

  it('clears presentation output only after the registered clear command succeeds', async () => {
    const user = userEvent.setup();
    let clear = false;
    renderTerminal(() =>
      Promise.resolve(
        clear
          ? { commandId: CLEAR_TERMINAL_COMMAND_ID, status: 'success' }
          : {
              commandId: 'docode.fixture',
              output: { kind: 'text', text: 'retained output' },
              status: 'success',
            },
      ),
    );
    const input = screen.getByRole('combobox', { name: 'Linux DO command input' });

    await user.type(input, 'fixture{Enter}');
    expect(await screen.findByText('retained output')).toBeDefined();
    clear = true;
    await user.type(input, 'clear{Enter}');
    expect(screen.queryByText('retained output')).toBeNull();
    expect(screen.queryByText('clear')).toBeNull();
  });

  it('accepts unique Tab completions without rendering a completion prompt', async () => {
    const user = userEvent.setup();
    const execute = vi.fn((input: string): Promise<CommandDispatchResult> =>
      Promise.resolve({
        commandId: input.startsWith('mode') ? 'docode.mode.set' : 'docode.help',
        status: 'success',
      }),
    );
    renderTerminal(execute, 0, [
      command('docode.help', 'help', 'help', 'List available commands'),
      command('docode.mode.set', 'mode', 'mode <code|doc>', 'Set topic reading mode'),
    ]);
    const input = screen.getByRole('combobox', { name: 'Linux DO command input' });

    await user.type(input, 'm');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.queryByRole('option')).toBeNull();
    await user.keyboard('{Tab}');
    expect((input as HTMLInputElement).value).toBe('mode ');
    expect(execute).not.toHaveBeenCalled();
    await user.type(input, 'doc{Enter}');
    expect(execute).toHaveBeenCalledWith('mode doc', expect.any(AbortSignal));

    await user.clear(input);
    await user.keyboard('{Tab}');
    expect((input as HTMLInputElement).value).toBe('');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(input);

    await user.type(input, 'h');
    await user.keyboard('{Tab}');
    expect((input as HTMLInputElement).value).toBe('help');
    expect(screen.queryByRole('option')).toBeNull();
    expect(document.activeElement).toBe(input);
  });

  it('submits an exact command name even when that command accepts optional arguments', async () => {
    const user = userEvent.setup();
    const execute = vi.fn((): Promise<CommandDispatchResult> =>
      Promise.resolve({
        commandId: 'linuxdo.post.like',
        output: { kind: 'text', text: 'Liked current post.' },
        status: 'success',
      }),
    );
    renderTerminal(execute, 0, [
      command('linuxdo.post.like', 'like', 'like [floor]', 'Toggle Like on a post'),
    ]);
    const input = screen.getByRole('combobox', { name: 'Linux DO command input' });

    await user.type(input, 'like{Enter}');

    expect(await screen.findByText('Liked current post.')).toBeDefined();
    expect(execute).toHaveBeenCalledWith('like', expect.any(AbortSignal));
  });

  it('switches into the virtual Linux session without delegating virtual commands', async () => {
    const user = userEvent.setup();
    const execute = vi.fn(() => Promise.resolve<CommandDispatchResult>({ status: 'empty' }));
    renderTerminal(execute, 0, [], 'fixture-user');
    const input = screen.getByRole('combobox', { name: 'Linux DO command input' });

    await user.type(input, 'ld{Enter}');
    expect(await screen.findByText('DOCode virtual Linux session')).toBeDefined();
    expect(screen.getByText('fixture-user@linux.do:~$')).toBeDefined();

    await user.type(input, 'pwd{Enter}');
    expect(await screen.findByText('/home/fixture-user')).toBeDefined();
    expect(execute).not.toHaveBeenCalled();

    await user.type(input, 'exit{Enter}');
    expect(await screen.findByText('Left the virtual Linux session.')).toBeDefined();
    expect(screen.getAllByText('linux.do/fixture-user %')).toHaveLength(2);
  });

  it('accepts LD virtual-path completions with Tab and executes the completed path', async () => {
    const user = userEvent.setup();
    const execute = vi.fn(() => Promise.resolve<CommandDispatchResult>({ status: 'empty' }));
    renderTerminal(execute, 0, [], 'fixture-user');
    const input = screen.getByRole('combobox', { name: 'Linux DO command input' });

    await user.type(input, 'ld{Enter}');
    await screen.findByText('DOCode virtual Linux session');
    await user.type(input, 'cd work');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.queryByRole('option')).toBeNull();
    await user.keyboard('{Tab}');
    expect((input as HTMLInputElement).value).toBe('cd workspace/');
    expect(document.activeElement).toBe(input);
    await user.keyboard('{Enter}');
    expect(await screen.findByText('fixture-user@linux.do:~/workspace$')).toBeDefined();

    await user.type(input, 'cd ..{Enter}');
    await screen.findByText('/home/fixture-user');
    await user.type(input, 'cat READ{Tab}');
    expect((input as HTMLInputElement).value).toBe('cat README.md ');
    await user.keyboard('{Enter}');
    expect(await screen.findByText('# DOCode virtual Linux')).toBeDefined();
    expect(execute).not.toHaveBeenCalled();
  });

  it('navigates successful canonical history and restores the current draft', async () => {
    const user = userEvent.setup();
    renderTerminal((input) =>
      Promise.resolve(
        input === 'hot'
          ? {
              commandId: 'linuxdo.navigation.hot',
              output: { kind: 'text', text: 'Opened hot topics.' },
              status: 'success',
            }
          : {
              commandId: null,
              error: { code: 'unknown-command', message: 'Unknown command', retryable: false },
              status: 'error',
            },
      ),
    );
    const input = screen.getByRole('combobox', { name: 'Linux DO command input' });

    await user.type(input, 'unknown secret-value{Enter}');
    expect(await screen.findByText('Unknown command')).toBeDefined();
    await user.type(input, 'hot{Enter}');
    expect(await screen.findByText('Opened hot topics.')).toBeDefined();
    await user.type(input, 'draft');
    await user.keyboard('{ArrowUp}');
    expect((input as HTMLInputElement).value).toBe('hot');
    await user.keyboard('{ArrowUp}');
    expect((input as HTMLInputElement).value).toBe('hot');
    await user.keyboard('{ArrowDown}');
    expect((input as HTMLInputElement).value).toBe('draft');
  });

  it('never renders completion options that were not supplied by current availability', async () => {
    const user = userEvent.setup();
    renderTerminal(() => Promise.resolve({ status: 'empty' }), 0, [
      command('docode.help', 'help', 'help', 'List available commands'),
      command('docode.panel.control', 'panel', 'panel <show|hide>', 'Control panel'),
    ]);
    const input = screen.getByRole('combobox', { name: 'Linux DO command input' });

    await user.type(input, 'm');
    expect(screen.queryByRole('listbox', { name: 'Available command completions' })).toBeNull();
    expect(screen.queryByRole('option', { name: /mode/u })).toBeNull();
  });
});

function renderTerminal(
  executeCommand: (input: string, signal: AbortSignal) => Promise<CommandDispatchResult>,
  focusRequest = 0,
  commands: readonly CommandMetadata[] = [],
  username: string | null = null,
) {
  return render(
    <TerminalView
      commands={commands}
      executeCommand={executeCommand}
      focusRequest={focusRequest}
      username={username}
    />,
  );
}

function command(id: string, name: string, help: string, title: string): CommandMetadata {
  return { aliases: [], entryPoints: ['terminal'], help, id, name, title };
}
