'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  UserProfile,
  SubjectClass,
  TestItem,
  AssignmentItem,
  SyllabusTerm,
  ClassResource,
  ClassBroadcast,
  Achievement,
  LeaveRequest,
  HubActivity,
  ParentDocument,
} from '@/lib/supabaseClient';
import { TestResultRecord } from '@/components/Modals/ReviewTestResultsModal';
import { AssignmentSubmissionRecord } from '@/components/Modals/GradeAssignmentModal';
import { usePortalNavigation, PortalNavigationTarget, ChatMessage } from '@/lib/PortalNavigationContext';
import { extractClassTeacherInfo } from '@/lib/classTeacherHelper';
import {
  ArrowUpRight,
  X,
  RotateCcw,
  Send,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  ThumbsDown,
  RefreshCw,
  Paperclip,
  Plus,
  Wand2,
  Lightbulb,
  Compass,
  MessageSquare,
  Bot
} from 'lucide-react';

interface AiChatbotProps {
  currentUser?: UserProfile | null;
  profiles?: UserProfile[];
  subjectClasses?: SubjectClass[];
  tests?: TestItem[];
  assignments?: AssignmentItem[];
  syllabus?: SyllabusTerm[];
  attendance?: Record<string, Record<string, string>>;
  classResources?: ClassResource[];
  classBroadcasts?: ClassBroadcast[];
  achievements?: Achievement[];
  leaveRequests?: LeaveRequest[];
  hubActivities?: HubActivity[];
  parentDocuments?: ParentDocument[];
  linkRequests?: any[];
  testResults?: Record<string, TestResultRecord>;
  assignmentSubmissions?: Record<string, AssignmentSubmissionRecord>;
  studentSyllabusProgress?: Record<string, boolean>;
}

/* =========================================================================
   SEAMLESS LOOPING 3D IRIDESCENT FLUID GLASS ORB COMPONENT
   ========================================================================= */
const AnimatedOrb: React.FC<{ size?: number; className?: string }> = ({ size = 44, className = '' }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, []);

  return (
    <div
      className={`woodlem-animated-orb-container ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Soft ambient chromatic glow */}
      <div className="woodlem-orb-ambient-bloom" />

      {/* Rotating iridescent sheen halo */}
      <div className="woodlem-orb-sheen-ring" />

      {/* Looping 3D Iridescent Fluid Video */}
      <div
        className="woodlem-orb-video-wrap"
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 2,
          boxShadow: '0 4px 16px rgba(139, 92, 246, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.85)',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        <video
          ref={videoRef}
          src="/ai-orb-loop.mp4"
          poster="/ai-orb-poster.png"
          autoPlay
          loop
          muted
          playsInline
          disablePictureInPicture
          disableRemotePlayback
          controlsList="nodownload nofullscreen noremoteplayback noplaybackrate"
          className="woodlem-orb-video-element"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: '50%',
            display: 'block',
            pointerEvents: 'none',
          }}
        />
      </div>
    </div>
  );
};

export const AiChatbot: React.FC<AiChatbotProps> = ({
  currentUser: propUser,
  profiles = [],
  subjectClasses = [],
  tests = [],
  assignments = [],
  syllabus = [],
  attendance = {},
  classResources = [],
  classBroadcasts = [],
  achievements = [],
  leaveRequests = [],
  hubActivities = [],
  parentDocuments = [],
  testResults = {},
  assignmentSubmissions = {},
}) => {
  const {
    isAiPanelOpen,
    setIsAiPanelOpen,
    toggleAiPanel,
    currentUser: contextUser,
    navigateTo,
    messages,
    setMessages,
    clearChatHistory,
    activeNavNotification,
  } = usePortalNavigation();

  const user = propUser || contextUser;
  const isGuest = !user;
  const role = user ? (user.role || 'student') : 'guest';
  const userName = user ? (user.name || 'Student') : 'Visitor';

  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedThoughtIds, setExpandedThoughtIds] = useState<Record<string, boolean>>({});
  const [isHovered, setIsHovered] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Floating Draggable Orb Launcher State
  const [orbPosition, setOrbPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingOrb, setIsDraggingOrb] = useState(false);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startOrbX: number;
    startOrbY: number;
    hasMoved: boolean;
  }>({
    startX: 0,
    startY: 0,
    startOrbX: 0,
    startOrbY: 0,
    hasMoved: false,
  });

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setIsMounted(true);
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Initialize and restore saved orb position
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const defaultX = Math.max(16, window.innerWidth - 84);
    const defaultY = Math.max(16, window.innerHeight - 84);

    try {
      const saved = localStorage.getItem('woodlem_ai_orb_pos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          const clampedX = Math.max(16, Math.min(window.innerWidth - 76, parsed.x));
          const clampedY = Math.max(16, Math.min(window.innerHeight - 76, parsed.y));
          setOrbPosition({ x: clampedX, y: clampedY });
          return;
        }
      }
    } catch {}

    setOrbPosition({ x: defaultX, y: defaultY });

    const handleResize = () => {
      setOrbPosition((prev) => {
        if (!prev) return { x: window.innerWidth - 84, y: window.innerHeight - 84 };
        return {
          x: Math.max(16, Math.min(window.innerWidth - 76, prev.x)),
          y: Math.max(16, Math.min(window.innerHeight - 76, prev.y)),
        };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Global mouse & touch drag listeners for orb
  useEffect(() => {
    if (!isDraggingOrb) return;

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

      const dx = clientX - dragRef.current.startX;
      const dy = clientY - dragRef.current.startY;

      if (Math.hypot(dx, dy) > 4) {
        dragRef.current.hasMoved = true;
      }

      const nextX = Math.max(16, Math.min(window.innerWidth - 76, dragRef.current.startOrbX + dx));
      const nextY = Math.max(16, Math.min(window.innerHeight - 76, dragRef.current.startOrbY + dy));

      setOrbPosition({ x: nextX, y: nextY });
    };

    const handlePointerUp = () => {
      setIsDraggingOrb(false);

      if (dragRef.current.hasMoved) {
        // Snap smoothly to closest corner
        setOrbPosition((current) => {
          if (!current) return current;
          const minX = 20;
          const maxX = Math.max(20, window.innerWidth - 84);
          const minY = 20;
          const maxY = Math.max(20, window.innerHeight - 84);

          const midX = window.innerWidth / 2;
          const midY = window.innerHeight / 2;

          const snapX = current.x < midX ? minX : maxX;
          const snapY = current.y < midY ? minY : maxY;

          const snapped = { x: snapX, y: snapY };
          try {
            localStorage.setItem('woodlem_ai_orb_pos', JSON.stringify(snapped));
          } catch {}
          return snapped;
        });
      }
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('touchmove', handlePointerMove, { passive: false });
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchend', handlePointerUp);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchend', handlePointerUp);
    };
  }, [isDraggingOrb]);

  const handleOrbPointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    const currentX = orbPosition?.x ?? (window.innerWidth - 84);
    const currentY = orbPosition?.y ?? (window.innerHeight - 84);

    dragRef.current = {
      startX: clientX,
      startY: clientY,
      startOrbX: currentX,
      startOrbY: currentY,
      hasMoved: false,
    };
    setIsDraggingOrb(true);
  };

  const handleOrbClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragRef.current.hasMoved) {
      return; // Dragged, don't open panel
    }
    toggleAiPanel();
  };

  // Auto-scroll on new message or loading state change
  useEffect(() => {
    if (isAiPanelOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [isAiPanelOpen, messages, isLoading]);



  // Compile live Ground Truth Portal Context to pass to Gemini AI
  const portalContext = React.useMemo(() => {
    if (!user) {
      return {
        isLoginScreen: true,
        currentUser: null,
      };
    }

    // Extract exact homeroom info using classTeacherHelper for teachers, or profile for students/admins
    const teacherInfo = role === 'teacher' ? extractClassTeacherInfo(user, subjectClasses) : null;
    const uGrade = teacherInfo ? teacherInfo.grade : (user.grade || '').replace(/[^0-9]/g, '');
    const uSection = teacherInfo ? teacherInfo.section : (user.class_letter || '').toUpperCase().trim();
    const homeroomLabel = uGrade ? `Grade ${uGrade}-${uSection || 'All'}` : '';

    // 1. Subject Classrooms (Role-isolated)
    const userClasses = subjectClasses
      .filter((c) => {
        if (c.id.startsWith('class-seed-') || c.name === 'Physics 12-C' || c.name === 'Chemistry 12-C') return false;
        if (role === 'teacher') return c.teacher_id === user.id || c.teacher_name === user.name;
        if (role === 'student') {
          const enrolled = c.enrolled_student_ids || [];
          if (enrolled.includes(user.id) || (user.email && enrolled.includes(user.email))) return true;
          if (enrolled.length === 0 && c.class_name) {
            const cn = c.class_name.toLowerCase().replace(/grade\s*/gi, '').trim();
            const cnParts = cn.split(/[-\s]+/);
            const cnGrade = cnParts.find((p) => /^\d+$/.test(p)) || '';
            const cnLetter = cnParts.find((p) => /^[a-z]$/.test(p))?.toUpperCase() || '';
            return cnGrade === uGrade && (!cnLetter || cnLetter === uSection);
          }
          return false;
        }
        return true;
      })
      .map((c) => ({
        id: c.id,
        name: c.name,
        subject: c.subject,
        gradeClass: c.class_name,
        section: c.section,
        enrolledCount: c.enrolled_student_ids?.length || 0,
      }));

    const userClassIds = new Set(userClasses.map((c) => c.id));
    const userClassNames = userClasses.map((c) => c.name.toLowerCase().trim());
    const userClassSubjects = userClasses.map((c) => (c.subject || '').toLowerCase().trim());

    // 2. Homeroom Students & Attendance (Restricted to teacher's exact assigned grade & section)
    let homeroomStudentsList: Array<{ name: string; admission: string; grade: string; email: string }> = [];
    let presentCount = 0;
    let authAbsentNames: string[] = [];
    let unauthAbsentNames: string[] = [];
    const todayStr = new Date().toISOString().split('T')[0];
    const todayAtt = attendance[todayStr] || {};

    if (role === 'teacher') {
      const hr = profiles.filter((p) => {
        if (p.role !== 'student') return false;
        const g = (p.grade || '').replace(/[^0-9]/g, '');
        const s = (p.class_letter || '').toUpperCase().trim();
        return g === uGrade && s === uSection;
      });
      homeroomStudentsList = hr.map((s) => ({
        name: s.name,
        admission: s.admission_number || s.user_code || '—',
        grade: `Grade ${s.grade || uGrade}-${s.class_letter || uSection}`,
        email: s.email,
      }));

      homeroomStudentsList.forEach((st) => {
        const studentProfile = profiles.find((p) => p.email === st.email || p.admission_number === st.admission);
        if (studentProfile) {
          const status = todayAtt[studentProfile.id];
          if (status === 'present') presentCount++;
          else if (status === 'auth_absent') authAbsentNames.push(st.name);
          else if (status === 'unauth_absent') unauthAbsentNames.push(st.name);
        }
      });
    } else if (role === 'admin') {
      const hr = profiles.filter((p) => p.role === 'student');
      homeroomStudentsList = hr.slice(0, 50).map((s) => ({
        name: s.name,
        admission: s.admission_number || s.user_code || '—',
        grade: `Grade ${s.grade || ''}-${s.class_letter || ''}`,
        email: s.email,
      }));

      homeroomStudentsList.forEach((st) => {
        const studentProfile = profiles.find((p) => p.email === st.email || p.admission_number === st.admission);
        if (studentProfile) {
          const status = todayAtt[studentProfile.id];
          if (status === 'present') presentCount++;
          else if (status === 'auth_absent') authAbsentNames.push(st.name);
          else if (status === 'unauth_absent') unauthAbsentNames.push(st.name);
        }
      });
    }

    // Student Personal Attendance Rate calculation
    let studentPresentDays = 0;
    let studentTotalDays = 0;
    if (role === 'student') {
      Object.keys(attendance).forEach((dateKey) => {
        const dayRecord = attendance[dateKey];
        if (dayRecord && dayRecord[user.id]) {
          studentTotalDays++;
          if (dayRecord[user.id] === 'present') studentPresentDays++;
        }
      });
    }
    const studentAttendanceRate = studentTotalDays > 0 ? Math.round((studentPresentDays / studentTotalDays) * 100) : 100;

    // Helper: Check if an item belongs to the student's enrolled classes and matches grade & section
    const isItemMatchingEnrolledClasses = (itemClassName?: string, itemTitle?: string, itemClassId?: string, itemTeacherId?: string) => {
      if (itemClassId && userClassIds.has(itemClassId)) return true;

      const rawCn = (itemClassName || '').toLowerCase().trim();
      if (!rawCn && !itemTitle) return false;

      // Extract section letter (e.g. "12-B", "(12-B)", "12B", "Section B", "12-C")
      const sectionMatch = rawCn.match(/(?:\b\d+[-\s]*([a-z])\b|\bsection\s*([a-z])\b|\(([0-9]*[-\s]*[a-z])\))/i);
      let itemSection = '';
      if (sectionMatch) {
        const rawFound = (sectionMatch[1] || sectionMatch[2] || sectionMatch[3] || '').toUpperCase();
        itemSection = rawFound.replace(/[^A-Z]/g, '');
      }

      // Extract grade number (e.g. "Grade 10", "12-B", "10-A", "Class 11")
      const gradeMatch = rawCn.match(/(?:grade\s*|class\s*)?(\d+)/i);
      const itemGradeNum = gradeMatch ? gradeMatch[1] : '';

      // If grade is specified in the item, it MUST match student's grade
      if (itemGradeNum && uGrade && itemGradeNum !== uGrade) {
        return false;
      }

      // If section is specified in the item (e.g. "B"), it MUST match student's section (e.g. "C")!
      if (itemSection && uSection && itemSection !== uSection) {
        return false;
      }

      // Check if class matches any enrolled classroom
      for (const cls of userClasses) {
        const clsName = cls.name.toLowerCase().trim();
        const clsSub = (cls.subject || '').toLowerCase().trim();
        const clsGradeSection = (cls.gradeClass || '').toLowerCase().replace(/grade\s*/gi, '').trim();

        if (rawCn === clsName || rawCn === `${clsName} (${clsGradeSection})` || rawCn === `${clsName} ${clsGradeSection}`) {
          return true;
        }

        if (clsSub && (rawCn.includes(clsSub) || (itemTitle && itemTitle.toLowerCase().includes(clsSub)))) {
          return true;
        }

        if (clsName && (rawCn.includes(clsName) || clsName.includes(rawCn))) {
          return true;
        }
      }

      return false;
    };

    // 3. Active Tests (Filtered to user's enrolled classes)
    const filteredTests = tests.filter((t) => {
      if (role === 'teacher') return t.teacher_id === user.id || (t.class_name && userClassNames.some((cn) => cn && t.class_name?.toLowerCase().includes(cn)));
      if (role === 'student') {
        return isItemMatchingEnrolledClasses(t.class_name, t.title);
      }
      return true;
    });

    const activeTestsList = filteredTests.slice(0, 10).map((t) => {
      const result = role === 'student' ? testResults[`${t.id}_${user.id}`] : null;
      return {
        id: t.id,
        title: t.title,
        className: t.class_name || 'General',
        durationMinutes: t.duration_minutes || 30,
        questionsCount: t.questions?.length || 0,
        totalMarks: t.total_marks || (t.questions?.length ? t.questions.length * 5 : 25),
        status: result ? `Completed (Score: ${result.score}%)` : 'Pending Assessment',
      };
    });

    // 4. Active Homework Assignments (Filtered to user's enrolled classes)
    const filteredAssignments = assignments.filter((a) => {
      if (role === 'teacher') return a.class_name && userClassNames.some((cn) => cn && a.class_name?.toLowerCase().includes(cn));
      if (role === 'student') {
        return isItemMatchingEnrolledClasses(a.class_name, a.title);
      }
      return true;
    });

    const activeAssignmentsList = filteredAssignments.slice(0, 10).map((a) => {
      const submission = role === 'student' ? assignmentSubmissions[`${a.id}_${user.id}`] : null;
      return {
        id: a.id,
        title: a.title,
        className: a.class_name || 'General',
        createdAt: a.created_at,
        status: submission ? `Submitted (${submission.grade || 'Graded'})` : 'Pending Submission',
      };
    });

    // 5. Syllabus Progress (Filtered to enrolled classes)
    const filteredSyllabus = syllabus.filter((term) => {
      if (role === 'teacher') return (term.class_id && userClassIds.has(term.class_id)) || (term.subject && user.subject && term.subject.toLowerCase() === user.subject.toLowerCase());
      if (role === 'student') {
        return isItemMatchingEnrolledClasses(term.class_name, term.name, term.class_id);
      }
      return true;
    });

    const syllabusTermsList = filteredSyllabus.slice(0, 6).map((term) => {
      const topics = term.topics || [];
      const doneCount = topics.filter((tp) => tp.teacher_checked || tp.student_checked).length;
      const pct = topics.length > 0 ? Math.round((doneCount / topics.length) * 100) : 0;
      return {
        termName: term.name,
        subject: term.subject,
        className: term.class_name,
        totalTopics: topics.length,
        completedTopics: doneCount,
        percentDone: `${pct}%`,
        topics: topics.map((tp) => ({ title: tp.title, isDone: tp.teacher_checked || tp.student_checked })),
      };
    });

    // 6. Recent Learning Resources (Filtered to user's classes & homeroom)
    const hrClassId = `homeroom-${uGrade}-${uSection}`;
    const filteredResources = classResources.filter((r) => {
      if (role === 'teacher') return r.teacher_id === user.id || (r.class_id && userClassIds.has(r.class_id)) || r.class_id === hrClassId;
      if (role === 'student') {
        if (r.class_id && (userClassIds.has(r.class_id) || r.class_id === hrClassId)) return true;
        return isItemMatchingEnrolledClasses('', r.title, r.class_id);
      }
      return true;
    });

    const recentResources = filteredResources.slice(0, 12).map((r) => ({
      title: r.title,
      type: r.resource_type,
      fileName: r.file_name,
      uploadedBy: r.teacher_name,
    }));

    // 7. Recent Broadcasts & Notices (Filtered to user's classes & homeroom)
    const filteredBroadcasts = classBroadcasts.filter((b) => {
      if (role === 'teacher') return b.teacher_id === user.id || (b.class_id && userClassIds.has(b.class_id)) || b.class_id === hrClassId;
      if (role === 'student') {
        if (b.class_id && (userClassIds.has(b.class_id) || b.class_id === hrClassId)) return true;
        return !b.class_id; // global school circulars
      }
      return true;
    });

    const recentBroadcasts = filteredBroadcasts.slice(0, 8).map((b) => ({
      title: b.title,
      content: b.content ? b.content.slice(0, 140) : '',
      priority: b.priority,
      isPinned: b.is_pinned,
      author: b.teacher_name,
    }));

    // 8. Student Achievements & Distinctions (Role-isolated)
    const rawAwards = achievements.filter(
      (a) =>
        a.title !== '__USER_AVATAR__' &&
        a.title !== '__PARENT_DOC__' &&
        a.title !== '__LEAVE_REQUEST__' &&
        a.title !== '__GRADE_ASSESSMENT_TERM__' &&
        !String(a.title || '').startsWith('__')
    );

    const filteredAwards = role === 'student'
      ? rawAwards.filter((a) => a.student_id === user.id)
      : role === 'teacher'
      ? rawAwards.filter((a) => {
          const st = profiles.find((p) => p.id === a.student_id);
          if (!st) return false;
          const g = (st.grade || '').replace(/[^0-9]/g, '');
          const s = (st.class_letter || '').toUpperCase().trim();
          return g === uGrade && s === uSection;
        })
      : rawAwards;

    const recentAwards = filteredAwards.slice(0, 10).map((a) => {
      const st = profiles.find((p) => p.id === a.student_id);
      return {
        title: a.title,
        studentName: st ? st.name : user.name,
        studentGrade: st ? `Grade ${st.grade || ''}-${st.class_letter || ''}` : homeroomLabel,
        description: a.description,
      };
    });

    // 9. Leave Requests (Filtered to role & homeroom)
    const filteredLeaves = role === 'teacher'
      ? leaveRequests.filter((l) => {
          const st = profiles.find((p) => p.id === l.student_id);
          if (!st) return false;
          const g = (st.grade || '').replace(/[^0-9]/g, '');
          const s = (st.class_letter || '').toUpperCase().trim();
          return g === uGrade && s === uSection;
        })
      : role === 'admin'
      ? leaveRequests
      : leaveRequests.filter((l) => l.student_id === user.id);

    const recentLeaves = filteredLeaves
      .slice(0, 8)
      .map((l) => {
        const st = profiles.find((p) => p.id === l.student_id);
        return {
          studentName: st ? st.name : 'Student',
          studentGrade: st ? `Grade ${st.grade || ''}-${st.class_letter || ''}` : '',
          dates: `${l.startDate} → ${l.endDate}`,
          type: l.leaveType,
          reason: l.reason,
          status: l.status,
        };
      });

    return {
      currentUser: {
        name: user.name,
        role: user.role,
        email: user.email,
        subject: user.subject,
        grade: user.grade,
        classLetter: user.class_letter,
        homeroomLabel,
        code: user.admission_number || user.user_code,
      },
      homeroom: {
        label: homeroomLabel,
        totalEnrolled: homeroomStudentsList.length,
        students: homeroomStudentsList,
        myAttendance: role === 'student' ? {
          totalDays: studentTotalDays,
          presentDays: studentPresentDays,
          attendanceRate: `${studentAttendanceRate}%`,
        } : null,
        todayAttendance: {
          date: todayStr,
          presentCount,
          authorizedAbsences: authAbsentNames,
          unauthorizedAbsences: unauthAbsentNames,
        },
        leaveRequests: recentLeaves,
      },
      subjectClasses: userClasses,
      tests: activeTestsList,
      assignments: activeAssignmentsList,
      syllabus: syllabusTermsList,
      resources: recentResources,
      broadcasts: recentBroadcasts,
      awards: recentAwards,
    };
  }, [
    user,
    role,
    profiles,
    subjectClasses,
    tests,
    assignments,
    syllabus,
    attendance,
    classResources,
    classBroadcasts,
    achievements,
    leaveRequests,
    testResults,
    assignmentSubmissions,
  ]);

  const parseNavToken = (rawToken: string): { target: PortalNavigationTarget; label: string } | null => {
    let spec = '';
    let label = '';

    const bracketMatch = rawToken.match(/^\[\[\s*nav\s*:\s*([^|\]]+)(?:\|\s*([^\]]+))?\s*\]\]$/i);
    const mdMatch = rawToken.match(/^\[([^\]]+)\]\(\s*nav\s*:\s*([^)]+)\s*\)$/i);

    if (bracketMatch) {
      spec = bracketMatch[1].trim();
      label = (bracketMatch[2] || spec).trim().replace(/\s*\u2197$/, '');
    } else if (mdMatch) {
      label = mdMatch[1].trim().replace(/\s*\u2197$/, '');
      spec = mdMatch[2].trim();
    } else {
      return null;
    }

    const parts = spec.split(':').map((p) => p.trim());
    let target: PortalNavigationTarget = {};
    const type = parts[0]?.toLowerCase();

    if (type === 'class') {
      const sub = parts[1] || 'tasks';
      target = { view: 'class', subTab: sub };
    } else if (type === 'tasks' || type === 'assessments') {
      target = { view: 'class', subTab: 'tasks' };
    } else if (type === 'resources') {
      target = { view: 'class', subTab: 'resources' };
    } else if (type === 'syllabus') {
      target = { view: 'class', subTab: 'syllabus' };
    } else if (type === 'broadcasts') {
      target = { view: 'class', subTab: 'broadcasts' };
    } else if (type === 'marks') {
      target = { view: 'class', subTab: 'marks' };
    } else if (type === 'attendance') {
      target = { view: 'attendance' };
    } else if (type === 'awards' || type === 'achievements') {
      target = { view: 'awards' };
    } else if (type === 'hub' || type === 'activities') {
      target = { view: 'hub' };
    } else if (type === 'settings' || type === 'password') {
      target = { view: 'settings' };
    } else if (type === 'support' || type === 'helpdesk') {
      target = { view: 'support' };
    } else if (type === 'view') {
      const v = parts[1]?.toLowerCase();
      const sub = parts[2]?.toLowerCase();
      if (v === 'awards' || v === 'achievements') {
        target = { view: role === 'teacher' ? 'homeroom_awards' : 'awards' };
      } else if (v === 'attendance') {
        target = role === 'teacher' ? { view: 'homeroom_attendance', subTab: sub || 'mark' } : { view: 'attendance' };
      } else if (v === 'resources' || v === 'homeroom_resources') {
        target = { view: role === 'teacher' ? 'homeroom_resources' : 'class', subTab: 'resources' };
      } else if (v === 'tasks' || v === 'assessments') {
        target = { view: 'class', subTab: 'tasks' };
      } else if (v === 'syllabus') {
        target = { view: 'class', subTab: 'syllabus' };
      } else if (v === 'broadcasts' || v === 'notices') {
        target = { view: 'class', subTab: 'broadcasts' };
      } else if (v === 'hub' || v === 'activities') {
        target = { view: 'hub' };
      } else if (v === 'settings' || v === 'password') {
        target = { view: 'settings' };
      } else if (v === 'support' || v === 'helpdesk') {
        target = { view: 'support' };
      } else if (v === 'directory' || v === 'users') {
        target = { view: 'directory' };
      } else if (v === 'classes') {
        target = { view: 'classes' };
      } else if (v === 'documents' || v === 'clearance') {
        target = { view: 'documents' };
      } else if (v === 'progress') {
        target = { view: 'progress' };
      } else {
        target = { view: v };
      }
    } else if (type === 'modal') {
      const modal = parts[1]?.toLowerCase();
      if (modal === 'provision_user') target = { modalAction: 'provision_user' };
      else if (modal === 'bulk_import') target = { modalAction: 'bulk_import' };
      else if (modal === 'create_class') target = { modalAction: 'create_class' };
      else if (modal === 'create_test') target = { modalAction: 'create_test' };
      else if (modal === 'create_assignment') target = { modalAction: 'create_assignment' };
      else if (modal === 'add_achievement') target = { modalAction: 'add_achievement' };
    } else {
      target = { view: type };
    }

    return { target, label };
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text,
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: historyPayload,
          userRole: role,
          userName,
          model: 'gemini',
          portalContext,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          sender: 'assistant',
          text: data.reply || 'I am here to guide you with the Woodlem portal.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          thoughtTime: data.thoughtTime || '3.4s',
          thoughtProcess: data.thoughtProcess || 'Analyzed live LMS ground truth, verified permissions, and linked portal destinations.',
          sourcesCount: data.sourcesCount || 6,
          model: data.model || 'Gemini 2.5 Flash',
        };
        setMessages((prev) => [...prev, aiMsg]);
      } else {
        throw new Error('API request failed');
      }
    } catch {
      // Local intelligent response with portal grounding
      const fallbackReply = isGuest
        ? `I can help you sign in or tell you about Woodlem Park School.\n\n- **To Log In**: Select your role tab (Student, Teacher, Admin, or Parent) at the top of the login card and enter your registered email/admission number and password.\n- **Default Password**: Newly provisioned accounts use **\`woodlem123\`**.\n- **IT Helpdesk**: For login support, email \`it-helpdesk@woodlempark.ae\`.`
        : `I can guide you across your subject classes, homeroom attendance, assignments, and account settings.\n\n[[nav:class:tasks|Tasks & Assessments ↗]] [[nav:class:resources|Learning Resources ↗]] [[nav:view:settings|Settings & Passwords ↗]]`;
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          sender: 'assistant',
          text: fallbackReply,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          thoughtTime: '1.2s',
          thoughtProcess: 'Used offline Woodpecker knowledge graph fallback.',
          sourcesCount: 4,
          model: 'Woodpecker Neural Core',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyText = (id: string, text: string) => {
    const cleanText = text.replace(/\[\[\s*nav\s*:[^|\]]+(?:\|([^\]]+))?\s*\]\]/gi, '$1').replace(/\[([^\]]+)\]\(nav:[^)]+\)/gi, '$1');
    navigator.clipboard.writeText(cleanText);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggleThought = (id: string) => {
    setExpandedThoughtIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };



  const renderBrandWord = (text: string) => {
    return text;
  };

  const renderFormattedText = (rawText: string) => {
    return rawText.split('\n').map((line, lineIdx) => {
      const trimmed = line.trim();
      if (!trimmed) return <div key={lineIdx} style={{ height: 6 }} />;
      const navTokenRegex = /(\[\[\s*nav\s*:[^\]]+\]\]|\[[^\]]+\]\(\s*nav\s*:[^)]+\))/gi;
      const parts = line.split(navTokenRegex);
      const isNumbered = /^\d+\.\s/.test(trimmed);
      const isBullet = /^[-*\u2022]\s/.test(trimmed);

      const renderParts = parts.map((part, pIdx) => {
        if (
          (part.startsWith('[[') && part.endsWith(']]') && part.includes('nav:')) ||
          (part.startsWith('[') && part.includes('](nav:'))
        ) {
          const navParsed = parseNavToken(part);
          if (navParsed) {
            return (
              <button
                key={pIdx}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  navigateTo(navParsed.target);
                  if (typeof window !== 'undefined' && window.innerWidth <= 1024) {
                    setIsAiPanelOpen(false);
                  }
                }}
                className="woodlem-ai-nav-pill"
                title={`Jump to ${navParsed.label}`}
              >
                <span>{navParsed.label}</span>
                <ArrowUpRight size={11} style={{ flexShrink: 0 }} />
              </button>
            );
          }
        }
        return part.split(/(\*\*.*?\*\*)/g).map((subPart, sIdx) => {
          if (subPart.startsWith('**') && subPart.endsWith('**')) {
            const inner = subPart.slice(2, -2);
            return (
              <strong key={`${pIdx}-${sIdx}`} style={{ fontWeight: 650, color: '#0F172A' }}>
                {renderBrandWord(inner)}
              </strong>
            );
          }
          return renderBrandWord(subPart);
        });
      });

      if (isNumbered || isBullet)
        return (
          <div key={lineIdx} className="woodlem-ai-list-item">
            {renderParts}
          </div>
        );
      return (
        <p key={lineIdx} style={{ margin: '4px 0', lineHeight: 1.65 }}>
          {renderParts}
        </p>
      );
    });
  };

  if (!isMounted) return null;

  return (
    <>
      {/* DOCKED / PUSH SIDE PANEL (SLIDES SMOOTHLY FROM THE RIGHT EDGE) */}
      <div
        className="woodlem-ai-side-dock"
        style={isMobile ? {
          position: 'fixed',
          inset: isAiPanelOpen ? 0 : undefined,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: isAiPanelOpen ? '100vw' : 0,
          height: isAiPanelOpen ? '100dvh' : 0,
          overflow: 'hidden',
          zIndex: 9999,
          background: 'rgba(255, 255, 255, 0.98)',
          display: 'flex',
          flexDirection: 'column',
          opacity: isAiPanelOpen ? 1 : 0,
          pointerEvents: isAiPanelOpen ? 'auto' : 'none',
          transition: 'opacity 0.25s ease',
        } : {
          width: isAiPanelOpen ? 400 : 0,
          minWidth: isAiPanelOpen ? 400 : 0,
          height: '100%',
          overflow: 'hidden',
          flexShrink: 0,
          transition: 'width 0.32s cubic-bezier(0.16, 1, 0.3, 1), min-width 0.32s cubic-bezier(0.16, 1, 0.3, 1)',
          borderLeft: isAiPanelOpen ? '1px solid rgba(226, 232, 240, 0.9)' : 'none',
          background: 'rgba(255, 255, 255, 0.96)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 40,
          boxShadow: isAiPanelOpen ? '-12px 0 36px rgba(15, 23, 42, 0.08)' : 'none',
        }}
      >
        <div
          className="woodlem-ai-dock-shell"
          style={{
            width: isMobile ? '100%' : 400,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            opacity: isAiPanelOpen ? 1 : 0,
            transition: 'opacity 0.22s ease',
            pointerEvents: isAiPanelOpen ? 'auto' : 'none',
          }}
        >
          {/* CLEAN MINIMAL HEADER */}
          <div className="woodlem-ai-header">
            <span className="woodpecker-header-title">
              Woodpecker
            </span>

            <div className="woodlem-ai-header-actions">
              <button
                type="button"
                onClick={clearChatHistory}
                className="woodlem-ai-icon-btn"
                title="Reset conversation"
              >
                <RotateCcw size={13} />
              </button>
              <button
                type="button"
                onClick={() => setIsAiPanelOpen(false)}
                className="woodlem-ai-icon-btn woodlem-ai-close-btn"
                title="Close AI Assistant (Esc)"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* NAV NOTIFICATION TOAST */}
          {activeNavNotification && (
            <div className="woodlem-ai-toast">
              <span className="woodlem-ai-toast-dot" />
              <span>{activeNavNotification}</span>
            </div>
          )}

          {/* MESSAGES SCROLL AREA */}
          <div className="woodlem-ai-messages-flow">
            {messages.length <= 1 && !isLoading && (
              <div className="woodlem-ai-welcome-hero">
                <div className="woodlem-ai-welcome-orb-container">
                  <AnimatedOrb size={84} />
                </div>
                <h3 className="woodlem-ai-welcome-title">
                  {isGuest ? 'Welcome to Woodlem Park School' : 'How can I help you today?'}
                </h3>
                <p className="woodlem-ai-welcome-desc">
                  {isGuest
                    ? "I can help you sign in, troubleshoot credentials, or introduce you to Woodlem's CBSE programs and digital LMS."
                    : 'Ask me anything about your Woodlem portal. I am Woodpecker, your AI assistant.'}
                </p>

                {/* INTERACTIVE STARTER SUGGESTIONS */}
                <div className="woodlem-ai-suggestions-grid">
                  {isGuest ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleSendMessage('What is Woodlem Park School and what does it offer?')}
                        className="woodlem-ai-suggestion-btn"
                      >
                        <span className="woodlem-ai-sugg-icon">🎓</span>
                        <span>What is Woodlem Park School?</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendMessage('How do I log in to my school account?')}
                        className="woodlem-ai-suggestion-btn"
                      >
                        <span className="woodlem-ai-sugg-icon">🔑</span>
                        <span>How do I log in to my account?</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendMessage('I forgot my password or need help signing in')}
                        className="woodlem-ai-suggestion-btn"
                      >
                        <span className="woodlem-ai-sugg-icon">❓</span>
                        <span>Forgot password or login help</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendMessage('What features does this LMS portal offer?')}
                        className="woodlem-ai-suggestion-btn"
                      >
                        <span className="woodlem-ai-sugg-icon">🌟</span>
                        <span>What features does this portal offer?</span>
                      </button>
                    </>
                  ) : role === 'student' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleSendMessage('What homework assignments or tasks are due?')}
                        className="woodlem-ai-suggestion-btn"
                      >
                        <span className="woodlem-ai-sugg-icon">📚</span>
                        <span>Show my pending assignments</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendMessage('Do I have any upcoming tests scheduled?')}
                        className="woodlem-ai-suggestion-btn"
                      >
                        <span className="woodlem-ai-sugg-icon">📝</span>
                        <span>Check upcoming tests</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendMessage('Show my syllabus coverage checklist')}
                        className="woodlem-ai-suggestion-btn"
                      >
                        <span className="woodlem-ai-sugg-icon">📊</span>
                        <span>View syllabus coverage</span>
                      </button>
                    </>
                  ) : role === 'teacher' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleSendMessage('Who is absent today in my homeroom?')}
                        className="woodlem-ai-suggestion-btn"
                      >
                        <span className="woodlem-ai-sugg-icon">📋</span>
                        <span>Check homeroom attendance</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendMessage('How do I publish a new assessment for my class?')}
                        className="woodlem-ai-suggestion-btn"
                      >
                        <span className="woodlem-ai-sugg-icon">📝</span>
                        <span>Publish a test or assessment</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendMessage('Who is enrolled in my homeroom?')}
                        className="woodlem-ai-suggestion-btn"
                      >
                        <span className="woodlem-ai-sugg-icon">👥</span>
                        <span>View homeroom students list</span>
                      </button>
                    </>
                  ) : role === 'admin' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleSendMessage('How do I provision a new student or teacher?')}
                        className="woodlem-ai-suggestion-btn"
                      >
                        <span className="woodlem-ai-sugg-icon">👥</span>
                        <span>How to provision a new user</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendMessage('How can I reset student passwords?')}
                        className="woodlem-ai-suggestion-btn"
                      >
                        <span className="woodlem-ai-sugg-icon">🔑</span>
                        <span>Password management & resets</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handleSendMessage("How can I check my child's academic progress and attendance?")}
                        className="woodlem-ai-suggestion-btn"
                      >
                        <span className="woodlem-ai-sugg-icon">📈</span>
                        <span>Check child academic progress</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendMessage('How do I submit clearance documents?')}
                        className="woodlem-ai-suggestion-btn"
                      >
                        <span className="woodlem-ai-sugg-icon">📄</span>
                        <span>Submit clearance documents</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {messages.map((m) => {
              const isAssistant = m.sender === 'assistant';
              const isThoughtOpen = !!expandedThoughtIds[m.id];

              if (!isAssistant) {
                // USER MESSAGE BUBBLE (Image 1 sleek dark capsule)
                return (
                  <div key={m.id} className="woodlem-ai-user-row">
                    <div className="woodlem-ai-user-bubble">
                      {m.text}
                    </div>
                  </div>
                );
              }

              // ASSISTANT MESSAGE (Image 1 aesthetic with Thought Accordion, Sources, Clean Typography & Actions)
              return (
                <div key={m.id} className="woodlem-ai-assistant-card">


                  {/* ASSISTANT RESPONSE BODY */}
                  <div className="woodlem-ai-assistant-body">
                    <div className="woodlem-ai-star-col">
                      <Sparkles size={16} className="woodlem-ai-star-icon" />
                    </div>
                    <div className="woodlem-ai-response-content">
                      {renderFormattedText(m.text)}
                    </div>
                  </div>

                  {/* RESPONSE ACTION FOOTER (Image 1 Toolbar) */}
                  <div className="woodlem-ai-action-toolbar">
                    <button
                      type="button"
                      onClick={() => handleCopyText(m.id, m.text)}
                      className="woodlem-ai-action-btn"
                      title="Copy response"
                    >
                      {copiedId === m.id ? (
                        <>
                          <Check size={12} style={{ color: '#10B981' }} />
                          <span style={{ color: '#10B981', fontSize: 11, fontWeight: 600 }}>Copied</span>
                        </>
                      ) : (
                        <Copy size={12} />
                      )}
                    </button>


                  </div>
                </div>
              );
            })}

            {/* LOADING STATE INDICATOR */}
            {isLoading && (
              <div className="woodlem-ai-loading-card">

                <div className="woodlem-ai-assistant-body">
                  <div className="woodlem-ai-star-col">
                    <Sparkles size={16} className="woodlem-ai-star-icon" />
                  </div>
                  <div className="woodlem-ai-shimmer-lines">
                    <div className="woodlem-ai-shimmer-line woodlem-ai-shimmer-1" />
                    <div className="woodlem-ai-shimmer-line woodlem-ai-shimmer-2" />
                    <div className="woodlem-ai-shimmer-line woodlem-ai-shimmer-3" />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* FLOATING COMPOSER WITH ANIMATED GLOWING BORDER (Image 3 & Image 1) */}
          <div className="woodlem-ai-composer-wrapper">
            {/* AMBIENT RADIAL GLOW BACKLIGHTS (Image 3) */}
            <div className={`woodlem-ai-ambient-glow-peach ${isInputFocused ? 'woodlem-ai-glow-active' : ''}`} />
            <div className={`woodlem-ai-ambient-glow-cyan ${isInputFocused ? 'woodlem-ai-glow-active' : ''}`} />

            {/* ANIMATED GRADIENT BORDER CONTAINER */}
            <div className={`woodlem-ai-glowing-border-box ${isInputFocused ? 'woodlem-ai-focused-box' : ''}`}>
              <div className="woodlem-ai-composer-inner">
                {/* TEXT INPUT AREA */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="woodlem-ai-composer-form"
                >
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder={isGuest ? "Ask about logging in or Woodlem..." : "Ask anything..."}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onFocus={() => setIsInputFocused(true)}
                    onBlur={() => setIsInputFocused(false)}
                    disabled={isLoading}
                    className="woodlem-ai-main-input"
                  />

                  {/* BOTTOM TOOLBAR ROW (Image 1 & 3: Model Pill + Attach + Send) */}
                  <div className="woodlem-ai-composer-bottom-bar">
                    <div className="woodlem-ai-bottom-left-controls">
                      {/* MODEL SELECTOR PILL (Image 1 style) */}


                      {/* ATTACHMENT / CONTEXT BUTTONS (Image 3) */}
                      <button
                        type="button"
                        onClick={() => handleSendMessage('Summarize my current active subject tasks and schedule')}
                        className="woodlem-ai-composer-icon-btn"
                        title="Attach active page context"
                      >
                        <Paperclip size={13} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSendMessage('Give me a quick portal checklist for today')}
                        className="woodlem-ai-composer-icon-btn"
                        title="Add prompt preset"
                      >
                        <Plus size={13} />
                      </button>
                    </div>

                    {/* SEND BUTTON */}
                    <button
                      type="submit"
                      disabled={!inputMessage.trim() || isLoading}
                      className={`woodlem-ai-send-btn ${inputMessage.trim() && !isLoading ? 'woodlem-ai-send-btn-active' : ''}`}
                      title="Send message (Enter)"
                    >
                      <Send size={13} />
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FLOATING TRIGGER LAUNCHER WITH 3D ORB (DRAGGABLE TO ANY CORNER) */}
      {!isAiPanelOpen && orbPosition && (
        <div
          onMouseDown={handleOrbPointerDown}
          onTouchStart={handleOrbPointerDown}
          onClick={handleOrbClick}
          onMouseEnter={() => !isDraggingOrb && setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className={`woodlem-ai-floating-launcher ${isDraggingOrb ? 'woodlem-ai-launcher-dragging' : ''}`}
          style={{
            position: 'fixed',
            left: `${orbPosition.x}px`,
            top: `${orbPosition.y}px`,
            bottom: 'auto',
            right: 'auto',
            transform: isDraggingOrb ? 'scale(1.14)' : undefined,
            transition: isDraggingOrb ? 'none' : 'all 0.38s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            cursor: isDraggingOrb ? 'grabbing' : 'grab',
            touchAction: 'none',
            userSelect: 'none',
          }}
          title="Drag to any corner or click to open Woodpecker (⌘K)"
        >
          {/* ANIMATED CHROMATIC GLOW RING */}
          <div className="woodlem-ai-launcher-glow-ring" />

          {/* 3D IRIDESCENT FLUID VIDEO ORB AVATAR */}
          <AnimatedOrb size={52} />

          {/* HOVER TOOLTIP */}
          {isHovered && !isDraggingOrb && (
            <div
              className="woodlem-ai-launcher-tooltip"
              style={{
                left: orbPosition.x < (typeof window !== 'undefined' ? window.innerWidth / 2 : 500) ? 'calc(100% + 14px)' : 'auto',
                right: orbPosition.x < (typeof window !== 'undefined' ? window.innerWidth / 2 : 500) ? 'auto' : 'calc(100% + 14px)',
                top: '50%',
                transform: 'translateY(-50%)',
              }}
            >
              <Sparkles size={11} style={{ color: '#A78BFA' }} />
              <span>Ask Woodpecker</span>
              <kbd className="woodlem-ai-kbd">⌘K</kbd>
            </div>
          )}
        </div>
      )}

      {/* STYLES FOR FROSTED GLASS, ANIMATED BORDERS, AMBIENT GLOW, AND ORB ANIMATIONS */}
      <style jsx global>{`
        /* =========================================================================
           3D ORB AVATAR EFFECTS (VIDEO-POWERED)
           ========================================================================= */
        .woodlem-animated-orb-container {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .woodlem-orb-ambient-bloom {
          position: absolute;
          inset: -6px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(139, 92, 246, 0.45) 0%, rgba(56, 189, 248, 0.35) 50%, transparent 75%);
          filter: blur(8px);
          z-index: 0;
          animation: orbBloomPulse 4s ease-in-out infinite alternate;
          pointer-events: none;
        }

        .woodlem-orb-sheen-ring {
          position: absolute;
          inset: -3px;
          border-radius: 50%;
          background: linear-gradient(135deg, rgba(244, 114, 182, 0.6), rgba(129, 140, 248, 0.65), rgba(56, 189, 248, 0.6));
          filter: blur(4px);
          z-index: 1;
          animation: orbRingRotate 4s linear infinite;
          pointer-events: none;
        }

        /* =========================================================================
           WOODLEM AI SIDE DOCK DESIGN
           ========================================================================= */
        .woodpecker-brand-font {
          font-family: 'Caacupe One', 'Outfit', 'Plus Jakarta Sans', system-ui, sans-serif !important;
          letter-spacing: 0.5px;
        }

        /* Header */
        .woodlem-ai-header {
          padding: 18px 20px 14px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(241, 245, 249, 0.9);
          flex-shrink: 0;
          background: rgba(255, 255, 255, 0.85);
        }

        .woodlem-ai-title {
          font-size: 16px;
          font-weight: 700;
          color: #0F172A;
          letter-spacing: -0.02em;
          font-family: inherit;
        }

        .woodlem-ai-header-actions {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .woodlem-ai-icon-btn {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          border: 1px solid rgba(226, 232, 240, 0.85);
          background: #FFFFFF;
          color: #64748B;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .woodlem-ai-icon-btn:hover {
          background: #F8FAFC;
          color: #0F172A;
          border-color: #CBD5E1;
        }

        .woodlem-ai-close-btn:hover {
          background: #FEF2F2;
          border-color: #FECACA;
          color: #EF4444;
        }

        /* Navigation notification toast */
        .woodlem-ai-toast {
          padding: 7px 18px;
          background: #ECFDF5;
          border-bottom: 1px solid #A7F3D0;
          color: #047857;
          font-size: 11.5px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
          animation: aiSlideDown 0.2s ease-out;
        }

        .woodlem-ai-toast-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #10B981;
          box-shadow: 0 0 6px #10B981;
        }

        /* Messages Flow */
        .woodlem-ai-messages-flow {
          flex: 1;
          padding: 20px 18px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 16px;
          scroll-behavior: smooth;
        }

        /* Welcome hero */
        .woodlem-ai-welcome-hero {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 28px 14px 16px;
          animation: aiFadeIn 0.4s ease-out;
        }

        .woodlem-ai-welcome-orb-container {
          position: relative;
          margin-bottom: 14px;
        }

        .woodlem-ai-welcome-title {
          font-size: 16px;
          font-weight: 700;
          color: #0F172A;
          margin: 0 0 6px;
          letter-spacing: -0.01em;
        }

        .woodlem-ai-welcome-desc {
          font-size: 12.5px;
          color: #64748B;
          line-height: 1.55;
          margin: 0;
          max-width: 320px;
        }

        /* Suggestion Chips Grid */
        .woodlem-ai-suggestions-grid {
          display: flex;
          flex-direction: column;
          gap: 7px;
          width: 100%;
          max-width: 340px;
          margin-top: 18px;
        }

        .woodlem-ai-suggestion-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 12px;
          background: #FFFFFF;
          border: 1px solid rgba(226, 232, 240, 0.9);
          border-radius: 12px;
          color: #1E293B;
          font-size: 12px;
          font-weight: 500;
          text-align: left;
          cursor: pointer;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
          transition: all 0.16s ease;
          user-select: none;
        }

        .woodlem-ai-suggestion-btn:hover {
          background: #F8FAFC;
          border-color: #CBD5E1;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
          color: #0F172A;
        }

        .woodlem-ai-sugg-icon {
          font-size: 14px;
          flex-shrink: 0;
        }

        /* User Message Bubble (Image 1 sleek dark capsule) */
        .woodlem-ai-user-row {
          display: flex;
          justify-content: flex-end;
          animation: aiSlideUp 0.25s ease-out;
        }

        .woodlem-ai-user-bubble {
          max-width: 84%;
          background: #18181B;
          color: #FFFFFF;
          padding: 10px 18px;
          border-radius: 20px;
          font-size: 13px;
          line-height: 1.5;
          font-weight: 450;
          letter-spacing: -0.005em;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
          word-break: break-word;
        }

        /* Assistant Card (Image 1) */
        .woodlem-ai-assistant-card {
          display: flex;
          flex-direction: column;
          gap: 10px;
          animation: aiSlideUp 0.25s ease-out;
        }

        /* Thought accordion (Image 1) */
        .woodlem-ai-thought-container {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .woodlem-ai-thought-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 12px;
          background: rgba(241, 245, 249, 0.85);
          border: 1px solid rgba(226, 232, 240, 0.9);
          font-size: 11.5px;
          color: #475569;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .woodlem-ai-thought-pill:hover {
          background: #E2E8F0;
          color: #0F172A;
        }

        .woodlem-ai-thought-pulsing {
          background: rgba(238, 242, 255, 0.95);
          border-color: #C7D2FE;
          color: #6366F1;
          animation: pulse 1.5s infinite;
        }

        .woodlem-ai-thought-bulb {
          color: #F59E0B;
        }

        .woodlem-ai-thought-label {
          font-weight: 500;
        }

        .woodlem-ai-thought-chevron {
          transition: transform 0.2s ease;
          color: #94A3B8;
        }

        .woodlem-ai-thought-chevron-open {
          transform: rotate(90deg);
        }

        /* Source badges */
        .woodlem-ai-source-badges {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 3px 8px;
          border-radius: 10px;
          background: rgba(248, 250, 252, 0.9);
          border: 1px solid rgba(226, 232, 240, 0.8);
        }

        .woodlem-ai-source-orbs {
          display: flex;
          align-items: center;
          margin-left: 2px;
        }

        .woodlem-ai-src-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          border: 1px solid #FFFFFF;
          margin-left: -3px;
        }

        .woodlem-ai-src-1 { background: #6366F1; }
        .woodlem-ai-src-2 { background: #A855F7; }
        .woodlem-ai-src-3 { background: #3B82F6; }

        .woodlem-ai-source-count {
          font-size: 11px;
          color: #64748B;
          font-weight: 500;
        }

        /* Expanded thought panel */
        .woodlem-ai-thought-expanded {
          padding: 10px 14px;
          border-radius: 12px;
          background: rgba(248, 250, 252, 0.9);
          border: 1px dashed rgba(203, 213, 225, 0.9);
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 11.5px;
          color: #475569;
          animation: aiFadeIn 0.2s ease-out;
        }

        .woodlem-ai-thought-step {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          line-height: 1.45;
        }

        .woodlem-ai-thought-step-num {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #E2E8F0;
          color: #334155;
          font-size: 10px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          margin-top: 1px;
        }

        /* Assistant Body */
        .woodlem-ai-assistant-body {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .woodlem-ai-star-col {
          margin-top: 3px;
          flex-shrink: 0;
        }

        .woodlem-ai-star-icon {
          color: #1E293B;
        }

        .woodlem-ai-response-content {
          flex: 1;
          font-size: 13.5px;
          line-height: 1.68;
          color: #1E293B;
        }

        .woodlem-ai-list-item {
          padding-left: 18px;
          text-indent: -18px;
          margin: 4px 0;
          line-height: 1.65;
        }

        /* Navigation token pill */
        .woodlem-ai-nav-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin: 4px 6px 4px 0;
          padding: 5px 12px;
          border-radius: 8px;
          background: #ECFDF5;
          border: 1px solid #A7F3D0;
          color: #047857;
          font-size: 11.5px;
          font-weight: 650;
          cursor: pointer;
          transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
          vertical-align: middle;
          box-shadow: 0 1px 2px rgba(4, 120, 87, 0.06);
          user-select: none;
        }

        .woodlem-ai-nav-pill:hover {
          background: #047857;
          color: #FFFFFF;
          border-color: #047857;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(4, 120, 87, 0.28);
        }

        .woodlem-ai-nav-pill:active {
          transform: translateY(0px) scale(0.98);
        }

        /* Action Toolbar below assistant response (Image 1) */
        .woodlem-ai-action-toolbar {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-left: 28px;
          padding-top: 2px;
        }

        .woodlem-ai-action-btn {
          width: 26px;
          height: 26px;
          border-radius: 6px;
          border: 1px solid transparent;
          background: transparent;
          color: #94A3B8;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
          padding: 0 4px;
          gap: 4px;
        }

        .woodlem-ai-action-btn:hover {
          background: rgba(241, 245, 249, 0.85);
          color: #334155;
          border-color: #E2E8F0;
        }

        .woodlem-ai-reacted {
          color: #EF4444;
          background: #FEF2F2;
          border-color: #FECACA;
        }

        .woodlem-ai-toolbar-divider {
          width: 1px;
          height: 14px;
          background: #E2E8F0;
          margin: 0 4px;
        }

        .woodlem-ai-personalize-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 8px;
          border-radius: 6px;
          background: transparent;
          border: 1px solid transparent;
          color: #64748B;
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .woodlem-ai-personalize-pill:hover {
          background: rgba(241, 245, 249, 0.95);
          border-color: #E2E8F0;
          color: #0F172A;
        }

        /* Loading skeleton */
        .woodlem-ai-loading-card {
          display: flex;
          flex-direction: column;
          gap: 8px;
          animation: aiFadeIn 0.3s ease-out;
        }

        .woodlem-ai-shimmer-lines {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding-top: 4px;
        }

        .woodlem-ai-shimmer-line {
          height: 12px;
          border-radius: 6px;
          background: linear-gradient(90deg, #F1F5F9 0%, #E2E8F0 50%, #F1F5F9 100%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite linear;
        }

        .woodlem-ai-shimmer-1 { width: 90%; }
        .woodlem-ai-shimmer-2 { width: 70%; }
        .woodlem-ai-shimmer-3 { width: 45%; }

        /* =========================================================================
           ANIMATED GLOWING BORDER COMPOSER (IMAGE 3 & IMAGE 1)
           ========================================================================= */
        .woodlem-ai-composer-wrapper {
          position: relative;
          padding: 12px 16px 16px 16px;
          flex-shrink: 0;
          background: rgba(255, 255, 255, 0.75);
          border-top: 1px solid rgba(241, 245, 249, 0.9);
        }

        /* Dual Ambient Radial Glow Backlights (Image 3) */
        .woodlem-ai-ambient-glow-peach {
          position: absolute;
          top: -14px;
          left: 8%;
          width: 140px;
          height: 70px;
          background: radial-gradient(circle, rgba(251, 146, 60, 0.32) 0%, rgba(244, 114, 182, 0.16) 50%, transparent 80%);
          filter: blur(24px);
          pointer-events: none;
          z-index: 0;
          opacity: 0.65;
          transition: all 0.3s ease;
        }

        .woodlem-ai-ambient-glow-cyan {
          position: absolute;
          bottom: 2px;
          right: 8%;
          width: 150px;
          height: 70px;
          background: radial-gradient(circle, rgba(56, 189, 248, 0.38) 0%, rgba(99, 102, 241, 0.2) 50%, transparent 80%);
          filter: blur(24px);
          pointer-events: none;
          z-index: 0;
          opacity: 0.65;
          transition: all 0.3s ease;
        }

        .woodlem-ai-glow-active {
          opacity: 1 !important;
          transform: scale(1.15);
        }

        /* Animated Glowing Iridescent Border Box (Image 3) */
        .woodlem-ai-glowing-border-box {
          position: relative;
          z-index: 1;
          border-radius: 18px;
          padding: 1.8px;
          background: linear-gradient(
            135deg,
            #FDA4AF 0%,
            #FDBA74 20%,
            #C084FC 45%,
            #60A5FA 70%,
            #38BDF8 88%,
            #FDA4AF 100%
          );
          background-size: 300% 300%;
          animation: borderGlowShimmer 6s ease infinite;
          box-shadow: 0 4px 18px -2px rgba(139, 92, 246, 0.14);
          transition: box-shadow 0.25s ease, transform 0.2s ease;
        }

        .woodlem-ai-glowing-border-box.woodlem-ai-focused-box {
          animation: borderGlowShimmer 2.8s linear infinite;
          box-shadow: 
            0 8px 28px -4px rgba(139, 92, 246, 0.3),
            0 0 16px rgba(56, 189, 248, 0.35);
          transform: translateY(-1px);
        }

        .woodlem-ai-composer-inner {
          border-radius: 16.2px;
          background: #FFFFFF;
          overflow: hidden;
        }

        .woodlem-ai-composer-form {
          display: flex;
          flex-direction: column;
          padding: 10px 14px 10px 14px;
          background: #FFFFFF;
        }

        .woodlem-ai-main-input {
          width: 100%;
          border: none;
          outline: none;
          background: transparent;
          font-size: 13.5px;
          color: #0F172A;
          padding: 3px 0 8px 0;
          font-family: inherit;
          font-weight: 450;
        }

        .woodlem-ai-main-input::placeholder {
          color: #94A3B8;
        }

        .woodlem-ai-composer-bottom-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 3px;
        }

        .woodlem-ai-bottom-left-controls {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        /* Model Selector Pill (Image 1 style: ✳️ Opus 4.5 | +) */
        .woodlem-ai-model-selector-wrap {
          position: relative;
        }

        .woodlem-ai-model-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 8px;
          border-radius: 12px;
          background: #F8FAFC;
          border: 1px solid #E2E8F0;
          font-size: 11px;
          font-weight: 600;
          color: #334155;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .woodlem-ai-model-pill:hover {
          background: #F1F5F9;
          border-color: #CBD5E1;
          color: #0F172A;
        }

        .woodlem-ai-model-dropdown {
          position: absolute;
          bottom: calc(100% + 8px);
          left: 0;
          width: 220px;
          background: #FFFFFF;
          border-radius: 14px;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.14), 0 0 0 1px rgba(226, 232, 240, 0.9);
          padding: 6px;
          z-index: 100;
          animation: aiSlideUp 0.15s ease-out;
        }

        .woodlem-ai-dropdown-title {
          font-size: 10px;
          font-weight: 700;
          color: #94A3B8;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 6px 8px 4px;
        }

        .woodlem-ai-dropdown-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 8px;
          border-radius: 8px;
          border: none;
          background: transparent;
          text-align: left;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .woodlem-ai-dropdown-item:hover {
          background: #F8FAFC;
        }

        .woodlem-ai-dropdown-item-active {
          background: #F1F5F9;
        }

        .woodlem-ai-item-title {
          font-size: 12px;
          font-weight: 600;
          color: #0F172A;
        }

        .woodlem-ai-item-sub {
          font-size: 10px;
          color: #64748B;
        }

        .woodlem-ai-composer-icon-btn {
          width: 24px;
          height: 24px;
          border-radius: 6px;
          border: 1px solid #E2E8F0;
          background: #F8FAFC;
          color: #64748B;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .woodlem-ai-composer-icon-btn:hover {
          background: #E2E8F0;
          color: #0F172A;
        }

        /* Send button */
        .woodlem-ai-send-btn {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          border: none;
          background: #F1F5F9;
          color: #94A3B8;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: default;
          transition: all 0.2s ease;
        }

        .woodlem-ai-send-btn-active {
          background: linear-gradient(135deg, #18181B 0%, #334155 100%);
          color: #FFFFFF;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }

        .woodlem-ai-send-btn-active:hover {
          transform: scale(1.06);
          background: #000000;
        }

        /* =========================================================================
           FLOATING TRIGGER LAUNCHER WITH 3D ORB (IMAGE 2 & VIDEO) - DRAGGABLE
           ========================================================================= */
        .woodlem-ai-floating-launcher {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: #FFFFFF;
          border: none;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: grab;
          z-index: 9990;
          box-shadow: 
            0 12px 32px rgba(139, 92, 246, 0.35),
            0 4px 12px rgba(0, 0, 0, 0.08),
            0 0 0 1.5px rgba(255, 255, 255, 0.9);
          user-select: none;
          -webkit-user-select: none;
          touch-action: none;
          animation: launcherEntrance 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .woodlem-ai-floating-launcher:hover {
          box-shadow: 
            0 18px 44px rgba(139, 92, 246, 0.45),
            0 6px 16px rgba(0, 0, 0, 0.12),
            0 0 0 2px rgba(255, 255, 255, 1);
        }

        .woodlem-ai-launcher-dragging {
          cursor: grabbing !important;
          box-shadow: 
            0 24px 56px rgba(139, 92, 246, 0.55),
            0 8px 24px rgba(0, 0, 0, 0.2),
            0 0 0 3px rgba(255, 255, 255, 1) !important;
        }

        .woodlem-ai-launcher-glow-ring {
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          background: linear-gradient(135deg, rgba(244, 114, 182, 0.6), rgba(129, 140, 248, 0.65), rgba(56, 189, 248, 0.6));
          filter: blur(5px);
          z-index: -1;
          animation: orbRingRotate 3.5s linear infinite;
        }

        .woodlem-orb-video-element {
          pointer-events: none !important;
          user-select: none !important;
          -webkit-user-select: none !important;
        }

        /* Hover Tooltip */
        .woodlem-ai-launcher-tooltip {
          position: absolute;
          right: calc(100% + 14px);
          top: 50%;
          transform: translateY(-50%);
          background: #18181B;
          color: #FFFFFF;
          padding: 6px 12px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
          pointer-events: none;
          animation: aiSlideLeft 0.18s ease-out;
        }

        .woodlem-ai-kbd {
          background: #27272A;
          color: #A1A1AA;
          padding: 1px 5px;
          border-radius: 4px;
          font-size: 10px;
          font-family: inherit;
          border: 1px solid #3F3F46;
        }

        /* =========================================================================
           KEYFRAME ANIMATIONS
           ========================================================================= */
        @keyframes borderGlowShimmer {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        @keyframes orbRingRotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes orbBloomPulse {
          0% { transform: scale(0.92); opacity: 0.5; }
          100% { transform: scale(1.1); opacity: 0.9; }
        }

        @keyframes aiSlideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes aiSlideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes aiSlideLeft {
          from { opacity: 0; transform: translateY(-50%) translateX(6px); }
          to { opacity: 1; transform: translateY(-50%) translateX(0); }
        }

        @keyframes aiFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes launcherEntrance {
          from { opacity: 0; transform: scale(0.6) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </>
  );
};
