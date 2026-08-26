'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { supabase, createIsolatedSupabaseClient, UserProfile } from '@/lib/supabaseClient';
import { CustomSelect } from '@/components/UI/CustomSelect';
import { resolveUserPassword, saveUserPasswordToCloudAndLocal } from '@/lib/passwordHelper';
import { extractClassTeacherInfo } from '@/lib/classTeacherHelper';
import { Camera, Lock, Eye, EyeOff, Copy, Check } from 'lucide-react';

interface SettingsViewProps {
  currentUser: UserProfile;
  profiles?: UserProfile[];
  onRefreshData?: () => void;
  onUpdateCurrentUser?: (updated: UserProfile) => void;
}

const GRADES = ['9', '10', '11', '12'] as const;
const SECTIONS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUser,
  profiles = [],
  onRefreshData,
  onUpdateCurrentUser,
}) => {
  const isAdmin = currentUser.role === 'admin';
  const [activeTab, setActiveTabState] = useState<'profile' | 'admin_passwords'>(() => {
    // Non-admin users can never see admin_passwords tab — always default to profile
    if (!currentUser || currentUser.role !== 'admin') return 'profile';
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('woodlem_settings_active_tab');
      if (saved === 'admin_passwords' || saved === 'profile') return saved as any;
    }
    return 'profile';
  });

  const setActiveTab = (tab: 'profile' | 'admin_passwords') => {
    setActiveTabState(tab);
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('woodlem_settings_active_tab', tab);
      }
    } catch (e) {}
  };

  // Self password reset state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Notification / Preference toggles
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [soundEffects, setSoundEffects] = useState(true);
  const [autoSaveAttendance, setAutoSaveAttendance] = useState(true);

  // Profile picture
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => currentUser.avatar_url || null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarFeedback, setAvatarFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Compress image before saving to Supabase (keeps payload ~20-40KB for instant cloud sync)
  const compressImage = (file: File, maxWidth = 320, maxHeight = 320, quality = 0.82): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(event.target?.result as string);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = (e) => reject(e);
        img.src = event.target?.result as string;
      };
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  };

  // Guard: non-admin users must always be on 'profile' tab
  useEffect(() => {
    if (currentUser.role !== 'admin' && activeTab !== 'profile') {
      setActiveTabState('profile');
    }
  }, [currentUser.role, activeTab]);

  // Sync avatar from Supabase currentUser
  useEffect(() => {
    if (currentUser?.avatar_url) {
      setAvatarUrl(currentUser.avatar_url);
    }
  }, [currentUser]);

  // Admin student password manager state
  const [adminSearch, setAdminSearch] = useState('');
  const [adminRoleFilter, setAdminRoleFilter] = useState<'all' | 'student' | 'teacher' | 'parent'>('student');
  const [adminGradeFilter, setAdminGradeFilter] = useState<string>('all');
  const [adminSectionFilter, setAdminSectionFilter] = useState<string>('all');
  const [customPasswordUser, setCustomPasswordUser] = useState<UserProfile | null>(null);
  const [customPasswordInput, setCustomPasswordInput] = useState('');
  const [adminActionFeedback, setAdminActionFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isProcessingAdminReset, setIsProcessingAdminReset] = useState(false);

  // Stored passwords map: user.id -> assigned password
  const [storedPasswords, setStoredPasswords] = useState<Record<string, string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = JSON.parse(localStorage.getItem('woodlem_user_credentials') || '{}');
        return saved;
      } catch (e) {}
    }
    return {};
  });

  // Toggle visible passwords (show/hide plaintext)
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [copiedUserId, setCopiedUserId] = useState<string | null>(null);

  // Sync profile passwords into storedPasswords on mount/profiles change
  useEffect(() => {
    if (profiles && profiles.length > 0) {
      setStoredPasswords((prev) => {
        const updated = { ...prev };
        let hasChanges = false;
        profiles.forEach((p) => {
          const cleanEmail = (p.email || '').toLowerCase().trim();
          const pwd = resolveUserPassword(p);
          if (pwd && updated[p.id] !== pwd) {
            updated[p.id] = pwd;
            if (cleanEmail) updated[cleanEmail] = pwd;
            hasChanges = true;
          }
        });
        if (hasChanges && typeof window !== 'undefined') {
          try {
            localStorage.setItem('woodlem_user_credentials', JSON.stringify(updated));
          } catch (e) {}
        }
        return updated;
      });
    }
  }, [profiles]);

  const handleCopyPassword = (userId: string, pwd: string) => {
    navigator.clipboard.writeText(pwd);
    setCopiedUserId(userId);
    setTimeout(() => setCopiedUserId(null), 2000);
  };

  // Filtered profiles for Admin Password Manager
  const filteredUsers = useMemo(() => {
    if (!isAdmin) return [];
    return profiles.filter((p) => {
      if (adminRoleFilter !== 'all' && p.role !== adminRoleFilter) return false;
      if (adminGradeFilter !== 'all') {
        const g = (p.grade || '').replace(/[^0-9]/g, '');
        if (g !== adminGradeFilter) return false;
      }
      if (adminSectionFilter !== 'all') {
        const s = (p.class_letter || '').toUpperCase().trim();
        if (s !== adminSectionFilter) return false;
      }
      if (adminSearch.trim()) {
        const q = adminSearch.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesEmail = p.email.toLowerCase().includes(q);
        const matchesCode = (p.user_code || p.admission_number || '').toLowerCase().includes(q);
        return matchesName || matchesEmail || matchesCode;
      }
      return true;
    });
  }, [profiles, isAdmin, adminRoleFilter, adminGradeFilter, adminSectionFilter, adminSearch]);

  // Handle self-service password update
  const handleUpdateOwnPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordFeedback(null);

    if (!newPassword) {
      setPasswordFeedback({ type: 'error', text: 'Please enter a new password.' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordFeedback({ type: 'error', text: 'Password must be at least 6 characters long.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordFeedback({ type: 'error', text: 'Passwords do not match. Please re-enter.' });
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setPasswordFeedback({ type: 'error', text: 'Unable to update password. Please check your connection and try again.' });
      } else {
        // Multi-tier local and cloud persistence
        await saveUserPasswordToCloudAndLocal(currentUser.id, currentUser.email, newPassword);

        // Update local credentials map
        const updatedMap = {
          ...storedPasswords,
          [currentUser.id]: newPassword,
          [(currentUser.email || '').toLowerCase().trim()]: newPassword,
        };
        setStoredPasswords(updatedMap);

        if (onUpdateCurrentUser) {
          onUpdateCurrentUser({ ...currentUser, temp_password: newPassword });
        }

        setPasswordFeedback({
          type: 'success',
          text: 'Your password has been updated successfully. You can use it on your next login.',
        });
        setNewPassword('');
        setConfirmPassword('');
        if (onRefreshData) onRefreshData();
      }
    } catch (err: any) {
      setPasswordFeedback({ type: 'error', text: 'Unable to update password. Please try again.' });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // Admin resets a student's or user's password to default ('woodlem123')
  const handleResetToDefault = async (user: UserProfile) => {
    if (!window.confirm(`Reset password for "${user.name}" (${user.email}) to default "woodlem123"?`)) {
      return;
    }

    setIsProcessingAdminReset(true);
    setAdminActionFeedback(null);
    try {
      await saveUserPasswordToCloudAndLocal(user.id, user.email, 'woodlem123');

      const updatedMap = {
        ...storedPasswords,
        [user.id]: 'woodlem123',
        [(user.email || '').toLowerCase().trim()]: 'woodlem123',
      };
      setStoredPasswords(updatedMap);

      // Dispatch reset email
      try {
        await supabase.auth.resetPasswordForEmail(user.email.toLowerCase().trim(), {
          redirectTo: typeof window !== 'undefined' ? `${window.location.origin}` : undefined,
        });
      } catch (e) {}

      setAdminActionFeedback({
        type: 'success',
        text: `Password for "${user.name}" has been reset to "woodlem123". The password is now visible in the table below.`,
      });
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      setAdminActionFeedback({
        type: 'error',
        text: `Unable to reset password for "${user.name}". Please try again.`,
      });
    } finally {
      setIsProcessingAdminReset(false);
    }
  };

  // Admin sets a custom password for a specific user
  const handleSaveCustomPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPasswordUser) return;
    if (customPasswordInput.length < 6) {
      alert('Password must be at least 6 characters long.');
      return;
    }

    const newPwd = customPasswordInput.trim();
    setIsProcessingAdminReset(true);
    setAdminActionFeedback(null);
    try {
      await saveUserPasswordToCloudAndLocal(customPasswordUser.id, customPasswordUser.email, newPwd);

      const updatedMap = {
        ...storedPasswords,
        [customPasswordUser.id]: newPwd,
        [(customPasswordUser.email || '').toLowerCase().trim()]: newPwd,
      };
      setStoredPasswords(updatedMap);

      // Dispatch reset email
      try {
        await supabase.auth.resetPasswordForEmail(customPasswordUser.email.toLowerCase().trim(), {
          redirectTo: typeof window !== 'undefined' ? `${window.location.origin}` : undefined,
        });
      } catch (e) {}

      setAdminActionFeedback({
        type: 'success',
        text: `Password for "${customPasswordUser.name}" has been updated to "${newPwd}". It is now recorded and visible in the directory table below.`,
      });
      setCustomPasswordUser(null);
      setCustomPasswordInput('');
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      setAdminActionFeedback({
        type: 'error',
        text: `Unable to set custom password for "${customPasswordUser.name}". Please try again.`,
      });
    } finally {
      setIsProcessingAdminReset(false);
    }
  };

  // Admin bulk resets all students in a chosen grade/section
  const handleBulkResetSection = async () => {
    if (adminGradeFilter === 'all' || adminSectionFilter === 'all') {
      alert('Please select both a specific Grade and Section filter above to bulk reset that cohort.');
      return;
    }

    const cohortStudents = profiles.filter((p) => {
      if (p.role !== 'student') return false;
      const g = (p.grade || '').replace(/[^0-9]/g, '');
      const s = (p.class_letter || '').toUpperCase().trim();
      return g === adminGradeFilter && s === adminSectionFilter;
    });

    if (cohortStudents.length === 0) {
      alert(`No students found enrolled in Grade ${adminGradeFilter}-${adminSectionFilter}.`);
      return;
    }

    if (
      !window.confirm(
        `Are you sure you want to dispatch password reset notifications to ALL ${cohortStudents.length} students in Grade ${adminGradeFilter}-${adminSectionFilter}?`
      )
    ) {
      return;
    }

    setIsProcessingAdminReset(true);
    setAdminActionFeedback(null);

    let successCount = 0;
    for (const student of cohortStudents) {
      try {
        await supabase.auth.resetPasswordForEmail(student.email.toLowerCase().trim(), {
          redirectTo: typeof window !== 'undefined' ? `${window.location.origin}` : undefined,
        });
        successCount++;
      } catch (e) {}
    }

    setIsProcessingAdminReset(false);
    setAdminActionFeedback({
      type: 'success',
      text: `Bulk reset complete. Dispatched password reset notifications to ${successCount} students in Grade ${adminGradeFilter}-${adminSectionFilter}.`,
    });
  };

  // Handle profile picture upload (compressed and saved directly to Supabase cloud)
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      setAvatarFeedback({ type: 'error', text: 'Image too large. Please choose a photo under 8 MB.' });
      return;
    }

    setIsUploadingAvatar(true);
    setAvatarFeedback(null);

    try {
      // 1. Compress image to clean lightweight 320x320 JPEG
      const compressedDataUrl = await compressImage(file);
      setAvatarUrl(compressedDataUrl);

      const email = (currentUser.email || '').toLowerCase().trim();
      const userKey = currentUser.id || email;
      const avatarDocId = `avatar_${userKey}`;

      // Instant local cache so it never flickers or disappears on next page loads
      if (typeof window !== 'undefined') {
        if (email) localStorage.setItem(`woodlem_avatar_${email}`, compressedDataUrl);
        if (currentUser.id) localStorage.setItem(`woodlem_avatar_${currentUser.id}`, compressedDataUrl);
        window.dispatchEvent(
          new CustomEvent('woodlem-avatar-updated', {
            detail: { avatarUrl: compressedDataUrl, userId: currentUser.id, email },
          })
        );
      }

      // Notify parent dashboard component to update state immutably
      const updatedUser: UserProfile = { ...currentUser, avatar_url: compressedDataUrl };
      if (onUpdateCurrentUser) {
        onUpdateCurrentUser(updatedUser);
      }

      // 2. Persist directly to Supabase cloud (both achievements cloud table and profiles table)
      await supabase.from('achievements').upsert({
        id: avatarDocId,
        student_id: currentUser.id || 'system',
        title: '__USER_AVATAR__',
        desc_text: compressedDataUrl,
        file_url: compressedDataUrl,
        file_name: `${currentUser.name || 'User'}_Avatar.jpg`,
      });

      if (email) {
        await supabase
          .from('profiles')
          .update({ avatar_url: compressedDataUrl } as any)
          .eq('email', email);
      }

      if (currentUser.id) {
        await supabase
          .from('profiles')
          .update({ avatar_url: compressedDataUrl } as any)
          .eq('id', currentUser.id);
      }

      setAvatarFeedback({
        type: 'success',
        text: 'Profile photo saved and permanently synced to your cloud account!',
      });
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      console.error('Avatar upload error:', err);
      setAvatarFeedback({ type: 'error', text: 'Failed to process image. Please try another photo.' });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setAvatarUrl(null);

    const email = (currentUser.email || '').toLowerCase().trim();
    if (typeof window !== 'undefined') {
      if (email) localStorage.removeItem(`woodlem_avatar_${email}`);
      if (currentUser.id) localStorage.removeItem(`woodlem_avatar_${currentUser.id}`);
      window.dispatchEvent(
        new CustomEvent('woodlem-avatar-updated', {
          detail: { avatarUrl: null, userId: currentUser.id, email },
        })
      );
    }

    const updatedUser: UserProfile = { ...currentUser, avatar_url: undefined };
    if (onUpdateCurrentUser) {
      onUpdateCurrentUser(updatedUser);
    }

    try {
      const userKey = currentUser.id || email;
      const avatarDocId = `avatar_${userKey}`;
      await supabase.from('achievements').delete().eq('id', avatarDocId);
      if (currentUser.id) {
        await supabase.from('achievements').delete().eq('student_id', currentUser.id).eq('title', '__USER_AVATAR__');
      }

      if (email) {
        await supabase.from('profiles').update({ avatar_url: null } as any).eq('email', email);
      }
      if (currentUser.id) {
        await supabase.from('profiles').update({ avatar_url: null } as any).eq('id', currentUser.id);
      }
      if (onRefreshData) onRefreshData();
    } catch (e) {
      console.warn('Avatar cloud remove notice:', e);
    }

    setAvatarFeedback({ type: 'success', text: 'Profile photo removed.' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top Header */}
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 12,
          padding: '24px 28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
          border: '1px solid rgba(229, 227, 223, 0.5)',
        }}
      >
        <div>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: '#2D6E5D', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2D6E5D' }}></span>
            Account &amp; Security
          </span>
          <h2 style={{ margin: '6px 0 0', fontSize: 24, fontWeight: 900, color: 'var(--neutral-dark)', letterSpacing: '-0.02em' }}>
            Settings &amp; Passwords
          </h2>
          <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', margin: '6px 0 0' }}>
            Manage your account credentials, login passwords, and portal settings.
          </p>
        </div>

        {/* Tab Switcher if Admin */}
        {isAdmin && (
          <div style={{ display: 'flex', gap: 6, background: '#FAF9F6', padding: 4, borderRadius: 6, border: '1px solid var(--border-color)' }}>
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              style={{
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: activeTab === 'profile' ? 700 : 500,
                borderRadius: 4,
                border: 'none',
                background: activeTab === 'profile' ? '#2D2C2A' : 'transparent',
                color: activeTab === 'profile' ? '#FFFFFF' : 'var(--text-secondary)',
                boxShadow: activeTab === 'profile' ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                cursor: 'pointer',
              }}
            >
              My Account &amp; Password
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('admin_passwords')}
              style={{
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: activeTab === 'admin_passwords' ? 700 : 500,
                borderRadius: 4,
                border: 'none',
                background: activeTab === 'admin_passwords' ? '#2D2C2A' : 'transparent',
                color: activeTab === 'admin_passwords' ? '#FFFFFF' : 'var(--text-secondary)',
                boxShadow: activeTab === 'admin_passwords' ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                cursor: 'pointer',
              }}
            >
              Student &amp; Staff Password Manager
            </button>
          </div>
        )}
      </div>

      {/* VIEW 1: PROFILE & OWN PASSWORD */}
      {activeTab === 'profile' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          {/* Left Box: Account Profile Summary */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid rgba(229, 227, 223, 0.5)',
              borderRadius: 16,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 8px 30px rgba(0,0,0,0.04)',
              overflow: 'hidden',
            }}
          >
            {/* Gradient Cover Banner */}
            <div style={{ height: 100, background: 'linear-gradient(135deg, #1C4D41 0%, #2D6E5D 100%)', position: 'relative' }}>
              <div style={{ position: 'absolute', inset: 0, opacity: 0.1, backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}></div>
            </div>

            {/* Profile Content */}
            <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              {/* Avatar Row (Overlapping banner) */}
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: -36 }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
                  {/* Avatar Container */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div
                      style={{
                        width: 88,
                        height: 88,
                        borderRadius: '50%',
                        background: avatarUrl ? 'transparent' : '#EAF3EF',
                        color: '#2D6E5D',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 34,
                        fontWeight: 900,
                        overflow: 'hidden',
                        border: '4px solid var(--surface)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                      }}
                    >
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        (currentUser.name || 'U').charAt(0).toUpperCase()
                      )}
                    </div>
                    {/* Camera overlay button */}
                    <button
                      type="button"
                      title="Change profile photo"
                      onClick={() => avatarInputRef.current?.click()}
                      style={{
                        position: 'absolute',
                        bottom: 4,
                        right: 4,
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: '#2D2C2A',
                        border: '2px solid var(--surface)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        cursor: 'pointer',
                        color: '#FFFFFF',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                        transition: 'transform 0.2s',
                      }}
                    >
                      <Camera size={14} />
                    </button>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      style={{ display: 'none' }}
                    />
                  </div>

                  <div style={{ paddingBottom: 6 }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--neutral-dark)', letterSpacing: '-0.01em' }}>{currentUser.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{currentUser.email}</div>
                  </div>
                </div>

                <span
                  style={{
                    display: 'inline-block',
                    marginBottom: 10,
                    fontSize: 10.5,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    padding: '4px 12px',
                    borderRadius: 20,
                    background: 'var(--neutral-bg)',
                    color: '#2D6E5D',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  {currentUser.role} Account
                </span>
              </div>

              {/* Upload Controls if feedback or removing */}
              {(avatarFeedback || avatarUrl) && (
                <div style={{ background: '#FAF9F6', borderRadius: 8, padding: 14, border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {avatarFeedback && (
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: avatarFeedback.type === 'success' ? '#2D6E5D' : '#A83B38',
                      }}
                    >
                      {avatarFeedback.text}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={isUploadingAvatar}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        fontSize: 12,
                        fontWeight: 700,
                        background: '#2D2C2A',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: 6,
                        cursor: 'pointer',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                      }}
                    >
                      {isUploadingAvatar ? 'Uploading...' : 'Upload New Photo'}
                    </button>
                    {avatarUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        style={{
                          padding: '8px 16px',
                          fontSize: 12,
                          fontWeight: 600,
                          background: '#FFFFFF',
                          color: '#A83B38',
                          border: '1px solid #F5C6CB',
                          borderRadius: 6,
                          cursor: 'pointer',
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Data Rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: '#FAF9F6', borderRadius: 8 }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Account Role</span>
                  <strong style={{ textTransform: 'capitalize', color: 'var(--neutral-dark)' }}>{currentUser.role}</strong>
                </div>

                {(currentUser.admission_number || currentUser.user_code) && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: '#FAF9F6', borderRadius: 8 }}>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>ID / Reg Number</span>
                    <strong style={{ fontFamily: 'monospace', color: 'var(--neutral-dark)', fontSize: 14 }}>{currentUser.admission_number || currentUser.user_code}</strong>
                  </div>
                )}

                {currentUser.role === 'student' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: '#FAF9F6', borderRadius: 8 }}>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Assigned Grade &amp; Section</span>
                    <strong style={{ color: 'var(--neutral-dark)' }}>
                      Grade {currentUser.grade || '10'} - Section {currentUser.class_letter || 'A'}
                    </strong>
                  </div>
                )}

                {currentUser.role === 'teacher' && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: '#FAF9F6', borderRadius: 8 }}>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Discipline / Subject</span>
                      <strong style={{ color: 'var(--neutral-dark)' }}>{currentUser.subject || 'Faculty'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: '#FAF9F6', borderRadius: 8 }}>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Class Teacher Homeroom</span>
                      <strong style={{ color: 'var(--neutral-dark)' }}>
                        {(() => {
                          const info = extractClassTeacherInfo(currentUser);
                          return info.isClassTeacher ? info.classLabel : 'Subject Teacher';
                        })()}
                      </strong>
                    </div>
                  </>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: '#EAF3EF', borderRadius: 8, border: '1px solid #C7E4D8' }}>
                  <span style={{ color: '#1C4D41', fontWeight: 600 }}>Account Status</span>
                  <span style={{ color: '#2D6E5D', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2D6E5D' }}></span>
                    Active &amp; Verified
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Box: Change Account Password Form */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid rgba(229, 227, 223, 0.5)',
              borderRadius: 16,
              padding: '24px 28px',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              boxShadow: '0 8px 30px rgba(0,0,0,0.04)',
            }}
          >
            <div>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: '#2D6E5D', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Security Credentials
              </span>
              <h3 style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 800, color: 'var(--neutral-dark)' }}>
                Change Your Password
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '6px 0 0' }}>
                Enter your new password below. It will immediately secure your portal login.
              </p>
            </div>

            {passwordFeedback && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 6,
                  fontSize: 12.5,
                  fontWeight: 600,
                  background: passwordFeedback.type === 'success' ? '#EAF3EF' : '#FDF1F0',
                  color: passwordFeedback.type === 'success' ? '#2D6E5D' : '#A83B38',
                  border: passwordFeedback.type === 'success' ? '1px solid #C7E4D8' : '1px solid #F5C6CB',
                }}
              >
                {passwordFeedback.text}
              </div>
            )}

            <form onSubmit={handleUpdateOwnPassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: 13, fontWeight: 600, color: 'var(--neutral-dark)', marginBottom: 8 }}>New Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-input"
                    style={{ padding: '12px 14px', borderRadius: 8, fontSize: 14 }}
                    placeholder="Enter at least 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={6}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: 13, fontWeight: 600, color: 'var(--neutral-dark)', marginBottom: 8 }}>Confirm New Password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  style={{ padding: '12px 14px', borderRadius: 8, fontSize: 14 }}
                  placeholder="Re-enter your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </div>

              <div style={{ background: '#F0F4F4', padding: '12px 14px', borderRadius: 8, border: '1px solid #D0E0E0', fontSize: 12, color: '#3D7A6E', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Lock size={14} style={{ flexShrink: 0 }} />
                <span><strong>Password Policy:</strong> Minimum 6 characters. Must not match common weak phrases.</span>
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={isUpdatingPassword}
                style={{ padding: '14px', fontWeight: 700, fontSize: 14, borderRadius: 8, marginTop: 4, background: '#2D2C2A', border: 'none', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)' }}
              >
                {isUpdatingPassword ? 'Updating Password...' : 'Save New Password'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* VIEW 2: ADMIN STUDENT & STAFF PASSWORD MANAGER */}
      {isAdmin && activeTab === 'admin_passwords' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {adminActionFeedback && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                background: adminActionFeedback.type === 'success' ? '#EAF3EF' : '#FDF1F0',
                color: adminActionFeedback.type === 'success' ? '#2D6E5D' : '#A83B38',
                border: adminActionFeedback.type === 'success' ? '1px solid #C7E4D8' : '1px solid #F5C6CB',
              }}
            >
              {adminActionFeedback.text}
            </div>
          )}

          {/* Quick Filter & Bulk Reset Bar */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                  User Directory Password Management
                </span>
                <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                  Reset individual or cohort student passwords in real time.
                </p>
              </div>

              <button
                type="button"
                onClick={handleBulkResetSection}
                disabled={isProcessingAdminReset || adminGradeFilter === 'all' || adminSectionFilter === 'all'}
                style={{
                  padding: '7px 14px',
                  fontSize: 12,
                  fontWeight: 700,
                  borderRadius: 6,
                  border: '1px solid #C7E4D8',
                  background: adminGradeFilter !== 'all' && adminSectionFilter !== 'all' ? '#EAF3EF' : '#F5F5F5',
                  color: adminGradeFilter !== 'all' && adminSectionFilter !== 'all' ? '#2D6E5D' : '#9E9B95',
                  cursor: adminGradeFilter !== 'all' && adminSectionFilter !== 'all' ? 'pointer' : 'not-allowed',
                }}
              >
                Reset All in Section {adminGradeFilter !== 'all' && adminSectionFilter !== 'all' ? `${adminGradeFilter}-${adminSectionFilter}` : ''} to Default
              </button>
            </div>

            {/* Filter controls */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Search student or user by name, email, or admission ID..."
                style={{ flex: 1, minWidth: 220, padding: '7px 12px', fontSize: 12 }}
                value={adminSearch}
                onChange={(e) => setAdminSearch(e.target.value)}
              />

              <div style={{ width: 130 }}>
                <CustomSelect
                  value={adminRoleFilter}
                  onChange={(val) => setAdminRoleFilter(val as any)}
                  options={[
                    { value: 'all', label: 'All Roles' },
                    { value: 'student', label: 'Students' },
                    { value: 'teacher', label: 'Teachers' },
                    { value: 'parent', label: 'Parents' },
                  ]}
                />
              </div>

              <div style={{ width: 130 }}>
                <CustomSelect
                  value={adminGradeFilter}
                  onChange={(val) => setAdminGradeFilter(val)}
                  options={[
                    { value: 'all', label: 'All Grades' },
                    ...GRADES.map((g) => ({ value: g, label: `Grade ${g}` })),
                  ]}
                />
              </div>

              <div style={{ width: 130 }}>
                <CustomSelect
                  value={adminSectionFilter}
                  onChange={(val) => setAdminSectionFilter(val)}
                  options={[
                    { value: 'all', label: 'All Sections' },
                    ...SECTIONS.map((s) => ({ value: s, label: `Section ${s}` })),
                  ]}
                />
              </div>
            </div>
          </div>

          {/* User Table */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', background: '#FAF9F6', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                Showing {filteredUsers.length} Users
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                Standard Default Password: <strong>woodlem123</strong>
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#FAF9F6', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 11 }}>User Details</th>
                    <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 11 }}>Role</th>
                    <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 11 }}>Cohort / Subject</th>
                    <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 11 }}>Assigned Password</th>
                    <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 11, textAlign: 'right' }}>Password Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        No users match the selected search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u, idx) => {
                      const g = (u.grade || '').replace(/[^0-9]/g, '');
                      const s = (u.class_letter || '').toUpperCase().trim();
                      const uInfo = extractClassTeacherInfo(u);
                      const cohortStr =
                        u.role === 'student'
                          ? g && s
                            ? `Grade ${g}-${s}`
                            : '—'
                          : u.role === 'teacher'
                          ? uInfo.isClassTeacher
                            ? `CT: ${uInfo.classLabel}`
                            : u.subject || 'Faculty'
                          : u.subject || '—';
                      const cleanUProfileEmail = (u.email || '').toLowerCase().trim();
                      const userPwd =
                        storedPasswords[u.id] ||
                        (cleanUProfileEmail ? storedPasswords[cleanUProfileEmail] : undefined) ||
                        resolveUserPassword(u);
                      const hasCustom = userPwd !== 'woodlem123';
                      const isRevealed = !!visiblePasswords[u.id];

                      return (
                        <tr
                          key={u.id}
                          style={{
                            borderBottom: '1px solid #FAF9F6',
                            background: idx % 2 === 0 ? '#FFFFFF' : '#FDFDFD',
                          }}
                        >
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ fontWeight: 700, color: 'var(--neutral-dark)' }}>{u.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{u.email}</div>
                            <div style={{ fontSize: 10.5, color: '#9E9B95', fontFamily: 'monospace' }}>
                              {u.admission_number || u.user_code || ''}
                            </div>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                padding: '2px 7px',
                                borderRadius: 4,
                                background: u.role === 'student' ? '#EAF3EF' : u.role === 'teacher' ? '#FAF2E6' : '#F3EFFA',
                                color: u.role === 'student' ? '#2D6E5D' : u.role === 'teacher' ? '#B37D4A' : '#7C5CBF',
                              }}
                            >
                              {u.role}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', color: 'var(--neutral-dark)', fontWeight: 500 }}>
                            {cohortStr}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <code
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: 4,
                                  background: '#FAF9F6',
                                  border: '1px solid var(--border-color)',
                                  fontSize: 11.5,
                                  fontFamily: 'monospace',
                                  letterSpacing: isRevealed ? '0' : '2px',
                                  color: 'var(--neutral-dark)',
                                  minWidth: 96,
                                  display: 'inline-block',
                                }}
                              >
                                {isRevealed ? userPwd : '••••••••'}
                              </code>

                              {/* Toggle Show/Hide */}
                              <button
                                type="button"
                                title={isRevealed ? 'Hide Password' : 'Show Password'}
                                onClick={() => setVisiblePasswords((prev) => ({ ...prev, [u.id]: !prev[u.id] }))}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  fontSize: 13,
                                  padding: '2px 4px',
                                }}
                              >
                                {isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>

                              {/* Copy Button */}
                              <button
                                type="button"
                                title="Copy Password to Clipboard"
                                onClick={() => handleCopyPassword(u.id, userPwd)}
                                style={{
                                  background: copiedUserId === u.id ? '#EAF3EF' : '#FFFFFF',
                                  border: copiedUserId === u.id ? '1px solid #C7E4D8' : '1px solid var(--border-color)',
                                  borderRadius: 4,
                                  cursor: 'pointer',
                                  fontSize: 11,
                                  fontWeight: 600,
                                  padding: '2px 7px',
                                  color: copiedUserId === u.id ? '#2D6E5D' : 'var(--neutral-dark)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                {copiedUserId === u.id ? (
                                  <>
                                    <Check size={12} />
                                    Copied
                                  </>
                                ) : (
                                  <>
                                    <Copy size={12} />
                                    Copy
                                  </>
                                )}
                              </button>
                            </div>
                            <div style={{ marginTop: 3 }}>
                              {hasCustom ? (
                                <span style={{ fontSize: 9.5, fontWeight: 700, color: '#2C6E6A', background: '#EAF3EF', padding: '1px 5px', borderRadius: 3, border: '1px solid #C7E4D8' }}>
                                  Custom Assigned
                                </span>
                              ) : (
                                <span style={{ fontSize: 9.5, color: '#9E9B95' }}>
                                  Default: woodlem123
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: 6 }}>
                              <button
                                type="button"
                                onClick={() => handleResetToDefault(u)}
                                disabled={isProcessingAdminReset}
                                style={{
                                  padding: '4px 10px',
                                  fontSize: 11,
                                  fontWeight: 600,
                                  background: '#FAF9F6',
                                  border: '1px solid var(--border-color)',
                                  borderRadius: 4,
                                  color: 'var(--neutral-dark)',
                                  cursor: 'pointer',
                                }}
                              >
                                Reset to Default
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setCustomPasswordUser(u);
                                  setCustomPasswordInput(storedPasswords[u.id] || u.temp_password || '');
                                }}
                                disabled={isProcessingAdminReset}
                                style={{
                                  padding: '4px 10px',
                                  fontSize: 11,
                                  fontWeight: 600,
                                  background: '#EAF3EF',
                                  border: '1px solid #C7E4D8',
                                  borderRadius: 4,
                                  color: '#2D6E5D',
                                  cursor: 'pointer',
                                }}
                              >
                                Set Password
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Custom Password Modal */}
          {customPasswordUser && (
            <div className="modal-overlay active" onClick={() => setCustomPasswordUser(null)}>
              <div
                className="modal-content"
                style={{ maxWidth: 460 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="modal-header">
                  <div>
                    <h3 className="modal-title" style={{ margin: 0, fontSize: 16 }}>
                      Set Custom Password
                    </h3>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                      Assigning password for <strong>{customPasswordUser.name}</strong> ({customPasswordUser.email})
                    </p>
                  </div>
                  <button type="button" className="close-modal" onClick={() => setCustomPasswordUser(null)}>
                    &times;
                  </button>
                </div>

                <form onSubmit={handleSaveCustomPassword}>
                  {/* Current Active Password display */}
                  <div style={{ background: '#FAF9F6', border: '1px solid var(--border-color)', borderRadius: 6, padding: '10px 12px', marginBottom: 14 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Current Password on Record
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                      <code style={{ fontSize: 13, fontWeight: 700, color: '#2C6E6A', fontFamily: 'monospace' }}>
                        {resolveUserPassword(customPasswordUser)}
                      </code>
                      <span style={{ fontSize: 10.5, color: 'var(--text-secondary)' }}>
                        {resolveUserPassword(customPasswordUser) !== 'woodlem123' ? 'Custom Set' : 'Default Preset'}
                      </span>
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 12 }}>
                    <label className="form-label">New Password to Assign</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Student2026!"
                      value={customPasswordInput}
                      onChange={(e) => setCustomPasswordInput(e.target.value)}
                      minLength={6}
                      required
                      autoFocus
                    />
                  </div>

                  {/* Quick Preset Buttons */}
                  <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                    <button
                      type="button"
                      onClick={() => setCustomPasswordInput('woodlem123')}
                      style={{
                        padding: '4px 8px',
                        fontSize: 11,
                        background: '#FAF9F6',
                        border: '1px solid var(--border-color)',
                        borderRadius: 4,
                        cursor: 'pointer',
                        color: 'var(--neutral-dark)',
                      }}
                    >
                      Fill &quot;woodlem123&quot;
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomPasswordInput(`Woodlem@${new Date().getFullYear()}`)}
                      style={{
                        padding: '4px 8px',
                        fontSize: 11,
                        background: '#FAF9F6',
                        border: '1px solid var(--border-color)',
                        borderRadius: 4,
                        cursor: 'pointer',
                        color: 'var(--neutral-dark)',
                      }}
                    >
                      Generate &quot;Woodlem@{new Date().getFullYear()}&quot;
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ flex: 1, padding: 10 }}
                      onClick={() => setCustomPasswordUser(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn-primary"
                      style={{ flex: 1, padding: 10 }}
                      disabled={isProcessingAdminReset}
                    >
                      {isProcessingAdminReset ? 'Saving Password...' : 'Save & Make Visible ↗'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
