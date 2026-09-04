import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { CustomSelect } from '@/components/UI/CustomSelect';
import { UserProfile } from '@/lib/supabaseClient';
import { sanitizeUserCode, normalizeAdmissionNumber, normalizeStudentName, isMatchingStudent } from '@/lib/userCodeHelper';

export interface BulkUserRow {
  name: string;
  email: string;
  role: 'student' | 'teacher' | 'parent' | 'admin';
  userCode: string;
  grade?: string;
  classLetter?: string;
  password?: string;
  linkedStudentCodes?: string[];
  isValid: boolean;
  isExistingUser?: boolean;
  isDuplicateInFile?: boolean;
  matchedExistingId?: string;
  statusText?: string;
  error?: string;
}

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBulkSubmit: (users: BulkUserRow[], onProgress?: (current: number, total: number) => void) => Promise<void>;
  profiles?: UserProfile[];
}

const PLACEHOLDER_SET = new Set([
  '',
  '-',
  '--',
  '---',
  'n/a',
  'na',
  'nil',
  'null',
  'none',
  'no',
  'pending',
  'not available',
  'not provided',
  'tbd',
  'undefined',
  '—',
]);

// Expanded aliases for matching headers
const ADMISSION_ALIASES = [
  'admissionnumber', 'admissionno', 'admission_number', 'admission_no', 'admission#',
  'admno', 'admnno', 'adm_no', 'admn_no', 'adm#', 'admn#', 'admission', 'admn', 'adm',
  'grno', 'gr_no', 'grnumber', 'gr#', 'gr', 'g.r.no', 'g.r.no.', 'g.r', 'generalregister',
  'generalregisterno', 'regno', 'reg_no', 'registrationno', 'registrationnumber', 'regnno',
  'regn_no', 'reg#', 'rollno', 'roll_no', 'scholarno', 'scholar_no', 'studentid', 'student_id',
  'studentno', 'student_no', 'studentidno', 'studentcode', 'student_code', 'wpapno', 'wpap_no',
  'wpapid', 'wpap', 'usercode', 'user_code', 'enrollmentno', 'enrollment_no', 'enrolmentno'
];

const SERIAL_NO_ALIASES = [
  'sno', 's_no', 'slno', 'sl_no', 'srno', 'sr_no', 'serialno', 'serialnumber', 'seqno', 'row#', '#'
];

const NAME_ALIASES = [
  'studentname', 'nameofthestudent', 'fullname', 'pupilname', 'nameofthepupil',
  'candidatename', 'nameofstudent', 'nameofthecandidate', 'teachername', 'staffname',
  'parentname', 'guardianname', 'firstname', 'student_name', 'candidate_name',
  'first_name', 'name', 'pupil', 'candidate'
];

const GRADE_ALIASES = [
  'grade', 'classgrade', 'year', 'standard', 'std', 'cohort', 'level', 'gradelevel',
  'gradeclass', 'class', 'classsection', 'classsec', 'classname', 'grade_section'
];

const SECTION_ALIASES = [
  'section', 'classletter', 'sec', 'division', 'div', 'class_letter', 'room', 'secname', 'sectionname'
];

const EMAIL_ALIASES = [
  'emailaddress', 'emailid', 'studentemail', 'studentemailid', 'officialemail',
  'officialemailid', 'gsuiteid', 'googleid', 'email_id', 'useremail', 'mailid',
  'email', 'mail', 'wpapemail', 'wpapmail', 'username', 'account'
];

const ROLE_ALIASES = [
  'role', 'userrole', 'accounttype', 'type', 'category', 'designation'
];

const LINKED_STUDENT_ALIASES = [
  'studentadmissionnumber', 'studentadmissionno', 'studentadm', 'childadmissionnumber',
  'childadmissionno', 'wardadmissionnumber', 'studentcode', 'linkedstudent',
  'linked_students', 'linkedchild'
];

const isAdmissionHdr = (cleanHdr: string) => {
  return (
    ADMISSION_ALIASES.some((a) => cleanHdr === a || cleanHdr.startsWith(a)) ||
    cleanHdr.includes('admission') ||
    cleanHdr.includes('admn') ||
    cleanHdr.includes('scholarno') ||
    cleanHdr.includes('grno') ||
    cleanHdr.includes('studentid') ||
    cleanHdr.includes('studentno') ||
    cleanHdr.includes('studentcode')
  );
};

const isNameHdr = (cleanHdr: string) => {
  if (isAdmissionHdr(cleanHdr)) return false;
  return (
    NAME_ALIASES.some((n) => cleanHdr === n || cleanHdr.startsWith(n)) ||
    cleanHdr.includes('name') ||
    cleanHdr.includes('pupil') ||
    cleanHdr.includes('candidate') ||
    cleanHdr === 'student'
  );
};

export const BulkImportModal: React.FC<BulkImportModalProps> = ({
  isOpen,
  onClose,
  onBulkSubmit,
  profiles = [],
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<BulkUserRow[]>([]);
  const [defaultRole, setDefaultRole] = useState<'student' | 'teacher' | 'parent' | 'admin'>('student');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    processExcelFile(selectedFile, defaultRole);
  };

  const cleanHeaderKey = (k: string): string => {
    return String(k || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  };

  const extractGradeNumber = (str: string): string => {
    if (!str) return '';
    const match = str.match(/\b(12|11|10|9|8|7|6|5|4|3|2|1)\b/) ||
                  str.match(/(?:grade|gr|g|year|std|standard|class|level)[\s.-]*(12|11|10|9|8|7|6|5|4|3|2|1)/i) ||
                  str.match(/(12|11|10|9|8|7|6|5|4|3|2|1)(?:th|st|nd|rd)?/i);
    return match ? match[1] : '';
  };

  const extractSectionLetter = (str: string): string => {
    if (!str) return '';
    const match = str.match(/(?:sec|section|div|division|class)?[\s.-]*\b([a-zA-Z])\b/i) ||
                  str.match(/[\(\[\-_\s]([a-zA-Z])[\)\]]?$/) ||
                  str.match(/\d+[\s.-]*([a-zA-Z])/);
    return match ? match[1].toUpperCase() : '';
  };

  const processExcelFile = (fileToParse: File, fallbackRole: 'student' | 'teacher' | 'parent' | 'admin') => {
    setErrorMessage('');
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const allRawRows: {
          rawAdm: string;
          rawName: string;
          rawGrade: string;
          rawSection: string;
          rawEmail: string;
          rawRole: string;
          rawLinked: string;
          sheetGrade?: string;
        }[] = [];

        workbook.SheetNames.forEach((sheetName) => {
          const ws = workbook.Sheets[sheetName];
          if (!ws) return;

          const sheetAoA: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          if (!sheetAoA || sheetAoA.length === 0) return;

          // Inferred grade from sheet name (e.g. "Grade 10", "Class 10 N", "10-N")
          const gradeInSheet = extractGradeNumber(sheetName);
          const secInSheet = extractSectionLetter(sheetName);

          // 1. Detect Header Row by multi-column scoring across top 15 rows
          let headerRowIdx = -1;
          let bestScore = 0;

          for (let rIdx = 0; rIdx < Math.min(sheetAoA.length, 15); rIdx++) {
            const rowVals = sheetAoA[rIdx].map((c) => cleanHeaderKey(c));
            const nonEmptyCount = rowVals.filter(Boolean).length;
            if (nonEmptyCount < 1) continue;

            let score = 0;
            let hasAdm = false;
            let hasName = false;
            let hasGrade = false;
            let hasEmail = false;

            rowVals.forEach((c) => {
              if (!c) return;
              if (isAdmissionHdr(c)) {
                score += 3;
                hasAdm = true;
              } else if (SERIAL_NO_ALIASES.some((s) => c === s)) {
                score += 1;
              }
              if (isNameHdr(c)) {
                score += 4;
                hasName = true;
              }
              if (GRADE_ALIASES.some((g) => c === g || c.includes('grade') || c.includes('class') || c.includes('section'))) {
                score += 2;
                hasGrade = true;
              }
              if (EMAIL_ALIASES.some((e) => c === e || c.includes('email') || c.includes('mail') || c.includes('gsuite'))) {
                score += 3;
                hasEmail = true;
              }
            });

            // If row has strong indicator of being a table header
            if ((hasName || hasAdm) && (score >= 4 || nonEmptyCount >= 2)) {
              if (score > bestScore) {
                bestScore = score;
                headerRowIdx = rIdx;
              }
            }
          }

          // 2. Identify column mappings
          let colAdmIdx = -1;
          let colSerialIdx = -1;
          let colNameIdx = -1;
          let colGradeIdx = -1;
          let colSecIdx = -1;
          let colEmailIdx = -1;
          let colRoleIdx = -1;
          let colLinkedIdx = -1;

          if (headerRowIdx >= 0) {
            const headerRow = sheetAoA[headerRowIdx];
            headerRow.forEach((hdrCell, colI) => {
              const cleanHdr = cleanHeaderKey(hdrCell);
              if (!cleanHdr) return;

              if (SERIAL_NO_ALIASES.some((s) => cleanHdr === s)) {
                colSerialIdx = colI;
              } else if (colAdmIdx === -1 && isAdmissionHdr(cleanHdr)) {
                colAdmIdx = colI;
              } else if (colNameIdx === -1 && isNameHdr(cleanHdr)) {
                colNameIdx = colI;
              } else if (colEmailIdx === -1 && EMAIL_ALIASES.some((e) => cleanHdr === e || cleanHdr.includes('email') || cleanHdr.includes('gsuite') || cleanHdr.includes('mail'))) {
                colEmailIdx = colI;
              } else if (colSecIdx === -1 && SECTION_ALIASES.some((s) => cleanHdr === s || cleanHdr.includes('section') || cleanHdr.includes('division'))) {
                colSecIdx = colI;
              } else if (colGradeIdx === -1 && GRADE_ALIASES.some((g) => cleanHdr === g || cleanHdr.includes('grade') || cleanHdr.includes('class'))) {
                colGradeIdx = colI;
              } else if (colRoleIdx === -1 && ROLE_ALIASES.some((r) => cleanHdr === r || cleanHdr.includes('role'))) {
                colRoleIdx = colI;
              } else if (colLinkedIdx === -1 && LINKED_STUDENT_ALIASES.some((l) => cleanHdr === l)) {
                colLinkedIdx = colI;
              }
            });
          }

          const startRow = headerRowIdx >= 0 ? headerRowIdx + 1 : 0;
          const dataRows = sheetAoA.slice(startRow).filter((r) => r && r.some((c: any) => String(c || '').trim() !== ''));

          // 3. Fallback: Column-content heuristics if key columns are missing
          if (colNameIdx === -1 || colAdmIdx === -1) {
            const maxCols = Math.max(...dataRows.map((r) => r.length), 0);
            for (let cI = 0; cI < maxCols; cI++) {
              if (cI === colSerialIdx) continue;

              const sampleCells = dataRows.slice(0, 20).map((r) => String(r[cI] || '').trim()).filter(Boolean);
              if (sampleCells.length === 0) continue;

              // Check if column contains 3-7 digit numbers
              const numericCount = sampleCells.filter((cell) => /^(wpap|wps|adm|gr)?\s*\d{3,7}$/i.test(cell)).length;
              const isSequential = sampleCells.length >= 3 && sampleCells.every((cell, idx) => Number(cell) === idx + 1);

              if (numericCount >= sampleCells.length * 0.6 && !isSequential && colAdmIdx === -1) {
                colAdmIdx = cI;
                continue;
              }

              // Check if column contains alphabetic human names
              const textNameCount = sampleCells.filter(
                (cell) =>
                  /[a-zA-Z]{2,}/.test(cell) &&
                  !cell.toLowerCase().startsWith('grade') &&
                  !cell.includes('@') &&
                  !/^[A-Z]$/i.test(cell)
              ).length;
              if (textNameCount >= sampleCells.length * 0.6 && colNameIdx === -1) {
                colNameIdx = cI;
                continue;
              }

              // Check if column contains emails
              const isEmails = sampleCells.every((cell) => cell.includes('@'));
              if (isEmails && colEmailIdx === -1) {
                colEmailIdx = cI;
                continue;
              }

              // Check if column contains grades
              const isGrades = sampleCells.every((cell) => extractGradeNumber(cell) !== '');
              if (isGrades && colGradeIdx === -1) {
                colGradeIdx = cI;
                continue;
              }

              // Check if column contains single section letters
              const isSections = sampleCells.every((cell) => /^[A-Za-z]$/.test(cell));
              if (isSections && colSecIdx === -1) {
                colSecIdx = cI;
                continue;
              }
            }
          }

          const isNumericString = (s: string) =>
            /^\d{2,8}$/.test(s.replace(/[^0-9]/g, '')) && !/[a-zA-Z]{2,}/.test(s);

          // 4. Extract rows for this sheet with strict type sanitization
          dataRows.forEach((row) => {
            let rawAdm = colAdmIdx >= 0 && row[colAdmIdx] !== undefined ? String(row[colAdmIdx]).trim() : '';
            let rawName = colNameIdx >= 0 && row[colNameIdx] !== undefined ? String(row[colNameIdx]).trim() : '';
            let rawGrade = colGradeIdx >= 0 && row[colGradeIdx] !== undefined ? String(row[colGradeIdx]).trim() : '';
            let rawSection = colSecIdx >= 0 && row[colSecIdx] !== undefined ? String(row[colSecIdx]).trim() : '';
            let rawEmail = colEmailIdx >= 0 && row[colEmailIdx] !== undefined ? String(row[colEmailIdx]).trim() : '';
            let rawRole = colRoleIdx >= 0 && row[colRoleIdx] !== undefined ? String(row[colRoleIdx]).trim() : '';
            let rawLinked = colLinkedIdx >= 0 && row[colLinkedIdx] !== undefined ? String(row[colLinkedIdx]).trim() : '';

            // STRICT SANITY CHECK 1: If rawName is numeric and rawAdm has letters, SWAP THEM!
            if (isNumericString(rawName) && /[a-zA-Z]{2,}/.test(rawAdm)) {
              const temp = rawName;
              rawName = rawAdm;
              rawAdm = temp;
            }

            // STRICT SANITY CHECK 2: If rawName is still numeric or empty, find the human name in other cells!
            if (!rawName || isNumericString(rawName)) {
              for (let i = 0; i < row.length; i++) {
                if (i === colAdmIdx || i === colSerialIdx || i === colEmailIdx) continue;
                const cell = String(row[i] || '').trim();
                if (
                  /[a-zA-Z]{2,}/.test(cell) &&
                  !cell.toLowerCase().startsWith('grade') &&
                  !/^[A-Z]$/i.test(cell) &&
                  !cell.includes('@')
                ) {
                  rawName = cell;
                  break;
                }
              }
            }

            // STRICT SANITY CHECK 3: If rawAdm is empty or has letters, find the numeric cell
            if (!rawAdm || !isNumericString(rawAdm)) {
              for (let i = 0; i < row.length; i++) {
                if (i === colSerialIdx) continue;
                const cell = String(row[i] || '').trim();
                if (/^\d{3,7}$/.test(cell.replace(/[^0-9]/g, ''))) {
                  rawAdm = cell;
                  break;
                }
              }
            }

            if (!rawName || isNumericString(rawName)) return; // Skip non-data / blank rows

            // If section was merged in Grade column (e.g. "Grade 10-N" or "10 N")
            if (rawGrade && !rawSection) {
              const secFromGrade = extractSectionLetter(rawGrade);
              if (secFromGrade) rawSection = secFromGrade;
            }
            if (!rawGrade && gradeInSheet) rawGrade = gradeInSheet;
            if (!rawSection && secInSheet) rawSection = secInSheet;

            allRawRows.push({
              rawAdm,
              rawName,
              rawGrade,
              rawSection,
              rawEmail,
              rawRole,
              rawLinked,
              sheetGrade: gradeInSheet || undefined,
            });
          });
        });

        if (allRawRows.length === 0) {
          setErrorMessage('No valid student or user records could be found in the uploaded file. Please ensure columns have headers like "Student Name", "Admission No", "Grade", and "Section".');
          setParsedRows([]);
          return;
        }

        // 5. Intelligent Deduplication and Match Against Existing Profiles
        const existingByAdm = new Map<string, UserProfile>();
        const existingByEmail = new Map<string, UserProfile>();
        const existingByNameGrade = new Map<string, UserProfile>();

        profiles.forEach((p) => {
          const normAdm = normalizeAdmissionNumber(p.admission_number || p.user_code, p.email);
          if (normAdm) existingByAdm.set(normAdm, p);

          if (p.email) existingByEmail.set(p.email.trim().toLowerCase(), p);

          const normName = normalizeStudentName(p.name);
          const cleanGrade = (p.grade || '').replace(/[^0-9]/g, '');
          if (normName && cleanGrade) {
            existingByNameGrade.set(`${normName}_${cleanGrade}`, p);
          }
        });

        const batchSeenAdm = new Map<string, number>();
        const batchSeenEmail = new Map<string, number>();
        const batchSeenNameGrade = new Map<string, number>();

        const finalRows: BulkUserRow[] = [];

        allRawRows.forEach((r, idx) => {
          let role: 'student' | 'teacher' | 'parent' | 'admin' = fallbackRole;
          const roleStr = r.rawRole.toLowerCase();
          if (roleStr.includes('student') || roleStr.includes('pupil')) role = 'student';
          else if (roleStr.includes('teacher') || roleStr.includes('faculty') || roleStr.includes('staff')) role = 'teacher';
          else if (roleStr.includes('parent') || roleStr.includes('guardian')) role = 'parent';
          else if (roleStr.includes('admin') || roleStr.includes('principal')) role = 'admin';

          let rawAdm = r.rawAdm;
          if (PLACEHOLDER_SET.has(rawAdm.toLowerCase())) rawAdm = '';

          let rawEmail = r.rawEmail.toLowerCase().trim();
          if (PLACEHOLDER_SET.has(rawEmail)) rawEmail = '';

          // Extract admission number: 1) rawAdm, 2) from email digits (wpap4729 -> 4729)
          let extractedAdm = sanitizeUserCode(rawAdm, rawEmail);

          let gradeNum = extractGradeNumber(r.rawGrade) || r.sheetGrade || (role === 'student' ? '10' : '');
          let sectionStr = extractSectionLetter(r.rawSection) || (role === 'student' ? 'A' : '');

          const normName = normalizeStudentName(r.rawName);
          const nameGradeKey = `${normName}_${gradeNum}`;

          // Match against existing database profiles
          let matchedProfile: UserProfile | undefined = undefined;
          const normAdm = normalizeAdmissionNumber(extractedAdm, rawEmail);

          if (normAdm && existingByAdm.has(normAdm)) {
            matchedProfile = existingByAdm.get(normAdm);
          } else if (rawEmail && existingByEmail.has(rawEmail)) {
            matchedProfile = existingByEmail.get(rawEmail);
          } else if (normName && gradeNum && existingByNameGrade.has(nameGradeKey)) {
            matchedProfile = existingByNameGrade.get(nameGradeKey);
          }

          // If matched existing profile, adopt real existing admission number and details
          if (matchedProfile) {
            if (!extractedAdm) {
              extractedAdm = sanitizeUserCode(matchedProfile.admission_number || matchedProfile.user_code, matchedProfile.email);
            }
            if (!rawEmail && matchedProfile.email) {
              rawEmail = matchedProfile.email;
            }
            if (!gradeNum && matchedProfile.grade) {
              gradeNum = matchedProfile.grade;
            }
            if (!sectionStr && matchedProfile.class_letter) {
              sectionStr = matchedProfile.class_letter;
            }
          }

          // Format clean school email if missing
          if (!rawEmail || !rawEmail.includes('@')) {
            if (extractedAdm) {
              rawEmail = `wpap${extractedAdm}@woodlempark.ae`;
            } else if (normName) {
              const dotName = normName.replace(/\s+/g, '.');
              rawEmail = `${dotName}@woodlempark.ae`;
            } else {
              rawEmail = `user.${idx + 1}@woodlempark.ae`;
            }
          }

          // Disambiguate / deduplicate within the current import file
          const currentNormAdm = normalizeAdmissionNumber(extractedAdm, rawEmail);
          let isDuplicateInFile = false;

          if (currentNormAdm && batchSeenAdm.has(currentNormAdm)) {
            isDuplicateInFile = true;
          } else if (batchSeenEmail.has(rawEmail)) {
            isDuplicateInFile = true;
          } else if (normName && gradeNum && batchSeenNameGrade.has(nameGradeKey)) {
            isDuplicateInFile = true;
          }

          if (currentNormAdm) batchSeenAdm.set(currentNormAdm, finalRows.length);
          batchSeenEmail.set(rawEmail, finalRows.length);
          if (normName && gradeNum) batchSeenNameGrade.set(nameGradeKey, finalRows.length);

          const isValid = !!(r.rawName && r.rawName.trim().length > 0);
          let error: string | undefined = !isValid ? 'Missing name' : undefined;

          let isExistingUser = !!matchedProfile;
          let statusText = 'New Account';

          if (isDuplicateInFile) {
            statusText = 'Duplicate in File (Merged)';
          } else if (isExistingUser) {
            statusText = `Existing User (Adm: ${matchedProfile?.admission_number || extractedAdm || 'Found'})`;
          }

          let linkedStudentCodes: string[] | undefined = undefined;
          if (role === 'parent' && r.rawLinked) {
            linkedStudentCodes = r.rawLinked.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
          }

          finalRows.push({
            name: r.rawName.trim(),
            email: rawEmail,
            role,
            userCode: extractedAdm || (role === 'parent' ? '' : (matchedProfile?.admission_number || '')),
            grade: gradeNum || undefined,
            classLetter: sectionStr || undefined,
            password: 'woodlem123',
            linkedStudentCodes,
            isValid,
            isExistingUser,
            isDuplicateInFile,
            matchedExistingId: matchedProfile?.id,
            statusText,
            error,
          });
        });

        // Filter duplicates out of the active batch, keeping the latest / enriched version
        const dedupedRows = finalRows.filter((r) => !r.isDuplicateInFile);
        setParsedRows(dedupedRows.length > 0 ? dedupedRows : finalRows);
      } catch (err: any) {
        console.error('Excel parse error:', err);
        setErrorMessage('Failed to parse spreadsheet. Please ensure it is a valid .xlsx, .xls, or .csv document.');
        setParsedRows([]);
      }
    };

    reader.readAsBinaryString(fileToParse);
  };

  const handleDownloadSample = () => {
    const sampleData = [
      {
        'Full Name': 'Aarav Sharma',
        'Email Address': 'aarav.sharma.g9@woodlempark.ae',
        'Role': 'student',
        'Admission Number': '1001',
        'Grade': '9',
        'Section': 'A',
      },
      {
        'Full Name': 'Fatima Al-Mansoori',
        'Email Address': 'fatima.m.g10@woodlempark.ae',
        'Role': 'student',
        'Admission Number': '1002',
        'Grade': '10',
        'Section': 'B',
      },
      {
        'Full Name': 'Robert Taylor',
        'Email Address': 'robert.taylor@woodlempark.ae',
        'Role': 'teacher',
        'Admission Number': '201',
        'Grade': '',
        'Section': '',
      },
      {
        'Full Name': 'Mariam Abdullah',
        'Email Address': 'mariam.abdullah@woodlempark.ae',
        'Role': 'parent',
        'Admission Number': '301',
        'Grade': '',
        'Section': '',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sample Users');
    XLSX.writeFile(workbook, 'Woodlem_Bulk_User_Import_Template.xlsx');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      alert('No valid user records found in the uploaded file to import.');
      return;
    }

    setIsProcessing(true);
    setProgress({ current: 0, total: validRows.length });

    try {
      await onBulkSubmit(validRows, (current, total) => {
        setProgress({ current, total });
      });
      setFile(null);
      setParsedRows([]);
      onClose();
    } catch (err: any) {
      alert('Unable to import user records. Please check the spreadsheet format and try again.');
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Bulk Import Users (Excel / CSV)</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              Add hundreds or thousands of students, teachers, parents, and admins instantly.
            </p>
          </div>
          <button type="button" className="close-modal" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Controls Bar: Default Role & Sample Download */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 20 }}>
            <div className="form-group" style={{ margin: 0, minWidth: 200, flex: 1 }}>
              <label className="form-label">Default Role for File</label>
              <CustomSelect
                value={defaultRole}
                onChange={(val) => {
                  const newRole = val as any;
                  setDefaultRole(newRole);
                  if (file) processExcelFile(file, newRole);
                }}
                options={[
                  { value: 'student', label: 'Student' },
                  { value: 'teacher', label: 'Teacher' },
                  { value: 'parent', label: 'Parent' },
                  { value: 'admin', label: 'Admin' },
                ]}
              />
            </div>

            <button
              type="button"
              className="btn-secondary"
              onClick={handleDownloadSample}
              style={{ height: 38, padding: '0 16px', whiteSpace: 'nowrap' }}
            >
              Download Sample Excel Template
            </button>
          </div>

          {/* Upload Drop Zone */}
          <div
            style={{
              border: '2px dashed var(--border-color)',
              borderRadius: 8,
              padding: '28px 20px',
              textAlign: 'center',
              background: 'var(--surface-variant)',
              cursor: 'pointer',
              marginBottom: 20,
              transition: 'border-color 0.15s ease',
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx, .xls, .csv"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--neutral-dark)', marginBottom: 4 }}>
              {file ? file.name : 'Click to select or drag & drop Excel / CSV sheet'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Supports .xlsx, .xls, and .csv files. All accounts will be created with default password <strong style={{ color: 'var(--primary)' }}>woodlem123</strong>.
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 6,
                background: '#FFEBEE',
                color: '#C62828',
                border: '1px solid #FFCDD2',
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              {errorMessage}
            </div>
          )}

          {/* Processing Progress */}
          {isProcessing && progress && (
            <div style={{ marginBottom: 20, padding: 14, background: 'var(--surface-variant)', border: '1px solid var(--border-color)', borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, color: 'var(--neutral-dark)', marginBottom: 6 }}>
                <span>Creating User Accounts...</span>
                <span>{progress.current} / {progress.total} Completed</span>
              </div>
              <div style={{ width: '100%', height: 8, background: 'var(--border-color)', borderRadius: 4, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${(progress.current / Math.max(progress.total, 1)) * 100}%`,
                    height: '100%',
                    background: 'var(--primary)',
                    transition: 'width 0.2s ease',
                  }}
                />
              </div>
            </div>
          )}

          {/* Preview Table */}
          {parsedRows.length > 0 && !isProcessing && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                    Parsed Rows ({validCount} Valid / {parsedRows.length} Total)
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 8 }}>
                    ({parsedRows.filter((r) => !r.isExistingUser && r.isValid).length} New · {parsedRows.filter((r) => r.isExistingUser && r.isValid).length} Existing Updates)
                  </span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Default Password: <code style={{ background: 'var(--surface-variant)', padding: '2px 6px', borderRadius: 4, color: 'var(--neutral-dark)', border: '1px solid var(--border-color)' }}>woodlem123</code>
                </span>
              </div>

              <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 8, background: 'var(--surface)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-variant)', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, zIndex: 1 }}>
                      <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-secondary)' }}>#</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Full Name</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Email Address</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Role</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Admission #</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Grade / Section</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-color)', background: !row.isValid ? '#FFF5F5' : (row.isExistingUser ? '#F0F9FF' : 'transparent') }}>
                        <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{i + 1}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--neutral-dark)' }}>{row.name || '—'}</td>
                        <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11.5, color: 'var(--neutral-dark)' }}>{row.email || '—'}</td>
                        <td style={{ padding: '8px 12px', textTransform: 'capitalize', color: 'var(--neutral-dark)' }}>{row.role}</td>
                        <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary)' }}>{row.userCode || '—'}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--neutral-dark)' }}>
                          {row.role === 'student' ? (
                            <span>Grade {row.grade || '10'}{row.classLetter ? `-${row.classLetter}` : ''}</span>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          {!row.isValid ? (
                            <span style={{ color: '#C62828', fontWeight: 600, fontSize: 11.5, background: '#FFEBEE', padding: '2px 6px', borderRadius: 4 }}>
                              {row.error || 'Invalid'}
                            </span>
                          ) : row.isExistingUser ? (
                            <span style={{ color: '#0277BD', fontWeight: 600, fontSize: 11.5, background: '#E1F5FE', padding: '2px 6px', borderRadius: 4 }} title={row.statusText}>
                              Existing (Updates Info)
                            </span>
                          ) : (
                            <span style={{ color: '#2E7D32', fontWeight: 600, fontSize: 11.5, background: '#E8F5E9', padding: '2px 6px', borderRadius: 4 }}>
                              New Account
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Submit Footer */}
          <div className="modal-footer" style={{ marginTop: 24 }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={isProcessing}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={validCount === 0 || isProcessing}
            >
              {isProcessing ? 'Processing Accounts...' : `Import & Sync ${validCount} Accounts`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
