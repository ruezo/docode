const STORAGE_KEY = 'docode:topic-list-viewports';
const MAXIMUM_ENTRIES = 100;

export type TopicListViewportStorage = Pick<Storage, 'getItem' | 'setItem'>;

export interface TopicListViewportMemory {
  flush(): void;
  read(routeHref: string): number;
  track(routeHref: string, scrollTop: number): void;
}

export function createTopicListViewportMemory(
  storage: TopicListViewportStorage | null,
): TopicListViewportMemory {
  const entries = hydrate(storage);
  return {
    flush() {
      if (!storage) return;
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify([...entries]));
      } catch {
        // Session storage may be full or unavailable; the in-memory map still works.
      }
    },
    read(routeHref) {
      return entries.get(routeHref) ?? 0;
    },
    track(routeHref, scrollTop) {
      entries.delete(routeHref);
      entries.set(routeHref, scrollTop);
      const excess = entries.size - MAXIMUM_ENTRIES;
      if (excess > 0) {
        for (const staleHref of [...entries.keys()].slice(0, excess)) entries.delete(staleHref);
      }
    },
  };
}

export function getTopicListViewportStorage(targetWindow: Window): TopicListViewportStorage | null {
  try {
    return targetWindow.sessionStorage;
  } catch {
    return null;
  }
}

function hydrate(storage: TopicListViewportStorage | null): Map<string, number> {
  if (!storage) return new Map();
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return new Map();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Map();
    const entries = new Map<string, number>();
    for (const entry of parsed) {
      if (
        Array.isArray(entry) &&
        entry.length === 2 &&
        typeof entry[0] === 'string' &&
        typeof entry[1] === 'number' &&
        Number.isFinite(entry[1]) &&
        entry[1] >= 0
      ) {
        entries.set(entry[0], entry[1]);
      }
    }
    return entries;
  } catch {
    return new Map();
  }
}
