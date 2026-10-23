import { ParentDocument, UserProfile } from './supabaseClient';

export interface DocumentTypeDefinition {
  type: string;
  category: 'student' | 'parent' | 'academic';
  label: string;
  iconKey: string;
  desc: string;
  requiresExpiry: boolean;
  requiredForClearance: boolean;
  docNumberLabel?: string;
  docNumberPlaceholder?: string;
}

export const ONBOARDING_DOC_DEFINITIONS: DocumentTypeDefinition[] = [
  {
    type: "Student Emirates ID",
    category: 'student',
    label: "Student's Emirates ID",
    iconKey: 'id_card',
    desc: 'Front and back copy of the student Emirates Identity Card.',
    requiresExpiry: true,
    requiredForClearance: true,
    docNumberLabel: 'Student Emirates ID Number',
    docNumberPlaceholder: '784-YYYY-XXXXXXX-X',
  },
  {
    type: "Student Passport",
    category: 'student',
    label: "Student's Passport",
    iconKey: 'admission',
    desc: 'Clear copy of student passport biographical data & residency visa page.',
    requiresExpiry: true,
    requiredForClearance: true,
    docNumberLabel: 'Student Passport Number',
    docNumberPlaceholder: 'e.g. N1234567',
  },
  {
    type: "Student Birth Certificate",
    category: 'student',
    label: "Student's Birth Certificate",
    iconKey: 'emergency',
    desc: 'Attested official birth certificate for age and lineage verification.',
    requiresExpiry: false,
    requiredForClearance: true,
  },
  {
    type: "Transfer Certificate",
    category: 'academic',
    label: "Transfer Certificate (TC)",
    iconKey: 'consent',
    desc: 'Attested Transfer Certificate (TC) or School Leaving Record from previous institution.',
    requiresExpiry: false,
    requiredForClearance: true,
  },
  {
    type: "Parent Emirates ID",
    category: 'parent',
    label: "Parent's Emirates ID",
    iconKey: 'id_card',
    desc: "Copy of parent / primary guardian's Emirates Identity Card.",
    requiresExpiry: true,
    requiredForClearance: true,
    docNumberLabel: 'Parent Emirates ID Number',
    docNumberPlaceholder: '784-YYYY-XXXXXXX-X',
  },
  {
    type: "Parent Passport",
    category: 'parent',
    label: "Parent's Passport",
    iconKey: 'admission',
    desc: "Clear copy of parent / primary guardian's passport & visa page.",
    requiresExpiry: true,
    requiredForClearance: true,
    docNumberLabel: 'Parent Passport Number',
    docNumberPlaceholder: 'e.g. P9876543',
  },
  {
    type: "Student Mark List",
    category: 'academic',
    label: "Student's Mark List / Previous Grade Report Card",
    iconKey: 'medical',
    desc: 'Official previous academic year mark list / progress transcript (Optional).',
    requiresExpiry: false,
    requiredForClearance: false,
  },
  {
    type: "CAT4 Exam Results",
    category: 'academic',
    label: "CAT4 Cognitive Abilities Test Results",
    iconKey: 'permission',
    desc: 'Cognitive Abilities Test (CAT4) individual report / assessment scores (Optional).',
    requiresExpiry: false,
    requiredForClearance: false,
    docNumberLabel: 'CAT4 Mean SAS Score',
    docNumberPlaceholder: 'e.g. 115',
  },
];

export interface ExpiryStatus {
  status: 'valid' | 'expiring_soon' | 'expired' | 'no_expiry' | 'missing';
  daysRemaining?: number;
  label: string;
  badgeBg: string;
  badgeColor: string;
  badgeBorder: string;
  isUrgent: boolean;
}

/**
 * Calculates document expiration status based on expiry date string (YYYY-MM-DD)
 * Within 30 days is flagged as "expiring_soon", past dates are "expired".
 */
export function getDocumentExpiryStatus(expiryDate?: string, isSubmitted: boolean = true): ExpiryStatus {
  if (!isSubmitted) {
    return {
      status: 'missing',
      label: 'Pending Upload',
      badgeBg: '#F3F4F6',
      badgeColor: '#4B5563',
      badgeBorder: '#E5E7EB',
      isUrgent: false,
    };
  }

  if (!expiryDate || !expiryDate.trim()) {
    return {
      status: 'no_expiry',
      label: 'Verified (No Expiry)',
      badgeBg: '#F0FDF4',
      badgeColor: '#166534',
      badgeBorder: '#BBF7D0',
      isUrgent: false,
    };
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const expDate = new Date(expiryDate);
  if (isNaN(expDate.getTime())) {
    return {
      status: 'no_expiry',
      label: 'Submitted',
      badgeBg: '#F0FDF4',
      badgeColor: '#166534',
      badgeBorder: '#BBF7D0',
      isUrgent: false,
    };
  }

  expDate.setHours(0, 0, 0, 0);
  const diffMs = expDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const absDays = Math.abs(diffDays);
    return {
      status: 'expired',
      daysRemaining: diffDays,
      label: `Expired ${absDays === 0 ? 'Today' : `${absDays}d ago`} (${formatShortDate(expiryDate)})`,
      badgeBg: '#FEF2F2',
      badgeColor: '#991B1B',
      badgeBorder: '#FECACA',
      isUrgent: true,
    };
  }

  if (diffDays <= 30) {
    return {
      status: 'expiring_soon',
      daysRemaining: diffDays,
      label: diffDays === 0 ? 'Expires Today!' : `Expires in ${diffDays} day${diffDays === 1 ? '' : 's'} (${formatShortDate(expiryDate)})`,
      badgeBg: '#FFF7ED',
      badgeColor: '#C2410C',
      badgeBorder: '#FED7AA',
      isUrgent: true,
    };
  }

  return {
    status: 'valid',
    daysRemaining: diffDays,
    label: `Valid until ${formatShortDate(expiryDate)}`,
    badgeBg: '#F0FDF4',
    badgeColor: '#166534',
    badgeBorder: '#BBF7D0',
    isUrgent: false,
  };
}

export function formatShortDate(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return isoDate;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return isoDate;
  }
}

/**
 * Checks all documents for a specific student and returns any that are expired or expiring within 30 days
 */
export function getExpiringDocsForStudent(
  studentId: string,
  documents: ParentDocument[]
): Array<{ doc: ParentDocument; expiryStatus: ExpiryStatus; definition?: DocumentTypeDefinition }> {
  const studentDocs = documents.filter((d) => d.student_id === studentId);
  const results: Array<{ doc: ParentDocument; expiryStatus: ExpiryStatus; definition?: DocumentTypeDefinition }> = [];

  for (const doc of studentDocs) {
    if (doc.status !== 'submitted') continue;
    const def = ONBOARDING_DOC_DEFINITIONS.find((item) => item.type === doc.doc_type);
    const expiryDate = doc.expiry_date;
    if (expiryDate) {
      const status = getDocumentExpiryStatus(expiryDate, true);
      if (status.status === 'expiring_soon' || status.status === 'expired') {
        results.push({ doc, expiryStatus: status, definition: def });
      }
    }
  }

  return results;
}

/**
 * Scans all student documents in the school to find those with expiring documents
 */
export function getSchoolWideExpiringDocs(
  students: UserProfile[],
  documents: ParentDocument[]
): Array<{
  student: UserProfile;
  doc: ParentDocument;
  expiryStatus: ExpiryStatus;
  definition?: DocumentTypeDefinition;
}> {
  const list: Array<{
    student: UserProfile;
    doc: ParentDocument;
    expiryStatus: ExpiryStatus;
    definition?: DocumentTypeDefinition;
  }> = [];

  const studentMap = new Map<string, UserProfile>();
  students.forEach((s) => studentMap.set(s.id, s));

  for (const doc of documents) {
    if (doc.status !== 'submitted' || !doc.expiry_date) continue;
    const student = studentMap.get(doc.student_id);
    if (!student) continue;

    const expiryStatus = getDocumentExpiryStatus(doc.expiry_date, true);
    if (expiryStatus.status === 'expiring_soon' || expiryStatus.status === 'expired') {
      const definition = ONBOARDING_DOC_DEFINITIONS.find((def) => def.type === doc.doc_type);
      list.push({ student, doc, expiryStatus, definition });
    }
  }

  return list;
}
