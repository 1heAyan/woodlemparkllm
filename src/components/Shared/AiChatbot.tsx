'use client';

import React, { useState, useRef, useEffect } from 'react';
import { UserProfile } from '@/lib/supabaseClient';

interface AiChatbotProps {
  currentUser?: UserProfile | null;
}

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  time: string;
}

export const AiChatbot: React.FC<AiChatbotProps> = ({ currentUser }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasUnread, setHasUnread] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const role = currentUser?.role || 'student';
  const userName = currentUser?.name || 'Student';

  const defaultWelcomeText = `Hello ${userName}. I am your Woodlem Gemini Assistant. How can I help you navigate the school portal today?`;

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: defaultWelcomeText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      setHasUnread(false);
      scrollToBottom();
    }
  }, [isOpen, messages, isLoading]);

  // Quick Action Prompts tailored to Role
  const quickPrompts = {
    student: [
      'How do I submit my homework?',
      'Where can I find lesson notes & slides?',
      'How do I take online assessments?',
      'How do I change my password?',
    ],
    teacher: [
      'How do I upload learning resources?',
      'How do I post a pinned announcement?',
      'How do I take homeroom attendance?',
      'How do I publish and grade tests?',
    ],
    parent: [
      'How do I upload medical forms?',
      'How do I track my child\'s attendance?',
      'How do I view curriculum coverage?',
    ],
    admin: [
      'How do I reset a student\'s password?',
      'How do I bulk import users with Excel?',
      'How do I manage Grades 9-12 and Sections A-Z?',
    ],
  }[role] || [
    'How do I submit my homework?',
    'How do I change my password?',
    'Where do I find school help contacts?',
  ];

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    const userMsg: Message = {
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
        const assistantMsg: Message = {
          id: `ai-${Date.now()}`,
          sender: 'assistant',
          text: data.reply || 'I am here to help you with the Woodlem portal.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        throw new Error('API response not ok');
      }
    } catch (e) {
      const fallbackMsg: Message = {
        id: `ai-err-${Date.now()}`,
        sender: 'assistant',
        text: 'I can guide you with homework submission, syllabus tracking, attendance, learning resources, and password settings. Please ask your question.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        sender: 'assistant',
        text: defaultWelcomeText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  // Helper to format text with clean paragraphing, numbered steps and bolding
  const renderFormattedText = (rawText: string) => {
    const lines = rawText.split('\n');
    return lines.map((line, lineIdx) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return <div key={lineIdx} style={{ height: 6 }} />;
      }

      // Check if numbered list item (e.g. "1. Step description")
      const isNumbered = /^\d+\.\s/.test(trimmed);
      // Check if bullet point (e.g. "- Item" or "* Item")
      const isBullet = /^[-*•]\s/.test(trimmed);

      // Parse bold segments **text**
      const parts = line.split(/(\*\*.*?\*\*)/g);
      const formattedParts = parts.map((part, pIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={pIdx} style={{ fontWeight: 700, color: 'inherit' }}>
              {part.slice(2, -2)}
            </strong>
          );
        }
        return part;
      });

      if (isNumbered || isBullet) {
        return (
          <div
            key={lineIdx}
            style={{
              paddingLeft: 12,
              textIndent: -12,
              margin: '3px 0',
              lineHeight: 1.48,
            }}
          >
            {formattedParts}
          </div>
        );
      }

      return (
        <p key={lineIdx} style={{ margin: '2px 0', lineHeight: 1.48 }}>
          {formattedParts}
        </p>
      );
    });
  };

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 99999, fontFamily: 'var(--font-main, sans-serif)', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
      {/* EXPANDABLE CHAT WINDOW */}
      {isOpen && (
        <div
          style={{
            width: 400,
            maxWidth: 'calc(100vw - 32px)',
            height: 560,
            maxHeight: 'calc(100vh - 110px)',
            background: '#FFFFFF',
            borderRadius: 18,
            border: '1px solid rgba(0,0,0,0.12)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.2), 0 4px 16px rgba(0,0,0,0.08)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            marginBottom: 14,
            animation: 'fadeIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* Top Chat Header with Official Gemini Gradient */}
          <div
            style={{
              padding: '14px 18px',
              background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Gemini Star Badge */}
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1.5px solid rgba(155, 81, 224, 0.4)',
                  boxShadow: '0 0 14px rgba(84, 87, 254, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 2C12 7.52285 7.52285 12 2 12C7.52285 12 12 16.4771 12 22C12 16.4771 16.4771 12 22 12C16.4771 12 12 7.52285 12 2Z"
                    fill="url(#gemini-header-glow-full)"
                  />
                  <defs>
                    <linearGradient id="gemini-header-glow-full" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#1BA1E3" />
                      <stop offset="0.35" stopColor="#5457FE" />
                      <stop offset="0.7" stopColor="#9B51E0" />
                      <stop offset="1" stopColor="#E879F9" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>

              <div>
                <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.02em', lineHeight: 1.2 }}>
                  Gemini Assistant
                </div>
                <div style={{ fontSize: 10.5, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
                  {isLoading ? 'Neural Engine Thinking...' : 'Woodlem LMS Neural Guide · Online'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                onClick={handleClearChat}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#CBD5E1',
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: 6,
                  cursor: 'pointer',
                  padding: '4px 8px',
                }}
                title="Clear conversation"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94A3B8',
                  fontSize: 20,
                  lineHeight: 1,
                  cursor: 'pointer',
                  padding: '0 4px',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Close chat"
              >
                &times;
              </button>
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div
            style={{
              flex: 1,
              padding: '16px',
              overflowY: 'auto',
              background: '#FAF9F6',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
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
                      maxWidth: '88%',
                      padding: '12px 16px',
                      borderRadius: isAssistant ? '14px 14px 14px 2px' : '14px 14px 2px 14px',
                      background: isAssistant ? '#FFFFFF' : '#2C6E6A',
                      color: isAssistant ? 'var(--neutral-dark)' : '#FFFFFF',
                      border: isAssistant ? '1px solid var(--border-color)' : 'none',
                      fontSize: 13,
                      boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                    }}
                  >
                    {renderFormattedText(m.text)}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, padding: '0 4px' }}>
                    <span style={{ fontSize: 9.5, color: '#9E9B95' }}>
                      {m.time}
                    </span>
                    {isAssistant && m.id !== 'welcome' && (
                      <button
                        type="button"
                        onClick={() => handleCopyText(m.id, m.text)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: copiedId === m.id ? '#10B981' : '#9E9B95',
                          fontSize: 9.5,
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
                  gap: 8,
                  padding: '10px 14px',
                  background: '#FFFFFF',
                  border: '1px solid var(--border-color)',
                  borderRadius: '14px 14px 14px 2px',
                  width: 'fit-content',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                }}
              >
                {/* Gemini Pulsing Gradient Dots */}
                <div style={{ display: 'flex', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1BA1E3', animation: 'dotPulse 1s infinite alternate 0s' }} />
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#5457FE', animation: 'dotPulse 1s infinite alternate 0.2s' }} />
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#9B51E0', animation: 'dotPulse 1s infinite alternate 0.4s' }} />
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Gemini is answering...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Action Chips */}
          <div
            style={{
              padding: '10px 14px',
              background: '#FFFFFF',
              borderTop: '1px solid #ECEAE5',
              display: 'flex',
              gap: 6,
              overflowX: 'auto',
              whiteSpace: 'nowrap',
            }}
          >
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => handleSendMessage(prompt)}
                disabled={isLoading}
                style={{
                  padding: '5px 12px',
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
                {prompt}
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
              padding: '12px 14px',
              background: '#FFFFFF',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              gap: 8,
              alignItems: 'center',
            }}
          >
            <input
              type="text"
              placeholder="Ask anything about Woodlem portal..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              disabled={isLoading}
              style={{
                flex: 1,
                padding: '9px 14px',
                fontSize: 13,
                border: '1px solid var(--border-color)',
                borderRadius: 8,
                outline: 'none',
                background: '#FAF9F6',
              }}
              autoFocus
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || isLoading}
              style={{
                padding: '9px 16px',
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
              }}
            >
              Send
            </button>
          </form>
        </div>
      )}

      {/* ICONIC GOOGLE GEMINI FLOATING ACTION BUTTON (NO TEXT) */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
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
          position: 'relative',
          padding: 0,
        }}
        title={isOpen ? 'Close Gemini' : 'Gemini AI Assistant'}
      >
        {/* Soft Radial Backlight */}
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
          {/* Main Curved Gemini Star */}
          <path
            d="M12 2C12 7.52285 7.52285 12 2 12C7.52285 12 12 16.4771 12 22C12 16.4771 16.4771 12 22 12C16.4771 12 12 7.52285 12 2Z"
            fill="url(#gemini-sparkle-btn)"
          />
          {/* Secondary Mini Sparkle */}
          <path
            d="M18.5 3C18.5 5.5 16 7 13.5 7C16 7 18.5 8.5 18.5 11C18.5 8.5 21 7 23.5 7C21 7 18.5 5.5 18.5 3Z"
            fill="#E879F9"
            opacity="0.9"
          />
          <defs>
            <linearGradient id="gemini-sparkle-btn" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
              <stop stopColor="#1BA1E3" />
              <stop offset="0.35" stopColor="#5457FE" />
              <stop offset="0.7" stopColor="#9B51E0" />
              <stop offset="1" stopColor="#E879F9" />
            </linearGradient>
          </defs>
        </svg>

        {/* Subtle Online / Unread Indicator Dot */}
        {hasUnread && !isOpen && (
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
        )}
      </button>

      {/* Global CSS Keyframes for Dot Pulse */}
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
    </div>
  );
};
