// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://linux.do/latest" }

import { afterEach, describe, expect, it, vi } from 'vitest';

import { LinuxDoNavigationAdapter } from '../../src/linuxdo/navigationAdapter';
import { recognizeLinuxDoRoute } from '../../src/linuxdo/routes';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('LinuxDoNavigationAdapter', () => {
  it('activates one scoped real anchor and resolves only after the target route is observed', async () => {
    const owner = document.createElement('div');
    document.body.append(owner);
    const activated: string[] = [];
    const adapter = new LinuxDoNavigationAdapter(document, owner, route('/latest'), 0, {
      activate: (anchor) => {
        activated.push(anchor.href);
        expect(anchor.dataset.docodeCommandNavigation).toBe('true');
        expect(anchor.closest('div')).toBe(owner);
      },
    });
    const controller = new AbortController();
    const result = adapter.navigate(route('/hot'), 0, controller.signal);

    expect(activated).toEqual(['https://linux.do/hot']);
    expect(owner.querySelector('[data-docode-command-navigation]')).toBeNull();
    adapter.observe(route('/hot'), 1);
    await expect(result).resolves.toMatchObject({ kind: 'navigated', route: { view: 'hot' } });
  });

  it('reports unchanged and rejects stale, unsupported, and concurrent requests without activation', async () => {
    const owner = document.createElement('div');
    document.body.append(owner);
    const activate = vi.fn();
    const adapter = new LinuxDoNavigationAdapter(document, owner, route('/latest'), 2, {
      activate,
    });

    await expect(
      adapter.navigate(route('/latest'), 2, new AbortController().signal),
    ).resolves.toEqual(expect.objectContaining({ kind: 'unchanged' }));
    await expect(adapter.navigate(route('/hot'), 1, new AbortController().signal)).resolves.toEqual(
      {
        kind: 'stale',
      },
    );
    await expect(
      adapter.navigate(
        recognizeLinuxDoRoute('https://example.com/hot'),
        2,
        new AbortController().signal,
      ),
    ).resolves.toEqual({ kind: 'unavailable' });

    const pending = adapter.navigate(route('/hot'), 2, new AbortController().signal);
    await expect(adapter.navigate(route('/top'), 2, new AbortController().signal)).resolves.toEqual(
      {
        kind: 'unavailable',
      },
    );
    adapter.observe(route('/hot'), 3);
    await expect(pending).resolves.toEqual(expect.objectContaining({ kind: 'navigated' }));
    expect(activate).toHaveBeenCalledOnce();
  });

  it('returns stale for a different observed route and aborts or contains activation failure', async () => {
    const owner = document.createElement('div');
    document.body.append(owner);
    const adapter = new LinuxDoNavigationAdapter(document, owner, route('/latest'), 0, {
      activate: () => undefined,
    });
    const stale = adapter.navigate(route('/hot'), 0, new AbortController().signal);
    adapter.observe(route('/top'), 1);
    await expect(stale).resolves.toEqual({ kind: 'stale' });

    const controller = new AbortController();
    const aborted = adapter.navigate(route('/hot'), 1, controller.signal);
    controller.abort();
    await expect(aborted).resolves.toEqual({ kind: 'aborted' });

    const failing = new LinuxDoNavigationAdapter(document, owner, route('/top'), 1, {
      activate: () => {
        throw new Error('private integration detail');
      },
    });
    await expect(failing.navigate(route('/hot'), 1, new AbortController().signal)).resolves.toEqual(
      {
        kind: 'failed',
      },
    );
  });

  it('settles pending work during disposal and ignores later observations', async () => {
    const owner = document.createElement('div');
    document.body.append(owner);
    const adapter = new LinuxDoNavigationAdapter(document, owner, route('/latest'), 0, {
      activate: () => undefined,
    });
    const pending = adapter.navigate(route('/hot'), 0, new AbortController().signal);

    expect(adapter.dispose()).toBe(true);
    expect(adapter.dispose()).toBe(false);
    adapter.observe(route('/hot'), 1);
    await expect(pending).resolves.toEqual({ kind: 'unavailable' });
    await expect(adapter.navigate(route('/hot'), 1, new AbortController().signal)).resolves.toEqual(
      {
        kind: 'unavailable',
      },
    );
  });
});

function route(path: string) {
  return recognizeLinuxDoRoute(`https://linux.do${path}`);
}
