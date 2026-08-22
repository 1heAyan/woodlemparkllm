'use client';

import React, { useState } from 'react';
import { supabase, UserProfile } from '@/lib/supabaseClient';

interface LoginViewProps {
  onLoginSuccess: (profile: UserProfile) => void;
}

const RoleIcons: Record<string, React.ReactNode> = {
  student: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
    </svg>
  ),
  teacher: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
    </svg>
  ),
  admin: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>
    </svg>
  ),
  parent: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
};

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [role, setRole] = useState<'student' | 'teacher' | 'admin' | 'parent'>('student');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const roles: {
    id: 'student' | 'teacher' | 'admin' | 'parent';
    label: string;
    placeholder: string;
    color: string;
    bg: string;
  }[] = [
    { id: 'student', label: 'Student', placeholder: 'student@woodlem.com or Admission No.', color: '#6B8E8E', bg: '#F0F4F4' },
    { id: 'teacher', label: 'Teacher', placeholder: 'teacher@woodlem.com or Employee ID',   color: '#B37D4A', bg: '#FBF6F0' },
    { id: 'admin',   label: 'Admin',   placeholder: 'admin@woodlem.com or Admin ID',        color: '#7C5CBF', bg: '#F3EFFA' },
    { id: 'parent',  label: 'Parent',  placeholder: 'parent@woodlem.com or Registered Email', color: '#3D7A6E', bg: '#EAF3F1' },
  ];

  const activeRole = roles.find((r) => r.id === role)!;

  const handleRoleSelect = (id: 'student' | 'teacher' | 'admin' | 'parent') => {
    setRole(id);
    setErrorMessage('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const rawIdentifier = identifier.trim();
    if (!rawIdentifier) {
      setErrorMessage('Please enter your email or admission / employee ID.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setLoading(true);

    try {
      let resolvedEmail = rawIdentifier.toLowerCase();

      // If user typed an ID / Admission Code instead of email, resolve email from profiles
      if (!rawIdentifier.includes('@')) {
        const { data: matchedProfiles } = await supabase
          .from('profiles')
          .select('email, role, name')
          .eq('role', role)
          .or(`admission_number.ilike.${rawIdentifier},user_code.ilike.${rawIdentifier}`)
          .limit(1);

        if (matchedProfiles && matchedProfiles.length > 0 && matchedProfiles[0].email) {
          resolvedEmail = matchedProfiles[0].email.toLowerCase();
        } else {
          // Check if code exists under a different role to provide helpful guidance
          const { data: anyMatch } = await supabase
            .from('profiles')
            .select('email, role')
            .or(`admission_number.ilike.${rawIdentifier},user_code.ilike.${rawIdentifier}`)
            .limit(1);

          if (anyMatch && anyMatch.length > 0 && anyMatch[0].role !== role) {
            throw new Error(`No ${activeRole.label.toLowerCase()} account found with this ID. Please select the correct portal tab.`);
          }
        }
      }

      // Real Authentication
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: resolvedEmail,
        password: password,
      });

      if (authError || !authData?.user) {
        if (authError?.message === 'Invalid login credentials') {
          throw new Error('Incorrect email/ID or password. Please check your credentials.');
        } else if (authError?.message?.toLowerCase().includes('rate limit')) {
          throw new Error('Too many sign-in attempts. Please wait a moment and try again.');
        } else {
          throw new Error('Unable to sign in. Please check your login details and try again.');
        }
      }

      const userId = authData.user.id;

      // Fetch fresh user profile from profiles table by email
      let { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', resolvedEmail)
        .maybeSingle();

      if (!profile) {
        const { data: profileById } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        if (profileById) {
          profile = profileById;
        }
      }

      if (!profile) {
        // Special case: bootstrap root admin if logging in as admin@woodlem.com
        if (resolvedEmail === 'admin@woodlem.com') {
          const adminProfile: UserProfile = {
            id: userId || 'admin-1',
            email: 'admin@woodlem.com',
            name: 'System Admin',
            role: 'admin',
            user_code: 'ADM-001',
          };
          await supabase.from('profiles').upsert([adminProfile], { onConflict: 'email' });
          profile = adminProfile;
        } else {
          // If the profile was deleted, reject sign in.
          await supabase.auth.signOut();
          throw new Error('This account is not active. Please contact your school administrator.');
        }
      }

      // Enforce strict portal role: user must match the selected portal role
      if (profile.role !== role) {
        await supabase.auth.signOut();
        throw new Error(`No ${activeRole.label.toLowerCase()} account found with these credentials. Please select the correct portal tab.`);
      }

      onLoginSuccess(profile);
    } catch (err: any) {
      const rawMsg = err?.message || '';
      if (
        rawMsg.includes('school administrator') ||
        rawMsg.includes('Incorrect') ||
        rawMsg.includes('Too many') ||
        rawMsg.includes('Please') ||
        rawMsg.includes('account found')
      ) {
        setErrorMessage(rawMsg);
      } else {
        setErrorMessage('Unable to sign in. Please check your connection and credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="el-root">

      {/* ── LEFT PANEL ── */}
      <div className="el-left">
        {/* Full-bleed campus photo */}
        <img src="/campus_bg.jpg" alt="Woodlem Park Campus" className="el-left-photo" />
        {/* Gradient overlay */}
        <div className="el-left-overlay" />

        {/* Content over the photo */}
        <div className="el-left-inner">

          {/* Logo */}
          <div className="el-left-logo">
            <img src="/Jurf-Logo-1.png" alt="Woodlem Park School" className="el-left-logo-img" />
          </div>

          {/* Hero */}
          <div className="el-left-hero">
            <p className="el-left-eyebrow">Learning Management System</p>
            <h1 className="el-left-headline">
              Education<br />
              Reimagined<br />
              <span className="el-left-headline-accent">for You.</span>
            </h1>
            <p className="el-left-desc">
              Your gateway to courses, attendance, progress reports, and everything Woodlem Park has to offer.
            </p>
          </div>

          {/* Stats */}
          <div className="el-stats">
            {[
              { value: '1,200+', label: 'Students' },
              { value: '80+',    label: 'Teachers' },
              { value: '40+',    label: 'Subjects'  },
            ].map((s) => (
              <div className="el-stat" key={s.label}>
                <span className="el-stat-value">{s.value}</span>
                <span className="el-stat-label">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="el-right">
        <div className="el-form-wrap">

          {/* Header */}
          <div className="el-form-header">
            <p className="el-form-eyebrow">Welcome back</p>
            <h2 className="el-form-title">Sign in to your<br />account</h2>
            <p className="el-form-subtitle">Select your role to continue</p>
          </div>

          {/* Role selector pills */}
          <div className="el-role-grid">
            {roles.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => handleRoleSelect(r.id)}
                className={`el-role-pill${role === r.id ? ' active' : ''}`}
                style={role === r.id ? { '--rc': r.color, '--rcbg': r.bg } as React.CSSProperties : { '--rc': r.color } as React.CSSProperties}
              >
                <span className="el-role-pill-icon">{RoleIcons[r.id]}</span>
                <span className="el-role-pill-label">{r.label}</span>
              </button>
            ))}
          </div>

          {/* Dynamic Active Role Loading Banner — only shown when actively loading/authenticating */}
          {loading && (
            <div className="el-role-hint" style={{ '--rc': activeRole.color } as React.CSSProperties}>
              <span className="el-spin" style={{ width: 12, height: 12, borderWidth: 2 }} />
              <span>Authenticating <strong>{identifier.trim() || activeRole.label}</strong>…</span>
            </div>
          )}

          {/* Error message */}
          {errorMessage && (
            <div className="el-error" role="alert">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {errorMessage}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="el-form">
            <div className="el-field">
              <label className="el-label" htmlFor="el-email">Email or User ID</label>
              <div className="el-input-wrap">
                <svg className="el-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                </svg>
                <input
                  id="el-email"
                  type="text"
                  className="el-input"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder={activeRole.placeholder}
                  autoComplete="username"
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <div className="el-field">
              <div className="el-label-row">
                <label className="el-label" htmlFor="el-password">Password</label>
                <a href="mailto:it@woodlem.com" className="el-forgot">Need help?</a>
              </div>
              <div className="el-input-wrap">
                <svg className="el-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input
                  id="el-password"
                  type={showPassword ? 'text' : 'password'}
                  className="el-input"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  className="el-eye"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                  disabled={loading}
                >
                  {showPassword
                    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="el-submit"
              disabled={loading}
              style={{ '--rc': activeRole.color } as React.CSSProperties}
            >
              {loading ? (
                <><span className="el-spin" />Signing in…</>
              ) : (
                <>
                  Sign In
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12,5 19,12 12,19"/>
                  </svg>
                </>
              )}
            </button>
          </form>

          <p className="el-footer-note">
            Having trouble?{' '}
            <a href="mailto:it@woodlem.com">Contact IT Support</a>
          </p>

          <p className="el-copyright">
            © {new Date().getFullYear()} Woodlem Park School · All rights reserved
          </p>
        </div>
      </div>
    </div>
  );
};
