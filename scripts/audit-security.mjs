import assert from 'node:assert/strict';
import { lstat, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = path.join(projectRoot, '.output/chrome-mv3');
const manifestPath = path.join(outputRoot, 'manifest.json');
const sourceExtensions = new Set(['.css', '.html', '.js', '.jsx', '.ts', '.tsx']);

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
assert.equal(manifest.manifest_version, 3, 'The production manifest must use Manifest V3.');
assert.deepEqual(
  manifest.permissions,
  ['storage'],
  'Only the implemented storage permission is allowed.',
);
assert.equal(manifest.host_permissions, undefined, 'Host permissions must not be requested.');
assert.equal(
  manifest.optional_permissions,
  undefined,
  'Optional permissions must not be requested.',
);
assert.equal(
  manifest.optional_host_permissions,
  undefined,
  'Optional host permissions must not be requested.',
);
assert.deepEqual(
  manifest.background,
  { service_worker: 'background.js' },
  'The only background entry must be the reviewed MV3 window full-screen service worker.',
);
assert.equal(
  manifest.externally_connectable,
  undefined,
  'External extension messaging must remain unavailable.',
);
assert.equal(
  manifest.web_accessible_resources,
  undefined,
  'No runtime asset needs to be exposed to page scripts.',
);
assert.equal(
  manifest.content_scripts?.length,
  2,
  'Exactly the isolated workbench script and the MAIN-world reply bridge are expected.',
);
for (const script of manifest.content_scripts) {
  assert.deepEqual(
    script.matches,
    ['https://linux.do/*'],
    'The production site scope must remain limited to Linux DO HTTPS pages.',
  );
  assert.equal(
    script.run_at,
    'document_start',
    'Content scripts must claim enabled-route presentation before Linux DO paints its loader.',
  );
}
const mainWorldScripts = manifest.content_scripts.filter(({ world }) => world === 'MAIN');
assert.equal(
  mainWorldScripts.length,
  1,
  'Exactly one MAIN-world script is allowed: the reply shortcut bridge.',
);
assert.equal(
  manifest.content_scripts.filter(({ world }) => world === undefined).length,
  1,
  'The workbench content script must remain in the isolated world.',
);
const csp = JSON.stringify(manifest.content_security_policy ?? 'Manifest V3 default');
assert.doesNotMatch(
  csp,
  /unsafe-eval|https?:\/\//iu,
  'Extension CSP must not allow remote code or eval.',
);

const sourceFiles = (
  await Promise.all(
    ['entrypoints', 'src'].map((directory) => listFiles(path.join(projectRoot, directory))),
  )
)
  .flat()
  .filter((file) => sourceExtensions.has(path.extname(file)));
const sourceText = new Map(
  await Promise.all(sourceFiles.map(async (file) => [file, await readFile(file, 'utf8')])),
);

const prohibitedSourcePatterns = [
  ['dynamic eval', /\beval\s*\(/u],
  ['dynamic Function construction', /\bnew\s+Function\s*\(/u],
  ['raw React HTML insertion', /dangerouslySetInnerHTML/u],
  ['innerHTML assignment', /\.innerHTML\s*=/u],
  ['outerHTML assignment', /\.outerHTML\s*=/u],
  ['adjacent HTML insertion', /\binsertAdjacentHTML\s*\(/u],
  ['generic page messaging bridge', /\b(?:globalThis|window)\.postMessage\s*\(/u],
  ['runtime script injection', /\b(?:executeScript|importScripts)\s*\(/u],
  ['remote module import', /\bimport\s*\(\s*['"]https?:\/\//u],
  ['remote script element', /<script\b[^>]*\bsrc\s*=\s*['"]https?:\/\//iu],
  ['remote stylesheet import', /@import\s+(?:url\()?\s*['"]?https?:\/\//iu],
  ['application logging', /\bconsole\.(?:debug|error|info|log|trace|warn)\s*\(/u],
];

for (const [file, contents] of sourceText) {
  for (const [label, pattern] of prohibitedSourcePatterns) {
    assert.doesNotMatch(
      contents,
      pattern,
      `${label} is not allowed in runtime source: ${path.relative(projectRoot, file)}`,
    );
  }
}

const replyBridgeSource =
  sourceText.get(path.join(projectRoot, 'entrypoints/replybridge.content.ts')) ?? '';
assert.match(
  replyBridgeSource,
  /world:\s*'MAIN'/u,
  'The reply bridge must declare the MAIN world explicitly.',
);
assert.doesNotMatch(
  replyBridgeSource,
  /fetch|XMLHttpRequest|browser\.|chrome\./u,
  'The reply bridge must not touch network or extension APIs from the page world.',
);

const networkFiles = matchingFiles(
  sourceText,
  /(?:\bfetch|#fetch|\bWebSocket|\bEventSource|\bXMLHttpRequest|\bsendBeacon)\s*(?:\?\.)?\s*\(/u,
);
assert.deepEqual(
  networkFiles,
  [
    'src/linuxdo/explorerTopicLoader.ts',
    'src/linuxdo/notificationsLoader.ts',
    'src/linuxdo/postActionApiClient.ts',
    'src/linuxdo/searchAdapter.ts',
    'src/linuxdo/topicListPaginator.ts',
    'src/linuxdo/topicPaginator.ts',
  ],
  'Only the reviewed same-origin Linux DO Explorer, Search, notifications, and pagination adapters may initiate network requests.',
);
const notificationsSource =
  sourceText.get(path.join(projectRoot, 'src/linuxdo/notificationsLoader.ts')) ?? '';
assert.match(
  notificationsSource,
  /credentials:\s*'same-origin'/u,
  'The notifications loader must keep same-origin credentials.',
);
assert.match(
  notificationsSource,
  /responseUrl\.origin\s*!==\s*origin/u,
  'The notifications loader must reject cross-origin responses.',
);
const likeApiSource =
  sourceText.get(path.join(projectRoot, 'src/linuxdo/postActionApiClient.ts')) ?? '';
assert.match(
  likeApiSource,
  /credentials:\s*'same-origin'/u,
  'The Like API client must keep same-origin credentials.',
);
assert.match(
  likeApiSource,
  /responseUrl\.origin\s*!==\s*origin/u,
  'The Like API client must reject cross-origin responses.',
);
assert.match(
  likeApiSource,
  /'X-CSRF-Token'/u,
  'The Like API client must authenticate mutations with the Linux DO session token.',
);
const explorerSource =
  sourceText.get(path.join(projectRoot, 'src/linuxdo/explorerTopicLoader.ts')) ?? '';
assert.match(
  explorerSource,
  /credentials:\s*'same-origin'/u,
  'Explorer topic loading must keep same-origin credentials.',
);
assert.match(
  explorerSource,
  /LINUX_DO_SIMPLE_TOPIC_LIST_VIEWS\s*=\s*\[\s*'hot',\s*'latest',\s*'new',\s*'top',\s*'unread',?\s*\]/u,
  'Explorer topic loading must retain the reviewed route allowlist.',
);
assert.match(
  explorerSource,
  /isReviewedTopicListView\(view\)/u,
  'Explorer topic loading must validate every route against the reviewed allowlist.',
);
assert.match(
  explorerSource,
  /new URL\(`\/\$\{view\}\.json`,\s*this\.#document\.location\.origin\)/u,
  'Explorer JSON loading must derive only from the validated route view.',
);
assert.match(
  explorerSource,
  /new URL\(`\/\$\{view\}`,\s*this\.#document\.location\.origin\)/u,
  'Explorer HTML fallback must derive only from the validated route view.',
);
const paginatorSource =
  sourceText.get(path.join(projectRoot, 'src/linuxdo/topicListPaginator.ts')) ?? '';
assert.match(
  paginatorSource,
  /credentials:\s*'same-origin'/u,
  'Topic-list pagination must keep same-origin credentials.',
);
assert.match(
  paginatorSource,
  /responseUrl\.origin\s*!==\s*this\.#document\.location\.origin/u,
  'Topic-list pagination responses must remain on the active Linux DO origin.',
);
assert.match(
  paginatorSource,
  /nextUrl\.origin\s*===\s*responseUrl\.origin/u,
  'Server-provided topic-list cursors must remain on the verified response origin.',
);
const topicPaginatorSource =
  sourceText.get(path.join(projectRoot, 'src/linuxdo/topicPaginator.ts')) ?? '';
assert.match(
  topicPaginatorSource,
  /credentials:\s*'same-origin'/u,
  'Topic pagination must keep same-origin credentials.',
);
assert.match(
  topicPaginatorSource,
  /responseUrl\.origin\s*!==\s*this\.#document\.location\.origin/u,
  'Topic pagination responses must remain on the active Linux DO origin.',
);
assert.match(
  topicPaginatorSource,
  /\/t\/\$\{encodeURIComponent\(route\.topicSlug\)\}\/\$\{String\(route\.topicId\)\}\.json/u,
  'Topic pagination must initialize from the reviewed topic JSON endpoint.',
);
assert.match(
  topicPaginatorSource,
  /\/t\/\$\{String\(route\.topicId\)\}\/posts\.json/u,
  'Topic pagination must continue through the reviewed post-stream endpoint.',
);
const searchSource = sourceText.get(path.join(projectRoot, 'src/linuxdo/searchAdapter.ts')) ?? '';
assert.match(
  searchSource,
  /credentials:\s*'same-origin'/u,
  'Search must keep same-origin credentials.',
);
assert.match(
  searchSource,
  /const SEARCH_ENDPOINT = '\/search\/query'/u,
  'Search must use the reviewed endpoint.',
);

const storageFiles = matchingFiles(sourceText, /wxt\/utils\/storage/u);
assert.deepEqual(
  storageFiles,
  [
    'src/settings/enabledPreference.ts',
    'src/settings/workbenchAppearancePreference.ts',
    'src/settings/workbenchLayoutPreference.ts',
  ],
  'Extension storage must remain confined to the reviewed preference modules.',
);
const enabledStorageSource =
  sourceText.get(path.join(projectRoot, 'src/settings/enabledPreference.ts')) ?? '';
assert.match(
  enabledStorageSource,
  /'local:enabled'/u,
  'The boolean enabled preference must use its reviewed key.',
);
const appearanceStorageSource =
  sourceText.get(path.join(projectRoot, 'src/settings/workbenchAppearancePreference.ts')) ?? '';
assert.match(
  appearanceStorageSource,
  /'local:workbench\.appearance'/u,
  'The validated workbench appearance preference must use its reviewed key.',
);
const layoutStorageSource =
  sourceText.get(path.join(projectRoot, 'src/settings/workbenchLayoutPreference.ts')) ?? '';
assert.match(
  layoutStorageSource,
  /'local:workbench\.sidebarWidth'/u,
  'The validated Explorer width preference must use its reviewed key.',
);
const backgroundSource = sourceText.get(path.join(projectRoot, 'entrypoints/background.ts')) ?? '';
assert.match(
  backgroundSource,
  /browser\.windows\.get\(windowId\)/u,
  'The background worker may read only the sender window needed for full-screen state.',
);
assert.match(
  backgroundSource,
  /browser\.windows\.update\(windowId, \{ state \}\)/u,
  'The background worker may update only the reviewed sender-window state.',
);
assert.doesNotMatch(
  backgroundSource,
  /browser\.(?:cookies|history|tabs|webRequest)\b/u,
  'The background worker must not expand into unrelated browser capabilities.',
);
const windowFullscreenMessageSource =
  sourceText.get(path.join(projectRoot, 'src/messaging/windowFullscreenMessages.ts')) ?? '';
assert.match(
  windowFullscreenMessageSource,
  /sender\.frameId !== undefined && sender\.frameId !== 0/u,
  'Window full-screen messages must remain restricted to the top-level Linux DO frame.',
);
assert.match(
  windowFullscreenMessageSource,
  /isLinuxDoUrl\(sender\.url\)/u,
  'Window full-screen messages must validate the Linux DO sender URL.',
);

const packageFiles = await listFiles(outputRoot);
assert(packageFiles.length > 0, 'The production output is empty.');
for (const file of packageFiles) {
  const relative = path.relative(outputRoot, file);
  assert.doesNotMatch(
    relative,
    /(?:^|\/)(?:\.env|[^/]+\.(?:key|map|pem|ts|tsx))$/iu,
    `Sensitive or source-only file found in the production output: ${relative}`,
  );
  const fileStat = await lstat(file);
  assert(
    !fileStat.isSymbolicLink(),
    `Symlinks are not allowed in the production output: ${relative}`,
  );
}

for (const contentScript of manifest.content_scripts) {
  for (const entry of [...(contentScript.js ?? []), ...(contentScript.css ?? [])]) {
    await assertPackageEntry(entry);
  }
}
await assertPackageEntry(manifest.background.service_worker);
await assertPackageEntry(manifest.action?.default_popup);

const popupHtml = await readFile(path.join(outputRoot, manifest.action.default_popup), 'utf8');
assert.doesNotMatch(
  popupHtml,
  /\b(?:href|src)\s*=\s*['"]https?:\/\//iu,
  'The popup must not load remote runtime resources.',
);
const scriptTags = [...popupHtml.matchAll(/<script\b([^>]*)>/giu)];
assert(scriptTags.length > 0, 'The popup must include its local application script.');
for (const [, attributes = ''] of scriptTags) {
  assert.match(attributes, /\bsrc\s*=\s*['"]\//iu, 'Popup scripts must use packaged paths.');
  assert.doesNotMatch(
    attributes,
    /\bsrc\s*=\s*['"]\/\//iu,
    'Protocol-relative scripts are forbidden.',
  );
}

const styleFiles = packageFiles.filter((file) => path.extname(file) === '.css');
for (const file of styleFiles) {
  const contents = await readFile(file, 'utf8');
  assert.doesNotMatch(
    contents,
    /@import/iu,
    'Production styles must not import external stylesheets.',
  );
  assert.doesNotMatch(
    contents,
    /url\(\s*['"]?(?:https?:)?\/\//iu,
    'Production styles must not load remote assets.',
  );
}

console.log(
  `Security audit passed: storage-only permission, Linux DO-only scope, reviewed window full-screen worker, ${String(sourceFiles.length)} runtime source files, ${String(packageFiles.length)} packaged files.`,
);

async function assertPackageEntry(entry) {
  assert.equal(typeof entry, 'string', 'Manifest runtime entries must be strings.');
  assert(!entry.includes('..'), `Manifest runtime entry must not traverse directories: ${entry}`);
  const resolved = path.join(outputRoot, entry.replace(/^\//u, ''));
  const entryStat = await stat(resolved);
  assert(entryStat.isFile(), `Manifest runtime entry is not a file: ${entry}`);
}

function matchingFiles(files, pattern) {
  return [...files]
    .filter(([, contents]) => pattern.test(contents))
    .map(([file]) => path.relative(projectRoot, file))
    .sort();
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
