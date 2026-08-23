import {
  memo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';

import type { TopicMinimapLine, TopicMinimapModel, TopicMinimapPoint } from './topicOverviewModel';
import { clampProgress, type TopicViewportState } from './topicViewport';

interface TopicMinimapViewProps {
  readonly model: TopicMinimapModel | null;
  readonly onNavigatePost: (postId: number) => void;
  readonly onScrollProgress: (progress: number) => void;
  readonly viewport: TopicViewportState | null;
}

interface DragSession {
  readonly offset: number;
  readonly pointerId: number;
}

export function TopicMinimapView({
  model,
  onNavigatePost,
  onScrollProgress,
  viewport,
}: TopicMinimapViewProps) {
  const [dragging, setDragging] = useState(false);
  const dragSession = useRef<DragSession | null>(null);
  const slider = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);

  if (!model || model.state === 'loading') {
    return <MinimapState label="Loading topic minimap…" state="loading" />;
  }
  if (model.state === 'error') {
    return <MinimapState label="Topic minimap unavailable." state="error" />;
  }
  if (model.points.length === 0) {
    return <MinimapState label="No loaded posts to map." state="empty" />;
  }

  const currentPostNumber = model.currentPosition?.postNumber ?? model.range?.firstPostNumber ?? 1;
  const viewportSize = viewport?.size ?? 1;
  const viewportProgress = viewport?.scrollProgress ?? 0;
  const sliderStyle = {
    '--docode-minimap-slider-progress': String(viewportProgress),
    '--docode-minimap-slider-size': `${String(viewportSize * 100)}%`,
  } as CSSProperties;

  const scrollFromPointer = (clientY: number, offset: number) => {
    const trackRect = track.current?.getBoundingClientRect();
    const sliderRect = slider.current?.getBoundingClientRect();
    if (!trackRect || !sliderRect) return;
    const travel = Math.max(0, trackRect.height - sliderRect.height);
    const sliderTop = clientY - trackRect.top - offset;
    onScrollProgress(travel > 0 ? clampProgress(sliderTop / travel) : 0);
  };

  return (
    <aside
      aria-label="Topic minimap"
      className="docode-workbench__minimap docode-topic-minimap"
      data-state="ready"
    >
      <div
        className="docode-topic-minimap__track"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          const sliderHeight = slider.current?.getBoundingClientRect().height ?? 0;
          scrollFromPointer(event.clientY, sliderHeight / 2);
          event.preventDefault();
        }}
        ref={track}
      >
        <MinimapGlyphLines lines={model.lines} />
        <MinimapMarks
          currentPostId={model.currentPosition?.postId ?? null}
          onNavigatePost={onNavigatePost}
          points={model.points}
        />
        <div
          aria-label="Topic viewport"
          aria-orientation="vertical"
          aria-valuemax={model.range?.lastPostNumber ?? currentPostNumber}
          aria-valuemin={model.range?.firstPostNumber ?? currentPostNumber}
          aria-valuenow={currentPostNumber}
          aria-valuetext={`Post ${String(currentPostNumber)} in the loaded window`}
          className="docode-topic-minimap__slider"
          data-dragging={dragging ? 'true' : undefined}
          onKeyDown={(event) => {
            moveViewportFromKeyboard(event, model.points, viewportProgress, onScrollProgress);
          }}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            const sliderRect = event.currentTarget.getBoundingClientRect();
            dragSession.current = {
              offset: event.clientY - sliderRect.top,
              pointerId: event.pointerId,
            };
            event.currentTarget.setPointerCapture(event.pointerId);
            setDragging(true);
            event.preventDefault();
            event.stopPropagation();
          }}
          onPointerMove={(event) => {
            const session = dragSession.current;
            if (session?.pointerId !== event.pointerId) return;
            scrollFromPointer(event.clientY, session.offset);
          }}
          onPointerUp={(event) => {
            const session = dragSession.current;
            if (session?.pointerId !== event.pointerId) return;
            dragSession.current = null;
            setDragging(false);
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
          }}
          ref={slider}
          role="slider"
          style={sliderStyle}
          tabIndex={0}
          title="Drag to scroll the loaded topic window"
        >
          <span className="docode-topic-minimap__slider-fill" />
        </div>
      </div>
    </aside>
  );
}

const MinimapMarks = memo(function MinimapMarks({
  currentPostId,
  onNavigatePost,
  points,
}: {
  readonly currentPostId: number | null;
  readonly onNavigatePost: (postId: number) => void;
  readonly points: readonly TopicMinimapPoint[];
}) {
  return points.map((point) => (
    <a
      aria-current={point.postId === currentPostId ? 'location' : undefined}
      aria-label={`Open post ${String(point.postNumber)} from minimap`}
      className="docode-topic-minimap__mark"
      data-current={point.postId === currentPostId ? 'true' : undefined}
      data-markers={point.markers.join(' ')}
      href={point.permalink}
      key={point.id}
      onClick={(event) => {
        if (isPrimaryNavigation(event)) onNavigatePost(point.postId);
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      style={markStyle(point)}
      title={`Post ${String(point.postNumber)}`}
    />
  ));
});

const MinimapGlyphLines = memo(function MinimapGlyphLines({
  lines,
}: {
  readonly lines: readonly TopicMinimapLine[];
}) {
  return (
    <span aria-hidden="true" className="docode-topic-minimap__glyph-layer">
      {lines.map((line) => (
        <span
          className="docode-topic-minimap__glyph-line"
          data-line-number={line.lineNumber}
          key={line.id}
          style={lineStyle(line)}
        >
          {line.tokens.map((token, index) => (
            <span data-tone={token.tone} key={`${token.tone}:${String(index)}`}>
              {token.text}
            </span>
          ))}
        </span>
      ))}
    </span>
  );
});

function MinimapState({
  label,
  state,
}: {
  readonly label: string;
  readonly state: 'empty' | 'error' | 'loading';
}) {
  return (
    <aside
      aria-label="Topic minimap"
      className="docode-workbench__minimap docode-topic-minimap"
      data-state={state}
    >
      <span className="docode-topic-minimap__state" role="status">
        {label}
      </span>
    </aside>
  );
}

function markStyle(point: TopicMinimapPoint): CSSProperties {
  return {
    '--docode-minimap-mark-position': String(point.position),
  } as CSSProperties;
}

function lineStyle(line: TopicMinimapLine): CSSProperties {
  return {
    '--docode-minimap-line-indent': String(line.indent),
    '--docode-minimap-line-index': String(line.lineNumber - 1),
    '--docode-minimap-line-position': String(line.position),
  } as CSSProperties;
}

function moveViewportFromKeyboard(
  event: KeyboardEvent<HTMLElement>,
  points: readonly TopicMinimapPoint[],
  currentProgress: number,
  onScrollProgress: (progress: number) => void,
): void {
  const pointStep = points.length > 1 ? 1 / (points.length - 1) : 1;
  const nextProgress =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? 1
        : event.key === 'PageUp'
          ? currentProgress - 0.1
          : event.key === 'PageDown'
            ? currentProgress + 0.1
            : event.key === 'ArrowUp' || event.key === 'ArrowLeft'
              ? currentProgress - pointStep
              : event.key === 'ArrowDown' || event.key === 'ArrowRight'
                ? currentProgress + pointStep
                : null;
  if (nextProgress === null) return;
  onScrollProgress(clampProgress(nextProgress));
  event.preventDefault();
}

function isPrimaryNavigation(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button === 0 && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
}
