'use client';

import React, { useState, useMemo } from 'react';
import { AssignmentItem, UserProfile } from '@/lib/supabaseClient';
import { ViewFileModal } from './ViewFileModal';
import { openFileInNewTab, downloadFile } from '@/lib/fileHelper';
import { X } from 'lucide-react';

export interface AssignmentSubmissionRecord {
  assignment_id: string;
  student_id: string;
  student_name: string;
  file_name?: string;
  file_url?: string;
  notes?: string;
  grade?: string;
  feedback?: string;
  status: 'submitted' | 'graded';
  submitted_at?: string;
}

interface GradeAssignmentModalProps {
  isOpen: boolean;
  assignment: AssignmentItem | null;
  classStudents: UserProfile[];
  submissions: Record<string, AssignmentSubmissionRecord>;
  onSaveGrade: (assignmentId: string, studentId: string, grade: string, feedback?: string) => void;
  onDeleteAssignment: (assignmentId: string) => void;
  onClose: () => void;
}

export const GradeAssignmentModal: React.FC<GradeAssignmentModalProps> = ({
  isOpen,
  assignment,
  classStudents,
  submissions,
  onSaveGrade,
  onDeleteAssignment,
  onClose,
}) => {
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [tempGrade, setTempGrade] = useState<string>('A');
  const [tempFeedback, setTempFeedback] = useState<string>('');
  const [viewingFile, setViewingFile] = useState<{
    fileName: string;
    fileUrl?: string;
    studentName?: string;
    title?: string;
    description?: string;
    submissionDate?: string;
  } | null>(null);

  const studentSubmissionList = useMemo(() => {
    if (!assignment) return [];
    return classStudents.map((st) => {
      const key = `${assignment.id}_${st.id}`;
      const sub = submissions[key];
      return {
        student: st,
        submission: sub || null,
      };
    });
  }, [assignment, classStudents, submissions]);

  if (!isOpen || !assignment) return null;

  const submittedCount = studentSubmissionList.filter((item) => item.submission !== null).length;
  const gradedCount = studentSubmissionList.filter((item) => item.submission?.grade).length;
  const totalCount = studentSubmissionList.length;

  const handleStartGrading = (stId: string, currentGrade: string = 'A', currentFeedback: string = '') => {
    setEditingStudentId(stId);
    setTempGrade(currentGrade || 'A');
    setTempFeedback(currentFeedback || '');
  };

  const handleSave = (stId: string) => {
    onSaveGrade(assignment.id, stId, tempGrade.trim(), tempFeedback.trim());
    setEditingStudentId(null);
  };

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: 760, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#2C6E6A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Assignment Submissions &amp; Grading
            </span>
            <h2 className="modal-title" style={{ margin: '2px 0 0', fontSize: 17 }}>{assignment.title}</h2>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
              Target Class: {assignment.class_name || 'All Enrolled Students'}
            </div>
          </div>
          <button type="button" className="close-modal" onClick={onClose}>&times;</button>
        </div>

        {/* KPI Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, padding: '14px 20px', background: '#FAF9F6', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 6, padding: '10px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Submissions Received</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#2C6E6A', marginTop: 2 }}>
              {submittedCount} / {totalCount} ({totalCount > 0 ? Math.round((submittedCount / totalCount) * 100) : 0}%)
            </div>
          </div>
          <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 6, padding: '10px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Graded</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#2D2C2A', marginTop: 2 }}>
              {gradedCount} of {submittedCount}
            </div>
          </div>
          <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 6, padding: '10px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Missing Homework</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#D9534F', marginTop: 2 }}>
              {totalCount - submittedCount} Students
            </div>
          </div>
        </div>

        {/* Student Submission Register Table */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
          {studentSubmissionList.length === 0 ? (
            <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
              No students enrolled in this class.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F8F7F4', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: 10, textTransform: 'uppercase', position: 'sticky', top: 0, zIndex: 2 }}>
                  <th style={{ textAlign: 'left', padding: '10px 12px', width: 36 }}>#</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', minWidth: 150 }}>Student</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', width: 110 }}>Admission No.</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', width: 170 }}>Submitted Work</th>
                  <th style={{ textAlign: 'center', padding: '10px 12px', width: 90 }}>Grade</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px' }}>Teacher Feedback</th>
                  <th style={{ textAlign: 'right', padding: '10px 12px', width: 80 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {studentSubmissionList.map((item, idx) => {
                  const { student, submission } = item;
                  const isEditing = editingStudentId === student.id;

                  return (
                    <tr key={student.id} style={{ borderBottom: '1px solid #ECEAE5' }}>
                      <td style={{ padding: '10px 12px', color: '#9E9B95' }}>{idx + 1}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--neutral-dark)' }}>
                        <div>{student.name}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', fontWeight: 400 }}>
                          {student.grade ? `Grade ${student.grade}-${student.class_letter}` : 'Student'}
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: 'var(--text-secondary)', fontSize: 11 }}>
                        {student.admission_number || student.user_code || '—'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {submission ? (
                          <div>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <button
                                type="button"
                                onClick={() =>
                                  openFileInNewTab({
                                    fileName: submission.file_name || 'Completed_Work.pdf',
                                    fileUrl: submission.file_url,
                                    studentName: student.name,
                                    title: assignment.title,
                                    description: submission.notes || 'Student submitted completed homework assignment.',
                                    submissionDate: submission.submitted_at,
                                  })
                                }
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  padding: '4px 9px',
                                  borderRadius: 4,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  background: '#EAF3EF',
                                  color: '#2D6E5D',
                                  border: '1px solid #C7E4D8',
                                  cursor: 'pointer',
                                  maxWidth: 160,
                                  textAlign: 'left',
                                }}
                                title={`Click to open submission in new tab: ${submission.file_name}`}
                              >
                                <span>↗</span>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {submission.file_name || 'Work.pdf'}
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  downloadFile({
                                    fileName: submission.file_name || 'Completed_Work.pdf',
                                    fileUrl: submission.file_url,
                                    studentName: student.name,
                                    title: assignment.title,
                                    description: submission.notes,
                                    submissionDate: submission.submitted_at,
                                  })
                                }
                                title="Download Submission File"
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: 4,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  background: '#FAF9F6',
                                  color: 'var(--neutral-dark)',
                                  border: '1px solid var(--border-color)',
                                  cursor: 'pointer',
                                }}
                              >
                                ↓
                              </button>
                            </div>
                            {submission.notes && (
                              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, fontStyle: 'italic' }}>
                                &quot;{submission.notes}&quot;
                              </div>
                            )}
                            {submission.submitted_at && (
                              <div style={{ fontSize: 10, color: '#A09E9A', marginTop: 2 }}>
                                {submission.submitted_at}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ display: 'inline-block', padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: '#FDF1F0', color: '#A83B38', border: '1px solid #F5C6CB' }}>
                            Missing
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center', padding: '10px 12px' }}>
                        {isEditing ? (
                          <input
                            type="text"
                            value={tempGrade}
                            placeholder="e.g. A+"
                            onChange={(e) => setTempGrade(e.target.value)}
                            style={{ width: 60, padding: '4px', textAlign: 'center', fontSize: 12, border: '1px solid #2C6E6A', borderRadius: 4 }}
                          />
                        ) : submission?.grade ? (
                          <span style={{ fontSize: 12, fontWeight: 800, padding: '2px 7px', borderRadius: 4, background: '#FEF7EC', color: '#9E6C1B', border: '1px solid #F5DEB3' }}>
                            {submission.grade}
                          </span>
                        ) : (
                          <span style={{ color: '#CBD5E1' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {isEditing ? (
                          <input
                            type="text"
                            placeholder="Add evaluation feedback..."
                            value={tempFeedback}
                            onChange={(e) => setTempFeedback(e.target.value)}
                            style={{ width: '100%', padding: '4px 8px', fontSize: 11.5, border: '1px solid var(--border-color)', borderRadius: 4 }}
                          />
                        ) : (
                          <span style={{ fontSize: 11.5, color: submission?.feedback ? 'var(--neutral-dark)' : '#CBD5E1' }}>
                            {submission?.feedback || 'No comments'}
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', padding: '10px 12px' }}>
                        {isEditing ? (
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => handleSave(student.id)}
                              style={{ padding: '3px 8px', fontSize: 10.5, fontWeight: 700, background: '#2C6E6A', color: '#FFF', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingStudentId(null)}
                              style={{ padding: '3px 6px', fontSize: 10.5, background: '#FAF9F6', border: '1px solid var(--border-color)', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleStartGrading(student.id, submission?.grade, submission?.feedback)}
                            style={{ padding: '3px 8px', fontSize: 11, fontWeight: 600, background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 4, cursor: 'pointer', color: 'var(--neutral-dark)' }}
                          >
                            {submission?.grade ? 'Edit' : 'Grade'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer with Delete Assignment */}
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
            onClick={() => {
              if (confirm(`Are you sure you want to delete assignment "${assignment.title}"? This cannot be undone.`)) {
                onDeleteAssignment(assignment.id);
                onClose();
              }
            }}
            style={{
              padding: '6px 12px',
              fontSize: 11.5,
              fontWeight: 600,
              background: '#FDF1F0',
              border: '1px solid #F5C6CB',
              color: '#A83B38',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Delete Assignment
          </button>

          <button
            type="button"
            className="btn-primary"
            onClick={onClose}
            style={{ padding: '7px 20px', fontSize: 12 }}
          >
            Done
          </button>
        </div>
      </div>

      {/* File / Document Viewer Modal */}
      <ViewFileModal
        isOpen={!!viewingFile}
        fileName={viewingFile?.fileName || ''}
        fileUrl={viewingFile?.fileUrl}
        studentName={viewingFile?.studentName}
        title={viewingFile?.title}
        description={viewingFile?.description}
        submissionDate={viewingFile?.submissionDate}
        onClose={() => setViewingFile(null)}
      />
    </div>
  );
};
