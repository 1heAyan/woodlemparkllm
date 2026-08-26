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
  subject?: string | null;       // Teacher's subject (e.g. "English", "Math")
  assigned_class?: string | null; // Class teacher assignment (e.g. "10-D") or null
  linked_student_ids?: string[]; // For Parent: array of linked student IDs
  temp_password?: string;        // Admin preset / assigned credential
  avatar_url?: string;           // Custom profile picture
  created_at?: string;
}

export interface Student {
  id: string;
  name: string;
  email?: string;
  grade?: string;
  class_letter?: string;
  admission_number?: string;
  user_code?: string;
}

export interface ParentStudentLinkRequest {
  id: string;
  parent_id: string;
  parent_name: string;
  parent_email: string;
  student_id: string;
  student_name: string;
  student_admission_number: string;
  student_grade?: string;
  relationship?: string;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at?: string;
  updated_at?: string;
}

export interface TestQuestion {
  id: string;
  type: 'mcq' | 'text'; // multiple-choice or open-ended text
  question: string;
  image_url?: string;   // optional image attached to the question
  options: string[];    // only used for MCQ
  correct: string;      // correct option for MCQ / model answer hint for text
  model_answer?: string; // teacher's model answer (text questions)
  points?: number;
}

export interface TestItem {
  id: string;
  title: string;
  class_name?: string;
  teacher_id?: string;  // owner teacher — used to isolate tests per teacher
  created_at?: string;
  questions?: TestQuestion[];
  duration_minutes?: number;
  total_marks?: number;
  media_url?: string;   // optional header image/media for the test
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
  subject?: string;
  class_name?: string;
  class_id?: string;
  topics?: SyllabusTopic[];
}

export interface Achievement {
  id: string;
  student_id: string;
  title: string;
  description: string;
  file_name?: string;
  file_url?: string;
  created_at?: string;
}

export interface LeaveRequest {
  id: string;
  student_id: string;
  startDate: string;
  endDate: string;
  leaveType: string;
  reason: string;
  fileName?: string;
  fileUrl?: string;
  created_at?: string;
  status?: 'approved' | 'pending' | 'submitted';
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
  file_url?: string;
  uploaded_at?: string;
}

export interface AuditLogItem {
  id: string;
  action_type: 'CREATE_ACHIEVEMENT' | 'EDIT_ACHIEVEMENT' | 'DELETE_ACHIEVEMENT' | 'SUBMIT_ASSIGNMENT' | 'DELETE_SUBMISSION' | 'TOPIC_STUDY_UPDATE';
  user_id: string;
  user_name: string;
  user_role: string;
  target_title: string;
  details: string;
  created_at: string;
}

export interface SubjectClass {
  id: string;
  name: string; // e.g. "Physics 12-C", "AP Calculus"
  subject: string; // e.g. "Physics"
  class_name: string; // e.g. "12-C" or "Grade 12"
  section?: string; // e.g. "Section C"
  room?: string; // e.g. "Room 302"
  teacher_id: string;
  teacher_name: string;
  enrolled_student_ids: string[];
  created_at?: string;
}

export type ResourceType = 'pdf' | 'slides' | 'doc' | 'worksheet' | 'link' | 'video' | 'other';

export interface ClassResource {
  id: string;
  class_id: string;
  teacher_id: string;
  teacher_name: string;
  title: string;
  description?: string;
  resource_type: ResourceType;
  file_name?: string;
  file_url?: string;
  file_size?: string;
  external_link?: string;
  topic_tag?: string;
  created_at?: string;
}

export interface ClassBroadcast {
  id: string;
  class_id: string;
  teacher_id: string;
  teacher_name: string;
  title: string;
  content: string;
  is_pinned?: boolean;
  priority?: 'normal' | 'important' | 'urgent';
  tagged_resource_ids?: string[];
  created_at?: string;
}

export interface SupportTicket {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  user_role: string;
  category: string;
  subject: string;
  message: string;
  priority: 'normal' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved';
  created_at: string;
}

