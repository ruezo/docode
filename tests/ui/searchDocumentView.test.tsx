// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://linux.do/search?q=extension" }

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { recognizeLinuxDoRoute } from '../../src/linuxdo/routes';
import type { LinuxDoNavigationOutcome } from '../../src/linuxdo/navigationAdapter';
import type { LinuxDoRoute } from '../../src/linuxdo/routes';
import type { LinuxDoSearchResult } from '../../src/linuxdo/searchAdapter';
import { SearchDocumentView } from '../../src/views/search/SearchDocumentView';

afterEach(cleanup);

describe('SearchDocumentView', () => {
  it('renders grouped real results and confirms primary navigation through the shared adapter', async () => {
    const user = userEvent.setup();
    const post = result('post', 'Matched topic', '/t/matched-topic/42/3');
    const category = result('category', 'Develop', '/c/develop/4');
    const userResult = result('user', 'Alice', '/u/alice');
    const onSearch = vi.fn((query: string) =>
      Promise.resolve({ items: [post, category, userResult], kind: 'results' as const, query }),
    );
    const onNavigate = vi.fn((route: LinuxDoRoute): Promise<LinuxDoNavigationOutcome> =>
      Promise.resolve({ kind: 'navigated', route }),
    );

    render(
      <SearchDocumentView
        expectedGeneration={4}
        onNavigate={onNavigate}
        onSearch={onSearch}
        query="extension"
      />,
    );

    expect(await screen.findByText('3 results for “extension”')).toBeDefined();
    expect(screen.getByRole('heading', { name: /Posts1/u })).toBeDefined();
    expect(screen.getByRole('heading', { name: /Categories1/u })).toBeDefined();
    expect(screen.getByRole('heading', { name: /Users1/u })).toBeDefined();
    expect(screen.getByRole('list', { name: /Posts1/u })).toBeDefined();
    expect(screen.getByRole('list', { name: /Categories1/u })).toBeDefined();
    expect(screen.getByRole('list', { name: /Users1/u })).toBeDefined();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    const postLink = screen.getByRole('link', { name: /Matched topic/u });
    expect(postLink.getAttribute('href')).toBe('https://linux.do/t/matched-topic/42/3');

    await user.click(postLink);
    await waitFor(() => {
      expect(onNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'topic', postNumber: 3, topicId: 42 }),
        4,
        expect.any(AbortSignal),
      );
    });
  });

  it('navigates submitted queries to the real search URL and renders empty/error state', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn((route: LinuxDoRoute): Promise<LinuxDoNavigationOutcome> =>
      Promise.resolve({ kind: 'navigated', route }),
    );
    const { rerender } = render(
      <SearchDocumentView
        expectedGeneration={1}
        onNavigate={onNavigate}
        onSearch={(query) => Promise.resolve({ items: [], kind: 'results', query })}
        query="none"
      />,
    );
    expect(await screen.findByText('No Linux DO results for “none”.')).toBeDefined();

    const input = screen.getByRole('searchbox', { name: 'Search Linux DO' });
    await user.clear(input);
    await user.type(input, 'new query');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(onNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ href: 'https://linux.do/search?q=new+query', kind: 'search' }),
      1,
      expect.any(AbortSignal),
    );

    rerender(
      <SearchDocumentView
        expectedGeneration={2}
        onNavigate={onNavigate}
        onSearch={(query) =>
          Promise.resolve({
            code: 'request-failed',
            kind: 'error',
            message: 'Linux DO search failed.',
            query,
            retryable: true,
          })
        }
        query="failed"
      />,
    );
    expect((await screen.findByRole('alert')).textContent).toContain('Linux DO search failed.');
  });
});

function result(
  kind: LinuxDoSearchResult['kind'],
  label: string,
  pathname: string,
): LinuxDoSearchResult {
  const route = recognizeLinuxDoRoute(`https://linux.do${pathname}`);
  return {
    description: `${kind} description`,
    id: `${kind}:${pathname}`,
    kind,
    label,
    route,
    url: `https://linux.do${pathname}`,
  };
}
