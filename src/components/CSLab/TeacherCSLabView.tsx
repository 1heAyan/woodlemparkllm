'use client';

import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import {
  Plus, ChevronLeft, FlaskConical, Database, Code2,
  ClipboardCheck, CheckCircle2, XCircle, AlertTriangle, Eye, Trash2, Pencil, Send,
} from 'lucide-react';
import { UserProfile, SubjectClass, CsQuestion, CsSubmission, CsLanguage } from '@/lib/supabaseClient';
import { CodeEditor } from './CodeEditor';
import { StatusChip, LabOutputPanel, CS_STATUS_META } from './shared';
import { LabPlayground, LabPlaygroundHandle } from './LabPlayground';
import {
  getTeacherCsClasses, getStudentsForClasses,
} from '@/lib/csLabHelper';
import { PyRunner } from '@/lib/csLab/pyRunner';
import { SqlLabSession } from '@/lib/csLab/sqlRunner';

export interface CsQuestionSavePayload {
  id?: string;
  teacher_id: string;
  teacher_name: string;
  title: string;
  description: string;
  language: CsLanguage;
  target_class_ids: string[];
  starter_code: string;
  solution_code: string;
  setup_sql: string;
  sample_input: string;
  expected_output: string;
  expected_sql_result: { columns: string[]; rows: any[][] } | null;
  start_time: string | null;
  deadline: string | null;
  is_published: boolean;
}

export interface CsSubmissionOverridePayload {
  question_id: string;
  student_id: string;
  teacher_score: number | null;
  teacher_feedback: string;
}

interface TeacherCSLabViewProps {
  currentUser: UserProfile;
  subjectClasses: SubjectClass[];
  profiles: UserProfile[];
  questions: CsQuestion[];
  submissions: CsSubmission[];
  onCreateQuestion: (payload: CsQuestionSavePayload) => Promise<boolean>;
  onUpdateQuestion: (payload: CsQuestionSavePayload & { id: string }) => Promise<boolean>;
  onDeleteQuestion: (questionId: string) => Promise<boolean>;
  onOverrideSubmission: (payload: CsSubmissionOverridePayload) => Promise<boolean>;
}

interface EditorDraft {
  id?: string;
  title: string;
  description: string;
  language: CsLanguage;
  target_class_ids: string[];
  starter_code: string;
  solution_code: string;
  setup_sql: string;
  sample_input: string;
  expected_output: string;
  expected_sql_result: { columns: string[]; rows: any[][] } | null;
  startTimeLocal: string;
  deadlineLocal: string;
  is_published: boolean;
}

const emptyDraft = (): EditorDraft => ({
  title: '',
  description: '',
  language: 'python',
  target_class_ids: [],
  starter_code: '',
  solution_code: '',
  setup_sql: '',
  sample_input: '',
  expected_output: '',
  expected_sql_result: null,
  startTimeLocal: '',
  deadlineLocal: '',
  is_published: false,
});

export const TeacherCSLabView: React.FC<TeacherCSLabViewProps> = ({
  currentUser,
  subjectClasses,
  profiles,
  questions,
  submissions,
  onCreateQuestion,
  onUpdateQuestion,
  onDeleteQuestion,
  onOverrideSubmission,
}) => {
  const myClasses = useMemo(() => getTeacherCsClasses(currentUser, subjectClasses), [currentUser, subjectClasses]);
  const myQuestions = useMemo(
    () =>
      (questions || [])
        .filter((q) => q.teacher_id === currentUser.id)
        .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))),
    [questions, currentUser.id]
  );

  const [mainTab, setMainTab] = useState<'questions' | 'submissions' | 'playground'>('questions');
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<EditorDraft>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationMsg, setValidationMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [toast, setToast] = useState('');

  const [submissionsQuestionId, setSubmissionsQuestionId] = useState<string | null>(null);
  const [review, setReview] = useState<{ q: CsQuestion; s: CsSubmission } | null>(null);
  const [overrideScore, setOverrideScore] = useState('');
  const [overrideFeedback, setOverrideFeedback] = useState('');
  const [overrideSaving, setOverrideSaving] = useState(false);

  const [pgLang, setPgLang] = useState<'python' | 'sql'>('python');
  const [pgCode, setPgCode] = useState("# Teacher playground\nprint('Hello from the CS Lab')\n");
  const [pgSqlCode, setPgSqlCode] = useState('-- Explore your practice database\nSHOW TABLES;\nDESCRIBE students;\nSELECT * FROM students WHERE grade = 12;\n');
  const [pgStdin, setPgStdin] = useState('');
  const [pgSetup, setPgSetup] = useState("CREATE TABLE students (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(50), grade INT);\nCREATE TABLE marks (id INT AUTO_INCREMENT PRIMARY KEY, student_id INT, subject VARCHAR(30), score INT);");
  const [pgOutput, setPgOutput] = useState('');
  const [pgError, setPgError] = useState('');
  const [pgRunning, setPgRunning] = useState(false);

  const pyRunnerRef = useRef<PyRunner | null>(null);
  const sqlSessionRef = useRef<SqlLabSession | null>(null);
  const runners: LabPlaygroundHandle = { pyRunnerRef, sqlSessionRef };

  useEffect(() => {
    return () => {
      pyRunnerRef.current?.dispose();
      sqlSessionRef.current?.dispose();
    };
  }, []);

  const flashToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2600);
  }, []);

  const openCreate = () => {
    setDraft({ ...emptyDraft(), target_class_ids: myClasses.length === 1 ? [myClasses[0].id] : [] });
    setValidationMsg(null);
    setEditorOpen(true);
  };

  const openEdit = (q: CsQuestion) => {
    setDraft({
      id: q.id,
      title: q.title || '',
      description: q.description || '',
      language: q.language || 'python',
      target_class_ids: q.target_class_ids || [],
      starter_code: q.starter_code || '',
      solution_code: q.solution_code || '',
      setup_sql: q.setup_sql || '',
      sample_input: q.sample_input || '',
      expected_output: q.expected_output || '',
      expected_sql_result: q.expected_sql_result || null,
      startTimeLocal: q.start_time ? toLocalInput(q.start_time) : '',
      deadlineLocal: q.deadline ? toLocalInput(q.deadline) : '',
      is_published: q.is_published !== false,
    });
    setValidationMsg(null);
    setEditorOpen(true);
  };

  const draftReady = draft.title.trim().length > 0 && draft.target_class_ids.length > 0;

  const handleValidateSolution = async () => {
    setValidating(true);
    setValidationMsg(null);
    try {
      if (draft.language === 'python') {
        if (!pyRunnerRef.current) pyRunnerRef.current = new PyRunner();
        const r = await pyRunnerRef.current.run(draft.solution_code, draft.sample_input);
        if (r.error) {
          setValidationMsg({ ok: false, text: `Solution failed: ${r.error.split('\n').slice(-3).join(' ').slice(0, 280)}` });
        } else {
          setDraft((d) => ({ ...d, expected_output: r.output, expected_sql_result: null }));
          setValidationMsg({ ok: true, text: 'Expected output captured from your solution.' });
        }
      } else {
        sqlSessionRef.current?.dispose();
        const session = new SqlLabSession(draft.setup_sql);
        await session.init();
        const r = await session.runScript(draft.solution_code);
        if (r.error) {
          setValidationMsg({ ok: false, text: `Solution SQL failed: ${r.error.slice(0, 280)}` });
        } else {
          const grid = session.getLastSelectResult(r.statements);
          setDraft((d) => ({
            ...d,
            expected_output: r.output,
            expected_sql_result: grid ? { columns: grid.columns, rows: grid.rows } : null,
          }));
          setValidationMsg({ ok: true, text: grid ? 'Expected result grid captured from your solution.' : 'Solution ran cleanly (no SELECT grid to compare).' });
        }
        session.dispose();
      }
    } catch (e: any) {
      setValidationMsg({ ok: false, text: e?.message || String(e) });
    } finally {
      setValidating(false);
    }
  };

  const toIsoOrNull = (val?: string | null): string | null => {
    if (!val || !val.trim()) return null;
    try {
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d.toISOString();
    } catch {
      return null;
    }
  };

  const buildPayload = (publish: boolean): CsQuestionSavePayload => ({
    teacher_id: currentUser.id,
    teacher_name: currentUser.name || '',
    title: draft.title.trim(),
    description: draft.description,
    language: draft.language,
    target_class_ids: draft.target_class_ids,
    starter_code: draft.starter_code,
    solution_code: draft.solution_code,
    setup_sql: draft.setup_sql,
    sample_input: draft.sample_input,
    expected_output: draft.expected_output,
    expected_sql_result: draft.expected_sql_result,
    start_time: toIsoOrNull(draft.startTimeLocal),
    deadline: toIsoOrNull(draft.deadlineLocal),
    is_published: publish,
  });

  const handleSaveDraft = async (publish: boolean) => {
    if (!draftReady) {
      setValidationMsg({ ok: false, text: 'A title and at least one target class are required.' });
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload(publish);
      const ok = draft.id ? await onUpdateQuestion({ ...payload, id: draft.id }) : await onCreateQuestion(payload);
      if (ok) {
        flashToast(publish ? 'Question published' : 'Draft saved');
        setEditorOpen(false);
      } else {
        setValidationMsg({ ok: false, text: 'Could not save. Check your connection and try again.' });
      }
    } catch (err: any) {
      console.error('Save question exception:', err);
      setValidationMsg({ ok: false, text: err?.message || 'Could not save. Check your connection and try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (q: CsQuestion) => {
    if (!window.confirm(`Delete "${q.title}"? Existing student submissions will remain in records.`)) return;
    const ok = await onDeleteQuestion(q.id);
    flashToast(ok ? 'Question deleted' : 'Delete failed');
  };

  const studentsForQuestion = useCallback(
    (q: CsQuestion) => getStudentsForClasses(profiles, q.target_class_ids || [], subjectClasses),
    [profiles, subjectClasses]
  );

  const openReview = (q: CsQuestion, s: CsSubmission) => {
    setReview({ q, s });
    setOverrideScore(s.teacher_score != null ? String(s.teacher_score) : '');
    setOverrideFeedback(s.teacher_feedback || '');
  };

  const handleOverrideSave = async () => {
    if (!review) return;
    setOverrideSaving(true);
    try {
      const ok = await onOverrideSubmission({
        question_id: review.q.id,
        student_id: review.s.student_id,
        teacher_score: overrideScore.trim() === '' ? null : Number(overrideScore),
        teacher_feedback: overrideFeedback,
      });
      flashToast(ok ? 'Review saved' : 'Save failed');
      if (ok) setReview(null);
    } finally {
      setOverrideSaving(false);
    }
  };

  const submissionsQuestion = myQuestions.find((q) => q.id === submissionsQuestionId) || null;

  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 3000, padding: '10px 16px', borderRadius: 8, background: '#1A1A1A', color: '#fff', fontSize: 12.5, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}>
          {toast}
        </div>
      )}

      <header className="content-header">
        <div className="header-top">
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#7C5CBF', letterSpacing: '0.06em' }}>
              CS LAB · {myClasses.map((c) => c.name).join(', ') || 'No CS classes assigned'}
            </div>
            <h1 className="page-title" style={{ margin: '2px 0 0' }}>Computer Science Lab</h1>
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
              Assign coding questions, review submissions, and demo Python &amp; SQL live.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => setMainTab('playground')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: mainTab === 'playground' ? '#1A1A1A' : '#FFFFFF', color: mainTab === 'playground' ? '#fff' : 'var(--neutral-dark)', border: '1px solid var(--border-color)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
              <FlaskConical size={14} /> Playground
            </button>
            <button type="button" onClick={openCreate} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: '#7C5CBF', color: '#fff', border: 'none', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
              <Plus size={14} /> New Question
            </button>
          </div>
        </div>
        <div className="tabs">
          <button type="button" className={`tab-btn ${mainTab === 'questions' ? 'active' : ''}`} onClick={() => setMainTab('questions')}>
            My Questions <span className="tab-count">{myQuestions.length}</span>
          </button>
          <button type="button" className={`tab-btn ${mainTab === 'submissions' ? 'active' : ''}`} onClick={() => setMainTab('submissions')}>
            <ClipboardCheck size={13} style={{ verticalAlign: -2 }} /> Submissions &amp; Progress
          </button>
        </div>
      </header>

      <div className="content-body" style={{ padding: '24px 32px' }}>
        {mainTab === 'playground' && (
          <LabPlayground
            language={pgLang}
            code={pgLang === 'python' ? pgCode : pgSqlCode}
            onCodeChange={(v) => (pgLang === 'python' ? setPgCode(v) : setPgSqlCode(v))}
            stdin={pgStdin}
            onStdinChange={setPgStdin}
            sqlSetup={pgSetup}
            onSqlSetupChange={setPgSetup}
            output={pgOutput}
            error={pgError}
            running={pgRunning}
            onOutputChange={setPgOutput}
            onErrorChange={setPgError}
            onRunningChange={setPgRunning}
            onLanguageChange={(l) => setPgLang(l)}
            runners={runners}
          />
        )}

        {mainTab === 'questions' && (
          myQuestions.length === 0 ? (
            <div style={{ padding: '60px 24px', textAlign: 'center', background: '#FFFFFF', borderRadius: 8, border: '1px solid var(--border-color)' }}>
              <FlaskConical size={28} color="#8C8983" style={{ marginBottom: 10 }} />
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px' }}>No questions yet</h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 auto 18px', maxWidth: 460 }}>
                Create your first coding question — write the problem, your reference solution, and assign it to your CS classes. The lab auto-grades student submissions against your solution.
              </p>
              <button onClick={openCreate} style={{ padding: '9px 18px', borderRadius: 8, background: '#7C5CBF', color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <Plus size={15} /> Create a Question
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
              {myQuestions.map((q) => {
                const subs = submissions.filter((s) => s.question_id === q.id);
                const students = studentsForQuestion(q);
                const done = subs.filter((s) => s.status === 'passed' || s.status === 'passed_review').length;
                const flagged = subs.filter((s) => s.status === 'passed_review').length;
                return (
                  <div key={q.id} style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 10, padding: '16px 18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 5, background: q.language === 'sql' ? '#E5F4F7' : '#EAF2FB', color: q.language === 'sql' ? '#00758F' : '#3776AB', border: `1px solid ${q.language === 'sql' ? '#BEE3EC' : '#C9DDEF'}`, textTransform: 'uppercase' }}>
                        {q.language === 'sql' ? <Database size={11} /> : <Code2 size={11} />} {q.language === 'sql' ? 'SQL' : 'Python'}
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 5, background: q.is_published !== false ? '#EAF7EF' : '#F3F2EF', color: q.is_published !== false ? '#166534' : '#55534E', border: `1px solid ${q.is_published !== false ? '#BBE7C9' : '#E5E3DF'}`, textTransform: 'uppercase' }}>
                        {q.is_published !== false ? 'Published' : 'Draft'}
                      </span>
                    </div>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--neutral-dark)', marginBottom: 4 }}>{q.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: 12, lineHeight: 1.45 }}>
                      {(q.description || '').replace(/[#*`]/g, '').slice(0, 150) || 'No description.'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#F0EEE9', overflow: 'hidden' }}>
                        <div style={{ width: `${students.length ? Math.round((done / students.length) * 100) : 0}%`, height: '100%', background: '#7C5CBF', borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#6D28D9' }}>{done}/{students.length}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {flagged > 0 && (
                        <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#FEF6E7', color: '#92400E', border: '1px solid #FDE68A' }}>
                          {flagged} to review
                        </span>
                      )}
                      <button type="button" onClick={() => { setMainTab('submissions'); setSubmissionsQuestionId(q.id); }} style={{ marginLeft: 'auto', padding: '6px 12px', borderRadius: 7, background: '#F3EFFA', border: '1px solid #DACDF2', color: '#6D28D9', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <Eye size={12} /> Progress
                      </button>
                      <button type="button" onClick={() => openEdit(q)} style={{ padding: '6px 10px', borderRadius: 7, background: '#FFFFFF', border: '1px solid var(--border-color)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Pencil size={12} />
                      </button>
                      <button type="button" onClick={() => handleDelete(q)} style={{ padding: '6px 10px', borderRadius: 7, background: '#FDF1F0', border: '1px solid #FECACA', color: '#B91C1C', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {mainTab === 'submissions' && (
          <div>
            {/* Question picker */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              <select
                value={submissionsQuestionId || ''}
                onChange={(e) => setSubmissionsQuestionId(e.target.value || null)}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 12.5, fontWeight: 600, background: '#fff', minWidth: 260 }}
              >
                <option value="">Select a question…</option>
                {myQuestions.map((q) => (
                  <option key={q.id} value={q.id}>{q.title} ({q.language === 'sql' ? 'SQL' : 'Python'})</option>
                ))}
              </select>
              {submissionsQuestion && (
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {submissionsQuestion.is_published === false ? 'DRAFT · ' : ''}
                  {(submissionsQuestion.target_class_ids || []).map((cid) => myClasses.find((c) => c.id === cid)?.name || 'Class').join(', ')}
                </span>
              )}
            </div>

            {!submissionsQuestion ? (
              <div style={{ padding: '48px 24px', textAlign: 'center', background: '#FFFFFF', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 13, color: 'var(--text-secondary)' }}>
                Pick a question above to see the class progress grid and review submissions.
              </div>
            ) : (
              (() => {
                const q = submissionsQuestion;
                const students = studentsForQuestion(q);
                const byStudent = mapSubmissionsByStudentLocal(submissions, q.id);
                const done = students.filter((st) => ['passed', 'passed_review'].includes(byStudent[st.id]?.status)).length;
                const flagged = students.filter((st) => byStudent[st.id]?.status === 'passed_review').length;
                return (
                  <div>
                    {/* Summary strip */}
                    <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                      <div style={{ padding: '10px 16px', borderRadius: 8, background: '#F3EFFA', border: '1px solid #DACDF2' }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#6D28D9' }}>{done}/{students.length}</div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#7C5CBF', textTransform: 'uppercase' }}>Completed</div>
                      </div>
                      <div style={{ padding: '10px 16px', borderRadius: 8, background: '#FEF6E7', border: '1px solid #FDE68A' }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#92400E' }}>{flagged}</div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#92400E', textTransform: 'uppercase' }}>Need Review</div>
                      </div>
                      <div style={{ padding: '10px 16px', borderRadius: 8, background: '#FDF1F0', border: '1px solid #FECACA' }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#B91C1C' }}>{students.filter((st) => byStudent[st.id]?.status === 'failed').length}</div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#B91C1C', textTransform: 'uppercase' }}>Wrong</div>
                      </div>
                      <div style={{ padding: '10px 16px', borderRadius: 8, background: '#F8F7F4', border: '1px solid #ECEAE5' }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#55534E' }}>{students.length - done}</div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#55534E', textTransform: 'uppercase' }}>Remaining</div>
                      </div>
                    </div>

                    {/* Roster grid */}
                    <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 10, overflow: 'hidden' }}>
                      {students.length === 0 ? (
                        <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                          No students are enrolled in the classes this question targets.
                        </div>
                      ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                          <thead>
                            <tr style={{ background: '#F8F7F4', borderBottom: '1px solid var(--border-color)', fontSize: 10.5, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                              <th style={{ textAlign: 'left', padding: '10px 16px' }}>Student</th>
                              <th style={{ textAlign: 'left', padding: '10px 16px', width: 130 }}>Admission No.</th>
                              <th style={{ textAlign: 'center', padding: '10px 16px', width: 150 }}>Status</th>
                              <th style={{ textAlign: 'center', padding: '10px 16px', width: 80 }}>Attempts</th>
                              <th style={{ textAlign: 'center', padding: '10px 16px', width: 90 }}>Score</th>
                              <th style={{ textAlign: 'right', padding: '10px 16px', width: 110 }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {students.map((st, idx) => {
                              const sub = byStudent[st.id];
                              return (
                                <tr key={st.id} style={{ borderBottom: '1px solid #ECEAE5', background: idx % 2 ? '#FAF9F7' : '#FFFFFF' }}>
                                  <td style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--neutral-dark)' }}>{st.name}</td>
                                  <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 11.5, color: 'var(--text-secondary)' }}>{st.admission_number || st.user_code || '—'}</td>
                                  <td style={{ padding: '10px 16px', textAlign: 'center' }}><StatusChip status={sub?.status} small /></td>
                                  <td style={{ padding: '10px 16px', textAlign: 'center', color: 'var(--text-secondary)' }}>{sub?.attempt_count || 0}</td>
                                  <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 700, color: sub?.teacher_score != null ? '#6D28D9' : 'var(--text-secondary)' }}>{sub?.teacher_score != null ? sub.teacher_score : '—'}</td>
                                  <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                                    <button
                                      type="button"
                                      onClick={() => sub && openReview(q, sub)}
                                      disabled={!sub}
                                      style={{ padding: '5px 12px', borderRadius: 6, background: sub ? '#1A1A1A' : '#F0EEE9', color: sub ? '#fff' : '#B0ADA7', border: 'none', fontSize: 11.5, fontWeight: 700, cursor: sub ? 'pointer' : 'not-allowed' }}
                                    >
                                      Review Code
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        )}
      </div>

      {/* Submission review modal */}
      {review && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,20,18,0.55)', zIndex: 2500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => setReview(null)}>
          <div style={{ background: '#FAF9F6', borderRadius: 14, width: 'min(860px, 100%)', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FFFFFF', position: 'sticky', top: 0, zIndex: 2 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#7C5CBF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Submission Review</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--neutral-dark)' }}>{review.s.student_name || 'Student'} · {review.q.title}</div>
              </div>
              <StatusChip status={review.s.status} />
            </div>
            <div style={{ padding: '20px 22px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#55534E', textTransform: 'uppercase', marginBottom: 6 }}>Student Code</div>
                  <pre style={{ margin: 0, background: '#1E1E1C', color: '#D4D4D4', padding: 14, borderRadius: 8, fontSize: 12, fontFamily: 'ui-monospace, Menlo, Consolas, monospace', overflow: 'auto', maxHeight: 300, whiteSpace: 'pre-wrap' }}>{review.s.code || '(empty)'}</pre>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#55534E', textTransform: 'uppercase', marginBottom: 6 }}>Captured Output</div>
                  <pre style={{ margin: 0, background: '#141414', color: '#D4D4D4', padding: 14, borderRadius: 8, fontSize: 12, fontFamily: 'ui-monospace, Menlo, Consolas, monospace', overflow: 'auto', maxHeight: 300, whiteSpace: 'pre-wrap' }}>{review.s.output || '(none)'}{review.s.error ? `\n[ERROR]\n${review.s.error}` : ''}</pre>
                </div>
              </div>
              {(review.s.teacher_feedback || review.s.teacher_score != null) && (
                <div style={{ padding: '10px 14px', borderRadius: 8, background: '#F3EFFA', border: '1px solid #DACDF2', fontSize: 12.5, color: '#4C1D95', marginBottom: 14 }}>
                  Previous review — Score: <strong>{review.s.teacher_score != null ? review.s.teacher_score : '—'}</strong> · {review.s.teacher_feedback || 'No feedback text.'}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 10, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#55534E', textTransform: 'uppercase', marginBottom: 5 }}>Override Score</div>
                  <input value={overrideScore} onChange={(e) => setOverrideScore(e.target.value)} type="number" placeholder="e.g. 10" style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 7, border: '1px solid var(--border-color)', fontSize: 13 }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#55534E', textTransform: 'uppercase', marginBottom: 5 }}>Feedback</div>
                  <input value={overrideFeedback} onChange={(e) => setOverrideFeedback(e.target.value)} placeholder="Optional comment for the student" style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 7, border: '1px solid var(--border-color)', fontSize: 13 }} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" onClick={() => setReview(null)} style={{ padding: '8px 16px', borderRadius: 7, background: '#FFFFFF', border: '1px solid var(--border-color)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Close</button>
                <button type="button" onClick={handleOverrideSave} disabled={overrideSaving} style={{ padding: '8px 18px', borderRadius: 7, background: '#7C5CBF', color: '#fff', border: 'none', fontSize: 12.5, fontWeight: 700, cursor: overrideSaving ? 'wait' : 'pointer' }}>{overrideSaving ? 'Saving…' : 'Save Review'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Question editor modal */}
      {editorOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,20,18,0.55)', zIndex: 2500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => !saving && setEditorOpen(false)}>
          <div style={{ background: '#FAF9F6', borderRadius: 14, width: 'min(980px, 100%)', maxHeight: '92vh', overflow: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FFFFFF', position: 'sticky', top: 0, zIndex: 2 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#7C5CBF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>CS Lab</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--neutral-dark)' }}>{draft.id ? 'Edit Question' : 'New Coding Question'}</div>
              </div>
              <button type="button" onClick={() => setEditorOpen(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#8C8983', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: '20px 22px' }}>
              {/* Basics */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px 200px', gap: 10, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#55534E', textTransform: 'uppercase', marginBottom: 5 }}>Question Title *</div>
                  <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Print the Fibonacci series" style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 7, border: '1px solid var(--border-color)', fontSize: 13 }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#55534E', textTransform: 'uppercase', marginBottom: 5 }}>Language</div>
                  <select value={draft.language} onChange={(e) => setDraft({ ...draft, language: e.target.value as CsLanguage })} style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1px solid var(--border-color)', fontSize: 13, background: '#fff' }}>
                    <option value="python">Python</option>
                    <option value="sql">SQL (MySQL)</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#55534E', textTransform: 'uppercase', marginBottom: 5 }}>Publish</div>
                  <select value={draft.is_published ? 'yes' : 'no'} onChange={(e) => setDraft({ ...draft, is_published: e.target.value === 'yes' })} style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1px solid var(--border-color)', fontSize: 13, background: '#fff' }}>
                    <option value="no">Draft (hidden)</option>
                    <option value="yes">Published</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#55534E', textTransform: 'uppercase', marginBottom: 5 }}>Description / Problem Statement</div>
                <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Explain the task, constraints, expected input/output format…" style={{ width: '100%', minHeight: 90, boxSizing: 'border-box', padding: '10px 12px', borderRadius: 7, border: '1px solid var(--border-color)', fontSize: 13, resize: 'vertical' }} />
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#55534E', textTransform: 'uppercase', marginBottom: 6 }}>Assign To Classes *</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {myClasses.length === 0 && (
                    <span style={{ fontSize: 12.5, color: '#B91C1C' }}>You have no CS subject classes yet. Create one from the Classes section first.</span>
                  )}
                  {myClasses.map((c) => {
                    const on = draft.target_class_ids.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setDraft((d) => ({ ...d, target_class_ids: on ? d.target_class_ids.filter((x) => x !== c.id) : [...d.target_class_ids, c.id] }))}
                        style={{ padding: '6px 14px', borderRadius: 999, border: `1px solid ${on ? '#7C5CBF' : 'var(--border-color)'}`, background: on ? '#F3EFFA' : '#fff', color: on ? '#6D28D9' : '#55534E', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                      >
                        {on ? '✓ ' : ''}{c.name}
                      </button>
                    );
                  })}
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '6px 0 0' }}>
                  Selected students see this question only if they are enrolled in at least one chosen class.
                </p>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#55534E', textTransform: 'uppercase', marginBottom: 6 }}>Availability Window (optional)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#8C8983', marginBottom: 4 }}>Available From</div>
                    <input
                      type="datetime-local"
                      value={draft.startTimeLocal}
                      onChange={(e) => setDraft({ ...draft, startTimeLocal: e.target.value })}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 7, border: '1px solid var(--border-color)', fontSize: 12.5, background: '#fff' }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#8C8983', marginBottom: 4 }}>Available Until (deadline)</div>
                    <input
                      type="datetime-local"
                      value={draft.deadlineLocal}
                      onChange={(e) => setDraft({ ...draft, deadlineLocal: e.target.value })}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 7, border: '1px solid var(--border-color)', fontSize: 12.5, background: '#fff' }}
                    />
                  </div>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '6px 0 0' }}>
                  Leave empty for always available. Students see "Opens soon" before the start time and cannot submit after the deadline.
                </p>
              </div>

              {draft.language === 'sql' && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#55534E', textTransform: 'uppercase', marginBottom: 5 }}>Database Setup (runs before every attempt)</div>
                  <textarea value={draft.setup_sql} onChange={(e) => setDraft({ ...draft, setup_sql: e.target.value })} spellCheck={false} placeholder="CREATE TABLE … ; INSERT INTO … ;" style={{ width: '100%', minHeight: 90, boxSizing: 'border-box', padding: '10px 12px', borderRadius: 7, border: '1px solid var(--border-color)', fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 12.5, resize: 'vertical' }} />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#55534E', textTransform: 'uppercase', marginBottom: 5 }}>Starter Code (optional)</div>
                  <CodeEditor value={draft.starter_code} onChange={(v) => setDraft({ ...draft, starter_code: v })} language={draft.language} height="170px" />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#55534E', textTransform: 'uppercase', marginBottom: 5 }}>Your Solution (used for grading) *</div>
                  <CodeEditor value={draft.solution_code} onChange={(v) => setDraft({ ...draft, solution_code: v })} language={draft.language} height="170px" />
                </div>
              </div>

              {draft.language === 'python' && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#55534E', textTransform: 'uppercase', marginBottom: 5 }}>Sample Input / stdin (optional)</div>
                  <textarea value={draft.sample_input} onChange={(e) => setDraft({ ...draft, sample_input: e.target.value })} placeholder="Lines fed to input() when the student runs or submits" style={{ width: '100%', minHeight: 56, boxSizing: 'border-box', padding: '10px 12px', borderRadius: 7, border: '1px solid var(--border-color)', fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 12.5, resize: 'vertical' }} />
                </div>
              )}

              {/* Validation banner */}
              {validationMsg && (
                <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 12.5, fontWeight: 600, background: validationMsg.ok ? '#EAF7EF' : '#FDF1F0', border: `1px solid ${validationMsg.ok ? '#BBE7C9' : '#FECACA'}`, color: validationMsg.ok ? '#166534' : '#B91C1C' }}>
                  {validationMsg.text}
                </div>
              )}
              {draft.expected_output && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#166534', textTransform: 'uppercase', marginBottom: 5 }}>Captured Expected Output</div>
                  <pre style={{ margin: 0, background: '#141414', color: '#A7F3D0', padding: 12, borderRadius: 8, fontSize: 12, fontFamily: 'ui-monospace, Menlo, Consolas, monospace', maxHeight: 140, overflow: 'auto', whiteSpace: 'pre-wrap' }}>{draft.expected_output}</pre>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <button type="button" onClick={handleValidateSolution} disabled={validating || !draft.solution_code.trim()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 7, background: '#FFFFFF', border: '1px solid #7C5CBF', color: '#6D28D9', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', opacity: validating || !draft.solution_code.trim() ? 0.6 : 1 }}>
                  {validating ? 'Running…' : '▶ Validate & Capture Expected Output'}
                </button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => handleSaveDraft(false)} disabled={saving} style={{ padding: '8px 16px', borderRadius: 7, background: '#FFFFFF', border: '1px solid var(--border-color)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>{saving ? 'Saving…' : 'Save Draft'}</button>
                  <button type="button" onClick={() => handleSaveDraft(true)} disabled={saving || !draftReady} style={{ padding: '8px 18px', borderRadius: 7, background: draftReady ? '#166534' : '#B0ADA7', color: '#fff', border: 'none', fontSize: 12.5, fontWeight: 700, cursor: draftReady ? 'pointer' : 'not-allowed' }}>Publish to Classes</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function mapSubmissionsByStudentLocal(submissions: CsSubmission[], questionId: string): Record<string, CsSubmission> {
  const map: Record<string, CsSubmission> = {};
  (submissions || []).forEach((s) => {
    if (s.question_id === questionId) map[s.student_id] = s;
  });
  return map;
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
