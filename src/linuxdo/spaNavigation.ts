import {
  SPA_NAVIGATE_RESULT_EVENT,
  dispatchSpaNavigate,
  readSpaNavigateResult,
} from './pageBridge';
import { recognizeLinuxDoRoute } from './routes';

export function installWorkbenchSpaNavigation(document: Document, root: HTMLElement): () => void {
  const onClick = (event: MouseEvent) => {
    const href = interceptableHref(document, root, event);
    if (href === null) return;
    if (href === document.location.href) {
      event.preventDefault();
      return;
    }
    if (requestSpaNavigation(document, href)) event.preventDefault();
  };
  document.addEventListener('click', onClick);
  return () => {
    document.removeEventListener('click', onClick);
  };
}

export function requestSpaNavigation(document: Document, href: string): boolean {
  const target = toAppPath(document, href);
  if (target === null) return false;
  let ok = false;
  const onResult = (event: Event) => {
    const result = readSpaNavigateResult(event);
    if (result?.path === target) ok = result.ok;
  };
  document.addEventListener(SPA_NAVIGATE_RESULT_EVENT, onResult);
  dispatchSpaNavigate(document, { path: target });
  document.removeEventListener(SPA_NAVIGATE_RESULT_EVENT, onResult);
  return ok;
}

function interceptableHref(
  document: Document,
  root: HTMLElement,
  event: MouseEvent,
): string | null {
  if (event.defaultPrevented || event.button !== 0) return null;
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null;
  const window = document.defaultView;
  if (!window) return null;
  const node = event.target;
  if (!(node instanceof window.Element)) return null;
  const anchor = node.closest('a[href]');
  if (!(anchor instanceof window.HTMLAnchorElement) || !root.contains(anchor)) return null;
  if (anchor.target === '_blank' || anchor.hasAttribute('download')) return null;
  const route = recognizeLinuxDoRoute(anchor.href);
  if (route.kind === 'unsupported') return null;
  return anchor.href;
}

function toAppPath(document: Document, href: string): string | null {
  try {
    const url = new URL(href, document.location.href);
    if (url.origin !== document.location.origin) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
