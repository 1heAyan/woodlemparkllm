'use client';

import React, { useState, useEffect } from 'react';
import { ParentDocument } from '@/lib/supabaseClient';
import { ONBOARDING_DOC_DEFINITIONS, getDocumentExpiryStatus, formatShortDate } from '@/lib/documentExpiryHelper';
import { FileText, Upload, Calendar, AlertTriangle, ShieldCheck, Check } from 'lucide-react';

interface RenewDocumentModalProps {
  isOpen: boolean;
  docType: string;
  studentId: string;
  studentName?: string;
  existingDoc?: ParentDocument;
  onClose: () => void;
  onSave: (docType: string, fileName: string, fileDataUrl?: string, expiryDate?: string, documentNumber?: string) => Promise<void> | void;
}

export const RenewDocumentModal: React.FC<RenewDocumentModalProps> = ({
  isOpen,
  docType,
  studentId,
  studentName,
  existingDoc,
  onClose,
  onSave,
}) => {
  const [fileName, setFileName] = useState('');
  const [fileDataUrl, setFileDataUrl] = useState<string | undefined>(undefined);
  const [expiryDate, setExpiryDate] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const docDef = ONBOARDING_DOC_DEFINITIONS.find((d) => d.type === docType);

  useEffect(() => {
    if (existingDoc) {
      setFileName(existingDoc.file_name || '');
      setFileDataUrl(existingDoc.file_url || undefined);
      setExpiryDate(existingDoc.expiry_date || '');
      setDocumentNumber(existingDoc.document_number || '');
    } else {
      setFileName('');
      setFileDataUrl(undefined);
      setExpiryDate('');
      setDocumentNumber('');
    }
  }, [existingDoc, docType, isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setFileDataUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const expiryStatus = docDef?.requiresExpiry && expiryDate ? getDocumentExpiryStatus(expiryDate, true) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileName.trim()) {
      alert('Please upload or select the renewed document file.');
      return;
    }
    if (docDef?.requiresExpiry && !expiryDate) {
      alert('Please enter the new expiration date of the renewed document.');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(docType, fileName, fileDataUrl, expiryDate || undefined, documentNumber || undefined);
      onClose();
    } catch (err: any) {
      alert('Failed to save document: ' + (err?.message || 'Unexpected error'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-overlay active" onClick={onClose} style={{ zIndex: 1250 }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Renew / Update Document</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              Regulatory Clearance • {docDef?.label || docType}
              {studentName && <span> • Ward: <strong>{studentName}</strong></span>}
            </p>
          </div>
          <button type="button" className="close-modal" onClick={onClose}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Document Type Overview Card */}
          <div
            style={{
              padding: '12px 14px',
              background: '#FAF9F6',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              marginBottom: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 6,
                  background: '#EAF3EF',
                  color: '#2C6E6A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <FileText size={18} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                  {docDef?.label || docType}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {docDef?.desc || 'Official UAE regulatory compliance document.'}
                </div>
              </div>
            </div>

            {existingDoc?.uploaded_at && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  background: '#FFFFFF',
                  padding: '3px 8px',
                  borderRadius: 4,
                  border: '1px solid var(--border-color)',
                  whiteSpace: 'nowrap',
                }}
              >
                Current: {existingDoc.uploaded_at}
              </span>
            )}
          </div>

          {/* File Upload Slot */}
          <div className="form-group">
            <label className="form-label">
              Attach Renewed File (PDF, JPG, PNG) <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <label
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '22px 16px',
                background: fileName ? '#EAF3EF' : '#FAF9F6',
                border: fileName ? '1.5px solid #A7F3D0' : '1.5px dashed var(--border-color)',
                borderRadius: 8,
                cursor: 'pointer',
                textAlign: 'center',
                gap: 6,
                transition: 'all 0.15s ease',
              }}
            >
              <Upload size={22} color={fileName ? '#2C6E6A' : 'var(--text-secondary)'} />
              {fileName ? (
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#2D6E5D' }}>
                    ✓ {fileName}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Click to select a different file
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--neutral-dark)' }}>
                    Click or drag file here to upload renewed document
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>
                    Supports scanned PDF, JPG or PNG up to 10MB
                  </div>
                </div>
              )}
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </label>
          </div>

          {/* Expiry Date */}
          {docDef?.requiresExpiry && (
            <div className="form-group">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <label className="form-label" style={{ margin: 0 }}>
                  New Document Expiration Date <span style={{ color: '#DC2626' }}>*</span>
                </label>
                {expiryStatus && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: expiryStatus.badgeBg,
                      color: expiryStatus.badgeColor,
                      border: `1px solid ${expiryStatus.badgeBorder}`,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    {expiryStatus.isUrgent && <AlertTriangle size={11} />}
                    {expiryStatus.label}
                  </span>
                )}
              </div>
              <input
                type="date"
                className="form-input"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                required
              />
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, display: 'block' }}>
                Enter the exact validity date printed on the renewed card or visa stamp.
              </span>
            </div>
          )}

          {/* Document Number */}
          <div className="form-group">
            <label className="form-label">
              {docDef?.docNumberLabel || 'Document / ID Number'} (Optional)
            </label>
            <input
              type="text"
              className="form-input"
              placeholder={docDef?.docNumberPlaceholder || 'e.g. 784-YYYY-XXXXXXX-X'}
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
            />
          </div>

          {/* Modal Footer Actions */}
          <div className="modal-footer" style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSaving}
            >
              {isSaving ? 'Saving Changes...' : 'Save & Update Document'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
