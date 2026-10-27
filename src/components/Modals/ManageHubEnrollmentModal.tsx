'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Search, Upload, UserPlus, Trash2, Users, CheckCircle, AlertCircle, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { HubActivity, UserProfile } from '@/lib/supabaseClient';

interface ManageHubEnrollmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  activity: HubActivity | null;
  profiles: UserProfile[];
  teacherClass?: string;
  onSaveEnrollments: (activityId: string, studentIds: string[]) => Promise<void> | void;
}

export const ManageHubEnrollmentModal: React.FC<ManageHubEnrollmentModalProps> = ({
  isOpen,
  onClose,
  activity,
  profiles,
  teacherClass,
  onSaveEnrollments,
}) => {
  const [enrolledIds, setEnrolledIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [addSearchQuery, setAddSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter students from profiles
  const allStudents = useMemo(() => {
    return profiles.filter((p) => p.role === 'student');
  }, [profiles]);

  // Map student ID to profile
  const studentMap = useMemo(() => {
    const map = new Map<string, UserProfile>();
    allStudents.forEach((s) => map.set(s.id, s));
    return map;
  }, [allStudents]);

  // Synchronize enrolled IDs on modal open
  useEffect(() => {
    if (activity) {
      setEnrolledIds(activity.enrolled_student_ids || []);
      setSearchQuery('');
      setAddSearchQuery('');
      setUploadFeedback(null);
    }
  }, [activity, isOpen]);

  // Get matching target students for teacherClass or target_grades
  const targetClassStudents = useMemo(() => {
    if (!teacherClass) return [];
    const cleanClass = teacherClass.toLowerCase().replace(/grade\s*/gi, '').trim();
    const parts = cleanClass.split(/[-\s]+/);
    const gradeNum = parts.find((p) => /^\d+$/.test(p)) || '';
    const sectionLetter = parts.find((p) => /^[a-z]$/.test(p))?.toUpperCase() || '';

    return allStudents.filter((s) => {
      const sGrade = (s.grade || '').replace(/[^0-9]/g, '');
      const sLetter = (s.class_letter || '').toUpperCase().trim();
      if (gradeNum && sGrade !== gradeNum) return false;
      if (sectionLetter && sLetter !== sectionLetter) return false;
      return true;
    });
  }, [allStudents, teacherClass]);

  // Target grades matching students
  const targetGradesStudents = useMemo(() => {
    if (!activity || !activity.target_grades || activity.target_grades.length === 0) return [];
    const targets = activity.target_grades.map((t) => t.toLowerCase().replace(/\s+/g, '').replace(/^grade/, ''));
    return allStudents.filter((s) => {
      const sGrade = (s.grade || '').replace(/[^0-9]/g, '');
      const sLetter = (s.class_letter || '').toUpperCase().trim();
      const sClassKey = `${sGrade}-${sLetter}`.toLowerCase();
      return targets.some((t) => t === sGrade || t === sClassKey);
    });
  }, [allStudents, activity]);

  // Filter currently enrolled students based on search query
  const displayedEnrolledStudents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return enrolledIds
      .map((id) => studentMap.get(id))
      .filter((s): s is UserProfile => Boolean(s))
      .filter((s) => {
        if (!q) return true;
        const nameMatch = (s.name || '').toLowerCase().includes(q);
        const admMatch = (s.admission_number || '').toLowerCase().includes(q);
        const codeMatch = (s.user_code || '').toLowerCase().includes(q);
        const classMatch = `${s.grade}-${s.class_letter}`.toLowerCase().includes(q);
        return nameMatch || admMatch || codeMatch || classMatch;
      });
  }, [enrolledIds, studentMap, searchQuery]);

  // Candidates for manual add (students not yet enrolled)
  const candidateStudentsToAdd = useMemo(() => {
    const q = addSearchQuery.toLowerCase().trim();
    if (!q) return [];
    const enrolledSet = new Set(enrolledIds);
    return allStudents
      .filter((s) => !enrolledSet.has(s.id))
      .filter((s) => {
        const nameMatch = (s.name || '').toLowerCase().includes(q);
        const admMatch = (s.admission_number || '').toLowerCase().includes(q);
        const codeMatch = (s.user_code || '').toLowerCase().includes(q);
        const classMatch = `${s.grade}-${s.class_letter}`.toLowerCase().includes(q);
        return nameMatch || admMatch || codeMatch || classMatch;
      })
      .slice(0, 10);
  }, [allStudents, enrolledIds, addSearchQuery]);

  if (!isOpen || !activity) return null;

  const handleRemoveStudent = (id: string) => {
    setEnrolledIds((prev) => prev.filter((item) => item !== id));
  };

  const handleAddStudent = (id: string) => {
    if (!enrolledIds.includes(id)) {
      setEnrolledIds((prev) => [...prev, id]);
    }
  };

  const handleEnrollAllClass = () => {
    if (targetClassStudents.length === 0) return;
    const newIds = targetClassStudents.map((s) => s.id);
    setEnrolledIds((prev) => Array.from(new Set([...prev, ...newIds])));
    setUploadFeedback({
      type: 'success',
      message: `Enrolled all ${targetClassStudents.length} students from class ${teacherClass || 'your class'}.`,
    });
  };

  const handleEnrollAllTargetAudience = () => {
    if (targetGradesStudents.length === 0) return;
    const newIds = targetGradesStudents.map((s) => s.id);
    setEnrolledIds((prev) => Array.from(new Set([...prev, ...newIds])));
    setUploadFeedback({
      type: 'success',
      message: `Enrolled ${targetGradesStudents.length} students matching target grades.`,
    });
  };

  const handleClearAll = () => {
    if (confirm('Clear all enrolled students from this activity?')) {
      setEnrolledIds([]);
      setUploadFeedback(null);
    }
  };

  // Excel / CSV File Roster Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (rows.length === 0) {
          setUploadFeedback({ type: 'error', message: 'The uploaded file contains no data rows.' });
          return;
        }

        let matchedCount = 0;
        const matchedIds: string[] = [];

        // Build lookup keys from all students
        const byAdmission = new Map<string, string>();
        const byCode = new Map<string, string>();
        const byEmail = new Map<string, string>();
        const byName = new Map<string, string>();

        allStudents.forEach((s) => {
          if (s.admission_number) byAdmission.set(s.admission_number.toLowerCase().trim(), s.id);
          if (s.user_code) byCode.set(s.user_code.toLowerCase().trim(), s.id);
          if (s.email) byEmail.set(s.email.toLowerCase().trim(), s.id);
          if (s.name) byName.set(s.name.toLowerCase().replace(/\s+/g, ' ').trim(), s.id);
        });

        for (const row of rows) {
          let foundId: string | undefined;

          // Check all values in row
          for (const val of Object.values(row)) {
            const strVal = String(val).toLowerCase().trim();
            if (!strVal) continue;

            if (byAdmission.has(strVal)) {
              foundId = byAdmission.get(strVal);
              break;
            }
            if (byCode.has(strVal)) {
              foundId = byCode.get(strVal);
              break;
            }
            if (byEmail.has(strVal)) {
              foundId = byEmail.get(strVal);
              break;
            }
            if (byName.has(strVal)) {
              foundId = byName.get(strVal);
              break;
            }
          }

          if (foundId && !matchedIds.includes(foundId)) {
            matchedIds.push(foundId);
            matchedCount++;
          }
        }

        if (matchedCount > 0) {
          setEnrolledIds((prev) => Array.from(new Set([...prev, ...matchedIds])));
          setUploadFeedback({
            type: 'success',
            message: `✓ Successfully matched and enrolled ${matchedCount} students from "${file.name}".`,
          });
        } else {
          setUploadFeedback({
            type: 'error',
            message: `Could not match any students in "${file.name}". Ensure column has Admission Numbers or Student Names.`,
          });
        }
      } catch (err: any) {
        console.error('Failed to parse uploaded enrollment file:', err);
        setUploadFeedback({
          type: 'error',
          message: 'Failed to read spreadsheet file. Please check file format.',
        });
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await onSaveEnrollments(activity.id, enrolledIds);
      onClose();
    } catch (err: any) {
      console.error('Error saving enrollments:', err);
      alert('Failed to save enrollments: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  const maxCapacity = (activity as any).max_capacity;

  return (
    <div
      className="responsive-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(4px)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="responsive-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#FFFFFF',
          borderRadius: 14,
          width: '100%',
          maxWidth: 680,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#FFFFFF',
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#2C6E6A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              CO-CURRICULAR HUB · ROSTER MANAGEMENT
            </div>
            <h2 style={{ margin: '3px 0 0', fontSize: 17, fontWeight: 700, color: 'var(--neutral-dark)' }}>
              Manage Activity Enrollment
            </h2>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
              <strong>{activity.title}</strong> · {activity.type} ({activity.date})
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: '1px solid var(--border-color)',
              background: 'var(--surface)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Stats Bar */}
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 10,
              background: '#F8FAF9',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 8,
                  background: '#2C6E6A18',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#2C6E6A',
                }}
              >
                <Users size={18} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--neutral-dark)' }}>
                  {enrolledIds.length} Students Enrolled
                  {maxCapacity && (
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginLeft: 6 }}>
                      (Max: {maxCapacity})
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                  Target Audience: {(activity.target_grades || []).join(', ') || 'All Grades'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {targetClassStudents.length > 0 && (
                <button
                  type="button"
                  onClick={handleEnrollAllClass}
                  className="btn-row-action"
                  style={{ color: '#2C6E6A', borderColor: '#2C6E6A40', background: '#2C6E6A0F', fontSize: 11.5, fontWeight: 700 }}
                  title={`Enroll all ${targetClassStudents.length} students from ${teacherClass}`}
                >
                  + Enroll All {teacherClass} ({targetClassStudents.length})
                </button>
              )}
              {targetGradesStudents.length > 0 && targetGradesStudents.length !== targetClassStudents.length && (
                <button
                  type="button"
                  onClick={handleEnrollAllTargetAudience}
                  className="btn-row-action"
                  style={{ color: '#2563EB', borderColor: '#2563EB40', background: '#2563EB0F', fontSize: 11.5, fontWeight: 700 }}
                >
                  + Enroll Target ({targetGradesStudents.length})
                </button>
              )}
              {enrolledIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="btn-row-action btn-delete"
                  style={{ fontSize: 11.5 }}
                >
                  Clear All
                </button>
              )}
            </div>
          </div>

          {/* Quick Roster Upload Toolbar */}
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 10,
              border: '1.5px dashed #2C6E6A60',
              background: '#2C6E6A08',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <FileSpreadsheet size={22} style={{ color: '#2C6E6A' }} />
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                  Upload Enrollment Roster (.xlsx, .csv)
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  Upload a student list with admission numbers, names, or emails to bulk enroll.
                </div>
              </div>
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 14px',
                  borderRadius: 6,
                  border: '1px solid #2C6E6A',
                  background: '#2C6E6A',
                  color: '#FFFFFF',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Upload size={13} />
                Upload File
              </button>
            </div>
          </div>

          {/* Feedback banner */}
          {uploadFeedback && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: uploadFeedback.type === 'success' ? '#ECFDF5' : '#FEF2F2',
                color: uploadFeedback.type === 'success' ? '#065F46' : '#991B1B',
                border: `1px solid ${uploadFeedback.type === 'success' ? '#A7F3D0' : '#FECACA'}`,
              }}
            >
              {uploadFeedback.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
              {uploadFeedback.message}
            </div>
          )}

          {/* Add Student Bar */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--neutral-dark)', marginBottom: 6 }}>
              Add Student Manually
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={addSearchQuery}
                onChange={(e) => setAddSearchQuery(e.target.value)}
                placeholder="Search student to add by name or admission number..."
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 34px',
                  fontSize: 13,
                  border: '1.5px solid var(--border-color)',
                  borderRadius: 8,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <Search size={14} style={{ position: 'absolute', left: 11, top: 12, color: 'var(--text-secondary)' }} />
            </div>

            {/* Candidate Search Dropdown */}
            {candidateStudentsToAdd.length > 0 && (
              <div
                style={{
                  marginTop: 6,
                  background: '#FFFFFF',
                  border: '1px solid var(--border-color)',
                  borderRadius: 8,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                  maxHeight: 180,
                  overflowY: 'auto',
                }}
              >
                {candidateStudentsToAdd.map((cand) => (
                  <div
                    key={cand.id}
                    style={{
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottom: '1px solid #F3F4F6',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>{cand.name}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 8 }}>
                        (Adm: {cand.admission_number || 'N/A'} · {cand.grade}-{cand.class_letter})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddStudent(cand.id)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 5,
                        border: '1px solid #2C6E6A',
                        background: '#2C6E6A15',
                        color: '#2C6E6A',
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <UserPlus size={12} />
                      Add
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Enrolled Students Table */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                Enrolled Students ({displayedEnrolledStudents.length} of {enrolledIds.length})
              </label>
              {enrolledIds.length > 5 && (
                <div style={{ width: 220, position: 'relative' }}>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter enrolled list..."
                    style={{
                      width: '100%',
                      padding: '5px 8px 5px 26px',
                      fontSize: 11.5,
                      border: '1px solid var(--border-color)',
                      borderRadius: 6,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  <Search size={11} style={{ position: 'absolute', left: 8, top: 8, color: 'var(--text-secondary)' }} />
                </div>
              )}
            </div>

            <div
              style={{
                border: '1px solid var(--border-color)',
                borderRadius: 8,
                maxHeight: 280,
                overflowY: 'auto',
                background: '#FFFFFF',
              }}
            >
              {displayedEnrolledStudents.length === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>
                  {enrolledIds.length === 0 ? (
                    <>
                      <div style={{ fontSize: 24, marginBottom: 6 }}>👥</div>
                      <strong>No students enrolled yet.</strong>
                      <div style={{ marginTop: 4 }}>
                        Use &quot;+ Enroll All {teacherClass || 'Class'}&quot; or upload an Excel file to enroll students.
                      </div>
                    </>
                  ) : (
                    'No enrolled students match your search filter.'
                  )}
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#F8FAF9', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                      <th style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--neutral-dark)' }}>Student</th>
                      <th style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--neutral-dark)' }}>Admission #</th>
                      <th style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--neutral-dark)' }}>Class</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedEnrolledStudents.map((st) => (
                      <tr key={st.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--neutral-dark)' }}>
                          {st.name}
                        </td>
                        <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>
                          {st.admission_number || '—'}
                        </td>
                        <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>
                          {st.grade}-{st.class_letter}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={() => handleRemoveStudent(st.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#DC2626',
                              cursor: 'pointer',
                              padding: '2px 6px',
                              borderRadius: 4,
                            }}
                            title="Remove student from activity"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-color)',
            background: '#F8FAF9',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            <strong>{enrolledIds.length}</strong> students ready to be saved
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              style={{
                padding: '9px 18px',
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 8,
                border: '1.5px solid var(--border-color)',
                background: '#FFFFFF',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              style={{
                padding: '9px 24px',
                fontSize: 13,
                fontWeight: 700,
                borderRadius: 8,
                border: 'none',
                background: '#2C6E6A',
                color: '#FFFFFF',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                opacity: isSaving ? 0.7 : 1,
                boxShadow: '0 2px 8px rgba(44,110,106,0.3)',
              }}
            >
              {isSaving ? 'Saving Enrollments...' : `✓ Save Enrollments (${enrolledIds.length})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
