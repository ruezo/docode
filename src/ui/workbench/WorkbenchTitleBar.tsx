import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react';

import { Codicon } from '../icons/codicon';
import {
  detectWorkbenchOperatingSystem,
  type WorkbenchOperatingSystem,
} from '../../platform/workbenchPlatform';
import {
  browserWindowFullscreenClient,
  type WindowFullscreenClient,
} from '../../platform/browserWindowFullscreen';
import type { WorkbenchViewContext } from './workbenchContext';

interface WorkbenchTitleBarProps {
  readonly commandCenterLabel?: string;
  readonly commandCenterRef?: RefObject<HTMLButtonElement | null>;
  readonly context: WorkbenchViewContext;
  readonly onOpenCommandPalette: () => void;
  readonly onOpenQuickOpen: () => void;
  readonly onTogglePanel: () => void;
  readonly onToggleSidebar: () => void;
  readonly panelOpen: boolean;
  readonly platform?: WorkbenchOperatingSystem;
  readonly quickInputOpen?: boolean;
  readonly quickOpenAriaKeyShortcuts?: string | undefined;
  readonly quickOpenTooltip?: string;
  readonly sidebarOpen: boolean;
  readonly windowFullscreenClient?: WindowFullscreenClient;
}

const LAYOUT_MENU_WIDTH = 230;
const LAYOUT_MENU_VIEWPORT_MARGIN = 4;

export function WorkbenchTitleBar({
  commandCenterLabel = 'DOCode',
  commandCenterRef,
  context,
  onOpenCommandPalette,
  onOpenQuickOpen,
  onTogglePanel,
  onToggleSidebar,
  panelOpen,
  platform = detectWorkbenchOperatingSystem(),
  quickInputOpen = false,
  quickOpenAriaKeyShortcuts,
  quickOpenTooltip,
  sidebarOpen,
  windowFullscreenClient = browserWindowFullscreenClient,
}: WorkbenchTitleBarProps) {
  const [layoutMenuPosition, setLayoutMenuPosition] = useState<{
    readonly left: number;
    readonly top: number;
  } | null>(null);
  const layoutButtonRef = useRef<HTMLButtonElement | null>(null);
  const layoutMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!layoutMenuPosition) return;
    layoutMenuRef.current
      ?.querySelector<HTMLElement>('[role="menuitemcheckbox"]:not(:disabled)')
      ?.focus();

    const dismiss = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!layoutMenuRef.current?.contains(target) && !layoutButtonRef.current?.contains(target)) {
        setLayoutMenuPosition(null);
      }
    };
    const dismissOnBlur = () => {
      setLayoutMenuPosition(null);
    };
    document.addEventListener('pointerdown', dismiss, true);
    window.addEventListener('blur', dismissOnBlur);
    return () => {
      document.removeEventListener('pointerdown', dismiss, true);
      window.removeEventListener('blur', dismissOnBlur);
    };
  }, [layoutMenuPosition]);

  const toggleLayoutMenu = () => {
    if (layoutMenuPosition) {
      setLayoutMenuPosition(null);
      return;
    }
    const button = layoutButtonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    setLayoutMenuPosition({
      left: Math.max(
        LAYOUT_MENU_VIEWPORT_MARGIN,
        Math.min(
          rect.right - LAYOUT_MENU_WIDTH,
          window.innerWidth - LAYOUT_MENU_WIDTH - LAYOUT_MENU_VIEWPORT_MARGIN,
        ),
      ),
      top: rect.bottom,
    });
  };

  return (
    <header
      className="docode-workbench__titlebar"
      aria-label="Workbench title bar"
      data-platform={platform}
    >
      <div className="docode-workbench__titlebar-left">
        <ProductMark />
        <MacTrafficLights client={windowFullscreenClient} />
        <WindowsMenuBar />
      </div>
      <div className="docode-workbench__titlebar-center">
        <button
          aria-label="Go Back"
          className="docode-workbench__titlebar-action"
          data-docode-tooltip="Go Back"
          onClick={() => {
            window.history.back();
          }}
          type="button"
        >
          <Codicon name="arrow-left" />
        </button>
        <button
          aria-label="Go Forward"
          className="docode-workbench__titlebar-action"
          data-docode-tooltip="Go Forward"
          onClick={() => {
            window.history.forward();
          }}
          type="button"
        >
          <Codicon name="arrow-right" />
        </button>
        <button
          aria-hidden={quickInputOpen || undefined}
          aria-keyshortcuts={quickOpenAriaKeyShortcuts}
          aria-label="Search files and Linux DO topics"
          className="docode-workbench__command-center"
          data-docode-tooltip={quickOpenTooltip ?? 'Search files and Linux DO topics'}
          disabled={!context.supported}
          onClick={onOpenQuickOpen}
          ref={commandCenterRef}
          tabIndex={quickInputOpen ? -1 : undefined}
          type="button"
        >
          <span>{commandCenterLabel}</span>
        </button>
      </div>
      <div className="docode-workbench__titlebar-right">
        <div
          aria-label="Workbench layout controls"
          className="docode-workbench__layout-controls"
          role="toolbar"
        >
          <button
            aria-expanded={layoutMenuPosition !== null}
            aria-haspopup="menu"
            aria-label="Customize Layout"
            className="docode-workbench__titlebar-action"
            data-docode-tooltip="Customize Layout"
            disabled={!context.supported}
            onClick={toggleLayoutMenu}
            ref={layoutButtonRef}
            type="button"
          >
            <Codicon name="layout" />
          </button>
          <button
            aria-pressed={sidebarOpen}
            aria-label="Toggle Primary Side Bar"
            className="docode-workbench__titlebar-action"
            data-docode-tooltip={sidebarOpen ? 'Hide Primary Side Bar' : 'Show Primary Side Bar'}
            onClick={onToggleSidebar}
            type="button"
          >
            <Codicon name={sidebarOpen ? 'layout-sidebar-left' : 'layout-sidebar-left-off'} />
          </button>
          <button
            aria-pressed={panelOpen}
            aria-label="Toggle Panel"
            className="docode-workbench__titlebar-action"
            data-docode-tooltip={panelOpen ? 'Hide Bottom Panel' : 'Show Bottom Panel'}
            onClick={onTogglePanel}
            type="button"
          >
            <Codicon name={panelOpen ? 'layout-panel' : 'layout-panel-off'} />
          </button>
          <button
            aria-label="Secondary Side Bar unavailable"
            className="docode-workbench__titlebar-action"
            data-docode-tooltip="Secondary Side Bar is not available in DOCode"
            disabled
            type="button"
          >
            <Codicon name="layout-sidebar-right-off" />
          </button>
        </div>
        <WindowsWindowControls />
      </div>
      {layoutMenuPosition ? (
        <LayoutMenu
          left={layoutMenuPosition.left}
          menuRef={layoutMenuRef}
          onClose={() => {
            setLayoutMenuPosition(null);
            layoutButtonRef.current?.focus();
          }}
          onOpenCommandPalette={() => {
            setLayoutMenuPosition(null);
            onOpenCommandPalette();
          }}
          onTogglePanel={onTogglePanel}
          onToggleSidebar={onToggleSidebar}
          panelOpen={panelOpen}
          sidebarOpen={sidebarOpen}
          top={layoutMenuPosition.top}
        />
      ) : null}
    </header>
  );
}

interface LayoutMenuProps {
  readonly left: number;
  readonly menuRef: RefObject<HTMLDivElement | null>;
  readonly onClose: () => void;
  readonly onOpenCommandPalette: () => void;
  readonly onTogglePanel: () => void;
  readonly onToggleSidebar: () => void;
  readonly panelOpen: boolean;
  readonly sidebarOpen: boolean;
  readonly top: number;
}

function LayoutMenu({
  left,
  menuRef,
  onClose,
  onOpenCommandPalette,
  onTogglePanel,
  onToggleSidebar,
  panelOpen,
  sidebarOpen,
  top,
}: LayoutMenuProps) {
  return (
    <div
      aria-label="Customize Layout"
      className="docode-workbench__layout-menu"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          onClose();
          event.preventDefault();
          return;
        }
        moveLayoutMenuFocus(event);
      }}
      ref={menuRef}
      role="menu"
      style={{ left, top }}
      tabIndex={-1}
    >
      <LayoutMenuToggle checked={sidebarOpen} label="Primary Side Bar" onClick={onToggleSidebar} />
      <LayoutMenuToggle checked={panelOpen} label="Panel" onClick={onTogglePanel} />
      <button
        aria-disabled="true"
        className="docode-workbench__layout-menu-item"
        disabled
        role="menuitem"
        tabIndex={-1}
        type="button"
      >
        <span className="docode-workbench__layout-menu-check" />
        Secondary Side Bar (Unavailable)
      </button>
      <div className="docode-workbench__layout-menu-separator" role="separator" />
      <button
        className="docode-workbench__layout-menu-item"
        onClick={onOpenCommandPalette}
        role="menuitem"
        tabIndex={-1}
        type="button"
      >
        <span className="docode-workbench__layout-menu-check" />
        Open Command Palette...
      </button>
    </div>
  );
}

function LayoutMenuToggle({
  checked,
  label,
  onClick,
}: {
  readonly checked: boolean;
  readonly label: string;
  readonly onClick: () => void;
}) {
  return (
    <button
      aria-checked={checked}
      className="docode-workbench__layout-menu-item"
      onClick={onClick}
      role="menuitemcheckbox"
      tabIndex={-1}
      type="button"
    >
      <span className="docode-workbench__layout-menu-check">
        {checked ? <Codicon name="check" /> : null}
      </span>
      {label}
    </button>
  );
}

function moveLayoutMenuFocus(event: KeyboardEvent<HTMLDivElement>) {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  const items = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>(
      '[role="menuitem"], [role="menuitemcheckbox"]',
    ),
  ).filter((item) => !item.hasAttribute('disabled'));
  if (items.length === 0) return;
  const currentIndex = items.indexOf(document.activeElement as HTMLElement);
  const nextIndex =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? items.length - 1
        : event.key === 'ArrowUp'
          ? (currentIndex - 1 + items.length) % items.length
          : (currentIndex + 1) % items.length;
  items[nextIndex]?.focus();
  event.preventDefault();
}

function ProductMark() {
  return (
    <span aria-hidden="true" className="docode-workbench__product-mark" title="DOCode">
      <Codicon name="remote" />
    </span>
  );
}

interface MacTrafficLightsProps {
  readonly client: WindowFullscreenClient;
}

type FullscreenMode = 'document' | 'unsupported' | 'window';

function MacTrafficLights({ client }: MacTrafficLightsProps) {
  const lightsRef = useRef<HTMLSpanElement | null>(null);
  const mountedRef = useRef(false);
  const [fullscreenActive, setFullscreenActive] = useState(false);
  const [fullscreenError, setFullscreenError] = useState<string | null>(null);
  const [fullscreenMode, setFullscreenMode] = useState<FullscreenMode>('unsupported');

  useEffect(() => {
    const lights = lightsRef.current;
    const owner = lights?.closest<HTMLElement>('[data-docode-workbench-root]') ?? null;
    const ownerDocument = owner?.ownerDocument;
    const fullscreenTarget = ownerDocument?.documentElement;
    mountedRef.current = true;

    if (!owner || !ownerDocument || !fullscreenTarget) {
      setFullscreenMode('unsupported');
      return () => {
        mountedRef.current = false;
      };
    }

    let syncGeneration = 0;
    const documentFullscreenSupported =
      ownerDocument.fullscreenEnabled &&
      typeof fullscreenTarget.requestFullscreen === 'function' &&
      typeof ownerDocument.exitFullscreen === 'function';
    const syncFullscreenState = async () => {
      const generation = ++syncGeneration;
      const windowState = await client.getState();
      if (!mountedRef.current || generation !== syncGeneration) return;

      if (windowState.supported) {
        setFullscreenMode('window');
        setFullscreenActive(windowState.active);
      } else if (documentFullscreenSupported) {
        setFullscreenMode('document');
        setFullscreenActive(ownerDocument.fullscreenElement === fullscreenTarget);
      } else {
        setFullscreenMode('unsupported');
        setFullscreenActive(false);
      }
      setFullscreenError(null);
    };

    const syncFromEvent = () => {
      void syncFullscreenState();
    };
    void syncFullscreenState();
    ownerDocument.addEventListener('fullscreenchange', syncFromEvent);
    ownerDocument.addEventListener('visibilitychange', syncFromEvent);
    window.addEventListener('focus', syncFromEvent);
    window.addEventListener('pageshow', syncFromEvent);
    window.addEventListener('resize', syncFromEvent);
    return () => {
      mountedRef.current = false;
      ownerDocument.removeEventListener('fullscreenchange', syncFromEvent);
      ownerDocument.removeEventListener('visibilitychange', syncFromEvent);
      window.removeEventListener('focus', syncFromEvent);
      window.removeEventListener('pageshow', syncFromEvent);
      window.removeEventListener('resize', syncFromEvent);
    };
  }, [client]);

  const toggleFullscreen = () => {
    const lights = lightsRef.current;
    const owner = lights?.closest<HTMLElement>('[data-docode-workbench-root]') ?? null;
    const ownerDocument = owner?.ownerDocument;
    const fullscreenTarget = ownerDocument?.documentElement;
    if (!owner || !ownerDocument || !fullscreenTarget || fullscreenMode === 'unsupported') return;

    setFullscreenError(null);
    if (fullscreenMode === 'window') {
      const nextActive = !fullscreenActive;
      void client.setActive(nextActive).then(
        (state) => {
          if (!mountedRef.current) return;
          setFullscreenActive(state.active);
          setFullscreenError(null);
        },
        () => {
          if (!mountedRef.current) return;
          setFullscreenError(
            fullscreenActive ? 'Unable to exit full screen.' : 'Unable to enter full screen.',
          );
        },
      );
      return;
    }

    const operation = fullscreenActive
      ? ownerDocument.exitFullscreen()
      : fullscreenTarget.requestFullscreen();
    void operation.catch(() => {
      if (!mountedRef.current) return;
      setFullscreenError(
        fullscreenActive ? 'Unable to exit full screen.' : 'Unable to enter full screen.',
      );
      setFullscreenActive(ownerDocument.fullscreenElement === fullscreenTarget);
    });
  };

  const fullscreenSupported = fullscreenMode !== 'unsupported';

  return (
    <span className="docode-workbench__traffic-lights" ref={lightsRef}>
      <span aria-hidden="true" className="docode-workbench__traffic-light" data-tone="close">
        <span className="docode-workbench__traffic-light-glyph" data-glyph="close" />
      </span>
      <span aria-hidden="true" className="docode-workbench__traffic-light" data-tone="minimize">
        <span className="docode-workbench__traffic-light-glyph" data-glyph="minimize" />
      </span>
      <button
        aria-label={
          fullscreenSupported
            ? fullscreenActive
              ? 'Exit Full Screen'
              : 'Enter Full Screen'
            : 'Full Screen unavailable'
        }
        aria-pressed={fullscreenActive}
        className="docode-workbench__traffic-light"
        data-docode-tooltip={
          fullscreenSupported
            ? fullscreenActive
              ? 'Exit Full Screen'
              : 'Enter Full Screen'
            : 'Full Screen is unavailable in this browser'
        }
        data-fullscreen-active={fullscreenActive}
        data-tone="maximize"
        disabled={!fullscreenSupported}
        onClick={toggleFullscreen}
        type="button"
      >
        <span
          aria-hidden="true"
          className="docode-workbench__traffic-light-glyph"
          data-glyph="zoom"
        />
      </button>
      {fullscreenError ? (
        <span aria-live="polite" className="docode-sr-only" role="status">
          {fullscreenError}
        </span>
      ) : null}
    </span>
  );
}

function WindowsMenuBar() {
  const labels = getWindowsMenuLabels(globalThis.navigator.language);
  return (
    <span aria-hidden="true" className="docode-workbench__menubar">
      {labels.map((label) => (
        <span className="docode-workbench__menubar-item" key={label}>
          {label}
        </span>
      ))}
    </span>
  );
}

function WindowsWindowControls() {
  return (
    <span aria-hidden="true" className="docode-workbench__window-controls">
      <span className="docode-workbench__window-control">
        <Codicon name="chrome-minimize" />
      </span>
      <span className="docode-workbench__window-control">
        <Codicon name="chrome-maximize" />
      </span>
      <span className="docode-workbench__window-control docode-workbench__window-control--close">
        <Codicon name="chrome-close" />
      </span>
    </span>
  );
}

function getWindowsMenuLabels(language: string | undefined): readonly string[] {
  return language?.toLowerCase().startsWith('zh')
    ? ['文件', '编辑', '选择', '查看', '转到', '运行', '终端', '帮助']
    : ['File', 'Edit', 'Selection', 'View', 'Go', 'Run', 'Terminal', 'Help'];
}
