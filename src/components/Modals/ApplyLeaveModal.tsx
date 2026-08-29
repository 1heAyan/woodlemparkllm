'use client';

import React, { useState, useRef, useEffect } from 'react';
import { CustomSelect } from '@/components/UI/CustomSelect';
import { FileText, Paperclip, X } from 'lucide-react';
import { LeaveRequest } from '@/lib/supabaseClient';

interface ApplyLeaveModalProps {
  isOpen: boolean;
  studentName?: string;
  studentGrade?: string;
  initialLeave?: LeaveRequest | null;
  onClose: () => void;
  onSubmit: (leaveData: {
    id?: string;
    startDate: string;
    endDate: string;
    reason: string;
    leaveType: string;
    fileName?: string;
    fileUrl?: string;
  }) => void;
}

const LEAVE_TYPES = [
  'Sick Leave / Medical Appointment',
  'Family Emergency / Urgent Personal',
  'Official School / Olympiad Duty',
  'Religious Observance',
  'Other Authorized Reason',
];

export const ApplyLeaveModal: React.FC<ApplyLeaveModalProps> = ({
  isOpen,
  studentName,
  studentGrade,
  initialLeave,
  onClose,
  onSubmit,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [leaveType, setLeaveType] = useState(LEAVE_TYPES[0]);
  const [reason, setReason] = useState('');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [existingFileName, setExistingFileName] = useState<string>('');
  const [existingFileUrl, setExistingFileUrl] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialLeave) {
        setStartDate(initialLeave.startDate || todayStr);
        setEndDate(initialLeave.endDate || initialLeave.startDate || todayStr);
        setLeaveType(initialLeave.leaveType || LEAVE_TYPES[0]);
        setReason(initialLeave.reason || '');
        setExistingFileName(initialLeave.fileName || '');
        setExistingFileUrl(initialLeave.fileUrl || '');
        setAttachedFile(null);
      } else {
        setStartDate(todayStr);
        setEndDate(todayStr);
        setLeaveType(LEAVE_TYPES[0]);
        setReason('');
        setExistingFileName('');
        setExistingFileUrl('');
        setAttachedFile(null);
      }
    }
  }, [isOpen, initialLeave, todayStr]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAttachedFile(e.target.files[0]);
      setExistingFileName('');
      setExistingFileUrl('');
    }
  };

  const handleRemoveFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAttachedFile(null);
    setExistingFileName('');
    setExistingFileUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate) {
      alert('Please select a start date.');
      return;
    }
    if (!reason.trim()) {
      alert('Please provide a reason for the leave of absence.');
      return;
    }

    const finalEndDate = endDate && endDate >= startDate ? endDate : startDate;

    if (attachedFile) {
      setIsProcessing(true);
      const reader = new FileReader();
      reader.onload = () => {
        setIsProcessing(false);
        const dataUrl = reader.result as string;
        onSubmit({
          id: initialLeave?.id,
          startDate,
          endDate: finalEndDate,
          leaveType,
          reason: reason.trim(),
          fileName: attachedFile.name,
          fileUrl: dataUrl,
        });
        resetAndClose();
      };
      reader.onerror = () => {
        setIsProcessing(false);
        onSubmit({
          id: initialLeave?.id,
          startDate,
          endDate: finalEndDate,
          leaveType,
          reason: reason.trim(),
          fileName: attachedFile.name,
        });
        resetAndClose();
      };
      reader.readAsDataURL(attachedFile);
    } else {
      onSubmit({
        id: initialLeave?.id,
        startDate,
        endDate: finalEndDate,
        leaveType,
        reason: reason.trim(),
        fileName: existingFileName || undefined,
        fileUrl: existingFileUrl || undefined,
      });
      resetAndClose();
    }
  };

  const resetAndClose = () => {
    setStartDate(todayStr);
    setEndDate(todayStr);
    setLeaveType(LEAVE_TYPES[0]);
    setReason('');
    setAttachedFile(null);
    setExistingFileName('');
    setExistingFileUrl('');
    onClose();
  };

  const isEditing = !!initialLeave;

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: '#2C6E6A', letterSpacing: '0.06em' }}>
              ATTENDANCE &amp; ABSENCE MANAGEMENT
            </span>
            <h2 className="modal-title" style={{ margin: '2px 0 0' }}>
              {isEditing ? 'Edit Permit Leave (PL) Request' : 'Apply for Permit Leave (PL) / Sick Note'}
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
              Pre-declare planned absence or medical sick note. Once your homeroom class teacher reviews and approves your request, it will be officially recorded as <strong>Permit Leave (PL)</strong>.
            </p>
          </div>
          <button type="button" className="close-modal" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Leave Type */}
          <div className="form-group">
            <label className="form-label">
              Absence Category / Leave Type <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <CustomSelect
              value={leaveType}
              onChange={(val) => setLeaveType(val)}
              options={LEAVE_TYPES}
            />
          </div>

          {/* Dates Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">
                From Date <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="date"
                className="form-input"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (endDate < e.target.value) {
                    setEndDate(e.target.value);
                  }
                }}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                To Date (Inclusive) <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="date"
                className="form-input"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Reason */}
          <div className="form-group">
            <label className="form-label">
              Reason / Explanation <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <textarea
              className="form-input"
              rows={3}
              placeholder="e.g. Diagnosed with acute viral fever. Doctor advised 2 days of bed rest and medication..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              style={{ fontSize: 12.5, lineHeight: 1.5, resize: 'vertical' }}
            />
          </div>

          {/* Attachment (Doctor Note / Medical Slip / Parent Note) */}
          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Attach Medical Certificate / Supporting Note (Optional)</span>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 400 }}>PDF, PNG, JPG up to 10MB</span>
            </label>

            {attachedFile ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: '#EAF3EF',
                  border: '1.5px solid #C7E4D8',
                  borderRadius: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <FileText size={20} style={{ color: '#2C6E6A', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#20554E' }}>
                      {attachedFile.name}
                    </div>
                    <div style={{ fontSize: 11, color: '#2C6E6A' }}>
                      {(attachedFile.size / 1024).toFixed(1)} KB · Ready to submit
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #F5C6CB',
                    color: '#A83B38',
                    padding: '4px 8px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Remove
                </button>
              </div>
            ) : existingFileName ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: '#F0F9FF',
                  border: '1.5px solid #BAE6FD',
                  borderRadius: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <FileText size={20} style={{ color: '#0369A1', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0C4A6E' }}>
                      {existingFileName}
                    </div>
                    <div style={{ fontSize: 11, color: '#0369A1' }}>Attached File</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #BAE6FD',
                      color: '#0369A1',
                      padding: '4px 8px',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #F5C6CB',
                      color: '#A83B38',
                      padding: '4px 8px',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Remove
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed var(--border-color)',
                  borderRadius: 8,
                  padding: '18px 20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: '#FAF9F6',
                  transition: 'border-color 0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                <Paperclip size={20} style={{ color: 'var(--text-secondary)', marginBottom: 2 }} />
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--neutral-dark)' }}>
                  Click to upload Doctor&apos;s Prescription or Medical Note
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Supports PDF or high-resolution photos
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, borderTop: '1px solid #E2E8F0', paddingTop: 18, marginTop: 22 }}>
            <button
              type="button"
              onClick={onClose}
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
              disabled={isProcessing}
              style={{
                padding: '10px 24px',
                borderRadius: 8,
                fontSize: 13.5,
                fontWeight: 700,
                color: '#FFFFFF',
                background: 'linear-gradient(135deg, #1C4D46 0%, #2C6E6A 100%)',
                border: 'none',
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(28,77,70,0.25)',
              }}
            >
              {isProcessing ? 'Saving...' : isEditing ? 'Save Changes' : 'Submit Permit Leave Request ↗'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
