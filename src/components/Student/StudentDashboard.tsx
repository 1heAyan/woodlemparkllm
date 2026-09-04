'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Award, Calendar, Settings, LifeBuoy, BookOpen, LogOut, MessageSquare, Megaphone, Pin, PinOff, SlidersHorizontal, Check, FileText, Video, Link2, FolderOpen, User, Trash2, Edit3, Paperclip, Plus, Menu, X, ChevronDown, Sparkles } from 'lucide-react';
import { WoodlemLogo, WoodlemEmblemSVG } from '@/components/Shared/WoodlemLogo';
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
  LeaveRequest,
  supabase,
} from '@/lib/supabaseClient';
import { SubmitAssignmentModal } from '../Modals/SubmitAssignmentModal';
import { ExamPortalView } from './ExamPortalView';
import { EditAchievementModal } from '../Modals/EditAchievementModal';
import { triggerConfetti, showCelebrationToast } from '@/lib/confetti';
import { CustomSelect } from '@/components/UI/CustomSelect';
import { SegmentedControl } from '@/components/UI/SegmentedControl';
import { TestResultRecord } from '../Modals/ReviewTestResultsModal';
import { AssignmentSubmissionRecord } from '../Modals/GradeAssignmentModal';
import { ViewFileModal } from '../Modals/ViewFileModal';
import { SettingsView } from '@/components/Shared/SettingsView';
import { SupportView } from '@/components/Shared/SupportView';
import { usePortalNavigation } from '@/lib/PortalNavigationContext';
import { openFileInNewTab, downloadFile, formatShortFileName } from '@/lib/fileHelper';
import { sanitizeUserCode } from '@/lib/userCodeHelper';
import { ApplyLeaveModal } from '../Modals/ApplyLeaveModal';

interface StudentDashboardProps {
  currentStudent: UserProfile;
  tests: TestItem[];
  assignments: AssignmentItem[];
  syllabus: SyllabusTerm[];
  achievements: Achievement[];
  leaveRequests?: LeaveRequest[];
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
    id?: string;
    startDate: string;
    endDate: string;
    reason: string;
    leaveType: string;
    fileName?: string;
    fileUrl?: string;
  }) => void;
  onDeleteLeave?: (leaveId: string) => void;
  onUpdateCurrentUser?: (user: UserProfile) => void;
  onRefreshData?: () => void;
  onSignOut: () => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  currentStudent,
  tests,
  assignments,
  syllabus,
  achievements,
  leaveRequests = [],
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
  onDeleteLeave,
  onUpdateCurrentUser,
  onRefreshData,
  onSignOut,
}) => {
  // Navigation mode: 'class' | 'homeroom_circulars' | 'awards' | 'attendance' | 'hub' | 'settings' | 'support'
  const [activeNavType, setActiveNavType] = useState<'class' | 'homeroom_circulars' | 'awards' | 'attendance' | 'hub' | 'settings' | 'support'>('class');
  
  // Tabs inside a subject classroom: 'broadcasts' | 'resources' | 'tasks' | 'syllabus'
  const [classSubTab, setClassSubTab] = useState<'broadcasts' | 'resources' | 'tasks' | 'marks' | 'syllabus'>('broadcasts');
  const [releasedMarks, setReleasedMarks] = useState<any[]>([]);
  
  const [hubFilter, setHubFilter] = useState('');
  const [selectedHubActivity, setSelectedHubActivity] = useState<HubActivity | null>(null);

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
  const [editingLeave, setEditingLeave] = useState<LeaveRequest | null>(null);
  const [attendanceSubTab, setAttendanceSubTab] = useState<'audit' | 'leaves'>('audit');
  // Personalized Sidebar State Controller
  const sidebar = useSidebarState(currentStudent?.id || currentStudent?.email || 'student');

  // Mobile Navigation & Drawer State
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isMobileClassPickerOpen, setIsMobileClassPickerOpen] = useState(false);

  // Sidebar profile photo (synced with Supabase cloud & local cache)
  const [sidebarAvatarUrl, setSidebarAvatarUrl] = useState<string | null>(() => {
    if (currentStudent.avatar_url) return currentStudent.avatar_url;
    if (typeof window !== 'undefined') {
      const email = (currentStudent.email || '').toLowerCase().trim();
      return (
        localStorage.getItem(`woodlem_avatar_${email}`) ||
        localStorage.getItem(`woodlem_avatar_${currentStudent.id}`) ||
        null
      );
    }
    return null;
  });

  useEffect(() => {
    if (currentStudent.avatar_url) {
      setSidebarAvatarUrl(currentStudent.avatar_url);
    }
  }, [currentStudent.avatar_url]);

  useEffect(() => {
    const handleAvatarUpdate = (e: any) => {
      const detail = e.detail;
      if (!detail) return;
      const { avatarUrl, userId, email } = detail;
      if (
        (userId && currentStudent.id === userId) ||
        (email && currentStudent.email?.toLowerCase() === email.toLowerCase())
      ) {
        setSidebarAvatarUrl(avatarUrl || null);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('woodlem-avatar-updated', handleAvatarUpdate);
      return () => window.removeEventListener('woodlem-avatar-updated', handleAvatarUpdate);
    }
  }, [currentStudent.id, currentStudent.email]);

  useEffect(() => {
    const fetchReleasedMarks = () => {
      supabase.from('offline_assessment_marks')
        .select('marks, teacher_note, offline_assessments(title, assessment_date, maximum_marks, class_id)')
        .eq('student_id', currentStudent.id)
        .eq('is_visible_to_student', true)
        .then(({ data }) => setReleasedMarks(data || []));
    };

    fetchReleasedMarks();

    if (typeof window !== 'undefined') {
      window.addEventListener('woodlem-marks-updated', fetchReleasedMarks);
      return () => window.removeEventListener('woodlem-marks-updated', fetchReleasedMarks);
    }
  }, [currentStudent.id]);

  // Homeroom circulars search & filter state
  const [hrSearchQuery, setHrSearchQuery] = useState('');
  const [hrPriorityFilter, setHrPriorityFilter] = useState<'all' | 'pinned' | 'urgent' | 'important'>('all');

  // Student class metadata
  const cleanGrade = useMemo(() => (currentStudent.grade || '10').replace(/[^0-9]/g, '') || '10', [currentStudent.grade]);
  const cleanSection = useMemo(() => (currentStudent.class_letter || 'A').toUpperCase().trim() || 'A', [currentStudent.class_letter]);
  const studentClass = `${cleanGrade}-${cleanSection}`;
  const studentAdmNo = useMemo(() => sanitizeUserCode(currentStudent.admission_number || currentStudent.user_code, currentStudent.email) || currentStudent.id.slice(0, 4).toUpperCase(), [currentStudent]);

  // Dynamic Subject Classrooms this student is enrolled in
  const myClasses = useMemo(() => {
    return subjectClasses.filter((c) => {
      // Skip any seed/demo classes
      if (c.id.startsWith('class-seed-') || c.name === 'Physics 12-C' || c.name === 'Chemistry 12-C') {
        return false;
      }
      const enrolled = c.enrolled_student_ids || [];

      // Primary check: student explicitly enrolled by ID or email
      if (
        enrolled.includes(currentStudent.id) ||
        (currentStudent.email && enrolled.includes(currentStudent.email))
      ) {
        return true;
      }

      // Fallback for legacy/existing classes with empty enrolled_student_ids:
      // STRICT match — both grade number AND class letter must match exactly.
      // This handles classes created before auto-enrollment was implemented.
      if (enrolled.length === 0 && c.class_name) {
        const cn = c.class_name.toLowerCase().replace(/grade\s*/gi, '').trim();
        const cnParts = cn.split(/[-\s]+/);
        const cnGrade = cnParts.find((p) => /^\d+$/.test(p)) || '';
        const cnLetter = cnParts.find((p) => /^[a-z]$/.test(p))?.toUpperCase() || '';
        const matchesGrade = cnGrade === cleanGrade;
        const matchesLetter = !cnLetter || cnLetter === cleanSection;
        return matchesGrade && matchesLetter;
      }

      return false;
    });
  }, [subjectClasses, currentStudent.id, currentStudent.email, cleanGrade, cleanSection]);

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
      if (target.view === 'awards' || target.view === 'achievements') {
        setActiveNavType('awards');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (target.view === 'attendance') {
        setActiveNavType('attendance');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (target.view === 'hub' || target.view === 'activities') {
        setActiveNavType('hub');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (target.view === 'settings' || target.view === 'password') {
        setActiveNavType('settings');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (target.view === 'support' || target.view === 'helpdesk') {
        setActiveNavType('support');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (
        target.view === 'class' ||
        target.view === 'tasks' ||
        target.view === 'assessments' ||
        target.view === 'resources' ||
        target.view === 'syllabus' ||
        target.view === 'broadcasts' ||
        target.subTab
      ) {
        setActiveNavType('class');
        if (target.classId && myClasses.some((c) => c.id === target.classId)) {
          setSelectedClassId(target.classId);
        } else if (target.className) {
          const targetNameLower = target.className.toLowerCase();
          const matched = myClasses.find(
            (c) =>
              c.name.toLowerCase().includes(targetNameLower) ||
              (c.subject && targetNameLower.includes(c.subject.toLowerCase()))
          );
          if (matched) setSelectedClassId(matched.id);
          else if (myClasses.length > 0 && !selectedClassId) setSelectedClassId(myClasses[0].id);
        } else if (myClasses.length > 0 && (!selectedClassId || !myClasses.some((c) => c.id === selectedClassId))) {
          setSelectedClassId(myClasses[0].id);
        }

        const rawSub =
          target.subTab ||
          (target.view === 'tasks' || target.view === 'assessments'
            ? 'tasks'
            : target.view === 'resources'
            ? 'resources'
            : target.view === 'syllabus'
            ? 'syllabus'
            : target.view === 'broadcasts'
            ? 'broadcasts'
            : 'tasks');

        const sub = rawSub === 'assessments' ? 'tasks' : rawSub;
        if (sub && ['broadcasts', 'resources', 'tasks', 'syllabus', 'marks'].includes(sub)) {
          setClassSubTab(sub as any);
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
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

  // Helper: check if a test/assignment belongs strictly to the currently viewed subject class
  const isItemForActiveClass = (itemClassName?: string, itemTitle?: string, itemTeacherId?: string) => {
    if (!activeClassObj || !itemClassName) return false;

    // ── PRIMARY ISOLATION GATE: if teacher_id is stamped on the item, it MUST match
    // the teacher who owns this subject class. This prevents cross-teacher data leakage.
    if (itemTeacherId && activeClassObj.teacher_id) {
      if (itemTeacherId !== activeClassObj.teacher_id) return false;
    }

    const itemCn = itemClassName.toLowerCase().trim();
    const className = activeClassObj.name.toLowerCase().trim();
    const subjectName = (activeClassObj.subject || '').toLowerCase().trim();
    const gradeSection = (activeClassObj.class_name || '').toLowerCase().replace(/grade\s*/gi, '').trim();

    // 1. Exact string match (e.g. "Biology (12-B)" or "Physics 12-C")
    if (itemCn === className || itemCn === `${className} (${gradeSection})` || itemCn === `${className} ${gradeSection}`) {
      return true;
    }

    // 2. Check if the item explicitly mentions the subject/class title
    const mentionsSubject =
      (subjectName && itemCn.includes(subjectName)) ||
      itemCn.includes(className) ||
      (subjectName && itemTitle && itemTitle.toLowerCase().includes(subjectName));

    if (mentionsSubject) {
      // If a grade/section is specified on both, ensure they match
      if (gradeSection) {
        const itemGradeNum = itemCn.replace(/[^0-9]/g, '');
        const classGradeNum = gradeSection.replace(/[^0-9]/g, '');
        if (itemGradeNum && classGradeNum && itemGradeNum !== classGradeNum) return false;
      }
      return true;
    }

    return false;
  };

  // Filter tests and assignments for the active subject class ONLY
  const myTests = useMemo(() => {
    if (!activeClassObj) return [];
    const classGradeSec = (activeClassObj.class_name || '').toLowerCase().replace(/grade\s*/gi, '').trim();
    const studentGrade = (currentStudent?.grade || '').replace(/[^0-9]/g, '');
    const studentSec = (currentStudent?.class_letter || '').toLowerCase().trim();
    const studentKey = `${studentGrade}-${studentSec}`;

    return tests.filter((t) => {
      // Hide drafts from students
      if (t.status === 'draft') return false;

      // Check target_sections array
      if (t.target_sections && t.target_sections.length > 0) {
        const matchesSec = t.target_sections.some((sec) => {
          const cleanSec = sec.toLowerCase().replace(/grade\s*/gi, '').trim();
          return cleanSec === classGradeSec || cleanSec === studentKey || cleanSec === studentSec;
        });
        if (matchesSec) return true;
      }

      return isItemForActiveClass(t.class_name, t.title, t.teacher_id);
    });
  }, [tests, activeClassObj, currentStudent]);

  const myAssignments = useMemo(() => {
    if (!activeClassObj) return [];
    return assignments.filter((a) => isItemForActiveClass(a.class_name, a.title));
  }, [assignments, activeClassObj]);

  // Syllabus progress for active class ONLY (does not leak terms from other subjects)
  const subjectSyllabus = useMemo(() => {
    if (!activeClassObj) return [];
    const className = activeClassObj.name.toLowerCase().trim();
    const subjectName = (activeClassObj.subject || '').toLowerCase().trim();
    const gradeSection = (activeClassObj.class_name || '').toLowerCase().replace(/grade\s*/gi, '').trim();

    return syllabus.filter((term) => {
      // 1. Direct class_id link
      if (term.class_id && term.class_id === activeClassObj.id) return true;

      // 2. Term subject matches class subject or class name
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

      // 3. Term name contains subject name or class name explicitly
      const tName = term.name.toLowerCase();
      if (subjectName && tName.includes(subjectName)) return true;
      if (className && tName.includes(className)) return true;

      // Untagged terms from other subjects (like CS PT-1) do NOT leak into Biology
      return false;
    });
  }, [syllabus, activeClassObj]);

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

  // Filter hub – only show activities that target this student's class/grade
  const filteredHub = useMemo(() => {
    const rawGrade = String(currentStudent.grade || '').trim();
    const letterStr = String(currentStudent.class_letter || '').trim().toUpperCase();
    // Extract just the number e.g. "Grade 12 (CBSE)" → "12", "12" → "12"
    const gradeNum = rawGrade.match(/\d+/)?.[0] || '';
    // e.g. "12-C"
    const fullClass = gradeNum && letterStr ? `${gradeNum}-${letterStr}` : gradeNum;

    const relevantActivities = hubActivities
      .filter((act) => !String(act.title || '').startsWith('__') && act.type !== 'system_config' && act.id !== 'special_roles_master_v1')
      .filter((act) => {
        const targets: string[] = act.target_grades || [];
        // No restrictions → visible to all
        if (targets.length === 0) return true;
        return targets.some((t) => {
          // Normalise: lowercase, strip spaces, strip "Grade" prefix
          const norm = t.toLowerCase().replace(/\s+/g, '').replace(/^grade/, '');
          // match full class "12-c" or just grade number "12"
          return (fullClass && norm === fullClass.toLowerCase()) || (gradeNum && norm === gradeNum);
        });
      });

    if (!hubFilter) return relevantActivities;
    return relevantActivities.filter((a) => a.type === hubFilter);
  }, [hubActivities, hubFilter, currentStudent.grade, currentStudent.class_letter]);

  // Filter achievements
  const myAchievements = useMemo(() => {
    return achievements.filter(
      (a) =>
        (a.student_id === currentStudent.id || (currentStudent.email && a.student_id === currentStudent.email)) &&
        a.title !== '__USER_AVATAR__' &&
        a.title !== '__PARENT_DOC__' &&
        a.title !== '__LEAVE_REQUEST__' &&
        a.title !== '__GRADE_ASSESSMENT_TERM__' &&
        !String(a.title || '').startsWith('__')
    );
  }, [achievements, currentStudent.id, currentStudent.email]);

  // Extract student's leave requests
  const myLeaves = useMemo(() => {
    if (leaveRequests && leaveRequests.length > 0) {
      return leaveRequests
        .filter(
          (l) => l.student_id === currentStudent.id || (currentStudent.email && l.student_id === currentStudent.email)
        )
        .sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime());
    }
    return achievements
      .filter(
        (a) =>
          (a.student_id === currentStudent.id || (currentStudent.email && a.student_id === currentStudent.email)) &&
          a.title === '__LEAVE_REQUEST__'
      )
      .map((a) => {
        let details: any = {};
        try {
          details = JSON.parse(a.description);
        } catch {
          details = { reason: a.description };
        }
        return {
          id: a.id,
          student_id: a.student_id,
          startDate: details.startDate || '',
          endDate: details.endDate || details.startDate || '',
          leaveType: details.leaveType || 'Authorized Leave',
          reason: details.reason || '',
          fileName: a.file_name || details.fileName || '',
          fileUrl: a.file_url || details.fileUrl || '',
          created_at: a.created_at || details.appliedAt || '',
          status: details.status || 'submitted',
        };
      })
      .sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime());
  }, [leaveRequests, achievements, currentStudent.id, currentStudent.email]);

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
    id?: string;
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
    setEditingLeave(null);
    setIsApplyLeaveOpen(false);
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
              <span style={{ fontSize: 8.5, fontWeight: 700, color: '#2C6E6A', letterSpacing: '0.06em' }}>
                STUDENT
              </span>
            </div>
          </div>
        </div>

        <div className="mobile-top-bar-actions">
          {/* Active Context Switcher */}
          {activeNavType === 'class' && activeClassObj ? (
            <button
              type="button"
              onClick={() => setIsMobileClassPickerOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 11px',
                borderRadius: 20,
                background: '#EAF3EF',
                border: '1px solid #C7E4D8',
                color: '#2D6E5D',
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer',
                maxWidth: 145,
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeClassObj.subject || activeClassObj.name}
              </span>
              <ChevronDown size={13} style={{ flexShrink: 0 }} />
            </button>
          ) : (
            <span
              style={{
                padding: '4px 10px',
                borderRadius: 14,
                background: '#EAF3EF',
                color: '#2D6E5D',
                border: '1px solid #C7E4D8',
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'capitalize',
              }}
            >
              {activeNavType === 'homeroom_circulars'
                ? 'Circulars'
                : activeNavType === 'awards'
                ? 'Achievements'
                : activeNavType === 'attendance'
                ? 'Attendance'
                : activeNavType === 'hub'
                ? 'Co-Curricular'
                : activeNavType}
            </span>
          )}

          {/* User Profile Avatar / Settings Button */}
          <button
            type="button"
            className="mobile-icon-btn"
            onClick={() => setActiveNavType('settings')}
            aria-label="Profile Settings"
            style={{ width: 34, height: 34, padding: 0 }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: '#2C6E6A',
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
                  alt={currentStudent.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                (currentStudent.name || 'S').charAt(0).toUpperCase()
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
            {/* Drawer Header */}
            <div className="mobile-drawer-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <WoodlemEmblemSVG size={28} />
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--neutral-dark)', letterSpacing: '-0.02em' }}>
                    WOODLEM PARK
                  </span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#2C6E6A', letterSpacing: '0.04em' }}>
                    STUDENT PORTAL
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

            {/* Student Profile Card */}
            <div className="mobile-drawer-profile">
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: '#EAF3EF',
                  border: '1px solid #C7E4D8',
                  color: '#2D6E5D',
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
                    alt={currentStudent.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  (currentStudent.name || 'S').charAt(0).toUpperCase()
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--neutral-dark)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {currentStudent.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  Class {cleanGrade}-{cleanSection} • {studentAdmNo}
                </div>
              </div>
            </div>

            {/* Navigation Options */}
            <div className="mobile-drawer-body">
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', padding: '6px 8px', letterSpacing: '0.04em' }}>
                Subject Classrooms ({myClasses.length})
              </div>
              {myClasses.map((cls) => {
                const isSelected = activeNavType === 'class' && selectedClassId === cls.id;
                return (
                  <button
                    key={cls.id}
                    type="button"
                    className={`mobile-drawer-item ${isSelected ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedClassId(cls.id);
                      setActiveNavType('class');
                      setIsMobileDrawerOpen(false);
                    }}
                  >
                    <BookOpen size={16} style={{ color: isSelected ? '#FFFFFF' : '#2C6E6A', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {cls.name}
                      </div>
                      <div style={{ fontSize: 10.5, opacity: 0.75, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {cls.teacher_name}
                      </div>
                    </div>
                  </button>
                );
              })}

              <div style={{ height: 1, background: 'var(--border-color)', margin: '8px 0' }} />

              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', padding: '6px 8px', letterSpacing: '0.04em' }}>
                Portals & Modules
              </div>
              <button
                type="button"
                className={`mobile-drawer-item ${activeNavType === 'homeroom_circulars' ? 'active' : ''}`}
                onClick={() => {
                  setActiveNavType('homeroom_circulars');
                  setIsMobileDrawerOpen(false);
                }}
              >
                <Megaphone size={16} style={{ color: activeNavType === 'homeroom_circulars' ? '#FFFFFF' : '#D97706', flexShrink: 0 }} />
                <span>Class Circulars</span>
              </button>

              <button
                type="button"
                className={`mobile-drawer-item ${activeNavType === 'awards' ? 'active' : ''}`}
                onClick={() => {
                  setActiveNavType('awards');
                  setIsMobileDrawerOpen(false);
                }}
              >
                <Award size={16} style={{ color: activeNavType === 'awards' ? '#FFFFFF' : '#2D6E5D', flexShrink: 0 }} />
                <span>My Achievements</span>
              </button>

              <button
                type="button"
                className={`mobile-drawer-item ${activeNavType === 'attendance' ? 'active' : ''}`}
                onClick={() => {
                  setActiveNavType('attendance');
                  setIsMobileDrawerOpen(false);
                }}
              >
                <Calendar size={16} style={{ color: activeNavType === 'attendance' ? '#FFFFFF' : '#2C6E6A', flexShrink: 0 }} />
                <span>Attendance Record</span>
              </button>

              <button
                type="button"
                className={`mobile-drawer-item ${activeNavType === 'hub' ? 'active' : ''}`}
                onClick={() => {
                  setActiveNavType('hub');
                  setIsMobileDrawerOpen(false);
                }}
              >
                <Award size={16} style={{ color: activeNavType === 'hub' ? '#FFFFFF' : '#7C5CBF', flexShrink: 0 }} />
                <span>Holistic Hub</span>
              </button>
            </div>

            {/* Drawer Footer */}
            <div className="mobile-drawer-footer">
              <button
                type="button"
                className={`mobile-drawer-item ${activeNavType === 'settings' ? 'active' : ''}`}
                onClick={() => {
                  setActiveNavType('settings');
                  setIsMobileDrawerOpen(false);
                }}
              >
                <Settings size={16} />
                <span>Settings &amp; Passwords</span>
              </button>
              <button
                type="button"
                className={`mobile-drawer-item ${activeNavType === 'support' ? 'active' : ''}`}
                onClick={() => {
                  setActiveNavType('support');
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

      {/* MOBILE QUICK SUBJECT CLASS PICKER SHEET */}
      {isMobileClassPickerOpen && (
        <div
          className="mobile-sheet-overlay"
          onClick={() => setIsMobileClassPickerOpen(false)}
        >
          <div
            className="mobile-sheet-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mobile-sheet-handle" />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--neutral-dark)' }}>
                Select Subject Classroom
              </h3>
              <button
                type="button"
                onClick={() => setIsMobileClassPickerOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {myClasses.map((cls) => {
                const isSelected = activeNavType === 'class' && selectedClassId === cls.id;
                return (
                  <button
                    key={cls.id}
                    type="button"
                    onClick={() => {
                      setSelectedClassId(cls.id);
                      setActiveNavType('class');
                      setIsMobileClassPickerOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: 10,
                      border: isSelected ? '2px solid #2C6E6A' : '1px solid var(--border-color)',
                      background: isSelected ? '#EAF3EF' : '#FAF9F6',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.12s ease',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: isSelected ? '#1C4D46' : 'var(--neutral-dark)' }}>
                        {cls.name}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {cls.teacher_name} • Grade {cleanGrade}-{cleanSection}
                      </div>
                    </div>
                    {isSelected && <Check size={18} color="#2C6E6A" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

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
            Student Learning Portal
          </div>
        )}

        {/* PROFILE CARD */}
        {sidebar.isCollapsed ? (
          <div style={{ padding: '12px 0 6px', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
            <div
              title={`${currentStudent.name} • Class ${cleanGrade} - Section ${cleanSection} • Admission No. ${studentAdmNo}`}
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: '#2C6E6A',
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
                  alt={currentStudent.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                (currentStudent.name || 'S').charAt(0).toUpperCase()
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
                background: '#2C6E6A',
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
                  alt={currentStudent.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                (currentStudent.name || 'S').charAt(0).toUpperCase()
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.25 }}>
                {currentStudent.name}
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
                  Class {cleanGrade} • Section {cleanSection}
                </span>
              </div>
              <div style={{ fontSize: 10.5, color: '#7A7873', fontWeight: 600, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Admission No. {studentAdmNo}
              </div>
            </div>
          </div>
        )}

        {/* NAVIGATION MENU */}
        <nav className="nav-menu">
          {/* CLASS CIRCULARS */}
          <div className="sidebar-tooltip-wrapper">
            <button
              className={`nav-item ${activeNavType === 'homeroom_circulars' ? 'active' : ''}`}
              onClick={() => { setActiveNavType('homeroom_circulars'); sidebar.handleNavClick(); }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                <Megaphone size={15} className="icon" style={{ color: activeNavType === 'homeroom_circulars' ? '#FFFFFF' : 'var(--text-secondary)', flexShrink: 0 }} />
                <span className="sidebar-text" style={{ flex: 1, color: activeNavType === 'homeroom_circulars' ? '#FFFFFF' : 'inherit' }}>Class Circulars</span>
              </div>
            </button>
            {sidebar.isCollapsed && <div className="sidebar-tooltip">Class Circulars</div>}
          </div>

          {/* MY ACHIEVEMENTS */}
          <div className="sidebar-tooltip-wrapper">
            <button
              className={`nav-item ${activeNavType === 'awards' ? 'active' : ''}`}
              onClick={() => { setActiveNavType('awards'); sidebar.handleNavClick(); }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                <Award size={15} className="icon" style={{ color: activeNavType === 'awards' ? '#FFFFFF' : 'var(--text-secondary)', flexShrink: 0 }} />
                <span className="sidebar-text" style={{ flex: 1, color: activeNavType === 'awards' ? '#FFFFFF' : 'inherit' }}>My Achievements</span>
              </div>
            </button>
            {sidebar.isCollapsed && <div className="sidebar-tooltip">My Achievements</div>}
          </div>

          {/* ATTENDANCE RECORD */}
          <div className="sidebar-tooltip-wrapper">
            <button
              className={`nav-item ${activeNavType === 'attendance' ? 'active' : ''}`}
              onClick={() => { setActiveNavType('attendance'); sidebar.handleNavClick(); }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                <Calendar size={15} className="icon" style={{ color: activeNavType === 'attendance' ? '#FFFFFF' : 'var(--text-secondary)', flexShrink: 0 }} />
                <span className="sidebar-text" style={{ color: activeNavType === 'attendance' ? '#FFFFFF' : 'inherit' }}>Attendance Record</span>
              </div>
            </button>
            {sidebar.isCollapsed && <div className="sidebar-tooltip">Attendance Record</div>}
          </div>

          {/* HOLISTIC HUB */}
          <div className="sidebar-tooltip-wrapper">
            <button
              className={`nav-item ${activeNavType === 'hub' ? 'active' : ''}`}
              onClick={() => { setActiveNavType('hub'); sidebar.handleNavClick(); }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                <Award size={15} className="icon" style={{ color: activeNavType === 'hub' ? '#FFFFFF' : 'var(--text-secondary)', flexShrink: 0 }} />
                <span className="sidebar-text" style={{ color: activeNavType === 'hub' ? '#FFFFFF' : 'inherit' }}>Holistic Hub</span>
              </div>
            </button>
            {sidebar.isCollapsed && <div className="sidebar-tooltip">Holistic Hub</div>}
          </div>

          {/* SUBJECT CLASSROOMS divider + label */}
          <div className="sidebar-nav-divider" />
          <div className="nav-label">
            Classrooms ({myClasses.length})
          </div>

          {myClasses.length === 0 ? (
            <div className="sidebar-text" style={{ padding: '8px 8px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 11 }}>
              No classrooms enrolled yet.
            </div>
          ) : (
            myClasses.map((cls) => {
              const isSelected = activeNavType === 'class' && selectedClassId === cls.id;
              return (
                <div key={cls.id} className="sidebar-tooltip-wrapper">
                  <button
                    className={`nav-item ${isSelected ? 'active' : ''}`}
                    onClick={() => { setSelectedClassId(cls.id); setActiveNavType('class'); sidebar.handleNavClick(); }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                      <BookOpen size={15} className="icon" style={{ color: isSelected ? '#FFFFFF' : 'var(--text-secondary)', flexShrink: 0 }} />
                      <div className="sidebar-text" style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: isSelected ? 700 : 500, color: isSelected ? '#FFFFFF' : 'var(--neutral-dark)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 12.5 }}>
                          {cls.name}
                        </div>
                        <div className="sidebar-classroom-sub" style={{ color: isSelected ? 'rgba(255, 255, 255, 0.7)' : 'var(--text-secondary)' }}>
                          {cls.teacher_name}
                        </div>
                      </div>
                    </div>
                  </button>
                  {sidebar.isCollapsed && (
                    <div className="sidebar-tooltip">{cls.name} ({cls.teacher_name})</div>
                  )}
                </div>
              );
            })
          )}
        </nav>

        {/* SIDEBAR FOOTER — Settings, Support, Sign Out */}
        <div className="sidebar-footer" style={{ background: 'transparent' }}>
          {/* SETTINGS */}
          <div className="sidebar-tooltip-wrapper">
            <button
              className={`nav-item ${activeNavType === 'settings' ? 'active' : ''}`}
              onClick={() => { setActiveNavType('settings'); sidebar.handleNavClick(); }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                <Settings size={15} className="icon" style={{ flexShrink: 0 }} />
                <span className="sidebar-text">Settings</span>
              </div>
            </button>
            {sidebar.isCollapsed && <div className="sidebar-tooltip">Settings &amp; Passwords</div>}
          </div>

          {/* HELP & SUPPORT */}
          <div className="sidebar-tooltip-wrapper">
            <button
              className={`nav-item ${activeNavType === 'support' ? 'active' : ''}`}
              onClick={() => { setActiveNavType('support'); sidebar.handleNavClick(); }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                <LifeBuoy size={15} className="icon" style={{ flexShrink: 0 }} />
                <span className="sidebar-text">Help &amp; Support</span>
              </div>
            </button>
            {sidebar.isCollapsed && <div className="sidebar-tooltip">Help &amp; Support</div>}
          </div>

          {/* TOGGLE COLLAPSE */}
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

          {/* SIGN OUT */}
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
                  Class Tests
                  <span className="tab-count">{myTests.length + myAssignments.length}</span>
                </button>
                <button
                  className={`tab-btn ${classSubTab === 'marks' ? 'active' : ''}`}
                  onClick={() => setClassSubTab('marks')}
                >
                  My Marks
                  <span className="tab-count">{releasedMarks.filter((m: any) => m.offline_assessments?.class_id === activeClassObj?.id).length}</span>
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

            <div className="content-body">
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
                        placeholder="Search study notes, slides, formula sheets, or topics..."
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
                                {res.file_name && <span title={res.file_name}>{formatShortFileName(res.file_name)}</span>}
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
                  )}
                </div>
              )}

              {/* SUBTAB 3: ASSESSMENTS & HOMEWORK */}
              {classSubTab === 'tasks' && (
                <div>
                  <h3 className="section-title" style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
                    Active Class Tests for {activeClassObj ? activeClassObj.name : 'Class'}
                  </h3>
                  <div className="card-list" style={{ marginBottom: 28 }}>
                    {myTests.length === 0 ? (
                      <div className="panel-block" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                        No class tests currently scheduled for this subject class.
                      </div>
                    ) : (
                      myTests.map((test) => {
                        const result = testResults[`${test.id}_${currentStudent.id}`];
                        const isDone = !!result;
                        return (
                          <div className="item-card" key={test.id} style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div className="item-info">
                              <span className="badge badge-test" style={{ marginBottom: 4, fontSize: 9.5 }}>
                                Class Test · {test.class_name || (activeClassObj ? activeClassObj.name : studentClass)}
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
                                 Take Class Test
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
                                <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 4, background: '#EAF3EF', color: '#2D6E5D', border: '1px solid #C7E4D8' }} title={submission.file_name || ''}>
                                  {submission.grade ? `Graded: ${submission.grade}` : `Submitted: ${formatShortFileName(submission.file_name || 'Work.pdf')}`}
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

              {classSubTab === 'marks' && (
                <div>
                  <h3 className="section-title" style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Released Marks & Grades</h3>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>Only marks officially released by your teacher are shown here.</p>
                  <div className="card-list">
                    {releasedMarks.filter((m: any) => m.offline_assessments?.class_id === activeClassObj?.id).length === 0 ? (
                      <div className="panel-block" style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                        No marks have been released for this class yet.
                      </div>
                    ) : (
                      releasedMarks
                        .filter((m: any) => m.offline_assessments?.class_id === activeClassObj?.id)
                        .map((m: any, index) => {
                          const score = Number(m.marks);
                          const maxScore = Number(m.offline_assessments?.maximum_marks || 100);
                          const pct = (score / maxScore) * 100;
                          
                          let letter = 'F';
                          let letterColor = '#DC2626';
                          let letterBg = '#FEE2E2';
                          let statusText = 'Needs Attention';

                          if (pct >= 90) {
                            letter = 'A';
                            letterColor = '#2C6E6A';
                            letterBg = '#EAF3EF';
                            statusText = 'Excellent';
                          } else if (pct >= 80) {
                            letter = 'B';
                            letterColor = '#2C6E6A';
                            letterBg = '#EAF3EF';
                            statusText = 'Very Good';
                          } else if (pct >= 70) {
                            letter = 'C';
                            letterColor = '#B8860B';
                            letterBg = '#FEF3C7';
                            statusText = 'Satisfactory';
                          } else if (pct >= 50) {
                            letter = 'D';
                            letterColor = '#D97706';
                            letterBg = '#FFEDD5';
                            statusText = 'Pass';
                          }

                          return (
                            <div
                              className="item-card"
                              key={index}
                              style={{
                                padding: '16px 18px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                borderLeft: `4px solid ${letterColor}`,
                                background: 'linear-gradient(to right, #FFF, #FAFBFB)',
                              }}
                            >
                              <div>
                                <span
                                  className="badge badge-test"
                                  style={{
                                    marginBottom: 5,
                                    fontSize: 9.5,
                                    background: '#FAF1ED',
                                    color: '#8A532B',
                                    border: '1px solid #F5E8E2',
                                  }}
                                >
                                  In-school Assessment
                                </span>
                                <h4 style={{ fontSize: 14, margin: '0 0 3px', fontWeight: 700 }}>
                                  {m.offline_assessments?.title}
                                </h4>
                                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                  Date of Exam: {m.offline_assessments?.assessment_date && new Date(m.offline_assessments.assessment_date + 'T00:00:00').toLocaleDateString()}
                                </span>
                                {m.teacher_note && (
                                  <div
                                    style={{
                                      fontSize: 11,
                                      color: '#475569',
                                      marginTop: 6,
                                      padding: '4px 8px',
                                      background: '#F1F5F9',
                                      borderRadius: 4,
                                      display: 'inline-block',
                                    }}
                                  >
                                    <strong>Teacher Note:</strong> {m.teacher_note}
                                  </div>
                                )}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ fontSize: 18, fontWeight: 800, color: '#1C4D46' }}>
                                    {score}
                                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 400 }}>
                                      {' '}/ {maxScore}
                                    </span>
                                  </div>
                                  <span style={{ fontSize: 10, color: letterColor, fontWeight: 700, textTransform: 'uppercase' }}>
                                    {statusText}
                                  </span>
                                </div>
                                <div
                                  style={{
                                    width: 38,
                                    height: 38,
                                    borderRadius: '50%',
                                    background: letterBg,
                                    color: letterColor,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 800,
                                    fontSize: 15,
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                  }}
                                >
                                  {letter}
                                </div>
                              </div>
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

            <div className="content-body">
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
                  <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#FEF7EC', color: '#9E6C1B', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                      <Award size={22} />
                    </div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px', color: 'var(--neutral-dark)' }}>No Achievements Recorded Yet</h3>
                    <p style={{ fontSize: 12.5, maxWidth: 360, margin: '0 auto' }}>
                      Add your academic prizes, olympiad medals, and sports certificates.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Desktop Table View */}
                    <div className="hide-mobile" style={{ overflowX: 'auto', width: '100%' }}>
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

                    {/* Mobile Touch Cards View */}
                    <div className="hide-desktop" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12 }}>
                      {myAchievements.map((aw) => (
                        <div
                          key={aw.id}
                          style={{
                            background: '#FFFFFF',
                            border: '1px solid var(--border-color)',
                            borderRadius: 8,
                            padding: 14,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 10,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                            <div>
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
                              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                                {aw.title}
                              </h4>
                            </div>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button
                                onClick={() => setEditingAchievement(aw)}
                                style={{
                                  padding: '4px 8px',
                                  fontSize: 11,
                                  fontWeight: 600,
                                  background: '#FFFFFF',
                                  border: '1px solid var(--border-color)',
                                  borderRadius: 4,
                                  cursor: 'pointer',
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
                                  padding: '4px 8px',
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

                          {aw.description && (
                            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                              {aw.description}
                            </p>
                          )}

                          {aw.file_name && (
                            <div style={{ display: 'flex', gap: 8, borderTop: '1px solid #F1F5F9', paddingTop: 8 }}>
                              <button
                                type="button"
                                onClick={() =>
                                  openFileInNewTab({
                                    fileName: aw.file_name || 'Certificate.pdf',
                                    fileUrl: aw.file_url,
                                    studentName: currentStudent.name,
                                    title: aw.title,
                                    description: aw.description,
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
                                    fileName: aw.file_name || 'Certificate.pdf',
                                    fileUrl: aw.file_url,
                                    studentName: currentStudent.name,
                                    title: aw.title,
                                    description: aw.description,
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
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {/* VIEW 3: GLOBAL ATTENDANCE & LEAVE RECORD */}
        {activeNavType === 'attendance' && (
          <>
            <header className="content-header">
              <div className="header-top" style={{ alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#2C6E6A', letterSpacing: '0.06em' }}>
                    ACADEMIC RECORDS · GRADE {cleanGrade}-{cleanSection}
                  </div>
                  <h1 className="page-title" style={{ margin: '2px 0 0' }}>
                    Attendance &amp; Leave History
                  </h1>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => {
                      setEditingLeave(null);
                      setIsApplyLeaveOpen(true);
                    }}
                    style={{ padding: '7px 16px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <Plus size={14} />
                    <span>Apply for Leave / Sick Note</span>
                  </button>
                </div>
              </div>
            </header>

            <div className="content-body">
              <div className="parent-stats-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 20 }}>
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
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Permit Leaves (PL)</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#D97706', marginTop: 4 }}>
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

              {/* Subtabs: Attendance Audit vs Uploaded Leaves */}
              <div style={{ display: 'flex', marginBottom: 16, borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>
                <SegmentedControl
                  value={attendanceSubTab}
                  onChange={(tab) => setAttendanceSubTab(tab)}
                  options={[
                    {
                      value: 'audit',
                      label: 'Daily Attendance Log',
                      count: attendanceStats.history.length,
                    },
                    {
                      value: 'leaves',
                      label: 'My Uploaded Leaves & Sick Notes',
                      count: myLeaves.length,
                    },
                  ]}
                  height={34}
                  textTransform="none"
                />
              </div>

              {/* SUBTAB 1: AUDIT LOG */}
              {attendanceSubTab === 'audit' && (
                <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
                  {attendanceStats.history.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                      No attendance records logged for your profile yet.
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                      <thead>
                        <tr style={{ background: '#F8F7F4', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          <th style={{ textAlign: 'left', padding: '8px 16px', fontWeight: 700 }}>Date</th>
                          <th style={{ textAlign: 'right', padding: '8px 16px', fontWeight: 700 }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendanceStats.history.map((h, i) => (
                          <tr key={h.date} style={{ borderBottom: i < attendanceStats.history.length - 1 ? '1px solid #ECEAE5' : 'none', background: i % 2 === 0 ? '#FFFFFF' : '#FAFAF9' }}>
                            <td style={{ padding: '8px 16px', fontWeight: 600, color: 'var(--neutral-dark)' }}>{h.date}</td>
                            <td style={{ padding: '8px 16px', textAlign: 'right' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 9px',
                                  borderRadius: 4,
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  background: h.status === 'present' ? '#EAF3EF' : h.status === 'auth_absent' ? '#FEF3C7' : '#FDF1F0',
                                  color: h.status === 'present' ? '#2D6E5D' : h.status === 'auth_absent' ? '#92400E' : '#DC2626',
                                }}
                              >
                                {h.status === 'present' ? 'Present' : h.status === 'auth_absent' ? 'Permit Leave (PL)' : 'Absent'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}


              {/* SUBTAB 2: UPLOADED LEAVES & SICK NOTES */}
              {attendanceSubTab === 'leaves' && (
                <div>
                  {myLeaves.length === 0 ? (
                    <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 8, padding: '48px 24px', textAlign: 'center' }}>
                      <FileText size={32} style={{ color: 'var(--text-secondary)', margin: '0 auto 12px', display: 'block', opacity: 0.6 }} />
                      <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 6px', color: 'var(--neutral-dark)' }}>No Leaves or Medical Notes Uploaded</h3>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 420, margin: '0 auto 16px', lineHeight: 1.5 }}>
                        Pre-declare upcoming leaves, doctor appointments, or upload medical certificates for authorized absences.
                      </p>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => {
                          setEditingLeave(null);
                          setIsApplyLeaveOpen(true);
                        }}
                        style={{ padding: '8px 18px', fontSize: 12.5 }}
                      >
                        + Apply for Leave / Sick Note
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {myLeaves.map((leave) => (
                        <div
                          key={leave.id}
                          style={{
                            background: '#FFFFFF',
                            border: '1px solid var(--border-color)',
                            borderRadius: 8,
                            padding: '12px 16px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span
                                style={{
                                  background: '#EAF3EF',
                                  color: '#2D6E5D',
                                  fontWeight: 700,
                                  padding: '3px 9px',
                                  borderRadius: 6,
                                  fontSize: 11.5,
                                }}
                              >
                                {leave.leaveType}
                              </span>
                              {leave.status === 'approved' ? (
                                <span
                                  style={{
                                    background: '#EAF3EF',
                                    color: '#2D6E5D',
                                    fontWeight: 700,
                                    padding: '3px 8px',
                                    borderRadius: 6,
                                    fontSize: 10.5,
                                    textTransform: 'uppercase',
                                  }}
                                >
                                  ✓ Approved (Permit Leave)
                                </span>
                              ) : leave.status === 'rejected' ? (
                                <span
                                  style={{
                                    background: '#FDF1F0',
                                    color: '#DC2626',
                                    fontWeight: 700,
                                    padding: '3px 8px',
                                    borderRadius: 6,
                                    fontSize: 10.5,
                                    textTransform: 'uppercase',
                                  }}
                                >
                                  ✕ Rejected
                                </span>
                              ) : (
                                <span
                                  style={{
                                    background: '#FEF3C7',
                                    color: '#92400E',
                                    fontWeight: 700,
                                    padding: '3px 8px',
                                    borderRadius: 6,
                                    fontSize: 10.5,
                                    textTransform: 'uppercase',
                                  }}
                                >
                                  Pending Teacher Review
                                </span>
                              )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--neutral-dark)' }}>
                              <Calendar size={14} style={{ color: '#2C6E6A' }} />
                              <span>
                                {leave.startDate} {leave.endDate && leave.endDate !== leave.startDate ? `→ ${leave.endDate}` : ''}
                              </span>
                            </div>
                          </div>

                          <div style={{ fontSize: 13, color: 'var(--neutral-dark)', lineHeight: 1.4, marginBottom: 8 }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-secondary)', marginRight: 6 }}>Reason:</span>
                            {leave.reason}
                          </div>

                          {/* Attached Certificate / Document */}
                          {leave.fileName && (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 12px',
                                background: '#F8F7F4',
                                border: '1px solid var(--border-color)',
                                borderRadius: 6,
                                marginBottom: 12,
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                                <Paperclip size={15} style={{ color: '#2C6E6A', flexShrink: 0 }} />
                                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--neutral-dark)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {leave.fileName}
                                </span>
                              </div>
                              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setViewingFile({
                                      fileName: leave.fileName || 'Medical Certificate',
                                      fileUrl: leave.fileUrl,
                                      title: leave.leaveType,
                                      description: leave.reason,
                                      submissionDate: leave.created_at ? new Date(leave.created_at).toLocaleDateString() : undefined,
                                    });
                                  }}
                                  style={{
                                    padding: '4px 10px',
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: '#2C6E6A',
                                    background: '#EAF3EF',
                                    border: '1px solid #C7E4D8',
                                    borderRadius: 4,
                                    cursor: 'pointer',
                                  }}
                                >
                                  View Certificate ↗
                                </button>
                                {leave.fileUrl && (
                                  <button
                                    type="button"
                                    onClick={() => downloadFile({ fileName: leave.fileName || 'certificate.pdf', fileUrl: leave.fileUrl })}
                                    style={{
                                      padding: '4px 10px',
                                      fontSize: 11,
                                      fontWeight: 600,
                                      color: 'var(--neutral-dark)',
                                      background: '#FFFFFF',
                                      border: '1px solid var(--border-color)',
                                      borderRadius: 4,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    Download ⤓
                                  </button>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Card Footer Actions */}
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid #F1EFEA', paddingTop: 10 }}>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingLeave(leave);
                                setIsApplyLeaveOpen(true);
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '5px 12px',
                                fontSize: 11.5,
                                fontWeight: 600,
                                color: '#2C6E6A',
                                background: '#EAF3EF',
                                border: '1px solid #C7E4D8',
                                borderRadius: 5,
                                cursor: 'pointer',
                              }}
                            >
                              <Edit3 size={13} />
                              <span>Edit Leave</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteLeave?.(leave.id)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '5px 12px',
                                fontSize: 11.5,
                                fontWeight: 600,
                                color: '#A83B38',
                                background: '#FDF1F0',
                                border: '1px solid #F5C6CB',
                                borderRadius: 5,
                                cursor: 'pointer',
                              }}
                            >
                              <Trash2 size={13} />
                              <span>Cancel / Delete</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* VIEW 4: GLOBAL HOLISTIC HUB */}
        {activeNavType === 'hub' && (
          <>
            <header className="content-header">
              <div className="header-top" style={{ flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#2C6E6A', letterSpacing: '0.06em' }}>
                    CO-CURRICULAR HUB
                  </div>
                  <h1 className="page-title" style={{ margin: '2px 0 0' }}>
                    Holistic Development Programmes
                  </h1>
                  <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                    Explore clubs, workshops, events, and leadership opportunities
                  </p>
                </div>

                <div style={{ display: 'flex' }}>
                  <SegmentedControl
                    value={hubFilter}
                    onChange={(val) => setHubFilter(val)}
                    options={[
                      { value: '', label: 'All' },
                      { value: 'Club Registration', label: 'Clubs' },
                      { value: 'Workshop', label: 'Workshops' },
                      { value: 'Event', label: 'Events' },
                      { value: 'Leadership Programme', label: 'Leadership' },
                      { value: 'Volunteer Opportunity', label: 'Volunteer' },
                      { value: 'Sports & Athletics', label: 'Sports' },
                    ]}
                    height={32}
                    textTransform="none"
                  />
                </div>
              </div>
            </header>

            <div className="content-body">
              {filteredHub.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-secondary)', fontSize: 13, background: '#FFFFFF', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                  <div style={{ width: 46, height: 46, borderRadius: '50%', background: '#EAF3EF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: '#2D6E5D' }}>
                    <BookOpen size={20} />
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--neutral-dark)', fontSize: 15, marginBottom: 6 }}>No Activities Found</div>
                  <div>No activities available in this category right now. Check back soon!</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 16 }}>
                  {filteredHub.map((act) => {
                    const isEnrolled = (act.enrolled_student_ids || []).includes(currentStudent.id);
                    const typeColors: Record<string, string> = {
                      'Club Registration': '#7C3AED', 'Workshop': '#2563EB', 'Event': '#D97706',
                      'Leadership Programme': '#059669', 'Volunteer Opportunity': '#DC2626',
                      'Counselling Appointment': '#0891B2', 'Summer Programme': '#EA580C',
                      'Sports & Athletics': '#16A34A', 'Science & Technology': '#4F46E5', 'Arts & Culture': '#C026D3',
                    };
                    const color = typeColors[act.type] || '#2C6E6A';
                    const enrolledCount = (act.enrolled_student_ids || []).length;
                    const maxCap = (act as any).max_capacity;
                    const location = (act as any).location;

                    return (
                      <div
                        key={act.id}
                        onClick={() => setSelectedHubActivity(act)}
                        style={{
                          borderRadius: 8, border: isEnrolled ? `2px solid ${color}60` : '1px solid var(--border-color)',
                          background: '#FFFFFF', overflow: 'hidden',
                          display: 'flex', flexDirection: 'column',
                          cursor: 'pointer',
                          boxShadow: isEnrolled ? `0 2px 12px ${color}20` : '0 1px 4px rgba(0,0,0,0.04)',
                          transition: 'box-shadow 0.2s, transform 0.15s',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 20px rgba(0,0,0,0.1)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = isEnrolled ? `0 2px 12px ${color}20` : '0 1px 4px rgba(0,0,0,0.04)'; }}
                      >
                        <div style={{
                          background: `linear-gradient(135deg, ${color}28 0%, ${color}12 100%)`,
                          borderBottom: `1px solid ${color}30`,
                          padding: '18px 20px',
                          display: 'flex', alignItems: 'center', gap: 12,
                        }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: 6,
                            background: color + '20', border: `1.5px solid ${color}40`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                          }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                              <span style={{
                                fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em',
                                color, background: color + '18', border: `1px solid ${color}30`,
                                padding: '2px 7px', borderRadius: 4,
                              }}>{act.type}</span>
                              {isEnrolled && (
                                <span style={{ fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#059669', background: '#D1FAE5', border: '1px solid #A7F3D0', padding: '2px 7px', borderRadius: 4 }}>
                                  ✓ Enrolled
                                </span>
                              )}
                            </div>
                            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--neutral-dark)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {act.title}
                            </div>
                          </div>
                        </div>

                          <div style={{ padding: '14px 20px', flex: 1 }}>
                            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 10px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {act.description}
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Calendar size={11} />
                                <strong style={{ color: 'var(--neutral-dark)' }}>{act.date}</strong>
                              </div>
                              {location && (
                                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ fontWeight: 600 }}>Location:</span> {location}
                                </div>
                              )}
                            </div>
                          </div>

                        {/* Footer */}
                        <div style={{
                          padding: '10px 20px', borderTop: '1px solid var(--border-color)',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          background: '#FAFAF9',
                        }}>
                          <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                            {enrolledCount} enrolled{maxCap ? ` / ${maxCap} max` : ''}
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 600, color, display: 'flex', alignItems: 'center', gap: 4 }}>
                            View Details →
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Activity Detail Drawer ── */}
            {selectedHubActivity && (() => {
              const act = selectedHubActivity;
              const isEnrolled = (act.enrolled_student_ids || []).includes(currentStudent.id);
              const typeColors: Record<string, string> = {
                'Club Registration': '#7C3AED', 'Workshop': '#2563EB', 'Event': '#D97706',
                'Leadership Programme': '#059669', 'Volunteer Opportunity': '#DC2626',
                'Counselling Appointment': '#0891B2', 'Summer Programme': '#EA580C',
                'Sports & Athletics': '#16A34A', 'Science & Technology': '#4F46E5', 'Arts & Culture': '#C026D3',
              };
              const color = typeColors[act.type] || '#2C6E6A';
              const enrolledCount = (act.enrolled_student_ids || []).length;
              const maxCap = (act as any).max_capacity;
              const location = (act as any).location;

              // Convert YouTube URL to embed
              let videoEmbedUrl = '';
              if (act.video_url) {
                const ytMatch = act.video_url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
                if (ytMatch) videoEmbedUrl = `https://www.youtube.com/embed/${ytMatch[1]}`;
              }

              return (
                <div
                  style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', zIndex: 900, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}
                  onClick={() => setSelectedHubActivity(null)}
                >
                  <div
                    onClick={e => e.stopPropagation()}
                    style={{
                      width: '100%', maxWidth: 520,
                      height: '100vh', maxHeight: '100vh',
                      background: '#FFFFFF', overflowY: 'auto',
                      display: 'flex', flexDirection: 'column',
                      boxShadow: '-8px 0 40px rgba(0,0,0,0.15)',
                      animation: 'slideInRight 0.25s ease',
                    }}
                  >
                    {/* Header banner */}
                    <div style={{
                      background: `linear-gradient(135deg, ${color}30 0%, ${color}10 100%)`,
                      borderBottom: `1px solid ${color}30`,
                      padding: '28px 28px 24px',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 8,
                      background: color + '20', border: `2px solid ${color}40`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <div style={{ width: 14, height: 14, borderRadius: '50%', background: color }} />
                    </div>
                        <button
                          onClick={() => setSelectedHubActivity(null)}
                          style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--border-color)', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: 'var(--text-secondary)' }}
                        >
                          ×
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color, background: color + '18', border: `1px solid ${color}30`, padding: '3px 8px', borderRadius: 4 }}>{act.type}</span>
                        {isEnrolled && (
                          <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#059669', background: '#D1FAE5', border: '1px solid #A7F3D0', padding: '3px 8px', borderRadius: 4 }}>✓ Enrolled</span>
                        )}
                      </div>
                      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--neutral-dark)', lineHeight: 1.3 }}>{act.title}</h2>
                    </div>

                    {/* Content */}
                    <div style={{ padding: '24px 28px', flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
                      {/* Quick stats */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        {[
                          { label: 'Date', value: act.date },
                          { label: 'Enrolled', value: `${enrolledCount}${maxCap ? ` / ${maxCap}` : ''} students` },
                          ...(location ? [{ label: 'Location', value: location }] : []),
                          { label: 'Target Grades', value: (act.target_grades || []).join(', ') || 'All Grades' },
                        ].map((item, i) => (
                          <div key={i} style={{ padding: '12px 14px', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 3 }}>{item.label}</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--neutral-dark)' }}>{item.value}</div>
                          </div>
                        ))}
                      </div>

                      {/* Description */}
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: 8 }}>About This Programme</div>
                        <p style={{ fontSize: 13.5, color: 'var(--neutral-dark)', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-line' }}>{act.description}</p>
                      </div>

                      {/* Video embed */}
                      {videoEmbedUrl && (
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: 8 }}>Programme Video</div>
                          <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-color)', aspectRatio: '16/9' }}>
                            <iframe src={videoEmbedUrl} style={{ width: '100%', height: '100%', border: 'none' }} allowFullScreen title={act.title} />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Sticky footer CTA */}
                    <div style={{ padding: '16px 28px', borderTop: '1px solid var(--border-color)', background: '#FFFFFF', position: 'sticky', bottom: 0 }}>
                      {maxCap && enrolledCount >= maxCap && !isEnrolled ? (
                        <div style={{ textAlign: 'center', padding: '12px', background: '#FEF2F2', borderRadius: 8, color: '#DC2626', fontWeight: 600, fontSize: 13 }}>
                          This programme is fully booked
                        </div>
                      ) : (
                        <button
                          onClick={() => { handleHubEnroll(act.id, act.title); setSelectedHubActivity({ ...act, enrolled_student_ids: isEnrolled ? (act.enrolled_student_ids || []).filter(id => id !== currentStudent.id) : [...(act.enrolled_student_ids || []), currentStudent.id] }); }}
                          style={{
                            width: '100%', padding: '13px', fontSize: 14, fontWeight: 700,
                            border: isEnrolled ? '2px solid #DC2626' : 'none',
                            borderRadius: 10, cursor: 'pointer',
                            background: isEnrolled ? '#FEF2F2' : color,
                        color: isEnrolled ? '#DC2626' : '#FFFFFF',
                            boxShadow: isEnrolled ? 'none' : `0 4px 16px ${color}40`,
                          }}
                        >
                          {isEnrolled ? '✕ Withdraw / Unenrol' : '✓ Register & Enrol'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </>
        )}



        {/* VIEW 4.5: HOMEROOM CIRCULARS & NOTICES FROM CLASS TEACHER */}
        {activeNavType === 'homeroom_circulars' && (
          <>
            <header className="content-header">
              <div className="header-top">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: '#EAF3EF',
                        color: '#2D6E5D',
                        border: '1px solid #C7E4D8',
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                      }}
                    >
                      GRADE {cleanGrade}-{cleanSection} • HOMEROOM CHANNEL
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Class Teacher Updates</span>
                  </div>
                  <h1 className="page-title" style={{ margin: '2px 0 0' }}>
                    Class Circulars &amp; Direct Materials
                  </h1>
                  <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                    Official notices, event circulars, weekly timetables, and resource files shared directly by your Homeroom Class Teacher.
                  </p>
                </div>
              </div>

              {/* Standard Clean Segmented Tabs */}
              <div className="tabs">
                <button
                  type="button"
                  className={`tab-btn ${studentHrTab === 'circulars' ? 'active' : ''}`}
                  onClick={() => setStudentHrTab('circulars')}
                >
                  <Megaphone size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: -2 }} />
                  Notices &amp; Circulars
                  <span className="tab-count">{myHomeroomBroadcasts.length}</span>
                </button>

                <button
                  type="button"
                  className={`tab-btn ${studentHrTab === 'materials' ? 'active' : ''}`}
                  onClick={() => setStudentHrTab('materials')}
                >
                  <BookOpen size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: -2 }} />
                  Class Materials &amp; Timetables
                  <span className="tab-count">{myHomeroomResources.length}</span>
                </button>
              </div>
            </header>

            <div className="content-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Filter & Search Bar */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 10,
                  flexWrap: 'wrap',
                }}
              >
                {studentHrTab === 'circulars' ? (
                  <div style={{ display: 'flex' }}>
                    <SegmentedControl
                      value={hrPriorityFilter}
                      onChange={(pri) => setHrPriorityFilter(pri as any)}
                      options={[
                        { value: 'all', label: 'All Notices' },
                        { value: 'pinned', label: 'Pinned' },
                        { value: 'urgent', label: 'Urgent' },
                        { value: 'important', label: 'Important' },
                      ]}
                      height={30}
                      textTransform="none"
                    />
                  </div>
                ) : (
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {filteredHomeroomResources.length} file{filteredHomeroomResources.length === 1 ? '' : 's'} available
                  </div>
                )}

                <div style={{ minWidth: 200, flex: 1, maxWidth: 300 }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder={`Search ${studentHrTab === 'circulars' ? 'circulars...' : 'materials...'}`}
                    value={hrSearchQuery}
                    onChange={(e) => setHrSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 12px',
                      fontSize: 12.5,
                      borderRadius: 6,
                      border: '1px solid var(--border-color)',
                      background: 'var(--surface)',
                    }}
                  />
                </div>
              </div>

              {/* TAB 1: NOTICES & CIRCULARS */}
              {studentHrTab === 'circulars' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {filteredHomeroomBroadcasts.length === 0 ? (
                    <div
                      style={{
                        padding: '36px 18px',
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
                          width: 46,
                          height: 46,
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
                        {hrSearchQuery || hrPriorityFilter !== 'all'
                          ? 'No matching notices found'
                          : 'All Caught Up on Class Circulars'}
                      </h3>
                      <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', maxWidth: 380, margin: '6px 0 12px', lineHeight: 1.5 }}>
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
                          style={{ padding: '6px 14px', fontSize: 11.5 }}
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
                                    {bc.teacher_name || 'Class Teacher'}
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
                                    Class Teacher
                                  </span>
                                </div>
                                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                  {bc.created_at ? new Date(bc.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Recently'}
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
                          <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 8px', color: 'var(--neutral-dark)', letterSpacing: '-0.01em' }}>
                            {bc.title}
                          </h3>

                          {/* Content */}
                          <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap', background: '#FAF9F6', padding: '12px 14px', borderRadius: 6, border: '1px solid #ECEAE5' }}>
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
                        padding: '36px 18px',
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
                          width: 46,
                          height: 46,
                          borderRadius: '50%',
                          background: '#FEF7EC',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: 12,
                          color: '#9E6C1B',
                        }}
                      >
                        <FolderOpen size={24} />
                      </div>
                      <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--neutral-dark)' }}>
                        {hrSearchQuery ? 'No matching materials found' : 'No Class Materials Uploaded Yet'}
                      </h3>
                      <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', maxWidth: 380, margin: '6px 0 12px', lineHeight: 1.5 }}>
                        {hrSearchQuery
                          ? 'Try clearing the search input.'
                          : `Timetables, consent slips, and documents uploaded by your Homeroom Teacher for Grade ${cleanGrade}-${cleanSection} will be accessible here.`}
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: 12 }}>
                      {filteredHomeroomResources.map((res) => {
                        let typeIcon = <FileText size={16} />;
                        let typeBg = '#EAF3EF';
                        let typeColor = '#2D6E5D';
                        if (res.resource_type === 'pdf') {
                          typeIcon = <FileText size={16} />;
                          typeBg = '#FDF1F0';
                          typeColor = '#A83B38';
                        } else if (res.resource_type === 'slides') {
                          typeIcon = <BookOpen size={16} />;
                          typeBg = '#FEF7EC';
                          typeColor = '#9E6C1B';
                        } else if (res.resource_type === 'video') {
                          typeIcon = <Video size={16} />;
                          typeBg = '#F3EFFA';
                          typeColor = '#7C5CBF';
                        } else if (res.resource_type === 'link') {
                          typeIcon = <Link2 size={16} />;
                          typeBg = '#EFF6FF';
                          typeColor = '#1E40AF';
                        }

                        return (
                          <div
                            key={res.id}
                            style={{
                              background: '#FFFFFF',
                              border: '1px solid var(--border-color)',
                              borderRadius: 8,
                              padding: '14px 16px',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              gap: 12,
                            }}
                          >
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    padding: '2px 7px',
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
                                  <span style={{ fontSize: 10, color: '#2C6E6A', fontWeight: 700, background: '#FAF9F6', padding: '2px 6px', borderRadius: 4, border: '1px solid #ECEAE5' }}>
                                    #{res.topic_tag}
                                  </span>
                                )}
                              </div>

                              <h4 style={{ fontSize: 13.5, fontWeight: 700, margin: '0 0 4px', color: 'var(--neutral-dark)', lineHeight: 1.35 }}>
                                {res.title}
                              </h4>
                              {res.description && (
                                <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                                  {res.description}
                                </p>
                              )}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid #ECEAE5' }}>
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
                                    padding: '5px 10px',
                                    fontSize: 11,
                                    fontWeight: 700,
                                    background: '#2C6E6A',
                                    color: '#FFFFFF',
                                    border: 'none',
                                    borderRadius: 4,
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
                                      title: res.title,
                                    });
                                  }}
                                  style={{
                                    padding: '5px 8px',
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

        {/* VIEW 5: SETTINGS */}
        {activeNavType === 'settings' && (
          <div className="content-body">
            <SettingsView currentUser={currentStudent} onRefreshData={onRefreshData} onUpdateCurrentUser={onUpdateCurrentUser} />
          </div>
        )}

        {/* VIEW 6: HELP & SUPPORT */}
        {activeNavType === 'support' && (
          <div className="content-body">
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
      {/* Apply / Edit Authorized Leave / Sick Note Modal */}
      <ApplyLeaveModal
        isOpen={isApplyLeaveOpen}
        initialLeave={editingLeave}
        onClose={() => {
          setIsApplyLeaveOpen(false);
          setEditingLeave(null);
        }}
        onSubmit={handleApplyLeaveSubmit}
        studentName={currentStudent.name}
        studentGrade={`Grade ${cleanGrade}-${cleanSection}`}
      />
    </div>
  );
};
