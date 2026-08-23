import { describe, expect, it } from 'vitest';

import { isLinuxDoLocation, LINUX_DO_MATCH_PATTERN, LINUX_DO_ORIGIN } from '../../src/linuxdo/host';

describe('Linux DO host boundary', () => {
  it('accepts only the supported HTTPS origin', () => {
    expect(isLinuxDoLocation({ protocol: 'https:', hostname: 'linux.do' })).toBe(true);
    expect(isLinuxDoLocation({ protocol: 'http:', hostname: 'linux.do' })).toBe(false);
    expect(isLinuxDoLocation({ protocol: 'https:', hostname: 'www.linux.do' })).toBe(false);
    expect(isLinuxDoLocation({ protocol: 'https:', hostname: 'example.com' })).toBe(false);
    expect(isLinuxDoLocation({ protocol: 'https:', hostname: 'linux.do', port: '8443' })).toBe(
      false,
    );
  });

  it('keeps the canonical origin and content-script match explicit', () => {
    expect(LINUX_DO_ORIGIN).toBe('https://linux.do');
    expect(LINUX_DO_MATCH_PATTERN).toBe('https://linux.do/*');
  });
});
