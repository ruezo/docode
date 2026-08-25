import { storage } from 'wxt/utils/storage';

export const DEFAULT_BROWSE_HISTORY_LIMIT = 100;
export const MAXIMUM_BROWSE_HISTORY_LIMIT = 1000;

const BROWSE_HISTORY_KINDS = [
  'category-index',
  'search',
  'tag-index',
  'topic',
  'topic-list',
  'user',
] as const;

export type BrowseHistoryKind = (typeof BROWSE_HISTORY_KINDS)[number];

export interface BrowseHistoryEntry {
  readonly kind: BrowseHistoryKind;
  readonly path: string;
  readonly title: string;
  readonly viewId: string;
  readonly visitedAt: number;
  readonly visits: number;
}

export interface BrowseHistoryRecordInput {
  readonly kind: BrowseHistoryKind;
  readonly path: string;
  readonly title: string;
  readonly viewId: string;
  readonly visitedAt: number;
}

export interface BrowseHistoryStore {
  clear(): Promise<readonly BrowseHistoryEntry[]>;
  read(): Promise<readonly BrowseHistoryEntry[]>;
  record(input: BrowseHistoryRecordInput, limit: number): Promise<readonly BrowseHistoryEntry[]>;
  remove(viewId: string): Promise<readonly BrowseHistoryEntry[]>;
}

const browseHistoryItem = storage.defineItem<unknown>('local:workbench.browseHistory', {
  fallback: [],
});

export function normalizeBrowseHistoryLimit(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_BROWSE_HISTORY_LIMIT;
  return Math.round(Math.min(MAXIMUM_BROWSE_HISTORY_LIMIT, Math.max(0, value)));
}

export function applyBrowseHistoryRecord(
  entries: readonly BrowseHistoryEntry[],
  input: BrowseHistoryRecordInput,
  limit: number,
): readonly BrowseHistoryEntry[] {
  const normalizedLimit = normalizeBrowseHistoryLimit(limit);
  if (normalizedLimit === 0) return [];
  const existing = entries.find((entry) => entry.viewId === input.viewId);
  const updated: BrowseHistoryEntry = {
    kind: input.kind,
    path: input.path,
    title: input.title,
    viewId: input.viewId,
    visitedAt: input.visitedAt,
    visits: (existing?.visits ?? 0) + 1,
  };
  return [updated, ...entries.filter((entry) => entry.viewId !== input.viewId)].slice(
    0,
    normalizedLimit,
  );
}

export function readBrowseHistoryEntries(value: unknown): readonly BrowseHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isBrowseHistoryEntry).slice(0, MAXIMUM_BROWSE_HISTORY_LIMIT);
}

export function createBrowseHistoryStore(): BrowseHistoryStore {
  let queue: Promise<readonly BrowseHistoryEntry[]> = Promise.resolve([]);
  const enqueue = (
    mutate: (entries: readonly BrowseHistoryEntry[]) => readonly BrowseHistoryEntry[],
  ): Promise<readonly BrowseHistoryEntry[]> => {
    const step = queue.then(
      () => writeBrowseHistory(mutate),
      () => writeBrowseHistory(mutate),
    );
    queue = step;
    return step;
  };
  return {
    clear: () => enqueue(() => []),
    read: async () => readBrowseHistoryEntries(await browseHistoryItem.getValue()),
    record: (input, limit) => enqueue((entries) => applyBrowseHistoryRecord(entries, input, limit)),
    remove: (viewId) => enqueue((entries) => entries.filter((entry) => entry.viewId !== viewId)),
  };
}

async function writeBrowseHistory(
  mutate: (entries: readonly BrowseHistoryEntry[]) => readonly BrowseHistoryEntry[],
): Promise<readonly BrowseHistoryEntry[]> {
  const entries = mutate(readBrowseHistoryEntries(await browseHistoryItem.getValue()));
  await browseHistoryItem.setValue(entries);
  return entries;
}

function isBrowseHistoryEntry(value: unknown): value is BrowseHistoryEntry {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.kind === 'string' &&
    (BROWSE_HISTORY_KINDS as readonly string[]).includes(candidate.kind) &&
    typeof candidate.path === 'string' &&
    candidate.path.startsWith('/') &&
    !candidate.path.startsWith('//') &&
    typeof candidate.title === 'string' &&
    candidate.title.length > 0 &&
    typeof candidate.viewId === 'string' &&
    candidate.viewId.length > 0 &&
    typeof candidate.visitedAt === 'number' &&
    Number.isFinite(candidate.visitedAt) &&
    typeof candidate.visits === 'number' &&
    Number.isSafeInteger(candidate.visits) &&
    candidate.visits > 0
  );
}
