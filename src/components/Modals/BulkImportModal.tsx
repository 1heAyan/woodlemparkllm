'use client';

import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { CustomSelect } from '@/components/UI/CustomSelect';
import { UserProfile } from '@/lib/supabaseClient';

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
  profiles?: UserProfile[];
}

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
    '0',
    'pending',
    'not available',
    'not provided',
    'tbd',
    'undefined',
  ]);

  const processExcelFile = (fileToParse: File, fallbackRole: 'student' | 'teacher' | 'parent' | 'admin') => {
    setErrorMessage('');
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        // Read all sheets across the Excel workbook (e.g. "Grade 9", "Grade 10", etc.)
        const rawJson: any[] = [];

        workbook.SheetNames.forEach((sheetName) => {
          const ws = workbook.Sheets[sheetName];
          if (!ws) return;

          // Convert sheet to 2D array to accurately detect the true table header row
          const sheetAoA: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          if (!sheetAoA || sheetAoA.length === 0) return;

          // Look for the header row index (matches key column indicators)
          let headerRowIdx = -1;
          const headerKeywords = ['name', 'student', 'email', 'admission', 'adm', 'code', 'grade', 'class', 'section', 'wpap', 'id', 'roll', 'first', 'last'];

          for (let rIdx = 0; rIdx < Math.min(sheetAoA.length, 10); rIdx++) {
            const rowVals = sheetAoA[rIdx].map((c) => String(c || '').toLowerCase().trim());
            const hasKeyword = rowVals.some((cell) =>
              headerKeywords.some((kw) => cell.includes(kw))
            );
            if (hasKeyword) {
              headerRowIdx = rIdx;
              break;
            }
          }

          let sheetRows: any[] = [];
          if (headerRowIdx >= 0) {
            const headers = sheetAoA[headerRowIdx].map((h, i) => {
              const str = String(h || '').trim();
              return str ? str : `__col_${i}`;
            });

            for (let r = headerRowIdx + 1; r < sheetAoA.length; r++) {
              const rowData = sheetAoA[r];
              if (!rowData || rowData.length === 0) continue;
              // Check if row has any non-empty cell
              const hasContent = rowData.some((c) => String(c || '').trim() !== '');
              if (!hasContent) continue;

              const rowObj: Record<string, any> = {};
              headers.forEach((hdr, colI) => {
                rowObj[hdr] = rowData[colI] !== undefined && rowData[colI] !== null ? String(rowData[colI]).trim() : '';
              });
              sheetRows.push(rowObj);
            }
          } else {
            // Fallback to standard sheet_to_json
            sheetRows = XLSX.utils.sheet_to_json(ws, { defval: '' });
          }

          sheetRows.forEach((r) => {
            if (r && typeof r === 'object') {
              const gradeInSheet = sheetName.match(/\b(12|11|10|9|8|7|6|5|4|3|2|1)\b/);
              if (gradeInSheet) {
                r.__inferredGrade = gradeInSheet[1];
              }
              rawJson.push(r);
            }
          });
        });

        if (!rawJson || rawJson.length === 0) {
          setErrorMessage('The uploaded spreadsheet is empty. Please verify the file contents.');
          setParsedRows([]);
          return;
        }

        // 1. Initial field mapping and extraction per row
        const mappedRows = rawJson.map((row, idx) => {
          const keys = Object.keys(row);

          const getVal = (...patterns: string[]): string => {
            // Pass 1: Exact column header match (case & whitespace insensitive)
            for (const pat of patterns) {
              const cleanPat = pat.toLowerCase().replace(/[^a-z0-9]/g, '');
              const matchedKey = keys.find((k) => k.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanPat);
              if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null) {
                const val = String(row[matchedKey]).trim();
                if (val !== '' && !PLACEHOLDER_SET.has(val.toLowerCase())) return val;
              }
            }
            // Pass 2: Prefix / includes match for specific patterns
            for (const pat of patterns) {
              const cleanPat = pat.toLowerCase().replace(/[^a-z0-9]/g, '');
              if (cleanPat.length >= 3) {
                const matchedKey = keys.find((k) => {
                  const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                  return cleanK.startsWith(cleanPat) || cleanK.includes(cleanPat);
                });
                if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null) {
                  const val = String(row[matchedKey]).trim();
                  if (val !== '' && !PLACEHOLDER_SET.has(val.toLowerCase())) return val;
                }
              }
            }
            return '';
          };

          const rawName = getVal(
            'fullname',
            'studentname',
            'student_name',
            'nameofthestudent',
            'candidate_name',
            'candidatename',
            'pupilname',
            'teachername',
            'firstname',
            'name',
            'student',
            'pupil'
          );

          let rawEmail = getVal(
            'emailaddress',
            'emailid',
            'studentemail',
            'studentemailid',
            'officialemail',
            'officialemailid',
            'gsuiteid',
            'googleid',
            'email_id',
            'useremail',
            'mailid',
            'email',
            'mail',
            'username',
            'account'
          );

          const rawRoleStr = getVal('role', 'userrole', 'accounttype', 'type', 'category', 'designation').toLowerCase();
          let role: 'student' | 'teacher' | 'parent' | 'admin' = fallbackRole;
          if (rawRoleStr.includes('student') || rawRoleStr.includes('pupil')) role = 'student';
          else if (rawRoleStr.includes('teacher') || rawRoleStr.includes('staff') || rawRoleStr.includes('faculty')) role = 'teacher';
          else if (rawRoleStr.includes('parent') || rawRoleStr.includes('guardian')) role = 'parent';
          else if (rawRoleStr.includes('admin') || rawRoleStr.includes('principal') || rawRoleStr.includes('manager')) role = 'admin';

          const rawCode = getVal(
            'admissionnumber',
            'admissionno',
            'admission_number',
            'admission_no',
            'admno',
            'admn_no',
            'admnno',
            'adm_no',
            'studentid',
            'student_id',
            'studentno',
            'wpapno',
            'wpap',
            'regno',
            'registrationno',
            'rollno',
            'roll_no',
            'scholarno',
            'usercode',
            'user_code',
            'code',
            'id'
          );

          const rawGradeCol = getVal('grade', 'classgrade', 'year', 'standard', 'std', 'cohort', 'level', 'gr', 'gradelevel');
          const rawSecCol = getVal('section', 'classletter', 'sec', 'division', 'div', 'class_letter', 'room');
          const rawComboCol = getVal('gradeclass', 'class', 'classsection', 'classsec', 'classname', 'grade_section');

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

          let finalGrade = '';
          let finalSection = '';

          if (rawGradeCol) {
            finalGrade = extractGradeNumber(rawGradeCol);
            if (!finalGrade && (row as any).__inferredGrade) {
              finalGrade = (row as any).__inferredGrade;
            }
            const maybeSec = extractSectionLetter(rawGradeCol);
            if (maybeSec && !finalSection) finalSection = maybeSec;
          }

          if (rawSecCol) {
            finalSection = extractSectionLetter(rawSecCol);
            if (!finalGrade) finalGrade = extractGradeNumber(rawSecCol);
          }

          if (rawComboCol) {
            if (!finalGrade) finalGrade = extractGradeNumber(rawComboCol);
            if (!finalSection) finalSection = extractSectionLetter(rawComboCol);
          }

          if (!finalGrade && rawEmail) {
            const emailMatch = rawEmail.match(/[._-]g(9|10|11|12)[._@-]/i) ||
                               rawEmail.match(/grade(9|10|11|12)/i) ||
                               rawEmail.match(/student(9|10|11|12)/i);
            if (emailMatch) {
              finalGrade = emailMatch[1];
            }
          }

          if (role === 'student') {
            if (!finalGrade) finalGrade = (row as any).__inferredGrade || '9';
            if (!finalSection) finalSection = 'A';
          }

          const rawStudentCol = getVal('studentadmissionnumber', 'studentadmissionno', 'studentadm', 'childadmissionnumber', 'childadmissionno', 'wardadmissionnumber', 'studentcode', 'student_id', 'linkedstudent', 'linked_students', 'linkedchild');
          let linkedStudentCodes: string[] | undefined = undefined;
          if (role === 'parent' && rawStudentCol) {
            linkedStudentCodes = rawStudentCol.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
          }

          // If rawEmail contains something without @, check if it's an email prefix or code
          if (rawEmail) {
            if (!rawEmail.includes('@')) {
              rawEmail = `${rawEmail.trim()}@woodlempark.ae`;
            } else {
              rawEmail = rawEmail.trim();
            }
          }

          return {
            name: rawName,
            rawEmail,
            role,
            rawCode,
            grade: finalGrade || undefined,
            classLetter: finalSection || undefined,
            password: 'woodlem123',
            linkedStudentCodes,
            idx,
          };
        });

        // 2. Guarantee 100% Unique Admission/User Codes across the batch (Clean without artificial WPS/PRN/ADM prefixes)
        const seenCodes = new Set<string>();
        const assignedCodes = mappedRows.map((r, i) => {
          let code = (r.rawCode || '').trim();
          // Strip any artificial system prefixes if already present
          code = code.replace(/^(WPS|PRN|ADM|PAR|EMP)[-_ ]*/i, '').trim();

          if (!code || PLACEHOLDER_SET.has(code.toLowerCase())) {
            // Check if rawEmail has numbers (e.g. wpap6366@woodlempark.ae -> 6366)
            const emailNumMatch = (r.rawEmail || '').match(/(\d+)/);
            if (emailNumMatch) {
              code = emailNumMatch[1];
            } else {
              code = `${1000 + i + 1}`;
            }
          }
          let finalCode = code;
          let counter = 1;
          while (seenCodes.has(finalCode.toLowerCase())) {
            finalCode = `${code}-${counter}`;
            counter++;
          }
          seenCodes.add(finalCode.toLowerCase());
          return finalCode;
        });

        // 3. Guarantee 100% Unique, Collision-Proof Emails across the batch
        const seenFileEmails = new Set<string>();

        const rows: BulkUserRow[] = mappedRows.map((r, i) => {
          const finalCode = assignedCodes[i];
          let cleanEmail = (r.rawEmail || '').toLowerCase().trim();

          // Generate school email if missing or invalid
          if (!cleanEmail || !cleanEmail.includes('@') || PLACEHOLDER_SET.has(cleanEmail)) {
            const cleanCodePart = finalCode.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (cleanCodePart && !cleanCodePart.startsWith('wps')) {
              cleanEmail = `${cleanCodePart}@woodlempark.ae`;
            } else {
              const nameClean = r.name
                ? r.name.toLowerCase().replace(/[^a-z0-9]/g, '.').replace(/\.+/g, '.').replace(/^\.|\.$/g, '')
                : `user.${i + 1}`;
              const sec = (r.classLetter || 'a').toLowerCase();
              cleanEmail = `${nameClean}.${sec}${i + 1}@woodlempark.ae`;
            }
          }

          // Disambiguate duplicate email collisions within the file
          let finalEmail = cleanEmail;
          let counter = 1;
          while (seenFileEmails.has(finalEmail)) {
            const [uPart, dPart] = cleanEmail.split('@');
            const disambigPart = finalCode.toLowerCase().replace(/[^a-z0-9]/g, '') || `u${i + 1}`;
            finalEmail = `${uPart}.${disambigPart}${counter > 1 ? `.${counter}` : ''}@${dPart || 'woodlempark.ae'}`;
            counter++;
          }
          seenFileEmails.add(finalEmail);

          const isValid = !!(r.name && r.name.trim().length > 0);
          const error = !isValid ? 'Missing name' : undefined;

          return {
            name: r.name ? r.name.trim() : `Account ${i + 1}`,
            email: finalEmail,
            role: r.role,
            userCode: finalCode,
            grade: r.grade,
            classLetter: r.classLetter,
            password: 'woodlem123',
            linkedStudentCodes: r.linkedStudentCodes,
            isValid,
            error,
          };
        });

        setParsedRows(rows);
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--neutral-dark)' }}>
                  Parsed Rows Preview ({validCount} Valid / {parsedRows.length} Total)
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Default Password: <code style={{ background: 'var(--surface-variant)', padding: '2px 6px', borderRadius: 4, color: 'var(--neutral-dark)', border: '1px solid var(--border-color)' }}>woodlem123</code>
                </span>
              </div>

              <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 8, background: 'var(--surface)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-variant)', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-secondary)' }}>#</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Full Name</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Email Address</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Role</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Admission / ID</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Grade / Section</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-color)', background: row.isValid ? 'transparent' : '#FFF5F5' }}>
                        <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{i + 1}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 500, color: 'var(--neutral-dark)' }}>{row.name || '—'}</td>
                        <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: 'var(--neutral-dark)' }}>{row.email || '—'}</td>
                        <td style={{ padding: '8px 12px', textTransform: 'capitalize', color: 'var(--neutral-dark)' }}>{row.role}</td>
                        <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: 'var(--neutral-dark)' }}>{row.userCode}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--neutral-dark)' }}>
                          {row.role === 'student' ? (
                            <span>Grade {row.grade || '9'} ({row.classLetter || 'A'})</span>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          {row.isValid ? (
                            <span style={{ color: '#2E7D32', fontWeight: 600, fontSize: 12 }}>Ready</span>
                          ) : (
                            <span style={{ color: '#C62828', fontWeight: 600, fontSize: 12 }}>{row.error}</span>
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
              {isProcessing ? 'Creating Accounts...' : `Import ${validCount} Accounts`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
