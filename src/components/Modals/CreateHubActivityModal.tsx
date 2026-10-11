'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Users, Upload, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { HubActivity, UserProfile } from '@/lib/supabaseClient';

interface CreateHubActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (activityData: {
    title: string;
    type: string;
    description: string;
    date: string;
    videoUrl?: string;
    targetGrades: string[];
    location?: string;
    maxCapacity?: number;
    enrolledStudentIds?: string[];
  }) => void;
  onUpdate?: (id: string, activityData: {
    title: string;
    type: string;
    description: string;
    date: string;
    videoUrl?: string;
    targetGrades: string[];
    location?: string;
    maxCapacity?: number;
    enrolledStudentIds?: string[];
  }) => void;
  editActivity?: HubActivity | null;
  teacherClass?: string;
  userRole?: string;
  profiles?: UserProfile[];
}

const TYPE_OPTIONS = [
  { value: 'Club Registration', label: 'Club Registration', color: '#7C3AED' },
  { value: 'Workshop', label: 'Workshop', color: '#2563EB' },
  { value: 'Event', label: 'Event', color: '#D97706' },
  { value: 'Leadership Programme', label: 'Leadership Programme', color: '#059669' },
  { value: 'Volunteer Opportunity', label: 'Volunteer Opportunity', color: '#DC2626' },
  { value: 'Counselling Appointment', label: 'Counselling Appointment', color: '#0891B2' },
  { value: 'Summer Programme', label: 'Summer Programme', color: '#EA580C' },
  { value: 'Sports & Athletics', label: 'Sports & Athletics', color: '#16A34A' },
  { value: 'Science & Technology', label: 'Science & Technology', color: '#4F46E5' },
  { value: 'Arts & Culture', label: 'Arts & Culture', color: '#C026D3' },
];

const GRADE_OPTIONS = ['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'];

export const CreateHubActivityModal: React.FC<CreateHubActivityModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  onUpdate,
  editActivity,
  teacherClass,
  userRole,
  profiles = [],
}) => {
  const isEditing = Boolean(editActivity);
  const isAdmin = userRole === 'admin';

  const [title, setTitle] = useState('');
  const [type, setType] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [location, setLocation] = useState('');
  const [maxCapacity, setMaxCapacity] = useState('');
  const [targetGrades, setTargetGrades] = useState<string[]>([]);
  const [autoEnrollClass, setAutoEnrollClass] = useState<boolean>(true);
  const [uploadedStudentIds, setUploadedStudentIds] = useState<string[]>([]);
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [error, setError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const allStudents = useMemo(() => {
    return (profiles || []).filter((p) => p.role === 'student');
  }, [profiles]);

  // Target class students (e.g. from 10-O)
  const targetClassStudents = useMemo(() => {
    if (!teacherClass) return [];
    const cleanClass = teacherClass.toLowerCase().replace(/grade\s*/gi, '').trim();
    const parts = cleanClass.split(/[-\s]+/);
    const gradeNum = parts.find((p) => /^\d+$/.test(p)) || '';
    const sectionLetter = parts.find((p) => /^[a-z]$/.test(p))?.toUpperCase() || '';

    return allStudents.filter((s) => {
      const sGrade = (s.grade || '').replace(/[^0-9]/g, '');
      const sLetter = (s.class_letter || '').toUpperCase().trim();
      if (gradeNum && sGrade !== gradeNum) return false;
      if (sectionLetter && sLetter !== sectionLetter) return false;
      return true;
    });
  }, [allStudents, teacherClass]);

  // Target grades students
  const targetGradesStudents = useMemo(() => {
    if (!targetGrades || targetGrades.length === 0) return [];
    const targets = targetGrades.map((t) =>
      String(t || '').toLowerCase().replace(/\s+/g, '').replace(/^grade/, '')
    );
    return allStudents.filter((s) => {
      const sGrade = (s.grade || '').replace(/[^0-9]/g, '');
      const sLetter = (s.class_letter || '').toUpperCase().trim();
      const sClassKey = `${sGrade}-${sLetter}`.toLowerCase();
      return targets.some((t) => t === sGrade || t === sClassKey);
    });
  }, [allStudents, targetGrades]);

  // Compute final enrolled IDs to submit (must be before any early return)
  const computedEnrolledIds = useMemo(() => {
    let ids = [...uploadedStudentIds];
    if (autoEnrollClass) {
      if (targetClassStudents.length > 0) {
        ids = [...ids, ...targetClassStudents.map((s) => s.id)];
      } else if (targetGradesStudents.length > 0) {
        ids = [...ids, ...targetGradesStudents.map((s) => s.id)];
      }
    }
    return Array.from(new Set(ids));
  }, [uploadedStudentIds, autoEnrollClass, targetClassStudents, targetGradesStudents]);

  useEffect(() => {
    if (editActivity) {
      setTitle(editActivity.title || '');
      setType(editActivity.type || '');
      setDescription(editActivity.description || '');
      setDate(editActivity.date || '');
      setVideoUrl(editActivity.video_url || '');
      setLocation((editActivity as any).location || '');
      setMaxCapacity(String((editActivity as any).max_capacity || ''));
      setTargetGrades(Array.isArray(editActivity.target_grades) ? editActivity.target_grades : []);
      setUploadedStudentIds(Array.isArray(editActivity.enrolled_student_ids) ? editActivity.enrolled_student_ids : []);
      setAutoEnrollClass(false);
    } else {
      setTitle('');
      setType('');
      setDescription('');
      setDate('');
      setVideoUrl('');
      setLocation('');
      setMaxCapacity('');
      const gradeNum = (teacherClass || '').replace(/[^0-9]/g, '');
      setTargetGrades(isAdmin ? [] : (gradeNum ? [`Grade ${gradeNum}`] : []));
      setUploadedStudentIds([]);
      setAutoEnrollClass(true);
    }
    setError('');
    setUploadMessage(null);
  }, [editActivity, isOpen, teacherClass, isAdmin]);

  if (!isOpen) return null;

  const handleGradeToggle = (grade: string) => {
    setTargetGrades((prev) =>
      prev.includes(grade) ? prev.filter((g) => g !== grade) : [...prev, grade]
    );
  };

  // Upload Excel / CSV roster
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (rows.length === 0) {
          setUploadMessage({ type: 'error', text: 'The uploaded file contains no data rows.' });
          return;
        }

        const byAdmission = new Map<string, string>();
        const byCode = new Map<string, string>();
        const byEmail = new Map<string, string>();
        const byName = new Map<string, string>();

        allStudents.forEach((s) => {
          if (s.admission_number) byAdmission.set(s.admission_number.toLowerCase().trim(), s.id);
          if (s.user_code) byCode.set(s.user_code.toLowerCase().trim(), s.id);
          if (s.email) byEmail.set(s.email.toLowerCase().trim(), s.id);
          if (s.name) byName.set(s.name.toLowerCase().replace(/\s+/g, ' ').trim(), s.id);
        });

        const matchedIds: string[] = [];
        for (const row of rows) {
          for (const val of Object.values(row)) {
            const strVal = String(val).toLowerCase().trim();
            if (!strVal) continue;
            let foundId = byAdmission.get(strVal) || byCode.get(strVal) || byEmail.get(strVal) || byName.get(strVal);
            if (foundId && !matchedIds.includes(foundId)) {
              matchedIds.push(foundId);
              break;
            }
          }
        }

        if (matchedIds.length > 0) {
          setUploadedStudentIds((prev) => Array.from(new Set([...prev, ...matchedIds])));
          setUploadMessage({
            type: 'success',
            text: `✓ Matched and added ${matchedIds.length} students from "${file.name}".`,
          });
        } else {
          setUploadMessage({
            type: 'error',
            text: `No students matched in "${file.name}". Ensure columns contain Admission Numbers or Names.`,
          });
        }
      } catch (err: any) {
        console.error('Spreadsheet read error:', err);
        setUploadMessage({ type: 'error', text: 'Failed to read spreadsheet file.' });
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError('Activity title is required.'); return; }
    if (!type) { setError('Please select an activity type.'); return; }
    if (!description.trim()) { setError('Description is required.'); return; }
    if (!date) { setError('Date / deadline is required.'); return; }
    setError('');

    let finalGrades = targetGrades;
    if (!isAdmin) {
      const gradeNum = (teacherClass || '').replace(/[^0-9]/g, '');
      const effectiveClass = teacherClass || '';
      finalGrades = Array.from(new Set([gradeNum, effectiveClass].filter(Boolean)));
    }
    if (finalGrades.length === 0) finalGrades = GRADE_OPTIONS;

    const payload = {
      title: title.trim(),
      type,
      description: description.trim(),
      date,
      videoUrl: videoUrl.trim() || undefined,
      targetGrades: finalGrades,
      location: location.trim() || undefined,
      maxCapacity: maxCapacity ? Number(maxCapacity) : undefined,
      enrolledStudentIds: computedEnrolledIds,
    };

    if (isEditing && editActivity && onUpdate) {
      onUpdate(editActivity.id, payload);
    } else {
      onSubmit(payload);
    }
    onClose();
  };

  const typeColor = TYPE_OPTIONS.find((t) => t.value === type)?.color || '#2C6E6A';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#FFFFFF',
          borderRadius: 14,
          width: '100%',
          maxWidth: 640,
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'sticky',
            top: 0,
            background: '#FFFFFF',
            zIndex: 10,
            borderRadius: '14px 14px 0 0',
          }}
        >
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#2C6E6A', marginBottom: 2 }}>
              CO-CURRICULAR HUB
            </div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--neutral-dark)' }}>
              {isEditing ? 'Edit Activity' : 'Publish New Activity'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: '1px solid var(--border-color)',
              background: 'var(--surface)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
            }}
          >
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Title */}
          <div>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--neutral-dark)', marginBottom: 6 }}>
              Activity Title <span style={{ color: '#D9534F' }}>*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Robotics & AI Innovation Lab"
              style={{
                width: '100%',
                padding: '10px 14px',
                fontSize: 14,
                border: '1.5px solid var(--border-color)',
                borderRadius: 8,
                fontFamily: 'inherit',
                color: 'var(--neutral-dark)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              required
            />
          </div>

          {/* Type pills */}
          <div>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--neutral-dark)', marginBottom: 8 }}>
              Activity Type <span style={{ color: '#D9534F' }}>*</span>
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setType(opt.value)}
                  style={{
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 20,
                    cursor: 'pointer',
                    border: `1.5px solid ${type === opt.value ? opt.color : 'var(--border-color)'}`,
                    background: type === opt.value ? opt.color + '18' : 'var(--surface)',
                    color: type === opt.value ? opt.color : 'var(--text-secondary)',
                    transition: 'all 0.15s',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--neutral-dark)', marginBottom: 6 }}>
              Description <span style={{ color: '#D9534F' }}>*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the programme, requirements, and what students will gain…"
              rows={3}
              style={{
                width: '100%',
                padding: '10px 14px',
                fontSize: 13,
                lineHeight: 1.5,
                border: '1.5px solid var(--border-color)',
                borderRadius: 8,
                fontFamily: 'inherit',
                color: 'var(--neutral-dark)',
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
              required
            />
          </div>

          {/* Date + Location */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--neutral-dark)', marginBottom: 6 }}>
                Date / Deadline <span style={{ color: '#D9534F' }}>*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: 13,
                  border: '1.5px solid var(--border-color)',
                  borderRadius: 8,
                  fontFamily: 'inherit',
                  color: 'var(--neutral-dark)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--neutral-dark)', marginBottom: 6 }}>
                Location (optional)
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Room 204 / Innovation Lab"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: 13,
                  border: '1.5px solid var(--border-color)',
                  borderRadius: 8,
                  fontFamily: 'inherit',
                  color: 'var(--neutral-dark)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Video + Capacity */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--neutral-dark)', marginBottom: 6 }}>
                YouTube Video (optional)
              </label>
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: 12,
                  border: '1.5px solid var(--border-color)',
                  borderRadius: 8,
                  fontFamily: 'inherit',
                  color: 'var(--neutral-dark)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--neutral-dark)', marginBottom: 6 }}>
                Max Capacity
              </label>
              <input
                type="number"
                min={1}
                value={maxCapacity}
                onChange={(e) => setMaxCapacity(e.target.value)}
                placeholder="e.g. 30"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: 13,
                  border: '1.5px solid var(--border-color)',
                  borderRadius: 8,
                  fontFamily: 'inherit',
                  color: 'var(--neutral-dark)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Target Grades */}
          {isAdmin ? (
            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--neutral-dark)', marginBottom: 8 }}>
                Target Grades (blank = all)
              </label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {GRADE_OPTIONS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => handleGradeToggle(g)}
                    style={{
                      padding: '6px 14px',
                      fontSize: 12.5,
                      fontWeight: 600,
                      borderRadius: 6,
                      cursor: 'pointer',
                      border: `1.5px solid ${targetGrades.includes(g) ? '#2D2C2A' : 'var(--border-color)'}`,
                      background: targetGrades.includes(g) ? '#2D2C2A' : 'var(--surface)',
                      color: targetGrades.includes(g) ? '#FFFFFF' : 'var(--text-secondary)',
                    }}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                background: '#EAF3EF',
                border: '1px solid #C7E4D8',
                color: '#20554E',
                fontSize: 12.5,
                fontWeight: 600,
              }}
            >
              🔒 Audience automatically set to your class ({teacherClass || 'Your Class'})
            </div>
          )}

          {/* ROSTER & ENROLLMENT PERSISTENCE SECTION */}
          <div
            style={{
              padding: '16px',
              borderRadius: 10,
              background: '#F8FAF9',
              border: '1.5px solid #2C6E6A30',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={16} style={{ color: '#2C6E6A' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                  Activity Enrollment & Student Roster
                </span>
              </div>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: '#2C6E6A',
                  background: '#2C6E6A15',
                  padding: '3px 8px',
                  borderRadius: 12,
                }}
              >
                {computedEnrolledIds.length} Students To Enrol
              </span>
            </div>

            {/* Auto-enroll toggle */}
            {(targetClassStudents.length > 0 || targetGradesStudents.length > 0) && (
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: 'var(--neutral-dark)',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={autoEnrollClass}
                  onChange={(e) => setAutoEnrollClass(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: '#2C6E6A', cursor: 'pointer' }}
                />
                <span>
                  Auto-enrol all students from {teacherClass ? `Class ${teacherClass}` : 'target audience'} (
                  {targetClassStudents.length || targetGradesStudents.length} students)
                </span>
              </label>
            )}

            {/* Spreadsheet upload button */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: 8,
                background: '#FFFFFF',
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileSpreadsheet size={16} style={{ color: '#2C6E6A' }} />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Upload Excel/CSV roster with student admission numbers
                </span>
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '5px 12px',
                    borderRadius: 6,
                    border: '1px solid #2C6E6A',
                    background: '#2C6E6A15',
                    color: '#2C6E6A',
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <Upload size={12} />
                  Upload Roster
                </button>
              </div>
            </div>

            {uploadMessage && (
              <div
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  color: uploadMessage.type === 'success' ? '#065F46' : '#991B1B',
                }}
              >
                {uploadMessage.type === 'success' ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                {uploadMessage.text}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                color: '#D9534F',
                fontSize: 12.5,
                fontWeight: 600,
                padding: '8px 12px',
                background: '#FDF1F0',
                borderRadius: 6,
                border: '1px solid #FECACA',
              }}
            >
              {error}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 20px',
                fontSize: 13,
                fontWeight: 600,
                border: '1.5px solid var(--border-color)',
                borderRadius: 8,
                background: 'var(--surface)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                padding: '10px 24px',
                fontSize: 13,
                fontWeight: 700,
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                background: typeColor || '#2C6E6A',
                color: '#FFFFFF',
                boxShadow: `0 2px 8px ${typeColor || '#2C6E6A'}40`,
              }}
            >
              {isEditing ? '✓ Save Changes' : `🚀 Publish Activity (${computedEnrolledIds.length} Enrolled)`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
