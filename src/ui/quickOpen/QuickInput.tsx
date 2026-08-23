import { useEffect, useId, useMemo, useRef, useState } from 'react';

import type { CodiconName } from '../icons/codicon';
import { Codicon } from '../icons/codicon';

export interface QuickInputItem {
  readonly description: string;
  readonly groupLabel: string;
  readonly icon: CodiconName;
  readonly id: string;
  readonly label: string;
}

export interface QuickInputMessage {
  readonly icon?: CodiconName;
  readonly spin?: boolean;
  readonly state: string;
  readonly text: string;
}

export type QuickInputRunResult =
  | { readonly kind: 'close' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'keep-open' };

interface QuickInputProps<Item extends QuickInputItem> {
  readonly ariaLabel: string;
  readonly className?: string;
  readonly emptyMessage: string;
  readonly filterItems: (items: readonly Item[], query: string) => readonly Item[];
  readonly getItemMeta?: (item: Item) => string | null;
  readonly getItemState?: (item: Item) => string | null;
  readonly initialSelectedId?: string | null;
  readonly initialQuery?: string;
  readonly inputAriaLabel: string;
  readonly items: readonly Item[];
  readonly messages?: readonly QuickInputMessage[];
  readonly onDismiss: () => void;
  readonly onQueryChange?: (query: string) => void;
  readonly onRunItem: (item: Item, signal: AbortSignal) => Promise<QuickInputRunResult>;
  readonly placeholder: string;
  readonly prefix?: string;
}

export function QuickInput<Item extends QuickInputItem>({
  ariaLabel,
  className,
  emptyMessage,
  filterItems,
  getItemMeta,
  getItemState,
  initialSelectedId = null,
  initialQuery = '',
  inputAriaLabel,
  items,
  messages = [],
  onDismiss,
  onQueryChange,
  onRunItem,
  placeholder,
  prefix,
}: QuickInputProps<Item>) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const [selectedId, setSelectedId] = useState(() => initialSelectedId ?? items[0]?.id ?? null);
  const activeController = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = `${useId()}-list`;
  const visibleItems = useMemo(() => filterItems(items, query), [filterItems, items, query]);
  const selectedItem = visibleItems.find(({ id }) => id === selectedId) ?? visibleItems[0] ?? null;
  const selectedIndex = selectedItem
    ? visibleItems.findIndex(({ id }) => id === selectedItem.id)
    : -1;

  useEffect(() => {
    input.current?.focus();
    const dismissOnBlur = () => {
      onDismiss();
    };
    window.addEventListener('blur', dismissOnBlur);
    return () => {
      window.removeEventListener('blur', dismissOnBlur);
      activeController.current?.abort();
    };
  }, [onDismiss]);

  const moveSelection = (targetIndex: number) => {
    if (visibleItems.length === 0) return;
    const normalized = (targetIndex + visibleItems.length) % visibleItems.length;
    const item = visibleItems[normalized];
    if (!item) return;
    setSelectedId(item.id);
    window.requestAnimationFrame(() => {
      const element = document.getElementById(`${listId}-${String(normalized)}`);
      if (!element) return;
      const scrollIntoView: unknown = Reflect.get(element, 'scrollIntoView');
      if (typeof scrollIntoView === 'function') {
        Reflect.apply(scrollIntoView, element, [{ block: 'nearest' }]);
      }
    });
  };

  const runItem = async (item: Item | null) => {
    if (!item || pending || activeController.current) return;
    const controller = new AbortController();
    activeController.current = controller;
    setError(null);
    setPending(true);
    let result: QuickInputRunResult;
    try {
      result = await onRunItem(item, controller.signal);
    } catch {
      result = { kind: 'error', message: 'The selected action failed unexpectedly.' };
    }
    if (activeController.current !== controller) return;
    activeController.current = null;
    setPending(false);
    if (result.kind === 'close') {
      onDismiss();
    } else if (result.kind === 'error') {
      setError(result.message);
    }
  };

  return (
    <div
      className="docode-quick-open__overlay"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onDismiss();
      }}
    >
      <section
        aria-busy={pending}
        aria-label={ariaLabel}
        aria-modal="true"
        className={`docode-quick-open${className ? ` ${className}` : ''}`}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            activeController.current?.abort();
            onDismiss();
            return;
          }
          if (event.key === 'Tab') {
            event.preventDefault();
            input.current?.focus();
          }
        }}
        role="dialog"
      >
        <div className="docode-quick-open__header" data-has-prefix={prefix ? 'true' : undefined}>
          {prefix ? (
            <span aria-hidden="true" className="docode-quick-open__prefix">
              {prefix}
            </span>
          ) : null}
          <input
            aria-activedescendant={
              selectedItem && selectedIndex >= 0 ? `${listId}-${String(selectedIndex)}` : undefined
            }
            aria-autocomplete="list"
            aria-controls={listId}
            aria-disabled={pending}
            aria-expanded="true"
            aria-label={inputAriaLabel}
            autoCapitalize="none"
            autoComplete="off"
            className="docode-quick-open__input"
            onChange={(event) => {
              const nextQuery = event.currentTarget.value;
              setQuery(nextQuery);
              onQueryChange?.(nextQuery);
              setError(null);
              setSelectedId(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                moveSelection(selectedIndex + 1);
              } else if (event.key === 'ArrowUp') {
                moveSelection(selectedIndex <= 0 ? visibleItems.length - 1 : selectedIndex - 1);
              } else if (event.key === 'Home') {
                moveSelection(0);
              } else if (event.key === 'End') {
                moveSelection(visibleItems.length - 1);
              } else if (event.key === 'Enter') {
                void runItem(selectedItem);
              } else {
                return;
              }
              event.preventDefault();
            }}
            placeholder={placeholder}
            readOnly={pending}
            ref={input}
            role="combobox"
            spellCheck={false}
            type="text"
            value={query}
          />
          <span aria-live="polite" className="docode-quick-open__count docode-sr-only">
            {visibleItems.length} {visibleItems.length === 1 ? 'result' : 'results'}
          </span>
        </div>
        <div className="docode-quick-open__list" id={listId} role="listbox">
          {visibleItems.length > 0 ? (
            groupItems(visibleItems).map((group) => (
              <div
                aria-label={group.label}
                className="docode-quick-open__group"
                key={group.label}
                role="group"
              >
                <div aria-hidden="true" className="docode-quick-open__group-label">
                  {group.label}
                </div>
                {group.items.map((item) => {
                  const index = visibleItems.findIndex(({ id }) => id === item.id);
                  const selected = item.id === selectedItem?.id;
                  const meta = getItemMeta?.(item) ?? null;
                  return (
                    <button
                      aria-selected={selected}
                      className="docode-quick-open__item"
                      data-read-state={getItemState?.(item) ?? undefined}
                      data-selected={selected ? 'true' : undefined}
                      disabled={pending}
                      id={`${listId}-${String(index)}`}
                      key={item.id}
                      onClick={() => {
                        setSelectedId(item.id);
                        void runItem(item);
                      }}
                      onMouseDown={(event) => {
                        event.preventDefault();
                      }}
                      onMouseEnter={() => {
                        setSelectedId(item.id);
                      }}
                      role="option"
                      tabIndex={-1}
                      type="button"
                    >
                      <span className="docode-quick-open__item-icon">
                        <Codicon name={item.icon} />
                      </span>
                      <span className="docode-quick-open__item-text">
                        <span className="docode-quick-open__item-label">
                          <HighlightedText query={query} text={item.label} />
                        </span>
                        <span className="docode-quick-open__item-description">
                          <HighlightedText query={query} text={item.description} />
                        </span>
                      </span>
                      {meta ? <span className="docode-quick-open__item-meta">{meta}</span> : null}
                      {pending && selected ? <Codicon name="loading" spin /> : null}
                    </button>
                  );
                })}
              </div>
            ))
          ) : (
            <div className="docode-quick-open__message" role="status">
              {emptyMessage}
            </div>
          )}
          {messages.map((message) => (
            <div
              className="docode-quick-open__message"
              data-state={message.state}
              key={`${message.state}:${message.text}`}
              role="status"
            >
              {message.icon ? (
                message.spin ? (
                  <Codicon name={message.icon} spin />
                ) : (
                  <Codicon name={message.icon} />
                )
              ) : null}
              <span>{message.text}</span>
            </div>
          ))}
        </div>
        {error ? (
          <div className="docode-quick-open__error" role="alert">
            {error}
          </div>
        ) : null}
      </section>
    </div>
  );
}

interface QuickInputGroup<Item extends QuickInputItem> {
  readonly items: readonly Item[];
  readonly label: string;
}

function groupItems<Item extends QuickInputItem>(
  items: readonly Item[],
): readonly QuickInputGroup<Item>[] {
  const groups: QuickInputGroup<Item>[] = [];
  for (const item of items) {
    const current = groups.at(-1);
    if (current?.label === item.groupLabel) {
      groups[groups.length - 1] = { ...current, items: [...current.items, item] };
    } else {
      groups.push({ items: [item], label: item.groupLabel });
    }
  }
  return groups;
}

function HighlightedText({ query, text }: { readonly query: string; readonly text: string }) {
  const normalized = query.trim().toLowerCase();
  const index = normalized ? text.toLowerCase().indexOf(normalized) : -1;
  if (index < 0) return text;
  const before = text.slice(0, index);
  const match = text.slice(index, index + normalized.length);
  const after = text.slice(index + normalized.length);
  return (
    <>
      {before}
      <strong>{match}</strong>
      {after}
    </>
  );
}
