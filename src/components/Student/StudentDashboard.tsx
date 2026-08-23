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
  ClassResource,
  ClassBroadcast,
  ResourceType,
} from '@/lib/supabaseClient';
import { SubmitAssignmentModal } from '../Modals/SubmitAssignmentModal';
import { ExamPortalView } from './ExamPortalView';
import { EditAchievementModal } from '../Modals/EditAchievementModal';
import { triggerConfetti, showCelebrationToast } from '@/lib/confetti';
import { CustomSelect } from '@/components/UI/CustomSelect';
import { TestResultRecord } from '../Modals/ReviewTestResultsModal';
import { AssignmentSubmissionRecord } from '../Modals/GradeAssignmentModal';
import { ViewFileModal } from '../Modals/ViewFileModal';
import { SettingsView } from '@/components/Shared/SettingsView';
import { SupportView } from '@/components/Shared/SupportView';
import { usePortalNavigation } from '@/lib/PortalNavigationContext';
import { openFileInNewTab, downloadFile } from '@/lib/fileHelper';
import { ApplyLeaveModal } from '../Modals/ApplyLeaveModal';

interface StudentDashboardProps {
  currentStudent: UserProfile;
  tests: TestItem[];
  assignments: AssignmentItem[];
  syllabus: SyllabusTerm[];
  achievements: Achievement[];
  attendance: Record<string, Record<string, string>>; // date -> studentId -> status
  hubActivities: HubActivity[];
  subjectClasses: SubjectClass[];
  classResources?: ClassResource[];
  classBroadcasts?: ClassBroadcast[];
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
  onApplyLeave?: (data: {
    startDate: string;
    endDate: string;
    reason: string;
    leaveType: string;
    fileName?: string;
    fileUrl?: string;
  }) => void;
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
  classResources = [],
  classBroadcasts = [],
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
  onApplyLeave,
  onSignOut,
}) => {
  // Navigation mode: 'class' | 'homeroom_circulars' | 'awards' | 'attendance' | 'hub' | 'settings' | 'support'
  const [activeNavType, setActiveNavType] = useState<'class' | 'homeroom_circulars' | 'awards' | 'attendance' | 'hub' | 'settings' | 'support'>('class');
  
  // Tabs inside a subject classroom: 'broadcasts' | 'resources' | 'tasks' | 'syllabus'
  const [classSubTab, setClassSubTab] = useState<'broadcasts' | 'resources' | 'tasks' | 'syllabus'>('broadcasts');
  
  const [hubFilter, setHubFilter] = useState('');

  // Resources search & filter
  const [resSearchQuery, setResSearchQuery] = useState('');
  const [resTypeFilter, setResTypeFilter] = useState<'all' | ResourceType>('all');
  const [previewingResource, setPreviewingResource] = useState<ClassResource | null>(null);

  // Viewing uploaded document / certificate preview
  const [viewingFile, setViewingFile] = useState<{
    fileName: string;
    fileUrl?: string;
    studentName?: string;
    title?: string;
    description?: string;
    submissionDate?: string;
  } | null>(null);

  // Leave & Sick Note Modal state
  const [isApplyLeaveOpen, setIsApplyLeaveOpen] = useState(false);

  // Homeroom circulars search & filter state
  const [hrSearchQuery, setHrSearchQuery] = useState('');
  const [hrPriorityFilter, setHrPriorityFilter] = useState<'all' | 'pinned' | 'urgent' | 'important'>('all');

  // Sidebar profile photo (prioritizes Supabase cloud avatar_url)
  const [sidebarAvatarUrl, setSidebarAvatarUrl] = useState<string | null>(() => currentStudent.avatar_url || null);
  useEffect(() => {
    if (currentStudent?.avatar_url) {
      setSidebarAvatarUrl(currentStudent.avatar_url);
    } else {
      try {
        const saved = localStorage.getItem(`woodlem_avatar_${currentStudent.id}`);
        setSidebarAvatarUrl(saved || null);
      } catch (e) {}
    }
  }, [currentStudent, activeNavType]);

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

  // Homeroom class ID for this student (e.g. homeroom-12-B)
  const homeroomClassId = useMemo(() => {
    return `homeroom-${cleanGrade}-${cleanSection}`;
  }, [cleanGrade, cleanSection]);

  // Homeroom Broadcasts & Resources for this student
  const myHomeroomBroadcasts = useMemo(() => {
    return classBroadcasts
      .filter((b) => b.class_id === homeroomClassId)
      .sort((a, b) => {
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime();
      });
  }, [classBroadcasts, homeroomClassId]);

  const myHomeroomResources = useMemo(() => {
    return classResources
      .filter((r) => r.class_id === homeroomClassId)
      .sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime());
  }, [classResources, homeroomClassId]);

  const filteredHomeroomBroadcasts = useMemo(() => {
    return myHomeroomBroadcasts.filter((bc) => {
      if (hrPriorityFilter === 'pinned' && !bc.is_pinned) return false;
      if (hrPriorityFilter === 'urgent' && bc.priority !== 'urgent') return false;
      if (hrPriorityFilter === 'important' && bc.priority !== 'important') return false;
      if (hrSearchQuery.trim()) {
        const q = hrSearchQuery.toLowerCase();
        return bc.title.toLowerCase().includes(q) || bc.content.toLowerCase().includes(q);
      }
      return true;
    });
  }, [myHomeroomBroadcasts, hrPriorityFilter, hrSearchQuery]);

  const filteredHomeroomResources = useMemo(() => {
    return myHomeroomResources.filter((res) => {
      if (hrSearchQuery.trim()) {
        const q = hrSearchQuery.toLowerCase();
        return (
          res.title.toLowerCase().includes(q) ||
          (res.description || '').toLowerCase().includes(q) ||
          (res.topic_tag || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [myHomeroomResources, hrSearchQuery]);

  const [studentHrTab, setStudentHrTab] = useState<'circulars' | 'materials'>('circulars');

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

  // Portal Navigation & AI Copilot Integration
  const { isAiPanelOpen, toggleAiPanel, subscribeToNavigation } = usePortalNavigation();

  useEffect(() => {
    const unsubscribe = subscribeToNavigation((target) => {
      if (target.view === 'awards') {
        setActiveNavType('awards');
      } else if (target.view === 'attendance') {
        setActiveNavType('attendance');
      } else if (target.view === 'hub') {
        setActiveNavType('hub');
      } else if (target.view === 'settings') {
        setActiveNavType('settings');
      } else if (target.view === 'support') {
        setActiveNavType('support');
      } else if (target.view === 'class') {
        setActiveNavType('class');
        if (target.classId && myClasses.some((c) => c.id === target.classId)) {
          setSelectedClassId(target.classId);
        } else if (myClasses.length > 0 && (!selectedClassId || !myClasses.some((c) => c.id === selectedClassId))) {
          setSelectedClassId(myClasses[0].id);
        }
        if (target.subTab && ['broadcasts', 'resources', 'tasks', 'syllabus'].includes(target.subTab)) {
          setClassSubTab(target.subTab as any);
        }
      } else if (target.modalAction === 'add_achievement') {
        onAddAchievementClick();
      }
    });
    return unsubscribe;
  }, [subscribeToNavigation, myClasses, selectedClassId, onAddAchievementClick]);

  // Filter resources & broadcasts for active subject class
  const thisClassResources = useMemo(() => {
    if (!selectedClassId) return [];
    return classResources.filter((r) => r.class_id === selectedClassId);
  }, [classResources, selectedClassId]);

  const thisClassBroadcasts = useMemo(() => {
    if (!selectedClassId) return [];
    return classBroadcasts
      .filter((b) => b.class_id === selectedClassId)
      .sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime();
      });
  }, [classBroadcasts, selectedClassId]);

  const filteredThisClassResources = useMemo(() => {
    return thisClassResources.filter((r) => {
      if (resTypeFilter !== 'all' && r.resource_type !== resTypeFilter) return false;
      if (resSearchQuery.trim()) {
        const q = resSearchQuery.toLowerCase();
        const matchesTitle = r.title.toLowerCase().includes(q);
        const matchesDesc = (r.description || '').toLowerCase().includes(q);
        const matchesTag = (r.topic_tag || '').toLowerCase().includes(q);
        const matchesFile = (r.file_name || '').toLowerCase().includes(q);
        return matchesTitle || matchesDesc || matchesTag || matchesFile;
      }
      return true;
    });
  }, [thisClassResources, resTypeFilter, resSearchQuery]);

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

  const handleApplyLeaveSubmit = (data: {
    startDate: string;
    endDate: string;
    reason: string;
    leaveType: string;
    fileName?: string;
    fileUrl?: string;
  }) => {
    if (onApplyLeave) {
      onApplyLeave(data);
    }
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
                background: sidebarAvatarUrl ? 'transparent' : '#2C6E6A',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: 700,
                flexShrink: 0,
                overflow: 'hidden',
                border: sidebarAvatarUrl ? '2px solid #2C6E6A' : 'none',
              }}
            >
              {sidebarAvatarUrl ? (
                <img src={sidebarAvatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                (currentStudent.name || 'S').charAt(0).toUpperCase()
              )}
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
          {/* AI COPILOT QUICK DOCK TRIGGER */}
          <button
            type="button"
            className={`nav-item ${isAiPanelOpen ? 'active' : ''}`}
            onClick={toggleAiPanel}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '9px 12px',
              fontSize: 13,
              borderRadius: 8,
              marginBottom: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: isAiPanelOpen
                ? 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)'
                : 'linear-gradient(135deg, rgba(84, 87, 254, 0.08) 0%, rgba(155, 81, 224, 0.08) 100%)',
              border: isAiPanelOpen ? '1px solid #334155' : '1px solid rgba(155, 81, 224, 0.25)',
              color: isAiPanelOpen ? '#FFFFFF' : '#4338CA',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: isAiPanelOpen ? '0 4px 12px rgba(15, 23, 42, 0.15)' : 'none',
              transition: 'all 0.18s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2C12 7.52285 7.52285 12 2 12C7.52285 12 12 16.4771 12 22C12 16.4771 16.4771 12 22 12C16.4771 12 12 7.52285 12 2Z"
                  fill={isAiPanelOpen ? '#A78BFA' : 'url(#gemini-nav-icon)'}
                />
                <defs>
                  <linearGradient id="gemini-nav-icon" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#1BA1E3" />
                    <stop offset="0.5" stopColor="#5457FE" />
                    <stop offset="1" stopColor="#9B51E0" />
                  </linearGradient>
                </defs>
              </svg>
              <span>Ask Gemini AI</span>
            </div>
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 4,
                background: isAiPanelOpen ? 'rgba(255, 255, 255, 0.15)' : '#E0E7FF',
                color: isAiPanelOpen ? '#E0E7FF' : '#4338CA',
              }}
            >
              ⌘K
            </span>
          </button>

          {/* 1. STUDENT MAIN / GENERAL PROFILE */}
          <div className="nav-label" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em' }}>
            STUDENT PROFILE &amp; RECORDS
          </div>
          {/* 1.5 HOMEROOM CIRCULARS & NOTICES */}
          <button
            className={`nav-item ${activeNavType === 'homeroom_circulars' ? 'active' : ''}`}
            onClick={() => setActiveNavType('homeroom_circulars')}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>📢 Class Circulars</span>
            </div>
            {(myHomeroomBroadcasts.length + myHomeroomResources.length) > 0 && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: activeNavType === 'homeroom_circulars' ? '#2C6E6A' : '#FEF7EC', color: activeNavType === 'homeroom_circulars' ? '#FFFFFF' : '#9E6C1B' }}>
                {myHomeroomBroadcasts.length + myHomeroomResources.length}
              </span>
            )}
          </button>

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

          <button
            className={`nav-item ${activeNavType === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveNavType('settings')}
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
            <span>Settings &amp; Passwords</span>
          </button>

          <button
            className={`nav-item ${activeNavType === 'support' ? 'active' : ''}`}
            onClick={() => setActiveNavType('support')}
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
            <span>Help &amp; Support</span>
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
              <div className="header-top" style={{ alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: '#EAF3EF', color: '#2D6E5D', border: '1px solid #C7E4D8', textTransform: 'uppercase' }}>
                      {activeClassObj?.subject || 'Class'}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      Faculty: {activeClassObj?.teacher_name || 'Teacher'}
                    </span>
                  </div>
                  <h1 className="page-title" style={{ margin: 0 }}>
                    {activeClassObj ? activeClassObj.name : 'No Class Selected'}
                  </h1>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 6, padding: '6px 14px', textAlign: 'right' }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Curriculum</div>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: '#2C6E6A' }}>{studentPct}% Covered</div>
                  </div>
                </div>
              </div>

              {/* SUBJECT CLASS TABS: Stream, Resources, Assessments, Syllabus */}
              <div className="tabs">
                <button
                  className={`tab-btn ${classSubTab === 'broadcasts' ? 'active' : ''}`}
                  onClick={() => setClassSubTab('broadcasts')}
                >
                  Stream
                  <span className="tab-count">{thisClassBroadcasts.length}</span>
                </button>
                <button
                  className={`tab-btn ${classSubTab === 'resources' ? 'active' : ''}`}
                  onClick={() => setClassSubTab('resources')}
                >
                  Resources
                  <span className="tab-count">{thisClassResources.length}</span>
                </button>
                <button
                  className={`tab-btn ${classSubTab === 'tasks' ? 'active' : ''}`}
                  onClick={() => setClassSubTab('tasks')}
                >
                  Assessments
                  <span className="tab-count">{myTests.length + myAssignments.length}</span>
                </button>
                <button
                  className={`tab-btn ${classSubTab === 'syllabus' ? 'active' : ''}`}
                  onClick={() => setClassSubTab('syllabus')}
                >
                  Syllabus
                  <span className="tab-count">{teacherPct}%</span>
                </button>
              </div>
            </header>

            <div className="content-body" style={{ padding: '24px 32px' }}>
              {/* SUBTAB 1: STREAM & NOTICES (Teacher Announcements & Tagged Materials) */}
              {classSubTab === 'broadcasts' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid var(--border-color)',
                      borderRadius: 8,
                      padding: '16px 20px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 10,
                    }}
                  >
                    <div>
                      <h4 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                        Teacher Announcements &amp; Notice Stream
                      </h4>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                        Live class updates, exam schedules, and study resources from {activeClassObj?.teacher_name || 'Faculty'}.
                      </p>
                    </div>

                    <div style={{ fontSize: 11.5, fontWeight: 700, color: '#2C6E6A', background: '#EAF3EF', padding: '4px 10px', borderRadius: 4 }}>
                      {thisClassBroadcasts.length} Active {thisClassBroadcasts.length === 1 ? 'Notice' : 'Notices'}
                    </div>
                  </div>

                  {thisClassBroadcasts.length === 0 ? (
                    <div className="panel-block" style={{ padding: '36px 20px', textAlign: 'center' }}>
                      <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px', color: 'var(--neutral-dark)' }}>
                        No Class Announcements Yet
                      </h4>
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 auto', maxWidth: 360 }}>
                        Your teacher has not published any broadcasts for this class yet. New notices and study sheets will appear here.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {thisClassBroadcasts.map((bcast) => {
                        const taggedResources = (bcast.tagged_resource_ids || [])
                          .map((id) => classResources.find((r) => r.id === id))
                          .filter(Boolean) as ClassResource[];

                        const borderAccent =
                          bcast.priority === 'urgent'
                            ? '#A83B38'
                            : bcast.priority === 'important'
                            ? '#B86E14'
                            : '#2C6E6A';

                        return (
                          <div
                            key={bcast.id}
                            style={{
                              background: '#FFFFFF',
                              border: '1px solid var(--border-color)',
                              borderLeft: `4px solid ${borderAccent}`,
                              borderRadius: 8,
                              padding: '18px 22px',
                              boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
                            }}
                          >
                            {/* Top Meta Bar */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <div
                                  style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: '50%',
                                    background: '#2C6E6A',
                                    color: '#FFFFFF',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 12,
                                    fontWeight: 700,
                                  }}
                                >
                                  {(bcast.teacher_name || 'T').charAt(0)}
                                </div>
                                <div>
                                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                                    {bcast.teacher_name || 'Teacher'}
                                    <span style={{ fontSize: 10, fontWeight: 600, color: '#2C6E6A', background: '#EAF3EF', padding: '1px 5px', borderRadius: 3, marginLeft: 6 }}>
                                      Faculty
                                    </span>
                                  </div>
                                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                    {bcast.created_at ? new Date(bcast.created_at).toLocaleString() : 'Recent'}
                                  </div>
                                </div>

                                {/* Badges */}
                                {bcast.is_pinned && (
                                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: '#FBF6F0', color: '#B37D4A', border: '1px solid #F0DFCE' }}>
                                    PINNED NOTICE
                                  </span>
                                )}
                                {bcast.priority === 'urgent' && (
                                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: '#FDF1F0', color: '#A83B38', border: '1px solid #F5C6CB' }}>
                                    URGENT
                                  </span>
                                )}
                                {bcast.priority === 'important' && (
                                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: '#FFF8E6', color: '#B86E14', border: '1px solid #FFE0A3' }}>
                                    IMPORTANT
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Title & Content */}
                            <h4 style={{ margin: '4px 0 8px', fontSize: 14.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                              {bcast.title}
                            </h4>
                            <div style={{ fontSize: 13, color: '#3E3D3A', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                              {bcast.content}
                            </div>

                            {/* Tagged Learning Resources */}
                            {taggedResources.length > 0 && (
                              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #EAE8E3' }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 8 }}>
                                  Attached Course Resources ({taggedResources.length})
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                                  {taggedResources.map((res) => {
                                    return (
                                      <div
                                        key={res.id}
                                        style={{
                                          background: '#F8F9FA',
                                          border: '1px solid #E2E4E8',
                                          borderRadius: 6,
                                          padding: '10px 12px',
                                          display: 'flex',
                                          justifyContent: 'space-between',
                                          alignItems: 'center',
                                          gap: 8,
                                        }}
                                      >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                                          <span style={{ fontSize: 9.5, fontWeight: 800, padding: '3px 6px', borderRadius: 4, background: '#2C6E6A', color: '#FFFFFF' }}>
                                            {res.resource_type.toUpperCase()}
                                          </span>
                                          <div style={{ overflow: 'hidden' }}>
                                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--neutral-dark)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                              {res.title}
                                            </div>
                                            <div style={{ fontSize: 10.5, color: 'var(--text-secondary)' }}>
                                              {res.file_size ? `${res.file_size}` : 'Resource'}
                                            </div>
                                          </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: 6 }}>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              openFileInNewTab({
                                                fileName: res.file_name || res.title,
                                                fileUrl: res.file_url,
                                                externalLink: res.external_link,
                                                title: res.title,
                                              });
                                            }}
                                            style={{
                                              padding: '4px 9px',
                                              fontSize: 11,
                                              fontWeight: 700,
                                              background: '#2C6E6A',
                                              color: '#FFFFFF',
                                              border: 'none',
                                              borderRadius: 4,
                                              cursor: 'pointer',
                                              whiteSpace: 'nowrap',
                                            }}
                                          >
                                            Open ↗
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              downloadFile({
                                                fileName: res.file_name || `${res.title}.pdf`,
                                                fileUrl: res.file_url,
                                                externalLink: res.external_link,
                                              });
                                            }}
                                            title="Download"
                                            style={{
                                              padding: '4px 8px',
                                              fontSize: 11,
                                              fontWeight: 700,
                                              background: '#FAF9F6',
                                              color: 'var(--neutral-dark)',
                                              border: '1px solid var(--border-color)',
                                              borderRadius: 4,
                                              cursor: 'pointer',
                                              whiteSpace: 'nowrap',
                                            }}
                                          >
                                            ↓
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* SUBTAB 2: CLASS RESOURCES (Searchable Study Library) */}
              {classSubTab === 'resources' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Search & Type Filter Bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    {/* Search Input */}
                    <div style={{ flex: '1 1 240px', minWidth: 220 }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Search study notes, slides, formula sheets, or topics..."
                        value={resSearchQuery}
                        onChange={(e) => setResSearchQuery(e.target.value)}
                        style={{ width: '100%', fontSize: 12, padding: '7px 12px' }}
                      />
                    </div>

                    {/* Type Filter Pills */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {[
                        { id: 'all', label: `All (${thisClassResources.length})` },
                        { id: 'pdf', label: `PDFs (${thisClassResources.filter((r) => r.resource_type === 'pdf').length})` },
                        { id: 'slides', label: `Slides (${thisClassResources.filter((r) => r.resource_type === 'slides').length})` },
                        { id: 'worksheet', label: `Worksheets (${thisClassResources.filter((r) => r.resource_type === 'worksheet').length})` },
                        { id: 'link', label: `Links (${thisClassResources.filter((r) => r.resource_type === 'link').length})` },
                      ].map((pill) => (
                        <button
                          key={pill.id}
                          type="button"
                          onClick={() => setResTypeFilter(pill.id as any)}
                          style={{
                            padding: '4px 10px',
                            fontSize: 11,
                            fontWeight: 600,
                            borderRadius: 4,
                            border: resTypeFilter === pill.id ? '1px solid #2C6E6A' : '1px solid var(--border-color)',
                            background: resTypeFilter === pill.id ? '#2C6E6A' : '#FFFFFF',
                            color: resTypeFilter === pill.id ? '#FFFFFF' : 'var(--neutral-dark)',
                            cursor: 'pointer',
                          }}
                        >
                          {pill.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Resources Grid */}
                  {filteredThisClassResources.length === 0 ? (
                    <div className="panel-block" style={{ padding: '36px 20px', textAlign: 'center' }}>
                      <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px', color: 'var(--neutral-dark)' }}>
                        No Learning Resources Found
                      </h4>
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 auto', maxWidth: 360 }}>
                        {thisClassResources.length === 0
                          ? 'Your teacher has not uploaded study materials for this class yet.'
                          : 'No resources match your search filter.'}
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                      {filteredThisClassResources.map((res) => {
                        const typeBg =
                          res.resource_type === 'pdf'
                            ? '#FDF1F0'
                            : res.resource_type === 'slides'
                            ? '#FFF8E6'
                            : res.resource_type === 'video'
                            ? '#F3EFFA'
                            : res.resource_type === 'link'
                            ? '#EAF3EF'
                            : '#F0F4F4';

                        const typeColor =
                          res.resource_type === 'pdf'
                            ? '#A83B38'
                            : res.resource_type === 'slides'
                            ? '#B86E14'
                            : res.resource_type === 'video'
                            ? '#6B42A8'
                            : res.resource_type === 'link'
                            ? '#2D6E5D'
                            : '#2C6E6A';

                        return (
                          <div
                            key={res.id}
                            style={{
                              background: '#FFFFFF',
                              border: '1px solid var(--border-color)',
                              borderRadius: 8,
                              padding: '16px',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                            }}
                          >
                            <div>
                              {/* Top Badge & Tag */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 800,
                                    padding: '2px 7px',
                                    borderRadius: 4,
                                    background: typeBg,
                                    color: typeColor,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.04em',
                                  }}
                                >
                                  {res.resource_type}
                                </span>
                                {res.topic_tag && (
                                  <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-secondary)', background: '#F5F4F0', padding: '1px 6px', borderRadius: 3 }}>
                                    {res.topic_tag}
                                  </span>
                                )}
                              </div>

                              {/* Title */}
                              <h4 style={{ margin: '0 0 6px', fontSize: 13.5, fontWeight: 700, color: 'var(--neutral-dark)', lineHeight: 1.3 }}>
                                {res.title}
                              </h4>

                              {/* Description */}
                              {res.description && (
                                <p style={{ margin: '0 0 10px', fontSize: 11.5, color: '#65635E', lineHeight: 1.45 }}>
                                  {res.description}
                                </p>
                              )}

                              {/* File metadata */}
                              <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginBottom: 12 }}>
                                {res.file_name && <span>{res.file_name}</span>}
                                {res.file_size && <span> · {res.file_size}</span>}
                                {res.created_at && <span> · {new Date(res.created_at).toLocaleDateString()}</span>}
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                type="button"
                                onClick={() => {
                                  openFileInNewTab({
                                    fileName: res.file_name || res.title,
                                    fileUrl: res.file_url,
                                    externalLink: res.external_link,
                                    title: res.title,
                                  });
                                }}
                                style={{
                                  padding: '4px 10px',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  background: '#2C6E6A',
                                  color: '#FFFFFF',
                                  border: 'none',
                                  borderRadius: 4,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                Open ↗
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  downloadFile({
                                    fileName: res.file_name || `${res.title}.pdf`,
                                    fileUrl: res.file_url,
                                    externalLink: res.external_link,
                                  });
                                }}
                                title="Download File"
                                style={{
                                  padding: '4px 8px',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  background: '#FAF9F6',
                                  color: 'var(--neutral-dark)',
                                  border: '1px solid var(--border-color)',
                                  borderRadius: 4,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                ↓
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* SUBTAB 3: 📝 ASSESSMENTS & HOMEWORK */}
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

              {/* SUBTAB 4: 📖 SYLLABUS PROGRESS (TEACHER CURRICULUM COVERAGE ONLY) */}
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
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 4, background: '#FEF7EC', color: '#9E6C1B', border: '1px solid #F5DEB3' }}>
                    {myAchievements.length} Distinctions
                  </span>
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
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openFileInNewTab({
                                        fileName: aw.file_name || 'Certificate.pdf',
                                        fileUrl: aw.file_url,
                                        studentName: currentStudent.name,
                                        title: aw.title,
                                        description: aw.description,
                                        submissionDate: aw.created_at ? new Date(aw.created_at).toLocaleDateString() : undefined,
                                      })
                                    }
                                    title={`Click to open certificate in new tab: ${aw.file_name}`}
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
                                    }}
                                  >
                                    <span>↗ Open</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      downloadFile({
                                        fileName: aw.file_name || 'Certificate.pdf',
                                        fileUrl: aw.file_url,
                                        studentName: currentStudent.name,
                                        title: aw.title,
                                        description: aw.description,
                                        submissionDate: aw.created_at ? new Date(aw.created_at).toLocaleDateString() : undefined,
                                      })
                                    }
                                    title="Download Certificate File"
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
              <div className="header-top" style={{ alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#2C6E6A', letterSpacing: '0.06em' }}>
                    ACADEMIC RECORDS · HOMEROOM GRADE {cleanGrade}-{cleanSection}
                  </div>
                  <h1 className="page-title" style={{ margin: '2px 0 0' }}>
                    School Attendance History
                  </h1>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => setIsApplyLeaveOpen(true)}
                    style={{ padding: '7px 16px', fontSize: 12 }}
                  >
                    + Apply for Leave / Sick Note
                  </button>
                  <div style={{ textAlign: 'right', borderLeft: '1px solid var(--border-color)', paddingLeft: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Overall Rate</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: attendanceStats.rate >= 85 ? '#2C6E6A' : '#D9534F' }}>
                      {attendanceStats.rate}%
                    </div>
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

        {/* VIEW 4.5: HOMEROOM CIRCULARS & NOTICES FROM CLASS TEACHER */}
        {activeNavType === 'homeroom_circulars' && (
          <>
            {/* Executive Hero Banner */}
            <header
              style={{
                background: 'linear-gradient(135deg, #1C4D46 0%, #2C6E6A 50%, #3B8C80 100%)',
                color: '#FFFFFF',
                padding: '28px 36px',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 20,
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 800,
                      padding: '3px 9px',
                      borderRadius: 20,
                      background: 'rgba(255,255,255,0.2)',
                      backdropFilter: 'blur(8px)',
                      color: '#FFFFFF',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}
                  >
                    HOMEROOM HUB · GRADE {cleanGrade}-{cleanSection}
                  </span>
                  <span style={{ fontSize: 12, opacity: 0.85 }}>Official Class Channel</span>
                </div>
                <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', color: '#FFFFFF' }}>
                  Class Circulars &amp; Direct Materials
                </h1>
                <p style={{ margin: '6px 0 0', fontSize: 13, opacity: 0.9, maxWidth: 580, lineHeight: 1.4 }}>
                  Official notices, event circulars, weekly timetables, and resource files shared directly by your Homeroom Class Teacher.
                </p>
              </div>

              {/* Quick Stat Chips */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <div
                  style={{
                    background: 'rgba(255,255,255,0.12)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: 8,
                    padding: '10px 16px',
                    minWidth: 100,
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#FFFFFF' }}>{myHomeroomBroadcasts.length}</div>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', opacity: 0.85, fontWeight: 700, marginTop: 2 }}>
                    Notices
                  </div>
                </div>
                <div
                  style={{
                    background: 'rgba(255,255,255,0.12)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: 8,
                    padding: '10px 16px',
                    minWidth: 100,
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#FFFFFF' }}>{myHomeroomResources.length}</div>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', opacity: 0.85, fontWeight: 700, marginTop: 2 }}>
                    Materials
                  </div>
                </div>
              </div>
            </header>

            <div className="content-body" style={{ padding: '24px 36px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Segmented Tab Bar & Controls */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 12,
                  background: '#FFFFFF',
                  padding: '8px 12px',
                  borderRadius: 10,
                  border: '1px solid var(--border-color)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                }}
              >
                {/* Pill Tab Switcher */}
                <div style={{ display: 'flex', gap: 6, background: '#FAF9F6', padding: 4, borderRadius: 8, border: '1px solid #ECEAE5' }}>
                  <button
                    type="button"
                    onClick={() => setStudentHrTab('circulars')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 18px',
                      fontSize: 12.5,
                      fontWeight: studentHrTab === 'circulars' ? 700 : 600,
                      borderRadius: 6,
                      border: 'none',
                      background: studentHrTab === 'circulars' ? '#FFFFFF' : 'transparent',
                      color: studentHrTab === 'circulars' ? '#2C6E6A' : 'var(--text-secondary)',
                      boxShadow: studentHrTab === 'circulars' ? '0 2px 5px rgba(0,0,0,0.08)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <span>📢 Notices &amp; Circulars</span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        padding: '1px 7px',
                        borderRadius: 10,
                        background: studentHrTab === 'circulars' ? '#EAF3EF' : '#ECEAE5',
                        color: studentHrTab === 'circulars' ? '#2D6E5D' : 'var(--text-secondary)',
                      }}
                    >
                      {myHomeroomBroadcasts.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStudentHrTab('materials')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 18px',
                      fontSize: 12.5,
                      fontWeight: studentHrTab === 'materials' ? 700 : 600,
                      borderRadius: 6,
                      border: 'none',
                      background: studentHrTab === 'materials' ? '#FFFFFF' : 'transparent',
                      color: studentHrTab === 'materials' ? '#2C6E6A' : 'var(--text-secondary)',
                      boxShadow: studentHrTab === 'materials' ? '0 2px 5px rgba(0,0,0,0.08)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <span>📚 Class Materials &amp; Timetables</span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        padding: '1px 7px',
                        borderRadius: 10,
                        background: studentHrTab === 'materials' ? '#EAF3EF' : '#ECEAE5',
                        color: studentHrTab === 'materials' ? '#2D6E5D' : 'var(--text-secondary)',
                      }}
                    >
                      {myHomeroomResources.length}
                    </span>
                  </button>
                </div>

                {/* Search input & Filter pills */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {studentHrTab === 'circulars' && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      {(['all', 'pinned', 'urgent', 'important'] as const).map((pri) => (
                        <button
                          key={pri}
                          type="button"
                          onClick={() => setHrPriorityFilter(pri)}
                          style={{
                            padding: '5px 10px',
                            fontSize: 11,
                            fontWeight: hrPriorityFilter === pri ? 700 : 500,
                            borderRadius: 4,
                            border: hrPriorityFilter === pri ? '1px solid #C7E4D8' : '1px solid #ECEAE5',
                            background: hrPriorityFilter === pri ? '#EAF3EF' : '#FAF9F6',
                            color: hrPriorityFilter === pri ? '#2D6E5D' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            textTransform: 'capitalize',
                          }}
                        >
                          {pri === 'all' ? 'All Updates' : pri}
                        </button>
                      ))}
                    </div>
                  )}

                  <input
                    type="text"
                    className="form-input"
                    placeholder={`Search ${studentHrTab === 'circulars' ? 'circulars...' : 'materials...'}`}
                    value={hrSearchQuery}
                    onChange={(e) => setHrSearchQuery(e.target.value)}
                    style={{ padding: '6px 12px', fontSize: 12, width: 200 }}
                  />
                </div>
              </div>

              {/* TAB 1: NOTICES & CIRCULARS */}
              {studentHrTab === 'circulars' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {filteredHomeroomBroadcasts.length === 0 ? (
                    <div
                      style={{
                        padding: '60px 24px',
                        background: '#FFFFFF',
                        border: '1px solid var(--border-color)',
                        borderRadius: 12,
                        textAlign: 'center',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <div
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #EAF3EF 0%, #D8EDE5 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 28,
                          marginBottom: 16,
                          boxShadow: '0 4px 12px rgba(44, 110, 106, 0.12)',
                        }}
                      >
                        📢
                      </div>
                      <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: 'var(--neutral-dark)' }}>
                        {hrSearchQuery || hrPriorityFilter !== 'all'
                          ? 'No matching notices found'
                          : 'All Caught Up on Class Circulars'}
                      </h3>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 460, margin: '8px 0 16px', lineHeight: 1.5 }}>
                        {hrSearchQuery || hrPriorityFilter !== 'all'
                          ? 'Try clearing the search or changing the filter to see all updates.'
                          : `Your Homeroom Class Teacher hasn't posted any circulars for Grade ${cleanGrade}-${cleanSection} today. Official updates and school event guidelines will appear here.`}
                      </p>
                      {(hrSearchQuery || hrPriorityFilter !== 'all') && (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => {
                            setHrSearchQuery('');
                            setHrPriorityFilter('all');
                          }}
                          style={{ padding: '6px 16px', fontSize: 12 }}
                        >
                          Clear Filters
                        </button>
                      )}
                    </div>
                  ) : (
                    filteredHomeroomBroadcasts.map((bc) => {
                      const isPinned = !!bc.is_pinned;
                      const isUrgent = bc.priority === 'urgent';
                      const isImportant = bc.priority === 'important';

                      let accentColor = '#2C6E6A';
                      if (isUrgent) accentColor = '#EF4444';
                      else if (isImportant) accentColor = '#3B82F6';
                      else if (isPinned) accentColor = '#F59E0B';

                      return (
                        <div
                          key={bc.id}
                          style={{
                            background: '#FFFFFF',
                            border: '1px solid var(--border-color)',
                            borderLeft: `5px solid ${accentColor}`,
                            borderRadius: 10,
                            padding: '22px 26px',
                            boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                            transition: 'transform 0.2s, box-shadow 0.2s',
                          }}
                        >
                          {/* Card Top Meta */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div
                                style={{
                                  width: 36,
                                  height: 36,
                                  borderRadius: '50%',
                                  background: '#2C6E6A',
                                  color: '#FFFFFF',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: 14,
                                  fontWeight: 800,
                                }}
                              >
                                👨‍🏫
                              </div>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--neutral-dark)' }}>
                                    {bc.teacher_name || 'Class Teacher'}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: 9.5,
                                      fontWeight: 800,
                                      padding: '1px 6px',
                                      borderRadius: 3,
                                      background: '#EAF3EF',
                                      color: '#2D6E5D',
                                      border: '1px solid #C7E4D8',
                                      textTransform: 'uppercase',
                                    }}
                                  >
                                    Class Teacher · Grade {cleanGrade}-{cleanSection}
                                  </span>
                                </div>
                                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                  {bc.created_at ? new Date(bc.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Recently'}
                                </span>
                              </div>
                            </div>

                            {/* Badges */}
                            <div style={{ display: 'flex', gap: 6 }}>
                              {isPinned && (
                                <span style={{ fontSize: 10.5, fontWeight: 800, padding: '3px 8px', borderRadius: 4, background: '#FEF7EC', color: '#9E6C1B', border: '1px solid #F5DEB3' }}>
                                  📌 PINNED
                                </span>
                              )}
                              {isUrgent && (
                                <span style={{ fontSize: 10.5, fontWeight: 800, padding: '3px 8px', borderRadius: 4, background: '#FDF1F0', color: '#A83B38', border: '1px solid #F5C6CB' }}>
                                  🚨 URGENT
                                </span>
                              )}
                              {isImportant && (
                                <span style={{ fontSize: 10.5, fontWeight: 800, padding: '3px 8px', borderRadius: 4, background: '#EFF6FF', color: '#1E40AF', border: '1px solid #BFDBFE' }}>
                                  ⭐ IMPORTANT
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Title */}
                          <h3 style={{ fontSize: 16.5, fontWeight: 800, margin: '0 0 10px', color: 'var(--neutral-dark)', letterSpacing: '-0.01em' }}>
                            {bc.title}
                          </h3>

                          {/* Content */}
                          <div style={{ fontSize: 13.5, color: '#374151', lineHeight: 1.65, whiteSpace: 'pre-wrap', background: '#FAF9F6', padding: '14px 16px', borderRadius: 8, border: '1px solid #ECEAE5' }}>
                            {bc.content}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* TAB 2: CLASS MATERIALS & TIMETABLES */}
              {studentHrTab === 'materials' && (
                <div>
                  {filteredHomeroomResources.length === 0 ? (
                    <div
                      style={{
                        padding: '60px 24px',
                        background: '#FFFFFF',
                        border: '1px solid var(--border-color)',
                        borderRadius: 12,
                        textAlign: 'center',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <div
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #FEF7EC 0%, #FDEED8 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 28,
                          marginBottom: 16,
                          boxShadow: '0 4px 12px rgba(212, 163, 115, 0.15)',
                        }}
                      >
                        📂
                      </div>
                      <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: 'var(--neutral-dark)' }}>
                        {hrSearchQuery ? 'No matching materials found' : 'No Class Materials Uploaded Yet'}
                      </h3>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 460, margin: '8px 0 16px', lineHeight: 1.5 }}>
                        {hrSearchQuery
                          ? 'Try clearing the search input.'
                          : `Timetables, consent slips, and documents uploaded by your Homeroom Teacher for Grade ${cleanGrade}-${cleanSection} will be accessible here.`}
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                      {filteredHomeroomResources.map((res) => {
                        let typeIcon = '📄';
                        let typeBg = '#EAF3EF';
                        let typeColor = '#2D6E5D';
                        if (res.resource_type === 'pdf') {
                          typeIcon = '📕';
                          typeBg = '#FDF1F0';
                          typeColor = '#A83B38';
                        } else if (res.resource_type === 'slides') {
                          typeIcon = '📊';
                          typeBg = '#FEF7EC';
                          typeColor = '#9E6C1B';
                        } else if (res.resource_type === 'video') {
                          typeIcon = '🎥';
                          typeBg = '#F3EFFA';
                          typeColor = '#7C5CBF';
                        } else if (res.resource_type === 'link') {
                          typeIcon = '🔗';
                          typeBg = '#EFF6FF';
                          typeColor = '#1E40AF';
                        }

                        return (
                          <div
                            key={res.id}
                            style={{
                              background: '#FFFFFF',
                              border: '1px solid var(--border-color)',
                              borderRadius: 10,
                              padding: '18px 20px',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              gap: 14,
                              boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                              transition: 'transform 0.2s, box-shadow 0.2s',
                            }}
                          >
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                <span
                                  style={{
                                    fontSize: 10.5,
                                    fontWeight: 800,
                                    padding: '2px 8px',
                                    borderRadius: 4,
                                    background: typeBg,
                                    color: typeColor,
                                    textTransform: 'uppercase',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                  }}
                                >
                                  <span>{typeIcon}</span>
                                  <span>{res.resource_type}</span>
                                </span>
                                {res.topic_tag && (
                                  <span style={{ fontSize: 10.5, color: '#2C6E6A', fontWeight: 700, background: '#FAF9F6', padding: '2px 6px', borderRadius: 4, border: '1px solid #ECEAE5' }}>
                                    #{res.topic_tag}
                                  </span>
                                )}
                              </div>

                              <h4 style={{ fontSize: 14.5, fontWeight: 800, margin: '0 0 6px', color: 'var(--neutral-dark)', lineHeight: 1.35 }}>
                                {res.title}
                              </h4>
                              {res.description && (
                                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
                                  {res.description}
                                </p>
                              )}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid #ECEAE5' }}>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    openFileInNewTab({
                                      fileName: res.file_name || res.title,
                                      fileUrl: res.file_url,
                                      externalLink: res.external_link,
                                      title: res.title,
                                    });
                                  }}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    padding: '6px 12px',
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                    background: '#2C6E6A',
                                    color: '#FFFFFF',
                                    border: 'none',
                                    borderRadius: 5,
                                    cursor: 'pointer',
                                  }}
                                >
                                  <span>↗ Open</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    downloadFile({
                                      fileName: res.file_name || `${res.title}.pdf`,
                                      fileUrl: res.file_url,
                                      externalLink: res.external_link,
                                    });
                                  }}
                                  title="Download Resource"
                                  style={{
                                    padding: '6px 10px',
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                    background: '#FAF9F6',
                                    color: 'var(--neutral-dark)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 5,
                                    cursor: 'pointer',
                                  }}
                                >
                                  ↓ Download
                                </button>
                              </div>
                              <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>
                                {res.file_size || 'Material'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* VIEW 5: SETTINGS & PASSWORD RESET */}
        {activeNavType === 'settings' && (
          <div style={{ padding: '24px 32px' }}>
            <SettingsView currentUser={currentStudent} />
          </div>
        )}

        {/* VIEW 6: HELP & SUPPORT */}
        {activeNavType === 'support' && (
          <div style={{ padding: '24px 32px' }}>
            <SupportView currentUser={currentStudent} />
          </div>
        )}
      </main>

      {/* Full-Page High-Security Online Examination Portal */}
      {activeTestModal && (
        <ExamPortalView
          test={activeTestModal}
          student={currentStudent}
          onClose={() => setActiveTestModal(null)}
          onSubmitTest={(testId, _answers, score) => {
            onSubmitTest({
              test_id: testId,
              student_id: currentStudent.id,
              student_name: currentStudent.name,
              score,
              completed_at: new Date().toLocaleDateString(),
            });
            showCelebrationToast('Assessment Completed', `Score: ${score}%`, 100);
            triggerConfetti();
          }}
        />
      )}

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

      {/* View Uploaded File / Certificate / Learning Resource Modal */}
      <ViewFileModal
        isOpen={!!viewingFile || !!previewingResource}
        fileName={previewingResource?.file_name || viewingFile?.fileName || ''}
        fileUrl={previewingResource?.file_url || previewingResource?.external_link || viewingFile?.fileUrl}
        studentName={previewingResource?.teacher_name || viewingFile?.studentName}
        title={previewingResource?.title || viewingFile?.title}
        description={previewingResource?.description || viewingFile?.description}
        submissionDate={previewingResource?.created_at ? new Date(previewingResource.created_at).toLocaleDateString() : viewingFile?.submissionDate}
        onClose={() => {
          setViewingFile(null);
          setPreviewingResource(null);
        }}
      />
      {/* Apply for Authorized Leave / Sick Note Modal */}
      <ApplyLeaveModal
        isOpen={isApplyLeaveOpen}
        onClose={() => setIsApplyLeaveOpen(false)}
        onSubmit={handleApplyLeaveSubmit}
        studentName={currentStudent.name}
        studentGrade={`Grade ${cleanGrade}-${cleanSection}`}
      />
    </div>
  );
};
