'use client';

import React, { useState } from 'react';
import { TestItem } from '@/lib/supabaseClient';

interface ActiveTestModalProps {
  isOpen: boolean;
  test: TestItem | null;
  onClose: () => void;
  onSubmitTest: (testId: string, answers: Record<string, string>) => void;
}

const SAMPLE_QUESTIONS = [
  {
    id: 'q1',
    question: '1. What is the SI unit of Electric Field strength?',
    options: ['Newton per Coulomb (N/C) or Volt per meter (V/m)', 'Joule per meter (J/m)', 'Tesla (T)', 'Ampere per meter (A/m)'],
    correct: 'Newton per Coulomb (N/C) or Volt per meter (V/m)',
  },
  {
    id: 'q2',
    question: '2. According to Faraday’s Law of Electromagnetic Induction, the induced EMF is directly proportional to:',
    options: ['The rate of change of magnetic flux', 'The total resistance in the circuit', 'The electrostatic potential difference', 'The capacitance of the system'],
    correct: 'The rate of change of magnetic flux',
  },
  {
    id: 'q3',
    question: '3. What phenomenon explains the working of optical fibers?',
    options: ['Total Internal Reflection', 'Diffraction of Light', 'Photoelectric Effect', 'Polarization'],
    correct: 'Total Internal Reflection',
  },
];

export const ActiveTestModal: React.FC<ActiveTestModalProps> = ({
  isOpen,
  test,
  onClose,
  onSubmitTest,
}) => {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [isCompleted, setIsCompleted] = useState(false);
  const [score, setScore] = useState(0);

  if (!isOpen || !test) return null;

  const handleSelectOption = (qId: string, option: string) => {
    if (isCompleted) return;
    setSelectedAnswers((prev) => ({ ...prev, [qId]: option }));
  };

  const handleFinish = () => {
    let correctCount = 0;
    SAMPLE_QUESTIONS.forEach((q) => {
      if (selectedAnswers[q.id] === q.correct) {
        correctCount++;
      }
    });
    const finalScore = Math.round((correctCount / SAMPLE_QUESTIONS.length) * 100);
    setScore(finalScore);
    setIsCompleted(true);
    onSubmitTest(test.id, selectedAnswers);
  };

  const handleResetAndClose = () => {
    setSelectedAnswers({});
    setIsCompleted(false);
    onClose();
  };

  return (
    <div className="modal-overlay active" onClick={handleResetAndClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#2C6E6A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Online Examination Portal
            </span>
            <h2 className="modal-title" style={{ marginTop: 2 }}>{test.title}</h2>
          </div>
          <button type="button" className="close-modal" onClick={handleResetAndClose}>&times;</button>
        </div>

        {isCompleted ? (
          <div style={{ textAlign: 'center', padding: '24px 16px' }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: '#EAF3EF',
                color: '#2D6E5D',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
                margin: '0 auto 16px',
                fontWeight: 700,
              }}
            >
              ✓
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--neutral-dark)', margin: 0 }}>
              Assessment Completed!
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
              Your responses have been successfully submitted and recorded.
            </p>

            <div
              style={{
                background: '#FAF9F6',
                border: '1px solid var(--border-color)',
                borderRadius: 8,
                padding: '16px',
                margin: '20px 0',
                display: 'inline-block',
                minWidth: 200,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                Assessment Score
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#2C6E6A', marginTop: 2 }}>
                {score}%
              </div>
            </div>

            <div>
              <button className="btn-primary" onClick={handleResetAndClose} style={{ padding: '8px 24px' }}>
                Back to Dashboard
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ background: '#FAF9F6', border: '1px solid var(--border-color)', borderRadius: 6, padding: '10px 14px', marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--neutral-dark)' }}>
                Total Questions: {SAMPLE_QUESTIONS.length}
              </span>
              <span style={{ fontSize: 11, color: '#2C6E6A', fontWeight: 700 }}>
                Answered: {Object.keys(selectedAnswers).length} / {SAMPLE_QUESTIONS.length}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '55vh', overflowY: 'auto', paddingRight: 4 }}>
              {SAMPLE_QUESTIONS.map((q) => (
                <div key={q.id} style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: '14px 16px', background: '#FFFFFF' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--neutral-dark)', marginBottom: 10 }}>
                    {q.question}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {q.options.map((opt) => {
                      const isSelected = selectedAnswers[q.id] === opt;
                      return (
                        <label
                          key={opt}
                          onClick={() => handleSelectOption(q.id, opt)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '8px 12px',
                            borderRadius: 6,
                            border: isSelected ? '1.5px solid #2C6E6A' : '1px solid var(--border-color)',
                            background: isSelected ? '#F0F6F5' : '#FAF9F6',
                            cursor: 'pointer',
                            fontSize: 12,
                            fontWeight: isSelected ? 600 : 400,
                            color: 'var(--neutral-dark)',
                            transition: 'all 0.1s',
                          }}
                        >
                          <input
                            type="radio"
                            name={`q-${q.id}`}
                            checked={isSelected}
                            onChange={() => handleSelectOption(q.id, opt)}
                            style={{ accentColor: '#2C6E6A' }}
                          />
                          <span>{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
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
                disabled={Object.keys(selectedAnswers).length === 0}
                style={{ padding: '8px 20px', fontSize: 12 }}
              >
                Submit Answers
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
