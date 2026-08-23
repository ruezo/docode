export function sanitizeJavaIdentifier(name: string): string {
  const sanitized = name.replaceAll(/[^\w$]/gu, '_');
  return /^\d/u.test(sanitized) ? `_${sanitized}` : sanitized;
}
