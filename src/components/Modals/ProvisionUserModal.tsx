'use client';

import React, { useState } from 'react';
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

interface ProvisionUserModalProps {
  isOpen: boolean;
  profiles: UserProfile[];
  onClose: () => void;
  onSubmit: (userData: {
    name: string;
    email: string;
    password: string;
    role: 'student' | 'teacher' | 'parent' | 'admin';
    userCode: string;
    admissionNumber?: string;
    grade?: string;
    classLetter?: string;
    subject?: string | null;
    assignedClass?: string | null;
  }) => void;
}

export const ProvisionUserModal: React.FC<ProvisionUserModalProps> = ({
  isOpen,
  profiles,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [emailPrefix, setEmailPrefix] = useState('');
  const [password, setPassword] = useState('woodlem123');
  const [role, setRole] = useState<'student' | 'teacher' | 'parent' | 'admin'>('student');
  const [admissionNumber, setAdmissionNumber] = useState('');

  // Student fields
  const [grade, setGrade] = useState<'10' | '12'>('10');
  const [section, setSection] = useState<'A' | 'B' | 'C' | 'D'>('A');

  // Teacher fields
  const [subject, setSubject] = useState('English');
  const [assignedClass, setAssignedClass] = useState<string>('none');

  if (!isOpen) return null;

  // Sessions taken by other teachers
  const takenSessions = new Set(
    profiles
      .filter((p) => p.role === 'teacher' && p.assigned_class)
      .map((p) => p.assigned_class as string)
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !emailPrefix.trim() || !password) return;
    if (password.length < 6) {
      alert('Password must be at least 6 characters long.');
      return;
    }

    let cleanPrefix = emailPrefix.trim().toLowerCase();
    if (cleanPrefix.endsWith('@woodlempark.ae')) {
      cleanPrefix = cleanPrefix.replace('@woodlempark.ae', '');
    }
    const fullEmail = `${cleanPrefix}@woodlempark.ae`;
    const finalAdmissionNo =
      admissionNumber.trim() || `WPS-${Math.floor(100000 + Math.random() * 900000)}`;

    onSubmit({
      name: name.trim(),
      email: fullEmail,
      password,
      role,
      userCode: finalAdmissionNo,
      admissionNumber: finalAdmissionNo,
      grade: role === 'student' ? grade : undefined,
      classLetter: role === 'student' ? section : undefined,
      subject: role === 'teacher' ? subject : null,
      assignedClass: role === 'teacher' && assignedClass !== 'none' ? assignedClass : null,
    });

    // Reset
    setName('');
    setEmailPrefix('');
    setPassword('woodlem123');
    setRole('student');
    setAdmissionNumber('');
    setGrade('10');
    setSection('A');
    setSubject('English');
    setAssignedClass('none');
    onClose();
  };

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Provision New User Account</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              Create an individual account with default password <strong>woodlem123</strong>.
            </p>
          </div>
          <button type="button" className="close-modal" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Role */}
          <div className="form-group">
            <label className="form-label">User Role</label>
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
              placeholder="e.g. Sarah Jenkins"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {/* Email */}
          <div className="form-group">
            <label className="form-label">Email Username (Domain: @woodlempark.ae)</label>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <input
                type="text"
                className="form-input"
                style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
                placeholder="e.g. sarah.j"
                value={emailPrefix}
                onChange={(e) => setEmailPrefix(e.target.value)}
                required
              />
              <span
                style={{
                  background: '#EEF2FF',
                  border: '1px solid var(--neutral-light, #CBD5E1)',
                  borderLeft: 'none',
                  padding: '12px 14px',
                  borderTopRightRadius: 8,
                  borderBottomRightRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#4F46E5',
                  whiteSpace: 'nowrap',
                }}
              >
                @woodlempark.ae
              </span>
            </div>
          </div>

          {/* Password */}
          <div className="form-group">
            <label className="form-label">Account Password</label>
            <input
              type="text"
              className="form-input"
              placeholder="Default: woodlem123"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
            <span style={{ fontSize: 11, color: '#64748B', marginTop: 4, display: 'block' }}>
              Standard default initial password: <code>woodlem123</code>
            </span>
          </div>

          {/* Admission Number */}
          <div className="form-group">
            <label className="form-label">Admission Number / Reg. Code</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. 10452 or WPS-2026"
              value={admissionNumber}
              onChange={(e) => setAdmissionNumber(e.target.value)}
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

              {/* Section dropdown */}
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

          <button type="submit" className="btn-primary" style={{ width: '100%', padding: 14, marginTop: 16 }}>
            Create &amp; Provision User Account
          </button>
        </form>
      </div>
    </div>
  );
};
