-- ==============================================================================
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

-- 4. Create Access Policies
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
