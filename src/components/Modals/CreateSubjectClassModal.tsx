'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { UserProfile } from '@/lib/supabaseClient';
import { CustomSelect } from '@/components/UI/CustomSelect';

interface CreateSubjectClassModalProps {
  isOpen: boolean;
  teacher?: UserProfile | null;
  profiles: UserProfile[];
  onClose: () => void;
  onSubmit: (classData: {
    name: string;
    subject: string;
    class_name: string;
    section: string;
    room: string;
    enrolled_student_ids: string[];
    teacher_id?: string;
    teacher_name?: string;
  }) => void;
  presetGrade?: string;
  presetSection?: string;
  lockSection?: boolean;
}

export const CreateSubjectClassModal: React.FC<CreateSubjectClassModalProps> = ({
  isOpen,
  teacher,
  profiles,
  onClose,
  onSubmit,
  presetGrade,
  presetSection,
  lockSection,
}) => {
  const facultyTeachers = useMemo(() => {
    return profiles.filter((p) => p.role === 'teacher');
  }, [profiles]);

  const [name, setName] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState(teacher?.id || '');
  const [subject, setSubject] = useState(teacher?.subject || '');
  const [grade, setGrade] = useState(presetGrade || '10');
  const [section, setSection] = useState(presetSection || 'A');
  const [room, setRoom] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [rosterScope, setRosterScope] = useState<'section' | 'grade' | 'all'>('section');

  // Reset and synchronize cohort whenever modal opens or preset changes
  useEffect(() => {
    if (isOpen) {
      const activeGrade = (presetGrade || grade || '10').replace(/[^0-9]/g, '') || '10';
      const activeSection = (presetSection || section || 'A').toUpperCase().trim() || 'A';

      setGrade(activeGrade);
      setSection(activeSection);
      setName('');
      setRoom('');
      setStudentSearch('');
      setRosterScope('section');

      // Auto-enroll all students of the target section by default
      const cohortStudents = profiles.filter((p) => {
        if (p.role !== 'student' || p.is_deactivated) return false;
        const g = (p.grade || '').replace(/[^0-9]/g, '');
        const sec = (p.class_letter || '').toUpperCase().trim();
        return g === activeGrade && sec === activeSection;
      });

      setSelectedStudentIds(cohortStudents.map((s) => s.id));
    }
  }, [isOpen, presetGrade, presetSection, profiles]);

  useEffect(() => {
    if (teacher?.id) {
      setSelectedTeacherId(teacher.id);
      if (teacher.subject) setSubject(teacher.subject);
    } else if (facultyTeachers.length > 0 && !selectedTeacherId) {
      setSelectedTeacherId(facultyTeachers[0].id);
      if (facultyTeachers[0].subject) setSubject(facultyTeachers[0].subject);
    }
  }, [teacher, facultyTeachers]);

  // When selected teacher changes in admin mode, auto-fill subject if available
  const handleTeacherSelect = (teacherId: string) => {
    setSelectedTeacherId(teacherId);
    const found = facultyTeachers.find((t) => t.id === teacherId);
    if (found?.subject) {
      if (!subject) setSubject(found.subject);
      if (!name.trim()) setName(`Grade ${grade} ${found.subject}`);
    }
  };

  // All student profiles
  const allStudents = useMemo(() => {
    return profiles.filter((p) => p.role === 'student' && !p.is_deactivated);
  }, [profiles]);

  // Students in selected grade
  const gradeStudents = useMemo(() => {
    return allStudents.filter((s) => {
      const g = (s.grade || '').replace(/[^0-9]/g, '');
      return g === grade;
    });
  }, [allStudents, grade]);

  // Students matching selected grade & section
  const sectionStudents = useMemo(() => {
    return allStudents.filter((s) => {
      const g = (s.grade || '').replace(/[^0-9]/g, '');
      const sec = (s.class_letter || '').toUpperCase().trim();
      return g === grade && sec === section;
    });
  }, [allStudents, grade, section]);

  // Students according to active scope
  const scopedStudents = useMemo(() => {
    if (rosterScope === 'section') return sectionStudents;
    if (rosterScope === 'grade') return gradeStudents;
    return allStudents;
  }, [rosterScope, sectionStudents, gradeStudents, allStudents]);

  // Filtered student list for search
  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return scopedStudents;
    const q = studentSearch.toLowerCase();
    return scopedStudents.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.admission_number || '').toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q)
    );
  }, [scopedStudents, studentSearch]);

  if (!isOpen) return null;

  const handleSelectAllSection = () => {
    const ids = sectionStudents.map((s) => s.id);
    const set = new Set([...selectedStudentIds, ...ids]);
    setSelectedStudentIds(Array.from(set));
  };

  const handleSelectAllGrade = () => {
    const ids = gradeStudents.map((s) => s.id);
    const set = new Set([...selectedStudentIds, ...ids]);
    setSelectedStudentIds(Array.from(set));
  };

  const handleDeselectAll = () => {
    setSelectedStudentIds([]);
  };

  const handleToggleStudent = (id: string) => {
    if (selectedStudentIds.includes(id)) {
      setSelectedStudentIds(selectedStudentIds.filter((sid) => sid !== id));
    } else {
      setSelectedStudentIds([...selectedStudentIds, id]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const assignedTeacher = facultyTeachers.find((t) => t.id === selectedTeacherId) || teacher;
    const classNameFormatted = `${grade}-${section}`;

    onSubmit({
      name: name.trim(),
      subject: subject.trim() || name.trim(),
      class_name: classNameFormatted,
      section: `Section ${section}`,
      room: room.trim(),
      enrolled_student_ids: selectedStudentIds.length > 0 ? selectedStudentIds : sectionStudents.map((s) => s.id),
      teacher_id: assignedTeacher?.id,
      teacher_name: assignedTeacher?.name,
    });

    setName('');
    setRoom('');
    setSelectedStudentIds([]);
    onClose();
  };

  const isTeacherLocked = !!teacher && teacher.role === 'teacher';

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#2C6E6A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Centralized Academic Setup
            </span>
            <h2 className="modal-title" style={{ margin: '2px 0 0', fontSize: 16 }}>
              Create Subject Class
            </h2>
          </div>
          <button type="button" className="close-modal" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Teacher Assignment Field (Admin Selector or Fixed Teacher) */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">
              Assigned Teacher / Faculty <span style={{ color: '#DC2626' }}>*</span>
            </label>
            {isTeacherLocked ? (
              <input
                type="text"
                className="form-input"
                value={`${teacher.name} (${teacher.subject || 'Faculty'})`}
                disabled
                style={{ background: '#F5F5F3', cursor: 'not-allowed' }}
              />
            ) : (
              <CustomSelect
                value={selectedTeacherId}
                onChange={handleTeacherSelect}
                placeholder="Select a teacher to assign..."
                options={facultyTeachers.map((t) => ({
                  value: t.id,
                  label: `${t.name} — ${t.subject || 'Faculty'} (${t.email})`,
                }))}
              />
            )}
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">
              Class / Subject Name <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Grade 10 English Literature, Grade 11 Chemistry, Grade 12 Computer Science"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Subject Discipline</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. English, Physics, Chemistry, Computer Science"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Room / Lab (Optional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Room 102, Lab 4, Senior Hall"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
              />
            </div>
          </div>

          {lockSection && presetGrade && presetSection ? (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 8,
                background: '#F0F9F7',
                border: '1.5px solid #2C6E6A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: '#2C6E6A',
                  }}
                >
                  Target Cohort Section
                </span>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1F2937', marginTop: 2 }}>
                  Grade {grade} — Section {section}
                </div>
              </div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#20554E',
                  background: '#D1ECE5',
                  padding: '5px 12px',
                  borderRadius: 6,
                }}
              >
                {sectionStudents.length} Students in Cohort (All Pre-selected)
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Target Grade (9-12)</label>
                <CustomSelect
                  value={grade}
                  onChange={(val) => setGrade(val)}
                  options={[
                    { value: '9', label: 'Grade 9' },
                    { value: '10', label: 'Grade 10' },
                    { value: '11', label: 'Grade 11' },
                    { value: '12', label: 'Grade 12' },
                  ]}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Section Letter (A-Z)</label>
                <CustomSelect
                  value={section}
                  onChange={(val) => setSection(val)}
                  options={Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)).map((s) => ({
                    value: s,
                    label: `Section ${s}`,
                  }))}
                />
              </div>
            </div>
          )}

          {/* Student Roster Enrollment Box */}
          <div style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: '12px 14px', background: '#FAF9F6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
              <div>
                <label className="form-label" style={{ margin: 0, fontSize: 12, fontWeight: 700 }}>
                  Enroll Students ({selectedStudentIds.length} Selected)
                </label>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  Section {grade}-{section} has {sectionStudents.length} enrolled student{sectionStudents.length === 1 ? '' : 's'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  onClick={handleSelectAllSection}
                  style={{ padding: '4px 9px', fontSize: 11, fontWeight: 600, background: '#EAF3EF', color: '#2D6E5D', border: '1px solid #C7E4D8', borderRadius: 4, cursor: 'pointer' }}
                >
                  + Enroll Section {grade}-{section}
                </button>
                <button
                  type="button"
                  onClick={handleSelectAllGrade}
                  style={{ padding: '4px 9px', fontSize: 11, fontWeight: 600, background: '#FFFFFF', color: 'var(--neutral-dark)', border: '1px solid var(--border-color)', borderRadius: 4, cursor: 'pointer' }}
                >
                  + Enroll All Gr. {grade}
                </button>
                {selectedStudentIds.length > 0 && (
                  <button
                    type="button"
                    onClick={handleDeselectAll}
                    style={{ padding: '4px 9px', fontSize: 11, fontWeight: 600, background: '#FFF1F0', color: '#D9534F', border: '1px solid #F5C6CB', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Scope Toggle & Search */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <div style={{ display: 'flex', background: '#ECEAE5', borderRadius: 6, padding: 2 }}>
                <button
                  type="button"
                  onClick={() => setRosterScope('section')}
                  style={{
                    padding: '4px 8px',
                    fontSize: 11,
                    fontWeight: 600,
                    border: 'none',
                    borderRadius: 4,
                    background: rosterScope === 'section' ? '#FFFFFF' : 'transparent',
                    color: rosterScope === 'section' ? '#2C6E6A' : '#73716D',
                    cursor: 'pointer',
                  }}
                >
                  Section ({sectionStudents.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRosterScope('grade')}
                  style={{
                    padding: '4px 8px',
                    fontSize: 11,
                    fontWeight: 600,
                    border: 'none',
                    borderRadius: 4,
                    background: rosterScope === 'grade' ? '#FFFFFF' : 'transparent',
                    color: rosterScope === 'grade' ? '#2C6E6A' : '#73716D',
                    cursor: 'pointer',
                  }}
                >
                  Grade ({gradeStudents.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRosterScope('all')}
                  style={{
                    padding: '4px 8px',
                    fontSize: 11,
                    fontWeight: 600,
                    border: 'none',
                    borderRadius: 4,
                    background: rosterScope === 'all' ? '#FFFFFF' : 'transparent',
                    color: rosterScope === 'all' ? '#2C6E6A' : '#73716D',
                    cursor: 'pointer',
                  }}
                >
                  All ({allStudents.length})
                </button>
              </div>

              <input
                type="text"
                placeholder="Search students by name, email, or code..."
                className="form-input"
                style={{ fontSize: 12, padding: '4px 8px', flex: 1 }}
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
              />
            </div>

            {/* Student List Checkboxes */}
            <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, background: '#FFFFFF', padding: 8, borderRadius: 6, border: '1px solid var(--border-color)' }}>
              {filteredStudents.length === 0 ? (
                <div style={{ padding: '12px', textAlign: 'center', fontSize: 12, color: 'var(--text-secondary)' }}>
                  No students found matching current criteria.
                </div>
              ) : (
                filteredStudents.map((st) => {
                  const isSelected = selectedStudentIds.includes(st.id);
                  const cleanG = (st.grade || '').replace(/[^0-9]/g, '');
                  const cleanS = (st.class_letter || '').toUpperCase().trim();
                  return (
                    <label
                      key={st.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '5px 8px',
                        borderRadius: 4,
                        background: isSelected ? '#F0F9F7' : 'transparent',
                        cursor: 'pointer',
                        fontSize: 12,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleStudent(st.id)}
                          style={{ accentColor: '#2C6E6A', cursor: 'pointer' }}
                        />
                        <span style={{ fontWeight: isSelected ? 700 : 500, color: 'var(--neutral-dark)' }}>{st.name}</span>
                      </div>
                      <span style={{ fontSize: 10.5, color: isSelected ? '#2D6E5D' : 'var(--text-secondary)', fontFamily: 'monospace', fontWeight: 600 }}>
                        Grade {cleanG}-{cleanS} {st.admission_number ? `(${st.admission_number})` : ''}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button type="button" className="btn-secondary" onClick={onClose} style={{ padding: '8px 16px' }}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" style={{ padding: '8px 20px' }}>
              Create Class
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
