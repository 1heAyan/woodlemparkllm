'use client';

import React, { useState, useEffect } from 'react';
import { CustomSelect } from '@/components/UI/CustomSelect';
import { TestQuestion } from '@/lib/supabaseClient';

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
  }) => void;
}

export const CreateTestModal: React.FC<CreateTestModalProps> = ({
  isOpen,
  activeClass = '',
  onClose,
  onSubmit,
}) => {
  const [title, setTitle] = useState('');
  const [selectedClass, setSelectedClass] = useState(activeClass);
  const [durationMinutes, setDurationMinutes] = useState(30);

  // Dynamic Questions List
  const [questions, setQuestions] = useState<TestQuestion[]>([
    {
      id: `q-${Date.now()}-1`,
      question: 'What is the SI unit of Electric Field strength?',
      options: [
        'Newton per Coulomb (N/C) or Volt per meter (V/m)',
        'Joule per meter (J/m)',
        'Tesla (T)',
        'Ampere per meter (A/m)',
      ],
      correct: 'Newton per Coulomb (N/C) or Volt per meter (V/m)',
      points: 1,
    },
    {
      id: `q-${Date.now()}-2`,
      question: 'According to Faraday’s Law of Electromagnetic Induction, the induced EMF is directly proportional to:',
      options: [
        'The rate of change of magnetic flux',
        'The total resistance in the circuit',
        'The electrostatic potential difference',
        'The capacitance of the system',
      ],
      correct: 'The rate of change of magnetic flux',
      points: 1,
    },
  ]);

  useEffect(() => {
    setSelectedClass(activeClass || '');
  }, [activeClass, isOpen]);

  if (!isOpen) return null;

  const handleAddQuestion = () => {
    const newQ: TestQuestion = {
      id: `q-${Date.now()}-${questions.length + 1}`,
      question: '',
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correct: 'Option A',
      points: 1,
    };
    setQuestions((prev) => [...prev, newQ]);
  };

  const handleRemoveQuestion = (index: number) => {
    if (questions.length <= 1) {
      alert('An assessment must have at least 1 question.');
      return;
    }
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateQuestionText = (index: number, text: string) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, question: text } : q))
    );
  };

  const handleUpdateOption = (qIndex: number, optIndex: number, text: string) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIndex) return q;
        const oldOption = q.options[optIndex];
        const newOptions = [...q.options];
        newOptions[optIndex] = text;
        const newCorrect = q.correct === oldOption ? text : q.correct;
        return { ...q, options: newOptions, correct: newCorrect };
      })
    );
  };

  const handleSetCorrect = (qIndex: number, correctText: string) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === qIndex ? { ...q, correct: correctText } : q))
    );
  };

  const handleSetPoints = (qIndex: number, pts: number) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === qIndex ? { ...q, points: Math.max(1, pts) } : q))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Please enter an assessment title.');
      return;
    }

    // Validate that all questions have non-empty prompts
    for (let i = 0; i < questions.length; i++) {
      if (!questions[i].question.trim()) {
        alert(`Please enter a question prompt for Question ${i + 1}.`);
        return;
      }
    }

    onSubmit({
      title: title.trim(),
      className: activeClass || selectedClass,
      durationMinutes,
      questions,
    });

    setTitle('');
    onClose();
  };

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: 760, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#2C6E6A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Examination Builder
            </span>
            <h2 className="modal-title" style={{ margin: '2px 0 0' }}>Create Online Assessment</h2>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              Publish an interactive multiple-choice test with auto-grading and anti-cheat protection.
            </p>
          </div>
          <button type="button" className="close-modal" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', flex: 1, paddingRight: 4 }}>
          {/* Top Parameters */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 14 }}>
            {activeClass ? (
              <div style={{ padding: '10px 12px', background: '#F8F7F4', border: '1px solid var(--border-color)', borderRadius: 6 }}>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                  Target Classroom
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#2C6E6A', marginTop: 2 }}>
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
              <label className="form-label">Duration (Minutes)</label>
              <CustomSelect
                value={durationMinutes.toString()}
                onChange={(val) => setDurationMinutes(parseInt(val, 10))}
                options={[
                  { value: '15', label: '15 Minutes' },
                  { value: '30', label: '30 Minutes (Standard)' },
                  { value: '45', label: '45 Minutes' },
                  { value: '60', label: '60 Minutes (1 Hour)' },
                  { value: '90', label: '90 Minutes' },
                ]}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Assessment Title <span style={{ color: '#EF4444' }}>*</span></label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Unit 3: Thermodynamics & Kinetic Theory Assessment"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
            />
          </div>

          {/* ── QUESTION BUILDER SECTION ── */}
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                Assessment Questions ({questions.length})
              </h3>
              <button
                type="button"
                onClick={handleAddQuestion}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: '1px solid #C7E4D8',
                  background: '#EAF3EF',
                  color: '#2D6E5D',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                + Add Question
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {questions.map((q, qIdx) => (
                <div
                  key={q.id}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    padding: '16px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                  }}
                >
                  {/* Question Card Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#2C6E6A' }}>
                      Question #{qIdx + 1}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <label style={{ fontSize: 11.5, color: '#64748B', display: 'flex', alignItems: 'center', gap: 4 }}>
                        Marks:
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={q.points || 1}
                          onChange={(e) => handleSetPoints(qIdx, parseInt(e.target.value, 10) || 1)}
                          style={{
                            width: 48,
                            padding: '3px 6px',
                            borderRadius: 4,
                            border: '1px solid #CBD5E1',
                            fontSize: 12,
                            textAlign: 'center',
                          }}
                        />
                      </label>
                      {questions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveQuestion(qIdx)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#EF4444',
                            fontSize: 11.5,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Question Prompt */}
                  <div style={{ marginBottom: 12 }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder={`e.g. Enter question ${qIdx + 1} prompt...`}
                      value={q.question}
                      onChange={(e) => handleUpdateQuestionText(qIdx, e.target.value)}
                      required
                    />
                  </div>

                  {/* Options with Correct Answer Selector */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                      Options &amp; Correct Answer (Click radio to mark correct)
                    </div>
                    {q.options.map((opt, optIdx) => {
                      const isCorrect = q.correct === opt;
                      const letter = String.fromCharCode(65 + optIdx);

                      return (
                        <div
                          key={optIdx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '4px 8px',
                            background: isCorrect ? '#ECFDF5' : '#F8FAFC',
                            border: isCorrect ? '1.5px solid #10B981' : '1px solid #E2E8F0',
                            borderRadius: 6,
                          }}
                        >
                          <input
                            type="radio"
                            name={`correct-${q.id}`}
                            checked={isCorrect}
                            onChange={() => handleSetCorrect(qIdx, opt)}
                            style={{ accentColor: '#10B981', cursor: 'pointer', width: 16, height: 16 }}
                            title="Mark as correct answer"
                          />
                          <span style={{ fontSize: 12, fontWeight: 700, color: isCorrect ? '#065F46' : '#64748B', width: 18 }}>
                            {letter}.
                          </span>
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => handleUpdateOption(qIdx, optIdx, e.target.value)}
                            placeholder={`Option ${letter}`}
                            style={{
                              flex: 1,
                              padding: '6px 10px',
                              borderRadius: 4,
                              border: '1px solid #CBD5E1',
                              fontSize: 12.5,
                              background: '#FFFFFF',
                            }}
                            required
                          />
                          {isCorrect && (
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#059669', paddingRight: 4 }}>
                              Correct Answer
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 24, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" style={{ padding: '10px 24px' }}>
              Publish Assessment ({questions.length} Questions)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
