// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://linux.do/t/synthetic-topic/42" }

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { detectLinuxDoCapabilities } from '../../src/linuxdo/capabilities';
import { recognizeLinuxDoRoute } from '../../src/linuxdo/routes';
import { NativeContentTransfer } from '../../src/runtime/nativeContentTransfer';
import { NativeComposerSurface } from '../../src/ui/workbench/NativeComposerSurface';

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('NativeComposerSurface', () => {
  it('mounts the exact native composer as an editor buffer and restores it on unmount', async () => {
    const user = userEvent.setup();
    document.body.innerHTML = fixture();
    const source = document.querySelector('#native-composer-source');
    const nativeRoot = document.querySelector<HTMLElement>('#reply-control');
    const nativeEditor = document.querySelector<HTMLTextAreaElement>('.d-editor-input');
    if (!source || !nativeRoot || !nativeEditor) throw new Error('Missing composer fixture');
    nativeEditor.value = 'Existing Linux DO draft';
    const capability = detectComposer();
    const transfer = new NativeContentTransfer(document);

    const view = render(
      <div className="docode-theme-dark-modern" data-docode-workbench-root="owner">
        <NativeComposerSurface
          capability={capability}
          feedback={null}
          nativeContentTransfer={transfer}
          revision={0}
        />
      </div>,
    );

    expect(
      screen.getByRole('region', { name: 'Linux DO reply composer' }).getAttribute('data-dirty'),
    ).toBe('true');
    expect(view.container.querySelector('.docode-sr-only')?.textContent).toContain('unsaved draft');
    expect(nativeRoot.parentElement?.classList.contains('docode-native-composer__host')).toBe(true);
    expect(document.querySelector('#reply-control')).toBe(nativeRoot);
    await waitForAnimationFrame();
    expect(document.activeElement).toBe(nativeEditor);
    await user.click(nativeEditor);
    await user.keyboard(' plus typing');
    expect(nativeEditor.value).toBe('Existing Linux DO draft plus typing');

    view.rerender(
      <div className="docode-theme-dark-modern" data-docode-workbench-root="owner">
        <NativeComposerSurface
          capability={detectComposer()}
          feedback={{ kind: 'error', message: 'Linux DO rejected the reply.' }}
          nativeContentTransfer={transfer}
          revision={1}
        />
      </div>,
    );
    expect(screen.getByRole('alert').textContent).toContain('Linux DO rejected the reply.');
    expect(document.activeElement).toBe(nativeEditor);

    view.unmount();
    expect(nativeRoot.parentElement).toBe(source);
    expect(nativeEditor.value).toBe('Existing Linux DO draft plus typing');
    transfer.dispose();
  });

  it('collapses formatting tools behind a toggle that expands the native toolbar', async () => {
    const user = userEvent.setup();
    document.body.innerHTML = fixture();
    const transfer = new NativeContentTransfer(document);

    render(
      <div className="docode-theme-dark-modern" data-docode-workbench-root="owner">
        <NativeComposerSurface
          capability={detectComposer()}
          feedback={null}
          nativeContentTransfer={transfer}
          revision={0}
        />
      </div>,
    );

    const toggle = screen.getByRole('button', { name: 'Formatting tools' });
    const surface = screen.getByRole('region', { name: 'Linux DO reply composer' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(surface.getAttribute('data-toolbar')).toBe('collapsed');

    await user.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(surface.getAttribute('data-toolbar')).toBe('expanded');

    await user.click(toggle);
    expect(surface.getAttribute('data-toolbar')).toBe('collapsed');
    transfer.dispose();
  });

  it('preserves the native minimized draft state instead of inventing local content', () => {
    document.body.innerHTML = fixture('draft');
    const nativeRoot = document.querySelector<HTMLElement>('#reply-control');
    if (!nativeRoot) throw new Error('Missing composer root');
    const transfer = new NativeContentTransfer(document);

    render(
      <div className="docode-theme-dark-modern" data-docode-workbench-root="owner">
        <NativeComposerSurface
          capability={detectComposer()}
          feedback={null}
          nativeContentTransfer={transfer}
          revision={0}
        />
      </div>,
    );

    expect(
      screen.getByRole('region', { name: 'Linux DO reply composer' }).getAttribute('data-state'),
    ).toBe('draft');
    expect(screen.getByRole('status').textContent).toContain('Draft saved by Linux DO');
    expect(document.querySelector('#reply-control')).toBe(nativeRoot);
    expect(screen.getByText('Native minimized draft')).not.toBeNull();
    transfer.dispose();
  });
});

async function waitForAnimationFrame(): Promise<void> {
  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      resolve();
    });
  });
}

function detectComposer() {
  const detection = detectLinuxDoCapabilities(
    document,
    recognizeLinuxDoRoute(window.location.href),
  );
  if (detection.state !== 'ready') throw new Error('Expected composer capability');
  return detection.composer;
}

function fixture(state: 'draft' | 'open' = 'open'): string {
  return `<header class="d-header"><div id="current-user" data-username="fixture-user"></div></header>
    <main id="main-outlet">
      <div class="post-stream"><div data-post-number="1"><article data-post-id="100">
        <nav><button class="post-action-menu__copy-link">Copy</button></nav>
      </article></div></div>
      <div id="topic-footer-buttons"><button class="btn-primary create">Reply</button></div>
    </main>
    <div id="native-composer-source"><div id="reply-control" class="${state} hide-preview">
      ${state === 'draft' ? '<span class="draft-text">Native minimized draft</span>' : ''}
      <div class="reply-area"><textarea class="d-editor-input" aria-label="Reply"></textarea>
        <button class="btn-primary create">Reply</button><button class="discard-button">Discard</button>
      </div>
    </div></div>`;
}
