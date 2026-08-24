'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Users, Award, BookOpen, UserCheck, MessageSquare, LayoutDashboard, Calendar, Settings, LifeBuoy, LogOut, Megaphone, FileText, Pin, PinOff, SlidersHorizontal, Check } from 'lucide-react';
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
} from '@/lib/supabaseClient';
import { CustomSelect } from '@/components/UI/CustomSelect';
import { ManageClassStudentsModal } from '../Modals/ManageClassStudentsModal';
import { ReviewTestResultsModal, TestResultRecord } from '../Modals/ReviewTestResultsModal';
import { GradeAssignmentModal, AssignmentSubmissionRecord } from '../Modals/GradeAssignmentModal';
import { ViewFileModal } from '../Modals/ViewFileModal';
import { EditSubjectClassModal } from '../Modals/EditSubjectClassModal';
import { SettingsView } from '@/components/Shared/SettingsView';
import { SupportView } from '@/components/Shared/SupportView';
import { usePortalNavigation } from '@/lib/PortalNavigationContext';
import { openFileInNewTab, downloadFile, formatShortFileName } from '@/lib/fileHelper';

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
  onOpenCreateHubActivityModal: () => void;
  onDeleteHubActivity: (id: string) => void;
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
  onOpenCreateHubActivityModal,
  onDeleteHubActivity,
  onRefreshData,
  onSignOut,
}) => {
  const [isManageStudentsOpen, setIsManageStudentsOpen] = useState(false);
  const [isEditClassModalOpen, setIsEditClassModalOpen] = useState(false);
  const sidebar = useSidebarState('auto-hide');
  const [selectedReviewTest, setSelectedReviewTest] = useState<TestItem | null>(null);
  const [selectedGradeAssignment, setSelectedGradeAssignment] = useState<AssignmentItem | null>(null);
  // Navigation mode: 'class' | 'homeroom_attendance' | 'homeroom_awards' | 'homeroom_resources' | 'hub' | 'settings' | 'support'
  const [activeNavMode, setActiveNavMode] = useState<'class' | 'homeroom_attendance' | 'homeroom_awards' | 'homeroom_resources' | 'hub' | 'settings' | 'support'>('class');

  // Sidebar profile photo (synced with Supabase cloud)
  const sidebarAvatarUrl = currentUser.avatar_url || null;

  // Sub-tabs inside a subject classroom: 'broadcasts' | 'resources' | 'tasks' | 'syllabus' | 'roster'
  const [classSubTab, setClassSubTab] = useState<'broadcasts' | 'resources' | 'tasks' | 'syllabus' | 'roster'>('broadcasts');

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

  // Filter co-curricular hub activities created/published by this teacher
  const myHubActivities = useMemo(() => {
    return hubActivities.filter((act) => {
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
      if (target.view === 'homeroom_awards' || target.view === 'awards') {
        setActiveNavMode('homeroom_awards');
      } else if (target.view === 'homeroom_attendance' || target.view === 'attendance') {
        setActiveNavMode('homeroom_attendance');
        if (target.subTab === 'mark') {
          setAttendanceViewMode('mark');
        } else if (target.subTab === 'history') {
          setAttendanceViewMode('history');
        }
      } else if (target.view === 'hub') {
        setActiveNavMode('hub');
      } else if (target.view === 'settings') {
        setActiveNavMode('settings');
      } else if (target.view === 'support') {
        setActiveNavMode('support');
      } else if (target.view === 'class') {
        setActiveNavMode('class');
        if (target.classId && teacherClasses.some((c) => c.id === target.classId)) {
          setSelectedClassId(target.classId);
        } else if (teacherClasses.length > 0 && (!selectedClassId || !teacherClasses.some((c) => c.id === selectedClassId))) {
          setSelectedClassId(teacherClasses[0].id);
        }
        if (target.subTab && ['broadcasts', 'resources', 'tasks', 'syllabus', 'roster'].includes(target.subTab)) {
          setClassSubTab(target.subTab as any);
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

  // Filter achievements
  const filteredAwards = achievements.filter((aw) => {
    const student = profiles.find((s) => s.id === aw.student_id);
    const sName = student ? student.name.toLowerCase() : '';
    const term = awardSearch.toLowerCase();
    return aw.title.toLowerCase().includes(term) || sName.includes(term);
  });

  return (
    <div className="app-viewport">
      {/* REDESIGNED SIDEBAR */}
      <aside
        className={`sidebar ${sidebar.isCollapsed ? 'collapsed' : ''} ${sidebar.isHovered && sidebar.sidebarMode === 'auto-hide' ? 'auto-hide-hovered' : ''}`}
        onMouseEnter={sidebar.handleMouseEnter}
        onMouseLeave={sidebar.handleMouseLeave}
        onDoubleClick={sidebar.togglePin}
      >
        {/* HEADER SECTION */}
        <div className="sidebar-header">
          <div className="sidebar-brand-row">
            <WoodlemLogo collapsed={sidebar.isCollapsed} />
          </div>          {/* REDESIGNED TEACHER INFORMATION SECTION */}
          <div
            className="sidebar-profile-box"
            title={`${currentUser.name} • ${currentUser.subject || 'Faculty'} • ${homeroomLabel}`}
          >
            <div className="sidebar-profile-avatar-slot">
              <div className="sidebar-profile-avatar avatar-teacher-themed">
                {currentUser.avatar_url ? (
                  <img src={currentUser.avatar_url} alt={currentUser.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  (currentUser.name || 'T').charAt(0).toUpperCase()
                )}
              </div>
            </div>

            <div className="profile-details-expanded">
              <div className="sidebar-profile-name">
                {currentUser.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span className="sidebar-profile-badge" style={{ background: '#FDF6EE', color: '#8A532B', borderColor: '#EBD4C1' }}>
                  {currentUser.subject || 'Faculty'}
                </span>
              </div>
              <div className="sidebar-profile-adm">
                {homeroomLabel} [Class Teacher]
              </div>
            </div>
          </div>
        </div>

        <nav className="nav-menu">
          {/* 1. HOMEROOM / CLASS TEACHER SECTION */}
          <div className="sidebar-tooltip-wrapper">
            <button
              className={`nav-item ${activeNavMode === 'homeroom_attendance' ? 'active' : ''}`}
              onClick={() => {
                setActiveNavMode('homeroom_attendance');
                sidebar.handleNavClick();
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                <UserCheck size={15} className="icon" style={{ color: activeNavMode === 'homeroom_attendance' ? '#2C6E6A' : 'var(--text-secondary)', flexShrink: 0 }} />
                <span className="sidebar-text" style={{ flex: 1 }}>Attendance &amp; Records</span>
                <span className="sidebar-text" style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: '#EAF3EF', color: '#2D6E5D' }}>
                  {homeroomLabel}
                </span>
              </div>
            </button>
            {sidebar.isCollapsed && (
              <div className="sidebar-tooltip">Attendance &amp; Records ({homeroomLabel})</div>
            )}
          </div>

          <div className="sidebar-tooltip-wrapper">
            <button
              className={`nav-item ${activeNavMode === 'homeroom_awards' ? 'active' : ''}`}
              onClick={() => {
                setActiveNavMode('homeroom_awards');
                sidebar.handleNavClick();
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                <Award size={15} className="icon" style={{ color: activeNavMode === 'homeroom_awards' ? '#2C6E6A' : 'var(--text-secondary)', flexShrink: 0 }} />
                <span className="sidebar-text" style={{ flex: 1 }}>Student Achievements</span>
                {achievements.length > 0 && (
                  <span className="sidebar-text" style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 5px', borderRadius: 10, background: '#FAF9F6', color: 'var(--text-secondary)' }}>
                    {achievements.length}
                  </span>
                )}
              </div>
            </button>
            {sidebar.isCollapsed && (
              <div className="sidebar-tooltip">Student Achievements</div>
            )}
          </div>

          <div className="sidebar-tooltip-wrapper">
            <button
              className={`nav-item ${activeNavMode === 'homeroom_resources' ? 'active' : ''}`}
              onClick={() => {
                setActiveNavMode('homeroom_resources');
                sidebar.handleNavClick();
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                <FileText size={15} className="icon" style={{ color: activeNavMode === 'homeroom_resources' ? '#2C6E6A' : 'var(--text-secondary)', flexShrink: 0 }} />
                <span className="sidebar-text" style={{ flex: 1 }}>Class Resources</span>
                {(homeroomResources.length + homeroomBroadcasts.length) > 0 && (
                  <span className="sidebar-text" style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 5px', borderRadius: 10, background: '#FAF9F6', color: 'var(--text-secondary)' }}>
                    {homeroomResources.length + homeroomBroadcasts.length}
                  </span>
                )}
              </div>
            </button>
            {sidebar.isCollapsed && (
              <div className="sidebar-tooltip">Class Resources & Circulars</div>
            )}
          </div>

          {/* 2. SUBJECT CLASSROOMS */}
          <div className="sidebar-nav-divider" />
          <div style={{ padding: '4px 4px' }}>
            <span className="nav-label" style={{ margin: 0 }}>
              Classrooms ({teacherClasses.length})
            </span>
          </div>

          {teacherClasses.length === 0 ? (
            <div className="sidebar-text" style={{ padding: '8px 8px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 11 }}>
              No subject classrooms created yet.
            </div>
          ) : (
            teacherClasses.map((cls) => {
              const isSelected = activeNavMode === 'class' && selectedClassId === cls.id;
              return (
                <div key={cls.id} className="sidebar-tooltip-wrapper">
                  <button
                    className={`nav-item ${isSelected ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedClassId(cls.id);
                      setActiveNavMode('class');
                      sidebar.handleNavClick();
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                      <BookOpen size={15} className="icon" style={{ color: isSelected ? '#2C6E6A' : 'var(--text-secondary)', flexShrink: 0 }} />
                      <div className="sidebar-text" style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: isSelected ? 700 : 600, color: isSelected ? 'var(--neutral-dark)' : 'inherit', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 12.5 }}>
                          {cls.name}
                        </div>
                        <div className="sidebar-classroom-sub">
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
              className={`nav-item ${activeNavMode === 'hub' ? 'active' : ''}`}
              onClick={() => {
                setActiveNavMode('hub');
                sidebar.handleNavClick();
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                <LayoutDashboard size={15} className="icon" style={{ color: activeNavMode === 'hub' ? '#7C5CBF' : 'var(--text-secondary)', flexShrink: 0 }} />
                <span className="sidebar-text" style={{ flex: 1 }}>My Activities</span>
                {myHubActivities.length > 0 && (
                  <span className="sidebar-text" style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 5px', borderRadius: 10, background: '#FAF9F6', color: 'var(--text-secondary)' }}>
                    {myHubActivities.length}
                  </span>
                )}
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
              className={`logout-btn-clean ${activeNavMode === 'settings' ? 'active' : ''}`}
              onClick={() => {
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
              className={`logout-btn-clean ${activeNavMode === 'support' ? 'active' : ''}`}
              onClick={() => {
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

        {/* DOUBLE CLICK MODE FEEDBACK TOAST */}
        {sidebar.feedbackToast && (
          <div className="sidebar-feedback-toast">
            {sidebar.feedbackToast}
          </div>
        )}
      </aside>

      {/* MAIN CONTENT VIEWPORT */}
      <main className="main-content">
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
                    <>
                      <button
                        onClick={() => setIsEditClassModalOpen(true)}
                        className="btn-secondary"
                        style={{ padding: '7px 12px', fontSize: 12 }}
                        title="Edit class details"
                      >
                        Edit Class
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete subject class "${activeClassObj.name}"?`)) {
                            onDeleteSubjectClass(activeClassObj.id);
                          }
                        }}
                        style={{
                          padding: '7px 12px',
                          fontSize: 12,
                          fontWeight: 600,
                          background: '#FDF1F0',
                          border: '1px solid #F5C6CB',
                          color: '#A83B38',
                          borderRadius: 6,
                          cursor: 'pointer',
                        }}
                      >
                        Delete
                      </button>
                    </>
                  )}
                  <button
                    className="btn-secondary"
                    onClick={onOpenCreateClassModal}
                    style={{ padding: '7px 12px', fontSize: 12 }}
                  >
                    + New Class
                  </button>
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
                        className="btn-primary"
                        onClick={() => onOpenCreateTestModal(`${activeClassObj.name} (${activeClassObj.class_name})`)}
                        style={{ padding: '7px 16px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}
                      >
                        <span>+ Create Class Test</span>
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
                  className={`tab-btn ${classSubTab === 'roster' ? 'active' : ''}`}
                  onClick={() => setClassSubTab('roster')}
                >
                  Students
                  <span className="tab-count">{classStudents.length}</span>
                </button>
              </div>
            </header>

            <div className="content-body" style={{ padding: '28px 32px' }}>
              {!activeClassObj ? (
                <div style={{ padding: '64px 24px', textAlign: 'center' }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 6px' }}>No Subject Class Selected</h3>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 400, margin: '0 auto' }}>
                    Select or create your subject classroom from the left sidebar to enroll students, upload study materials, and broadcast announcements.
                  </p>
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
                          style={{ padding: '8px 16px', fontSize: 12.5 }}
                        >
                          {isResourceFormExpanded ? '✕ Close Form' : '+ Upload New Resource'}
                        </button>
                      </div>

                      {/* INLINE RESOURCE UPLOAD FORM (Full-Page Card) */}
                      {isResourceFormExpanded && (
                        <div
                          style={{
                            background: '#FFFFFF',
                            border: '1.5px solid #2C6E6A',
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
                            className="form-input"
                            placeholder="Search resources by title, topic tag, or file name..."
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
                                        background: '#2C6E6A',
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

                  {/* SUBTAB 3: 📝 TASKS & ASSESSMENTS (Tests & Assignments) */}
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
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => onOpenCreateAssignmentModal(`${activeClassObj.name} (${activeClassObj.class_name})`)}
                              style={{ padding: '5px 12px', fontSize: 11.5 }}
                            >
                              + Homework
                            </button>
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={() => onOpenCreateTestModal(`${activeClassObj.name} (${activeClassObj.class_name})`)}
                              style={{ padding: '5px 14px', fontSize: 11.5 }}
                            >
                              + Create Class Test
                            </button>
                          </div>
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

                  {/* SUBTAB 4: 📖 SYLLABUS COVERAGE */}
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

                  {/* SUBTAB 5: 👥 STUDENT ROSTER (Full-Page Inline Management) */}
                  {classSubTab === 'roster' && (
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
                            Enrolled Student Roster ({classStudents.length} Students)
                          </h4>
                          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                            Students who have active access to this classroom, its broadcasts, resources, and assessments.
                          </p>
                        </div>

                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => setIsManageStudentsOpen(true)}
                          style={{ padding: '6px 14px', fontSize: 12 }}
                        >
                          ⚙️ Quick Manage Roster
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
                              onClick={() => setIsManageStudentsOpen(true)}
                              style={{ padding: '6px 14px', fontSize: 12 }}
                            >
                              + Enroll Students Now
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
        )}
        {/* VIEW 3.5: HOMEROOM CLASS RESOURCES & CIRCULARS */}
        {activeNavMode === 'homeroom_resources' && (
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
                <div style={{ display: 'flex', gap: 6, background: '#FAF9F6', padding: 4, borderRadius: 8, border: '1px solid #ECEAE5' }}>
                  <button
                    type="button"
                    onClick={() => setHrActiveTab('broadcasts')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 18px',
                      fontSize: 12.5,
                      fontWeight: hrActiveTab === 'broadcasts' ? 700 : 600,
                      borderRadius: 6,
                      border: 'none',
                      background: hrActiveTab === 'broadcasts' ? '#FFFFFF' : 'transparent',
                      color: hrActiveTab === 'broadcasts' ? '#2C6E6A' : 'var(--text-secondary)',
                      boxShadow: hrActiveTab === 'broadcasts' ? '0 2px 5px rgba(0,0,0,0.08)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <span>📢 Class Circulars &amp; Notices</span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        padding: '1px 7px',
                        borderRadius: 10,
                        background: hrActiveTab === 'broadcasts' ? '#EAF3EF' : '#ECEAE5',
                        color: hrActiveTab === 'broadcasts' ? '#2D6E5D' : 'var(--text-secondary)',
                      }}
                    >
                      {homeroomBroadcasts.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setHrActiveTab('resources')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 18px',
                      fontSize: 12.5,
                      fontWeight: hrActiveTab === 'resources' ? 700 : 600,
                      borderRadius: 6,
                      border: 'none',
                      background: hrActiveTab === 'resources' ? '#FFFFFF' : 'transparent',
                      color: hrActiveTab === 'resources' ? '#2C6E6A' : 'var(--text-secondary)',
                      boxShadow: hrActiveTab === 'resources' ? '0 2px 5px rgba(0,0,0,0.08)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <span>📚 Class Materials &amp; Guides</span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        padding: '1px 7px',
                        borderRadius: 10,
                        background: hrActiveTab === 'resources' ? '#EAF3EF' : '#ECEAE5',
                        color: hrActiveTab === 'resources' ? '#2D6E5D' : 'var(--text-secondary)',
                      }}
                    >
                      {homeroomResources.length}
                    </span>
                  </button>
                </div>

                {hrActiveTab === 'resources' && (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => setHrIsResourceFormExpanded(!hrIsResourceFormExpanded)}
                    style={{ padding: '7px 16px', fontSize: 12 }}
                  >
                    {hrIsResourceFormExpanded ? 'Close Form ▲' : '+ Upload Class Resource'}
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
                        📢
                      </div>
                      <div>
                        <h4 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: 'var(--neutral-dark)' }}>
                          Post Homeroom Circular or Notice
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
                              <option value="important">⭐ Important Circular</option>
                              <option value="urgent">🚨 Urgent Action Required</option>
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
                              📌 Pin to top
                            </span>
                          </label>
                        </div>

                        <button
                          type="submit"
                          className="btn-primary"
                          disabled={hrBcIsPosting}
                          style={{ padding: '9px 24px', fontSize: 13, fontWeight: 700 }}
                        >
                          {hrBcIsPosting ? 'Publishing...' : 'Publish to Homeroom ↗'}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Broadcasts List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ fontSize: 13, fontWeight: 800, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#2C6E6A' }}>
                        Published Homeroom Circulars ({homeroomBroadcasts.length})
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
                                      📌 PINNED
                                    </span>
                                  )}
                                  {isUrgent && (
                                    <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 4, background: '#FDF1F0', color: '#A83B38', border: '1px solid #F5C6CB' }}>
                                      🚨 URGENT
                                    </span>
                                  )}
                                  {isImportant && (
                                    <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 4, background: '#EFF6FF', color: '#1E40AF', border: '1px solid #BFDBFE' }}>
                                      ⭐ IMPORTANT
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
                                    {bc.is_pinned ? '📌 Unpin' : '📌 Pin'}
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
                            Upload Homeroom Resource or Form
                          </h4>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                            PDFs, permission slips, timetables, and class guides shared directly with {homeroomLabel}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => setHrIsResourceFormExpanded(false)}
                          style={{ padding: '5px 12px', fontSize: 11.5 }}
                        >
                          ✕ Close
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
                            <option value="pdf">📄 PDF Document</option>
                            <option value="doc">📝 Word / Text Doc</option>
                            <option value="slides">📊 Presentation Slides</option>
                            <option value="worksheet">📋 Spreadsheet / Form</option>
                            <option value="link">🔗 Web Link / Form URL</option>
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
                        className="form-input"
                        style={{ width: 240, padding: '6px 12px', fontSize: 12 }}
                        value={hrResSearchQuery}
                        onChange={(e) => setHrResSearchQuery(e.target.value)}
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
                                <h4 style={{ fontSize: 14.5, fontWeight: 800, margin: '0 0 6px', color: 'var(--neutral-dark)' }}>
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
                                      padding: '5px 9px',
                                      fontSize: 11.5,
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
                                      if (confirm(`Delete resource "${res.title}"?`)) {
                                        onDeleteResource(res.id);
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
                                )}
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
        )}


        {/* VIEW 5: HOLISTIC HUB (TEACHER'S PUBLISHED ACTIVITIES ONLY) */}
        {activeNavMode === 'hub' && (
          <>
            <header className="content-header">
              <div className="header-top">
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#2C6E6A', letterSpacing: '0.06em' }}>
                    CO-CURRICULAR HUB · FACULTY COORDINATOR
                  </div>
                  <h1 className="page-title" style={{ margin: '2px 0 0' }}>
                    My Published Activities &amp; Programmes ({myHubActivities.length})
                  </h1>
                </div>

                <button className="btn-primary" onClick={onOpenCreateHubActivityModal} style={{ padding: '7px 14px', fontSize: 12 }}>
                  + Publish Activity
                </button>
              </div>
            </header>

            <div className="content-body" style={{ padding: '24px 32px' }}>
              <div className="hub-grid">
                {myHubActivities.length === 0 ? (
                  <div className="panel-block" style={{ gridColumn: '1 / -1', padding: '40px 24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13, background: '#FFFFFF', borderRadius: 8, border: '1px dashed var(--border-color)' }}>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>🏅</div>
                    <div style={{ fontWeight: 700, color: 'var(--neutral-dark)', marginBottom: 4 }}>
                      No Co-Curricular Programmes Published Yet
                    </div>
                    <div>
                      You haven&apos;t published any extracurricular clubs, workshops, or development activities yet. Click <strong>&quot;+ Publish Activity&quot;</strong> to coordinate a new programme!
                    </div>
                  </div>
                ) : (
                  myHubActivities.map((act) => (
                    <div className="hub-card" key={act.id} style={{ borderRadius: 10, border: '1px solid var(--border-color)', background: '#FFFFFF' }}>
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

        {/* VIEW 6: SETTINGS & PASSWORD RESET */}
        {activeNavMode === 'settings' && (
          <div style={{ padding: '24px 32px' }}>
            <SettingsView currentUser={currentUser} profiles={profiles} onRefreshData={onRefreshData} />
          </div>
        )}

        {/* VIEW 7: HELP & SUPPORT */}
        {activeNavMode === 'support' && (
          <div style={{ padding: '24px 32px' }}>
            <SupportView currentUser={currentUser} />
          </div>
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
