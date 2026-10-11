'use client';

import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import {
  Plus, ChevronLeft, FlaskConical, Database, Code2,
  ClipboardCheck, CheckCircle2, XCircle, AlertTriangle, Eye, Trash2, Pencil, Send,
  Table, Key, Sparkles, Play, Check, Layers, FileCode, RotateCcw, HelpCircle, Info,
  Calendar, Users, CheckSquare, Square, Copy, Search, ArrowRight, X, Terminal
} from 'lucide-react';
import { UserProfile, SubjectClass, CsQuestion, CsSubmission, CsLanguage } from '@/lib/supabaseClient';
import { CodeEditor } from './CodeEditor';
import { StatusChip, LabOutputPanel, CS_STATUS_META, SqlResultGrid } from './shared';
import { LabPlayground, LabPlaygroundHandle } from './LabPlayground';
import {
  getTeacherCsClasses, getStudentsForClasses,
} from '@/lib/csLabHelper';
import { PyRunner } from '@/lib/csLab/pyRunner';
import { SqlLabSession, SqlSchemaIntrospection, SqlTableInfo } from '@/lib/csLab/sqlRunner';

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
  language: 'sql',
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

// Built-in SQL Templates for CS Teachers
const SQL_TEMPLATES = [
  {
    id: 'students_marks',
    name: '🎓 Students & Exam Scores',
    category: 'Education / Academic',
    description: 'Students roster with exam scores and subject records',
    suggested_title: 'Calculate Average CS Marks by Student',
    suggested_desc: 'Write an SQL query to retrieve the student name and their average marks across all subjects from the `students` and `exam_scores` tables. Only include students enrolled in Grade 12. Order the result by average marks descending.',
    starter_code: '-- Write your SQL query below\nSELECT \n  s.name,\n  AVG(e.marks_obtained) AS avg_score\nFROM students s\nJOIN exam_scores e ON s.id = e.student_id\nWHERE s.grade = 12\nGROUP BY s.name\nORDER BY avg_score DESC;',
    solution_code: 'SELECT \n  s.name,\n  AVG(e.marks_obtained) AS avg_score\nFROM students s\nJOIN exam_scores e ON s.id = e.student_id\nWHERE s.grade = 12\nGROUP BY s.name\nORDER BY avg_score DESC;',
    setup_sql: `-- Database Schema: Students & Exam Scores
CREATE TABLE students (
  id INT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  grade INT NOT NULL,
  section VARCHAR(5)
);

CREATE TABLE exam_scores (
  id INT PRIMARY KEY,
  student_id INT NOT NULL,
  subject VARCHAR(50) NOT NULL,
  marks_obtained INT NOT NULL,
  max_marks INT NOT NULL DEFAULT 100
);

-- Seed Sample Records
INSERT INTO students (id, name, grade, section) VALUES
  (1, 'Aarav Sharma', 12, 'A'),
  (2, 'Fatima Al-Nuaimi', 12, 'A'),
  (3, 'Rohan Mehta', 11, 'B'),
  (4, 'Zainab Khan', 12, 'B'),
  (5, 'Kavya Nair', 11, 'A');

INSERT INTO exam_scores (id, student_id, subject, marks_obtained, max_marks) VALUES
  (101, 1, 'Computer Science', 95, 100),
  (102, 1, 'Mathematics', 88, 100),
  (103, 2, 'Computer Science', 98, 100),
  (104, 2, 'Mathematics', 92, 100),
  (105, 3, 'Computer Science', 72, 100),
  (106, 4, 'Computer Science', 85, 100),
  (107, 4, 'Physics', 80, 100),
  (108, 5, 'Computer Science', 91, 100);`,
  },
  {
    id: 'employees_departments',
    name: '🏢 Employees & Departments',
    category: 'Corporate HR',
    description: 'Staff records, salary tiers, and department allocation',
    suggested_title: 'Department Salary Expenditure Analysis',
    suggested_desc: 'Write an SQL query to list each department name, total headcount of employees, and total monthly salary expenditure. Only include departments with 2 or more employees.',
    starter_code: '-- Write your SQL query below\nSELECT \n  d.dept_name,\n  COUNT(e.emp_id) AS total_employees,\n  SUM(e.salary) AS total_payroll\nFROM departments d\nJOIN employees e ON d.dept_id = e.dept_id\nGROUP BY d.dept_name\nHAVING COUNT(e.emp_id) >= 2\nORDER BY total_payroll DESC;',
    solution_code: 'SELECT \n  d.dept_name,\n  COUNT(e.emp_id) AS total_employees,\n  SUM(e.salary) AS total_payroll\nFROM departments d\nJOIN employees e ON d.dept_id = e.dept_id\nGROUP BY d.dept_name\nHAVING COUNT(e.emp_id) >= 2\nORDER BY total_payroll DESC;',
    setup_sql: `-- Database Schema: Employees & Departments
CREATE TABLE departments (
  dept_id INT PRIMARY KEY,
  dept_name VARCHAR(50) NOT NULL,
  location VARCHAR(50) NOT NULL
);

CREATE TABLE employees (
  emp_id INT PRIMARY KEY,
  emp_name VARCHAR(50) NOT NULL,
  dept_id INT NOT NULL,
  salary DECIMAL(10,2) NOT NULL,
  hire_date DATE
);

-- Seed Sample Records
INSERT INTO departments (dept_id, dept_name, location) VALUES
  (10, 'Engineering', 'Building A'),
  (20, 'Marketing', 'Building B'),
  (30, 'Finance', 'Building A'),
  (40, 'Human Resources', 'Building C');

INSERT INTO employees (emp_id, emp_name, dept_id, salary, hire_date) VALUES
  (1001, 'Rashid Al-Falasi', 10, 18500, '2021-03-15'),
  (1002, 'Sara Johnson', 10, 22000, '2019-06-01'),
  (1003, 'Vikram Malhotra', 20, 14000, '2022-01-10'),
  (1004, 'Noor Al-Hassan', 30, 19500, '2020-11-20'),
  (1005, 'Alex Chen', 10, 16000, '2023-02-01'),
  (1006, 'Layla Mansoor', 20, 15500, '2021-08-14');`,
  },
  {
    id: 'ecommerce_store',
    name: '🛒 E-Commerce Orders & Products',
    category: 'Retail & Commerce',
    description: 'Products catalog, registered customers, and order history',
    suggested_title: 'Delivered Orders in Dubai',
    suggested_desc: 'Write an SQL query to find all customers located in "Dubai" who have placed orders with status "Delivered". Display customer name, email, and order total amount.',
    starter_code: '-- Write your SQL query below\nSELECT \n  c.customer_name,\n  c.email,\n  o.total_amount\nFROM customers c\nJOIN orders o ON c.customer_id = o.customer_id\nWHERE c.city = "Dubai" AND o.status = "Delivered"\nORDER BY o.total_amount DESC;',
    solution_code: 'SELECT \n  c.customer_name,\n  c.email,\n  o.total_amount\nFROM customers c\nJOIN orders o ON c.customer_id = o.customer_id\nWHERE c.city = "Dubai" AND o.status = "Delivered"\nORDER BY o.total_amount DESC;',
    setup_sql: `-- Database Schema: E-Commerce Store
CREATE TABLE products (
  product_id INT PRIMARY KEY,
  product_name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  stock_qty INT NOT NULL
);

CREATE TABLE customers (
  customer_id INT PRIMARY KEY,
  customer_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL,
  city VARCHAR(50) NOT NULL
);

CREATE TABLE orders (
  order_id INT PRIMARY KEY,
  customer_id INT NOT NULL,
  order_date DATE NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) NOT NULL
);

-- Seed Sample Records
INSERT INTO products (product_id, product_name, category, price, stock_qty) VALUES
  (1, 'Gaming Laptop Pro', 'Electronics', 4200.00, 15),
  (2, 'Wireless Mechanical Keyboard', 'Accessories', 350.00, 45),
  (3, 'Noise-Cancelling Headphones', 'Audio', 680.00, 30),
  (4, '4K Ultra-Wide Monitor', 'Displays', 1850.00, 12);

INSERT INTO customers (customer_id, customer_name, email, city) VALUES
  (101, 'Omar Mansoori', 'omar@woodlem.ae', 'Dubai'),
  (102, 'Elena Rostova', 'elena@woodlem.ae', 'Abu Dhabi'),
  (103, 'Tariq Hashmi', 'tariq@woodlem.ae', 'Ajman'),
  (104, 'Mona Qasimi', 'mona@woodlem.ae', 'Dubai');

INSERT INTO orders (order_id, customer_id, order_date, total_amount, status) VALUES
  (5001, 101, '2024-09-10', 4550.00, 'Delivered'),
  (5002, 102, '2024-09-12', 680.00, 'Shipped'),
  (5003, 101, '2024-09-15', 1850.00, 'Processing'),
  (5004, 104, '2024-09-18', 4200.00, 'Delivered');`,
  },
  {
    id: 'library_books',
    name: '📚 Library & Book Loans',
    category: 'Institutional',
    description: 'Catalog of books, enrolled library members, and active book loans',
    suggested_title: 'Find Active Book Loans',
    suggested_desc: 'Write an SQL query to list all active book loans where the return date is NULL. Display the member name, book title, and issue date.',
    starter_code: '-- Write your SQL query below\nSELECT \n  m.member_name,\n  b.title AS book_title,\n  l.issue_date\nFROM loans l\nJOIN members m ON l.member_id = m.member_id\nJOIN books b ON l.isbn = b.isbn\nWHERE l.return_date IS NULL\nORDER BY l.issue_date ASC;',
    solution_code: 'SELECT \n  m.member_name,\n  b.title AS book_title,\n  l.issue_date\nFROM loans l\nJOIN members m ON l.member_id = m.member_id\nJOIN books b ON l.isbn = b.isbn\nWHERE l.return_date IS NULL\nORDER BY l.issue_date ASC;',
    setup_sql: `-- Database Schema: Library Management
CREATE TABLE books (
  isbn VARCHAR(20) PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  author VARCHAR(100) NOT NULL,
  genre VARCHAR(50) NOT NULL,
  copies_available INT NOT NULL
);

CREATE TABLE members (
  member_id INT PRIMARY KEY,
  member_name VARCHAR(100) NOT NULL,
  join_date DATE NOT NULL
);

CREATE TABLE loans (
  loan_id INT PRIMARY KEY,
  member_id INT NOT NULL,
  isbn VARCHAR(20) NOT NULL,
  issue_date DATE NOT NULL,
  return_date DATE
);

-- Seed Sample Records
INSERT INTO books (isbn, title, author, genre, copies_available) VALUES
  ('978-0131103627', 'The C Programming Language', 'Kernighan & Ritchie', 'Computer Science', 4),
  ('978-0262033848', 'Introduction to Algorithms', 'CLRS', 'Computer Science', 2),
  ('978-0132350884', 'Clean Code', 'Robert C. Martin', 'Software Engineering', 5);

INSERT INTO members (member_id, member_name, join_date) VALUES
  (1, 'Hamdan Al-Ali', '2023-01-15'),
  (2, 'Ananya Sen', '2023-04-10'),
  (3, 'Bilal Qureshi', '2023-08-20');

INSERT INTO loans (loan_id, member_id, isbn, issue_date, return_date) VALUES
  (1001, 1, '978-0131103627', '2024-09-01', '2024-09-15'),
  (1002, 2, '978-0262033848', '2024-09-05', NULL),
  (1003, 3, '978-0132350884', '2024-09-12', NULL);`,
  },
];

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
  
  // Full-page Question Studio state
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<EditorDraft>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationMsg, setValidationMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [toast, setToast] = useState('');

  // SQL Studio interactive features
  const [schemaIntrospection, setSchemaIntrospection] = useState<SqlSchemaIntrospection | null>(null);
  const [introspectingSchema, setIntrospectingSchema] = useState(false);
  const [activeTablePreview, setActiveTablePreview] = useState<string | null>(null);
  const [adHocQuery, setAdHocQuery] = useState('');
  const [adHocResult, setAdHocResult] = useState<{ output: string; error: string; grid: { columns: string[]; rows: any[][] } | null } | null>(null);
  const [adHocRunning, setAdHocRunning] = useState(false);
  const [activeStudioTab, setActiveStudioTab] = useState<'editor' | 'schema_tables' | 'adhoc_sandbox'>('editor');

  const [submissionsQuestionId, setSubmissionsQuestionId] = useState<string | null>(null);
  const [review, setReview] = useState<{ q: CsQuestion; s: CsSubmission } | null>(null);
  const [overrideScore, setOverrideScore] = useState('');
  const [overrideFeedback, setOverrideFeedback] = useState('');
  const [overrideSaving, setOverrideSaving] = useState(false);

  // Playground state
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
    setTimeout(() => setToast(''), 2800);
  }, []);

  // Introspect SQL schema whenever setup_sql changes or on demand
  const handleIntrospectSchema = useCallback(async (sqlCode: string) => {
    if (!sqlCode.trim()) {
      setSchemaIntrospection({ tables: [] });
      return;
    }
    setIntrospectingSchema(true);
    try {
      const session = new SqlLabSession(sqlCode);
      await session.init();
      const intro = session.introspectSchema();
      setSchemaIntrospection(intro);
      if (intro.tables.length > 0 && !activeTablePreview) {
        setActiveTablePreview(intro.tables[0].name);
      }
      session.dispose();
    } catch (e: any) {
      setSchemaIntrospection({ tables: [], error: e?.message || String(e) });
    } finally {
      setIntrospectingSchema(false);
    }
  }, [activeTablePreview]);

  const openCreate = () => {
    const defaultTemplate = SQL_TEMPLATES[0];
    const initialDraft: EditorDraft = {
      ...emptyDraft(),
      language: 'sql',
      title: defaultTemplate.suggested_title,
      description: defaultTemplate.suggested_desc,
      setup_sql: defaultTemplate.setup_sql,
      starter_code: defaultTemplate.starter_code,
      solution_code: defaultTemplate.solution_code,
      target_class_ids: myClasses.map((c) => c.id),
    };
    setDraft(initialDraft);
    setValidationMsg(null);
    setSchemaIntrospection(null);
    setActiveStudioTab('editor');
    setEditorOpen(true);
    // Auto-introspect default schema
    setTimeout(() => handleIntrospectSchema(initialDraft.setup_sql), 100);
  };

  const openEdit = (q: CsQuestion) => {
    const loadedDraft: EditorDraft = {
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
    };
    setDraft(loadedDraft);
    setValidationMsg(null);
    setActiveStudioTab('editor');
    setEditorOpen(true);
    if (loadedDraft.language === 'sql' && loadedDraft.setup_sql) {
      setTimeout(() => handleIntrospectSchema(loadedDraft.setup_sql), 100);
    }
  };

  const handleApplySqlTemplate = (templateId: string) => {
    const t = SQL_TEMPLATES.find((x) => x.id === templateId);
    if (!t) return;
    setDraft((prev) => ({
      ...prev,
      title: prev.title || t.suggested_title,
      description: prev.description || t.suggested_desc,
      setup_sql: t.setup_sql,
      starter_code: t.starter_code,
      solution_code: t.solution_code,
    }));
    handleIntrospectSchema(t.setup_sql);
    flashToast(`Loaded template: ${t.name}`);
  };

  const handleInsertSnippet = (snippet: string) => {
    setDraft((prev) => ({
      ...prev,
      solution_code: prev.solution_code ? `${prev.solution_code}\n\n${snippet}` : snippet,
    }));
    flashToast('Snippet inserted into solution editor');
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
          setValidationMsg({ ok: true, text: 'Expected output captured successfully from your Python solution.' });
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
          setValidationMsg({
            ok: true,
            text: grid
              ? `Expected result grid captured (${grid.rows.length} rows, ${grid.columns.length} columns).`
              : 'Solution executed cleanly (no SELECT statement found to compare).',
          });
        }
        session.dispose();
      }
    } catch (e: any) {
      setValidationMsg({ ok: false, text: e?.message || String(e) });
    } finally {
      setValidating(false);
    }
  };

  const handleRunAdHocQuery = async () => {
    if (!adHocQuery.trim()) return;
    setAdHocRunning(true);
    setAdHocResult(null);
    try {
      const session = new SqlLabSession(draft.setup_sql);
      await session.init();
      const r = await session.runScript(adHocQuery);
      const grid = session.getLastSelectResult(r.statements);
      setAdHocResult({
        output: r.output,
        error: r.error,
        grid: grid ? { columns: grid.columns, rows: grid.rows } : null,
      });
      session.dispose();
    } catch (e: any) {
      setAdHocResult({ output: '', error: e?.message || String(e), grid: null });
    } finally {
      setAdHocRunning(false);
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
      setValidationMsg({ ok: false, text: 'A question title and at least one assigned class are required.' });
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload(publish);
      const ok = draft.id ? await onUpdateQuestion({ ...payload, id: draft.id }) : await onCreateQuestion(payload);
      if (ok) {
        flashToast(publish ? 'Question published to classes' : 'Question draft saved');
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

  // ══════════════════════════════════════════════════════════════════════════
  // FULL-PAGE QUESTION STUDIO (REPLACES POPUP MODAL)
  // ══════════════════════════════════════════════════════════════════════════
  if (editorOpen) {
    return (
      <div style={{ minHeight: '100vh', background: '#FAF9F6', display: 'flex', flexDirection: 'column' }}>
        {/* Toast Notification */}
        {toast && (
          <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 3000, padding: '10px 18px', borderRadius: 8, background: '#1A1A1A', color: '#fff', fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={15} color="#D4A373" /> {toast}
          </div>
        )}

        {/* Top Studio Sticky Header */}
        <header style={{ position: 'sticky', top: 0, zIndex: 20, background: '#FFFFFF', borderBottom: '1.5px solid var(--border-color)', boxShadow: '0 2px 10px rgba(0,0,0,0.03)', padding: '12px 28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button
                type="button"
                onClick={() => {
                  if (saving) return;
                  if (draft.title.trim() && !window.confirm('Discard unsaved question edits and return to list?')) return;
                  setEditorOpen(false);
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 8, background: '#F5F4F0', border: '1px solid var(--border-color)', color: 'var(--neutral-dark)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', transition: 'background 0.15s' }}
              >
                <ChevronLeft size={16} /> Back to CS Lab
              </button>
              <div style={{ width: 1, height: 24, background: 'var(--border-color)' }} />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#7C5CBF', letterSpacing: '0.06em' }}>
                    CS Lab Question Studio
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 4, background: draft.is_published ? '#EAF7EF' : '#FEF6E7', color: draft.is_published ? '#166534' : '#92400E', border: `1px solid ${draft.is_published ? '#BBE7C9' : '#FDE68A'}` }}>
                    {draft.is_published ? 'Published' : 'Draft'}
                  </span>
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--neutral-dark)', marginTop: 1 }}>
                  {draft.id ? `Edit: ${draft.title || 'Untitled Question'}` : (draft.title || 'New Coding & SQL Question')}
                </div>
              </div>
            </div>

            {/* Header Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                onClick={handleValidateSolution}
                disabled={validating || !draft.solution_code.trim()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '8px 16px',
                  borderRadius: 8,
                  background: '#F3EFFA',
                  border: '1.5px solid #DACDF2',
                  color: '#6D28D9',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: validating || !draft.solution_code.trim() ? 'not-allowed' : 'pointer',
                  opacity: validating || !draft.solution_code.trim() ? 0.6 : 1,
                }}
              >
                <Play size={13} fill="#6D28D9" />
                {validating ? 'Running & Validating…' : 'Validate & Test Solution'}
              </button>

              <button
                type="button"
                onClick={() => handleSaveDraft(false)}
                disabled={saving}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  background: '#FFFFFF',
                  border: '1px solid var(--border-color)',
                  color: 'var(--neutral-dark)',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: saving ? 'wait' : 'pointer',
                }}
              >
                {saving ? 'Saving…' : 'Save as Draft'}
              </button>

              <button
                type="button"
                onClick={() => handleSaveDraft(true)}
                disabled={saving || !draftReady}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '8px 20px',
                  borderRadius: 8,
                  background: draftReady ? '#166534' : '#A3A09A',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: 12.5,
                  fontWeight: 800,
                  cursor: draftReady ? (saving ? 'wait' : 'pointer') : 'not-allowed',
                  boxShadow: draftReady ? '0 2px 8px rgba(22,101,52,0.25)' : 'none',
                }}
              >
                <Send size={13} />
                {draft.id ? 'Save & Publish Changes' : 'Publish to Classes'}
              </button>
            </div>
          </div>

          {/* Studio Sub-Navigation Tabs */}
          <div style={{ display: 'flex', gap: 6, marginTop: 12, borderTop: '1px solid #F0EEE9', paddingTop: 8 }}>
            <button
              type="button"
              onClick={() => setActiveStudioTab('editor')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 6,
                border: 'none',
                background: activeStudioTab === 'editor' ? '#7C5CBF' : 'transparent',
                color: activeStudioTab === 'editor' ? '#FFFFFF' : 'var(--text-secondary)',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <FileCode size={13} /> Question &amp; Code Studio
            </button>

            {draft.language === 'sql' && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setActiveStudioTab('schema_tables');
                    if (!schemaIntrospection && draft.setup_sql) {
                      handleIntrospectSchema(draft.setup_sql);
                    }
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 14px',
                    borderRadius: 6,
                    border: 'none',
                    background: activeStudioTab === 'schema_tables' ? '#00758F' : 'transparent',
                    color: activeStudioTab === 'schema_tables' ? '#FFFFFF' : 'var(--text-secondary)',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <Database size={13} /> Visual Database Schema &amp; Tables
                  {schemaIntrospection?.tables && schemaIntrospection.tables.length > 0 && (
                    <span style={{ padding: '1px 6px', borderRadius: 999, fontSize: 10.5, background: activeStudioTab === 'schema_tables' ? 'rgba(255,255,255,0.25)' : '#E5F4F7', color: activeStudioTab === 'schema_tables' ? '#fff' : '#00758F' }}>
                      {schemaIntrospection.tables.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveStudioTab('adhoc_sandbox')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 14px',
                    borderRadius: 6,
                    border: 'none',
                    background: activeStudioTab === 'adhoc_sandbox' ? '#1A1A1A' : 'transparent',
                    color: activeStudioTab === 'adhoc_sandbox' ? '#FFFFFF' : 'var(--text-secondary)',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <Terminal size={13} /> Interactive SQL Sandbox &amp; Query Tester
                </button>
              </>
            )}
          </div>
        </header>

        {/* Studio Content Canvas */}
        <div style={{ flex: 1, padding: '24px 32px', maxWidth: 1440, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
          {/* Validation & Feedback Banner */}
          {validationMsg && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 18px',
                borderRadius: 10,
                marginBottom: 20,
                fontSize: 13,
                fontWeight: 600,
                background: validationMsg.ok ? '#EAF7EF' : '#FDF1F0',
                border: `1.5px solid ${validationMsg.ok ? '#BBE7C9' : '#FECACA'}`,
                color: validationMsg.ok ? '#166534' : '#B91C1C',
                boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
              }}
            >
              {validationMsg.ok ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
              <div style={{ flex: 1 }}>{validationMsg.text}</div>
              <button
                type="button"
                onClick={() => setValidationMsg(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 4 }}
              >
                <X size={15} />
              </button>
            </div>
          )}

          {/* TAB 1: MAIN QUESTION & CODE STUDIO */}
          {activeStudioTab === 'editor' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 22 }}>
              {/* Card 1: Question Meta & Configuration */}
              <div style={{ background: '#FFFFFF', border: '1.5px solid var(--border-color)', borderRadius: 12, padding: '22px 26px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 6, background: '#F3EFFA', color: '#7C5CBF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12 }}>
                    1
                  </div>
                  <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: 'var(--neutral-dark)' }}>
                    Question Overview &amp; Settings
                  </h3>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 220px 200px', gap: 14, marginBottom: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#55534E', textTransform: 'uppercase', marginBottom: 5 }}>
                      Question Title *
                    </label>
                    <input
                      type="text"
                      value={draft.title}
                      onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                      placeholder="e.g. Calculate Highest Department Payroll or Fibonacci Sequence"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 8, border: '1.5px solid var(--border-color)', fontSize: 13.5, fontWeight: 600 }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#55534E', textTransform: 'uppercase', marginBottom: 5 }}>
                      Language &amp; Environment
                    </label>
                    <select
                      value={draft.language}
                      onChange={(e) => {
                        const newLang = e.target.value as CsLanguage;
                        setDraft({ ...draft, language: newLang });
                        if (newLang === 'sql' && !draft.setup_sql) {
                          const def = SQL_TEMPLATES[0];
                          setDraft((d) => ({
                            ...d,
                            language: newLang,
                            setup_sql: def.setup_sql,
                            starter_code: d.starter_code || def.starter_code,
                            solution_code: d.solution_code || def.solution_code,
                          }));
                          handleIntrospectSchema(def.setup_sql);
                        }
                      }}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid var(--border-color)', fontSize: 13, fontWeight: 700, background: '#FFFFFF', color: draft.language === 'sql' ? '#00758F' : '#3776AB' }}
                    >
                      <option value="sql">🗄️ SQL (MySQL &amp; SQLite)</option>
                      <option value="python">🐍 Python 3.11</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#55534E', textTransform: 'uppercase', marginBottom: 5 }}>
                      Publish Status
                    </label>
                    <select
                      value={draft.is_published ? 'yes' : 'no'}
                      onChange={(e) => setDraft({ ...draft, is_published: e.target.value === 'yes' })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid var(--border-color)', fontSize: 13, fontWeight: 600, background: '#FFFFFF' }}
                    >
                      <option value="no">🔒 Draft (Hidden from students)</option>
                      <option value="yes">🟢 Published (Live for students)</option>
                    </select>
                  </div>
                </div>

                {/* Problem Statement */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#55534E', textTransform: 'uppercase', marginBottom: 5 }}>
                    Description &amp; Problem Statement
                  </label>
                  <textarea
                    rows={4}
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    placeholder="Provide detailed problem specifications, constraints, column requirements, sorting criteria, and expected output format..."
                    style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 8, border: '1.5px solid var(--border-color)', fontSize: 13, lineHeight: 1.55, resize: 'vertical' }}
                  />
                </div>

                {/* Class Assignment & Availability Window */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16, paddingTop: 12, borderTop: '1px solid #F0EEE9' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: '#55534E', textTransform: 'uppercase' }}>
                        Assign to CS Classes *
                      </label>
                      {myClasses.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const allSelected = draft.target_class_ids.length === myClasses.length;
                            setDraft((d) => ({ ...d, target_class_ids: allSelected ? [] : myClasses.map((c) => c.id) }));
                          }}
                          style={{ background: 'none', border: 'none', color: '#7C5CBF', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                        >
                          {draft.target_class_ids.length === myClasses.length ? 'Deselect All' : 'Select All Classes'}
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {myClasses.length === 0 && (
                        <span style={{ fontSize: 12.5, color: '#B91C1C' }}>No CS subject classes assigned to your profile.</span>
                      )}
                      {myClasses.map((c) => {
                        const on = draft.target_class_ids.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setDraft((d) => ({
                              ...d,
                              target_class_ids: on ? d.target_class_ids.filter((x) => x !== c.id) : [...d.target_class_ids, c.id],
                            }))}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '6px 14px',
                              borderRadius: 999,
                              border: `1.5px solid ${on ? '#7C5CBF' : 'var(--border-color)'}`,
                              background: on ? '#F3EFFA' : '#FFFFFF',
                              color: on ? '#6D28D9' : '#55534E',
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: 'pointer',
                              transition: 'all 0.15s',
                            }}
                          >
                            {on ? <CheckSquare size={13} color="#6D28D9" /> : <Square size={13} color="#8C8983" />}
                            {c.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#55534E', textTransform: 'uppercase', marginBottom: 6 }}>
                      Availability Window (Optional)
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 10.5, fontWeight: 600, color: '#8C8983', marginBottom: 3 }}>Available From</div>
                        <input
                          type="datetime-local"
                          value={draft.startTimeLocal}
                          onChange={(e) => setDraft({ ...draft, startTimeLocal: e.target.value })}
                          style={{ width: '100%', boxSizing: 'border-box', padding: '7px 9px', borderRadius: 7, border: '1px solid var(--border-color)', fontSize: 12, background: '#FFFFFF' }}
                        />
                      </div>
                      <div>
                        <div style={{ fontSize: 10.5, fontWeight: 600, color: '#8C8983', marginBottom: 3 }}>Deadline</div>
                        <input
                          type="datetime-local"
                          value={draft.deadlineLocal}
                          onChange={(e) => setDraft({ ...draft, deadlineLocal: e.target.value })}
                          style={{ width: '100%', boxSizing: 'border-box', padding: '7px 9px', borderRadius: 7, border: '1px solid var(--border-color)', fontSize: 12, background: '#FFFFFF' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Database Setup & DDL Studio (ONLY FOR SQL) */}
              {draft.language === 'sql' && (
                <div style={{ background: '#FFFFFF', border: '1.5px solid var(--border-color)', borderRadius: 12, padding: '22px 26px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 26, height: 26, borderRadius: 6, background: '#E5F4F7', color: '#00758F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12 }}>
                        2
                      </div>
                      <div>
                        <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: 'var(--neutral-dark)' }}>
                          Database Setup &amp; Table Schemas (DDL &amp; Seed Data)
                        </h3>
                        <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                          Executed automatically before every student attempt to create tables and seed records.
                        </div>
                      </div>
                    </div>

                    {/* Pre-built SQL Templates Picker */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: '#55534E' }}>Load Template:</span>
                      <select
                        onChange={(e) => {
                          if (e.target.value) handleApplySqlTemplate(e.target.value);
                          e.target.value = '';
                        }}
                        style={{ padding: '6px 12px', borderRadius: 7, border: '1.5px solid #00758F', background: '#E5F4F7', color: '#00758F', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                        defaultValue=""
                      >
                        <option value="" disabled>Choose a pre-built schema…</option>
                        {SQL_TEMPLATES.map((t) => (
                          <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => handleIntrospectSchema(draft.setup_sql)}
                        disabled={introspectingSchema || !draft.setup_sql.trim()}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '6px 12px',
                          borderRadius: 7,
                          background: '#FFFFFF',
                          border: '1px solid var(--border-color)',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          color: '#00758F',
                        }}
                      >
                        <RotateCcw size={12} /> {introspectingSchema ? 'Introspecting…' : 'Inspect Schema'}
                      </button>
                    </div>
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <CodeEditor
                      value={draft.setup_sql}
                      onChange={(v) => {
                        setDraft({ ...draft, setup_sql: v });
                      }}
                      language="sql"
                      height="210px"
                    />
                  </div>

                  {/* Visual Tables Preview Bar */}
                  {schemaIntrospection?.tables && schemaIntrospection.tables.length > 0 && (
                    <div style={{ background: '#F8FBFB', border: '1px solid #D0E8EE', borderRadius: 10, padding: '14px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, color: '#00758F', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          <Table size={14} /> Detected Database Tables ({schemaIntrospection.tables.length})
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveStudioTab('schema_tables')}
                          style={{ background: 'none', border: 'none', color: '#00758F', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                          View Full Schema Studio <ArrowRight size={13} />
                        </button>
                      </div>

                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {schemaIntrospection.tables.map((t) => (
                          <div
                            key={t.name}
                            style={{
                              background: '#FFFFFF',
                              border: '1px solid #BEE3EC',
                              borderRadius: 8,
                              padding: '8px 12px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              fontSize: 12,
                            }}
                          >
                            <span style={{ fontWeight: 800, color: '#00758F', fontFamily: 'monospace' }}>{t.name}</span>
                            <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, background: '#E5F4F7', color: '#00758F', fontWeight: 700 }}>
                              {t.columns.length} cols · {t.rowCount} rows
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Card 3: Starter Code & Teacher Solution Query */}
              <div style={{ background: '#FFFFFF', border: '1.5px solid var(--border-color)', borderRadius: 12, padding: '22px 26px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 26, height: 26, borderRadius: 6, background: '#F3EFFA', color: '#7C5CBF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12 }}>
                      {draft.language === 'sql' ? '3' : '2'}
                    </div>
                    <div>
                      <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: 'var(--neutral-dark)' }}>
                        Starter Code &amp; Reference Solution
                      </h3>
                      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                        The reference solution is used by CS Lab to execute and auto-grade student code.
                      </div>
                    </div>
                  </div>

                  {/* SQL Snippet Quick-Helper Toolbar */}
                  {draft.language === 'sql' && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => handleInsertSnippet('SELECT\n  column1,\n  COUNT(*)\nFROM table_name\nWHERE condition\nGROUP BY column1\nHAVING COUNT(*) > 1\nORDER BY column1 ASC;')} style={{ padding: '4px 9px', borderRadius: 6, background: '#F5F4F0', border: '1px solid var(--border-color)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>+ GROUP BY</button>
                      <button type="button" onClick={() => handleInsertSnippet('SELECT\n  a.name,\n  b.detail\nFROM table_a a\nJOIN table_b b ON a.id = b.a_id;')} style={{ padding: '4px 9px', borderRadius: 6, background: '#F5F4F0', border: '1px solid var(--border-color)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>+ INNER JOIN</button>
                      <button type="button" onClick={() => handleInsertSnippet('ORDER BY column_name DESC;')} style={{ padding: '4px 9px', borderRadius: 6, background: '#F5F4F0', border: '1px solid var(--border-color)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>+ ORDER BY</button>
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#55534E', textTransform: 'uppercase', marginBottom: 5 }}>
                      Starter Code (Optional — Visible to Student Initially)
                    </label>
                    <CodeEditor
                      value={draft.starter_code}
                      onChange={(v) => setDraft({ ...draft, starter_code: v })}
                      language={draft.language}
                      height="200px"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#55534E', textTransform: 'uppercase', marginBottom: 5 }}>
                      Your Solution Code (Used for Auto-Grading) *
                    </label>
                    <CodeEditor
                      value={draft.solution_code}
                      onChange={(v) => setDraft({ ...draft, solution_code: v })}
                      language={draft.language}
                      height="200px"
                    />
                  </div>
                </div>

                {/* Python Sample Input */}
                {draft.language === 'python' && (
                  <div style={{ marginTop: 14 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#55534E', textTransform: 'uppercase', marginBottom: 5 }}>
                      Sample Standard Input / stdin (Optional)
                    </label>
                    <textarea
                      rows={2}
                      value={draft.sample_input}
                      onChange={(e) => setDraft({ ...draft, sample_input: e.target.value })}
                      placeholder="Values passed to input() sequentially during testing..."
                      style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 7, border: '1px solid var(--border-color)', fontFamily: 'monospace', fontSize: 12.5 }}
                    />
                  </div>
                )}
              </div>

              {/* Card 4: Solution Test Runner & Captured Expected Output Grid */}
              <div style={{ background: '#FFFFFF', border: '1.5px solid var(--border-color)', borderRadius: 12, padding: '22px 26px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 26, height: 26, borderRadius: 6, background: '#EAF7EF', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12 }}>
                      {draft.language === 'sql' ? '4' : '3'}
                    </div>
                    <div>
                      <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: 'var(--neutral-dark)' }}>
                        Captured Expected Output &amp; Solution Grading Grid
                      </h3>
                      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                        This output is saved with the question and used to compare against student query results.
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleValidateSolution}
                    disabled={validating || !draft.solution_code.trim()}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '7px 15px',
                      borderRadius: 7,
                      background: '#7C5CBF',
                      color: '#FFFFFF',
                      border: 'none',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: validating || !draft.solution_code.trim() ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <Play size={12} fill="#FFFFFF" />
                    {validating ? 'Executing…' : 'Re-Run & Capture Output'}
                  </button>
                </div>

                {draft.expected_sql_result ? (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Captured SQL Result Grid ({draft.expected_sql_result.rows.length} rows × {draft.expected_sql_result.columns.length} columns)
                      </span>
                    </div>
                    <SqlResultGrid
                      columns={draft.expected_sql_result.columns}
                      rows={draft.expected_sql_result.rows}
                    />
                  </div>
                ) : draft.expected_output ? (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#166534', textTransform: 'uppercase', marginBottom: 6 }}>
                      Captured Standard Output
                    </div>
                    <pre style={{ margin: 0, background: '#141414', color: '#A7F3D0', padding: 14, borderRadius: 8, fontSize: 12.5, fontFamily: 'monospace', maxHeight: 180, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
                      {draft.expected_output}
                    </pre>
                  </div>
                ) : (
                  <div style={{ padding: '24px 16px', textAlign: 'center', background: '#FAF9F6', borderRadius: 8, border: '1px dashed var(--border-color)', color: 'var(--text-secondary)', fontSize: 12.5 }}>
                    No output captured yet. Click <strong>"Validate &amp; Test Solution"</strong> to execute your code and snapshot the expected result.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: FULL VISUAL DATABASE SCHEMA & TABLES STUDIO */}
          {activeStudioTab === 'schema_tables' && draft.language === 'sql' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ background: '#FFFFFF', border: '1.5px solid var(--border-color)', borderRadius: 12, padding: '22px 26px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#00758F', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Database size={18} /> Visual SQL Schema &amp; Data Introspection
                    </h3>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                      Interactive visual representation of all tables, column datatypes, primary keys, and seed records generated by your setup script.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleIntrospectSchema(draft.setup_sql)}
                    disabled={introspectingSchema}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 16px',
                      borderRadius: 8,
                      background: '#E5F4F7',
                      border: '1.5px solid #00758F',
                      color: '#00758F',
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <RotateCcw size={13} /> {introspectingSchema ? 'Refreshing Schema…' : 'Re-Introspect Database'}
                  </button>
                </div>

                {(!schemaIntrospection || schemaIntrospection.tables.length === 0) ? (
                  <div style={{ padding: '40px 20px', textAlign: 'center', background: '#FAF9F6', borderRadius: 10, border: '1px dashed var(--border-color)' }}>
                    <Database size={32} color="#00758F" style={{ marginBottom: 10, opacity: 0.5 }} />
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--neutral-dark)' }}>No database tables found</div>
                    <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', maxWidth: 460, margin: '6px auto 14px' }}>
                      Add <code>CREATE TABLE</code> and <code>INSERT INTO</code> statements in the Setup SQL editor, or load a template.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleApplySqlTemplate(SQL_TEMPLATES[0].id)}
                      style={{ padding: '7px 16px', borderRadius: 7, background: '#00758F', color: '#fff', border: 'none', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
                    >
                      Load Sample Students Schema
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 16 }}>
                    {schemaIntrospection.tables.map((tbl) => (
                      <div
                        key={tbl.name}
                        style={{
                          background: '#FFFFFF',
                          border: '1.5px solid #BEE3EC',
                          borderRadius: 10,
                          overflow: 'hidden',
                          boxShadow: '0 2px 8px rgba(0,117,143,0.06)',
                        }}
                      >
                        {/* Table Header */}
                        <div style={{ background: '#E5F4F7', padding: '12px 16px', borderBottom: '1px solid #BEE3EC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <Table size={16} color="#00758F" />
                            <span style={{ fontSize: 14, fontWeight: 800, color: '#00758F', fontFamily: 'monospace' }}>{tbl.name}</span>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#FFFFFF', color: '#00758F', border: '1px solid #BEE3EC' }}>
                            {tbl.rowCount} records · {tbl.columns.length} columns
                          </span>
                        </div>

                        {/* Column Specifications */}
                        <div style={{ padding: '12px 16px', borderBottom: '1px solid #ECEAE5' }}>
                          <div style={{ fontSize: 10.5, fontWeight: 800, color: '#8C8983', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.04em' }}>
                            Columns &amp; Data Types
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {tbl.columns.map((col) => (
                              <div
                                key={col.name}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  fontSize: 12,
                                  padding: '4px 8px',
                                  borderRadius: 5,
                                  background: '#FAF9F7',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  {col.isPk && <Key size={12} color="#D97706" />}
                                  <span style={{ fontWeight: 700, color: 'var(--neutral-dark)', fontFamily: 'monospace' }}>{col.name}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ fontSize: 10.5, padding: '1px 6px', borderRadius: 4, background: '#ECEAE5', color: '#55534E', fontWeight: 600, fontFamily: 'monospace' }}>
                                    {col.type}
                                  </span>
                                  {col.isPk && (
                                    <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: '#FEF6E7', color: '#92400E', fontWeight: 800 }}>
                                      PK
                                    </span>
                                  )}
                                  {col.notNull && !col.isPk && (
                                    <span style={{ fontSize: 10, padding: '1px 4px', borderRadius: 3, background: '#F0EEE9', color: '#8C8983' }}>
                                      NN
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Sample Rows Table Preview */}
                        <div style={{ padding: '12px 16px' }}>
                          <div style={{ fontSize: 10.5, fontWeight: 800, color: '#8C8983', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.04em' }}>
                            Sample Seed Records ({tbl.sampleRows.length})
                          </div>
                          <div style={{ overflowX: 'auto', maxHeight: 180 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                              <thead>
                                <tr style={{ background: '#F8F7F4', borderBottom: '1px solid #E5E3DF' }}>
                                  {tbl.columns.map((c) => (
                                    <th key={c.name} style={{ textAlign: 'left', padding: '5px 8px', fontSize: 10, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                                      {c.name}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {tbl.sampleRows.map((r, ri) => (
                                  <tr key={ri} style={{ borderBottom: '1px solid #F0EEE9' }}>
                                    {r.map((val, ci) => (
                                      <td key={ci} style={{ padding: '5px 8px', fontFamily: 'monospace', color: val === null ? '#B0ADA7' : 'var(--neutral-dark)' }}>
                                        {val === null ? 'NULL' : String(val)}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: AD-HOC SQL QUERY SANDBOX & PLAYGROUND */}
          {activeStudioTab === 'adhoc_sandbox' && draft.language === 'sql' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ background: '#FFFFFF', border: '1.5px solid var(--border-color)', borderRadius: 12, padding: '22px 26px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: 'var(--neutral-dark)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Terminal size={18} color="#7C5CBF" /> SQL Sandbox &amp; Query Tester
                    </h3>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                      Test custom queries, edge cases, joins, and aggregations against your question's active schema in real time.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleRunAdHocQuery}
                    disabled={adHocRunning || !adHocQuery.trim()}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 18px',
                      borderRadius: 8,
                      background: '#1A1A1A',
                      color: '#FFFFFF',
                      border: 'none',
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: adHocRunning || !adHocQuery.trim() ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <Play size={13} fill="#FFFFFF" />
                    {adHocRunning ? 'Running Query…' : 'Execute Query (▶)'}
                  </button>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <CodeEditor
                    value={adHocQuery}
                    onChange={setAdHocQuery}
                    language="sql"
                    height="180px"
                  />
                </div>

                {/* Ad-Hoc Output Grid */}
                {adHocResult && (
                  <div>
                    {adHocResult.error ? (
                      <div style={{ padding: '12px 16px', borderRadius: 8, background: '#FDF1F0', border: '1px solid #FECACA', color: '#B91C1C', fontSize: 12.5, fontWeight: 600 }}>
                        {adHocResult.error}
                      </div>
                    ) : adHocResult.grid ? (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#00758F', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.04em' }}>
                          Query Result ({adHocResult.grid.rows.length} rows returned)
                        </div>
                        <SqlResultGrid
                          columns={adHocResult.grid.columns}
                          rows={adHocResult.grid.rows}
                        />
                      </div>
                    ) : (
                      <pre style={{ margin: 0, background: '#141414', color: '#D4D4D4', padding: 12, borderRadius: 8, fontSize: 12, fontFamily: 'monospace' }}>
                        {adHocResult.output || 'Query executed cleanly (no result grid).'}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DEFAULT TEACHER CS LAB VIEW (QUESTIONS / SUBMISSIONS / PLAYGROUND)
  // ══════════════════════════════════════════════════════════════════════════
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
            <button type="button" onClick={openCreate} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: '#7C5CBF', color: '#fff', border: 'none', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(124,92,191,0.25)' }}>
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
                        <Pencil size={12} /> Edit
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
                <option value="">Choose a question to view submissions…</option>
                {myQuestions.map((q) => (
                  <option key={q.id} value={q.id}>{q.title} ({q.language.toUpperCase()})</option>
                ))}
              </select>
            </div>

            {!submissionsQuestion ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', background: '#FFFFFF', borderRadius: 8, border: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: 13 }}>
                Select a question from the dropdown above to view student progress and submissions.
              </div>
            ) : (
              (() => {
                const targetStudents = studentsForQuestion(submissionsQuestion);
                const subMap = mapSubmissionsByStudentLocal(submissions, submissionsQuestion.id);
                return (
                  <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-color)', background: '#FAF9F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--neutral-dark)' }}>
                        {submissionsQuestion.title} — {targetStudents.length} Students Assigned
                      </div>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                        <thead>
                          <tr style={{ background: '#F8F7F4', borderBottom: '1px solid var(--border-color)' }}>
                            <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Student</th>
                            <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Status</th>
                            <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Submitted</th>
                            <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Score / Override</th>
                            <th style={{ textAlign: 'right', padding: '10px 14px', fontSize: 11, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {targetStudents.map((st) => {
                            const sub = subMap[st.id];
                            return (
                              <tr key={st.id} style={{ borderBottom: '1px solid #ECEAE5' }}>
                                <td style={{ padding: '10px 14px', fontWeight: 600 }}>
                                  {st.name}
                                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 400 }}>{st.email || st.admission_number || '—'}</div>
                                </td>
                                <td style={{ padding: '10px 14px' }}>
                                  <StatusChip status={sub?.status || 'none'} small />
                                </td>
                                <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 11.5 }}>
                                  {sub?.updated_at ? new Date(sub.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                                </td>
                                <td style={{ padding: '10px 14px', fontSize: 12 }}>
                                  {sub?.teacher_score != null ? (
                                    <span style={{ fontWeight: 700, color: '#7C5CBF' }}>{sub.teacher_score} pts</span>
                                  ) : sub?.status === 'passed' ? (
                                    <span style={{ color: '#166534', fontWeight: 600 }}>Auto: Pass</span>
                                  ) : (
                                    '—'
                                  )}
                                </td>
                                <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                                  {sub ? (
                                    <button
                                      type="button"
                                      onClick={() => openReview(submissionsQuestion, sub)}
                                      style={{ padding: '5px 12px', borderRadius: 6, background: '#F3EFFA', border: '1px solid #DACDF2', color: '#6D28D9', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
                                    >
                                      Review Code
                                    </button>
                                  ) : (
                                    <span style={{ fontSize: 11, color: '#A3A09A' }}>No submission</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        )}
      </div>

      {/* Review & Override Modal */}
      {review && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,20,18,0.55)', zIndex: 2500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => setReview(null)}>
          <div style={{ background: '#FFFFFF', borderRadius: 14, width: 'min(760px, 100%)', maxHeight: '90vh', overflow: 'auto', padding: '24px 28px', boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#7C5CBF', textTransform: 'uppercase' }}>Submission Review</div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>{review.s.student_name} — {review.q.title}</div>
              </div>
              <button type="button" onClick={() => setReview(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#8C8983' }}>×</button>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#55534E', textTransform: 'uppercase', marginBottom: 5 }}>Student's Code</div>
              <pre style={{ margin: 0, background: '#141414', color: '#D4D4D4', padding: 14, borderRadius: 8, fontSize: 12, fontFamily: 'monospace', overflow: 'auto', maxHeight: 260 }}>{review.s.code || '(no code)'}</pre>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#55534E', textTransform: 'uppercase', marginBottom: 5 }}>Execution Output</div>
              <pre style={{ margin: 0, background: '#141414', color: '#D4D4D4', padding: 14, borderRadius: 8, fontSize: 12, fontFamily: 'monospace', overflow: 'auto', maxHeight: 180 }}>{review.s.output || '(none)'}{review.s.error ? `\n[ERROR]\n${review.s.error}` : ''}</pre>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 10, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#55534E', textTransform: 'uppercase', marginBottom: 5 }}>Score (pts)</div>
                <input value={overrideScore} onChange={(e) => setOverrideScore(e.target.value)} type="number" placeholder="e.g. 10" style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 7, border: '1px solid var(--border-color)', fontSize: 13 }} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#55534E', textTransform: 'uppercase', marginBottom: 5 }}>Teacher Feedback</div>
                <input value={overrideFeedback} onChange={(e) => setOverrideFeedback(e.target.value)} placeholder="Optional note for the student" style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 7, border: '1px solid var(--border-color)', fontSize: 13 }} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={() => setReview(null)} style={{ padding: '8px 16px', borderRadius: 7, background: '#FFFFFF', border: '1px solid var(--border-color)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button type="button" onClick={handleOverrideSave} disabled={overrideSaving} style={{ padding: '8px 18px', borderRadius: 7, background: '#7C5CBF', color: '#fff', border: 'none', fontSize: 12.5, fontWeight: 700, cursor: overrideSaving ? 'wait' : 'pointer' }}>{overrideSaving ? 'Saving…' : 'Save Grade'}</button>
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
