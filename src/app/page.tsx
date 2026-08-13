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

export default function Home() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  // Database State
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [tests, setTests] = useState<TestItem[]>([]);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [syllabus, setSyllabus] = useState<SyllabusTerm[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [attendance, setAttendance] = useState<Record<string, Record<string, string>>>({});
  const [hubActivities, setHubActivities] = useState<HubActivity[]>([]);
  const [parentDocuments, setParentDocuments] = useState<ParentDocument[]>([]);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  // Modals state
  const [selectedVideoActivity, setSelectedVideoActivity] = useState<HubActivity | null>(null);
  const [isAddAwardOpen, setIsAddAwardOpen] = useState(false);
  const [isAddTermOpen, setIsAddTermOpen] = useState(false);
  const [isAddTopicOpen, setIsAddTopicOpen] = useState(false);
  const [selectedTermForTopic, setSelectedTermForTopic] = useState<string | undefined>(undefined);
  const [isCreateTestOpen, setIsCreateTestOpen] = useState(false);
  const [isCreateAssignmentOpen, setIsCreateAssignmentOpen] = useState(false);
  const [isCreateHubActivityOpen, setIsCreateHubActivityOpen] = useState(false);
  const [isProvisionUserOpen, setIsProvisionUserOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

  // Load all data from Supabase tables
  const loadAllData = useCallback(async () => {
    try {
      setSchemaError(null);

      // 1. Profiles
      const { data: profData, error: profErr } = await supabase.from('profiles').select('*').order('created_at', { ascending: true });
      if (profErr) {
        setSchemaError(`Database Table Missing: "${profErr.message}". Please run 'supabase_schema.sql' in your Supabase SQL Editor.`);
      } else {
        setProfiles(profData || []);
      }

      // 2. Tests
      const { data: testData } = await supabase.from('tests').select('*').order('created_at', { ascending: false });
      setTests(testData || []);

      // 3. Assignments
      const { data: assData } = await supabase.from('assignments').select('*').order('created_at', { ascending: false });
      setAssignments(assData || []);

      // 4. Syllabus Terms & Topics
      const { data: termData } = await supabase.from('syllabus_terms').select('*').order('order_index', { ascending: true });
      const { data: topicData } = await supabase.from('syllabus_topics').select('*').order('created_at', { ascending: true });

      const builtSyllabus: SyllabusTerm[] = (termData || []).map((term) => ({
        ...term,
        topics: (topicData || []).filter((tp) => tp.term_id === term.id),
      }));
      setSyllabus(builtSyllabus);

      // 5. Achievements
      const { data: achData } = await supabase.from('achievements').select('*').order('created_at', { ascending: false });
      setAchievements(achData || []);

      // 6. Attendance
      const { data: attData } = await supabase.from('attendance').select('*');
      const attMap: Record<string, Record<string, string>> = {};
      (attData || []).forEach((row) => {
        if (!attMap[row.date]) attMap[row.date] = {};
        attMap[row.date][row.student_id] = row.status;
      });
      setAttendance(attMap);

      // 7. Hub Activities & Enrollments
      const { data: hubData } = await supabase.from('hub_activities').select('*').order('date', { ascending: true });
      const { data: enrData } = await supabase.from('hub_enrollments').select('*');

      const builtHub: HubActivity[] = (hubData || []).map((act) => ({
        ...act,
        enrolled_student_ids: (enrData || [])
          .filter((e) => e.activity_id === act.id)
          .map((e) => e.student_id),
      }));
      setHubActivities(builtHub);

      // 8. Parent Documents
      const { data: docData } = await supabase.from('parent_documents').select('*');
      setParentDocuments(docData || []);
    } catch (err: any) {
      console.error('Error loading Supabase data:', err);
    }
  }, []);

  useEffect(() => {
    loadAllData();

    // Check saved session or auth state
    const savedUser = localStorage.getItem('woodlem_active_user');
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {}
    }

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
    let successCount = 0;
    let failCount = 0;
    const isolatedClient = createIsolatedSupabaseClient();

    for (const u of users) {
      try {
        let createdAuthUserId: string | null = null;
        const pwd = u.password || 'woodlem123';

        const { data: authRes } = await isolatedClient.auth.signUp({
          email: u.email,
          password: pwd,
          options: {
            data: {
              name: u.name,
              role: u.role,
              user_code: u.userCode,
              admission_number: u.userCode,
              grade: u.grade || '',
              class_letter: u.classLetter || '',
            },
          },
        });

        if (authRes?.user) {
          createdAuthUserId = authRes.user.id;
        }

        const profileId = createdAuthUserId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6));

        const newProfile: UserProfile = {
          id: profileId,
          name: u.name,
          email: u.email,
          role: u.role,
          user_code: u.userCode,
          admission_number: u.userCode,
          grade: u.grade || '',
          class_letter: u.classLetter || '',
        };

        const { error: profErr } = await supabase.from('profiles').upsert([newProfile], { onConflict: 'email' });
        if (!profErr) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (err) {
        failCount++;
      }
    }

    alert(`🎉 Excel Bulk Import Complete!\n\n✓ Successfully provisioned: ${successCount} user accounts.\n⚠️ Skipped / Failed: ${failCount}\n\nAll created accounts use common password "woodlem123".`);
    loadAllData();
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

  // 2. Tests & Assignments
  const handleCreateTest = async (title: string) => {
    await supabase.from('tests').insert([{ title, class_name: 'Grade 12 - Physics (A)' }]);
    loadAllData();
  };

  const handleCreateAssignment = async (title: string) => {
    await supabase.from('assignments').insert([{ title, class_name: 'Grade 12 - Physics (A)' }]);
    loadAllData();
  };

  // 3. Syllabus
  const handleAddTerm = async (name: string) => {
    await supabase.from('syllabus_terms').insert([{ name, order_index: syllabus.length + 1 }]);
    loadAllData();
  };

  const handleAddTopic = async (termId: string, title: string) => {
    await supabase.from('syllabus_topics').insert([{ term_id: termId, title, teacher_checked: false, student_checked: false }]);
    loadAllData();
  };

  const handleToggleTopicCheck = async (termId: string, topicId: string, role: 'teacher' | 'student', isChecked: boolean) => {
    const updateField = role === 'teacher' ? { teacher_checked: isChecked } : { student_checked: isChecked };
    await supabase.from('syllabus_topics').update(updateField).eq('id', topicId);
    loadAllData();
  };

  // 4. Achievements
  const handleAddAchievement = async (title: string, description: string) => {
    if (!currentUser) return;
    await supabase.from('achievements').insert([{ student_id: currentUser.id, title, description }]);
    loadAllData();
  };

  // 5. Attendance
  const handleSaveAttendance = async (date: string, records: Record<string, string>) => {
    const upsertRows = Object.entries(records).map(([studentId, status]) => ({
      date,
      student_id: studentId,
      status,
    }));

    if (upsertRows.length > 0) {
      await supabase.from('attendance').upsert(upsertRows, { onConflict: 'date,student_id' });
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
          ⚠️ {schemaError}
        </div>
      )}

      {currentUser === null ? (
        <LoginView onLoginSuccess={handleLoginSuccess} />
      ) : currentUser.role === 'student' ? (
        <StudentDashboard
          currentStudent={currentStudentObj}
          tests={tests}
          assignments={assignments}
          syllabus={syllabus}
          achievements={achievements}
          hubActivities={hubActivities}
          onToggleTopicCheck={handleToggleTopicCheck}
          onAddAchievementClick={() => setIsAddAwardOpen(true)}
          onToggleHubEnrollment={handleToggleHubEnrollment}
          onOpenVideoModal={(act) => setSelectedVideoActivity(act)}
          onSignOut={handleSignOut}
        />
      ) : currentUser.role === 'teacher' ? (
        <TeacherDashboard
          students={students}
          tests={tests}
          assignments={assignments}
          syllabus={syllabus}
          achievements={achievements}
          attendance={attendance}
          hubActivities={hubActivities}
          onOpenCreateTestModal={() => setIsCreateTestOpen(true)}
          onOpenCreateAssignmentModal={() => setIsCreateAssignmentOpen(true)}
          onOpenAddTermModal={() => setIsAddTermOpen(true)}
          onOpenAddTopicModal={(termId) => {
            setSelectedTermForTopic(termId);
            setIsAddTopicOpen(true);
          }}
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
        />
      ) : (
        <ParentDashboard
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
        onClose={() => setIsCreateTestOpen(false)}
        onSubmit={handleCreateTest}
      />

      <CreateAssignmentModal
        isOpen={isCreateAssignmentOpen}
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
        onClose={() => setEditingUser(null)}
        onSubmit={handleUpdateUser}
      />
    </>
  );
}
