import { supabase, UserProfile } from './supabaseClient';

export const STUDENT_ADDITIONAL_INFO_CLOUD_ID = 'student_additional_info_master_v1';
export const STUDENT_ADDITIONAL_INFO_CACHE_KEY = 'woodlem_student_additional_info_v1';

export interface StudentAdditionalInfo {
  studentId?: string;
  admissionNumber?: string;
  email?: string;
  parent_email?: string;
  house_colour?: string;
  additional_info?: Record<string, any>;
}

export type StudentAdditionalInfoMap = Record<string, StudentAdditionalInfo>;

/**
 * Loads cached student additional info from browser localStorage
 */
export function loadLocalStudentAdditionalInfo(): StudentAdditionalInfoMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STUDENT_ADDITIONAL_INFO_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Saves cached student additional info to browser localStorage
 */
export function saveLocalStudentAdditionalInfo(map: StudentAdditionalInfoMap): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STUDENT_ADDITIONAL_INFO_CACHE_KEY, JSON.stringify(map));
  } catch {}
}

/**
 * Extracts and merges student additional info from Supabase hub_activities and local cache.
 */
export function extractStudentAdditionalInfoFromHub(
  hubActivities: any[] = []
): StudentAdditionalInfoMap {
  const merged: StudentAdditionalInfoMap = { ...loadLocalStudentAdditionalInfo() };

  (hubActivities || []).forEach((act) => {
    if (!act) return;

    // 1. Master backup bundle
    if (act.id === STUDENT_ADDITIONAL_INFO_CLOUD_ID && act.description) {
      try {
        const bundle = JSON.parse(act.description);
        if (bundle && typeof bundle === 'object') {
          Object.assign(merged, bundle);
        }
      } catch {}
    }

    // 2. Individual student record
    if (act.type === 'student_additional_info' && act.description) {
      try {
        const parsed = JSON.parse(act.description);
        const key = act.id.replace(/^stud_info_/, '');
        if (key && parsed) {
          merged[key] = { ...(merged[key] || {}), ...parsed };
          if (act.title && act.title.includes('@')) {
            merged[act.title.toLowerCase().trim()] = { ...(merged[act.title.toLowerCase().trim()] || {}), ...parsed };
          }
        }
      } catch {}
    }
  });

  saveLocalStudentAdditionalInfo(merged);
  return merged;
}

/**
 * Persists additional student info (parent_email, house_colour, extensible info)
 * to Supabase profiles (native columns if present), hub_activities (cloud resilience), and localStorage.
 */
export async function persistStudentAdditionalInfo(
  studentId: string,
  emailOrInfo: string | (StudentAdditionalInfo & { email?: string }),
  maybeInfo?: StudentAdditionalInfo
): Promise<void> {
  const cleanId = (studentId || '').trim();
  let cleanEmail = '';
  let info: StudentAdditionalInfo;

  if (typeof emailOrInfo === 'string') {
    cleanEmail = emailOrInfo.toLowerCase().trim();
    info = maybeInfo || {};
  } else {
    info = emailOrInfo || {};
    cleanEmail = ((emailOrInfo as any)?.email || '').toLowerCase().trim();
  }

  // 1. Update local cache immediately
  const localMap = loadLocalStudentAdditionalInfo();
  const cleanInfo: StudentAdditionalInfo = {
    parent_email: info.parent_email ? info.parent_email.trim().toLowerCase() : undefined,
    house_colour: info.house_colour ? info.house_colour.trim() : undefined,
    additional_info: info.additional_info || {},
  };

  if (cleanId) localMap[cleanId] = { ...(localMap[cleanId] || {}), ...cleanInfo };
  if (cleanEmail) localMap[cleanEmail] = { ...(localMap[cleanEmail] || {}), ...cleanInfo };
  saveLocalStudentAdditionalInfo(localMap);

  // 2. Attempt updating native columns in public.profiles
  try {
    const updatePayload: any = {};
    if (cleanInfo.parent_email !== undefined) updatePayload.parent_email = cleanInfo.parent_email;
    if (cleanInfo.house_colour !== undefined) updatePayload.house_colour = cleanInfo.house_colour;
    if (cleanInfo.additional_info !== undefined) updatePayload.additional_info = cleanInfo.additional_info;

    if (Object.keys(updatePayload).length > 0) {
      if (cleanId) {
        await supabase.from('profiles').update(updatePayload).eq('id', cleanId);
      } else if (cleanEmail) {
        await supabase.from('profiles').update(updatePayload).eq('email', cleanEmail);
      }
    }
  } catch (nativeErr) {
    // Native columns might not be migrated yet in Supabase; fail soft and continue to hub fallback
  }

  // 3. Persist individual record to hub_activities
  try {
    const hubId = `stud_info_${cleanId || cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const hubRow = {
      id: hubId,
      title: cleanEmail || cleanId,
      type: 'student_additional_info',
      description: JSON.stringify(cleanInfo),
      date: new Date().toISOString().split('T')[0],
      created_by: 'admin',
      created_at: new Date().toISOString(),
    };
    await supabase.from('hub_activities').upsert([hubRow], { onConflict: 'id' });
  } catch (hubErr) {
    console.warn('hub_activities student additional info save warn:', hubErr);
  }

  // 4. Update master bundle in hub_activities asynchronously
  try {
    const bundleRow = {
      id: STUDENT_ADDITIONAL_INFO_CLOUD_ID,
      title: '__STUDENT_ADDITIONAL_INFO_MASTER__',
      type: 'system_config',
      description: JSON.stringify(localMap),
      date: new Date().toISOString().split('T')[0],
      created_by: 'system_admin',
      created_at: new Date().toISOString(),
    };
    await supabase.from('hub_activities').upsert([bundleRow], { onConflict: 'id' });
  } catch {}
}

/**
 * Finds all active students linked to a specific parent email.
 */
export function getStudentsForParentEmail(
  parentEmail: string,
  profiles: UserProfile[],
  infoMap?: StudentAdditionalInfoMap
): UserProfile[] {
  const cleanTarget = (parentEmail || '').trim().toLowerCase();
  if (!cleanTarget) return [];

  const map = infoMap || loadLocalStudentAdditionalInfo();

  return profiles.filter((p) => {
    if (p.role !== 'student' || p.is_deactivated) return false;

    // Direct profile column
    const directEmail = (p.parent_email || '').trim().toLowerCase();
    if (directEmail && directEmail === cleanTarget) return true;

    // From additional info map by ID
    const infoById = p.id ? map[p.id] : undefined;
    if (infoById?.parent_email && infoById.parent_email.trim().toLowerCase() === cleanTarget) {
      return true;
    }

    // From additional info map by email
    const pEmail = (p.email || '').trim().toLowerCase();
    const infoByEmail = pEmail ? map[pEmail] : undefined;
    if (infoByEmail?.parent_email && infoByEmail.parent_email.trim().toLowerCase() === cleanTarget) {
      return true;
    }

    return false;
  });
}
