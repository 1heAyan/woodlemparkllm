'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Achievement } from '@/lib/supabaseClient';

interface EditAchievementModalProps {
  isOpen: boolean;
  achievement: Achievement | null;
  onClose: () => void;
  onSubmit: (id: string, title: string, desc: string, fileName?: string, fileDataUrl?: string) => void;
}

export const EditAchievementModal: React.FC<EditAchievementModalProps> = ({
  isOpen,
  achievement,
  onClose,
  onSubmit,
}) => {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [fileName, setFileName] = useState('');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (achievement) {
      setTitle(achievement.title || '');
      setDesc(achievement.description || '');
      setFileName(achievement.file_name || '');
      setAttachedFile(null);
    }
  }, [achievement]);

  if (!isOpen || !achievement) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAttachedFile(e.target.files[0]);
      setFileName(e.target.files[0].name);
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
      setFileName(e.dataTransfer.files[0].name);
    }
  };

  const handleRemoveFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAttachedFile(null);
    setFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (attachedFile) {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        onSubmit(achievement.id, title.trim(), desc.trim(), attachedFile.name, dataUrl);
        onClose();
      };
      reader.onerror = () => {
        onSubmit(achievement.id, title.trim(), desc.trim(), attachedFile.name, undefined);
        onClose();
      };
      reader.readAsDataURL(attachedFile);
    } else {
      onSubmit(achievement.id, title.trim(), desc.trim(), fileName || undefined, achievement.file_url);
      onClose();
    }
  };

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#2C6E6A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Modify Record
            </span>
            <h2 className="modal-title" style={{ marginTop: 2 }}>Edit Achievement</h2>
          </div>
          <button type="button" className="close-modal" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Award / Distinction Title</label>
            <input
              type="text"
              className="form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Details / Description</label>
            <textarea
              className="form-input"
              rows={3}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 24 }}>
            <label className="form-label">Attached Certificate / Proof</label>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={handleFileChange}
            />

            {!fileName && !attachedFile ? (
              <div
                className="file-drop"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                style={{
                  border: isDragging ? '1.5px dashed #2C6E6A' : '1px dashed var(--border-color)',
                  background: isDragging ? '#F0F6F5' : 'var(--neutral-bg)',
                  padding: '20px 16px',
                  borderRadius: 8,
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--neutral-dark)' }}>
                  Click to upload new certificate proof
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>
                  PDF, JPEG, PNG, or Word documents
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
                    DOC
                  </div>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--neutral-dark)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {attachedFile ? attachedFile.name : fileName}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      {attachedFile ? 'Newly chosen file' : 'Current attached certificate'}
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
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
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

          <button type="submit" className="btn-primary" style={{ width: '100%', padding: 14 }}>
            Save Changes
          </button>
        </form>
      </div>
    </div>
  );
};
