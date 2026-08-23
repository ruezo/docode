interface NativeContentPlacement {
  readonly host: HTMLElement;
  readonly nextSibling: ChildNode | null;
  readonly placeholder: Comment;
  readonly sourceParent: Node;
}

export const NATIVE_CONTENT_TRANSFER_MARKER = 'data-docode-native-content-transfer';
export const NATIVE_CONTENT_TRANSFER_MOUNT_EVENT = 'docode:native-content-transfer-mount';

export class NativeContentTransferError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NativeContentTransferError';
  }
}

export class NativeContentTransfer {
  readonly #placements = new Map<HTMLElement, NativeContentPlacement>();
  #disposed = false;

  constructor(readonly document: Document) {}

  mount(element: HTMLElement, host: HTMLElement): () => void {
    this.#assertTransfer(element, host);
    const existing = this.#placements.get(element);
    if (existing) {
      if (existing.host !== host || element.parentNode !== host) {
        throw new NativeContentTransferError('The native content already has another host.');
      }
      return () => {
        this.restore(element);
      };
    }

    const sourceParent = element.parentNode;
    if (!sourceParent) {
      throw new NativeContentTransferError('The native content has no source parent.');
    }
    const placeholder = this.document.createComment('docode-native-content');
    const placement: NativeContentPlacement = {
      host,
      nextSibling: element.nextSibling,
      placeholder,
      sourceParent,
    };
    element.setAttribute(NATIVE_CONTENT_TRANSFER_MARKER, '');
    sourceParent.insertBefore(placeholder, element);
    this.#placements.set(element, placement);
    try {
      host.append(element);
      const EventConstructor = this.document.defaultView?.Event;
      if (EventConstructor) {
        element.dispatchEvent(new EventConstructor(NATIVE_CONTENT_TRANSFER_MOUNT_EVENT));
      }
    } catch (error) {
      this.#placements.delete(element);
      placeholder.replaceWith(element);
      element.removeAttribute(NATIVE_CONTENT_TRANSFER_MARKER);
      throw error;
    }

    return () => {
      this.restore(element);
    };
  }

  restore(element: HTMLElement): boolean {
    const placement = this.#placements.get(element);
    if (!placement) return false;
    this.#placements.delete(element);

    if (element.parentNode !== placement.host) {
      placement.placeholder.remove();
      this.#scheduleMarkerRemoval(element);
      return true;
    }
    if (placement.placeholder.parentNode) {
      placement.placeholder.replaceWith(element);
      this.#scheduleMarkerRemoval(element);
      return true;
    }
    if (placement.sourceParent.isConnected) {
      const nextSibling = placement.nextSibling;
      placement.sourceParent.insertBefore(
        element,
        nextSibling?.parentNode === placement.sourceParent ? nextSibling : null,
      );
      this.#scheduleMarkerRemoval(element);
      return true;
    }

    element.remove();
    this.#scheduleMarkerRemoval(element);
    return true;
  }

  restoreAll(): number {
    const elements = [...this.#placements.keys()];
    for (const element of elements) this.restore(element);
    return elements.length;
  }

  resolveSourceElement(sourceOwner: Element): HTMLElement | null {
    if (this.#disposed || sourceOwner.ownerDocument !== this.document) return null;
    for (const [element, placement] of this.#placements) {
      if (
        element.parentNode === placement.host &&
        (placement.sourceParent === sourceOwner || sourceOwner.contains(placement.sourceParent))
      ) {
        return element;
      }
    }
    return null;
  }

  readWithContentRestored<Value>(reader: () => Value): Value {
    if (this.#disposed) {
      throw new NativeContentTransferError('The native content transfer is disposed.');
    }
    const visiblePlacements = [...this.#placements.entries()];
    this.restoreAll();
    try {
      return reader();
    } finally {
      for (const [element, placement] of visiblePlacements) {
        if (
          this.#placements.has(element) ||
          element.parentNode !== placement.sourceParent ||
          !placement.host.isConnected
        ) {
          continue;
        }
        this.mount(element, placement.host);
      }
    }
  }

  dispose(): boolean {
    if (this.#disposed) return false;
    const elements = [...this.#placements.keys()];
    this.restoreAll();
    for (const element of elements) element.removeAttribute(NATIVE_CONTENT_TRANSFER_MARKER);
    this.#disposed = true;
    return true;
  }

  #scheduleMarkerRemoval(element: HTMLElement): void {
    const remove = () => {
      if (!this.#placements.has(element)) {
        element.removeAttribute(NATIVE_CONTENT_TRANSFER_MARKER);
      }
    };
    if (this.document.defaultView) this.document.defaultView.queueMicrotask(remove);
    else remove();
  }

  #assertTransfer(element: HTMLElement, host: HTMLElement): void {
    if (this.#disposed) {
      throw new NativeContentTransferError('The native content transfer is disposed.');
    }
    if (
      element.ownerDocument !== this.document ||
      host.ownerDocument !== this.document ||
      !element.isConnected ||
      !host.isConnected
    ) {
      throw new NativeContentTransferError('Native content and host must be connected here.');
    }
    if (element === host || element.contains(host)) {
      throw new NativeContentTransferError('A native content host cannot create a DOM cycle.');
    }
  }
}
