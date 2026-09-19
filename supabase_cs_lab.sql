-- ==============================================================================
-- Woodlem Park LMS: Computer Science Lab (CS Lab) — Questions & Submissions
-- Run in Supabase SQL Editor (idempotent, re-runnable).
-- ==============================================================================

-- 1. CS Lab Questions (authored by CS teachers)
CREATE TABLE IF NOT EXISTS public.cs_questions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    teacher_id TEXT NOT NULL,
    teacher_name TEXT DEFAULT '',
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    language TEXT NOT NULL DEFAULT 'python' CHECK (language IN ('python', 'sql')),
    target_class_ids TEXT[] DEFAULT '{}'::TEXT[],
    starter_code TEXT DEFAULT '',
    solution_code TEXT DEFAULT '',
    setup_sql TEXT DEFAULT '',
    sample_input TEXT DEFAULT '',
    expected_output TEXT DEFAULT '',
    expected_sql_result JSONB DEFAULT NULL,
    start_time TIMESTAMPTZ DEFAULT NULL,
    deadline TIMESTAMPTZ DEFAULT NULL,
    is_published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.cs_questions ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE public.cs_questions ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'python';
ALTER TABLE public.cs_questions ADD COLUMN IF NOT EXISTS target_class_ids TEXT[] DEFAULT '{}'::TEXT[];
ALTER TABLE public.cs_questions ADD COLUMN IF NOT EXISTS starter_code TEXT DEFAULT '';
ALTER TABLE public.cs_questions ADD COLUMN IF NOT EXISTS solution_code TEXT DEFAULT '';
ALTER TABLE public.cs_questions ADD COLUMN IF NOT EXISTS setup_sql TEXT DEFAULT '';
ALTER TABLE public.cs_questions ADD COLUMN IF NOT EXISTS sample_input TEXT DEFAULT '';
ALTER TABLE public.cs_questions ADD COLUMN IF NOT EXISTS expected_output TEXT DEFAULT '';
ALTER TABLE public.cs_questions ADD COLUMN IF NOT EXISTS expected_sql_result JSONB DEFAULT NULL;
ALTER TABLE public.cs_questions ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.cs_questions ADD COLUMN IF NOT EXISTS deadline TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.cs_questions ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT FALSE;

-- 2. CS Lab Submissions (one row per student per question; upsert = autosave + submit)
CREATE TABLE IF NOT EXISTS public.cs_submissions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    question_id TEXT NOT NULL,
    question_order INT DEFAULT 0,
    student_id TEXT NOT NULL,
    student_name TEXT DEFAULT '',
    language TEXT DEFAULT 'python',
    code TEXT DEFAULT '',
    output TEXT DEFAULT '',
    error TEXT DEFAULT '',
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'passed', 'passed_review', 'failed')),
    code_matches_solution BOOLEAN DEFAULT FALSE,
    attempt_count INT DEFAULT 0,
    teacher_score NUMERIC DEFAULT NULL,
    teacher_feedback TEXT DEFAULT '',
    reviewed_by TEXT DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(question_id, student_id)
);

ALTER TABLE public.cs_submissions ADD COLUMN IF NOT EXISTS question_order INT DEFAULT 0;
ALTER TABLE public.cs_submissions ADD COLUMN IF NOT EXISTS student_name TEXT DEFAULT '';
ALTER TABLE public.cs_submissions ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'python';
ALTER TABLE public.cs_submissions ADD COLUMN IF NOT EXISTS code TEXT DEFAULT '';
ALTER TABLE public.cs_submissions ADD COLUMN IF NOT EXISTS output TEXT DEFAULT '';
ALTER TABLE public.cs_submissions ADD COLUMN IF NOT EXISTS error TEXT DEFAULT '';
ALTER TABLE public.cs_submissions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';
ALTER TABLE public.cs_submissions ADD COLUMN IF NOT EXISTS code_matches_solution BOOLEAN DEFAULT FALSE;
ALTER TABLE public.cs_submissions ADD COLUMN IF NOT EXISTS attempt_count INT DEFAULT 0;
ALTER TABLE public.cs_submissions ADD COLUMN IF NOT EXISTS teacher_score NUMERIC DEFAULT NULL;
ALTER TABLE public.cs_submissions ADD COLUMN IF NOT EXISTS teacher_feedback TEXT DEFAULT '';
ALTER TABLE public.cs_submissions ADD COLUMN IF NOT EXISTS reviewed_by TEXT DEFAULT '';
ALTER TABLE public.cs_submissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2b. Saved Playground Sessions (student's own named Python/SQL sessions)
CREATE TABLE IF NOT EXISTS public.cs_lab_sessions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    student_id TEXT NOT NULL,
    student_name TEXT DEFAULT '',
    title TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'python' CHECK (language IN ('python', 'sql')),
    code TEXT DEFAULT '',
    setup_sql TEXT DEFAULT '',
    stdin TEXT DEFAULT '',
    output TEXT DEFAULT '',
    error TEXT DEFAULT '',
    db_checkpoint TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.cs_lab_sessions ADD COLUMN IF NOT EXISTS student_name TEXT DEFAULT '';
ALTER TABLE public.cs_lab_sessions ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'python';
ALTER TABLE public.cs_lab_sessions ADD COLUMN IF NOT EXISTS code TEXT DEFAULT '';
ALTER TABLE public.cs_lab_sessions ADD COLUMN IF NOT EXISTS setup_sql TEXT DEFAULT '';
ALTER TABLE public.cs_lab_sessions ADD COLUMN IF NOT EXISTS stdin TEXT DEFAULT '';
ALTER TABLE public.cs_lab_sessions ADD COLUMN IF NOT EXISTS output TEXT DEFAULT '';
ALTER TABLE public.cs_lab_sessions ADD COLUMN IF NOT EXISTS error TEXT DEFAULT '';
ALTER TABLE public.cs_lab_sessions ADD COLUMN IF NOT EXISTS db_checkpoint TEXT DEFAULT '';
ALTER TABLE public.cs_lab_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS cs_lab_sessions_student_idx ON public.cs_lab_sessions(student_id);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS cs_questions_teacher_idx ON public.cs_questions(teacher_id);
CREATE INDEX IF NOT EXISTS cs_submissions_student_idx ON public.cs_submissions(student_id);
CREATE INDEX IF NOT EXISTS cs_submissions_question_idx ON public.cs_submissions(question_id);

-- 4. Enable Row Level Security (policies consistent with the app's other tables)
ALTER TABLE public.cs_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cs_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public full access cs_questions" ON public.cs_questions;
CREATE POLICY "Public full access cs_questions" ON public.cs_questions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access cs_submissions" ON public.cs_submissions;
CREATE POLICY "Public full access cs_submissions" ON public.cs_submissions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access cs_lab_sessions" ON public.cs_lab_sessions;
CREATE POLICY "Public full access cs_lab_sessions" ON public.cs_lab_sessions FOR ALL USING (true) WITH CHECK (true);

-- 5. Realtime publication
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.cs_questions; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.cs_submissions; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.cs_lab_sessions; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;
