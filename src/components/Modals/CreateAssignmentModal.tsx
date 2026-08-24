'use client';

import React, { useState, useEffect } from 'react';
import { CustomSelect } from '@/components/UI/CustomSelect';

const ALL_SECTIONS = [
  '9-A', '9-B', '9-C', '9-D',
  '10-A', '10-B', '10-C', '10-D',
  '11-A', '11-B', '11-C', '11-D',
  '12-A', '12-B', '12-C', '12-D',
  'All Classes',
] as const;

interface CreateAssignmentModalProps {
  isOpen: boolean;
  activeClass?: string;
  onClose: () => void;
  onSubmit: (data: { title: string; className?: string; type?: 'assignment' | 'assessment' }) => void;
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      className: activeClass || selectedClass,
      type: taskType,
    });
    setTitle('');
    onClose();
  };

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title" style={{ margin: 0 }}>Create Classwork &amp; Tasks</h2>
            {activeClass && (
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                Publishing for this classroom automatically.
              </p>
            )}
          </div>
          <button type="button" className="close-modal" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          {/* Task Type Switcher */}
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Task Type</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button
                type="button"
                onClick={() => handleSelectTaskType('assignment')}
                style={{
                  padding: '9px 12px',
                  borderRadius: 6,
                  border: taskType === 'assignment' ? '1.5px solid #2C6E6A' : '1px solid var(--border-color)',
                  background: taskType === 'assignment' ? '#EAF3EF' : '#FFFFFF',
                  color: taskType === 'assignment' ? '#2D6E5D' : 'var(--neutral-dark)',
                  fontWeight: taskType === 'assignment' ? 700 : 500,
                  fontSize: 12,
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                Homework Assignment
              </button>
              <button
                type="button"
                onClick={() => handleSelectTaskType('assessment')}
                style={{
                  padding: '9px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--border-color)',
                  background: '#FFFFFF',
                  color: 'var(--neutral-dark)',
                  fontWeight: 500,
                  fontSize: 12,
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                Class Test ↗
              </button>
            </div>
          </div>

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

          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label">
              {taskType === 'assignment' ? 'Assignment Title' : 'Assessment / Test Title'}
            </label>
            <input
              type="text"
              className="form-input"
              placeholder={taskType === 'assignment' ? 'e.g. Weekly Problem Set #3, Lab Report' : 'e.g. Unit 1: Thermodynamics Assessment'}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
            />
          </div>

          <button type="submit" className="btn-primary" style={{ width: '100%', padding: 12 }}>
            {taskType === 'assignment' ? '+ Assign Coursework' : '+ Publish Assessment'}
          </button>
        </form>
      </div>
    </div>
  );
};
