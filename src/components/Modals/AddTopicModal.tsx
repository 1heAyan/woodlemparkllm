'use client';

import React, { useState, useEffect } from 'react';
import { SyllabusTerm } from '@/lib/supabaseClient';

interface AddTopicModalProps {
  isOpen: boolean;
  terms: SyllabusTerm[];
  selectedTermId?: string;
  onClose: () => void;
  onSubmit: (termId: string, title: string) => void;
}

export const AddTopicModal: React.FC<AddTopicModalProps> = ({
  isOpen,
  terms,
  selectedTermId,
  onClose,
  onSubmit,
}) => {
  const [termId, setTermId] = useState(selectedTermId || '');
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (selectedTermId) setTermId(selectedTermId);
    else if (terms.length > 0) setTermId(terms[0].id);
  }, [selectedTermId, terms]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!termId || !title.trim()) return;
    onSubmit(termId, title.trim());
    setTitle('');
    onClose();
  };

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Add Syllabus Topic</h2>
          <button type="button" className="close-modal" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Select Term</label>
            <select
              className="form-input"
              value={termId}
              onChange={(e) => setTermId(e.target.value)}
              required
            >
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Topic Title</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Electromagnetic Waves"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn-primary" style={{ width: '100%', padding: 14 }}>
            Save Topic
          </button>
        </form>
      </div>
    </div>
  );
};
