'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  UserProfile,
  TestItem,
  AssignmentItem,
  SyllabusTerm,
  Achievement,
  HubActivity,
  SubjectClass,
} from '@/lib/supabaseClient';
import { SubmitAssignmentModal } from '../Modals/SubmitAssignmentModal';
import { ActiveTestModal } from '../Modals/ActiveTestModal';
import { EditAchievementModal } from '../Modals/EditAchievementModal';
import { triggerConfetti, showCelebrationToast } from '@/lib/confetti';
import { CustomSelect } from '@/components/UI/CustomSelect';
import { TestResultRecord } from '../Modals/ReviewTestResultsModal';
import { AssignmentSubmissionRecord } from '../Modals/GradeAssignmentModal';
import { ViewFileModal } from '../Modals/ViewFileModal';

interface StudentDashboardProps {
  currentStudent: UserProfile;
  tests: TestItem[];
  assignments: AssignmentItem[];
  syllabus: SyllabusTerm[];
  achievements: Achievement[];
  attendance: Record<string, Record<string, string>>; // date -> studentId -> status
  hubActivities: HubActivity[];
  subjectClasses: SubjectClass[];
  testResults?: Record<string, TestResultRecord>;
  assignmentSubmissions?: Record<string, AssignmentSubmissionRecord>;
  studentSyllabusProgress?: Record<string, boolean>;
  onSubmitTest: (result: TestResultRecord) => void;
  onSubmitAssignment: (submission: AssignmentSubmissionRecord) => void;
  onToggleTopicCheck: (termId: string, topicId: string, role: 'teacher' | 'student', isChecked: boolean, studentId?: string) => void;
  onAddAchievementClick: () => void;
  onUpdateAchievement: (id: string, title: string, desc: string, fileName?: string, fileDataUrl?: string) => void;
  onDeleteAchievement: (id: string, title: string) => void;
  onToggleHubEnrollment: (activityId: string) => void;
  onOpenVideoModal: (activity: HubActivity) => void;
  onSignOut: () => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  currentStudent,
  tests,
  assignments,
  syllabus,
  achievements,
  attendance,
  hubActivities,
  subjectClasses,
  testResults = {},
  assignmentSubmissions = {},
  studentSyllabusProgress = {},
  onSubmitTest,
  onSubmitAssignment,
  onToggleTopicCheck,
  onAddAchievementClick,
  onUpdateAchievement,
  onDeleteAchievement,
  onToggleHubEnrollment,
  onOpenVideoModal,
  onSignOut,
}) => {
  // Navigation mode: 'class' (viewing a specific subject classroom) or 'global' (main student profile features)
  const [activeNavType, setActiveNavType] = useState<'class' | 'awards' | 'attendance' | 'hub'>('class');
  
  // Tabs inside a subject classroom (ONLY Assessments & Syllabus)
  const [classSubTab, setClassSubTab] = useState<'tasks' | 'syllabus'>('tasks');
  
  const [hubFilter, setHubFilter] = useState('');

  // Viewing uploaded document / certificate preview
  const [viewingFile, setViewingFile] = useState<{
    fileName: string;
    fileUrl?: string;
    studentName?: string;
    title?: string;
    description?: string;
    submissionDate?: string;
  } | null>(null);

  // Student class metadata
  const cleanGrade = useMemo(() => (currentStudent.grade || '10').replace(/[^0-9]/g, '') || '10', [currentStudent.grade]);
  const cleanSection = useMemo(() => (currentStudent.class_letter || 'A').toUpperCase().trim() || 'A', [currentStudent.class_letter]);
  const studentClass = `${cleanGrade}-${cleanSection}`;

  // Dynamic Subject Classrooms this student is enrolled in
  const myClasses = useMemo(() => {
    return subjectClasses.filter((c) => {
      if (c.id.startsWith('class-seed-') || c.name === 'Physics 12-C' || c.name === 'Chemistry 12-C') {
        return false;
      }
      const enrolled = c.enrolled_student_ids || [];
      if (enrolled.includes(currentStudent.id) || (currentStudent.email && enrolled.includes(currentStudent.email))) {
        return true;
      }
      if (enrolled.length === 0 && c.class_name) {
        return c.class_name.includes(studentClass) || c.class_name.includes(`Grade ${cleanGrade}`) || c.class_name === cleanGrade;
      }
      return false;
    });
  }, [subjectClasses, currentStudent.id, currentStudent.email, studentClass, cleanGrade]);

  // Selected active classroom
  const [selectedClassId, setSelectedClassId] = useState<string>('');

  useEffect(() => {
    if (myClasses.length > 0) {
      if (!selectedClassId || !myClasses.find((c) => c.id === selectedClassId)) {
        setSelectedClassId(myClasses[0].id);
      }
    } else {
      setSelectedClassId('');
    }
  }, [myClasses, selectedClassId]);

  const activeClassObj = useMemo(() => {
    return myClasses.find((c) => c.id === selectedClassId) || null;
  }, [myClasses, selectedClassId]);

  // Modals state
  const [activeTestModal, setActiveTestModal] = useState<TestItem | null>(null);
  const [activeSubmitModal, setActiveSubmitModal] = useState<AssignmentItem | null>(null);
  const [editingAchievement, setEditingAchievement] = useState<Achievement | null>(null);

  // Filter tests and assignments for the active subject class ONLY
  const myTests = useMemo(() => {
    if (!activeClassObj) return [];
    return tests.filter((t) => {
      if (!t.class_name || t.class_name === 'All Classes' || t.class_name === 'General') return true;
      return t.class_name.includes(activeClassObj.class_name) || t.class_name.includes(activeClassObj.name) || t.class_name.includes(studentClass);
    });
  }, [tests, activeClassObj, studentClass]);

  const myAssignments = useMemo(() => {
    if (!activeClassObj) return [];
    return assignments.filter((a) => {
      if (!a.class_name || a.class_name === 'All Classes' || a.class_name === 'General') return true;
      return a.class_name.includes(activeClassObj.class_name) || a.class_name.includes(activeClassObj.name) || a.class_name.includes(studentClass);
    });
  }, [assignments, activeClassObj, studentClass]);

  // Syllabus progress for active class
  const subjectSyllabus = useMemo(() => syllabus, [syllabus]);

  const { totalTopics, teacherDone, studentDone, teacherPct, studentPct } = useMemo(() => {
    let tot = 0;
    let tDone = 0;
    let sDone = 0;
    subjectSyllabus.forEach((term) => {
      (term.topics || []).forEach((topic) => {
        tot++;
        if (topic.teacher_checked) tDone++;
        const isStudChecked = studentSyllabusProgress[`${currentStudent.id}_${topic.id}`] || topic.student_checked;
        if (isStudChecked) sDone++;
      });
    });
    const tPct = tot > 0 ? Math.round((tDone / tot) * 100) : 0;
    const sPct = tot > 0 ? Math.round((sDone / tot) * 100) : 0;
    return { totalTopics: tot, teacherDone: tDone, studentDone: sDone, teacherPct: tPct, studentPct: sPct };
  }, [subjectSyllabus, studentSyllabusProgress, currentStudent.id]);

  // Student global school attendance stats
  const attendanceStats = useMemo(() => {
    const dates = Object.keys(attendance).sort().reverse();
    let totalRecorded = 0;
    let presentCount = 0;
    let authAbsentCount = 0;
    let unauthAbsentCount = 0;
    const history: { date: string; status: string }[] = [];

    dates.forEach((d) => {
      const status = (attendance[d] || {})[currentStudent.id];
      if (status) {
        totalRecorded++;
        history.push({ date: d, status });
        if (status === 'present') presentCount++;
        else if (status === 'auth_absent') authAbsentCount++;
        else if (status === 'unauth_absent') unauthAbsentCount++;
      }
    });

    const rate = totalRecorded > 0 ? Math.round((presentCount / totalRecorded) * 100) : 100;
    return { totalRecorded, presentCount, authAbsentCount, unauthAbsentCount, rate, history };
  }, [attendance, currentStudent.id]);

  // Filter hub
  const filteredHub = useMemo(() => {
    if (!hubFilter) return hubActivities;
    return hubActivities.filter((a) => a.type === hubFilter);
  }, [hubActivities, hubFilter]);

  // Filter achievements
  const myAchievements = useMemo(() => {
    return achievements.filter(
      (a) => a.student_id === currentStudent.id || (currentStudent.email && a.student_id === currentStudent.email)
    );
  }, [achievements, currentStudent.id, currentStudent.email]);

  const handleTopicCheck = (termId: string, topicId: string, title: string, isChecked: boolean) => {
    onToggleTopicCheck(termId, topicId, 'student', isChecked, currentStudent.id);
    if (isChecked) {
      showCelebrationToast('Topic Completed', `Mastered "${title}"`, 50);
    }
  };

  const handleAssignmentSubmitSuccess = (assignmentId: string, fileName: string, notes?: string) => {
    onSubmitAssignment({
      assignment_id: assignmentId,
      student_id: currentStudent.id,
      student_name: currentStudent.name,
      file_name: fileName,
      notes: notes || '',
      grade: '',
      feedback: '',
      status: 'submitted',
      submitted_at: new Date().toLocaleDateString(),
    });
    showCelebrationToast('Homework Submitted', `Attached: ${fileName}`, 75);
    triggerConfetti();
  };

  const handleTestSubmitSuccess = (testId: string, answers: Record<string, string>) => {
    // Determine score
    const totalQ = Object.keys(answers).length || 3;
    const score = Math.round((Object.keys(answers).length / 3) * 100) || 85;
    onSubmitTest({
      test_id: testId,
      student_id: currentStudent.id,
      student_name: currentStudent.name,
      score,
      completed_at: new Date().toLocaleDateString(),
    });
    showCelebrationToast('Assessment Completed', `Score: ${score}%`, 100);
    triggerConfetti();
  };

  const handleHubEnroll = (activityId: string, title: string) => {
    onToggleHubEnrollment(activityId);
    triggerConfetti(0.6, 0.4);
    showCelebrationToast('Program Enrolled', title, 40);
  };

  return (
    <div className="app-viewport">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-header" style={{ padding: '24px 20px 16px' }}>
          <div className="sidebar-brand" style={{ marginBottom: 16, textAlign: 'center' }}>
            <img
              src="/Jurf-Logo-1.png"
              alt="Woodlem Park School"
              className="sidebar-logo"
              style={{ maxHeight: 44, width: 'auto', margin: '0 auto', display: 'block' }}
            />
          </div>

          {/* Student Profile Card */}
          <div
            className="profile-card"
            style={{
              background: '#FAF9F6',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <div
              className="profile-avatar avatar-student"
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: '#2C6E6A',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {(currentStudent.name || 'S').charAt(0).toUpperCase()}
            </div>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--neutral-dark)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {currentStudent.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: '#EAF3EF', color: '#2D6E5D', border: '1px solid #C7E4D8' }}>
                  Grade {cleanGrade}-{cleanSection}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                  {currentStudent.admission_number || currentStudent.user_code || ''}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Sections */}
        <nav className="nav-menu" style={{ flex: 1, padding: '10px 12px', overflowY: 'auto' }}>
          {/* 1. STUDENT MAIN / GENERAL PROFILE */}
          <div className="nav-label" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em' }}>
            STUDENT PROFILE &amp; RECORDS
          </div>
          <button
            className={`nav-item ${activeNavType === 'awards' ? 'active' : ''}`}
            onClick={() => setActiveNavType('awards')}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '8px 12px',
              fontSize: 12.5,
              borderRadius: 6,
              marginBottom: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>My Achievements</span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: activeNavType === 'awards' ? '#2C6E6A' : '#EAF3EF', color: activeNavType === 'awards' ? '#FFFFFF' : '#2D6E5D' }}>
              {myAchievements.length}
            </span>
          </button>

          <button
            className={`nav-item ${activeNavType === 'attendance' ? 'active' : ''}`}
            onClick={() => setActiveNavType('attendance')}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '8px 12px',
              fontSize: 12.5,
              borderRadius: 6,
              marginBottom: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>Attendance Record</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: activeNavType === 'attendance' ? '#FFFFFF' : '#2C6E6A' }}>
              {attendanceStats.rate}%
            </span>
          </button>

          <button
            className={`nav-item ${activeNavType === 'hub' ? 'active' : ''}`}
            onClick={() => setActiveNavType('hub')}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '8px 12px',
              fontSize: 12.5,
              borderRadius: 6,
              marginBottom: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>Holistic Hub</span>
          </button>

          {/* 2. SUBJECT CLASSROOMS */}
          <div className="nav-label" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', marginTop: 18 }}>
            MY SUBJECT CLASSROOMS ({myClasses.length})
          </div>

          {myClasses.length === 0 ? (
            <div style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 11.5 }}>
              No classrooms enrolled yet.
            </div>
          ) : (
            myClasses.map((cls) => {
              const isSelected = activeNavType === 'class' && selectedClassId === cls.id;
              return (
                <button
                  key={cls.id}
                  className={`nav-item ${isSelected ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedClassId(cls.id);
                    setActiveNavType('class');
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 12px',
                    fontSize: 12.5,
                    borderRadius: 6,
                    marginBottom: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ overflow: 'hidden', paddingRight: 6 }}>
                    <div style={{ fontWeight: isSelected ? 700 : 600, color: isSelected ? 'var(--neutral-dark)' : 'inherit', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {cls.name}
                    </div>
                    <div style={{ fontSize: 10.5, color: isSelected ? '#2C6E6A' : 'var(--text-secondary)', fontWeight: isSelected ? 500 : 400 }}>
                      Faculty: {cls.teacher_name}
                    </div>
                  </div>
                  {isSelected && (
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2C6E6A', flexShrink: 0 }}></span>
                  )}
                </button>
              );
            })
          )}
        </nav>

        <div className="sidebar-footer" style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color)' }}>
          <button className="logout-btn-clean" onClick={onSignOut}>
            Sign Out
          </button>
        </div>
      </aside>

      {/* MAIN VIEWPORT */}
      <main className="main-content">
        {/* VIEW 1: SUBJECT CLASSROOM VIEW */}
        {activeNavType === 'class' && (
          <>
            <header className="content-header">
              <div className="header-top">
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#2C6E6A', letterSpacing: '0.06em' }}>
                    SUBJECT CLASSROOM · {activeClassObj ? `FACULTY: ${activeClassObj.teacher_name.toUpperCase()}` : `GRADE ${cleanGrade}-${cleanSection}`}
                  </div>
                  <h1 className="page-title" style={{ margin: '2px 0 0' }}>
                    {activeClassObj ? activeClassObj.name : 'No Class Selected'}
                  </h1>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ background: '#FAF9F6', border: '1px solid var(--border-color)', borderRadius: 6, padding: '6px 12px', textAlign: 'right' }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Curriculum</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#2C6E6A' }}>{studentPct}% Covered</div>
                  </div>
                </div>
              </div>

              {/* ONLY SUBJECT CLASS TABS: Assessments & Tasks + Syllabus */}
              <div className="tabs">
                <button
                  className={`tab-btn ${classSubTab === 'tasks' ? 'active' : ''}`}
                  onClick={() => setClassSubTab('tasks')}
                >
                  Assessments &amp; Tasks ({myTests.length + myAssignments.length})
                </button>
                <button
                  className={`tab-btn ${classSubTab === 'syllabus' ? 'active' : ''}`}
                  onClick={() => setClassSubTab('syllabus')}
                >
                  Syllabus Progress ({teacherPct}%)
                </button>
              </div>
            </header>

            <div className="content-body" style={{ padding: '24px 32px' }}>
              {/* SUBTAB 1: ASSESSMENTS & HOMEWORK */}
              {classSubTab === 'tasks' && (
                <div>
                  <h3 className="section-title" style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
                    Active Assessments for {activeClassObj ? activeClassObj.name : 'Class'}
                  </h3>
                  <div className="card-list" style={{ marginBottom: 28 }}>
                    {myTests.length === 0 ? (
                      <div className="panel-block" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                        No assessments currently scheduled for this subject class.
                      </div>
                    ) : (
                      myTests.map((test) => {
                        const result = testResults[`${test.id}_${currentStudent.id}`];
                        const isDone = !!result;
                        return (
                          <div className="item-card" key={test.id} style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div className="item-info">
                              <span className="badge badge-test" style={{ marginBottom: 4, fontSize: 9.5 }}>
                                Assessment · {test.class_name || (activeClassObj ? activeClassObj.name : studentClass)}
                              </span>
                              <h4 style={{ fontSize: 14, margin: '0 0 2px' }}>{test.title}</h4>
                              {result?.feedback && (
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: 2 }}>
                                  Teacher Feedback: &quot;{result.feedback}&quot;
                                </div>
                              )}
                            </div>
                            {isDone ? (
                              <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 4, background: '#EAF3EF', color: '#2D6E5D', border: '1px solid #C7E4D8' }}>
                                Score: {result.score}%
                              </span>
                            ) : (
                              <button
                                className="btn-primary"
                                onClick={() => setActiveTestModal(test)}
                                style={{ padding: '6px 14px', fontSize: 12 }}
                              >
                                Take Assessment
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  <h3 className="section-title" style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
                    Pending Homework &amp; Coursework
                  </h3>
                  <div className="card-list">
                    {myAssignments.length === 0 ? (
                      <div className="panel-block" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                        No pending assignments for this subject class.
                      </div>
                    ) : (
                      myAssignments.map((ass) => {
                        const submission = assignmentSubmissions[`${ass.id}_${currentStudent.id}`];
                        return (
                          <div className="item-card" key={ass.id} style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div className="item-info">
                              <span
                                className="badge badge-test"
                                style={{ background: 'var(--secondary-light)', color: 'var(--secondary)', marginBottom: 4, fontSize: 9.5 }}
                              >
                                Assignment · {ass.class_name || (activeClassObj ? activeClassObj.name : studentClass)}
                              </span>
                              <h4 style={{ fontSize: 14, margin: '0 0 2px' }}>{ass.title}</h4>
                              {submission?.feedback && (
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: 2 }}>
                                  Teacher Feedback: &quot;{submission.feedback}&quot;
                                </div>
                              )}
                            </div>

                            {submission ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 4, background: '#EAF3EF', color: '#2D6E5D', border: '1px solid #C7E4D8' }}>
                                  {submission.grade ? `Graded: ${submission.grade}` : `Submitted: ${submission.file_name || 'Work.pdf'}`}
                                </span>
                                <button
                                  onClick={() => setActiveSubmitModal(ass)}
                                  style={{ padding: '4px 8px', fontSize: 11, fontWeight: 600, background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 4, cursor: 'pointer' }}
                                >
                                  Re-upload
                                </button>
                              </div>
                            ) : (
                              <button
                                className="btn-secondary btn-primary"
                                onClick={() => setActiveSubmitModal(ass)}
                                style={{ padding: '6px 14px', fontSize: 12 }}
                              >
                                Submit Work
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* SUBTAB 2: SYLLABUS PROGRESS (TEACHER CURRICULUM COVERAGE ONLY) */}
              {classSubTab === 'syllabus' && (
                <div>
                  <div className="panel-block" style={{ padding: '20px 24px', marginBottom: 24 }}>
                    <div className="progress-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div>
                        <h4 style={{ fontSize: 13.5, fontWeight: 700, margin: 0, color: 'var(--neutral-dark)' }}>
                          Class Curriculum Coverage
                        </h4>
                        <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                          Official topics and lectures delivered by your teacher
                        </span>
                      </div>
                      <span className="progress-value" style={{ fontSize: 16, fontWeight: 800, color: '#2C6E6A' }}>
                        {teacherPct}%
                      </span>
                    </div>
                    <div className="progress-track" style={{ height: 8, borderRadius: 4, background: '#EAE8E3' }}>
                      <div className="progress-fill fill-teacher" style={{ width: `${teacherPct}%`, height: '100%', borderRadius: 4, background: '#2C6E6A' }}></div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>
                      <span>{teacherDone} of {totalTopics} Topics Completed</span>
                      <span>{totalTopics - teacherDone} Topics Remaining</span>
                    </div>
                  </div>

                  {subjectSyllabus.length === 0 ? (
                    <div className="panel-block" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                      Syllabus topics will appear as your teacher publishes them.
                    </div>
                  ) : (
                    subjectSyllabus.map((term) => (
                      <div className="panel-block" key={term.id} style={{ marginBottom: 16, padding: '18px 20px' }}>
                        <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px' }}>{term.name}</h4>
                        <div className="card-list">
                          {!term.topics || term.topics.length === 0 ? (
                            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>No topics listed in this term.</p>
                          ) : (
                            term.topics.map((topic) => (
                              <div className="item-card" key={topic.id} style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <span
                                    style={{
                                      width: 20,
                                      height: 20,
                                      borderRadius: '50%',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: 11,
                                      fontWeight: 700,
                                      background: topic.teacher_checked ? '#EAF3EF' : '#F4F3F0',
                                      color: topic.teacher_checked ? '#2D6E5D' : '#9E9B95',
                                      border: topic.teacher_checked ? '1px solid #C7E4D8' : '1px solid var(--border-color)',
                                    }}
                                  >
                                    {topic.teacher_checked ? '✓' : '—'}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: 13,
                                      fontWeight: topic.teacher_checked ? 600 : 500,
                                      color: topic.teacher_checked ? 'var(--neutral-dark)' : 'var(--text-secondary)',
                                    }}
                                  >
                                    {topic.title}
                                  </span>
                                </div>
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    padding: '3px 8px',
                                    borderRadius: 4,
                                    background: topic.teacher_checked ? '#EAF3EF' : '#FAF9F6',
                                    color: topic.teacher_checked ? '#2D6E5D' : 'var(--text-secondary)',
                                    border: topic.teacher_checked ? '1px solid #C7E4D8' : '1px solid var(--border-color)',
                                  }}
                                >
                                  {topic.teacher_checked ? 'TAUGHT IN CLASS' : 'PENDING LECTURE'}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* VIEW 2: GLOBAL MY ACHIEVEMENTS */}
        {activeNavType === 'awards' && (
          <>
            <header className="content-header">
              <div className="header-top">
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#2C6E6A', letterSpacing: '0.06em' }}>
                    STUDENT PROFILE
                  </div>
                  <h1 className="page-title" style={{ margin: '2px 0 0' }}>
                    My Awards &amp; Certifications
                  </h1>
                </div>

                <button className="btn-primary" onClick={onAddAchievementClick} style={{ padding: '7px 16px', fontSize: 12 }}>
                  + Add Achievement
                </button>
              </div>
            </header>

            <div className="content-body" style={{ padding: '24px 32px' }}>
              <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FDFCFB' }}>
                  <div>
                    <h4 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>
                      My Awards &amp; Certifications Record ({myAchievements.length} Uploaded)
                    </h4>
                    <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                      Certified achievements submitted to your official school profile and verified by your class teacher.
                    </p>
                  </div>
                  <button className="btn-primary" onClick={onAddAchievementClick} style={{ padding: '6px 14px', fontSize: 12 }}>
                    + Upload New Award
                  </button>
                </div>

                {myAchievements.length === 0 ? (
                  <div className="panel-block" style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 6px', color: 'var(--neutral-dark)' }}>No Achievements Recorded Yet</h3>
                    <p style={{ fontSize: 12.5, maxWidth: 380, margin: '0 auto 16px' }}>
                      Add your academic prizes, olympiad medals, sports certificates, and extracurricular honors.
                    </p>
                    <button className="btn-primary" onClick={onAddAchievementClick} style={{ padding: '8px 18px', fontSize: 12 }}>
                      + Add First Achievement
                    </button>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto', width: '100%' }}>
                    <table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#F8F7F4', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: 10, textTransform: 'uppercase' }}>
                          <th style={{ textAlign: 'left', padding: '10px 16px', width: 40 }}>#</th>
                          <th style={{ textAlign: 'left', padding: '10px 16px', minWidth: 160 }}>Award Title</th>
                          <th style={{ textAlign: 'left', padding: '10px 16px' }}>Description / Citation</th>
                          <th style={{ textAlign: 'left', padding: '10px 16px', width: 180 }}>Certificate Attachment</th>
                          <th style={{ textAlign: 'right', padding: '10px 16px', width: 140 }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {myAchievements.map((aw, idx) => (
                          <tr key={aw.id} style={{ borderBottom: '1px solid #ECEAE5' }}>
                            <td style={{ padding: '10px 16px', color: '#9E9B95', verticalAlign: 'middle' }}>{idx + 1}</td>
                            <td style={{ padding: '10px 16px', fontWeight: 700, color: 'var(--neutral-dark)', verticalAlign: 'middle' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 7px',
                                  borderRadius: 4,
                                  fontSize: 10,
                                  fontWeight: 700,
                                  background: '#FEF7EC',
                                  color: '#9E6C1B',
                                  border: '1px solid #F5DEB3',
                                  marginBottom: 4,
                                }}
                              >
                                Distinction
                              </span>
                              <div>{aw.title}</div>
                            </td>
                            <td style={{ padding: '10px 16px', color: 'var(--text-secondary)', lineHeight: 1.45, fontSize: 12, wordBreak: 'break-word', verticalAlign: 'middle' }}>
                              {aw.description || '—'}
                            </td>
                            <td style={{ padding: '10px 16px', verticalAlign: 'middle' }}>
                              {aw.file_name ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setViewingFile({
                                      fileName: aw.file_name || 'Certificate.pdf',
                                      fileUrl: aw.file_url,
                                      studentName: currentStudent.name,
                                      title: aw.title,
                                      description: aw.description,
                                      submissionDate: aw.created_at ? new Date(aw.created_at).toLocaleDateString() : undefined,
                                    })
                                  }
                                  title={`Click to preview certificate: ${aw.file_name}`}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    maxWidth: 160,
                                    padding: '3px 8px',
                                    borderRadius: 4,
                                    fontSize: 10.5,
                                    fontWeight: 600,
                                    background: '#EAF3EF',
                                    color: '#2D6E5D',
                                    border: '1px solid #C7E4D8',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                  }}
                                >
                                  <span>📄</span>
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {aw.file_name}
                                  </span>
                                  <span style={{ fontSize: 10, opacity: 0.8, marginLeft: 'auto' }}>👁</span>
                                </button>
                              ) : (
                                <span style={{ color: '#CBD5E1', fontSize: 11 }}>No file attached</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'right', padding: '10px 16px', verticalAlign: 'middle' }}>
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                                <button
                                  onClick={() => setEditingAchievement(aw)}
                                  style={{
                                    padding: '4px 10px',
                                    fontSize: 11,
                                    fontWeight: 600,
                                    background: '#FFFFFF',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 4,
                                    cursor: 'pointer',
                                    color: 'var(--neutral-dark)',
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm(`Are you sure you want to delete achievement "${aw.title}"?`)) {
                                      onDeleteAchievement(aw.id, aw.title);
                                    }
                                  }}
                                  style={{
                                    padding: '4px 10px',
                                    fontSize: 11,
                                    fontWeight: 600,
                                    background: '#FDF1F0',
                                    border: '1px solid #F5C6CB',
                                    color: '#A83B38',
                                    borderRadius: 4,
                                    cursor: 'pointer',
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* VIEW 3: GLOBAL ATTENDANCE RECORD */}
        {activeNavType === 'attendance' && (
          <>
            <header className="content-header">
              <div className="header-top">
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#2C6E6A', letterSpacing: '0.06em' }}>
                    ACADEMIC RECORDS
                  </div>
                  <h1 className="page-title" style={{ margin: '2px 0 0' }}>
                    School Attendance History
                  </h1>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Overall Rate</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: attendanceStats.rate >= 85 ? '#2C6E6A' : '#D9534F' }}>
                    {attendanceStats.rate}%
                  </div>
                </div>
              </div>
            </header>

            <div className="content-body" style={{ padding: '24px 32px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 8, padding: '14px 16px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Attendance Rate</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#2C6E6A', marginTop: 4 }}>
                    {attendanceStats.rate}%
                  </div>
                </div>
                <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 8, padding: '14px 16px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Days Present</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--neutral-dark)', marginTop: 4 }}>
                    {attendanceStats.presentCount}
                  </div>
                </div>
                <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 8, padding: '14px 16px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Authorized Leaves</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#D4A373', marginTop: 4 }}>
                    {attendanceStats.authAbsentCount}
                  </div>
                </div>
                <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 8, padding: '14px 16px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Total Sessions</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--neutral-dark)', marginTop: 4 }}>
                    {attendanceStats.totalRecorded}
                  </div>
                </div>
              </div>

              <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>Daily Attendance Audit History</h4>
                </div>
                {attendanceStats.history.length === 0 ? (
                  <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                    No attendance records logged for your profile yet.
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#F8F7F4', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: 10, textTransform: 'uppercase' }}>
                        <th style={{ textAlign: 'left', padding: '8px 14px' }}>Date</th>
                        <th style={{ textAlign: 'left', padding: '8px 14px' }}>Homeroom Section</th>
                        <th style={{ textAlign: 'right', padding: '8px 14px' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendanceStats.history.map((h) => (
                        <tr key={h.date} style={{ borderBottom: '1px solid #ECEAE5' }}>
                          <td style={{ padding: '8px 14px', fontWeight: 600 }}>{h.date}</td>
                          <td style={{ padding: '8px 14px', color: 'var(--text-secondary)' }}>Grade {cleanGrade}-{cleanSection}</td>
                          <td style={{ padding: '8px 14px', textAlign: 'right' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: 4,
                                fontSize: 10,
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                background: h.status === 'present' ? '#EAF3EF' : h.status === 'auth_absent' ? '#FEF7EC' : '#FDF1F0',
                                color: h.status === 'present' ? '#2D6E5D' : h.status === 'auth_absent' ? '#9E6C1B' : '#A83B38',
                              }}
                            >
                              {h.status === 'present' ? 'Present' : h.status === 'auth_absent' ? 'Auth Absent' : 'Unauth Absent'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}

        {/* VIEW 4: GLOBAL HOLISTIC HUB */}
        {activeNavType === 'hub' && (
          <>
            <header className="content-header">
              <div className="header-top">
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#2C6E6A', letterSpacing: '0.06em' }}>
                    CO-CURRICULAR HUB
                  </div>
                  <h1 className="page-title" style={{ margin: '2px 0 0' }}>
                    Holistic Development Programmes
                  </h1>
                </div>

                <div style={{ width: 180 }}>
                  <CustomSelect
                    value={hubFilter}
                    onChange={(val) => setHubFilter(val)}
                    placeholder="All Categories"
                    options={[
                      { value: '', label: 'All Categories' },
                      { value: 'Club Registration', label: 'Clubs' },
                      { value: 'Workshop', label: 'Workshops' },
                      { value: 'Event', label: 'Events' },
                      { value: 'Leadership Programme', label: 'Leadership' },
                      { value: 'Volunteer Opportunity', label: 'Volunteer' },
                    ]}
                  />
                </div>
              </div>
            </header>

            <div className="content-body" style={{ padding: '24px 32px' }}>
              <div className="hub-grid">
                {filteredHub.length === 0 ? (
                  <div className="panel-block" style={{ gridColumn: '1 / -1', padding: '32px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                    No activities available in this category right now.
                  </div>
                ) : (
                  filteredHub.map((act) => {
                    const isEnrolled = (act.enrolled_student_ids || []).includes(currentStudent.id);
                    return (
                      <div className="hub-card" key={act.id} style={{ borderRadius: 10, border: '1px solid var(--border-color)' }}>
                        <div className="hub-card-body" style={{ padding: '16px' }}>
                          <span className="badge badge-hub" style={{ fontSize: 9.5, marginBottom: 6 }}>{act.type}</span>
                          <div className="hub-card-title" style={{ fontSize: 14, fontWeight: 700 }}>{act.title}</div>
                          <div className="hub-card-desc" style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '6px 0' }}>{act.description}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 8 }}>
                            Date: <strong>{act.date}</strong> | Target: {(act.target_grades || []).join(', ') || 'All Grades'}
                          </div>
                        </div>
                        <div className="hub-card-footer" style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)' }}>
                          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                            {(act.enrolled_student_ids || []).length} Enrolled
                          </span>
                          <button
                            onClick={() => handleHubEnroll(act.id, act.title)}
                            style={{
                              padding: '5px 12px',
                              fontSize: 11.5,
                              fontWeight: 600,
                              borderRadius: 5,
                              cursor: 'pointer',
                              background: isEnrolled ? '#EAF3EF' : '#2D2C2A',
                              color: isEnrolled ? '#2D6E5D' : '#FFFFFF',
                              border: isEnrolled ? '1px solid #C7E4D8' : '1px solid #2D2C2A',
                            }}
                          >
                            {isEnrolled ? 'Enrolled' : 'Register / Apply'}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {/* Online Assessment Modal */}
      <ActiveTestModal
        isOpen={!!activeTestModal}
        test={activeTestModal}
        onClose={() => setActiveTestModal(null)}
        onSubmitTest={handleTestSubmitSuccess}
      />

      {/* Submit Assignment Modal */}
      <SubmitAssignmentModal
        isOpen={!!activeSubmitModal}
        assignment={activeSubmitModal}
        onClose={() => setActiveSubmitModal(null)}
        onSubmit={handleAssignmentSubmitSuccess}
      />

      {/* Edit Achievement Modal */}
      <EditAchievementModal
        isOpen={!!editingAchievement}
        achievement={editingAchievement}
        onClose={() => setEditingAchievement(null)}
        onSubmit={onUpdateAchievement}
      />

      {/* View Uploaded File / Certificate Modal */}
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
