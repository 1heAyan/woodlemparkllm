'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  supabase,
  createIsolatedSupabaseClient,
  UserProfile,
  Student,
  TestItem,
  AssignmentItem,
  SyllabusTerm,
  Achievement,
  HubActivity,
  ParentDocument,
  AuditLogItem,
  SubjectClass,
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

      // Fetch all tables in parallel for blazing fast performance
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
      ]);

      if (profRes.error) {
        setSchemaError(`Database Table Missing: "${profRes.error.message}". Please run 'supabase_schema.sql' in your Supabase SQL Editor.`);
      } else {
        setProfiles(profRes.data || []);
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

      let fileMap: Record<string, string> = {};
      let fileDataMap: Record<string, string> = {};
      try {
        fileMap = JSON.parse(localStorage.getItem('woodlem_achievement_files') || '{}');
        fileDataMap = JSON.parse(localStorage.getItem('woodlem_achievement_file_data') || '{}');
      } catch (e) {}

      const builtAchievements: Achievement[] = (achRes.data || []).map((ach: any) => {
        let description = ach.desc_text || ach.description || '';
        let fileName = fileMap[ach.id] || ach.file_name || '';
        let fileUrl = fileDataMap[ach.id] || ach.file_url || '';

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

      // Merge with local storage backup
      try {
        const savedAtt = JSON.parse(localStorage.getItem('woodlem_attendance') || '{}');
        Object.entries(savedAtt).forEach(([d, students]: [string, any]) => {
          if (!attMap[d]) attMap[d] = {};
          Object.entries(students).forEach(([sid, st]: [string, any]) => {
            if (!attMap[d][sid]) attMap[d][sid] = st;
          });
        });
      } catch (e) {}

      setAttendance(attMap);

      const builtHub: HubActivity[] = (hubRes.data || []).map((act: any) => ({
        ...act,
        enrolled_student_ids: (enrRes.data || [])
          .filter((e: any) => e.activity_id === act.id)
          .map((e: any) => e.student_id),
      }));
      setHubActivities(builtHub);
      setParentDocuments(docRes.data || []);
    } catch (err: any) {
      console.error('Error loading Supabase data:', err);
    }
  }, []);

  useEffect(() => {
    // Check saved session or auth state
    const savedUser = localStorage.getItem('woodlem_active_user');
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {}
    }
    setIsMounted(true);
    loadAllData();

    // Load saved audit logs
    const savedLogs = localStorage.getItem('woodlem_audit_logs');
    if (savedLogs) {
      try {
        setAuditLogs(JSON.parse(savedLogs));
      } catch (e) {}
    }

    // Load saved subject classes and purge any dummy seed classes
    const savedClasses = localStorage.getItem('woodlem_subject_classes');
    if (savedClasses) {
      try {
        const parsed: SubjectClass[] = JSON.parse(savedClasses);
        const filtered = parsed.filter(
          (c) =>
            !c.id.startsWith('class-seed-') &&
            c.name !== 'Physics 12-C' &&
            c.name !== 'Chemistry 12-C' &&
            c.name !== 'Mathematics 10-A' &&
            c.name !== 'English Literature 10-A'
        );
        setSubjectClasses(filtered);
        localStorage.setItem('woodlem_subject_classes', JSON.stringify(filtered));
      } catch (e) {}
    } else {
      setSubjectClasses([]);
    }

    // Load saved test results
    try {
      const savedTestResults = localStorage.getItem('woodlem_test_results');
      if (savedTestResults) setTestResults(JSON.parse(savedTestResults));
    } catch (e) {}

    // Load saved assignment submissions
    try {
      const savedSubs = localStorage.getItem('woodlem_assignment_submissions');
      if (savedSubs) setAssignmentSubmissions(JSON.parse(savedSubs));
    } catch (e) {}

    // Load saved student syllabus progress
    try {
      const savedSyllabusProg = localStorage.getItem('woodlem_student_syllabus');
      if (savedSyllabusProg) setStudentSyllabusProgress(JSON.parse(savedSyllabusProg));
    } catch (e) {}

    // Subscribe to auth state changes to stay in sync
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session && !localStorage.getItem('woodlem_active_user')) {
        setCurrentUser(null);
      }
    });

    // Subscribe to real-time database updates
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
    localStorage.setItem('woodlem_active_user', JSON.stringify(profile));
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {}
    setCurrentUser(null);
    localStorage.removeItem('woodlem_active_user');
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
        alert(`Error creating profile record in Supabase: ${profErr.message}`);
        return;
      }

      alert(`✓ User "${userData.name}" (${userData.role}) successfully provisioned with default password!`);
      loadAllData();
    } catch (err: any) {
      alert(`Failed to provision user: ${err.message}`);
    }
  };

  // 1b. Bulk Excel Import Users
  const handleBulkImportUsers = async (users: BulkUserRow[]) => {
    try {
      // 1. Prepare batch of all profiles for instant database write
      const profilesBatch: UserProfile[] = users.map((u, idx) => {
        const cleanGrade = (u.grade || '10').replace(/[^0-9]/g, '') || '10';
        const cleanClass = (u.classLetter || 'A').toUpperCase().replace(/[^A-Z]/g, '') || 'A';
        const profileId = typeof crypto !== 'undefined' && crypto.randomUUID 
          ? crypto.randomUUID() 
          : 'usr_' + Date.now() + '_' + idx;

        return {
          id: profileId,
          name: u.name.trim(),
          email: u.email.trim().toLowerCase(),
          role: u.role,
          user_code: u.userCode.trim(),
          admission_number: u.userCode.trim(),
          grade: cleanGrade,
          class_letter: cleanClass,
          subject: null,
          assigned_class: null,
        };
      });

      // 2. Batch upsert directly to Supabase public.profiles in 1 high-speed query
      const { error: profErr } = await supabase
        .from('profiles')
        .upsert(profilesBatch, { onConflict: 'email' });

      if (profErr) {
        throw new Error(`Failed to insert profiles into Supabase: ${profErr.message}`);
      }

      // 3. Optional: Background async provision of Supabase Auth passwords (non-blocking)
      const isolatedClient = createIsolatedSupabaseClient();
      for (const u of users) {
        try {
          await isolatedClient.auth.signUp({
            email: u.email.trim().toLowerCase(),
            password: u.password || 'woodlem123',
            options: {
              data: {
                name: u.name,
                role: u.role,
                user_code: u.userCode,
                admission_number: u.userCode,
                grade: u.grade,
                class_letter: u.classLetter,
              },
            },
          });
        } catch (e) {
          // Skip if already registered or rate limited
        }
      }

      alert(`Bulk Import Success:\n\nSuccessfully imported ${profilesBatch.length} users into the database.\nAll users are immediately visible in the directory.`);
      await loadAllData();
    } catch (err: any) {
      alert(`Bulk import error: ${err.message}`);
    }
  };

  const handleUpdateUser = async (updatedUser: UserProfile) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
          user_code: updatedUser.user_code,
          admission_number: updatedUser.admission_number || updatedUser.user_code,
          grade: updatedUser.grade,
          class_letter: updatedUser.class_letter,
          subject: updatedUser.subject ?? null,
          assigned_class: updatedUser.assigned_class ?? null,
        })
        .eq('id', updatedUser.id);

      if (error) {
        alert(`Failed to update user profile: ${error.message}`);
        return;
      }
      alert(`✓ User "${updatedUser.name}" profile updated successfully.`);
      loadAllData();
    } catch (err: any) {
      alert(`Failed to update user: ${err.message}`);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', userId);
      if (error) {
        alert(`Failed to delete user profile: ${error.message}`);
        return;
      }
      alert('✓ User deleted successfully.');
      loadAllData();
    } catch (err: any) {
      alert(`Failed to delete user: ${err.message}`);
    }
  };

  // 2. Tests & Assessments
  const handleCreateTest = async (data: { title: string; className?: string } | string) => {
    const title = typeof data === 'string' ? data : data.title;
    const className = typeof data === 'object' && data.className ? data.className : (targetClassForModal || '10-A');
    const newTest: TestItem = {
      id: `test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title,
      class_name: className,
    };

    setTests((prev) => [newTest, ...prev]);
    try {
      await supabase.from('tests').insert([newTest]);
    } catch (e) {}

    recordAuditLog('CREATE_ACHIEVEMENT' as any, title, `Published new assessment for ${className}`);
    alert(`✓ Assessment "${title}" published successfully!`);
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

  const handleSaveTestResult = (result: TestResultRecord) => {
    const key = `${result.test_id}_${result.student_id}`;
    setTestResults((prev) => {
      const updated = { ...prev, [key]: result };
      try {
        localStorage.setItem('woodlem_test_results', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    recordAuditLog('EDIT_ACHIEVEMENT' as any, result.student_name, `Completed test with score ${result.score}%`);
  };

  const handleGradeTest = (testId: string, studentId: string, score: number, feedback?: string) => {
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

    setTestResults((prev) => {
      const updated = { ...prev, [key]: updatedRecord };
      try {
        localStorage.setItem('woodlem_test_results', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

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
    alert(`✓ Assignment "${title}" created successfully!`);
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

  const handleSubmitAssignment = (submission: AssignmentSubmissionRecord) => {
    const key = `${submission.assignment_id}_${submission.student_id}`;
    setAssignmentSubmissions((prev) => {
      const updated = { ...prev, [key]: submission };
      try {
        localStorage.setItem('woodlem_assignment_submissions', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    recordAuditLog('CREATE_ACHIEVEMENT' as any, submission.student_name, `Uploaded assignment file: ${submission.file_name || 'Homework'}`);
  };

  const handleGradeAssignment = (assignmentId: string, studentId: string, grade: string, feedback?: string) => {
    const key = `${assignmentId}_${studentId}`;
    const student = profiles.find((p) => p.id === studentId);
    const existing = assignmentSubmissions[key];

    const updatedRecord: AssignmentSubmissionRecord = {
      assignment_id: assignmentId,
      student_id: studentId,
      student_name: student?.name || existing?.student_name || 'Student',
      file_name: existing?.file_name || 'Completed_Assignment.pdf',
      notes: existing?.notes || '',
      grade,
      feedback: feedback || '',
      status: 'graded',
      submitted_at: existing?.submitted_at || new Date().toLocaleDateString(),
    };

    setAssignmentSubmissions((prev) => {
      const updated = { ...prev, [key]: updatedRecord };
      try {
        localStorage.setItem('woodlem_assignment_submissions', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

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
    alert(`✓ Syllabus Term "${name}" created!`);
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
    alert(`✓ Topic "${title}" added to syllabus!`);
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
      setStudentSyllabusProgress((prev) => {
        const updated = { ...prev, [key]: isChecked };
        try {
          localStorage.setItem('woodlem_student_syllabus', JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });

      try {
        await supabase.from('syllabus_topics').update({ student_checked: isChecked }).eq('id', topicId);
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

      setAuditLogs((prev) => {
        const updated = [newEntry, ...prev].slice(0, 200);
        try {
          localStorage.setItem('woodlem_audit_logs', JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });

      // Attempt background write to Supabase audit_logs
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

      if (fileName) {
        try {
          const fileMap = JSON.parse(localStorage.getItem('woodlem_achievement_files') || '{}');
          fileMap[generatedId] = fileName;
          localStorage.setItem('woodlem_achievement_files', JSON.stringify(fileMap));
        } catch (e) {}
      }

      if (fileDataUrl) {
        try {
          const dataMap = JSON.parse(localStorage.getItem('woodlem_achievement_file_data') || '{}');
          dataMap[generatedId] = fileDataUrl;
          localStorage.setItem('woodlem_achievement_file_data', JSON.stringify(dataMap));
        } catch (e) {}
      }

      const newAch: Achievement = {
        id: generatedId,
        student_id: currentUser.id,
        title,
        description,
        file_name: fileName || '',
        file_url: fileDataUrl || '',
        created_at: new Date().toISOString(),
      };

      setAchievements((prev) => [newAch, ...prev]);

      const payload = JSON.stringify({
        text: description,
        fileName: fileName || '',
        fileUrl: fileDataUrl || '',
      });

      const { error } = await supabase.from('achievements').insert([
        {
          id: generatedId,
          student_id: currentUser.id,
          title,
          desc_text: payload,
        },
      ]);

      if (error) {
        console.warn('Supabase achievement insert warning:', error.message);
      }

      recordAuditLog('CREATE_ACHIEVEMENT', title, `Logged achievement with proof: ${fileName || 'none'}`);
      alert(`✓ Achievement "${title}" saved successfully!`);
      loadAllData();
    } catch (err: any) {
      alert(`Error saving achievement: ${err.message}`);
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
      try {
        const fileMap = JSON.parse(localStorage.getItem('woodlem_achievement_files') || '{}');
        if (fileName) {
          fileMap[id] = fileName;
        } else {
          delete fileMap[id];
        }
        localStorage.setItem('woodlem_achievement_files', JSON.stringify(fileMap));
      } catch (e) {}

      if (fileDataUrl) {
        try {
          const dataMap = JSON.parse(localStorage.getItem('woodlem_achievement_file_data') || '{}');
          dataMap[id] = fileDataUrl;
          localStorage.setItem('woodlem_achievement_file_data', JSON.stringify(dataMap));
        } catch (e) {}
      }

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
        })
        .eq('id', id);

      if (error) {
        console.warn('Supabase achievement update warning:', error.message);
      }

      recordAuditLog('EDIT_ACHIEVEMENT', title, `Updated details / certificate: ${fileName || 'none'}`);
      alert(`✓ Achievement "${title}" updated successfully!`);
      loadAllData();
    } catch (err: any) {
      alert(`Error updating achievement: ${err.message}`);
    }
  };

  const handleDeleteAchievement = async (id: string, title: string) => {
    if (!currentUser) return;
    try {
      try {
        const fileMap = JSON.parse(localStorage.getItem('woodlem_achievement_files') || '{}');
        delete fileMap[id];
        localStorage.setItem('woodlem_achievement_files', JSON.stringify(fileMap));

        const dataMap = JSON.parse(localStorage.getItem('woodlem_achievement_file_data') || '{}');
        delete dataMap[id];
        localStorage.setItem('woodlem_achievement_file_data', JSON.stringify(dataMap));
      } catch (e) {}

      setAchievements((prev) => prev.filter((a) => a.id !== id));

      const { error } = await supabase.from('achievements').delete().eq('id', id);
      if (error) {
        console.warn('Supabase achievement delete warning:', error.message);
      }

      recordAuditLog('DELETE_ACHIEVEMENT', title, 'Removed achievement record');
      loadAllData();
    } catch (err: any) {
      alert(`Error deleting achievement: ${err.message}`);
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

    setSubjectClasses((prev) => {
      const updated = [newClass, ...prev];
      try {
        localStorage.setItem('woodlem_subject_classes', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    try {
      await supabase.from('subject_classes').insert([newClass]);
    } catch (e) {}

    recordAuditLog(
      'CREATE_ACHIEVEMENT' as any,
      newClass.name,
      `Teacher created classroom with ${newClass.enrolled_student_ids.length} students enrolled`
    );
    alert(`✓ Classroom "${newClass.name}" created successfully!`);
  };

  const handleDeleteSubjectClass = async (id: string) => {
    setSubjectClasses((prev) => {
      const updated = prev.filter((c) => c.id !== id);
      try {
        localStorage.setItem('woodlem_subject_classes', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    try {
      await supabase.from('subject_classes').delete().eq('id', id);
    } catch (e) {}
    alert('Classroom deleted.');
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
    setSubjectClasses((prev) => {
      const updated = prev.map((c) =>
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
      );
      try {
        localStorage.setItem('woodlem_subject_classes', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

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
    alert(`✓ Classroom "${updatedData.name}" updated successfully!`);
  };

  const handleUpdateClassEnrollment = async (classId: string, enrolledStudentIds: string[]) => {
    setSubjectClasses((prev) => {
      const updated = prev.map((c) => (c.id === classId ? { ...c, enrolled_student_ids: enrolledStudentIds } : c));
      try {
        localStorage.setItem('woodlem_subject_classes', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

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

  // 6. Attendance (Optimistic + Supabase Sync)
  const handleSaveAttendance = async (date: string, records: Record<string, string>) => {
    // 1. Immediate optimistic state update
    setAttendance((prev) => {
      const updated = {
        ...prev,
        [date]: { ...(prev[date] || {}), ...records },
      };
      try {
        localStorage.setItem('woodlem_attendance', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    // 2. Delete and insert to Supabase for 100% reliability
    const studentIds = Object.keys(records);
    if (studentIds.length > 0) {
      try {
        // Delete previous records for these students on this date
        await supabase
          .from('attendance')
          .delete()
          .eq('date', date)
          .in('student_id', studentIds);

        // Insert new records
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

  // Filter students profile list for dropdowns
  const students: Student[] = profiles
    .filter((p) => p.role === 'student')
    .map((p) => ({ id: p.id, name: p.name, email: p.email, grade: p.grade }));

  const currentStudentObj: Student = currentUser
    ? { id: currentUser.id, name: currentUser.name, email: currentUser.email, grade: currentUser.grade }
    : { id: 'S1', name: 'Student', grade: 'Grade 12 (CBSE)' };

  return (
    <>
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
          auditLogs={auditLogs}
          subjectClasses={subjectClasses}
          testResults={testResults}
          assignmentSubmissions={assignmentSubmissions}
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
    </>
  );
}
