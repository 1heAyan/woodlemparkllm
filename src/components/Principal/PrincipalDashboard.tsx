'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  UserProfile,
  SubjectClass,
  TestItem,
  SyllabusTerm,
  Achievement,
  HubActivity,
  ParentDocument,
  LateEntryRecord,
  OfflineAssessment,
  OfflineAssessmentMark,
  SpecialRoleAssignment,
  supabase,
} from '@/lib/supabaseClient';
import { useSidebarState } from '@/lib/useSidebarState';
import { WoodlemLogo } from '@/components/Shared/WoodlemLogo';
import { SegmentedControl } from '@/components/UI/SegmentedControl';
import { CustomSelect } from '@/components/UI/CustomSelect';
import { computeExecutiveAnalytics, isSubjectClassInGrade } from '@/lib/analyticsHelper';
import { ACADEMIC_DEPARTMENTS, DEFAULT_PRINCIPAL_RECORD, isPrincipalUser, isSltUser, loadSpecialRoleAssignments } from '@/lib/specialRolesHelper';
import {
  KpiSparklineCard,
  MatrixTrendChart,
  RecentRegistersTable,
  ScoreDistributionChart,
} from '@/components/UI/AnalyticsCharts';
import { SpecialAccessView } from '@/components/Admin/SpecialAccessView';
import { AdminAssessmentTermsView } from '@/components/Admin/AdminAssessmentTermsView';
import { UserDetailView } from '@/components/Admin/UserDetailView';
import { LateEntryView } from '@/components/Shared/LateEntryView';
import { SettingsView } from '@/components/Shared/SettingsView';
import { SupportView } from '@/components/Shared/SupportView';
import { MarkEntryModal } from '@/components/Modals/MarkEntryModal';
import { TestResultRecord } from '@/components/Modals/ReviewTestResultsModal';
import {
  LayoutDashboard,
  BarChart3,
  BookOpen,
  Users,
  ShieldCheck,
  Award,
  Settings,
  LifeBuoy,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Crown,
  FileSpreadsheet,
  Layers,
  GraduationCap,
  Calendar,
  Clock,
  Plus,
  Edit2,
  Trash2,
  Search,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Unlock,
  UploadCloud,
  UserCheck,
  UserX,
  Building,
} from 'lucide-react';

interface PrincipalDashboardProps {
  currentUser: UserProfile;
  profiles: UserProfile[];
  subjectClasses: SubjectClass[];
  tests?: TestItem[];
  syllabus?: SyllabusTerm[];
  attendance?: Record<string, Record<string, string>>;
  testResults?: Record<string, TestResultRecord>;
  offlineAssessments?: OfflineAssessment[];
  offlineMarks?: OfflineAssessmentMark[];
  achievements?: Achievement[];
  hubActivities?: HubActivity[];
  parentDocuments?: ParentDocument[];
  lateEntries?: LateEntryRecord[];
  onOpenProvisionModal?: () => void;
  onOpenBulkModal?: () => void;
  onOpenCreateSubjectClassModal?: (preset?: { grade?: string; section?: string; lockSection?: boolean }) => void;
  onEditUser?: (user: UserProfile) => void;
  onUpdateUser?: (updatedUser: UserProfile) => Promise<void> | void;
  onDeleteUser?: (userId: string) => void;
  onBatchDeactivateUsers?: (userIds: string[], deactivate: boolean) => Promise<void> | void;
  onBatchDeleteUsers?: (userIds: string[]) => Promise<void> | void;
  onSignOut: () => void;
  onRefreshData?: () => void;
}

type PrincipalTab =
  | 'overview'
  | 'analytics'
  | 'departments'
  | 'classes'
  | 'directory'
  | 'assessments'
  | 'late_entry'
  | 'delegation'
  | 'settings'
  | 'support';

export const PrincipalDashboard: React.FC<PrincipalDashboardProps> = ({
  currentUser,
  profiles,
  subjectClasses = [],
  tests = [],
  syllabus = [],
  attendance = {},
  testResults = {},
  offlineAssessments = [],
  offlineMarks = [],
  achievements = [],
  hubActivities = [],
  parentDocuments = [],
  lateEntries = [],
  onOpenProvisionModal,
  onOpenBulkModal,
  onOpenCreateSubjectClassModal,
  onEditUser,
  onUpdateUser,
  onDeleteUser,
  onBatchDeactivateUsers,
  onBatchDeleteUsers,
  onSignOut,
  onRefreshData,
}) => {
  const [activeTab, setActiveTab] = useState<PrincipalTab>('overview');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>('all');
  const [selectedClassForMarks, setSelectedClassForMarks] = useState<SubjectClass | null>(null);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<UserProfile | null>(null);

  // Directory Filtering State
  const [directorySearch, setDirectorySearch] = useState('');
  const [directoryRoleFilter, setDirectoryRoleFilter] = useState<'all' | 'student' | 'teacher' | 'parent' | 'admin' | 'principal' | 'deactivated'>('all');
  const [directoryGradeFilter, setDirectoryGradeFilter] = useState<string>('all');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [directoryPage, setDirectoryPage] = useState<number>(1);
  const pageSize = 50;

  // SLT Directory Tab
  const [sltDirectoryTab, setSltDirectoryTab] = useState<'teachers' | 'students'>('teachers');

  const sidebar = useSidebarState(currentUser?.id || currentUser?.email || 'principal');
  const isPrincipal = isPrincipalUser(currentUser) || currentUser.role === 'principal' || (currentUser.email || '').toLowerCase().startsWith('principal');
  const isSlt = !isPrincipal && (isSltUser(currentUser) || (currentUser.special_role as string) === 'slt');

  const [sltAssignment, setSltAssignment] = useState<SpecialRoleAssignment | null>(null);

  useEffect(() => {
    if (isSlt) {
      loadSpecialRoleAssignments(profiles).then((list) => {
        const found = list.find(
          (a) =>
            a.roleType === 'slt' &&
            (a.userId === currentUser?.id || a.userEmail?.toLowerCase() === (currentUser?.email || '').toLowerCase())
        );
        if (found) {
          setSltAssignment(found);
        }
      });
    }
  }, [isSlt, currentUser, profiles]);

  const facultyList = useMemo(() => {
    let list = profiles.filter((p) => p.role === 'teacher');
    if (isSlt && sltAssignment) {
      const scopeType = sltAssignment.scopeType || (sltAssignment.managedGrades && sltAssignment.managedGrades.length < 4 ? 'custom' : 'all');
      if (scopeType === 'custom') {
        const grades = sltAssignment.managedGrades && sltAssignment.managedGrades.length > 0 ? sltAssignment.managedGrades : ['9', '10', '11', '12'];
        const sections = sltAssignment.managedSections || [];
        list = list.filter((t) => {
          const teachesInScope = (subjectClasses || []).some((sc) => {
            if (sc.teacher_id === t.id) {
              const g = (sc.class_name || sc.name || '').replace(/[^0-9]/g, '');
              if (grades.includes(g)) {
                if (sections.length === 0) return true;
                if (sc.section && sections.includes(`${g}-${sc.section.trim().toUpperCase()}`)) return true;
              }
            }
            return false;
          });
          const assignedG = (t.assigned_class || '').replace(/[^0-9]/g, '');
          if (assignedG && grades.includes(assignedG)) {
            if (sections.length === 0) return true;
            if (t.assigned_class && sections.some((sec) => t.assigned_class?.includes(sec))) return true;
          }
          return teachesInScope;
        });
      }
    }
    return list;
  }, [profiles, isSlt, sltAssignment, subjectClasses]);

  const studentList = useMemo(() => {
    let list = profiles.filter((p) => p.role === 'student');
    if (isSlt && sltAssignment) {
      const scopeType = sltAssignment.scopeType || (sltAssignment.managedGrades && sltAssignment.managedGrades.length < 4 ? 'custom' : 'all');
      if (scopeType === 'custom') {
        const grades = sltAssignment.managedGrades && sltAssignment.managedGrades.length > 0 ? sltAssignment.managedGrades : ['9', '10', '11', '12'];
        const sections = sltAssignment.managedSections || [];
        list = list.filter((st) => {
          const g = (st.grade || '').replace(/[^0-9]/g, '');
          if (!grades.includes(g)) return false;
          if (sections.length > 0) {
            const s = (st.class_letter || '').toUpperCase().trim();
            return sections.includes(`${g}-${s}`);
          }
          return true;
        });
      }
    }
    return list;
  }, [profiles, isSlt, sltAssignment]);

  const overviewStudents = useMemo(() => {
    if (selectedGradeFilter === 'all') return studentList;
    return studentList.filter((st) => (st.grade || '').replace(/[^0-9]/g, '') === selectedGradeFilter);
  }, [studentList, selectedGradeFilter]);

  const overviewSubjectClasses = useMemo(() => {
    let base = subjectClasses;
    if (isSlt && sltAssignment) {
      const scopeType = sltAssignment.scopeType || (sltAssignment.managedGrades && sltAssignment.managedGrades.length < 4 ? 'custom' : 'all');
      if (scopeType === 'custom') {
        const grades = sltAssignment.managedGrades && sltAssignment.managedGrades.length > 0 ? sltAssignment.managedGrades : ['9', '10', '11', '12'];
        const sections = sltAssignment.managedSections || [];
        base = base.filter((sc) => {
          const g = (sc.class_name || sc.name || '').replace(/[^0-9]/g, '');
          if (g && !grades.includes(g)) return false;
          if (sections.length > 0 && sc.section) {
            return sections.includes(`${g}-${sc.section.trim().toUpperCase()}`);
          }
          return true;
        });
      }
    }
    if (selectedGradeFilter === 'all') return base;
    return base.filter((sc) => isSubjectClassInGrade(sc, selectedGradeFilter, profiles));
  }, [subjectClasses, selectedGradeFilter, profiles, isSlt, sltAssignment]);

  const overviewTeachers = useMemo(() => {
    if (selectedGradeFilter === 'all') return facultyList;
    const gradeClassNames = new Set(overviewSubjectClasses.map((sc) => (sc.name || sc.class_name || '').toLowerCase()));
    const gradeTeacherIds = new Set(overviewSubjectClasses.map((sc) => sc.teacher_id).filter(Boolean));
    const gradeTeacherNames = new Set(overviewSubjectClasses.map((sc) => sc.teacher_name?.toLowerCase()).filter(Boolean));

    return facultyList.filter((t) => {
      const assigned = (t.assigned_class || '').replace(/[^0-9]/g, '');
      if (assigned === selectedGradeFilter || (t.assigned_class || '').includes(`${selectedGradeFilter}-`)) return true;
      if (gradeTeacherIds.has(t.id)) return true;
      if (t.name && gradeTeacherNames.has(t.name.toLowerCase())) return true;
      if (t.assigned_class && gradeClassNames.has(t.assigned_class.toLowerCase())) return true;
      return false;
    });
  }, [facultyList, selectedGradeFilter, overviewSubjectClasses]);

  const overviewProfiles = useMemo(() => {
    if (selectedGradeFilter === 'all') return profiles;
    return [...overviewStudents, ...overviewTeachers];
  }, [selectedGradeFilter, profiles, overviewStudents, overviewTeachers]);

  // Live analytics computation
  const analytics = useMemo(() => {
    return computeExecutiveAnalytics({
      profiles: overviewProfiles,
      subjectClasses: overviewSubjectClasses,
      tests,
      syllabus,
      attendance,
      testResults,
      offlineAssessments,
      offlineMarks,
      selectedGradeFilter,
    });
  }, [overviewProfiles, overviewSubjectClasses, tests, syllabus, attendance, testResults, offlineAssessments, offlineMarks, selectedGradeFilter]);

  // Live marks event sync
  useEffect(() => {
    const handleUpdate = () => {
      onRefreshData?.();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('woodlem-marks-updated', handleUpdate);
      return () => window.removeEventListener('woodlem-marks-updated', handleUpdate);
    }
  }, [onRefreshData]);

  // Raw score distribution calculations
  const directScoreDistribution = useMemo(() => {
    const assessmentMap = new Map<string, number>();
    offlineAssessments.forEach((a) => {
      const max = Number(a.maximum_marks);
      if (Number.isFinite(max) && max > 0) {
        assessmentMap.set(a.id, max);
      }
    });

    const counts = { ap: 0, a: 0, b: 0, c: 0, d: 0, f: 0 };
    let total = 0;
    let scoreSum = 0;

    offlineMarks.forEach((m) => {
      if (!m || m.marks === null || m.marks === undefined || (m.marks as any) === '') return;
      const numMarks = Number(m.marks);
      if (!Number.isFinite(numMarks)) return;

      if (selectedGradeFilter !== 'all') {
        const student = profiles.find((p) => p.id === m.student_id);
        if (student) {
          const cleanG = (student.grade || '').replace(/[^0-9]/g, '');
          if (cleanG && cleanG !== selectedGradeFilter) return;
        }
      }

      let maxMarks = assessmentMap.get(m.assessment_id);
      if (!maxMarks || maxMarks <= 0) {
        maxMarks = numMarks <= 40 ? 40 : 100;
      }

      const pct = Math.min(100, Math.max(0, Math.round((numMarks / maxMarks) * 100)));
      scoreSum += pct;
      total++;
      if (pct >= 90) counts.ap++;
      else if (pct >= 80) counts.a++;
      else if (pct >= 70) counts.b++;
      else if (pct >= 60) counts.c++;
      else if (pct >= 50) counts.d++;
      else counts.f++;
    });

    if (testResults && Object.keys(testResults).length > 0) {
      Object.values(testResults).forEach((tr: any) => {
        if (!tr || tr.score === null || tr.score === undefined || tr.score === '') return;
        const s = typeof tr.score === 'number' ? tr.score : Number(tr.score);
        if (!Number.isFinite(s)) return;

        if (selectedGradeFilter !== 'all') {
          const student = profiles.find((p) => p.id === tr.student_id);
          if (student) {
            const cleanG = (student.grade || '').replace(/[^0-9]/g, '');
            if (cleanG && cleanG !== selectedGradeFilter) return;
          }
        }

        const pct = Math.min(100, Math.max(0, Math.round(s)));
        scoreSum += pct;
        total++;
        if (pct >= 90) counts.ap++;
        else if (pct >= 80) counts.a++;
        else if (pct >= 70) counts.b++;
        else if (pct >= 60) counts.c++;
        else if (pct >= 50) counts.d++;
        else counts.f++;
      });
    }

    const overallAvg = total > 0 ? Math.round((scoreSum / total) * 10) / 10 : 0;

    return {
      overallAvg,
      total,
      brackets: [
        { gradeLetter: 'A+', label: 'Outstanding', range: '90–100%', count: counts.ap, percentage: total > 0 ? Math.round((counts.ap / total) * 100) : 0, color: '#265E5A', bg: '#EAF3EF', border: '#C7E4D8' },
        { gradeLetter: 'A',  label: 'Excellent',   range: '80–89%',  count: counts.a,  percentage: total > 0 ? Math.round((counts.a  / total) * 100) : 0, color: '#2C6E6A', bg: '#EDF5F2', border: '#C7E4D8' },
        { gradeLetter: 'B',  label: 'Very Good',   range: '70–79%',  count: counts.b,  percentage: total > 0 ? Math.round((counts.b  / total) * 100) : 0, color: '#2B5B75', bg: '#EBF3F7', border: '#C8DCE5' },
        { gradeLetter: 'C',  label: 'Good',        range: '60–69%',  count: counts.c,  percentage: total > 0 ? Math.round((counts.c  / total) * 100) : 0, color: '#9E6835', bg: '#FEF7EC', border: '#F3D9A0' },
        { gradeLetter: 'D',  label: 'Pass',        range: '50–59%',  count: counts.d,  percentage: total > 0 ? Math.round((counts.d  / total) * 100) : 0, color: '#B37D4A', bg: '#FBF6F0', border: '#ECD8C3' },
        { gradeLetter: 'F',  label: 'Needs Support', range: '<50%',  count: counts.f,  percentage: total > 0 ? Math.round((counts.f  / total) * 100) : 0, color: '#D9534F', bg: '#FDF1F0', border: '#F5C6CB' },
      ],
    };
  }, [offlineMarks, offlineAssessments, testResults, selectedGradeFilter, profiles]);

  // Full Directory Filtering for Principal
  const filteredDirectoryUsers = useMemo(() => {
    return profiles.filter((p) => {
      if (directoryRoleFilter === 'deactivated') {
        if (!p.is_deactivated) return false;
      } else if (directoryRoleFilter !== 'all') {
        if (p.is_deactivated) return false;
        if (p.role !== directoryRoleFilter) return false;
      }

      if (directoryGradeFilter !== 'all') {
        const cleanG = (p.grade || '').replace(/[^0-9]/g, '');
        if (cleanG !== directoryGradeFilter) return false;
      }

      if (directorySearch.trim()) {
        const q = directorySearch.toLowerCase().trim();
        const matchesName = (p.name || '').toLowerCase().includes(q);
        const matchesEmail = (p.email || '').toLowerCase().includes(q);
        const matchesCode = (p.user_code || '').toLowerCase().includes(q);
        const matchesAdmission = (p.admission_number || '').toLowerCase().includes(q);
        const matchesSubject = (p.subject || '').toLowerCase().includes(q);
        if (!matchesName && !matchesEmail && !matchesCode && !matchesAdmission && !matchesSubject) {
          return false;
        }
      }

      return true;
    });
  }, [profiles, directoryRoleFilter, directoryGradeFilter, directorySearch]);

  const totalPages = Math.ceil(filteredDirectoryUsers.length / pageSize) || 1;
  const paginatedDirectoryUsers = useMemo(() => {
    const start = (directoryPage - 1) * pageSize;
    return filteredDirectoryUsers.slice(start, start + pageSize);
  }, [filteredDirectoryUsers, directoryPage, pageSize]);

  // SLT simplified directory
  const sltFilteredFaculty = useMemo(() => {
    if (!directorySearch.trim()) return facultyList;
    const q = directorySearch.toLowerCase().trim();
    return facultyList.filter(
      (f) =>
        (f.name && f.name.toLowerCase().includes(q)) ||
        (f.email && f.email.toLowerCase().includes(q)) ||
        (f.subject && f.subject.toLowerCase().includes(q))
    );
  }, [facultyList, directorySearch]);

  const sltFilteredStudents = useMemo(() => {
    return studentList.filter((s) => {
      if (selectedGradeFilter !== 'all') {
        const cleanG = (s.grade || '').replace(/[^0-9]/g, '');
        if (cleanG !== selectedGradeFilter) return false;
      }
      if (directorySearch.trim()) {
        const q = directorySearch.toLowerCase().trim();
        return (
          (s.name && s.name.toLowerCase().includes(q)) ||
          (s.email && s.email.toLowerCase().includes(q)) ||
          (s.admission_number && s.admission_number.toLowerCase().includes(q)) ||
          (s.user_code && s.user_code.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [studentList, selectedGradeFilter, directorySearch]);

  const exportAuditCSV = () => {
    const rows = [
      ['Metric', 'Value'],
      ['Total Enrollment', analytics.totalEnrollment],
      ['Overall Average Score', `${analytics.overallAverageScore}%`],
      ['Institutional Attendance Rate', `${analytics.overallAttendanceRate}%`],
      ['Curriculum Syllabus Velocity', `${analytics.overallSyllabusProgress}%`],
      ['Mark Entry Compliance', `${analytics.markCompliance.complianceRate}%`],
      ['Total Faculty', facultyList.length],
      ['Total Classes', subjectClasses.length],
      ['', ''],
      ['Top Distinction Rankers', ''],
      ...analytics.distinctionStudents.map((st) => [st.name, `Grade ${st.grade}`, `${st.averageScore}%`]),
      ['', ''],
      ['Academic Support Watchlist', ''],
      ...analytics.atRiskStudents.map((st) => [st.name, `Grade ${st.grade}`, st.concernFactors?.[0] || 'Intervention']),
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Woodlem_Executive_Audit_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Build navigation tabs based on role
  const navTabs: { id: PrincipalTab; label: string; count?: number }[] = useMemo(() => {
    if (isSlt) {
      return [
        { id: 'overview', label: 'Executive Overview' },
        { id: 'analytics', label: 'Academic Analytics' },
        { id: 'departments', label: 'Department Oversight' },
        { id: 'classes', label: 'Classroom Registers', count: subjectClasses.length },
        { id: 'directory', label: 'School Directory', count: profiles.length },
        { id: 'settings', label: 'Security & Settings' },
        { id: 'support', label: 'Help & Support' },
      ];
    }

    return [
      { id: 'overview', label: 'Executive Overview' },
      { id: 'analytics', label: 'Academic Analytics' },
      { id: 'departments', label: 'Department Oversight' },
      { id: 'classes', label: 'Classrooms & Cohorts', count: subjectClasses.length },
      { id: 'directory', label: 'User Directory', count: profiles.length },
      { id: 'assessments', label: 'Assessment Terms' },
      { id: 'late_entry', label: 'Late Entry Logs' },
      { id: 'delegation', label: 'Special Roles & Access' },
      { id: 'settings', label: 'System Settings' },
      { id: 'support', label: 'Help & Support' },
    ];
  }, [isSlt, subjectClasses.length, profiles.length]);

  const getNavIcon = (id: PrincipalTab) => {
    switch (id) {
      case 'overview': return <LayoutDashboard size={16} />;
      case 'analytics': return <BarChart3 size={16} />;
      case 'departments': return <Layers size={16} />;
      case 'classes': return <FileSpreadsheet size={16} />;
      case 'directory': return <Users size={16} />;
      case 'assessments': return <Calendar size={16} />;
      case 'late_entry': return <Clock size={16} />;
      case 'delegation': return <ShieldCheck size={16} />;
      case 'settings': return <Settings size={16} />;
      case 'support': return <LifeBuoy size={16} />;
    }
  };

  return (
    <div className="app-viewport">
      {/* ── WOODLEM LMS EXECUTIVE SIDEBAR ── */}
      <aside
        style={{
          width: sidebar.isCollapsed ? 64 : 260,
          minWidth: sidebar.isCollapsed ? 64 : 260,
          background: '#FFFFFF',
          borderRight: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          flexShrink: 0,
          transition: 'width 0.28s cubic-bezier(0.16, 1, 0.3, 1), min-width 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 15,
        }}
      >
        {/* Logo */}
        <div style={{ padding: '16px 16px 0 16px', flexShrink: 0, overflow: 'hidden' }}>
          <WoodlemLogo collapsed={sidebar.isCollapsed} />
        </div>

        {/* Console Label */}
        {!sidebar.isCollapsed && (
          <div
            style={{
              padding: '10px 16px 12px',
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: '#8C8A84',
              textTransform: 'none',
              borderBottom: '1px solid #E8E5DF',
              flexShrink: 0,
            }}
          >
            {isPrincipal ? 'Principal Super Admin Console' : 'Senior Leadership Suite'}
          </div>
        )}

        {/* Profile Card */}
        {sidebar.isCollapsed ? (
          <div style={{ padding: '12px 0 6px', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
            <div
              title={`${isPrincipal ? 'Principal & Super Admin' : (currentUser.designation || 'Senior Leadership')} • ${currentUser.name || 'Leadership'}`}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: '#1A1A1A',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: 800,
              }}
            >
              {isPrincipal ? <Crown size={18} style={{ color: '#F59E0B' }} /> : <ShieldCheck size={18} />}
            </div>
          </div>
        ) : (
          <div
            style={{
              margin: '12px 12px 0',
              border: '1px solid #E8E5DF',
              borderRadius: 8,
              padding: '10px 12px',
              background: '#FAF9F6',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              {isPrincipal ? (
                <Crown size={14} style={{ color: '#D97706' }} />
              ) : (
                <ShieldCheck size={14} style={{ color: '#2C6E6A' }} />
              )}
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A' }}>
                {currentUser.name || (isPrincipal ? 'Principal' : 'Leadership')}
              </div>
            </div>
            <div style={{ fontSize: 11, color: '#6B6963', marginBottom: 8 }}>
              {currentUser.email || (isPrincipal ? 'principal@woodlempark.ae' : 'leader@woodlempark.ae')}
            </div>
            <div
              style={{
                padding: '5px 8px',
                background: '#FFFFFF',
                border: '1px dashed #D5D3CC',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 700,
                  color: isPrincipal ? '#92400E' : '#2C6E6A',
                  letterSpacing: '0.02em',
                  textTransform: 'none',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {isPrincipal ? 'Principal & Super Admin' : (currentUser.designation || 'Senior Leadership')}
              </span>
            </div>
          </div>
        )}

        {/* Navigation Section Title */}
        <div style={{ padding: sidebar.isCollapsed ? '8px 0 0' : '14px 16px 4px', flexShrink: 0 }}>
          {!sidebar.isCollapsed && (
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: '#9E9A94',
                textTransform: 'none',
              }}
            >
              Navigation
            </div>
          )}
        </div>

        {/* Nav Items */}
        <nav
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: sidebar.isCollapsed ? '0 8px' : '0 8px',
            scrollbarWidth: 'thin',
          }}
        >
          {navTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <div key={tab.id} style={{ position: 'relative' }}>
                <button
                  onClick={() => {
                    setActiveTab(tab.id);
                    setSelectedUserForEdit(null);
                    sidebar.handleNavClick();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: sidebar.isCollapsed ? 'center' : 'flex-start',
                    padding: sidebar.isCollapsed ? '0' : '8px 12px',
                    width: sidebar.isCollapsed ? 40 : '100%',
                    height: sidebar.isCollapsed ? 40 : 'auto',
                    margin: sidebar.isCollapsed ? '4px auto' : '2px 0',
                    background: isActive ? '#1A1A1A' : 'transparent',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.12s ease',
                    gap: 10,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = '#F3F2EF';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'transparent';
                  }}
                  title={sidebar.isCollapsed ? tab.label : undefined}
                >
                  <span
                    style={{
                      color: isActive ? '#FFFFFF' : '#6B6963',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {getNavIcon(tab.id)}
                  </span>
                  {!sidebar.isCollapsed && (
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: isActive ? 700 : 600,
                        color: isActive ? '#FFFFFF' : '#33312E',
                        letterSpacing: '0.02em',
                      }}
                    >
                      {tab.label}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div style={{ padding: '8px 12px 12px', borderTop: '1px solid var(--border-color)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button
            onClick={sidebar.toggleCollapse}
            title={sidebar.isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebar.isCollapsed ? 'center' : 'flex-start',
              gap: 8,
              padding: '7px 8px',
              background: 'transparent',
              border: 'none',
              borderRadius: 6,
              color: 'var(--text-secondary)',
              fontSize: 11.5,
              fontWeight: 600,
              cursor: 'pointer',
              width: '100%',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#F3F2EF')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            {sidebar.isCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
            {!sidebar.isCollapsed && <span>Collapse Sidebar</span>}
          </button>

          <button
            onClick={onSignOut}
            title="Sign Out"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebar.isCollapsed ? 'center' : 'flex-start',
              gap: 8,
              padding: '6px 8px',
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: 6,
              color: '#DC2626',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              width: '100%',
            }}
          >
            <LogOut size={14} />
            {!sidebar.isCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* ── MAIN EXECUTIVE VIEWPORT ── */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
          background: 'var(--neutral-bg)',
        }}
      >
        {/* Top Header */}
        <header
          style={{
            height: 52,
            minHeight: 52,
            borderBottom: '1px solid var(--border-color)',
            background: '#FFFFFF',
            padding: '0 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--neutral-dark)', fontFamily: 'var(--font-display)' }}>
                  {isSlt ? (currentUser.designation || 'Senior Leadership Team (SLT)') : 'Woodlem Park Institutional Governance'}
                </span>
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 800,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: isSlt ? '#EFF6FF' : '#FEF3C7',
                    color: isSlt ? '#1D4ED8' : '#92400E',
                  }}
                >
                  {isSlt ? 'SLT EXECUTIVE' : 'SUPER ADMIN'}
                </span>

                {isSlt && (
                  <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: '#EAF3EF',
                      color: '#2C6E6A',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Building size={10} />
                    {sltAssignment?.scopeType === 'all' || !sltAssignment?.scopeType
                      ? 'Whole School (9-12)'
                      : `Grades ${sltAssignment?.managedGrades?.join(', ') || '9-12'}${
                          sltAssignment?.managedSections?.length
                            ? ` (${sltAssignment.managedSections.length} Sections)`
                            : ''
                        }`}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Grade Quick-Filters */}
            <SegmentedControl
              value={selectedGradeFilter}
              onChange={(g) => setSelectedGradeFilter(g)}
              options={(() => {
                if (
                  isSlt &&
                  sltAssignment &&
                  (sltAssignment.scopeType === 'custom' ||
                    (sltAssignment.managedGrades && sltAssignment.managedGrades.length < 4))
                ) {
                  const myGrades =
                    sltAssignment.managedGrades && sltAssignment.managedGrades.length > 0
                      ? sltAssignment.managedGrades
                      : ['9', '10', '11', '12'];
                  return [
                    { value: 'all', label: 'All My Grades' },
                    ...myGrades.map((g) => ({ value: g, label: `Grade ${g}` })),
                  ];
                }
                return [
                  { value: 'all', label: 'All Grades' },
                  { value: '9', label: 'Grade 9' },
                  { value: '10', label: 'Grade 10' },
                  { value: '11', label: 'Grade 11' },
                  { value: '12', label: 'Grade 12' },
                ];
              })()}
              height={32}
              textTransform="none"
            />

            {(!isSlt || sltAssignment?.permissions?.canExportStatements !== false) && (
              <button
                onClick={exportAuditCSV}
                style={{
                  padding: '6px 12px',
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: 'var(--neutral-dark)',
                  background: '#FFFFFF',
                  border: '1px solid var(--border-color)',
                  borderRadius: 6,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <FileSpreadsheet size={14} style={{ color: '#2C6E6A' }} />
                Export Audit CSV
              </button>
            )}
          </div>
        </header>

        {/* Scrollable Viewport Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {/* TAB 1: EXECUTIVE OVERVIEW */}
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* 4 KPI Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                <KpiSparklineCard
                  label="TOTAL ENROLLMENT"
                  value={analytics.totalEnrollment}
                  subValue="Students"
                  growthText={`${overviewTeachers.length} Faculty Members`}
                  sparklineData={[]}
                />
                <KpiSparklineCard
                  label="ACADEMIC MEAN"
                  value={analytics.overallAverageScore > 0 ? `${analytics.overallAverageScore}%` : '—'}
                  subValue={analytics.overallAverageScore > 0 ? 'Mean Score' : 'No assessments'}
                  growthText={analytics.overallAverageScore > 0 ? 'Verified test marks' : 'Awaiting test marks'}
                  sparklineData={[]}
                />
                <KpiSparklineCard
                  label="DAILY ATTENDANCE"
                  value={analytics.overallAttendanceRate > 0 ? `${analytics.overallAttendanceRate}%` : '—'}
                  subValue={analytics.overallAttendanceRate > 0 ? 'Logged Rate' : 'No attendance logged'}
                  growthText={analytics.overallAttendanceRate > 0 ? `${Object.keys(attendance).length} days logged` : 'Awaiting register'}
                  sparklineData={[]}
                />
                <KpiSparklineCard
                  label="MARK COMPLIANCE"
                  value={overviewSubjectClasses.length > 0 ? `${analytics.markCompliance.complianceRate}%` : '0%'}
                  subValue={overviewSubjectClasses.length > 0 ? `${analytics.markCompliance.fullyGradedClasses}/${analytics.markCompliance.totalClasses} Verified` : '0 Verified'}
                  growthText={overviewSubjectClasses.length > 0 ? `${analytics.markCompliance.pendingClasses} Pending Registers` : 'No classes registered'}
                  sparklineData={[]}
                />
              </div>

              {/* Main Performance Trend Graph */}
              <div style={{ marginBottom: 14 }}>
                <MatrixTrendChart
                  data={directScoreDistribution.brackets}
                  overallAverage={directScoreDistribution.overallAvg}
                  totalStudents={analytics.totalEnrollment}
                  title="ACADEMIC PERFORMANCE TREND"
                />
              </div>

              {/* Bottom Table: Recent Marks Registers & Verifications */}
              <RecentRegistersTable
                subjectClasses={overviewSubjectClasses}
                profiles={overviewProfiles}
                offlineAssessments={offlineAssessments}
                offlineMarks={offlineMarks}
                onOpenClassMarks={(classId) => {
                  const found = overviewSubjectClasses.find(
                    (c) => c.id === classId || c.name === classId || c.class_name === classId
                  );
                  if (found) setSelectedClassForMarks(found);
                }}
              />
            </div>
          )}

          {/* TAB 2: ACADEMIC ANALYTICS */}
          {activeTab === 'analytics' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <ScoreDistributionChart
                data={directScoreDistribution.brackets}
                overallAverage={directScoreDistribution.overallAvg}
                totalStudents={analytics.totalEnrollment}
              />
            </div>
          )}

          {/* TAB 3: DEPARTMENT OVERSIGHT */}
          {activeTab === 'departments' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 10, padding: '16px 20px' }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px', color: 'var(--neutral-dark)' }}>
                  Academic Departments &amp; Curriculum Governance
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                  {ACADEMIC_DEPARTMENTS.map((dept) => {
                    const prog = analytics.syllabusProgressByDept.find((p) => p.department === dept.name);
                    const classesInDept = subjectClasses.filter((c) =>
                      dept.subjects.some((s) => (c.subject || '').toLowerCase().includes(s.toLowerCase()))
                    );
                    return (
                      <div
                        key={dept.id}
                        style={{
                          border: '1px solid var(--border-color)',
                          borderRadius: 8,
                          padding: '14px 16px',
                          background: '#FAF9F6',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 10,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>{dept.name}</span>
                          <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: '#EDE9FE', color: '#6D28D9' }}>
                            {dept.code}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                          {dept.subjects.join(', ')}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
                          <span>Classes: <strong>{classesInDept.length}</strong></span>
                          <span>Syllabus: <strong style={{ color: '#2C6E6A' }}>{prog?.percentage || 70}%</strong></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CLASSROOMS & MARK REGISTERS */}
          {activeTab === 'classes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 10, padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--neutral-dark)' }}>
                      {isSlt ? 'Classroom Registers & Cohort Audits' : 'Classrooms, Cohorts & Mark Registers'}
                    </h3>
                    <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                      Click any class to audit and directly edit its official assessment marks
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {!isSlt && onOpenCreateSubjectClassModal && (
                      <button
                        onClick={() => onOpenCreateSubjectClassModal()}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 6,
                          background: '#1A1A1A',
                          color: '#FFFFFF',
                          border: 'none',
                          fontSize: 11.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                        }}
                      >
                        <Plus size={13} /> Create Class Cohort
                      </button>
                    )}
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: '#2C6E6A', background: '#EAF3EF', padding: '4px 10px', borderRadius: 6 }}>
                      {overviewSubjectClasses.length} Cohorts
                    </span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                  {overviewSubjectClasses.map((cls) => {
                    const enrolledCount = (cls.enrolled_student_ids || []).length;
                    return (
                      <div
                        key={cls.id}
                        style={{
                          border: '1px solid var(--border-color)',
                          borderRadius: 8,
                          padding: '14px 16px',
                          background: '#FAF9F6',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: 12,
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                              {cls.name || cls.class_name}
                            </span>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: '#EAF3EF', color: '#2C6E6A' }}>
                              {cls.class_name || 'Class'}
                            </span>
                          </div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 4 }}>
                            Subject: <strong style={{ color: 'var(--neutral-dark)' }}>{cls.subject || 'General'}</strong>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                            Teacher: {cls.teacher_name || 'Assigned Faculty'} • {enrolledCount} Students
                          </div>
                        </div>

                        <button
                          onClick={() => setSelectedClassForMarks(cls)}
                          style={{
                            padding: '7px 12px',
                            fontSize: 11.5,
                            fontWeight: 700,
                            color: '#FFFFFF',
                            background: '#1A1A1A',
                            border: 'none',
                            borderRadius: 6,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                          }}
                        >
                          <ShieldCheck size={13} /> Open Mark Register &rarr;
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: USER DIRECTORY (SUPER ADMIN FULL VIEW / SLT CLEAN VIEW) */}
          {activeTab === 'directory' && (
            selectedUserForEdit ? (
              <UserDetailView
                user={selectedUserForEdit}
                profiles={profiles}
                parentDocuments={parentDocuments}
                subjectClasses={subjectClasses}
                onBack={() => setSelectedUserForEdit(null)}
                onSave={async (updated) => {
                  if (onUpdateUser) await onUpdateUser(updated);
                  setSelectedUserForEdit(null);
                  if (onRefreshData) onRefreshData();
                }}
                onDelete={onDeleteUser ? (id) => {
                  onDeleteUser(id);
                  setSelectedUserForEdit(null);
                } : undefined}
              />
            ) : isSlt ? (
              /* SLT STREAMLINED DIRECTORY (Ultra Clean & Simple) */
              <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 10, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => setSltDirectoryTab('teachers')}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 6,
                        border: sltDirectoryTab === 'teachers' ? '1px solid #1A1A1A' : '1px solid var(--border-color)',
                        background: sltDirectoryTab === 'teachers' ? '#1A1A1A' : '#FAF9F6',
                        color: sltDirectoryTab === 'teachers' ? '#FFFFFF' : 'var(--neutral-dark)',
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Teaching Faculty ({facultyList.length})
                    </button>
                    <button
                      onClick={() => setSltDirectoryTab('students')}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 6,
                        border: sltDirectoryTab === 'students' ? '1px solid #1A1A1A' : '1px solid var(--border-color)',
                        background: sltDirectoryTab === 'students' ? '#1A1A1A' : '#FAF9F6',
                        color: sltDirectoryTab === 'students' ? '#FFFFFF' : 'var(--neutral-dark)',
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Student Body ({studentList.length})
                    </button>
                  </div>

                  <input
                    type="text"
                    placeholder="Search name, email, code..."
                    value={directorySearch}
                    onChange={(e) => setDirectorySearch(e.target.value)}
                    style={{
                      height: 32,
                      width: 240,
                      padding: '0 12px',
                      fontSize: 12,
                      borderRadius: 6,
                      border: '1px solid #E5E3DF',
                      background: '#FFFFFF',
                      color: '#1A1A1A',
                      outline: 'none',
                    }}
                  />
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#FAF9F6', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10.5, color: 'var(--text-secondary)' }}>NAME</th>
                      <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10.5, color: 'var(--text-secondary)' }}>
                        {sltDirectoryTab === 'teachers' ? 'EMAIL / USER ID' : 'ADMISSION NUMBER'}
                      </th>
                      <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10.5, color: 'var(--text-secondary)' }}>
                        {sltDirectoryTab === 'teachers' ? 'SUBJECT / ROLE' : 'GRADE'}
                      </th>
                      <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10.5, color: 'var(--text-secondary)' }}>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(sltDirectoryTab === 'teachers' ? sltFilteredFaculty : sltFilteredStudents).map((u) => (
                      <tr key={u.id} style={{ borderBottom: '1px solid #F0EFEA' }}>
                        <td style={{ padding: '8px 10px', fontSize: 12, fontWeight: 600 }}>{u.name}</td>
                        <td style={{ padding: '8px 10px', fontSize: 11.5, color: 'var(--text-secondary)' }}>
                          {sltDirectoryTab === 'teachers' ? u.email : (u.admission_number || u.user_code || '—')}
                        </td>
                        <td style={{ padding: '8px 10px', fontSize: 11.5 }}>
                          {sltDirectoryTab === 'teachers' ? (u.subject || u.designation || 'Faculty') : `Grade ${u.grade}-${u.class_letter || 'A'}`}
                        </td>
                        <td style={{ padding: '8px 10px', fontSize: 11, color: '#2D8C5E', fontWeight: 600 }}>Active</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              /* PRINCIPAL SUPER ADMIN FULL DIRECTORY */
              <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 10, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <SegmentedControl
                      value={directoryRoleFilter}
                      onChange={(r) => {
                        setDirectoryRoleFilter(r as any);
                        setDirectoryPage(1);
                      }}
                      options={[
                        { value: 'all', label: 'All Users' },
                        { value: 'student', label: 'Students' },
                        { value: 'teacher', label: 'Faculty' },
                        { value: 'admin', label: 'Admins' },
                        { value: 'deactivated', label: 'Deactivated' },
                      ]}
                      height={32}
                      textTransform="none"
                    />

                    <input
                      type="text"
                      placeholder="Search directory..."
                      value={directorySearch}
                      onChange={(e) => {
                        setDirectorySearch(e.target.value);
                        setDirectoryPage(1);
                      }}
                      style={{
                        height: 32,
                        width: 220,
                        padding: '0 12px',
                        fontSize: 12,
                        borderRadius: 6,
                        border: '1px solid #E5E3DF',
                        background: '#FFFFFF',
                        color: '#1A1A1A',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {onOpenProvisionModal && (
                      <button
                        onClick={onOpenProvisionModal}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 6,
                          background: '#1A1A1A',
                          color: '#FFFFFF',
                          border: 'none',
                          fontSize: 11.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                        }}
                      >
                        <Plus size={13} /> Provision User
                      </button>
                    )}
                    {onOpenBulkModal && (
                      <button
                        onClick={onOpenBulkModal}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 6,
                          background: '#FAF9F6',
                          color: 'var(--neutral-dark)',
                          border: '1px solid var(--border-color)',
                          fontSize: 11.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                        }}
                      >
                        <UploadCloud size={13} /> Bulk Import CSV
                      </button>
                    )}
                  </div>
                </div>

                {/* Batch Actions Bar */}
                {selectedUserIds.size > 0 && (
                  <div
                    style={{
                      background: '#1A1A1A',
                      color: '#FFFFFF',
                      borderRadius: 6,
                      padding: '8px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 600 }}>
                      {selectedUserIds.size} user{selectedUserIds.size !== 1 ? 's' : ''} selected
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {onBatchDeactivateUsers && (
                        <button
                          onClick={() => {
                            onBatchDeactivateUsers(Array.from(selectedUserIds), directoryRoleFilter !== 'deactivated');
                            setSelectedUserIds(new Set());
                          }}
                          style={{
                            padding: '4px 10px',
                            background: '#333333',
                            border: '1px solid #555555',
                            color: '#FFFFFF',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {directoryRoleFilter === 'deactivated' ? 'Reactivate Selected' : 'Deactivate Selected'}
                        </button>
                      )}
                      {onBatchDeleteUsers && (
                        <button
                          onClick={() => {
                            if (confirm('Permanently delete selected users?')) {
                              onBatchDeleteUsers(Array.from(selectedUserIds));
                              setSelectedUserIds(new Set());
                            }
                          }}
                          style={{
                            padding: '4px 10px',
                            background: '#DC2626',
                            border: 'none',
                            color: '#FFFFFF',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Delete Selected
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Directory Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#FAF9F6', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ width: 36, padding: '8px 10px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={paginatedDirectoryUsers.length > 0 && paginatedDirectoryUsers.every((u) => selectedUserIds.has(u.id))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              const next = new Set(selectedUserIds);
                              paginatedDirectoryUsers.forEach((u) => next.add(u.id));
                              setSelectedUserIds(next);
                            } else {
                              const next = new Set(selectedUserIds);
                              paginatedDirectoryUsers.forEach((u) => next.delete(u.id));
                              setSelectedUserIds(next);
                            }
                          }}
                        />
                      </th>
                      <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10.5, color: 'var(--text-secondary)' }}>NAME</th>
                      <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10.5, color: 'var(--text-secondary)' }}>EMAIL / CODE</th>
                      <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10.5, color: 'var(--text-secondary)' }}>ROLE / DESIGNATION</th>
                      <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10.5, color: 'var(--text-secondary)' }}>STATUS</th>
                      <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: 10.5, color: 'var(--text-secondary)' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedDirectoryUsers.map((u) => (
                      <tr key={u.id} style={{ borderBottom: '1px solid #F0EFEA' }}>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={selectedUserIds.has(u.id)}
                            onChange={(e) => {
                              const next = new Set(selectedUserIds);
                              if (e.target.checked) next.add(u.id);
                              else next.delete(u.id);
                              setSelectedUserIds(next);
                            }}
                          />
                        </td>
                        <td style={{ padding: '8px 10px', fontSize: 12, fontWeight: 600 }}>{u.name}</td>
                        <td style={{ padding: '8px 10px', fontSize: 11.5, color: 'var(--text-secondary)' }}>
                          {u.email || u.user_code || u.admission_number || '—'}
                        </td>
                        <td style={{ padding: '8px 10px', fontSize: 11.5 }}>
                          {u.designation || u.role}
                        </td>
                        <td style={{ padding: '8px 10px', fontSize: 11 }}>
                          {u.is_deactivated ? (
                            <span style={{ color: '#DC2626', fontWeight: 600 }}>Deactivated</span>
                          ) : (
                            <span style={{ color: '#2D8C5E', fontWeight: 600 }}>Active</span>
                          )}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                          <button
                            onClick={() => setSelectedUserForEdit(u)}
                            style={{
                              padding: '3px 8px',
                              background: '#FAF9F6',
                              border: '1px solid var(--border-color)',
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
                    <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                      Page {directoryPage} of {totalPages} ({filteredDirectoryUsers.length} total users)
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => setDirectoryPage((p) => Math.max(1, p - 1))}
                        disabled={directoryPage === 1}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 4,
                          border: '1px solid var(--border-color)',
                          background: '#FFFFFF',
                          fontSize: 11.5,
                          cursor: directoryPage === 1 ? 'not-allowed' : 'pointer',
                        }}
                      >
                        Prev
                      </button>
                      <button
                        onClick={() => setDirectoryPage((p) => Math.min(totalPages, p + 1))}
                        disabled={directoryPage === totalPages}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 4,
                          border: '1px solid var(--border-color)',
                          background: '#FFFFFF',
                          fontSize: 11.5,
                          cursor: directoryPage === totalPages ? 'not-allowed' : 'pointer',
                        }}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          )}

          {/* TAB 6: ASSESSMENT TERMS (PRINCIPAL SUPER ADMIN) */}
          {activeTab === 'assessments' && (
            <AdminAssessmentTermsView
              currentUser={currentUser}
              subjectClasses={subjectClasses}
              profiles={profiles}
              onOpenMarkRegister={(cls) => setSelectedClassForMarks(cls)}
            />
          )}

          {/* TAB 7: LATE ENTRY LOGS (PRINCIPAL SUPER ADMIN) */}
          {activeTab === 'late_entry' && (
            <LateEntryView
              mode="admin"
              currentUser={currentUser}
              profiles={profiles}
              lateEntries={lateEntries}
              onRefreshData={onRefreshData}
            />
          )}

          {/* TAB 8: SPECIAL ROLES & ACCESS DELEGATION */}
          {activeTab === 'delegation' && (
            <SpecialAccessView
              currentUser={currentUser}
              profiles={profiles}
              subjectClasses={subjectClasses}
              onRefreshData={onRefreshData}
            />
          )}

          {/* TAB 9: SETTINGS */}
          {activeTab === 'settings' && (
            <SettingsView currentUser={currentUser} profiles={profiles} onRefreshData={onRefreshData} />
          )}

          {/* TAB 10: SUPPORT */}
          {activeTab === 'support' && (
            <SupportView currentUser={currentUser} />
          )}
        </div>
      </main>

      {/* Classroom Mark Entry Audit Modal */}
      {selectedClassForMarks && (
        <MarkEntryModal
          isOpen={true}
          classRoom={selectedClassForMarks}
          teacher={currentUser}
          profiles={profiles}
          onClose={() => setSelectedClassForMarks(null)}
        />
      )}
    </div>
  );
};
