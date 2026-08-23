// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import { bootstrapContentRuntime, disableContentRuntime } from '../../src/runtime/contentRuntime';

const linuxDoLocation = { hostname: 'linux.do', protocol: 'https:' };

afterEach(() => {
  disableContentRuntime(document);
  document.documentElement.removeAttribute('data-docode-runtime');
  document.documentElement.removeAttribute('data-docode-presentation');
  document.head.querySelectorAll('[data-docode-owned-style]').forEach((element) => {
    element.remove();
  });
  document.body.innerHTML = '';
});

describe('content runtime lifecycle', () => {
  it('mounts once when concurrent initialization repeats', async () => {
    const readEnabledState = vi.fn(() => Promise.resolve(true));

    const [first, second] = await Promise.all([
      bootstrapContentRuntime({ document, location: linuxDoLocation, readEnabledState }),
      bootstrapContentRuntime({ document, location: linuxDoLocation, readEnabledState }),
    ]);

    expect(first.status).toBe('mounted');
    expect(second.status).toBe('already-mounted');
    expect(readEnabledState).toHaveBeenCalledOnce();
    expect(document.documentElement.hasAttribute('data-docode-runtime')).toBe(true);
    expect(document.documentElement.hasAttribute('data-docode-presentation')).toBe(true);
    expect(document.querySelectorAll('[data-docode-owned-style]')).toHaveLength(1);

    expect(disableContentRuntime(document)).toBe(true);
    expect(disableContentRuntime(document)).toBe(false);
    expect(document.documentElement.hasAttribute('data-docode-runtime')).toBe(false);
    expect(document.documentElement.hasAttribute('data-docode-presentation')).toBe(false);
    expect(document.querySelectorAll('[data-docode-owned-style]')).toHaveLength(0);
  });

  it('does not mount when the extension is disabled', async () => {
    const result = await bootstrapContentRuntime({
      document,
      location: linuxDoLocation,
      readEnabledState: () => Promise.resolve(false),
    });

    expect(result).toEqual({ status: 'disabled' });
    expect(document.documentElement.hasAttribute('data-docode-runtime')).toBe(false);
  });

  it('does not claim runtime ownership when invalidated during the enabled-state read', async () => {
    let resolveEnabled!: (enabled: boolean) => void;
    const abortController = new AbortController();
    const bootstrap = bootstrapContentRuntime({
      document,
      location: linuxDoLocation,
      readEnabledState: () =>
        new Promise((resolve) => {
          resolveEnabled = resolve;
        }),
      signal: abortController.signal,
    });

    abortController.abort('content script invalidated');
    resolveEnabled(true);

    await expect(bootstrap).resolves.toEqual({ status: 'disabled' });
    expect(document.documentElement.hasAttribute('data-docode-runtime')).toBe(false);
    expect(document.documentElement.hasAttribute('data-docode-presentation')).toBe(false);
  });

  it('rejects unsupported hosts before reading enabled state', async () => {
    const readEnabledState = vi.fn(() => Promise.resolve(true));
    const result = await bootstrapContentRuntime({
      document,
      location: { hostname: 'example.com', protocol: 'https:' },
      readEnabledState,
    });

    expect(result).toEqual({ status: 'unsupported-host' });
    expect(readEnabledState).not.toHaveBeenCalled();
  });

  it('fails closed when a foreign mount marker exists', async () => {
    document.documentElement.setAttribute('data-docode-runtime', 'foreign-owner');

    const result = await bootstrapContentRuntime({
      document,
      location: linuxDoLocation,
      readEnabledState: () => Promise.resolve(true),
    });

    expect(result).toEqual({ status: 'marker-conflict' });
    expect(document.documentElement.getAttribute('data-docode-runtime')).toBe('foreign-owner');
  });

  it('invalidates captured work and runs cleanup on unmount', async () => {
    const result = await bootstrapContentRuntime({
      document,
      location: linuxDoLocation,
      readEnabledState: () => Promise.resolve(true),
    });
    if (result.status !== 'mounted') throw new Error('Expected the runtime to mount.');

    const cleanup = vi.fn();
    result.runtime.registerCleanup(cleanup);
    const generation = result.runtime.captureGeneration();

    expect(result.runtime.isCurrentGeneration(generation)).toBe(true);
    expect(disableContentRuntime(document)).toBe(true);
    expect(result.runtime.isCurrentGeneration(generation)).toBe(false);
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it('restores an owned native region during disable', async () => {
    document.body.innerHTML = '<main id="native">Native topic list</main>';
    const nativeMain = document.querySelector<HTMLElement>('#native');
    if (!nativeMain) throw new Error('Expected the native fixture region.');
    const result = await bootstrapContentRuntime({
      document,
      location: linuxDoLocation,
      readEnabledState: () => Promise.resolve(true),
    });
    if (result.status !== 'mounted') throw new Error('Expected the runtime to mount.');

    expect(result.runtime.hideVerifiedNativeRegion(nativeMain)).toBe(true);
    expect(nativeMain.hidden).toBe(true);

    expect(disableContentRuntime(document)).toBe(true);
    expect(nativeMain.hasAttribute('hidden')).toBe(false);
    expect(nativeMain.hasAttribute('data-docode-native-hidden')).toBe(false);
  });

  it('supports repeated enable and disable cycles without marker accumulation', async () => {
    for (let cycle = 0; cycle < 3; cycle += 1) {
      const result = await bootstrapContentRuntime({
        document,
        location: linuxDoLocation,
        readEnabledState: () => Promise.resolve(true),
      });

      expect(result.status).toBe('mounted');
      expect(document.querySelectorAll('[data-docode-owned-style]')).toHaveLength(1);
      expect(disableContentRuntime(document)).toBe(true);
      expect(document.documentElement.hasAttribute('data-docode-runtime')).toBe(false);
      expect(document.querySelectorAll('[data-docode-owned-style]')).toHaveLength(0);
    }
  });

  it('disconnects every scoped mutation observer across repeated lifecycle cycles', async () => {
    const NativeMutationObserver = window.MutationObserver;
    const observers: TrackingMutationObserver[] = [];
    class TrackingMutationObserver extends NativeMutationObserver {
      disconnected = false;

      constructor(callback: MutationCallback) {
        super(callback);
        observers.push(this);
      }

      override disconnect(): void {
        this.disconnected = true;
        super.disconnect();
      }
    }
    Object.defineProperty(window, 'MutationObserver', {
      configurable: true,
      value: TrackingMutationObserver,
    });
    try {
      for (let cycle = 0; cycle < 5; cycle += 1) {
        document.body.innerHTML = '<main><div class="post-stream"></div></main>';
        const result = await bootstrapContentRuntime({
          document,
          location: linuxDoLocation,
          readEnabledState: () => Promise.resolve(true),
        });
        expect(result.status).toBe('mounted');
        expect(disableContentRuntime(document)).toBe(true);
        expect(observers.every(({ disconnected }) => disconnected)).toBe(true);
      }
      expect(observers.length).toBeGreaterThanOrEqual(10);
    } finally {
      Object.defineProperty(window, 'MutationObserver', {
        configurable: true,
        value: NativeMutationObserver,
      });
    }
  });

  it('fails closed when a foreign presentation marker exists', async () => {
    document.documentElement.setAttribute('data-docode-presentation', 'foreign-owner');

    const result = await bootstrapContentRuntime({
      document,
      location: linuxDoLocation,
      readEnabledState: () => Promise.resolve(true),
    });

    expect(result).toEqual({ status: 'marker-conflict' });
    expect(document.documentElement.getAttribute('data-docode-presentation')).toBe('foreign-owner');
  });
});
