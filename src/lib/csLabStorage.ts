import { supabase, CsQuestion, CsSubmission, CsLabSession } from './supabaseClient';
import { CsQuestionSavePayload, CsSubmissionOverridePayload } from '@/components/CSLab/TeacherCSLabView';
import { CsSubmissionSavePayload } from '@/components/CSLab/StudentCSLabView';

export const CS_QUESTIONS_CACHE_KEY = 'woodlem_cs_questions_cache_v1';
export const CS_SUBMISSIONS_CACHE_KEY = 'woodlem_cs_submissions_cache_v1';
export const CS_SESSIONS_CACHE_KEY = 'woodlem_cs_sessions_cache_v1';

// =============================================================================
// Local Storage Cache Helpers
// =============================================================================

export function getLocalCachedCsQuestions(): CsQuestion[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CS_QUESTIONS_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getLocalCachedCsSubmissions(): CsSubmission[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CS_SUBMISSIONS_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getLocalCachedCsSessions(): CsLabSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CS_SESSIONS_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// =============================================================================
// Questions Storage (Multi-Layer Cloud + Local Persistence)
// =============================================================================

export async function saveCsQuestionToCloud(
  payload: CsQuestionSavePayload & { id?: string },
  existingQuestions: CsQuestion[]
): Promise<{ ok: boolean; question: CsQuestion }> {
  const questionId =
    payload.id ||
    (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `csq_${Date.now()}`);

  const existing = existingQuestions.find((q) => q.id === questionId);
  const nowIso = new Date().toISOString();

  const row: CsQuestion = {
    ...payload,
    id: questionId,
    created_at: existing?.created_at || row_date_or_now(payload.start_time) || nowIso,
  };

  let savedCloud = false;

  // 1. Attempt native public.cs_questions table
  try {
    const { error: nativeErr } = payload.id
      ? await supabase.from('cs_questions').update(row).eq('id', questionId)
      : await supabase.from('cs_questions').insert([row]);

    if (!nativeErr) {
      savedCloud = true;
    }
  } catch (err) {
    // Native table may not be migrated yet
  }

  // 2. Always persist / sync to public.hub_activities in Supabase
  // (Ensures cross-device cloud persistence even without DDL migrations)
  try {
    const hubRow = {
      id: `csq_${questionId}`,
      title: row.title || 'CS Question',
      type: 'cs_question',
      description: JSON.stringify(row),
      date: (row.created_at || nowIso).slice(0, 10),
      created_by: row.teacher_id || 'teacher',
      created_at: row.created_at || nowIso,
    };
    const { error: hubErr } = await supabase
      .from('hub_activities')
      .upsert([hubRow], { onConflict: 'id' });

    if (!hubErr) {
      savedCloud = true;
    }
  } catch (hubEx) {
    console.warn('CS Question cloud fallback warn:', hubEx);
  }

  // 3. Update local cache for instant render
  const nextList = [row, ...existingQuestions.filter((q) => q.id !== questionId)];
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(CS_QUESTIONS_CACHE_KEY, JSON.stringify(nextList));
    } catch {}
  }

  return { ok: true, question: row };
}

export async function deleteCsQuestionFromCloud(
  questionId: string,
  existingQuestions: CsQuestion[]
): Promise<boolean> {
  // 1. Try native delete
  try {
    await supabase.from('cs_questions').delete().eq('id', questionId);
  } catch {}

  // 2. Delete from hub_activities
  try {
    await supabase.from('hub_activities').delete().eq('id', `csq_${questionId}`);
    await supabase.from('hub_activities').delete().eq('id', questionId);
  } catch {}

  // 3. Update local cache
  const nextList = existingQuestions.filter((q) => q.id !== questionId);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(CS_QUESTIONS_CACHE_KEY, JSON.stringify(nextList));
    } catch {}
  }

  return true;
}

// =============================================================================
// Submissions Storage (Multi-Layer Cloud + Local Persistence)
// =============================================================================

export async function saveCsSubmissionToCloud(
  payload: CsSubmissionSavePayload,
  existingSubmissions: CsSubmission[]
): Promise<{ ok: boolean; submission: CsSubmission }> {
  const existing = existingSubmissions.find(
    (s) => s.question_id === payload.question_id && s.student_id === payload.student_id
  );
  const isSubmit = payload.status !== 'draft';
  const nowIso = new Date().toISOString();

  const row: CsSubmission = {
    id: existing?.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `cssub_${Date.now()}`),
    question_id: payload.question_id,
    question_order: payload.question_order ?? existing?.question_order ?? 0,
    student_id: payload.student_id,
    student_name: payload.student_name || existing?.student_name || '',
    language: payload.language || existing?.language || 'python',
    code: payload.code,
    output: payload.output || '',
    error: payload.error || '',
    status: payload.status,
    code_matches_solution: payload.code_matches_solution ?? existing?.code_matches_solution ?? false,
    attempt_count: (existing?.attempt_count || 0) + (isSubmit ? 1 : 0),
    teacher_score: existing?.teacher_score,
    teacher_feedback: existing?.teacher_feedback || '',
    reviewed_by: existing?.reviewed_by || '',
    updated_at: nowIso,
  };

  // 1. Try native cs_submissions
  try {
    await supabase.from('cs_submissions').upsert([row], { onConflict: 'question_id,student_id' });
  } catch {}

  // 2. Always persist to hub_activities
  try {
    const hubRow = {
      id: `cssub_${row.question_id}_${row.student_id}`,
      title: `CS Submission: ${row.student_name || row.student_id}`,
      type: 'cs_submission',
      description: JSON.stringify(row),
      date: nowIso.slice(0, 10),
      created_by: row.student_id,
      created_at: row.updated_at,
    };
    await supabase.from('hub_activities').upsert([hubRow], { onConflict: 'id' });
  } catch (e) {
    console.warn('CS Submission cloud fallback warn:', e);
  }

  // 3. Update local cache
  const nextList = [
    ...existingSubmissions.filter(
      (s) => !(s.question_id === row.question_id && s.student_id === row.student_id)
    ),
    row,
  ];
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(CS_SUBMISSIONS_CACHE_KEY, JSON.stringify(nextList));
    } catch {}
  }

  return { ok: true, submission: row };
}

export async function overrideCsSubmissionInCloud(
  payload: CsSubmissionOverridePayload,
  reviewerName: string,
  existingSubmissions: CsSubmission[]
): Promise<boolean> {
  const existing = existingSubmissions.find(
    (s) => s.question_id === payload.question_id && s.student_id === payload.student_id
  );
  const nowIso = new Date().toISOString();

  const updatedRow: CsSubmission = {
    ...(existing || {
      question_id: payload.question_id,
      student_id: payload.student_id,
      code: '',
      status: 'passed_review',
    }),
    teacher_score: payload.teacher_score,
    teacher_feedback: payload.teacher_feedback,
    reviewed_by: reviewerName || 'Teacher',
    updated_at: nowIso,
  };

  // 1. Try native update
  try {
    await supabase
      .from('cs_submissions')
      .update({
        teacher_score: payload.teacher_score,
        teacher_feedback: payload.teacher_feedback,
        reviewed_by: reviewerName || 'Teacher',
        updated_at: nowIso,
      })
      .eq('question_id', payload.question_id)
      .eq('student_id', payload.student_id);
  } catch {}

  // 2. Persist to hub_activities
  try {
    const hubRow = {
      id: `cssub_${payload.question_id}_${payload.student_id}`,
      title: `CS Submission: ${updatedRow.student_name || payload.student_id}`,
      type: 'cs_submission',
      description: JSON.stringify(updatedRow),
      date: nowIso.slice(0, 10),
      created_by: payload.student_id,
      created_at: updatedRow.updated_at,
    };
    await supabase.from('hub_activities').upsert([hubRow], { onConflict: 'id' });
  } catch {}

  // 3. Update local cache
  const nextList = existingSubmissions.map((s) =>
    s.question_id === payload.question_id && s.student_id === payload.student_id ? updatedRow : s
  );
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(CS_SUBMISSIONS_CACHE_KEY, JSON.stringify(nextList));
    } catch {}
  }

  return true;
}

// =============================================================================
// Lab Sessions Storage (Multi-Layer Cloud + Local Persistence)
// =============================================================================

export async function saveCsLabSessionToCloud(
  payload: Partial<CsLabSession> & { student_id: string; title: string; language: 'python' | 'sql'; code: string },
  existingSessions: CsLabSession[]
): Promise<CsLabSession> {
  const sessionId =
    payload.id ||
    (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `css_${Date.now()}`);
  const nowIso = new Date().toISOString();

  const row: CsLabSession = {
    id: sessionId,
    student_id: payload.student_id,
    student_name: payload.student_name || '',
    title: payload.title,
    language: payload.language,
    code: payload.code || '',
    setup_sql: payload.setup_sql || '',
    stdin: payload.stdin || '',
    output: payload.output || '',
    error: payload.error || '',
    db_checkpoint: payload.db_checkpoint || '',
    created_at: payload.created_at || nowIso,
    updated_at: nowIso,
  };

  // 1. Try native cs_lab_sessions
  try {
    await supabase.from('cs_lab_sessions').upsert([row], { onConflict: 'id' });
  } catch {}

  // 2. Persist to hub_activities
  try {
    const hubRow = {
      id: `cssess_${sessionId}`,
      title: row.title || 'CS Lab Session',
      type: 'cs_lab_session',
      description: JSON.stringify(row),
      date: nowIso.slice(0, 10),
      created_by: row.student_id,
      created_at: row.updated_at,
    };
    await supabase.from('hub_activities').upsert([hubRow], { onConflict: 'id' });
  } catch (e) {
    console.warn('CS Lab session cloud fallback warn:', e);
  }

  // 3. Update local cache
  const exists = existingSessions.some((s) => s.id === row.id);
  const nextList = exists ? existingSessions.map((s) => (s.id === row.id ? row : s)) : [row, ...existingSessions];
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(CS_SESSIONS_CACHE_KEY, JSON.stringify(nextList));
    } catch {}
  }

  return row;
}

export async function deleteCsLabSessionFromCloud(
  sessionId: string,
  existingSessions: CsLabSession[]
): Promise<boolean> {
  // 1. Try native delete
  try {
    await supabase.from('cs_lab_sessions').delete().eq('id', sessionId);
  } catch {}

  // 2. Delete from hub_activities
  try {
    await supabase.from('hub_activities').delete().eq('id', `cssess_${sessionId}`);
    await supabase.from('hub_activities').delete().eq('id', sessionId);
  } catch {}

  // 3. Update local cache
  const nextList = existingSessions.filter((s) => s.id !== sessionId);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(CS_SESSIONS_CACHE_KEY, JSON.stringify(nextList));
    } catch {}
  }

  return true;
}

// =============================================================================
// Cloud Hydration Parser
// =============================================================================

export function parseCsDataFromHubAndCache(
  hubActivities: any[] = [],
  nativeQuestions: any[] | null = null,
  nativeSubmissions: any[] | null = null,
  nativeSessions: any[] | null = null
): {
  questions: CsQuestion[];
  submissions: CsSubmission[];
  sessions: CsLabSession[];
} {
  // 1. Hydrate Questions
  const qMap = new Map<string, CsQuestion>();

  // Local cache first
  getLocalCachedCsQuestions().forEach((q) => {
    if (q && q.id) qMap.set(q.id, q);
  });

  // Hub activities cloud storage
  (hubActivities || []).forEach((act) => {
    if (act && act.type === 'cs_question' && act.description) {
      try {
        const parsed = JSON.parse(act.description);
        if (parsed && parsed.id) {
          qMap.set(parsed.id, {
            ...parsed,
            created_at: parsed.created_at || act.created_at,
          });
        }
      } catch {}
    }
  });

  // Native table (if available) takes highest precedence
  (nativeQuestions || []).forEach((q) => {
    if (q && q.id) qMap.set(q.id, q);
  });

  const questions = Array.from(qMap.values()).sort(
    (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  );

  if (typeof window !== 'undefined' && questions.length > 0) {
    try {
      localStorage.setItem(CS_QUESTIONS_CACHE_KEY, JSON.stringify(questions));
    } catch {}
  }

  // 2. Hydrate Submissions
  const subMap = new Map<string, CsSubmission>();

  getLocalCachedCsSubmissions().forEach((s) => {
    if (s && s.question_id && s.student_id) {
      subMap.set(`${s.question_id}_${s.student_id}`, s);
    }
  });

  (hubActivities || []).forEach((act) => {
    if (act && act.type === 'cs_submission' && act.description) {
      try {
        const parsed = JSON.parse(act.description);
        if (parsed && parsed.question_id && parsed.student_id) {
          subMap.set(`${parsed.question_id}_${parsed.student_id}`, {
            ...parsed,
            updated_at: parsed.updated_at || act.created_at,
          });
        }
      } catch {}
    }
  });

  (nativeSubmissions || []).forEach((s) => {
    if (s && s.question_id && s.student_id) {
      subMap.set(`${s.question_id}_${s.student_id}`, s);
    }
  });

  const submissions = Array.from(subMap.values());
  if (typeof window !== 'undefined' && submissions.length > 0) {
    try {
      localStorage.setItem(CS_SUBMISSIONS_CACHE_KEY, JSON.stringify(submissions));
    } catch {}
  }

  // 3. Hydrate Sessions
  const sessMap = new Map<string, CsLabSession>();

  getLocalCachedCsSessions().forEach((sess) => {
    if (sess && sess.id) sessMap.set(sess.id, sess);
  });

  (hubActivities || []).forEach((act) => {
    if (act && act.type === 'cs_lab_session' && act.description) {
      try {
        const parsed = JSON.parse(act.description);
        if (parsed && parsed.id) {
          sessMap.set(parsed.id, {
            ...parsed,
            updated_at: parsed.updated_at || act.created_at,
          });
        }
      } catch {}
    }
  });

  (nativeSessions || []).forEach((sess) => {
    if (sess && sess.id) sessMap.set(sess.id, sess);
  });

  const sessions = Array.from(sessMap.values()).sort(
    (a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime()
  );

  if (typeof window !== 'undefined' && sessions.length > 0) {
    try {
      localStorage.setItem(CS_SESSIONS_CACHE_KEY, JSON.stringify(sessions));
    } catch {}
  }

  return { questions, submissions, sessions };
}

function row_date_or_now(d?: string | null): string | null {
  if (!d) return null;
  try {
    const t = new Date(d).getTime();
    return isNaN(t) ? null : new Date(d).toISOString();
  } catch {
    return null;
  }
}
