'use client';

import React, { useState } from 'react';
import { UserProfile } from '@/lib/supabaseClient';
import {
  matchStudentByEmailAndAdmission,
  verifyStudentParentCode,
} from '@/lib/parentCodeHelper';
import { ShieldCheck, UserCheck, Search, KeyRound, Check, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft } from 'lucide-react';

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
  const [step, setStep] = useState<1 | 2>(1);
  const [studentEmail, setStudentEmail] = useState('');
  const [admissionNumberInput, setAdmissionNumberInput] = useState('');
  const [relationship, setRelationship] = useState(RELATIONSHIPS[0]);
  const [teacherCodeInput, setTeacherCodeInput] = useState('');
  const [matchedStudent, setMatchedStudent] = useState<UserProfile | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  // Step 1: Match student
  const handleVerifyStudent = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setMatchedStudent(null);

    const cleanEmail = studentEmail.trim().toLowerCase();
    const cleanAdm = admissionNumberInput.trim().toUpperCase();

    if (!cleanEmail || !cleanAdm) {
      setErrorMessage("Please enter both your child's school email and admission number.");
      return;
    }

    const found = matchStudentByEmailAndAdmission(cleanEmail, cleanAdm, students);
    if (!found) {
      setErrorMessage(
        `No student record found matching email "${cleanEmail}" with Admission No "${cleanAdm}". Please check your child's student ID card or contact the school office.`
      );
      return;
    }

    if ((currentUser.linked_student_ids || []).includes(found.id)) {
      setErrorMessage(`${found.name} is already linked to your parent account.`);
      return;
    }

    setMatchedStudent(found);
    setStep(2);
  };

  // Step 2: Validate code & complete instant link
  const handleCompleteLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!matchedStudent) {
      setErrorMessage('Please identify your child in Step 1 first.');
      setStep(1);
      return;
    }

    const code = teacherCodeInput.trim();
    if (!code) {
      setErrorMessage("Please enter the Parent Link Code provided by your child's Class Teacher.");
      return;
    }

    const isCodeValid = verifyStudentParentCode(matchedStudent, code);
    if (!isCodeValid) {
      setErrorMessage(
        `The code entered is incorrect for ${matchedStudent.name}. Please contact the class teacher to obtain the correct 6-digit Parent Link Code.`
      );
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
        studentAdmissionNumber: matchedStudent.admission_number || matchedStudent.user_code || admissionNumberInput.trim().toUpperCase(),
        studentGrade: gradeStr,
        relationship,
        notes: 'Verified via Class Teacher Parent Link Code',
      });

      // Reset
      setStep(1);
      setStudentEmail('');
      setAdmissionNumberInput('');
      setTeacherCodeInput('');
      setMatchedStudent(null);
      setRelationship(RELATIONSHIPS[0]);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to link child account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseModal = () => {
    setStep(1);
    setErrorMessage('');
    setMatchedStudent(null);
    setTeacherCodeInput('');
    onClose();
  };

  return (
    <div className="modal-overlay active" onClick={handleCloseModal}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Link Child / Ward Account</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              {step === 1
                ? "Enter your child's school email and admission number."
                : "Enter the Class Teacher verification code to activate portal access."}
            </p>
          </div>
          <button type="button" className="close-modal" onClick={handleCloseModal}>
            &times;
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px', background: 'var(--neutral-bg)' }}>
          <div
            style={{
              maxWidth: 580,
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
                marginBottom: 20,
              }}
            >
              <ShieldCheck size={18} color="#2D6E5D" style={{ flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontSize: 12, color: '#20554E', margin: 0, lineHeight: 1.45 }}>
                For student security and privacy, you will need the <strong>6-digit Parent Link Code</strong> provided by your child&apos;s Class Teacher via WhatsApp or school communications.
              </p>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  color: '#B91C1C',
                  fontSize: 12.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 18,
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* STEP 1: Student Lookup */}
            {step === 1 && (
              <form onSubmit={handleVerifyStudent}>
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    Child&apos;s School Email <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="e.g. ayaan.khan@woodlempark.ae"
                    value={studentEmail}
                    onChange={(e) => {
                      setStudentEmail(e.target.value);
                      if (errorMessage) setErrorMessage('');
                    }}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 16 }}>
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
                        if (errorMessage) setErrorMessage('');
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
                    Found on your child&apos;s student ID card, fee receipt, or report card.
                  </p>
                </div>

                <div className="form-group" style={{ marginBottom: 24 }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    Your Relationship to Student
                  </label>
                  <select
                    className="form-input"
                    value={relationship}
                    onChange={(e) => setRelationship(e.target.value)}
                  >
                    {RELATIONSHIPS.map((rel) => (
                      <option key={rel} value={rel}>
                        {rel}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    fontSize: 14,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    background: '#2D6E5D',
                    border: 'none',
                    borderRadius: 8,
                    color: '#ffffff',
                    cursor: 'pointer',
                  }}
                >
                  Verify Student Record <ArrowRight size={16} />
                </button>
              </form>
            )}

            {/* STEP 2: Teacher Code */}
            {step === 2 && matchedStudent && (
              <form onSubmit={handleCompleteLink}>
                {/* Matched student preview card */}
                <div
                  style={{
                    background: '#F0F9F7',
                    border: '1.5px solid #2D6E5D',
                    borderRadius: 10,
                    padding: '14px 16px',
                    marginBottom: 20,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      background: '#2D6E5D',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: 16,
                      flexShrink: 0,
                    }}
                  >
                    {matchedStudent.name.charAt(0)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 700, color: 'var(--neutral-dark)', fontSize: 14 }}>
                        {matchedStudent.name}
                      </span>
                      <CheckCircle2 size={16} color="#2D6E5D" />
                    </div>
                    <div style={{ fontSize: 12, color: '#20554E', marginTop: 2 }}>
                      {matchedStudent.grade || 'Grade 12'} · Section {matchedStudent.class_letter || 'A'} ·{' '}
                      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                        {matchedStudent.admission_number || matchedStudent.user_code}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 20 }}>
                  <label className="form-label" style={{ fontWeight: 600, textAlign: 'center' }}>
                    Enter Class Teacher Parent Link Code <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input parent-code-input"
                    placeholder="e.g. PL-748921"
                    value={teacherCodeInput}
                    onChange={(e) => {
                      setTeacherCodeInput(e.target.value);
                      if (errorMessage) setErrorMessage('');
                    }}
                    required
                    autoFocus
                  />
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center', margin: '6px 0 0' }}>
                    Enter the 6-digit code received from your child&apos;s Class Teacher on WhatsApp.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !teacherCodeInput.trim()}
                  className="btn btn-primary"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    fontSize: 14,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    background: '#2D6E5D',
                    border: 'none',
                    borderRadius: 8,
                    color: '#ffffff',
                    cursor: 'pointer',
                  }}
                >
                  {isSubmitting ? (
                    'Linking Child Account…'
                  ) : (
                    <>
                      <ShieldCheck size={16} /> Verify Code &amp; Link Child
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setStep(1)}
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    marginTop: 12,
                  }}
                >
                  <ArrowLeft size={14} /> Back to Student Details
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
