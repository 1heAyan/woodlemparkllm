'use client';

import React, { useState, useEffect } from 'react';
import { UserProfile } from '@/lib/supabaseClient';

interface EditUserModalProps {
  isOpen: boolean;
  user: UserProfile | null;
  onClose: () => void;
  onSubmit: (updatedUser: UserProfile) => void;
}

export const EditUserModal: React.FC<EditUserModalProps> = ({
  isOpen,
  user,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'student' | 'teacher' | 'admin' | 'parent'>('student');
  const [userCode, setUserCode] = useState('');

  // Grade state
  const [gradeSelect, setGradeSelect] = useState('1');
  const [isCustomGrade, setIsCustomGrade] = useState(false);
  const [customGrade, setCustomGrade] = useState('');

  // Class state
  const [classSelect, setClassSelect] = useState('A');
  const [isCustomClass, setIsCustomClass] = useState(false);
  const [customClass, setCustomClass] = useState('');

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setRole(user.role || 'student');
      setUserCode(user.user_code || user.admission_number || '');

      // Parse grade
      if (user.grade) {
        const match = user.grade.match(/Grade\s*(\d+)/i);
        if (match && parseInt(match[1]) >= 1 && parseInt(match[1]) <= 12) {
          setGradeSelect(match[1]);
          setIsCustomGrade(false);
        } else {
          setIsCustomGrade(true);
          setCustomGrade(user.grade);
        }
      } else {
        setGradeSelect('1');
        setIsCustomGrade(false);
      }

      // Parse class letter
      if (user.class_letter) {
        if (/^[A-L]$/i.test(user.class_letter)) {
          setClassSelect(user.class_letter.toUpperCase());
          setIsCustomClass(false);
        } else {
          setIsCustomClass(true);
          setCustomClass(user.class_letter);
        }
      } else {
        setClassSelect('A');
        setIsCustomClass(false);
      }
    }
  }, [user]);

  if (!isOpen || !user) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    let cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes('@')) {
      cleanEmail = `${cleanEmail}@woodlempark.ae`;
    }

    const finalGrade = role === 'student'
      ? (isCustomGrade ? (customGrade.trim() || 'Grade 1') : `Grade ${gradeSelect}`)
      : undefined;

    const finalClass = role === 'student'
      ? (isCustomClass ? (customClass.trim().toUpperCase() || 'A') : classSelect)
      : undefined;

    onSubmit({
      ...user,
      name: name.trim(),
      email: cleanEmail,
      role,
      user_code: userCode.trim(),
      admission_number: userCode.trim(),
      grade: finalGrade,
      class_letter: finalClass,
    });
    onClose();
  };

  const classLetterOptions = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Edit User Account</h2>
          <button type="button" className="close-modal" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Role</label>
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
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Admission Number / Reg. Code</label>
            <input
              type="text"
              className="form-input"
              value={userCode}
              onChange={(e) => setUserCode(e.target.value)}
              placeholder="e.g. WPS-2026"
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
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" style={{ flex: 1 }}>
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
