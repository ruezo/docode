import { describe, expect, it } from 'vitest';

import {
  createTopicListViewportMemory,
  type TopicListViewportStorage,
} from '../../src/views/topicList/topicListViewportMemory';

const STORAGE_KEY = 'docode:topic-list-viewports';

function memoryStorage(initial: Record<string, string> = {}): TopicListViewportStorage & {
  readonly values: Map<string, string>;
} {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    values,
  };
}

describe('topicListViewportMemory', () => {
  it('tracks per-route offsets in memory and persists them on flush', () => {
    const storage = memoryStorage();
    const memory = createTopicListViewportMemory(storage);

    expect(memory.read('https://linux.do/latest')).toBe(0);
    memory.track('https://linux.do/latest', 240);
    memory.track('https://linux.do/new', 96);
    memory.track('https://linux.do/latest', 512);
    expect(memory.read('https://linux.do/latest')).toBe(512);
    expect(memory.read('https://linux.do/new')).toBe(96);
    expect(storage.values.size).toBe(0);

    memory.flush();
    expect(JSON.parse(storage.values.get(STORAGE_KEY) ?? '[]')).toEqual([
      ['https://linux.do/new', 96],
      ['https://linux.do/latest', 512],
    ]);
  });

  it('hydrates persisted offsets and rejects malformed entries', () => {
    const storage = memoryStorage({
      [STORAGE_KEY]: JSON.stringify([
        ['https://linux.do/latest', 240],
        ['https://linux.do/new', -3],
        ['https://linux.do/hot', 'oops'],
        'garbage',
        ['https://linux.do/top', 64],
      ]),
    });
    const memory = createTopicListViewportMemory(storage);

    expect(memory.read('https://linux.do/latest')).toBe(240);
    expect(memory.read('https://linux.do/top')).toBe(64);
    expect(memory.read('https://linux.do/new')).toBe(0);
    expect(memory.read('https://linux.do/hot')).toBe(0);
  });

  it('survives corrupted payloads and storage failures', () => {
    const corrupted = createTopicListViewportMemory(memoryStorage({ [STORAGE_KEY]: '{not json' }));
    expect(corrupted.read('https://linux.do/latest')).toBe(0);

    const failing: TopicListViewportStorage = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    const memory = createTopicListViewportMemory(failing);
    memory.track('https://linux.do/latest', 128);
    expect(() => {
      memory.flush();
    }).not.toThrow();
    expect(memory.read('https://linux.do/latest')).toBe(128);

    const unavailable = createTopicListViewportMemory(null);
    unavailable.track('https://linux.do/latest', 32);
    unavailable.flush();
    expect(unavailable.read('https://linux.do/latest')).toBe(32);
  });

  it('caps retained routes at the most recent hundred entries', () => {
    const storage = memoryStorage();
    const memory = createTopicListViewportMemory(storage);
    for (let index = 0; index < 105; index += 1) {
      memory.track(`https://linux.do/c/route-${String(index)}`, index);
    }
    memory.flush();

    const persisted = JSON.parse(storage.values.get(STORAGE_KEY) ?? '[]') as [string, number][];
    expect(persisted).toHaveLength(100);
    expect(persisted[0]?.[0]).toBe('https://linux.do/c/route-5');
    expect(persisted.at(-1)?.[0]).toBe('https://linux.do/c/route-104');
    expect(memory.read('https://linux.do/c/route-0')).toBe(0);
    expect(memory.read('https://linux.do/c/route-104')).toBe(104);
  });
});
