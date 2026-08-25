import { useState, type ReactNode } from 'react';

import { recognizeLinuxDoRoute, type LinuxDoRoute } from '../../linuxdo/routes';
import { getOpenViewId } from '../../navigation/openViewState';
import type { BrowseHistoryEntry } from '../../settings/browseHistoryStore';
import { Codicon } from '../icons/codicon';
import type { WorkbenchViewContext } from './workbenchContext';
import { formatBrowseHistoryTime } from './workbenchHistoryTime';

interface WorkbenchHistoryProps {
  readonly context: WorkbenchViewContext;
  readonly entries: readonly BrowseHistoryEntry[] | null;
  readonly historyLimit: number;
  readonly now: number | null;
  readonly onClearHistory: () => void;
  readonly onNavigateRoute: (route: LinuxDoRoute) => void;
  readonly onRefresh: () => void;
  readonly onRemoveEntry: (viewId: string) => void;
}

export function WorkbenchHistory({
  context,
  entries,
  historyLimit,
  now,
  onClearHistory,
  onNavigateRoute,
  onRefresh,
  onRemoveEntry,
}: WorkbenchHistoryProps) {
  const [graphExpanded, setGraphExpanded] = useState(true);
  const enabled = historyLimit > 0;
  const activeViewId = getOpenViewId(context.route);

  return (
    <aside className="docode-workbench__sidebar" aria-label="Primary Side Bar">
      <header className="docode-workbench__sidebar-title">
        <h2>SOURCE CONTROL</h2>
        <div className="docode-workbench__sidebar-actions">
          <button
            aria-label="Refresh Browse History"
            data-docode-tooltip="Refresh Browse History"
            onClick={onRefresh}
            type="button"
          >
            <Codicon name="refresh" />
          </button>
          <button
            aria-label="Clear Browse History"
            data-docode-tooltip="Clear Browse History"
            disabled={!entries || entries.length === 0}
            onClick={onClearHistory}
            type="button"
          >
            <Codicon name="trash" />
          </button>
        </div>
      </header>
      <div className="docode-workbench__sidebar-content">
        <HistorySection
          count={entries?.length ?? 0}
          expanded={graphExpanded}
          label="Browse History"
          onToggle={() => {
            setGraphExpanded((current) => !current);
          }}
        >
          <div
            aria-label="Browse history graph"
            className="docode-workbench__history-list"
            role="tree"
          >
            {!enabled ? (
              <p className="docode-workbench__explorer-empty">
                Browse history is turned off. Set DOCode › Workbench: Browse History Limit above 0
                in Settings to record visited views.
              </p>
            ) : entries === null ? (
              <p className="docode-workbench__explorer-empty">Loading browse history…</p>
            ) : entries.length === 0 ? (
              <p className="docode-workbench__explorer-empty">
                No browse history yet. Visited topics and lists will show up here.
              </p>
            ) : (
              entries.map((entry) => (
                <HistoryRow
                  active={entry.viewId === activeViewId}
                  entry={entry}
                  key={entry.viewId}
                  now={now}
                  onNavigate={onNavigateRoute}
                  onRemove={onRemoveEntry}
                />
              ))
            )}
          </div>
        </HistorySection>
      </div>
    </aside>
  );
}

function HistorySection({
  children,
  count,
  expanded,
  label,
  onToggle,
}: {
  readonly children: ReactNode;
  readonly count: number;
  readonly expanded: boolean;
  readonly label: string;
  readonly onToggle: () => void;
}) {
  return (
    <section className="docode-workbench__explorer-section">
      <div className="docode-workbench__explorer-section-header">
        <button
          aria-expanded={expanded}
          className="docode-workbench__explorer-section-title"
          onClick={onToggle}
          type="button"
        >
          <Codicon name={expanded ? 'chevron-down' : 'chevron-right'} />
          <span>{label}</span>
          <span className="docode-workbench__explorer-count">{count}</span>
        </button>
      </div>
      {expanded ? children : null}
    </section>
  );
}

function HistoryRow({
  active,
  entry,
  now,
  onNavigate,
  onRemove,
}: {
  readonly active: boolean;
  readonly entry: BrowseHistoryEntry;
  readonly now: number | null;
  readonly onNavigate: (route: LinuxDoRoute) => void;
  readonly onRemove: (viewId: string) => void;
}) {
  const visitedLabel = formatBrowseHistoryTime(entry.visitedAt, now ?? entry.visitedAt);
  const visitsLabel = entry.visits > 1 ? `, ${String(entry.visits)} visits` : '';
  return (
    <div
      className="docode-workbench__history-row"
      data-active={active ? 'true' : undefined}
      data-history-kind={entry.kind}
    >
      <button
        aria-current={active ? 'page' : undefined}
        aria-label={`${entry.title}, visited ${visitedLabel}${visitsLabel}`}
        aria-level={1}
        className="docode-workbench__history-main"
        data-docode-tooltip={`${entry.title} — ${new Date(entry.visitedAt).toLocaleString()}`}
        onClick={() => {
          onNavigate(recognizeLinuxDoRoute(new URL(entry.path, globalThis.location.href)));
        }}
        role="treeitem"
        type="button"
      >
        <span aria-hidden="true" className="docode-workbench__history-graph">
          <span className="docode-workbench__history-dot" />
        </span>
        <span className="docode-workbench__history-title">{entry.title}</span>
        <span className="docode-workbench__history-time">{visitedLabel}</span>
      </button>
      <button
        aria-label={`Remove ${entry.title} from Browse History`}
        className="docode-workbench__history-remove"
        data-docode-tooltip="Remove from History"
        onClick={() => {
          onRemove(entry.viewId);
        }}
        type="button"
      >
        <Codicon name="close" />
      </button>
    </div>
  );
}
