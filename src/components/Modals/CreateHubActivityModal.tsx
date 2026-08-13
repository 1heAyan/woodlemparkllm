'use client';

import React, { useState } from 'react';

interface CreateHubActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (activityData: {
    title: string;
    type: string;
    description: string;
    date: string;
    videoUrl?: string;
    attachedFileName?: string;
    targetGrades: string[];
  }) => void;
}

export const CreateHubActivityModal: React.FC<CreateHubActivityModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [attachedFileName, setAttachedFileName] = useState('');
  const [targetGrades, setTargetGrades] = useState<string[]>(['Grade 12']);

  if (!isOpen) return null;

  const handleGradeChange = (grade: string, checked: boolean) => {
    if (checked) {
      setTargetGrades([...targetGrades, grade]);
    } else {
      setTargetGrades(targetGrades.filter((g) => g !== grade));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAttachedFileName(e.target.files[0].name);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !type || !description.trim() || !date) return;
    onSubmit({
      title: title.trim(),
      type,
      description: description.trim(),
      date,
      videoUrl: videoUrl.trim(),
      attachedFileName,
      targetGrades: targetGrades.length > 0 ? targetGrades : ['Grade 12'],
    });
    setTitle('');
    setType('');
    setDescription('');
    setDate('');
    setVideoUrl('');
    setAttachedFileName('');
    setTargetGrades(['Grade 12']);
    onClose();
  };

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Create Hub Activity</h2>
          <button type="button" className="close-modal" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Activity Title</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Photography Club Registration"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Activity Type</label>
            <select
              className="form-input"
              value={type}
              onChange={(e) => setType(e.target.value)}
              required
            >
              <option value="">Select type…</option>
              <option value="Counselling Appointment">Counselling Appointment</option>
              <option value="Club Registration">Club Registration</option>
              <option value="Summer Programme">Summer Programme</option>
              <option value="Workshop">Workshop</option>
              <option value="Event">Event</option>
              <option value="Volunteer Opportunity">Volunteer Opportunity</option>
              <option value="Leadership Programme">Leadership Programme</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-input"
              placeholder="Describe the programme, requirements, and what students will gain…"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Date / Deadline</label>
            <input
              type="date"
              className="form-input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">YouTube Video URL (optional)</label>
            <input
              type="url"
              className="form-input"
              placeholder="https://www.youtube.com/watch?v=..."
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Attach Files / Flyer (optional)</label>
            <label className="file-drop" style={{ display: 'block', cursor: 'pointer' }}>
              Click to attach a PDF or image flyer
              <input
                type="file"
                className="doc-file-input"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
              />
            </label>
            {attachedFileName && (
              <div style={{ marginTop: 8 }}>
                <span className="doc-filename">📎 {attachedFileName}</span>
              </div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Target Grades</label>
            <div className="checkbox-group">
              {['Grade 10', 'Grade 11', 'Grade 12'].map((g) => (
                <label key={g}>
                  <input
                    type="checkbox"
                    value={g}
                    checked={targetGrades.includes(g)}
                    onChange={(e) => handleGradeChange(g, e.target.checked)}
                  />{' '}
                  {g}
                </label>
              ))}
            </div>
          </div>
          <button type="submit" className="btn-hub btn-primary" style={{ width: '100%', padding: 14 }}>
            Publish Activity
          </button>
        </form>
      </div>
    </div>
  );
};
