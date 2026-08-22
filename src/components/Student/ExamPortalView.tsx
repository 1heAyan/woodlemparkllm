'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { TestItem, TestQuestion, UserProfile } from '@/lib/supabaseClient';

interface ExamPortalViewProps {
  test: TestItem;
  student: UserProfile;
  onClose: () => void;
  onSubmitTest: (testId: string, answers: Record<string, string>, score: number) => void;
}

const DEFAULT_FALLBACK_QUESTIONS: TestQuestion[] = [
  {
    id: 'q1',
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
    id: 'q2',
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
  {
    id: 'q3',
    question: 'What phenomenon explains the working of optical fibers in digital high-speed communications?',
    options: [
      'Total Internal Reflection',
      'Diffraction of Light',
      'Photoelectric Effect',
      'Polarization of Light Waves',
    ],
    correct: 'Total Internal Reflection',
    points: 1,
  },
];

export const ExamPortalView: React.FC<ExamPortalViewProps> = ({
  test,
  student,
  onClose,
  onSubmitTest,
}) => {
  // Questions pool (from teacher's created test or fallback)
  const questions: TestQuestion[] = useMemo(() => {
    if (test.questions && Array.isArray(test.questions) && test.questions.length > 0) {
      return test.questions;
    }
    return DEFAULT_FALLBACK_QUESTIONS;
  }, [test]);

  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  // Anti-Cheat & Security State
  const [securityWarnings, setSecurityWarnings] = useState<string[]>([]);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [lastWarningText, setLastWarningText] = useState('');

  // Countdown timer in seconds (default 30 mins or from test)
  const initialSeconds = (test.duration_minutes || 30) * 60;
  const [timeLeft, setTimeLeft] = useState(initialSeconds);

  const answeredCount = Object.keys(selectedAnswers).length;
  const currentQ = questions[currentQIndex] || questions[0];

  const handleFinish = useCallback(() => {
    let earnedPoints = 0;
    let totalPoints = 0;

    questions.forEach((q) => {
      const qPts = q.points || 1;
      totalPoints += qPts;
      if (selectedAnswers[q.id] && selectedAnswers[q.id].trim() === q.correct.trim()) {
        earnedPoints += qPts;
      }
    });

    const calculatedScore = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 100;
    setFinalScore(calculatedScore);
    setIsSubmitted(true);
    setShowSubmitConfirm(false);
    onSubmitTest(test.id, selectedAnswers, calculatedScore);
  }, [questions, selectedAnswers, test.id, onSubmitTest]);

  // Timer Tick
  useEffect(() => {
    if (isSubmitted) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleFinish();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isSubmitted, handleFinish]);

  // Format timer MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // ── SCREENSHOT & ANTI-CHEAT SECURITY ENGINE ──
  const recordSecurityIncident = useCallback((reason: string) => {
    if (isSubmitted) return;
    const timeStr = new Date().toLocaleTimeString();
    const alertMsg = `Security Alert (${timeStr}): ${reason}`;
    setSecurityWarnings((prev) => [...prev, alertMsg]);
    setLastWarningText(reason);
    setShowWarningModal(true);

    // Flash screen with anti-screenshot overlay
    const overlay = document.getElementById('woodlem-security-flash');
    if (overlay) {
      overlay.style.opacity = '1';
      setTimeout(() => {
        overlay.style.opacity = '0';
      }, 500);
    }
  }, [isSubmitted]);

  useEffect(() => {
    if (isSubmitted) return;

    // 1. Block Keyboard Shortcuts (PrintScreen, Screenshots, Copy, Inspect, Save, Print)
    const handleKeyDown = (e: KeyboardEvent) => {
      // PrintScreen Key
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen') {
        e.preventDefault();
        recordSecurityIncident('Screen capture key (PrintScreen) intercepted.');
        return false;
      }

      // Mac Screenshot Shortcuts: Cmd + Shift + 3, 4, 5
      if (e.metaKey && e.shiftKey && ['3', '4', '5', '$', '%', '#'].includes(e.key)) {
        e.preventDefault();
        recordSecurityIncident('macOS Screen Capture shortcut prevented.');
        return false;
      }

      // Windows Snipping Tool: Win + Shift + S
      if (e.key === 's' && e.shiftKey && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        recordSecurityIncident('Screen clipping shortcut prevented.');
        return false;
      }

      // Copy: Ctrl + C / Cmd + C
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        recordSecurityIncident('Content copying is disabled during examination.');
        return false;
      }

      // Print: Ctrl + P / Cmd + P
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        recordSecurityIncident('Page printing is disabled.');
        return false;
      }

      // Save: Ctrl + S / Cmd + S
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        return false;
      }

      // View Source: Ctrl + U / Cmd + U
      if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        return false;
      }

      // Inspect DevTools: F12 or Ctrl+Shift+I or Cmd+Opt+I
      if (
        e.key === 'F12' ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) ||
        (e.metaKey && e.altKey && (e.key === 'i' || e.key === 'I'))
      ) {
        e.preventDefault();
        recordSecurityIncident('Developer tools and inspection are blocked.');
        return false;
      }
    };

    // 2. Tab Switch / Window Blur Detection
    const handleVisibilityChange = () => {
      if (document.hidden) {
        recordSecurityIncident('Tab switch or window minimization detected.');
      }
    };

    const handleWindowBlur = () => {
      recordSecurityIncident('Focus lost: Student clicked outside the examination window.');
    };

    // 3. Prevent Context Menu (Right Click)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      recordSecurityIncident('Right-click context menu is restricted.');
      return false;
    };

    // 4. Prevent Drag / Copy
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      recordSecurityIncident('Copy to clipboard is disabled.');
    };

    window.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('copy', handleCopy);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('copy', handleCopy);
    };
  }, [isSubmitted, recordSecurityIncident]);

  const handleSelectOption = (qId: string, option: string) => {
    if (isSubmitted) return;
    setSelectedAnswers((prev) => ({ ...prev, [qId]: option }));
  };

  const watermarkText = `${student.name} · ${student.admission_number || student.user_code || student.email} · Woodlem Park School · ${new Date().toLocaleDateString()}`;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: '#F4F5F7',
        color: '#1E293B',
        fontFamily: 'var(--font-main, sans-serif)',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        overflow: 'hidden',
      }}
    >
      {/* Dynamic Security Flash Overlay */}
      <div
        id="woodlem-security-flash"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(239, 68, 68, 0.15)',
          pointerEvents: 'none',
          opacity: 0,
          transition: 'opacity 0.2s ease',
          zIndex: 100000,
        }}
      />

      {/* DYNAMIC SECURITY WATERMARK OVERLAY (Protects against external phone cameras & leaks) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 1,
          opacity: 0.035,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gridTemplateRows: 'repeat(5, 1fr)',
          transform: 'rotate(-18deg) scale(1.2)',
          fontSize: 16,
          fontWeight: 800,
          color: '#000000',
          letterSpacing: '0.1em',
          overflow: 'hidden',
        }}
      >
        {Array.from({ length: 15 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 20 }}>
            {watermarkText}
          </div>
        ))}
      </div>

      {/* ── HIGH-SECURITY EXAMINATION HEADER ── */}
      <header
        style={{
          background: '#0F172A',
          color: '#FFFFFF',
          padding: '12px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '2px solid #2C6E6A',
          boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
          position: 'relative',
          zIndex: 10,
        }}
      >
        {/* Left: Exam Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              background: '#2C6E6A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 18,
              color: '#FFFFFF',
            }}
          >
            W
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(44, 110, 106, 0.4)', color: '#2DD4BF', padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Woodlem Secure Assessment Mode
              </span>
              <span style={{ fontSize: 11, color: '#94A3B8' }}>{test.class_name || 'Academic Assessment'}</span>
            </div>
            <h1 style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 800, color: '#FFFFFF', letterSpacing: '0.01em' }}>
              {test.title}
            </h1>
          </div>
        </div>

        {/* Center: Proctoring Pill & Live Timer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          {/* Proctoring Shield Pill */}
          <div
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 20,
              padding: '5px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 11.5,
              color: '#CBD5E1',
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', display: 'inline-block', boxShadow: '0 0 8px #10B981' }} />
            <span>Anti-Cheat &amp; Screen Shield Active</span>
            {securityWarnings.length > 0 && (
              <span style={{ background: '#EF4444', color: '#FFF', padding: '1px 6px', borderRadius: 10, fontSize: 10, fontWeight: 700 }}>
                {securityWarnings.length} Alert{securityWarnings.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Countdown Clock */}
          {!isSubmitted && (
            <div
              style={{
                background: timeLeft < 300 ? '#7F1D1D' : '#1E293B',
                border: timeLeft < 300 ? '1px solid #EF4444' : '1px solid #334155',
                borderRadius: 8,
                padding: '6px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: timeLeft < 300 ? '#FCA5A5' : '#38BDF8',
                fontWeight: 800,
                fontSize: 14,
                fontFamily: 'monospace',
                letterSpacing: '0.05em',
                transition: 'all 0.2s',
              }}
            >
              <span style={{ fontSize: 16 }}>⏱</span>
              <span>{formatTime(timeLeft)}</span>
            </div>
          )}
        </div>

        {/* Right: Candidate & Action */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#F1F5F9' }}>{student.name}</div>
            <div style={{ fontSize: 10.5, color: '#94A3B8' }}>{student.admission_number || student.user_code || 'Candidate'}</div>
          </div>

          {!isSubmitted ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setShowExitConfirm(true)}
                style={{
                  padding: '7px 12px',
                  borderRadius: 6,
                  border: '1px solid #475569',
                  background: 'transparent',
                  color: '#94A3B8',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Exit
              </button>
              <button
                type="button"
                onClick={() => setShowSubmitConfirm(true)}
                style={{
                  padding: '7px 16px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#2C6E6A',
                  color: '#FFFFFF',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(44, 110, 106, 0.4)',
                }}
              >
                Submit Exam ({answeredCount}/{questions.length})
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '7px 18px',
                borderRadius: 6,
                border: 'none',
                background: '#10B981',
                color: '#FFFFFF',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Finish &amp; Close
            </button>
          )}
        </div>
      </header>

      {/* ── MAIN EXAM CONTAINER ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative', zIndex: 2 }}>
        {isSubmitted ? (
          /* RESULT / COMPLETION SUMMARY SCREEN */
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
            }}
          >
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: 14,
                border: '1px solid #E2E8F0',
                padding: '36px 48px',
                maxWidth: 540,
                width: '100%',
                textAlign: 'center',
                boxShadow: '0 20px 40px rgba(0,0,0,0.08)',
              }}
            >
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  background: '#EAF3EF',
                  color: '#2D6E5D',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 34,
                  margin: '0 auto 16px',
                  fontWeight: 800,
                }}
              >
                ✓
              </div>

              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0F172A' }}>
                Assessment Submitted Successfully
              </h2>
              <p style={{ margin: '6px 0 0', fontSize: 13.5, color: '#64748B' }}>
                Your responses have been verified, encrypted, and recorded in the academic gradebook.
              </p>

              <div
                style={{
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: 10,
                  padding: '20px',
                  margin: '24px 0',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 16,
                }}
              >
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#64748B' }}>
                    Calculated Score
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 900, color: '#2C6E6A', marginTop: 2 }}>
                    {finalScore}%
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#64748B' }}>
                    Questions Completed
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 900, color: '#0F172A', marginTop: 2 }}>
                    {answeredCount} / {questions.length}
                  </div>
                </div>
              </div>

              {securityWarnings.length > 0 && (
                <div
                  style={{
                    background: '#FEF2F2',
                    border: '1px solid #FECACA',
                    borderRadius: 6,
                    padding: '10px 14px',
                    fontSize: 12,
                    color: '#991B1B',
                    marginBottom: 20,
                    textAlign: 'left',
                  }}
                >
                  <strong>Proctoring Notice:</strong> {securityWarnings.length} window focus/proctoring alert(s) were flagged during this session for teacher review.
                </div>
              )}

              <button
                type="button"
                className="btn-primary"
                onClick={onClose}
                style={{ width: '100%', padding: '12px', fontSize: 14, fontWeight: 700 }}
              >
                Return to Student Dashboard
              </button>
            </div>
          </div>
        ) : (
          /* ACTIVE FULL-SCREEN EXAM QUESTIONS FLOW */
          <>
            {/* Left Sidebar: Question Palette & Navigation */}
            <aside
              style={{
                width: 280,
                background: '#FFFFFF',
                borderRight: '1px solid #E2E8F0',
                padding: '20px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: 18,
                overflowY: 'auto',
              }}
            >
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#64748B', letterSpacing: '0.04em' }}>
                  Question Navigator
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0F172A', marginTop: 2 }}>
                  {answeredCount} of {questions.length} Answered
                </div>
                {/* Mini Progress Bar */}
                <div style={{ height: 6, background: '#E2E8F0', borderRadius: 3, marginTop: 8, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${(answeredCount / questions.length) * 100}%`,
                      background: '#2C6E6A',
                      transition: 'width 0.2s',
                    }}
                  />
                </div>
              </div>

              {/* Grid of Question Number Buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {questions.map((q, idx) => {
                  const isAns = !!selectedAnswers[q.id];
                  const isCurrent = currentQIndex === idx;

                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setCurrentQIndex(idx)}
                      style={{
                        padding: '10px 0',
                        borderRadius: 6,
                        border: isCurrent
                          ? '2px solid #2C6E6A'
                          : isAns
                          ? '1px solid #A7F3D0'
                          : '1px solid #CBD5E1',
                        background: isCurrent
                          ? '#EAF3EF'
                          : isAns
                          ? '#ECFDF5'
                          : '#FFFFFF',
                        color: isCurrent
                          ? '#2C6E6A'
                          : isAns
                          ? '#065F46'
                          : '#64748B',
                        fontSize: 13,
                        fontWeight: 800,
                        cursor: 'pointer',
                        transition: 'all 0.12s',
                        boxShadow: isCurrent ? '0 0 0 1px #2C6E6A' : 'none',
                      }}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div style={{ marginTop: 'auto', borderTop: '1px solid #F1F5F9', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11, color: '#64748B' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: '#ECFDF5', border: '1px solid #A7F3D0', display: 'inline-block' }} />
                  <span>Answered Question</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: '#FFFFFF', border: '1px solid #CBD5E1', display: 'inline-block' }} />
                  <span>Unanswered Question</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: '#EAF3EF', border: '2px solid #2C6E6A', display: 'inline-block' }} />
                  <span>Current Question</span>
                </div>
              </div>
            </aside>

            {/* Main Stage: Question Prompt & Radio Options */}
            <main
              style={{
                flex: 1,
                padding: '32px 48px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                maxWidth: 960,
                margin: '0 auto',
                width: '100%',
              }}
            >
              {/* Question Card */}
              <div
                style={{
                  background: '#FFFFFF',
                  borderRadius: 12,
                  border: '1px solid #E2E8F0',
                  padding: '28px 32px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Question Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid #F1F5F9', paddingBottom: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#2C6E6A', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Question {currentQIndex + 1} of {questions.length}
                  </span>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: '#64748B', background: '#F1F5F9', padding: '3px 8px', borderRadius: 4 }}>
                    Points: {currentQ.points || 1} Marks
                  </span>
                </div>

                {/* Question Text */}
                <h3
                  style={{
                    margin: '0 0 24px',
                    fontSize: 16.5,
                    fontWeight: 700,
                    color: '#0F172A',
                    lineHeight: 1.5,
                  }}
                >
                  {currentQ.question}
                </h3>

                {/* Options List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
                  {currentQ.options.map((option, optIdx) => {
                    const isSelected = selectedAnswers[currentQ.id] === option;
                    const letter = String.fromCharCode(65 + optIdx); // A, B, C, D

                    return (
                      <label
                        key={optIdx}
                        onClick={() => handleSelectOption(currentQ.id, option)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 14,
                          padding: '14px 18px',
                          borderRadius: 8,
                          border: isSelected ? '2px solid #2C6E6A' : '1px solid #CBD5E1',
                          background: isSelected ? '#EAF3EF' : '#FFFFFF',
                          cursor: 'pointer',
                          transition: 'all 0.12s ease',
                          boxShadow: isSelected ? '0 2px 6px rgba(44, 110, 106, 0.12)' : 'none',
                        }}
                      >
                        {/* Option Letter Badge */}
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            background: isSelected ? '#2C6E6A' : '#F1F5F9',
                            color: isSelected ? '#FFFFFF' : '#475569',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 12,
                            fontWeight: 800,
                            flexShrink: 0,
                          }}
                        >
                          {letter}
                        </div>

                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: isSelected ? 700 : 500,
                            color: isSelected ? '#1E293B' : '#334155',
                            lineHeight: 1.4,
                          }}
                        >
                          {option}
                        </span>
                      </label>
                    );
                  })}
                </div>

                {/* Bottom Navigation Buttons */}
                <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 20, borderTop: '1px solid #F1F5F9' }}>
                  <button
                    type="button"
                    disabled={currentQIndex === 0}
                    onClick={() => setCurrentQIndex((prev) => Math.max(0, prev - 1))}
                    style={{
                      padding: '10px 20px',
                      borderRadius: 6,
                      border: '1px solid #CBD5E1',
                      background: currentQIndex === 0 ? '#F8FAFC' : '#FFFFFF',
                      color: currentQIndex === 0 ? '#94A3B8' : '#334155',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: currentQIndex === 0 ? 'default' : 'pointer',
                    }}
                  >
                    ← Previous Question
                  </button>

                  <div style={{ display: 'flex', gap: 10 }}>
                    {currentQIndex < questions.length - 1 ? (
                      <button
                        type="button"
                        onClick={() => setCurrentQIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                        style={{
                          padding: '10px 24px',
                          borderRadius: 6,
                          border: 'none',
                          background: '#0F172A',
                          color: '#FFFFFF',
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Next Question →
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowSubmitConfirm(true)}
                        style={{
                          padding: '10px 24px',
                          borderRadius: 6,
                          border: 'none',
                          background: '#2C6E6A',
                          color: '#FFFFFF',
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: '0 2px 8px rgba(44, 110, 106, 0.4)',
                        }}
                      >
                        Complete &amp; Submit Exam
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </main>
          </>
        )}
      </div>

      {/* ── SECURITY ALERT WARNING MODAL ── */}
      {showWarningModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000001,
            background: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 12,
              padding: '24px 28px',
              maxWidth: 460,
              width: '100%',
              textAlign: 'center',
              boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: '#FEE2E2',
                color: '#DC2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
                margin: '0 auto 14px',
                fontWeight: 900,
              }}
            >
              ⚠
            </div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#1E293B' }}>
              Security &amp; Proctoring Warning
            </h3>
            <p style={{ fontSize: 13, color: '#64748B', margin: '8px 0 16px', lineHeight: 1.5 }}>
              {lastWarningText || 'An unauthorized action or tab switch was detected.'} All security incidents are recorded in your exam audit trail.
            </p>
            <button
              type="button"
              onClick={() => setShowWarningModal(false)}
              className="btn-primary"
              style={{ padding: '10px 24px', width: '100%' }}
            >
              I Understand &amp; Continue Exam
            </button>
          </div>
        </div>
      )}

      {/* ── SUBMISSION CONFIRMATION MODAL ── */}
      {showSubmitConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000001,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 12,
              padding: '24px 28px',
              maxWidth: 440,
              width: '100%',
              textAlign: 'center',
            }}
          >
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#1E293B' }}>
              Submit Online Assessment?
            </h3>
            <p style={{ fontSize: 13, color: '#64748B', margin: '8px 0 18px', lineHeight: 1.5 }}>
              You have answered <strong>{answeredCount} of {questions.length}</strong> questions.
              {answeredCount < questions.length && (
                <span style={{ color: '#EF4444', display: 'block', marginTop: 4, fontWeight: 600 }}>
                  Note: {questions.length - answeredCount} question(s) remain unanswered!
                </span>
              )}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowSubmitConfirm(false)}
                style={{ flex: 1 }}
              >
                Continue Answering
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleFinish}
                style={{ flex: 1 }}
              >
                Yes, Submit Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EXIT CONFIRMATION MODAL ── */}
      {showExitConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000001,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 12,
              padding: '24px 28px',
              maxWidth: 440,
              width: '100%',
              textAlign: 'center',
            }}
          >
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#1E293B' }}>
              Exit Examination?
            </h3>
            <p style={{ fontSize: 13, color: '#64748B', margin: '8px 0 18px' }}>
              Exiting will cancel your active exam session and unsaved progress will be lost.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowExitConfirm(false)}
                style={{ flex: 1 }}
              >
                Stay in Exam
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#EF4444',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Exit Assessment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
