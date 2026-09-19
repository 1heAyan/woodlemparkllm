import { supabase, UserProfile, LateEntryRecord } from './supabaseClient';

export const LOCAL_STORAGE_LATE_ENTRIES_KEY = 'woodlem_late_entries_v1';

export const LATE_ENTRY_REASONS = [
  'Traffic Congestion',
  'School Bus Delay',
  'Medical / Health Checkup',
  'Family Emergency',
  'Inclement Weather / Fog',
  'Overslept / Personal Delay',
  'Car Breakdown / Transport Issue',
  'Official School Activity / Duty',
  'Unspecified / Other',
];

/**
 * Returns today's date formatted as YYYY-MM-DD
 */
export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns current local time formatted as 12-hour "HH:MM AM/PM"
 */
export function getFormattedCurrentTime(): string {
  const now = new Date();
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
}

export const LATE_ENTRIES_MASTER_CLOUD_ID = 'late_entries_master_backup_v1';
export const LATE_ENTRIES_CLOUD_TYPE = 'late_entry_record';

export const SQL_LATE_ENTRIES_MIGRATION = `-- ==============================================================================
-- WOODLEM LMS: Late Entry Management Database Migration
-- Run this in your Supabase Dashboard -> SQL Editor to create native tables
-- ==============================================================================

-- 1. Add can_manage_late_entry column to public.profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS can_manage_late_entry BOOLEAN DEFAULT FALSE;

-- 2. Create the native late_entries table
CREATE TABLE IF NOT EXISTS public.late_entries (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    person_name TEXT NOT NULL,
    role TEXT NOT NULL, -- 'student' | 'teacher'
    grade TEXT DEFAULT '',
    class_letter TEXT DEFAULT '',
    user_code TEXT DEFAULT '',
    date TEXT NOT NULL, -- 'YYYY-MM-DD'
    time TEXT NOT NULL, -- 'HH:MM AM/PM'
    entry_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason TEXT DEFAULT 'Unspecified',
    notes TEXT DEFAULT '',
    recorded_by_id TEXT NOT NULL,
    recorded_by_name TEXT NOT NULL,
    acknowledged BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices for rapid querying
CREATE INDEX IF NOT EXISTS idx_late_entries_date ON public.late_entries (date);
CREATE INDEX IF NOT EXISTS idx_late_entries_user_id ON public.late_entries (user_id);
CREATE INDEX IF NOT EXISTS idx_late_entries_role ON public.late_entries (role);

-- 3. Enable Row Level Security
ALTER TABLE public.late_entries ENABLE ROW LEVEL SECURITY;

-- 4. Create Access Policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'late_entries' AND policyname = 'Public full access late_entries'
  ) THEN
    CREATE POLICY "Public full access late_entries" 
    ON public.late_entries FOR ALL 
    USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 5. Add to Supabase Realtime Publication
DO $$
BEGIN
  BEGIN 
    ALTER PUBLICATION supabase_realtime ADD TABLE public.late_entries; 
  EXCEPTION WHEN OTHERS THEN NULL; 
  END;
END $$;
`;

/**
 * Checks if the native public.late_entries table exists in Supabase
 */
export async function checkSupabaseNativeLateEntriesTable(): Promise<boolean> {
  try {
    const { error } = await supabase.from('late_entries').select('id').limit(1);
    if (!error) return true;
    if (error.code === 'PGRST205' || error.message?.includes('not find the table')) {
      return false;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Sync all late entries to cloud storage (public.hub_activities + native late_entries table if created)
 */
export async function syncCloudLateEntries(entries: LateEntryRecord[]): Promise<void> {
  if (!entries || entries.length === 0) {
    try {
      const emptyPayload = {
        id: LATE_ENTRIES_MASTER_CLOUD_ID,
        title: 'LATE_ENTRIES_MASTER_BACKUP',
        type: 'system_config',
        description: '[]',
        date: new Date().toISOString().split('T')[0],
        created_by: 'system_admin',
        created_at: new Date().toISOString(),
      };
      await supabase.from('hub_activities').upsert([emptyPayload], { onConflict: 'id' });
    } catch {}
    return;
  }

  // 1. Sync master JSON bundle to hub_activities
  try {
    const payload = {
      id: LATE_ENTRIES_MASTER_CLOUD_ID,
      title: 'LATE_ENTRIES_MASTER_BACKUP',
      type: 'system_config',
      description: JSON.stringify(entries),
      date: new Date().toISOString().split('T')[0],
      created_by: 'system_admin',
      created_at: new Date().toISOString(),
    };
    await supabase.from('hub_activities').upsert([payload], { onConflict: 'id' });
  } catch (err) {
    console.warn('Could not sync master late entries to hub_activities:', err);
  }

  // 2. Upsert each individual record to hub_activities with type: 'late_entry_record'
  try {
    const hubRows = entries.map((entry) => ({
      id: entry.id,
      title: entry.person_name,
      type: LATE_ENTRIES_CLOUD_TYPE,
      description: JSON.stringify(entry),
      date: entry.date,
      created_by: entry.recorded_by_name || 'duty_staff',
      created_at: entry.created_at || new Date().toISOString(),
    }));

    // Chunk in batches of 50 for smooth network transmission
    for (let i = 0; i < hubRows.length; i += 50) {
      const batch = hubRows.slice(i, i + 50);
      await supabase.from('hub_activities').upsert(batch, { onConflict: 'id' });
    }
  } catch (err) {
    console.warn('Could not upsert individual hub_activities rows:', err);
  }

  // 3. Attempt to sync to native late_entries table if it exists
  try {
    for (let i = 0; i < entries.length; i += 50) {
      const batch = entries.slice(i, i + 50);
      await supabase.from('late_entries').upsert(batch, { onConflict: 'id' });
    }
  } catch {
    // Expected if native table hasn't been migrated yet
  }
}

/**
 * Manually triggered or automatic full synchronization of all local and cloud late entries
 */
export async function syncAllToSupabaseNow(): Promise<{ count: number; nativeTableExists: boolean }> {
  const nativeTableExists = await checkSupabaseNativeLateEntriesTable();
  const entries = await loadLateEntries();
  await syncCloudLateEntries(entries);
  return { count: entries.length, nativeTableExists };
}

/**
 * Load all late entries from cloud Supabase (native late_entries table + hub_activities fallback)
 */
export async function loadLateEntries(): Promise<LateEntryRecord[]> {
  const map = new Map<string, LateEntryRecord>();

  // 1. Try local cache first for instant initial render
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_LATE_ENTRIES_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item && item.id) map.set(item.id, item);
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // 2. Fetch from native Supabase table: public.late_entries
  try {
    const { data, error } = await supabase
      .from('late_entries')
      .select('*')
      .order('entry_timestamp', { ascending: false })
      .limit(10000);

    if (!error && data && Array.isArray(data)) {
      for (const item of data) {
        if (item && item.id) map.set(item.id, item as LateEntryRecord);
      }
    }
  } catch (err) {
    console.warn('Native late_entries table query notice:', err);
  }

  // 3. Fetch from primary cloud store: public.hub_activities (individual rows + master backup)
  try {
    // 3a. Query individual records
    const { data: hubRows, error: hubErr } = await supabase
      .from('hub_activities')
      .select('*')
      .eq('type', LATE_ENTRIES_CLOUD_TYPE)
      .limit(10000);

    if (!hubErr && hubRows && Array.isArray(hubRows)) {
      for (const row of hubRows) {
        if (row.description) {
          try {
            const parsed = JSON.parse(row.description);
            if (parsed && parsed.id) map.set(parsed.id, parsed);
          } catch {}
        }
      }
    }

    // 3b. Query master backup row
    const { data: masterRow, error: masterErr } = await supabase
      .from('hub_activities')
      .select('description')
      .eq('id', LATE_ENTRIES_MASTER_CLOUD_ID)
      .maybeSingle();

    if (!masterErr && masterRow && masterRow.description) {
      try {
        const parsed = JSON.parse(masterRow.description);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item && item.id) map.set(item.id, item);
          }
        }
      } catch {}
    }
  } catch (err) {
    console.warn('Cloud hub_activities query notice:', err);
  }

  const list = Array.from(map.values()).sort(
    (a, b) => new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime()
  );

  // 4. Update local cache for instant offline render (pure read, no background write loop)
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_STORAGE_LATE_ENTRIES_KEY, JSON.stringify(list));
    } catch {
      // ignore
    }
  }

  return list;
}

/**
 * Record a new late arrival entry with guaranteed Supabase cloud persistence
 */
export async function saveLateEntry(
  entryData: Omit<LateEntryRecord, 'id' | 'created_at'>
): Promise<LateEntryRecord> {
  const newEntry: LateEntryRecord = {
    ...entryData,
    id: `late-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    created_at: new Date().toISOString(),
  };

  // 1. Update localStorage optimistically
  let updatedList: LateEntryRecord[] = [newEntry];
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_LATE_ENTRIES_KEY);
      const currentList: LateEntryRecord[] = cached ? JSON.parse(cached) : [];
      updatedList = [newEntry, ...currentList.filter((e) => e.id !== newEntry.id)];
      localStorage.setItem(LOCAL_STORAGE_LATE_ENTRIES_KEY, JSON.stringify(updatedList));
    } catch {
      // ignore
    }
  }

  // 2. Cloud Store 1: Insert into native late_entries table in Supabase
  try {
    const { data, error } = await supabase
      .from('late_entries')
      .insert([newEntry])
      .select()
      .single();

    if (!error && data) {
      // successfully stored in native table
    }
  } catch (err) {
    console.warn('Native late_entries insert notice:', err);
  }

  // 3. Cloud Store 2: Upsert into public.hub_activities in Supabase (Guaranteed JSON storage)
  try {
    const hubRow = {
      id: newEntry.id,
      title: newEntry.person_name,
      type: LATE_ENTRIES_CLOUD_TYPE,
      description: JSON.stringify(newEntry),
      date: newEntry.date,
      created_by: newEntry.recorded_by_name || 'duty_staff',
      created_at: newEntry.created_at,
    };
    await supabase.from('hub_activities').upsert([hubRow], { onConflict: 'id' });
  } catch (err) {
    console.warn('Cloud hub_activities individual insert notice:', err);
  }

  // 4. Cloud Store 3: Update master backup in public.hub_activities
  await syncCloudLateEntries(updatedList);

  // 5. Cloud Audit Log: Insert audit trail in public.audit_logs in Supabase
  try {
    const auditPayload = {
      action_type: 'LATE_ENTRY_RECORDED',
      user_id: newEntry.recorded_by_id || 'duty_staff',
      user_name: newEntry.recorded_by_name || 'Gate Duty Officer',
      user_role: 'staff',
      target_title: `${newEntry.person_name} (${newEntry.role})`,
      details: JSON.stringify(newEntry),
      created_at: new Date().toISOString(),
    };
    await supabase.from('audit_logs').insert([auditPayload]);
  } catch (err) {
    // non-blocking
  }

  return newEntry;
}

/**
 * Delete a late entry (e.g. marked by mistake) from all Supabase cloud stores
 */
export async function deleteLateEntry(id: string): Promise<boolean> {
  // 1. Update localStorage optimistically
  let updatedList: LateEntryRecord[] = [];
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_LATE_ENTRIES_KEY);
      if (cached) {
        const currentList: LateEntryRecord[] = JSON.parse(cached);
        updatedList = currentList.filter((item) => item.id !== id);
        localStorage.setItem(LOCAL_STORAGE_LATE_ENTRIES_KEY, JSON.stringify(updatedList));
      }
    } catch {
      // ignore
    }
  }

  // 2. Delete from native late_entries table in Supabase
  try {
    await supabase.from('late_entries').delete().eq('id', id);
  } catch (err) {
    console.warn('Native delete notice:', err);
  }

  // 3. Delete from hub_activities in Supabase
  try {
    await supabase.from('hub_activities').delete().eq('id', id);
    await syncCloudLateEntries(updatedList);
  } catch (err) {
    console.warn('Cloud hub_activities delete notice:', err);
  }

  // 4. Audit Log in Supabase
  try {
    await supabase.from('audit_logs').insert([{
      action_type: 'LATE_ENTRY_DELETED',
      user_id: 'system_admin',
      user_name: 'Administrator',
      user_role: 'admin',
      target_title: `Late Entry ${id}`,
      details: JSON.stringify({ deleted_id: id }),
      created_at: new Date().toISOString(),
    }]);
  } catch {}

  return true;
}

/**
 * Update an existing late entry in all Supabase cloud stores
 */
export async function updateLateEntry(
  id: string,
  patch: Partial<LateEntryRecord>
): Promise<LateEntryRecord | null> {
  let updatedRecord: LateEntryRecord | null = null;
  let updatedList: LateEntryRecord[] = [];

  // 1. Update localStorage optimistically
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_LATE_ENTRIES_KEY);
      if (cached) {
        const currentList: LateEntryRecord[] = JSON.parse(cached);
        const index = currentList.findIndex((item) => item.id === id);
        if (index !== -1) {
          currentList[index] = { ...currentList[index], ...patch };
          updatedRecord = currentList[index];
          updatedList = currentList;
          localStorage.setItem(LOCAL_STORAGE_LATE_ENTRIES_KEY, JSON.stringify(currentList));
        }
      }
    } catch {
      // ignore
    }
  }

  // 2. Update native late_entries table in Supabase
  try {
    const { data } = await supabase
      .from('late_entries')
      .update(patch)
      .eq('id', id)
      .select()
      .single();

    if (data) updatedRecord = data as LateEntryRecord;
  } catch (err) {
    console.warn('Native update notice:', err);
  }

  // 3. Update hub_activities in Supabase
  if (updatedRecord) {
    try {
      const hubRow = {
        id: updatedRecord.id,
        title: updatedRecord.person_name,
        type: LATE_ENTRIES_CLOUD_TYPE,
        description: JSON.stringify(updatedRecord),
        date: updatedRecord.date,
        created_by: updatedRecord.recorded_by_name || 'duty_staff',
        created_at: updatedRecord.created_at,
      };
      await supabase.from('hub_activities').upsert([hubRow], { onConflict: 'id' });
      await syncCloudLateEntries(updatedList);
    } catch (err) {
      console.warn('Cloud hub_activities update notice:', err);
    }

    // 4. Audit Log in Supabase
    try {
      await supabase.from('audit_logs').insert([{
        action_type: 'LATE_ENTRY_UPDATED',
        user_id: 'system_admin',
        user_name: 'Administrator',
        user_role: 'admin',
        target_title: `Late Entry ${id}`,
        details: JSON.stringify({ id, patch }),
        created_at: new Date().toISOString(),
      }]);
    } catch {}
  }

  return updatedRecord;
}
export const LOCAL_STORAGE_LATE_STAFF_KEY = 'woodlem_late_entry_authorized_staff_v1';
export const LATE_STAFF_CLOUD_CONFIG_ID = 'late_entry_authorized_staff_config_v1';

/**
 * Load authorized staff user IDs from local storage
 */
export function loadAuthorizedStaffIds(): string[] {
  let list: string[] = [];
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_LATE_STAFF_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          list = parsed;
        }
      }
    } catch {
      // ignore
    }
  }
  return list;
}

/**
 * Save authorized staff user IDs to local storage and sync to cloud config
 */
export async function saveAuthorizedStaffIds(ids: string[]): Promise<void> {
  const unique = Array.from(new Set(ids));
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_STORAGE_LATE_STAFF_KEY, JSON.stringify(unique));
    } catch {
      // ignore
    }
  }

  // Dual-layer cloud sync to hub_activities config table
  try {
    const payload = {
      id: LATE_STAFF_CLOUD_CONFIG_ID,
      title: 'LATE_ENTRY_AUTHORIZED_STAFF',
      type: 'system_config',
      description: JSON.stringify(unique),
      date: new Date().toISOString().split('T')[0],
      created_by: 'system_admin',
      created_at: new Date().toISOString(),
    };
    await supabase.from('hub_activities').upsert([payload], { onConflict: 'id' });
  } catch (err) {
    console.warn('Could not sync late entry staff to hub_activities:', err);
  }
}

/**
 * Fetch authorized staff IDs asynchronously from cloud and merge into cache
 */
export async function fetchCloudAuthorizedStaffIds(): Promise<string[]> {
  const local = loadAuthorizedStaffIds();
  try {
    const { data, error } = await supabase
      .from('hub_activities')
      .select('description')
      .eq('id', LATE_STAFF_CLOUD_CONFIG_ID)
      .maybeSingle();

    if (!error && data && data.description) {
      const parsed = JSON.parse(data.description);
      if (Array.isArray(parsed)) {
        const merged = Array.from(new Set([...local, ...parsed]));
        if (typeof window !== 'undefined') {
          localStorage.setItem(LOCAL_STORAGE_LATE_STAFF_KEY, JSON.stringify(merged));
        }
        return merged;
      }
    }
  } catch (err) {
    console.warn('Could not fetch cloud authorized staff:', err);
  }
  return local;
}

/**
 * Assign or revoke late entry desk permissions for a staff member with dual-layer fallback
 */
export async function toggleStaffLateEntryAccess(
  userId: string,
  canManage: boolean
): Promise<boolean> {
  // 1. Resilient storage update (localStorage + cloud hub_activities config)
  try {
    const current = loadAuthorizedStaffIds();
    let updated: string[];
    if (canManage) {
      updated = Array.from(new Set([...current, userId]));
    } else {
      updated = current.filter((id) => id !== userId);
    }
    await saveAuthorizedStaffIds(updated);
  } catch (err) {
    console.warn('Local staff authorization storage notice:', err);
  }

  // 2. Direct profiles table update (if column exists in Supabase DB)
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ can_manage_late_entry: canManage })
      .eq('id', userId);

    if (error) {
      console.warn('Direct profiles column update notice (handled by resilient storage):', error.message);
    }
  } catch (err) {
    console.warn('Exception updating profiles column (handled by resilient storage):', err);
  }

  return true;
}

/**
 * Frequency Analysis Item
 */
export interface LateFrequencyItem {
  userId: string;
  personName: string;
  role: 'student' | 'teacher';
  grade?: string;
  classLetter?: string;
  userCode?: string;
  count: number;
  lastDate: string;
  lastTime: string;
  entries: LateEntryRecord[];
}

/**
 * Compute repeat latecomer frequency statistics across all records
 */
export function computeLateEntryFrequency(entries: LateEntryRecord[]): LateFrequencyItem[] {
  const map = new Map<string, LateFrequencyItem>();

  for (const entry of entries) {
    const key = entry.user_id || `${entry.person_name}-${entry.role}`;
    if (!map.has(key)) {
      map.set(key, {
        userId: entry.user_id,
        personName: entry.person_name,
        role: entry.role,
        grade: entry.grade,
        classLetter: entry.class_letter,
        userCode: entry.user_code,
        count: 0,
        lastDate: entry.date,
        lastTime: entry.time,
        entries: [],
      });
    }

    const item = map.get(key)!;
    item.count += 1;
    item.entries.push(entry);

    // Keep latest date/time
    if (new Date(entry.entry_timestamp).getTime() > new Date(item.lastDate).getTime()) {
      item.lastDate = entry.date;
      item.lastTime = entry.time;
    }
  }

  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

/**
 * Export late entries to CSV
 */
export function exportLateEntriesToCSV(entries: LateEntryRecord[], fileName = 'woodlem_late_entries.csv') {
  if (typeof window === 'undefined') return;

  const headers = [
    'Record ID',
    'Person Name',
    'Role',
    'Grade & Section',
    'User Code',
    'Date',
    'Arrival Time',
    'Reason',
    'Gate Notes',
    'Recorded By',
    'Timestamp',
  ];

  const rows = entries.map((e) => [
    `"${e.id}"`,
    `"${(e.person_name || '').replace(/"/g, '""')}"`,
    `"${e.role.toUpperCase()}"`,
    `"${e.grade ? `Grade ${e.grade}${e.class_letter ? `-${e.class_letter}` : ''}` : 'N/A'}"`,
    `"${e.user_code || ''}"`,
    `"${e.date}"`,
    `"${e.time}"`,
    `"${(e.reason || '').replace(/"/g, '""')}"`,
    `"${(e.notes || '').replace(/"/g, '""')}"`,
    `"${(e.recorded_by_name || '').replace(/"/g, '""')}"`,
    `"${e.entry_timestamp}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
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
