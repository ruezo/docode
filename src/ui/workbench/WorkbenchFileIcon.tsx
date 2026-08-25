import type { WorkbenchAnyFileExtension } from './workbenchFileType';
import { WORKBENCH_FILE_ICON_DEFINITIONS } from './workbenchFileIconTheme';

export function WorkbenchFileIcon({
  extension,
}: {
  readonly extension: WorkbenchAnyFileExtension;
}) {
  const definition = WORKBENCH_FILE_ICON_DEFINITIONS[extension];

  return (
    <span
      aria-hidden="true"
      className={`docode-workbench__file-icon docode-workbench__file-icon--${extension}`}
      data-file-extension={extension}
      data-seti-icon={definition.setiId}
      style={{ color: definition.color }}
    >
      {definition.glyph}
    </span>
  );
}
