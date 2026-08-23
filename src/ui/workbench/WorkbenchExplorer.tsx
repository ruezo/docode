import { useState, type ReactNode } from 'react';

import {
  getLinuxDoTopicListRouteFiles,
  type LinuxDoRoute,
  type LinuxDoTopicListRouteFile,
} from '../../linuxdo/routes';
import type { LinuxDoSearchResult } from '../../linuxdo/searchAdapter';
import type { OpenViewState } from '../../navigation/openViewState';
import { Codicon } from '../icons/codicon';
import { WorkbenchFileIcon } from './WorkbenchFileIcon';
import { createWorkbenchViewContext, type WorkbenchViewContext } from './workbenchContext';
import { createWorkbenchVirtualFile } from './workbenchFileType';

interface WorkbenchExplorerProps {
  readonly context: WorkbenchViewContext;
  readonly navigationState: OpenViewState;
  readonly onClearSearch: () => void;
  readonly onCloseView: (viewId: string) => void;
  readonly onNavigateRoute: (route: LinuxDoRoute) => void;
  readonly onOpenQuickOpen: () => void;
  readonly onRefresh: () => void;
  readonly searchSession: {
    readonly items: readonly LinuxDoSearchResult[];
    readonly query: string;
  } | null;
}

export function WorkbenchExplorer({
  context,
  navigationState,
  onClearSearch,
  onCloseView,
  onNavigateRoute,
  onOpenQuickOpen,
  onRefresh,
  searchSession,
}: WorkbenchExplorerProps) {
  const [openEditorsExpanded, setOpenEditorsExpanded] = useState(true);
  const [searchExpanded, setSearchExpanded] = useState(true);
  const [routesExpanded, setRoutesExpanded] = useState(true);
  const routeFiles = getLinuxDoTopicListRouteFiles();

  return (
    <aside className="docode-workbench__sidebar" aria-label="Primary Side Bar">
      <header className="docode-workbench__sidebar-title">
        <h2>DOCODE</h2>
        <div className="docode-workbench__sidebar-actions">
          <button
            aria-label="Search topics"
            data-docode-tooltip="Search topics"
            onClick={onOpenQuickOpen}
            type="button"
          >
            <Codicon name="search" />
          </button>
          <button
            aria-label="Refresh Explorer"
            data-docode-tooltip="Refresh Explorer"
            onClick={onRefresh}
            type="button"
          >
            <Codicon name="refresh" />
          </button>
        </div>
      </header>
      <div className="docode-workbench__sidebar-content">
        <ExplorerSection
          count={navigationState.openViews.length}
          expanded={openEditorsExpanded}
          label="Open Editors"
          onToggle={() => {
            setOpenEditorsExpanded((current) => !current);
          }}
        >
          <div className="docode-workbench__explorer-list">
            {navigationState.openViews.map((view) => {
              const itemContext = createWorkbenchViewContext(view.route, context.generation);
              const virtualFile = createWorkbenchVirtualFile(itemContext.label, `view:${view.id}`);
              return (
                <div
                  className="docode-workbench__explorer-row docode-workbench__explorer-row--open"
                  data-active={view.id === navigationState.activeViewId ? 'true' : undefined}
                  key={view.id}
                >
                  <a
                    aria-current={view.id === navigationState.activeViewId ? 'page' : undefined}
                    className="docode-workbench__explorer-open-main"
                    href={view.route.href}
                    title={virtualFile.name}
                  >
                    <span className="docode-workbench__explorer-indent" aria-hidden="true" />
                    <WorkbenchFileIcon extension={virtualFile.extension} />
                    <span className="docode-workbench__explorer-label">{virtualFile.name}</span>
                    {view.dirty ? (
                      <span
                        aria-hidden="true"
                        className="docode-workbench__explorer-decoration"
                        title="Unsaved draft"
                      >
                        ●
                      </span>
                    ) : null}
                  </a>
                  <button
                    aria-label={`Close ${virtualFile.name}`}
                    className="docode-workbench__explorer-close"
                    data-docode-tooltip="Close Editor"
                    onClick={() => {
                      onCloseView(view.id);
                    }}
                    type="button"
                  >
                    <Codicon name="close" />
                  </button>
                </div>
              );
            })}
          </div>
        </ExplorerSection>
        {searchSession ? (
          <ExplorerSection
            action={{ icon: 'close', label: 'Close Search Results', onClick: onClearSearch }}
            count={searchSession.items.length}
            expanded={searchExpanded}
            label={`Search: ${searchSession.query}`}
            onToggle={() => {
              setSearchExpanded((current) => !current);
            }}
          >
            <div
              aria-label={`Search results for ${searchSession.query}`}
              className="docode-workbench__explorer-list"
              role="tree"
            >
              {searchSession.items.map((item) => (
                <ExplorerSearchFile item={item} key={item.id} onNavigate={onNavigateRoute} />
              ))}
              {searchSession.items.length === 0 ? (
                <p className="docode-workbench__explorer-empty">No matching Linux DO results.</p>
              ) : null}
            </div>
          </ExplorerSection>
        ) : null}
        <ExplorerSection
          count={routeFiles.length}
          expanded={routesExpanded}
          label="Linux DO Lists"
          onToggle={() => {
            setRoutesExpanded((current) => !current);
          }}
        >
          <div
            aria-label="Linux DO list routes"
            className="docode-workbench__explorer-list"
            role="tree"
          >
            {routeFiles.map((file) => (
              <ExplorerRouteFile
                active={isActiveRouteFile(context.route, file)}
                file={file}
                key={file.label}
                onNavigate={onNavigateRoute}
              />
            ))}
          </div>
        </ExplorerSection>
      </div>
    </aside>
  );
}

function ExplorerSection({
  action,
  children,
  count,
  expanded,
  label,
  onToggle,
}: {
  readonly action?:
    | {
        readonly icon: 'close';
        readonly label: string;
        readonly onClick: () => void;
      }
    | undefined;
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
        {action ? (
          <button
            aria-label={action.label}
            className="docode-workbench__explorer-section-action"
            data-docode-tooltip={action.label}
            onClick={action.onClick}
            type="button"
          >
            <Codicon name={action.icon} />
          </button>
        ) : null}
      </div>
      {expanded ? children : null}
    </section>
  );
}

function ExplorerSearchFile({
  item,
  onNavigate,
}: {
  readonly item: LinuxDoSearchResult;
  readonly onNavigate: (route: LinuxDoRoute) => void;
}) {
  const virtualFile = createWorkbenchVirtualFile(item.label, `search:${item.id}`);
  return (
    <button
      aria-level={1}
      aria-label={`${item.label}, ${item.description}`}
      className="docode-workbench__explorer-row docode-workbench__explorer-row--route"
      onClick={() => {
        onNavigate(item.route);
      }}
      role="treeitem"
      title={`${virtualFile.name} — ${item.description}`}
      type="button"
    >
      <span className="docode-workbench__explorer-indent" aria-hidden="true" />
      <WorkbenchFileIcon extension={virtualFile.extension} />
      <span className="docode-workbench__explorer-label">{virtualFile.name}</span>
    </button>
  );
}

function ExplorerRouteFile({
  active,
  file,
  onNavigate,
}: {
  readonly active: boolean;
  readonly file: LinuxDoTopicListRouteFile;
  readonly onNavigate: (route: LinuxDoRoute) => void;
}) {
  const virtualFile = createWorkbenchVirtualFile(file.label, `list:${file.route.view}`);
  return (
    <button
      aria-current={active ? 'page' : undefined}
      aria-level={1}
      aria-label={file.label}
      className="docode-workbench__explorer-row docode-workbench__explorer-row--route"
      data-access={file.access}
      data-active={active ? 'true' : undefined}
      data-route-href={file.route.href}
      onClick={() => {
        onNavigate(file.route);
      }}
      role="treeitem"
      title={
        file.access === 'authentication-dependent'
          ? `${virtualFile.name} (Linux DO sign-in dependent)`
          : virtualFile.name
      }
      type="button"
    >
      <span className="docode-workbench__explorer-indent" aria-hidden="true" />
      <WorkbenchFileIcon extension={virtualFile.extension} />
      <span className="docode-workbench__explorer-label">{virtualFile.name}</span>
    </button>
  );
}

function isActiveRouteFile(route: LinuxDoRoute, file: LinuxDoTopicListRouteFile): boolean {
  return route.kind === 'topic-list' && route.view === file.route.view;
}
