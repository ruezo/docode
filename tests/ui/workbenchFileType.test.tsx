// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { WorkbenchFileIcon } from '../../src/ui/workbench/WorkbenchFileIcon';
import { WORKBENCH_FILE_ICON_DEFINITIONS } from '../../src/ui/workbench/workbenchFileIconTheme';
import {
  getWorkbenchFileExtension,
  type WorkbenchFileExtension,
  WORKBENCH_FILE_EXTENSIONS,
} from '../../src/ui/workbench/workbenchFileType';

afterEach(cleanup);

describe('workbench file types', () => {
  it('uses the fixed VS Code Seti glyph and dark-theme color for every approved extension', () => {
    expect(WORKBENCH_FILE_ICON_DEFINITIONS).toEqual({
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
    });

    const { container } = render(
      <>
        {WORKBENCH_FILE_EXTENSIONS.map((extension) => (
          <WorkbenchFileIcon extension={extension} key={extension} />
        ))}
      </>,
    );

    const icons = Array.from(container.querySelectorAll<HTMLElement>('[data-file-extension]'));
    expect(icons).toHaveLength(14);
    expect(icons.map((icon) => icon.dataset.fileExtension)).toEqual(WORKBENCH_FILE_EXTENSIONS);
    for (const icon of icons) {
      const extension = icon.dataset.fileExtension;
      expect(extension).toBeDefined();
      if (!extension) throw new Error('Rendered file icon is missing its extension identity.');
      expect(icon.classList).toContain(`docode-workbench__file-icon--${extension}`);
      expect(icon.getAttribute('aria-hidden')).toBe('true');
      const definition = WORKBENCH_FILE_ICON_DEFINITIONS[extension as WorkbenchFileExtension];
      expect(icon.dataset.setiIcon).toBe(definition.setiId);
      expect(icon.textContent).toBe(definition.glyph);
      expect(icon.style.color).not.toBe('');
    }
  });

  it('distributes stable identities across the complete approved type set', () => {
    const assigned = new Set(
      Array.from({ length: 500 }, (_, index) => getWorkbenchFileExtension(`view:${String(index)}`)),
    );

    expect([...assigned].sort()).toEqual([...WORKBENCH_FILE_EXTENSIONS].sort());
    expect(getWorkbenchFileExtension('view:topic:2781292')).toBe(
      getWorkbenchFileExtension('view:topic:2781292'),
    );
  });
});
