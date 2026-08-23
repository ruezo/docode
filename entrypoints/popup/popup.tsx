import { useCallback, useEffect, useState } from 'react';

import type { ContentRuntimeStatus } from '../../src/messaging/contracts';
import {
  detectWorkbenchOperatingSystem,
  type WorkbenchOperatingSystem,
} from '../../src/platform/workbenchPlatform';
import { Codicon, type CodiconName } from '../../src/ui/icons/codicon';
import type { PopupClient, PopupStatus } from './popupClient';

type ViewState =
  | { readonly phase: 'error' }
  | { readonly phase: 'loading' }
  | { readonly pending: boolean; readonly phase: 'ready'; readonly status: ContentRuntimeStatus }
  | { readonly phase: 'unsupported' };

interface PopupProps {
  readonly client: PopupClient;
  readonly platform?: WorkbenchOperatingSystem;
}

export function Popup({ client, platform = detectWorkbenchOperatingSystem() }: PopupProps) {
  const [viewState, setViewState] = useState<ViewState>({ phase: 'loading' });

  const refresh = useCallback(async () => {
    try {
      setViewState(toViewState(await client.getStatus()));
    } catch {
      setViewState({ phase: 'error' });
    }
  }, [client]);

  useEffect(() => {
    let active = true;
    void client.getStatus().then(
      (status) => {
        if (active) setViewState(toViewState(status));
      },
      () => {
        if (active) setViewState({ phase: 'error' });
      },
    );

    return () => {
      active = false;
    };
  }, [client]);

  async function setEnabled(enabled: boolean): Promise<void> {
    if (viewState.phase !== 'ready') return;
    setViewState({ ...viewState, pending: true });
    try {
      const status = await client.setEnabled(enabled);
      setViewState({ pending: false, phase: 'ready', status });
    } catch {
      setViewState({ phase: 'error' });
    }
  }

  async function restoreOriginal(): Promise<void> {
    if (viewState.phase !== 'ready') return;
    setViewState({ ...viewState, pending: true });
    try {
      const status = await client.restoreOriginal();
      setViewState({ pending: false, phase: 'ready', status });
    } catch {
      setViewState({ phase: 'error' });
    }
  }

  return (
    <main className="docode-popup" data-platform={platform}>
      <PopupTitleBar platform={platform} />

      <div className="docode-popup__workbench">
        <PopupActivityBar />

        <div className="docode-popup__welcome">
          <header className="docode-popup__header">
            <img className="docode-popup__icon" src="/icon/48.png" width="30" height="30" alt="" />
            <div className="docode-popup__identity">
              <div className="docode-popup__product-line">
                <h1>DOCODE</h1>
                <span className="docode-popup__version">v1.0.0</span>
              </div>
              <p>LINUX DO, in editor mode.</p>
            </div>
          </header>

          <PopupQuickActions
            viewState={viewState}
            onRetry={() => {
              void refresh();
            }}
            onSetEnabled={(enabled) => {
              void setEnabled(enabled);
            }}
            onRestoreOriginal={() => {
              void restoreOriginal();
            }}
          />
        </div>
      </div>

      <PopupStatusBar viewState={viewState} />
    </main>
  );
}

function PopupTitleBar({ platform }: { readonly platform: WorkbenchOperatingSystem }) {
  return (
    <div className="docode-popup__titlebar" aria-hidden="true">
      {platform === 'mac' ? (
        <div className="docode-popup__traffic-lights">
          <span className="docode-popup__traffic-light docode-popup__traffic-light--close" />
          <span className="docode-popup__traffic-light docode-popup__traffic-light--minimize" />
          <span className="docode-popup__traffic-light docode-popup__traffic-light--maximize" />
        </div>
      ) : null}
      <span className="docode-popup__window-title">DOCODE</span>
      {platform === 'windows' ? (
        <div className="docode-popup__window-controls">
          <Codicon name="chrome-minimize" />
          <Codicon name="chrome-maximize" />
          <Codicon name="chrome-close" />
        </div>
      ) : null}
    </div>
  );
}

function PopupActivityBar() {
  return (
    <nav className="docode-popup__activity-bar" aria-label="Activity bar">
      <div className="docode-popup__activity-group">
        <ActivityItem icon="files" label="Explorer" />
        <ActivityItem icon="search" label="Search" />
        <span
          className="docode-popup__activity-item docode-popup__activity-item--active"
          role="img"
          aria-label="DOCODE, active"
          title="DOCODE"
        >
          <img src="/icon/48.png" width="20" height="20" alt="" />
        </span>
        <ActivityItem icon="settings-gear" label="Settings" />
      </div>
    </nav>
  );
}

interface ActivityItemProps {
  readonly icon: CodiconName;
  readonly label: string;
}

function ActivityItem({ icon, label }: ActivityItemProps) {
  return (
    <span className="docode-popup__activity-item" role="img" aria-label={label} title={label}>
      <Codicon name={icon} />
    </span>
  );
}

interface PopupQuickActionsProps {
  readonly onRestoreOriginal: () => void;
  readonly onRetry: () => void;
  readonly onSetEnabled: (enabled: boolean) => void;
  readonly viewState: ViewState;
}

function PopupQuickActions({
  onRestoreOriginal,
  onRetry,
  onSetEnabled,
  viewState,
}: PopupQuickActionsProps) {
  const ready = viewState.phase === 'ready';
  const pending = ready && viewState.pending;
  const enabled = ready && viewState.status.enabled;
  const presentation = getConnectionPresentation(viewState);

  return (
    <section className="docode-popup__quick-actions" aria-labelledby="quick-actions-title">
      <h2 id="quick-actions-title">Quick Actions</h2>
      <div className="docode-popup__action-list">
        <label className="docode-popup__action docode-popup__action--toggle">
          <Codicon name={enabled ? 'check' : 'circle-slash'} />
          <span>
            <strong>Enabled on LINUX DO</strong>
            <small
              className={`docode-popup__action-detail docode-popup__action-detail--${presentation.tone}`}
              role={viewState.phase === 'error' ? 'alert' : 'status'}
            >
              {presentation.detail}
            </small>
          </span>
          <span className="docode-popup__toggle">
            <input
              type="checkbox"
              aria-label="Enabled on LINUX DO"
              checked={enabled}
              disabled={!ready || pending}
              onChange={(event) => {
                onSetEnabled(event.currentTarget.checked);
              }}
            />
            <span className="docode-popup__toggle-track" aria-hidden="true">
              <span className="docode-popup__toggle-thumb" />
            </span>
          </span>
        </label>
        <button
          className="docode-popup__action docode-popup__action--primary"
          type="button"
          disabled={!enabled || pending}
          onClick={onRestoreOriginal}
        >
          <Codicon name="debug-disconnect" />
          <span>
            <strong>Use original LINUX DO</strong>
            <small>Restore the forum view</small>
          </span>
          <Codicon name="chevron-right" />
        </button>
        {viewState.phase === 'error' ? (
          <button className="docode-popup__action" type="button" onClick={onRetry}>
            <Codicon name="refresh" />
            <span>
              <strong>Retry</strong>
              <small>Reconnect to the active tab</small>
            </span>
            <Codicon name="chevron-right" />
          </button>
        ) : (
          <button
            className="docode-popup__action"
            type="button"
            disabled
            title="Not available in the Popup"
          >
            <Codicon name="file" />
            <span>
              <strong>Documentation</strong>
              <small>Learn DOCODE</small>
            </span>
            <Codicon name="chevron-right" />
          </button>
        )}
      </div>
    </section>
  );
}

function PopupStatusBar({ viewState }: { readonly viewState: ViewState }) {
  const presentation = getConnectionPresentation(viewState);
  return (
    <footer className="docode-popup__statusbar" aria-label="DOCode status">
      <span>⎇ main</span>
      <span className="docode-popup__statusbar-connection">
        <span aria-hidden="true">●</span>
        {presentation.statusBarLabel}
      </span>
      <span className="docode-popup__statusbar-end">LINUX DO</span>
    </footer>
  );
}

interface ConnectionPresentation {
  readonly detail: string;
  readonly statusBarLabel: string;
  readonly tone: 'connected' | 'muted' | 'warning';
}

function getConnectionPresentation(viewState: ViewState): ConnectionPresentation {
  if (viewState.phase === 'loading') {
    return {
      detail: 'Checking the active tab…',
      statusBarLabel: 'checking LINUX DO',
      tone: 'muted',
    };
  }
  if (viewState.phase === 'unsupported') {
    return {
      detail: 'Open a LINUX DO tab to use DOCODE.',
      statusBarLabel: 'LINUX DO unavailable',
      tone: 'muted',
    };
  }
  if (viewState.phase === 'error') {
    return {
      detail: 'DOCODE could not reach the active tab.',
      statusBarLabel: 'connection error',
      tone: 'warning',
    };
  }
  if (viewState.pending) {
    return { detail: 'Updating…', statusBarLabel: 'updating LINUX DO', tone: 'muted' };
  }
  if (viewState.status.storageRecovered) {
    return {
      detail: 'An invalid saved setting was reset safely.',
      statusBarLabel: 'setting recovered',
      tone: 'warning',
    };
  }
  if (viewState.status.enabled && viewState.status.mounted) {
    return { detail: 'Editor mode active', statusBarLabel: 'docode connected', tone: 'connected' };
  }
  if (viewState.status.enabled) {
    return {
      detail: 'Page runtime unavailable',
      statusBarLabel: 'runtime unavailable',
      tone: 'warning',
    };
  }
  return {
    detail: 'Original LINUX DO is active.',
    statusBarLabel: 'original LINUX DO',
    tone: 'muted',
  };
}

function toViewState(status: PopupStatus): ViewState {
  return status.kind === 'unsupported'
    ? { phase: 'unsupported' }
    : { pending: false, phase: 'ready', status: status.status };
}
