import { supabase } from './supabaseClient';

export const BASE_BEHAVIOR_SCORE = 80;
// 100% Supabase Cloud master record key in hub_activities
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
 * Load all behavior incidents from Supabase Cloud.
 * Queries Supabase achievements (__BEHAVIOR_INCIDENT__),
 * redundant hub_activities master cloud backup, and native student_behavior_incidents table.
 * Strictly avoids localStorage.
 */
export async function loadBehaviorIncidents(): Promise<BehaviorIncidentRecord[]> {
  // Purge any legacy localStorage cache to guarantee 100% pure Supabase cloud storage
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('woodlem_student_behavior_incidents_v1');
    } catch {}
  }

  const incidentsMap = new Map<string, BehaviorIncidentRecord>();

  try {
    // 1. Primary Cloud Store: Supabase achievements table
    const { data: achData, error: achErr } = await supabase
      .from('achievements')
      .select('*')
      .eq('title', '__BEHAVIOR_INCIDENT__')
      .order('created_at', { ascending: false });

    if (!achErr && Array.isArray(achData)) {
      achData.forEach((row: any) => {
        if (row.desc_text) {
          try {
            const inc = JSON.parse(row.desc_text);
            if (inc && inc.id && !incidentsMap.has(inc.id)) {
              incidentsMap.set(inc.id, inc);
            }
          } catch (e) {}
        }
      });
    }

    // 2. Secondary Cloud Store: hub_activities master backup in Supabase
    try {
      const { data: hubData, error: hubErr } = await supabase
        .from('hub_activities')
        .select('description')
        .eq('id', BEHAVIOR_MASTER_CLOUD_ID)
        .maybeSingle();

      if (!hubErr && hubData?.description) {
        const parsedHub = JSON.parse(hubData.description);
        if (Array.isArray(parsedHub)) {
          parsedHub.forEach((inc: any) => {
            if (inc && inc.id && !incidentsMap.has(inc.id)) {
              incidentsMap.set(inc.id, inc);
            }
          });
        }
      }
    } catch (e) {}

    // 3. Tertiary Cloud Store: Native student_behavior_incidents table (if migrated)
    try {
      const { data: nativeData, error: nativeErr } = await supabase
        .from('student_behavior_incidents')
        .select('*')
        .order('created_at', { ascending: false });

      if (!nativeErr && Array.isArray(nativeData) && nativeData.length > 0) {
        nativeData.forEach((row: any) => {
          if (row.id && !incidentsMap.has(row.id)) {
            incidentsMap.set(row.id, {
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
              subject_name: row.subject || '',
              date: row.date || new Date().toISOString().slice(0, 10),
              incident_date: row.date || new Date().toISOString().slice(0, 10),
              incident_time: row.incident_time || '',
              created_at: row.created_at || new Date().toISOString(),
            });
          }
        });
      }
    } catch (err) {}
  } catch (err) {
    console.warn('Behavior incidents Supabase fetch notice:', err);
  }

  const result = Array.from(incidentsMap.values());
  result.sort((a, b) => new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime());
  return result;
}

/**
 * Persists an incident directly into Supabase Cloud.
 * Stored primarily in achievements with title '__BEHAVIOR_INCIDENT__' and
 * backed up synchronously in hub_activities master cloud record.
 * Absolutely NO localStorage used.
 */
export async function saveBehaviorIncident(
  incident: BehaviorIncidentRecord
): Promise<BehaviorIncidentRecord[]> {
  // Purge any legacy localStorage cache to guarantee 100% pure Supabase cloud storage
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('woodlem_student_behavior_incidents_v1');
    } catch {}
  }

  // 1. Primary Cloud Persistence: Supabase achievements table
  try {
    const achPayload = {
      id: incident.id,
      student_id: incident.student_id,
      title: '__BEHAVIOR_INCIDENT__',
      description: incident.reason,
      desc_text: JSON.stringify(incident),
      file_name: incident.teacher_name || 'Faculty Member',
      file_url: String(incident.points_deducted),
      created_at: incident.created_at || new Date().toISOString(),
    };

    const { error: achErr } = await supabase.from('achievements').upsert(achPayload);
    if (achErr) {
      console.warn('Initial achievements upsert FK notice, retrying with null student_id:', achErr);
      // If student_id FK constraint fails (e.g. custom/unmatched student id), retry with student_id: null
      const retryRes = await supabase.from('achievements').upsert({
        ...achPayload,
        student_id: null,
      });
      if (retryRes.error) {
        console.error('Supabase achievements fallback save error:', retryRes.error);
      }
    }
  } catch (err) {
    console.error('Supabase achievements behavior incident save error:', err);
  }

  // 2. Secondary Cloud Store: Redundant master backup in Supabase hub_activities
  try {
    const { data: hubData } = await supabase
      .from('hub_activities')
      .select('description')
      .eq('id', BEHAVIOR_MASTER_CLOUD_ID)
      .maybeSingle();

    let backupList: BehaviorIncidentRecord[] = [];
    if (hubData?.description) {
      try {
        const parsed = JSON.parse(hubData.description);
        if (Array.isArray(parsed)) backupList = parsed;
      } catch {}
    }

    backupList = backupList.filter((b) => b.id !== incident.id);
    backupList.unshift(incident);

    await supabase.from('hub_activities').upsert({
      id: BEHAVIOR_MASTER_CLOUD_ID,
      title: '__BEHAVIOR_MASTER_BACKUP__',
      type: 'system_config',
      description: JSON.stringify(backupList),
      date: new Date().toISOString().slice(0, 10),
      created_by: 'system',
    });
  } catch (err) {
    console.warn('Supabase hub_activities master backup save notice:', err);
  }

  // 3. Tertiary Cloud Store: Native student_behavior_incidents table (if migrated)
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
    // Native table might not be migrated yet
  }

  // Reload and return fresh records directly from Supabase Cloud
  return await loadBehaviorIncidents();
}

/**
 * Deletes / voids an incident directly from Supabase Cloud.
 */
export async function deleteBehaviorIncident(incidentId: string): Promise<BehaviorIncidentRecord[]> {
  // Purge any legacy localStorage cache
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('woodlem_student_behavior_incidents_v1');
    } catch {}
  }

  try {
    // Delete from Supabase achievements table
    await supabase.from('achievements').delete().eq('id', incidentId);
  } catch (err) {
    console.error('Supabase achievements behavior incident delete error:', err);
  }

  try {
    // Delete from native table if present
    await supabase.from('student_behavior_incidents').delete().eq('id', incidentId);
  } catch (err) {}

  try {
    // Update hub_activities master backup
    const { data: hubData } = await supabase
      .from('hub_activities')
      .select('description')
      .eq('id', BEHAVIOR_MASTER_CLOUD_ID)
      .maybeSingle();

    if (hubData?.description) {
      const parsed = JSON.parse(hubData.description);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter((b: any) => b.id !== incidentId);
        await supabase.from('hub_activities').upsert({
          id: BEHAVIOR_MASTER_CLOUD_ID,
          title: '__BEHAVIOR_MASTER_BACKUP__',
          type: 'system_config',
          description: JSON.stringify(filtered),
          date: new Date().toISOString().slice(0, 10),
          created_by: 'system',
        });
      }
    }
  } catch (err) {}

  // Reload fresh records directly from Supabase Cloud
  return await loadBehaviorIncidents();
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
