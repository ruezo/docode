import { useEffect, useMemo, useState } from 'react';

import type { LinuxDoNavigationOutcome } from '../../linuxdo/navigationAdapter';
import type { LinuxDoSearchOutcome } from '../../linuxdo/searchAdapter';
import {
  createSearchQuickOpenItems,
  filterQuickOpenItems,
  type QuickOpenCollection,
  type QuickOpenItem,
} from '../../quickOpen/quickOpenModel';
import { QuickInput, type QuickInputMessage } from './QuickInput';

interface QuickOpenProps {
  readonly collection: QuickOpenCollection;
  readonly onDismiss: () => void;
  readonly onOpenItem: (
    item: QuickOpenItem,
    signal: AbortSignal,
  ) => Promise<LinuxDoNavigationOutcome>;
  readonly onSearch: (query: string, signal: AbortSignal) => Promise<LinuxDoSearchOutcome>;
}

type RemoteSearchState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading'; readonly query: string }
  | { readonly kind: 'settled'; readonly outcome: LinuxDoSearchOutcome };

const SEARCH_DEBOUNCE_MILLISECONDS = 250;
const IDLE_REMOTE_SEARCH_STATE: RemoteSearchState = { kind: 'idle' };

export function QuickOpen({ collection, onDismiss, onOpenItem, onSearch }: QuickOpenProps) {
  const [query, setQuery] = useState('');
  const [remoteState, setRemoteState] = useState<RemoteSearchState>(IDLE_REMOTE_SEARCH_STATE);

  useEffect(() => {
    const normalized = query.trim();
    if (!normalized) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setRemoteState({ kind: 'loading', query: normalized });
      void onSearch(normalized, controller.signal).then((outcome) => {
        if (!controller.signal.aborted) setRemoteState({ kind: 'settled', outcome });
      });
    }, SEARCH_DEBOUNCE_MILLISECONDS);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [onSearch, query]);

  const activeRemoteState = remoteStateMatchesQuery(remoteState, query)
    ? remoteState
    : IDLE_REMOTE_SEARCH_STATE;

  const items = useMemo(() => {
    const remoteItems =
      activeRemoteState.kind === 'settled' && activeRemoteState.outcome.kind === 'results'
        ? createSearchQuickOpenItems(activeRemoteState.outcome.items, collection.items)
        : [];
    return [...collection.items, ...remoteItems];
  }, [activeRemoteState, collection.items]);
  const messages = [...createTopicMessages(collection), ...createSearchMessages(activeRemoteState)];

  return (
    <QuickInput
      ariaLabel="Quick Open"
      emptyMessage="No matching open views, loaded topics, or Linux DO results."
      filterItems={filterQuickOpenItems}
      getItemMeta={(item) => (item.active ? 'Active' : null)}
      getItemState={(item) => item.readState}
      initialSelectedId={collection.items.find(({ active }) => active)?.id ?? null}
      inputAriaLabel="Search open views, loaded topics, and Linux DO"
      items={items}
      messages={messages}
      onDismiss={onDismiss}
      onQueryChange={setQuery}
      onRunItem={async (item, signal) => {
        let outcome: LinuxDoNavigationOutcome;
        try {
          outcome = await onOpenItem(item, signal);
        } catch {
          outcome = { kind: 'failed' };
        }
        return outcome.kind === 'navigated' || outcome.kind === 'unchanged'
          ? { kind: 'close' }
          : { kind: 'error', message: navigationError(outcome) };
      }}
      placeholder="Search open views, loaded topics, and Linux DO"
    />
  );
}

function remoteStateMatchesQuery(state: RemoteSearchState, rawQuery: string): boolean {
  const query = rawQuery.trim();
  if (!query) return state.kind === 'idle';
  if (state.kind === 'idle') return false;
  return state.kind === 'loading' ? state.query === query : state.outcome.query === query;
}

function createSearchMessages(state: RemoteSearchState): readonly QuickInputMessage[] {
  if (state.kind === 'idle') return [];
  if (state.kind === 'loading') {
    return [
      {
        icon: 'loading',
        spin: true,
        state: 'search-loading',
        text: `Searching Linux DO for “${state.query}”…`,
      },
    ];
  }
  if (state.outcome.kind === 'error') {
    return [{ icon: 'error', state: state.outcome.code, text: state.outcome.message }];
  }
  if (state.outcome.kind === 'results' && state.outcome.items.length === 0) {
    return [
      {
        state: 'search-empty',
        text: `Linux DO returned no results for “${state.outcome.query}”.`,
      },
    ];
  }
  return [];
}

function createTopicMessages(collection: QuickOpenCollection): readonly QuickInputMessage[] {
  if (!collection.topicMessage) return [];
  const message = {
    state: collection.topicState,
    text: collection.topicMessage,
  };
  if (collection.topicState === 'loading') {
    return [{ ...message, icon: 'loading', spin: true }];
  }
  if (collection.topicState === 'error') return [{ ...message, icon: 'error' }];
  return [message];
}

function navigationError(
  outcome: Exclude<LinuxDoNavigationOutcome, { readonly kind: 'navigated' | 'unchanged' }>,
): string {
  switch (outcome.kind) {
    case 'aborted':
      return 'Opening was cancelled.';
    case 'failed':
      return 'Linux DO navigation was not confirmed.';
    case 'stale':
      return 'The route changed before this item could open.';
    case 'unavailable':
      return 'Linux DO navigation is unavailable right now.';
  }
}
