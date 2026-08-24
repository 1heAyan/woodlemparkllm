'use client';

import React, { useState } from 'react';
import { TestItem } from '@/lib/supabaseClient';

interface ActiveTestModalProps {
  isOpen: boolean;
  test: TestItem | null;
  onClose: () => void;
  onSubmitTest: (testId: string, answers: Record<string, string>) => void;
}

export const ActiveTestModal: React.FC<ActiveTestModalProps> = ({
  isOpen,
  test,
  onClose,
  onSubmitTest,
}) => {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [isCompleted, setIsCompleted] = useState(false);
  const [score, setScore] = useState(0);
  const [scoreBreakdown, setScoreBreakdown] = useState<{ earned: number; total: number }>({ earned: 0, total: 0 });

  if (!isOpen || !test) return null;

  const questions = test.questions || [];
  const answeredCount = Object.keys(selectedAnswers).length;

  const handleSelectOption = (qId: string, option: string) => {
    if (isCompleted) return;
    setSelectedAnswers((prev) => ({ ...prev, [qId]: option }));
  };

  const handleTextAnswer = (qId: string, text: string) => {
    if (isCompleted) return;
    setSelectedAnswers((prev) => ({ ...prev, [qId]: text }));
  };

  const handleFinish = () => {
    let earned = 0;
    let total = 0;
    questions.forEach((q) => {
      const pts = q.points || 1;
      total += pts;
      if (q.type === 'mcq' && selectedAnswers[q.id] === q.correct) {
        earned += pts;
      }
      // Text questions are graded by teacher later — no auto-score
    });

    const mcqQuestions = questions.filter((q) => q.type === 'mcq');
    const finalScore = mcqQuestions.length > 0
      ? Math.round((earned / (mcqQuestions.reduce((s, q) => s + (q.points || 1), 0))) * 100)
      : 100;

    setScore(finalScore);
    setScoreBreakdown({ earned, total });
    setIsCompleted(true);
    onSubmitTest(test.id, selectedAnswers);
  };

  const handleResetAndClose = () => {
    setSelectedAnswers({});
    setIsCompleted(false);
    setScore(0);
    onClose();
  };

  const hasTextQuestions = questions.some((q) => q.type === 'text');
  const hasMcq = questions.some((q) => q.type === 'mcq');

  return (
    <div className="modal-overlay active" onClick={isCompleted ? handleResetAndClose : undefined}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#2C6E6A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Class Test
            </span>
            <h2 className="modal-title" style={{ marginTop: 2 }}>{test.title}</h2>
            {!isCompleted && (
              <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                {test.duration_minutes && (
                  <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', fontWeight: 600 }}>
                    ⏱ {test.duration_minutes} minutes
                  </span>
                )}
                <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', fontWeight: 600 }}>
                  📝 {questions.length} questions
                </span>
              </div>
            )}
          </div>
          <button type="button" className="close-modal" onClick={handleResetAndClose}>&times;</button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, maxWidth: 840, width: '100%', margin: '0 auto', padding: '32px 36px 60px', boxSizing: 'border-box' }}>
          {isCompleted ? (
            /* ── Results View ── */
            <div style={{ textAlign: 'center', padding: '28px 20px' }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%', background: '#EAF3EF', color: '#2D6E5D',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28, margin: '0 auto 16px', fontWeight: 700,
              }}>✓</div>

              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--neutral-dark)', margin: 0 }}>Class Test Submitted!</h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, marginBottom: 20 }}>
                Your responses have been submitted and recorded.
              </p>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 24 }}>
                {hasMcq && (
                  <div style={{
                    background: '#FAF9F6', border: '1px solid var(--border-color)',
                    borderRadius: 8, padding: '14px 22px', minWidth: 130,
                  }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>MCQ Score</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: '#2C6E6A', marginTop: 2 }}>{score}%</div>
                  </div>
                )}
                <div style={{
                  background: '#FAF9F6', border: '1px solid var(--border-color)',
                  borderRadius: 8, padding: '14px 22px', minWidth: 130,
                }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Marks Earned</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#2C6E6A', marginTop: 2 }}>
                    {scoreBreakdown.earned}/{scoreBreakdown.total}
                  </div>
                </div>
              </div>

              {hasTextQuestions && (
                <div style={{
                  background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8,
                  padding: '12px 16px', fontSize: 12, color: '#92400E', marginBottom: 20,
                }}>
                  ⏳ Open-ended answers will be reviewed and graded by your teacher.
                </div>
              )}

              <button className="btn-primary" onClick={handleResetAndClose} style={{ padding: '10px 28px' }}>
                Back to Dashboard
              </button>
            </div>
          ) : (
            /* ── Test Taking View ── */
            <div style={{ padding: '4px 0' }}>
              {/* Optional test-level media */}
              {test.media_url && (
                <div style={{ marginBottom: 16, borderRadius: 8, overflow: 'hidden' }}>
                  <img src={test.media_url} alt="Test instructions" style={{ width: '100%', maxHeight: 200, objectFit: 'cover' }} />
                </div>
              )}

              {/* Progress bar */}
              <div style={{
                background: '#FAF9F6', border: '1px solid var(--border-color)',
                borderRadius: 6, padding: '10px 14px', marginBottom: 18,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--neutral-dark)' }}>
                  {questions.length} Questions · {questions.reduce((s, q) => s + (q.points || 1), 0)} Total Marks
                </span>
                <span style={{ fontSize: 11.5, color: '#2C6E6A', fontWeight: 700 }}>
                  Answered: {answeredCount} / {questions.length}
                </span>
              </div>

              {questions.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '32px 0', fontSize: 13 }}>
                  This test has no questions yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '54vh', overflowY: 'auto', paddingRight: 4 }}>
                  {questions.map((q, idx) => (
                    <div
                      key={q.id}
                      style={{
                        border: '1px solid var(--border-color)', borderRadius: 10,
                        padding: '16px', background: '#FFFFFF',
                        borderLeft: `4px solid ${q.type === 'mcq' ? '#2C6E6A' : '#7C3AED'}`,
                      }}
                    >
                      {/* Question header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 20,
                          background: q.type === 'mcq' ? '#EAF3EF' : '#EDE9FE',
                          color: q.type === 'mcq' ? '#2D6E5D' : '#5B21B6',
                        }}>
                          {q.type === 'mcq' ? 'MCQ' : 'Text'}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Q{idx + 1}</span>
                        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#2C6E6A' }}>{q.points || 1} mark{(q.points || 1) > 1 ? 's' : ''}</span>
                      </div>

                      {/* Question text */}
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--neutral-dark)', marginBottom: 12, lineHeight: 1.5 }}>
                        {q.question}
                      </div>

                      {/* Optional question image */}
                      {q.image_url && (
                        <div style={{ marginBottom: 12 }}>
                          <img src={q.image_url} alt="Question visual" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 6, objectFit: 'contain' }} />
                        </div>
                      )}

                      {/* MCQ Options */}
                      {q.type === 'mcq' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                          {q.options.map((opt) => {
                            const isSelected = selectedAnswers[q.id] === opt;
                            const letter = String.fromCharCode(65 + q.options.indexOf(opt));
                            return (
                              <label
                                key={opt}
                                onClick={() => handleSelectOption(q.id, opt)}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 10,
                                  padding: '9px 14px', borderRadius: 7, cursor: 'pointer',
                                  border: isSelected ? '2px solid #2C6E6A' : '1px solid var(--border-color)',
                                  background: isSelected ? '#F0F6F5' : '#FAF9F6',
                                  fontSize: 12.5, fontWeight: isSelected ? 600 : 400,
                                  transition: 'all 0.12s',
                                }}
                              >
                                <input
                                  type="radio"
                                  name={`q-${q.id}`}
                                  checked={isSelected}
                                  onChange={() => handleSelectOption(q.id, opt)}
                                  style={{ accentColor: '#2C6E6A' }}
                                />
                                <span style={{ fontWeight: 700, color: '#64748B', minWidth: 18 }}>{letter}.</span>
                                <span>{opt}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}

                      {/* Text-based answer */}
                      {q.type === 'text' && (
                        <textarea
                          rows={4}
                          className="form-input"
                          placeholder="Write your answer here..."
                          value={selectedAnswers[q.id] || ''}
                          onChange={(e) => handleTextAnswer(q.id, e.target.value)}
                          style={{ resize: 'vertical', fontSize: 13 }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Submit bar */}
              <div style={{
                marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border-color)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
              }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {answeredCount < questions.length ? `${questions.length - answeredCount} question(s) unanswered` : '✓ All questions answered'}
                </span>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    onClick={handleResetAndClose}
                    style={{ padding: '8px 16px', fontSize: 12, fontWeight: 600, background: '#FAF9F6', border: '1px solid var(--border-color)', borderRadius: 6, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleFinish}
                    disabled={questions.length === 0}
                    style={{ padding: '8px 20px', fontSize: 12 }}
                  >
                    Submit Answers
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
