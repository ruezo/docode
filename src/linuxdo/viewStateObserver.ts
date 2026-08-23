import { NATIVE_CONTENT_TRANSFER_MARKER } from '../runtime/nativeContentTransfer';
import {
  DOCODE_PAGINATED_CONTENT_ATTRIBUTE,
  DOCODE_PAGINATED_POST_ATTRIBUTE,
} from './topicAdapter';

const VIEW_STATE_ROOT_SELECTOR = '#main-outlet, main';
const DOCODE_OWNED_ROOT_SELECTOR = '[data-docode-workbench-root]';
const DOCODE_OWNED_PAGINATION_SELECTOR = `[${DOCODE_PAGINATED_POST_ATTRIBUTE}], [${DOCODE_PAGINATED_CONTENT_ATTRIBUTE}]`;
const VIEW_STATE_ELEMENT_SELECTOR = [
  '[aria-busy="true"]',
  '[role="progressbar"]',
  '.loading-container',
  '.spinner',
  'table.topic-list',
  'table.topic-list tbody',
  'table.topic-list tbody tr',
  'h1[data-topic-id]',
  '.post-stream',
  'article[data-post-id]',
  '.read-state',
  '.cooked',
].join(', ');

export class LinuxDoViewStateObserver {
  readonly #document: Document;
  readonly #onChange: () => void;
  #observer: MutationObserver | null = null;
  #pending = false;
  #root: HTMLElement | null = null;

  constructor(document: Document, onChange: () => void) {
    this.#document = document;
    this.#onChange = onChange;
  }

  get isStarted(): boolean {
    return this.#observer !== null;
  }

  start(): boolean {
    if (this.#observer || !this.#document.defaultView) return false;
    const root = this.#document.querySelector<HTMLElement>(VIEW_STATE_ROOT_SELECTOR);
    if (!root) return false;
    this.#root = root;
    this.#observer = new this.#document.defaultView.MutationObserver(this.#onMutations);
    this.#observer.observe(root, {
      attributeFilter: ['aria-busy', 'class', 'data-post-id', 'data-post-number', 'data-topic-id'],
      attributeOldValue: true,
      attributes: true,
      childList: true,
      subtree: true,
    });
    return true;
  }

  refresh(): boolean {
    const nextRoot = this.#document.querySelector<HTMLElement>(VIEW_STATE_ROOT_SELECTOR);
    if (nextRoot === this.#root && this.#observer) return false;
    this.stop();
    return this.start();
  }

  stop(): boolean {
    if (!this.#observer) return false;
    this.#observer.disconnect();
    this.#observer = null;
    this.#pending = false;
    this.#root = null;
    return true;
  }

  readonly #onMutations = (mutations: readonly MutationRecord[]) => {
    if (!this.#observer || this.#pending || !mutations.some(isViewStateMutation)) return;
    this.#pending = true;
    this.#document.defaultView?.queueMicrotask(() => {
      if (!this.#observer || !this.#pending) return;
      this.#pending = false;
      this.#onChange();
    });
  };
}

function isViewStateMutation(mutation: MutationRecord): boolean {
  if (mutation.type === 'attributes') {
    const element = toElement(mutation.target);
    if (!element) return false;
    if (mutation.attributeName !== 'class') {
      return element.matches(VIEW_STATE_ELEMENT_SELECTOR);
    }
    return (
      element.matches(VIEW_STATE_ELEMENT_SELECTOR) ||
      /(?:loading-container|spinner|post-stream|topic-list)/u.test(mutation.oldValue ?? '')
    );
  }

  return [...mutation.addedNodes, ...mutation.removedNodes].some((node) => {
    const element = toElement(node);
    return (
      element !== null &&
      element.closest(DOCODE_OWNED_ROOT_SELECTOR) === null &&
      element.closest(DOCODE_OWNED_PAGINATION_SELECTOR) === null &&
      !element.hasAttribute(NATIVE_CONTENT_TRANSFER_MARKER) &&
      (element.matches(VIEW_STATE_ELEMENT_SELECTOR) ||
        element.querySelector(VIEW_STATE_ELEMENT_SELECTOR) !== null)
    );
  });
}

function toElement(node: Node): Element | null {
  const ElementConstructor = node.ownerDocument?.defaultView?.Element;
  return ElementConstructor && node instanceof ElementConstructor ? node : null;
}
