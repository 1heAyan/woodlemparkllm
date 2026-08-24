'use client';

import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { CustomSelect } from '@/components/UI/CustomSelect';

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
  error?: string;
}

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBulkSubmit: (users: BulkUserRow[], onProgress?: (current: number, total: number) => void) => Promise<void>;
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({
  isOpen,
  onClose,
  onBulkSubmit,
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

  const processExcelFile = (fileToParse: File, fallbackRole: 'student' | 'teacher' | 'parent' | 'admin') => {
    setErrorMessage('');
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!rawJson || rawJson.length === 0) {
          setErrorMessage('The uploaded Excel sheet is empty. Please check the file.');
          setParsedRows([]);
          return;
        }

        const rows: BulkUserRow[] = rawJson.map((row, idx) => {
          const keys = Object.keys(row);

          // Fuzzy case-insensitive column finder
          const getVal = (...patterns: string[]): string => {
            for (const pat of patterns) {
              const cleanPat = pat.toLowerCase().replace(/[^a-z0-9]/g, '');
              const matchedKey = keys.find((k) => {
                const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                return cleanK === cleanPat || cleanK.includes(cleanPat) || cleanK.startsWith(cleanPat);
              });
              if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null) {
                const val = String(row[matchedKey]).trim();
                if (val !== '') return val;
              }
            }
            return '';
          };

          // 1. Name
          const rawName = getVal('fullname', 'fullname', 'studentname', 'username', 'name', 'student', 'pupil', 'teachername', 'firstname');

          // 2. Email
          let rawEmail = getVal('emailaddress', 'emailid', 'emailprefix', 'email', 'useremail', 'username', 'mail', 'account');

          // 3. Role
          const rawRoleStr = getVal('role', 'userrole', 'accounttype', 'type', 'category', 'designation').toLowerCase();
          let role: 'student' | 'teacher' | 'parent' | 'admin' = fallbackRole;
          if (rawRoleStr.includes('student') || rawRoleStr.includes('pupil')) role = 'student';
          else if (rawRoleStr.includes('teacher') || rawRoleStr.includes('staff') || rawRoleStr.includes('faculty')) role = 'teacher';
          else if (rawRoleStr.includes('parent') || rawRoleStr.includes('guardian')) role = 'parent';
          else if (rawRoleStr.includes('admin') || rawRoleStr.includes('principal') || rawRoleStr.includes('manager')) role = 'admin';

          // 4. Admission / ID
          const rawCode = getVal('admissionnumber', 'admissionno', 'admno', 'admission_number', 'studentid', 'id', 'employeeid', 'empid', 'regno', 'usercode', 'code');

          // 5. Grade & Class columns
          const rawGradeCol = getVal('grade', 'classgrade', 'year', 'standard', 'std', 'cohort', 'level', 'gr', 'gradelevel');
          const rawSecCol = getVal('section', 'classletter', 'sec', 'division', 'div', 'class_letter', 'room');
          const rawComboCol = getVal('gradeclass', 'class', 'classsection', 'classsec', 'classname');

          // Grade extractor helper (looks for 9, 10, 11, 12)
          const extractGradeNumber = (str: string): string => {
            if (!str) return '';
            const match = str.match(/\b(12|11|10|9)\b/) ||
                          str.match(/(?:grade|gr|g|year|std|standard|class|level)[\s.-]*(12|11|10|9)/i) ||
                          str.match(/(12|11|10|9)(?:th|st|nd|rd)?/i);
            return match ? match[1] : '';
          };

          // Section letter extractor helper (looks for A-Z)
          const extractSectionLetter = (str: string): string => {
            if (!str) return '';
            const match = str.match(/(?:sec|section|div|division|class)?[\s.-]*\b([a-zA-Z])\b/i) ||
                          str.match(/[\(\[\-_\s]([a-zA-Z])[\)\]]?$/) ||
                          str.match(/\d+[\s.-]*([a-zA-Z])/);
            return match ? match[1].toUpperCase() : '';
          };

          let finalGrade = '';
          let finalSection = '';

          // Strategy A: Check Grade column
          if (rawGradeCol) {
            finalGrade = extractGradeNumber(rawGradeCol);
            const maybeSec = extractSectionLetter(rawGradeCol);
            if (maybeSec && !finalSection) finalSection = maybeSec;
          }

          // Strategy B: Check Section column
          if (rawSecCol) {
            finalSection = extractSectionLetter(rawSecCol);
            if (!finalGrade) finalGrade = extractGradeNumber(rawSecCol);
          }

          // Strategy C: Check Combo Class/Grade column
          if (rawComboCol) {
            if (!finalGrade) finalGrade = extractGradeNumber(rawComboCol);
            if (!finalSection) finalSection = extractSectionLetter(rawComboCol);
          }

          // Strategy D: Check email prefix for grade clues (e.g. aarav.sharma.g9@woodlempark.ae or user_g11@)
          if (!finalGrade && rawEmail) {
            const emailMatch = rawEmail.match(/[._-]g(9|10|11|12)[._@-]/i) ||
                               rawEmail.match(/grade(9|10|11|12)/i) ||
                               rawEmail.match(/student(9|10|11|12)/i);
            if (emailMatch) {
              finalGrade = emailMatch[1];
            }
          }

          // Default values for student
          if (role === 'student') {
            if (!finalGrade) finalGrade = '9';
            if (!finalSection) finalSection = 'A';
          }

          // Email prefix normalization
          if (rawEmail) {
            if (!rawEmail.includes('@')) {
              rawEmail = `${rawEmail.trim()}@woodlempark.ae`;
            } else {
              rawEmail = rawEmail.trim();
            }
          }

          // 6. Linked Student Admission Number(s) for Parents
          const rawStudentCol = getVal('studentadmissionnumber', 'studentadmissionno', 'studentadm', 'childadmissionnumber', 'childadmissionno', 'wardadmissionnumber', 'studentcode', 'student_id', 'linkedstudent', 'linked_students', 'linkedchild');
          let linkedStudentCodes: string[] | undefined = undefined;
          if (role === 'parent' && rawStudentCol) {
            linkedStudentCodes = rawStudentCol.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
          }

          const finalCode = rawCode || (role === 'student' ? `WPS-${1000 + idx}` : role === 'parent' ? `PAR-${1000 + idx}` : `EMP-${100 + idx}`);

          let isValid = true;
          let error = '';

          if (!rawName) {
            isValid = false;
            error = 'Missing name';
          } else if (!rawEmail) {
            isValid = false;
            error = 'Missing email';
          }

          return {
            name: rawName,
            email: rawEmail.toLowerCase(),
            role,
            userCode: finalCode,
            grade: finalGrade || undefined,
            classLetter: finalSection || undefined,
            password: 'woodlem123',
            linkedStudentCodes,
            isValid,
            error,
          };
        });

        setParsedRows(rows);
      } catch (err: any) {
        console.error('Excel parse error:', err);
        setErrorMessage('Failed to parse Excel file. Please ensure it is a valid .xlsx or .csv document.');
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
        'Admission Number': 'WPS-1001',
        'Grade': '9',
        'Section': 'A',
      },
      {
        'Full Name': 'Fatima Al-Mansoori',
        'Email Address': 'fatima.m.g10@woodlempark.ae',
        'Role': 'student',
        'Admission Number': 'WPS-1002',
        'Grade': '10',
        'Section': 'B',
      },
      {
        'Full Name': 'Robert Taylor',
        'Email Address': 'robert.taylor@woodlempark.ae',
        'Role': 'teacher',
        'Admission Number': 'EMP-201',
        'Grade': '',
        'Section': '',
      },
      {
        'Full Name': 'Mariam Abdullah',
        'Email Address': 'mariam.abdullah@woodlempark.ae',
        'Role': 'parent',
        'Admission Number': 'PRN-301',
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
      alert('No valid student or staff records found in the spreadsheet to import.');
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
      <div
        className="modal-content"
        style={{ maxWidth: 880, width: '92%' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Bulk Import Users (Excel / CSV)</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
              Add hundreds or thousands of students, teachers, parents, and admins instantly.
            </p>
          </div>
          <button type="button" className="close-modal" onClick={onClose}>&times;</button>
        </div>

        <div style={{ marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label className="form-label" style={{ margin: 0, fontWeight: 600 }}>Default Role for File:</label>
            <div style={{ width: 140 }}>
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
          </div>

          <button
            type="button"
            className="btn-secondary"
            onClick={handleDownloadSample}
            style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            Download Sample Excel Template
          </button>
        </div>

        {/* Upload dropzone */}
        <div
          style={{
            border: '2px dashed var(--neutral-light, #E2E8F0)',
            borderRadius: 12,
            padding: '24px 16px',
            textAlign: 'center',
            background: 'var(--neutral-subtle, #F8FAFC)',
            cursor: 'pointer',
            marginBottom: 20,
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
          <h4 style={{ margin: '0 0 4px', fontSize: 15, color: 'var(--neutral-dark)' }}>
            {file ? file.name : 'Click to select or drag & drop Excel / CSV sheet'}
          </h4>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
            Supports .xlsx, .xls, and .csv files. All accounts will be created with default password <strong style={{ color: 'var(--primary)' }}>woodlem123</strong>.
          </p>
        </div>

        {errorMessage && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: '#FFEBEE',
              color: '#C62828',
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {errorMessage}
          </div>
        )}

        {/* Progress Bar when processing */}
        {isProcessing && progress && (
          <div style={{ marginBottom: 20, padding: 14, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, color: '#166534', marginBottom: 6 }}>
              <span>Provisioning User Accounts...</span>
              <span>{progress.current} / {progress.total} Completed</span>
            </div>
            <div style={{ width: '100%', height: 8, background: '#DCFCE7', borderRadius: 4, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${(progress.current / Math.max(progress.total, 1)) * 100}%`,
                  height: '100%',
                  background: '#16A34A',
                  transition: 'width 0.2s ease',
                }}
              />
            </div>
          </div>
        )}

        {/* Preview Table */}
        {parsedRows.length > 0 && !isProcessing && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                Parsed Rows Preview ({validCount} Valid / {parsedRows.length} Total)
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Default Password: <code style={{ background: '#EEF2FF', padding: '2px 6px', borderRadius: 4, color: '#4F46E5' }}>woodlem123</code>
              </span>
            </div>

            <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#F1F5F9', borderBottom: '1px solid #E2E8F0' }}>
                    <th style={{ padding: '8px 12px' }}>#</th>
                    <th style={{ padding: '8px 12px' }}>Full Name</th>
                    <th style={{ padding: '8px 12px' }}>Email Address</th>
                    <th style={{ padding: '8px 12px' }}>Role</th>
                    <th style={{ padding: '8px 12px' }}>Admission No.</th>
                    <th style={{ padding: '8px 12px' }}>Grade / Class</th>
                    <th style={{ padding: '8px 12px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F1F5F9', background: row.isValid ? 'transparent' : '#FFF5F5' }}>
                      <td style={{ padding: '8px 12px', color: '#64748B' }}>{i + 1}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 500 }}>{row.name || '—'}</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#2563EB' }}>{row.email || '—'}</td>
                      <td style={{ padding: '8px 12px', textTransform: 'capitalize' }}>{row.role}</td>
                      <td style={{ padding: '8px 12px' }}>{row.userCode}</td>
                      <td style={{ padding: '8px 12px' }}>
                        {row.role === 'student' ? (
                          <span style={{ fontWeight: 600, color: '#1E293B' }}>
                            Grade {row.grade || '9'} ({row.classLetter || 'A'})
                          </span>
                        ) : (
                          'N/A'
                        )}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        {row.isValid ? (
                          <span style={{ color: '#16A34A', fontWeight: 600 }}>Ready</span>
                        ) : (
                          <span style={{ color: '#DC2626', fontWeight: 600 }}>{row.error}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 12 }}>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={isProcessing}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={validCount === 0 || isProcessing}
            onClick={handleSubmit}
            style={{ padding: '12px 24px' }}
          >
            {isProcessing ? 'Provisioning Accounts…' : `Import ${validCount} Users`}
          </button>
        </div>
      </div>
    </div>
  );
};
