import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { chromium } from '@playwright/test';

const rootDir = path.resolve(import.meta.dirname, '..');
const extensionPath = path.join(rootDir, '.output/chrome-mv3');
const evidenceDir = path.join(rootDir, 'test-results/m74-t01');
const browserChannel = process.env.DOCODE_BROWSER_CHANNEL ?? 'chromium';
const profileDir = await mkdtemp(path.join(tmpdir(), `docode-context-${browserChannel}-`));

await mkdir(evidenceDir, { recursive: true });

let context;

try {
  context = await chromium.launchPersistentContext(profileDir, {
    args: ['--enable-unsafe-extension-debugging'],
    channel: browserChannel,
    headless: true,
    ignoreDefaultArgs: ['--disable-extensions'],
    viewport: { height: 800, width: 1280 },
  });

  const browser = context.browser();
  assert(browser, 'Browser connection is unavailable.');
  const browserSession = await browser.newBrowserCDPSession();
  const extension = await browserSession.send('Extensions.loadUnpacked', { path: extensionPath });
  assert.match(extension.id, /^[a-p]{32}$/u, 'Browser returned an invalid extension ID.');

  const popupPage = await waitForExtensionPopup(context, extension.id);
  await popupPage.evaluate(async () => {
    await globalThis.chrome.storage.local.set({ enabled: true });
  });

  const pageErrors = [];
  const linuxDoPage = await context.newPage();
  linuxDoPage.on('pageerror', (error) => pageErrors.push(error.message));
  await linuxDoPage.addInitScript(() => {
    globalThis.__docodeContentStarts = [];
    window.addEventListener('message', (event) => {
      const data = event.data;
      if (
        data?.contentScriptName === 'content' &&
        data?.type?.endsWith(':wxt:content-script-started')
      ) {
        globalThis.__docodeContentStarts.push(data.type);
      }
    });
  });

  await linuxDoPage.goto('https://linux.do/', {
    timeout: 60_000,
    waitUntil: 'domcontentloaded',
  });
  await linuxDoPage.waitForFunction(() => globalThis.__docodeContentStarts.length === 1);
  await assertRuntimeOwnership(linuxDoPage, true);

  await popupPage.evaluate(() => {
    globalThis.chrome.runtime.reload();
  });
  await assertRuntimeOwnership(linuxDoPage, false);
  await linuxDoPage.waitForTimeout(250);
  assert.deepEqual(pageErrors, []);
  await linuxDoPage.screenshot({
    path: path.join(evidenceDir, 'runtime-reload-native-restored.png'),
  });

  const extensionsAfterRuntimeReload = await browserSession.send('Extensions.getExtensions');
  if (extensionsAfterRuntimeReload.extensions.some(({ id }) => id === extension.id)) {
    await browserSession.send('Extensions.uninstall', { id: extension.id });
  }
  const recoveredExtension = await browserSession.send('Extensions.loadUnpacked', {
    path: extensionPath,
  });
  assert.equal(recoveredExtension.id, extension.id);
  const recoveredPopupPage = await waitForExtensionPopup(context, extension.id);
  await recoveredPopupPage.evaluate(async () => {
    await globalThis.chrome.storage.local.set({ enabled: true });
  });
  await recoveredPopupPage.close();
  await linuxDoPage.reload({ timeout: 60_000, waitUntil: 'domcontentloaded' });
  await linuxDoPage.waitForFunction(() => globalThis.__docodeContentStarts.length === 1);
  await assertRuntimeOwnership(linuxDoPage, true);
  assert.deepEqual(pageErrors, []);
  await linuxDoPage.screenshot({
    path: path.join(evidenceDir, 'runtime-reload-remounted.png'),
  });

  process.stdout.write(
    `${JSON.stringify(
      {
        browser: {
          channel: browserChannel,
          version: browser.version(),
        },
        errors: pageErrors,
        extensionId: extension.id,
        states: ['mounted', 'runtime-invalidated', 'native-restored', 'fresh-page-remounted'],
      },
      null,
      2,
    )}\n`,
  );
} finally {
  await context?.close();
  await rm(profileDir, { force: true, recursive: true });
}

async function waitForExtensionPopup(browserContext, extensionId) {
  const page = await browserContext.newPage();
  const popupUrl = `chrome-extension://${extensionId}/popup.html`;
  let lastNavigationError;

  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      await page.goto(popupUrl, { timeout: 1_000, waitUntil: 'domcontentloaded' });
      const runtimeId = await page.evaluate(() => globalThis.chrome?.runtime?.id ?? null);
      if (runtimeId === extensionId) return page;
    } catch (error) {
      lastNavigationError = error;
    }
    await page.waitForTimeout(100);
  }

  await page.close();
  throw new Error('Extension popup did not recover after the runtime reload.', {
    cause: lastNavigationError,
  });
}

async function assertRuntimeOwnership(page, mounted) {
  await page.waitForFunction(
    (expected) =>
      document.documentElement.hasAttribute('data-docode-runtime') === expected &&
      document.documentElement.hasAttribute('data-docode-presentation') === expected &&
      document.querySelectorAll('[data-docode-owned-style]').length === (expected ? 1 : 0) &&
      document.querySelectorAll('[data-docode-workbench-root]').length === (expected ? 1 : 0) &&
      document.querySelectorAll('[data-docode-native-hidden]').length === 0,
    mounted,
  );
}
