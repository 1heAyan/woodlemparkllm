import { supabase } from './supabaseClient';

export const BASE_BEHAVIOR_SCORE = 80;
export const LOCAL_STORAGE_BEHAVIOR_KEY = 'woodlem_student_behavior_incidents_v1';
export const BEHAVIOR_MASTER_CLOUD_ID = 'behavior_records_master_backup_v1';

export type BehaviorViolationCategory =
  | 'disruptive_behavior'
  | 'coming_late'
  | 'rule_violation'
  | 'incomplete_work'
  | 'dress_code'
  | 'disrespect'
  | 'unauthorized_device'
  | 'academic_dishonesty'
  | 'other';

export interface ViolationPreset {
  id: BehaviorViolationCategory;
  label: string;
  defaultPoints: number;
  description: string;
}

export const VIOLATION_PRESETS: ViolationPreset[] = [
  {
    id: 'disruptive_behavior',
    label: 'Disruptive Behavior',
    defaultPoints: 4,
    description: 'Talking excessively, distracting peers, or interrupting classroom instruction.',
  },
  {
    id: 'coming_late',
    label: 'Coming Late to Class',
    defaultPoints: 2,
    description: 'Entering the classroom late without an authorized late slip or pass.',
  },
  {
    id: 'rule_violation',
    label: 'Failing to Follow School Rules',
    defaultPoints: 5,
    description: 'Non-compliance with established classroom, corridor, or campus regulations.',
  },
  {
    id: 'incomplete_work',
    label: 'Neglect of Homework / Classwork',
    defaultPoints: 3,
    description: 'Chronic non-submission of assigned homework or refusal to engage in class activities.',
  },
  {
    id: 'dress_code',
    label: 'Uniform / Dress Code Violation',
    defaultPoints: 2,
    description: 'Improper school uniform, inappropriate footwear, or lack of student ID badge.',
  },
  {
    id: 'disrespect',
    label: 'Disrespect to Staff or Peers',
    defaultPoints: 6,
    description: 'Insubordination, foul language, argumentative conduct, or disrespectful gestures.',
  },
  {
    id: 'unauthorized_device',
    label: 'Unauthorized Mobile / Device Use',
    defaultPoints: 4,
    description: 'Using mobile phone, smartwatch, or electronic device during unauthorized periods.',
  },
  {
    id: 'academic_dishonesty',
    label: 'Academic Dishonesty / Misconduct',
    defaultPoints: 10,
    description: 'Cheating, copying during assessments, or unauthorized communication during exams.',
  },
  {
    id: 'other',
    label: 'Other Recorded Incident',
    defaultPoints: 3,
    description: 'Custom behavioral violation as documented by the reporting educator.',
  },
];

export interface BehaviorIncidentRecord {
  id: string;
  student_id: string;
  student_name: string;
  student_admission_number: string;
  grade: string;
  class_letter: string;
  points_deducted: number; // positive integer, e.g. 4
  reason: string;          // Preset label or custom title
  category: BehaviorViolationCategory;
  notes?: string;          // Detailed explanation
  action_taken?: string;   // e.g. "Verbal Warning", "Parent Notified", "Detention"
  teacher_id: string;
  teacher_name: string;
  teacher_role: 'class_teacher' | 'subject_teacher';
  subject?: string;        // e.g. "Grade 12 Physics" or "Homeroom"
  subject_name?: string;   // alias for display
  date: string;            // 'YYYY-MM-DD'
  incident_date?: string;  // alias for date
  incident_time?: string;  // 'HH:MM AM/PM'
  created_at?: string;     // ISO timestamp
}

export interface BehaviorScoreTier {
  label: string;
  color: string;
  badgeBg: string;
  badgeBorder: string;
  bg: string;
  border: string;
  tag: string;
}

/**
 * Computes student current behavior score starting from 80 baseline.
 * Floor is 0 (score cannot be negative).
 */
export function computeStudentBehaviorScore(
  studentId: string,
  incidents: BehaviorIncidentRecord[]
): number {
  if (!studentId || !incidents || incidents.length === 0) return BASE_BEHAVIOR_SCORE;
  const studentIncidents = incidents.filter((inc) => inc.student_id === studentId);
  const totalDeducted = studentIncidents.reduce((sum, inc) => sum + (Number(inc.points_deducted) || 0), 0);
  return Math.max(0, BASE_BEHAVIOR_SCORE - totalDeducted);
}

/**
 * Computes total points deducted for a student.
 */
export function computeStudentTotalDeductions(
  studentId: string,
  incidents: BehaviorIncidentRecord[]
): number {
  if (!studentId || !incidents || incidents.length === 0) return 0;
  return incidents
    .filter((inc) => inc.student_id === studentId)
    .reduce((sum, inc) => sum + (Number(inc.points_deducted) || 0), 0);
}

/**
 * Returns tier status metadata for a behavior score.
 */
export function getBehaviorTier(score: number): BehaviorScoreTier {
  if (score >= 76) {
    return {
      label: 'Exemplary Conduct',
      color: '#2D6E5D',
      badgeBg: '#EAF3EF',
      badgeBorder: '#C7E4D8',
      bg: '#EAF3EF',
      border: '#C7E4D8',
      tag: 'Excellent',
    };
  }
  if (score >= 65) {
    return {
      label: 'Good Standing',
      color: '#2563EB',
      badgeBg: '#EFF6FF',
      badgeBorder: '#BFDBFE',
      bg: '#EFF6FF',
      border: '#BFDBFE',
      tag: 'Good',
    };
  }
  if (score >= 50) {
    return {
      label: 'Needs Guidance',
      color: '#D97706',
      badgeBg: '#FEF3C7',
      badgeBorder: '#FDE68A',
      bg: '#FEF3C7',
      border: '#FDE68A',
      tag: 'Needs Attention',
    };
  }
  return {
    label: 'Conduct Review Required',
    color: '#DC2626',
    badgeBg: '#FEE2E2',
    badgeBorder: '#FECACA',
    bg: '#FEE2E2',
    border: '#FECACA',
    tag: 'Critical',
  };
}

/**
 * Read cached incidents from local storage.
 */
export function getLocalBehaviorIncidents(): BehaviorIncidentRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_BEHAVIOR_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('Failed to parse local behavior incidents cache:', e);
    return [];
  }
}

/**
 * Write incidents to local storage.
 */
export function setLocalBehaviorIncidents(incidents: BehaviorIncidentRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_BEHAVIOR_KEY, JSON.stringify(incidents));
  } catch (e) {
    console.warn('Failed to set local behavior incidents cache:', e);
  }
}

/**
 * Load all behavior incidents from Supabase.
 * Checks native public.student_behavior_incidents table,
 * then falls back to public.hub_activities master backup,
 * and finally local storage.
 */
export async function loadBehaviorIncidents(): Promise<BehaviorIncidentRecord[]> {
  const localCache = getLocalBehaviorIncidents();

  try {
    // 1. Try native table
    const { data: nativeData, error: nativeErr } = await supabase
      .from('student_behavior_incidents')
      .select('*')
      .order('created_at', { ascending: false });

    if (!nativeErr && Array.isArray(nativeData) && nativeData.length > 0) {
      const parsed = nativeData.map((row: any): BehaviorIncidentRecord => ({
        id: row.id,
        student_id: row.student_id,
        student_name: row.student_name,
        student_admission_number: row.student_admission_number || '',
        grade: row.grade || '',
        class_letter: row.class_letter || '',
        points_deducted: Number(row.points_deducted) || 0,
        reason: row.reason || 'General Infraction',
        category: (row.category as BehaviorViolationCategory) || 'other',
        notes: row.notes || '',
        action_taken: row.action_taken || '',
        teacher_id: row.teacher_id || '',
        teacher_name: row.teacher_name || 'Faculty Member',
        teacher_role: (row.teacher_role as any) || 'subject_teacher',
        subject: row.subject || '',
        date: row.date || new Date().toISOString().slice(0, 10),
        incident_time: row.incident_time || '',
        created_at: row.created_at || new Date().toISOString(),
      }));
      setLocalBehaviorIncidents(parsed);
      return parsed;
    }

    // 2. Fallback to hub_activities master backup
    const { data: hubData, error: hubErr } = await supabase
      .from('hub_activities')
      .select('description')
      .eq('id', BEHAVIOR_MASTER_CLOUD_ID)
      .maybeSingle();

    if (!hubErr && hubData?.description) {
      try {
        const parsedHub = JSON.parse(hubData.description);
        if (Array.isArray(parsedHub) && parsedHub.length > 0) {
          setLocalBehaviorIncidents(parsedHub);
          return parsedHub;
        }
      } catch (e) {}
    }
  } catch (err) {
    console.warn('Behavior incidents cloud fetch notice:', err);
  }

  return localCache;
}

/**
 * Persists an incident to local storage and Supabase.
 */
export async function saveBehaviorIncident(
  incident: BehaviorIncidentRecord
): Promise<BehaviorIncidentRecord[]> {
  // 1. Update local storage immediately for zero latency
  const current = getLocalBehaviorIncidents();
  const filtered = current.filter((item) => item.id !== incident.id);
  const updated = [incident, ...filtered];
  setLocalBehaviorIncidents(updated);

  // 2. Cloud Store 1: Insert into native table
  try {
    await supabase.from('student_behavior_incidents').upsert([
      {
        id: incident.id,
        student_id: incident.student_id,
        student_name: incident.student_name,
        student_admission_number: incident.student_admission_number,
        grade: incident.grade,
        class_letter: incident.class_letter,
        points_deducted: incident.points_deducted,
        reason: incident.reason,
        category: incident.category,
        notes: incident.notes || '',
        action_taken: incident.action_taken || '',
        teacher_id: incident.teacher_id,
        teacher_name: incident.teacher_name,
        teacher_role: incident.teacher_role,
        subject: incident.subject || '',
        date: incident.date,
        incident_time: incident.incident_time || '',
        created_at: incident.created_at || new Date().toISOString(),
      },
    ]);
  } catch (err) {
    console.warn('Native student_behavior_incidents save notice:', err);
  }

  // 3. Cloud Store 2: Master backup in hub_activities
  try {
    await supabase.from('hub_activities').upsert([
      {
        id: BEHAVIOR_MASTER_CLOUD_ID,
        title: 'Behavior Records Master Backup',
        type: 'behavior_master_backup',
        description: JSON.stringify(updated.slice(0, 300)),
        created_at: new Date().toISOString(),
      },
    ]);
  } catch (err) {}

  return updated;
}

/**
 * Deletes / voids an incident (e.g., error correction or restorative review).
 */
export async function deleteBehaviorIncident(incidentId: string): Promise<BehaviorIncidentRecord[]> {
  const current = getLocalBehaviorIncidents();
  const updated = current.filter((item) => item.id !== incidentId);
  setLocalBehaviorIncidents(updated);

  try {
    await supabase.from('student_behavior_incidents').delete().eq('id', incidentId);
  } catch (err) {
    console.warn('Native student_behavior_incidents delete notice:', err);
  }

  try {
    await supabase.from('hub_activities').upsert([
      {
        id: BEHAVIOR_MASTER_CLOUD_ID,
        title: 'Behavior Records Master Backup',
        type: 'behavior_master_backup',
        description: JSON.stringify(updated.slice(0, 300)),
        created_at: new Date().toISOString(),
      },
    ]);
  } catch (err) {}

  return updated;
}

/**
 * Exports behavior incident records to CSV.
 */
export function exportBehaviorToCSV(
  records: BehaviorIncidentRecord[],
  fileName = 'woodlem_student_behavior_records.csv'
): void {
  if (!records || records.length === 0) {
    alert('No behavior records to export.');
    return;
  }

  const headers = [
    'Date',
    'Time',
    'Student Name',
    'Admission No',
    'Grade',
    'Section',
    'Points Deducted',
    'Reason',
    'Category',
    'Subject / Context',
    'Recorded By',
    'Teacher Role',
    'Action Taken',
    'Teacher Notes',
  ];

  const escapeCsv = (str?: string | number) => {
    if (str === undefined || str === null) return '""';
    const clean = String(str).replace(/"/g, '""');
    return `"${clean}"`;
  };

  const rows = records.map((r) => [
    escapeCsv(r.date),
    escapeCsv(r.incident_time || ''),
    escapeCsv(r.student_name),
    escapeCsv(r.student_admission_number),
    escapeCsv(r.grade),
    escapeCsv(r.class_letter),
    escapeCsv(r.points_deducted),
    escapeCsv(r.reason),
    escapeCsv(r.category),
    escapeCsv(r.subject || ''),
    escapeCsv(r.teacher_name),
    escapeCsv(r.teacher_role),
    escapeCsv(r.action_taken || ''),
    escapeCsv(r.notes || ''),
  ]);

  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
