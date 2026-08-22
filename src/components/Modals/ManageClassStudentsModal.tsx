'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, SubjectClass } from '@/lib/supabaseClient';
import { CustomSelect } from '@/components/UI/CustomSelect';

interface ManageClassStudentsModalProps {
  isOpen: boolean;
  activeClass: SubjectClass | null;
  profiles: UserProfile[];
  onClose: () => void;
  onSave: (classId: string, enrolledStudentIds: string[]) => void;
}

export const ManageClassStudentsModal: React.FC<ManageClassStudentsModalProps> = ({
  isOpen,
  activeClass,
  profiles,
  onClose,
  onSave,
}) => {
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState('ALL');

  // Initialize selectedStudentIds from activeClass
  useEffect(() => {
    if (activeClass) {
      setSelectedStudentIds(activeClass.enrolled_student_ids || []);
    } else {
      setSelectedStudentIds([]);
    }
  }, [activeClass, isOpen]);

  // All student profiles
  const allStudents = useMemo(() => {
    return profiles.filter((p) => p.role === 'student');
  }, [profiles]);

  // Filtered students for display
  const filteredStudents = useMemo(() => {
    return allStudents.filter((st) => {
      const g = (st.grade || '').replace(/[^0-9]/g, '');
      if (gradeFilter !== 'ALL' && g !== gradeFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const mName = st.name.toLowerCase().includes(q);
        const mCode = (st.admission_number || st.user_code || '').toLowerCase().includes(q);
        const mEmail = st.email.toLowerCase().includes(q);
        return mName || mCode || mEmail;
      }
      return true;
    });
  }, [allStudents, gradeFilter, searchQuery]);

  if (!isOpen || !activeClass) return null;

  const handleToggleStudent = (studentId: string) => {
    setSelectedStudentIds((prev) => {
      if (prev.includes(studentId)) {
        return prev.filter((id) => id !== studentId);
      } else {
        return [...prev, studentId];
      }
    });
  };

  const handleSelectAllFiltered = () => {
    const filteredIds = filteredStudents.map((s) => s.id);
    setSelectedStudentIds((prev) => {
      const combined = new Set([...prev, ...filteredIds]);
      return Array.from(combined);
    });
  };

  const handleDeselectAllFiltered = () => {
    const filteredIdSet = new Set(filteredStudents.map((s) => s.id));
    setSelectedStudentIds((prev) => prev.filter((id) => !filteredIdSet.has(id)));
  };

  const handleSave = () => {
    onSave(activeClass.id, selectedStudentIds);
    onClose();
  };

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: 640, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#2C6E6A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Classroom Roster Enrollment
            </span>
            <h2 className="modal-title" style={{ margin: '2px 0 0', fontSize: 17 }}>
              Manage Students for {activeClass.name}
            </h2>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
              Target: {activeClass.class_name} {activeClass.room ? `· ${activeClass.room}` : ''}
            </div>
          </div>
          <button type="button" className="close-modal" onClick={onClose}>&times;</button>
        </div>

        {/* Filters & Quick Action Toolbar */}
        <div style={{ padding: '12px 20px', background: '#FDFCFB', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Search student by name or ID..."
              className="form-input"
              style={{ flex: 1, minWidth: 200, padding: '6px 10px', fontSize: 12 }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            <div style={{ width: 140 }}>
              <CustomSelect
                value={gradeFilter}
                onChange={(val) => setGradeFilter(val)}
                options={[
                  { value: 'ALL', label: 'All Grades (9-12)' },
                  { value: '9', label: 'Grade 9' },
                  { value: '10', label: 'Grade 10' },
                  { value: '11', label: 'Grade 11' },
                  { value: '12', label: 'Grade 12' },
                ]}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={handleSelectAllFiltered}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  background: '#EAF3EF',
                  border: '1px solid #C7E4D8',
                  color: '#2D6E5D',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                + Select All ({filteredStudents.length})
              </button>
              <button
                type="button"
                onClick={handleDeselectAllFiltered}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  background: '#FAF9F6',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-secondary)',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                Deselect Filtered
              </button>
            </div>

            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 4,
                background: '#2D2C2A',
                color: '#FFFFFF',
              }}
            >
              {selectedStudentIds.length} Students Selected
            </span>
          </div>
        </div>

        {/* Student List Table */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
          {filteredStudents.length === 0 ? (
            <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
              No students found matching your search.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F8F7F4', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: 10, textTransform: 'uppercase', position: 'sticky', top: 0, zIndex: 2 }}>
                  <th style={{ textAlign: 'center', padding: '8px 10px', width: 36 }}>Enroll</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px' }}>Student Name</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px' }}>Admission No.</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px' }}>Grade / Section</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((st) => {
                  const isEnrolled = selectedStudentIds.includes(st.id);
                  const g = (st.grade || '').replace(/[^0-9]/g, '');
                  const s = (st.class_letter || '').toUpperCase().trim();

                  return (
                    <tr
                      key={st.id}
                      onClick={() => handleToggleStudent(st.id)}
                      style={{
                        borderBottom: '1px solid #ECEAE5',
                        cursor: 'pointer',
                        background: isEnrolled ? '#F7FAF8' : '#FFFFFF',
                      }}
                    >
                      <td style={{ textAlign: 'center', padding: '8px 10px' }} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isEnrolled}
                          onChange={() => handleToggleStudent(st.id)}
                          style={{ accentColor: '#2C6E6A', cursor: 'pointer' }}
                        />
                      </td>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--neutral-dark)' }}>
                        {st.name}
                      </td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: 'var(--text-secondary)', fontSize: 11 }}>
                        {st.admission_number || st.user_code || '—'}
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>
                        Grade {g}-{s}
                      </td>
                      <td style={{ textAlign: 'right', padding: '8px 12px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '1px 6px',
                            borderRadius: 3,
                            fontSize: 10,
                            fontWeight: 700,
                            background: isEnrolled ? '#EAF3EF' : '#FAF9F6',
                            color: isEnrolled ? '#2D6E5D' : '#A09E9A',
                            border: isEnrolled ? '1px solid #C7E4D8' : '1px solid var(--border-color)',
                          }}
                        >
                          {isEnrolled ? 'Enrolled' : 'Not in Class'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#FAF9F6',
          }}
        >
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            style={{ padding: '7px 16px', fontSize: 12 }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSave}
            style={{ padding: '7px 20px', fontSize: 12 }}
          >
            Save Enrollment ({selectedStudentIds.length} Students)
          </button>
        </div>
      </div>
    </div>
  );
};
