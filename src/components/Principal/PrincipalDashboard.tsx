'use client';

import React, { useState, useMemo } from 'react';
import {
  UserProfile,
  SubjectClass,
  TestItem,
  SyllabusTerm,
  Achievement,
  HubActivity,
  ParentDocument,
} from '@/lib/supabaseClient';
import { useSidebarState } from '@/lib/useSidebarState';
import { WoodlemLogo } from '@/components/Shared/WoodlemLogo';
import { SegmentedControl } from '@/components/UI/SegmentedControl';
import { computeExecutiveAnalytics } from '@/lib/analyticsHelper';
import { ACADEMIC_DEPARTMENTS, DEFAULT_PRINCIPAL_RECORD, isPrincipalUser, isSltUser } from '@/lib/specialRolesHelper';
import {
  KpiSparklineCard,
  MatrixTrendChart,
  PinBarBreakdownChart,
  RecentRegistersTable,
  ScoreDistributionChart,
  SubjectComparisonChart,
  AttendanceTrendChart,
  SyllabusVelocityCard,
  MarkComplianceDonut,
  AtRiskHonorRollGrid,
} from '@/components/UI/AnalyticsCharts';
import { SpecialAccessView } from '@/components/Admin/SpecialAccessView';
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
  SlidersHorizontal,
  Crown,
  FileSpreadsheet,
  Layers,
  GraduationCap,
  Sparkles,
  ExternalLink,
  Search,
  CheckCircle2,
} from 'lucide-react';

interface PrincipalDashboardProps {
  currentUser: UserProfile;
  profiles: UserProfile[];
  subjectClasses: SubjectClass[];
  tests?: TestItem[];
  syllabus?: SyllabusTerm[];
  attendance?: Record<string, Record<string, string>>;
  testResults?: Record<string, TestResultRecord>;
  achievements?: Achievement[];
  hubActivities?: HubActivity[];
  parentDocuments?: ParentDocument[];
  onSignOut: () => void;
  onRefreshData?: () => void;
}

type PrincipalTab =
  | 'overview'
  | 'analytics'
  | 'departments'
  | 'classes'
  | 'delegation'
  | 'faculty'
  | 'students'
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
  achievements = [],
  hubActivities = [],
  parentDocuments = [],
  onSignOut,
  onRefreshData,
}) => {
  const [activeTab, setActiveTab] = useState<PrincipalTab>('overview');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>('all');
  const [facultySearch, setFacultySearch] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedClassForMarks, setSelectedClassForMarks] = useState<SubjectClass | null>(null);
  const sidebar = useSidebarState(currentUser?.id || currentUser?.email || 'principal');

  // Compute live executive analytics
  const analytics = useMemo(() => {
    return computeExecutiveAnalytics({
      profiles,
      subjectClasses,
      tests,
      syllabus,
      attendance,
      testResults,
      selectedGradeFilter,
    });
  }, [profiles, subjectClasses, tests, syllabus, attendance, testResults, selectedGradeFilter]);

  const facultyList = useMemo(() => profiles.filter((p) => p.role === 'teacher'), [profiles]);
  const studentList = useMemo(() => profiles.filter((p) => p.role === 'student'), [profiles]);

  const filteredFaculty = useMemo(() => {
    if (!facultySearch.trim()) return facultyList;
    const q = facultySearch.toLowerCase().trim();
    return facultyList.filter(
      (f) =>
        (f.name && f.name.toLowerCase().includes(q)) ||
        (f.email && f.email.toLowerCase().includes(q)) ||
        (f.subject && f.subject.toLowerCase().includes(q))
    );
  }, [facultyList, facultySearch]);

  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return studentList;
    const q = studentSearch.toLowerCase().trim();
    return studentList.filter(
      (s) =>
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q)) ||
        (s.admission_number && s.admission_number.toLowerCase().includes(q)) ||
        (s.user_code && s.user_code.toLowerCase().includes(q))
    );
  }, [studentList, studentSearch]);

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

  const isSlt = isSltUser(currentUser) || currentUser.special_role === 'slt';

  const navTabs: { id: PrincipalTab; label: string; count?: number }[] = useMemo(() => {
    const all: { id: PrincipalTab; label: string; count?: number }[] = [
      { id: 'overview', label: 'EXECUTIVE OVERVIEW' },
      { id: 'analytics', label: 'ACADEMIC ANALYTICS' },
      { id: 'departments', label: 'DEPARTMENT OVERSIGHT' },
      { id: 'classes', label: 'CLASSROOM MARK REGISTERS', count: subjectClasses.length },
      { id: 'delegation', label: 'SPECIAL ROLES & ACCESS' },
      { id: 'faculty', label: 'FACULTY DIRECTORY', count: facultyList.length },
      { id: 'students', label: 'STUDENT DIRECTORY', count: studentList.length },
      { id: 'settings', label: 'SECURITY & SETTINGS' },
      { id: 'support', label: 'HELP & SUPPORT' },
    ];
    if (isSlt) {
      // SLT members do not manage appointments (reserved for Principal)
      return all.filter((t) => t.id !== 'delegation');
    }
    return all;
  }, [isSlt, subjectClasses.length, facultyList.length, studentList.length]);

  const getNavIcon = (id: PrincipalTab) => {
    switch (id) {
      case 'overview': return <LayoutDashboard size={16} />;
      case 'analytics': return <BarChart3 size={16} />;
      case 'departments': return <Layers size={16} />;
      case 'classes': return <FileSpreadsheet size={16} />;
      case 'delegation': return <ShieldCheck size={16} />;
      case 'faculty': return <Users size={16} />;
      case 'students': return <GraduationCap size={16} />;
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

        {/* Executive Label */}
        {!sidebar.isCollapsed && (
          <div
            style={{
              padding: '10px 16px 12px',
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: '#8C8A84',
              textTransform: 'uppercase',
              borderBottom: '1px solid var(--border-color)',
              flexShrink: 0,
            }}
          >
            {isSlt ? 'Executive Leadership Suite' : 'Principal Executive Suite'}
          </div>
        )}

        {/* Profile Card */}
        {sidebar.isCollapsed ? (
          <div style={{ padding: '12px 0 6px', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
            <div
              title={`${isSlt ? (currentUser.designation || 'SLT Member') : 'Principal'} • ${currentUser.name || 'Leadership'}`}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: isSlt ? '#EFF6FF' : '#FEF3C7',
                color: isSlt ? '#1D4ED8' : '#92400E',
                border: isSlt ? '1.5px solid #BFDBFE' : '1.5px solid #F59E0B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: 800,
              }}
            >
              {isSlt ? <ShieldCheck size={18} /> : <Crown size={18} />}
            </div>
          </div>
        ) : (
          <div
            style={{
              margin: '12px 12px 0',
              border: isSlt ? '1px solid #BFDBFE' : '1px solid #F5DEB3',
              borderRadius: 8,
              padding: '10px 12px',
              background: isSlt ? '#EFF6FF' : '#FFFBEB',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              {isSlt ? (
                <ShieldCheck size={14} style={{ color: '#1D4ED8' }} />
              ) : (
                <Crown size={14} style={{ color: '#D97706' }} />
              )}
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A' }}>
                {currentUser.name || 'Leadership'}
              </div>
            </div>
            <div style={{ fontSize: 11, color: '#6B6963', marginBottom: 8 }}>
              {currentUser.email || 'leader@woodlempark.ae'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  background: isSlt ? '#DBEAFE' : '#FEF3C7',
                  color: isSlt ? '#1E40AF' : '#92400E',
                  padding: '2px 7px',
                  borderRadius: 4,
                  border: isSlt ? '1px solid #93C5FD' : '1px solid #F59E0B',
                  textTransform: 'uppercase',
                }}
              >
                {isSlt ? (currentUser.designation || 'Senior Leadership') : 'Principal & Head'}
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#2D8C5E' }}>Active</span>
            </div>
          </div>
        )}

        {/* Nav Items */}
        <nav
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: sidebar.isCollapsed ? '12px 8px 0' : '14px 8px 0',
          }}
        >
          {navTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <div key={tab.id} style={{ position: 'relative' }}>
                <button
                  onClick={() => {
                    setActiveTab(tab.id);
                    sidebar.handleNavClick();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: sidebar.isCollapsed ? 'center' : 'space-between',
                    padding: sidebar.isCollapsed ? '0' : '9px 12px',
                    width: sidebar.isCollapsed ? 40 : '100%',
                    height: sidebar.isCollapsed ? 40 : 'auto',
                    margin: sidebar.isCollapsed ? '4px auto' : '2px 0',
                    background: isActive ? '#1A1A1A' : 'transparent',
                    border: 'none',
                    borderRadius: 7,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.12s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = '#F3F2EF';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'transparent';
                  }}
                  title={sidebar.isCollapsed ? tab.label : undefined}
                >
                  {sidebar.isCollapsed ? (
                    <span style={{ color: isActive ? '#FFFFFF' : 'var(--text-secondary)' }}>
                      {getNavIcon(tab.id)}
                    </span>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <span style={{ color: isActive ? '#FFFFFF' : 'var(--text-secondary)' }}>
                          {getNavIcon(tab.id)}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: isActive ? '#FFFFFF' : 'var(--neutral-dark)',
                            letterSpacing: '0.04em',
                          }}
                        >
                          {tab.label}
                        </span>
                      </div>
                    </>
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
                  {isSltUser(currentUser) ? (currentUser.designation || 'Senior Leadership Team (SLT)') : 'Woodlem Park Institutional Governance'}
                </span>
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 800,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: isSltUser(currentUser) ? '#EFF6FF' : '#FEF3C7',
                    color: isSltUser(currentUser) ? '#1D4ED8' : '#92400E',
                  }}
                >
                  {isSltUser(currentUser) ? 'SLT EXECUTIVE' : 'ROOT CONSOLE'}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Grade Quick-Filters */}
            <SegmentedControl
              value={selectedGradeFilter}
              onChange={(g) => setSelectedGradeFilter(g)}
              options={[
                { value: 'all', label: 'All Grades' },
                { value: '9', label: 'Grade 9' },
                { value: '10', label: 'Grade 10' },
                { value: '11', label: 'Grade 11' },
                { value: '12', label: 'Grade 12' },
              ]}
              height={32}
              textTransform="uppercase"
            />

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


          </div>
        </header>

        {/* Scrollable Viewport Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* 4 KPI Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                <KpiSparklineCard
                  label="TOTAL ENROLLMENT"
                  value={analytics.totalEnrollment}
                  subValue="Students"
                  growthText={`${profiles.filter((p) => p.role === 'teacher').length} Faculty Members`}
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
                  value={subjectClasses.length > 0 ? `${analytics.markCompliance.complianceRate}%` : '0%'}
                  subValue={subjectClasses.length > 0 ? `${analytics.markCompliance.fullyGradedClasses}/${analytics.markCompliance.totalClasses} Verified` : '0 Verified'}
                  growthText={subjectClasses.length > 0 ? `${analytics.markCompliance.pendingClasses} Pending Registers` : 'No classes registered'}
                  sparklineData={[]}
                />
              </div>

              {/* Main Graphs Grid: Left Matrix/Waffle Bar (60%) + Right Pin Bar (40%) */}
              <div style={{ marginBottom: 14 }}>
                <MatrixTrendChart
                  data={analytics.scoreDistribution}
                  overallAverage={analytics.overallAverageScore}
                  totalStudents={analytics.totalEnrollment}
                  title="ACADEMIC PERFORMANCE TREND"
                />
              </div>

              {/* Bottom Table: Recent Marks Registers & Verifications */}
              <RecentRegistersTable
                subjectClasses={subjectClasses}
                profiles={profiles}
                testResults={testResults}
                tests={tests}
                onOpenClassMarks={(className) => {
                  const found = subjectClasses.find((c) => c.name === className || c.class_name === className);
                  if (found) setSelectedClassForMarks(found);
                  else if (subjectClasses.length > 0) setSelectedClassForMarks(subjectClasses[0]);
                }}
              />
            </div>
          )}

          {activeTab === 'analytics' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ marginBottom: 14 }}>
                <ScoreDistributionChart
                  data={analytics.scoreDistribution}
                  overallAverage={analytics.overallAverageScore}
                  totalStudents={analytics.totalEnrollment}
                />
              </div>
            </div>
          )}

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

          {activeTab === 'classes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 10, padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--neutral-dark)' }}>
                      All Classrooms &amp; Mark Registers
                    </h3>
                    <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                      Click any class to audit and directly edit its official assessment marks
                    </p>
                  </div>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: '#2C6E6A', background: '#EAF3EF', padding: '4px 10px', borderRadius: 6 }}>
                    {subjectClasses.length} Cohorts
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                  {subjectClasses.map((cls) => {
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

          {activeTab === 'delegation' && (
            <SpecialAccessView
              currentUser={currentUser}
              profiles={profiles}
              subjectClasses={subjectClasses}
              onRefreshData={onRefreshData}
            />
          )}

          {activeTab === 'faculty' && (
            <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 10, padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--neutral-dark)' }}>
                  Faculty &amp; Teaching Staff Directory
                </h3>
                <input
                  type="text"
                  placeholder="Search faculty..."
                  value={facultySearch}
                  onChange={(e) => setFacultySearch(e.target.value)}
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
                    <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10.5, color: 'var(--text-secondary)' }}>EMAIL</th>
                    <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10.5, color: 'var(--text-secondary)' }}>SUBJECT / ROLE</th>
                    <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10.5, color: 'var(--text-secondary)' }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFaculty.map((f) => (
                    <tr key={f.id} style={{ borderBottom: '1px solid #F0EFEA' }}>
                      <td style={{ padding: '8px 10px', fontSize: 12, fontWeight: 600 }}>{f.name}</td>
                      <td style={{ padding: '8px 10px', fontSize: 11.5, color: 'var(--text-secondary)' }}>{f.email}</td>
                      <td style={{ padding: '8px 10px', fontSize: 11.5 }}>{f.subject || 'Faculty'}</td>
                      <td style={{ padding: '8px 10px', fontSize: 11, color: '#2D8C5E', fontWeight: 600 }}>Active</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'students' && (
            <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 10, padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--neutral-dark)' }}>
                  Student Body Directory
                </h3>
                <input
                  type="text"
                  placeholder="Search students..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
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
                    <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10.5, color: 'var(--text-secondary)' }}>ADMISSION / ID</th>
                    <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10.5, color: 'var(--text-secondary)' }}>GRADE</th>
                    <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10.5, color: 'var(--text-secondary)' }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((st) => (
                    <tr key={st.id} style={{ borderBottom: '1px solid #F0EFEA' }}>
                      <td style={{ padding: '8px 10px', fontSize: 12, fontWeight: 600 }}>{st.name}</td>
                      <td style={{ padding: '8px 10px', fontSize: 11.5, color: 'var(--text-secondary)' }}>{st.admission_number || st.user_code || '—'}</td>
                      <td style={{ padding: '8px 10px', fontSize: 11.5 }}>Grade {st.grade}-{st.class_letter || 'A'}</td>
                      <td style={{ padding: '8px 10px', fontSize: 11, color: '#2D8C5E', fontWeight: 600 }}>Enrolled</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'settings' && (
            <SettingsView currentUser={currentUser} profiles={profiles} onRefreshData={onRefreshData} />
          )}

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
