import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';

import {
  getCloseFallbackView,
  type OpenViewState,
  type OpenWorkbenchView,
} from '../../navigation/openViewState';
import {
  getTabActionNavigationTarget,
  isTabActionAvailable,
  type TabActionId,
  type TabActionRequest,
} from '../../navigation/tabActions';
import { Codicon } from '../icons/codicon';
import { createWorkbenchViewContext, type WorkbenchViewContext } from './workbenchContext';
import type { WorkbenchPresentationMode } from './workbenchMode';
import type { WorkbenchStatusLink, WorkbenchStatusModel } from './workbenchStatus';

interface WorkbenchChromeProps {
  readonly context: WorkbenchViewContext;
}

interface StatusFrameProps {
  readonly model: WorkbenchStatusModel;
  readonly onNavigate: (href: string) => void;
  readonly onOpenTrustPanel?: (() => void) | undefined;
  readonly onSelectMode: (mode: WorkbenchPresentationMode) => void;
}

interface EditorTabsProps extends WorkbenchChromeProps {
  readonly navigationState: OpenViewState;
  readonly onRunTabAction: (
    request: TabActionRequest,
    source: 'context-menu' | 'editor-action',
  ) => Promise<void>;
  readonly originalViewAvailable: boolean;
  readonly windowActive: boolean;
}

interface TabMenuState {
  readonly error: string | null;
  readonly left: number;
  readonly pending: boolean;
  readonly top: number;
  readonly viewId: string;
}

interface TabMenuItem {
  readonly id: TabActionId;
  readonly label: string;
}

const TAB_MENU_GROUPS: readonly (readonly TabMenuItem[])[] = [
  [
    { id: 'close', label: 'Close' },
    { id: 'close-others', label: 'Close Others' },
    { id: 'close-right', label: 'Close to the Right' },
  ],
  [{ id: 'copy-topic-link', label: 'Copy Topic Link' }],
  [{ id: 'open-original-view', label: 'Open Original View' }],
];

const MENU_ESTIMATED_WIDTH = 230;
const MENU_ESTIMATED_HEIGHT = 178;
const MENU_VIEWPORT_MARGIN = 4;

export function EditorTabs({
  context,
  navigationState,
  onRunTabAction,
  originalViewAvailable,
  windowActive,
}: EditorTabsProps) {
  const [menu, setMenu] = useState<TabMenuState | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const mounted = useRef(true);
  const openMenuViewId = menu?.viewId ?? null;

  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  useEffect(() => {
    if (!openMenuViewId) return;
    const menuElement = menuRef.current;
    const firstItem = menuElement?.querySelector<HTMLElement>(
      '[role="menuitem"]:not([aria-disabled="true"])',
    );
    (firstItem ?? menuElement)?.focus();

    const dismiss = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenu(null);
    };
    const dismissOnBlur = () => {
      setMenu(null);
    };
    document.addEventListener('pointerdown', dismiss, true);
    window.addEventListener('blur', dismissOnBlur);
    return () => {
      document.removeEventListener('pointerdown', dismiss, true);
      window.removeEventListener('blur', dismissOnBlur);
    };
  }, [openMenuViewId]);

  const openMenu = (viewId: string, left: number, top: number) => {
    setMenu({
      error: null,
      left: clamp(left, MENU_VIEWPORT_MARGIN, window.innerWidth - MENU_ESTIMATED_WIDTH),
      pending: false,
      top: clamp(top, MENU_VIEWPORT_MARGIN, window.innerHeight - MENU_ESTIMATED_HEIGHT),
      viewId,
    });
  };

  const restoreTabFocus = (viewId: string) => {
    const tab = Array.from(document.querySelectorAll<HTMLElement>('[data-view-id]')).find(
      (element) => element.dataset.viewId === viewId,
    );
    tab?.querySelector<HTMLElement>('[role="tab"]')?.focus();
  };

  const scheduleTabFocus = (viewId: string | null) => {
    if (!viewId) return;
    window.requestAnimationFrame(() => {
      if (mounted.current) restoreTabFocus(viewId);
    });
  };

  const dismissMenu = (restoreFocus: boolean) => {
    const viewId = menu?.viewId;
    setMenu(null);
    if (restoreFocus && viewId) scheduleTabFocus(viewId);
  };

  const runImmediateAction = async (request: TabActionRequest) => {
    const focusViewId = getTabActionFocusViewId(navigationState, request);
    setMenu((current) => (current ? { ...current, error: null, pending: true } : current));
    try {
      await onRunTabAction(request, 'context-menu');
      if (mounted.current) {
        setMenu(null);
        scheduleTabFocus(focusViewId);
      }
    } catch {
      if (!mounted.current) return;
      setMenu((current) =>
        current
          ? {
              ...current,
              error: getTabActionError(request.id),
              pending: false,
            }
          : current,
      );
      window.requestAnimationFrame(() => {
        menuRef.current?.querySelector<HTMLElement>(`[data-tab-action="${request.id}"]`)?.focus();
      });
    }
  };

  const runEditorAction = async (
    request: TabActionRequest,
    source: 'context-menu' | 'editor-action',
  ) => {
    const focusViewId = getTabActionFocusViewId(navigationState, request);
    await onRunTabAction(request, source);
    scheduleTabFocus(focusViewId);
  };

  return (
    <>
      <div className="docode-workbench__tabs" role="tablist" aria-label="Open views">
        {navigationState.openViews.map((view) => (
          <EditorTab
            active={view.id === navigationState.activeViewId}
            closeFallback={getCloseFallbackView(navigationState, view.id)}
            context={createWorkbenchViewContext(view.route, context.generation)}
            key={view.id}
            onOpenMenu={openMenu}
            onRunTabAction={(request) => runEditorAction(request, 'editor-action')}
            view={view}
            windowActive={windowActive}
          />
        ))}
      </div>
      {menu ? (
        <div
          aria-label={`${getViewLabel(navigationState, menu.viewId)} tab actions`}
          className="docode-workbench__tab-menu"
          data-pending={menu.pending ? 'true' : undefined}
          onContextMenu={(event) => {
            event.preventDefault();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              dismissMenu(true);
              event.preventDefault();
              return;
            }
            if (event.key === 'Tab') {
              event.preventDefault();
              return;
            }
            moveMenuFocus(event);
          }}
          ref={menuRef}
          role="menu"
          style={{ left: menu.left, top: menu.top }}
          tabIndex={-1}
        >
          {TAB_MENU_GROUPS.map((group, groupIndex) => (
            <div className="docode-workbench__tab-menu-group" key={group[0]?.id} role="group">
              {groupIndex > 0 ? (
                <div className="docode-workbench__tab-menu-separator" role="separator" />
              ) : null}
              {group.map((item) => {
                const available =
                  !menu.pending &&
                  isTabActionAvailable(
                    navigationState,
                    item.id,
                    menu.viewId,
                    originalViewAvailable,
                  );
                const navigationTarget =
                  available && isCloseAction(item.id)
                    ? getTabActionNavigationTarget(navigationState, item.id, menu.viewId)
                    : null;
                const request = { id: item.id, viewId: menu.viewId } as const;

                return navigationTarget ? (
                  <a
                    className="docode-workbench__tab-menu-item"
                    href={navigationTarget.route.href}
                    key={item.id}
                    onClick={(event) => {
                      if (!isPrimaryNavigation(event)) return;
                      setMenu(null);
                      void runEditorAction(request, 'context-menu');
                    }}
                    onPointerMove={(event) => {
                      event.currentTarget.focus();
                    }}
                    role="menuitem"
                    tabIndex={-1}
                  >
                    {item.label}
                  </a>
                ) : (
                  <button
                    aria-disabled={!available}
                    className="docode-workbench__tab-menu-item"
                    data-tab-action={item.id}
                    disabled={!available}
                    key={item.id}
                    onClick={() => void runImmediateAction(request)}
                    onPointerMove={(event) => {
                      event.currentTarget.focus();
                    }}
                    role="menuitem"
                    tabIndex={-1}
                    type="button"
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}
          {menu.error ? (
            <div className="docode-workbench__tab-menu-error" role="alert">
              {menu.error}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

interface EditorTabProps {
  readonly active: boolean;
  readonly closeFallback: OpenWorkbenchView | null;
  readonly context: WorkbenchViewContext;
  readonly onOpenMenu: (viewId: string, left: number, top: number) => void;
  readonly onRunTabAction: (request: TabActionRequest) => Promise<void>;
  readonly view: OpenWorkbenchView;
  readonly windowActive: boolean;
}

function EditorTab({
  active,
  closeFallback,
  context,
  onOpenMenu,
  onRunTabAction,
  view,
  windowActive,
}: EditorTabProps) {
  const stateLabel = [
    view.readState === 'new' ? 'new' : view.readState === 'unread' ? 'unread' : null,
    view.dirty ? 'unsaved draft' : null,
  ]
    .filter(Boolean)
    .join(', ');
  const title = `${context.label} — ${context.canonicalPath}${stateLabel ? ` — ${stateLabel}` : ''}`;

  return (
    <div
      className="docode-workbench__tab"
      data-active={active ? 'true' : 'false'}
      data-closable={closeFallback ? 'true' : 'false'}
      data-dirty={view.dirty ? 'true' : undefined}
      data-read-state={view.readState}
      data-view-id={view.id}
      data-window-active={windowActive ? 'true' : 'false'}
      onContextMenu={(event) => {
        event.preventDefault();
        onOpenMenu(view.id, event.clientX, event.clientY);
      }}
    >
      <a
        aria-controls="docode-workbench-editor-content"
        aria-current={active ? 'page' : undefined}
        aria-disabled={!context.supported}
        aria-haspopup="menu"
        aria-selected={active}
        className="docode-workbench__tab-main"
        data-docode-tooltip={title}
        href={view.route.href}
        onClick={(event) => {
          if (!context.supported) event.preventDefault();
        }}
        onKeyDown={(event) => {
          if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
            const rect = event.currentTarget.getBoundingClientRect();
            onOpenMenu(view.id, rect.left + 8, rect.bottom);
            event.preventDefault();
            return;
          }
          moveTabFocus(event);
        }}
        role="tab"
        tabIndex={active && context.supported ? 0 : -1}
      >
        <Codicon name={context.icon} />
        <span className="docode-workbench__tab-label">{context.label}</span>
        {(view.readState === 'new' || view.readState === 'unread') && (
          <span aria-hidden="true" className="docode-workbench__tab-unread" />
        )}
        {view.dirty ? <span aria-hidden="true" className="docode-workbench__tab-dirty" /> : null}
        {stateLabel ? <span className="docode-sr-only">, {stateLabel}</span> : null}
      </a>
      {closeFallback &&
        (active ? (
          <a
            aria-label={`Close ${context.label}`}
            className="docode-workbench__tab-close"
            data-docode-tooltip={`Close ${context.label}`}
            href={closeFallback.route.href}
            onClick={(event) => {
              if (isPrimaryNavigation(event)) {
                void onRunTabAction({ id: 'close', viewId: view.id });
              }
            }}
          >
            <Codicon name="close" />
          </a>
        ) : (
          <button
            aria-label={`Close ${context.label}`}
            className="docode-workbench__tab-close"
            data-docode-tooltip={`Close ${context.label}`}
            onClick={() => {
              void onRunTabAction({ id: 'close', viewId: view.id });
            }}
            type="button"
          >
            <Codicon name="close" />
          </button>
        ))}
    </div>
  );
}

function moveMenuFocus(event: KeyboardEvent<HTMLDivElement>): void {
  if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
  const items = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>(
      '[role="menuitem"]:not([aria-disabled="true"])',
    ),
  );
  if (items.length === 0) return;
  const currentIndex = items.indexOf(document.activeElement as HTMLElement);
  const targetIndex =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? items.length - 1
        : event.key === 'ArrowUp'
          ? (Math.max(currentIndex, 0) - 1 + items.length) % items.length
          : (currentIndex + 1) % items.length;
  items[targetIndex]?.focus();
  event.preventDefault();
}

function getViewLabel(state: OpenViewState, viewId: string): string {
  const view = state.openViews.find(({ id }) => id === viewId);
  return view ? createWorkbenchViewContext(view.route, 0).label : 'View';
}

function getTabActionFocusViewId(state: OpenViewState, request: TabActionRequest): string | null {
  switch (request.id) {
    case 'close':
      return request.viewId === state.activeViewId
        ? (getCloseFallbackView(state, request.viewId)?.id ?? null)
        : state.activeViewId;
    case 'close-others':
      return request.viewId;
    case 'close-right':
      return (
        getTabActionNavigationTarget(state, request.id, request.viewId)?.id ?? state.activeViewId
      );
    case 'copy-topic-link':
      return request.viewId;
    case 'open-original-view':
      return null;
  }
}

function getTabActionError(actionId: TabActionId): string {
  return actionId === 'copy-topic-link'
    ? 'Could not copy the topic link.'
    : actionId === 'open-original-view'
      ? 'Could not restore the original Linux DO view.'
      : 'Could not complete the tab action.';
}

function isCloseAction(
  actionId: TabActionId,
): actionId is Extract<TabActionId, 'close' | 'close-others' | 'close-right'> {
  return actionId === 'close' || actionId === 'close-others' || actionId === 'close-right';
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(value, Math.max(minimum, maximum)));
}

function moveTabFocus(event: KeyboardEvent<HTMLAnchorElement>): void {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const tabList = event.currentTarget.closest('[role="tablist"]');
  const tabs = Array.from(
    tabList?.querySelectorAll<HTMLAnchorElement>('[role="tab"]:not([aria-disabled="true"])') ?? [],
  );
  const currentIndex = tabs.indexOf(event.currentTarget);
  if (currentIndex < 0 || tabs.length === 0) return;

  const targetIndex =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? tabs.length - 1
        : event.key === 'ArrowLeft'
          ? (currentIndex - 1 + tabs.length) % tabs.length
          : (currentIndex + 1) % tabs.length;
  tabs[targetIndex]?.focus();
  event.preventDefault();
}

function isPrimaryNavigation(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button === 0 && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
}

interface PanelFrameProps extends WorkbenchChromeProps {
  readonly activeTabId: string;
  readonly actions?: ReactNode;
  readonly children?: ReactNode;
  readonly onClose: () => void;
  readonly onSelectTab: (id: string, focusContent: boolean) => void;
  readonly open: boolean;
  readonly tabs: readonly PanelTab[];
}

export interface PanelTab {
  readonly ariaKeyShortcuts?: string;
  readonly disabled?: boolean;
  readonly id: string;
  readonly label: string;
  readonly shortcutLabel?: string;
}

export function PanelFrame({
  activeTabId,
  actions,
  children,
  context,
  onClose,
  onSelectTab,
  open,
  tabs,
}: PanelFrameProps) {
  const activeTab =
    tabs.find(({ disabled, id }) => !disabled && id === activeTabId) ??
    tabs.find(({ disabled }) => !disabled) ??
    tabs[0];
  return (
    <section
      aria-label="Bottom panel"
      className="docode-workbench__panel"
      data-docode-state={context.supported ? 'ready' : 'disabled'}
      hidden={!open}
    >
      <div className="docode-workbench__panel-tabs">
        <div className="docode-workbench__panel-tablist" role="tablist" aria-label="Panel views">
          {tabs.map((tab) => {
            const disabled = !context.supported || tab.disabled === true;
            return (
              <button
                aria-controls="docode-workbench-panel-content"
                aria-disabled={disabled}
                aria-keyshortcuts={tab.ariaKeyShortcuts}
                aria-selected={tab.id === activeTab?.id}
                className="docode-workbench__panel-tab"
                data-docode-tooltip={
                  tab.disabled
                    ? `${tab.label} unavailable`
                    : tab.shortcutLabel
                      ? `${tab.label} (${tab.shortcutLabel})`
                      : tab.label
                }
                data-panel-view-id={tab.id}
                disabled={disabled}
                id={`docode-workbench-panel-tab-${tab.id}`}
                key={tab.id}
                onClick={() => {
                  onSelectTab(tab.id, true);
                }}
                onKeyDown={(event) => {
                  movePanelTabFocus(event, tabs, onSelectTab);
                }}
                role="tab"
                tabIndex={tab.id === activeTab?.id ? 0 : -1}
                type="button"
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <div className="docode-workbench__panel-actions">
          {actions}
          <button
            aria-label="Close Bottom Panel"
            className="docode-workbench__panel-action"
            data-docode-tooltip="Close Bottom Panel"
            onClick={onClose}
            type="button"
          >
            <Codicon name="close" />
          </button>
        </div>
      </div>
      <div
        aria-labelledby={activeTab ? `docode-workbench-panel-tab-${activeTab.id}` : undefined}
        className="docode-workbench__panel-content"
        id="docode-workbench-panel-content"
        role="tabpanel"
      >
        {children}
      </div>
    </section>
  );
}

function movePanelTabFocus(
  event: KeyboardEvent<HTMLButtonElement>,
  tabs: readonly PanelTab[],
  onSelectTab: PanelFrameProps['onSelectTab'],
): void {
  if (!['ArrowLeft', 'ArrowRight', 'End', 'Home'].includes(event.key)) return;
  const tabList = event.currentTarget.closest('[role="tablist"]');
  const elements = Array.from(
    tabList?.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)') ?? [],
  );
  const currentIndex = elements.indexOf(event.currentTarget);
  if (currentIndex < 0 || elements.length === 0) return;
  const targetIndex =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? elements.length - 1
        : event.key === 'ArrowLeft'
          ? (currentIndex - 1 + elements.length) % elements.length
          : (currentIndex + 1) % elements.length;
  const target = elements[targetIndex];
  const targetId = target?.dataset.panelViewId;
  if (!target || !targetId) return;
  target.focus();
  onSelectTab(targetId, false);
  event.preventDefault();
}

export function StatusFrame({
  model,
  onNavigate,
  onOpenTrustPanel,
  onSelectMode,
}: StatusFrameProps) {
  return (
    <footer
      aria-label="DOCode status"
      className="docode-workbench__statusbar"
      data-docode-state={model.state}
    >
      <div className="docode-workbench__status-items docode-workbench__status-items--left">
        <StatusLink item={model.route} kind="view" onNavigate={onNavigate} />
        {model.category ? (
          <StatusLink item={model.category} kind="category" onNavigate={onNavigate} />
        ) : null}
        {model.floor ? (
          <StatusLink item={model.floor} kind="floor" onNavigate={onNavigate} />
        ) : null}
      </div>
      <div className="docode-workbench__status-items docode-workbench__status-items--right">
        <button
          className="docode-workbench__status-item docode-workbench__status-item--linuxdo"
          data-docode-tooltip="Open Linux DO latest topics"
          onClick={() => {
            onNavigate('https://linux.do/');
          }}
          type="button"
        >
          Linux DO
        </button>
        {model.trust ? (
          <button
            aria-label={model.trust.ariaLabel}
            className="docode-workbench__status-item docode-workbench__status-item--trust"
            data-docode-tooltip={model.trust.title}
            onClick={() => {
              onOpenTrustPanel?.();
            }}
            type="button"
          >
            <Codicon name="verified" />
            <span>{model.trust.label}</span>
          </button>
        ) : null}
        {model.encoding ? <StatusText item={model.encoding} kind="encoding" /> : null}
        {model.replies ? <StatusText item={model.replies} kind="replies" /> : null}
        {model.cursor ? <StatusText item={model.cursor} kind="cursor" /> : null}
        <span
          className="docode-workbench__status-item"
          data-docode-tooltip="DOCode is enabled on this page"
        >
          DOCode
        </span>
        {model.mode ? (
          <button
            aria-busy={model.mode.pending || undefined}
            aria-description={model.mode.description}
            aria-label={model.mode.ariaLabel}
            className="docode-workbench__status-item docode-workbench__status-item--mode"
            data-mode={model.mode.active}
            data-docode-tooltip={model.mode.title}
            disabled={model.mode.next === null || model.mode.pending}
            onClick={() => {
              if (model.mode?.next) onSelectMode(model.mode.next);
            }}
            type="button"
          >
            <Codicon name="file" />
            <span>{model.mode.label}</span>
          </button>
        ) : null}
        {model.activity ? (
          <span
            className="docode-workbench__status-item docode-workbench__status-item--activity"
            data-docode-tooltip={model.activity.title}
            data-tone={model.activity.tone}
            role="status"
          >
            <Codicon name={model.activity.icon} spin={model.activity.spin} />
            <span>{model.activity.label}</span>
          </span>
        ) : null}
      </div>
    </footer>
  );
}

function StatusText({
  item,
  kind,
}: {
  readonly item: { readonly label: string; readonly title: string };
  readonly kind: string;
}) {
  return (
    <span
      className={`docode-workbench__status-item docode-workbench__status-item--${kind}`}
      data-docode-tooltip={item.title}
    >
      {item.label}
    </span>
  );
}

function StatusLink({
  item,
  kind,
  onNavigate,
}: {
  readonly item: WorkbenchStatusLink;
  readonly kind: string;
  readonly onNavigate: (href: string) => void;
}) {
  return (
    <button
      aria-label={item.ariaLabel}
      className={`docode-workbench__status-item docode-workbench__status-item--${kind}`}
      data-docode-tooltip={item.title}
      onClick={() => {
        onNavigate(item.href);
      }}
      type="button"
    >
      <Codicon name={item.icon} />
      <span>{item.label}</span>
    </button>
  );
}
