'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  HOD_ROLE_PRESETS,
  DEFAULT_HOD_PERMISSIONS,
  HodPermissions,
  countHodActivePowers,
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
  GraduationCap,
  Clock,
  Settings,
  BarChart3,
  Sliders,
  FileText,
  Building,
  CheckSquare,
  Square,
  ArrowLeft,
  Atom,
  Calculator,
  Globe,
  Cpu,
  TrendingUp,
  Activity,
  Palette,
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
  const [sltScopeType, setSltScopeType] = useState<'all' | 'custom'>('all');
  const [sltManagedGrades, setSltManagedGrades] = useState<string[]>(['9', '10', '11', '12']);
  const [sltSectionScopeType, setSltSectionScopeType] = useState<'all' | 'custom'>('all');
  const [sltManagedSections, setSltManagedSections] = useState<string[]>([]);
  const [sltPermissions, setSltPermissions] = useState<{
    canViewAnalytics: boolean;
    canExportStatements: boolean;
    canManageHub: boolean;
    canManageSettings: boolean;
    canResetPasswords: boolean;
    canAuditMarks: boolean;
    canReleaseMarks: boolean;
    canEditMarksRegisters: boolean;
    canManageExamTerms: boolean;
    canVerifySyllabus: boolean;
    canManageLateEntries: boolean;
    canManageAttendance: boolean;
    canApproveLeaveRequests: boolean;
    canLogBehaviorIncidents: boolean;
    canViewDisciplineRecords: boolean;
    canViewDirectory: boolean;
    canEditStudentProfiles: boolean;
    canManageClasses: boolean;
    canAssignTeachers: boolean;
    canBroadcastAnnouncements: boolean;
  }>({
    canViewAnalytics: true,
    canExportStatements: true,
    canManageHub: true,
    canManageSettings: false,
    canResetPasswords: true,
    canAuditMarks: true,
    canReleaseMarks: true,
    canEditMarksRegisters: true,
    canManageExamTerms: true,
    canVerifySyllabus: true,
    canManageLateEntries: true,
    canManageAttendance: true,
    canApproveLeaveRequests: true,
    canLogBehaviorIncidents: true,
    canViewDisciplineRecords: true,
    canViewDirectory: true,
    canEditStudentProfiles: true,
    canManageClasses: true,
    canAssignTeachers: true,
    canBroadcastAnnouncements: true,
  });

  // HOD appointment & jurisdiction fields
  const [isHodModalOpen, setIsHodModalOpen] = useState(false);
  const [editingHodId, setEditingHodId] = useState<string | null>(null);
  const [selectedHodDept, setSelectedHodDept] = useState(ACADEMIC_DEPARTMENTS[0].name);
  const [selectedHodUserId, setSelectedHodUserId] = useState('');
  const [hodTitle, setHodTitle] = useState('Head of Department of Science');
  const [hodScopeType, setHodScopeType] = useState<'all' | 'custom'>('all');
  const [hodManagedGrades, setHodManagedGrades] = useState<string[]>(['9', '10', '11', '12']);
  const [hodSectionScopeType, setHodSectionScopeType] = useState<'all' | 'custom'>('all');
  const [hodManagedSections, setHodManagedSections] = useState<string[]>([]);
  const [hodPermissions, setHodPermissions] = useState<HodPermissions>({ ...DEFAULT_HOD_PERMISSIONS });

  const getDepartmentIcon = (iconName: string, size = 16) => {
    switch (iconName) {
      case 'Atom':
        return <Atom size={size} />;
      case 'Calculator':
        return <Calculator size={size} />;
      case 'BookOpen':
        return <BookOpen size={size} />;
      case 'Globe':
        return <Globe size={size} />;
      case 'Cpu':
        return <Cpu size={size} />;
      case 'TrendingUp':
        return <TrendingUp size={size} />;
      case 'Activity':
        return <Activity size={size} />;
      case 'Palette':
        return <Palette size={size} />;
      default:
        return <BookOpen size={size} />;
    }
  };

  const availableSections = useMemo(() => {
    const set = new Set<string>();
    (subjectClasses || []).forEach((sc) => {
      const g = (sc.class_name || sc.name || '').replace(/[^0-9]/g, '');
      const s = (sc.section || '').trim().toUpperCase();
      if (g && s && ['9', '10', '11', '12'].includes(g)) {
        set.add(`${g}-${s}`);
      }
    });
    (profiles || []).forEach((p) => {
      if (p.role === 'student' && p.grade && p.class_letter) {
        const g = p.grade.replace(/[^0-9]/g, '');
        const s = p.class_letter.trim().toUpperCase();
        if (g && s && ['9', '10', '11', '12'].includes(g)) {
          set.add(`${g}-${s}`);
        }
      }
    });
    ['9-A', '9-B', '10-A', '10-B', '11-A', '11-B', '12-A', '12-B'].forEach((def) => set.add(def));
    return Array.from(set).sort((a, b) => {
      const [ga, sa] = a.split('-');
      const [gb, sb] = b.split('-');
      if (ga !== gb) return Number(ga) - Number(gb);
      return sa.localeCompare(sb);
    });
  }, [subjectClasses, profiles]);

  // Administrator appointment fields
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [adminMode, setAdminMode] = useState<'existing' | 'new'>('existing');
  const [selectedAdminUserId, setSelectedAdminUserId] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminTitle, setAdminTitle] = useState('System Administrator');
  const [adminPassword, setAdminPassword] = useState('woodlem123');
  const [adminCode, setAdminCode] = useState('ADM-001');

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

  const sltAssignments = assignments.filter((a) => {
    if (a.roleType !== 'slt') return false;
    const email = (a.userEmail || '').toLowerCase().trim();
    if (email === 'principal@woodlempark.ae' || email === 'principal@woodlem.com' || email.startsWith('principal@')) return false;
    if (a.userId === principalProfile.id) return false;
    if (a.userName?.toLowerCase().trim() === 'principal') return false;
    return true;
  });
  const adminProfiles = profiles.filter(
    (p) => p.role === 'admin' && !isPrincipalUser(p) && (p.email || '').toLowerCase() !== (principalProfile.email || '').toLowerCase()
  );

  const handleOpenSltModal = (existingAssignment?: SpecialRoleAssignment) => {
    if (existingAssignment) {
      setEditingSltId(existingAssignment.id);
      setSelectedSltUserId(existingAssignment.userId);
      setSltName(existingAssignment.userName);
      setSltEmail(existingAssignment.userEmail);
      setSltTitle(existingAssignment.title || 'Vice Principal');
      setSltScopeType(
        existingAssignment.scopeType ||
          (existingAssignment.managedGrades &&
          existingAssignment.managedGrades.length > 0 &&
          existingAssignment.managedGrades.length < 4
            ? 'custom'
            : 'all')
      );
      setSltManagedGrades(
        existingAssignment.managedGrades && existingAssignment.managedGrades.length > 0
          ? existingAssignment.managedGrades
          : ['9', '10', '11', '12']
      );
      setSltSectionScopeType(
        existingAssignment.managedSections && existingAssignment.managedSections.length > 0
          ? 'custom'
          : 'all'
      );
      setSltManagedSections(existingAssignment.managedSections || []);
      setSltPermissions({
        canViewAnalytics: existingAssignment.permissions?.canViewAnalytics ?? true,
        canExportStatements: existingAssignment.permissions?.canExportStatements ?? true,
        canManageHub: existingAssignment.permissions?.canManageHub ?? true,
        canManageSettings: existingAssignment.permissions?.canManageSettings ?? false,
        canResetPasswords: existingAssignment.permissions?.canResetPasswords ?? true,
        canAuditMarks: existingAssignment.permissions?.canAuditMarks ?? true,
        canReleaseMarks: existingAssignment.permissions?.canReleaseMarks ?? true,
        canEditMarksRegisters: existingAssignment.permissions?.canEditMarksRegisters ?? true,
        canManageExamTerms: existingAssignment.permissions?.canManageExamTerms ?? true,
        canVerifySyllabus: existingAssignment.permissions?.canVerifySyllabus ?? true,
        canManageLateEntries: existingAssignment.permissions?.canManageLateEntries ?? true,
        canManageAttendance: existingAssignment.permissions?.canManageAttendance ?? true,
        canApproveLeaveRequests: existingAssignment.permissions?.canApproveLeaveRequests ?? true,
        canLogBehaviorIncidents: existingAssignment.permissions?.canLogBehaviorIncidents ?? true,
        canViewDisciplineRecords: existingAssignment.permissions?.canViewDisciplineRecords ?? true,
        canViewDirectory: existingAssignment.permissions?.canViewDirectory ?? true,
        canEditStudentProfiles: existingAssignment.permissions?.canEditStudentProfiles ?? true,
        canManageClasses: existingAssignment.permissions?.canManageClasses ?? true,
        canAssignTeachers: existingAssignment.permissions?.canAssignTeachers ?? true,
        canBroadcastAnnouncements: existingAssignment.permissions?.canBroadcastAnnouncements ?? true,
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
      setSltScopeType('all');
      setSltManagedGrades(['9', '10', '11', '12']);
      setSltSectionScopeType('all');
      setSltManagedSections([]);
      setSltPermissions({
        canViewAnalytics: true,
        canExportStatements: true,
        canManageHub: true,
        canManageSettings: false,
        canResetPasswords: true,
        canAuditMarks: true,
        canReleaseMarks: true,
        canEditMarksRegisters: true,
        canManageExamTerms: true,
        canVerifySyllabus: true,
        canManageLateEntries: true,
        canManageAttendance: true,
        canApproveLeaveRequests: true,
        canLogBehaviorIncidents: true,
        canViewDisciplineRecords: true,
        canViewDirectory: true,
        canEditStudentProfiles: true,
        canManageClasses: true,
        canAssignTeachers: true,
        canBroadcastAnnouncements: true,
      });
      setSltMode('existing');
    }
    setIsSltModalOpen(true);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleCloseSltEditor = () => {
    setIsSltModalOpen(false);
    setEditingSltId(null);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSaveSltAssignment = async () => {
    setIsSaving(true);
    try {
      let targetUserId = selectedSltUserId;
      let targetUserName = sltName;
      let targetUserEmail = sltEmail;

      const finalManagedGrades =
        sltScopeType === 'all'
          ? ['9', '10', '11', '12']
          : sltManagedGrades.length > 0
          ? sltManagedGrades
          : ['9', '10', '11', '12'];
      const finalManagedSections =
        sltScopeType === 'all' || sltSectionScopeType === 'all' ? [] : sltManagedSections;

      if (editingSltId) {
        // Editing existing appointment
        const existingAssignment = assignments.find((a) => a.id === editingSltId);
        targetUserId = existingAssignment?.userId || selectedSltUserId;
        targetUserName = existingAssignment?.userName || sltName;
        targetUserEmail = existingAssignment?.userEmail || sltEmail;

        const updatePayload: any = {
          role: 'principal',
          special_role: 'slt',
          designation: sltTitle || 'Senior Leadership Team (SLT)',
          managed_grades: finalManagedGrades,
          managed_sections: finalManagedSections,
        };

        if (targetUserId) {
          try {
            await supabase.from('profiles').update(updatePayload).eq('id', targetUserId);
          } catch (e) {
            console.warn('Profile ID update notice:', e);
          }
        }
        if (targetUserEmail) {
          try {
            await supabase.from('profiles').update(updatePayload).eq('email', targetUserEmail.toLowerCase());
          } catch (e) {
            console.warn('Profile email update notice:', e);
          }
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

        try {
          await supabase.from('profiles').update({
            role: 'principal',
            special_role: 'slt',
            designation: sltTitle || 'Senior Leadership Team (SLT)',
            managed_grades: finalManagedGrades,
            managed_sections: finalManagedSections,
          } as any).eq('id', existingUser.id);
        } catch (e) {
          console.warn('Profile role update notice:', e);
        }
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
                managed_grades: finalManagedGrades,
                managed_sections: finalManagedSections,
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

        // 2. Guaranteed clean PostgreSQL schema payload for public.profiles
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

        // Try updating designation, special_role, and scopes
        try {
          await supabase.from('profiles').update({
            designation: sltTitle || 'Vice Principal',
            special_role: 'slt',
            managed_grades: finalManagedGrades,
            managed_sections: finalManagedSections,
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
        scopeType: sltScopeType,
        managedGrades: finalManagedGrades,
        managedSections: finalManagedSections,
        permissions: sltPermissions,
        assignedAt: new Date().toISOString(),
        assignedBy: isCurrentLoggedInUserPrincipal ? 'Principal' : (currentUser.name || 'Admin'),
      };

      const updated = [...remaining, newAssignment];
      await saveSpecialRoleAssignments(updated);
      setAssignments(updated);
      setIsSltModalOpen(false);
      showToast(`${sltTitle || 'SLT Member'} jurisdiction & powers saved successfully.`);
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

  const handleOpenHodModal = (deptName?: string, assignmentId?: string) => {
    const targetDept = deptName || selectedDept || ACADEMIC_DEPARTMENTS[0].name;
    setSelectedHodDept(targetDept);

    const existingAssignment = assignmentId
      ? assignments.find((a) => a.id === assignmentId)
      : assignments.find((a) => a.roleType === 'hod' && a.department === targetDept);

    if (existingAssignment) {
      setEditingHodId(existingAssignment.id);
      setSelectedHodUserId(existingAssignment.userId);
      setHodTitle(existingAssignment.title || `Head of ${targetDept}`);
      setHodScopeType(
        existingAssignment.scopeType ||
          (existingAssignment.managedGrades && existingAssignment.managedGrades.length < 4 ? 'custom' : 'all')
      );
      setHodManagedGrades(
        existingAssignment.managedGrades && existingAssignment.managedGrades.length > 0
          ? existingAssignment.managedGrades
          : ['9', '10', '11', '12']
      );
      setHodSectionScopeType(
        existingAssignment.managedSections && existingAssignment.managedSections.length > 0 ? 'custom' : 'all'
      );
      setHodManagedSections(existingAssignment.managedSections || []);
      setHodPermissions({
        ...DEFAULT_HOD_PERMISSIONS,
        ...(existingAssignment.permissions as any),
        canManageCurriculumResources:
          existingAssignment.permissions?.canManageCurriculumResources ??
          existingAssignment.permissions?.canManageResources ??
          true,
      });
    } else {
      setEditingHodId(null);
      const deptDef = ACADEMIC_DEPARTMENTS.find((d) => d.name === targetDept);
      const matchTeacher = teachers.find(
        (t) => t.department === targetDept || (deptDef?.subjects && deptDef.subjects.includes(t.subject || ''))
      );
      setSelectedHodUserId(matchTeacher?.id || teachers[0]?.id || '');
      setHodTitle(`Head of ${targetDept}`);
      setHodScopeType('all');
      setHodManagedGrades(['9', '10', '11', '12']);
      setHodSectionScopeType('all');
      setHodManagedSections([]);
      setHodPermissions({ ...DEFAULT_HOD_PERMISSIONS });
    }

    setIsHodModalOpen(true);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleCloseHodEditor = () => {
    setIsHodModalOpen(false);
    setEditingHodId(null);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSaveHodAssignment = async () => {
    setIsSaving(true);
    try {
      if (!selectedHodUserId) {
        alert('Please select a faculty member for this department.');
        setIsSaving(false);
        return;
      }
      const targetTeacher = profiles.find((p) => p.id === selectedHodUserId);
      if (!targetTeacher) {
        alert('Selected faculty member could not be found.');
        setIsSaving(false);
        return;
      }

      const finalManagedGrades =
        hodScopeType === 'all'
          ? ['9', '10', '11', '12']
          : hodManagedGrades.length > 0
          ? hodManagedGrades
          : ['9', '10', '11', '12'];

      const finalManagedSections =
        hodScopeType === 'all' || hodSectionScopeType === 'all'
          ? []
          : hodManagedSections;

      // Revoke old HOD if someone else held it
      const oldAssignment = assignments.find((a) => a.roleType === 'hod' && a.department === selectedHodDept);
      if (oldAssignment && oldAssignment.userId !== targetTeacher.id) {
        await supabase.from('profiles').update({ special_role: 'none' }).eq('id', oldAssignment.userId);
      }

      const deptDef = ACADEMIC_DEPARTMENTS.find((d) => d.name === selectedHodDept);
      const deptPrimarySubject = deptDef?.subjects?.[0] || '';
      const targetSubject =
        targetTeacher.subject && targetTeacher.subject !== 'English'
          ? targetTeacher.subject
          : deptPrimarySubject || targetTeacher.subject || 'Faculty';

      // Update target teacher in public.profiles
      await supabase
        .from('profiles')
        .update({
          special_role: 'hod',
          department: selectedHodDept,
          designation: hodTitle || `Head of ${selectedHodDept}`,
          managed_grades: finalManagedGrades,
          subject: targetSubject,
        })
        .eq('id', targetTeacher.id);

      const remaining = assignments.filter((a) => !(a.roleType === 'hod' && a.department === selectedHodDept));
      const newAssignment: SpecialRoleAssignment = {
        id: editingHodId || `hod-${Date.now()}`,
        userId: targetTeacher.id,
        userName: targetTeacher.name,
        userEmail: targetTeacher.email,
        roleType: 'hod',
        department: selectedHodDept,
        title: hodTitle || `Head of ${selectedHodDept}`,
        scopeType: hodScopeType,
        managedGrades: finalManagedGrades,
        managedSections: finalManagedSections,
        permissions: {
          ...hodPermissions,
          canManageResources: hodPermissions.canManageCurriculumResources,
        },
        assignedAt: new Date().toISOString(),
        assignedBy: isCurrentLoggedInUserPrincipal ? 'Principal' : (currentUser.name || 'Admin'),
      };

      const updated = [...remaining, newAssignment];
      await saveSpecialRoleAssignments(updated);
      setAssignments(updated);
      setIsHodModalOpen(false);
      setEditingHodId(null);
      showToast(`${hodTitle || `Head of ${selectedHodDept}`} appointed successfully.`);
      if (onRefreshData) {
        await onRefreshData();
      }
    } catch (err) {
      console.error(err);
      alert('Failed to save Head of Department assignment.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenAppointModal = (type: 'hod' | 'coordinator', deptOrStageName?: string) => {
    if (type === 'hod') {
      handleOpenHodModal(deptOrStageName);
      return;
    }
    setModalRoleType('coordinator');
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

        const deptDef = ACADEMIC_DEPARTMENTS.find((d) => d.name === selectedDept);
        const deptPrimarySubject = deptDef?.subjects?.[0] || '';
        const targetSubject = targetTeacher.subject && targetTeacher.subject !== 'English' 
          ? targetTeacher.subject 
          : (deptPrimarySubject || targetTeacher.subject || 'Physical Education');

        await supabase.from('profiles').update({
          special_role: 'hod',
          department: selectedDept,
          designation: customTitle || `Head of ${selectedDept}`,
          subject: targetSubject,
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

  const handleOpenAdminModal = () => {
    const defaultCandidate = profiles.find((p) => p.role === 'teacher' && !p.email.toLowerCase().startsWith('admin@'));
    setSelectedAdminUserId(defaultCandidate?.id || '');
    setAdminName('');
    setAdminEmail('');
    setAdminTitle('System Administrator');
    setAdminPassword('woodlem123');
    setAdminCode(`ADM-${String(adminProfiles.length + 1).padStart(3, '0')}`);
    setAdminMode('existing');
    setIsAdminModalOpen(true);
  };

  const handleSaveAdminAssignment = async () => {
    setIsSaving(true);
    try {
      if (adminMode === 'existing') {
        const target = profiles.find((p) => p.id === selectedAdminUserId);
        if (!target) {
          alert('Please select a valid staff member.');
          setIsSaving(false);
          return;
        }
        await supabase.from('profiles').update({
          role: 'admin',
          designation: adminTitle || 'System Administrator',
        }).eq('id', target.id);
      } else {
        if (!adminName.trim() || !adminEmail.trim()) {
          alert('Please provide a name and email.');
          setIsSaving(false);
          return;
        }
        const targetEmail = adminEmail.trim().toLowerCase();
        const targetName = adminName.trim();
        const cleanCode = (adminCode || '').trim() || 'ADM-001';
        const assignedPass = adminPassword || 'woodlem123';

        let createdId: string | null = null;
        try {
          const isolatedClient = createIsolatedSupabaseClient();
          const { data: authRes } = await isolatedClient.auth.signUp({
            email: targetEmail,
            password: assignedPass,
            options: {
              data: {
                name: targetName,
                role: 'admin',
                designation: adminTitle || 'System Administrator',
                user_code: cleanCode,
                admission_number: cleanCode,
              },
            },
          });
          if (authRes?.user) createdId = authRes.user.id;
        } catch (e) {
          console.warn('Auth notice for Admin:', e);
        }

        const newId = createdId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'adm_' + Date.now());
        const dbProfile: any = {
          id: newId,
          name: targetName,
          email: targetEmail,
          role: 'admin',
          designation: adminTitle || 'System Administrator',
          user_code: cleanCode,
          admission_number: cleanCode,
        };
        await supabase.from('profiles').upsert([dbProfile], { onConflict: 'email' });
        await saveUserPasswordToCloudAndLocal(newId, targetEmail, assignedPass);
      }

      setIsAdminModalOpen(false);
      showToast('System Administrator delegated successfully.');
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error(err);
      alert('Failed to save administrator.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevokeAdminRole = async (userId: string) => {
    if (!confirm('Are you sure you want to revoke administrator access from this account?')) return;
    setIsSaving(true);
    try {
      await supabase.from('profiles').update({
        role: 'teacher',
        designation: 'Faculty Member',
      }).eq('id', userId);
      showToast('Administrator privileges revoked.');
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error(err);
      alert('Failed to revoke admin role.');
    } finally {
      setIsSaving(false);
    }
  };

  const hodAssignments = assignments.filter((a) => a.roleType === 'hod');
  const coordinatorAssignments = assignments.filter((a) => a.roleType === 'coordinator');

  const isCurrentLoggedInUserAdmin = currentUser.role === 'admin' && !isSltUser(currentUser);
  const canManageAccess = isCurrentLoggedInUserPrincipal || isCurrentLoggedInUserAdmin;

  if (!canManageAccess) {
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center', background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 8 }}>
        <ShieldAlert size={40} style={{ color: '#DC2626', margin: '0 auto 12px' }} />
        <h2 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: '#1A1A1A', fontFamily: 'var(--font-display)' }}>
          Access Restricted: Institutional Governance
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: '#6B6963', maxWidth: 460, marginLeft: 'auto', marginRight: 'auto' }}>
          Special roles and institutional appointments are strictly governed by the Executive Head of School (Principal) and System Administrators.
        </p>
      </div>
    );
  }

  // ── FULL PAGE: SENIOR LEADERSHIP JURISDICTION & POWERS EDITOR ──
  if (isSltModalOpen) {
    const totalPowersCount = Object.values(sltPermissions).filter(Boolean).length;
    const editingAssignment = editingSltId ? assignments.find((a) => a.id === editingSltId) : null;
    const memberName = editingAssignment ? editingAssignment.userName : (sltMode === 'existing' ? profiles.find((p) => p.id === selectedSltUserId)?.name || '' : sltName);
    const memberEmail = editingAssignment ? editingAssignment.userEmail : (sltMode === 'existing' ? profiles.find((p) => p.id === selectedSltUserId)?.email || '' : sltEmail);
    const memberDesignation = editingAssignment ? (editingAssignment.title || 'Senior Leadership Team') : (sltTitle || 'Senior Leadership Team');

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%', paddingBottom: 40, maxWidth: 1200, margin: '0 auto' }}>
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

        {/* ── TOP BREADCRUMB & EXECUTIVE HEADER ── */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid var(--border-color)',
            borderRadius: 10,
            padding: '18px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          {/* Breadcrumb Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F0EB', paddingBottom: 12 }}>
            <button
              type="button"
              onClick={handleCloseSltEditor}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 14px',
                borderRadius: 6,
                border: '1px solid var(--border-color)',
                background: '#FAF9F6',
                color: 'var(--neutral-dark)',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#F2F1EC';
                e.currentTarget.style.borderColor = '#D6D4CC';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#FAF9F6';
                e.currentTarget.style.borderColor = 'var(--border-color)';
              }}
            >
              <ArrowLeft size={15} />
              <span>Back to Special Access &amp; Roles</span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  background: '#EFF6FF',
                  color: '#1D4ED8',
                  padding: '4px 10px',
                  borderRadius: 12,
                  letterSpacing: '0.04em',
                }}
              >
                EXECUTIVE GOVERNANCE
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  background: totalPowersCount > 0 ? '#EAF3EF' : '#FEF3C7',
                  color: totalPowersCount > 0 ? '#2C6E6A' : '#92400E',
                  padding: '4px 10px',
                  borderRadius: 12,
                }}
              >
                {totalPowersCount} / 20 Powers Active
              </span>
            </div>
          </div>

          {/* Title & Action Buttons Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #EAF3EF 0%, #D8ECE5 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#2C6E6A',
                  flexShrink: 0,
                  boxShadow: '0 2px 5px rgba(44,110,106,0.15)',
                }}
              >
                <Crown size={26} />
              </div>
              <div>
                <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: 'var(--neutral-dark)', letterSpacing: '-0.01em', fontFamily: 'var(--font-display)' }}>
                  {editingSltId ? 'Edit Senior Leadership Jurisdiction & Powers' : 'Appoint Senior Leadership Team (SLT) Member'}
                </h1>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                  Assign executive designation, enforce strict grade/section jurisdiction, and calibrate delegated institutional authorities.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                onClick={handleCloseSltEditor}
                style={{
                  padding: '9px 18px',
                  borderRadius: 6,
                  border: '1px solid var(--border-color)',
                  background: '#FFFFFF',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: 'var(--neutral-dark)',
                  transition: 'background 0.15s ease',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSltAssignment}
                disabled={isSaving}
                style={{
                  padding: '9px 24px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#1A1A1A',
                  color: '#FFFFFF',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                }}
              >
                <ShieldCheck size={16} />
                <span>{isSaving ? 'Saving Delegated Authority...' : editingSltId ? 'Save Changes' : 'Confirm SLT Appointment'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── 1. EXECUTIVE IDENTITY & DESIGNATION PRESETS ── */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid var(--border-color)',
            borderRadius: 10,
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #F1F0EB', paddingBottom: 12 }}>
            <div style={{ width: 30, height: 30, borderRadius: 6, background: '#EAF3EF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2C6E6A' }}>
              <UserCheck size={16} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: 'var(--neutral-dark)', letterSpacing: '0.04em' }}>
                Executive Member Identity &amp; Title
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                Target institutional leader and official administrative designation.
              </div>
            </div>
          </div>

          {editingSltId ? (
            /* Editing Banner for existing SLT member */
            <div
              style={{
                background: '#FAF9F6',
                border: '1px solid var(--border-color)',
                borderRadius: 8,
                padding: '14px 18px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: '#1A1A1A',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 16,
                  }}
                >
                  {(memberName || 'S').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--neutral-dark)' }}>
                    {memberName}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                    {memberEmail}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    padding: '4px 12px',
                    borderRadius: 6,
                    background: '#EAF3EF',
                    color: '#2C6E6A',
                    border: '1px solid #C7E4D8',
                  }}
                >
                  {memberDesignation}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '4px 10px',
                    borderRadius: 6,
                    background: '#EFF6FF',
                    color: '#1D4ED8',
                  }}
                >
                  Active Executive
                </span>
              </div>
            </div>
          ) : (
            /* New Appointment: Tab mode switch and selection */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', gap: 8, background: '#FAF9F6', border: '1px solid var(--border-color)', padding: 4, borderRadius: 8 }}>
                <button
                  type="button"
                  onClick={() => setSltMode('existing')}
                  style={{
                    flex: 1,
                    padding: '9px 14px',
                    borderRadius: 6,
                    border: 'none',
                    background: sltMode === 'existing' ? '#FFFFFF' : 'transparent',
                    color: sltMode === 'existing' ? 'var(--neutral-dark)' : 'var(--text-secondary)',
                    fontWeight: sltMode === 'existing' ? 700 : 500,
                    fontSize: 12.5,
                    cursor: 'pointer',
                    boxShadow: sltMode === 'existing' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Appoint Existing Staff / Faculty Member
                </button>
                <button
                  type="button"
                  onClick={() => setSltMode('new')}
                  style={{
                    flex: 1,
                    padding: '9px 14px',
                    borderRadius: 6,
                    border: 'none',
                    background: sltMode === 'new' ? '#FFFFFF' : 'transparent',
                    color: sltMode === 'new' ? 'var(--neutral-dark)' : 'var(--text-secondary)',
                    fontWeight: sltMode === 'new' ? 700 : 500,
                    fontSize: 12.5,
                    cursor: 'pointer',
                    boxShadow: sltMode === 'new' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Create Dedicated Senior Leadership Account
                </button>
              </div>

              {sltMode === 'existing' ? (
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--neutral-dark)', marginBottom: 6, display: 'block' }}>
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
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--neutral-dark)', marginBottom: 6, display: 'block' }}>
                        Senior Leader Full Name
                      </label>
                      <input
                        type="text"
                        value={sltName}
                        onChange={(e) => setSltName(e.target.value)}
                        placeholder="e.g. Dr. Robert Vance"
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: 6,
                          border: '1px solid var(--border-color)',
                          background: '#FFFFFF',
                          fontSize: 13,
                        }}
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--neutral-dark)', marginBottom: 6, display: 'block' }}>
                        Official SLT Email Address
                      </label>
                      <input
                        type="email"
                        value={sltEmail}
                        onChange={(e) => setSltEmail(e.target.value)}
                        placeholder="e.g. vp.academics@woodlempark.ae"
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: 6,
                          border: '1px solid var(--border-color)',
                          background: '#FFFFFF',
                          fontSize: 13,
                        }}
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--neutral-dark)', marginBottom: 6, display: 'block' }}>
                        Staff Code / ID
                      </label>
                      <input
                        type="text"
                        value={sltCode}
                        onChange={(e) => setSltCode(e.target.value)}
                        placeholder="SLT-001"
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: 6,
                          border: '1px solid var(--border-color)',
                          background: '#FFFFFF',
                          fontSize: 13,
                        }}
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--neutral-dark)', marginBottom: 6, display: 'block' }}>
                        Preset Password
                      </label>
                      <input
                        type="text"
                        value={sltPassword}
                        onChange={(e) => setSltPassword(e.target.value)}
                        placeholder="woodlem123"
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: 6,
                          border: '1px solid var(--border-color)',
                          background: '#FFFFFF',
                          fontSize: 13,
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Title / Designation Presets */}
          <div className="form-group" style={{ margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label className="form-label" style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--neutral-dark)', margin: 0 }}>
                Executive Title &amp; Role Presets
              </label>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                Click a preset to automatically configure recommended jurisdiction and powers:
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              {SLT_ROLE_PRESETS.map((preset) => {
                const isSelected = sltTitle === preset.title;
                return (
                  <button
                    key={preset.title}
                    type="button"
                    onClick={() => {
                      setSltTitle(preset.title);
                      setSltScopeType(preset.defaultScopeType);
                      setSltManagedGrades(preset.defaultGrades || ['9', '10', '11', '12']);
                      setSltSectionScopeType('all');
                      setSltManagedSections([]);
                      setSltPermissions({ ...preset.defaultPermissions });
                    }}
                    style={{
                      padding: '7px 14px',
                      borderRadius: 6,
                      border: isSelected ? '1.5px solid #2C6E6A' : '1px solid var(--border-color)',
                      background: isSelected ? '#EAF3EF' : '#FFFFFF',
                      color: isSelected ? '#2C6E6A' : 'var(--neutral-dark)',
                      fontSize: 12,
                      fontWeight: isSelected ? 700 : 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      transition: 'all 0.12s ease',
                      boxShadow: isSelected ? '0 1px 3px rgba(44,110,106,0.1)' : 'none',
                    }}
                  >
                    {isSelected ? <Check size={13} /> : <Crown size={12} style={{ color: '#A8A29E' }} />}
                    {preset.title}
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              value={sltTitle}
              onChange={(e) => setSltTitle(e.target.value)}
              placeholder="e.g. Vice Principal, Head of Secondary, Academic Director"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 6,
                border: '1px solid var(--border-color)',
                background: '#FFFFFF',
                fontSize: 13,
              }}
            />
          </div>
        </div>

        {/* ── 2. INSTITUTIONAL JURISDICTION & COHORT SCOPING ── */}
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: 10,
            padding: '20px 24px',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F0EB', paddingBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 6, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1D4ED8' }}>
                <Building size={16} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: 'var(--neutral-dark)', letterSpacing: '0.04em' }}>
                  Institutional Jurisdiction &amp; Cohort Scoping
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                  Control the exact high school grade cohorts and classroom sections this SLT member can govern.
                </div>
              </div>
            </div>
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                background: sltScopeType === 'all' ? '#EFF6FF' : '#EAF3EF',
                color: sltScopeType === 'all' ? '#1D4ED8' : '#2C6E6A',
                padding: '4px 12px',
                borderRadius: 12,
              }}
            >
              {sltScopeType === 'all'
                ? 'Whole School (Grades 9-12)'
                : `${sltManagedGrades.length} Grade(s) • ${sltSectionScopeType === 'all' ? 'All Sections' : `${sltManagedSections.length} Sections`}`}
            </span>
          </div>

          {/* Primary Scope Toggle: Two Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
            <button
              type="button"
              onClick={() => {
                setSltScopeType('all');
                setSltManagedGrades(['9', '10', '11', '12']);
                setSltSectionScopeType('all');
                setSltManagedSections([]);
              }}
              style={{
                padding: '16px 18px',
                borderRadius: 8,
                border: sltScopeType === 'all' ? '2px solid #1D4ED8' : '1px solid var(--border-color)',
                background: sltScopeType === 'all' ? '#F8FAFC' : '#FAF9F6',
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                boxShadow: sltScopeType === 'all' ? '0 2px 5px rgba(29,78,216,0.08)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: sltScopeType === 'all' ? '#1D4ED8' : 'var(--neutral-dark)' }}>
                  Whole Institution
                </span>
                {sltScopeType === 'all' && <CheckCircle2 size={18} style={{ color: '#1D4ED8' }} />}
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                All Grades (9, 10, 11, 12) &amp; every classroom section across the institution.
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSltScopeType('custom');
                if (sltManagedGrades.length === 0) {
                  setSltManagedGrades(['9', '10']);
                }
              }}
              style={{
                padding: '16px 18px',
                borderRadius: 8,
                border: sltScopeType === 'custom' ? '2px solid #2C6E6A' : '1px solid var(--border-color)',
                background: sltScopeType === 'custom' ? '#F0FAF6' : '#FAF9F6',
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                boxShadow: sltScopeType === 'custom' ? '0 2px 5px rgba(44,110,106,0.08)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: sltScopeType === 'custom' ? '#2C6E6A' : 'var(--neutral-dark)' }}>
                  Custom Grade Cohorts &amp; Sections
                </span>
                {sltScopeType === 'custom' && <CheckCircle2 size={18} style={{ color: '#2C6E6A' }} />}
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Restrict jurisdiction to designated high school grades and fine-grained sections.
              </span>
            </button>
          </div>

          {/* Sub-scoping for Custom Grades and Sections */}
          {sltScopeType === 'custom' && (
            <div
              style={{
                background: '#FAF9F6',
                borderRadius: 8,
                border: '1px solid var(--border-color)',
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              {/* Grade Level Selector */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--neutral-dark)' }}>
                    1. Select Designated Grade Cohorts
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => setSltManagedGrades(['9', '10'])}
                      style={{ padding: '4px 10px', fontSize: 11, background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
                    >
                      Secondary (9-10)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSltManagedGrades(['11', '12'])}
                      style={{ padding: '4px 10px', fontSize: 11, background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
                    >
                      Senior (11-12)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSltManagedGrades(['9', '10', '11', '12'])}
                      style={{ padding: '4px 10px', fontSize: 11, background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
                    >
                      All (9-12)
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                  {['9', '10', '11', '12'].map((g) => {
                    const isGradeSelected = sltManagedGrades.includes(g);
                    const gradeSectionCount = availableSections.filter((s) => s.startsWith(`${g}-`)).length;
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => {
                          if (isGradeSelected) {
                            if (sltManagedGrades.length <= 1) {
                              alert('At least one grade must be selected.');
                              return;
                            }
                            setSltManagedGrades(sltManagedGrades.filter((x) => x !== g));
                            setSltManagedSections(sltManagedSections.filter((sec) => !sec.startsWith(`${g}-`)));
                          } else {
                            setSltManagedGrades([...sltManagedGrades, g].sort((a, b) => Number(a) - Number(b)));
                          }
                        }}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 8,
                          border: isGradeSelected ? '2px solid #2C6E6A' : '1px solid var(--border-color)',
                          background: isGradeSelected ? '#EAF3EF' : '#FFFFFF',
                          color: isGradeSelected ? '#2C6E6A' : 'var(--neutral-dark)',
                          fontWeight: isGradeSelected ? 700 : 500,
                          fontSize: 13,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          transition: 'all 0.12s ease',
                        }}
                      >
                        {isGradeSelected ? <CheckSquare size={16} /> : <Square size={16} style={{ color: '#A8A29E' }} />}
                        <span>Grade {g}</span>
                        {gradeSectionCount > 0 && (
                          <span style={{ fontSize: 10.5, color: isGradeSelected ? '#2C6E6A' : 'var(--text-secondary)', opacity: 0.8 }}>
                            ({gradeSectionCount} sec)
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section Granularity Toggle */}
              <div style={{ borderTop: '1px dashed #E2E8F0', paddingTop: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--neutral-dark)' }}>
                    2. Class Section Authority
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setSltSectionScopeType('all');
                        setSltManagedSections([]);
                      }}
                      style={{
                        padding: '5px 12px',
                        borderRadius: 5,
                        border: sltSectionScopeType === 'all' ? '1.5px solid #2C6E6A' : '1px solid var(--border-color)',
                        background: sltSectionScopeType === 'all' ? '#EAF3EF' : '#FFFFFF',
                        color: sltSectionScopeType === 'all' ? '#2C6E6A' : 'var(--neutral-dark)',
                        fontSize: 11.5,
                        fontWeight: sltSectionScopeType === 'all' ? 700 : 500,
                        cursor: 'pointer',
                      }}
                    >
                      All Sections in Selected Grades
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSltSectionScopeType('custom');
                        if (sltManagedSections.length === 0) {
                          const initial = availableSections.filter((sec) =>
                            sltManagedGrades.some((g) => sec.startsWith(`${g}-`))
                          );
                          setSltManagedSections(initial);
                        }
                      }}
                      style={{
                        padding: '5px 12px',
                        borderRadius: 5,
                        border: sltSectionScopeType === 'custom' ? '1.5px solid #2C6E6A' : '1px solid var(--border-color)',
                        background: sltSectionScopeType === 'custom' ? '#EAF3EF' : '#FFFFFF',
                        color: sltSectionScopeType === 'custom' ? '#2C6E6A' : 'var(--neutral-dark)',
                        fontSize: 11.5,
                        fontWeight: sltSectionScopeType === 'custom' ? 700 : 500,
                        cursor: 'pointer',
                      }}
                    >
                      Specific Sections Only
                    </button>
                  </div>
                </div>

                {/* Fine-grained sections selection */}
                {sltSectionScopeType === 'custom' ? (
                  <div style={{ background: '#FFFFFF', padding: '14px 16px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                        Select the exact classroom sections to grant oversight:
                      </span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => {
                            const visible = availableSections.filter((sec) =>
                              sltManagedGrades.some((g) => sec.startsWith(`${g}-`))
                            );
                            setSltManagedSections(visible);
                          }}
                          style={{
                            padding: '4px 10px',
                            fontSize: 11,
                            background: '#FAF9F6',
                            border: '1px solid var(--border-color)',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontWeight: 600,
                          }}
                        >
                          Select All Visible
                        </button>
                        <button
                          type="button"
                          onClick={() => setSltManagedSections([])}
                          style={{
                            padding: '4px 10px',
                            fontSize: 11,
                            background: '#FAF9F6',
                            border: '1px solid var(--border-color)',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontWeight: 600,
                          }}
                        >
                          Clear All
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {availableSections
                        .filter((sec) => sltManagedGrades.some((g) => sec.startsWith(`${g}-`)))
                        .map((sec) => {
                          const isChecked = sltManagedSections.includes(sec);
                          return (
                            <button
                              key={sec}
                              type="button"
                              onClick={() => {
                                if (isChecked) {
                                  setSltManagedSections(sltManagedSections.filter((s) => s !== sec));
                                } else {
                                  setSltManagedSections([...sltManagedSections, sec]);
                                }
                              }}
                              style={{
                                padding: '6px 12px',
                                borderRadius: 6,
                                border: isChecked ? '1.5px solid #2C6E6A' : '1px solid var(--border-color)',
                                background: isChecked ? '#EAF3EF' : '#FAF9F6',
                                color: isChecked ? '#2C6E6A' : 'var(--neutral-dark)',
                                fontWeight: isChecked ? 700 : 500,
                                fontSize: 12,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                transition: 'all 0.12s ease',
                              }}
                            >
                              {isChecked && <Check size={12} />}
                              Section {sec}
                            </button>
                          );
                        })}
                    </div>

                    {sltManagedSections.length === 0 && (
                      <div style={{ marginTop: 10, fontSize: 11.5, color: '#DC2626', fontWeight: 600 }}>
                        ⚠️ Warning: No sections selected. Please select at least one section or switch to &quot;All Sections in Selected Grades&quot;.
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: 4 }}>
                    SLT member will oversee all classroom sections across Grade {sltManagedGrades.join(', ')}.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── 3. DELEGATED INSTITUTIONAL POWERS MATRIX (4 DOMAINS) ── */}
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: 10,
            padding: '20px 24px',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F0EB', paddingBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 6, background: '#EAF3EF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2C6E6A' }}>
                <ShieldCheck size={16} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: 'var(--neutral-dark)', letterSpacing: '0.04em' }}>
                  Delegated Institutional Powers Matrix
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                  Granted exclusively by the Executive Head of School (Principal) to calibrate exact operational authorities.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#2C6E6A', background: '#EAF3EF', padding: '4px 12px', borderRadius: 12 }}>
                {totalPowersCount} / 20 Powers Active
              </span>
              <button
                type="button"
                onClick={() =>
                  setSltPermissions({
                    canViewAnalytics: true,
                    canExportStatements: true,
                    canManageHub: true,
                    canManageSettings: true,
                    canResetPasswords: true,
                    canAuditMarks: true,
                    canReleaseMarks: true,
                    canEditMarksRegisters: true,
                    canManageExamTerms: true,
                    canVerifySyllabus: true,
                    canManageLateEntries: true,
                    canManageAttendance: true,
                    canApproveLeaveRequests: true,
                    canLogBehaviorIncidents: true,
                    canViewDisciplineRecords: true,
                    canViewDirectory: true,
                    canEditStudentProfiles: true,
                    canManageClasses: true,
                    canAssignTeachers: true,
                    canBroadcastAnnouncements: true,
                  })
                }
                style={{
                  padding: '5px 12px',
                  borderRadius: 5,
                  border: '1px solid var(--border-color)',
                  background: '#FFFFFF',
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: 'var(--neutral-dark)',
                }}
              >
                Grant All (20)
              </button>
              <button
                type="button"
                onClick={() =>
                  setSltPermissions({
                    canViewAnalytics: false,
                    canExportStatements: false,
                    canManageHub: false,
                    canManageSettings: false,
                    canResetPasswords: false,
                    canAuditMarks: false,
                    canReleaseMarks: false,
                    canEditMarksRegisters: false,
                    canManageExamTerms: false,
                    canVerifySyllabus: false,
                    canManageLateEntries: false,
                    canManageAttendance: false,
                    canApproveLeaveRequests: false,
                    canLogBehaviorIncidents: false,
                    canViewDisciplineRecords: false,
                    canViewDirectory: false,
                    canEditStudentProfiles: false,
                    canManageClasses: false,
                    canAssignTeachers: false,
                    canBroadcastAnnouncements: false,
                  })
                }
                style={{
                  padding: '5px 12px',
                  borderRadius: 5,
                  border: '1px solid var(--border-color)',
                  background: '#FFFFFF',
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                }}
              >
                Revoke All
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
            {/* Quadrant 1: Academic & Assessment Governance */}
            <div style={{ background: '#FAF9F6', borderRadius: 8, border: '1px solid var(--border-color)', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ECEAE5', paddingBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#2C6E6A', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <BookOpen size={14} /> Academic &amp; Assessment
                </span>
                <span style={{ fontSize: 11, color: '#2C6E6A', fontWeight: 700, background: '#EAF3EF', padding: '2px 8px', borderRadius: 10 }}>
                  {[
                    sltPermissions.canAuditMarks,
                    sltPermissions.canReleaseMarks,
                    sltPermissions.canEditMarksRegisters,
                    sltPermissions.canManageExamTerms,
                    sltPermissions.canVerifySyllabus,
                  ].filter(Boolean).length} / 5
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { key: 'canAuditMarks', label: 'Audit Exam Marks Registers', sub: 'Review raw marks, class registers & report sheets' },
                  { key: 'canReleaseMarks', label: 'Publish & Release Exam Results', sub: 'Authorize score release to students & parents' },
                  { key: 'canEditMarksRegisters', label: 'Direct Marks Ledger Modification', sub: 'Edit raw student scores in teacher gradebooks' },
                  { key: 'canManageExamTerms', label: 'Exam Terms & Weightings', sub: 'Configure terms, assessment weightings & curves' },
                  { key: 'canVerifySyllabus', label: 'Syllabus Coverage & Pacing', sub: 'Audit teacher lesson delivery and curriculum plans' },
                ].map(({ key, label, sub }) => (
                  <label
                    key={key}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '8px 10px',
                      borderRadius: 6,
                      background: (sltPermissions as any)[key] ? '#FFFFFF' : 'transparent',
                      border: (sltPermissions as any)[key] ? '1px solid #D6D4CC' : '1px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!!(sltPermissions as any)[key]}
                      onChange={(e) => setSltPermissions({ ...sltPermissions, [key]: e.target.checked })}
                      style={{ marginTop: 2, accentColor: '#2C6E6A' }}
                    />
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>{label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>{sub}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Quadrant 2: Attendance, Conduct & Pastoral Care */}
            <div style={{ background: '#FAF9F6', borderRadius: 8, border: '1px solid var(--border-color)', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ECEAE5', paddingBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#1D4ED8', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={14} /> Attendance, Conduct &amp; Pastoral
                </span>
                <span style={{ fontSize: 11, color: '#1D4ED8', fontWeight: 700, background: '#EFF6FF', padding: '2px 8px', borderRadius: 10 }}>
                  {[
                    sltPermissions.canManageLateEntries,
                    sltPermissions.canManageAttendance,
                    sltPermissions.canApproveLeaveRequests,
                    sltPermissions.canLogBehaviorIncidents,
                    sltPermissions.canViewDisciplineRecords,
                  ].filter(Boolean).length} / 5
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { key: 'canManageLateEntries', label: 'Gate Late Entry Desk', sub: 'Log morning arrivals, print digital gate slips' },
                  { key: 'canManageAttendance', label: 'Daily Attendance Registers', sub: 'Audit daily presence, excuse unexcused absences' },
                  { key: 'canApproveLeaveRequests', label: 'Leave Request Approvals', sub: 'Authorize official medical and personal leave slips' },
                  { key: 'canLogBehaviorIncidents', label: 'Behavior & Infraction Points', sub: 'Issue disciplinary notices, merits and demerits' },
                  { key: 'canViewDisciplineRecords', label: 'Confidential Pastoral Dossiers', sub: 'Access complete student incident history & notes' },
                ].map(({ key, label, sub }) => (
                  <label
                    key={key}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '8px 10px',
                      borderRadius: 6,
                      background: (sltPermissions as any)[key] ? '#FFFFFF' : 'transparent',
                      border: (sltPermissions as any)[key] ? '1px solid #D6D4CC' : '1px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!!(sltPermissions as any)[key]}
                      onChange={(e) => setSltPermissions({ ...sltPermissions, [key]: e.target.checked })}
                      style={{ marginTop: 2, accentColor: '#1D4ED8' }}
                    />
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>{label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>{sub}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Quadrant 3: Classes, Cohorts & Directory Governance */}
            <div style={{ background: '#FAF9F6', borderRadius: 8, border: '1px solid var(--border-color)', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ECEAE5', paddingBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#7C5CBF', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Users size={14} /> Classes, Cohorts &amp; Directory
                </span>
                <span style={{ fontSize: 11, color: '#7C5CBF', fontWeight: 700, background: '#F3EFFA', padding: '2px 8px', borderRadius: 10 }}>
                  {[
                    sltPermissions.canViewDirectory,
                    sltPermissions.canEditStudentProfiles,
                    sltPermissions.canManageClasses,
                    sltPermissions.canAssignTeachers,
                    sltPermissions.canBroadcastAnnouncements,
                  ].filter(Boolean).length} / 5
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { key: 'canViewDirectory', label: 'User Directory Oversight', sub: 'Search and browse students, parents, faculty rosters' },
                  { key: 'canEditStudentProfiles', label: 'Modify Student & Guardian Records', sub: 'Update student profiles, contact details & admissions' },
                  { key: 'canManageClasses', label: 'Class Sections & Batches', sub: 'Create classroom sections, archive and configure batches' },
                  { key: 'canAssignTeachers', label: 'Faculty & Timetable Allocations', sub: 'Assign subject teachers and class tutors to classes' },
                  { key: 'canBroadcastAnnouncements', label: 'Executive School Broadcasts', sub: 'Issue school-wide alerts, bulletins and notices' },
                ].map(({ key, label, sub }) => (
                  <label
                    key={key}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '8px 10px',
                      borderRadius: 6,
                      background: (sltPermissions as any)[key] ? '#FFFFFF' : 'transparent',
                      border: (sltPermissions as any)[key] ? '1px solid #D6D4CC' : '1px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!!(sltPermissions as any)[key]}
                      onChange={(e) => setSltPermissions({ ...sltPermissions, [key]: e.target.checked })}
                      style={{ marginTop: 2, accentColor: '#7C5CBF' }}
                    />
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>{label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>{sub}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Quadrant 4: Executive Analytics, Hub & Operations */}
            <div style={{ background: '#FAF9F6', borderRadius: 8, border: '1px solid var(--border-color)', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ECEAE5', paddingBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#D97706', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <BarChart3 size={14} /> Analytics, Hub &amp; Operations
                </span>
                <span style={{ fontSize: 11, color: '#D97706', fontWeight: 700, background: '#FEF3C7', padding: '2px 8px', borderRadius: 10 }}>
                  {[
                    sltPermissions.canViewAnalytics,
                    sltPermissions.canExportStatements,
                    sltPermissions.canManageHub,
                    sltPermissions.canResetPasswords,
                    sltPermissions.canManageSettings,
                  ].filter(Boolean).length} / 5
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { key: 'canViewAnalytics', label: 'Executive Intelligence & Dashboards', sub: 'Full access to cohort performance curves & analytics' },
                  { key: 'canExportStatements', label: 'Ministry & Board Statements', sub: 'Generate official grade registers and PDF/CSV dossiers' },
                  { key: 'canManageHub', label: 'Holistic Activities & Co-Curricular Hub', sub: 'Oversee house points, clubs, events and competitions' },
                  { key: 'canResetPasswords', label: 'Reset Credentials & Passwords', sub: 'Delegate password reset capabilities for accounts' },
                  { key: 'canManageSettings', label: 'System Settings & Access Policies', sub: 'Administrative preferences and platform parameters' },
                ].map(({ key, label, sub }) => (
                  <label
                    key={key}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '8px 10px',
                      borderRadius: 6,
                      background: (sltPermissions as any)[key] ? '#FFFFFF' : 'transparent',
                      border: (sltPermissions as any)[key] ? '1px solid #D6D4CC' : '1px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!!(sltPermissions as any)[key]}
                      onChange={(e) => setSltPermissions({ ...sltPermissions, [key]: e.target.checked })}
                      style={{ marginTop: 2, accentColor: '#D97706' }}
                    />
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>{label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>{sub}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── 4. STICKY BOTTOM ACTION FOOTER ── */}
        <div
          style={{
            position: 'sticky',
            bottom: 0,
            zIndex: 10,
            background: '#FFFFFF',
            border: '1px solid var(--border-color)',
            borderRadius: 10,
            padding: '14px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            boxShadow: '0 -4px 16px rgba(0,0,0,0.06)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1A1A1A', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12 }}>
              <ShieldCheck size={16} />
            </div>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                {sltTitle || 'Senior Leadership Member'} • {sltScopeType === 'all' ? 'Whole School (Grades 9-12)' : `Grades: ${sltManagedGrades.join(', ')} (${sltSectionScopeType === 'all' ? 'All Sections' : `${sltManagedSections.length} Sections`})`}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                {totalPowersCount} of 20 institutional powers authorized
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={handleCloseSltEditor}
              style={{
                padding: '9px 18px',
                borderRadius: 6,
                border: '1px solid var(--border-color)',
                background: '#FFFFFF',
                fontSize: 12.5,
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
                padding: '9px 26px',
                borderRadius: 6,
                border: 'none',
                background: '#1A1A1A',
                color: '#FFFFFF',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: isSaving ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
              }}
            >
              <ShieldCheck size={16} />
              <span>{isSaving ? 'Saving Delegated Authority...' : editingSltId ? 'Save Changes' : 'Confirm SLT Appointment'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── FULL PAGE: HEAD OF DEPARTMENT JURISDICTION & POWERS EDITOR ──
  if (isHodModalOpen) {
    const totalHodPowersCount = Object.values(hodPermissions).filter(Boolean).length;
    const editingAssignment = editingHodId ? assignments.find((a) => a.id === editingHodId) : null;
    const currentDeptDef = ACADEMIC_DEPARTMENTS.find((d) => d.name === selectedHodDept) || ACADEMIC_DEPARTMENTS[0];
    const memberName = editingAssignment
      ? editingAssignment.userName
      : profiles.find((p) => p.id === selectedHodUserId)?.name || '';
    const memberEmail = editingAssignment
      ? editingAssignment.userEmail
      : profiles.find((p) => p.id === selectedHodUserId)?.email || '';
    const memberDesignation = editingAssignment
      ? editingAssignment.title || `Head of ${selectedHodDept}`
      : hodTitle || `Head of ${selectedHodDept}`;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%', paddingBottom: 40, maxWidth: 1200, margin: '0 auto' }}>
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

        {/* ── TOP BREADCRUMB & DEPARTMENT EXECUTIVE HEADER ── */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid var(--border-color)',
            borderRadius: 10,
            padding: '18px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          {/* Breadcrumb Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F0EB', paddingBottom: 12 }}>
            <button
              type="button"
              onClick={handleCloseHodEditor}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 14px',
                borderRadius: 6,
                border: '1px solid var(--border-color)',
                background: '#FAF9F6',
                color: 'var(--neutral-dark)',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#F2F1EC';
                e.currentTarget.style.borderColor = '#D6D4CC';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#FAF9F6';
                e.currentTarget.style.borderColor = 'var(--border-color)';
              }}
            >
              <ArrowLeft size={15} />
              <span>Back to Special Access &amp; Roles</span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  background: currentDeptDef.bg,
                  color: currentDeptDef.color,
                  border: `1px solid ${currentDeptDef.border}`,
                  padding: '4px 10px',
                  borderRadius: 12,
                  letterSpacing: '0.04em',
                }}
              >
                {currentDeptDef.code} • {selectedHodDept.toUpperCase()}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  background: totalHodPowersCount > 0 ? '#EAF3EF' : '#FEF3C7',
                  color: totalHodPowersCount > 0 ? '#2C6E6A' : '#92400E',
                  padding: '4px 10px',
                  borderRadius: 12,
                }}
              >
                {totalHodPowersCount} / 20 Powers Active
              </span>
            </div>
          </div>

          {/* Title & Action Buttons Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 10,
                  background: currentDeptDef.bg,
                  border: `1.5px solid ${currentDeptDef.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: currentDeptDef.color,
                  flexShrink: 0,
                  boxShadow: '0 2px 5px rgba(0,0,0,0.06)',
                }}
              >
                {getDepartmentIcon(currentDeptDef.iconName, 24)}
              </div>
              <div>
                <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: 'var(--neutral-dark)', letterSpacing: '-0.01em', fontFamily: 'var(--font-display)' }}>
                  {editingHodId ? `Edit ${selectedHodDept} Jurisdiction & Powers` : `Appoint Head of ${selectedHodDept}`}
                </h1>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                  Assign departmental leadership, enforce grade &amp; section jurisdiction, and calibrate delegated subject academic authorities.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                onClick={handleCloseHodEditor}
                style={{
                  padding: '9px 18px',
                  borderRadius: 6,
                  border: '1px solid var(--border-color)',
                  background: '#FFFFFF',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: 'var(--neutral-dark)',
                  transition: 'background 0.15s ease',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveHodAssignment}
                disabled={isSaving}
                style={{
                  padding: '9px 24px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#1A1A1A',
                  color: '#FFFFFF',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                }}
              >
                <ShieldCheck size={16} />
                <span>{isSaving ? 'Saving Delegated Authority...' : editingHodId ? 'Save Changes' : 'Confirm HOD Appointment'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── 1. DEPARTMENT IDENTITY & FACULTY LEAD ── */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid var(--border-color)',
            borderRadius: 10,
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #F1F0EB', paddingBottom: 12 }}>
            <div style={{ width: 30, height: 30, borderRadius: 6, background: currentDeptDef.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: currentDeptDef.color }}>
              <UserCheck size={16} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: 'var(--neutral-dark)', letterSpacing: '0.04em' }}>
                Department Identity &amp; Faculty Lead
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                Target academic department, candidate faculty member, and official leadership designation.
              </div>
            </div>
          </div>

          {/* Department Switcher & Subjects Pill Strip */}
          <div style={{ background: '#FAF9F6', borderRadius: 8, border: '1px solid var(--border-color)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                Select Academic Department:
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>Subjects:</span>
                {currentDeptDef.subjects.map((subj) => (
                  <span
                    key={subj}
                    style={{
                      fontSize: 10.5,
                      fontWeight: 600,
                      background: '#FFFFFF',
                      color: currentDeptDef.color,
                      border: `1px solid ${currentDeptDef.border}`,
                      padding: '2px 8px',
                      borderRadius: 4,
                    }}
                  >
                    {subj}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {ACADEMIC_DEPARTMENTS.map((dept) => {
                const isSelectedDept = selectedHodDept === dept.name;
                return (
                  <button
                    key={dept.id}
                    type="button"
                    onClick={() => {
                      setSelectedHodDept(dept.name);
                      if (!editingHodId) {
                        setHodTitle(`Head of ${dept.name}`);
                        const matchTeacher = teachers.find(
                          (t) => t.department === dept.name || (dept.subjects && dept.subjects.includes(t.subject || ''))
                        );
                        if (matchTeacher) {
                          setSelectedHodUserId(matchTeacher.id);
                        }
                      }
                    }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 6,
                      border: isSelectedDept ? `2px solid ${dept.color}` : '1px solid var(--border-color)',
                      background: isSelectedDept ? dept.bg : '#FFFFFF',
                      color: isSelectedDept ? dept.color : 'var(--neutral-dark)',
                      fontWeight: isSelectedDept ? 700 : 500,
                      fontSize: 12,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      transition: 'all 0.12s ease',
                      boxShadow: isSelectedDept ? `0 1px 4px ${dept.color}22` : 'none',
                    }}
                  >
                    {getDepartmentIcon(dept.iconName, 13)}
                    <span>{dept.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {editingHodId ? (
            /* Editing Banner for existing HOD */
            <div
              style={{
                background: '#FAF9F6',
                border: '1px solid var(--border-color)',
                borderRadius: 8,
                padding: '14px 18px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: currentDeptDef.color,
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 16,
                  }}
                >
                  {(memberName || 'H').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--neutral-dark)' }}>
                    {memberName}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                    {memberEmail}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    padding: '4px 12px',
                    borderRadius: 6,
                    background: currentDeptDef.bg,
                    color: currentDeptDef.color,
                    border: `1px solid ${currentDeptDef.border}`,
                  }}
                >
                  {memberDesignation}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '4px 10px',
                    borderRadius: 6,
                    background: '#EFF6FF',
                    color: '#1D4ED8',
                  }}
                >
                  Active Department Head
                </span>
              </div>
            </div>
          ) : (
            /* Faculty Selection */
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--neutral-dark)', marginBottom: 6, display: 'block' }}>
                Select Faculty Member for Department Leadership
              </label>
              <CustomSelect
                value={selectedHodUserId}
                onChange={(val) => {
                  setSelectedHodUserId(val);
                  const t = profiles.find((p) => p.id === val);
                  if (t && !hodTitle) {
                    setHodTitle(`Head of ${selectedHodDept}`);
                  }
                }}
                placeholder="-- Choose Faculty Member --"
                searchable={true}
                options={[
                  { value: '', label: '-- Choose Faculty Member --' },
                  ...teachers.map((t) => {
                    const isDeptSubject = currentDeptDef.subjects.includes(t.subject || '');
                    const badge = isDeptSubject ? ` ⭐ (${t.subject})` : t.subject ? ` (${t.subject})` : '';
                    return {
                      value: t.id,
                      label: `${t.name} (${t.email})${badge}`,
                    };
                  }),
                ]}
              />
            </div>
          )}

          {/* Title / Designation & Presets */}
          <div className="form-group" style={{ margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label className="form-label" style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--neutral-dark)', margin: 0 }}>
                HOD Title &amp; Governance Presets
              </label>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                Click a preset to automatically configure recommended scope and delegated powers:
              </span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              {HOD_ROLE_PRESETS.map((preset) => {
                const isSelected = hodTitle.includes(preset.title) || (preset.code === 'FULL' && totalHodPowersCount === 20);
                return (
                  <button
                    key={preset.title}
                    type="button"
                    onClick={() => {
                      setHodTitle(
                        preset.code === 'FULL'
                          ? `Head of ${selectedHodDept}`
                          : `Head of ${selectedHodDept} (${preset.title})`
                      );
                      setHodScopeType(preset.defaultScopeType);
                      setHodManagedGrades(preset.defaultGrades || ['9', '10', '11', '12']);
                      setHodSectionScopeType('all');
                      setHodManagedSections([]);
                      setHodPermissions({ ...preset.defaultPermissions });
                    }}
                    style={{
                      padding: '7px 14px',
                      borderRadius: 6,
                      border: isSelected ? `1.5px solid ${currentDeptDef.color}` : '1px solid var(--border-color)',
                      background: isSelected ? currentDeptDef.bg : '#FFFFFF',
                      color: isSelected ? currentDeptDef.color : 'var(--neutral-dark)',
                      fontSize: 12,
                      fontWeight: isSelected ? 700 : 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      transition: 'all 0.12s ease',
                      boxShadow: isSelected ? `0 1px 3px ${currentDeptDef.color}22` : 'none',
                    }}
                  >
                    {isSelected ? <Check size={13} /> : <ShieldCheck size={12} style={{ color: '#A8A29E' }} />}
                    {preset.title}
                  </button>
                );
              })}
            </div>

            <input
              type="text"
              value={hodTitle}
              onChange={(e) => setHodTitle(e.target.value)}
              placeholder={`e.g. Head of ${selectedHodDept}, Academic Subject Chair`}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 6,
                border: '1px solid var(--border-color)',
                background: '#FFFFFF',
                fontSize: 13,
              }}
            />
          </div>
        </div>

        {/* ── 2. DEPARTMENTAL JURISDICTION & COHORT SCOPING ── */}
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: 10,
            padding: '20px 24px',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F0EB', paddingBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 6, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1D4ED8' }}>
                <Building size={16} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: 'var(--neutral-dark)', letterSpacing: '0.04em' }}>
                  Departmental Jurisdiction &amp; Cohort Scoping
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                  Control the exact high school grade cohorts and classroom sections this Head of Department oversees.
                </div>
              </div>
            </div>
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                background: hodScopeType === 'all' ? '#EFF6FF' : '#EAF3EF',
                color: hodScopeType === 'all' ? '#1D4ED8' : '#2C6E6A',
                padding: '4px 12px',
                borderRadius: 12,
              }}
            >
              {hodScopeType === 'all'
                ? 'Whole Department (Grades 9-12)'
                : `${hodManagedGrades.length} Grade(s) • ${hodSectionScopeType === 'all' ? 'All Sections' : `${hodManagedSections.length} Sections`}`}
            </span>
          </div>

          {/* Primary Scope Toggle: Two Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
            <button
              type="button"
              onClick={() => {
                setHodScopeType('all');
                setHodManagedGrades(['9', '10', '11', '12']);
                setHodSectionScopeType('all');
                setHodManagedSections([]);
              }}
              style={{
                padding: '16px 18px',
                borderRadius: 8,
                border: hodScopeType === 'all' ? '2px solid #1D4ED8' : '1px solid var(--border-color)',
                background: hodScopeType === 'all' ? '#F8FAFC' : '#FAF9F6',
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                boxShadow: hodScopeType === 'all' ? '0 2px 5px rgba(29,78,216,0.08)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: hodScopeType === 'all' ? '#1D4ED8' : 'var(--neutral-dark)' }}>
                  Whole Department
                </span>
                {hodScopeType === 'all' && <CheckCircle2 size={18} style={{ color: '#1D4ED8' }} />}
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                All Grades (9, 10, 11, 12) &amp; every classroom section under {selectedHodDept}.
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setHodScopeType('custom');
                if (hodManagedGrades.length === 0) {
                  setHodManagedGrades(['9', '10']);
                }
              }}
              style={{
                padding: '16px 18px',
                borderRadius: 8,
                border: hodScopeType === 'custom' ? '2px solid #2C6E6A' : '1px solid var(--border-color)',
                background: hodScopeType === 'custom' ? '#F0FAF6' : '#FAF9F6',
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                boxShadow: hodScopeType === 'custom' ? '0 2px 5px rgba(44,110,106,0.08)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: hodScopeType === 'custom' ? '#2C6E6A' : 'var(--neutral-dark)' }}>
                  Custom Grade Cohorts &amp; Sections
                </span>
                {hodScopeType === 'custom' && <CheckCircle2 size={18} style={{ color: '#2C6E6A' }} />}
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Restrict HOD jurisdiction to specific grade bands (e.g. Grades 9-10 only) and designated sections.
              </span>
            </button>
          </div>

          {/* Sub-scoping for Custom Grades and Sections */}
          {hodScopeType === 'custom' && (
            <div
              style={{
                background: '#FAF9F6',
                borderRadius: 8,
                border: '1px solid var(--border-color)',
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              {/* Grade Level Selector */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--neutral-dark)' }}>
                    1. Select Designated Grade Cohorts
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => setHodManagedGrades(['9', '10'])}
                      style={{ padding: '4px 10px', fontSize: 11, background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
                    >
                      Secondary (9-10)
                    </button>
                    <button
                      type="button"
                      onClick={() => setHodManagedGrades(['11', '12'])}
                      style={{ padding: '4px 10px', fontSize: 11, background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
                    >
                      Senior (11-12)
                    </button>
                    <button
                      type="button"
                      onClick={() => setHodManagedGrades(['9', '10', '11', '12'])}
                      style={{ padding: '4px 10px', fontSize: 11, background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
                    >
                      All (9-12)
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                  {['9', '10', '11', '12'].map((g) => {
                    const isGradeSelected = hodManagedGrades.includes(g);
                    const gradeSectionCount = availableSections.filter((s) => s.startsWith(`${g}-`)).length;
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => {
                          if (isGradeSelected) {
                            if (hodManagedGrades.length <= 1) {
                              alert('At least one grade must be selected.');
                              return;
                            }
                            setHodManagedGrades(hodManagedGrades.filter((x) => x !== g));
                            setHodManagedSections(hodManagedSections.filter((sec) => !sec.startsWith(`${g}-`)));
                          } else {
                            setHodManagedGrades([...hodManagedGrades, g].sort((a, b) => Number(a) - Number(b)));
                          }
                        }}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 8,
                          border: isGradeSelected ? '2px solid #2C6E6A' : '1px solid var(--border-color)',
                          background: isGradeSelected ? '#EAF3EF' : '#FFFFFF',
                          color: isGradeSelected ? '#2C6E6A' : 'var(--neutral-dark)',
                          fontWeight: isGradeSelected ? 700 : 500,
                          fontSize: 13,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          transition: 'all 0.12s ease',
                        }}
                      >
                        {isGradeSelected ? <CheckSquare size={16} /> : <Square size={16} style={{ color: '#A8A29E' }} />}
                        <span>Grade {g}</span>
                        {gradeSectionCount > 0 && (
                          <span style={{ fontSize: 10.5, color: isGradeSelected ? '#2C6E6A' : 'var(--text-secondary)', opacity: 0.8 }}>
                            ({gradeSectionCount} sec)
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section Granularity Toggle */}
              <div style={{ borderTop: '1px dashed #E2E8F0', paddingTop: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--neutral-dark)' }}>
                    2. Class Section Authority
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setHodSectionScopeType('all');
                        setHodManagedSections([]);
                      }}
                      style={{
                        padding: '5px 12px',
                        borderRadius: 5,
                        border: hodSectionScopeType === 'all' ? '1.5px solid #2C6E6A' : '1px solid var(--border-color)',
                        background: hodSectionScopeType === 'all' ? '#EAF3EF' : '#FFFFFF',
                        color: hodSectionScopeType === 'all' ? '#2C6E6A' : 'var(--neutral-dark)',
                        fontSize: 11.5,
                        fontWeight: hodSectionScopeType === 'all' ? 700 : 500,
                        cursor: 'pointer',
                      }}
                    >
                      All Sections in Selected Grades
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setHodSectionScopeType('custom');
                        if (hodManagedSections.length === 0) {
                          const initial = availableSections.filter((sec) =>
                            hodManagedGrades.some((g) => sec.startsWith(`${g}-`))
                          );
                          setHodManagedSections(initial);
                        }
                      }}
                      style={{
                        padding: '5px 12px',
                        borderRadius: 5,
                        border: hodSectionScopeType === 'custom' ? '1.5px solid #2C6E6A' : '1px solid var(--border-color)',
                        background: hodSectionScopeType === 'custom' ? '#EAF3EF' : '#FFFFFF',
                        color: hodSectionScopeType === 'custom' ? '#2C6E6A' : 'var(--neutral-dark)',
                        fontSize: 11.5,
                        fontWeight: hodSectionScopeType === 'custom' ? 700 : 500,
                        cursor: 'pointer',
                      }}
                    >
                      Specific Sections Only
                    </button>
                  </div>
                </div>

                {/* Fine-grained sections selection */}
                {hodSectionScopeType === 'custom' ? (
                  <div style={{ background: '#FFFFFF', padding: '14px 16px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                        Select the exact classroom sections to grant HOD oversight:
                      </span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => {
                            const visible = availableSections.filter((sec) =>
                              hodManagedGrades.some((g) => sec.startsWith(`${g}-`))
                            );
                            setHodManagedSections(visible);
                          }}
                          style={{
                            padding: '4px 10px',
                            fontSize: 11,
                            background: '#FAF9F6',
                            border: '1px solid var(--border-color)',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontWeight: 600,
                          }}
                        >
                          Select All Visible
                        </button>
                        <button
                          type="button"
                          onClick={() => setHodManagedSections([])}
                          style={{
                            padding: '4px 10px',
                            fontSize: 11,
                            background: '#FAF9F6',
                            border: '1px solid var(--border-color)',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontWeight: 600,
                          }}
                        >
                          Clear All
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {availableSections
                        .filter((sec) => hodManagedGrades.some((g) => sec.startsWith(`${g}-`)))
                        .map((sec) => {
                          const isChecked = hodManagedSections.includes(sec);
                          return (
                            <button
                              key={sec}
                              type="button"
                              onClick={() => {
                                if (isChecked) {
                                  setHodManagedSections(hodManagedSections.filter((s) => s !== sec));
                                } else {
                                  setHodManagedSections([...hodManagedSections, sec]);
                                }
                              }}
                              style={{
                                padding: '6px 12px',
                                borderRadius: 6,
                                border: isChecked ? '1.5px solid #2C6E6A' : '1px solid var(--border-color)',
                                background: isChecked ? '#EAF3EF' : '#FAF9F6',
                                color: isChecked ? '#2C6E6A' : 'var(--neutral-dark)',
                                fontWeight: isChecked ? 700 : 500,
                                fontSize: 12,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                transition: 'all 0.12s ease',
                              }}
                            >
                              {isChecked && <Check size={12} />}
                              Section {sec}
                            </button>
                          );
                        })}
                    </div>

                    {hodManagedSections.length === 0 && (
                      <div style={{ marginTop: 10, fontSize: 11.5, color: '#DC2626', fontWeight: 600 }}>
                        ⚠️ Warning: No sections selected. Please select at least one section or switch to &quot;All Sections in Selected Grades&quot;.
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: 4 }}>
                    HOD will oversee all classroom sections across Grade {hodManagedGrades.join(', ')}.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── 3. DELEGATED DEPARTMENTAL POWERS MATRIX (4 DOMAINS, 20 POWERS) ── */}
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: 10,
            padding: '20px 24px',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F0EB', paddingBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 6, background: '#EAF3EF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2C6E6A' }}>
                <ShieldCheck size={16} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: 'var(--neutral-dark)', letterSpacing: '0.04em' }}>
                  Delegated Departmental Powers Matrix
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                  Granted exclusively by the Executive Head of School (Principal) to calibrate exact subject authorities.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#2C6E6A', background: '#EAF3EF', padding: '4px 12px', borderRadius: 12 }}>
                {totalHodPowersCount} / 20 Powers Active
              </span>
              <button
                type="button"
                onClick={() =>
                  setHodPermissions({
                    canVerifySyllabus: true,
                    canAuditLessonPlans: true,
                    canManageCurriculumResources: true,
                    canApproveAssessmentsBank: true,
                    canOverseeLabPracticals: true,
                    canAuditMarks: true,
                    canModerateAssessmentMarks: true,
                    canVerifyPassFailThresholds: true,
                    canReviewSubmissions: true,
                    canApproveGradeChanges: true,
                    canBroadcastDepartment: true,
                    canIssueFacultyDirectives: true,
                    canPinStudyNotices: true,
                    canApproveClearances: true,
                    canCoordinateSubjectEvents: true,
                    canViewAnalytics: true,
                    canAuditTeacherMarkingPace: true,
                    canGenerateSubjectReports: true,
                    canAuthorizeExemptions: true,
                    canConductTeacherObservations: true,
                  })
                }
                style={{
                  padding: '5px 12px',
                  borderRadius: 5,
                  border: '1px solid var(--border-color)',
                  background: '#FFFFFF',
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: 'var(--neutral-dark)',
                }}
              >
                Grant All (20)
              </button>
              <button
                type="button"
                onClick={() =>
                  setHodPermissions({
                    canVerifySyllabus: false,
                    canAuditLessonPlans: false,
                    canManageCurriculumResources: false,
                    canApproveAssessmentsBank: false,
                    canOverseeLabPracticals: false,
                    canAuditMarks: false,
                    canModerateAssessmentMarks: false,
                    canVerifyPassFailThresholds: false,
                    canReviewSubmissions: false,
                    canApproveGradeChanges: false,
                    canBroadcastDepartment: false,
                    canIssueFacultyDirectives: false,
                    canPinStudyNotices: false,
                    canApproveClearances: false,
                    canCoordinateSubjectEvents: false,
                    canViewAnalytics: false,
                    canAuditTeacherMarkingPace: false,
                    canGenerateSubjectReports: false,
                    canAuthorizeExemptions: false,
                    canConductTeacherObservations: false,
                  })
                }
                style={{
                  padding: '5px 12px',
                  borderRadius: 5,
                  border: '1px solid var(--border-color)',
                  background: '#FFFFFF',
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                }}
              >
                Revoke All
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
            {/* Quadrant 1: Curriculum & Syllabus Governance */}
            <div style={{ background: '#FAF9F6', borderRadius: 8, border: '1px solid var(--border-color)', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ECEAE5', paddingBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#2C6E6A', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <BookOpen size={14} /> Curriculum &amp; Syllabus
                </span>
                <span style={{ fontSize: 11, color: '#2C6E6A', fontWeight: 700, background: '#EAF3EF', padding: '2px 8px', borderRadius: 10 }}>
                  {[
                    hodPermissions.canVerifySyllabus,
                    hodPermissions.canAuditLessonPlans,
                    hodPermissions.canManageCurriculumResources,
                    hodPermissions.canApproveAssessmentsBank,
                    hodPermissions.canOverseeLabPracticals,
                  ].filter(Boolean).length} / 5
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { key: 'canVerifySyllabus', label: 'Syllabus Coverage & Weekly Pacing', sub: 'Audit teacher syllabus completion pace, unit trackers & academic term schedules' },
                  { key: 'canAuditLessonPlans', label: 'Lesson Plans & Pedagogical Delivery', sub: 'Review, approve, and give feedback on weekly faculty lesson plans & teaching artifacts' },
                  { key: 'canManageCurriculumResources', label: 'Curriculum Hub & Subject Resources', sub: 'Authorize core textbooks, digital learning resources, question banks & supplementary materials' },
                  { key: 'canApproveAssessmentsBank', label: 'Question Bank & Exam Paper Moderation', sub: 'Scrutinize and approve teacher-submitted question papers, blueprints & marking rubrics' },
                  { key: 'canOverseeLabPracticals', label: 'Subject Labs & Practical Portfolios', sub: 'Supervise science/CS laboratories, equipment safety protocols & student practical records' },
                ].map(({ key, label, sub }) => (
                  <label
                    key={key}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '8px 10px',
                      borderRadius: 6,
                      background: (hodPermissions as any)[key] ? '#FFFFFF' : 'transparent',
                      border: (hodPermissions as any)[key] ? '1px solid #D6D4CC' : '1px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!!(hodPermissions as any)[key]}
                      onChange={(e) => setHodPermissions({ ...hodPermissions, [key]: e.target.checked })}
                      style={{ marginTop: 2, accentColor: '#2C6E6A' }}
                    />
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>{label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>{sub}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Quadrant 2: Marks Registers & Assessment Moderation */}
            <div style={{ background: '#FAF9F6', borderRadius: 8, border: '1px solid var(--border-color)', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ECEAE5', paddingBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#1D4ED8', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FileText size={14} /> Marks &amp; Assessment Moderation
                </span>
                <span style={{ fontSize: 11, color: '#1D4ED8', fontWeight: 700, background: '#EFF6FF', padding: '2px 8px', borderRadius: 10 }}>
                  {[
                    hodPermissions.canAuditMarks,
                    hodPermissions.canModerateAssessmentMarks,
                    hodPermissions.canVerifyPassFailThresholds,
                    hodPermissions.canReviewSubmissions,
                    hodPermissions.canApproveGradeChanges,
                  ].filter(Boolean).length} / 5
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { key: 'canAuditMarks', label: 'Subject Marks Registers Audit', sub: 'Audit teacher gradebooks, subject term scores, raw marks entries & marks tabulation sheets' },
                  { key: 'canModerateAssessmentMarks', label: 'Internal Assessment & Term Moderation', sub: 'Moderate subject marks, scrutinize grade anomalies & approve mark adjustments' },
                  { key: 'canVerifyPassFailThresholds', label: 'Remedial Thresholds & Pass/Fail Audits', sub: 'Identify subject underperformers, mandate remedial learning plans & approve retests' },
                  { key: 'canReviewSubmissions', label: 'Coursework & Project Scrutiny', sub: 'Inspect sample student coursework, subject portfolio assessments & project files' },
                  { key: 'canApproveGradeChanges', label: 'Post-Submission Mark Rectifications', sub: 'Scrutinize and authorize official gradebook score corrections submitted by teachers' },
                ].map(({ key, label, sub }) => (
                  <label
                    key={key}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '8px 10px',
                      borderRadius: 6,
                      background: (hodPermissions as any)[key] ? '#FFFFFF' : 'transparent',
                      border: (hodPermissions as any)[key] ? '1px solid #D6D4CC' : '1px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!!(hodPermissions as any)[key]}
                      onChange={(e) => setHodPermissions({ ...hodPermissions, [key]: e.target.checked })}
                      style={{ marginTop: 2, accentColor: '#1D4ED8' }}
                    />
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>{label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>{sub}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Quadrant 3: Department Communication & Academic Directives */}
            <div style={{ background: '#FAF9F6', borderRadius: 8, border: '1px solid var(--border-color)', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ECEAE5', paddingBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#7C5CBF', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Users size={14} /> Communication &amp; Directives
                </span>
                <span style={{ fontSize: 11, color: '#7C5CBF', fontWeight: 700, background: '#F3EFFA', padding: '2px 8px', borderRadius: 10 }}>
                  {[
                    hodPermissions.canBroadcastDepartment,
                    hodPermissions.canIssueFacultyDirectives,
                    hodPermissions.canPinStudyNotices,
                    hodPermissions.canApproveClearances,
                    hodPermissions.canCoordinateSubjectEvents,
                  ].filter(Boolean).length} / 5
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { key: 'canBroadcastDepartment', label: 'Departmental Announcements & Bulletins', sub: 'Broadcast subject directives, study advisories & alerts to students & department teachers' },
                  { key: 'canIssueFacultyDirectives', label: 'Departmental Faculty Directives', sub: 'Issue formal departmental notices, meeting agendas & compliance circulars to faculty' },
                  { key: 'canPinStudyNotices', label: 'Study Advisories & Exam Revision Notices', sub: 'Publish pinned revision tips, syllabus guidelines & reference materials on student streams' },
                  { key: 'canApproveClearances', label: 'Academic Subject Clearances', sub: 'Sign off on student subject clearances, lab sign-offs & year-end academic checkouts' },
                  { key: 'canCoordinateSubjectEvents', label: 'Subject Olympiads & Academic Competitions', sub: 'Organize subject olympiads, science exhibitions, language clubs & academic symposiums' },
                ].map(({ key, label, sub }) => (
                  <label
                    key={key}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '8px 10px',
                      borderRadius: 6,
                      background: (hodPermissions as any)[key] ? '#FFFFFF' : 'transparent',
                      border: (hodPermissions as any)[key] ? '1px solid #D6D4CC' : '1px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!!(hodPermissions as any)[key]}
                      onChange={(e) => setHodPermissions({ ...hodPermissions, [key]: e.target.checked })}
                      style={{ marginTop: 2, accentColor: '#7C5CBF' }}
                    />
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>{label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>{sub}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Quadrant 4: Departmental Intelligence & Quality Audits */}
            <div style={{ background: '#FAF9F6', borderRadius: 8, border: '1px solid var(--border-color)', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ECEAE5', paddingBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#D97706', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <BarChart3 size={14} /> Intelligence &amp; Quality Audits
                </span>
                <span style={{ fontSize: 11, color: '#D97706', fontWeight: 700, background: '#FEF3C7', padding: '2px 8px', borderRadius: 10 }}>
                  {[
                    hodPermissions.canViewAnalytics,
                    hodPermissions.canAuditTeacherMarkingPace,
                    hodPermissions.canGenerateSubjectReports,
                    hodPermissions.canAuthorizeExemptions,
                    hodPermissions.canConductTeacherObservations,
                  ].filter(Boolean).length} / 5
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { key: 'canViewAnalytics', label: 'Department Intelligence & Score Curves', sub: 'Access subject pass rates, grade distribution graphs & comparative performance curves' },
                  { key: 'canAuditTeacherMarkingPace', label: 'Teacher Marking Velocity & Compliance', sub: 'Audit teacher marking turnaround speed, log submission timeliness & gradebook compliance' },
                  { key: 'canGenerateSubjectReports', label: 'Board & Subject Dossier Reports', sub: 'Export department-wide performance dossiers, section comparisons & CSV reports' },
                  { key: 'canAuthorizeExemptions', label: 'Subject Accommodations & Special Exemptions', sub: 'Authorize curriculum accommodations, second language exemptions & special assessment conditions' },
                  { key: 'canConductTeacherObservations', label: 'Classroom Observations & Walkthroughs', sub: 'Conduct peer teaching walkthroughs, feedback rubrics & instructional coaching logs' },
                ].map(({ key, label, sub }) => (
                  <label
                    key={key}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '8px 10px',
                      borderRadius: 6,
                      background: (hodPermissions as any)[key] ? '#FFFFFF' : 'transparent',
                      border: (hodPermissions as any)[key] ? '1px solid #D6D4CC' : '1px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!!(hodPermissions as any)[key]}
                      onChange={(e) => setHodPermissions({ ...hodPermissions, [key]: e.target.checked })}
                      style={{ marginTop: 2, accentColor: '#D97706' }}
                    />
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>{label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>{sub}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── 4. STICKY BOTTOM ACTION FOOTER ── */}
        <div
          style={{
            position: 'sticky',
            bottom: 0,
            zIndex: 10,
            background: '#FFFFFF',
            border: '1px solid var(--border-color)',
            borderRadius: 10,
            padding: '14px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            boxShadow: '0 -4px 16px rgba(0,0,0,0.06)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: currentDeptDef.bg,
                border: `1.5px solid ${currentDeptDef.border}`,
                color: currentDeptDef.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 12,
              }}
            >
              {getDepartmentIcon(currentDeptDef.iconName, 16)}
            </div>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                {hodTitle || `Head of ${selectedHodDept}`} • {selectedHodDept} • {hodScopeType === 'all' ? 'Whole Department (Grades 9-12)' : `Grades: ${hodManagedGrades.join(', ')} (${hodSectionScopeType === 'all' ? 'All Sections' : `${hodManagedSections.length} Sections`})`}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                {totalHodPowersCount} of 20 departmental authorities authorized
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={handleCloseHodEditor}
              style={{
                padding: '9px 18px',
                borderRadius: 6,
                border: '1px solid var(--border-color)',
                background: '#FFFFFF',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                color: 'var(--neutral-dark)',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveHodAssignment}
              disabled={isSaving}
              style={{
                padding: '9px 26px',
                borderRadius: 6,
                border: 'none',
                background: '#1A1A1A',
                color: '#FFFFFF',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: isSaving ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
              }}
            >
              <ShieldCheck size={16} />
              <span>{isSaving ? 'Saving Delegated Authority...' : editingHodId ? 'Save Changes' : 'Confirm HOD Appointment'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

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

      {/* ── 1. PRINCIPAL EXECUTIVE ACCOUNT ── */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid var(--border-color)',
          borderRadius: 8,
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              background: '#1A1A1A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              flexShrink: 0,
            }}
          >
            <Crown size={20} />
          </div>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--neutral-dark)', fontFamily: 'var(--font-display)' }}>
              {principalProfile.name || 'Principal'}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
              {principalProfile.email} • {principalProfile.designation || 'Principal & Executive Head of School'}
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. SYSTEM ADMINISTRATORS (DELEGATED BY PRINCIPAL) ── */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid var(--border-color)',
          borderRadius: 8,
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--neutral-dark)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              SYSTEM ADMINISTRATORS (IT &amp; ADMINISTRATION)
            </span>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
              Administrative powers delegated and governed by the Executive Head of School (Principal).
            </div>
          </div>

          {isCurrentLoggedInUserPrincipal && (
            <button
              onClick={handleOpenAdminModal}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                background: '#1A1A1A',
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
              <Plus size={13} /> Appoint Administrator
            </button>
          )}
        </div>

        {adminProfiles.length === 0 ? (
          <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>
            No secondary system administrators assigned.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
            {adminProfiles.map((adm) => (
              <div
                key={adm.id}
                style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: 8,
                  padding: '14px 16px',
                  background: '#FAF9F6',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                    {adm.name || 'System Admin'}
                  </div>
                  {isCurrentLoggedInUserPrincipal && (
                    <button
                      type="button"
                      onClick={() => handleRevokeAdminRole(adm.id)}
                      title="Revoke Admin Role"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#A8A29E',
                        padding: '4px',
                        borderRadius: 4,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#DC2626';
                        e.currentTarget.style.background = '#FEE2E2';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = '#A8A29E';
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>

                <div
                  style={{
                    marginTop: 6,
                    padding: '6px 10px',
                    background: '#FFFFFF',
                    border: '1px dashed #D5D3CC',
                    borderRadius: 6,
                  }}
                >
                  <div style={{ fontSize: 11.5, color: '#2C6E6A', fontWeight: 600 }}>
                    {adm.designation || 'System Administrator'}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginTop: 1 }}>
                    {adm.email}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 3. SENIOR LEADERSHIP TEAM (SLT) ── */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid var(--border-color)',
          borderRadius: 8,
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--neutral-dark)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            SENIOR LEADERSHIP TEAM (SLT)
          </span>

          <button
            onClick={() => handleOpenSltModal()}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              background: '#1A1A1A',
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
            <Plus size={13} /> Appoint SLT Member
          </button>
        </div>

        {sltAssignments.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>
            No Senior Leadership Team members appointed yet.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {sltAssignments.map((slt) => {
              const activePowersCount = Object.values(slt.permissions || {}).filter(Boolean).length;
              const isWholeSchool =
                !slt.scopeType ||
                slt.scopeType === 'all' ||
                (!slt.managedGrades || slt.managedGrades.length === 4) &&
                  (!slt.managedSections || slt.managedSections.length === 0);

              return (
                <div
                  key={slt.id}
                  style={{
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    padding: '14px 16px',
                    background: '#FAF9F6',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    transition: 'background 0.12s, border-color 0.12s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                        {slt.userName}
                      </div>
                      <div style={{ fontSize: 11, color: '#2C6E6A', fontWeight: 600, marginTop: 1 }}>
                        {slt.title || 'Senior Leadership'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button
                        type="button"
                        onClick={() => handleOpenSltModal(slt)}
                        title="Configure Jurisdiction & Delegated Powers"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#78716C',
                          padding: '4px',
                          borderRadius: 4,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#1A1A1A';
                          e.currentTarget.style.background = '#EBEAE5';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = '#78716C';
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveAssignment(slt.id, 'slt')}
                        title="Revoke Role"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#A8A29E',
                          padding: '4px',
                          borderRadius: 4,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#DC2626';
                          e.currentTarget.style.background = '#FEE2E2';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = '#A8A29E';
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '8px 10px',
                      background: '#FFFFFF',
                      border: '1px solid #E7E5E4',
                      borderRadius: 6,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <div style={{ fontSize: 10.5, color: 'var(--text-secondary)' }}>
                      {slt.userEmail}
                    </div>

                    {/* Scope Badge */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        fontSize: 10.5,
                        color: isWholeSchool ? '#1D4ED8' : '#2C6E6A',
                        background: isWholeSchool ? '#EFF6FF' : '#EAF3EF',
                        padding: '4px 7px',
                        borderRadius: 4,
                        fontWeight: 600,
                        lineHeight: 1.3,
                      }}
                    >
                      <Building size={11} style={{ flexShrink: 0 }} />
                      <span>
                        {isWholeSchool
                          ? 'Whole School (Grades 9-12 • All Sections)'
                          : `Grades ${slt.managedGrades?.join(', ') || 'None'}${
                              slt.managedSections && slt.managedSections.length > 0
                                ? ` • Sections: ${slt.managedSections.join(', ')}`
                                : ' • All Sections'
                            }`}
                      </span>
                    </div>

                    {/* Active Powers Badge */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: 10,
                        color: 'var(--text-secondary)',
                        borderTop: '1px dashed #E7E5E4',
                        paddingTop: 5,
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <ShieldCheck size={11} style={{ color: '#2C6E6A' }} />
                        <strong style={{ color: 'var(--neutral-dark)' }}>{activePowersCount} / 20</strong> Powers Active
                      </span>
                      <span style={{ fontSize: 9.5, color: '#78716C', fontStyle: 'italic' }}>
                        Governed by Principal
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 4. DEPARTMENT HEADS (HODs) ── */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid var(--border-color)',
          borderRadius: 8,
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--neutral-dark)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            DEPARTMENT HEADS (HODS)
          </span>

          <button
            onClick={() => handleOpenHodModal()}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              background: '#1A1A1A',
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
            <Plus size={13} /> Appoint HOD
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {ACADEMIC_DEPARTMENTS.map((dept) => {
            const assignment = hodAssignments.find((a) => a.department === dept.name);
            const isAssigned = !!assignment;
            const activePowersCount = isAssigned ? countHodActivePowers(assignment.permissions) : 0;
            const isWholeDept =
              !assignment?.managedGrades ||
              assignment.managedGrades.length === 4 ||
              assignment.scopeType === 'all';

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
                  gap: 8,
                  transition: 'background 0.12s, border-color 0.12s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                      {isAssigned ? assignment.userName : dept.name}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: isAssigned ? '#2C6E6A' : '#A8A29E',
                        fontWeight: 600,
                        marginTop: 1,
                      }}
                    >
                      {isAssigned ? (assignment.title || `Head of ${dept.name}`) : 'Vacant Department Leadership'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {isAssigned ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleOpenHodModal(dept.name, assignment.id)}
                          title="Configure Jurisdiction & Delegated Powers"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#78716C',
                            padding: '4px',
                            borderRadius: 4,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = '#1A1A1A';
                            e.currentTarget.style.background = '#EBEAE5';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = '#78716C';
                            e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveAssignment(assignment.id, 'hod')}
                          title="Revoke Role"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#A8A29E',
                            padding: '4px',
                            borderRadius: 4,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = '#DC2626';
                            e.currentTarget.style.background = '#FEE2E2';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = '#A8A29E';
                            e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenHodModal(dept.name)}
                        title={`Appoint Head of ${dept.name}`}
                        style={{
                          padding: '4px 9px',
                          borderRadius: 6,
                          background: '#1A1A1A',
                          color: '#FFFFFF',
                          border: 'none',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <Plus size={11} /> Appoint
                      </button>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    padding: '8px 10px',
                    background: '#FFFFFF',
                    border: isAssigned ? '1px solid #E7E5E4' : '1px dashed #E7E5E4',
                    borderRadius: 6,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div
                      style={{
                        fontSize: 10.5,
                        color: isAssigned ? 'var(--text-secondary)' : '#A8A29E',
                        fontStyle: isAssigned ? 'normal' : 'italic',
                      }}
                    >
                      {isAssigned ? assignment.userEmail : 'No faculty leadership appointed yet'}
                    </div>
                    {!isAssigned && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          background: '#F5F4F0',
                          color: '#78716C',
                          border: '1px solid #E7E5E4',
                          padding: '1px 6px',
                          borderRadius: 4,
                          letterSpacing: '0.04em',
                        }}
                      >
                        {dept.code}
                      </span>
                    )}
                  </div>

                  {/* Scope Badge */}
                  {isAssigned && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        fontSize: 10.5,
                        color: isWholeDept ? '#1D4ED8' : '#2C6E6A',
                        background: isWholeDept ? '#EFF6FF' : '#EAF3EF',
                        padding: '4px 7px',
                        borderRadius: 4,
                        fontWeight: 600,
                        lineHeight: 1.3,
                      }}
                    >
                      <Building size={11} style={{ flexShrink: 0 }} />
                      <span>
                        {isWholeDept
                          ? 'Whole Department (Grades 9-12 • All Sections)'
                          : `Grades ${assignment.managedGrades?.join(', ') || 'None'}${
                              assignment.managedSections && assignment.managedSections.length > 0
                                ? ` • Sections: ${assignment.managedSections.join(', ')}`
                                : ' • All Sections'
                            }`}
                      </span>
                    </div>
                  )}

                  {/* Active Powers Badge */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 10,
                      color: 'var(--text-secondary)',
                      borderTop: '1px dashed #E7E5E4',
                      paddingTop: 5,
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <ShieldCheck size={11} style={{ color: isAssigned ? '#2C6E6A' : '#A8A29E' }} />
                      {isAssigned ? (
                        <>
                          <strong style={{ color: 'var(--neutral-dark)' }}>{activePowersCount} / 20</strong> Powers Active
                        </>
                      ) : (
                        <span style={{ color: '#A8A29E' }}>0 / 20 Powers Active</span>
                      )}
                    </span>
                    <span style={{ fontSize: 9.5, color: isAssigned ? '#78716C' : '#A8A29E', fontStyle: 'italic' }}>
                      Governed by Principal &amp; SLT
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {hodAssignments
            .filter((a) => !ACADEMIC_DEPARTMENTS.some((d) => d.name === a.department))
            .map((extraHod) => {
              const activePowersCount = countHodActivePowers(extraHod.permissions);
              const isWholeDept =
                !extraHod.managedGrades ||
                extraHod.managedGrades.length === 4 ||
                extraHod.scopeType === 'all';

              return (
                <div
                  key={extraHod.id}
                  style={{
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    padding: '14px 16px',
                    background: '#FAF9F6',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    transition: 'background 0.12s, border-color 0.12s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                        {extraHod.userName}
                      </div>
                      <div style={{ fontSize: 11, color: '#2C6E6A', fontWeight: 600, marginTop: 1 }}>
                        {extraHod.title || `Head of ${extraHod.department || 'Department'}`}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button
                        type="button"
                        onClick={() => handleOpenHodModal(extraHod.department, extraHod.id)}
                        title="Configure Jurisdiction & Delegated Powers"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#78716C',
                          padding: '4px',
                          borderRadius: 4,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#1A1A1A';
                          e.currentTarget.style.background = '#EBEAE5';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = '#78716C';
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveAssignment(extraHod.id, 'hod')}
                        title="Revoke Role"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#A8A29E',
                          padding: '4px',
                          borderRadius: 4,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#DC2626';
                          e.currentTarget.style.background = '#FEE2E2';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = '#A8A29E';
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '8px 10px',
                      background: '#FFFFFF',
                      border: '1px solid #E7E5E4',
                      borderRadius: 6,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <div style={{ fontSize: 10.5, color: 'var(--text-secondary)' }}>
                      {extraHod.userEmail}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        fontSize: 10.5,
                        color: isWholeDept ? '#1D4ED8' : '#2C6E6A',
                        background: isWholeDept ? '#EFF6FF' : '#EAF3EF',
                        padding: '4px 7px',
                        borderRadius: 4,
                        fontWeight: 600,
                        lineHeight: 1.3,
                      }}
                    >
                      <Building size={11} style={{ flexShrink: 0 }} />
                      <span>
                        {isWholeDept
                          ? 'Whole Department (Grades 9-12 • All Sections)'
                          : `Grades ${extraHod.managedGrades?.join(', ') || 'None'}${
                              extraHod.managedSections && extraHod.managedSections.length > 0
                                ? ` • Sections: ${extraHod.managedSections.join(', ')}`
                                : ' • All Sections'
                            }`}
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: 10,
                        color: 'var(--text-secondary)',
                        borderTop: '1px dashed #E7E5E4',
                        paddingTop: 5,
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <ShieldCheck size={11} style={{ color: '#2C6E6A' }} />
                        <strong style={{ color: 'var(--neutral-dark)' }}>{activePowersCount} / 20</strong> Powers Active
                      </span>
                      <span style={{ fontSize: 9.5, color: '#78716C', fontStyle: 'italic' }}>
                        Governed by Principal &amp; SLT
                      </span>
                    </div>
                  </div>
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
      {/* ── APPOINT SYSTEM ADMINISTRATOR MODAL ── */}
      {isAdminModalOpen && (
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
                  Appoint System Administrator
                </h3>
                <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                  Delegate operational and IT administration authority under Principal governance.
                </p>
              </div>
              <button
                onClick={() => setIsAdminModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setAdminMode('existing')}
                style={{
                  flex: 1,
                  padding: '7px',
                  borderRadius: 6,
                  border: adminMode === 'existing' ? '1px solid #1A1A1A' : '1px solid var(--border-color)',
                  background: adminMode === 'existing' ? '#1A1A1A' : '#FAF9F6',
                  color: adminMode === 'existing' ? '#FFFFFF' : 'var(--neutral-dark)',
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Promote Existing Staff
              </button>
              <button
                type="button"
                onClick={() => setAdminMode('new')}
                style={{
                  flex: 1,
                  padding: '7px',
                  borderRadius: 6,
                  border: adminMode === 'new' ? '1px solid #1A1A1A' : '1px solid var(--border-color)',
                  background: adminMode === 'new' ? '#1A1A1A' : '#FAF9F6',
                  color: adminMode === 'new' ? '#FFFFFF' : 'var(--neutral-dark)',
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Create Dedicated Admin
              </button>
            </div>

            {adminMode === 'existing' ? (
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                  Select Staff Member
                </label>
                <CustomSelect
                  value={selectedAdminUserId}
                  onChange={(val) => setSelectedAdminUserId(val)}
                  placeholder="-- Choose Staff Member --"
                  searchable={true}
                  options={[
                    { value: '', label: '-- Choose Staff Member --' },
                    ...teachers.map((t) => ({
                      value: t.id,
                      label: `${t.name} (${t.email})`,
                    })),
                  ]}
                />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label className="form-label" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Admin Full Name</label>
                  <input
                    type="text"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="e.g. IT Administrator"
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 12 }}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Admin Email Address</label>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="e.g. admin2@woodlempark.ae"
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 12 }}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Initial Password</label>
                  <input
                    type="text"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 12 }}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="form-label" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Designation Title</label>
              <input
                type="text"
                value={adminTitle}
                onChange={(e) => setAdminTitle(e.target.value)}
                placeholder="e.g. System Administrator"
                style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 12 }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <button
                type="button"
                onClick={() => setIsAdminModalOpen(false)}
                style={{
                  padding: '7px 14px',
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
                onClick={handleSaveAdminAssignment}
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
                {isSaving ? 'Saving...' : 'Grant Admin Access'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
