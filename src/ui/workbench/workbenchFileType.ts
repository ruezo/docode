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

export const WORKBENCH_DOCUMENT_FILE_EXTENSIONS = [
  'png',
  'gif',
  'webp',
  'md',
  'txt',
  'csv',
  'docx',
  'pdf',
  'mp4',
  'mp3',
] as const;

export type WorkbenchFileExtension = (typeof WORKBENCH_FILE_EXTENSIONS)[number];
export type WorkbenchDocumentFileExtension = (typeof WORKBENCH_DOCUMENT_FILE_EXTENSIONS)[number];
export type WorkbenchAnyFileExtension = WorkbenchDocumentFileExtension | WorkbenchFileExtension;

export interface WorkbenchVirtualFile {
  readonly extension: WorkbenchFileExtension;
  readonly name: string;
}

export interface WorkbenchDocumentVirtualFile {
  readonly extension: WorkbenchDocumentFileExtension;
  readonly name: string;
}

export function createWorkbenchVirtualFile(label: string, identity: string): WorkbenchVirtualFile {
  const extension = getWorkbenchFileExtension(identity);
  return { extension, name: `${label}.${extension}` };
}

export function createWorkbenchDocumentVirtualFile(
  label: string,
  identity: string,
): WorkbenchDocumentVirtualFile {
  const extension =
    WORKBENCH_DOCUMENT_FILE_EXTENSIONS[
      hashIdentity(identity) % WORKBENCH_DOCUMENT_FILE_EXTENSIONS.length
    ] ?? WORKBENCH_DOCUMENT_FILE_EXTENSIONS[0];
  return { extension, name: `${label}.${extension}` };
}

export function getWorkbenchFileExtension(identity: string): WorkbenchFileExtension {
  return (
    WORKBENCH_FILE_EXTENSIONS[hashIdentity(identity) % WORKBENCH_FILE_EXTENSIONS.length] ??
    WORKBENCH_FILE_EXTENSIONS[0]
  );
}

function hashIdentity(identity: string): number {
  let hash = 2166136261;
  for (let index = 0; index < identity.length; index += 1) {
    hash ^= identity.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
