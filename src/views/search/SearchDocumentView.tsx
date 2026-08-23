import { useEffect, useId, useRef, useState, type MouseEvent, type SyntheticEvent } from 'react';

import type { LinuxDoNavigationOutcome } from '../../linuxdo/navigationAdapter';
import {
  createLinuxDoSearchRoute,
  type LinuxDoSearchOutcome,
  type LinuxDoSearchResult,
  type LinuxDoSearchResultKind,
} from '../../linuxdo/searchAdapter';
import type { LinuxDoRoute } from '../../linuxdo/routes';
import { Codicon } from '../../ui/icons/codicon';

interface SearchDocumentViewProps {
  readonly expectedGeneration: number;
  readonly onNavigate: (
    route: LinuxDoRoute,
    expectedGeneration: number,
    signal: AbortSignal,
  ) => Promise<LinuxDoNavigationOutcome>;
  readonly onSearch: (query: string, signal: AbortSignal) => Promise<LinuxDoSearchOutcome>;
  readonly query: string | null;
}

type SearchDocumentState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading'; readonly query: string }
  | { readonly kind: 'settled'; readonly outcome: LinuxDoSearchOutcome };

const GROUP_ORDER: readonly LinuxDoSearchResultKind[] = ['post', 'category', 'tag', 'user'];

export function SearchDocumentView({ query, ...props }: SearchDocumentViewProps) {
  return <SearchDocument key={query?.trim() ?? ''} query={query} {...props} />;
}

function SearchDocument({
  expectedGeneration,
  onNavigate,
  onSearch,
  query,
}: SearchDocumentViewProps) {
  const normalizedQuery = query?.trim() ?? '';
  const [inputValue, setInputValue] = useState(normalizedQuery);
  const [state, setState] = useState<SearchDocumentState>(() =>
    normalizedQuery ? { kind: 'loading', query: normalizedQuery } : { kind: 'idle' },
  );
  const [navigationError, setNavigationError] = useState<string | null>(null);
  const [navigationPending, setNavigationPending] = useState(false);
  const [pendingResultId, setPendingResultId] = useState<string | null>(null);
  const navigationController = useRef<AbortController | null>(null);
  const resultGroupsId = useId();

  useEffect(() => {
    if (!normalizedQuery) return;
    const controller = new AbortController();
    void onSearch(normalizedQuery, controller.signal).then((outcome) => {
      if (!controller.signal.aborted) setState({ kind: 'settled', outcome });
    });
    return () => {
      controller.abort();
    };
  }, [normalizedQuery, onSearch]);

  useEffect(
    () => () => {
      navigationController.current?.abort();
    },
    [],
  );

  const navigate = async (route: LinuxDoRoute, pendingId: string | null) => {
    if (navigationController.current) return;
    const controller = new AbortController();
    navigationController.current = controller;
    setNavigationPending(true);
    setNavigationError(null);
    setPendingResultId(pendingId);
    let outcome: LinuxDoNavigationOutcome;
    try {
      outcome = await onNavigate(route, expectedGeneration, controller.signal);
    } catch {
      outcome = { kind: 'failed' };
    }
    if (navigationController.current !== controller) return;
    navigationController.current = null;
    setNavigationPending(false);
    setPendingResultId(null);
    if (outcome.kind !== 'navigated' && outcome.kind !== 'unchanged') {
      setNavigationError(navigationErrorMessage(outcome));
    }
  };

  const submitSearch = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const searchRoute = createLinuxDoSearchRoute(inputValue, document);
    if (searchRoute.kind === 'search') void navigate(searchRoute, null);
  };

  const settledResults =
    state.kind === 'settled' && state.outcome.kind === 'results' ? state.outcome : null;
  const resultItems = settledResults?.items ?? [];

  return (
    <>
      <aside
        className="docode-workbench__gutter docode-search-document__gutter"
        aria-label="Gutter slot"
      />
      <section
        aria-label="Editor content slot"
        className="docode-workbench__editor-content"
        id="docode-workbench-editor-content"
      >
        <div className="docode-search-document" data-state={state.kind}>
          <form className="docode-search-document__form" onSubmit={submitSearch} role="search">
            <label className="docode-search-document__label" htmlFor="docode-search-query">
              Search Linux DO
            </label>
            <div className="docode-search-document__input-row">
              <Codicon name="search" />
              <input
                autoCapitalize="none"
                autoComplete="off"
                className="docode-search-document__input"
                id="docode-search-query"
                onChange={(event) => {
                  setInputValue(event.currentTarget.value);
                }}
                placeholder="Search topics, posts, categories, tags, and users"
                spellCheck={false}
                type="search"
                value={inputValue}
              />
              <button
                className="docode-search-document__submit"
                disabled={!inputValue.trim() || navigationPending}
                type="submit"
              >
                Search
              </button>
            </div>
          </form>

          <div aria-live="polite" className="docode-search-document__summary">
            {searchSummary(state, resultItems.length)}
          </div>

          {state.kind === 'loading' ? (
            <DocumentMessage
              icon="loading"
              spin
              text={`Searching Linux DO for “${state.query}”…`}
            />
          ) : state.kind === 'idle' ? (
            <DocumentMessage icon="search" text="Enter a query to search real Linux DO content." />
          ) : state.outcome.kind === 'error' ? (
            <DocumentMessage icon="error" role="alert" text={state.outcome.message} />
          ) : state.outcome.kind === 'aborted' ? null : state.outcome.items.length === 0 ? (
            <DocumentMessage
              icon="info"
              text={`No Linux DO results for “${state.outcome.query}”.`}
            />
          ) : (
            <div
              aria-label="Linux DO search results"
              className="docode-search-document__results"
              role="region"
            >
              {GROUP_ORDER.flatMap((kind) => {
                const items = settledResults?.items.filter((item) => item.kind === kind) ?? [];
                if (items.length === 0) return [];
                const headingId = `${resultGroupsId}-${kind}`;
                return [
                  <section
                    aria-labelledby={headingId}
                    className="docode-search-document__group"
                    key={kind}
                  >
                    <h2 className="docode-search-document__group-title" id={headingId}>
                      <Codicon name={kindIcon(kind)} />
                      <span>{kindLabel(kind)}</span>
                      <span className="docode-search-document__count">{items.length}</span>
                    </h2>
                    <div aria-labelledby={headingId} role="list">
                      {items.map((item) => (
                        <SearchResultRow
                          item={item}
                          key={item.id}
                          onActivate={(event) => {
                            if (!isPrimaryNavigation(event)) return;
                            event.preventDefault();
                            void navigate(item.route, item.id);
                          }}
                          pending={pendingResultId === item.id}
                        />
                      ))}
                    </div>
                  </section>,
                ];
              })}
            </div>
          )}

          {navigationError ? (
            <div className="docode-search-document__navigation-error" role="alert">
              <Codicon name="error" />
              <span>{navigationError}</span>
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}

function SearchResultRow({
  item,
  onActivate,
  pending,
}: {
  readonly item: LinuxDoSearchResult;
  readonly onActivate: (event: MouseEvent<HTMLAnchorElement>) => void;
  readonly pending: boolean;
}) {
  return (
    <div role="listitem">
      <a
        aria-busy={pending}
        className="docode-search-document__result"
        data-kind={item.kind}
        href={item.url}
        onClick={onActivate}
        title={item.url}
      >
        <span className="docode-search-document__result-icon">
          <Codicon name={kindIcon(item.kind)} />
        </span>
        <span className="docode-search-document__result-text">
          <span className="docode-search-document__result-label">{item.label}</span>
          <span className="docode-search-document__result-description">{item.description}</span>
        </span>
        <span className="docode-search-document__result-path">{item.route.pathname}</span>
        {pending ? <Codicon name="loading" spin /> : null}
      </a>
    </div>
  );
}

function DocumentMessage({
  icon,
  role = 'status',
  spin = false,
  text,
}: {
  readonly icon: 'error' | 'info' | 'loading' | 'search';
  readonly role?: 'alert' | 'status';
  readonly spin?: boolean;
  readonly text: string;
}) {
  return (
    <div className="docode-search-document__message" role={role}>
      <Codicon name={icon} spin={spin} />
      <span>{text}</span>
    </div>
  );
}

function searchSummary(state: SearchDocumentState, count: number): string {
  if (state.kind === 'loading') return 'Search in progress';
  if (state.kind === 'idle') return 'Search is ready';
  if (state.outcome.kind !== 'results') return '';
  return `${String(count)} ${count === 1 ? 'result' : 'results'} for “${state.outcome.query}”`;
}

function kindIcon(
  kind: LinuxDoSearchResultKind,
): 'account' | 'comment-discussion' | 'folder' | 'tag' {
  switch (kind) {
    case 'post':
      return 'comment-discussion';
    case 'category':
      return 'folder';
    case 'tag':
      return 'tag';
    case 'user':
      return 'account';
  }
}

function kindLabel(kind: LinuxDoSearchResultKind): string {
  switch (kind) {
    case 'post':
      return 'Posts';
    case 'category':
      return 'Categories';
    case 'tag':
      return 'Tags';
    case 'user':
      return 'Users';
  }
}

function isPrimaryNavigation(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button === 0 && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
}

function navigationErrorMessage(
  outcome: Exclude<LinuxDoNavigationOutcome, { readonly kind: 'navigated' | 'unchanged' }>,
): string {
  switch (outcome.kind) {
    case 'aborted':
      return 'Navigation was cancelled.';
    case 'failed':
      return 'Linux DO navigation was not confirmed.';
    case 'stale':
      return 'The route changed before navigation completed.';
    case 'unavailable':
      return 'Linux DO navigation is unavailable right now.';
  }
}
