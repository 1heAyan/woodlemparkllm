'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, LayoutDashboard, Users, BookOpen, FileText, Settings, LifeBuoy, Server, LogOut, Pin, PinOff, Check, UserCheck, Clock, CheckCircle2, XCircle, Zap, X, FileSpreadsheet, ShieldCheck, Crown, Lock, Download, Building, Trash2, Plus, Search, AlertTriangle } from 'lucide-react';
import { WoodlemLogo } from '@/components/Shared/WoodlemLogo';
import { useSidebarState } from '@/lib/useSidebarState';
import { supabase, UserProfile, ParentDocument, HubActivity, SubjectClass, TestItem, SyllabusTerm, LateEntryRecord, OfflineAssessment, OfflineAssessmentMark, SpecialRoleAssignment } from '@/lib/supabaseClient';
import { CustomSelect } from '@/components/UI/CustomSelect';
import { SegmentedControl } from '@/components/UI/SegmentedControl';
import { SettingsView } from '@/components/Shared/SettingsView';
import { SupportView } from '@/components/Shared/SupportView';
import { SpecialAccessView } from '@/components/Admin/SpecialAccessView';
import { UserDetailView } from '@/components/Admin/UserDetailView';
import { AdminAssessmentTermsView } from '@/components/Admin/AdminAssessmentTermsView';
import { LateEntryView } from '@/components/Shared/LateEntryView';
import { formatShortFileName, openFileInNewTab, downloadFile } from '@/lib/fileHelper';
import { usePortalNavigation } from '@/lib/PortalNavigationContext';
import { extractClassTeacherInfo } from '@/lib/classTeacherHelper';
import { isPrincipalUser, isSltUser, loadSpecialRoleAssignments } from '@/lib/specialRolesHelper';
import { sanitizeUserCode, normalizeAdmissionNumber, normalizeStudentName, isMatchingStudent } from '@/lib/userCodeHelper';
import { computeExecutiveAnalytics, isSubjectClassInGrade } from '@/lib/analyticsHelper';
import {
  ScoreDistributionChart,
  SubjectComparisonChart,
  AttendanceTrendChart,
  RecentRegistersTable,
} from '@/components/UI/AnalyticsCharts';
import { MarkEntryModal } from '../Modals/MarkEntryModal';
import { TestResultRecord } from '../Modals/ReviewTestResultsModal';
import { MergeDuplicatesModal, DuplicateGroup } from '../Modals/MergeDuplicatesModal';
import { ExportAttendanceModal } from '../Modals/ExportAttendanceModal';

interface AdminDashboardProps {
  currentUser: UserProfile;
  profiles: UserProfile[];
  parentDocuments: ParentDocument[];
  hubActivities: HubActivity[];
  subjectClasses: SubjectClass[];
  tests?: TestItem[];
  syllabus?: SyllabusTerm[];
  attendance?: Record<string, Record<string, string>>;
  testResults?: Record<string, TestResultRecord>;
  offlineAssessments?: OfflineAssessment[];
  offlineMarks?: OfflineAssessmentMark[];
  lateEntries?: LateEntryRecord[];
  onOpenProvisionModal: () => void;
  onOpenBulkModal: () => void;
  onOpenCreateSubjectClassModal?: (preset?: { grade?: string; section?: string; lockSection?: boolean }) => void;
  onEditUser: (user: UserProfile) => void;
  onUpdateUser?: (updatedUser: UserProfile) => Promise<void> | void;
  onDeleteUser: (userId: string) => void;
  onBatchDeactivateUsers?: (userIds: string[], deactivate: boolean) => Promise<void> | void;
  onBatchDeleteUsers?: (userIds: string[]) => Promise<void> | void;
  onDeleteSubjectClass?: (classId: string) => Promise<void> | void;
  onSignOut: () => void;
  onRefreshData?: () => void;
}

type AdminTab = 'overview' | 'delegation' | 'directory' | 'classes' | 'assessments' | 'late_entry' | 'settings' | 'support';

const VALID_GRADES = ['9', '10', '11', '12'] as const;
const BASE_SECTIONS = ['A', 'B', 'C', 'D'] as const;

// Styled tooltip that renders through a portal to document.body so it is never
// clipped by table cells or scroll containers.
const HoverTooltip: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => {
  const [tip, setTip] = useState<{ top: number; left: number; below: boolean } | null>(null);

  const showTip = (e: React.MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const tipWidth = Math.min(260, Math.max(90, label.length * 6.4 + 20));
    const below = r.bottom + 38 <= window.innerHeight;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - tipWidth - 8));
    const top = below ? r.bottom + 8 : r.top - 8;
    setTip({ top, left, below });
  };

  return (
    <span
      onMouseEnter={showTip}
      onMouseLeave={() => setTip(null)}
      style={{ display: 'inline-block', maxWidth: '100%' }}
    >
      {children}
      {tip &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              top: tip.top,
              left: tip.left,
              maxWidth: 260,
              transform: tip.below ? undefined : 'translateY(-100%)',
              zIndex: 9999,
              background: '#2D2C2A',
              color: '#FFFFFF',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.03em',
              padding: '5px 10px',
              borderRadius: 6,
              boxShadow: '0 6px 16px rgba(0,0,0,0.22)',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </div>,
          document.body
        )}
    </span>
  );
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  profiles,
  parentDocuments,
  hubActivities,
  subjectClasses = [],
  tests = [],
  syllabus = [],
  attendance = {},
  testResults = {},
  offlineAssessments = [],
  offlineMarks = [],
  lateEntries = [],
  onOpenProvisionModal,
  onOpenBulkModal,
  onOpenCreateSubjectClassModal,
  onEditUser,
  onUpdateUser,
  onDeleteUser,
  onBatchDeactivateUsers,
  onBatchDeleteUsers,
  onDeleteSubjectClass,
  onSignOut,
  onRefreshData,
}) => {
  const isPrincipal = isPrincipalUser(currentUser);
  const isSlt = !isPrincipal && isSltUser(currentUser);
  const isAdmin = !isPrincipal && !isSlt && (currentUser.role === 'admin' || (currentUser.email || '').toLowerCase().startsWith('admin@'));
  const canManageSpecialRoles = isPrincipal || isAdmin;

  const [sltAssignment, setSltAssignment] = useState<SpecialRoleAssignment | null>(null);
  const [sltPermissions, setSltPermissions] = useState<{
    canViewAnalytics?: boolean;
    canExportStatements?: boolean;
    canManageHub?: boolean;
    canManageSettings?: boolean;
    canResetPasswords?: boolean;
    canAuditMarks?: boolean;
    canReleaseMarks?: boolean;
    canEditMarksRegisters?: boolean;
    canManageExamTerms?: boolean;
    canVerifySyllabus?: boolean;
    canManageLateEntries?: boolean;
    canManageAttendance?: boolean;
    canApproveLeaveRequests?: boolean;
    canLogBehaviorIncidents?: boolean;
    canViewDisciplineRecords?: boolean;
    canViewDirectory?: boolean;
    canEditStudentProfiles?: boolean;
    canManageClasses?: boolean;
    canAssignTeachers?: boolean;
    canBroadcastAnnouncements?: boolean;
  }>({
    canViewAnalytics: true,
    canExportStatements: true,
    canManageHub: true,
    canManageSettings: false,
    canResetPasswords: true,
    canAuditMarks: true,
    canReleaseMarks: true,
    canEditMarksRegisters: true,
    canManageExamTerms: true,
    canVerifySyllabus: true,
    canManageLateEntries: true,
    canManageAttendance: true,
    canApproveLeaveRequests: true,
    canLogBehaviorIncidents: true,
    canViewDisciplineRecords: true,
    canViewDirectory: true,
    canEditStudentProfiles: true,
    canManageClasses: true,
    canAssignTeachers: true,
    canBroadcastAnnouncements: true,
  });

  const [sltScope, setSltScope] = useState<{
    scopeType: 'all' | 'custom';
    managedGrades: string[];
    managedSections: string[];
  }>({
    scopeType: 'all',
    managedGrades: ['9', '10', '11', '12'],
    managedSections: [],
  });

  useEffect(() => {
    if (isSlt) {
      loadSpecialRoleAssignments(profiles).then((list) => {
        const myAssignment = list.find(
          (a) => a.roleType === 'slt' && (a.userId === currentUser.id || a.userEmail?.toLowerCase() === (currentUser.email || '').toLowerCase())
        );
        if (myAssignment) {
          setSltAssignment(myAssignment);
          if (myAssignment.permissions) {
            setSltPermissions({
              ...myAssignment.permissions,
            });
          }
          const scopeType =
            myAssignment.scopeType ||
            (myAssignment.managedGrades &&
            myAssignment.managedGrades.length > 0 &&
            myAssignment.managedGrades.length < 4
              ? 'custom'
              : 'all');
          const managedGrades =
            myAssignment.managedGrades && myAssignment.managedGrades.length > 0
              ? myAssignment.managedGrades
              : ['9', '10', '11', '12'];
          const managedSections = myAssignment.managedSections || [];
          setSltScope({
            scopeType,
            managedGrades,
            managedSections,
          });
        }
      });
    }
  }, [isSlt, currentUser, profiles]);

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [roleFilter, setRoleFilter] = useState<'all' | 'student' | 'teacher' | 'parent' | 'admin' | 'principal' | 'deactivated'>('all');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 50;

  const [selectedClassInspect, setSelectedClassInspect] = useState<string | null>(null);
  const [classInspectStudentSearch, setClassInspectStudentSearch] = useState('');
  const [classInspectSubjectSearch, setClassInspectSubjectSearch] = useState('');
  const [deletingSubjectClass, setDeletingSubjectClass] = useState<SubjectClass | null>(null);
  const [isDeletingClassLoading, setIsDeletingClassLoading] = useState(false);
  const [classTeacherUpdateStatus, setClassTeacherUpdateStatus] = useState<string | null>(null);

  const handleConfirmDeleteSubjectClass = async () => {
    if (!deletingSubjectClass) return;
    setIsDeletingClassLoading(true);
    try {
      if (onDeleteSubjectClass) {
        await onDeleteSubjectClass(deletingSubjectClass.id);
      } else {
        await supabase.from('offline_assessments').delete().eq('class_id', deletingSubjectClass.id);
        await supabase.from('class_resources').delete().eq('class_id', deletingSubjectClass.id);
        await supabase.from('class_broadcasts').delete().eq('class_id', deletingSubjectClass.id);
        await supabase.from('subject_classes').delete().eq('id', deletingSubjectClass.id);
        if (onRefreshData) onRefreshData();
      }
      setDeletingSubjectClass(null);
    } catch (err) {
      console.error('Failed to delete subject class:', err);
      alert('Failed to delete subject class. Please check your connection or try again.');
    } finally {
      setIsDeletingClassLoading(false);
    }
  };

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<UserProfile | null>(null);
  const [activeMarkEntryClass, setActiveMarkEntryClass] = useState<SubjectClass | null>(null);
  const [createdSections, setCreatedSections] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem('woodlem_created_sections_v1');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [isCreateSectionOpen, setIsCreateSectionOpen] = useState(false);
  const [newSectionGrade, setNewSectionGrade] = useState('10');
  const [newSectionLetter, setNewSectionLetter] = useState('A');
  const [newSectionTeacherId, setNewSectionTeacherId] = useState('');
  const [dirScroll, setDirScroll] = useState<{ left: boolean; right: boolean }>({ left: false, right: false });
  const [isExportAttendanceModalOpen, setIsExportAttendanceModalOpen] = useState(false);
  const dirScrollRef = useRef<HTMLDivElement | null>(null);

  // Reset pagination and selection whenever filters or search change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedUserIds(new Set());
  }, [roleFilter, classFilter, searchQuery]);

  const handleDirScroll = useCallback((el: HTMLDivElement) => {
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setDirScroll({
      left: scrollLeft > 2,
      right: scrollLeft < scrollWidth - clientWidth - 2,
    });
  }, []);

  const sidebar = useSidebarState(currentUser?.id || currentUser?.email || 'admin');

  const handleInitiateEditUser = (u: UserProfile) => {
    setSelectedUserForEdit(u);
  };

  const [overviewGradeFilter, setOverviewGradeFilter] = useState<string>('all');
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [isMerging, setIsMerging] = useState(false);

  // Intelligent Duplicate Detection for existing student accounts in the database
  const duplicateGroups = useMemo<DuplicateGroup[]>(() => {
    const studentProfiles = profiles.filter((p) => p.role === 'student');
    const groupsMap = new Map<string, UserProfile[]>();

    studentProfiles.forEach((p) => {
      const normName = normalizeStudentName(p.name);
      const gradeClean = (p.grade || '').replace(/[^0-9]/g, '') || '10';
      if (!normName) return;
      const key = `${normName}_${gradeClean}`;
      const arr = groupsMap.get(key) || [];
      arr.push(p);
      groupsMap.set(key, arr);
    });

    const result: DuplicateGroup[] = [];
    groupsMap.forEach((group, key) => {
      if (group.length > 1) {
        // Sort to determine genuine primary profile:
        // Prefer profiles with real admission numbers (not fake sequential 11xx numbers unless all are)
        const sorted = [...group].sort((a, b) => {
          const aCode = sanitizeUserCode(a.admission_number || a.user_code, a.email);
          const bCode = sanitizeUserCode(b.admission_number || b.user_code, b.email);

          const aIsFakeSeq = /^11[0-9]{2}$/.test(aCode) && !a.email.includes(aCode);
          const bIsFakeSeq = /^11[0-9]{2}$/.test(bCode) && !b.email.includes(bCode);
          if (aIsFakeSeq && !bIsFakeSeq) return 1;
          if (!aIsFakeSeq && bIsFakeSeq) return -1;

          return (a.created_at || '').localeCompare(b.created_at || '');
        });

        const primaryProfile = sorted[0];
        const duplicateProfiles = sorted.slice(1);
        result.push({
          key,
          studentName: primaryProfile.name,
          grade: primaryProfile.grade || '10',
          classLetter: primaryProfile.class_letter || undefined,
          primaryProfile,
          duplicateProfiles,
        });
      }
    });

    return result;
  }, [profiles]);

  const handleMergeGroup = async (group: DuplicateGroup) => {
    try {
      setIsMerging(true);
      const primaryId = group.primaryProfile.id;
      const dupIds = group.duplicateProfiles.map((p) => p.id);

      // 1. Re-link subject classes
      for (const sc of subjectClasses) {
        const enrolled = sc.enrolled_student_ids || [];
        const hasDup = dupIds.some((dId) => enrolled.includes(dId));
        if (hasDup) {
          const updatedEnrolled = Array.from(
            new Set(
              enrolled.map((id) => (dupIds.includes(id) ? primaryId : id))
            )
          );
          await supabase
            .from('subject_classes')
            .update({ enrolled_student_ids: updatedEnrolled })
            .eq('id', sc.id);
        }
      }

      // 2. Delete redundant duplicate profiles
      for (const dup of group.duplicateProfiles) {
        onDeleteUser(dup.id);
      }

      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      console.error('Merge error:', err);
      alert('Error merging duplicate accounts.');
    } finally {
      setIsMerging(false);
    }
  };

  const handleMergeAllDuplicates = async () => {
    if (
      !confirm(
        `Are you sure you want to merge all ${duplicateGroups.length} duplicate student group(s)? Genuine admission numbers and all class enrollments will be preserved.`
      )
    ) {
      return;
    }
    try {
      setIsMerging(true);
      for (const group of duplicateGroups) {
        const primaryId = group.primaryProfile.id;
        const dupIds = group.duplicateProfiles.map((p) => p.id);

        for (const sc of subjectClasses) {
          const enrolled = sc.enrolled_student_ids || [];
          const hasDup = dupIds.some((dId) => enrolled.includes(dId));
          if (hasDup) {
            const updatedEnrolled = Array.from(
              new Set(
                enrolled.map((id) => (dupIds.includes(id) ? primaryId : id))
              )
            );
            await supabase
              .from('subject_classes')
              .update({ enrolled_student_ids: updatedEnrolled })
              .eq('id', sc.id);
          }
        }

        for (const dup of group.duplicateProfiles) {
          onDeleteUser(dup.id);
        }
      }

      setIsMergeModalOpen(false);
      alert(`Successfully merged all ${duplicateGroups.length} duplicate student accounts!`);
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      console.error('Bulk merge error:', err);
      alert('Error during duplicate merge.');
    } finally {
      setIsMerging(false);
    }
  };

  // Grouped profiles with jurisdictional scoping for SLT
  const students = useMemo(() => {
    let list = profiles.filter((p) => p.role === 'student');
    if (isSlt && sltScope.scopeType === 'custom') {
      list = list.filter((st) => {
        const g = (st.grade || '').replace(/[^0-9]/g, '');
        if (!sltScope.managedGrades.includes(g)) return false;
        if (sltScope.managedSections.length > 0) {
          const s = (st.class_letter || '').toUpperCase().trim();
          return sltScope.managedSections.includes(`${g}-${s}`);
        }
        return true;
      });
    }
    return list;
  }, [profiles, isSlt, sltScope]);

  const teachers = useMemo(() => {
    let list = profiles.filter((p) => p.role === 'teacher');
    if (isSlt && sltScope.scopeType === 'custom') {
      list = list.filter((t) => {
        const info = extractClassTeacherInfo(t, subjectClasses);
        if (info.isClassTeacher && info.classKey) {
          const [tg] = info.classKey.split('-');
          if (sltScope.managedGrades.includes(tg)) {
            if (sltScope.managedSections.length === 0 || sltScope.managedSections.includes(info.classKey)) return true;
          }
        }
        const teachesInScope = (subjectClasses || []).some((sc) => {
          if (sc.teacher_id === t.id) {
            const g = (sc.class_name || sc.name || '').replace(/[^0-9]/g, '');
            if (sltScope.managedGrades.includes(g)) {
              if (sltScope.managedSections.length === 0) return true;
              if (sc.section && sltScope.managedSections.includes(`${g}-${sc.section.trim().toUpperCase()}`)) return true;
            }
          }
          return false;
        });
        return teachesInScope;
      });
    }
    return list;
  }, [profiles, isSlt, sltScope, subjectClasses]);

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

    // Add explicitly created sections
    createdSections.forEach((s) => classSet.add(s));

    const sorted = Array.from(classSet).sort((a, b) => {
      const [ga, sa] = a.split('-');
      const [gb, sb] = b.split('-');
      if (parseInt(ga) !== parseInt(gb)) return parseInt(ga) - parseInt(gb);
      return sa.localeCompare(sb);
    });

    if (isSlt && sltScope.scopeType === 'custom') {
      return sorted.filter((cls) => {
        const [g] = cls.split('-');
        if (!sltScope.managedGrades.includes(g)) return false;
        if (sltScope.managedSections.length > 0) {
          return sltScope.managedSections.includes(cls);
        }
        return true;
      });
    }

    return sorted;
  }, [students, teachers, subjectClasses, createdSections, isSlt, sltScope]);

  // ─── GLOBAL GRADE FILTER DATA FOR OVERVIEW DASHBOARD ───────────────────
  const overviewStudents = useMemo(() => {
    if (overviewGradeFilter === 'all') return students;
    return students.filter(
      (st) => (st.grade || '').replace(/[^0-9]/g, '') === overviewGradeFilter
    );
  }, [students, overviewGradeFilter]);

  const overviewActiveClassList = useMemo(() => {
    if (overviewGradeFilter === 'all') return activeClassList;
    return activeClassList.filter((c) => c.startsWith(`${overviewGradeFilter}-`) || c === overviewGradeFilter);
  }, [activeClassList, overviewGradeFilter]);

  const overviewSubjectClasses = useMemo(() => {
    let base = subjectClasses;
    if (isSlt && sltScope.scopeType === 'custom') {
      base = base.filter((sc) => {
        const g = (sc.class_name || sc.name || '').replace(/[^0-9]/g, '');
        if (g && !sltScope.managedGrades.includes(g)) return false;
        if (sltScope.managedSections.length > 0 && sc.section) {
          return sltScope.managedSections.includes(`${g}-${sc.section.trim().toUpperCase()}`);
        }
        return true;
      });
    }
    if (overviewGradeFilter === 'all') return base;
    return base.filter((sc) => isSubjectClassInGrade(sc, overviewGradeFilter, profiles));
  }, [subjectClasses, overviewGradeFilter, profiles, isSlt, sltScope]);

  const overviewTeachers = useMemo(() => {
    if (overviewGradeFilter === 'all') return teachers;
    const gradeClassNames = new Set(overviewSubjectClasses.map((sc) => (sc.name || sc.class_name || '').toLowerCase()));
    const gradeTeacherIds = new Set(overviewSubjectClasses.map((sc) => sc.teacher_id).filter(Boolean));
    const gradeTeacherNames = new Set(overviewSubjectClasses.map((sc) => sc.teacher_name?.toLowerCase()).filter(Boolean));

    return teachers.filter((t) => {
      const assigned = (t.assigned_class || '').replace(/[^0-9]/g, '');
      if (assigned === overviewGradeFilter || (t.assigned_class || '').includes(`${overviewGradeFilter}-`)) {
        return true;
      }
      if (gradeTeacherIds.has(t.id)) return true;
      if (t.name && gradeTeacherNames.has(t.name.toLowerCase())) return true;
      if (t.assigned_class && gradeClassNames.has(t.assigned_class.toLowerCase())) return true;
      return false;
    });
  }, [teachers, overviewGradeFilter, overviewSubjectClasses]);

  const overviewParents = useMemo(() => {
    if (overviewGradeFilter === 'all') return parents;
    const studentIdsInGrade = new Set(overviewStudents.map((s) => s.id));
    const studentAdmInGrade = new Set(
      overviewStudents.map((s) => sanitizeUserCode(s.admission_number || s.user_code, s.email)).filter(Boolean)
    );

    return parents.filter((p) => {
      const pGrade = (p.grade || '').replace(/[^0-9]/g, '');
      if (pGrade === overviewGradeFilter) return true;
      if (p.linked_student_ids && p.linked_student_ids.some((cId: string) => studentIdsInGrade.has(cId))) return true;
      const pAdm = sanitizeUserCode(p.admission_number || p.user_code, p.email);
      if (pAdm && studentAdmInGrade.has(pAdm)) return true;
      return false;
    });
  }, [parents, overviewGradeFilter, overviewStudents]);

  const overviewProfiles = useMemo(() => {
    if (overviewGradeFilter === 'all') return profiles.filter((p) => !p.is_deactivated);
    return [...overviewStudents, ...overviewTeachers, ...overviewParents].filter((p) => !p.is_deactivated);
  }, [overviewGradeFilter, profiles, overviewStudents, overviewTeachers, overviewParents]);

  // Live listener for marks update
  useEffect(() => {
    const handleUpdate = () => {
      onRefreshData?.();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('woodlem-marks-updated', handleUpdate);
      return () => window.removeEventListener('woodlem-marks-updated', handleUpdate);
    }
  }, [onRefreshData]);

  const overviewAnalytics = useMemo(() => {
    return computeExecutiveAnalytics({
      profiles: overviewProfiles,
      subjectClasses: overviewSubjectClasses,
      tests: tests || [],
      syllabus: syllabus || [],
      attendance: attendance || {},
      testResults: testResults || {},
      offlineAssessments: offlineAssessments || [],
      offlineMarks: offlineMarks || [],
      selectedGradeFilter: overviewGradeFilter,
    });
  }, [overviewProfiles, overviewSubjectClasses, tests, syllabus, attendance, testResults, offlineAssessments, offlineMarks, overviewGradeFilter]);

  // Compute score distribution DIRECTLY from raw marks and test results
  const directScoreDistribution = useMemo(() => {
    const assessmentMap = new Map<string, number>();
    (offlineAssessments || []).forEach((a) => {
      const max = Number(a.maximum_marks);
      if (Number.isFinite(max) && max > 0) {
        assessmentMap.set(a.id, max);
      }
    });

    const counts = { ap: 0, a: 0, b: 0, c: 0, d: 0, f: 0 };
    let total = 0;
    let scoreSum = 0;

    // 1. Process offline assessment marks
    (offlineMarks || []).forEach((m) => {
      if (!m || m.marks === null || m.marks === undefined || (m.marks as any) === '') return;
      const numMarks = Number(m.marks);
      if (!Number.isFinite(numMarks)) return;

      if (overviewGradeFilter !== 'all') {
        const student = profiles.find((p) => p.id === m.student_id);
        if (student) {
          const cleanG = (student.grade || '').replace(/[^0-9]/g, '');
          if (cleanG && cleanG !== overviewGradeFilter) return;
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

    // 2. Also incorporate online testResults if any
    if (testResults && Object.keys(testResults).length > 0) {
      Object.values(testResults).forEach((tr: any) => {
        if (!tr || tr.score === null || tr.score === undefined || (tr.score as any) === '') return;
        const s = typeof tr.score === 'number' ? tr.score : Number(tr.score);
        if (!Number.isFinite(s)) return;

        if (overviewGradeFilter !== 'all') {
          const student = profiles.find((p) => p.id === tr.student_id);
          if (student) {
            const cleanG = (student.grade || '').replace(/[^0-9]/g, '');
            if (cleanG && cleanG !== overviewGradeFilter) return;
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
  }, [offlineMarks, offlineAssessments, testResults, overviewGradeFilter, profiles]);

  // Portal Navigation & AI Copilot Integration
  const { isAiPanelOpen, toggleAiPanel, subscribeToNavigation } = usePortalNavigation();

  React.useEffect(() => {
    const unsubscribe = subscribeToNavigation((target) => {
      setActiveMarkEntryClass(null);
      if (target.view === 'overview') {
        setActiveTab('overview');
      } else if (target.view === 'directory' || target.view === 'users') {
        setActiveTab('directory');
      } else if (target.view === 'classes' || target.view === 'sections') {
        setActiveTab('classes');
      } else if (target.view === 'assessments' || target.view === 'exams' || target.view === 'terms' || target.view === 'marks') {
        setActiveTab('assessments');
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

  // Deactivated accounts count
  const deactivatedCount = useMemo(() => profiles.filter((p) => p.is_deactivated).length, [profiles]);

  // Filtered profiles for User Directory
  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      // Strict Jurisdictional Scoping for SLT
      if (isSlt && sltScope.scopeType === 'custom') {
        if (p.role === 'student') {
          const cleanG = (p.grade || '').replace(/[^0-9]/g, '');
          if (!sltScope.managedGrades.includes(cleanG)) return false;
          if (sltScope.managedSections.length > 0) {
            const cleanS = (p.class_letter || '').toUpperCase().trim();
            if (!sltScope.managedSections.includes(`${cleanG}-${cleanS}`)) return false;
          }
        }
      }

      // Deactivated category filtering
      if (roleFilter === 'deactivated') {
        if (!p.is_deactivated) return false;
      } else {
        if (p.is_deactivated) return false;

        // Role filter for active accounts
        if (roleFilter !== 'all') {
          if (roleFilter === 'principal') {
            const isExec = p.role === 'principal' || isPrincipalUser(p) || isSltUser(p) || p.special_role === 'slt';
            if (!isExec) return false;
          } else if (roleFilter === 'admin') {
            if (p.role !== 'admin' || isPrincipalUser(p) || isSltUser(p)) return false;
          } else if (p.role !== roleFilter) {
            return false;
          }
        }
      }

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

      // Search query across all accounts
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
  }, [profiles, roleFilter, classFilter, searchQuery, subjectClasses, isSlt, sltScope]);

  // Pagination calculation (50 records per page)
  const totalPages = Math.ceil(filteredProfiles.length / pageSize) || 1;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedProfiles = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredProfiles.slice(start, start + pageSize);
  }, [filteredProfiles, safeCurrentPage, pageSize]);

  // Selection helpers
  const isAllCurrentPageSelected = useMemo(() => {
    if (paginatedProfiles.length === 0) return false;
    return paginatedProfiles.every((p) => selectedUserIds.has(p.id));
  }, [paginatedProfiles, selectedUserIds]);

  const toggleSelectAllCurrentPage = () => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (isAllCurrentPageSelected) {
        paginatedProfiles.forEach((p) => next.delete(p.id));
      } else {
        paginatedProfiles.forEach((p) => next.add(p.id));
      }
      return next;
    });
  };

  const toggleSelectUser = (id: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Batch action handlers
  const handleBatchDeactivate = async (deactivate: boolean) => {
    if (selectedUserIds.size === 0) return;
    const count = selectedUserIds.size;
    const actionWord = deactivate ? 'deactivate' : 'reactivate';
    if (!confirm(`Are you sure you want to ${actionWord} ${count} selected account${count > 1 ? 's' : ''}?`)) {
      return;
    }
    if (onBatchDeactivateUsers) {
      await onBatchDeactivateUsers(Array.from(selectedUserIds), deactivate);
      setSelectedUserIds(new Set());
    }
  };

  const handleBatchDelete = async () => {
    if (selectedUserIds.size === 0) return;
    const count = selectedUserIds.size;
    if (!confirm(`WARNING: Are you sure you want to permanently delete ${count} selected account${count > 1 ? 's' : ''}? This action cannot be undone.`)) {
      return;
    }
    if (onBatchDeleteUsers) {
      await onBatchDeleteUsers(Array.from(selectedUserIds));
      setSelectedUserIds(new Set());
    }
  };

  useEffect(() => {
    const el = dirScrollRef.current;
    if (el && filteredProfiles.length > 0) handleDirScroll(el);
    else setDirScroll({ left: false, right: false });
  }, [handleDirScroll, filteredProfiles.length]);

  // Clean identifier formatter
  const formatUserAssignment = (p: UserProfile) => {
    if (p.role === 'student') {
      const cleanG = (p.grade || '').replace(/[^0-9]/g, '') || '10';
      const cleanS = (p.class_letter || 'A').toUpperCase().trim();
      const subList = p.enrolled_subjects || (p.subject ? p.subject.split(',').map((s) => s.trim()).filter(Boolean) : []);
      const subHint = subList.length > 0 ? ` • ${subList.length} Subject${subList.length > 1 ? 's' : ''}` : '';
      return `Grade ${cleanG}-${cleanS}${subHint}`;
    }
    if (p.role === 'teacher') {
      const info = extractClassTeacherInfo(p, subjectClasses);
      const isCT = info.isClassTeacher;
      const ctClass = info.classKey;
      return `${p.subject || 'Faculty'}${isCT ? ` • Class Teacher (${ctClass})` : ''}`;
    }
    if (p.role === 'parent') {
      const linked = (p.linked_student_ids || [])
        .map((id) => {
          const st = profiles.find((x) => x.id === id);
          if (!st) return null;
          const g = (st.grade || '').replace(/[^0-9]/g, '');
          const s = (st.class_letter || '').toUpperCase().trim();
          return `${st.name} (G${g}-${s})`;
        })
        .filter(Boolean);
      return linked.length > 0 ? `Ward: ${linked.join(', ')}` : 'No ward linked';
    }
    if (p.role === 'principal' || isPrincipalUser(p) || isSltUser(p) || p.special_role === 'slt') {
      return p.designation || (isPrincipalUser(p) ? 'Principal & Executive Head' : 'Senior Leadership Team');
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
  const exportUsersCSV = (onlySelected: boolean = false) => {
    const listToExport = onlySelected
      ? profiles.filter((p) => selectedUserIds.has(p.id))
      : filteredProfiles;
    if (listToExport.length === 0) {
      alert('No accounts to export.');
      return;
    }
    const headers = ['Name', 'Email', 'Role', 'Status', 'Admission/Code', 'Grade', 'Section', 'Subject', 'Assigned Class'];
    const rows = listToExport.map((p) => [
      `"${p.name || ''}"`,
      `"${p.email || ''}"`,
      `"${p.role || ''}"`,
      `"${p.is_deactivated ? 'Deactivated' : 'Active'}"`,
      `"${p.role === 'parent' ? '' : sanitizeUserCode(p.admission_number || p.user_code, p.email)}"`,
      `"${p.grade || ''}"`,
      `"${p.class_letter || ''}"`,
      `"${p.subject || ''}"`,
      `"${extractClassTeacherInfo(p, subjectClasses).isClassTeacher ? extractClassTeacherInfo(p, subjectClasses).classKey : (p.assigned_class || '')}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `woodlem_${onlySelected ? 'selected_' : ''}directory_${new Date().toISOString().slice(0, 10)}.csv`);
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
    position: 'sticky',
    top: 0,
    zIndex: 10,
  };

  const tdStyle: React.CSSProperties = {
    padding: '7px 10px',
    fontSize: 12,
    borderBottom: '1px solid #ECEAE5',
    color: 'var(--neutral-dark)',
  };

  const rolePill = (role: string, userObj?: UserProfile) => {
    const pillBase: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '1px 7px',
      fontSize: 9.5,
      fontWeight: 800,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      borderRadius: 4,
      whiteSpace: 'nowrap',
      maxWidth: '100%',
      overflow: 'hidden',
      boxSizing: 'border-box',
    };
    const pillText: React.CSSProperties = {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      flex: '1 1 auto',
      minWidth: 0,
    };

    if (userObj && (isSltUser(userObj) || userObj.special_role === 'slt')) {
      const label = userObj.designation || 'SLT';
      return (
        <HoverTooltip label={label}>
          <span
            style={{
              ...pillBase,
              background: '#EAF3EF',
              color: '#2C6E6A',
              border: '1px solid #C7E4D8',
            }}
          >
            <Crown size={10} style={{ flex: '0 0 auto' }} />
            <span style={pillText}>{label}</span>
          </span>
        </HoverTooltip>
      );
    }
    if (userObj && isPrincipalUser(userObj)) {
      const label = 'Principal';
      return (
        <HoverTooltip label={label}>
          <span
            style={{
              ...pillBase,
              background: '#FEF3C7',
              color: '#92400E',
              border: '1px solid #F59E0B',
            }}
          >
            <Crown size={10} style={{ flex: '0 0 auto' }} />
            <span style={pillText}>{label}</span>
          </span>
        </HoverTooltip>
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
      <HoverTooltip label={role}>
        <span
          style={{
            ...pillBase,
            fontWeight: 700,
            background: s.bg,
            color: s.text,
            border: `1px solid ${s.border}`,
          }}
        >
          <span style={pillText}>{role}</span>
        </span>
      </HoverTooltip>
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
          columnGap: 12,
          rowGap: 10,
        }}
      >
        <div style={{ minWidth: 0, flexShrink: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 style={{ margin: 0, fontSize: 14, lineHeight: 1.35, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--neutral-dark)', fontFamily: 'var(--font-display)' }}>
              {isPrincipal ? 'Woodlem Park Institutional Governance' : isSlt ? 'Woodlem Park Senior Leadership' : 'Executive Control Console'}
            </h1>
            {isPrincipal && (
              <span style={{ fontSize: 9.5, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: '#FEF3C7', color: '#92400E' }}>
                SUPER ADMIN
              </span>
            )}
            {isSlt && (
              <span style={{ fontSize: 9.5, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: '#EFF6FF', color: '#1D4ED8' }}>
                SLT EXECUTIVE
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', columnGap: 8, rowGap: 8, minWidth: 0, flexShrink: 1, maxWidth: '100%' }}>
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
            onClick={() => exportUsersCSV(false)}
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
          <button
            onClick={() => setIsExportAttendanceModalOpen(true)}
            style={{
              padding: '6px 12px',
              fontSize: 11.5,
              fontWeight: 600,
              color: '#FFFFFF',
              background: '#2C6E6A',
              border: '1px solid #2C6E6A',
              borderRadius: 6,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <Download size={13} /> Export Attendance
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
        {[
          {
            label: 'TOTAL ACCOUNTS',
            val: overviewProfiles.length,
            sub: overviewGradeFilter === 'all' ? 'Registered users' : `Grade ${overviewGradeFilter} accounts`,
            tab: 'directory' as const,
            role: 'all' as const,
            isAlert: false,
          },
          {
            label: 'STUDENTS',
            val: overviewStudents.length,
            sub: `Active cohort (${directScoreDistribution.overallAvg || overviewAnalytics.overallAverageScore}% mean)`,
            tab: 'directory' as const,
            role: 'student' as const,
            isAlert: false,
          },
          {
            label: 'FACULTY',
            val: overviewTeachers.length,
            sub: overviewGradeFilter === 'all' ? 'Teaching staff & HODs' : `Grade ${overviewGradeFilter} teachers`,
            tab: 'directory' as const,
            role: 'teacher' as const,
            isAlert: false,
          },
          {
            label: 'PARENTS',
            val: overviewParents.length,
            sub: overviewGradeFilter === 'all' ? 'Linked guardians' : `Grade ${overviewGradeFilter} guardians`,
            tab: 'directory' as const,
            role: 'parent' as const,
            isAlert: false,
          },
          {
            label: 'CLASSES & SECTIONS',
            val: `${overviewActiveClassList.length} ACTIVE`,
            sub: overviewGradeFilter === 'all' ? 'Active cohorts (9-12)' : `Grade ${overviewGradeFilter} sections`,
            tab: 'classes' as const,
            role: 'all' as const,
            isAlert: false,
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
              minWidth: 0,
              cursor: 'pointer',
              transition: 'border-color 0.12s, background 0.12s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#8C8983')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = k.isAlert ? '#F5DEB3' : 'var(--border-color)')}
          >
            <div style={{ fontSize: 9.5, fontWeight: 700, color: k.isAlert ? '#92400E' : 'var(--text-secondary)', letterSpacing: '0.06em', lineHeight: 1.4, overflowWrap: 'break-word' }}>
              {k.label}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: k.isAlert ? '#B45309' : 'var(--neutral-dark)', fontFamily: 'var(--font-display)', margin: '3px 0 1px', lineHeight: 1.2, overflowWrap: 'break-word' }}>
              {k.val}
            </div>
            <div style={{ fontSize: 10.5, color: k.isAlert ? '#92400E' : '#888580', lineHeight: 1.4, overflowWrap: 'break-word' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ── RICH ANALYTICS CHARTS SECTION (Gated by canViewAnalytics) ────── */}
      {(!isSlt || sltPermissions.canViewAnalytics !== false) && (
        <>
          <div style={{ marginBottom: 12 }}>
            <ScoreDistributionChart
              data={directScoreDistribution.brackets}
              overallAverage={directScoreDistribution.overallAvg}
              totalStudents={overviewAnalytics.totalEnrollment}
            />
          </div>

          <RecentRegistersTable
            subjectClasses={overviewSubjectClasses}
            profiles={overviewProfiles}
            offlineAssessments={offlineAssessments}
            offlineMarks={offlineMarks}
            onOpenClassMarks={(className: string) => {
              if (isSlt && sltPermissions.canAuditMarks === false) {
                alert('Marks register access is restricted for your account.');
                return;
              }
              const matched = overviewSubjectClasses.find(
                (sc) => (sc.name || sc.class_name || '') === className || sc.class_name === className || sc.id === className
              );
              if (matched) setActiveMarkEntryClass(matched);
            }}
          />
        </>
      )}

      {/* Recent User Registrations (Dense Table) */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ padding: '9px 14px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.02em', textTransform: 'none', color: 'var(--neutral-dark)' }}>
            Recent Accounts {overviewGradeFilter !== 'all' ? `(Grade ${overviewGradeFilter})` : ''}
          </span>
          <button
            onClick={() => {
              setActiveTab('directory');
              if (overviewGradeFilter !== 'all') {
                setClassFilter('all');
              }
            }}
            style={{ background: 'none', border: 'none', color: 'var(--neutral-dark)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
          >
            View All Accounts ({overviewProfiles.length})
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
              {overviewProfiles.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>
                    No accounts registered in Grade {overviewGradeFilter} yet.
                  </td>
                </tr>
              ) : (
                overviewProfiles.slice(-7).reverse().map((p) => (
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
                        type="button"
                        className="btn-row-action btn-edit"
                        onClick={() => handleInitiateEditUser(p)}
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
    </div>
  );

  // ─── TAB 2: USER DIRECTORY ───────────────────────────────────────────────────
  const renderUserDirectory = () => (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-color)',
        borderRadius: 8,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        height: '100%',
      }}
    >
      {/* Search & Filter Strip */}
      <div
        style={{
          padding: '8px 14px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          background: '#FAF9F6',
          flexShrink: 0,
          whiteSpace: 'nowrap',
          overflowX: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <input
            type="text"
            placeholder="Search name, email, code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              height: 32,
              width: 220,
              padding: '0 11px',
              fontSize: 12,
              borderRadius: 6,
              border: '1px solid #E5E3DF',
              background: '#FFFFFF',
              color: '#1A1A1A',
              outline: 'none',
              flexShrink: 0,
            }}
          />

          {/* Role selector pills */}
          <SegmentedControl
            value={roleFilter}
            onChange={(r) => setRoleFilter(r as any)}
            options={[
              { value: 'all', label: 'All' },
              { value: 'student', label: 'Student' },
              { value: 'teacher', label: 'Teacher' },
              { value: 'parent', label: 'Parent' },
              { value: 'admin', label: 'Admin' },
              { value: 'principal', label: 'Leadership' },
              { value: 'deactivated', label: `Deactivated${deactivatedCount > 0 ? ` (${deactivatedCount})` : ''}` },
            ]}
            height={32}
            textTransform="uppercase"
          />

          {/* Class Filter */}
          <div style={{ width: 130, flexShrink: 0 }}>
            <CustomSelect
              value={classFilter}
              onChange={(val) => setClassFilter(val)}
              buttonStyle={{ height: 32, padding: '0 10px', fontSize: 12, borderRadius: 6, borderColor: '#E5E3DF' }}
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
                height: 28,
                padding: '0 8px',
                fontSize: 11,
                fontWeight: 600,
                color: '#A83B38',
                background: '#FDF1F0',
                border: '1px solid #F5C6CB',
                borderRadius: 5,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <button
            onClick={() => exportUsersCSV(false)}
            style={{
              height: 30,
              padding: '0 11px',
              fontSize: 11.5,
              fontWeight: 600,
              color: 'var(--neutral-dark)',
              background: '#FFFFFF',
              border: '1px solid var(--border-color)',
              borderRadius: 6,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            Export Accounts
          </button>
          <button
            onClick={onOpenBulkModal}
            style={{
              height: 30,
              padding: '0 11px',
              fontSize: 11.5,
              fontWeight: 600,
              color: 'var(--neutral-dark)',
              background: '#FFFFFF',
              border: '1px solid var(--border-color)',
              borderRadius: 6,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            Import Accounts
          </button>
          <button
            onClick={onOpenProvisionModal}
            style={{
              height: 30,
              padding: '0 13px',
              fontSize: 11.5,
              fontWeight: 600,
              color: '#FFFFFF',
              background: '#2D2C2A',
              border: '1px solid #2D2C2A',
              borderRadius: 6,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            + Create Account
          </button>
        </div>
      </div>

      {/* Duplicate Student Accounts Banner */}
      {duplicateGroups.length > 0 && (
        <div
          style={{
            padding: '10px 16px',
            background: '#FEF3C7',
            borderBottom: '1px solid #FDE68A',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#92400E' }}>
                {duplicateGroups.length} Duplicate Student Group{duplicateGroups.length > 1 ? 's' : ''} Detected
              </div>
              <div style={{ fontSize: 11.5, color: '#B45309' }}>
                Found accounts with conflicting or temporary 11xx numbers (e.g., {duplicateGroups.slice(0, 3).map((g) => g.studentName).join(', ')}{duplicateGroups.length > 3 ? '...' : ''}).
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsMergeModalOpen(true)}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 700,
              background: '#92400E',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Review & Clean Duplicates
          </button>
        </div>
      )}

      {/* Directory Table Area */}
      <div
        style={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          ref={dirScrollRef}
          onScroll={(e) => handleDirScroll(e.currentTarget)}
          className="scroll-visible"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'auto',
          }}
        >
          {filteredProfiles.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--neutral-dark)' }}>No user records matched your criteria</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 4 }}>Try clearing active search or filters.</div>
            </div>
          ) : (
            <table style={{ width: '100%', minWidth: 890, tableLayout: 'fixed', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 42, textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={isAllCurrentPageSelected}
                      onChange={toggleSelectAllCurrentPage}
                      style={{ cursor: 'pointer', accentColor: '#2D2C2A' }}
                      title="Select / Deselect all accounts on this page"
                    />
                  </th>
                  <th style={{ ...thStyle, width: 46, textAlign: 'center' }}>#</th>
                  <th style={{ ...thStyle, width: 190 }}>Full Name</th>
                  <th style={{ ...thStyle, width: 108 }}>Role</th>
                  <th style={{ ...thStyle, width: 210 }}>Email Address</th>
                  <th style={{ ...thStyle, width: 115 }}>Admission / Code</th>
                  <th style={{ ...thStyle, width: 180 }}>Academic Mapping</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProfiles.map((p, idx) => {
                  const globalIdx = (safeCurrentPage - 1) * pageSize + idx + 1;
                  const isSelected = selectedUserIds.has(p.id);
                  const idCode = p.role === 'parent' ? '—' : (sanitizeUserCode(p.admission_number || p.user_code, p.role === 'student' ? p.email : null) || p.user_code || p.admission_number || '—');
                  const assignment = formatUserAssignment(p);

                  return (
                    <tr
                      key={p.id}
                      onClick={() => handleInitiateEditUser(p)}
                      style={{
                        background: isSelected ? '#EFF6FF' : idx % 2 === 0 ? '#FFFFFF' : '#FAF9F7',
                        cursor: 'pointer',
                        transition: 'background 0.08s',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.background = '#F2F1EC';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.background = idx % 2 === 0 ? '#FFFFFF' : '#FAF9F7';
                      }}
                    >
                      <td
                        onClick={(e) => e.stopPropagation()}
                        style={{ ...tdStyle, width: 42, textAlign: 'center' }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectUser(p.id)}
                          style={{ cursor: 'pointer', accentColor: '#2D2C2A' }}
                        />
                      </td>
                      <td style={{ ...tdStyle, width: 46, textAlign: 'center', color: '#888580', fontSize: 11 }}>
                        {globalIdx}
                      </td>
                      <td
                        title={p.name}
                        style={{ ...tdStyle, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                          {p.is_deactivated && (
                            <span
                              style={{
                                flexShrink: 0,
                                fontSize: 9.5,
                                fontWeight: 700,
                                color: '#DC2626',
                                background: '#FEF2F2',
                                border: '1px solid #FCA5A5',
                                padding: '1px 6px',
                                borderRadius: 4,
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                              }}
                            >
                              Deactivated
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ ...tdStyle, overflow: 'hidden' }}>{rolePill(p.role, p)}</td>
                      <td
                        title={p.email}
                        style={{
                          ...tdStyle,
                          color: 'var(--text-secondary)',
                          fontSize: 11.5,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {p.email}
                      </td>
                      <td
                        title={idCode}
                        style={{
                          ...tdStyle,
                          fontFamily: 'monospace',
                          fontSize: 11,
                          color: '#44423E',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {idCode}
                      </td>
                      <td
                        title={assignment}
                        style={{
                          ...tdStyle,
                          fontSize: 11.5,
                          color: '#55534E',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {assignment}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Floating Batch Actions Toolbar */}
        {selectedUserIds.size > 0 && (
          <div
            style={{
              position: 'absolute',
              bottom: 10,
              left: 14,
              right: 14,
              zIndex: 40,
              padding: '9px 16px',
              background: '#1F2937',
              color: '#FFFFFF',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#F9FAFB' }}>
                {selectedUserIds.size} account{selectedUserIds.size > 1 ? 's' : ''} selected
              </span>
              <span style={{ color: '#4B5563' }}>•</span>
              <button
                type="button"
                onClick={() => setSelectedUserIds(new Set())}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#9CA3AF',
                  fontSize: 11.5,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: 0,
                }}
              >
                Deselect all
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => exportUsersCSV(true)}
                style={{
                  padding: '6px 13px',
                  fontSize: 11.5,
                  fontWeight: 600,
                  background: '#374151',
                  color: '#FFFFFF',
                  border: '1px solid #4B5563',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                Export Selected ({selectedUserIds.size})
              </button>

              {roleFilter !== 'deactivated' ? (
                <button
                  type="button"
                  onClick={() => handleBatchDeactivate(true)}
                  style={{
                    padding: '6px 13px',
                    fontSize: 11.5,
                    fontWeight: 600,
                    background: '#D97706',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  Deactivate Selected
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleBatchDeactivate(false)}
                  style={{
                    padding: '6px 13px',
                    fontSize: 11.5,
                    fontWeight: 600,
                    background: '#16A34A',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  Reactivate Selected
                </button>
              )}

              <button
                type="button"
                onClick={handleBatchDelete}
                style={{
                  padding: '6px 13px',
                  fontSize: 11.5,
                  fontWeight: 600,
                  background: '#DC2626',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                Delete Selected
              </button>
            </div>
          </div>
        )}

        {/* Edge overflow fades — visible only while content is clipped horizontally */}
        {dirScroll.left && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              width: 24,
              pointerEvents: 'none',
              zIndex: 15,
              background: 'linear-gradient(to right, rgba(0,0,0,0.12), transparent)',
            }}
          />
        )}
        {dirScroll.right && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              right: 0,
              width: 24,
              pointerEvents: 'none',
              zIndex: 15,
              background: 'linear-gradient(to left, rgba(0,0,0,0.12), transparent)',
            }}
          />
        )}
      </div>

      {/* Pagination Footer */}
      {filteredProfiles.length > 0 && (
        <div
          style={{
            padding: '8px 16px',
            borderTop: '1px solid var(--border-color)',
            background: '#FAF9F6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Showing <strong>{(safeCurrentPage - 1) * pageSize + 1}</strong>–<strong>{Math.min(safeCurrentPage * pageSize, filteredProfiles.length)}</strong> of <strong>{filteredProfiles.length}</strong> accounts (50 per set)
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <button
              type="button"
              onClick={() => {
                setCurrentPage(1);
                if (dirScrollRef.current) dirScrollRef.current.scrollTop = 0;
              }}
              disabled={safeCurrentPage === 1}
              style={{
                padding: '4px 8px',
                fontSize: 11.5,
                fontWeight: 600,
                background: '#FFFFFF',
                border: '1px solid #E5E3DF',
                borderRadius: 5,
                cursor: safeCurrentPage === 1 ? 'not-allowed' : 'pointer',
                opacity: safeCurrentPage === 1 ? 0.35 : 1,
              }}
              title="First Page"
            >
              «
            </button>
            <button
              type="button"
              onClick={() => {
                setCurrentPage((p) => Math.max(1, p - 1));
                if (dirScrollRef.current) dirScrollRef.current.scrollTop = 0;
              }}
              disabled={safeCurrentPage === 1}
              style={{
                padding: '4px 10px',
                fontSize: 11.5,
                fontWeight: 600,
                background: '#FFFFFF',
                border: '1px solid #E5E3DF',
                borderRadius: 5,
                cursor: safeCurrentPage === 1 ? 'not-allowed' : 'pointer',
                opacity: safeCurrentPage === 1 ? 0.35 : 1,
              }}
            >
              Previous
            </button>

            {/* Page Number Pills */}
            {(() => {
              const pages: (number | string)[] = [];
              if (totalPages <= 7) {
                for (let i = 1; i <= totalPages; i++) pages.push(i);
              } else {
                pages.push(1);
                if (safeCurrentPage > 3) pages.push('...');
                const start = Math.max(2, safeCurrentPage - 1);
                const end = Math.min(totalPages - 1, safeCurrentPage + 1);
                for (let i = start; i <= end; i++) pages.push(i);
                if (safeCurrentPage < totalPages - 2) pages.push('...');
                pages.push(totalPages);
              }
              return pages.map((pg, idx) => {
                if (pg === '...') {
                  return (
                    <span key={`ellipsis-${idx}`} style={{ padding: '0 4px', color: '#9CA3AF', fontSize: 12 }}>
                      …
                    </span>
                  );
                }
                const isCurrent = pg === safeCurrentPage;
                return (
                  <button
                    key={`page-${pg}`}
                    type="button"
                    onClick={() => {
                      setCurrentPage(Number(pg));
                      if (dirScrollRef.current) dirScrollRef.current.scrollTop = 0;
                    }}
                    style={{
                      minWidth: 28,
                      height: 28,
                      padding: '0 6px',
                      fontSize: 11.5,
                      fontWeight: isCurrent ? 700 : 500,
                      color: isCurrent ? '#FFFFFF' : '#1F2937',
                      background: isCurrent ? '#2D2C2A' : '#FFFFFF',
                      border: isCurrent ? '1px solid #2D2C2A' : '1px solid #E5E3DF',
                      borderRadius: 5,
                      cursor: 'pointer',
                    }}
                  >
                    {pg}
                  </button>
                );
              });
            })()}

            <button
              type="button"
              onClick={() => {
                setCurrentPage((p) => Math.min(totalPages, p + 1));
                if (dirScrollRef.current) dirScrollRef.current.scrollTop = 0;
              }}
              disabled={safeCurrentPage === totalPages}
              style={{
                padding: '4px 10px',
                fontSize: 11.5,
                fontWeight: 600,
                background: '#FFFFFF',
                border: '1px solid #E5E3DF',
                borderRadius: 5,
                cursor: safeCurrentPage === totalPages ? 'not-allowed' : 'pointer',
                opacity: safeCurrentPage === totalPages ? 0.35 : 1,
              }}
            >
              Next
            </button>
            <button
              type="button"
              onClick={() => {
                setCurrentPage(totalPages);
                if (dirScrollRef.current) dirScrollRef.current.scrollTop = 0;
              }}
              disabled={safeCurrentPage === totalPages}
              style={{
                padding: '4px 8px',
                fontSize: 11.5,
                fontWeight: 600,
                background: '#FFFFFF',
                border: '1px solid #E5E3DF',
                borderRadius: 5,
                cursor: safeCurrentPage === totalPages ? 'not-allowed' : 'pointer',
                opacity: safeCurrentPage === totalPages ? 0.35 : 1,
              }}
              title="Last Page"
            >
              »
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // ─── TAB 3: CLASSES & SECTIONS ──────────────────────────────────────────────
  const renderClasses = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--neutral-dark)' }}>Class Sections &amp; Class Teachers</span>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
              Woodlem Park centralized class section management and subject distribution
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => setIsCreateSectionOpen(true)}
              style={{
                height: 32,
                padding: '0 12px',
                fontSize: 12,
                fontWeight: 600,
                background: '#FAF9F6',
                border: '1px solid var(--border-color)',
                borderRadius: 6,
                color: 'var(--neutral-dark)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              + Create Section
            </button>
            {onOpenCreateSubjectClassModal && (
              <button
                onClick={() => onOpenCreateSubjectClassModal()}
                style={{
                  height: 32,
                  padding: '0 14px',
                  fontSize: 12,
                  fontWeight: 700,
                  background: '#2D2C2A',
                  border: '1px solid #2D2C2A',
                  borderRadius: 6,
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                + Create Subject Class
              </button>
            )}
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
              return (
                <div
                  key={cls}
                  onClick={() => {
                    setClassInspectStudentSearch('');
                    setClassInspectSubjectSearch('');
                    setSelectedClassInspect(cls);
                  }}
                  style={{
                    border: '1px solid var(--border-color)',
                    borderRadius: 6,
                    padding: '10px 12px',
                    background: '#FFFFFF',
                    boxShadow: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#2D2C2A';
                    e.currentTarget.style.boxShadow = '0 3px 10px rgba(0,0,0,0.06)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                    e.currentTarget.style.boxShadow = 'none';
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

      {/* CREATE NEW CLASS SECTION MODAL */}
      {isCreateSectionOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: 20,
          }}
          onClick={() => setIsCreateSectionOpen(false)}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 12,
              width: '100%',
              maxWidth: 480,
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAF9F6' }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#2C6E6A', textTransform: 'none', letterSpacing: '0.02em' }}>Centralized Section Setup</span>
                <h3 style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 700, color: 'var(--neutral-dark)' }}>Create Class Section</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateSectionOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const classKey = `${newSectionGrade}-${newSectionLetter}`;
                if (!createdSections.includes(classKey)) {
                  const updated = [...createdSections, classKey];
                  setCreatedSections(updated);
                  try {
                    localStorage.setItem('woodlem_created_sections_v1', JSON.stringify(updated));
                  } catch (err) {}
                }
                if (newSectionTeacherId && onUpdateUser) {
                  const selectedT = teachers.find((t) => t.id === newSectionTeacherId);
                  if (selectedT) {
                    await onUpdateUser({
                      ...selectedT,
                      assigned_class: `Grade ${classKey}`,
                    });
                  }
                }
                setIsCreateSectionOpen(false);
                setSelectedClassInspect(classKey);
              }}
              style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--neutral-dark)', marginBottom: 6 }}>
                    Grade
                  </label>
                  <CustomSelect
                    value={newSectionGrade}
                    onChange={(val) => setNewSectionGrade(val)}
                    options={[
                      { value: '9', label: 'Grade 9' },
                      { value: '10', label: 'Grade 10' },
                      { value: '11', label: 'Grade 11' },
                      { value: '12', label: 'Grade 12' },
                    ]}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--neutral-dark)', marginBottom: 6 }}>
                    Section Letter
                  </label>
                  <CustomSelect
                    value={newSectionLetter}
                    onChange={(val) => setNewSectionLetter(val)}
                    options={Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)).map((s) => ({
                      value: s,
                      label: `Section ${s}`,
                    }))}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--neutral-dark)', marginBottom: 6 }}>
                  Assign Class Teacher (Optional)
                </label>
                <CustomSelect
                  value={newSectionTeacherId}
                  onChange={(val) => setNewSectionTeacherId(val)}
                  placeholder="Select Class Teacher..."
                  options={[
                    { value: '', label: 'None (Assign Later)' },
                    ...teachers.map((t) => ({ value: t.id, label: `${t.name} (${t.subject || 'Faculty'})` })),
                  ]}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsCreateSectionOpen(false)}
                  style={{ padding: '8px 16px', fontSize: 12 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ padding: '8px 20px', fontSize: 12, fontWeight: 700 }}
                >
                  Create Section {newSectionGrade}-{newSectionLetter}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  // ─── CLASS SECTION FULL-PAGE COHORT PROFILE & ROSTER ─────────────────────────
  const renderClassProfileFullPage = () => {
    if (!selectedClassInspect) return null;
    const [g, s] = selectedClassInspect.split('-');
    const roster = students.filter((st) => {
      const cleanG = (st.grade || '').replace(/[^0-9]/g, '');
      const cleanS = (st.class_letter || '').toUpperCase().trim();
      return cleanG === g && cleanS === s;
    });
    const sectionSubjectClasses = subjectClasses.filter(
      (sc) => (sc.class_name || '').toUpperCase().trim() === selectedClassInspect.toUpperCase().trim()
    );
    const ct = teachers.find((t) => {
      const info = extractClassTeacherInfo(t, subjectClasses);
      return info.isClassTeacher && info.classKey === selectedClassInspect;
    });

    const filteredRoster = roster.filter((st) => {
      if (!classInspectStudentSearch.trim()) return true;
      const q = classInspectStudentSearch.toLowerCase().trim();
      const nameMatch = (st.name || '').toLowerCase().includes(q);
      const admMatch = (st.admission_number || st.user_code || '').toLowerCase().includes(q);
      const emailMatch = (st.email || '').toLowerCase().includes(q);
      return nameMatch || admMatch || emailMatch;
    });

    const filteredSubjectClasses = sectionSubjectClasses.filter((sc) => {
      if (!classInspectSubjectSearch.trim()) return true;
      const q = classInspectSubjectSearch.toLowerCase().trim();
      const nameMatch = (sc.name || '').toLowerCase().includes(q);
      const subjMatch = (sc.subject || '').toLowerCase().includes(q);
      const teacherMatch = (sc.teacher_name || '').toLowerCase().includes(q);
      return nameMatch || subjMatch || teacherMatch;
    });

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 2px 32px' }}>
        {/* Navigation & Cohort Header Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <button
            type="button"
            onClick={() => setSelectedClassInspect(null)}
            className="btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 13px',
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 7,
              background: '#FFFFFF',
              border: '1px solid #D5D3CE',
              color: 'var(--neutral-dark)',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            }}
          >
            <ChevronLeft size={14} />
            <span>Back to Class Sections &amp; Batches</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span
              style={{
                padding: '4px 11px',
                borderRadius: 20,
                background: '#FAF9F6',
                border: '1px solid #E5E3DF',
                fontSize: 11.5,
                fontWeight: 700,
                color: '#2D2C2A',
              }}
            >
              Grade {g} • Section {s}
            </span>
            <span
              style={{
                padding: '4px 11px',
                borderRadius: 20,
                background: '#EBF3F2',
                border: '1px solid #C4DEDC',
                fontSize: 11.5,
                fontWeight: 700,
                color: '#2C6E6A',
              }}
            >
              {roster.length} Enrolled Students
            </span>
            <span
              style={{
                padding: '4px 11px',
                borderRadius: 20,
                background: '#F3F4F6',
                border: '1px solid #E5E7EB',
                fontSize: 11.5,
                fontWeight: 700,
                color: '#374151',
              }}
            >
              {sectionSubjectClasses.length} Subject Classes
            </span>
          </div>
        </div>

        {/* Executive Cohort Header Card */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid var(--border-color)',
            borderRadius: 10,
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '16px 20px',
              background: '#FAF9F6',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: 'var(--neutral-dark)' }}>
                  Class Profile &amp; Roster — Grade {g} - Section {s}
                </h2>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: '#2C6E6A',
                    color: '#FFFFFF',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  Active Cohort
                </span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                Student enrollment directory, assigned homeroom faculty, and subject classroom assessment channels.
              </p>
            </div>
          </div>

          {/* Class Teacher Quick Assignment Bar */}
          <div
            style={{
              padding: '12px 20px',
              background: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: ct ? '#EBF3F2' : '#F3F4F6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: ct ? '#2C6E6A' : '#9CA3AF',
                  flexShrink: 0,
                }}
              >
                <UserCheck size={18} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Class Teacher / Homeroom Advisor
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                  <strong style={{ fontSize: 13.5, color: ct ? '#2C6E6A' : '#9CA3AF' }}>
                    {ct ? `${ct.name} (${ct.subject || 'Faculty'})` : 'No Class Teacher Assigned'}
                  </strong>
                  {ct ? (
                    <span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: '#DCFCE7', color: '#166534' }}>
                      Assigned
                    </span>
                  ) : (
                    <span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: '#FEF3C7', color: '#92400E' }}>
                      Unassigned
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {classTeacherUpdateStatus && (
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#166534', background: '#DCFCE7', padding: '4px 8px', borderRadius: 4 }}>
                  ✓ {classTeacherUpdateStatus}
                </span>
              )}
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Assign / Change Teacher:</span>
              <div style={{ width: 260 }}>
                <CustomSelect
                  value={ct?.id || ''}
                  placeholder="Select Class Teacher..."
                  onChange={async (newTeacherId) => {
                    try {
                      if (ct && onUpdateUser) {
                        await onUpdateUser({
                          ...ct,
                          assigned_class: null,
                        });
                      }
                      if (newTeacherId) {
                        const selectedT = teachers.find((t) => t.id === newTeacherId);
                        if (selectedT && onUpdateUser) {
                          await onUpdateUser({
                            ...selectedT,
                            assigned_class: `Grade ${selectedClassInspect}`,
                          });
                        }
                      }
                      setClassTeacherUpdateStatus('Class teacher updated');
                      setTimeout(() => setClassTeacherUpdateStatus(null), 3000);
                      if (onRefreshData) onRefreshData();
                    } catch (err) {
                      console.error('Failed to assign class teacher:', err);
                    }
                  }}
                  options={[
                    { value: '', label: 'None (Unassigned)' },
                    ...teachers.map((t) => ({ value: t.id, label: `${t.name} (${t.subject || 'Faculty'})` })),
                  ]}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Two-Column Responsive Workspace */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(400px, 1.15fr) minmax(360px, 1fr)', gap: 16, alignItems: 'start' }}>
          {/* LEFT COLUMN: ENROLLED STUDENTS ROSTER */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            }}
          >
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border-color)',
                background: '#FAF9F6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                  Enrolled Students ({roster.length})
                </span>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Official student roster for {selectedClassInspect}
                </div>
              </div>

              {/* Search Bar */}
              <div style={{ position: 'relative', width: 230 }}>
                <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                <input
                  type="text"
                  placeholder="Filter roster..."
                  value={classInspectStudentSearch}
                  onChange={(e) => setClassInspectStudentSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '5px 10px 5px 28px',
                    fontSize: 11.5,
                    border: '1px solid #D1D5DB',
                    borderRadius: 6,
                    outline: 'none',
                    background: '#FFFFFF',
                  }}
                />
                {classInspectStudentSearch && (
                  <button
                    onClick={() => setClassInspectStudentSearch('')}
                    style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 13, padding: 0 }}
                  >
                    &times;
                  </button>
                )}
              </div>
            </div>

            <div style={{ maxHeight: 600, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#FAF9F6', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ ...thStyle, width: 36, textAlign: 'center' }}>#</th>
                    <th style={thStyle}>Student Name &amp; Email</th>
                    <th style={thStyle}>Admission #</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRoster.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ ...tdStyle, textAlign: 'center', padding: '36px 20px', color: 'var(--text-secondary)' }}>
                        {roster.length === 0
                          ? `No students currently enrolled in section ${selectedClassInspect}.`
                          : `No students matching "${classInspectStudentSearch}".`}
                      </td>
                    </tr>
                  ) : (
                    filteredRoster.map((st, idx) => {
                      const initials = (st.name || 'ST')
                        .split(' ')
                        .map((w) => w[0])
                        .filter(Boolean)
                        .slice(0, 2)
                        .join('')
                        .toUpperCase();

                      return (
                        <tr key={st.id} style={{ background: '#FFFFFF', borderBottom: '1px solid #F3F4F6' }}>
                          <td style={{ ...tdStyle, color: '#9CA3AF', fontSize: 11, textAlign: 'center' }}>
                            {idx + 1}
                          </td>
                          <td style={tdStyle}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: '50%',
                                  background: '#EBF3F2',
                                  color: '#2C6E6A',
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                {initials}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: 12, color: '#111827' }}>
                                  {st.name}
                                </div>
                                <div style={{ fontSize: 11, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {st.email || '—'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={tdStyle}>
                            <span
                              style={{
                                fontFamily: 'monospace',
                                fontSize: 11,
                                fontWeight: 700,
                                background: '#F3F4F6',
                                padding: '2px 7px',
                                borderRadius: 4,
                                color: '#374151',
                              }}
                            >
                              {sanitizeUserCode(st.admission_number || st.user_code, st.email) || '—'}
                            </span>
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>
                            <button
                              type="button"
                              className="btn-row-action btn-edit"
                              onClick={() => {
                                handleInitiateEditUser(st);
                              }}
                              style={{
                                padding: '4px 10px',
                                fontSize: 11.5,
                                fontWeight: 600,
                                background: '#FFFFFF',
                                border: '1px solid #D1D5DB',
                                borderRadius: 5,
                                cursor: 'pointer',
                                color: '#374151',
                              }}
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* RIGHT COLUMN: SUBJECT CLASSES & CURRICULUM CHANNELS */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            }}
          >
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border-color)',
                background: '#FAF9F6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                  Subject Classes ({sectionSubjectClasses.length})
                </span>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Active subject channels for {selectedClassInspect}
                </div>
              </div>

              {onOpenCreateSubjectClassModal && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenCreateSubjectClassModal({
                      grade: g,
                      section: s,
                      lockSection: true,
                    });
                  }}
                  style={{
                    background: '#2C6E6A',
                    border: 'none',
                    color: '#FFFFFF',
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '6px 12px',
                    borderRadius: 6,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                  }}
                >
                  <Plus size={13} />
                  <span>+ Add Subject Class</span>
                </button>
              )}
            </div>

            {/* Subject Search Bar */}
            <div style={{ padding: '8px 16px', borderBottom: '1px solid #F3F4F6', background: '#FFFFFF' }}>
              <div style={{ position: 'relative', width: '100%' }}>
                <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                <input
                  type="text"
                  placeholder="Filter subject classes by title or teacher..."
                  value={classInspectSubjectSearch}
                  onChange={(e) => setClassInspectSubjectSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '5px 10px 5px 28px',
                    fontSize: 11.5,
                    border: '1px solid #D1D5DB',
                    borderRadius: 6,
                    outline: 'none',
                    background: '#FFFFFF',
                  }}
                />
                {classInspectSubjectSearch && (
                  <button
                    onClick={() => setClassInspectSubjectSearch('')}
                    style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 13, padding: 0 }}
                  >
                    &times;
                  </button>
                )}
              </div>
            </div>

            {/* Subject Classes Cards List */}
            <div style={{ padding: 14, overflowY: 'auto', maxHeight: 600, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredSubjectClasses.length === 0 ? (
                <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>
                  {sectionSubjectClasses.length === 0
                    ? `No subject classes registered for ${selectedClassInspect}. Click "+ Add Subject Class" above to create one.`
                    : `No subject classes matching "${classInspectSubjectSearch}".`}
                </div>
              ) : (
                filteredSubjectClasses.map((sc) => {
                  const classTeacher = profiles.find((p) => p.id === sc.teacher_id);
                  const enrolledCount = sc.enrolled_student_ids?.length || roster.length;

                  return (
                    <div
                      key={sc.id}
                      style={{
                        padding: '12px 14px',
                        border: '1px solid #E5E7EB',
                        borderRadius: 8,
                        background: '#FAF9F6',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {sc.name || `${sc.subject} (${sc.class_name})`}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                              Teacher: <strong style={{ color: '#2C6E6A' }}>{classTeacher?.name || sc.teacher_name || 'Unassigned'}</strong>
                            </span>
                            <span style={{ color: '#D1D5DB' }}>•</span>
                            <span style={{ fontSize: 11, color: '#6B7280' }}>
                              {enrolledCount} Students Enrolled
                            </span>
                            {sc.room && (
                              <>
                                <span style={{ color: '#D1D5DB' }}>•</span>
                                <span style={{ fontSize: 11, color: '#6B7280' }}>Room: {sc.room}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 4,
                            background: '#E5E7EB',
                            color: '#374151',
                            flexShrink: 0,
                          }}
                        >
                          {sc.subject}
                        </span>
                      </div>

                      {/* Card Action Buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, paddingTop: 6, borderTop: '1px solid #ECEAE5' }}>
                        <button
                          type="button"
                          onClick={() => setDeletingSubjectClass(sc)}
                          title="Delete this subject class permanently from everywhere"
                          style={{
                            padding: '5px 10px',
                            fontSize: 11.5,
                            fontWeight: 600,
                            background: '#FEF2F2',
                            border: '1px solid #FECACA',
                            borderRadius: 5,
                            color: '#DC2626',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            transition: 'all 0.12s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#FEE2E2';
                            e.currentTarget.style.borderColor = '#FCA5A5';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#FEF2F2';
                            e.currentTarget.style.borderColor = '#FECACA';
                          }}
                        >
                          <Trash2 size={13} />
                          <span>Delete</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setActiveMarkEntryClass(sc);
                          }}
                          className="btn-primary"
                          style={{
                            padding: '5px 12px',
                            fontSize: 11.5,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            background: '#2D2C2A',
                            border: 'none',
                            borderRadius: 5,
                            color: '#FFFFFF',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          <span>Manage Terms</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  useEffect(() => {
    if (isSlt) {
      if (activeTab === 'delegation') setActiveTab('overview');
      if (activeTab === 'directory' && sltPermissions.canViewDirectory === false) setActiveTab('overview');
      if (activeTab === 'classes' && sltPermissions.canManageClasses === false) setActiveTab('overview');
      if (activeTab === 'assessments' && sltPermissions.canAuditMarks === false) setActiveTab('overview');
      if (activeTab === 'late_entry' && sltPermissions.canManageLateEntries === false) setActiveTab('overview');
      if (activeTab === 'settings' && sltPermissions.canManageSettings !== true) setActiveTab('overview');
    }
  }, [isSlt, activeTab, sltPermissions]);

  const tabs: { id: AdminTab; label: string; count?: number; isAlert?: boolean }[] = useMemo(() => {
    if (!canManageSpecialRoles) {
      const sltTabs: { id: AdminTab; label: string; count?: number; isAlert?: boolean }[] = [
        { id: 'overview', label: 'Overview' },
      ];
      if (sltPermissions.canViewDirectory !== false) {
        sltTabs.push({ id: 'directory', label: 'User Directory', count: profiles.length });
      }
      if (sltPermissions.canManageClasses !== false) {
        sltTabs.push({ id: 'classes', label: 'Classes & Sections', count: activeClassList.length });
      }
      if (sltPermissions.canAuditMarks !== false) {
        sltTabs.push({ id: 'assessments', label: 'Exam Terms & Marks' });
      }
      if (sltPermissions.canManageLateEntries !== false) {
        sltTabs.push({ id: 'late_entry', label: 'Late Entry Desk & Audit', count: lateEntries.length });
      }
      if (sltPermissions.canManageSettings === true) {
        sltTabs.push({ id: 'settings', label: 'Settings & Passwords' });
      }
      sltTabs.push({ id: 'support', label: 'Help & Support' });
      return sltTabs;
    }
    return [
      { id: 'overview', label: 'Overview' },
      { id: 'delegation', label: 'Special Access & Roles' },
      { id: 'directory', label: 'User Directory', count: profiles.length },
      { id: 'classes', label: 'Classes & Sections', count: activeClassList.length },
      { id: 'assessments', label: 'Exam Terms & Marks' },
      { id: 'late_entry', label: 'Late Entry Desk & Audit', count: lateEntries.length },
      { id: 'settings', label: 'Settings & Passwords' },
      { id: 'support', label: 'Help & Support' },
    ];
  }, [canManageSpecialRoles, sltPermissions, profiles.length, activeClassList.length, lateEntries.length]);

  return (
    <div className="app-viewport admin-viewport">
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
          transition: 'width 0.28s cubic-bezier(0.16, 1, 0.3, 1), min-width 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 15,
        }}
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
            letterSpacing: '0.04em',
            color: '#8C8A84',
            textTransform: 'none',
            borderBottom: '1px solid #E8E5DF',
            flexShrink: 0,
          }}>
            {isPrincipal ? 'Principal Super Admin Console' : isSlt ? 'Senior Leadership Suite' : 'Admin Management Console'}
          </div>
        )}

        {/* PROFILE CARD */}
        {sidebar.isCollapsed ? (
          <div style={{ padding: '12px 0 6px', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
            <div
              title={`${isPrincipal ? 'Principal & Super Admin' : isSlt ? (currentUser.designation || 'Senior Leadership') : 'Administrator'} • ${currentUser.name || 'Admin'}`}
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
              {isPrincipal ? <Crown size={18} style={{ color: '#F59E0B' }} /> : isSlt ? <ShieldCheck size={18} /> : (currentUser.name || 'A').charAt(0).toUpperCase()}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              {isPrincipal ? (
                <Crown size={14} style={{ color: '#D97706' }} />
              ) : isSlt ? (
                <ShieldCheck size={14} style={{ color: '#2C6E6A' }} />
              ) : null}
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A' }}>
                {currentUser.name || (isPrincipal ? 'Principal' : 'Admin')}
              </div>
            </div>
            <div style={{ fontSize: 11, color: '#6B6963', marginBottom: 8 }}>
              {currentUser.email || (isPrincipal ? 'principal@woodlempark.ae' : 'admin@woodlempark.ae')}
            </div>
            <div
              style={{
                padding: '5px 8px',
                background: '#FFFFFF',
                border: '1px dashed #D5D3CC',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 6,
              }}
            >
              <span style={{
                fontSize: 9.5,
                fontWeight: 700,
                color: isPrincipal ? '#92400E' : isSlt ? '#2C6E6A' : '#1A1A1A',
                letterSpacing: '0.02em',
                textTransform: 'none',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {isPrincipal ? 'Principal & Super Admin' : isSlt ? (currentUser.designation || 'Senior Leadership') : 'Administrator'}
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#2D8C5E', flexShrink: 0 }}>Active</span>
            </div>

            {isSlt && (
              <div
                style={{
                  marginTop: 6,
                  padding: '4px 7px',
                  borderRadius: 4,
                  background: sltScope.scopeType === 'all' ? '#EFF6FF' : '#EAF3EF',
                  border: sltScope.scopeType === 'all' ? '1px solid #BFDBFE' : '1px solid #C7E4D8',
                  fontSize: 9.5,
                  color: sltScope.scopeType === 'all' ? '#1D4ED8' : '#2C6E6A',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
                title={
                  sltScope.scopeType === 'all'
                    ? 'Jurisdiction: Whole Institution (All Grades 9-12)'
                    : `Jurisdiction: Grades ${sltScope.managedGrades.join(', ')}${
                        sltScope.managedSections.length > 0
                          ? ` • Sections: ${sltScope.managedSections.join(', ')}`
                          : ' • All Sections'
                      }`
                }
              >
                <Building size={10} style={{ flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {sltScope.scopeType === 'all'
                    ? 'Whole School (Grades 9-12)'
                    : `Grades ${sltScope.managedGrades.join(', ')}${
                        sltScope.managedSections.length > 0
                          ? ` • Sec: ${sltScope.managedSections.join(', ')}`
                          : ' • All Sections'
                      }`}
                </span>
              </div>
            )}
          </div>
        )}

        {/* NAVIGATION SECTION HEADER */}
        <div style={{ padding: sidebar.isCollapsed ? '8px 0 0' : '16px 0 0', flexShrink: 0 }}>
          {!sidebar.isCollapsed && (
            <div style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.04em',
              color: '#9E9A94',
              padding: '0 16px 6px',
              textTransform: 'none',
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
                case 'classes': return <BookOpen size={16} />;
                case 'assessments': return <FileSpreadsheet size={16} />;
                case 'late_entry': return <Clock size={16} />;
                case 'settings': return <Settings size={16} />;
                case 'support': return <LifeBuoy size={16} />;

              }
            };

            return (
              <div key={tab.id} style={{ position: 'relative' }}>
                <button
                  onClick={() => { setActiveTab(tab.id); setSelectedUserForEdit(null); setActiveMarkEntryClass(null); setSelectedClassInspect(null); sidebar.handleNavClick(); }}
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
                          letterSpacing: '0.02em',
                          color: isActive ? '#FFFFFF' : '#3A3834',
                          textTransform: 'none',
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

        {/* SIDEBAR FOOTER: TOGGLE & SIGN OUT */}
        <div style={{
          padding: sidebar.isCollapsed ? '8px 0 12px' : '8px 12px 16px',
          borderTop: '1px solid #E8E5DF',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: sidebar.isCollapsed ? 'center' : 'stretch',
          gap: 6,
        }}>
          <button
            onClick={sidebar.toggleCollapse}
            title={sidebar.isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            style={{
              width: sidebar.isCollapsed ? 40 : '100%',
              height: sidebar.isCollapsed ? 36 : 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebar.isCollapsed ? 'center' : 'flex-start',
              gap: 8,
              background: 'transparent',
              border: 'none',
              borderRadius: 7,
              padding: sidebar.isCollapsed ? 0 : '7px 8px',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              color: '#6B6963',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#F3F2EF')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            {sidebar.isCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
            {!sidebar.isCollapsed && <span>Collapse Sidebar</span>}
          </button>

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
      </aside>

      {/* MAIN VIEWPORT */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {/* Compact Top Header Bar */}
        <header
          style={{
            minHeight: 38,
            height: 'auto',
            background: '#FFFFFF',
            borderBottom: '1px solid var(--border-color)',
            padding: '6px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            flexWrap: 'wrap',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'none', letterSpacing: '0.02em', lineHeight: 1.4, color: 'var(--neutral-dark)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {tabs.find((t) => t.id === activeTab)?.label}
              {selectedUserForEdit ? ` / Edit User: ${selectedUserForEdit.name}` : ''}
              {selectedClassInspect && !selectedUserForEdit && !activeMarkEntryClass ? ` / Grade ${selectedClassInspect.split('-')[0]} - Section ${selectedClassInspect.split('-')[1]} Cohort Profile` : ''}
              {activeMarkEntryClass ? ` / Mark Entry: ${activeMarkEntryClass.name}` : ''}
            </span>
          </div>

          {activeMarkEntryClass ? (
            <button
              onClick={() => setActiveMarkEntryClass(null)}
              className="btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '5px 11px',
                fontSize: 11,
                fontWeight: 700,
                borderRadius: 6,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <ChevronLeft size={13} />
              <span>Back to {selectedClassInspect ? `Grade ${selectedClassInspect} Profile` : (tabs.find((t) => t.id === activeTab)?.label || 'Dashboard')}</span>
            </button>
          ) : selectedClassInspect && !selectedUserForEdit ? (
            <button
              onClick={() => setSelectedClassInspect(null)}
              className="btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '5px 11px',
                fontSize: 11,
                fontWeight: 700,
                borderRadius: 6,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <ChevronLeft size={13} />
              <span>Back to Class Sections &amp; Batches</span>
            </button>
          ) : null}


        </header>

        {/* Scrollable Viewport Content */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            overflowY: activeTab === 'directory' && !selectedUserForEdit ? 'hidden' : 'auto',
            padding: activeTab === 'directory' && !selectedUserForEdit ? '10px 16px' : '14px 16px',
          }}
        >
          {activeMarkEntryClass ? (
            <div style={{ padding: '14px 4px', minHeight: '100%', boxSizing: 'border-box' }}>
              <MarkEntryModal
                inline
                isOpen
                onClose={() => setActiveMarkEntryClass(null)}
                classRoom={activeMarkEntryClass}
                teacher={currentUser}
                profiles={profiles}
              />
            </div>
          ) : selectedUserForEdit ? (() => {
            const foundProfile = profiles.find(
              (p) =>
                (selectedUserForEdit.id && p.id === selectedUserForEdit.id) ||
                (p.email && selectedUserForEdit.email && p.email.toLowerCase().trim() === selectedUserForEdit.email.toLowerCase().trim())
            );
            const activeUser = {
              ...(foundProfile || {}),
              ...selectedUserForEdit,
            };

            return (
              <UserDetailView
                user={activeUser}
                profiles={profiles}
                parentDocuments={parentDocuments}
                subjectClasses={subjectClasses}
                onBack={() => setSelectedUserForEdit(null)}
                onSave={async (updated) => {
                  setSelectedUserForEdit(updated);
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
          })() : selectedClassInspect ? (
            renderClassProfileFullPage()
          ) : (
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
              {activeTab === 'classes' && renderClasses()}
              {activeTab === 'assessments' && (
                <AdminAssessmentTermsView
                  currentUser={currentUser}
                  profiles={profiles}
                  subjectClasses={subjectClasses}
                  onOpenMarkRegister={(cls) => setActiveMarkEntryClass(cls)}
                />
              )}
              {activeTab === 'late_entry' && (
                <LateEntryView
                  mode="admin"
                  currentUser={currentUser}
                  profiles={profiles}
                  lateEntries={lateEntries}
                  onRefreshData={onRefreshData}
                />
              )}
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

      <MergeDuplicatesModal
        isOpen={isMergeModalOpen}
        onClose={() => setIsMergeModalOpen(false)}
        duplicateGroups={duplicateGroups}
        onMergeGroup={handleMergeGroup}
        onMergeAll={handleMergeAllDuplicates}
        isMerging={isMerging}
      />

      <ExportAttendanceModal
        isOpen={isExportAttendanceModalOpen}
        onClose={() => setIsExportAttendanceModalOpen(false)}
        attendance={attendance || {}}
        students={profiles.filter((p) => p.role === 'student' && (!overviewGradeFilter || overviewGradeFilter === 'all' || p.grade === overviewGradeFilter || (p.grade && p.grade.includes(overviewGradeFilter))))}
        classroomLabel={overviewGradeFilter === 'all' ? 'Woodlem Park School (All Grades)' : `Grade ${overviewGradeFilter} Attendance Register`}
        teacherName={currentUser.name}
      />

      {/* DELETE SUBJECT CLASS CONFIRMATION MODAL */}
      {deletingSubjectClass && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: 16,
          }}
          onClick={() => !isDeletingClassLoading && setDeletingSubjectClass(null)}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 12,
              width: '100%',
              maxWidth: 480,
              boxShadow: '0 20px 45px rgba(0,0,0,0.25)',
              overflow: 'hidden',
              border: '1px solid #FCA5A5',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '20px 24px', background: '#FEF2F2', borderBottom: '1px solid #FEE2E2', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertTriangle size={22} color="#DC2626" />
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#991B1B' }}>
                  Delete Subject Class?
                </h3>
                <p style={{ fontSize: 12, color: '#B91C1C', margin: '3px 0 0 0' }}>
                  This will permanently erase this classroom across the entire school.
                </p>
              </div>
            </div>

            <div style={{ padding: '20px 24px', fontSize: 13, color: '#374151', lineHeight: 1.55 }}>
              <p style={{ margin: '0 0 12px 0' }}>
                Are you sure you want to delete <strong style={{ color: '#111827' }}>{deletingSubjectClass.name || deletingSubjectClass.subject}</strong>?
              </p>
              <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, padding: '12px 14px', fontSize: 12, color: '#4B5563', marginBottom: 16 }}>
                <div style={{ fontWeight: 600, color: '#1F2937', marginBottom: 6 }}>This action will automatically purge:</div>
                <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <li>Classroom enrollment from all student dashboards</li>
                  <li>Teacher schedule, timetable, and attendance bindings</li>
                  <li>All offline assessment terms &amp; marks registers</li>
                  <li>All recorded student marks &amp; term scores</li>
                  <li>All circulars, broadcast announcements, and shared class files</li>
                </ul>
              </div>
              <div style={{ fontSize: 12, color: '#DC2626', fontWeight: 600 }}>
                ⚠️ This action is irreversible. All associated grades and records will be deleted immediately.
              </div>
            </div>

            <div style={{ padding: '14px 24px', background: '#F9FAFB', borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                disabled={isDeletingClassLoading}
                onClick={() => setDeletingSubjectClass(null)}
                style={{
                  padding: '8px 16px',
                  fontSize: 12.5,
                  fontWeight: 600,
                  background: '#FFFFFF',
                  border: '1px solid #D1D5DB',
                  borderRadius: 6,
                  color: '#374151',
                  cursor: isDeletingClassLoading ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingClassLoading}
                onClick={handleConfirmDeleteSubjectClass}
                style={{
                  padding: '8px 18px',
                  fontSize: 12.5,
                  fontWeight: 700,
                  background: '#DC2626',
                  border: '1px solid #B91C1C',
                  borderRadius: 6,
                  color: '#FFFFFF',
                  cursor: isDeletingClassLoading ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {isDeletingClassLoading ? (
                  <span>Deleting Everywhere...</span>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Permanently Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
