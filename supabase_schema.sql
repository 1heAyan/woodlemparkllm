-- ==============================================================================
-- Woodlem Park LMS: Complete Database Schema for Supabase
-- Fully Idempotent & Re-runnable
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/geewtbleggwsrjazfqac/sql
-- ==============================================================================

-- 0. Cleanly drop existing policies before table adjustments (Prevents ERROR 0A000)
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- 1. Profiles Table (Users, Roles, Codes, Passwords)
CREATE TABLE IF NOT EXISTS public.profiles (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'student', 'parent', 'principal')),
    user_code TEXT DEFAULT '',
    admission_number TEXT DEFAULT '',
    grade TEXT DEFAULT 'Grade 12 (CBSE)',
    class_letter TEXT DEFAULT 'A',
    subject TEXT DEFAULT NULL,
    assigned_class TEXT DEFAULT NULL,
    avatar_url TEXT DEFAULT NULL,
    temp_password TEXT DEFAULT 'woodlem123',
    linked_student_ids TEXT[] DEFAULT '{}'::TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all columns exist on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS admission_number TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS class_letter TEXT DEFAULT 'A';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subject TEXT DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS assigned_class TEXT DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS temp_password TEXT DEFAULT 'woodlem123';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS linked_student_ids TEXT[] DEFAULT '{}'::TEXT[];

-- Seed default Admin and Principal accounts
INSERT INTO public.profiles (id, email, name, role, user_code, temp_password)
VALUES 
  ('admin-1', 'admin@woodlempark.ae', 'System Admin', 'admin', 'ADM-001', 'woodlem123'),
  ('principal-1', 'principal@woodlempark.ae', 'Principal', 'principal', 'PRN-001', 'woodlem123')
ON CONFLICT (email) DO UPDATE SET 
  role = EXCLUDED.role, 
  name = EXCLUDED.name, 
  temp_password = COALESCE(public.profiles.temp_password, EXCLUDED.temp_password);

-- 2. Tests Table
CREATE TABLE IF NOT EXISTS public.tests (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    title TEXT NOT NULL,
    class_name TEXT DEFAULT 'Grade 12 - Physics (A)',
    questions JSONB DEFAULT '[]'::jsonb,
    duration_minutes INT DEFAULT 30,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.tests ADD COLUMN IF NOT EXISTS questions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.tests ADD COLUMN IF NOT EXISTS duration_minutes INT DEFAULT 30;

-- 3. Assignments Table
CREATE TABLE IF NOT EXISTS public.assignments (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    title TEXT NOT NULL,
    class_name TEXT DEFAULT 'Grade 12 - Physics (A)',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Syllabus Terms Table
CREATE TABLE IF NOT EXISTS public.syllabus_terms (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    subject TEXT DEFAULT 'Physics',
    class_name TEXT DEFAULT '',
    class_id TEXT DEFAULT '',
    order_index INT DEFAULT 0,
    order_num INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.syllabus_terms ADD COLUMN IF NOT EXISTS subject TEXT DEFAULT 'Physics';
ALTER TABLE public.syllabus_terms ADD COLUMN IF NOT EXISTS class_name TEXT DEFAULT '';
ALTER TABLE public.syllabus_terms ADD COLUMN IF NOT EXISTS class_id TEXT DEFAULT '';
ALTER TABLE public.syllabus_terms ADD COLUMN IF NOT EXISTS order_num INT DEFAULT 0;

-- 5. Syllabus Topics Table
CREATE TABLE IF NOT EXISTS public.syllabus_topics (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    term_id TEXT REFERENCES public.syllabus_terms(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    teacher_checked BOOLEAN DEFAULT FALSE,
    student_checked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Achievements Table
CREATE TABLE IF NOT EXISTS public.achievements (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    student_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    desc_text TEXT DEFAULT '',
    file_name TEXT DEFAULT '',
    file_url TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.achievements ADD COLUMN IF NOT EXISTS desc_text TEXT DEFAULT '';
ALTER TABLE public.achievements ADD COLUMN IF NOT EXISTS file_name TEXT DEFAULT '';
ALTER TABLE public.achievements ADD COLUMN IF NOT EXISTS file_url TEXT DEFAULT '';

-- 7. Attendance Table
CREATE TABLE IF NOT EXISTS public.attendance (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    date DATE NOT NULL,
    student_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL, -- 'present', 'auth_absent', 'unauth_absent'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date, student_id)
);

-- 8. Holistic Hub Activities Table
CREATE TABLE IF NOT EXISTS public.hub_activities (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
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
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    activity_id TEXT REFERENCES public.hub_activities(id) ON DELETE CASCADE,
    student_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(activity_id, student_id)
);

-- 10. Parent Documents Table
CREATE TABLE IF NOT EXISTS public.parent_documents (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    student_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
    doc_type TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'submitted'
    file_name TEXT DEFAULT '',
    uploaded_at TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, doc_type)
);

-- 11. Audit & Activity Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    action_type TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_role TEXT NOT NULL,
    target_title TEXT NOT NULL,
    details TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Subject Classes Table (Classrooms)
CREATE TABLE IF NOT EXISTS public.subject_classes (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
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

-- 13. Class Resources Table
CREATE TABLE IF NOT EXISTS public.class_resources (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    class_id TEXT NOT NULL,
    teacher_id TEXT NOT NULL,
    teacher_name TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    resource_type TEXT NOT NULL DEFAULT 'pdf',
    file_name TEXT DEFAULT '',
    file_url TEXT DEFAULT '',
    file_size TEXT DEFAULT '',
    external_link TEXT DEFAULT '',
    topic_tag TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Class Broadcasts / Announcements Table
CREATE TABLE IF NOT EXISTS public.class_broadcasts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    class_id TEXT NOT NULL,
    teacher_id TEXT NOT NULL,
    teacher_name TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_pinned BOOLEAN DEFAULT FALSE,
    priority TEXT DEFAULT 'normal',
    tagged_resource_ids TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. Test Results / Student Assessment Scores Table
CREATE TABLE IF NOT EXISTS public.test_results (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    test_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    score NUMERIC NOT NULL,
    answers JSONB DEFAULT '{}',
    feedback TEXT DEFAULT '',
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    graded_at TIMESTAMPTZ DEFAULT NOW(),
    graded_by TEXT DEFAULT '',
    UNIQUE(test_id, student_id)
);

-- 16. Assignment Submissions Table
CREATE TABLE IF NOT EXISTS public.assignment_submissions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    assignment_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    file_name TEXT DEFAULT '',
    file_url TEXT DEFAULT '',
    grade TEXT DEFAULT '',
    feedback TEXT DEFAULT '',
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    graded_at TIMESTAMPTZ DEFAULT NULL,
    graded_by TEXT DEFAULT '',
    UNIQUE(assignment_id, student_id)
);

-- 17. Student Syllabus Progress Table
CREATE TABLE IF NOT EXISTS public.student_syllabus_progress (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    student_id TEXT NOT NULL,
    topic_id TEXT NOT NULL,
    is_completed BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, topic_id)
);

-- 18. In-School Offline Assessment Register
CREATE TABLE IF NOT EXISTS public.offline_assessments (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    class_id TEXT NOT NULL,
    teacher_id TEXT NOT NULL,
    title TEXT NOT NULL,
    assessment_date DATE NOT NULL,
    maximum_marks NUMERIC NOT NULL CHECK (maximum_marks > 0),
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.offline_assessment_marks (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    assessment_id TEXT NOT NULL REFERENCES public.offline_assessments(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL,
    marks NUMERIC CHECK (marks >= 0),
    teacher_note TEXT DEFAULT '',
    is_visible_to_student BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(assessment_id, student_id)
);

-- 19. Support Tickets Table
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_name TEXT DEFAULT '',
    user_email TEXT DEFAULT '',
    user_role TEXT DEFAULT 'student',
    category TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    priority TEXT DEFAULT 'normal',
    status TEXT DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 20. Parent-Student Link Requests Table
CREATE TABLE IF NOT EXISTS public.parent_student_link_requests (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    parent_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
    parent_name TEXT NOT NULL,
    parent_email TEXT NOT NULL,
    student_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
    student_name TEXT NOT NULL,
    student_admission_number TEXT NOT NULL,
    student_grade TEXT DEFAULT '',
    relationship TEXT DEFAULT 'Parent / Guardian',
    notes TEXT DEFAULT '',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(parent_id, student_id)
);

-- ==============================================================================
-- Row-Level Security (RLS) Enablement & Clean Global Policies
-- ==============================================================================
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
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_syllabus_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offline_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offline_assessment_marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_student_link_requests ENABLE ROW LEVEL SECURITY;

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
CREATE POLICY "Public full access audit_logs" ON public.audit_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access subject_classes" ON public.subject_classes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access class_resources" ON public.class_resources FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access class_broadcasts" ON public.class_broadcasts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access test_results" ON public.test_results FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access assignment_submissions" ON public.assignment_submissions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access student_syllabus_progress" ON public.student_syllabus_progress FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access offline_assessments" ON public.offline_assessments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access offline_assessment_marks" ON public.offline_assessment_marks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access support_tickets" ON public.support_tickets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access parent_student_link_requests" ON public.parent_student_link_requests FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- Real-time Publication
-- ==============================================================================
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.tests; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.assignments; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.syllabus_terms; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.syllabus_topics; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.achievements; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.hub_activities; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.hub_enrollments; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.parent_documents; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.subject_classes; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.class_resources; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.class_broadcasts; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.test_results; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.assignment_submissions; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.student_syllabus_progress; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.offline_assessments; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.offline_assessment_marks; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.parent_student_link_requests; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;
