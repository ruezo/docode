import type { LinuxDoRoute } from '../../linuxdo/routes';
import type { CodiconName } from '../icons/codicon';

export interface WorkbenchViewContext {
  readonly canonicalPath: string;
  readonly generation: number;
  readonly icon: CodiconName;
  readonly label: string;
  readonly route: LinuxDoRoute;
  readonly statusLabel: string;
  readonly supported: boolean;
}

export function createWorkbenchViewContext(
  route: LinuxDoRoute,
  generation: number,
): WorkbenchViewContext {
  const canonicalPath = `${route.pathname}${route.search}${route.hash}` || route.href;

  if (route.kind === 'topic-list') {
    if (route.view === 'category') {
      const category = route.categorySlug ?? String(route.categoryId);
      return context(
        route,
        generation,
        `category:${lastSegment(category)}`,
        `Category ${category}`,
      );
    }
    if (route.view === 'tag') {
      return context(route, generation, `tag:${route.tagSlug}`, `Tag ${route.tagSlug}`);
    }
    return context(route, generation, route.view, `${capitalize(route.view)} topics`);
  }

  switch (route.kind) {
    case 'topic': {
      const position = route.postNumber === null ? '' : ` · Post ${String(route.postNumber)}`;
      return context(
        route,
        generation,
        `topic:${String(route.topicId)}`,
        `Topic ${String(route.topicId)}${position}`,
        'file',
      );
    }
    case 'search': {
      const query = route.query?.trim();
      return context(
        route,
        generation,
        query ? `search:${query}` : 'search',
        query ? `Search: ${query}` : 'Search',
      );
    }
    case 'user': {
      const section = route.section.length > 0 ? ` · ${route.section.join('/')}` : '';
      return context(route, generation, `@${route.username}`, `User @${route.username}${section}`);
    }
    case 'category-index':
      return context(route, generation, 'categories', 'Categories');
    case 'tag-index':
      return context(route, generation, 'tags', 'Tags');
    case 'unsupported':
      return {
        canonicalPath,
        generation,
        icon: 'warning',
        label: 'unsupported',
        route,
        statusLabel: 'Unsupported Linux DO route',
        supported: false,
      };
  }
}

function context(
  route: LinuxDoRoute,
  generation: number,
  label: string,
  statusLabel: string,
  icon: CodiconName = 'list-unordered',
): WorkbenchViewContext {
  return {
    canonicalPath: `${route.pathname}${route.search}${route.hash}` || route.href,
    generation,
    icon,
    label,
    route,
    statusLabel,
    supported: true,
  };
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function lastSegment(value: string): string {
  return value.split('/').at(-1) ?? value;
}
