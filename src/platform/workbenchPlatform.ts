export type WorkbenchOperatingSystem = 'linux' | 'mac' | 'windows';

export function detectWorkbenchOperatingSystem(
  navigatorLike: Pick<Navigator, 'platform' | 'userAgent'> = globalThis.navigator,
): WorkbenchOperatingSystem {
  const userAgentData: unknown = Reflect.get(navigatorLike, 'userAgentData');
  const clientPlatform: unknown =
    typeof userAgentData === 'object' && userAgentData !== null
      ? Reflect.get(userAgentData, 'platform')
      : '';
  const fingerprint = `${typeof clientPlatform === 'string' ? clientPlatform : ''} ${navigatorLike.platform} ${navigatorLike.userAgent}`;

  if (/Windows|Win32|Win64/u.test(fingerprint)) return 'windows';
  if (/Mac|iPhone|iPad/u.test(fingerprint)) return 'mac';
  return 'linux';
}
