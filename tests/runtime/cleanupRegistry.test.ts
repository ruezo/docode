import { describe, expect, it } from 'vitest';

import { CleanupRegistry } from '../../src/runtime/cleanupRegistry';

describe('CleanupRegistry', () => {
  it('disposes registered work once in reverse order', () => {
    const calls: string[] = [];
    const registry = new CleanupRegistry();
    registry.add(() => calls.push('first'));
    registry.add(() => calls.push('second'));

    registry.dispose();
    registry.dispose();

    expect(calls).toEqual(['second', 'first']);
    expect(registry.isDisposed).toBe(true);
  });

  it('continues cleanup before reporting all failures', () => {
    const calls: string[] = [];
    const registry = new CleanupRegistry();
    registry.add(() => calls.push('safe'));
    registry.add(() => {
      throw new Error('cleanup failed');
    });

    expect(() => {
      registry.dispose();
    }).toThrow(AggregateError);
    expect(calls).toEqual(['safe']);
  });

  it('runs late cleanup immediately after disposal', () => {
    const calls: string[] = [];
    const registry = new CleanupRegistry();
    registry.dispose();

    registry.add(() => calls.push('late'));

    expect(calls).toEqual(['late']);
  });
});
