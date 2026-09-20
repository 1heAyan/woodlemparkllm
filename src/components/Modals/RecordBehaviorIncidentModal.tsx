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
import { CustomSelect, CustomSelectOption } from '@/components/UI/CustomSelect';
import { ShieldAlert, ArrowRight, User, FileText } from 'lucide-react';

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
  const [incidentDate, setIncidentDate] = useState<string>('');
  const [incidentTime, setIncidentTime] = useState<string>('');
  const [subjectContext, setSubjectContext] = useState<string>('');
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
      setCustomReason('');
      setPointsDeducted(4);
      setActionTaken('Verbal Warning');
      setCustomAction('');
      setNotes('');
      setIsSubmitting(false);
    }
  }, [isOpen, preselectedStudentId, availableStudents, defaultSubject, teacherRole, currentUser.subject]);

  const selectedStudent = useMemo(() => {
    return availableStudents.find((s) => s.id === selectedStudentId) || null;
  }, [availableStudents, selectedStudentId]);

  // Current behavior score before deduction
  const currentScore = useMemo(() => {
    if (!selectedStudent) return BASE_BEHAVIOR_SCORE;
    return computeStudentBehaviorScore(selectedStudent.id, allIncidents);
  }, [selectedStudent, allIncidents]);

  // Projected behavior score after deduction
  const projectedScore = useMemo(() => {
    const points = Math.max(1, Number(pointsDeducted) || 1);
    return Math.max(0, currentScore - points);
  }, [currentScore, pointsDeducted]);

  const currentTier = useMemo(() => getBehaviorTier(currentScore), [currentScore]);
  const projectedTier = useMemo(() => getBehaviorTier(projectedScore), [projectedScore]);

  const handleCategoryChange = (newCat: BehaviorViolationCategory) => {
    setCategory(newCat);
    const preset = VIOLATION_PRESETS.find((p) => p.id === newCat);
    if (preset) {
      setPointsDeducted(preset.defaultPoints);
    }
  };

  // CustomSelect Options for Students (Searchable)
  const studentOptions: CustomSelectOption[] = useMemo(() => {
    return availableStudents.map((st) => ({
      value: st.id,
      label: `${st.name} ${st.admission_number || st.user_code ? `(${st.admission_number || st.user_code})` : ''} — Grade ${st.grade || '?'}-${st.class_letter || '?'}`,
      sublabel: `Adm: ${st.admission_number || st.user_code || 'N/A'} • Grade ${st.grade || '?'}-${st.class_letter || '?'}`,
    }));
  }, [availableStudents]);

  // CustomSelect Options for Violation Presets
  const categoryOptions: CustomSelectOption[] = useMemo(() => {
    return VIOLATION_PRESETS.map((p) => ({
      value: p.id,
      label: `${p.label} (Recommended: -${p.defaultPoints} pts)`,
      sublabel: p.description,
    }));
  }, []);

  // CustomSelect Options for Action Taken
  const actionOptions: CustomSelectOption[] = useMemo(() => [
    { value: 'Verbal Warning', label: 'Verbal Warning' },
    { value: 'Counseling Session', label: 'Counseling Session' },
    { value: 'Parent Notified', label: 'Parent Notified (Call / Message)' },
    { value: 'After-School Detention', label: 'After-School Detention' },
    { value: 'Referred to Class Teacher', label: 'Referred to Class Teacher' },
    { value: 'Referred to Academic Coordinator', label: 'Referred to Academic Coordinator' },
    { value: 'Behavior Contract Issued', label: 'Behavior Contract Issued' },
    { value: 'Other', label: 'Other Action…' },
  ], []);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) {
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
      subject_name: subjectContext.trim() || 'General Conduct',
      date: incidentDate || new Date().toISOString().slice(0, 10),
      incident_date: incidentDate || new Date().toISOString().slice(0, 10),
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
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Standard Woodlem Page Modal Header */}
        <div className="modal-header">
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#A83B38', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Student Conduct &amp; Discipline
            </span>
            <h2 className="modal-title" style={{ margin: '2px 0 0' }}>
              Record Behavior Incident
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              {teacherRole === 'class_teacher'
                ? 'Class Teacher Homeroom Conduct Logging (80-Point Annual Standard)'
                : `Subject Class: ${subjectContext || 'Course Faculty'} (80-Point Annual Standard)`}
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
            maxWidth: 740,
            width: '100%',
            margin: '0 auto',
            padding: '32px 36px 64px',
            overflowY: 'auto',
            flex: 1,
            boxSizing: 'border-box',
          }}
        >
          {/* CARD 1: Student Selection & Live Score Impact */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid var(--border-color)',
              borderRadius: 12,
              padding: '22px 24px',
              marginBottom: 20,
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--neutral-dark)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <User size={16} style={{ color: '#2C6E6A' }} />
              <span>Select Student</span>
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: 12.5 }}>
                Student Name &amp; Section <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <CustomSelect
                value={selectedStudentId}
                onChange={(val) => setSelectedStudentId(val)}
                options={studentOptions}
                placeholder="Search and select student…"
                disabled={!!preselectedStudentId}
                searchable={true}
              />
            </div>

            {/* Live Score Projection Preview */}
            {selectedStudent && (
              <div
                style={{
                  background: '#FBFBFA',
                  border: '1px solid #ECEAE5',
                  borderRadius: 10,
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                {/* Current */}
                <div>
                  <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: '0.04em' }}>
                    Current Score
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <span style={{ fontSize: 22, fontWeight: 800, color: currentTier.color }}>
                      {currentScore}
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>/ 80</span>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        padding: '1px 7px',
                        borderRadius: 10,
                        background: currentTier.badgeBg,
                        color: currentTier.color,
                        border: `1px solid ${currentTier.badgeBorder}`,
                      }}
                    >
                      {currentTier.tag}
                    </span>
                  </div>
                </div>

                {/* Arrow */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px', background: '#FDF1F0', borderRadius: 20, border: '1px solid #F5C6CB' }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#A83B38' }}>
                    -{pointsDeducted} pts
                  </span>
                  <ArrowRight size={14} style={{ color: '#A83B38' }} />
                </div>

                {/* Projected */}
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: '0.04em' }}>
                    Projected Score
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 4 }}>
                    <span style={{ fontSize: 22, fontWeight: 800, color: projectedTier.color }}>
                      {projectedScore}
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>/ 80</span>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        padding: '1px 7px',
                        borderRadius: 10,
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
          </div>

          {/* CARD 2: Infraction Category & Point Deduction */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid var(--border-color)',
              borderRadius: 12,
              padding: '22px 24px',
              marginBottom: 20,
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--neutral-dark)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldAlert size={16} style={{ color: '#A83B38' }} />
              <span>Violation Reason &amp; Point Deduction</span>
            </div>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: 12.5 }}>
                Violation Category <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <CustomSelect
                value={category}
                onChange={(val) => handleCategoryChange(val as BehaviorViolationCategory)}
                options={categoryOptions}
                placeholder="Select violation category…"
              />
              {category && (
                <p style={{ margin: '8px 0 0 0', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  {VIOLATION_PRESETS.find((p) => p.id === category)?.description}
                </p>
              )}
            </div>

            {category === 'other' && (
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12.5 }}>
                  Custom Infraction Title <span style={{ color: '#DC2626' }}>*</span>
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

            {/* Points deduction row */}
            <div className="form-group" style={{ margin: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12.5, margin: 0 }}>
                  Points to Deduct <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[2, 4, 5, 10].map((pt) => (
                    <button
                      key={pt}
                      type="button"
                      onClick={() => setPointsDeducted(pt)}
                      style={{
                        padding: '4px 10px',
                        fontSize: 11.5,
                        fontWeight: 700,
                        borderRadius: 6,
                        border: pointsDeducted === pt ? '1.5px solid #A83B38' : '1px solid var(--border-color)',
                        background: pointsDeducted === pt ? '#FDF1F0' : '#FFFFFF',
                        color: pointsDeducted === pt ? '#A83B38' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      -{pt} pts
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
                style={{ fontSize: 15, fontWeight: 800, color: '#A83B38', height: 42, maxWidth: 180 }}
              />
            </div>
          </div>

          {/* CARD 3: Context, Action Taken & Notes */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid var(--border-color)',
              borderRadius: 12,
              padding: '22px 24px',
              marginBottom: 24,
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--neutral-dark)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={16} style={{ color: '#2C6E6A' }} />
              <span>Context &amp; Disciplinary Notes</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 16 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12.5 }}>
                  Subject / Classroom Context
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Physics, Mathematics, Homeroom"
                  value={subjectContext}
                  onChange={(e) => setSubjectContext(e.target.value)}
                  style={{ fontSize: 13 }}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12.5 }}>
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

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: 12.5 }}>
                Restorative / Disciplinary Action Taken
              </label>
              <CustomSelect
                value={actionTaken}
                onChange={(val) => setActionTaken(val)}
                options={actionOptions}
                placeholder="Select action taken…"
              />
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

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: 12.5 }}>
                Observations &amp; Incident Description
              </label>
              <textarea
                className="form-input"
                rows={3}
                placeholder="Detail the event, context, student response, and any follow-up required..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ fontSize: 13, resize: 'vertical' }}
              />
            </div>
          </div>

          {/* Action Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, alignItems: 'center' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
              style={{ padding: '10px 20px', fontSize: 13.5 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting}
              style={{
                padding: '10px 24px',
                fontSize: 13.5,
                fontWeight: 700,
                background: '#A83B38',
                borderColor: '#8C312E',
                color: '#FFFFFF',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <ShieldAlert size={16} />
              {isSubmitting ? 'Recording…' : `Deduct ${pointsDeducted} Points`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
