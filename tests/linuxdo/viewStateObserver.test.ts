// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://linux.do/latest" }

import { afterEach, describe, expect, it, vi } from 'vitest';

import { LinuxDoViewStateObserver } from '../../src/linuxdo/viewStateObserver';
import { DOCODE_PAGINATED_POST_ATTRIBUTE } from '../../src/linuxdo/topicAdapter';
import { NATIVE_CONTENT_TRANSFER_MARKER } from '../../src/runtime/nativeContentTransfer';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('LinuxDoViewStateObserver', () => {
  it('coalesces relevant view mutations and ignores post content', async () => {
    document.body.innerHTML = '<main><div class="cooked"></div></main>';
    const onChange = vi.fn();
    const observer = new LinuxDoViewStateObserver(document, onChange);

    expect(observer.start()).toBe(true);
    expect(observer.start()).toBe(false);
    document.querySelector('.cooked')?.append(document.createTextNode('private fixture content'));
    await nextMutationTurn();
    expect(onChange).not.toHaveBeenCalled();

    document
      .querySelector('main')
      ?.insertAdjacentHTML(
        'beforeend',
        '<div role="progressbar"></div><table class="topic-list"><tbody></tbody></table>',
      );
    await nextMutationTurn();
    expect(onChange).toHaveBeenCalledOnce();

    expect(observer.stop()).toBe(true);
    expect(observer.stop()).toBe(false);
    document.querySelector('tbody')?.insertAdjacentHTML('beforeend', '<tr></tr>');
    await nextMutationTurn();
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('rebinds only when the narrow main root changes', async () => {
    document.body.innerHTML = '<main></main>';
    const onChange = vi.fn();
    const observer = new LinuxDoViewStateObserver(document, onChange);
    expect(observer.start()).toBe(true);
    expect(observer.refresh()).toBe(false);

    document.body.innerHTML = '<main><div class="post-stream"></div></main>';
    expect(observer.refresh()).toBe(true);
    document
      .querySelector('.post-stream')
      ?.insertAdjacentHTML('beforeend', '<article data-post-id="42"></article>');
    await nextMutationTurn();
    expect(onChange).toHaveBeenCalledOnce();
    observer.stop();
  });

  it('refreshes for a native content root appearing without observing its rich descendants', async () => {
    document.body.innerHTML =
      '<main><div class="post-stream"><article data-post-id="42"></article></div></main>';
    const onChange = vi.fn();
    const observer = new LinuxDoViewStateObserver(document, onChange);
    expect(observer.start()).toBe(true);

    const article = document.querySelector('article');
    article?.insertAdjacentHTML('beforeend', '<div class="cooked"><p>Loaded later</p></div>');
    await nextMutationTurn();
    expect(onChange).toHaveBeenCalledOnce();

    document.querySelector('.cooked p')?.append(document.createTextNode(' rich update'));
    await nextMutationTurn();
    expect(onChange).toHaveBeenCalledOnce();

    document.querySelector('.cooked')?.remove();
    await nextMutationTurn();
    expect(onChange).toHaveBeenCalledTimes(2);
    observer.stop();
  });

  it('refreshes when Linux DO clears or removes a native unread marker', async () => {
    document.body.innerHTML = `<main><div class="post-stream"><article data-post-id="42">
      <div class="topic-meta-data"><div class="post-infos">
        <div class="read-state" title="帖子未读"></div>
      </div></div>
    </article></div></main>`;
    const onChange = vi.fn();
    const observer = new LinuxDoViewStateObserver(document, onChange);
    expect(observer.start()).toBe(true);

    document.querySelector('.read-state')?.classList.add('read');
    await nextMutationTurn();
    expect(onChange).toHaveBeenCalledOnce();

    document.querySelector('.read-state')?.remove();
    await nextMutationTurn();
    expect(onChange).toHaveBeenCalledTimes(2);
    observer.stop();
  });

  it('ignores native content moved into the DOCode-owned workbench root', async () => {
    document.body.innerHTML = `<main><div class="post-stream"><article data-post-id="42">
      <div class="cooked"><p>Native content</p></div>
    </article></div></main><div data-docode-workbench-root="owner"></div>`;
    const onChange = vi.fn();
    const observer = new LinuxDoViewStateObserver(document, onChange);
    expect(observer.start()).toBe(true);

    const content = document.querySelector('.cooked');
    const workbench = document.querySelector('[data-docode-workbench-root]');
    if (!content || !workbench) throw new Error('Missing ownership fixture.');
    content.setAttribute(NATIVE_CONTENT_TRANSFER_MARKER, '');
    workbench.append(content);
    await nextMutationTurn();

    expect(onChange).not.toHaveBeenCalled();
    observer.stop();
  });

  it('ignores a directly rendered DOCode-owned pagination wrapper', async () => {
    document.body.innerHTML = '<main><div class="post-stream"></div></main>';
    const onChange = vi.fn();
    const observer = new LinuxDoViewStateObserver(document, onChange);
    expect(observer.start()).toBe(true);

    const wrapper = document.createElement('div');
    wrapper.setAttribute(DOCODE_PAGINATED_POST_ATTRIBUTE, '');
    wrapper.innerHTML =
      '<article data-post-id="42"><div class="cooked">Owned reply</div></article>';
    document.querySelector('.post-stream')?.append(wrapper);
    await nextMutationTurn();

    expect(onChange).not.toHaveBeenCalled();
    observer.stop();
  });

  it('does not observe the whole document when no semantic root exists', () => {
    document.body.innerHTML = '<div>Unrelated page</div>';
    const observer = new LinuxDoViewStateObserver(document, vi.fn());

    expect(observer.start()).toBe(false);
    expect(observer.isStarted).toBe(false);
  });
});

async function nextMutationTurn(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => window.setTimeout(resolve, 0));
}
