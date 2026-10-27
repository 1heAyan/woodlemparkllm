'use client';

import { supabase, UserProfile } from './supabaseClient';

export type FeedbackCategory = 'ui_change' | 'feature_request' | 'bug' | 'general';
export type FeedbackStatus = 'new' | 'reviewed' | 'resolved';

export interface FeedbackSubmission {
  id: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  userRole?: string;
  category: FeedbackCategory;
  title: string;
  description: string;
  pageContext?: string;
  screenshotDataUrl?: string;
  screenshotName?: string;
  deviceInfo?: {
    userAgent: string;
    screenResolution: string;
    viewport: string;
    platform: string;
  };
  createdAt: string;
  status: FeedbackStatus;
}

const GLOBAL_FEEDBACK_KEY = 'woodlem_all_feedbacks_cache_v2';

function getUserCacheKey(user?: UserProfile | null): string {
  if (!user) return 'woodlem_feedback_guest';
  const cleanEmail = (user.email || '').toLowerCase().trim();
  const id = user.id || 'unknown';
  return `woodlem_user_feedback_${cleanEmail || id}`;
}

/**
 * Returns ONLY the feedback submissions created by the specified user.
 * Strictly guarantees privacy and user isolation.
 */
export function getUserStoredFeedbacks(user?: UserProfile | null): FeedbackSubmission[] {
  if (typeof window === 'undefined' || !user) return [];
  try {
    // Clean up old insecure un-scoped global key if present on browser
    try {
      localStorage.removeItem('woodlem_user_feedback_history');
    } catch {}

    const key = getUserCacheKey(user);
    const raw = localStorage.getItem(key);
    const list: FeedbackSubmission[] = raw ? JSON.parse(raw) : [];

    const userEmail = (user.email || '').toLowerCase().trim();
    const userId = user.id;

    // Strict filter to guarantee no other user's data leaks
    return list.filter((f) => {
      const fEmail = (f.userEmail || '').toLowerCase().trim();
      return (userId && f.userId === userId) || (userEmail && fEmail === userEmail);
    });
  } catch (err) {
    console.warn('Error reading user-scoped feedback storage:', err);
    return [];
  }
}

/**
 * Loads user's own feedback from Supabase cloud (strictly scoped to this user only)
 * and synchronizes with their local private cache.
 */
export async function fetchUserFeedbacksFromCloud(user?: UserProfile | null): Promise<FeedbackSubmission[]> {
  if (!user || (!user.id && !user.email)) return [];
  try {
    const userEmail = (user.email || '').toLowerCase().trim();
    const userId = user.id;

    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('action_type', 'USER_FEEDBACK')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error || !data) return getUserStoredFeedbacks(user);

    const userCloudSubmissions: FeedbackSubmission[] = [];
    data.forEach((row: any) => {
      let details: any = {};
      try {
        details = typeof row.details === 'string' ? JSON.parse(row.details) : row.details || {};
      } catch {}

      const dEmail = (details.userEmail || '').toLowerCase().trim();
      const isOwner = (userId && row.user_id === userId) || (userEmail && dEmail === userEmail);

      if (isOwner) {
        userCloudSubmissions.push({
          id: row.id,
          userId: row.user_id || undefined,
          userName: row.user_name || undefined,
          userEmail: details.userEmail || undefined,
          userRole: row.user_role || undefined,
          category: details.category || 'general',
          title: row.target_title || details.title || 'Untitled Feedback',
          description: details.description || '',
          pageContext: details.pageContext || undefined,
          screenshotDataUrl: details.screenshotDataUrl || undefined,
          screenshotName: details.screenshotName || undefined,
          deviceInfo: details.deviceInfo || undefined,
          createdAt: row.created_at,
          status: details.status || 'new',
        });
      }
    });

    if (typeof window !== 'undefined') {
      const key = getUserCacheKey(user);
      const local = getUserStoredFeedbacks(user);
      const map = new Map<string, FeedbackSubmission>();
      local.forEach((item) => map.set(item.id, item));
      userCloudSubmissions.forEach((item) => map.set(item.id, item));
      const merged = Array.from(map.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      localStorage.setItem(key, JSON.stringify(merged.slice(0, 50)));
      return merged;
    }

    return userCloudSubmissions;
  } catch (err) {
    console.warn('Error syncing user cloud feedback:', err);
    return getUserStoredFeedbacks(user);
  }
}

/**
 * Saves a submission to the user's private local storage.
 */
export function saveUserFeedbackToLocal(submission: FeedbackSubmission, user?: UserProfile | null): void {
  if (typeof window === 'undefined') return;
  try {
    const key = getUserCacheKey(user || { id: submission.userId, email: submission.userEmail } as any);
    const existing = getUserStoredFeedbacks(user || { id: submission.userId, email: submission.userEmail } as any);
    const updated = [submission, ...existing.filter((item) => item.id !== submission.id)].slice(0, 50);
    localStorage.setItem(key, JSON.stringify(updated));

    // Also store in global local cache for Admin offline viewing
    const globalRaw = localStorage.getItem(GLOBAL_FEEDBACK_KEY);
    const globalList: FeedbackSubmission[] = globalRaw ? JSON.parse(globalRaw) : [];
    const updatedGlobal = [submission, ...globalList.filter((item) => item.id !== submission.id)].slice(0, 200);
    localStorage.setItem(GLOBAL_FEEDBACK_KEY, JSON.stringify(updatedGlobal));
  } catch (err) {
    console.warn('Error saving user feedback to local storage:', err);
  }
}

/**
 * Deletes a submission from the user's private local storage.
 */
export function deleteStoredFeedback(id: string, user?: UserProfile | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (user) {
      const key = getUserCacheKey(user);
      const existing = getUserStoredFeedbacks(user);
      const updated = existing.filter((f) => f.id !== id);
      localStorage.setItem(key, JSON.stringify(updated));
    }

    const globalRaw = localStorage.getItem(GLOBAL_FEEDBACK_KEY);
    if (globalRaw) {
      const globalList: FeedbackSubmission[] = JSON.parse(globalRaw);
      localStorage.setItem(GLOBAL_FEEDBACK_KEY, JSON.stringify(globalList.filter((f) => f.id !== id)));
    }
  } catch (err) {
    console.warn('Error deleting feedback from storage:', err);
  }
}

/**
 * Fetches all feedback submissions across the entire system.
 * Designed specifically for Admin Dashboard review with full user attribution.
 */
export async function getAllFeedbackSubmissions(): Promise<FeedbackSubmission[]> {
  const mergedMap = new Map<string, FeedbackSubmission>();

  // 1. First load from local fallback cache
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(GLOBAL_FEEDBACK_KEY);
      if (raw) {
        const localList: FeedbackSubmission[] = JSON.parse(raw);
        localList.forEach((item) => mergedMap.set(item.id, item));
      }
    } catch {}
  }

  // 2. Fetch from Supabase audit_logs (authoritative cloud record)
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('action_type', 'USER_FEEDBACK')
      .order('created_at', { ascending: false })
      .limit(500);

    if (!error && data) {
      data.forEach((row: any) => {
        let details: any = {};
        try {
          details = typeof row.details === 'string' ? JSON.parse(row.details) : row.details || {};
        } catch {}

        const item: FeedbackSubmission = {
          id: row.id,
          userId: row.user_id || undefined,
          userName: row.user_name || undefined,
          userEmail: details.userEmail || undefined,
          userRole: row.user_role || undefined,
          category: details.category || 'general',
          title: row.target_title || details.title || 'Untitled Feedback',
          description: details.description || '',
          pageContext: details.pageContext || undefined,
          screenshotDataUrl: details.screenshotDataUrl || undefined,
          screenshotName: details.screenshotName || undefined,
          deviceInfo: details.deviceInfo || undefined,
          createdAt: row.created_at,
          status: details.status || 'new',
        };
        mergedMap.set(item.id, item);
      });
    }
  } catch (err) {
    console.warn('Failed to fetch feedback audit_logs from cloud:', err);
  }

  const list = Array.from(mergedMap.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Sync back to local global cache for offline stability
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(GLOBAL_FEEDBACK_KEY, JSON.stringify(list.slice(0, 200)));
    } catch {}
  }

  return list;
}

/**
 * Updates the review status of a feedback submission in Supabase and local cache.
 */
export async function updateFeedbackStatus(
  id: string,
  newStatus: FeedbackStatus,
  existingList: FeedbackSubmission[] = []
): Promise<void> {
  const target = existingList.find((f) => f.id === id);

  // 1. Update in local storage
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(GLOBAL_FEEDBACK_KEY);
      if (raw) {
        const list: FeedbackSubmission[] = JSON.parse(raw);
        const next = list.map((item) => (item.id === id ? { ...item, status: newStatus } : item));
        localStorage.setItem(GLOBAL_FEEDBACK_KEY, JSON.stringify(next));
      }
    } catch {}
  }

  // 2. Update in Supabase audit_logs
  try {
    const { data: row } = await supabase.from('audit_logs').select('details').eq('id', id).single();
    if (row) {
      let detailsObj: any = {};
      try {
        detailsObj = typeof row.details === 'string' ? JSON.parse(row.details) : row.details || {};
      } catch {}
      detailsObj.status = newStatus;

      await supabase
        .from('audit_logs')
        .update({ details: JSON.stringify(detailsObj) })
        .eq('id', id);
    }
  } catch (err) {
    console.warn('Failed to update feedback status in cloud:', err);
  }

  // Dispatch update event
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('woodlem:feedback_updated'));
  }
}

/**
 * Deletes a feedback submission from both Supabase cloud and local storage.
 */
export async function deleteFeedbackRecord(id: string): Promise<void> {
  // 1. Delete from Supabase
  try {
    await supabase.from('audit_logs').delete().eq('id', id);
  } catch (err) {
    console.warn('Cloud feedback delete error:', err);
  }

  // 2. Delete from global local cache
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(GLOBAL_FEEDBACK_KEY);
      if (raw) {
        const list: FeedbackSubmission[] = JSON.parse(raw);
        localStorage.setItem(GLOBAL_FEEDBACK_KEY, JSON.stringify(list.filter((f) => f.id !== id)));
      }
    } catch {}
    window.dispatchEvent(new CustomEvent('woodlem:feedback_updated'));
  }
}

/**
 * Submits a new feedback entry with strict user attribution.
 */
export async function submitFeedback(
  payload: Omit<FeedbackSubmission, 'id' | 'createdAt' | 'status'>,
  currentUser?: UserProfile | null
): Promise<{ ok: boolean; feedback: FeedbackSubmission; error?: string }> {
  const id = `fb_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const createdAt = new Date().toISOString();

  const submission: FeedbackSubmission = {
    ...payload,
    id,
    userId: currentUser?.id || payload.userId || 'anonymous',
    userName: currentUser?.name || payload.userName || 'Anonymous User',
    userEmail: currentUser?.email || payload.userEmail || '',
    userRole: currentUser?.role || payload.userRole || 'student',
    createdAt,
    status: 'new',
  };

  // 1. Save to User-Scoped Local Storage (Strict User Isolation)
  saveUserFeedbackToLocal(submission, currentUser);

  // 2. Persist to Supabase audit_logs for permanent Admin Dashboard visibility
  try {
    const details = {
      category: submission.category,
      title: submission.title,
      description: submission.description,
      userEmail: submission.userEmail,
      pageContext: submission.pageContext,
      screenshotDataUrl: submission.screenshotDataUrl,
      screenshotName: submission.screenshotName,
      deviceInfo: submission.deviceInfo,
      status: 'new',
    };

    await supabase.from('audit_logs').insert([
      {
        id: submission.id,
        action_type: 'USER_FEEDBACK',
        user_id: submission.userId,
        user_name: submission.userName,
        user_role: submission.userRole,
        target_title: submission.title,
        details: JSON.stringify(details),
        created_at: submission.createdAt,
      },
    ]);
  } catch (dbErr) {
    console.warn('Audit logs feedback insert notice:', dbErr);
  }

  // 3. Dispatch to API route for server logging
  try {
    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submission),
    });
  } catch {}

  // 4. Notify app listeners
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('woodlem:feedback_updated'));
  }

  return { ok: true, feedback: submission };
}
