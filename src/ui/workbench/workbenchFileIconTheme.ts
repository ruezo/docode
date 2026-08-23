import type { WorkbenchFileExtension } from './workbenchFileType';

interface WorkbenchFileIconDefinition {
  readonly color: `#${string}`;
  readonly glyph: string;
  readonly setiId: `_${string}`;
}

export const WORKBENCH_FILE_ICON_DEFINITIONS: Readonly<
  Record<WorkbenchFileExtension, WorkbenchFileIconDefinition>
> = {
  c: { color: '#519aba', glyph: '\uE00C', setiId: '_c' },
  cpp: { color: '#519aba', glyph: '\uE01A', setiId: '_cpp' },
  dart: { color: '#519aba', glyph: '\uE021', setiId: '_dart' },
  go: { color: '#519aba', glyph: '\uE03A', setiId: '_go2' },
  java: { color: '#cc3e44', glyph: '\uE050', setiId: '_java' },
  json: { color: '#cbcb41', glyph: '\uE055', setiId: '_json' },
  kt: { color: '#e37933', glyph: '\uE058', setiId: '_kotlin' },
  md: { color: '#519aba', glyph: '\uE060', setiId: '_markdown' },
  py: { color: '#519aba', glyph: '\uE07B', setiId: '_python' },
  toml: { color: '#6d8086', glyph: '\uE019', setiId: '_config' },
  ts: { color: '#519aba', glyph: '\uE099', setiId: '_typescript' },
  tsx: { color: '#519aba', glyph: '\uE07D', setiId: '_react' },
  xml: { color: '#e37933', glyph: '\uE0A5', setiId: '_xml' },
  yaml: { color: '#a074c4', glyph: '\uE0A7', setiId: '_yml' },
};
