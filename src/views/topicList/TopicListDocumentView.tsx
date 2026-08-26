import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type UIEvent,
} from 'react';

import {
  detectWorkbenchPlatform,
  type WorkbenchPlatform,
} from '../../keybindings/keybindingCoordinator';
import type {
  TopicListDocument,
  TopicListDocumentLine,
  TopicListScaffoldRow,
  TopicListSourceRow,
  TopicListSourceValue,
} from './topicListDocument';

export type ReadyTopicListDocument = TopicListDocument & { readonly state: 'ready' };

interface TopicListEditorSurfaceProps {
  readonly document: ReadyTopicListDocument;
  readonly hasMoreTopics?: boolean;
  readonly loadingMoreTopics?: boolean;
  readonly onNavigateTopic?: (line: TopicListDocumentLine) => void;
  readonly keyboardRequest?: TopicListKeyboardRequest | null;
  readonly onRequestMoreTopics?: () => void;
  readonly onViewportChange?: (scrollTop: number) => void;
  readonly platform?: WorkbenchPlatform;
  readonly scrollRequest?: TopicListScrollRequest | null;
}

export interface TopicListKeyboardRequest {
  readonly kind: 'first' | 'last' | 'next' | 'previous';
  readonly sequence: number;
}

export interface TopicListScrollRequest {
  readonly scrollTop: number;
  readonly sequence: number;
}

const NAVIGATION_KEY_BY_KEYBOARD_REQUEST: Readonly<
  Record<TopicListKeyboardRequest['kind'], TopicListNavigationKey>
> = {
  first: 'Home',
  last: 'End',
  next: 'ArrowDown',
  previous: 'ArrowUp',
};

export function TopicListEditorSurface({
  document,
  hasMoreTopics = false,
  keyboardRequest = null,
  loadingMoreTopics = false,
  onNavigateTopic,
  onRequestMoreTopics,
  onViewportChange,
  platform = detectWorkbenchPlatform(globalThis.navigator),
  scrollRequest,
}: TopicListEditorSurfaceProps) {
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(
    document.lines[0]?.topicId ?? null,
  );
  const [definitionModifierActive, setDefinitionModifierActive] = useState(false);
  const gutterContent = useRef<HTMLDivElement>(null);
  const scrollContainer = useRef<HTMLDivElement>(null);
  const selectedLine = document.lines.find(({ topicId }) => topicId === selectedTopicId);
  const activeTopicId = selectedLine?.topicId ?? document.lines[0]?.topicId ?? null;

  useEffect(() => {
    const ownerDocument = scrollContainer.current?.ownerDocument;
    const ownerWindow = ownerDocument?.defaultView;
    if (!ownerDocument || !ownerWindow) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (isPrimaryModifierKey(event.key, platform) && hasExactPrimaryModifier(event, platform)) {
        setDefinitionModifierActive(true);
      }
    };
    const onKeyUp = (event: globalThis.KeyboardEvent) => {
      if (isPrimaryModifierKey(event.key, platform)) setDefinitionModifierActive(false);
    };
    const reset = () => {
      setDefinitionModifierActive(false);
    };
    ownerDocument.addEventListener('keydown', onKeyDown, true);
    ownerDocument.addEventListener('keyup', onKeyUp, true);
    ownerWindow.addEventListener('blur', reset);
    return () => {
      ownerDocument.removeEventListener('keydown', onKeyDown, true);
      ownerDocument.removeEventListener('keyup', onKeyUp, true);
      ownerWindow.removeEventListener('blur', reset);
    };
  }, [platform]);

  useLayoutEffect(() => {
    const scroll = scrollContainer.current;
    if (!scrollRequest || !scroll) return;
    scroll.scrollLeft = 0;
    scroll.scrollTop = scrollRequest.scrollTop;
    if (gutterContent.current) {
      gutterContent.current.style.transform = `translate3d(0, -${String(scroll.scrollTop)}px, 0)`;
    }
  }, [scrollRequest]);

  const appliedKeyboardSequence = useRef<number | null>(null);
  useEffect(() => {
    if (!keyboardRequest || appliedKeyboardSequence.current === keyboardRequest.sequence) return;
    appliedKeyboardSequence.current = keyboardRequest.sequence;
    const currentIndex = document.lines.findIndex(({ topicId }) => topicId === activeTopicId);
    const targetIndex = getTargetIndex(
      Math.max(currentIndex, 0),
      NAVIGATION_KEY_BY_KEYBOARD_REQUEST[keyboardRequest.kind],
      document.lines.length,
    );
    const target = document.lines[targetIndex];
    if (!target) return;
    const anchor = scrollContainer.current?.querySelector<HTMLAnchorElement>(
      `[data-docode-topic-link="${String(target.topicId)}"]`,
    );
    if (!anchor) return;
    anchor.focus({ preventScroll: true });
    const scrollIntoView: unknown = Reflect.get(anchor, 'scrollIntoView');
    if (typeof scrollIntoView === 'function') {
      Reflect.apply(scrollIntoView, anchor, [{ block: 'nearest', inline: 'nearest' }]);
    }
  }, [activeTopicId, document.lines, keyboardRequest]);

  const synchronizeGutter = (event: UIEvent<HTMLDivElement>) => {
    if (gutterContent.current) {
      gutterContent.current.style.transform = `translate3d(0, -${String(event.currentTarget.scrollTop)}px, 0)`;
    }
    onViewportChange?.(event.currentTarget.scrollTop);
    if (hasMoreTopics && !loadingMoreTopics && isNearDocumentEnd(event.currentTarget)) {
      onRequestMoreTopics?.();
    }
  };

  const moveFocus = (currentIndex: number, key: TopicListNavigationKey) => {
    const targetIndex = getTargetIndex(currentIndex, key, document.lines.length);
    const target = document.lines[targetIndex];
    if (!target) return;
    setSelectedTopicId(target.topicId);
    const anchor = scrollContainer.current?.querySelector<HTMLAnchorElement>(
      `[data-docode-topic-link="${String(target.topicId)}"]`,
    );
    if (!anchor) return;
    anchor.focus({ preventScroll: true });
    const scrollIntoView: unknown = Reflect.get(anchor, 'scrollIntoView');
    if (typeof scrollIntoView === 'function') {
      Reflect.apply(scrollIntoView, anchor, [{ block: 'nearest', inline: 'nearest' }]);
    }
  };

  return (
    <>
      <aside
        className="docode-workbench__gutter docode-topic-list__gutter"
        aria-label="Gutter slot"
      >
        <div className="docode-topic-list__gutter-content" ref={gutterContent}>
          {document.prologue.map((row) => (
            <span
              aria-hidden="true"
              className="docode-topic-list__line-number"
              key={`prologue-${String(row.lineNumber)}`}
            >
              {row.lineNumber}
            </span>
          ))}
          {document.lines.flatMap((line) =>
            line.rows.map((row) => (
              <span
                aria-hidden="true"
                className="docode-topic-list__line-number"
                data-active={
                  line.topicId === activeTopicId && row.kind === 'signature' ? 'true' : undefined
                }
                data-read-state={line.readState}
                key={`${String(line.topicId)}-${String(row.lineNumber)}`}
              >
                {row.lineNumber}
              </span>
            )),
          )}
          {document.epilogue.map((row) => (
            <span
              aria-hidden="true"
              className="docode-topic-list__line-number"
              key={`epilogue-${String(row.lineNumber)}`}
            >
              {row.lineNumber}
            </span>
          ))}
        </div>
      </aside>
      <section
        aria-label="Editor content slot"
        className="docode-workbench__editor-content"
        id="docode-workbench-editor-content"
      >
        <div
          aria-label="Topic list document"
          className="docode-topic-list__scroll"
          data-definition-modifier={definitionModifierActive ? 'true' : undefined}
          data-has-more-topics={hasMoreTopics ? 'true' : undefined}
          data-line-count={document.lineCount}
          data-loading-more-topics={loadingMoreTopics ? 'true' : undefined}
          onScroll={synchronizeGutter}
          ref={scrollContainer}
          role="list"
        >
          <div className="docode-topic-list__document">
            {document.prologue.map((row) => (
              <ScaffoldRow key={`prologue-${String(row.lineNumber)}`} row={row} />
            ))}
            {document.lines.map((line, index) => (
              <TopicListEntry
                active={line.topicId === activeTopicId}
                index={index}
                key={line.topicId}
                line={line}
                moveFocus={moveFocus}
                onNavigateTopic={onNavigateTopic}
                platform={platform}
                select={setSelectedTopicId}
              />
            ))}
            {document.epilogue.map((row) => (
              <ScaffoldRow key={`epilogue-${String(row.lineNumber)}`} row={row} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function isNearDocumentEnd(element: HTMLElement): boolean {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= 320;
}

type TopicListNavigationKey = 'ArrowDown' | 'ArrowUp' | 'End' | 'Home';

interface TopicListEntryProps {
  readonly active: boolean;
  readonly index: number;
  readonly line: TopicListDocumentLine;
  readonly moveFocus: (currentIndex: number, key: TopicListNavigationKey) => void;
  readonly onNavigateTopic: ((line: TopicListDocumentLine) => void) | undefined;
  readonly platform: WorkbenchPlatform;
  readonly select: (topicId: number) => void;
}

function TopicListEntry({
  active,
  index,
  line,
  moveFocus,
  onNavigateTopic,
  platform,
  select,
}: TopicListEntryProps) {
  const title = line.tokens.find((token) => token.kind === 'title');
  const titleText = title?.kind === 'title' ? title.text : `topic ${String(line.topicId)}`;
  const lastLineNumber = line.rows.at(-1)?.lineNumber ?? line.lineNumber;
  const onDefinitionKeyDown = (
    event: KeyboardEvent<HTMLAnchorElement>,
    primaryFocusTarget: boolean,
  ) => {
    if (primaryFocusTarget && isTopicListNavigationKey(event.key)) {
      event.preventDefault();
      moveFocus(index, event.key);
      return;
    }
    if (event.key !== 'Enter') return;
    event.preventDefault();
    select(line.topicId);
    if (hasExactPrimaryModifier(event, platform)) onNavigateTopic?.(line);
  };
  const onDefinitionClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    select(line.topicId);
    if (isDefinitionClick(event, platform)) onNavigateTopic?.(line);
  };
  const routeComment = createRouteComment(line);

  return (
    <div
      aria-label={`Lines ${String(line.lineNumber)}–${String(lastLineNumber)}: ${titleText}${line.markers.length > 0 ? ` (${line.markers.join(', ')})` : ''}`}
      className="docode-topic-list__entry"
      data-active={active ? 'true' : undefined}
      data-completeness={line.completeness}
      data-focus-id={line.focus.id}
      data-focus-order={line.focus.order}
      data-read-state={line.readState}
      data-topic-id={line.topicId}
      onPointerDown={() => {
        select(line.topicId);
      }}
      role="listitem"
    >
      {line.markers.map((marker) => (
        <span
          aria-hidden="true"
          className="docode-topic-list__marker"
          data-marker={marker}
          key={marker}
        />
      ))}
      {line.rows.map((row) => (
        <SourceRow
          active={active}
          focusId={line.focus.id}
          key={row.lineNumber}
          line={line}
          onClick={onDefinitionClick}
          onFocus={() => {
            select(line.topicId);
          }}
          onKeyDown={onDefinitionKeyDown}
          platform={platform}
          routeComment={routeComment}
          row={row}
          title={titleText}
        />
      ))}
    </div>
  );
}

interface SourceRowProps {
  readonly active: boolean;
  readonly focusId: string;
  readonly line: TopicListDocumentLine;
  readonly onClick: (event: MouseEvent<HTMLAnchorElement>) => void;
  readonly onFocus: () => void;
  readonly onKeyDown: (
    event: KeyboardEvent<HTMLAnchorElement>,
    primaryFocusTarget: boolean,
  ) => void;
  readonly platform: WorkbenchPlatform;
  readonly routeComment: string;
  readonly row: TopicListSourceRow;
  readonly title: string;
}

function SourceRow({
  active,
  focusId,
  line,
  onClick,
  onFocus,
  onKeyDown,
  platform,
  routeComment,
  row,
  title,
}: SourceRowProps) {
  if (row.kind === 'blank') {
    return <div aria-hidden="true" className="docode-topic-list__line" data-row-kind="blank" />;
  }
  if (row.kind === 'comment') {
    return (
      <div className="docode-topic-list__line" data-row-kind="comment">
        <Indent depth={2} />
        <span className="docode-topic-list__comment">{routeComment}</span>
      </div>
    );
  }
  if (row.kind === 'method-close') {
    return (
      <div className="docode-topic-list__line" data-row-kind="method-close">
        <Indent depth={1} />
        <span className="docode-topic-list__punctuation">{'}'}</span>
      </div>
    );
  }
  if (row.kind === 'method-open') {
    return (
      <div className="docode-topic-list__line" data-row-kind="method-open">
        <Indent depth={1} />
        <span className="docode-topic-list__declaration">private void </span>
        <DefinitionLink
          active={active}
          focusId={undefined}
          label={`@${row.name}`}
          line={line}
          method="author"
          onClick={onClick}
          onFocus={onFocus}
          onKeyDown={(event) => {
            onKeyDown(event, false);
          }}
          platform={platform}
          primaryFocusTarget={false}
          title={title}
        />
        <span className="docode-topic-list__punctuation">{'() {'}</span>
      </div>
    );
  }

  const method = row.kind === 'signature' ? 'post' : row.method;
  const primaryFocusTarget = row.kind === 'signature';
  return (
    <div
      className="docode-topic-list__line"
      data-active={active && primaryFocusTarget ? 'true' : undefined}
      data-row-kind={row.kind}
    >
      <Indent depth={primaryFocusTarget ? 2 : 3} />
      {primaryFocusTarget ? <span className="docode-topic-list__keyword">community</span> : null}
      <span className="docode-topic-list__punctuation">.</span>
      <DefinitionLink
        active={active}
        focusId={primaryFocusTarget ? focusId : undefined}
        label={method}
        line={line}
        method={method}
        onClick={onClick}
        onFocus={onFocus}
        onKeyDown={(event) => {
          onKeyDown(event, primaryFocusTarget);
        }}
        platform={platform}
        primaryFocusTarget={primaryFocusTarget}
        title={title}
      />
      <span className="docode-topic-list__punctuation">(</span>
      {row.kind === 'signature' ? (
        <span className="docode-topic-list__string">"{escapeSourceString(row.title)}"</span>
      ) : (
        <SourceValue value={row.value} />
      )}
      <span className="docode-topic-list__punctuation">){row.terminal ? ';' : ''}</span>
    </div>
  );
}

function Indent({ depth }: { readonly depth: number }) {
  return (
    <>
      {Array.from({ length: depth }, (_, level) => (
        <span aria-hidden="true" className="docode-topic-list__indent" key={level}>
          {'  '}
        </span>
      ))}
    </>
  );
}

function ScaffoldRow({ row }: { readonly row: TopicListScaffoldRow }) {
  if (row.kind === 'blank') {
    return <div aria-hidden="true" className="docode-topic-list__line" data-row-kind="blank" />;
  }
  return (
    <div aria-hidden="true" className="docode-topic-list__line" data-row-kind={row.kind}>
      {row.kind === 'import' ? (
        <>
          <span className="docode-topic-list__declaration">import</span>
          <span className="docode-topic-list__punctuation"> LinuxDo.</span>
          <span className="docode-topic-list__keyword">Community</span>
          <span className="docode-topic-list__punctuation">;</span>
        </>
      ) : null}
      {row.kind === 'class-open' ? (
        <>
          <span className="docode-topic-list__declaration">public class </span>
          <span className="docode-topic-list__keyword">LinuxDo</span>
          <span className="docode-topic-list__punctuation">{' {'}</span>
        </>
      ) : null}
      {row.kind === 'field' ? (
        <>
          <Indent depth={1} />
          <span className="docode-topic-list__declaration">private final </span>
          <span className="docode-topic-list__keyword">Community</span>
          <span className="docode-topic-list__field"> community</span>
          <span className="docode-topic-list__punctuation"> = </span>
          <span className="docode-topic-list__declaration">new </span>
          <span className="docode-topic-list__keyword">Community</span>
          <span className="docode-topic-list__punctuation">();</span>
        </>
      ) : null}
      {row.kind === 'init-open' ? (
        <>
          <Indent depth={1} />
          <span className="docode-topic-list__declaration">public synchronized void </span>
          <span className="docode-topic-list__method">init</span>
          <span className="docode-topic-list__punctuation">{'() {'}</span>
        </>
      ) : null}
      {row.kind === 'init-comment' ? (
        <>
          <Indent depth={2} />
          <span className="docode-topic-list__comment">{'// /t/topic/1/1 · pinned'}</span>
        </>
      ) : null}
      {row.kind === 'init-config' ? (
        <>
          <Indent depth={2} />
          <span className="docode-topic-list__keyword">community</span>
          <span className="docode-topic-list__punctuation">.</span>
          <span className="docode-topic-list__method">config</span>
          <span className="docode-topic-list__punctuation">(</span>
          <span className="docode-topic-list__string">"真诚、友善、团结、专业"</span>
          <span className="docode-topic-list__punctuation">)</span>
        </>
      ) : null}
      {row.kind === 'init-from' ? (
        <>
          <Indent depth={3} />
          <span className="docode-topic-list__punctuation">.</span>
          <span className="docode-topic-list__method">from</span>
          <span className="docode-topic-list__punctuation">(</span>
          <span className="docode-topic-list__string">"EVERYONE"</span>
          <span className="docode-topic-list__punctuation">)</span>
        </>
      ) : null}
      {row.kind === 'init-to' ? (
        <>
          <Indent depth={3} />
          <span className="docode-topic-list__punctuation">.</span>
          <span className="docode-topic-list__method">to</span>
          <span className="docode-topic-list__punctuation">(</span>
          <span className="docode-topic-list__string">"LINUXDO"</span>
          <span className="docode-topic-list__punctuation">);</span>
        </>
      ) : null}
      {row.kind === 'init-close' ? (
        <>
          <Indent depth={1} />
          <span className="docode-topic-list__punctuation">{'}'}</span>
        </>
      ) : null}
      {row.kind === 'class-close' ? (
        <span className="docode-topic-list__punctuation">{'}'}</span>
      ) : null}
    </div>
  );
}

function DefinitionLink({
  active,
  focusId,
  label,
  line,
  method,
  onClick,
  onFocus,
  onKeyDown,
  platform,
  primaryFocusTarget,
  title,
}: {
  readonly active: boolean;
  readonly focusId: string | undefined;
  readonly label: string;
  readonly line: TopicListDocumentLine;
  readonly method: 'at' | 'author' | 'comments' | 'post' | 'views';
  readonly onClick: (event: MouseEvent<HTMLAnchorElement>) => void;
  readonly onFocus: () => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLAnchorElement>) => void;
  readonly platform: WorkbenchPlatform;
  readonly primaryFocusTarget: boolean;
  readonly title: string;
}) {
  const modifierLabel = platform === 'mac' ? 'Command' : 'Control';
  return (
    <a
      aria-keyshortcuts={platform === 'mac' ? 'Meta+Enter' : 'Control+Enter'}
      aria-label={`Open topic from ${method}: ${title}`}
      className={`docode-topic-list__definition-link${primaryFocusTarget ? ' docode-topic-list__topic-link' : ''}`}
      data-docode-topic-link={primaryFocusTarget ? line.topicId : undefined}
      data-method={method}
      data-route-href={line.url}
      id={focusId}
      onAuxClick={(event) => {
        event.preventDefault();
      }}
      onClick={onClick}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      role="link"
      tabIndex={primaryFocusTarget && active ? 0 : -1}
      title={`${modifierLabel}+Click to open ${title}`}
    >
      {label}
    </a>
  );
}

function SourceValue({ value }: { readonly value: TopicListSourceValue }) {
  return value.kind === 'string' ? (
    <span className="docode-topic-list__string">"{escapeSourceString(value.text)}"</span>
  ) : (
    <span className="docode-topic-list__number">{formatCount(value.value, value.precision)}</span>
  );
}

function createRouteComment(line: TopicListDocumentLine): string {
  let path = line.url;
  try {
    path = new URL(line.url).pathname;
  } catch {
    // The normalized adapter already rejects malformed topic URLs; retain exact text defensively.
  }
  const state = line.markers.length > 0 ? ` · ${line.markers.join(' · ')}` : '';
  return `// ${path}${state}`;
}

function escapeSourceString(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n');
}

function isDefinitionClick(
  event: MouseEvent<HTMLAnchorElement>,
  platform: WorkbenchPlatform,
): boolean {
  return event.button === 0 && hasExactPrimaryModifier(event, platform);
}

function hasExactPrimaryModifier(
  event: Pick<KeyboardEvent | MouseEvent, 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>,
  platform: WorkbenchPlatform,
): boolean {
  if (event.altKey || event.shiftKey) return false;
  return platform === 'mac' ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
}

function isPrimaryModifierKey(key: string, platform: WorkbenchPlatform): boolean {
  return platform === 'mac' ? key === 'Meta' : key === 'Control';
}

function isTopicListNavigationKey(key: string): key is TopicListNavigationKey {
  return key === 'ArrowDown' || key === 'ArrowUp' || key === 'Home' || key === 'End';
}

function getTargetIndex(current: number, key: TopicListNavigationKey, lineCount: number): number {
  switch (key) {
    case 'ArrowDown':
      return Math.min(current + 1, lineCount - 1);
    case 'ArrowUp':
      return Math.max(current - 1, 0);
    case 'Home':
      return 0;
    case 'End':
      return Math.max(lineCount - 1, 0);
  }
}

function formatCount(value: number, precision: 'compact' | 'exact'): string {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: precision === 'compact' ? 1 : 0,
    notation: precision === 'compact' ? 'compact' : 'standard',
  }).format(value);
}
