'use client';

import React from 'react';
import { UserProfile } from '@/lib/supabaseClient';
import { sanitizeUserCode } from '@/lib/userCodeHelper';
import { Check, Trash2, ArrowRight, ShieldCheck, AlertTriangle } from 'lucide-react';

export interface DuplicateGroup {
  key: string;
  studentName: string;
  grade: string;
  classLetter?: string;
  primaryProfile: UserProfile;
  duplicateProfiles: UserProfile[];
}

interface MergeDuplicatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  duplicateGroups: DuplicateGroup[];
  onMergeGroup: (group: DuplicateGroup) => Promise<void>;
  onMergeAll: () => Promise<void>;
  isMerging: boolean;
}

export const MergeDuplicatesModal: React.FC<MergeDuplicatesModalProps> = ({
  isOpen,
  onClose,
  duplicateGroups,
  onMergeGroup,
  onMergeAll,
  isMerging,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: 720, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={20} color="#D97706" />
              Clean Duplicate Student Accounts
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              We found {duplicateGroups.length} student{duplicateGroups.length !== 1 ? 's' : ''} with duplicate profiles. Consolidate them into genuine accounts with true admission numbers.
            </p>
          </div>
          <button type="button" className="close-modal" onClick={onClose}>
            &times;
          </button>
        </div>

        <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
          {duplicateGroups.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
              <ShieldCheck size={40} color="#16A34A" style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                No Duplicate Student Accounts Found
              </div>
              <p style={{ fontSize: 13, margin: '4px 0 0' }}>
                All student records have unique identifiers and clean admission numbers.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {duplicateGroups.map((group, idx) => {
                const primaryAdm =
                  sanitizeUserCode(
                    group.primaryProfile.admission_number || group.primaryProfile.user_code,
                    group.primaryProfile.email
                  ) || '—';

                return (
                  <div
                    key={group.key || idx}
                    style={{
                      border: '1px solid var(--border-color)',
                      borderRadius: 8,
                      background: 'var(--surface-variant)',
                      padding: 14,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 10,
                        borderBottom: '1px solid var(--border-color)',
                        paddingBottom: 8,
                        flexWrap: 'wrap',
                        gap: 6,
                      }}
                    >
                      <div>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                          {group.studentName}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 8 }}>
                          Grade {group.grade}{group.classLetter ? `-${group.classLetter}` : ''}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={isMerging}
                        onClick={() => onMergeGroup(group)}
                        style={{ padding: '4px 12px', fontSize: 11.5, fontWeight: 600 }}
                      >
                        Merge This Student
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 10, alignItems: 'center' }}>
                      {/* Genuine Primary Account */}
                      <div
                        style={{
                          background: '#F0FDF4',
                          border: '1px solid #BBF7D0',
                          borderRadius: 6,
                          padding: '8px 12px',
                        }}
                      >
                        <div style={{ fontSize: 10.5, fontWeight: 700, color: '#16A34A', textTransform: 'uppercase', marginBottom: 2 }}>
                          ✓ Genuine Primary Account
                        </div>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#166534' }}>
                          Admission #: <span style={{ fontFamily: 'monospace' }}>{primaryAdm}</span>
                        </div>
                        <div style={{ fontSize: 11, color: '#15803D', fontFamily: 'monospace' }}>
                          {group.primaryProfile.email}
                        </div>
                      </div>

                      <ArrowRight size={16} color="var(--text-secondary)" />

                      {/* Duplicate Accounts to remove */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {group.duplicateProfiles.map((dup, dIdx) => {
                          const dupAdm =
                            sanitizeUserCode(
                              dup.admission_number || dup.user_code,
                              dup.email
                            ) || '—';

                          return (
                            <div
                              key={dup.id || dIdx}
                              style={{
                                background: '#FEF2F2',
                                border: '1px solid #FECACA',
                                borderRadius: 6,
                                padding: '8px 12px',
                              }}
                            >
                              <div style={{ fontSize: 10.5, fontWeight: 700, color: '#DC2626', textTransform: 'uppercase', marginBottom: 2 }}>
                                ✕ Redundant Duplicate (Will Merge)
                              </div>
                              <div style={{ fontSize: 12.5, fontWeight: 600, color: '#991B1B' }}>
                                Fake / Temp Adm #: <span style={{ fontFamily: 'monospace' }}>{dupAdm}</span>
                              </div>
                              <div style={{ fontSize: 11, color: '#B91C1C', fontFamily: 'monospace' }}>
                                {dup.email}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', padding: '14px 24px' }}>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={isMerging}>
            Close
          </button>
          {duplicateGroups.length > 0 && (
            <button
              type="button"
              className="btn-primary"
              disabled={isMerging}
              onClick={onMergeAll}
              style={{ background: '#D97706', borderColor: '#D97706' }}
            >
              {isMerging ? 'Merging Duplicates...' : `Merge All ${duplicateGroups.length} Duplicate Students`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
