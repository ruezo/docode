// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_WORKBENCH_APPEARANCE } from '../../src/settings/workbenchAppearancePreference';
import { SettingsEditor } from '../../src/ui/settings/SettingsEditor';

afterEach(cleanup);

Element.prototype.scrollIntoView = vi.fn();

describe('Settings editor', () => {
  it('renders the workbench appearance settings and dispatches typed changes', () => {
    const onChange = vi.fn();
    render(
      <SettingsEditor
        onChange={onChange}
        preference={DEFAULT_WORKBENCH_APPEARANCE}
        resolvedTheme="dark"
      />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeDefined();
    expect(
      screen.getByRole('combobox', { name: 'DOCode Appearance Color Theme' }).textContent,
    ).toBe('System Default');
    expect(screen.getByLabelText<HTMLInputElement>('Topic List Body Color').value).toBe('#dcdcaa');
    expect(screen.getByLabelText<HTMLInputElement>('Topic Detail Body Color').value).toBe(
      '#ce9178',
    );
    expect(screen.getByRole<HTMLInputElement>('checkbox').checked).toBe(true);

    fireEvent.click(screen.getByRole('combobox', { name: 'DOCode Appearance Color Theme' }));
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'System DefaultDefault',
      'Dark Modern',
      'Light Modern',
    ]);
    fireEvent.click(screen.getByRole('option', { name: 'Light Modern' }));
    expect(onChange).toHaveBeenLastCalledWith({
      ...DEFAULT_WORKBENCH_APPEARANCE,
      theme: 'light',
    });

    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenLastCalledWith({
      ...DEFAULT_WORKBENCH_APPEARANCE,
      showTopicAvatars: false,
    });
  });

  it('filters settings and commits a custom Command Center label', () => {
    const onChange = vi.fn();
    render(
      <SettingsEditor
        onChange={onChange}
        preference={DEFAULT_WORKBENCH_APPEARANCE}
        resolvedTheme="light"
      />,
    );

    fireEvent.change(screen.getByLabelText('Search settings'), {
      target: { value: 'command center' },
    });
    expect(screen.queryByRole('combobox', { name: 'DOCode Appearance Color Theme' })).toBeNull();
    expect(screen.getByText('1 Setting Found')).toBeDefined();

    const label = screen.getByLabelText('Command Center Label');
    fireEvent.change(label, { target: { value: 'Community' } });
    fireEvent.blur(label);
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_WORKBENCH_APPEARANCE,
      commandCenterLabel: 'Community',
    });
  });

  it('commits a valid Browse History Limit and reverts out-of-range input', () => {
    const onChange = vi.fn();
    render(
      <SettingsEditor
        onChange={onChange}
        preference={DEFAULT_WORKBENCH_APPEARANCE}
        resolvedTheme="dark"
      />,
    );

    const limit = screen.getByLabelText<HTMLInputElement>('Browse History Limit');
    expect(limit.value).toBe('100');

    fireEvent.change(limit, { target: { value: '0' } });
    fireEvent.blur(limit);
    expect(onChange).toHaveBeenLastCalledWith({
      ...DEFAULT_WORKBENCH_APPEARANCE,
      historyLimit: 0,
    });

    fireEvent.change(limit, { target: { value: '5000' } });
    fireEvent.blur(limit);
    expect(onChange).toHaveBeenCalledOnce();
    expect(limit.value).toBe('100');
  });

  it('collapses and expands the table of contents group', () => {
    render(
      <SettingsEditor
        onChange={vi.fn()}
        preference={DEFAULT_WORKBENCH_APPEARANCE}
        resolvedTheme="dark"
      />,
    );

    const appearance = screen.getByRole('treeitem', { name: 'Appearance' });
    expect(appearance.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('treeitem', { name: 'Editor' })).toBeDefined();
    expect(screen.getByRole('treeitem', { name: 'Workbench' }).hasAttribute('aria-expanded')).toBe(
      false,
    );

    fireEvent.click(appearance);
    expect(appearance.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('treeitem', { name: 'Editor' })).toBeNull();
  });

  it('opens the color picker and commits a hue change', () => {
    const onChange = vi.fn();
    render(
      <SettingsEditor
        onChange={onChange}
        preference={DEFAULT_WORKBENCH_APPEARANCE}
        resolvedTheme="dark"
      />,
    );

    expect(screen.queryByRole('dialog', { name: 'Topic List Body Color Picker' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Topic List Body Color Picker' }));

    const hue = screen.getByRole('slider', { name: 'Topic List Body Color Hue' });
    expect(hue.getAttribute('aria-valuenow')).toBe('60');
    fireEvent.keyDown(hue, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_WORKBENCH_APPEARANCE,
      topicListBodyColor: '#d8dcaa',
    });
  });
});
