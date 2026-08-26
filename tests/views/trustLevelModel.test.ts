import { describe, expect, it } from 'vitest';

import type { LinuxDoTrustLevelSnapshot } from '../../src/linuxdo/trustLevelLoader';
import { createTrustLevelBuildModel } from '../../src/views/trust/trustLevelModel';

function snapshot(overrides: Partial<LinuxDoTrustLevelSnapshot> = {}): LinuxDoTrustLevelSnapshot {
  return {
    daysVisited: 0,
    likesGiven: 0,
    likesReceived: 0,
    postCount: 0,
    postsReadCount: 0,
    timeReadSeconds: 0,
    topicCount: 0,
    topicsEntered: 0,
    trustLevel: 0,
    username: 'ruez',
    ...overrides,
  };
}

describe('trust level build model', () => {
  it('tracks the Discourse defaults toward trust level 1', () => {
    const model = createTrustLevelBuildModel(
      snapshot({ postsReadCount: 15, timeReadSeconds: 600, topicsEntered: 5, trustLevel: 0 }),
    );

    expect(model.kind).toBe('progress');
    expect(model.nextLevel).toBe(1);
    expect(model.steps.map(({ complete, id }) => [id, complete])).toEqual([
      ['topics-entered', true],
      ['posts-read', false],
      ['time-read', true],
    ]);
    expect(model.completedSteps).toBe(2);
    expect(model.progressRatio).toBeCloseTo((1 + 0.5 + 1) / 3, 5);
  });

  it('tracks all seven trust level 2 requirements from lifetime totals', () => {
    const model = createTrustLevelBuildModel(
      snapshot({
        daysVisited: 20,
        likesGiven: 1,
        likesReceived: 0,
        postCount: 3,
        postsReadCount: 250,
        timeReadSeconds: 3_600,
        topicsEntered: 25,
        trustLevel: 1,
      }),
    );

    expect(model.kind).toBe('progress');
    expect(model.nextLevel).toBe(2);
    expect(model.steps).toHaveLength(7);
    expect(model.completedSteps).toBe(6);
    expect(model.steps.find(({ id }) => id === 'likes-received')?.complete).toBe(false);
    expect(model.steps.find(({ id }) => id === 'time-read')).toMatchObject({
      target: 60,
      unit: 'minutes',
      value: 60,
    });
  });

  it('marks trust level 3 targets as reference-only and higher levels as unbuildable', () => {
    const reference = createTrustLevelBuildModel(
      snapshot({ daysVisited: 200, likesGiven: 10, likesReceived: 40, trustLevel: 2 }),
    );
    expect(reference.kind).toBe('reference');
    expect(reference.steps.map(({ complete }) => complete)).toEqual([true, false, true]);

    expect(createTrustLevelBuildModel(snapshot({ trustLevel: 3 }))).toMatchObject({
      kind: 'granted',
      nextLevel: 4,
      steps: [],
    });
    expect(createTrustLevelBuildModel(snapshot({ trustLevel: 4 }))).toMatchObject({
      kind: 'max',
      nextLevel: null,
      progressRatio: 1,
    });
  });
});
