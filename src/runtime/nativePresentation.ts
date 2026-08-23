const PRESENTATION_MARKER = 'data-docode-presentation';
const NATIVE_HIDDEN_MARKER = 'data-docode-native-hidden';
const OWNED_STYLE_MARKER = 'data-docode-owned-style';

interface HiddenRegionState {
  readonly element: HTMLElement;
  readonly originalHiddenAttribute: string | null;
}

export class NativePresentationOwnershipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NativePresentationOwnershipError';
  }
}

export class NativePresentation {
  readonly #hiddenRegions = new Set<HiddenRegionState>();
  readonly #style: HTMLStyleElement;
  #restored = false;

  constructor(
    readonly document: Document,
    readonly ownerToken: string,
  ) {
    if (document.documentElement.hasAttribute(PRESENTATION_MARKER)) {
      throw new NativePresentationOwnershipError('The document presentation is already owned.');
    }

    const style = document.createElement('style');
    style.setAttribute(OWNED_STYLE_MARKER, ownerToken);
    style.textContent =
      'html[data-docode-presentation] [data-docode-native-hidden] { display: none !important; }';

    document.documentElement.setAttribute(PRESENTATION_MARKER, ownerToken);
    try {
      document.head.append(style);
    } catch (error) {
      document.documentElement.removeAttribute(PRESENTATION_MARKER);
      throw error;
    }
    this.#style = style;
  }

  hideVerifiedRegion(element: HTMLElement): boolean {
    this.#assertCanOwn(element);

    const currentOwner = element.getAttribute(NATIVE_HIDDEN_MARKER);
    if (currentOwner === this.ownerToken) return false;
    if (currentOwner !== null) {
      throw new NativePresentationOwnershipError('The native region has another owner.');
    }

    this.#hiddenRegions.add({
      element,
      originalHiddenAttribute: element.getAttribute('hidden'),
    });
    element.setAttribute(NATIVE_HIDDEN_MARKER, this.ownerToken);
    element.setAttribute('hidden', '');
    return true;
  }

  restore(): boolean {
    if (this.#restored) return false;
    this.#restored = true;

    for (const { element, originalHiddenAttribute } of this.#hiddenRegions) {
      if (element.getAttribute(NATIVE_HIDDEN_MARKER) !== this.ownerToken) continue;
      element.removeAttribute(NATIVE_HIDDEN_MARKER);

      if (element.getAttribute('hidden') !== '') continue;
      if (originalHiddenAttribute === null) element.removeAttribute('hidden');
      else element.setAttribute('hidden', originalHiddenAttribute);
    }
    this.#hiddenRegions.clear();

    if (this.#style.getAttribute(OWNED_STYLE_MARKER) === this.ownerToken) {
      this.#style.remove();
    }
    if (this.document.documentElement.getAttribute(PRESENTATION_MARKER) === this.ownerToken) {
      this.document.documentElement.removeAttribute(PRESENTATION_MARKER);
    }
    return true;
  }

  #assertCanOwn(element: HTMLElement): void {
    if (this.#restored) {
      throw new NativePresentationOwnershipError('The document presentation is restored.');
    }
    if (element.ownerDocument !== this.document || !element.isConnected) {
      throw new NativePresentationOwnershipError('The native region is not in this document.');
    }
    if (
      element === this.document.documentElement ||
      element === this.document.head ||
      element === this.document.body
    ) {
      throw new NativePresentationOwnershipError('Broad document regions cannot be hidden.');
    }
  }
}

export function hasPresentationOwnershipMarker(document: Document): boolean {
  return document.documentElement.hasAttribute(PRESENTATION_MARKER);
}
