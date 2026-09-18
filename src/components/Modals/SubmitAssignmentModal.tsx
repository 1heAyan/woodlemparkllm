'use client';

import React, { useState, useRef } from 'react';
import { AssignmentItem } from '@/lib/supabaseClient';
import { Upload, FileText, Image as ImageIcon, X, ExternalLink, HelpCircle } from 'lucide-react';
import { openFileInNewTab } from '@/lib/fileHelper';

interface SubmitAssignmentModalProps {
  isOpen: boolean;
  assignment: AssignmentItem | null;
  onClose: () => void;
  onSubmit: (assignmentId: string, fileName?: string, fileUrl?: string, textAnswer?: string, notes?: string) => void;
}

export const SubmitAssignmentModal: React.FC<SubmitAssignmentModalProps> = ({
  isOpen,
  assignment,
  onClose,
  onSubmit,
}) => {
  const [textAnswer, setTextAnswer] = useState('');
  const [attachedFile, setAttachedFile] = useState<{ name: string; size: number; dataUrl: string; type: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || !assignment) return null;

  const processFile = (file: File) => {
    // Validate file types: PDF, PNG, JPG, JPEG, DOC, DOCX
    const validExtensions = /\.(pdf|png|jpg|jpeg|webp|doc|docx|zip)$/i;

    if (!validExtensions.test(file.name) && !file.type.startsWith('image/') && file.type !== 'application/pdf') {
      alert('Please upload a valid PDF document or Image (PNG, JPG, JPEG).');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      alert('File size exceeds 15 MB limit. Please select a smaller file.');
      return;
    }

    setIsProcessingFile(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setAttachedFile({
        name: file.name,
        size: file.size,
        dataUrl,
        type: file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
      });
      setIsProcessingFile(false);
    };
    reader.onerror = () => {
      alert('Failed to read file. Please try again.');
      setIsProcessingFile(false);
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
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
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanText = textAnswer.trim();
    if (!cleanText && !attachedFile) {
      alert('Please either write a text answer or attach a submission document (PDF/Image) before submitting.');
      return;
    }

    const fileName = attachedFile ? attachedFile.name : (cleanText ? 'Written_Answer.txt' : 'Submission.pdf');
    onSubmit(assignment.id, fileName, attachedFile?.dataUrl, cleanText, cleanText);
    setTextAnswer('');
    setAttachedFile(null);
    onClose();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isPdf = attachedFile?.type === 'application/pdf' || attachedFile?.name.toLowerCase().endsWith('.pdf');

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#2C6E6A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Assignment Submission
              </span>
              {assignment.total_marks && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: '#FEF7EC', color: '#B37D4A', border: '1px solid #F5DEB3' }}>
                  {assignment.total_marks} Marks
                </span>
              )}
            </div>
            <h2 className="modal-title" style={{ margin: '2px 0 0' }}>{assignment.title}</h2>
          </div>
          <button type="button" className="close-modal" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} style={{ maxWidth: 720, width: '100%', margin: '0 auto', padding: '32px 36px 64px', overflowY: 'auto', flex: 1, boxSizing: 'border-box' }}>
          {/* Teacher Instructions & Attached Material Card */}
          {(assignment.description || assignment.file_name) && (
            <div
              style={{
                marginBottom: 18,
                padding: '16px 18px',
                background: '#FFFFFF',
                border: '1px solid var(--border-color)',
                borderRadius: 12,
                fontSize: 13,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
              }}
            >
              {assignment.description && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>
                    Teacher Instructions
                  </div>
                  <div style={{ color: 'var(--neutral-dark)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                    {assignment.description}
                  </div>
                </div>
              )}

              {assignment.file_name && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: assignment.description ? '1px solid #ECEAE5' : 'none', paddingTop: assignment.description ? 10 : 0 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Reference Material:</span>
                  <button
                    type="button"
                    onClick={() =>
                      openFileInNewTab({
                        fileName: assignment.file_name || 'Assignment_Material.pdf',
                        fileUrl: assignment.file_url,
                        title: assignment.title,
                        description: assignment.description,
                      })
                    }
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '5px 12px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      background: '#EAF3EF',
                      color: '#2D6E5D',
                      border: '1px solid #C7E4D8',
                      cursor: 'pointer',
                    }}
                    title="Open reference document in new tab"
                  >
                    <ExternalLink size={13} />
                    <span>View Assignment Document ({assignment.file_name})</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Option 1: Written Text Solution Card */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid var(--border-color)',
              borderRadius: 12,
              padding: '20px 22px',
              marginBottom: 16,
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            }}
          >
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
                <span>Written Answers / Text Solution</span>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 400 }}>Type directly or paste answers</span>
              </label>
              <textarea
                className="form-input"
                placeholder="Type your solutions, answers, code, mathematical workings, or notes for the teacher here..."
                rows={4}
                value={textAnswer}
                onChange={(e) => setTextAnswer(e.target.value)}
                style={{ fontSize: 13, lineHeight: 1.5, resize: 'vertical' }}
              />
            </div>
          </div>

          {/* Option 2: Upload Document File Card */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid var(--border-color)',
              borderRadius: 12,
              padding: '20px 22px',
              marginBottom: 20,
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            }}
          >
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: 12, display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span>Upload Homework Document / Scans</span>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 400 }}>PDF, PNG, JPG (Max 15MB)</span>
              </label>

              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,application/pdf,image/*"
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
                    border: isDragging ? '2px dashed #2C6E6A' : '1.5px dashed var(--border-color)',
                    background: isDragging ? '#F0F6F5' : '#FAF9F6',
                    padding: '24px 20px',
                    borderRadius: 10,
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: '#EAF3EF',
                      color: '#2C6E6A',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Upload size={18} />
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--neutral-dark)' }}>
                    {isProcessingFile ? 'Processing file...' : 'Click to select submission file or drag & drop here'}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                    Supports PDF documents, scanned homework pages (JPG, PNG), or Word files
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    border: '1px solid #CBE2DF',
                    background: '#F2F7F6',
                    borderRadius: 8,
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 8,
                        background: isPdf ? '#E11D48' : '#2C6E6A',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11.5,
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      {isPdf ? <FileText size={18} /> : <ImageIcon size={18} />}
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: 'var(--neutral-dark)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: 380,
                        }}
                        title={attachedFile.name}
                      >
                        {attachedFile.name}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {formatFileSize(attachedFile.size)} · Ready to submit
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        padding: '5px 10px',
                        fontSize: 11.5,
                        fontWeight: 600,
                        background: '#FFFFFF',
                        border: '1px solid var(--border-color)',
                        borderRadius: 6,
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
                        padding: '5px 10px',
                        fontSize: 11.5,
                        fontWeight: 600,
                        background: '#FDF1F0',
                        border: '1px solid #F5C6CB',
                        color: '#A83B38',
                        borderRadius: 6,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <X size={13} /> Remove
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6, padding: '0 4px' }}>
            <HelpCircle size={14} style={{ color: '#2C6E6A', flexShrink: 0 }} />
            <span>You can submit text answers, an attached document (PDF/Images), or both together.</span>
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={isProcessingFile || (!textAnswer.trim() && !attachedFile)}
            style={{
              width: '100%',
              padding: 14,
              fontSize: 14,
              fontWeight: 700,
              cursor: isProcessingFile || (!textAnswer.trim() && !attachedFile) ? 'not-allowed' : 'pointer',
              opacity: isProcessingFile || (!textAnswer.trim() && !attachedFile) ? 0.6 : 1,
              borderRadius: 8,
            }}
          >
            Submit Homework to Teacher
          </button>
        </form>
      </div>
    </div>
  );
};

