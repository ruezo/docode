// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';

import { recognizeLinuxDoRoute, type LinuxDoRoute } from '../../src/linuxdo/routes';
import { TabDisguise, VSCODE_FAVICON_DATA_URI } from '../../src/runtime/tabDisguise';

const LATEST_ROUTE = recognizeLinuxDoRoute('https://linux.do/latest');
const TOPIC_ROUTE = recognizeLinuxDoRoute('https://linux.do/t/example-topic/123');
const activeDisguises: TabDisguise[] = [];

function createDisguise(initialRoute: LinuxDoRoute): TabDisguise {
  const disguise = new TabDisguise(document, initialRoute);
  activeDisguises.push(disguise);
  return disguise;
}

function flushMutations(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function faviconLink(): HTMLLinkElement {
  const link = document.head.querySelector<HTMLLinkElement>('link[rel~="icon"]');
  if (!link) throw new Error('Expected a favicon link fixture.');
  return link;
}

afterEach(() => {
  for (const disguise of activeDisguises.splice(0)) disguise.stop();
  document.head.innerHTML = '';
  document.title = '';
});

describe('TabDisguise', () => {
  it('disguises the favicon and title on a topic list and restores both on stop', () => {
    document.head.innerHTML = '<link rel="icon" type="image/png" href="/uploads/favicon.png">';
    document.title = 'LINUX DO';
    const disguise = createDisguise(LATEST_ROUTE);

    expect(disguise.start()).toBe(true);
    expect(disguise.start()).toBe(false);
    expect(document.title).toBe('LinuxDo.java - docode - Visual Studio Code');
    expect(faviconLink().getAttribute('href')).toBe(VSCODE_FAVICON_DATA_URI);

    expect(disguise.stop()).toBe(true);
    expect(disguise.stop()).toBe(false);
    expect(document.title).toBe('LINUX DO');
    expect(faviconLink().getAttribute('href')).toBe('/uploads/favicon.png');
  });

  it('names the file after the topic and strips the unread count prefix', () => {
    document.head.innerHTML = '<link rel="icon" href="/uploads/favicon.png">';
    document.title = '(2) 社区贴子标题 - LINUX DO';
    const disguise = createDisguise(TOPIC_ROUTE);

    disguise.start();
    expect(document.title).toBe('社区贴子标题.java - docode - Visual Studio Code');

    disguise.stop();
    expect(document.title).toBe('(2) 社区贴子标题 - LINUX DO');
  });

  it('tracks route changes and native title updates', async () => {
    document.head.innerHTML = '<link rel="icon" href="/uploads/favicon.png">';
    document.title = 'LINUX DO';
    const disguise = createDisguise(LATEST_ROUTE);
    disguise.start();

    disguise.updateRoute(TOPIC_ROUTE);
    expect(document.title).toBe('LinuxDo.java - docode - Visual Studio Code');

    document.title = '新的话题 - LINUX DO';
    await flushMutations();
    expect(document.title).toBe('新的话题.java - docode - Visual Studio Code');

    disguise.updateRoute(LATEST_ROUTE);
    expect(document.title).toBe('LinuxDo.java - docode - Visual Studio Code');

    disguise.stop();
    expect(document.title).toBe('新的话题 - LINUX DO');
  });

  it('re-applies the favicon after the host swaps it and restores the latest native icon', async () => {
    document.head.innerHTML = '<link rel="icon" href="/uploads/favicon.png">';
    document.title = 'LINUX DO';
    const disguise = createDisguise(LATEST_ROUTE);
    disguise.start();

    faviconLink().setAttribute('href', 'data:image/png;base64,badge');
    await flushMutations();
    expect(faviconLink().getAttribute('href')).toBe(VSCODE_FAVICON_DATA_URI);

    const replacement = document.createElement('link');
    replacement.setAttribute('rel', 'icon');
    replacement.setAttribute('href', '/uploads/replacement.png');
    faviconLink().replaceWith(replacement);
    await flushMutations();
    expect(faviconLink().getAttribute('href')).toBe(VSCODE_FAVICON_DATA_URI);

    disguise.stop();
    expect(faviconLink().getAttribute('href')).toBe('/uploads/replacement.png');
  });
});
