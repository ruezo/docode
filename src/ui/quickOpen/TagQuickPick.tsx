import { useCallback, useEffect, useMemo, useState } from 'react';

import type { LinuxDoNavigationOutcome } from '../../linuxdo/navigationAdapter';
import type { LinuxDoTagItem, TagsLoadOutcome } from '../../linuxdo/taxonomyLoader';
import { QuickInput, type QuickInputItem, type QuickInputMessage } from './QuickInput';

const FEATURED_TAG_LIMIT = 12;
const VIEW_ALL_ITEM_ID = 'docode:view-all-tags';

interface TagQuickPickItem extends QuickInputItem {
  readonly tag: LinuxDoTagItem | null;
}

interface TagQuickPickProps {
  readonly onDismiss: () => void;
  readonly onLoadTags: (signal: AbortSignal) => Promise<TagsLoadOutcome>;
  readonly onOpenTag: (
    tag: LinuxDoTagItem,
    signal: AbortSignal,
  ) => Promise<LinuxDoNavigationOutcome>;
}

type TagLoadState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly tags: readonly LinuxDoTagItem[] }
  | { readonly kind: 'unavailable' };

export function TagQuickPick({ onDismiss, onLoadTags, onOpenTag }: TagQuickPickProps) {
  const [loadState, setLoadState] = useState<TagLoadState>({ kind: 'loading' });
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void onLoadTags(controller.signal).then((outcome) => {
      if (controller.signal.aborted || outcome.kind === 'aborted') return;
      setLoadState(
        outcome.kind === 'ready' ? { kind: 'ready', tags: outcome.tags } : { kind: 'unavailable' },
      );
    });
    return () => {
      controller.abort();
    };
  }, [onLoadTags]);

  const tags = useMemo(() => (loadState.kind === 'ready' ? loadState.tags : []), [loadState]);
  const items = useMemo<readonly TagQuickPickItem[]>(
    () => [
      ...tags.map((tag) => ({
        description: tag.count > 0 ? `${String(tag.count)} topics` : '',
        groupLabel: 'tags',
        icon: 'tag' as const,
        id: `tag:${tag.name}`,
        label: tag.name,
        tag,
      })),
      ...(tags.length > FEATURED_TAG_LIMIT && !showAll
        ? [
            {
              description: `${String(tags.length)} tags`,
              groupLabel: 'actions',
              icon: 'list-unordered' as const,
              id: VIEW_ALL_ITEM_ID,
              label: 'View all tags',
              tag: null,
            },
          ]
        : []),
    ],
    [showAll, tags],
  );

  const filterItems = useCallback(
    (allItems: readonly TagQuickPickItem[], query: string): readonly TagQuickPickItem[] => {
      const normalized = query.trim().toLowerCase();
      if (normalized) {
        return allItems.filter((item) =>
          Boolean(item.tag?.name.toLowerCase().includes(normalized)),
        );
      }
      if (showAll) return allItems;
      return allItems.filter((item, index) => item.tag === null || index < FEATURED_TAG_LIMIT);
    },
    [showAll],
  );

  const messages = useMemo<readonly QuickInputMessage[]>(() => {
    if (loadState.kind === 'loading') {
      return [
        { icon: 'loading', spin: true, state: 'tags-loading', text: 'Loading Linux DO tags…' },
      ];
    }
    if (loadState.kind === 'unavailable') {
      return [
        {
          icon: 'error',
          state: 'tags-unavailable',
          text: 'Linux DO tags are unavailable right now.',
        },
      ];
    }
    return [];
  }, [loadState]);

  return (
    <QuickInput
      ariaLabel="Filter by Tag"
      emptyMessage="No matching Linux DO tags."
      filterItems={filterItems}
      initialSelectedId={items[0]?.id ?? null}
      inputAriaLabel="Filter Linux DO tags"
      items={items}
      messages={messages}
      onDismiss={onDismiss}
      onRunItem={async (item, signal) => {
        if (item.tag === null) {
          setShowAll(true);
          return { kind: 'keep-open' };
        }
        let outcome: LinuxDoNavigationOutcome;
        try {
          outcome = await onOpenTag(item.tag, signal);
        } catch {
          outcome = { kind: 'failed' };
        }
        return outcome.kind === 'navigated' || outcome.kind === 'unchanged'
          ? { kind: 'close' }
          : { kind: 'error', message: 'The Linux DO tag list could not be opened.' };
      }}
      placeholder="Filter Linux DO tags"
    />
  );
}
