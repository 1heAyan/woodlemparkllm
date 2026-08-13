'use client';

import React, { useState } from 'react';

interface ProvisionUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (userData: {
    name: string;
    email: string;
    password: string;
    role: 'student' | 'teacher' | 'parent' | 'admin';
    userCode: string;
    admissionNumber?: string;
    grade?: string;
    classLetter?: string;
  }) => void;
}

export const ProvisionUserModal: React.FC<ProvisionUserModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [emailPrefix, setEmailPrefix] = useState('');
  const [password, setPassword] = useState('woodlem123');
  const [role, setRole] = useState<'student' | 'teacher' | 'parent' | 'admin'>('student');
  const [admissionNumber, setAdmissionNumber] = useState('');

  // Grade state (Dropdown 1-12 or custom writeable)
  const [gradeSelect, setGradeSelect] = useState('1');
  const [isCustomGrade, setIsCustomGrade] = useState(false);
  const [customGrade, setCustomGrade] = useState('');

  // Class state (Dropdown A-Z or custom writeable)
  const [classSelect, setClassSelect] = useState('A');
  const [isCustomClass, setIsCustomClass] = useState(false);
  const [customClass, setCustomClass] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !emailPrefix.trim() || !password) return;
    if (password.length < 6) {
      alert('Password must be at least 6 characters long.');
      return;
    }

    // Clean & normalize email to always end with @woodlempark.ae
    let cleanPrefix = emailPrefix.trim().toLowerCase();
    if (cleanPrefix.endsWith('@woodlempark.ae')) {
      cleanPrefix = cleanPrefix.replace('@woodlempark.ae', '');
    }
    const fullEmail = `${cleanPrefix}@woodlempark.ae`;

    const finalAdmissionNo = admissionNumber.trim() || `WPS-${Math.floor(100000 + Math.random() * 900000)}`;

    const finalGrade = role === 'student'
      ? (isCustomGrade ? (customGrade.trim() || 'Grade 1') : `Grade ${gradeSelect}`)
      : undefined;

    const finalClass = role === 'student'
      ? (isCustomClass ? (customClass.trim().toUpperCase() || 'A') : classSelect)
      : undefined;

    onSubmit({
      name: name.trim(),
      email: fullEmail,
      password: password,
      role,
      userCode: finalAdmissionNo,
      admissionNumber: finalAdmissionNo,
      grade: finalGrade,
      classLetter: finalClass,
    });

    // Reset fields
    setName('');
    setEmailPrefix('');
    setPassword('woodlem123');
    setRole('student');
    setAdmissionNumber('');
    setGradeSelect('1');
    setIsCustomGrade(false);
    setCustomGrade('');
    setClassSelect('A');
    setIsCustomClass(false);
    setCustomClass('');
    onClose();
  };

  const classLetterOptions = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Provision New User Account</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              Create an individual account with default password <strong>woodlem123</strong>.
            </p>
          </div>
          <button type="button" className="close-modal" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">User Role</label>
            <select
              className="form-input"
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
              required
            >
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="parent">Parent</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Sarah Jenkins"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Email Username (Domain: @woodlempark.ae)</label>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <input
                type="text"
                className="form-input"
                style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
                placeholder="e.g. sarah.j"
                value={emailPrefix}
                onChange={(e) => setEmailPrefix(e.target.value)}
                required
              />
              <span
                style={{
                  background: '#EEF2FF',
                  border: '1px solid var(--neutral-light, #CBD5E1)',
                  borderLeft: 'none',
                  padding: '12px 14px',
                  borderTopRightRadius: 8,
                  borderBottomRightRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#4F46E5',
                  whiteSpace: 'nowrap',
                }}
              >
                @woodlempark.ae
              </span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Account Password</label>
            <input
              type="text"
              className="form-input"
              placeholder="Default: woodlem123"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
            <span style={{ fontSize: 11, color: '#64748B', marginTop: 4, display: 'block' }}>
              Standard default initial password: <code>woodlem123</code>
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">Admission Number / Reg. Code</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. 10452 or WPS-2026"
              value={admissionNumber}
              onChange={(e) => setAdmissionNumber(e.target.value)}
            />
          </div>

          {role === 'student' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {/* Grade Selector / Custom */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label className="form-label" style={{ margin: 0 }}>Grade (1 - 12)</label>
                  <button
                    type="button"
                    onClick={() => setIsCustomGrade(!isCustomGrade)}
                    style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    {isCustomGrade ? 'Select from list' : '+ Write custom'}
                  </button>
                </div>
                {isCustomGrade ? (
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Grade 10-CBSE"
                    value={customGrade}
                    onChange={(e) => setCustomGrade(e.target.value)}
                    required
                  />
                ) : (
                  <select
                    className="form-input"
                    value={gradeSelect}
                    onChange={(e) => setGradeSelect(e.target.value)}
                    required
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
                      <option key={g} value={g}>
                        Grade {g}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Class Selector / Custom */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label className="form-label" style={{ margin: 0 }}>Class / Section</label>
                  <button
                    type="button"
                    onClick={() => setIsCustomClass(!isCustomClass)}
                    style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    {isCustomClass ? 'Select letter' : '+ Write custom'}
                  </button>
                </div>
                {isCustomClass ? (
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. A1 or Blue"
                    value={customClass}
                    onChange={(e) => setCustomClass(e.target.value)}
                    required
                  />
                ) : (
                  <select
                    className="form-input"
                    value={classSelect}
                    onChange={(e) => setClassSelect(e.target.value)}
                    required
                  >
                    {classLetterOptions.map((letter) => (
                      <option key={letter} value={letter}>
                        Class {letter}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          )}

          <button type="submit" className="btn-primary" style={{ width: '100%', padding: 14, marginTop: 8 }}>
            Create &amp; Provision User Account
          </button>
        </form>
      </div>
    </div>
  );
};
