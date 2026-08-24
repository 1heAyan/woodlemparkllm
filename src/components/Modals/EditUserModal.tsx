'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  profiles = [],
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'student' | 'teacher' | 'admin' | 'parent'>('student');
  const [userCode, setUserCode] = useState('');

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

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setRole(user.role || 'student');
      setUserCode(user.user_code || user.admission_number || '');
      setSelectedStudentIds(user.linked_student_ids || []);
      setStudentSearchTerm('');

      // Parse grade (9, 10, 11, 12)
      let parsedGrade: '9' | '10' | '11' | '12' = '12';
      let parsedSection = 'A';

      if (user.assigned_class && user.assigned_class.includes('-')) {
        const parts = user.assigned_class.split('-');
        const g = parts[0].replace(/[^0-9]/g, '');
        if (['9', '10', '11', '12'].includes(g)) parsedGrade = g as any;
        if (parts[1]) parsedSection = parts[1].toUpperCase().trim();
        setIsClassTeacher(true);
      } else if (user.grade) {
        const cleanG = user.grade.replace(/[^0-9]/g, '');
        if (['9', '10', '11', '12'].includes(cleanG)) parsedGrade = cleanG as any;
        if (user.class_letter) parsedSection = user.class_letter.toUpperCase().trim();
        setIsClassTeacher(user.role === 'teacher' && !!user.assigned_class);
      } else {
        setIsClassTeacher(false);
      }

      setGrade(parsedGrade);
      setSection(SECTIONS.includes(parsedSection) ? parsedSection : 'A');
      setSubject(user.subject || 'English');
    }
  }, [user]);

  const targetClassKey = `${grade}-${section}`;

  const existingClassTeacher = useMemo(() => {
    if (role !== 'teacher' || !isClassTeacher || !user) return null;
    return profiles.find((p) => {
      if (p.id === user.id || (p.email && user.email && p.email.toLowerCase() === user.email.toLowerCase())) {
        return false;
      }
      if (p.role !== 'teacher') return false;
      const cleanG = (p.grade || '').replace(/[^0-9]/g, '');
      const cleanS = (p.class_letter || '').toUpperCase().trim();
      const assigned = (p.assigned_class || (cleanG && cleanS ? `${cleanG}-${cleanS}` : '')).replace(/^Grade\s*/i, '');
      return assigned === targetClassKey;
    });
  }, [profiles, role, isClassTeacher, targetClassKey, user]);

  if (!isOpen || !user) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    if (role === 'teacher' && isClassTeacher && existingClassTeacher) {
      alert(`Cannot assign as Class Teacher: Grade ${grade}-${section} is already assigned to ${existingClassTeacher.name} (${existingClassTeacher.subject || 'Faculty'}). Each class section can only have one Class Teacher.`);
      return;
    }

    let cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes('@')) {
      cleanEmail = `${cleanEmail}@woodlempark.ae`;
    }

    const assignedClassStr = role === 'teacher' && isClassTeacher ? `${grade}-${section}` : null;
    const finalGrade = role === 'student' ? grade : (role === 'teacher' && isClassTeacher ? grade : '');
    const finalSection = role === 'student' ? section : (role === 'teacher' && isClassTeacher ? section : '');

    onSubmit({
      ...user,
      name: name.trim(),
      email: cleanEmail,
      role,
      user_code: userCode.trim(),
      admission_number: userCode.trim(),
      grade: finalGrade,
      class_letter: finalSection,
      subject: role === 'teacher' ? subject : null,
      assigned_class: assignedClassStr,
      linked_student_ids: role === 'parent' ? selectedStudentIds : user.linked_student_ids,
    });
    onClose();
  };

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Edit User Account</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              Update profile details, role, and academic cohort mappings.
            </p>
          </div>
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

          {/* User Code / Admission Number */}
          <div className="form-group">
            <label className="form-label">
              {role === 'student' ? 'Admission Number' : role === 'teacher' ? 'Employee Code' : 'User Reference Code'}
            </label>
            <input
              type="text"
              className="form-input"
              value={userCode}
              onChange={(e) => setUserCode(e.target.value)}
              required
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
                  Assigned to: <strong>Grade {grade} — Section {section}</strong>
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
                Faculty &amp; Class Teacher Assignment
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
                      <label className="form-label" style={{ fontSize: 12 }}>Assigned Grade</label>
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
                      <label className="form-label" style={{ fontSize: 12 }}>Assigned Section (A–Z)</label>
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
                        <span style={{ fontSize: 15, flexShrink: 0 }}>⚠️</span>
                        <div>
                          <strong>Class Teacher Conflict:</strong><br />
                          <strong>{existingClassTeacher.name}</strong> ({existingClassTeacher.subject || 'Faculty'}) is already the designated Class Teacher for <strong>Grade {grade}-{section}</strong>.<br />
                          <span style={{ fontSize: 11, color: '#782826' }}>
                            A class can only have one Class Teacher. Please reassign {existingClassTeacher.name} or choose another section.
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
                  Linked Student / Ward(s)
                </p>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#2D6E5D', background: '#D6EFE5', padding: '2px 8px', borderRadius: 12 }}>
                  {selectedStudentIds.length} Linked
                </span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.4 }}>
                Select or update the student(s) this parent account has access to.
              </p>

              {/* Student Search */}
              <input
                type="text"
                className="form-input"
                placeholder="Search student by name, grade, or admission no..."
                value={studentSearchTerm}
                onChange={(e) => setStudentSearchTerm(e.target.value)}
                style={{ fontSize: 12.5, padding: '8px 12px', background: '#FFFFFF', marginBottom: 10 }}
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
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
