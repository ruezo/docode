export const LINUX_DO_ORIGIN = 'https://linux.do' as const;
export const LINUX_DO_MATCH_PATTERN = 'https://linux.do/*' as const;

type LocationIdentity = Pick<Location, 'hostname' | 'protocol'> & { readonly port?: string };

export function isLinuxDoLocation(location: LocationIdentity): boolean {
  return (
    location.protocol === 'https:' &&
    location.hostname === 'linux.do' &&
    (location.port === undefined || location.port === '')
  );
}

export function isLinuxDoUrl(value: string): boolean {
  try {
    return isLinuxDoLocation(new URL(value));
  } catch {
    return false;
  }
}
