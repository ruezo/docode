import { describe, expect, it } from 'vitest';

import { VirtualFileSystem, VirtualFileSystemError } from '../../src/terminal/virtualFileSystem';

describe('VirtualFileSystem', () => {
  it('keeps file operations inside an extension-local Unix-style tree', () => {
    const fileSystem = new VirtualFileSystem('fixture-user');

    expect(fileSystem.cwd).toBe('/home/fixture-user');
    expect(fileSystem.readFile('README.md')).toContain('No host shell is executed.');

    fileSystem.makeDirectory('workspace/notes', true);
    fileSystem.changeDirectory('workspace/notes');
    fileSystem.writeFile('hello.txt', 'hello\nworld');
    fileSystem.copy('hello.txt', 'copy.txt');
    fileSystem.move('copy.txt', 'moved.txt');

    expect(fileSystem.readFile('./hello.txt')).toBe('hello\nworld');
    expect(fileSystem.readFile('../notes/moved.txt')).toBe('hello\nworld');
    expect(fileSystem.list('.').map(({ path }) => path)).toEqual([
      '/home/fixture-user/workspace/notes/hello.txt',
      '/home/fixture-user/workspace/notes/moved.txt',
    ]);
    expect(fileSystem.find('~', 'moved')).toEqual(['/home/fixture-user/workspace/notes/moved.txt']);
  });

  it('protects the virtual root, home, and current working directory', () => {
    const fileSystem = new VirtualFileSystem('fixture-user');

    expect(() => {
      fileSystem.remove('/', true);
    }).toThrow(VirtualFileSystemError);
    expect(() => {
      fileSystem.remove('~', true);
    }).toThrow(VirtualFileSystemError);
    fileSystem.makeDirectory('active');
    fileSystem.changeDirectory('active');
    expect(() => {
      fileSystem.remove('.', true);
    }).toThrow('Cannot remove the current directory');
  });
});
