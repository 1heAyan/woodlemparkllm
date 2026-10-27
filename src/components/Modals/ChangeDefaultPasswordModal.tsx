'use client';

import React, { useState } from 'react';
import { supabase, UserProfile } from '@/lib/supabaseClient';
import { saveUserPasswordToCloudAndLocal, isDefaultPassword } from '@/lib/passwordHelper';
import { ShieldAlert, Lock, Eye, EyeOff, Check, AlertCircle, ArrowRight, X } from 'lucide-react';

interface ChangeDefaultPasswordModalProps {
  isOpen: boolean;
  currentUser: UserProfile;
  onClose: () => void;
  onSuccess: (newPassword: string) => void;
}

export const ChangeDefaultPasswordModal: React.FC<ChangeDefaultPasswordModalProps> = ({
  isOpen,
  currentUser,
  onClose,
  onSuccess,
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = newPassword.trim();
    const confirmTrimmed = confirmPassword.trim();

    if (!trimmed) {
      setError('Please enter a new password.');
      return;
    }

    if (trimmed.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (isDefaultPassword(trimmed)) {
      setError('Your new password cannot be the default school password (woodlem123). Please choose a unique personal password.');
      return;
    }

    if (trimmed !== confirmTrimmed) {
      setError('Passwords do not match. Please re-enter to confirm.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Update Supabase Auth if session exists
      try {
        await supabase.auth.updateUser({ password: trimmed });
      } catch (authErr) {
        // Non-blocking if auth user session is not managed by Supabase auth directly
      }

      // 2. Persist to cloud profiles, achievements, parent_documents, and local storage
      await saveUserPasswordToCloudAndLocal(currentUser.id, currentUser.email, trimmed);

      // 3. Callback to update parent state & trigger UI refresh
      onSuccess(trimmed);
      onClose();
    } catch (err: any) {
      console.error('Failed to change default password:', err);
      setError(err.message || 'Unable to update password. Please check your network and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isMinLength = newPassword.length >= 6;
  const isNotDefault = newPassword.length > 0 && !isDefaultPassword(newPassword);
  const isMatching = confirmPassword.length > 0 && newPassword === confirmPassword;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 460,
          background: '#FFFFFF',
          borderRadius: 16,
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.08)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* TOP ACCENT LINE */}
        <div style={{ height: 4, background: 'linear-gradient(90deg, #EF4444 0%, #F59E0B 100%)' }} />

        {/* MODAL HEADER */}
        <div style={{ padding: '24px 24px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: '#FEF2F2',
                  border: '1px solid #FEE2E2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#DC2626',
                  flexShrink: 0,
                }}
              >
                <ShieldAlert size={24} />
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4.5,
                      padding: '2px 7.5px',
                      borderRadius: 10,
                      background: '#FEE2E2',
                      color: '#B91C1C',
                      fontSize: 10.5,
                      fontWeight: 800,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: '#EF4444',
                        animation: 'pulse 1.5s infinite',
                      }}
                    />
                    Default Password Active
                  </span>
                </div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0F172A' }}>
                  Update Your Password
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              title="Remind me later"
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                color: '#64748B',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
            >
              <X size={16} />
            </button>
          </div>

          <p style={{ margin: 0, fontSize: 12.5, color: '#475569', lineHeight: 1.55 }}>
            Your account ({currentUser?.email || currentUser?.name}) is currently using the initial temporary school password (<strong>woodlem123</strong>). Please set a secure personal password to protect your access and privacy.
          </p>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 12px',
                borderRadius: 8,
                background: '#FEF2F2',
                border: '1px solid #FCA5A5',
                color: '#B91C1C',
                fontSize: 12,
                lineHeight: 1.4,
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* NEW PASSWORD INPUT */}
          <div>
            <label
              htmlFor="new-pwd-input"
              style={{
                display: 'block',
                fontSize: 11.5,
                fontWeight: 700,
                color: '#334155',
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              New Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="new-pwd-input"
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Choose a strong personal password"
                autoFocus
                style={{
                  width: '100%',
                  padding: '10px 38px 10px 12px',
                  borderRadius: 8,
                  border: '1px solid #CBD5E1',
                  fontSize: 13,
                  color: '#0F172A',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s ease',
                  background: '#FFFFFF',
                }}
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
                  color: '#94A3B8',
                  cursor: 'pointer',
                  padding: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* CONFIRM PASSWORD INPUT */}
          <div>
            <label
              htmlFor="confirm-pwd-input"
              style={{
                display: 'block',
                fontSize: 11.5,
                fontWeight: 700,
                color: '#334155',
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Confirm New Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="confirm-pwd-input"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Re-enter your new password"
                style={{
                  width: '100%',
                  padding: '10px 38px 10px 12px',
                  borderRadius: 8,
                  border: '1px solid #CBD5E1',
                  fontSize: 13,
                  color: '#0F172A',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s ease',
                  background: '#FFFFFF',
                }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  padding: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* VALIDATION CHECKLIST */}
          <div
            style={{
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: 8,
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              fontSize: 11.5,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: isMinLength ? '#10B981' : '#64748B' }}>
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: isMinLength ? '#D1FAE5' : '#E2E8F0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Check size={10} color={isMinLength ? '#059669' : '#94A3B8'} />
              </div>
              <span>At least 6 characters long</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: isNotDefault ? '#10B981' : '#64748B' }}>
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: isNotDefault ? '#D1FAE5' : '#E2E8F0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Check size={10} color={isNotDefault ? '#059669' : '#94A3B8'} />
              </div>
              <span>Cannot be default password (woodlem123)</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: isMatching ? '#10B981' : '#64748B' }}>
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: isMatching ? '#D1FAE5' : '#E2E8F0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Check size={10} color={isMatching ? '#059669' : '#94A3B8'} />
              </div>
              <span>Passwords match</span>
            </div>
          </div>

          {/* ACTIONS */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                padding: '10px 16px',
                borderRadius: 8,
                background: '#F1F5F9',
                border: '1px solid #CBD5E1',
                color: '#475569',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Remind Me Later
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !isMinLength || !isNotDefault || !isMatching}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 18px',
                borderRadius: 8,
                background: isMinLength && isNotDefault && isMatching ? '#0F766E' : '#94A3B8',
                color: '#FFFFFF',
                border: 'none',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: isMinLength && isNotDefault && isMatching ? 'pointer' : 'not-allowed',
                boxShadow: isMinLength && isNotDefault && isMatching ? '0 4px 12px rgba(15, 118, 110, 0.25)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <Lock size={14} />
              <span>{isSubmitting ? 'Securing Account...' : 'Set Password'}</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </form>
      </div>

      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.9); }
        }
      `}</style>
    </div>
  );
};
