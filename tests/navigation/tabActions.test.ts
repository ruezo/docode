import { describe, expect, it } from 'vitest';

import { recognizeLinuxDoRoute } from '../../src/linuxdo/routes';
import { createOpenViewState, openWorkbenchView } from '../../src/navigation/openViewState';
import {
  getTabActionNavigationTarget,
  isTabActionAvailable,
} from '../../src/navigation/tabActions';

describe('tab actions', () => {
  it('exposes only actions supported by real view and recovery state', () => {
    let state = createOpenViewState(recognizeLinuxDoRoute('https://linux.do/latest'));
    state = openWorkbenchView(
      state,
      recognizeLinuxDoRoute('https://linux.do/t/synthetic-topic/42'),
    );

    expect(isTabActionAvailable(state, 'copy-topic-link', 'list:latest', true)).toBe(false);
    expect(isTabActionAvailable(state, 'copy-topic-link', 'topic:42', true)).toBe(true);
    expect(isTabActionAvailable(state, 'open-original-view', 'topic:42', false)).toBe(false);
    expect(isTabActionAvailable(state, 'open-original-view', 'topic:42', true)).toBe(true);
    expect(isTabActionAvailable(state, 'close-right', 'topic:42', true)).toBe(false);
    expect(isTabActionAvailable(state, 'close-others', 'topic:42', true)).toBe(true);
  });

  it('requests real navigation only when a close would invalidate the address-backed view', () => {
    let state = createOpenViewState(recognizeLinuxDoRoute('https://linux.do/latest'));
    state = openWorkbenchView(state, recognizeLinuxDoRoute('https://linux.do/hot'));
    state = openWorkbenchView(state, recognizeLinuxDoRoute('https://linux.do/top'));

    expect(getTabActionNavigationTarget(state, 'close', 'list:latest')).toBeNull();
    expect(getTabActionNavigationTarget(state, 'close', 'list:top')?.id).toBe('list:hot');
    expect(getTabActionNavigationTarget(state, 'close-others', 'list:hot')?.id).toBe('list:hot');
    expect(getTabActionNavigationTarget(state, 'close-right', 'list:hot')?.id).toBe('list:hot');
  });
});
