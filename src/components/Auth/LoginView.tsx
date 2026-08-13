'use client';

import React, { useState } from 'react';
import { supabase, UserProfile } from '@/lib/supabaseClient';

interface LoginViewProps {
  onLoginSuccess: (profile: UserProfile) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [role, setRole] = useState<'student' | 'teacher' | 'admin' | 'parent'>('admin');
  const [email, setEmail] = useState('admin@woodlem.com');
  const [password, setPassword] = useState('Woddlem@aljurf');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const roles = [
    { id: 'student', label: 'Student', idx: 0 },
    { id: 'teacher', label: 'Teacher', idx: 1 },
    { id: 'admin', label: 'Admin', idx: 2 },
    { id: 'parent', label: 'Parent', idx: 3 },
  ] as const;

  const handleRoleSelect = (selectedRole: 'student' | 'teacher' | 'admin' | 'parent') => {
    setRole(selectedRole);
    setErrorMessage('');
    if (selectedRole === 'admin') {
      setEmail('admin@woodlem.com');
      setPassword('Woddlem@aljurf');
    } else {
      setEmail('');
      setPassword('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      let authUser: any = null;

      // 1. Production Authentication via Supabase Auth
      let { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password,
      });

      // Special fallback handling for initial Admin setup or provisioned accounts
      if (authError || !authData.user) {
        if (cleanEmail === 'admin@woodlem.com') {
          // Auto-register initial Admin account into Supabase Auth if missing
          const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
            email: cleanEmail,
            password: password,
            options: {
              data: {
                name: 'System Admin',
                role: 'admin',
                user_code: 'ADM-001',
              },
            },
          });

          if (!signUpErr && signUpData.user) {
            authUser = signUpData.user;
          } else {
            // Try signing in again if sign-up returned user without throwing
            const retryRes = await supabase.auth.signInWithPassword({
              email: cleanEmail,
              password: password,
            });
            if (retryRes.data?.user) {
              authUser = retryRes.data.user;
            } else {
              throw new Error(authError?.message || 'Invalid login credentials for Admin account.');
            }
          }
        } else {
          throw new Error(authError?.message || 'Invalid login credentials. Please check your email and password.');
        }
      } else {
        authUser = authData.user;
      }

      if (!authUser) {
        throw new Error('Authentication failed. User account not found.');
      }

      const userId = authUser.id;

      // 2. Query profiles table by authenticated user ID or email
      let { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!profile) {
        let { data: altProf } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', cleanEmail)
          .maybeSingle();

        if (altProf) {
          profile = altProf;
          // Update profile ID to match Supabase Auth UID so future queries by ID succeed
          if (profile.id !== userId) {
            const oldId = profile.id;
            profile.id = userId;
            await supabase.from('profiles').update({ id: userId }).eq('email', cleanEmail);
          }
        }
      }

      // If user profile is missing (e.g. initial admin setup), auto-create admin profile row in profiles table
      if (!profile && cleanEmail === 'admin@woodlem.com') {
        const adminProf: UserProfile = {
          id: userId,
          email: 'admin@woodlem.com',
          name: 'System Admin',
          role: 'admin',
          user_code: 'ADM-001',
        };
        await supabase.from('profiles').upsert([adminProf], { onConflict: 'email' });
        profile = adminProf;
      }

      if (!profile) {
        throw new Error('User profile record missing in database profiles table. Please contact your Admin.');
      }

      onLoginSuccess(profile);
    } catch (err: any) {
      console.error('Sign-in error:', err);
      setErrorMessage(err.message || 'Invalid credentials. Please check your email and password.');
    } finally {
      setLoading(false);
    }
  };

  const activeIdx = roles.findIndex((r) => r.id === role);

  return (
    <div className="login-view-container">
      <main className="login-card">
        <div className="brand-header">
          <img src="/image_35dba9.jpeg" alt="Woodlem Park" className="brand-logo" />
          <h1 className="login-title">Woodlem Portal</h1>
          <p className="login-subtitle">Sign in to your account</p>
        </div>

        <div className="role-toggle-container">
          <div
            className="role-toggle-slider"
            style={{ transform: `translateX(calc(${activeIdx * 100}%))` }}
          ></div>
          {roles.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`role-toggle-btn ${role === r.id ? 'active' : ''}`}
              onClick={() => handleRoleSelect(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>

        {errorMessage && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 8,
              background: 'var(--primary-light)',
              color: 'var(--primary)',
              fontSize: 13,
              marginBottom: 20,
              lineHeight: 1.4,
              border: '1px solid var(--primary)',
            }}
          >
            ❌ {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input"
              placeholder="e.g. admin@woodlem.com"
              required
              autoComplete="off"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input"
              placeholder="••••••••"
              required
            />
          </div>
          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ width: '100%', marginTop: 8, padding: 14 }}
          >
            {loading ? 'Authenticating with Supabase…' : 'Secure Sign In'}
          </button>
        </form>
      </main>
    </div>
  );
};
