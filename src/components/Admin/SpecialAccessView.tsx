'use client';

import React, { useState, useEffect } from 'react';
import {
  UserProfile,
  SubjectClass,
  SpecialRoleAssignment,
  supabase,
} from '@/lib/supabaseClient';
import {
  ACADEMIC_DEPARTMENTS,
  GRADE_STAGES,
  loadSpecialRoleAssignments,
  saveSpecialRoleAssignments,
  DEFAULT_PRINCIPAL_RECORD,
  isPrincipalUser,
} from '@/lib/specialRolesHelper';
import { saveUserPasswordToCloudAndLocal } from '@/lib/passwordHelper';
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

  const teachers = profiles.filter((p) => p.role === 'teacher' || p.role === 'admin');
  const isCurrentLoggedInUserPrincipal = isPrincipalUser(currentUser);

  const principalAssignment = assignments.find((a) => a.roleType === 'principal');
  const hasAppointedPrincipal = !!principalAssignment;

  const principalProfile: UserProfile =
    profiles.find(
      (p) =>
        (principalAssignment && (p.id === principalAssignment.userId || p.email?.toLowerCase() === principalAssignment.userEmail.toLowerCase())) ||
        p.role === 'principal' ||
        p.special_role === 'principal' ||
        (p.email?.toLowerCase() === (principalAssignment?.userEmail || 'principal@woodlem.com').toLowerCase())
    ) ||
    (principalAssignment
      ? {
          id: principalAssignment.userId,
          name: principalAssignment.userName,
          email: principalAssignment.userEmail,
          role: 'principal' as const,
          designation: principalAssignment.title,
          special_role: 'principal' as const,
          user_code: principalCode || 'PRN-001',
        }
      : DEFAULT_PRINCIPAL_RECORD);

  const hodAssignments = assignments.filter((a) => a.roleType === 'hod');
  const coordinatorAssignments = assignments.filter((a) => a.roleType === 'coordinator');

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
                <select
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--border-color)',
                    background: '#FFFFFF',
                    fontSize: 12.5,
                    color: 'var(--neutral-dark)',
                  }}
                >
                  <option value="">-- Choose Faculty --</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.email}) - {t.subject || 'Faculty'}
                    </option>
                  ))}
                </select>
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
    </div>
  );
};
