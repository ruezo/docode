import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { inflateRawSync } from 'node:zlib';

import { chromium } from '@playwright/test';

const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const CENTRAL_DIRECTORY_ENTRY = 0x02014b50;
const LOCAL_FILE_HEADER = 0x04034b50;
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
  assert.equal(entries.size, 14, 'The release package must contain the reviewed 14 runtime files.');
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

function readZipEntries(buffer) {
  const minimumOffset = Math.max(0, buffer.length - 65_557);
  let directoryEnd = -1;
  for (let offset = buffer.length - 22; offset >= minimumOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY) {
      directoryEnd = offset;
      break;
    }
  }
  assert(directoryEnd >= 0, 'ZIP end-of-central-directory record was not found.');
  assert.equal(buffer.readUInt16LE(directoryEnd + 4), 0, 'Multi-disk ZIP files are not supported.');
  assert.equal(buffer.readUInt16LE(directoryEnd + 6), 0, 'Multi-disk ZIP files are not supported.');
  const entryCount = buffer.readUInt16LE(directoryEnd + 10);
  const directorySize = buffer.readUInt32LE(directoryEnd + 12);
  const directoryOffset = buffer.readUInt32LE(directoryEnd + 16);
  assert.equal(
    directoryOffset + directorySize,
    directoryEnd,
    'ZIP central directory has unexpected trailing data.',
  );

  const entries = new Map();
  let offset = directoryOffset;
  for (let index = 0; index < entryCount; index += 1) {
    assert.equal(buffer.readUInt32LE(offset), CENTRAL_DIRECTORY_ENTRY, 'Invalid ZIP entry header.');
    const flags = buffer.readUInt16LE(offset + 8);
    const compression = buffer.readUInt16LE(offset + 10);
    const expectedCrc = buffer.readUInt32LE(offset + 16);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
    assert.equal(flags & 1, 0, `Encrypted ZIP entry is forbidden: ${name}`);
    assert.equal(entries.has(name), false, `Duplicate ZIP entry is forbidden: ${name}`);
    safeExtractionPath('/docode-package-root', name);

    assert.equal(
      buffer.readUInt32LE(localOffset),
      LOCAL_FILE_HEADER,
      `Invalid local ZIP header: ${name}`,
    );
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataOffset, dataOffset + compressedSize);
    const contents =
      compression === 0
        ? compressed
        : compression === 8
          ? inflateRawSync(compressed)
          : assert.fail(`Unsupported ZIP compression method ${String(compression)}: ${name}`);
    assert.equal(contents.length, uncompressedSize, `ZIP size mismatch: ${name}`);
    assert.equal(crc32(contents), expectedCrc, `ZIP CRC mismatch: ${name}`);
    entries.set(name, contents);
    offset += 46 + nameLength + extraLength + commentLength;
  }
  assert.equal(offset, directoryEnd, 'ZIP directory entry count or size is inconsistent.');
  return entries;
}

function safeExtractionPath(root, name) {
  assert(name && !name.includes('\\'), `Unsafe ZIP entry name: ${name}`);
  assert.equal(path.posix.normalize(name), name, `Unsafe ZIP entry path: ${name}`);
  assert(!path.posix.isAbsolute(name) && !name.endsWith('/'), `Unsafe ZIP entry path: ${name}`);
  const target = path.resolve(root, ...name.split('/'));
  assert(
    target.startsWith(`${path.resolve(root)}${path.sep}`),
    `ZIP entry escapes the extraction root: ${name}`,
  );
  return target;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function toPosix(value) {
  return value.split(path.sep).join('/');
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const target = path.join(directory, entry.name);
      return entry.isDirectory() ? listFiles(target) : Promise.resolve([target]);
    }),
  );
  return nested.flat().sort();
}
