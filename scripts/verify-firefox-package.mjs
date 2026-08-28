import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { listFiles, readZipEntries, toPosix } from './lib/zip-archive.mjs';

const projectRoot = path.resolve(import.meta.dirname, '..');
const outputRoot = path.join(projectRoot, '.output');
const unpackedRoot = path.join(outputRoot, 'firefox-mv3');
const packageJson = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'));
const archivePath = path.join(outputRoot, `docode-${packageJson.version}-firefox.zip`);
const addOnPath = path.join(outputRoot, `docode-${packageJson.version}-firefox.xpi`);

const archive = await readFile(archivePath);
const addOn = await readFile(addOnPath);
assert(
  archive.equals(addOn),
  'The Firefox .xpi must be a byte-identical copy of the Firefox release ZIP.',
);

const entries = readZipEntries(addOn);
const unpackedFiles = await listFiles(unpackedRoot);
const unpackedNames = unpackedFiles.map((file) => toPosix(path.relative(unpackedRoot, file)));

assert.deepEqual(
  [...entries.keys()].sort(),
  unpackedNames,
  'The XPI inventory must exactly match the clean Firefox production output.',
);
assert.equal(entries.size, 16, 'The Firefox add-on must contain the reviewed 16 runtime files.');
assert.equal(
  unpackedNames.some((name) => name.endsWith('.map')),
  false,
  'Production source maps must not be emitted.',
);

for (const file of unpackedFiles) {
  const name = toPosix(path.relative(unpackedRoot, file));
  const unpackedContents = await readFile(file);
  const packagedContents = entries.get(name);
  assert(packagedContents, `XPI entry is missing: ${name}`);
  assert(unpackedContents.equals(packagedContents), `XPI entry differs from the build: ${name}`);
}

const manifestEntry = entries.get('manifest.json');
assert(manifestEntry, 'The Firefox add-on must ship a manifest.');
const manifest = JSON.parse(manifestEntry.toString('utf8'));
assert.equal(manifest.manifest_version, 3, 'The Firefox add-on must use Manifest V3.');
assert.equal(manifest.version, packageJson.version, 'Manifest and package versions must match.');
assert.deepEqual(
  manifest.background,
  { scripts: ['background.js'] },
  'Firefox MV3 runs the reviewed background worker as an event page, not a service worker.',
);
assert.deepEqual(
  manifest.browser_specific_settings,
  {
    gecko: {
      data_collection_permissions: { required: ['none'] },
      id: 'docode@linux.do',
      strict_min_version: '128.0',
    },
  },
  'The Firefox add-on must keep its reviewed add-on id, minimum version, and no data collection.',
);
assert.deepEqual(manifest.permissions, ['storage'], 'Only the storage permission is allowed.');
assert.equal(manifest.host_permissions, undefined, 'Host permissions must not be requested.');

const mainWorldScripts = (manifest.content_scripts ?? []).filter(({ world }) => world === 'MAIN');
assert.equal(
  mainWorldScripts.length,
  1,
  'Exactly one MAIN-world script is allowed: the reply shortcut bridge.',
);
const minimumVersion = Number.parseInt(
  manifest.browser_specific_settings.gecko.strict_min_version,
  10,
);
assert(
  minimumVersion >= 128,
  'MAIN-world content scripts require Firefox 128 or newer, so the minimum version must match.',
);

for (const entry of [
  ...manifest.background.scripts,
  ...(manifest.content_scripts ?? []).flatMap((script) => [
    ...(script.js ?? []),
    ...(script.css ?? []),
  ]),
]) {
  assert(entries.has(entry), `Manifest runtime entry is missing from the add-on: ${entry}`);
}

process.stdout.write(
  `${JSON.stringify(
    {
      addOn: path.relative(projectRoot, addOnPath),
      addOnBytes: addOn.length,
      addOnSha256: createHash('sha256').update(addOn).digest('hex'),
      archive: path.relative(projectRoot, archivePath),
      entries: [...entries.keys()].sort(),
      geckoId: manifest.browser_specific_settings.gecko.id,
      minimumFirefox: manifest.browser_specific_settings.gecko.strict_min_version,
      sourceMaps: 0,
      version: manifest.version,
    },
    null,
    2,
  )}\n`,
);
