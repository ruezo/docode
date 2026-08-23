import { describe, expect, it } from 'vitest';

import {
  applyWorkbenchPresentationMode,
  createWorkbenchModeState,
  getTopicReadingMode,
  getWorkbenchPresentationMode,
  pruneWorkbenchModeState,
} from '../../src/ui/workbench/workbenchMode';

describe('workbench mode state', () => {
  it('retains Code and Doc presentation by stable view identity', () => {
    const initial = createWorkbenchModeState();
    const topicDoc = applyWorkbenchPresentationMode(initial, 'doc', 'topic:42', true);
    if (!topicDoc) throw new Error('Expected Doc mode to be available');

    expect(getWorkbenchPresentationMode(topicDoc, 'topic:42')).toBe('doc');
    expect(getWorkbenchPresentationMode(topicDoc, 'list:latest')).toBe('code');
    expect(getTopicReadingMode(topicDoc, 'topic:42')).toBe('doc');

    const code = applyWorkbenchPresentationMode(topicDoc, 'code', 'topic:42', true);
    if (!code) throw new Error('Expected Code mode to be available');
    expect(getWorkbenchPresentationMode(code, 'topic:42')).toBe('code');
  });

  it('rejects Doc outside a ready topic and prunes closed view state', () => {
    const initial = createWorkbenchModeState();
    expect(applyWorkbenchPresentationMode(initial, 'doc', 'list:latest', false)).toBeNull();
    const first = applyWorkbenchPresentationMode(initial, 'doc', 'topic:42', true);
    if (!first) throw new Error('Expected Doc mode to be available');
    const second = applyWorkbenchPresentationMode(first, 'doc', 'topic:99', true);
    if (!second) throw new Error('Expected Doc mode to be available');

    const pruned = pruneWorkbenchModeState(second, new Set(['topic:99']));
    expect(pruned.topicModes).toEqual({ 'topic:99': 'doc' });
  });
});
