'use client';

import React, { useState, useEffect } from 'react';
import { CustomSelect } from '@/components/UI/CustomSelect';

const ALL_SECTIONS = ['10-A', '10-B', '10-C', '10-D', '12-A', '12-B', '12-C', '12-D', 'All Classes'] as const;

interface CreateTestModalProps {
  isOpen: boolean;
  activeClass?: string;
  onClose: () => void;
  onSubmit: (data: { title: string; className?: string }) => void;
}

export const CreateTestModal: React.FC<CreateTestModalProps> = ({
  isOpen,
  activeClass = '',
  onClose,
  onSubmit,
}) => {
  const [title, setTitle] = useState('');
  const [selectedClass, setSelectedClass] = useState(activeClass);

  useEffect(() => {
    setSelectedClass(activeClass || '');
  }, [activeClass, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({ title: title.trim(), className: activeClass || selectedClass });
    setTitle('');
    onClose();
  };

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title" style={{ margin: 0 }}>Publish New Assessment</h2>
            {activeClass && (
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                Publishing for this classroom automatically.
              </p>
            )}
          </div>
          <button type="button" className="close-modal" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          {activeClass ? (
            <div
              style={{
                marginBottom: 16,
                padding: '10px 14px',
                background: '#F8F7F4',
                border: '1px solid var(--border-color)',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Target Classroom
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#2C6E6A', background: '#EAF3EF', padding: '2px 8px', borderRadius: 4, border: '1px solid #C7E4D8' }}>
                {activeClass}
              </span>
            </div>
          ) : (
            <div className="form-group">
              <label className="form-label">Target Class / Section</label>
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

          <div className="form-group">
            <label className="form-label">Assessment Title</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Unit 1: Thermodynamics Assessment"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
            />
          </div>

          <button type="submit" className="btn-primary" style={{ width: '100%', padding: 12 }}>
            Publish Assessment
          </button>
        </form>
      </div>
    </div>
  );
};
