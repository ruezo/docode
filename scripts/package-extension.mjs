import assert from 'node:assert/strict';
import { copyFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';

import { zip } from 'wxt';

const projectRoot = path.resolve(import.meta.dirname, '..');
const outputRoot = path.join(projectRoot, '.output');
const packageJson = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'));
const chromeArchive = path.join(outputRoot, `docode-${packageJson.version}-chrome.zip`);
const firefoxArchive = path.join(outputRoot, `docode-${packageJson.version}-firefox.zip`);
const firefoxAddOn = path.join(outputRoot, `docode-${packageJson.version}-firefox.xpi`);

assert.equal(path.dirname(outputRoot), projectRoot, 'Refusing to clean an unexpected output path.');
await rm(outputRoot, { force: true, recursive: true });

const chromeArtifacts = await zip({
  browser: 'chrome',
  manifestVersion: 3,
  root: projectRoot,
  zip: { zipSources: false },
});

assert.deepEqual(
  chromeArtifacts.map((artifact) => path.resolve(artifact)),
  [chromeArchive],
  'WXT produced an unexpected Chrome release artifact set.',
);

const firefoxArtifacts = await zip({
  browser: 'firefox',
  manifestVersion: 3,
  root: projectRoot,
  zip: { zipSources: false },
});

assert.deepEqual(
  firefoxArtifacts.map((artifact) => path.resolve(artifact)),
  [firefoxArchive],
  'WXT produced an unexpected Firefox release artifact set.',
);

// Firefox installs add-ons from an .xpi, which is the same ZIP container under
// a different extension, so the two release files stay byte-identical.
await copyFile(firefoxArchive, firefoxAddOn);
