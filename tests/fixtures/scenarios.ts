import { defineSyntheticFixture } from './fixture';

const createdOn = '2026-08-18';

export const foundationFixtures = [
  defineSyntheticFixture(
    { createdOn, domain: 'route', id: 'route-missing-location', state: 'missing' },
    {},
  ),
  defineSyntheticFixture(
    { createdOn, domain: 'route', id: 'route-partial-topic-path', state: 'partial' },
    { pathname: '/t/synthetic-topic/42' },
  ),
  defineSyntheticFixture(
    { createdOn, domain: 'route', id: 'route-malformed-url', state: 'error' },
    { href: 'not a valid URL' },
  ),
  defineSyntheticFixture(
    { createdOn, domain: 'command', id: 'command-missing-input', state: 'missing' },
    {},
  ),
  defineSyntheticFixture(
    { createdOn, domain: 'command', id: 'command-partial-open', state: 'partial' },
    { raw: 'open' },
  ),
  defineSyntheticFixture(
    { createdOn, domain: 'command', id: 'command-malformed-quote', state: 'error' },
    { raw: 'open "unterminated' },
  ),
  defineSyntheticFixture(
    { createdOn, domain: 'lifecycle', id: 'lifecycle-missing-state', state: 'missing' },
    {},
  ),
  defineSyntheticFixture(
    { createdOn, domain: 'lifecycle', id: 'lifecycle-partial-mount', state: 'partial' },
    { phase: 'mounting' },
  ),
  defineSyntheticFixture(
    { createdOn, domain: 'lifecycle', id: 'lifecycle-duplicate-mount', state: 'error' },
    { duplicateMount: true, phase: 'mounted' },
  ),
] as const;
