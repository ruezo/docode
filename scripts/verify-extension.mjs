import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { chromium } from '@playwright/test';

const rootDir = path.resolve(import.meta.dirname, '..');
const extensionPath = path.join(rootDir, '.output/chrome-mv3');
const browserChannel = process.env.DOCODE_BROWSER_CHANNEL ?? 'chromium';
const supportedBrowserChannels = new Set(['chrome', 'chromium', 'msedge']);

assert(
  supportedBrowserChannels.has(browserChannel),
  `DOCODE_BROWSER_CHANNEL must be one of: ${Array.from(supportedBrowserChannels).join(', ')}`,
);

const evidenceDir = path.join(rootDir, 'test-results/m9-t03');
const nativeActionEvidenceDir = path.join(rootDir, 'test-results/m10-t01');
const nativeComposerEvidenceDir = path.join(rootDir, 'test-results/m10-t02');
const searchEvidenceDir = path.join(rootDir, 'test-results/m10-t03');
const actionHardeningEvidenceDir = path.join(rootDir, 'test-results/m10-t04');
const readingModeEvidenceDir = path.join(rootDir, 'test-results/m11-t01');
const contextActionEvidenceDir = path.join(rootDir, 'test-results/m11-t02');
const statusEvidenceDir = path.join(rootDir, 'test-results/m11-t03');
const keyboardEvidenceDir = path.join(rootDir, 'test-results/m12-t01');
const accessibilityEvidenceDir = path.join(rootDir, 'test-results/m12-t02');
const performanceEvidenceDir = path.join(rootDir, 'test-results/m12-t03');
const compatibilityEvidenceDir = path.join(rootDir, 'test-results/m12-t04');
const fidelityRefinementEvidenceDir = path.join(rootDir, 'test-results/m13-t02');
const topicFidelityEvidenceDir = path.join(rootDir, 'test-results/m13-t03');
const transientFidelityEvidenceDir = path.join(rootDir, 'test-results/m13-t04');
const fullWorkbenchEvidenceDir = path.join(rootDir, 'test-results/m15-t01');
const fidelityCorrectionEvidenceDir = path.join(rootDir, 'test-results/m16-t01');
const platformChromeEvidenceDir = path.join(rootDir, 'test-results/m17-t01');
const topicMinimapCorrectionEvidenceDir = path.join(rootDir, 'test-results/m18-t01');
const replySourceEvidenceDir = path.join(rootDir, 'test-results/m19-t01');
const activeLineCorrectionEvidenceDir = path.join(rootDir, 'test-results/m21-t01');
const titlebarLayoutEvidenceDir = path.join(rootDir, 'test-results/m24-t01');
const titlebarCommandCenterEvidenceDir = path.join(rootDir, 'test-results/m25-t01');
const fullChromeReferenceEvidenceDir = path.join(rootDir, 'test-results/m26-t01');
const sidebarContinuityEvidenceDir = path.join(rootDir, 'test-results/m32-t01');
const unreadCompatibilityEvidenceDir = path.join(rootDir, 'test-results/m35-t01');
const topicListPaginationEvidenceDir = path.join(rootDir, 'test-results/m36-t01');
const topicLineSelectionEvidenceDir = path.join(rootDir, 'test-results/m37-t01');
const topicPaginationEvidenceDir = path.join(rootDir, 'test-results/m38-t01');
const topicRouteReadinessEvidenceDir = path.join(rootDir, 'test-results/m39-t01');
const codeReadingEvidenceDir = path.join(rootDir, 'test-results/m40-t01');
const codeBlockEvidenceDir = path.join(rootDir, 'test-results/m41-t01');
const quickInputFidelityEvidenceDir = path.join(rootDir, 'test-results/m42-t01');
const quickInputUnderlayEvidenceDir = path.join(rootDir, 'test-results/m62-t01');
const topicPaginationEndEvidenceDir = path.join(rootDir, 'test-results/m43-t01');
const topicListReadinessEvidenceDir = path.join(rootDir, 'test-results/m44-t01');
const imageViewerEvidenceDir = path.join(rootDir, 'test-results/m45-t01');
const imageDirectManipulationEvidenceDir = path.join(rootDir, 'test-results/m52-t01');
const workbenchFullscreenEvidenceDir = path.join(rootDir, 'test-results/m57-t01');
const topicContinuationStabilityEvidenceDir = path.join(rootDir, 'test-results/m47-t01');
const replyTargetHoverEvidenceDir = path.join(rootDir, 'test-results/m48-t01');
const windowsTitlebarEvidenceDir = path.join(rootDir, 'test-results/m50-t01');
const explorerSetiIconEvidenceDir = path.join(rootDir, 'test-results/m51-t01');
const popupMiniWorkbenchEvidenceDir = path.join(rootDir, 'test-results/m59-t01');
const authorProfileHoverEvidenceDir = path.join(rootDir, 'test-results/m60-t01');
const appearanceSettingsEvidenceDir = path.join(rootDir, 'test-results/m63-t01');
const terminalTabCompletionEvidenceDir = path.join(rootDir, 'test-results/m64-t01');
const popupSimplificationEvidenceDir = path.join(rootDir, 'test-results/m65-t01');
const terminalSurfaceFocusEvidenceDir = path.join(rootDir, 'test-results/m66-t01');
const topicUnreadAnnotationEvidenceDir = path.join(rootDir, 'test-results/m76-t01');
const popupCompactLayoutEvidenceDir = path.join(rootDir, 'test-results/m68-t01');
const terminalPromptRemovalEvidenceDir = path.join(rootDir, 'test-results/m69-t01');
const likeStateTransitionEvidenceDir = path.join(rootDir, 'test-results/m70-t01');
const topicBackwardPaginationEvidenceDir = path.join(rootDir, 'test-results/m72-t01');
const popupCompactActionsEvidenceDir = path.join(rootDir, 'test-results/m73-t01');
const contentContextRecoveryEvidenceDir = path.join(rootDir, 'test-results/m74-t01');
const profileDir = await mkdtemp(path.join(tmpdir(), `docode-${browserChannel}-`));

await mkdir(evidenceDir, { recursive: true });
await mkdir(nativeActionEvidenceDir, { recursive: true });
await mkdir(nativeComposerEvidenceDir, { recursive: true });
await mkdir(searchEvidenceDir, { recursive: true });
await mkdir(actionHardeningEvidenceDir, { recursive: true });
await mkdir(readingModeEvidenceDir, { recursive: true });
await mkdir(contextActionEvidenceDir, { recursive: true });
await mkdir(statusEvidenceDir, { recursive: true });
await mkdir(keyboardEvidenceDir, { recursive: true });
await mkdir(accessibilityEvidenceDir, { recursive: true });
await mkdir(performanceEvidenceDir, { recursive: true });
await mkdir(compatibilityEvidenceDir, { recursive: true });
await mkdir(fidelityRefinementEvidenceDir, { recursive: true });
await mkdir(topicFidelityEvidenceDir, { recursive: true });
await mkdir(transientFidelityEvidenceDir, { recursive: true });
await mkdir(fullWorkbenchEvidenceDir, { recursive: true });
await mkdir(fidelityCorrectionEvidenceDir, { recursive: true });
await mkdir(platformChromeEvidenceDir, { recursive: true });
await mkdir(topicMinimapCorrectionEvidenceDir, { recursive: true });
await mkdir(replySourceEvidenceDir, { recursive: true });
await mkdir(activeLineCorrectionEvidenceDir, { recursive: true });
await mkdir(titlebarLayoutEvidenceDir, { recursive: true });
await mkdir(titlebarCommandCenterEvidenceDir, { recursive: true });
await mkdir(fullChromeReferenceEvidenceDir, { recursive: true });
await mkdir(sidebarContinuityEvidenceDir, { recursive: true });
await mkdir(unreadCompatibilityEvidenceDir, { recursive: true });
await mkdir(topicLineSelectionEvidenceDir, { recursive: true });
await mkdir(topicListPaginationEvidenceDir, { recursive: true });
await mkdir(topicPaginationEvidenceDir, { recursive: true });
await mkdir(topicRouteReadinessEvidenceDir, { recursive: true });
await mkdir(codeReadingEvidenceDir, { recursive: true });
await mkdir(codeBlockEvidenceDir, { recursive: true });
await mkdir(quickInputFidelityEvidenceDir, { recursive: true });
await mkdir(quickInputUnderlayEvidenceDir, { recursive: true });
await mkdir(topicPaginationEndEvidenceDir, { recursive: true });
await mkdir(topicListReadinessEvidenceDir, { recursive: true });
await mkdir(imageViewerEvidenceDir, { recursive: true });
await mkdir(imageDirectManipulationEvidenceDir, { recursive: true });
await mkdir(workbenchFullscreenEvidenceDir, { recursive: true });
await mkdir(topicContinuationStabilityEvidenceDir, { recursive: true });
await mkdir(replyTargetHoverEvidenceDir, { recursive: true });
await mkdir(windowsTitlebarEvidenceDir, { recursive: true });
await mkdir(explorerSetiIconEvidenceDir, { recursive: true });
await mkdir(popupMiniWorkbenchEvidenceDir, { recursive: true });
await mkdir(authorProfileHoverEvidenceDir, { recursive: true });
await mkdir(appearanceSettingsEvidenceDir, { recursive: true });
await mkdir(terminalTabCompletionEvidenceDir, { recursive: true });
await mkdir(popupSimplificationEvidenceDir, { recursive: true });
await mkdir(terminalSurfaceFocusEvidenceDir, { recursive: true });
await mkdir(topicUnreadAnnotationEvidenceDir, { recursive: true });
await mkdir(popupCompactLayoutEvidenceDir, { recursive: true });
await mkdir(terminalPromptRemovalEvidenceDir, { recursive: true });
await mkdir(likeStateTransitionEvidenceDir, { recursive: true });
await mkdir(topicBackwardPaginationEvidenceDir, { recursive: true });
await mkdir(popupCompactActionsEvidenceDir, { recursive: true });
await mkdir(contentContextRecoveryEvidenceDir, { recursive: true });

let context;

try {
  context = await chromium.launchPersistentContext(profileDir, {
    channel: browserChannel,
    colorScheme: 'dark',
    headless: true,
    ignoreDefaultArgs: ['--disable-extensions'],
    viewport: { width: 1280, height: 800 },
    args: ['--enable-unsafe-extension-debugging'],
  });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: 'https://linux.do',
  });

  const browser = context.browser();
  assert(browser, 'Browser connection is unavailable.');
  const browserSession = await browser.newBrowserCDPSession();
  const extension = await browserSession.send('Extensions.loadUnpacked', { path: extensionPath });
  assert.match(extension.id, /^[a-p]{32}$/u, 'Browser returned an invalid extension ID.');

  const popupErrors = [];
  const popupPage = await context.newPage();
  popupPage.on('pageerror', (error) => popupErrors.push(error.message));
  await popupPage.setViewportSize({ width: 330, height: 201 });
  await popupPage.goto(`chrome-extension://${extension.id}/popup.html`);

  const popupTitle = await popupPage.getByRole('heading', { name: 'DOCODE' }).textContent();
  assert.equal(popupTitle, 'DOCODE');
  assert.equal(await popupPage.getByText(/Open Community/u).count(), 0);
  assert.equal(await popupPage.getByText(/Browse Linux DO/u).count(), 0);
  assert.equal(await popupPage.getByText(/Command Palette/u).count(), 0);
  assert.equal(await popupPage.getByText(/Run commands/u).count(), 0);
  assert.equal(
    await popupPage.getByText('DOCode owns the current page runtime.', { exact: true }).count(),
    0,
  );
  await assertPopupText(popupPage, 'Open a LINUX DO tab to use DOCODE.');
  await assertThemeFoundation(popupPage);
  await popupPage
    .locator('.docode-popup')
    .evaluate((element) =>
      Promise.all(element.getAnimations().map((animation) => animation.finished)),
    );
  const popupGeometry = await readTargetSizes(popupPage, {
    activityBar: '.docode-popup__activity-bar',
    frame: '.docode-popup',
    statusBar: '.docode-popup__statusbar',
    titleBar: '.docode-popup__titlebar',
  });
  assert.deepEqual(popupGeometry.frame, { height: 201, width: 330 });
  assert.equal(popupGeometry.titleBar.height, 26);
  assert.equal(popupGeometry.activityBar.width, 30);
  assert.equal(popupGeometry.statusBar.height, 18);
  const popupFrameBorder = await popupPage.locator('.docode-popup').evaluate((element) => {
    const style = getComputedStyle(element);
    return [
      style.borderTopWidth,
      style.borderRightWidth,
      style.borderBottomWidth,
      style.borderLeftWidth,
    ];
  });
  assert.deepEqual(popupFrameBorder, ['0px', '0px', '0px', '0px']);
  const popupCompactLayout = await popupPage.locator('.docode-popup').evaluate((root) => {
    const header = root.querySelector('.docode-popup__header');
    const quickActionsTitle = root.querySelector('.docode-popup__quick-actions > h2');
    const actionList = root.querySelector('.docode-popup__action-list');
    const statusBarEnd = root.querySelector('.docode-popup__statusbar-end');
    if (
      !(header instanceof HTMLElement) ||
      !(quickActionsTitle instanceof HTMLElement) ||
      !(actionList instanceof HTMLElement) ||
      !(statusBarEnd instanceof HTMLElement)
    ) {
      throw new Error('Popup compact layout elements are unavailable.');
    }
    const rootStyle = getComputedStyle(root);
    return {
      actionRows: actionList.children.length,
      bodyBackground: getComputedStyle(document.body).backgroundColor,
      bottomLeftRadius: rootStyle.borderBottomLeftRadius,
      bottomRightRadius: rootStyle.borderBottomRightRadius,
      headerBottom: header.getBoundingClientRect().bottom,
      lowercaseBrandCount: (root.textContent?.match(/Linux DO/gu) ?? []).length,
      quickActionsTop: quickActionsTitle.getBoundingClientRect().top,
      statusBarEnd: statusBarEnd.textContent?.trim(),
    };
  });
  assert.equal(popupCompactLayout.bodyBackground, 'rgb(30, 30, 30)');
  assert.equal(popupCompactLayout.bottomLeftRadius, '0px');
  assert.equal(popupCompactLayout.bottomRightRadius, '0px');
  assert.equal(popupCompactLayout.actionRows, 3);
  assert.equal(popupCompactLayout.lowercaseBrandCount, 0);
  assert(popupCompactLayout.quickActionsTop >= popupCompactLayout.headerBottom);
  assert.equal(popupCompactLayout.statusBarEnd, 'LINUX DO');
  const popupPlatformChrome = await popupPage.locator('.docode-popup').evaluate((root) => {
    return {
      activityItems: root.querySelectorAll('.docode-popup__activity-item').length,
      discussionItems: root.querySelectorAll('.codicon-comment-discussion').length,
      platform: root.getAttribute('data-platform'),
      trafficLights: root.querySelectorAll('.docode-popup__traffic-light').length,
      windowsControls: root.querySelectorAll('.docode-popup__window-controls > .docode-codicon')
        .length,
    };
  });
  assert.equal(popupPlatformChrome.activityItems, 4);
  assert.equal(popupPlatformChrome.discussionItems, 0);
  if (popupPlatformChrome.platform === 'mac') {
    assert.equal(popupPlatformChrome.trafficLights, 3);
    assert.equal(popupPlatformChrome.windowsControls, 0);
  } else if (popupPlatformChrome.platform === 'windows') {
    assert.equal(popupPlatformChrome.trafficLights, 0);
    assert.equal(popupPlatformChrome.windowsControls, 3);
  } else {
    assert.equal(popupPlatformChrome.trafficLights, 0);
    assert.equal(popupPlatformChrome.windowsControls, 0);
  }
  await popupPage.screenshot({ path: path.join(evidenceDir, 'popup-unsupported.png') });
  await popupPage.screenshot({
    path: path.join(popupMiniWorkbenchEvidenceDir, 'popup-unsupported.png'),
  });
  await popupPage.screenshot({
    path: path.join(popupSimplificationEvidenceDir, 'popup-unsupported.png'),
  });
  await popupPage.screenshot({
    path: path.join(popupCompactLayoutEvidenceDir, 'popup-unsupported.png'),
  });
  await popupPage.screenshot({
    path: path.join(popupCompactActionsEvidenceDir, 'popup-unsupported.png'),
  });

  const topicListFixtureUrl = 'https://linux.do/latest?docode_fixture=1';
  const unreadTopicListFixtureUrl = 'https://linux.do/unread?docode_fixture=1';
  const delayedUnreadTopicListFixtureUrl = 'https://linux.do/unread?docode_list_readiness=1';
  const missingUnreadTopicListFixtureUrl = 'https://linux.do/unread?docode_list_error=1';
  const topicListPaginationFixtureUrl = 'https://linux.do/latest?docode_pagination=1';
  const topicPaginationFixtureUrl =
    'https://linux.do/t/synthetic-pagination/88?docode_pagination=1';
  const topicPaginationEndFixtureUrl =
    'https://linux.do/t/synthetic-pagination-end/89?docode_pagination_end=1';
  const topicBackwardPaginationFixtureUrl =
    'https://linux.do/t/synthetic-previous/90?docode_previous=1';
  const topicOpeningFixtureUrl = 'https://linux.do/t/synthetic-topic-1/42';
  const codeBlockFixtureUrl = 'https://linux.do/t/synthetic-topic-1/42?docode_code_blocks=1';
  const replyTargetHoverFixtureUrl =
    'https://linux.do/t/synthetic-reply-target/48?docode_reply_target=1';
  let topicListPaginationRequestCount = 0;
  let topicPaginationRequestCount = 0;
  let topicPaginationEndRequestCount = 0;
  let topicBackwardPaginationRequestCount = 0;
  await context.route(topicListFixtureUrl, (route) =>
    route.fulfill({
      body: topicListFixtureHtml(),
      contentType: 'text/html',
      status: 200,
    }),
  );
  await context.route('https://linux.do/latest', (route) =>
    route.fulfill({
      body: topicListFixtureHtml(),
      contentType: 'text/html',
      status: 200,
    }),
  );
  await context.route('https://linux.do/notifications.json*', (route) =>
    route.fulfill({
      body: JSON.stringify({
        notifications: [
          {
            data: { display_username: 'fixture-author', topic_title: 'Synthetic reply' },
            id: 501,
            notification_type: 2,
            post_number: 2,
            read: false,
            slug: 'synthetic-topic',
            topic_id: 42,
          },
          {
            data: { display_username: 'fixture-author', topic_title: 'Synthetic like' },
            id: 502,
            notification_type: 5,
            read: true,
            slug: 'synthetic-topic',
            topic_id: 42,
          },
        ],
      }),
      contentType: 'application/json',
      status: 200,
    }),
  );
  await context.route('https://linux.do/new', (route) =>
    route.fulfill({
      body: topicListFixtureHtml(),
      contentType: 'text/html',
      status: 200,
    }),
  );
  await context.route('https://linux.do/categories.json', (route) =>
    route.fulfill({
      body: JSON.stringify({
        category_list: {
          categories: [
            {
              color: '0088CC',
              description_text: '开发调优相关讨论',
              id: 4,
              name: '开发调优',
              slug: 'develop',
              topic_count: 128,
            },
            { color: 'AA33CC', id: 14, name: '资源荟萃', slug: 'resource', topic_count: 52 },
            { color: '12A89D', id: 32, name: '前沿快讯', slug: 'news', topic_count: 7 },
            {
              color: 'FFFFFF',
              id: 40,
              name: 'Nested child',
              parent_category_id: 4,
              slug: 'child',
              topic_count: 3,
            },
          ],
        },
      }),
      contentType: 'application/json',
      status: 200,
    }),
  );
  await context.route('https://linux.do/tags.json', (route) =>
    route.fulfill({
      body: JSON.stringify({
        tags: [
          { count: 90, id: 'ai', text: 'ai' },
          { count: 80, id: '福利', text: '福利' },
          ...Array.from({ length: 12 }, (unused, index) => ({
            count: 70 - index,
            id: `fixture-tag-${String(index + 1)}`,
            text: `fixture-tag-${String(index + 1)}`,
          })),
        ],
      }),
      contentType: 'application/json',
      status: 200,
    }),
  );
  await context.route(unreadTopicListFixtureUrl, (route) =>
    route.fulfill({
      body: topicListFixtureHtml({ firstUnreadPostNumber: 4 }),
      contentType: 'text/html',
      status: 200,
    }),
  );
  await context.route(delayedUnreadTopicListFixtureUrl, (route) =>
    route.fulfill({
      body: delayedTopicListFixtureHtml(),
      contentType: 'text/html',
      status: 200,
    }),
  );
  await context.route(missingUnreadTopicListFixtureUrl, (route) =>
    route.fulfill({
      body: '<!doctype html><html><body><main id="main-outlet"></main></body></html>',
      contentType: 'text/html',
      status: 200,
    }),
  );
  await context.route(topicListPaginationFixtureUrl, (route) =>
    route.fulfill({
      body: topicListFixtureHtml(),
      contentType: 'text/html',
      status: 200,
    }),
  );
  await context.route('https://linux.do/latest.json?docode_pagination=1', (route) => {
    topicListPaginationRequestCount += 1;
    return route.fulfill({
      body: JSON.stringify(
        topicListFixturePayload(36, {
          moreTopicsUrl: '/latest?docode_pagination=1&page=1',
        }),
      ),
      contentType: 'application/json',
      status: 200,
    });
  });
  await context.route('https://linux.do/latest?docode_pagination=1&page=1', (route) => {
    topicListPaginationRequestCount += 1;
    return route.fulfill({
      body: JSON.stringify(topicListFixturePayload(2, { startOrdinal: 37 })),
      contentType: 'application/json',
      status: 200,
    });
  });
  await context.route('https://linux.do/latest.json', (route) =>
    route.fulfill({
      body: JSON.stringify(topicListFixturePayload(36)),
      contentType: 'application/json',
      status: 200,
    }),
  );
  await context.route(topicPaginationFixtureUrl, (route) =>
    route.fulfill({
      body: topicPaginationFixtureHtml(),
      contentType: 'text/html',
      status: 200,
    }),
  );
  await context.route('https://linux.do/t/synthetic-pagination/88.json', (route) => {
    topicPaginationRequestCount += 1;
    return route.fulfill({
      body: JSON.stringify({
        post_stream: {
          posts: [topicPaginationPostPayload(8_800, 1)],
          stream: [8_800, 8_801],
        },
      }),
      contentType: 'application/json',
      status: 200,
    });
  });
  await context.route('https://linux.do/t/88/posts.json*', async (route) => {
    topicPaginationRequestCount += 1;
    await new Promise((resolve) => setTimeout(resolve, 600));
    return route.fulfill({
      body: JSON.stringify({
        post_stream: { posts: [topicPaginationPostPayload(8_801, 2)] },
      }),
      contentType: 'application/json',
      status: 200,
    });
  });
  await context.route(topicPaginationEndFixtureUrl, (route) =>
    route.fulfill({
      body: topicPaginationEndFixtureHtml(),
      contentType: 'text/html',
      status: 200,
    }),
  );
  await context.route('https://linux.do/t/synthetic-pagination-end/89.json', (route) => {
    topicPaginationEndRequestCount += 1;
    return route.fulfill({
      body: JSON.stringify({
        post_stream: {
          posts: Array.from({ length: 12 }, (_, index) =>
            topicPaginationEndPostPayload(8_900 + index, index + 1),
          ),
          stream: Array.from({ length: 93 }, (_, index) => 8_900 + index),
        },
      }),
      contentType: 'application/json',
      status: 200,
    });
  });
  await context.route('https://linux.do/t/89/posts.json*', async (route) => {
    topicPaginationEndRequestCount += 1;
    await new Promise((resolve) => setTimeout(resolve, 120));
    return route.fulfill({
      body: JSON.stringify({
        post_stream: { posts: [topicPaginationEndPostPayload(8_900, 1)] },
      }),
      contentType: 'application/json',
      status: 200,
    });
  });
  await context.route(topicBackwardPaginationFixtureUrl, (route) =>
    route.fulfill({
      body: topicBackwardPaginationFixtureHtml(),
      contentType: 'text/html',
      status: 200,
    }),
  );
  await context.route('https://linux.do/t/synthetic-previous/90.json', (route) => {
    topicBackwardPaginationRequestCount += 1;
    return route.fulfill({
      body: JSON.stringify({
        post_stream: {
          posts: Array.from({ length: 31 }, (_, index) =>
            topicBackwardPaginationPostPayload(9_017 + index, 18 + index),
          ),
          stream: Array.from({ length: 48 }, (_, index) => 9_000 + index),
        },
      }),
      contentType: 'application/json',
      status: 200,
    });
  });
  await context.route('https://linux.do/t/90/posts.json*', async (route) => {
    topicBackwardPaginationRequestCount += 1;
    await new Promise((resolve) => setTimeout(resolve, 600));
    const requestedPostIds = new URL(route.request().url()).searchParams
      .getAll('post_ids[]')
      .map(Number)
      .filter(Number.isFinite);
    return route.fulfill({
      body: JSON.stringify({
        post_stream: {
          posts: requestedPostIds.map((postId) =>
            topicBackwardPaginationPostPayload(postId, postId - 8_999),
          ),
        },
      }),
      contentType: 'application/json',
      status: 200,
    });
  });
  await context.route('https://linux.do/uploads/fixture-favicon.png', (route) =>
    route.fulfill({
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        'base64',
      ),
      contentType: 'image/png',
      status: 200,
    }),
  );
  await context.route(topicOpeningFixtureUrl, (route) =>
    route.fulfill({
      body: topicFixtureHtml(),
      contentType: 'text/html',
      status: 200,
    }),
  );
  await context.route('https://linux.do/t/synthetic-topic/42.json', (route) =>
    route.fulfill({
      body: JSON.stringify({
        post_stream: {
          posts: [topicFixturePostPayload(100, 1), topicFixturePostPayload(101, 2)],
          stream: [100, 101],
        },
      }),
      contentType: 'application/json',
      status: 200,
    }),
  );
  await context.route(codeBlockFixtureUrl, (route) =>
    route.fulfill({
      body: codeBlockTopicFixtureHtml(),
      contentType: 'text/html',
      status: 200,
    }),
  );
  await context.route(replyTargetHoverFixtureUrl, (route) =>
    route.fulfill({
      body: replyTargetHoverFixtureHtml(),
      contentType: 'text/html',
      status: 200,
    }),
  );
  await context.route('https://linux.do/t/synthetic-reply-target/48.json', (route) =>
    route.fulfill({
      body: JSON.stringify(replyTargetHoverFixturePayload()),
      contentType: 'application/json',
      status: 200,
    }),
  );
  await context.route('https://linux.do/u/source-user/card.json', (route) =>
    route.fulfill({
      body: JSON.stringify({
        user: {
          avatar_template: '/user_avatar/linux.do/source-user/{size}/1.png',
          bio_excerpt:
            '<script>unsafe()</script><p>Builds <strong>Linux DO browser tools</strong>.</p>',
          created_at: '2024-01-07T12:00:00.000Z',
          featured_user_badges: [
            { description: 'First public link', name: 'First Link' },
            { description: 'Trust level badge', name: 'Regular' },
          ],
          location: 'Earth',
          name: 'Source User',
          time_read: 86_400,
          title: 'Builder',
          topic_post_count: 5,
          trust_level: 2,
          username: 'source-user',
          website: 'https://example.com/portfolio',
        },
      }),
      contentType: 'application/json',
      status: 200,
    }),
  );
  await context.route('https://linux.do/user_avatar/linux.do/source-user/**', (route) =>
    route.fulfill({
      body: `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="48" fill="#007acc"/><path d="M29 27h22c12 0 21 8 21 21S63 69 51 69H29V27Zm14 11v20h7c6 0 10-4 10-10s-4-10-10-10h-7Z" fill="#fff"/></svg>`,
      contentType: 'image/svg+xml',
      status: 200,
    }),
  );
  const userFixtureUrl = 'https://linux.do/u/fixture-user/activity/topics';
  await context.route(userFixtureUrl, (route) =>
    route.fulfill({ body: topicListFixtureHtml(), contentType: 'text/html', status: 200 }),
  );
  const searchApiPattern = 'https://linux.do/search/query?*';
  const searchApiRequests = [];
  const searchApiHandler = async (route) => {
    const url = new URL(route.request().url());
    const query = url.searchParams.get('term') ?? '';
    searchApiRequests.push({
      accept: route.request().headers().accept ?? '',
      method: route.request().method(),
      query,
      url: url.href,
    });
    if (query === 'fail') {
      await route.fulfill({
        body: JSON.stringify({ message: 'Synthetic Linux DO rate limit.' }),
        contentType: 'application/json',
        status: 429,
      });
      return;
    }
    await route.fulfill({
      body: JSON.stringify(query === 'no-results' ? {} : searchFixturePayload(query)),
      contentType: 'application/json',
      status: 200,
    });
  };
  await context.route(searchApiPattern, searchApiHandler);
  const topicListFixturePage = await context.newPage();
  await observeTransientWorkbenchErrors(topicListFixturePage);
  await topicListFixturePage.goto(topicListFixtureUrl, { waitUntil: 'domcontentloaded' });
  await assertRuntimeOwnership(topicListFixturePage, true);
  await topicListFixturePage.getByRole('list', { name: 'Topic list document' }).waitFor();
  await topicListFixturePage.evaluate(() => document.fonts.ready);
  assert.deepEqual(await readTransientWorkbenchErrors(topicListFixturePage), []);
  const explorerRouteFiles = await topicListFixturePage
    .locator(
      '.docode-workbench__explorer-list[aria-label="Linux DO list routes"] [role="treeitem"]',
    )
    .evaluateAll((rows) =>
      rows.map((row) => {
        const icon = row.querySelector('[data-file-extension]');
        const label = row.querySelector('.docode-workbench__explorer-label');
        if (!(icon instanceof HTMLElement) || !(label instanceof HTMLElement)) {
          throw new Error('Explorer route file is missing its typed icon or label.');
        }
        const iconRect = icon.getBoundingClientRect();
        const iconStyle = getComputedStyle(icon);
        return {
          accessibleName: row.getAttribute('aria-label'),
          color: iconStyle.color,
          extension: icon.dataset.fileExtension,
          iconClass: Array.from(icon.classList).at(-1),
          iconHeight: iconRect.height,
          iconWidth: iconRect.width,
          label: label.textContent?.trim(),
          setiId: icon.dataset.setiIcon,
          text: icon.textContent,
          fontFamily: iconStyle.fontFamily,
          fontSize: iconStyle.fontSize,
        };
      }),
    );
  assert.deepEqual(explorerRouteFiles, [
    {
      accessibleName: 'latest',
      color: 'rgb(81, 154, 186)',
      extension: 'c',
      iconClass: 'docode-workbench__file-icon--c',
      iconHeight: 22,
      iconWidth: 16,
      label: 'latest.c',
      setiId: '_c',
      text: '\uE00C',
      fontFamily: 'docode-seti, sans-serif',
      fontSize: '19.5px',
    },
    {
      accessibleName: 'unread',
      color: 'rgb(204, 62, 68)',
      extension: 'java',
      iconClass: 'docode-workbench__file-icon--java',
      iconHeight: 22,
      iconWidth: 16,
      label: 'unread.java',
      setiId: '_java',
      text: '\uE050',
      fontFamily: 'docode-seti, sans-serif',
      fontSize: '19.5px',
    },
    {
      accessibleName: 'new',
      color: 'rgb(81, 154, 186)',
      extension: 'cpp',
      iconClass: 'docode-workbench__file-icon--cpp',
      iconHeight: 22,
      iconWidth: 16,
      label: 'new.cpp',
      setiId: '_cpp',
      text: '\uE01A',
      fontFamily: 'docode-seti, sans-serif',
      fontSize: '19.5px',
    },
    {
      accessibleName: 'top',
      color: 'rgb(81, 154, 186)',
      extension: 'dart',
      iconClass: 'docode-workbench__file-icon--dart',
      iconHeight: 22,
      iconWidth: 16,
      label: 'top.dart',
      setiId: '_dart',
      text: '\uE021',
      fontFamily: 'docode-seti, sans-serif',
      fontSize: '19.5px',
    },
    {
      accessibleName: 'hot',
      color: 'rgb(81, 154, 186)',
      extension: 'md',
      iconClass: 'docode-workbench__file-icon--md',
      iconHeight: 22,
      iconWidth: 16,
      label: 'hot.md',
      setiId: '_markdown',
      text: '\uE060',
      fontFamily: 'docode-seti, sans-serif',
      fontSize: '19.5px',
    },
  ]);
  const activeExplorerFile = topicListFixturePage.locator(
    '.docode-workbench__explorer-row--route[data-active="true"]',
  );
  assert.equal(await activeExplorerFile.getAttribute('aria-label'), 'latest');
  await topicListFixturePage.screenshot({
    path: path.join(explorerSetiIconEvidenceDir, 'explorer-seti-file-icons.png'),
  });
  await topicListFixturePage
    .locator('[aria-label="Linux DO categories"] [role="treeitem"]')
    .first()
    .waitFor();
  const explorerCategoryRows = await topicListFixturePage
    .locator('[aria-label="Linux DO categories"] [role="treeitem"]')
    .evaluateAll((rows) =>
      rows.map((row) => {
        const icon = row.querySelector('[data-file-extension]');
        const label = row.querySelector('.docode-workbench__explorer-label');
        if (!(icon instanceof HTMLElement) || !(label instanceof HTMLElement)) {
          throw new Error('Explorer category row is missing its typed icon or label.');
        }
        return {
          accessibleName: row.getAttribute('aria-label'),
          count:
            row.querySelector('.docode-workbench__explorer-category-count')?.textContent ?? null,
          extension: icon.dataset.fileExtension,
          iconColor: getComputedStyle(icon).color,
          iconFont: getComputedStyle(icon).fontFamily,
          label: label.textContent?.trim(),
          setiId: icon.dataset.setiIcon,
          title: row.getAttribute('title'),
          tooltip: row.getAttribute('data-docode-tooltip'),
        };
      }),
    );
  assert.deepEqual(explorerCategoryRows, [
    {
      accessibleName: '开发调优',
      count: '128',
      extension: 'png',
      iconColor: 'rgb(160, 116, 196)',
      iconFont: 'docode-seti, sans-serif',
      label: 'develop.png',
      setiId: '_image',
      title: null,
      tooltip: '开发调优 — 开发调优相关讨论',
    },
    {
      accessibleName: '资源荟萃',
      count: '52',
      extension: 'csv',
      iconColor: 'rgb(141, 193, 73)',
      iconFont: 'docode-seti, sans-serif',
      label: 'resource.csv',
      setiId: '_csv',
      title: null,
      tooltip: '资源荟萃',
    },
    {
      accessibleName: '前沿快讯',
      count: '7',
      extension: 'txt',
      iconColor: 'rgb(212, 215, 214)',
      iconFont: 'docode-seti, sans-serif',
      label: 'news.txt',
      setiId: '_default',
      title: null,
      tooltip: '前沿快讯',
    },
  ]);
  await topicListFixturePage.screenshot({
    path: path.join(explorerSetiIconEvidenceDir, 'explorer-category-lists.png'),
  });

  await topicListFixturePage.getByRole('button', { name: 'Filter topics by tag' }).click();
  const tagPicker = topicListFixturePage.getByRole('dialog', { name: 'Filter by Tag' });
  await tagPicker.waitFor();
  await tagPicker.getByRole('option', { name: /View all tags/u }).waitFor();
  assert.equal(await tagPicker.getByRole('option').count(), 13);
  assert.deepEqual((await tagPicker.getByRole('option').allTextContents()).slice(0, 2), [
    'ai90 topics',
    '福利80 topics',
  ]);
  await topicListFixturePage.screenshot({
    path: path.join(explorerSetiIconEvidenceDir, 'tag-quick-pick-featured.png'),
  });
  await tagPicker.getByRole('option', { name: /View all tags/u }).click();
  await topicListFixturePage.waitForFunction(
    () => document.querySelectorAll('.docode-quick-open__item').length === 14,
  );
  await tagPicker.getByRole('combobox', { name: 'Filter Linux DO tags' }).fill('fixture-tag-12');
  await topicListFixturePage.waitForFunction(
    () => document.querySelectorAll('.docode-quick-open__item').length === 1,
  );
  assert.deepEqual(await tagPicker.getByRole('option').allTextContents(), [
    'fixture-tag-1259 topics',
  ]);
  await topicListFixturePage.keyboard.press('Escape');
  await tagPicker.waitFor({ state: 'detached' });

  await topicListFixturePage.getByRole('button', { name: 'Source Control Browse History' }).click();
  await topicListFixturePage.getByRole('heading', { name: 'SOURCE CONTROL' }).waitFor();
  const activeHistoryRow = topicListFixturePage.locator(
    '.docode-workbench__history-row[data-active="true"]',
  );
  await activeHistoryRow.waitFor();
  assert.match((await activeHistoryRow.textContent()) ?? '', /Latest topics/u);
  assert.equal(await activeHistoryRow.locator('.docode-workbench__history-dot').count(), 1);
  assert.equal(
    await activeHistoryRow.locator('.docode-workbench__history-main').getAttribute('aria-current'),
    'page',
  );
  await topicListFixturePage.screenshot({
    path: path.join(explorerSetiIconEvidenceDir, 'browse-history-graph.png'),
  });
  await topicListFixturePage.getByRole('button', { name: 'Clear Browse History' }).click();
  await topicListFixturePage.getByText(/No browse history yet/u).waitFor();
  await topicListFixturePage.getByRole('button', { name: 'Explorer' }).click();
  await topicListFixturePage.getByRole('heading', { name: 'DOCODE' }).waitFor();
  const appearanceSettingsPage = await context.newPage();
  await observeTransientWorkbenchErrors(appearanceSettingsPage);
  await appearanceSettingsPage.goto(topicListFixtureUrl, { waitUntil: 'domcontentloaded' });
  await assertRuntimeOwnership(appearanceSettingsPage, true);
  await appearanceSettingsPage.getByRole('list', { name: 'Topic list document' }).waitFor();
  await appearanceSettingsPage.getByRole('button', { name: 'Settings', exact: true }).click();
  await appearanceSettingsPage.getByRole('heading', { level: 1, name: 'Settings' }).waitFor();
  assert.equal(await appearanceSettingsPage.locator('.docode-settings__row').count(), 6);
  assert.equal(
    await appearanceSettingsPage
      .getByRole('spinbutton', { name: 'Browse History Limit' })
      .inputValue(),
    '100',
  );
  assert.equal(
    await appearanceSettingsPage
      .getByRole('combobox', { name: 'DOCode Appearance Color Theme' })
      .textContent(),
    'System Default',
  );
  assert.equal(
    await appearanceSettingsPage
      .getByRole('checkbox', { name: 'Show author avatars in topic details' })
      .isChecked(),
    true,
  );
  assert.equal(
    await appearanceSettingsPage
      .getByRole('textbox', { name: 'Command Center Label' })
      .inputValue(),
    'DOCode',
  );
  const settingsDarkBackground = await appearanceSettingsPage
    .locator('.docode-settings')
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  assert.equal(settingsDarkBackground, 'rgb(30, 30, 30)');
  await appearanceSettingsPage.screenshot({
    path: path.join(appearanceSettingsEvidenceDir, 'settings-dark-modern.png'),
  });

  await appearanceSettingsPage
    .getByRole('combobox', { name: 'DOCode Appearance Color Theme' })
    .click();
  assert.deepEqual(await appearanceSettingsPage.getByRole('option').allTextContents(), [
    'System DefaultDefault',
    'Dark Modern',
    'Light Modern',
  ]);
  const themeDropdownGeometry = await appearanceSettingsPage
    .locator('.docode-settings__select-trigger')
    .evaluate((element) => {
      const icon = element.querySelector('.docode-codicon');
      if (!icon) return null;
      const triggerBox = element.getBoundingClientRect();
      const iconBox = icon.getBoundingClientRect();
      return { gap: Math.round(triggerBox.right - iconBox.right) };
    });
  assert.equal(themeDropdownGeometry?.gap, 9);
  await appearanceSettingsPage.getByRole('option', { name: 'Light Modern' }).click();
  await appearanceSettingsPage.locator('.docode-workbench[data-color-theme="light"]').waitFor();
  assert.equal(await appearanceSettingsPage.getByRole('option').count(), 0);
  const settingsLightBackground = await appearanceSettingsPage
    .locator('.docode-settings')
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  assert.equal(settingsLightBackground, 'rgb(255, 255, 255)');
  await appearanceSettingsPage.screenshot({
    path: path.join(appearanceSettingsEvidenceDir, 'settings-light-modern.png'),
  });

  await appearanceSettingsPage
    .getByRole('textbox', { exact: true, name: 'Topic List Body Color' })
    .fill('#123456');
  await appearanceSettingsPage
    .getByRole('textbox', { exact: true, name: 'Topic Detail Body Color' })
    .fill('#654321');
  await appearanceSettingsPage
    .locator('.docode-settings__checkbox-label')
    .filter({ hasText: 'Show author avatars in topic details' })
    .click();
  const commandCenterLabelInput = appearanceSettingsPage.getByRole('textbox', {
    name: 'Command Center Label',
  });
  await commandCenterLabelInput.fill('Linux DO Workspace');
  await commandCenterLabelInput.press('Enter');
  await appearanceSettingsPage.waitForFunction(
    () =>
      document
        .querySelector('.docode-workbench')
        ?.getAttribute('data-appearance-storage-pending') === 'false',
  );
  assert.equal(
    await appearanceSettingsPage.locator('.docode-settings__row[data-modified="true"]').count(),
    5,
  );
  assert.equal(
    await appearanceSettingsPage.locator('.docode-workbench__command-center span').textContent(),
    'Linux DO Workspace',
  );
  assert.deepEqual(
    await appearanceSettingsPage.locator('.docode-workbench').evaluate((element) => ({
      detailColor: element.style.getPropertyValue('--docode-color-topic-detail-body'),
      listColor: element.style.getPropertyValue('--docode-color-topic-list-body'),
    })),
    { detailColor: '#654321', listColor: '#123456' },
  );
  await appearanceSettingsPage.screenshot({
    path: path.join(appearanceSettingsEvidenceDir, 'settings-customized.png'),
  });

  await appearanceSettingsPage.getByRole('button', { name: 'Close Settings' }).click();
  assert.equal(
    await appearanceSettingsPage
      .locator('.docode-topic-list__definition-link')
      .first()
      .evaluate((element) => getComputedStyle(element).color),
    'rgb(18, 52, 86)',
  );
  await appearanceSettingsPage.goto(topicOpeningFixtureUrl, { waitUntil: 'domcontentloaded' });
  await appearanceSettingsPage.getByRole('document', { name: 'Topic code document' }).waitFor();
  assert.equal(
    await appearanceSettingsPage.locator('.docode-topic-code__author-avatar').count(),
    0,
  );
  assert.equal(
    await appearanceSettingsPage
      .locator('.docode-topic-code__content-slot > .cooked')
      .first()
      .evaluate((element) => getComputedStyle(element).color),
    'rgb(101, 67, 33)',
  );

  await appearanceSettingsPage.getByRole('button', { name: 'Settings', exact: true }).click();
  await appearanceSettingsPage.getByRole('heading', { level: 1, name: 'Settings' }).waitFor();
  for (const setting of [
    'DOCode › Appearance: Color Theme',
    'DOCode › Editor: Topic List Body Color',
    'DOCode › Editor: Topic Detail Body Color',
    'DOCode › Editor: Show Topic Avatars',
    'DOCode › Workbench: Command Center Label',
  ]) {
    await appearanceSettingsPage
      .getByRole('button', { name: `Reset ${setting}`, exact: true })
      .click();
  }
  await appearanceSettingsPage.waitForFunction(
    () =>
      document
        .querySelector('.docode-workbench')
        ?.getAttribute('data-appearance-storage-pending') === 'false',
  );
  assert.equal(
    await appearanceSettingsPage.locator('.docode-settings__row[data-modified="true"]').count(),
    0,
  );
  assert.deepEqual(await readTransientWorkbenchErrors(appearanceSettingsPage), []);
  await appearanceSettingsPage.close();
  const appearanceSettingsState = {
    controls: [
      'system, dark, and light themes',
      'topic list body color',
      'topic detail body color',
      'topic avatars',
      'Command Center label',
    ],
    screenshots: [
      'settings-dark-modern.png',
      'settings-light-modern.png',
      'settings-customized.png',
    ].map((name) => path.relative(rootDir, path.join(appearanceSettingsEvidenceDir, name))),
    states: ['default system/dark', 'Light Modern', 'customized', 'reset'],
  };
  const windowsAutoChromePage = await context.newPage();
  const windowsAutoPlatformSession = await emulateWindowsNavigator(windowsAutoChromePage);
  await windowsAutoChromePage.setViewportSize({ width: 1280, height: 800 });
  await windowsAutoChromePage.goto(topicListFixtureUrl, { waitUntil: 'domcontentloaded' });
  await assertRuntimeOwnership(windowsAutoChromePage, true);
  assert.equal(await windowsAutoChromePage.evaluate(() => navigator.platform), 'Win32');
  assert.equal(
    await windowsAutoChromePage
      .locator('.docode-workbench__titlebar')
      .getAttribute('data-platform'),
    'windows',
  );
  assert.equal(
    await windowsAutoChromePage.locator('.docode-workbench__menubar-item:visible').count(),
    8,
  );
  assert.equal(
    await windowsAutoChromePage.locator('.docode-workbench__traffic-light:visible').count(),
    0,
  );
  assert.equal(
    await windowsAutoChromePage
      .locator('.docode-workbench__window-controls button, .docode-workbench__window-controls a')
      .count(),
    1,
  );
  assert.equal(
    await windowsAutoChromePage
      .getByRole('button', { name: 'Enter Full Screen' })
      .evaluate((control) => control.classList.contains('docode-workbench__window-control')),
    true,
  );
  const m50WindowsDesktopControls = await readWindowsControlFidelity(windowsAutoChromePage);
  assert.deepEqual(m50WindowsDesktopControls, {
    containerHeight: 35,
    containerWidth: 138,
    controlHeights: [35, 35, 35],
    controlWidths: [46, 46, 46],
    iconClasses: ['codicon-chrome-minimize', 'codicon-chrome-maximize', 'codicon-chrome-close'],
    iconSizes: [16, 16, 16],
    rightGap: 0,
  });
  await windowsAutoChromePage.screenshot({
    path: path.join(windowsTitlebarEvidenceDir, 'workbench-windows.png'),
  });
  const m50WindowsCloseControl = windowsAutoChromePage.locator(
    '.docode-workbench__window-control--close',
  );
  await m50WindowsCloseControl.hover();
  assert.equal(
    await m50WindowsCloseControl.evaluate((control) => getComputedStyle(control).backgroundColor),
    'rgba(232, 17, 35, 0.9)',
  );
  assert.equal(
    await m50WindowsCloseControl.evaluate((control) => getComputedStyle(control).color),
    'rgb(255, 255, 255)',
  );
  await windowsAutoChromePage.screenshot({
    path: path.join(windowsTitlebarEvidenceDir, 'workbench-windows-close-hover.png'),
  });
  await windowsAutoChromePage.mouse.move(0, 200);
  await windowsAutoChromePage.setViewportSize({ width: 420, height: 640 });
  assert.equal(
    await windowsAutoChromePage.locator('.docode-workbench__menubar-item:visible').count(),
    0,
  );
  const m50WindowsNarrowControls = await readWindowsControlFidelity(windowsAutoChromePage);
  assert.deepEqual(m50WindowsNarrowControls, m50WindowsDesktopControls);
  assert.equal((await readTitlebarFidelity(windowsAutoChromePage)).commandCenterWidth > 0, true);
  await windowsAutoChromePage.screenshot({
    path: path.join(windowsTitlebarEvidenceDir, 'workbench-windows-narrow.png'),
  });
  await windowsAutoPlatformSession.detach();
  await windowsAutoChromePage.close();
  await topicListFixturePage.bringToFront();
  await popupPage.reload();
  assert.equal(
    await popupPage.getByText('DOCode owns the current page runtime.', { exact: true }).count(),
    0,
  );
  const topicListFixtureStatus = await readContentStatus(popupPage);
  assert.deepEqual(topicListFixtureStatus?.ok ? topicListFixtureStatus.status.topicList : null, {
    errorCode: null,
    issueCodes: [],
    partialTopicCount: 0,
    state: 'ready',
    topicCount: 36,
  });
  const delayedTopicListPage = await context.newPage();
  await observeTransientWorkbenchErrors(delayedTopicListPage);
  await delayedTopicListPage.goto(delayedUnreadTopicListFixtureUrl, {
    waitUntil: 'domcontentloaded',
  });
  await assertRuntimeOwnership(delayedTopicListPage, true);
  await assertWorkbenchLoading(delayedTopicListPage, 'Loading topics…');
  assert.deepEqual(await readTransientWorkbenchErrors(delayedTopicListPage), []);
  await delayedTopicListPage.screenshot({
    path: path.join(topicListReadinessEvidenceDir, 'unread-route-loading.png'),
  });
  await delayedTopicListPage.getByRole('list', { name: 'Topic list document' }).waitFor();
  assert.equal(await delayedTopicListPage.locator('.docode-topic-list__entry').count(), 3);
  assert.deepEqual(await readTransientWorkbenchErrors(delayedTopicListPage), []);
  await delayedTopicListPage.screenshot({
    path: path.join(topicListReadinessEvidenceDir, 'unread-route-ready.png'),
  });
  await delayedTopicListPage.close();
  const missingTopicListPage = await context.newPage();
  await observeTransientWorkbenchErrors(missingTopicListPage);
  await missingTopicListPage.goto(missingUnreadTopicListFixtureUrl, {
    waitUntil: 'domcontentloaded',
  });
  await assertRuntimeOwnership(missingTopicListPage, true);
  await assertWorkbenchLoading(missingTopicListPage, 'Loading topics…');
  await assertWorkbenchState(missingTopicListPage, 'error', 'Unable to read topics');
  assert.deepEqual(await readTransientWorkbenchErrors(missingTopicListPage), [
    'Unable to read topics',
  ]);
  await missingTopicListPage.screenshot({
    path: path.join(topicListReadinessEvidenceDir, 'unread-route-bounded-error.png'),
  });
  await missingTopicListPage.close();
  const delayedTopicPage = await context.newPage();
  await observeTransientWorkbenchErrors(delayedTopicPage);
  await delayedTopicPage.goto(topicListFixtureUrl, { waitUntil: 'domcontentloaded' });
  await delayedTopicPage.getByRole('list', { name: 'Topic list document' }).waitFor();
  await delayedTopicPage.evaluate((topicMarkup) => {
    window.history.pushState({}, '', '/t/delayed-topic/43');
    window.setTimeout(() => {
      const outlet = document.querySelector('#main-outlet, main');
      if (outlet) outlet.innerHTML = topicMarkup;
    }, 700);
  }, delayedTopicMainFixtureHtml());
  await delayedTopicPage.waitForURL('https://linux.do/t/delayed-topic/43');
  await assertWorkbenchLoading(delayedTopicPage, 'Loading topic…');
  assert.equal(await delayedTopicPage.getByText('Loading topic outline…').count(), 1);
  assert.equal(await delayedTopicPage.getByText('Loading topic minimap…').count(), 1);
  await delayedTopicPage.screenshot({
    path: path.join(topicRouteReadinessEvidenceDir, 'topic-route-loading.png'),
  });
  await delayedTopicPage.getByRole('document', { name: 'Topic code document' }).waitFor();
  await assertWorkbenchRouteChrome(delayedTopicPage, 'topic:43', 'Topic 43', 1);
  assert.equal(
    await delayedTopicPage
      .locator('.docode-topic-code__content-slot .cooked p')
      .filter({ hasText: 'Delayed native topic content' })
      .count(),
    1,
  );
  assert.deepEqual(await readTransientWorkbenchErrors(delayedTopicPage), []);
  await delayedTopicPage.screenshot({
    path: path.join(topicRouteReadinessEvidenceDir, 'topic-route-ready.png'),
  });
  await delayedTopicPage.close();
  const codeReadingPage = await context.newPage();
  await observeTransientWorkbenchErrors(codeReadingPage);
  await codeReadingPage.goto(topicOpeningFixtureUrl, { waitUntil: 'domcontentloaded' });
  await codeReadingPage.getByRole('document', { name: 'Topic code document' }).waitFor();
  const codeReadingString = codeReadingPage
    .locator('[data-docode-editor-line-kind="text"]')
    .first();
  assert.equal(
    await codeReadingString.evaluate((element) => getComputedStyle(element).color),
    'rgb(206, 145, 120)',
  );
  await codeReadingString.evaluate((element) => element.scrollIntoView({ block: 'center' }));
  await codeReadingPage.screenshot({
    path: path.join(codeReadingEvidenceDir, 'topic-string-color.png'),
  });
  const codeReadingImageTrigger = codeReadingPage
    .locator('[data-docode-image-trigger]')
    .filter({ hasText: 'image: Synthetic native image' })
    .first();
  await codeReadingImageTrigger.hover();
  const codeReadingPreview = codeReadingPage.locator('[data-docode-image-preview]:visible').first();
  await codeReadingPreview.waitFor();
  const fullscreenImageButton = codeReadingPreview.getByRole('button', {
    name: 'Open full-screen image: Synthetic native image',
  });
  assert.equal(await fullscreenImageButton.count(), 1);
  const previewActionPaint = await fullscreenImageButton.evaluate((button) => {
    const icon = button.querySelector('.codicon');
    const rect = button.getBoundingClientRect();
    if (!(icon instanceof HTMLElement)) throw new Error('Missing preview action icon.');
    return {
      color: getComputedStyle(button).color,
      height: rect.height,
      iconContent: getComputedStyle(icon, '::before').content,
      visible: rect.width > 0 && rect.height > 0,
      width: rect.width,
    };
  });
  assert.deepEqual(
    {
      color: previewActionPaint.color,
      height: previewActionPaint.height,
      visible: previewActionPaint.visible,
      width: previewActionPaint.width,
    },
    {
      color: 'rgb(204, 204, 204)',
      height: 24,
      visible: true,
      width: 24,
    },
  );
  assert.notEqual(previewActionPaint.iconContent, 'none');
  assert.notEqual(previewActionPaint.iconContent, 'normal');
  await codeReadingPage.screenshot({
    path: path.join(codeReadingEvidenceDir, 'image-preview-action.png'),
  });
  await fullscreenImageButton.click();
  const fullscreenImageViewer = codeReadingPage.getByRole('dialog', {
    name: 'Full-screen image: Synthetic native image',
  });
  await fullscreenImageViewer.waitFor();
  const fullscreenImageToolbar = fullscreenImageViewer.getByRole('toolbar', {
    name: 'Image tools: Synthetic native image',
  });
  const actualSizeImageButton = fullscreenImageToolbar.getByRole('button', {
    name: 'Show image at actual size: Synthetic native image',
  });
  const zoomInImageButton = fullscreenImageToolbar.getByRole('button', {
    name: 'Zoom in image: Synthetic native image',
  });
  const rotateRightImageButton = fullscreenImageToolbar.getByRole('button', {
    name: 'Rotate image right: Synthetic native image',
  });
  const flipHorizontalImageButton = fullscreenImageToolbar.getByRole('button', {
    name: 'Flip image horizontally: Synthetic native image',
  });
  const resetImageButton = fullscreenImageToolbar.getByRole('button', {
    name: 'Reset image view: Synthetic native image',
  });
  assert.equal(await fullscreenImageToolbar.count(), 1);
  assert.equal(await fullscreenImageToolbar.locator('button').count(), 10);
  const desktopImageToolbarGeometry = await fullscreenImageToolbar.evaluate((toolbar) => {
    const rect = toolbar.getBoundingClientRect();
    return {
      bottomGap: window.innerHeight - rect.bottom,
      centerDelta: Math.abs(rect.left + rect.width / 2 - window.innerWidth / 2),
      height: rect.height,
    };
  });
  assert.deepEqual(desktopImageToolbarGeometry, {
    bottomGap: 10,
    centerDelta: 0,
    height: 32,
  });
  const fullscreenCloseButton = fullscreenImageViewer.getByRole('button', {
    name: 'Close full-screen image: Synthetic native image',
  });
  assert.equal(await fullscreenCloseButton.count(), 1);
  const fullscreenClosePaint = await fullscreenCloseButton.evaluate((button) => {
    const icon = button.querySelector('.codicon');
    const rect = button.getBoundingClientRect();
    if (!(icon instanceof HTMLElement)) throw new Error('Missing full-screen close icon.');
    return {
      color: getComputedStyle(button).color,
      height: rect.height,
      iconContent: getComputedStyle(icon, '::before').content,
      width: rect.width,
    };
  });
  assert.deepEqual(
    {
      color: fullscreenClosePaint.color,
      height: fullscreenClosePaint.height,
      width: fullscreenClosePaint.width,
    },
    {
      color: 'rgb(204, 204, 204)',
      height: 26,
      width: 26,
    },
  );
  assert.notEqual(fullscreenClosePaint.iconContent, 'none');
  assert.notEqual(fullscreenClosePaint.iconContent, 'normal');
  assert.deepEqual(
    await fullscreenImageViewer.evaluate((viewer) => {
      const source = document.querySelector('[data-docode-image-source]');
      const image = viewer.querySelector('img');
      const rect = viewer.getBoundingClientRect();
      if (!(source instanceof HTMLImageElement) || !(image instanceof HTMLImageElement)) {
        throw new Error('Missing full-screen image surfaces.');
      }
      return {
        height: rect.height,
        imageIsClone: image !== source,
        imageUsesOriginalFixture:
          image.src.startsWith('data:image/svg+xml,') &&
          image.src.includes("width='960'") &&
          (image.src.includes('original image 960x540') ||
            image.src.includes('original%20image%20960x540')),
        sourceKind: viewer.dataset.docodeImageSource,
        sourceConnected: source.isConnected,
        sourceDisplay: getComputedStyle(source).display,
        width: rect.width,
        x: rect.x,
        y: rect.y,
      };
    }),
    {
      height: 800,
      imageIsClone: true,
      imageUsesOriginalFixture: true,
      sourceKind: 'original',
      sourceConnected: true,
      sourceDisplay: 'none',
      width: 1280,
      x: 0,
      y: 0,
    },
  );
  await codeReadingPage.screenshot({
    path: path.join(codeReadingEvidenceDir, 'image-fullscreen.png'),
  });
  await codeReadingPage.screenshot({
    path: path.join(imageViewerEvidenceDir, 'original-image-fit.png'),
  });
  const directManipulationImage = fullscreenImageViewer.locator(
    '.docode-topic-code__image-fullscreen-content',
  );
  const initialImageBox = await directManipulationImage.boundingBox();
  if (!initialImageBox) throw new Error('Missing direct-manipulation image geometry.');
  const wheelAnchor = {
    x: initialImageBox.x + initialImageBox.width * 0.3,
    y: initialImageBox.y + initialImageBox.height * 0.35,
  };
  const initialScale = Number(await fullscreenImageViewer.getAttribute('data-docode-image-scale'));
  await codeReadingPage.mouse.move(wheelAnchor.x, wheelAnchor.y);
  await codeReadingPage.mouse.wheel(0, -100);
  await codeReadingPage.waitForTimeout(50);
  const wheelZoomState = await fullscreenImageViewer.evaluate((viewer, anchor) => {
    const image = viewer.querySelector('.docode-topic-code__image-fullscreen-content');
    if (!(image instanceof HTMLImageElement)) throw new Error('Missing wheel-zoom image.');
    const rect = image.getBoundingClientRect();
    return {
      anchorDelta: Math.hypot(
        rect.left + rect.width * 0.3 - anchor.x,
        rect.top + rect.height * 0.35 - anchor.y,
      ),
      scale: Number(viewer.dataset.docodeImageScale),
      sizing: viewer.dataset.docodeImageSizing,
    };
  }, wheelAnchor);
  assert.equal(wheelZoomState.sizing, 'custom');
  assert.ok(wheelZoomState.scale > initialScale, 'Expected wheel-up to zoom the image in.');
  assert.ok(
    wheelZoomState.anchorDelta <= 2,
    `Expected pointer-centered wheel zoom, received ${String(wheelZoomState.anchorDelta)}px drift.`,
  );
  for (let index = 0; index < 5; index += 1) {
    await codeReadingPage.mouse.wheel(0, -120);
  }
  await codeReadingPage.waitForTimeout(50);
  const dragStart = await fullscreenImageViewer.evaluate((viewer) => ({
    x: Number(viewer.dataset.docodeImagePanX),
    y: Number(viewer.dataset.docodeImagePanY),
  }));
  const zoomedImageBox = await directManipulationImage.boundingBox();
  if (!zoomedImageBox) throw new Error('Missing zoomed image geometry.');
  const dragPoint = {
    x: zoomedImageBox.x + zoomedImageBox.width / 2,
    y: zoomedImageBox.y + zoomedImageBox.height / 2,
  };
  await codeReadingPage.mouse.move(dragPoint.x, dragPoint.y);
  await codeReadingPage.mouse.down();
  assert.equal(await fullscreenImageViewer.getAttribute('data-docode-image-dragging'), 'true');
  await codeReadingPage.mouse.move(dragPoint.x - 80, dragPoint.y - 60, { steps: 4 });
  await codeReadingPage.mouse.up();
  const dragEnd = await fullscreenImageViewer.evaluate((viewer) => {
    const image = viewer.querySelector('.docode-topic-code__image-fullscreen-content');
    if (!(image instanceof HTMLElement)) throw new Error('Missing direct-manipulation image.');
    return {
      cursor: getComputedStyle(image).cursor,
      dragging: viewer.dataset.docodeImageDragging,
      x: Number(viewer.dataset.docodeImagePanX),
      y: Number(viewer.dataset.docodeImagePanY),
    };
  });
  assert.equal(dragEnd.dragging, 'false');
  assert.equal(dragEnd.cursor, 'grab');
  assert.ok(dragEnd.x <= dragStart.x - 75, 'Expected horizontal image drag panning.');
  assert.ok(dragEnd.y <= dragStart.y - 55, 'Expected vertical image drag panning.');
  await codeReadingPage.screenshot({
    path: path.join(imageDirectManipulationEvidenceDir, 'image-wheel-drag.png'),
  });
  await resetImageButton.click();
  await actualSizeImageButton.click();
  await zoomInImageButton.click();
  await rotateRightImageButton.click();
  await flipHorizontalImageButton.click();
  assert.deepEqual(
    await fullscreenImageViewer.evaluate((viewer) => ({
      flipX: viewer.dataset.docodeImageFlipX,
      rotation: viewer.dataset.docodeImageRotation,
      scale: viewer.dataset.docodeImageScale,
      sizing: viewer.dataset.docodeImageSizing,
    })),
    { flipX: '-1', rotation: '90', scale: '1.250', sizing: 'custom' },
  );
  await codeReadingPage.screenshot({
    path: path.join(imageViewerEvidenceDir, 'image-transform-controls.png'),
  });
  await resetImageButton.click();
  assert.deepEqual(
    await fullscreenImageViewer.evaluate((viewer) => ({
      flipX: viewer.dataset.docodeImageFlipX,
      flipY: viewer.dataset.docodeImageFlipY,
      rotation: viewer.dataset.docodeImageRotation,
      sizing: viewer.dataset.docodeImageSizing,
    })),
    { flipX: '1', flipY: '1', rotation: '0', sizing: 'fit' },
  );
  await codeReadingPage.setViewportSize({ width: 420, height: 640 });
  await codeReadingPage.waitForTimeout(50);
  assert.deepEqual(
    await fullscreenImageViewer.evaluate((viewer) => {
      const toolbar = viewer.querySelector('[data-docode-image-toolbar]');
      if (!(toolbar instanceof HTMLElement)) throw new Error('Missing narrow image toolbar.');
      const rect = toolbar.getBoundingClientRect();
      return {
        bottomGap: window.innerHeight - rect.bottom,
        bottomWithinViewport: rect.bottom <= window.innerHeight,
        centerDelta: Math.abs(rect.left + rect.width / 2 - window.innerWidth / 2),
        height: rect.height,
        leftWithinViewport: rect.left >= 0,
        rightWithinViewport: rect.right <= window.innerWidth,
      };
    }),
    {
      bottomGap: 10,
      bottomWithinViewport: true,
      centerDelta: 0,
      height: 32,
      leftWithinViewport: true,
      rightWithinViewport: true,
    },
  );
  await codeReadingPage.screenshot({
    path: path.join(imageViewerEvidenceDir, 'image-viewer-narrow.png'),
  });
  await codeReadingPage.keyboard.press('Escape');
  await fullscreenImageViewer.waitFor({ state: 'hidden' });
  assert.equal(
    await fullscreenImageButton.evaluate((button) => button === document.activeElement),
    true,
  );
  assert.deepEqual(await readTransientWorkbenchErrors(codeReadingPage), []);
  await codeReadingPage.close();
  const replyTargetHoverPage = await context.newPage();
  await observeTransientWorkbenchErrors(replyTargetHoverPage);
  await replyTargetHoverPage.goto(replyTargetHoverFixtureUrl, {
    waitUntil: 'domcontentloaded',
  });
  await replyTargetHoverPage.getByRole('document', { name: 'Topic code document' }).waitFor();
  const replyTargetReference = replyTargetHoverPage.getByRole('button', {
    name: 'Preview replied-to post 1',
  });
  await replyTargetReference.waitFor();
  assert.equal(
    (await replyTargetReference.textContent())?.replace(/\s+/gu, ' ').trim(),
    'return #1 · @source-user;',
  );
  await replyTargetReference.scrollIntoViewIfNeeded();
  await replyTargetHoverPage.screenshot({
    path: path.join(replyTargetHoverEvidenceDir, 'reply-target-marker.png'),
  });
  await replyTargetReference.hover();
  const replyTargetHover = replyTargetHoverPage.getByRole('tooltip');
  await replyTargetHover.waitFor();
  const replyTargetHoverState = await replyTargetHover.evaluate((hover) => {
    const signature = hover.querySelector('.docode-topic-code__reply-hover-signature');
    const rect = hover.getBoundingClientRect();
    if (!(signature instanceof HTMLElement)) throw new Error('Missing reply hover signature.');
    const style = getComputedStyle(hover);
    const signatureStyle = getComputedStyle(signature);
    return {
      background: style.backgroundColor,
      borderColor: style.borderTopColor,
      borderWidth: style.borderTopWidth,
      color: style.color,
      maxHeight: style.maxHeight,
      width: style.width,
      positionedInsideViewport:
        rect.left >= 0 &&
        rect.top >= 0 &&
        rect.right <= window.innerWidth &&
        rect.bottom <= window.innerHeight,
      signaturePadding: signatureStyle.padding,
      text: hover.textContent?.replace(/\s+/gu, ' ').trim() ?? '',
    };
  });
  assert.deepEqual(
    {
      background: replyTargetHoverState.background,
      borderColor: replyTargetHoverState.borderColor,
      borderWidth: replyTargetHoverState.borderWidth,
      color: replyTargetHoverState.color,
      maxHeight: replyTargetHoverState.maxHeight,
      width: replyTargetHoverState.width,
      positionedInsideViewport: replyTargetHoverState.positionedInsideViewport,
      signaturePadding: replyTargetHoverState.signaturePadding,
    },
    {
      background: 'rgb(37, 37, 38)',
      borderColor: 'rgb(69, 69, 69)',
      borderWidth: '1px',
      color: 'rgb(204, 204, 204)',
      maxHeight: '420px',
      width: '560px',
      positionedInsideViewport: true,
      signaturePadding: '4px 8px',
    },
  );
  assert.match(replyTargetHoverState.text, /\(reply\) private void source_user_\d+\(\) \{/u);
  assert.match(replyTargetHoverState.text, /\/\/ #1 · Source User ·/u);
  assert.match(replyTargetHoverState.text, /"Original floor content for hover preview\."/u);
  assert.equal(await replyTargetHover.locator('a, button, img, iframe, script').count(), 0);
  await replyTargetHoverPage.screenshot({
    path: path.join(replyTargetHoverEvidenceDir, 'reply-target-hover.png'),
  });
  await replyTargetReference.focus();
  await replyTargetReference.press('Escape');
  await replyTargetHover.waitFor({ state: 'detached' });
  assert.equal(
    await replyTargetReference.evaluate((element) => element === document.activeElement),
    true,
  );
  const authorProfileTrigger = replyTargetHoverPage.getByRole('button', {
    name: 'Show profile for @source-user',
  });
  await authorProfileTrigger.waitFor();
  const signatureAvatar = authorProfileTrigger.locator('img');
  assert.equal(
    await signatureAvatar.getAttribute('src'),
    'https://linux.do/user_avatar/linux.do/source-user/48/1.png',
  );
  assert.deepEqual(
    await authorProfileTrigger.evaluate((trigger) => {
      const image = trigger.querySelector('img');
      if (!(image instanceof HTMLImageElement)) throw new Error('Missing signature avatar.');
      const triggerRect = trigger.getBoundingClientRect();
      const imageRect = image.getBoundingClientRect();
      return {
        imageHeight: imageRect.height,
        imageWidth: imageRect.width,
        triggerHeight: triggerRect.height,
        triggerWidth: triggerRect.width,
      };
    }),
    { imageHeight: 16, imageWidth: 16, triggerHeight: 16, triggerWidth: 16 },
  );
  await authorProfileTrigger.hover();
  const authorProfileHover = replyTargetHoverPage.getByRole('tooltip', {
    name: 'Linux DO profile for @source-user',
  });
  await authorProfileHover.waitFor();
  await authorProfileHover.getByText('5 posts in topic', { exact: false }).waitFor();
  await authorProfileHover.hover();
  await replyTargetHoverPage.waitForTimeout(160);
  assert.equal(await authorProfileHover.isVisible(), true);
  const authorProfileState = await authorProfileHover.evaluate((hover) => {
    const profileAvatar = hover.querySelector('.docode-topic-code__profile-signature > img');
    const profileSignature = hover.querySelector('.docode-topic-code__profile-signature');
    if (
      !(profileAvatar instanceof HTMLImageElement) ||
      !(profileSignature instanceof HTMLElement)
    ) {
      throw new Error('Profile Hover is missing its signature avatar.');
    }
    const rect = hover.getBoundingClientRect();
    const style = getComputedStyle(hover);
    const signatureStyle = getComputedStyle(profileSignature);
    const avatarRect = profileAvatar.getBoundingClientRect();
    return {
      avatarHeight: avatarRect.height,
      avatarWidth: avatarRect.width,
      background: style.backgroundColor,
      borderColor: style.borderTopColor,
      borderWidth: style.borderTopWidth,
      positionedInsideViewport:
        rect.left >= 0 &&
        rect.top >= 0 &&
        rect.right <= window.innerWidth &&
        rect.bottom <= window.innerHeight,
      signaturePadding: signatureStyle.padding,
      text: hover.textContent?.replace(/\s+/gu, ' ').trim() ?? '',
      width: style.width,
    };
  });
  assert.deepEqual(
    {
      avatarHeight: authorProfileState.avatarHeight,
      avatarWidth: authorProfileState.avatarWidth,
      background: authorProfileState.background,
      borderColor: authorProfileState.borderColor,
      borderWidth: authorProfileState.borderWidth,
      positionedInsideViewport: authorProfileState.positionedInsideViewport,
      signaturePadding: authorProfileState.signaturePadding,
      width: authorProfileState.width,
    },
    {
      avatarHeight: 36,
      avatarWidth: 36,
      background: 'rgb(37, 37, 38)',
      borderColor: 'rgb(69, 69, 69)',
      borderWidth: '1px',
      positionedInsideViewport: true,
      signaturePadding: '5px 8px',
      width: '500px',
    },
  );
  assert.match(authorProfileState.text, /\(user\) profile @source-user \{/u);
  assert.match(authorProfileState.text, /\/\/ Source User · Builder/u);
  assert.match(authorProfileState.text, /Builds Linux DO browser tools\./u);
  assert.match(authorProfileState.text, /5 posts in topic/u);
  assert.match(authorProfileState.text, /trust level 2/u);
  assert.match(authorProfileState.text, /badges: \["First Link", "Regular"\]/u);
  assert.doesNotMatch(authorProfileState.text, /unsafe/u);
  await replyTargetHoverPage.screenshot({
    path: path.join(authorProfileHoverEvidenceDir, 'author-profile-hover.png'),
  });
  await authorProfileTrigger.focus();
  await authorProfileTrigger.press('Escape');
  await authorProfileHover.waitFor({ state: 'detached' });
  assert.equal(
    await authorProfileTrigger.evaluate((element) => element === document.activeElement),
    true,
  );
  assert.deepEqual(await readTransientWorkbenchErrors(replyTargetHoverPage), []);
  await replyTargetHoverPage.close();
  const codeBlockPage = await context.newPage();
  await observeTransientWorkbenchErrors(codeBlockPage);
  await codeBlockPage.goto(codeBlockFixtureUrl, { waitUntil: 'domcontentloaded' });
  await codeBlockPage.getByRole('document', { name: 'Topic code document' }).waitFor();
  const codeBlockPaint = await codeBlockPage
    .locator('[data-docode-workbench-root]')
    .evaluate((root) => {
      const fixtureReply = root.querySelector('.docode-topic-code__reply[data-post-number="1"]');
      if (!(fixtureReply instanceof HTMLElement)) {
        throw new Error('Missing code-block fixture reply.');
      }
      const blocks = Array.from(fixtureReply.querySelectorAll('pre[data-docode-code-language]'));
      const byLanguage = new Map(
        blocks.map((block) => [block.getAttribute('data-docode-code-language'), block]),
      );
      const color = (selector) => {
        const element = root.querySelector(selector);
        if (!(element instanceof HTMLElement)) throw new Error(`Missing token: ${selector}`);
        return getComputedStyle(element).color;
      };
      const typescript = byLanguage.get('typescript');
      if (!(typescript instanceof HTMLElement)) throw new Error('Missing TypeScript block.');
      const labelStyle = getComputedStyle(typescript, '::before');
      return {
        comment: color('[data-docode-code-language="yaml"] .hljs-comment'),
        function: color('[data-docode-code-language="go"] .hljs-title.function_'),
        keyword: color('[data-docode-code-language="typescript"] .hljs-keyword'),
        labelColor: labelStyle.color,
        labelContent: labelStyle.content,
        labelFontSize: labelStyle.fontSize,
        languages: blocks.map((block) => ({
          id: block.getAttribute('data-docode-code-language'),
          label: block.getAttribute('data-docode-code-language-label'),
        })),
        number: color('[data-docode-code-language="typescript"] .hljs-number'),
        property: color('[data-docode-code-language="yaml"] .hljs-attr'),
        string: color('[data-docode-code-language="yaml"] .hljs-string'),
        type: color('[data-docode-code-language="java"] .hljs-type'),
      };
    });
  assert.deepEqual(codeBlockPaint, {
    comment: 'rgb(106, 153, 85)',
    function: 'rgb(220, 220, 170)',
    keyword: 'rgb(86, 156, 214)',
    labelColor: 'rgb(78, 201, 176)',
    labelContent: '"TypeScript"',
    labelFontSize: '11px',
    languages: [
      { id: 'typescript', label: 'TypeScript' },
      { id: 'java', label: 'Java' },
      { id: 'go', label: 'Go' },
      { id: 'yaml', label: 'YAML' },
      { id: 'plaintext', label: 'Plain Text' },
    ],
    number: 'rgb(181, 206, 168)',
    property: 'rgb(156, 220, 254)',
    string: 'rgb(206, 145, 120)',
    type: 'rgb(78, 201, 176)',
  });
  await codeBlockPage
    .locator('pre[data-docode-code-language="typescript"]')
    .scrollIntoViewIfNeeded();
  await codeBlockPage.screenshot({
    path: path.join(codeBlockEvidenceDir, 'language-aware-code-blocks.png'),
  });
  assert.deepEqual(await readTransientWorkbenchErrors(codeBlockPage), []);
  await codeBlockPage.close();
  const quickInputFidelityPage = await context.newPage();
  await observeTransientWorkbenchErrors(quickInputFidelityPage);
  await quickInputFidelityPage.goto(topicListFixtureUrl, { waitUntil: 'domcontentloaded' });
  await quickInputFidelityPage.getByRole('list', { name: 'Topic list document' }).waitFor();
  const fidelityQuickOpenTrigger = quickInputFidelityPage.getByRole('button', {
    name: 'Search files and Linux DO topics',
  });
  await fidelityQuickOpenTrigger.click();
  await quickInputFidelityPage.waitForTimeout(300);
  assert.deepEqual(await readCommandCenterUnderlay(quickInputFidelityPage), {
    ariaHidden: 'true',
    isConnected: true,
    pointerEvents: 'none',
    tabIndex: -1,
    visibility: 'hidden',
  });
  const desktopQuickInput = await readQuickOpen(quickInputFidelityPage);
  assert.deepEqual(
    {
      closeButtonCount: desktopQuickInput.closeButtonCount,
      countText: desktopQuickInput.countText,
      countVisuallyHidden: desktopQuickInput.countVisuallyHidden,
      inputFocused: desktopQuickInput.inputFocused,
      inputLeftInset: desktopQuickInput.inputLeftInset,
      inputRightInset: desktopQuickInput.inputRightInset,
      itemLeftInset: desktopQuickInput.itemLeftInset,
      itemRightInset: desktopQuickInput.itemRightInset,
      selectedOutlineStyle: desktopQuickInput.selectedOutlineStyle,
      width: desktopQuickInput.width,
    },
    {
      closeButtonCount: 0,
      countText: '37 results',
      countVisuallyHidden: true,
      inputFocused: true,
      inputLeftInset: 7,
      inputRightInset: 7,
      itemLeftInset: 7,
      itemRightInset: 7,
      selectedOutlineStyle: 'none',
      width: 600,
    },
  );
  await quickInputFidelityPage.screenshot({
    path: path.join(quickInputFidelityEvidenceDir, 'quick-open-desktop.png'),
  });
  await quickInputFidelityPage.screenshot({
    path: path.join(quickInputUnderlayEvidenceDir, 'quick-open-command-center-hidden.png'),
  });
  const fidelityQuickOpenInput = quickInputFidelityPage.getByRole('combobox', {
    name: 'Search open views, loaded topics, and Linux DO',
  });
  await fidelityQuickOpenInput.press('Tab');
  assert.equal(
    await fidelityQuickOpenInput.evaluate((element) => element === document.activeElement),
    true,
  );
  await quickInputFidelityPage.keyboard.press('Shift+Tab');
  assert.equal(
    await fidelityQuickOpenInput.evaluate((element) => element === document.activeElement),
    true,
  );
  await fidelityQuickOpenInput.press('Escape');
  await quickInputFidelityPage.waitForFunction(
    () => document.activeElement?.getAttribute('aria-label') === 'Search files and Linux DO topics',
  );
  assert.equal(
    await fidelityQuickOpenTrigger.evaluate((element) => element === document.activeElement),
    true,
  );
  assert.deepEqual(await readCommandCenterUnderlay(quickInputFidelityPage), {
    ariaHidden: null,
    isConnected: true,
    pointerEvents: 'auto',
    tabIndex: 0,
    visibility: 'visible',
  });
  const fidelityPaletteTrigger = quickInputFidelityPage.getByRole('button', {
    name: 'Open Command Palette',
  });
  await fidelityPaletteTrigger.click();
  await quickInputFidelityPage.waitForTimeout(300);
  assert.deepEqual(await readCommandCenterUnderlay(quickInputFidelityPage), {
    ariaHidden: 'true',
    isConnected: true,
    pointerEvents: 'none',
    tabIndex: -1,
    visibility: 'hidden',
  });
  const desktopCommandPalette = await readQuickOpen(quickInputFidelityPage);
  assert.deepEqual(
    {
      closeButtonCount: desktopCommandPalette.closeButtonCount,
      countVisuallyHidden: desktopCommandPalette.countVisuallyHidden,
      inputLeftInset: desktopCommandPalette.inputLeftInset,
      inputRightInset: desktopCommandPalette.inputRightInset,
      itemLeftInset: desktopCommandPalette.itemLeftInset,
      itemRightInset: desktopCommandPalette.itemRightInset,
      prefixInsideInput: desktopCommandPalette.prefixInsideInput,
      selectedOutlineStyle: desktopCommandPalette.selectedOutlineStyle,
      width: desktopCommandPalette.width,
    },
    {
      closeButtonCount: 0,
      countVisuallyHidden: true,
      inputLeftInset: 7,
      inputRightInset: 7,
      itemLeftInset: 7,
      itemRightInset: 7,
      prefixInsideInput: true,
      selectedOutlineStyle: 'none',
      width: 600,
    },
  );
  await quickInputFidelityPage.screenshot({
    path: path.join(quickInputFidelityEvidenceDir, 'command-palette-desktop.png'),
  });
  await quickInputFidelityPage.screenshot({
    path: path.join(quickInputUnderlayEvidenceDir, 'command-palette-command-center-hidden.png'),
  });
  await quickInputFidelityPage
    .getByRole('combobox', { name: 'Type the name of a command' })
    .press('Escape');
  assert.deepEqual(await readCommandCenterUnderlay(quickInputFidelityPage), {
    ariaHidden: null,
    isConnected: true,
    pointerEvents: 'auto',
    tabIndex: 0,
    visibility: 'visible',
  });
  await quickInputFidelityPage.setViewportSize({ width: 420, height: 640 });
  await fidelityQuickOpenTrigger.click();
  await quickInputFidelityPage.waitForTimeout(300);
  assert.deepEqual(await readCommandCenterUnderlay(quickInputFidelityPage), {
    ariaHidden: 'true',
    isConnected: true,
    pointerEvents: 'none',
    tabIndex: -1,
    visibility: 'hidden',
  });
  const narrowQuickInputFidelity = await readQuickOpen(quickInputFidelityPage);
  assert.deepEqual(
    {
      closeButtonCount: narrowQuickInputFidelity.closeButtonCount,
      countVisuallyHidden: narrowQuickInputFidelity.countVisuallyHidden,
      inputLeftInset: narrowQuickInputFidelity.inputLeftInset,
      inputRightInset: narrowQuickInputFidelity.inputRightInset,
      itemLeftInset: narrowQuickInputFidelity.itemLeftInset,
      itemRightInset: narrowQuickInputFidelity.itemRightInset,
      top: narrowQuickInputFidelity.top,
      width: narrowQuickInputFidelity.width,
    },
    {
      closeButtonCount: 0,
      countVisuallyHidden: true,
      inputLeftInset: 7,
      inputRightInset: 7,
      itemLeftInset: 7,
      itemRightInset: 7,
      top: 8,
      width: 404,
    },
  );
  await quickInputFidelityPage.screenshot({
    path: path.join(quickInputFidelityEvidenceDir, 'quick-open-narrow.png'),
  });
  await quickInputFidelityPage.screenshot({
    path: path.join(quickInputUnderlayEvidenceDir, 'quick-open-narrow-underlay-hidden.png'),
  });
  await quickInputFidelityPage
    .getByRole('combobox', { name: 'Search open views, loaded topics, and Linux DO' })
    .press('Escape');
  assert.deepEqual(await readCommandCenterUnderlay(quickInputFidelityPage), {
    ariaHidden: null,
    isConnected: true,
    pointerEvents: 'auto',
    tabIndex: 0,
    visibility: 'visible',
  });
  assert.deepEqual(await readTransientWorkbenchErrors(quickInputFidelityPage), []);
  await quickInputFidelityPage.close();
  const unreadTopicListFixturePage = await context.newPage();
  await observeTransientWorkbenchErrors(unreadTopicListFixturePage);
  await unreadTopicListFixturePage.goto(unreadTopicListFixtureUrl, {
    waitUntil: 'domcontentloaded',
  });
  await assertRuntimeOwnership(unreadTopicListFixturePage, true);
  await unreadTopicListFixturePage.getByRole('list', { name: 'Topic list document' }).waitFor();
  assert.deepEqual(await readTransientWorkbenchErrors(unreadTopicListFixturePage), []);
  assert.equal(
    await unreadTopicListFixturePage
      .locator('.docode-topic-list__topic-link')
      .first()
      .getAttribute('data-route-href'),
    'https://linux.do/t/synthetic-topic-1/42/4',
  );
  await unreadTopicListFixturePage.screenshot({
    path: path.join(unreadCompatibilityEvidenceDir, 'unread-first-post-link.png'),
  });
  await unreadTopicListFixturePage.close();
  const topicListPaginationPage = await context.newPage();
  await observeTransientWorkbenchErrors(topicListPaginationPage);
  await topicListPaginationPage.goto(topicListPaginationFixtureUrl, {
    waitUntil: 'domcontentloaded',
  });
  await assertRuntimeOwnership(topicListPaginationPage, true);
  const paginatedTopicList = topicListPaginationPage.getByRole('list', {
    name: 'Topic list document',
  });
  await paginatedTopicList.waitFor();
  const paginationScrollTop = await paginatedTopicList.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    element.dispatchEvent(new Event('scroll'));
    return element.scrollTop;
  });
  await topicListPaginationPage.waitForFunction(
    () => document.querySelectorAll('.docode-topic-list__entry').length === 38,
  );
  assert.deepEqual(await readTransientWorkbenchErrors(topicListPaginationPage), []);
  assert.equal(topicListPaginationRequestCount, 2);
  assert.deepEqual(
    await paginatedTopicList.evaluate((element) => ({
      entryCount: element.querySelectorAll('.docode-topic-list__entry').length,
      hasMore: element.dataset.hasMoreTopics ?? null,
      lastLine: document
        .querySelector('.docode-topic-list__gutter-content')
        ?.lastElementChild?.textContent?.trim(),
      loading: element.dataset.loadingMoreTopics ?? null,
      scrollTop: element.scrollTop,
    })),
    {
      entryCount: 38,
      hasMore: null,
      lastLine: '318',
      loading: null,
      scrollTop: paginationScrollTop,
    },
  );
  await topicListPaginationPage.screenshot({
    path: path.join(topicListPaginationEvidenceDir, 'topic-list-appended.png'),
  });
  await topicListPaginationPage.close();
  const topicPaginationPage = await context.newPage();
  await observeTransientWorkbenchErrors(topicPaginationPage);
  await topicPaginationPage.goto(topicPaginationFixtureUrl, { waitUntil: 'domcontentloaded' });
  await assertRuntimeOwnership(topicPaginationPage, true);
  const paginatedTopic = topicPaginationPage.getByRole('document', {
    name: 'Topic code document',
  });
  await paginatedTopic.waitFor();
  await paginatedTopic.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    element.dispatchEvent(new Event('scroll'));
  });
  await topicPaginationPage.getByRole('progressbar', { name: 'Loading more replies…' }).waitFor();
  await topicPaginationPage.waitForFunction(
    () => document.querySelectorAll('.docode-topic-code__reply').length === 2,
  );
  assert.deepEqual(await readTransientWorkbenchErrors(topicPaginationPage), []);
  assert.equal(topicPaginationRequestCount, 2);
  assert.equal(await topicPaginationPage.locator('[data-docode-paginated-post]').count(), 1);
  assert.equal(
    await topicPaginationPage.locator('.docode-workbench__status-item--replies').textContent(),
    'Replies 2 · End',
  );
  assert.equal(
    await topicPaginationPage.getByRole('progressbar', { name: 'Loading more replies…' }).count(),
    0,
  );
  const appendedReplyLineCoverage = await readRenderedContentLineCoverage(topicPaginationPage);
  assert.deepEqual(appendedReplyLineCoverage.missingNumbers, []);
  assert.deepEqual(appendedReplyLineCoverage.misalignedNumbers, []);
  assert.deepEqual(appendedReplyLineCoverage.duplicateDocumentNumbers, []);
  await topicPaginationPage.evaluate(() => {
    const workbench = document.querySelector('[data-docode-workbench-root]');
    const roots = Array.from(
      document.querySelectorAll('.docode-topic-code__content-slot > .cooked'),
    );
    if (!workbench || roots.length !== 2) {
      throw new Error('Missing stable topic-content verification fixture.');
    }
    globalThis.__docodeStableTopicRoots = roots;
    globalThis.__docodeStableTopicMountCount = 0;
    globalThis.__docodeStableTopicPartialObserved = false;
    for (const root of roots) {
      root.addEventListener('docode:native-content-transfer-mount', () => {
        globalThis.__docodeStableTopicMountCount += 1;
      });
    }
    globalThis.__docodeStableTopicObserver = new MutationObserver(() => {
      if (workbench.querySelector('.docode-topic-code__missing-content')) {
        globalThis.__docodeStableTopicPartialObserved = true;
      }
    });
    globalThis.__docodeStableTopicObserver.observe(workbench, {
      childList: true,
      subtree: true,
    });
  });
  for (let refresh = 0; refresh < 4; refresh += 1) {
    await topicPaginationPage.evaluate(
      (showNativePost) => {
        const stream = document.querySelector('.post-stream');
        if (!(stream instanceof HTMLElement)) throw new Error('Missing native post stream.');
        stream.innerHTML = showNativePost
          ? `<div data-post-number="1"><article data-post-id="8800" data-user-id="1">
            <div class="names"><a data-user-card="page-user-1" href="/u/page-user-1">Page User 1</a></div>
            <a class="post-date" href="/t/synthetic-pagination/88"><span data-time="2026-08-20T12:00:00.000Z">now</span></a>
            <div class="cooked"><p>Transient native replacement</p></div>
          </article></div>`
          : '';
      },
      refresh % 2 === 1,
    );
    await topicPaginationPage.waitForTimeout(120);
  }
  const stableTopicRefresh = await topicPaginationPage.evaluate(() => {
    globalThis.__docodeStableTopicObserver?.disconnect();
    const expectedRoots = globalThis.__docodeStableTopicRoots ?? [];
    const currentRoots = Array.from(
      document.querySelectorAll('.docode-topic-code__content-slot > .cooked'),
    );
    return {
      content: currentRoots.map((root) => root.textContent?.trim() ?? ''),
      missingContentCount: document.querySelectorAll('.docode-topic-code__missing-content').length,
      mountCount: globalThis.__docodeStableTopicMountCount ?? -1,
      partialObserved: globalThis.__docodeStableTopicPartialObserved ?? true,
      preservedIdentity:
        currentRoots.length === expectedRoots.length &&
        currentRoots.every((root, index) => root === expectedRoots[index]),
    };
  });
  assert.deepEqual(stableTopicRefresh, {
    content: ['Paginated reply 1', 'Paginated reply 2'],
    missingContentCount: 0,
    mountCount: 0,
    partialObserved: false,
    preservedIdentity: true,
  });
  await topicPaginationPage.screenshot({
    path: path.join(topicPaginationEvidenceDir, 'topic-replies-appended.png'),
  });
  await topicPaginationPage.screenshot({
    path: path.join(topicPaginationEvidenceDir, 'topic-content-refresh-stable.png'),
  });
  await topicPaginationPage.screenshot({
    path: path.join(topicContinuationStabilityEvidenceDir, 'topic-gutter-after-append.png'),
  });
  await topicPaginationPage.close();
  const topicBackwardPaginationPage = await context.newPage();
  await observeTransientWorkbenchErrors(topicBackwardPaginationPage);
  await topicBackwardPaginationPage.goto(topicBackwardPaginationFixtureUrl, {
    waitUntil: 'domcontentloaded',
  });
  await assertRuntimeOwnership(topicBackwardPaginationPage, true);
  const backwardPaginatedTopic = topicBackwardPaginationPage.getByRole('document', {
    name: 'Topic code document',
  });
  await backwardPaginatedTopic.waitFor();
  await topicBackwardPaginationPage
    .getByRole('progressbar', { name: 'Loading earlier replies…' })
    .waitFor();
  const floor18ViewportBefore = await backwardPaginatedTopic.evaluate((element) => {
    const reply = element.querySelector('.docode-topic-code__reply[data-post-number="18"]');
    const surfaceRect = element.getBoundingClientRect();
    const replyRect = reply?.getBoundingClientRect();
    return {
      offsetTop: replyRect ? replyRect.top - surfaceRect.top : null,
      scrollTop: element.scrollTop,
    };
  });
  await topicBackwardPaginationPage.waitForFunction(
    () => document.querySelectorAll('.docode-topic-code__reply').length === 48,
  );
  assert.deepEqual(await readTransientWorkbenchErrors(topicBackwardPaginationPage), []);
  assert.equal(topicBackwardPaginationRequestCount, 2);
  assert.equal(
    await topicBackwardPaginationPage.locator('[data-docode-paginated-post]').count(),
    17,
  );
  assert.equal(
    await topicBackwardPaginationPage
      .locator('.docode-workbench__status-item--replies')
      .textContent(),
    'Replies 48 · End',
  );
  assert.equal(
    await topicBackwardPaginationPage.getByText(/Loaded range starts at post/).count(),
    0,
  );
  assert.equal(
    await topicBackwardPaginationPage
      .getByRole('progressbar', {
        name: 'Loading earlier replies…',
      })
      .count(),
    0,
  );
  const floor18ViewportAfter = await backwardPaginatedTopic.evaluate((element) => {
    const reply = element.querySelector('.docode-topic-code__reply[data-post-number="18"]');
    const surfaceRect = element.getBoundingClientRect();
    const replyRect = reply?.getBoundingClientRect();
    return {
      offsetTop: replyRect ? replyRect.top - surfaceRect.top : null,
      scrollTop: element.scrollTop,
    };
  });
  assert.notEqual(floor18ViewportBefore.offsetTop, null);
  assert.notEqual(floor18ViewportAfter.offsetTop, null);
  assert.equal(
    Math.abs(floor18ViewportAfter.offsetTop - floor18ViewportBefore.offsetTop) <= 1,
    true,
  );
  assert.equal(floor18ViewportAfter.scrollTop > floor18ViewportBefore.scrollTop, true);
  const prependedReplyLineCoverage = await readRenderedContentLineCoverage(
    topicBackwardPaginationPage,
  );
  assert.deepEqual(prependedReplyLineCoverage.missingNumbers, []);
  assert.deepEqual(prependedReplyLineCoverage.misalignedNumbers, []);
  assert.deepEqual(prependedReplyLineCoverage.duplicateDocumentNumbers, []);
  await topicBackwardPaginationPage.screenshot({
    path: path.join(topicBackwardPaginationEvidenceDir, 'topic-earlier-replies-loaded.png'),
  });
  await topicBackwardPaginationPage.close();
  const topicPaginationEndPage = await context.newPage();
  await observeTransientWorkbenchErrors(topicPaginationEndPage);
  await topicPaginationEndPage.goto(topicPaginationEndFixtureUrl, {
    waitUntil: 'domcontentloaded',
  });
  await assertRuntimeOwnership(topicPaginationEndPage, true);
  const exhaustedTopic = topicPaginationEndPage.getByRole('document', {
    name: 'Topic code document',
  });
  await exhaustedTopic.waitFor();
  await exhaustedTopic.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    element.dispatchEvent(new Event('scroll'));
  });
  await topicPaginationEndPage
    .getByRole('progressbar', { name: 'Loading more replies…' })
    .waitFor();
  const exhaustedViewportBefore = await exhaustedTopic.evaluate((element) => ({
    activePostId:
      element
        .querySelector('.docode-topic-code__reply[data-active="true"]')
        ?.getAttribute('data-post-id') ?? null,
    distanceFromEnd: Math.max(0, element.scrollHeight - element.clientHeight - element.scrollTop),
  }));
  await exhaustedTopic.evaluate((element) => {
    element.scrollTop = Math.max(0, element.scrollTop - 180);
    element.dispatchEvent(new Event('scroll'));
  });
  await topicPaginationEndPage.waitForFunction(
    () =>
      document.querySelector('.docode-workbench__status-item--replies')?.textContent ===
      'Replies 12 · End',
  );
  assert.deepEqual(await readTransientWorkbenchErrors(topicPaginationEndPage), []);
  assert.equal(topicPaginationEndRequestCount, 5);
  const exhaustedViewportAfter = await exhaustedTopic.evaluate((element) => ({
    activePostId:
      element
        .querySelector('.docode-topic-code__reply[data-active="true"]')
        ?.getAttribute('data-post-id') ?? null,
    distanceFromEnd: Math.max(0, element.scrollHeight - element.clientHeight - element.scrollTop),
  }));
  assert.equal(exhaustedViewportAfter.activePostId, exhaustedViewportBefore.activePostId);
  assert.equal(
    Math.abs(exhaustedViewportAfter.distanceFromEnd - exhaustedViewportBefore.distanceFromEnd) <= 1,
    true,
    `Pagination completion moved the viewport: ${JSON.stringify({ after: exhaustedViewportAfter, before: exhaustedViewportBefore })}`,
  );
  const exhaustedReplyLineCoverage = await readRenderedContentLineCoverage(topicPaginationEndPage);
  assert.deepEqual(exhaustedReplyLineCoverage.missingNumbers, []);
  assert.deepEqual(exhaustedReplyLineCoverage.misalignedNumbers, []);
  assert.deepEqual(exhaustedReplyLineCoverage.duplicateDocumentNumbers, []);
  await exhaustedTopic.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    element.dispatchEvent(new Event('scroll'));
  });
  await topicPaginationEndPage.waitForTimeout(300);
  assert.equal(topicPaginationEndRequestCount, 5);
  await topicPaginationEndPage.screenshot({
    path: path.join(topicPaginationEndEvidenceDir, 'topic-pagination-end-stable.png'),
  });
  await topicPaginationEndPage.screenshot({
    path: path.join(topicContinuationStabilityEvidenceDir, 'topic-end-stable.png'),
  });
  await topicPaginationEndPage.close();
  await topicListFixturePage.bringToFront();
  await verifyMacWorkbenchFullscreen(topicListFixturePage);
  const topicListDocument = await readTopicListDocument(topicListFixturePage);
  assert.deepEqual(topicListDocument, {
    firstLineNumber: '1',
    firstSource: 'import LinuxDo.Community;',
    fontSize: '13px',
    gutterFontSize: '13px',
    horizontalOverflow: false,
    keywordColor: 'rgb(78, 201, 176)',
    lineCount: 302,
    lineHeight: 20,
    lastLineNumber: '302',
    listRole: 'list',
    methodColor: 'rgb(220, 220, 170)',
    stringColor: 'rgb(206, 145, 120)',
    verticalOverflow: true,
  });
  const tabDisguise = await topicListFixturePage.evaluate(() => ({
    faviconPrefix:
      document
        .querySelector('link[rel~="icon"]')
        ?.getAttribute('href')
        ?.slice(0, 'data:image/png;base64,'.length) ?? null,
    title: document.title,
  }));
  assert.deepEqual(tabDisguise, {
    faviconPrefix: 'data:image/png;base64,',
    title: 'LinuxDo.java - docode - Visual Studio Code',
  });
  const fullWorkbenchListChrome = await readFullWorkbenchChrome(
    topicListFixturePage,
    '.docode-topic-list__line[data-row-kind="signature"]',
  );
  assert.deepEqual(fullWorkbenchListChrome, {
    activityBarWidth: 48,
    breadcrumbsHeight: 22,
    commandCenterHeight: 22,
    editorLineHeight: 20,
    explorerRouteCount: 5,
    sidebarWidth: 300,
    statusBarHeight: 22,
    titleBarHeight: 35,
  });
  assert.deepEqual(await readWorkbenchReferenceChrome(topicListFixturePage), {
    activityBarBackground: 'rgb(51, 51, 51)',
    editorActionCount: 3,
    editorActionIcons: ['codicon-source-control', 'codicon-split-horizontal', 'codicon-ellipsis'],
    editorActionText: ['', '', ''],
    editorActionWidths: [28, 28, 28],
    editorBackground: 'rgb(30, 30, 30)',
    explorerTitle: 'DOCODE',
    panelBackground: 'rgb(30, 30, 30)',
    sidebarBackground: 'rgb(37, 37, 38)',
    tabStripBackground: 'rgb(37, 37, 38)',
    titleBarBackground: 'rgb(60, 60, 60)',
  });
  const primarySidebarSash = topicListFixturePage.getByRole('separator', {
    name: 'Resize primary side bar',
  });
  const initialSidebarSashBox = await primarySidebarSash.boundingBox();
  assert(initialSidebarSashBox);
  assert.equal(initialSidebarSashBox.width, 4);
  await topicListFixturePage.mouse.move(
    initialSidebarSashBox.x + initialSidebarSashBox.width / 2,
    initialSidebarSashBox.y + 80,
  );
  await topicListFixturePage.mouse.down();
  await topicListFixturePage.mouse.move(
    initialSidebarSashBox.x + initialSidebarSashBox.width / 2 + 60,
    initialSidebarSashBox.y + 80,
  );
  await topicListFixturePage.mouse.up();
  assert.equal(await readElementWidth(topicListFixturePage, '.docode-workbench__sidebar'), 360);
  await primarySidebarSash.focus();
  await primarySidebarSash.press('ArrowLeft');
  assert.equal(await readElementWidth(topicListFixturePage, '.docode-workbench__sidebar'), 350);
  await primarySidebarSash.press('Home');
  assert.equal(await readElementWidth(topicListFixturePage, '.docode-workbench__sidebar'), 170);
  await primarySidebarSash.press('End');
  assert.equal(
    await readElementWidth(topicListFixturePage, '.docode-workbench__sidebar'),
    Number(await primarySidebarSash.getAttribute('aria-valuemax')),
  );
  await primarySidebarSash.dblclick();
  assert.equal(await readElementWidth(topicListFixturePage, '.docode-workbench__sidebar'), 300);
  const restoredSidebarWidth = 248;
  const resetSidebarSashBox = await primarySidebarSash.boundingBox();
  assert(resetSidebarSashBox);
  await topicListFixturePage.mouse.move(
    resetSidebarSashBox.x + resetSidebarSashBox.width / 2,
    resetSidebarSashBox.y + 80,
  );
  await topicListFixturePage.mouse.down();
  await topicListFixturePage.mouse.move(
    resetSidebarSashBox.x + resetSidebarSashBox.width / 2 - 52,
    resetSidebarSashBox.y + 80,
  );
  await topicListFixturePage.mouse.up();
  await topicListFixturePage
    .locator('.docode-workbench[data-layout-storage-pending="false"]')
    .waitFor();
  assert.equal(
    await readElementWidth(topicListFixturePage, '.docode-workbench__sidebar'),
    restoredSidebarWidth,
  );
  await topicListFixturePage.getByRole('treeitem', { name: 'new' }).click();
  await topicListFixturePage.waitForURL('https://linux.do/new');
  await assertRuntimeOwnership(topicListFixturePage, true);
  await topicListFixturePage.getByRole('list', { name: 'Topic list document' }).waitFor();
  assert.equal(
    await readElementWidth(topicListFixturePage, '.docode-workbench__sidebar'),
    restoredSidebarWidth,
  );
  await topicListFixturePage.screenshot({
    path: path.join(sidebarContinuityEvidenceDir, 'explorer-width-after-category-change.png'),
  });
  await topicListFixturePage.goBack({ waitUntil: 'domcontentloaded' });
  assert.equal(topicListFixturePage.url(), topicListFixtureUrl);
  await topicListFixturePage.getByRole('list', { name: 'Topic list document' }).waitFor();
  assert.equal(
    await readElementWidth(topicListFixturePage, '.docode-workbench__sidebar'),
    restoredSidebarWidth,
  );
  await primarySidebarSash.dblclick();
  await topicListFixturePage
    .locator('.docode-workbench[data-layout-storage-pending="false"]')
    .waitFor();
  assert.equal(await readElementWidth(topicListFixturePage, '.docode-workbench__sidebar'), 300);
  assert.equal(await topicListFixturePage.locator('.docode-topic-list__marker:visible').count(), 0);
  await topicListFixturePage.waitForFunction(
    (expected) =>
      [...document.querySelectorAll('.docode-topic-list__line')].some(
        (line) => line.textContent?.trimStart().startsWith(expected) === true,
      ),
    'community.post("Synthetic topic 1")',
  );
  assert.equal(
    (
      (await topicListFixturePage.locator('.docode-topic-list__line').first().textContent()) ?? ''
    ).startsWith('import LinuxDo.Community;'),
    true,
  );
  await topicListFixturePage.screenshot({
    path: path.join(evidenceDir, 'topic-list-latest.png'),
  });
  await topicListFixturePage.screenshot({
    path: path.join(fullWorkbenchEvidenceDir, 'topic-list-workbench.png'),
  });
  await topicListFixturePage.screenshot({
    path: path.join(fullChromeReferenceEvidenceDir, 'full-chrome-1280.png'),
  });
  await topicListFixturePage.setViewportSize({ width: 1672, height: 907 });
  await topicListFixturePage.screenshot({
    path: path.join(fidelityCorrectionEvidenceDir, 'topic-list-wide.png'),
  });
  await topicListFixturePage.setViewportSize({ width: 1684, height: 994 });
  assert.deepEqual(await readWorkbenchGeometry(topicListFixturePage), {
    editorHeight: 833,
    gutterWidth: 56,
    height: 994,
    minimapVisible: true,
    minimapWidth: 120,
    panelHeight: 100,
    sashHeight: 4,
    statusBarHeight: 22,
    width: 1684,
  });
  await topicListFixturePage.screenshot({
    path: path.join(fullChromeReferenceEvidenceDir, 'full-chrome-1684.png'),
  });
  await topicListFixturePage.setViewportSize({ width: 1280, height: 800 });
  const macChromePage = await context.newPage();
  await macChromePage.setViewportSize({ width: 1672, height: 907 });
  await macChromePage.goto(topicListFixtureUrl, { waitUntil: 'domcontentloaded' });
  await assertRuntimeOwnership(macChromePage, true);
  await setRenderedWorkbenchPlatform(macChromePage, 'mac');
  const macPlatformChrome = await readPlatformChrome(macChromePage);
  assert.deepEqual(macPlatformChrome, {
    activityActionHeight: 48,
    activityBarWidth: 48,
    bottomActionCount: 2,
    extensionIconPainted: true,
    firstLineNumber: '1',
    gutterWidth: 56,
    layoutControlCount: 4,
    layoutControlGap: 4,
    layoutControlGroupWidth: 100,
    layoutControlHeight: 22,
    layoutControlIconClasses: [
      'codicon-layout',
      'codicon-layout-sidebar-left',
      'codicon-layout-panel',
      'codicon-layout-sidebar-right-off',
    ],
    layoutControlIconsPainted: true,
    layoutControlWidth: 22,
    layoutDividerCount: 0,
    menuLabels: [],
    platform: 'mac',
    searchIconPainted: true,
    syncBadgeCount: 0,
    secondarySidebarDisabled: true,
    topActionCount: 6,
    trafficLightCount: 3,
    trafficLightInteractiveCount: 1,
    warningBadgeCount: 1,
    windowControlCount: 0,
    windowControlInteractiveCount: 0,
  });
  assert.deepEqual(await readTitlebarFidelity(macChromePage), {
    backInCenter: true,
    commandCenterHeight: 22,
    commandCenterLabel: 'DOCode',
    commandCenterSearchIconCount: 0,
    commandCenterWidth: 600,
    centerDisplay: 'flex',
    centerFlexGrow: '0',
    forwardCommandGap: 6,
    forwardInCenter: true,
    leftFlexGrow: '2',
    rightFlexGrow: '2',
    titlebarBackground: 'rgb(60, 60, 60)',
    titlebarDisplay: 'flex',
    trafficLightsInLeft: true,
  });
  await macChromePage.locator('.docode-workbench__titlebar').screenshot({
    path: path.join(titlebarCommandCenterEvidenceDir, 'titlebar-macos.png'),
  });
  const macTrafficLights = macChromePage.locator('.docode-workbench__traffic-lights');
  assert.deepEqual(await readMacTrafficLightGlyphs(macChromePage), {
    glyphs: ['close', 'minimize', 'zoom'],
    opacities: [0, 0, 0],
  });
  await macTrafficLights.hover();
  await macChromePage.waitForTimeout(60);
  assert.deepEqual(await readMacTrafficLightGlyphs(macChromePage), {
    glyphs: ['close', 'minimize', 'zoom'],
    opacities: [1, 1, 1],
  });
  await macTrafficLights.screenshot({
    path: path.join(platformChromeEvidenceDir, 'workbench-macos-controls-hover.png'),
  });
  await verifyMacWorkbenchFullscreen(macChromePage);
  await macChromePage.locator('.docode-workbench__layout-controls').screenshot({
    path: path.join(titlebarLayoutEvidenceDir, 'layout-controls-macos.png'),
  });
  await macChromePage.getByRole('button', { name: 'Customize Layout' }).click();
  const layoutMenu = macChromePage.getByRole('menu', { name: 'Customize Layout' });
  await layoutMenu.waitFor();
  assert.deepEqual(await readLayoutMenu(macChromePage), {
    menuItemLabels: [
      'Primary Side Bar',
      'Panel',
      'Secondary Side Bar (Unavailable)',
      'Open Command Palette...',
    ],
    panelChecked: 'true',
    primarySidebarChecked: 'true',
    secondarySidebarDisabled: true,
  });
  await layoutMenu.screenshot({
    path: path.join(titlebarLayoutEvidenceDir, 'layout-menu-macos.png'),
  });
  await macChromePage.keyboard.press('Escape');
  await macChromePage.getByRole('button', { name: 'Toggle Primary Side Bar' }).click();
  await macChromePage.locator('.docode-workbench[data-sidebar-open="false"]').waitFor();
  assert.equal(
    await macChromePage
      .locator('.docode-workbench__layout-controls .codicon-layout-sidebar-left-off')
      .count(),
    1,
  );
  await macChromePage.getByRole('button', { name: 'Toggle Primary Side Bar' }).click();
  await macChromePage.locator('.docode-workbench[data-sidebar-open="true"]').waitFor();
  await macChromePage.getByRole('button', { name: 'Toggle Panel' }).click();
  await macChromePage.locator('.docode-workbench[data-panel-open="false"]').waitFor();
  assert.equal(
    await macChromePage
      .locator('.docode-workbench__layout-controls .codicon-layout-panel-off')
      .count(),
    1,
  );
  await macChromePage.getByRole('button', { name: 'Toggle Panel' }).click();
  await macChromePage.locator('.docode-workbench[data-panel-open="true"]').waitFor();
  await macChromePage.screenshot({
    path: path.join(platformChromeEvidenceDir, 'workbench-macos.png'),
  });
  await macChromePage.close();

  const windowsChromePage = await context.newPage();
  const windowsPlatformSession = await emulateWindowsNavigator(windowsChromePage);
  await windowsChromePage.setViewportSize({ width: 1672, height: 907 });
  await windowsChromePage.goto(topicListFixtureUrl, { waitUntil: 'domcontentloaded' });
  await assertRuntimeOwnership(windowsChromePage, true);
  assert.equal(await windowsChromePage.evaluate(() => navigator.platform), 'Win32');
  const windowsPlatformChrome = await readPlatformChrome(windowsChromePage);
  assert.deepEqual(windowsPlatformChrome, {
    activityActionHeight: 48,
    activityBarWidth: 48,
    bottomActionCount: 2,
    extensionIconPainted: true,
    firstLineNumber: '1',
    gutterWidth: 56,
    layoutControlCount: 4,
    layoutControlGap: 4,
    layoutControlGroupWidth: 100,
    layoutControlHeight: 22,
    layoutControlIconClasses: [
      'codicon-layout',
      'codicon-layout-sidebar-left',
      'codicon-layout-panel',
      'codicon-layout-sidebar-right-off',
    ],
    layoutControlIconsPainted: true,
    layoutControlWidth: 22,
    layoutDividerCount: 0,
    menuLabels: ['File', 'Edit', 'Selection', 'View', 'Go', 'Run', 'Terminal', 'Help'],
    platform: 'windows',
    searchIconPainted: true,
    syncBadgeCount: 0,
    secondarySidebarDisabled: true,
    topActionCount: 6,
    trafficLightCount: 0,
    trafficLightInteractiveCount: 0,
    warningBadgeCount: 1,
    windowControlCount: 3,
    windowControlInteractiveCount: 1,
  });
  const windowsControlFidelity = await readWindowsControlFidelity(windowsChromePage);
  assert.deepEqual(windowsControlFidelity, {
    containerHeight: 35,
    containerWidth: 138,
    controlHeights: [35, 35, 35],
    controlWidths: [46, 46, 46],
    iconClasses: ['codicon-chrome-minimize', 'codicon-chrome-maximize', 'codicon-chrome-close'],
    iconSizes: [16, 16, 16],
    rightGap: 0,
  });
  await windowsChromePage.screenshot({
    path: path.join(platformChromeEvidenceDir, 'workbench-windows.png'),
  });
  const windowsCloseControl = windowsChromePage.locator('.docode-workbench__window-control--close');
  await windowsCloseControl.hover();
  assert.equal(
    await windowsCloseControl.evaluate((control) => getComputedStyle(control).backgroundColor),
    'rgba(232, 17, 35, 0.9)',
  );
  assert.equal(
    await windowsCloseControl.evaluate((control) => getComputedStyle(control).color),
    'rgb(255, 255, 255)',
  );
  await windowsChromePage.screenshot({
    path: path.join(platformChromeEvidenceDir, 'workbench-windows-close-hover.png'),
  });
  await windowsChromePage.mouse.move(0, 200);
  await verifyWindowsWorkbenchFullscreen(windowsChromePage);
  await windowsChromePage.setViewportSize({ width: 420, height: 640 });
  const windowsNarrowPlatformChrome = await readPlatformChrome(windowsChromePage);
  assert.deepEqual(windowsNarrowPlatformChrome, {
    activityActionHeight: 48,
    activityBarWidth: 48,
    bottomActionCount: 2,
    extensionIconPainted: true,
    firstLineNumber: '1',
    gutterWidth: 36,
    layoutControlCount: 4,
    layoutControlGap: 4,
    layoutControlGroupWidth: 100,
    layoutControlHeight: 22,
    layoutControlIconClasses: [
      'codicon-layout',
      'codicon-layout-sidebar-left',
      'codicon-layout-panel',
      'codicon-layout-sidebar-right-off',
    ],
    layoutControlIconsPainted: true,
    layoutControlWidth: 22,
    layoutDividerCount: 0,
    menuLabels: [],
    platform: 'windows',
    searchIconPainted: true,
    syncBadgeCount: 0,
    secondarySidebarDisabled: true,
    topActionCount: 6,
    trafficLightCount: 0,
    trafficLightInteractiveCount: 0,
    warningBadgeCount: 1,
    windowControlCount: 3,
    windowControlInteractiveCount: 1,
  });
  const windowsNarrowControlFidelity = await readWindowsControlFidelity(windowsChromePage);
  assert.deepEqual(windowsNarrowControlFidelity, windowsControlFidelity);
  const narrowTitlebarFidelity = await readTitlebarFidelity(windowsChromePage);
  assert.equal(narrowTitlebarFidelity.commandCenterHeight, 22);
  assert.equal(narrowTitlebarFidelity.commandCenterLabel, 'DOCode');
  assert.equal(narrowTitlebarFidelity.commandCenterSearchIconCount, 0);
  assert.equal(narrowTitlebarFidelity.backInCenter, true);
  assert.equal(narrowTitlebarFidelity.forwardInCenter, true);
  assert.equal(narrowTitlebarFidelity.commandCenterWidth > 0, true);
  await windowsChromePage.screenshot({
    path: path.join(platformChromeEvidenceDir, 'workbench-windows-narrow.png'),
  });
  await windowsPlatformSession.detach();
  await windowsChromePage.close();
  const topicListAccessibility = await auditDomSemantics(
    topicListFixturePage,
    '[data-docode-workbench-root]',
  );
  assert.deepEqual(
    {
      duplicateIds: topicListAccessibility.duplicateIds,
      liveRegionsWithControls: topicListAccessibility.liveRegionsWithControls,
      missingNames: topicListAccessibility.missingNames,
      missingReferences: topicListAccessibility.missingReferences,
      unnamedGenericLabels: topicListAccessibility.unnamedGenericLabels,
    },
    {
      duplicateIds: [],
      liveRegionsWithControls: [],
      missingNames: [],
      missingReferences: [],
      unnamedGenericLabels: [],
    },
  );
  const topicListAx = await readAxSummary(topicListFixturePage);
  assertAxNode(topicListAx, 'region', 'DOCode workbench');
  assertAxNode(topicListAx, 'main', 'Editor region');
  assertAxNode(topicListAx, 'list', 'Topic list document');
  assertAxNode(topicListAx, 'contentinfo', 'DOCode status');
  const readTopicContrast = await readContrast(
    topicListFixturePage,
    '.docode-topic-list__entry[data-read-state="read"] .docode-topic-list__string',
    '.docode-topic-list__scroll',
  );
  assert(contrastRatio(readTopicContrast) >= 4.5);
  const topicListTargets = await readTargetSizes(topicListFixturePage, {
    panelTab: '.docode-workbench__panel-tab:not(:disabled)',
    quickOpen: '.docode-workbench__command-center',
    topic: '.docode-topic-list__topic-link',
  });
  assert(topicListTargets.topic.height >= 20 && topicListTargets.topic.width >= 22);
  assert(
    Object.entries(topicListTargets)
      .filter(([name]) => name !== 'topic')
      .every(([, { height, width }]) => height >= 22 && width >= 22),
  );
  await topicListFixturePage.screenshot({
    path: path.join(accessibilityEvidenceDir, 'topic-list-semantics.png'),
  });
  const topicListScroll = topicListFixturePage.getByRole('list', {
    name: 'Topic list document',
  });
  const expectedListScrollTop = await topicListScroll.evaluate((surface) => {
    surface.scrollTop = 72;
    globalThis.__docodeListScrollProbe = surface;
    return surface.scrollTop;
  });
  const listModeToolbarRemoval = await topicListFixturePage
    .locator('[data-docode-workbench-root]')
    .evaluate((root) => {
      const scroll = root.querySelector('.docode-topic-list__scroll');
      const panel = root.querySelector('.docode-workbench__panel');
      const status = root.querySelector('.docode-workbench__statusbar');
      if (
        !(scroll instanceof HTMLElement) ||
        !(panel instanceof HTMLElement) ||
        !(status instanceof HTMLElement)
      ) {
        throw new Error('Missing topic-list workbench elements.');
      }
      return {
        modeButtonCount: root.querySelectorAll('.docode-workbench__mode-button').length,
        modeToolbarCount: root.querySelectorAll('.docode-workbench__mode-toolbar').length,
        panelDisplay: getComputedStyle(panel).display,
        sameScrollContainer: globalThis.__docodeListScrollProbe === scroll,
        scrollTop: scroll.scrollTop,
        statusDisplay: getComputedStyle(status).display,
      };
    });
  assert.deepEqual(listModeToolbarRemoval, {
    modeButtonCount: 0,
    modeToolbarCount: 0,
    panelDisplay: 'grid',
    sameScrollContainer: true,
    scrollTop: expectedListScrollTop,
    statusDisplay: 'flex',
  });
  await topicListFixturePage.screenshot({
    path: path.join(readingModeEvidenceDir, 'list-mode-toolbar-removed.png'),
  });
  const firstTopicLink = topicListFixturePage.getByRole('link', {
    name: 'Open topic from post: Synthetic topic 1',
    exact: true,
  });
  assert.equal(await firstTopicLink.getAttribute('data-route-href'), topicOpeningFixtureUrl);
  assert.equal(await firstTopicLink.getAttribute('href'), null);
  assert.equal(await firstTopicLink.getAttribute('tabindex'), '0');
  assert.equal(await topicListFixturePage.locator('.docode-topic-list__topic-link').count(), 36);
  const topicListPrimaryModifier = await readPrimaryModifier(topicListFixturePage);
  await firstTopicLink.hover();
  assert.deepEqual(
    await firstTopicLink.evaluate((element) => {
      const style = getComputedStyle(element);
      return { color: style.color, textDecoration: style.textDecorationLine };
    }),
    { color: 'rgb(220, 220, 170)', textDecoration: 'none' },
  );
  await topicListFixturePage.keyboard.down(topicListPrimaryModifier);
  await topicListFixturePage
    .locator('.docode-topic-list__scroll[data-definition-modifier="true"]')
    .waitFor();
  assert.deepEqual(
    await firstTopicLink.evaluate((element) => {
      const style = getComputedStyle(element);
      return { color: style.color, cursor: style.cursor, textDecoration: style.textDecorationLine };
    }),
    { color: 'rgb(77, 170, 252)', cursor: 'pointer', textDecoration: 'underline' },
  );
  await topicListFixturePage.screenshot({ path: path.join(evidenceDir, 'topic-list-hover.png') });
  await topicListFixturePage.keyboard.up(topicListPrimaryModifier);
  await topicListFixturePage.keyboard.press('Tab');
  await firstTopicLink.focus();
  assert.equal(
    await firstTopicLink.evaluate((element) => getComputedStyle(element).outlineColor),
    'rgb(0, 120, 212)',
  );
  assert.deepEqual(await readActiveTopicLine(topicListFixturePage), {
    activeLineBackground: 'rgb(42, 45, 46)',
    activeLineFocusRing: true,
    activeLineNumber: '16',
    activeLineNumberColor: 'rgb(204, 204, 204)',
    focusedTopicId: '42',
    selectedTopicId: '42',
  });
  await firstTopicLink.press('ArrowDown');
  assert.deepEqual(await readActiveTopicLine(topicListFixturePage), {
    activeLineBackground: 'rgb(42, 45, 46)',
    activeLineFocusRing: true,
    activeLineNumber: '24',
    activeLineNumberColor: 'rgb(204, 204, 204)',
    focusedTopicId: '43',
    selectedTopicId: '43',
  });
  await topicListFixturePage.locator('[data-docode-topic-link="43"]').press('End');
  assert.deepEqual(await readActiveTopicLine(topicListFixturePage), {
    activeLineBackground: 'rgb(42, 45, 46)',
    activeLineFocusRing: true,
    activeLineNumber: '296',
    activeLineNumberColor: 'rgb(204, 204, 204)',
    focusedTopicId: '77',
    selectedTopicId: '77',
  });
  await topicListFixturePage.screenshot({
    path: path.join(evidenceDir, 'topic-list-keyboard-end.png'),
  });
  await topicListFixturePage.locator('[data-docode-topic-link="77"]').press('Home');
  assert.equal(
    await topicListFixturePage.evaluate(() => document.activeElement?.id),
    'docode-topic-42',
  );
  assert.deepEqual(
    await topicListScroll.evaluate((element) => {
      const firstLine = element.querySelector('.docode-topic-list__line');
      return {
        lineWhiteSpace: firstLine ? getComputedStyle(firstLine).whiteSpace : null,
        overflowX: getComputedStyle(element).overflowX,
      };
    }),
    {
      lineWhiteSpace: 'pre',
      overflowX: 'auto',
    },
  );

  await firstTopicLink.click();
  assert.equal(topicListFixturePage.url(), topicListFixtureUrl);

  await firstTopicLink.press('Enter');
  assert.equal(topicListFixturePage.url(), topicListFixtureUrl);

  await firstTopicLink.click({ modifiers: [topicListPrimaryModifier] });
  await topicListFixturePage.waitForURL(topicOpeningFixtureUrl);
  await assertRuntimeOwnership(topicListFixturePage, true);
  await assertWorkbenchRouteChrome(topicListFixturePage, 'topic:42', 'Topic 42', 0);
  await topicListFixturePage.goBack({ waitUntil: 'domcontentloaded' });
  assert.equal(topicListFixturePage.url(), topicListFixtureUrl);
  await assertRuntimeOwnership(topicListFixturePage, true);
  await topicListFixturePage.getByRole('list', { name: 'Topic list document' }).waitFor();
  await firstTopicLink.press(`${topicListPrimaryModifier}+Enter`);
  await topicListFixturePage.waitForURL(topicOpeningFixtureUrl);
  await assertWorkbenchRouteChrome(topicListFixturePage, 'topic:42', 'Topic 42', 0);
  await topicListFixturePage.goBack({ waitUntil: 'domcontentloaded' });
  assert.equal(topicListFixturePage.url(), topicListFixtureUrl);
  await topicListFixturePage.getByRole('list', { name: 'Topic list document' }).waitFor();
  await topicListFixturePage.goForward({ waitUntil: 'domcontentloaded' });
  assert.equal(topicListFixturePage.url(), topicOpeningFixtureUrl);
  await assertWorkbenchRouteChrome(topicListFixturePage, 'topic:42', 'Topic 42', 0);
  await topicListFixturePage.goBack({ waitUntil: 'domcontentloaded' });
  assert.equal(topicListFixturePage.url(), topicListFixtureUrl);
  await topicListFixturePage.getByRole('list', { name: 'Topic list document' }).waitFor();

  await topicListScroll.evaluate((element) => {
    element.scrollTop = 180;
    element.dispatchEvent(new Event('scroll'));
  });
  await topicListFixturePage.waitForFunction(
    () =>
      document.querySelector('.docode-topic-list__gutter-content')?.style.transform ===
      'translate3d(0px, -180px, 0px)',
  );
  await firstTopicLink.click({ modifiers: [topicListPrimaryModifier] });
  await topicListFixturePage.waitForURL(topicOpeningFixtureUrl);
  await assertRuntimeOwnership(topicListFixturePage, true);
  await topicListFixturePage.goBack({ waitUntil: 'domcontentloaded' });
  assert.equal(topicListFixturePage.url(), topicListFixtureUrl);
  await topicListFixturePage.getByRole('list', { name: 'Topic list document' }).waitFor();
  await topicListFixturePage.waitForFunction(
    () => document.querySelector('.docode-topic-list__scroll')?.scrollTop === 180,
  );
  assert.equal(
    await topicListFixturePage
      .locator('.docode-topic-list__gutter-content')
      .evaluate((gutter) => gutter.style.transform),
    'translate3d(0px, -180px, 0px)',
  );
  await topicListFixturePage.screenshot({
    path: path.join(evidenceDir, 'topic-list-viewport-restored.png'),
  });

  await topicListScroll.evaluate((element) => {
    element.scrollTop = 240;
    element.dispatchEvent(new Event('scroll'));
  });
  await topicListFixturePage.waitForFunction(
    () =>
      document.querySelector('.docode-topic-list__gutter-content')?.style.transform ===
      'translate3d(0px, -240px, 0px)',
  );
  await topicListFixturePage.screenshot({
    path: path.join(evidenceDir, 'topic-list-scrolled.png'),
  });

  await topicListFixturePage.evaluate(() => {
    window.history.pushState({}, '', '/hot?docode_fixture=1');
  });
  await assertTopicListRoute(topicListFixturePage, 'hot', 'Hot topics', 302);
  await topicListFixturePage.screenshot({ path: path.join(evidenceDir, 'topic-list-hot.png') });

  await topicListFixturePage.evaluate(() => {
    window.history.pushState({}, '', '/c/develop/4?docode_fixture=1');
  });
  await assertTopicListRoute(topicListFixturePage, 'category:develop', 'Category develop', 302);
  await topicListFixturePage.screenshot({
    path: path.join(evidenceDir, 'topic-list-category.png'),
  });

  const longListStart = await topicListFixturePage.evaluate((rows) => {
    const body = document.querySelector('table.topic-list tbody');
    if (!body) throw new Error('Missing synthetic topic-list body.');
    const started = performance.now();
    body.innerHTML = rows;
    return started;
  }, topicListRowsFixture(500));
  await topicListFixturePage.waitForFunction(
    () => document.querySelectorAll('.docode-topic-list__line').length === 4_014,
  );
  const longListRenderMs = await topicListFixturePage.evaluate(
    (started) => performance.now() - started,
    longListStart,
  );
  assert(Number.isFinite(longListRenderMs));
  assert(longListRenderMs < 5_000, `The 2,500-line document took ${longListRenderMs}ms to render.`);
  await topicListFixturePage
    .getByRole('listitem', { name: 'Lines 4006–4013: Synthetic topic 500' })
    .waitFor();
  await topicListScroll.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    element.dispatchEvent(new Event('scroll'));
  });
  await topicListFixturePage.screenshot({
    path: path.join(evidenceDir, 'topic-list-long-end.png'),
  });

  const narrowTopicListPage = await context.newPage();
  await narrowTopicListPage.setViewportSize({ width: 420, height: 640 });
  await narrowTopicListPage.goto(topicListFixtureUrl, { waitUntil: 'domcontentloaded' });
  await assertRuntimeOwnership(narrowTopicListPage, true);
  await narrowTopicListPage.getByRole('list', { name: 'Topic list document' }).waitFor();
  assert.deepEqual(await readWorkbenchGeometry(narrowTopicListPage), {
    editorHeight: 499,
    gutterWidth: 36,
    height: 640,
    minimapVisible: false,
    minimapWidth: 0,
    panelHeight: 80,
    sashHeight: 4,
    statusBarHeight: 22,
    width: 420,
  });
  assert.deepEqual(
    await narrowTopicListPage.locator('.docode-topic-list__scroll').evaluate((scroll) => ({
      firstLineHeight:
        scroll.querySelector('.docode-topic-list__line')?.getBoundingClientRect().height ?? 0,
      horizontalOverflow: scroll.scrollWidth > scroll.clientWidth,
    })),
    { firstLineHeight: 20, horizontalOverflow: true },
  );
  await narrowTopicListPage.screenshot({
    path: path.join(evidenceDir, 'topic-list-narrow.png'),
  });
  await narrowTopicListPage
    .getByRole('button', { name: 'Search files and Linux DO topics' })
    .click();
  await narrowTopicListPage.waitForTimeout(300);
  const narrowQuickOpen = await readQuickOpen(narrowTopicListPage);
  assert.deepEqual(
    {
      descriptionDisplay: narrowQuickOpen.descriptionDisplay,
      inputFocused: narrowQuickOpen.inputFocused,
      top: narrowQuickOpen.top,
      width: narrowQuickOpen.width,
    },
    { descriptionDisplay: 'none', inputFocused: true, top: 8, width: 404 },
  );
  await narrowTopicListPage.screenshot({
    path: path.join(evidenceDir, 'quick-open-narrow.png'),
  });
  assert.deepEqual(
    {
      closeButtonCount: narrowQuickOpen.closeButtonCount,
      inputLeftInset: narrowQuickOpen.inputLeftInset,
      inputRightInset: narrowQuickOpen.inputRightInset,
      itemLeftInset: narrowQuickOpen.itemLeftInset,
      itemRightInset: narrowQuickOpen.itemRightInset,
    },
    {
      closeButtonCount: 0,
      inputLeftInset: 7,
      inputRightInset: 7,
      itemLeftInset: 7,
      itemRightInset: 7,
    },
  );
  await narrowTopicListPage
    .getByRole('combobox', { name: 'Search open views, loaded topics, and Linux DO' })
    .focus();
  await narrowTopicListPage
    .getByRole('combobox', { name: 'Search open views, loaded topics, and Linux DO' })
    .press('Escape');
  await narrowTopicListPage.getByRole('button', { name: 'Open Command Palette' }).click();
  await narrowTopicListPage.waitForTimeout(300);
  const narrowCommandPalette = await readQuickOpen(narrowTopicListPage);
  assert.deepEqual(
    {
      descriptionDisplay: narrowCommandPalette.descriptionDisplay,
      inputFocused: narrowCommandPalette.inputFocused,
      optionCount: narrowCommandPalette.optionCount,
      top: narrowCommandPalette.top,
      width: narrowCommandPalette.width,
    },
    { descriptionDisplay: 'none', inputFocused: true, optionCount: 9, top: 8, width: 404 },
  );
  await narrowTopicListPage.screenshot({
    path: path.join(evidenceDir, 'command-palette-narrow.png'),
  });
  await narrowTopicListPage
    .getByRole('combobox', { name: 'Type the name of a command' })
    .press('Escape');
  await narrowTopicListPage.close();

  const quickOpenPage = await context.newPage();
  await quickOpenPage.goto(topicListFixtureUrl, { waitUntil: 'domcontentloaded' });
  await assertRuntimeOwnership(quickOpenPage, true);
  await quickOpenPage.getByRole('list', { name: 'Topic list document' }).waitFor();
  await installSyntheticTabNavigation(quickOpenPage);
  const quickOpenTrigger = quickOpenPage.getByRole('button', {
    name: 'Search files and Linux DO topics',
  });
  await quickOpenTrigger.hover();
  const pointerTooltip = quickOpenPage.getByRole('tooltip');
  await pointerTooltip.waitFor({ state: 'visible', timeout: 2_000 });
  await quickOpenPage.waitForTimeout(120);
  const pointerTooltipFidelity = await pointerTooltip.evaluate((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      animationDuration: style.animationDuration,
      background: style.backgroundColor,
      borderColor: style.borderColor,
      borderRadius: style.borderRadius,
      bottom: rect.bottom,
      left: rect.left,
      maxWidth: style.maxWidth,
      right: rect.right,
      text: element.textContent?.trim() ?? '',
      top: rect.top,
    };
  });
  assert.deepEqual(
    {
      animationDuration: pointerTooltipFidelity.animationDuration,
      background: pointerTooltipFidelity.background,
      borderColor: pointerTooltipFidelity.borderColor,
      borderRadius: pointerTooltipFidelity.borderRadius,
      maxWidth: pointerTooltipFidelity.maxWidth,
    },
    {
      animationDuration: '0.1s',
      background: 'rgb(37, 37, 38)',
      borderColor: 'rgb(69, 69, 69)',
      borderRadius: '8px',
      maxWidth: '500px',
    },
  );
  assert.match(pointerTooltipFidelity.text, /^Quick Open/u);
  assert(pointerTooltipFidelity.left >= 8 && pointerTooltipFidelity.right <= 1272);
  assert(pointerTooltipFidelity.top >= 8 && pointerTooltipFidelity.bottom <= 792);
  await quickOpenPage.screenshot({
    path: path.join(transientFidelityEvidenceDir, 'tooltip-pointer.png'),
  });
  await quickOpenPage.mouse.move(1, 1);
  await pointerTooltip.waitFor({ state: 'hidden' });
  await quickOpenTrigger.click();
  await quickOpenPage.waitForTimeout(300);
  const quickOpenInput = quickOpenPage.getByRole('combobox', {
    name: 'Search open views, loaded topics, and Linux DO',
  });
  const quickOpenReady = await readQuickOpen(quickOpenPage);
  assert.deepEqual(
    {
      background: quickOpenReady.background,
      groupLabels: quickOpenReady.groupLabels,
      inputBackground: quickOpenReady.inputBackground,
      inputFocused: quickOpenReady.inputFocused,
      optionCount: quickOpenReady.optionCount,
      rowHeight: quickOpenReady.rowHeight,
      selectedBackground: quickOpenReady.selectedBackground,
      selectedLabel: quickOpenReady.selectedLabel,
      top: quickOpenReady.top,
      width: quickOpenReady.width,
    },
    {
      background: 'rgb(37, 37, 38)',
      groupLabels: ['Open Views', 'Latest Topics'],
      inputBackground: 'rgb(49, 49, 49)',
      inputFocused: true,
      optionCount: 37,
      rowHeight: 22,
      selectedBackground: 'rgb(4, 57, 94)',
      selectedLabel: 'latest',
      top: 6,
      width: 600,
    },
  );
  const quickInputFidelity = await quickOpenPage
    .locator('.docode-quick-open')
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        animationDuration: style.animationDuration,
        animationTimingFunction: style.animationTimingFunction,
        borderRadius: style.borderRadius,
        boxShadow: style.boxShadow,
        top: element.getBoundingClientRect().top,
      };
    });
  assert.deepEqual(quickInputFidelity, {
    animationDuration: '0.25s',
    animationTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
    borderRadius: '12px',
    boxShadow: 'rgba(0, 0, 0, 0.15) 0px 0px 20px 0px',
    top: 6,
  });
  await quickOpenPage.screenshot({ path: path.join(evidenceDir, 'quick-open-ready.png') });
  await quickOpenPage.screenshot({
    path: path.join(transientFidelityEvidenceDir, 'quick-open-ready.png'),
  });
  assert.deepEqual(
    {
      closeButtonCount: quickOpenReady.closeButtonCount,
      countVisuallyHidden: quickOpenReady.countVisuallyHidden,
      inputLeftInset: quickOpenReady.inputLeftInset,
      inputRightInset: quickOpenReady.inputRightInset,
      itemLeftInset: quickOpenReady.itemLeftInset,
      itemRightInset: quickOpenReady.itemRightInset,
      selectedOutlineStyle: quickOpenReady.selectedOutlineStyle,
    },
    {
      closeButtonCount: 0,
      countVisuallyHidden: true,
      inputLeftInset: 7,
      inputRightInset: 7,
      itemLeftInset: 7,
      itemRightInset: 7,
      selectedOutlineStyle: 'none',
    },
  );
  const quickInputAccessibility = await auditDomSemantics(
    quickOpenPage,
    '[data-docode-workbench-root]',
  );
  assert.deepEqual(
    {
      liveRegionsWithControls: quickInputAccessibility.liveRegionsWithControls,
      missingNames: quickInputAccessibility.missingNames,
      missingReferences: quickInputAccessibility.missingReferences,
      unnamedGenericLabels: quickInputAccessibility.unnamedGenericLabels,
    },
    {
      liveRegionsWithControls: [],
      missingNames: [],
      missingReferences: [],
      unnamedGenericLabels: [],
    },
  );
  const quickInputAx = await readAxSummary(quickOpenPage);
  assertAxNode(quickInputAx, 'dialog', 'Quick Open');
  assertAxNode(quickInputAx, 'combobox', 'Search open views, loaded topics, and Linux DO');
  assertAxNode(quickInputAx, 'listbox', '');
  assertAxNode(quickInputAx, 'group', 'Open Views');
  assertAxNode(quickInputAx, 'option', /latest/u);
  const quickInputTargets = await readTargetSizes(quickOpenPage, {
    input: '.docode-quick-open__input',
    option: '.docode-quick-open__item',
  });
  assert(Object.values(quickInputTargets).every(({ height }) => height >= 22));
  await quickOpenPage.screenshot({
    path: path.join(accessibilityEvidenceDir, 'quick-input-semantics.png'),
  });
  await quickOpenInput.fill('Synthetic topic 12');
  await quickOpenPage.getByRole('option').waitFor();
  const quickOpenFiltered = await readQuickOpen(quickOpenPage);
  assert.equal(quickOpenFiltered.optionCount, 1);
  assert.equal(quickOpenFiltered.selectedLabel, 'Synthetic topic 12');
  assert.equal(
    await quickOpenPage.locator('.docode-quick-open__item-label strong').textContent(),
    'Synthetic topic 12',
  );
  await quickOpenPage.screenshot({ path: path.join(evidenceDir, 'quick-open-filtered.png') });
  await quickOpenInput.press('Enter');
  await quickOpenPage.waitForURL('https://linux.do/t/synthetic-topic-12/53');
  await quickOpenPage.getByRole('dialog', { name: 'Quick Open' }).waitFor({ state: 'detached' });
  await waitForActiveOpenView(quickOpenPage, 'topic:53', 2);
  await quickOpenPage.goBack();
  await quickOpenPage.waitForURL(topicListFixtureUrl);
  await quickOpenPage.getByRole('list', { name: 'Topic list document' }).waitFor();

  await quickOpenTrigger.click();
  await quickOpenInput.fill('Synthetic topic 2');
  const topicTwoOption = quickOpenPage.getByRole('option', {
    name: /^Synthetic topic 2 Topic 43/u,
  });
  await topicTwoOption.hover();
  assert.equal(await topicTwoOption.getAttribute('aria-selected'), 'true');
  await topicTwoOption.click();
  await quickOpenPage.waitForURL('https://linux.do/t/synthetic-topic-2/43');
  await waitForActiveOpenView(quickOpenPage, 'topic:43', 3);
  await quickOpenPage.goBack();
  await quickOpenPage.waitForURL(topicListFixtureUrl);

  await quickOpenTrigger.click();
  await quickOpenInput.fill('Synthetic topic 3');
  await quickOpenPage.evaluate(() => {
    globalThis.__docodeCommandNavigationOverride = 'https://linux.do/top';
  });
  await quickOpenInput.press('Enter');
  await quickOpenPage.waitForURL('https://linux.do/top');
  await quickOpenPage
    .getByRole('alert')
    .filter({ hasText: 'The route changed before this item could open.' })
    .waitFor();
  await quickOpenPage.screenshot({
    path: path.join(evidenceDir, 'quick-open-navigation-error.png'),
  });
  await quickOpenInput.press('Escape');
  await quickOpenPage.goBack();
  await quickOpenPage.waitForURL(topicListFixtureUrl);

  await quickOpenTrigger.click();
  await quickOpenInput.fill('no matching topic');
  await quickOpenPage
    .getByText('No matching open views, loaded topics, or Linux DO results.', { exact: true })
    .waitFor();
  await quickOpenPage.screenshot({ path: path.join(evidenceDir, 'quick-open-empty-filter.png') });
  await quickOpenInput.fill('');
  await quickOpenInput.press('Tab');
  assert.equal(
    await quickOpenInput.evaluate((element) => element === document.activeElement),
    true,
  );
  await quickOpenPage.keyboard.press('Shift+Tab');
  assert.equal(
    await quickOpenInput.evaluate((element) => element === document.activeElement),
    true,
  );
  await quickOpenInput.press('Escape');
  await quickOpenPage.waitForFunction(
    () => document.activeElement?.getAttribute('aria-label') === 'Search files and Linux DO topics',
  );
  assert.equal(
    await quickOpenTrigger.evaluate((element) => element === document.activeElement),
    true,
  );
  await quickOpenPage.emulateMedia({ reducedMotion: 'reduce' });
  await quickOpenTrigger.click();
  const reducedQuickInputAnimationDuration = await quickOpenPage
    .locator('.docode-quick-open')
    .evaluate((element) => getComputedStyle(element).animationDuration);
  assert.equal(reducedQuickInputAnimationDuration, '0s');
  await quickOpenPage.screenshot({
    path: path.join(transientFidelityEvidenceDir, 'quick-open-reduced-motion.png'),
  });
  await quickOpenPage
    .getByRole('combobox', { name: 'Search open views, loaded topics, and Linux DO' })
    .press('Escape');
  await quickOpenPage.emulateMedia({ reducedMotion: 'no-preference' });
  await quickOpenPage.close();

  const commandPalettePage = await context.newPage();
  await commandPalettePage.goto(topicListFixtureUrl, { waitUntil: 'domcontentloaded' });
  await assertRuntimeOwnership(commandPalettePage, true);
  await commandPalettePage.getByRole('list', { name: 'Topic list document' }).waitFor();
  await installSyntheticTabNavigation(commandPalettePage);
  const commandPaletteTrigger = commandPalettePage.getByRole('button', {
    name: 'Open Command Palette',
  });
  await commandPaletteTrigger.click();
  await commandPalettePage.waitForTimeout(300);
  const commandPaletteInput = commandPalettePage.getByRole('combobox', {
    name: 'Type the name of a command',
  });
  const commandPaletteReady = await readQuickOpen(commandPalettePage);
  assert.deepEqual(
    {
      background: commandPaletteReady.background,
      groupLabels: commandPaletteReady.groupLabels,
      inputBackground: commandPaletteReady.inputBackground,
      inputFocused: commandPaletteReady.inputFocused,
      optionCount: commandPaletteReady.optionCount,
      rowHeight: commandPaletteReady.rowHeight,
      selectedBackground: commandPaletteReady.selectedBackground,
      selectedLabel: commandPaletteReady.selectedLabel,
      top: commandPaletteReady.top,
      width: commandPaletteReady.width,
    },
    {
      background: 'rgb(37, 37, 38)',
      groupLabels: ['DOCode', 'Linux DO'],
      inputBackground: 'rgb(49, 49, 49)',
      inputFocused: true,
      optionCount: 9,
      rowHeight: 22,
      selectedBackground: 'rgb(4, 57, 94)',
      selectedLabel: 'Show Quick Open',
      top: 6,
      width: 600,
    },
  );
  assert.equal(await commandPalettePage.locator('.docode-quick-open__prefix').textContent(), '>');
  assert.deepEqual(
    {
      closeButtonCount: commandPaletteReady.closeButtonCount,
      countVisuallyHidden: commandPaletteReady.countVisuallyHidden,
      inputLeftInset: commandPaletteReady.inputLeftInset,
      inputRightInset: commandPaletteReady.inputRightInset,
      itemLeftInset: commandPaletteReady.itemLeftInset,
      itemRightInset: commandPaletteReady.itemRightInset,
      selectedOutlineStyle: commandPaletteReady.selectedOutlineStyle,
    },
    {
      closeButtonCount: 0,
      countVisuallyHidden: true,
      inputLeftInset: 7,
      inputRightInset: 7,
      itemLeftInset: 7,
      itemRightInset: 7,
      selectedOutlineStyle: 'none',
    },
  );
  await commandPalettePage.screenshot({
    path: path.join(evidenceDir, 'command-palette-ready.png'),
  });
  await commandPalettePage.screenshot({
    path: path.join(transientFidelityEvidenceDir, 'command-palette-ready.png'),
  });

  await commandPaletteInput.fill('hide bottom');
  const commandPaletteFiltered = await readQuickOpen(commandPalettePage);
  assert.equal(commandPaletteFiltered.optionCount, 1);
  assert.equal(commandPaletteFiltered.selectedLabel, 'View: Hide Bottom Panel');
  await commandPalettePage.screenshot({
    path: path.join(evidenceDir, 'command-palette-filtered.png'),
  });
  await commandPaletteInput.press('Enter');
  await commandPalettePage.getByRole('dialog', { name: 'Command Palette' }).waitFor({
    state: 'detached',
  });
  assert.equal(
    await commandPalettePage.locator('.docode-workbench').getAttribute('data-panel-open'),
    'false',
  );
  await commandPalettePage.waitForFunction(
    () => document.activeElement?.getAttribute('aria-label') === 'Show Bottom Panel',
  );
  await commandPalettePage.getByRole('button', { name: 'Show Bottom Panel' }).click();

  await commandPaletteTrigger.click();
  await commandPaletteInput.fill('show terminal');
  await commandPaletteInput.press('Enter');
  await commandPalettePage.getByRole('dialog', { name: 'Command Palette' }).waitFor({
    state: 'detached',
  });
  await commandPalettePage.waitForFunction(
    () => document.activeElement?.getAttribute('aria-label') === 'Linux DO command input',
  );
  await commandPalettePage.screenshot({
    path: path.join(keyboardEvidenceDir, 'palette-command-focus.png'),
  });

  await commandPaletteTrigger.click();
  await commandPaletteInput.fill('no matching command');
  await commandPalettePage.getByText('No matching commands.', { exact: true }).waitFor();
  await commandPalettePage.screenshot({
    path: path.join(evidenceDir, 'command-palette-empty-filter.png'),
  });
  await commandPaletteInput.fill('');
  await commandPaletteInput.press('Tab');
  assert.equal(
    await commandPaletteInput.evaluate((element) => element === document.activeElement),
    true,
  );
  await commandPalettePage.keyboard.press('Shift+Tab');
  assert.equal(
    await commandPaletteInput.evaluate((element) => element === document.activeElement),
    true,
  );
  await commandPaletteInput.press('Escape');
  await commandPalettePage.waitForFunction(
    () => document.activeElement?.getAttribute('aria-label') === 'Open Command Palette',
  );

  await commandPaletteTrigger.click();
  await commandPaletteInput.fill('hot topics');
  await captureNextCommandNavigation(commandPalettePage);
  await commandPaletteInput.press('Enter');
  assert.equal(
    await commandPalettePage
      .getByRole('dialog', { name: 'Command Palette' })
      .getAttribute('aria-busy'),
    'true',
  );
  await commandPalettePage.screenshot({
    path: path.join(evidenceDir, 'command-palette-pending.png'),
  });
  await releaseCapturedCommandNavigation(commandPalettePage);
  await commandPalettePage.waitForURL('https://linux.do/hot');
  await commandPalettePage.getByRole('dialog', { name: 'Command Palette' }).waitFor({
    state: 'detached',
  });
  await commandPalettePage.goBack();
  await commandPalettePage.waitForURL(topicListFixtureUrl);
  await commandPalettePage.getByRole('list', { name: 'Topic list document' }).waitFor();

  await commandPaletteTrigger.click();
  await commandPaletteInput.fill('hot topics');
  await commandPalettePage.evaluate(() => {
    globalThis.__docodeCommandNavigationOverride = 'https://linux.do/top';
  });
  await commandPaletteInput.press('Enter');
  await commandPalettePage.waitForURL('https://linux.do/top');
  await commandPalettePage
    .getByRole('alert')
    .filter({ hasText: 'Navigation context changed before the target was confirmed.' })
    .waitFor();
  await commandPalettePage.screenshot({
    path: path.join(evidenceDir, 'command-palette-error.png'),
  });
  await commandPaletteInput.press('Escape');
  await commandPalettePage.goBack();
  await commandPalettePage.waitForURL(topicListFixtureUrl);

  await commandPaletteTrigger.click();
  await commandPaletteInput.fill('quick open');
  await commandPaletteInput.press('Enter');
  const transitionedQuickOpen = commandPalettePage.getByRole('combobox', {
    name: 'Search open views, loaded topics, and Linux DO',
  });
  await transitionedQuickOpen.waitFor();
  assert.equal(
    await commandPalettePage.getByRole('dialog', { name: 'Command Palette' }).count(),
    0,
  );
  await transitionedQuickOpen.press('Escape');
  await commandPalettePage.waitForFunction(
    () => document.activeElement?.getAttribute('aria-label') === 'Open Command Palette',
  );
  await commandPalettePage.close();

  const keybindingPage = await context.newPage();
  await keybindingPage.goto(topicListFixtureUrl, { waitUntil: 'domcontentloaded' });
  await assertRuntimeOwnership(keybindingPage, true);
  const keybindingPrimary = await readPrimaryModifier(keybindingPage);
  const keybindingUsesMeta = keybindingPrimary === 'Meta';
  const keybindingShortcutLabels = keybindingUsesMeta
    ? ['⌘P', '⇧⌘P', '⌘`']
    : ['Ctrl+P', 'Ctrl+Shift+P', 'Ctrl+`'];
  const keybindingFocusTarget = keybindingPage.getByRole('link', {
    name: 'Open topic from post: Synthetic topic 1',
    exact: true,
  });
  await keybindingFocusTarget.focus();
  const quickOpenKey = keybindingPage.getByRole('button', {
    name: 'Search files and Linux DO topics',
  });
  const commandPaletteKey = keybindingPage.getByRole('button', {
    name: 'Open Command Palette',
  });
  assert.equal(await quickOpenKey.getAttribute('aria-keyshortcuts'), `${keybindingPrimary}+P`);
  assert.equal(
    await commandPaletteKey.getAttribute('aria-keyshortcuts'),
    `${keybindingPrimary}+Shift+P`,
  );
  assert.equal(
    await keybindingPage.getByRole('tab', { name: 'Terminal' }).getAttribute('aria-keyshortcuts'),
    `${keybindingPrimary}+\u0060`,
  );

  await keybindingPage.keyboard.press(`${keybindingPrimary}+P`);
  await keybindingPage.getByRole('dialog', { name: 'Quick Open' }).waitFor();
  await keybindingPage.screenshot({ path: path.join(evidenceDir, 'keybinding-quick-open.png') });
  await keybindingPage.keyboard.press('Escape');
  await keybindingPage.waitForFunction(
    () =>
      document.activeElement?.getAttribute('aria-label') ===
      'Open topic from post: Synthetic topic 1',
  );
  assert.equal(
    await keybindingFocusTarget.evaluate((element) => element === document.activeElement),
    true,
  );

  await keybindingPage.keyboard.press(`${keybindingPrimary}+Shift+P`);
  await keybindingPage.getByRole('dialog', { name: 'Command Palette' }).waitFor();
  assert.match(
    (await keybindingPage.getByRole('option', { name: /Show Quick Open/u }).textContent()) ?? '',
    keybindingUsesMeta ? /⌘P/u : /Ctrl\+P/u,
  );
  await keybindingPage.screenshot({
    path: path.join(evidenceDir, 'keybinding-command-palette.png'),
  });
  await keybindingPage.keyboard.press('Escape');
  await keybindingPage.waitForFunction(
    () =>
      document.activeElement?.getAttribute('aria-label') ===
      'Open topic from post: Synthetic topic 1',
  );
  assert.equal(
    await keybindingFocusTarget.evaluate((element) => element === document.activeElement),
    true,
  );

  await keybindingPage.keyboard.press(`${keybindingPrimary}+Backquote`);
  await keybindingPage.waitForFunction(
    () => document.querySelector('.docode-workbench')?.getAttribute('data-panel-open') === 'false',
  );
  const keybindingShowPanel = keybindingPage.getByRole('button', { name: 'Show Bottom Panel' });
  assert.equal(
    await keybindingShowPanel.evaluate((element) => element === document.activeElement),
    true,
  );
  await keybindingPage.screenshot({
    path: path.join(evidenceDir, 'keybinding-terminal-hidden.png'),
  });
  await keybindingPage.keyboard.press(`${keybindingPrimary}+Backquote`);
  const keybindingTerminalInput = keybindingPage.getByRole('combobox', {
    name: 'Linux DO command input',
  });
  await keybindingPage.waitForFunction(
    () => document.activeElement?.getAttribute('aria-label') === 'Linux DO command input',
  );
  await keybindingPage.screenshot({
    path: path.join(evidenceDir, 'keybinding-terminal-focused.png'),
  });
  assert.equal(
    await dispatchKeyboardProbe(
      keybindingPage,
      '.docode-terminal__input',
      'KeyP',
      keybindingUsesMeta ? { metaKey: true } : { ctrlKey: true },
    ),
    false,
  );
  assert.equal(await keybindingPage.getByRole('dialog').count(), 0);
  await keybindingTerminalInput.pressSequentially('plain typing');
  assert.equal(await keybindingTerminalInput.inputValue(), 'plain typing');
  await keybindingTerminalInput.fill('');
  await keybindingPage.keyboard.press(`${keybindingPrimary}+Backquote`);
  await keybindingPage.waitForFunction(
    () => document.querySelector('.docode-workbench')?.getAttribute('data-panel-open') === 'false',
  );

  const editableShortcutMatrix = await keybindingPage.evaluate((usesMeta) => {
    const composer = document.createElement('div');
    composer.id = 'reply-control';
    const composerInput = document.createElement('textarea');
    composer.append(composerInput);
    document.body.append(composer);
    const input = document.createElement('input');
    document.body.append(input);
    const probe = (target, code, init = {}) => {
      const event = new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        code,
        ...(usesMeta ? { metaKey: true } : { ctrlKey: true }),
        ...init,
      });
      target.dispatchEvent(event);
      return event.defaultPrevented;
    };
    const result = {
      altLeft: probe(document.body, 'ArrowLeft', {
        altKey: true,
        ctrlKey: false,
        metaKey: false,
      }),
      browserLocation: probe(document.body, 'KeyL'),
      composerPalette: probe(composerInput, 'KeyP', { shiftKey: true }),
      composerQuickOpen: probe(composerInput, 'KeyP'),
      composerTerminal: probe(composerInput, 'Backquote'),
      genericInput: probe(input, 'KeyP'),
      repeat: probe(document.body, 'KeyP', { repeat: true }),
    };
    composer.remove();
    input.remove();
    return result;
  }, keybindingUsesMeta);
  assert.deepEqual(editableShortcutMatrix, {
    altLeft: false,
    browserLocation: false,
    composerPalette: false,
    composerQuickOpen: false,
    composerTerminal: false,
    genericInput: false,
    repeat: false,
  });
  assert.equal(await keybindingPage.getByRole('dialog').count(), 0);
  await keybindingPage.screenshot({
    path: path.join(keyboardEvidenceDir, 'shortcut-conflict-matrix.png'),
  });

  await keybindingPage.evaluate(() => {
    window.history.pushState({}, '', '/unknown');
  });
  await keybindingPage.waitForFunction(
    () => document.querySelector('.docode-workbench')?.getAttribute('data-supported') === 'false',
  );
  assert.equal(
    await dispatchKeyboardProbe(
      keybindingPage,
      '.docode-workbench__status-items--left .docode-workbench__status-item--view',
      'KeyP',
      keybindingUsesMeta ? { metaKey: true } : { ctrlKey: true },
    ),
    false,
  );
  assert.equal(await keybindingPage.getByRole('dialog').count(), 0);
  await keybindingPage.goBack();
  await keybindingPage.waitForURL(topicListFixtureUrl);
  await keybindingPage.close();

  const tabFixturePage = await context.newPage();
  await tabFixturePage.goto(topicListFixtureUrl, { waitUntil: 'domcontentloaded' });
  await assertRuntimeOwnership(tabFixturePage, true);
  await tabFixturePage.getByRole('list', { name: 'Topic list document' }).waitFor();
  await installSyntheticTabNavigation(tabFixturePage);
  const tabFixturePrimaryModifier = await readPrimaryModifier(tabFixturePage);
  await tabFixturePage
    .getByRole('link', { name: 'Open topic from post: Synthetic topic 1', exact: true })
    .click({ modifiers: [tabFixturePrimaryModifier] });
  await tabFixturePage.waitForFunction(
    () =>
      document.querySelectorAll('.docode-workbench__tabs [role="tab"]').length === 2 &&
      document
        .querySelector('.docode-workbench__tab[data-active="true"]')
        ?.getAttribute('data-read-state') === 'unread',
  );
  await tabFixturePage.evaluate(() => {
    window.history.pushState({}, '', '/search?q=codex');
    window.history.pushState({}, '', '/u/fixture-user/activity/topics');
    window.history.pushState({}, '', '/hot');
    window.history.pushState({}, '', '/t/renamed-topic/42/7');
  });
  await tabFixturePage.waitForFunction(
    () =>
      document.querySelectorAll('.docode-workbench__tabs [role="tab"]').length === 5 &&
      document
        .querySelector(
          '.docode-workbench__tab[data-active="true"] [role="tab"] .docode-workbench__tab-label',
        )
        ?.textContent?.trim() === 'topic:42',
  );
  const openViewTabs = await readOpenViewTabs(tabFixturePage);
  assert.deepEqual(
    openViewTabs.map(({ label }) => label),
    ['latest', 'topic:42', 'search:codex', '@fixture-user', 'hot'],
  );
  assert.equal(openViewTabs.find(({ label }) => label === 'topic:42')?.href.endsWith('/7'), true);
  assert.equal(openViewTabs.find(({ label }) => label === 'topic:42')?.readState, 'unread');
  assert.equal(openViewTabs.filter(({ dirty }) => dirty).length, 0);
  const tabFitNormal = await readTabFidelity(tabFixturePage);
  assert(
    tabFitNormal.every(({ width }) => width >= 120 && width < 160),
    `Expected fit-sized tabs to use a 120px base and expand only for content: ${JSON.stringify(tabFitNormal)}`,
  );
  assert.equal(tabFitNormal.find(({ label }) => label === 'latest')?.width, 120);
  assert.equal(tabFitNormal.find(({ label }) => label === 'hot')?.width, 120);
  assert.equal(tabFitNormal.find(({ active }) => active)?.closeOpacity, '1');
  assert(
    tabFitNormal.filter(({ active }) => !active).every(({ closeOpacity }) => closeOpacity === '0'),
  );
  await tabFixturePage.screenshot({ path: path.join(evidenceDir, 'tabs-multiple.png') });
  await tabFixturePage.screenshot({
    path: path.join(fidelityRefinementEvidenceDir, 'tabs-fit-normal.png'),
  });
  const hoverTabContainer = tabFixturePage
    .locator('.docode-workbench__tab')
    .filter({ has: tabFixturePage.getByRole('tab', { name: 'search:codex' }) });
  await hoverTabContainer.hover();
  const tabFitHover = await readTabFidelity(tabFixturePage);
  assert.equal(tabFitHover.find(({ label }) => label === 'search:codex')?.closeOpacity, '1');
  await tabFixturePage.screenshot({
    path: path.join(fidelityRefinementEvidenceDir, 'tabs-fit-hover.png'),
  });
  const historyActivation = [];
  await tabFixturePage.goBack();
  await waitForActiveOpenView(tabFixturePage, 'hot', 5);
  historyActivation.push(await readNavigationPosition(tabFixturePage));
  await tabFixturePage.goBack();
  await waitForActiveOpenView(tabFixturePage, '@fixture-user', 5);
  historyActivation.push(await readNavigationPosition(tabFixturePage));
  await tabFixturePage.goForward();
  await waitForActiveOpenView(tabFixturePage, 'hot', 5);
  historyActivation.push(await readNavigationPosition(tabFixturePage));
  await tabFixturePage.goForward();
  await waitForActiveOpenView(tabFixturePage, 'topic:42', 5);
  historyActivation.push(await readNavigationPosition(tabFixturePage));
  assert.deepEqual(
    historyActivation.map(({ activeLabel }) => activeLabel),
    ['hot', '@fixture-user', 'hot', 'topic:42'],
  );
  assert(historyActivation.every(({ addressHref, href }) => href === addressHref));
  await tabFixturePage.screenshot({ path: path.join(evidenceDir, 'tabs-history-forward.png') });
  await tabFixturePage.setViewportSize({ width: 320, height: 640 });
  const narrowOpenViewTabs = await tabFixturePage
    .locator('.docode-workbench__tabs')
    .evaluate((tabs) => ({
      clientWidth: tabs.clientWidth,
      height: tabs.getBoundingClientRect().height,
      horizontalOverflow: tabs.scrollWidth > tabs.clientWidth,
      scrollWidth: tabs.scrollWidth,
    }));
  assert.equal(narrowOpenViewTabs.height, 35);
  assert.equal(narrowOpenViewTabs.horizontalOverflow, true);
  await tabFixturePage.screenshot({ path: path.join(evidenceDir, 'tabs-multiple-narrow.png') });
  await tabFixturePage.screenshot({
    path: path.join(fidelityRefinementEvidenceDir, 'tabs-fit-narrow.png'),
  });
  await tabFixturePage.setViewportSize({ width: 1280, height: 800 });

  const topicTab = tabFixturePage.getByRole('tab', { name: 'topic:42' });
  await topicTab.focus();
  await topicTab.press('ArrowRight');
  assert.equal(
    await tabFixturePage.evaluate(() => document.activeElement?.textContent?.trim()),
    'search:codex',
  );
  const tabFitFocus = await readTabFidelity(tabFixturePage);
  assert.equal(tabFitFocus.find(({ label }) => label === 'search:codex')?.closeOpacity, '1');
  await tabFixturePage.screenshot({ path: path.join(evidenceDir, 'tabs-keyboard-focus.png') });
  await tabFixturePage.screenshot({
    path: path.join(fidelityRefinementEvidenceDir, 'tabs-fit-focus.png'),
  });
  await tabFixturePage.getByRole('tab', { name: 'search:codex' }).press('Enter');
  await tabFixturePage.waitForFunction(
    () =>
      document
        .querySelector('.docode-workbench__tab[data-active="true"] [role="tab"]')
        ?.textContent?.trim() === 'search:codex',
  );
  const closeInactiveLatest = tabFixturePage.getByRole('button', {
    exact: true,
    name: 'Close latest',
  });
  await closeInactiveLatest.focus();
  await closeInactiveLatest.press('Enter');
  assert.deepEqual(
    (await readOpenViewTabs(tabFixturePage)).map(({ label }) => label),
    ['topic:42', 'search:codex', '@fixture-user', 'hot'],
  );
  await tabFixturePage.waitForFunction(
    () =>
      document.activeElement?.getAttribute('role') === 'tab' &&
      document.activeElement?.querySelector('.docode-workbench__tab-label')?.textContent?.trim() ===
        'search:codex',
  );
  const closeActiveSearch = tabFixturePage.getByRole('link', { name: 'Close search:codex' });
  await closeActiveSearch.focus();
  await closeActiveSearch.press('Enter');
  await tabFixturePage.waitForFunction(
    () =>
      document.querySelectorAll('.docode-workbench__tabs [role="tab"]').length === 3 &&
      document
        .querySelector(
          '.docode-workbench__tab[data-active="true"] [role="tab"] .docode-workbench__tab-label',
        )
        ?.textContent?.trim() === '@fixture-user',
  );
  await tabFixturePage.waitForFunction(
    () =>
      document.activeElement?.getAttribute('role') === 'tab' &&
      document.activeElement?.querySelector('.docode-workbench__tab-label')?.textContent?.trim() ===
        '@fixture-user',
  );
  await tabFixturePage.getByRole('tab', { name: 'hot' }).click();
  await tabFixturePage.waitForFunction(
    () =>
      document
        .querySelector(
          '.docode-workbench__tab[data-active="true"] [role="tab"] .docode-workbench__tab-label',
        )
        ?.textContent?.trim() === 'hot',
  );
  const closeActiveHot = tabFixturePage.getByRole('link', { name: 'Close hot' });
  await closeActiveHot.focus();
  await closeActiveHot.press('Enter');
  await tabFixturePage.waitForFunction(
    () =>
      document.querySelectorAll('.docode-workbench__tabs [role="tab"]').length === 2 &&
      document
        .querySelector(
          '.docode-workbench__tab[data-active="true"] [role="tab"] .docode-workbench__tab-label',
        )
        ?.textContent?.trim() === '@fixture-user',
  );
  await tabFixturePage.waitForFunction(
    () =>
      document.activeElement?.getAttribute('role') === 'tab' &&
      document.activeElement?.querySelector('.docode-workbench__tab-label')?.textContent?.trim() ===
        '@fixture-user',
  );
  const closedViewTabs = await readOpenViewTabs(tabFixturePage);
  assert.deepEqual(
    closedViewTabs.map(({ label }) => label),
    ['topic:42', '@fixture-user'],
  );
  await tabFixturePage.screenshot({ path: path.join(evidenceDir, 'tabs-after-close.png') });
  await tabFixturePage.screenshot({
    path: path.join(keyboardEvidenceDir, 'tab-close-focus.png'),
  });
  await tabFixturePage.goBack();
  await waitForActiveOpenView(tabFixturePage, 'hot', 3);
  await tabFixturePage.goBack();
  await waitForActiveOpenView(tabFixturePage, '@fixture-user', 3);
  await tabFixturePage.goForward();
  await waitForActiveOpenView(tabFixturePage, 'hot', 3);
  const reopenedHistoryTabs = await readOpenViewTabs(tabFixturePage);
  assert.deepEqual(
    reopenedHistoryTabs.map(({ label }) => label),
    ['topic:42', '@fixture-user', 'hot'],
  );
  await tabFixturePage.screenshot({ path: path.join(evidenceDir, 'tabs-history-reopened.png') });

  await context.route('https://linux.do/hot', (route) =>
    route.fulfill({ body: topicListFixtureHtml(), contentType: 'text/html', status: 200 }),
  );
  await tabFixturePage.reload({ waitUntil: 'domcontentloaded' });
  await assertRuntimeOwnership(tabFixturePage, true);
  await waitForActiveOpenView(tabFixturePage, 'hot', 1);
  const reloadedViewTabs = await readOpenViewTabs(tabFixturePage);
  assert.deepEqual(
    reloadedViewTabs.map(({ label }) => label),
    ['hot'],
  );
  assert.equal(
    await tabFixturePage.locator('.docode-workbench').getAttribute('data-route-source'),
    'initial',
  );
  await tabFixturePage.screenshot({ path: path.join(evidenceDir, 'tabs-reload.png') });

  await tabFixturePage.evaluate(() => {
    window.history.pushState({}, '', '/unknown');
    window.history.pushState({}, '', '/tags');
  });
  await waitForActiveOpenView(tabFixturePage, 'tags', 2);
  assert.deepEqual(
    (await readOpenViewTabs(tabFixturePage)).map(({ label }) => label),
    ['hot', 'tags'],
  );
  await tabFixturePage.goBack();
  await waitForActiveOpenView(tabFixturePage, 'unsupported', 2);
  assert.deepEqual(
    (await readOpenViewTabs(tabFixturePage)).map(({ label }) => label),
    ['hot', 'unsupported'],
  );
  await tabFixturePage.goBack();
  await waitForActiveOpenView(tabFixturePage, 'hot', 1);
  const transientCleanupTabs = await readOpenViewTabs(tabFixturePage);
  assert.deepEqual(
    transientCleanupTabs.map(({ label }) => label),
    ['hot'],
  );
  await tabFixturePage.close();

  const directDeepLinkPage = await context.newPage();
  await observeTransientWorkbenchErrors(directDeepLinkPage);
  await directDeepLinkPage.goto(topicOpeningFixtureUrl, { waitUntil: 'domcontentloaded' });
  await assertRuntimeOwnership(directDeepLinkPage, true);
  await waitForActiveOpenView(directDeepLinkPage, 'topic:42', 1);
  await directDeepLinkPage.getByRole('document', { name: 'Topic code document' }).waitFor();
  assert.deepEqual(await readTransientWorkbenchErrors(directDeepLinkPage), []);
  const copiedDeepLink = directDeepLinkPage.url();
  await directDeepLinkPage.reload({ waitUntil: 'domcontentloaded' });
  await waitForActiveOpenView(directDeepLinkPage, 'topic:42', 1);
  await directDeepLinkPage.getByRole('document', { name: 'Topic code document' }).waitFor();
  assert.deepEqual(await readTransientWorkbenchErrors(directDeepLinkPage), []);
  const copiedDeepLinkPage = await context.newPage();
  await observeTransientWorkbenchErrors(copiedDeepLinkPage);
  await copiedDeepLinkPage.goto(copiedDeepLink, { waitUntil: 'domcontentloaded' });
  await assertRuntimeOwnership(copiedDeepLinkPage, true);
  await waitForActiveOpenView(copiedDeepLinkPage, 'topic:42', 1);
  await copiedDeepLinkPage.getByRole('document', { name: 'Topic code document' }).waitFor();
  assert.deepEqual(await readTransientWorkbenchErrors(copiedDeepLinkPage), []);
  assert.equal(copiedDeepLinkPage.url(), copiedDeepLink);
  await copiedDeepLinkPage.close();
  await directDeepLinkPage.close();

  const tabActionPage = await context.newPage();
  await tabActionPage.goto(topicListFixtureUrl, { waitUntil: 'domcontentloaded' });
  await assertRuntimeOwnership(tabActionPage, true);
  await installSyntheticTabNavigation(tabActionPage);
  const tabActionPrimaryModifier = await readPrimaryModifier(tabActionPage);
  await tabActionPage
    .getByRole('link', { name: 'Open topic from post: Synthetic topic 1', exact: true })
    .click({ modifiers: [tabActionPrimaryModifier] });
  await tabActionPage.evaluate(() => {
    window.history.pushState({}, '', '/search?q=codex');
    window.history.pushState({}, '', '/u/fixture-user/activity/topics');
    window.history.pushState({}, '', '/hot');
    window.history.pushState({}, '', '/t/renamed-topic/42/7');
  });
  await waitForActiveOpenView(tabActionPage, 'topic:42', 5);

  const actionTopicTab = tabActionPage.getByRole('tab', { name: 'topic:42' });
  await actionTopicTab.focus();
  await actionTopicTab.press('Shift+F10');
  const keyboardTabMenu = tabActionPage.getByRole('menu', { name: 'topic:42 tab actions' });
  await keyboardTabMenu.waitFor();
  assert.equal(
    await tabActionPage.evaluate(() => document.activeElement?.textContent?.trim()),
    'Close',
  );
  await tabActionPage.keyboard.press('ArrowDown');
  assert.equal(
    await tabActionPage.evaluate(() => document.activeElement?.textContent?.trim()),
    'Close Others',
  );
  await tabActionPage.keyboard.press('Tab');
  assert.equal(
    await tabActionPage.evaluate(() => document.activeElement?.textContent?.trim()),
    'Close Others',
  );
  assert.equal(await keyboardTabMenu.getByText(/^Pin$/).count(), 0);
  await tabActionPage.screenshot({ path: path.join(evidenceDir, 'tab-menu-keyboard.png') });
  await tabActionPage.screenshot({
    path: path.join(keyboardEvidenceDir, 'tab-menu-keyboard.png'),
  });
  await tabActionPage.keyboard.press('Escape');
  await tabActionPage.waitForFunction(
    () =>
      document.activeElement?.querySelector('.docode-workbench__tab-label')?.textContent?.trim() ===
      'topic:42',
  );

  await actionTopicTab.click({ button: 'right', position: { x: 60, y: 18 } });
  const pointerTabMenu = tabActionPage.getByRole('menu', { name: 'topic:42 tab actions' });
  const tabMenuGeometry = await pointerTabMenu.evaluate((menu) => {
    const style = getComputedStyle(menu);
    const firstItem = menu.querySelector('[role="menuitem"]');
    return {
      animationDuration: style.animationDuration,
      background: style.backgroundColor,
      borderColor: style.borderColor,
      borderRadius: style.borderRadius,
      boxShadow: style.boxShadow,
      firstItemBorderRadius: firstItem ? getComputedStyle(firstItem).borderRadius : '',
      firstItemHeight: firstItem?.getBoundingClientRect().height ?? 0,
      width: menu.getBoundingClientRect().width,
    };
  });
  assert.deepEqual(tabMenuGeometry, {
    animationDuration: '0.083s',
    background: 'rgb(37, 37, 38)',
    borderColor: 'rgb(69, 69, 69)',
    borderRadius: '8px',
    boxShadow: 'rgba(0, 0, 0, 0.14) 0px 0px 12px 0px',
    firstItemBorderRadius: '6px',
    firstItemHeight: 24,
    width: 230,
  });
  await tabActionPage.screenshot({ path: path.join(evidenceDir, 'tab-menu-pointer.png') });
  await tabActionPage.screenshot({
    path: path.join(transientFidelityEvidenceDir, 'tab-menu-pointer.png'),
  });
  await pointerTabMenu.getByRole('menuitem', { name: 'Copy Topic Link' }).click();
  assert.equal(
    await tabActionPage.evaluate(() => navigator.clipboard.readText()),
    'https://linux.do/t/renamed-topic/42/7',
  );
  await tabActionPage.waitForFunction(
    () =>
      document.activeElement?.getAttribute('role') === 'tab' &&
      document.activeElement?.querySelector('.docode-workbench__tab-label')?.textContent?.trim() ===
        'topic:42',
  );

  await tabActionPage.emulateMedia({ reducedMotion: 'reduce' });
  await tabActionPage.getByRole('tab', { name: 'search:codex' }).click({ button: 'right' });
  const reducedMotionTabMenu = tabActionPage.getByRole('menu', {
    name: 'search:codex tab actions',
  });
  const reducedMenuAnimationDuration = await reducedMotionTabMenu.evaluate(
    (element) => getComputedStyle(element).animationDuration,
  );
  assert.equal(reducedMenuAnimationDuration, '0s');
  await tabActionPage.screenshot({
    path: path.join(transientFidelityEvidenceDir, 'tab-menu-reduced-motion.png'),
  });
  await reducedMotionTabMenu.getByRole('menuitem', { name: 'Close to the Right' }).click();
  await tabActionPage.emulateMedia({ reducedMotion: 'no-preference' });
  await waitForActiveOpenView(tabActionPage, 'topic:42', 3);
  const closeRightTabs = await readOpenViewTabs(tabActionPage);
  assert.deepEqual(
    closeRightTabs.map(({ label }) => label),
    ['latest', 'topic:42', 'search:codex'],
  );
  await tabActionPage.screenshot({ path: path.join(evidenceDir, 'tab-menu-close-right.png') });

  await tabActionPage.evaluate(() => {
    window.history.pushState({}, '', '/u/fixture-user/activity/topics');
    window.history.pushState({}, '', '/hot');
  });
  await waitForActiveOpenView(tabActionPage, 'hot', 5);
  await tabActionPage.getByRole('tab', { name: '@fixture-user' }).click({ button: 'right' });
  await tabActionPage
    .getByRole('menu', { name: '@fixture-user tab actions' })
    .getByRole('menuitem', { name: 'Close Others' })
    .click();
  await waitForActiveOpenView(tabActionPage, '@fixture-user', 1);
  const closeOtherTabs = await readOpenViewTabs(tabActionPage);
  assert.deepEqual(
    closeOtherTabs.map(({ label }) => label),
    ['@fixture-user'],
  );
  await tabActionPage.screenshot({ path: path.join(evidenceDir, 'tab-menu-close-others.png') });

  await tabActionPage.reload({ waitUntil: 'domcontentloaded' });
  await assertRuntimeOwnership(tabActionPage, true);
  await waitForActiveOpenView(tabActionPage, '@fixture-user', 1);
  const approvedStoredState = await popupPage.evaluate(async () =>
    globalThis.chrome.storage.local.get(null),
  );
  assert(
    Object.keys(approvedStoredState).every((key) =>
      [
        'enabled',
        'workbench.appearance',
        'workbench.browseHistory',
        'workbench.sidebarWidth',
      ].includes(key),
    ),
  );
  assert(
    !('workbench.browseHistory' in approvedStoredState) ||
      (Array.isArray(approvedStoredState['workbench.browseHistory']) &&
        approvedStoredState['workbench.browseHistory'].every(
          (entry) =>
            typeof entry?.path === 'string' &&
            entry.path.startsWith('/') &&
            typeof entry.title === 'string' &&
            Number.isFinite(entry.visitedAt),
        )),
  );
  assert(!('enabled' in approvedStoredState) || approvedStoredState.enabled === true);
  assert(
    !('workbench.sidebarWidth' in approvedStoredState) ||
      (Number.isInteger(approvedStoredState['workbench.sidebarWidth']) &&
        approvedStoredState['workbench.sidebarWidth'] >= 170 &&
        approvedStoredState['workbench.sidebarWidth'] <= 4096),
  );

  await tabActionPage.getByRole('tab', { name: '@fixture-user' }).click({ button: 'right' });
  await tabActionPage
    .getByRole('menu', { name: '@fixture-user tab actions' })
    .getByRole('menuitem', { name: 'Open Original View' })
    .click();
  await assertRuntimeOwnership(tabActionPage, false);
  await assertNativePageVisible(tabActionPage);
  assert.equal(await readEnabledSetting(popupPage), false);
  await tabActionPage.screenshot({ path: path.join(evidenceDir, 'tab-menu-original-view.png') });
  await tabActionPage.bringToFront();
  await popupPage.reload();
  await clickPopupEnabledToggle(popupPage);
  await assertRuntimeOwnership(tabActionPage, true);
  assert.equal(await readEnabledSetting(popupPage), true);
  await tabActionPage.close();
  await topicListFixturePage.close();

  const searchPage = await context.newPage();
  const searchPageErrors = [];
  searchPage.on('pageerror', (error) => searchPageErrors.push(error.message));
  await searchPage.goto(topicListFixtureUrl, { waitUntil: 'domcontentloaded' });
  await assertRuntimeOwnership(searchPage, true);
  await installSyntheticTabNavigation(searchPage);

  const searchTerminalInput = searchPage.getByRole('combobox', {
    name: 'Linux DO command input',
  });
  await searchTerminalInput.fill('search browser extension');
  await searchTerminalInput.press('Enter');
  await searchPage
    .getByRole('tree', { name: 'Search results for browser extension' })
    .waitFor({ state: 'visible' });
  assert.equal(searchPage.url(), topicListFixtureUrl);
  assert.equal(await searchPage.getByRole('button', { name: 'Close Search Results' }).count(), 1);
  await searchPage.screenshot({ path: path.join(evidenceDir, 'terminal-search-explorer.png') });

  await searchPage.evaluate(() => {
    window.history.pushState({}, '', '/search?q=browser+extension');
  });
  await searchPage.waitForURL('https://linux.do/search?q=browser+extension');
  await assertRuntimeOwnership(searchPage, true);
  await searchPage.getByText('4 results for “browser extension”', { exact: true }).waitFor();
  const searchResultLinks = {
    category: 'https://linux.do/c/develop/4',
    post: 'https://linux.do/t/synthetic-topic-1/42/4',
    tag: 'https://linux.do/tag/testing/7',
    user: 'https://linux.do/u/alice',
  };
  for (const href of Object.values(searchResultLinks)) {
    assert.equal(
      await searchPage.locator(`.docode-search-document__result[href="${href}"]`).count(),
      1,
    );
  }
  const searchDocumentGeometry = await searchPage
    .locator('.docode-search-document')
    .evaluate((documentRoot) => {
      const input = documentRoot.querySelector('.docode-search-document__input');
      const group = documentRoot.querySelector('.docode-search-document__group-title');
      const result = documentRoot.querySelector('.docode-search-document__result');
      if (
        !(input instanceof HTMLElement) ||
        !(group instanceof HTMLElement) ||
        !(result instanceof HTMLElement)
      ) {
        throw new Error('Missing rendered search document geometry.');
      }
      return {
        background: getComputedStyle(documentRoot).backgroundColor,
        groupHeight: group.getBoundingClientRect().height,
        inputHeight: input.getBoundingClientRect().height,
        resultHeight: result.getBoundingClientRect().height,
      };
    });
  assert.deepEqual(searchDocumentGeometry, {
    background: 'rgb(30, 30, 30)',
    groupHeight: 22,
    inputHeight: 28,
    resultHeight: 44,
  });
  await searchPage.screenshot({ path: path.join(searchEvidenceDir, 'search-ready.png') });
  await searchPage.screenshot({
    path: path.join(fidelityRefinementEvidenceDir, 'search-ready.png'),
  });
  const searchAccessibility = await auditDomSemantics(searchPage, '[data-docode-workbench-root]');
  assert.deepEqual(
    {
      liveRegionsWithControls: searchAccessibility.liveRegionsWithControls,
      missingNames: searchAccessibility.missingNames,
      missingReferences: searchAccessibility.missingReferences,
      unnamedGenericLabels: searchAccessibility.unnamedGenericLabels,
    },
    {
      liveRegionsWithControls: [],
      missingNames: [],
      missingReferences: [],
      unnamedGenericLabels: [],
    },
  );
  const searchAx = await readAxSummary(searchPage);
  assertAxNode(searchAx, 'region', 'Linux DO search results');
  assertAxNode(searchAx, 'list', /Posts/u);
  assertAxNode(searchAx, 'listitem', '');
  const searchDescriptionContrast = await readContrast(
    searchPage,
    '.docode-search-document__result-description',
    '.docode-search-document',
  );
  assert(contrastRatio(searchDescriptionContrast) >= 4.5);
  const searchTargets = await readTargetSizes(searchPage, {
    input: '.docode-search-document__input',
    result: '.docode-search-document__result',
    submit: '.docode-search-document__submit',
  });
  assert(Object.values(searchTargets).every(({ height, width }) => height >= 28 && width >= 28));
  await searchPage.screenshot({
    path: path.join(accessibilityEvidenceDir, 'search-semantics.png'),
  });

  const searchNavigationHistory = [];
  await searchPage
    .locator(`.docode-search-document__result[href="${searchResultLinks.category}"]`)
    .click();
  await searchPage.waitForURL(searchResultLinks.category);
  await waitForActiveOpenView(searchPage, 'category:develop', 3);
  searchNavigationHistory.push(searchPage.url());
  await searchPage.goBack();
  await searchPage.getByText('4 results for “browser extension”', { exact: true }).waitFor();
  searchNavigationHistory.push(searchPage.url());
  await searchPage.goForward();
  await waitForActiveOpenView(searchPage, 'category:develop', 3);
  searchNavigationHistory.push(searchPage.url());
  await searchPage.goBack();
  await searchPage.getByText('4 results for “browser extension”', { exact: true }).waitFor();

  await searchPage
    .locator(`.docode-search-document__result[href="${searchResultLinks.user}"]`)
    .click();
  await searchPage.waitForURL(searchResultLinks.user);
  await waitForActiveOpenView(searchPage, '@alice', 4);
  searchNavigationHistory.push(searchPage.url());
  await searchPage.goBack();
  await searchPage.getByText('4 results for “browser extension”', { exact: true }).waitFor();
  await searchPage
    .locator(`.docode-search-document__result[href="${searchResultLinks.post}"]`)
    .click();
  await searchPage.waitForURL(searchResultLinks.post);
  await waitForActiveOpenView(searchPage, 'topic:42', 5);
  searchNavigationHistory.push(searchPage.url());
  await searchPage.goBack();
  await searchPage.getByText('4 results for “browser extension”', { exact: true }).waitFor();
  await searchPage.screenshot({
    path: path.join(searchEvidenceDir, 'search-history-restored.png'),
  });

  const searchInput = searchPage.getByRole('searchbox', { name: 'Search Linux DO' });
  await searchInput.fill('no-results');
  await searchPage.getByRole('button', { name: 'Search', exact: true }).click();
  await searchPage.waitForURL('https://linux.do/search?q=no-results');
  await searchPage.getByText('No Linux DO results for “no-results”.', { exact: true }).waitFor();
  await searchPage.screenshot({ path: path.join(searchEvidenceDir, 'search-empty.png') });
  await searchPage.getByRole('searchbox', { name: 'Search Linux DO' }).fill('fail');
  await searchPage.getByRole('button', { name: 'Search', exact: true }).click();
  await searchPage.waitForURL('https://linux.do/search?q=fail');
  await searchPage
    .getByRole('alert')
    .getByText('Synthetic Linux DO rate limit.', { exact: true })
    .waitFor();
  await searchPage.screenshot({ path: path.join(searchEvidenceDir, 'search-error.png') });

  await searchPage.evaluate(() => {
    window.history.pushState({}, '', '/latest?docode_fixture=1');
  });
  await waitForActiveOpenView(searchPage, 'latest', 7);
  await searchPage.getByRole('button', { name: 'Search files and Linux DO topics' }).click();
  const remoteQuickOpenInput = searchPage.getByRole('combobox', {
    name: 'Search open views, loaded topics, and Linux DO',
  });
  await remoteQuickOpenInput.fill('remote');
  await searchPage.getByRole('option', { name: /Remote result/u }).waitFor();
  const remoteQuickOpen = await readQuickOpen(searchPage);
  assert.equal(remoteQuickOpen.optionCount, 1);
  await searchPage.screenshot({ path: path.join(searchEvidenceDir, 'quick-open-search.png') });
  await remoteQuickOpenInput.press('Escape');

  await searchPage.getByRole('button', { name: 'Open Command Palette' }).click();
  const searchPaletteInput = searchPage.getByRole('combobox', {
    name: 'Type the name of a command',
  });
  await searchPaletteInput.fill('linux do: search');
  await searchPage.getByRole('option', { name: /Linux DO: Search/u }).click();
  await searchPage.getByRole('dialog', { name: 'Quick Open' }).waitFor();
  await searchPage.screenshot({ path: path.join(searchEvidenceDir, 'palette-search.png') });
  await searchPage
    .getByRole('combobox', { name: 'Search open views, loaded topics, and Linux DO' })
    .press('Escape');

  await searchPage.evaluate(() => {
    window.history.pushState({}, '', '/search?q=remote');
  });
  await searchPage.getByText('4 results for “remote”', { exact: true }).waitFor();
  await searchPage.setViewportSize({ width: 420, height: 640 });
  const narrowSearchResult = await searchPage
    .locator('.docode-search-document__result')
    .first()
    .evaluate((result) => {
      const pathElement = result.querySelector('.docode-search-document__result-path');
      if (!(pathElement instanceof HTMLElement)) throw new Error('Missing search result path.');
      return {
        height: result.getBoundingClientRect().height,
        pathVisible: getComputedStyle(pathElement).display,
      };
    });
  assert.deepEqual(narrowSearchResult, { height: 48, pathVisible: 'none' });
  await searchPage.screenshot({ path: path.join(searchEvidenceDir, 'search-narrow.png') });
  await searchPage.screenshot({
    path: path.join(fidelityRefinementEvidenceDir, 'search-narrow.png'),
  });
  await searchPage.close();
  await context.unroute(searchApiPattern, searchApiHandler);
  assert.deepEqual(searchPageErrors, []);

  const loadingFixtureUrl = 'https://linux.do/latest?docode_state=loading';
  await context.route(loadingFixtureUrl, (route) =>
    route.fulfill({
      body: '<!doctype html><html><head><title>Loading fixture</title></head><body><main id="main-outlet" aria-busy="true"><div role="progressbar"></div></main></body></html>',
      contentType: 'text/html',
      status: 200,
    }),
  );
  const stateFixturePage = await context.newPage();
  await stateFixturePage.goto(loadingFixtureUrl, { waitUntil: 'domcontentloaded' });
  await assertRuntimeOwnership(stateFixturePage, true);
  await assertWorkbenchLoading(stateFixturePage, 'Loading topics…');
  await stateFixturePage.screenshot({ path: path.join(evidenceDir, 'workbench-loading.png') });
  await stateFixturePage.emulateMedia({ reducedMotion: 'reduce' });
  const reducedMotionLoading = await stateFixturePage
    .locator('[data-docode-workbench-root]')
    .evaluate((root) => {
      const progress = root.querySelector('.docode-workbench__editor-progress');
      const progressBit = root.querySelector('.docode-workbench__editor-progress-bit');
      const sashElement = root.querySelector('.docode-workbench__sash');
      if (
        !(progress instanceof HTMLElement) ||
        !(progressBit instanceof HTMLElement) ||
        !(sashElement instanceof HTMLElement)
      ) {
        throw new Error('Missing reduced-motion loading controls.');
      }
      return {
        mediaMatches: matchMedia('(prefers-reduced-motion: reduce)').matches,
        progressAnimationName: getComputedStyle(progressBit).animationName,
        progressWidth: progress.getBoundingClientRect().width,
        progressBitWidth: progressBit.getBoundingClientRect().width,
        sashTransitionDuration: getComputedStyle(sashElement, '::before').transitionDuration,
      };
    });
  assert.equal(reducedMotionLoading.mediaMatches, true);
  assert.equal(reducedMotionLoading.progressAnimationName, 'none');
  assert.equal(reducedMotionLoading.sashTransitionDuration, '0s');
  assert.equal(reducedMotionLoading.progressBitWidth, reducedMotionLoading.progressWidth);
  await stateFixturePage.screenshot({
    path: path.join(accessibilityEvidenceDir, 'reduced-motion-loading.png'),
  });
  await stateFixturePage.emulateMedia({ reducedMotion: 'no-preference' });
  await stateFixturePage.getByRole('button', { name: 'Search files and Linux DO topics' }).click();
  await stateFixturePage
    .getByText('Linux DO topic suggestions are still loading.', { exact: true })
    .waitFor();
  await stateFixturePage.screenshot({ path: path.join(evidenceDir, 'quick-open-loading.png') });
  await stateFixturePage
    .getByRole('combobox', { name: 'Search open views, loaded topics, and Linux DO' })
    .press('Escape');
  await stateFixturePage.evaluate(() => {
    const main = document.querySelector('main');
    if (!main) throw new Error('Missing synthetic main region.');
    main.removeAttribute('aria-busy');
    main.innerHTML = '<table class="topic-list"><tbody></tbody></table>';
  });
  await assertWorkbenchState(stateFixturePage, 'empty', 'No topics');
  await stateFixturePage.screenshot({ path: path.join(evidenceDir, 'workbench-empty.png') });
  await stateFixturePage.getByRole('button', { name: 'Search files and Linux DO topics' }).click();
  await stateFixturePage
    .getByText('Linux DO returned no topic suggestions for this view.', { exact: true })
    .waitFor();
  await stateFixturePage.screenshot({ path: path.join(evidenceDir, 'quick-open-empty.png') });
  await stateFixturePage
    .getByRole('combobox', { name: 'Search open views, loaded topics, and Linux DO' })
    .press('Escape');
  const emptyTerminalInput = stateFixturePage.getByRole('combobox', {
    name: 'Linux DO command input',
  });
  await emptyTerminalInput.focus();
  await emptyTerminalInput.press('Tab');
  const emptyCompletion = await readTerminalCompletionPromptState(stateFixturePage);
  assert.deepEqual(emptyCompletion, { inputExpanded: null, optionCount: 0 });
  await stateFixturePage.screenshot({
    path: path.join(evidenceDir, 'terminal-no-completion-prompt-empty.png'),
  });
  await stateFixturePage.evaluate(() => {
    const body = document.querySelector('table.topic-list tbody');
    if (!body) throw new Error('Missing synthetic topic-list body.');
    body.innerHTML =
      '<tr data-topic-id="42"><td><a href="/t/synthetic-topic/42">Synthetic topic</a></td></tr>';
  });
  await stateFixturePage.locator('.docode-workbench__state-surface').waitFor({ state: 'detached' });
  await stateFixturePage.close();

  const errorFixtureUrl = 'https://linux.do/hot?docode_state=error';
  await context.route(errorFixtureUrl, (route) =>
    route.fulfill({
      body: '<!doctype html><html><head><title>Error fixture</title></head><body><main id="main-outlet">Native error fixture</main></body></html>',
      contentType: 'text/html',
      status: 200,
    }),
  );
  const errorFixturePage = await context.newPage();
  await errorFixturePage.goto(errorFixtureUrl, { waitUntil: 'domcontentloaded' });
  await assertRuntimeOwnership(errorFixturePage, true);
  await assertWorkbenchState(errorFixturePage, 'error', 'Unable to read topics');
  await errorFixturePage.getByRole('button', { name: 'Search files and Linux DO topics' }).click();
  await errorFixturePage
    .getByText('Linux DO topic suggestions are unavailable.', { exact: true })
    .waitFor();
  await errorFixturePage.screenshot({ path: path.join(evidenceDir, 'quick-open-error.png') });
  await errorFixturePage
    .getByRole('combobox', { name: 'Search open views, loaded topics, and Linux DO' })
    .press('Escape');
  const retryButton = errorFixturePage.getByRole('button', { name: 'Retry' });
  await retryButton.hover();
  assert.equal(
    await retryButton.evaluate((element) => getComputedStyle(element).backgroundColor),
    'rgb(2, 110, 193)',
  );
  await retryButton.focus();
  assert.equal(
    await retryButton.evaluate((element) => getComputedStyle(element).outlineColor),
    'rgb(0, 120, 212)',
  );
  await errorFixturePage.screenshot({ path: path.join(evidenceDir, 'workbench-error.png') });
  await errorFixturePage.screenshot({
    path: path.join(fidelityRefinementEvidenceDir, 'workbench-error.png'),
  });
  await retryButton.click();
  await assertWorkbenchState(errorFixturePage, 'error', 'Unable to read topics');
  await errorFixturePage.getByRole('button', { name: 'Use Original Linux DO' }).click();
  await assertRuntimeOwnership(errorFixturePage, false);
  await assertNativePageVisible(errorFixturePage);
  assert.equal(await readEnabledSetting(popupPage), false);
  await errorFixturePage.screenshot({
    path: path.join(evidenceDir, 'workbench-original-recovery.png'),
  });
  await errorFixturePage.bringToFront();
  await popupPage.reload();
  await assertPopupText(popupPage, 'Original LINUX DO is active.');
  await clickPopupEnabledToggle(popupPage);
  await assertRuntimeOwnership(errorFixturePage, true);
  assert.equal(await readEnabledSetting(popupPage), true);
  await errorFixturePage.close();

  const topicLoadingFixtureUrl = 'https://linux.do/t/synthetic-topic/42?docode_state=topic-loading';
  await context.route(topicLoadingFixtureUrl, (route) =>
    route.fulfill({
      body: '<!doctype html><html><body><main id="main-outlet" aria-busy="true"><div role="progressbar"></div></main></body></html>',
      contentType: 'text/html',
      status: 200,
    }),
  );
  const topicLoadingPage = await context.newPage();
  await topicLoadingPage.goto(topicLoadingFixtureUrl, { waitUntil: 'domcontentloaded' });
  await assertRuntimeOwnership(topicLoadingPage, true);
  await assertWorkbenchLoading(topicLoadingPage, 'Loading topic…');
  await topicLoadingPage.getByText('Loading topic outline…', { exact: true }).waitFor();
  await topicLoadingPage.getByText('Loading topic minimap…', { exact: true }).waitFor();
  const loadingStatus = topicLoadingPage.locator('.docode-workbench__status-item--activity');
  await loadingStatus.getByText('Loading', { exact: true }).waitFor();
  assert.equal(await loadingStatus.locator('.codicon-loading').count(), 1);
  assert.equal(
    await loadingStatus.getAttribute('data-docode-tooltip'),
    'Waiting for Linux DO to finish rendering this topic.',
  );
  await topicLoadingPage.screenshot({ path: path.join(evidenceDir, 'topic-loading.png') });
  await topicLoadingPage.screenshot({ path: path.join(statusEvidenceDir, 'status-loading.png') });
  await topicLoadingPage.close();

  const topicErrorFixtureUrl = 'https://linux.do/t/synthetic-topic/42?docode_state=topic-error';
  await context.route(topicErrorFixtureUrl, (route) =>
    route.fulfill({
      body: '<!doctype html><html><body><main id="main-outlet"><h1 data-topic-id="42"><a href="/t/synthetic-topic/42">Synthetic topic</a></h1></main></body></html>',
      contentType: 'text/html',
      status: 200,
    }),
  );
  const topicErrorPage = await context.newPage();
  await topicErrorPage.goto(topicErrorFixtureUrl, { waitUntil: 'domcontentloaded' });
  await assertRuntimeOwnership(topicErrorPage, true);
  await assertWorkbenchState(topicErrorPage, 'error', 'Unable to read this topic');
  await topicErrorPage.getByText('Topic outline unavailable.', { exact: true }).waitFor();
  await topicErrorPage.getByText('Topic minimap unavailable.', { exact: true }).waitFor();
  const readErrorStatus = topicErrorPage.locator('.docode-workbench__status-item--activity');
  await readErrorStatus.getByText('Read error', { exact: true }).waitFor();
  assert.equal(await readErrorStatus.getAttribute('data-tone'), 'error');
  assert.equal(
    await readErrorStatus.getAttribute('data-docode-tooltip'),
    'Linux DO did not expose the expected post stream.',
  );
  await topicErrorPage.screenshot({ path: path.join(evidenceDir, 'topic-error.png') });
  await topicErrorPage.screenshot({ path: path.join(statusEvidenceDir, 'status-error.png') });
  await topicErrorPage.getByRole('tab', { name: 'Terminal', exact: true }).click();
  const errorTerminalInput = topicErrorPage.getByRole('combobox', {
    name: 'Linux DO command input',
  });
  await errorTerminalInput.press('Tab');
  const errorCompletion = await readTerminalCompletionPromptState(topicErrorPage);
  assert.deepEqual(errorCompletion, { inputExpanded: null, optionCount: 0 });
  await topicErrorPage.screenshot({
    path: path.join(evidenceDir, 'terminal-no-completion-prompt-error.png'),
  });
  await topicErrorPage.close();

  const compatibilityFixtureUrl =
    'https://linux.do/t/compatibility-topic/42/2?docode_fixture=compatibility';
  await context.route(compatibilityFixtureUrl, (route) =>
    route.fulfill({
      body: compatibilityTopicFixtureHtml(),
      contentType: 'text/html',
      status: 200,
    }),
  );
  const compatibilityPage = await context.newPage();
  await compatibilityPage.goto(compatibilityFixtureUrl, { waitUntil: 'domcontentloaded' });
  await assertRuntimeOwnership(compatibilityPage, true);
  await compatibilityPage.waitForFunction(
    () =>
      document.querySelectorAll('.docode-topic-code__reply').length === 2 &&
      document.querySelectorAll('.docode-topic-code__content-slot > .cooked').length === 1,
  );
  await compatibilityPage.bringToFront();
  await popupPage.reload();
  const compatibilityInitialStatus = await readContentStatus(popupPage);
  const compatibilityInitialTopic = compatibilityInitialStatus?.ok
    ? compatibilityInitialStatus.status.topic
    : null;
  const compatibilityInitialCapabilities = compatibilityInitialStatus?.ok
    ? compatibilityInitialStatus.status.capabilities
    : null;
  assert.deepEqual(compatibilityInitialTopic, {
    containsRequestedPost: true,
    errorCode: null,
    firstPostNumber: 1,
    hasMorePosts: false,
    issueCodes: ['missing-post-author', 'missing-post-content'],
    lastPostNumber: 2,
    partialPostCount: 1,
    postCount: 2,
    requestedPostNumber: 2,
    state: 'ready',
  });
  const compatibilityCapabilityGeneration = compatibilityInitialCapabilities?.generation;
  assert.deepEqual(compatibilityInitialCapabilities, {
    availableBookmarkCount: 0,
    availableCopyLinkCount: 1,
    availableLikeCount: 0,
    composerState: 'unavailable',
    diagnosticCodes: ['native-control-not-found', 'composer-not-found'],
    generation: compatibilityCapabilityGeneration,
    postCount: 2,
    replyState: 'available',
    state: 'ready',
    userState: 'logged-in',
  });
  const compatibilityPartialSurface = await compatibilityPage
    .locator('[data-docode-workbench-root]')
    .evaluate((root) => {
      const nativeRoot = root.querySelector('#compat-content-1');
      globalThis.__docodeCompatibilityNativeRoot = nativeRoot;
      return {
        completeReplyCount: root.querySelectorAll(
          '.docode-topic-code__reply[data-completeness="complete"]',
        ).length,
        missingContentCount: root.querySelectorAll('.docode-topic-code__missing-content').length,
        nativeRootCount: root.querySelectorAll('.docode-topic-code__content-slot > .cooked').length,
        partialReplyCount: root.querySelectorAll(
          '.docode-topic-code__reply[data-completeness="partial"]',
        ).length,
        replyCount: root.querySelectorAll('.docode-topic-code__reply').length,
      };
    });
  assert.deepEqual(compatibilityPartialSurface, {
    completeReplyCount: 1,
    missingContentCount: 1,
    nativeRootCount: 1,
    partialReplyCount: 1,
    replyCount: 2,
  });
  await compatibilityPage.screenshot({
    path: path.join(compatibilityEvidenceDir, 'partial-markup.png'),
  });
  await compatibilityPage.screenshot({
    path: path.join(topicFidelityEvidenceDir, 'topic-partial.png'),
  });

  await compatibilityPage.evaluate(() => {
    const article = document.querySelector('#compat-post-2');
    if (!(article instanceof HTMLElement)) throw new Error('Missing partial compatibility post.');
    article.insertAdjacentHTML(
      'afterbegin',
      '<div class="names"><a href="/u/recovered-user" data-user-card="recovered-user">Recovered User</a></div>',
    );
    article.insertAdjacentHTML(
      'beforeend',
      '<div class="cooked" id="compat-content-2"><p>Late native content</p></div>',
    );
  });
  await compatibilityPage.waitForFunction(
    () =>
      document.querySelectorAll('.docode-topic-code__reply[data-completeness="complete"]')
        .length === 2 &&
      document.querySelectorAll('.docode-topic-code__content-slot > .cooked').length === 2,
  );
  const compatibilityRecoveredStatus = await readContentStatus(popupPage);
  const compatibilityRecoveredTopic = compatibilityRecoveredStatus?.ok
    ? compatibilityRecoveredStatus.status.topic
    : null;
  assert.deepEqual(compatibilityRecoveredTopic, {
    containsRequestedPost: true,
    errorCode: null,
    firstPostNumber: 1,
    hasMorePosts: false,
    issueCodes: [],
    lastPostNumber: 2,
    partialPostCount: 0,
    postCount: 2,
    requestedPostNumber: 2,
    state: 'ready',
  });
  assert.equal(
    await compatibilityPage.evaluate(
      () =>
        globalThis.__docodeCompatibilityNativeRoot === document.querySelector('#compat-content-1'),
    ),
    true,
  );
  await compatibilityPage.screenshot({
    path: path.join(compatibilityEvidenceDir, 'partial-markup-recovered.png'),
  });

  await compatibilityPage.evaluate(() => {
    document.querySelector('.post-action-menu__copy-link')?.remove();
  });
  const compatibilityMissingActions = await waitForCapabilityGeneration(
    popupPage,
    Number(compatibilityCapabilityGeneration) + 1,
  );
  assert.deepEqual(compatibilityMissingActions, {
    availableBookmarkCount: 0,
    availableCopyLinkCount: 0,
    availableLikeCount: 0,
    composerState: 'unavailable',
    diagnosticCodes: ['native-control-not-found', 'composer-not-found'],
    generation: Number(compatibilityCapabilityGeneration) + 1,
    postCount: 2,
    replyState: 'available',
    state: 'ready',
    userState: 'logged-in',
  });
  await compatibilityPage.waitForFunction(
    () =>
      document.querySelectorAll(
        '.docode-topic-code__action-capability[data-action="copy-link"][data-state="unavailable"]',
      ).length === 2 && document.querySelectorAll('.docode-topic-code__reply').length === 2,
  );
  await compatibilityPage.screenshot({
    path: path.join(compatibilityEvidenceDir, 'missing-actions-isolated.png'),
  });

  await compatibilityPage.evaluate(() => {
    const stream = document.querySelector('.post-stream');
    if (!(stream instanceof HTMLElement)) throw new Error('Missing compatibility post stream.');
    stream.classList.remove('post-stream');
  });
  await assertWorkbenchState(compatibilityPage, 'error', 'Unable to read this topic');
  const compatibilityBrokenStatus = await readContentStatus(popupPage);
  assert.deepEqual(compatibilityBrokenStatus?.ok ? compatibilityBrokenStatus.status.topic : null, {
    containsRequestedPost: false,
    errorCode: 'post-stream-not-found',
    firstPostNumber: null,
    hasMorePosts: false,
    issueCodes: [],
    lastPostNumber: null,
    partialPostCount: 0,
    postCount: 0,
    requestedPostNumber: null,
    state: 'error',
  });
  await compatibilityPage.screenshot({
    path: path.join(compatibilityEvidenceDir, 'changed-markup-error.png'),
  });
  await compatibilityPage.getByRole('button', { name: 'Use Original Linux DO' }).click();
  await assertRuntimeOwnership(compatibilityPage, false);
  const compatibilityOriginalRecovery = await compatibilityPage.evaluate(() => ({
    firstNativeRootPreserved:
      globalThis.__docodeCompatibilityNativeRoot === document.querySelector('#compat-content-1'),
    nativeRootCount: document.querySelectorAll('#main-outlet .cooked').length,
    ownedStyleCount: document.querySelectorAll('[data-docode-owned-style]').length,
    transferMarkerCount: document.querySelectorAll('[data-docode-native-content-transfer]').length,
    workbenchRootCount: document.querySelectorAll('[data-docode-workbench-root]').length,
  }));
  assert.deepEqual(compatibilityOriginalRecovery, {
    firstNativeRootPreserved: true,
    nativeRootCount: 2,
    ownedStyleCount: 0,
    transferMarkerCount: 0,
    workbenchRootCount: 0,
  });
  await assertNativePageVisible(compatibilityPage);
  await compatibilityPage.screenshot({
    path: path.join(compatibilityEvidenceDir, 'changed-markup-original-view.png'),
  });
  await compatibilityPage.bringToFront();
  await popupPage.reload();
  assert.equal(await readEnabledSetting(popupPage), false);
  await clickPopupEnabledToggle(popupPage);
  await assertRuntimeOwnership(compatibilityPage, true);
  await assertWorkbenchState(compatibilityPage, 'error', 'Unable to read this topic');
  await compatibilityPage.close();

  const topicFixtureUrl = 'https://linux.do/t/synthetic-topic/42/2?docode_fixture=1';
  await context.route(topicFixtureUrl, (route) =>
    route.fulfill({
      body: topicFixtureHtml(),
      contentType: 'text/html',
      status: 200,
    }),
  );
  const topicFixturePage = await context.newPage();
  await topicFixturePage.goto(topicFixtureUrl, { waitUntil: 'domcontentloaded' });
  await assertRuntimeOwnership(topicFixturePage, true);
  await topicFixturePage.locator('.docode-workbench__editor').waitFor();
  await topicFixturePage
    .locator(
      '.docode-workbench__explorer-list[aria-label="Linux DO list routes"] [role="treeitem"]',
    )
    .first()
    .waitFor();
  assert.equal(
    await topicFixturePage
      .locator(
        '.docode-workbench__explorer-list[aria-label="Linux DO list routes"] [role="treeitem"]',
      )
      .count(),
    5,
  );
  await topicFixturePage.bringToFront();
  await topicFixturePage.evaluate(() => window.dispatchEvent(new Event('focus')));
  await topicFixturePage.locator('.docode-workbench__tab[data-window-active="true"]').waitFor();
  const desktopChrome = await readWorkbenchChrome(topicFixturePage);
  assert.deepEqual(desktopChrome, {
    panelTabDisabled: false,
    panelTabHeight: 35,
    panelTabLabel: 'Outline',
    routeGeneration: '0',
    statusLabel: 'Topic 42 · Post 2',
    tabDisabled: false,
    tabHeight: 35,
    tabLabel: 'topic:42',
    tabSelected: 'true',
    windowActive: 'true',
  });
  await topicFixturePage.getByRole('tree', { name: 'Outline for Synthetic topic' }).waitFor();
  const topicAccessibility = await auditDomSemantics(
    topicFixturePage,
    '[data-docode-workbench-root]',
  );
  assert.deepEqual(
    {
      duplicateIds: topicAccessibility.duplicateIds,
      liveRegionsWithControls: topicAccessibility.liveRegionsWithControls,
      missingNames: topicAccessibility.missingNames,
      missingReferences: topicAccessibility.missingReferences,
      unnamedGenericLabels: topicAccessibility.unnamedGenericLabels,
    },
    {
      duplicateIds: [],
      liveRegionsWithControls: [],
      missingNames: [],
      missingReferences: [],
      unnamedGenericLabels: [],
    },
  );
  const topicAx = await readAxSummary(topicFixturePage);
  assertAxNode(topicAx, 'document', 'Topic code document');
  assertAxNode(topicAx, 'article', /private void/u);
  assertAxNode(topicAx, 'tree', 'Outline for Synthetic topic');
  assertAxNode(topicAx, 'slider', 'Topic viewport');
  assertAxNode(topicAx, 'contentinfo', 'DOCode status');
  const topicFloorContrast = await readContrast(
    topicFixturePage,
    '.docode-topic-code__floor',
    '.docode-topic-code__surface',
  );
  assert(contrastRatio(topicFloorContrast) >= 4.5);
  const topicTargets = await readTargetSizes(topicFixturePage, {
    minimapSlider: '.docode-topic-minimap__slider',
    moreActions: '.docode-topic-code__more-actions',
    panelTab: '.docode-workbench__panel-tab:not(:disabled)',
    permalink: '.docode-topic-code__permalink-action',
  });
  assert(
    Object.entries(topicTargets).every(([name, { height, width }]) => {
      const minimum = name === 'moreActions' || name === 'permalink' ? 20 : 22;
      return height >= minimum && width >= minimum;
    }),
    JSON.stringify(topicTargets),
  );
  await topicFixturePage.emulateMedia({ reducedMotion: 'reduce' });
  const reducedMotionTopic = await topicFixturePage
    .locator('.docode-topic-code__action-strip [data-secondary-action="true"]')
    .first()
    .evaluate((element) => ({
      mediaMatches: matchMedia('(prefers-reduced-motion: reduce)').matches,
      transitionDuration: getComputedStyle(element).transitionDuration,
    }));
  assert.deepEqual(reducedMotionTopic, { mediaMatches: true, transitionDuration: '0s' });
  await topicFixturePage.screenshot({
    path: path.join(accessibilityEvidenceDir, 'topic-semantics-reduced-motion.png'),
  });
  await topicFixturePage.emulateMedia({ reducedMotion: 'no-preference' });
  await topicFixturePage
    .locator('.docode-topic-code__reply[data-post-number="2"]')
    .scrollIntoViewIfNeeded();
  await topicFixturePage.getByRole('button', { name: 'Current post 2' }).waitFor();
  const statusCategory = topicFixturePage.getByRole('button', {
    name: 'Current category: Develop',
  });
  const statusFloor = topicFixturePage.getByRole('button', { name: 'Current post 2' });
  const statusMode = topicFixturePage.locator('.docode-workbench__status-item--mode');
  const statusActivity = topicFixturePage.locator('.docode-workbench__status-item--activity');
  const statusBar = topicFixturePage.getByRole('contentinfo', { name: 'DOCode status' });
  assert.equal(await statusCategory.getAttribute('href'), null);
  assert.equal(await statusFloor.getAttribute('href'), null);
  assert.equal(await statusBar.locator('a[href]').count(), 0);
  assert.equal(
    await statusFloor.getAttribute('data-docode-tooltip'),
    'Current visible post: 2. Loaded Linux DO window: posts 1–2.',
  );
  assert.equal(await statusMode.getAttribute('data-mode'), 'code');
  assert.equal(await statusMode.getAttribute('aria-label'), 'Change reading mode');
  assert.match((await statusMode.getAttribute('aria-description')) ?? '', /switch to Doc/u);
  await statusActivity.getByText('Sign in for actions', { exact: true }).waitFor();
  assert.equal(await statusActivity.textContent(), 'Sign in for actions');
  assert.match(
    (await statusActivity.getAttribute('data-docode-tooltip')) ?? '',
    /Like: sign-in required/u,
  );
  await statusMode.hover();
  const statusHover = await statusMode.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      background: style.backgroundColor,
      color: style.color,
      outlineStyle: style.outlineStyle,
    };
  });
  assert.deepEqual(statusHover, {
    background: 'rgba(241, 241, 241, 0.2)',
    color: 'rgb(255, 255, 255)',
    outlineStyle: 'none',
  });
  await topicFixturePage.screenshot({
    path: path.join(fidelityRefinementEvidenceDir, 'status-hover.png'),
  });
  await statusMode.focus();
  assert.equal(
    await statusMode.evaluate((element) => getComputedStyle(element).outlineColor),
    'rgb(0, 120, 212)',
  );
  await topicFixturePage.screenshot({
    path: path.join(fidelityRefinementEvidenceDir, 'status-focus.png'),
  });
  await topicFixturePage.screenshot({
    path: path.join(statusEvidenceDir, 'status-topic-context.png'),
  });
  await statusMode.click();
  await topicFixturePage.getByRole('document', { name: 'Topic document' }).waitFor();
  assert.equal(await statusMode.getAttribute('data-mode'), 'doc');
  assert.match((await statusMode.getAttribute('aria-description')) ?? '', /switch to Code/u);
  await statusMode.click();
  await topicFixturePage.getByRole('document', { name: 'Topic code document' }).waitFor();
  await topicFixturePage.locator('.docode-topic-code__reply[data-post-number="2"]').focus();
  await topicFixturePage
    .locator('.docode-topic-code__reply[data-post-number="2"][data-active="true"]')
    .waitFor();
  const focusedTopicAx = await readAxSummary(topicFixturePage);
  assertAxNode(focusedTopicAx, 'group', 'Post 2 actions');
  const desktopShellGeometry = await readWorkbenchGeometry(topicFixturePage);
  assert.deepEqual(desktopShellGeometry, {
    editorHeight: 639,
    gutterWidth: 56,
    height: 800,
    minimapVisible: true,
    minimapWidth: 120,
    panelHeight: 100,
    sashHeight: 4,
    statusBarHeight: 22,
    width: 1280,
  });
  const terminalTab = topicFixturePage.getByRole('tab', { name: 'Terminal', exact: true });
  const outlineTab = topicFixturePage.getByRole('tab', { name: 'Outline', exact: true });
  await terminalTab.focus();
  await terminalTab.press('ArrowLeft');
  assert.equal(await outlineTab.getAttribute('aria-selected'), 'true');
  assert.equal(await outlineTab.evaluate((element) => element === document.activeElement), true);
  await outlineTab.press('ArrowRight');
  assert.equal(await terminalTab.getAttribute('aria-selected'), 'true');
  assert.equal(await terminalTab.evaluate((element) => element === document.activeElement), true);
  await terminalTab.click();
  const terminalInput = topicFixturePage.getByRole('combobox', {
    name: 'Linux DO command input',
  });
  assert.equal(await terminalInput.evaluate((element) => element === document.activeElement), true);
  await terminalInput.fill('<img>');
  await terminalInput.press('Enter');
  await topicFixturePage.getByText('Unknown command: <img>', { exact: true }).waitFor();
  await topicFixturePage.waitForFunction(
    () => document.activeElement?.getAttribute('aria-label') === 'Linux DO command input',
  );
  const terminalPanel = await readTerminalView(topicFixturePage);
  assert.deepEqual(terminalPanel, {
    actionLabels: [
      'New Terminal Session',
      'Clear Terminal',
      'More Terminal Actions',
      'Maximize Bottom Panel',
      'Close Bottom Panel',
    ],
    activeBorder: 'rgb(231, 231, 231)',
    activeForeground: 'rgb(231, 231, 231)',
    background: 'rgb(30, 30, 30)',
    fontSize: '13px',
    idleSashBackground: 'rgba(0, 0, 0, 0)',
    inactiveForeground: 'rgb(157, 157, 157)',
    inputFocused: true,
    lineHeight: '18px',
    outputState: 'error',
    panelBorderTopColor: 'rgb(43, 43, 43)',
    panelBorderTopWidth: '1px',
    panelTabLabels: ['Problems', 'Output', 'Debug Console', 'Terminal', 'Ports', 'Outline'],
    prompt: 'linux.do %',
    sashHeight: 4,
    sessionLabel: 'linux.do',
    unavailablePanelTabs: ['Problems', 'Output', 'Debug Console', 'Ports'],
    unsafeElementCount: 0,
    viewportPaddingLeft: '20px',
  });
  const terminalTopAlignment = await readTerminalTopAlignment(topicFixturePage);
  assert.equal(terminalTopAlignment.welcomeCount, 0);
  assert(
    terminalTopAlignment.promptTopOffset >= terminalTopAlignment.submittedEntryBottomOffset - 1,
  );
  assert(
    terminalTopAlignment.promptTopOffset <= terminalTopAlignment.submittedEntryBottomOffset + 8,
  );
  assert(terminalTopAlignment.inputWidth >= 300);
  assert.equal(terminalTopAlignment.inputBorderRadius, '0px');
  assert.equal(terminalTopAlignment.inputBorderWidth, '0px');
  assert.equal(terminalTopAlignment.inputBoxShadow, 'none');
  assert(terminalTopAlignment.commandMarkerWidth >= 7);
  assert(terminalTopAlignment.commandMarkerWidth <= 9);
  assert(terminalTopAlignment.promptMarginInlineEnd >= 7);
  assert(terminalTopAlignment.promptMarginInlineEnd <= 9);
  assert(
    Math.abs(
      terminalTopAlignment.inputLeft -
        terminalTopAlignment.promptLabelRight -
        terminalTopAlignment.promptMarginInlineEnd,
    ) <= 1,
  );
  assert(terminalTopAlignment.submittedPromptMarginInlineEnd >= 7);
  assert(terminalTopAlignment.submittedPromptMarginInlineEnd <= 9);
  assert(
    Math.abs(
      terminalTopAlignment.submittedInputLeft -
        terminalTopAlignment.submittedPromptLabelRight -
        terminalTopAlignment.submittedPromptMarginInlineEnd,
    ) <= 1,
  );
  const terminalSurface = topicFixturePage.locator('.docode-terminal');
  const terminalSurfaceBox = await terminalSurface.boundingBox();
  assert(terminalSurfaceBox, 'Expected a rendered Terminal surface');
  await terminalTab.focus();
  assert.equal(
    await terminalInput.evaluate((element) => element === document.activeElement),
    false,
  );
  await terminalSurface.click({
    position: {
      x: Math.floor(terminalSurfaceBox.width - 48),
      y: Math.floor(terminalSurfaceBox.height / 2),
    },
  });
  assert.equal(await terminalInput.evaluate((element) => element === document.activeElement), true);
  await topicFixturePage.keyboard.type('surface-focus');
  assert.equal(await terminalInput.inputValue(), 'surface-focus');
  await topicFixturePage.screenshot({
    path: path.join(terminalSurfaceFocusEvidenceDir, 'terminal-blank-surface-focus.png'),
  });
  await terminalInput.fill('');
  await topicFixturePage.getByRole('button', { name: 'Maximize Bottom Panel' }).click();
  await topicFixturePage.locator('.docode-workbench[data-panel-maximized="true"]').waitFor();
  const maximizedTerminalBox = await terminalSurface.boundingBox();
  assert(maximizedTerminalBox, 'Expected a maximized Terminal surface');
  await terminalSurface.click({
    position: {
      x: Math.floor(maximizedTerminalBox.width - 48),
      y: Math.floor(maximizedTerminalBox.height / 2),
    },
  });
  assert.equal(await terminalInput.evaluate((element) => element === document.activeElement), true);
  await topicFixturePage.keyboard.type('maximized-focus');
  assert.equal(await terminalInput.inputValue(), 'maximized-focus');
  await topicFixturePage.screenshot({
    path: path.join(terminalSurfaceFocusEvidenceDir, 'terminal-maximized-surface-focus.png'),
  });
  await terminalInput.fill('');
  await topicFixturePage.getByRole('button', { name: 'Restore Bottom Panel Size' }).click();
  await topicFixturePage.locator('.docode-workbench[data-panel-maximized="false"]').waitFor();
  await topicFixturePage.screenshot({ path: path.join(evidenceDir, 'terminal-error.png') });
  await topicFixturePage.screenshot({
    path: path.join(transientFidelityEvidenceDir, 'panel-terminal-error.png'),
  });
  await topicFixturePage.screenshot({
    path: path.join(keyboardEvidenceDir, 'terminal-input-focus.png'),
  });
  await topicFixturePage.setViewportSize({ width: 1672, height: 907 });
  await topicFixturePage.screenshot({
    path: path.join(fidelityCorrectionEvidenceDir, 'topic-terminal-wide.png'),
  });
  await topicFixturePage.screenshot({
    path: path.join(platformChromeEvidenceDir, 'terminal-prompt-wide.png'),
  });
  await topicFixturePage.setViewportSize({ width: 1280, height: 800 });
  await outlineTab.click();
  assert.equal(await topicFixturePage.locator('.docode-terminal').isHidden(), true);
  await terminalTab.click();
  await topicFixturePage.getByText('Unknown command: <img>', { exact: true }).waitFor();
  await topicFixturePage.getByRole('button', { name: 'Close Bottom Panel' }).click();
  await topicFixturePage.locator('.docode-workbench[data-panel-open="false"]').waitFor();
  const closedPanelGeometry = await readWorkbenchGeometry(topicFixturePage);
  assert.deepEqual(closedPanelGeometry, {
    editorHeight: 743,
    gutterWidth: 56,
    height: 800,
    minimapVisible: true,
    minimapWidth: 120,
    panelHeight: 0,
    sashHeight: 0,
    statusBarHeight: 22,
    width: 1280,
  });
  const showPanel = topicFixturePage.getByRole('button', { name: 'Show Bottom Panel' });
  assert.equal(await showPanel.evaluate((element) => element === document.activeElement), true);
  assert.equal(await topicFixturePage.locator('.docode-topic-code__surface').isVisible(), true);
  await topicFixturePage.screenshot({ path: path.join(evidenceDir, 'terminal-panel-closed.png') });
  await showPanel.click();
  assert.equal(await terminalInput.evaluate((element) => element === document.activeElement), true);
  await topicFixturePage.getByText('Unknown command: <img>', { exact: true }).waitFor();
  assert.deepEqual(await readWorkbenchGeometry(topicFixturePage), desktopShellGeometry);
  await topicFixturePage.screenshot({
    path: path.join(evidenceDir, 'terminal-panel-reopened.png'),
  });
  await outlineTab.click();
  const topicCodeDocument = await readTopicCodeDocument(topicFixturePage);
  assert.deepEqual(topicCodeDocument, {
    contentFontSize: '13px',
    contentUserSelect: 'text',
    floorCount: 2,
    floorWidth: 56,
    keywordColor: 'rgb(197, 134, 192)',
    keywordFontSize: '13px',
    nativeRootCount: 2,
    postCount: 2,
    requestedLineNumber: '22',
    requestedLineNumberColor: 'rgb(204, 204, 204)',
    sourceNativeRootCount: 0,
    titleColor: 'rgb(78, 201, 176)',
    verticalOverflow: true,
  });
  await topicFixturePage.locator('.docode-topic-code__reply[data-post-number="2"]').hover();
  await topicFixturePage.waitForTimeout(120);
  const replySourceFidelity = await readTopicReplySourceFidelity(topicFixturePage);
  assert.deepEqual(replySourceFidelity, {
    activeLineCount: 1,
    actionOpacity: '1',
    actionVisibility: 'visible',
    authorColor: 'rgb(156, 220, 254)',
    blankLineCount: 0,
    bracketBackground: 'rgba(0, 0, 0, 0)',
    commentColor: 'rgb(106, 153, 85)',
    foldExpanded: 'true',
    keywordColor: 'rgb(86, 156, 214)',
    metadataText: '//#2·Fixture User·November 14, 2023·@unread',
    readState: 'unread',
    replyBackground: 'rgba(0, 0, 0, 0)',
    replyBorderBottomWidth: '0px',
    replyBoxShadow: 'none',
    signatureText: 'private void fixture_user_2() {',
    stringColor: 'rgb(206, 145, 120)',
    stringQuoted: true,
    unreadText: '@unread',
  });
  const unreadReply = topicFixturePage.locator('.docode-topic-code__reply[data-post-number="2"]');
  const unreadEditorLineCount = await topicFixturePage
    .locator('.docode-topic-code__editor-line')
    .count();
  await topicFixturePage.screenshot({
    path: path.join(topicUnreadAnnotationEvidenceDir, 'topic-unread-annotation.png'),
  });
  await topicFixturePage.evaluate(() => {
    document
      .querySelector('#main-outlet article[data-post-id="101"] .read-state')
      ?.classList.add('read');
  });
  await topicFixturePage
    .locator('.docode-topic-code__reply[data-post-number="2"][data-read-state="unknown"]')
    .waitFor();
  assert.equal(await unreadReply.locator('.docode-topic-code__unread-annotation').count(), 0);
  assert.equal(
    await topicFixturePage.locator('.docode-topic-code__editor-line').count(),
    unreadEditorLineCount,
  );
  await topicFixturePage.screenshot({
    path: path.join(topicUnreadAnnotationEvidenceDir, 'topic-unread-annotation-cleared.png'),
  });
  const hardBreakLine = topicFixturePage.locator(
    '.docode-topic-code__reply[data-post-number="2"] .docode-topic-code__content-slot > .cooked > p',
  );
  await hardBreakLine.hover({ position: { x: 24, y: 30 } });
  const hardBreakHoverState = await hardBreakLine.evaluate((paragraph) => {
    const host = paragraph.closest('.docode-topic-code__content-slot');
    const overlay = host?.querySelector(':scope > .docode-topic-code__active-line-overlay');
    if (!(overlay instanceof HTMLElement)) throw new Error('Missing hard-break line overlay.');
    return {
      active: paragraph.classList.contains('docode-topic-code__active-line'),
      overlayHidden: overlay.hidden,
    };
  });
  assert.deepEqual(hardBreakHoverState, { active: false, overlayHidden: true });
  await topicFixturePage.screenshot({
    path: path.join(topicLineSelectionEvidenceDir, 'topic-hover-no-current-line.png'),
  });
  await hardBreakLine.click({ position: { x: 24, y: 30 } });
  const hardBreakActiveLine = await hardBreakLine.evaluate((paragraph) => {
    const firstLine = Number(paragraph.getAttribute('data-docode-editor-line'));
    const lineCount = Number(paragraph.getAttribute('data-docode-editor-line-count'));
    const content = paragraph.closest('.cooked');
    const host = paragraph.closest('.docode-topic-code__content-slot');
    const overlay = host?.querySelector(':scope > .docode-topic-code__active-line-overlay');
    const activeNumber = host?.querySelector('.docode-topic-code__line-number--active');
    const close = paragraph
      .closest('.docode-topic-code__reply')
      ?.querySelector('.docode-topic-code__reply-close');
    if (
      !(content instanceof HTMLElement) ||
      !(host instanceof HTMLElement) ||
      !(overlay instanceof HTMLElement) ||
      !(activeNumber instanceof HTMLElement) ||
      !(close instanceof HTMLElement)
    ) {
      throw new Error('Missing hard-break active-line surfaces.');
    }
    const paragraphRect = paragraph.getBoundingClientRect();
    const overlayRect = overlay.getBoundingClientRect();
    const closeRect = close.getBoundingClientRect();
    const hitTarget = document.elementFromPoint(paragraphRect.left + 24, paragraphRect.top + 30);
    return {
      activeLine: Number(activeNumber.getAttribute('data-docode-line-number')),
      closeClearsContent: closeRect.top >= paragraphRect.bottom - 1,
      contentZIndex: getComputedStyle(content).zIndex,
      hitTargetIsContent: hitTarget === paragraph || paragraph.contains(hitTarget),
      lineCount,
      overlayBackground: getComputedStyle(overlay).backgroundColor,
      overlayInsetCount: getComputedStyle(overlay).boxShadow.split('inset').length - 1,
      overlayOffset: overlayRect.top - paragraphRect.top,
      overlayZIndex: getComputedStyle(overlay).zIndex,
      paragraphHeight: paragraphRect.height,
      secondLine: firstLine + 1,
      text: paragraph.innerText.replace(/\s+/gu, ' ').trim(),
    };
  });
  assert.deepEqual(hardBreakActiveLine, {
    activeLine: hardBreakActiveLine.secondLine,
    closeClearsContent: true,
    contentZIndex: '1',
    hitTargetIsContent: true,
    lineCount: 2,
    overlayBackground: 'rgba(0, 0, 0, 0)',
    overlayInsetCount: 2,
    overlayOffset: 20,
    overlayZIndex: '0',
    paragraphHeight: 40,
    secondLine: hardBreakActiveLine.secondLine,
    text: 'Rendered rich content. Second visible line remains readable.',
  });
  await topicFixturePage.screenshot({
    path: path.join(topicLineSelectionEvidenceDir, 'topic-click-current-line.png'),
  });
  assert.deepEqual(
    await topicFixturePage
      .locator('.docode-workbench__status-items--right .docode-workbench__status-item')
      .allTextContents(),
    [
      'Linux DO',
      'UTF-8',
      'Replies 2 · End',
      `Ln ${String(hardBreakActiveLine.secondLine)}, Col 1`,
      'DOCode',
      'Code',
      'Sign in for actions',
    ],
  );
  await topicFixturePage.screenshot({
    path: path.join(replySourceEvidenceDir, 'reply-source-active.png'),
  });
  const fullWorkbenchTopicChrome = await readFullWorkbenchChrome(
    topicFixturePage,
    '.docode-topic-code__signature',
  );
  assert.deepEqual(fullWorkbenchTopicChrome, {
    activityBarWidth: 48,
    breadcrumbsHeight: 22,
    commandCenterHeight: 22,
    editorLineHeight: 20,
    explorerRouteCount: 5,
    sidebarWidth: 300,
    statusBarHeight: 22,
    titleBarHeight: 35,
  });
  const renderedContentLineCoverage = await readRenderedContentLineCoverage(topicFixturePage);
  assert.equal(renderedContentLineCoverage.decoratedCount > 0, true);
  assert.deepEqual(renderedContentLineCoverage.missingNumbers, []);
  assert.deepEqual(
    renderedContentLineCoverage.renderedNumbers,
    renderedContentLineCoverage.expectedNumbers,
  );
  assert.deepEqual(renderedContentLineCoverage.misalignedNumbers, []);
  assert.deepEqual(renderedContentLineCoverage.missingDocumentNumbers, []);
  assert.deepEqual(renderedContentLineCoverage.duplicateDocumentNumbers, []);
  assert.deepEqual(renderedContentLineCoverage.mispositionedStructuralNumbers, []);
  assert.deepEqual(renderedContentLineCoverage.rhythmMismatches, []);
  const richContentGeometry = await topicFixturePage
    .locator('.docode-topic-code__content-slot > .cooked')
    .first()
    .evaluate((content) => {
      const paragraph = content.querySelector('p');
      const blockquote = content.querySelector('blockquote');
      const figure = content.querySelector('figure');
      if (
        !(paragraph instanceof HTMLElement) ||
        !(blockquote instanceof HTMLElement) ||
        !(figure instanceof HTMLElement)
      ) {
        throw new Error('Missing rich-content spacing fixture.');
      }
      return {
        blockquoteMarginInline: [
          getComputedStyle(blockquote).marginLeft,
          getComputedStyle(blockquote).marginRight,
        ],
        figureMarginInline: [
          getComputedStyle(figure).marginLeft,
          getComputedStyle(figure).marginRight,
        ],
        paragraphMarginBottom: getComputedStyle(paragraph).marginBottom,
      };
    });
  assert.deepEqual(richContentGeometry, {
    blockquoteMarginInline: ['0px', '0px'],
    figureMarginInline: ['0px', '0px'],
    paragraphMarginBottom: '0px',
  });
  const nativeContentCorrection = await readNativeContentCorrection(topicFixturePage);
  assert.deepEqual(nativeContentCorrection, {
    avatarHeight: 16,
    avatarWidth: 16,
    loadingBackground: null,
    loadingText: null,
    mentionBackgrounds: ['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)'],
    mentionBorderRadii: ['0px', '0px'],
    mentionDisplays: ['inline', 'inline'],
    mentionHrefs: ['https://linux.do/u/kaluoer111', 'https://linux.do/u/kaluoer111'],
    mentionPaddings: ['0px', '0px'],
    quoteBackground: 'rgb(43, 43, 43)',
    quoteBodyLineHeight: 20,
    quoteTitleBackground: 'rgba(0, 0, 0, 0)',
    quoteTitleHeight: 20,
    topicCloseBackground: 'rgba(0, 0, 0, 0)',
    topicCloseBorderRadius: '0px',
    topicCloseLineNumber: '39',
  });
  await topicFixturePage
    .locator('.docode-topic-code__content-slot aside.quote')
    .first()
    .evaluate((element) => {
      element.scrollIntoView({ block: 'center' });
    });
  await topicFixturePage.screenshot({
    path: path.join(topicMinimapCorrectionEvidenceDir, 'topic-quote-normalized.png'),
  });
  await topicFixturePage.locator('.docode-topic-code__topic-close').evaluate((element) => {
    element.scrollIntoView({ block: 'end' });
  });
  await topicFixturePage.screenshot({
    path: path.join(topicMinimapCorrectionEvidenceDir, 'topic-final-line.png'),
  });
  await topicFixturePage
    .locator('.docode-topic-code__content-slot > .cooked')
    .first()
    .evaluate((element) => {
      element.scrollIntoView({ block: 'start' });
    });
  await topicFixturePage.screenshot({
    path: path.join(topicFidelityEvidenceDir, 'topic-code-rich-content.png'),
  });
  await topicFixturePage.screenshot({
    path: path.join(fullWorkbenchEvidenceDir, 'topic-code-workbench.png'),
  });
  const imageTrigger = topicFixturePage
    .locator('[data-docode-image-trigger]')
    .filter({ hasText: 'image: Synthetic native image' })
    .first();
  assert.deepEqual(
    await imageTrigger.evaluate((trigger) => {
      const source = trigger.nextElementSibling;
      if (!(source instanceof HTMLImageElement)) throw new Error('Missing native image source.');
      return {
        label: trigger.textContent?.trim(),
        sourceDisplay: getComputedStyle(source).display,
        sourceMarker: source.hasAttribute('data-docode-image-source'),
        triggerHeight: trigger.getBoundingClientRect().height,
      };
    }),
    {
      label: 'image: Synthetic native image',
      sourceDisplay: 'none',
      sourceMarker: true,
      triggerHeight: 20,
    },
  );
  await imageTrigger.hover();
  const imagePreview = topicFixturePage.locator('[data-docode-image-preview]:visible').first();
  await imagePreview.waitFor();
  const imagePreviewState = await imagePreview.evaluate((preview) => {
    const image = preview.querySelector('img');
    if (!(image instanceof HTMLImageElement)) throw new Error('Missing image preview content.');
    const rect = preview.getBoundingClientRect();
    return {
      alt: image.alt,
      bottomWithinViewport: rect.bottom <= innerHeight - 8,
      leftWithinViewport: rect.left >= 8,
      sourceCount: preview.querySelectorAll('img').length,
    };
  });
  assert.deepEqual(imagePreviewState, {
    alt: 'Synthetic native image',
    bottomWithinViewport: true,
    leftWithinViewport: true,
    sourceCount: 1,
  });
  await topicFixturePage.screenshot({
    path: path.join(fullWorkbenchEvidenceDir, 'image-hover-preview.png'),
  });
  await topicFixturePage.mouse.move(1, 1);
  await imagePreview.waitFor({ state: 'hidden' });
  const topicPostAffordances = await readTopicPostAffordances(topicFixturePage);
  assert.deepEqual(topicPostAffordances, {
    actionStripCount: 2,
    activePostNumber: '2',
    availableCopyLinkCount: 2,
    authenticationBookmarkCount: 2,
    authenticationLikeCount: 2,
    enabledNativeActionButtonCount: 2,
    loadingBoundaryCount: 0,
    loadingLabel: '',
    moreActionsCount: 2,
    permalinkCount: 2,
    requestedPostNumber: '2',
  });
  const inactiveLoggedOutReply = topicFixturePage.locator(
    '[data-docode-workbench-root] .docode-topic-code__reply[data-post-number="1"]',
  );
  const inactiveLoggedOutSecondaryAction = inactiveLoggedOutReply
    .locator('[data-secondary-action="true"]')
    .first();
  await topicFixturePage.mouse.move(1, 1);
  assert.equal(
    await inactiveLoggedOutSecondaryAction.evaluate(
      (element) => getComputedStyle(element).visibility,
    ),
    'hidden',
  );
  assert.equal(
    await inactiveLoggedOutReply
      .getByRole('button', { name: 'More actions for post 1' })
      .isVisible(),
    false,
  );
  await inactiveLoggedOutReply.hover();
  assert.equal(
    await inactiveLoggedOutSecondaryAction.evaluate(
      (element) => getComputedStyle(element).visibility,
    ),
    'visible',
  );
  await topicFixturePage.screenshot({
    path: path.join(contextActionEvidenceDir, 'post-hover-actions.png'),
  });
  assert.equal(
    await inactiveLoggedOutReply
      .getByRole('button', { name: 'More actions for post 1' })
      .isVisible(),
    true,
  );
  const requestedLoggedOutReply = topicFixturePage.locator(
    '[data-docode-workbench-root] .docode-topic-code__reply[data-post-number="2"]',
  );
  await requestedLoggedOutReply.waitFor();
  await requestedLoggedOutReply.locator('.docode-topic-code__metadata').first().click();
  await topicFixturePage.waitForFunction(
    () =>
      document
        .querySelector(
          '[data-docode-workbench-root] .docode-topic-code__reply[data-post-number="2"]',
        )
        ?.getAttribute('data-active') === 'true',
  );
  assert.equal(await requestedLoggedOutReply.getAttribute('data-active'), 'true');
  const collapseReply = requestedLoggedOutReply.getByRole('button', {
    name: 'Collapse reply 2',
  });
  assert.equal(await collapseReply.getAttribute('aria-expanded'), 'true');
  await collapseReply.click();
  await requestedLoggedOutReply.locator('.docode-topic-code__fold-placeholder').waitFor();
  assert.deepEqual(
    await topicFixturePage.locator('[data-docode-workbench-root]').evaluate((root) => ({
      collapsed: root
        .querySelector('.docode-topic-code__reply[data-post-number="2"]')
        ?.getAttribute('data-collapsed'),
      nativeRootCount: root.querySelectorAll('.docode-topic-code__content-slot > .cooked').length,
      sourceNativeRootCount: document.querySelectorAll('#main-outlet .cooked').length,
    })),
    { collapsed: 'true', nativeRootCount: 1, sourceNativeRootCount: 1 },
  );
  await topicFixturePage.screenshot({
    path: path.join(replySourceEvidenceDir, 'reply-source-collapsed.png'),
  });
  const expandReply = requestedLoggedOutReply.getByRole('button', { name: 'Expand reply 2' });
  assert.equal(await expandReply.getAttribute('aria-expanded'), 'false');
  await expandReply.click();
  await topicFixturePage.waitForFunction(
    () =>
      document.querySelectorAll('.docode-topic-code__content-slot > .cooked').length === 2 &&
      document.querySelectorAll('#main-outlet .cooked').length === 0,
  );

  const nativeActionFixtureUrl =
    'https://linux.do/t/synthetic-native-actions/43?docode_action_fixture=1';
  let reactionRequestCount = 0;
  let bookmarkRequestCount = 0;
  let postRequestCount = 0;
  await context.route(nativeActionFixtureUrl, (route) =>
    route.fulfill({
      body: authenticatedTopicFixtureHtml(),
      contentType: 'text/html',
      status: 200,
    }),
  );
  await context.route('https://linux.do/t/synthetic-native-actions/43.json', (route) =>
    route.fulfill({
      body: JSON.stringify({
        post_stream: {
          posts: [
            {
              cooked: '<p>Native action verification content.</p>',
              created_at: '2023-11-14T22:13:20.000Z',
              id: 200,
              name: 'Action Author',
              post_number: 1,
              topic_id: 43,
              user_id: 12,
              username: 'action-author',
            },
          ],
          stream: [200],
        },
      }),
      contentType: 'application/json',
      status: 200,
    }),
  );
  await context.route(
    'https://linux.do/discourse-reactions/posts/200/custom-reactions/heart/toggle.json',
    async (route) => {
      reactionRequestCount += 1;
      await new Promise((resolve) => setTimeout(resolve, reactionRequestCount === 1 ? 2_000 : 180));
      await route.fulfill({
        body: JSON.stringify(
          reactionRequestCount === 3
            ? { errors: ['Synthetic reaction failure'] }
            : { current_user_reaction: reactionRequestCount === 1 ? { id: 'heart' } : null },
        ),
        contentType: 'application/json',
        status: reactionRequestCount === 3 ? 500 : 200,
      });
    },
  );
  await context.route('https://linux.do/bookmarks.json', async (route) => {
    bookmarkRequestCount += 1;
    await new Promise((resolve) => setTimeout(resolve, 180));
    await route.fulfill({
      body: JSON.stringify({ id: 900, success: true }),
      contentType: 'application/json',
      status: 200,
    });
  });
  await context.route('https://linux.do/posts', async (route) => {
    postRequestCount += 1;
    await new Promise((resolve) => setTimeout(resolve, 180));
    await route.fulfill({
      body: JSON.stringify(
        postRequestCount === 1
          ? { id: 201, post_number: 2, topic_id: 43 }
          : { errors: ['Synthetic reply rejected.'] },
      ),
      contentType: 'application/json',
      status: postRequestCount === 1 ? 200 : 422,
    });
  });
  const nativeActionErrors = [];
  const nativeActionPage = await context.newPage();
  nativeActionPage.on('pageerror', (error) => nativeActionErrors.push(error.message));
  await nativeActionPage.goto(nativeActionFixtureUrl, { waitUntil: 'domcontentloaded' });
  await assertRuntimeOwnership(nativeActionPage, true);
  await nativeActionPage.getByRole('document', { name: 'Topic code document' }).waitFor();
  const authenticatedActionStatus = nativeActionPage.locator(
    '.docode-workbench__status-item--activity',
  );
  await authenticatedActionStatus.getByText('Actions ready', { exact: true }).waitFor();
  assert.match(
    (await authenticatedActionStatus.getAttribute('data-docode-tooltip')) ?? '',
    /Like: available/u,
  );
  assert.match(
    (await authenticatedActionStatus.getAttribute('data-docode-tooltip')) ?? '',
    /Bookmark: available/u,
  );
  await nativeActionPage.screenshot({
    path: path.join(statusEvidenceDir, 'status-actions-ready.png'),
  });
  const nativeBookmarkAction = nativeActionPage.locator(
    '[data-docode-workbench-root] button[data-action="bookmark"]',
  );
  const nativeReply = nativeActionPage.locator(
    '[data-docode-workbench-root] .docode-topic-code__reply[data-post-number="1"]',
  );
  const nativeMoreActions = nativeReply.locator('button[aria-label="More actions for post 1"]');
  await nativeReply.hover();
  await nativeMoreActions.waitFor();
  assert.notEqual(
    await nativeMoreActions
      .locator('.codicon-ellipsis')
      .evaluate((element) => getComputedStyle(element, '::before').content),
    'none',
  );
  await nativeMoreActions.click();
  const pointerPostMenu = nativeActionPage.getByRole('menu', { name: 'Post 1 actions menu' });
  await pointerPostMenu.waitFor();
  assert.deepEqual(await pointerPostMenu.getByRole('menuitem').allTextContents(), [
    'Reply to Post 1',
    'Like',
    'Bookmark',
    'Copy Post Link',
  ]);
  const postMenuGeometry = await pointerPostMenu.evaluate((menu) => {
    const style = getComputedStyle(menu);
    const firstItem = menu.querySelector('[role="menuitem"]');
    return {
      animationDuration: style.animationDuration,
      borderRadius: style.borderRadius,
      boxShadow: style.boxShadow,
      firstItemBorderRadius: firstItem ? getComputedStyle(firstItem).borderRadius : '',
      firstItemHeight: firstItem?.getBoundingClientRect().height ?? 0,
      width: menu.getBoundingClientRect().width,
    };
  });
  assert.deepEqual(postMenuGeometry, {
    animationDuration: '0.083s',
    borderRadius: '8px',
    boxShadow: 'rgba(0, 0, 0, 0.14) 0px 0px 12px 0px',
    firstItemBorderRadius: '6px',
    firstItemHeight: 24,
    width: 220,
  });
  await nativeActionPage.screenshot({
    path: path.join(contextActionEvidenceDir, 'post-menu-pointer.png'),
  });
  await nativeActionPage.screenshot({
    path: path.join(transientFidelityEvidenceDir, 'post-menu-pointer.png'),
  });
  await pointerPostMenu.getByRole('menuitem', { name: 'Copy Post Link' }).click();
  assert.equal(
    await nativeActionPage.evaluate(() => navigator.clipboard.readText()),
    'https://linux.do/t/synthetic-native-actions/43',
  );
  await nativeActionPage.waitForFunction(
    () => document.activeElement?.getAttribute('aria-label') === 'More actions for post 1',
  );
  await nativeReply.focus();
  await nativeActionPage.keyboard.press('Shift+F10');
  const keyboardPostMenu = nativeActionPage.getByRole('menu', { name: 'Post 1 actions menu' });
  await keyboardPostMenu.waitFor();
  await nativeActionPage.waitForFunction(() => {
    const active = document.activeElement;
    return (
      active?.getAttribute('role') === 'menuitem' &&
      active.textContent?.trim() === 'Reply to Post 1'
    );
  });
  await nativeActionPage.keyboard.press('ArrowDown');
  assert.equal(
    await keyboardPostMenu
      .getByRole('menuitem', { name: 'Like' })
      .evaluate((element) => element === document.activeElement),
    true,
  );
  await nativeActionPage.keyboard.press('Tab');
  assert.equal(
    await keyboardPostMenu
      .getByRole('menuitem', { name: 'Like' })
      .evaluate((element) => element === document.activeElement),
    true,
  );
  await nativeActionPage.screenshot({
    path: path.join(contextActionEvidenceDir, 'post-menu-keyboard.png'),
  });
  await nativeActionPage.screenshot({
    path: path.join(keyboardEvidenceDir, 'post-menu-keyboard.png'),
  });
  await nativeActionPage.keyboard.press('Escape');
  await nativeActionPage.waitForFunction(() =>
    document.activeElement?.matches('.docode-topic-code__reply[data-post-number="1"]'),
  );

  await nativeMoreActions.click();
  const pendingPostMenu = nativeActionPage.getByRole('menu', { name: 'Post 1 actions menu' });
  await pendingPostMenu.getByRole('menuitem', { name: 'Like' }).click();
  await nativeActionPage
    .locator('[data-docode-workbench-root] [data-action="like"][data-state="pending"]')
    .waitFor();
  assert.equal(
    await pendingPostMenu
      .getByRole('menuitem')
      .evaluateAll((items) => items.every((item) => item.hasAttribute('disabled'))),
    true,
  );
  await nativeActionPage.screenshot({
    path: path.join(contextActionEvidenceDir, 'post-menu-pending.png'),
  });
  await nativeActionPage.keyboard.press('Escape');
  await nativeActionPage.getByRole('tab', { name: 'Terminal', exact: true }).click();
  await runTerminalCommand(
    nativeActionPage,
    'like',
    'Linux DO is already processing Like for this post.',
  );
  assert.equal(reactionRequestCount, 1);
  await nativeActionPage.screenshot({
    path: path.join(nativeActionEvidenceDir, 'native-like-pending.png'),
  });
  await nativeActionPage.screenshot({
    path: path.join(actionHardeningEvidenceDir, 'duplicate-like-blocked.png'),
  });
  await nativeActionPage
    .locator('[data-docode-workbench-root] [data-action="like"] .docode-topic-code__action-label', {
      hasText: /^unlike$/u,
    })
    .waitFor({ timeout: 3_000 });
  const confirmedLikeAction = nativeActionPage.locator(
    '[data-docode-workbench-root] button[data-action="like"]',
  );
  await nativeActionPage.waitForFunction(() => {
    const action = document.querySelector(
      '[data-docode-workbench-root] button[data-action="like"]',
    );
    return action?.getAttribute('aria-label') === 'Unlike: liked on Linux DO';
  });
  assert.equal(await confirmedLikeAction.getAttribute('aria-pressed'), 'true');
  assert.equal(await confirmedLikeAction.getAttribute('aria-label'), 'Unlike: liked on Linux DO');
  const likeToast = nativeActionPage.locator(
    '[data-docode-workbench-root] .docode-workbench__notification',
    { hasText: 'Liked post 1.' },
  );
  await likeToast.waitFor();
  assert.equal(await likeToast.getAttribute('data-severity'), 'info');
  assert.match(
    (await likeToast.locator('.docode-workbench__notification-source').textContent()) ?? '',
    /^Source: Linux DO$/u,
  );
  await nativeActionPage.screenshot({
    path: path.join(nativeActionEvidenceDir, 'notification-toast-like.png'),
  });
  await likeToast.getByRole('button', { name: 'Clear Notification' }).click();
  await likeToast.waitFor({ state: 'detached' });
  await nativeReply.hover();
  await nativeMoreActions.waitFor();
  await nativeMoreActions.click();
  await nativeActionPage.getByRole('menuitem', { name: 'Remove Like' }).waitFor();
  await nativeActionPage.screenshot({
    path: path.join(contextActionEvidenceDir, 'post-menu-confirmed.png'),
  });
  await nativeActionPage.keyboard.press('Escape');
  await nativeActionPage.screenshot({
    path: path.join(nativeActionEvidenceDir, 'native-like-confirmed.png'),
  });
  await nativeActionPage.screenshot({
    path: path.join(likeStateTransitionEvidenceDir, 'like-to-unlike-confirmed.png'),
  });

  await nativeBookmarkAction.click();
  await nativeActionPage
    .locator('[data-docode-workbench-root] [data-action="bookmark"][data-state="pending"]')
    .waitFor();
  await nativeActionPage.screenshot({
    path: path.join(nativeActionEvidenceDir, 'native-bookmark-pending.png'),
  });
  await nativeActionPage
    .locator('[data-docode-workbench-root] [data-action="bookmark"]', {
      hasText: 'bookmarked',
    })
    .waitFor({ timeout: 3_000 });
  await nativeActionPage.screenshot({
    path: path.join(nativeActionEvidenceDir, 'native-bookmark-confirmed.png'),
  });

  await nativeActionPage.getByRole('tab', { name: 'Terminal', exact: true }).click();
  await runTerminalCommand(nativeActionPage, 'like', 'Removed Like from post 1.');
  await nativeActionPage.waitForFunction(() => {
    const label = document.querySelector(
      '[data-docode-workbench-root] button[data-action="like"] .docode-topic-code__action-label',
    );
    return label?.textContent?.trim() === 'like';
  });
  assert.equal(await confirmedLikeAction.getAttribute('aria-pressed'), 'false');
  assert.equal(
    await confirmedLikeAction.getAttribute('aria-label'),
    'Like: Linux DO: Toggle Like on Current Post',
  );
  await nativeReply.hover();
  await nativeActionPage.screenshot({
    path: path.join(likeStateTransitionEvidenceDir, 'unlike-to-like-terminal.png'),
  });
  const nativeActionTerminal = await nativeActionPage.locator('.docode-terminal').textContent();
  await nativeActionPage.getByRole('button', { name: 'Open Command Palette' }).click();
  await nativeActionPage
    .getByRole('option', { name: /Linux DO: Toggle Like on Current Post/u })
    .waitFor();
  await nativeActionPage
    .getByRole('option', { name: /Linux DO: Bookmark Current Post/u })
    .waitFor();
  await nativeActionPage.screenshot({
    path: path.join(nativeActionEvidenceDir, 'native-actions-command-palette.png'),
  });
  await nativeActionPage.keyboard.press('Escape');

  await nativeActionPage.locator('[data-docode-workbench-root] button[data-action="like"]').click();
  await nativeActionPage
    .locator('[data-docode-workbench-root] button[data-action="like"][data-state="error"]')
    .waitFor({ timeout: 3_000 });
  const nativeFailureLabel = await nativeActionPage
    .locator('[data-docode-workbench-root] button[data-action="like"][data-state="error"]')
    .getAttribute('aria-label');
  await nativeActionPage.screenshot({
    path: path.join(nativeActionEvidenceDir, 'native-like-failure.png'),
  });
  const nativePostActions = {
    bookmarkRequestCount,
    confirmedLikeLabel: 'unlike',
    failureLabel: nativeFailureLabel,
    likeRequestCount: reactionRequestCount,
    paletteCommands: ['Linux DO: Toggle Like on Current Post', 'Linux DO: Bookmark Current Post'],
    removedLikeLabel: 'like',
    terminalConfirmed: nativeActionTerminal?.includes('Removed Like from post 1.') === true,
  };
  assert.deepEqual(nativePostActions, {
    bookmarkRequestCount: 1,
    confirmedLikeLabel: 'unlike',
    failureLabel: 'Like: Linux DO rejected the Like request.',
    likeRequestCount: 3,
    paletteCommands: ['Linux DO: Toggle Like on Current Post', 'Linux DO: Bookmark Current Post'],
    removedLikeLabel: 'like',
    terminalConfirmed: true,
  });

  const workbenchReplyAction = nativeActionPage.getByRole('button', {
    name: 'Reply to topic with Linux DO composer',
  });
  await workbenchReplyAction.click();
  const pendingReplyAction = nativeActionPage.getByRole('button', {
    name: 'Opening the Linux DO composer…',
  });
  await pendingReplyAction.waitFor();
  await authenticatedActionStatus.getByText('Opening Reply', { exact: true }).waitFor();
  assert.equal(await pendingReplyAction.isDisabled(), true);
  assert.equal(await pendingReplyAction.getAttribute('aria-busy'), 'true');
  await runTerminalCommand(
    nativeActionPage,
    'reply',
    'Linux DO is already opening the Reply composer.',
  );
  const composerOpenRequestCount = await nativeActionPage.evaluate(
    () => globalThis.__docodeComposerOpenCount,
  );
  assert.equal(composerOpenRequestCount, 1);
  await nativeActionPage.screenshot({
    path: path.join(actionHardeningEvidenceDir, 'duplicate-reply-blocked.png'),
  });
  await nativeActionPage.screenshot({
    path: path.join(statusEvidenceDir, 'status-action-pending.png'),
  });
  const nativeComposer = nativeActionPage.getByRole('region', {
    name: 'Linux DO reply composer',
  });
  await nativeComposer.waitFor();
  const nativeComposerEditor = nativeActionPage.getByRole('textbox', { name: 'Reply body' });
  await nativeComposerEditor.waitFor();
  await nativeActionPage.waitForFunction(
    () => document.activeElement?.getAttribute('aria-label') === 'Reply body',
  );
  assert.equal(
    await nativeComposerEditor.evaluate((element) => element === document.activeElement),
    true,
  );
  const nativeComposerOpen = await readNativeComposer(nativeActionPage);
  assert.deepEqual(nativeComposerOpen, {
    dirty: 'false',
    editorUsesWorkbenchUiFont: true,
    exactNativeRootCount: 1,
    nativeRootInSource: false,
    state: 'open',
    title: 'Reply · Linux DO',
  });
  await authenticatedActionStatus.getByText('Reply open', { exact: true }).waitFor();
  await nativeActionPage.screenshot({
    path: path.join(nativeComposerEvidenceDir, 'native-composer-open.png'),
  });
  await nativeActionPage.screenshot({
    path: path.join(transientFidelityEvidenceDir, 'native-composer-open.png'),
  });
  await nativeActionPage.screenshot({
    path: path.join(keyboardEvidenceDir, 'composer-focus-open.png'),
  });
  const composerAccessibility = await auditDomSemantics(
    nativeActionPage,
    '[data-docode-workbench-root]',
  );
  assert.deepEqual(
    {
      liveRegionsWithControls: composerAccessibility.liveRegionsWithControls,
      missingNames: composerAccessibility.missingNames,
      missingReferences: composerAccessibility.missingReferences,
      unnamedGenericLabels: composerAccessibility.unnamedGenericLabels,
    },
    {
      liveRegionsWithControls: [],
      missingNames: [],
      missingReferences: [],
      unnamedGenericLabels: [],
    },
  );
  const composerAx = await readAxSummary(nativeActionPage);
  assertAxNode(composerAx, 'region', 'Linux DO reply composer');
  assertAxNode(composerAx, 'textbox', 'Reply body');
  assertAxNode(composerAx, 'button', 'Reply');
  assertAxNode(composerAx, 'button', 'Discard');
  const composerTargets = await readTargetSizes(nativeActionPage, {
    discard: '.docode-native-composer .discard-button',
    editor: '.docode-native-composer .d-editor-input',
    reply: '.docode-native-composer button.create',
  });
  assert(Object.values(composerTargets).every(({ height, width }) => height >= 28 && width >= 28));
  await nativeActionPage.screenshot({
    path: path.join(accessibilityEvidenceDir, 'native-composer-semantics.png'),
  });

  await nativeComposerEditor.fill('Discarded authoritative draft');
  await nativeActionPage.locator('.docode-native-composer[data-dirty="true"]').waitFor();
  await authenticatedActionStatus.getByText('Reply draft', { exact: true }).waitFor();
  await nativeActionPage
    .locator('.docode-workbench__tab[data-active="true"][data-dirty="true"]')
    .waitFor();
  const dirtyTabFidelity = await nativeActionPage
    .locator('.docode-workbench__tab[data-active="true"][data-dirty="true"]')
    .evaluate((tab) => {
      return {
        topBorderHeight: getComputedStyle(tab, '::before').height,
      };
    });
  assert.deepEqual(dirtyTabFidelity, { topBorderHeight: '2px' });
  await nativeActionPage.screenshot({
    path: path.join(fidelityRefinementEvidenceDir, 'dirty-tab.png'),
  });
  assert.deepEqual(
    await nativeActionPage.locator('[data-docode-workbench-root]').evaluate((root) => {
      const composer = root.querySelector('.docode-native-composer');
      const editor = root.querySelector('#reply-control textarea');
      const activeTab = root.querySelector('.docode-workbench__tab[data-active="true"]');
      if (
        !(composer instanceof HTMLElement) ||
        !(editor instanceof HTMLTextAreaElement) ||
        !(activeTab instanceof HTMLElement)
      ) {
        throw new Error('Missing native Composer state.');
      }
      return {
        composerDirty: composer.dataset.dirty,
        draft: editor.value,
        exactNativeRootCount: root.querySelectorAll('.docode-native-composer #reply-control')
          .length,
        route: location.pathname,
        tabDirty: activeTab.dataset.dirty,
      };
    }),
    {
      composerDirty: 'true',
      draft: 'Discarded authoritative draft',
      exactNativeRootCount: 1,
      route: '/t/synthetic-native-actions/43',
      tabDirty: 'true',
    },
  );
  assert.equal(await nativeComposerEditor.inputValue(), 'Discarded authoritative draft');
  assert.equal(await nativeActionPage.locator('.docode-native-composer #reply-control').count(), 1);
  assert.equal(
    await nativeActionPage
      .locator('.docode-workbench__activity-badge[data-tone="count"]')
      .textContent(),
    '3',
  );
  const accountControl = nativeActionPage.getByRole('button', {
    name: 'Linux DO account, 3 unread notifications',
  });
  assert.equal(await accountControl.count(), 1);
  await accountControl.click();
  const accountMenu = nativeActionPage.getByRole('menu', { name: 'Linux DO notifications' });
  await accountMenu.waitFor();
  const firstNotification = accountMenu.getByRole('menuitem', {
    name: '@fixture-author · Synthetic reply',
  });
  await firstNotification.waitFor();
  assert.equal(
    await firstNotification.getAttribute('href'),
    'https://linux.do/t/synthetic-topic/42/2',
  );
  assert.equal(await firstNotification.getAttribute('data-read'), 'false');
  assert.equal(
    await accountMenu
      .getByRole('menuitem', { name: '@fixture-author · Synthetic like' })
      .getAttribute('data-read'),
    'true',
  );
  const accountMenuItems = accountMenu.getByRole('menuitem');
  assert.equal(await accountMenuItems.count(), 3);
  assert.equal(await accountMenuItems.last().textContent(), 'Preferences');
  assert.equal(await accountMenuItems.last().getAttribute('href'), 'https://linux.do/my/activity');
  await nativeActionPage.screenshot({
    path: path.join(nativeComposerEvidenceDir, 'account-menu-open.png'),
  });
  await nativeActionPage.keyboard.press('Escape');
  await accountMenu.waitFor({ state: 'detached' });
  await nativeActionPage.screenshot({
    path: path.join(nativeComposerEvidenceDir, 'native-composer-dirty.png'),
  });
  const keyboardDiscard = nativeComposer.getByRole('button', { name: 'Discard' });
  await keyboardDiscard.focus();
  await keyboardDiscard.press('Enter');
  await nativeComposer.waitFor({ state: 'detached' });
  assert.equal(
    await nativeActionPage.locator('#native-composer-source > #reply-control').count(),
    1,
  );
  await nativeActionPage.waitForFunction(
    () =>
      document
        .querySelector('.docode-workbench__tab[data-active="true"]')
        ?.getAttribute('data-dirty') === null,
    undefined,
    { timeout: 3_000 },
  );
  await nativeActionPage.waitForFunction(
    () =>
      document.activeElement?.getAttribute('aria-label') ===
      'Reply to topic with Linux DO composer',
  );
  assert.equal(
    await workbenchReplyAction.evaluate((element) => getComputedStyle(element).outlineColor),
    'rgb(0, 120, 212)',
  );
  await nativeActionPage.screenshot({
    path: path.join(keyboardEvidenceDir, 'composer-discard-focus-return.png'),
  });

  await runTerminalCommand(nativeActionPage, 'reply', 'Opened the native Linux DO Reply composer.');
  assert.equal(
    await nativeActionPage.locator('.docode-terminal__prompt-label').last().textContent(),
    'linux.do/fixture-user %',
  );
  await nativeComposer.waitFor();
  await nativeActionPage.waitForFunction(
    () => document.activeElement?.getAttribute('aria-label') === 'Reply body',
  );
  await nativeComposerEditor.fill('Confirmed native reply');
  await nativeComposer.getByRole('button', { name: 'Reply', exact: true }).click();
  await nativeActionPage.locator('.docode-native-composer[data-state="saving"]').waitFor();
  await authenticatedActionStatus.getByText('Submitting Reply', { exact: true }).waitFor();
  await nativeActionPage.screenshot({
    path: path.join(nativeComposerEvidenceDir, 'native-composer-submitting.png'),
  });
  await nativeComposer.waitFor({ state: 'detached', timeout: 3_000 });
  try {
    await nativeActionPage
      .locator('[data-docode-workbench-root] [data-post-number="2"]')
      .waitFor({ timeout: 3_000 });
  } catch (error) {
    const diagnostic = await nativeActionPage.evaluate(() => ({
      composerClass: document.querySelector('#reply-control')?.className ?? null,
      nativePostIds: Array.from(document.querySelectorAll('.post-stream article')).map((article) =>
        article.getAttribute('data-post-id'),
      ),
      nativePostNumbers: Array.from(
        document.querySelectorAll('.post-stream [data-post-number]'),
      ).map((post) => post.getAttribute('data-post-number')),
      status:
        document.querySelector('.docode-workbench__status-item--activity')?.textContent ?? null,
      workbenchPostNumbers: Array.from(
        document.querySelectorAll('[data-docode-workbench-root] [data-post-number]'),
      ).map((post) => post.getAttribute('data-post-number')),
    }));
    throw new Error(`Submitted reply was not rendered. ${JSON.stringify(diagnostic)}`, {
      cause: error,
    });
  }
  await authenticatedActionStatus.getByText('Reply submitted', { exact: true }).waitFor();
  await nativeActionPage.waitForFunction(
    () =>
      document
        .querySelector('[data-docode-workbench-root] [data-post-number="2"] .cooked')
        ?.textContent?.trim() === 'Confirmed native reply',
    undefined,
    { timeout: 3_000 },
  );
  assert.equal(
    await nativeActionPage
      .locator('[data-docode-workbench-root] [data-post-number="2"] .cooked')
      .textContent(),
    'Confirmed native reply',
  );
  await nativeActionPage.waitForFunction(
    () => document.activeElement?.getAttribute('aria-label') === 'Linux DO command input',
  );
  await nativeActionPage.screenshot({
    path: path.join(nativeComposerEvidenceDir, 'native-composer-submitted.png'),
  });

  await nativeActionPage.getByRole('button', { name: 'Open Command Palette' }).click();
  const composerPaletteInput = nativeActionPage.getByRole('combobox', {
    name: 'Type the name of a command',
  });
  await composerPaletteInput.fill('reply to topic');
  const composerPaletteOption = nativeActionPage.getByRole('option', {
    name: /Linux DO: Reply to Topic/u,
  });
  await composerPaletteOption.waitFor();
  await nativeActionPage.screenshot({
    path: path.join(nativeComposerEvidenceDir, 'native-composer-command-palette.png'),
  });
  await composerPaletteInput.press('Enter');
  await nativeComposer.waitFor();
  await nativeActionPage.getByRole('dialog', { name: 'Command Palette' }).waitFor({
    state: 'detached',
  });
  await nativeActionPage.waitForFunction(
    () => document.activeElement?.getAttribute('aria-label') === 'Reply body',
  );
  await nativeActionPage.screenshot({
    path: path.join(keyboardEvidenceDir, 'palette-composer-focus.png'),
  });
  await nativeComposerEditor.fill('Rejected authoritative draft');
  await nativeComposer.getByRole('button', { name: 'Reply', exact: true }).click();
  const composerFeedbackAlert = nativeComposer.locator(
    '.docode-native-composer__state[role="alert"]',
  );
  await composerFeedbackAlert.waitFor({ timeout: 3_000 });
  await nativeComposer.locator('#reply-control .popup-tip.bad').waitFor();
  assert.equal(
    await nativeComposer.locator('#reply-control .popup-tip.bad').textContent(),
    'Synthetic reply rejected.',
  );
  await authenticatedActionStatus.getByText('Reply failed', { exact: true }).waitFor();
  assert.equal(await authenticatedActionStatus.getAttribute('data-tone'), 'error');
  assert.equal(await nativeComposerEditor.inputValue(), 'Rejected authoritative draft');
  assert.match((await composerFeedbackAlert.textContent()) ?? '', /rejected/u);
  await nativeActionPage.screenshot({
    path: path.join(nativeComposerEvidenceDir, 'native-composer-failure.png'),
  });
  await nativeActionPage.setViewportSize({ height: 640, width: 420 });
  assert.equal(await authenticatedActionStatus.isVisible(), true);
  const nativeComposerNarrow = await nativeComposer.evaluate((surface) => {
    const rect = surface.getBoundingClientRect();
    return {
      bottom: rect.bottom,
      height: rect.height,
      left: rect.left,
      right: rect.right,
      width: rect.width,
    };
  });
  assert.deepEqual(nativeComposerNarrow, {
    bottom: 618,
    height: 384,
    left: 48,
    right: 420,
    width: 372,
  });
  await nativeActionPage.screenshot({
    path: path.join(nativeComposerEvidenceDir, 'native-composer-narrow.png'),
  });
  await nativeActionPage.screenshot({
    path: path.join(transientFidelityEvidenceDir, 'native-composer-narrow.png'),
  });
  await nativeActionPage.screenshot({
    path: path.join(statusEvidenceDir, 'status-narrow-error.png'),
  });
  await nativeActionPage.setViewportSize({ height: 800, width: 1280 });

  await nativeComposer.getByRole('button', { name: 'Discard', exact: true }).click();
  await nativeComposer.waitFor({ state: 'detached' });
  await nativeActionPage.evaluate(() => {
    const footer = document.querySelector('#topic-footer-buttons');
    globalThis.__docodeFooterStash = footer;
    footer.remove();
    const composer = document.querySelector('#reply-control');
    document.body.addEventListener('keypress', (event) => {
      if (event.shiftKey && event.which === 82) {
        composer.className = 'open hide-preview';
      }
    });
  });
  await runTerminalCommand(nativeActionPage, 'reply', 'Opened the native Linux DO Reply composer.');
  await nativeComposer.waitFor();
  await nativeActionPage.screenshot({
    path: path.join(nativeComposerEvidenceDir, 'native-composer-shortcut-bridge.png'),
  });
  await nativeComposer.getByRole('button', { name: 'Discard', exact: true }).click();
  await nativeComposer.waitFor({ state: 'detached' });
  await nativeActionPage.evaluate(() => {
    const composer = document.querySelector('#reply-control');
    const opens = [];
    globalThis.__docodePostReplyOpens = opens;
    const topic = {
      draft_key: 'topic_43',
      draft_sequence: 5,
      id: 43,
      postStream: {
        findPostsByIds: (postIds) =>
          Promise.resolve(postIds.map((postId) => ({ id: postId, post_number: 2 }))),
        posts: [],
      },
    };
    globalThis.Discourse = {
      __container__: {
        lookup(name) {
          if (name === 'controller:topic') return { model: topic };
          if (name !== 'service:composer') return null;
          return {
            open(options) {
              opens.push({
                action: options.action,
                draftKey: options.draftKey,
                draftSequence: options.draftSequence,
                postNumber: options.post ? options.post.post_number : null,
                topicId: options.topic ? options.topic.id : null,
              });
              composer.className = 'open hide-preview';
              return Promise.resolve();
            },
          };
        },
      },
    };
  });
  await runTerminalCommand(
    nativeActionPage,
    'reply 2',
    'Opened the native Linux DO Reply composer.',
  );
  await nativeComposer.waitFor();
  assert.deepEqual(await nativeActionPage.evaluate(() => globalThis.__docodePostReplyOpens), [
    { action: 'reply', draftKey: 'topic_43', draftSequence: 5, postNumber: 2, topicId: 43 },
  ]);
  await nativeActionPage.screenshot({
    path: path.join(nativeComposerEvidenceDir, 'native-composer-post-bridge.png'),
  });
  await nativeComposer.getByRole('button', { name: 'Discard', exact: true }).click();
  await nativeComposer.waitFor({ state: 'detached' });
  await nativeActionPage.evaluate(() => {
    delete globalThis.Discourse;
    delete globalThis.__docodePostReplyOpens;
  });
  await nativeActionPage.evaluate(() => {
    document.querySelector('#main-outlet')?.append(globalThis.__docodeFooterStash);
    delete globalThis.__docodeFooterStash;
  });
  await runTerminalCommand(nativeActionPage, 'doctor', 'reply available via footer');
  await nativeActionPage.getByText(/^build \d+\.\d+\.\d+/u).waitFor();
  await runTerminalCommand(nativeActionPage, 'reply', 'Opened the native Linux DO Reply composer.');
  await nativeComposer.waitFor();
  await nativeComposerEditor.fill('Rejected authoritative draft');

  await nativeActionPage.bringToFront();
  await popupPage.reload();
  await clickPopupEnabledToggle(popupPage);
  await assertRuntimeOwnership(nativeActionPage, false);
  assert.equal(
    await nativeActionPage.locator('#native-composer-source > #reply-control').count(),
    1,
  );
  assert.equal(
    await nativeActionPage.getByRole('textbox', { name: 'Reply body' }).inputValue(),
    'Rejected authoritative draft',
  );
  await nativeActionPage.screenshot({
    path: path.join(nativeComposerEvidenceDir, 'native-composer-restored.png'),
  });
  await clickPopupEnabledToggle(popupPage);
  await assertRuntimeOwnership(nativeActionPage, true);
  await nativeComposer.waitFor();
  assert.equal(await nativeComposerEditor.inputValue(), 'Rejected authoritative draft');
  await nativeComposer.getByRole('button', { name: 'Discard' }).click();
  await nativeComposer.waitFor({ state: 'detached' });
  await nativeActionPage.waitForFunction(
    () =>
      document.activeElement?.getAttribute('aria-label') ===
      'Reply to topic with Linux DO composer',
  );

  const nativeComposerFlow = {
    cancelRestoredNativeRoot: true,
    commandSurfaces: ['editor action', 'Terminal', 'Command Palette'],
    failurePreservedDraft: true,
    postRequestCount,
    restorationPreservedDraft: true,
    submittedPostCount: await nativeActionPage
      .locator('[data-docode-workbench-root] [data-post-number]')
      .count(),
  };
  assert.deepEqual(nativeComposerFlow, {
    cancelRestoredNativeRoot: true,
    commandSurfaces: ['editor action', 'Terminal', 'Command Palette'],
    failurePreservedDraft: true,
    postRequestCount: 2,
    restorationPreservedDraft: true,
    submittedPostCount: 2,
  });
  assert.deepEqual(nativeActionErrors, []);
  await nativeActionPage.close();

  const topicOutline = await readTopicOutline(topicFixturePage);
  assert.deepEqual(topicOutline, {
    activeSelectionBackground: 'rgb(55, 55, 61)',
    firstPostHref: 'https://linux.do/t/synthetic-topic/42',
    headingCount: 2,
    headingIndent: 16,
    headingSymbolColor: 'rgb(117, 190, 255)',
    loadingAdditional: false,
    postCount: 2,
    postSymbolColor: 'rgb(177, 128, 215)',
    rowCount: 4,
    rowHeight: 22,
    selectedPostNumber: '2',
    treeRole: 'tree',
  });
  const outlineFidelity = await topicFixturePage.evaluate(() => {
    const expandableItems = Array.from(
      document.querySelectorAll('.docode-topic-outline__item[aria-expanded]'),
    );
    const firstTwistie = document.querySelector('.docode-topic-outline__twistie');
    if (!(firstTwistie instanceof HTMLElement)) throw new Error('Missing Outline twistie.');
    return {
      chevronDownCount: document.querySelectorAll(
        '.docode-topic-outline__twistie .codicon-chevron-down',
      ).length,
      expandedCount: expandableItems.filter((item) => item.getAttribute('aria-expanded') === 'true')
        .length,
      twistieHeight: firstTwistie.getBoundingClientRect().height,
      twistieWidth: firstTwistie.getBoundingClientRect().width,
    };
  });
  assert.deepEqual(outlineFidelity, {
    chevronDownCount: 2,
    expandedCount: 2,
    twistieHeight: 22,
    twistieWidth: 16,
  });
  const topicMinimap = await readTopicMinimap(topicFixturePage);
  assert.equal(topicMinimap.state, 'ready');
  assert.equal(topicMinimap.markCount, 2);
  assert.equal(topicMinimap.firstPostHref, 'https://linux.do/t/synthetic-topic/42');
  assert.deepEqual(topicMinimap.loadedRange, { maximum: 2, minimum: 1 });
  assert(topicMinimap.sliderHeight >= 12);
  assert(topicMinimap.sliderHeight <= topicMinimap.trackHeight);
  assert(topicMinimap.sliderProgress >= 0 && topicMinimap.sliderProgress <= 1);
  assert(topicMinimap.sliderSize > 0 && topicMinimap.sliderSize <= 1);
  assert.deepEqual(topicMinimap.markerKinds, [
    'original-post heading code media',
    'heading code media requested current',
  ]);
  assert.equal(topicMinimap.glyphCount, 36);
  assert.equal(topicMinimap.glyphFirstText, 'import LinuxDo.Topic;');
  assert.equal(topicMinimap.glyphLastLineNumber, 39);
  assert.equal(topicMinimap.glyphLastText, '}');
  assert(topicMinimap.glyphTexts.includes('Ander:'));
  assert(topicMinimap.glyphTones.includes('quote'));
  assert.equal(topicMinimap.uniqueGlyphTops, 36);
  assert.equal(topicMinimap.glyphFontSize, '2px');
  assert.equal(topicMinimap.glyphLineHeight, '3px');
  assert.equal(topicMinimap.glyphOpacity, '0.9');
  assert.equal(topicMinimap.markAnchorWidth, 12);
  assert.equal(topicMinimap.markIndicatorWidth, '2px');
  await topicFixturePage.mouse.move(1, 1);
  await topicFixturePage.waitForFunction(
    () => getComputedStyle(document.querySelector('.docode-topic-minimap__slider')).opacity === '0',
  );
  const minimapDefaultOpacity = await topicFixturePage
    .getByRole('slider', { name: 'Topic viewport' })
    .evaluate((element) => getComputedStyle(element).opacity);
  assert.equal(minimapDefaultOpacity, '0');
  await topicFixturePage.screenshot({ path: path.join(evidenceDir, 'topic-minimap-normal.png') });
  await topicFixturePage.screenshot({
    path: path.join(topicFidelityEvidenceDir, 'minimap-normal.png'),
  });
  await topicFixturePage.screenshot({
    path: path.join(topicMinimapCorrectionEvidenceDir, 'topic-minimap-microtext.png'),
  });
  const outlinePostTwo = topicFixturePage.getByRole('treeitem', {
    name: 'Open post 2 by @fixture-user',
  });
  const outlineModifierClick = await outlinePostTwo.evaluate((element) => {
    let preventedBeforeNativeDefault = null;
    element.addEventListener(
      'click',
      (event) => {
        preventedBeforeNativeDefault = event.defaultPrevented;
        event.preventDefault();
      },
      { once: true },
    );
    element.dispatchEvent(
      new MouseEvent('click', { bubbles: true, button: 0, cancelable: true, ctrlKey: true }),
    );
    return { ctrlKey: true, preventedBeforeNativeDefault };
  });
  assert.deepEqual(outlineModifierClick, {
    ctrlKey: true,
    preventedBeforeNativeDefault: false,
  });
  const minimapPostTwo = topicFixturePage.getByRole('link', {
    name: 'Open post 2 from minimap',
  });
  const minimapModifierClick = await minimapPostTwo.evaluate((element) => {
    let preventedBeforeNativeDefault = null;
    element.addEventListener(
      'click',
      (event) => {
        preventedBeforeNativeDefault = event.defaultPrevented;
        event.preventDefault();
      },
      { once: true },
    );
    element.dispatchEvent(
      new MouseEvent('click', { bubbles: true, button: 0, cancelable: true, ctrlKey: true }),
    );
    return { ctrlKey: true, preventedBeforeNativeDefault };
  });
  assert.deepEqual(minimapModifierClick, {
    ctrlKey: true,
    preventedBeforeNativeDefault: false,
  });
  await outlinePostTwo.focus();
  await outlinePostTwo.press('ArrowLeft');
  assert.equal(await outlinePostTwo.getAttribute('aria-expanded'), 'false');
  assert.equal(
    await topicFixturePage
      .getByRole('treeitem', { name: 'Open heading Fixture section in post 2' })
      .count(),
    0,
  );
  await topicFixturePage.screenshot({
    path: path.join(topicFidelityEvidenceDir, 'outline-collapsed.png'),
  });
  await outlinePostTwo.press('ArrowRight');
  assert.equal(await outlinePostTwo.getAttribute('aria-expanded'), 'true');
  await topicFixturePage
    .getByRole('treeitem', { name: 'Open heading Fixture section in post 2' })
    .waitFor();
  await topicFixturePage.screenshot({
    path: path.join(topicFidelityEvidenceDir, 'outline-expanded.png'),
  });
  const outlinePostTwoTwistie = outlinePostTwo.locator('[data-outline-twistie="true"]');
  await outlinePostTwoTwistie.click();
  assert.equal(await outlinePostTwo.getAttribute('aria-expanded'), 'false');
  await outlinePostTwoTwistie.click();
  assert.equal(await outlinePostTwo.getAttribute('aria-expanded'), 'true');
  await topicFixturePage
    .getByRole('treeitem', { name: 'Open heading Fixture section in post 2' })
    .waitFor();
  await outlinePostTwo.press('ArrowRight');
  assert.equal(
    await topicFixturePage.evaluate(() => document.activeElement?.getAttribute('data-kind')),
    'heading',
  );
  await topicFixturePage
    .getByRole('treeitem', { name: 'Open heading Fixture section in post 2' })
    .press('ArrowLeft');
  assert.equal(
    await topicFixturePage.evaluate(() => document.activeElement?.getAttribute('data-kind')),
    'post',
  );
  await outlinePostTwo.press('Home');
  assert.equal(
    await topicFixturePage.evaluate(() => document.activeElement?.getAttribute('aria-label')),
    'Open post 1 by @fixture-user',
  );
  await topicFixturePage.screenshot({ path: path.join(evidenceDir, 'topic-outline-focus.png') });

  await installSyntheticTabNavigation(topicFixturePage);
  const outlinePostOne = topicFixturePage.getByRole('treeitem', {
    name: 'Open post 1 by @fixture-user',
  });
  await outlinePostOne.press('Enter');
  await topicFixturePage.waitForURL('https://linux.do/t/synthetic-topic/42');
  await topicFixturePage.waitForFunction(
    () =>
      document.activeElement?.matches('.docode-topic-code__reply[data-post-number="1"]') === true &&
      document.activeElement?.getAttribute('data-active') === 'true',
  );
  const routedOutlinePostTwo = topicFixturePage.getByRole('treeitem', {
    name: 'Open post 2 by @fixture-user',
  });
  await routedOutlinePostTwo.click();
  await topicFixturePage.waitForURL('https://linux.do/t/synthetic-topic/42/2');
  await topicFixturePage.waitForFunction(
    () =>
      document.activeElement?.matches('.docode-topic-code__reply[data-post-number="2"]') === true &&
      document.activeElement?.getAttribute('data-active') === 'true',
  );
  await topicFixturePage.screenshot({
    path: path.join(evidenceDir, 'topic-outline-navigation.png'),
  });
  const minimapPostOne = topicFixturePage.getByRole('link', {
    name: 'Open post 1 from minimap',
  });
  await waitForUiStability(topicFixturePage);
  await minimapPostOne.press('Enter');
  await topicFixturePage.waitForURL('https://linux.do/t/synthetic-topic/42');
  await topicFixturePage.waitForFunction(
    () =>
      document.activeElement?.matches('.docode-topic-code__reply[data-post-number="1"]') === true &&
      document.activeElement?.getAttribute('data-active') === 'true',
  );
  await waitForUiStability(topicFixturePage);
  await topicFixturePage.getByRole('link', { name: 'Open post 2 from minimap' }).click();
  await topicFixturePage.waitForURL('https://linux.do/t/synthetic-topic/42/2');
  await topicFixturePage.waitForFunction(
    () =>
      document.activeElement?.matches('.docode-topic-code__reply[data-post-number="2"]') === true &&
      document.activeElement?.getAttribute('data-active') === 'true',
  );
  await topicFixturePage.screenshot({
    path: path.join(evidenceDir, 'topic-minimap-navigation.png'),
  });
  assert.equal(
    await topicFixturePage.getByRole('link', { name: 'Post 2 permalink' }).getAttribute('href'),
    'https://linux.do/t/synthetic-topic/42/2',
  );
  const nativeRichLink = topicFixturePage.getByRole('link', { name: 'rich content' }).first();
  assert.equal(await nativeRichLink.getAttribute('href'), 'https://example.com/reference');
  await topicFixturePage.keyboard.press('Tab');
  await nativeRichLink.focus();
  assert.equal(
    await nativeRichLink.evaluate((element) => element === document.activeElement),
    true,
  );
  assert.equal(
    await nativeRichLink.evaluate((element) => getComputedStyle(element).outlineColor),
    'rgb(0, 120, 212)',
  );
  const selectedNativeText = await topicFixturePage
    .locator('#native-cooked-1 p')
    .first()
    .evaluate((paragraph) => {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(paragraph);
      selection?.removeAllRanges();
      selection?.addRange(range);
      return selection?.toString() ?? '';
    });
  assert(selectedNativeText.includes('Rendered rich content.'));
  await topicFixturePage.screenshot({ path: path.join(evidenceDir, 'topic-code-desktop.png') });
  await topicFixturePage.screenshot({
    path: path.join(topicFidelityEvidenceDir, 'topic-code-desktop.png'),
  });
  await topicFixturePage.screenshot({
    path: path.join(fidelityRefinementEvidenceDir, 'shell-editor-desktop.png'),
  });
  await terminalTab.click();
  await terminalInput.fill('clear');
  await terminalInput.press('Enter');
  await topicFixturePage.waitForFunction(
    () => document.querySelectorAll('.docode-terminal__entry').length === 0,
  );
  await terminalInput.press('Tab');
  const readyCompletion = await readTerminalCompletionPromptState(topicFixturePage);
  assert.deepEqual(readyCompletion, { inputExpanded: null, optionCount: 0 });
  const terminalSuggestionFidelity = { visible: false };
  await topicFixturePage.screenshot({
    path: path.join(evidenceDir, 'terminal-no-completion-prompt-ready.png'),
  });
  await topicFixturePage.screenshot({
    path: path.join(transientFidelityEvidenceDir, 'terminal-no-completion-prompt-ready.png'),
  });
  await topicFixturePage.screenshot({
    path: path.join(terminalPromptRemovalEvidenceDir, 'terminal-no-completion-prompt-ready.png'),
  });
  await runTerminalCommand(topicFixturePage, 'help', 'Available commands:');
  await topicFixturePage
    .getByText('goto <floor> — Open a post floor in the current topic')
    .waitFor();
  await topicFixturePage.getByText('mode <code|doc> — Set the reading mode').waitFor();
  await topicFixturePage.screenshot({ path: path.join(evidenceDir, 'terminal-command-help.png') });

  await runTerminalCommand(topicFixturePage, 'ld', 'DOCode virtual Linux session');
  await topicFixturePage
    .getByText('Extension-local filesystem ready. No host shell is executed.', { exact: true })
    .waitFor();
  assert.equal(
    await topicFixturePage
      .locator('.docode-terminal__prompt > .docode-terminal__prompt-label')
      .textContent(),
    'guest@linux.do:~$',
  );
  await runTerminalCommand(topicFixturePage, 'pwd', '/home/guest');
  await terminalInput.fill('cd work');
  assert.deepEqual(await readTerminalCompletionPromptState(topicFixturePage), {
    inputExpanded: null,
    optionCount: 0,
  });
  await topicFixturePage.screenshot({
    path: path.join(terminalTabCompletionEvidenceDir, 'terminal-path-completion.png'),
  });
  await topicFixturePage.screenshot({
    path: path.join(terminalPromptRemovalEvidenceDir, 'terminal-no-completion-prompt-ld.png'),
  });
  await terminalInput.press('Tab');
  assert.equal(await terminalInput.inputValue(), 'cd workspace/');
  await topicFixturePage.screenshot({
    path: path.join(terminalPromptRemovalEvidenceDir, 'terminal-unique-tab-completion.png'),
  });
  await terminalInput.press('Enter');
  await topicFixturePage
    .locator('.docode-terminal__prompt > .docode-terminal__prompt-label')
    .filter({ hasText: 'guest@linux.do:~/workspace$' })
    .waitFor();
  await runTerminalCommand(topicFixturePage, 'cd ~', '/home/guest');
  await runTerminalCommand(topicFixturePage, 'mkdir -p workspace/demo', 'Command completed.');
  await runTerminalCommand(
    topicFixturePage,
    'echo "terminal ready" > workspace/demo/readme.txt',
    'Command completed.',
  );
  await runTerminalCommand(topicFixturePage, 'cat workspace/demo/readme.txt', 'terminal ready');
  await runTerminalCommand(topicFixturePage, 'docode help', 'Available commands:');
  await topicFixturePage.screenshot({ path: path.join(evidenceDir, 'terminal-virtual-linux.png') });
  await runTerminalCommand(topicFixturePage, 'exit', 'Left the virtual Linux session.');
  assert.equal(
    await topicFixturePage
      .locator('.docode-terminal__prompt > .docode-terminal__prompt-label')
      .textContent(),
    'linux.do %',
  );

  await terminalInput.fill('m');
  assert.deepEqual(await readTerminalCompletionPromptState(topicFixturePage), {
    inputExpanded: null,
    optionCount: 0,
  });
  await terminalInput.press('Tab');
  assert.equal(await terminalInput.inputValue(), 'mode ');
  await terminalInput.pressSequentially('doc');
  await terminalInput.press('Enter');
  await topicFixturePage.getByText('Reading mode: Doc.', { exact: true }).waitFor();
  await topicFixturePage.getByRole('document', { name: 'Topic document' }).waitFor();
  await topicFixturePage.screenshot({ path: path.join(evidenceDir, 'terminal-command-mode.png') });
  await runTerminalCommand(topicFixturePage, 'mode code', 'Reading mode: Code.');
  await topicFixturePage.getByRole('document', { name: 'Topic code document' }).waitFor();

  await runTerminalCommand(topicFixturePage, 'goto 1', 'Opened post 1.');
  await topicFixturePage.waitForURL('https://linux.do/t/synthetic-topic/42/1');
  await topicFixturePage.goBack();
  await topicFixturePage.waitForURL('https://linux.do/t/synthetic-topic/42/2');
  await topicFixturePage.getByText('Opened post 1.', { exact: true }).waitFor();
  await topicFixturePage.goForward();
  await topicFixturePage.waitForURL('https://linux.do/t/synthetic-topic/42/1');
  await topicFixturePage.goBack();
  await topicFixturePage.waitForURL('https://linux.do/t/synthetic-topic/42/2');
  await runTerminalCommand(topicFixturePage, 'open /t/synthetic-topic/42/1', 'Opened topic 42.');
  await topicFixturePage.waitForURL('https://linux.do/t/synthetic-topic/42/1');
  await topicFixturePage.goBack();
  await topicFixturePage.waitForURL('https://linux.do/t/synthetic-topic/42/2');
  await topicFixturePage.screenshot({
    path: path.join(evidenceDir, 'terminal-command-navigation.png'),
  });

  await topicFixturePage.evaluate(() => {
    globalThis.__docodeCommandNavigationOverride = '/top';
  });
  await runTerminalCommand(
    topicFixturePage,
    'goto 999',
    'Navigation context changed before the target was confirmed.',
  );
  await topicFixturePage.waitForURL('https://linux.do/top');
  assert.equal(await topicFixturePage.getByText('Opened post 999.', { exact: true }).count(), 0);
  await topicFixturePage.screenshot({ path: path.join(evidenceDir, 'terminal-command-stale.png') });
  await topicFixturePage.goBack();
  await topicFixturePage.waitForURL('https://linux.do/t/synthetic-topic/42/2');
  await topicFixturePage.getByRole('button', { exact: true, name: 'Close top' }).click();

  await runTerminalCommand(topicFixturePage, 'hot', 'Opened hot topics.');
  await topicFixturePage.waitForURL('https://linux.do/hot');
  await topicFixturePage.goBack();
  await topicFixturePage.waitForURL('https://linux.do/t/synthetic-topic/42/2');
  await topicFixturePage.getByText('Opened hot topics.', { exact: true }).waitFor();
  await topicFixturePage.getByRole('document', { name: 'Topic code document' }).waitFor();
  await topicFixturePage.getByRole('button', { exact: true, name: 'Close hot' }).click();
  await terminalInput.waitFor({ state: 'visible' });

  await terminalInput.fill('draft command');
  await waitForUiStability(topicFixturePage);
  await terminalInput.press('ArrowUp');
  assert.equal(await terminalInput.inputValue(), 'hot');
  await topicFixturePage.screenshot({ path: path.join(evidenceDir, 'terminal-history.png') });
  await terminalInput.press('ArrowUp');
  assert.equal(await terminalInput.inputValue(), 'open /t/synthetic-topic/42/1');
  await terminalInput.press('ArrowDown');
  assert.equal(await terminalInput.inputValue(), 'hot');
  await terminalInput.press('ArrowDown');
  assert.equal(await terminalInput.inputValue(), 'draft command');
  await terminalInput.fill('');

  await terminalInput.fill('panel outline');
  await terminalInput.press('Enter');
  await topicFixturePage
    .getByRole('tab', { name: 'Outline', exact: true })
    .waitFor({ state: 'visible' });
  assert.equal(await outlineTab.getAttribute('aria-selected'), 'true');
  await terminalTab.click();
  await topicFixturePage.getByText('Bottom panel: Outline.', { exact: true }).waitFor();
  await terminalInput.fill('panel hide');
  await terminalInput.press('Enter');
  const commandShowPanel = topicFixturePage.getByRole('button', { name: 'Show Bottom Panel' });
  await commandShowPanel.waitFor();
  await commandShowPanel.click();
  await topicFixturePage.getByText('Bottom panel: hidden.', { exact: true }).waitFor();
  await runTerminalCommand(
    topicFixturePage,
    'open https://example.com/t/synthetic-topic/42',
    'Only public https://linux.do topic URLs are supported.',
  );
  await terminalInput.fill('unsaved draft');
  await terminalInput.press('ArrowUp');
  assert.equal(await terminalInput.inputValue(), 'panel hide');
  await topicFixturePage.screenshot({ path: path.join(evidenceDir, 'terminal-command-panel.png') });
  await terminalInput.fill('clear');
  await terminalInput.press('Enter');
  await topicFixturePage.waitForFunction(
    () => document.querySelectorAll('.docode-terminal__entry').length === 0,
  );
  await outlineTab.click();

  const topicCodeSurface = topicFixturePage.getByRole('document', {
    name: 'Topic code document',
  });
  await topicCodeSurface.evaluate((element) => {
    globalThis.__docodeTopicScrollEvents = 0;
    element.addEventListener(
      'scroll',
      () => {
        globalThis.__docodeTopicScrollEvents += 1;
      },
      { passive: true },
    );
  });
  await topicCodeSurface.evaluate((element) => {
    element.scrollTop = 0;
  });
  await waitForTopicScrollProgress(topicFixturePage, 0, 0.01);
  const topicViewportSlider = topicFixturePage.getByRole('slider', { name: 'Topic viewport' });
  await topicViewportSlider.hover();
  await topicFixturePage.waitForFunction(
    () => getComputedStyle(document.querySelector('.docode-topic-minimap__slider')).opacity === '1',
  );
  assert.equal(
    await topicViewportSlider
      .locator('.docode-topic-minimap__slider-fill')
      .evaluate((element) => getComputedStyle(element).backgroundColor),
    'rgba(100, 100, 100, 0.35)',
  );
  assert.equal(
    await topicViewportSlider.evaluate((element) => getComputedStyle(element).opacity),
    '1',
  );
  await topicFixturePage.screenshot({ path: path.join(evidenceDir, 'topic-minimap-hover.png') });
  await topicFixturePage.screenshot({
    path: path.join(topicFidelityEvidenceDir, 'minimap-hover.png'),
  });
  await topicFixturePage.keyboard.press('Tab');
  await topicViewportSlider.focus();
  await topicFixturePage.mouse.move(400, 200);
  assert.equal(
    await topicViewportSlider.evaluate((element) => getComputedStyle(element).outlineColor),
    'rgb(0, 120, 212)',
  );
  assert.equal(
    await topicViewportSlider.evaluate((element) => getComputedStyle(element).opacity),
    '1',
  );
  await topicFixturePage.screenshot({ path: path.join(evidenceDir, 'topic-minimap-focus.png') });
  await topicFixturePage.screenshot({
    path: path.join(topicFidelityEvidenceDir, 'minimap-focus.png'),
  });
  await topicFixturePage.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(
    await topicViewportSlider.evaluate((element) => getComputedStyle(element).transitionDuration),
    '0s',
  );
  await topicFixturePage.emulateMedia({ reducedMotion: 'no-preference' });

  const minimapTrack = topicFixturePage.locator('.docode-topic-minimap__track');
  const minimapTrackBox = await minimapTrack.boundingBox();
  assert(minimapTrackBox, 'The topic minimap track must have visible geometry.');
  await topicFixturePage.mouse.click(
    minimapTrackBox.x + 2,
    minimapTrackBox.y + minimapTrackBox.height - 4,
  );
  await waitForTopicScrollProgress(topicFixturePage, 1, 0.02);
  await topicViewportSlider.press('Home');
  await waitForTopicScrollProgress(topicFixturePage, 0, 0.01);
  await topicViewportSlider.press('End');
  await waitForTopicScrollProgress(topicFixturePage, 1, 0.01);
  await topicViewportSlider.press('Home');
  await waitForTopicScrollProgress(topicFixturePage, 0, 0.01);

  const minimapSliderBox = await topicViewportSlider.boundingBox();
  assert(minimapSliderBox, 'The topic viewport slider must have visible geometry.');
  const minimapSliderCenterX = minimapSliderBox.x + minimapSliderBox.width / 2;
  const minimapSliderCenterY = minimapSliderBox.y + minimapSliderBox.height / 2;
  await topicFixturePage.mouse.move(minimapSliderCenterX, minimapSliderCenterY);
  await topicFixturePage.mouse.down();
  await topicFixturePage.locator('.docode-topic-minimap__slider[data-dragging="true"]').waitFor();
  await topicFixturePage.mouse.move(
    minimapSliderCenterX,
    minimapSliderCenterY + (minimapTrackBox.height - minimapSliderBox.height) * 0.45,
  );
  await waitForTopicScrollProgress(topicFixturePage, 0.45, 0.08);
  assert.equal(
    await topicViewportSlider
      .locator('.docode-topic-minimap__slider-fill')
      .evaluate((element) => getComputedStyle(element).backgroundColor),
    'rgba(191, 191, 191, 0.2)',
  );
  assert.equal(
    await topicViewportSlider.evaluate((element) => getComputedStyle(element).opacity),
    '1',
  );
  await topicFixturePage.screenshot({ path: path.join(evidenceDir, 'topic-minimap-drag.png') });
  await topicFixturePage.screenshot({
    path: path.join(topicFidelityEvidenceDir, 'minimap-drag.png'),
  });
  await topicFixturePage.mouse.up();
  await topicFixturePage.locator('.docode-topic-minimap__slider:not([data-dragging])').waitFor();
  const minimapScrollEventCount = await topicFixturePage.evaluate(
    () => globalThis.__docodeTopicScrollEvents,
  );
  assert(
    minimapScrollEventCount > 0 && minimapScrollEventCount < 20,
    `Expected bounded scroll synchronization, received ${String(minimapScrollEventCount)} events.`,
  );
  await topicFixturePage.screenshot({ path: path.join(evidenceDir, 'topic-minimap-scrolled.png') });
  const firstFloor = topicFixturePage.getByRole('link', { name: 'Open post 1', exact: true });
  await firstFloor.hover();
  assert.equal(
    await firstFloor.evaluate((element) => getComputedStyle(element).textDecorationLine),
    'underline',
  );
  await topicFixturePage.screenshot({ path: path.join(evidenceDir, 'topic-code-floor-hover.png') });
  const focusedReply = topicFixturePage.locator('.docode-topic-code__reply[data-post-number="2"]');
  await focusedReply.focus();
  await waitForUiStability(topicFixturePage);
  await topicFixturePage.waitForFunction(
    () =>
      document.activeElement?.getAttribute('data-post-number') === '2' &&
      document.activeElement?.getAttribute('data-active') === 'true',
  );
  await focusedReply.press('ArrowUp');
  await topicFixturePage.waitForFunction(
    () =>
      document.activeElement?.getAttribute('data-post-number') === '1' &&
      document.activeElement?.getAttribute('data-active') === 'true',
  );
  await topicFixturePage.getByRole('button', { name: 'Current post 1' }).waitFor();
  assert.equal(
    await topicFixturePage
      .locator('.docode-topic-code__reply[data-post-number="1"]')
      .getAttribute('tabindex'),
    '0',
  );
  await topicFixturePage.screenshot({ path: path.join(evidenceDir, 'topic-post-focus.png') });
  await topicFixturePage.locator('.docode-topic-code__reply[data-post-number="1"]').press('End');
  assert.equal(
    await topicFixturePage.evaluate(() => document.activeElement?.getAttribute('data-post-number')),
    '2',
  );
  await topicCodeSurface.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await topicFixturePage.screenshot({ path: path.join(evidenceDir, 'topic-code-scrolled.png') });
  const currentRouteStatusItem = topicFixturePage.getByRole('button', {
    name: 'Current view: Topic 42 · Post 2',
  });
  await currentRouteStatusItem.hover();
  assert.deepEqual(
    await currentRouteStatusItem.evaluate((element) => {
      const style = getComputedStyle(element);
      return { background: style.backgroundColor, color: style.color };
    }),
    { background: 'rgba(241, 241, 241, 0.2)', color: 'rgb(255, 255, 255)' },
  );
  await topicFixturePage.screenshot({ path: path.join(evidenceDir, 'workbench-hover.png') });
  const activeTab = topicFixturePage.getByRole('tab', { name: 'topic:42' });
  await activeTab.focus();
  assert.equal(
    await activeTab.evaluate((element) => getComputedStyle(element).outlineColor),
    'rgb(0, 120, 212)',
  );
  await topicFixturePage.screenshot({ path: path.join(evidenceDir, 'workbench-focus.png') });
  await activeTab.evaluate((element) => element.blur());
  await topicFixturePage.evaluate(() => window.dispatchEvent(new Event('blur')));
  await topicFixturePage.locator('.docode-workbench__tab[data-window-active="false"]').waitFor();
  assert.equal(
    await activeTab.evaluate((element) => {
      const tab = element.closest('.docode-workbench__tab');
      if (!(tab instanceof HTMLElement)) throw new Error('Missing active tab container.');
      return getComputedStyle(tab, '::before').backgroundColor;
    }),
    'rgb(43, 43, 43)',
  );
  await topicFixturePage.screenshot({ path: path.join(evidenceDir, 'workbench-inactive.png') });
  await topicFixturePage.evaluate(() => window.dispatchEvent(new Event('focus')));
  const initialDesktopPanelHeight = (await readWorkbenchGeometry(topicFixturePage)).panelHeight;
  const desktopSash = topicFixturePage.getByRole('separator', { name: 'Resize bottom panel' });
  const desktopSashBox = await desktopSash.boundingBox();
  assert(desktopSashBox, 'The desktop bottom-panel sash must have a visible geometry.');
  const desktopSashCenterX = desktopSashBox.x + desktopSashBox.width / 2;
  const desktopSashCenterY = desktopSashBox.y + desktopSashBox.height / 2;
  await topicFixturePage.mouse.move(desktopSashCenterX, desktopSashCenterY);
  await topicFixturePage.mouse.down();
  await topicFixturePage.mouse.move(desktopSashCenterX, desktopSashCenterY - 60);
  await topicFixturePage.mouse.up();
  assert.equal(
    (await readWorkbenchGeometry(topicFixturePage)).panelHeight,
    initialDesktopPanelHeight + 60,
  );
  await desktopSash.focus();
  await desktopSash.press('ArrowDown');
  assert.equal(
    (await readWorkbenchGeometry(topicFixturePage)).panelHeight,
    initialDesktopPanelHeight + 50,
  );
  await topicFixturePage.waitForFunction((initialSize) => {
    const slider = document.querySelector('.docode-topic-minimap__slider');
    if (!(slider instanceof HTMLElement)) return false;
    const currentSize =
      Number.parseFloat(slider.style.getPropertyValue('--docode-minimap-slider-size').trim()) / 100;
    return currentSize < initialSize;
  }, topicMinimap.sliderSize);
  const resizedTopicMinimap = await readTopicMinimap(topicFixturePage);
  assert(resizedTopicMinimap.sliderSize < topicMinimap.sliderSize);
  await topicFixturePage.screenshot({ path: path.join(evidenceDir, 'workbench-resized.png') });
  await topicFixturePage.bringToFront();
  await popupPage.reload();
  const topicFixtureStatus = await readContentStatus(popupPage);
  assert.deepEqual(topicFixtureStatus?.ok ? topicFixtureStatus.status.topic : null, {
    containsRequestedPost: true,
    errorCode: null,
    firstPostNumber: 1,
    hasMorePosts: true,
    issueCodes: [],
    lastPostNumber: 2,
    partialPostCount: 0,
    postCount: 2,
    requestedPostNumber: 2,
    state: 'ready',
  });
  const topicCapabilityGeneration = topicFixtureStatus?.ok
    ? topicFixtureStatus.status.capabilities?.generation
    : null;
  assert.equal(topicCapabilityGeneration, 14);
  assert.deepEqual(topicFixtureStatus?.ok ? topicFixtureStatus.status.capabilities : null, {
    availableBookmarkCount: 0,
    availableCopyLinkCount: 2,
    availableLikeCount: 0,
    composerState: 'authentication-required',
    diagnosticCodes: ['authentication-required'],
    generation: topicCapabilityGeneration,
    postCount: 2,
    replyState: 'authentication-required',
    state: 'ready',
    userState: 'logged-out',
  });
  await topicFixturePage.evaluate(() => {
    document.querySelector('.cooked')?.append(document.createTextNode(' irrelevant mutation'));
  });
  await topicFixturePage.waitForTimeout(100);
  const unchangedCapabilityStatus = await readContentStatus(popupPage);
  assert.equal(
    unchangedCapabilityStatus?.ok
      ? unchangedCapabilityStatus.status.capabilities?.generation
      : null,
    topicCapabilityGeneration,
  );
  await topicFixturePage.evaluate(() => {
    document.querySelector('.post-action-menu__copy-link')?.classList.add('disabled');
  });
  const changedCapabilityStatus = await waitForCapabilityGeneration(
    popupPage,
    topicCapabilityGeneration + 1,
  );
  assert.deepEqual(changedCapabilityStatus, {
    availableBookmarkCount: 0,
    availableCopyLinkCount: 1,
    availableLikeCount: 0,
    composerState: 'authentication-required',
    diagnosticCodes: ['authentication-required', 'native-control-disabled'],
    generation: topicCapabilityGeneration + 1,
    postCount: 2,
    replyState: 'authentication-required',
    state: 'ready',
    userState: 'logged-out',
  });
  await topicFixturePage.waitForFunction(
    () =>
      document
        .querySelector(
          '.docode-topic-code__action-capability[data-action="copy-link"][data-state="disabled"]',
        )
        ?.closest('[aria-label="Post 1 actions"]') !== null,
  );
  assert.equal(
    await topicFixturePage
      .locator('.docode-topic-code__action-capability[data-state="disabled"]')
      .count(),
    1,
  );
  await topicFixturePage.screenshot({ path: path.join(evidenceDir, 'topic-actions-disabled.png') });

  const sharedTopicSurface = topicFixturePage.locator('.docode-topic-code__surface');
  await sharedTopicSurface.evaluate((surface) => {
    surface.scrollTop = 0;
    globalThis.__docodeNativeRootProbe = document.querySelector('#native-cooked-1');
  });
  await statusMode.click();
  await topicFixturePage.getByRole('document', { name: 'Topic document' }).waitFor();
  const topicDocDocument = await readTopicDocDocument(topicFixturePage);
  assert.deepEqual(topicDocDocument, {
    contentFontSize: '13px',
    contentLineHeight: '20px',
    floorCount: 2,
    headingColor: 'rgb(86, 156, 214)',
    headingCount: 4,
    indentBorderWidth: '0px',
    keywordCount: 0,
    modeToolbarCount: 0,
    nativeRootCount: 2,
    replyCloseCount: 0,
    sectionText: '## 回复',
    titleText: '# Synthetic topic',
  });
  await topicFixturePage.screenshot({ path: path.join(evidenceDir, 'topic-doc-desktop.png') });
  await topicFixturePage.screenshot({
    path: path.join(topicFidelityEvidenceDir, 'topic-doc-desktop.png'),
  });

  const continuityScrollTop = await sharedTopicSurface.evaluate((surface) => {
    surface.scrollTop = 80;
    return surface.scrollTop;
  });
  assert(continuityScrollTop > 0);
  await statusMode.click();
  await topicFixturePage.getByRole('document', { name: 'Topic code document' }).waitFor();
  assert.deepEqual(
    await sharedTopicSurface.evaluate((surface) => ({
      nativeIdentityPreserved:
        globalThis.__docodeNativeRootProbe === document.querySelector('#native-cooked-1'),
      scrollTop: surface.scrollTop,
    })),
    { nativeIdentityPreserved: true, scrollTop: continuityScrollTop },
  );
  await statusMode.click();
  await topicFixturePage.getByRole('document', { name: 'Topic document' }).waitFor();
  assert.deepEqual(
    await sharedTopicSurface.evaluate((surface) => ({
      nativeIdentityPreserved:
        globalThis.__docodeNativeRootProbe === document.querySelector('#native-cooked-1'),
      scrollTop: surface.scrollTop,
    })),
    { nativeIdentityPreserved: true, scrollTop: continuityScrollTop },
  );
  await topicFixturePage.screenshot({ path: path.join(evidenceDir, 'topic-doc-scrolled.png') });

  await sharedTopicSurface.evaluate((surface) => {
    surface.scrollTop = 0;
  });
  await statusMode.focus();
  await statusMode.press('Enter');
  await topicFixturePage.getByRole('document', { name: 'Topic code document' }).waitFor();
  await statusMode.focus();
  await statusMode.press('Enter');
  await topicFixturePage.getByRole('document', { name: 'Topic document' }).waitFor();
  assert.equal(
    await statusMode.evaluate((element) => getComputedStyle(element).outlineColor),
    'rgb(0, 120, 212)',
  );
  await topicFixturePage.screenshot({ path: path.join(evidenceDir, 'topic-doc-status-focus.png') });

  const incrementalStarted = await topicFixturePage.evaluate(
    (postMarkup) => {
      const loading = document.querySelector('.topic-post-loading');
      const surface = document.querySelector('.docode-topic-code__surface');
      const anchor = document.querySelector('.docode-topic-code__reply[data-post-number="2"]');
      const nativeRoot = document.querySelector('#native-cooked-1');
      if (!(loading instanceof HTMLElement))
        throw new Error('Missing incremental loading boundary.');
      if (!(surface instanceof HTMLElement) || !(anchor instanceof HTMLElement) || !nativeRoot) {
        throw new Error('Missing incremental continuity probe target.');
      }
      const probe = {
        anchorOffset: anchor.getBoundingClientRect().top - surface.getBoundingClientRect().top,
        blankFrames: 0,
        frame: 0,
        running: true,
        scrollTop: surface.scrollTop,
      };
      const sampleOwnership = () => {
        if (!probe.running) return;
        if (!nativeRoot.closest('.docode-topic-code__content-slot')) probe.blankFrames += 1;
        probe.frame = requestAnimationFrame(sampleOwnership);
      };
      globalThis.__docodeIncrementalContinuityProbe = probe;
      sampleOwnership();
      const started = performance.now();
      loading.insertAdjacentHTML('beforebegin', postMarkup);
      loading.remove();
      return started;
    },
    topicPostFixtureHtml(3, 102),
  );
  await topicFixturePage.waitForFunction(
    () =>
      document.querySelectorAll('.docode-topic-code__reply').length === 3 &&
      document.querySelectorAll('.docode-topic-code__loading-boundary').length === 0,
  );
  const incrementalRenderMs = await topicFixturePage.evaluate(
    (started) => performance.now() - started,
    incrementalStarted,
  );
  assert(incrementalRenderMs < 5_000);
  const incrementalContinuity = await topicFixturePage.evaluate(() => {
    const probe = globalThis.__docodeIncrementalContinuityProbe;
    const surface = document.querySelector('.docode-topic-code__surface');
    const anchor = document.querySelector('.docode-topic-code__reply[data-post-number="2"]');
    if (!probe || !(surface instanceof HTMLElement) || !(anchor instanceof HTMLElement)) {
      throw new Error('Missing incremental continuity result.');
    }
    probe.running = false;
    cancelAnimationFrame(probe.frame);
    delete globalThis.__docodeIncrementalContinuityProbe;
    return {
      anchorOffsetChange:
        anchor.getBoundingClientRect().top -
        surface.getBoundingClientRect().top -
        probe.anchorOffset,
      blankFrames: probe.blankFrames,
      scrollTopChange: surface.scrollTop - probe.scrollTop,
    };
  });
  assert.equal(incrementalContinuity.blankFrames, 0);
  assert(Math.abs(incrementalContinuity.anchorOffsetChange) <= 1);
  assert(Math.abs(incrementalContinuity.scrollTopChange) <= 1);
  assert.deepEqual(
    await topicFixturePage.locator('[data-docode-workbench-root]').evaluate((root) => ({
      loadedLabel:
        Array.from(root.querySelectorAll('.docode-topic-code__metadata span'))
          .map((element) => element.textContent?.trim())
          .find((label) => label?.includes('loaded')) ?? '',
      nativeIdentityPreserved:
        globalThis.__docodeNativeRootProbe === document.querySelector('#native-cooked-1'),
      nativeRootCount: root.querySelectorAll('.docode-topic-code__content-slot > .cooked').length,
      postCount: root.querySelectorAll('.docode-topic-code__reply').length,
      sourceNativeRootCount: document.querySelectorAll('#main-outlet .cooked').length,
    })),
    {
      loadedLabel: 'posts 1–3 loaded (3)',
      nativeIdentityPreserved: true,
      nativeRootCount: 3,
      postCount: 3,
      sourceNativeRootCount: 0,
    },
  );
  await topicFixturePage.waitForFunction(
    () =>
      document.querySelectorAll('.docode-topic-outline__item[data-kind="post"]').length === 3 &&
      document.querySelectorAll('.docode-topic-outline__item[data-kind="heading"]').length === 3 &&
      document.querySelectorAll('.docode-topic-minimap__mark').length === 3 &&
      !document.querySelector('.docode-topic-outline__range'),
  );
  await topicFixturePage.screenshot({
    path: path.join(evidenceDir, 'topic-incremental-complete.png'),
  });

  const narrowShellPage = await context.newPage();
  await narrowShellPage.setViewportSize({ width: 420, height: 640 });
  await narrowShellPage.goto(topicFixtureUrl, { waitUntil: 'domcontentloaded' });
  await assertRuntimeOwnership(narrowShellPage, true);
  await narrowShellPage.locator('.docode-workbench__editor').waitFor();
  const narrowShellGeometry = await readWorkbenchGeometry(narrowShellPage);
  assert.deepEqual(narrowShellGeometry, {
    editorHeight: 499,
    gutterWidth: 36,
    height: 640,
    minimapVisible: false,
    minimapWidth: 0,
    panelHeight: 80,
    sashHeight: 4,
    statusBarHeight: 22,
    width: 420,
  });
  assert.equal(
    await narrowShellPage
      .locator('.docode-topic-code__floor')
      .first()
      .evaluate((element) => element.getBoundingClientRect().width),
    36,
  );
  assert.equal(
    await narrowShellPage
      .locator('.docode-topic-minimap')
      .evaluate((element) => getComputedStyle(element).display),
    'none',
  );
  assert.equal(
    await narrowShellPage.locator('.docode-workbench__status-item--activity').isVisible(),
    true,
  );
  assert.equal(
    await narrowShellPage.locator('.docode-workbench__status-item--category').isVisible(),
    false,
  );
  assert.equal(
    await narrowShellPage.locator('.docode-workbench__status-item--mode').isVisible(),
    false,
  );
  assert.equal(
    await narrowShellPage.getByRole('button', { name: 'Current post 2' }).isVisible(),
    true,
  );
  await narrowShellPage.screenshot({
    path: path.join(statusEvidenceDir, 'status-narrow-context.png'),
  });
  const narrowTerminalTab = narrowShellPage.getByRole('tab', {
    name: 'Terminal',
    exact: true,
  });
  await narrowTerminalTab.click();
  const narrowTerminalInput = narrowShellPage.getByRole('combobox', {
    name: 'Linux DO command input',
  });
  await narrowTerminalInput.fill('missing');
  await narrowTerminalInput.press('Enter');
  await narrowShellPage.getByText('Unknown command: missing', { exact: true }).waitFor();
  assert.equal((await readTerminalView(narrowShellPage)).viewportPaddingLeft, '20px');
  await narrowShellPage.screenshot({ path: path.join(evidenceDir, 'terminal-narrow.png') });
  await narrowShellPage.getByRole('tab', { name: 'Outline', exact: true }).click();
  await narrowShellPage.screenshot({ path: path.join(evidenceDir, 'topic-code-narrow.png') });
  await narrowShellPage.screenshot({
    path: path.join(fullWorkbenchEvidenceDir, 'topic-code-narrow.png'),
  });
  await narrowShellPage.screenshot({
    path: path.join(topicFidelityEvidenceDir, 'topic-code-narrow.png'),
  });
  await narrowShellPage.screenshot({
    path: path.join(fidelityRefinementEvidenceDir, 'shell-editor-narrow.png'),
  });
  await narrowTerminalTab.click();
  await narrowTerminalInput.fill('mode doc');
  await narrowTerminalInput.press('Enter');
  await narrowShellPage.getByText('Reading mode: Doc.', { exact: true }).waitFor();
  await narrowShellPage.getByRole('tab', { name: 'Outline', exact: true }).click();
  await narrowShellPage.getByRole('document', { name: 'Topic document' }).waitFor();
  assert.equal(await narrowShellPage.locator('.docode-topic-code__keyword').count(), 0);
  await narrowShellPage.screenshot({ path: path.join(evidenceDir, 'topic-doc-narrow.png') });
  await narrowShellPage.close();

  const longTopicFixtureUrl = 'https://linux.do/t/synthetic-topic/42/60?docode_fixture=long-topic';
  await context.route(longTopicFixtureUrl, (route) =>
    route.fulfill({
      body: longTopicFixtureHtml(21, 80),
      contentType: 'text/html',
      status: 200,
    }),
  );
  const longTopicPage = await context.newPage();
  const longTopicStarted = Date.now();
  await longTopicPage.goto(longTopicFixtureUrl, { waitUntil: 'domcontentloaded' });
  await assertRuntimeOwnership(longTopicPage, true);
  await longTopicPage.waitForFunction(
    () => document.querySelectorAll('.docode-topic-code__reply').length === 80,
  );
  const longTopicRenderMs = Date.now() - longTopicStarted;
  assert(
    longTopicRenderMs < 5_000,
    `The 80-post loaded window took ${String(longTopicRenderMs)}ms.`,
  );
  assert.deepEqual(
    await longTopicPage.locator('[data-docode-workbench-root]').evaluate((root) => ({
      activePostNumber: root
        .querySelector('.docode-topic-code__reply[data-active="true"]')
        ?.getAttribute('data-post-number'),
      boundaryCount: root.querySelectorAll('.docode-topic-code__loading-boundary').length,
      firstPostNumber: root
        .querySelector('.docode-topic-code__reply')
        ?.getAttribute('data-post-number'),
      lastPostNumber: Array.from(root.querySelectorAll('.docode-topic-code__reply'))
        .at(-1)
        ?.getAttribute('data-post-number'),
      nativeRootCount: root.querySelectorAll('.docode-topic-code__content-slot > .cooked').length,
      sourceNativeRootCount: document.querySelectorAll('#main-outlet .cooked').length,
    })),
    {
      activePostNumber: '60',
      boundaryCount: 1,
      firstPostNumber: '21',
      lastPostNumber: '100',
      nativeRootCount: 80,
      sourceNativeRootCount: 0,
    },
  );
  assert.deepEqual(
    await longTopicPage.locator('[data-docode-workbench-root]').evaluate((root) => ({
      earlierRange: root.querySelector('.docode-topic-outline__range')?.textContent?.trim(),
      outlinePostCount: root.querySelectorAll('.docode-topic-outline__item[data-kind="post"]')
        .length,
      selectedPostNumber: root
        .querySelector('.docode-topic-outline__item[data-selected="true"]')
        ?.textContent?.match(/Post (\d+)/)?.[1],
    })),
    {
      earlierRange: 'Earlier posts are not loaded.',
      outlinePostCount: 80,
      selectedPostNumber: '60',
    },
  );
  const longTopicMinimap = await readTopicMinimap(longTopicPage);
  assert.equal(longTopicMinimap.markCount, 80);
  assert.deepEqual(longTopicMinimap.loadedRange, { maximum: 100, minimum: 21 });
  const longScrollbarGeometry = await longTopicPage.evaluate(() => {
    const outline = document.querySelector('.docode-topic-outline');
    const topic = document.querySelector('.docode-topic-code__surface');
    if (!(outline instanceof HTMLElement) || !(topic instanceof HTMLElement)) {
      throw new Error('Missing long-topic scroll surfaces.');
    }
    return {
      outline: {
        clientHeight: outline.clientHeight,
        scrollHeight: outline.scrollHeight,
        scrollbarColor: getComputedStyle(outline).scrollbarColor,
      },
      topic: {
        clientHeight: topic.clientHeight,
        scrollHeight: topic.scrollHeight,
        scrollbarColor: getComputedStyle(topic).scrollbarColor,
      },
    };
  });
  assert(longScrollbarGeometry.outline.scrollHeight > longScrollbarGeometry.outline.clientHeight);
  assert(longScrollbarGeometry.topic.scrollHeight > longScrollbarGeometry.topic.clientHeight);
  assert.match(longScrollbarGeometry.outline.scrollbarColor, /rgba?\(121, 121, 121/);
  assert.match(longScrollbarGeometry.topic.scrollbarColor, /rgba?\(121, 121, 121/);
  const longTopicSurface = longTopicPage.getByRole('document', { name: 'Topic code document' });
  await longTopicSurface.evaluate((element) => {
    globalThis.__docodeTopicScrollEvents = 0;
    element.addEventListener(
      'scroll',
      () => {
        globalThis.__docodeTopicScrollEvents += 1;
      },
      { passive: true },
    );
  });
  const longTopicSlider = longTopicPage.getByRole('slider', { name: 'Topic viewport' });
  await longTopicSlider.focus();
  await longTopicSlider.press('End');
  await waitForTopicScrollProgress(longTopicPage, 1, 0.01);
  await longTopicSlider.focus();
  await longTopicSlider.press('Home');
  await waitForTopicScrollProgress(longTopicPage, 0, 0.01);
  const longTopicScrollEventCount = await longTopicPage.evaluate(
    () => globalThis.__docodeTopicScrollEvents,
  );
  assert(longTopicScrollEventCount < 10);
  const performanceSession = await context.newCDPSession(longTopicPage);
  await performanceSession.send('Performance.enable');
  const performanceBefore = await performanceSession.send('Performance.getMetrics');
  const longTopicScrollProfile = await longTopicSurface.evaluate(async (element) => {
    const maximumScrollTop = Math.max(0, element.scrollHeight - element.clientHeight);
    const started = performance.now();
    let slowestFrameMilliseconds = 0;
    for (let index = 0; index < 32; index += 1) {
      const frameStarted = performance.now();
      element.scrollTop = index % 2 === 0 ? maximumScrollTop : 0;
      await new Promise((resolve) => requestAnimationFrame(resolve));
      slowestFrameMilliseconds = Math.max(
        slowestFrameMilliseconds,
        performance.now() - frameStarted,
      );
    }
    return {
      elapsedMilliseconds: performance.now() - started,
      slowestFrameMilliseconds,
    };
  });
  const performanceAfter = await performanceSession.send('Performance.getMetrics');
  const performanceDelta = metricDelta(performanceBefore.metrics, performanceAfter.metrics, [
    'LayoutCount',
    'LayoutDuration',
    'RecalcStyleCount',
    'RecalcStyleDuration',
    'ScriptDuration',
    'TaskDuration',
  ]);
  assert(longTopicScrollProfile.elapsedMilliseconds < 5_000);
  assert(longTopicScrollProfile.slowestFrameMilliseconds < 250);
  assert(performanceDelta.TaskDuration < 3);
  assert(performanceDelta.ScriptDuration < 2);
  assert(performanceDelta.LayoutDuration < 1);
  const routeGenerationBeforeStress = Number(
    await longTopicPage.locator('.docode-workbench').getAttribute('data-route-generation'),
  );
  const navigationStressStarted = Date.now();
  for (let index = 0; index < 12; index += 1) {
    const floor = 21 + index;
    await longTopicPage.evaluate((postNumber) => {
      window.history.pushState({}, '', `/t/synthetic-topic/42/${String(postNumber)}`);
    }, floor);
    await longTopicPage.waitForFunction(
      (generation) =>
        document.querySelector('.docode-workbench')?.getAttribute('data-route-generation') ===
        String(generation),
      routeGenerationBeforeStress + index + 1,
    );
  }
  await longTopicPage.waitForFunction(
    () =>
      document
        .querySelector('.docode-topic-code__reply[data-requested="true"]')
        ?.getAttribute('data-post-number') === '32',
  );
  await longTopicPage.waitForTimeout(100);
  const routePositionAfterStress = await longTopicPage.evaluate(() => ({
    activePostNumber: document
      .querySelector('.docode-topic-code__reply[data-active="true"]')
      ?.getAttribute('data-post-number'),
    requestedPostNumber: document
      .querySelector('.docode-topic-code__reply[data-requested="true"]')
      ?.getAttribute('data-post-number'),
    scrollTop:
      document.querySelector('.docode-topic-code__surface') instanceof HTMLElement
        ? document.querySelector('.docode-topic-code__surface').scrollTop
        : null,
  }));
  assert.deepEqual(
    {
      activePostNumber: routePositionAfterStress.activePostNumber,
      requestedPostNumber: routePositionAfterStress.requestedPostNumber,
    },
    {
      activePostNumber: '32',
      requestedPostNumber: '32',
    },
  );
  assert(
    typeof routePositionAfterStress.scrollTop === 'number' &&
      routePositionAfterStress.scrollTop > 0,
  );
  const repeatedNavigation = await longTopicPage.evaluate(() => ({
    nativeRootCount: document.querySelectorAll(
      '[data-docode-workbench-root] .docode-topic-code__content-slot > .cooked',
    ).length,
    ownedStyleCount: document.querySelectorAll('[data-docode-owned-style]').length,
    runtimeMarkerCount: document.documentElement.hasAttribute('data-docode-runtime') ? 1 : 0,
    workbenchRootCount: document.querySelectorAll('[data-docode-workbench-root]').length,
  }));
  assert.deepEqual(repeatedNavigation, {
    nativeRootCount: 80,
    ownedStyleCount: 1,
    runtimeMarkerCount: 1,
    workbenchRootCount: 1,
  });
  const routeGenerationAfterStress = Number(
    await longTopicPage.locator('.docode-workbench').getAttribute('data-route-generation'),
  );
  assert.equal(routeGenerationAfterStress - routeGenerationBeforeStress, 12);
  const longTopicPerformance = {
    loadedPostCount: 80,
    navigationStressMilliseconds: Date.now() - navigationStressStarted,
    performanceDelta,
    repeatedNavigation,
    routeGenerationDelta: routeGenerationAfterStress - routeGenerationBeforeStress,
    scrollProfile: {
      elapsedMilliseconds: Math.round(longTopicScrollProfile.elapsedMilliseconds),
      slowestFrameMilliseconds: Math.round(longTopicScrollProfile.slowestFrameMilliseconds),
    },
  };
  assert(longTopicPerformance.navigationStressMilliseconds < 5_000);
  await longTopicPage.screenshot({ path: path.join(evidenceDir, 'topic-long-window.png') });
  await longTopicPage.screenshot({
    path: path.join(topicFidelityEvidenceDir, 'topic-long.png'),
  });
  await longTopicPage.screenshot({
    path: path.join(performanceEvidenceDir, 'long-topic-performance.png'),
  });
  await performanceSession.detach();
  await longTopicPage.close();

  await topicFixturePage.bringToFront();
  await popupPage.reload();
  const lifecycleStarted = Date.now();
  for (let cycle = 0; cycle < 5; cycle += 1) {
    await clickPopupEnabledToggle(popupPage);
    await assertRuntimeOwnership(topicFixturePage, false);
    assert.deepEqual(
      await topicFixturePage.evaluate(() => ({
        nativeRootCount: document.querySelectorAll('#main-outlet .cooked').length,
        ownedStyleCount: document.querySelectorAll('[data-docode-owned-style]').length,
        workbenchRootCount: document.querySelectorAll('[data-docode-workbench-root]').length,
      })),
      { nativeRootCount: 3, ownedStyleCount: 0, workbenchRootCount: 0 },
    );
    await clickPopupEnabledToggle(popupPage);
    await assertRuntimeOwnership(topicFixturePage, true);
    await topicFixturePage.locator('.docode-topic-code__surface').waitFor();
    assert.deepEqual(
      await topicFixturePage.evaluate(() => ({
        nativeRootCount: document.querySelectorAll(
          '[data-docode-workbench-root] .docode-topic-code__content-slot > .cooked',
        ).length,
        ownedStyleCount: document.querySelectorAll('[data-docode-owned-style]').length,
        workbenchRootCount: document.querySelectorAll('[data-docode-workbench-root]').length,
      })),
      { nativeRootCount: 3, ownedStyleCount: 1, workbenchRootCount: 1 },
    );
  }
  const repeatedLifecycle = {
    cycles: 5,
    elapsedMilliseconds: Date.now() - lifecycleStarted,
    finalEnabled: await readEnabledSetting(popupPage),
  };
  assert.equal(repeatedLifecycle.finalEnabled, true);
  assert(repeatedLifecycle.elapsedMilliseconds < 10_000);
  await topicFixturePage.screenshot({
    path: path.join(performanceEvidenceDir, 'repeated-lifecycle.png'),
  });
  await topicFixturePage.getByRole('button', { name: 'Return to native Linux DO' }).click();
  await assertRuntimeOwnership(topicFixturePage, false);
  assert.equal(await topicFixturePage.locator('#main-outlet .cooked').count(), 3);
  assert.equal(await topicFixturePage.locator('#native-cooked-1').count(), 1);
  await topicFixturePage.screenshot({ path: path.join(evidenceDir, 'topic-code-restored.png') });
  await topicFixturePage.screenshot({
    path: path.join(readingModeEvidenceDir, 'native-view-restored.png'),
  });
  await popupPage.reload();
  await assertPopupText(popupPage, 'Original LINUX DO is active.');
  assert.equal(await readEnabledSetting(popupPage), false);
  await clickPopupEnabledToggle(popupPage);
  await assertRuntimeOwnership(topicFixturePage, true);
  await topicFixturePage.getByRole('document', { name: 'Topic code document' }).waitFor();
  assert.equal(await topicFixturePage.locator('#main-outlet .cooked').count(), 0);

  const unsupportedFixtureUrl = 'https://linux.do/unknown?docode_fixture=1';
  await context.route(unsupportedFixtureUrl, (route) =>
    route.fulfill({
      body: '<!doctype html><html><head><title>Unsupported fixture</title></head><body><main>Native unsupported route</main></body></html>',
      contentType: 'text/html',
      status: 200,
    }),
  );
  const unsupportedPage = await context.newPage();
  await unsupportedPage.goto(unsupportedFixtureUrl, { waitUntil: 'domcontentloaded' });
  await assertRuntimeOwnership(unsupportedPage, true);
  await unsupportedPage.bringToFront();
  await unsupportedPage.evaluate(() => window.dispatchEvent(new Event('focus')));
  await unsupportedPage.locator('.docode-workbench__tab[data-window-active="true"]').waitFor();
  const unsupportedChrome = await readWorkbenchChrome(unsupportedPage);
  assert.deepEqual(unsupportedChrome, {
    panelTabDisabled: true,
    panelTabHeight: 35,
    panelTabLabel: 'Terminal',
    routeGeneration: '0',
    statusLabel: 'Unsupported Linux DO route',
    tabDisabled: true,
    tabHeight: 35,
    tabLabel: 'unsupported',
    tabSelected: 'true',
    windowActive: 'true',
  });
  const unsupportedStatus = unsupportedPage.locator('.docode-workbench__status-item--activity');
  await unsupportedStatus.getByText('Unsupported', { exact: true }).waitFor();
  assert.equal(await unsupportedStatus.getAttribute('data-tone'), 'warning');
  assert.equal(
    await unsupportedStatus.getAttribute('data-docode-tooltip'),
    'DOCode does not support this Linux DO page. The original site remains available.',
  );
  await unsupportedPage.screenshot({
    path: path.join(statusEvidenceDir, 'status-unsupported.png'),
  });
  await unsupportedPage.screenshot({ path: path.join(evidenceDir, 'workbench-disabled.png') });
  await unsupportedPage.screenshot({
    path: path.join(compatibilityEvidenceDir, 'unsupported-route-safe.png'),
  });
  await unsupportedPage.getByRole('button', { name: 'Use Original Linux DO' }).click();
  await assertRuntimeOwnership(unsupportedPage, false);
  const unsupportedOriginalRecovery = await unsupportedPage.evaluate(() => ({
    nativeMainText: document.querySelector('main')?.textContent?.trim() ?? '',
    ownedStyleCount: document.querySelectorAll('[data-docode-owned-style]').length,
    workbenchRootCount: document.querySelectorAll('[data-docode-workbench-root]').length,
  }));
  assert.deepEqual(unsupportedOriginalRecovery, {
    nativeMainText: 'Native unsupported route',
    ownedStyleCount: 0,
    workbenchRootCount: 0,
  });
  await assertNativePageVisible(unsupportedPage);
  await unsupportedPage.screenshot({
    path: path.join(compatibilityEvidenceDir, 'unsupported-route-original-view.png'),
  });
  await unsupportedPage.bringToFront();
  await popupPage.reload();
  assert.equal(await readEnabledSetting(popupPage), false);
  await clickPopupEnabledToggle(popupPage);
  await assertRuntimeOwnership(unsupportedPage, true);
  await unsupportedPage.close();
  await topicFixturePage.close();

  const linuxDoErrors = [];
  const linuxDoPage = await context.newPage();
  linuxDoPage.on('pageerror', (error) => linuxDoErrors.push(error.message));
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
  await linuxDoPage.goto('https://linux.do/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await linuxDoPage.waitForFunction(() => globalThis.__docodeContentStarts.length > 0);
  assert.equal(new URL(linuxDoPage.url()).origin, 'https://linux.do');
  assert.notEqual(await linuxDoPage.title(), '');
  await assertRuntimeOwnership(linuxDoPage, true);

  await linuxDoPage.bringToFront();
  await popupPage.reload();
  const enabledToggle = popupPage.getByRole('checkbox', { name: 'Enabled on LINUX DO' });
  assert.equal(
    await popupPage.getByText('DOCode owns the current page runtime.', { exact: true }).count(),
    0,
  );
  await popupPage.waitForFunction(() => {
    const input = document.querySelector('.docode-popup__action--toggle input');
    return input instanceof HTMLInputElement && input.checked && !input.disabled;
  });
  assert.equal(await enabledToggle.isChecked(), true);
  assert.equal(await popupPage.locator('.docode-popup__action--toggle .codicon-check').count(), 1);
  const restoreButton = popupPage.getByRole('button', { name: /Use original LINUX DO/u });
  assert.equal(await restoreButton.locator('.codicon-debug-disconnect').count(), 1);
  await restoreButton.hover();
  assert.equal(
    await restoreButton.evaluate((element) => getComputedStyle(element).backgroundColor),
    'rgb(17, 119, 187)',
  );
  await popupPage.screenshot({ path: path.join(evidenceDir, 'popup-button-hover.png') });
  await enabledToggle.focus();
  assert.equal(await enabledToggle.evaluate((element) => element === document.activeElement), true);
  assert.equal(
    await popupPage
      .locator('.docode-popup__toggle-track')
      .evaluate((element) => getComputedStyle(element).outlineColor),
    'rgb(0, 122, 204)',
  );
  await popupPage.screenshot({ path: path.join(evidenceDir, 'popup-enabled-focus.png') });
  await popupPage.screenshot({
    path: path.join(popupMiniWorkbenchEvidenceDir, 'popup-enabled-focus.png'),
  });
  await popupPage.screenshot({
    path: path.join(popupSimplificationEvidenceDir, 'popup-enabled-focus.png'),
  });
  await popupPage.screenshot({
    path: path.join(popupCompactLayoutEvidenceDir, 'popup-connected.png'),
  });
  await popupPage.screenshot({
    path: path.join(popupCompactActionsEvidenceDir, 'popup-connected.png'),
  });
  await linuxDoPage.bringToFront();
  const linuxDoTabId = await readActiveTabId(popupPage);
  assert.notEqual(linuxDoTabId, null);
  const initialRouteStatus = await waitForRouteStatus(popupPage, 'latest', 0, linuxDoTabId);
  await linuxDoPage.screenshot({
    path: path.join(compatibilityEvidenceDir, 'public-latest-smoke.png'),
  });
  const livePublicSearchProbe = await linuxDoPage.evaluate(async () => {
    try {
      const response = await fetch('/search/query?term=browser+extension', {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      const contentType = response.headers.get('content-type') ?? '';
      let resultCounts = null;
      if (contentType.includes('application/json')) {
        const payload = await response.json();
        if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
          resultCounts = Object.fromEntries(
            ['posts', 'categories', 'tags', 'users'].map((key) => [
              key,
              Array.isArray(payload[key]) ? payload[key].length : 0,
            ]),
          );
        }
      }
      return { contentType, ok: response.ok, resultCounts, status: response.status };
    } catch (error) {
      return {
        contentType: '',
        error: error instanceof Error ? error.message : 'Unknown search probe failure.',
        ok: false,
        resultCounts: null,
        status: null,
      };
    }
  });

  await linuxDoPage.evaluate(() => {
    window.history.pushState({}, '', '/hot');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  const hotRouteStatus = await waitForRouteStatus(popupPage, 'hot', 0, linuxDoTabId);
  await assertWorkbenchRouteChrome(linuxDoPage, 'hot', 'Hot topics', hotRouteStatus.generation);
  await linuxDoPage.evaluate(() => {
    window.history.pushState({}, '', '/top');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  const topRouteStatus = await waitForRouteStatus(popupPage, 'top', 0, linuxDoTabId);
  await assertWorkbenchRouteChrome(linuxDoPage, 'top', 'Top topics', topRouteStatus.generation);
  await linuxDoPage.evaluate(() => {
    window.history.replaceState({}, '', '/hot');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  const popstateBackRouteStatus = await waitForRouteStatus(popupPage, 'hot', 0, linuxDoTabId);
  assert.equal(new URL(linuxDoPage.url()).pathname, '/hot');
  await linuxDoPage.evaluate(() => {
    window.history.replaceState({}, '', '/top');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  const popstateForwardRouteStatus = await waitForRouteStatus(popupPage, 'top', 0, linuxDoTabId);
  assert.equal(new URL(linuxDoPage.url()).pathname, '/top');
  await linuxDoPage.evaluate(() => {
    const sameRouteLink = document.createElement('a');
    sameRouteLink.href = window.location.href;
    sameRouteLink.addEventListener('click', (event) => {
      event.preventDefault();
    });
    document.body.append(sameRouteLink);
    sameRouteLink.click();
    sameRouteLink.remove();
  });
  const repeatedRouteStatus = await waitForRouteGeneration(
    popupPage,
    popstateForwardRouteStatus.generation + 1,
    linuxDoTabId,
  );
  const liveOpenViewTabs = await readOpenViewTabs(linuxDoPage);
  assert.deepEqual(
    liveOpenViewTabs.map(({ label }) => label),
    ['latest', 'hot', 'top'],
  );
  assert.equal(liveOpenViewTabs.find(({ label }) => label === 'top')?.active, true);

  await clickPopupEnabledToggle(popupPage);
  await assertPopupText(popupPage, 'Original LINUX DO is active.');
  assert.equal(await enabledToggle.isChecked(), false);
  assert.equal(await popupPage.locator('.codicon-circle-slash').count(), 1);
  await assertRuntimeOwnership(linuxDoPage, false);
  await assertNativePageVisible(linuxDoPage);
  assert.equal(await readEnabledSetting(popupPage), false);
  await popupPage.screenshot({ path: path.join(evidenceDir, 'popup-disabled.png') });

  await linuxDoPage.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
  await linuxDoPage.waitForFunction(() => globalThis.__docodeContentStarts.length > 0);
  const disabledReloadStarts = await linuxDoPage.evaluate(
    () => globalThis.__docodeContentStarts.length,
  );
  assert.equal(disabledReloadStarts, 1);
  await assertRuntimeOwnership(linuxDoPage, false);
  await assertNativePageVisible(linuxDoPage);

  await linuxDoPage.bringToFront();
  await popupPage.reload();
  await assertPopupText(popupPage, 'Original LINUX DO is active.');
  const reloadedToggle = popupPage.getByRole('checkbox', { name: 'Enabled on LINUX DO' });
  assert.equal(await reloadedToggle.isChecked(), false);

  await clickPopupEnabledToggle(popupPage);
  assert.equal(
    await popupPage.getByText('DOCode owns the current page runtime.', { exact: true }).count(),
    0,
  );
  await assertRuntimeOwnership(linuxDoPage, true);
  assert.equal(await readEnabledSetting(popupPage), true);

  await popupPage.getByRole('button', { name: /Use original LINUX DO/u }).click();
  await assertPopupText(popupPage, 'Original LINUX DO is active.');
  await assertRuntimeOwnership(linuxDoPage, false);
  await assertNativePageVisible(linuxDoPage);
  assert.equal(await readEnabledSetting(popupPage), false);
  await linuxDoPage.screenshot({ path: path.join(evidenceDir, 'linux-do-restored.png') });
  await linuxDoPage.screenshot({
    path: path.join(compatibilityEvidenceDir, 'public-original-view.png'),
  });

  await popupPage.evaluate(async () => {
    await globalThis.chrome.storage.local.set({ enabled: 'invalid-test-value' });
  });
  await linuxDoPage.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
  await linuxDoPage.waitForFunction(() => globalThis.__docodeContentStarts.length > 0);
  await assertRuntimeOwnership(linuxDoPage, true);

  await linuxDoPage.bringToFront();
  await popupPage.reload();
  await assertPopupText(popupPage, 'An invalid saved setting was reset safely.');
  assert.equal(
    await popupPage.getByRole('checkbox', { name: 'Enabled on LINUX DO' }).isChecked(),
    true,
  );
  assert.equal(await readEnabledSetting(popupPage), true);
  await popupPage.getByRole('button', { name: /Use original LINUX DO/u }).focus();
  assert.equal(
    await popupPage
      .getByRole('button', { name: /Use original LINUX DO/u })
      .evaluate((element) => element === document.activeElement),
    true,
  );
  await popupPage.screenshot({ path: path.join(evidenceDir, 'popup-recovered-focus.png') });
  await popupPage.screenshot({
    path: path.join(popupCompactActionsEvidenceDir, 'popup-recovered-focus.png'),
  });

  const recoveredReloadStarts = await linuxDoPage.evaluate(
    () => globalThis.__docodeContentStarts.length,
  );
  assert.equal(recoveredReloadStarts, 1);
  await linuxDoPage.screenshot({ path: path.join(evidenceDir, 'linux-do-preserved.png') });
  assert.deepEqual(popupErrors, []);
  assert.deepEqual(linuxDoErrors, []);
  const popupAccessibility = await auditDomSemantics(popupPage, '.docode-popup');
  assert.deepEqual(
    {
      liveRegionsWithControls: popupAccessibility.liveRegionsWithControls,
      missingNames: popupAccessibility.missingNames,
      missingReferences: popupAccessibility.missingReferences,
      unnamedGenericLabels: popupAccessibility.unnamedGenericLabels,
    },
    {
      liveRegionsWithControls: [],
      missingNames: [],
      missingReferences: [],
      unnamedGenericLabels: [],
    },
  );
  const popupAx = await readAxSummary(popupPage);
  assertAxNode(popupAx, 'checkbox', 'Enabled on LINUX DO');
  assertAxNode(popupAx, 'button', 'Use original LINUX DO Restore the forum view');
  const popupDescriptionContrast = await readContrast(
    popupPage,
    '.docode-popup__header p',
    '.docode-popup',
  );
  assert(contrastRatio(popupDescriptionContrast) >= 4.5);
  await popupPage.waitForTimeout(250);
  const popupTargets = await readTargetSizes(popupPage, {
    restore: '.docode-popup__action--primary',
    toggle: '.docode-popup__toggle',
  });
  assert(
    Object.values(popupTargets).every(({ height, width }) => height >= 24 && width >= 24),
    `Popup target sizes: ${JSON.stringify(popupTargets)}`,
  );
  await popupPage.screenshot({
    path: path.join(accessibilityEvidenceDir, 'popup-semantics.png'),
  });

  await popupPage.evaluate(() => {
    globalThis.chrome.runtime.reload();
  });
  await assertRuntimeOwnership(linuxDoPage, false);
  await assertNativePageVisible(linuxDoPage);
  await linuxDoPage.waitForTimeout(250);
  assert.deepEqual(linuxDoErrors, []);
  await linuxDoPage.screenshot({
    path: path.join(contentContextRecoveryEvidenceDir, 'runtime-reload-native-restored.png'),
  });

  const extensionsAfterRuntimeReload = await browserSession.send('Extensions.getExtensions');
  if (extensionsAfterRuntimeReload.extensions.some(({ id }) => id === extension.id)) {
    await browserSession.send('Extensions.uninstall', { id: extension.id });
  }
  const recoveredExtension = await browserSession.send('Extensions.loadUnpacked', {
    path: extensionPath,
  });
  assert.equal(recoveredExtension.id, extension.id);
  const recoveredPopupPage = await context.newPage();
  await recoveredPopupPage.goto(`chrome-extension://${extension.id}/popup.html`);
  await recoveredPopupPage.waitForFunction(
    (expectedExtensionId) => globalThis.chrome.runtime.id === expectedExtensionId,
    extension.id,
  );
  await recoveredPopupPage.evaluate(async () => {
    await globalThis.chrome.storage.local.set({ enabled: true });
  });
  await recoveredPopupPage.close();

  await linuxDoPage.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
  await linuxDoPage.waitForFunction(() => globalThis.__docodeContentStarts.length > 0);
  assert.equal(await linuxDoPage.evaluate(() => globalThis.__docodeContentStarts.length), 1);
  await assertRuntimeOwnership(linuxDoPage, true);
  assert.deepEqual(linuxDoErrors, []);
  await linuxDoPage.screenshot({
    path: path.join(contentContextRecoveryEvidenceDir, 'runtime-reload-remounted.png'),
  });

  process.stdout.write(
    `${JSON.stringify(
      {
        browser: {
          channel: browserChannel,
          version: context.browser()?.version() ?? 'unknown',
        },
        extensionId: extension.id,
        manifestSurface: ['action', 'content_scripts', 'storage'],
        contentContextRecovery: {
          errors: linuxDoErrors,
          states: ['mounted', 'runtime-invalidated', 'native-restored', 'fresh-page-remounted'],
          screenshots: ['runtime-reload-native-restored.png', 'runtime-reload-remounted.png'].map(
            (name) => path.relative(rootDir, path.join(contentContextRecoveryEvidenceDir, name)),
          ),
        },
        popup: {
          viewport: '330x201',
          states: ['unsupported', 'enabled', 'disabled', 'recovered-invalid-storage'],
          keyboardFocus: ['enabled toggle', 'original-view action'],
          screenshots: [
            'popup-unsupported.png',
            'popup-button-hover.png',
            'popup-enabled-focus.png',
            'popup-disabled.png',
            'popup-recovered-focus.png',
          ].map((name) => path.relative(rootDir, path.join(evidenceDir, name))),
        },
        themeFoundation: {
          codiconFont: 'locally bundled @vscode/codicons 0.0.46-24',
          reference: 'VS Code Dark Modern theme and workbench typography',
          states: ['normal', 'hover', 'focus', 'disabled', 'warning'],
          viewport: '320x320',
        },
        appearanceSettings: appearanceSettingsState,
        fullWorkbenchFidelity: {
          explorer:
            'real Linux DO latest topics populate the file tree even when a topic route is opened directly',
          imagePresentation: imagePreviewState,
          listChrome: fullWorkbenchListChrome,
          reference: {
            commit: 'f489b728ba96a9a31351e25658adf0e2b6325f3a',
            runtime: 'Visual Studio Code 1.126',
            source: 'title bar, Activity Bar, Explorer, breadcrumbs, editor lines, and status bar',
          },
          screenshots: [
            'topic-list-workbench.png',
            'topic-code-workbench.png',
            'image-hover-preview.png',
            'topic-code-narrow.png',
          ].map((name) => path.relative(rootDir, path.join(fullWorkbenchEvidenceDir, name))),
          topicChrome: fullWorkbenchTopicChrome,
        },
        platformWorkbenchChrome: {
          macOS: macPlatformChrome,
          screenshots: [
            'workbench-macos.png',
            'workbench-macos-controls-hover.png',
            'workbench-windows.png',
            'workbench-windows-narrow.png',
            'terminal-prompt-wide.png',
          ].map((name) => path.relative(rootDir, path.join(platformChromeEvidenceDir, name))),
          terminalPrompt: terminalTopAlignment,
          windows: windowsPlatformChrome,
          windowsNarrow: windowsNarrowPlatformChrome,
        },
        windowsTitlebarControls: {
          autoDetectedNavigatorPlatform: 'Win32',
          desktop: m50WindowsDesktopControls,
          narrow: m50WindowsNarrowControls,
          reference: {
            commit: 'f489b728ba96a9a31351e25658adf0e2b6325f3a',
            source: 'src/vs/workbench/browser/parts/titlebar/media/titlebarpart.css',
          },
          screenshots: [
            'workbench-windows.png',
            'workbench-windows-close-hover.png',
            'workbench-windows-narrow.png',
          ].map((name) => path.relative(rootDir, path.join(windowsTitlebarEvidenceDir, name))),
        },
        fidelityRefinement: {
          differencesFixed: [
            'default fit-sized tabs use the VS Code 120px base and expand only for content instead of stretching short labels toward 220px',
            'inactive clean tab close actions remain hidden until hover or keyboard focus',
            'dirty tabs use the VS Code 2px modified top border',
            'status-item hover changes color without a focus outline while keyboard focus retains the solid focus border',
          ],
          dirtyTab: dirtyTabFidelity,
          reference: {
            commit: 'f489b728ba96a9a31351e25658adf0e2b6325f3a',
            runtime: 'Visual Studio Code 1.126',
            source:
              'editor tabs control/CSS, editor placeholder, line numbers/current line, status bar CSS/theme tokens, and Dark Modern theme',
          },
          screenshots: [
            'tabs-fit-normal.png',
            'tabs-fit-hover.png',
            'tabs-fit-focus.png',
            'tabs-fit-narrow.png',
            'status-hover.png',
            'status-focus.png',
            'dirty-tab.png',
            'shell-editor-desktop.png',
            'shell-editor-narrow.png',
            'search-ready.png',
            'search-narrow.png',
            'workbench-error.png',
          ].map((name) => path.relative(rootDir, path.join(fidelityRefinementEvidenceDir, name))),
          statusHover,
          tabStates: {
            focus: tabFitFocus,
            hover: tabFitHover,
            normal: tabFitNormal,
          },
          viewports: ['1280x800', '420x640', '320x640'],
        },
        topicFidelity: {
          differencesFixed: [
            'native rich-content blockquotes and figures reset browser inline margins while retaining the established editor reading rhythm',
            'Outline post nodes expose real expanded state, VS Code-sized twisties, pointer toggling, and Left/Right tree navigation',
            'the minimap viewport slider follows the VS Code mouseover default while remaining visible for focus and drag',
          ],
          interactions: {
            minimap: ['default hidden slider', 'hover', 'focus', 'drag', 'reduced motion'],
            outline: ['keyboard collapse and expand', 'pointer collapse and expand'],
          },
          longScrollbarGeometry,
          minimapDefaultOpacity,
          outline: outlineFidelity,
          reference: {
            commit: 'f489b728ba96a9a31351e25658adf0e2b6325f3a',
            runtime: 'Visual Studio Code 1.126',
            source:
              'editor minimap slider, Markdown preview typography, Outline/document-symbol tree, list rows, and scrollbar sources',
          },
          richContent: richContentGeometry,
          screenshots: [
            'topic-code-rich-content.png',
            'topic-code-desktop.png',
            'topic-doc-desktop.png',
            'topic-code-narrow.png',
            'topic-partial.png',
            'outline-collapsed.png',
            'outline-expanded.png',
            'minimap-normal.png',
            'minimap-hover.png',
            'minimap-focus.png',
            'minimap-drag.png',
            'topic-long.png',
          ].map((name) => path.relative(rootDir, path.join(topicFidelityEvidenceDir, name))),
          states: ['short topic', 'long topic', 'partial markup', 'narrow viewport'],
          viewports: ['1280x800', '420x640'],
        },
        transientFidelity: {
          commandPalette: commandPaletteReady,
          differencesFixed: [
            'Quick Input now uses the current VS Code top offset, 12px surface radius, xl shadow, and 250ms entrance timing',
            'tab and post context menus now use 24px rows, 8px surfaces, 6px items, lg shadows, and the 83ms fade timing',
            'terminal suggestions now share the floating workbench surface radius and shadow relationships',
            'workbench-owned tooltips now provide delayed pointer display, immediate keyboard display, viewport clamping, and accessible descriptions',
          ],
          menus: {
            post: postMenuGeometry,
            reducedMotionAnimationDuration: reducedMenuAnimationDuration,
            tab: tabMenuGeometry,
          },
          quickInput: {
            normal: quickInputFidelity,
            reducedMotionAnimationDuration: reducedQuickInputAnimationDuration,
          },
          reference: {
            commit: 'f489b728ba96a9a31351e25658adf0e2b6325f3a',
            runtime: 'Visual Studio Code 1.126',
            source:
              'Quick Input, menu/actionbar, hover widget/service, panel part, terminal, workbench size tokens, and Dark Modern theme',
          },
          screenshots: [
            'quick-open-ready.png',
            'command-palette-ready.png',
            'quick-open-reduced-motion.png',
            'tab-menu-pointer.png',
            'tab-menu-reduced-motion.png',
            'post-menu-pointer.png',
            'terminal-no-completion-prompt-ready.png',
            'panel-terminal-error.png',
            'tooltip-pointer.png',
            'native-composer-open.png',
            'native-composer-narrow.png',
          ].map((name) => path.relative(rootDir, path.join(transientFidelityEvidenceDir, name))),
          terminalSuggestions: terminalSuggestionFidelity,
          tooltips: {
            pointer: pointerTooltipFidelity,
          },
          viewports: ['1280x800', '420x640'],
        },
        workbenchShell: {
          chrome: desktopChrome,
          desktop: desktopShellGeometry,
          narrow: narrowShellGeometry,
          panelResize: {
            keyboardHeight: 370,
            pointerHeight: 380,
          },
          reference: 'VS Code editor grid, 4px sash, 77px panel minimum, and 22px status bar',
          screenshots: [
            'topic-code-desktop.png',
            'workbench-hover.png',
            'workbench-focus.png',
            'workbench-inactive.png',
            'workbench-resized.png',
            'topic-code-narrow.png',
            'workbench-disabled.png',
          ].map((name) => path.relative(rootDir, path.join(evidenceDir, name))),
          unsupported: unsupportedChrome,
        },
        terminalPanel: {
          closed: closedPanelGeometry,
          interactions: [
            'ArrowLeft and ArrowRight changed panel tabs with roving focus',
            'pointer activation focused the command prompt',
            'unknown command returned a structured error without rendering markup',
            'Outline and Terminal switching retained terminal output',
            'close expanded the editor and reopen restored the terminal session and focus',
          ],
          normal: terminalPanel,
          reference:
            'VS Code bottom panel title actions and terminal spacing, typography, focus, and colors',
          screenshots: [
            'terminal-error.png',
            'terminal-panel-closed.png',
            'terminal-panel-reopened.png',
            'terminal-narrow.png',
          ].map((name) => path.relative(rootDir, path.join(evidenceDir, name))),
          states: ['ready', 'structured error', 'closed', 'reopened', 'narrow'],
        },
        terminalCommands: {
          commands: [
            'help',
            'clear',
            'panel <show|hide|toggle|outline|terminal>',
            'mode <code|doc>',
            'latest',
            'hot',
            'open </t/slug/id[/floor]>',
            'goto <floor>',
          ],
          interactions: [
            'help listed only commands available for the ready topic and terminal entry point',
            'mode changed Code and Doc through the terminal and shared status command; Doc reported its development notice',
            'goto and open completed only after the expected route was observed',
            'Back and Forward retained terminal output and address-backed topic state',
            'a redirected goto returned stale and never rendered success',
            'hot used real anchor navigation and Back restored the topic',
            'panel outline/hide reused the shared panel controls and retained output',
            'foreign-origin open failed validation without navigation',
            'clear removed terminal presentation history',
          ],
          screenshots: [
            'terminal-command-help.png',
            'terminal-command-mode.png',
            'terminal-command-navigation.png',
            'terminal-command-stale.png',
            'terminal-command-panel.png',
          ].map((name) => path.relative(rootDir, path.join(evidenceDir, name))),
        },
        terminalInput: {
          contexts: {
            empty: emptyCompletion,
            error: errorCompletion,
            ready: readyCompletion,
          },
          historyLimit: 50,
          interactions: [
            'Terminal command and virtual-path candidates never rendered a completion prompt',
            'Tab accepted a unique command or virtual-path completion without opening a list',
            'successful commands entered bounded session-local history in canonical form',
            'ArrowUp and ArrowDown restored the newest command and the in-progress draft',
            'failed, unknown, and redirected commands were not retained in input history',
            'empty and error topic contexts excluded the unavailable mode and goto commands',
          ],
          screenshots: [
            'terminal-no-completion-prompt-ready.png',
            'terminal-no-completion-prompt-empty.png',
            'terminal-no-completion-prompt-error.png',
            'terminal-history.png',
          ].map((name) => path.relative(rootDir, path.join(evidenceDir, name))),
        },
        quickOpen: {
          filtered: quickOpenFiltered,
          interactions: [
            'editor action opened the focused combobox and Escape restored trigger focus',
            'case-insensitive text filtering highlighted the matching real topic title',
            'Enter and pointer selection opened route-backed views through confirmed navigation',
            'browser Back restored the topic-list route and retained open-view ordering',
            'a redirected selection stayed open and reported stale navigation without fake success',
            'Tab and Shift+Tab trapped focus between the input and close action',
          ],
          narrow: narrowQuickOpen,
          ready: quickOpenReady,
          reference: 'VS Code Quick Input 600px widget, 22px rows, and Dark Modern tokens',
          screenshots: [
            'quick-open-ready.png',
            'quick-open-filtered.png',
            'quick-open-empty-filter.png',
            'quick-open-navigation-error.png',
            'quick-open-loading.png',
            'quick-open-empty.png',
            'quick-open-error.png',
            'quick-open-narrow.png',
          ].map((name) => path.relative(rootDir, path.join(evidenceDir, name))),
          sources: ['current route-backed open views', 'currently loaded real Linux DO topics'],
          states: ['ready', 'filtered', 'no match', 'loading', 'empty', 'error', 'narrow'],
        },
        commandPalette: {
          filtered: commandPaletteFiltered,
          interactions: [
            'editor action opened a focused command combobox and Escape restored trigger focus',
            'filtering retained only registered executable command variants in contextual groups',
            'panel control reached the same shared action used by the terminal command',
            'confirmed Linux DO navigation exposed pending before the observed route result',
            'redirected navigation stayed open with a structured stale error and no fake success',
            'Command Palette to Quick Open transition retained the original focus return target',
            'Tab and Shift+Tab trapped focus between the input and close action',
          ],
          narrow: narrowCommandPalette,
          ready: commandPaletteReady,
          reference: 'VS Code Commands Quick Access over the shared 600px Quick Input widget',
          screenshots: [
            'command-palette-ready.png',
            'command-palette-filtered.png',
            'command-palette-empty-filter.png',
            'command-palette-pending.png',
            'command-palette-error.png',
            'command-palette-narrow.png',
          ].map((name) => path.relative(rootDir, path.join(evidenceDir, name))),
          states: ['ready', 'filtered', 'no match', 'pending', 'error', 'narrow'],
        },
        keybindings: {
          editableShortcutMatrix,
          interactions: [
            `${keybindingShortcutLabels[0]} opened Quick Open from a non-editable workbench target and Escape restored it`,
            `${keybindingShortcutLabels[1]} opened Command Palette with the verified Quick Open shortcut label`,
            `${keybindingShortcutLabels[2]} hid Terminal, reopened and focused it, then hid it from its own prompt`,
            'terminal text typing remained ordinary input and the Quick Open chord was not intercepted there',
            'native composer and generic input contexts retained all three candidate shortcuts',
            'Alt+Left, the browser location chord, repeated chords, and unsupported routes were not claimed',
            'browser Back restored the supported route after the unsupported-route matrix',
          ],
          labels: keybindingShortcutLabels,
          screenshots: [
            'keybinding-quick-open.png',
            'keybinding-command-palette.png',
            'keybinding-terminal-hidden.png',
            'keybinding-terminal-focused.png',
          ].map((name) => path.relative(rootDir, path.join(evidenceDir, name))),
        },
        keyboardAndFocus: {
          conflictMatrix: editableShortcutMatrix,
          interactions: [
            'Arrow, Home, End, Enter, and Escape preserved roving focus across views, posts, Outline, minimap, panel tabs, and overlays',
            'tab and post menus retained focus during keyboard traversal, restored their invoker on Escape or completion, and kept failed actions reachable',
            'closing inactive or active route-backed tabs focused the surviving active tab instead of the document body',
            'Terminal kept its read-only prompt focused while a command was pending, but did not reclaim focus moved by a command',
            'Command Palette preserved focus explicitly moved to Terminal or the exact native Linux DO Composer',
            'native Composer open focused the exact editor; discard and confirmed submission restored the initiating workbench boundary',
            'native Composer and ordinary editable targets retained browser and typing shortcuts',
          ],
          reference:
            'VS Code editor context-menu focus return, Quick Input conditional focus restoration, menu keyboard containment, and terminal focus ownership',
          shortcutLabels: keybindingShortcutLabels,
          screenshots: [
            'palette-command-focus.png',
            'shortcut-conflict-matrix.png',
            'tab-close-focus.png',
            'tab-menu-keyboard.png',
            'post-menu-keyboard.png',
            'terminal-input-focus.png',
            'composer-focus-open.png',
            'composer-discard-focus-return.png',
            'palette-composer-focus.png',
          ].map((name) => path.relative(rootDir, path.join(keyboardEvidenceDir, name))),
        },
        accessibility: {
          automatedSemantics: {
            composerInteractiveControls: composerAccessibility.interactiveCount,
            popupInteractiveControls: popupAccessibility.interactiveCount,
            quickInputInteractiveControls: quickInputAccessibility.interactiveCount,
            searchInteractiveControls: searchAccessibility.interactiveCount,
            topicInteractiveControls: topicAccessibility.interactiveCount,
            topicListInteractiveControls: topicListAccessibility.interactiveCount,
            violations: 0,
          },
          contrastRatios: {
            popupDescription: Number(contrastRatio(popupDescriptionContrast).toFixed(2)),
            readTopicTitle: Number(contrastRatio(readTopicContrast).toFixed(2)),
            searchDescription: Number(contrastRatio(searchDescriptionContrast).toFixed(2)),
            topicFloor: Number(contrastRatio(topicFloorContrast).toFixed(2)),
          },
          interactions: [
            'the Chromium accessibility tree exposes named workbench, editor, list/document, toolbar, panel, status, tree, slider, dialog, listbox/group/option, search group, and native Composer nodes',
            'every visible interactive control in the audited popup, list, topic, search, Quick Input, and Composer states has an accessible name',
            'every audited ARIA ID reference resolves, IDs are unique, and live status/alert regions contain no interactive controls',
            'unavailable post actions expose full static state text while the always-visible More Actions menu preserves the executable path',
            'Quick Input remains read-only, focused, and aria-disabled while pending instead of removing its only active focus owner',
            'essential compact targets measure at least 22px in the workbench and 24px in the popup after removal of the redundant editor-title reading-mode toolbar',
          ],
          reducedMotion: {
            loading: reducedMotionLoading,
            topic: reducedMotionTopic,
          },
          reference:
            'VS Code ActionBar/menu roles, accessibility-labelled controls, Dark Modern tokens, editor progress-bar reduced-motion handling, and workbench.reduceMotion auto behavior',
          screenshots: [
            'popup-semantics.png',
            'topic-list-semantics.png',
            'quick-input-semantics.png',
            'search-semantics.png',
            'reduced-motion-loading.png',
            'topic-semantics-reduced-motion.png',
            'native-composer-semantics.png',
          ].map((name) => path.relative(rootDir, path.join(accessibilityEvidenceDir, name))),
          targetSizes: {
            composer: composerTargets,
            popup: popupTargets,
            quickInput: quickInputTargets,
            search: searchTargets,
            topic: topicTargets,
            topicList: topicListTargets,
          },
        },
        compatibilityRegression: {
          changedMarkup: {
            initialTopic: compatibilityInitialTopic,
            recoveredTopic: compatibilityRecoveredTopic,
            originalRecovery: compatibilityOriginalRecovery,
          },
          interactions: [
            'a partial post remained readable beside its complete neighbor and recovered when native author/content roots arrived later',
            'missing Like, Bookmark, Copy Link, Reply, and Composer bindings disabled only those capabilities without replacing readable content',
            'removing the verified post-stream class produced a bounded compatibility error instead of a ready or fake-success surface',
            'error and unsupported-route recovery removed the runtime/style and exposed the original native page',
            'queued observer work and pending navigation/action/composer/search paths reject stale generations in deterministic coverage',
            'the current public Linux DO latest route mounted, traversed hot/top route state, and restored the original page without page errors',
          ],
          missingActions: compatibilityMissingActions,
          partialSurface: compatibilityPartialSurface,
          publicSmoke: {
            errorCount: linuxDoErrors.length,
            initialRoute: initialRouteStatus,
            routeFamilies: [
              hotRouteStatus.family,
              topRouteStatus.family,
              popstateBackRouteStatus.family,
              popstateForwardRouteStatus.family,
              repeatedRouteStatus.family,
            ],
            searchProbe: livePublicSearchProbe,
          },
          screenshots: [
            'partial-markup.png',
            'partial-markup-recovered.png',
            'missing-actions-isolated.png',
            'changed-markup-error.png',
            'changed-markup-original-view.png',
            'unsupported-route-safe.png',
            'unsupported-route-original-view.png',
            'public-latest-smoke.png',
            'public-original-view.png',
          ].map((name) => path.relative(rootDir, path.join(compatibilityEvidenceDir, name))),
          unsupportedOriginalRecovery,
        },
        performance: {
          composerDetection:
            'native Composer input and observation use a topic-scoped Composer detector without enumerating loaded posts',
          interactions: [
            '32 alternating long-topic scroll frames retained bounded script, layout, and task duration',
            '12 sequential same-topic SPA transitions retained one runtime, workbench root, owned style, and 80 exact native content roots',
            'five disable/re-enable cycles restored all three native roots and returned to one runtime root and one owned style',
          ],
          lifecycle: repeatedLifecycle,
          longTopic: longTopicPerformance,
          screenshots: ['long-topic-performance.png', 'repeated-lifecycle.png'].map((name) =>
            path.relative(rootDir, path.join(performanceEvidenceDir, name)),
          ),
          viewportLookup:
            'the active loaded reply uses logarithmically bounded layout reads and memoized reply/minimap render boundaries',
        },
        openViews: {
          afterClose: closedViewTabs,
          beforeClose: openViewTabs,
          copiedDeepLink,
          historyActivation,
          interactions: [
            'real topic anchor supplied unread evidence',
            'same topic identity reused its stable position',
            'ArrowRight moved tab focus and Enter followed the real route link',
            'inactive close removed in place',
            'active close navigated to the adjacent real route before removal',
            'browser Back and Forward activated existing views without reordering',
            'a closed historical route reopened when browser history returned to it',
            'reload and copied deep links rebuilt only the current real route',
            'stale transient and unmatched intent state was removed',
          ],
          narrow: narrowOpenViewTabs,
          reload: reloadedViewTabs,
          reopenedFromHistory: reopenedHistoryTabs,
          screenshots: [
            'tabs-multiple.png',
            'tabs-history-forward.png',
            'tabs-multiple-narrow.png',
            'tabs-keyboard-focus.png',
            'tabs-after-close.png',
            'tabs-history-reopened.png',
            'tabs-reload.png',
          ].map((name) => path.relative(rootDir, path.join(evidenceDir, name))),
          transientCleanup: transientCleanupTabs,
        },
        tabContextActions: {
          approvedStoredState,
          closeOthers: closeOtherTabs,
          closeRight: closeRightTabs,
          interactions: [
            'Shift+F10 opened the menu and Escape restored tab focus',
            'ArrowDown moved menu focus over enabled actions',
            'Copy Topic Link wrote the selected canonical topic URL through the Clipboard API',
            'Close to the Right and Close Others reused route-aware tab mutations',
            'Open Original View disabled DOCode and restored the native page',
            'reload reconstructed one current route and storage retained only enabled',
          ],
          menuGeometry: tabMenuGeometry,
          pin: 'not rendered because pinning and tab persistence are not approved',
          screenshots: [
            'tab-menu-keyboard.png',
            'tab-menu-pointer.png',
            'tab-menu-close-right.png',
            'tab-menu-close-others.png',
            'tab-menu-original-view.png',
          ].map((name) => path.relative(rootDir, path.join(evidenceDir, name))),
        },
        workbenchStates: {
          recovery: 'Use Original Linux DO disabled the runtime and restored the native page',
          states: [
            'list loading',
            'empty',
            'list error',
            'topic loading',
            'topic error',
            'unsupported',
          ],
          transitions: ['loading → empty → ready', 'error → retry remained error'],
          screenshots: [
            'workbench-loading.png',
            'workbench-empty.png',
            'workbench-error.png',
            'topic-loading.png',
            'topic-error.png',
            'workbench-disabled.png',
            'workbench-original-recovery.png',
          ].map((name) => path.relative(rootDir, path.join(evidenceDir, name))),
        },
        topicListDocument: {
          interactions: {
            browserHistory: 'topic open → Back → Forward → Back',
            keyboard: ['ArrowDown', 'End', 'Home', 'platform-primary+Enter opens the topic'],
            modifier: 'platform-primary click opened the topic through route-aware navigation',
            pointer: 'ordinary click selects; modifier-hover exposes definition-link styling',
          },
          longList: {
            lineCount: 4_014,
            renderMilliseconds: Math.round(longListRenderMs),
          },
          normal: topicListDocument,
          reference:
            'VS Code line-number, view-line, font metrics, Dark Modern token, and scrollbar sources',
          routes: ['latest', 'hot', 'category'],
          screenshots: [
            'topic-list-latest.png',
            'topic-list-hover.png',
            'topic-list-keyboard-end.png',
            'topic-list-scrolled.png',
            'topic-list-hot.png',
            'topic-list-category.png',
            'topic-list-long-end.png',
            'topic-list-narrow.png',
          ].map((name) => path.relative(rootDir, path.join(evidenceDir, name))),
          scrolling: 'vertical editor scrolling remained synchronized with the fixed gutter',
          viewport: ['1280x800', '420x640'],
        },
        topicCodeDocument: {
          interactions: {
            keyboard: 'native rich-content link received focus with a visible focus outline',
            pointer: 'floor permalink exposed the native link hover treatment',
            selection: 'text from the moved native paragraph remained selectable',
          },
          normal: topicCodeDocument,
          ownership:
            'exact native cooked roots moved into normal-DOM slots and returned to Linux DO on disable',
          reference:
            'VS Code line-number, indent-guide, CodeLens, editor-link, Dark Modern rich-text, and scrollbar sources',
          screenshots: [
            'topic-code-desktop.png',
            'topic-code-floor-hover.png',
            'topic-code-scrolled.png',
            'topic-code-narrow.png',
            'topic-code-restored.png',
          ].map((name) => path.relative(rootDir, path.join(evidenceDir, name))),
          viewport: ['1280x800', '420x640'],
        },
        topicDocDocument: {
          continuity: `Code → Doc → Code → Doc retained the same native roots and ${String(continuityScrollTop)}px scroll position`,
          interactions: {
            keyboard: 'the status mode command activated with Enter and retained visible focus',
            pointer: 'Doc mode activated through the status mode command',
          },
          normal: topicDocDocument,
          reference: 'VS Code Markdown preview typography and editor action-bar density',
          screenshots: [
            'topic-doc-desktop.png',
            'topic-doc-scrolled.png',
            'topic-doc-status-focus.png',
            'topic-doc-narrow.png',
          ].map((name) => path.relative(rootDir, path.join(evidenceDir, name))),
          viewport: ['1280x800', '420x640'],
        },
        readingModes: {
          approvedPersistence:
            'only enabled is stored; Code, Doc, scroll, and open-view mode state remain session-local',
          modeToolbarRemoval: {
            list: listModeToolbarRemoval,
            topicModeToolbarCount: topicDocDocument.modeToolbarCount,
            restoration:
              'the native Linux DO recovery action remains independent in the Activity Bar instead of appearing as a reading mode',
          },
          nativeOriginal: {
            disabledReloadStarts,
            enabledSettingAfterActivityAction: false,
            restoration:
              'the Activity Bar recovery action used the controller disable path, restored native topic content, and the later disabled reload remained original',
          },
          reference:
            'VS Code terminal/status command behavior with no redundant editor-title reading-mode toolbar',
          screenshots: ['list-mode-toolbar-removed.png', 'native-view-restored.png'].map((name) =>
            path.relative(rootDir, path.join(readingModeEvidenceDir, name)),
          ),
        },
        contextualStatus: {
          commandIntegrity:
            'the status mode item dispatched docode.mode.set through the status-bar entry point',
          fields: [
            'canonical current route',
            'exact category anchor',
            'current post permalink and loaded window',
            'Code and Doc mode command',
            'surface, native action, and Composer state',
          ],
          matrix: [
            'ready logged-out topic',
            'ready authenticated actions',
            'topic loading',
            'topic read error',
            'unsupported route',
            'Composer opening, open, draft, submitting, submitted, and failed',
            '420px contextual priority',
          ],
          reference:
            'current VS Code 22px status-bar item density, hover, active, command, tooltip, warning, and error relationships',
          screenshots: [
            'status-topic-context.png',
            'status-actions-ready.png',
            'status-action-pending.png',
            'status-loading.png',
            'status-error.png',
            'status-unsupported.png',
            'status-narrow-context.png',
            'status-narrow-error.png',
          ].map((name) => path.relative(rootDir, path.join(statusEvidenceDir, name))),
        },
        topicPostAffordances: {
          capabilities:
            'logged-out Like and Bookmark remain honest non-interactive states; permalink is a real anchor',
          incremental: {
            loadedRange: 'posts 1–3 loaded (3)',
            nativeIdentityPreserved: true,
            renderMilliseconds: Math.round(incrementalRenderMs),
          },
          keyboard: 'ArrowUp, ArrowDown, Home, and End move the roving post focus',
          longLoadedWindow: {
            firstPost: 21,
            lastPost: 100,
            loadedPostCount: 80,
            renderMilliseconds: longTopicRenderMs,
          },
          normal: topicPostAffordances,
          screenshots: [
            'topic-post-focus.png',
            'topic-actions-disabled.png',
            'topic-incremental-complete.png',
            'topic-long-window.png',
          ].map((name) => path.relative(rootDir, path.join(evidenceDir, name))),
        },
        contextActions: {
          commandIntegrity:
            'tab menu, inline post actions, and post context menu dispatched registered stable IDs; Linux DO adapters and navigation remained the sole executors',
          interactions: [
            'secondary post actions appeared on hover while an always-visible More Actions button retained non-hover access',
            'pointer and Shift+F10 opened the same menu; Arrow keys moved focus and Escape restored the invoking reply',
            'Copy Post Link wrote the canonical permalink through the Clipboard API',
            'pending native Like disabled every menu item and the confirmed state relabeled Like as Remove Like',
          ],
          screenshots: [
            'post-hover-actions.png',
            'post-menu-pointer.png',
            'post-menu-keyboard.png',
            'post-menu-pending.png',
            'post-menu-confirmed.png',
          ].map((name) => path.relative(rootDir, path.join(contextActionEvidenceDir, name))),
        },
        nativePostActions: {
          ...nativePostActions,
          confirmation:
            'Like required the matching completed Linux DO response plus settled native state; Bookmark required the server-confirmed native bookmarked state',
          interactions: [
            'post action buttons exposed pending before native confirmation',
            'Terminal and Command Palette reused the same registered action commands',
            'a failing native Like response rolled back and surfaced a structured error without success',
          ],
          screenshots: [
            'native-like-pending.png',
            'native-like-confirmed.png',
            'native-bookmark-pending.png',
            'native-bookmark-confirmed.png',
            'native-actions-command-palette.png',
            'native-like-failure.png',
          ].map((name) => path.relative(rootDir, path.join(nativeActionEvidenceDir, name))),
        },
        likeStateTransition: {
          behavior:
            'the inline action names the next real operation: confirmed Like replaces like with unlike, and confirmed removal restores like',
          integrity:
            'manual inline actions and Terminal commands both waited for the Linux DO adapter confirmation before refreshing the shared active state',
          screenshots: ['like-to-unlike-confirmed.png', 'unlike-to-like-terminal.png'].map((name) =>
            path.relative(rootDir, path.join(likeStateTransitionEvidenceDir, name)),
          ),
        },
        nativeComposer: {
          ...nativeComposerFlow,
          authority:
            'the exact Linux DO composer root, textarea, submit, discard, server response, and rendered post remained authoritative',
          interactions: [
            'the editor action opened and focused the native Linux DO textarea',
            'native input updated both the composer dirty marker and stable topic tab evidence',
            'Discard used the native control and restored the exact closed root to its source',
            'Terminal and Command Palette reused the registered Reply command',
            'a confirmed POST response plus native rendered post closed the composer without local fake success',
            'a rejected POST retained the exact native draft and surfaced the native error',
            'disabling DOCode restored the open native composer and draft; re-enabling adopted the same root',
          ],
          narrow: nativeComposerNarrow,
          open: nativeComposerOpen,
          screenshots: [
            'native-composer-open.png',
            'native-composer-dirty.png',
            'native-composer-submitting.png',
            'native-composer-submitted.png',
            'native-composer-command-palette.png',
            'native-composer-failure.png',
            'native-composer-narrow.png',
            'native-composer-restored.png',
          ].map((name) => path.relative(rootDir, path.join(nativeComposerEvidenceDir, name))),
        },
        actionHardening: {
          duplicateLikeNativeRequestCount: 1,
          duplicateReplyNativeClickCount: composerOpenRequestCount,
          interactions: [
            'a Terminal Like during a pending editor action was rejected without a second native request',
            'the Reply editor action exposed disabled aria-busy state while native opening was pending',
            'a Terminal Reply during pending native opening was rejected without a second native click',
            'unit coverage aborts stale, caller-cancelled, and compatibility-lost actions before retry',
          ],
          screenshots: ['duplicate-like-blocked.png', 'duplicate-reply-blocked.png'].map((name) =>
            path.relative(rootDir, path.join(actionHardeningEvidenceDir, name)),
          ),
        },
        linuxDoSearch: {
          endpointRequests: searchApiRequests,
          geometry: searchDocumentGeometry,
          interactions: [
            'Terminal search navigated to the canonical Linux DO search URL',
            'Search document and Quick Open consumed the same grouped-search endpoint',
            'Command Palette opened the shared Quick Open search provider',
            'category, user, and exact post results retained their real href values',
            'browser Back and Forward restored search/category history',
          ],
          navigationHistory: searchNavigationHistory,
          livePublicProbe: livePublicSearchProbe,
          quickOpen: remoteQuickOpen,
          reference: 'VS Code Search view 22px groups, dense result rows, and Dark Modern tokens',
          screenshots: [
            'search-ready.png',
            'search-history-restored.png',
            'search-empty.png',
            'search-error.png',
            'quick-open-search.png',
            'palette-search.png',
            'search-narrow.png',
          ].map((name) => path.relative(rootDir, path.join(searchEvidenceDir, name))),
          states: ['ready', 'empty', 'error', 'narrow'],
        },
        topicOutline: {
          incremental:
            'the third post and its heading appeared after the native post-stream update',
          interactions: {
            keyboard: ['ArrowRight', 'ArrowLeft', 'Home', 'Enter'],
            modifier: 'Control-click remained unprevented for native browser handling',
            navigation:
              'Enter followed the real post permalink and focused the matching loaded reply',
          },
          longLoadedWindow: {
            firstPost: 21,
            lastPost: 100,
            loadedPostCount: 80,
          },
          normal: topicOutline,
          reference:
            'VS Code Outline pane, WorkbenchDataTree rows, list selection, and symbol colors',
          screenshots: [
            'topic-outline-focus.png',
            'topic-outline-navigation.png',
            'topic-incremental-complete.png',
            'topic-long-window.png',
          ].map((name) => path.relative(rootDir, path.join(evidenceDir, name))),
          states: ['loading', 'error', 'ready', 'incremental loaded range'],
        },
        topicMinimap: {
          interactions: {
            keyboard: ['Home', 'End'],
            modifier: 'Control-click remained unprevented for native browser handling',
            navigation:
              'Enter and pointer activation followed real post permalinks and focused matching loaded replies',
            pointer: ['track click', 'viewport drag'],
            scrollEventCount: minimapScrollEventCount,
          },
          longLoadedWindow: {
            loadedRange: longTopicMinimap.loadedRange,
            markCount: longTopicMinimap.markCount,
            scrollEventCount: longTopicScrollEventCount,
          },
          normal: topicMinimap,
          nativeContentCorrection,
          reference:
            'VS Code minimap microtext, viewport slider, and overview-ruler position mapping',
          resized: resizedTopicMinimap,
          correctionScreenshots: [
            'topic-minimap-microtext.png',
            'topic-quote-normalized.png',
            'topic-final-line.png',
          ].map((name) =>
            path.relative(rootDir, path.join(topicMinimapCorrectionEvidenceDir, name)),
          ),
          screenshots: [
            'topic-minimap-normal.png',
            'topic-minimap-hover.png',
            'topic-minimap-focus.png',
            'topic-minimap-navigation.png',
            'topic-minimap-drag.png',
            'topic-minimap-scrolled.png',
            'topic-code-narrow.png',
            'topic-long-window.png',
          ].map((name) => path.relative(rootDir, path.join(evidenceDir, name))),
          states: ['loading', 'error', 'ready', 'incremental loaded range', 'narrow hidden'],
        },
        linuxDo: {
          url: linuxDoPage.url(),
          contentScriptStartsAfterDisabledReload: disabledReloadStarts,
          contentScriptStartsAfterRecoveryReload: recoveredReloadStarts,
          enabledSettingAfterRecovery: true,
          ownedStylesAfterRecovery: 1,
          restoredNativePageBeforeRecovery: true,
          runtimeMarkerAfterRecovery: true,
          routeObservation: {
            hotGeneration: hotRouteStatus.generation,
            initialGeneration: initialRouteStatus.generation,
            popstateBackGeneration: popstateBackRouteStatus.generation,
            popstateForwardGeneration: popstateForwardRouteStatus.generation,
            repeatedGeneration: repeatedRouteStatus.generation,
            topGeneration: topRouteStatus.generation,
            verification: 'pushState, dispatched popstate, and same-URL link event',
          },
          routeTabs: liveOpenViewTabs,
          screenshots: ['linux-do-restored.png', 'linux-do-preserved.png'].map((name) =>
            path.relative(rootDir, path.join(evidenceDir, name)),
          ),
          syntheticTopicListFixture: {
            state: 'ready',
            topicCount: 36,
            url: topicListFixtureUrl,
          },
          syntheticTopicFixture: {
            capabilities: {
              availableCopyLinkCount: 2,
              composerState: 'authentication-required',
              observer: {
                affectedCopyLinkCount: 1,
                generation: topicCapabilityGeneration + 1,
                irrelevantMutationGeneration: topicCapabilityGeneration,
              },
              replyState: 'authentication-required',
              userState: 'logged-out',
            },
            containsRequestedPost: true,
            hasMorePosts: true,
            incrementalPostCount: 3,
            postCount: 2,
            state: 'ready',
            url: topicFixtureUrl,
          },
        },
      },
      null,
      2,
    )}\n`,
  );
} finally {
  await context?.close();
  await rm(profileDir, { recursive: true, force: true });
}

async function assertPopupText(page, text) {
  await page.getByText(text, { exact: true }).waitFor();
}

async function clickPopupEnabledToggle(page) {
  const checkbox = page.getByRole('checkbox', { name: 'Enabled on LINUX DO' });
  await checkbox.waitFor({ state: 'visible' });
  await page.locator('.docode-popup__toggle-track').click();
}

function metricDelta(before, after, names) {
  const beforeValues = new Map(before.map(({ name, value }) => [name, value]));
  const afterValues = new Map(after.map(({ name, value }) => [name, value]));
  return Object.fromEntries(
    names.map((name) => [name, (afterValues.get(name) ?? 0) - (beforeValues.get(name) ?? 0)]),
  );
}

async function assertThemeFoundation(page) {
  await page.evaluate(() => document.fonts.ready);
  const theme = await page.locator('.docode-popup').evaluate((element) => {
    const style = getComputedStyle(element);
    const icon = element.querySelector('.docode-popup__action--primary .codicon-debug-disconnect');
    if (!icon) return null;
    const iconStyle = getComputedStyle(icon);
    return {
      buttonBackground: style.getPropertyValue('--docode-color-button-background').trim(),
      chromeBackground: style.getPropertyValue('--docode-color-chrome-background').trim(),
      editorBackground: style.getPropertyValue('--docode-color-editor-background').trim(),
      focusBorder: style.getPropertyValue('--docode-color-focus-border').trim(),
      fontFamily: style.getPropertyValue('--docode-font-family-ui').trim(),
      fontSize: style.getPropertyValue('--docode-font-size-ui').trim(),
      iconContent: getComputedStyle(icon, '::before').content,
      iconFontFamily: iconStyle.fontFamily,
      iconFontSize: iconStyle.fontSize,
    };
  });
  assert(theme, 'The Dark Modern theme root and original-view Codicon must be rendered.');
  assert.deepEqual(
    {
      buttonBackground: theme.buttonBackground,
      chromeBackground: theme.chromeBackground,
      editorBackground: theme.editorBackground,
      focusBorder: theme.focusBorder,
      fontSize: theme.fontSize,
      iconFontSize: theme.iconFontSize,
    },
    {
      buttonBackground: '#0078d4',
      chromeBackground: '#1e1e1e',
      editorBackground: '#1e1e1e',
      focusBorder: '#0078d4',
      fontSize: '13px',
      iconFontSize: '12px',
    },
  );
  assert(theme.fontFamily.includes('-apple-system'));
  assert(theme.iconFontFamily.includes('codicon'));
  assert(!['none', 'normal', '""'].includes(theme.iconContent));
}

async function auditDomSemantics(page, rootSelector) {
  return page.locator(rootSelector).evaluate((root) => {
    const isVisible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        rect.width > 0 &&
        rect.height > 0
      );
    };
    const accessibleName = (element) => {
      const ariaLabel = element.getAttribute('aria-label')?.trim();
      if (ariaLabel) return ariaLabel;
      const labelledBy = element.getAttribute('aria-labelledby')?.trim().split(/\s+/u) ?? [];
      const labelledText = labelledBy
        .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
        .filter(Boolean)
        .join(' ');
      if (labelledText) return labelledText;
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        const labelText = Array.from(
          element.labels ?? [],
          (label) => label.textContent?.trim() ?? '',
        )
          .filter(Boolean)
          .join(' ');
        if (labelText) return labelText;
      }
      if (element instanceof HTMLImageElement && element.alt.trim()) return element.alt.trim();
      return element.textContent?.trim() || element.getAttribute('title')?.trim() || '';
    };
    const interactiveSelector = [
      'a[href]',
      'button',
      'input',
      'select',
      'textarea',
      '[role="menuitem"]',
      '[role="option"]',
      '[role="separator"][tabindex]',
      '[role="slider"]',
      '[role="tab"]',
      '[role="treeitem"]',
    ].join(',');
    const interactive = Array.from(root.querySelectorAll(interactiveSelector)).filter(isVisible);
    const missingNames = interactive
      .filter((element) => !accessibleName(element))
      .map((element) => `${element.tagName.toLowerCase()}.${element.className}`);
    const missingReferences = Array.from(
      root.querySelectorAll('[aria-controls], [aria-describedby], [aria-labelledby]'),
    ).flatMap((element) =>
      ['aria-controls', 'aria-describedby', 'aria-labelledby'].flatMap((attribute) => {
        const ids = element.getAttribute(attribute)?.trim().split(/\s+/u).filter(Boolean) ?? [];
        return ids.filter((id) => !document.getElementById(id)).map((id) => `${attribute}:${id}`);
      }),
    );
    const ids = Array.from(root.querySelectorAll('[id]'), (element) => element.id).filter(Boolean);
    const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
    const unnamedGenericLabels = Array.from(
      root.querySelectorAll('div[aria-label], span[aria-label]'),
    )
      .filter((element) => !element.hasAttribute('role'))
      .map((element) => element.getAttribute('aria-label') ?? '');
    const liveRegionsWithControls = Array.from(
      root.querySelectorAll('[aria-live]:not([aria-live="off"]), [role="alert"], [role="status"]'),
    )
      .filter((element) => element.querySelector(interactiveSelector))
      .map((element) => element.getAttribute('role') ?? 'aria-live');
    return {
      duplicateIds: [...new Set(duplicateIds)],
      interactiveCount: interactive.length,
      liveRegionsWithControls,
      missingNames,
      missingReferences,
      unnamedGenericLabels,
    };
  });
}

async function readAxSummary(page) {
  const session = await page.context().newCDPSession(page);
  try {
    const { nodes } = await session.send('Accessibility.getFullAXTree');
    return nodes
      .filter((node) => !node.ignored)
      .map((node) => ({
        name: typeof node.name?.value === 'string' ? node.name.value : '',
        role: typeof node.role?.value === 'string' ? node.role.value : '',
      }));
  } finally {
    await session.detach();
  }
}

function assertAxNode(nodes, role, name) {
  assert(
    nodes.some(
      (node) =>
        node.role === role && (name instanceof RegExp ? name.test(node.name) : node.name === name),
    ),
    `Missing accessibility-tree node ${role} ${String(name)}.`,
  );
}

async function readContrast(page, foregroundSelector, backgroundSelector) {
  return page
    .locator(foregroundSelector)
    .first()
    .evaluate((element, selector) => {
      const background = document.querySelector(selector);
      if (!(background instanceof Element)) {
        throw new Error(`Missing contrast background: ${selector}`);
      }
      return {
        background: getComputedStyle(background).backgroundColor,
        foreground: getComputedStyle(element).color,
      };
    }, backgroundSelector);
}

function contrastRatio({ background, foreground }) {
  const luminance = (color) => {
    const channels = color
      .match(/[\d.]+/gu)
      ?.slice(0, 3)
      .map(Number);
    if (!channels || channels.length !== 3) throw new Error(`Unsupported color: ${color}`);
    const linear = channels.map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

async function readTargetSizes(page, selectors) {
  return Object.fromEntries(
    await Promise.all(
      Object.entries(selectors).map(async ([name, selector]) => {
        const size = await page
          .locator(selector)
          .first()
          .evaluate((element) => {
            const rect = element.getBoundingClientRect();
            return { height: rect.height, width: rect.width };
          });
        return [name, size];
      }),
    ),
  );
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

async function observeTransientWorkbenchErrors(page) {
  await page.addInitScript(() => {
    const errors = [];
    Reflect.set(globalThis, '__docodeTransientWorkbenchErrors', errors);
    const recordErrors = () => {
      for (const surface of document.querySelectorAll(
        '.docode-workbench__state-surface[data-docode-state="error"]',
      )) {
        const title = surface.querySelector('h2')?.textContent?.trim() ?? 'Unknown error';
        if (!errors.includes(title)) errors.push(title);
      }
    };
    const observer = new MutationObserver(recordErrors);
    observer.observe(document, {
      attributeFilter: ['data-docode-state'],
      attributes: true,
      childList: true,
      subtree: true,
    });
    document.addEventListener('DOMContentLoaded', recordErrors, { once: true });
  });
}

async function readTransientWorkbenchErrors(page) {
  return page.evaluate(() => Reflect.get(globalThis, '__docodeTransientWorkbenchErrors') ?? []);
}

async function emulateWindowsNavigator(page) {
  const session = await page.context().newCDPSession(page);
  const userAgent = await page.evaluate(() => navigator.userAgent);
  await session.send('Emulation.setUserAgentOverride', {
    platform: 'Win32',
    userAgent,
  });
  return session;
}

async function setRenderedWorkbenchPlatform(page, platform) {
  await page.locator('.docode-workbench__titlebar').evaluate((titlebar, nextPlatform) => {
    titlebar.setAttribute('data-platform', nextPlatform);
  }, platform);
}

async function verifyMacWorkbenchFullscreen(page) {
  await setRenderedWorkbenchPlatform(page, 'mac');
  const root = page.locator('[data-docode-workbench-root]');
  const fullScreenButton = page.getByRole('button', { name: 'Enter Full Screen' });
  assert.equal(await fullScreenButton.isEnabled(), true);
  assert.equal(await fullScreenButton.getAttribute('aria-pressed'), 'false');
  assert.deepEqual(
    await page.locator('.docode-workbench__traffic-light:visible').evaluateAll((lights) =>
      lights.map((light) => ({
        height: light.getBoundingClientRect().height,
        width: light.getBoundingClientRect().width,
      })),
    ),
    [
      { height: 12, width: 12 },
      { height: 12, width: 12 },
      { height: 12, width: 12 },
    ],
  );

  await fullScreenButton.click();
  const exitFullScreenButton = page.getByRole('button', { name: 'Exit Full Screen' });
  await exitFullScreenButton.waitFor();
  assert.deepEqual(
    await root.evaluate((element) => ({
      height: element.getBoundingClientRect().height,
      browserWindowMode: document.fullscreenElement === null,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
      width: element.getBoundingClientRect().width,
    })),
    await page.evaluate(() => ({
      height: window.innerHeight,
      browserWindowMode: true,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
      width: window.innerWidth,
    })),
  );
  assert.equal(await exitFullScreenButton.getAttribute('aria-pressed'), 'true');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-docode-workbench-root]').waitFor();
  const restoredExitButton = page.getByRole('button', { name: 'Exit Full Screen' });
  await restoredExitButton.waitFor();
  assert.equal(await restoredExitButton.getAttribute('aria-pressed'), 'true');
  assert.equal(await page.evaluate(() => document.fullscreenElement), null);
  await page.locator('.docode-workbench__traffic-lights').hover();
  await page.screenshot({
    path: path.join(workbenchFullscreenEvidenceDir, 'workbench-fullscreen-macos.png'),
  });
  await page.locator('.docode-workbench__traffic-lights').screenshot({
    path: path.join(workbenchFullscreenEvidenceDir, 'workbench-fullscreen-control-macos.png'),
  });
  await restoredExitButton.click();
  assert.equal(
    await page.getByRole('button', { name: 'Enter Full Screen' }).getAttribute('aria-pressed'),
    'false',
  );
}

async function verifyWindowsWorkbenchFullscreen(page) {
  const enterButton = page.getByRole('button', { name: 'Enter Full Screen' });
  await enterButton.waitFor();
  assert.equal(await enterButton.isEnabled(), true);
  assert.equal(await enterButton.getAttribute('aria-pressed'), 'false');
  assert.equal(await enterButton.locator('.codicon-chrome-maximize').count(), 1);
  await enterButton.click();
  const exitButton = page.getByRole('button', { name: 'Exit Full Screen' });
  await exitButton.waitFor();
  assert.equal(await exitButton.getAttribute('aria-pressed'), 'true');
  assert.equal(await exitButton.locator('.codicon-chrome-restore').count(), 1);
  assert.equal(await exitButton.locator('.codicon-chrome-maximize').count(), 0);
  assert.equal(await page.evaluate(() => document.fullscreenElement), null);
  await page.locator('.docode-workbench__window-controls').screenshot({
    path: path.join(workbenchFullscreenEvidenceDir, 'workbench-fullscreen-control-windows.png'),
  });
  await exitButton.click();
  const restoredEnterButton = page.getByRole('button', { name: 'Enter Full Screen' });
  await restoredEnterButton.waitFor();
  assert.equal(await restoredEnterButton.getAttribute('aria-pressed'), 'false');
}

async function readMacTrafficLightGlyphs(page) {
  return page.locator('.docode-workbench__traffic-lights').evaluate((lights) => {
    const glyphs = Array.from(lights.querySelectorAll('.docode-workbench__traffic-light-glyph'));
    return {
      glyphs: glyphs.map((glyph) => glyph.getAttribute('data-glyph')),
      opacities: glyphs.map((glyph) => Number.parseFloat(getComputedStyle(glyph).opacity)),
    };
  });
}

async function assertWorkbenchState(page, state, title) {
  const surface = page.locator(`.docode-workbench__state-surface[data-docode-state="${state}"]`);
  await surface.waitFor();
  assert.equal(await surface.getByRole('heading', { name: title }).textContent(), title);
}

async function assertWorkbenchLoading(page, title) {
  const root = page.locator('[data-docode-workbench-root]');
  const progress = root.getByRole('progressbar', { name: title });
  await progress.waitFor();
  assert.equal(await root.locator('.docode-workbench__state-surface').count(), 0);
  const geometry = await root.evaluate((workbenchRoot) => {
    const editor = workbenchRoot.querySelector('.docode-workbench__editor');
    const titleBar = workbenchRoot.querySelector('.docode-workbench__editor-title');
    const progressBar = workbenchRoot.querySelector('.docode-workbench__editor-progress');
    const progressBit = workbenchRoot.querySelector('.docode-workbench__editor-progress-bit');
    if (
      !(editor instanceof HTMLElement) ||
      !(titleBar instanceof HTMLElement) ||
      !(progressBar instanceof HTMLElement) ||
      !(progressBit instanceof HTMLElement)
    ) {
      throw new Error('Missing workbench loading progress geometry.');
    }
    const editorRect = editor.getBoundingClientRect();
    const titleRect = titleBar.getBoundingClientRect();
    const progressRect = progressBar.getBoundingClientRect();
    const progressBitStyle = getComputedStyle(progressBit);
    return {
      animationDuration: progressBitStyle.animationDuration,
      animationName: progressBitStyle.animationName,
      background: progressBitStyle.backgroundColor,
      editorTop: editorRect.top,
      progressHeight: progressRect.height,
      progressTop: progressRect.top,
      progressWidth: progressRect.width,
      progressBitWidth: Number.parseFloat(progressBitStyle.width),
      resolvedTheme: workbenchRoot.classList.contains('docode-theme-light-modern')
        ? 'light'
        : 'dark',
      titleHeight: titleRect.height,
    };
  });
  assert.equal(geometry.progressHeight, 2);
  assert.equal(geometry.titleHeight, 35);
  assert.equal(geometry.progressTop - geometry.editorTop, 33);
  assert(Math.abs(geometry.progressBitWidth - geometry.progressWidth * 0.02) < 0.1);
  assert.equal(
    geometry.background,
    geometry.resolvedTheme === 'light' ? 'rgb(0, 95, 184)' : 'rgb(0, 120, 212)',
  );
  assert.equal(geometry.animationName, 'docode-workbench-progress');
  assert.equal(geometry.animationDuration, '4s');
}

async function readWorkbenchGeometry(page) {
  return page.locator('[data-docode-workbench-root]').evaluate((root) => {
    const readRect = (selector) => {
      const element = root.querySelector(selector);
      if (!(element instanceof HTMLElement)) throw new Error(`Missing shell element: ${selector}`);
      return element.getBoundingClientRect();
    };
    const rootRect = root.getBoundingClientRect();
    const editorRect = readRect('.docode-workbench__editor');
    const gutterRect = readRect('.docode-workbench__gutter');
    const minimap = root.querySelector('.docode-workbench__minimap');
    if (!(minimap instanceof HTMLElement)) throw new Error('Missing minimap slot.');
    const minimapRect = minimap.getBoundingClientRect();
    const panelRect = readRect('.docode-workbench__panel');
    const sashRect = readRect('.docode-workbench__sash');
    const statusBarRect = readRect('.docode-workbench__statusbar');
    return {
      editorHeight: editorRect.height,
      gutterWidth: gutterRect.width,
      height: rootRect.height,
      minimapVisible: getComputedStyle(minimap).display !== 'none',
      minimapWidth: minimapRect.width,
      panelHeight: panelRect.height,
      sashHeight: sashRect.height,
      statusBarHeight: statusBarRect.height,
      width: rootRect.width,
    };
  });
}

async function readFullWorkbenchChrome(page, editorLineSelector) {
  return page.locator('[data-docode-workbench-root]').evaluate((root, lineSelector) => {
    const readRect = (selector) => {
      const element = root.querySelector(selector);
      if (!(element instanceof HTMLElement)) {
        throw new Error(`Missing full workbench element: ${selector}`);
      }
      return element.getBoundingClientRect();
    };
    return {
      activityBarWidth: readRect('.docode-workbench__activitybar').width,
      breadcrumbsHeight: readRect('.docode-workbench__breadcrumbs').height,
      commandCenterHeight: readRect('.docode-workbench__command-center').height,
      editorLineHeight: readRect(lineSelector).height,
      explorerRouteCount: root.querySelectorAll(
        '.docode-workbench__explorer-list[aria-label="Linux DO list routes"] [role="treeitem"]',
      ).length,
      sidebarWidth: readRect('.docode-workbench__sidebar').width,
      statusBarHeight: readRect('.docode-workbench__statusbar').height,
      titleBarHeight: readRect('.docode-workbench__titlebar').height,
    };
  }, editorLineSelector);
}

async function readWorkbenchReferenceChrome(page) {
  return page.locator('[data-docode-workbench-root]').evaluate((root) => {
    const readElement = (selector) => {
      const element = root.querySelector(selector);
      if (!(element instanceof HTMLElement)) {
        throw new Error(`Missing reference chrome element: ${selector}`);
      }
      return element;
    };
    const editorActions = Array.from(
      root.querySelectorAll(
        '.docode-workbench__editor-title > .docode-workbench__quick-open-trigger',
      ),
    ).filter((element) => element instanceof HTMLElement);
    return {
      activityBarBackground: getComputedStyle(readElement('.docode-workbench__activitybar'))
        .backgroundColor,
      editorActionCount: editorActions.length,
      editorActionIcons: editorActions.map(
        (element) => element.firstElementChild?.classList[1] ?? '',
      ),
      editorActionText: editorActions.map((element) => element.textContent ?? ''),
      editorActionWidths: editorActions.map((element) => element.getBoundingClientRect().width),
      editorBackground: getComputedStyle(readElement('.docode-workbench__editor')).backgroundColor,
      explorerTitle: readElement('.docode-workbench__sidebar-title h2').textContent?.trim() ?? '',
      panelBackground: getComputedStyle(readElement('.docode-workbench__panel')).backgroundColor,
      sidebarBackground: getComputedStyle(readElement('.docode-workbench__sidebar'))
        .backgroundColor,
      tabStripBackground: getComputedStyle(readElement('.docode-workbench__tabs')).backgroundColor,
      titleBarBackground: getComputedStyle(readElement('.docode-workbench__titlebar'))
        .backgroundColor,
    };
  });
}

async function readElementWidth(page, selector) {
  return page.locator(selector).evaluate((element) => element.getBoundingClientRect().width);
}

async function readPlatformChrome(page) {
  return page.locator('[data-docode-workbench-root]').evaluate((root) => {
    const visibleElements = (selector) =>
      Array.from(root.querySelectorAll(selector)).filter((element) => {
        const rect = element.getBoundingClientRect();
        return getComputedStyle(element).display !== 'none' && rect.width > 0 && rect.height > 0;
      });
    const titlebar = root.querySelector('.docode-workbench__titlebar');
    const activitybar = root.querySelector('.docode-workbench__activitybar');
    const extensionIcon = root.querySelector('.codicon-extensions');
    const searchIcon = root.querySelector('.codicon-search');
    const firstAction = root.querySelector('.docode-workbench__activity-action');
    const gutter = root.querySelector('.docode-topic-list__gutter');
    const layoutControlGroup = root.querySelector('.docode-workbench__layout-controls');
    const layoutControls = Array.from(
      root.querySelectorAll('.docode-workbench__layout-controls > button'),
    );
    const layoutIcons = layoutControls.map((control) => control.querySelector('.codicon'));
    const secondarySidebarControl = root.querySelector(
      'button[aria-label="Secondary Side Bar unavailable"]',
    );
    if (
      !(titlebar instanceof HTMLElement) ||
      !(activitybar instanceof HTMLElement) ||
      !(extensionIcon instanceof HTMLElement) ||
      !(searchIcon instanceof HTMLElement) ||
      !(firstAction instanceof HTMLElement) ||
      !(gutter instanceof HTMLElement) ||
      !(layoutControlGroup instanceof HTMLElement) ||
      !(layoutControls[0] instanceof HTMLButtonElement) ||
      !(secondarySidebarControl instanceof HTMLButtonElement) ||
      layoutIcons.some((icon) => !(icon instanceof HTMLElement))
    ) {
      throw new Error('Missing rendered platform workbench chrome.');
    }
    const groups = root.querySelectorAll('.docode-workbench__activity-group');
    return {
      activityActionHeight: firstAction.getBoundingClientRect().height,
      activityBarWidth: activitybar.getBoundingClientRect().width,
      bottomActionCount: groups.item(1).querySelectorAll('.docode-workbench__activity-action')
        .length,
      extensionIconPainted: !['none', 'normal', '""'].includes(
        getComputedStyle(extensionIcon, '::before').content,
      ),
      firstLineNumber:
        root.querySelector('.docode-topic-list__line-number')?.textContent?.trim() ?? '',
      gutterWidth: gutter.getBoundingClientRect().width,
      layoutControlCount: layoutControls.length,
      layoutControlGap: Number.parseFloat(getComputedStyle(layoutControlGroup).columnGap),
      layoutControlGroupWidth: layoutControlGroup.getBoundingClientRect().width,
      layoutControlHeight: layoutControls[0].getBoundingClientRect().height,
      layoutControlIconClasses: layoutIcons.map(
        (icon) =>
          Array.from(icon.classList).find(
            (className) =>
              className.startsWith('codicon-') && className !== 'codicon-modifier-spin',
          ) ?? '',
      ),
      layoutControlIconsPainted: layoutIcons.every(
        (icon) => !['none', 'normal', '""'].includes(getComputedStyle(icon, '::before').content),
      ),
      layoutControlWidth: layoutControls[0].getBoundingClientRect().width,
      layoutDividerCount: root.querySelectorAll('.docode-workbench__titlebar-divider').length,
      menuLabels: Array.from(
        visibleElements('.docode-workbench__menubar-item'),
        (item) => item.textContent?.trim() ?? '',
      ),
      platform: titlebar.getAttribute('data-platform'),
      searchIconPainted: !['none', 'normal', '""'].includes(
        getComputedStyle(searchIcon, '::before').content,
      ),
      secondarySidebarDisabled: secondarySidebarControl.disabled,
      syncBadgeCount: root.querySelectorAll('.docode-workbench__activity-badge[data-tone="sync"]')
        .length,
      topActionCount: groups.item(0).querySelectorAll('.docode-workbench__activity-action').length,
      trafficLightCount: visibleElements('.docode-workbench__traffic-light').length,
      trafficLightInteractiveCount: visibleElements('.docode-workbench__traffic-lights button')
        .length,
      warningBadgeCount: root.querySelectorAll(
        '.docode-workbench__activity-badge[data-tone="warning"]',
      ).length,
      windowControlCount: visibleElements('.docode-workbench__window-control').length,
      windowControlInteractiveCount: root.querySelectorAll(
        '.docode-workbench__window-controls button, .docode-workbench__window-controls a',
      ).length,
    };
  });
}

async function readWindowsControlFidelity(page) {
  return page.locator('[data-docode-workbench-root]').evaluate((root) => {
    const titlebar = root.querySelector('.docode-workbench__titlebar');
    const container = root.querySelector('.docode-workbench__window-controls');
    const controls = Array.from(root.querySelectorAll('.docode-workbench__window-control'));
    if (
      !(titlebar instanceof HTMLElement) ||
      !(container instanceof HTMLElement) ||
      controls.length !== 3 ||
      controls.some((control) => !(control instanceof HTMLElement))
    ) {
      throw new Error('Missing rendered Windows title-bar controls.');
    }
    const titlebarRect = titlebar.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    return {
      containerHeight: containerRect.height,
      containerWidth: containerRect.width,
      controlHeights: controls.map((control) => control.getBoundingClientRect().height),
      controlWidths: controls.map((control) => control.getBoundingClientRect().width),
      iconClasses: controls.map(
        (control) =>
          Array.from(control.firstElementChild?.classList ?? []).find((className) =>
            className.startsWith('codicon-chrome-'),
          ) ?? '',
      ),
      iconSizes: controls.map((control) =>
        Number.parseFloat(getComputedStyle(control).getPropertyValue('--docode-icon-size')),
      ),
      rightGap: Math.round(titlebarRect.right - containerRect.right),
    };
  });
}

async function readTitlebarFidelity(page) {
  return page.locator('[data-docode-workbench-root]').evaluate((root) => {
    const titlebar = root.querySelector('.docode-workbench__titlebar');
    const left = root.querySelector('.docode-workbench__titlebar-left');
    const center = root.querySelector('.docode-workbench__titlebar-center');
    const right = root.querySelector('.docode-workbench__titlebar-right');
    const commandCenter = root.querySelector('.docode-workbench__command-center');
    const back = root.querySelector('button[aria-label="Go Back"]');
    const forward = root.querySelector('button[aria-label="Go Forward"]');
    const trafficLights = root.querySelector('.docode-workbench__traffic-lights');
    if (
      !(titlebar instanceof HTMLElement) ||
      !(left instanceof HTMLElement) ||
      !(center instanceof HTMLElement) ||
      !(right instanceof HTMLElement) ||
      !(commandCenter instanceof HTMLButtonElement) ||
      !(back instanceof HTMLButtonElement) ||
      !(forward instanceof HTMLButtonElement)
    ) {
      throw new Error('Missing rendered title-bar fidelity surface.');
    }
    const commandCenterRect = commandCenter.getBoundingClientRect();
    const forwardRect = forward.getBoundingClientRect();
    return {
      backInCenter: center.contains(back),
      commandCenterHeight: commandCenterRect.height,
      commandCenterLabel: commandCenter.textContent?.trim() ?? '',
      commandCenterSearchIconCount: commandCenter.querySelectorAll('.codicon-search').length,
      commandCenterWidth: commandCenterRect.width,
      centerDisplay: getComputedStyle(center).display,
      centerFlexGrow: getComputedStyle(center).flexGrow,
      forwardCommandGap: Math.round(commandCenterRect.left - forwardRect.right),
      forwardInCenter: center.contains(forward),
      leftFlexGrow: getComputedStyle(left).flexGrow,
      rightFlexGrow: getComputedStyle(right).flexGrow,
      titlebarBackground: getComputedStyle(titlebar).backgroundColor,
      titlebarDisplay: getComputedStyle(titlebar).display,
      trafficLightsInLeft: trafficLights instanceof HTMLElement && left.contains(trafficLights),
    };
  });
}

async function readLayoutMenu(page) {
  return page.getByRole('menu', { name: 'Customize Layout' }).evaluate((menu) => {
    const primarySidebar = menu.querySelector('[role="menuitemcheckbox"]');
    const panel = menu.querySelectorAll('[role="menuitemcheckbox"]').item(1);
    const secondarySidebar = Array.from(menu.querySelectorAll('[role="menuitem"]')).find((item) =>
      item.textContent?.includes('Secondary Side Bar'),
    );
    if (
      !(primarySidebar instanceof HTMLButtonElement) ||
      !(panel instanceof HTMLButtonElement) ||
      !(secondarySidebar instanceof HTMLButtonElement)
    ) {
      throw new Error('Missing rendered title-bar layout menu actions.');
    }
    return {
      menuItemLabels: Array.from(
        menu.querySelectorAll('[role="menuitem"], [role="menuitemcheckbox"]'),
        (item) => item.textContent?.trim() ?? '',
      ),
      panelChecked: panel.getAttribute('aria-checked'),
      primarySidebarChecked: primarySidebar.getAttribute('aria-checked'),
      secondarySidebarDisabled: secondarySidebar.disabled,
    };
  });
}

async function readWorkbenchChrome(page) {
  return page.locator('[data-docode-workbench-root]').evaluate((root) => {
    const shell = root.querySelector('.docode-workbench');
    const tabContainer = root.querySelector('.docode-workbench__tab[data-active="true"]');
    const tab = tabContainer?.querySelector('[role="tab"]');
    const panelTab = root.querySelector('.docode-workbench__panel-tab[aria-selected="true"]');
    const statusLabel = root.querySelector(
      '.docode-workbench__status-items--left .docode-workbench__status-item span:last-child',
    );
    if (
      !(shell instanceof HTMLElement) ||
      !(tabContainer instanceof HTMLElement) ||
      !(tab instanceof HTMLAnchorElement) ||
      !(panelTab instanceof HTMLButtonElement) ||
      !(statusLabel instanceof HTMLElement)
    ) {
      throw new Error('Missing workbench chrome.');
    }
    return {
      panelTabDisabled: panelTab.disabled,
      panelTabHeight: panelTab.getBoundingClientRect().height,
      panelTabLabel: panelTab.textContent?.trim() ?? '',
      routeGeneration: shell.getAttribute('data-route-generation'),
      statusLabel: statusLabel.textContent?.trim() ?? '',
      tabDisabled: tab.getAttribute('aria-disabled') === 'true',
      tabHeight: tabContainer.getBoundingClientRect().height,
      tabLabel: tab.querySelector('.docode-workbench__tab-label')?.textContent?.trim() ?? '',
      tabSelected: tab.getAttribute('aria-selected'),
      windowActive: tabContainer.getAttribute('data-window-active'),
    };
  });
}

async function readNativeComposer(page) {
  return page.locator('[data-docode-workbench-root]').evaluate((root) => {
    const surface = root.querySelector('.docode-native-composer');
    const label = root.querySelector('.docode-native-composer__label');
    const editor = root.querySelector('#reply-control .d-editor-input');
    if (
      !(surface instanceof HTMLElement) ||
      !(label instanceof HTMLElement) ||
      !(editor instanceof HTMLTextAreaElement)
    ) {
      throw new Error('Missing rendered native Linux DO composer.');
    }
    return {
      dirty: surface.getAttribute('data-dirty'),
      editorUsesWorkbenchUiFont: getComputedStyle(editor)
        .fontFamily.toLowerCase()
        .includes('segoe ui'),
      exactNativeRootCount: root.querySelectorAll('.docode-native-composer__host > #reply-control')
        .length,
      nativeRootInSource: Boolean(
        document.querySelector('#native-composer-source > #reply-control'),
      ),
      state: surface.getAttribute('data-state'),
      title: label.textContent?.trim() ?? '',
    };
  });
}

async function readQuickOpen(page) {
  return page.locator('[data-docode-workbench-root]').evaluate((root) => {
    const dialog = root.querySelector('.docode-quick-open');
    const count = root.querySelector('.docode-quick-open__count');
    const input = root.querySelector('.docode-quick-open__input');
    const prefix = root.querySelector('.docode-quick-open__prefix');
    const firstItem = root.querySelector('.docode-quick-open__item');
    const selected = root.querySelector('.docode-quick-open__item[data-selected="true"]');
    const description = root.querySelector('.docode-quick-open__item-description');
    if (
      !(dialog instanceof HTMLElement) ||
      !(count instanceof HTMLElement) ||
      !(input instanceof HTMLInputElement) ||
      !(firstItem instanceof HTMLButtonElement) ||
      !(selected instanceof HTMLButtonElement) ||
      !(description instanceof HTMLElement)
    ) {
      throw new Error('Missing rendered Quick Open surface.');
    }
    const dialogRect = dialog.getBoundingClientRect();
    const countRect = count.getBoundingClientRect();
    const inputRect = input.getBoundingClientRect();
    const itemRect = firstItem.getBoundingClientRect();
    const prefixRect = prefix?.getBoundingClientRect() ?? null;
    const selectedStyle = getComputedStyle(selected);
    return {
      background: getComputedStyle(dialog).backgroundColor,
      closeButtonCount: root.querySelectorAll('.docode-quick-open__close').length,
      countText: count.textContent?.trim() ?? '',
      countVisuallyHidden:
        getComputedStyle(count).position === 'absolute' &&
        countRect.width <= 1 &&
        countRect.height <= 1,
      descriptionDisplay: getComputedStyle(description).display,
      groupLabels: Array.from(root.querySelectorAll('.docode-quick-open__group-label')).map(
        (label) => label.textContent?.trim() ?? '',
      ),
      inputBackground: getComputedStyle(input).backgroundColor,
      inputFocused: input === document.activeElement,
      inputLeftInset: Math.round(inputRect.left - dialogRect.left),
      inputRightInset: Math.round(dialogRect.right - inputRect.right),
      itemLeftInset: Math.round(itemRect.left - dialogRect.left),
      itemRightInset: Math.round(dialogRect.right - itemRect.right),
      optionCount: root.querySelectorAll('.docode-quick-open__item').length,
      prefixInsideInput:
        prefixRect === null ||
        (prefixRect.left >= inputRect.left &&
          prefixRect.right <= inputRect.right &&
          prefixRect.top >= inputRect.top &&
          prefixRect.bottom <= inputRect.bottom),
      rowHeight: firstItem.getBoundingClientRect().height,
      selectedBackground: selectedStyle.backgroundColor,
      selectedOutlineStyle: selectedStyle.outlineStyle,
      selectedLabel:
        selected.querySelector('.docode-quick-open__item-label')?.textContent?.trim() ?? '',
      top: dialogRect.top,
      width: dialogRect.width,
    };
  });
}

async function readCommandCenterUnderlay(page) {
  return page.locator('[data-docode-workbench-root]').evaluate((root) => {
    const commandCenter = root.querySelector('.docode-workbench__command-center');
    if (!(commandCenter instanceof HTMLButtonElement)) {
      throw new Error('Missing rendered Command Center.');
    }
    const style = getComputedStyle(commandCenter);
    return {
      ariaHidden: commandCenter.getAttribute('aria-hidden'),
      isConnected: commandCenter.isConnected,
      pointerEvents: style.pointerEvents,
      tabIndex: commandCenter.tabIndex,
      visibility: style.visibility,
    };
  });
}

async function readTerminalView(page) {
  return page.locator('[data-docode-workbench-root]').evaluate((root) => {
    const terminal = root.querySelector('.docode-terminal');
    const viewport = root.querySelector('.docode-terminal__viewport');
    const prompt = root.querySelector('.docode-terminal__prompt > .docode-terminal__prompt-label');
    const input = root.querySelector('.docode-terminal__input');
    const activeTab = root.querySelector('.docode-workbench__panel-tab[aria-selected="true"]');
    const inactiveTab = root.querySelector('[data-panel-view-id="problems"]');
    const panel = root.querySelector('.docode-workbench__panel');
    const sash = root.querySelector('.docode-workbench__sash');
    const session = root.querySelector('.docode-workbench__terminal-session > span:last-child');
    const outputEntry = root.querySelector('.docode-terminal__entry:last-child');
    if (
      !(terminal instanceof HTMLElement) ||
      !(viewport instanceof HTMLElement) ||
      !(prompt instanceof HTMLElement) ||
      !(input instanceof HTMLInputElement) ||
      !(activeTab instanceof HTMLButtonElement) ||
      !(inactiveTab instanceof HTMLButtonElement) ||
      !(panel instanceof HTMLElement) ||
      !(sash instanceof HTMLElement) ||
      !(session instanceof HTMLElement) ||
      !(outputEntry instanceof HTMLElement)
    ) {
      throw new Error('Missing terminal panel surface.');
    }
    const terminalStyle = getComputedStyle(terminal);
    const panelStyle = getComputedStyle(panel);
    return {
      actionLabels: Array.from(
        root.querySelectorAll('.docode-workbench__panel-actions button[aria-label]'),
        (button) => button.getAttribute('aria-label') ?? '',
      ),
      activeBorder: getComputedStyle(activeTab, '::after').backgroundColor,
      activeForeground: getComputedStyle(activeTab).color,
      background: terminalStyle.backgroundColor,
      fontSize: terminalStyle.fontSize,
      idleSashBackground: getComputedStyle(sash, '::before').backgroundColor,
      inactiveForeground: getComputedStyle(inactiveTab).color,
      inputFocused: input === document.activeElement,
      lineHeight: terminalStyle.lineHeight,
      outputState: outputEntry.getAttribute('data-state'),
      panelBorderTopColor: panelStyle.borderTopColor,
      panelBorderTopWidth: panelStyle.borderTopWidth,
      panelTabLabels: Array.from(
        root.querySelectorAll('.docode-workbench__panel-tab'),
        (tab) => tab.textContent?.trim() ?? '',
      ),
      prompt: prompt.textContent?.trim() ?? '',
      sashHeight: sash.getBoundingClientRect().height,
      sessionLabel: session.textContent?.trim() ?? '',
      unavailablePanelTabs: Array.from(
        root.querySelectorAll('.docode-workbench__panel-tab:disabled'),
        (tab) => tab.textContent?.trim() ?? '',
      ),
      unsafeElementCount: terminal.querySelectorAll('img, iframe, object, script').length,
      viewportPaddingLeft: getComputedStyle(viewport).paddingLeft,
    };
  });
}

async function readTerminalTopAlignment(page) {
  return page.locator('[data-docode-workbench-root]').evaluate((root) => {
    const terminal = root.querySelector('.docode-terminal');
    const prompt = root.querySelector('.docode-terminal__prompt');
    if (!(terminal instanceof HTMLElement) || !(prompt instanceof HTMLElement)) {
      throw new Error('Missing terminal alignment surface.');
    }
    const terminalRect = terminal.getBoundingClientRect();
    const promptRect = prompt.getBoundingClientRect();
    const input = prompt.querySelector('.docode-terminal__input');
    const marker = prompt.querySelector('.docode-terminal__command-marker');
    const promptLabel = prompt.querySelector('.docode-terminal__prompt-label');
    if (
      !(input instanceof HTMLInputElement) ||
      !(marker instanceof HTMLElement) ||
      !(promptLabel instanceof HTMLElement)
    ) {
      throw new Error('Missing terminal prompt input geometry.');
    }
    const inputRect = input.getBoundingClientRect();
    const inputStyle = getComputedStyle(input);
    const promptLabelStyle = getComputedStyle(promptLabel);
    const submittedCommand = terminal.querySelector('.docode-terminal__command-line');
    const submittedEntry = submittedCommand?.closest('.docode-terminal__entry');
    const submittedPromptLabel = submittedCommand?.querySelector('.docode-terminal__prompt-label');
    const submittedInput = submittedPromptLabel?.nextElementSibling;
    if (
      !(submittedEntry instanceof HTMLElement) ||
      !(submittedPromptLabel instanceof HTMLElement) ||
      !(submittedInput instanceof HTMLElement)
    ) {
      throw new Error('Missing submitted terminal prompt geometry.');
    }
    return {
      commandMarkerWidth: marker.getBoundingClientRect().width,
      inputBorderRadius: inputStyle.borderTopLeftRadius,
      inputBorderWidth: inputStyle.borderTopWidth,
      inputBoxShadow: inputStyle.boxShadow,
      inputLeft: inputRect.left,
      inputWidth: inputRect.width,
      promptMarginInlineEnd: Number.parseFloat(promptLabelStyle.marginInlineEnd),
      promptLabelRight: promptLabel.getBoundingClientRect().right,
      promptTopOffset: promptRect.top - terminalRect.top,
      submittedEntryBottomOffset: submittedEntry.getBoundingClientRect().bottom - terminalRect.top,
      submittedInputLeft: submittedInput.getBoundingClientRect().left,
      submittedPromptLabelRight: submittedPromptLabel.getBoundingClientRect().right,
      submittedPromptMarginInlineEnd: Number.parseFloat(
        getComputedStyle(submittedPromptLabel).marginInlineEnd,
      ),
      welcomeCount: terminal.querySelectorAll('.docode-terminal__welcome').length,
    };
  });
}

async function readRenderedContentLineCoverage(page) {
  return page.locator('[data-docode-workbench-root]').evaluate((root) => {
    const elements = Array.from(
      root.querySelectorAll('.docode-topic-code__content-slot > .cooked [data-docode-editor-line]'),
    ).filter((element) => element instanceof HTMLElement);
    const renderedElements = Array.from(
      root.querySelectorAll('.docode-topic-code__line-number[data-docode-line-number]'),
    ).filter((element) => element instanceof HTMLElement);
    const renderedNumbers = renderedElements.map((element) => element.textContent ?? '');
    const expectedLines = elements.flatMap((element) => {
      const firstLine = Number(element.getAttribute('data-docode-editor-line'));
      const count = Math.max(1, Number(element.getAttribute('data-docode-editor-line-count') ?? 1));
      return Array.from({ length: count }, (_, offset) => ({
        element,
        number: String(firstLine + offset),
        offset,
      }));
    });
    const expectedNumbers = expectedLines.map(({ number }) => number);
    const structuralElements = Array.from(
      root.querySelectorAll('[data-docode-editor-line]'),
    ).filter((element) => element instanceof HTMLElement && element.closest('.cooked') === null);
    const structuralNumbers = structuralElements
      .map((element) => getComputedStyle(element, '::before').content)
      .map((content) => content.replace(/^['"]|['"]$/gu, ''));
    const gutterNumbers = [
      root.querySelector('.docode-topic-code__topic-gutter')?.textContent?.trim() ?? '',
      ...Array.from(
        root.querySelectorAll('.docode-topic-code__floor'),
        (element) => element.textContent?.trim() ?? '',
      ),
    ];
    const documentNumbers = [...gutterNumbers, ...structuralNumbers, ...renderedNumbers]
      .map(Number)
      .filter(Number.isFinite)
      .sort((left, right) => left - right);
    const topicClose = Number(
      root
        .querySelector('.docode-topic-code__topic-close')
        ?.getAttribute('data-docode-editor-line') ?? '0',
    );
    const expectedDocumentNumbers = Array.from({ length: topicClose }, (_, index) => index + 1);
    const lineHeight = Number.parseFloat(
      getComputedStyle(root.querySelector('.docode-topic-code__surface') ?? root).getPropertyValue(
        '--docode-topic-line-height',
      ),
    );
    return {
      decoratedCount: elements.length,
      expectedNumbers,
      missingNumbers: expectedNumbers.filter((number) => !renderedNumbers.includes(number)),
      renderedNumbers,
      misalignedNumbers: expectedLines.flatMap(({ element, number: value, offset }, index) => {
        const number = renderedElements[index];
        if (!number) return [value];
        const expectedTop = element.getBoundingClientRect().top + offset * lineHeight;
        return Math.abs(expectedTop - number.getBoundingClientRect().top) <= 1 ? [] : [value];
      }),
      missingDocumentNumbers: expectedDocumentNumbers.filter(
        (number) => !documentNumbers.includes(number),
      ),
      duplicateDocumentNumbers: documentNumbers.filter(
        (number, index) => documentNumbers.indexOf(number) !== index,
      ),
      mispositionedStructuralNumbers: structuralElements
        .filter(
          (element) =>
            !element.classList.contains('docode-topic-code__topic-close') &&
            getComputedStyle(element).position !== 'relative',
        )
        .map((element) => element.getAttribute('data-docode-editor-line') ?? ''),
      rhythmMismatches: elements.slice(1).flatMap((element, index) => {
        const previous = elements[index];
        if (!previous || !Number.isFinite(lineHeight)) return ['invalid-line-height'];
        const previousNumber = Number(previous.getAttribute('data-docode-editor-line'));
        const number = Number(element.getAttribute('data-docode-editor-line'));
        const expectedDelta = (number - previousNumber) * lineHeight;
        const actualDelta =
          element.getBoundingClientRect().top - previous.getBoundingClientRect().top;
        return Math.abs(expectedDelta - actualDelta) <= 1
          ? []
          : [`${String(previousNumber)}-${String(number)}`];
      }),
    };
  });
}

async function readTerminalCompletionPromptState(page) {
  return page.locator('[data-docode-workbench-root]').evaluate((root) => {
    const input = root.querySelector('.docode-terminal__input');
    if (!(input instanceof HTMLInputElement)) throw new Error('Missing terminal input.');
    return {
      inputExpanded: input.getAttribute('aria-expanded'),
      optionCount: root.querySelectorAll('.docode-terminal__suggestion').length,
    };
  });
}

async function readOpenViewTabs(page) {
  return page.locator('[data-docode-workbench-root]').evaluate((root) =>
    Array.from(root.querySelectorAll('.docode-workbench__tabs .docode-workbench__tab')).map(
      (container) => {
        const tab = container.querySelector('[role="tab"]');
        if (!(tab instanceof HTMLAnchorElement)) throw new Error('Missing route-backed tab link.');
        return {
          active: container.getAttribute('data-active') === 'true',
          dirty: container.getAttribute('data-dirty') === 'true',
          href: tab.href,
          label: tab.querySelector('.docode-workbench__tab-label')?.textContent?.trim() ?? '',
          readState: container.getAttribute('data-read-state'),
        };
      },
    ),
  );
}

async function readTabFidelity(page) {
  return page.locator('[data-docode-workbench-root]').evaluate((root) =>
    Array.from(root.querySelectorAll('.docode-workbench__tabs .docode-workbench__tab')).map(
      (container) => {
        const tab = container.querySelector('[role="tab"]');
        const close = container.querySelector('.docode-workbench__tab-close');
        if (!(tab instanceof HTMLAnchorElement) || !(close instanceof HTMLElement)) {
          throw new Error('Missing route-backed tab fidelity elements.');
        }
        return {
          active: container.getAttribute('data-active') === 'true',
          closeOpacity: getComputedStyle(close).opacity,
          label: tab.querySelector('.docode-workbench__tab-label')?.textContent?.trim() ?? '',
          width: container.getBoundingClientRect().width,
        };
      },
    ),
  );
}

async function installSyntheticTabNavigation(page) {
  await page.evaluate(() => {
    document.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest(
        '[data-docode-workbench-root] a[role="tab"], [data-docode-workbench-root] a.docode-workbench__tab-close, [data-docode-workbench-root] .docode-workbench__tab-menu a[role="menuitem"], [data-docode-workbench-root] .docode-topic-list__metadata-link, [data-docode-workbench-root] .docode-topic-outline__item, [data-docode-workbench-root] .docode-topic-minimap__mark, [data-docode-workbench-root] [data-docode-command-navigation]',
      );
      if (!(anchor instanceof HTMLAnchorElement)) return;
      event.preventDefault();
      const override = globalThis.__docodeCommandNavigationOverride;
      if (anchor.dataset.docodeCommandNavigation && typeof override === 'string') {
        globalThis.__docodeCommandNavigationOverride = undefined;
        window.history.pushState({}, '', override);
      } else {
        window.history.pushState({}, '', anchor.href);
      }
    });
  });
}

async function captureNextCommandNavigation(page) {
  await page.evaluate(() => {
    const capture = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('[data-docode-command-navigation]');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      globalThis.__docodeCapturedCommandNavigation = anchor.href;
      document.removeEventListener('click', capture, true);
    };
    document.addEventListener('click', capture, true);
  });
}

async function releaseCapturedCommandNavigation(page) {
  await page.evaluate(() => {
    const href = globalThis.__docodeCapturedCommandNavigation;
    if (typeof href !== 'string') throw new Error('No command navigation was captured.');
    globalThis.__docodeCapturedCommandNavigation = undefined;
    window.history.pushState({}, '', href);
  });
}

async function dispatchKeyboardProbe(page, selector, code, init) {
  return page.locator(selector).evaluate(
    (target, options) => {
      const event = new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        code: options.code,
        ...options.init,
      });
      target.dispatchEvent(event);
      return event.defaultPrevented;
    },
    { code, init },
  );
}

async function runTerminalCommand(page, input, expectedText) {
  await waitForUiStability(page);
  const prompt = page.getByRole('combobox', { name: 'Linux DO command input' });
  const expectedOutput = page.getByText(expectedText, { exact: true });
  const previousMatchCount = await expectedOutput.count();
  await prompt.waitFor({ state: 'visible' });
  await prompt.fill(input);
  assert.equal(await prompt.inputValue(), input);
  await prompt.press('Enter');
  try {
    await expectedOutput.nth(previousMatchCount).waitFor();
  } catch (error) {
    const terminalText = await page
      .locator('.docode-terminal')
      .innerText()
      .catch(() => '<terminal unavailable>');
    throw new Error(
      `Terminal command ${JSON.stringify(input)} did not render ${JSON.stringify(expectedText)}. ` +
        `Actual terminal output:\n${terminalText}`,
      { cause: error },
    );
  }
}

async function waitForUiStability(page) {
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      }),
  );
}

async function waitForActiveOpenView(page, label, count) {
  await page.waitForFunction(
    ({ expectedCount, expectedLabel }) =>
      document.querySelectorAll('.docode-workbench__tabs [role="tab"]').length === expectedCount &&
      document
        .querySelector('.docode-workbench__tab[data-active="true"] .docode-workbench__tab-label')
        ?.textContent?.trim() === expectedLabel,
    { expectedCount: count, expectedLabel: label },
  );
}

async function readNavigationPosition(page) {
  const tabs = await readOpenViewTabs(page);
  const active = tabs.find(({ active }) => active);
  assert(active, 'Expected one active route-backed tab.');
  const shell = page.locator('.docode-workbench');
  return {
    activeLabel: active.label,
    addressHref: page.url(),
    generation: await shell.getAttribute('data-route-generation'),
    href: active.href,
    source: await shell.getAttribute('data-route-source'),
  };
}

async function readTopicCodeDocument(page) {
  return page.locator('[data-docode-workbench-root]').evaluate((root) => {
    const surface = root.querySelector('.docode-topic-code__surface');
    const keyword = root.querySelector('.docode-topic-code__keyword');
    const title = root.querySelector('.docode-topic-code__title');
    const content = root.querySelector('.docode-topic-code__content-slot > .cooked');
    const floor = root.querySelector('.docode-topic-code__floor');
    const requestedLineNumber = root.querySelector(
      '.docode-topic-code__reply[data-requested="true"] .docode-topic-code__floor',
    );
    if (
      !(surface instanceof HTMLElement) ||
      !(keyword instanceof HTMLElement) ||
      !(title instanceof HTMLElement) ||
      !(content instanceof HTMLElement) ||
      !(floor instanceof HTMLElement) ||
      !(requestedLineNumber instanceof HTMLElement)
    ) {
      throw new Error('Missing rendered topic Code document elements.');
    }
    return {
      contentFontSize: getComputedStyle(content).fontSize,
      contentUserSelect: getComputedStyle(content).userSelect,
      floorCount: root.querySelectorAll('.docode-topic-code__floor').length,
      floorWidth: floor.getBoundingClientRect().width,
      keywordColor: getComputedStyle(keyword).color,
      keywordFontSize: getComputedStyle(keyword).fontSize,
      nativeRootCount: root.querySelectorAll('.docode-topic-code__content-slot > .cooked').length,
      postCount: root.querySelectorAll('.docode-topic-code__reply').length,
      requestedLineNumber: requestedLineNumber.textContent?.trim() ?? '',
      requestedLineNumberColor: getComputedStyle(requestedLineNumber).color,
      sourceNativeRootCount: document.querySelectorAll('#main-outlet .cooked').length,
      titleColor: getComputedStyle(title).color,
      verticalOverflow: surface.scrollHeight > surface.clientHeight,
    };
  });
}

async function readTopicReplySourceFidelity(page) {
  return page.locator('[data-docode-workbench-root]').evaluate((root) => {
    const reply = root.querySelector('.docode-topic-code__reply[data-post-number="2"]');
    const signature = reply?.querySelector('.docode-topic-code__signature');
    const keyword = reply?.querySelector('.docode-topic-code__declaration');
    const author = reply?.querySelector('.docode-topic-code__author');
    const bracket = reply?.querySelector('.docode-topic-code__bracket');
    const metadata = reply?.querySelector('.docode-topic-code__reply-metadata');
    const comment = reply?.querySelector('.docode-topic-code__comment-marker');
    const actionStrip = reply?.querySelector('.docode-topic-code__action-strip');
    const fold = reply?.querySelector('.docode-topic-code__fold');
    const stringLine = reply?.querySelector('[data-docode-editor-line-kind="text"]');
    const unread = reply?.querySelector('.docode-topic-code__unread-annotation');
    if (
      !(reply instanceof HTMLElement) ||
      !(signature instanceof HTMLElement) ||
      !(keyword instanceof HTMLElement) ||
      !(author instanceof HTMLElement) ||
      !(bracket instanceof HTMLElement) ||
      !(metadata instanceof HTMLElement) ||
      !(comment instanceof HTMLElement) ||
      !(actionStrip instanceof HTMLElement) ||
      !(fold instanceof HTMLButtonElement) ||
      !(stringLine instanceof HTMLElement)
    ) {
      throw new Error('Missing source-function reply fidelity elements.');
    }
    const actionStyle = getComputedStyle(actionStrip);
    const replyStyle = getComputedStyle(reply);
    const stringStyle = getComputedStyle(stringLine);
    const stringBefore = getComputedStyle(stringLine, '::before').content;
    const stringAfter = getComputedStyle(stringLine, '::after').content;
    return {
      activeLineCount: reply.querySelectorAll('.docode-topic-code__active-line').length,
      actionOpacity: actionStyle.opacity,
      actionVisibility: actionStyle.visibility,
      authorColor: getComputedStyle(author).color,
      blankLineCount: reply.querySelectorAll('.docode-topic-code__blank-line').length,
      bracketBackground: getComputedStyle(bracket).backgroundColor,
      commentColor: getComputedStyle(comment).color,
      foldExpanded: fold.getAttribute('aria-expanded'),
      keywordColor: getComputedStyle(keyword).color,
      metadataText: Array.from(metadata.childNodes)
        .map((node) => node.textContent?.trim() ?? '')
        .filter(Boolean)
        .join(''),
      readState: reply.dataset.readState ?? '',
      replyBackground: replyStyle.backgroundColor,
      replyBorderBottomWidth: replyStyle.borderBottomWidth,
      replyBoxShadow: replyStyle.boxShadow,
      signatureText: signature.textContent?.replace(/\s+/gu, ' ').trim() ?? '',
      stringColor: stringStyle.color,
      stringQuoted: stringBefore.includes('"') && stringAfter.includes('"'),
      unreadText: unread?.textContent?.trim() ?? '',
    };
  });
}

async function readTopicDocDocument(page) {
  return page.locator('[data-docode-workbench-root]').evaluate((root) => {
    const surface = root.querySelector('.docode-topic-code__surface[data-mode="doc"]');
    const title = root.querySelector(
      '.docode-topic-code__heading-row .docode-topic-code__md-heading',
    );
    const section = root.querySelector('.docode-topic-code__md-section');
    const content = root.querySelector('.docode-topic-code__content-slot > .cooked');
    const indent = root.querySelector('.docode-topic-code__content-indent');
    if (
      !(surface instanceof HTMLElement) ||
      !(title instanceof HTMLElement) ||
      !(section instanceof HTMLElement) ||
      !(content instanceof HTMLElement) ||
      !(indent instanceof HTMLElement)
    ) {
      throw new Error('Missing rendered topic Doc document elements.');
    }
    return {
      contentFontSize: getComputedStyle(content).fontSize,
      contentLineHeight: getComputedStyle(content).lineHeight,
      floorCount: root.querySelectorAll('.docode-topic-code__floor').length,
      headingColor: getComputedStyle(title).color,
      headingCount: root.querySelectorAll('.docode-topic-code__md-heading').length,
      indentBorderWidth: getComputedStyle(indent).borderLeftWidth,
      keywordCount: root.querySelectorAll('.docode-topic-code__keyword').length,
      modeToolbarCount: root.querySelectorAll('.docode-topic-code__mode-toolbar').length,
      nativeRootCount: root.querySelectorAll('.docode-topic-code__content-slot > .cooked').length,
      replyCloseCount: root.querySelectorAll('.docode-topic-code__reply-close').length,
      sectionText: section.textContent,
      titleText: title.textContent,
    };
  });
}

async function readTopicPostAffordances(page) {
  return page.locator('[data-docode-workbench-root]').evaluate((root) => ({
    actionStripCount: root.querySelectorAll('.docode-topic-code__action-strip').length,
    activePostNumber: root
      .querySelector('.docode-topic-code__reply[data-active="true"]')
      ?.getAttribute('data-post-number'),
    availableCopyLinkCount: root.querySelectorAll(
      '.docode-topic-code__action-capability[data-action="copy-link"][data-state="available"]',
    ).length,
    authenticationBookmarkCount: root.querySelectorAll(
      '.docode-topic-code__action-capability[data-action="bookmark"][data-state="authentication-required"]',
    ).length,
    authenticationLikeCount: root.querySelectorAll(
      '.docode-topic-code__action-capability[data-action="like"][data-state="authentication-required"]',
    ).length,
    enabledNativeActionButtonCount: root.querySelectorAll(
      '.docode-topic-code__action-strip button[data-action]:not(:disabled)',
    ).length,
    loadingBoundaryCount: root.querySelectorAll('.docode-topic-code__loading-boundary').length,
    loadingLabel:
      root.querySelector('.docode-topic-code__loading-message')?.textContent?.trim() ?? '',
    moreActionsCount: root.querySelectorAll('.docode-topic-code__more-actions').length,
    permalinkCount: root.querySelectorAll('.docode-topic-code__permalink-action').length,
    requestedPostNumber: root
      .querySelector('.docode-topic-code__reply[data-requested="true"]')
      ?.getAttribute('data-post-number'),
  }));
}

async function readTopicOutline(page) {
  return page.locator('[data-docode-workbench-root]').evaluate((root) => {
    const tree = root.querySelector('.docode-topic-outline__tree');
    const rows = root.querySelectorAll('.docode-topic-outline__item');
    const firstPost = root.querySelector('.docode-topic-outline__item[data-kind="post"]');
    const firstHeading = root.querySelector('.docode-topic-outline__item[data-kind="heading"]');
    const selected = root.querySelector('.docode-topic-outline__item[data-selected="true"]');
    const postIcon = firstPost?.querySelector('.docode-topic-outline__icon');
    const headingIcon = firstHeading?.querySelector('.docode-topic-outline__icon');
    if (
      !(tree instanceof HTMLElement) ||
      !(firstPost instanceof HTMLAnchorElement) ||
      !(firstHeading instanceof HTMLAnchorElement) ||
      !(selected instanceof HTMLAnchorElement) ||
      !(postIcon instanceof HTMLElement) ||
      !(headingIcon instanceof HTMLElement)
    ) {
      throw new Error('Missing rendered topic Outline elements.');
    }
    return {
      activeSelectionBackground: getComputedStyle(selected).backgroundColor,
      firstPostHref: firstPost.href,
      headingCount: root.querySelectorAll('.docode-topic-outline__item[data-kind="heading"]')
        .length,
      headingIndent:
        headingIcon.getBoundingClientRect().left - postIcon.getBoundingClientRect().left,
      headingSymbolColor: getComputedStyle(headingIcon).color,
      loadingAdditional:
        root.querySelector('.docode-topic-outline__range')?.textContent?.trim() ===
        'Loading additional posts…',
      postCount: root.querySelectorAll('.docode-topic-outline__item[data-kind="post"]').length,
      postSymbolColor: getComputedStyle(postIcon).color,
      rowCount: rows.length,
      rowHeight: firstPost.getBoundingClientRect().height,
      selectedPostNumber: selected.textContent?.match(/Post (\d+)/)?.[1] ?? '',
      treeRole: tree.getAttribute('role'),
    };
  });
}

async function readTopicMinimap(page) {
  return page.locator('[data-docode-workbench-root]').evaluate((root) => {
    const minimap = root.querySelector('.docode-topic-minimap');
    const track = root.querySelector('.docode-topic-minimap__track');
    const slider = root.querySelector('.docode-topic-minimap__slider');
    const firstPost = root.querySelector('.docode-topic-minimap__mark');
    const glyphs = Array.from(root.querySelectorAll('.docode-topic-minimap__glyph-line'));
    const firstGlyph = glyphs[0];
    const lastGlyph = glyphs.at(-1);
    if (
      !(minimap instanceof HTMLElement) ||
      !(track instanceof HTMLElement) ||
      !(slider instanceof HTMLElement) ||
      !(firstPost instanceof HTMLAnchorElement) ||
      !(firstGlyph instanceof HTMLElement) ||
      !(lastGlyph instanceof HTMLElement)
    ) {
      throw new Error('Missing rendered topic minimap elements.');
    }
    const progress = Number(
      slider.style.getPropertyValue('--docode-minimap-slider-progress').trim(),
    );
    const size = Number.parseFloat(
      slider.style.getPropertyValue('--docode-minimap-slider-size').trim(),
    );
    const glyphStyle = getComputedStyle(firstGlyph);
    return {
      currentPostNumber: Number(slider.getAttribute('aria-valuenow')),
      firstPostHref: firstPost.href,
      glyphCount: glyphs.length,
      glyphFirstText: firstGlyph.textContent?.trim() ?? '',
      glyphFontSize: glyphStyle.fontSize,
      glyphLastLineNumber: Number(lastGlyph.getAttribute('data-line-number')),
      glyphLastText: lastGlyph.textContent?.trim() ?? '',
      glyphLineHeight: glyphStyle.lineHeight,
      glyphOpacity: glyphStyle.opacity,
      glyphTexts: glyphs.map((glyph) => glyph.textContent?.trim() ?? ''),
      glyphTones: Array.from(
        new Set(
          glyphs.flatMap((glyph) =>
            Array.from(glyph.querySelectorAll('[data-tone]'), (token) =>
              token.getAttribute('data-tone'),
            ),
          ),
        ),
      ),
      loadedRange: {
        maximum: Number(slider.getAttribute('aria-valuemax')),
        minimum: Number(slider.getAttribute('aria-valuemin')),
      },
      markAnchorWidth: firstPost.getBoundingClientRect().width,
      markCount: root.querySelectorAll('.docode-topic-minimap__mark').length,
      markIndicatorWidth: getComputedStyle(firstPost, '::before').width,
      markerKinds: Array.from(root.querySelectorAll('.docode-topic-minimap__mark')).map(
        (mark) => mark.getAttribute('data-markers') ?? '',
      ),
      sliderHeight: slider.getBoundingClientRect().height,
      sliderProgress: progress,
      sliderSize: size / 100,
      state: minimap.getAttribute('data-state'),
      trackHeight: track.getBoundingClientRect().height,
      uniqueGlyphTops: new Set(glyphs.map((glyph) => glyph.getBoundingClientRect().top)).size,
    };
  });
}

async function readNativeContentCorrection(page) {
  return page.locator('[data-docode-workbench-root]').evaluate((root) => {
    const quote = root.querySelector('.docode-topic-code__reply[data-post-number="2"] aside.quote');
    const title = quote?.querySelector(':scope > .title');
    const avatar = title?.querySelector('img.avatar');
    const bodyLine = quote?.querySelector(':scope > blockquote > p');
    const loading = root.querySelector('.docode-topic-code__loading-boundary[data-position="end"]');
    const topicClose = root.querySelector('.docode-topic-code__topic-close');
    const topicCloseCode = topicClose?.querySelector('code');
    const mentions = Array.from(
      root.querySelectorAll('.docode-topic-code__content-slot a.mention'),
    );
    if (
      !(quote instanceof HTMLElement) ||
      !(title instanceof HTMLElement) ||
      !(avatar instanceof HTMLImageElement) ||
      !(bodyLine instanceof HTMLElement) ||
      !(topicClose instanceof HTMLElement) ||
      !(topicCloseCode instanceof HTMLElement) ||
      mentions.length !== 2 ||
      mentions.some((mention) => !(mention instanceof HTMLAnchorElement))
    ) {
      throw new Error('Missing native-content correction surfaces.');
    }
    const mentionLinks = /** @type {HTMLAnchorElement[]} */ (mentions);
    return {
      avatarHeight: avatar.getBoundingClientRect().height,
      avatarWidth: avatar.getBoundingClientRect().width,
      loadingBackground:
        loading instanceof HTMLElement ? getComputedStyle(loading).backgroundColor : null,
      loadingText:
        loading instanceof HTMLElement
          ? (loading.textContent?.replace(/\s+/gu, ' ').trim() ?? '')
          : null,
      mentionBackgrounds: mentionLinks.map((mention) => getComputedStyle(mention).backgroundColor),
      mentionBorderRadii: mentionLinks.map(
        (mention) => getComputedStyle(mention).borderTopLeftRadius,
      ),
      mentionDisplays: mentionLinks.map((mention) => getComputedStyle(mention).display),
      mentionHrefs: mentionLinks.map((mention) => mention.href),
      mentionPaddings: mentionLinks.map((mention) => getComputedStyle(mention).padding),
      quoteBackground: getComputedStyle(quote).backgroundColor,
      quoteBodyLineHeight: bodyLine.getBoundingClientRect().height,
      quoteTitleBackground: getComputedStyle(title).backgroundColor,
      quoteTitleHeight: title.getBoundingClientRect().height,
      topicCloseBackground: getComputedStyle(topicCloseCode).backgroundColor,
      topicCloseBorderRadius: getComputedStyle(topicCloseCode).borderTopLeftRadius,
      topicCloseLineNumber: topicClose.getAttribute('data-docode-editor-line'),
    };
  });
}

async function waitForTopicScrollProgress(page, expected, tolerance) {
  await page.waitForFunction(
    ({ expectedProgress, maximumDifference }) => {
      const slider = document.querySelector('.docode-topic-minimap__slider');
      if (!(slider instanceof HTMLElement)) return false;
      const progress = Number(
        slider.style.getPropertyValue('--docode-minimap-slider-progress').trim(),
      );
      return (
        Number.isFinite(progress) && Math.abs(progress - expectedProgress) <= maximumDifference
      );
    },
    { expectedProgress: expected, maximumDifference: tolerance },
  );
}

async function assertWorkbenchRouteChrome(page, tabLabel, statusLabel, generation) {
  await page.waitForFunction(
    ({ expectedGeneration, expectedStatus, expectedTab }) => {
      const shell = document.querySelector('.docode-workbench');
      const tab = document.querySelector(
        '.docode-workbench__tab[data-active="true"] .docode-workbench__tab-label',
      );
      const status = document.querySelector(
        '.docode-workbench__status-items--left .docode-workbench__status-item span:last-child',
      );
      return (
        shell?.getAttribute('data-route-generation') === String(expectedGeneration) &&
        tab?.textContent?.trim() === expectedTab &&
        status?.textContent?.trim() === expectedStatus
      );
    },
    { expectedGeneration: generation, expectedStatus: statusLabel, expectedTab: tabLabel },
  );
}

async function readPrimaryModifier(page) {
  return page.evaluate(() =>
    /Mac|iPhone|iPad/u.test(`${navigator.platform} ${navigator.userAgent}`) ? 'Meta' : 'Control',
  );
}

async function assertTopicListRoute(page, tabLabel, statusLabel, lineCount) {
  await page.waitForFunction(
    ({ expectedCount, expectedStatus, expectedTab }) => {
      const tab = document.querySelector(
        '.docode-workbench__tab[data-active="true"] .docode-workbench__tab-label',
      );
      const status = document.querySelector(
        '.docode-workbench__status-items--left .docode-workbench__status-item span:last-child',
      );
      return (
        tab?.textContent?.trim() === expectedTab &&
        status?.textContent?.trim() === expectedStatus &&
        document.querySelectorAll('.docode-topic-list__line').length === expectedCount
      );
    },
    { expectedCount: lineCount, expectedStatus: statusLabel, expectedTab: tabLabel },
  );
}

async function readTopicListDocument(page) {
  return page.locator('[data-docode-workbench-root]').evaluate((root) => {
    const list = root.querySelector('.docode-topic-list__scroll');
    const lines = root.querySelectorAll('.docode-topic-list__line');
    const lineNumbers = root.querySelectorAll('.docode-topic-list__line-number');
    const firstLine = lines[0];
    const keyword = root.querySelector('.docode-topic-list__keyword');
    const method = root.querySelector('.docode-topic-list__definition-link[data-method="post"]');
    const string = root.querySelector('.docode-topic-list__string');
    const gutter = root.querySelector('.docode-topic-list__gutter');
    if (
      !(list instanceof HTMLElement) ||
      !(firstLine instanceof HTMLElement) ||
      !(keyword instanceof HTMLElement) ||
      !(method instanceof HTMLElement) ||
      !(string instanceof HTMLElement) ||
      !(gutter instanceof HTMLElement)
    ) {
      throw new Error('Missing rendered topic-list document elements.');
    }
    return {
      firstLineNumber: lineNumbers[0]?.textContent?.trim() ?? '',
      firstSource: firstLine.textContent?.trim() ?? '',
      fontSize: getComputedStyle(method).fontSize,
      gutterFontSize: getComputedStyle(gutter).fontSize,
      horizontalOverflow: list.scrollWidth > list.clientWidth,
      keywordColor: getComputedStyle(keyword).color,
      lineCount: lines.length,
      lineHeight: firstLine.getBoundingClientRect().height,
      lastLineNumber: lineNumbers.item(lineNumbers.length - 1).textContent?.trim() ?? '',
      listRole: list.getAttribute('role'),
      methodColor: getComputedStyle(method).color,
      stringColor: getComputedStyle(string).color,
      verticalOverflow: list.scrollHeight > list.clientHeight,
    };
  });
}

async function readActiveTopicLine(page) {
  return page.locator('[data-docode-workbench-root]').evaluate((root) => {
    const activeLine = root.querySelector('.docode-topic-list__line[data-active="true"]');
    const activeNumber = root.querySelector('.docode-topic-list__line-number[data-active="true"]');
    const focused = root.ownerDocument.activeElement;
    if (
      !(activeLine instanceof HTMLElement) ||
      !(activeNumber instanceof HTMLElement) ||
      !(focused instanceof HTMLAnchorElement)
    ) {
      throw new Error('Missing the active topic-list line, number, or focused link.');
    }
    return {
      activeLineBackground: getComputedStyle(activeLine).backgroundColor,
      activeLineFocusRing: getComputedStyle(activeLine).boxShadow.includes('rgb(0, 120, 212)'),
      activeLineNumber: activeNumber.textContent?.trim() ?? '',
      activeLineNumberColor: getComputedStyle(activeNumber).color,
      focusedTopicId: focused.getAttribute('data-docode-topic-link'),
      selectedTopicId: activeLine
        .closest('.docode-topic-list__entry')
        ?.getAttribute('data-topic-id'),
    };
  });
}

async function assertNativePageVisible(page) {
  const nativePage = await page.evaluate(() => ({
    bodyChildCount: document.body.childElementCount,
    bodyDisplay: getComputedStyle(document.body).display,
    bodyHidden: document.body.hidden,
    bodyWidth: document.body.getBoundingClientRect().width,
  }));

  assert.equal(nativePage.bodyHidden, false);
  assert.notEqual(nativePage.bodyDisplay, 'none');
  assert(nativePage.bodyChildCount > 0);
  assert(nativePage.bodyWidth > 0);
}

async function readEnabledSetting(page) {
  return page.evaluate(async () => {
    const result = await globalThis.chrome.storage.local.get('enabled');
    return result.enabled;
  });
}

async function waitForRouteStatus(page, family, minimumGeneration = 0, tabId = null) {
  let lastResponse = null;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const response = await readContentStatus(page, tabId);
    lastResponse = response;
    if (
      response?.ok === true &&
      response.status.route?.family === family &&
      response.status.route.generation >= minimumGeneration
    ) {
      return response.status.route;
    }
    await page.waitForTimeout(50);
  }
  throw new Error(
    `Route ${family} did not reach generation ${minimumGeneration}: ${JSON.stringify(lastResponse)}`,
  );
}

async function waitForRouteGeneration(page, minimumGeneration, tabId = null) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const response = await readContentStatus(page, tabId);
    if (response?.ok === true && response.status.route?.generation >= minimumGeneration) {
      return response.status.route;
    }
    await page.waitForTimeout(50);
  }
  throw new Error(`Route generation did not reach ${minimumGeneration}.`);
}

async function waitForCapabilityGeneration(page, minimumGeneration) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const response = await readContentStatus(page);
    const capabilities = response?.ok ? response.status.capabilities : null;
    if (capabilities && capabilities.generation >= minimumGeneration) return capabilities;
    await page.waitForTimeout(50);
  }
  throw new Error(`Capability generation did not reach ${minimumGeneration}.`);
}

async function readActiveTabId(page) {
  return page.evaluate(async () => {
    const [tab] = await globalThis.chrome.tabs.query({ active: true, currentWindow: true });
    return tab?.id ?? null;
  });
}

async function readContentStatus(page, tabId = null) {
  return page.evaluate(async (targetTabId) => {
    let resolvedTabId = targetTabId;
    if (resolvedTabId === null) {
      const [tab] = await globalThis.chrome.tabs.query({ active: true, currentWindow: true });
      resolvedTabId = tab?.id ?? null;
    }
    if (resolvedTabId === null) return null;
    return globalThis.chrome.tabs.sendMessage(resolvedTabId, {
      type: 'docode:get-status',
      version: 1,
    });
  }, tabId);
}

function topicListFixtureHtml({ firstUnreadPostNumber = null } = {}) {
  return `<!doctype html>
<html>
  <head><title>Synthetic topic-list fixture</title><link rel="icon" href="/uploads/fixture-favicon.png"></head>
  <body>
    <main>
      <table class="topic-list">
        <tbody>${topicListRowsFixture(36, firstUnreadPostNumber)}</tbody>
      </table>
    </main>
  </body>
</html>`;
}

function delayedTopicListFixtureHtml() {
  return `<!doctype html>
<html>
  <head><title>Delayed unread topic-list fixture</title></head>
  <body>
    <main id="main-outlet"></main>
    <template id="delayed-topic-list">
      <table class="topic-list">
        <tbody>${topicListRowsFixture(3, 4)}</tbody>
      </table>
    </template>
    <script>
      window.setTimeout(() => {
        const outlet = document.querySelector('#main-outlet');
        const template = document.querySelector('#delayed-topic-list');
        if (outlet && template instanceof HTMLTemplateElement) {
          outlet.replaceChildren(template.content.cloneNode(true));
        }
      }, 1200);
    </script>
  </body>
</html>`;
}

function topicListFixturePayload(count, { moreTopicsUrl = null, startOrdinal = 1 } = {}) {
  return {
    topic_list: {
      topics: Array.from({ length: count }, (_, index) => {
        const ordinal = startOrdinal + index;
        return {
          excerpt: ordinal === 1 ? 'Synthetic excerpt' : null,
          highest_post_number: 5,
          id: 41 + ordinal,
          last_posted_at: new Date(1_700_000_000_000 + ordinal * 60_000).toISOString(),
          last_poster_username: 'last-user',
          pinned: ordinal === 1,
          posters: [
            { extras: 'original', user_id: 1 },
            { extras: 'latest', user_id: 2 },
          ],
          reply_count: ordinal + 11,
          slug: `synthetic-topic-${ordinal}`,
          tags: ['testing'],
          title: `Synthetic topic ${ordinal}`,
          unseen: ordinal === 2,
          unread_posts: ordinal === 1 ? 3 : 0,
          views: ordinal * 1200,
        };
      }),
      more_topics_url: moreTopicsUrl,
    },
    users: [
      { id: 1, username: 'first-user' },
      { id: 2, username: 'last-user' },
    ],
  };
}

function searchFixturePayload(query) {
  const title = query === 'remote' ? 'Remote result' : 'Browser extension result';
  return {
    categories: [
      {
        description_text: 'Development discussion',
        id: 4,
        name: 'Develop',
        slug: 'develop',
        topic_url: '/c/develop/4',
      },
    ],
    posts: [
      {
        blurb: `<b>${title}</b> excerpt`,
        id: 501,
        post_number: 4,
        topic_id: 42,
        username: 'alice',
      },
    ],
    tags: [{ description: 'Testing topics', id: 7, name: 'Testing', slug: 'testing' }],
    topics: [{ fancy_title: title, id: 42, slug: 'synthetic-topic-1' }],
    users: [{ id: 9, name: 'Alice Example', username: 'alice' }],
  };
}

function topicListRowsFixture(count, firstUnreadPostNumber = null) {
  return Array.from({ length: count }, (_, index) => {
    const ordinal = index + 1;
    const id = 41 + ordinal;
    const stateClass =
      ordinal === 1
        ? ' pinned unread-posts has-excerpt'
        : ordinal === 2
          ? ' unseen-topic'
          : ordinal === 3
            ? ' visited'
            : '';
    const titleUrl =
      ordinal === 1 && firstUnreadPostNumber !== null
        ? `/t/synthetic-topic-${ordinal}/${id}/${firstUnreadPostNumber}`
        : `/t/synthetic-topic-${ordinal}/${id}`;
    return `<tr class="topic-list-item${stateClass}" data-topic-id="${id}">
      <td class="main-link">
        <a class="title raw-link raw-topic-link" href="${titleUrl}">Synthetic topic ${ordinal}</a>
        <a href="/c/develop/4">Develop</a>
        <a href="/tag/testing/7">Testing</a>
      </td>
      <td class="posters">
        <a data-user-card="first-user" href="/u/first-user"></a>
        <a class="latest" data-user-card="last-user" href="/u/last-user"></a>
      </td>
      <td class="posts"><a aria-label="${ordinal + 11} replies" href="/t/synthetic-topic-${ordinal}/${id}/1">${ordinal + 11}</a></td>
      <td class="views"><span title="Viewed ${ordinal * 1200} times">${ordinal * 1200}</span></td>
      <td class="activity"><a href="/t/synthetic-topic-${ordinal}/${id}/5"><span data-time="1700000000000">${ordinal}m</span></a></td>
    </tr>`;
  }).join('');
}

function topicFixtureHtml() {
  return `<!doctype html>
<html>
  <head>
    <title>Synthetic topic fixture</title>
    <link rel="icon" href="/uploads/fixture-favicon.png">
    <style>
      code { color: #d0d0d0; background: #ffffff; border-radius: 6px; }
      .cooked aside.quote > .title { min-height: 68px; color: #666666; background: #ffffff; }
      .cooked aside.quote > .title img.avatar { width: 48px; height: 48px; }
    </style>
  </head>
  <body>
    <header class="d-header"><button class="login-button">Log in</button></header>
    <div id="main-outlet">
      <main>
        <div class="title-wrapper">
          <h1 data-topic-id="42"><a class="fancy-title" href="/t/synthetic-topic/42">Synthetic topic</a></h1>
          <span class="topic-status"><svg class="d-icon d-icon-lock"></svg></span>
          <span class="topic-status"><svg class="d-icon d-icon-thumbtack"></svg></span>
          <a href="/c/develop/4">Develop</a>
          <a href="/tag/testing/7">Testing</a>
        </div>
        <div class="post-stream">
          ${topicPostFixtureHtml(1, 100)}
          ${topicPostFixtureHtml(2, 101, true)}
          <div class="topic-post-loading"><span class="spinner"></span></div>
        </div>
        <div id="topic-footer-buttons"><div class="topic-footer-main-buttons"><button class="btn-primary create">Reply</button></div></div>
      </main>
    </div>
    <div id="reply-control" class="closed hide-preview"></div>
  </body>
</html>`;
}

function topicFixturePostPayload(postId, postNumber) {
  return {
    cooked: `<p>Rendered rich content for post ${String(postNumber)}.</p>`,
    created_at: '2023-11-14T22:13:20.000Z',
    id: postId,
    name: 'Fixture User',
    post_number: postNumber,
    topic_id: 42,
    user_id: 11,
    username: 'fixture-user',
  };
}

function replyTargetHoverFixtureHtml() {
  return `<!doctype html><html><head><title>Reply target hover fixture</title></head><body>
    <header class="d-header"><button class="login-button">Log in</button></header>
    <main id="main-outlet">
      <div class="title-wrapper">
        <h1 data-topic-id="48"><a class="fancy-title" href="/t/synthetic-reply-target/48">Reply target hover</a></h1>
      </div>
      <div class="post-stream">
        ${replyTargetHoverPostFixtureHtml(4_800, 1, 'source-user', 'Source User', 'Original floor content for hover preview.')}
        ${replyTargetHoverPostFixtureHtml(4_801, 2, 'reply-user', 'Reply User', 'This floor replies to the original content.')}
      </div>
    </main>
  </body></html>`;
}

function replyTargetHoverPostFixtureHtml(postId, postNumber, username, displayName, content) {
  const permalink =
    postNumber === 1
      ? '/t/synthetic-reply-target/48'
      : `/t/synthetic-reply-target/48/${String(postNumber)}`;
  return `<div data-post-number="${String(postNumber)}">
    <article data-post-id="${String(postId)}" data-user-id="${String(postNumber)}">
      <div class="topic-avatar"><img class="avatar" alt="" src="/user_avatar/linux.do/${username}/48/${String(postNumber)}.png"></div>
      <div class="names"><a data-user-card="${username}" href="/u/${username}">${displayName}</a></div>
      <a class="post-date" href="${permalink}"><span data-time="2026-08-21T12:00:00.000Z">now</span></a>
      <div class="cooked"><p>${content}</p></div>
    </article>
  </div>`;
}

function replyTargetHoverFixturePayload() {
  return {
    post_stream: {
      posts: [
        replyTargetHoverPostPayload(4_800, 1, 'source-user', 'Source User', null),
        replyTargetHoverPostPayload(4_801, 2, 'reply-user', 'Reply User', 1),
      ],
      stream: [4_800, 4_801],
    },
  };
}

function replyTargetHoverPostPayload(postId, postNumber, username, displayName, replyToPostNumber) {
  return {
    cooked:
      postNumber === 1
        ? '<p>Original floor content for hover preview.</p>'
        : '<p>This floor replies to the original content.</p>',
    created_at: '2026-08-21T12:00:00.000Z',
    id: postId,
    name: displayName,
    post_number: postNumber,
    reply_to_post_number: replyToPostNumber,
    topic_id: 48,
    user_id: postNumber,
    username,
  };
}

function delayedTopicMainFixtureHtml() {
  return `<main>
    <div class="title-wrapper">
      <h1 data-topic-id="43"><a class="fancy-title" href="/t/delayed-topic/43">Delayed topic</a></h1>
    </div>
    <div class="post-stream">
      <div data-post-number="1"><article data-post-id="4300">
        <div class="names"><a data-user-card="delayed-user" href="/u/delayed-user">Delayed User</a></div>
        <a class="post-date" href="/t/delayed-topic/43"><span data-time="2026-08-20T12:00:00.000Z">now</span></a>
        <div class="cooked"><p>Delayed native topic content</p></div>
      </article></div>
    </div>
  </main>`;
}

function topicPaginationFixtureHtml() {
  return `<!doctype html><html><head><title>Topic pagination fixture</title></head><body>
    <header class="d-header"><button class="login-button">Log in</button></header>
    <main id="main-outlet">
      <h1 data-topic-id="88"><a class="fancy-title" href="/t/synthetic-pagination/88">Synthetic pagination</a></h1>
      <div class="post-stream">${topicPaginationPostFixtureHtml(8_800, 1)}</div>
    </main>
  </body></html>`;
}

function topicPaginationPostFixtureHtml(postId, postNumber) {
  const permalink =
    postNumber === 1
      ? '/t/synthetic-pagination/88'
      : `/t/synthetic-pagination/88/${String(postNumber)}`;
  return `<div data-post-number="${String(postNumber)}">
    <article data-post-id="${String(postId)}" data-user-id="${String(postNumber)}">
      <div class="names"><a data-user-card="page-user-${String(postNumber)}" href="/u/page-user-${String(postNumber)}">Page User ${String(postNumber)}</a></div>
      <a class="post-date" href="${permalink}"><span data-time="2026-08-20T12:00:00.000Z">now</span></a>
      <div class="cooked"><p>Paginated reply ${String(postNumber)}</p></div>
    </article>
  </div>`;
}

function topicPaginationPostPayload(postId, postNumber) {
  return {
    cooked: `<p>Paginated reply ${String(postNumber)}</p>`,
    created_at: '2026-08-20T12:00:00.000Z',
    id: postId,
    name: `Page User ${String(postNumber)}`,
    post_number: postNumber,
    topic_id: 88,
    user_id: postNumber,
    username: `page-user-${String(postNumber)}`,
  };
}

function topicBackwardPaginationFixtureHtml() {
  return `<!doctype html><html><head><title>Topic backward pagination fixture</title></head><body>
    <header class="d-header"><button class="login-button">Log in</button></header>
    <main id="main-outlet">
      <h1 data-topic-id="90"><a class="fancy-title" href="/t/synthetic-previous/90">Synthetic previous replies</a></h1>
      <div class="post-stream">${Array.from({ length: 31 }, (_, index) =>
        topicBackwardPaginationPostFixtureHtml(9_017 + index, 18 + index),
      ).join('')}</div>
    </main>
  </body></html>`;
}

function topicBackwardPaginationPostFixtureHtml(postId, postNumber) {
  const permalink = `/t/synthetic-previous/90/${String(postNumber)}`;
  return `<div data-post-number="${String(postNumber)}">
    <article data-post-id="${String(postId)}" data-user-id="${String(postNumber)}">
      <div class="names"><a data-user-card="previous-user-${String(postNumber)}" href="/u/previous-user-${String(postNumber)}">Previous User ${String(postNumber)}</a></div>
      <a class="post-date" href="${permalink}"><span data-time="2026-08-20T12:00:00.000Z">now</span></a>
      <div class="cooked"><p>Earlier pagination reply ${String(postNumber)}</p><p>Stable viewport line ${String(postNumber)}</p><p>Backward pagination line ${String(postNumber)}</p></div>
    </article>
  </div>`;
}

function topicBackwardPaginationPostPayload(postId, postNumber) {
  return {
    cooked: `<p>Earlier pagination reply ${String(postNumber)}</p><p>Stable viewport line ${String(postNumber)}</p><p>Backward pagination line ${String(postNumber)}</p>`,
    created_at: '2026-08-20T12:00:00.000Z',
    id: postId,
    name: `Previous User ${String(postNumber)}`,
    post_number: postNumber,
    topic_id: 90,
    user_id: postNumber,
    username: `previous-user-${String(postNumber)}`,
  };
}

function topicPaginationEndFixtureHtml() {
  return `<!doctype html><html><head><title>Topic pagination end fixture</title></head><body>
    <header class="d-header"><button class="login-button">Log in</button></header>
    <main id="main-outlet">
      <h1 data-topic-id="89"><a class="fancy-title" href="/t/synthetic-pagination-end/89">Synthetic pagination end</a></h1>
      <div class="post-stream">${Array.from({ length: 12 }, (_, index) =>
        topicPaginationEndPostFixtureHtml(8_900 + index, index + 1),
      ).join('')}</div>
    </main>
  </body></html>`;
}

function topicPaginationEndPostFixtureHtml(postId, postNumber) {
  const permalink =
    postNumber === 1
      ? '/t/synthetic-pagination-end/89'
      : `/t/synthetic-pagination-end/89/${String(postNumber)}`;
  return `<div data-post-number="${String(postNumber)}">
    <article data-post-id="${String(postId)}" data-user-id="${String(postNumber)}">
      <div class="names"><a data-user-card="end-user-${String(postNumber)}" href="/u/end-user-${String(postNumber)}">End User ${String(postNumber)}</a></div>
      <a class="post-date" href="${permalink}"><span data-time="2026-08-20T12:00:00.000Z">now</span></a>
      <div class="cooked"><p>Exhausted reply ${String(postNumber)}</p><p>Viewport stability line ${String(postNumber)}</p><p>Pagination end line ${String(postNumber)}</p></div>
    </article>
  </div>`;
}

function topicPaginationEndPostPayload(postId, postNumber) {
  return {
    cooked: `<p>Exhausted reply ${String(postNumber)}</p><p>Viewport stability line ${String(postNumber)}</p><p>Pagination end line ${String(postNumber)}</p>`,
    created_at: '2026-08-20T12:00:00.000Z',
    id: postId,
    name: `End User ${String(postNumber)}`,
    post_number: postNumber,
    topic_id: 89,
    user_id: postNumber,
    username: `end-user-${String(postNumber)}`,
  };
}

function authenticatedTopicFixtureHtml() {
  return `<!doctype html>
<html>
  <head>
    <title>Synthetic authenticated action fixture</title>
    <style>
      #reply-control.closed { display: none; }
      #reply-control { height: 100%; color: #cccccc; background: #1f1f1f; }
      #reply-control .composer-fields { height: 100%; padding: 12px; }
      #reply-control .reply-area { display: grid; grid-template-rows: 28px minmax(80px, 1fr) 34px; gap: 8px; height: 100%; }
      #reply-control .composer-actions-reply-target-link { color: #4daafc; font: 12px/28px -apple-system, BlinkMacSystemFont, sans-serif; text-decoration: none; }
      #reply-control .d-editor-input { width: 100%; min-height: 80px; resize: none; border: 1px solid #3c3c3c; padding: 10px; }
      #reply-control .submit-panel { display: flex; gap: 8px; align-items: center; }
      #reply-control button { min-height: 28px; border: 0; padding: 0 12px; color: #ffffff; background: #3a3d41; }
      #reply-control .popup-tip.bad { padding: 4px 8px; color: #f48771; font: 12px/20px -apple-system, BlinkMacSystemFont, sans-serif; }
    </style>
  </head>
  <body>
    <header class="d-header"><div id="current-user" data-username="fixture-user"><span class="badge-notification unread-notifications">3</span></div></header>
    <main id="main-outlet">
      <h1 data-topic-id="43"><a class="fancy-title" href="/t/synthetic-native-actions/43">Native actions</a></h1>
      <div class="post-stream"><div data-post-number="1">
        <article data-post-id="200" data-user-id="12">
          <div class="names"><a href="/u/action-author" data-user-card="action-author">Action Author</a></div>
          <a class="post-date" href="/t/synthetic-native-actions/43"><span data-time="1700000000000">Nov 14</span></a>
          <div class="cooked"><p>Native action verification content.</p></div>
          <nav class="post-controls">
            <div class="discourse-reactions-actions can-toggle-reaction">
              <button class="btn-toggle-reaction-like">Like</button>
            </div>
            <button class="post-action-menu__bookmark bookmark">Bookmark</button>
            <button class="post-action-menu__copy-link">Copy link</button>
          </nav>
        </article>
      </div></div>
      <div id="topic-footer-buttons"><div class="topic-footer-main-buttons"><button class="btn-primary create">Reply</button></div></div>
    </main>
    <div id="native-composer-source"><div id="reply-control" class="closed hide-preview">
      <div class="composer-fields"><div class="reply-area">
        <a class="composer-actions-reply-target-link" href="/t/synthetic-native-actions/43">Replying to Native actions</a>
        <textarea class="d-editor-input" aria-label="Reply body"></textarea>
        <div class="submit-panel">
          <button class="btn btn-primary create" type="button">Reply</button>
          <button class="btn discard-button" type="button">Discard</button>
        </div>
      </div></div>
    </div></div>
    <script>
      const reactionRoot = document.querySelector('.discourse-reactions-actions');
      document.querySelector('.btn-toggle-reaction-like').addEventListener('click', async () => {
        const previous = reactionRoot.classList.contains('has-used-main-reaction');
        reactionRoot.classList.toggle('has-used-main-reaction', !previous);
        try {
          const response = await fetch('/discourse-reactions/posts/200/custom-reactions/heart/toggle.json', { method: 'PUT' });
          if (!response.ok) throw new Error('Synthetic Like failed');
        } catch {
          reactionRoot.classList.toggle('has-used-main-reaction', previous);
        }
      });
      const bookmark = document.querySelector('.post-action-menu__bookmark');
      bookmark.addEventListener('click', async () => {
        const response = await fetch('/bookmarks.json', { method: 'POST' });
        if (response.ok) bookmark.classList.add('bookmarked');
      });
      const composer = document.querySelector('#reply-control');
      const composerEditor = composer.querySelector('.d-editor-input');
      const composerReply = composer.querySelector('button.create');
      const composerDiscard = composer.querySelector('.discard-button');
      const clearComposerErrors = () => {
        composer.querySelectorAll('.popup-tip.bad').forEach((error) => error.remove());
      };
      globalThis.__docodeComposerOpenCount = 0;
      document.querySelector('#topic-footer-buttons button.create').addEventListener('click', () => {
        globalThis.__docodeComposerOpenCount += 1;
        const delay = globalThis.__docodeComposerOpenCount === 1 ? 1200 : 0;
        window.setTimeout(() => {
          clearComposerErrors();
          composer.className = 'open hide-preview';
          composerEditor.focus();
        }, delay);
      });
      composerDiscard.addEventListener('click', () => {
        composerEditor.value = '';
        clearComposerErrors();
        composer.className = 'closed hide-preview';
      });
      composerReply.addEventListener('click', async () => {
        clearComposerErrors();
        const submittedValue = composerEditor.value;
        composer.className = 'saving hide-preview';
        const response = await fetch('/posts', {
          body: JSON.stringify({ raw: submittedValue, topic_id: 43 }),
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        });
        if (!response.ok) {
          const result = await response.json();
          const error = document.createElement('div');
          error.className = 'popup-tip bad';
          error.setAttribute('role', 'alert');
          error.textContent = result.errors?.[0] ?? 'Synthetic reply rejected.';
          composer.querySelector('.submit-panel').before(error);
          composer.className = 'open hide-preview';
          return;
        }
        const result = await response.json();
        const wrapper = document.createElement('div');
        wrapper.dataset.postNumber = String(result.post_number);
        const article = document.createElement('article');
        article.dataset.postId = String(result.id);
        article.dataset.userId = '12';
        const names = document.createElement('div');
        names.className = 'names';
        const author = document.createElement('a');
        author.href = '/u/fixture-user';
        author.dataset.userCard = 'fixture-user';
        author.textContent = 'Fixture User';
        names.append(author);
        const date = document.createElement('a');
        date.className = 'post-date';
        date.href = '/t/synthetic-native-actions/43/2';
        const time = document.createElement('span');
        time.dataset.time = '1787097600000';
        time.textContent = 'now';
        date.append(time);
        const cooked = document.createElement('div');
        cooked.className = 'cooked';
        const paragraph = document.createElement('p');
        paragraph.textContent = submittedValue;
        cooked.append(paragraph);
        const controls = document.createElement('nav');
        controls.className = 'post-controls';
        const copy = document.createElement('button');
        copy.className = 'post-action-menu__copy-link';
        copy.textContent = 'Copy link';
        controls.append(copy);
        article.append(names, date, cooked, controls);
        wrapper.append(article);
        document.querySelector('.post-stream').append(wrapper);
        composerEditor.value = '';
        composer.className = 'closed hide-preview';
      });
    </script>
  </body>
</html>`;
}

function topicPostFixtureHtml(postNumber, postId, unread = false) {
  const permalink =
    postNumber === 1 ? '/t/synthetic-topic/42' : `/t/synthetic-topic/42/${postNumber}`;
  return `<div data-post-number="${postNumber}">
    <article id="post_${postNumber}" data-post-id="${postId}" data-user-id="11">
      <div class="names"><a href="/u/fixture-user" data-user-card="fixture-user">Fixture User</a></div>
      <a class="post-date" href="${permalink}" aria-label="November 14, 2023">
        <span class="relative-date" data-time="1700000000000">Nov 14</span>
      </a>
      <div class="topic-meta-data"><div class="post-infos">
        ${unread ? '<div class="read-state" title="帖子未读"></div>' : ''}
      </div></div>
      <div class="cooked" id="native-cooked-${postNumber}">
        <h2>Fixture section</h2>
        <p>Rendered <a href="https://example.com/reference">rich content</a>.${
          postNumber === 1
            ? ' <a class="mention" data-user-card="kaluoer111" href="/u/kaluoer111">@kaluoer111</a>'
            : ''
        }${postNumber === 2 ? '<br>Second visible line remains readable.' : ''}</p>
        <ul><li>Fixture item</li></ul>
        ${
          postNumber === 2
            ? '<aside class="quote" data-username="ander"><div class="title"><img class="avatar" alt="" src="/avatar.png">Ander:</div><blockquote><p><a class="mention" data-user-card="kaluoer111" href="/u/kaluoer111">@kaluoer111</a> cannot identify you with this ID in this video chat</p></blockquote></aside>'
            : '<blockquote>Native quote with <strong>formatting</strong>.</blockquote>'
        }
        <pre><code>const verified = true;</code></pre>
        <table><thead><tr><th>Field</th><th>Value</th></tr></thead><tbody><tr><td>floor</td><td>${postNumber}</td></tr></tbody></table>
        <details open><summary>Native details</summary><p>Expanded fixture content.</p></details>
        <hr>
        <figure><a class="lightbox" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='960' height='540'%3E%3Crect width='960' height='540' fill='%230072c6'/%3E%3Ctext x='64' y='286' fill='white' font-size='48'%3Eoriginal image 960x540%3C/text%3E%3C/svg%3E"><img width="160" height="56" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='56'%3E%3Crect width='160' height='56' fill='%233c3c3c'/%3E%3Ctext x='12' y='34' fill='%23cccccc' font-size='14'%3Enative image%3C/text%3E%3C/svg%3E" alt="Synthetic native image"></a></figure>
      </div>
      <nav class="post-controls">
        <button class="btn-toggle-reaction-like" title="Log in to like">Like</button>
        <button class="post-action-menu__copy-link">Copy link</button>
      </nav>
    </article>
  </div>`;
}

function codeBlockTopicFixtureHtml() {
  const codeBlocks = `<pre><code class="language-ts hljs"><span class="hljs-keyword">const</span> <span class="hljs-variable">answer</span> = <span class="hljs-number">42</span>;</code></pre>
        <pre><code class="language-java hljs"><span class="hljs-keyword">public</span> <span class="hljs-keyword">class</span> <span class="hljs-type">Greeting</span> {}</code></pre>
        <pre><code class="language-golang hljs"><span class="hljs-keyword">func</span> <span class="hljs-title function_">main</span>() {}</code></pre>
        <pre><code class="lang-yml hljs"><span class="hljs-attr">message:</span> <span class="hljs-string">"ready"</span> <span class="hljs-comment"># verified</span></code></pre>
        <pre><code class="lang-auto hljs">unclassified source remains honest</code></pre>`;
  return topicFixtureHtml().replace('<pre><code>const verified = true;</code></pre>', codeBlocks);
}

function compatibilityTopicFixtureHtml() {
  return `<!doctype html><html><head><title>Compatibility fixture</title></head><body>
    <header class="d-header"><div id="current-user" data-username="fixture-user"></div></header>
    <main id="main-outlet">
      <div class="title-wrapper">
        <h1 data-topic-id="42"><a class="fancy-title" href="/t/compatibility-topic/42">Compatibility topic</a></h1>
      </div>
      <div class="post-stream">
        <div data-post-number="1"><article id="compat-post-1" data-post-id="1001">
          <div class="names"><a href="/u/fixture-user" data-user-card="fixture-user">Fixture User</a></div>
          <a class="post-date" href="/t/compatibility-topic/42" aria-label="November 14, 2023"><span data-time="1700000000000">Nov 14</span></a>
          <div class="cooked" id="compat-content-1"><p>Preserved native content</p></div>
          <nav><button class="post-action-menu__copy-link">Copy link</button></nav>
        </article></div>
        <div data-post-number="2"><article id="compat-post-2" data-post-id="1002">
          <a class="post-date" href="/t/compatibility-topic/42/2" aria-label="November 14, 2023"><span data-time="1700000000000">Nov 14</span></a>
        </article></div>
      </div>
    </main>
  </body></html>`;
}

function longTopicFixtureHtml(firstPostNumber, count) {
  const posts = Array.from({ length: count }, (_, index) => {
    const postNumber = firstPostNumber + index;
    const permalink = `/t/synthetic-topic/42/${postNumber}`;
    return `<div data-post-number="${postNumber}">
      <article id="post_${postNumber}" data-post-id="${1_000 + postNumber}">
        <div class="names"><a href="/u/fixture-user" data-user-card="fixture-user">Fixture User</a></div>
        <a class="post-date" href="${permalink}" aria-label="November 14, 2023"><span data-time="1700000000000">Nov 14</span></a>
        <div class="cooked" id="native-long-cooked-${postNumber}"><p>Loaded post ${postNumber}</p></div>
        <nav><button class="post-action-menu__copy-link">Copy link</button></nav>
      </article>
    </div>`;
  }).join('');
  return `<!doctype html><html><head><title>Long topic fixture</title></head><body>
    <header class="d-header"><button class="login-button">Log in</button></header>
    <main id="main-outlet">
      <h1 data-topic-id="42"><a class="fancy-title" href="/t/synthetic-topic/42">Synthetic topic</a></h1>
      <div class="post-stream">${posts}<div class="topic-post-loading"><span class="spinner"></span></div></div>
      <div id="topic-footer-buttons"><div class="topic-footer-main-buttons"><button class="btn-primary create">Reply</button></div></div>
    </main><div id="reply-control" class="closed"></div>
  </body></html>`;
}
