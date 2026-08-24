'use client';

import React, { useState, useMemo } from 'react';
import { UserProfile } from '@/lib/supabaseClient';
import { CustomSelect } from '@/components/UI/CustomSelect';
import { ShieldCheck, UserCheck, Search, AlertCircle } from 'lucide-react';

interface RequestChildLinkModalProps {
  isOpen: boolean;
  currentUser: UserProfile;
  students: UserProfile[];
  onClose: () => void;
  onSubmit: (data: {
    studentId: string;
    studentName: string;
    studentAdmissionNumber: string;
    studentGrade: string;
    relationship: string;
    notes?: string;
  }) => Promise<void>;
}

const RELATIONSHIPS = [
  'Father',
  'Mother',
  'Legal Guardian',
  'Grandparent / Relative',
  'Other Authorized Guardian',
];

export const RequestChildLinkModal: React.FC<RequestChildLinkModalProps> = ({
  isOpen,
  currentUser,
  students = [],
  onClose,
  onSubmit,
}) => {
  const [admissionNumberInput, setAdmissionNumberInput] = useState('');
  const [relationship, setRelationship] = useState(RELATIONSHIPS[0]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const trimmedQuery = admissionNumberInput.trim().toUpperCase();

  // Find student matching admission number or user code
  const matchedStudent = useMemo(() => {
    if (!trimmedQuery) return null;
    return students.find((s) => {
      if (s.role !== 'student') return false;
      const cleanAdm = (s.admission_number || '').trim().toUpperCase();
      const cleanCode = (s.user_code || '').trim().toUpperCase();
      return cleanAdm === trimmedQuery || cleanCode === trimmedQuery;
    });
  }, [students, trimmedQuery]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!matchedStudent) {
      setErrorMessage('Please enter a valid student admission number registered with Woodlem Park School.');
      return;
    }

    // Check if child is already linked
    if ((currentUser.linked_student_ids || []).includes(matchedStudent.id)) {
      setErrorMessage(`${matchedStudent.name} is already linked to your parent account.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const gradeStr = matchedStudent.grade
        ? `Grade ${matchedStudent.grade.replace(/[^0-9]/g, '')}${matchedStudent.class_letter ? `-${matchedStudent.class_letter.toUpperCase()}` : ''}`
        : '';

      await onSubmit({
        studentId: matchedStudent.id,
        studentName: matchedStudent.name,
        studentAdmissionNumber: matchedStudent.admission_number || matchedStudent.user_code || trimmedQuery,
        studentGrade: gradeStr,
        relationship,
        notes: notes.trim() || undefined,
      });

      // Reset
      setAdmissionNumberInput('');
      setRelationship(RELATIONSHIPS[0]);
      setNotes('');
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit verification request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Full-Page Modal Header */}
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Link Child / Ward Account</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              Enter your child&apos;s Admission Number to request portal access.
            </p>
          </div>
          <button
            type="button"
            className="close-modal"
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px', background: 'var(--neutral-bg)' }}>
          <form
            onSubmit={handleSubmit}
            style={{
              maxWidth: 640,
              margin: '0 auto',
              background: '#FFFFFF',
              padding: '28px 32px',
              borderRadius: 12,
              border: '1px solid var(--border-color)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
            }}
          >
          {/* Security Notice */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 8,
              background: '#F0F9F7',
              border: '1px solid #C7E4D8',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              marginBottom: 18,
            }}
          >
            <ShieldCheck size={18} color="#2D6E5D" style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ fontSize: 12, color: '#20554E', margin: 0, lineHeight: 1.45 }}>
              For student safety and privacy, all linking requests are reviewed and approved by the <strong>School Administration</strong> before child data becomes visible.
            </p>
          </div>

          {/* Admission Number Input */}
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600 }}>
              Child&apos;s Admission Number <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. WPS-104921"
                value={admissionNumberInput}
                onChange={(e) => {
                  setAdmissionNumberInput(e.target.value);
                  setErrorMessage('');
                }}
                required
                style={{
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontFamily: 'monospace',
                  fontSize: 14,
                  fontWeight: 600,
                  paddingLeft: 36,
                }}
              />
              <Search
                size={16}
                color="#64748B"
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
              />
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
              Found on your child&apos;s student ID card, admission receipt, or report card.
            </p>
          </div>

          {/* Matched Student Preview Card */}
          {matchedStudent && (
            <div
              style={{
                background: '#F8FAFC',
                border: '1.5px solid #2C6E6A',
                borderRadius: 10,
                padding: '14px 16px',
                marginBottom: 18,
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: '#2C6E6A',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {matchedStudent.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                    {matchedStudent.name}
                  </span>
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      background: '#EAF3EF',
                      color: '#2D6E5D',
                      padding: '1px 6px',
                      borderRadius: 4,
                    }}
                  >
                    Verified Student
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Grade {matchedStudent.grade?.replace(/[^0-9]/g, '') || '12'}
                  {matchedStudent.class_letter ? ` — Section ${matchedStudent.class_letter.toUpperCase()}` : ''}
                  {' • '}
                  <span style={{ fontFamily: 'monospace' }}>
                    {matchedStudent.admission_number || matchedStudent.user_code}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Not matched alert if user has typed 3+ chars */}
          {!matchedStudent && trimmedQuery.length >= 3 && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                color: '#991B1B',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 18,
              }}
            >
              <AlertCircle size={15} color="#DC2626" />
              <span>No student found matching &quot;{trimmedQuery}&quot;. Please verify the admission number.</span>
            </div>
          )}

          {/* Relationship */}
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600 }}>
              Your Relationship to the Student <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <CustomSelect
              value={relationship}
              onChange={(val) => setRelationship(val)}
              options={RELATIONSHIPS}
            />
          </div>

          {/* Optional Notes */}
          <div className="form-group">
            <label className="form-label">
              Verification Notes <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>(Optional)</span>
            </label>
            <textarea
              className="form-input"
              rows={2}
              placeholder="Any additional details or contact note for the school office..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ resize: 'none', fontSize: 12.5 }}
            />
          </div>

          {errorMessage && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                color: '#B91C1C',
                fontSize: 12,
                marginBottom: 16,
              }}
            >
              {errorMessage}
            </div>
          )}

          {/* Modal Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, borderTop: '1px solid #E2E8F0', paddingTop: 18, marginTop: 22 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                padding: '10px 20px',
                borderRadius: 8,
                fontSize: 13.5,
                fontWeight: 600,
                color: '#475569',
                background: '#F1F5F9',
                border: '1px solid #CBD5E1',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !matchedStudent}
              style={{
                padding: '10px 24px',
                borderRadius: 8,
                fontSize: 13.5,
                fontWeight: 700,
                color: '#FFFFFF',
                background: matchedStudent ? 'linear-gradient(135deg, #1C4D46 0%, #2C6E6A 100%)' : '#94A3B8',
                border: 'none',
                cursor: matchedStudent && !isSubmitting ? 'pointer' : 'not-allowed',
                boxShadow: matchedStudent ? '0 4px 12px rgba(28,77,70,0.25)' : 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {isSubmitting ? 'Submitting Request...' : 'Submit Link Request'}
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
};
