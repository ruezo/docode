import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';

import { listFiles, readZipEntries, safeExtractionPath, toPosix } from './lib/zip-archive.mjs';

const projectRoot = path.resolve(import.meta.dirname, '..');
const outputRoot = path.join(projectRoot, '.output');
const unpackedRoot = path.join(outputRoot, 'chrome-mv3');
const packageJson = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'));
const browserChannel = process.env.DOCODE_BROWSER_CHANNEL ?? 'chromium';
const archivePath = path.join(outputRoot, `docode-${packageJson.version}-chrome.zip`);
const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'docode-package-verification-'));
const extractedRoot = path.join(temporaryRoot, 'packaged');

try {
  const archive = await readFile(archivePath);
  const entries = readZipEntries(archive);
  const unpackedFiles = await listFiles(unpackedRoot);
  const unpackedNames = unpackedFiles.map((file) => toPosix(path.relative(unpackedRoot, file)));

  assert.deepEqual(
    [...entries.keys()].sort(),
    unpackedNames,
    'The ZIP inventory must exactly match the clean production output.',
  );
  assert.equal(entries.size, 16, 'The release package must contain the reviewed 16 runtime files.');
  assert.equal(
    unpackedNames.some((name) => name.endsWith('.map')),
    false,
    'Production source maps must not be emitted.',
  );

  await mkdir(extractedRoot, { recursive: true });
  for (const file of unpackedFiles) {
    const name = toPosix(path.relative(unpackedRoot, file));
    const unpackedContents = await readFile(file);
    const packagedContents = entries.get(name);
    assert(packagedContents, `ZIP entry is missing: ${name}`);
    assert(unpackedContents.equals(packagedContents), `ZIP entry differs from the build: ${name}`);
    const extractedPath = safeExtractionPath(extractedRoot, name);
    await mkdir(path.dirname(extractedPath), { recursive: true });
    await writeFile(extractedPath, packagedContents);
  }

  const manifest = JSON.parse(await readFile(path.join(unpackedRoot, 'manifest.json'), 'utf8'));
  const packagedManifest = JSON.parse(
    await readFile(path.join(extractedRoot, 'manifest.json'), 'utf8'),
  );
  assert.equal(manifest.version, packageJson.version, 'Manifest and package versions must match.');
  assert.deepEqual(
    packagedManifest,
    manifest,
    'Packaged and unpacked manifests must be identical.',
  );

  const unpackedLifecycle = await verifyChromiumLifecycle(unpackedRoot, 'unpacked');
  const packagedLifecycle = await verifyChromiumLifecycle(extractedRoot, 'packaged');

  process.stdout.write(
    `${JSON.stringify(
      {
        archive: path.relative(projectRoot, archivePath),
        archiveBytes: archive.length,
        archiveSha256: createHash('sha256').update(archive).digest('hex'),
        entries: [...entries.keys()].sort(),
        installChecks: [unpackedLifecycle, packagedLifecycle],
        sourceMaps: 0,
        version: manifest.version,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  await rm(temporaryRoot, { force: true, recursive: true });
}

async function verifyChromiumLifecycle(extensionRoot, kind) {
  const profileRoot = await mkdtemp(path.join(temporaryRoot, `${kind}-profile-`));
  let context;
  let session;
  try {
    context = await chromium.launchPersistentContext(profileRoot, {
      args: ['--enable-unsafe-extension-debugging'],
      channel: browserChannel,
      headless: true,
      ignoreDefaultArgs: ['--disable-extensions'],
      viewport: { height: 640, width: 960 },
    });
    const sitePage = context.pages()[0] ?? (await context.newPage());
    const browser = context.browser();
    assert(browser, 'Chromium browser connection is unavailable.');
    session = await browser.newBrowserCDPSession();
    const installation = await session.send('Extensions.loadUnpacked', { path: extensionRoot });
    assert.match(installation.id, /^[a-p]{32}$/u, 'Chromium returned an invalid extension ID.');

    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${installation.id}/popup.html`);
    await popupPage.getByRole('heading', { name: 'DOCODE' }).waitFor();

    const fixtureUrl = `https://linux.do/latest?docode_package=${kind}`;
    await context.route(fixtureUrl, (route) =>
      route.fulfill({
        body: '<!doctype html><html><body><main id="main-outlet"><div id="list-area"></div></main></body></html>',
        contentType: 'text/html',
        status: 200,
      }),
    );
    await sitePage.goto(fixtureUrl, { waitUntil: 'domcontentloaded' });
    await sitePage.locator('[data-docode-workbench-root]').waitFor();
    assert.equal(
      await sitePage.locator('html[data-docode-runtime]').count(),
      1,
      `${kind} extension did not claim its runtime after installation.`,
    );

    await session.send('Extensions.uninstall', { id: installation.id });
    await sitePage.reload({ waitUntil: 'domcontentloaded' });
    await sitePage.waitForTimeout(250);
    assert.equal(
      await sitePage.locator('[data-docode-workbench-root], html[data-docode-runtime]').count(),
      0,
      `${kind} extension still modified a reloaded page after uninstall.`,
    );
    return { kind, loaded: true, removed: true, version: packageJson.version };
  } finally {
    await session?.detach();
    await context?.close();
  }
}
