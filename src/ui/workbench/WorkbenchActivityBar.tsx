import { Codicon, type CodiconName } from '../icons/codicon';

interface WorkbenchActivityBarProps {
  readonly onOpenExplorer: () => void;
  readonly onOpenQuickOpen: () => void;
  readonly onOpenSettings: () => void;
  readonly onRestoreOriginal: (() => void) | null;
  readonly settingsOpen: boolean;
  readonly sidebarOpen: boolean;
}

export function WorkbenchActivityBar({
  onOpenExplorer,
  onOpenQuickOpen,
  onOpenSettings,
  onRestoreOriginal,
  settingsOpen,
  sidebarOpen,
}: WorkbenchActivityBarProps) {
  return (
    <nav className="docode-workbench__activitybar" aria-label="Activity Bar">
      <div className="docode-workbench__activity-group">
        <ActivityAction
          active={sidebarOpen}
          icon="files"
          label="Explorer"
          onClick={onOpenExplorer}
        />
        <ActivityAction icon="search" label="Search and Quick Open" onClick={onOpenQuickOpen} />
        <a
          aria-label="Latest Linux DO topics"
          className="docode-workbench__activity-action"
          data-docode-tooltip="Latest Linux DO topics"
          href="https://linux.do/latest"
        >
          <Codicon name="source-control" />
        </a>
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
        <a
          aria-label="Linux DO account"
          className="docode-workbench__activity-action"
          data-docode-tooltip="Linux DO account"
          href="https://linux.do/my/activity"
        >
          <Codicon name="account" />
        </a>
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
