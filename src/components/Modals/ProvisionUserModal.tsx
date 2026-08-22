'use client';

import React, { useState } from 'react';
import { UserProfile } from '@/lib/supabaseClient';
import { CustomSelect } from '@/components/UI/CustomSelect';

const GRADES = ['9', '10', '11', '12'] as const;
const SECTIONS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)); // A through Z

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
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [emailPrefix, setEmailPrefix] = useState('');
  const [password, setPassword] = useState('woodlem123');
  const [role, setRole] = useState<'student' | 'teacher' | 'parent' | 'admin'>('student');
  const [admissionNumber, setAdmissionNumber] = useState('');

  // Student & Teacher Grade & Section fields
  const [grade, setGrade] = useState<'9' | '10' | '11' | '12'>('12');
  const [section, setSection] = useState<string>('A');

  // Teacher specific fields
  const [subject, setSubject] = useState('English');
  const [isClassTeacher, setIsClassTeacher] = useState(false);

  if (!isOpen) return null;

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

    const assignedClassStr = role === 'teacher' && isClassTeacher ? `${grade}-${section}` : null;
    const finalGrade = role === 'student' ? grade : (role === 'teacher' && isClassTeacher ? grade : undefined);
    const finalSection = role === 'student' ? section : (role === 'teacher' && isClassTeacher ? section : undefined);

    onSubmit({
      name: name.trim(),
      email: fullEmail,
      password,
      role,
      userCode: finalAdmissionNo,
      admissionNumber: finalAdmissionNo,
      grade: finalGrade,
      classLetter: finalSection,
      subject: role === 'teacher' ? subject : null,
      assignedClass: assignedClassStr,
    });

    // Reset
    setName('');
    setEmailPrefix('');
    setPassword('woodlem123');
    setRole('student');
    setAdmissionNumber('');
    setGrade('12');
    setSection('A');
    setSubject('English');
    setIsClassTeacher(false);
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
                placeholder="e.g. sarah.j"
                value={emailPrefix}
                onChange={(e) => setEmailPrefix(e.target.value)}
                style={{ borderRadius: '6px 0 0 6px', flex: 1 }}
                required
              />
              <span
                style={{
                  background: 'var(--neutral-subtle, #F1F5F9)',
                  border: '1px solid var(--border-color)',
                  borderLeft: 'none',
                  padding: '10px 12px',
                  borderRadius: '0 6px 6px 0',
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                @woodlempark.ae
              </span>
            </div>
          </div>

          {/* Password */}
          <div className="form-group">
            <label className="form-label">Initial Password</label>
            <input
              type="text"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
              Default recommended password is <strong>woodlem123</strong>.
            </p>
          </div>

          {/* Admission Number */}
          <div className="form-group">
            <label className="form-label">
              {role === 'student' ? 'Admission Number' : role === 'teacher' ? 'Employee Code' : 'User Reference ID'}
            </label>
            <input
              type="text"
              className="form-input"
              placeholder={role === 'student' ? 'e.g. WPS-104829' : 'e.g. EMP-204'}
              value={admissionNumber}
              onChange={(e) => setAdmissionNumber(e.target.value)}
            />
          </div>

          {/* ── STUDENT COHORT FIELDS ── */}
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
                Class Assignment (Grades 9–12)
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
                        border: grade === g ? '2px solid #2C6E6A' : '1.5px solid #CBD5E1',
                        background: grade === g ? '#EAF3EF' : '#fff',
                        color: grade === g ? '#20554E' : '#64748B',
                        fontWeight: 700,
                        fontSize: 13,
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
                <label className="form-label">Section (A through Z)</label>
                <CustomSelect
                  value={section}
                  onChange={(val) => setSection(val)}
                  options={SECTIONS.map((s) => ({
                    value: s,
                    label: `Section ${s}`,
                  }))}
                />
                <p style={{ fontSize: 12, color: '#64748B', marginTop: 8 }}>
                  Assigning student to: <strong>Grade {grade} — Section {section}</strong>
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
                Teacher Details &amp; Class Assignment
              </p>

              {/* Subject */}
              <div className="form-group">
                <label className="form-label">Teaching Discipline / Subject <span style={{ color: '#EF4444' }}>*</span></label>
                <CustomSelect
                  value={subject}
                  onChange={(val) => setSubject(val)}
                  options={SUBJECTS}
                />
              </div>

              {/* Class Teacher Toggle */}
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #E2E8F0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                  <input
                    type="checkbox"
                    checked={isClassTeacher}
                    onChange={(e) => setIsClassTeacher(e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: '#2C6E6A', cursor: 'pointer' }}
                  />
                  <span>Assign as Homeroom Class Teacher</span>
                </label>

                {isClassTeacher && (
                  <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12, padding: '12px', background: '#FFFFFF', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                    <div>
                      <label className="form-label" style={{ fontSize: 12 }}>Homeroom Grade</label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {GRADES.map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => setGrade(g)}
                            style={{
                              flex: 1,
                              padding: '8px 0',
                              borderRadius: 6,
                              border: grade === g ? '2px solid #2C6E6A' : '1px solid #CBD5E1',
                              background: grade === g ? '#EAF3EF' : '#FFFFFF',
                              color: grade === g ? '#20554E' : '#64748B',
                              fontWeight: 700,
                              fontSize: 12.5,
                              cursor: 'pointer',
                            }}
                          >
                            Grade {g}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="form-label" style={{ fontSize: 12 }}>Homeroom Section (A–Z)</label>
                      <CustomSelect
                        value={section}
                        onChange={(val) => setSection(val)}
                        options={SECTIONS.map((s) => ({
                          value: s,
                          label: `Section ${s}`,
                        }))}
                      />
                    </div>

                    <p style={{ fontSize: 12, color: '#2C6E6A', fontWeight: 600, margin: 0 }}>
                      Class Teacher of: <strong>Grade {grade} — Section {section}</strong>
                    </p>
                  </div>
                )}
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
