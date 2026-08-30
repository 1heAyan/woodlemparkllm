'use client';

import React, { useState, useMemo } from 'react';
import { UserProfile, SubjectClass } from '@/lib/supabaseClient';
import { CustomSelect } from '@/components/UI/CustomSelect';
import { extractClassTeacherInfo } from '@/lib/classTeacherHelper';
import { sanitizeUserCode } from '@/lib/userCodeHelper';
import { AlertTriangle } from 'lucide-react';

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
  subjectClasses?: SubjectClass[];
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
    linkedStudentIds?: string[];
  }) => void;
}

export const ProvisionUserModal: React.FC<ProvisionUserModalProps> = ({
  isOpen,
  profiles = [],
  subjectClasses = [],
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

  const targetClassKey = `${grade}-${section}`;

  const existingClassTeacher = useMemo(() => {
    if (role !== 'teacher' || !isClassTeacher) return null;
    return profiles.find((p) => {
      if (p.role !== 'teacher') return false;
      const pInfo = extractClassTeacherInfo(p, subjectClasses);
      return pInfo.isClassTeacher && pInfo.classKey === targetClassKey;
    });
  }, [profiles, role, isClassTeacher, targetClassKey, subjectClasses]);

  // Duplicate admission/user code detection ONLY within the same role
  const duplicateCodeUser = useMemo(() => {
    if (role === 'parent') return null;
    const clean = sanitizeUserCode(admissionNumber).toLowerCase();
    if (!clean || clean === '—' || clean === '-' || clean === 'null' || clean === 'undefined') {
      return null;
    }
    return profiles.find(
      (p) =>
        p.role === role &&
        ((p.admission_number && sanitizeUserCode(p.admission_number, p.email).toLowerCase() === clean) ||
          (p.user_code && sanitizeUserCode(p.user_code, p.email).toLowerCase() === clean))
    );
  }, [profiles, admissionNumber, role]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !emailPrefix.trim() || !password) return;
    if (password.length < 6) {
      alert('Password must be at least 6 characters long.');
      return;
    }

    if (role === 'teacher' && isClassTeacher && existingClassTeacher) {
      alert(`Cannot assign as Class Teacher: Grade ${grade}-${section} is already assigned to ${existingClassTeacher.name} (${existingClassTeacher.subject || 'Faculty'}). Each class section can only have one Class Teacher.`);
      return;
    }

    if (role !== 'parent' && duplicateCodeUser) {
      alert(`Cannot create account: Code "${admissionNumber.trim()}" is already assigned to another ${role.toUpperCase()} account (${duplicateCodeUser.name}).`);
      return;
    }

    let cleanPrefix = emailPrefix.trim().toLowerCase();
    if (cleanPrefix.endsWith('@woodlempark.ae')) {
      cleanPrefix = cleanPrefix.replace('@woodlempark.ae', '');
    }
    const fullEmail = `${cleanPrefix}@woodlempark.ae`;

    const existingEmailUser = profiles.find((p) => p.email.toLowerCase() === fullEmail.toLowerCase());
    if (existingEmailUser) {
      alert(`Cannot create account: An account with email "${fullEmail}" already exists (${existingEmailUser.name} - ${existingEmailUser.role.toUpperCase()}). Every user must have a unique email address.`);
      return;
    }

    const rawUserTypedCode = admissionNumber.trim();
    const cleanUserCode = role === 'parent' ? undefined : (rawUserTypedCode
      ? rawUserTypedCode.replace(/^(WPS|PRN|ADM|PAR|EMP)[-_ ]*/i, '').trim()
      : (cleanPrefix.match(/\d+/) ? cleanPrefix.match(/\d+/)![0] : cleanPrefix));

    const assignedClassStr = role === 'teacher' && isClassTeacher ? `${grade}-${section}` : null;
    const finalGrade = role === 'student' ? grade : (role === 'teacher' && isClassTeacher ? grade : undefined);
    const finalSection = role === 'student' ? section : (role === 'teacher' && isClassTeacher ? section : undefined);

    onSubmit({
      name: name.trim(),
      email: fullEmail,
      password,
      role,
      userCode: cleanUserCode,
      admissionNumber: cleanUserCode,
      grade: finalGrade,
      classLetter: finalSection,
      subject: role === 'teacher' ? subject : null,
      assignedClass: assignedClassStr,
      linkedStudentIds: role === 'parent' ? selectedStudentIds : undefined,
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
    setSelectedStudentIds([]);
    setStudentSearchTerm('');
    onClose();
  };

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Create New User Account</h2>
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
                placeholder="e.g. s.jenkins"
                value={emailPrefix}
                onChange={(e) => setEmailPrefix(e.target.value)}
                style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0, flex: 1 }}
                required
              />
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '0 12px',
                  height: '38px',
                  background: '#EAE8E3',
                  border: '1px solid var(--border-color)',
                  borderLeft: 'none',
                  borderTopRightRadius: 6,
                  borderBottomRightRadius: 6,
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  userSelect: 'none',
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

          {/* Admission Number (Students & Teachers only, parents don't need admission code) */}
          {role !== 'parent' && (
            <div className="form-group">
              <label className="form-label">
                {role === 'student' ? 'Admission Number' : role === 'teacher' ? 'Employee Code' : 'User Reference ID'}
              </label>
              <input
                type="text"
                className="form-input"
                placeholder={role === 'student' ? 'e.g. 104829' : 'e.g. 204'}
                value={admissionNumber}
                onChange={(e) => setAdmissionNumber(e.target.value)}
                style={{
                  borderColor: duplicateCodeUser ? '#DC2626' : undefined,
                  background: duplicateCodeUser ? '#FEF2F2' : undefined,
                }}
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
                        border: grade === g ? '1.5px solid #2D2C2A' : '1.5px solid #CBD5E1',
                        background: grade === g ? '#2D2C2A' : '#fff',
                        color: grade === g ? '#FFFFFF' : '#64748B',
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
                  searchable={true}
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
                  <span>Assign as Class Teacher</span>
                </label>

                {isClassTeacher && (
                  <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12, padding: '12px', background: '#FFFFFF', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                    <div>
                      <label className="form-label" style={{ fontSize: 12 }}>Classroom Grade</label>
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
                              border: grade === g ? '1.5px solid #2D2C2A' : '1px solid #CBD5E1',
                              background: grade === g ? '#2D2C2A' : '#FFFFFF',
                              color: grade === g ? '#FFFFFF' : '#64748B',
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
                      <label className="form-label" style={{ fontSize: 12 }}>Classroom Section (A–Z)</label>
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
                      Class Teacher of: <strong>Grade {grade} — Section {section}</strong>
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
                          <strong>Class Teacher Conflict:</strong><br />
                          <strong>{existingClassTeacher.name}</strong> ({existingClassTeacher.subject || 'Faculty'}) is already the designated Class Teacher for <strong>Grade {grade}-{section}</strong>.<br />
                          <span style={{ fontSize: 11, color: '#782826' }}>
                            A class can only have one Class Teacher. Please select a different section or edit the existing teacher first.
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── PARENT FIELDS: LINK STUDENT(S) ── */}
          {role === 'parent' && (
            <div
              style={{
                background: '#F0F9F7',
                border: '1px solid #C7E4D8',
                borderRadius: 10,
                padding: '16px',
                marginTop: 4,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#265E5A', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Link Student / Ward(s)
                </p>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#2D6E5D', background: '#D6EFE5', padding: '2px 8px', borderRadius: 12 }}>
                  {selectedStudentIds.length} Linked
                </span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.4 }}>
                Select the student(s) this parent account has access to. Parents can also request child linking from their portal.
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
                            <span>{gradeStr}{secStr}</span>
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
          )}

          {/* Submit Buttons */}
          <div className="modal-footer" style={{ marginTop: 24 }}>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={role === 'teacher' && isClassTeacher && !!existingClassTeacher}
              style={{
                opacity: role === 'teacher' && isClassTeacher && !!existingClassTeacher ? 0.6 : 1,
                cursor: role === 'teacher' && isClassTeacher && !!existingClassTeacher ? 'not-allowed' : 'pointer',
              }}
            >
              Create Account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
