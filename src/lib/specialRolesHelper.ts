import { supabase, UserProfile, SpecialRoleAssignment, SpecialRoleType } from './supabaseClient';

export interface DepartmentDef {
  id: string;
  name: string;
  code: string;
  subjects: string[];
  color: string;
  bg: string;
  border: string;
  iconName: string;
  defaultDescription: string;
}

export const ACADEMIC_DEPARTMENTS: DepartmentDef[] = [
  {
    id: 'dept_science',
    name: 'Department of Science',
    code: 'SCI',
    subjects: ['Physics', 'Chemistry', 'Biology'],
    color: '#2C6E6A',
    bg: '#EAF3EF',
    border: '#C7E4D8',
    iconName: 'Atom',
    defaultDescription: 'Physics, Chemistry, and Biology laboratories and curriculum standards.',
  },
  {
    id: 'dept_math',
    name: 'Department of Mathematics',
    code: 'MATH',
    subjects: ['Math', 'Mathematics', 'Applied Math'],
    color: '#7C5CBF',
    bg: '#F3EFFA',
    border: '#DACDF2',
    iconName: 'Calculator',
    defaultDescription: 'Core Mathematics, Advanced Calculus, and Applied Statistics programs.',
  },
  {
    id: 'dept_languages',
    name: 'Department of English & Languages',
    code: 'LANG',
    subjects: ['English', 'Arabic', 'French', 'Hindi', 'Islamic Studies'],
    color: '#B37D4A',
    bg: '#FBF6F0',
    border: '#ECD8C3',
    iconName: 'BookOpen',
    defaultDescription: 'English Literature, Second Languages, and Linguistics.',
  },
  {
    id: 'dept_social_sci',
    name: 'Department of Social Sciences & Humanities',
    code: 'SOC',
    subjects: ['History', 'Geography', 'Economics', 'Political Science', 'Sociology'],
    color: '#2B5B75',
    bg: '#EBF3F7',
    border: '#C8DCE5',
    iconName: 'Globe',
    defaultDescription: 'History, Geography, Economics, and Global Studies.',
  },
  {
    id: 'dept_cs_it',
    name: 'Department of Computer Science & IT',
    code: 'TECH',
    subjects: ['Computer Science', 'Informatics Practices', 'Artificial Intelligence'],
    color: '#0D9488',
    bg: '#CCFBF1',
    border: '#99F6E4',
    iconName: 'Cpu',
    defaultDescription: 'Coding, Data Science, AI, and digital literacy frameworks.',
  },
  {
    id: 'dept_commerce',
    name: 'Department of Commerce & Business',
    code: 'COMM',
    subjects: ['Accountancy', 'Business Studies', 'Entrepreneurship'],
    color: '#D97706',
    bg: '#FEF3C7',
    border: '#FDE68A',
    iconName: 'TrendingUp',
    defaultDescription: 'Financial Accounting, Corporate Strategy, and Commerce studies.',
  },
  {
    id: 'dept_arts_pe',
    name: 'Department of Arts, PE & Holistic Education',
    code: 'ARTS',
    subjects: ['Art & Design', 'Physical Education', 'Music', 'Drama'],
    color: '#E11D48',
    bg: '#FFE4E6',
    border: '#FECDD3',
    iconName: 'Palette',
    defaultDescription: 'Visual Arts, Physical Fitness, Sports leagues, and Performing Arts.',
  },
];

export interface GradeStageDef {
  id: string;
  name: string;
  grades: string[];
  color: string;
  bg: string;
  border: string;
  description: string;
}

export const GRADE_STAGES: GradeStageDef[] = [
  {
    id: 'stage_middle',
    name: 'Secondary Stage (Grades 9 - 10)',
    grades: ['9', '10'],
    color: '#2C6E6A',
    bg: '#EAF3EF',
    border: '#C7E4D8',
    description: 'Foundational CBSE curriculum, board exam preparation, and holistic development.',
  },
  {
    id: 'stage_senior',
    name: 'Senior Secondary Stage (Grades 11 - 12)',
    grades: ['11', '12'],
    color: '#7C5CBF',
    bg: '#F3EFFA',
    border: '#DACDF2',
    description: 'Stream specialization (Science, Commerce, Humanities) & career pathways.',
  },
  {
    id: 'stage_whole_school',
    name: 'Whole-School Academic Dean',
    grades: ['9', '10', '11', '12'],
    color: '#D97706',
    bg: '#FEF3C7',
    border: '#FDE68A',
    description: 'Institution-wide curriculum coordination, quality assurance, and academic standards.',
  },
];

const LOCAL_STORAGE_SPECIAL_ROLES_KEY = 'woodlem_special_role_assignments_v1';

// Check if user is the Principal
export function isPrincipalUser(user: UserProfile | null | undefined): boolean {
  if (!user) return false;
  if (user.role === 'principal') return true;
  if (user.special_role === 'principal') return true;
  if (user.is_protected_executive === true) return true;
  
  const designation = (user.designation || '').toLowerCase().trim();
  if (designation.includes('principal') || designation.includes('head of school') || designation.includes('director of school')) {
    return true;
  }

  const email = (user.email || '').toLowerCase().trim();
  if (email.startsWith('principal@') || email === 'principal@woodlem.com' || email === 'principal@woodlempark.ae') {
    return true;
  }

  if (typeof window !== 'undefined') {
    try {
      const appointedEmail = localStorage.getItem('woodlem_appointed_principal_email')?.toLowerCase().trim();
      if (appointedEmail && email === appointedEmail) {
        return true;
      }
      const cachedRoles = localStorage.getItem(LOCAL_STORAGE_SPECIAL_ROLES_KEY);
      if (cachedRoles) {
        const parsed = JSON.parse(cachedRoles);
        if (Array.isArray(parsed)) {
          const prin = parsed.find((a: any) => a.roleType === 'principal');
          if (prin && (prin.userEmail?.toLowerCase() === email || prin.userId === user.id)) {
            return true;
          }
        }
      }
    } catch {
      // ignore
    }
  }

  const name = (user.name || '').toLowerCase().trim();
  if (name.includes('principal') && (user.role === 'admin' || user.role === 'teacher')) {
    return true;
  }

  return false;
}

// Check if user is an HOD (Head of Department)
export function isHodUser(user: UserProfile | null | undefined): boolean {
  if (!user) return false;
  if (isPrincipalUser(user)) return false; // Principal is above HOD
  if (user.special_role === 'hod') return true;
  
  const designation = (user.designation || '').toLowerCase().trim();
  return designation.includes('hod') || designation.includes('head of department') || designation.includes('department head');
}

// Check if user is a Section Coordinator
export function isCoordinatorUser(user: UserProfile | null | undefined): boolean {
  if (!user) return false;
  if (isPrincipalUser(user)) return false;
  if (user.special_role === 'coordinator' || user.special_role === 'dean') return true;
  
  const designation = (user.designation || '').toLowerCase().trim();
  return designation.includes('coordinator') || designation.includes('section head') || designation.includes('stage head') || designation.includes('academic dean');
}

// Return human-readable badge label for a user's executive/special role
export function getExecutiveRoleBadge(user: UserProfile | null | undefined): {
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  isProtected: boolean;
} | null {
  if (!user) return null;

  if (isPrincipalUser(user)) {
    return {
      label: 'Principal & Executive Head',
      badgeBg: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)',
      badgeText: '#92400E',
      badgeBorder: '#F59E0B',
      isProtected: true,
    };
  }

  if (isHodUser(user)) {
    const dept = user.department ? ` - ${user.department}` : '';
    return {
      label: `HOD${dept}`,
      badgeBg: '#F3EFFA',
      badgeText: '#6D28D9',
      badgeBorder: '#C4B5FD',
      isProtected: false,
    };
  }

  if (isCoordinatorUser(user)) {
    const gradeStr = user.managed_grades && user.managed_grades.length > 0
      ? ` (Grades ${user.managed_grades.join(', ')})`
      : '';
    return {
      label: `Stage Coordinator${gradeStr}`,
      badgeBg: '#EAF3EF',
      badgeText: '#047857',
      badgeBorder: '#A7F3D0',
      isProtected: false,
    };
  }

  if (user.role === 'admin') {
    return {
      label: 'System Admin',
      badgeBg: '#EFECE6',
      badgeText: '#2D2C2A',
      badgeBorder: '#DCD8CE',
      isProtected: false,
    };
  }

  return null;
}

// Default root Principal profile data
export const DEFAULT_PRINCIPAL_RECORD: UserProfile = {
  id: 'principal-1',
  email: 'principal@woodlempark.ae',
  name: 'Principal',
  role: 'principal',
  designation: 'Principal & Executive Head of School',
  special_role: 'principal',
  department: 'Executive Leadership',
  managed_grades: ['9', '10', '11', '12'],
  user_code: 'PRN-001',
  admission_number: 'PRN-001',
  is_protected_executive: true,
  special_permissions: [
    'all_admin_access',
    'all_marks_registers',
    'all_attendance_audits',
    'delegate_roles',
    'manage_hods',
    'manage_teachers',
    'school_wide_analytics',
    'approve_clearances',
    'system_diagnostics',
  ],
};

// Cloud Storage Key for Special Roles stored in Supabase achievements table
export const SPECIAL_ROLES_CLOUD_TITLE = '__SPECIAL_ACCESS_ROLES_V1__';

// Load stored special role assignments from cloud + local cache
export async function loadSpecialRoleAssignments(): Promise<SpecialRoleAssignment[]> {
  let list: SpecialRoleAssignment[] = [];

  // 1. Try local cache first for zero-latency load
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_SPECIAL_ROLES_KEY);
      if (cached) {
        list = JSON.parse(cached);
      }
    } catch {
      // ignore
    }
  }

  // 2. Fetch from Supabase cloud
  try {
    const { data, error } = await supabase
      .from('achievements')
      .select('*')
      .eq('title', SPECIAL_ROLES_CLOUD_TITLE)
      .limit(1);

    if (!error && data && data.length > 0) {
      const rawText = data[0].description || data[0].desc_text || '';
      if (rawText) {
        const parsed = JSON.parse(rawText);
        if (Array.isArray(parsed)) {
          list = parsed;
          if (typeof window !== 'undefined') {
            localStorage.setItem(LOCAL_STORAGE_SPECIAL_ROLES_KEY, JSON.stringify(list));
          }
        }
      }
    }
  } catch (err) {
    console.warn('Could not load special roles from cloud:', err);
  }

  // Ensure default Principal is always in assignments
  const hasPrincipal = list.some((a) => a.roleType === 'principal' || a.userEmail.toLowerCase() === 'principal@woodlempark.ae' || a.userEmail.toLowerCase() === 'principal@woodlem.com');
  if (!hasPrincipal) {
    list.unshift({
      id: 'assignment_principal_default',
      userId: 'principal-1',
      userEmail: 'principal@woodlempark.ae',
      userName: 'Principal',
      roleType: 'principal',
      title: 'Principal & Executive Head of School',
      department: 'Executive Leadership',
      managedGrades: ['9', '10', '11', '12'],
      permissions: {
        canAuditMarks: true,
        canVerifySyllabus: true,
        canBroadcastDepartment: true,
        canManageResources: true,
        canViewAnalytics: true,
        canApproveClearances: true,
      },
      assignedBy: 'System (Root)',
      assignedAt: new Date().toISOString(),
      isProtected: true,
    });
  }

  return list;
}

// Save special role assignments to cloud and local storage
export async function saveSpecialRoleAssignments(assignments: SpecialRoleAssignment[]): Promise<boolean> {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_STORAGE_SPECIAL_ROLES_KEY, JSON.stringify(assignments));
  }

  try {
    const payload = {
      id: 'special_roles_master_v1',
      student_id: 'system_admin',
      title: SPECIAL_ROLES_CLOUD_TITLE,
      description: JSON.stringify(assignments),
      desc_text: JSON.stringify(assignments),
      file_name: 'special_roles.json',
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('achievements')
      .upsert([payload], { onConflict: 'id' });

    if (error) {
      console.error('Error saving special role assignments to cloud:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error('Exception saving special role assignments:', e);
    return false;
  }
}
