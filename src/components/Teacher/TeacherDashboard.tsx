'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  UserProfile,
  TestItem,
  AssignmentItem,
  SyllabusTerm,
  Achievement,
  HubActivity,
  AuditLogItem,
  SubjectClass,
} from '@/lib/supabaseClient';
import { CustomSelect } from '@/components/UI/CustomSelect';
import { ManageClassStudentsModal } from '../Modals/ManageClassStudentsModal';
import { ReviewTestResultsModal, TestResultRecord } from '../Modals/ReviewTestResultsModal';
import { GradeAssignmentModal, AssignmentSubmissionRecord } from '../Modals/GradeAssignmentModal';
import { ViewFileModal } from '../Modals/ViewFileModal';
import { EditSubjectClassModal } from '../Modals/EditSubjectClassModal';

interface TeacherDashboardProps {
  currentUser: UserProfile;
  profiles: UserProfile[];
  tests: TestItem[];
  assignments: AssignmentItem[];
  syllabus: SyllabusTerm[];
  achievements: Achievement[];
  attendance: Record<string, Record<string, string>>; // date -> studentId -> status
  hubActivities: HubActivity[];
  auditLogs?: AuditLogItem[];
  subjectClasses: SubjectClass[];
  testResults?: Record<string, TestResultRecord>;
  assignmentSubmissions?: Record<string, AssignmentSubmissionRecord>;
  onOpenCreateClassModal: () => void;
  onUpdateSubjectClass: (
    classId: string,
    updatedData: {
      name: string;
      subject: string;
      class_name: string;
      section: string;
      room: string;
      enrolled_student_ids: string[];
    }
  ) => void;
  onDeleteSubjectClass: (id: string) => void;
  onUpdateClassEnrollment: (classId: string, enrolledStudentIds: string[]) => void;
  onOpenCreateTestModal: (activeClass?: string) => void;
  onDeleteTest: (testId: string) => void;
  onGradeTest: (testId: string, studentId: string, score: number, feedback?: string) => void;
  onOpenCreateAssignmentModal: (activeClass?: string) => void;
  onDeleteAssignment: (assignmentId: string) => void;
  onGradeAssignment: (assignmentId: string, studentId: string, grade: string, feedback?: string) => void;
  onOpenAddTermModal: () => void;
  onDeleteTerm: (termId: string) => void;
  onOpenAddTopicModal: (termId?: string) => void;
  onDeleteTopic: (termId: string, topicId: string) => void;
  onToggleTopicCheck: (termId: string, topicId: string, role: 'teacher' | 'student', isChecked: boolean) => void;
  onSaveAttendance: (date: string, records: Record<string, string>) => void;
  onOpenCreateHubActivityModal: () => void;
  onDeleteHubActivity: (id: string) => void;
  onSignOut: () => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  currentUser,
  profiles,
  tests,
  assignments,
  syllabus,
  achievements,
  attendance,
  hubActivities,
  auditLogs = [],
  subjectClasses,
  testResults = {},
  assignmentSubmissions = {},
  onOpenCreateClassModal,
  onUpdateSubjectClass,
  onDeleteSubjectClass,
  onUpdateClassEnrollment,
  onOpenCreateTestModal,
  onDeleteTest,
  onGradeTest,
  onOpenCreateAssignmentModal,
  onDeleteAssignment,
  onGradeAssignment,
  onOpenAddTermModal,
  onDeleteTerm,
  onOpenAddTopicModal,
  onDeleteTopic,
  onToggleTopicCheck,
  onSaveAttendance,
  onOpenCreateHubActivityModal,
  onDeleteHubActivity,
  onSignOut,
}) => {
  const [isManageStudentsOpen, setIsManageStudentsOpen] = useState(false);
  const [isEditClassModalOpen, setIsEditClassModalOpen] = useState(false);
  const [selectedReviewTest, setSelectedReviewTest] = useState<TestItem | null>(null);
  const [selectedGradeAssignment, setSelectedGradeAssignment] = useState<AssignmentItem | null>(null);
  // Navigation mode: 'class' | 'homeroom_attendance' | 'homeroom_awards' | 'audit' | 'hub'
  const [activeNavMode, setActiveNavMode] = useState<'class' | 'homeroom_attendance' | 'homeroom_awards' | 'audit' | 'hub'>('class');

  // Sub-tabs inside a subject classroom
  const [classSubTab, setClassSubTab] = useState<'tasks' | 'syllabus'>('tasks');

  // Sub-tabs inside Homeroom Attendance: 'mark' (Take Daily Roll Call) vs 'history' (Full Attendance Register & History)
  const [attendanceViewMode, setAttendanceViewMode] = useState<'mark' | 'history'>('history');

  // Inside Full Attendance Register: 'by_date' | 'by_student' | 'matrix'
  const [historyTab, setHistoryTab] = useState<'by_date' | 'by_student' | 'matrix'>('by_date');

  // Selected date for viewing historical session details (controlled by dropdown)
  const [viewingHistoryDate, setViewingHistoryDate] = useState<string>('');

  // Selected student for viewing cumulative details (inline)
  const [viewingHistoryStudentId, setViewingHistoryStudentId] = useState<string>('');

  // Matrix month selection (e.g. "2026-08")
  const [matrixMonth, setMatrixMonth] = useState<string>(() => {
    const today = new Date().toISOString().split('T')[0];
    return today.slice(0, 7);
  });

  // Viewing student certificate / uploaded file preview
  const [viewingAwardFile, setViewingAwardFile] = useState<{
    fileName: string;
    fileUrl?: string;
    studentName?: string;
    title?: string;
    description?: string;
    submissionDate?: string;
  } | null>(null);

  // Filter classrooms taught by this teacher (or all if admin view)
  const teacherClasses = useMemo(() => {
    return subjectClasses.filter(
      (c) =>
        !c.id.startsWith('class-seed-') &&
        c.name !== 'Physics 12-C' &&
        c.name !== 'Chemistry 12-C' &&
        (c.teacher_id === currentUser.id || c.teacher_id === currentUser.email || currentUser.role === 'admin')
    );
  }, [subjectClasses, currentUser.id, currentUser.email, currentUser.role]);

  // Active selected class ID
  const [selectedClassId, setSelectedClassId] = useState<string>('');

  useEffect(() => {
    if (teacherClasses.length > 0) {
      if (!selectedClassId || !teacherClasses.find((c) => c.id === selectedClassId)) {
        setSelectedClassId(teacherClasses[0].id);
      }
    } else {
      setSelectedClassId('');
    }
  }, [teacherClasses, selectedClassId]);

  const activeClassObj = useMemo(() => {
    return teacherClasses.find((c) => c.id === selectedClassId) || null;
  }, [teacherClasses, selectedClassId]);

  // Homeroom class identification
  const homeroomGrade = useMemo(() => (currentUser.grade || '12').replace(/[^0-9]/g, '') || '12', [currentUser.grade]);
  const homeroomSection = useMemo(() => (currentUser.class_letter || 'C').toUpperCase().trim() || 'C', [currentUser.class_letter]);
  const homeroomLabel = `Grade ${homeroomGrade}-${homeroomSection}`;

  // Homeroom students
  const homeroomStudents = useMemo(() => {
    return profiles.filter((p) => {
      if (p.role !== 'student') return false;
      const g = (p.grade || '').replace(/[^0-9]/g, '');
      const s = (p.class_letter || '').toUpperCase().trim();
      return g === homeroomGrade && (!homeroomSection || s === homeroomSection);
    });
  }, [profiles, homeroomGrade, homeroomSection]);

  // Enrolled students for the active selected subject class
  const classStudents = useMemo(() => {
    if (!activeClassObj) return [];
    const enrolledIds = activeClassObj.enrolled_student_ids || [];
    return profiles.filter((p) => {
      if (p.role !== 'student') return false;
      if (enrolledIds.includes(p.id) || (p.email && enrolledIds.includes(p.email))) return true;
      if (enrolledIds.length === 0 && activeClassObj.class_name) {
        const [g, s] = activeClassObj.class_name.split('-');
        const cleanG = (p.grade || '').replace(/[^0-9]/g, '');
        const cleanS = (p.class_letter || '').toUpperCase().trim();
        return cleanG === g && (!s || cleanS === s);
      }
      return false;
    });
  }, [activeClassObj, profiles]);

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [dailyRecords, setDailyRecords] = useState<Record<string, string>>({});
  const [awardSearch, setAwardSearch] = useState('');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('ALL');
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState('');
  const [historyStudentSearch, setHistoryStudentSearch] = useState('');

  // Sync daily attendance records when date changes
  useEffect(() => {
    const existing = attendance[selectedDate] || {};
    const populated: Record<string, string> = {};
    homeroomStudents.forEach((st) => {
      populated[st.id] = existing[st.id] || (st.email && existing[st.email]) || 'present';
    });
    setDailyRecords(populated);
  }, [selectedDate, attendance, homeroomStudents]);

  const handleAttendanceRadio = (studentId: string, value: string) => {
    setDailyRecords((prev) => ({ ...prev, [studentId]: value }));
  };

  const handleMarkAllPresent = () => {
    const updated: Record<string, string> = {};
    homeroomStudents.forEach((st) => {
      updated[st.id] = 'present';
    });
    setDailyRecords(updated);
  };

  const handleSaveAttendanceClick = async () => {
    if (homeroomStudents.length === 0) {
      alert('No students found in homeroom to save.');
      return;
    }
    const toSave: Record<string, string> = {};
    homeroomStudents.forEach((st) => {
      toSave[st.id] = dailyRecords[st.id] || 'present';
    });
    onSaveAttendance(selectedDate, toSave);
    setSaveFeedback(`✓ Attendance for ${selectedDate} saved successfully (${homeroomStudents.length} students).`);
    setTimeout(() => setSaveFeedback(''), 4000);
  };

  // Filter tests and assignments for active class
  const classTests = useMemo(() => {
    if (!activeClassObj) return [];
    return tests.filter((t) => {
      if (!t.class_name || t.class_name === 'All Classes' || t.class_name === 'General') return true;
      return t.class_name.includes(activeClassObj.class_name) || t.class_name.includes(activeClassObj.name);
    });
  }, [tests, activeClassObj]);

  const classAssignments = useMemo(() => {
    if (!activeClassObj) return [];
    return assignments.filter((a) => {
      if (!a.class_name || a.class_name === 'All Classes' || a.class_name === 'General') return true;
      return a.class_name.includes(activeClassObj.class_name) || a.class_name.includes(activeClassObj.name);
    });
  }, [assignments, activeClassObj]);

  // Attendance report generator for Homeroom Today
  let presentCount = 0;
  let authCount = 0;
  let unauthCount = 0;
  const authNames: string[] = [];
  const unauthNames: string[] = [];

  homeroomStudents.forEach((s) => {
    const status = dailyRecords[s.id];
    if (status === 'present') presentCount++;
    else if (status === 'auth_absent') {
      authCount++;
      authNames.push(s.name);
    } else if (status === 'unauth_absent') {
      unauthCount++;
      unauthNames.push(s.name);
    }
  });

  const markedCount = presentCount + authCount + unauthCount;
  const attendanceRate = markedCount > 0 ? Math.round((presentCount / markedCount) * 100) : 0;

  let reportText = `Daily Homeroom Attendance Report — Woodlem Park School\nDate: ${selectedDate}\nHomeroom: ${homeroomLabel}\nClass Teacher: ${currentUser.name}\n\n`;
  reportText += `Total Enrolled: ${homeroomStudents.length}\nMarked Present: ${presentCount} (${attendanceRate}%)\nAuthorized Absences: ${authCount}\nUnauthorized Absences: ${unauthCount}\n`;
  if (authNames.length > 0) {
    reportText += `\nAuthorized Absences:\n` + authNames.map((n) => `- ${n}`).join('\n') + '\n';
  }
  if (unauthNames.length > 0) {
    reportText += `\nUnauthorized Absences (Action Required):\n` + unauthNames.map((n) => `- ${n}`).join('\n') + '\n';
  }

  const copyReport = () => {
    navigator.clipboard.writeText(reportText);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 3000);
  };

  // FULL HISTORICAL ATTENDANCE ANALYTICS FOR HOMEROOM
  const homeroomHistoryAnalytics = useMemo(() => {
    const dates = Object.keys(attendance).sort().reverse();
    const studentStats: Record<string, {
      totalRecorded: number;
      present: number;
      authAbsent: number;
      unauthAbsent: number;
      rate: number;
      datesList: { date: string; status: string }[];
    }> = {};

    homeroomStudents.forEach((st) => {
      studentStats[st.id] = {
        totalRecorded: 0,
        present: 0,
        authAbsent: 0,
        unauthAbsent: 0,
        rate: 100,
        datesList: [],
      };
    });

    dates.forEach((d) => {
      const dayRecords = attendance[d] || {};
      homeroomStudents.forEach((st) => {
        const stat = dayRecords[st.id];
        if (stat) {
          studentStats[st.id].totalRecorded++;
          studentStats[st.id].datesList.push({ date: d, status: stat });
          if (stat === 'present') studentStats[st.id].present++;
          else if (stat === 'auth_absent') studentStats[st.id].authAbsent++;
          else if (stat === 'unauth_absent') studentStats[st.id].unauthAbsent++;
        }
      });
    });

    let cumulativePresent = 0;
    let cumulativeTotal = 0;
    let atRiskCount = 0;

    homeroomStudents.forEach((st) => {
      const data = studentStats[st.id];
      if (data.totalRecorded > 0) {
        data.rate = Math.round((data.present / data.totalRecorded) * 100);
        cumulativePresent += data.present;
        cumulativeTotal += data.totalRecorded;
        if (data.rate < 85) atRiskCount++;
      }
    });

    const averageHomeroomRate = cumulativeTotal > 0 ? Math.round((cumulativePresent / cumulativeTotal) * 100) : 100;

    return {
      recordedDatesCount: dates.length,
      averageHomeroomRate,
      atRiskCount,
      studentStats,
      allDates: dates,
    };
  }, [attendance, homeroomStudents]);

  // DATE-BY-DATE LOG LIST FOR HOMEROOM
  const homeroomDateLogs = useMemo(() => {
    const dates = Object.keys(attendance).sort().reverse();
    return dates.map((d) => {
      const records = attendance[d] || {};
      let pCount = 0;
      let aCount = 0;
      let uCount = 0;

      const studentStatuses: { student: UserProfile; status: string }[] = [];

      homeroomStudents.forEach((st) => {
        const stat = records[st.id] || (st.email && records[st.email]) || 'unrecorded';
        studentStatuses.push({ student: st, status: stat });
        if (stat === 'present') pCount++;
        else if (stat === 'auth_absent') aCount++;
        else if (stat === 'unauth_absent') uCount++;
      });

      const marked = pCount + aCount + uCount;
      const rate = marked > 0 ? Math.round((pCount / marked) * 100) : 0;

      return {
        date: d,
        present: pCount,
        authAbsent: aCount,
        unauthAbsent: uCount,
        markedCount: marked,
        totalStudents: homeroomStudents.length,
        rate,
        studentStatuses,
      };
    });
  }, [attendance, homeroomStudents]);

  // Auto set initial viewingHistoryDate to most recent recorded date if not set
  useEffect(() => {
    if (!viewingHistoryDate && homeroomDateLogs.length > 0) {
      setViewingHistoryDate(homeroomDateLogs[0].date);
    }
  }, [homeroomDateLogs, viewingHistoryDate]);

  // Active viewing date detail object for inline display
  const activeViewingDateObj = useMemo(() => {
    if (!viewingHistoryDate) return null;
    return homeroomDateLogs.find((d) => d.date === viewingHistoryDate) || null;
  }, [homeroomDateLogs, viewingHistoryDate]);

  // Step to previous / next date in date log
  const handleStepDate = (direction: 'prev' | 'next') => {
    const currentIndex = homeroomDateLogs.findIndex((d) => d.date === viewingHistoryDate);
    if (currentIndex === -1) return;
    if (direction === 'prev' && currentIndex < homeroomDateLogs.length - 1) {
      setViewingHistoryDate(homeroomDateLogs[currentIndex + 1].date);
    } else if (direction === 'next' && currentIndex > 0) {
      setViewingHistoryDate(homeroomDateLogs[currentIndex - 1].date);
    }
  };

  // Active viewing student detail object for inline display
  const activeViewingStudentObj = useMemo(() => {
    if (!viewingHistoryStudentId) return null;
    return homeroomStudents.find((s) => s.id === viewingHistoryStudentId) || null;
  }, [homeroomStudents, viewingHistoryStudentId]);

  // Monthly Matrix Calendar Data
  const matrixMonthData = useMemo(() => {
    const [yearStr, monthStr] = matrixMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10); // 1-12
    const daysInMonth = new Date(year, month, 0).getDate();

    const days: { dayNumber: number; dateStr: string; weekday: string; isWeekend: boolean }[] = [];
    const weekdayLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(year, month - 1, day);
      const dayOfWeek = dateObj.getDay();
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      // In UAE schools, Friday afternoon & Saturday / Sunday are weekends
      const isWeekend = dayOfWeek === 6 || dayOfWeek === 0;

      days.push({
        dayNumber: day,
        dateStr,
        weekday: weekdayLabels[dayOfWeek],
        isWeekend,
      });
    }

    // Monthly student stats
    const studentMonthlyStats: Record<string, { present: number; authAbsent: number; unauthAbsent: number; totalMarked: number; rate: number }> = {};
    homeroomStudents.forEach((st) => {
      let p = 0;
      let a = 0;
      let u = 0;
      days.forEach(({ dateStr }) => {
        const stat = (attendance[dateStr] || {})[st.id];
        if (stat === 'present') p++;
        else if (stat === 'auth_absent') a++;
        else if (stat === 'unauth_absent') u++;
      });
      const tot = p + a + u;
      const r = tot > 0 ? Math.round((p / tot) * 100) : 100;
      studentMonthlyStats[st.id] = { present: p, authAbsent: a, unauthAbsent: u, totalMarked: tot, rate: r };
    });

    return { days, studentMonthlyStats };
  }, [matrixMonth, attendance, homeroomStudents]);

  // Filter student history table
  const filteredHomeroomHistoryStudents = useMemo(() => {
    if (!historyStudentSearch.trim()) return homeroomStudents;
    const q = historyStudentSearch.toLowerCase();
    return homeroomStudents.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.admission_number || '').toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q)
    );
  }, [homeroomStudents, historyStudentSearch]);

  // Syllabus progress
  let totalTopics = 0;
  let teacherDone = 0;
  syllabus.forEach((term) => {
    (term.topics || []).forEach((topic) => {
      totalTopics++;
      if (topic.teacher_checked) teacherDone++;
    });
  });
  const overallPct = totalTopics > 0 ? Math.round((teacherDone / totalTopics) * 100) : 0;

  // Filter achievements
  const filteredAwards = achievements.filter((aw) => {
    const student = profiles.find((s) => s.id === aw.student_id);
    const sName = student ? student.name.toLowerCase() : '';
    const term = awardSearch.toLowerCase();
    return aw.title.toLowerCase().includes(term) || sName.includes(term);
  });

  // Filter audit logs
  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      if (auditActionFilter !== 'ALL' && log.action_type !== auditActionFilter) return false;
      if (auditSearch.trim()) {
        const q = auditSearch.toLowerCase();
        const mName = (log.user_name || '').toLowerCase().includes(q);
        const mTitle = (log.target_title || '').toLowerCase().includes(q);
        const mDetails = (log.details || '').toLowerCase().includes(q);
        return mName || mTitle || mDetails;
      }
      return true;
    });
  }, [auditLogs, auditActionFilter, auditSearch]);

  const renderActionBadge = (actionType: string) => {
    switch (actionType) {
      case 'CREATE_ACHIEVEMENT':
        return (
          <span style={{ padding: '2px 6px', borderRadius: 4, background: '#EAF3EF', color: '#2D6E5D', fontSize: 10, fontWeight: 700, border: '1px solid #C7E4D8' }}>
            CREATED
          </span>
        );
      case 'EDIT_ACHIEVEMENT':
        return (
          <span style={{ padding: '2px 6px', borderRadius: 4, background: '#FEF7EC', color: '#9E6C1B', fontSize: 10, fontWeight: 700, border: '1px solid #F5DEB3' }}>
            MODIFIED
          </span>
        );
      case 'DELETE_ACHIEVEMENT':
        return (
          <span style={{ padding: '2px 6px', borderRadius: 4, background: '#FDF1F0', color: '#A83B38', fontSize: 10, fontWeight: 700, border: '1px solid #F5C6CB' }}>
            DELETED
          </span>
        );
      case 'SUBMIT_ASSIGNMENT':
        return (
          <span style={{ padding: '2px 6px', borderRadius: 4, background: '#F0EBF7', color: '#6A3FB5', fontSize: 10, fontWeight: 700, border: '1px solid #D8CAEB' }}>
            SUBMISSION
          </span>
        );
      default:
        return (
          <span style={{ padding: '2px 6px', borderRadius: 4, background: '#FAF9F6', color: 'var(--text-secondary)', fontSize: 10, fontWeight: 700, border: '1px solid var(--border-color)' }}>
            {actionType}
          </span>
        );
    }
  };

  return (
    <div className="app-viewport">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-header" style={{ padding: '24px 20px 16px' }}>
          <div className="sidebar-brand" style={{ marginBottom: 16, textAlign: 'center' }}>
            <img
              src="/Jurf-Logo-1.png"
              alt="Woodlem Park"
              className="sidebar-logo"
              style={{ maxHeight: 44, width: 'auto', margin: '0 auto', display: 'block' }}
            />
          </div>

          {/* Teacher Profile Card */}
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
              className="profile-avatar avatar-teacher"
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: '#2D2C2A',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {(currentUser.name || 'T').charAt(0).toUpperCase()}
            </div>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--neutral-dark)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {currentUser.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                {currentUser.subject || 'Faculty'} · {homeroomLabel} [CT]
              </div>
            </div>
          </div>
        </div>

        <nav className="nav-menu" style={{ flex: 1, padding: '10px 12px', overflowY: 'auto' }}>
          {/* 1. HOMEROOM / CLASS TEACHER SECTION */}
          <div className="nav-label" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em' }}>
            HOMEROOM / CLASS TEACHER
          </div>
          <button
            className={`nav-item ${activeNavMode === 'homeroom_attendance' ? 'active' : ''}`}
            onClick={() => setActiveNavMode('homeroom_attendance')}
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
            <span>Attendance &amp; Records</span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: '#EAF3EF', color: '#2D6E5D' }}>
              {homeroomLabel}
            </span>
          </button>

          <button
            className={`nav-item ${activeNavMode === 'homeroom_awards' ? 'active' : ''}`}
            onClick={() => setActiveNavMode('homeroom_awards')}
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
            <span>Student Achievements</span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: '#FAF9F6', color: 'var(--text-secondary)' }}>
              {achievements.length}
            </span>
          </button>

          {/* 2. SUBJECT CLASSROOMS */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 4px 6px' }}>
            <span className="nav-label" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', margin: 0 }}>
              MY SUBJECT CLASSROOMS ({teacherClasses.length})
            </span>
            <button
              onClick={onOpenCreateClassModal}
              style={{
                padding: '2px 8px',
                fontSize: 11,
                fontWeight: 700,
                background: '#2C6E6A',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
              }}
              title="Create new subject class"
            >
              + Create
            </button>
          </div>

          {teacherClasses.length === 0 ? (
            <div style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 11.5 }}>
              No subject classrooms created yet.
            </div>
          ) : (
            teacherClasses.map((cls) => {
              const isSelected = activeNavMode === 'class' && selectedClassId === cls.id;
              const count = (cls.enrolled_student_ids || []).length;
              return (
                <button
                  key={cls.id}
                  className={`nav-item ${isSelected ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedClassId(cls.id);
                    setActiveNavMode('class');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    fontSize: 12.5,
                    borderRadius: 6,
                    marginBottom: 2,
                    width: '100%',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ overflow: 'hidden', paddingRight: 6 }}>
                    <div style={{ fontWeight: isSelected ? 700 : 600, color: isSelected ? 'var(--neutral-dark)' : 'inherit', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {cls.name}
                    </div>
                    <div style={{ fontSize: 10.5, color: isSelected ? '#2C6E6A' : 'var(--text-secondary)', fontWeight: isSelected ? 500 : 400 }}>
                      {cls.class_name} {cls.room ? `· ${cls.room}` : ''}
                    </div>
                  </div>
                  <span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: isSelected ? '#2C6E6A' : '#FAF9F6', color: isSelected ? '#FFFFFF' : 'var(--text-secondary)' }}>
                    {count}
                  </span>
                </button>
              );
            })
          )}

          {/* 3. GOVERNANCE & HUB */}
          <div className="nav-label" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', marginTop: 16 }}>
            GOVERNANCE &amp; HUB
          </div>
          <button
            className={`nav-item ${activeNavMode === 'audit' ? 'active' : ''}`}
            onClick={() => setActiveNavMode('audit')}
            style={{ padding: '8px 12px', fontSize: 12.5, borderRadius: 6, marginBottom: 2 }}
          >
            Activity &amp; Audit Log ({auditLogs.length})
          </button>
          <button
            className={`nav-item ${activeNavMode === 'hub' ? 'active' : ''}`}
            onClick={() => setActiveNavMode('hub')}
            style={{ padding: '8px 12px', fontSize: 12.5, borderRadius: 6 }}
          >
            Holistic Hub Programs
          </button>
        </nav>

        <div className="sidebar-footer" style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color)' }}>
          <button className="logout-btn-clean" onClick={onSignOut}>
            Sign Out
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT VIEWPORT */}
      <main className="main-content">
        {/* VIEW 1: SUBJECT CLASSROOM VIEW */}
        {activeNavMode === 'class' && (
          <>
            <header className="content-header">
              <div className="header-top">
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#2C6E6A', letterSpacing: '0.06em' }}>
                    SUBJECT CLASSROOM · {currentUser.subject || 'FACULTY'}
                  </div>
                  <h1 className="page-title" style={{ margin: '2px 0 0' }}>
                    {activeClassObj ? activeClassObj.name : 'No Class Selected'}
                  </h1>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    className="btn-secondary"
                    onClick={onOpenCreateClassModal}
                    style={{ padding: '7px 12px', fontSize: 12 }}
                  >
                    + New Class
                  </button>
                  {activeClassObj && (
                    <button
                      className="btn-primary"
                      onClick={() => onOpenCreateAssignmentModal(`${activeClassObj.name} (${activeClassObj.class_name})`)}
                      style={{ padding: '7px 16px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <span>+</span> Create Assignment
                    </button>
                  )}
                </div>
              </div>

              {/* ONLY SUBJECT CLASS TABS: Classroom & Tasks + Syllabus */}
              <div className="tabs">
                <button
                  className={`tab-btn ${classSubTab === 'tasks' ? 'active' : ''}`}
                  onClick={() => setClassSubTab('tasks')}
                >
                  Classroom &amp; Tasks ({classTests.length + classAssignments.length})
                </button>
                <button
                  className={`tab-btn ${classSubTab === 'syllabus' ? 'active' : ''}`}
                  onClick={() => setClassSubTab('syllabus')}
                >
                  Syllabus Coverage ({overallPct}%)
                </button>
              </div>
            </header>

            <div className="content-body" style={{ padding: '24px 32px' }}>
              {!activeClassObj ? (
                <div className="panel-block" style={{ padding: '48px 24px', textAlign: 'center' }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 6px' }}>No Subject Class Selected</h3>
                  <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', maxWidth: 400, margin: '0 auto 16px' }}>
                    Create your subject classroom to enroll students and publish assignments.
                  </p>
                  <button className="btn-primary" onClick={onOpenCreateClassModal} style={{ padding: '8px 20px', fontSize: 12.5 }}>
                    + Create Subject Class
                  </button>
                </div>
              ) : (
                <>
                  {classSubTab === 'tasks' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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
                          gap: 12,
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: '#EAF3EF', color: '#2D6E5D', border: '1px solid #C7E4D8', textTransform: 'uppercase' }}>
                              {activeClassObj.subject || 'Subject'}
                            </span>
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                              Target: {activeClassObj.class_name} {activeClassObj.room ? `| ${activeClassObj.room}` : ''}
                            </span>
                          </div>
                          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '4px 0 0', color: 'var(--neutral-dark)' }}>
                            {activeClassObj.name}
                          </h3>
                        </div>

                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <button
                            onClick={() => setIsEditClassModalOpen(true)}
                            className="btn-secondary"
                            style={{ padding: '6px 12px', fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 4 }}
                            title="Edit class name, subject, grade, or room"
                          >
                            <span>✏️</span> Edit Class
                          </button>
                          <button
                            onClick={() => setIsManageStudentsOpen(true)}
                            className="btn-secondary"
                            style={{ padding: '6px 12px', fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 4 }}
                            title="Enroll or remove students"
                          >
                            <span>👥</span> Manage Students
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete subject class "${activeClassObj.name}"?`)) {
                                onDeleteSubjectClass(activeClassObj.id);
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
                            Delete Class
                          </button>
                        </div>
                      </div>

                      {/* Class Stats */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                        <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 8, padding: '12px 16px' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                            Enrolled Students
                          </div>
                          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--neutral-dark)', marginTop: 4 }}>
                            {classStudents.length}
                          </div>
                        </div>

                        <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 8, padding: '12px 16px' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                            Active Assessments
                          </div>
                          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--neutral-dark)', marginTop: 4 }}>
                            {classTests.length}
                          </div>
                        </div>

                        <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 8, padding: '12px 16px' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                            Assignments
                          </div>
                          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--neutral-dark)', marginTop: 4 }}>
                            {classAssignments.length}
                          </div>
                        </div>
                      </div>

                      {/* Assessments & Tasks */}
                      <div>
                        <h3 className="section-title" style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
                          Assessments &amp; Homework for {activeClassObj.name}
                        </h3>
                        <div className="card-list">
                          {classTests.length === 0 && classAssignments.length === 0 ? (
                            <div className="panel-block" style={{ padding: '24px', textAlign: 'center' }}>
                              <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>
                                No assessments or assignments currently published for this class.
                              </p>
                            </div>
                          ) : (
                            <>
                              {classTests.map((test) => {
                                const completedCount = classStudents.filter((st) => testResults[`${test.id}_${st.id}`]).length;
                                return (
                                  <div className="item-card" key={test.id} style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div className="item-info">
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                        <span className="badge badge-test" style={{ fontSize: 9.5, margin: 0 }}>
                                          Assessment · {test.class_name || activeClassObj.class_name}
                                        </span>
                                        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 3, background: '#EAF3EF', color: '#2D6E5D', border: '1px solid #C7E4D8' }}>
                                          {completedCount} of {classStudents.length} Completed
                                        </span>
                                      </div>
                                      <h4 style={{ fontSize: 14, margin: 0 }}>{test.title}</h4>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                      <button
                                        type="button"
                                        onClick={() => setSelectedReviewTest(test)}
                                        className="btn-secondary btn-primary"
                                        style={{ padding: '6px 14px', fontSize: 12 }}
                                      >
                                        Review Results ({completedCount})
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (confirm(`Are you sure you want to delete assessment "${test.title}"?`)) {
                                            onDeleteTest(test.id);
                                          }
                                        }}
                                        style={{
                                          padding: '5px 8px',
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
                                  </div>
                                );
                              })}

                              {classAssignments.map((ass) => {
                                const submittedCount = classStudents.filter((st) => assignmentSubmissions[`${ass.id}_${st.id}`]).length;
                                const gradedCount = classStudents.filter((st) => assignmentSubmissions[`${ass.id}_${st.id}`]?.grade).length;
                                return (
                                  <div className="item-card" key={ass.id} style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div className="item-info">
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                        <span
                                          className="badge badge-test"
                                          style={{ background: 'var(--secondary-light)', color: 'var(--secondary)', fontSize: 9.5, margin: 0 }}
                                        >
                                          Assignment · {ass.class_name || activeClassObj.class_name}
                                        </span>
                                        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 3, background: '#FAF9F6', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
                                          {submittedCount} / {classStudents.length} Submitted {gradedCount > 0 ? `· ${gradedCount} Graded` : ''}
                                        </span>
                                      </div>
                                      <h4 style={{ fontSize: 14, margin: 0 }}>{ass.title}</h4>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                      <button
                                        type="button"
                                        onClick={() => setSelectedGradeAssignment(ass)}
                                        className="btn-secondary btn-primary"
                                        style={{ padding: '6px 14px', fontSize: 12 }}
                                      >
                                        Grade Submissions ({submittedCount})
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (confirm(`Are you sure you want to delete assignment "${ass.title}"?`)) {
                                            onDeleteAssignment(ass.id);
                                          }
                                        }}
                                        style={{
                                          padding: '5px 8px',
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
                                  </div>
                                );
                              })}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Enrolled Roster */}
                      <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
                        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FDFCFB' }}>
                          <div>
                            <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              Enrolled Student Roster ({classStudents.length} Students)
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 8 }}>
                              {activeClassObj.name}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsManageStudentsOpen(true)}
                            style={{
                              padding: '5px 12px',
                              fontSize: 11.5,
                              fontWeight: 700,
                              background: '#2C6E6A',
                              color: '#FFFFFF',
                              border: 'none',
                              borderRadius: 4,
                              cursor: 'pointer',
                            }}
                          >
                            + Add / Manage Students
                          </button>
                        </div>

                        {classStudents.length === 0 ? (
                          <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                            <p style={{ margin: '0 0 10px' }}>No students currently enrolled in this classroom.</p>
                            <button
                              type="button"
                              onClick={() => setIsManageStudentsOpen(true)}
                              className="btn-primary"
                              style={{ padding: '6px 14px', fontSize: 12 }}
                            >
                              + Enroll Students Now
                            </button>
                          </div>
                        ) : (
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                              <tr style={{ background: '#F8F7F4', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: 10, textTransform: 'uppercase' }}>
                                <th style={{ textAlign: 'left', padding: '8px 12px', width: 36 }}>#</th>
                                <th style={{ textAlign: 'left', padding: '8px 12px' }}>Student Name</th>
                                <th style={{ textAlign: 'left', padding: '8px 12px' }}>Admission No.</th>
                                <th style={{ textAlign: 'left', padding: '8px 12px' }}>Grade / Section</th>
                                <th style={{ textAlign: 'left', padding: '8px 12px' }}>Email Address</th>
                                <th style={{ textAlign: 'right', padding: '8px 12px', width: 90 }}>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {classStudents.map((st, idx) => {
                                const g = (st.grade || '').replace(/[^0-9]/g, '');
                                const s = (st.class_letter || '').toUpperCase().trim();
                                return (
                                  <tr key={st.id} style={{ borderBottom: '1px solid #ECEAE5' }}>
                                    <td style={{ padding: '8px 12px', color: '#9E9B95' }}>{idx + 1}</td>
                                    <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--neutral-dark)' }}>{st.name}</td>
                                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11 }}>{st.admission_number || st.user_code || '—'}</td>
                                    <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>Grade {g}-{s}</td>
                                    <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{st.email}</td>
                                    <td style={{ textAlign: 'right', padding: '8px 12px' }}>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (confirm(`Remove "${st.name}" from ${activeClassObj.name}?`)) {
                                            const currentIds = activeClassObj.enrolled_student_ids || [];
                                            const updated = currentIds.filter((id) => id !== st.id && id !== st.email);
                                            onUpdateClassEnrollment(activeClassObj.id, updated);
                                          }
                                        }}
                                        style={{
                                          padding: '2px 7px',
                                          fontSize: 10.5,
                                          fontWeight: 600,
                                          background: '#FDF1F0',
                                          border: '1px solid #F5C6CB',
                                          color: '#A83B38',
                                          borderRadius: 4,
                                          cursor: 'pointer',
                                        }}
                                      >
                                        Remove
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                  )}

                  {classSubTab === 'syllabus' && (
                    <div>
                      <div className="panel-block" style={{ padding: '20px 24px', marginBottom: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <div>
                            <h4 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>
                              {currentUser.subject || 'Faculty'} Curriculum Coverage
                            </h4>
                            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                              Check off topics as you deliver lectures and assignments in class.
                            </p>
                          </div>
                          <button className="btn-primary" onClick={onOpenAddTermModal} style={{ padding: '6px 14px', fontSize: 12 }}>
                            + Add New Term
                          </button>
                        </div>

                        <div className="progress-track" style={{ height: 8, borderRadius: 4, background: '#EAE8E3' }}>
                          <div className="progress-fill fill-teacher" style={{ width: `${overallPct}%`, height: '100%', borderRadius: 4, background: '#2D2C2A' }}></div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 6 }}>
                          <span>{teacherDone} of {totalTopics} Topics Completed</span>
                          <strong>{overallPct}% Taught</strong>
                        </div>
                      </div>

                      {syllabus.length === 0 ? (
                        <div className="panel-block" style={{ padding: '32px', textAlign: 'center' }}>
                          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 12 }}>
                            No syllabus terms published yet.
                          </p>
                          <button className="btn-primary" onClick={onOpenAddTermModal} style={{ padding: '8px 16px', fontSize: 12 }}>
                            + Create First Term
                          </button>
                        </div>
                      ) : (
                        syllabus.map((term) => (
                          <div className="panel-block" key={term.id} style={{ marginBottom: 16, padding: '18px 20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                              <h4 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{term.name}</h4>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => onOpenAddTopicModal(term.id)}
                                  style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, border: '1px solid var(--border-color)', borderRadius: 4, background: '#FFFFFF', cursor: 'pointer' }}
                                >
                                  + Add Topic
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm(`Delete syllabus term "${term.name}" and all its topics?`)) {
                                      onDeleteTerm(term.id);
                                    }
                                  }}
                                  style={{ padding: '4px 8px', fontSize: 11, fontWeight: 600, border: '1px solid #F5C6CB', borderRadius: 4, background: '#FDF1F0', color: '#A83B38', cursor: 'pointer' }}
                                >
                                  Delete Term
                                </button>
                              </div>
                            </div>

                            <div className="card-list">
                              {!term.topics || term.topics.length === 0 ? (
                                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>No topics in this term.</p>
                              ) : (
                                term.topics.map((topic) => (
                                  <div className="item-card" key={topic.id} style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                      <input
                                        type="checkbox"
                                        className="syllabus-checkbox"
                                        checked={topic.teacher_checked}
                                        onChange={(e) => onToggleTopicCheck(term.id, topic.id, 'teacher', e.target.checked)}
                                        style={{ accentColor: '#2C6E6A', cursor: 'pointer' }}
                                      />
                                      <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--neutral-dark)' }}>{topic.title}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: topic.teacher_checked ? '#EAF3EF' : '#FAF9F6', color: topic.teacher_checked ? '#2D6E5D' : 'var(--text-secondary)' }}>
                                        {topic.teacher_checked ? 'TAUGHT' : 'PENDING'}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (confirm(`Delete topic "${topic.title}"?`)) {
                                            onDeleteTopic(term.id, topic.id);
                                          }
                                        }}
                                        style={{ padding: '2px 6px', fontSize: 10, fontWeight: 600, border: '1px solid #F5C6CB', borderRadius: 3, background: '#FDF1F0', color: '#A83B38', cursor: 'pointer' }}
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {/* VIEW 2: HOMEROOM ATTENDANCE & ROLL CALL (WITH FULL ATTENDANCE REGISTER & HISTORY) */}
        {activeNavMode === 'homeroom_attendance' && (
          <>
            <header className="content-header">
              <div className="header-top">
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#2C6E6A', letterSpacing: '0.06em' }}>
                    HOMEROOM CLASS TEACHER REGISTER · {homeroomLabel}
                  </div>
                  <h1 className="page-title" style={{ margin: '2px 0 0' }}>
                    Attendance Roll Call &amp; Records
                  </h1>
                </div>

                {attendanceViewMode === 'mark' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="date"
                      className="form-input"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      style={{ width: 150, padding: '6px 10px', fontSize: 12 }}
                    />
                    <button
                      onClick={handleMarkAllPresent}
                      style={{
                        padding: '6px 12px',
                        fontSize: 11.5,
                        fontWeight: 600,
                        background: '#EBF3F2',
                        color: '#2C6E6A',
                        border: '1px solid #CBE2DF',
                        borderRadius: 6,
                        cursor: 'pointer',
                      }}
                    >
                      Mark All Present
                    </button>
                    <button
                      onClick={handleSaveAttendanceClick}
                      style={{
                        padding: '6px 14px',
                        fontSize: 11.5,
                        fontWeight: 600,
                        background: '#2D2C2A',
                        color: '#FFFFFF',
                        border: '1px solid #2D2C2A',
                        borderRadius: 6,
                        cursor: 'pointer',
                      }}
                    >
                      Save Attendance
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="text"
                      placeholder="Search student in records..."
                      className="form-input"
                      style={{ width: 220, padding: '6px 10px', fontSize: 12 }}
                      value={historyStudentSearch}
                      onChange={(e) => setHistoryStudentSearch(e.target.value)}
                    />
                  </div>
                )}
              </div>

              {/* Subtabs to toggle between Taking Roll Call and Viewing Full History */}
              <div className="tabs">
                <button
                  className={`tab-btn ${attendanceViewMode === 'history' ? 'active' : ''}`}
                  onClick={() => setAttendanceViewMode('history')}
                >
                  Full Attendance Register &amp; History ({homeroomHistoryAnalytics.recordedDatesCount} Sessions)
                </button>
                <button
                  className={`tab-btn ${attendanceViewMode === 'mark' ? 'active' : ''}`}
                  onClick={() => setAttendanceViewMode('mark')}
                >
                  Take Daily Roll Call ({selectedDate})
                </button>
              </div>
            </header>

            <div className="content-body" style={{ padding: '24px 32px' }}>
              {/* SUBMODE 1: TAKE DAILY ROLL CALL */}
              {attendanceViewMode === 'mark' && (
                <div>
                  {saveFeedback && (
                    <div style={{ padding: '10px 14px', borderRadius: 6, background: '#EAF3EF', color: '#2D6E5D', border: '1px solid #C7E4D8', fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
                      {saveFeedback}
                    </div>
                  )}

                  {/* Attendance Sheet */}
                  <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
                    {homeroomStudents.length === 0 ? (
                      <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                        No students found in your homeroom section ({homeroomLabel}).
                      </div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: '#F8F7F4', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: 10, textTransform: 'uppercase' }}>
                            <th style={{ textAlign: 'left', padding: '8px 12px', width: 36 }}>#</th>
                            <th style={{ textAlign: 'left', padding: '8px 12px' }}>Student Name</th>
                            <th style={{ textAlign: 'left', padding: '8px 12px' }}>Admission No.</th>
                            <th style={{ textAlign: 'center', padding: '8px 12px' }}>Present</th>
                            <th style={{ textAlign: 'center', padding: '8px 12px' }}>Auth Absent</th>
                            <th style={{ textAlign: 'center', padding: '8px 12px' }}>Unauth Absent</th>
                          </tr>
                        </thead>
                        <tbody>
                          {homeroomStudents.map((st, idx) => {
                            const status = dailyRecords[st.id] || 'present';
                            return (
                              <tr key={st.id} style={{ borderBottom: '1px solid #ECEAE5' }}>
                                <td style={{ padding: '8px 12px', color: '#9E9B95' }}>{idx + 1}</td>
                                <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--neutral-dark)' }}>{st.name}</td>
                                <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11 }}>{st.admission_number || st.user_code || '—'}</td>
                                <td style={{ textAlign: 'center', padding: '8px 12px' }}>
                                  <input
                                    type="radio"
                                    name={`att-${st.id}`}
                                    checked={status === 'present'}
                                    onChange={() => handleAttendanceRadio(st.id, 'present')}
                                    style={{ accentColor: '#2C6E6A', cursor: 'pointer' }}
                                  />
                                </td>
                                <td style={{ textAlign: 'center', padding: '8px 12px' }}>
                                  <input
                                    type="radio"
                                    name={`att-${st.id}`}
                                    checked={status === 'auth_absent'}
                                    onChange={() => handleAttendanceRadio(st.id, 'auth_absent')}
                                    style={{ accentColor: '#D4A373', cursor: 'pointer' }}
                                  />
                                </td>
                                <td style={{ textAlign: 'center', padding: '8px 12px' }}>
                                  <input
                                    type="radio"
                                    name={`att-${st.id}`}
                                    checked={status === 'unauth_absent'}
                                    onChange={() => handleAttendanceRadio(st.id, 'unauth_absent')}
                                    style={{ accentColor: '#D9534F', cursor: 'pointer' }}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* Automated Daily Report Generator */}
                  <div style={{ marginTop: 20, background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 8, padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div>
                        <h4 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>Automated Daily Roll Call Report</h4>
                        <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                          Ready formatted for school records and WhatsApp parent updates.
                        </p>
                      </div>
                      <button
                        onClick={copyReport}
                        style={{
                          padding: '6px 12px',
                          fontSize: 11.5,
                          fontWeight: 600,
                          background: '#FAF9F6',
                          border: '1px solid var(--border-color)',
                          borderRadius: 6,
                          cursor: 'pointer',
                        }}
                      >
                        {copiedNotification ? 'Copied to Clipboard' : 'Copy Report'}
                      </button>
                    </div>
                    <pre
                      style={{
                        background: '#FAF9F6',
                        border: '1px solid #ECEAE5',
                        borderRadius: 6,
                        padding: '12px 14px',
                        fontSize: 11.5,
                        color: 'var(--neutral-dark)',
                        fontFamily: 'monospace',
                        whiteSpace: 'pre-wrap',
                        margin: 0,
                      }}
                    >
                      {reportText}
                    </pre>
                  </div>
                </div>
              )}

              {/* SUBMODE 2: FULL ATTENDANCE REGISTER & HISTORY */}
              {attendanceViewMode === 'history' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {/* Homeroom Historical Analytics KPI Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                    <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 8, padding: '14px 16px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Homeroom Avg Rate</div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: homeroomHistoryAnalytics.averageHomeroomRate >= 85 ? '#2C6E6A' : '#D9534F', marginTop: 4 }}>
                        {homeroomHistoryAnalytics.averageHomeroomRate}%
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{homeroomLabel} Section Average</div>
                    </div>

                    <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 8, padding: '14px 16px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Sessions Recorded</div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--neutral-dark)', marginTop: 4 }}>
                        {homeroomHistoryAnalytics.recordedDatesCount}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>School Attendance Days</div>
                    </div>

                    <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 8, padding: '14px 16px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>At-Risk Students</div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: homeroomHistoryAnalytics.atRiskCount > 0 ? '#D9534F' : '#2C6E6A', marginTop: 4 }}>
                        {homeroomHistoryAnalytics.atRiskCount}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Attendance Below 85%</div>
                    </div>

                    <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 8, padding: '14px 16px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Total Homeroom Roster</div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--neutral-dark)', marginTop: 4 }}>
                        {homeroomStudents.length}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Enrolled in {homeroomLabel}</div>
                    </div>
                  </div>

                  {/* Register View Selector Bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div style={{ display: 'flex', gap: 6, background: '#FAF9F6', padding: '3px', borderRadius: 6, border: '1px solid var(--border-color)' }}>
                      <button
                        onClick={() => {
                          setHistoryTab('by_date');
                          setViewingHistoryStudentId('');
                        }}
                        style={{
                          padding: '6px 14px',
                          fontSize: 12,
                          fontWeight: 700,
                          borderRadius: 4,
                          border: 'none',
                          cursor: 'pointer',
                          background: historyTab === 'by_date' ? '#2D2C2A' : 'transparent',
                          color: historyTab === 'by_date' ? '#FFFFFF' : 'var(--text-secondary)',
                        }}
                      >
                        Daily Session by Date ({homeroomDateLogs.length} Days)
                      </button>
                      <button
                        onClick={() => {
                          setHistoryTab('by_student');
                          setViewingHistoryStudentId('');
                        }}
                        style={{
                          padding: '6px 14px',
                          fontSize: 12,
                          fontWeight: 700,
                          borderRadius: 4,
                          border: 'none',
                          cursor: 'pointer',
                          background: historyTab === 'by_student' ? '#2D2C2A' : 'transparent',
                          color: historyTab === 'by_student' ? '#FFFFFF' : 'var(--text-secondary)',
                        }}
                      >
                        Summary by Student ({filteredHomeroomHistoryStudents.length})
                      </button>
                      <button
                        onClick={() => {
                          setHistoryTab('matrix');
                          setViewingHistoryStudentId('');
                        }}
                        style={{
                          padding: '6px 14px',
                          fontSize: 12,
                          fontWeight: 700,
                          borderRadius: 4,
                          border: 'none',
                          cursor: 'pointer',
                          background: historyTab === 'matrix' ? '#2D2C2A' : 'transparent',
                          color: historyTab === 'matrix' ? '#FFFFFF' : 'var(--text-secondary)',
                        }}
                      >
                        Monthly Matrix Calendar Grid
                      </button>
                    </div>
                  </div>

                  {/* 1. VIEW BY DATE (CLEAN ELEGANT DROPDOWN + MAIN INLINE TABLE) */}
                  {historyTab === 'by_date' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {/* DATE SELECTION TOOLBAR WITH DROPDOWN AND STEPPERS */}
                      <div
                        style={{
                          background: '#FFFFFF',
                          border: '1px solid var(--border-color)',
                          borderRadius: 8,
                          padding: '12px 18px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: 12,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 280 }}>
                          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                            Select Recorded Session:
                          </label>
                          {homeroomDateLogs.length === 0 ? (
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>No sessions recorded yet.</span>
                          ) : (
                            <div style={{ flex: 1, maxWidth: 360 }}>
                              <CustomSelect
                                value={viewingHistoryDate}
                                onChange={(val) => setViewingHistoryDate(val)}
                                options={homeroomDateLogs.map((d) => ({
                                  value: d.date,
                                  label: `${d.date} · ${d.rate}% Present (${d.present}/${d.totalStudents})`,
                                }))}
                              />
                            </div>
                          )}
                        </div>

                        {homeroomDateLogs.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button
                              onClick={() => handleStepDate('prev')}
                              disabled={homeroomDateLogs.findIndex((d) => d.date === viewingHistoryDate) >= homeroomDateLogs.length - 1}
                              style={{
                                padding: '6px 12px',
                                fontSize: 11.5,
                                fontWeight: 600,
                                background: '#FAF9F6',
                                border: '1px solid var(--border-color)',
                                borderRadius: 5,
                                cursor: 'pointer',
                                color: 'var(--neutral-dark)',
                                opacity: homeroomDateLogs.findIndex((d) => d.date === viewingHistoryDate) >= homeroomDateLogs.length - 1 ? 0.4 : 1,
                              }}
                            >
                              ← Older Date
                            </button>
                            <button
                              onClick={() => handleStepDate('next')}
                              disabled={homeroomDateLogs.findIndex((d) => d.date === viewingHistoryDate) <= 0}
                              style={{
                                padding: '6px 12px',
                                fontSize: 11.5,
                                fontWeight: 600,
                                background: '#FAF9F6',
                                border: '1px solid var(--border-color)',
                                borderRadius: 5,
                                cursor: 'pointer',
                                color: 'var(--neutral-dark)',
                                opacity: homeroomDateLogs.findIndex((d) => d.date === viewingHistoryDate) <= 0 ? 0.4 : 1,
                              }}
                            >
                              Newer Date →
                            </button>
                          </div>
                        )}
                      </div>

                      {/* MAIN INLINE ROSTER FOR THE SELECTED DATE */}
                      {activeViewingDateObj ? (
                        <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
                          {/* Top Banner with Date Stats */}
                          <div
                            style={{
                              padding: '16px 20px',
                              borderBottom: '1px solid var(--border-color)',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: 12,
                              background: '#FDFCFB',
                            }}
                          >
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: '#2C6E6A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                DAILY SESSION ROSTER · {homeroomLabel}
                              </div>
                              <h3 style={{ fontSize: 18, fontWeight: 800, margin: '2px 0 0', color: 'var(--neutral-dark)' }}>
                                Attendance Record on {activeViewingDateObj.date}
                              </h3>
                              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                                {activeViewingDateObj.present} of {activeViewingDateObj.totalStudents} Students Present ({activeViewingDateObj.rate}% Attendance)
                              </p>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, auto)', gap: 8 }}>
                                <div style={{ background: '#EAF3EF', border: '1px solid #C7E4D8', borderRadius: 6, padding: '4px 10px', textAlign: 'center' }}>
                                  <span style={{ fontSize: 10, color: '#2D6E5D', fontWeight: 700, textTransform: 'uppercase' }}>Present: </span>
                                  <strong style={{ fontSize: 12, color: '#2D6E5D' }}>{activeViewingDateObj.present}</strong>
                                </div>
                                <div style={{ background: '#FEF7EC', border: '1px solid #F5DEB3', borderRadius: 6, padding: '4px 10px', textAlign: 'center' }}>
                                  <span style={{ fontSize: 10, color: '#9E6C1B', fontWeight: 700, textTransform: 'uppercase' }}>Auth Absent: </span>
                                  <strong style={{ fontSize: 12, color: '#9E6C1B' }}>{activeViewingDateObj.authAbsent}</strong>
                                </div>
                                <div style={{ background: '#FDF1F0', border: '1px solid #F5C6CB', borderRadius: 6, padding: '4px 10px', textAlign: 'center' }}>
                                  <span style={{ fontSize: 10, color: '#A83B38', fontWeight: 700, textTransform: 'uppercase' }}>Unauth Absent: </span>
                                  <strong style={{ fontSize: 12, color: '#A83B38' }}>{activeViewingDateObj.unauthAbsent}</strong>
                                </div>
                              </div>

                              <button
                                className="btn-primary"
                                onClick={() => {
                                  setSelectedDate(activeViewingDateObj.date);
                                  setAttendanceViewMode('mark');
                                }}
                                style={{ padding: '6px 14px', fontSize: 12 }}
                              >
                                Edit in Roll Call →
                              </button>
                            </div>
                          </div>

                          {/* Full Inline Student Status Table */}
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                              <tr style={{ background: '#F8F7F4', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: 10, textTransform: 'uppercase' }}>
                                <th style={{ textAlign: 'left', padding: '9px 16px', width: 40 }}>#</th>
                                <th style={{ textAlign: 'left', padding: '9px 16px' }}>Student Name</th>
                                <th style={{ textAlign: 'left', padding: '9px 16px' }}>Admission No.</th>
                                <th style={{ textAlign: 'left', padding: '9px 16px' }}>Class Section</th>
                                <th style={{ textAlign: 'right', padding: '9px 16px' }}>Attendance Status on {activeViewingDateObj.date}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {activeViewingDateObj.studentStatuses.map(({ student, status }, idx) => (
                                <tr key={student.id} style={{ borderBottom: '1px solid #ECEAE5' }}>
                                  <td style={{ padding: '9px 16px', color: '#9E9B95' }}>{idx + 1}</td>
                                  <td style={{ padding: '9px 16px', fontWeight: 700, color: 'var(--neutral-dark)' }}>
                                    {student.name}
                                  </td>
                                  <td style={{ padding: '9px 16px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                                    {student.admission_number || student.user_code || '—'}
                                  </td>
                                  <td style={{ padding: '9px 16px', color: 'var(--text-secondary)' }}>
                                    Grade {homeroomGrade}-{homeroomSection}
                                  </td>
                                  <td style={{ textAlign: 'right', padding: '9px 16px' }}>
                                    <span
                                      style={{
                                        display: 'inline-block',
                                        padding: '3px 10px',
                                        borderRadius: 4,
                                        fontSize: 10.5,
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                        background: status === 'present' ? '#EAF3EF' : status === 'auth_absent' ? '#FEF7EC' : status === 'unauth_absent' ? '#FDF1F0' : '#FAF9F6',
                                        color: status === 'present' ? '#2D6E5D' : status === 'auth_absent' ? '#9E6C1B' : status === 'unauth_absent' ? '#A83B38' : 'var(--text-secondary)',
                                        border: status === 'present' ? '1px solid #C7E4D8' : status === 'auth_absent' ? '1px solid #F5DEB3' : status === 'unauth_absent' ? '1px solid #F5C6CB' : '1px solid var(--border-color)',
                                      }}
                                    >
                                      {status === 'present' ? 'Present' : status === 'auth_absent' ? 'Authorized Absent' : status === 'unauth_absent' ? 'Unauthorized Absent' : 'Unrecorded'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="panel-block" style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                          No recorded dates found. Click &quot;Take Daily Roll Call&quot; above to mark today&apos;s attendance!
                        </div>
                      )}
                    </div>
                  )}

                  {/* 2. VIEW BY STUDENT (CUMULATIVE TABLE & INLINE DETAIL DRAWER) */}
                  {historyTab === 'by_student' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {activeViewingStudentObj && (
                        <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 8, padding: '16px 20px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: '#2C6E6A', textTransform: 'uppercase' }}>
                                STUDENT ATTENDANCE HISTORY
                              </div>
                              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '2px 0 0' }}>
                                {activeViewingStudentObj.name} ({activeViewingStudentObj.admission_number || activeViewingStudentObj.user_code || '—'})
                              </h3>
                            </div>
                            <button
                              onClick={() => setViewingHistoryStudentId('')}
                              style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, background: '#FAF9F6', border: '1px solid var(--border-color)', borderRadius: 4, cursor: 'pointer' }}
                            >
                              Close History Drawer ✕
                            </button>
                          </div>

                          {(() => {
                            const stat = homeroomHistoryAnalytics.studentStats[activeViewingStudentObj.id] || {
                              totalRecorded: 0,
                              present: 0,
                              authAbsent: 0,
                              unauthAbsent: 0,
                              rate: 100,
                              datesList: [],
                            };
                            return (
                              <div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
                                  <div style={{ background: '#FAF9F6', border: '1px solid var(--border-color)', borderRadius: 6, padding: '8px 12px', textAlign: 'center' }}>
                                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Present</div>
                                    <div style={{ fontSize: 18, fontWeight: 700, color: '#2C6E6A' }}>{stat.present}</div>
                                  </div>
                                  <div style={{ background: '#FAF9F6', border: '1px solid var(--border-color)', borderRadius: 6, padding: '8px 12px', textAlign: 'center' }}>
                                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Auth Absent</div>
                                    <div style={{ fontSize: 18, fontWeight: 700, color: '#D4A373' }}>{stat.authAbsent}</div>
                                  </div>
                                  <div style={{ background: '#FAF9F6', border: '1px solid var(--border-color)', borderRadius: 6, padding: '8px 12px', textAlign: 'center' }}>
                                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Unauth Absent</div>
                                    <div style={{ fontSize: 18, fontWeight: 700, color: '#D9534F' }}>{stat.unauthAbsent}</div>
                                  </div>
                                  <div style={{ background: '#FAF9F6', border: '1px solid var(--border-color)', borderRadius: 6, padding: '8px 12px', textAlign: 'center' }}>
                                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Rate %</div>
                                    <div style={{ fontSize: 18, fontWeight: 700, color: stat.rate >= 85 ? '#2C6E6A' : '#D9534F' }}>{stat.rate}%</div>
                                  </div>
                                </div>

                                <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 6 }}>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                                    <thead>
                                      <tr style={{ background: '#F8F7F4', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: 10, textTransform: 'uppercase' }}>
                                        <th style={{ textAlign: 'left', padding: '6px 12px' }}>Date</th>
                                        <th style={{ textAlign: 'right', padding: '6px 12px' }}>Status</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {stat.datesList.map((d) => (
                                        <tr key={d.date} style={{ borderBottom: '1px solid #ECEAE5' }}>
                                          <td style={{ padding: '6px 12px', fontWeight: 600 }}>{d.date}</td>
                                          <td style={{ textAlign: 'right', padding: '6px 12px' }}>
                                            <span
                                              style={{
                                                display: 'inline-block',
                                                padding: '1px 6px',
                                                borderRadius: 3,
                                                fontSize: 10,
                                                fontWeight: 700,
                                                textTransform: 'uppercase',
                                                background: d.status === 'present' ? '#EAF3EF' : d.status === 'auth_absent' ? '#FEF7EC' : '#FDF1F0',
                                                color: d.status === 'present' ? '#2D6E5D' : d.status === 'auth_absent' ? '#9E6C1B' : '#A83B38',
                                              }}
                                            >
                                              {d.status === 'present' ? 'Present' : d.status === 'auth_absent' ? 'Auth Absent' : 'Unauth Absent'}
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
                        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
                          <h4 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>
                            Cumulative Attendance Record by Student ({filteredHomeroomHistoryStudents.length} Students)
                          </h4>
                          <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                            Complete summary across all recorded school days. Click &quot;View Dates&quot; to inspect any student.
                          </p>
                        </div>

                        {filteredHomeroomHistoryStudents.length === 0 ? (
                          <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                            No students matching your search.
                          </div>
                        ) : (
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                              <tr style={{ background: '#F8F7F4', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: 10, textTransform: 'uppercase' }}>
                                <th style={{ textAlign: 'left', padding: '9px 14px', width: 36 }}>#</th>
                                <th style={{ textAlign: 'left', padding: '9px 14px' }}>Student Name</th>
                                <th style={{ textAlign: 'left', padding: '9px 14px' }}>Admission No.</th>
                                <th style={{ textAlign: 'center', padding: '9px 14px' }}>Days Present</th>
                                <th style={{ textAlign: 'center', padding: '9px 14px' }}>Auth Absent</th>
                                <th style={{ textAlign: 'center', padding: '9px 14px' }}>Unauth Absent</th>
                                <th style={{ textAlign: 'center', padding: '9px 14px' }}>Total Sessions</th>
                                <th style={{ textAlign: 'right', padding: '9px 14px' }}>Rate %</th>
                                <th style={{ textAlign: 'right', padding: '9px 14px' }}>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredHomeroomHistoryStudents.map((st, idx) => {
                                const stat = homeroomHistoryAnalytics.studentStats[st.id] || {
                                  totalRecorded: 0,
                                  present: 0,
                                  authAbsent: 0,
                                  unauthAbsent: 0,
                                  rate: 100,
                                  datesList: [],
                                };
                                const isAtRisk = stat.rate < 85;

                                return (
                                  <tr key={st.id} style={{ borderBottom: '1px solid #ECEAE5' }}>
                                    <td style={{ padding: '9px 14px', color: '#9E9B95' }}>{idx + 1}</td>
                                    <td style={{ padding: '9px 14px', fontWeight: 600, color: 'var(--neutral-dark)' }}>
                                      {st.name}
                                    </td>
                                    <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: 11 }}>
                                      {st.admission_number || st.user_code || '—'}
                                    </td>
                                    <td style={{ textAlign: 'center', padding: '9px 14px', fontWeight: 600, color: '#2C6E6A' }}>
                                      {stat.present}
                                    </td>
                                    <td style={{ textAlign: 'center', padding: '9px 14px', color: '#D4A373' }}>
                                      {stat.authAbsent}
                                    </td>
                                    <td style={{ textAlign: 'center', padding: '9px 14px', color: stat.unauthAbsent > 0 ? '#D9534F' : 'var(--text-secondary)', fontWeight: stat.unauthAbsent > 0 ? 700 : 400 }}>
                                      {stat.unauthAbsent}
                                    </td>
                                    <td style={{ textAlign: 'center', padding: '9px 14px', color: 'var(--text-secondary)' }}>
                                      {stat.totalRecorded}
                                    </td>
                                    <td style={{ textAlign: 'right', padding: '9px 14px' }}>
                                      <span
                                        style={{
                                          display: 'inline-block',
                                          padding: '2px 8px',
                                          borderRadius: 4,
                                          fontSize: 10.5,
                                          fontWeight: 700,
                                          background: isAtRisk ? '#FDF1F0' : '#EAF3EF',
                                          color: isAtRisk ? '#A83B38' : '#2D6E5D',
                                          border: isAtRisk ? '1px solid #F5C6CB' : '1px solid #C7E4D8',
                                        }}
                                      >
                                        {stat.rate}%
                                      </span>
                                    </td>
                                    <td style={{ textAlign: 'right', padding: '9px 14px' }}>
                                      <button
                                        onClick={() => setViewingHistoryStudentId(st.id)}
                                        style={{
                                          padding: '3px 8px',
                                          fontSize: 11,
                                          fontWeight: 600,
                                          background: '#FFFFFF',
                                          border: '1px solid var(--border-color)',
                                          borderRadius: 4,
                                          cursor: 'pointer',
                                          color: 'var(--neutral-dark)',
                                        }}
                                      >
                                        View Dates
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 3. VIEW FULL DATE MATRIX (SPREADSHEET GRID WITH MONTH SELECTOR & FIXED COLUMNS) */}
                  {historyTab === 'matrix' && (
                    <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
                      {/* Matrix Control Bar */}
                      <div
                        style={{
                          padding: '12px 18px',
                          borderBottom: '1px solid var(--border-color)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: 12,
                          background: '#FDFCFB',
                        }}
                      >
                        <div>
                          <h4 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>
                            Monthly Homeroom Attendance Matrix ({matrixMonth})
                          </h4>
                          <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                            Legend: <strong>P</strong> = Present (Green), <strong>A</strong> = Authorized Leave (Amber), <strong>U</strong> = Unauthorized Absent (Red)
                          </p>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                            Select Month:
                          </label>
                          <input
                            type="month"
                            className="form-input"
                            style={{ padding: '5px 10px', fontSize: 12, fontWeight: 600 }}
                            value={matrixMonth}
                            onChange={(e) => setMatrixMonth(e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Horizontal Scrolling Matrix Grid with Sticky Header & Sticky Student Column */}
                      <div style={{ overflowX: 'auto', maxHeight: 460 }}>
                        <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                          <thead>
                            <tr style={{ background: '#F8F7F4', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                              {/* Sticky Student Column */}
                              <th
                                style={{
                                  textAlign: 'left',
                                  padding: '8px 14px',
                                  width: 170,
                                  minWidth: 170,
                                  position: 'sticky',
                                  left: 0,
                                  background: '#F8F7F4',
                                  zIndex: 3,
                                  borderRight: '1px solid var(--border-color)',
                                  boxShadow: '2px 0 4px rgba(0,0,0,0.02)',
                                  textTransform: 'uppercase',
                                  fontSize: 10,
                                }}
                              >
                                Student Name
                              </th>

                              {/* Calendar Day Columns */}
                              {matrixMonthData.days.map(({ dayNumber, weekday, isWeekend }) => (
                                <th
                                  key={dayNumber}
                                  style={{
                                    textAlign: 'center',
                                    padding: '6px 4px',
                                    width: 32,
                                    minWidth: 32,
                                    background: isWeekend ? '#F1EFEA' : '#F8F7F4',
                                    borderRight: '1px solid #ECEAE5',
                                  }}
                                >
                                  <div style={{ fontSize: 9, color: isWeekend ? '#A8A29E' : 'var(--text-secondary)', fontWeight: 600 }}>
                                    {weekday}
                                  </div>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                                    {dayNumber}
                                  </div>
                                </th>
                              ))}

                              {/* Summary Columns */}
                              <th style={{ textAlign: 'center', padding: '6px 8px', minWidth: 44, background: '#EAF3EF', color: '#2D6E5D', borderLeft: '1px solid var(--border-color)' }}>
                                Pres
                              </th>
                              <th style={{ textAlign: 'center', padding: '6px 8px', minWidth: 44, background: '#FEF7EC', color: '#9E6C1B' }}>
                                Auth
                              </th>
                              <th style={{ textAlign: 'center', padding: '6px 8px', minWidth: 44, background: '#FDF1F0', color: '#A83B38' }}>
                                Unauth
                              </th>
                              <th style={{ textAlign: 'center', padding: '6px 10px', minWidth: 54, background: '#F8F7F4', fontWeight: 700 }}>
                                Rate%
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredHomeroomHistoryStudents.map((st) => {
                              const mStat = matrixMonthData.studentMonthlyStats[st.id] || { present: 0, authAbsent: 0, unauthAbsent: 0, totalMarked: 0, rate: 100 };
                              return (
                                <tr key={st.id} style={{ borderBottom: '1px solid #ECEAE5' }}>
                                  {/* Sticky Student Name Cell */}
                                  <td
                                    style={{
                                      padding: '8px 14px',
                                      fontWeight: 600,
                                      color: 'var(--neutral-dark)',
                                      position: 'sticky',
                                      left: 0,
                                      background: '#FFFFFF',
                                      zIndex: 2,
                                      borderRight: '1px solid var(--border-color)',
                                      boxShadow: '2px 0 4px rgba(0,0,0,0.02)',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    <div>{st.name}</div>
                                    <div style={{ fontSize: 9.5, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                                      {st.admission_number || st.user_code || ''}
                                    </div>
                                  </td>

                                  {/* Day status cells */}
                                  {matrixMonthData.days.map(({ dayNumber, dateStr, isWeekend }) => {
                                    const status = (attendance[dateStr] || {})[st.id];
                                    return (
                                      <td
                                        key={dayNumber}
                                        style={{
                                          textAlign: 'center',
                                          padding: '6px 2px',
                                          background: isWeekend ? '#FAF8F5' : '#FFFFFF',
                                          borderRight: '1px solid #F1EFEA',
                                        }}
                                      >
                                        {status === 'present' ? (
                                          <span
                                            style={{
                                              display: 'inline-block',
                                              width: 22,
                                              height: 22,
                                              lineHeight: '22px',
                                              borderRadius: 3,
                                              background: '#EAF3EF',
                                              color: '#2D6E5D',
                                              fontWeight: 700,
                                              fontSize: 10.5,
                                            }}
                                            title={`${dateStr}: Present`}
                                          >
                                            P
                                          </span>
                                        ) : status === 'auth_absent' ? (
                                          <span
                                            style={{
                                              display: 'inline-block',
                                              width: 22,
                                              height: 22,
                                              lineHeight: '22px',
                                              borderRadius: 3,
                                              background: '#FEF7EC',
                                              color: '#9E6C1B',
                                              fontWeight: 700,
                                              fontSize: 10.5,
                                            }}
                                            title={`${dateStr}: Authorized Absent`}
                                          >
                                            A
                                          </span>
                                        ) : status === 'unauth_absent' ? (
                                          <span
                                            style={{
                                              display: 'inline-block',
                                              width: 22,
                                              height: 22,
                                              lineHeight: '22px',
                                              borderRadius: 3,
                                              background: '#FDF1F0',
                                              color: '#A83B38',
                                              fontWeight: 700,
                                              fontSize: 10.5,
                                            }}
                                            title={`${dateStr}: Unauthorized Absent`}
                                          >
                                            U
                                          </span>
                                        ) : (
                                          <span style={{ color: isWeekend ? '#E2DFD8' : '#ECEAE5', fontSize: 11 }}>
                                            {isWeekend ? '·' : '—'}
                                          </span>
                                        )}
                                      </td>
                                    );
                                  })}

                                  {/* Summary counts */}
                                  <td style={{ textAlign: 'center', padding: '6px 8px', fontWeight: 700, color: '#2D6E5D', background: '#F8FBF9', borderLeft: '1px solid var(--border-color)' }}>
                                    {mStat.present}
                                  </td>
                                  <td style={{ textAlign: 'center', padding: '6px 8px', color: '#9E6C1B', background: '#FFFCF7' }}>
                                    {mStat.authAbsent}
                                  </td>
                                  <td style={{ textAlign: 'center', padding: '6px 8px', color: mStat.unauthAbsent > 0 ? '#A83B38' : 'var(--text-secondary)', fontWeight: mStat.unauthAbsent > 0 ? 700 : 400, background: '#FFFDFD' }}>
                                    {mStat.unauthAbsent}
                                  </td>
                                  <td style={{ textAlign: 'center', padding: '6px 10px', fontWeight: 700, color: mStat.rate >= 85 ? '#2D6E5D' : '#A83B38' }}>
                                    {mStat.rate}%
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* VIEW 3: HOMEROOM STUDENT ACHIEVEMENTS */}
        {activeNavMode === 'homeroom_awards' && (
          <>
            <header className="content-header">
              <div className="header-top">
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#2C6E6A', letterSpacing: '0.06em' }}>
                    HOMEROOM RECORDS · {homeroomLabel}
                  </div>
                  <h1 className="page-title" style={{ margin: '2px 0 0' }}>
                    Student Awards &amp; Certifications
                  </h1>
                </div>

                <input
                  type="text"
                  placeholder="Search student or award title..."
                  className="form-input"
                  style={{ width: 240, padding: '6px 10px', fontSize: 12 }}
                  value={awardSearch}
                  onChange={(e) => setAwardSearch(e.target.value)}
                />
              </div>
            </header>

            <div className="content-body" style={{ padding: '24px 32px' }}>
              <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FDFCFB' }}>
                  <div>
                    <h4 style={{ fontSize: 13.5, fontWeight: 700, margin: 0 }}>
                      Homeroom Student Awards Registry ({filteredAwards.length} Published)
                    </h4>
                    <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                      Certified achievements, academic distinctions, and student portfolio uploads.
                    </p>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 4, background: '#EAF3EF', color: '#2D6E5D', border: '1px solid #C7E4D8' }}>
                    {filteredAwards.length} Total Distinctions
                  </span>
                </div>

                {filteredAwards.length === 0 ? (
                  <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                    No student awards or certifications found matching your search.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto', width: '100%' }}>
                    <table style={{ width: '100%', minWidth: 780, borderCollapse: 'collapse', fontSize: 12, tableLayout: 'auto' }}>
                      <thead>
                        <tr style={{ background: '#F8F7F4', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          <th style={{ textAlign: 'left', padding: '10px 16px', width: 40 }}>#</th>
                          <th style={{ textAlign: 'left', padding: '10px 16px', width: 170 }}>Student Name</th>
                          <th style={{ textAlign: 'left', padding: '10px 16px', width: 120 }}>Admission No.</th>
                          <th style={{ textAlign: 'left', padding: '10px 16px', width: 180 }}>Award / Distinction</th>
                          <th style={{ textAlign: 'left', padding: '10px 16px' }}>Citation / Description</th>
                          <th style={{ textAlign: 'right', padding: '10px 16px', width: 200 }}>Certificate File</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAwards.map((aw, idx) => {
                          const student = profiles.find((s) => s.id === aw.student_id);
                          return (
                            <tr key={aw.id} style={{ borderBottom: '1px solid #ECEAE5' }}>
                              <td style={{ padding: '12px 16px', color: '#9E9B95', verticalAlign: 'middle' }}>{idx + 1}</td>
                              <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                                <div style={{ fontWeight: 700, color: 'var(--neutral-dark)' }}>{student ? student.name : 'Unknown Student'}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 400 }}>
                                  {student?.grade ? `Grade ${student.grade}-${student.class_letter || ''}` : 'Student'}
                                </div>
                              </td>
                              <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: 'var(--text-secondary)', fontSize: 11.5, verticalAlign: 'middle' }}>
                                {student?.admission_number || student?.user_code || '—'}
                              </td>
                              <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
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
                                <div style={{ fontWeight: 700, color: 'var(--neutral-dark)' }}>{aw.title}</div>
                              </td>
                              <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', lineHeight: 1.45, fontSize: 12, wordBreak: 'break-word', verticalAlign: 'middle' }}>
                                {aw.description || '—'}
                              </td>
                              <td style={{ textAlign: 'right', padding: '12px 16px', verticalAlign: 'middle' }}>
                                {aw.file_name ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setViewingAwardFile({
                                        fileName: aw.file_name || 'Certificate.pdf',
                                        fileUrl: aw.file_url,
                                        studentName: student ? student.name : 'Student',
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
                                      maxWidth: 180,
                                      padding: '3px 8px',
                                      borderRadius: 4,
                                      fontSize: 11,
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
                                  <span style={{ color: '#CBD5E1', fontSize: 11 }}>No file</span>
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
            </div>
          </>
        )}

        {/* VIEW 4: ACTIVITY & AUDIT LOG */}
        {activeNavMode === 'audit' && (
          <>
            <header className="content-header">
              <div className="header-top">
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#2C6E6A', letterSpacing: '0.06em' }}>
                    GOVERNANCE &amp; COMPLIANCE
                  </div>
                  <h1 className="page-title" style={{ margin: '2px 0 0' }}>
                    Student Activity &amp; Audit Log
                  </h1>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    placeholder="Search student or item..."
                    className="form-input"
                    style={{ width: 200, padding: '6px 10px', fontSize: 12 }}
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                  />
                  <div style={{ width: 190 }}>
                    <CustomSelect
                      value={auditActionFilter}
                      onChange={(val) => setAuditActionFilter(val)}
                      options={[
                        { value: 'ALL', label: 'All Actions' },
                        { value: 'CREATE_ACHIEVEMENT', label: 'Created Achievements' },
                        { value: 'EDIT_ACHIEVEMENT', label: 'Modified Achievements' },
                        { value: 'DELETE_ACHIEVEMENT', label: 'Deleted Achievements' },
                        { value: 'SUBMIT_ASSIGNMENT', label: 'Homework Submissions' },
                      ]}
                    />
                  </div>
                </div>
              </div>
            </header>

            <div className="content-body" style={{ padding: '24px 32px' }}>
              <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
                {filteredAuditLogs.length === 0 ? (
                  <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                    No student activity logs recorded yet. Changes made by students will appear here automatically.
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#F8F7F4', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: 10, textTransform: 'uppercase' }}>
                        <th style={{ textAlign: 'left', padding: '8px 12px', width: 36 }}>#</th>
                        <th style={{ textAlign: 'left', padding: '8px 12px' }}>Timestamp</th>
                        <th style={{ textAlign: 'left', padding: '8px 12px' }}>Student</th>
                        <th style={{ textAlign: 'left', padding: '8px 12px' }}>Action</th>
                        <th style={{ textAlign: 'left', padding: '8px 12px' }}>Target Item</th>
                        <th style={{ textAlign: 'left', padding: '8px 12px' }}>Details / Change Summary</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAuditLogs.map((log, idx) => (
                        <tr key={log.id} style={{ borderBottom: '1px solid #ECEAE5' }}>
                          <td style={{ padding: '8px 12px', color: '#9E9B95' }}>{idx + 1}</td>
                          <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: 11 }}>
                            {log.created_at}
                          </td>
                          <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--neutral-dark)' }}>
                            {log.user_name}
                          </td>
                          <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                            {renderActionBadge(log.action_type)}
                          </td>
                          <td style={{ padding: '8px 12px', fontWeight: 600 }}>
                            {log.target_title}
                          </td>
                          <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontSize: 11.5 }}>
                            {log.details}
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

        {/* VIEW 5: HOLISTIC HUB */}
        {activeNavMode === 'hub' && (
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

                <button className="btn-primary" onClick={onOpenCreateHubActivityModal} style={{ padding: '7px 14px', fontSize: 12 }}>
                  + Publish Activity
                </button>
              </div>
            </header>

            <div className="content-body" style={{ padding: '24px 32px' }}>
              <div className="hub-grid">
                {hubActivities.length === 0 ? (
                  <div className="panel-block" style={{ gridColumn: '1 / -1', padding: '32px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                    No extracurricular programmes published yet. Click &quot;+ Publish Activity&quot; to create one!
                  </div>
                ) : (
                  hubActivities.map((act) => (
                    <div className="hub-card" key={act.id} style={{ borderRadius: 10, border: '1px solid var(--border-color)' }}>
                      <div className="hub-card-body" style={{ padding: '16px' }}>
                        <span className="badge badge-hub" style={{ fontSize: 9.5, marginBottom: 6 }}>{act.type}</span>
                        <div className="hub-card-title" style={{ fontSize: 14, fontWeight: 700 }}>{act.title}</div>
                        <div className="hub-card-desc" style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '6px 0' }}>{act.description}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 8 }}>
                          Event Date: <strong>{act.date}</strong> | Target: {(act.target_grades || []).join(', ') || 'All Grades'}
                        </div>
                      </div>
                      <div className="hub-card-footer" style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#2C6E6A' }}>
                          {(act.enrolled_student_ids || []).length} Students Enrolled
                        </span>
                        <button
                          onClick={() => onDeleteHubActivity(act.id)}
                          style={{ padding: '3px 8px', fontSize: 10.5, fontWeight: 600, border: '1px solid #F5C6CB', borderRadius: 4, background: '#FDF1F0', color: '#A83B38', cursor: 'pointer' }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {/* MANAGE CLASS ENROLLMENT MODAL */}
      <ManageClassStudentsModal
        isOpen={isManageStudentsOpen}
        activeClass={activeClassObj || null}
        profiles={profiles}
        onClose={() => setIsManageStudentsOpen(false)}
        onSave={(classId, studentIds) => onUpdateClassEnrollment(classId, studentIds)}
      />

      {/* REVIEW TEST RESULTS MODAL */}
      <ReviewTestResultsModal
        isOpen={!!selectedReviewTest}
        test={selectedReviewTest}
        classStudents={classStudents}
        testResults={testResults}
        onSaveGrade={(testId, studentId, score, feedback) => onGradeTest(testId, studentId, score, feedback)}
        onDeleteTest={(testId) => onDeleteTest(testId)}
        onClose={() => setSelectedReviewTest(null)}
      />

      {/* GRADE ASSIGNMENT MODAL */}
      <GradeAssignmentModal
        isOpen={!!selectedGradeAssignment}
        assignment={selectedGradeAssignment}
        classStudents={classStudents}
        submissions={assignmentSubmissions}
        onSaveGrade={(assId, studentId, grade, feedback) => onGradeAssignment(assId, studentId, grade, feedback)}
        onDeleteAssignment={(assId) => onDeleteAssignment(assId)}
        onClose={() => setSelectedGradeAssignment(null)}
      />

      {/* VIEW CERTIFICATE / AWARD FILE MODAL */}
      <ViewFileModal
        isOpen={!!viewingAwardFile}
        fileName={viewingAwardFile?.fileName || ''}
        fileUrl={viewingAwardFile?.fileUrl}
        studentName={viewingAwardFile?.studentName}
        title={viewingAwardFile?.title}
        description={viewingAwardFile?.description}
        submissionDate={viewingAwardFile?.submissionDate}
        onClose={() => setViewingAwardFile(null)}
      />

      {/* EDIT SUBJECT CLASSROOM MODAL */}
      <EditSubjectClassModal
        isOpen={isEditClassModalOpen}
        activeClass={activeClassObj || null}
        profiles={profiles}
        onClose={() => setIsEditClassModalOpen(false)}
        onSave={(classId, updatedData) => onUpdateSubjectClass(classId, updatedData)}
        onDelete={(classId) => onDeleteSubjectClass(classId)}
      />
    </div>
  );
};
