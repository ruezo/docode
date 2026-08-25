import { useEffect, useState } from 'react';

import { Codicon, type CodiconName } from '../icons/codicon';

export type WorkbenchNotificationSeverity = 'error' | 'info' | 'warning';

export interface WorkbenchNotificationItem {
  readonly id: number;
  readonly message: string;
  readonly severity: WorkbenchNotificationSeverity;
  readonly source: string;
}

const AUTO_DISMISS_MS = 5_000;

const SEVERITY_ICONS: Record<WorkbenchNotificationSeverity, CodiconName> = {
  error: 'error',
  info: 'info',
  warning: 'warning',
};

const SEVERITY_LABELS: Record<WorkbenchNotificationSeverity, string> = {
  error: 'Error',
  info: 'Info',
  warning: 'Warning',
};

export function WorkbenchNotificationToasts({
  items,
  onDismiss,
}: {
  readonly items: readonly WorkbenchNotificationItem[];
  readonly onDismiss: (id: number) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div aria-label="Notifications" className="docode-workbench__notifications" role="region">
      {items.map((item) => (
        <NotificationToast item={item} key={item.id} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function NotificationToast({
  item,
  onDismiss,
}: {
  readonly item: WorkbenchNotificationItem;
  readonly onDismiss: (id: number) => void;
}) {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return undefined;
    const window = globalThis.window;
    const timer = window.setTimeout(() => {
      onDismiss(item.id);
    }, AUTO_DISMISS_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [item.id, onDismiss, paused]);

  return (
    <div
      aria-label={`${SEVERITY_LABELS[item.severity]}: ${item.message}`}
      className="docode-workbench__notification"
      data-severity={item.severity}
      onPointerEnter={() => {
        setPaused(true);
      }}
      onPointerLeave={() => {
        setPaused(false);
      }}
      role="dialog"
    >
      <div className="docode-workbench__notification-main">
        <span className="docode-workbench__notification-icon">
          <Codicon name={SEVERITY_ICONS[item.severity]} />
        </span>
        <p className="docode-workbench__notification-message">{item.message}</p>
        <div className="docode-workbench__notification-toolbar">
          <button
            aria-label="Configure Notification"
            className="docode-workbench__notification-tool"
            onClick={() => {
              onDismiss(item.id);
            }}
            title="Configure Notification"
            type="button"
          >
            <Codicon name="settings-gear" />
          </button>
          <button
            aria-label="Clear Notification"
            className="docode-workbench__notification-tool"
            onClick={() => {
              onDismiss(item.id);
            }}
            title="Clear Notification (Delete)"
            type="button"
          >
            <Codicon name="close" />
          </button>
        </div>
      </div>
      <div className="docode-workbench__notification-footer">
        <span className="docode-workbench__notification-source">Source: {item.source}</span>
      </div>
    </div>
  );
}
