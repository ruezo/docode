// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  WorkbenchNotificationToasts,
  type WorkbenchNotificationItem,
} from '../../src/ui/workbench/WorkbenchNotifications';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function item(overrides: Partial<WorkbenchNotificationItem> = {}): WorkbenchNotificationItem {
  return {
    id: 1,
    message: 'Liked post 3.',
    severity: 'info',
    source: 'Linux DO',
    ...overrides,
  };
}

describe('WorkbenchNotificationToasts', () => {
  it('renders nothing without notifications', () => {
    const { container } = render(
      <WorkbenchNotificationToasts items={[]} onDismiss={() => undefined} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders the VS Code toast anatomy for each severity', () => {
    render(
      <WorkbenchNotificationToasts
        items={[
          item(),
          item({ id: 2, message: 'Linux DO rejected the Like request.', severity: 'error' }),
        ]}
        onDismiss={() => undefined}
      />,
    );

    const region = screen.getByRole('region', { name: 'Notifications' });
    const alerts = screen.getAllByRole('dialog');
    expect(region.className).toBe('docode-workbench__notifications');
    expect(alerts).toHaveLength(2);
    expect(alerts[0]?.getAttribute('data-severity')).toBe('info');
    expect(alerts[0]?.querySelector('.codicon-info')).not.toBeNull();
    expect(alerts[1]?.getAttribute('data-severity')).toBe('error');
    expect(alerts[1]?.querySelector('.codicon-error')).not.toBeNull();
    expect(alerts[0]?.textContent).toContain('Liked post 3.');
    expect(alerts[0]?.textContent).toContain('Source: Linux DO');
    expect(alerts[0]?.querySelector('[aria-label="Configure Notification"]')).not.toBeNull();
    expect(alerts[0]?.querySelector('[aria-label="Clear Notification"]')).not.toBeNull();
  });

  it('dismisses through the close control', () => {
    const onDismiss = vi.fn();
    render(<WorkbenchNotificationToasts items={[item({ id: 7 })]} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole('button', { name: 'Clear Notification' }));

    expect(onDismiss).toHaveBeenCalledWith(7);
  });

  it('auto-dismisses after five seconds', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<WorkbenchNotificationToasts items={[item({ id: 9 })]} onDismiss={onDismiss} />);

    vi.advanceTimersByTime(4_999);
    expect(onDismiss).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onDismiss).toHaveBeenCalledWith(9);
  });

  it('pauses the dismiss timer while hovered and resumes afterwards', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<WorkbenchNotificationToasts items={[item({ id: 4 })]} onDismiss={onDismiss} />);
    const toast = screen.getByRole('dialog');

    vi.advanceTimersByTime(3_000);
    fireEvent.pointerEnter(toast);
    vi.advanceTimersByTime(10_000);
    expect(onDismiss).not.toHaveBeenCalled();

    fireEvent.pointerLeave(toast);
    vi.advanceTimersByTime(5_000);
    expect(onDismiss).toHaveBeenCalledWith(4);
  });
});
