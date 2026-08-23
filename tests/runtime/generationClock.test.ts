import { describe, expect, it } from 'vitest';

import { GenerationClock } from '../../src/runtime/generationClock';

describe('GenerationClock', () => {
  it('invalidates captured work deterministically', () => {
    const clock = new GenerationClock();
    const initialGeneration = clock.capture();

    expect(clock.isCurrent(initialGeneration)).toBe(true);
    expect(clock.invalidate()).toBe(initialGeneration + 1);
    expect(clock.isCurrent(initialGeneration)).toBe(false);
    expect(clock.isCurrent(clock.capture())).toBe(true);
  });
});
