'use client';

import React, { useState, useRef, useEffect } from 'react';
import { supabase, UserProfile } from '@/lib/supabaseClient';
import { saveUserPasswordToCloudAndLocal } from '@/lib/passwordHelper';
import { extractClassTeacherInfo } from '@/lib/classTeacherHelper';
import { Camera, Lock } from 'lucide-react';

interface SettingsViewProps {
  currentUser: UserProfile;
  profiles?: UserProfile[];
  onRefreshData?: () => void;
  onUpdateCurrentUser?: (updated: UserProfile) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUser,
  onRefreshData,
  onUpdateCurrentUser,
}) => {
  // Self password reset state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Profile picture
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => currentUser.avatar_url || null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarFeedback, setAvatarFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Compress image before saving to Supabase
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

  // Sync avatar from Supabase currentUser
  useEffect(() => {
    if (currentUser?.avatar_url) {
      setAvatarUrl(currentUser.avatar_url);
    }
  }, [currentUser]);

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
        await saveUserPasswordToCloudAndLocal(currentUser.id, currentUser.email, newPassword);

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

  // Handle profile picture upload
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
      const compressedDataUrl = await compressImage(file);
      setAvatarUrl(compressedDataUrl);

      const email = (currentUser.email || '').toLowerCase().trim();
      const avatarDocId = `avatar_${currentUser.id || email}`;

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('woodlem-avatar-updated', {
            detail: { avatarUrl: compressedDataUrl, userId: currentUser.id, email },
          })
        );
      }

      const updatedUser: UserProfile = { ...currentUser, avatar_url: compressedDataUrl };
      if (onUpdateCurrentUser) {
        onUpdateCurrentUser(updatedUser);
      }

      await supabase.from('achievements').upsert({
        id: avatarDocId,
        student_id: currentUser.id || 'system',
        title: '__USER_AVATAR__',
        desc_text: compressedDataUrl,
        file_url: compressedDataUrl,
        file_name: `${currentUser.name || 'User'}_Avatar.jpg`,
      });

      if (email) {
        await supabase.from('profiles').update({ avatar_url: compressedDataUrl } as any).eq('email', email);
      }
      if (currentUser.id) {
        await supabase.from('profiles').update({ avatar_url: compressedDataUrl } as any).eq('id', currentUser.id);
      }

      setAvatarFeedback({ type: 'success', text: 'Profile photo saved and permanently synced!' });
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      setAvatarFeedback({ type: 'error', text: 'Failed to process image. Please try another photo.' });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setAvatarUrl(null);
    const email = (currentUser.email || '').toLowerCase().trim();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('woodlem-avatar-updated', { detail: { avatarUrl: null, userId: currentUser.id, email } }));
    }
    if (onUpdateCurrentUser) onUpdateCurrentUser({ ...currentUser, avatar_url: undefined });

    try {
      const avatarDocId = `avatar_${currentUser.id || email}`;
      await supabase.from('achievements').delete().eq('id', avatarDocId);
      if (email) await supabase.from('profiles').update({ avatar_url: null } as any).eq('email', email);
      if (currentUser.id) await supabase.from('profiles').update({ avatar_url: null } as any).eq('id', currentUser.id);
      if (onRefreshData) onRefreshData();
    } catch (e) {}
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
            Manage your personal account credentials, login password, and profile photo.
          </p>
        </div>
      </div>

      {/* PROFILE & PASSWORD FORM */}
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
          <div style={{ height: 100, background: 'linear-gradient(135deg, #1C4D41 0%, #2D6E5D 100%)', position: 'relative' }}></div>
          <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: -36 }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
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
                  <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--neutral-dark)' }}>{currentUser.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{currentUser.email}</div>
                </div>
              </div>
            </div>

            {(avatarFeedback || avatarUrl) && (
              <div style={{ background: '#FAF9F6', borderRadius: 8, padding: 14, border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {avatarFeedback && (
                  <div style={{ fontSize: 12, fontWeight: 600, color: avatarFeedback.type === 'success' ? '#2D6E5D' : '#A83B38' }}>
                    {avatarFeedback.text}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => avatarInputRef.current?.click()} disabled={isUploadingAvatar} style={{ flex: 1, padding: '8px 12px', fontSize: 12, fontWeight: 700, background: '#2D2C2A', color: '#FFFFFF', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                    {isUploadingAvatar ? 'Uploading...' : 'Upload New Photo'}
                  </button>
                  {avatarUrl && (
                    <button type="button" onClick={handleRemoveAvatar} style={{ padding: '8px 16px', fontSize: 12, fontWeight: 600, background: '#FFFFFF', color: '#A83B38', border: '1px solid #F5C6CB', borderRadius: 6, cursor: 'pointer' }}>
                      Remove
                    </button>
                  )}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: '#FAF9F6', borderRadius: 8 }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Account Role</span>
                <strong style={{ textTransform: 'capitalize', color: 'var(--neutral-dark)' }}>{currentUser.role}</strong>
              </div>
              {currentUser.role === 'student' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: '#FAF9F6', borderRadius: 8 }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Assigned Grade &amp; Section</span>
                  <strong style={{ color: 'var(--neutral-dark)' }}>Grade {currentUser.grade || '10'} - Section {currentUser.class_letter || 'A'}</strong>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: '#EAF3EF', borderRadius: 8, border: '1px solid #C7E4D8' }}>
                <span style={{ color: '#1C4D41', fontWeight: 600 }}>Account Status</span>
                <span style={{ color: '#2D6E5D', fontWeight: 800 }}>Active &amp; Verified</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Box: Change Account Password Form */}
        <div style={{ background: 'var(--surface)', border: '1px solid rgba(229, 227, 223, 0.5)', borderRadius: 16, padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20, boxShadow: '0 8px 30px rgba(0,0,0,0.04)' }}>
          <div>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: '#2D6E5D', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Security Credentials</span>
            <h3 style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 800, color: 'var(--neutral-dark)' }}>Change Your Password</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '6px 0 0' }}>Enter your new password below. It will immediately secure your portal login.</p>
          </div>
          {passwordFeedback && (
            <div style={{ padding: '10px 14px', borderRadius: 6, fontSize: 12.5, fontWeight: 600, background: passwordFeedback.type === 'success' ? '#EAF3EF' : '#FDF1F0', color: passwordFeedback.type === 'success' ? '#2D6E5D' : '#A83B38', border: passwordFeedback.type === 'success' ? '1px solid #C7E4D8' : '1px solid #F5C6CB' }}>
              {passwordFeedback.text}
            </div>
          )}
          <form onSubmit={handleUpdateOwnPassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: 13, fontWeight: 600, color: 'var(--neutral-dark)', marginBottom: 8 }}>New Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPassword ? 'text' : 'password'} className="form-input" style={{ padding: '12px 14px', borderRadius: 8, fontSize: 14 }} placeholder="Enter at least 6 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={6} required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: 13, fontWeight: 600, color: 'var(--neutral-dark)', marginBottom: 8 }}>Confirm New Password</label>
              <input type={showPassword ? 'text' : 'password'} className="form-input" style={{ padding: '12px 14px', borderRadius: 8, fontSize: 14 }} placeholder="Re-enter your new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={6} required />
            </div>
            <div style={{ background: '#F0F4F4', padding: '12px 14px', borderRadius: 8, border: '1px solid #D0E0E0', fontSize: 12, color: '#3D7A6E', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Lock size={14} /> <span><strong>Password Policy:</strong> Minimum 6 characters.</span>
            </div>
            <button type="submit" className="btn-primary" disabled={isUpdatingPassword} style={{ padding: '14px', fontWeight: 700, fontSize: 14, borderRadius: 8, marginTop: 4, background: '#2D2C2A', border: 'none' }}>
              {isUpdatingPassword ? 'Updating Password...' : 'Save New Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
