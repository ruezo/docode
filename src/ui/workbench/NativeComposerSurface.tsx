import { useLayoutEffect, useRef } from 'react';

import type { ComposerCapability } from '../../linuxdo/capabilities';
import type { LinuxDoComposerFeedback } from '../../linuxdo/composerAdapter';
import type { NativeContentTransfer } from '../../runtime/nativeContentTransfer';
import { Codicon } from '../icons/codicon';

export function NativeComposerSurface({
  capability,
  feedback,
  nativeContentTransfer,
  revision,
}: {
  readonly capability: ComposerCapability | null;
  readonly feedback: LinuxDoComposerFeedback;
  readonly nativeContentTransfer: NativeContentTransfer;
  readonly revision: number;
}) {
  const host = useRef<HTMLDivElement>(null);
  const wasVisible = useRef(false);
  const visible =
    capability?.root &&
    (capability.state === 'draft' || capability.state === 'open' || capability.state === 'saving');

  useLayoutEffect(() => {
    const target = host.current;
    const root = visible ? capability.root : null;
    if (!target || !root) return;
    return nativeContentTransfer.mount(root, target);
  }, [capability?.root, nativeContentTransfer, visible]);

  useLayoutEffect(() => {
    const target = host.current;
    const root = visible ? capability.root : null;
    if (!target || !root || root.parentElement === target) return;
    nativeContentTransfer.restore(root);
    nativeContentTransfer.mount(root, target);
  }, [capability?.root, nativeContentTransfer, revision, visible]);

  useLayoutEffect(() => {
    const becameVisible = Boolean(visible) && !wasVisible.current;
    wasVisible.current = Boolean(visible);
    const editor = becameVisible ? capability?.editor : null;
    const window = editor?.ownerDocument.defaultView;
    if (!editor || !window) return;
    const frame = window.requestAnimationFrame(() => {
      if (editor.isConnected && host.current?.contains(editor)) editor.focus();
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [capability?.editor, visible]);

  if (!visible) return null;
  const stateLabel = feedback?.message ?? composerStateLabel(capability);
  return (
    <section
      aria-label="Linux DO reply composer"
      className="docode-native-composer"
      data-dirty={capability.dirty ? 'true' : 'false'}
      data-fullscreen={capability.fullscreen ? 'true' : 'false'}
      data-state={capability.state}
    >
      <header className="docode-native-composer__title">
        <span className="docode-native-composer__label">
          <Codicon name="edit" />
          <span>Reply · Linux DO</span>
          {capability.dirty ? (
            <>
              <span aria-hidden="true" className="docode-native-composer__dirty" />
              <span className="docode-sr-only">, unsaved draft</span>
            </>
          ) : null}
        </span>
        <span
          aria-live="polite"
          className="docode-native-composer__state"
          data-error={feedback?.kind === 'error' ? 'true' : undefined}
          role={feedback?.kind === 'error' ? 'alert' : 'status'}
        >
          {stateLabel}
        </span>
      </header>
      <div className="docode-native-composer__host" ref={host} />
    </section>
  );
}

function composerStateLabel(capability: ComposerCapability): string {
  if (capability.errorMessage) return capability.errorMessage;
  switch (capability.state) {
    case 'draft':
      return 'Draft saved by Linux DO';
    case 'saving':
      return 'Linux DO is saving…';
    case 'open':
      return capability.dirty ? 'Unsaved reply draft' : 'Native composer';
    case 'authentication-required':
    case 'closed':
    case 'unavailable':
      return '';
  }
}
