// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { LinuxDoNavigationOutcome } from '../../src/linuxdo/navigationAdapter';
import { recognizeLinuxDoRoute } from '../../src/linuxdo/routes';
import type { QuickOpenCollection, QuickOpenItem } from '../../src/quickOpen/quickOpenModel';
import { QuickOpen } from '../../src/ui/quickOpen/QuickOpen';

afterEach(cleanup);

describe('QuickOpen', () => {
  it('filters real candidates, moves selection, and opens through the supplied navigation boundary', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    const onOpenItem = vi.fn<
      (item: QuickOpenItem, signal: AbortSignal) => Promise<LinuxDoNavigationOutcome>
    >((item) => Promise.resolve({ kind: 'navigated', route: item.route }));
    render(
      <QuickOpen
        collection={readyCollection()}
        onDismiss={onDismiss}
        onOpenItem={onOpenItem}
        onSearch={emptySearch}
      />,
    );
    const input = screen.getByRole('combobox', {
      name: 'Search open views, loaded topics, and Linux DO',
    });

    expect(document.activeElement).toBe(input);
    expect(screen.getAllByRole('option')).toHaveLength(3);
    expect(screen.getByRole('group', { name: 'Open Views' })).toBeDefined();
    expect(screen.getByRole('group', { name: 'Latest Topics' })).toBeDefined();
    expect(screen.getByRole('option', { name: /latest/u }).getAttribute('aria-selected')).toBe(
      'true',
    );
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('option', { name: /First topic/u }).getAttribute('aria-selected')).toBe(
      'true',
    );
    await user.type(input, 'second');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByText('Second', { selector: 'strong' })).toBeDefined();
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(onOpenItem).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'topic-list:43' }),
        expect.any(AbortSignal),
      );
      expect(onDismiss).toHaveBeenCalledOnce();
    });
  });

  it('supports pointer acceptance and keeps stale navigation visibly failed', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    const onOpenItem = vi.fn((): Promise<LinuxDoNavigationOutcome> =>
      Promise.resolve({ kind: 'stale' }),
    );
    render(
      <QuickOpen
        collection={readyCollection()}
        onDismiss={onDismiss}
        onOpenItem={onOpenItem}
        onSearch={emptySearch}
      />,
    );

    await user.click(screen.getByRole('option', { name: /Second topic/u }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'The route changed before this item could open.',
    );
    expect(onDismiss).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Quick Open' }).getAttribute('aria-busy')).toBe(
      'false',
    );
  });

  it('keeps the busy input focused and screen-reader available until navigation settles', async () => {
    const user = userEvent.setup();
    let settle: ((outcome: LinuxDoNavigationOutcome) => void) | undefined;
    render(
      <QuickOpen
        collection={readyCollection()}
        onDismiss={() => undefined}
        onOpenItem={() =>
          new Promise((resolve) => {
            settle = resolve;
          })
        }
        onSearch={emptySearch}
      />,
    );
    const input = screen.getByRole('combobox', {
      name: 'Search open views, loaded topics, and Linux DO',
    });

    await user.keyboard('{Enter}');
    expect(input.getAttribute('aria-disabled')).toBe('true');
    expect(input.hasAttribute('readonly')).toBe(true);
    expect(document.activeElement).toBe(input);
    settle?.({ kind: 'unavailable' });
    expect(await screen.findByRole('alert')).toBeDefined();
    expect(input.getAttribute('aria-disabled')).toBe('false');
    expect(input.hasAttribute('readonly')).toBe(false);
  });

  it('shows loading and no-match states, keeps focus in the input, and dismisses with Escape', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <QuickOpen
        collection={{
          ...readyCollection(),
          topicMessage: 'Linux DO topic suggestions are still loading.',
          topicState: 'loading',
        }}
        onDismiss={onDismiss}
        onOpenItem={() => Promise.resolve({ kind: 'unavailable' })}
        onSearch={emptySearch}
      />,
    );
    const input = screen.getByRole('combobox', {
      name: 'Search open views, loaded topics, and Linux DO',
    });

    expect(screen.getByText('Linux DO topic suggestions are still loading.')).toBeDefined();
    await user.type(input, 'not present');
    expect(
      screen.getByText('No matching open views, loaded topics, or Linux DO results.'),
    ).toBeDefined();
    await user.keyboard('{Tab}');
    expect(document.activeElement).toBe(input);
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(input);
    expect(screen.queryByRole('button', { name: 'Close Quick Open' })).toBeNull();
    expect(screen.getByText('0 results').classList.contains('docode-sr-only')).toBe(true);
    await user.keyboard('{Escape}');
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('adds real remote Linux DO results through the shared search provider', async () => {
    const user = userEvent.setup();
    const route = recognizeLinuxDoRoute('https://linux.do/t/remote-topic/99/4');
    const onSearch = vi.fn((query: string) =>
      Promise.resolve({
        items: [
          {
            description: 'Post 4 · @remote-user',
            id: 'post:501:4',
            kind: 'post' as const,
            label: 'Remote topic',
            route,
            url: route.href,
          },
        ],
        kind: 'results' as const,
        query,
      }),
    );
    const onOpenItem = vi.fn<
      (item: QuickOpenItem, signal: AbortSignal) => Promise<LinuxDoNavigationOutcome>
    >((item) => Promise.resolve({ kind: 'navigated', route: item.route }));
    render(
      <QuickOpen
        collection={readyCollection()}
        onDismiss={() => undefined}
        onOpenItem={onOpenItem}
        onSearch={onSearch}
      />,
    );

    await user.type(screen.getByRole('combobox'), 'remote');
    const result = await screen.findByRole('option', { name: /Remote topic/u });
    expect(onSearch).toHaveBeenCalledWith('remote', expect.any(AbortSignal));
    expect(screen.getByText('Linux DO Posts')).toBeDefined();
    await user.click(result);
    await waitFor(() => {
      expect(onOpenItem).toHaveBeenCalledOnce();
    });
    const openedItem = onOpenItem.mock.calls[0]?.[0];
    expect(openedItem?.route).toMatchObject({ postNumber: 4, topicId: 99 });
    expect(onOpenItem.mock.calls[0]?.[1]).toBeInstanceOf(AbortSignal);
  });
});

function emptySearch(query: string) {
  return Promise.resolve({ items: [], kind: 'results' as const, query });
}

function readyCollection(): QuickOpenCollection {
  return {
    items: [
      item('open-view:list:latest', 'latest', '/latest', true, 'open-view'),
      item('topic-list:42', 'First topic', '/t/first-topic/42', false, 'topic-list'),
      item('topic-list:43', 'Second topic', '/t/second-topic/43', false, 'topic-list'),
    ],
    topicMessage: null,
    topicState: 'ready',
  };
}

function item(
  id: string,
  label: string,
  pathname: string,
  active: boolean,
  source: QuickOpenItem['source'],
): QuickOpenItem {
  return {
    active,
    description:
      source === 'open-view' ? `Open view · Latest topics · ${pathname}` : `Topic · ${pathname}`,
    groupLabel: source === 'open-view' ? 'Open Views' : 'Latest Topics',
    icon: source === 'open-view' ? 'list-unordered' : 'file',
    id,
    label,
    readState: 'unknown',
    route: recognizeLinuxDoRoute(`https://linux.do${pathname}`),
    source,
  };
}
