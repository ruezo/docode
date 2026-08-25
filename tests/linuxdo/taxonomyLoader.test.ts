// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://linux.do/latest" }

import { describe, expect, it, vi } from 'vitest';

import { LinuxDoTaxonomyLoader } from '../../src/linuxdo/taxonomyLoader';

describe('LinuxDoTaxonomyLoader', () => {
  it('loads top-level categories with normalized colors and canonical urls', async () => {
    const fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        category_list: {
          categories: [
            {
              color: '0088CC',
              description_text: '开发调优相关讨论',
              id: 4,
              name: '开发调优',
              slug: 'develop',
              topic_count: 128,
            },
            {
              color: 'not-a-color',
              id: 14,
              name: '资源荟萃',
              slug: 'resource',
              topic_count: 0,
            },
            { color: 'AA33CC', id: 21, name: 'Child', parent_category_id: 4, slug: 'child' },
            { id: 22, name: 'Broken slug', slug: 'a/b' },
          ],
        },
      }),
    );
    const loader = new LinuxDoTaxonomyLoader(document, { fetch });

    const outcome = await loader.loadCategories(new AbortController().signal);

    expect(outcome).toEqual({
      categories: [
        {
          color: '#0088CC',
          description: '开发调优相关讨论',
          id: 4,
          name: '开发调优',
          slug: 'develop',
          topicCount: 128,
          url: 'https://linux.do/c/develop/4',
        },
        {
          color: null,
          description: null,
          id: 14,
          name: '资源荟萃',
          slug: 'resource',
          topicCount: 0,
          url: 'https://linux.do/c/resource/14',
        },
      ],
      kind: 'ready',
    });
    const [url, init] = fetch.mock.calls[0] as [URL, RequestInit];
    expect(url.href).toBe('https://linux.do/categories.json');
    expect(init.credentials).toBe('same-origin');
  });

  it('merges direct and grouped tags, deduplicates, and sorts by usage', async () => {
    const fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        extras: {
          tag_groups: [
            { tags: [{ count: 70, id: 'ai', text: 'ai' }] },
            { tags: [{ count: 12, id: 'linux', text: 'linux' }] },
          ],
        },
        tags: [
          { count: 12, id: 'linux', text: 'linux' },
          { count: 55, id: '福利', text: '福利' },
        ],
      }),
    );
    const loader = new LinuxDoTaxonomyLoader(document, { fetch });

    const outcome = await loader.loadTags(new AbortController().signal);

    expect(outcome).toEqual({
      kind: 'ready',
      tags: [
        { count: 70, name: 'ai', url: 'https://linux.do/tag/ai' },
        { count: 55, name: '福利', url: 'https://linux.do/tag/%E7%A6%8F%E5%88%A9' },
        { count: 12, name: 'linux', url: 'https://linux.do/tag/linux' },
      ],
    });
  });

  it('rejects cross-origin responses and malformed payloads honestly', async () => {
    const crossOrigin = new LinuxDoTaxonomyLoader(document, {
      fetch: vi
        .fn()
        .mockResolvedValue(
          jsonResponse(
            { category_list: { categories: [] } },
            'https://evil.example/categories.json',
          ),
        ),
    });
    await expect(crossOrigin.loadCategories(new AbortController().signal)).resolves.toEqual({
      kind: 'unavailable',
    });

    const malformed = new LinuxDoTaxonomyLoader(document, {
      fetch: vi.fn().mockResolvedValue(jsonResponse({ unexpected: true })),
    });
    await expect(malformed.loadTags(new AbortController().signal)).resolves.toEqual({
      kind: 'unavailable',
    });

    const aborted = new AbortController();
    aborted.abort();
    const loader = new LinuxDoTaxonomyLoader(document, { fetch: vi.fn() });
    await expect(loader.loadCategories(aborted.signal)).resolves.toEqual({ kind: 'aborted' });
  });
});

function jsonResponse(payload: unknown, url = 'https://linux.do/categories.json'): Response {
  return {
    json: () => Promise.resolve(payload),
    ok: true,
    status: 200,
    url,
  } as unknown as Response;
}
