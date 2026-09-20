-- ==============================================================================
-- WOODLEM LMS: Student Behavior Management Database Migration
-- Run this in your Supabase Dashboard -> SQL Editor to create native tables
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.student_behavior_incidents (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    student_name TEXT NOT NULL,
    student_admission_number TEXT DEFAULT '',
    grade TEXT DEFAULT '',
    class_letter TEXT DEFAULT '',
    points_deducted NUMERIC NOT NULL DEFAULT 0,
    reason TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'other',
    notes TEXT DEFAULT '',
    action_taken TEXT DEFAULT '',
    teacher_id TEXT NOT NULL,
    teacher_name TEXT NOT NULL,
    teacher_role TEXT NOT NULL DEFAULT 'subject_teacher', -- 'class_teacher' | 'subject_teacher'
    subject TEXT DEFAULT '',
    date TEXT NOT NULL, -- 'YYYY-MM-DD'
    incident_time TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices for rapid querying and filtering
CREATE INDEX IF NOT EXISTS idx_behavior_student_id ON public.student_behavior_incidents (student_id);
CREATE INDEX IF NOT EXISTS idx_behavior_date ON public.student_behavior_incidents (date);
CREATE INDEX IF NOT EXISTS idx_behavior_grade_class ON public.student_behavior_incidents (grade, class_letter);
CREATE INDEX IF NOT EXISTS idx_behavior_teacher_id ON public.student_behavior_incidents (teacher_id);
CREATE INDEX IF NOT EXISTS idx_behavior_subject ON public.student_behavior_incidents (subject);

-- Enable Row Level Security
ALTER TABLE public.student_behavior_incidents ENABLE ROW LEVEL SECURITY;

-- Access Policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'student_behavior_incidents' AND policyname = 'Public full access student_behavior_incidents'
  ) THEN
    CREATE POLICY "Public full access student_behavior_incidents" 
    ON public.student_behavior_incidents FOR ALL 
    USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Add to Realtime Publication
DO $$
BEGIN
  BEGIN 
    ALTER PUBLICATION supabase_realtime ADD TABLE public.student_behavior_incidents; 
  EXCEPTION WHEN OTHERS THEN NULL; 
  END;
END $$;
