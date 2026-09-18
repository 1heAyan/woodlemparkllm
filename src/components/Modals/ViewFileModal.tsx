'use client';

import React from 'react';
import { openFileInNewTab, downloadFile } from '@/lib/fileHelper';
import { X, ExternalLink, Download, FileText, Image as ImageIcon } from 'lucide-react';

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
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className="dialog-card"
        style={{ maxWidth: 540 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="dialog-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, overflow: 'hidden' }}>
            <div
              style={{
                width: 38,
                height: 38,
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
              {isImage ? <ImageIcon size={18} /> : isPdf ? <FileText size={18} /> : 'DOC'}
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
                  maxWidth: 380,
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
            className="dialog-close-btn"
            onClick={onClose}
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Action Body */}
        <div className="dialog-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Direct Action Buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button
              type="button"
              onClick={handleOpenNewTab}
              style={{
                padding: '11px 14px',
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
                gap: 7,
                boxShadow: '0 2px 8px rgba(44, 110, 106, 0.25)',
                transition: 'all 0.15s ease',
              }}
            >
              <ExternalLink size={15} />
              <span>Open in New Tab</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              style={{
                padding: '11px 14px',
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
                gap: 7,
                transition: 'all 0.15s ease',
              }}
            >
              <Download size={15} />
              <span>Download File</span>
            </button>
          </div>

          {/* Metadata Card */}
          <div
            style={{
              background: '#FAF9F6',
              border: '1px solid var(--border-color, #E5E3DF)',
              borderRadius: 8,
              padding: '12px 14px',
              fontSize: 12.5,
              display: 'flex',
              flexDirection: 'column',
              gap: 7,
            }}
          >
            {title && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary, #73716D)' }}>Assignment:</span>
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
              <div style={{ marginTop: 2, paddingTop: 6, borderTop: '1px solid #ECEAE5' }}>
                <span style={{ color: 'var(--text-secondary, #73716D)', display: 'block', marginBottom: 3, fontWeight: 600 }}>
                  Notes / Answer Text:
                </span>
                <div style={{ color: 'var(--neutral-dark, #2D2C2A)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {description}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="dialog-card-footer">
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            style={{ padding: '7px 18px', fontSize: 13, borderRadius: 6 }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

