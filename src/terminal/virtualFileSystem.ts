const MAX_NODE_COUNT = 2_048;
const MAX_FILE_SIZE = 64 * 1_024;
const MAX_PATH_LENGTH = 1_024;

type VirtualNode = VirtualDirectory | VirtualFile;

interface VirtualDirectory {
  readonly children: Map<string, VirtualNode>;
  modifiedAt: number;
  readonly type: 'directory';
}

interface VirtualFile {
  content: string;
  modifiedAt: number;
  readonly type: 'file';
}

export interface VirtualFileStat {
  readonly modifiedAt: number;
  readonly path: string;
  readonly size: number;
  readonly type: VirtualNode['type'];
}

export class VirtualFileSystemError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VirtualFileSystemError';
  }
}

export class VirtualFileSystem {
  readonly #home: string;
  readonly #root: VirtualDirectory;
  #cwd: string;
  #nodeCount = 1;

  constructor(username: string) {
    const safeUsername = normalizeUsername(username);
    this.#home = `/home/${safeUsername}`;
    this.#cwd = this.#home;
    this.#root = directory();
    this.makeDirectory('/home', true);
    this.makeDirectory(this.#home, true);
    this.makeDirectory(`${this.#home}/workspace`, true);
    this.writeFile(
      `${this.#home}/README.md`,
      [
        '# DOCode virtual Linux',
        '',
        'This filesystem exists only inside the current extension terminal session.',
        'Use `docode help` to reach Linux DO commands. No host shell is executed.',
      ].join('\n'),
      true,
    );
  }

  get cwd(): string {
    return this.#cwd;
  }

  get home(): string {
    return this.#home;
  }

  changeDirectory(path: string): string {
    const resolved = this.resolve(path);
    const node = this.#getNode(resolved);
    if (node.type !== 'directory') throw fsError('cd', resolved, 'Not a directory');
    this.#cwd = resolved;
    return resolved;
  }

  copy(source: string, destination: string, recursive = false): void {
    const sourcePath = this.resolve(source);
    const sourceNode = this.#getNode(sourcePath);
    if (sourceNode.type === 'directory' && !recursive) {
      throw fsError('cp', sourcePath, 'Is a directory (use -r)');
    }
    const destinationPath = this.#resolveDestination(destination, basename(sourcePath));
    if (destinationPath === '/' || destinationPath.startsWith(`${sourcePath}/`)) {
      throw fsError('cp', destinationPath, 'Invalid destination');
    }
    const [parent, name] = this.#getParent(destinationPath, 'cp');
    const existing = parent.children.get(name);
    if (existing?.type === 'directory' && sourceNode.type === 'file') {
      throw fsError('cp', destinationPath, 'Is a directory');
    }
    const cloneSize = countNodes(sourceNode);
    const replacedSize = existing ? countNodes(existing) : 0;
    this.#assertNodeCapacity(cloneSize - replacedSize);
    parent.children.set(name, cloneNode(sourceNode));
    this.#nodeCount += cloneSize - replacedSize;
    parent.modifiedAt = Date.now();
  }

  find(path = '.', nameFragment: string | null = null): readonly string[] {
    const resolved = this.resolve(path);
    const node = this.#getNode(resolved);
    const matches: string[] = [];
    const visit = (current: VirtualNode, currentPath: string) => {
      if (!nameFragment || basename(currentPath).includes(nameFragment)) matches.push(currentPath);
      if (current.type !== 'directory') return;
      for (const name of sortedNames(current)) {
        const child = current.children.get(name);
        if (child) visit(child, joinPath(currentPath, name));
      }
    };
    visit(node, resolved);
    return matches;
  }

  list(path = '.'): readonly VirtualFileStat[] {
    const resolved = this.resolve(path);
    const node = this.#getNode(resolved);
    if (node.type === 'file') return [this.stat(resolved)];
    return sortedNames(node).map((name) => this.stat(joinPath(resolved, name)));
  }

  makeDirectory(path: string, recursive = false): void {
    const resolved = this.resolve(path);
    if (resolved === '/') return;
    const segments = pathSegments(resolved);
    let current = this.#root;
    let currentPath = '';
    for (const [index, segment] of segments.entries()) {
      currentPath = `${currentPath}/${segment}`;
      const existing = current.children.get(segment);
      if (existing) {
        if (existing.type !== 'directory') throw fsError('mkdir', currentPath, 'File exists');
        current = existing;
        continue;
      }
      if (!recursive && index !== segments.length - 1) {
        throw fsError('mkdir', currentPath, 'No such file or directory');
      }
      this.#assertNodeCapacity(1);
      const created = directory();
      current.children.set(segment, created);
      current.modifiedAt = Date.now();
      current = created;
      this.#nodeCount += 1;
    }
  }

  move(source: string, destination: string): void {
    const sourcePath = this.resolve(source);
    if (sourcePath === '/' || sourcePath === this.#home) {
      throw fsError('mv', sourcePath, 'Operation not permitted');
    }
    const sourceNode = this.#getNode(sourcePath);
    const destinationPath = this.#resolveDestination(destination, basename(sourcePath));
    if (destinationPath === sourcePath) return;
    if (destinationPath.startsWith(`${sourcePath}/`)) {
      throw fsError('mv', destinationPath, 'Invalid destination');
    }
    const [sourceParent, sourceName] = this.#getParent(sourcePath, 'mv');
    const [destinationParent, destinationName] = this.#getParent(destinationPath, 'mv');
    const replaced = destinationParent.children.get(destinationName);
    if (replaced?.type === 'directory' && replaced.children.size > 0) {
      throw fsError('mv', destinationPath, 'Directory not empty');
    }
    if (replaced) this.#nodeCount -= countNodes(replaced);
    destinationParent.children.set(destinationName, sourceNode);
    sourceParent.children.delete(sourceName);
    sourceParent.modifiedAt = Date.now();
    destinationParent.modifiedAt = Date.now();
    if (this.#cwd === sourcePath || this.#cwd.startsWith(`${sourcePath}/`)) {
      this.#cwd = `${destinationPath}${this.#cwd.slice(sourcePath.length)}`;
    }
  }

  readFile(path: string): string {
    const resolved = this.resolve(path);
    const node = this.#getNode(resolved);
    if (node.type !== 'file') throw fsError('cat', resolved, 'Is a directory');
    return node.content;
  }

  remove(path: string, recursive = false, force = false): void {
    const resolved = this.resolve(path);
    if (resolved === '/' || resolved === this.#home) {
      throw fsError('rm', resolved, 'Operation not permitted');
    }
    let parentAndName: readonly [VirtualDirectory, string];
    try {
      parentAndName = this.#getParent(resolved, 'rm');
    } catch (error) {
      if (force && error instanceof VirtualFileSystemError) return;
      throw error;
    }
    const [parent, name] = parentAndName;
    const node = parent.children.get(name);
    if (!node) {
      if (force) return;
      throw fsError('rm', resolved, 'No such file or directory');
    }
    if (node.type === 'directory' && node.children.size > 0 && !recursive) {
      throw fsError('rm', resolved, 'Directory not empty (use -r)');
    }
    if (this.#cwd === resolved || this.#cwd.startsWith(`${resolved}/`)) {
      throw fsError('rm', resolved, 'Cannot remove the current directory');
    }
    parent.children.delete(name);
    parent.modifiedAt = Date.now();
    this.#nodeCount -= countNodes(node);
  }

  resolve(path: string): string {
    const value = path.trim() || '.';
    const expanded =
      value === '~'
        ? this.#home
        : value.startsWith('~/')
          ? `${this.#home}/${value.slice(2)}`
          : value;
    const combined = expanded.startsWith('/') ? expanded : `${this.#cwd}/${expanded}`;
    const resolved: string[] = [];
    for (const segment of combined.split('/')) {
      if (!segment || segment === '.') continue;
      if (segment === '..') resolved.pop();
      else {
        if (segment.includes('\0')) throw fsError('path', path, 'Invalid path');
        resolved.push(segment);
      }
    }
    const normalized = `/${resolved.join('/')}`;
    if (normalized.length > MAX_PATH_LENGTH) throw fsError('path', path, 'Path is too long');
    return normalized;
  }

  stat(path: string): VirtualFileStat {
    const resolved = this.resolve(path);
    const node = this.#getNode(resolved);
    return {
      modifiedAt: node.modifiedAt,
      path: resolved,
      size:
        node.type === 'file' ? new TextEncoder().encode(node.content).length : node.children.size,
      type: node.type,
    };
  }

  touch(path: string): void {
    const resolved = this.resolve(path);
    const existing = this.#findNode(resolved);
    if (existing) {
      existing.modifiedAt = Date.now();
      return;
    }
    this.writeFile(resolved, '', false);
  }

  tree(path = '.'): readonly string[] {
    const resolved = this.resolve(path);
    const node = this.#getNode(resolved);
    const lines = [resolved === '/' ? '/' : basename(resolved)];
    if (node.type === 'file') return lines;
    const visit = (current: VirtualDirectory, prefix: string) => {
      const names = sortedNames(current);
      names.forEach((name, index) => {
        const child = current.children.get(name);
        if (!child) return;
        const last = index === names.length - 1;
        lines.push(
          `${prefix}${last ? '└── ' : '├── '}${name}${child.type === 'directory' ? '/' : ''}`,
        );
        if (child.type === 'directory') visit(child, `${prefix}${last ? '    ' : '│   '}`);
      });
    };
    visit(node, '');
    return lines;
  }

  writeFile(path: string, content: string, createParents = false): void {
    if (new TextEncoder().encode(content).length > MAX_FILE_SIZE) {
      throw fsError('write', path, 'File exceeds the 64 KiB virtual-session limit');
    }
    const resolved = this.resolve(path);
    if (createParents) this.makeDirectory(dirname(resolved), true);
    const [parent, name] = this.#getParent(resolved, 'write');
    const existing = parent.children.get(name);
    if (existing?.type === 'directory') throw fsError('write', resolved, 'Is a directory');
    if (!existing) {
      this.#assertNodeCapacity(1);
      parent.children.set(name, file(content));
      this.#nodeCount += 1;
    } else {
      existing.content = content;
      existing.modifiedAt = Date.now();
    }
    parent.modifiedAt = Date.now();
  }

  #assertNodeCapacity(additional: number): void {
    if (additional > 0 && this.#nodeCount + additional > MAX_NODE_COUNT) {
      throw new VirtualFileSystemError('Virtual filesystem node limit reached.');
    }
  }

  #findNode(path: string): VirtualNode | null {
    if (path === '/') return this.#root;
    let current: VirtualNode = this.#root;
    for (const segment of pathSegments(path)) {
      if (current.type !== 'directory') return null;
      const next = current.children.get(segment);
      if (!next) return null;
      current = next;
    }
    return current;
  }

  #getNode(path: string): VirtualNode {
    const node = this.#findNode(path);
    if (!node) throw fsError('access', path, 'No such file or directory');
    return node;
  }

  #getParent(path: string, operation: string): readonly [VirtualDirectory, string] {
    const name = basename(path);
    if (!name) throw fsError(operation, path, 'Operation not permitted');
    const parentPath = dirname(path);
    const parent = this.#findNode(parentPath);
    if (!parent) throw fsError(operation, parentPath, 'No such file or directory');
    if (parent.type !== 'directory') throw fsError(operation, parentPath, 'Not a directory');
    return [parent, name];
  }

  #resolveDestination(destination: string, sourceName: string): string {
    const resolved = this.resolve(destination);
    const node = this.#findNode(resolved);
    return node?.type === 'directory' ? joinPath(resolved, sourceName) : resolved;
  }
}

function basename(path: string): string {
  return pathSegments(path).at(-1) ?? '';
}

function cloneNode(node: VirtualNode): VirtualNode {
  if (node.type === 'file') return { ...node };
  return {
    children: new Map(Array.from(node.children, ([name, child]) => [name, cloneNode(child)])),
    modifiedAt: node.modifiedAt,
    type: 'directory',
  };
}

function countNodes(node: VirtualNode): number {
  return node.type === 'file'
    ? 1
    : 1 + Array.from(node.children.values()).reduce((count, child) => count + countNodes(child), 0);
}

function directory(): VirtualDirectory {
  return { children: new Map(), modifiedAt: Date.now(), type: 'directory' };
}

function dirname(path: string): string {
  const segments = pathSegments(path);
  segments.pop();
  return `/${segments.join('/')}`;
}

function file(content: string): VirtualFile {
  return { content, modifiedAt: Date.now(), type: 'file' };
}

function fsError(operation: string, path: string, message: string): VirtualFileSystemError {
  return new VirtualFileSystemError(`${operation}: ${path}: ${message}`);
}

function joinPath(parent: string, name: string): string {
  return parent === '/' ? `/${name}` : `${parent}/${name}`;
}

function normalizeUsername(username: string): string {
  const normalized = username
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/gu, '-')
    .slice(0, 64);
  return normalized || 'guest';
}

function pathSegments(path: string): string[] {
  return path.split('/').filter(Boolean);
}

function sortedNames(directoryNode: VirtualDirectory): string[] {
  return Array.from(directoryNode.children.keys()).sort((left, right) => left.localeCompare(right));
}
