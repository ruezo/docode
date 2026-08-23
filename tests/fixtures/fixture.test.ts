import { describe, expect, it } from 'vitest';

import { defineSyntheticFixture, findSensitiveFixturePaths } from './fixture';
import { foundationFixtures } from './scenarios';

describe('fixture conventions', () => {
  it('covers missing, partial, and error inputs for each foundation domain', () => {
    for (const domain of ['command', 'lifecycle', 'route'] as const) {
      const states = foundationFixtures
        .filter((fixture) => fixture.metadata.domain === domain)
        .map((fixture) => fixture.metadata.state);

      expect(new Set(states)).toEqual(new Set(['error', 'missing', 'partial']));
    }
  });

  it('marks every foundation fixture as synthetic rather than live evidence', () => {
    for (const fixture of foundationFixtures) {
      expect(fixture.metadata.provenance).toEqual({
        createdOn: '2026-08-18',
        currentSiteContract: false,
        kind: 'synthetic',
      });
    }
  });

  it('contains no sensitive fixture fields or values', () => {
    expect(findSensitiveFixturePaths(foundationFixtures)).toEqual([]);
  });

  it('detects prohibited keys and values before fixtures are accepted', () => {
    const unsafeExample = {
      cookie: '[redacted]',
      nested: { contact: 'fixture@example.invalid' },
    };

    expect(findSensitiveFixturePaths(unsafeExample)).toEqual(['cookie', 'nested.contact']);
  });

  it('rejects fixture identifiers that are not lowercase kebab-case', () => {
    expect(() =>
      defineSyntheticFixture(
        { createdOn: '2026-08-18', domain: 'route', id: 'Invalid ID', state: 'error' },
        {},
      ),
    ).toThrow(/lowercase kebab-case/);
  });
});
