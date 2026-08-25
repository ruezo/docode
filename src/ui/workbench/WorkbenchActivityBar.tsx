import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react';

import type { NotificationsLoadOutcome } from '../../linuxdo/notificationsLoader';
import { Codicon, type CodiconName } from '../icons/codicon';

interface WorkbenchActivityBarProps {
  readonly explorerActive: boolean;
  readonly historyActive: boolean;
  readonly onLoadNotifications?:
    ((signal: AbortSignal) => Promise<NotificationsLoadOutcome>) | undefined;
  readonly onOpenExplorer: () => void;
  readonly onOpenHistory: () => void;
  readonly onOpenQuickOpen: () => void;
  readonly onOpenSettings: () => void;
  readonly onRestoreOriginal: (() => void) | null;
  readonly settingsOpen: boolean;
  readonly unreadNotifications?: number;
}

const ACCOUNT_PREFERENCES_URL = 'https://linux.do/my/activity';

export function WorkbenchActivityBar({
  explorerActive,
  historyActive,
  onLoadNotifications,
  onOpenExplorer,
  onOpenHistory,
  onOpenQuickOpen,
  onOpenSettings,
  onRestoreOriginal,
  settingsOpen,
  unreadNotifications = 0,
}: WorkbenchActivityBarProps) {
  return (
    <nav className="docode-workbench__activitybar" aria-label="Activity Bar">
      <div className="docode-workbench__activity-group">
        <ActivityAction
          active={explorerActive}
          icon="files"
          label="Explorer"
          onClick={onOpenExplorer}
        />
        <ActivityAction icon="search" label="Search and Quick Open" onClick={onOpenQuickOpen} />
        <ActivityAction
          active={historyActive}
          icon="source-control"
          label="Source Control Browse History"
          onClick={onOpenHistory}
        />
        <ActivityAction disabled icon="debug-alt" label="Run and Debug unavailable" unavailable />
        <ActivityAction
          badge="warning"
          disabled
          icon="extensions"
          label="Extensions unavailable"
          unavailable
        />
        <ActivityAction
          disabled={onRestoreOriginal === null}
          icon="remote-explorer"
          label={onRestoreOriginal ? 'Return to native Linux DO' : 'Native Linux DO unavailable'}
          onClick={onRestoreOriginal ?? undefined}
        />
      </div>
      <div className="docode-workbench__activity-group docode-workbench__activity-group--bottom">
        <AccountAction
          onLoadNotifications={onLoadNotifications}
          unreadNotifications={unreadNotifications}
        />
        <ActivityAction
          active={settingsOpen}
          icon="settings-gear"
          label="Settings"
          onClick={onOpenSettings}
        />
      </div>
    </nav>
  );
}

function AccountAction({
  onLoadNotifications,
  unreadNotifications,
}: {
  readonly onLoadNotifications:
    ((signal: AbortSignal) => Promise<NotificationsLoadOutcome>) | undefined;
  readonly unreadNotifications: number;
}) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuPosition, setMenuPosition] = useState<{
    readonly bottom: number;
    readonly left: number;
  } | null>(null);
  const accountLabel =
    unreadNotifications > 0
      ? `Linux DO account, ${String(unreadNotifications)} unread ${unreadNotifications === 1 ? 'notification' : 'notifications'}`
      : 'Linux DO account';
  const badge =
    unreadNotifications > 0 ? (
      <span className="docode-workbench__activity-badge" data-tone="count">
        {unreadNotifications > 99 ? '99+' : unreadNotifications}
      </span>
    ) : null;

  useEffect(() => {
    if (!menuPosition) return;
    const ownerDocument = menuRef.current?.ownerDocument;
    const ownerWindow = ownerDocument?.defaultView;
    if (!ownerDocument || !ownerWindow) return;
    menuRef.current?.focus();

    const dismiss = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) {
        setMenuPosition(null);
      }
    };
    const dismissOnBlur = () => {
      setMenuPosition(null);
    };
    ownerDocument.addEventListener('pointerdown', dismiss, true);
    ownerWindow.addEventListener('blur', dismissOnBlur);
    return () => {
      ownerDocument.removeEventListener('pointerdown', dismiss, true);
      ownerWindow.removeEventListener('blur', dismissOnBlur);
    };
  }, [menuPosition]);

  if (!onLoadNotifications) {
    return (
      <a
        aria-label={accountLabel}
        className="docode-workbench__activity-action"
        data-docode-tooltip={accountLabel}
        href={ACCOUNT_PREFERENCES_URL}
      >
        <Codicon name="account" />
        {badge}
      </a>
    );
  }

  const toggleMenu = () => {
    if (menuPosition) {
      setMenuPosition(null);
      return;
    }
    const button = buttonRef.current;
    const ownerWindow = button?.ownerDocument.defaultView;
    if (!button || !ownerWindow) return;
    const rect = button.getBoundingClientRect();
    setMenuPosition({
      bottom: Math.max(4, ownerWindow.innerHeight - rect.bottom),
      left: rect.right + 6,
    });
  };

  return (
    <>
      <button
        aria-expanded={menuPosition !== null}
        aria-haspopup="menu"
        aria-label={accountLabel}
        className="docode-workbench__activity-action"
        data-docode-tooltip={accountLabel}
        onClick={toggleMenu}
        ref={buttonRef}
        type="button"
      >
        <Codicon name="account" />
        {badge}
      </button>
      {menuPosition ? (
        <AccountMenu
          bottom={menuPosition.bottom}
          left={menuPosition.left}
          menuRef={menuRef}
          onClose={() => {
            setMenuPosition(null);
            buttonRef.current?.focus();
          }}
          onDismiss={() => {
            setMenuPosition(null);
          }}
          onLoadNotifications={onLoadNotifications}
        />
      ) : null}
    </>
  );
}

function AccountMenu({
  bottom,
  left,
  menuRef,
  onClose,
  onDismiss,
  onLoadNotifications,
}: {
  readonly bottom: number;
  readonly left: number;
  readonly menuRef: RefObject<HTMLDivElement | null>;
  readonly onClose: () => void;
  readonly onDismiss: () => void;
  readonly onLoadNotifications: (signal: AbortSignal) => Promise<NotificationsLoadOutcome>;
}) {
  const [outcome, setOutcome] = useState<NotificationsLoadOutcome | null>(null);
  const labels = getAccountMenuLabels(globalThis.navigator.language);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    onLoadNotifications(controller.signal).then(
      (result) => {
        if (active && result.kind !== 'aborted') setOutcome(result);
      },
      () => {
        if (active) setOutcome({ kind: 'unavailable' });
      },
    );
    return () => {
      active = false;
      controller.abort();
    };
  }, [onLoadNotifications]);

  return (
    <div
      aria-label="Linux DO notifications"
      className="docode-workbench__account-menu"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          onClose();
          event.preventDefault();
          return;
        }
        moveAccountMenuFocus(event);
      }}
      ref={menuRef}
      role="menu"
      style={{ bottom, left }}
      tabIndex={-1}
    >
      <div className="docode-workbench__account-menu-title" role="presentation">
        {labels.title}
      </div>
      <AccountMenuContent labels={labels} onNavigate={onDismiss} outcome={outcome} />
      <div className="docode-workbench__layout-menu-separator" role="separator" />
      <a
        className="docode-workbench__account-menu-item"
        href={ACCOUNT_PREFERENCES_URL}
        onClick={onDismiss}
        role="menuitem"
        tabIndex={-1}
      >
        <Codicon name="settings-gear" />
        <span className="docode-workbench__account-menu-text">{labels.preferences}</span>
      </a>
    </div>
  );
}

function AccountMenuContent({
  labels,
  onNavigate,
  outcome,
}: {
  readonly labels: AccountMenuLabels;
  readonly onNavigate: () => void;
  readonly outcome: NotificationsLoadOutcome | null;
}) {
  if (!outcome) return <AccountMenuStatus text={labels.loading} />;
  if (outcome.kind === 'authentication-required') return <AccountMenuStatus text={labels.signIn} />;
  if (outcome.kind !== 'ready') return <AccountMenuStatus text={labels.error} />;
  if (outcome.notifications.length === 0) return <AccountMenuStatus text={labels.empty} />;
  return (
    <>
      {outcome.notifications.map((notification) => {
        const text = notification.username
          ? `@${notification.username} · ${notification.label}`
          : notification.label;
        return (
          <a
            className="docode-workbench__account-menu-item"
            data-read={notification.read ? 'true' : 'false'}
            href={notification.url}
            key={notification.id}
            onClick={onNavigate}
            role="menuitem"
            tabIndex={-1}
            title={text}
          >
            <span
              aria-hidden="true"
              className="docode-workbench__account-menu-dot"
              data-read={notification.read ? 'true' : 'false'}
            />
            <span className="docode-workbench__account-menu-text">{text}</span>
          </a>
        );
      })}
    </>
  );
}

function AccountMenuStatus({ text }: { readonly text: string }) {
  return (
    <div className="docode-workbench__account-menu-status" role="presentation">
      {text}
    </div>
  );
}

interface AccountMenuLabels {
  readonly empty: string;
  readonly error: string;
  readonly loading: string;
  readonly preferences: string;
  readonly signIn: string;
  readonly title: string;
}

function getAccountMenuLabels(language: string | undefined): AccountMenuLabels {
  return language?.toLowerCase().startsWith('zh')
    ? {
        empty: '暂无新消息',
        error: '消息加载失败',
        loading: '正在加载消息…',
        preferences: '偏好设置',
        signIn: '登录 Linux DO 后查看消息',
        title: '消息',
      }
    : {
        empty: 'No recent notifications',
        error: 'Notifications are unavailable',
        loading: 'Loading notifications…',
        preferences: 'Preferences',
        signIn: 'Sign in to Linux DO to see notifications',
        title: 'Notifications',
      };
}

function moveAccountMenuFocus(event: KeyboardEvent<HTMLDivElement>) {
  if (!['ArrowDown', 'ArrowUp', 'End', 'Home'].includes(event.key)) return;
  const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'));
  if (items.length === 0) return;
  const currentIndex = items.indexOf(
    event.currentTarget.ownerDocument.activeElement as HTMLElement,
  );
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

function ActivityAction({
  active,
  badge,
  disabled = false,
  icon,
  label,
  onClick,
  unavailable = false,
}: {
  readonly active?: boolean;
  readonly badge?: 'sync' | 'warning';
  readonly disabled?: boolean;
  readonly icon: CodiconName;
  readonly label: string;
  readonly onClick?: (() => void) | undefined;
  readonly unavailable?: boolean;
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={active ?? undefined}
      className="docode-workbench__activity-action"
      data-active={active === true ? 'true' : undefined}
      data-docode-tooltip={label}
      data-unavailable={unavailable ? 'true' : undefined}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <Codicon name={icon} />
      {badge ? (
        <span className="docode-workbench__activity-badge" data-tone={badge}>
          <Codicon name={badge} />
        </span>
      ) : null}
    </button>
  );
}
