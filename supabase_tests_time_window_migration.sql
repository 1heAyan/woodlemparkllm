-- Migration: Test availability window (start_time / deadline)
-- Run this in the Supabase SQL Editor against your project database.
-- These columns let teachers time-bound a class test: the test is only
-- attemptable between start_time and deadline. Outside the window students
-- see "Coming Soon" or "Past Deadline".
ALTER TABLE public.tests ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.tests ADD COLUMN IF NOT EXISTS deadline TIMESTAMPTZ DEFAULT NULL;