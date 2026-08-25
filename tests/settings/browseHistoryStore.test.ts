import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';

import {
  applyBrowseHistoryRecord,
  createBrowseHistoryStore,
  normalizeBrowseHistoryLimit,
  readBrowseHistoryEntries,
  type BrowseHistoryEntry,
  type BrowseHistoryRecordInput,
} from '../../src/settings/browseHistoryStore';

beforeEach(() => {
  fakeBrowser.reset();
});

function input(overrides: Partial<BrowseHistoryRecordInput> = {}): BrowseHistoryRecordInput {
  return {
    kind: 'topic',
    path: '/t/example/42',
    title: 'Example topic',
    viewId: 'topic:42',
    visitedAt: 1_700_000_000_000,
    ...overrides,
  };
}

describe('applyBrowseHistoryRecord', () => {
  it('prepends new entries and moves revisited views to the front with a visit count', () => {
    const first = applyBrowseHistoryRecord([], input(), 100);
    const second = applyBrowseHistoryRecord(
      first,
      input({ kind: 'topic-list', path: '/latest', title: 'Latest topics', viewId: 'list:latest' }),
      100,
    );
    expect(second.map(({ viewId }) => viewId)).toEqual(['list:latest', 'topic:42']);

    const third = applyBrowseHistoryRecord(
      second,
      input({ title: 'Example topic (updated)', visitedAt: 1_700_000_100_000 }),
      100,
    );
    expect(third.map(({ viewId }) => viewId)).toEqual(['topic:42', 'list:latest']);
    expect(third[0]).toMatchObject({
      title: 'Example topic (updated)',
      visitedAt: 1_700_000_100_000,
      visits: 2,
    });
  });

  it('caps the list at the configured limit and empties it when the limit is 0', () => {
    let entries: readonly BrowseHistoryEntry[] = [];
    for (let index = 0; index < 5; index += 1) {
      entries = applyBrowseHistoryRecord(
        entries,
        input({ path: `/t/example/${String(index)}`, viewId: `topic:${String(index)}` }),
        3,
      );
    }
    expect(entries.map(({ viewId }) => viewId)).toEqual(['topic:4', 'topic:3', 'topic:2']);
    expect(applyBrowseHistoryRecord(entries, input(), 0)).toEqual([]);
  });
});

describe('normalizeBrowseHistoryLimit', () => {
  it('clamps to 0..1000 and falls back to 100 for invalid numbers', () => {
    expect(normalizeBrowseHistoryLimit(-1)).toBe(0);
    expect(normalizeBrowseHistoryLimit(0)).toBe(0);
    expect(normalizeBrowseHistoryLimit(100.4)).toBe(100);
    expect(normalizeBrowseHistoryLimit(4000)).toBe(1000);
    expect(normalizeBrowseHistoryLimit(Number.NaN)).toBe(100);
  });
});

describe('readBrowseHistoryEntries', () => {
  it('drops malformed stored values instead of failing', () => {
    const valid = applyBrowseHistoryRecord([], input(), 100)[0];
    expect(
      readBrowseHistoryEntries([
        valid,
        null,
        'text',
        { ...valid, path: 'https://evil.example/steal' },
        { ...valid, path: '//evil.example' },
        { ...valid, title: '' },
        { ...valid, visits: 0 },
        { ...valid, kind: 'unsupported' },
      ]),
    ).toEqual([valid]);
    expect(readBrowseHistoryEntries('not-an-array')).toEqual([]);
  });
});

describe('createBrowseHistoryStore', () => {
  it('persists records across store instances and supports remove and clear', async () => {
    const store = createBrowseHistoryStore();
    await store.record(input(), 100);
    await store.record(
      input({
        kind: 'search',
        path: '/search?q=docode',
        title: 'Search: docode',
        viewId: 'search:docode',
      }),
      100,
    );

    const reloaded = createBrowseHistoryStore();
    await expect(reloaded.read()).resolves.toMatchObject([
      { viewId: 'search:docode' },
      { viewId: 'topic:42' },
    ]);

    await expect(reloaded.remove('topic:42')).resolves.toMatchObject([{ viewId: 'search:docode' }]);
    await expect(reloaded.clear()).resolves.toEqual([]);
    await expect(reloaded.read()).resolves.toEqual([]);
  });
});
