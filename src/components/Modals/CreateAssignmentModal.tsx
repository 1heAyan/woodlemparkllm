'use client';

import React, { useState, useEffect, useRef } from 'react';
import { CustomSelect } from '@/components/UI/CustomSelect';
import { Upload, FileText, Image as ImageIcon, X } from 'lucide-react';

const ALL_SECTIONS = [
  '9-A', '9-B', '9-C', '9-D',
  '10-A', '10-B', '10-C', '10-D',
  '11-A', '11-B', '11-C', '11-D',
  '12-A', '12-B', '12-C', '12-D',
  'All Classes',
] as const;

export interface CreateAssignmentData {
  title: string;
  className?: string;
  type?: 'assignment' | 'assessment';
  description?: string;
  totalMarks?: number;
  fileName?: string;
  fileUrl?: string;
  dueDate?: string;
}

interface CreateAssignmentModalProps {
  isOpen: boolean;
  activeClass?: string;
  onClose: () => void;
  onSubmit: (data: CreateAssignmentData) => void;
  onSwitchToTestModal?: (activeClass?: string) => void;
}

export const CreateAssignmentModal: React.FC<CreateAssignmentModalProps> = ({
  isOpen,
  activeClass = '',
  onClose,
  onSubmit,
  onSwitchToTestModal,
}) => {
  const [title, setTitle] = useState('');
  const [taskType, setTaskType] = useState<'assignment' | 'assessment'>('assignment');
  const [selectedClass, setSelectedClass] = useState(activeClass);
  const [description, setDescription] = useState('');
  const [totalMarksInput, setTotalMarksInput] = useState('25');
  const [attachedFile, setAttachedFile] = useState<{ name: string; size: number; dataUrl: string; type: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSelectedClass(activeClass || '');
  }, [activeClass, isOpen]);

  if (!isOpen) return null;

  const handleSelectTaskType = (type: 'assignment' | 'assessment') => {
    if (type === 'assessment') {
      onClose();
      if (onSwitchToTestModal) {
        onSwitchToTestModal(activeClass || selectedClass);
      }
      return;
    }
    setTaskType('assignment');
  };

  const processFile = (file: File) => {
    // Validate file type: PDF, PNG, JPG, JPEG
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    const validExtensions = /\.(pdf|png|jpg|jpeg|webp)$/i;

    if (!validTypes.includes(file.type) && !validExtensions.test(file.name)) {
      alert('Please upload a valid PDF document or Image (PNG, JPG, JPEG).');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      alert('File size exceeds 15 MB limit. Please select a smaller document.');
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
      alert('Failed to read document file. Please try again.');
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

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Please provide an assignment title.');
      return;
    }

    const parsedMarks = totalMarksInput.trim() ? parseInt(totalMarksInput.trim(), 10) : undefined;
    if (parsedMarks !== undefined && (isNaN(parsedMarks) || parsedMarks <= 0)) {
      alert('Please enter a valid positive number for Total Marks.');
      return;
    }

    onSubmit({
      title: title.trim(),
      className: activeClass || selectedClass,
      type: taskType,
      description: description.trim() || undefined,
      totalMarks: parsedMarks || 25,
      fileName: attachedFile?.name,
      fileUrl: attachedFile?.dataUrl,
    });

    // Reset fields
    setTitle('');
    setDescription('');
    setTotalMarksInput('25');
    setAttachedFile(null);
    onClose();
  };

  const isPdf = attachedFile?.type === 'application/pdf' || attachedFile?.name.toLowerCase().endsWith('.pdf');

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#2C6E6A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Classwork &amp; Coursework
            </span>
            <h2 className="modal-title" style={{ margin: '2px 0 0' }}>Create Homework Assignment</h2>
            {activeClass && (
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                Publishing for classroom: <strong>{activeClass}</strong>
              </p>
            )}
          </div>
          <button type="button" className="close-modal" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} style={{ maxWidth: 740, width: '100%', margin: '0 auto', padding: '32px 36px 64px', overflowY: 'auto', flex: 1, boxSizing: 'border-box' }}>
          {/* Card 1: Task Type & Classroom Scope */}
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
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Task Type</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => handleSelectTaskType('assignment')}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: taskType === 'assignment' ? '1.5px solid #2D2C2A' : '1px solid var(--border-color)',
                    background: taskType === 'assignment' ? '#2D2C2A' : '#FFFFFF',
                    color: taskType === 'assignment' ? '#FFFFFF' : 'var(--neutral-dark)',
                    fontWeight: taskType === 'assignment' ? 700 : 500,
                    fontSize: 12.5,
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Homework Assignment
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectTaskType('assessment')}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: '1px solid var(--border-color)',
                    background: '#FFFFFF',
                    color: 'var(--neutral-dark)',
                    fontWeight: 500,
                    fontSize: 12.5,
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Class Test ↗
                </button>
              </div>
            </div>

            {activeClass ? (
              <div
                style={{
                  padding: '11px 14px',
                  background: '#F8F7F4',
                  border: '1px solid var(--border-color)',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Target Classroom
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#2C6E6A', background: '#EAF3EF', padding: '3px 10px', borderRadius: 4, border: '1px solid #C7E4D8' }}>
                  {activeClass}
                </span>
              </div>
            ) : (
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Target Class / Section</label>
                <CustomSelect
                  value={selectedClass}
                  onChange={(val) => setSelectedClass(val)}
                  options={ALL_SECTIONS.map((sec) => ({
                    value: sec,
                    label: sec === 'All Classes' ? 'All Classes & Grades' : `Grade Section ${sec}`,
                  }))}
                />
              </div>
            )}
          </div>

          {/* Card 2: Assignment Title & Total Marks */}
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 14 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                  Assignment Title <span style={{ color: '#E11D48' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Chapter 4: Circuit Diagrams & Problem Set"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  autoFocus
                  style={{ fontSize: 13 }}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                  Total Marks
                </label>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  className="form-input"
                  placeholder="25"
                  value={totalMarksInput}
                  onChange={(e) => setTotalMarksInput(e.target.value)}
                  style={{ fontSize: 13, textAlign: 'center', fontWeight: 700 }}
                />
              </div>
            </div>
          </div>

          {/* Card 3: Description & Homework Instructions */}
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
                <span>Description &amp; Homework Instructions</span>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 400 }}>Optional</span>
              </label>
              <textarea
                className="form-input"
                placeholder="e.g. Complete questions 1 through 10 from the attached worksheet. Show all calculation steps, units, and circuit schematics clearly."
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ fontSize: 13, lineHeight: 1.5, resize: 'vertical' }}
              />
            </div>
          </div>

          {/* Card 4: Document Upload (PDF, PNG, JPG) */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid var(--border-color)',
              borderRadius: 12,
              padding: '20px 22px',
              marginBottom: 24,
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            }}
          >
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: 12, display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span>Attach Homework Document / Worksheet</span>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 400 }}>PDF, PNG, JPG (Max 15MB)</span>
              </label>

              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*"
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
                    padding: '26px 20px',
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
                      width: 42,
                      height: 42,
                      borderRadius: '50%',
                      background: '#EAF3EF',
                      color: '#2C6E6A',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Upload size={20} />
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--neutral-dark)' }}>
                    {isProcessingFile ? 'Processing document...' : 'Click to upload document or drag & drop here'}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                    Supports PDF worksheets, assignment question papers, or problem scan images (PNG, JPG)
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
                        width: 40,
                        height: 40,
                        borderRadius: 8,
                        background: isPdf ? '#E11D48' : '#2C6E6A',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      {isPdf ? <FileText size={20} /> : <ImageIcon size={20} />}
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
                        {formatFileSize(attachedFile.size)} · {isPdf ? 'PDF Document' : 'Image File'} · Ready to attach
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

          {/* Card 5: Submit Coursework Button */}
          <button
            type="submit"
            className="btn-primary"
            disabled={isProcessingFile || !title.trim()}
            style={{
              width: '100%',
              padding: 14,
              fontSize: 14,
              fontWeight: 700,
              cursor: isProcessingFile || !title.trim() ? 'not-allowed' : 'pointer',
              opacity: isProcessingFile || !title.trim() ? 0.7 : 1,
              borderRadius: 8,
            }}
          >
            {taskType === 'assignment' ? 'Assign Coursework' : 'Publish Assessment'}
          </button>
        </form>
      </div>
    </div>
  );
};

