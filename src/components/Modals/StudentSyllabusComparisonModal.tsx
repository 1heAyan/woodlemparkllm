'use client';

import React, { useState, useMemo } from 'react';
import { UserProfile, SyllabusTerm, StudentCustomTopic } from '@/lib/supabaseClient';
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  Sparkles,
  BookOpen,
  X,
  Search,
  Filter,
  Check,
  MinusCircle,
} from 'lucide-react';

interface StudentSyllabusComparisonModalProps {
  isOpen: boolean;
  student: UserProfile | null;
  className: string;
  subjectName: string;
  terms: SyllabusTerm[];
  studentSyllabusProgress: Record<string, boolean>;
  studentCustomTopics: StudentCustomTopic[];
  onClose: () => void;
}

export const StudentSyllabusComparisonModal: React.FC<StudentSyllabusComparisonModalProps> = ({
  isOpen,
  student,
  className,
  subjectName,
  terms,
  studentSyllabusProgress,
  studentCustomTopics,
  onClose,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'needs_revision' | 'both_done' | 'student_ahead' | 'custom'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Extract all standard curriculum topics
  const allCurriculumTopics = useMemo(() => {
    return terms.flatMap((term) =>
      (term.topics || []).map((tp) => ({
        ...tp,
        termName: term.name,
      }))
    );
  }, [terms]);

  // Extract this specific student's custom topics for this subject
  const myCustomTopics = useMemo(() => {
    if (!student) return [];
    return studentCustomTopics.filter(
      (ct) =>
        ct.student_id === student.id &&
        (!ct.subject ||
          ct.subject.toLowerCase() === subjectName.toLowerCase() ||
          subjectName.toLowerCase().includes(ct.subject.toLowerCase()) ||
          ct.subject.toLowerCase().includes(subjectName.toLowerCase()))
    );
  }, [student, studentCustomTopics, subjectName]);

  // Comparison Metrics for this student
  const stats = useMemo(() => {
    if (!student) {
      return {
        total: 0,
        teacherDone: 0,
        studentDone: 0,
        bothDone: 0,
        needsRevision: 0,
        studentAhead: 0,
        teacherPct: 0,
        studentPct: 0,
      };
    }

    let tDone = 0;
    let sDone = 0;
    let both = 0;
    let needsRev = 0;
    let ahead = 0;

    allCurriculumTopics.forEach((tp) => {
      const isTeacher = !!tp.teacher_checked;
      const isStudent = !!studentSyllabusProgress[`${student.id}_${tp.id}`];

      if (isTeacher) tDone++;
      if (isStudent) sDone++;

      if (isTeacher && isStudent) both++;
      else if (isTeacher && !isStudent) needsRev++;
      else if (!isTeacher && isStudent) ahead++;
    });

    const total = allCurriculumTopics.length;
    const tPct = total > 0 ? Math.round((tDone / total) * 100) : 0;
    const sPct = total > 0 ? Math.round((sDone / total) * 100) : 0;

    return {
      total,
      teacherDone: tDone,
      studentDone: sDone,
      bothDone: both,
      needsRevision: needsRev,
      studentAhead: ahead,
      teacherPct: tPct,
      studentPct: sPct,
    };
  }, [student, allCurriculumTopics, studentSyllabusProgress]);

  // Filtered topics list
  const filteredTopics = useMemo(() => {
    if (!student) return [];

    let list = allCurriculumTopics.map((tp) => {
      const isTeacher = !!tp.teacher_checked;
      const isStudent = !!studentSyllabusProgress[`${student.id}_${tp.id}`];

      let statusType: 'both_done' | 'needs_revision' | 'student_ahead' | 'pending';
      if (isTeacher && isStudent) statusType = 'both_done';
      else if (isTeacher && !isStudent) statusType = 'needs_revision';
      else if (!isTeacher && isStudent) statusType = 'student_ahead';
      else statusType = 'pending';

      return {
        id: tp.id,
        title: tp.title,
        termName: tp.termName,
        isTeacher,
        isStudent,
        statusType,
        isCustom: false,
        notes: undefined as string | undefined,
        coveredAt: undefined as string | undefined,
      };
    });

    // Add custom topics
    const customList = myCustomTopics.map((ct) => ({
      id: ct.id,
      title: ct.title,
      termName: ct.term_name || 'Self-Study',
      isTeacher: false,
      isStudent: true,
      statusType: 'student_ahead' as const,
      isCustom: true,
      notes: ct.notes,
      coveredAt: ct.covered_at,
    }));

    let combined = [...list, ...customList];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      combined = combined.filter(
        (item) => item.title.toLowerCase().includes(q) || item.termName.toLowerCase().includes(q)
      );
    }

    if (filterMode === 'needs_revision') {
      return combined.filter((item) => item.statusType === 'needs_revision');
    } else if (filterMode === 'both_done') {
      return combined.filter((item) => item.statusType === 'both_done');
    } else if (filterMode === 'student_ahead') {
      return combined.filter((item) => item.statusType === 'student_ahead' && !item.isCustom);
    } else if (filterMode === 'custom') {
      return combined.filter((item) => item.isCustom);
    }

    return combined;
  }, [student, allCurriculumTopics, myCustomTopics, studentSyllabusProgress, filterMode, searchQuery]);

  if (!isOpen || !student) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 820,
          width: '100%',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#FFFFFF',
          borderRadius: 12,
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
          overflow: 'hidden',
        }}
      >
        {/* MODAL HEADER */}
        <div
          style={{
            padding: '16px 22px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#FFFFFF',
            flexShrink: 0,
          }}
        >
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--neutral-dark)' }}>
              {student.name} • Syllabus Comparison
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '3px 0 0' }}>
              {subjectName} • {className || `Grade ${student.grade || ''}`} • Live topic coverage comparison
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              padding: 4,
              borderRadius: 4,
            }}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* COMPACT SUMMARY & FILTER BAR */}
        <div
          style={{
            padding: '12px 20px',
            background: '#FAF9F6',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 12.5 }}>
            <span style={{ color: 'var(--text-secondary)' }}>
              Teacher: <strong style={{ color: 'var(--neutral-dark)' }}>{stats.teacherDone}/{stats.total} ({stats.teacherPct}%)</strong>
            </span>
            <span style={{ color: 'var(--border-color)' }}>•</span>
            <span style={{ color: 'var(--text-secondary)' }}>
              Student: <strong style={{ color: '#2C6E6A' }}>{stats.studentDone}/{stats.total} ({stats.studentPct}%)</strong>
            </span>
            <span style={{ color: 'var(--border-color)' }}>•</span>
            {stats.needsRevision > 0 ? (
              <span style={{ color: '#B45309', fontWeight: 600 }}>
                {stats.needsRevision} behind
              </span>
            ) : (
              <span style={{ color: '#166534', fontWeight: 600 }}>
                Fully synced
              </span>
            )}
            {myCustomTopics.length > 0 && (
              <>
                <span style={{ color: 'var(--border-color)' }}>•</span>
                <span style={{ color: '#6D28D9' }}>
                  +{myCustomTopics.length} self-study
                </span>
              </>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: 180 }}>
              <Search
                size={12}
                style={{
                  position: 'absolute',
                  left: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-secondary)',
                }}
              />
              <input
                type="text"
                placeholder="Search topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '5px 8px 5px 26px',
                  fontSize: 12,
                  border: '1px solid var(--border-color)',
                  borderRadius: 6,
                  background: '#FFFFFF',
                  outline: 'none',
                }}
              />
            </div>

            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value as any)}
              style={{
                padding: '5px 8px',
                fontSize: 12,
                border: '1px solid var(--border-color)',
                borderRadius: 6,
                background: '#FFFFFF',
                color: 'var(--neutral-dark)',
                cursor: 'pointer',
              }}
            >
              <option value="all">All topics ({allCurriculumTopics.length + myCustomTopics.length})</option>
              <option value="needs_revision">Needs revision ({stats.needsRevision})</option>
              <option value="both_done">Completed ({stats.bothDone})</option>
              <option value="student_ahead">Ahead ({stats.studentAhead})</option>
              {myCustomTopics.length > 0 && <option value="custom">Self-study ({myCustomTopics.length})</option>}
            </select>
          </div>
        </div>

        {/* TOPIC COMPARISON LIST BODY */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', background: '#FFFFFF' }}>
          {filteredTopics.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <p style={{ margin: 0, fontSize: 13 }}>No topics match the selected filter criteria.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredTopics.map((topic) => (
                <div
                  key={topic.id}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 6,
                    border: '1px solid var(--border-color)',
                    background: topic.statusType === 'needs_revision' ? '#FFFDF7' : '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 14,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
                        [{topic.termName}]
                      </span>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: topic.statusType === 'needs_revision' ? '#92400E' : 'var(--neutral-dark)',
                        }}
                      >
                        {topic.title}
                      </span>
                      {topic.isCustom && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            padding: '1px 6px',
                            borderRadius: 4,
                            background: '#F3E8FF',
                            color: '#7C3AED',
                            border: '1px solid #E9D5FF',
                          }}
                        >
                          Self-study
                        </span>
                      )}
                    </div>

                    {topic.notes && (
                      <p style={{ margin: '3px 0 0', fontSize: 11.5, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                        "{topic.notes}" {topic.coveredAt ? `• Date: ${topic.coveredAt}` : ''}
                      </p>
                    )}
                  </div>

                  {/* SINGLE CLEAN STATUS BADGE */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      {topic.isTeacher ? 'Taught in class' : 'Pending in class'}
                    </div>

                    {topic.statusType === 'both_done' && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: '#EAF3EF',
                          color: '#2C6E5D',
                          display: 'inline-block',
                        }}
                      >
                        Completed
                      </span>
                    )}
                    {topic.statusType === 'needs_revision' && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: '#FEF3C7',
                          color: '#92400E',
                          display: 'inline-block',
                        }}
                      >
                        Needs revision
                      </span>
                    )}
                    {topic.statusType === 'student_ahead' && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: '#DBEAFE',
                          color: '#1D4ED8',
                          display: 'inline-block',
                        }}
                      >
                        Ahead of class
                      </span>
                    )}
                    {topic.statusType === 'pending' && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: '#F3F4F6',
                          color: '#6B7280',
                          display: 'inline-block',
                        }}
                      >
                        Upcoming
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div
          style={{
            padding: '12px 24px',
            background: '#FAF9F6',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
            Showing comparison across <strong>{filteredTopics.length}</strong> topics for {student.name}.
          </span>
          <button
            type="button"
            className="btn-primary"
            onClick={onClose}
            style={{ padding: '7px 18px', fontSize: 12 }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
