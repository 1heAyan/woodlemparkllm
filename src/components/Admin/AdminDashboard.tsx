'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, LayoutDashboard, Users, BookOpen, FileText, Award, Settings, LifeBuoy, Server, LogOut, Pin, PinOff, SlidersHorizontal, Check, UserCheck, Clock, CheckCircle2, XCircle, Zap, X, FileSpreadsheet, ShieldCheck, Crown, Lock } from 'lucide-react';
import { WoodlemLogo } from '@/components/Shared/WoodlemLogo';
import { useSidebarState } from '@/lib/useSidebarState';
import { UserProfile, ParentDocument, HubActivity, ParentStudentLinkRequest, SubjectClass, TestItem, SyllabusTerm } from '@/lib/supabaseClient';
import { CustomSelect } from '@/components/UI/CustomSelect';
import { SegmentedControl } from '@/components/UI/SegmentedControl';
import { SettingsView } from '@/components/Shared/SettingsView';
import { SupportView } from '@/components/Shared/SupportView';
import { SpecialAccessView } from '@/components/Admin/SpecialAccessView';
import { UserDetailView } from '@/components/Admin/UserDetailView';
import { AdminAssessmentTermsView } from '@/components/Admin/AdminAssessmentTermsView';
import { formatShortFileName, openFileInNewTab, downloadFile } from '@/lib/fileHelper';
import { usePortalNavigation } from '@/lib/PortalNavigationContext';
import { extractClassTeacherInfo } from '@/lib/classTeacherHelper';
import { isPrincipalUser } from '@/lib/specialRolesHelper';
import { sanitizeUserCode } from '@/lib/userCodeHelper';
import { computeExecutiveAnalytics } from '@/lib/analyticsHelper';
import {
  ScoreDistributionChart,
  SubjectComparisonChart,
  AttendanceTrendChart,
  SyllabusVelocityCard,
  MarkComplianceDonut,
  AtRiskHonorRollGrid,
} from '@/components/UI/AnalyticsCharts';
import { MarkEntryModal } from '../Modals/MarkEntryModal';
import { TestResultRecord } from '../Modals/ReviewTestResultsModal';

interface AdminDashboardProps {
  currentUser: UserProfile;
  profiles: UserProfile[];
  parentDocuments: ParentDocument[];
  hubActivities: HubActivity[];
  subjectClasses: SubjectClass[];
  linkRequests?: ParentStudentLinkRequest[];
  tests?: TestItem[];
  syllabus?: SyllabusTerm[];
  attendance?: Record<string, Record<string, string>>;
  testResults?: Record<string, TestResultRecord>;
  onOpenProvisionModal: () => void;
  onOpenBulkModal: () => void;
  onEditUser: (user: UserProfile) => void;
  onUpdateUser?: (updatedUser: UserProfile) => Promise<void> | void;
  onDeleteUser: (userId: string) => void;
  onApproveLinkRequest?: (requestId: string) => Promise<void>;
  onRejectLinkRequest?: (requestId: string) => Promise<void>;
  onSignOut: () => void;
  onRefreshData?: () => void;
}

type AdminTab = 'overview' | 'delegation' | 'directory' | 'link_requests' | 'classes' | 'assessments' | 'hub' | 'settings' | 'support';

const VALID_GRADES = ['9', '10', '11', '12'] as const;
const BASE_SECTIONS = ['A', 'B', 'C', 'D'] as const;

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  profiles,
  parentDocuments,
  hubActivities,
  subjectClasses = [],
  linkRequests = [],
  tests = [],
  syllabus = [],
  attendance = {},
  testResults = {},
  onOpenProvisionModal,
  onOpenBulkModal,
  onEditUser,
  onUpdateUser,
  onDeleteUser,
  onApproveLinkRequest,
  onRejectLinkRequest,
  onSignOut,
  onRefreshData,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [docSubTab, setDocSubTab] = useState<'clearances' | 'link_requests'>('clearances');
  const [roleFilter, setRoleFilter] = useState<'all' | 'student' | 'teacher' | 'parent' | 'admin'>('all');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [docStudentFilter, setDocStudentFilter] = useState('');
  const [selectedClassInspect, setSelectedClassInspect] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<UserProfile | null>(null);
  const [activeMarkEntryClass, setActiveMarkEntryClass] = useState<SubjectClass | null>(null);
  const sidebar = useSidebarState('auto-hide');

  const handleInitiateEditUser = (u: UserProfile) => {
    setSelectedUserForEdit(u);
  };

  const [overviewGradeFilter, setOverviewGradeFilter] = useState<string>('all');

  const overviewAnalytics = useMemo(() => {
    return computeExecutiveAnalytics({
      profiles,
      subjectClasses,
      tests: tests || [],
      syllabus: syllabus || [],
      attendance: attendance || {},
      testResults: testResults || {},
      selectedGradeFilter: overviewGradeFilter,
    });
  }, [profiles, subjectClasses, tests, syllabus, attendance, testResults, overviewGradeFilter]);

  const pendingLinkRequests = useMemo(() => linkRequests.filter((r) => r.status === 'pending'), [linkRequests]);

  // Portal Navigation & AI Copilot Integration
  const { isAiPanelOpen, toggleAiPanel, subscribeToNavigation } = usePortalNavigation();

  React.useEffect(() => {
    const unsubscribe = subscribeToNavigation((target) => {
      if (target.view === 'overview') {
        setActiveTab('overview');
      } else if (target.view === 'directory' || target.view === 'users') {
        setActiveTab('directory');
      } else if (target.view === 'classes' || target.view === 'sections') {
        setActiveTab('classes');
      } else if (target.view === 'assessments' || target.view === 'exams' || target.view === 'terms' || target.view === 'marks') {
        setActiveTab('assessments');
      } else if (target.view === 'link_requests' || target.view === 'documents' || target.view === 'requests') {
        setActiveTab('link_requests');
      } else if (target.view === 'hub' || target.view === 'activities') {
        setActiveTab('hub');
      } else if (target.view === 'settings' || target.view === 'password') {
        setActiveTab('settings');
      } else if (target.view === 'support' || target.view === 'helpdesk') {
        setActiveTab('support');

      } else if (target.modalAction === 'provision_user') {
        onOpenProvisionModal();
      } else if (target.modalAction === 'bulk_import') {
        onOpenBulkModal();
      }
    });
    return unsubscribe;
  }, [subscribeToNavigation, onOpenProvisionModal, onOpenBulkModal]);

  // Grouped profiles
  const students = useMemo(() => profiles.filter((p) => p.role === 'student'), [profiles]);
  const teachers = useMemo(() => profiles.filter((p) => p.role === 'teacher'), [profiles]);
  const parents = useMemo(() => profiles.filter((p) => p.role === 'parent'), [profiles]);
  const admins = useMemo(() => profiles.filter((p) => p.role === 'admin'), [profiles]);

  // Dynamic list of active classes (cohorts with enrolled students, assigned class teachers, or subject classes)
  const activeClassList = useMemo(() => {
    const classSet = new Set<string>();

    // Add any student cohorts that exist in database (with at least 1 student)
    students.forEach((st) => {
      const g = (st.grade || '').replace(/[^0-9]/g, '');
      const s = (st.class_letter || '').toUpperCase().trim();
      if (VALID_GRADES.includes(g as any) && s) {
        classSet.add(`${g}-${s}`);
      }
    });

    // Add any teacher assigned class cohorts
    teachers.forEach((t) => {
      const info = extractClassTeacherInfo(t, subjectClasses);
      if (info.isClassTeacher && info.classKey) {
        classSet.add(info.classKey);
      }
    });

    // Add any active subject classes
    (subjectClasses || []).forEach((sc) => {
      if (sc.class_name) {
        const clean = sc.class_name.replace(/^Grade\s*/i, '').replace(/[\(\)]/g, '').trim();
        const m = clean.match(/^(\d+)\s*[-:]?\s*([A-Z])/i) || clean.match(/^(\d+)\s+([A-Z])/i);
        if (m && VALID_GRADES.includes(m[1] as any)) {
          classSet.add(`${m[1]}-${m[2].toUpperCase()}`);
        }
      }
    });

    return Array.from(classSet).sort((a, b) => {
      const [ga, sa] = a.split('-');
      const [gb, sb] = b.split('-');
      if (parseInt(ga) !== parseInt(gb)) return parseInt(ga) - parseInt(gb);
      return sa.localeCompare(sb);
    });
  }, [students, teachers, subjectClasses]);

  // Filtered profiles for User Directory
  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      // Role filter
      if (roleFilter !== 'all' && p.role !== roleFilter) return false;

      // Class / Section filter
      if (classFilter !== 'all') {
        if (p.role === 'student') {
          const cleanG = (p.grade || '').replace(/[^0-9]/g, '');
          const cleanS = (p.class_letter || '').toUpperCase().trim();
          const studentClass = `${cleanG}-${cleanS}`;
          if (studentClass !== classFilter) return false;
        } else if (p.role === 'teacher') {
          const info = extractClassTeacherInfo(p, subjectClasses);
          if (!info.isClassTeacher || info.classKey !== classFilter) return false;
        } else {
          return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (p.name || '').toLowerCase().includes(q);
        const matchesEmail = (p.email || '').toLowerCase().includes(q);
        const matchesCode = (p.user_code || '').toLowerCase().includes(q);
        const matchesAdm = (p.admission_number || '').toLowerCase().includes(q);
        const matchesSubject = (p.subject || '').toLowerCase().includes(q);
        return matchesName || matchesEmail || matchesCode || matchesAdm || matchesSubject;
      }
      return true;
    });
  }, [profiles, roleFilter, classFilter, searchQuery]);

  // Filtered parent documents
  const filteredDocs = useMemo(() => {
    if (!docStudentFilter) return parentDocuments;
    return parentDocuments.filter((d) => d.student_id === docStudentFilter);
  }, [parentDocuments, docStudentFilter]);

  // Format student / teacher class & subject badge
  const formatUserAssignment = (p: UserProfile) => {
    if (p.role === 'student') {
      const cleanG = (p.grade || '').replace(/[^0-9]/g, '') || p.grade;
      const cleanS = (p.class_letter || '').toUpperCase() || '';
      if (!cleanG && !cleanS) return 'Unassigned';
      return `Grade ${cleanG}${cleanS ? `-${cleanS}` : ''}`;
    }
    if (p.role === 'teacher') {
      const parts: string[] = [];
      if (p.subject) parts.push(p.subject);
      const info = extractClassTeacherInfo(p, subjectClasses);
      if (info.isClassTeacher) {
        parts.push(`Class Teacher (${info.classKey})`);
      }
      return parts.length > 0 ? parts.join(' | ') : 'Faculty';
    }
    if (p.role === 'parent') {
      const linked = profiles.filter((st) => (p.linked_student_ids || []).includes(st.id));
      if (linked.length === 0) return 'Parent (No Ward Linked)';
      return `Ward: ${linked.map((s) => `${s.name} (${s.grade ? `G${s.grade.replace(/[^0-9]/g, '')}-${s.class_letter || 'A'}` : 'Student'})`).join(', ')}`;
    }
    if (p.role === 'admin') return 'System Administrator';
    return 'General';
  };

  const handleRefresh = async () => {
    if (onRefreshData) {
      setIsRefreshing(true);
      await onRefreshData();
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  // CSV export helper
  const exportUsersCSV = () => {
    const headers = ['Name', 'Email', 'Role', 'Admission/Code', 'Grade', 'Section', 'Subject', 'Assigned Class'];
    const rows = filteredProfiles.map((p) => [
      `"${p.name || ''}"`,
      `"${p.email || ''}"`,
      `"${p.role || ''}"`,
      `"${sanitizeUserCode(p.admission_number || p.user_code, p.email)}"`,
      `"${p.grade || ''}"`,
      `"${p.class_letter || ''}"`,
      `"${p.subject || ''}"`,
      `"${extractClassTeacherInfo(p, subjectClasses).isClassTeacher ? extractClassTeacherInfo(p, subjectClasses).classKey : (p.assigned_class || '')}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `woodlem_directory_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Modern compact styles
  const thStyle: React.CSSProperties = {
    textAlign: 'left',
    padding: '7px 10px',
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#65635E',
    background: '#F5F4F0',
    borderBottom: '1px solid var(--border-color)',
    whiteSpace: 'nowrap',
  };

  const tdStyle: React.CSSProperties = {
    padding: '7px 10px',
    fontSize: 12,
    borderBottom: '1px solid #ECEAE5',
    color: 'var(--neutral-dark)',
  };

  const rolePill = (role: string, userObj?: UserProfile) => {
    if (userObj && isPrincipalUser(userObj)) {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '1px 7px',
            fontSize: 9.5,
            fontWeight: 800,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            borderRadius: 4,
            background: '#FEF3C7',
            color: '#92400E',
            border: '1px solid #F59E0B',
            whiteSpace: 'nowrap',
          }}
        >
          <Crown size={10} /> Principal
        </span>
      );
    }
    const styleMap: Record<string, { bg: string; text: string; border: string }> = {
      student: { bg: '#EBF3F2', text: '#2C6E6A', border: '#CBE2DF' },
      teacher: { bg: '#F9F1E6', text: '#9B6634', border: '#EBD4B8' },
      parent: { bg: '#EAF3EF', text: '#2D6E5D', border: '#C7E4D8' },
      admin: { bg: '#EFECE6', text: '#2D2C2A', border: '#DCD8CE' },
      principal: { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' },
    };
    const s = styleMap[role] || { bg: '#F0EFEA', text: '#55534E', border: '#DDD' };
    return (
      <span
        style={{
          display: 'inline-block',
          padding: '1px 6px',
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          borderRadius: 4,
          background: s.bg,
          color: s.text,
          border: `1px solid ${s.border}`,
          whiteSpace: 'nowrap',
        }}
      >
        {role}
      </span>
    );
  };

  // ─── TAB 1: OVERVIEW ────────────────────────────────────────────────────────
  const renderOverview = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Top compact executive banner */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-color)',
          borderRadius: 8,
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 className="page-title" style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--neutral-dark)', fontFamily: 'var(--font-display)' }}>
              Executive Control Console
            </h1>
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
            Logged in as {currentUser.name || 'System Admin'} ({currentUser.email}) | Total {profiles.length} Accounts in System
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Grade Quick Filter Chips */}
          <SegmentedControl
            value={overviewGradeFilter}
            onChange={(g) => setOverviewGradeFilter(g)}
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
            onClick={() => setActiveTab('delegation')}
            style={{
              padding: '6px 12px',
              fontSize: 11.5,
              fontWeight: 700,
              color: '#2C6E6A',
              background: '#EAF3EF',
              border: '1px solid #C7E4D8',
              borderRadius: 6,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <ShieldCheck size={14} /> Roles &amp; HODs
          </button>


          <button
            onClick={onOpenProvisionModal}
            style={{
              padding: '6px 12px',
              fontSize: 11.5,
              fontWeight: 600,
              color: '#FFFFFF',
              background: '#2D2C2A',
              border: '1px solid #2D2C2A',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            + Create Account
          </button>
          <button
            onClick={onOpenBulkModal}
            style={{
              padding: '6px 12px',
              fontSize: 11.5,
              fontWeight: 600,
              color: 'var(--neutral-dark)',
              background: '#FFFFFF',
              border: '1px solid var(--border-color)',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Import Accounts
          </button>
          <button
            onClick={exportUsersCSV}
            style={{
              padding: '6px 12px',
              fontSize: 11.5,
              fontWeight: 600,
              color: 'var(--neutral-dark)',
              background: '#FFFFFF',
              border: '1px solid var(--border-color)',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Export Accounts
          </button>
        </div>
      </div>

      {/* Pending Parent Link Requests Alert Banner */}
      {pendingLinkRequests.length > 0 && (
        <div
          style={{
            background: 'linear-gradient(90deg, #FEF7EC 0%, #FFFBEB 100%)',
            border: '1.5px solid #F5DEB3',
            borderRadius: 8,
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Zap size={18} style={{ color: '#D97706', flexShrink: 0 }} />
            <div>
              <strong style={{ color: '#8A5D16', fontSize: 13 }}>
                {pendingLinkRequests.length} Parent-Student Link Request{pendingLinkRequests.length > 1 ? 's' : ''} Awaiting Approval
              </strong>
              <div style={{ fontSize: 11.5, color: '#9B6634', marginTop: 1 }}>
                Parents have submitted their child&apos;s admission number in the Parent Portal. Click below to review and approve access.
              </div>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('link_requests')}
            style={{
              padding: '7px 16px',
              background: '#2C6E6A',
              color: '#FFFFFF',
              borderRadius: 6,
              fontWeight: 700,
              fontSize: 12,
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Review Requests &rarr;
          </button>
        </div>
      )}

      {/* KPI Stats Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
        {[
          { label: 'TOTAL ACCOUNTS', val: profiles.length, sub: 'Registered users', tab: 'directory' as const, role: 'all' as const, isAlert: false },
          { label: 'STUDENTS', val: students.length, sub: `Active cohort (${overviewAnalytics.overallAverageScore}% mean)`, tab: 'directory' as const, role: 'student' as const, isAlert: false },
          { label: 'FACULTY', val: teachers.length, sub: 'Teaching staff & HODs', tab: 'directory' as const, role: 'teacher' as const, isAlert: false },
          { label: 'PARENTS', val: parents.length, sub: 'Linked guardians', tab: 'directory' as const, role: 'parent' as const, isAlert: false },
          {
            label: 'LINK REQUESTS',
            val: pendingLinkRequests.length > 0 ? `${pendingLinkRequests.length} PENDING` : `${linkRequests.length} TOTAL`,
            sub: 'Parent-student links',
            tab: 'link_requests' as const,
            role: 'all' as const,
            isAlert: pendingLinkRequests.length > 0,
          },
        ].map((k) => (
          <div
            key={k.label}
            onClick={() => {
              setActiveTab(k.tab);
              if (k.role !== 'all') setRoleFilter(k.role);
            }}
            style={{
              background: k.isAlert ? '#FFFBEB' : 'var(--surface)',
              border: k.isAlert ? '1.5px solid #F5DEB3' : '1px solid var(--border-color)',
              borderRadius: 8,
              padding: '10px 14px',
              cursor: 'pointer',
              transition: 'border-color 0.12s, background 0.12s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#8C8983')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = k.isAlert ? '#F5DEB3' : 'var(--border-color)')}
          >
            <div style={{ fontSize: 9.5, fontWeight: 700, color: k.isAlert ? '#92400E' : 'var(--text-secondary)', letterSpacing: '0.06em' }}>
              {k.label}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: k.isAlert ? '#B45309' : 'var(--neutral-dark)', fontFamily: 'var(--font-display)', margin: '3px 0 1px' }}>
              {k.val}
            </div>
            <div style={{ fontSize: 10.5, color: k.isAlert ? '#92400E' : '#888580' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ── RICH ANALYTICS CHARTS SECTION ─────────────────────────────────── */}
      <div style={{ marginBottom: 12 }}>
        <ScoreDistributionChart
          data={overviewAnalytics.scoreDistribution}
          overallAverage={overviewAnalytics.overallAverageScore}
          totalStudents={overviewAnalytics.totalEnrollment}
        />
      </div>

      <AtRiskHonorRollGrid
        distinctions={overviewAnalytics.distinctionStudents}
        atRisk={overviewAnalytics.atRiskStudents}
        onSelectStudent={(id) => {
          const target = profiles.find((p) => p.id === id);
          if (target) setSelectedUserForEdit(target);
        }}
      />



      {/* Recent User Registrations (Dense Table) */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ padding: '9px 14px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--neutral-dark)' }}>
            Recent Accounts
          </span>
          <button
            onClick={() => setActiveTab('directory')}
            style={{ background: 'none', border: 'none', color: 'var(--neutral-dark)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
          >
            View All Accounts ({profiles.length})
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Role</th>
                <th style={thStyle}>Identifier</th>
                <th style={thStyle}>Assignment</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {profiles.slice(-7).reverse().map((p) => (
                <tr
                  key={p.id}
                  style={{ background: '#FFFFFF', transition: 'background 0.1s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#F8F7F4')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#FFFFFF')}
                >
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{p.name}</td>
                  <td style={{ ...tdStyle, color: 'var(--text-secondary)', fontSize: 11.5 }}>{p.email}</td>
                  <td style={tdStyle}>{rolePill(p.role)}</td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 11 }}>
                    {sanitizeUserCode(p.admission_number || p.user_code, p.email) || '—'}
                  </td>
                  <td style={{ ...tdStyle, fontSize: 11.5, color: '#55534E' }}>{formatUserAssignment(p)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <button
                      onClick={() => handleInitiateEditUser(p)}
                      style={{
                        padding: '3px 8px',
                        fontSize: 11,
                        fontWeight: 600,
                        border: '1px solid var(--border-color)',
                        borderRadius: 4,
                        background: '#FFFFFF',
                        cursor: 'pointer',
                        marginRight: 4,
                      }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // ─── TAB 2: USER DIRECTORY ───────────────────────────────────────────────────
  const renderUserDirectory = () => (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
      {/* Search & Filter Strip */}
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
          background: '#FAF9F6',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Search name, email, code, subject..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
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

          {/* Role selector pills */}
          <SegmentedControl
            value={roleFilter}
            onChange={(r) => setRoleFilter(r)}
            options={[
              { value: 'all', label: 'All' },
              { value: 'student', label: 'Student' },
              { value: 'teacher', label: 'Teacher' },
              { value: 'parent', label: 'Parent' },
              { value: 'admin', label: 'Admin' },
            ]}
            height={32}
            textTransform="uppercase"
          />

          {/* Class Filter */}
          <div style={{ width: 140 }}>
            <CustomSelect
              value={classFilter}
              onChange={(val) => setClassFilter(val)}
              buttonStyle={{ height: 32, padding: '0 12px', fontSize: 12, borderRadius: 6, borderColor: '#E5E3DF' }}
              options={[
                { value: 'all', label: 'All Sections' },
                ...activeClassList.map((c) => ({ value: c, label: `Section ${c}` })),
              ]}
            />
          </div>

          {(searchQuery || roleFilter !== 'all' || classFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setRoleFilter('all');
                setClassFilter('all');
              }}
              style={{
                height: 26,
                padding: '0 8px',
                fontSize: 10.5,
                fontWeight: 600,
                color: '#A83B38',
                background: '#FDF1F0',
                border: '1px solid #F5C6CB',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              Reset Filters
            </button>
          )}

          <span style={{ fontSize: 11, color: 'var(--text-secondary)', paddingLeft: 4 }}>
            Showing {filteredProfiles.length} of {profiles.length} accounts
          </span>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={exportUsersCSV}
            style={{
              height: 28,
              padding: '0 10px',
              fontSize: 11.5,
              fontWeight: 600,
              color: 'var(--neutral-dark)',
              background: '#FFFFFF',
              border: '1px solid var(--border-color)',
              borderRadius: 5,
              cursor: 'pointer',
            }}
          >
              Export Accounts
            </button>
            <button
              onClick={onOpenBulkModal}
              style={{
                height: 28,
                padding: '0 10px',
                fontSize: 11.5,
                fontWeight: 600,
                color: 'var(--neutral-dark)',
                background: '#FFFFFF',
                border: '1px solid var(--border-color)',
                borderRadius: 5,
                cursor: 'pointer',
              }}
            >
              Import Accounts
            </button>
            <button
              onClick={onOpenProvisionModal}
              style={{
                height: 28,
                padding: '0 12px',
                fontSize: 11.5,
                fontWeight: 600,
                color: '#FFFFFF',
                background: '#2D2C2A',
                border: '1px solid #2D2C2A',
                borderRadius: 5,
                cursor: 'pointer',
              }}
            >
              + Create Account
            </button>
          </div>
      </div>

      {/* Directory Table */}
      <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 180px)' }}>
        {filteredProfiles.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--neutral-dark)' }}>No user records matched your criteria</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 4 }}>Try clearing active search or filters.</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 32 }}>#</th>
                <th style={thStyle}>Full Name</th>
                <th style={thStyle}>Role</th>
                <th style={thStyle}>Email Address</th>
                <th style={thStyle}>Admission / Code</th>
                <th style={thStyle}>Academic Mapping</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProfiles.map((p, idx) => (
                <tr
                  key={p.id}
                  style={{
                    background: idx % 2 === 0 ? '#FFFFFF' : '#FAF9F7',
                    transition: 'background 0.08s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#F2F1EC')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = idx % 2 === 0 ? '#FFFFFF' : '#FAF9F7')}
                >
                  <td style={{ ...tdStyle, color: '#9E9B95', fontSize: 10.5 }}>{idx + 1}</td>
                  <td style={{ ...tdStyle, fontWeight: 600, whiteSpace: 'nowrap' }}>{p.name}</td>
                  <td style={tdStyle}>{rolePill(p.role, p)}</td>
                  <td style={{ ...tdStyle, color: 'var(--text-secondary)', fontSize: 11.5 }}>{p.email}</td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 11, color: '#44423E' }}>
                    {sanitizeUserCode(p.admission_number || p.user_code, p.email) || '—'}
                  </td>
                  <td style={{ ...tdStyle, fontSize: 11.5, color: '#4A4843' }}>
                    {formatUserAssignment(p)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button
                      onClick={() => handleInitiateEditUser(p)}
                      style={{
                        padding: '3px 10px',
                        fontSize: 11,
                        fontWeight: 600,
                        border: '1px solid var(--border-color)',
                        borderRadius: 4,
                        background: '#FFFFFF',
                        color: 'var(--neutral-dark)',
                        cursor: 'pointer',
                        marginRight: 6,
                      }}
                    >
                      Edit
                    </button>
                    {(() => {
                      const isPrincipal = isPrincipalUser(p);
                      if (isPrincipal) {
                        return (
                          <span
                            title="The Principal account holds permanent root executive privileges and cannot be deleted."
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '2px 8px',
                              fontSize: 10,
                              fontWeight: 700,
                              color: '#92400E',
                              background: '#FEF3C7',
                              border: '1px solid #F59E0B',
                              borderRadius: 4,
                            }}
                          >
                            <Lock size={10} /> Protected
                          </span>
                        );
                      }
                      if (p.role !== 'admin') {
                        return (
                          <button
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete profile for "${p.name}"?`)) {
                                onDeleteUser(p.id);
                              }
                            }}
                            style={{
                              padding: '3px 8px',
                              fontSize: 11,
                              fontWeight: 600,
                              border: '1px solid #F5C6CB',
                              borderRadius: 4,
                              background: '#FDF1F0',
                              color: '#A83B38',
                              cursor: 'pointer',
                            }}
                          >
                            Delete
                          </button>
                        );
                      }
                      return null;
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  // ─── TAB 3: CLASSES & SECTIONS ──────────────────────────────────────────────
  const renderClasses = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--neutral-dark)' }}>Class Sections &amp; Class Teachers</span>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
              Woodlem Park active section distribution for Grades 9-12
            </p>
          </div>
        </div>

        {activeClassList.length === 0 ? (
          <div style={{ padding: '36px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--neutral-dark)' }}>No active class sections found</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 4 }}>
              Active class sections will appear automatically when students are enrolled or teachers are assigned.
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {activeClassList.map((cls) => {
              const [g, s] = cls.split('-');
              const classStudents = students.filter((st) => {
                const cleanG = (st.grade || '').replace(/[^0-9]/g, '');
                const cleanS = (st.class_letter || '').toUpperCase().trim();
                return cleanG === g && cleanS === s;
              });
              const ct = teachers.find((t) => {
                const info = extractClassTeacherInfo(t, subjectClasses);
                return info.isClassTeacher && info.classKey === cls;
              });
              const isSelected = selectedClassInspect === cls;

              return (
                <div
                  key={cls}
                  onClick={() => setSelectedClassInspect(isSelected ? null : cls)}
                  style={{
                    border: isSelected ? '1.5px solid #2D2C2A' : '1px solid var(--border-color)',
                    borderRadius: 6,
                    padding: '10px 12px',
                    background: isSelected ? '#FAF9F6' : '#FFFFFF',
                    boxShadow: isSelected ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.1s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>Grade {g} - Section {s}</span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: 4,
                        background: '#EBF3F2',
                        color: '#2C6E6A',
                      }}
                    >
                      {classStudents.length} Students
                    </span>
                  </div>

                  <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid #ECEAE5', fontSize: 11 }}>
                    <div style={{ color: 'var(--text-secondary)' }}>Class Teacher:</div>
                    <div style={{ fontWeight: 600, color: ct ? '#2C6E6A' : '#9E9B95', marginTop: 1 }}>
                      {ct ? `${ct.name} (${ct.subject || 'Faculty'})` : 'Unassigned'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected Class Roster & Subject Classes Modal Popup */}
      {selectedClassInspect && (() => {
        const [g, s] = selectedClassInspect.split('-');
        const roster = students.filter((st) => {
          const cleanG = (st.grade || '').replace(/[^0-9]/g, '');
          const cleanS = (st.class_letter || '').toUpperCase().trim();
          return cleanG === g && cleanS === s;
        });
        const sectionSubjectClasses = subjectClasses.filter(
          sc => (sc.class_name || '').toUpperCase().trim() === selectedClassInspect.toUpperCase().trim()
        );

        return (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: 20,
            }}
            onClick={() => setSelectedClassInspect(null)}
          >
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: 12,
                width: '100%',
                maxWidth: 960,
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: '#FAF9F6',
                  borderTopLeftRadius: 12,
                  borderTopRightRadius: 12,
                }}
              >
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--neutral-dark)' }}>
                    Class Profile &amp; Roster — Grade {g} - Section {s}
                  </h3>
                  <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                    Student enrollment list and subject classroom assessment channels for this cohort.
                  </p>
                </div>
                <button
                  onClick={() => setSelectedClassInspect(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: 24,
                    fontWeight: 300,
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    lineHeight: 1,
                  }}
                >
                  &times;
                </button>
              </div>

              {/* Modal Body */}
              <div style={{ padding: 20, overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* Student Roster */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div
                    style={{
                      padding: '9px 14px',
                      borderBottom: '1px solid var(--border-color)',
                      background: '#FAF9F6',
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                      Enrolled Students ({roster.length})
                    </span>
                  </div>

                  <div style={{ maxHeight: 400, overflowY: 'auto', flex: 1 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ ...thStyle, width: 32 }}>#</th>
                          <th style={thStyle}>Student Name</th>
                          <th style={thStyle}>Admission #</th>
                          <th style={{ ...thStyle, textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {roster.length === 0 ? (
                          <tr>
                            <td colSpan={4} style={{ ...tdStyle, textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>
                              No students currently enrolled in section {selectedClassInspect}.
                            </td>
                          </tr>
                        ) : (
                          roster.map((st, idx) => (
                            <tr key={st.id} style={{ background: '#FFFFFF' }}>
                              <td style={{ ...tdStyle, color: '#9E9B95', fontSize: 10.5 }}>{idx + 1}</td>
                              <td style={{ ...tdStyle, fontWeight: 600 }}>{st.name}</td>
                              <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 11 }}>{sanitizeUserCode(st.admission_number || st.user_code, st.email) || '—'}</td>
                              <td style={{ ...tdStyle, textAlign: 'right' }}>
                                <button
                                  onClick={() => {
                                    setSelectedClassInspect(null);
                                    handleInitiateEditUser(st);
                                  }}
                                  style={{
                                    padding: '2px 8px',
                                    fontSize: 10.5,
                                    fontWeight: 600,
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 4,
                                    background: '#FFFFFF',
                                    cursor: 'pointer',
                                  }}
                                >
                                  Edit
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Subject Classes / Terms */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div
                    style={{
                      padding: '9px 14px',
                      borderBottom: '1px solid var(--border-color)',
                      background: '#FAF9F6',
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                      Subject Classes &amp; Assessment Registers
                    </span>
                  </div>

                  <div style={{ padding: 14, overflowY: 'auto', flex: 1, maxHeight: 400, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {sectionSubjectClasses.length === 0 ? (
                      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>
                        No subject classes registered for {selectedClassInspect}.
                      </div>
                    ) : (
                      sectionSubjectClasses.map(sc => {
                        const classTeacher = profiles.find(p => p.id === sc.teacher_id);
                        return (
                          <div key={sc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: 6, background: '#FAF9F6' }}>
                            <div style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
                              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--neutral-dark)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sc.name || `${sc.subject} (${sc.class_name})`}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                                Teacher: <span style={{ fontWeight: 600, color: '#2C6E6A' }}>{classTeacher?.name || sc.teacher_name || 'Unassigned'}</span>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setSelectedClassInspect(null);
                                setActiveMarkEntryClass(sc);
                              }}
                              className="btn-primary"
                              style={{
                                padding: '6px 12px',
                                fontSize: 11.5,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                background: '#2D2C2A',
                                border: 'none',
                                borderRadius: 4,
                                color: '#fff',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              Manage Terms
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );

  // ─── TAB 4: DOCUMENTS & VERIFICATIONS ────────────────────────────────────────
  const renderDocuments = () => {
    const pendingRequests = linkRequests.filter((r) => r.status === 'pending');

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Subtab Segmented Control */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', paddingBottom: 10 }}>
          <SegmentedControl
            value={docSubTab}
            onChange={(tab) => setDocSubTab(tab)}
            options={[
              {
                value: 'clearances',
                label: 'Clearance Documents',
                count: parentDocuments.length,
              },
              {
                value: 'link_requests',
                label: 'Parent-Student Link Requests',
                count: pendingRequests.length > 0 ? pendingRequests.length : undefined,
              },
            ]}
            height={34}
            textTransform="none"
          />
        </div>

        {docSubTab === 'clearances' ? (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
            <div
              style={{
                padding: '10px 14px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 8,
                background: '#FAF9F6',
              }}
            >
              <div>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>Parent Document Submissions</span>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 8 }}>
                  Total {filteredDocs.length} records
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 220 }}>
                <CustomSelect
                  value={docStudentFilter}
                  onChange={(val) => setDocStudentFilter(val)}
                  placeholder="All Students"
                  buttonStyle={{ height: 32, padding: '0 12px', fontSize: 12, borderRadius: 6, borderColor: '#E5E3DF' }}
                  options={[
                    { value: '', label: 'All Students' },
                    ...students.map((s) => ({
                      value: s.id,
                      label: `${s.name} (${s.grade ? `G${s.grade}-${s.class_letter}` : 'General'})`,
                    })),
                  ]}
                />
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              {filteredDocs.length === 0 ? (
                <div style={{ padding: '36px 20px', textAlign: 'center' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--neutral-dark)' }}>No document records found</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Submissions by parents will appear here automatically.</div>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle, width: 32 }}>#</th>
                      <th style={thStyle}>Document Type</th>
                      <th style={thStyle}>Student Name</th>
                      <th style={thStyle}>Status</th>
                      <th style={thStyle}>Uploaded File</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDocs.map((doc, idx) => {
                      const student = profiles.find((p) => p.id === doc.student_id);
                      const submitted = doc.status === 'submitted';
                      return (
                        <tr
                          key={doc.id || idx}
                          style={{ background: idx % 2 === 0 ? '#FFFFFF' : '#FAF9F7' }}
                        >
                          <td style={{ ...tdStyle, color: '#9E9B95', fontSize: 10.5 }}>{idx + 1}</td>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>{doc.doc_type}</td>
                          <td style={{ ...tdStyle, color: 'var(--neutral-dark)' }}>
                            {student ? `${student.name} (${student.grade ? `G${student.grade}-${student.class_letter}` : ''})` : 'Unknown Student'}
                          </td>
                          <td style={tdStyle}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '1px 6px',
                                fontSize: 9.5,
                                fontWeight: 700,
                                letterSpacing: '0.04em',
                                textTransform: 'uppercase',
                                borderRadius: 4,
                                background: submitted ? '#EAF3EF' : '#FEF7EC',
                                color: submitted ? '#2D6E5D' : '#9E6C1B',
                                border: submitted ? '1px solid #C7E4D8' : '1px solid #F5DEB3',
                              }}
                            >
                              {submitted ? 'SUBMITTED' : 'PENDING'}
                            </span>
                          </td>
                          <td style={{ ...tdStyle, color: 'var(--text-secondary)', fontSize: 11 }} title={doc.file_name || ''}>
                            {submitted ? (formatShortFileName(doc.file_name || '') || 'File attached') : 'Awaiting submission'}
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>
                            {submitted ? (
                              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    openFileInNewTab({
                                      fileName: doc.file_name || 'Clearance_Document.pdf',
                                      fileUrl: doc.file_url,
                                      studentName: student?.name || 'Student',
                                      title: doc.doc_type,
                                      description: `Official verified ${doc.doc_type} document submission for ${student?.name || 'Student'}.`,
                                      submissionDate: doc.uploaded_at,
                                    });
                                  }}
                                  style={{
                                    padding: '4px 10px',
                                    fontSize: 11,
                                    fontWeight: 700,
                                    background: '#2D2C2A',
                                    color: '#FFFFFF',
                                    border: 'none',
                                    borderRadius: 4,
                                    cursor: 'pointer',
                                  }}
                                >
                                  View
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    downloadFile({
                                      fileName: doc.file_name || `${doc.doc_type}_${student?.name || 'Student'}.pdf`,
                                      fileUrl: doc.file_url,
                                      studentName: student?.name || 'Student',
                                      title: doc.doc_type,
                                      description: `Official verified ${doc.doc_type} document submission for ${student?.name || 'Student'}.`,
                                      submissionDate: doc.uploaded_at,
                                    });
                                  }}
                                  style={{
                                    padding: '4px 8px',
                                    fontSize: 11,
                                    fontWeight: 600,
                                    background: '#FFFFFF',
                                    color: 'var(--neutral-dark)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 4,
                                    cursor: 'pointer',
                                  }}
                                >
                                  Download
                                </button>
                              </div>
                            ) : (
                              <span style={{ fontSize: 11, color: '#9E9B95' }}>Awaiting</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ) : (
          /* LINK REQUESTS QUEUE */
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
            <div
              style={{
                padding: '10px 14px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#FAF9F6',
              }}
            >
              <div>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>Parent-Student Verification Queue</span>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 8 }}>
                  {linkRequests.length} total verification requests ({pendingRequests.length} pending)
                </span>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              {linkRequests.length === 0 ? (
                <div style={{ padding: '36px 20px', textAlign: 'center' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--neutral-dark)' }}>No student link requests filed yet</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                    When parents enter their child&apos;s admission number in the Parent Portal, their verification requests will appear here for your approval.
                  </div>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle, width: 32 }}>#</th>
                      <th style={thStyle}>Parent Applicant</th>
                      <th style={thStyle}>Requested Student / Ward</th>
                      <th style={thStyle}>Admission Number</th>
                      <th style={thStyle}>Relationship</th>
                      <th style={thStyle}>Status</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linkRequests.map((req, idx) => {
                      const isPending = req.status === 'pending';
                      const isApproved = req.status === 'approved';
                      const isRejected = req.status === 'rejected';

                      return (
                        <tr
                          key={req.id || idx}
                          style={{ background: idx % 2 === 0 ? '#FFFFFF' : '#FAF9F7' }}
                        >
                          <td style={{ ...tdStyle, color: '#9E9B95', fontSize: 10.5 }}>{idx + 1}</td>
                          <td style={tdStyle}>
                            <div style={{ fontWeight: 600, color: 'var(--neutral-dark)' }}>{req.parent_name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{req.parent_email}</div>
                          </td>
                          <td style={tdStyle}>
                            <div style={{ fontWeight: 600, color: '#20554E' }}>{req.student_name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{req.student_grade || 'Student'}</div>
                          </td>
                          <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 11.5, fontWeight: 600 }}>
                            {req.student_admission_number}
                          </td>
                          <td style={{ ...tdStyle, fontSize: 11.5 }}>
                            <div>{req.relationship || 'Parent / Guardian'}</div>
                            {req.notes && (
                              <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: 2 }}>
                                &quot;{req.notes}&quot;
                              </div>
                            )}
                          </td>
                          <td style={tdStyle}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                fontSize: 10,
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                borderRadius: 4,
                                background: isApproved ? '#EAF3EF' : isRejected ? '#FDF1F0' : '#FEF7EC',
                                color: isApproved ? '#2D6E5D' : isRejected ? '#A83B38' : '#9E6C1B',
                                border: isApproved ? '1px solid #C7E4D8' : isRejected ? '1px solid #F5C6CB' : '1px solid #F5DEB3',
                              }}
                            >
                              {req.status}
                            </span>
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {isPending ? (
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                                <button
                                  onClick={() => onApproveLinkRequest && onApproveLinkRequest(req.id)}
                                  style={{
                                    padding: '5px 12px',
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                    background: '#2D2C2A',
                                    color: '#FFFFFF',
                                    border: 'none',
                                    borderRadius: 5,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                  }}
                                >
                                  <Check size={12} /> Approve &amp; Link
                                </button>
                                <button
                                  onClick={() => onRejectLinkRequest && onRejectLinkRequest(req.id)}
                                  style={{
                                    padding: '5px 9px',
                                    fontSize: 11.5,
                                    fontWeight: 600,
                                    background: '#FDF1F0',
                                    color: '#A83B38',
                                    border: '1px solid #F5C6CB',
                                    borderRadius: 5,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                  }}
                                >
                                  <X size={12} /> Reject
                                </button>
                              </div>
                            ) : (
                              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                {isApproved ? 'Linked to Parent' : 'Request Rejected'}
                              </span>
                            )}
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
      </div>
    );
  };

  // ─── TAB: PARENT-STUDENT LINK REQUESTS (VERIFICATION QUEUE) ───────────
  const renderLinkRequests = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Header summary banner */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-color)',
            padding: '20px 24px',
            borderRadius: 10,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 14,
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--neutral-dark)' }}>
                Parent-Student Link Verification Queue
              </h2>
              {pendingLinkRequests.length > 0 && (
                <span
                  style={{
                    background: '#FEF7EC',
                    color: '#B37D4A',
                    border: '1px solid #F3D9A0',
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 12,
                  }}
                >
                  {pendingLinkRequests.length} Pending Approval
                </span>
              )}
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
              Review parent requests to link student accounts. Approving will bind the student to the parent profile and unlock academic monitoring.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onOpenProvisionModal}
              className="btn-primary"
              style={{
                padding: '7px 14px',
                fontSize: 12,
                borderRadius: 6,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              + Create Parent Account
            </button>
          </div>
        </div>

        {/* Link Requests Table */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
          <div
            style={{
              padding: '10px 14px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#FAF9F6',
            }}
          >
            <div>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>All Verification Requests</span>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 8 }}>
                {linkRequests.length} total requests ({pendingLinkRequests.length} pending)
              </span>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            {linkRequests.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: '#EAF3EF', color: '#2C6E6A', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <UserCheck size={24} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--neutral-dark)' }}>No Link Requests in Queue</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, maxWidth: 460, margin: '4px auto 0' }}>
                  When parents submit their child&apos;s admission number in the Parent Portal, their verification requests will appear here for one-click approval.
                </div>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, width: 36 }}>#</th>
                    <th style={thStyle}>Parent Applicant</th>
                    <th style={thStyle}>Requested Student / Ward</th>
                    <th style={thStyle}>Admission Number</th>
                    <th style={thStyle}>Relationship</th>
                    <th style={thStyle}>Status</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {linkRequests.map((req, idx) => {
                    const isPending = req.status === 'pending';
                    const isApproved = req.status === 'approved';
                    const isRejected = req.status === 'rejected';

                    return (
                      <tr key={req.id || idx} style={{ background: isPending ? '#FFFCF5' : idx % 2 === 0 ? '#FFFFFF' : '#FAF9F7' }}>
                        <td style={{ ...tdStyle, color: '#9E9B95', fontSize: 10.5 }}>{idx + 1}</td>
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 700, color: 'var(--neutral-dark)' }}>{req.parent_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{req.parent_email}</div>
                        </td>
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 700, color: '#20554E' }}>{req.student_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{req.student_grade || 'Student'}</div>
                        </td>
                        <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#1A1A1A' }}>
                          {req.student_admission_number}
                        </td>
                        <td style={{ ...tdStyle, fontSize: 12 }}>
                          <div>{req.relationship || 'Parent / Guardian'}</div>
                          {req.notes && (
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: 2 }}>
                              &quot;{req.notes}&quot;
                            </div>
                          )}
                        </td>
                        <td style={tdStyle}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '3px 8px',
                              fontSize: 10,
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              borderRadius: 4,
                              background: isApproved ? '#EAF3EF' : isRejected ? '#FDF1F0' : '#FEF7EC',
                              color: isApproved ? '#2D6E5D' : isRejected ? '#A83B38' : '#9E6C1B',
                              border: isApproved ? '1px solid #C7E4D8' : isRejected ? '1px solid #F5C6CB' : '1px solid #F5DEB3',
                            }}
                          >
                            {req.status}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {isPending ? (
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                              <button
                                onClick={() => onApproveLinkRequest && onApproveLinkRequest(req.id)}
                                style={{
                                  padding: '5px 12px',
                                  fontSize: 11.5,
                                  fontWeight: 700,
                                  background: '#2D2C2A',
                                  color: '#FFFFFF',
                                  border: 'none',
                                  borderRadius: 5,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                <Check size={12} /> Approve &amp; Link
                              </button>
                              <button
                                onClick={() => onRejectLinkRequest && onRejectLinkRequest(req.id)}
                                style={{
                                  padding: '5px 9px',
                                  fontSize: 11.5,
                                  fontWeight: 600,
                                  background: '#FDF1F0',
                                  color: '#A83B38',
                                  border: '1px solid #F5C6CB',
                                  borderRadius: 5,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                <X size={12} /> Reject
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: 11.5, fontWeight: 600, color: isApproved ? '#2D6E5D' : '#A83B38', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              {isApproved ? (<><Check size={12} /> Linked to Parent</>) : 'Rejected'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ─── TAB 5: HOLISTIC HUB ────────────────────────────────────────────────────
  const renderHub = () => (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#FAF9F6',
        }}
      >
        <div>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>Holistic Development Programs</span>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 8 }}>
            {hubActivities.length} published activities
          </span>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        {hubActivities.length === 0 ? (
          <div style={{ padding: '36px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--neutral-dark)' }}>No activities published</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Extracurricular programs created by teachers will be listed here.</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 32 }}>#</th>
                <th style={thStyle}>Activity Title</th>
                <th style={thStyle}>Category</th>
                <th style={thStyle}>Event Date</th>
                <th style={thStyle}>Target Grades</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Enrollment</th>
              </tr>
            </thead>
            <tbody>
              {hubActivities.map((act, idx) => (
                <tr key={act.id} style={{ background: idx % 2 === 0 ? '#FFFFFF' : '#FAF9F7' }}>
                  <td style={{ ...tdStyle, color: '#9E9B95', fontSize: 10.5 }}>{idx + 1}</td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{act.title}</td>
                  <td style={{ ...tdStyle, color: 'var(--text-secondary)', fontSize: 11.5 }}>{act.type}</td>
                  <td style={{ ...tdStyle, color: 'var(--text-secondary)', fontSize: 11.5 }}>{act.date}</td>
                  <td style={{ ...tdStyle, fontSize: 11.5 }}>{(act.target_grades || []).join(', ') || 'All Grades'}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <span
                      style={{
                        padding: '2px 6px',
                        fontSize: 10.5,
                        fontWeight: 700,
                        borderRadius: 4,
                        background: '#EBF3F2',
                        color: '#2C6E6A',
                        border: '1px solid #CBE2DF',
                      }}
                    >
                      {(act.enrolled_student_ids || []).length} / {students.length}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );



  const tabs: { id: AdminTab; label: string; count?: number; isAlert?: boolean }[] = [
    { id: 'overview', label: 'OVERVIEW' },
    { id: 'delegation', label: 'SPECIAL ACCESS & ROLES' },
    { id: 'directory', label: 'USER DIRECTORY', count: profiles.length },
    {
      id: 'link_requests',
      label: 'PARENT LINK REQUESTS',
      count: pendingLinkRequests.length,
      isAlert: pendingLinkRequests.length > 0,
    },
    { id: 'classes', label: 'CLASSES & SECTIONS', count: activeClassList.length },
    { id: 'assessments', label: 'EXAM TERMS & MARKS' },
    { id: 'hub', label: 'HOLISTIC HUB', count: hubActivities.length },
    { id: 'settings', label: 'SETTINGS & PASSWORDS' },
    { id: 'support', label: 'HELP & SUPPORT' },
  ];

  return (
    <div className="app-viewport">
      {/* ADMIN SIDEBAR — original console design */}
      <aside
        style={{
          width: sidebar.isCollapsed ? 64 : 260,
          minWidth: sidebar.isCollapsed ? 64 : 260,
          background: '#FFFFFF',
          borderRight: '1px solid #E8E5DF',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          flexShrink: 0,
          transition: 'width 0.38s cubic-bezier(0.16, 1, 0.3, 1), min-width 0.38s cubic-bezier(0.16, 1, 0.3, 1)',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 15,
        }}
        onMouseEnter={sidebar.handleMouseEnter}
        onMouseLeave={sidebar.handleMouseLeave}
        onDoubleClick={sidebar.togglePin}
      >
        {/* LOGO */}
        <div style={{ padding: '16px 16px 0 16px', flexShrink: 0, overflow: 'hidden' }}>
          <WoodlemLogo collapsed={sidebar.isCollapsed} />
        </div>

        {/* CONSOLE LABEL */}
        {!sidebar.isCollapsed && (
          <div style={{
            padding: '10px 16px 12px',
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: '#8C8A84',
            textTransform: 'uppercase',
            borderBottom: '1px solid #E8E5DF',
            flexShrink: 0,
          }}>
            Admin Management Console
          </div>
        )}

        {/* PROFILE CARD */}
        {sidebar.isCollapsed ? (
          <div style={{ padding: '12px 0 6px', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
            <div
              title={`Administrator • ${currentUser.name || 'Admin'}`}
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
              {(currentUser.name || 'A').charAt(0).toUpperCase()}
            </div>
          </div>
        ) : (
          <div style={{
            margin: '12px 12px 0',
            border: '1px solid #E8E5DF',
            borderRadius: 8,
            padding: '10px 12px',
            background: '#FAF9F6',
            flexShrink: 0,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A', marginBottom: 2 }}>
              {currentUser.name || 'Admin'}
            </div>
            <div style={{ fontSize: 11, color: '#6B6963', marginBottom: 8 }}>
              {currentUser.email || 'admin@woodlempark.ae'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.06em',
                background: '#1A1A1A',
                color: '#FFFFFF',
                padding: '3px 8px',
                borderRadius: 4,
                textTransform: 'uppercase',
              }}>
                Administrator
              </span>
            </div>
          </div>
        )}

        {/* NAVIGATION SECTION HEADER */}
        <div style={{ padding: sidebar.isCollapsed ? '8px 0 0' : '16px 0 0', flexShrink: 0 }}>
          {!sidebar.isCollapsed && (
            <div style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: '#9E9A94',
              padding: '0 16px 6px',
              textTransform: 'uppercase',
            }}>
              Navigation
            </div>
          )}
        </div>

        {/* NAV ITEMS */}
        <nav style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: sidebar.isCollapsed ? '0 8px' : '0 8px',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(0,0,0,0.1) transparent',
        }}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;

            const getIcon = () => {
              switch (tab.id) {
                case 'overview': return <LayoutDashboard size={16} />;
                case 'delegation': return <ShieldCheck size={16} />;
                case 'directory': return <Users size={16} />;
                case 'link_requests': return <UserCheck size={16} />;
                case 'classes': return <BookOpen size={16} />;
                case 'assessments': return <FileSpreadsheet size={16} />;
                case 'hub': return <Award size={16} />;
                case 'settings': return <Settings size={16} />;
                case 'support': return <LifeBuoy size={16} />;

              }
            };

            return (
              <div key={tab.id} style={{ position: 'relative' }}>
                <button
                  onClick={() => { setActiveTab(tab.id); setSelectedUserForEdit(null); sidebar.handleNavClick(); }}
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
                    textAlign: 'left' as const,
                    transition: 'all 0.12s ease',
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#F3F2EF'; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                  title={sidebar.isCollapsed ? tab.label : undefined}
                >
                  {sidebar.isCollapsed ? (
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isActive ? '#FFFFFF' : '#5A5854',
                      }}>
                        {getIcon()}
                      </span>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <span style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: isActive ? '#FFFFFF' : '#6B6963',
                          flexShrink: 0,
                        }}>
                          {getIcon()}
                        </span>
                        <span style={{
                          fontSize: 11.5,
                          fontWeight: isActive ? 700 : 600,
                          letterSpacing: '0.04em',
                          color: isActive ? '#FFFFFF' : '#3A3834',
                          textTransform: 'uppercase',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {tab.label}
                        </span>
                      </div>
                    </>
                  )}
                </button>
                {sidebar.isCollapsed && (
                  <div className="sidebar-tooltip">
                    {tab.label}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* SIGN OUT FOOTER */}
        <div style={{
          padding: sidebar.isCollapsed ? '8px 0 12px' : '8px 12px 16px',
          borderTop: '1px solid #E8E5DF',
          flexShrink: 0,
          display: 'flex',
          justifyContent: sidebar.isCollapsed ? 'center' : 'stretch',
        }}>
          <div style={{ position: 'relative', width: sidebar.isCollapsed ? 'auto' : '100%' }}>
            <button
              onClick={onSignOut}
              title="Sign Out"
              style={{
                width: sidebar.isCollapsed ? 40 : '100%',
                height: sidebar.isCollapsed ? 40 : 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: sidebar.isCollapsed ? 'center' : 'center',
                gap: 6,
                background: sidebar.isCollapsed ? 'transparent' : '#FEF2F2',
                border: sidebar.isCollapsed ? 'none' : '1px solid #FECACA',
                borderRadius: 7,
                padding: sidebar.isCollapsed ? 0 : '9px 0',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                color: '#DC2626',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = sidebar.isCollapsed ? '#FEF2F2' : '#FEE2E2')}
              onMouseLeave={e => (e.currentTarget.style.background = sidebar.isCollapsed ? 'transparent' : '#FEF2F2')}
            >
              <LogOut size={14} />
              {!sidebar.isCollapsed && <span>Sign Out</span>}
            </button>
            {sidebar.isCollapsed && (
              <div className="sidebar-tooltip">Sign Out</div>
            )}
          </div>
        </div>

        {/* FEEDBACK TOAST */}
        {sidebar.feedbackToast && (
          <div className="sidebar-feedback-toast">
            {sidebar.feedbackToast}
          </div>
        )}
      </aside>

      {/* MAIN VIEWPORT */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {/* Compact Top Header Bar */}
        <header
          style={{
            height: 38,
            minHeight: 38,
            background: '#FFFFFF',
            borderBottom: '1px solid var(--border-color)',
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--neutral-dark)' }}>
              {tabs.find((t) => t.id === activeTab)?.label}
              {selectedUserForEdit ? ` / EDIT USER: ${selectedUserForEdit.name}` : ''}
            </span>
          </div>


        </header>

        {/* Scrollable Viewport Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
          {selectedUserForEdit ? (() => {
            const activeUser = profiles.find(
              (p) =>
                (selectedUserForEdit.id && p.id === selectedUserForEdit.id) ||
                (p.email && selectedUserForEdit.email && p.email.toLowerCase().trim() === selectedUserForEdit.email.toLowerCase().trim())
            ) || selectedUserForEdit;

            return (
              <UserDetailView
                user={activeUser}
                profiles={profiles}
                parentDocuments={parentDocuments}
                subjectClasses={subjectClasses}
                onBack={() => setSelectedUserForEdit(null)}
                onSave={async (updated) => {
                  if (onUpdateUser) {
                    await onUpdateUser(updated);
                  } else {
                    onEditUser(updated);
                  }
                  setSelectedUserForEdit(updated);
                }}
                onDelete={(userId) => {
                  onDeleteUser(userId);
                  setSelectedUserForEdit(null);
                }}
              />
            );
          })() : (
            <>
              {activeTab === 'overview' && renderOverview()}
              {activeTab === 'delegation' && (
                <SpecialAccessView
                  currentUser={currentUser}
                  profiles={profiles}
                  subjectClasses={subjectClasses}
                  onRefreshData={onRefreshData}
                />
              )}
              {activeTab === 'directory' && renderUserDirectory()}
              {activeTab === 'link_requests' && renderLinkRequests()}
              {activeTab === 'classes' && renderClasses()}
              {activeTab === 'assessments' && (
                <AdminAssessmentTermsView
                  currentUser={currentUser}
                  profiles={profiles}
                  subjectClasses={subjectClasses}
                  onOpenMarkRegister={(cls) => setActiveMarkEntryClass(cls)}
                />
              )}
              {activeTab === 'hub' && renderHub()}
              {activeTab === 'settings' && (
                <SettingsView currentUser={currentUser} profiles={profiles} onRefreshData={onRefreshData} />
              )}
              {activeTab === 'support' && (
                <SupportView currentUser={currentUser} />
              )}

            </>
          )}
        </div>
      </main>

      {activeMarkEntryClass && (
        <MarkEntryModal
          isOpen={true}
          onClose={() => setActiveMarkEntryClass(null)}
          classRoom={activeMarkEntryClass}
          teacher={currentUser}
          profiles={profiles}
        />
      )}
    </div>
  );
};
