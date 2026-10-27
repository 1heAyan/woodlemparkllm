'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  FeedbackSubmission,
  FeedbackStatus,
  FeedbackCategory,
  getAllFeedbackSubmissions,
  updateFeedbackStatus,
  deleteFeedbackRecord,
} from '@/lib/feedbackStorage';
import { UserProfile } from '@/lib/supabaseClient';
import {
  MessageSquarePlus,
  Sliders,
  Lightbulb,
  Bug,
  MessageSquare,
  Search,
  CheckCircle2,
  Clock,
  Check,
  Trash2,
  Maximize2,
  X,
  ExternalLink,
  ShieldAlert,
  User,
  Filter,
  RefreshCw,
  Layers,
} from 'lucide-react';

interface AdminFeedbackViewProps {
  currentUser: UserProfile;
  profiles?: UserProfile[];
}

export const AdminFeedbackView: React.FC<AdminFeedbackViewProps> = ({ currentUser, profiles = [] }) => {
  const [submissions, setSubmissions] = useState<FeedbackSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | FeedbackCategory>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'student' | 'teacher' | 'parent' | 'admin'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | FeedbackStatus>('all');
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  const fetchFeedbacks = async () => {
    setIsLoading(true);
    try {
      const data = await getAllFeedbackSubmissions();
      setSubmissions(data);
    } catch (err) {
      console.warn('Failed to load feedback in AdminFeedbackView:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedbacks();
    const handleUpdated = () => fetchFeedbacks();
    window.addEventListener('woodlem:feedback_updated', handleUpdated);
    return () => window.removeEventListener('woodlem:feedback_updated', handleUpdated);
  }, []);

  // Filtered List
  const filteredSubmissions = useMemo(() => {
    return submissions.filter((item) => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (roleFilter !== 'all' && (item.userRole || '').toLowerCase() !== roleFilter) return false;
      if (statusFilter !== 'all' && (item.status || 'new') !== statusFilter) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesTitle = (item.title || '').toLowerCase().includes(q);
        const matchesDesc = (item.description || '').toLowerCase().includes(q);
        const matchesUser = (item.userName || '').toLowerCase().includes(q);
        const matchesEmail = (item.userEmail || '').toLowerCase().includes(q);
        const matchesContext = (item.pageContext || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesUser && !matchesEmail && !matchesContext) {
          return false;
        }
      }
      return true;
    });
  }, [submissions, categoryFilter, roleFilter, statusFilter, searchTerm]);

  // Statistics
  const stats = useMemo(() => {
    const total = submissions.length;
    const newCount = submissions.filter((s) => s.status === 'new' || !s.status).length;
    const reviewedCount = submissions.filter((s) => s.status === 'reviewed').length;
    const resolvedCount = submissions.filter((s) => s.status === 'resolved').length;
    const withScreenshots = submissions.filter((s) => !!s.screenshotDataUrl).length;
    return { total, newCount, reviewedCount, resolvedCount, withScreenshots };
  }, [submissions]);

  const handleStatusChange = async (id: string, newStatus: FeedbackStatus) => {
    await updateFeedbackStatus(id, newStatus, submissions);
    setSubmissions((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
    );
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this feedback submission?')) return;
    await deleteFeedbackRecord(id);
    setSubmissions((prev) => prev.filter((item) => item.id !== id));
  };

  // Helper to format category badge
  const renderCategoryBadge = (cat: FeedbackCategory) => {
    switch (cat) {
      case 'ui_change':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 6, background: '#EAF3EF', color: '#1C4D46', fontSize: 11, fontWeight: 700 }}>
            <Sliders size={12} /> UI / Layout Change
          </span>
        );
      case 'feature_request':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 6, background: '#EFF6FF', color: '#1D4ED8', fontSize: 11, fontWeight: 700 }}>
            <Lightbulb size={12} /> New Feature
          </span>
        );
      case 'bug':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 6, background: '#FEF2F2', color: '#B91C1C', fontSize: 11, fontWeight: 700 }}>
            <Bug size={12} /> Bug Report
          </span>
        );
      default:
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 6, background: '#F8FAFC', color: '#475569', fontSize: 11, fontWeight: 700 }}>
            <MessageSquare size={12} /> General Idea
          </span>
        );
    }
  };

  // Helper to get user profile avatar if exists
  const getUserProfile = (userId?: string, userEmail?: string) => {
    if (!userId && !userEmail) return null;
    return profiles.find(
      (p) =>
        (userId && p.id === userId) ||
        (userEmail && p.email && p.email.toLowerCase() === userEmail.toLowerCase())
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 1. HEADER & SUMMARY METRICS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#1E293B', letterSpacing: '-0.02em' }}>
              User Feedback &amp; Ideas
            </h1>
            <span
              style={{
                background: '#F1F5F9',
                color: '#475569',
                fontSize: 12,
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: 20,
              }}
            >
              {submissions.length} Total
            </span>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748B' }}>
            Review suggestions, UI improvement requests, and bug reports submitted by students, teachers, and parents.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchFeedbacks}
          disabled={isLoading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            borderRadius: 8,
            background: '#FFFFFF',
            border: '1px solid #CBD5E1',
            color: '#334155',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background 0.15s ease',
          }}
        >
          <RefreshCw size={13} className={isLoading ? 'spin-animate' : ''} />
          <span>Refresh Feed</span>
        </button>
      </div>

      {/* 2. STATS CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              New Submissions
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#DC2626', marginTop: 4 }}>
              {stats.newCount}
            </div>
          </div>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#FEF2F2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={18} />
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Under Review
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#D97706', marginTop: 4 }}>
              {stats.reviewedCount}
            </div>
          </div>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Layers size={18} />
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Resolved
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#059669', marginTop: 4 }}>
              {stats.resolvedCount}
            </div>
          </div>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#D1FAE5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={18} />
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              With Screenshots
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#2563EB', marginTop: 4 }}>
              {stats.withScreenshots}
            </div>
          </div>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Maximize2 size={18} />
          </div>
        </div>
      </div>

      {/* 3. FILTER TOOLBAR */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: 12,
          padding: '14px 16px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260 }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: 320 }}>
            <Search
              size={14}
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search user, email, title, or details..."
              style={{
                width: '100%',
                padding: '8px 12px 8px 32px',
                borderRadius: 8,
                border: '1px solid #CBD5E1',
                fontSize: 12.5,
                color: '#1E293B',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  padding: 2,
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Filter Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as any)}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: '#334155',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <option value="all">All Categories</option>
            <option value="ui_change">UI / Layout Changes</option>
            <option value="feature_request">New Features</option>
            <option value="bug">Bug Reports</option>
            <option value="general">General Ideas</option>
          </select>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: '#334155',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <option value="all">All Submitter Roles</option>
            <option value="student">Students</option>
            <option value="teacher">Teachers</option>
            <option value="parent">Parents</option>
            <option value="admin">Admins</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: '#334155',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <option value="all">All Statuses</option>
            <option value="new">New / Unreviewed</option>
            <option value="reviewed">Under Review</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
      </div>

      {/* 4. SUBMISSIONS LIST */}
      {filteredSubmissions.length === 0 ? (
        <div
          style={{
            background: '#FFFFFF',
            border: '1px dashed #CBD5E1',
            borderRadius: 14,
            padding: '48px 24px',
            textAlign: 'center',
            color: '#64748B',
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: '#F1F5F9',
              color: '#64748B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
            }}
          >
            <MessageSquarePlus size={24} />
          </div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1E293B' }}>
            No Feedback Submissions Found
          </h3>
          <p style={{ margin: '6px 0 0', fontSize: 13 }}>
            {searchTerm || categoryFilter !== 'all' || roleFilter !== 'all' || statusFilter !== 'all'
              ? 'Try resetting your search query or filters to see more results.'
              : 'Submissions from students, teachers, and parents will appear here automatically.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filteredSubmissions.map((item) => {
            const matchedProfile = getUserProfile(item.userId, item.userEmail);
            const userAvatar = matchedProfile?.avatar_url;
            const userDisplayName = item.userName || matchedProfile?.name || 'Anonymous User';
            const userRoleName = (item.userRole || matchedProfile?.role || 'user').toUpperCase();

            const isNew = item.status === 'new' || !item.status;
            const isReviewed = item.status === 'reviewed';
            const isResolved = item.status === 'resolved';

            return (
              <div
                key={item.id}
                style={{
                  background: '#FFFFFF',
                  border: isNew ? '1.5px solid #FCA5A5' : '1px solid #E2E8F0',
                  borderRadius: 14,
                  padding: '18px 20px',
                  boxShadow: isNew ? '0 4px 16px rgba(239, 68, 68, 0.08)' : '0 2px 8px rgba(0, 0, 0, 0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                  transition: 'box-shadow 0.15s ease',
                }}
              >
                {/* SUBMISSION TOP BAR: USER PROFILE + CATEGORY + STATUS */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                  {/* User Profile Card */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        background:
                          item.userRole === 'teacher'
                            ? '#EFF6FF'
                            : item.userRole === 'parent'
                            ? '#FEF3C7'
                            : item.userRole === 'admin'
                            ? '#EDE9FE'
                            : '#EAF3EF',
                        color:
                          item.userRole === 'teacher'
                            ? '#1D4ED8'
                            : item.userRole === 'parent'
                            ? '#B45309'
                            : item.userRole === 'admin'
                            ? '#6D28D9'
                            : '#1C4D46',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: 14,
                        overflow: 'hidden',
                        flexShrink: 0,
                      }}
                    >
                      {userAvatar ? (
                        <img src={userAvatar} alt={userDisplayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        userDisplayName.charAt(0).toUpperCase()
                      )}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A' }}>
                          {userDisplayName}
                        </span>
                        <span
                          style={{
                            padding: '1.5px 6.5px',
                            borderRadius: 4,
                            fontSize: 10.5,
                            fontWeight: 800,
                            letterSpacing: '0.03em',
                            background:
                              item.userRole === 'teacher'
                                ? '#DBEAFE'
                                : item.userRole === 'parent'
                                ? '#FEF3C7'
                                : item.userRole === 'admin'
                                ? '#EDE9FE'
                                : '#D1FAE5',
                            color:
                              item.userRole === 'teacher'
                                ? '#1E40AF'
                                : item.userRole === 'parent'
                                ? '#92400E'
                                : item.userRole === 'admin'
                                ? '#5B21B6'
                                : '#065F46',
                          }}
                        >
                          {userRoleName}
                        </span>
                      </div>
                      <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 1 }}>
                        {item.userEmail || 'No email provided'} • {new Date(item.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                      </div>
                    </div>
                  </div>

                  {/* Badges: Category & Status */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {renderCategoryBadge(item.category)}

                    {/* Status Pill */}
                    <span
                      style={{
                        padding: '3px 8.5px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        background: isNew ? '#FEE2E2' : isReviewed ? '#FEF3C7' : '#D1FAE5',
                        color: isNew ? '#B91C1C' : isReviewed ? '#B45309' : '#047857',
                        border: isNew ? '1px solid #FCA5A5' : isReviewed ? '1px solid #FDE68A' : '1px solid #A7F3D0',
                      }}
                    >
                      {isNew ? 'New' : isReviewed ? 'In Review' : 'Resolved'}
                    </span>
                  </div>
                </div>

                {/* TITLE & DESCRIPTION */}
                <div style={{ paddingLeft: 48 }}>
                  <h4 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 800, color: '#0F172A' }}>
                    {item.title}
                  </h4>
                  <p style={{ margin: 0, fontSize: 13, color: '#334155', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                    {item.description}
                  </p>

                  {/* PAGE CONTEXT TAG */}
                  {item.pageContext && (
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        marginTop: 10,
                        padding: '4px 9px',
                        borderRadius: 6,
                        background: '#F8FAFC',
                        border: '1px solid #E2E8F0',
                        fontSize: 11,
                        color: '#64748B',
                      }}
                    >
                      <span>Context:</span>
                      <strong style={{ color: '#334155' }}>{item.pageContext}</strong>
                    </div>
                  )}

                  {/* SCREENSHOT EVIDENCE THUMBNAIL */}
                  {item.screenshotDataUrl && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Visual Screenshot Evidence:
                      </div>
                      <div
                        onClick={() => setPreviewImage({ url: item.screenshotDataUrl!, title: item.title })}
                        style={{
                          display: 'inline-block',
                          position: 'relative',
                          borderRadius: 8,
                          overflow: 'hidden',
                          border: '1px solid #CBD5E1',
                          cursor: 'pointer',
                          background: '#0F172A',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                        }}
                      >
                        <img
                          src={item.screenshotDataUrl}
                          alt="Feedback Screenshot"
                          style={{
                            maxWidth: 240,
                            maxHeight: 140,
                            display: 'block',
                            objectFit: 'cover',
                            transition: 'opacity 0.15s ease',
                          }}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            background: 'rgba(0,0,0,0.4)',
                            opacity: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            color: '#FFFFFF',
                            fontSize: 11,
                            fontWeight: 700,
                            transition: 'opacity 0.15s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
                        >
                          <Maximize2 size={14} />
                          <span>View Full</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ADMIN ACTION CONTROLS */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: 14,
                      paddingTop: 12,
                      borderTop: '1px solid #F1F5F9',
                      flexWrap: 'wrap',
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11.5, color: '#64748B', fontWeight: 600 }}>Update Status:</span>

                      {item.status !== 'reviewed' && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(item.id, 'reviewed')}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 6,
                            background: '#FEF3C7',
                            color: '#92400E',
                            border: '1px solid #FDE68A',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Mark Under Review
                        </button>
                      )}

                      {item.status !== 'resolved' && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(item.id, 'resolved')}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 6,
                            background: '#D1FAE5',
                            color: '#065F46',
                            border: '1px solid #A7F3D0',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Mark as Resolved
                        </button>
                      )}

                      {item.status === 'resolved' && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(item.id, 'new')}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 6,
                            background: '#F1F5F9',
                            color: '#475569',
                            border: '1px solid #CBD5E1',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Reopen
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: 6,
                        background: 'transparent',
                        color: '#EF4444',
                        border: 'none',
                        fontSize: 11.5,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Trash2 size={13} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. FULLSCREEN SCREENSHOT PREVIEW MODAL */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            boxSizing: 'border-box',
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
              boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                background: '#FAF9F6',
                borderBottom: '1px solid #E2E8F0',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
                Screenshot: {previewImage.title}
              </span>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  background: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  color: '#475569',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={15} />
              </button>
            </div>
            <img
              src={previewImage.url}
              alt={previewImage.title}
              style={{
                maxWidth: '92vw',
                maxHeight: '82vh',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
