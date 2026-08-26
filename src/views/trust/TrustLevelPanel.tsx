import type { LinuxDoTrustLevelSnapshot } from '../../linuxdo/trustLevelLoader';
import { Codicon } from '../../ui/icons/codicon';
import { createTrustLevelBuildModel, type TrustLevelStep } from './trustLevelModel';

export type TrustLevelPanelState =
  | { readonly status: 'authentication-required' | 'loading' | 'unavailable' }
  | { readonly status: 'ready'; readonly snapshot: LinuxDoTrustLevelSnapshot };

interface TrustLevelPanelProps {
  readonly onRefresh: () => void;
  readonly state: TrustLevelPanelState;
}

export function TrustLevelPanel({ onRefresh, state }: TrustLevelPanelProps) {
  return (
    <section aria-label="Trust level build progress" className="docode-trust">
      {state.status === 'ready' ? (
        <TrustLevelBuild onRefresh={onRefresh} snapshot={state.snapshot} />
      ) : (
        <div className="docode-trust__state" role="status">
          {state.status === 'loading' ? (
            <>
              <Codicon name="loading" spin />
              <p>Reading trust level data from Linux DO…</p>
            </>
          ) : state.status === 'authentication-required' ? (
            <>
              <Codicon name="warning" />
              <p>Sign in to Linux DO to read your trust level build progress.</p>
            </>
          ) : (
            <>
              <Codicon name="error" />
              <p>Linux DO did not return trust level data.</p>
              <button className="docode-trust__retry" onClick={onRefresh} type="button">
                Retry
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function TrustLevelBuild({
  onRefresh,
  snapshot,
}: {
  readonly onRefresh: () => void;
  readonly snapshot: LinuxDoTrustLevelSnapshot;
}) {
  const model = createTrustLevelBuildModel(snapshot);
  const buildTarget =
    model.nextLevel === null
      ? `TL${String(model.currentLevel)}`
      : `TL${String(model.currentLevel)} → TL${String(model.nextLevel)}`;
  const buildSucceeded = model.kind === 'progress' && model.completedSteps === model.steps.length;
  return (
    <>
      <header className="docode-trust__header">
        <span className="docode-trust__badge" data-trust-level={String(model.currentLevel)}>
          <Codicon name="verified" />
          {`TL${String(model.currentLevel)}`}
        </span>
        <h1 className="docode-trust__title">{`trust-level build · ${buildTarget}`}</h1>
        <span className="docode-trust__user">{`@${snapshot.username}`}</span>
        <button
          aria-label="Refresh trust level data"
          className="docode-trust__refresh"
          data-docode-tooltip="Refresh trust level data"
          onClick={onRefresh}
          type="button"
        >
          <Codicon name="refresh" />
        </button>
      </header>
      {model.kind === 'max' ? (
        <p className="docode-trust__note" role="status">
          Trust level 4 is the highest Linux DO trust level. Nothing left to build.
        </p>
      ) : model.kind === 'granted' ? (
        <p className="docode-trust__note" role="status">
          Trust level 4 is granted manually by the Linux DO staff — there is no automatic checklist
          to build against.
        </p>
      ) : (
        <>
          <div
            aria-label={`Build progress toward trust level ${String(model.nextLevel ?? 0)}`}
            aria-valuemax={model.steps.length}
            aria-valuemin={0}
            aria-valuenow={model.completedSteps}
            className="docode-trust__summary"
            role="progressbar"
          >
            <span
              className="docode-trust__summary-status"
              data-state={buildSucceeded ? 'succeeded' : 'running'}
            >
              <Codicon name={buildSucceeded ? 'check' : 'sync'} spin={!buildSucceeded} />
              {buildSucceeded
                ? 'All tracked checks passed'
                : `${String(model.completedSteps)}/${String(model.steps.length)} checks passed`}
            </span>
            <span className="docode-trust__summary-track">
              <span
                className="docode-trust__summary-fill"
                style={{ width: `${String(Math.round(model.progressRatio * 100))}%` }}
              />
            </span>
          </div>
          {model.kind === 'reference' ? (
            <p className="docode-trust__note">
              Trust level 3 is judged on a rolling 100-day window that only the server can compute —
              the values below are lifetime totals shown against the default thresholds.
            </p>
          ) : null}
          <ol className="docode-trust__steps">
            {model.steps.map((step) => (
              <TrustLevelStepRow key={step.id} step={step} />
            ))}
          </ol>
        </>
      )}
      <section aria-label="Lifetime statistics" className="docode-trust__stats">
        <h2 className="docode-trust__stats-title">{'// lifetime stats'}</h2>
        <dl className="docode-trust__stats-grid">
          <TrustLevelStat label="Days visited" value={String(snapshot.daysVisited)} />
          <TrustLevelStat
            label="Reading time"
            value={formatReadingTime(snapshot.timeReadSeconds)}
          />
          <TrustLevelStat label="Topics entered" value={String(snapshot.topicsEntered)} />
          <TrustLevelStat label="Posts read" value={String(snapshot.postsReadCount)} />
          <TrustLevelStat label="Likes given" value={String(snapshot.likesGiven)} />
          <TrustLevelStat label="Likes received" value={String(snapshot.likesReceived)} />
          <TrustLevelStat label="Topics created" value={String(snapshot.topicCount)} />
          <TrustLevelStat label="Replies created" value={String(snapshot.postCount)} />
        </dl>
      </section>
      <footer className="docode-trust__footer">
        <p>
          Targets follow the Discourse defaults; Linux DO may tune them. The authoritative promotion
          report lives at{' '}
          <a href="https://connect.linux.do/" rel="noopener noreferrer" target="_blank">
            connect.linux.do
          </a>
          .
        </p>
      </footer>
    </>
  );
}

function TrustLevelStat({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="docode-trust__stat">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function formatReadingTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  if (hours >= 1) return `${String(hours)} h`;
  return `${String(Math.floor(seconds / 60))} min`;
}

function TrustLevelStepRow({ step }: { readonly step: TrustLevelStep }) {
  const ratio = Math.min(step.value / Math.max(step.target, 1), 1);
  const valueLabel =
    step.unit === 'minutes'
      ? `${String(step.value)} / ${String(step.target)} min`
      : `${String(step.value)} / ${String(step.target)}`;
  return (
    <li className="docode-trust__step" data-complete={step.complete ? 'true' : 'false'}>
      <span aria-hidden="true" className="docode-trust__step-icon">
        <Codicon name={step.complete ? 'check' : 'circle-slash'} />
      </span>
      <span className="docode-trust__step-label">{step.label}</span>
      <span className="docode-trust__step-track">
        <span
          className="docode-trust__step-fill"
          style={{ width: `${String(Math.round(ratio * 100))}%` }}
        />
      </span>
      <span className="docode-trust__step-value">{valueLabel}</span>
    </li>
  );
}
