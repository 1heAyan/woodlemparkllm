'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { TestItem, TestQuestion, UserProfile } from '@/lib/supabaseClient';
import { Clock, Check, AlertTriangle } from 'lucide-react';

interface ExamPortalViewProps {
  test: TestItem;
  student: UserProfile;
  onClose: () => void;
  onSubmitTest: (testId: string, answers: Record<string, string>, score: number) => void;
}

const DEFAULT_FALLBACK_QUESTIONS: TestQuestion[] = [
  {
    id: 'q1',
    type: 'mcq',
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
    type: 'mcq',
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
    type: 'mcq',
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
        background: 'var(--neutral-bg)',
        color: 'var(--neutral-dark)',
        fontFamily: 'var(--font-label)',
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

      {/* ── RESPONSIVE STYLES FOR EXAM PORTAL ── */}
      <style>{`
        .exam-portal-header {
          background: var(--surface);
          color: var(--neutral-dark);
          padding: 12px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--border-color);
          box-shadow: 0 2px 10px rgba(0,0,0,0.03);
          position: relative;
          z-index: 10;
        }
        .exam-portal-body {
          flex: 1;
          display: flex;
          overflow: hidden;
          position: relative;
          z-index: 2;
        }
        .exam-sidebar {
          width: 280px;
          background: #FFFFFF;
          border-right: 1px solid #E2E8F0;
          padding: 20px 18px;
          display: flex;
          flex-direction: column;
          gap: 18px;
          overflow-y: auto;
          flex-shrink: 0;
        }
        .exam-main {
          flex: 1;
          padding: 32px 48px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          max-width: 960px;
          margin: 0 auto;
          width: 100%;
          box-sizing: border-box;
        }
        .exam-nav-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
        }
        @media (max-width: 768px) {
          .exam-portal-header {
            padding: 8px 12px !important;
            flex-wrap: wrap;
            gap: 8px;
          }
          .exam-portal-header-left {
            gap: 8px !important;
          }
          .exam-portal-header-center {
            order: 3;
            width: 100%;
            justify-content: space-between !important;
            gap: 8px !important;
          }
          .exam-shield-text {
            display: none;
          }
          .exam-portal-body {
            flex-direction: column !important;
            overflow-y: auto !important;
          }
          .exam-sidebar {
            width: 100% !important;
            border-right: none !important;
            border-bottom: 1px solid #E2E8F0 !important;
            padding: 8px 12px !important;
            gap: 8px !important;
            flex-shrink: 0;
          }
          .exam-nav-grid {
            display: flex !important;
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch !important;
            scrollbar-width: none !important;
            gap: 6px !important;
            padding-bottom: 2px !important;
          }
          .exam-nav-grid::-webkit-scrollbar {
            display: none !important;
          }
          .exam-nav-btn {
            min-width: 40px !important;
            height: 38px !important;
            padding: 0 !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            flex-shrink: 0 !important;
          }
          .exam-sidebar-legend {
            display: none !important;
          }
          .exam-main {
            padding: 12px 10px 32px 10px !important;
          }
          .exam-question-card {
            padding: 16px 14px !important;
            border-radius: 10px !important;
          }
        }
      `}</style>

      {/* ── HIGH-SECURITY EXAMINATION HEADER ── */}
      <header className="exam-portal-header">
        {/* Left: Exam Info */}
        <div className="exam-portal-header-left" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
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
              flexShrink: 0,
            }}
          >
            W
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, background: '#EAF3EF', color: '#2D6E5D', border: '1px solid #C7E4D8', padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Secure Mode
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{test.class_name || 'Assessment'}</span>
            </div>
            <h1 style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 800, color: 'var(--neutral-dark)', letterSpacing: '0.01em' }}>
              {test.title}
            </h1>
          </div>
        </div>

        {/* Center: Proctoring Pill & Live Timer */}
        <div className="exam-portal-header-center" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Proctoring Shield Pill */}
          <div
            style={{
              background: '#F8FAFC',
              border: '1px solid var(--border-color)',
              borderRadius: 20,
              padding: '4px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              color: 'var(--text-secondary)',
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981', display: 'inline-block', boxShadow: '0 0 8px #10B981' }} />
            <span className="exam-shield-text">Proctoring Active</span>
            {securityWarnings.length > 0 && (
              <span style={{ background: '#EF4444', color: '#FFF', padding: '1px 6px', borderRadius: 10, fontSize: 9.5, fontWeight: 700 }}>
                {securityWarnings.length} Alert{securityWarnings.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Countdown Clock */}
          {!isSubmitted && (
            <div
              style={{
                background: timeLeft < 300 ? '#FEF2F2' : '#F0F9FF',
                border: timeLeft < 300 ? '1px solid #FECACA' : '1px solid #BAE6FD',
                borderRadius: 8,
                padding: '5px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                color: timeLeft < 300 ? '#991B1B' : '#0369A1',
                fontWeight: 800,
                fontSize: 13.5,
                fontFamily: 'monospace',
                letterSpacing: '0.05em',
                transition: 'all 0.2s',
              }}
            >
              <Clock size={15} />
              <span>{formatTime(timeLeft)}</span>
            </div>
          )}
        </div>

        {/* Right: Candidate & Action */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {!isSubmitted ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={() => setShowExitConfirm(true)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--border-color)',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  fontSize: 11.5,
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
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#2D6E5D',
                  color: '#FFFFFF',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(45, 110, 93, 0.4)',
                }}
              >
                Submit ({answeredCount}/{questions.length})
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: 'none',
                background: '#10B981',
                color: '#FFFFFF',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Finish
            </button>
          )}
        </div>
      </header>

      {/* ── MAIN EXAM CONTAINER ── */}
      <div className="exam-portal-body">
        {isSubmitted ? (
          /* RESULT / COMPLETION SUMMARY SCREEN */
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
          >
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: 14,
                border: '1px solid #E2E8F0',
                padding: '28px 24px',
                maxWidth: 500,
                width: '100%',
                textAlign: 'center',
                boxShadow: '0 20px 40px rgba(0,0,0,0.08)',
              }}
            >
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
                  fontSize: 30,
                  margin: '0 auto 14px',
                  fontWeight: 800,
                }}
              >
                <Check size={32} />
              </div>

              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0F172A' }}>
                Assessment Submitted
              </h2>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748B' }}>
                Your responses have been verified, encrypted, and recorded in the gradebook.
              </p>

              <div
                style={{
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: 10,
                  padding: '16px',
                  margin: '20px 0',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: '#64748B' }}>
                    Calculated Score
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: '#2C6E6A', marginTop: 2 }}>
                    {finalScore}%
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: '#64748B' }}>
                    Completed
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: '#0F172A', marginTop: 2 }}>
                    {answeredCount}/{questions.length}
                  </div>
                </div>
              </div>

              {securityWarnings.length > 0 && (
                <div
                  style={{
                    background: '#FEF2F2',
                    border: '1px solid #FECACA',
                    borderRadius: 6,
                    padding: '8px 12px',
                    fontSize: 11.5,
                    color: '#991B1B',
                    marginBottom: 16,
                    textAlign: 'left',
                  }}
                >
                  <strong>Proctoring Notice:</strong> {securityWarnings.length} alert(s) flagged during session.
                </div>
              )}

              <button
                type="button"
                className="btn-primary"
                onClick={onClose}
                style={{ width: '100%', padding: '12px', fontSize: 14, fontWeight: 700 }}
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        ) : (
          /* ACTIVE FULL-SCREEN EXAM QUESTIONS FLOW */
          <>
            {/* Question Palette & Navigation */}
            <aside className="exam-sidebar">
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
                    Questions
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--neutral-dark)' }}>
                    {answeredCount}/{questions.length} Answered
                  </span>
                </div>
                {/* Mini Progress Bar */}
                <div style={{ height: 5, background: '#E2E8F0', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${(answeredCount / questions.length) * 100}%`,
                      background: '#2D6E5D',
                      transition: 'width 0.2s',
                    }}
                  />
                </div>
              </div>

              {/* Grid of Question Number Buttons */}
              <div className="exam-nav-grid">
                {questions.map((q, idx) => {
                  const isAns = !!selectedAnswers[q.id];
                  const isCurrent = currentQIndex === idx;

                  return (
                    <button
                      key={q.id}
                      type="button"
                      className="exam-nav-btn"
                      onClick={() => setCurrentQIndex(idx)}
                      style={{
                        padding: '9px 0',
                        borderRadius: 6,
                        border: isCurrent
                          ? '2px solid #2D6E5D'
                          : isAns
                          ? '1px solid #C7E4D8'
                          : '1px solid var(--border-color)',
                        background: isCurrent
                          ? '#EAF3EF'
                          : isAns
                          ? '#EAF3EF'
                          : '#FFFFFF',
                        color: isCurrent
                          ? '#2D6E5D'
                          : isAns
                          ? '#2D6E5D'
                          : 'var(--text-secondary)',
                        fontSize: 13,
                        fontWeight: 800,
                        cursor: 'pointer',
                        transition: 'all 0.12s',
                        boxShadow: isCurrent ? '0 0 0 1px #2D6E5D' : 'none',
                      }}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="exam-sidebar-legend" style={{ marginTop: 'auto', borderTop: '1px solid #F1F5F9', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11, color: '#64748B' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: '#ECFDF5', border: '1px solid #A7F3D0', display: 'inline-block' }} />
                  <span>Answered</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: '#FFFFFF', border: '1px solid #CBD5E1', display: 'inline-block' }} />
                  <span>Unanswered</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: '#EAF3EF', border: '2px solid #2C6E6A', display: 'inline-block' }} />
                  <span>Current</span>
                </div>
              </div>
            </aside>

            {/* Main Stage: Question Prompt & Radio Options */}
            <main className="exam-main">
              {/* Question Card */}
              <div
                className="exam-question-card"
                style={{
                  background: '#FFFFFF',
                  borderRadius: 12,
                  border: '1px solid #E2E8F0',
                  padding: '24px 28px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Question Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid #F1F5F9', paddingBottom: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#2D6E5D', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Question {currentQIndex + 1} of {questions.length}
                  </span>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: '#64748B', background: '#F1F5F9', padding: '3px 8px', borderRadius: 4 }}>
                    Points: {currentQ.points || 1} Marks
                  </span>
                </div>

                {/* Question Image if present */}
                {currentQ.image_url && (
                  <div style={{ marginBottom: 20, textAlign: 'center' }}>
                    <img
                      src={currentQ.image_url}
                      alt="Question attachment"
                      style={{
                        maxWidth: '100%',
                        maxHeight: 280,
                        borderRadius: 8,
                        border: '1px solid #E2E8F0',
                        objectFit: 'contain',
                      }}
                    />
                  </div>
                )}

                {/* Question Text */}
                <h3
                  style={{
                    margin: '0 0 24px',
                    fontSize: 16.5,
                    fontWeight: 700,
                    color: 'var(--neutral-dark)',
                    lineHeight: 1.5,
                  }}
                >
                  {currentQ.question}
                </h3>

                {/* Multiple Choice Options */}
                {currentQ.type === 'mcq' && currentQ.options && (
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
                            border: isSelected ? '2px solid #2D6E5D' : '1px solid var(--border-color)',
                            background: isSelected ? '#EAF3EF' : '#FFFFFF',
                            cursor: 'pointer',
                            transition: 'all 0.12s ease',
                            boxShadow: isSelected ? '0 2px 6px rgba(45, 110, 93, 0.12)' : 'none',
                          }}
                        >
                          {/* Option Letter Badge */}
                          <div
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: '50%',
                              background: isSelected ? '#2D6E5D' : '#F1F5F9',
                              color: isSelected ? '#FFFFFF' : 'var(--text-secondary)',
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
                              color: isSelected ? 'var(--neutral-dark)' : 'var(--text-secondary)',
                              lineHeight: 1.4,
                            }}
                          >
                            {option}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {/* Open-Ended Text Question Input */}
                {currentQ.type === 'text' && (
                  <div style={{ marginBottom: 28 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748B', marginBottom: 8, textTransform: 'uppercase' }}>
                      Your Written Answer:
                    </label>
                    <textarea
                      rows={6}
                      value={selectedAnswers[currentQ.id] || ''}
                      onChange={(e) => handleSelectOption(currentQ.id, e.target.value)}
                      placeholder="Type your complete explanation or working here..."
                      style={{
                        width: '100%',
                        padding: '14px 16px',
                        borderRadius: 8,
                        border: selectedAnswers[currentQ.id] ? '1.5px solid #2D6E5D' : '1px solid #CBD5E1',
                        fontSize: 14,
                        fontFamily: 'inherit',
                        lineHeight: 1.6,
                        outline: 'none',
                        resize: 'vertical',
                        background: '#FAFAF9',
                      }}
                    />
                  </div>
                )}

                {/* Bottom Navigation Buttons */}
                <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTop: '1px solid #F1F5F9', flexWrap: 'wrap', gap: 10 }}>
                  <button
                    type="button"
                    disabled={currentQIndex === 0}
                    onClick={() => setCurrentQIndex((prev) => Math.max(0, prev - 1))}
                    style={{
                      padding: '10px 16px',
                      borderRadius: 6,
                      border: '1px solid #CBD5E1',
                      background: currentQIndex === 0 ? '#F8FAFC' : '#FFFFFF',
                      color: currentQIndex === 0 ? '#94A3B8' : '#334155',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: currentQIndex === 0 ? 'default' : 'pointer',
                      minHeight: 42,
                    }}
                  >
                    ← Previous
                  </button>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {currentQIndex < questions.length - 1 ? (
                      <button
                        type="button"
                        onClick={() => setCurrentQIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                        style={{
                          padding: '10px 20px',
                          borderRadius: 6,
                          border: 'none',
                          background: 'var(--btn-main)',
                          color: '#FFFFFF',
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: 'pointer',
                          minHeight: 42,
                        }}
                      >
                        Next →
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowSubmitConfirm(true)}
                        style={{
                          padding: '10px 20px',
                          borderRadius: 6,
                          border: 'none',
                          background: '#2D6E5D',
                          color: '#FFFFFF',
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: 'pointer',
                          minHeight: 42,
                          boxShadow: '0 2px 8px rgba(45, 110, 93, 0.4)',
                        }}
                      >
                        Submit Exam ({answeredCount}/{questions.length})
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
              <AlertTriangle size={28} />
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
              Submit Class Test?
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
