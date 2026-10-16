import { UserProfile, SubjectClass } from './supabaseClient';

export const VALID_GRADES = ['9', '10', '11', '12'] as const;
export type ValidGrade = (typeof VALID_GRADES)[number];

export const VALID_SECTIONS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)); // A through Z

export interface ClassTeacherInfo {
  isClassTeacher: boolean;
  grade: ValidGrade;
  section: string;
  classKey: string; // e.g. "12-A"
  classLabel: string; // e.g. "Grade 12-A"
}

/**
 * Robustly parses and extracts class teacher designation, homeroom grade, and section
 * across any schema or string format (e.g. "12-A", "Grade 12-A", "Grade 12 (A)", "12 A", "12A",
 * or from `grade` + `class_letter` attributes, or matching `subject_classes`).
 */
export function extractClassTeacherInfo(
  user?: UserProfile | null,
  _subjectClasses?: SubjectClass[]
): ClassTeacherInfo {
  const defaultResult: ClassTeacherInfo = {
    isClassTeacher: false,
    grade: '12',
    section: 'A',
    classKey: '',
    classLabel: '',
  };

  if (!user || user.role !== 'teacher') return defaultResult;

  let detectedGrade: ValidGrade | null = null;
  let detectedSection: string | null = null;
  let isClassTeacher = false;

  // Check user.assigned_class (e.g., "12-A", "Grade 12-A", "Grade 12 - Section A", "12A", "10-C", "Grade 10 (C)")
  if (user.assigned_class && typeof user.assigned_class === 'string') {
    const raw = user.assigned_class.trim();
    if (
      raw &&
      raw.toLowerCase() !== 'none' &&
      raw.toLowerCase() !== 'null' &&
      raw.toLowerCase() !== 'undefined' &&
      raw !== '—' &&
      raw !== '-' &&
      raw !== 'N/A'
    ) {
      // Pattern A: Grade number and Section Letter separated by hyphen/slash/space/parentheses
      // e.g. "12-A", "Grade 12 - A", "12/A", "Grade 12 (A)", "12A", "Grade 12 Section A"
      const matchCombo = raw.match(/(?:grade\s*)?(\d+)[^0-9a-zA-Z]*(?:section\s*)?([a-zA-Z])/i);
      if (matchCombo) {
        const gNum = matchCombo[1];
        const secLetter = matchCombo[2].toUpperCase();
        if (VALID_GRADES.includes(gNum as ValidGrade)) {
          detectedGrade = gNum as ValidGrade;
        }
        if (VALID_SECTIONS.includes(secLetter)) {
          detectedSection = secLetter;
        }
        if (detectedGrade && detectedSection) {
          isClassTeacher = true;
        }
      }

      // Pattern B: Only grade digits found in assigned_class (e.g. "Grade 10", "10")
      if (!detectedGrade) {
        const numOnly = raw.replace(/[^0-9]/g, '');
        if (VALID_GRADES.includes(numOnly as ValidGrade)) {
          detectedGrade = numOnly as ValidGrade;
          detectedSection = 'A';
          isClassTeacher = true;
        }
      }
    }
  }

  if (!isClassTeacher) {
    return {
      isClassTeacher: false,
      grade: '12',
      section: 'A',
      classKey: '',
      classLabel: '',
    };
  }

  const finalGrade: ValidGrade = detectedGrade || '12';
  const finalSection: string = detectedSection || 'A';
  const classKey = `${finalGrade}-${finalSection}`;
  const classLabel = `Grade ${finalGrade}-${finalSection}`;

  return {
    isClassTeacher,
    grade: finalGrade,
    section: finalSection,
    classKey,
    classLabel,
  };
}

const ROMAN_GRADES: Record<string, ValidGrade> = { IX: '9', X: '10', XI: '11', XII: '12' };

/**
 * Normalises any stored grade value ("12", "Grade 12", "12th", "XII", "12-A") to a ValidGrade.
 */
export function parseGradeValue(raw?: string | null): ValidGrade | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const digits = trimmed.match(/\d+/)?.[0];
  if (digits && VALID_GRADES.includes(digits as ValidGrade)) return digits as ValidGrade;

  const roman = trimmed.replace(/^grade\s*/i, '').match(/^(XII|XI|IX|X)\b/i)?.[1]?.toUpperCase();
  if (roman && ROMAN_GRADES[roman]) return ROMAN_GRADES[roman];

  return null;
}

/**
 * Normalises any stored section value ("A", "Section A", "a", "12-A") to an uppercase letter.
 */
export function parseSectionValue(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw.trim().replace(/^section\s*/i, '');
  if (!cleaned) return null;

  // Single letter (most common: "A")
  if (/^[a-zA-Z]$/.test(cleaned)) return cleaned.toUpperCase();

  // Combined format like "12-A", "12A", "Grade 12 (A)" → take the trailing letter after digits
  const combo = cleaned.match(/\d+[^0-9a-zA-Z]*([a-zA-Z])\b/);
  if (combo) return combo[1].toUpperCase();

  return null;
}

/**
 * Role-aware class cohort extraction used by admin edit screens.
 * - Students: reads their actual enrolled `grade` + `class_letter` from the profile.
 * - Teachers: delegates to `extractClassTeacherInfo` (homeroom assignment).
 */
export function extractUserClassInfo(
  user?: UserProfile | null,
  subjectClasses?: SubjectClass[]
): ClassTeacherInfo {
  if (!user || user.role === 'teacher') {
    return extractClassTeacherInfo(user, subjectClasses);
  }

  const grade = parseGradeValue(user.grade) || '12';
  const section =
    parseSectionValue(user.class_letter) ||
    parseSectionValue(user.grade) || // e.g. grade stored as "12-B"
    'A';

  return {
    isClassTeacher: false,
    grade,
    section,
    classKey: `${grade}-${section}`,
    classLabel: `Grade ${grade}-${section}`,
  };
}

/**
 * Checks whether a teacher is assigned to a specific class cohort (e.g. "12-A" or "Grade 12-A").
 */
export function isTeacherAssignedToClass(
  user: UserProfile,
  targetClass: string,
  subjectClasses?: SubjectClass[]
): boolean {
  if (user.role !== 'teacher') return false;

  const info = extractClassTeacherInfo(user, subjectClasses);
  if (!info.isClassTeacher) return false;

  const cleanTarget = targetClass.replace(/^Grade\s*/i, '').trim().toUpperCase();
  const cleanKey = info.classKey.toUpperCase();

  return cleanTarget === cleanKey;
}
