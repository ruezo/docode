export type FixtureDomain = 'command' | 'lifecycle' | 'route';
export type FixtureState = 'error' | 'missing' | 'partial';

export interface FixtureMetadata {
  readonly domain: FixtureDomain;
  readonly id: string;
  readonly state: FixtureState;
  readonly provenance: {
    readonly createdOn: string;
    readonly currentSiteContract: false;
    readonly kind: 'synthetic';
  };
}

export interface SyntheticFixture<T> {
  readonly input: T;
  readonly metadata: FixtureMetadata;
}

interface SyntheticFixtureDefinition {
  readonly createdOn: string;
  readonly domain: FixtureDomain;
  readonly id: string;
  readonly state: FixtureState;
}

const FIXTURE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SENSITIVE_KEY_PARTS = [
  'authorization',
  'cookie',
  'credential',
  'email',
  'password',
  'privatekey',
  'secret',
  'session',
  'token',
] as const;
const SENSITIVE_VALUE_PATTERNS = [
  /\bBearer\s+[A-Za-z0-9._~-]+/i,
  /-----BEGIN (?:EC |OPENSSH |RSA )?PRIVATE KEY-----/,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
] as const;

export function defineSyntheticFixture<T>(
  definition: SyntheticFixtureDefinition,
  input: T,
): SyntheticFixture<T> {
  if (!FIXTURE_ID_PATTERN.test(definition.id)) {
    throw new Error(`Fixture ID must use lowercase kebab-case: ${definition.id}`);
  }

  return {
    input,
    metadata: {
      domain: definition.domain,
      id: definition.id,
      state: definition.state,
      provenance: {
        createdOn: definition.createdOn,
        currentSiteContract: false,
        kind: 'synthetic',
      },
    },
  };
}

export function findSensitiveFixturePaths(value: unknown): string[] {
  const matches: string[] = [];
  const visited = new WeakSet<object>();

  function visit(candidate: unknown, path: string): void {
    if (typeof candidate === 'string') {
      if (SENSITIVE_VALUE_PATTERNS.some((pattern) => pattern.test(candidate))) {
        matches.push(path);
      }
      return;
    }

    if (Array.isArray(candidate)) {
      if (visited.has(candidate)) return;
      visited.add(candidate);
      candidate.forEach((item, index) => {
        visit(item, `${path}[${index.toString()}]`);
      });
      return;
    }

    if (!isRecord(candidate) || visited.has(candidate)) return;
    visited.add(candidate);

    for (const [key, child] of Object.entries(candidate)) {
      const childPath = path ? `${path}.${key}` : key;
      const normalizedKey = key.toLowerCase().replaceAll(/[^a-z]/g, '');
      if (SENSITIVE_KEY_PARTS.some((part) => normalizedKey.includes(part))) {
        matches.push(childPath);
        continue;
      }
      visit(child, childPath);
    }
  }

  visit(value, '');
  return matches;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
