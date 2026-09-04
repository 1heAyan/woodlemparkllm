'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Users, Award, BookOpen, UserCheck, MessageSquare, LayoutDashboard, Calendar, Settings, LifeBuoy, LogOut, Megaphone, FileText, Pin, PinOff, SlidersHorizontal, Check, Video, Link2, X, Plus, Edit3, KeyRound, Copy, Share2, RotateCcw } from 'lucide-react';
import { WoodlemLogo } from '@/components/Shared/WoodlemLogo';
import { useSidebarState } from '@/lib/useSidebarState';
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
  SpecialRoleAssignment,
  LeaveRequest,
} from '@/lib/supabaseClient';
import { CustomSelect } from '@/components/UI/CustomSelect';
import { SegmentedControl } from '@/components/UI/SegmentedControl';
import { ReviewTestResultsModal, TestResultRecord } from '../Modals/ReviewTestResultsModal';
import { GradeAssignmentModal, AssignmentSubmissionRecord } from '../Modals/GradeAssignmentModal';
import { ViewFileModal } from '../Modals/ViewFileModal';
import { EditSubjectClassModal } from '../Modals/EditSubjectClassModal';
import { MarkEntryModal } from '../Modals/MarkEntryModal';
import { SettingsView } from '@/components/Shared/SettingsView';
import { SupportView } from '@/components/Shared/SupportView';
import { usePortalNavigation } from '@/lib/PortalNavigationContext';
import { openFileInNewTab, downloadFile, formatShortFileName } from '@/lib/fileHelper';
import { extractClassTeacherInfo } from '@/lib/classTeacherHelper';
import { isHodUser, isCoordinatorUser, loadSpecialRoleAssignments, ACADEMIC_DEPARTMENTS } from '@/lib/specialRolesHelper';
import { computeExecutiveAnalytics } from '@/lib/analyticsHelper';
import {
  getOrGenerateStudentParentCode,
  buildWhatsAppShareUrl,
  persistStudentParentCode,
  generateParentLinkCode,
} from '@/lib/parentCodeHelper';
import {
  KpiSparklineCard,
  MatrixTrendChart,
  PinBarBreakdownChart,
  RecentRegistersTable,
  ScoreDistributionChart,
  SubjectComparisonChart,
} from '@/components/UI/AnalyticsCharts';
import { ShieldCheck, Layers, Crown } from 'lucide-react';

interface TeacherDashboardProps {
  currentUser: UserProfile;
  profiles: UserProfile[];
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
  onCreateResource?: (resourceData: {
    class_id: string;
    title: string;
    description?: string;
    resource_type: ResourceType;
    file_name?: string;
    file_url?: string;
    file_size?: string;
    external_link?: string;
    topic_tag?: string;
  }) => void;
  onDeleteResource?: (resourceId: string) => void;
  onCreateBroadcast?: (broadcastData: {
    class_id: string;
    title: string;
    content: string;
    is_pinned?: boolean;
    priority?: 'normal' | 'important' | 'urgent';
    tagged_resource_ids?: string[];
  }) => void;
  onDeleteBroadcast?: (broadcastId: string) => void;
  onTogglePinBroadcast?: (broadcastId: string) => void;
  onOpenCreateClassModal: () => void;
  onUpdateSubjectClass: (
    classId: string,
    updatedData: {
      name: string;
      subject: string;
      class_name: string;
      section?: string;
      room?: string;
      enrolled_student_ids?: string[];
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
  onOpenAddTermModal: (classContext?: { id?: string; subject?: string; className?: string }) => void;
  onDeleteTerm: (termId: string) => void;
  onOpenAddTopicModal: (termId?: string) => void;
  onDeleteTopic: (termId: string, topicId: string) => void;
  onToggleTopicCheck: (termId: string, topicId: string, role: 'teacher' | 'student', isChecked: boolean) => void;
  onSaveAttendance: (date: string, records: Record<string, string>) => void;
  leaveRequests?: LeaveRequest[];
  onApproveLeave?: (leaveId: string, studentId?: string) => Promise<void> | void;
  onRejectLeave?: (leaveId: string, studentId?: string) => Promise<void> | void;
  onOpenCreateHubActivityModal: () => void;
  onDeleteHubActivity: (id: string) => void;
  onEditHubActivity?: (activity: HubActivity) => void;
  onUpdateCurrentUser?: (user: UserProfile) => void;
  onRefreshData?: () => void;
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
  subjectClasses,
  classResources = [],
  classBroadcasts = [],
  testResults = {},
  assignmentSubmissions = {},
  onCreateResource,
  onDeleteResource,
  onCreateBroadcast,
  onDeleteBroadcast,
  onTogglePinBroadcast,
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
  leaveRequests = [],
  onApproveLeave,
  onRejectLeave,
  onOpenCreateHubActivityModal,
  onDeleteHubActivity,
  onEditHubActivity,
  onUpdateCurrentUser,
  onRefreshData,
  onSignOut,
}) => {
  const [isEditClassModalOpen, setIsEditClassModalOpen] = useState(false);
  const sidebar = useSidebarState(currentUser?.id || currentUser?.email || 'teacher');
  const [selectedReviewTest, setSelectedReviewTest] = useState<TestItem | null>(null);
  const [selectedGradeAssignment, setSelectedGradeAssignment] = useState<AssignmentItem | null>(null);
  const [isMarkEntryOpen, setIsMarkEntryOpen] = useState(false);
  // Navigation mode: 'class' | 'homeroom_attendance' | 'homeroom_awards' | 'homeroom_resources' | 'homeroom_codes' | 'hub' | 'settings' | 'support' | 'hod_hub' | 'coordinator_hub'
  const [activeNavMode, setActiveNavMode] = useState<'class' | 'homeroom_attendance' | 'homeroom_awards' | 'homeroom_resources' | 'homeroom_codes' | 'hub' | 'settings' | 'support' | 'hod_hub' | 'coordinator_hub'>('class');

  const [specialAssignments, setSpecialAssignments] = useState<SpecialRoleAssignment[]>([]);
  useEffect(() => {
    loadSpecialRoleAssignments().then(setSpecialAssignments);
  }, []);

  const userHodAssignment = useMemo(() => {
    return specialAssignments.find(
      (a) =>
        (a.userId === currentUser.id || (a.userEmail && currentUser.email && a.userEmail.toLowerCase() === currentUser.email.toLowerCase())) &&
        a.roleType === 'hod'
    );
  }, [specialAssignments, currentUser]);

  const userCoordAssignment = useMemo(() => {
    return specialAssignments.find(
      (a) =>
        (a.userId === currentUser.id || (a.userEmail && currentUser.email && a.userEmail.toLowerCase() === currentUser.email.toLowerCase())) &&
        a.roleType === 'coordinator'
    );
  }, [specialAssignments, currentUser]);

  const userDepartmentDef = useMemo(() => {
    if (userHodAssignment?.department) {
      return ACADEMIC_DEPARTMENTS.find((d) => d.name === userHodAssignment.department);
    }
    if (currentUser.department) {
      return ACADEMIC_DEPARTMENTS.find((d) => d.name === currentUser.department);
    }
    if (currentUser.subject) {
      return ACADEMIC_DEPARTMENTS.find((d) => d.subjects.some((s) => s.toLowerCase() === (currentUser.subject || '').toLowerCase()));
    }
    return null;
  }, [userHodAssignment, currentUser]);

  // Classes under this teacher's HOD department across all teachers in school
  const departmentClassrooms = useMemo(() => {
    if (!userDepartmentDef) return [];
    return subjectClasses.filter((c) =>
      userDepartmentDef.subjects.some((s) => (c.subject || '').toLowerCase().includes(s.toLowerCase()))
    );
  }, [userDepartmentDef, subjectClasses]);

  const departmentAnalytics = useMemo(() => {
    return computeExecutiveAnalytics({
      profiles,
      subjectClasses: departmentClassrooms.length > 0 ? departmentClassrooms : subjectClasses,
      tests,
      syllabus,
      attendance,
      testResults,
      selectedGradeFilter: 'all',
    });
  }, [profiles, departmentClassrooms, subjectClasses, tests, syllabus, attendance, testResults]);

  // Sidebar profile photo (synced with Supabase cloud & local cache)
  const [sidebarAvatarUrl, setSidebarAvatarUrl] = useState<string | null>(() => {
    if (currentUser.avatar_url) return currentUser.avatar_url;
    if (typeof window !== 'undefined') {
      const email = (currentUser.email || '').toLowerCase().trim();
      return (
        localStorage.getItem(`woodlem_avatar_${email}`) ||
        localStorage.getItem(`woodlem_avatar_${currentUser.id}`) ||
        null
      );
    }
    return null;
  });

  useEffect(() => {
    if (currentUser.avatar_url) {
      setSidebarAvatarUrl(currentUser.avatar_url);
    }
  }, [currentUser.avatar_url]);

  useEffect(() => {
    const handleAvatarUpdate = (e: any) => {
      const detail = e.detail;
      if (!detail) return;
      const { avatarUrl, userId, email } = detail;
      if (
        (userId && currentUser.id === userId) ||
        (email && currentUser.email?.toLowerCase() === email.toLowerCase())
      ) {
        setSidebarAvatarUrl(avatarUrl || null);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('woodlem-avatar-updated', handleAvatarUpdate);
      return () => window.removeEventListener('woodlem-avatar-updated', handleAvatarUpdate);
    }
  }, [currentUser.id, currentUser.email]);

  // Sub-tabs inside a subject classroom: 'broadcasts' | 'resources' | 'tasks' | 'syllabus' | 'students'
  const [classSubTab, setClassSubTab] = useState<'broadcasts' | 'resources' | 'tasks' | 'syllabus' | 'students'>('broadcasts');

  // Broadcasts Composer State (Full-Page Inline)
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastContent, setBroadcastContent] = useState('');
  const [broadcastPriority, setBroadcastPriority] = useState<'normal' | 'important' | 'urgent'>('normal');
  const [broadcastIsPinned, setBroadcastIsPinned] = useState(false);
  const [broadcastTaggedResourceIds, setBroadcastTaggedResourceIds] = useState<string[]>([]);
  const [isPostingBroadcast, setIsPostingBroadcast] = useState(false);

  // Resource Uploader State (Full-Page Inline)
  const [isResourceFormExpanded, setIsResourceFormExpanded] = useState(false);
  const [resTitle, setResTitle] = useState('');
  const [resDesc, setResDesc] = useState('');
  const [resType, setResType] = useState<ResourceType>('pdf');
  const [resFileName, setResFileName] = useState('');
  const [resFileDataUrl, setResFileDataUrl] = useState('');
  const [resFileSize, setResFileSize] = useState('');
  const [resExternalLink, setResExternalLink] = useState('');
  const [resTopicTag, setResTopicTag] = useState('');
  const [resSearchQuery, setResSearchQuery] = useState('');
  const [resTypeFilter, setResTypeFilter] = useState<'all' | ResourceType>('all');
  const [isUploadingResource, setIsUploadingResource] = useState(false);

  // General Resource preview modal
  const [previewingResource, setPreviewingResource] = useState<ClassResource | null>(null);

  // Sub-tabs inside Homeroom Attendance: 'mark' (Daily Roll Call), 'history' (Monthly Matrix & History), 'leaves' (Permit Leave Requests)
  const [attendanceViewMode, setAttendanceViewMode] = useState<'mark' | 'history' | 'leaves'>('mark');
  const [leaveStatusFilter, setLeaveStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  // Inside Full Attendance Register: 'matrix' | 'by_student' | 'by_date'
  const [historyTab, setHistoryTab] = useState<'matrix' | 'by_student' | 'by_date'>('matrix');

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

  // Filter co-curricular hub activities created/published by this teacher
  const myHubActivities = useMemo(() => {
    return hubActivities
      .filter((act) => !String(act.title || '').startsWith('__') && act.type !== 'system_config' && act.id !== 'special_roles_master_v1')
      .filter((act) => {
        if (!act.created_by) return false;
        const creator = act.created_by.toLowerCase().trim();
        const myId = (currentUser.id || '').toLowerCase().trim();
        const myName = (currentUser.name || '').toLowerCase().trim();
        const myEmail = (currentUser.email || '').toLowerCase().trim();
        return (
          creator === myId ||
          creator === myName ||
          creator === myEmail ||
          (myName && (creator.includes(myName) || myName.includes(creator))) ||
          (currentUser.role === 'admin')
        );
      });
  }, [hubActivities, currentUser.id, currentUser.name, currentUser.email, currentUser.role]);

  // Portal Navigation & AI Copilot Integration
  const { isAiPanelOpen, toggleAiPanel, subscribeToNavigation } = usePortalNavigation();

  useEffect(() => {
    const unsubscribe = subscribeToNavigation((target) => {
      setIsMarkEntryOpen(false);
      if (target.view === 'homeroom_awards' || target.view === 'awards' || target.view === 'achievements') {
        setActiveNavMode('homeroom_awards');
      } else if (target.view === 'homeroom_attendance' || target.view === 'attendance') {
        setActiveNavMode('homeroom_attendance');
        if (target.subTab === 'mark') {
          setAttendanceViewMode('mark');
        } else if (target.subTab === 'history') {
          setAttendanceViewMode('history');
        }
      } else if (target.view === 'homeroom_resources' || (target.view === 'resources' && teacherClasses.length === 0)) {
        setActiveNavMode('homeroom_resources');
      } else if (target.view === 'hub' || target.view === 'activities') {
        setActiveNavMode('hub');
      } else if (target.view === 'settings' || target.view === 'password') {
        setActiveNavMode('settings');
      } else if (target.view === 'support' || target.view === 'helpdesk') {
        setActiveNavMode('support');
      } else if (target.view === 'class' || target.view === 'resources' || target.view === 'tasks' || target.view === 'syllabus' || target.view === 'broadcasts') {
        if (teacherClasses.length > 0) {
          setActiveNavMode('class');
          if (target.classId && teacherClasses.some((c) => c.id === target.classId)) {
            setSelectedClassId(target.classId);
          } else if (!selectedClassId || !teacherClasses.some((c) => c.id === selectedClassId)) {
            setSelectedClassId(teacherClasses[0].id);
          }
          const sub = target.subTab || (['resources', 'tasks', 'syllabus', 'broadcasts'].includes(target.view || '') ? target.view : 'tasks');
          if (sub && ['broadcasts', 'resources', 'tasks', 'syllabus', 'students'].includes(sub)) {
            setClassSubTab(sub as any);
          }
        } else {
          // If no subject class created yet, redirect to relevant homeroom or class creator
          if (target.subTab === 'resources' || target.view === 'resources') {
            setActiveNavMode('homeroom_resources');
          } else {
            setActiveNavMode('class');
          }
        }
      } else if (target.modalAction === 'create_class') {
        onOpenCreateClassModal();
      } else if (target.modalAction === 'create_test') {
        onOpenCreateTestModal();
      } else if (target.modalAction === 'create_assignment') {
        onOpenCreateAssignmentModal();
      }
    });
    return unsubscribe;
  }, [subscribeToNavigation, teacherClasses, selectedClassId, onOpenCreateClassModal, onOpenCreateTestModal, onOpenCreateAssignmentModal]);

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
  const homeroomClassInfo = useMemo(
    () => extractClassTeacherInfo(currentUser, subjectClasses),
    [currentUser, subjectClasses]
  );
  const homeroomGrade = homeroomClassInfo.grade;
  const homeroomSection = homeroomClassInfo.section;
  const homeroomLabel = homeroomClassInfo.isClassTeacher && homeroomClassInfo.classLabel ? homeroomClassInfo.classLabel : `Grade ${homeroomGrade}-${homeroomSection}`;

  // Homeroom students (strictly empty if not assigned as Class Teacher)
  const homeroomStudents = useMemo(() => {
    if (!homeroomClassInfo.isClassTeacher) return [];
    return profiles.filter((p) => {
      if (p.role !== 'student') return false;
      const g = (p.grade || '').replace(/[^0-9]/g, '');
      const s = (p.class_letter || '').toUpperCase().trim();
      return g === homeroomGrade && (!homeroomSection || s === homeroomSection);
    });
  }, [profiles, homeroomClassInfo.isClassTeacher, homeroomGrade, homeroomSection]);

  // Homeroom Parent Access Codes State
  const [codeSearchQuery, setCodeSearchQuery] = useState('');
  const [codeFilter, setCodeFilter] = useState<'all' | 'linked' | 'unlinked'>('all');
  const [copiedStudentId, setCopiedStudentId] = useState<string | null>(null);
  const [isRegeneratingCodeId, setIsRegeneratingCodeId] = useState<string | null>(null);

  const filteredHomeroomCodesStudents = useMemo(() => {
    return homeroomStudents.filter((st) => {
      const q = codeSearchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        st.name.toLowerCase().includes(q) ||
        (st.admission_number && st.admission_number.toLowerCase().includes(q)) ||
        (st.email && st.email.toLowerCase().includes(q)) ||
        (st.user_code && st.user_code.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      const isLinked = profiles.some(
        (p) => p.role === 'parent' && (p.linked_student_ids || []).includes(st.id)
      );

      if (codeFilter === 'linked') return isLinked;
      if (codeFilter === 'unlinked') return !isLinked;
      return true;
    });
  }, [homeroomStudents, codeSearchQuery, codeFilter, profiles]);

  const handleCopyParentCode = (studentId: string, code: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setCopiedStudentId(studentId);
      setTimeout(() => setCopiedStudentId(null), 2500);
    }
  };

  const handleRegenerateParentCode = async (st: UserProfile) => {
    if (!window.confirm(`Generate a new Parent Link Code for ${st.name}? Any previously shared code will no longer work.`)) {
      return;
    }
    setIsRegeneratingCodeId(st.id);
    try {
      const newCode = generateParentLinkCode(st.id);
      await persistStudentParentCode(st.id, newCode);
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error('Failed to regenerate parent code:', err);
    } finally {
      setIsRegeneratingCodeId(null);
    }
  };

  // Synthetic class_id for the homeroom (used to tag resources/broadcasts sent to the whole class)
  const homeroomClassId = useMemo(() => `homeroom-${homeroomGrade}-${homeroomSection}`, [homeroomGrade, homeroomSection]);

  // Homeroom resources & broadcasts (filtered by homeroomClassId)
  const homeroomResources = useMemo(() =>
    classResources.filter((r) => r.class_id === homeroomClassId)
      .sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime()),
    [classResources, homeroomClassId]
  );
  const homeroomBroadcasts = useMemo(() =>
    classBroadcasts
      .filter((b) => b.class_id === homeroomClassId)
      .sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime();
      }),
    [classBroadcasts, homeroomClassId]
  );

  const renderHomeroomNotice = () => (
    <div style={{ padding: '60px 24px', textAlign: 'center', background: '#FFFFFF', borderRadius: 8, border: '1px solid var(--border-color)', margin: '24px' }}>
      <div style={{ width: 52, height: 52, borderRadius: 14, background: '#F5F4F0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#8C8983', marginBottom: 14 }}>
        <UserCheck size={26} />
      </div>
      <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--neutral-dark)', margin: '0 0 6px' }}>
        Homeroom Class Not Assigned
      </h2>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 500, margin: '0 auto 18px', lineHeight: 1.5 }}>
        You are currently registered as <strong>{currentUser.subject || 'Subject Faculty'}</strong>. Homeroom attendance roll call, student achievement records, and parent access codes become active when Administration assigns a homeroom section to your account.
      </p>
    </div>
  );

  // Homeroom resource uploader state
  const [hrResTitle, setHrResTitle] = useState('');
  const [hrResDesc, setHrResDesc] = useState('');
  const [hrResType, setHrResType] = useState<ResourceType>('pdf');
  const [hrResFileName, setHrResFileName] = useState('');
  const [hrResFileDataUrl, setHrResFileDataUrl] = useState('');
  const [hrResFileSize, setHrResFileSize] = useState('');
  const [hrResExternalLink, setHrResExternalLink] = useState('');
  const [hrResTopicTag, setHrResTopicTag] = useState('');
  const [hrIsResourceFormExpanded, setHrIsResourceFormExpanded] = useState(false);
  const [hrIsUploadingResource, setHrIsUploadingResource] = useState(false);
  const [hrResSearchQuery, setHrResSearchQuery] = useState('');
  const [hrResTypeFilter, setHrResTypeFilter] = useState<'all' | ResourceType>('all');

  // Homeroom broadcast composer state
  const [hrBcTitle, setHrBcTitle] = useState('');
  const [hrBcContent, setHrBcContent] = useState('');
  const [hrBcPriority, setHrBcPriority] = useState<'normal' | 'important' | 'urgent'>('normal');
  const [hrBcIsPinned, setHrBcIsPinned] = useState(false);
  const [hrBcIsPosting, setHrBcIsPosting] = useState(false);
  const [hrActiveTab, setHrActiveTab] = useState<'broadcasts' | 'resources'>('broadcasts');

  const handleHrResourceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setHrResFileName(file.name);
    const sizeKB = file.size / 1024;
    setHrResFileSize(sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${Math.round(sizeKB)} KB`);
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') setHrResType('pdf');
    else if (['ppt', 'pptx', 'key'].includes(ext || '')) setHrResType('slides');
    else if (['doc', 'docx', 'txt', 'rtf'].includes(ext || '')) setHrResType('doc');
    else if (['xls', 'xlsx', 'csv'].includes(ext || '')) setHrResType('worksheet');
    const reader = new FileReader();
    reader.onload = (ev) => setHrResFileDataUrl((ev.target?.result as string) || '');
    reader.readAsDataURL(file);
  };

  const handleHrSaveResource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hrResTitle.trim()) { alert('Please enter a title for the resource.'); return; }
    if (['link', 'video'].includes(hrResType) && !hrResExternalLink.trim()) { alert('Please enter a valid link (URL).'); return; }
    if (onCreateResource) {
      setHrIsUploadingResource(true);
      onCreateResource({
        class_id: homeroomClassId,
        title: hrResTitle.trim(),
        description: hrResDesc.trim(),
        resource_type: hrResType,
        file_name: hrResFileName || (hrResType === 'link' ? 'External Link' : 'Resource File'),
        file_url: hrResFileDataUrl || hrResExternalLink,
        file_size: hrResFileSize,
        external_link: hrResExternalLink.trim(),
        topic_tag: hrResTopicTag.trim(),
      });
      setTimeout(() => {
        setHrIsUploadingResource(false);
        setHrResTitle(''); setHrResDesc(''); setHrResFileName('');
        setHrResFileDataUrl(''); setHrResFileSize(''); setHrResExternalLink('');
        setHrResTopicTag(''); setHrIsResourceFormExpanded(false);
      }, 250);
    }
  };

  const handleHrPostBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hrBcTitle.trim()) { alert('Please enter an announcement title.'); return; }
    if (!hrBcContent.trim()) { alert('Please enter message content.'); return; }
    if (onCreateBroadcast) {
      setHrBcIsPosting(true);
      onCreateBroadcast({
        class_id: homeroomClassId,
        title: hrBcTitle.trim(),
        content: hrBcContent.trim(),
        is_pinned: hrBcIsPinned,
        priority: hrBcPriority,
      });
      setTimeout(() => {
        setHrBcIsPosting(false);
        setHrBcTitle(''); setHrBcContent(''); setHrBcPriority('normal'); setHrBcIsPinned(false);
      }, 250);
    }
  };

  const filteredHrResources = useMemo(() =>
    homeroomResources.filter((r) => {
      if (hrResTypeFilter !== 'all' && r.resource_type !== hrResTypeFilter) return false;
      if (hrResSearchQuery.trim()) {
        const q = hrResSearchQuery.toLowerCase();
        return r.title.toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q) || (r.topic_tag || '').toLowerCase().includes(q);
      }
      return true;
    }),
    [homeroomResources, hrResTypeFilter, hrResSearchQuery]
  );

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
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState('');
  const [historyStudentSearch, setHistoryStudentSearch] = useState('');

  // Homeroom students' permit leave requests
  const homeroomLeaveRequests = useMemo(() => {
    const studentIdSet = new Set(homeroomStudents.map((s) => s.id));
    const studentEmailSet = new Set(homeroomStudents.map((s) => (s.email || '').toLowerCase()).filter(Boolean));
    return (leaveRequests || []).filter(
      (l) => studentIdSet.has(l.student_id) || studentEmailSet.has(l.student_id.toLowerCase())
    );
  }, [leaveRequests, homeroomStudents]);

  const pendingLeaves = useMemo(() => {
    return homeroomLeaveRequests.filter((l) => l.status === 'submitted' || !l.status);
  }, [homeroomLeaveRequests]);

  const leavesCounts = useMemo(() => {
    const pending = homeroomLeaveRequests.filter((l) => l.status === 'submitted' || !l.status).length;
    const approved = homeroomLeaveRequests.filter((l) => l.status === 'approved').length;
    const rejected = homeroomLeaveRequests.filter((l) => l.status === 'rejected').length;
    return { all: homeroomLeaveRequests.length, pending, approved, rejected };
  }, [homeroomLeaveRequests]);

  const filteredLeavesForTeacher = useMemo(() => {
    return homeroomLeaveRequests.filter((leave) => {
      const student = profiles.find((p) => p.id === leave.student_id || p.email === leave.student_id);
      const isPending = leave.status === 'submitted' || !leave.status;
      const isApproved = leave.status === 'approved';
      const isRejected = leave.status === 'rejected';

      if (leaveStatusFilter === 'pending' && !isPending) return false;
      if (leaveStatusFilter === 'approved' && !isApproved) return false;
      if (leaveStatusFilter === 'rejected' && !isRejected) return false;

      if (historyStudentSearch.trim()) {
        const q = historyStudentSearch.trim().toLowerCase();
        const stName = (student?.name || '').toLowerCase();
        const adm = (student?.admission_number || student?.user_code || '').toLowerCase();
        const reason = (leave.reason || '').toLowerCase();
        const lType = (leave.leaveType || '').toLowerCase();
        return stName.includes(q) || adm.includes(q) || reason.includes(q) || lType.includes(q);
      }
      return true;
    });
  }, [homeroomLeaveRequests, profiles, leaveStatusFilter, historyStudentSearch]);

  // Sync daily attendance records when date changes
  useEffect(() => {
    const existing = attendance[selectedDate] || {};
    const populated: Record<string, string> = {};
    homeroomStudents.forEach((st) => {
      populated[st.id] = existing[st.id] || (st.email && existing[st.email]) || 'present';
    });
    setDailyRecords(populated);
  }, [selectedDate, attendance, homeroomStudents]);

  const focusNextStudent = (currIdx: number) => {
    if (currIdx < homeroomStudents.length - 1) {
      const nextInput = document.getElementById(`roll_key_${currIdx + 1}`);
      if (nextInput) {
        (nextInput as HTMLInputElement).focus();
        (nextInput as HTMLInputElement).select();
      }
    }
  };

  const focusPrevStudent = (currIdx: number) => {
    if (currIdx > 0) {
      const prevInput = document.getElementById(`roll_key_${currIdx - 1}`);
      if (prevInput) {
        (prevInput as HTMLInputElement).focus();
        (prevInput as HTMLInputElement).select();
      }
    }
  };

  const handleSetStudentStatus = (studentId: string, idx: number, status: 'present' | 'unauth_absent' | 'auth_absent') => {
    setDailyRecords((prev) => ({ ...prev, [studentId]: status }));
    focusNextStudent(idx);
  };

  const handleRapidKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number, studentId: string) => {
    const key = e.key.toUpperCase();
    if (key === 'P') {
      e.preventDefault();
      handleSetStudentStatus(studentId, idx, 'present');
    } else if (key === 'A') {
      e.preventDefault();
      handleSetStudentStatus(studentId, idx, 'unauth_absent');
    } else if (key === 'L') {
      e.preventDefault();
      handleSetStudentStatus(studentId, idx, 'auth_absent');
    } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
      e.preventDefault();
      focusNextStudent(idx);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusPrevStudent(idx);
    }
  };

  const handleMarkAllPresent = () => {
    const updated: Record<string, string> = {};
    homeroomStudents.forEach((st) => {
      updated[st.id] = 'present';
    });
    setDailyRecords(updated);
  };

  const handleClearAllAttendance = () => {
    const cleared: Record<string, string> = {};
    homeroomStudents.forEach((st) => {
      cleared[st.id] = '';
    });
    setDailyRecords(cleared);
  };

  const handleSaveAttendanceClick = async () => {
    if (homeroomStudents.length === 0) {
      alert('No students found in this homeroom to record attendance.');
      return;
    }
    const toSave: Record<string, string> = {};
    homeroomStudents.forEach((st) => {
      toSave[st.id] = dailyRecords[st.id] || 'present';
    });
    onSaveAttendance(selectedDate, toSave);
    setSaveFeedback(`Attendance for ${selectedDate} saved successfully (${homeroomStudents.length} students).`);
    setTimeout(() => setSaveFeedback(''), 4000);
  };

  // Filter tests and assignments for active class — scoped to this teacher only
  const classTests = useMemo(() => {
    if (!activeClassObj) return [];
    return tests.filter((t) => {
      // Primary isolation: if teacher_id is stamped, must match this teacher
      if (t.teacher_id && currentUser?.id && t.teacher_id !== currentUser.id) return false;
      if (!t.class_name || t.class_name === 'All Classes' || t.class_name === 'General') return true;

      // Check target_sections array
      if (t.target_sections && t.target_sections.length > 0) {
        const classKey = (activeClassObj.class_name || '').replace(/grade\s*/gi, '').trim();
        if (t.target_sections.some((sec) => sec.replace(/grade\s*/gi, '').trim() === classKey)) {
          return true;
        }
      }

      return t.class_name.includes(activeClassObj.class_name) || t.class_name.includes(activeClassObj.name);
    });
  }, [tests, activeClassObj, currentUser]);

  const classAssignments = useMemo(() => {
    if (!activeClassObj) return [];
    return assignments.filter((a) => {
      if (!a.class_name || a.class_name === 'All Classes' || a.class_name === 'General') return true;
      return a.class_name.includes(activeClassObj.class_name) || a.class_name.includes(activeClassObj.name);
    });
  }, [assignments, activeClassObj]);

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

  // Handle Resource Upload (Inline Full-Page)
  const handleResourceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResFileName(file.name);
    const sizeKB = file.size / 1024;
    const formattedSize = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${Math.round(sizeKB)} KB`;
    setResFileSize(formattedSize);

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') setResType('pdf');
    else if (['ppt', 'pptx', 'key'].includes(ext || '')) setResType('slides');
    else if (['doc', 'docx', 'txt', 'rtf'].includes(ext || '')) setResType('doc');
    else if (['xls', 'xlsx', 'csv'].includes(ext || '')) setResType('worksheet');

    const reader = new FileReader();
    reader.onload = (loadEvt) => {
      setResFileDataUrl((loadEvt.target?.result as string) || '');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveResource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resTitle.trim()) {
      alert('Please enter a title for the learning resource.');
      return;
    }
    if (!selectedClassId) {
      alert('Please select a classroom first.');
      return;
    }
    if (['link', 'video'].includes(resType) && !resExternalLink.trim()) {
      alert('Please enter a valid web link (URL).');
      return;
    }

    if (onCreateResource) {
      setIsUploadingResource(true);
      onCreateResource({
        class_id: selectedClassId,
        title: resTitle.trim(),
        description: resDesc.trim(),
        resource_type: resType,
        file_name: resFileName || (resType === 'link' ? 'External Web Link' : 'Study Resource File'),
        file_url: resFileDataUrl || resExternalLink,
        file_size: resFileSize,
        external_link: resExternalLink.trim(),
        topic_tag: resTopicTag.trim(),
      });
      setTimeout(() => {
        setIsUploadingResource(false);
        setResTitle('');
        setResDesc('');
        setResFileName('');
        setResFileDataUrl('');
        setResFileSize('');
        setResExternalLink('');
        setResTopicTag('');
        setIsResourceFormExpanded(false);
      }, 250);
    }
  };

  // Handle Broadcast Message Post (Inline Full-Page)
  const handlePostBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim()) {
      alert('Please enter an announcement title.');
      return;
    }
    if (!broadcastContent.trim()) {
      alert('Please enter message content for the announcement.');
      return;
    }
    if (!selectedClassId) {
      alert('Please select a classroom first.');
      return;
    }

    if (onCreateBroadcast) {
      setIsPostingBroadcast(true);
      onCreateBroadcast({
        class_id: selectedClassId,
        title: broadcastTitle.trim(),
        content: broadcastContent.trim(),
        is_pinned: broadcastIsPinned,
        priority: broadcastPriority,
        tagged_resource_ids: broadcastTaggedResourceIds,
      });
      setTimeout(() => {
        setIsPostingBroadcast(false);
        setBroadcastTitle('');
        setBroadcastContent('');
        setBroadcastPriority('normal');
        setBroadcastIsPinned(false);
        setBroadcastTaggedResourceIds([]);
      }, 250);
    }
  };

  const toggleTagResource = (resId: string) => {
    setBroadcastTaggedResourceIds((prev) =>
      prev.includes(resId) ? prev.filter((id) => id !== resId) : [...prev, resId]
    );
  };

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

  let reportText = `Daily Classroom Attendance Report — Woodlem Park School\nDate: ${selectedDate}\nClassroom: ${homeroomLabel}\nClass Teacher: ${currentUser.name}\n\n`;
  reportText += `Total Enrolled: ${homeroomStudents.length}\nMarked Present: ${presentCount} (${attendanceRate}%)\nPermit Leave (PL): ${authCount}\nAbsences (A): ${unauthCount}\n`;
  if (authNames.length > 0) {
    reportText += `\nPermit Leaves (PL):\n` + authNames.map((n) => `- ${n}`).join('\n') + '\n';
  }
  if (unauthNames.length > 0) {
    reportText += `\nAbsences (A):\n` + unauthNames.map((n) => `- ${n}`).join('\n') + '\n';
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

  // Filter syllabus strictly for active classroom
  const activeClassSyllabus = useMemo(() => {
    if (!activeClassObj) return [];
    const subName = (activeClassObj.subject || currentUser.subject || '').toLowerCase().trim();
    const clsName = activeClassObj.name.toLowerCase().trim();
    const gradeSection = (activeClassObj.class_name || '').toLowerCase().replace(/grade\s*/gi, '').trim();

    return syllabus.filter((term) => {
      // 1. Direct class_id link
      if (term.class_id && term.class_id === activeClassObj.id) return true;

      // 2. Matching subject
      if (term.subject) {
        const tSub = term.subject.toLowerCase().trim();
        const matchesSub = tSub === subName || tSub === clsName || clsName.includes(tSub) || (subName && subName.includes(tSub));
        if (matchesSub) {
          if (!term.class_name) return true;
          const tCn = term.class_name.toLowerCase().replace(/grade\s*/gi, '').trim();
          return !gradeSection || tCn.includes(gradeSection) || gradeSection.includes(tCn);
        }
        return false;
      }

      // 3. Term name contains subject or class name
      const tName = term.name.toLowerCase();
      if (subName && tName.includes(subName)) return true;
      if (clsName && tName.includes(clsName)) return true;

      return false;
    });
  }, [syllabus, activeClassObj, currentUser.subject]);

  // Syllabus progress for active class
  let totalTopics = 0;
  let teacherDone = 0;
  activeClassSyllabus.forEach((term) => {
    (term.topics || []).forEach((topic) => {
      totalTopics++;
      if (topic.teacher_checked) teacherDone++;
    });
  });
  const overallPct = totalTopics > 0 ? Math.round((teacherDone / totalTopics) * 100) : 0;

  // Filter achievements (only show awards for students in this teacher's homeroom section)
  const filteredAwards = achievements.filter((aw) => {
    const isHomeroomStudent = homeroomStudents.some((hs) => hs.id === aw.student_id);
    if (!isHomeroomStudent) return false;

    const student = profiles.find((s) => s.id === aw.student_id);
    const sName = student ? student.name.toLowerCase() : '';
    const term = awardSearch.toLowerCase();
    return (
      aw.title.toLowerCase().includes(term) ||
      sName.includes(term) ||
      (aw.description || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="app-viewport">
      {/* REDESIGNED SIDEBAR */}
      <aside className={`sidebar ${sidebar.isCollapsed ? 'collapsed' : ''}`}>
        {/* LOGO */}
        <div style={{ padding: sidebar.isCollapsed ? '16px 0 0 0' : '16px 16px 0 16px', flexShrink: 0, overflow: 'hidden' }}>
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
            textAlign: 'center',
          }}>
            Faculty Workspace Console
          </div>
        )}

        {/* PROFILE CARD */}
        {sidebar.isCollapsed ? (
          <div style={{ padding: '12px 0 6px', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
            <div
              title={`${currentUser.name} • ${currentUser.subject || 'Faculty'}${homeroomClassInfo.isClassTeacher ? ` • ${homeroomLabel}` : ''}`}
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: '#8A532B',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: 700,
                overflow: 'hidden',
                flexShrink: 0,
                border: '1.5px solid #E8E5DF',
              }}
            >
              {sidebarAvatarUrl ? (
                <img
                  src={sidebarAvatarUrl}
                  alt={currentUser.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                (currentUser.name || 'T').charAt(0).toUpperCase()
              )}
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
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: '#8A532B',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: 700,
                overflow: 'hidden',
                flexShrink: 0,
                border: '1.5px solid #E8E5DF',
              }}
            >
              {sidebarAvatarUrl ? (
                <img
                  src={sidebarAvatarUrl}
                  alt={currentUser.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                (currentUser.name || 'T').charAt(0).toUpperCase()
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.25 }}>
                {currentUser.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  background: '#1A1A1A',
                  color: '#FFFFFF',
                  padding: '2px 7px',
                  borderRadius: 4,
                  textTransform: 'uppercase',
                  lineHeight: 1.25,
                }}>
                  {currentUser.subject || 'Faculty'}
                </span>
              </div>
              <div style={{ fontSize: 10.5, color: '#7A7873', fontWeight: 600, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {homeroomClassInfo.isClassTeacher ? `${homeroomLabel} [Class Teacher]` : 'Subject Faculty'}
              </div>
            </div>
          </div>
        )}

        <nav className="nav-menu">
          {/* SPECIAL HOD HUB IF APPOINTED */}
          {(userHodAssignment || isHodUser(currentUser)) && (
            <div className="sidebar-tooltip-wrapper">
              <button
                className={`nav-item ${activeNavMode === 'hod_hub' && !isMarkEntryOpen ? 'active' : ''}`}
                onClick={() => {
                  setIsMarkEntryOpen(false);
                  setActiveNavMode('hod_hub');
                  sidebar.handleNavClick();
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                  <ShieldCheck
                    size={15}
                    className="icon"
                    style={{
                      color: activeNavMode === 'hod_hub' && !isMarkEntryOpen ? '#FFFFFF' : '#7C5CBF',
                      flexShrink: 0,
                    }}
                  />
                  <span className="sidebar-text" style={{ flex: 1, fontWeight: 600 }}>
                    {userDepartmentDef ? `HOD ${userDepartmentDef.code}` : 'HOD Hub'}
                  </span>
                  <span
                    className="sidebar-text"
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      padding: '1px 5px',
                      borderRadius: 3,
                      background: activeNavMode === 'hod_hub' && !isMarkEntryOpen ? '#454340' : '#F3EFFA',
                      color: activeNavMode === 'hod_hub' && !isMarkEntryOpen ? '#FFFFFF' : '#6D28D9',
                      border: activeNavMode === 'hod_hub' && !isMarkEntryOpen ? '1px solid #5A5854' : '1px solid #DDD6FE',
                    }}
                  >
                    HOD
                  </span>
                </div>
              </button>
              {sidebar.isCollapsed && (
                <div className="sidebar-tooltip">HOD Department Hub ({userDepartmentDef?.name || 'Department'})</div>
              )}
            </div>
          )}

          {/* 1. HOMEROOM / CLASS TEACHER SECTION */}
          <div className="sidebar-tooltip-wrapper">
            <button
              className={`nav-item ${activeNavMode === 'homeroom_attendance' && !isMarkEntryOpen ? 'active' : ''}`}
              onClick={() => {
                setIsMarkEntryOpen(false);
                setActiveNavMode('homeroom_attendance');
                sidebar.handleNavClick();
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                <UserCheck size={15} className="icon" style={{ color: activeNavMode === 'homeroom_attendance' && !isMarkEntryOpen ? '#2C6E6A' : 'var(--text-secondary)', flexShrink: 0 }} />
                <span className="sidebar-text" style={{ flex: 1 }}>Attendance &amp; Roll Call</span>
              </div>
            </button>
            {sidebar.isCollapsed && (
              <div className="sidebar-tooltip">Attendance &amp; Roll Call</div>
            )}
          </div>

          <div className="sidebar-tooltip-wrapper">
            <button
              className={`nav-item ${activeNavMode === 'homeroom_awards' && !isMarkEntryOpen ? 'active' : ''}`}
              onClick={() => {
                setIsMarkEntryOpen(false);
                setActiveNavMode('homeroom_awards');
                sidebar.handleNavClick();
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                <Award size={15} className="icon" style={{ color: activeNavMode === 'homeroom_awards' && !isMarkEntryOpen ? '#FFFFFF' : 'var(--text-secondary)', flexShrink: 0 }} />
                <span className="sidebar-text" style={{ flex: 1 }}>Student Achievements</span>
              </div>
            </button>
            {sidebar.isCollapsed && (
              <div className="sidebar-tooltip">Student Achievements</div>
            )}
          </div>

          <div className="sidebar-tooltip-wrapper">
            <button
              className={`nav-item ${activeNavMode === 'homeroom_resources' && !isMarkEntryOpen ? 'active' : ''}`}
              onClick={() => {
                setIsMarkEntryOpen(false);
                setActiveNavMode('homeroom_resources');
                sidebar.handleNavClick();
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                <FileText size={15} className="icon" style={{ color: activeNavMode === 'homeroom_resources' && !isMarkEntryOpen ? '#FFFFFF' : 'var(--text-secondary)', flexShrink: 0 }} />
                <span className="sidebar-text" style={{ flex: 1 }}>Class Resources</span>
              </div>
            </button>
            {sidebar.isCollapsed && (
              <div className="sidebar-tooltip">Class Resources & Circulars</div>
            )}
          </div>

          <div className="sidebar-tooltip-wrapper">
            <button
              className={`nav-item ${activeNavMode === 'homeroom_codes' && !isMarkEntryOpen ? 'active' : ''}`}
              onClick={() => {
                setIsMarkEntryOpen(false);
                setActiveNavMode('homeroom_codes');
                sidebar.handleNavClick();
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                <KeyRound size={15} className="icon" style={{ color: activeNavMode === 'homeroom_codes' && !isMarkEntryOpen ? '#2D6E5D' : 'var(--text-secondary)', flexShrink: 0 }} />
                <span className="sidebar-text" style={{ flex: 1 }}>Parent Access Codes</span>
              </div>
            </button>
            {sidebar.isCollapsed && (
              <div className="sidebar-tooltip">Parent Access Codes</div>
            )}
          </div>

          {/* 2. SUBJECT CLASSROOMS */}
          <div className="sidebar-nav-divider" />
          <div style={{ padding: '4px 4px' }}>
            <span className="nav-label" style={{ margin: 0 }}>
              Classrooms ({teacherClasses.length})
            </span>
          </div>

          {/* Quick Create Class button in sidebar */}
          <div className="sidebar-tooltip-wrapper">
            <button
              className="nav-item"
              onClick={() => {
                onOpenCreateClassModal();
                sidebar.handleNavClick();
              }}
              style={{
                border: '1px dashed rgba(44, 110, 106, 0.35)',
                background: 'rgba(44, 110, 106, 0.03)',
                color: 'var(--primary)',
                marginBottom: 4,
                padding: sidebar.isCollapsed ? '8px 0' : '7px 10px',
                justifyContent: sidebar.isCollapsed ? 'center' : 'flex-start',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', justifyContent: sidebar.isCollapsed ? 'center' : 'flex-start' }}>
                <Plus size={15} className="icon" style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <span className="sidebar-text" style={{ fontWeight: 600, fontSize: 12 }}>Create Class</span>
              </div>
            </button>
            {sidebar.isCollapsed && (
              <div className="sidebar-tooltip">Create Subject Class</div>
            )}
          </div>

          {teacherClasses.length === 0 ? (
            <div className="sidebar-text" style={{ padding: '4px 8px 8px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 11 }}>
              No subject classrooms created yet.
            </div>
          ) : (
            teacherClasses.map((cls) => {
              const isSelected = activeNavMode === 'class' && selectedClassId === cls.id && !isMarkEntryOpen;
              return (
                <div key={cls.id} className="sidebar-tooltip-wrapper">
                  <button
                    className={`nav-item ${isSelected ? 'active' : ''}`}
                    onClick={() => {
                      setIsMarkEntryOpen(false);
                      setSelectedClassId(cls.id);
                      setActiveNavMode('class');
                      sidebar.handleNavClick();
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                      <BookOpen size={15} className="icon" style={{ color: isSelected ? '#FFFFFF' : 'var(--text-secondary)', flexShrink: 0 }} />
                      <div className="sidebar-text" style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: isSelected ? 700 : 600, color: isSelected ? '#FFFFFF' : 'var(--neutral-dark)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 12.5 }}>
                          {cls.name}
                        </div>
                        <div className="sidebar-classroom-sub" style={{ color: isSelected ? 'rgba(255, 255, 255, 0.7)' : 'var(--text-secondary)' }}>
                          {cls.class_name} {cls.room ? `· ${cls.room}` : ''}
                        </div>
                      </div>
                    </div>
                  </button>
                  {sidebar.isCollapsed && (
                    <div className="sidebar-tooltip">{cls.name} ({cls.class_name})</div>
                  )}
                </div>
              );
            })
          )}

          {/* 3. HOLISTIC HUB & PROGRAMS */}
          <div className="sidebar-nav-divider" />
          <div className="sidebar-tooltip-wrapper">
            <button
              className={`nav-item ${activeNavMode === 'hub' && !isMarkEntryOpen ? 'active' : ''}`}
              onClick={() => {
                setIsMarkEntryOpen(false);
                setActiveNavMode('hub');
                sidebar.handleNavClick();
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                <LayoutDashboard size={15} className="icon" style={{ color: activeNavMode === 'hub' && !isMarkEntryOpen ? '#FFFFFF' : 'var(--text-secondary)', flexShrink: 0 }} />
                <span className="sidebar-text" style={{ flex: 1 }}>My Activities</span>
              </div>
            </button>
            {sidebar.isCollapsed && (
              <div className="sidebar-tooltip">My Published Activities</div>
            )}
          </div>
        </nav>

        {/* SIDEBAR FOOTER */}
        <div className="sidebar-footer">
          <div className="sidebar-tooltip-wrapper">
            <button
              className={`logout-btn-clean ${activeNavMode === 'settings' && !isMarkEntryOpen ? 'active' : ''}`}
              onClick={() => {
                setIsMarkEntryOpen(false);
                setActiveNavMode('settings');
                sidebar.handleNavClick();
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                <Settings size={15} className="icon" style={{ flexShrink: 0 }} />
                <span className="sidebar-text">Settings</span>
              </div>
            </button>
            {sidebar.isCollapsed && (
              <div className="sidebar-tooltip">Settings &amp; Passwords</div>
            )}
          </div>

          <div className="sidebar-tooltip-wrapper">
            <button
              className={`logout-btn-clean ${activeNavMode === 'support' && !isMarkEntryOpen ? 'active' : ''}`}
              onClick={() => {
                setIsMarkEntryOpen(false);
                setActiveNavMode('support');
                sidebar.handleNavClick();
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                <LifeBuoy size={15} className="icon" style={{ flexShrink: 0 }} />
                <span className="sidebar-text">Help &amp; Support</span>
              </div>
            </button>
            {sidebar.isCollapsed && (
              <div className="sidebar-tooltip">Help &amp; Support</div>
            )}
          </div>

          <div className="sidebar-tooltip-wrapper">
            <button
              className="logout-btn-clean"
              onClick={sidebar.toggleCollapse}
              title={sidebar.isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                {sidebar.isCollapsed ? (
                  <ChevronRight size={15} className="icon" style={{ flexShrink: 0 }} />
                ) : (
                  <ChevronLeft size={15} className="icon" style={{ flexShrink: 0 }} />
                )}
                <span className="sidebar-text">Collapse Sidebar</span>
              </div>
            </button>
            {sidebar.isCollapsed && (
              <div className="sidebar-tooltip">Expand Sidebar</div>
            )}
          </div>

          <div className="sidebar-tooltip-wrapper">
            <button className="logout-btn-clean" onClick={onSignOut}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                <LogOut size={15} className="icon" style={{ flexShrink: 0 }} />
                <span className="sidebar-text">Sign Out</span>
              </div>
            </button>
            {sidebar.isCollapsed && (
              <div className="sidebar-tooltip">Sign Out</div>
            )}
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT VIEWPORT */}
      <main className="main-content">
        {isMarkEntryOpen ? (
          <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
            <MarkEntryModal
              inline
              isOpen
              onClose={() => setIsMarkEntryOpen(false)}
              classRoom={activeClassObj}
              teacher={currentUser}
              profiles={profiles}
            />
          </div>
        ) : <>
        {/* VIEW 1: SUBJECT CLASSROOM VIEW */}
        {activeNavMode === 'class' && (
          <>
            <header className="content-header">
              <div className="header-top" style={{ alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: '#EAF3EF', color: '#2D6E5D', border: '1px solid #C7E4D8', textTransform: 'uppercase' }}>
                      {activeClassObj?.subject || currentUser.subject || 'Faculty'}
                    </span>
                    {activeClassObj && (
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        Target: {activeClassObj.class_name} {activeClassObj.room ? `| ${activeClassObj.room}` : ''}
                      </span>
                    )}
                  </div>
                  <h1 className="page-title" style={{ margin: 0 }}>
                    {activeClassObj ? activeClassObj.name : 'No Class Selected'}
                  </h1>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {activeClassObj && (
                    <button
                      onClick={() => setIsEditClassModalOpen(true)}
                      className="btn-secondary"
                      style={{ padding: '7px 12px', fontSize: 12 }}
                      title="Edit class details"
                    >
                      Edit Class
                    </button>
                  )}
                  {activeClassObj && (
                    <>
                      <button
                        className="btn-secondary"
                        onClick={() => onOpenCreateAssignmentModal(`${activeClassObj.name} (${activeClassObj.class_name})`)}
                        style={{ padding: '7px 12px', fontSize: 12 }}
                      >
                        + Homework
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={() => setIsMarkEntryOpen(true)}
                        style={{ padding: '7px 12px', fontSize: 12 }}
                      >
                        Mark Entry
                      </button>
                      <button
                        className="btn-primary"
                        onClick={() => onOpenCreateTestModal(`${activeClassObj.name} (${activeClassObj.class_name})`)}
                        style={{ padding: '7px 16px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}
                      >
                        <Plus size={14} />
                        <span>Create Class Test</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

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
                  Class Tests
                  <span className="tab-count">{classTests.length + classAssignments.length}</span>
                </button>
                <button
                  className={`tab-btn ${classSubTab === 'syllabus' ? 'active' : ''}`}
                  onClick={() => setClassSubTab('syllabus')}
                >
                  Syllabus
                  <span className="tab-count">{overallPct}%</span>
                </button>
                <button
                  className={`tab-btn ${classSubTab === 'students' ? 'active' : ''}`}
                  onClick={() => setClassSubTab('students')}
                >
                  Students
                  <span className="tab-count">{classStudents.length}</span>
                </button>
              </div>
            </header>

            <div className="content-body" style={{ padding: '28px 32px' }}>
              {!activeClassObj ? (
                <div style={{ padding: '64px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(44, 110, 106, 0.08)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                    <BookOpen size={24} />
                  </div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px', color: 'var(--neutral-dark)' }}>No Subject Class Selected</h3>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 420, margin: '0 0 20px', lineHeight: 1.5 }}>
                    {teacherClasses.length === 0
                      ? "You haven't created any subject classrooms yet. Create your first class to enroll students, assign homework/tests, and upload learning resources."
                      : "Select a subject classroom from the left sidebar or create a new class to manage students, tests, and announcements."}
                  </p>
                  <button
                    className="btn-primary"
                    onClick={onOpenCreateClassModal}
                    style={{ padding: '8px 18px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <Plus size={15} />
                    <span>Create Subject Class</span>
                  </button>
                </div>
              ) : (
                <>
                  {/* SUBTAB 1: STREAM & BROADCASTS */}
                  {classSubTab === 'broadcasts' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                      {/* INLINE BROADCAST COMPOSER (Full-Page Card) */}
                      <div
                        style={{
                          background: '#FFFFFF',
                          border: '1px solid var(--border-color)',
                          borderRadius: 10,
                          padding: '20px 24px',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                        }}
                      >
                        <div style={{ marginBottom: 14 }}>
                          <h4 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                            Post Announcement to {activeClassObj.name}
                          </h4>
                          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                            Broadcast notices, instructions, and homework updates to all enrolled students with tagged resources.
                          </p>
                        </div>

                        <form onSubmit={handlePostBroadcast}>
                          {/* Announcement Title */}
                          <div style={{ marginBottom: 12 }}>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="Announcement Title (e.g., Physics Lab Session & Revision Materials)"
                              value={broadcastTitle}
                              onChange={(e) => setBroadcastTitle(e.target.value)}
                              style={{ width: '100%', fontSize: 13, fontWeight: 600, padding: '9px 12px' }}
                            />
                          </div>

                          {/* Announcement Message Body */}
                          <div style={{ marginBottom: 14 }}>
                            <textarea
                              className="form-input"
                              rows={3}
                              placeholder="Write announcement details, guidelines, or homework instructions for the class..."
                              value={broadcastContent}
                              onChange={(e) => setBroadcastContent(e.target.value)}
                              style={{ width: '100%', fontSize: 12.5, lineHeight: 1.5, padding: '10px 12px', resize: 'vertical' }}
                            />
                          </div>

                          {/* Control Strip: Priority, Pin, and Resource Tagging */}
                          <div
                            style={{
                              background: '#FAF9F6',
                              border: '1px solid #EAE8E3',
                              borderRadius: 8,
                              padding: '12px 16px',
                              marginBottom: 16,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 12,
                            }}
                          >
                            {/* Priority & Pin Controls */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                                  Priority:
                                </span>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  {(['normal', 'important', 'urgent'] as const).map((pri) => (
                                    <button
                                      key={pri}
                                      type="button"
                                      onClick={() => setBroadcastPriority(pri)}
                                      style={{
                                        padding: '4px 10px',
                                        fontSize: 11,
                                        fontWeight: 600,
                                        borderRadius: 4,
                                        border: broadcastPriority === pri ? '1px solid transparent' : '1px solid #DDD',
                                        background:
                                          broadcastPriority === pri
                                            ? pri === 'urgent'
                                              ? '#A83B38'
                                              : pri === 'important'
                                              ? '#B86E14'
                                              : '#2C6E6A'
                                            : '#FFFFFF',
                                        color: broadcastPriority === pri ? '#FFFFFF' : 'var(--neutral-dark)',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      {pri === 'urgent' ? 'Urgent' : pri === 'important' ? 'Important' : 'Standard'}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--neutral-dark)' }}>
                                <input
                                  type="checkbox"
                                  checked={broadcastIsPinned}
                                  onChange={(e) => setBroadcastIsPinned(e.target.checked)}
                                  style={{ accentColor: '#2C6E6A', cursor: 'pointer' }}
                                />
                                Pin to Top of Class Stream
                              </label>
                            </div>

                            {/* Resource Tagging Chips */}
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                                  Tag / Attach Uploaded Resources ({broadcastTaggedResourceIds.length} tagged):
                                </span>
                                {thisClassResources.length > 0 && (
                                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                    Click any resource below to attach it to this announcement
                                  </span>
                                )}
                              </div>

                              {thisClassResources.length === 0 ? (
                                <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: 0, fontStyle: 'italic' }}>
                                  No resources uploaded for this class yet. Switch to the <strong>Resources Hub</strong> tab to upload course materials and study sheets.
                                </p>
                              ) : (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                  {thisClassResources.map((res) => {
                                    const isTagged = broadcastTaggedResourceIds.includes(res.id);
                                    return (
                                      <button
                                        key={res.id}
                                        type="button"
                                        onClick={() => toggleTagResource(res.id)}
                                        style={{
                                          padding: '4px 10px',
                                          fontSize: 11.5,
                                          fontWeight: 600,
                                          borderRadius: 4,
                                          border: isTagged ? '1.5px solid #2C6E6A' : '1px solid #D8D6D0',
                                          background: isTagged ? '#EAF3EF' : '#FFFFFF',
                                          color: isTagged ? '#20554E' : '#555',
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 6,
                                          transition: 'all 0.15s ease',
                                        }}
                                      >
                                        <span style={{ fontSize: 9.5, fontWeight: 800, padding: '1px 4px', borderRadius: 3, background: isTagged ? '#2C6E6A' : '#EEE', color: isTagged ? '#FFF' : '#666' }}>
                                          {res.resource_type.toUpperCase()}
                                        </span>
                                        <span>{res.title}</span>
                                        <span style={{ fontWeight: 800, marginLeft: 2 }}>{isTagged ? '✓' : '+'}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Submit Bar */}
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            {(broadcastTitle || broadcastContent || broadcastTaggedResourceIds.length > 0) && (
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => {
                                  setBroadcastTitle('');
                                  setBroadcastContent('');
                                  setBroadcastPriority('normal');
                                  setBroadcastIsPinned(false);
                                  setBroadcastTaggedResourceIds([]);
                                }}
                                style={{ padding: '7px 14px', fontSize: 12 }}
                              >
                                Clear
                              </button>
                            )}
                            <button
                              type="submit"
                              className="btn-primary"
                              disabled={isPostingBroadcast}
                              style={{ padding: '8px 20px', fontSize: 12.5 }}
                            >
                              Post Announcement
                            </button>
                          </div>
                        </form>
                      </div>

                      {/* ANNOUNCEMENTS STREAM FEED */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                            Class Stream ({thisClassBroadcasts.length} Broadcasts)
                          </h4>
                          <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                            Visible to all students in {activeClassObj.name}
                          </span>
                        </div>

                        {thisClassBroadcasts.length === 0 ? (
                          <div className="panel-block" style={{ padding: '36px 24px', textAlign: 'center' }}>
                            <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px', color: 'var(--neutral-dark)' }}>
                              No Broadcasts Posted Yet
                            </h4>
                            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 auto', maxWidth: 380 }}>
                              Use the composer above to broadcast instructions, homework updates, and share study materials directly with your students.
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
                                        {(bcast.teacher_name || currentUser.name).charAt(0)}
                                      </div>
                                      <div>
                                        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                                          {bcast.teacher_name || currentUser.name}
                                          <span style={{ fontSize: 10, fontWeight: 600, color: '#2C6E6A', background: '#EAF3EF', padding: '1px 5px', borderRadius: 3, marginLeft: 6 }}>
                                            Teacher
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

                                    {/* Action buttons */}
                                    <div style={{ display: 'flex', gap: 6 }}>
                                      {onTogglePinBroadcast && (
                                        <button
                                          type="button"
                                          onClick={() => onTogglePinBroadcast(bcast.id)}
                                          title={bcast.is_pinned ? 'Unpin announcement' : 'Pin to top'}
                                          style={{
                                            padding: '3px 8px',
                                            fontSize: 11,
                                            fontWeight: 600,
                                            border: '1px solid var(--border-color)',
                                            borderRadius: 4,
                                            background: '#FFFFFF',
                                            cursor: 'pointer',
                                          }}
                                        >
                                          {bcast.is_pinned ? 'Unpin' : 'Pin'}
                                        </button>
                                      )}
                                      {onDeleteBroadcast && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (confirm(`Delete announcement "${bcast.title}"?`)) {
                                              onDeleteBroadcast(bcast.id);
                                            }
                                          }}
                                          title="Delete announcement"
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
                                      )}
                                    </div>
                                  </div>

                                  {/* Title & Body */}
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
                                        Attached Learning Resources ({taggedResources.length})
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
                                                    background: '#2D2C2A',
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
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* SUBTAB 2: RESOURCES HUB (Full-Page Inline Resource Management) */}
                  {classSubTab === 'resources' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                      {/* Top Action & Search Bar */}
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
                          <h4 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                            Classroom Learning Resources Library
                          </h4>
                          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                            Upload PDF lecture slides, revision sheets, worksheets, and reference URLs for {activeClassObj.name}.
                          </p>
                        </div>

                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => setIsResourceFormExpanded(!isResourceFormExpanded)}
                          style={{ padding: '8px 16px', fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        >
                          {isResourceFormExpanded ? (<><X size={13} /> Close Form</>) : (<><Plus size={13} /> Upload New Resource</>)}
                        </button>
                      </div>

                      {/* INLINE RESOURCE UPLOAD FORM (Full-Page Card) */}
                      {isResourceFormExpanded && (
                        <div
                          style={{
                            background: '#FFFFFF',
                            border: '1.5px solid var(--border-color)',
                            borderRadius: 10,
                            padding: '22px 26px',
                            boxShadow: '0 4px 14px rgba(44,110,106,0.08)',
                          }}
                        >
                          <div style={{ marginBottom: 16 }}>
                            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                              Add New Learning Material for {activeClassObj.name}
                            </h4>
                            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                              Students enrolled in this classroom can immediately view, tag, and download these materials.
                            </p>
                          </div>

                          <form onSubmit={handleSaveResource}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 14 }}>
                              {/* Resource Title */}
                              <div>
                                <label className="form-label" style={{ fontWeight: 700, fontSize: 12 }}>
                                  Resource Title *
                                </label>
                                <input
                                  type="text"
                                  className="form-input"
                                  placeholder="e.g. Chapter 4 Notes & Formula Cheat Sheet"
                                  value={resTitle}
                                  onChange={(e) => setResTitle(e.target.value)}
                                  required
                                />
                              </div>

                              {/* Topic Tag */}
                              <div>
                                <label className="form-label" style={{ fontWeight: 700, fontSize: 12 }}>
                                  Curriculum / Unit Tag (Optional)
                                </label>
                                <input
                                  type="text"
                                  className="form-input"
                                  placeholder="e.g. Unit 3: Thermodynamics, Lab Prep"
                                  value={resTopicTag}
                                  onChange={(e) => setResTopicTag(e.target.value)}
                                />
                              </div>
                            </div>

                            {/* Resource Type Selector */}
                            <div style={{ marginBottom: 14 }}>
                              <label className="form-label" style={{ fontWeight: 700, fontSize: 12 }}>
                                Resource Type
                              </label>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {[
                                  { id: 'pdf', label: 'PDF Document' },
                                  { id: 'slides', label: 'Slide Deck' },
                                  { id: 'worksheet', label: 'Worksheet' },
                                  { id: 'doc', label: 'Document' },
                                  { id: 'link', label: 'Web Link' },
                                  { id: 'video', label: 'Video Lecture' },
                                ].map((t) => (
                                  <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => setResType(t.id as any)}
                                    style={{
                                      padding: '6px 12px',
                                      fontSize: 12,
                                      fontWeight: 600,
                                      borderRadius: 6,
                                      border: resType === t.id ? '1.5px solid #2C6E6A' : '1px solid #DDD',
                                      background: resType === t.id ? '#EAF3EF' : '#FFFFFF',
                                      color: resType === t.id ? '#20554E' : 'var(--neutral-dark)',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    {t.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Description / Instructions */}
                            <div style={{ marginBottom: 14 }}>
                              <label className="form-label" style={{ fontWeight: 700, fontSize: 12 }}>
                                Description / Student Instructions (Optional)
                              </label>
                              <textarea
                                className="form-input"
                                rows={2}
                                placeholder="Add any study guidance, homework reminders, or syllabus references..."
                                value={resDesc}
                                onChange={(e) => setResDesc(e.target.value)}
                                style={{ width: '100%', fontSize: 12 }}
                              />
                            </div>

                            {/* File Upload OR Link Input */}
                            {['link', 'video'].includes(resType) ? (
                              <div style={{ marginBottom: 18 }}>
                                <label className="form-label" style={{ fontWeight: 700, fontSize: 12 }}>
                                  External URL / Google Drive / Video Link *
                                </label>
                                <input
                                  type="url"
                                  className="form-input"
                                  placeholder="https://drive.google.com/... or https://youtube.com/..."
                                  value={resExternalLink}
                                  onChange={(e) => setResExternalLink(e.target.value)}
                                  required
                                />
                              </div>
                            ) : (
                              <div style={{ marginBottom: 18 }}>
                                <label className="form-label" style={{ fontWeight: 700, fontSize: 12 }}>
                                  Select File to Upload
                                </label>
                                <div
                                  style={{
                                    border: '2px dashed #CCD3D5',
                                    borderRadius: 8,
                                    padding: '16px 20px',
                                    textAlign: 'center',
                                    background: '#FAFBFB',
                                    cursor: 'pointer',
                                  }}
                                  onClick={() => document.getElementById('resFileInput')?.click()}
                                >
                                  <input
                                    id="resFileInput"
                                    type="file"
                                    style={{ display: 'none' }}
                                    onChange={handleResourceFileChange}
                                    accept=".pdf,.ppt,.pptx,.key,.doc,.docx,.xls,.xlsx,.csv,.txt,.rtf,.png,.jpg,.jpeg,.zip"
                                  />
                                  {resFileName ? (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                      <span style={{ fontSize: 13, fontWeight: 700, color: '#2C6E6A' }}>{resFileName}</span>
                                      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>({resFileSize})</span>
                                    </div>
                                  ) : (
                                    <div>
                                      <p style={{ margin: '4px 0 2px', fontSize: 12.5, fontWeight: 600, color: 'var(--neutral-dark)' }}>
                                        Click to choose file (PDF, PPT, Word, Excel, Images, ZIP)
                                      </p>
                                      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                        Stored securely for instant viewing and downloading by enrolled students.
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Submit buttons */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => setIsResourceFormExpanded(false)}
                                style={{ padding: '8px 16px', fontSize: 12 }}
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                className="btn-primary"
                                disabled={isUploadingResource}
                                style={{ padding: '8px 20px', fontSize: 12.5 }}
                              >
                                Upload &amp; Share with Class
                              </button>
                            </div>
                          </form>
                        </div>
                      )}

                      {/* Search & Filter Bar */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                        {/* Search Input */}
                        <div style={{ flex: '1 1 240px', minWidth: 220 }}>
                          <input
                            type="text"
                            placeholder="Search resources by title, topic tag, or file name..."
                            value={resSearchQuery}
                            onChange={(e) => setResSearchQuery(e.target.value)}
                            style={{
                              width: '100%',
                              height: 32,
                              padding: '0 12px',
                              fontSize: 12,
                              borderRadius: 6,
                              border: '1px solid #E5E3DF',
                              background: '#FFFFFF',
                              color: '#1A1A1A',
                              outline: 'none',
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>

                        {/* Type Filter Pills */}
                        <div style={{ display: 'flex' }}>
                          <SegmentedControl
                            value={resTypeFilter}
                            onChange={(val) => setResTypeFilter(val as any)}
                            options={[
                              { value: 'all', label: `All (${thisClassResources.length})` },
                              { value: 'pdf', label: `PDFs (${thisClassResources.filter((r) => r.resource_type === 'pdf').length})` },
                              { value: 'slides', label: `Slides (${thisClassResources.filter((r) => r.resource_type === 'slides').length})` },
                              { value: 'worksheet', label: `Worksheets (${thisClassResources.filter((r) => r.resource_type === 'worksheet').length})` },
                              { value: 'link', label: `Links (${thisClassResources.filter((r) => r.resource_type === 'link').length})` },
                            ]}
                            height={32}
                            textTransform="none"
                          />
                        </div>
                      </div>

                      {/* RESOURCES GRID */}
                      {filteredThisClassResources.length === 0 ? (
                        <div className="panel-block" style={{ padding: '36px 24px', textAlign: 'center' }}>
                          <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px', color: 'var(--neutral-dark)' }}>
                            No Resources Found
                          </h4>
                          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 auto 12px', maxWidth: 360 }}>
                            {thisClassResources.length === 0
                              ? 'No learning materials uploaded for this classroom yet. Click "+ Upload New Resource" above to add course materials.'
                              : 'No resources match your search filter.'}
                          </p>
                          {thisClassResources.length === 0 && (
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={() => setIsResourceFormExpanded(true)}
                              style={{ padding: '7px 16px', fontSize: 12 }}
                            >
                              + Upload First Resource
                            </button>
                          )}
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

                                {/* Actions */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid #F0EFEA' }}>
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
                                        padding: '5px 12px',
                                        fontSize: 11.5,
                                        fontWeight: 700,
                                        background: '#2D2C2A',
                                        color: '#FFFFFF',
                                        border: 'none',
                                        borderRadius: 4,
                                        cursor: 'pointer',
                                      }}
                                    >
                                      Open in New Tab ↗
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
                                        padding: '5px 10px',
                                        fontSize: 12,
                                        fontWeight: 700,
                                        background: '#FAF9F6',
                                        color: 'var(--neutral-dark)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 4,
                                        cursor: 'pointer',
                                      }}
                                    >
                                      ↓
                                    </button>
                                  </div>

                                  {onDeleteResource && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (confirm(`Delete learning resource "${res.title}"?`)) {
                                          onDeleteResource(res.id);
                                        }
                                      }}
                                      style={{
                                        padding: '4px 8px',
                                        fontSize: 10.5,
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
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* SUBTAB 3: TASKS & ASSESSMENTS (Tests & Assignments) */}
                  {classSubTab === 'tasks' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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
                            Active Class Tests
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

                      {/* Class Tests & Tasks */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <h3 className="section-title" style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>
                            Class Tests &amp; Homework for {activeClassObj.name}
                          </h3>
                        </div>
                        <div className="card-list">
                          {classTests.length === 0 && classAssignments.length === 0 ? (
                            <div className="panel-block" style={{ padding: '24px', textAlign: 'center' }}>
                              <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>
                                No class tests or assignments currently published for this class.
                              </p>
                            </div>
                          ) : (
                            <>
                              {classTests.map((test) => {
                                const submissionsForTest = Object.entries(testResults)
                                  .filter(([key]) => key.startsWith(`${test.id}_`))
                                  .map(([_, rec]) => rec);
                                const count = submissionsForTest.length;

                                return (
                                  <div className="item-card" key={test.id} style={{ padding: '12px 16px' }}>
                                    <div className="item-info">
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                        <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 5px', borderRadius: 3, background: '#F0F4F4', color: '#2C6E6A' }}>
                                          CLASS TEST
                                        </span>
                                        {test.class_name && (
                                          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                            {test.class_name}
                                          </span>
                                        )}
                                      </div>
                                      <div className="item-title" style={{ fontSize: 13, fontWeight: 700 }}>
                                        {test.title}
                                      </div>
                                      <div className="item-meta">
                                        Published · {count} {count === 1 ? 'submission' : 'submissions'}
                                      </div>
                                    </div>
                                    <div className="item-actions" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                      <button
                                        type="button"
                                        onClick={() => setSelectedReviewTest(test)}
                                        style={{
                                          padding: '5px 12px',
                                          fontSize: 11,
                                          fontWeight: 700,
                                          background: count > 0 ? '#2C6E6A' : '#FFFFFF',
                                          color: count > 0 ? '#FFFFFF' : 'var(--neutral-dark)',
                                          border: '1px solid ' + (count > 0 ? '#2C6E6A' : 'var(--border-color)'),
                                          borderRadius: 4,
                                          cursor: 'pointer',
                                        }}
                                      >
                                        Review Results ({count})
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (confirm(`Are you sure you want to delete class test "${test.title}"?`)) {
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
                                const subsForAss = Object.entries(assignmentSubmissions)
                                  .filter(([key]) => key.startsWith(`${ass.id}_`))
                                  .map(([_, rec]) => rec);
                                const count = subsForAss.length;

                                return (
                                  <div className="item-card" key={ass.id} style={{ padding: '12px 16px' }}>
                                    <div className="item-info">
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                        <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 5px', borderRadius: 3, background: '#FBF6F0', color: '#B37D4A' }}>
                                          ASSIGNMENT
                                        </span>
                                        {ass.class_name && (
                                          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                            {ass.class_name}
                                          </span>
                                        )}
                                      </div>
                                      <div className="item-title" style={{ fontSize: 13, fontWeight: 700 }}>
                                        {ass.title}
                                      </div>
                                      <div className="item-meta">
                                        Published · {count} {count === 1 ? 'submission' : 'submissions'}
                                      </div>
                                    </div>
                                    <div className="item-actions" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                      <button
                                        type="button"
                                        onClick={() => setSelectedGradeAssignment(ass)}
                                        style={{
                                          padding: '5px 12px',
                                          fontSize: 11,
                                          fontWeight: 700,
                                          background: count > 0 ? '#B37D4A' : '#FFFFFF',
                                          color: count > 0 ? '#FFFFFF' : 'var(--neutral-dark)',
                                          border: '1px solid ' + (count > 0 ? '#B37D4A' : 'var(--border-color)'),
                                          borderRadius: 4,
                                          cursor: 'pointer',
                                        }}
                                      >
                                        Grade Homework ({count})
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
                    </div>
                  )}

                  {/* SUBTAB 4: SYLLABUS COVERAGE */}
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
                          <button
                            className="btn-primary"
                            onClick={() =>
                              onOpenAddTermModal(
                                activeClassObj
                                  ? {
                                      id: activeClassObj.id,
                                      subject: activeClassObj.subject || currentUser.subject,
                                      className: activeClassObj.class_name,
                                    }
                                  : undefined
                              )
                            }
                            style={{ padding: '6px 14px', fontSize: 12 }}
                          >
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

                      {activeClassSyllabus.length === 0 ? (
                        <div style={{ padding: '64px 24px', textAlign: 'center' }}>
                          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>
                            No syllabus terms published for {activeClassObj?.name || 'this class'} yet.
                          </p>
                        </div>
                      ) : (
                        activeClassSyllabus.map((term) => (
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
                                        style={{ padding: '2px 6px', fontSize: 10, fontWeight: 600, border: '1px solid #F5C6CB', borderRadius: 3, background: '#FDF1F0', color: '#A83B38', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                      >
                                        <X size={10} />
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

                  {/* SUBTAB 5: ENROLLED STUDENTS */}
                  {classSubTab === 'students' && (
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
                            Enrolled Students ({classStudents.length})
                          </h4>
                          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                            Students who have active access to this classroom, its broadcasts, resources, and assessments.
                          </p>
                        </div>

                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => setIsEditClassModalOpen(true)}
                          style={{ padding: '6px 14px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                        >
                          <Edit3 size={13} /> Edit Class Students
                        </button>
                      </div>

                      <div className="panel-block" style={{ padding: 0, overflow: 'hidden' }}>
                        {classStudents.length === 0 ? (
                          <div style={{ padding: '36px 20px', textAlign: 'center' }}>
                            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 10px' }}>
                              No students enrolled in this subject classroom yet.
                            </p>
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={() => setIsEditClassModalOpen(true)}
                              style={{ padding: '6px 14px', fontSize: 12 }}
                            >
                              + Edit Class to Add Students
                            </button>
                          </div>
                        ) : (
                          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ background: '#F8F9FA', borderBottom: '1px solid var(--border-color)' }}>
                                <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>
                                  STUDENT NAME
                                </th>
                                <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>
                                  ADMISSION / CODE
                                </th>
                                <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>
                                  HOMEROOM
                                </th>
                                <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>
                                  EMAIL
                                </th>
                                <th style={{ textAlign: 'right', padding: '10px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>
                                  ACTIONS
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {classStudents.map((st, idx) => (
                                <tr key={st.id || idx} style={{ borderBottom: '1px solid #F0EFEA' }}>
                                  <td style={{ padding: '10px 16px', fontSize: 12.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                                    {st.name}
                                  </td>
                                  <td style={{ padding: '10px 16px', fontSize: 12, color: '#65635E' }}>
                                    {st.admission_number || st.user_code || '—'}
                                  </td>
                                  <td style={{ padding: '10px 16px', fontSize: 12, color: '#65635E' }}>
                                    Grade {st.grade || '—'}{st.class_letter ? `-${st.class_letter}` : ''}
                                  </td>
                                  <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-secondary)' }}>
                                    {st.email || '—'}
                                  </td>
                                  <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const remainingIds = (activeClassObj.enrolled_student_ids || []).filter(
                                          (id) => id !== st.id && id !== st.email
                                        );
                                        onUpdateClassEnrollment(activeClassObj.id, remainingIds);
                                      }}
                                      style={{
                                        padding: '3px 8px',
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
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {/* VIEW 2: HOMEROOM ATTENDANCE & ROLL CALL (WITH RAPID DAILY ROLL CALL & MONTHLY MATRIX) */}
        {activeNavMode === 'homeroom_attendance' && (
          !homeroomClassInfo.isClassTeacher ? (
            renderHomeroomNotice()
          ) : (
          <>
            <header className="content-header">
              <div className="header-top" style={{ alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: '#EAF3EF', color: '#2D6E5D', border: '1px solid #C7E4D8', textTransform: 'uppercase' }}>
                      Classroom Register
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {homeroomLabel}
                    </span>
                  </div>
                  <h1 className="page-title" style={{ margin: 0 }}>
                    Attendance Roll Call &amp; Records
                  </h1>
                </div>

                {attendanceViewMode === 'mark' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                        Date:
                      </label>
                      <input
                        type="date"
                        className="form-input"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        style={{ width: 145, padding: '5px 8px', fontSize: 12, fontWeight: 600 }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleMarkAllPresent}
                      style={{
                        padding: '6px 12px',
                        fontSize: 11.5,
                        fontWeight: 600,
                        background: '#EAF3EF',
                        color: '#2D6E5D',
                        border: '1px solid #C7E4D8',
                        borderRadius: 6,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Check size={13} /> Mark All Present
                    </button>
                    <button
                      type="button"
                      onClick={handleClearAllAttendance}
                      style={{
                        padding: '6px 10px',
                        fontSize: 11.5,
                        fontWeight: 600,
                        background: '#FFFFFF',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 6,
                        cursor: 'pointer',
                      }}
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveAttendanceClick}
                      style={{
                        padding: '6px 16px',
                        fontSize: 11.5,
                        fontWeight: 700,
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
                      placeholder={attendanceViewMode === 'history' ? "Search student in records..." : "Search student or reason..."}
                      value={historyStudentSearch}
                      onChange={(e) => setHistoryStudentSearch(e.target.value)}
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
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Primary Tabs */}
              <div className="tabs">
                <button
                  type="button"
                  className={`tab-btn ${attendanceViewMode === 'mark' ? 'active' : ''}`}
                  onClick={() => setAttendanceViewMode('mark')}
                >
                  Daily Roll Call ({selectedDate})
                </button>
                <button
                  type="button"
                  className={`tab-btn ${attendanceViewMode === 'history' ? 'active' : ''}`}
                  onClick={() => setAttendanceViewMode('history')}
                >
                  Monthly Matrix &amp; History
                  <span className="tab-count">{homeroomHistoryAnalytics.recordedDatesCount}</span>
                </button>
                <button
                  type="button"
                  className={`tab-btn ${attendanceViewMode === 'leaves' ? 'active' : ''}`}
                  onClick={() => setAttendanceViewMode('leaves')}
                >
                  Permit Leave (PL) Requests
                  {pendingLeaves.length > 0 ? (
                    <span className="tab-count" style={{ background: '#D97706', color: '#FFFFFF', fontWeight: 700 }}>
                      {pendingLeaves.length} Pending
                    </span>
                  ) : homeroomLeaveRequests.length > 0 ? (
                    <span className="tab-count">{homeroomLeaveRequests.length}</span>
                  ) : null}
                </button>
              </div>
            </header>

            <div className="content-body">
              {/* PENDING PERMIT LEAVE NOTIFICATION BANNER (when on other tabs) */}
              {pendingLeaves.length > 0 && attendanceViewMode !== 'leaves' && (
                <div
                  style={{
                    marginBottom: 16,
                    padding: '10px 16px',
                    borderRadius: 8,
                    background: '#FFFBEB',
                    border: '1px solid #FDE68A',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    color: '#92400E',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                    <span>🔔</span>
                    <span>
                      <strong>{pendingLeaves.length} Permit Leave (PL) request{pendingLeaves.length > 1 ? 's' : ''}</strong> submitted by students in your homeroom are awaiting review.
                    </span>
                  </div>
                  <button
                    onClick={() => setAttendanceViewMode('leaves')}
                    style={{
                      padding: '4px 12px',
                      fontSize: 11.5,
                      fontWeight: 700,
                      background: '#D97706',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: 6,
                      cursor: 'pointer',
                    }}
                  >
                    Review &amp; Approve
                  </button>
                </div>
              )}

              {/* TAB 1: RAPID DAILY ROLL CALL */}
              {attendanceViewMode === 'mark' && (
                <div>
                  {saveFeedback && (
                    <div style={{ padding: '10px 14px', borderRadius: 6, background: '#EAF3EF', color: '#2D6E5D', border: '1px solid #C7E4D8', fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
                      {saveFeedback}
                    </div>
                  )}

                  {/* Summary Metric Counter Bar */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ padding: '6px 12px', borderRadius: 6, background: '#EAF3EF', color: '#2D6E5D', border: '1px solid #C7E4D8', fontSize: 12, fontWeight: 700 }}>
                        ● {presentCount} Present
                      </div>
                      <div style={{ padding: '6px 12px', borderRadius: 6, background: '#FDF1F0', color: '#DC2626', border: '1px solid #FECACA', fontSize: 12, fontWeight: 700 }}>
                        ● {unauthCount} Absent
                      </div>
                      <div style={{ padding: '6px 12px', borderRadius: 6, background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A', fontSize: 12, fontWeight: 700 }}>
                        ● {authCount} Permit Leave (PL)
                      </div>
                      <div style={{ padding: '6px 12px', borderRadius: 6, background: '#F8F7F4', color: 'var(--text-secondary)', border: '1px solid #ECEAE5', fontSize: 12, fontWeight: 600 }}>
                        Total: {homeroomStudents.length} Students
                      </div>
                    </div>

                    <div style={{ fontSize: 11.5, color: '#6B7280', background: '#F9FAFB', padding: '6px 10px', borderRadius: 6, border: '1px solid #E5E7EB' }}>
                      ⌨️ <strong>Quick Keys:</strong> Type <kbd style={{ background: '#FFF', border: '1px solid #D1D5DB', padding: '1px 4px', borderRadius: 3, fontWeight: 700 }}>P</kbd> (Present), <kbd style={{ background: '#FFF', border: '1px solid #D1D5DB', padding: '1px 4px', borderRadius: 3, fontWeight: 700 }}>A</kbd> (Absent), or <kbd style={{ background: '#FFF', border: '1px solid #D1D5DB', padding: '1px 4px', borderRadius: 3, fontWeight: 700 }}>L</kbd> (Permit Leave) to record and auto-jump to the next student.
                    </div>
                  </div>

                  {/* Fast Roll Call Table */}
                  <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
                    {homeroomStudents.length === 0 ? (
                      <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                        No students found in your homeroom section ({homeroomLabel}).
                      </div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: '#F8F7F4', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: 10.5, textTransform: 'uppercase' }}>
                            <th style={{ textAlign: 'left', padding: '10px 14px', width: 36 }}>#</th>
                            <th style={{ textAlign: 'left', padding: '10px 14px' }}>Student Name</th>
                            <th style={{ textAlign: 'left', padding: '10px 14px', width: 140 }}>Admission No.</th>
                            <th style={{ textAlign: 'center', padding: '10px 14px', width: 90 }}>Key Entry</th>
                            <th style={{ textAlign: 'center', padding: '10px 14px', width: 320 }}>Mark Attendance</th>
                            <th style={{ textAlign: 'center', padding: '10px 14px', width: 130 }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {homeroomStudents.map((st, idx) => {
                            const status = dailyRecords[st.id] || 'present';
                            const keyLetter = status === 'present' ? 'P' : status === 'unauth_absent' ? 'A' : status === 'auth_absent' ? 'PL' : '';

                            return (
                              <tr
                                key={st.id}
                                style={{
                                  borderBottom: '1px solid #ECEAE5',
                                  background: idx % 2 === 0 ? '#FFFFFF' : '#FAF9F7',
                                }}
                              >
                                <td style={{ padding: '10px 14px', color: '#9E9B95', fontWeight: 600 }}>{idx + 1}</td>
                                <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--neutral-dark)' }}>
                                  {st.name}
                                </td>
                                <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 11.5, color: '#55534E' }}>
                                  <div>{st.admission_number || st.user_code || '—'}</div>
                                  <div style={{ fontSize: 10, color: '#2D6E5D', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <KeyRound size={10} />
                                    <span>{getOrGenerateStudentParentCode(st)}</span>
                                  </div>
                                </td>

                                {/* Quick Single-Key Input (P / A / L) with instant focus-next */}
                                <td style={{ textAlign: 'center', padding: '8px 10px' }}>
                                  <input
                                    id={`roll_key_${idx}`}
                                    type="text"
                                    maxLength={2}
                                    value={keyLetter}
                                    onChange={(e) => {
                                      const val = e.target.value.trim().toUpperCase();
                                      if (val === 'P') handleSetStudentStatus(st.id, idx, 'present');
                                      else if (val === 'A') handleSetStudentStatus(st.id, idx, 'unauth_absent');
                                      else if (val === 'L' || val === 'PL') handleSetStudentStatus(st.id, idx, 'auth_absent');
                                    }}
                                    onKeyDown={(e) => handleRapidKeyDown(e, idx, st.id)}
                                    onFocus={(e) => e.target.select()}
                                    placeholder="—"
                                    style={{
                                      width: 44,
                                      height: 32,
                                      textAlign: 'center',
                                      fontSize: 12.5,
                                      fontWeight: 800,
                                      fontFamily: 'monospace',
                                      borderRadius: 6,
                                      border: status === 'present'
                                        ? '1.5px solid #2D6E5D'
                                        : status === 'unauth_absent'
                                        ? '1.5px solid #DC2626'
                                        : status === 'auth_absent'
                                        ? '1.5px solid #D97706'
                                        : '1px solid #D1D5DB',
                                      background: status === 'present'
                                        ? '#EAF3EF'
                                        : status === 'unauth_absent'
                                        ? '#FDF1F0'
                                        : status === 'auth_absent'
                                        ? '#FEF3C7'
                                        : '#FFFFFF',
                                      color: status === 'present'
                                        ? '#2D6E5D'
                                        : status === 'unauth_absent'
                                        ? '#DC2626'
                                        : status === 'auth_absent'
                                        ? '#92400E'
                                        : '#1A1A1A',
                                      outline: 'none',
                                      cursor: 'pointer',
                                    }}
                                    title="Type P (Present), A (Absent), or L (Permit Leave)"
                                  />
                                </td>

                                {/* Quick Tap Status Buttons */}
                                <td style={{ textAlign: 'center', padding: '8px 10px' }}>
                                  <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                                    <button
                                      type="button"
                                      onClick={() => handleSetStudentStatus(st.id, idx, 'present')}
                                      style={{
                                        padding: '4px 10px',
                                        fontSize: 11.5,
                                        fontWeight: status === 'present' ? 700 : 500,
                                        borderRadius: 6,
                                        border: status === 'present' ? '1px solid #2D6E5D' : '1px solid #E5E7EB',
                                        background: status === 'present' ? '#2D6E5D' : '#FFFFFF',
                                        color: status === 'present' ? '#FFFFFF' : '#4B5563',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease',
                                      }}
                                    >
                                      P · Present
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleSetStudentStatus(st.id, idx, 'unauth_absent')}
                                      style={{
                                        padding: '4px 10px',
                                        fontSize: 11.5,
                                        fontWeight: status === 'unauth_absent' ? 700 : 500,
                                        borderRadius: 6,
                                        border: status === 'unauth_absent' ? '1px solid #DC2626' : '1px solid #E5E7EB',
                                        background: status === 'unauth_absent' ? '#DC2626' : '#FFFFFF',
                                        color: status === 'unauth_absent' ? '#FFFFFF' : '#4B5563',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease',
                                      }}
                                    >
                                      A · Absent
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleSetStudentStatus(st.id, idx, 'auth_absent')}
                                      style={{
                                        padding: '4px 10px',
                                        fontSize: 11.5,
                                        fontWeight: status === 'auth_absent' ? 700 : 500,
                                        borderRadius: 6,
                                        border: status === 'auth_absent' ? '1px solid #D97706' : '1px solid #E5E7EB',
                                        background: status === 'auth_absent' ? '#D97706' : '#FFFFFF',
                                        color: status === 'auth_absent' ? '#FFFFFF' : '#4B5563',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease',
                                      }}
                                    >
                                      PL · Permit Leave
                                    </button>
                                  </div>
                                </td>

                                {/* Visual Pill Badge */}
                                <td style={{ textAlign: 'center', padding: '8px 14px' }}>
                                  {status === 'present' ? (
                                    <span
                                      style={{
                                        display: 'inline-block',
                                        padding: '3px 8px',
                                        borderRadius: 4,
                                        fontSize: 11,
                                        fontWeight: 700,
                                        background: '#EAF3EF',
                                        color: '#2D6E5D',
                                        border: '1px solid #C7E4D8',
                                      }}
                                    >
                                      Present
                                    </span>
                                  ) : status === 'auth_absent' ? (
                                    <span
                                      style={{
                                        display: 'inline-block',
                                        padding: '3px 8px',
                                        borderRadius: 4,
                                        fontSize: 11,
                                        fontWeight: 700,
                                        background: '#FEF3C7',
                                        color: '#92400E',
                                        border: '1px solid #FDE68A',
                                      }}
                                    >
                                      Permit Leave
                                    </span>
                                  ) : (
                                    <span
                                      style={{
                                        display: 'inline-block',
                                        padding: '3px 8px',
                                        borderRadius: 4,
                                        fontSize: 11,
                                        fontWeight: 700,
                                        background: '#FDF1F0',
                                        color: '#DC2626',
                                        border: '1px solid #FECACA',
                                      }}
                                    >
                                      Absent
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

                  {/* Automated Daily Report Generator */}
                  <div style={{ marginTop: 20, background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 8, padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div>
                        <h4 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>Automated Daily Roll Call Summary</h4>
                        <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                          Formatted for school records, leadership review, and parent updates.
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

              {/* TAB 2: MONTHLY MATRIX & HISTORY */}
              {attendanceViewMode === 'history' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {/* Homeroom Historical Analytics KPI Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                    <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 8, padding: '14px 16px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Classroom Avg Rate</div>
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
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Total Classroom Students</div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--neutral-dark)', marginTop: 4 }}>
                        {homeroomStudents.length}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Enrolled in {homeroomLabel}</div>
                    </div>
                  </div>

                  {/* Register Sub-Tabs Selector Bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <SegmentedControl
                      value={historyTab}
                      onChange={(tab) => {
                        setHistoryTab(tab);
                        setViewingHistoryStudentId('');
                      }}
                      options={[
                        { value: 'matrix', label: 'Monthly Matrix Grid' },
                        { value: 'by_student', label: `Summary by Student (${filteredHomeroomHistoryStudents.length})` },
                        { value: 'by_date', label: `Daily Session Logs (${homeroomDateLogs.length} Days)` },
                      ]}
                      height={34}
                      textTransform="none"
                    />
                  </div>

                  {/* 1. VIEW FULL DATE MATRIX (SPREADSHEET GRID WITH MONTH SELECTOR & FIXED COLUMNS) */}
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
                            Monthly Classroom Attendance Matrix ({matrixMonth})
                          </h4>
                          <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                            Legend: <strong style={{ color: '#2D6E5D' }}>P</strong> = Present (Green), <strong style={{ color: '#92400E' }}>PL</strong> = Permit Leave (Amber), <strong style={{ color: '#DC2626' }}>A</strong> = Absent (Red)
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
                      <div style={{ overflowX: 'auto', maxHeight: 480 }}>
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
                              <th style={{ textAlign: 'center', padding: '6px 8px', minWidth: 44, background: '#FEF3C7', color: '#92400E' }}>
                                PL
                              </th>
                              <th style={{ textAlign: 'center', padding: '6px 8px', minWidth: 44, background: '#FDF1F0', color: '#DC2626' }}>
                                Abs
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
                                              background: '#FEF3C7',
                                              color: '#92400E',
                                              fontWeight: 700,
                                              fontSize: 10,
                                            }}
                                            title={`${dateStr}: Permit Leave (PL)`}
                                          >
                                            PL
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
                                              color: '#DC2626',
                                              fontWeight: 700,
                                              fontSize: 10.5,
                                            }}
                                            title={`${dateStr}: Absent`}
                                          >
                                            A
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
                                  <td style={{ textAlign: 'center', padding: '6px 8px', color: '#92400E', background: '#FEF3C7', fontWeight: 600 }}>
                                    {mStat.authAbsent}
                                  </td>
                                  <td style={{ textAlign: 'center', padding: '6px 8px', color: mStat.unauthAbsent > 0 ? '#DC2626' : 'var(--text-secondary)', fontWeight: mStat.unauthAbsent > 0 ? 700 : 400, background: '#FFFDFD' }}>
                                    {mStat.unauthAbsent}
                                  </td>
                                  <td style={{ textAlign: 'center', padding: '6px 10px', fontWeight: 700, color: mStat.rate >= 85 ? '#2D6E5D' : '#DC2626' }}>
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

                  {/* 2. VIEW SUMMARY BY STUDENT */}
                  {historyTab === 'by_student' && (
                    <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr style={{ background: '#F8F7F4', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: 10.5, textTransform: 'uppercase' }}>
                              <th style={{ textAlign: 'left', padding: '10px 14px', width: 36 }}>#</th>
                              <th style={{ textAlign: 'left', padding: '10px 14px' }}>Student Name</th>
                              <th style={{ textAlign: 'left', padding: '10px 14px' }}>Admission No.</th>
                              <th style={{ textAlign: 'center', padding: '10px 14px' }}>Present</th>
                              <th style={{ textAlign: 'center', padding: '10px 14px' }}>Permit Leave (PL)</th>
                              <th style={{ textAlign: 'center', padding: '10px 14px' }}>Absent</th>
                              <th style={{ textAlign: 'center', padding: '10px 14px' }}>Total Sessions</th>
                              <th style={{ textAlign: 'right', padding: '10px 14px' }}>Rate %</th>
                              <th style={{ textAlign: 'right', padding: '10px 14px' }}>Inspect</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredHomeroomHistoryStudents.map((st, idx) => {
                              const stat = homeroomHistoryAnalytics.studentStats[st.id] || { totalRecorded: 0, present: 0, authAbsent: 0, unauthAbsent: 0, rate: 100, datesList: [] };
                              const isAtRisk = stat.totalRecorded > 0 && stat.rate < 85;

                              return (
                                <tr key={st.id} style={{ borderBottom: '1px solid #ECEAE5' }}>
                                  <td style={{ padding: '10px 14px', color: '#9E9B95' }}>{idx + 1}</td>
                                  <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--neutral-dark)' }}>{st.name}</td>
                                  <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 11 }}>{st.admission_number || st.user_code || '—'}</td>
                                  <td style={{ textAlign: 'center', padding: '10px 14px', color: '#2D6E5D', fontWeight: 600 }}>{stat.present}</td>
                                  <td style={{ textAlign: 'center', padding: '10px 14px', color: '#92400E', fontWeight: 600 }}>{stat.authAbsent}</td>
                                  <td style={{ textAlign: 'center', padding: '10px 14px', color: stat.unauthAbsent > 0 ? '#DC2626' : 'var(--text-secondary)', fontWeight: stat.unauthAbsent > 0 ? 700 : 400 }}>
                                    {stat.unauthAbsent}
                                  </td>
                                  <td style={{ textAlign: 'center', padding: '10px 14px', color: 'var(--text-secondary)' }}>{stat.totalRecorded}</td>
                                  <td style={{ textAlign: 'right', padding: '10px 14px' }}>
                                    <span
                                      style={{
                                        display: 'inline-block',
                                        padding: '2px 8px',
                                        borderRadius: 4,
                                        fontSize: 10.5,
                                        fontWeight: 700,
                                        background: isAtRisk ? '#FDF1F0' : '#EAF3EF',
                                        color: isAtRisk ? '#DC2626' : '#2D6E5D',
                                        border: isAtRisk ? '1px solid #FECACA' : '1px solid #C7E4D8',
                                      }}
                                    >
                                      {stat.rate}%
                                    </span>
                                  </td>
                                  <td style={{ textAlign: 'right', padding: '10px 14px' }}>
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
                      </div>
                    </div>
                  )}

                  {/* 3. VIEW DAILY SESSION LOGS */}
                  {historyTab === 'by_date' && (
                    <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                          Daily Attendance Session History ({homeroomDateLogs.length} Recorded Sessions)
                        </div>
                      </div>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr style={{ background: '#F8F7F4', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: 10.5, textTransform: 'uppercase' }}>
                              <th style={{ textAlign: 'left', padding: '10px 14px' }}>Date</th>
                              <th style={{ textAlign: 'center', padding: '10px 14px' }}>Present</th>
                              <th style={{ textAlign: 'center', padding: '10px 14px' }}>Permit Leave (PL)</th>
                              <th style={{ textAlign: 'center', padding: '10px 14px' }}>Absent</th>
                              <th style={{ textAlign: 'center', padding: '10px 14px' }}>Total</th>
                              <th style={{ textAlign: 'right', padding: '10px 14px' }}>Session Rate</th>
                            </tr>
                          </thead>
                          <tbody>
                            {homeroomDateLogs.map((log) => (
                              <tr key={log.date} style={{ borderBottom: '1px solid #ECEAE5' }}>
                                <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--neutral-dark)' }}>{log.date}</td>
                                <td style={{ textAlign: 'center', padding: '10px 14px', color: '#2D6E5D', fontWeight: 600 }}>{log.present}</td>
                                <td style={{ textAlign: 'center', padding: '10px 14px', color: '#92400E', fontWeight: 600 }}>{log.authAbsent}</td>
                                <td style={{ textAlign: 'center', padding: '10px 14px', color: log.unauthAbsent > 0 ? '#DC2626' : 'var(--text-secondary)', fontWeight: log.unauthAbsent > 0 ? 700 : 400 }}>
                                  {log.unauthAbsent}
                                </td>
                                <td style={{ textAlign: 'center', padding: '10px 14px', color: 'var(--text-secondary)' }}>{log.totalStudents}</td>
                                <td style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 700, color: log.rate >= 85 ? '#2D6E5D' : '#DC2626' }}>
                                  {log.rate}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: PERMIT LEAVE (PL) REQUESTS */}
              {attendanceViewMode === 'leaves' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Status Filter Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--neutral-dark)', margin: 0 }}>
                        Student Permit Leave &amp; Medical Notes ({filteredLeavesForTeacher.length})
                      </h3>
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                        Approved requests automatically register as <strong>Permit Leave (PL)</strong> in the attendance records.
                      </p>
                    </div>

                    <SegmentedControl
                      value={leaveStatusFilter}
                      onChange={(val) => setLeaveStatusFilter(val as any)}
                      options={[
                        { value: 'all', label: `All (${leavesCounts.all})` },
                        { value: 'pending', label: `Pending (${leavesCounts.pending})` },
                        { value: 'approved', label: `Approved (${leavesCounts.approved})` },
                        { value: 'rejected', label: `Rejected (${leavesCounts.rejected})` },
                      ]}
                      height={32}
                      textTransform="none"
                    />
                  </div>

                  {filteredLeavesForTeacher.length === 0 ? (
                    <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 8, padding: '48px 24px', textAlign: 'center' }}>
                      <FileText size={32} style={{ color: 'var(--text-secondary)', margin: '0 auto 12px', display: 'block', opacity: 0.5 }} />
                      <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px', color: 'var(--neutral-dark)' }}>
                        No Permit Leave Requests Found
                      </h4>
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 400, margin: '0 auto' }}>
                        {leaveStatusFilter === 'pending'
                          ? 'No pending permit leave requests awaiting your review.'
                          : 'No student leave submissions match the selected filter.'}
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                      {filteredLeavesForTeacher.map((leave) => {
                        const student = profiles.find((p) => p.id === leave.student_id || p.email === leave.student_id);
                        const isPending = leave.status === 'submitted' || !leave.status;
                        const isApproved = leave.status === 'approved';
                        const isRejected = leave.status === 'rejected';

                        return (
                          <div
                            key={leave.id}
                            style={{
                              background: isPending ? '#FFFBEB' : '#FFFFFF',
                              border: isPending ? '1.5px solid #FDE68A' : '1px solid var(--border-color)',
                              borderRadius: 8,
                              padding: '16px 20px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 12,
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                              <div>
                                <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                                  {student ? student.name : 'Homeroom Student'}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'monospace', marginTop: 2 }}>
                                  Admission No: {student?.admission_number || student?.user_code || '—'} · {student?.email}
                                </div>
                              </div>

                              <div>
                                {isPending && (
                                  <span style={{ padding: '3px 9px', borderRadius: 4, fontSize: 11, fontWeight: 700, background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' }}>
                                    Pending Review
                                  </span>
                                )}
                                {isApproved && (
                                  <span style={{ padding: '3px 9px', borderRadius: 4, fontSize: 11, fontWeight: 700, background: '#EAF3EF', color: '#2D6E5D', border: '1px solid #C7E4D8' }}>
                                    ✓ Approved (Permit Leave)
                                  </span>
                                )}
                                {isRejected && (
                                  <span style={{ padding: '3px 9px', borderRadius: 4, fontSize: 11, fontWeight: 700, background: '#FDF1F0', color: '#DC2626', border: '1px solid #FECACA' }}>
                                    ✕ Rejected
                                  </span>
                                )}
                              </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, background: isPending ? '#FEF9EE' : '#FAF9F6', padding: '10px 14px', borderRadius: 6, fontSize: 12 }}>
                              <div>
                                <span style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: 10, fontWeight: 700 }}>Leave Period: </span>
                                <strong style={{ color: 'var(--neutral-dark)' }}>{leave.startDate}{leave.endDate && leave.endDate !== leave.startDate ? ` → ${leave.endDate}` : ''}</strong>
                              </div>
                              <div>
                                <span style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: 10, fontWeight: 700 }}>Type: </span>
                                <strong style={{ color: '#2C6E6A' }}>{leave.leaveType || 'Medical / Sick'}</strong>
                              </div>
                            </div>

                            {leave.reason && (
                              <div style={{ fontSize: 12.5, color: '#374151', lineHeight: 1.4 }}>
                                <strong style={{ color: 'var(--neutral-dark)' }}>Reason:</strong> {leave.reason}
                              </div>
                            )}

                            {/* Medical Document / Certificate attachment */}
                            {(leave.fileUrl || leave.fileName) && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                                <button
                                  type="button"
                                  onClick={() => openFileInNewTab({ fileUrl: leave.fileUrl || '', fileName: leave.fileName || 'leave_note.pdf' })}
                                  style={{
                                    padding: '5px 12px',
                                    fontSize: 11.5,
                                    fontWeight: 600,
                                    borderRadius: 4,
                                    background: '#FAF9F6',
                                    border: '1px solid var(--border-color)',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    color: '#2C6E6A',
                                  }}
                                >
                                  <FileText size={13} />
                                  <span>View Medical Note / Attachment ({formatShortFileName(leave.fileName || 'document.pdf', 24)})</span>
                                </button>
                              </div>
                            )}

                            {/* Action Buttons for Pending requests */}
                            {isPending && (
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4, borderTop: '1px solid #F3F0E6', paddingTop: 12 }}>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (onRejectLeave) {
                                      await onRejectLeave(leave.id, leave.student_id);
                                    }
                                  }}
                                  style={{
                                    padding: '6px 14px',
                                    fontSize: 11.5,
                                    fontWeight: 600,
                                    borderRadius: 6,
                                    background: '#FFFFFF',
                                    color: '#DC2626',
                                    border: '1px solid #FECACA',
                                    cursor: 'pointer',
                                  }}
                                >
                                  Reject
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (onApproveLeave) {
                                      await onApproveLeave(leave.id, leave.student_id);
                                    }
                                  }}
                                  style={{
                                    padding: '6px 16px',
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                    borderRadius: 6,
                                    background: '#2D6E5D',
                                    color: '#FFFFFF',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                  }}
                                >
                                  <Check size={13} /> Approve (Mark PL)
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
          )
        )}
        {/* VIEW 3: HOMEROOM STUDENT ACHIEVEMENTS */}
        {activeNavMode === 'homeroom_awards' && (
          !homeroomClassInfo.isClassTeacher ? (
            renderHomeroomNotice()
          ) : (
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
                  value={awardSearch}
                  onChange={(e) => setAwardSearch(e.target.value)}
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
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </header>

            <div className="content-body" style={{ padding: '24px 32px' }}>
              <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FDFCFB' }}>
                  <div>
                    <h4 style={{ fontSize: 13.5, fontWeight: 700, margin: 0 }}>
                      Classroom Student Awards Registry ({filteredAwards.length} Published)
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
                                  <div style={{ display: 'inline-flex', gap: 6 }}>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openFileInNewTab({
                                          fileName: aw.file_name || 'Certificate.pdf',
                                          fileUrl: aw.file_url,
                                          studentName: student ? student.name : 'Student',
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
                                          studentName: student ? student.name : 'Student',
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
          )
        )}
        {/* VIEW 3.5: HOMEROOM CLASS RESOURCES & CIRCULARS */}
        {activeNavMode === 'homeroom_resources' && (
          !homeroomClassInfo.isClassTeacher ? (
            renderHomeroomNotice()
          ) : (
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
                    CLASS TEACHER PORTAL · {homeroomLabel} ({homeroomStudents.length} Students)
                  </span>
                  <span style={{ fontSize: 12, opacity: 0.85 }}>Direct Broadcast Channel</span>
                </div>
                <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', color: '#FFFFFF' }}>
                  Class Teacher Circulars &amp; Resources
                </h1>
                <p style={{ margin: '6px 0 0', fontSize: 13, opacity: 0.9, maxWidth: 580, lineHeight: 1.4 }}>
                  Broadcast instant circulars, event guidelines, timetables, and resource files directly to all students enrolled in your homeroom.
                </p>
              </div>

              {/* Quick Stat Chips & Action Buttons */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
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
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#FFFFFF' }}>{homeroomBroadcasts.length}</div>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', opacity: 0.85, fontWeight: 700, marginTop: 2 }}>
                    Circulars
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
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#FFFFFF' }}>{homeroomResources.length}</div>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', opacity: 0.85, fontWeight: 700, marginTop: 2 }}>
                    Materials
                  </div>
                </div>
              </div>
            </header>

            <div className="content-body" style={{ padding: '24px 36px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Segmented Tab Bar & Search */}
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
                {/* Pill Tabs */}
                <SegmentedControl
                  value={hrActiveTab}
                  onChange={(tab) => setHrActiveTab(tab)}
                  options={[
                    {
                      value: 'broadcasts',
                      label: 'Class Circulars & Notices',
                      icon: <Megaphone size={14} />,
                      count: homeroomBroadcasts.length,
                    },
                    {
                      value: 'resources',
                      label: 'Shared Class Materials',
                      icon: <BookOpen size={14} />,
                      count: homeroomResources.length,
                    },
                  ]}
                  height={36}
                  textTransform="none"
                />

                {hrActiveTab === 'resources' && (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => setHrIsResourceFormExpanded(!hrIsResourceFormExpanded)}
                    style={{ padding: '7px 16px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    {hrIsResourceFormExpanded ? 'Close Form ▲' : (<><Plus size={13} /> Upload Class Resource</>)}
                  </button>
                )}
              </div>

              {/* TAB 1: CIRCULARS & BROADCASTS */}
              {hrActiveTab === 'broadcasts' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {/* Inline Broadcast Composer */}
                  <div
                    style={{
                      background: '#FFFFFF',
                      border: '1.5px solid var(--border-color)',
                      borderRadius: 12,
                      padding: '24px 28px',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #2C6E6A 0%, #3B8C80 100%)',
                          color: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 18,
                          boxShadow: '0 4px 10px rgba(44, 110, 106, 0.2)',
                        }}
                      >
                        <Megaphone size={18} />
                      </div>
                      <div>
                        <h4 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: 'var(--neutral-dark)' }}>
                          Post Classroom Circular or Notice
                        </h4>
                        <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                          Sent directly to all {homeroomStudents.length} students enrolled in {homeroomLabel}
                        </div>
                      </div>
                    </div>

                    <form onSubmit={handleHrPostBroadcast} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <input
                        type="text"
                        placeholder="Circular or Notice Title (e.g. Term Examination Guidelines, Field Trip Permission Slip)..."
                        className="form-input"
                        value={hrBcTitle}
                        onChange={(e) => setHrBcTitle(e.target.value)}
                        style={{ fontSize: 13.5, fontWeight: 600, padding: '10px 14px' }}
                      />

                      <textarea
                        rows={4}
                        placeholder="Write announcement details, deadlines, dress code, instructions..."
                        className="form-input"
                        value={hrBcContent}
                        onChange={(e) => setHrBcContent(e.target.value)}
                        style={{ fontSize: 13, lineHeight: 1.55, resize: 'vertical', padding: '12px 14px' }}
                      />

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: 12,
                          paddingTop: 8,
                          borderTop: '1px solid #ECEAE5',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>Priority Level:</span>
                            <select
                              value={hrBcPriority}
                              onChange={(e) => setHrBcPriority(e.target.value as any)}
                              style={{
                                padding: '6px 12px',
                                fontSize: 12,
                                fontWeight: 600,
                                borderRadius: 6,
                                border: '1px solid var(--border-color)',
                                background: '#FAF9F6',
                                cursor: 'pointer',
                              }}
                            >
                              <option value="normal">Normal Notice</option>
                              <option value="important">Important Circular</option>
                              <option value="urgent">Urgent Action Required</option>
                            </select>
                          </div>

                          <label
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              fontSize: 12.5,
                              cursor: 'pointer',
                              userSelect: 'none',
                              padding: '5px 10px',
                              borderRadius: 6,
                              background: hrBcIsPinned ? '#FEF7EC' : 'transparent',
                              border: hrBcIsPinned ? '1px solid #F5DEB3' : '1px solid transparent',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={hrBcIsPinned}
                              onChange={(e) => setHrBcIsPinned(e.target.checked)}
                              style={{ accentColor: '#D4A373' }}
                            />
                            <span style={{ fontWeight: 700, color: hrBcIsPinned ? '#9E6C1B' : 'var(--neutral-dark)' }}>
                              Pin to top
                            </span>
                          </label>
                        </div>

                        <button
                          type="submit"
                          className="btn-primary"
                          disabled={hrBcIsPosting}
                          style={{ padding: '9px 24px', fontSize: 13, fontWeight: 700 }}
                        >
                          {hrBcIsPosting ? 'Publishing...' : 'Publish to Classroom ↗'}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Broadcasts List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ fontSize: 13, fontWeight: 800, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#2C6E6A' }}>
                        Published Classroom Circulars ({homeroomBroadcasts.length})
                      </h4>
                    </div>

                    {homeroomBroadcasts.length === 0 ? (
                      <div
                        style={{
                          padding: '50px 24px',
                          background: '#FFFFFF',
                          border: '1px solid var(--border-color)',
                          borderRadius: 10,
                          textAlign: 'center',
                          color: 'var(--text-secondary)',
                          fontSize: 13,
                        }}
                      >
                        No circulars or notices posted for {homeroomLabel} yet. Use the composer above to share updates!
                      </div>
                    ) : (
                      homeroomBroadcasts.map((bc) => {
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
                              padding: '20px 24px',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                              position: 'relative',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                  {isPinned && (
                                    <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 4, background: '#FEF7EC', color: '#9E6C1B', border: '1px solid #F5DEB3' }}>
                                      PINNED
                                    </span>
                                  )}
                                  {isUrgent && (
                                    <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 4, background: '#FDF1F0', color: '#A83B38', border: '1px solid #F5C6CB' }}>
                                      URGENT
                                    </span>
                                  )}
                                  {isImportant && (
                                    <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 4, background: '#EFF6FF', color: '#1E40AF', border: '1px solid #BFDBFE' }}>
                                      IMPORTANT
                                    </span>
                                  )}
                                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                    {bc.created_at ? new Date(bc.created_at).toLocaleString() : 'Recently'}
                                  </span>
                                </div>
                                <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: 'var(--neutral-dark)' }}>
                                  {bc.title}
                                </h3>
                              </div>

                              <div style={{ display: 'flex', gap: 6 }}>
                                {onTogglePinBroadcast && (
                                  <button
                                    type="button"
                                    onClick={() => onTogglePinBroadcast(bc.id)}
                                    title={bc.is_pinned ? 'Unpin Circular' : 'Pin to Top'}
                                    style={{
                                      padding: '4px 9px',
                                      fontSize: 11,
                                      fontWeight: 600,
                                      background: bc.is_pinned ? '#FEF7EC' : '#FAF9F6',
                                      border: '1px solid var(--border-color)',
                                      color: bc.is_pinned ? '#9E6C1B' : 'var(--neutral-dark)',
                                      borderRadius: 4,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    {bc.is_pinned ? 'Unpin' : 'Pin'}
                                  </button>
                                )}
                                {onDeleteBroadcast && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (confirm(`Delete circular "${bc.title}"?`)) {
                                        onDeleteBroadcast(bc.id);
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
                                )}
                              </div>
                            </div>

                            <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, margin: '8px 0 0', whiteSpace: 'pre-wrap', background: '#FAF9F6', padding: '12px 14px', borderRadius: 6, border: '1px solid #ECEAE5' }}>
                              {bc.content}
                            </p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: CLASS MATERIALS & RESOURCES */}
              {hrActiveTab === 'resources' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {/* Uploader Card */}
                  {hrIsResourceFormExpanded && (
                    <div style={{ background: '#FFFFFF', border: '1.5px solid var(--border-color)', borderRadius: 12, padding: '24px 28px', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <div>
                          <h4 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>
                            Upload Classroom Resource or Form
                          </h4>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                            PDFs, permission slips, timetables, and class guides shared directly with {homeroomLabel}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => setHrIsResourceFormExpanded(false)}
                          style={{ padding: '5px 12px', fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                          <X size={12} /> Close
                        </button>
                      </div>

                      <form onSubmit={handleHrSaveResource} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                          <input
                            type="text"
                            placeholder="Resource Title (e.g. Grade 12-B Timetable, Annual Day Consent Form)..."
                            className="form-input"
                            value={hrResTitle}
                            onChange={(e) => setHrResTitle(e.target.value)}
                            style={{ fontSize: 13, fontWeight: 600, padding: '9px 12px' }}
                            required
                          />
                          <select
                            value={hrResType}
                            onChange={(e) => setHrResType(e.target.value as any)}
                            className="form-input"
                            style={{ fontSize: 12.5, padding: '9px 12px' }}
                          >
                            <option value="pdf">PDF Document</option>
                            <option value="doc">Word / Text Doc</option>
                            <option value="slides">Presentation Slides</option>
                            <option value="worksheet">Spreadsheet / Form</option>
                            <option value="link">Web Link / Form URL</option>
                          </select>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <input
                            type="text"
                            placeholder="Category / Tag (e.g. Schedule, Consent, Notice, Timetable)..."
                            className="form-input"
                            value={hrResTopicTag}
                            onChange={(e) => setHrResTopicTag(e.target.value)}
                            style={{ fontSize: 12.5, padding: '9px 12px' }}
                          />
                          {hrResType === 'link' ? (
                            <input
                              type="url"
                              placeholder="https://..."
                              className="form-input"
                              value={hrResExternalLink}
                              onChange={(e) => setHrResExternalLink(e.target.value)}
                              style={{ fontSize: 12.5, padding: '9px 12px' }}
                            />
                          ) : (
                            <input
                              type="file"
                              onChange={handleHrResourceFileChange}
                              style={{ fontSize: 12, padding: '6px 8px' }}
                            />
                          )}
                        </div>

                        <textarea
                          rows={2}
                          placeholder="Short description or notes for students..."
                          className="form-input"
                          value={hrResDesc}
                          onChange={(e) => setHrResDesc(e.target.value)}
                          style={{ fontSize: 12.5, padding: '9px 12px' }}
                        />

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => setHrIsResourceFormExpanded(false)}
                            style={{ padding: '8px 16px', fontSize: 12 }}
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="btn-primary"
                            disabled={hrIsUploadingResource}
                            style={{ padding: '8px 20px', fontSize: 12.5, fontWeight: 700 }}
                          >
                            {hrIsUploadingResource ? 'Saving...' : 'Upload & Share ↗'}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* Resource List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                      <input
                        type="text"
                        placeholder="Search resources..."
                        value={hrResSearchQuery}
                        onChange={(e) => setHrResSearchQuery(e.target.value)}
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
                          boxSizing: 'border-box',
                        }}
                      />
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700 }}>
                        {filteredHrResources.length} Materials Shared
                      </span>
                    </div>

                    {filteredHrResources.length === 0 ? (
                      <div style={{ padding: '50px 24px', background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 10, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                        No class resources uploaded for {homeroomLabel} yet.
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                        {filteredHrResources.map((res) => {
                          let typeIcon = <FileText size={18} />;
                          let typeBg = '#EAF3EF';
                          let typeColor = '#2D6E5D';
                          if (res.resource_type === 'pdf') {
                            typeIcon = <FileText size={18} />;
                            typeBg = '#FDF1F0';
                            typeColor = '#A83B38';
                          } else if (res.resource_type === 'slides') {
                            typeIcon = <BookOpen size={18} />;
                            typeBg = '#FEF7EC';
                            typeColor = '#9E6C1B';
                          } else if (res.resource_type === 'video') {
                            typeIcon = <Video size={18} />;
                            typeBg = '#F3EFFA';
                            typeColor = '#7C5CBF';
                          } else if (res.resource_type === 'link') {
                            typeIcon = <Link2 size={18} />;
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
                                boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                gap: 14,
                              }}
                            >
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div
                                      style={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: 6,
                                        background: typeBg,
                                        color: typeColor,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: 14,
                                      }}
                                    >
                                      {typeIcon}
                                    </div>
                                    <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', padding: '2px 7px', borderRadius: 4, background: typeBg, color: typeColor }}>
                                      {res.resource_type}
                                    </span>
                                  </div>
                                  {res.topic_tag && (
                                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', background: '#FAF9F6', padding: '2px 7px', borderRadius: 4, border: '1px solid var(--border-color)' }}>
                                      {res.topic_tag}
                                    </span>
                                  )}
                                </div>

                                <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 6px', color: 'var(--neutral-dark)' }}>
                                  {res.title}
                                </h4>
                                {res.description && (
                                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
                                    {res.description}
                                  </p>
                                )}
                              </div>

                              <div style={{ borderTop: '1px solid #ECEAE5', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                  {res.created_at ? new Date(res.created_at).toLocaleDateString() : 'Active Resource'}
                                </span>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  {res.file_url || res.external_link ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (res.file_url) {
                                          openFileInNewTab({
                                            fileUrl: res.file_url,
                                            fileName: res.file_name || res.title,
                                            title: res.title,
                                          });
                                        } else if (res.external_link) {
                                          window.open(res.external_link, '_blank');
                                        }
                                      }}
                                      style={{
                                        padding: '4px 10px',
                                        fontSize: 11.5,
                                        fontWeight: 600,
                                        background: '#EAF3EF',
                                        border: '1px solid #C7E4D8',
                                        color: '#2C6E6A',
                                        borderRadius: 4,
                                        cursor: 'pointer',
                                      }}
                                    >
                                      Open ↗
                                    </button>
                                  ) : null}
                                  {onDeleteResource && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (confirm(`Delete resource "${res.title}"?`)) {
                                          onDeleteResource(res.id);
                                        }
                                      }}
                                      style={{
                                        padding: '4px 8px',
                                        fontSize: 11,
                                        color: '#DC2626',
                                        background: '#FEF2F2',
                                        border: '1px solid #FECACA',
                                        borderRadius: 4,
                                        cursor: 'pointer',
                                      }}
                                    >
                                      Delete
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
          )
        )}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* VIEW 4B: HOMEROOM PARENT ACCESS & VERIFICATION CODES                  */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {activeNavMode === 'homeroom_codes' && (
          !homeroomClassInfo.isClassTeacher ? (
            renderHomeroomNotice()
          ) : (
          <>
            <header className="content-header">
              <div className="header-top" style={{ alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: '#EAF3EF', color: '#2D6E5D', border: '1px solid #C7E4D8', textTransform: 'uppercase' }}>
                      Class Teacher Portal
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {homeroomLabel}
                    </span>
                  </div>
                  <h1 className="page-title" style={{ margin: 0 }}>
                    Parent Access &amp; Verification Codes
                  </h1>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Search student or admission no..."
                      value={codeSearchQuery}
                      onChange={(e) => setCodeSearchQuery(e.target.value)}
                      style={{ width: 240, paddingLeft: 32, fontSize: 12.5 }}
                    />
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#9CA3AF"
                      strokeWidth="2"
                      style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}
                    >
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  </div>
                </div>
              </div>
            </header>

            <div className="dashboard-content" style={{ padding: '24px 32px' }}>
              {/* Instructions banner */}
              <div
                style={{
                  padding: '16px 20px',
                  borderRadius: 12,
                  background: '#F0F9F7',
                  border: '1px solid #C7E4D8',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 14,
                  marginBottom: 24,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: '#2D6E5D',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <KeyRound size={18} />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: '#20554E', margin: '0 0 4px' }}>
                    Classroom Parent Verification System
                  </h3>
                  <p style={{ fontSize: 12.5, color: '#2D6E5D', margin: 0, lineHeight: 1.5 }}>
                    Each student has a unique 6-digit access code. When parents register on the portal, they will enter this code along with the student&apos;s email and admission number. Click <strong>WhatsApp</strong> to instantly share the student&apos;s code and registration link with guardians.
                  </p>
                </div>
              </div>

              {/* Summary KPI Cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 16,
                  marginBottom: 24,
                }}
              >
                <div
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid var(--border-color)',
                    borderRadius: 12,
                    padding: '16px 20px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Total Classroom Students
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--neutral-dark)', marginTop: 4 }}>
                    {homeroomStudents.length}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#6B7280', marginTop: 2 }}>
                    Enrolled in {homeroomLabel}
                  </div>
                </div>

                <div
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid var(--border-color)',
                    borderRadius: 12,
                    padding: '16px 20px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#059669', textTransform: 'uppercase' }}>
                    Parents Registered &amp; Linked
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: '#059669', marginTop: 4 }}>
                    {homeroomStudents.filter(st => profiles.some(p => p.role === 'parent' && (p.linked_student_ids || []).includes(st.id))).length}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#059669', marginTop: 2 }}>
                    Verified guardian access
                  </div>
                </div>

                <div
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid var(--border-color)',
                    borderRadius: 12,
                    padding: '16px 20px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#D97706', textTransform: 'uppercase' }}>
                    Pending Parent Signups
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: '#D97706', marginTop: 4 }}>
                    {homeroomStudents.filter(st => !profiles.some(p => p.role === 'parent' && (p.linked_student_ids || []).includes(st.id))).length}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#D97706', marginTop: 2 }}>
                    Code ready to be shared
                  </div>
                </div>
              </div>

              {/* Table of students & codes */}
              <div
                style={{
                  background: '#FFFFFF',
                  borderRadius: 12,
                  border: '1px solid var(--border-color)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.02)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                    Student Roster &amp; Verification Codes ({filteredHomeroomCodesStudents.length})
                  </div>
                  
                  {/* Status filter selector using standard Woodlem SegmentedControl */}
                  <SegmentedControl
                    value={codeFilter}
                    onChange={(val) => setCodeFilter(val as any)}
                    options={[
                      { value: 'all', label: 'All Students' },
                      { value: 'unlinked', label: 'Pending Signup' },
                      { value: 'linked', label: 'Linked Parents' },
                    ]}
                    height={32}
                    textTransform="none"
                  />
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC', borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ padding: '12px 18px', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                          #
                        </th>
                        <th style={{ padding: '12px 18px', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                          Student Name
                        </th>
                        <th style={{ padding: '12px 18px', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                          Admission No / Email
                        </th>
                        <th style={{ padding: '12px 18px', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                          Parent Link Code
                        </th>
                        <th style={{ padding: '12px 18px', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                          Linked Parent Status
                        </th>
                        <th style={{ padding: '12px 18px', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'right' }}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredHomeroomCodesStudents.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                            No students match the current search or filter.
                          </td>
                        </tr>
                      ) : (
                        filteredHomeroomCodesStudents.map((st, idx) => {
                          const code = getOrGenerateStudentParentCode(st);
                          const parents = profiles.filter(
                            (p) => p.role === 'parent' && (p.linked_student_ids || []).includes(st.id)
                          );
                          const isLinked = parents.length > 0;
                          const waUrl = buildWhatsAppShareUrl(st, code);
                          const isCopied = copiedStudentId === st.id;

                          return (
                            <tr
                              key={st.id}
                              style={{
                                borderBottom: '1px solid var(--border-color)',
                                transition: 'background 0.15s ease',
                              }}
                            >
                              <td style={{ padding: '14px 18px', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
                                {idx + 1}
                              </td>
                              <td style={{ padding: '14px 18px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <div
                                    style={{
                                      width: 34,
                                      height: 34,
                                      borderRadius: '50%',
                                      background: '#2D6E5D',
                                      color: '#FFFFFF',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: 13,
                                      fontWeight: 700,
                                      flexShrink: 0,
                                    }}
                                  >
                                    {st.name.charAt(0)}
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                                      {st.name}
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                      {st.grade || 'Grade 12'} · Section {st.class_letter || 'A'}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td style={{ padding: '14px 18px' }}>
                                <div style={{ fontFamily: 'monospace', fontSize: 12.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                                  {st.admission_number || st.user_code || '—'}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                  {st.email}
                                </div>
                              </td>
                              <td style={{ padding: '14px 18px' }}>
                                <div className="parent-code-badge">
                                  <KeyRound size={13} />
                                  <span>{code}</span>
                                </div>
                              </td>
                              <td style={{ padding: '14px 18px' }}>
                                {isLinked ? (
                                  <div>
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 4, background: '#DCFCE7', color: '#15803D', fontSize: 11, fontWeight: 700 }}>
                                      <Check size={12} /> Linked ({parents.length})
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>
                                      {parents.map((p) => p.name).join(', ')}
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 4, background: '#FEF3C7', color: '#92400E', fontSize: 11, fontWeight: 700 }}>
                                    ⏳ Pending Signup
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyParentCode(st.id, code)}
                                    className="btn-copy-code"
                                    title="Copy Parent Code"
                                  >
                                    {isCopied ? (
                                      <>
                                        <Check size={13} color="#059669" />
                                        <span style={{ color: '#059669', fontWeight: 700 }}>Copied!</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy size={13} />
                                        <span>Copy</span>
                                      </>
                                    )}
                                  </button>

                                  <a
                                    href={waUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn-whatsapp-share"
                                    title="Share verification code with parent via WhatsApp"
                                  >
                                    <Share2 size={13} />
                                    <span>WhatsApp</span>
                                  </a>

                                  <button
                                    type="button"
                                    onClick={() => handleRegenerateParentCode(st)}
                                    disabled={isRegeneratingCodeId === st.id}
                                    style={{
                                      padding: '6px 8px',
                                      borderRadius: 8,
                                      border: '1px solid var(--border-color)',
                                      background: '#FFFFFF',
                                      color: 'var(--text-secondary)',
                                      cursor: 'pointer',
                                    }}
                                    title="Regenerate Parent Code"
                                  >
                                    <RotateCcw size={13} className={isRegeneratingCodeId === st.id ? 'spin' : ''} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
          )
        )}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* VIEW 5: HOLISTIC DEVELOPMENT HUB                                    */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {activeNavMode === 'hub' && (
          <>
            <header className="content-header">
              <div className="header-top" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: '#F3E8FF', color: '#7C3AED', border: '1px solid #E9D5FF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      CO-CURRICULAR &amp; LEADERSHIP
                    </span>
                  </div>
                  <h1 className="page-title" style={{ margin: '2px 0 0' }}>
                    Woodlem Holistic Development Hub
                  </h1>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                    Propose, coordinate, and track co-curricular activities, competitions, leadership workshops, and clubs.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <button
                    className="btn-primary"
                    onClick={onOpenCreateHubActivityModal}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: 13 }}
                  >
                    <Plus size={16} />
                    <span>Publish Activity</span>
                  </button>
                </div>
              </div>
            </header>

            <div className="content-body" style={{ padding: '24px 32px' }}>
              <div className="hub-grid">
                {myHubActivities.length === 0 ? (
                  <div
                    style={{
                      gridColumn: '1 / -1', padding: '48px 24px', textAlign: 'center',
                      color: 'var(--text-secondary)', fontSize: 13,
                      background: '#FFFFFF', borderRadius: 10,
                      border: '2px dashed var(--border-color)',
                    }}
                  >
                    <div style={{ fontSize: 36, marginBottom: 12 }}>🌱</div>
                    <div style={{ fontWeight: 700, color: 'var(--neutral-dark)', fontSize: 15, marginBottom: 6 }}>
                      No Programmes Published Yet
                    </div>
                    <div style={{ maxWidth: 400, margin: '0 auto', lineHeight: 1.5 }}>
                      Click <strong>&quot;+ Publish Activity&quot;</strong> to create clubs, workshops, events, and leadership programmes for your students.
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                    {myHubActivities.map((act) => {
                      const typeColors: Record<string, string> = {
                        'Club Registration': '#7C3AED', 'Workshop': '#2563EB', 'Event': '#D97706',
                        'Leadership Programme': '#059669', 'Volunteer Opportunity': '#DC2626',
                        'Counselling Appointment': '#0891B2', 'Summer Programme': '#EA580C',
                        'Sports & Athletics': '#16A34A', 'Science & Technology': '#4F46E5', 'Arts & Culture': '#C026D3',
                      };
                      const color = typeColors[act.type] || '#2C6E6A';
                      const enrolledCount = (act.enrolled_student_ids || []).length;
                      const location = (act as any).location;
                      const maxCap = (act as any).max_capacity;
                      return (
                        <div
                          key={act.id}
                          style={{
                            borderRadius: 12, border: '1px solid var(--border-color)',
                            background: '#FFFFFF', overflow: 'hidden',
                            display: 'flex', flexDirection: 'column',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                            transition: 'box-shadow 0.2s',
                          }}
                        >
                          <div style={{
                            background: `linear-gradient(135deg, ${color}22 0%, ${color}10 100%)`,
                            borderBottom: `1px solid ${color}30`,
                            padding: '18px 20px',
                            display: 'flex', alignItems: 'center', gap: 12,
                          }}>
                            <div style={{
                              width: 36, height: 36, borderRadius: 6,
                              background: color + '18', border: `1.5px solid ${color}40`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              flexShrink: 0,
                            }}>
                              <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <span style={{
                                fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em',
                                color, background: color + '18', border: `1px solid ${color}30`,
                                padding: '2px 7px', borderRadius: 4,
                              }}>{act.type}</span>
                              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--neutral-dark)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {act.title}
                              </div>
                            </div>
                          </div>

                          {/* Body */}
                          <div style={{ padding: '14px 20px', flex: 1 }}>
                            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 12px' }}>
                              {act.description}
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Calendar size={11} /><strong style={{ color: 'var(--neutral-dark)' }}>{act.date}</strong>
                              </div>
                              {location && (
                                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ fontWeight: 600 }}>Location:</span> {location}
                                </div>
                              )}
                              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                                {(act.target_grades || []).join(', ') || 'All Grades'}
                              </div>
                            </div>
                          </div>

                          {/* Footer */}
                          <div style={{
                            padding: '10px 20px', borderTop: '1px solid var(--border-color)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
                            background: '#FAFAF9',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 11.5, fontWeight: 700, color: '#2C6E6A' }}>
                                {enrolledCount} Enrolled
                              </span>
                              {maxCap && (
                                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>/ {maxCap} max</span>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                onClick={() => onEditHubActivity && onEditHubActivity(act)}
                                style={{
                                  padding: '4px 10px', fontSize: 11.5, fontWeight: 600,
                                  border: '1px solid var(--border-color)', borderRadius: 6,
                                  background: 'var(--surface)', color: 'var(--neutral-dark)', cursor: 'pointer',
                                }}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => onDeleteHubActivity(act.id)}
                                style={{
                                  padding: '4px 10px', fontSize: 11.5, fontWeight: 600,
                                  border: '1px solid #FECACA', borderRadius: 6,
                                  background: '#FDF1F0', color: '#A83B38', cursor: 'pointer',
                                }}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* VIEW 6: SETTINGS & PASSWORD RESET */}
        {activeNavMode === 'settings' && (
          <div style={{ padding: '24px 32px' }}>
            <SettingsView currentUser={currentUser} profiles={profiles} onRefreshData={onRefreshData} onUpdateCurrentUser={onUpdateCurrentUser} />
          </div>
        )}

        {/* VIEW 7: HELP & SUPPORT */}
        {activeNavMode === 'support' && (
          <div style={{ padding: '24px 32px' }}>
            <SupportView currentUser={currentUser} />
          </div>
        )}

        {/* VIEW 8: HOD DEPARTMENT HUB */}
        {activeNavMode === 'hod_hub' && (
          <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Header */}
            <div
              style={{
                background: '#FFFFFF',
                border: '1px solid var(--border-color)',
                borderTop: '3px solid #7C5CBF',
                borderRadius: 10,
                padding: '18px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 14,
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 800,
                      padding: '2px 7px',
                      borderRadius: 4,
                      background: '#F3EFFA',
                      color: '#6D28D9',
                      border: '1px solid #DDD6FE',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                    }}
                  >
                    HEAD OF DEPARTMENT PORTAL
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
                    {userDepartmentDef?.name || 'Department Oversight'}
                  </span>
                </div>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: '6px 0 2px', color: 'var(--neutral-dark)', fontFamily: 'var(--font-display)' }}>
                  {userDepartmentDef?.name || 'Academic'} Department Leadership Hub
                </h2>
                <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: 0 }}>
                  Curriculum consistency, grade register audits, and assessment standards across {departmentClassrooms.length} department classes.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    padding: '6px 12px',
                    borderRadius: 6,
                    background: '#FAF9F6',
                    border: '1px solid var(--border-color)',
                    color: '#6D28D9',
                  }}
                >
                  HOD: {currentUser.name}
                </span>
              </div>
            </div>

            {/* Department KPI Stats Strip (matching reference mockup) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <KpiSparklineCard
                label="DEPARTMENT AVERAGE"
                value={departmentAnalytics.overallAverageScore > 0 ? `${departmentAnalytics.overallAverageScore}%` : '—'}
                subValue="Mean Score"
                growthText={departmentAnalytics.overallAverageScore > 0 ? `Based on ${departmentAnalytics.totalEnrollment} assessed students` : 'No assessment data yet'}
              />
              <KpiSparklineCard
                label="SYLLABUS PACE"
                value={departmentAnalytics.overallSyllabusProgress > 0 ? `${departmentAnalytics.overallSyllabusProgress}%` : '—'}
                subValue="Completed"
                growthText={departmentAnalytics.overallSyllabusProgress > 0 ? 'Topics marked complete' : 'No syllabus data yet'}
              />
              <KpiSparklineCard
                label="DEPARTMENT CLASSES"
                value={departmentClassrooms.length}
                subValue="Cohorts"
                growthText={departmentClassrooms.length > 0 ? `${departmentClassrooms.length} active class${departmentClassrooms.length !== 1 ? 'es' : ''}` : 'No classes assigned yet'}
              />
              <KpiSparklineCard
                label="ASSESSED STUDENTS"
                value={departmentAnalytics.totalEnrollment}
                subValue="Students"
                growthText={departmentAnalytics.totalEnrollment > 0 ? 'With recorded results' : 'No results recorded yet'}
              />
            </div>

            {/* Department Visual Graphs (matching reference mockup) */}
            <div style={{ marginBottom: 14 }}>
              <MatrixTrendChart
                data={departmentAnalytics.scoreDistribution}
                overallAverage={departmentAnalytics.overallAverageScore}
                totalStudents={departmentAnalytics.totalEnrollment}
                title={`${userDepartmentDef?.name || 'DEPARTMENT'} SCORE & CURRICULUM TREND`}
              />
            </div>

            {/* Department Classrooms & Direct Mark Register Access */}
            <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--neutral-dark)' }}>
                    Department Classrooms &amp; Mark Registers
                  </h3>
                  <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                    Click any classroom to audit mark compliance, verify entered grades, or enter student marks directly.
                  </p>
                </div>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#6D28D9', background: '#F3EFFA', padding: '4px 10px', borderRadius: 6, border: '1px solid #DDD6FE' }}>
                  {departmentClassrooms.length} Active Classes
                </span>
              </div>

              <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                {departmentClassrooms.length === 0 ? (
                  <div style={{ padding: '30px 20px', textAlign: 'center', gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--neutral-dark)' }}>No classrooms assigned to this department yet</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 4 }}>Classes matching this department&apos;s subjects will appear here automatically.</div>
                  </div>
                ) : (
                  departmentClassrooms.map((cls) => {
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
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: '#EDE9FE', color: '#6D28D9' }}>
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
                          onClick={() => {
                            setSelectedClassId(cls.id);
                            setIsMarkEntryOpen(true);
                          }}
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
                          <ShieldCheck size={13} /> Audit Mark Register &rarr;
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
        </>}
      </main>

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

      {/* VIEW CERTIFICATE / AWARD / RESOURCE FILE MODAL */}
      <ViewFileModal
        isOpen={!!viewingAwardFile || !!previewingResource}
        fileName={previewingResource?.file_name || viewingAwardFile?.fileName || ''}
        fileUrl={previewingResource?.file_url || previewingResource?.external_link || viewingAwardFile?.fileUrl}
        studentName={previewingResource?.teacher_name || viewingAwardFile?.studentName}
        title={previewingResource?.title || viewingAwardFile?.title}
        description={previewingResource?.description || viewingAwardFile?.description}
        submissionDate={previewingResource?.created_at ? new Date(previewingResource.created_at).toLocaleDateString() : viewingAwardFile?.submissionDate}
        onClose={() => {
          setViewingAwardFile(null);
          setPreviewingResource(null);
        }}
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
