'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  User,
  FileText,
  Award,
  Settings,
  LifeBuoy,
  LogOut,
  Calendar,
  Megaphone,
  Plus,
  UserCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Send,
  FileCheck,
  BookOpen,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  CheckCircle,
  Menu,
  X,
} from 'lucide-react';
import { WoodlemLogo, WoodlemEmblemSVG } from '@/components/Shared/WoodlemLogo';
import { useSidebarState } from '@/lib/useSidebarState';
import {
  supabase,
  UserProfile,
  Student,
  TestItem,
  AssignmentItem,
  SyllabusTerm,
  ParentDocument,
  HubActivity,
  Achievement,
  ClassBroadcast,
  SubjectClass,
  ParentStudentLinkRequest,
  LeaveRequest,
} from '@/lib/supabaseClient';
import { getIcon } from '../Icons';
import { SettingsView } from '@/components/Shared/SettingsView';
import { SupportView } from '@/components/Shared/SupportView';
import { usePortalNavigation } from '@/lib/PortalNavigationContext';
import { RequestChildLinkModal } from '@/components/Modals/RequestChildLinkModal';
import { ApplyLeaveModal } from '@/components/Modals/ApplyLeaveModal';
import { CustomSelect } from '@/components/UI/CustomSelect';

import { formatShortFileName, openFileInNewTab, downloadFile } from '@/lib/fileHelper';

interface ParentDashboardProps {
  currentUser?: UserProfile;
  linkedStudents?: Student[];
  allStudentProfiles?: UserProfile[];
  tests: TestItem[];
  assignments: AssignmentItem[];
  syllabus: SyllabusTerm[];
  attendance: Record<string, Record<string, string>>;
  parentDocuments: ParentDocument[];
  hubActivities: HubActivity[];
  achievements?: Achievement[];
  leaveRequests?: LeaveRequest[];
  classBroadcasts?: ClassBroadcast[];
  subjectClasses?: SubjectClass[];
  linkRequests?: ParentStudentLinkRequest[];
  onUploadDoc: (docType: string, fileName: string, studentId: string, fileDataUrl?: string) => void;
  onRemoveDoc: (docType: string, studentId: string) => void;
  onOpenVideoModal: (activity: HubActivity) => void;
  onRequestChildLink: (data: {
    studentId: string;
    studentName: string;
    studentAdmissionNumber: string;
    studentGrade: string;
    relationship: string;
    notes?: string;
  }) => Promise<void>;
  onApplyLeave?: (
    data: {
      id?: string;
      startDate: string;
      endDate: string;
      reason: string;
      leaveType: string;
      fileName?: string;
      fileUrl?: string;
    },
    studentId?: string
  ) => Promise<void>;
  onDeleteLeave?: (leaveId: string, studentId?: string) => Promise<void> | void;
  onUpdateCurrentUser?: (user: UserProfile) => void;
  onRefreshData?: () => void;
  onSignOut: () => void;
}

const REQUIRED_DOC_TYPES = [
  { type: 'Student ID', iconKey: 'id_card', desc: "A clear photo of the student's ID card or government-issued photo ID." },
  { type: 'Admission Form', iconKey: 'admission', desc: 'Completed and signed school admission form.' },
  { type: 'Medical Form', iconKey: 'medical', desc: 'Student health declaration and immunization records.' },
  { type: 'Consent Letter', iconKey: 'consent', desc: 'General parental consent letter for school activities.' },
  { type: 'Permission Slip — Field Trip', iconKey: 'permission', desc: 'Signed permission slip for upcoming field trips.' },
  { type: 'Emergency Contact Form', iconKey: 'emergency', desc: 'Emergency contact details and medical alerts.' },
];

export const ParentDashboard: React.FC<ParentDashboardProps> = ({
  currentUser,
  linkedStudents = [],
  allStudentProfiles = [],
  tests = [],
  assignments = [],
  syllabus = [],
  attendance = {},
  parentDocuments = [],
  hubActivities = [],
  achievements = [],
  leaveRequests = [],
  classBroadcasts = [],
  subjectClasses = [],
  linkRequests = [],
  onUploadDoc,
  onRemoveDoc,
  onOpenVideoModal,
  onRequestChildLink,
  onApplyLeave,
  onDeleteLeave,
  onUpdateCurrentUser,
  onRefreshData,
  onSignOut,
}) => {
  const [activeTab, setActiveTab] = useState<
    'progress' | 'attendance' | 'broadcasts' | 'achievements' | 'documents' | 'hub' | 'settings' | 'support'
  >('progress');

  // Sidebar profile photo (synced with Supabase cloud & local cache)
  const [sidebarAvatarUrl, setSidebarAvatarUrl] = useState<string | null>(() => {
    if (currentUser?.avatar_url) return currentUser.avatar_url;
    if (typeof window !== 'undefined' && currentUser) {
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
    if (currentUser?.avatar_url) {
      setSidebarAvatarUrl(currentUser.avatar_url);
    }
  }, [currentUser?.avatar_url]);

  useEffect(() => {
    const handleAvatarUpdate = (e: any) => {
      const detail = e.detail;
      if (!detail || !currentUser) return;
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
  }, [currentUser]);

  // Currently selected child ID
  const [selectedChildId, setSelectedChildId] = useState<string>(
    linkedStudents[0]?.id || ''
  );

  // Mobile Navigation & Drawer State
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isMobileChildPickerOpen, setIsMobileChildPickerOpen] = useState(false);

  const [isRequestLinkModalOpen, setIsRequestLinkModalOpen] = useState(false);
  const [isApplyLeaveModalOpen, setIsApplyLeaveModalOpen] = useState(false);
  const [expandedClassIds, setExpandedClassIds] = useState<Record<string, boolean>>({});

  const toggleClassExpanded = (classId: string) => {
    setExpandedClassIds((prev) => ({ ...prev, [classId]: !prev[classId] }));
  };

  // Sync selectedChildId when linkedStudents change
  useEffect(() => {
    if (linkedStudents.length > 0) {
      if (!selectedChildId || !linkedStudents.some((s) => s.id === selectedChildId)) {
        setSelectedChildId(linkedStudents[0].id);
      }
    }
  }, [linkedStudents, selectedChildId]);

  const activeChild = useMemo(() => {
    return linkedStudents.find((s) => s.id === selectedChildId) || linkedStudents[0] || null;
  }, [linkedStudents, selectedChildId]);

  const [releasedMarks, setReleasedMarks] = useState<any[]>([]);

  useEffect(() => {
    const fetchMarks = async () => {
      if (!activeChild?.id) return;
      const { data, error } = await supabase
        .from('offline_assessment_marks')
        .select('marks, teacher_note, is_visible_to_student, offline_assessments(title, assessment_date, maximum_marks, class_id)')
        .eq('student_id', activeChild.id)
        .eq('is_visible_to_student', true);
      if (!error) {
        setReleasedMarks(data || []);
      }
    };
    fetchMarks();

    if (typeof window !== 'undefined') {
      window.addEventListener('woodlem-marks-updated', fetchMarks);
      return () => window.removeEventListener('woodlem-marks-updated', fetchMarks);
    }
  }, [activeChild?.id]);

  // Sidebar Controller
  const sidebar = useSidebarState('auto-hide');
  const { subscribeToNavigation } = usePortalNavigation();

  useEffect(() => {
    const unsubscribe = subscribeToNavigation((target) => {
      if (target.view === 'progress' || target.view === 'grades') {
        setActiveTab('progress');
      } else if (target.view === 'attendance') {
        setActiveTab('attendance');
      } else if (target.view === 'documents' || target.view === 'clearance') {
        setActiveTab('documents');
      } else if (target.view === 'hub' || target.view === 'activities') {
        setActiveTab('hub');
      } else if (target.view === 'settings' || target.view === 'password') {
        setActiveTab('settings');
      } else if (target.view === 'support' || target.view === 'helpdesk') {
        setActiveTab('support');
      }
    });
    return unsubscribe;
  }, [subscribeToNavigation]);

  // Parent's pending link requests
  const myPendingRequests = useMemo(() => {
    if (!currentUser) return [];
    return linkRequests.filter(
      (r) =>
        (r.parent_id === currentUser.id || r.parent_email?.toLowerCase() === currentUser.email?.toLowerCase()) &&
        r.status === 'pending'
    );
  }, [linkRequests, currentUser]);

  // Attendance stats for active child
  const allAttendanceDates = Object.keys(attendance).sort().reverse();
  const recentAttendanceDates = allAttendanceDates.slice(0, 10);

  let presentCount = 0;
  let absentCount = 0;
  let totalSessions = 0;

  if (activeChild) {
    allAttendanceDates.forEach((d) => {
      const status = (attendance[d] || {})[activeChild.id];
      if (status === 'present') {
        presentCount++;
        totalSessions++;
      } else if (status === 'auth_absent' || status === 'unauth_absent') {
        absentCount++;
        totalSessions++;
      }
    });
  }

  const attendanceRate = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 100;

  // Child's enrolled subject classes
  const childSubjectClasses = useMemo(() => {
    if (!activeChild) return [];
    const childGradeNum = (activeChild.grade || '').replace(/[^0-9]/g, '');
    const childLetter = (activeChild.class_letter || '').toUpperCase().trim();

    return subjectClasses.filter((sc) => {
      // 1. Explicit enrollment by ID or email
      const enrolled = sc.enrolled_student_ids || [];
      if (enrolled.includes(activeChild.id) || (activeChild.email && enrolled.includes(activeChild.email))) {
        return true;
      }
      // 2. Class name matching student grade and section
      if (sc.class_name) {
        const cn = sc.class_name.toLowerCase().replace(/grade\s*/gi, '').trim();
        const cnParts = cn.split(/[-\s]+/);
        const cnGrade = cnParts.find((p) => /^\d+$/.test(p)) || '';
        const cnLetter = cnParts.find((p) => /^[a-z]$/.test(p))?.toUpperCase() || '';
        if (cnGrade === childGradeNum && (!cnLetter || cnLetter === childLetter)) {
          return true;
        }
      }
      return false;
    });
  }, [subjectClasses, activeChild]);

  // Helper to fetch syllabus terms for a subject class
  const getClassSyllabusTerms = (cls: SubjectClass) => {
    const subName = (cls.subject || '').toLowerCase().trim();
    const clsName = cls.name.toLowerCase().trim();
    const gradeSection = (cls.class_name || '').toLowerCase().replace(/grade\s*/gi, '').trim();

    return syllabus.filter((term) => {
      if (term.class_id && term.class_id === cls.id) return true;
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
      const tName = term.name.toLowerCase();
      if (subName && tName.includes(subName)) return true;
      if (clsName && tName.includes(clsName)) return true;
      return false;
    });
  };

  // Accurate syllabus calculation across all enrolled subject classes
  let totalTopics = 0;
  let teacherDone = 0;
  childSubjectClasses.forEach((sc) => {
    const terms = getClassSyllabusTerms(sc);
    terms.forEach((term) => {
      (term.topics || []).forEach((topic) => {
        totalTopics++;
        if (topic.teacher_checked) teacherDone++;
      });
    });
  });
  const syllabusPct = totalTopics > 0 ? Math.round((teacherDone / totalTopics) * 100) : 0;

  // Child's achievements
  const childAchievements = useMemo(() => {
    if (!activeChild) return [];
    return achievements.filter(
      (a) =>
        a.student_id === activeChild.id &&
        a.title !== '__USER_AVATAR__' &&
        a.title !== '__PARENT_DOC__' &&
        a.title !== '__LEAVE_REQUEST__' &&
        a.title !== '__GRADE_ASSESSMENT_TERM__' &&
        !String(a.title || '').startsWith('__')
    );
  }, [achievements, activeChild]);

  // Child's documents
  const childDocuments = useMemo(() => {
    if (!activeChild) return [];
    return parentDocuments.filter((d) => d.student_id === activeChild.id);
  }, [parentDocuments, activeChild]);

  // ─── Child-Class Filtering ───────────────────────────────────────────────
  // Build a class-key string like "12-c" from the child's grade + class_letter
  const childClassKey = useMemo(() => {
    if (!activeChild) return '';
    const gradeNum = (activeChild.grade || '').replace(/[^0-9]/g, '');
    const letter = (activeChild.class_letter || '').toUpperCase();
    return `${gradeNum}${letter ? `-${letter}` : ''}`.toLowerCase();
  }, [activeChild]);

  // IDs of subject-classes this child is enrolled in
  const childEnrolledClassIds = useMemo(() => {
    if (!activeChild) return new Set<string>();
    const ids = subjectClasses
      .filter((sc) => (sc.enrolled_student_ids || []).includes(activeChild.id))
      .map((sc) => sc.id);
    return new Set(ids);
  }, [subjectClasses, activeChild]);

  // Helper: does a class_name field match the active child's class?
  const matchesChildClass = (className?: string): boolean => {
    if (!className) return true; // unscoped → show to everyone
    const cn = className.toLowerCase().replace(/grade\s*/gi, '').trim();
    return cn === childClassKey || className.toLowerCase().includes(childClassKey);
  };

  // Filtered tests — only for child's class
  const childTests = useMemo(
    () => (activeChild ? tests.filter((t) => matchesChildClass(t.class_name)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tests, activeChild, childClassKey]
  );

  // Filtered assignments — only for child's class
  const childAssignments = useMemo(
    () => (activeChild ? assignments.filter((a) => matchesChildClass(a.class_name)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [assignments, activeChild, childClassKey]
  );

  // Filtered broadcasts — only from classes the child is enrolled in
  const childBroadcasts = useMemo(() => {
    if (!activeChild) return [];
    const childGradeNum = (activeChild.grade || '').replace(/[^0-9]/g, '');
    const childLetter = (activeChild.class_letter || '').toUpperCase().trim();
    const childHomeroomId = `homeroom-${childGradeNum}-${childLetter}`;

    return classBroadcasts.filter((b) => {
      const cid = b.class_id || '';

      // 1. Exact homeroom match for this child
      if (cid === childHomeroomId) return true;

      // 2. Enrolled in a subject class that posted this broadcast
      if (cid && childEnrolledClassIds.has(cid)) return true;

      // 3. Fallback: find the subject_class record and match class_name
      if (cid) {
        const sc = subjectClasses.find((s) => s.id === cid);
        if (sc) return matchesChildClass(sc.class_name);
        // If class_id is a homeroom ID for a DIFFERENT class — hide it
        if (cid.startsWith('homeroom-')) return false;
      }

      // 4. No class_id — only show if explicitly marked school-wide
      // (we don't show untagged broadcasts to all parents — too broad)
      return false;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classBroadcasts, activeChild, childEnrolledClassIds, subjectClasses, childClassKey]);

  // Filtered hub activities — only targeting the child's grade
  const childHubActivities = useMemo(() => {
    if (!activeChild) return hubActivities;
    const rawGrade = String(activeChild.grade || '').trim();
    const letterStr = String(activeChild.class_letter || '').trim().toUpperCase();
    // Extract just the number e.g. "Grade 12 (CBSE)" → "12"
    const gradeNum = rawGrade.match(/\d+/)?.[0] || '';
    const fullClass = gradeNum && letterStr ? `${gradeNum}-${letterStr}` : gradeNum;

    return hubActivities.filter((act) => {
      const targets = act.target_grades || [];
      if (targets.length === 0) return true;
      return targets.some((t) => {
        const norm = t.toLowerCase().replace(/\s+/g, '').replace(/^grade/, '');
        return (fullClass && norm === fullClass.toLowerCase()) || (gradeNum && norm === gradeNum);
      });
    });
  }, [hubActivities, activeChild]);

  const handleFileInputChange = (docType: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && activeChild) {
      const file = e.target.files[0];
      const fileName = file.name;
      const childId = activeChild.id;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const fileDataUrl = (ev.target?.result as string) || '';
        onUploadDoc(docType, fileName, childId, fileDataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleApplyLeaveSubmit = async (leaveData: {
    startDate: string;
    endDate: string;
    reason: string;
    leaveType: string;
    fileName?: string;
    fileUrl?: string;
  }) => {
    if (onApplyLeave && activeChild) {
      await onApplyLeave(leaveData, activeChild.id);
      setIsApplyLeaveModalOpen(false);
    }
  };

  return (
    <div className="app-viewport">
      {/* MOBILE TOP BAR (Screens <= 768px) */}
      <div className="mobile-top-bar">
        <div className="mobile-top-bar-brand" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            className="mobile-icon-btn"
            onClick={() => setIsMobileDrawerOpen(true)}
            aria-label="Open Navigation Menu"
            style={{
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 8,
              background: '#F4F3F0',
              border: '1px solid var(--border-color)',
              color: 'var(--neutral-dark)',
            }}
          >
            <Menu size={18} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <WoodlemEmblemSVG size={26} />
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.05 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--neutral-dark)', letterSpacing: '-0.02em' }}>
                WOODLEM
              </span>
              <span style={{ fontSize: 8.5, fontWeight: 700, color: '#265E5A', letterSpacing: '0.06em' }}>
                PARENT
              </span>
            </div>
          </div>
        </div>

        <div className="mobile-top-bar-actions">
          {/* Quick Ward Switcher Trigger */}
          {activeChild ? (
            <button
              type="button"
              onClick={() => setIsMobileChildPickerOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 11px',
                borderRadius: 20,
                background: '#EAF3F1',
                border: '1px solid #B8D9D4',
                color: '#265E5A',
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer',
                maxWidth: 150,
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeChild.name.split(' ')[0]}
              </span>
              <ChevronDown size={13} style={{ flexShrink: 0 }} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsRequestLinkModalOpen(true)}
              style={{
                padding: '4px 10px',
                borderRadius: 14,
                background: '#2D6E5D',
                color: '#FFFFFF',
                fontSize: 11,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              + Link Ward
            </button>
          )}

          {/* Profile / Settings Button */}
          <button
            type="button"
            className="mobile-icon-btn"
            onClick={() => setActiveTab('settings')}
            aria-label="Profile Settings"
            style={{ width: 34, height: 34, padding: 0 }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: '#265E5A',
                color: '#FFFFFF',
                fontSize: 12,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {sidebarAvatarUrl ? (
                <img
                  src={sidebarAvatarUrl}
                  alt={currentUser?.name || 'P'}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                (currentUser?.name || 'P').charAt(0).toUpperCase()
              )}
            </div>
          </button>
        </div>
      </div>

      {/* MOBILE SLIDE-OVER DRAWER */}
      {isMobileDrawerOpen && (
        <>
          <div
            className="mobile-drawer-backdrop"
            onClick={() => setIsMobileDrawerOpen(false)}
          />
          <div className="mobile-drawer">
            {/* Header */}
            <div className="mobile-drawer-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <WoodlemEmblemSVG size={28} />
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--neutral-dark)', letterSpacing: '-0.02em' }}>
                    WOODLEM PARK
                  </span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#265E5A', letterSpacing: '0.04em' }}>
                    PARENT PORTAL
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="mobile-icon-btn"
                onClick={() => setIsMobileDrawerOpen(false)}
                aria-label="Close Navigation"
              >
                <X size={18} />
              </button>
            </div>

            {/* Parent Profile Card */}
            <div className="mobile-drawer-profile">
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: '#EAF3F1',
                  border: '1px solid #B8D9D4',
                  color: '#265E5A',
                  fontSize: 16,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  flexShrink: 0,
                }}
              >
                {sidebarAvatarUrl ? (
                  <img
                    src={sidebarAvatarUrl}
                    alt={currentUser?.name || 'P'}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  (currentUser?.name || 'P').charAt(0).toUpperCase()
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--neutral-dark)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {currentUser?.name || 'Parent Portal'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  Parent / Guardian • {linkedStudents.length} Ward{linkedStudents.length > 1 ? 's' : ''} Linked
                </div>
              </div>
            </div>

            {/* Drawer Body */}
            <div className="mobile-drawer-body">
              {/* Linked Wards Section */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px' }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
                  Linked Wards ({linkedStudents.length})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileDrawerOpen(false);
                    setIsRequestLinkModalOpen(true);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#2C6E6A',
                    cursor: 'pointer',
                  }}
                >
                  + Add Ward
                </button>
              </div>

              {linkedStudents.map((child) => {
                const isSelected = selectedChildId === child.id;
                return (
                  <button
                    key={child.id}
                    type="button"
                    className={`mobile-drawer-item ${isSelected ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedChildId(child.id);
                      setIsMobileDrawerOpen(false);
                    }}
                  >
                    <User size={16} style={{ color: isSelected ? '#FFFFFF' : '#265E5A', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {child.name}
                      </div>
                      <div style={{ fontSize: 10.5, opacity: 0.75, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        Grade {child.grade?.replace(/[^0-9]/g, '') || '12'}{child.class_letter ? `-${child.class_letter}` : ''} • {child.admission_number || ''}
                      </div>
                    </div>
                    {isSelected && <CheckCircle size={16} color={isSelected ? '#FFFFFF' : '#265E5A'} />}
                  </button>
                );
              })}

              <div style={{ height: 1, background: 'var(--border-color)', margin: '8px 0' }} />

              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', padding: '6px 8px', letterSpacing: '0.04em' }}>
                Portals & Modules
              </div>

              <button
                type="button"
                className={`mobile-drawer-item ${activeTab === 'progress' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('progress');
                  setIsMobileDrawerOpen(false);
                }}
              >
                <User size={16} style={{ color: activeTab === 'progress' ? '#FFFFFF' : '#2C6E6A', flexShrink: 0 }} />
                <span>Academic Progress</span>
              </button>

              <button
                type="button"
                className={`mobile-drawer-item ${activeTab === 'attendance' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('attendance');
                  setIsMobileDrawerOpen(false);
                }}
              >
                <Calendar size={16} style={{ color: activeTab === 'attendance' ? '#FFFFFF' : '#2C6E6A', flexShrink: 0 }} />
                <span>Attendance Record</span>
              </button>

              <button
                type="button"
                className={`mobile-drawer-item ${activeTab === 'broadcasts' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('broadcasts');
                  setIsMobileDrawerOpen(false);
                }}
              >
                <Megaphone size={16} style={{ color: activeTab === 'broadcasts' ? '#FFFFFF' : '#2C6E6A', flexShrink: 0 }} />
                <span>Class Circulars</span>
              </button>

              <button
                type="button"
                className={`mobile-drawer-item ${activeTab === 'achievements' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('achievements');
                  setIsMobileDrawerOpen(false);
                }}
              >
                <Award size={16} style={{ color: activeTab === 'achievements' ? '#FFFFFF' : '#B8860B', flexShrink: 0 }} />
                <span>Achievements &amp; Awards</span>
              </button>

              <button
                type="button"
                className={`mobile-drawer-item ${activeTab === 'documents' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('documents');
                  setIsMobileDrawerOpen(false);
                }}
              >
                <FileText size={16} style={{ color: activeTab === 'documents' ? '#FFFFFF' : '#2C6E6A', flexShrink: 0 }} />
                <span>Student Documents</span>
              </button>

              <button
                type="button"
                className={`mobile-drawer-item ${activeTab === 'hub' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('hub');
                  setIsMobileDrawerOpen(false);
                }}
              >
                <Award size={16} style={{ color: activeTab === 'hub' ? '#FFFFFF' : '#7C5CBF', flexShrink: 0 }} />
                <span>Holistic Hub</span>
              </button>
            </div>

            {/* Drawer Footer */}
            <div className="mobile-drawer-footer">
              <button
                type="button"
                className={`mobile-drawer-item ${activeTab === 'settings' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('settings');
                  setIsMobileDrawerOpen(false);
                }}
              >
                <Settings size={16} />
                <span>Settings &amp; Passwords</span>
              </button>
              <button
                type="button"
                className={`mobile-drawer-item ${activeTab === 'support' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('support');
                  setIsMobileDrawerOpen(false);
                }}
              >
                <LifeBuoy size={16} />
                <span>Help &amp; Support</span>
              </button>
              <button
                type="button"
                className="mobile-drawer-item"
                onClick={onSignOut}
                style={{ color: '#DC2626' }}
              >
                <LogOut size={16} style={{ color: '#DC2626' }} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* MOBILE QUICK WARD PICKER SHEET */}
      {isMobileChildPickerOpen && (
        <div
          className="mobile-sheet-overlay"
          onClick={() => setIsMobileChildPickerOpen(false)}
        >
          <div
            className="mobile-sheet-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mobile-sheet-handle" />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--neutral-dark)' }}>
                Select Linked Ward
              </h3>
              <button
                type="button"
                onClick={() => setIsMobileChildPickerOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {linkedStudents.map((child) => {
                const isSelected = selectedChildId === child.id;
                return (
                  <button
                    key={child.id}
                    type="button"
                    onClick={() => {
                      setSelectedChildId(child.id);
                      setIsMobileChildPickerOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: 10,
                      border: isSelected ? '2px solid #265E5A' : '1px solid var(--border-color)',
                      background: isSelected ? '#EAF3F1' : '#FAF9F6',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.12s ease',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: isSelected ? '#1C4D46' : 'var(--neutral-dark)' }}>
                        {child.name}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                        Grade {child.grade?.replace(/[^0-9]/g, '') || '12'}{child.class_letter ? `-${child.class_letter}` : ''} • Adm: {child.admission_number || '—'}
                      </div>
                    </div>
                    {isSelected && <CheckCircle size={18} color="#265E5A" />}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => {
                  setIsMobileChildPickerOpen(false);
                  setIsRequestLinkModalOpen(true);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '12px 14px',
                  borderRadius: 10,
                  border: '1px dashed #265E5A',
                  background: '#FFFFFF',
                  color: '#265E5A',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  marginTop: 4,
                }}
              >
                <Plus size={16} />
                Link Another Ward Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REDESIGNED PARENT SIDEBAR (Desktop >= 769px) */}
      <aside
        className={`sidebar ${sidebar.isCollapsed ? 'collapsed' : ''} ${
          sidebar.isHovered && sidebar.sidebarMode === 'auto-hide' ? 'auto-hide-hovered' : ''
        }`}
        onMouseEnter={sidebar.handleMouseEnter}
        onMouseLeave={sidebar.handleMouseLeave}
        onDoubleClick={sidebar.togglePin}
      >
        {/* HEADER SECTION */}
        <div className="sidebar-header">
          <div className="sidebar-brand-row">
            <WoodlemLogo collapsed={sidebar.isCollapsed} />
          </div>

          {/* PARENT PROFILE CARD */}
          <div
            className="sidebar-profile-box"
            title={`${currentUser?.name || 'Parent'} • Parent / Guardian`}
          >
            <div className="sidebar-profile-avatar-slot">
              <div className="sidebar-profile-avatar avatar-parent-themed" style={{ overflow: 'hidden' }}>
                {sidebarAvatarUrl ? (
                  <img
                    src={sidebarAvatarUrl}
                    alt="Profile"
                    style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  (currentUser?.name || 'P').charAt(0).toUpperCase()
                )}
              </div>
            </div>

            <div className="profile-details-expanded">
              <div className="sidebar-profile-name">
                {currentUser?.name || 'Parent Portal'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span
                  className="sidebar-profile-badge"
                  style={{ background: '#EAF3F1', color: '#265E5A', borderColor: '#B8D9D4' }}
                >
                  Parent / Guardian
                </span>
              </div>
              <div className="sidebar-profile-adm" style={{ marginTop: 3 }}>
                {linkedStudents.length > 0
                  ? `${linkedStudents.length} Ward${linkedStudents.length > 1 ? 's' : ''} Linked`
                  : 'No Wards Linked'}
              </div>
            </div>
          </div>
        </div>

        {/* NAVIGATION ITEMS */}
        <nav className="nav-menu">
          <div className="sidebar-tooltip-wrapper">
            <button
              className={`nav-item ${activeTab === 'progress' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('progress');
                sidebar.handleNavClick();
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                <User
                  size={15}
                  className="icon"
                  style={{
                    color: activeTab === 'progress' ? '#2C6E6A' : 'var(--text-secondary)',
                    flexShrink: 0,
                  }}
                />
                <span className="sidebar-text">Academic Progress</span>
              </div>
            </button>
            {sidebar.isCollapsed && <div className="sidebar-tooltip">Academic Progress</div>}
          </div>

          <div className="sidebar-tooltip-wrapper">
            <button
              className={`nav-item ${activeTab === 'attendance' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('attendance');
                sidebar.handleNavClick();
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                <Calendar
                  size={15}
                  className="icon"
                  style={{
                    color: activeTab === 'attendance' ? '#2C6E6A' : 'var(--text-secondary)',
                    flexShrink: 0,
                  }}
                />
                <span className="sidebar-text">Attendance Log</span>
              </div>
            </button>
            {sidebar.isCollapsed && <div className="sidebar-tooltip">Attendance Log</div>}
          </div>

          <div className="sidebar-tooltip-wrapper">
            <button
              className={`nav-item ${activeTab === 'broadcasts' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('broadcasts');
                sidebar.handleNavClick();
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                <Megaphone
                  size={15}
                  className="icon"
                  style={{
                    color: activeTab === 'broadcasts' ? '#2C6E6A' : 'var(--text-secondary)',
                    flexShrink: 0,
                  }}
                />
                <span className="sidebar-text">Class Circulars</span>
              </div>
            </button>
            {sidebar.isCollapsed && <div className="sidebar-tooltip">Class Circulars</div>}
          </div>

          <div className="sidebar-tooltip-wrapper">
            <button
              className={`nav-item ${activeTab === 'achievements' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('achievements');
                sidebar.handleNavClick();
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                <Award
                  size={15}
                  className="icon"
                  style={{
                    color: activeTab === 'achievements' ? '#B8860B' : 'var(--text-secondary)',
                    flexShrink: 0,
                  }}
                />
                <span className="sidebar-text">Achievements &amp; Awards</span>
              </div>
            </button>
            {sidebar.isCollapsed && <div className="sidebar-tooltip">Achievements &amp; Awards</div>}
          </div>

          <div className="sidebar-tooltip-wrapper">
            <button
              className={`nav-item ${activeTab === 'documents' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('documents');
                sidebar.handleNavClick();
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                <FileText
                  size={15}
                  className="icon"
                  style={{
                    color: activeTab === 'documents' ? '#2C6E6A' : 'var(--text-secondary)',
                    flexShrink: 0,
                  }}
                />
                <span className="sidebar-text">Clearance Documents</span>
              </div>
            </button>
            {sidebar.isCollapsed && <div className="sidebar-tooltip">Clearance Documents</div>}
          </div>

          <div className="sidebar-tooltip-wrapper">
            <button
              className={`nav-item ${activeTab === 'hub' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('hub');
                sidebar.handleNavClick();
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                <BookOpen
                  size={15}
                  className="icon"
                  style={{
                    color: activeTab === 'hub' ? '#7C5CBF' : 'var(--text-secondary)',
                    flexShrink: 0,
                  }}
                />
                <span className="sidebar-text">Holistic Hub</span>
              </div>
            </button>
            {sidebar.isCollapsed && <div className="sidebar-tooltip">Holistic Hub Activities</div>}
          </div>
        </nav>

        {/* SIDEBAR FOOTER */}
        <div className="sidebar-footer">
          <div className="sidebar-tooltip-wrapper">
            <button
              className={`logout-btn-clean ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('settings');
                sidebar.handleNavClick();
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                <Settings size={15} className="icon" style={{ flexShrink: 0 }} />
                <span className="sidebar-text">Settings</span>
              </div>
            </button>
            {sidebar.isCollapsed && <div className="sidebar-tooltip">Settings &amp; Passwords</div>}
          </div>

          <div className="sidebar-tooltip-wrapper">
            <button
              className={`logout-btn-clean ${activeTab === 'support' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('support');
                sidebar.handleNavClick();
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                <LifeBuoy size={15} className="icon" style={{ flexShrink: 0 }} />
                <span className="sidebar-text">Help &amp; Support</span>
              </div>
            </button>
            {sidebar.isCollapsed && <div className="sidebar-tooltip">Help &amp; Support</div>}
          </div>

          <div className="sidebar-tooltip-wrapper">
            <button className="logout-btn-clean" onClick={onSignOut}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                <LogOut size={15} className="icon" style={{ flexShrink: 0 }} />
                <span className="sidebar-text">Sign Out</span>
              </div>
            </button>
            {sidebar.isCollapsed && <div className="sidebar-tooltip">Sign Out</div>}
          </div>
        </div>

        {sidebar.feedbackToast && (
          <div className="sidebar-feedback-toast">{sidebar.feedbackToast}</div>
        )}
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="main-content">
        {/* TOP CONTENT HEADER — GREEN PARENT PORTAL BRAND HEADER */}
        <header style={{
          background: 'linear-gradient(135deg, #1A4A3A 0%, #2D6E5D 60%, #3A8A72 100%)',
          position: 'sticky',
          top: 0,
          zIndex: 4,
          width: '100%',
          boxSizing: 'border-box',
          boxShadow: '0 2px 20px rgba(26,74,58,0.22)',
        }}>
          {/* Single unified row: badge + ward switcher + action buttons */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 40px',
            gap: 10,
            flexWrap: 'wrap',
          }} className="parent-header-row">

            {/* LEFT: badge + optional ADM */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 1, minWidth: 0 }}>
              <span style={{
                fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 4,
                background: 'rgba(255,255,255,0.15)', color: '#FFFFFF',
                border: '1px solid rgba(255,255,255,0.22)',
                letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap',
              }}>
                {activeTab === 'progress' ? 'Academic'
                  : activeTab === 'attendance' ? 'Attendance'
                  : activeTab === 'broadcasts' ? 'Circulars'
                  : activeTab === 'achievements' ? 'Honours'
                  : activeTab === 'documents' ? 'Documents'
                  : activeTab === 'hub' ? 'Hub'
                  : activeTab === 'settings' ? 'Settings'
                  : 'Support'}
                {activeChild ? ` · G${activeChild.grade?.replace(/[^0-9]/g, '') || '12'}${activeChild.class_letter ? activeChild.class_letter : ''}` : ''}
              </span>
              {activeChild?.admission_number && (
                <span className="parent-header-adm" style={{ fontSize: 10.5, fontFamily: 'monospace', color: 'rgba(255,255,255,0.55)', whiteSpace: 'nowrap' }}>
                  ADM {activeChild.admission_number}
                </span>
              )}
            </div>

            {/* RIGHT: ward switcher + action buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              {linkedStudents.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span className="parent-header-ward-label" style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>Ward:</span>
                  <CustomSelect
                    value={selectedChildId}
                    onChange={(val) => setSelectedChildId(val)}
                    options={linkedStudents.map((s) => ({
                      value: s.id,
                      label: s.name,
                      sublabel: `Grade ${s.grade?.replace(/[^0-9]/g, '') || '12'}${s.class_letter ? `-${s.class_letter}` : ''}`,
                    }))}
                    buttonStyle={{
                      background: 'rgba(255,255,255,0.12)',
                      border: '1px solid rgba(255,255,255,0.28)',
                      color: '#FFFFFF',
                      fontSize: 12, fontWeight: 700,
                      borderRadius: 6, padding: '4px 10px',
                      minWidth: 100,
                    }}
                    menuStyle={{
                      minWidth: 170, background: '#FFFFFF',
                      border: '1px solid var(--border-color)',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                    }}
                  />
                </div>
              )}

              {activeChild && activeTab === 'attendance' && (
                <button
                  type="button"
                  onClick={() => setIsApplyLeaveModalOpen(true)}
                  style={{
                    padding: '5px 12px', fontSize: 11.5, fontWeight: 600,
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.32)',
                    color: '#FFFFFF', borderRadius: 6, cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Calendar size={12} />
                  <span className="parent-header-btn-label">Apply for Leave</span>
                </button>
              )}

              {linkedStudents.length > 0 && activeTab === 'settings' && (
                <button
                  type="button"
                  onClick={() => setIsRequestLinkModalOpen(true)}
                  style={{
                    padding: '5px 10px', fontSize: 11.5, fontWeight: 600,
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)',
                    color: '#FFFFFF', borderRadius: 6, cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Plus size={12} />
                  <span className="parent-header-btn-label">Add Child</span>
                </button>
              )}
            </div>
          </div>

          {/* Title block — sits below the row */}
          <div style={{ padding: '0 40px 18px 40px' }} className="parent-header-title">
            <h1 style={{
              margin: 0, fontFamily: 'var(--font-display)',
              fontSize: 24, fontWeight: 700,
              color: '#FFFFFF', letterSpacing: '-0.02em',
              lineHeight: 1.25,
            }}>
              {activeTab === 'progress'
                ? activeChild ? `${activeChild.name}'s Academic Overview` : 'Academic Overview'
                : activeTab === 'attendance'
                ? 'Attendance & Leave Records'
                : activeTab === 'broadcasts'
                ? 'Classroom Notices & Circulars'
                : activeTab === 'achievements'
                ? 'Student Honors & Distinctions'
                : activeTab === 'documents'
                ? 'Mandatory Student Documents'
                : activeTab === 'hub'
                ? 'Holistic Development Hub'
                : activeTab === 'settings'
                ? 'Settings & Passwords'
                : 'Help & Support'}
            </h1>
            <p className="parent-header-subtitle" style={{ margin: '4px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.4 }}>
              {activeTab === 'progress'
                ? `Live marks, syllabus coverage & assessments for ${activeChild?.name || 'your ward'}.`
                : activeTab === 'attendance'
                ? `Roll call logs & leave submissions for ${activeChild?.name || 'your ward'}.`
                : activeTab === 'broadcasts'
                ? `Official notices from Class Teachers for Grade ${activeChild?.grade || '12'}.`
                : activeTab === 'achievements'
                ? `Awards & milestones achieved by ${activeChild?.name || 'your ward'}.`
                : activeTab === 'documents'
                ? `Required enrollment files for ${activeChild?.name || 'your ward'}.`
                : activeTab === 'hub'
                ? 'School events, masterclasses & co-curricular programs.'
                : activeTab === 'settings'
                ? 'Manage your account profile and password.'
                : 'Get in touch with Woodlem Park support.'}
            </p>
          </div>
        </header>

        {/* NOTIFICATION BANNER: PENDING VERIFICATION REQUESTS */}
        {myPendingRequests.length > 0 && (
          <div className="parent-notification-banner">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#FDE68A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Clock size={17} color="#D97706" />
              </div>
              <div>
                <strong>Verification Pending Admin Review:</strong>{' '}
                Link request for{' '}
                <strong>{myPendingRequests.map((r) => `${r.student_name} (${r.student_admission_number})`).join(', ')}</strong>
                {' '}is under review. Child data will become visible once approved.
              </div>
            </div>
            <span
              style={{
                background: '#FDE68A',
                color: '#92400E',
                fontSize: 11,
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: 12,
                whiteSpace: 'nowrap',
                border: '1px solid #F9C846',
              }}
            >
              Awaiting Approval
            </span>
          </div>
        )}

        {/* CONTENT BODY */}
        <div className="content-body" style={{ overflowX: 'hidden', maxWidth: '100%', boxSizing: 'border-box' }}>
          {/* EMPTY STATE IF NO CHILD LINKED (Shown for student-specific academic tabs) */}
          {!activeChild && activeTab !== 'settings' && activeTab !== 'support' && activeTab !== 'hub' && (
            <div
              style={{
                background: 'linear-gradient(145deg, #FFFFFF 0%, #F8FFFE 100%)',
                borderRadius: 16,
                border: '1px solid #D4EDE9',
                padding: '60px 40px',
                textAlign: 'center',
                maxWidth: 580,
                margin: '30px auto',
                boxShadow: '0 4px 24px rgba(28,77,70,0.06)',
              }}
            >
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 20,
                  background: 'linear-gradient(135deg, #EAF3F1 0%, #D4EDE9 100%)',
                  color: '#2C6E6A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px',
                  boxShadow: '0 4px 12px rgba(44,110,106,0.15)',
                }}
              >
                <UserCheck size={34} />
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0F3330', margin: '0 0 10px', letterSpacing: '-0.3px' }}>
                Welcome to Woodlem Parent Portal
              </h2>
              <p style={{ fontSize: 14, color: '#64748B', marginTop: 0, lineHeight: 1.65, maxWidth: 420, margin: '0 auto 24px' }}>
                To view your child&apos;s grades, attendance records, class announcements, and document clearance, connect their account using their school <strong style={{ color: '#1C4D46' }}>Admission Number</strong>.
              </p>
              <button
                onClick={() => setIsRequestLinkModalOpen(true)}
                style={{
                  padding: '12px 28px',
                  background: '#2D2C2A',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 10,
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 9,
                  boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                  transition: 'all 0.15s',
                  letterSpacing: '0.01em',
                }}
              >
                <Plus size={17} />
                Link Your Child Account
              </button>
              <p style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 16 }}>
                Your request will be reviewed and approved by the School Administration office.
              </p>
            </div>
          )}


          {/* VIEW 1: ACADEMIC PROGRESS */}
          {activeChild && activeTab === 'progress' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* TOP STATS CARDS */}
              <div className="parent-stats-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
                {/* Attendance Rate Card */}
                <div
                  className="parent-stat-card"
                  style={{
                    borderLeft: '4px solid #2C6E6A',
                    background: 'linear-gradient(135deg, #FFFFFF 0%, #F0FAF8 100%)',
                  }}
                >
                  <div className="parent-stat-icon" style={{ background: 'rgba(44,110,106,0.12)' }}>
                    <Calendar size={22} color="#2C6E6A" />
                  </div>
                  <div>
                    <div className="parent-stat-value" style={{ color: '#1C4D46' }}>{attendanceRate}%</div>
                    <div className="parent-stat-label">
                      Attendance Rate
                    </div>
                    <div style={{ fontSize: 11, color: '#64748B', marginTop: 3 }}>
                      {presentCount} present / {totalSessions} logged sessions
                    </div>
                  </div>
                </div>

                {/* Absences Card */}
                <div
                  className="parent-stat-card"
                  style={{
                    borderLeft: `4px solid ${absentCount > 5 ? '#DC2626' : absentCount > 2 ? '#D97706' : '#94A3B8'}`,
                    background: absentCount > 5 ? 'linear-gradient(135deg, #FFFFFF 0%, #FFF5F5 100%)' : 'linear-gradient(135deg, #FFFFFF 0%, #FFFBF0 100%)',
                  }}
                >
                  <div
                    className="parent-stat-icon"
                    style={{ background: absentCount > 5 ? 'rgba(220,38,38,0.1)' : 'rgba(217,119,6,0.1)' }}
                  >
                    <AlertTriangle size={22} color={absentCount > 5 ? '#DC2626' : '#D97706'} />
                  </div>
                  <div>
                    <div
                      className="parent-stat-value"
                      style={{ color: absentCount > 5 ? '#DC2626' : absentCount > 2 ? '#D97706' : 'var(--neutral-dark)' }}
                    >
                      {absentCount}
                    </div>
                    <div className="parent-stat-label">Absences Recorded</div>
                    <div style={{ fontSize: 11, color: '#64748B', marginTop: 3 }}>
                      {absentCount === 0 ? 'No absences — excellent!' : absentCount <= 2 ? 'Within acceptable range' : 'Please contact the school'}
                    </div>
                  </div>
                </div>
              </div>

              {/* ACTIVE TESTS & HOMEWORK */}
              <div className="panel-block" style={{ marginBottom: 24 }}>
                <h3 className="section-title">Active Assessments & Assignments</h3>
                {(() => {
                  // Build class identifier to filter: e.g. "12-C" or "Grade 12-C"
                  const childGradeNum = activeChild ? (activeChild.grade || '').replace(/[^0-9]/g, '') : '';
                  const childLetter = activeChild ? (activeChild.class_letter || '') : '';
                  const childClassKey = `${childGradeNum}${childLetter ? `-${childLetter}` : ''}`.toLowerCase();

                  const resolveItemSubject = (item: { title?: string; class_name?: string }) => {
                    const text = `${item.title || ''} ${item.class_name || ''}`.toLowerCase();
                    if (text.includes('math')) return 'Mathematics';
                    if (text.includes('bio')) return 'Biology';
                    if (text.includes('physic')) return 'Physics';
                    if (text.includes('chem')) return 'Chemistry';
                    if (text.includes('comp') || text.includes('cs') || text.includes('science')) {
                      if (text.includes('comp') || text.includes('cs')) return 'Computer Science';
                    }
                    if (text.includes('eng')) return 'English';
                    if (text.includes('arab')) return 'Arabic';
                    if (text.includes('islam')) return 'Islamic Studies';
                    if (text.includes('social') || text.includes('history') || text.includes('geog')) return 'Social Studies';

                    if (item.class_name) {
                      const match = (subjectClasses || []).find(sc =>
                        sc.name.toLowerCase() === item.class_name?.toLowerCase() ||
                        item.class_name?.toLowerCase().includes(sc.subject.toLowerCase())
                      );
                      if (match) return match.subject;
                    }
                    return item.class_name || 'General';
                  };

                  const filteredTests = tests.filter((t) => {
                    if (!activeChild) return false;
                    if (!t.class_name) return true;
                    const cn = t.class_name.toLowerCase().replace(/grade\s*/gi, '').trim();
                    return cn === childClassKey || t.class_name.toLowerCase().includes(childClassKey);
                  });

                  const filteredAssignments = assignments.filter((a) => {
                    if (!activeChild) return false;
                    if (!a.class_name) return true;
                    const cn = a.class_name.toLowerCase().replace(/grade\s*/gi, '').trim();
                    return cn === childClassKey || a.class_name.toLowerCase().includes(childClassKey);
                  });

                  const totalItems = filteredTests.length + filteredAssignments.length;

                  if (totalItems === 0) {
                    return (
                      <div className="empty-state">No active assessments or assignments for {activeChild?.name}&apos;s class.</div>
                    );
                  }

                  return (
                    <>
                      {/* Desktop Table View */}
                      <div className="hide-mobile" style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                          <thead>
                            <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                              <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Title</th>
                              <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Subject</th>
                              <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Type</th>
                              <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Details</th>
                              <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600, fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredTests.map((t, i) => (
                              <tr
                                key={t.id}
                                style={{
                                  borderBottom: '1px solid var(--border-color)',
                                  background: i % 2 === 0 ? 'transparent' : 'var(--neutral-bg)',
                                }}
                              >
                                <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--neutral-dark)' }}>{t.title}</td>
                                <td style={{ padding: '10px 12px' }}>
                                  <span style={{ background: '#EAF3EF', color: '#1C4D46', fontSize: 11.5, fontWeight: 700, padding: '3px 8px', borderRadius: 6, display: 'inline-block' }}>
                                    {resolveItemSubject(t)}
                                  </span>
                                </td>
                                <td style={{ padding: '10px 12px' }}>
                                  <span style={{ background: 'rgba(230,150,80,0.12)', color: '#C97520', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4, whiteSpace: 'nowrap' }}>
                                    Assessment
                                  </span>
                                </td>
                                <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: 12 }}>
                                  {t.duration_minutes || 30} mins · {t.questions?.length || 0} questions
                                </td>
                                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, fontSize: 12, color: '#2C6E6A', whiteSpace: 'nowrap' }}>
                                  In Progress
                                </td>
                              </tr>
                            ))}
                            {filteredAssignments.map((a, i) => (
                              <tr
                                key={a.id}
                                style={{
                                  borderBottom: '1px solid var(--border-color)',
                                  background: (filteredTests.length + i) % 2 === 0 ? 'transparent' : 'var(--neutral-bg)',
                                }}
                              >
                                <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--neutral-dark)' }}>{a.title}</td>
                                <td style={{ padding: '10px 12px' }}>
                                  <span style={{ background: '#EAF3EF', color: '#1C4D46', fontSize: 11.5, fontWeight: 700, padding: '3px 8px', borderRadius: 6, display: 'inline-block' }}>
                                    {resolveItemSubject(a)}
                                  </span>
                                </td>
                                <td style={{ padding: '10px 12px' }}>
                                  <span style={{ background: 'rgba(100,130,200,0.1)', color: '#3B5FC0', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4, whiteSpace: 'nowrap' }}>
                                    Homework
                                  </span>
                                </td>
                                <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: 12 }}>
                                  {a.class_name || 'Academic Assignment'}
                                </td>
                                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, fontSize: 12, color: 'var(--doc-pending)', whiteSpace: 'nowrap' }}>
                                  Due Soon
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile Cards View */}
                      <div className="hide-desktop" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {filteredTests.map((t) => (
                          <div
                            key={t.id}
                            style={{
                              background: '#FFFFFF',
                              border: '1px solid var(--border-color)',
                              borderRadius: 8,
                              padding: '12px 14px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 6,
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                              <div>
                                <span style={{ background: '#EAF3EF', color: '#1C4D46', fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 4, display: 'inline-block', marginBottom: 4 }}>
                                  {resolveItemSubject(t)}
                                </span>
                                <h4 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                                  {t.title}
                                </h4>
                              </div>
                              <span style={{ background: 'rgba(230,150,80,0.12)', color: '#C97520', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap' }}>
                                Assessment
                              </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5, color: 'var(--text-secondary)', borderTop: '1px solid #F1F5F9', paddingTop: 6 }}>
                              <span>{t.duration_minutes || 30} mins · {t.questions?.length || 0} questions</span>
                              <span style={{ color: '#2C6E6A', fontWeight: 600 }}>In Progress</span>
                            </div>
                          </div>
                        ))}
                        {filteredAssignments.map((a) => (
                          <div
                            key={a.id}
                            style={{
                              background: '#FFFFFF',
                              border: '1px solid var(--border-color)',
                              borderRadius: 8,
                              padding: '12px 14px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 6,
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                              <div>
                                <span style={{ background: '#EAF3EF', color: '#1C4D46', fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 4, display: 'inline-block', marginBottom: 4 }}>
                                  {resolveItemSubject(a)}
                                </span>
                                <h4 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                                  {a.title}
                                </h4>
                              </div>
                              <span style={{ background: 'rgba(100,130,200,0.1)', color: '#3B5FC0', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap' }}>
                                Homework
                              </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5, color: 'var(--text-secondary)', borderTop: '1px solid #F1F5F9', paddingTop: 6 }}>
                              <span>{a.class_name || 'Academic Assignment'}</span>
                              <span style={{ color: 'var(--doc-pending)', fontWeight: 600 }}>Due Soon</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* RELEASED IN-SCHOOL MARKS */}
              <div className="panel-block" style={{ marginBottom: 24 }}>
                <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0 0 6px' }}>
                  <span>Released In-School Marks</span>
                  <span style={{ fontSize: 11, background: '#EAF3EF', color: '#2C6E6A', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
                    Official Grades
                  </span>
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
                  Verified examination terms and subject grades published by faculty for {activeChild?.name}.
                </p>

                {releasedMarks.length === 0 ? (
                  <div className="empty-state">No in-school marks have been released for {activeChild?.name} yet.</div>
                ) : (
                  <>
                    {/* Desktop Table View */}
                    <div className="hide-mobile" style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                            <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Assessment</th>
                            <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Date</th>
                            <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Teacher Notes</th>
                            <th style={{ textAlign: 'center', padding: '8px 12px', fontWeight: 600, fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', width: 80 }}>Grade</th>
                            <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600, fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', width: 120 }}>Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {releasedMarks.map((m: any, i: number) => {
                            const score = Number(m.marks);
                            const maxScore = Number(m.offline_assessments?.maximum_marks || 100);
                            const pct = (score / maxScore) * 100;

                            let letter = 'F';
                            let letterColor = '#DC2626';
                            let letterBg = '#FEE2E2';

                            if (pct >= 90) {
                              letter = 'A';
                              letterColor = '#2C6E6A';
                              letterBg = '#EAF3EF';
                            } else if (pct >= 80) {
                              letter = 'B';
                              letterColor = '#2C6E6A';
                              letterBg = '#EAF3EF';
                            } else if (pct >= 70) {
                              letter = 'C';
                              letterColor = '#B8860B';
                              letterBg = '#FEF3C7';
                            } else if (pct >= 50) {
                              letter = 'D';
                              letterColor = '#D97706';
                              letterBg = '#FFEDD5';
                            }

                            return (
                              <tr
                                key={i}
                                style={{
                                  borderBottom: '1px solid var(--border-color)',
                                  background: i % 2 === 0 ? 'transparent' : 'var(--neutral-bg)',
                                }}
                              >
                                <td style={{ padding: '12px 12px', fontWeight: 600, color: 'var(--neutral-dark)' }}>
                                  {m.offline_assessments?.title || 'Assessment'}
                                </td>
                                <td style={{ padding: '12px 12px', color: 'var(--text-secondary)', fontSize: 12 }}>
                                  {m.offline_assessments?.assessment_date && new Date(m.offline_assessments.assessment_date + 'T00:00:00').toLocaleDateString()}
                                </td>
                                <td style={{ padding: '12px 12px', color: '#475569', fontSize: 12 }}>
                                  {m.teacher_note || <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>No notes provided</span>}
                                </td>
                                <td style={{ padding: '12px 12px', textAlign: 'center' }}>
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      width: 26,
                                      height: 26,
                                      borderRadius: '50%',
                                      background: letterBg,
                                      color: letterColor,
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontWeight: 800,
                                      fontSize: 12,
                                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                                    }}
                                  >
                                    {letter}
                                  </span>
                                </td>
                                <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 800, color: '#1C4D46', fontSize: 14 }}>
                                  {score}
                                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 400 }}>
                                    {' '}/ {maxScore}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Touch Cards View */}
                    <div className="hide-desktop" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {releasedMarks.map((m: any, i: number) => {
                        const score = Number(m.marks);
                        const maxScore = Number(m.offline_assessments?.maximum_marks || 100);
                        const pct = (score / maxScore) * 100;
                        let letter = 'F';
                        let letterColor = '#DC2626';
                        let letterBg = '#FEE2E2';
                        if (pct >= 90) {
                          letter = 'A';
                          letterColor = '#2C6E6A';
                          letterBg = '#EAF3EF';
                        } else if (pct >= 80) {
                          letter = 'B';
                          letterColor = '#2C6E6A';
                          letterBg = '#EAF3EF';
                        } else if (pct >= 70) {
                          letter = 'C';
                          letterColor = '#B8860B';
                          letterBg = '#FEF3C7';
                        } else if (pct >= 50) {
                          letter = 'D';
                          letterColor = '#D97706';
                          letterBg = '#FFEDD5';
                        }

                        return (
                          <div
                            key={i}
                            style={{
                              background: '#FFFFFF',
                              border: '1px solid var(--border-color)',
                              borderRadius: 8,
                              padding: '12px 14px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 8,
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                              <div>
                                <h4 style={{ margin: '0 0 3px', fontSize: 13.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                                  {m.offline_assessments?.title || 'Assessment'}
                                </h4>
                                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                  {m.offline_assessments?.assessment_date && new Date(m.offline_assessments.assessment_date + 'T00:00:00').toLocaleDateString(undefined, { dateStyle: 'medium' })}
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    width: 24,
                                    height: 24,
                                    borderRadius: '50%',
                                    background: letterBg,
                                    color: letterColor,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 800,
                                    fontSize: 11,
                                  }}
                                >
                                  {letter}
                                </span>
                                <div style={{ textAlign: 'right' }}>
                                  <span style={{ fontSize: 14, fontWeight: 800, color: '#1C4D46' }}>{score}</span>
                                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>/{maxScore}</span>
                                </div>
                              </div>
                            </div>
                            {m.teacher_note && (
                              <div style={{ fontSize: 11.5, color: '#475569', background: '#F8F7F4', padding: '6px 10px', borderRadius: 6, border: '1px solid #ECEAE5' }}>
                                <strong>Teacher Note:</strong> {m.teacher_note}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* SYLLABUS PROGRESS BY SUBJECT */}
              <div className="panel-block">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <h3 className="section-title" style={{ margin: 0 }}>
                      Curriculum &amp; Syllabus Coverage by Subject
                    </h3>
                    <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                      Click on any enrolled subject classroom to view detailed chapter and topic coverage.
                    </p>
                  </div>
                  {childSubjectClasses.length > 0 && (
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#1C4D46',
                        background: 'rgba(44,110,106,0.1)',
                        padding: '4px 12px',
                        borderRadius: 20,
                      }}
                    >
                      {childSubjectClasses.length} Enrolled Subject{childSubjectClasses.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {childSubjectClasses.length === 0 ? (
                    <div className="empty-state" style={{ textAlign: 'left', padding: '24px 20px' }}>
                      <strong style={{ display: 'block', marginBottom: 4, color: 'var(--neutral-dark)' }}>
                        No subject classrooms registered yet.
                      </strong>
                      Enrolled subject classes and teacher syllabus progress for {activeChild?.name} will appear here.
                    </div>
                  ) : (
                    childSubjectClasses.map((sc) => {
                      const terms = getClassSyllabusTerms(sc);
                      let scTotal = 0;
                      let scDone = 0;
                      terms.forEach((term) => {
                        (term.topics || []).forEach((t) => {
                          scTotal++;
                          if (t.teacher_checked) scDone++;
                        });
                      });
                      const scPct = scTotal > 0 ? Math.round((scDone / scTotal) * 100) : 0;
                      const isExpanded = !!expandedClassIds[sc.id];

                      return (
                        <div
                          key={sc.id}
                          style={{
                            background: '#FFFFFF',
                            border: isExpanded ? '1.5px solid #2C6E6A' : '1px solid var(--border-color)',
                            borderRadius: 12,
                            overflow: 'hidden',
                            transition: 'all 0.2s ease',
                            boxShadow: isExpanded ? '0 6px 20px rgba(44,110,106,0.08)' : '0 1px 3px rgba(0,0,0,0.02)',
                          }}
                        >
                          {/* CLICKABLE SUBJECT HEADER CARD */}
                          <div
                            onClick={() => toggleClassExpanded(sc.id)}
                            style={{
                              padding: '16px 20px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              cursor: 'pointer',
                              background: isExpanded ? 'linear-gradient(135deg, #F8FFFE 0%, #F0FAF8 100%)' : '#FFFFFF',
                              borderBottom: isExpanded ? '1px solid #D4EDE9' : 'none',
                              gap: 16,
                              userSelect: 'none',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                              <div
                                style={{
                                  width: 42,
                                  height: 42,
                                  borderRadius: 10,
                                  background: 'linear-gradient(135deg, #EAF3EF 0%, #D4EDE9 100%)',
                                  color: '#1C4D46',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 800,
                                  fontSize: 15,
                                  letterSpacing: '0.02em',
                                  flexShrink: 0,
                                }}
                              >
                                {sc.subject ? sc.subject.slice(0, 2).toUpperCase() : 'SC'}
                              </div>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                                    {sc.name}
                                  </h4>
                                  <span
                                    style={{
                                      fontSize: 11,
                                      background: '#F1F5F9',
                                      color: '#475569',
                                      padding: '2px 8px',
                                      borderRadius: 4,
                                      fontWeight: 600,
                                    }}
                                  >
                                    {sc.class_name || sc.section || 'Classroom'}
                                  </span>
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
                                  Faculty: <strong style={{ color: 'var(--neutral-dark)' }}>{sc.teacher_name || 'Subject Teacher'}</strong>
                                  {sc.room ? ` • Room: ${sc.room}` : ''}
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                              {/* Progress bar & coverage */}
                              <div style={{ width: 130, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
                                  <span style={{ color: 'var(--text-secondary)' }}>Taught</span>
                                  <strong style={{ color: '#2C6E6A' }}>{scPct}%</strong>
                                </div>
                                <div style={{ width: '100%', height: 6, background: '#E2E8F0', borderRadius: 3, overflow: 'hidden' }}>
                                  <div
                                    style={{
                                      width: `${scPct}%`,
                                      height: '100%',
                                      background: scPct > 75 ? '#2C6E6A' : scPct > 40 ? '#D97706' : '#64748B',
                                      borderRadius: 3,
                                      transition: 'width 0.3s ease',
                                    }}
                                  />
                                </div>
                              </div>

                              {/* Topics Pill Badge */}
                              <span
                                style={{
                                  fontSize: 12,
                                  fontWeight: 600,
                                  padding: '4px 10px',
                                  borderRadius: 6,
                                  background: scTotal > 0 ? 'rgba(44,110,106,0.1)' : '#F1F5F9',
                                  color: scTotal > 0 ? '#1C4D46' : '#64748B',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {scTotal > 0 ? `${scDone}/${scTotal} Topics` : 'No Topics'}
                              </span>

                              {/* Arrow Toggle */}
                              <div
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: 6,
                                  background: isExpanded ? 'rgba(44,110,106,0.12)' : '#F1F5F9',
                                  color: isExpanded ? '#1C4D46' : '#64748B',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </div>
                            </div>
                          </div>

                          {/* EXPANDED TOPICS & TERMS ACCORDION */}
                          {isExpanded && (
                            <div style={{ padding: '18px 20px', background: '#FAFAFA' }}>
                              {terms.length === 0 ? (
                                <div style={{ padding: '16px', background: '#FFFFFF', borderRadius: 8, border: '1px dashed var(--border-color)', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                                  No syllabus topics published by {sc.teacher_name || 'the teacher'} for this subject yet.
                                </div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                  {terms.map((term) => {
                                    const termTopics = term.topics || [];
                                    const termDoneCount = termTopics.filter((t) => t.teacher_checked).length;
                                    const termPct = termTopics.length > 0 ? Math.round((termDoneCount / termTopics.length) * 100) : 0;

                                    return (
                                      <div
                                        key={term.id}
                                        style={{
                                          background: '#FFFFFF',
                                          borderRadius: 8,
                                          border: '1px solid var(--border-color)',
                                          padding: '14px 16px',
                                        }}
                                      >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                          <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                                            {term.name}
                                          </span>
                                          <span style={{ fontSize: 12, fontWeight: 600, color: '#2C6E6A' }}>
                                            {termDoneCount} of {termTopics.length} completed ({termPct}%)
                                          </span>
                                        </div>

                                        {termTopics.length === 0 ? (
                                          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
                                            No topics listed in this section.
                                          </p>
                                        ) : (
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            {termTopics.map((topic) => (
                                              <div
                                                key={topic.id}
                                                style={{
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'space-between',
                                                  padding: '8px 12px',
                                                  background: topic.teacher_checked ? '#F0FAF8' : '#FAF9F7',
                                                  borderRadius: 6,
                                                  border: topic.teacher_checked ? '1px solid #D4EDE9' : '1px solid var(--border-color)',
                                                }}
                                              >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                  <span
                                                    style={{
                                                      width: 18,
                                                      height: 18,
                                                      borderRadius: '50%',
                                                      background: topic.teacher_checked ? '#2C6E6A' : '#E2E8F0',
                                                      color: '#FFFFFF',
                                                      display: 'flex',
                                                      alignItems: 'center',
                                                      justifyContent: 'center',
                                                      fontSize: 10,
                                                      fontWeight: 700,
                                                      flexShrink: 0,
                                                    }}
                                                  >
                                                    {topic.teacher_checked ? '✓' : '•'}
                                                  </span>
                                                  <span
                                                    style={{
                                                      fontSize: 13,
                                                      color: 'var(--neutral-dark)',
                                                      fontWeight: topic.teacher_checked ? 600 : 400,
                                                    }}
                                                  >
                                                    {topic.title}
                                                  </span>
                                                </div>

                                                <span
                                                  style={{
                                                    fontSize: 11,
                                                    fontWeight: 700,
                                                    padding: '2px 8px',
                                                    borderRadius: 4,
                                                    background: topic.teacher_checked ? '#EAF3EF' : '#F1F5F9',
                                                    color: topic.teacher_checked ? '#2D6E5D' : '#64748B',
                                                    whiteSpace: 'nowrap',
                                                  }}
                                                >
                                                  {topic.teacher_checked ? 'Taught in Class' : 'Upcoming'}
                                                </span>
                                              </div>
                                            ))}
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
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* VIEW 2: ATTENDANCE LOG */}
          {activeChild && activeTab === 'attendance' && (
            <div>
              <div className="panel-block">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <h3 className="section-title" style={{ margin: 0 }}>
                      Daily Roll Call Audit Log
                    </h3>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                      Real-time morning register &amp; lesson logs recorded by class teachers for {activeChild.name}.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsApplyLeaveModalOpen(true)}
                    style={{
                      padding: '6px 12px',
                      background: '#2D2C2A',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    <Calendar size={13} />
                    <span>Submit Sick Note</span>
                  </button>
                </div>
                {recentAttendanceDates.length === 0 ? (
                  <div className="empty-state">No attendance records logged in the database yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {recentAttendanceDates.map((dateStr) => {
                      const status = (attendance[dateStr] || {})[activeChild.id] || 'not recorded';
                      const isPresent = status === 'present';
                      const isAuthAbsent = status === 'auth_absent';
                      const isUnauthAbsent = status === 'unauth_absent';

                      const badgeBg = isPresent ? '#EAF3EF' : isAuthAbsent ? '#FEF7EC' : isUnauthAbsent ? '#FDF1F0' : '#F1F5F9';
                      const badgeText = isPresent ? '#2D6E5D' : isAuthAbsent ? '#9E6C1B' : isUnauthAbsent ? '#A83B38' : '#64748B';
                      const badgeBorder = isPresent ? '#C7E4D8' : isAuthAbsent ? '#F5DEB3' : isUnauthAbsent ? '#F5C6CB' : '#CBD5E1';
                      const label = isPresent ? 'Present' : isAuthAbsent ? 'Authorized Leave' : isUnauthAbsent ? 'Unexcused Absence' : 'Not Recorded';

                      return (
                        <div
                          key={dateStr}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '12px 16px',
                            background: '#FFFFFF',
                            borderRadius: 8,
                            border: '1px solid var(--border-color)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 8,
                                background: badgeBg,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Calendar size={16} color={badgeText} />
                            </div>
                            <div>
                              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                                {new Date(dateStr).toLocaleDateString('en-US', {
                                  weekday: 'long',
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                Date Ref: {dateStr}
                              </div>
                            </div>
                          </div>

                          <span
                            style={{
                              padding: '4px 10px',
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: 700,
                              background: badgeBg,
                              color: badgeText,
                              border: `1px solid ${badgeBorder}`,
                            }}
                          >
                            {label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEW 3: CLASSROOM CIRCULARS */}
          {activeChild && activeTab === 'broadcasts' && (
            <div>
              {childBroadcasts.length === 0 ? (
                <div
                  style={{
                    padding: '48px 20px',
                    background: '#FFFFFF',
                    border: '1px solid var(--border-color)',
                    borderRadius: 10,
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      background: '#EAF3EF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 12,
                      color: '#2D6E5D',
                    }}
                  >
                    <Megaphone size={22} />
                  </div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--neutral-dark)' }}>
                    No Notices Posted Yet
                  </h3>
                  <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', maxWidth: 380, margin: '6px 0 0', lineHeight: 1.5 }}>
                    Class notices and school guidelines published for {activeChild.name}&apos;s grade will appear here.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {childBroadcasts.map((broadcast) => {
                    const isUrgent = broadcast.priority === 'urgent';
                    const isImportant = broadcast.priority === 'important';
                    const isPinned = !!broadcast.is_pinned;

                    let accentColor = '#2C6E6A';
                    if (isUrgent) accentColor = '#EF4444';
                    else if (isImportant) accentColor = '#3B82F6';
                    else if (isPinned) accentColor = '#F59E0B';

                    return (
                      <div
                        key={broadcast.id}
                        style={{
                          background: '#FFFFFF',
                          border: '1px solid var(--border-color)',
                          borderLeft: `4px solid ${accentColor}`,
                          borderRadius: 8,
                          padding: '16px 18px',
                          boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
                        }}
                      >
                        {/* Card Top Meta */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                            <div
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: '50%',
                                background: '#EAF3EF',
                                color: '#2D6E5D',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 13,
                                fontWeight: 800,
                                flexShrink: 0,
                              }}
                            >
                              <User size={16} />
                            </div>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                                  {broadcast.teacher_name || 'Faculty'}
                                </span>
                                <span
                                  style={{
                                    fontSize: 9.5,
                                    fontWeight: 700,
                                    padding: '1px 6px',
                                    borderRadius: 3,
                                    background: '#EAF3EF',
                                    color: '#2D6E5D',
                                    border: '1px solid #C7E4D8',
                                    textTransform: 'uppercase',
                                  }}
                                >
                                  Teacher Notice
                                </span>
                              </div>
                              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                {broadcast.created_at ? new Date(broadcast.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Recently'}
                              </span>
                            </div>
                          </div>

                          {/* Badges */}
                          <div style={{ display: 'flex', gap: 5 }}>
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
                          </div>
                        </div>

                        {/* Title */}
                        <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--neutral-dark)', margin: '0 0 8px' }}>
                          {broadcast.title}
                        </h4>

                        {/* Content */}
                        <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap', background: '#FAF9F6', padding: '12px 14px', borderRadius: 6, border: '1px solid #ECEAE5' }}>
                          {broadcast.content}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* VIEW 4: ACHIEVEMENTS & AWARDS */}
          {activeChild && activeTab === 'achievements' && (
            <div>
              {childAchievements.length === 0 ? (
                <div
                  style={{
                    padding: '48px 20px',
                    background: '#FFFFFF',
                    border: '1px solid var(--border-color)',
                    borderRadius: 10,
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      background: '#FEF7EC',
                      color: '#9E6C1B',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 12px',
                    }}
                  >
                    <Award size={22} />
                  </div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px', color: 'var(--neutral-dark)' }}>
                    No Achievements Recorded Yet
                  </h3>
                  <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', maxWidth: 360, margin: '0 auto' }}>
                    Academic prizes, Olympiad certificates, and honors earned by {activeChild.name} will appear here.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: 14 }}>
                  {childAchievements.map((ach) => (
                    <div
                      key={ach.id}
                      style={{
                        background: '#FFFFFF',
                        border: '1px solid var(--border-color)',
                        borderRadius: 8,
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 12,
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
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
                            }}
                          >
                            Distinction
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                            {ach.created_at ? new Date(ach.created_at).toLocaleDateString() : 'Awarded'}
                          </span>
                        </div>

                        <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px', color: 'var(--neutral-dark)' }}>
                          {ach.title}
                        </h4>
                        {ach.description && (
                          <p style={{ fontSize: 12, color: '#64748B', lineHeight: 1.45, margin: 0 }}>
                            {ach.description}
                          </p>
                        )}
                      </div>

                      {ach.file_name && (
                        <div style={{ display: 'flex', gap: 8, borderTop: '1px solid #F1F5F9', paddingTop: 10 }}>
                          <button
                            type="button"
                            onClick={() =>
                              openFileInNewTab({
                                fileName: ach.file_name || 'Certificate.pdf',
                                fileUrl: ach.file_url,
                                studentName: activeChild.name,
                                title: ach.title,
                                description: ach.description,
                                submissionDate: ach.created_at ? new Date(ach.created_at).toLocaleDateString() : undefined,
                              })
                            }
                            style={{
                              flex: 1,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 5,
                              padding: '6px 10px',
                              borderRadius: 6,
                              fontSize: 11.5,
                              fontWeight: 700,
                              background: '#EAF3EF',
                              color: '#2D6E5D',
                              border: '1px solid #C7E4D8',
                              cursor: 'pointer',
                            }}
                          >
                            <span>↗ View Certificate</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              downloadFile({
                                fileName: ach.file_name || 'Certificate.pdf',
                                fileUrl: ach.file_url,
                                studentName: activeChild.name,
                                title: ach.title,
                                description: ach.description,
                                submissionDate: ach.created_at ? new Date(ach.created_at).toLocaleDateString() : undefined,
                              })
                            }
                            style={{
                              padding: '6px 10px',
                              borderRadius: 6,
                              fontSize: 11.5,
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
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* VIEW 5: CLEARANCE DOCUMENTS */}
          {activeChild && activeTab === 'documents' && (
            <div>
              <div className="doc-grid">
                {REQUIRED_DOC_TYPES.map((docDef) => {
                  const existing = childDocuments.find((d) => d.doc_type === docDef.type);
                  const isSubmitted = existing && existing.status === 'submitted';
                  const fileName = existing?.file_name || '';

                  return (
                    <div
                      className={`doc-card ${isSubmitted ? 'status-submitted' : 'status-pending'}`}
                      key={docDef.type}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div className="doc-card-icon">{getIcon(docDef.iconKey)}</div>
                        <span
                          className={`badge ${isSubmitted ? 'badge-submitted' : 'badge-pending'}`}
                          style={{ margin: 0 }}
                        >
                          {isSubmitted ? 'Submitted' : 'Pending'}
                        </span>
                      </div>
                      <div>
                        <div className="doc-card-title">{docDef.type}</div>
                        <div className="doc-card-subtitle">{docDef.desc}</div>
                      </div>
                      {isSubmitted ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div
                            className="doc-filename"
                            title={fileName}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          >
                            {getIcon('attachment')} {formatShortFileName(fileName)}
                          </div>
                          <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                            <button
                              type="button"
                              onClick={() => {
                                openFileInNewTab({
                                  fileName,
                                  fileUrl: existing?.file_url,
                                  studentName: activeChild.name,
                                  title: docDef.type,
                                });
                              }}
                              style={{
                                flex: 1,
                                padding: '5px 10px',
                                fontSize: 11.5,
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
                              className="action-btn"
                              style={{ fontSize: 11.5, padding: '5px 10px' }}
                              onClick={() => onRemoveDoc(docDef.type, activeChild.id)}
                            >
                              Replace
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label className="doc-upload-area">
                          Click to upload file
                          <br />
                          <span style={{ fontSize: 11 }}>PDF, JPG, PNG accepted</span>
                          <input
                            type="file"
                            className="doc-file-input"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => handleFileInputChange(docDef.type, e)}
                          />
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW 6: HOLISTIC HUB */}
          {activeTab === 'hub' && (
            <div>
              <div className="hub-grid">
                {hubActivities.length === 0 ? (
                  <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                    No school activities published yet.
                  </div>
                ) : (
                  childHubActivities.map((act) => {
                    const isEnrolled =
                      activeChild && (act.enrolled_student_ids || []).includes(activeChild.id);

                    return (
                      <div className={`hub-card ${isEnrolled ? 'enrolled' : ''}`} key={act.id}>
                        <div className="hub-card-media">
                          <img
                            src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=80"
                            alt={act.title}
                          />
                          {act.video_url && (
                            <div className="video-play-overlay" onClick={() => onOpenVideoModal(act)}>
                              <div className="play-btn-circle">{getIcon('video_play')}</div>
                            </div>
                          )}
                        </div>
                        <div className="hub-card-body">
                          <div className="hub-card-meta">
                            <span className="badge badge-hub" style={{ margin: 0 }}>
                              {act.type}
                            </span>
                            {isEnrolled && (
                              <span className="badge badge-hub-enrolled" style={{ margin: 0 }}>
                                Child Registered
                              </span>
                            )}
                          </div>
                          <div className="hub-card-title">{act.title}</div>
                          <div className="hub-card-desc">{act.description}</div>
                          <div className="hub-card-meta">
                            <span className="hub-card-date">
                              {getIcon('date')} {act.date}
                            </span>
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                              Grades: {(act.target_grades || []).join(', ')}
                            </span>
                          </div>
                        </div>
                        <div className="hub-card-footer">
                          <span className="hub-card-enroll-count">
                            {(act.enrolled_student_ids || []).length} students registered
                          </span>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: isEnrolled ? 'var(--doc-submitted)' : 'var(--text-secondary)',
                            }}
                          >
                            {isEnrolled ? 'Enrolled' : 'Not enrolled'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* VIEW 7: SETTINGS */}
          {activeTab === 'settings' && currentUser && (
            <SettingsView currentUser={currentUser} onRefreshData={onRefreshData} onUpdateCurrentUser={onUpdateCurrentUser} />
          )}

          {/* VIEW 8: SUPPORT */}
          {activeTab === 'support' && currentUser && (
            <SupportView currentUser={currentUser} />
          )}
        </div>
      </main>

      {/* MODALS */}
      {currentUser && (
        <RequestChildLinkModal
          isOpen={isRequestLinkModalOpen}
          currentUser={currentUser}
          students={allStudentProfiles}
          onClose={() => setIsRequestLinkModalOpen(false)}
          onSubmit={onRequestChildLink}
        />
      )}

      {activeChild && (
        <ApplyLeaveModal
          isOpen={isApplyLeaveModalOpen}
          studentName={activeChild.name}
          studentGrade={`Grade ${activeChild.grade?.replace(/[^0-9]/g, '') || '12'}`}
          onClose={() => setIsApplyLeaveModalOpen(false)}
          onSubmit={handleApplyLeaveSubmit}
        />
      )}
    </div>
  );
};
