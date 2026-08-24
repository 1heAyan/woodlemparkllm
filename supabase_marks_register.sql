-- Woodlem LMS: private in-school marks register
-- Run this entire file in Supabase Dashboard → SQL Editor → New query.

CREATE TABLE IF NOT EXISTS public.offline_assessments (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL REFERENCES public.subject_classes(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  assessment_date DATE NOT NULL,
  maximum_marks NUMERIC NOT NULL CHECK (maximum_marks > 0),
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.offline_assessment_marks (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL REFERENCES public.offline_assessments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  marks NUMERIC CHECK (marks >= 0),
  teacher_note TEXT DEFAULT '',
  is_visible_to_student BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(assessment_id, student_id)
);

CREATE INDEX IF NOT EXISTS offline_assessments_class_id_idx
  ON public.offline_assessments(class_id);
CREATE INDEX IF NOT EXISTS offline_assessment_marks_student_id_idx
  ON public.offline_assessment_marks(student_id);

ALTER TABLE public.offline_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offline_assessment_marks ENABLE ROW LEVEL SECURITY;

-- A teacher can only create, read, edit, or delete terms they own.
DROP POLICY IF EXISTS "Teachers manage their assessment registers" ON public.offline_assessments;
CREATE POLICY "Teachers manage their assessment registers"
  ON public.offline_assessments
  FOR ALL
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

-- A teacher can only manage marks belonging to one of their own terms.
DROP POLICY IF EXISTS "Teachers manage marks in their registers" ON public.offline_assessment_marks;
CREATE POLICY "Teachers manage marks in their registers"
  ON public.offline_assessment_marks
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.offline_assessments term
      WHERE term.id = assessment_id AND term.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.offline_assessments term
      WHERE term.id = assessment_id AND term.teacher_id = auth.uid()
    )
  );

-- A student can read only their own result, and only after their teacher releases it.
DROP POLICY IF EXISTS "Students view released individual marks" ON public.offline_assessment_marks;
CREATE POLICY "Students view released individual marks"
  ON public.offline_assessment_marks
  FOR SELECT
  USING (student_id = auth.uid() AND is_visible_to_student = TRUE);

-- A student with a released result may read only that term's basic details.
DROP POLICY IF EXISTS "Students view released assessment details" ON public.offline_assessments;
CREATE POLICY "Students view released assessment details"
  ON public.offline_assessments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.offline_assessment_marks mark
      WHERE mark.assessment_id = id
        AND mark.student_id = auth.uid()
        AND mark.is_visible_to_student = TRUE
    )
  );

-- Optional: enable real-time refreshes if your project uses Supabase Realtime.
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.offline_assessments;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.offline_assessment_marks;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
