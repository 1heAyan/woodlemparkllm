-- ==============================================================================
-- Woodlem Park LMS: Account Creation & User Management — Phase 1
-- Run in Supabase SQL Editor (idempotent, re-runnable).
-- ==============================================================================

-- 1. Add student additional info columns to public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS parent_email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS house_colour TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS additional_info JSONB DEFAULT '{}'::JSONB;

-- 2. Create index for fast parent-student lookups by parent email
CREATE INDEX IF NOT EXISTS idx_profiles_parent_email ON public.profiles (parent_email);
CREATE INDEX IF NOT EXISTS idx_profiles_house_colour ON public.profiles (house_colour);

-- 3. Ensure full RLS access for public profiles updates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' AND policyname = 'Public update profiles'
  ) THEN
    CREATE POLICY "Public update profiles" 
    ON public.profiles FOR UPDATE 
    USING (true) WITH CHECK (true);
  END IF;
END $$;
