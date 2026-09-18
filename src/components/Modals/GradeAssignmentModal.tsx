'use client';

import React, { useState, useMemo } from 'react';
import { AssignmentItem, UserProfile } from '@/lib/supabaseClient';
import { ViewFileModal } from './ViewFileModal';
import { openFileInNewTab, downloadFile } from '@/lib/fileHelper';
import { SegmentedControl } from '@/components/UI/SegmentedControl';
import {
  ArrowLeft,
  X,
  FileText,
  Image as ImageIcon,
  ExternalLink,
  Download,
  MessageSquare,
  CheckCircle,
  Clock,
  AlertCircle,
  Users,
  BarChart3,
  Trash2,
  Search,
  Check,
  Award,
  Eye,
  BookOpen,
  Calendar,
  Copy,
} from 'lucide-react';

export interface AssignmentSubmissionRecord {
  assignment_id: string;
  student_id: string;
  student_name: string;
  file_name?: string;
  file_url?: string;
  notes?: string;
  text_answer?: string;
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
  const [tempGrade, setTempGrade] = useState<string>('25');
  const [tempFeedback, setTempFeedback] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'graded' | 'pending' | 'missing'>('all');

  const [viewingFile, setViewingFile] = useState<{
    fileName: string;
    fileUrl?: string;
    studentName?: string;
    title?: string;
    description?: string;
    submissionDate?: string;
  } | null>(null);

  const [viewingTextSolution, setViewingTextSolution] = useState<{
    studentName: string;
    text: string;
    date?: string;
    fileName?: string;
    fileUrl?: string;
  } | null>(null);
  const [copiedSolution, setCopiedSolution] = useState(false);

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

  const totalCount = studentSubmissionList.length;
  const submittedCount = studentSubmissionList.filter((item) => item.submission !== null).length;
  const gradedCount = studentSubmissionList.filter((item) => item.submission?.grade && item.submission.grade.trim() !== '').length;
  const pendingCount = submittedCount - gradedCount;
  const missingCount = totalCount - submittedCount;
  const submissionPct = totalCount > 0 ? Math.round((submittedCount / totalCount) * 100) : 0;

  // Filtered student list
  const filteredList = studentSubmissionList.filter(({ student, submission }) => {
    // Status Filter
    if (statusFilter === 'submitted' && !submission) return false;
    if (statusFilter === 'missing' && submission) return false;
    if (statusFilter === 'graded' && (!submission || !submission.grade || submission.grade.trim() === '')) return false;
    if (statusFilter === 'pending' && (!submission || (submission.grade && submission.grade.trim() !== ''))) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = (student.name || '').toLowerCase().includes(q);
      const matchAdm = (student.admission_number || student.user_code || '').toLowerCase().includes(q);
      const matchGrade = (student.grade || '').toLowerCase().includes(q);
      if (!matchName && !matchAdm && !matchGrade) return false;
    }

    return true;
  });

  const handleStartGrading = (stId: string, currentGrade?: string, currentFeedback?: string, isMissing?: boolean) => {
    setEditingStudentId(stId);
    if (isMissing) {
      const initial = currentGrade && (currentGrade === '0' || currentGrade.toLowerCase() === 'absent' || currentGrade.toUpperCase() === 'AB')
        ? currentGrade
        : '0';
      setTempGrade(initial);
      setTempFeedback(currentFeedback || 'Missing homework submission');
    } else {
      setTempGrade(currentGrade || (assignment.total_marks ? `${assignment.total_marks}` : 'A'));
      setTempFeedback(currentFeedback || '');
    }
  };

  const handleSave = (stId: string, isMissing?: boolean) => {
    const trimmed = tempGrade.trim();
    if (isMissing) {
      const lower = trimmed.toLowerCase();
      const isAllowed =
        trimmed === '0' ||
        lower === 'absent' ||
        lower === 'ab' ||
        lower === 'a/b' ||
        trimmed === '-';

      if (!isAllowed) {
        alert(
          'Student has not submitted their homework.\n\nYou cannot assign positive marks without a submission. You can only assign 0 marks or mark the student as "Absent" (AB).'
        );
        return;
      }
    }

    let finalGrade = trimmed;
    if (finalGrade.toLowerCase() === 'absent' || finalGrade.toUpperCase() === 'AB' || finalGrade.toLowerCase() === 'a/b') {
      finalGrade = 'Absent';
    }

    onSaveGrade(assignment.id, stId, finalGrade, tempFeedback.trim());
    setEditingStudentId(null);
  };

  const isTeacherDocPdf = assignment.file_name?.toLowerCase().endsWith('.pdf');

  return (
    <div
      className="modal-overlay active"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 1100,
        overflowY: 'auto',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
        background: '#F8F7F4',
        display: 'block',
      }}
    >
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          minHeight: '100%',
          height: 'auto',
          overflow: 'visible',
          display: 'block',
          background: 'transparent',
          padding: 0,
          margin: 0,
        }}
      >
        {/* Centered Main Canvas */}
        <div
          style={{
            maxWidth: 1180,
            width: '100%',
            margin: '0 auto',
            padding: '24px 28px 80px',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            boxSizing: 'border-box',
          }}
        >
          {/* Top Navigation & Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 14px',
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: 'var(--neutral-dark)',
                  background: '#FFFFFF',
                  border: '1px solid var(--border-color)',
                  borderRadius: 8,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#F3F2EF')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#FFFFFF')}
              >
                <ArrowLeft size={14} />
                <span>Back</span>
              </button>
              <span style={{ fontSize: 13, color: '#C4C2BC' }}>/</span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#2C6E6A',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  background: '#EAF3EF',
                  padding: '3px 10px',
                  borderRadius: 6,
                  border: '1px solid #C7E4D8',
                }}
              >
                Assignment Submissions &amp; Evaluation
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Are you sure you want to delete assignment "${assignment.title}"? This cannot be undone.`)) {
                    onDeleteAssignment(assignment.id);
                    onClose();
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 13px',
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#DC2626',
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  borderRadius: 8,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                title="Delete this homework assignment"
              >
                <Trash2 size={13} />
                <span>Delete Assignment</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid var(--border-color)',
                  borderRadius: 8,
                  padding: '7px 12px',
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: 'var(--neutral-dark)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#F3F2EF')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#FFFFFF')}
              >
                <X size={15} />
                <span>Close</span>
              </button>
            </div>
          </div>

          {/* Hero Assignment Header Card */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid var(--border-color)',
              borderRadius: 14,
              padding: '24px 28px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      padding: '3px 9px',
                      borderRadius: 6,
                      background: '#EAF3EF',
                      color: '#2C6E6A',
                      border: '1px solid #C7E4D8',
                    }}
                  >
                    Homework Assignment
                  </span>
                  {assignment.total_marks && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '3px 10px',
                        borderRadius: 6,
                        background: '#FEF7EC',
                        color: '#B37D4A',
                        border: '1px solid #F5DEB3',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Award size={13} />
                      Max Score: {assignment.total_marks} Marks
                    </span>
                  )}
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Calendar size={13} />
                    {assignment.created_at ? new Date(assignment.created_at).toLocaleDateString() : 'Active'}
                  </span>
                </div>

                <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--neutral-dark)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
                  {assignment.title}
                </h1>

                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Assigned to:{' '}
                  <strong style={{ color: 'var(--neutral-dark)' }}>
                    {assignment.class_name || 'All Enrolled Students'}
                  </strong>
                </div>
              </div>
            </div>

            {/* Assignment Instructions & Attached Worksheet */}
            {(assignment.description || assignment.file_name) && (
              <div
                style={{
                  background: '#FAF9F6',
                  border: '1px solid var(--border-color)',
                  borderRadius: 10,
                  padding: '16px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                {assignment.description && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                      Instructions &amp; Problem Overview
                    </div>
                    <div style={{ fontSize: 13.5, color: 'var(--neutral-dark)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                      {assignment.description}
                    </div>
                  </div>
                )}

                {assignment.file_name && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, paddingTop: assignment.description ? 12 : 0, borderTop: assignment.description ? '1px dashed var(--border-color)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 6,
                          background: isTeacherDocPdf ? '#E11D48' : '#2C6E6A',
                          color: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {isTeacherDocPdf ? <FileText size={18} /> : <ImageIcon size={18} />}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                          {assignment.file_name}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                          Official Teacher Attached Document · Ready for student download
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() =>
                          openFileInNewTab({
                            fileName: assignment.file_name || 'Assignment_Material.pdf',
                            fileUrl: assignment.file_url,
                            title: assignment.title,
                            description: assignment.description || 'Official Teacher Homework Document',
                          })
                        }
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '6px 12px',
                          fontSize: 12,
                          fontWeight: 600,
                          background: '#FFFFFF',
                          color: '#2C6E6A',
                          border: '1px solid #C7E4D8',
                          borderRadius: 6,
                          cursor: 'pointer',
                        }}
                      >
                        <ExternalLink size={13} />
                        <span>View Document</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          downloadFile({
                            fileName: assignment.file_name || 'Assignment_Material.pdf',
                            fileUrl: assignment.file_url,
                            title: assignment.title,
                            description: assignment.description || 'Official Teacher Homework Document',
                          })
                        }
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '6px 12px',
                          fontSize: 12,
                          fontWeight: 600,
                          background: '#FFFFFF',
                          color: 'var(--neutral-dark)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 6,
                          cursor: 'pointer',
                        }}
                      >
                        <Download size={13} />
                        <span>Download</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Analytics KPI Metric Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 14,
            }}
          >
            {/* Card 1: Submissions */}
            <div
              style={{
                background: '#FFFFFF',
                border: '1px solid var(--border-color)',
                borderRadius: 12,
                padding: '18px 20px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Submissions
                </span>
                <Users size={16} style={{ color: '#2C6E6A' }} />
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#2C6E6A', marginTop: 8 }}>
                {submittedCount} / {totalCount}
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginLeft: 6 }}>
                  ({submissionPct}%)
                </span>
              </div>
              <div style={{ width: '100%', height: 4, background: '#EAE8E4', borderRadius: 2, marginTop: 10, overflow: 'hidden' }}>
                <div style={{ width: `${submissionPct}%`, height: '100%', background: '#2C6E6A', borderRadius: 2 }} />
              </div>
            </div>

            {/* Card 2: Evaluated */}
            <div
              style={{
                background: '#FFFFFF',
                border: '1px solid var(--border-color)',
                borderRadius: 12,
                padding: '18px 20px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Graded &amp; Evaluated
                </span>
                <CheckCircle size={16} style={{ color: '#16A34A' }} />
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#16A34A', marginTop: 8 }}>
                {gradedCount}
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginLeft: 6 }}>
                  of {submittedCount} submitted
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
                {submittedCount > 0 ? `${Math.round((gradedCount / submittedCount) * 100)}% evaluation rate` : 'No submissions yet'}
              </div>
            </div>

            {/* Card 3: Pending Review */}
            <div
              style={{
                background: '#FFFFFF',
                border: '1px solid var(--border-color)',
                borderRadius: 12,
                padding: '18px 20px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Pending Review
                </span>
                <Clock size={16} style={{ color: '#D97706' }} />
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#D97706', marginTop: 8 }}>
                {pendingCount}
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginLeft: 6 }}>
                  needs grading
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
                {pendingCount > 0 ? 'Ready for teacher score' : 'All submissions evaluated'}
              </div>
            </div>

            {/* Card 4: Missing Homework */}
            <div
              style={{
                background: '#FFFFFF',
                border: '1px solid var(--border-color)',
                borderRadius: 12,
                padding: '18px 20px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Missing Work
                </span>
                <AlertCircle size={16} style={{ color: '#E11D48' }} />
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#E11D48', marginTop: 8 }}>
                {missingCount}
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginLeft: 6 }}>
                  students
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
                {missingCount > 0 ? 'Awaiting initial submission' : '100% homework submission'}
              </div>
            </div>
          </div>

          {/* Segmented Control Filter Bar & Search */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 14,
            }}
          >
            {/* Global Segmented Control Standard */}
            <SegmentedControl
              value={statusFilter}
              onChange={(val) => setStatusFilter(val as any)}
              options={[
                { value: 'all', label: 'All Students', count: totalCount },
                { value: 'submitted', label: 'Submitted', count: submittedCount },
                { value: 'graded', label: 'Graded', count: gradedCount },
                { value: 'pending', label: 'Pending Review', count: pendingCount },
                { value: 'missing', label: 'Missing', count: missingCount },
              ]}
              height={34}
              textTransform="none"
              size="md"
            />

            {/* Search Input */}
            <div style={{ position: 'relative', minWidth: 250 }}>
              <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                type="text"
                placeholder="Search student or Adm No..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 34px',
                  fontSize: 12.5,
                  borderRadius: 6,
                  border: '1px solid #E5E3DF',
                  background: '#FFFFFF',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Student Submissions Table */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid var(--border-color)',
              borderRadius: 14,
              overflowX: 'auto',
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            }}
          >
            {filteredList.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <BookOpen size={32} style={{ margin: '0 auto 12px', color: '#C4C2BC' }} />
                <h4 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px', color: 'var(--neutral-dark)' }}>No Students Found</h4>
                <p style={{ fontSize: 13, margin: 0 }}>
                  {searchQuery ? 'No student matches your search query.' : 'No students match the selected filter.'}
                </p>
              </div>
            ) : (
              <table style={{ width: '100%', minWidth: 940, borderCollapse: 'collapse', fontSize: 12.5, tableLayout: 'auto' }}>
                <thead>
                  <tr
                    style={{
                      background: '#FAF9F6',
                      borderBottom: '1px solid var(--border-color)',
                      color: 'var(--text-secondary)',
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    <th style={{ textAlign: 'left', padding: '12px 12px', width: 36 }}>#</th>
                    <th style={{ textAlign: 'left', padding: '12px 14px', width: 220 }}>Student</th>
                    <th style={{ textAlign: 'left', padding: '12px 12px', width: 85 }}>Adm No.</th>
                    <th style={{ textAlign: 'left', padding: '12px 14px', width: 210 }}>Submission Material</th>
                    <th style={{ textAlign: 'center', padding: '12px 12px', width: 145 }}>
                      Score {assignment.total_marks ? `(/${assignment.total_marks})` : ''}
                    </th>
                    <th style={{ textAlign: 'left', padding: '12px 14px' }}>Teacher Feedback</th>
                    <th style={{ textAlign: 'right', padding: '12px 16px', width: 110 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredList.map((item, idx) => {
                    const { student, submission } = item;
                    const isEditing = editingStudentId === student.id;
                    const hasFile = submission && (submission.file_name || submission.file_url);
                    const hasText = submission && (submission.text_answer || submission.notes);
                    const isPdf = submission?.file_name?.toLowerCase().endsWith('.pdf');

                    return (
                      <tr
                        key={student.id}
                        style={{
                          borderBottom: '1px solid #ECEAE5',
                          background: isEditing ? '#FBF9F2' : 'transparent',
                          transition: 'background 0.1s ease',
                        }}
                      >
                        {/* Index */}
                        <td style={{ padding: '12px 12px', color: '#A09E9A', fontSize: 12 }}>
                          {idx + 1}
                        </td>

                        {/* Student Info */}
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                            <div
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: '50%',
                                background: '#EAF3EF',
                                color: '#2C6E6A',
                                fontWeight: 800,
                                fontSize: 11.5,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              {(student.name || 'S').charAt(0).toUpperCase()}
                            </div>
                            <div style={{ minWidth: 0, overflow: 'hidden' }}>
                              <div style={{ fontWeight: 700, color: 'var(--neutral-dark)', fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {student.name}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>
                                {student.grade ? `Grade ${student.grade}-${student.class_letter || 'A'}` : 'Enrolled'}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Adm No */}
                        <td style={{ padding: '12px 12px', fontFamily: 'monospace', color: 'var(--text-secondary)', fontSize: 12 }}>
                          {student.admission_number || student.user_code || '—'}
                        </td>

                        {/* Submitted Work */}
                        <td style={{ padding: '12px 14px' }}>
                          {submission && (hasFile || hasText) ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {/* Attached File Action */}
                              {hasFile && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openFileInNewTab({
                                        fileName: submission.file_name || 'Completed_Work.pdf',
                                        fileUrl: submission.file_url,
                                        studentName: student.name,
                                        title: assignment.title,
                                        description: submission.notes || submission.text_answer || 'Student submitted homework assignment.',
                                        submissionDate: submission.submitted_at,
                                      })
                                    }
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 5,
                                      padding: '4px 8px',
                                      borderRadius: 5,
                                      fontSize: 11,
                                      fontWeight: 700,
                                      background: '#EAF3EF',
                                      color: '#2C6E6A',
                                      border: '1px solid #C7E4D8',
                                      cursor: 'pointer',
                                      maxWidth: 170,
                                      textAlign: 'left',
                                    }}
                                    title={`Click to view: ${submission.file_name}`}
                                  >
                                    {isPdf ? <FileText size={12} style={{ color: '#E11D48' }} /> : <ImageIcon size={12} />}
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {submission.file_name || 'Work Document'}
                                    </span>
                                    <ExternalLink size={10} style={{ opacity: 0.7, flexShrink: 0 }} />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      downloadFile({
                                        fileName: submission.file_name || 'Completed_Work.pdf',
                                        fileUrl: submission.file_url,
                                        studentName: student.name,
                                        title: assignment.title,
                                        description: submission.notes || submission.text_answer,
                                        submissionDate: submission.submitted_at,
                                      })
                                    }
                                    title="Download Submission File"
                                    style={{
                                      padding: '4px 7px',
                                      borderRadius: 5,
                                      fontSize: 11,
                                      fontWeight: 700,
                                      background: '#FFFFFF',
                                      color: 'var(--neutral-dark)',
                                      border: '1px solid var(--border-color)',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                    }}
                                  >
                                    <Download size={11} />
                                  </button>
                                </div>
                              )}

                              {/* Written Solution Button */}
                              {hasText && (
                                <div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setViewingTextSolution({
                                        studentName: student.name,
                                        text: submission.text_answer || submission.notes || '',
                                        date: submission.submitted_at,
                                        fileName: submission.file_name,
                                        fileUrl: submission.file_url,
                                      })
                                    }
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                      padding: '3px 8px',
                                      borderRadius: 5,
                                      fontSize: 11,
                                      fontWeight: 600,
                                      background: '#F5F3FF',
                                      color: '#6D28D9',
                                      border: '1px solid #DDD6FE',
                                      cursor: 'pointer',
                                      textAlign: 'left',
                                    }}
                                    title="Click to read student written solution"
                                  >
                                    <MessageSquare size={11} />
                                    <span>Written Answer</span>
                                  </button>
                                </div>
                              )}

                              {submission.submitted_at && (
                                <div style={{ fontSize: 10, color: '#A09E9A' }}>
                                  Submitted: {submission.submitted_at}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '3px 7px',
                                borderRadius: 5,
                                fontSize: 11,
                                fontWeight: 700,
                                background: '#FDF1F0',
                                color: '#A83B38',
                                border: '1px solid #F5C6CB',
                              }}
                            >
                              <AlertCircle size={11} />
                              Missing Work
                            </span>
                          )}
                        </td>

                        {/* Grade / Score */}
                        <td style={{ textAlign: 'center', padding: '12px 12px' }}>
                          {isEditing ? (
                            !hasFile && !hasText ? (
                              <div
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  background: '#F0EFEA',
                                  padding: 2,
                                  borderRadius: 6,
                                  border: '1px solid #E2E0D8',
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() => setTempGrade('0')}
                                  style={{
                                    padding: '4px 8px',
                                    fontSize: 11,
                                    fontWeight: 700,
                                    borderRadius: 4,
                                    border: 'none',
                                    background: tempGrade === '0' ? '#FFFFFF' : 'transparent',
                                    color: tempGrade === '0' ? '#20554E' : '#73716B',
                                    boxShadow: tempGrade === '0' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    transition: 'all 0.12s ease',
                                  }}
                                >
                                  0 Marks
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setTempGrade('Absent')}
                                  style={{
                                    padding: '4px 8px',
                                    fontSize: 11,
                                    fontWeight: 700,
                                    borderRadius: 4,
                                    border: 'none',
                                    background: tempGrade.toLowerCase() === 'absent' || tempGrade.toUpperCase() === 'AB' ? '#FFFFFF' : 'transparent',
                                    color: tempGrade.toLowerCase() === 'absent' || tempGrade.toUpperCase() === 'AB' ? '#A83B38' : '#73716B',
                                    boxShadow: tempGrade.toLowerCase() === 'absent' || tempGrade.toUpperCase() === 'AB' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    transition: 'all 0.12s ease',
                                  }}
                                >
                                  Absent
                                </button>
                              </div>
                            ) : (
                              <input
                                type="text"
                                value={tempGrade}
                                placeholder={assignment.total_marks ? `e.g. 24` : 'e.g. A'}
                                onChange={(e) => setTempGrade(e.target.value)}
                                style={{
                                  width: 65,
                                  padding: '5px 6px',
                                  textAlign: 'center',
                                  fontSize: 12.5,
                                  border: '2px solid #2C6E6A',
                                  borderRadius: 6,
                                  fontWeight: 700,
                                  outline: 'none',
                                  background: '#FFFFFF',
                                  boxSizing: 'border-box',
                                }}
                                autoFocus
                              />
                            )
                          ) : submission?.grade ? (
                            submission.grade.toLowerCase() === 'absent' || submission.grade.toUpperCase() === 'AB' ? (
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  padding: '3px 8px',
                                  borderRadius: 4,
                                  background: '#FDF1F0',
                                  color: '#A83B38',
                                  border: '1px solid #F5C6CB',
                                  display: 'inline-block',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                Absent (AB)
                              </span>
                            ) : submission.grade === '0' ? (
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  padding: '3px 8px',
                                  borderRadius: 4,
                                  background: '#F8F9FA',
                                  color: '#64748B',
                                  border: '1px solid #E2E8F0',
                                  display: 'inline-block',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                0 / {assignment.total_marks || 25}
                              </span>
                            ) : (
                              <span
                                style={{
                                  fontSize: 12.5,
                                  fontWeight: 800,
                                  padding: '3px 8px',
                                  borderRadius: 5,
                                  background: '#FEF7EC',
                                  color: '#9E6C1B',
                                  border: '1px solid #F5DEB3',
                                  display: 'inline-block',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {submission.grade}
                                {assignment.total_marks && !submission.grade.includes('/') && !isNaN(Number(submission.grade))
                                  ? ` / ${assignment.total_marks}`
                                  : ''}
                              </span>
                            )
                          ) : (
                            <span style={{ color: '#CBD5E1', fontSize: 14 }}>—</span>
                          )}
                        </td>

                        {/* Feedback */}
                        <td style={{ padding: '12px 14px' }}>
                          {isEditing ? (
                            <input
                              type="text"
                              placeholder="Add feedback note..."
                              value={tempFeedback}
                              onChange={(e) => setTempFeedback(e.target.value)}
                              style={{
                                width: '100%',
                                padding: '5px 9px',
                                fontSize: 12,
                                border: '1px solid var(--border-color)',
                                borderRadius: 6,
                                background: '#FFFFFF',
                                boxSizing: 'border-box',
                              }}
                            />
                          ) : (
                            <span style={{ fontSize: 12, color: submission?.feedback ? 'var(--neutral-dark)' : '#A09E9A' }}>
                              {submission?.feedback || 'No comments'}
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td style={{ textAlign: 'right', padding: '12px 16px' }}>
                          {isEditing ? (
                            <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end', alignItems: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleSave(student.id, !hasFile && !hasText)}
                                style={{
                                  padding: '5px 10px',
                                  fontSize: 11.5,
                                  fontWeight: 700,
                                  background: '#2C6E6A',
                                  color: '#FFFFFF',
                                  border: 'none',
                                  borderRadius: 6,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                <Check size={12} />
                                <span>Save</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingStudentId(null)}
                                style={{
                                  padding: '5px 7px',
                                  fontSize: 11.5,
                                  background: '#FAF9F6',
                                  border: '1px solid var(--border-color)',
                                  borderRadius: 6,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                                title="Cancel"
                              >
                                <X size={13} />
                              </button>
                            </div>
                          ) : hasFile || hasText ? (
                            <button
                              type="button"
                              onClick={() => handleStartGrading(student.id, submission?.grade, submission?.feedback, false)}
                              style={{
                                padding: '5px 12px',
                                fontSize: 11.5,
                                fontWeight: 700,
                                background: submission?.grade ? '#FFFFFF' : '#2D2C2A',
                                color: submission?.grade ? 'var(--neutral-dark)' : '#FFFFFF',
                                border: submission?.grade ? '1px solid var(--border-color)' : 'none',
                                borderRadius: 6,
                                cursor: 'pointer',
                                transition: 'all 0.12s ease',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {submission?.grade ? 'Edit Grade' : 'Grade'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleStartGrading(student.id, submission?.grade, submission?.feedback, true)}
                              style={{
                                padding: '5px 10px',
                                fontSize: 11.5,
                                fontWeight: 600,
                                background: submission?.grade ? '#FFFFFF' : '#FDF1F0',
                                color: submission?.grade ? 'var(--neutral-dark)' : '#A83B38',
                                border: '1px solid ' + (submission?.grade ? 'var(--border-color)' : '#F5C6CB'),
                                borderRadius: 6,
                                cursor: 'pointer',
                                transition: 'all 0.12s ease',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {submission?.grade ? `Edit (${submission.grade})` : 'Mark 0 / Absent'}
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

          {/* Footer Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: 8,
            }}
          >
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Showing <strong>{filteredList.length}</strong> of {totalCount} enrolled students
            </div>

            <button
              type="button"
              className="btn-primary"
              onClick={onClose}
              style={{
                padding: '9px 24px',
                fontSize: 13,
                fontWeight: 700,
                borderRadius: 8,
              }}
            >
              Done &amp; Close
            </button>
          </div>
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

      {/* Student Written Text Solution Modal */}
      {viewingTextSolution && (
        <div
          className="dialog-overlay"
          onClick={() => setViewingTextSolution(null)}
        >
          <div
            className="dialog-card"
            style={{ maxWidth: 620 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="dialog-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: '#EAF3EF',
                    color: '#2C6E6A',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <MessageSquare size={18} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: '#2C6E6A',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      Student Written Solution
                    </span>
                    {viewingTextSolution.date && (
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        · {viewingTextSolution.date}
                      </span>
                    )}
                  </div>
                  <h3 style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                    {viewingTextSolution.studentName}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                className="dialog-close-btn"
                onClick={() => setViewingTextSolution(null)}
                title="Close"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="dialog-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Solution Card with Copy and Word Count Bar */}
              <div
                style={{
                  background: '#FAF9F6',
                  border: '1px solid var(--border-color)',
                  borderRadius: 10,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 14px',
                    borderBottom: '1px solid var(--border-color)',
                    background: '#F5F4F0',
                    fontSize: 11.5,
                    color: 'var(--text-secondary)',
                  }}
                >
                  <span style={{ fontWeight: 600 }}>
                    {viewingTextSolution.text.trim().split(/\s+/).filter(Boolean).length} words ·{' '}
                    {viewingTextSolution.text.length} characters
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(viewingTextSolution.text);
                      setCopiedSolution(true);
                      setTimeout(() => setCopiedSolution(false), 2000);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '3px 8px',
                      borderRadius: 4,
                      background: '#FFFFFF',
                      border: '1px solid var(--border-color)',
                      fontSize: 11,
                      fontWeight: 600,
                      color: copiedSolution ? '#16A34A' : 'var(--neutral-dark)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {copiedSolution ? <Check size={12} color="#16A34A" /> : <Copy size={12} />}
                    <span>{copiedSolution ? 'Copied!' : 'Copy Text'}</span>
                  </button>
                </div>

                <div
                  style={{
                    padding: '16px 18px',
                    fontSize: 13.5,
                    lineHeight: 1.65,
                    whiteSpace: 'pre-wrap',
                    color: 'var(--neutral-dark)',
                    fontFamily: 'inherit',
                    maxHeight: '45vh',
                    overflowY: 'auto',
                  }}
                >
                  {viewingTextSolution.text || '(No text answer provided)'}
                </div>
              </div>

              {/* Optional attached file trigger if available */}
              {viewingTextSolution.fileName && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: '#F0F6F5',
                    border: '1px solid #CBE2DF',
                    borderRadius: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                    <FileText size={16} color="#2C6E6A" />
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--neutral-dark)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: 280,
                      }}
                    >
                      {viewingTextSolution.fileName}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const fileObj = {
                        fileName: viewingTextSolution.fileName!,
                        fileUrl: viewingTextSolution.fileUrl,
                        studentName: viewingTextSolution.studentName,
                        title: assignment?.title,
                        description: viewingTextSolution.text,
                        submissionDate: viewingTextSolution.date,
                      };
                      setViewingTextSolution(null);
                      setViewingFile(fileObj);
                    }}
                    style={{
                      padding: '4px 10px',
                      fontSize: 11.5,
                      fontWeight: 600,
                      background: '#2C6E6A',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: 6,
                      cursor: 'pointer',
                    }}
                  >
                    View File
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="dialog-card-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setViewingTextSolution(null)}
                style={{ padding: '7px 18px', fontSize: 13, borderRadius: 6 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
