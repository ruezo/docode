import { describe, expect, it } from 'vitest';

import { recognizeLinuxDoRoute } from '../../src/linuxdo/routes';

describe('recognizeLinuxDoRoute', () => {
  it.each([
    ['https://linux.do/', 'latest'],
    ['https://linux.do/latest', 'latest'],
    ['https://linux.do/new', 'new'],
    ['https://linux.do/unread', 'unread'],
    ['https://linux.do/hot', 'hot'],
    ['https://linux.do/top?period=weekly', 'top'],
  ] as const)('recognizes %s as the %s topic list', (href, view) => {
    expect(recognizeLinuxDoRoute(href)).toMatchObject({ kind: 'topic-list', view });
  });

  it('recognizes category and tag topic lists from observed public routes', () => {
    expect(recognizeLinuxDoRoute('https://linux.do/c/resource/cloud-asset/94')).toMatchObject({
      categoryId: 94,
      categorySlug: 'resource/cloud-asset',
      kind: 'topic-list',
      view: 'category',
    });
    expect(recognizeLinuxDoRoute('https://linux.do/tag/openai/4')).toMatchObject({
      kind: 'topic-list',
      tagId: 4,
      tagSlug: 'openai',
      view: 'tag',
    });
    expect(recognizeLinuxDoRoute('https://linux.do/tag/synthetic-tag')).toMatchObject({
      kind: 'topic-list',
      tagId: null,
      tagSlug: 'synthetic-tag',
      view: 'tag',
    });
  });

  it('recognizes topic and post positions without replacing the canonical URL', () => {
    const route = recognizeLinuxDoRoute('https://linux.do/t/synthetic-topic/42/7?filter=all#post');

    expect(route).toMatchObject({
      hash: '#post',
      href: 'https://linux.do/t/synthetic-topic/42/7?filter=all#post',
      kind: 'topic',
      postNumber: 7,
      search: '?filter=all',
      topicId: 42,
      topicSlug: 'synthetic-topic',
    });
  });

  it('recognizes category/tag indexes, search, and user sections', () => {
    expect(recognizeLinuxDoRoute('https://linux.do/categories')).toMatchObject({
      kind: 'category-index',
    });
    expect(recognizeLinuxDoRoute('https://linux.do/tags')).toMatchObject({ kind: 'tag-index' });
    expect(recognizeLinuxDoRoute('https://linux.do/search?expanded=true&q=route')).toMatchObject({
      kind: 'search',
      query: 'route',
    });
    expect(
      recognizeLinuxDoRoute('https://linux.do/u/synthetic-user/activity/topics'),
    ).toMatchObject({
      kind: 'user',
      section: ['activity', 'topics'],
      username: 'synthetic-user',
    });
  });

  it.each([
    ['https://example.com/latest', 'unsupported-origin'],
    ['https://linux.do:8443/latest', 'unsupported-origin'],
    ['https://linux.do/unknown', 'unsupported-path'],
    ['https://linux.do/t/topic/not-a-number', 'malformed-path'],
    ['https://linux.do/t/topic/42/0', 'malformed-path'],
    ['https://linux.do/c/category/not-a-number', 'malformed-path'],
    ['not a URL', 'malformed-path'],
  ] as const)('fails safely for %s', (href, reason) => {
    expect(recognizeLinuxDoRoute(href)).toMatchObject({ kind: 'unsupported', reason });
  });
});
