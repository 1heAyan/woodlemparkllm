'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, ParentDocument, SubjectClass } from '@/lib/supabaseClient';
import { CustomSelect } from '@/components/UI/CustomSelect';
import { resolveUserPassword, saveUserPasswordToCloudAndLocal } from '@/lib/passwordHelper';
import { extractClassTeacherInfo } from '@/lib/classTeacherHelper';
import { isPrincipalUser } from '@/lib/specialRolesHelper';
import { sanitizeUserCode } from '@/lib/userCodeHelper';
import { Eye, EyeOff, Lock, FileText, CheckCircle2, Clock, AlertCircle, AlertTriangle, Crown, KeyRound, Copy, RotateCcw } from 'lucide-react';
import { getOrGenerateStudentParentCode, generateParentLinkCode } from '@/lib/parentCodeHelper';

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

interface EditUserModalProps {
  isOpen: boolean;
  user: UserProfile | null;
  profiles: UserProfile[];
  parentDocuments?: ParentDocument[];
  subjectClasses?: SubjectClass[];
  onClose: () => void;
  onSubmit: (updatedUser: UserProfile) => Promise<void> | void;
}

export const EditUserModal: React.FC<EditUserModalProps> = ({
  isOpen,
  user,
  profiles = [],
  parentDocuments = [],
  subjectClasses = [],
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'student' | 'teacher' | 'admin' | 'parent' | 'principal'>('student');
  const [userCode, setUserCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [parentLinkCode, setParentLinkCode] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  // Student & Teacher Grade & Section
  const [grade, setGrade] = useState<'9' | '10' | '11' | '12'>('12');
  const [section, setSection] = useState<string>('A');

  // Teacher specific fields
  const [subject, setSubject] = useState('English');
  const [isClassTeacher, setIsClassTeacher] = useState(false);

  // Parent specific linked students
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');

  const studentProfiles = useMemo(() => {
    return profiles.filter((p) => p.role === 'student');
  }, [profiles]);

  const filteredStudentProfiles = useMemo(() => {
    if (!studentSearchTerm.trim()) return studentProfiles;
    const q = studentSearchTerm.toLowerCase();
    return studentProfiles.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.admission_number && s.admission_number.toLowerCase().includes(q)) ||
        (s.user_code && s.user_code.toLowerCase().includes(q)) ||
        (s.grade && s.grade.toLowerCase().includes(q))
    );
  }, [studentProfiles, studentSearchTerm]);

  // Scoped documents: ONLY for this parent's linked wards
  const parentDocs = useMemo(() => {
    if (role !== 'parent') return [];
    const linkedSet = new Set(selectedStudentIds);
    return parentDocuments.filter((d) => linkedSet.has(d.student_id));
  }, [role, selectedStudentIds, parentDocuments]);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setRole(user.role || 'student');
      setUserCode(sanitizeUserCode(user.user_code || user.admission_number, user.email));
      setPassword(resolveUserPassword(user));
      setShowPassword(false);
      setSelectedStudentIds(user.linked_student_ids || []);
      setStudentSearchTerm('');

      const classInfo = extractClassTeacherInfo(user, subjectClasses);
      setGrade(classInfo.grade);
      setSection(classInfo.section);
      setIsClassTeacher(classInfo.isClassTeacher);
      setSubject(user.subject || 'English');
      setParentLinkCode(user.parent_link_code || getOrGenerateStudentParentCode(user));
    }
  }, [user, subjectClasses]);

  useEffect(() => {
    const handlePwdEvent = (e: any) => {
      const detail = e.detail;
      if (!detail || !user) return;
      const cleanTargetEmail = (email || user.email || '').toLowerCase().trim();
      const eventEmail = (detail.email || '').toLowerCase().trim();
      if (
        (detail.userId && user.id && detail.userId === user.id) ||
        (eventEmail && cleanTargetEmail && eventEmail === cleanTargetEmail)
      ) {
        if (detail.newPassword) {
          setPassword(detail.newPassword);
        }
      }
    };
    window.addEventListener('woodlem-password-updated', handlePwdEvent);
    return () => window.removeEventListener('woodlem-password-updated', handlePwdEvent);
  }, [user, email]);

  const targetClassKey = `${grade}-${section}`;

  const existingClassTeacher = useMemo(() => {
    if (role !== 'teacher' || !isClassTeacher || !user) return null;
    return profiles.find((p) => {
      if (
        p.id === user.id ||
        (p.email && user.email && p.email.toLowerCase().trim() === user.email.toLowerCase().trim()) ||
        (p.email && email && p.email.toLowerCase().trim() === email.trim().toLowerCase())
      ) {
        return false;
      }
      if (p.role !== 'teacher') return false;
      const pInfo = extractClassTeacherInfo(p, subjectClasses);
      return pInfo.isClassTeacher && pInfo.classKey === targetClassKey;
    });
  }, [profiles, role, isClassTeacher, targetClassKey, user, email, subjectClasses]);

  // Duplicate admission/user code detection ONLY within the same role
  const duplicateCodeUser = useMemo(() => {
    if (!user || role === 'parent') return null;
    const clean = sanitizeUserCode(userCode, email).toLowerCase();
    if (!clean || clean === '—' || clean === '-' || clean === 'null' || clean === 'undefined') {
      return null;
    }
    return profiles.find(
      (p) =>
        p.id !== user.id &&
        p.email.toLowerCase() !== user.email.toLowerCase() &&
        p.email.toLowerCase() !== email.trim().toLowerCase() &&
        p.role === role &&
        ((p.admission_number && sanitizeUserCode(p.admission_number, p.email).toLowerCase() === clean) ||
          (p.user_code && sanitizeUserCode(p.user_code, p.email).toLowerCase() === clean))
    );
  }, [profiles, userCode, user, email, role]);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      alert('Please provide both Full Name and Email Address.');
      return;
    }

    if (role === 'teacher' && isClassTeacher && existingClassTeacher) {
      alert(
        `Cannot assign as Class Teacher: Grade ${grade}-${section} is already assigned to ${existingClassTeacher.name} (${existingClassTeacher.subject || 'Faculty'}). Each class section can only have one Class Teacher.`
      );
      return;
    }

    if (role !== 'parent' && duplicateCodeUser) {
      alert(`Cannot save: Code "${userCode.trim()}" is already assigned to another ${role.toUpperCase()} account (${duplicateCodeUser.name}).`);
      return;
    }

    let cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes('@')) {
      cleanEmail = `${cleanEmail}@woodlempark.ae`;
    }

    const duplicateEmailUser = profiles.find(
      (p) =>
        p.id !== user.id &&
        p.email.toLowerCase().trim() === cleanEmail
    );
    if (duplicateEmailUser) {
      alert(`Cannot save: Email "${cleanEmail}" is already in use by ${duplicateEmailUser.name} (${duplicateEmailUser.role.toUpperCase()}). Every user must have a unique email.`);
      return;
    }

    const assignedClassStr = role === 'teacher' && isClassTeacher ? `${grade}-${section}` : null;
    const finalGrade = role === 'student' ? grade : role === 'teacher' && isClassTeacher ? grade : '';
    const finalSection = role === 'student' ? section : role === 'teacher' && isClassTeacher ? section : '';
    const finalPassword = password.trim() || resolveUserPassword(user);

    setIsSubmitting(true);
    try {
      await saveUserPasswordToCloudAndLocal(user.id, cleanEmail, finalPassword);

      await onSubmit({
        ...user,
        name: name.trim(),
        email: cleanEmail,
        role,
        user_code: role === 'parent' ? undefined : (sanitizeUserCode(userCode.trim(), cleanEmail) || undefined),
        admission_number: role === 'parent' ? undefined : (sanitizeUserCode(userCode.trim(), cleanEmail) || undefined),
        temp_password: finalPassword,
        grade: finalGrade,
        class_letter: finalSection,
        subject: role === 'teacher' ? subject : null,
        assigned_class: assignedClassStr,
        linked_student_ids: role === 'parent' ? selectedStudentIds : user.linked_student_ids,
        parent_link_code: role === 'student' ? (parentLinkCode.trim() || undefined) : undefined,
      });
      onClose();
    } catch (err: any) {
      console.error('Edit user submission error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Edit User Account &amp; Credentials</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              View and update profile credentials, login passwords, and cohort mappings.
            </p>
          </div>
          <button type="button" className="close-modal" onClick={onClose}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Role */}
          <div className="form-group">
            <label className="form-label">Account Role</label>
            {user && isPrincipalUser(user) ? (
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: 6,
                  background: '#FEF3C7',
                  border: '1px solid #F59E0B',
                  color: '#92400E',
                  fontSize: 12,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Crown size={14} /> Principal &amp; Executive Head (Immutable Institutional Authority)
              </div>
            ) : (
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
            )}
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

          {/* User Code / Admission Number (Students & Teachers only, parents don't need admission code) */}
          {role !== 'parent' && (
            <div className="form-group">
              <label className="form-label">
                {role === 'student'
                  ? 'Admission Number'
                  : role === 'teacher'
                  ? 'Employee Code'
                  : 'User Reference Code'}
              </label>
              <input
                type="text"
                className="form-input"
                value={userCode}
                onChange={(e) => setUserCode(e.target.value)}
                style={{
                  borderColor: duplicateCodeUser ? '#DC2626' : undefined,
                  background: duplicateCodeUser ? '#FEF2F2' : undefined,
                }}
                required
              />
              {duplicateCodeUser && (
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 11.5,
                    color: '#DC2626',
                    background: '#FEF2F2',
                    border: '1px solid #FECACA',
                    padding: '6px 10px',
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span>⚠️ <strong>Conflict:</strong> This code is already in use by <strong>{duplicateCodeUser.name}</strong> ({duplicateCodeUser.role.toUpperCase()}).</span>
                </div>
              )}
            </div>
          )}

          {/* ── PASSWORD MANAGEMENT SECTION ── */}
          <div
            style={{
              background: '#FAF9F6',
              border: '1px solid #E8E5DF',
              borderRadius: 8,
              padding: '14px 16px',
              marginBottom: 16,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--neutral-dark)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  margin: 0,
                }}
              >
                <Lock size={14} style={{ color: '#2C6E6A' }} />
                Account Login Password
              </label>
              <button
                type="button"
                onClick={() => setPassword('woodlem123')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2C6E6A',
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: 0,
                }}
              >
                Reset to Default (woodlem123)
              </button>
            </div>

            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter account password (min 6 characters)"
                style={{
                  paddingRight: 40,
                  fontFamily: showPassword ? 'inherit' : 'monospace',
                  letterSpacing: showPassword ? 'normal' : '0.12em',
                  background: '#FFFFFF',
                }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Hide Password' : 'Show Password'}
                style={{
                  position: 'absolute',
                  right: 10,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#6B6963',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 4,
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
              You can view and modify this user&apos;s password directly. Default is <strong>woodlem123</strong>.
            </p>
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
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  marginBottom: 12,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Student Class Assignment (Grades 9–12)
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
                        padding: '8px',
                        borderRadius: 6,
                        border: grade === g ? '1.5px solid #2D2C2A' : '1px solid var(--border-color)',
                        background: grade === g ? '#2D2C2A' : '#FFFFFF',
                        color: grade === g ? '#FFFFFF' : 'var(--neutral-dark)',
                        fontWeight: grade === g ? 700 : 500,
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      Grade {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Section dropdown */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Section (A–Z)</label>
                <CustomSelect
                  value={section}
                  onChange={(val) => setSection(val)}
                  options={SECTIONS.map((s) => ({
                    value: s,
                    label: `Section ${s}`,
                  }))}
                  searchable={true}
                />
              </div>

              <div
                style={{
                  marginTop: 12,
                  padding: '8px 12px',
                  background: '#EAF3EF',
                  borderRadius: 6,
                  fontSize: 12,
                  color: '#2D6E5D',
                  fontWeight: 600,
                }}
              >
                Assigned Cohort: <strong>Grade {grade}-{section}</strong>
              </div>

              {/* Student Parent Link Code Field */}
              <div className="form-group" style={{ marginTop: 14, marginBottom: 0 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                  <KeyRound size={13} color="#2D6E5D" />
                  Parent Verification Code (6-Digit Link Code)
                </label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="text"
                    className="form-input"
                    value={parentLinkCode}
                    onChange={(e) => setParentLinkCode(e.target.value.toUpperCase())}
                    style={{
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      color: '#2D6E5D',
                      background: '#F0F9F7',
                      border: '1.5px solid #2D6E5D',
                    }}
                    placeholder="e.g. PL-748921"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (navigator.clipboard) {
                        navigator.clipboard.writeText(parentLinkCode);
                        setCopiedCode(true);
                        setTimeout(() => setCopiedCode(false), 2000);
                      }
                    }}
                    className="btn-copy-code"
                    style={{ padding: '8px 12px' }}
                    title="Copy Code"
                  >
                    {copiedCode ? <CheckCircle2 size={15} color="#059669" /> : <Copy size={15} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const newCode = generateParentLinkCode(user?.id);
                      setParentLinkCode(newCode);
                    }}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: '1px solid var(--border-color)',
                      background: '#FFFFFF',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                    title="Generate New Code"
                  >
                    <RotateCcw size={15} />
                  </button>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                  Parents will enter this code when registering or linking this student account.
                </p>
              </div>
            </div>
          )}

          {/* ── TEACHER FIELDS: SUBJECT & HOMEROOM ── */}
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
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  marginBottom: 12,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Faculty Subject &amp; Class Teacher Designation
              </p>

              {/* Subject */}
              <div className="form-group">
                <label className="form-label">Subject Specialization</label>
                <CustomSelect
                  value={subject}
                  onChange={(val) => setSubject(val)}
                  options={SUBJECTS.map((s) => ({ value: s, label: s }))}
                  searchable={true}
                />
              </div>

              {/* Class Teacher Toggle */}
              <div
                style={{
                  borderTop: '1px solid var(--border-color)',
                  paddingTop: 12,
                  marginTop: 8,
                }}
              >
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--neutral-dark)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isClassTeacher}
                    onChange={(e) => setIsClassTeacher(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: '#2D2C2A', cursor: 'pointer' }}
                  />
                  <span>Designate as Class Teacher</span>
                </label>

                {isClassTeacher && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: '12px',
                      background: '#FFFFFF',
                      borderRadius: 8,
                      border: '1px solid #D1E5DE',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    <div>
                      <label className="form-label" style={{ fontSize: 12 }}>
                        Assigned Grade
                      </label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {GRADES.map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => setGrade(g)}
                            style={{
                              flex: 1,
                              padding: '6px',
                              borderRadius: 4,
                              border: grade === g ? '1.5px solid #2D2C2A' : '1px solid var(--border-color)',
                              background: grade === g ? '#2D2C2A' : '#FFFFFF',
                              color: grade === g ? '#FFFFFF' : 'var(--neutral-dark)',
                              fontWeight: grade === g ? 700 : 500,
                              fontSize: 12,
                              cursor: 'pointer',
                            }}
                          >
                            Grade {g}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="form-label" style={{ fontSize: 12 }}>
                        Assigned Section (A–Z)
                      </label>
                      <CustomSelect
                        value={section}
                        onChange={(val) => setSection(val)}
                        options={SECTIONS.map((s) => ({
                          value: s,
                          label: `Section ${s}`,
                        }))}
                        searchable={true}
                      />
                    </div>

                    <p style={{ fontSize: 12, color: '#2C6E6A', fontWeight: 600, margin: 0 }}>
                      Class Teacher for: <strong>Grade {grade} — Section {section}</strong>
                    </p>

                    {existingClassTeacher && (
                      <div
                        style={{
                          padding: '10px 12px',
                          borderRadius: 6,
                          background: '#FDF1F0',
                          border: '1.5px solid #F5C6CB',
                          color: '#A83B38',
                          fontSize: 12,
                          lineHeight: 1.45,
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 8,
                        }}
                      >
                        <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                        <div>
                          <strong>Class Teacher Conflict:</strong>
                          <br />
                          <strong>{existingClassTeacher.name}</strong> (
                          {existingClassTeacher.subject || 'Faculty'}) is already the designated Class Teacher
                          for <strong>Grade {grade}-{section}</strong>.
                          <br />
                          <span style={{ fontSize: 11, color: '#782826' }}>
                            A class can only have one Class Teacher. Please reassign {existingClassTeacher.name} or
                            choose another section.
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── PARENT FIELDS: LINK STUDENT(S) & SUBMITTED DOCUMENTS ── */}
          {role === 'parent' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 4 }}>
              {/* Linked Wards Section */}
              <div
                style={{
                  background: '#F0F9F7',
                  border: '1px solid #C7E4D8',
                  borderRadius: 10,
                  padding: '16px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 8,
                  }}
                >
                  <p
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#265E5A',
                      margin: 0,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Linked Student / Ward(s)
                  </p>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#2D6E5D',
                      background: '#D6EFE5',
                      padding: '2px 8px',
                      borderRadius: 12,
                    }}
                  >
                    {selectedStudentIds.length} Linked
                  </span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.4 }}>
                  Select or update the student(s) this parent account is linked to.
                </p>

                {/* Student Search */}
                <input
                  type="text"
                  placeholder="Search student by name, grade, or admission no..."
                  value={studentSearchTerm}
                  onChange={(e) => setStudentSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    height: 32,
                    padding: '0 12px',
                    fontSize: 12,
                    borderRadius: 6,
                    border: '1px solid #E5E3DF',
                    background: '#FFFFFF',
                    color: '#1A1A1A',
                    outline: 'none',
                    boxSizing: 'border-box',
                    marginBottom: 10,
                  }}
                />

                <div
                  style={{
                    maxHeight: 180,
                    overflowY: 'auto',
                    border: '1px solid #D1E5DE',
                    borderRadius: 8,
                    background: '#FFFFFF',
                    padding: '4px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  {filteredStudentProfiles.length === 0 ? (
                    <div style={{ padding: '16px', textAlign: 'center', fontSize: 12, color: 'var(--text-secondary)' }}>
                      No students found matching search.
                    </div>
                  ) : (
                    filteredStudentProfiles.map((student) => {
                      const isSelected = selectedStudentIds.includes(student.id);
                      const gradeStr = student.grade ? `Grade ${student.grade.replace(/[^0-9]/g, '')}` : '';
                      const secStr = student.class_letter ? `-${student.class_letter.toUpperCase()}` : '';
                      const admStr = student.admission_number || student.user_code || 'No Code';

                      return (
                        <label
                          key={student.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '8px 10px',
                            borderRadius: 6,
                            background: isSelected ? '#EAF3F1' : 'transparent',
                            border: isSelected ? '1px solid #B8D9D4' : '1px solid transparent',
                            cursor: 'pointer',
                            transition: 'background 0.1s',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedStudentIds((prev) => [...prev, student.id]);
                              } else {
                                setSelectedStudentIds((prev) => prev.filter((id) => id !== student.id));
                              }
                            }}
                            style={{ width: 16, height: 16, accentColor: '#2C6E6A', cursor: 'pointer' }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--neutral-dark)' }}>
                              {student.name}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', gap: 8, marginTop: 1 }}>
                              <span>
                                {gradeStr}
                                {secStr}
                              </span>
                              <span>•</span>
                              <span style={{ fontFamily: 'monospace' }}>{admStr}</span>
                            </div>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Submitted Clearance Documents Section */}
              <div
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E8E5DF',
                  borderRadius: 10,
                  padding: '16px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 10,
                  }}
                >
                  <p
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#265E5A',
                      margin: 0,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Submitted Clearance Documents ({parentDocs.length})
                  </p>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    Scoped to this parent&apos;s linked wards only
                  </span>
                </div>

                {parentDocs.length === 0 ? (
                  <div
                    style={{
                      padding: '18px 14px',
                      textAlign: 'center',
                      background: '#FAF9F6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    <FileText size={14} />
                    <span>No clearance documents submitted yet for this parent&apos;s linked wards.</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {parentDocs.map((doc) => {
                      const ward = studentProfiles.find((s) => s.id === doc.student_id);
                      const wardName = ward ? ward.name : 'Linked Ward';
                      const wardGrade = ward?.grade
                        ? ` (Grade ${ward.grade.replace(/[^0-9]/g, '')}-${ward.class_letter || ''})`
                        : '';

                      return (
                        <div
                          key={doc.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 14px',
                            background: '#FAF9F6',
                            border: '1px solid #E8E5DF',
                            borderRadius: 8,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                            <div
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 6,
                                background: '#EAF3EF',
                                color: '#2D6E5D',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <FileText size={16} />
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                                {doc.doc_type}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                                Ward: <strong>{wardName}{wardGrade}</strong> • {doc.file_name}
                                {doc.uploaded_at ? ` • ${doc.uploaded_at}` : ''}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            <span
                              style={{
                                fontSize: 10.5,
                                fontWeight: 700,
                                padding: '2px 7px',
                                borderRadius: 4,
                                background: doc.status === 'submitted' ? '#EAF3EF' : '#FEF3C7',
                                color: doc.status === 'submitted' ? '#2D6E5D' : '#92400E',
                                border: doc.status === 'submitted' ? '1px solid #C7E4D8' : '1px solid #FDE68A',
                                textTransform: 'capitalize',
                              }}
                            >
                              {doc.status || 'submitted'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Submit Buttons */}
          <div className="modal-footer" style={{ marginTop: 24 }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting || (role === 'teacher' && isClassTeacher && !!existingClassTeacher)}
              style={{
                background: '#2D2C2A',
                color: '#FFFFFF',
                border: 'none',
                opacity: isSubmitting || (role === 'teacher' && isClassTeacher && !!existingClassTeacher) ? 0.6 : 1,
                cursor: isSubmitting || (role === 'teacher' && isClassTeacher && !!existingClassTeacher) ? 'not-allowed' : 'pointer',
              }}
            >
              {isSubmitting ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
