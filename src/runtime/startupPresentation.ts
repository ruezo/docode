const STARTUP_MARKER = 'data-docode-startup';

export interface StartupPresentation {
  readonly end: () => boolean;
}

export function beginStartupPresentation(
  document: Document,
  ownerToken: string = globalThis.crypto.randomUUID(),
): StartupPresentation | null {
  const root = document.documentElement;
  if (root.hasAttribute(STARTUP_MARKER)) return null;

  let active = true;
  root.setAttribute(STARTUP_MARKER, ownerToken);

  return {
    end: () => {
      if (!active) return false;
      active = false;
      if (root.getAttribute(STARTUP_MARKER) === ownerToken) {
        root.removeAttribute(STARTUP_MARKER);
      }
      return true;
    },
  };
}

export async function waitForInitialDocument(
  document: Document,
  signal?: AbortSignal,
): Promise<boolean> {
  if (signal?.aborted) return false;
  if (isInitialDocumentReady(document)) return true;

  return new Promise<boolean>((resolve) => {
    let settled = false;

    function finish(ready: boolean) {
      if (settled) return;
      settled = true;
      document.removeEventListener('DOMContentLoaded', finishWhenReady);
      document.removeEventListener('readystatechange', finishWhenReady);
      signal?.removeEventListener('abort', finishAborted);
      resolve(ready);
    }

    function finishWhenReady() {
      if (isInitialDocumentReady(document)) finish(true);
    }

    function finishAborted() {
      finish(false);
    }

    document.addEventListener('DOMContentLoaded', finishWhenReady);
    document.addEventListener('readystatechange', finishWhenReady);
    signal?.addEventListener('abort', finishAborted, { once: true });
    finishWhenReady();
    if (signal?.aborted) finishAborted();
  });
}

function isInitialDocumentReady(document: Document): boolean {
  return document.querySelector('body') !== null && document.readyState !== 'loading';
}
