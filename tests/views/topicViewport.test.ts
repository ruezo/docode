import { describe, expect, it } from 'vitest';

import {
  clampProgress,
  createTopicViewportState,
  getScrollTopForProgress,
} from '../../src/views/topic/topicViewport';

describe('topic viewport math', () => {
  it('derives VS Code-style proportional viewport geometry', () => {
    expect(
      createTopicViewportState({ clientHeight: 200, scrollHeight: 1_000, scrollTop: 400 }, 101),
    ).toEqual({
      clientHeight: 200,
      currentPostId: 101,
      scrollHeight: 1_000,
      scrollProgress: 0.5,
      scrollTop: 400,
      size: 0.2,
      start: 0.4,
    });
  });

  it('clamps stale geometry and non-scrollable content safely', () => {
    expect(
      createTopicViewportState({ clientHeight: 300, scrollHeight: 200, scrollTop: 50 }, null),
    ).toMatchObject({ scrollHeight: 300, scrollProgress: 0, scrollTop: 0, size: 1, start: 0 });
    expect(
      createTopicViewportState({ clientHeight: 100, scrollHeight: 500, scrollTop: 900 }, 1),
    ).toMatchObject({ scrollProgress: 1, scrollTop: 400, size: 0.2, start: 0.8 });
  });

  it('maps clamped slider progress back to the real scroll range', () => {
    expect(getScrollTopForProgress(0.25, 1_000, 200)).toBe(200);
    expect(getScrollTopForProgress(2, 1_000, 200)).toBe(800);
    expect(getScrollTopForProgress(0.5, 100, 200)).toBe(0);
    expect(clampProgress(-1)).toBe(0);
    expect(clampProgress(1.5)).toBe(1);
  });
});
