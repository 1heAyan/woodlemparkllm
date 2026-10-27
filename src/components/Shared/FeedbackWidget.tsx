'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquarePlus,
  X,
  Camera,
  Upload,
  CheckCircle,
  AlertCircle,
  Lightbulb,
  Sliders,
  Bug,
  MessageSquare,
  Trash2,
  Maximize2,
  Send,
  Loader2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { UserProfile } from '@/lib/supabaseClient';
import {
  FeedbackCategory,
  FeedbackSubmission,
  submitFeedback,
  getUserStoredFeedbacks,
  fetchUserFeedbacksFromCloud,
  deleteStoredFeedback,
} from '@/lib/feedbackStorage';

interface FeedbackWidgetProps {
  currentUser?: UserProfile | null;
}

export const FeedbackWidget: React.FC<FeedbackWidgetProps> = ({ currentUser }) => {
  const [isMounted, setIsMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Form State
  const [category, setCategory] = useState<FeedbackCategory>('ui_change');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null);
  const [screenshotName, setScreenshotName] = useState<string>('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewModalImage, setPreviewModalImage] = useState<string | null>(null);

  // History state
  const [historyList, setHistoryList] = useState<FeedbackSubmission[]>([]);

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Load history on mount / open strictly for currentUser
  const loadUserHistory = async () => {
    // 1. Instant load from private user-isolated local cache
    setHistoryList(getUserStoredFeedbacks(currentUser));

    // 2. Sync from Supabase cloud (strictly matching currentUser ID/email)
    if (currentUser) {
      try {
        const cloudList = await fetchUserFeedbacksFromCloud(currentUser);
        if (cloudList && cloudList.length > 0) {
          setHistoryList(cloudList);
        }
      } catch {}
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadUserHistory();
    }
  }, [isOpen, currentUser]);

  useEffect(() => {
    const handleUpdated = () => loadUserHistory();
    window.addEventListener('woodlem:feedback_updated', handleUpdated);
    return () => window.removeEventListener('woodlem:feedback_updated', handleUpdated);
  }, [currentUser]);

  // Listen for global open event
  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('woodlem:open_feedback', handleOpen);
    return () => window.removeEventListener('woodlem:open_feedback', handleOpen);
  }, []);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (previewModalImage) {
          setPreviewModalImage(null);
        } else if (isOpen) {
          setIsOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, previewModalImage]);

  // Handle Clipboard Paste of Images (Ctrl+V / Cmd+V)
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (loadEvent) => {
              const result = loadEvent.target?.result as string;
              if (result) {
                setScreenshotDataUrl(result);
                setScreenshotName(`pasted_screenshot_${Date.now()}.png`);
              }
            };
            reader.readAsDataURL(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen]);

  // Handle Instant In-Page Screenshot (Zero browser dialogs/screen-sharing prompts)
  const handleCaptureScreen = async () => {
    try {
      setIsCapturing(true);
      setErrorMessage(null);

      // 1. Temporarily hide feedback drawer, backdrop, and edge tab so they don't appear in the capture
      if (sidebarRef.current) {
        sidebarRef.current.style.visibility = 'hidden';
      }
      const backdrop = document.querySelector('.woodlem-feedback-backdrop') as HTMLElement | null;
      if (backdrop) {
        backdrop.style.visibility = 'hidden';
      }
      const edgeTab = document.querySelector('.woodlem-feedback-edge-tab') as HTMLElement | null;
      if (edgeTab) {
        edgeTab.style.visibility = 'hidden';
      }

      // Small reflow delay
      await new Promise((resolve) => setTimeout(resolve, 90));

      // 2. Dynamically import html2canvas for SSR safety
      const html2canvas = (await import('html2canvas')).default;

      // 3. Render current page directly to canvas
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        allowTaint: true,
        logging: false,
        scale: Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2),
        width: typeof window !== 'undefined' ? window.innerWidth : 1280,
        height: typeof window !== 'undefined' ? window.innerHeight : 800,
        x: typeof window !== 'undefined' ? window.scrollX : 0,
        y: typeof window !== 'undefined' ? window.scrollY : 0,
        ignoreElements: (element) => {
          return (
            element.classList?.contains('woodlem-feedback-sidebar') ||
            element.classList?.contains('woodlem-feedback-edge-tab') ||
            element.classList?.contains('woodlem-feedback-backdrop')
          );
        },
      });

      // 4. Convert to PNG data URL
      const dataUrl = canvas.toDataURL('image/png', 0.92);
      setScreenshotDataUrl(dataUrl);
      setScreenshotName(`screenshot_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`);
    } catch (err: any) {
      console.error('In-page snapshot error:', err);
      setErrorMessage(err.message || 'Could not auto-capture page. You can upload an image or paste (Ctrl+V) instead.');
    } finally {
      // 5. Restore visibility of sidebar, backdrop, and edge tab
      if (sidebarRef.current) {
        sidebarRef.current.style.visibility = 'visible';
      }
      const backdrop = document.querySelector('.woodlem-feedback-backdrop') as HTMLElement | null;
      if (backdrop) {
        backdrop.style.visibility = 'visible';
      }
      const edgeTab = document.querySelector('.woodlem-feedback-edge-tab') as HTMLElement | null;
      if (edgeTab) {
        edgeTab.style.visibility = 'visible';
      }
      setIsCapturing(false);
    }
  };

  // Handle File Upload from device / camera
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file (.png, .jpg, .webp).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const result = loadEvent.target?.result as string;
      if (result) {
        setScreenshotDataUrl(result);
        setScreenshotName(file.name);
        setErrorMessage(null);
      }
    };
    reader.readAsDataURL(file);
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage('Please provide a short title or summary.');
      return;
    }
    if (!description.trim()) {
      setErrorMessage('Please write your suggestions or feedback details.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const pageContext = typeof window !== 'undefined'
        ? `${currentUser?.role ? currentUser.role.toUpperCase() : 'PORTAL'} — ${document.title || window.location.pathname}`
        : 'Woodlem LMS';

      const deviceInfo = typeof window !== 'undefined'
        ? {
            userAgent: navigator.userAgent,
            screenResolution: `${window.screen.width}x${window.screen.height}`,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            platform: navigator.platform,
          }
        : undefined;

      await submitFeedback({
        userId: currentUser?.id,
        userName: currentUser?.name || 'Anonymous User',
        userEmail: currentUser?.email,
        userRole: currentUser?.role,
        category,
        title: title.trim(),
        description: description.trim(),
        pageContext,
        screenshotDataUrl: screenshotDataUrl || undefined,
        screenshotName: screenshotName || undefined,
        deviceInfo,
      }, currentUser);

      setSubmitSuccess(true);
      setHistoryList(getUserStoredFeedbacks(currentUser));
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setTitle('');
    setDescription('');
    setScreenshotDataUrl(null);
    setScreenshotName('');
    setSubmitSuccess(false);
    setErrorMessage(null);
  };

  const handleDeleteHistory = (id: string) => {
    deleteStoredFeedback(id, currentUser);
    setHistoryList(getUserStoredFeedbacks(currentUser));
  };

  if (!isMounted) return null;

  return (
    <>
      {/* 1. BACKDROP OVERLAY ON MOBILE / TABLET */}
      {isOpen && (
        <div
          className="woodlem-feedback-backdrop"
          onClick={() => setIsOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            zIndex: 9991,
            animation: 'fadeIn 0.2s ease',
          }}
        />
      )}

      {/* 3. SLIDE-OVER FEEDBACK SIDEBAR */}
      <div
        ref={sidebarRef}
        className={`woodlem-feedback-sidebar ${isOpen ? 'open' : ''}`}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          maxWidth: 460,
          background: '#FFFFFF',
          zIndex: 9992,
          boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.16)',
          display: 'flex',
          flexDirection: 'column',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        {/* SIDEBAR HEADER */}
        <div
          style={{
            padding: 'calc(14px + env(safe-area-inset-top, 0px)) 18px 14px',
            borderBottom: '1px solid var(--border-color)',
            background: '#FAF9F6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: '#EAF3EF',
                color: '#2C6E6A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <MessageSquarePlus size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--neutral-dark)' }}>
                Feedback &amp; Ideas
              </h3>
              <p style={{ margin: '1px 0 0', fontSize: 11.5, color: 'var(--text-secondary)' }}>
                Suggest UI changes, new tools, or report issues
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Close Feedback Panel"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: '#FFFFFF',
              border: '1px solid var(--border-color)',
              color: 'var(--neutral-dark)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s ease',
            }}
          >
            <X size={17} />
          </button>
        </div>

        {/* ADMIN ACCESS SHORTCUT */}
        {currentUser?.role === 'admin' && (
          <div
            style={{
              padding: '7px 18px',
              background: '#F1F5F9',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 11,
            }}
          >
            <span style={{ color: '#475569', fontWeight: 600 }}>
              Admin Panel Feedback Review Center
            </span>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                window.dispatchEvent(new CustomEvent('woodlem:navigate_admin_feedback'));
              }}
              style={{
                background: '#FFFFFF',
                border: '1px solid #CBD5E1',
                borderRadius: 5,
                padding: '3px 8px',
                fontSize: 11,
                fontWeight: 700,
                color: '#1E293B',
                cursor: 'pointer',
              }}
            >
              Open Admin Review →
            </button>
          </div>
        )}

        {/* TABS: CREATE vs HISTORY */}
        <div
          style={{
            display: 'flex',
            padding: '8px 18px',
            background: '#FFFFFF',
            borderBottom: '1px solid var(--border-color)',
            gap: 8,
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={() => {
              setActiveTab('create');
              setSubmitSuccess(false);
            }}
            style={{
              flex: 1,
              padding: '7px 12px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'create' ? '#EAF3EF' : 'transparent',
              color: activeTab === 'create' ? '#2C6E6A' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            New Suggestion
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            style={{
              flex: 1,
              padding: '7px 12px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'history' ? '#EAF3EF' : 'transparent',
              color: activeTab === 'history' ? '#2C6E6A' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <span>My Submissions</span>
            {historyList.length > 0 && (
              <span
                style={{
                  background: activeTab === 'history' ? '#2C6E6A' : '#E2E8F0',
                  color: activeTab === 'history' ? '#FFFFFF' : 'var(--neutral-dark)',
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '1px 6px',
                  borderRadius: 10,
                }}
              >
                {historyList.length}
              </span>
            )}
          </button>
        </div>

        {/* BODY CONTAINER */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '18px 20px calc(24px + env(safe-area-inset-bottom, 0px))',
            boxSizing: 'border-box',
          }}
        >
          {/* TAB 1: CREATE FEEDBACK FORM */}
          {activeTab === 'create' && (
            <>
              {submitSuccess ? (
                <div
                  style={{
                    padding: '36px 16px',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 14,
                    animation: 'fadeIn 0.2s ease',
                  }}
                >
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                      background: '#ECFDF5',
                      color: '#10B981',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <CheckCircle size={32} />
                  </div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--neutral-dark)' }}>
                    Thank you! Feedback Received
                  </h3>
                  <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-secondary)', maxWidth: 320, lineHeight: 1.5 }}>
                    Your feedback and suggestions have been recorded to help guide future Woodlem updates and improvements.
                  </p>
                  <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                    <button
                      type="button"
                      onClick={handleResetForm}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 7,
                        background: '#2C6E6A',
                        color: '#FFFFFF',
                        border: 'none',
                        fontSize: 12.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Submit Another Idea
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 7,
                        background: '#F1F5F9',
                        color: 'var(--neutral-dark)',
                        border: '1px solid var(--border-color)',
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* CONTEXT CHIP */}
                  <div
                    suppressHydrationWarning
                    style={{
                      background: '#F8F7F4',
                      border: '1px solid var(--border-color)',
                      borderRadius: 8,
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 11.5,
                    }}
                  >
                    <span suppressHydrationWarning style={{ color: 'var(--text-secondary)' }}>
                      Active Portal:{' '}
                      <strong suppressHydrationWarning style={{ color: '#2C6E6A' }}>
                        {currentUser?.role ? `${currentUser.role.toUpperCase()} PORTAL` : 'WOODLEM LMS'}
                      </strong>
                    </span>
                    <span
                      suppressHydrationWarning
                      style={{
                        color: currentUser?.name ? '#1E293B' : '#64748B',
                        fontSize: 11,
                        fontWeight: currentUser?.name ? 700 : 500,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      {currentUser?.name ? (
                        <>
                          <span>{currentUser.name}</span>
                          <span
                            style={{
                              fontSize: 9.5,
                              fontWeight: 800,
                              padding: '1.5px 5px',
                              borderRadius: 4,
                              background: '#E2E8F0',
                              color: '#334155',
                              textTransform: 'uppercase',
                              letterSpacing: '0.03em',
                            }}
                          >
                            {currentUser.role || 'User'}
                          </span>
                        </>
                      ) : (
                        'Visitor / Not logged in'
                      )}
                    </span>
                  </div>

                  {/* CATEGORY SELECTOR */}
                  <div>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--neutral-dark)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Feedback Category
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => setCategory('ui_change')}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 8,
                          border: category === 'ui_change' ? '2px solid #2C6E6A' : '1px solid var(--border-color)',
                          background: category === 'ui_change' ? '#EAF3EF' : '#FFFFFF',
                          color: category === 'ui_change' ? '#1C4D46' : 'var(--neutral-dark)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          textAlign: 'left',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <Sliders size={16} color={category === 'ui_change' ? '#2C6E6A' : '#64748B'} />
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700 }}>UI / Layout Change</div>
                          <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Relocate or modify elements</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCategory('feature_request')}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 8,
                          border: category === 'feature_request' ? '2px solid #2C6E6A' : '1px solid var(--border-color)',
                          background: category === 'feature_request' ? '#EAF3EF' : '#FFFFFF',
                          color: category === 'feature_request' ? '#1C4D46' : 'var(--neutral-dark)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          textAlign: 'left',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <Lightbulb size={16} color={category === 'feature_request' ? '#2C6E6A' : '#64748B'} />
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700 }}>New Feature</div>
                          <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Downloads, uploads &amp; tools</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCategory('bug')}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 8,
                          border: category === 'bug' ? '2px solid #DC2626' : '1px solid var(--border-color)',
                          background: category === 'bug' ? '#FEF2F2' : '#FFFFFF',
                          color: category === 'bug' ? '#991B1B' : 'var(--neutral-dark)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          textAlign: 'left',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <Bug size={16} color={category === 'bug' ? '#DC2626' : '#64748B'} />
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700 }}>Bug / Issue</div>
                          <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Broken or glitching</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCategory('general')}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 8,
                          border: category === 'general' ? '2px solid #2C6E6A' : '1px solid var(--border-color)',
                          background: category === 'general' ? '#EAF3EF' : '#FFFFFF',
                          color: category === 'general' ? '#1C4D46' : 'var(--neutral-dark)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          textAlign: 'left',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <MessageSquare size={16} color={category === 'general' ? '#2C6E6A' : '#64748B'} />
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700 }}>General Idea</div>
                          <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Overall feedback</div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* TITLE INPUT */}
                  <div>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--neutral-dark)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Headline / Title <span style={{ color: '#DC2626' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={
                        category === 'ui_change'
                          ? 'e.g. Move the Export button to the top toolbar'
                          : category === 'feature_request'
                          ? 'e.g. Add Excel format download for student attendance'
                          : category === 'bug'
                          ? 'e.g. Mobile drawer closes unexpectedly when clicking awards'
                          : 'e.g. Simplify student document status pills'
                      }
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: '1px solid var(--border-color)',
                        fontSize: 13,
                        color: 'var(--neutral-dark)',
                        outline: 'none',
                        background: '#FFFFFF',
                      }}
                    />
                  </div>

                  {/* DESCRIPTION TEXTAREA */}
                  <div>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--neutral-dark)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Detailed Info &amp; Suggestions <span style={{ color: '#DC2626' }}>*</span>
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={4}
                      placeholder="Explain what should be changed, what new option or upload type you need, or how you want this workflow to look..."
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: '1px solid var(--border-color)',
                        fontSize: 13,
                        color: 'var(--neutral-dark)',
                        outline: 'none',
                        resize: 'vertical',
                        lineHeight: 1.5,
                        background: '#FFFFFF',
                        minHeight: 90,
                      }}
                    />
                  </div>

                  {/* SCREENSHOT ATTACHMENT SECTION */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--neutral-dark)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Screenshot &amp; Visual Evidence
                      </label>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Optional but recommended</span>
                    </div>

                    {!screenshotDataUrl ? (
                      <div
                        style={{
                          border: '1.5px dashed var(--border-color)',
                          borderRadius: 10,
                          padding: '16px 14px',
                          background: '#FAF9F6',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 10,
                          textAlign: 'center',
                        }}
                      >
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                          {/* Snap Screenshot Button */}
                          <button
                            type="button"
                            onClick={handleCaptureScreen}
                            disabled={isCapturing}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '8px 14px',
                              borderRadius: 8,
                              background: '#2C6E6A',
                              color: '#FFFFFF',
                              border: 'none',
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: isCapturing ? 'not-allowed' : 'pointer',
                              boxShadow: '0 2px 6px rgba(44,110,106,0.2)',
                            }}
                          >
                            {isCapturing ? <Loader2 size={15} className="spin-animate" /> : <Camera size={15} />}
                            <span>{isCapturing ? 'Snapping Page...' : 'Snap Current Page'}</span>
                          </button>

                          {/* Upload File Button */}
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '8px 14px',
                              borderRadius: 8,
                              background: '#FFFFFF',
                              color: 'var(--neutral-dark)',
                              border: '1px solid var(--border-color)',
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            <Upload size={15} />
                            <span>Upload Image</span>
                          </button>
                        </div>

                        <div style={{ fontSize: 11, color: '#64748B' }}>
                          Directly captures current page view, choose file, or press <kbd style={{ padding: '2px 5px', background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: 4, fontFamily: 'monospace' }}>Ctrl+V</kbd> to paste
                        </div>

                        {/* Hidden native file input */}
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload}
                          style={{ display: 'none' }}
                        />
                      </div>
                    ) : (
                      /* SCREENSHOT PREVIEW CARD */
                      <div
                        style={{
                          background: '#FFFFFF',
                          border: '1px solid #C7E4D8',
                          borderRadius: 10,
                          padding: 10,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            position: 'relative',
                            borderRadius: 8,
                            overflow: 'hidden',
                            border: '1px solid #E2E8F0',
                            maxHeight: 160,
                            background: '#0F172A',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                          }}
                          onClick={() => setPreviewModalImage(screenshotDataUrl)}
                          title="Click to zoom in"
                        >
                          <img
                            src={screenshotDataUrl}
                            alt="Screenshot Attachment"
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'contain',
                              maxHeight: 160,
                              display: 'block',
                            }}
                          />
                          <div
                            style={{
                              position: 'absolute',
                              top: 6,
                              right: 6,
                              background: 'rgba(0, 0, 0, 0.65)',
                              color: '#FFFFFF',
                              borderRadius: 6,
                              padding: '3px 6px',
                              fontSize: 10.5,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <Maximize2 size={12} />
                            <span>View Full</span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
                          <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--neutral-dark)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>
                            {screenshotName || 'Attached Screenshot'}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setScreenshotDataUrl(null);
                              setScreenshotName('');
                            }}
                            style={{
                              background: '#FEE2E2',
                              border: '1px solid #FECACA',
                              color: '#DC2626',
                              borderRadius: 6,
                              padding: '4px 8px',
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <Trash2 size={13} />
                            <span>Remove</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ERROR MESSAGE */}
                  {errorMessage && (
                    <div
                      style={{
                        padding: '10px 14px',
                        borderRadius: 8,
                        background: '#FEF2F2',
                        border: '1px solid #FECACA',
                        color: '#991B1B',
                        fontSize: 12,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <AlertCircle size={15} style={{ flexShrink: 0 }} />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {/* SUBMIT BUTTON */}
                  <div style={{ marginTop: 4 }}>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      style={{
                        width: '100%',
                        padding: '12px 18px',
                        borderRadius: 8,
                        background: 'linear-gradient(135deg, #1C4D46 0%, #2C6E6A 100%)',
                        color: '#FFFFFF',
                        border: 'none',
                        fontSize: 13.5,
                        fontWeight: 700,
                        cursor: isSubmitting ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        boxShadow: '0 4px 14px rgba(44,110,106,0.25)',
                        transition: 'opacity 0.15s ease',
                      }}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 size={16} className="spin-animate" />
                          <span>Submitting Feedback...</span>
                        </>
                      ) : (
                        <>
                          <Send size={15} />
                          <span>Submit Feedback</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

          {/* TAB 2: FEEDBACK HISTORY */}
          {activeTab === 'history' && (
            <div>
              {historyList.length === 0 ? (
                <div
                  style={{
                    padding: '36px 16px',
                    textAlign: 'center',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <Clock size={32} color="#94A3B8" />
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                    {currentUser ? 'No Previous Feedback Yet' : 'Sign In Required'}
                  </div>
                  <p style={{ margin: 0, fontSize: 12, maxWidth: 280, lineHeight: 1.5 }}>
                    {currentUser
                      ? 'Your submitted feedback, feature ideas, and bugs will show up here along with their review status.'
                      : 'Please sign in to your Woodlem LMS account to view and track your submitted feedback.'}
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {historyList.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        background: '#FFFFFF',
                        border: '1px solid var(--border-color)',
                        borderRadius: 8,
                        padding: '12px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              padding: '2px 7px',
                              borderRadius: 4,
                              background:
                                item.category === 'bug'
                                  ? '#FEF2F2'
                                  : item.category === 'feature_request'
                                  ? '#EFF6FF'
                                  : '#EAF3EF',
                              color:
                                item.category === 'bug'
                                  ? '#991B1B'
                                  : item.category === 'feature_request'
                                  ? '#1D4ED8'
                                  : '#1C4D46',
                              display: 'inline-block',
                              marginBottom: 4,
                            }}
                          >
                            {item.category.replace('_', ' ')}
                          </span>
                          <h4 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                            {item.title}
                          </h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteHistory(item.id)}
                          title="Delete from local log"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#94A3B8',
                            cursor: 'pointer',
                            padding: 4,
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      <p style={{ margin: 0, fontSize: 12, color: '#4B5563', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
                        {item.description}
                      </p>

                      {item.screenshotDataUrl && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '6px 8px',
                            background: '#F8F7F4',
                            borderRadius: 6,
                            cursor: 'pointer',
                          }}
                          onClick={() => setPreviewModalImage(item.screenshotDataUrl || null)}
                        >
                          <img
                            src={item.screenshotDataUrl}
                            alt="Screenshot"
                            style={{ width: 36, height: 26, objectFit: 'cover', borderRadius: 4 }}
                          />
                          <span style={{ fontSize: 11, color: '#2C6E6A', fontWeight: 600 }}>
                            View attached screenshot →
                          </span>
                        </div>
                      )}

                      <div style={{ fontSize: 10.5, color: '#94A3B8', borderTop: '1px solid #F1F5F9', paddingTop: 6 }}>
                        {new Date(item.createdAt).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 4. FULLSCREEN SCREENSHOT PREVIEW MODAL */}
      {previewModalImage && (
        <div
          onClick={() => setPreviewModalImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            boxSizing: 'border-box',
            animation: 'fadeIn 0.15s ease',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '92vw',
              maxHeight: '90vh',
              background: '#FFFFFF',
              borderRadius: 12,
              overflow: 'hidden',
              boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                zIndex: 2,
              }}
            >
              <button
                type="button"
                onClick={() => setPreviewModalImage(null)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'rgba(0,0,0,0.65)',
                  color: '#FFFFFF',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={18} />
              </button>
            </div>
            <img
              src={previewModalImage}
              alt="Full Preview"
              style={{
                maxWidth: '92vw',
                maxHeight: '90vh',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          </div>
        </div>
      )}

      {/* 5. RESPONSIVE COMPONENT STYLES */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes tooltipFadeIn {
          from { opacity: 0; transform: translate(-50%, 6px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes feedbackRingRotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .spin-animate {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .woodlem-feedback-sidebar {
            max-width: 100vw !important;
            width: 100vw !important;
            height: 100dvh !important;
            border-radius: 0 !important;
          }
        }
      `}</style>
    </>
  );
};
