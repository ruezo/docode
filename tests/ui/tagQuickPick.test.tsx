// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { LinuxDoTagItem, TagsLoadOutcome } from '../../src/linuxdo/taxonomyLoader';
import { TagQuickPick } from '../../src/ui/quickOpen/TagQuickPick';

afterEach(cleanup);

const READY_TAGS: TagsLoadOutcome = {
  kind: 'ready',
  tags: Array.from({ length: 15 }, (unused, index) => ({
    count: 100 - index,
    name: `tag-${String(index + 1)}`,
    url: `https://linux.do/tag/tag-${String(index + 1)}`,
  })),
};

describe('TagQuickPick', () => {
  it('shows featured tags with a View all action that expands the full list', async () => {
    const user = userEvent.setup();
    render(
      <TagQuickPick
        onDismiss={vi.fn()}
        onLoadTags={() => Promise.resolve(READY_TAGS)}
        onOpenTag={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByRole('option')).toHaveLength(13);
    });
    const viewAll = screen.getByRole('option', { name: /View all tags/u });
    expect(viewAll.textContent).toBe('View all tags15 tags');

    await user.click(viewAll);
    await waitFor(() => {
      expect(screen.getAllByRole('option')).toHaveLength(15);
    });
    expect(screen.queryByRole('option', { name: /View all tags/u })).toBeNull();
  });

  it('filters the complete tag list from the input and opens the picked tag', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    const onOpenTag = vi.fn((tag: LinuxDoTagItem) =>
      Promise.resolve({ kind: 'navigated' as const, route: { href: tag.url } }),
    );
    render(
      <TagQuickPick
        onDismiss={onDismiss}
        onLoadTags={() => Promise.resolve(READY_TAGS)}
        onOpenTag={onOpenTag as never}
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByRole('option')).toHaveLength(13);
    });
    await user.type(screen.getByRole('combobox', { name: 'Filter Linux DO tags' }), 'tag-15');
    const match = await screen.findByRole('option', { name: /tag-15/u });
    expect(screen.getAllByRole('option')).toHaveLength(1);

    await user.click(match);
    await waitFor(() => {
      expect(onOpenTag).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'tag-15', url: 'https://linux.do/tag/tag-15' }),
        expect.any(AbortSignal),
      );
      expect(onDismiss).toHaveBeenCalled();
    });
  });

  it('reports unavailable tags without offering stale entries', async () => {
    render(
      <TagQuickPick
        onDismiss={vi.fn()}
        onLoadTags={() => Promise.resolve({ kind: 'unavailable' })}
        onOpenTag={vi.fn()}
      />,
    );

    await screen.findByText('Linux DO tags are unavailable right now.');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });
});
