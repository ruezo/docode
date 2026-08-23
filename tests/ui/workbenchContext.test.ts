import { describe, expect, it } from 'vitest';

import { recognizeLinuxDoRoute } from '../../src/linuxdo/routes';
import { createWorkbenchViewContext } from '../../src/ui/workbench/workbenchContext';

describe('createWorkbenchViewContext', () => {
  it.each([
    ['https://linux.do/latest', 'latest', 'Latest topics'],
    ['https://linux.do/hot', 'hot', 'Hot topics'],
    ['https://linux.do/top', 'top', 'Top topics'],
    [
      'https://linux.do/c/resource/cloud-asset/94',
      'category:cloud-asset',
      'Category resource/cloud-asset',
    ],
    ['https://linux.do/tag/openai/4', 'tag:openai', 'Tag openai'],
    ['https://linux.do/categories', 'categories', 'Categories'],
    ['https://linux.do/tags', 'tags', 'Tags'],
    ['https://linux.do/search?q=route', 'search:route', 'Search: route'],
    [
      'https://linux.do/u/synthetic-user/activity/topics',
      '@synthetic-user',
      'User @synthetic-user · activity/topics',
    ],
    ['https://linux.do/t/synthetic-topic/42/7', 'topic:42', 'Topic 42 · Post 7'],
  ] as const)('derives real chrome context for %s', (href, label, statusLabel) => {
    expect(createWorkbenchViewContext(recognizeLinuxDoRoute(href), 3)).toMatchObject({
      canonicalPath: new URL(href).pathname + new URL(href).search,
      generation: 3,
      label,
      statusLabel,
      supported: true,
    });
  });

  it('does not present an unsupported path as a working view', () => {
    expect(
      createWorkbenchViewContext(recognizeLinuxDoRoute('https://linux.do/unknown'), 4),
    ).toMatchObject({
      generation: 4,
      icon: 'warning',
      label: 'unsupported',
      statusLabel: 'Unsupported Linux DO route',
      supported: false,
    });
  });
});
