import { describe, expect, it } from 'vitest';

import type { CommandMetadata } from '../../src/commands/commandTypes';
import {
  createCommandSuggestions,
  createVirtualLinuxSuggestions,
} from '../../src/terminal/terminalCompletions';
import { VirtualFileSystem } from '../../src/terminal/virtualFileSystem';

describe('terminal completions', () => {
  it('completes real relative, home-relative, absolute, and nested virtual paths', () => {
    const fileSystem = new VirtualFileSystem('fixture-user');
    fileSystem.makeDirectory('workspace/source', true);
    fileSystem.writeFile('workspace/source/main.ts', 'export {};');
    const commands = virtualCommands();

    expect(createVirtualLinuxSuggestions(commands, [], fileSystem, 'cd work', false)).toEqual([
      {
        commandId: 'virtual.cd:/home/fixture-user/workspace',
        detail: 'Folder · ~/workspace',
        insertText: 'cd workspace/',
        label: 'workspace/',
      },
    ]);
    expect(createVirtualLinuxSuggestions(commands, [], fileSystem, 'cat READ', false)).toEqual([
      {
        commandId: 'virtual.cat:/home/fixture-user/README.md',
        detail: 'File · ~/README.md',
        insertText: 'cat README.md ',
        label: 'README.md',
      },
    ]);
    expect(
      createVirtualLinuxSuggestions(commands, [], fileSystem, 'cat ~/work', false)[0]?.insertText,
    ).toBe('cat ~/workspace/');
    expect(
      createVirtualLinuxSuggestions(
        commands,
        [],
        fileSystem,
        'cat /home/fixture-user/workspace/source/mai',
        false,
      )[0]?.insertText,
    ).toBe('cat /home/fixture-user/workspace/source/main.ts ');
  });

  it('restricts cd to directories and safely completes quoted names with spaces', () => {
    const fileSystem = new VirtualFileSystem('fixture-user');
    fileSystem.makeDirectory('project files');
    fileSystem.writeFile('project notes.txt', 'notes');
    const commands = virtualCommands();

    expect(
      createVirtualLinuxSuggestions(commands, [], fileSystem, 'cd ', true).map(
        ({ label }) => label,
      ),
    ).toEqual(['project files/', 'workspace/']);
    expect(
      createVirtualLinuxSuggestions(commands, [], fileSystem, 'cd "project f', false)[0]
        ?.insertText,
    ).toBe('cd "project files/');
    expect(
      createVirtualLinuxSuggestions(commands, [], fileSystem, 'cat "project n', false)[0]
        ?.insertText,
    ).toBe('cat "project notes.txt" ');
  });

  it('completes explicit nested DOCode commands without widening the virtual command set', () => {
    const fileSystem = new VirtualFileSystem('fixture-user');
    const commands = virtualCommands();
    const docodeCommands = [
      command('docode.help', 'help', 'help', 'List available commands'),
      command('linuxdo.navigation.hot', 'hot', 'hot', 'Open hot topics'),
    ];

    expect(
      createVirtualLinuxSuggestions(commands, docodeCommands, fileSystem, 'docode he', false),
    ).toEqual([
      {
        commandId: 'docode:docode.help',
        detail: 'List available commands',
        insertText: 'docode help',
        label: 'help',
      },
    ]);
    expect(createVirtualLinuxSuggestions(commands, [], fileSystem, 'sh', false)).toEqual([]);
    expect(createCommandSuggestions(commands, 'c', false).map(({ label }) => label)).toEqual([
      'cd [path]',
      'cat <file...>',
    ]);
  });
});

function virtualCommands(): readonly CommandMetadata[] {
  return [
    command('virtual.cd', 'cd', 'cd [path]', 'Change working directory'),
    command('virtual.cat', 'cat', 'cat <file...>', 'Print file contents'),
    command('docode.terminal.run-docode', 'docode', 'docode <command>', 'Run DOCode command'),
  ];
}

function command(id: string, name: string, help: string, title: string): CommandMetadata {
  return { aliases: [], entryPoints: ['terminal'], help, id, name, title };
}
