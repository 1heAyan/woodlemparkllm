import { supabase, UserProfile } from '@/lib/supabaseClient';

/**
 * Retrieves the cached password for a user from local storage (if any).
 */
export function getCachedPassword(userId?: string, email?: string): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const cleanEmail = (email || '').toLowerCase().trim();
    if (cleanEmail) {
      const byEmail = localStorage.getItem(`woodlem_pwd_${cleanEmail}`);
      if (byEmail && byEmail.trim()) return byEmail.trim();
    }
    if (userId) {
      const byId = localStorage.getItem(`woodlem_pwd_${userId}`);
      if (byId && byId.trim()) return byId.trim();
    }
    const credsStr = localStorage.getItem('woodlem_user_credentials');
    if (credsStr) {
      const creds = JSON.parse(credsStr);
      if (cleanEmail && creds[cleanEmail] && creds[cleanEmail].trim()) return creds[cleanEmail].trim();
      if (userId && creds[userId] && creds[userId].trim()) return creds[userId].trim();
    }
  } catch (e) {
    // Ignore parse errors
  }
  return undefined;
}

/**
 * Resolves the actual effective password for a user profile,
 * prioritizing custom passwords over the default 'woodlem123'.
 */
export function resolveUserPassword(
  user?: UserProfile | null,
  cloudPasswordMap?: Record<string, string>
): string {
  if (!user) return 'woodlem123';
  const cleanEmail = (user.email || '').toLowerCase().trim();
  const userId = user.id;

  // 1. Cloud password map from Supabase achievements (most authoritative for custom passwords)
  if (cloudPasswordMap) {
    const fromCloud =
      cloudPasswordMap[cleanEmail] ||
      (userId ? cloudPasswordMap[userId] : undefined) ||
      (userId ? cloudPasswordMap[userId.toLowerCase()] : undefined);
    if (fromCloud && fromCloud.trim()) return fromCloud.trim();
  }

  // 2. Local storage cache (instant sync within browser session)
  const cached = getCachedPassword(userId, cleanEmail);
  if (cached && cached.trim() && cached.trim() !== 'woodlem123') {
    return cached.trim();
  }

  // 3. User object temp_password (if set and not default)
  if (user.temp_password && user.temp_password.trim() && user.temp_password.trim() !== 'woodlem123') {
    return user.temp_password.trim();
  }

  // 4. Any cached value (even default)
  if (cached && cached.trim()) {
    return cached.trim();
  }

  // 5. User object temp_password fallback
  if (user.temp_password && user.temp_password.trim()) {
    return user.temp_password.trim();
  }

  return 'woodlem123';
}

/**
 * Multi-tier, bulletproof password persistence:
 * 1. Synchronous localStorage + event dispatch (immediate UI reactivity)
 * 2. Supabase profiles table update (if temp_password column exists)
 * 3. Supabase achievements table storage (robust against UUID types, foreign key constraints, and NOT NULL description)
 */
export async function saveUserPasswordToCloudAndLocal(
  userId: string | undefined,
  email: string,
  newPassword: string
): Promise<void> {
  const cleanEmail = (email || '').toLowerCase().trim();
  const cleanPwd = (newPassword || '').trim();
  if (!cleanPwd || !cleanEmail) return;

  // 1. Instant Local Storage & CustomEvent
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`woodlem_pwd_${cleanEmail}`, cleanPwd);
      if (userId) localStorage.setItem(`woodlem_pwd_${userId}`, cleanPwd);

      const creds = JSON.parse(localStorage.getItem('woodlem_user_credentials') || '{}');
      if (userId) creds[userId] = cleanPwd;
      creds[cleanEmail] = cleanPwd;
      localStorage.setItem('woodlem_user_credentials', JSON.stringify(creds));

      window.dispatchEvent(
        new CustomEvent('woodlem-password-updated', {
          detail: { userId, email: cleanEmail, newPassword: cleanPwd },
        })
      );
    } catch (e) {
      console.warn('Local password sync notice:', e);
    }
  }

  // 2. Supabase profiles table update (tries to update temp_password column if it exists)
  try {
    if (userId) {
      await supabase.from('profiles').update({ temp_password: cleanPwd } as any).eq('id', userId);
    }
    await supabase.from('profiles').update({ temp_password: cleanPwd } as any).eq('email', cleanEmail);
  } catch (profErr) {
    // Column might not exist in some Supabase installations, non-fatal
    console.warn('Profiles temp_password update notice:', profErr);
  }

  // 3. Supabase achievements table storage
  try {
    // Query for existing record by title + file_name (email)
    const { data: existingList } = await supabase
      .from('achievements')
      .select('id')
      .eq('title', '__USER_PASSWORD__')
      .eq('file_name', cleanEmail)
      .limit(1);

    const existingRecordId = existingList && existingList.length > 0 ? existingList[0].id : null;

    if (existingRecordId) {
      // Safely update existing record using its native ID
      await supabase
        .from('achievements')
        .update({
          description: cleanPwd,
          desc_text: cleanPwd,
          file_url: cleanPwd,
          file_name: cleanEmail,
        })
        .eq('id', existingRecordId);
    } else {
      // Insert new record (with both description and desc_text populated to satisfy NOT NULL constraints)
      const basePayload: any = {
        title: '__USER_PASSWORD__',
        description: cleanPwd,
        desc_text: cleanPwd,
        file_url: cleanPwd,
        file_name: cleanEmail,
      };

      // Try insert with student_id if userId is present
      if (userId) {
        const { error: insErr } = await supabase
          .from('achievements')
          .insert([{ ...basePayload, student_id: userId }]);

        if (insErr) {
          // If foreign key constraint on student_id fails, insert without student_id
          await supabase.from('achievements').insert([basePayload]);
        }
      } else {
        await supabase.from('achievements').insert([basePayload]);
      }
    }
  } catch (achErr) {
    console.warn('Cloud achievements password storage notice:', achErr);
  }
}
