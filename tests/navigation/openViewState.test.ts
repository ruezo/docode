import { describe, expect, it } from 'vitest';

import { recognizeLinuxDoRoute } from '../../src/linuxdo/routes';
import {
  activateWorkbenchView,
  closeOtherWorkbenchViews,
  closeWorkbenchView,
  closeWorkbenchViewsToRight,
  createOpenViewState,
  getCloseFallbackView,
  getOpenViewId,
  openWorkbenchView,
  updateWorkbenchViewEvidence,
} from '../../src/navigation/openViewState';

describe('open-view state', () => {
  it.each([
    ['https://linux.do/latest', 'list:latest'],
    ['https://linux.do/hot', 'list:hot'],
    ['https://linux.do/top?period=weekly', 'list:top'],
    ['https://linux.do/c/resource/cloud-asset/94', 'list:category:94'],
    ['https://linux.do/tag/openai/4', 'list:tag:openai'],
    ['https://linux.do/search?q=codex', 'search:codex'],
    ['https://linux.do/u/synthetic-user/activity/topics', 'user:synthetic-user:activity/topics'],
    ['https://linux.do/t/synthetic-topic/42', 'topic:42'],
    ['https://linux.do/t/renamed-topic/42/19', 'topic:42'],
  ] as const)('derives stable real-view identity for %s', (href, expected) => {
    expect(getOpenViewId(recognizeLinuxDoRoute(href))).toBe(expected);
  });

  it('opens in stable order and activates an existing identity without duplicating it', () => {
    const latest = recognizeLinuxDoRoute('https://linux.do/latest');
    const topic = recognizeLinuxDoRoute('https://linux.do/t/synthetic-topic/42');
    const search = recognizeLinuxDoRoute('https://linux.do/search?q=codex');
    let state = createOpenViewState(latest);

    state = openWorkbenchView(state, topic);
    state = openWorkbenchView(state, search);
    state = openWorkbenchView(
      state,
      recognizeLinuxDoRoute('https://linux.do/t/renamed-topic/42/7'),
    );

    expect(state.openViews.map(({ id }) => id)).toEqual([
      'list:latest',
      'topic:42',
      'search:codex',
    ]);
    expect(state.activeViewId).toBe('topic:42');
    expect(state.openViews[1]?.route.href).toBe('https://linux.do/t/renamed-topic/42/7');

    state = activateWorkbenchView(state, 'list:latest');
    expect(state.activeViewId).toBe('list:latest');
    expect(activateWorkbenchView(state, 'missing')).toBe(state);
  });

  it('closes inactive views in place and chooses the right neighbor before the left', () => {
    let state = createOpenViewState(recognizeLinuxDoRoute('https://linux.do/latest'));
    state = openWorkbenchView(state, recognizeLinuxDoRoute('https://linux.do/hot'));
    state = openWorkbenchView(state, recognizeLinuxDoRoute('https://linux.do/top'));
    state = activateWorkbenchView(state, 'list:hot');

    expect(getCloseFallbackView(state, 'list:hot')?.id).toBe('list:top');
    state = closeWorkbenchView(state, 'list:hot');
    expect(state.openViews.map(({ id }) => id)).toEqual(['list:latest', 'list:top']);
    expect(state.activeViewId).toBe('list:top');

    state = closeWorkbenchView(state, 'list:latest');
    expect(state.openViews.map(({ id }) => id)).toEqual(['list:top']);
    expect(closeWorkbenchView(state, 'list:top')).toBe(state);
  });

  it('shows unread and dirty state only from explicit Linux DO evidence', () => {
    const topic = recognizeLinuxDoRoute('https://linux.do/t/synthetic-topic/42');
    let state = createOpenViewState(topic);
    expect(state.openViews[0]).toMatchObject({
      dirty: false,
      dirtySource: null,
      readState: 'unknown',
      readStateSource: null,
    });

    state = openWorkbenchView(state, topic, {
      read: { source: 'topic-list', state: 'unread' },
    });
    expect(state.openViews[0]).toMatchObject({
      dirty: false,
      dirtySource: null,
      readState: 'unread',
      readStateSource: 'topic-list',
    });

    state = openWorkbenchView(state, topic, {
      draft: { dirty: true, source: 'native-composer' },
    });
    expect(state.openViews[0]).toMatchObject({
      dirty: true,
      dirtySource: 'native-composer',
      readState: 'unread',
      readStateSource: 'topic-list',
    });

    state = openWorkbenchView(state, topic, {
      draft: { dirty: false, source: 'native-composer' },
      read: { source: 'topic-list', state: 'read' },
    });
    expect(state.openViews[0]).toMatchObject({
      dirty: false,
      dirtySource: 'native-composer',
      readState: 'read',
      readStateSource: 'topic-list',
    });

    const listState = createOpenViewState(recognizeLinuxDoRoute('https://linux.do/latest'), {
      draft: { dirty: true, source: 'native-composer' },
      read: { source: 'topic-list', state: 'unread' },
    });
    expect(listState.openViews[0]).toMatchObject({ dirty: false, readState: 'unknown' });
  });

  it('updates a background topic dirty state without activating or creating a view', () => {
    const first = recognizeLinuxDoRoute('https://linux.do/t/first/41');
    const second = recognizeLinuxDoRoute('https://linux.do/t/second/42');
    let state = createOpenViewState(first);
    state = openWorkbenchView(state, second);

    const updated = updateWorkbenchViewEvidence(state, 'topic:41', {
      draft: { dirty: true, source: 'native-composer' },
    });

    expect(updated.activeViewId).toBe('topic:42');
    expect(updated.openViews.find(({ id }) => id === 'topic:41')).toMatchObject({
      dirty: true,
      dirtySource: 'native-composer',
    });
    expect(
      updateWorkbenchViewEvidence(updated, 'topic:99', {
        draft: { dirty: true, source: 'native-composer' },
      }),
    ).toBe(updated);
  });

  it('closes other views or views to the right without inventing a replacement', () => {
    let state = createOpenViewState(recognizeLinuxDoRoute('https://linux.do/latest'));
    state = openWorkbenchView(state, recognizeLinuxDoRoute('https://linux.do/hot'));
    state = openWorkbenchView(state, recognizeLinuxDoRoute('https://linux.do/top'));

    const rightClosed = closeWorkbenchViewsToRight(state, 'list:hot');
    expect(rightClosed.openViews.map(({ id }) => id)).toEqual(['list:latest', 'list:hot']);
    expect(rightClosed.activeViewId).toBe('list:hot');
    expect(closeWorkbenchViewsToRight(rightClosed, 'list:hot')).toBe(rightClosed);

    const othersClosed = closeOtherWorkbenchViews(state, 'list:latest');
    expect(othersClosed).toEqual({
      activeViewId: 'list:latest',
      openViews: [state.openViews[0]],
    });
    expect(closeOtherWorkbenchViews(othersClosed, 'missing')).toBe(othersClosed);
  });

  it('keeps only the current transient index or unsupported view', () => {
    let state = createOpenViewState(recognizeLinuxDoRoute('https://linux.do/latest'));
    state = openWorkbenchView(state, recognizeLinuxDoRoute('https://linux.do/unknown'));
    expect(state.openViews.map(({ id, retention }) => ({ id, retention }))).toEqual([
      { id: 'list:latest', retention: 'persistent' },
      { id: 'unsupported:https%3A%2F%2Flinux.do%2Funknown', retention: 'transient' },
    ]);

    state = openWorkbenchView(state, recognizeLinuxDoRoute('https://linux.do/tags'));
    expect(state.openViews.map(({ id }) => id)).toEqual(['list:latest', 'tag-index']);

    state = openWorkbenchView(state, recognizeLinuxDoRoute('https://linux.do/search?q=codex'));
    expect(state.openViews.map(({ id }) => id)).toEqual(['list:latest', 'search:codex']);
  });
});
