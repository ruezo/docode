export const WORKBENCH_FILE_EXTENSIONS = [
  'xml',
  'py',
  'java',
  'go',
  'c',
  'cpp',
  'toml',
  'yaml',
  'ts',
  'tsx',
  'dart',
  'kt',
  'md',
  'json',
] as const;

export type WorkbenchFileExtension = (typeof WORKBENCH_FILE_EXTENSIONS)[number];

export interface WorkbenchVirtualFile {
  readonly extension: WorkbenchFileExtension;
  readonly name: string;
}

export function createWorkbenchVirtualFile(label: string, identity: string): WorkbenchVirtualFile {
  const extension = getWorkbenchFileExtension(identity);
  return { extension, name: `${label}.${extension}` };
}

export function getWorkbenchFileExtension(identity: string): WorkbenchFileExtension {
  let hash = 2166136261;
  for (let index = 0; index < identity.length; index += 1) {
    hash ^= identity.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (
    WORKBENCH_FILE_EXTENSIONS[(hash >>> 0) % WORKBENCH_FILE_EXTENSIONS.length] ??
    WORKBENCH_FILE_EXTENSIONS[0]
  );
}
