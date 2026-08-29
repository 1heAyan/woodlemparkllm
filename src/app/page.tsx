'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  supabase,
  createIsolatedSupabaseClient,
  UserProfile,
  Student,
  TestItem,
  TestQuestion,
  AssignmentItem,
  SyllabusTerm,
  SyllabusTopic,
  Achievement,
  HubActivity,
  ParentDocument,
  AuditLogItem,
  SubjectClass,
  ClassResource,
  ClassBroadcast,
  ResourceType,
  ParentStudentLinkRequest,
  LeaveRequest,
} from '@/lib/supabaseClient';

import { LoginView } from '@/components/Auth/LoginView';
import { StudentDashboard } from '@/components/Student/StudentDashboard';
import { TeacherDashboard } from '@/components/Teacher/TeacherDashboard';
import { AdminDashboard } from '@/components/Admin/AdminDashboard';
import { PrincipalDashboard } from '@/components/Principal/PrincipalDashboard';
import { ParentDashboard } from '@/components/Parent/ParentDashboard';
import { isPrincipalUser, DEFAULT_PRINCIPAL_RECORD } from '@/lib/specialRolesHelper';
import { sanitizeUserCode } from '@/lib/userCodeHelper';

import { VideoPlayerModal } from '@/components/Modals/VideoPlayerModal';
import { AddAwardModal } from '@/components/Modals/AddAwardModal';
import { AddTermModal } from '@/components/Modals/AddTermModal';
import { AddTopicModal } from '@/components/Modals/AddTopicModal';
import { CreateTestModal } from '@/components/Modals/CreateTestModal';
import { CreateAssignmentModal } from '@/components/Modals/CreateAssignmentModal';
import { CreateHubActivityModal } from '@/components/Modals/CreateHubActivityModal';
import { ProvisionUserModal } from '@/components/Modals/ProvisionUserModal';
import { EditUserModal } from '@/components/Modals/EditUserModal';
import { BulkImportModal, BulkUserRow } from '@/components/Modals/BulkImportModal';
import { CreateSubjectClassModal } from '@/components/Modals/CreateSubjectClassModal';
import { TestResultRecord } from '@/components/Modals/ReviewTestResultsModal';
import { AssignmentSubmissionRecord } from '@/components/Modals/GradeAssignmentModal';
import { AiChatbot } from '@/components/Shared/AiChatbot';
import { PortalNavigationProvider } from '@/lib/PortalNavigationContext';
import { getCachedPassword, resolveUserPassword, saveUserPasswordToCloudAndLocal } from '@/lib/passwordHelper';
import { extractClassTeacherInfo } from '@/lib/classTeacherHelper';

function getCachedAvatar(id?: string, email?: string): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const eKey = email ? `woodlem_avatar_${email.toLowerCase().trim()}` : '';
  const iKey = id ? `woodlem_avatar_${id}` : '';
  return (eKey && localStorage.getItem(eKey)) || (iKey && localStorage.getItem(iKey)) || undefined;
}

export default function WoodlemApp() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem('woodlem_active_user_session');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {}
    return null;
  });
  const [isMounted, setIsMounted] = useState(false);

  // Database State
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [tests, setTests] = useState<TestItem[]>([]);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [syllabus, setSyllabus] = useState<SyllabusTerm[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [attendance, setAttendance] = useState<Record<string, Record<string, string>>>({});
  const [hubActivities, setHubActivities] = useState<HubActivity[]>([]);
  const [parentDocuments, setParentDocuments] = useState<ParentDocument[]>([]);
  const [linkRequests, setLinkRequests] = useState<ParentStudentLinkRequest[]>([]);
  const [testResults, setTestResults] = useState<Record<string, TestResultRecord>>({});
  const [assignmentSubmissions, setAssignmentSubmissions] = useState<Record<string, AssignmentSubmissionRecord>>({});
  const [studentSyllabusProgress, setStudentSyllabusProgress] = useState<Record<string, boolean>>({});
  const [classResources, setClassResources] = useState<ClassResource[]>([]);
  const [classBroadcasts, setClassBroadcasts] = useState<ClassBroadcast[]>([]);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  // Modals state
  const [selectedVideoActivity, setSelectedVideoActivity] = useState<HubActivity | null>(null);
  const [isAddAwardOpen, setIsAddAwardOpen] = useState(false);
  const [isAddTermOpen, setIsAddTermOpen] = useState(false);
  const [isAddTopicOpen, setIsAddTopicOpen] = useState(false);
  const [selectedTermForTopic, setSelectedTermForTopic] = useState<string | undefined>(undefined);
  const [isCreateTestOpen, setIsCreateTestOpen] = useState(false);
  const [isCreateAssignmentOpen, setIsCreateAssignmentOpen] = useState(false);
  const [targetClassForModal, setTargetClassForModal] = useState<string>('10-A');
  const [targetClassForTerm, setTargetClassForTerm] = useState<{ id?: string; subject?: string; className?: string } | null>(null);
  const [isCreateHubActivityOpen, setIsCreateHubActivityOpen] = useState(false);
  const [editingHubActivity, setEditingHubActivity] = useState<any>(null);
  const [isProvisionUserOpen, setIsProvisionUserOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [subjectClasses, setSubjectClasses] = useState<SubjectClass[]>([]);
  const [isCreateClassOpen, setIsCreateClassOpen] = useState(false);

  // Load All Cloud Data from Supabase
  const loadAllData = useCallback(async () => {
    try {
      const [
        profRes,
        testRes,
        assignRes,
        sylRes,
        achRes,
        attRes,
        hubRes,
        parentDocRes,
        subClassRes,
        classResRes,
        classBroadRes,
        testResultsRes,
        assignSubsRes,
        sylProgRes,
        linkReqRes,
      ] = await Promise.all([
        supabase.from('profiles').select('*').limit(10000),
        supabase.from('tests').select('*').order('created_at', { ascending: false }).limit(10000),
        supabase.from('assignments').select('*').order('created_at', { ascending: false }).limit(10000),
        supabase.from('syllabus_terms').select('*, syllabus_topics(*)').order('term_number', { ascending: true }).limit(10000),
        supabase.from('achievements').select('*').order('created_at', { ascending: false }).limit(10000),
        supabase.from('attendance').select('*').limit(10000),
        supabase.from('hub_activities').select('*').order('created_at', { ascending: false }).limit(10000),
        supabase.from('parent_documents').select('*').order('created_at', { ascending: false }).limit(10000),
        supabase.from('subject_classes').select('*').order('created_at', { ascending: true }).limit(10000),
        supabase.from('class_resources').select('*').order('created_at', { ascending: false }).limit(10000),
        supabase.from('class_broadcasts').select('*').order('created_at', { ascending: false }).limit(10000),
        supabase.from('test_results').select('*').limit(10000),
        supabase.from('assignment_submissions').select('*').limit(10000),
        supabase.from('student_syllabus_progress').select('*').limit(10000),
        supabase.from('parent_student_link_requests').select('*').order('created_at', { ascending: false }).limit(10000),
      ]);

      // Extract all cloud-stored user avatars from Supabase
      const avatarMap: Record<string, string> = {};
      // Extract all cloud-stored custom user passwords from Supabase
      const passwordMap: Record<string, string> = {};
      (achRes.data || []).forEach((ach: any) => {
        if (ach.title === '__USER_PASSWORD__' || (ach.id && typeof ach.id === 'string' && ach.id.startsWith('pwd_'))) {
          const pwd = ach.description || ach.desc_text || ach.file_url || '';
          if (pwd && typeof pwd === 'string') {
            const cleanP = pwd.trim();
            if (ach.student_id && ach.student_id !== 'system') {
              passwordMap[ach.student_id] = cleanP;
              passwordMap[ach.student_id.toLowerCase()] = cleanP;
            }
            if (ach.file_name) {
              const fEmail = ach.file_name.toLowerCase().trim();
              passwordMap[fEmail] = cleanP;
              passwordMap[fEmail.replace(/[^a-zA-Z0-9]/g, '_')] = cleanP;
            }
            if (ach.id && typeof ach.id === 'string' && ach.id.startsWith('pwd_')) {
              const uKey = ach.id.replace('pwd_', '');
              passwordMap[uKey] = cleanP;
              passwordMap[uKey.toLowerCase()] = cleanP;
            }
          }
        }
      });

      // Also check secondary parent_documents backup
      (parentDocRes.data || []).forEach((doc: any) => {
        if (doc.document_type === '__USER_PASSWORD__') {
          const pwd = doc.file_url || doc.file_name || '';
          if (pwd && typeof pwd === 'string') {
            const cleanP = pwd.trim();
            if (doc.student_id) {
              passwordMap[doc.student_id] = cleanP;
              passwordMap[doc.student_id.toLowerCase()] = cleanP;
            }
            if (doc.file_name) {
              const fEmail = doc.file_name.toLowerCase().trim();
              passwordMap[fEmail] = cleanP;
            }
          }
        }
      });

      (achRes.data || []).forEach((ach: any) => {
        if (ach.title === '__USER_AVATAR__') {
          const avUrl = ach.file_url || ach.desc_text || ach.description || '';
          if (avUrl) {
            if (ach.student_id) {
              avatarMap[ach.student_id] = avUrl;
              avatarMap[ach.student_id.toLowerCase()] = avUrl;
            }
            if (ach.id && typeof ach.id === 'string' && ach.id.startsWith('avatar_')) {
              const uKey = ach.id.replace('avatar_', '');
              avatarMap[uKey] = avUrl;
              avatarMap[uKey.toLowerCase()] = avUrl;
            }
          }
        }
      });

      if (profRes.error) {
        setSchemaError('The school portal is currently synchronizing. Please refresh the page if data does not appear immediately.');
      } else {
        const loadedProfiles: UserProfile[] = (profRes.data || []).map((p: any) => {
          const emailLower = (p.email || '').toLowerCase().trim();
          let role = p.role;
          if (emailLower === 'admin@woodlempark.ae' || emailLower === 'admin@woodlem.com' || emailLower.startsWith('admin@')) {
            role = 'admin';
            if (p.role !== 'admin') {
              supabase.from('profiles').update({ role: 'admin' }).eq('id', p.id).then(() => {});
            }
          } else if (emailLower === 'principal@woodlempark.ae' || emailLower === 'principal@woodlem.com' || isPrincipalUser(p)) {
            role = 'principal';
          }

          const cached = getCachedAvatar(p.id, p.email);
          const cloudAvatar =
            p.avatar_url ||
            avatarMap[p.id] ||
            avatarMap[p.id?.toLowerCase()] ||
            avatarMap[p.email] ||
            avatarMap[emailLower] ||
            cached ||
            undefined;

          // Cache in local storage for instant render without network flash
          if (cloudAvatar && typeof window !== 'undefined') {
            if (emailLower) localStorage.setItem(`woodlem_avatar_${emailLower}`, cloudAvatar);
            if (p.id) localStorage.setItem(`woodlem_avatar_${p.id}`, cloudAvatar);
          }

          const cloudPassword = resolveUserPassword(p, passwordMap);

          if (cloudPassword && typeof window !== 'undefined') {
            if (emailLower) localStorage.setItem(`woodlem_pwd_${emailLower}`, cloudPassword);
            if (p.id) localStorage.setItem(`woodlem_pwd_${p.id}`, cloudPassword);
          }

          const cleanCode = sanitizeUserCode(p.user_code || p.admission_number, p.email);

          return {
            ...p,
            user_code: cleanCode,
            admission_number: cleanCode,
            role,
            temp_password: cloudPassword,
            avatar_url: cloudAvatar,
          };
        });
        setProfiles(loadedProfiles);

        // Always re-sync currently active session user with latest database record
        setCurrentUser((prev) => {
          if (!prev) return null;
          const fresh = loadedProfiles.find(
            (p) => (prev.id && p.id === prev.id) || (p.email && p.email.toLowerCase() === prev.email.toLowerCase())
          );
          if (!fresh) return prev;
          let freshRole = fresh.role;
          const freshEmail = (fresh.email || '').toLowerCase().trim();
          if (freshEmail === 'admin@woodlempark.ae' || freshEmail === 'admin@woodlem.com' || freshEmail.startsWith('admin@')) {
            freshRole = 'admin';
          } else if (freshEmail === 'principal@woodlempark.ae' || freshEmail === 'principal@woodlem.com' || isPrincipalUser(fresh)) {
            freshRole = 'principal';
          }
          // Preserve avatar_url and temp_password if previously loaded
          return {
            ...fresh,
            role: freshRole,
            avatar_url: fresh.avatar_url || prev.avatar_url || getCachedAvatar(fresh.id, fresh.email),
            temp_password: fresh.temp_password || prev.temp_password || getCachedPassword(fresh.id, fresh.email),
          };
        });
      }

      const builtTests: TestItem[] = (testRes.data || []).map((t: any) => {
        let questions: TestQuestion[] = t.questions || [];
        let durationMinutes: number = t.duration_minutes || 30;
        let mediaUrl: string | undefined = t.media_url || undefined;
        let totalMarks: number | undefined = t.total_marks || undefined;
        let teacherId: string | undefined = t.teacher_id || undefined;

        if (t.subject && (t.subject.startsWith('{') || t.subject.startsWith('['))) {
          try {
            const parsed = JSON.parse(t.subject);
            if (Array.isArray(parsed.questions)) questions = parsed.questions;
            if (parsed.duration_minutes !== undefined) durationMinutes = parsed.duration_minutes;
            if (parsed.media_url !== undefined) mediaUrl = parsed.media_url;
            if (parsed.total_marks !== undefined) totalMarks = parsed.total_marks;
            // Fallback: extract teacher_id from JSON blob if not a top-level column
            if (!teacherId && parsed.teacher_id) teacherId = parsed.teacher_id;
          } catch (e) {}
        }

        return {
          id: t.id,
          title: t.title,
          class_name: t.class_name,
          teacher_id: teacherId,
          created_at: t.created_at,
          questions,
          duration_minutes: durationMinutes,
          media_url: mediaUrl,
          total_marks: totalMarks,
        };
      });

      setTests(builtTests);
      setAssignments(assignRes.data || []);

      const builtSyllabus: SyllabusTerm[] = (sylRes.data || [])
        .map((term: any) => ({
          id: term.id,
          name: term.name,
          subject: term.subject || '',
          class_name: term.class_name || '',
          class_id: term.class_id || '',
          order_index: term.order_num ?? term.order_index ?? 0,
          topics: (term.syllabus_topics || [])
            .map((tp: any) => ({
              id: tp.id,
              term_id: tp.term_id,
              title: tp.title,
              teacher_checked: !!tp.teacher_checked,
              student_checked: !!tp.student_checked,
            })),
        }))
        .sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0));

      setSyllabus(builtSyllabus);

      // Extract all cloud-stored parent document files from Supabase
      const docFileMap: Record<string, string> = {};
      (achRes.data || []).forEach((ach: any) => {
        if (ach.title === '__PARENT_DOC__') {
          const key = `${ach.student_id}_${ach.desc_text}`;
          docFileMap[key] = ach.file_url || '';
        }
      });

      // Extract all cloud-stored leave applications from Supabase
      const builtLeaves: LeaveRequest[] = (achRes.data || [])
        .filter((ach: any) => ach.title === '__LEAVE_REQUEST__')
        .map((ach: any) => {
          let details: any = {};
          try {
            details = JSON.parse(ach.desc_text || ach.description || '{}');
          } catch {
            details = { reason: ach.desc_text || ach.description || '' };
          }
          return {
            id: ach.id,
            student_id: ach.student_id,
            startDate: details.startDate || '',
            endDate: details.endDate || details.startDate || '',
            leaveType: details.leaveType || 'Authorized Leave',
            reason: details.reason || '',
            fileName: ach.file_name || details.fileName || '',
            fileUrl: ach.file_url || details.fileUrl || '',
            created_at: ach.created_at || details.appliedAt || '',
            status: details.status || 'submitted',
          };
        })
        .sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime());

      setLeaveRequests(builtLeaves);

      const builtAchievements: Achievement[] = (achRes.data || [])
        .filter(
          (ach: any) =>
            ach.title !== '__USER_AVATAR__' &&
            ach.title !== '__PARENT_DOC__' &&
            ach.title !== '__LEAVE_REQUEST__' &&
            ach.title !== '__GRADE_ASSESSMENT_TERM__' &&
            !String(ach.title || '').startsWith('__')
        )
        .map((ach: any) => {
          let description = ach.desc_text || ach.description || '';
          let fileName = ach.file_name || '';
          let fileUrl = ach.file_url || '';

          if (ach.desc_text && (ach.desc_text.startsWith('{') || ach.desc_text.startsWith('['))) {
            try {
              const parsed = JSON.parse(ach.desc_text);
              if (parsed.text !== undefined) description = parsed.text;
              if (parsed.fileName) fileName = parsed.fileName;
              if (parsed.fileUrl) fileUrl = parsed.fileUrl;
            } catch (e) {}
          }

          return {
            id: ach.id,
            student_id: ach.student_id,
            title: ach.title,
            description,
            file_name: fileName,
            file_url: fileUrl,
            created_at: ach.created_at,
          };
        });

      setAchievements(builtAchievements);

      const attMap: Record<string, Record<string, string>> = {};
      (attRes.data || []).forEach((row: any) => {
        if (!attMap[row.date]) attMap[row.date] = {};
        attMap[row.date][row.student_id] = row.status;
      });
      setAttendance(attMap);

      const builtHub: HubActivity[] = (hubRes.data || []).map((act: any) => ({
        ...act,
        enrolled_student_ids: [],
      }));
      setHubActivities(builtHub);

      // Load parent clearance documents directly from Supabase with cloud file URLs
      const loadedParentDocs: ParentDocument[] = (parentDocRes.data || []).map((d: any) => ({
        id: d.id,
        student_id: d.student_id,
        doc_type: d.doc_type,
        status: d.status,
        file_name: d.file_name,
        file_url: docFileMap[`${d.student_id}_${d.doc_type}`] || '',
        uploaded_at: d.uploaded_at,
      }));
      setParentDocuments(loadedParentDocs);

      setLinkRequests(linkReqRes.data || []);

      // Pure Supabase state loading: 100% in sync with database
      setSubjectClasses(subClassRes.data || []);
      setClassResources(classResRes.data || []);
      setClassBroadcasts(classBroadRes.data || []);

      const testResMap: Record<string, TestResultRecord> = {};
      (testResultsRes.data || []).forEach((row: any) => {
        const key = `${row.test_id}_${row.student_id}`;
        testResMap[key] = {
          test_id: row.test_id,
          student_id: row.student_id,
          student_name: row.student_name || 'Student',
          score: Number(row.score),
          feedback: row.feedback || '',
          completed_at: row.submitted_at ? new Date(row.submitted_at).toLocaleDateString() : undefined,
        };
      });
      setTestResults(testResMap);

      const assSubMap: Record<string, AssignmentSubmissionRecord> = {};
      (assignSubsRes.data || []).forEach((row: any) => {
        const key = `${row.assignment_id}_${row.student_id}`;
        assSubMap[key] = {
          assignment_id: row.assignment_id,
          student_id: row.student_id,
          student_name: row.student_name || 'Student',
          file_name: row.file_name || '',
          file_url: row.file_url || '',
          grade: row.score ? `${row.score}` : '',
          feedback: row.feedback || '',
          status: row.score ? 'graded' : 'submitted',
          submitted_at: row.submitted_at ? new Date(row.submitted_at).toLocaleDateString() : undefined,
        };
      });
      setAssignmentSubmissions(assSubMap);

      const sylProgMap: Record<string, boolean> = {};
      (sylProgRes.data || []).forEach((row: any) => {
        sylProgMap[`${row.student_id}_${row.topic_id}`] = !!row.is_completed;
      });
      setStudentSyllabusProgress(sylProgMap);
    } catch (err: any) {
      console.error('Error loading Supabase data:', err);
    }
  }, []);

  useEffect(() => {
    // Mount UI immediately so Login screen appears with zero delay
    setIsMounted(true);

    // Restore active session directly from Supabase Cloud Auth
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.email) {
          const userEmail = session.user.email.toLowerCase().trim();
          const { data: prof } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', userEmail)
            .maybeSingle();

          if (prof) {
            let resolvedRole = prof.role;
            if (userEmail === 'admin@woodlempark.ae' || userEmail === 'admin@woodlem.com' || userEmail.startsWith('admin@')) {
              resolvedRole = 'admin';
              if (prof.role !== 'admin') {
                supabase.from('profiles').update({ role: 'admin' }).eq('id', prof.id).then(() => {});
              }
            } else if (userEmail === 'principal@woodlempark.ae' || userEmail === 'principal@woodlem.com' || isPrincipalUser(prof)) {
              resolvedRole = 'principal';
            }

            const cached = getCachedAvatar(prof.id, prof.email);
            const enriched = {
              ...prof,
              role: resolvedRole,
              avatar_url: prof.avatar_url || cached || undefined,
            };
            setCurrentUser(enriched);
            if (typeof window !== 'undefined') {
              try {
                localStorage.setItem('woodlem_active_user_session', JSON.stringify(enriched));
              } catch (e) {}
            }
          }
        } else {
          if (typeof window !== 'undefined' && !localStorage.getItem('woodlem_active_user_session')) {
            setCurrentUser(null);
          }
        }
      } catch (e) {}
      await loadAllData();
    };

    initAuth();

    // Subscribe to Supabase auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem('woodlem_active_user_session');
          } catch (e) {}
        }
        setCurrentUser(null);
      } else if (session?.user?.email) {
        const userEmail = session.user.email.toLowerCase().trim();
        const { data: prof } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', userEmail)
          .maybeSingle();
        if (prof) {
          let resolvedRole = prof.role;
          if (userEmail === 'admin@woodlempark.ae' || userEmail === 'admin@woodlem.com' || userEmail.startsWith('admin@')) {
            resolvedRole = 'admin';
            if (prof.role !== 'admin') {
              supabase.from('profiles').update({ role: 'admin' }).eq('id', prof.id).then(() => {});
            }
          } else if (userEmail === 'principal@woodlempark.ae' || userEmail === 'principal@woodlem.com' || isPrincipalUser(prof)) {
            resolvedRole = 'principal';
          }

          const cached = getCachedAvatar(prof.id, prof.email);
          const enriched = {
            ...prof,
            role: resolvedRole,
            avatar_url: prof.avatar_url || cached || undefined,
          };
          setCurrentUser(enriched);
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('woodlem_active_user_session', JSON.stringify(enriched));
            } catch (e) {}
          }
        }
      }
    });

    // Real-time custom avatar updates across window
    const handleAvatarEvent = (e: any) => {
      const detail = e.detail;
      if (!detail) return;
      const { avatarUrl, userId, email } = detail;
      setCurrentUser((prev) => {
        if (!prev) return null;
        if ((userId && prev.id === userId) || (email && prev.email?.toLowerCase() === email.toLowerCase())) {
          const updated = { ...prev, avatar_url: avatarUrl || undefined };
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('woodlem_active_user_session', JSON.stringify(updated));
            } catch (e) {}
          }
          return updated;
        }
        return prev;
      });
      setProfiles((prev) =>
        prev.map((p) => {
          if ((userId && p.id === userId) || (email && p.email?.toLowerCase() === email.toLowerCase())) {
            return { ...p, avatar_url: avatarUrl || undefined };
          }
          return p;
        })
      );
    };

    const handlePasswordEvent = (e: any) => {
      const detail = e.detail;
      if (!detail) return;
      const { userId, email, newPassword } = detail;
      const cleanEventEmail = (email || '').toLowerCase().trim();
      setCurrentUser((prev) => {
        if (!prev) return null;
        if ((userId && prev.id === userId) || (cleanEventEmail && prev.email?.toLowerCase().trim() === cleanEventEmail)) {
          const updated = { ...prev, temp_password: newPassword };
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('woodlem_active_user_session', JSON.stringify(updated));
            } catch (e) {}
          }
          return updated;
        }
        return prev;
      });
      setProfiles((prev) =>
        prev.map((p) => {
          if ((userId && p.id === userId) || (cleanEventEmail && p.email?.toLowerCase().trim() === cleanEventEmail)) {
            return { ...p, temp_password: newPassword };
          }
          return p;
        })
      );
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('woodlem-avatar-updated', handleAvatarEvent);
      window.addEventListener('woodlem-password-updated', handlePasswordEvent);
    }

    // Subscribe to real-time database updates across public schema
    const channel = supabase
      .channel('woodlem-realtime')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        loadAllData();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(channel);
      if (typeof window !== 'undefined') {
        window.removeEventListener('woodlem-avatar-updated', handleAvatarEvent);
        window.removeEventListener('woodlem-password-updated', handlePasswordEvent);
      }
    };
  }, [loadAllData]);

  // Handlers
  const handleLoginSuccess = (profile: UserProfile) => {
    const emailLower = (profile.email || '').toLowerCase().trim();
    let resolvedRole = profile.role;
    if (emailLower === 'admin@woodlempark.ae' || emailLower === 'admin@woodlem.com' || emailLower.startsWith('admin@')) {
      resolvedRole = 'admin';
    } else if (emailLower === 'principal@woodlempark.ae' || emailLower === 'principal@woodlem.com' || isPrincipalUser(profile)) {
      resolvedRole = 'principal';
    }

    const cached = getCachedAvatar(profile.id, profile.email);
    const enriched = {
      ...profile,
      role: resolvedRole,
      avatar_url: profile.avatar_url || cached || undefined,
    };
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('woodlem_active_user_session', JSON.stringify(enriched));
      } catch (e) {}
    }
    setCurrentUser(enriched);
    loadAllData();
  };

  const handleUpdateCurrentUser = useCallback((updated: UserProfile) => {
    setCurrentUser(updated);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('woodlem_active_user_session', JSON.stringify(updated));
      } catch (e) {}
    }
    setProfiles((prev) =>
      prev.map((p) =>
        (updated.id && p.id === updated.id) ||
        (updated.email && p.email && p.email.toLowerCase() === updated.email.toLowerCase())
          ? { ...p, ...updated, avatar_url: updated.avatar_url || p.avatar_url, temp_password: updated.temp_password || p.temp_password }
          : p
      )
    );
  }, []);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {}
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('woodlem_active_user_session');
        localStorage.removeItem('woodlem_ai_chat_history_v2');
        localStorage.setItem('woodlem_ai_panel_open_state_v2', 'false');
      } catch (e) {}
    }
    setCurrentUser(null);
  };

  // 1. Provision User (Admin -> Supabase Profiles & Auth)
  const handleProvisionUser = async (userData: {
    name: string;
    email: string;
    password: string;
    role: 'student' | 'teacher' | 'parent' | 'admin';
    userCode: string;
    admissionNumber?: string;
    grade?: string;
    classLetter?: string;
    subject?: string | null;
    assignedClass?: string | null;
    linkedStudentIds?: string[];
  }) => {
    try {
      // Create isolated client to avoid clearing active Admin auth session
      const isolatedClient = createIsolatedSupabaseClient();
      let createdAuthUserId: string | null = null;

      try {
        const { data: authRes, error: authErr } = await isolatedClient.auth.signUp({
          email: userData.email,
          password: userData.password,
          options: {
            data: {
              name: userData.name,
              role: userData.role,
              user_code: userData.userCode,
              admission_number: userData.admissionNumber || userData.userCode,
              grade: userData.grade || '',
              class_letter: userData.classLetter || '',
            },
          },
        });
        if (authRes?.user) {
          createdAuthUserId = authRes.user.id;
        } else if (authErr) {
          console.warn('Auth sign up notice:', authErr.message);
        }
      } catch (authErr) {
        console.warn('Auth registration warning:', authErr);
      }

      // Validate single class teacher assignment per cohort
      if (userData.role === 'teacher' && userData.assignedClass) {
        const targetClass = userData.assignedClass.replace(/^Grade\s*/i, '');
        const conflictTeacher = profiles.find((p) => {
          if (p.role !== 'teacher') return false;
          if (p.email && p.email.toLowerCase() === userData.email.toLowerCase()) return false;
          const pInfo = extractClassTeacherInfo(p, subjectClasses);
          return pInfo.isClassTeacher && pInfo.classKey === targetClass;
        });
        if (conflictTeacher) {
          alert(`Cannot assign as Class Teacher: Grade ${targetClass} is already assigned to ${conflictTeacher.name} (${conflictTeacher.subject || 'Faculty'}). Each class section can only have one Class Teacher.`);
          return;
        }
      }

      // Strict duplicate email enforcement
      const existingEmailProfile = profiles.find((p) => p.email.toLowerCase() === userData.email.trim().toLowerCase());
      if (existingEmailProfile) {
        alert(`Cannot create account: An account with email "${userData.email}" already exists (${existingEmailProfile.name} - ${existingEmailProfile.role.toUpperCase()}). Every account must have a unique email.`);
        return;
      }

      // Strict duplicate code enforcement for newly provisioned accounts
      const targetCode = (userData.admissionNumber || userData.userCode || '').trim().toLowerCase();
      if (targetCode && targetCode !== '—' && targetCode !== '-' && targetCode !== 'null' && targetCode !== 'undefined') {
        const duplicate = profiles.find(
          (p) =>
            p.email.toLowerCase() !== userData.email.trim().toLowerCase() &&
            ((p.admission_number && p.admission_number.trim().toLowerCase() === targetCode) ||
              (p.user_code && p.user_code.trim().toLowerCase() === targetCode))
        );
        if (duplicate) {
          alert(
            `Cannot create account: Code "${userData.admissionNumber || userData.userCode}" is already assigned to ${duplicate.name} (${duplicate.role.toUpperCase()}). Every user must have a unique code.`
          );
          return;
        }
      }

      // Check existing profile
      const { data: existingProf } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', userData.email)
        .maybeSingle();

      const profileId = createdAuthUserId || existingProf?.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'usr_' + Date.now());

      const cleanCode = sanitizeUserCode(userData.userCode || userData.admissionNumber, userData.email);

      const dbProfile: any = {
        id: profileId,
        name: userData.name.trim(),
        email: userData.email.trim().toLowerCase(),
        role: userData.role,
        user_code: cleanCode,
        admission_number: cleanCode,
        grade: userData.grade || '',
        class_letter: userData.classLetter || '',
        subject: userData.subject ?? null,
        assigned_class: userData.assignedClass ?? null,
      };
      if (userData.linkedStudentIds && userData.linkedStudentIds.length > 0) {
        dbProfile.linked_student_ids = userData.linkedStudentIds;
      }

      let { error: profErr } = await supabase.from('profiles').upsert([dbProfile], { onConflict: 'email' });
      if (profErr && dbProfile.linked_student_ids) {
        const stripped = { ...dbProfile };
        delete stripped.linked_student_ids;
        const retry = await supabase.from('profiles').upsert([stripped], { onConflict: 'email' });
        profErr = retry.error;
      }
      if (profErr) {
        console.error('Provision user error:', profErr);
        alert('Unable to create user account. Please check the information provided and try again.');
        return;
      }

      // Persist password to cloud and local storage
      const assignedPwd = userData.password || 'woodlem123';
      await saveUserPasswordToCloudAndLocal(profileId, userData.email, assignedPwd);

      alert(`User account for "${userData.name}" has been created successfully.`);
      await loadAllData();
    } catch (err: any) {
      alert('Unable to create user account. Please try again.');
    }
  };

  // 1b. Bulk Excel Import Users
  const handleBulkImportUsers = async (
    users: BulkUserRow[],
    onProgress?: (current: number, total: number) => void
  ) => {
    try {
      if (!users || users.length === 0) {
        alert('No user rows to import.');
        return;
      }

      // 1. Fetch existing profiles to preserve exact database IDs and relationships
      const { data: existingProfiles } = await supabase
        .from('profiles')
        .select('id, email, admission_number, user_code')
        .limit(10000);

      const existingIdByEmail = new Map<string, string>();
      const existingIdByCode = new Map<string, string>();

      (existingProfiles || []).forEach((p) => {
        if (p.email) existingIdByEmail.set(p.email.trim().toLowerCase(), p.id);
        if (p.admission_number) existingIdByCode.set(p.admission_number.trim().toLowerCase(), p.id);
        if (p.user_code) existingIdByCode.set(p.user_code.trim().toLowerCase(), p.id);
      });

      // 2. Prepare high-fidelity profiles batch with guaranteed uniqueness
      const batchUsedEmails = new Set<string>();

      const profilesBatch: (UserProfile & { temp_password?: string })[] = users.map((u, idx) => {
        let emailKey = (u.email || '').trim().toLowerCase();
        const codeKey = (u.userCode || '').trim();

        if (!emailKey && codeKey) {
          emailKey = `${codeKey.toLowerCase().replace(/[^a-z0-9]/g, '')}@woodlempark.ae`;
        }
        if (!emailKey || !emailKey.includes('@')) {
          emailKey = `user.${idx + 1}@woodlempark.ae`;
        }

        // Guarantee unique email within this import batch
        let finalEmail = emailKey;
        let counter = 1;
        while (batchUsedEmails.has(finalEmail)) {
          const [uP, dP] = emailKey.split('@');
          const cleanCode = codeKey.toLowerCase().replace(/[^a-z0-9]/g, '') || `u${idx + 1}`;
          finalEmail = `${uP}.${cleanCode}${counter > 1 ? `.${counter}` : ''}@${dP || 'woodlempark.ae'}`;
          counter++;
        }
        batchUsedEmails.add(finalEmail);

        // Exact ID lookup strictly by unique Email or user code to preserve existing database ID
        const existingId =
          existingIdByEmail.get(finalEmail) ||
          (codeKey ? existingIdByCode.get(codeKey.toLowerCase()) : null);

        const profileId =
          existingId ||
          (typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : 'usr_' + Date.now() + '_' + idx);

        let cleanGrade = (u.grade || '').trim();
        if (!cleanGrade && u.role === 'student') cleanGrade = '9';

        let cleanClass = (u.classLetter || 'A')
          .toUpperCase()
          .replace(/[^A-Z]/g, '') || 'A';

        let resolvedLinkedStudentIds: string[] = [];
        if (u.role === 'parent' && u.linkedStudentCodes && u.linkedStudentCodes.length > 0) {
          const codes = u.linkedStudentCodes.map((c) => c.toLowerCase().trim());
          resolvedLinkedStudentIds = (existingProfiles || [])
            .filter(
              (p: any) =>
                codes.includes(p.admission_number?.toLowerCase() || '') ||
                codes.includes(p.user_code?.toLowerCase() || '') ||
                codes.includes(p.email?.toLowerCase() || '')
            )
            .map((p) => p.id);
        }

        const cleanCode = sanitizeUserCode(u.userCode, finalEmail);

        return {
          id: profileId,
          name: u.name.trim(),
          email: finalEmail,
          role: u.role,
          user_code: cleanCode,
          admission_number: cleanCode,
          grade: cleanGrade,
          class_letter: u.role === 'student' ? cleanClass : '',
          subject: null,
          assigned_class: null,
          temp_password: u.password || 'woodlem123',
          linked_student_ids: u.role === 'parent' ? resolvedLinkedStudentIds : [],
        };
      });

      // 3. Upsert profiles to database (in chunks of 50 with individual row-level fallback)
      let importedCount = 0;
      let errorCount = 0;
      for (let i = 0; i < profilesBatch.length; i += 50) {
        const chunk = profilesBatch.slice(i, i + 50);
        const { error: profErr } = await supabase
          .from('profiles')
          .upsert(chunk, { onConflict: 'email' });

        if (profErr) {
          console.warn('Chunk upsert warning, retrying row-by-row:', profErr);
          // Fallback: upsert row-by-row
          for (const item of chunk) {
            const { error: singleErr } = await supabase
              .from('profiles')
              .upsert([item], { onConflict: 'email' });
            if (singleErr) {
              console.error('Row insert error:', item.email, singleErr);
              errorCount++;
            } else {
              importedCount++;
            }
          }
        } else {
          importedCount += chunk.length;
        }

        if (onProgress) {
          onProgress(Math.min(importedCount + errorCount, profilesBatch.length), profilesBatch.length);
        }
      }

      // 4. Save default passwords locally and to cloud cache for instant login
      for (const u of profilesBatch) {
        saveUserPasswordToCloudAndLocal(u.id, u.email, u.temp_password || 'woodlem123');
      }

      // 5. Background sync with Supabase Auth (non-blocking so rate limits do not fail the user)
      const isolatedClient = createIsolatedSupabaseClient();
      setTimeout(async () => {
        for (let i = 0; i < users.length; i += 5) {
          const batch = users.slice(i, i + 5);
          await Promise.allSettled(
            batch.map((u) =>
              isolatedClient.auth.signUp({
                email: u.email.trim().toLowerCase(),
                password: u.password || 'woodlem123',
                options: {
                  data: {
                    name: u.name,
                    role: u.role,
                    user_code: u.userCode,
                    admission_number: u.userCode,
                    grade: u.grade || '9',
                    class_letter: u.classLetter || 'A',
                  },
                },
              })
            )
          );
        }
      }, 100);

      alert(
        `Successfully imported ${importedCount} user account${importedCount !== 1 ? 's' : ''}${errorCount > 0 ? ` (${errorCount} failed due to errors)` : ''}. The user directory has been updated.`
      );
      await loadAllData();
    } catch (err: any) {
      console.error('Bulk import error:', err);
      const detail = err?.message || 'Please check the file formatting.';
      alert(`Unable to complete bulk import: ${detail}`);
    }
  };

  const handleUpdateUser = async (updatedUser: UserProfile) => {
    try {
      const cleanEmail = updatedUser.email.trim().toLowerCase();

      // Find original profile before update strictly by ID or Email (never by code)
      const originalProf =
        (updatedUser.id ? profiles.find((p) => p.id === updatedUser.id) : null) ||
        profiles.find((p) => p.email && p.email.toLowerCase() === cleanEmail);

      const profileId = updatedUser.id || originalProf?.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'usr_' + Date.now());
      const originalEmail = (originalProf?.email || cleanEmail).trim().toLowerCase();

      // Validate single class teacher assignment per cohort
      if (updatedUser.role === 'teacher' && updatedUser.assigned_class) {
        const targetClass = updatedUser.assigned_class.replace(/^Grade\s*/i, '');
        const conflictTeacher = profiles.find((p) => {
          if (p.id === profileId || (p.email && (p.email.toLowerCase() === cleanEmail || p.email.toLowerCase() === originalEmail))) return false;
          if (p.role !== 'teacher') return false;
          const pInfo = extractClassTeacherInfo(p, subjectClasses);
          return pInfo.isClassTeacher && pInfo.classKey === targetClass;
        });
        if (conflictTeacher) {
          alert(`Cannot assign as Class Teacher: Grade ${targetClass} is already assigned to ${conflictTeacher.name} (${conflictTeacher.subject || 'Faculty'}). Each class section can only have one Class Teacher.`);
          return;
        }
      }

      // Strict duplicate email enforcement
      const conflictEmailUser = profiles.find(
        (p) =>
          p.id !== profileId &&
          p.email &&
          p.email.toLowerCase().trim() === cleanEmail
      );
      if (conflictEmailUser) {
        alert(`Cannot save: Email "${cleanEmail}" is already assigned to ${conflictEmailUser.name} (${conflictEmailUser.role.toUpperCase()}). Every user must have a unique email.`);
        return;
      }

      // Strict duplicate code enforcement: Every user must have a unique admission/employee code
      const targetCode = (updatedUser.admission_number || updatedUser.user_code || '').trim().toLowerCase();
      if (targetCode && targetCode !== '—' && targetCode !== '-' && targetCode !== 'null' && targetCode !== 'undefined') {
        const duplicate = profiles.find(
          (p) =>
            p.id !== profileId &&
            p.email.toLowerCase() !== cleanEmail &&
            p.email.toLowerCase() !== originalEmail &&
            ((p.admission_number && p.admission_number.trim().toLowerCase() === targetCode) ||
              (p.user_code && p.user_code.trim().toLowerCase() === targetCode))
        );
        if (duplicate) {
          alert(`Cannot save: Code "${(updatedUser.admission_number || updatedUser.user_code || '').trim()}" is already assigned to ${duplicate.name} (${duplicate.role.toUpperCase()}). Every user must have a unique code.`);
          return;
        }
      }

      const finalPassword = updatedUser.temp_password?.trim() || 'woodlem123';

      const fullProfileData: UserProfile = {
        ...updatedUser,
        id: profileId,
        name: updatedUser.name.trim(),
        email: cleanEmail,
        role: updatedUser.role,
        user_code: updatedUser.user_code?.trim() || '',
        admission_number: (updatedUser.admission_number || updatedUser.user_code || '').trim(),
        temp_password: finalPassword,
        grade: updatedUser.grade ?? '',
        class_letter: updatedUser.class_letter ?? '',
        subject: updatedUser.subject ?? null,
        assigned_class: updatedUser.assigned_class ?? null,
        linked_student_ids: updatedUser.linked_student_ids ?? [],
      };

      // 1. Optimistically update local profiles state immediately
      setProfiles((prev) => {
        const exists = prev.some((p) => p.id === profileId || (p.email && (p.email.toLowerCase() === cleanEmail || p.email.toLowerCase() === originalEmail)));
        if (!exists) return [...prev, fullProfileData];
        return prev.map((p) =>
          p.id === profileId || (p.email && (p.email.toLowerCase() === cleanEmail || p.email.toLowerCase() === originalEmail))
            ? fullProfileData
            : p
        );
      });

      // 2. Prepare database payload with ONLY verified PostgreSQL columns of public.profiles
      // (Do NOT include avatar_url or temp_password as they are not columns in public.profiles)
      const dbPayload: any = {
        id: profileId,
        name: updatedUser.name.trim(),
        email: cleanEmail,
        role: updatedUser.role,
        user_code: updatedUser.user_code?.trim() || '',
        admission_number: (updatedUser.admission_number || updatedUser.user_code || '').trim(),
        grade: updatedUser.grade ?? '',
        class_letter: updatedUser.class_letter ?? '',
        subject: updatedUser.subject ?? null,
        assigned_class: updatedUser.assigned_class ?? null,
        linked_student_ids: updatedUser.linked_student_ids ?? [],
      };

      // Execute safe multi-tier update verified with .select()
      let dbUpdated = false;

      // Tier 1: Try update by exact ID
      if (profileId) {
        const { data: resId, error: errId } = await supabase.from('profiles').update(dbPayload).eq('id', profileId).select();
        if (!errId && resId && resId.length > 0) {
          dbUpdated = true;
        } else if (errId) {
          console.warn('Supabase update by ID notice:', errId);
        }
      }

      // Tier 2: Try update by original email
      if (!dbUpdated && originalEmail) {
        const { data: resOrig, error: errOrig } = await supabase.from('profiles').update(dbPayload).eq('email', originalEmail).select();
        if (!errOrig && resOrig && resOrig.length > 0) {
          dbUpdated = true;
        }
      }

      // Tier 3: Try update by clean email
      if (!dbUpdated && cleanEmail !== originalEmail) {
        const { data: resNew, error: errNew } = await supabase.from('profiles').update(dbPayload).eq('email', cleanEmail).select();
        if (!errNew && resNew && resNew.length > 0) {
          dbUpdated = true;
        }
      }

      // Tier 4: Direct upsert with conflict resolution
      if (!dbUpdated) {
        const { error: upsertErr } = await supabase.from('profiles').upsert([dbPayload], { onConflict: 'id' });
        if (!upsertErr) {
          dbUpdated = true;
        } else {
          const { error: emailUpsertErr } = await supabase.from('profiles').upsert([dbPayload], { onConflict: 'email' });
          if (!emailUpsertErr) {
            dbUpdated = true;
          } else {
            console.error('Database profile upsert notice:', emailUpsertErr);
          }
        }
      }

      // 3. Persist password & avatar to cloud and local storage
      await saveUserPasswordToCloudAndLocal(profileId, cleanEmail, finalPassword);
      if (updatedUser.avatar_url) {
        try {
          await supabase.from('achievements').upsert([
            {
              id: `avatar_${profileId}`,
              student_id: profileId,
              title: '__USER_AVATAR__',
              description: updatedUser.avatar_url,
              desc_text: updatedUser.avatar_url,
              file_name: cleanEmail,
              file_url: updatedUser.avatar_url,
            },
          ]);
        } catch (avErr) {
          console.warn('Avatar storage notice:', avErr);
        }
      }

      if (typeof window !== 'undefined' && updatedUser.avatar_url) {
        localStorage.setItem(`woodlem_avatar_${profileId}`, updatedUser.avatar_url);
        localStorage.setItem(`woodlem_avatar_${cleanEmail}`, updatedUser.avatar_url);
      }

      // 5. If currently logged-in user matches this profile, sync session state
      if (
        currentUser &&
        (currentUser.id === profileId ||
          currentUser.email.toLowerCase() === cleanEmail ||
          currentUser.email.toLowerCase() === originalEmail)
      ) {
        const mergedUser: UserProfile = { ...currentUser, ...fullProfileData };
        setCurrentUser(mergedUser);
      }

      // 6. Update subjectClasses if a teacher's name changed
      setSubjectClasses((prev) =>
        prev.map((c) => {
          if (c.teacher_id === profileId || (originalProf && c.teacher_id === originalProf.id)) {
            return {
              ...c,
              teacher_name: updatedUser.name.trim(),
            };
          }
          return c;
        })
      );

      // Re-fetch all data to ensure complete cloud database consistency
      await loadAllData();

      recordAuditLog('EDIT_ACHIEVEMENT' as any, updatedUser.name, `Updated profile details for ${updatedUser.name}`);
      alert(`Profile for "${updatedUser.name}" updated successfully.`);
    } catch (err: any) {
      console.error('Update user error:', err);
      alert('Unable to save changes. Please try again.');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    const targetUser = profiles.find((p) => p.id === userId);
    if (targetUser && isPrincipalUser(targetUser)) {
      const isCurrentPrincipal = isPrincipalUser(currentUser) || currentUser?.id === userId;
      if (!isCurrentPrincipal) {
        alert('Security Policy: The Principal account cannot be deleted by standard administrators. Only the Principal can delete or step down from their own authenticated account.');
        return;
      }
    }
    const userName = targetUser?.name || 'User';

    // 1. Optimistic UI update: immediately remove from profiles
    setProfiles((prev) => prev.filter((p) => p.id !== userId));

    // 2. Remove user from subject classes enrollment optimistically
    setSubjectClasses((prev) =>
      prev.map((c) => ({
        ...c,
        enrolled_student_ids: (c.enrolled_student_ids || []).filter(
          (id) => id !== userId && id !== targetUser?.email
        ),
      }))
    );

    try {
      const { error } = await supabase.from('profiles').delete().eq('id', userId);
      if (error) {
        alert('Unable to remove user account. Please try again.');
        await loadAllData();
        return;
      }
      recordAuditLog(
        'DELETE_ACHIEVEMENT' as any,
        userName,
        `Deleted user account: ${targetUser?.email || userId}`
      );
      alert(`User account for "${userName}" has been removed.`);
      await loadAllData();
    } catch (err: any) {
      alert('Unable to remove user account. Please try again.');
      await loadAllData();
    }
  };

  // 2. Tests & Assessments
  const handleCreateTest = async (
    data:
      | {
          title: string;
          className?: string;
          durationMinutes?: number;
          questions?: TestQuestion[];
          mediaUrl?: string;
        }
      | string
  ) => {
    const title = typeof data === 'string' ? data : data.title;
    const className =
      typeof data === 'object' && data.className
        ? data.className
        : targetClassForModal || '10-A';
    const durationMinutes =
      typeof data === 'object' && data.durationMinutes ? data.durationMinutes : 30;
    const questions =
      typeof data === 'object' && data.questions ? data.questions : [];
    const mediaUrl = typeof data === 'object' ? data.mediaUrl : undefined;

    const newTest: TestItem = {
      id: `test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title,
      class_name: className,
      teacher_id: currentUser?.id,
      duration_minutes: durationMinutes,
      questions,
      media_url: mediaUrl,
      total_marks: questions.reduce((sum, q) => sum + (q.points || 1), 0),
    };

    const subjectJson = JSON.stringify({
      duration_minutes: durationMinutes,
      questions,
      media_url: mediaUrl,
      total_marks: newTest.total_marks,
      teacher_id: currentUser?.id,
    });

    // 1. Optimistically update local tests state immediately
    setTests((prev) => [newTest, ...prev]);

    // 2. Multi-tier database insertion strategy
    let dbSuccess = false;

    // Tier 1: Standard Supabase Schema with questions (JSONB), duration_minutes, teacher_id
    try {
      const tier1Payload: any = {
        id: newTest.id,
        title: newTest.title,
        class_name: newTest.class_name,
        questions: newTest.questions,
        duration_minutes: newTest.duration_minutes,
      };
      if (currentUser?.id) tier1Payload.teacher_id = currentUser.id;

      const { error: err1 } = await supabase.from('tests').insert([tier1Payload]);
      if (!err1) {
        dbSuccess = true;
      } else {
        console.warn('Test insert Tier 1 notice (retrying core JSONB):', err1.message);
      }
    } catch (e) {
      console.warn('Exception during Tier 1 test insert:', e);
    }

    // Tier 2: Core columns only (id, title, class_name, questions JSONB, duration_minutes)
    if (!dbSuccess) {
      try {
        const tier2Payload = {
          id: newTest.id,
          title: newTest.title,
          class_name: newTest.class_name,
          questions: newTest.questions,
          duration_minutes: newTest.duration_minutes,
        };
        const { error: err2 } = await supabase.from('tests').insert([tier2Payload]);
        if (!err2) {
          dbSuccess = true;
        } else {
          console.warn('Test insert Tier 2 notice (retrying stringified):', err2.message);
        }
      } catch (e) {
        console.warn('Exception during Tier 2 test insert:', e);
      }
    }

    // Tier 3: Legacy subject JSON string column
    if (!dbSuccess) {
      try {
        const tier3Payload = {
          id: newTest.id,
          title: newTest.title,
          class_name: newTest.class_name,
          subject: subjectJson,
        };
        const { error: err3 } = await supabase.from('tests').insert([tier3Payload]);
        if (!err3) {
          dbSuccess = true;
        } else {
          console.warn('Test insert Tier 3 notice (retrying minimal):', err3.message);
        }
      } catch (e) {
        console.warn('Exception during Tier 3 test insert:', e);
      }
    }

    // Tier 4: Minimal valid row
    if (!dbSuccess) {
      try {
        const tier4Payload = {
          id: newTest.id,
          title: newTest.title,
          class_name: newTest.class_name,
        };
        const { error: err4 } = await supabase.from('tests').insert([tier4Payload]);
        if (!err4) {
          dbSuccess = true;
        }
      } catch (e) {
        console.warn('Exception during Tier 4 test insert:', e);
      }
    }

    // Always cache locally so created test is never lost
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('woodlem_offline_tests_v1');
        const list = cached ? JSON.parse(cached) : [];
        list.unshift(newTest);
        localStorage.setItem('woodlem_offline_tests_v1', JSON.stringify(list));
      } catch {}
    }

    recordAuditLog(
      'CREATE_ACHIEVEMENT' as any,
      title,
      `Published new class test with ${questions.length} questions for ${className}`
    );

    alert(`Class Test "${title}" published successfully.`);
    loadAllData();
  };

  const handleDeleteTest = async (testId: string) => {
    const testObj = tests.find((t) => t.id === testId);
    setTests((prev) => prev.filter((t) => t.id !== testId));
    try {
      await supabase.from('tests').delete().eq('id', testId);
    } catch (e) {}

    if (testObj) {
      recordAuditLog('DELETE_ACHIEVEMENT' as any, testObj.title, `Deleted assessment`);
    }
  };

  const handleSaveTestResult = async (result: TestResultRecord) => {
    const key = `${result.test_id}_${result.student_id}`;
    setTestResults((prev) => ({ ...prev, [key]: result }));

    try {
      await supabase.from('test_results').upsert({
        id: key,
        test_id: result.test_id,
        student_id: result.student_id,
        score: result.score,
        feedback: result.feedback || '',
        submitted_at: new Date().toISOString(),
        graded_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error('Error saving test result to Supabase:', e);
    }

    recordAuditLog('EDIT_ACHIEVEMENT' as any, result.student_name, `Completed test with score ${result.score}%`);
  };

  const handleGradeTest = async (testId: string, studentId: string, score: number, feedback?: string) => {
    const key = `${testId}_${studentId}`;
    const student = profiles.find((p) => p.id === studentId);
    const existing = testResults[key];

    const updatedRecord: TestResultRecord = {
      test_id: testId,
      student_id: studentId,
      student_name: student?.name || existing?.student_name || 'Student',
      score,
      completed_at: existing?.completed_at || new Date().toLocaleDateString(),
      feedback: feedback || '',
    };

    setTestResults((prev) => ({ ...prev, [key]: updatedRecord }));

    try {
      await supabase.from('test_results').upsert({
        id: key,
        test_id: testId,
        student_id: studentId,
        score,
        feedback: feedback || '',
        graded_at: new Date().toISOString(),
        graded_by: currentUser?.name || 'Teacher',
      });
    } catch (e) {
      console.error('Error grading test in Supabase:', e);
    }

    recordAuditLog('EDIT_ACHIEVEMENT' as any, updatedRecord.student_name, `Teacher recorded test score: ${score}%`);
  };

  // 3. Assignments & Coursework
  const handleCreateAssignment = async (
    data: { title: string; className?: string; type?: 'assignment' | 'assessment' } | string
  ) => {
    if (typeof data === 'object' && data.type === 'assessment') {
      return handleCreateTest(data);
    }
    const title = typeof data === 'string' ? data : data.title;
    const className = typeof data === 'object' && data.className ? data.className : (targetClassForModal || '10-A');
    const newAss: AssignmentItem = {
      id: `ass-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title,
      class_name: className,
    };

    setAssignments((prev) => [newAss, ...prev]);
    try {
      await supabase.from('assignments').insert([newAss]);
    } catch (e) {}

    recordAuditLog('CREATE_ACHIEVEMENT' as any, title, `Published new homework assignment for ${className}`);
    alert(`Assignment "${title}" created successfully.`);
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    const assObj = assignments.find((a) => a.id === assignmentId);
    setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
    try {
      await supabase.from('assignments').delete().eq('id', assignmentId);
    } catch (e) {}

    if (assObj) {
      recordAuditLog('DELETE_ACHIEVEMENT' as any, assObj.title, `Deleted homework task`);
    }
  };

  const handleSubmitAssignment = async (submission: AssignmentSubmissionRecord) => {
    const key = `${submission.assignment_id}_${submission.student_id}`;
    setAssignmentSubmissions((prev) => ({ ...prev, [key]: submission }));

    try {
      await supabase.from('assignment_submissions').upsert({
        id: key,
        assignment_id: submission.assignment_id,
        student_id: submission.student_id,
        file_name: submission.file_name || '',
        file_url: submission.file_url || '',
        grade: submission.grade || '',
        feedback: submission.feedback || '',
        submitted_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error('Error saving assignment submission to Supabase:', e);
    }

    recordAuditLog('CREATE_ACHIEVEMENT' as any, submission.student_name, `Uploaded assignment file: ${submission.file_name || 'Homework'}`);
  };

  const handleGradeAssignment = async (assignmentId: string, studentId: string, grade: string, feedback?: string) => {
    const key = `${assignmentId}_${studentId}`;
    const student = profiles.find((p) => p.id === studentId);
    const existing = assignmentSubmissions[key];

    const updatedRecord: AssignmentSubmissionRecord = {
      assignment_id: assignmentId,
      student_id: studentId,
      student_name: student?.name || existing?.student_name || 'Student',
      file_name: existing?.file_name || 'Completed_Assignment.pdf',
      file_url: existing?.file_url || '',
      notes: existing?.notes || '',
      grade,
      feedback: feedback || '',
      status: 'graded',
      submitted_at: existing?.submitted_at || new Date().toLocaleDateString(),
    };

    setAssignmentSubmissions((prev) => ({ ...prev, [key]: updatedRecord }));

    try {
      await supabase.from('assignment_submissions').upsert({
        id: key,
        assignment_id: assignmentId,
        student_id: studentId,
        file_name: updatedRecord.file_name || '',
        file_url: updatedRecord.file_url || '',
        grade,
        feedback: feedback || '',
        graded_at: new Date().toISOString(),
        graded_by: currentUser?.name || 'Teacher',
      });
    } catch (e) {
      console.error('Error grading assignment in Supabase:', e);
    }

    recordAuditLog('EDIT_ACHIEVEMENT' as any, updatedRecord.student_name, `Teacher graded assignment: Grade ${grade}`);
  };

  // 4. Syllabus & Curriculum Coverage
  const handleAddTerm = async (name: string) => {
    const targetSubject = targetClassForTerm?.subject || currentUser?.subject || '';
    const targetClassId = targetClassForTerm?.id || '';
    const targetClassName = targetClassForTerm?.className || '';

    const newTerm: SyllabusTerm = {
      id: `term-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      order_index: syllabus.length + 1,
      subject: targetSubject,
      class_id: targetClassId,
      class_name: targetClassName,
      topics: [],
    };

    setSyllabus((prev) => [...prev, newTerm]);

    try {
      const { error } = await supabase.from('syllabus_terms').insert([
        {
          id: newTerm.id,
          name: newTerm.name,
          order_num: newTerm.order_index || 1,
          subject: targetSubject || 'General',
        },
      ]);
      if (error) console.warn('Supabase syllabus term notice:', error.message);
    } catch (e) {
      console.warn('Supabase syllabus term error:', e);
    }

    recordAuditLog('CREATE_ACHIEVEMENT' as any, name, `Added new syllabus term block for ${targetSubject || 'class'}`);
    alert(`Syllabus term "${name}" created successfully.`);
    loadAllData();
  };

  const handleDeleteTerm = async (termId: string) => {
    const termObj = syllabus.find((t) => t.id === termId);
    setSyllabus((prev) => prev.filter((t) => t.id !== termId));

    try {
      await supabase.from('syllabus_topics').delete().eq('term_id', termId);
      await supabase.from('syllabus_terms').delete().eq('id', termId);
    } catch (e) {
      console.warn('Supabase delete term error:', e);
    }

    if (termObj) {
      recordAuditLog('DELETE_ACHIEVEMENT' as any, termObj.name, `Removed syllabus term`);
    }
    loadAllData();
  };

  const handleAddTopic = async (termId: string, title: string) => {
    let targetTermId = termId;

    // Check if target term exists in current state
    const existingTerm = syllabus.find((t) => t.id === targetTermId);

    const newTopic: SyllabusTopic = {
      id: `topic-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      term_id: targetTermId,
      title,
      teacher_checked: false,
      student_checked: false,
    };

    if (!existingTerm) {
      // Auto-create a term for this classroom so the topic is guaranteed to save!
      const targetSubject = targetClassForTerm?.subject || currentUser?.subject || 'Curriculum';
      const autoTermId = `term-${Date.now()}`;
      newTopic.term_id = autoTermId;

      const newTerm: SyllabusTerm = {
        id: autoTermId,
        name: `${targetSubject} Curriculum`,
        subject: targetSubject,
        class_id: targetClassForTerm?.id || '',
        class_name: targetClassForTerm?.className || '',
        order_index: syllabus.length + 1,
        topics: [newTopic],
      };

      setSyllabus((prev) => [...prev, newTerm]);

      try {
        await supabase.from('syllabus_terms').insert([
          {
            id: newTerm.id,
            name: newTerm.name,
            order_num: newTerm.order_index || 1,
            subject: targetSubject || 'General',
          },
        ]);
        await supabase.from('syllabus_topics').insert([
          {
            id: newTopic.id,
            term_id: newTopic.term_id,
            title: newTopic.title,
            teacher_checked: false,
            student_checked: false,
          },
        ]);
      } catch (e) {
        console.warn('Supabase auto term/topic error:', e);
      }
    } else {
      setSyllabus((prev) =>
        prev.map((term) =>
          term.id === targetTermId ? { ...term, topics: [...(term.topics || []), newTopic] } : term
        )
      );

      try {
        await supabase.from('syllabus_topics').insert([
          {
            id: newTopic.id,
            term_id: newTopic.term_id,
            title: newTopic.title,
            teacher_checked: false,
            student_checked: false,
          },
        ]);
      } catch (e) {
        console.warn('Supabase insert topic error:', e);
      }
    }

    recordAuditLog('CREATE_ACHIEVEMENT' as any, title, `Added topic to syllabus`);
    alert(`Topic "${title}" added to syllabus.`);
    loadAllData();
  };

  const handleDeleteTopic = async (termId: string, topicId: string) => {
    setSyllabus((prev) =>
      prev.map((term) =>
        term.id === termId
          ? { ...term, topics: (term.topics || []).filter((tp) => tp.id !== topicId) }
          : term
      )
    );

    try {
      await supabase.from('syllabus_topics').delete().eq('id', topicId);
    } catch (e) {
      console.warn('Supabase delete topic error:', e);
    }
    loadAllData();
  };

  const handleToggleTopicCheck = async (
    termId: string,
    topicId: string,
    role: 'teacher' | 'student',
    isChecked: boolean,
    studentId?: string
  ) => {
    if (role === 'teacher') {
      setSyllabus((prev) =>
        prev.map((term) =>
          term.id === termId
            ? {
                ...term,
                topics: (term.topics || []).map((tp) =>
                  tp.id === topicId ? { ...tp, teacher_checked: isChecked } : tp
                ),
              }
            : term
        )
      );

      try {
        await supabase.from('syllabus_topics').update({ teacher_checked: isChecked }).eq('id', topicId);
      } catch (e) {
        console.error('Error updating teacher topic check in Supabase:', e);
      }
    } else {
      const effectiveStudentId = studentId || currentUser?.id || 'student';
      const key = `${effectiveStudentId}_${topicId}`;
      setStudentSyllabusProgress((prev) => ({ ...prev, [key]: isChecked }));

      try {
        await supabase.from('student_syllabus_progress').upsert({
          id: key,
          student_id: effectiveStudentId,
          topic_id: topicId,
          is_completed: isChecked,
          updated_at: new Date().toISOString(),
        });
      } catch (e) {
        console.error('Error updating student topic check in Supabase:', e);
      }
    }
  };

  // Audit Logging helper
  const recordAuditLog = useCallback(
    async (
      actionType: AuditLogItem['action_type'],
      targetTitle: string,
      details: string
    ) => {
      const newEntry: AuditLogItem = {
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        action_type: actionType,
        user_id: currentUser?.id || 'unknown',
        user_name: currentUser?.name || 'Student',
        user_role: currentUser?.role || 'student',
        target_title: targetTitle,
        details,
        created_at: new Date().toLocaleString(),
      };

      setAuditLogs((prev) => [newEntry, ...prev].slice(0, 200));

      try {
        await supabase.from('audit_logs').insert([
          {
            id: newEntry.id,
            action_type: newEntry.action_type,
            user_id: newEntry.user_id,
            user_name: newEntry.user_name,
            user_role: newEntry.user_role,
            target_title: newEntry.target_title,
            details: newEntry.details,
          },
        ]);
      } catch (e) {}
    },
    [currentUser]
  );

  // 4. Achievements
  const handleAddAchievement = async (
    title: string,
    description: string,
    fileName?: string,
    fileDataUrl?: string
  ) => {
    if (!currentUser) return;
    try {
      const generatedId = `ach-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      // Resolve matching student profile ID
      const matchedProfile = profiles.find(
        (p) =>
          (currentUser.id && p.id === currentUser.id) ||
          (p.email && currentUser.email && p.email.toLowerCase() === currentUser.email.toLowerCase())
      );
      const studentId = matchedProfile?.id || currentUser.id;

      const newAch: Achievement = {
        id: generatedId,
        student_id: studentId,
        title: title.trim(),
        description: description.trim(),
        file_name: fileName || '',
        file_url: fileDataUrl || '',
        created_at: new Date().toISOString(),
      };

      // 1. Optimistically add to UI state immediately
      setAchievements((prev) => [newAch, ...prev]);

      // 2. Insert into Supabase cloud table
      const payloadStr = JSON.stringify({
        text: description.trim(),
        fileName: fileName || '',
        fileUrl: fileDataUrl || '',
      });

      const { error } = await supabase.from('achievements').insert([
        {
          id: generatedId,
          student_id: studentId,
          title: title.trim(),
          desc_text: payloadStr,
          file_name: fileName || '',
          file_url: fileDataUrl || '',
        },
      ]);

      if (error) {
        console.warn('Achievement cloud insert notice:', error.message);
      }

      recordAuditLog('CREATE_ACHIEVEMENT', title, `Logged achievement with proof: ${fileName || 'none'}`);
      alert(`Achievement record for "${title}" saved successfully.`);
      loadAllData();
    } catch (err: any) {
      console.error('Achievement save error:', err);
      alert('Unable to save achievement record. Please try again.');
    }
  };

  const handleUpdateAchievement = async (
    id: string,
    title: string,
    description: string,
    fileName?: string,
    fileDataUrl?: string
  ) => {
    if (!currentUser) return;
    try {
      setAchievements((prev) =>
        prev.map((a) =>
          a.id === id
            ? {
                ...a,
                title,
                description,
                file_name: fileName || a.file_name || '',
                file_url: fileDataUrl || a.file_url || '',
              }
            : a
        )
      );

      const payload = JSON.stringify({
        text: description,
        fileName: fileName || '',
        fileUrl: fileDataUrl || '',
      });

      const { error } = await supabase
        .from('achievements')
        .update({
          title,
          desc_text: payload,
          file_name: fileName || '',
          file_url: fileDataUrl || '',
        })
        .eq('id', id);

      if (error) {
        console.warn('Achievement cloud update warning:', error.message);
      }

      recordAuditLog('EDIT_ACHIEVEMENT', title, `Updated details / certificate: ${fileName || 'none'}`);
      alert(`Achievement record for "${title}" updated successfully.`);
      loadAllData();
    } catch (err: any) {
      alert('Unable to update achievement record. Please try again.');
    }
  };

  const handleDeleteAchievement = async (id: string, title: string) => {
    if (!currentUser) return;
    try {
      setAchievements((prev) => prev.filter((a) => a.id !== id));

      const { error } = await supabase.from('achievements').delete().eq('id', id);
      if (error) {
        console.warn('Achievement cloud delete warning:', error.message);
      }

      recordAuditLog('DELETE_ACHIEVEMENT', title, 'Removed achievement record');
      loadAllData();
    } catch (err: any) {
      alert('Unable to delete achievement record. Please try again.');
    }
  };

  // 5. Subject Classrooms (Google Classroom Style)

  /**
   * Auto-enroll: given a class_name like "12-C" or "Grade 12-C",
   * return the IDs of all student profiles that belong to that class.
   * Matching rule: student grade contains the grade number AND class_letter matches the letter.
   */
  const resolveEnrolledStudents = (className: string, allProfiles: UserProfile[]): string[] => {
    // Normalise: strip "Grade", spaces → "12-C" or "12C"
    const normalised = className.toLowerCase().replace(/grade\s*/gi, '').trim(); // e.g. "12-c"
    const parts = normalised.split(/[-\s]+/);
    const gradeNum = parts.find((p) => /^\d+$/.test(p)) || '';
    const sectionLetter = parts.find((p) => /^[a-z]$/.test(p))?.toUpperCase() || '';

    if (!gradeNum) return []; // can't resolve without a grade number

    return allProfiles
      .filter((p) => {
        if (p.role !== 'student') return false;
        const pGradeNum = (p.grade || '').replace(/[^0-9]/g, '');
        const pLetter = (p.class_letter || '').toUpperCase().trim();
        if (pGradeNum !== gradeNum) return false;
        if (sectionLetter && pLetter !== sectionLetter) return false;
        return true;
      })
      .map((p) => p.id);
  };

  const handleCreateSubjectClass = async (classData: {
    name: string;
    subject: string;
    class_name: string;
    section: string;
    room: string;
    enrolled_student_ids: string[];
  }) => {
    if (!currentUser) return;

    // AUTO-ENROLL: find all students whose grade+class_letter matches the class_name
    // e.g. class_name "12-C" enrolls all students with grade containing "12" and class_letter "C"
    const autoEnrolledIds = resolveEnrolledStudents(classData.class_name, profiles);

    // Merge with any manually passed IDs (deduplicated)
    const mergedIds = Array.from(new Set([...autoEnrolledIds, ...classData.enrolled_student_ids]));

    const newClass: SubjectClass = {
      id: `class-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: classData.name,
      subject: classData.subject,
      class_name: classData.class_name,
      section: classData.section,
      room: classData.room,
      teacher_id: currentUser.id,
      teacher_name: currentUser.name,
      enrolled_student_ids: mergedIds,
      created_at: new Date().toISOString(),
    };

    setSubjectClasses((prev) => [newClass, ...prev]);

    try {
      const { error } = await supabase.from('subject_classes').insert([newClass]);
      if (error) console.error('Error inserting class to Supabase:', error.message);

      // Auto-seed grade assessment terms for the newly created classroom from Supabase master store
      const gMatch = newClass.class_name.match(/\d+/);
      const targetGrade = gMatch ? gMatch[0] : '10';
      const { data: cloudMasterTerms } = await supabase
        .from('achievements')
        .select('*')
        .eq('title', '__GRADE_ASSESSMENT_TERM__')
        .eq('student_id', targetGrade);

      if (cloudMasterTerms && cloudMasterTerms.length > 0) {
        const defaultDate = new Date().toISOString().slice(0, 10);
        const seedRows = cloudMasterTerms.map((m: any) => {
          let termObj: any = {};
          try { termObj = JSON.parse(m.desc_text || '{}'); } catch { termObj = {}; }
          const title = termObj.title || m.file_name || 'Assessment';
          const maxMarks = Number(termObj.maximum_marks || m.file_url || 40);
          const baseSlug = title.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30);
          return {
            id: `offline_term_g${targetGrade}_${baseSlug}_${newClass.id}`,
            class_id: newClass.id,
            teacher_id: newClass.teacher_id,
            title,
            assessment_date: defaultDate,
            maximum_marks: maxMarks,
            notes: '',
          };
        });
        await supabase.from('offline_assessments').upsert(seedRows as never[], { onConflict: 'id' });
      }
    } catch (e) {
      console.error('Error creating class in Supabase:', e);
    }

    recordAuditLog(
      'CREATE_ACHIEVEMENT' as any,
      newClass.name,
      `Teacher created classroom "${newClass.name}" with ${mergedIds.length} students auto-enrolled from ${classData.class_name}`
    );
    alert(`Classroom "${newClass.name}" created. ${mergedIds.length} students from ${classData.class_name} auto-enrolled.`);
  };

  const handleDeleteSubjectClass = async (id: string) => {
    setSubjectClasses((prev) => prev.filter((c) => c.id !== id));

    try {
      await supabase.from('subject_classes').delete().eq('id', id);
    } catch (e) {
      console.error('Error deleting class from Supabase:', e);
    }
    alert('Classroom removed successfully.');
  };

  const handleUpdateSubjectClass = async (
    classId: string,
    updatedData: {
      name: string;
      subject: string;
      class_name: string;
      section?: string;
      room?: string;
      enrolled_student_ids?: string[];
    }
  ) => {
    // Re-sync enrollment: auto-enroll all students matching the class_name
    const autoEnrolledIds = resolveEnrolledStudents(updatedData.class_name, profiles);
    const mergedIds = Array.from(
      new Set([...autoEnrolledIds, ...(updatedData.enrolled_student_ids || [])])
    );

    setSubjectClasses((prev) =>
      prev.map((c) =>
        c.id === classId
          ? {
              ...c,
              name: updatedData.name,
              subject: updatedData.subject,
              class_name: updatedData.class_name,
              section: updatedData.section || c.section,
              room: updatedData.room ?? c.room,
              enrolled_student_ids: mergedIds,
            }
          : c
      )
    );

    try {
      await supabase
        .from('subject_classes')
        .update({
          name: updatedData.name,
          subject: updatedData.subject,
          class_name: updatedData.class_name,
          section: updatedData.section,
          room: updatedData.room,
          enrolled_student_ids: mergedIds,
        })
        .eq('id', classId);
    } catch (e) {
      console.error('Update subject class error:', e);
    }

    recordAuditLog(
      'EDIT_ACHIEVEMENT' as any,
      updatedData.name,
      `Updated subject classroom (${updatedData.class_name}) — ${mergedIds.length} students enrolled`
    );
    alert(`Classroom "${updatedData.name}" updated. ${mergedIds.length} students enrolled.`);
  };

  /**
   * Backfill: for all existing classes that have an empty enrolled_student_ids,
   * auto-populate from the matching student profiles and persist to Supabase.
   * Call this once to fix current data.
   */
  const handleBackfillClassEnrollments = async () => {
    const classesToFix = subjectClasses.filter(
      (c) => !c.enrolled_student_ids || c.enrolled_student_ids.length === 0
    );
    if (classesToFix.length === 0) {
      alert('All classrooms already have students enrolled. Nothing to backfill.');
      return;
    }
    let fixedCount = 0;
    for (const cls of classesToFix) {
      const ids = resolveEnrolledStudents(cls.class_name, profiles);
      if (ids.length === 0) continue;
      setSubjectClasses((prev) =>
        prev.map((c) => (c.id === cls.id ? { ...c, enrolled_student_ids: ids } : c))
      );
      try {
        await supabase
          .from('subject_classes')
          .update({ enrolled_student_ids: ids })
          .eq('id', cls.id);
        fixedCount++;
      } catch (e) {
        console.error(`Backfill failed for class ${cls.name}:`, e);
      }
    }
    alert(`Backfill complete. Fixed ${fixedCount} of ${classesToFix.length} classrooms.`);
  };

  const handleUpdateClassEnrollment = async (classId: string, enrolledStudentIds: string[]) => {
    setSubjectClasses((prev) =>
      prev.map((c) => (c.id === classId ? { ...c, enrolled_student_ids: enrolledStudentIds } : c))
    );

    try {
      await supabase
        .from('subject_classes')
        .update({ enrolled_student_ids: enrolledStudentIds })
        .eq('id', classId);
    } catch (e) {
      console.error('Update class enrollment error:', e);
    }

    const cls = subjectClasses.find((c) => c.id === classId);
    if (cls) {
      recordAuditLog(
        'EDIT_ACHIEVEMENT' as any,
        cls.name,
        `Updated student enrollment (${enrolledStudentIds.length} students enrolled)`
      );
    }
  };

  // 6. Attendance (Pure Supabase Sync)
  const handleSaveAttendance = async (date: string, records: Record<string, string>) => {
    // 1. Immediate optimistic state update
    setAttendance((prev) => ({
      ...prev,
      [date]: { ...(prev[date] || {}), ...records },
    }));

    // 2. Delete and insert to Supabase for 100% reliability
    const studentIds = Object.keys(records);
    if (studentIds.length > 0) {
      try {
        await supabase
          .from('attendance')
          .delete()
          .eq('date', date)
          .in('student_id', studentIds);

        const rows = Object.entries(records).map(([student_id, status]) => ({
          date,
          student_id,
          status,
        }));
        await supabase.from('attendance').insert(rows);
      } catch (err: any) {
        console.error('Attendance sync error:', err);
      }
      loadAllData();
    }
  };

  // Student / Parent Apply or Update Authorized Leave / Sick Note
  const handleApplyLeave = async (
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
  ) => {
    if (!currentUser) return;
    const targetStudentId = studentId || currentUser.id;
    const leaveId = data.id || `leave_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    // If editing existing leave, clean up old attendance records that might no longer be in range
    if (data.id) {
      const oldLeave = leaveRequests.find((l) => l.id === data.id);
      if (oldLeave) {
        const oldStart = new Date(oldLeave.startDate);
        const oldEnd = new Date(oldLeave.endDate);
        for (let d = new Date(oldStart); d <= oldEnd; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().split('T')[0];
          await supabase
            .from('attendance')
            .delete()
            .eq('date', dateStr)
            .eq('student_id', targetStudentId);
        }
      }
    }

    // Collect all dates between startDate and endDate (inclusive)
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    const datesToMark: string[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      // Skip weekends (0 = Sunday, 6 = Saturday)
      const day = d.getDay();
      if (day !== 0 && day !== 6) {
        datesToMark.push(d.toISOString().split('T')[0]);
      }
    }

    if (datesToMark.length === 0) {
      alert('No school days selected. Weekends are automatically excluded.');
      return;
    }

    const leavePayload = {
      startDate: data.startDate,
      endDate: data.endDate,
      leaveType: data.leaveType,
      reason: data.reason,
      fileName: data.fileName || '',
      status: 'submitted',
      appliedAt: new Date().toISOString(),
    };

    // Optimistically update leaveRequests state
    const optimisticLeaveRecord: LeaveRequest = {
      id: leaveId,
      student_id: targetStudentId,
      startDate: data.startDate,
      endDate: data.endDate,
      leaveType: data.leaveType,
      reason: data.reason,
      fileName: data.fileName || '',
      fileUrl: data.fileUrl || '',
      created_at: new Date().toISOString(),
      status: 'submitted',
    };

    setLeaveRequests((prev) => {
      const filtered = prev.filter((l) => l.id !== leaveId);
      return [optimisticLeaveRecord, ...filtered];
    });

    // Save leave request to cloud achievements table without modifying attendance yet
    try {
      await supabase.from('achievements').upsert({
        id: leaveId,
        student_id: targetStudentId,
        title: '__LEAVE_REQUEST__',
        desc_text: JSON.stringify(leavePayload),
        file_name: data.fileName || '',
        file_url: data.fileUrl || '',
      });

      const dayCount = datesToMark.length;
      const displayRange =
        data.startDate === data.endDate
          ? data.startDate
          : `${data.startDate} → ${data.endDate}`;

      alert(
        `Permit Leave (PL) request submitted successfully (${displayRange}, ${dayCount} school day${dayCount > 1 ? 's' : ''}). It will be marked as Permit Leave on the attendance register once approved by your Class Teacher.`
      );
    } catch (err: any) {
      console.error('Leave submission error:', err);
      alert('Unable to sync leave request with the database. Please try again.');
    }
    loadAllData();
  };

  const handleApproveLeave = async (leaveId: string, studentId?: string) => {
    const targetLeave = leaveRequests.find((l) => l.id === leaveId);
    if (!targetLeave) return;
    const targetStudentId = studentId || targetLeave.student_id;

    // Collect all school days (excluding weekends)
    const start = new Date(targetLeave.startDate);
    const end = new Date(targetLeave.endDate);
    const datesToMark: string[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const day = d.getDay();
      if (day !== 0 && day !== 6) {
        datesToMark.push(d.toISOString().split('T')[0]);
      }
    }

    // Optimistically update attendance state
    setAttendance((prev) => {
      const updated = { ...prev };
      datesToMark.forEach((date) => {
        updated[date] = { ...(updated[date] || {}), [targetStudentId]: 'auth_absent' };
      });
      return updated;
    });

    // Optimistically update leaveRequests status to approved
    setLeaveRequests((prev) =>
      prev.map((l) => (l.id === leaveId ? { ...l, status: 'approved' } : l))
    );

    try {
      const updatedPayload = {
        startDate: targetLeave.startDate,
        endDate: targetLeave.endDate,
        leaveType: targetLeave.leaveType,
        reason: targetLeave.reason,
        fileName: targetLeave.fileName || '',
        status: 'approved',
        appliedAt: targetLeave.created_at,
        approvedAt: new Date().toISOString(),
      };

      await supabase.from('achievements').upsert({
        id: leaveId,
        student_id: targetStudentId,
        title: '__LEAVE_REQUEST__',
        desc_text: JSON.stringify(updatedPayload),
        file_name: targetLeave.fileName || '',
        file_url: targetLeave.fileUrl || '',
      });

      // Upsert auth_absent in attendance table for approved dates
      for (const date of datesToMark) {
        await supabase
          .from('attendance')
          .delete()
          .eq('date', date)
          .eq('student_id', targetStudentId);

        await supabase.from('attendance').insert({
          date,
          student_id: targetStudentId,
          status: 'auth_absent',
        });
      }

      alert(`Permit Leave Approved: ${datesToMark.length} date(s) registered as Permit Leave (PL).`);
    } catch (err) {
      console.error('Approve leave error:', err);
      alert('Error updating leave status in cloud.');
    }
    loadAllData();
  };

  const handleRejectLeave = async (leaveId: string, studentId?: string) => {
    const targetLeave = leaveRequests.find((l) => l.id === leaveId);
    if (!targetLeave) return;
    const targetStudentId = studentId || targetLeave.student_id;

    setLeaveRequests((prev) =>
      prev.map((l) => (l.id === leaveId ? { ...l, status: 'rejected' } : l))
    );

    try {
      const updatedPayload = {
        startDate: targetLeave.startDate,
        endDate: targetLeave.endDate,
        leaveType: targetLeave.leaveType,
        reason: targetLeave.reason,
        fileName: targetLeave.fileName || '',
        status: 'rejected',
        appliedAt: targetLeave.created_at,
        rejectedAt: new Date().toISOString(),
      };

      await supabase.from('achievements').upsert({
        id: leaveId,
        student_id: targetStudentId,
        title: '__LEAVE_REQUEST__',
        desc_text: JSON.stringify(updatedPayload),
        file_name: targetLeave.fileName || '',
        file_url: targetLeave.fileUrl || '',
      });

      // Also clear any auth_absent marks if previously approved
      const start = new Date(targetLeave.startDate);
      const end = new Date(targetLeave.endDate);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        await supabase
          .from('attendance')
          .delete()
          .eq('date', dateStr)
          .eq('student_id', targetStudentId);
      }
      alert('Permit Leave request marked as Rejected.');
    } catch (err) {
      console.error('Reject leave error:', err);
    }
    loadAllData();
  };

  const handleDeleteLeave = async (leaveId: string, studentId?: string) => {
    if (!confirm('Are you sure you want to cancel/delete this leave request?')) return;
    const targetStudentId = studentId || currentUser?.id;
    if (!targetStudentId) return;

    const targetLeave = leaveRequests.find((l) => l.id === leaveId);
    let datesToClear: string[] = [];
    if (targetLeave) {
      const start = new Date(targetLeave.startDate);
      const end = new Date(targetLeave.endDate);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        datesToClear.push(d.toISOString().split('T')[0]);
      }
    }

    setLeaveRequests((prev) => prev.filter((l) => l.id !== leaveId));

    try {
      await supabase.from('achievements').delete().eq('id', leaveId);

      for (const date of datesToClear) {
        await supabase
          .from('attendance')
          .delete()
          .eq('date', date)
          .eq('student_id', targetStudentId);
      }
    } catch (err) {
      console.error('Delete leave error:', err);
    }
    loadAllData();
  };

  // 6. Holistic Hub
  const handleCreateHubActivity = async (data: {
    title: string;
    type: string;
    description: string;
    date: string;
    videoUrl?: string;
    attachedFileName?: string;
    targetGrades: string[];
  }) => {
    await supabase.from('hub_activities').insert([
      {
        id: 'hub-' + Date.now(),
        title: data.title,
        type: data.type,
        description: data.description,
        date: data.date,
        video_url: data.videoUrl || '',
        attached_file_name: data.attachedFileName || '',
        target_grades: data.targetGrades,
        // Use user ID first (most reliable), fall back to name
        created_by: currentUser?.id || currentUser?.name || 'teacher',
      },
    ]);
    loadAllData();
  };

  const handleUpdateHubActivity = async (id: string, data: {
    title: string; type: string; description: string; date: string;
    videoUrl?: string; targetGrades: string[]; location?: string; maxCapacity?: number;
  }) => {
    await supabase.from('hub_activities').update({
      title: data.title,
      type: data.type,
      description: data.description,
      date: data.date,
      video_url: data.videoUrl || '',
      target_grades: data.targetGrades,
    }).eq('id', id);
    setEditingHubActivity(null);
    loadAllData();
  };

  const handleDeleteHubActivity = async (id: string) => {
    if (!confirm('Remove this activity from the Hub?')) return;
    await supabase.from('hub_activities').delete().eq('id', id);
    loadAllData();
  };

  const handleToggleHubEnrollment = async (activityId: string) => {
    if (!currentUser) return;
    const act = hubActivities.find((a) => a.id === activityId);
    if (!act) return;

    const isEnrolled = (act.enrolled_student_ids || []).includes(currentUser.id);
    if (isEnrolled) {
      await supabase
        .from('hub_enrollments')
        .delete()
        .eq('activity_id', activityId)
        .eq('student_id', currentUser.id);
    } else {
      await supabase
        .from('hub_enrollments')
        .insert([{ activity_id: activityId, student_id: currentUser.id }]);
    }
    loadAllData();
  };

  // 7. Parent Documents
  const handleUploadParentDocument = async (docType: string, fileName: string, studentId?: string, fileDataUrl?: string) => {
    if (!currentUser) return;
    const targetStudentId = studentId || currentUser.id;
    const today = new Date().toISOString().split('T')[0];
    const generatedDocId = `doc_${Date.now()}`;
    const fileRecordKey = `docfile_${targetStudentId}_${encodeURIComponent(docType)}`;

    // 1. Optimistic state update so UI updates immediately
    const optimisticDoc: ParentDocument = {
      id: generatedDocId,
      student_id: targetStudentId,
      doc_type: docType,
      status: 'submitted',
      file_name: fileName,
      file_url: fileDataUrl,
      uploaded_at: today,
    };

    setParentDocuments((prev) => {
      const filtered = prev.filter((d) => !(d.student_id === targetStudentId && d.doc_type === docType));
      return [...filtered, optimisticDoc];
    });

    try {
      // 2. Persist record in parent_documents table
      const { data: existing } = await supabase
        .from('parent_documents')
        .select('id')
        .eq('student_id', targetStudentId)
        .eq('doc_type', docType)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('parent_documents')
          .update({
            status: 'submitted',
            file_name: fileName,
            uploaded_at: today,
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('parent_documents')
          .insert([
            {
              id: generatedDocId,
              student_id: targetStudentId,
              doc_type: docType,
              status: 'submitted',
              file_name: fileName,
              uploaded_at: today,
            },
          ]);
      }

      // 3. Persist file content/data URL in Supabase cloud achievements store
      if (fileDataUrl) {
        await supabase.from('achievements').upsert({
          id: fileRecordKey,
          student_id: targetStudentId,
          title: '__PARENT_DOC__',
          desc_text: docType,
          file_name: fileName,
          file_url: fileDataUrl,
        });
      }

      loadAllData();
    } catch (err) {
      console.warn('Supabase parent document sync notice:', err);
    }
  };

  const handleRemoveParentDocument = async (docType: string, studentId?: string) => {
    if (!currentUser) return;
    const targetStudentId = studentId || currentUser.id;
    const fileRecordKey = `docfile_${targetStudentId}_${encodeURIComponent(docType)}`;

    // 1. Optimistic state update
    setParentDocuments((prev) =>
      prev.map((d) =>
        d.student_id === targetStudentId && d.doc_type === docType
          ? { ...d, status: 'pending', file_name: '', file_url: '', uploaded_at: '' }
          : d
      )
    );

    try {
      await supabase
        .from('parent_documents')
        .update({ status: 'pending', file_name: '', uploaded_at: '' })
        .eq('student_id', targetStudentId)
        .eq('doc_type', docType);

      await supabase.from('achievements').delete().eq('id', fileRecordKey);

      loadAllData();
    } catch (err) {
      console.warn('Supabase parent document remove notice:', err);
    }
  };

  // 7b. Parent-Student Link Requests
  const handleCreateLinkRequest = async (data: {
    studentId: string;
    studentName: string;
    studentAdmissionNumber: string;
    studentGrade: string;
    relationship: string;
    notes?: string;
  }) => {
    if (!currentUser) return;
    try {
      const { error } = await supabase.from('parent_student_link_requests').upsert(
        [
          {
            parent_id: currentUser.id,
            parent_name: currentUser.name,
            parent_email: currentUser.email,
            student_id: data.studentId,
            student_name: data.studentName,
            student_admission_number: data.studentAdmissionNumber,
            student_grade: data.studentGrade,
            relationship: data.relationship,
            notes: data.notes || '',
            status: 'pending',
            updated_at: new Date().toISOString(),
          },
        ],
        { onConflict: 'parent_id,student_id' }
      );

      if (error) {
        console.warn('Supabase link request table notice:', error.message);
        // Fallback: If table is not created in Supabase yet, save optimistic link request locally
        const newLocalReq: ParentStudentLinkRequest = {
          id: `req_${Date.now()}`,
          parent_id: currentUser.id,
          parent_name: currentUser.name,
          parent_email: currentUser.email,
          student_id: data.studentId,
          student_name: data.studentName,
          student_admission_number: data.studentAdmissionNumber,
          student_grade: data.studentGrade,
          relationship: data.relationship,
          notes: data.notes || '',
          status: 'pending',
          created_at: new Date().toISOString(),
        };
        setLinkRequests((prev) => [newLocalReq, ...prev.filter((r) => r.student_id !== data.studentId)]);
      }

      alert(`Verification request submitted: Your link request for "${data.studentName}" (${data.studentAdmissionNumber}) has been submitted to the School Administration for review.`);
      loadAllData();
    } catch (err: any) {
      console.error('Link request submit error:', err);
      alert('Your verification request has been queued for School Administration review.');
    }
  };

  const handleApproveLinkRequest = async (requestId: string) => {
    const req = linkRequests.find((r) => r.id === requestId);
    if (!req) return;

    try {
      // 1. Mark request approved in Supabase (if table exists)
      try {
        await supabase
          .from('parent_student_link_requests')
          .update({ status: 'approved', updated_at: new Date().toISOString() })
          .eq('id', requestId);
      } catch (e) {}

      // 2. Add student_id to parent's linked_student_ids array
      const parentProf = profiles.find(
        (p) => p.id === req.parent_id || p.email?.toLowerCase() === req.parent_email?.toLowerCase()
      );
      if (parentProf) {
        const currentLinks = parentProf.linked_student_ids || [];
        if (!currentLinks.includes(req.student_id)) {
          const updatedLinks = [...currentLinks, req.student_id];
          await supabase
            .from('profiles')
            .update({ linked_student_ids: updatedLinks })
            .eq('id', parentProf.id);

          setProfiles((prev) =>
            prev.map((p) => (p.id === parentProf.id ? { ...p, linked_student_ids: updatedLinks } : p))
          );
        }
      }

      setLinkRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status: 'approved' } : r))
      );

      alert(`Approved: Student "${req.student_name}" is now linked to parent account "${req.parent_name}".`);
      loadAllData();
    } catch (err: any) {
      console.error('Approve link error:', err);
      alert('Unable to approve link request. Please try again.');
    }
  };

  const handleRejectLinkRequest = async (requestId: string) => {
    try {
      try {
        await supabase
          .from('parent_student_link_requests')
          .update({ status: 'rejected', updated_at: new Date().toISOString() })
          .eq('id', requestId);
      } catch (e) {}

      setLinkRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status: 'rejected' } : r))
      );

      alert('The link request has been marked as rejected.');
      loadAllData();
    } catch (err: any) {
      console.error('Reject link error:', err);
      alert('Unable to update request status. Please try again.');
    }
  };

  // 7. Class Resources (Full-Page Inline - Pure Supabase)
  const handleCreateResource = async (resourceData: {
    class_id: string;
    title: string;
    description?: string;
    resource_type: ResourceType;
    file_name?: string;
    file_url?: string;
    file_size?: string;
    external_link?: string;
    topic_tag?: string;
  }) => {
    const newResource: ClassResource = {
      id: `res-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      class_id: resourceData.class_id,
      teacher_id: currentUser?.id || 'teacher',
      teacher_name: currentUser?.name || 'Teacher',
      title: resourceData.title.trim(),
      description: resourceData.description?.trim() || '',
      resource_type: resourceData.resource_type,
      file_name: resourceData.file_name || '',
      file_url: resourceData.file_url || '',
      file_size: resourceData.file_size || '',
      external_link: resourceData.external_link?.trim() || '',
      topic_tag: resourceData.topic_tag?.trim() || '',
      created_at: new Date().toISOString(),
    };

    setClassResources((prev) => [newResource, ...prev]);

    try {
      await supabase.from('class_resources').insert([newResource]);
    } catch (e) {
      console.error('Error inserting class resource:', e);
    }

    recordAuditLog(
      'CREATE_ACHIEVEMENT' as any,
      newResource.title,
      `Uploaded study resource (${newResource.resource_type.toUpperCase()}) for classroom`
    );
  };

  const handleDeleteResource = async (resourceId: string) => {
    const resObj = classResources.find((r) => r.id === resourceId);
    setClassResources((prev) => prev.filter((r) => r.id !== resourceId));

    try {
      await supabase.from('class_resources').delete().eq('id', resourceId);
    } catch (e) {
      console.error('Error deleting class resource:', e);
    }

    if (resObj) {
      recordAuditLog(
        'DELETE_ACHIEVEMENT' as any,
        resObj.title,
        `Deleted class learning resource`
      );
    }
  };

  // 8. Class Broadcast Announcements (Full-Page Inline - Pure Supabase)
  const handleCreateBroadcast = async (broadcastData: {
    class_id: string;
    title: string;
    content: string;
    is_pinned?: boolean;
    priority?: 'normal' | 'important' | 'urgent';
    tagged_resource_ids?: string[];
  }) => {
    const newBroadcast: ClassBroadcast = {
      id: `cast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      class_id: broadcastData.class_id,
      teacher_id: currentUser?.id || 'teacher',
      teacher_name: currentUser?.name || 'Teacher',
      title: broadcastData.title.trim(),
      content: broadcastData.content.trim(),
      is_pinned: !!broadcastData.is_pinned,
      priority: broadcastData.priority || 'normal',
      tagged_resource_ids: broadcastData.tagged_resource_ids || [],
      created_at: new Date().toISOString(),
    };

    setClassBroadcasts((prev) => [newBroadcast, ...prev]);

    try {
      await supabase.from('class_broadcasts').insert([newBroadcast]);
    } catch (e) {
      console.error('Error inserting class broadcast:', e);
    }

    recordAuditLog(
      'CREATE_ACHIEVEMENT' as any,
      newBroadcast.title,
      `Broadcasted announcement to class with ${newBroadcast.tagged_resource_ids?.length || 0} tagged resources`
    );
  };

  const handleDeleteBroadcast = async (broadcastId: string) => {
    setClassBroadcasts((prev) => prev.filter((b) => b.id !== broadcastId));

    try {
      await supabase.from('class_broadcasts').delete().eq('id', broadcastId);
    } catch (e) {
      console.error('Error deleting class broadcast:', e);
    }
  };

  const handleTogglePinBroadcast = async (broadcastId: string) => {
    let newPinState = false;
    setClassBroadcasts((prev) =>
      prev.map((b) => {
        if (b.id === broadcastId) {
          newPinState = !b.is_pinned;
          return { ...b, is_pinned: newPinState };
        }
        return b;
      })
    );

    try {
      await supabase
        .from('class_broadcasts')
        .update({ is_pinned: newPinState })
        .eq('id', broadcastId);
    } catch (e) {}
  };

  // Filter students profile list for dropdowns
  const students: Student[] = useMemo(
    () =>
      profiles
        .filter((p) => p.role === 'student')
        .map((p) => ({
          id: p.id,
          name: p.name,
          email: p.email,
          grade: p.grade,
          class_letter: p.class_letter,
          admission_number: p.admission_number || p.user_code,
          user_code: p.user_code,
        })),
    [profiles]
  );

  const allStudentProfiles = useMemo(
    () => profiles.filter((p) => p.role === 'student'),
    [profiles]
  );

  // Compute linked students for active parent user
  const linkedStudentsForParent: Student[] = useMemo(() => {
    if (!currentUser || currentUser.role !== 'parent') return [];
    const ids = currentUser.linked_student_ids || [];
    return profiles
      .filter((p) => p.role === 'student' && ids.includes(p.id))
      .map((p) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        grade: p.grade,
        class_letter: p.class_letter,
        admission_number: p.admission_number || p.user_code,
        user_code: p.user_code,
      }));
  }, [currentUser, profiles]);

  return (
    <PortalNavigationProvider initialUser={currentUser}>
      {/* Missing Schema Warning Banner */}
      {schemaError && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            zIndex: 9999,
            background: '#FFF3CD',
            color: '#856404',
            padding: '12px 24px',
            fontSize: 13,
            fontWeight: 600,
            borderBottom: '1px solid #FFEEBA',
            textAlign: 'center',
          }}
        >
          Notice: {schemaError}
        </div>
      )}

      <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {!isMounted ? (
        <div style={{ minHeight: '100vh', width: '100vw', background: '#FAF9F6' }} />
      ) : currentUser === null ? (
        <LoginView onLoginSuccess={handleLoginSuccess} />
      ) : currentUser.role === 'student' ? (
        <StudentDashboard
          currentStudent={currentUser}
          tests={tests}
          assignments={assignments}
          syllabus={syllabus}
          achievements={achievements}
          leaveRequests={leaveRequests}
          attendance={attendance}
          hubActivities={hubActivities}
          subjectClasses={subjectClasses}
          classResources={classResources}
          classBroadcasts={classBroadcasts}
          testResults={testResults}
          assignmentSubmissions={assignmentSubmissions}
          studentSyllabusProgress={studentSyllabusProgress}
          onSubmitTest={handleSaveTestResult}
          onSubmitAssignment={handleSubmitAssignment}
          onToggleTopicCheck={handleToggleTopicCheck}
          onAddAchievementClick={() => setIsAddAwardOpen(true)}
          onUpdateAchievement={handleUpdateAchievement}
          onDeleteAchievement={handleDeleteAchievement}
          onToggleHubEnrollment={handleToggleHubEnrollment}
          onOpenVideoModal={(act) => setSelectedVideoActivity(act)}
          onApplyLeave={handleApplyLeave}
          onDeleteLeave={handleDeleteLeave}
          onUpdateCurrentUser={handleUpdateCurrentUser}
          onRefreshData={loadAllData}
          onSignOut={handleSignOut}
        />
      ) : currentUser.role === 'teacher' ? (
        <TeacherDashboard
          currentUser={currentUser}
          profiles={profiles}
          tests={tests}
          assignments={assignments}
          syllabus={syllabus}
          achievements={achievements}
          attendance={attendance}
          hubActivities={hubActivities}
          subjectClasses={subjectClasses}
          classResources={classResources}
          classBroadcasts={classBroadcasts}
          testResults={testResults}
          assignmentSubmissions={assignmentSubmissions}
          onCreateResource={handleCreateResource}
          onDeleteResource={handleDeleteResource}
          onCreateBroadcast={handleCreateBroadcast}
          onDeleteBroadcast={handleDeleteBroadcast}
          onTogglePinBroadcast={handleTogglePinBroadcast}
          onOpenCreateClassModal={() => setIsCreateClassOpen(true)}
          onUpdateSubjectClass={handleUpdateSubjectClass}
          onDeleteSubjectClass={handleDeleteSubjectClass}
          onUpdateClassEnrollment={handleUpdateClassEnrollment}
          onOpenCreateTestModal={(activeClass) => {
            if (activeClass) setTargetClassForModal(activeClass);
            setIsCreateTestOpen(true);
          }}
          onDeleteTest={handleDeleteTest}
          onGradeTest={handleGradeTest}
          onOpenCreateAssignmentModal={(activeClass) => {
            if (activeClass) setTargetClassForModal(activeClass);
            setIsCreateAssignmentOpen(true);
          }}
          onDeleteAssignment={handleDeleteAssignment}
          onGradeAssignment={handleGradeAssignment}
          onOpenAddTermModal={(classCtx) => {
            setTargetClassForTerm(classCtx || null);
            setIsAddTermOpen(true);
          }}
          onDeleteTerm={handleDeleteTerm}
          onOpenAddTopicModal={(termId) => {
            setSelectedTermForTopic(termId);
            setIsAddTopicOpen(true);
          }}
          onDeleteTopic={handleDeleteTopic}
          onToggleTopicCheck={handleToggleTopicCheck}
          onSaveAttendance={handleSaveAttendance}
          leaveRequests={leaveRequests}
          onApproveLeave={handleApproveLeave}
          onRejectLeave={handleRejectLeave}
          onOpenCreateHubActivityModal={() => setIsCreateHubActivityOpen(true)}
          onDeleteHubActivity={handleDeleteHubActivity}
          onEditHubActivity={(act) => setEditingHubActivity(act)}
          onUpdateCurrentUser={handleUpdateCurrentUser}
          onRefreshData={loadAllData}
          onSignOut={handleSignOut}
        />
      ) : isPrincipalUser(currentUser) || currentUser.role === 'principal' ? (
        <PrincipalDashboard
          currentUser={currentUser}
          profiles={profiles}
          subjectClasses={subjectClasses}
          tests={tests}
          syllabus={syllabus}
          attendance={attendance}
          testResults={testResults}
          achievements={achievements}
          hubActivities={hubActivities}
          parentDocuments={parentDocuments}
          onSignOut={handleSignOut}
          onRefreshData={loadAllData}
        />
      ) : currentUser.role === 'admin' ? (
        <AdminDashboard
          currentUser={currentUser}
          profiles={profiles}
          parentDocuments={parentDocuments}
          hubActivities={hubActivities}
          subjectClasses={subjectClasses}
          linkRequests={linkRequests}
          tests={tests}
          syllabus={syllabus}
          attendance={attendance}
          testResults={testResults}
          onOpenProvisionModal={() => setIsProvisionUserOpen(true)}
          onOpenBulkModal={() => setIsBulkImportOpen(true)}
          onEditUser={(user) => setEditingUser(user)}
          onUpdateUser={handleUpdateUser}
          onDeleteUser={handleDeleteUser}
          onApproveLinkRequest={handleApproveLinkRequest}
          onRejectLinkRequest={handleRejectLinkRequest}
          onSignOut={handleSignOut}
          onRefreshData={loadAllData}
        />
      ) : (
        <ParentDashboard
          currentUser={currentUser}
          linkedStudents={linkedStudentsForParent}
          allStudentProfiles={allStudentProfiles}
          tests={tests}
          assignments={assignments}
          syllabus={syllabus}
          attendance={attendance}
          parentDocuments={parentDocuments}
          hubActivities={hubActivities}
          achievements={achievements}
          leaveRequests={leaveRequests}
          classBroadcasts={classBroadcasts}
          subjectClasses={subjectClasses}
          linkRequests={linkRequests}
          onUploadDoc={handleUploadParentDocument}
          onRemoveDoc={handleRemoveParentDocument}
          onOpenVideoModal={(act) => setSelectedVideoActivity(act)}
          onRequestChildLink={handleCreateLinkRequest}
          onApplyLeave={handleApplyLeave}
          onDeleteLeave={handleDeleteLeave}
          onUpdateCurrentUser={handleUpdateCurrentUser}
          onRefreshData={loadAllData}
          onSignOut={handleSignOut}
        />
      )}

      {/* AI Copilot — flex sibling, pushes dashboard content */}
      <AiChatbot
        currentUser={currentUser}
        profiles={profiles}
        subjectClasses={subjectClasses}
        tests={tests}
        assignments={assignments}
        syllabus={syllabus}
        attendance={attendance}
        classResources={classResources}
        classBroadcasts={classBroadcasts}
        achievements={achievements}
        leaveRequests={leaveRequests}
        hubActivities={hubActivities}
        parentDocuments={parentDocuments}
        linkRequests={linkRequests}
        testResults={testResults}
        assignmentSubmissions={assignmentSubmissions}
        studentSyllabusProgress={studentSyllabusProgress}
      />
      </div>

      {/* Modals */}
      <VideoPlayerModal
        activity={selectedVideoActivity}
        onClose={() => setSelectedVideoActivity(null)}
      />

      <AddAwardModal
        isOpen={isAddAwardOpen}
        onClose={() => setIsAddAwardOpen(false)}
        onSubmit={handleAddAchievement}
      />

      <AddTermModal
        isOpen={isAddTermOpen}
        onClose={() => setIsAddTermOpen(false)}
        onSubmit={handleAddTerm}
      />

      <AddTopicModal
        isOpen={isAddTopicOpen}
        terms={syllabus}
        selectedTermId={selectedTermForTopic}
        onClose={() => setIsAddTopicOpen(false)}
        onSubmit={handleAddTopic}
      />

      <CreateTestModal
        isOpen={isCreateTestOpen}
        activeClass={targetClassForModal}
        onClose={() => setIsCreateTestOpen(false)}
        onSubmit={handleCreateTest}
      />

      <CreateAssignmentModal
        isOpen={isCreateAssignmentOpen}
        activeClass={targetClassForModal}
        onClose={() => setIsCreateAssignmentOpen(false)}
        onSubmit={handleCreateAssignment}
        onSwitchToTestModal={(activeClass) => {
          setTargetClassForModal(activeClass || '');
          setIsCreateAssignmentOpen(false);
          setIsCreateTestOpen(true);
        }}
      />

      <CreateHubActivityModal
        isOpen={isCreateHubActivityOpen || !!editingHubActivity}
        onClose={() => { setIsCreateHubActivityOpen(false); setEditingHubActivity(null); }}
        onSubmit={handleCreateHubActivity}
        onUpdate={handleUpdateHubActivity}
        editActivity={editingHubActivity}
        teacherClass={
          (() => {
            const info = extractClassTeacherInfo(currentUser, subjectClasses);
            return info.isClassTeacher ? info.classKey : (currentUser?.assigned_class || undefined);
          })()
        }
        userRole={currentUser?.role}
      />

      <ProvisionUserModal
        isOpen={isProvisionUserOpen}
        profiles={profiles}
        subjectClasses={subjectClasses}
        onClose={() => setIsProvisionUserOpen(false)}
        onSubmit={handleProvisionUser}
      />

      <BulkImportModal
        isOpen={isBulkImportOpen}
        profiles={profiles}
        onClose={() => setIsBulkImportOpen(false)}
        onBulkSubmit={handleBulkImportUsers}
      />

      <EditUserModal
        isOpen={!!editingUser}
        user={editingUser}
        profiles={profiles}
        parentDocuments={parentDocuments}
        subjectClasses={subjectClasses}
        onClose={() => setEditingUser(null)}
        onSubmit={handleUpdateUser}
      />
      {/* Create Subject Class Modal */}
      {currentUser && (
        <CreateSubjectClassModal
          isOpen={isCreateClassOpen}
          teacher={currentUser}
          profiles={profiles}
          onClose={() => setIsCreateClassOpen(false)}
          onSubmit={handleCreateSubjectClass}
        />
      )}

    </PortalNavigationProvider>
  );
}
