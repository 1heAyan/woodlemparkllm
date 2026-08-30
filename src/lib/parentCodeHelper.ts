import { UserProfile, supabase } from './supabaseClient';

/**
 * Normalizes user-entered verification codes by removing dashes, spaces, and converting to uppercase.
 * e.g. "pl-482-901" -> "PL482901", "482 901" -> "482901"
 */
export function normalizeCode(code: string): string {
  if (!code) return '';
  return code.replace(/[\s\-_]/g, '').toUpperCase().trim();
}

/**
 * Deterministically or randomly generates a clean 6-digit Parent Link Code in the format `PL-XXXXXX`.
 */
export function generateParentLinkCode(studentId?: string, admissionNumber?: string): string {
  if (admissionNumber && admissionNumber.trim()) {
    // Deterministic hash based on admission number to keep consistent unless regenerated
    const cleanAdm = admissionNumber.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    let hash = 0;
    for (let i = 0; i < cleanAdm.length; i++) {
      hash = (hash << 5) - hash + cleanAdm.charCodeAt(i);
      hash |= 0;
    }
    const numPart = Math.abs(hash % 900000) + 100000;
    return `PL-${numPart}`;
  }

  // Random 6-digit fallback
  const randomNum = Math.floor(100000 + Math.random() * 900000);
  return `PL-${randomNum}`;
}

/**
 * Ensures a student profile has a valid parent_link_code.
 * If missing, generates one deterministically and can save back to Supabase.
 */
export function getOrGenerateStudentParentCode(student: UserProfile): string {
  if (student.parent_link_code && student.parent_link_code.trim()) {
    return student.parent_link_code.trim().toUpperCase();
  }
  return generateParentLinkCode(student.id, student.admission_number || student.user_code);
}

/**
 * Persists a newly generated parent link code for a student profile to Supabase.
 */
export async function persistStudentParentCode(studentId: string, code: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ parent_link_code: code })
      .eq('id', studentId);
    return !error;
  } catch (e) {
    console.warn('Failed to persist parent_link_code to Supabase:', e);
    return false;
  }
}

/**
 * Matches a student in the profiles list by school email AND admission number.
 * Supports flexible formats (e.g. WPS- prefix, case-insensitive, whitespace).
 */
export function matchStudentByEmailAndAdmission(
  emailInput: string,
  admissionInput: string,
  profiles: UserProfile[]
): UserProfile | null {
  const cleanEmail = (emailInput || '').trim().toLowerCase();
  const rawAdm = (admissionInput || '').trim().toUpperCase();
  const cleanAdm = rawAdm.replace(/^WPS-?/i, '');

  if (!cleanEmail || !rawAdm) return null;

  return (
    profiles.find((p) => {
      if (p.role !== 'student') return false;

      const pEmail = (p.email || '').trim().toLowerCase();
      const emailMatches = pEmail === cleanEmail;

      const pAdm = (p.admission_number || '').trim().toUpperCase();
      const pCode = (p.user_code || '').trim().toUpperCase();
      const pCleanAdm = pAdm.replace(/^WPS-?/i, '');
      const pCleanCode = pCode.replace(/^WPS-?/i, '');

      const admMatches =
        pAdm === rawAdm ||
        pCode === rawAdm ||
        (cleanAdm && (pCleanAdm === cleanAdm || pCleanCode === cleanAdm));

      return emailMatches && admMatches;
    }) || null
  );
}

/**
 * Verifies if an entered code matches the student's assigned parent link code.
 * Lenient check allows `PL-123456`, `PL123456`, or just `123456`.
 */
export function verifyStudentParentCode(student: UserProfile, enteredCode: string): boolean {
  if (!student || !enteredCode) return false;

  const assignedCode = getOrGenerateStudentParentCode(student);
  const normalizedAssigned = normalizeCode(assignedCode);
  const normalizedEntered = normalizeCode(enteredCode);

  if (normalizedAssigned === normalizedEntered) return true;

  // Check without 'PL' prefix
  const rawAssignedDigits = normalizedAssigned.replace(/^PL/, '');
  const rawEnteredDigits = normalizedEntered.replace(/^PL/, '');

  return rawAssignedDigits === rawEnteredDigits && rawAssignedDigits.length >= 4;
}

/**
 * Builds a direct WhatsApp message URL for a Class Teacher to send the student's parent code.
 */
export function buildWhatsAppShareUrl(
  student: UserProfile,
  code: string,
  portalOrigin?: string
): string {
  const studentName = student.name || 'your child';
  const admNo = student.admission_number || student.user_code || '—';
  const gradeSec = student.grade
    ? `Grade ${student.grade.replace(/[^0-9]/g, '')}${student.class_letter ? `-${student.class_letter.toUpperCase()}` : ''}`
    : 'Class';

  const baseUrl = portalOrigin || (typeof window !== 'undefined' ? window.location.origin : 'https://woodlemlms.ae');
  const regUrl = `${baseUrl}?register=parent`;

  const messageText = 
`Hello! Here is the Parent Portal access code for *${studentName}* (${gradeSec}, Admission No: *${admNo}*):

🔑 Parent Verification Code: *${code}*

Please use this code to register on the Woodlem LMS Parent Portal:
👉 ${regUrl}

Once registered, you can track attendance, term reports, test results, and class resources.`;

  return `https://api.whatsapp.com/send?text=${encodeURIComponent(messageText)}`;
}
