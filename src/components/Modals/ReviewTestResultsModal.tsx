'use client';

import React, { useState, useMemo } from 'react';
import { TestItem, UserProfile } from '@/lib/supabaseClient';

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
  const avgScore =
    completedCount > 0
      ? Math.round(
          studentResultList.reduce((acc, cur) => acc + (cur.result?.score || 0), 0) / completedCount
        )
      : 0;

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
        style={{ maxWidth: 720, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#2C6E6A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Class Test Results &amp; Analytics
            </span>
            <h2 className="modal-title" style={{ margin: '2px 0 0', fontSize: 17 }}>{test.title}</h2>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
              Target Class: {test.class_name || 'All Enrolled Students'}
            </div>
          </div>
          <button type="button" className="close-modal" onClick={onClose}>&times;</button>
        </div>

        {/* KPI Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, padding: '14px 20px', background: '#FAF9F6', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 6, padding: '10px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Completion Rate</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#2C6E6A', marginTop: 2 }}>
              {completedCount} / {totalCount} ({totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0}%)
            </div>
          </div>
          <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 6, padding: '10px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Average Score</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: avgScore >= 70 ? '#2C6E6A' : '#D9534F', marginTop: 2 }}>
              {completedCount > 0 ? `${avgScore}%` : '—'}
            </div>
          </div>
          <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 6, padding: '10px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Pending Attempts</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#D4A373', marginTop: 2 }}>
              {totalCount - completedCount} Students
            </div>
          </div>
        </div>

        {/* Student Score Register Table */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
          {studentResultList.length === 0 ? (
            <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
              No students enrolled in this classroom roster.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F8F7F4', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: 10, textTransform: 'uppercase', position: 'sticky', top: 0, zIndex: 2 }}>
                  <th style={{ textAlign: 'left', padding: '10px 12px', width: 36 }}>#</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', minWidth: 160 }}>Student</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', width: 110 }}>Admission No.</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', width: 130 }}>Status</th>
                  <th style={{ textAlign: 'center', padding: '10px 12px', width: 90 }}>Score</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px' }}>Teacher Feedback</th>
                  <th style={{ textAlign: 'right', padding: '10px 12px', width: 80 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {studentResultList.map((item, idx) => {
                  const { student, result } = item;
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
                        {result ? (
                          <span style={{ display: 'inline-block', padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: '#EAF3EF', color: '#2D6E5D', border: '1px solid #C7E4D8' }}>
                            Completed
                          </span>
                        ) : (
                          <span style={{ display: 'inline-block', padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: '#FEF7EC', color: '#9E6C1B', border: '1px solid #F5DEB3' }}>
                            Pending
                          </span>
                        )}
                        {result?.completed_at && (
                          <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                            {result.completed_at}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'center', padding: '10px 12px' }}>
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={tempScore}
                            onChange={(e) => setTempScore(Number(e.target.value))}
                            style={{ width: 60, padding: '4px', textAlign: 'center', fontSize: 12, border: '1px solid #2C6E6A', borderRadius: 4 }}
                          />
                        ) : result ? (
                          <span style={{ fontSize: 13, fontWeight: 800, color: result.score >= 70 ? '#2C6E6A' : '#D9534F' }}>
                            {result.score}%
                          </span>
                        ) : (
                          <span style={{ color: '#CBD5E1' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {isEditing ? (
                          <input
                            type="text"
                            placeholder="Add feedback..."
                            value={tempFeedback}
                            onChange={(e) => setTempFeedback(e.target.value)}
                            style={{ width: '100%', padding: '4px 8px', fontSize: 11.5, border: '1px solid var(--border-color)', borderRadius: 4 }}
                          />
                        ) : (
                          <span style={{ fontSize: 11.5, color: result?.feedback ? 'var(--neutral-dark)' : '#CBD5E1' }}>
                            {result?.feedback || 'No feedback given'}
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', padding: '10px 12px' }}>
                        {isEditing ? (
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => handleSaveScore(student.id)}
                              style={{ padding: '3px 8px', fontSize: 10.5, fontWeight: 700, background: '#2C6E6A', color: '#FFF', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingStudentId(null)}
                              style={{ padding: '3px 6px', fontSize: 10.5, background: '#FAF9F6', border: '1px solid var(--border-color)', borderRadius: 4, cursor: 'pointer' }}
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleStartEdit(student.id, result?.score ?? 100, result?.feedback ?? '')}
                            style={{ padding: '3px 8px', fontSize: 11, fontWeight: 600, background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 4, cursor: 'pointer', color: 'var(--neutral-dark)' }}
                          >
                            {result ? 'Edit' : 'Mark'}
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

        {/* Footer with Delete Test */}
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
              if (confirm(`Are you sure you want to delete class test "${test.title}"? This cannot be undone.`)) {
                onDeleteTest(test.id);
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
            Delete Class Test
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
    </div>
  );
};
