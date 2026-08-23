// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';

import {
  NativePresentation,
  NativePresentationOwnershipError,
} from '../../src/runtime/nativePresentation';

afterEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('data-docode-presentation');
});

describe('NativePresentation', () => {
  it('owns scoped markers and restores only its verified native regions', () => {
    document.body.innerHTML =
      '<main id="native">Native topic list</main><aside>Native sidebar</aside>';
    const nativeMain = document.querySelector<HTMLElement>('#native');
    if (!nativeMain) throw new Error('Expected the native fixture region.');
    const presentation = new NativePresentation(document, 'owner-one');

    expect(presentation.hideVerifiedRegion(nativeMain)).toBe(true);
    expect(presentation.hideVerifiedRegion(nativeMain)).toBe(false);
    expect(nativeMain.hidden).toBe(true);
    expect(document.querySelector('aside')?.hidden).toBe(false);
    expect(document.querySelectorAll('[data-docode-owned-style]')).toHaveLength(1);

    expect(presentation.restore()).toBe(true);
    expect(presentation.restore()).toBe(false);
    expect(nativeMain.hasAttribute('hidden')).toBe(false);
    expect(nativeMain.hasAttribute('data-docode-native-hidden')).toBe(false);
    expect(document.documentElement.hasAttribute('data-docode-presentation')).toBe(false);
    expect(document.querySelectorAll('[data-docode-owned-style]')).toHaveLength(0);
  });

  it('restores a detached region and preserves its original hidden value', () => {
    document.body.innerHTML = '<main id="native" hidden="until-found">Native topic</main>';
    const nativeMain = document.querySelector<HTMLElement>('#native');
    if (!nativeMain) throw new Error('Expected the native fixture region.');
    const presentation = new NativePresentation(document, 'owner-two');

    presentation.hideVerifiedRegion(nativeMain);
    nativeMain.remove();
    presentation.restore();

    expect(nativeMain.getAttribute('hidden')).toBe('until-found');
    expect(nativeMain.hasAttribute('data-docode-native-hidden')).toBe(false);
  });

  it('does not overwrite a native hidden-state change made while mounted', () => {
    document.body.innerHTML = '<main id="native">Native topic</main>';
    const nativeMain = document.querySelector<HTMLElement>('#native');
    if (!nativeMain) throw new Error('Expected the native fixture region.');
    const presentation = new NativePresentation(document, 'owner-three');

    presentation.hideVerifiedRegion(nativeMain);
    nativeMain.setAttribute('hidden', 'until-found');
    presentation.restore();

    expect(nativeMain.getAttribute('hidden')).toBe('until-found');
  });

  it('rejects broad, detached, foreign, and multiply owned regions', () => {
    document.body.innerHTML = '<main id="native">Native topic</main>';
    const nativeMain = document.querySelector<HTMLElement>('#native');
    if (!nativeMain) throw new Error('Expected the native fixture region.');
    const presentation = new NativePresentation(document, 'owner-four');
    const detached = document.createElement('section');
    const foreignDocument = document.implementation.createHTMLDocument('foreign');

    expect(() => presentation.hideVerifiedRegion(document.body)).toThrow(
      NativePresentationOwnershipError,
    );
    expect(() => presentation.hideVerifiedRegion(detached)).toThrow(
      NativePresentationOwnershipError,
    );
    expect(() => presentation.hideVerifiedRegion(foreignDocument.body)).toThrow(
      NativePresentationOwnershipError,
    );

    nativeMain.setAttribute('data-docode-native-hidden', 'another-owner');
    expect(() => presentation.hideVerifiedRegion(nativeMain)).toThrow(
      NativePresentationOwnershipError,
    );
  });

  it('fails closed when document presentation already has an owner', () => {
    document.documentElement.setAttribute('data-docode-presentation', 'foreign-owner');

    expect(() => new NativePresentation(document, 'owner-five')).toThrow(
      NativePresentationOwnershipError,
    );
    expect(document.documentElement.getAttribute('data-docode-presentation')).toBe('foreign-owner');
    expect(document.querySelectorAll('[data-docode-owned-style]')).toHaveLength(0);
  });
});
