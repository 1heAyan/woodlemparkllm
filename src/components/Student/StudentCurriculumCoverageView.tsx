'use client';

import React, { useState, useMemo } from 'react';
import {
  UserProfile,
  SubjectClass,
  SyllabusTerm,
  SyllabusTopic,
  StudentCustomTopic,
} from '@/lib/supabaseClient';
import {
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { AddStudentCoveredTopicModal } from '../Modals/AddStudentCoveredTopicModal';

interface StudentCurriculumCoverageViewProps {
  currentStudent: UserProfile;
  subjectClasses: SubjectClass[];
  syllabus: SyllabusTerm[];
  studentSyllabusProgress: Record<string, boolean>;
  studentCustomTopics: StudentCustomTopic[];
  onToggleTopicCheck: (
    termId: string,
    topicId: string,
    role: 'teacher' | 'student',
    isChecked: boolean,
    studentId?: string
  ) => void;
  onCreateStudentCustomTopic?: (topicData: Omit<StudentCustomTopic, 'id'>) => void;
  onDeleteStudentCustomTopic?: (topicId: string, studentId: string) => void;
  selectedClassId?: string;
  onSelectClassId?: (classId: string) => void;
  isScopedToClass?: boolean; // True if rendered inside class syllabus subtab
}

export const StudentCurriculumCoverageView: React.FC<StudentCurriculumCoverageViewProps> = ({
  currentStudent,
  subjectClasses,
  syllabus,
  studentSyllabusProgress,
  studentCustomTopics,
  onToggleTopicCheck,
  onCreateStudentCustomTopic,
  onDeleteStudentCustomTopic,
  selectedClassId: initialSelectedClassId,
  onSelectClassId,
  isScopedToClass = false,
}) => {
  // Filter student's enrolled classes
  const myClasses = useMemo(() => {
    const matched = subjectClasses.filter((sc) => {
      const isEnrolled = sc.enrolled_student_ids && sc.enrolled_student_ids.includes(currentStudent.id);
      if (isEnrolled) return true;
      const studentGrade = (currentStudent.grade || '').replace(/[^0-9]/g, '');
      const studentLetter = (currentStudent.class_letter || '').trim().toLowerCase();
      const scName = (sc.class_name || '').toLowerCase();
      const scSec = (sc.section || '').trim().toLowerCase();
      if (studentGrade && scName.includes(studentGrade)) {
        if (!studentLetter && !scSec) return true;
        if (scSec && scSec === studentLetter) return true;
        if (studentLetter && scName.includes(`(${studentLetter})`)) return true;
        if (studentLetter && scName.includes(` ${studentLetter}`)) return true;
      }
      return false;
    });

    // Synthesize entries for any enrolled subjects not already present
    const enrolledSubjectsList: string[] = [];
    if (currentStudent.enrolled_subjects && currentStudent.enrolled_subjects.length > 0) {
      currentStudent.enrolled_subjects.forEach((s) => {
        if (s && s.trim()) enrolledSubjectsList.push(s.trim());
      });
    } else if (currentStudent.subject) {
      currentStudent.subject.split(',').forEach((s) => {
        if (s && s.trim()) enrolledSubjectsList.push(s.trim());
      });
    }

    const result = [...matched];
    const gradeLabel = currentStudent.grade ? `Grade ${currentStudent.grade.replace(/[^0-9]/g, '')}` : 'Grade 10';
    const sectionLabel = currentStudent.class_letter ? currentStudent.class_letter.toUpperCase() : '';

    enrolledSubjectsList.forEach((subj) => {
      const subjLower = subj.toLowerCase();
      const exists = result.some(
        (c) =>
          (c.subject || '').toLowerCase() === subjLower ||
          (c.name || '').toLowerCase().includes(subjLower)
      );
      if (!exists) {
        result.push({
          id: `enrolled_subj_${subj.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
          name: `${subj} (${gradeLabel}${sectionLabel ? ' - ' + sectionLabel : ''})`,
          subject: subj,
          class_name: `${gradeLabel}${sectionLabel ? ' ' + sectionLabel : ''}`,
          section: sectionLabel,
          teacher_id: '',
          teacher_name: 'Academic Department',
          enrolled_student_ids: [currentStudent.id],
        });
      }
    });

    return result;
  }, [subjectClasses, currentStudent]);

  // Selected subject/class state
  const [internalClassId, setInternalClassId] = useState<string>(() => {
    if (initialSelectedClassId) return initialSelectedClassId;
    return myClasses.length > 0 ? myClasses[0].id : '';
  });

  const effectiveClassId = isScopedToClass && initialSelectedClassId ? initialSelectedClassId : (internalClassId || (myClasses[0]?.id ?? ''));

  const activeClassObj = useMemo(() => {
    return myClasses.find((c) => c.id === effectiveClassId) || myClasses[0] || null;
  }, [myClasses, effectiveClassId]);

  const [isAddCustomTopicModalOpen, setIsAddCustomTopicModalOpen] = useState(false);

  // Filter syllabus terms for the active class/subject
  const activeClassSyllabus = useMemo(() => {
    if (!activeClassObj) return [];
    const subjectName = (activeClassObj.subject || '').toLowerCase().trim();
    const className = (activeClassObj.name || '').toLowerCase().trim();
    const gradeSection = (activeClassObj.class_name || '').toLowerCase().replace(/grade\s*/gi, '').trim();

    return syllabus.filter((term) => {
      if (term.class_id && term.class_id === activeClassObj.id) return true;
      if (term.subject) {
        const tSub = term.subject.toLowerCase().trim();
        const matchesSub = tSub === subjectName || tSub === className || className.includes(tSub) || (subjectName && subjectName.includes(tSub));
        if (matchesSub) {
          if (!term.class_name) return true;
          const tCn = term.class_name.toLowerCase().replace(/grade\s*/gi, '').trim();
          return !gradeSection || tCn.includes(gradeSection) || gradeSection.includes(tCn);
        }
        return false;
      }
      const tName = term.name.toLowerCase();
      if (subjectName && tName.includes(subjectName)) return true;
      if (className && tName.includes(className)) return true;
      return false;
    });
  }, [syllabus, activeClassObj]);

  // Extract this student's custom topics for this subject
  const currentSubjectCustomTopics = useMemo(() => {
    if (!activeClassObj) return [];
    const sub = (activeClassObj.subject || activeClassObj.name || '').toLowerCase();
    return studentCustomTopics.filter(
      (ct) =>
        ct.student_id === currentStudent.id &&
        (ct.class_id === activeClassObj.id ||
          (ct.subject && sub.includes(ct.subject.toLowerCase())) ||
          (ct.subject && ct.subject.toLowerCase().includes(sub)))
    );
  }, [studentCustomTopics, currentStudent.id, activeClassObj]);

  // Metrics for active class
  const stats = useMemo(() => {
    let tDone = 0;
    let sDone = 0;
    let total = 0;

    activeClassSyllabus.forEach((term) => {
      (term.topics || []).forEach((tp) => {
        total++;
        if (tp.teacher_checked) tDone++;
        if (studentSyllabusProgress[`${currentStudent.id}_${tp.id}`]) sDone++;
      });
    });

    const tPct = total > 0 ? Math.round((tDone / total) * 100) : 0;
    const sPct = total > 0 ? Math.round((sDone / total) * 100) : 0;

    return {
      total,
      teacherDone: tDone,
      studentDone: sDone,
      teacherPct: tPct,
      studentPct: sPct,
    };
  }, [activeClassSyllabus, studentSyllabusProgress, currentStudent.id]);

  return (
    <div>
      {/* 1. SYLLABUS COVERAGE SUMMARY (Exact Teacher Dashboard Layout) */}
      <div className="panel-block" style={{ padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <h4 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>
              {activeClassObj?.subject || 'Curriculum'} Coverage
            </h4>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              Check off topics as you study, revise, and complete coursework.
            </p>
          </div>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setIsAddCustomTopicModalOpen(true)}
            style={{ padding: '6px 14px', fontSize: 12 }}
          >
            + Add Self-Study Topic
          </button>
        </div>

        <div className="progress-track" style={{ height: 8, borderRadius: 4, background: '#EAE8E3' }}>
          <div
            className="progress-fill fill-teacher"
            style={{
              width: `${stats.studentPct}%`,
              height: '100%',
              borderRadius: 4,
              background: '#2D2C2A',
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 6 }}>
          <span>{stats.studentDone} of {stats.total} Topics Completed</span>
          <strong>{stats.studentPct}% Covered (Class Teacher: {stats.teacherPct}% Taught)</strong>
        </div>
      </div>

      {/* 2. TERMS & TOPICS (Exact Teacher Dashboard Layout) */}
      {activeClassSyllabus.length === 0 ? (
        <div style={{ padding: '64px 24px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>
            No syllabus terms published for {activeClassObj?.name || 'this class'} yet.
          </p>
        </div>
      ) : (
        activeClassSyllabus.map((term) => {
          const termTopics = term.topics || [];
          const termDoneCount = termTopics.filter(
            (tp) => !!studentSyllabusProgress[`${currentStudent.id}_${tp.id}`]
          ).length;

          return (
            <div className="panel-block" key={term.id} style={{ marginBottom: 16, padding: '18px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{term.name}</h4>
                <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                  {termDoneCount} of {termTopics.length} Completed
                </span>
              </div>

              <div className="card-list">
                {termTopics.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>No topics in this term.</p>
                ) : (
                  termTopics.map((topic) => {
                    const isStudentChecked = !!studentSyllabusProgress[`${currentStudent.id}_${topic.id}`];
                    const isTeacherChecked = !!topic.teacher_checked;

                    return (
                      <div
                        className="item-card"
                        key={topic.id}
                        style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <input
                            type="checkbox"
                            className="syllabus-checkbox"
                            checked={isStudentChecked}
                            onChange={(e) =>
                              onToggleTopicCheck(term.id, topic.id, 'student', e.target.checked, currentStudent.id)
                            }
                            style={{ accentColor: '#2C6E6A', cursor: 'pointer' }}
                          />
                          <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--neutral-dark)' }}>
                            {topic.title}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {isTeacherChecked && !isStudentChecked ? (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: 4,
                                background: '#FEF3C7',
                                color: '#92400E',
                              }}
                            >
                              Needs Revision
                            </span>
                          ) : isStudentChecked ? (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: 4,
                                background: '#EAF3EF',
                                color: '#2D6E5D',
                              }}
                            >
                              {isTeacherChecked ? 'Covered' : 'Ahead'}
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: 4,
                                background: '#FAF9F6',
                                color: 'var(--text-secondary)',
                              }}
                            >
                              Pending
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })
      )}

      {/* 3. SELF-STUDY & ADDITIONAL TOPICS */}
      {currentSubjectCustomTopics.length > 0 && (
        <div className="panel-block" style={{ marginBottom: 16, padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Self-Study &amp; Additional Topics</h4>
            <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
              {currentSubjectCustomTopics.length} Added
            </span>
          </div>

          <div className="card-list">
            {currentSubjectCustomTopics.map((topic) => (
              <div
                className="item-card"
                key={topic.id}
                style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 11, color: '#7C3AED', fontWeight: 700 }}>★</span>
                  <div>
                    <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--neutral-dark)' }}>{topic.title}</span>
                    {topic.notes && (
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: 2 }}>
                        "{topic.notes}" {topic.covered_at ? `• ${topic.covered_at}` : ''}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: '#F3E8FF',
                      color: '#7C3AED',
                    }}
                  >
                    Self-Study
                  </span>
                  {onDeleteStudentCustomTopic && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Remove custom topic "${topic.title}"?`)) {
                          onDeleteStudentCustomTopic(topic.id, currentStudent.id);
                        }
                      }}
                      style={{
                        padding: '2px 6px',
                        fontSize: 10,
                        fontWeight: 600,
                        border: '1px solid #F5C6CB',
                        borderRadius: 3,
                        background: '#FDF1F0',
                        color: '#A83B38',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title="Delete Topic"
                    >
                      <X size={10} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL TO ADD CUSTOM COVERED TOPIC */}
      <AddStudentCoveredTopicModal
        isOpen={isAddCustomTopicModalOpen}
        studentId={currentStudent.id}
        studentName={currentStudent.name}
        subject={activeClassObj?.subject || activeClassObj?.name || 'Curriculum'}
        classId={activeClassObj?.id}
        terms={activeClassSyllabus}
        onClose={() => setIsAddCustomTopicModalOpen(false)}
        onSubmit={(topicData) => {
          if (onCreateStudentCustomTopic) {
            onCreateStudentCustomTopic(topicData);
          }
        }}
      />
    </div>
  );
};
