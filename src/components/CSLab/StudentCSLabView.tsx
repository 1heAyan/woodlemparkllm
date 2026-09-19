'use client';

import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import {
  Play, Send, ChevronLeft, Clock, FlaskConical, Code2, Database,
  ArrowRight, CheckCircle2, XCircle, AlertTriangle, Save, Terminal, X,
} from 'lucide-react';
import { UserProfile, SubjectClass, CsQuestion, CsSubmission, CsLabSession, CsSubmissionStatus } from '@/lib/supabaseClient';
import { CodeEditor } from './CodeEditor';
import { StatusChip, LabOutputPanel } from './shared';
import { LabPlayground, LabPlaygroundHandle } from './LabPlayground';
import { getStudentCsClasses, getQuestionsForClasses, getCsQuestionTimeStatus } from '@/lib/csLabHelper';
import { PyRunner } from '@/lib/csLab/pyRunner';
import { SqlLabSession, SqlStatementResult } from '@/lib/csLab/sqlRunner';
import { gradeCsAttempt, SqlGrid } from '@/lib/csLab/grading';

export interface CsSubmissionSavePayload {
  question_id: string;
  question_order?: number;
  student_id: string;
  student_name: string;
  language: CsQuestion['language'];
  code: string;
  output: string;
  error: string;
  status: CsSubmissionStatus;
  code_matches_solution: boolean;
}

interface StudentCSLabViewProps {
  currentUser: UserProfile;
  subjectClasses: SubjectClass[];
  questions: CsQuestion[];
  submissions: CsSubmission[];
  sessions: CsLabSession[];
  onSaveSession: (payload: Partial<CsLabSession> & { student_id: string; title: string; language: 'python' | 'sql'; code: string }) => Promise<CsLabSession | null>;
  onDeleteSession: (sessionId: string) => Promise<boolean>;
  onSaveSubmission: (payload: CsSubmissionSavePayload) => Promise<boolean>;
}

const PY_PLAYGROUND_DEFAULT =
  '# Welcome to the CS Lab Playground\n# Write Python and press Run.\n\ndef greet(name):\n    return f"Hello, {name}! Welcome to the CS Lab."\n\nprint(greet("Explorer"))\n\n# Try input() with the Custom Input box:\n# name = input()\n# print(f"Hi {name}")\n';

const SQL_PLAYGROUND_SETUP_DEFAULT =
  "-- Your practice database schema (edit freely, then click Reset DB)\n\nCREATE TABLE students (\n  id INT AUTO_INCREMENT PRIMARY KEY,\n  name VARCHAR(50),\n  grade INT\n);\n\nCREATE TABLE marks (\n  id INT AUTO_INCREMENT PRIMARY KEY,\n  student_id INT,\n  subject VARCHAR(30),\n  score INT\n);\n";

const SQL_PLAYGROUND_QUERY_DEFAULT =
  "-- Write MySQL queries here and press Run.\nINSERT INTO students (name, grade) VALUES ('Amit', 12), ('Priya', 11), ('Zoya', 12);\n\nSELECT * FROM students;\n\n-- Try more:\n-- SHOW TABLES;\n-- DESCRIBE students;";

const LANG_META = {
  python: { label: 'Python', color: '#3776AB', bg: '#EAF2FB', border: '#C9DDEF' },
  sql: { label: 'SQL (MySQL)', color: '#00758F', bg: '#E5F4F7', border: '#BEE3EC' },
} as const;

export const StudentCSLabView: React.FC<StudentCSLabViewProps> = ({
  currentUser,
  subjectClasses,
  questions,
  submissions,
  sessions,
  onSaveSession,
  onDeleteSession,
  onSaveSubmission,
}) => {
  // ── Derived data ────────────────────────────────────────────────────────
  const myCsClasses = useMemo(
    () => getStudentCsClasses(currentUser, subjectClasses),
    [currentUser, subjectClasses]
  );

  const assignedQuestions = useMemo(
    () =>
      getQuestionsForClasses(questions, myCsClasses.map((c) => c.id)).sort(
        (a, b) => String(a.created_at || '').localeCompare(String(b.created_at || ''))
      ),
    [questions, myCsClasses]
  );

  const submissionsByQuestion = useMemo(() => {
    const map: Record<string, CsSubmission> = {};
    (submissions || []).forEach((s) => {
      if (s.student_id === currentUser.id) map[s.question_id] = s;
    });
    return map;
  }, [submissions, currentUser.id]);

  const stats = useMemo(() => {
    const done = assignedQuestions.filter((q) => {
      const st = submissionsByQuestion[q.id]?.status;
      return st === 'passed' || st === 'passed_review';
    }).length;
    return { total: assignedQuestions.length, done, remaining: assignedQuestions.length - done };
  }, [assignedQuestions, submissionsByQuestion]);

  // ── State ────────────────────────────────────────────────────────────────
  // Top-level lab area: 'assignments' (teacher questions) | 'playground' (own named sessions)
  const [area, setArea] = useState<'assignments' | 'playground'>('assignments');
  const [view, setView] = useState<'questions' | 'workspace'>('questions');
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);

  // Workspace state
  const [code, setCode] = useState('');
  const [runOutput, setRunOutput] = useState('');
  const [runError, setRunError] = useState('');
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [inputDirty, setInputDirty] = useState(false);
  const [lastGrade, setLastGrade] = useState<{ verdict: string; detail: string } | null>(null);
  const [toast, setToast] = useState('');
  const [now, setNow] = useState(Date.now());

  // Playground / saved sessions state
  const [pgLang, setPgLang] = useState<'python' | 'sql'>('python');
  const [pgCode, setPgCode] = useState(PY_PLAYGROUND_DEFAULT);
  const [pgSqlCode, setPgSqlCode] = useState(SQL_PLAYGROUND_QUERY_DEFAULT);
  const [pgStdin, setPgStdin] = useState('');
  const [pgSetup, setPgSetup] = useState(SQL_PLAYGROUND_SETUP_DEFAULT);
  const [pgOutput, setPgOutput] = useState('');
  const [pgError, setPgError] = useState('');
  const [pgRunning, setPgRunning] = useState(false);
  const [pgCheckpoint, setPgCheckpoint] = useState('');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionName, setSessionName] = useState('');
  const [isNamePromptOpen, setIsNamePromptOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [nameMode, setNameMode] = useState<'new' | 'rename'>('new');
  const [savingSession, setSavingSession] = useState(false);
  const [sessionsDirty, setSessionsDirty] = useState(false);

  // Runners (shared between workspace + playground)
  const pyRunnerRef = useRef<PyRunner | null>(null);
  const sqlSessionRef = useRef<SqlLabSession | null>(null);
  const runners: LabPlaygroundHandle = { pyRunnerRef, sqlSessionRef };
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

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

  const activeQuestion = useMemo(
    () => assignedQuestions.find((q) => q.id === activeQuestionId) || null,
    [assignedQuestions, activeQuestionId]
  );
  const activeSubmission = activeQuestion ? submissionsByQuestion[activeQuestion.id] : undefined;
  const timeStatus = activeQuestion ? getCsQuestionTimeStatus(activeQuestion, now) : null;
  const isLocked = timeStatus?.status === 'past_deadline';

  // Load code when entering a question
  useEffect(() => {
    if (!activeQuestion) return;
    setCode(activeSubmission?.code || activeQuestion.starter_code || '');
    setRunOutput('');
    setRunError('');
    setLastGrade(null);
    setCustomInput(activeQuestion.sample_input || '');
    setInputDirty(false);
  }, [activeQuestionId]);

  // ── Persistence ─────────────────────────────────────────────────────────
  const persistSubmission = useCallback(
    async (patch: { status: CsSubmissionStatus; output: string; error: string; codeMatches: boolean }) => {
      if (!activeQuestion) return false;
      return onSaveSubmission({
        question_id: activeQuestion.id,
        question_order: assignedQuestions.findIndex((q) => q.id === activeQuestion.id) + 1,
        student_id: currentUser.id,
        student_name: currentUser.name || '',
        language: activeQuestion.language,
        code,
        output: patch.output,
        error: patch.error,
        status: patch.status,
        code_matches_solution: patch.codeMatches,
      });
    },
    [activeQuestion, assignedQuestions, currentUser, code, onSaveSubmission]
  );

  // Debounced autosave while coding
  useEffect(() => {
    if (view !== 'workspace' || !activeQuestion) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      persistSubmission({ status: 'draft', output: '', error: '', codeMatches: false });
    }, 2500);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [code, view, activeQuestionId]);

  // ── Execution ───────────────────────────────────────────────────────────
  const ensureSqlSession = useCallback(async (setup: string): Promise<SqlLabSession> => {
    const key = `q:${activeQuestionId}:${setup}`;
    if (!sqlSessionRef.current || (sqlSessionRef.current as any)._key !== key) {
      sqlSessionRef.current?.dispose();
      const session = new SqlLabSession(setup);
      await session.init();
      (session as any)._key = key;
      sqlSessionRef.current = session;
    }
    return sqlSessionRef.current;
  }, [activeQuestionId]);

  const runOnce = useCallback(
    async (lang: 'python' | 'sql', src: string, stdin: string, setupSql: string): Promise<{ out: string; err: string; grid: SqlGrid | null }> => {
      if (lang === 'python') {
        if (!pyRunnerRef.current) pyRunnerRef.current = new PyRunner();
        const r = await pyRunnerRef.current.run(src, stdin);
        return { out: r.output, err: r.error, grid: null };
      }
      const session = await ensureSqlSession(setupSql);
      const r = await session.runScript(src);
      const grid = r.error ? null : session.getLastSelectResult(r.statements);
      return { out: r.output, err: r.error, grid };
    },
    [ensureSqlSession]
  );

  const handleRun = async () => {
    if (!activeQuestion || running || submitting) return;
    setRunning(true);
    setRunOutput('');
    setRunError('');
    setLastGrade(null);
    try {
      const stdin = activeQuestion.language === 'python' ? (inputDirty ? customInput : activeQuestion.sample_input || '') : '';
      const r = await runOnce(activeQuestion.language, code, stdin, activeQuestion.setup_sql || '');
      setRunOutput(r.out);
      setRunError(r.err);
    } catch (e: any) {
      setRunError(e?.message || String(e));
    } finally {
      setRunning(false);
    }
  };

  const handleSubmit = async () => {
    if (!activeQuestion || submitting || running) return;
    setSubmitting(true);
    setRunOutput('');
    setRunError('');
    setLastGrade(null);
    try {
      const stdin = activeQuestion.language === 'python' ? (inputDirty ? customInput : activeQuestion.sample_input || '') : '';
      const r = await runOnce(activeQuestion.language, code, stdin, activeQuestion.setup_sql || '');
      setRunOutput(r.out);
      setRunError(r.err);

      let verdict: CsSubmissionStatus;
      let detail: string;
      let codeMatches = false;

      if (r.err) {
        verdict = 'failed';
        detail = 'Your code produced an error — fix it and submit again.';
      } else {
        const grade = gradeCsAttempt(activeQuestion, r.out, code, r.grid);
        verdict = grade.verdict;
        detail = grade.detail;
        codeMatches = grade.codeMatches;
      }

      const ok = await persistSubmission({
        status: verdict,
        output: r.out,
        error: r.err,
        codeMatches,
      });
      setLastGrade({ verdict, detail });
      flashToast(ok ? 'Submission saved' : 'Saved — will retry sync');
    } catch (e: any) {
      setRunError(e?.message || String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const goNextQuestion = () => {
    if (!activeQuestion) return;
    const idx = assignedQuestions.findIndex((q) => q.id === activeQuestion.id);
    for (let i = idx + 1; i < assignedQuestions.length; i++) {
      const st = submissionsByQuestion[assignedQuestions[i].id]?.status;
      if (st !== 'passed' && st !== 'passed_review') {
        setActiveQuestionId(assignedQuestions[i].id);
        return;
      }
    }
    setArea('assignments'); setView('questions');
    flashToast('All questions attempted — great work!');
  };

  // ── Render: question list (only inside the Assignments area) ────────────
  if (area === 'assignments' && view === 'questions') {
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
                CS LAB · {myCsClasses.map((c) => c.name).join(', ') || 'No CS class'}
              </div>
              <h1 className="page-title" style={{ margin: '2px 0 0' }}>Coding Questions</h1>
              <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                Solve assigned programming and database questions right in the browser.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ textAlign: 'right', padding: '8px 14px', borderRadius: 8, background: '#F3EFFA', border: '1px solid #DACDF2' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#6D28D9' }}>{stats.done}/{stats.total}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#7C5CBF', textTransform: 'uppercase' }}>Completed</div>
              </div>
              <button
                type="button"
                onClick={() => setArea('playground')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: '#1A1A1A', color: '#fff', border: 'none', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
              >
                <FlaskConical size={14} /> Open Playground
              </button>
            </div>
          </div>
        </header>
        <div className="content-body" style={{ padding: '24px 32px' }}>
          {assignedQuestions.length === 0 ? (
            <div style={{ padding: '60px 24px', textAlign: 'center', background: '#FFFFFF', borderRadius: 8, border: '1px solid var(--border-color)' }}>
              <FlaskConical size={28} color="#8C8983" style={{ marginBottom: 10 }} />
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px' }}>No questions assigned yet</h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 18px' }}>
                When your Computer Science teacher assigns coding questions, they will appear here.
              </p>
              <button onClick={() => setArea('playground')} style={{ padding: '9px 18px', borderRadius: 8, background: '#7C5CBF', color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <Terminal size={15} /> Explore the Lab Playground
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
              {assignedQuestions.map((q, idx) => {
                const sub = submissionsByQuestion[q.id];
                const ts = getCsQuestionTimeStatus(q, now);
                const langMeta = LANG_META[q.language] || LANG_META.python;
                return (
                  <div
                    key={q.id}
                    onClick={() => { setActiveQuestionId(q.id); setView('workspace'); }}
                    style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 10, padding: '16px 18px', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 5, background: langMeta.bg, color: langMeta.color, border: `1px solid ${langMeta.border}`, textTransform: 'uppercase' }}>
                        {langMeta.label}
                      </span>
                      <StatusChip status={sub?.status} small />
                    </div>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--neutral-dark)', marginBottom: 4 }}>
                      Q{idx + 1}. {q.title}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: 10, lineHeight: 1.45 }}>
                      {(q.description || '').replace(/[#*`]/g, '').slice(0, 140) || 'Open to read the full question and start coding.'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: 'var(--text-secondary)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={11} />
                        {ts.status === 'past_deadline' ? 'Closed' : ts.status === 'coming_soon' ? 'Opens soon' : 'Open'}
                      </span>
                      {sub?.attempt_count ? <span>Attempts: {sub.attempt_count}</span> : null}
                      <span style={{ marginLeft: 'auto', color: '#7C5CBF', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        Open <ArrowRight size={12} />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Render: playground (with named, saved sessions) ────────────────────
  if (area === 'playground') {
    const mySessions = (sessions || [])
      .filter((x) => x.student_id === currentUser.id)
      .sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));

    const openSession = (sess: CsLabSession) => {
      setActiveSessionId(sess.id);
      setSessionName(sess.title);
      setPgLang(sess.language);
      if (sess.language === 'python') {
        setPgCode(sess.code || PY_PLAYGROUND_DEFAULT);
        setPgStdin(sess.stdin || '');
      } else {
        setPgSqlCode(sess.code || SQL_PLAYGROUND_QUERY_DEFAULT);
        setPgSetup(sess.setup_sql || SQL_PLAYGROUND_SETUP_DEFAULT);
        setPgCheckpoint(sess.db_checkpoint || '');
      }
      setPgOutput(sess.output || '');
      setPgError(sess.error || '');
      setSessionsDirty(false);
    };

    const startNewSession = (lang: 'python' | 'sql') => {
      setActiveSessionId(null);
      setSessionName('');
      setPgLang(lang);
      if (lang === 'python') {
        setPgCode(PY_PLAYGROUND_DEFAULT);
        setPgStdin('');
      } else {
        setPgSqlCode(SQL_PLAYGROUND_QUERY_DEFAULT);
        setPgSetup(SQL_PLAYGROUND_SETUP_DEFAULT);
        setPgCheckpoint('');
      }
      setPgOutput('');
      setPgError('');
      setSessionsDirty(false);
      setNameMode('new');
      setNameDraft('');
      setIsNamePromptOpen(true);
    };

    const persistSession = async (explicitName?: string) => {
      const title = (explicitName ?? sessionName).trim();
      if (!title) {
        setNameMode(activeSessionId ? 'rename' : 'new');
        setNameDraft(activeSessionId ? sessionName : '');
        setIsNamePromptOpen(true);
        return;
      }
      setSavingSession(true);
      try {
        const saved = await onSaveSession({
          id: activeSessionId || undefined,
          student_id: currentUser.id,
          student_name: currentUser.name || '',
          title,
          language: pgLang,
          code: pgLang === 'python' ? pgCode : pgSqlCode,
          setup_sql: pgLang === 'sql' ? pgSetup : '',
          stdin: pgLang === 'python' ? pgStdin : '',
          output: pgOutput,
          error: pgError,
          db_checkpoint: pgLang === 'sql' ? pgCheckpoint : '',
        });
        if (saved) {
          setActiveSessionId(saved.id);
          setSessionName(saved.title);
          setSessionsDirty(false);
          flashToast('Session saved to your account');
        } else {
          flashToast('Could not save — check your connection');
        }
      } finally {
        setSavingSession(false);
      }
    };

    const handleDeleteSession = async (id: string) => {
      if (!window.confirm('Delete this saved session? This cannot be undone.')) return;
      const ok = await onDeleteSession(id);
      if (ok) {
        if (activeSessionId === id) {
          setActiveSessionId(null);
          setSessionName('');
        }
        flashToast('Session deleted');
      }
    };

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
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#7C5CBF', letterSpacing: '0.06em' }}>CS LAB</span>
                {activeSessionId ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: sessionsDirty ? '#FEF6E7' : '#EAF7EF', color: sessionsDirty ? '#92400E' : '#166534', border: `1px solid ${sessionsDirty ? '#FDE68A' : '#BBE7C9'}` }}>
                    {sessionsDirty ? 'Unsaved changes' : 'Saved'}
                  </span>
                ) : null}
              </div>
              <h1 className="page-title" style={{ margin: '2px 0 0' }}>
                {sessionName || 'Lab Playground'}
              </h1>
              <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                Your own coding workspace — name sessions and save them to your account.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => { setArea('assignments'); setView('questions'); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: '#FFFFFF', border: '1px solid var(--border-color)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                <ChevronLeft size={14} /> Assignments
              </button>
              <button
                type="button"
                onClick={() => { setNameMode(activeSessionId ? 'rename' : 'new'); setNameDraft(sessionName); setIsNamePromptOpen(true); }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: '#F3EFFA', border: '1px solid #DACDF2', color: '#6D28D9', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
              >
                {activeSessionId ? 'Rename' : 'Name it'}
              </button>
              <button
                type="button"
                onClick={() => persistSession()}
                disabled={savingSession}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: savingSession ? '#8C8983' : '#166534', color: '#fff', border: 'none', fontSize: 12.5, fontWeight: 700, cursor: savingSession ? 'wait' : 'pointer' }}
              >
                {savingSession ? 'Saving…' : 'Save Session'}
              </button>
            </div>
          </div>
        </header>

        <div className="content-body" style={{ padding: '24px 32px' }}>
          {/* Sessions strip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => startNewSession('python')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 8, background: '#1A1A1A', color: '#fff', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              + New Python Session
            </button>
            <button
              type="button"
              onClick={() => startNewSession('sql')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 8, background: '#00758F', color: '#fff', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              + New SQL Session
            </button>
            {mySessions.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#8C8983', textTransform: 'uppercase', letterSpacing: '0.05em' }}>My Sessions:</span>
                {mySessions.map((sess) => {
                  const active = sess.id === activeSessionId;
                  const Icon = sess.language === 'sql' ? Database : Code2;
                  return (
                    <span
                      key={sess.id}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '5px 8px 5px 11px', borderRadius: 999,
                        background: active ? '#1A1A1A' : '#FFFFFF',
                        border: `1px solid ${active ? '#1A1A1A' : 'var(--border-color)'}`,
                        cursor: 'pointer',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => openSession(sess)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: active ? '#FFFFFF' : 'var(--neutral-dark)', fontFamily: 'inherit' }}
                      >
                        <Icon size={12} color={active ? '#FFFFFF' : sess.language === 'sql' ? '#00758F' : '#3776AB'} />
                        {sess.title}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleDeleteSession(sess.id); }}
                        title="Delete session"
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'inline-flex', color: active ? '#D4D4D4' : '#B0ADA7' }}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          <LabPlayground
            language={pgLang}
            code={pgLang === 'python' ? pgCode : pgSqlCode}
            onCodeChange={(v) => { setSessionsDirty(true); if (pgLang === 'python') setPgCode(v); else setPgSqlCode(v); }}
            stdin={pgStdin}
            onStdinChange={(v) => { setSessionsDirty(true); setPgStdin(v); }}
            sqlSetup={pgSetup}
            onSqlSetupChange={(v) => { setSessionsDirty(true); setPgSetup(v); }}
            output={pgOutput}
            error={pgError}
            running={pgRunning}
            onOutputChange={(v) => { setSessionsDirty(true); setPgOutput(v); }}
            onErrorChange={setPgError}
            onRunningChange={setPgRunning}
            onLanguageChange={(l) => { setPgLang(l); setSessionsDirty(true); }}
            sqlMode={activeSessionId ? 'continuous' : 'reset'}
            sessionKey={activeSessionId || 'scratch'}
            initialCheckpoint={pgCheckpoint}
            onSqlCheckpoint={(cp) => { setSessionsDirty(true); setPgCheckpoint(cp); }}
            runners={runners}
          />
        </div>

        {/* Name / rename prompt */}
        {isNamePromptOpen && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,20,18,0.5)', zIndex: 2600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => setIsNamePromptOpen(false)}>
            <div style={{ background: '#FAF9F6', borderRadius: 12, width: 'min(420px, 100%)', padding: '22px 24px', boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800, color: 'var(--neutral-dark)' }}>
                {nameMode === 'rename' ? 'Rename Session' : 'Name This Session'}
              </h3>
              <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                Saved sessions live in your account — pick them up from any device.
              </p>
              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { setIsNamePromptOpen(false); persistSession(nameDraft); } }}
                placeholder="e.g. While-loop practice"
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 13.5, marginBottom: 14 }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" onClick={() => setIsNamePromptOpen(false)} style={{ padding: '8px 14px', borderRadius: 7, background: '#FFFFFF', border: '1px solid var(--border-color)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button
                  type="button"
                  onClick={() => { setIsNamePromptOpen(false); persistSession(nameDraft); }}
                  disabled={!nameDraft.trim() || savingSession}
                  style={{ padding: '8px 18px', borderRadius: 7, background: nameDraft.trim() ? '#166534' : '#B0ADA7', color: '#fff', border: 'none', fontSize: 12.5, fontWeight: 700, cursor: nameDraft.trim() ? 'pointer' : 'not-allowed' }}
                >
                  {savingSession ? 'Saving…' : 'Save Session'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Render: question workspace (assignments area) ─────────────────────
  const langMeta = LANG_META[activeQuestion?.language || 'python'] || LANG_META.python;
  const qIdx = assignedQuestions.findIndex((q) => q.id === activeQuestionId) + 1;

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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <button type="button" onClick={() => setView('questions')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 6, background: '#FFFFFF', border: '1px solid var(--border-color)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>
                <ChevronLeft size={12} /> All Questions
              </button>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 5, background: langMeta.bg, color: langMeta.color, border: `1px solid ${langMeta.border}`, textTransform: 'uppercase' }}>
                {langMeta.label}
              </span>
              <StatusChip status={activeSubmission?.status} small />
            </div>
            <h1 className="page-title" style={{ margin: 0 }}>
              Q{qIdx}. {activeQuestion?.title}
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
              {stats.done}/{stats.total} completed
            </span>
            <button
              type="button"
              onClick={goNextQuestion}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: '#F3EFFA', border: '1px solid #DACDF2', color: '#6D28D9', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
            >
              Next Question <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </header>

      <div className="content-body" style={{ padding: '24px 32px' }}>
        {timeStatus?.status === 'coming_soon' && (
          <div style={{ padding: '10px 14px', borderRadius: 8, background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1D4ED8', fontSize: 12.5, marginBottom: 14 }}>
            This question opens {timeStatus.startsAt}.
          </div>
        )}
        {isLocked && (
          <div style={{ padding: '10px 14px', borderRadius: 8, background: '#FDF1F0', border: '1px solid #FECACA', color: '#B91C1C', fontSize: 12.5, marginBottom: 14 }}>
            The deadline for this question passed {timeStatus?.endedAt}. You can still review your work, but submissions are closed.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.5fr)', gap: 18 }}>
          {/* Question panel */}
          <div>
            <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 10, padding: '16px 18px', marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#55534E', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Question</div>
              <div style={{ fontSize: 13.5, color: 'var(--neutral-dark)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {activeQuestion?.description || 'No description provided.'}
              </div>
              {activeQuestion?.sample_input ? (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#55534E', textTransform: 'uppercase', marginBottom: 5 }}>Sample Input</div>
                  <pre style={{ margin: 0, padding: '9px 12px', background: '#F8F7F4', borderRadius: 7, fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 12, whiteSpace: 'pre-wrap' }}>{activeQuestion.sample_input}</pre>
                </div>
              ) : null}
              {activeQuestion?.deadline && (
                <div style={{ marginTop: 12, fontSize: 11.5, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Clock size={12} /> Due {new Date(activeQuestion.deadline).toLocaleString()}
                </div>
              )}
            </div>

            {lastGrade && (
              <div
                style={{
                  padding: '14px 16px', borderRadius: 10, marginBottom: 14,
                  background: lastGrade.verdict === 'passed' ? '#EAF7EF' : lastGrade.verdict === 'passed_review' ? '#FEF6E7' : '#FDF1F0',
                  border: `1px solid ${lastGrade.verdict === 'passed' ? '#BBE7C9' : lastGrade.verdict === 'passed_review' ? '#FDE68A' : '#FECACA'}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  {lastGrade.verdict === 'passed' ? <CheckCircle2 size={17} color="#16A34A" /> : lastGrade.verdict === 'passed_review' ? <AlertTriangle size={17} color="#D97706" /> : <XCircle size={17} color="#DC2626" />}
                  <span style={{ fontSize: 13.5, fontWeight: 800, color: lastGrade.verdict === 'passed' ? '#166534' : lastGrade.verdict === 'passed_review' ? '#92400E' : '#B91C1C' }}>
                    {lastGrade.verdict === 'passed' ? 'Completed — Correct!' : lastGrade.verdict === 'passed_review' ? 'Correct — Flagged for Review' : 'Not Quite Yet'}
                  </span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{lastGrade.detail}</div>
              </div>
            )}
          </div>

          {/* Editor + output */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#55534E', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your Code</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => persistSubmission({ status: 'draft', output: '', error: '', codeMatches: false }).then((ok) => flashToast(ok ? 'Draft saved' : 'Draft saved locally'))}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 7, background: '#FFFFFF', border: '1px solid var(--border-color)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  <Save size={13} /> Save Draft
                </button>
                <button
                  type="button"
                  onClick={handleRun}
                  disabled={running || submitting || isLocked}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 16px', borderRadius: 7, background: '#1A1A1A', color: '#fff', border: 'none', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', opacity: running || submitting || isLocked ? 0.6 : 1 }}
                >
                  <Play size={13} /> {running ? 'Running…' : 'Run'}
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={running || submitting || isLocked}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 16px', borderRadius: 7, background: submitting ? '#8C8983' : '#166534', color: '#fff', border: 'none', fontSize: 12.5, fontWeight: 700, cursor: submitting ? 'wait' : 'pointer', opacity: running || isLocked ? 0.6 : 1 }}
                >
                  <Send size={13} /> {submitting ? 'Checking…' : 'Submit'}
                </button>
              </div>
            </div>

            <CodeEditor value={code} onChange={setCode} language={activeQuestion?.language || 'python'} height="300px" />

            {activeQuestion?.language === 'python' && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#55534E', marginBottom: 5, textTransform: 'uppercase' }}>
                  Custom Input (stdin) — overrides the sample input when edited
                </div>
                <textarea
                  value={customInput}
                  onChange={(e) => { setCustomInput(e.target.value); setInputDirty(true); }}
                  style={{ width: '100%', minHeight: 54, boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border-color)', fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 12, resize: 'vertical' }}
                />
              </div>
            )}

            <div style={{ marginTop: 12 }}>
              <LabOutputPanel output={runOutput} error={runError} running={running || submitting} statusText={submitting ? 'Running and checking…' : undefined} height={180} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
