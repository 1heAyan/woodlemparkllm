'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { UserProfile } from '@/lib/supabaseClient';
import { usePortalNavigation, PortalNavigationTarget, ChatMessage } from '@/lib/PortalNavigationContext';
import { ArrowUpRight, X, RotateCcw, Send, Sparkles, Bot, ChevronRight } from 'lucide-react';

interface AiChatbotProps {
  currentUser?: UserProfile | null;
}

export const AiChatbot: React.FC<AiChatbotProps> = ({ currentUser: propUser }) => {
  const {
    isAiPanelOpen, setIsAiPanelOpen, toggleAiPanel,
    currentUser: contextUser, navigateTo,
    messages, setMessages, clearChatHistory, activeNavNotification,
  } = usePortalNavigation();

  const user = propUser || contextUser;
  const role = user?.role || 'student';
  const userName = user?.name || 'Student';

  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { setIsMounted(true); }, []);

  useEffect(() => {
    if (isAiPanelOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => { inputRef.current?.focus(); }, 150);
    }
  }, [isAiPanelOpen, messages, isLoading]);

  const quickPrompts = useMemo(() => {
    switch (role) {
      case 'student': return [
        { text: 'How do I submit my homework?', label: 'Submit Homework' },
        { text: 'Where are lecture notes & slides?', label: 'Study Notes' },
        { text: 'How do I take online assessments?', label: 'Start Exam' },
        { text: 'How do I change my password?', label: 'Password' },
        { text: 'How do I log my achievements?', label: 'Log Award' },
      ];
      case 'teacher': return [
        { text: 'How do I upload learning resources?', label: 'Upload Notes' },
        { text: 'How do I take homeroom attendance?', label: 'Roll Call' },
        { text: 'How do I post a classroom notice?', label: 'Post Notice' },
        { text: 'How do I publish an assessment?', label: 'Create Test' },
        { text: 'How do I review student submissions?', label: 'Grade Work' },
      ];
      case 'admin': return [
        { text: 'How do I reset a student password?', label: 'Reset Password' },
        { text: 'How do I bulk import users with Excel?', label: 'Bulk Import' },
        { text: 'How do I provision a new user?', label: 'Add User' },
        { text: 'How do I check cohort capacities?', label: 'Cohorts' },
        { text: 'How do I review parent documents?', label: 'Parent Docs' },
      ];
      case 'parent': return [
        { text: "How do I check my child's attendance?", label: 'Attendance' },
        { text: 'How do I upload medical and clearance forms?', label: 'Upload Forms' },
        { text: 'What extracurricular programs are available?', label: 'Holistic Hub' },
        { text: 'How do I contact the school helpdesk?', label: 'Helpdesk' },
      ];
      default: return [
        { text: 'How do I submit homework?', label: 'Homework' },
        { text: 'How do I change my password?', label: 'Password' },
        { text: 'Where is the school helpdesk?', label: 'Support' },
      ];
    }
  }, [role]);

  const parseNavToken = (rawToken: string): { target: PortalNavigationTarget; label: string } | null => {
    const match = rawToken.match(/^\[\[nav:([^|]+)\|([^\]]+)\]\]$/);
    if (!match) return null;
    const spec = match[1].trim();
    const label = match[2].trim().replace(/\s*\u2197$/, '');
    const parts = spec.split(':');
    let target: PortalNavigationTarget = {};
    const type = parts[0];
    if (type === 'class') {
      target = { view: 'class', subTab: parts[1] || 'tasks' };
    } else if (type === 'view') {
      const v = parts[1]; const sub = parts[2];
      if (v === 'awards') target = { view: 'awards' };
      else if (v === 'attendance') target = role === 'teacher' ? { view: 'homeroom_attendance', subTab: sub || 'history' } : { view: 'attendance' };
      else if (v === 'hub') target = { view: 'hub' };
      else if (v === 'settings') target = { view: 'settings' };
      else if (v === 'support') target = { view: 'support' };
      else if (v === 'directory') target = { view: 'directory' };
      else if (v === 'classes') target = { view: 'classes' };
      else if (v === 'documents') target = { view: 'documents' };
      else if (v === 'progress') target = { view: 'progress' };
      else target = { view: v };
    } else if (type === 'modal') {
      const modal = parts[1];
      if (modal === 'provision_user') target = { modalAction: 'provision_user' };
      else if (modal === 'bulk_import') target = { modalAction: 'bulk_import' };
    }
    return { target, label };
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`, sender: 'user', text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);
    try {
      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant', content: m.text,
      }));
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: historyPayload, userRole: role, userName }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, {
          id: `ai-${Date.now()}`, sender: 'assistant',
          text: data.reply || 'I am here to guide you with the Woodlem portal.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }]);
      } else throw new Error('API not ok');
    } catch {
      setMessages((prev) => [...prev, {
        id: `ai-err-${Date.now()}`, sender: 'assistant',
        text: 'I can assist you with homework, study materials, attendance, holistic hub activities, and password settings.\n\n[[nav:class:tasks|Assessments]] [[nav:class:resources|Resources]] [[nav:view:settings|Settings]]',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyText = (id: string, text: string) => {
    const cleanText = text.replace(/\[\[nav:[^|]+\|([^\]]+)\]\]/g, '$1');
    navigator.clipboard.writeText(cleanText);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const renderFormattedText = (rawText: string) => {
    return rawText.split('\n').map((line, lineIdx) => {
      const trimmed = line.trim();
      if (!trimmed) return <div key={lineIdx} style={{ height: 6 }} />;
      const navTokenRegex = /(\[\[nav:[^|]+\|[^\]]+\]\])/g;
      const parts = line.split(navTokenRegex);
      const isNumbered = /^\d+\.\s/.test(trimmed);
      const isBullet = /^[-*\u2022]\s/.test(trimmed);
      const renderParts = parts.map((part, pIdx) => {
        if (part.startsWith('[[nav:') && part.endsWith(']]')) {
          const navParsed = parseNavToken(part);
          if (navParsed) {
            return (
              <button
                key={pIdx} type="button"
                onClick={() => navigateTo(navParsed.target)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  margin: '3px 4px 3px 0', padding: '4px 10px',
                  borderRadius: 6, background: '#F0FDF4', border: '1px solid #BBF7D0',
                  color: '#15803D', fontSize: 11.5, fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.15s ease', verticalAlign: 'middle',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#2C6E6A'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#2C6E6A'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#F0FDF4'; e.currentTarget.style.color = '#15803D'; e.currentTarget.style.borderColor = '#BBF7D0'; }}
              >
                <span>{navParsed.label}</span>
                <ArrowUpRight size={11} style={{ flexShrink: 0 }} />
              </button>
            );
          }
        }
        return part.split(/(\*\*.*?\*\*)/g).map((subPart, sIdx) => {
          if (subPart.startsWith('**') && subPart.endsWith('**'))
            return <strong key={`${pIdx}-${sIdx}`} style={{ fontWeight: 600 }}>{subPart.slice(2, -2)}</strong>;
          return subPart;
        });
      });
      if (isNumbered || isBullet)
        return <div key={lineIdx} style={{ paddingLeft: 14, textIndent: -14, margin: '3px 0', lineHeight: 1.6 }}>{renderParts}</div>;
      return <p key={lineIdx} style={{ margin: '3px 0', lineHeight: 1.6 }}>{renderParts}</p>;
    });
  };

  if (!isMounted) return null;

  return (
    <>
      {/* PUSH-CONTENT SIDE PANEL */}
      <div
        className="woodlem-ai-panel"
        style={{
          width: isAiPanelOpen ? 380 : 0,
          minWidth: isAiPanelOpen ? 380 : 0,
          height: '100%',
          overflow: 'hidden',
          flexShrink: 0,
          transition: 'width 0.3s cubic-bezier(0.16, 1, 0.3, 1), min-width 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          borderLeft: isAiPanelOpen ? '1px solid #E5E7EB' : 'none',
          background: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 10,
        }}
      >
        <div
          className="woodlem-ai-shell"
          style={{
            width: 380, height: '100%', display: 'flex', flexDirection: 'column',
            opacity: isAiPanelOpen ? 1 : 0,
            transition: 'opacity 0.2s ease',
            pointerEvents: isAiPanelOpen ? 'auto' : 'none',
          }}
        >
          {/* HEADER */}
          <div className="woodlem-ai-header" style={{ padding: '14px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div className="woodlem-ai-orb woodlem-ai-orb-one" />
            <div className="woodlem-ai-orb woodlem-ai-orb-two" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="woodlem-ai-avatar" style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg, #2C6E6A 0%, #3B82F6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Bot size={16} strokeWidth={2.25} />
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#111827', letterSpacing: '-0.01em' }}>Woodlem Copilot</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: isLoading ? '#F59E0B' : '#10B981', display: 'inline-block' }} />
                  <span style={{ fontSize: 11, color: '#9CA3AF' }}>{isLoading ? 'Thinking...' : 'AI Guide \u00b7 Gemini 2.5'}</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <button type="button" onClick={clearChatHistory} title="Clear conversation"
                style={{ background: 'none', border: '1px solid #E5E7EB', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#6B7280', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, transition: 'all 0.15s ease' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#F9FAFB'; e.currentTarget.style.color = '#374151'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#6B7280'; }}
              ><RotateCcw size={11} /> Clear</button>
              <button type="button" onClick={() => setIsAiPanelOpen(false)} title="Close"
                style={{ background: 'none', border: '1px solid #E5E7EB', borderRadius: 6, padding: 5, cursor: 'pointer', color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.borderColor = '#FCA5A5'; e.currentTarget.style.color = '#DC2626'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.color = '#6B7280'; }}
              ><X size={13} /></button>
            </div>
          </div>

          {/* CONTEXT BAR */}
          <div className="woodlem-ai-context" style={{ padding: '7px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: '#FAFAFA' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: '#F3F4F6', color: '#374151', textTransform: 'capitalize' }}>{role}</span>
              <span style={{ fontSize: 11.5, color: '#6B7280' }}>{userName}</span>
              {user?.grade && <span style={{ fontSize: 10.5, fontWeight: 600, padding: '1px 5px', borderRadius: 4, background: '#EFF6FF', color: '#2563EB' }}>Gr.{user.grade}</span>}
            </div>
            <span style={{ fontSize: 10, color: '#D1D5DB' }}>Click links to navigate</span>
          </div>

          {/* NAV TOAST */}
          {activeNavNotification && (
            <div style={{ padding: '7px 14px', background: '#F0FDF4', borderBottom: '1px solid #BBF7D0', color: '#15803D', fontSize: 11.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22C55E', flexShrink: 0 }} />
              {activeNavNotification}
            </div>
          )}

          {/* MESSAGES */}
          <div className="woodlem-ai-messages" style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, background: '#FAFAFA' }}>
            {messages.length <= 1 && !isLoading && (
              <div className="woodlem-ai-welcome">
                <div className="woodlem-ai-welcome-icon"><Sparkles size={18} /></div>
                <div>
                  <strong>How can I help today?</strong>
                  <span>Choose a shortcut below or ask me anything about Woodlem.</span>
                </div>
              </div>
            )}
            {messages.map((m) => {
              const isAssistant = m.sender === 'assistant';
              return (
                <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isAssistant ? 'flex-start' : 'flex-end' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#C4C9D4', marginBottom: 3 }}>{isAssistant ? 'Copilot' : 'You'}</div>
                  <div style={{
                    maxWidth: '88%', padding: '10px 14px', fontSize: 13, lineHeight: 1.65,
                    borderRadius: isAssistant ? '2px 12px 12px 12px' : '12px 2px 12px 12px',
                    background: isAssistant ? '#FFFFFF' : '#2C6E6A',
                    color: isAssistant ? '#1F2937' : '#FFFFFF',
                    border: isAssistant ? '1px solid #E5E7EB' : 'none',
                    boxShadow: isAssistant ? '0 1px 3px rgba(0,0,0,0.04)' : '0 2px 8px rgba(44,110,106,0.22)',
                  }}>{renderFormattedText(m.text)}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                    <span suppressHydrationWarning style={{ fontSize: 10, color: '#D1D5DB' }}>{m.time}</span>
                    {isAssistant && m.id !== 'welcome-msg' && (
                      <button type="button" onClick={() => handleCopyText(m.id, m.text)}
                        style={{ background: 'none', border: 'none', color: copiedId === m.id ? '#10B981' : '#D1D5DB', fontSize: 10, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                        {copiedId === m.id ? 'Copied' : 'Copy'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#C4C9D4', marginBottom: 3 }}>Copilot</div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '10px 14px', background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '2px 12px 12px 12px' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2C6E6A', animation: 'aiDotPulse 1s infinite alternate 0s' }} />
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3B82F6', animation: 'aiDotPulse 1s infinite alternate 0.2s' }} />
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#8B5CF6', animation: 'aiDotPulse 1s infinite alternate 0.4s' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* QUICK PROMPTS */}
          <div style={{ padding: '9px 12px', background: '#FFFFFF', borderTop: '1px solid #F3F4F6', display: 'flex', gap: 5, overflowX: 'auto', flexShrink: 0 }}>
            {quickPrompts.map((item, idx) => (
              <button className="woodlem-ai-prompt" key={idx} type="button" onClick={() => handleSendMessage(item.text)} disabled={isLoading}
                style={{ padding: '4px 10px', fontSize: 11.5, fontWeight: 500, color: '#374151', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 6, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap', transition: 'all 0.15s ease' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#F3F4F6'; e.currentTarget.style.borderColor = '#D1D5DB'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#F9FAFB'; e.currentTarget.style.borderColor = '#E5E7EB'; }}
              ><span>{item.label}</span><ChevronRight size={12} /></button>
            ))}
          </div>

          {/* INPUT */}
          <form className="woodlem-ai-composer" onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
            style={{ padding: '11px 12px', background: '#FFFFFF', borderTop: '1px solid #F3F4F6', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}
          >
            <input className="woodlem-ai-input" ref={inputRef} type="text" placeholder="Ask anything about Woodlem..."
              value={inputMessage} onChange={(e) => setInputMessage(e.target.value)} disabled={isLoading}
              style={{ flex: 1, padding: '9px 12px', fontSize: 13, border: '1px solid #E5E7EB', borderRadius: 8, outline: 'none', background: '#F9FAFB', fontFamily: 'inherit', color: '#111827', transition: 'border-color 0.15s' }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#2C6E6A')}
              onBlur={(e) => (e.currentTarget.style.borderColor = '#E5E7EB')}
            />
            <button className="woodlem-ai-send" type="submit" disabled={!inputMessage.trim() || isLoading}
              style={{ width: 34, height: 34, borderRadius: 8, border: 'none', background: inputMessage.trim() && !isLoading ? 'linear-gradient(135deg, #2C6E6A 0%, #3B82F6 100%)' : '#E5E7EB', cursor: inputMessage.trim() && !isLoading ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s ease', boxShadow: inputMessage.trim() && !isLoading ? '0 2px 8px rgba(44,110,106,0.3)' : 'none' }}
            ><Send size={13} color={inputMessage.trim() && !isLoading ? '#FFFFFF' : '#9CA3AF'} /></button>
          </form>
        </div>
      </div>

      {/* FLOATING TRIGGER */}
      {!isAiPanelOpen && (
        <button className="woodlem-ai-launcher" type="button" onClick={toggleAiPanel}
          onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}
          title="Open AI Copilot"
          style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9990, width: 42, height: 42, borderRadius: 10, background: '#FFFFFF', border: '1.5px solid #E5E7EB', boxShadow: isHovered ? '0 8px 24px rgba(0,0,0,0.14)' : '0 4px 12px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)', transform: isHovered ? 'scale(1.07) translateY(-2px)' : 'scale(1)', padding: 0 }}
        >
          <div className="woodlem-ai-launcher-icon" style={{ width: 26, height: 26, borderRadius: 6, background: 'linear-gradient(135deg, #2C6E6A 0%, #3B82F6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={15} fill="white" />
          </div>
          <span style={{ position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: '50%', background: '#10B981', border: '2px solid #FFFFFF' }} />
        </button>
      )}

      <style jsx global>{`
        .woodlem-ai-panel { background: var(--neutral-bg) !important; border-left: 1px solid var(--border-color) !important; box-shadow: -12px 0 32px rgba(45, 44, 42, .045); }
        .woodlem-ai-shell { background: var(--neutral-bg) !important; }
        .woodlem-ai-header { position: relative; overflow: hidden; padding: 17px 16px !important; background: #fffdf9 !important; border-bottom: 1px solid var(--border-color) !important; color: var(--neutral-dark); }
        .woodlem-ai-header > *:not(.woodlem-ai-orb) { position: relative; z-index: 1; }
        .woodlem-ai-header [style*="color: #111827"] { color: var(--neutral-dark) !important; font-size: 14px !important; }
        .woodlem-ai-header [style*="color: #9CA3AF"] { color: var(--text-secondary) !important; }
        .woodlem-ai-header button { background: #fff !important; border-color: var(--border-color) !important; color: var(--text-secondary) !important; }
        .woodlem-ai-avatar { width: 36px !important; height: 36px !important; border-radius: 11px !important; background: #2d2c2a !important; box-shadow: 0 6px 13px rgba(45,44,42,.16); color: #fff; }
        .woodlem-ai-orb { position: absolute; border-radius: 999px; opacity: .45; animation: aiOrbFloat 7s ease-in-out infinite; pointer-events: none; }
        .woodlem-ai-orb-one { width: 95px; height: 95px; background: #f5e7dc; right: -37px; top: -48px; }
        .woodlem-ai-orb-two { width: 52px; height: 52px; background: #edf3ef; left: 118px; bottom: -40px; animation-delay: -3s; }
        .woodlem-ai-context { background: #fffdf9 !important; padding: 8px 16px !important; border-bottom: 1px solid var(--border-color) !important; }
        .woodlem-ai-context [style*="background: #F3F4F6"] { background: var(--secondary-light) !important; color: #476b6b !important; }
        .woodlem-ai-messages { background: radial-gradient(circle at 92% 1%, #f8eee8 0, transparent 26%), var(--neutral-bg) !important; padding: 18px 16px !important; gap: 16px !important; }
        .woodlem-ai-welcome { display: flex; align-items: center; gap: 11px; padding: 12px; border: 1px solid #eadfd7; border-radius: 12px; background: #fffdf9; box-shadow: 0 7px 16px rgba(45,44,42,.035); animation: aiRise .45s ease-out both; }
        .woodlem-ai-welcome-icon { width: 35px; height: 35px; flex: 0 0 auto; display: grid; place-items: center; border-radius: 10px; color: #fff; background: #d4a373; box-shadow: 0 5px 10px rgba(212,163,115,.2); }
        .woodlem-ai-welcome strong { display: block; font: 700 12px var(--font-display); color: var(--neutral-dark); margin-bottom: 2px; }
        .woodlem-ai-welcome span { display: block; color: var(--text-secondary); font-size: 11px; line-height: 1.35; }
        .woodlem-ai-messages > div { animation: aiRise .3s ease-out both; }
        .woodlem-ai-messages > div [style*="background: #FFFFFF"] { border-color: var(--border-color) !important; box-shadow: 0 3px 10px rgba(45,44,42,.035) !important; }
        .woodlem-ai-messages > div [style*="background: #2C6E6A"] { background: #3d7a6e !important; box-shadow: 0 6px 15px rgba(61,122,110,.18) !important; }
        .woodlem-ai-prompt { display: inline-flex !important; align-items: center; gap: 2px; border-radius: 7px !important; background: #fffdf9 !important; border-color: var(--border-color) !important; color: #5a5752 !important; }
        .woodlem-ai-prompt:hover { color: #3d7a6e !important; border-color: #a8c7bf !important; background: var(--parent-light) !important; transform: translateY(-1px); }
        .woodlem-ai-composer { padding: 12px !important; background: #fffdf9 !important; border-top: 1px solid var(--border-color) !important; }
        .woodlem-ai-input { background: #f9f8f6 !important; border-color: var(--border-color) !important; border-radius: 9px !important; padding: 10px 12px !important; }
        .woodlem-ai-input:focus { box-shadow: 0 0 0 3px rgba(107,142,142,.13); }
        .woodlem-ai-send { border-radius: 11px !important; width: 38px !important; height: 38px !important; }
        .woodlem-ai-launcher { width: 48px !important; height: 48px !important; border: 1px solid #4a4844 !important; border-radius: 13px !important; background: #2d2c2a !important; box-shadow: 0 9px 22px rgba(45,44,42,.22) !important; }
        .woodlem-ai-launcher:before { content: ''; position: absolute; inset: -4px; border: 1px solid rgba(212,163,115,.58); border-radius: 16px; animation: aiRing 2.6s ease-out infinite; }
        .woodlem-ai-launcher-icon { width: 32px !important; height: 32px !important; border-radius: 9px !important; background: #454340 !important; border: 1px solid rgba(255,255,255,.12); color: white; }
        @keyframes aiRise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes aiOrbFloat { 50% { transform: translate(-10px, 10px) scale(1.08); } }
        @keyframes aiRing { 0%, 35% { opacity: .8; transform: scale(.92); } 70%, 100% { opacity: 0; transform: scale(1.2); } }
        @keyframes aiDotPulse {
          0% { transform: scale(0.6); opacity: 0.4; }
          100% { transform: scale(1.1); opacity: 1; }
        }
      `}</style>
    </>
  );
};
