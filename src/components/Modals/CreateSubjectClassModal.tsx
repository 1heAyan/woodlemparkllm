'use client';

import React, { useState, useMemo } from 'react';
import { UserProfile } from '@/lib/supabaseClient';
import { CustomSelect } from '@/components/UI/CustomSelect';

interface CreateSubjectClassModalProps {
  isOpen: boolean;
  teacher: UserProfile;
  profiles: UserProfile[];
  onClose: () => void;
  onSubmit: (classData: {
    name: string;
    subject: string;
    class_name: string;
    section: string;
    room: string;
    enrolled_student_ids: string[];
  }) => void;
}

export const CreateSubjectClassModal: React.FC<CreateSubjectClassModalProps> = ({
  isOpen,
  teacher,
  profiles,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [subject, setSubject] = useState(teacher.subject || '');
  const [grade, setGrade] = useState('12');
  const [section, setSection] = useState('C');
  const [room, setRoom] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [rosterScope, setRosterScope] = useState<'section' | 'grade' | 'all'>('section');

  // All student profiles
  const allStudents = useMemo(() => {
    return profiles.filter((p) => p.role === 'student');
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

    const classNameFormatted = `${grade}-${section}`;
    onSubmit({
      name: name.trim(),
      subject: subject.trim() || name.trim(),
      class_name: classNameFormatted,
      section: `Section ${section}`,
      room: room.trim(),
      enrolled_student_ids: selectedStudentIds.length > 0 ? selectedStudentIds : sectionStudents.map((s) => s.id),
    });

    setName('');
    setRoom('');
    setSelectedStudentIds([]);
    onClose();
  };

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#2C6E6A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Subject Classroom Setup
            </span>
            <h2 className="modal-title" style={{ margin: '2px 0 0', fontSize: 16 }}>
              Create Subject Class
            </h2>
          </div>
          <button type="button" className="close-modal" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Class / Subject Name</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. AP Physics 1, Advanced Calculus, English Literature"
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
                placeholder="e.g. Physics, Math, Chemistry"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Room / Lab (Optional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Lab 204, Room B-12"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
              />
            </div>
          </div>

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

          {/* Student Roster Enrollment Box */}
          <div style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: '12px 14px', background: '#FAF9F6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
              <div>
                <label className="form-label" style={{ margin: 0, fontSize: 12, fontWeight: 700 }}>
                  Enroll Students ({selectedStudentIds.length} Selected)
                </label>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  Section {grade}-{section} has {sectionStudents.length} student{sectionStudents.length === 1 ? '' : 's'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  onClick={handleSelectAllSection}
                  style={{ padding: '4px 9px', fontSize: 11, fontWeight: 600, background: '#EAF3EF', color: '#2D6E5D', border: '1px solid #C7E4D8', borderRadius: 4, cursor: 'pointer' }}
                >
                  + Add Section {grade}-{section}
                </button>
                <button
                  type="button"
                  onClick={handleSelectAllGrade}
                  style={{ padding: '4px 9px', fontSize: 11, fontWeight: 600, background: '#FFFFFF', color: 'var(--neutral-dark)', border: '1px solid var(--border-color)', borderRadius: 4, cursor: 'pointer' }}
                >
                  + Add All Gr. {grade}
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

            {/* Scope Filter Tabs */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <button
                type="button"
                onClick={() => setRosterScope('section')}
                style={{
                  padding: '3px 10px',
                  fontSize: 11,
                  fontWeight: rosterScope === 'section' ? 700 : 500,
                  borderRadius: 14,
                  border: rosterScope === 'section' ? '1px solid #2C6E6A' : '1px solid var(--border-color)',
                  background: rosterScope === 'section' ? '#2C6E6A' : '#FFFFFF',
                  color: rosterScope === 'section' ? '#FFFFFF' : 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                Section {grade}-{section} ({sectionStudents.length})
              </button>
              <button
                type="button"
                onClick={() => setRosterScope('grade')}
                style={{
                  padding: '3px 10px',
                  fontSize: 11,
                  fontWeight: rosterScope === 'grade' ? 700 : 500,
                  borderRadius: 14,
                  border: rosterScope === 'grade' ? '1px solid #2C6E6A' : '1px solid var(--border-color)',
                  background: rosterScope === 'grade' ? '#2C6E6A' : '#FFFFFF',
                  color: rosterScope === 'grade' ? '#FFFFFF' : 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                All Grade {grade} ({gradeStudents.length})
              </button>
              <button
                type="button"
                onClick={() => setRosterScope('all')}
                style={{
                  padding: '3px 10px',
                  fontSize: 11,
                  fontWeight: rosterScope === 'all' ? 700 : 500,
                  borderRadius: 14,
                  border: rosterScope === 'all' ? '1px solid #2C6E6A' : '1px solid var(--border-color)',
                  background: rosterScope === 'all' ? '#2C6E6A' : '#FFFFFF',
                  color: rosterScope === 'all' ? '#FFFFFF' : 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                All Students ({allStudents.length})
              </button>
            </div>

            <input
              type="text"
              placeholder={`Search within ${rosterScope === 'section' ? `Section ${grade}-${section}` : rosterScope === 'grade' ? `Grade ${grade}` : 'all students'}...`}
              className="form-input"
              style={{ width: '100%', padding: '6px 10px', fontSize: 12, marginBottom: 8, background: '#FFFFFF' }}
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
            />

            <div style={{ maxHeight: 170, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 6, padding: '6px 8px' }}>
              {filteredStudents.length === 0 ? (
                <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--text-secondary)' }}>
                  No students found in {rosterScope === 'section' ? `Section ${grade}-${section}` : `Grade ${grade}`}.
                  {rosterScope !== 'all' && (
                    <div style={{ marginTop: 4 }}>
                      <button
                        type="button"
                        onClick={() => setRosterScope('all')}
                        style={{ color: '#2C6E6A', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: 11.5 }}
                      >
                        View all school students
                      </button>
                    </div>
                  )}
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
                        padding: '6px 8px',
                        borderRadius: 4,
                        background: isSelected ? '#EAF3EF' : 'transparent',
                        cursor: 'pointer',
                        fontSize: 12,
                        transition: 'background 0.1s',
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
