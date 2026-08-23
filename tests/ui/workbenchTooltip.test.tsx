// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WorkbenchTooltip } from '../../src/ui/hover/WorkbenchTooltip';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('WorkbenchTooltip', () => {
  it('shows immediately for keyboard focus and restores the description on Escape', () => {
    render(
      <div className="docode-workbench">
        <button data-docode-tooltip="Open Command Palette" type="button">
          Commands
        </button>
        <WorkbenchTooltip />
      </div>,
    );
    const button = screen.getByRole('button', { name: 'Commands' });
    const tooltip = screen.getByRole('tooltip', { hidden: true });

    fireEvent.focusIn(button);
    expect(tooltip.hidden).toBe(false);
    expect(tooltip.textContent).toBe('Open Command Palette');
    expect(button.getAttribute('aria-describedby')).toBe(tooltip.id);

    fireEvent.keyDown(button, { key: 'Escape' });
    expect(tooltip.hidden).toBe(true);
    expect(button.hasAttribute('aria-describedby')).toBe(false);
  });

  it('uses the VS Code platform delay for pointer hovers', () => {
    vi.useFakeTimers();
    vi.spyOn(window.navigator, 'platform', 'get').mockReturnValue('Linux x86_64');
    render(
      <div className="docode-workbench">
        <button data-docode-tooltip="Close Bottom Panel" type="button">
          Close
        </button>
        <WorkbenchTooltip />
      </div>,
    );
    const button = screen.getByRole('button', { name: 'Close' });
    const tooltip = screen.getByRole('tooltip', { hidden: true });

    fireEvent.pointerOver(button);
    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(tooltip.hidden).toBe(true);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(tooltip.hidden).toBe(false);
  });

  it('clamps the surface to the viewport and flips it above a bottom-edge target', () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1024);
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(800);
    render(
      <div className="docode-workbench">
        <button data-docode-tooltip="Viewport edge tooltip" type="button">
          Edge
        </button>
        <WorkbenchTooltip />
      </div>,
    );
    const button = screen.getByRole('button', { name: 'Edge' });
    const tooltip = screen.getByRole('tooltip', { hidden: true });
    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(rect(990, 760, 30, 20));
    vi.spyOn(tooltip, 'getBoundingClientRect').mockReturnValue(rect(8, 8, 300, 40));

    fireEvent.focusIn(button);
    expect(tooltip.style.left).toBe('716px');
    expect(tooltip.style.top).toBe('712px');
  });
});

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    bottom: top + height,
    height,
    left,
    right: left + width,
    top,
    width,
    x: left,
    y: top,
    toJSON: () => ({}),
  };
}
