'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { UserProfile } from '@/lib/supabaseClient';
import { usePortalNavigation, PortalNavigationTarget, ChatMessage } from '@/lib/PortalNavigationContext';

interface AiChatbotProps {
  currentUser?: UserProfile | null;
}

export const AiChatbot: React.FC<AiChatbotProps> = ({ currentUser: propUser }) => {
  const {
    isAiPanelOpen,
    setIsAiPanelOpen,
    toggleAiPanel,
    currentUser: contextUser,
    navigateTo,
    messages,
    setMessages,
    clearChatHistory,
    activeNavNotification,
  } = usePortalNavigation();

  const user = propUser || contextUser;
  const role = user?.role || 'student';
  const userName = user?.name || 'Student';

  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isAiPanelOpen) {
      scrollToBottom();
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isAiPanelOpen, messages, isLoading]);

  // Quick Action Prompts tailored to user role
  const quickPrompts = useMemo(() => {
    switch (role) {
      case 'student':
        return [
          { text: 'How do I submit my homework?', label: '📝 Submit Homework' },
          { text: 'Where are lecture notes & slides?', label: '📚 Study Notes' },
          { text: 'How do I take online assessments?', label: '⏱️ Start Exam' },
          { text: 'How do I change my password?', label: '🔑 Password' },
          { text: 'How do I log my achievements?', label: '🏆 Log Award' },
        ];
      case 'teacher':
        return [
          { text: 'How do I upload learning resources?', label: '📁 Upload Notes' },
          { text: 'How do I take homeroom attendance?', label: '📋 Roll Call' },
          { text: 'How do I post a classroom notice?', label: '📢 Post Notice' },
          { text: 'How do I publish an assessment?', label: '✍️ Create Test' },
          { text: 'How do I review student submissions?', label: '⭐ Grade Work' },
        ];
      case 'admin':
        return [
          { text: 'How do I reset a student password?', label: '🔑 Reset Password' },
          { text: 'How do I bulk import users with Excel?', label: '📊 Bulk Import' },
          { text: 'How do I provision a new user?', label: '👤 Add User' },
          { text: 'How do I check cohort capacities?', label: '🏫 Cohorts' },
          { text: 'How do I review parent documents?', label: '📄 Parent Docs' },
        ];
      case 'parent':
        return [
          { text: "How do I check my child's attendance?", label: '📊 Attendance' },
          { text: 'How do I upload medical and clearance forms?', label: '📄 Upload Forms' },
          { text: 'What extracurricular programs are available?', label: '🌟 Holistic Hub' },
          { text: 'How do I contact the school helpdesk?', label: '🎫 Helpdesk' },
        ];
      default:
        return [
          { text: 'How do I submit homework?', label: '📝 Homework' },
          { text: 'How do I change my password?', label: '🔑 Password' },
          { text: 'Where is the school helpdesk?', label: '🎫 Support' },
        ];
    }
  }, [role]);

  // Parse nav tokens e.g. [[nav:class:tasks|Go to Tasks & Assessments ↗]]
  const parseNavToken = (rawToken: string): { target: PortalNavigationTarget; label: string; icon: string } | null => {
    // Format: [[nav:SPEC|Label]]
    const match = rawToken.match(/^\[\[nav:([^|]+)\|([^\]]+)\]\]$/);
    if (!match) return null;

    const spec = match[1].trim();
    const label = match[2].trim();
    const parts = spec.split(':');

    let target: PortalNavigationTarget = {};
    let icon = '🔗';

    const type = parts[0];

    if (type === 'class') {
      const sub = parts[1] || 'tasks';
      target = { view: 'class', subTab: sub };
      if (sub === 'tasks') icon = '📝';
      else if (sub === 'resources') icon = '📚';
      else if (sub === 'syllabus') icon = '📋';
      else if (sub === 'broadcasts') icon = '📢';
      else icon = '🏫';
    } else if (type === 'view') {
      const v = parts[1];
      const sub = parts[2];
      if (v === 'awards') {
        target = { view: 'awards' };
        icon = '🏆';
      } else if (v === 'attendance') {
        if (role === 'teacher') {
          target = { view: 'homeroom_attendance', subTab: sub || 'history' };
        } else {
          target = { view: 'attendance' };
        }
        icon = '📊';
      } else if (v === 'hub') {
        target = { view: 'hub' };
        icon = '🌟';
      } else if (v === 'settings') {
        target = { view: 'settings' };
        icon = '⚙️';
      } else if (v === 'support') {
        target = { view: 'support' };
        icon = '🎫';
      } else if (v === 'directory') {
        target = { view: 'directory' };
        icon = '👥';
      } else if (v === 'classes') {
        target = { view: 'classes' };
        icon = '🏫';
      } else if (v === 'documents') {
        target = { view: 'documents' };
        icon = '📄';
      } else if (v === 'progress') {
        target = { view: 'progress' };
        icon = '📈';
      } else {
        target = { view: v };
      }
    } else if (type === 'modal') {
      const modal = parts[1];
      if (modal === 'provision_user') {
        target = { modalAction: 'provision_user' };
        icon = '👤';
      } else if (modal === 'bulk_import') {
        target = { modalAction: 'bulk_import' };
        icon = '📥';
      }
    }

    return { target, label, icon };
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text,
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: historyPayload,
          userRole: role,
          userName: userName,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const assistantMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          sender: 'assistant',
          text: data.reply || 'I am here to guide you with the Woodlem portal.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        throw new Error('API response not ok');
      }
    } catch (e) {
      const fallbackMsg: ChatMessage = {
        id: `ai-err-${Date.now()}`,
        sender: 'assistant',
        text: `I can assist you with homework, study materials, attendance, holistic hub activities, and password settings.

[[nav:class:tasks|Assessments & Tasks ↗]] [[nav:class:resources|Learning Resources ↗]] [[nav:view:settings|Password Settings ↗]]`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyText = (id: string, text: string) => {
    // Strip nav tokens from copied text for clean reading
    const cleanText = text.replace(/\[\[nav:[^|]+\|([^\]]+)\]\]/g, '$1');
    navigator.clipboard.writeText(cleanText);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  // Helper to format text, numbered steps, bolding, and clickable deep-links
  const renderFormattedText = (rawText: string) => {
    const lines = rawText.split('\n');

    return lines.map((line, lineIdx) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return <div key={lineIdx} style={{ height: 6 }} />;
      }

      // Check if the line is purely navigation tokens or contains nav tokens
      const navTokenRegex = /(\[\[nav:[^|]+\|[^\]]+\]\])/g;
      const parts = line.split(navTokenRegex);

      const isNumbered = /^\d+\.\s/.test(trimmed);
      const isBullet = /^[-*•]\s/.test(trimmed);

      const renderParts = parts.map((part, pIdx) => {
        // If part is a navigation token
        if (part.startsWith('[[nav:') && part.endsWith(']]')) {
          const navParsed = parseNavToken(part);
          if (navParsed) {
            return (
              <button
                key={pIdx}
                type="button"
                className="ai-nav-badge-btn"
                onClick={() => navigateTo(navParsed.target)}
                title={`Click to jump to ${navParsed.label}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  margin: '4px 4px 4px 0',
                  padding: '5px 12px',
                  borderRadius: 16,
                  background: 'linear-gradient(135deg, #EAF3EF 0%, #DCEDE6 100%)',
                  border: '1px solid #B4DFD1',
                  color: '#1B5B53',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  transition: 'all 0.15s ease',
                  verticalAlign: 'middle',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#2C6E6A';
                  e.currentTarget.style.color = '#FFFFFF';
                  e.currentTarget.style.borderColor = '#2C6E6A';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 3px 8px rgba(44,110,106,0.25)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #EAF3EF 0%, #DCEDE6 100%)';
                  e.currentTarget.style.color = '#1B5B53';
                  e.currentTarget.style.borderColor = '#B4DFD1';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
                }}
              >
                <span>{navParsed.icon}</span>
                <span>{navParsed.label}</span>
              </button>
            );
          }
        }

        // Parse bold segments **text**
        const boldParts = part.split(/(\*\*.*?\*\*)/g);
        return boldParts.map((subPart, sIdx) => {
          if (subPart.startsWith('**') && subPart.endsWith('**')) {
            return (
              <strong key={`${pIdx}-${sIdx}`} style={{ fontWeight: 700, color: 'inherit' }}>
                {subPart.slice(2, -2)}
              </strong>
            );
          }
          return subPart;
        });
      });

      if (isNumbered || isBullet) {
        return (
          <div
            key={lineIdx}
            style={{
              paddingLeft: 14,
              textIndent: -14,
              margin: '3px 0',
              lineHeight: 1.5,
            }}
          >
            {renderParts}
          </div>
        );
      }

      return (
        <p key={lineIdx} style={{ margin: '3px 0', lineHeight: 1.5 }}>
          {renderParts}
        </p>
      );
    });
  };

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return (
    <>
      {/* 1. DOCKED / PERSISTENT ANTIGRAVITY SIDE PANEL */}
      <div
        className={`antigravity-copilot-drawer ${isAiPanelOpen ? 'open' : ''}`}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 420,
          maxWidth: 'calc(100vw - 20px)',
          height: '100vh',
          background: '#FFFFFF',
          borderLeft: '1px solid var(--border-color)',
          boxShadow: isAiPanelOpen ? '-8px 0 32px rgba(15, 23, 42, 0.12), -2px 0 8px rgba(0,0,0,0.04)' : 'none',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 9999,
          transform: isAiPanelOpen ? 'translateX(0)' : 'translateX(105%)',
          transition: 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.28s ease',
          fontFamily: 'var(--font-label, sans-serif)',
        }}
      >
        {/* Antigravity Header with Google Gemini Glow */}
        <div
          style={{
            padding: '16px 20px',
            background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Gemini Aura Animated Star Badge */}
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1.5px solid rgba(155, 81, 224, 0.4)',
                boxShadow: '0 0 16px rgba(84, 87, 254, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2C12 7.52285 7.52285 12 2 12C7.52285 12 12 16.4771 12 22C12 16.4771 16.4771 12 22 12C16.4771 12 12 7.52285 12 2Z"
                  fill="url(#gemini-header-aura)"
                />
                <defs>
                  <linearGradient id="gemini-header-aura" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#1BA1E3" />
                    <stop offset="0.35" stopColor="#5457FE" />
                    <stop offset="0.7" stopColor="#9B51E0" />
                    <stop offset="1" stopColor="#E879F9" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14.5, fontWeight: 700, letterSpacing: '0.01em', lineHeight: 1.2 }}>
                  Woodlem Copilot
                </span>
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: 'rgba(84, 87, 254, 0.22)',
                    color: '#C4B5FD',
                    border: '1px solid rgba(196, 181, 253, 0.3)',
                  }}
                >
                  AI Guide
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
                <span>{isLoading ? 'Neural Engine Thinking...' : 'Gemini 2.5 Flash · Interactive Guide'}</span>
              </div>
            </div>
          </div>

          {/* Top Actions: Shortcut hint, Clear Chat, Close */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                color: '#94A3B8',
                background: 'rgba(255,255,255,0.06)',
                padding: '3px 7px',
                borderRadius: 4,
                border: '1px solid rgba(255,255,255,0.1)',
                display: 'none',
              }}
              className="keyboard-shortcut-pill"
            >
              ⌘K
            </span>

            <button
              type="button"
              onClick={clearChatHistory}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#E2E8F0',
                fontSize: 11,
                fontWeight: 600,
                borderRadius: 6,
                cursor: 'pointer',
                padding: '4px 9px',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.16)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
              title="Reset conversation"
            >
              Clear
            </button>

            <button
              type="button"
              onClick={() => setIsAiPanelOpen(false)}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#CBD5E1',
                fontSize: 16,
                lineHeight: 1,
                cursor: 'pointer',
                padding: '5px 8px',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239,68,68,0.2)';
                e.currentTarget.style.color = '#FCA5A5';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                e.currentTarget.style.color = '#CBD5E1';
              }}
              title="Close panel (⌘K)"
            >
              &times;
            </button>
          </div>
        </div>

        {/* User Context Strip */}
        <div
          style={{
            padding: '8px 18px',
            background: '#F1F5F9',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 11.5,
            color: '#475569',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: 700, color: '#1E293B', textTransform: 'capitalize' }}>
              {role}: {userName}
            </span>
            {user?.grade && (
              <span style={{ padding: '1px 5px', borderRadius: 3, background: '#E2E8F0', fontSize: 10, fontWeight: 700 }}>
                Gr. {user.grade}-{user.class_letter || 'A'}
              </span>
            )}
          </div>
          <span style={{ fontSize: 11, color: '#64748B' }}>
            Click links to jump to pages
          </span>
        </div>

        {/* Real-time Navigation Toast Notification */}
        {activeNavNotification && (
          <div
            style={{
              padding: '8px 16px',
              background: '#2C6E6A',
              color: '#FFFFFF',
              fontSize: 12,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 2px 8px rgba(44,110,106,0.3)',
              animation: 'fadeIn 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#6EE7B7' }} />
              <span>{activeNavNotification}</span>
            </div>
            <span style={{ fontSize: 11, opacity: 0.8 }}>Live View Switched</span>
          </div>
        )}

        {/* Message Stream */}
        <div
          style={{
            flex: 1,
            padding: '18px',
            overflowY: 'auto',
            background: '#FAF9F6',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {messages.map((m) => {
            const isAssistant = m.sender === 'assistant';
            return (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isAssistant ? 'flex-start' : 'flex-end',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    maxWidth: '92%',
                    padding: '12px 16px',
                    borderRadius: isAssistant ? '14px 14px 14px 2px' : '14px 14px 2px 14px',
                    background: isAssistant ? '#FFFFFF' : '#2C6E6A',
                    color: isAssistant ? 'var(--neutral-dark, #2D2C2A)' : '#FFFFFF',
                    border: isAssistant ? '1px solid var(--border-color, #E5E3DF)' : 'none',
                    fontSize: 13,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                  }}
                >
                  {renderFormattedText(m.text)}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, padding: '0 4px' }}>
                  <span suppressHydrationWarning style={{ fontSize: 10, color: '#9E9B95' }}>{m.time}</span>
                  {isAssistant && m.id !== 'welcome-msg' && (
                    <button
                      type="button"
                      onClick={() => handleCopyText(m.id, m.text)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: copiedId === m.id ? '#10B981' : '#9E9B95',
                        fontSize: 10,
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      {copiedId === m.id ? 'Copied' : 'Copy'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 16px',
                background: '#FFFFFF',
                border: '1px solid var(--border-color, #E5E3DF)',
                borderRadius: '14px 14px 14px 2px',
                width: 'fit-content',
                boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
              }}
            >
              {/* Gemini Pulsing Gradient Dots */}
              <div style={{ display: 'flex', gap: 4 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#1BA1E3', animation: 'dotPulse 1s infinite alternate 0s' }} />
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#5457FE', animation: 'dotPulse 1s infinite alternate 0.2s' }} />
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#9B51E0', animation: 'dotPulse 1s infinite alternate 0.4s' }} />
              </div>
              <span style={{ fontSize: 12.5, color: '#64748B', fontWeight: 500 }}>
                Synthesizing step-by-step guidance...
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Action Prompts Bar */}
        <div
          style={{
            padding: '10px 14px',
            background: '#FFFFFF',
            borderTop: '1px solid #ECEAE5',
            display: 'flex',
            gap: 6,
            overflowX: 'auto',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {quickPrompts.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(item.text)}
              disabled={isLoading}
              style={{
                padding: '6px 12px',
                fontSize: 11.5,
                fontWeight: 600,
                color: '#2C6E6A',
                background: '#EAF3EF',
                border: '1px solid #C7E4D8',
                borderRadius: 16,
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#DCEDE6')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#EAF3EF')}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Chat Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          style={{
            padding: '14px 16px',
            background: '#FFFFFF',
            borderTop: '1px solid var(--border-color, #E5E3DF)',
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <input
            ref={inputRef}
            type="text"
            placeholder="Ask anything or request page guidance..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            disabled={isLoading}
            style={{
              flex: 1,
              padding: '10px 14px',
              fontSize: 13,
              border: '1px solid var(--border-color, #E5E3DF)',
              borderRadius: 8,
              outline: 'none',
              background: '#FAF9F6',
              fontFamily: 'inherit',
            }}
          />
          <button
            type="submit"
            disabled={!inputMessage.trim() || isLoading}
            style={{
              padding: '10px 16px',
              fontSize: 12.5,
              fontWeight: 700,
              color: '#FFFFFF',
              background: inputMessage.trim() && !isLoading
                ? 'linear-gradient(135deg, #1BA1E3 0%, #5457FE 100%)'
                : '#CBD5E1',
              border: 'none',
              borderRadius: 8,
              cursor: inputMessage.trim() && !isLoading ? 'pointer' : 'default',
              boxShadow: inputMessage.trim() && !isLoading ? '0 2px 8px rgba(84, 87, 254, 0.3)' : 'none',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            Ask AI
          </button>
        </form>
      </div>

      {/* 2. FLOATING SPARKLE TRIGGER (When Panel is Closed) */}
      {!isAiPanelOpen && (
        <button
          type="button"
          onClick={toggleAiPanel}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 9990,
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: 'rgba(15, 23, 42, 0.94)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1.5px solid rgba(255, 255, 255, 0.18)',
            boxShadow: isHovered
              ? '0 12px 32px rgba(84, 87, 254, 0.42), 0 4px 14px rgba(0, 0, 0, 0.45)'
              : '0 8px 24px rgba(84, 87, 254, 0.25), 0 2px 8px rgba(0, 0, 0, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.22s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            transform: isHovered ? 'scale(1.1) translateY(-3px)' : 'scale(1) translateY(0)',
            padding: 0,
          }}
          title="Open Woodlem Gemini AI Copilot (⌘K)"
        >
          {/* Subtle Radial Backlight */}
          <div
            style={{
              position: 'absolute',
              inset: 4,
              borderRadius: '50%',
              background: 'radial-gradient(circle at 40% 35%, rgba(255,255,255,0.18) 0%, transparent 65%)',
              pointerEvents: 'none',
            }}
          />

          {/* Authentic Google Gemini 4-Point Curved Sparkle Star */}
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            style={{
              transform: isHovered ? 'rotate(15deg) scale(1.08)' : 'rotate(0deg) scale(1)',
              transition: 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
              filter: 'drop-shadow(0 0 6px rgba(155, 81, 224, 0.6))',
            }}
          >
            <path
              d="M12 2C12 7.52285 7.52285 12 2 12C7.52285 12 12 16.4771 12 22C12 16.4771 16.4771 12 22 12C16.4771 12 12 7.52285 12 2Z"
              fill="url(#gemini-sparkle-trigger)"
            />
            <path
              d="M18.5 3C18.5 5.5 16 7 13.5 7C16 7 18.5 8.5 18.5 11C18.5 8.5 21 7 23.5 7C21 7 18.5 5.5 18.5 3Z"
              fill="#E879F9"
              opacity="0.9"
            />
            <defs>
              <linearGradient id="gemini-sparkle-trigger" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                <stop stopColor="#1BA1E3" />
                <stop offset="0.35" stopColor="#5457FE" />
                <stop offset="0.7" stopColor="#9B51E0" />
                <stop offset="1" stopColor="#E879F9" />
              </linearGradient>
            </defs>
          </svg>

          {/* Active Online Indicator */}
          <span
            style={{
              position: 'absolute',
              top: 3,
              right: 3,
              width: 9,
              height: 9,
              borderRadius: '50%',
              background: '#10B981',
              boxShadow: '0 0 0 2px #0F172A, 0 0 8px #10B981',
            }}
          />
        </button>
      )}

      {/* Global CSS Animation for Pulse */}
      <style jsx global>{`
        @keyframes dotPulse {
          0% {
            transform: scale(0.6);
            opacity: 0.5;
          }
          100% {
            transform: scale(1.2);
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
};
