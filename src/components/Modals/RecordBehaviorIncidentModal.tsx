'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile } from '@/lib/supabaseClient';
import {
  BehaviorIncidentRecord,
  VIOLATION_PRESETS,
  BehaviorViolationCategory,
  computeStudentBehaviorScore,
  getBehaviorTier,
  BASE_BEHAVIOR_SCORE,
} from '@/lib/behaviorHelper';
import { ShieldAlert, AlertTriangle, ArrowRight, UserCheck } from 'lucide-react';

interface RecordBehaviorIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRecordIncident: (incident: BehaviorIncidentRecord) => Promise<void> | void;
  availableStudents: UserProfile[];
  preselectedStudentId?: string;
  currentUser: UserProfile;
  teacherRole: 'class_teacher' | 'subject_teacher';
  defaultSubject?: string;
  allIncidents?: BehaviorIncidentRecord[];
}

export const RecordBehaviorIncidentModal: React.FC<RecordBehaviorIncidentModalProps> = ({
  isOpen,
  onClose,
  onRecordIncident,
  availableStudents,
  preselectedStudentId,
  currentUser,
  teacherRole,
  defaultSubject,
  allIncidents = [],
}) => {
  const [selectedStudentId, setSelectedStudentId] = useState<string>(preselectedStudentId || '');
  const [category, setCategory] = useState<BehaviorViolationCategory>('disruptive_behavior');
  const [customReason, setCustomReason] = useState<string>('');
  const [pointsDeducted, setPointsDeducted] = useState<number>(4);
  const [subjectContext, setSubjectContext] = useState<string>(defaultSubject || '');
  const [incidentDate, setIncidentDate] = useState<string>('');
  const [incidentTime, setIncidentTime] = useState<string>('');
  const [actionTaken, setActionTaken] = useState<string>('Verbal Warning');
  const [customAction, setCustomAction] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form state when modal opens or preselected student changes
  useEffect(() => {
    if (isOpen) {
      const today = new Date();
      setIncidentDate(today.toISOString().slice(0, 10));

      const hours = today.getHours();
      const minutes = today.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const formattedHours = (hours % 12 || 12).toString().padStart(2, '0');
      setIncidentTime(`${formattedHours}:${minutes} ${ampm}`);

      if (preselectedStudentId) {
        setSelectedStudentId(preselectedStudentId);
      } else if (availableStudents.length > 0 && !selectedStudentId) {
        setSelectedStudentId(availableStudents[0].id);
      }

      setSubjectContext(defaultSubject || (teacherRole === 'class_teacher' ? 'Homeroom' : (currentUser.subject || 'Faculty')));
      setCategory('disruptive_behavior');
      setPointsDeducted(4);
      setActionTaken('Verbal Warning');
      setCustomReason('');
      setCustomAction('');
      setNotes('');
    }
  }, [isOpen, preselectedStudentId, availableStudents, defaultSubject, teacherRole, currentUser]);

  // When category changes, auto-populate recommended deduction points
  const handleCategoryChange = (newCat: BehaviorViolationCategory) => {
    setCategory(newCat);
    const preset = VIOLATION_PRESETS.find((p) => p.id === newCat);
    if (preset) {
      setPointsDeducted(preset.defaultPoints);
    }
  };

  const selectedStudent = useMemo(() => {
    return availableStudents.find((s) => s.id === selectedStudentId);
  }, [availableStudents, selectedStudentId]);

  // Calculate student's current score and projected score after this deduction
  const currentScore = useMemo(() => {
    if (!selectedStudentId) return BASE_BEHAVIOR_SCORE;
    return computeStudentBehaviorScore(selectedStudentId, allIncidents);
  }, [selectedStudentId, allIncidents]);

  const projectedScore = Math.max(0, currentScore - (Number(pointsDeducted) || 0));
  const currentTier = getBehaviorTier(currentScore);
  const projectedTier = getBehaviorTier(projectedScore);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !selectedStudent) {
      alert('Please select a student.');
      return;
    }

    const finalPoints = Math.max(1, Number(pointsDeducted) || 1);
    const preset = VIOLATION_PRESETS.find((p) => p.id === category);
    const finalReason = category === 'other' && customReason.trim()
      ? customReason.trim()
      : (preset ? preset.label : 'General Behavioral Violation');

    const finalAction = actionTaken === 'Other' && customAction.trim()
      ? customAction.trim()
      : actionTaken;

    const studentAdm = selectedStudent.admission_number || selectedStudent.user_code || '';
    const studentGrade = selectedStudent.grade || '';
    const studentSec = selectedStudent.class_letter || '';

    const newRecord: BehaviorIncidentRecord = {
      id: `beh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      student_id: selectedStudent.id,
      student_name: selectedStudent.name,
      student_admission_number: studentAdm,
      grade: studentGrade,
      class_letter: studentSec,
      points_deducted: finalPoints,
      reason: finalReason,
      category,
      notes: notes.trim(),
      action_taken: finalAction,
      teacher_id: currentUser.id,
      teacher_name: currentUser.name,
      teacher_role: teacherRole,
      subject: subjectContext.trim() || 'General Conduct',
      date: incidentDate || new Date().toISOString().slice(0, 10),
      incident_time: incidentTime,
      created_at: new Date().toISOString(),
    };

    try {
      setIsSubmitting(true);
      await onRecordIncident(newRecord);
      setIsSubmitting(false);
      onClose();
    } catch (err) {
      console.error('Failed to record behavior incident:', err);
      setIsSubmitting(false);
      alert('Failed to record incident. Please try again.');
    }
  };

  return (
    <div className="modal-overlay active" onClick={onClose} style={{ zIndex: 9999 }}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 560, width: '92%', borderRadius: 16, overflow: 'hidden', padding: 0 }}
      >
        {/* Header */}
        <div
          style={{
            background: '#A83B38',
            color: '#FFFFFF',
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: 'rgba(255, 255, 255, 0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShieldAlert size={20} color="#FFFFFF" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#FFFFFF' }}>
                Record Behavior Incident
              </h2>
              <p style={{ margin: 0, fontSize: 12, color: 'rgba(255, 255, 255, 0.82)' }}>
                {teacherRole === 'class_teacher' ? 'Class Teacher Homeroom Conduct' : `Subject Class: ${subjectContext || 'Course'}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="close-modal"
            onClick={onClose}
            style={{ color: '#FFFFFF', fontSize: 24, background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px 24px 24px 24px', maxHeight: '82vh', overflowY: 'auto' }}>
          {/* Student Selector */}
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label" style={{ fontWeight: 600, fontSize: 13 }}>
              Student <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <select
              className="form-input"
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              required
              disabled={!!preselectedStudentId}
              style={{ fontSize: 13, height: 42, background: preselectedStudentId ? '#F9F8F6' : '#FFFFFF' }}
            >
              <option value="" disabled>Select Student…</option>
              {availableStudents.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name} {st.admission_number || st.user_code ? `(${st.admission_number || st.user_code})` : ''} — Gr {st.grade || '?'}-{st.class_letter || '?'}
                </option>
              ))}
            </select>
          </div>

          {/* Live Score Projection Banner */}
          {selectedStudent && (
            <div
              style={{
                background: '#F9F8F6',
                border: '1px solid #E5E3DF',
                borderRadius: 12,
                padding: '12px 16px',
                marginBottom: 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.04em' }}>
                  Current Score
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: currentTier.color }}>
                    {currentScore}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>/ 80 pts</span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: 4,
                      background: currentTier.badgeBg,
                      color: currentTier.color,
                      border: `1px solid ${currentTier.badgeBorder}`,
                    }}
                  >
                    {currentTier.tag}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#DC2626' }}>
                  -{pointsDeducted}
                </span>
                <ArrowRight size={14} color="var(--text-secondary)" />
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.04em' }}>
                  Projected Score
                </span>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 2 }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: projectedTier.color }}>
                    {projectedScore}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>/ 80 pts</span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: 4,
                      background: projectedTier.badgeBg,
                      color: projectedTier.color,
                      border: `1px solid ${projectedTier.badgeBorder}`,
                    }}
                  >
                    {projectedTier.tag}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Violation Category / Reason */}
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label" style={{ fontWeight: 600, fontSize: 13 }}>
              Violation Reason &amp; Category <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <select
              className="form-input"
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value as BehaviorViolationCategory)}
              style={{ fontSize: 13, height: 42 }}
            >
              {VIOLATION_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} (Recommended: -{p.defaultPoints} pts)
                </option>
              ))}
            </select>
            {category && (
              <p style={{ margin: '4px 0 0 0', fontSize: 11.5, color: 'var(--text-secondary)' }}>
                {VIOLATION_PRESETS.find((p) => p.id === category)?.description}
              </p>
            )}
          </div>

          {category === 'other' && (
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: 13 }}>
                Custom Violation Title <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Failure to submit laboratory safety contract"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                required
                style={{ fontSize: 13 }}
              />
            </div>
          )}

          {/* Points to Deduct with Quick Presets */}
          <div className="form-group" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: 13, margin: 0 }}>
                Points to Deduct <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                {[2, 4, 5, 10].map((pt) => (
                  <button
                    key={pt}
                    type="button"
                    onClick={() => setPointsDeducted(pt)}
                    style={{
                      padding: '2px 8px',
                      fontSize: 11,
                      fontWeight: 700,
                      borderRadius: 6,
                      border: pointsDeducted === pt ? '1.5px solid #DC2626' : '1px solid #E5E3DF',
                      background: pointsDeducted === pt ? '#FEE2E2' : '#FFFFFF',
                      color: pointsDeducted === pt ? '#DC2626' : 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    -{pt}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="number"
              min={1}
              max={40}
              className="form-input"
              value={pointsDeducted}
              onChange={(e) => setPointsDeducted(Math.max(1, parseInt(e.target.value, 10) || 1))}
              required
              style={{ fontSize: 14, fontWeight: 700, color: '#DC2626', height: 42 }}
            />
          </div>

          {/* Context & Date/Time Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: 13 }}>
                Subject / Class Context
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Grade 12 Physics"
                value={subjectContext}
                onChange={(e) => setSubjectContext(e.target.value)}
                style={{ fontSize: 13 }}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: 13 }}>
                Incident Date
              </label>
              <input
                type="date"
                className="form-input"
                value={incidentDate}
                onChange={(e) => setIncidentDate(e.target.value)}
                required
                style={{ fontSize: 13 }}
              />
            </div>
          </div>

          {/* Action Taken */}
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label" style={{ fontWeight: 600, fontSize: 13 }}>
              Disciplinary / Restorative Action Taken
            </label>
            <select
              className="form-input"
              value={actionTaken}
              onChange={(e) => setActionTaken(e.target.value)}
              style={{ fontSize: 13, height: 42 }}
            >
              <option value="Verbal Warning">Verbal Warning</option>
              <option value="Counseling Session">Counseling Session</option>
              <option value="Parent Notified">Parent Notified (Call / Message)</option>
              <option value="After-School Detention">After-School Detention</option>
              <option value="Referred to Class Teacher">Referred to Class Teacher</option>
              <option value="Referred to Academic Coordinator">Referred to Academic Coordinator</option>
              <option value="Behavior Contract Issued">Behavior Contract Issued</option>
              <option value="Other">Other Action…</option>
            </select>
          </div>

          {actionTaken === 'Other' && (
            <div className="form-group" style={{ marginBottom: 16 }}>
              <input
                type="text"
                className="form-input"
                placeholder="Specify action taken…"
                value={customAction}
                onChange={(e) => setCustomAction(e.target.value)}
                required
                style={{ fontSize: 13 }}
              />
            </div>
          )}

          {/* Detailed Incident Notes */}
          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label" style={{ fontWeight: 600, fontSize: 13 }}>
              Incident Notes &amp; Observations
            </label>
            <textarea
              className="form-input"
              rows={3}
              placeholder="Describe what occurred, context, student response, and any follow-up required..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ fontSize: 13, resize: 'vertical' }}
            />
          </div>

          {/* Footer actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 8, borderTop: '1px solid #E5E3DF' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
              style={{ padding: '8px 16px', fontSize: 13 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting}
              style={{
                padding: '8px 20px',
                fontSize: 13,
                background: '#A83B38',
                borderColor: '#8C312E',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <ShieldAlert size={15} />
              {isSubmitting ? 'Recording…' : `Deduct ${pointsDeducted} Points`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
