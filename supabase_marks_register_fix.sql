-- Fix for Woodlem's profile-ID based authentication.
-- Run this AFTER supabase_marks_register.sql in Supabase SQL Editor.

ALTER TABLE public.offline_assessment_marks DROP CONSTRAINT IF EXISTS offline_assessment_marks_student_id_fkey;
ALTER TABLE public.offline_assessments DROP CONSTRAINT IF EXISTS offline_assessments_teacher_id_fkey;
ALTER TABLE public.offline_assessment_marks ALTER COLUMN student_id TYPE TEXT USING student_id::TEXT;
ALTER TABLE public.offline_assessments ALTER COLUMN teacher_id TYPE TEXT USING teacher_id::TEXT;

DROP POLICY IF EXISTS "Teachers manage their assessment registers" ON public.offline_assessments;
CREATE POLICY "Teachers manage their assessment registers" ON public.offline_assessments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = teacher_id AND p.role = 'teacher' AND lower(p.email) = lower(auth.jwt() ->> 'email'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = teacher_id AND p.role = 'teacher' AND lower(p.email) = lower(auth.jwt() ->> 'email'))
  );

DROP POLICY IF EXISTS "Teachers manage marks in their registers" ON public.offline_assessment_marks;
CREATE POLICY "Teachers manage marks in their registers" ON public.offline_assessment_marks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.offline_assessments term
      JOIN public.profiles teacher ON teacher.id = term.teacher_id
      WHERE term.id = assessment_id AND teacher.role = 'teacher' AND lower(teacher.email) = lower(auth.jwt() ->> 'email')
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.offline_assessments term
      JOIN public.profiles teacher ON teacher.id = term.teacher_id
      WHERE term.id = assessment_id AND teacher.role = 'teacher' AND lower(teacher.email) = lower(auth.jwt() ->> 'email')
    )
  );

DROP POLICY IF EXISTS "Students view released individual marks" ON public.offline_assessment_marks;
CREATE POLICY "Students view released individual marks" ON public.offline_assessment_marks
  FOR SELECT USING (
    is_visible_to_student = TRUE AND EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = student_id AND p.role = 'student' AND lower(p.email) = lower(auth.jwt() ->> 'email')
    )
  );

DROP POLICY IF EXISTS "Students view released assessment details" ON public.offline_assessments;
CREATE POLICY "Students view released assessment details" ON public.offline_assessments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.offline_assessment_marks mark
      JOIN public.profiles student ON student.id = mark.student_id
      WHERE mark.assessment_id = id AND mark.is_visible_to_student = TRUE AND student.role = 'student' AND lower(student.email) = lower(auth.jwt() ->> 'email')
    )
  );
