// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Codicon } from '../../src/ui/icons/codicon';

afterEach(cleanup);

describe('Codicon', () => {
  it('keeps glyphs decorative while the owning control provides its accessible name', () => {
    const { container } = render(
      <button type="button">
        <Codicon name="refresh" />
        Retry
      </button>,
    );

    expect(screen.getByRole('button', { name: 'Retry' })).toBeDefined();
    const icon = container.querySelector('.codicon-refresh');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
    expect(icon?.classList.contains('docode-codicon')).toBe(true);
  });

  it('uses the approved reduced-motion-compatible spin modifier only when requested', () => {
    const { container, rerender } = render(<Codicon name="loading" spin />);

    expect(container.querySelector('.codicon-loading')?.classList).toContain(
      'codicon-modifier-spin',
    );

    rerender(<Codicon name="check" />);
    expect(container.querySelector('.codicon-check')?.classList).not.toContain(
      'codicon-modifier-spin',
    );
  });
});
