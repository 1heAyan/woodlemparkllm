'use client';

import React, { useState, useRef } from 'react';
import { AssignmentItem } from '@/lib/supabaseClient';

interface SubmitAssignmentModalProps {
  isOpen: boolean;
  assignment: AssignmentItem | null;
  onClose: () => void;
  onSubmit: (assignmentId: string, fileName: string, notes?: string) => void;
}

export const SubmitAssignmentModal: React.FC<SubmitAssignmentModalProps> = ({
  isOpen,
  assignment,
  onClose,
  onSubmit,
}) => {
  const [notes, setNotes] = useState('');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || !assignment) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAttachedFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setAttachedFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fileName = attachedFile ? attachedFile.name : 'Completed_Assignment.pdf';
    onSubmit(assignment.id, fileName, notes.trim());
    setNotes('');
    setAttachedFile(null);
    onClose();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#2C6E6A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Assignment Submission
            </span>
            <h2 className="modal-title" style={{ marginTop: 2 }}>{assignment.title}</h2>
          </div>
          <button type="button" className="close-modal" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Submission Document / Homework File</label>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.zip"
              onChange={handleFileChange}
            />

            {!attachedFile ? (
              <div
                className="file-drop"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                style={{
                  border: isDragging ? '1.5px dashed #2C6E6A' : '1px dashed var(--border-color)',
                  background: isDragging ? '#F0F6F5' : 'var(--neutral-bg)',
                  padding: '24px 16px',
                  borderRadius: 8,
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--neutral-dark)' }}>
                  Click to select file or drag &amp; drop here
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                  Supports PDF, Word Documents, JPG/PNG scans, or ZIP archives
                </div>
              </div>
            ) : (
              <div
                style={{
                  border: '1px solid #CBE2DF',
                  background: '#F2F7F6',
                  borderRadius: 8,
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 6,
                      background: '#2C6E6A',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    PDF
                  </div>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--neutral-dark)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {attachedFile.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      {formatFileSize(attachedFile.size)} · Ready to submit
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      padding: '4px 8px',
                      fontSize: 11,
                      fontWeight: 600,
                      background: '#FFFFFF',
                      border: '1px solid var(--border-color)',
                      borderRadius: 4,
                      cursor: 'pointer',
                    }}
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAttachedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    style={{
                      padding: '4px 8px',
                      fontSize: 11,
                      fontWeight: 600,
                      background: '#FDF1F0',
                      border: '1px solid #F5C6CB',
                      color: '#A83B38',
                      borderRadius: 4,
                      cursor: 'pointer',
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label">Student Remarks / Notes for Teacher (Optional)</label>
            <textarea
              className="form-input"
              placeholder="e.g. Please find my complete problem set solutions attached. Questions 4 & 5 include full workings."
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <button type="submit" className="btn-primary" style={{ width: '100%', padding: 14 }}>
            Submit Assignment to Teacher
          </button>
        </form>
      </div>
    </div>
  );
};
