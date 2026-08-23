// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://linux.do/latest" }

import { afterEach, describe, expect, it, vi } from 'vitest';

import { ContentController, ContentControllerError } from '../../src/runtime/contentController';
import { disableContentRuntime } from '../../src/runtime/contentRuntime';
import type { EnabledPreferenceStore } from '../../src/settings/enabledPreference';
import type { WorkbenchLayoutPreferenceStore } from '../../src/settings/workbenchLayoutPreference';

const linuxDoLocation = { hostname: 'linux.do', protocol: 'https:' };

afterEach(() => {
  vi.restoreAllMocks();
  disableContentRuntime(document);
  document.documentElement.removeAttribute('data-docode-runtime');
  document.documentElement.removeAttribute('data-docode-startup');
});

describe('ContentController', () => {
  it('keeps startup ownership until the initial document has finished parsing', async () => {
    const readyState = vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
    const store: EnabledPreferenceStore = {
      read: () => Promise.resolve({ recoveredInvalidValue: false, value: true }),
      write: () => Promise.resolve(),
    };
    const controller = new ContentController(document, linuxDoLocation, store);
    const initialization = controller.initialize();

    await Promise.resolve();
    await Promise.resolve();
    expect(document.documentElement.hasAttribute('data-docode-startup')).toBe(true);
    expect(document.documentElement.hasAttribute('data-docode-runtime')).toBe(false);

    readyState.mockReturnValue('interactive');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await initialization;

    expect(document.documentElement.hasAttribute('data-docode-startup')).toBe(false);
    expect(document.documentElement.hasAttribute('data-docode-runtime')).toBe(true);
  });

  it('does not mount after the content-script context is invalidated while parsing', async () => {
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
    const store: EnabledPreferenceStore = {
      read: () => Promise.resolve({ recoveredInvalidValue: false, value: true }),
      write: () => Promise.resolve(),
    };
    const abortController = new AbortController();
    const controller = new ContentController(document, linuxDoLocation, store);
    const initialization = controller.initialize(abortController.signal);

    await Promise.resolve();
    abortController.abort('content script invalidated');
    await initialization;

    expect(document.documentElement.hasAttribute('data-docode-startup')).toBe(false);
    expect(document.documentElement.hasAttribute('data-docode-runtime')).toBe(false);
  });

  it('does not mount after the content-script context is invalidated during storage', async () => {
    let resolvePreference!: (value: {
      readonly recoveredInvalidValue: boolean;
      readonly value: boolean;
    }) => void;
    const store: EnabledPreferenceStore = {
      read: () =>
        new Promise((resolve) => {
          resolvePreference = resolve;
        }),
      write: () => Promise.resolve(),
    };
    const abortController = new AbortController();
    const controller = new ContentController(document, linuxDoLocation, store);
    const initialization = controller.initialize(abortController.signal);

    abortController.abort('content script invalidated');
    resolvePreference({ recoveredInvalidValue: false, value: true });
    await initialization;

    expect(document.documentElement.hasAttribute('data-docode-startup')).toBe(false);
    expect(document.documentElement.hasAttribute('data-docode-runtime')).toBe(false);
  });

  it('does not mount after invalidation while the saved layout is loading', async () => {
    const enabledStore: EnabledPreferenceStore = {
      read: () => Promise.resolve({ recoveredInvalidValue: false, value: true }),
      write: () => Promise.resolve(),
    };
    let resolveLayout!: (value: {
      readonly recoveredInvalidValue: boolean;
      readonly sidebarWidth: number;
    }) => void;
    const layoutStore: WorkbenchLayoutPreferenceStore = {
      read: () =>
        new Promise((resolve) => {
          resolveLayout = resolve;
        }),
      writeSidebarWidth: () => Promise.resolve(),
    };
    const abortController = new AbortController();
    const controller = new ContentController(document, linuxDoLocation, enabledStore, layoutStore);
    const initialization = controller.initialize(abortController.signal);

    await Promise.resolve();
    await Promise.resolve();
    expect(resolveLayout).toBeTypeOf('function');
    abortController.abort('content script invalidated');
    resolveLayout({ recoveredInvalidValue: false, sidebarWidth: 300 });
    await initialization;

    expect(document.documentElement.hasAttribute('data-docode-startup')).toBe(false);
    expect(document.documentElement.hasAttribute('data-docode-runtime')).toBe(false);
  });

  it('initializes from storage and persists real enable/disable ownership', async () => {
    let value = true;
    const write = vi.fn((nextValue: boolean) => {
      value = nextValue;
      return Promise.resolve();
    });
    const store: EnabledPreferenceStore = {
      read: () => Promise.resolve({ recoveredInvalidValue: false, value }),
      write,
    };
    const controller = new ContentController(document, linuxDoLocation, store);

    await controller.initialize();
    expect(document.documentElement.hasAttribute('data-docode-startup')).toBe(false);
    await expect(controller.getStatus()).resolves.toMatchObject({ enabled: true, mounted: true });
    await expect(controller.restoreOriginal()).resolves.toMatchObject({
      enabled: false,
      mounted: false,
    });
    expect(write).toHaveBeenCalledWith(false);
  });

  it('hydrates the runtime from the validated workbench layout preference', async () => {
    const enabledStore: EnabledPreferenceStore = {
      read: () => Promise.resolve({ recoveredInvalidValue: false, value: true }),
      write: () => Promise.resolve(),
    };
    const readLayout = vi.fn(() =>
      Promise.resolve({ recoveredInvalidValue: true, sidebarWidth: 242 }),
    );
    const layoutStore: WorkbenchLayoutPreferenceStore = {
      read: readLayout,
      writeSidebarWidth: () => Promise.resolve(),
    };
    const controller = new ContentController(document, linuxDoLocation, enabledStore, layoutStore);

    await controller.initialize();
    expect(readLayout).toHaveBeenCalledOnce();
    await expect(controller.getStatus()).resolves.toMatchObject({
      mounted: true,
      storageRecovered: true,
    });
  });

  it('retains the invalid-storage recovery signal for the popup', async () => {
    const store: EnabledPreferenceStore = {
      read: () => Promise.resolve({ recoveredInvalidValue: true, value: true }),
      write: () => Promise.resolve(),
    };
    const controller = new ContentController(document, linuxDoLocation, store);

    await controller.initialize();

    await expect(controller.getStatus()).resolves.toMatchObject({
      storageRecovered: true,
    });
  });

  it('maps storage failures to a bounded error', async () => {
    const store: EnabledPreferenceStore = {
      read: () => Promise.reject(new Error('storage unavailable')),
      write: () => Promise.resolve(),
    };
    const controller = new ContentController(document, linuxDoLocation, store);

    await expect(controller.getStatus()).rejects.toEqual(
      expect.objectContaining<Partial<ContentControllerError>>({ code: 'storage-error' }),
    );
  });

  it('always restores the startup presentation when initialization fails', async () => {
    const store: EnabledPreferenceStore = {
      read: () => Promise.reject(new Error('storage unavailable')),
      write: () => Promise.resolve(),
    };
    const controller = new ContentController(document, linuxDoLocation, store);

    await controller.initialize();

    expect(document.documentElement.hasAttribute('data-docode-startup')).toBe(false);
    expect(document.documentElement.hasAttribute('data-docode-runtime')).toBe(false);
  });

  it('does not claim original-view recovery when the disable preference cannot be written', async () => {
    const store: EnabledPreferenceStore = {
      read: () => Promise.resolve({ recoveredInvalidValue: false, value: true }),
      write: () => Promise.reject(new Error('storage unavailable')),
    };
    const controller = new ContentController(document, linuxDoLocation, store);
    await controller.initialize();

    await expect(controller.restoreOriginal()).rejects.toEqual(
      expect.objectContaining<Partial<ContentControllerError>>({ code: 'storage-error' }),
    );
    await expect(controller.getStatus()).resolves.toMatchObject({ enabled: true, mounted: true });
  });
});
