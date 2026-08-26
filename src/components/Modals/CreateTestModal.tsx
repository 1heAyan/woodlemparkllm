'use client';

import React, { useState, useEffect, useRef } from 'react';
import { CustomSelect } from '@/components/UI/CustomSelect';
import { TestQuestion } from '@/lib/supabaseClient';
import { Paperclip, Image as ImageIcon, Check, X } from 'lucide-react';

const ALL_SECTIONS = [
  '9-A', '9-B', '9-C', '9-D',
  '10-A', '10-B', '10-C', '10-D',
  '11-A', '11-B', '11-C', '11-D',
  '12-A', '12-B', '12-C', '12-D',
  'All Classes',
] as const;

interface CreateTestModalProps {
  isOpen: boolean;
  activeClass?: string;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    className?: string;
    durationMinutes?: number;
    questions: TestQuestion[];
    mediaUrl?: string;
  }) => void;
}

const makeBlankMCQ = (idx: number): TestQuestion => ({
  id: `q-${Date.now()}-${idx}`,
  type: 'mcq',
  question: '',
  options: ['', '', '', ''],
  correct: '',
  points: 1,
});

const makeBlankText = (idx: number): TestQuestion => ({
  id: `q-${Date.now()}-${idx}`,
  type: 'text',
  question: '',
  options: [],
  correct: '',
  model_answer: '',
  points: 1,
});

export const CreateTestModal: React.FC<CreateTestModalProps> = ({
  isOpen,
  activeClass = '',
  onClose,
  onSubmit,
}) => {
  const [title, setTitle] = useState('');
  const [selectedClass, setSelectedClass] = useState(activeClass);
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [mediaUrl, setMediaUrl] = useState('');
  const [questions, setQuestions] = useState<TestQuestion[]>([makeBlankMCQ(1)]);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSelectedClass(activeClass || '');
  }, [activeClass, isOpen]);

  if (!isOpen) return null;

  /* ── Question Helpers ── */
  const addQuestion = (type: 'mcq' | 'text') => {
    setQuestions((prev) => [
      ...prev,
      type === 'mcq' ? makeBlankMCQ(prev.length + 1) : makeBlankText(prev.length + 1),
    ]);
  };

  const removeQuestion = (idx: number) => {
    if (questions.length <= 1) {
      alert('A class test must have at least 1 question.');
      return;
    }
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateQ = (idx: number, patch: Partial<TestQuestion>) => {
    setQuestions((prev) => prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  };

  const updateOption = (qIdx: number, optIdx: number, text: string) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        const opts = [...q.options];
        opts[optIdx] = text;
        // correct is stored as index tag — no need to chase text
        return { ...q, options: opts };
      })
    );
  };

  const handleQuestionImageUpload = (qIdx: number, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => updateQ(qIdx, { image_url: e.target?.result as string });
    reader.readAsDataURL(file);
  };

  const handleMediaUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => setMediaUrl(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Please enter a Class Test title.');
      return;
    }
    for (let i = 0; i < questions.length; i++) {
      if (!questions[i].question.trim()) {
        alert(`Please enter question text for Question ${i + 1}.`);
        return;
      }
      if (questions[i].type === 'mcq') {
        if (questions[i].options.some((o) => !o.trim())) {
          alert(`All options for Question ${i + 1} must be filled.`);
          return;
        }
        if (!questions[i].correct || !questions[i].correct.startsWith('__idx__')) {
          alert(`Please select the correct answer for Question ${i + 1} using the radio button.`);
          return;
        }
      }
    }
    // Resolve index tags back to option text before saving
    const resolvedQuestions = questions.map((q) => {
      if (q.type !== 'mcq' || !q.correct.startsWith('__idx__')) return q;
      const idx = parseInt(q.correct.replace('__idx__', ''), 10);
      const resolvedText = q.options[idx] ?? q.correct;
      return { ...q, correct: resolvedText };
    });
    onSubmit({
      title: title.trim(),
      className: activeClass || selectedClass,
      durationMinutes,
      questions: resolvedQuestions,
      mediaUrl: mediaUrl || undefined,
    });
    setTitle('');
    setMediaUrl('');
    setQuestions([makeBlankMCQ(1)]);
    onClose();
  };

  const totalMarks = questions.reduce((sum, q) => sum + (q.points || 1), 0);

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#2C6E6A',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Class Test Builder
            </span>
            <h2 className="modal-title" style={{ margin: '2px 0 0' }}>
              Create Class Test
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              Build an interactive class test with multiple-choice and open-ended questions.
            </p>
          </div>
          <button type="button" className="close-modal" onClick={onClose}>
            &times;
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form
          onSubmit={handleSubmit}
          style={{
            maxWidth: 860,
            width: '100%',
            margin: '0 auto',
            padding: '32px 36px 64px',
            overflowY: 'auto',
            flex: 1,
            boxSizing: 'border-box',
          }}
        >
          {/* Top Parameters Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 14,
              marginBottom: 18,
            }}
          >
            {activeClass ? (
              <div
                style={{
                  padding: '12px 14px',
                  background: '#F8F7F4',
                  border: '1px solid var(--border-color)',
                  borderRadius: 8,
                }}
              >
                <div
                  style={{
                    fontSize: 10.5,
                    color: 'var(--text-secondary)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  Target Classroom
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#2C6E6A', marginTop: 4 }}>
                  {activeClass}
                </div>
              </div>
            ) : (
              <div className="form-group" style={{ margin: 0 }}>
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

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Test Duration</label>
              <CustomSelect
                value={durationMinutes.toString()}
                onChange={(val) => setDurationMinutes(parseInt(val, 10))}
                options={[
                  { value: '15', label: '15 Minutes' },
                  { value: '30', label: '30 Minutes' },
                  { value: '45', label: '45 Minutes' },
                  { value: '60', label: '1 Hour' },
                  { value: '90', label: '90 Minutes' },
                  { value: '120', label: '2 Hours' },
                ]}
              />
            </div>

            <div
              style={{
                padding: '12px 14px',
                background: '#EAF3EF',
                border: '1px solid #C7E4D8',
                borderRadius: 8,
              }}
            >
              <div
                style={{
                  fontSize: 10.5,
                  color: '#2C6E6A',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Total Marks
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#2C6E6A', marginTop: 2 }}>
                {totalMarks} <span style={{ fontSize: 12, fontWeight: 600, color: '#2C6E6A' }}>Points</span>
              </div>
            </div>
          </div>

          {/* Test Title */}
          <div className="form-group" style={{ marginBottom: 18 }}>
            <label className="form-label">
              Class Test Title <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Unit 3: Thermodynamics & Heat Transfer Test"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
            />
          </div>

          {/* Optional Test-Level Header Media */}
          <div className="form-group" style={{ marginBottom: 24 }}>
            <label className="form-label">Attach Test Header Media / Instructions (Optional)</label>
            <div
              onClick={() => mediaInputRef.current?.click()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                border: '1.5px dashed #CBD5E1',
                borderRadius: 8,
                cursor: 'pointer',
                background: mediaUrl ? '#EAF3EF' : '#FAFAF8',
                fontSize: 13,
                color: 'var(--text-secondary)',
                transition: 'all 0.15s ease',
              }}
            >
              {mediaUrl ? (
                <>
                  <img
                    src={mediaUrl}
                    alt="Test instructions"
                    style={{ height: 42, width: 42, objectFit: 'cover', borderRadius: 4 }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#2C6E6A', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                      Header Image Attached <Check size={14} />
                    </div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>Click to change or replace</div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMediaUrl('');
                    }}
                    style={{
                      color: '#EF4444',
                      background: '#FDF1F0',
                      border: '1px solid #F5C6CB',
                      borderRadius: 4,
                      padding: '4px 10px',
                      cursor: 'pointer',
                      fontSize: 11.5,
                      fontWeight: 600,
                    }}
                  >
                    Remove
                  </button>
                </>
              ) : (
                <>
                  <Paperclip size={18} style={{ color: '#64748B' }} />
                  <span>Click to attach an image or diagram for the test header</span>
                </>
              )}
              <input
                ref={mediaInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => e.target.files?.[0] && handleMediaUpload(e.target.files[0])}
              />
            </div>
          </div>

          {/* ── QUESTION BUILDER SECTION ── */}
          <div style={{ marginTop: 24 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
                paddingBottom: 8,
                borderBottom: '1.5px solid var(--border-color)',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                  Questions ({questions.length})
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                  Add multiple-choice or written-answer questions
                </p>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => addQuestion('mcq')}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 6,
                    border: '1px solid #2D2C2A',
                    background: '#2D2C2A',
                    color: '#FFFFFF',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  + Add MCQ
                </button>
                <button
                  type="button"
                  onClick={() => addQuestion('text')}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 6,
                    border: '1px solid #E2E8F0',
                    background: '#F8FAFC',
                    color: '#475569',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  + Add Text Question
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {questions.map((q, qIdx) => (
                <div
                  key={q.id}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid var(--border-color)',
                    borderRadius: 10,
                    padding: '18px 20px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                    borderLeft: `4px solid ${q.type === 'mcq' ? '#2C6E6A' : '#7C3AED'}`,
                  }}
                >
                  {/* Card Header */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 14,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 800,
                          padding: '3px 9px',
                          borderRadius: 20,
                          textTransform: 'uppercase',
                          background: q.type === 'mcq' ? '#EAF3EF' : '#EDE9FE',
                          color: q.type === 'mcq' ? '#2D6E5D' : '#5B21B6',
                        }}
                      >
                        {q.type === 'mcq' ? 'Multiple Choice' : 'Written Answer'}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>
                        Question #{qIdx + 1}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <label
                        style={{
                          fontSize: 12,
                          color: '#64748B',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          fontWeight: 600,
                        }}
                      >
                        Marks:
                        <input
                          type="number"
                          min="1"
                          max="50"
                          value={q.points || 1}
                          onChange={(e) =>
                            updateQ(qIdx, { points: Math.max(1, parseInt(e.target.value, 10) || 1) })
                          }
                          style={{
                            width: 50,
                            padding: '4px 6px',
                            borderRadius: 4,
                            border: '1px solid #CBD5E1',
                            fontSize: 12.5,
                            textAlign: 'center',
                            fontWeight: 700,
                          }}
                        />
                      </label>
                      {questions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeQuestion(qIdx)}
                          style={{
                            background: '#FDF1F0',
                            border: '1px solid #F5C6CB',
                            color: '#A83B38',
                            borderRadius: 4,
                            padding: '3px 8px',
                            fontSize: 11.5,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Question Prompt */}
                  <div style={{ marginBottom: 12 }}>
                    <label className="form-label" style={{ fontSize: 11.5 }}>
                      Question Prompt <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <textarea
                      className="form-input"
                      rows={2}
                      placeholder={`Enter question ${qIdx + 1} prompt or problem statement...`}
                      value={q.question}
                      onChange={(e) => updateQ(qIdx, { question: e.target.value })}
                      style={{ resize: 'vertical' }}
                      required
                    />
                  </div>

                  {/* Optional Question Image */}
                  <div style={{ marginBottom: 14 }}>
                    <label
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 12px',
                        borderRadius: 6,
                        border: '1px dashed #CBD5E1',
                        cursor: 'pointer',
                        fontSize: 11.5,
                        color: 'var(--text-secondary)',
                        background: '#FAFAFA',
                      }}
                    >
                      {q.image_url ? (
                        <>
                          <img
                            src={q.image_url}
                            alt=""
                            style={{ height: 32, width: 32, objectFit: 'cover', borderRadius: 3 }}
                          />
                          <span style={{ color: '#2C6E6A', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                            Diagram / Figure attached <Check size={13} />
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              updateQ(qIdx, { image_url: undefined });
                            }}
                            style={{
                              color: '#EF4444',
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: 12,
                              padding: 0,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 2,
                            }}
                          >
                            <X size={12} /> Remove
                          </button>
                        </>
                      ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <ImageIcon size={14} /> Attach diagram/image to this question (optional)
                        </span>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) =>
                          e.target.files?.[0] && handleQuestionImageUpload(qIdx, e.target.files[0])
                        }
                      />
                    </label>
                  </div>

                  {/* MCQ Options */}
                  {q.type === 'mcq' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: '#64748B',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        Options — Click radio button to mark the correct answer
                      </div>
                      {q.options.map((opt, optIdx) => {
                        const idxTag = `__idx__${optIdx}`;
                        const isCorrect = q.correct === idxTag;
                        const letter = String.fromCharCode(65 + optIdx);

                        return (
                          <div
                            key={optIdx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              padding: '8px 12px',
                              background: isCorrect ? '#ECFDF5' : '#F8FAFC',
                              border: isCorrect ? '1.5px solid #10B981' : '1px solid #E2E8F0',
                              borderRadius: 6,
                              transition: 'all 0.12s ease',
                            }}
                          >
                            <input
                              type="radio"
                              name={`correct-${q.id}`}
                              checked={isCorrect}
                              onChange={() => updateQ(qIdx, { correct: idxTag })}
                              style={{ accentColor: '#10B981', cursor: 'pointer', width: 16, height: 16 }}
                              title="Mark as correct answer"
                            />
                            <span
                              style={{
                                fontSize: 12.5,
                                fontWeight: 700,
                                color: isCorrect ? '#065F46' : '#64748B',
                                width: 20,
                              }}
                            >
                              {letter}.
                            </span>
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => updateOption(qIdx, optIdx, e.target.value)}
                              placeholder={`Option ${letter}`}
                              style={{
                                flex: 1,
                                padding: '7px 10px',
                                borderRadius: 4,
                                border: '1px solid #CBD5E1',
                                fontSize: 13,
                                background: '#FFFFFF',
                              }}
                              required
                            />
                            {isCorrect && (
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  color: '#059669',
                                  paddingRight: 4,
                                  whiteSpace: 'nowrap',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3,
                                }}
                              >
                                <Check size={12} /> Correct Answer
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Text-Based Question Answer Guide */}
                  {q.type === 'text' && (
                    <div>
                      <label className="form-label" style={{ fontSize: 11.5 }}>
                        Model Answer / Marking Scheme (For Teacher Evaluation)
                      </label>
                      <textarea
                        className="form-input"
                        rows={3}
                        placeholder="Enter the expected key points or rubric criteria for grading this question..."
                        value={q.model_answer || ''}
                        onChange={(e) => updateQ(qIdx, { model_answer: e.target.value, correct: e.target.value })}
                        style={{ resize: 'vertical', fontSize: 12.5 }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Sticky Bottom Actions */}
          <div
            style={{
              marginTop: 32,
              paddingTop: 18,
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              gap: 12,
              justifyContent: 'flex-end',
              alignItems: 'center',
            }}
          >
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              style={{ padding: '10px 20px', fontSize: 13 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              style={{ padding: '10px 28px', fontSize: 13, fontWeight: 700 }}
            >
              Publish Class Test ({questions.length} Questions · {totalMarks} Marks)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
