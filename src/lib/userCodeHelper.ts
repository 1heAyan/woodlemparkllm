/**
 * Strips artificial system prefixes (WPAP, WPS-, PRN-, ADM-, PAR-, EMP-, GR-, REG-)
 * from admission numbers and user codes.
 * Returns the clean, natural identifier (e.g. "4729", "1064", "6366", "001", "204") or empty string.
 */
export function sanitizeUserCode(code?: string | null, email?: string | null): string {
  if (!code && !email) return '';
  let c = (code || '').trim();
  
  if (c && c !== '—' && c !== '-' && c !== 'null' && c !== 'undefined') {
    // Strip prefixes like WPAP, WPS-, PRN-, ADM-, PAR-, EMP-, GR-, G.R., REG- (case-insensitive)
    const stripped = c.replace(/^(WPAP|WPS|PRN|ADM|PAR|EMP|GR|G\.R\.|REG|NO)[-_\.\s]*/i, '').trim();
    if (stripped) return stripped;
    return c;
  }
  
  if (email) {
    const emailClean = email.trim().toLowerCase();
    const prefix = emailClean.split('@')[0];

    // Only extract student admission numbers from genuine student email patterns:
    // e.g. wpap4729@woodlempark.ae, 4729@woodlempark.ae, s4729@woodlempark.ae
    const wpapMatch = prefix.match(/^wpap(\d+)$/i);
    if (wpapMatch) return wpapMatch[1];

    if (/^\d+$/.test(prefix)) return prefix;

    const studentMatch = prefix.match(/^(?:student|std|s)(\d+)$/i);
    if (studentMatch) return studentMatch[1];
  }
  return '';
}

/**
 * Normalizes an admission number/code for strictly deterministic duplicate detection.
 * E.g. "WPAP4729", "4729", " 4729 ", "adm-4729" all normalize to "4729".
 */
export function normalizeAdmissionNumber(code?: string | null, email?: string | null): string {
  const clean = sanitizeUserCode(code, email);
  if (!clean) return '';
  return clean.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Normalizes a full name for comparison (removes extra spaces, punctuation, case-insensitive).
 */
export function normalizeStudentName(name?: string | null): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks if two student records represent the same individual by matching:
 * 1. Normalized Admission Number (strongest)
 * 2. Normalized Email
 * 3. Exact Normalized Name + Matching Grade
 */
export function isMatchingStudent(
  a: { name?: string | null; email?: string | null; admission_number?: string | null; user_code?: string | null; grade?: string | null },
  b: { name?: string | null; email?: string | null; admission_number?: string | null; user_code?: string | null; grade?: string | null }
): boolean {
  if (!a || !b) return false;

  const aAdm = normalizeAdmissionNumber(a.admission_number || a.user_code, a.email);
  const bAdm = normalizeAdmissionNumber(b.admission_number || b.user_code, b.email);
  if (aAdm && bAdm && aAdm === bAdm) return true;

  const aEmail = (a.email || '').trim().toLowerCase();
  const bEmail = (b.email || '').trim().toLowerCase();
  if (aEmail && bEmail && aEmail === bEmail) return true;

  // Name + Grade match
  const aName = normalizeStudentName(a.name);
  const bName = normalizeStudentName(b.name);
  if (aName && bName && aName === bName) {
    const aGrade = (a.grade || '').replace(/[^0-9]/g, '');
    const bGrade = (b.grade || '').replace(/[^0-9]/g, '');
    if (!aGrade || !bGrade || aGrade === bGrade) {
      return true;
    }
  }

  return false;
}

