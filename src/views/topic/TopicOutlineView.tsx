import {
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';

import { Codicon } from '../../ui/icons/codicon';
import type { TopicMinimapRange, TopicOutlineEntry, TopicOutlineModel } from './topicOverviewModel';

interface TopicOutlineViewProps {
  readonly model: TopicOutlineModel | null;
  readonly onNavigatePost: (postId: number) => void;
  readonly onSelectPost: (postId: number) => void;
  readonly range: TopicMinimapRange | null;
}

interface OutlineTreeItem {
  readonly decoration: string | null;
  readonly description: string | null;
  readonly expandable: boolean;
  readonly expanded: boolean;
  readonly href: string;
  readonly id: string;
  readonly kind: 'heading' | 'post';
  readonly label: string;
  readonly level: 1 | 2;
  readonly parentId: string | null;
  readonly postId: number;
  readonly postNumber: number;
}

interface OutlineExpansionState {
  readonly collapsedPostIds: ReadonlySet<string>;
  readonly topicId: number | null;
}

export function TopicOutlineView({
  model,
  onNavigatePost,
  onSelectPost,
  range,
}: TopicOutlineViewProps) {
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [expansion, setExpansion] = useState<OutlineExpansionState>({
    collapsedPostIds: new Set(),
    topicId: null,
  });
  const [treeFocused, setTreeFocused] = useState(false);
  const tree = useRef<HTMLDivElement>(null);
  const topicId = model?.state === 'ready' ? (model.topic?.id ?? null) : null;
  const collapsedPostIds =
    expansion.topicId === topicId ? expansion.collapsedPostIds : new Set<string>();
  const items = model?.state === 'ready' ? createTreeItems(model.entries, collapsedPostIds) : [];
  const currentPostItemId =
    model?.state === 'ready' && model.currentPosition
      ? `post:${String(model.currentPosition.postId)}`
      : null;
  const validFocusedId = items.some(({ id }) => id === focusedId) ? focusedId : null;
  const tabStopId =
    (treeFocused ? validFocusedId : currentPostItemId) ?? validFocusedId ?? items[0]?.id ?? null;
  const selectedId = treeFocused ? tabStopId : currentPostItemId;
  const togglePost = (postId: string) => {
    setExpansion((current) => {
      const collapsed = new Set(current.topicId === topicId ? current.collapsedPostIds : []);
      if (collapsed.has(postId)) collapsed.delete(postId);
      else collapsed.add(postId);
      return { collapsedPostIds: collapsed, topicId };
    });
  };

  useLayoutEffect(() => {
    if (treeFocused || !currentPostItemId) return;
    const currentItem = Array.from(
      tree.current?.querySelectorAll<HTMLAnchorElement>('[role="treeitem"]') ?? [],
    ).find(({ dataset }) => dataset.treeItemId === currentPostItemId);
    if (currentItem) scrollTreeItemIntoView(currentItem);
  }, [currentPostItemId, items.length, treeFocused]);

  if (!model || model.state === 'loading') {
    return <OutlineMessage label="Loading topic outline…" state="loading" />;
  }
  if (model.state === 'error') {
    return <OutlineMessage label="Topic outline unavailable." state="error" />;
  }
  if (model.entries.length === 0) {
    return <OutlineMessage label="No loaded posts to outline." state="empty" />;
  }

  return (
    <div className="docode-topic-outline" data-state="ready">
      {range?.before === 'not-loaded' ? (
        <div className="docode-topic-outline__range" role="status">
          Earlier posts are not loaded.
        </div>
      ) : null}
      <div
        aria-label={`Outline for ${model.topic?.title ?? 'topic'}`}
        className="docode-topic-outline__tree"
        onBlurCapture={(event) => {
          if (!containsRelatedTarget(event)) setTreeFocused(false);
        }}
        onFocusCapture={() => {
          setTreeFocused(true);
        }}
        ref={tree}
        role="tree"
      >
        {items.map((item) => (
          <a
            aria-current={
              item.kind === 'post' && item.id === currentPostItemId ? 'location' : undefined
            }
            aria-label={treeItemAriaLabel(item)}
            aria-level={item.level}
            aria-expanded={item.expandable ? item.expanded : undefined}
            className="docode-topic-outline__item"
            data-kind={item.kind}
            data-parent-id={item.parentId ?? undefined}
            data-selected={item.id === selectedId ? 'true' : undefined}
            data-tree-item-id={item.id}
            href={item.href}
            key={item.id}
            onClick={(event) => {
              if (item.expandable && isTwistieTarget(event.target)) {
                event.preventDefault();
                togglePost(item.id);
                return;
              }
              if (isPrimaryNavigation(event)) onNavigatePost(item.postId);
            }}
            onFocus={() => {
              setFocusedId(item.id);
              onSelectPost(item.postId);
            }}
            onKeyDown={(event) => {
              moveTreeFocus(event, item, () => {
                togglePost(item.id);
              });
            }}
            role="treeitem"
            tabIndex={item.id === tabStopId ? 0 : -1}
            title={treeItemAriaLabel(item)}
          >
            <span className="docode-topic-outline__indent" />
            <span className="docode-topic-outline__twistie" data-outline-twistie="true">
              {item.expandable ? (
                <Codicon name={item.expanded ? 'chevron-down' : 'chevron-right'} />
              ) : null}
            </span>
            <span className={`docode-topic-outline__icon docode-topic-outline__icon--${item.kind}`}>
              <Codicon name={item.kind === 'post' ? 'symbol-method' : 'symbol-field'} />
            </span>
            <span className="docode-topic-outline__label">{item.label}</span>
            {item.description ? (
              <span className="docode-topic-outline__description">{item.description}</span>
            ) : null}
            {item.decoration ? (
              <span className="docode-topic-outline__decoration">{item.decoration}</span>
            ) : null}
          </a>
        ))}
      </div>
      {range?.after === 'loading' ? (
        <div className="docode-topic-outline__range" role="status">
          Loading additional posts…
        </div>
      ) : null}
    </div>
  );
}

function OutlineMessage({
  label,
  state,
}: {
  readonly label: string;
  readonly state: 'empty' | 'error' | 'loading';
}) {
  return (
    <div className="docode-topic-outline__message" data-state={state} role="status">
      {state === 'loading' ? <Codicon name="loading" spin /> : null}
      <span>{label}</span>
    </div>
  );
}

function createTreeItems(
  entries: readonly TopicOutlineEntry[],
  collapsedPostIds: ReadonlySet<string>,
): OutlineTreeItem[] {
  return entries.flatMap((entry) => {
    const expandable = entry.headings.length > 0;
    const expanded = expandable && !collapsedPostIds.has(entry.id);
    const postItem: OutlineTreeItem = {
      decoration: createPostDecoration(entry),
      description: entry.author ? `@${entry.author.username}` : null,
      expandable,
      expanded,
      href: entry.permalink,
      id: entry.id,
      kind: 'post',
      label: `Post ${String(entry.postNumber)}`,
      level: 1,
      parentId: null,
      postId: entry.postId,
      postNumber: entry.postNumber,
    };
    return [
      postItem,
      ...(expanded ? entry.headings : []).map((heading): OutlineTreeItem => ({
        decoration: null,
        description: `H${String(heading.level)}`,
        expandable: false,
        expanded: false,
        href: entry.permalink,
        id: heading.id,
        kind: 'heading',
        label: heading.label,
        level: 2,
        parentId: entry.id,
        postId: entry.postId,
        postNumber: entry.postNumber,
      })),
    ];
  });
}

function createPostDecoration(entry: TopicOutlineEntry): string | null {
  const labels = [
    entry.markers.includes('original-post') ? 'original' : null,
    entry.markers.includes('code') ? 'code' : null,
    entry.markers.includes('media') ? 'media' : null,
    entry.markers.includes('partial') ? 'partial' : null,
  ].filter((label): label is string => label !== null);
  return labels.length > 0 ? labels.join(' · ') : null;
}

function moveTreeFocus(
  event: KeyboardEvent<HTMLAnchorElement>,
  item: OutlineTreeItem,
  toggleExpanded: () => void,
): void {
  if (!['ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'End', 'Home'].includes(event.key)) {
    return;
  }
  const tree = event.currentTarget.closest<HTMLElement>('[role="tree"]');
  const items = Array.from(tree?.querySelectorAll<HTMLAnchorElement>('[role="treeitem"]') ?? []);
  const currentIndex = items.indexOf(event.currentTarget);
  if (currentIndex < 0 || items.length === 0) return;

  if (event.key === 'ArrowLeft' && item.expandable && item.expanded) {
    toggleExpanded();
    event.preventDefault();
    return;
  }
  if (event.key === 'ArrowRight' && item.expandable && !item.expanded) {
    toggleExpanded();
    event.preventDefault();
    return;
  }

  let target: HTMLAnchorElement | undefined;
  if (event.key === 'Home') target = items[0];
  else if (event.key === 'End') target = items.at(-1);
  else if (event.key === 'ArrowDown') target = items[Math.min(currentIndex + 1, items.length - 1)];
  else if (event.key === 'ArrowUp') target = items[Math.max(currentIndex - 1, 0)];
  else if (event.key === 'ArrowLeft' && item.parentId) {
    target = items.find((candidate) => candidate.dataset.treeItemId === item.parentId);
  } else if (event.key === 'ArrowRight' && item.kind === 'post') {
    target = items.find((candidate) => candidate.dataset.parentId === item.id);
  }
  if (!target) return;
  target.focus();
  scrollTreeItemIntoView(target);
  event.preventDefault();
}

function isTwistieTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest('[data-outline-twistie="true"]'));
}

function scrollTreeItemIntoView(item: HTMLElement): void {
  const scrollIntoView: unknown = Reflect.get(item, 'scrollIntoView');
  if (typeof scrollIntoView === 'function') {
    Reflect.apply(scrollIntoView, item, [{ block: 'nearest' }]);
  }
}

function treeItemAriaLabel(item: OutlineTreeItem): string {
  if (item.kind === 'heading') {
    return `Open heading ${item.label} in post ${String(item.postNumber)}`;
  }
  return item.description
    ? `Open post ${String(item.postNumber)} by ${item.description}`
    : `Open post ${String(item.postNumber)}`;
}

function containsRelatedTarget(event: FocusEvent<HTMLElement>): boolean {
  return event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget);
}

function isPrimaryNavigation(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button === 0 && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
}
