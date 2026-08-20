-- Woodlem Park LMS Database Schema for Supabase (Idempotent & Re-runnable)
-- Execute this script in your Supabase SQL Editor: https://supabase.com/dashboard/project/geewtbleggwsrjazfqac/sql

-- 1. Profiles Table (Stores Users, Roles, and User Codes)
CREATE TABLE IF NOT EXISTS public.profiles (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'student', 'parent')),
    user_code TEXT DEFAULT '',
    grade TEXT DEFAULT 'Grade 12 (CBSE)',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alter id column to TEXT if previously created as UUID
ALTER TABLE public.profiles ALTER COLUMN id TYPE TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS admission_number TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS class_letter TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subject TEXT DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS assigned_class TEXT DEFAULT NULL;

-- Seed initial Admin user profile
INSERT INTO public.profiles (id, email, name, role, user_code)
VALUES ('admin-1', 'admin@woodlem.com', 'System Admin', 'admin', 'ADM-001')
ON CONFLICT (email) DO UPDATE SET role = 'admin';

-- 2. Tests Table
CREATE TABLE IF NOT EXISTS public.tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    class_name TEXT DEFAULT 'Grade 12 - Physics (A)',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Assignments Table
CREATE TABLE IF NOT EXISTS public.assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    class_name TEXT DEFAULT 'Grade 12 - Physics (A)',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Syllabus Terms Table
CREATE TABLE IF NOT EXISTS public.syllabus_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    order_index INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Syllabus Topics Table
CREATE TABLE IF NOT EXISTS public.syllabus_topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    term_id UUID REFERENCES public.syllabus_terms(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    teacher_checked BOOLEAN DEFAULT FALSE,
    student_checked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Achievements Table
CREATE TABLE IF NOT EXISTS public.achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    file_name TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.achievements ALTER COLUMN id TYPE TEXT;
ALTER TABLE public.achievements ADD COLUMN IF NOT EXISTS desc_text TEXT DEFAULT '';
ALTER TABLE public.achievements ADD COLUMN IF NOT EXISTS file_name TEXT DEFAULT '';
ALTER TABLE public.syllabus_terms ALTER COLUMN id TYPE TEXT;
ALTER TABLE public.syllabus_terms ADD COLUMN IF NOT EXISTS order_num INT DEFAULT 0;
ALTER TABLE public.syllabus_terms ADD COLUMN IF NOT EXISTS subject TEXT DEFAULT 'Physics';
ALTER TABLE public.syllabus_topics ALTER COLUMN id TYPE TEXT;

-- 7. Attendance Table
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    student_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL, -- 'present', 'auth_absent', 'unauth_absent'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date, student_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS attendance_date_student_idx ON public.attendance (date, student_id);

-- 8. Holistic Hub Activities Table
CREATE TABLE IF NOT EXISTS public.hub_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    date DATE NOT NULL,
    video_url TEXT DEFAULT '',
    attached_file_name TEXT DEFAULT '',
    target_grades TEXT[] DEFAULT ARRAY['Grade 12'],
    created_by TEXT DEFAULT 'teacher',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Hub Activity Enrollments Table
CREATE TABLE IF NOT EXISTS public.hub_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID REFERENCES public.hub_activities(id) ON DELETE CASCADE,
    student_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(activity_id, student_id)
);

-- 10. Parent Documents Table
CREATE TABLE IF NOT EXISTS public.parent_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
    doc_type TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'submitted'
    file_name TEXT DEFAULT '',
    uploaded_at TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, doc_type)
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.syllabus_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.syllabus_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_documents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if present before recreating to prevent duplicate policy errors
DROP POLICY IF EXISTS "Public full access profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public access profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public full access tests" ON public.tests;
DROP POLICY IF EXISTS "Public access tests" ON public.tests;
DROP POLICY IF EXISTS "Public full access assignments" ON public.assignments;
DROP POLICY IF EXISTS "Public access assignments" ON public.assignments;
DROP POLICY IF EXISTS "Public full access syllabus_terms" ON public.syllabus_terms;
DROP POLICY IF EXISTS "Public access syllabus_terms" ON public.syllabus_terms;
DROP POLICY IF EXISTS "Public full access syllabus_topics" ON public.syllabus_topics;
DROP POLICY IF EXISTS "Public access syllabus_topics" ON public.syllabus_topics;
DROP POLICY IF EXISTS "Public full access achievements" ON public.achievements;
DROP POLICY IF EXISTS "Public access achievements" ON public.achievements;
DROP POLICY IF EXISTS "Public full access attendance" ON public.attendance;
DROP POLICY IF EXISTS "Public access attendance" ON public.attendance;
DROP POLICY IF EXISTS "Public full access hub_activities" ON public.hub_activities;
DROP POLICY IF EXISTS "Public access hub_activities" ON public.hub_activities;
DROP POLICY IF EXISTS "Public full access hub_enrollments" ON public.hub_enrollments;
DROP POLICY IF EXISTS "Public access hub_enrollments" ON public.hub_enrollments;
DROP POLICY IF EXISTS "Public full access parent_documents" ON public.parent_documents;
DROP POLICY IF EXISTS "Public access parent_documents" ON public.parent_documents;

-- Create policies safely
CREATE POLICY "Public full access profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access tests" ON public.tests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access assignments" ON public.assignments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access syllabus_terms" ON public.syllabus_terms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access syllabus_topics" ON public.syllabus_topics FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access achievements" ON public.achievements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access attendance" ON public.attendance FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access hub_activities" ON public.hub_activities FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access hub_enrollments" ON public.hub_enrollments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access parent_documents" ON public.parent_documents FOR ALL USING (true) WITH CHECK (true);

-- 11. Automatic Sync Trigger from auth.users to public.profiles
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    name,
    role,
    user_code,
    admission_number,
    grade,
    class_letter,
    subject,
    assigned_class
  )
  VALUES (
    NEW.id::text,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(LOWER(NEW.raw_user_meta_data->>'role'), 'student'),
    COALESCE(NEW.raw_user_meta_data->>'user_code', NEW.raw_user_meta_data->>'admission_number', ''),
    COALESCE(NEW.raw_user_meta_data->>'admission_number', NEW.raw_user_meta_data->>'user_code', ''),
    COALESCE(NEW.raw_user_meta_data->>'grade', '10'),
    COALESCE(NEW.raw_user_meta_data->>'class_letter', 'A'),
    COALESCE(NEW.raw_user_meta_data->>'subject', NULL),
    COALESCE(NEW.raw_user_meta_data->>'assigned_class', NULL)
  )
  ON CONFLICT (email) DO UPDATE SET
    id = EXCLUDED.id,
    name = COALESCE(NULLIF(EXCLUDED.name, ''), public.profiles.name),
    role = COALESCE(NULLIF(EXCLUDED.role, ''), public.profiles.role),
    grade = COALESCE(NULLIF(EXCLUDED.grade, ''), public.profiles.grade),
    class_letter = COALESCE(NULLIF(EXCLUDED.class_letter, ''), public.profiles.class_letter);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- 12. Instant Backfill: Sync all existing auth.users into public.profiles
INSERT INTO public.profiles (
  id,
  email,
  name,
  role,
  user_code,
  admission_number,
  grade,
  class_letter
)
SELECT
  id::text,
  email,
  COALESCE(raw_user_meta_data->>'name', split_part(email, '@', 1)),
  COALESCE(LOWER(raw_user_meta_data->>'role'), 'student'),
  COALESCE(raw_user_meta_data->>'user_code', raw_user_meta_data->>'admission_number', ''),
  COALESCE(raw_user_meta_data->>'admission_number', raw_user_meta_data->>'user_code', ''),
  COALESCE(raw_user_meta_data->>'grade', '10'),
  COALESCE(raw_user_meta_data->>'class_letter', 'A')
FROM auth.users
WHERE email IS NOT NULL
ON CONFLICT (email) DO UPDATE SET
  id = EXCLUDED.id,
  name = COALESCE(NULLIF(EXCLUDED.name, ''), public.profiles.name);

-- 13. Audit & Activity Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY,
    action_type TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_role TEXT NOT NULL,
    target_title TEXT NOT NULL,
    details TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Subject Classes Table (Google Classroom style)
CREATE TABLE IF NOT EXISTS public.subject_classes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    class_name TEXT NOT NULL,
    section TEXT DEFAULT '',
    room TEXT DEFAULT '',
    teacher_id TEXT NOT NULL,
    teacher_name TEXT NOT NULL,
    enrolled_student_ids TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

