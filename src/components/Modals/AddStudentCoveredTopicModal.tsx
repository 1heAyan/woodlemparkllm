'use client';

import React, { useState, useEffect } from 'react';
import { SyllabusTerm, StudentCustomTopic } from '@/lib/supabaseClient';

interface AddStudentCoveredTopicModalProps {
  isOpen: boolean;
  studentId: string;
  studentName: string;
  subject: string;
  classId?: string;
  terms: SyllabusTerm[];
  onClose: () => void;
  onSubmit: (topicData: Omit<StudentCustomTopic, 'id'>) => void;
}

export const AddStudentCoveredTopicModal: React.FC<AddStudentCoveredTopicModalProps> = ({
  isOpen,
  studentId,
  studentName,
  subject,
  classId,
  terms,
  onClose,
  onSubmit,
}) => {
  const [title, setTitle] = useState('');
  const [termName, setTermName] = useState('');
  const [notes, setNotes] = useState('');
  const [coveredAt, setCoveredAt] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setNotes('');
      setCoveredAt(new Date().toISOString().split('T')[0]);
      if (terms.length > 0) {
        setTermName(terms[0].name);
      } else {
        setTermName('Term 1');
      }
    }
  }, [isOpen, terms]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const matchedTerm = terms.find((t) => t.name === termName);

    onSubmit({
      student_id: studentId,
      student_name: studentName,
      subject,
      class_id: classId,
      term_id: matchedTerm?.id,
      term_name: termName.trim() || 'Self-Study Module',
      title: title.trim(),
      notes: notes.trim(),
      covered_at: coveredAt || new Date().toISOString().split('T')[0],
      is_completed: true,
    });

    onClose();
  };

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Standard Woodlem Page Modal Header */}
        <div className="modal-header">
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#2C6E6A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Syllabus &amp; Curriculum Tracking
            </span>
            <h2 className="modal-title" style={{ margin: '2px 0 0' }}>
              Add Self-Study Covered Topic
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
              {subject} • Record an additional chapter or revision topic to your personal syllabus coverage log
            </p>
          </div>
          <button type="button" className="close-modal" onClick={onClose}>
            &times;
          </button>
        </div>

        {/* Centered Scrollable Form Body */}
        <form
          onSubmit={handleSubmit}
          style={{
            maxWidth: 680,
            width: '100%',
            margin: '0 auto',
            padding: '32px 36px 64px',
            overflowY: 'auto',
            flex: 1,
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid var(--border-color)',
              borderRadius: 12,
              padding: '24px 28px',
              marginBottom: 20,
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            }}
          >
            <div className="form-group" style={{ marginBottom: 18 }}>
              <label className="form-label" style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--neutral-dark)', marginBottom: 6 }}>
                Topic / Chapter Title <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Chemical Bonding Practice Problems, Macbeth Act 3, Calculus Review..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
                required
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--neutral-dark)', marginBottom: 6 }}>
                  Curriculum Term / Section
                </label>
                {terms.length > 0 ? (
                  <select
                    className="form-input"
                    value={termName}
                    onChange={(e) => setTermName(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    {terms.map((t) => (
                      <option key={t.id} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                    <option value="Self-Study & Additional">Self-Study &amp; Additional</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Term 1 / Unit 2"
                    value={termName}
                    onChange={(e) => setTermName(e.target.value)}
                    style={{ width: '100%' }}
                  />
                )}
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--neutral-dark)', marginBottom: 6 }}>
                  Date Covered
                </label>
                <input
                  type="date"
                  className="form-input"
                  value={coveredAt}
                  onChange={(e) => setCoveredAt(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--neutral-dark)', marginBottom: 6 }}>
                Study Notes / Learning Summary (Optional)
              </label>
              <textarea
                className="form-input"
                rows={3}
                placeholder="e.g. Read textbook pages 45-62, completed workbook exercises, memorized formulas..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ width: '100%', resize: 'vertical' }}
              />
              <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 6, display: 'block' }}>
                Your teacher can view these notes to track your self-study progress.
              </span>
            </div>
          </div>

          <div
            style={{
              padding: '12px 16px',
              borderRadius: 8,
              background: '#FAF9F6',
              border: '1px solid var(--border-color)',
              fontSize: 12,
              color: 'var(--text-secondary)',
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span>
              This topic will be added to your <strong>Self-Study &amp; Additional Topics</strong> list and updated on your coverage tracker.
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              style={{ padding: '9px 18px', fontSize: 13, fontWeight: 600 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              style={{ padding: '9px 24px', fontSize: 13, fontWeight: 600 }}
            >
              Save Covered Topic
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
