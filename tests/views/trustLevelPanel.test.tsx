// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { LinuxDoTrustLevelSnapshot } from '../../src/linuxdo/trustLevelLoader';
import { TrustLevelPanel } from '../../src/views/trust/TrustLevelPanel';

afterEach(cleanup);

const SNAPSHOT: LinuxDoTrustLevelSnapshot = {
  daysVisited: 20,
  likesGiven: 1,
  likesReceived: 2,
  postCount: 3,
  postsReadCount: 250,
  timeReadSeconds: 1_800,
  topicCount: 1,
  topicsEntered: 25,
  trustLevel: 1,
  username: 'ruez',
};

describe('TrustLevelPanel', () => {
  it('renders the build header, per-check progress, and the official report link', () => {
    render(
      <TrustLevelPanel
        onRefresh={() => undefined}
        state={{ snapshot: SNAPSHOT, status: 'ready' }}
      />,
    );

    expect(screen.getByText('trust-level build · TL1 → TL2')).toBeDefined();
    expect(screen.getByText('TL1')).toBeDefined();
    expect(screen.getByText('@ruez')).toBeDefined();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('6');
    expect(screen.getByText('6/7 checks passed')).toBeDefined();
    expect(screen.getAllByText('Reading time').length).toBeGreaterThan(0);
    expect(screen.getByText('30 / 60 min')).toBeDefined();
    const link = screen.getByRole('link', { name: 'connect.linux.do' });
    expect(link.getAttribute('href')).toBe('https://connect.linux.do/');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');

    const stats = Array.from(document.querySelectorAll('.docode-trust__stat')).map((stat) => [
      stat.querySelector('dt')?.textContent,
      stat.querySelector('dd')?.textContent,
    ]);
    expect(stats).toEqual([
      ['Days visited', '20'],
      ['Reading time', '30 min'],
      ['Topics entered', '25'],
      ['Posts read', '250'],
      ['Likes given', '1'],
      ['Likes received', '2'],
      ['Topics created', '1'],
      ['Replies created', '3'],
    ]);
  });

  it('explains the rolling window for TL2 users and offers retry on failure', () => {
    render(
      <TrustLevelPanel
        onRefresh={() => undefined}
        state={{ snapshot: { ...SNAPSHOT, trustLevel: 2 }, status: 'ready' }}
      />,
    );
    expect(screen.getByText(/rolling 100-day window/u)).toBeDefined();
    cleanup();

    const onRefresh = vi.fn();
    render(<TrustLevelPanel onRefresh={onRefresh} state={{ status: 'unavailable' }} />);
    expect(screen.getByText('Linux DO did not return trust level data.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);

    cleanup();
    render(<TrustLevelPanel onRefresh={onRefresh} state={{ status: 'authentication-required' }} />);
    expect(
      screen.getByText('Sign in to Linux DO to read your trust level build progress.'),
    ).toBeDefined();
  });
});
