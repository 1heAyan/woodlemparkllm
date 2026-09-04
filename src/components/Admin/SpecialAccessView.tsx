'use client';

import React, { useState, useEffect } from 'react';
import {
  UserProfile,
  SubjectClass,
  SpecialRoleAssignment,
  supabase,
  createIsolatedSupabaseClient,
} from '@/lib/supabaseClient';
import {
  ACADEMIC_DEPARTMENTS,
  GRADE_STAGES,
  SLT_ROLE_PRESETS,
  loadSpecialRoleAssignments,
  saveSpecialRoleAssignments,
  DEFAULT_PRINCIPAL_RECORD,
  isPrincipalUser,
  isSltUser,
} from '@/lib/specialRolesHelper';
import { saveUserPasswordToCloudAndLocal } from '@/lib/passwordHelper';
import { CustomSelect } from '@/components/UI/CustomSelect';
import {
  ShieldCheck,
  Crown,
  Lock,
  Users,
  CheckCircle2,
  AlertCircle,
  Plus,
  Edit2,
  Trash2,
  ExternalLink,
  BookOpen,
  Layers,
  Sparkles,
  ChevronRight,
  X,
  Check,
  ShieldAlert,
  UserCheck,
  LogOut,
  Mail,
  Key,
} from 'lucide-react';

interface SpecialAccessViewProps {
  currentUser: UserProfile;
  profiles: UserProfile[];
  subjectClasses: SubjectClass[];
  onRefreshData?: () => void;
}

export const SpecialAccessView: React.FC<SpecialAccessViewProps> = ({
  currentUser,
  profiles,
  subjectClasses,
  onRefreshData,
}) => {
  const [assignments, setAssignments] = useState<SpecialRoleAssignment[]>([]);
  const [isAppointModalOpen, setIsAppointModalOpen] = useState(false);
  const [modalRoleType, setModalRoleType] = useState<'hod' | 'coordinator'>('hod');
  const [selectedDept, setSelectedDept] = useState(ACADEMIC_DEPARTMENTS[0].name);
  const [selectedStage, setSelectedStage] = useState(GRADE_STAGES[0].name);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  
  // Principal appointment fields
  const [principalMode, setPrincipalMode] = useState<'new_email' | 'existing_faculty'>('new_email');
  const [principalEmail, setPrincipalEmail] = useState('principal@woodlem.com');
  const [principalName, setPrincipalName] = useState('Dr. Maya Patel');
  const [principalPassword, setPrincipalPassword] = useState('woodlem123');
  const [principalCode, setPrincipalCode] = useState('PRN-001');
  const [customTitle, setCustomTitle] = useState('');

  // SLT appointment fields
  const [isSltModalOpen, setIsSltModalOpen] = useState(false);
  const [sltMode, setSltMode] = useState<'existing' | 'new'>('existing');
  const [selectedSltUserId, setSelectedSltUserId] = useState('');
  const [sltName, setSltName] = useState('');
  const [sltEmail, setSltEmail] = useState('');
  const [sltTitle, setSltTitle] = useState('Vice Principal');
  const [sltPassword, setSltPassword] = useState('woodlem123');
  const [sltCode, setSltCode] = useState('SLT-001');
  const [editingSltId, setEditingSltId] = useState<string | null>(null);
  const [sltPermissions, setSltPermissions] = useState({
    canAuditMarks: true,
    canVerifySyllabus: true,
    canBroadcastDepartment: true,
    canManageResources: true,
    canViewAnalytics: true,
    canApproveClearances: true,
  });

  const [isStepDownModalOpen, setIsStepDownModalOpen] = useState(false);
  const [permissions, setPermissions] = useState({
    canAuditMarks: true,
    canVerifySyllabus: true,
    canBroadcastDepartment: true,
    canManageResources: true,
    canViewAnalytics: true,
    canApproveClearances: true,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveToast, setSaveToast] = useState<{ message: string; type: 'success' | 'warn' } | null>(null);

  useEffect(() => {
    loadSpecialRoleAssignments(profiles).then((data) => {
      setAssignments(data);
    });
  }, [profiles]);

  const showToast = (message: string, type: 'success' | 'warn' = 'success') => {
    setSaveToast({ message, type });
    setTimeout(() => setSaveToast(null), 4000);
  };

  const teachers = profiles.filter(
    (p) => p.role === 'teacher' && !p.email.toLowerCase().startsWith('admin@')
  );
  const isCurrentLoggedInUserPrincipal = isPrincipalUser(currentUser);

  const principalAssignment = assignments.find((a) => a.roleType === 'principal');
  const hasAppointedPrincipal = !!principalAssignment;

  const principalProfile: UserProfile =
    // Priority 1: Match appointed principal assignment if present
    (principalAssignment
      ? profiles.find((p) => p.id === principalAssignment.userId || (p.email && p.email.toLowerCase() === principalAssignment.userEmail.toLowerCase()))
      : undefined) ||
    // Priority 2: Account with email principal@woodlempark.ae or principal@woodlem.com
    profiles.find((p) => {
      const email = (p.email || '').toLowerCase().trim();
      return (email === 'principal@woodlempark.ae' || email === 'principal@woodlem.com') && (p.special_role as string) !== 'slt';
    }) ||
    // Priority 3: Profile with special_role === 'principal' or (isPrincipalUser(p) and not SLT)
    profiles.find((p) => {
      if (isSltUser(p) || (p.special_role as string) === 'slt') return false;
      if (p.special_role === 'principal') return true;
      return isPrincipalUser(p);
    }) ||
    // Priority 4: Fallback to appointed record or default principal record
    (principalAssignment
      ? {
          id: principalAssignment.userId,
          name: principalAssignment.userName,
          email: principalAssignment.userEmail,
          role: 'principal' as const,
          designation: principalAssignment.title || 'Principal & Executive Head of School',
          special_role: 'principal' as const,
          user_code: principalCode || 'PRN-001',
        }
      : DEFAULT_PRINCIPAL_RECORD);

  const sltAssignments = assignments.filter((a) => a.roleType === 'slt');
  const hodAssignments = assignments.filter((a) => a.roleType === 'hod');
  const coordinatorAssignments = assignments.filter((a) => a.roleType === 'coordinator');

  const handleOpenSltModal = (existingAssignment?: SpecialRoleAssignment) => {
    if (existingAssignment) {
      setEditingSltId(existingAssignment.id);
      setSelectedSltUserId(existingAssignment.userId);
      setSltName(existingAssignment.userName);
      setSltEmail(existingAssignment.userEmail);
      setSltTitle(existingAssignment.title || 'Vice Principal');
      setSltPermissions({
        canAuditMarks: true,
        canVerifySyllabus: true,
        canBroadcastDepartment: true,
        canManageResources: true,
        canViewAnalytics: true,
        canApproveClearances: true,
        ...existingAssignment.permissions,
      });
      setSltMode('existing');
    } else {
      setEditingSltId(null);
      const defaultCandidate = profiles.find((p) => p.role === 'teacher' && !p.email.toLowerCase().startsWith('admin@'));
      setSelectedSltUserId(defaultCandidate?.id || '');
      setSltName('');
      setSltEmail('');
      setSltTitle('Vice Principal');
      setSltPassword('woodlem123');
      setSltCode(`SLT-${String(assignments.filter((a) => a.roleType === 'slt').length + 1).padStart(3, '0')}`);
      setSltPermissions({
        canAuditMarks: true,
        canVerifySyllabus: true,
        canBroadcastDepartment: true,
        canManageResources: true,
        canViewAnalytics: true,
        canApproveClearances: true,
      });
      setSltMode('existing');
    }
    setIsSltModalOpen(true);
  };

  const handleSaveSltAssignment = async () => {
    setIsSaving(true);
    try {
      let targetUserId = selectedSltUserId;
      let targetUserName = sltName;
      let targetUserEmail = sltEmail;

      if (editingSltId) {
        // Editing existing appointment
        const existingAssignment = assignments.find((a) => a.id === editingSltId);
        targetUserId = existingAssignment?.userId || selectedSltUserId;
        targetUserName = existingAssignment?.userName || sltName;
        targetUserEmail = existingAssignment?.userEmail || sltEmail;

        if (targetUserId) {
          await supabase.from('profiles').update({
            role: 'principal',
            special_role: 'slt',
            designation: sltTitle || 'Senior Leadership Team (SLT)',
          }).eq('id', targetUserId);
        }
        if (targetUserEmail) {
          await supabase.from('profiles').update({
            role: 'principal',
            special_role: 'slt',
            designation: sltTitle || 'Senior Leadership Team (SLT)',
          }).eq('email', targetUserEmail.toLowerCase());
        }
      } else if (sltMode === 'existing') {
        const existingUser = profiles.find((p) => p.id === selectedSltUserId || p.email?.toLowerCase() === selectedSltUserId?.toLowerCase());
        if (!existingUser) {
          alert('Please select a valid staff member.');
          setIsSaving(false);
          return;
        }
        targetUserId = existingUser.id;
        targetUserName = existingUser.name;
        targetUserEmail = existingUser.email;

        await supabase.from('profiles').update({
          role: 'principal',
          special_role: 'slt',
          designation: sltTitle || 'Senior Leadership Team (SLT)',
        }).eq('id', existingUser.id);
      } else {
        if (!sltName.trim() || !sltEmail.trim()) {
          alert('Please provide a name and email for the SLT member.');
          setIsSaving(false);
          return;
        }
        targetUserEmail = sltEmail.trim().toLowerCase();
        targetUserName = sltName.trim();
        const cleanCode = (sltCode || '').trim() || 'SLT-001';
        const assignedPassword = sltPassword || 'woodlem123';

        // 1. Provision Supabase Auth User without hijacking the admin's current session
        let createdAuthUserId: string | null = null;
        try {
          const isolatedClient = createIsolatedSupabaseClient();
          const { data: authRes, error: authErr } = await isolatedClient.auth.signUp({
            email: targetUserEmail,
            password: assignedPassword,
            options: {
              data: {
                name: targetUserName,
                role: 'principal',
                special_role: 'slt',
                designation: sltTitle || 'Vice Principal',
                user_code: cleanCode,
                admission_number: cleanCode,
              },
            },
          });
          if (authRes?.user) {
            createdAuthUserId = authRes.user.id;
          } else if (authErr) {
            console.warn('Auth sign up notice for SLT:', authErr.message);
          }
        } catch (authErr) {
          console.warn('Auth registration warning for SLT:', authErr);
        }

        const { data: existingProf } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', targetUserEmail)
          .maybeSingle();

        targetUserId = createdAuthUserId || existingProf?.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'slt_' + Date.now());

        // 1. Guaranteed clean PostgreSQL schema payload for public.profiles
        const dbProfile: any = {
          id: targetUserId,
          name: targetUserName,
          email: targetUserEmail,
          role: 'principal',
          user_code: cleanCode,
          admission_number: cleanCode,
        };

        const { error: upsertErr } = await supabase.from('profiles').upsert([dbProfile], { onConflict: 'email' });
        if (upsertErr) {
          console.warn('Upsert onConflict error, attempting direct insert fallback:', upsertErr);
          const { error: insertErr } = await supabase.from('profiles').insert([dbProfile]);
          if (insertErr) {
            console.warn('Insert fallback notice, attempting update:', insertErr);
            await supabase.from('profiles').update(dbProfile).eq('email', targetUserEmail);
          }
        }

        // Try updating designation and special_role if table columns exist
        try {
          await supabase.from('profiles').update({
            designation: sltTitle || 'Vice Principal',
            special_role: 'slt',
          } as any).eq('email', targetUserEmail);
        } catch (e) {
          // Ignore if optional columns are absent in DB
        }

        // Persist password to cloud and local storage
        await saveUserPasswordToCloudAndLocal(targetUserId, targetUserEmail, assignedPassword);
      }

      const remaining = assignments.filter((a) => a.id !== editingSltId && !(a.roleType === 'slt' && a.userId === targetUserId));
      const newAssignment: SpecialRoleAssignment = {
        id: editingSltId || `slt-${Date.now()}`,
        userId: targetUserId,
        userName: targetUserName,
        userEmail: targetUserEmail,
        roleType: 'slt',
        title: sltTitle || 'Senior Leadership Team (SLT)',
        permissions: sltPermissions,
        assignedAt: new Date().toISOString(),
        assignedBy: isCurrentLoggedInUserPrincipal ? 'Principal' : (currentUser.name || 'Admin'),
      };

      const updated = [...remaining, newAssignment];
      await saveSpecialRoleAssignments(updated);
      setAssignments(updated);
      setIsSltModalOpen(false);
      showToast(`${sltTitle || 'SLT Member'} permissions saved successfully.`);
      if (onRefreshData) {
        await onRefreshData();
      }
    } catch (err) {
      console.error(err);
      alert('Failed to save SLT member.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenAppointModal = (type: 'hod' | 'coordinator', deptOrStageName?: string) => {
    setModalRoleType(type);
    if (type === 'hod') {
      const dept = deptOrStageName || ACADEMIC_DEPARTMENTS[0].name;
      setSelectedDept(dept);
      const existing = hodAssignments.find((a) => a.department === dept);
      if (existing) {
        setSelectedTeacherId(existing.userId);
        setCustomTitle(existing.title || `HOD ${dept}`);
        setPermissions({
          canAuditMarks: true,
          canVerifySyllabus: true,
          canBroadcastDepartment: true,
          canManageResources: true,
          canViewAnalytics: true,
          canApproveClearances: true,
          ...existing.permissions,
        });
      } else {
        setSelectedTeacherId(teachers[0]?.id || '');
        setCustomTitle(`Head of ${dept}`);
        setPermissions({
          canAuditMarks: true,
          canVerifySyllabus: true,
          canBroadcastDepartment: true,
          canManageResources: true,
          canViewAnalytics: true,
          canApproveClearances: true,
        });
      }
    } else {
      const stage = deptOrStageName || GRADE_STAGES[0].name;
      setSelectedStage(stage);
      const existing = coordinatorAssignments.find((a) => a.managedGrades?.join(',') === GRADE_STAGES.find((s) => s.name === stage)?.grades.join(','));
      if (existing) {
        setSelectedTeacherId(existing.userId);
        setCustomTitle(existing.title || `${stage} Coordinator`);
        setPermissions({
          canAuditMarks: true,
          canVerifySyllabus: true,
          canBroadcastDepartment: true,
          canManageResources: true,
          canViewAnalytics: true,
          canApproveClearances: true,
          ...existing.permissions,
        });
      } else {
        setSelectedTeacherId(teachers[0]?.id || '');
        setCustomTitle(`${stage} Coordinator`);
        setPermissions({
          canAuditMarks: true,
          canVerifySyllabus: true,
          canBroadcastDepartment: true,
          canManageResources: true,
          canViewAnalytics: true,
          canApproveClearances: true,
        });
      }
    }
    setIsAppointModalOpen(true);
  };

  const handleSaveAppointment = async () => {
    setIsSaving(true);

    try {
      let updated: SpecialRoleAssignment[];

      if (modalRoleType === 'hod') {
        if (!selectedTeacherId) {
          alert('Please select a faculty member.');
          setIsSaving(false);
          return;
        }
        const targetTeacher = teachers.find((t) => t.id === selectedTeacherId);
        if (!targetTeacher) return;

        const oldAssignment = assignments.find((a) => a.roleType === 'hod' && a.department === selectedDept);
        if (oldAssignment && oldAssignment.userId !== targetTeacher.id) {
          await supabase.from('profiles').update({ special_role: 'none', department: null }).eq('id', oldAssignment.userId);
        }

        await supabase.from('profiles').update({
          special_role: 'hod',
          department: selectedDept,
          designation: customTitle || `Head of ${selectedDept}`,
        }).eq('id', targetTeacher.id);

        const remaining = assignments.filter((a) => !(a.roleType === 'hod' && a.department === selectedDept));
        const newAssignment: SpecialRoleAssignment = {
          id: `hod-${Date.now()}`,
          userId: targetTeacher.id,
          userName: targetTeacher.name,
          userEmail: targetTeacher.email,
          roleType: 'hod',
          department: selectedDept,
          title: customTitle || `HOD ${selectedDept}`,
          permissions,
          assignedAt: new Date().toISOString(),
          assignedBy: currentUser.name || 'Admin',
        };
        updated = [...remaining, newAssignment];
        showToast(`Head of ${selectedDept} appointed successfully.`);
      } else {
        if (!selectedTeacherId) {
          alert('Please select a faculty member.');
          setIsSaving(false);
          return;
        }
        const targetTeacher = teachers.find((t) => t.id === selectedTeacherId);
        if (!targetTeacher) return;

        const stageDef = GRADE_STAGES.find((s) => s.name === selectedStage) || GRADE_STAGES[0];
        const oldAssignment = assignments.find((a) => a.roleType === 'coordinator' && a.title?.includes(selectedStage));
        if (oldAssignment && oldAssignment.userId !== targetTeacher.id) {
          await supabase.from('profiles').update({ special_role: 'none' }).eq('id', oldAssignment.userId);
        }

        await supabase.from('profiles').update({
          special_role: 'coordinator',
          designation: customTitle || `${selectedStage} Coordinator`,
        }).eq('id', targetTeacher.id);

        const remaining = assignments.filter((a) => !(a.roleType === 'coordinator' && a.title?.includes(selectedStage)));
        const newAssignment: SpecialRoleAssignment = {
          id: `coord-${Date.now()}`,
          userId: targetTeacher.id,
          userName: targetTeacher.name,
          userEmail: targetTeacher.email,
          roleType: 'coordinator',
          managedGrades: stageDef.grades,
          title: customTitle || `${selectedStage} Coordinator`,
          permissions,
          assignedAt: new Date().toISOString(),
          assignedBy: currentUser.name || 'Admin',
        };
        updated = [...remaining, newAssignment];
        showToast(`${selectedStage} Coordinator appointed successfully.`);
      }

      await saveSpecialRoleAssignments(updated);
      setAssignments(updated);
      setIsAppointModalOpen(false);
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error(err);
      alert('Failed to save special role assignment.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrincipalStepDown = async () => {
    if (!isCurrentLoggedInUserPrincipal) {
      alert('Security Policy: Only the Principal can step down or remove the Principal account from their own authenticated console.');
      return;
    }

    setIsSaving(true);
    try {
      const updated = assignments.filter((a) => a.roleType !== 'principal');
      await saveSpecialRoleAssignments(updated);
      setAssignments(updated);
      setIsStepDownModalOpen(false);
      showToast('You have stepped down from the Principal role. An administrator can now appoint a new Principal.', 'warn');
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error(err);
      alert('Failed to step down from Principal role.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveAssignment = async (id: string, roleType: string) => {
    if (roleType === 'principal') {
      if (!isCurrentLoggedInUserPrincipal) {
        alert('Protected Executive: Administrators cannot remove the Principal account. Only the Principal can initiate this from their own account.');
        return;
      }
    }

    if (!confirm('Are you sure you want to remove this role assignment?')) return;
    
    const target = assignments.find((a) => a.id === id);
    if (target && target.userId) {
      await supabase.from('profiles').update({ special_role: 'none', department: null }).eq('id', target.userId);
    }

    const updated = assignments.filter((a) => a.id !== id);
    await saveSpecialRoleAssignments(updated);
    setAssignments(updated);
    showToast('Role assignment removed.');
    if (onRefreshData) onRefreshData();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Toast Notification */}
      {saveToast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            background: saveToast.type === 'warn' ? '#92400E' : '#1A1A1A',
            color: '#FFFFFF',
            padding: '12px 20px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            zIndex: 1000,
          }}
        >
          {saveToast.type === 'warn' ? <AlertCircle size={17} style={{ color: '#FDE68A' }} /> : <CheckCircle2 size={17} style={{ color: '#A7F3D0' }} />}
          {saveToast.message}
        </div>
      )}

      {/* ── TOP BANNER: SPECIAL DASHBOARDS & ACCESS DELEGATION CONSOLE ── */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid var(--border-color)',
          borderRadius: 10,
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 8,
            background: '#EAF3EF',
            border: '1px solid #C7E4D8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#2C6E6A',
            flexShrink: 0,
          }}
        >
          <ShieldCheck size={20} />
        </div>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--neutral-dark)', fontFamily: 'var(--font-display)' }}>
            Special Dashboards &amp; Access Delegation Console
          </h2>
          <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
            Delegate institutional oversight, appoint Head of Departments (HODs), and configure stage coordinator privileges.
          </p>
        </div>
      </div>

      {/* ── CARD 1: IMMUTABLE ROOT PRINCIPAL EXECUTIVE AUTHORITY ── */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #F5DEB3',
          borderRadius: 10,
          padding: '20px 22px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          boxShadow: '0 2px 6px rgba(217, 119, 6, 0.05)',
        }}
      >
        {/* Principal Header Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 10,
                background: '#D97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                boxShadow: '0 4px 12px rgba(217, 119, 6, 0.25)',
              }}
            >
              <Crown size={26} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--neutral-dark)', fontFamily: 'var(--font-display)' }}>
                  {principalProfile.name || 'Dr. Maya Patel'}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: '#FFFBEB',
                    color: '#92400E',
                    border: '1px solid #F5DEB3',
                    letterSpacing: '0.04em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Lock size={11} /> INDEPENDENT EXECUTIVE AUTHORITY
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#78716C', marginTop: 3 }}>
                {principalProfile.email || 'principal@woodlempark.ae'} • {principalProfile.designation || 'Principal & Executive Head of School'} • Identifier: {principalProfile.user_code || 'PRN-001'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontSize: 11.5,
              fontWeight: 600,
              color: '#92400E',
              background: '#FEF3C7',
              border: '1px solid #FDE68A',
              padding: '6px 12px',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <ShieldAlert size={13} /> Dedicated Principal Account ({principalProfile.email || 'principal@woodlempark.ae'})
            </span>
          </div>
        </div>

        {/* Root Institutional Capabilities Bullets (All Granted & Locked) */}
        <div style={{ borderTop: '1px solid #F5DEB3', paddingTop: 14 }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, color: '#8A5D16', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
            Root Institutional Capabilities (All Granted &amp; Locked):
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px 14px' }}>
            {[
              'Full Administrative Control & Settings',
              'School-Wide Dynamic Analytics & Graphs',
              'All Classrooms & Mark Registers Direct Audit',
              'Role & Access Delegation Authority',
              'Syllabus & Curriculum Pace Supervision',
              'Parent Clearances & Link Authorizations',
            ].map((cap) => (
              <div key={cap} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: '#44403C' }}>
                <CheckCircle2 size={15} style={{ color: '#2C6E6A', flexShrink: 0 }} />
                <span>{cap}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Security Protocol Alert */}
        <div
          style={{
            background: '#FFFDF9',
            border: '1px dashed #F5DEB3',
            borderRadius: 6,
            padding: '9px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 11,
            color: '#8A5D16',
          }}
        >
          <ShieldAlert size={15} style={{ color: '#D97706', flexShrink: 0 }} />
          <span>
            <strong>Security Protocol:</strong> The Principal account is a protected executive entity. Standard system administrators cannot revoke privileges, limit access, or delete this account. Deletion / role revocation can only be executed by the Principal from their authenticated account.
          </span>
        </div>
      </div>

      {/* ── CARD 1.5: SENIOR LEADERSHIP TEAM (SLT) APPOINTMENT SECTION ── */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid var(--border-color)',
          borderRadius: 10,
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 8,
                background: '#EAF3EF',
                border: '1px solid #C7E4D8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#2C6E6A',
              }}
            >
              <Crown size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--neutral-dark)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  SENIOR LEADERSHIP TEAM (SLT)
                </span>
                <span style={{ fontSize: 9.5, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: '#EAF3EF', color: '#2C6E6A', border: '1px solid #C7E4D8' }}>
                  EXECUTIVE GOVERNANCE
                </span>
              </div>
              <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                Vice Principals, Academic Directors, Deans, &amp; Section Heads appointed after the Principal with executive dashboards and delegated institutional oversight.
              </p>
            </div>
          </div>

          {sltAssignments.length > 0 && (
            <button
              onClick={() => handleOpenSltModal()}
              style={{
                padding: '7px 14px',
                borderRadius: 6,
                background: '#1A1A1A',
                color: '#FFFFFF',
                border: 'none',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Plus size={14} /> Appoint SLT Member
            </button>
          )}
        </div>

        {/* SLT Cards Grid or Empty State */}
        {sltAssignments.length === 0 ? (
          <div
            style={{
              padding: '24px 16px',
              background: '#FAF9F6',
              border: '1px dashed var(--border-color)',
              borderRadius: 8,
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#EAF3EF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2C6E6A' }}>
              <Crown size={22} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--neutral-dark)' }}>No Senior Leadership Team (SLT) Members Appointed</span>
            <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', maxWidth: 480, margin: 0 }}>
              The Principal can appoint Vice Principals, Academic Directors, and Deans to delegate school-wide analytics, curriculum supervision, and mark register verification.
            </p>
            <button
              onClick={() => handleOpenSltModal()}
              style={{
                marginTop: 6,
                padding: '6px 14px',
                borderRadius: 6,
                background: '#2C6E6A',
                color: '#FFFFFF',
                border: 'none',
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <Plus size={13} /> Appoint First SLT Member
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
            {sltAssignments.map((slt) => (
              <div
                key={slt.id}
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
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                        {slt.userName}
                      </div>
                      <div style={{ fontSize: 11, color: '#2C6E6A', fontWeight: 600, marginTop: 2 }}>
                        {slt.title || 'Senior Leadership Team'}
                      </div>
                    </div>

                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: 800,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: '#EAF3EF',
                        color: '#2C6E6A',
                        border: '1px solid #C7E4D8',
                      }}
                    >
                      EXECUTIVE
                    </span>
                  </div>

                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 8 }}>
                    Email: <strong>{slt.userEmail}</strong>
                  </div>

                  {/* Delegated Capabilities Badges */}
                  <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {slt.permissions.canViewAnalytics && (
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: '#EAF3EF', color: '#2C6E6A' }}>
                        ✓ Analytics
                      </span>
                    )}
                    {slt.permissions.canAuditMarks && (
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: '#F3EFFA', color: '#7C5CBF' }}>
                        ✓ Marks Audit
                      </span>
                    )}
                    {slt.permissions.canVerifySyllabus && (
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: '#FEF3C7', color: '#92400E' }}>
                        ✓ Syllabus
                      </span>
                    )}
                    {slt.permissions.canBroadcastDepartment && (
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: '#FFE4E6', color: '#E11D48' }}>
                        ✓ Broadcasts
                      </span>
                    )}
                    {slt.permissions.canApproveClearances && (
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: '#EBF3F7', color: '#2B5B75' }}>
                        ✓ Clearances
                      </span>
                    )}
                    {slt.permissions.canManageResources && (
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: '#F0FDF4', color: '#166534' }}>
                        ✓ Resources
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid var(--border-color)', marginTop: 4 }}>
                  <span style={{ fontSize: 10.5, color: 'var(--text-secondary)' }}>
                    Authority delegated by Principal
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => handleOpenSltModal(slt)}
                      style={{
                        padding: '4px 8px',
                        fontSize: 11,
                        borderRadius: 4,
                        border: '1px solid var(--border-color)',
                        background: '#FFFFFF',
                        color: 'var(--neutral-dark)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        fontWeight: 600,
                      }}
                    >
                      <Edit2 size={11} /> Edit
                    </button>
                    <button
                      onClick={() => handleRemoveAssignment(slt.id, 'slt')}
                      style={{
                        padding: '4px 8px',
                        fontSize: 11,
                        borderRadius: 4,
                        border: '1px solid #FECDD3',
                        background: '#FFF1F2',
                        color: '#E11D48',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        fontWeight: 600,
                      }}
                    >
                      <Trash2 size={11} /> Revoke
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── CARD 2: DEPARTMENT HEADS (HODs) APPOINTMENT GRID ── */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid var(--border-color)',
          borderRadius: 10,
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--neutral-dark)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              DEPARTMENT HEADS (HODS)
            </span>
            <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
              Teachers appointed as HODs receive specialized departmental dashboards, cross-class syllabus tracking, and mark register verification.
            </p>
          </div>
        </div>

        {/* HOD Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {ACADEMIC_DEPARTMENTS.map((dept) => {
            const assignment = hodAssignments.find((a) => a.department === dept.name);
            const isAssigned = !!assignment;

            return (
              <div
                key={dept.id}
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: dept.bg,
                          color: dept.color,
                        }}
                      >
                        {dept.code}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                        {dept.name}
                      </span>
                    </div>

                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: isAssigned ? '#EAF3EF' : '#F5F4F0',
                        color: isAssigned ? '#2D6E5D' : 'var(--text-secondary)',
                      }}
                    >
                      {isAssigned ? 'APPOINTED' : 'VACANT'}
                    </span>
                  </div>

                  <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginTop: 4 }}>
                    Subjects: {dept.subjects.join(', ')}
                  </div>

                  {isAssigned && (
                    <div style={{ marginTop: 10, padding: '8px 10px', background: '#FFFFFF', borderRadius: 6, border: '1px solid #EBEAE5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                          {assignment.userName}
                        </div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-secondary)' }}>
                          {assignment.userEmail}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          onClick={() => handleOpenAppointModal('hod', dept.name)}
                          style={{
                            padding: '4px 8px',
                            fontSize: 10.5,
                            fontWeight: 700,
                            color: 'var(--neutral-dark)',
                            background: '#FAF9F6',
                            border: '1px solid var(--border-color)',
                            borderRadius: 4,
                            cursor: 'pointer',
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleRemoveAssignment(assignment.id, 'hod')}
                          style={{
                            padding: '4px 8px',
                            fontSize: 10.5,
                            fontWeight: 700,
                            color: '#DC2626',
                            background: '#FEF2F2',
                            border: '1px solid #FECACA',
                            borderRadius: 4,
                            cursor: 'pointer',
                          }}
                        >
                          Revoke
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {!isAssigned && (
                  <button
                    onClick={() => handleOpenAppointModal('hod', dept.name)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: '#2C6E6A',
                      background: 'transparent',
                      border: '1px dashed #2C6E6A',
                      borderRadius: 6,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      transition: 'all 0.12s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#EAF3EF')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <Plus size={13} /> Appoint Faculty as HOD
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── APPOINTMENT MODAL (PRINCIPAL, HOD, COORDINATOR) ── */}
      {isAppointModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 12,
              width: '100%',
              maxWidth: 480,
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--neutral-dark)' }}>
                  {modalRoleType === 'hod'
                    ? `Appoint Head of ${selectedDept}`
                    : `Appoint ${selectedStage} Coordinator`}
                </h3>
                <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                  Assign faculty leadership privileges and scope.
                </p>
              </div>
              <button
                onClick={() => setIsAppointModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Select Faculty for HOD or Coordinator */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                  Select Faculty Member
                </label>
                <CustomSelect
                  value={selectedTeacherId}
                  onChange={(val) => setSelectedTeacherId(val)}
                  placeholder="-- Choose Faculty Member --"
                  searchable={true}
                  options={[
                    { value: '', label: '-- Choose Faculty Member --' },
                    ...teachers.map((t) => ({
                      value: t.id,
                      label: `${t.name} (${t.email}) - ${t.subject || 'Faculty'}`,
                    })),
                  ]}
                />
              </div>

              {/* Custom Title */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                  Appointed Title / Designation
                </label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder={modalRoleType === 'hod' ? `Head of ${selectedDept}` : `${selectedStage} Coordinator`}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--border-color)',
                    background: '#FFFFFF',
                    fontSize: 12.5,
                  }}
                />
              </div>

              {/* Permissions Checklist */}
              <div style={{ background: '#FAF9F6', borderRadius: 6, padding: '12px 14px', border: '1px solid #E8E5DF' }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6B6963', marginBottom: 8 }}>
                  Delegated Powers &amp; Permissions
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px' }}>
                  {[
                    { key: 'canAuditMarks', label: 'Marks Register Audit' },
                    { key: 'canVerifySyllabus', label: 'Syllabus Verification' },
                    { key: 'canBroadcastDepartment', label: 'Department Broadcasts' },
                    { key: 'canManageResources', label: 'Curriculum Resources' },
                    { key: 'canViewAnalytics', label: 'Stage/Dept Analytics' },
                    { key: 'canApproveClearances', label: 'Clearance Approvals' },
                  ].map(({ key, label }) => (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={(permissions as any)[key]}
                        onChange={(e) => setPermissions({ ...permissions, [key]: e.target.checked })}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <button
                onClick={() => setIsAppointModalOpen(false)}
                style={{
                  padding: '7px 14px',
                  borderRadius: 6,
                  border: '1px solid var(--border-color)',
                  background: '#FFFFFF',
                  color: 'var(--neutral-dark)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAppointment}
                disabled={isSaving}
                style={{
                  padding: '7px 16px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#1A1A1A',
                  color: '#FFFFFF',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {isSaving ? 'Saving...' : 'Confirm Appointment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PRINCIPAL STEP DOWN CONFIRMATION MODAL ── */}
      {isStepDownModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 12,
              width: '100%',
              maxWidth: 450,
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DC2626' }}>
                <ShieldAlert size={20} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#991B1B' }}>
                Confirm Principal Resignation / Step Down
              </h3>
            </div>

            <p style={{ fontSize: 12.5, color: '#57534E', lineHeight: 1.5, margin: 0 }}>
              Are you sure you want to step down from the <strong>Principal &amp; Executive Head</strong> role?
              <br /><br />
              This will remove root executive privileges from your account. An administrator will then be permitted to appoint a new Principal.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
              <button
                onClick={() => setIsStepDownModalOpen(false)}
                style={{
                  padding: '7px 14px',
                  borderRadius: 6,
                  border: '1px solid var(--border-color)',
                  background: '#FFFFFF',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handlePrincipalStepDown}
                disabled={isSaving}
                style={{
                  padding: '7px 16px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#DC2626',
                  color: '#FFFFFF',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {isSaving ? 'Processing...' : 'Confirm Step Down'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── APPOINT SLT MEMBER MODAL ── */}
      {isSltModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 12,
              width: '100%',
              maxWidth: 520,
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: '#EAF3EF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2C6E6A' }}>
                  <Crown size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--neutral-dark)' }}>
                    {editingSltId ? 'Edit SLT Member Permissions' : 'Appoint Senior Leadership Team (SLT) Member'}
                  </h3>
                  <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                    Assign executive designation and customize delegated institutional powers.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSltModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={18} />
              </button>
            </div>

            {!editingSltId && (
              <div style={{ display: 'flex', gap: 8, background: '#FAF9F6', border: '1px solid var(--border-color)', padding: 4, borderRadius: 8 }}>
                <button
                  type="button"
                  onClick={() => setSltMode('existing')}
                  style={{
                    flex: 1,
                    padding: '7px 10px',
                    borderRadius: 6,
                    border: 'none',
                    background: sltMode === 'existing' ? '#FFFFFF' : 'transparent',
                    color: sltMode === 'existing' ? 'var(--neutral-dark)' : 'var(--text-secondary)',
                    fontWeight: sltMode === 'existing' ? 700 : 500,
                    fontSize: 12,
                    cursor: 'pointer',
                    boxShadow: sltMode === 'existing' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  }}
                >
                  Appoint Existing Staff Member
                </button>
                <button
                  type="button"
                  onClick={() => setSltMode('new')}
                  style={{
                    flex: 1,
                    padding: '7px 10px',
                    borderRadius: 6,
                    border: 'none',
                    background: sltMode === 'new' ? '#FFFFFF' : 'transparent',
                    color: sltMode === 'new' ? 'var(--neutral-dark)' : 'var(--text-secondary)',
                    fontWeight: sltMode === 'new' ? 700 : 500,
                    fontSize: 12,
                    cursor: 'pointer',
                    boxShadow: sltMode === 'new' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  }}
                >
                  Create Dedicated SLT Account
                </button>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {sltMode === 'existing' && !editingSltId ? (
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                    Select Staff / Faculty Member
                  </label>
                  <CustomSelect
                    value={selectedSltUserId}
                    onChange={(val) => setSelectedSltUserId(val)}
                    placeholder="-- Choose Staff / Faculty --"
                    searchable={true}
                    options={[
                      { value: '', label: '-- Choose Staff / Faculty --' },
                      ...profiles
                        .filter((p) => p.role !== 'student' && p.role !== 'parent')
                        .map((p) => ({
                          value: p.id,
                          label: `${p.name} (${p.email}) - ${p.designation || p.role}`,
                        })),
                    ]}
                  />
                </div>
              ) : sltMode === 'new' && !editingSltId ? (
                <>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                      Senior Leader Full Name
                    </label>
                    <input
                      type="text"
                      value={sltName}
                      onChange={(e) => setSltName(e.target.value)}
                      placeholder="e.g. Dr. Robert Vance"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 6,
                        border: '1px solid var(--border-color)',
                        background: '#FFFFFF',
                        fontSize: 12.5,
                      }}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                      Official SLT Email Address
                    </label>
                    <input
                      type="email"
                      value={sltEmail}
                      onChange={(e) => setSltEmail(e.target.value)}
                      placeholder="e.g. vp.academics@woodlempark.ae"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 6,
                        border: '1px solid var(--border-color)',
                        background: '#FFFFFF',
                        fontSize: 12.5,
                      }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                        Staff Code / ID
                      </label>
                      <input
                        type="text"
                        value={sltCode}
                        onChange={(e) => setSltCode(e.target.value)}
                        placeholder="SLT-001"
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: 6,
                          border: '1px solid var(--border-color)',
                          background: '#FFFFFF',
                          fontSize: 12.5,
                        }}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                        Preset Password
                      </label>
                      <input
                        type="text"
                        value={sltPassword}
                        onChange={(e) => setSltPassword(e.target.value)}
                        placeholder="woodlem123"
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: 6,
                          border: '1px solid var(--border-color)',
                          background: '#FFFFFF',
                          fontSize: 12.5,
                        }}
                      />
                    </div>
                  </div>
                </>
              ) : null}

              {/* Title / Designation Presets */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                  Executive Title / Designation
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {SLT_ROLE_PRESETS.map((preset) => (
                    <button
                      key={preset.title}
                      type="button"
                      onClick={() => {
                        setSltTitle(preset.title);
                        setSltPermissions({ ...preset.defaultPermissions });
                      }}
                      style={{
                        padding: '4px 9px',
                        borderRadius: 4,
                        border: sltTitle === preset.title ? '1px solid #C7E4D8' : '1px solid var(--border-color)',
                        background: sltTitle === preset.title ? '#EAF3EF' : '#FAF9F6',
                        color: sltTitle === preset.title ? '#2C6E6A' : 'var(--neutral-dark)',
                        fontSize: 11,
                        fontWeight: sltTitle === preset.title ? 700 : 500,
                        cursor: 'pointer',
                      }}
                    >
                      {preset.title}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={sltTitle}
                  onChange={(e) => setSltTitle(e.target.value)}
                  placeholder="e.g. Vice Principal, Head of Secondary, Academic Director"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--border-color)',
                    background: '#FFFFFF',
                    fontSize: 12.5,
                  }}
                />
              </div>

              {/* Permissions Checklist */}
              <div style={{ background: '#FAF9F6', borderRadius: 8, padding: '12px 14px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--neutral-dark)' }}>
                    Delegated Executive Powers &amp; Permissions
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Granted by Principal</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px' }}>
                  {[
                    { key: 'canViewAnalytics', label: 'School-Wide Analytics' },
                    { key: 'canAuditMarks', label: 'Marks Register Direct Audit' },
                    { key: 'canVerifySyllabus', label: 'Syllabus & Pace Supervision' },
                    { key: 'canBroadcastDepartment', label: 'Institutional Broadcasts' },
                    { key: 'canManageResources', label: 'Curriculum & Resources' },
                    { key: 'canApproveClearances', label: 'Parent Link Clearances' },
                  ].map(({ key, label }) => (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, cursor: 'pointer', color: 'var(--neutral-dark)' }}>
                      <input
                        type="checkbox"
                        checked={(sltPermissions as any)[key]}
                        onChange={(e) => setSltPermissions({ ...sltPermissions, [key]: e.target.checked })}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <button
                type="button"
                onClick={() => setIsSltModalOpen(false)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 6,
                  border: '1px solid var(--border-color)',
                  background: '#FFFFFF',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: 'var(--neutral-dark)',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSltAssignment}
                disabled={isSaving}
                style={{
                  padding: '8px 18px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#1A1A1A',
                  color: '#FFFFFF',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {isSaving ? 'Saving...' : editingSltId ? 'Save Changes' : 'Confirm Appointment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
