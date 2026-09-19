import { UserProfile, SubjectClass, CsQuestion, CsSubmission } from './supabaseClient';

/**
 * Computer Science Lab (CS Lab) role detection.
 *
 * A user "is CS" when:
 *  - Teacher: their profile subject OR any subject-classroom they own matches
 *    the CS subject list (Computer Science, Informatics Practices, AI, etc.).
 *  - Student: they are enrolled in at least one CS subject classroom
 *    (explicit enrollment or the legacy grade+section fallback).
 */

export const CS_SUBJECT_KEYWORDS = [
  'computer science',
  'informatics practices',
  'artificial intelligence',
  'computer application',
  'python',
  'coding',
  'programming',
];

/** Case-insensitive keyword match against the CS subject list. */
export function isCsSubject(subject?: string | null): boolean {
  if (!subject) return false;
  const s = String(subject).toLowerCase().trim();
  if (!s) return false;
  return CS_SUBJECT_KEYWORDS.some((k) => s.includes(k) || k.includes(s));
}

/**
 * All classrooms whose subject qualifies as Computer Science / IT.
 * Skips legacy seed rows the same way the dashboards do.
 */
export function getCsClassrooms(subjectClasses: SubjectClass[]): SubjectClass[] {
  return (subjectClasses || []).filter(
    (c) =>
      c &&
      !String(c.id || '').startsWith('class-seed-') &&
      c.name !== 'Physics 12-C' &&
      c.name !== 'Chemistry 12-C' &&
      (isCsSubject(c.subject) || isCsSubject(c.name))
  );
}

/** Teacher is a CS teacher when their subject or one of their classes is CS. */
export function isCsTeacher(
  user?: UserProfile | null,
  subjectClasses?: SubjectClass[]
): boolean {
  if (!user || user.role !== 'teacher') return false;
  if (isCsSubject(user.subject)) return true;
  if (subjectClasses && subjectClasses.length > 0) {
    return subjectClasses.some(
      (c) =>
        c &&
        c.teacher_id === user.id &&
        !String(c.id || '').startsWith('class-seed-') &&
        (isCsSubject(c.subject) || isCsSubject(c.name))
    );
  }
  return false;
}

/** Legacy fallback: class membership by grade+section when enrollment list is empty. */
export function isStudentInClass(
  student: UserProfile,
  cls: SubjectClass
): boolean {
  const enrolled = cls.enrolled_student_ids || [];
  if (enrolled.includes(student.id)) return true;
  if (student.email && enrolled.includes(student.email)) return true;

  if (enrolled.length === 0 && cls.class_name) {
    const cn = String(cls.class_name).toLowerCase().replace(/grade\s*/gi, '').trim();
    const parts = cn.split(/[-\s]+/);
    const cnGrade = parts.find((p) => /^\d+$/.test(p)) || '';
    const cnLetter = parts.find((p) => /^[a-z]$/.test(p))?.toUpperCase() || '';
    const sGrade = String(student.grade || '').replace(/[^0-9]/g, '');
    const sLetter = String(student.class_letter || '').toUpperCase().trim();
    return !!cnGrade && cnGrade === sGrade && (!cnLetter || cnLetter === sLetter);
  }
  return false;
}

/** All CS classrooms a student is a member of. */
export function getStudentCsClasses(
  student: UserProfile,
  subjectClasses: SubjectClass[]
): SubjectClass[] {
  return getCsClassrooms(subjectClasses).filter((cls) => isStudentInClass(student, cls));
}

/** Student "is CS" when enrolled in at least one CS classroom. */
export function isCsStudent(
  user?: UserProfile | null,
  subjectClasses?: SubjectClass[]
): boolean {
  if (!user || user.role !== 'student') return false;
  return getStudentCsClasses(user, subjectClasses || []).length > 0;
}

/** CS classes this teacher owns (for the class picker when assigning questions). */
export function getTeacherCsClasses(
  teacher: UserProfile,
  subjectClasses: SubjectClass[]
): SubjectClass[] {
  return getCsClassrooms(subjectClasses).filter((c) => c.teacher_id === teacher.id);
}

/** Questions assigned to any of the given class IDs (published, not drafts). */
export function getQuestionsForClasses(
  questions: CsQuestion[],
  classIds: string[],
  includeDrafts: boolean = false
): CsQuestion[] {
  const ids = new Set(classIds);
  return (questions || []).filter(
    (q) =>
      (includeDrafts || q.is_published !== false) &&
      (q.target_class_ids || []).some((c) => ids.has(c))
  );
}

/** Students enrolled in any of the given class IDs (deduplicated). */
export function getStudentsForClasses(
  profiles: UserProfile[],
  classIds: string[],
  subjectClasses: SubjectClass[]
): UserProfile[] {
  const ids = new Set(classIds);
  const target = (subjectClasses || []).filter((c) => ids.has(c.id));
  const out: UserProfile[] = [];
  const seen = new Set<string>();
  (profiles || []).forEach((p) => {
    if (p.role !== 'student' || p.is_deactivated) return;
    const match = target.some((cls) => isStudentInClass(p, cls));
    if (match && !seen.has(p.id)) {
      seen.add(p.id);
      out.push(p);
    }
  });
  return out;
}

/** Latest submission of each student for a question (map keyed by student_id). */
export function mapSubmissionsByStudent(
  submissions: CsSubmission[],
  questionId: string
): Record<string, CsSubmission> {
  const map: Record<string, CsSubmission> = {};
  (submissions || []).forEach((s) => {
    if (s.question_id === questionId) map[s.student_id] = s;
  });
  return map;
}

/** Status summary counts for a set of submissions. */
export function summarizeSubmissionStatuses(submissions: CsSubmission[]): {
  total: number;
  passed: number;
  passedReview: number;
  failed: number;
  pending: number;
} {
  const subs = submissions || [];
  return {
    total: subs.length,
    passed: subs.filter((s) => s.status === 'passed').length,
    passedReview: subs.filter((s) => s.status === 'passed_review').length,
    failed: subs.filter((s) => s.status === 'failed').length,
    pending: subs.filter((s) => s.status === 'draft' || !s.status).length,
  };
}

/** Time-window gate shared by tests and CS questions. */
export function getCsQuestionTimeStatus(
  q: CsQuestion,
  nowMs: number
): { status: 'open' } | { status: 'coming_soon'; startsAt: string } | { status: 'past_deadline'; endedAt: string } {
  if (!q.start_time && !q.deadline) return { status: 'open' };
  if (q.start_time && nowMs < new Date(q.start_time).getTime()) {
    return { status: 'coming_soon', startsAt: new Date(q.start_time).toLocaleString() };
  }
  if (q.deadline && nowMs > new Date(q.deadline).getTime()) {
    return { status: 'past_deadline', endedAt: new Date(q.deadline).toLocaleString() };
  }
  return { status: 'open' };
}
