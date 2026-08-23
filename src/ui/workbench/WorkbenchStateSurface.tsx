import { useEffect, useRef, useState } from 'react';

import { Codicon } from '../icons/codicon';
import type { WorkbenchSurfaceState } from './workbenchSurfaceState';

export interface WorkbenchStateActions {
  readonly onRetry: () => Promise<void> | void;
  readonly onUseOriginal: (() => Promise<void>) | null;
}

interface WorkbenchStateSurfaceProps {
  readonly actions: WorkbenchStateActions;
  readonly state: WorkbenchSurfaceState;
}

type PendingAction = 'original' | 'retry' | null;

export function WorkbenchStateSurface({ actions, state }: WorkbenchStateSurfaceProps) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);
  const mounted = useRef(true);

  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  if (state.kind === 'ready' || state.kind === 'loading' || !state.icon) return null;

  const run = async (
    action: Exclude<PendingAction, null>,
    callback: () => Promise<void> | void,
  ) => {
    setActionError(null);
    setPending(action);
    try {
      await callback();
    } catch {
      if (mounted.current) {
        setActionError(
          'The recovery action failed. Use the extension control to restore Linux DO.',
        );
      }
    } finally {
      if (mounted.current) setPending(null);
    }
  };

  return (
    <div className="docode-workbench__state-surface" data-docode-state={state.kind}>
      <div className="docode-workbench__state-icon">
        <Codicon name={state.icon} />
      </div>
      <div
        aria-live={state.kind === 'error' ? undefined : 'polite'}
        className="docode-workbench__state-label"
        role={state.kind === 'error' ? 'alert' : 'status'}
      >
        <h2>{state.title}</h2>
        <p>{state.description}</p>
        {actionError ? <p className="docode-workbench__state-action-error">{actionError}</p> : null}
      </div>
      <div className="docode-workbench__state-actions">
        {state.retryLabel ? (
          <button
            className="docode-workbench__state-button docode-workbench__state-button--primary"
            disabled={pending !== null}
            onClick={() => void run('retry', actions.onRetry)}
            type="button"
          >
            <Codicon
              name={pending === 'retry' ? 'loading' : 'refresh'}
              spin={pending === 'retry'}
            />
            {state.retryLabel}
          </button>
        ) : null}
        {actions.onUseOriginal ? (
          <button
            className={`docode-workbench__state-button${state.retryLabel ? '' : ' docode-workbench__state-button--primary'}`}
            data-docode-tooltip="Disable DOCode and restore the original Linux DO page"
            disabled={pending !== null}
            onClick={() => {
              if (actions.onUseOriginal) void run('original', actions.onUseOriginal);
            }}
            type="button"
          >
            <Codicon
              name={pending === 'original' ? 'loading' : 'debug-disconnect'}
              spin={pending === 'original'}
            />
            Use Original Linux DO
          </button>
        ) : null}
      </div>
    </div>
  );
}
