'use client';

import React from 'react';

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

  const handleDownload = () => {
    if (fileUrl) {
      const a = document.createElement('a');
      a.href = fileUrl;
      a.download = fileName.includes('.') ? fileName : `${fileName}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      // Generate a text/plain certificate download
      const docContent = `=====================================================
WOODLEM PARK SCHOOL - VERIFIED ACADEMIC ACHIEVEMENT PROOF
=====================================================
Student Name:       ${studentName || 'Student'}
Distinction / Title: ${title || 'Official School Achievement'}
Date:               ${submissionDate || new Date().toLocaleDateString()}
Document / Proof:   ${fileName}

DESCRIPTION / CITATION:
-----------------------------------------------------
${description || 'No additional remarks provided.'}
-----------------------------------------------------
Certified Woodlem LMS Student Academic Distinction Record`;
      const blob = new Blob([docContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName.endsWith('.txt') ? fileName : `Certificate_${studentName || 'Student'}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
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
        background: 'rgba(20, 25, 24, 0.65)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        className="modal-content"
        style={{
          maxWidth: 860,
          width: '94%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          borderRadius: 12,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          background: '#FFFFFF',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div
          style={{
            padding: '16px 22px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#FAF9F6',
          }}
        >
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
              {isImage ? 'IMG' : isPdf ? 'PDF' : 'DOC'}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <h3
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  margin: 0,
                  color: 'var(--neutral-dark)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: 520,
                }}
                title={fileName}
              >
                {fileName}
              </h3>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                {studentName ? `Submitted by ${studentName}` : 'Student Attachment Proof'}
                {submissionDate ? ` · ${submissionDate}` : ''}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <button
              type="button"
              onClick={handleDownload}
              style={{
                padding: '7px 14px',
                fontSize: 11.5,
                fontWeight: 600,
                background: '#2C6E6A',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s ease',
              }}
            >
              <span>↓</span> Download Proof File
            </button>
            <button
              type="button"
              className="close-modal"
              onClick={onClose}
              style={{
                position: 'static',
                padding: '4px 10px',
                fontSize: 20,
                background: '#FAF9F6',
                border: '1px solid var(--border-color)',
                borderRadius: 6,
                cursor: 'pointer',
                lineHeight: 1,
              }}
            >
              &times;
            </button>
          </div>
        </div>

        {/* Viewer Content Area */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px',
            background: '#F5F4F0',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            minHeight: 440,
          }}
        >
          {isImage && fileUrl ? (
            <div
              style={{
                background: '#FFFFFF',
                padding: 16,
                borderRadius: 10,
                boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
                maxWidth: '100%',
                textAlign: 'center',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fileUrl}
                alt={fileName}
                style={{
                  maxWidth: '100%',
                  maxHeight: '68vh',
                  objectFit: 'contain',
                  borderRadius: 6,
                  display: 'block',
                  margin: '0 auto',
                }}
              />
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 10 }}>
                Verified student achievement certificate proof
              </div>
            </div>
          ) : isPdf && fileUrl ? (
            <iframe
              src={fileUrl}
              title={fileName}
              style={{
                width: '100%',
                height: '68vh',
                border: 'none',
                borderRadius: 10,
                background: '#FFFFFF',
                boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
              }}
            />
          ) : (
            /* Academic Distinction Document Certificate View */
            <div
              style={{
                background: '#FFFFFF',
                width: '100%',
                maxWidth: 720,
                borderRadius: 10,
                boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
                border: '1.5px solid #E2DED5',
                padding: '36px 40px',
                position: 'relative',
              }}
            >
              {/* Decorative Certificate Inner Border */}
              <div
                style={{
                  border: '1px dashed #CBE2DF',
                  padding: '28px 32px',
                  borderRadius: 8,
                  background: '#FCFBF8',
                }}
              >
                {/* Woodlem School Certificate Header */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '2px solid #2C6E6A',
                    paddingBottom: 16,
                    marginBottom: 20,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 900, color: '#2C6E6A', letterSpacing: '-0.02em' }}>
                      WOODLEM PARK SCHOOL
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                      Academic Portfolio · Achievement &amp; Distinction Proof
                    </div>
                  </div>
                  <div
                    style={{
                      padding: '4px 12px',
                      borderRadius: 4,
                      fontSize: 10.5,
                      fontWeight: 800,
                      background: '#FEF7EC',
                      color: '#9E6C1B',
                      border: '1px solid #F5DEB3',
                      letterSpacing: '0.04em',
                    }}
                  >
                    OFFICIAL RECORD
                  </div>
                </div>

                {/* Main Distinction Award Display */}
                <div style={{ textAlign: 'center', margin: '20px 0 24px' }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#2C6E6A', fontWeight: 700, letterSpacing: '0.06em' }}>
                    STUDENT RECOGNITION AWARD
                  </div>
                  <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--neutral-dark)', margin: '4px 0 6px' }}>
                    {title || 'Academic Achievement Distinction'}
                  </h2>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    Conferred to <strong>{studentName || 'Student'}</strong>
                  </div>
                </div>

                {/* Metadata Details Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: 12,
                    background: '#FFFFFF',
                    border: '1px solid #ECEAE5',
                    borderRadius: 6,
                    padding: '14px 18px',
                    marginBottom: 20,
                    fontSize: 12,
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 11, display: 'block' }}>Student Candidate</span>
                    <strong style={{ color: 'var(--neutral-dark)' }}>{studentName || 'Student'}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 11, display: 'block' }}>Document / Proof File</span>
                    <strong style={{ color: 'var(--neutral-dark)', wordBreak: 'break-all' }}>{fileName}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 11, display: 'block' }}>Recognition Category</span>
                    <strong style={{ color: 'var(--neutral-dark)' }}>{title || 'Distinction'}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 11, display: 'block' }}>Logged &amp; Certified On</span>
                    <strong style={{ color: 'var(--neutral-dark)' }}>{submissionDate || 'Recently Certified'}</strong>
                  </div>
                </div>

                {/* Citation & Proof Content */}
                <div style={{ marginBottom: 20 }}>
                  <h4 style={{ fontSize: 12, fontWeight: 700, margin: '0 0 6px', color: '#2C6E6A', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Citation &amp; Submitted Proof Content
                  </h4>
                  <div
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid var(--border-color)',
                      borderRadius: 6,
                      padding: '14px 18px',
                      fontSize: 12.5,
                      lineHeight: 1.6,
                      color: 'var(--neutral-dark)',
                      whiteSpace: 'pre-wrap',
                      minHeight: 70,
                      wordBreak: 'break-word',
                    }}
                  >
                    {description || (
                      <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                        This distinction was submitted by the student and authenticated by the homeroom faculty.
                      </span>
                    )}
                  </div>
                </div>

                {/* Attached File Note */}
                {fileName && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      background: '#EAF3EF',
                      border: '1px solid #C7E4D8',
                      borderRadius: 6,
                      padding: '10px 14px',
                      fontSize: 11.5,
                      color: '#2D6E5D',
                    }}
                  >
                    <span style={{ fontSize: 14 }}>📄</span>
                    <span style={{ flex: 1, fontWeight: 600, wordBreak: 'break-all' }}>
                      Attachment: {fileName}
                    </span>
                    <button
                      type="button"
                      onClick={handleDownload}
                      style={{
                        padding: '3px 8px',
                        fontSize: 10.5,
                        fontWeight: 700,
                        background: '#2C6E6A',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer',
                      }}
                    >
                      Export
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 22px',
            borderTop: '1px solid var(--border-color)',
            background: '#FAF9F6',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            className="btn-primary"
            onClick={onClose}
            style={{ padding: '8px 24px', fontSize: 12.5 }}
          >
            Close Viewer
          </button>
        </div>
      </div>
    </div>
  );
};
