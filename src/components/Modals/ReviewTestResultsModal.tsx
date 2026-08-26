'use client';

import React, { useState, useMemo } from 'react';
import { TestItem, UserProfile } from '@/lib/supabaseClient';
import { ArrowLeft, CheckCircle2, Clock, Trash2, Award, Users, BarChart3, Check, X } from 'lucide-react';

export interface TestResultRecord {
  test_id: string;
  student_id: string;
  student_name: string;
  score: number;
  completed_at?: string;
  feedback?: string;
}

interface ReviewTestResultsModalProps {
  isOpen: boolean;
  test: TestItem | null;
  classStudents: UserProfile[];
  testResults: Record<string, TestResultRecord>;
  onSaveGrade: (testId: string, studentId: string, score: number, feedback?: string) => void;
  onDeleteTest: (testId: string) => void;
  onClose: () => void;
}

export const ReviewTestResultsModal: React.FC<ReviewTestResultsModalProps> = ({
  isOpen,
  test,
  classStudents,
  testResults,
  onSaveGrade,
  onDeleteTest,
  onClose,
}) => {
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [tempScore, setTempScore] = useState<number>(100);
  const [tempFeedback, setTempFeedback] = useState<string>('');

  const studentResultList = useMemo(() => {
    if (!test) return [];
    return classStudents.map((st) => {
      const key = `${test.id}_${st.id}`;
      const result = testResults[key];
      return {
        student: st,
        result: result || null,
      };
    });
  }, [test, classStudents, testResults]);

  if (!isOpen || !test) return null;

  const completedCount = studentResultList.filter((item) => item.result !== null).length;
  const totalCount = studentResultList.length;
  const completionPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  
  const scoresArray = studentResultList.map((i) => i.result?.score).filter((s): s is number => s !== undefined && s !== null);
  const avgScore = scoresArray.length > 0 ? Math.round(scoresArray.reduce((a, b) => a + b, 0) / scoresArray.length) : 0;
  const highestScore = scoresArray.length > 0 ? Math.max(...scoresArray) : 0;

  const handleStartEdit = (stId: string, currentScore: number = 100, currentFeedback: string = '') => {
    setEditingStudentId(stId);
    setTempScore(currentScore);
    setTempFeedback(currentFeedback);
  };

  const handleSaveScore = (stId: string) => {
    onSaveGrade(test.id, stId, tempScore, tempFeedback.trim());
    setEditingStudentId(null);
  };

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflowY: 'auto',
          background: 'var(--bg-primary, #FAF9F6)',
        }}
      >
        {/* Centered Main Content Wrapper */}
        <div
          style={{
            maxWidth: 1040,
            width: '100%',
            margin: '0 auto',
            padding: '24px 28px 48px',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            boxSizing: 'border-box',
          }}
        >
          {/* Top Breadcrumb & Header Row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                onClick={onClose}
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
                  transition: 'background 0.12s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#F3F2EF')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#FFFFFF')}
              >
                <ArrowLeft size={14} />
                Back
              </button>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>/</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#2C6E6A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Class Test Results &amp; Analytics
              </span>
            </div>

            <button
              type="button"
              className="close-modal"
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: 22,
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                lineHeight: 1,
              }}
            >
              &times;
            </button>
          </div>

          {/* Hero Banner Card */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid var(--border-color)',
              borderRadius: 10,
              padding: '20px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 16,
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    padding: '2px 7px',
                    borderRadius: 4,
                    background: '#EAF3EF',
                    color: '#2D6E5D',
                  }}
                >
                  Class Test
                </span>
                <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                  Target: <strong>{test.class_name || 'All Enrolled Students'}</strong>
                </span>
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--neutral-dark)', margin: '6px 0 0' }}>
                {test.title}
              </h1>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                {test.created_at ? `Published: ${new Date(test.created_at).toLocaleDateString()}` : 'Active Assessment'}
                {test.duration_minutes ? ` • Duration: ${test.duration_minutes} Mins` : ''}
                {test.total_marks ? ` • Max Marks: ${test.total_marks}` : ''}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Are you sure you want to delete class test "${test.title}"? This cannot be undone.`)) {
                    onDeleteTest(test.id);
                    onClose();
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
                <Trash2 size={14} />
                Delete Class Test
              </button>
            </div>
          </div>

          {/* Analytics KPI Summary Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 14,
            }}
          >
            {/* Completion Rate */}
            <div
              style={{
                background: '#FFFFFF',
                border: '1px solid var(--border-color)',
                borderRadius: 10,
                padding: '16px 18px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Completion Rate
                </span>
                <Users size={16} style={{ color: '#2C6E6A' }} />
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#2C6E6A', marginTop: 6 }}>
                {completedCount} / {totalCount}
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginLeft: 6 }}>
                  ({completionPercentage}%)
                </span>
              </div>
            </div>

            {/* Average Score */}
            <div
              style={{
                background: '#FFFFFF',
                border: '1px solid var(--border-color)',
                borderRadius: 10,
                padding: '16px 18px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Average Score
                </span>
                <BarChart3 size={16} style={{ color: avgScore >= 70 ? '#2C6E6A' : '#D9534F' }} />
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: avgScore >= 70 ? '#2C6E6A' : '#D9534F', marginTop: 6 }}>
                {completedCount > 0 ? `${avgScore}%` : '—'}
              </div>
            </div>

            {/* Highest Score */}
            <div
              style={{
                background: '#FFFFFF',
                border: '1px solid var(--border-color)',
                borderRadius: 10,
                padding: '16px 18px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Highest Score
                </span>
                <Award size={16} style={{ color: '#D97706' }} />
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#D97706', marginTop: 6 }}>
                {completedCount > 0 ? `${highestScore}%` : '—'}
              </div>
            </div>

            {/* Pending Attempts */}
            <div
              style={{
                background: '#FFFFFF',
                border: '1px solid var(--border-color)',
                borderRadius: 10,
                padding: '16px 18px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Pending Attempts
                </span>
                <Clock size={16} style={{ color: '#9A3412' }} />
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#C2410C', marginTop: 6 }}>
                {totalCount - completedCount} Students
              </div>
            </div>
          </div>

          {/* Student Score Register Table Card */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid var(--border-color)',
              borderRadius: 10,
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            }}
          >
            <div
              style={{
                padding: '14px 20px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#FAF9F6',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--neutral-dark)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Student Score Register &amp; Submissions ({studentResultList.length})
              </div>
              <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                {completedCount} of {totalCount} completed
              </span>
            </div>

            {studentResultList.length === 0 ? (
              <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                No students currently enrolled in this classroom roster.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr
                      style={{
                        background: '#F8F7F4',
                        borderBottom: '1px solid var(--border-color)',
                        color: 'var(--text-secondary)',
                        fontSize: 10.5,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      <th style={{ textAlign: 'left', padding: '12px 16px', width: 36 }}>#</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', minWidth: 200 }}>Student</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', width: 130 }}>Admission No.</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', width: 140 }}>Status</th>
                      <th style={{ textAlign: 'center', padding: '12px 16px', width: 100 }}>Score</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px' }}>Teacher Feedback</th>
                      <th style={{ textAlign: 'right', padding: '12px 16px', width: 110 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentResultList.map((item, idx) => {
                      const { student, result } = item;
                      const isEditing = editingStudentId === student.id;

                      // Fix duplicate Grade label bug cleanly
                      const rawGrade = student.grade || '';
                      const cleanG = rawGrade.replace(/^Grade\s*/i, '');
                      const gradeDisplay = cleanG
                        ? `Grade ${cleanG}${student.class_letter ? `-${student.class_letter.toUpperCase()}` : ''}`
                        : 'Student';

                      return (
                        <tr
                          key={student.id}
                          style={{
                            borderBottom: '1px solid #ECEAE5',
                            background: idx % 2 === 0 ? '#FFFFFF' : '#FAF9F7',
                          }}
                        >
                          <td style={{ padding: '12px 16px', color: '#9E9B95', fontSize: 11 }}>
                            {idx + 1}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 700, color: 'var(--neutral-dark)', fontSize: 13 }}>
                              {student.name}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                              {gradeDisplay}
                            </div>
                          </td>
                          <td
                            style={{
                              padding: '12px 16px',
                              fontFamily: 'monospace',
                              color: 'var(--neutral-dark)',
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            {student.admission_number || student.user_code || '—'}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            {result ? (
                              <div>
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    padding: '3px 8px',
                                    borderRadius: 4,
                                    background: '#EAF3EF',
                                    color: '#2D6E5D',
                                    fontSize: 11,
                                    fontWeight: 700,
                                    border: '1px solid #C7E4D8',
                                  }}
                                >
                                  <CheckCircle2 size={12} />
                                  Completed
                                </span>
                                {result.completed_at && (
                                  <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                                    {new Date(result.completed_at).toLocaleDateString()}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  padding: '3px 8px',
                                  borderRadius: 4,
                                  background: '#FEF3C7',
                                  color: '#92400E',
                                  fontSize: 11,
                                  fontWeight: 600,
                                  border: '1px solid #FDE68A',
                                }}
                              >
                                <Clock size={12} />
                                Pending
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            {isEditing ? (
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={tempScore}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  if (isNaN(val)) setTempScore(0);
                                  else if (val < 0) setTempScore(0);
                                  else if (val > 100) setTempScore(100);
                                  else setTempScore(val);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === '-' || e.key === '+' || e.key === 'e' || e.key === 'E') {
                                    e.preventDefault();
                                  }
                                }}
                                style={{
                                  width: 60,
                                  padding: '4px 6px',
                                  fontSize: 12.5,
                                  fontWeight: 700,
                                  border: '1.5px solid #2C6E6A',
                                  borderRadius: 4,
                                  textAlign: 'center',
                                }}
                              />
                            ) : result ? (
                              <span
                                style={{
                                  fontSize: 14,
                                  fontWeight: 800,
                                  color: result.score >= 70 ? '#2C6E6A' : '#DC2626',
                                }}
                              >
                                {result.score}%
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-secondary)' }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            {isEditing ? (
                              <input
                                type="text"
                                value={tempFeedback}
                                onChange={(e) => setTempFeedback(e.target.value)}
                                placeholder="Add grading feedback..."
                                style={{
                                  width: '100%',
                                  padding: '4px 8px',
                                  fontSize: 12,
                                  border: '1px solid var(--border-color)',
                                  borderRadius: 4,
                                }}
                              />
                            ) : result?.feedback ? (
                              <span style={{ fontSize: 12, color: 'var(--neutral-dark)' }}>
                                {result.feedback}
                              </span>
                            ) : (
                              <span style={{ fontSize: 11.5, color: '#9E9B95', fontStyle: 'italic' }}>
                                No feedback given
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', padding: '12px 16px', whiteSpace: 'nowrap' }}>
                            {isEditing ? (
                              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                <button
                                  type="button"
                                  onClick={() => handleSaveScore(student.id)}
                                  style={{
                                    padding: '4px 10px',
                                    fontSize: 11,
                                    fontWeight: 700,
                                    background: '#2C6E6A',
                                    color: '#FFF',
                                    border: 'none',
                                    borderRadius: 4,
                                    cursor: 'pointer',
                                  }}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingStudentId(null)}
                                  style={{
                                    padding: '4px 8px',
                                    fontSize: 11,
                                    background: '#FAF9F6',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 4,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleStartEdit(student.id, result?.score ?? 100, result?.feedback ?? '')}
                                style={{
                                  padding: '4px 12px',
                                  fontSize: 11.5,
                                  fontWeight: 600,
                                  background: '#FFFFFF',
                                  border: '1px solid var(--border-color)',
                                  borderRadius: 5,
                                  cursor: 'pointer',
                                  color: 'var(--neutral-dark)',
                                }}
                              >
                                {result ? 'Edit' : 'Grade'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Bottom Completion Bar */}
          <div
            style={{
              padding: '16px 20px',
              background: '#FFFFFF',
              border: '1px solid var(--border-color)',
              borderRadius: 10,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Scores are recorded and reflected directly in student gradebooks and parent progress cards.
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={onClose}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 24px',
                fontSize: 13,
                fontWeight: 700,
                background: '#1A1A1A',
                color: '#FFFFFF',
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Check size={14} />
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
