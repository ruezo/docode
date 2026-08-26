// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  AppManifestDisguise,
  configureAppManifestDisguise,
  startAppManifestDisguise,
  stopAppManifestDisguise,
} from '../../src/runtime/appManifestDisguise';

const TEST_MANIFEST_HREF = 'chrome-extension://docode-test/docode.webmanifest';
const activeDisguises: AppManifestDisguise[] = [];

function createDisguise(): AppManifestDisguise {
  const disguise = new AppManifestDisguise(document, TEST_MANIFEST_HREF);
  activeDisguises.push(disguise);
  return disguise;
}

function flushMutations(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function manifestLinks(): HTMLLinkElement[] {
  return [...document.head.querySelectorAll<HTMLLinkElement>('link[rel~="manifest"]')];
}

function manifestLink(): HTMLLinkElement {
  const link = document.head.querySelector<HTMLLinkElement>('link[rel~="manifest"]');
  if (!link) throw new Error('Expected a manifest link fixture.');
  return link;
}

afterEach(() => {
  for (const disguise of activeDisguises.splice(0)) disguise.stop();
  stopAppManifestDisguise();
  document.head.innerHTML = '';
});

describe('docode.webmanifest', () => {
  it('ships installable DOCode metadata with embedded VS Code icons', () => {
    const manifest = JSON.parse(
      readFileSync(path.resolve(process.cwd(), 'public/docode.webmanifest'), 'utf8'),
    ) as Record<string, unknown>;
    expect(manifest).toMatchObject({
      display: 'standalone',
      id: 'https://linux.do/',
      name: 'DOCode',
      scope: 'https://linux.do/',
      short_name: 'DOCode',
      start_url: 'https://linux.do/',
      theme_color: '#1e1e1e',
    });
    const icons = manifest.icons as readonly { sizes: string; src: string; type: string }[];
    expect(icons.map((icon) => icon.sizes)).toEqual(['192x192', '512x512']);
    for (const icon of icons) {
      expect(icon.type).toBe('image/png');
      expect(icon.src.startsWith('data:image/png;base64,')).toBe(true);
    }
  });
});

describe('AppManifestDisguise', () => {
  it('replaces a native manifest link, drops crossorigin, and restores both on stop', () => {
    document.head.innerHTML =
      '<link rel="manifest" href="/manifest.webmanifest" crossorigin="use-credentials">';
    const disguise = createDisguise();
    disguise.start();

    const link = manifestLink();
    expect(link.getAttribute('href')).toBe(TEST_MANIFEST_HREF);
    expect(link.hasAttribute('crossorigin')).toBe(false);

    disguise.stop();
    expect(link.getAttribute('href')).toBe('/manifest.webmanifest');
    expect(link.getAttribute('crossorigin')).toBe('use-credentials');
  });

  it('injects a manifest link when the page has none and removes it on stop', () => {
    const disguise = createDisguise();
    disguise.start();

    const links = manifestLinks();
    expect(links).toHaveLength(1);
    expect(links[0]?.getAttribute('href')).toBe(TEST_MANIFEST_HREF);
    expect(links[0]?.getAttribute('data-docode-app-manifest')).toBe('true');

    disguise.stop();
    expect(manifestLinks()).toHaveLength(0);
  });

  it('re-disguises a manifest link that the site rewrites later', async () => {
    document.head.innerHTML = '<link rel="manifest" href="/manifest.webmanifest">';
    createDisguise().start();

    const link = manifestLink();
    link.setAttribute('href', '/manifest.webmanifest?refresh=1');
    await flushMutations();
    expect(link.getAttribute('href')).toBe(TEST_MANIFEST_HREF);
  });

  it('replaces a native manifest link added after start and drops the injected fallback', async () => {
    const disguise = createDisguise();
    disguise.start();
    expect(manifestLinks()).toHaveLength(1);

    const nativeLink = document.createElement('link');
    nativeLink.setAttribute('rel', 'manifest');
    nativeLink.setAttribute('href', '/manifest.webmanifest');
    document.head.prepend(nativeLink);
    await flushMutations();

    const links = manifestLinks();
    expect(links).toHaveLength(1);
    expect(links[0]).toBe(nativeLink);
    expect(nativeLink.getAttribute('href')).toBe(TEST_MANIFEST_HREF);

    disguise.stop();
    expect(nativeLink.getAttribute('href')).toBe('/manifest.webmanifest');
  });

  it('does not start twice and reports started state', () => {
    const disguise = createDisguise();
    expect(disguise.isStarted).toBe(false);
    expect(disguise.start()).toBe(true);
    expect(disguise.start()).toBe(false);
    expect(disguise.isStarted).toBe(true);
    expect(disguise.stop()).toBe(true);
    expect(disguise.stop()).toBe(false);
  });
});

describe('startAppManifestDisguise', () => {
  it('starts one shared disguise once configured, keeps it across repeat calls, and restores on stop', () => {
    document.head.innerHTML = '<link rel="manifest" href="/manifest.webmanifest">';
    configureAppManifestDisguise(TEST_MANIFEST_HREF);
    startAppManifestDisguise(document);
    startAppManifestDisguise(document);

    expect(manifestLink().getAttribute('href')).toBe(TEST_MANIFEST_HREF);

    stopAppManifestDisguise();
    expect(manifestLink().getAttribute('href')).toBe('/manifest.webmanifest');

    startAppManifestDisguise(document);
    expect(manifestLink().getAttribute('href')).toBe(TEST_MANIFEST_HREF);
  });

  it('tolerates stop without a prior start', () => {
    expect(() => {
      stopAppManifestDisguise();
    }).not.toThrow();
  });
});
