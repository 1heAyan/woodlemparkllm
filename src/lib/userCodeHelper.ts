/**
 * Strips artificial system prefixes (WPS-, PRN-, ADM-, PAR-, EMP-) from admission numbers and user codes.
 * Returns the clean, natural identifier (e.g. "1064", "6366", "001", "204") or empty string.
 */
export function sanitizeUserCode(code?: string | null, email?: string | null): string {
  if (!code && !email) return '';
  let c = (code || '').trim();
  // Strip prefixes like WPS-, PRN-, ADM-, PAR-, EMP- (case-insensitive)
  c = c.replace(/^(WPS|PRN|ADM|PAR|EMP)[-_ ]*/i, '').trim();
  if (c) return c;
  if (email) {
    const numMatch = email.match(/\b\d+\b/) || email.match(/(\d+)/);
    if (numMatch) return numMatch[1];
  }
  return '';
}
