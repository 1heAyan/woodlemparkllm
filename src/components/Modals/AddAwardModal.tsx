'use client';

import React, { useState } from 'react';

interface AddAwardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (title: string, desc: string) => void;
}

export const AddAwardModal: React.FC<AddAwardModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit(title.trim(), desc.trim());
    setTitle('');
    setDesc('');
    onClose();
  };

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Log Achievement</h2>
          <button type="button" className="close-modal" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Award Title</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. National Science Fair"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Details / Description</label>
            <textarea
              className="form-input"
              placeholder="Describe the achievement..."
              rows={3}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              required
            />
          </div>
          <div className="form-group" style={{ marginBottom: 24 }}>
            <label className="form-label">Attach Proof</label>
            <div className="file-drop">Click to browse files (JPEG, PDF)</div>
          </div>
          <button type="submit" className="btn-primary" style={{ width: '100%', padding: 14 }}>
            Upload Achievement
          </button>
        </form>
      </div>
    </div>
  );
};
