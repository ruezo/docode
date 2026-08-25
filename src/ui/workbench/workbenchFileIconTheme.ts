import type { WorkbenchAnyFileExtension } from './workbenchFileType';

interface WorkbenchFileIconDefinition {
  readonly color: `#${string}`;
  readonly glyph: string;
  readonly setiId: `_${string}`;
}

export const WORKBENCH_FILE_ICON_DEFINITIONS: Readonly<
  Record<WorkbenchAnyFileExtension, WorkbenchFileIconDefinition>
> = {
  c: { color: '#519aba', glyph: '\uE00C', setiId: '_c' },
  cpp: { color: '#519aba', glyph: '\uE01A', setiId: '_cpp' },
  csv: { color: '#8dc149', glyph: '\uE01E', setiId: '_csv' },
  dart: { color: '#519aba', glyph: '\uE021', setiId: '_dart' },
  docx: { color: '#519aba', glyph: '\uE0A3', setiId: '_word' },
  gif: { color: '#a074c4', glyph: '\uE04C', setiId: '_image' },
  go: { color: '#519aba', glyph: '\uE03A', setiId: '_go2' },
  java: { color: '#cc3e44', glyph: '\uE050', setiId: '_java' },
  json: { color: '#cbcb41', glyph: '\uE055', setiId: '_json' },
  kt: { color: '#e37933', glyph: '\uE058', setiId: '_kotlin' },
  md: { color: '#519aba', glyph: '\uE060', setiId: '_markdown' },
  mp3: { color: '#a074c4', glyph: '\uE005', setiId: '_audio' },
  mp4: { color: '#f55385', glyph: '\uE09B', setiId: '_video' },
  pdf: { color: '#cc3e44', glyph: '\uE06D', setiId: '_pdf' },
  png: { color: '#a074c4', glyph: '\uE04C', setiId: '_image' },
  py: { color: '#519aba', glyph: '\uE07B', setiId: '_python' },
  toml: { color: '#6d8086', glyph: '\uE019', setiId: '_config' },
  ts: { color: '#519aba', glyph: '\uE099', setiId: '_typescript' },
  tsx: { color: '#519aba', glyph: '\uE07D', setiId: '_react' },
  txt: { color: '#d4d7d6', glyph: '\uE023', setiId: '_default' },
  webp: { color: '#a074c4', glyph: '\uE04C', setiId: '_image' },
  xml: { color: '#e37933', glyph: '\uE0A5', setiId: '_xml' },
  yaml: { color: '#a074c4', glyph: '\uE0A7', setiId: '_yml' },
};
