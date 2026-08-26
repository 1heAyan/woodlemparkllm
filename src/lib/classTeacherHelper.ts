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
  subjectClasses?: SubjectClass[]
): ClassTeacherInfo {
  const defaultResult: ClassTeacherInfo = {
    isClassTeacher: false,
    grade: '12',
    section: 'A',
    classKey: '12-A',
    classLabel: 'Grade 12-A',
  };

  if (!user) return defaultResult;

  let detectedGrade: ValidGrade | null = null;
  let detectedSection: string | null = null;
  let isClassTeacher = false;

  // 1. Check user.assigned_class (e.g., "12-A", "Grade 12-A", "Grade 12 - Section A", "12A", "10-C", "Grade 10 (C)")
  if (user.assigned_class && typeof user.assigned_class === 'string') {
    const raw = user.assigned_class.trim();
    if (raw && raw.toLowerCase() !== 'none' && raw.toLowerCase() !== 'null' && raw.toLowerCase() !== 'undefined') {
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
        if (detectedGrade || detectedSection) {
          isClassTeacher = user.role === 'teacher';
        }
      }

      // Pattern B: Only grade digits found in assigned_class (e.g. "Grade 10", "10")
      if (!detectedGrade) {
        const numOnly = raw.replace(/[^0-9]/g, '');
        if (VALID_GRADES.includes(numOnly as ValidGrade)) {
          detectedGrade = numOnly as ValidGrade;
          isClassTeacher = user.role === 'teacher';
        }
      }
    }
  }

  // 2. Check user.grade and user.class_letter fields on profile
  if (user.grade) {
    const cleanG = (user.grade || '').replace(/[^0-9]/g, '');
    if (VALID_GRADES.includes(cleanG as ValidGrade)) {
      if (!detectedGrade) detectedGrade = cleanG as ValidGrade;
    }
  }

  if (user.class_letter) {
    const cleanS = user.class_letter.replace(/[^a-zA-Z]/g, '').toUpperCase().trim();
    if (VALID_SECTIONS.includes(cleanS)) {
      if (!detectedSection) detectedSection = cleanS;
      // If teacher has a designated class section (e.g. "A", "B", "C"), they are homeroom teacher
      if (user.role === 'teacher' && cleanS && cleanS !== '—' && cleanS !== '-') {
        isClassTeacher = true;
      }
    }
  }

  // 3. Check subject_classes table if available
  if (!isClassTeacher && user.role === 'teacher' && subjectClasses && subjectClasses.length > 0) {
    const matchedClass = subjectClasses.find(
      (sc) =>
        sc.teacher_id === user.id ||
        (sc.teacher_name && user.name && sc.teacher_name.toLowerCase().trim() === user.name.toLowerCase().trim())
    );

    if (matchedClass) {
      const clsName = matchedClass.class_name || matchedClass.name || '';
      const matchCombo = clsName.match(/(?:grade\s*)?(\d+)[^0-9a-zA-Z]*(?:section\s*)?([a-zA-Z])/i);
      if (matchCombo) {
        const gNum = matchCombo[1];
        const secLetter = matchCombo[2].toUpperCase();
        if (VALID_GRADES.includes(gNum as ValidGrade)) {
          if (!detectedGrade) detectedGrade = gNum as ValidGrade;
        }
        if (VALID_SECTIONS.includes(secLetter)) {
          if (!detectedSection) detectedSection = secLetter;
        }
      }
    }
  }

  // If user role is NOT teacher, they cannot be class teacher
  if (user.role !== 'teacher') {
    isClassTeacher = false;
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
