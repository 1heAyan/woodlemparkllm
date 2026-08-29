'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, ParentDocument, SubjectClass } from '@/lib/supabaseClient';
import { CustomSelect } from '@/components/UI/CustomSelect';
import { openFileInNewTab, downloadFile } from '@/lib/fileHelper';
import { resolveUserPassword, saveUserPasswordToCloudAndLocal } from '@/lib/passwordHelper';
import { extractClassTeacherInfo } from '@/lib/classTeacherHelper';
import { isPrincipalUser } from '@/lib/specialRolesHelper';
import { sanitizeUserCode } from '@/lib/userCodeHelper';
import {
  ArrowLeft,
  Lock,
  Eye,
  EyeOff,
  Save,
  User,
  FileText,
  AlertTriangle,
  Check,
  Shield,
  GraduationCap,
  Briefcase,
  Users,
  UserPlus,
  X,
  ExternalLink,
  Download,
  Search,
  Crown,
} from 'lucide-react';

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

interface UserDetailViewProps {
  user: UserProfile;
  profiles: UserProfile[];
  parentDocuments?: ParentDocument[];
  subjectClasses?: SubjectClass[];
  onBack: () => void;
  onSave: (updatedUser: UserProfile) => Promise<void> | void;
  onDelete?: (userId: string) => void;
}

export const UserDetailView: React.FC<UserDetailViewProps> = ({
  user,
  profiles = [],
  parentDocuments = [],
  subjectClasses = [],
  onBack,
  onSave,
  onDelete,
}) => {
  const initialClassInfo = useMemo(() => extractClassTeacherInfo(user, subjectClasses), [user, subjectClasses]);

  const [name, setName] = useState(user.name || '');
  const [email, setEmail] = useState(user.email || '');
  const [role, setRole] = useState<'student' | 'teacher' | 'admin' | 'parent' | 'principal'>(user.role || 'student');
  const [userCode, setUserCode] = useState(user.user_code || user.admission_number || '');
  const [password, setPassword] = useState(() => resolveUserPassword(user));
  const [showPassword, setShowPassword] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Student & Teacher Grade & Section initialized directly from user profile
  const [grade, setGrade] = useState<'9' | '10' | '11' | '12'>(() => initialClassInfo.grade);
  const [section, setSection] = useState<string>(() => initialClassInfo.section);

  // Teacher specific fields
  const [subject, setSubject] = useState(user.subject || 'English');
  const [isClassTeacher, setIsClassTeacher] = useState(() => initialClassInfo.isClassTeacher);

  // Parent specific linked students
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>(user.linked_student_ids || []);
  const [isLinkingMore, setIsLinkingMore] = useState(false);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');

  const studentProfiles = useMemo(() => {
    return profiles.filter((p) => p.role === 'student');
  }, [profiles]);

  // Already linked student objects
  const linkedStudentsList = useMemo(() => {
    return selectedStudentIds
      .map((id) => studentProfiles.find((s) => s.id === id))
      .filter((s): s is UserProfile => !!s);
  }, [selectedStudentIds, studentProfiles]);

  // Unlinked students for the "Link More" picker
  const availableToLink = useMemo(() => {
    const linkedSet = new Set(selectedStudentIds);
    const unlinked = studentProfiles.filter((s) => !linkedSet.has(s.id));
    if (!studentSearchTerm.trim()) return unlinked;
    const q = studentSearchTerm.toLowerCase();
    return unlinked.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.admission_number && s.admission_number.toLowerCase().includes(q)) ||
        (s.user_code && s.user_code.toLowerCase().includes(q)) ||
        (s.grade && s.grade.toLowerCase().includes(q))
    );
  }, [studentProfiles, selectedStudentIds, studentSearchTerm]);

  // Scoped documents: ONLY for this parent's linked wards
  const parentDocs = useMemo(() => {
    if (role !== 'parent') return [];
    const linkedSet = new Set(selectedStudentIds);
    return parentDocuments.filter((d) => linkedSet.has(d.student_id));
  }, [role, selectedStudentIds, parentDocuments]);

  useEffect(() => {
    setName(user.name || '');
    setEmail(user.email || '');
    setRole(user.role || 'student');
    setUserCode(sanitizeUserCode(user.user_code || user.admission_number, user.email));
    setShowPassword(false);
    setSelectedStudentIds(user.linked_student_ids || []);
    setIsLinkingMore(false);
    setStudentSearchTerm('');
    setSaveSuccess(false);

    const classInfo = extractClassTeacherInfo(user, subjectClasses);
    setGrade(classInfo.grade);
    setSection(classInfo.section);
    setIsClassTeacher(classInfo.isClassTeacher);
    setSubject(user.subject || 'English');
    setPassword(resolveUserPassword(user));
  }, [user, subjectClasses]);



  // Duplicate admission/employee code detection ONLY within the same role
  const duplicateCodeUser = useMemo(() => {
    if (!user) return null;
    const cleanCode = sanitizeUserCode(userCode, email).toLowerCase();
    if (!cleanCode || cleanCode === '—' || cleanCode === '-' || cleanCode === 'null' || cleanCode === 'undefined') {
      return null;
    }
    return profiles.find(
      (p) =>
        p.id !== user.id &&
        p.email.toLowerCase() !== user.email.toLowerCase() &&
        p.email.toLowerCase() !== email.trim().toLowerCase() &&
        p.role === role &&
        ((p.admission_number && sanitizeUserCode(p.admission_number, p.email).toLowerCase() === cleanCode) ||
          (p.user_code && sanitizeUserCode(p.user_code, p.email).toLowerCase() === cleanCode))
    );
  }, [profiles, userCode, user, email, role]);

  useEffect(() => {
    const handlePwdEvent = (e: any) => {
      const detail = e.detail;
      if (!detail) return;
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
  }, [user.id, user.email, email]);

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

    if (duplicateCodeUser) {
      alert(
        `Cannot save: Code "${userCode.trim()}" is already assigned to another ${role.toUpperCase()} account (${duplicateCodeUser.name}).`
      );
      return;
    }

    let cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes('@')) {
      cleanEmail = `${cleanEmail}@woodlempark.ae`;
    }

    const assignedClassStr = role === 'teacher' && isClassTeacher ? `${grade}-${section}` : null;
    const finalGrade = role === 'student' ? grade : role === 'teacher' && isClassTeacher ? grade : '';
    const finalSection = role === 'student' ? section : role === 'teacher' && isClassTeacher ? section : '';
    const finalPassword = password.trim() || resolveUserPassword(user);

    setIsSaving(true);
    try {
      await saveUserPasswordToCloudAndLocal(user.id, cleanEmail, finalPassword);

      await onSave({
        ...user,
        name: name.trim(),
        email: cleanEmail,
        role,
        user_code: sanitizeUserCode(userCode.trim(), cleanEmail),
        admission_number: sanitizeUserCode(userCode.trim(), cleanEmail),
        temp_password: finalPassword,
        grade: finalGrade,
        class_letter: finalSection,
        subject: role === 'teacher' ? subject : null,
        assigned_class: assignedClassStr,
        linked_student_ids: role === 'parent' ? selectedStudentIds : user.linked_student_ids,
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      console.error('Error saving user profile in UserDetailView:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const getRoleBadge = (r: string) => {
    switch (r) {
      case 'student':
        return { bg: '#EAF3EF', color: '#2D6E5D', border: '#C7E4D8', label: 'Student', icon: <GraduationCap size={14} /> };
      case 'teacher':
        return { bg: '#FEF3C7', color: '#92400E', border: '#FDE68A', label: 'Faculty / Teacher', icon: <Briefcase size={14} /> };
      case 'parent':
        return { bg: '#EDE9FE', color: '#6D28D9', border: '#DDD6FE', label: 'Parent / Guardian', icon: <Users size={14} /> };
      case 'admin':
        return { bg: '#1A1A1A', color: '#FFFFFF', border: '#1A1A1A', label: 'System Administrator', icon: <Shield size={14} /> };
      default:
        return { bg: '#F1F5F9', color: '#475569', border: '#E2E8F0', label: r, icon: <User size={14} /> };
    }
  };

  const roleInfo = getRoleBadge(role);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 40 }}>
      {/* ── TOP BREADCRUMB & BACK ROW ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              fontSize: 12.5,
              fontWeight: 600,
              color: 'var(--neutral-dark)',
              background: '#FFFFFF',
              border: '1px solid var(--border-color)',
              borderRadius: 6,
              cursor: 'pointer',
              transition: 'all 0.12s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#FFFFFF')}
          >
            <ArrowLeft size={14} />
            Back to User Directory
          </button>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>/</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
            Edit User Profile &amp; Credentials
          </span>
        </div>

        {saveSuccess && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: '#EAF3EF',
              color: '#2D6E5D',
              border: '1px solid #C7E4D8',
              padding: '6px 12px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            <Check size={14} /> Changes Saved Successfully
          </div>
        )}
      </div>

      {/* ── USER HERO PROFILE CARD ── */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid var(--border-color)',
          borderRadius: 10,
          padding: '20px 24px',
          marginBottom: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              background: roleInfo.bg,
              color: roleInfo.color,
              border: `1.5px solid ${roleInfo.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              fontWeight: 800,
            }}
          >
            {(name || 'U').charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: 'var(--neutral-dark)' }}>
                {name || 'Unnamed User'}
              </h1>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 9px',
                  borderRadius: 12,
                  background: roleInfo.bg,
                  color: roleInfo.color,
                  border: `1px solid ${roleInfo.border}`,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {roleInfo.icon}
                {roleInfo.label}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4 }}>
              <span>{email || 'No email provided'}</span>
              <span>•</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                ID: {userCode || user.id.slice(0, 8)}
              </span>
            </div>
          </div>
        </div>

        {isPrincipalUser(user) ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              background: '#FEF3C7',
              border: '1px solid #F59E0B',
              borderRadius: 6,
              color: '#92400E',
              fontSize: 11.5,
              fontWeight: 700,
            }}
          >
            <Lock size={13} /> Protected Principal Account
          </div>
        ) : onDelete && role !== 'admin' && (
          <div>
            <button
              type="button"
              onClick={() => {
                if (confirm(`Are you sure you want to delete profile for "${name}"? This action cannot be undone.`)) {
                  onDelete(user.id);
                  onBack();
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                fontSize: 12.5,
                fontWeight: 600,
                color: '#DC2626',
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              Delete User
            </button>
          </div>
        )}
      </div>

      {/* ── TWO-COLUMN FORM LAYOUT ── */}
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
          {/* ════ LEFT COLUMN: ACCOUNT & CREDENTIALS ════ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* CARD 1: Core Account Details */}
            <div
              style={{
                background: '#FFFFFF',
                border: '1px solid var(--border-color)',
                borderRadius: 10,
                padding: '20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              }}
            >
              <h2
                style={{
                  fontSize: 13.5,
                  fontWeight: 700,
                  color: 'var(--neutral-dark)',
                  margin: '0 0 14px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <User size={16} style={{ color: '#2C6E6A' }} />
                Account Identity &amp; Role
              </h2>

              <div className="form-group">
                <label className="form-label">Account Role</label>
                {isPrincipalUser(user) ? (
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
                      { value: 'teacher', label: 'Teacher / Faculty' },
                      { value: 'parent', label: 'Parent / Guardian' },
                      { value: 'admin', label: 'System Administrator' },
                    ]}
                  />
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Full Display Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ayaan Khan"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email Address (Login Username)</label>
                <input
                  type="email"
                  className="form-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. user@woodlempark.ae"
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  {role === 'student'
                    ? 'Student Admission Number'
                    : role === 'teacher'
                    ? 'Faculty Employee ID / Code'
                    : 'User Reference Code'}
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={userCode}
                  onChange={(e) => setUserCode(e.target.value)}
                  placeholder={role === 'student' ? 'e.g. 2026' : 'e.g. 104'}
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
                    <AlertTriangle size={13} style={{ flexShrink: 0 }} />
                    <span>
                      <strong>Duplicate Code:</strong> Already assigned to <strong>{duplicateCodeUser.name}</strong> ({duplicateCodeUser.role.toUpperCase()}).
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* CARD 2: Security & Login Password */}
            <div
              style={{
                background: '#FFFFFF',
                border: '1px solid var(--border-color)',
                borderRadius: 10,
                padding: '20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h2
                  style={{
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: 'var(--neutral-dark)',
                    margin: 0,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Lock size={16} style={{ color: '#2C6E6A' }} />
                  Security &amp; Login Password
                </h2>
                <button
                  type="button"
                  onClick={() => setPassword('woodlem123')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#2C6E6A',
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 0,
                  }}
                >
                  Reset to Default (woodlem123)
                </button>
              </div>

              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.4 }}>
                Admins can inspect the user&apos;s current password or set a new password directly.
              </p>

              <div className="form-group" style={{ marginBottom: 8 }}>
                <label className="form-label">Assigned Login Password</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter account password (min 6 characters)"
                    style={{
                      paddingRight: 42,
                      fontFamily: showPassword ? 'inherit' : 'monospace',
                      letterSpacing: showPassword ? 'normal' : '0.12em',
                      fontSize: 13.5,
                      background: '#FAF9F6',
                    }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? 'Hide Password' : 'Show Password'}
                    style={{
                      position: 'absolute',
                      right: 8,
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#6B6963',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 6,
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 6,
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  fontSize: 11.5,
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Shield size={14} style={{ color: '#2C6E6A', flexShrink: 0 }} />
                <span>
                  Password is saved to Supabase and used for student, teacher, and parent portal logins.
                </span>
              </div>
            </div>
          </div>

          {/* ════ RIGHT COLUMN: ACADEMIC MAPPING & ROLE SPECIFICS ════ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* ── STUDENT COHORT CARD ── */}
            {role === 'student' && (
              <div
                style={{
                  background: '#FFFFFF',
                  border: '1px solid var(--border-color)',
                  borderRadius: 10,
                  padding: '20px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                }}
              >
                <h2
                  style={{
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: 'var(--neutral-dark)',
                    margin: '0 0 14px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <GraduationCap size={16} style={{ color: '#2C6E6A' }} />
                  Academic Enrollment &amp; Class Cohort
                </h2>

                <div className="form-group">
                  <label className="form-label">Grade (9–12)</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    {GRADES.map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setGrade(g)}
                        style={{
                          padding: '10px',
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

                <div className="form-group">
                  <label className="form-label">Assigned Section</label>
                  <CustomSelect
                    value={section}
                    onChange={(val) => setSection(val)}
                    options={SECTIONS.map((s) => ({
                      value: s,
                      label: `Section ${s}`,
                    }))}
                  />
                </div>

                <div
                  style={{
                    marginTop: 16,
                    padding: '12px 14px',
                    background: '#EAF3EF',
                    borderRadius: 8,
                    border: '1px solid #C7E4D8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#265E5A', textTransform: 'uppercase' }}>
                      Active Academic Cohort
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#20554E', marginTop: 2 }}>
                      Grade {grade} — Section {section}
                    </div>
                  </div>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: '#2D6E5D' }}>CBSE Curriculum</span>
                </div>
              </div>
            )}

            {/* ── TEACHER FACULTY CARD ── */}
            {role === 'teacher' && (
              <div
                style={{
                  background: '#FFFFFF',
                  border: '1px solid var(--border-color)',
                  borderRadius: 10,
                  padding: '20px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                }}
              >
                <h2
                  style={{
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: 'var(--neutral-dark)',
                    margin: '0 0 14px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Briefcase size={16} style={{ color: '#2C6E6A' }} />
                  Faculty Subject &amp; Class Teacher Assignment
                </h2>

                <div className="form-group">
                  <label className="form-label">Subject Specialization</label>
                  <CustomSelect
                    value={subject}
                    onChange={(val) => setSubject(val)}
                    options={SUBJECTS.map((s) => ({ value: s, label: s }))}
                  />
                </div>

                {/* Class Teacher Toggle */}
                <div
                  style={{
                    borderTop: '1px solid var(--border-color)',
                    paddingTop: 16,
                    marginTop: 12,
                  }}
                >
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 700,
                      color: 'var(--neutral-dark)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isClassTeacher}
                      onChange={(e) => setIsClassTeacher(e.target.checked)}
                      style={{ width: 18, height: 18, accentColor: '#2D2C2A', cursor: 'pointer' }}
                    />
                    <span>Designate as Homeroom Class Teacher</span>
                  </label>

                  {isClassTeacher && (
                    <div
                      style={{
                        marginTop: 14,
                        padding: '14px',
                        background: '#FAF9F6',
                        borderRadius: 8,
                        border: '1px solid #D1E5DE',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                      }}
                    >
                      <div>
                        <label className="form-label" style={{ fontSize: 12 }}>
                          Assigned Homeroom Grade
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                          {GRADES.map((g) => (
                            <button
                              key={g}
                              type="button"
                              onClick={() => setGrade(g)}
                              style={{
                                padding: '8px',
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
                          Assigned Homeroom Section
                        </label>
                        <CustomSelect
                          value={section}
                          onChange={(val) => setSection(val)}
                          options={SECTIONS.map((s) => ({
                            value: s,
                            label: `Section ${s}`,
                          }))}
                        />
                      </div>

                      <div
                        style={{
                          padding: '10px 12px',
                          background: '#EAF3EF',
                          borderRadius: 6,
                          fontSize: 12,
                          color: '#2D6E5D',
                          fontWeight: 600,
                        }}
                      >
                        Designated Class Teacher for: <strong>Grade {grade}-{section}</strong>
                      </div>

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
                          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                          <div>
                            <strong>Class Teacher Conflict:</strong>
                            <br />
                            <strong>{existingClassTeacher.name}</strong> ({existingClassTeacher.subject || 'Faculty'}) is
                            already assigned to <strong>Grade {grade}-{section}</strong>.
                            <div style={{ fontSize: 11, color: '#782826', marginTop: 2 }}>
                              Each section can only have one Class Teacher.
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── PARENT CARDS: LINKED WARDS & SUBMITTED DOCUMENTS ── */}
            {role === 'parent' && (
              <>
                {/* Linked Wards Card */}
                <div
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid var(--border-color)',
                    borderRadius: 10,
                    padding: '20px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <h2
                        style={{
                          fontSize: 13.5,
                          fontWeight: 700,
                          color: 'var(--neutral-dark)',
                          margin: 0,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <Users size={16} style={{ color: '#2C6E6A' }} />
                        Linked Children / Wards
                      </h2>
                      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                        Students currently associated with this parent profile
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#2D6E5D',
                        background: '#EAF3EF',
                        border: '1px solid #C7E4D8',
                        padding: '2px 8px',
                        borderRadius: 12,
                      }}
                    >
                      {selectedStudentIds.length} Linked
                    </span>
                  </div>

                  {/* 1. LIST OF ALREADY LINKED CHILDREN ONLY */}
                  {linkedStudentsList.length === 0 ? (
                    <div
                      style={{
                        padding: '20px 16px',
                        textAlign: 'center',
                        background: '#FAF9F6',
                        borderRadius: 8,
                        border: '1px dashed var(--border-color)',
                        color: 'var(--text-secondary)',
                        fontSize: 12.5,
                        marginBottom: 12,
                      }}
                    >
                      No children currently linked to this parent account.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                      {linkedStudentsList.map((student) => {
                        const gradeStr = student.grade ? `Grade ${student.grade.replace(/[^0-9]/g, '')}` : '';
                        const secStr = student.class_letter ? `-${student.class_letter.toUpperCase()}` : '';
                        const admStr = student.admission_number || student.user_code || 'No Code';

                        return (
                          <div
                            key={student.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '10px 14px',
                              background: '#F0F9F7',
                              border: '1px solid #C7E4D8',
                              borderRadius: 8,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div
                                style={{
                                  width: 34,
                                  height: 34,
                                  borderRadius: 8,
                                  background: '#2C6E6A',
                                  color: '#FFFFFF',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 700,
                                  fontSize: 13,
                                }}
                              >
                                {(student.name || 'S').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#1B4D45' }}>
                                  {student.name}
                                </div>
                                <div style={{ fontSize: 11.5, color: '#4A7A72', marginTop: 2, display: 'flex', gap: 8 }}>
                                  <span>{gradeStr}{secStr}</span>
                                  <span>•</span>
                                  <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{admStr}</span>
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setSelectedStudentIds((prev) => prev.filter((id) => id !== student.id));
                              }}
                              title={`Unlink ${student.name}`}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '4px 8px',
                                fontSize: 11,
                                fontWeight: 600,
                                color: '#DC2626',
                                background: '#FFFFFF',
                                border: '1px solid #FECACA',
                                borderRadius: 5,
                                cursor: 'pointer',
                              }}
                            >
                              <X size={13} />
                              Unlink
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* 2. LINK MORE EXPANDABLE SECTION */}
                  {!isLinkingMore ? (
                    <button
                      type="button"
                      onClick={() => setIsLinkingMore(true)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        padding: '9px 14px',
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: 'var(--neutral-dark)',
                        background: '#FFFFFF',
                        border: '1px dashed var(--border-color)',
                        borderRadius: 7,
                        cursor: 'pointer',
                        transition: 'background 0.12s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#FAF9F6')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '#FFFFFF')}
                    >
                      <UserPlus size={14} />
                      Link Another Student
                    </button>
                  ) : (
                    <div
                      style={{
                        padding: '14px',
                        background: '#FAF9F6',
                        border: '1px solid #E8E5DF',
                        borderRadius: 8,
                        marginTop: 6,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                          Search &amp; Link Students
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setIsLinkingMore(false);
                            setStudentSearchTerm('');
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            fontSize: 11.5,
                            fontWeight: 600,
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            padding: 0,
                          }}
                        >
                          Done
                        </button>
                      </div>

                      <div style={{ position: 'relative', marginBottom: 8 }}>
                        <Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: '#9E9B95' }} />
                        <input
                          type="text"
                          placeholder="Search student by name, grade, or admission code..."
                          value={studentSearchTerm}
                          onChange={(e) => setStudentSearchTerm(e.target.value)}
                          style={{
                            width: '100%',
                            height: 32,
                            padding: '0 12px 0 32px',
                            fontSize: 12,
                            borderRadius: 6,
                            border: '1px solid #E5E3DF',
                            background: '#FFFFFF',
                            color: '#1A1A1A',
                            outline: 'none',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>

                      <div
                        style={{
                          maxHeight: 180,
                          overflowY: 'auto',
                          border: '1px solid var(--border-color)',
                          borderRadius: 6,
                          background: '#FFFFFF',
                          padding: '4px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4,
                        }}
                      >
                        {availableToLink.length === 0 ? (
                          <div style={{ padding: '16px', textAlign: 'center', fontSize: 12, color: 'var(--text-secondary)' }}>
                            No additional students match the search.
                          </div>
                        ) : (
                          availableToLink.map((student) => {
                            const gradeStr = student.grade ? `Grade ${student.grade.replace(/[^0-9]/g, '')}` : '';
                            const secStr = student.class_letter ? `-${student.class_letter.toUpperCase()}` : '';
                            const admStr = student.admission_number || student.user_code || 'No Code';

                            return (
                              <div
                                key={student.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '7px 10px',
                                  borderRadius: 5,
                                  background: '#FAF9F6',
                                  border: '1px solid #E8E5DF',
                                }}
                              >
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--neutral-dark)' }}>
                                    {student.name}
                                  </div>
                                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', gap: 6, marginTop: 1 }}>
                                    <span>{gradeStr}{secStr}</span>
                                    <span>•</span>
                                    <span style={{ fontFamily: 'monospace' }}>{admStr}</span>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedStudentIds((prev) => [...prev, student.id]);
                                  }}
                                  style={{
                                    padding: '4px 10px',
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: '#FFFFFF',
                                    background: '#2D2C2A',
                                    border: '1px solid #2D2C2A',
                                    borderRadius: 4,
                                    cursor: 'pointer',
                                  }}
                                >
                                  Link Student
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Submitted Clearance Documents Card */}
                <div
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid var(--border-color)',
                    borderRadius: 10,
                    padding: '20px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <h2
                        style={{
                          fontSize: 13.5,
                          fontWeight: 700,
                          color: 'var(--neutral-dark)',
                          margin: 0,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <FileText size={16} style={{ color: '#2C6E6A' }} />
                        Submitted Clearance Documents
                      </h2>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                        Scoped strictly to this parent&apos;s linked wards ({selectedStudentIds.length} wards)
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: parentDocs.length > 0 ? '#2D6E5D' : '#6B6963',
                        background: parentDocs.length > 0 ? '#EAF3EF' : '#F1F5F9',
                        padding: '2px 8px',
                        borderRadius: 12,
                      }}
                    >
                      {parentDocs.length} Total
                    </span>
                  </div>

                  {parentDocs.length === 0 ? (
                    <div
                      style={{
                        padding: '28px 16px',
                        textAlign: 'center',
                        background: '#FAF9F6',
                        borderRadius: 8,
                        border: '1px dashed var(--border-color)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <FileText size={24} style={{ opacity: 0.4, margin: '0 auto 6px', display: 'block' }} />
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--neutral-dark)' }}>
                        No clearance documents submitted yet
                      </div>
                      <div style={{ fontSize: 11, marginTop: 2 }}>
                        When this parent uploads clearance documents in the Parent Portal, they will appear here for inspection.
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                              padding: '12px 14px',
                              background: '#FAF9F6',
                              border: '1px solid var(--border-color)',
                              borderRadius: 8,
                              flexWrap: 'wrap',
                              gap: 12,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 220, flex: 1 }}>
                              <div
                                style={{
                                  width: 38,
                                  height: 38,
                                  borderRadius: 8,
                                  background: '#EAF3EF',
                                  color: '#2D6E5D',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                <FileText size={20} />
                              </div>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                                  {doc.doc_type}
                                </div>
                                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                                  Ward: <strong>{wardName}{wardGrade}</strong> • {doc.file_name}
                                  {doc.uploaded_at ? ` • ${doc.uploaded_at}` : ''}
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  padding: '3px 8px',
                                  borderRadius: 4,
                                  background: doc.status === 'submitted' ? '#EAF3EF' : '#FEF3C7',
                                  color: doc.status === 'submitted' ? '#2D6E5D' : '#92400E',
                                  border: doc.status === 'submitted' ? '1px solid #C7E4D8' : '1px solid #FDE68A',
                                  textTransform: 'capitalize',
                                }}
                              >
                                {doc.status || 'submitted'}
                              </span>

                              {/* View Document Button */}
                              <button
                                type="button"
                                onClick={() => {
                                  openFileInNewTab({
                                    fileName: doc.file_name,
                                    fileUrl: doc.file_url,
                                    studentName: wardName,
                                    title: doc.doc_type,
                                    submissionDate: doc.uploaded_at,
                                  });
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  padding: '6px 12px',
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: '#2C6E6A',
                                  background: '#EAF3EF',
                                  border: '1px solid #C7E4D8',
                                  borderRadius: 5,
                                  cursor: 'pointer',
                                  transition: 'background 0.12s',
                                }}
                                title="View / Inspect Document"
                              >
                                <ExternalLink size={13} />
                                View
                              </button>

                              {/* Download File Button */}
                              <button
                                type="button"
                                onClick={() => {
                                  downloadFile({
                                    fileName: doc.file_name,
                                    fileUrl: doc.file_url,
                                    studentName: wardName,
                                    title: doc.doc_type,
                                  });
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  padding: '6px 12px',
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: 'var(--neutral-dark)',
                                  background: '#FFFFFF',
                                  border: '1px solid var(--border-color)',
                                  borderRadius: 5,
                                  cursor: 'pointer',
                                  transition: 'background 0.12s',
                                }}
                                title="Download Document"
                              >
                                <Download size={13} />
                                Download
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── ADMIN ROLE CARD ── */}
            {role === 'admin' && (
              <div
                style={{
                  background: '#FFFFFF',
                  border: '1px solid var(--border-color)',
                  borderRadius: 10,
                  padding: '20px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                }}
              >
                <h2
                  style={{
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: 'var(--neutral-dark)',
                    margin: '0 0 14px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Shield size={16} style={{ color: '#2C6E6A' }} />
                  System Administrator Privileges
                </h2>
                <div
                  style={{
                    padding: '14px',
                    background: '#FAF9F6',
                    border: '1px solid #E8E5DF',
                    borderRadius: 8,
                    fontSize: 12.5,
                    lineHeight: 1.5,
                    color: 'var(--neutral-dark)',
                  }}
                >
                  This account has full root permissions across the school management console, including:
                  <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: 'var(--text-secondary)' }}>
                    <li>Managing user directory and provisioning accounts</li>
                    <li>Configuring class cohorts and class teacher assignments</li>
                    <li>Approving parent-student verification links and clearances</li>
                    <li>Publishing school-wide Holistic Development Programmes</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── BOTTOM ACTIONS BAR ── */}
        <div
          style={{
            marginTop: 24,
            padding: '16px 20px',
            background: '#FFFFFF',
            border: '1px solid var(--border-color)',
            borderRadius: 10,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <button
            type="button"
            onClick={onBack}
            style={{
              padding: '9px 18px',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--neutral-dark)',
              background: '#FFFFFF',
              border: '1px solid var(--border-color)',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Cancel &amp; Return
          </button>

          <button
            type="submit"
            disabled={isSaving || (role === 'teacher' && isClassTeacher && !!existingClassTeacher)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 24px',
              fontSize: 13.5,
              fontWeight: 700,
              color: '#FFFFFF',
              background: '#2D2C2A',
              border: 'none',
              borderRadius: 6,
              cursor: isSaving || (role === 'teacher' && isClassTeacher && !!existingClassTeacher) ? 'not-allowed' : 'pointer',
              opacity: isSaving || (role === 'teacher' && isClassTeacher && !!existingClassTeacher) ? 0.6 : 1,
            }}
          >
            <Save size={15} />
            {isSaving ? 'Saving Changes...' : 'Save Profile Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};
