import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://geewtbleggwsrjazfqac.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlZXd0YmxlZ2d3c3JqYXpmcWFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0MTE4NDIsImV4cCI6MjEwMDk4Nzg0Mn0.inCAGx_xty3j37a1KJrnEzNTT47kh1cuwJBByQhEUxU';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function createIsolatedSupabaseClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}


export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'teacher' | 'student' | 'parent';
  user_code?: string;
  admission_number?: string;
  grade?: string;
  class_letter?: string;
  created_at?: string;
}

export interface Student {
  id: string;
  name: string;
  email?: string;
  grade?: string;
}

export interface TestItem {
  id: string;
  title: string;
  class_name?: string;
  created_at?: string;
}

export interface AssignmentItem {
  id: string;
  title: string;
  class_name?: string;
  created_at?: string;
}

export interface SyllabusTopic {
  id: string;
  term_id: string;
  title: string;
  teacher_checked: boolean;
  student_checked: boolean;
}

export interface SyllabusTerm {
  id: string;
  name: string;
  order_index?: number;
  topics?: SyllabusTopic[];
}

export interface Achievement {
  id: string;
  student_id: string;
  title: string;
  description: string;
  created_at?: string;
}

export interface AttendanceRecord {
  id?: string;
  date: string;
  student_id: string;
  status: 'present' | 'auth_absent' | 'unauth_absent';
}

export interface HubActivity {
  id: string;
  title: string;
  type: string;
  description: string;
  date: string;
  video_url?: string;
  attached_file_name?: string;
  target_grades: string[];
  created_by?: string;
  enrolled_student_ids?: string[];
}

export interface ParentDocument {
  id?: string;
  student_id: string;
  doc_type: string;
  status: 'pending' | 'submitted';
  file_name?: string;
  uploaded_at?: string;
}
