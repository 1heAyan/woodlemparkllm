'use client';

import React, { useState, useEffect } from 'react';
import { UserProfile } from '@/lib/supabaseClient';
import { CustomSelect } from '@/components/UI/CustomSelect';

const GRADES = ['10', '12'] as const;
const SECTIONS = ['A', 'B', 'C', 'D'] as const;
const ALL_SESSIONS = GRADES.flatMap((g) => SECTIONS.map((s) => `${g}-${s}`));

const SUBJECTS = [
  'English',
  'Math',
  'Physics',
  'Chemistry',
  'Biology',
  'History',
  'Geography',
  'Computer Science',
  'Islamic Studies',
  'Physical Education',
  'Art & Design',
];

interface EditUserModalProps {
  isOpen: boolean;
  user: UserProfile | null;
  profiles: UserProfile[];
  onClose: () => void;
  onSubmit: (updatedUser: UserProfile) => void;
}

export const EditUserModal: React.FC<EditUserModalProps> = ({
  isOpen,
  user,
  profiles,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'student' | 'teacher' | 'admin' | 'parent'>('student');
  const [userCode, setUserCode] = useState('');

  // Student fields
  const [grade, setGrade] = useState<'10' | '12'>('10');
  const [section, setSection] = useState<'A' | 'B' | 'C' | 'D'>('A');

  // Teacher fields
  const [subject, setSubject] = useState('English');
  const [assignedClass, setAssignedClass] = useState<string>('none');

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setRole(user.role || 'student');
      setUserCode(user.user_code || user.admission_number || '');

      // Parse student grade — constrain to 10 or 12
      if (user.grade === '10' || user.grade === '12') {
        setGrade(user.grade as '10' | '12');
      } else if (user.grade) {
        // Legacy values: try to extract number
        const match = user.grade.match(/(\d+)/);
        const num = match ? parseInt(match[1]) : 0;
        setGrade(num >= 11 ? '12' : '10');
      } else {
        setGrade('10');
      }

      // Parse section — constrain to A-D
      const rawSection = (user.class_letter || '').toUpperCase();
      setSection((['A', 'B', 'C', 'D'] as const).includes(rawSection as any)
        ? (rawSection as 'A' | 'B' | 'C' | 'D')
        : 'A');

      // Teacher subject
      setSubject(user.subject || 'English');

      // Teacher class assignment
      setAssignedClass(user.assigned_class || 'none');
    }
  }, [user]);

  if (!isOpen || !user) return null;

  // Sessions taken by OTHER teachers (exclude this teacher's own current assignment)
  const takenSessions = new Set(
    profiles
      .filter((p) => p.role === 'teacher' && p.assigned_class && p.id !== user.id)
      .map((p) => p.assigned_class as string)
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    let cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes('@')) {
      cleanEmail = `${cleanEmail}@woodlempark.ae`;
    }

    onSubmit({
      ...user,
      name: name.trim(),
      email: cleanEmail,
      role,
      user_code: userCode.trim(),
      admission_number: userCode.trim(),
      grade: role === 'student' ? grade : undefined,
      class_letter: role === 'student' ? section : undefined,
      subject: role === 'teacher' ? subject : null,
      assigned_class: role === 'teacher' && assignedClass !== 'none' ? assignedClass : null,
    });
    onClose();
  };

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Edit User Account</h2>
          <button type="button" className="close-modal" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Role */}
          <div className="form-group">
            <label className="form-label">Role</label>
            <CustomSelect
              value={role}
              onChange={(val) => setRole(val as any)}
              options={[
                { value: 'student', label: 'Student' },
                { value: 'teacher', label: 'Teacher' },
                { value: 'parent', label: 'Parent' },
                { value: 'admin', label: 'Admin' },
              ]}
            />
          </div>

          {/* Full Name */}
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {/* Email */}
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {/* Admission Number */}
          <div className="form-group">
            <label className="form-label">Admission Number / Reg. Code</label>
            <input
              type="text"
              className="form-input"
              value={userCode}
              onChange={(e) => setUserCode(e.target.value)}
              placeholder="e.g. WPS-2026"
            />
          </div>

          {/* ── STUDENT FIELDS ── */}
          {role === 'student' && (
            <div
              style={{
                background: 'var(--bg-secondary, #F8FAFC)',
                border: '1px solid var(--neutral-light, #E2E8F0)',
                borderRadius: 10,
                padding: '16px',
                marginTop: 4,
              }}
            >
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Class Assignment
              </p>

              {/* Grade toggle */}
              <div className="form-group">
                <label className="form-label">Grade</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {GRADES.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGrade(g)}
                      style={{
                        flex: 1,
                        padding: '10px 0',
                        borderRadius: 8,
                        border: grade === g ? '2px solid #4F46E5' : '1.5px solid #CBD5E1',
                        background: grade === g ? '#EEF2FF' : '#fff',
                        color: grade === g ? '#4F46E5' : '#64748B',
                        fontWeight: 700,
                        fontSize: 14,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      Grade {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Section buttons */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Section</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {SECTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSection(s)}
                      style={{
                        flex: 1,
                        padding: '10px 0',
                        borderRadius: 8,
                        border: section === s ? '2px solid #4F46E5' : '1.5px solid #CBD5E1',
                        background: section === s ? '#EEF2FF' : '#fff',
                        color: section === s ? '#4F46E5' : '#64748B',
                        fontWeight: 700,
                        fontSize: 14,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: 12, color: '#64748B', marginTop: 8 }}>
                  Assigning to: <strong>Grade {grade} — Section {section}</strong>
                </p>
              </div>
            </div>
          )}

          {/* ── TEACHER FIELDS ── */}
          {role === 'teacher' && (
            <div
              style={{
                background: 'var(--bg-secondary, #F8FAFC)',
                border: '1px solid var(--neutral-light, #E2E8F0)',
                borderRadius: 10,
                padding: '16px',
                marginTop: 4,
              }}
            >
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Teacher Details
              </p>

              {/* Subject (required) */}
              <div className="form-group">
                <label className="form-label">Subject <span style={{ color: '#EF4444' }}>*</span></label>
                <CustomSelect
                  value={subject}
                  onChange={(val) => setSubject(val)}
                  options={SUBJECTS}
                />
              </div>

              {/* Class Teacher Assignment (optional) */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  Class Teacher Assignment
                  <span style={{ fontSize: 11, color: '#64748B', fontWeight: 400, marginLeft: 6 }}>(optional)</span>
                </label>
                <CustomSelect
                  value={assignedClass}
                  onChange={(val) => setAssignedClass(val)}
                  options={[
                    { value: 'none', label: '— None (Subject Teacher Only) —' },
                    ...ALL_SESSIONS.map((session) => {
                      const isTaken = takenSessions.has(session);
                      return {
                        value: session,
                        label: `Grade ${session.split('-')[0]} — Section ${session.split('-')[1]}${isTaken ? ' (Taken)' : ''}`,
                        disabled: isTaken,
                      };
                    }),
                  ]}
                />
                <p style={{ fontSize: 12, color: '#64748B', marginTop: 6 }}>
                  {assignedClass === 'none'
                    ? 'This teacher will be a subject teacher with no class ownership.'
                    : `This teacher will be the Class Teacher of Grade ${assignedClass.split('-')[0]} — Section ${assignedClass.split('-')[1]}.`}
                </p>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" style={{ flex: 1 }}>
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
