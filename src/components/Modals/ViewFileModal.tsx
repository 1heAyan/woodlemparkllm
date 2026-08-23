'use client';

import React from 'react';
import { openFileInNewTab, downloadFile } from '@/lib/fileHelper';

export interface ViewFileModalProps {
  isOpen: boolean;
  fileName: string;
  fileUrl?: string;
  studentName?: string;
  title?: string;
  description?: string;
  submissionDate?: string;
  fileType?: string;
  onClose: () => void;
}

export const ViewFileModal: React.FC<ViewFileModalProps> = ({
  isOpen,
  fileName,
  fileUrl,
  studentName,
  title,
  description,
  submissionDate,
  onClose,
}) => {
  if (!isOpen || !fileName) return null;

  const isImage = fileUrl?.startsWith('data:image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(fileName);
  const isPdf = fileUrl?.startsWith('data:application/pdf') || /\.pdf$/i.test(fileName);

  const handleOpenNewTab = () => {
    openFileInNewTab({
      fileName,
      fileUrl,
      studentName,
      title,
      description,
      submissionDate,
    });
  };

  const handleDownload = () => {
    downloadFile({
      fileName,
      fileUrl,
      studentName,
      title,
      description,
      submissionDate,
    });
  };

  return (
    <div
      className="modal-overlay active"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 100000,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        className="modal-content"
        style={{
          maxWidth: 520,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          borderRadius: 14,
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.3)',
          background: '#FFFFFF',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color, #E5E3DF)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#FAF9F6',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, overflow: 'hidden' }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                background: '#2C6E6A',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 800,
                flexShrink: 0,
                letterSpacing: '0.04em',
              }}
            >
              {isImage ? 'IMG' : isPdf ? 'PDF' : 'DOC'}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <h3
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  margin: 0,
                  color: 'var(--neutral-dark, #2D2C2A)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={fileName}
              >
                {fileName}
              </h3>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary, #73716D)', marginTop: 2 }}>
                {studentName ? `Submitted by ${studentName}` : 'Attached Document Proof'}
                {submissionDate ? ` · ${submissionDate}` : ''}
              </div>
            </div>
          </div>

          <button
            type="button"
            className="close-modal"
            onClick={onClose}
            style={{
              padding: '4px 10px',
              fontSize: 20,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              lineHeight: 1,
              color: '#94A3B8',
            }}
          >
            &times;
          </button>
        </div>

        {/* Action Body (Mobile-Optimized) */}
        <div style={{ padding: '24px 20px', background: '#FFFFFF', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Direct Action Buttons: Touch-friendly */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <button
              type="button"
              onClick={handleOpenNewTab}
              style={{
                padding: '12px 16px',
                fontSize: 13,
                fontWeight: 700,
                background: '#2C6E6A',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 2px 8px rgba(44, 110, 106, 0.25)',
                transition: 'all 0.15s ease',
              }}
            >
              <span>↗</span> Open in New Tab
            </button>

            <button
              type="button"
              onClick={handleDownload}
              style={{
                padding: '12px 16px',
                fontSize: 13,
                fontWeight: 700,
                background: '#FAF9F6',
                color: '#2D2C2A',
                border: '1px solid var(--border-color, #E5E3DF)',
                borderRadius: 8,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'all 0.15s ease',
              }}
            >
              <span>↓</span> Download File
            </button>
          </div>

          {/* Metadata Card */}
          <div
            style={{
              background: '#FAF9F6',
              border: '1px solid var(--border-color, #E5E3DF)',
              borderRadius: 8,
              padding: '14px 16px',
              fontSize: 12.5,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {title && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary, #73716D)' }}>Category / Title:</span>
                <strong style={{ color: 'var(--neutral-dark, #2D2C2A)' }}>{title}</strong>
              </div>
            )}
            {studentName && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary, #73716D)' }}>Student:</span>
                <strong style={{ color: 'var(--neutral-dark, #2D2C2A)' }}>{studentName}</strong>
              </div>
            )}
            {submissionDate && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary, #73716D)' }}>Date Recorded:</span>
                <strong style={{ color: 'var(--neutral-dark, #2D2C2A)' }}>{submissionDate}</strong>
              </div>
            )}
            {description && (
              <div style={{ marginTop: 4, paddingTop: 8, borderTop: '1px solid #ECEAE5' }}>
                <span style={{ color: 'var(--text-secondary, #73716D)', display: 'block', marginBottom: 4, fontWeight: 600 }}>
                  Description / Remarks:
                </span>
                <div style={{ color: 'var(--neutral-dark, #2D2C2A)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {description}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border-color, #E5E3DF)',
            background: '#FAF9F6',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            style={{ padding: '8px 20px', fontSize: 12.5 }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
