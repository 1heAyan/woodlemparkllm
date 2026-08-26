-- Woodlem LMS: RLS Policy Fix for Offline Assessments and Marks
-- Allows both Teachers and Admins to manage assessments and marks.
-- Run this in the Supabase Dashboard SQL Editor.

-- 1. Drop old policies
DROP POLICY IF EXISTS "Teachers manage their assessment registers" ON public.offline_assessments;
DROP POLICY IF EXISTS "Authenticated users can select assessment metadata" ON public.offline_assessments;
DROP POLICY IF EXISTS "Teachers manage marks in their registers" ON public.offline_assessment_marks;
DROP POLICY IF EXISTS "Students view released individual marks" ON public.offline_assessment_marks;
DROP POLICY IF EXISTS "Parents view released marks of linked students" ON public.offline_assessment_marks;
DROP POLICY IF EXISTS "Teachers and admins manage assessment registers" ON public.offline_assessments;
DROP POLICY IF EXISTS "Teachers and admins manage marks in registers" ON public.offline_assessment_marks;

-- 2. Clean table type constraints: convert UUID columns to TEXT to work with Woodlem profile identifiers
ALTER TABLE public.offline_assessment_marks DROP CONSTRAINT IF EXISTS offline_assessment_marks_student_id_fkey;
ALTER TABLE public.offline_assessments DROP CONSTRAINT IF EXISTS offline_assessments_teacher_id_fkey;
ALTER TABLE public.offline_assessments DROP CONSTRAINT IF EXISTS offline_assessments_class_id_fkey;
ALTER TABLE public.offline_assessment_marks ALTER COLUMN student_id TYPE TEXT USING student_id::TEXT;
ALTER TABLE public.offline_assessments ALTER COLUMN teacher_id TYPE TEXT USING teacher_id::TEXT;

-- 3. Ensure RLS is enabled
ALTER TABLE public.offline_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offline_assessment_marks ENABLE ROW LEVEL SECURITY;

-- 4. Create policies for offline_assessments
-- Teachers and Admins can select, insert, update, delete
CREATE POLICY "Teachers and admins manage assessment registers" ON public.offline_assessments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE lower(p.email) = lower(auth.jwt() ->> 'email')
        AND (p.role = 'admin' OR (p.role = 'teacher' AND p.id::text = teacher_id::text))
    )
  );

-- All authenticated users (teachers, students, parents) can select metadata
CREATE POLICY "Authenticated users can select assessment metadata" ON public.offline_assessments
  FOR SELECT USING (
    auth.role() = 'authenticated'
  );

-- 5. Create policies for offline_assessment_marks
-- Teachers and Admins can manage marks
CREATE POLICY "Teachers and admins manage marks in registers" ON public.offline_assessment_marks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.offline_assessments term
      WHERE term.id = assessment_id 
        AND EXISTS (
          SELECT 1 FROM public.profiles p 
          WHERE lower(p.email) = lower(auth.jwt() ->> 'email')
            AND (p.role = 'admin' OR (p.role = 'teacher' AND p.id::text = term.teacher_id::text))
        )
    )
  );

-- Students can read only their own released marks
CREATE POLICY "Students view released individual marks" ON public.offline_assessment_marks
  FOR SELECT USING (
    is_visible_to_student = TRUE AND EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id::text = student_id::text 
        AND p.role = 'student' 
        AND lower(p.email) = lower(auth.jwt() ->> 'email')
    )
  );

-- Parents can read released marks for their linked children
CREATE POLICY "Parents view released marks of linked students" ON public.offline_assessment_marks
  FOR SELECT USING (
    is_visible_to_student = TRUE AND EXISTS (
      SELECT 1 FROM public.profiles parent
      WHERE parent.role = 'parent' 
        AND lower(parent.email) = lower(auth.jwt() ->> 'email')
        AND student_id::text = ANY(parent.linked_student_ids)
    )
  );
