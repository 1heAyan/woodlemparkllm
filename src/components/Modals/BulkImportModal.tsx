'use client';

import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';

export interface BulkUserRow {
  name: string;
  email: string;
  role: 'student' | 'teacher' | 'parent' | 'admin';
  userCode: string;
  grade?: string;
  classLetter?: string;
  password?: string;
  isValid: boolean;
  error?: string;
}

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBulkSubmit: (users: BulkUserRow[]) => Promise<void>;
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
          // Normalize column headers case-insensitively
          const getVal = (...keys: string[]) => {
            for (const key of keys) {
              const matchedKey = Object.keys(row).find(
                (k) => k.trim().toLowerCase() === key.toLowerCase()
              );
              if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== '') {
                return String(row[matchedKey]).trim();
              }
            }
            return '';
          };

          const rawName = getVal('name', 'full name', 'student name', 'user name');
          let rawEmail = getVal('email', 'email prefix', 'username', 'email address');
          let rawRoleStr = getVal('role', 'user role', 'type').toLowerCase();
          const rawCode = getVal('admission number', 'admission no', 'admission_number', 'user code', 'reg no', 'id', 'user_code');
          let rawGrade = getVal('grade', 'class grade', 'year');
          let rawClassLetter = getVal('class', 'section', 'class letter', 'class_letter');

          // Email prefix normalization to @woodlempark.ae
          if (rawEmail) {
            if (!rawEmail.includes('@')) {
              rawEmail = `${rawEmail.trim()}@woodlempark.ae`;
            } else if (!rawEmail.endsWith('@woodlempark.ae')) {
              const prefix = rawEmail.split('@')[0];
              rawEmail = `${prefix.trim()}@woodlempark.ae`;
            }
          }

          // Role normalization
          let role: 'student' | 'teacher' | 'parent' | 'admin' = fallbackRole;
          if (['student', 'teacher', 'parent', 'admin'].includes(rawRoleStr)) {
            role = rawRoleStr as any;
          }

          // Grade normalization (1-12)
          if (rawGrade) {
            const digitMatch = rawGrade.match(/\d+/);
            if (digitMatch) {
              rawGrade = `Grade ${digitMatch[0]}`;
            }
          } else if (role === 'student') {
            rawGrade = 'Grade 1';
          }

          // Class letter normalization (A, B, C...)
          if (!rawClassLetter && role === 'student') {
            rawClassLetter = 'A';
          } else if (rawClassLetter) {
            rawClassLetter = rawClassLetter.toUpperCase();
          }

          // Admission code fallback if missing
          const finalCode = rawCode || `WPS-${1000 + idx}`;

          let isValid = true;
          let error = '';

          if (!rawName) {
            isValid = false;
            error = 'Missing name';
          } else if (!rawEmail) {
            isValid = false;
            error = 'Missing email prefix';
          }

          return {
            name: rawName,
            email: rawEmail.toLowerCase(),
            role,
            userCode: finalCode,
            grade: rawGrade,
            classLetter: rawClassLetter,
            password: 'woodlem123',
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
        'Full Name': 'Alexander Smith',
        'Email Prefix': 'alexander.s',
        'Role': 'student',
        'Admission Number': 'WPS-202601',
        'Grade': '10',
        'Class': 'A',
      },
      {
        'Full Name': 'Fatima Al-Mansoori',
        'Email Prefix': 'fatima.m',
        'Role': 'student',
        'Admission Number': 'WPS-202602',
        'Grade': '11',
        'Class': 'B',
      },
      {
        'Full Name': 'Robert Taylor',
        'Email Prefix': 'robert.t',
        'Role': 'teacher',
        'Admission Number': 'TCH-104',
        'Grade': '',
        'Class': '',
      },
      {
        'Full Name': 'Mariam Abdullah',
        'Email Prefix': 'mariam.a',
        'Role': 'parent',
        'Admission Number': 'PRN-302',
        'Grade': '',
        'Class': '',
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
      alert('No valid rows found to import.');
      return;
    }

    setIsProcessing(true);
    try {
      await onBulkSubmit(validRows);
      setFile(null);
      setParsedRows([]);
      onClose();
    } catch (err: any) {
      alert(`Bulk import error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: 850, width: '90%' }}
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
            <select
              className="form-input"
              style={{ width: 140, padding: '8px 12px' }}
              value={defaultRole}
              onChange={(e) => {
                const newRole = e.target.value as any;
                setDefaultRole(newRole);
                if (file) processExcelFile(file, newRole);
              }}
            >
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="parent">Parent</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <button
            type="button"
            className="btn-secondary"
            onClick={handleDownloadSample}
            style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            📥 Download Sample Excel Template
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
          <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
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
            ⚠️ {errorMessage}
          </div>
        )}

        {/* Preview Table */}
        {parsedRows.length > 0 && (
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
                      <td style={{ padding: '8px 12px' }}>{row.role === 'student' ? `${row.grade || 'Grade 1'} (${row.classLetter || 'A'})` : 'N/A'}</td>
                      <td style={{ padding: '8px 12px' }}>
                        {row.isValid ? (
                          <span style={{ color: '#16A34A', fontWeight: 600 }}>✓ Ready</span>
                        ) : (
                          <span style={{ color: '#DC2626', fontWeight: 600 }}>❌ {row.error}</span>
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
            {isProcessing ? 'Provisioning Accounts…' : `🚀 Import ${validCount} Users`}
          </button>
        </div>
      </div>
    </div>
  );
};
