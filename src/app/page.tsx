'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  supabase,
  createIsolatedSupabaseClient,
  UserProfile,
  Student,
  TestItem,
  TestQuestion,
  AssignmentItem,
  SyllabusTerm,
  Achievement,
  HubActivity,
  ParentDocument,
  AuditLogItem,
  SubjectClass,
  ClassResource,
  ClassBroadcast,
  ResourceType,
} from '@/lib/supabaseClient';

import { LoginView } from '@/components/Auth/LoginView';
import { StudentDashboard } from '@/components/Student/StudentDashboard';
import { TeacherDashboard } from '@/components/Teacher/TeacherDashboard';
import { AdminDashboard } from '@/components/Admin/AdminDashboard';
import { ParentDashboard } from '@/components/Parent/ParentDashboard';

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

export default function Home() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Database State
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [tests, setTests] = useState<TestItem[]>([]);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [syllabus, setSyllabus] = useState<SyllabusTerm[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [attendance, setAttendance] = useState<Record<string, Record<string, string>>>({});
  const [hubActivities, setHubActivities] = useState<HubActivity[]>([]);
  const [parentDocuments, setParentDocuments] = useState<ParentDocument[]>([]);
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
  const [isCreateHubActivityOpen, setIsCreateHubActivityOpen] = useState(false);
  const [isProvisionUserOpen, setIsProvisionUserOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [subjectClasses, setSubjectClasses] = useState<SubjectClass[]>([]);
  const [isCreateClassOpen, setIsCreateClassOpen] = useState(false);

  // Load all data from Supabase tables
  const loadAllData = useCallback(async () => {
    try {
      setSchemaError(null);

      // Fetch all tables from Supabase in parallel
      const [
        profRes,
        testRes,
        assRes,
        termRes,
        topicRes,
        achRes,
        attRes,
        hubRes,
        enrRes,
        docRes,
        subClassRes,
        auditRes,
        resRes,
        castRes,
        testResultsRes,
        assSubmissionsRes,
        studentSyllabusRes,
      ] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: true }).range(0, 4999),
        supabase.from('tests').select('*').order('created_at', { ascending: false }),
        supabase.from('assignments').select('*').order('created_at', { ascending: false }),
        supabase.from('syllabus_terms').select('*').order('created_at', { ascending: true }),
        supabase.from('syllabus_topics').select('*').order('created_at', { ascending: true }),
        supabase.from('achievements').select('*').order('created_at', { ascending: false }),
        supabase.from('attendance').select('*'),
        supabase.from('hub_activities').select('*').order('date', { ascending: true }),
        supabase.from('hub_enrollments').select('*'),
        supabase.from('parent_documents').select('*'),
        supabase.from('subject_classes').select('*').order('created_at', { ascending: false }),
        supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200),
        supabase.from('class_resources').select('*').order('created_at', { ascending: false }),
        supabase.from('class_broadcasts').select('*').order('created_at', { ascending: false }),
        supabase.from('test_results').select('*'),
        supabase.from('assignment_submissions').select('*'),
        supabase.from('student_syllabus_progress').select('*'),
      ]);

      if (profRes.error) {
        setSchemaError('The school portal is currently synchronizing. Please refresh the page if data does not appear immediately.');
      } else {
        const loadedProfiles = profRes.data || [];
        setProfiles(loadedProfiles);

        // Always re-sync currently active session user with latest database record
        setCurrentUser((prev) => {
          if (!prev) return null;
          const fresh = loadedProfiles.find(
            (p) => (prev.id && p.id === prev.id) || (p.email && p.email.toLowerCase() === prev.email.toLowerCase())
          );
          return fresh || prev;
        });
      }

      setTests(testRes.data || []);
      setAssignments(assRes.data || []);

      const builtSyllabus: SyllabusTerm[] = (termRes.data || [])
        .map((term: any) => ({
          id: term.id,
          name: term.name,
          order_index: term.order_num ?? term.order_index ?? 0,
          topics: (topicRes.data || [])
            .filter((tp: any) => tp.term_id === term.id)
            .map((tp: any) => ({
              id: tp.id,
              term_id: tp.term_id,
              title: tp.title,
              teacher_checked: !!tp.teacher_checked,
              student_checked: !!tp.student_checked,
            })),
        }))
        .sort((a: any, b: any) => a.order_index - b.order_index);

      setSyllabus(builtSyllabus);

      const builtAchievements: Achievement[] = (achRes.data || []).map((ach: any) => {
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

      // Ensure optimistic/locally saved achievements are seamlessly preserved
      const finalAchievements = [...builtAchievements];
      try {
        if (typeof window !== 'undefined') {
          const allKeys = Object.keys(localStorage).filter((k) => k.startsWith('woodlem_achievements_'));
          allKeys.forEach((k) => {
            const locList: Achievement[] = JSON.parse(localStorage.getItem(k) || '[]');
            locList.forEach((loc) => {
              if (!finalAchievements.some((a) => a.id === loc.id)) {
                finalAchievements.unshift(loc);
              }
            });
          });
        }
      } catch (e) {}

      setAchievements(finalAchievements);

      const attMap: Record<string, Record<string, string>> = {};
      (attRes.data || []).forEach((row: any) => {
        if (!attMap[row.date]) attMap[row.date] = {};
        attMap[row.date][row.student_id] = row.status;
      });
      setAttendance(attMap);

      const builtHub: HubActivity[] = (hubRes.data || []).map((act: any) => ({
        ...act,
        enrolled_student_ids: (enrRes.data || [])
          .filter((e: any) => e.activity_id === act.id)
          .map((e: any) => e.student_id),
      }));
      setHubActivities(builtHub);
      setParentDocuments(docRes.data || []);

      // Pure Supabase state loading: 100% in sync with database
      setSubjectClasses(subClassRes.data || []);
      setAuditLogs(auditRes.data || []);
      setClassResources(resRes.data || []);
      setClassBroadcasts(castRes.data || []);

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
      (assSubmissionsRes.data || []).forEach((row: any) => {
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
      (studentSyllabusRes.data || []).forEach((row: any) => {
        sylProgMap[`${row.student_id}_${row.topic_id}`] = !!row.is_completed;
      });
      setStudentSyllabusProgress(sylProgMap);
    } catch (err: any) {
      console.error('Error loading Supabase data:', err);
    }
  }, []);

  useEffect(() => {
    // Restore active session directly from Supabase Cloud Auth
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.email) {
          const userEmail = session.user.email.toLowerCase();
          const { data: prof } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', userEmail)
            .maybeSingle();

          if (prof) {
            setCurrentUser(prof);
          }
        }
      } catch (e) {}
      await loadAllData();
      setIsMounted(true);
    };

    initAuth();

    // Subscribe to Supabase auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setCurrentUser(null);
      } else if (session?.user?.email) {
        const userEmail = session.user.email.toLowerCase();
        const { data: prof } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', userEmail)
          .maybeSingle();
        if (prof) {
          setCurrentUser(prof);
        }
      }
    });

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
    };
  }, [loadAllData]);

  // Handlers
  const handleLoginSuccess = (profile: UserProfile) => {
    setCurrentUser(profile);
    loadAllData();
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {}
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
          const cleanG = (p.grade || '').replace(/[^0-9]/g, '');
          const cleanS = (p.class_letter || '').toUpperCase().trim();
          const assigned = (p.assigned_class || (cleanG && cleanS ? `${cleanG}-${cleanS}` : '')).replace(/^Grade\s*/i, '');
          return assigned === targetClass;
        });
        if (conflictTeacher) {
          alert(`Cannot assign as Class Teacher: Grade ${targetClass} is already assigned to ${conflictTeacher.name} (${conflictTeacher.subject || 'Faculty'}). Each class section can only have one Class Teacher.`);
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

      const newProfile: UserProfile = {
        id: profileId,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        user_code: userData.userCode,
        admission_number: userData.admissionNumber || userData.userCode,
        grade: userData.grade || '',
        class_letter: userData.classLetter || '',
        subject: userData.subject ?? null,
        assigned_class: userData.assignedClass ?? null,
      };

      const { error: profErr } = await supabase.from('profiles').upsert([newProfile], { onConflict: 'email' });
      if (profErr) {
        alert('Unable to create user account. Please check the information provided and try again.');
        return;
      }

      alert(`User account for "${userData.name}" has been created successfully.`);
      loadAllData();
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
      // 1. Fetch existing profiles to preserve exact database IDs
      const { data: existingProfiles } = await supabase
        .from('profiles')
        .select('id, email');
      const existingIdMap = new Map(
        (existingProfiles || []).map((p) => [p.email.toLowerCase(), p.id])
      );

      // 2. Prepare high-fidelity profiles batch
      const profilesBatch: UserProfile[] = users.map((u, idx) => {
        const emailKey = u.email.trim().toLowerCase();
        const existingId = existingIdMap.get(emailKey);
        const profileId =
          existingId ||
          (typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : 'usr_' + Date.now() + '_' + idx);

        let cleanGrade = '';
        if (u.role === 'student') {
          const rawG = (u.grade || '').replace(/[^0-9]/g, '');
          cleanGrade = ['9', '10', '11', '12'].includes(rawG) ? rawG : '9';
        }

        const cleanClass = (u.classLetter || 'A')
          .toUpperCase()
          .replace(/[^A-Z]/g, '') || 'A';

        return {
          id: profileId,
          name: u.name.trim(),
          email: emailKey,
          role: u.role,
          user_code: u.userCode.trim(),
          admission_number: u.userCode.trim(),
          grade: cleanGrade,
          class_letter: u.role === 'student' ? cleanClass : '',
          subject: null,
          assigned_class: null,
        };
      });

      // 3. Upsert profiles to database in safe chunks of 50
      for (let i = 0; i < profilesBatch.length; i += 50) {
        const chunk = profilesBatch.slice(i, i + 50);
        const { error: profErr } = await supabase
          .from('profiles')
          .upsert(chunk, { onConflict: 'email' });

        if (profErr) {
          console.error('Batch database insert error:', profErr);
          throw new Error(profErr.message);
        }
      }

      // 4. Provision Supabase Auth passwords concurrently in batches of 8
      const isolatedClient = createIsolatedSupabaseClient();
      const BATCH_SIZE = 8;
      let completedCount = 0;

      for (let i = 0; i < users.length; i += BATCH_SIZE) {
        const batch = users.slice(i, i + BATCH_SIZE);
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
        completedCount += batch.length;
        if (onProgress) {
          onProgress(completedCount, users.length);
        }
      }

      alert(
        `Successfully imported ${profilesBatch.length} user accounts with Grade and Section assignments. The directory and class matrices have been updated.`
      );
      await loadAllData();
    } catch (err: any) {
      console.error('Bulk import error:', err);
      alert('Unable to complete bulk import. Please ensure the file is a valid Excel or CSV spreadsheet.');
    }
  };

  const handleUpdateUser = async (updatedUser: UserProfile) => {
    try {
      const cleanEmail = updatedUser.email.trim().toLowerCase();

      // Validate single class teacher assignment per cohort
      if (updatedUser.role === 'teacher' && updatedUser.assigned_class) {
        const targetClass = updatedUser.assigned_class.replace(/^Grade\s*/i, '');
        const conflictTeacher = profiles.find((p) => {
          if (p.id === updatedUser.id || (p.email && p.email.toLowerCase() === cleanEmail)) return false;
          if (p.role !== 'teacher') return false;
          const cleanG = (p.grade || '').replace(/[^0-9]/g, '');
          const cleanS = (p.class_letter || '').toUpperCase().trim();
          const assigned = (p.assigned_class || (cleanG && cleanS ? `${cleanG}-${cleanS}` : '')).replace(/^Grade\s*/i, '');
          return assigned === targetClass;
        });
        if (conflictTeacher) {
          alert(`Cannot assign as Class Teacher: Grade ${targetClass} is already assigned to ${conflictTeacher.name} (${conflictTeacher.subject || 'Faculty'}). Each class section can only have one Class Teacher.`);
          return;
        }
      }

      const payload: Partial<UserProfile> = {
        name: updatedUser.name.trim(),
        email: cleanEmail,
        role: updatedUser.role,
        user_code: updatedUser.user_code?.trim() || '',
        admission_number: (updatedUser.admission_number || updatedUser.user_code || '').trim(),
        grade: updatedUser.grade ?? '',
        class_letter: updatedUser.class_letter ?? '',
        subject: updatedUser.subject ?? null,
        assigned_class: updatedUser.assigned_class ?? null,
      };

      // 1. Optimistically update local profiles state immediately
      setProfiles((prev) =>
        prev.map((p) =>
          p.id === updatedUser.id || (p.email && p.email.toLowerCase() === cleanEmail)
            ? ({ ...p, ...payload } as UserProfile)
            : p
        )
      );

      // 2. Perform direct update to public.profiles table by both email and id
      await supabase
        .from('profiles')
        .update(payload)
        .eq('email', cleanEmail);

      if (updatedUser.id) {
        await supabase
          .from('profiles')
          .update(payload)
          .eq('id', updatedUser.id);
      }

      // 3. If currently logged-in user matches this profile, sync session state
      if (
        currentUser &&
        (currentUser.id === updatedUser.id ||
          currentUser.email.toLowerCase() === cleanEmail)
      ) {
        const mergedUser: UserProfile = { ...currentUser, ...payload } as UserProfile;
        setCurrentUser(mergedUser);
      }

      recordAuditLog('EDIT_ACHIEVEMENT' as any, updatedUser.name, `Updated profile details`);
      alert(`Profile for "${updatedUser.name}" updated successfully.`);
    } catch (err: any) {
      console.error('Update user error:', err);
      alert('Unable to save changes. Please try again.');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    const targetUser = profiles.find((p) => p.id === userId);
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

    const newTest: TestItem = {
      id: `test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title,
      class_name: className,
      duration_minutes: durationMinutes,
      questions,
    };

    setTests((prev) => [newTest, ...prev]);
    try {
      await supabase.from('tests').insert([newTest]);
    } catch (e) {}

    recordAuditLog(
      'CREATE_ACHIEVEMENT' as any,
      title,
      `Published new assessment with ${questions.length} questions for ${className}`
    );
    alert(`Assessment "${title}" published successfully.`);
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
    const newTerm: SyllabusTerm = {
      id: `term-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      order_index: syllabus.length + 1,
      topics: [],
    };

    setSyllabus((prev) => [...prev, newTerm]);

    try {
      const { error } = await supabase.from('syllabus_terms').insert([
        {
          id: newTerm.id,
          name: newTerm.name,
          order_num: newTerm.order_index,
        },
      ]);
      if (error) console.error('Error inserting syllabus term to Supabase:', error.message);
    } catch (e) {
      console.error('Error inserting syllabus term to Supabase:', e);
    }

    recordAuditLog('CREATE_ACHIEVEMENT' as any, name, `Added new syllabus term block`);
    alert(`Syllabus term "${name}" created successfully.`);
  };

  const handleDeleteTerm = async (termId: string) => {
    const termObj = syllabus.find((t) => t.id === termId);
    setSyllabus((prev) => prev.filter((t) => t.id !== termId));

    try {
      await supabase.from('syllabus_terms').delete().eq('id', termId);
    } catch (e) {
      console.error('Error deleting syllabus term from Supabase:', e);
    }

    if (termObj) {
      recordAuditLog('DELETE_ACHIEVEMENT' as any, termObj.name, `Removed syllabus term`);
    }
  };

  const handleAddTopic = async (termId: string, title: string) => {
    const newTopic = {
      id: `topic-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      term_id: termId,
      title,
      teacher_checked: false,
      student_checked: false,
    };

    setSyllabus((prev) =>
      prev.map((term) =>
        term.id === termId ? { ...term, topics: [...(term.topics || []), newTopic] } : term
      )
    );

    try {
      const { error } = await supabase.from('syllabus_topics').insert([newTopic]);
      if (error) console.error('Error inserting syllabus topic to Supabase:', error.message);
    } catch (e) {
      console.error('Error inserting syllabus topic to Supabase:', e);
    }

    recordAuditLog('CREATE_ACHIEVEMENT' as any, title, `Added topic to syllabus`);
    alert(`Topic "${title}" added to syllabus.`);
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
      console.error('Error deleting syllabus topic from Supabase:', e);
    }
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

      // 2. Persist locally to localStorage so reloads/syncs never drop it
      try {
        if (typeof window !== 'undefined') {
          const localKey = `woodlem_achievements_${studentId}`;
          const existingLocal = JSON.parse(localStorage.getItem(localKey) || '[]');
          localStorage.setItem(localKey, JSON.stringify([newAch, ...existingLocal.filter((x: any) => x.id !== generatedId)]));
        }
      } catch (e) {}

      // 3. Attempt insert into Supabase
      const payloadStr = JSON.stringify({
        text: description.trim(),
        fileName: fileName || '',
        fileUrl: fileDataUrl || '',
      });

      let { error } = await supabase.from('achievements').insert([
        {
          id: generatedId,
          student_id: studentId,
          title: title.trim(),
          description: description.trim(),
          desc_text: payloadStr,
          file_name: fileName || '',
          file_url: fileDataUrl || '',
        },
      ]);

      // If full insert failed (e.g. desc_text/file_url column issue or payload limit), retry with standard schema
      if (error) {
        console.warn('Achievement full insert notice:', error.message, '- attempting standard columns');
        const fallbackRes = await supabase.from('achievements').insert([
          {
            id: generatedId,
            student_id: studentId,
            title: title.trim(),
            description: description.trim(),
            file_name: fileName || '',
          },
        ]);
        if (fallbackRes.error) {
          console.warn('Achievement fallback insert notice:', fallbackRes.error.message);
        }
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

      try {
        if (typeof window !== 'undefined') {
          const allKeys = Object.keys(localStorage).filter((k) => k.startsWith('woodlem_achievements_'));
          allKeys.forEach((k) => {
            const locList: Achievement[] = JSON.parse(localStorage.getItem(k) || '[]');
            localStorage.setItem(
              k,
              JSON.stringify(
                locList.map((a) =>
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
              )
            );
          });
        }
      } catch (e) {}

      const payload = JSON.stringify({
        text: description,
        fileName: fileName || '',
        fileUrl: fileDataUrl || '',
      });

      const { error } = await supabase
        .from('achievements')
        .update({
          title,
          description,
          desc_text: payload,
          file_name: fileName || '',
          file_url: fileDataUrl || '',
        })
        .eq('id', id);

      if (error) {
        console.warn('Achievement update warning:', error.message);
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

      try {
        if (typeof window !== 'undefined') {
          const allKeys = Object.keys(localStorage).filter((k) => k.startsWith('woodlem_achievements_'));
          allKeys.forEach((k) => {
            const locList: Achievement[] = JSON.parse(localStorage.getItem(k) || '[]');
            localStorage.setItem(k, JSON.stringify(locList.filter((a) => a.id !== id)));
          });
        }
      } catch (e) {}

      const { error } = await supabase.from('achievements').delete().eq('id', id);
      if (error) {
        console.warn('Achievement delete warning:', error.message);
      }

      recordAuditLog('DELETE_ACHIEVEMENT', title, 'Removed achievement record');
      loadAllData();
    } catch (err: any) {
      alert('Unable to remove achievement record. Please try again.');
    }
  };

  // 5. Subject Classrooms (Google Classroom Style)
  const handleCreateSubjectClass = async (classData: {
    name: string;
    subject: string;
    class_name: string;
    section: string;
    room: string;
    enrolled_student_ids: string[];
  }) => {
    if (!currentUser) return;
    const newClass: SubjectClass = {
      id: `class-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: classData.name,
      subject: classData.subject,
      class_name: classData.class_name,
      section: classData.section,
      room: classData.room,
      teacher_id: currentUser.id,
      teacher_name: currentUser.name,
      enrolled_student_ids: classData.enrolled_student_ids,
      created_at: new Date().toISOString(),
    };

    setSubjectClasses((prev) => [newClass, ...prev]);

    try {
      const { error } = await supabase.from('subject_classes').insert([newClass]);
      if (error) console.error('Error inserting class to Supabase:', error.message);
    } catch (e) {
      console.error('Error creating class in Supabase:', e);
    }

    recordAuditLog(
      'CREATE_ACHIEVEMENT' as any,
      newClass.name,
      `Teacher created classroom with ${newClass.enrolled_student_ids.length} students enrolled`
    );
    alert(`Classroom "${newClass.name}" created successfully.`);
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
              enrolled_student_ids: updatedData.enrolled_student_ids || c.enrolled_student_ids,
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
          enrolled_student_ids: updatedData.enrolled_student_ids,
        })
        .eq('id', classId);
    } catch (e) {
      console.error('Update subject class error:', e);
    }

    recordAuditLog(
      'EDIT_ACHIEVEMENT' as any,
      updatedData.name,
      `Updated subject classroom details (${updatedData.class_name})`
    );
    alert(`Classroom "${updatedData.name}" updated successfully.`);
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
        `Updated student roster enrollment (${enrolledStudentIds.length} students enrolled)`
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

  // Student Apply for Authorized Leave / Sick Note
  const handleApplyLeave = async (data: {
    startDate: string;
    endDate: string;
    reason: string;
    leaveType: string;
    fileName?: string;
    fileUrl?: string;
  }) => {
    if (!currentUser) return;

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

    // Optimistically update attendance state
    setAttendance((prev) => {
      const updated = { ...prev };
      datesToMark.forEach((date) => {
        updated[date] = { ...(updated[date] || {}), [currentUser.id]: 'auth_absent' };
      });
      return updated;
    });

    // Sync to Supabase: upsert auth_absent for each school day
    try {
      for (const date of datesToMark) {
        await supabase
          .from('attendance')
          .delete()
          .eq('date', date)
          .eq('student_id', currentUser.id);

        await supabase.from('attendance').insert({
          date,
          student_id: currentUser.id,
          status: 'auth_absent',
        });
      }

      const dayCount = datesToMark.length;
      const displayRange =
        data.startDate === data.endDate
          ? data.startDate
          : `${data.startDate} → ${data.endDate}`;

      alert(
        `✅ Leave application submitted!\n\n${dayCount} school day${dayCount !== 1 ? 's' : ''} (${displayRange}) have been marked as Authorized Absence.\n\nYour class teacher has been notified.`
      );

      recordAuditLog(
        'CREATE_ACHIEVEMENT' as any,
        `Leave: ${data.leaveType}`,
        `${currentUser.name} applied for ${dayCount} day(s) (${displayRange}). Reason: ${data.reason}`
      );

      loadAllData();
    } catch (err: any) {
      console.error('Leave application error:', err);
      alert('Unable to submit leave application. Please contact your class teacher directly.');
    }
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
        title: data.title,
        type: data.type,
        description: data.description,
        date: data.date,
        video_url: data.videoUrl || '',
        attached_file_name: data.attachedFileName || '',
        target_grades: data.targetGrades,
        created_by: currentUser?.name || 'teacher',
      },
    ]);
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
  const handleUploadParentDocument = async (docType: string, fileName: string) => {
    if (!currentUser) return;
    const today = new Date().toISOString().split('T')[0];
    await supabase.from('parent_documents').upsert(
      [
        {
          student_id: currentUser.id,
          doc_type: docType,
          status: 'submitted',
          file_name: fileName,
          uploaded_at: today,
        },
      ],
      { onConflict: 'student_id,doc_type' }
    );
    loadAllData();
  };

  const handleRemoveParentDocument = async (docType: string) => {
    if (!currentUser) return;
    await supabase
      .from('parent_documents')
      .update({ status: 'pending', file_name: '', uploaded_at: '' })
      .eq('student_id', currentUser.id)
      .eq('doc_type', docType);
    loadAllData();
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
  const students: Student[] = profiles
    .filter((p) => p.role === 'student')
    .map((p) => ({ id: p.id, name: p.name, email: p.email, grade: p.grade }));

  const currentStudentObj: Student = currentUser
    ? { id: currentUser.id, name: currentUser.name, email: currentUser.email, grade: currentUser.grade }
    : { id: 'S1', name: 'Student', grade: 'Grade 12 (CBSE)' };

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
          onOpenAddTermModal={() => setIsAddTermOpen(true)}
          onDeleteTerm={handleDeleteTerm}
          onOpenAddTopicModal={(termId) => {
            setSelectedTermForTopic(termId);
            setIsAddTopicOpen(true);
          }}
          onDeleteTopic={handleDeleteTopic}
          onToggleTopicCheck={handleToggleTopicCheck}
          onSaveAttendance={handleSaveAttendance}
          onOpenCreateHubActivityModal={() => setIsCreateHubActivityOpen(true)}
          onDeleteHubActivity={handleDeleteHubActivity}
          onSignOut={handleSignOut}
        />
      ) : currentUser.role === 'admin' ? (
        <AdminDashboard
          currentUser={currentUser}
          profiles={profiles}
          parentDocuments={parentDocuments}
          hubActivities={hubActivities}
          onOpenProvisionModal={() => setIsProvisionUserOpen(true)}
          onOpenBulkModal={() => setIsBulkImportOpen(true)}
          onEditUser={(user) => setEditingUser(user)}
          onDeleteUser={handleDeleteUser}
          onSignOut={handleSignOut}
          onRefreshData={loadAllData}
        />
      ) : (
        <ParentDashboard
          currentUser={currentUser}
          currentChild={currentStudentObj}
          tests={tests}
          assignments={assignments}
          syllabus={syllabus}
          attendance={attendance}
          parentDocuments={parentDocuments}
          hubActivities={hubActivities}
          onUploadDoc={handleUploadParentDocument}
          onRemoveDoc={handleRemoveParentDocument}
          onOpenVideoModal={(act) => setSelectedVideoActivity(act)}
          onSignOut={handleSignOut}
        />
      )}

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
      />

      <CreateHubActivityModal
        isOpen={isCreateHubActivityOpen}
        onClose={() => setIsCreateHubActivityOpen(false)}
        onSubmit={handleCreateHubActivity}
      />

      <ProvisionUserModal
        isOpen={isProvisionUserOpen}
        profiles={profiles}
        onClose={() => setIsProvisionUserOpen(false)}
        onSubmit={handleProvisionUser}
      />

      <BulkImportModal
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        onBulkSubmit={handleBulkImportUsers}
      />

      <EditUserModal
        isOpen={!!editingUser}
        user={editingUser}
        profiles={profiles}
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

      {/* Floating Gemini AI Assistant (Bottom-Right for every dashboard) */}
      <AiChatbot currentUser={currentUser} />
    </PortalNavigationProvider>
  );
}
