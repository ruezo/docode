import { describe, expect, it } from 'vitest';

import { recognizeLinuxDoRoute } from '../../src/linuxdo/routes';
import { WorkbenchNavigationCoordinator } from '../../src/navigation/navigationCoordinator';

describe('WorkbenchNavigationCoordinator', () => {
  it('starts a direct or copied deep link as the sole address-backed view', () => {
    const route = recognizeLinuxDoRoute('https://linux.do/t/copied-topic/42/7#reply');
    const coordinator = new WorkbenchNavigationCoordinator(route);

    expect(coordinator.snapshot).toMatchObject({
      generation: 0,
      lastSource: 'initial',
      route: { href: 'https://linux.do/t/copied-topic/42/7#reply' },
      viewState: { activeViewId: 'topic:42' },
    });
    expect(coordinator.snapshot.viewState.openViews.map(({ id }) => id)).toEqual(['topic:42']);
  });

  it('activates Back and Forward destinations in stable order and updates duplicate routes', () => {
    const coordinator = new WorkbenchNavigationCoordinator(route('/latest'));
    coordinator.reconcile(route('/t/first-topic/41'), 1, 'link');
    coordinator.reconcile(route('/t/second-topic/42'), 2, 'navigation');
    coordinator.reconcile(route('/t/first-topic/41'), 3, 'popstate');
    coordinator.reconcile(route('/t/renamed-first-topic/41/8'), 4, 'navigation');
    const forward = coordinator.reconcile(route('/t/second-topic/42'), 5, 'popstate');

    expect(forward.viewState.openViews.map(({ id }) => id)).toEqual([
      'list:latest',
      'topic:41',
      'topic:42',
    ]);
    expect(forward.viewState.openViews[1]?.route.href).toBe(
      'https://linux.do/t/renamed-first-topic/41/8',
    );
    expect(forward).toMatchObject({
      generation: 5,
      lastSource: 'popstate',
      viewState: { activeViewId: 'topic:42' },
    });
  });

  it('commits active close only after its adjacent real route is observed', () => {
    const coordinator = new WorkbenchNavigationCoordinator(route('/latest'));
    coordinator.reconcile(route('/t/first-topic/41'), 1, 'link');
    coordinator.reconcile(route('/t/second-topic/42'), 2, 'link');

    const close = coordinator.requestClose('topic:42');
    expect(close).toMatchObject({ kind: 'navigate', target: { id: 'topic:41' } });
    expect(coordinator.snapshot.viewState.openViews.map(({ id }) => id)).toContain('topic:42');

    coordinator.reconcile(route('/t/first-topic/41'), 3, 'link');
    expect(coordinator.snapshot.viewState.openViews.map(({ id }) => id)).toEqual([
      'list:latest',
      'topic:41',
    ]);

    coordinator.reconcile(route('/t/second-topic/42'), 4, 'popstate');
    expect(coordinator.snapshot.viewState.openViews.map(({ id }) => id)).toEqual([
      'list:latest',
      'topic:41',
      'topic:42',
    ]);
    expect(coordinator.snapshot.viewState.activeViewId).toBe('topic:42');
  });

  it('clears unmatched open and close intents so later routes cannot apply stale state', () => {
    const coordinator = new WorkbenchNavigationCoordinator(route('/latest'));
    coordinator.prepareOpen(route('/t/first-topic/41'), {
      read: { source: 'topic-list', state: 'unread' },
    });
    coordinator.reconcile(route('/hot'), 1, 'navigation');
    coordinator.reconcile(route('/t/first-topic/41'), 2, 'popstate');
    expect(coordinator.snapshot.viewState.openViews.at(-1)).toMatchObject({
      id: 'topic:41',
      readState: 'unknown',
      readStateSource: null,
    });

    coordinator.reconcile(route('/top'), 3, 'link');
    expect(coordinator.requestClose('list:top')).toMatchObject({
      kind: 'navigate',
      target: { id: 'topic:41' },
    });
    coordinator.reconcile(route('/search?q=other'), 4, 'navigation');
    coordinator.reconcile(route('/t/first-topic/41'), 5, 'popstate');
    expect(coordinator.snapshot.viewState.openViews.map(({ id }) => id)).toContain('list:top');
  });

  it('commits route-changing bulk closes only after the selected route is observed', () => {
    const coordinator = new WorkbenchNavigationCoordinator(route('/latest'));
    coordinator.reconcile(route('/t/first-topic/41'), 1, 'link');
    coordinator.reconcile(route('/t/second-topic/42'), 2, 'link');

    expect(coordinator.requestCloseViewsToRight('topic:41')).toMatchObject({
      kind: 'navigate',
      target: { id: 'topic:41' },
    });
    expect(coordinator.snapshot.viewState.openViews).toHaveLength(3);

    coordinator.reconcile(route('/t/first-topic/41'), 3, 'link');
    expect(coordinator.snapshot.viewState.openViews.map(({ id }) => id)).toEqual([
      'list:latest',
      'topic:41',
    ]);

    coordinator.reconcile(route('/hot'), 4, 'link');
    expect(coordinator.requestCloseOtherViews('list:latest')).toMatchObject({
      kind: 'navigate',
      target: { id: 'list:latest' },
    });
    coordinator.reconcile(route('/latest'), 5, 'link');
    expect(coordinator.snapshot.viewState.openViews.map(({ id }) => id)).toEqual(['list:latest']);
  });

  it('applies bulk closes immediately when the current address remains valid', () => {
    const coordinator = new WorkbenchNavigationCoordinator(route('/latest'));
    coordinator.reconcile(route('/hot'), 1, 'link');
    coordinator.reconcile(route('/top'), 2, 'link');
    coordinator.reconcile(route('/hot'), 3, 'popstate');

    expect(coordinator.requestCloseViewsToRight('list:hot')).toEqual({ kind: 'closed' });
    expect(coordinator.snapshot.viewState.openViews.map(({ id }) => id)).toEqual([
      'list:latest',
      'list:hot',
    ]);
    expect(coordinator.requestCloseOtherViews('list:hot')).toEqual({ kind: 'closed' });
    expect(coordinator.snapshot.viewState.openViews.map(({ id }) => id)).toEqual(['list:hot']);
  });

  it('rebuilds only the current route after reload and disposes pending intents', () => {
    const beforeReload = new WorkbenchNavigationCoordinator(route('/latest'));
    beforeReload.reconcile(route('/hot'), 1, 'link');
    beforeReload.reconcile(route('/t/topic/42'), 2, 'link');
    expect(beforeReload.snapshot.viewState.openViews).toHaveLength(3);

    const afterReload = new WorkbenchNavigationCoordinator(route('/t/topic/42'));
    expect(afterReload.snapshot.viewState.openViews.map(({ id }) => id)).toEqual(['topic:42']);
    expect(afterReload.dispose()).toBe(true);
    expect(afterReload.dispose()).toBe(false);
    expect(afterReload.prepareOpen(route('/t/other/43'), {})).toBe(false);
    expect(afterReload.requestClose('topic:42')).toEqual({ kind: 'ignored' });
  });
});

function route(path: string) {
  return recognizeLinuxDoRoute(`https://linux.do${path}`);
}
