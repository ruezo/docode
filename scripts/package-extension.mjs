import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';

import { zip } from 'wxt';

const projectRoot = path.resolve(import.meta.dirname, '..');
const outputRoot = path.join(projectRoot, '.output');
const packageJson = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'));
const expectedArtifact = path.join(outputRoot, `docode-${packageJson.version}-chrome.zip`);

assert.equal(path.dirname(outputRoot), projectRoot, 'Refusing to clean an unexpected output path.');
await rm(outputRoot, { force: true, recursive: true });

const artifacts = await zip({
  browser: 'chrome',
  manifestVersion: 3,
  root: projectRoot,
  zip: { zipSources: false },
});

assert.deepEqual(
  artifacts.map((artifact) => path.resolve(artifact)),
  [expectedArtifact],
  'WXT produced an unexpected release artifact set.',
);
