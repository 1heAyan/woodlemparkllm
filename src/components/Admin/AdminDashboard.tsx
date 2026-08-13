'use client';

import React, { useState } from 'react';
import { UserProfile, ParentDocument, HubActivity } from '@/lib/supabaseClient';
import { getIcon, HUB_TYPE_ICONS } from '../Icons';

interface AdminDashboardProps {
  currentUser: UserProfile;
  profiles: UserProfile[];
  parentDocuments: ParentDocument[];
  hubActivities: HubActivity[];
  onOpenProvisionModal: () => void;
  onOpenBulkModal: () => void;
  onEditUser: (user: UserProfile) => void;
  onDeleteUser: (userId: string) => void;
  onSignOut: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  profiles,
  parentDocuments,
  hubActivities,
  onOpenProvisionModal,
  onOpenBulkModal,
  onEditUser,
  onDeleteUser,
  onSignOut,
}) => {
  const [activeTab, setActiveTab] = useState<'accounts' | 'documents' | 'hub'>('accounts');
  const [activeNav, setActiveNav] = useState('User Directory');
  const [roleDirectoryFilter, setRoleDirectoryFilter] = useState<'all' | 'student' | 'teacher' | 'parent'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [docFilterStudent, setDocFilterStudent] = useState('');

  const filteredProfiles = profiles.filter((p) => {
    if (p.role === 'admin' && currentUser.id !== p.id) return false;
    if (roleDirectoryFilter !== 'all' && p.role !== roleDirectoryFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (p.name || '').toLowerCase().includes(q);
      const matchEmail = (p.email || '').toLowerCase().includes(q);
      const matchCode = (p.user_code || '').toLowerCase().includes(q);
      return matchName || matchEmail || matchCode;
    }
    return true;
  });

  const studentsList = profiles.filter((p) => p.role === 'student');

  const filteredDocs = docFilterStudent
    ? parentDocuments.filter((d) => d.student_id === docFilterStudent)
    : parentDocuments;

  return (
    <div className="app-viewport">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <img src="/image_35dba9.jpeg" alt="Woodlem Park" className="sidebar-logo" />
          </div>
          <div className="profile-card">
            <div className="profile-avatar avatar-admin">A</div>
            <div className="profile-info">
              <h3>{currentUser.name || 'System Admin'}</h3>
              <p>{currentUser.email || 'admin@woodlem.com'}</p>
            </div>
          </div>
        </div>
        <nav className="nav-menu">
          <div className="nav-label">System</div>
          {['User Directory', 'System Settings'].map((item) => (
            <button
              key={item}
              className={`nav-item ${activeNav === item ? 'active' : ''}`}
              onClick={() => setActiveNav(item)}
            >
              {item}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="logout-btn-clean" onClick={onSignOut}>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="content-header">
          <div className="header-top">
            <h1 className="page-title">{activeNav}</h1>
          </div>
          <div className="tabs">
            <button className={`tab-btn ${activeTab === 'accounts' ? 'active' : ''}`} onClick={() => setActiveTab('accounts')}>
              Active Accounts ({profiles.length})
            </button>
            <button className={`tab-btn ${activeTab === 'documents' ? 'active' : ''}`} onClick={() => setActiveTab('documents')}>
              Document Submissions ({parentDocuments.length})
            </button>
            <button className={`tab-btn ${activeTab === 'hub' ? 'active' : ''}`} onClick={() => setActiveTab('hub')}>
              {getIcon('plant')} Holistic Hub ({hubActivities.length})
            </button>
          </div>
        </header>

        <div className="content-body">
          {/* Active Accounts */}
          {activeTab === 'accounts' && (
            <div>
              {/* Metrics Overview Grid */}
              <div className="admin-metrics-grid">
                <div className="admin-metric-card">
                  <div className="admin-metric-icon-box avatar-admin">👥</div>
                  <div>
                    <div className="admin-metric-value">{profiles.length}</div>
                    <div className="admin-metric-label">Total Accounts</div>
                  </div>
                </div>

                <div className="admin-metric-card">
                  <div className="admin-metric-icon-box avatar-student">🎓</div>
                  <div>
                    <div className="admin-metric-value">
                      {profiles.filter((p) => p.role === 'student').length}
                    </div>
                    <div className="admin-metric-label">Enrolled Students</div>
                  </div>
                </div>

                <div className="admin-metric-card">
                  <div className="admin-metric-icon-box avatar-teacher">👨‍🏫</div>
                  <div>
                    <div className="admin-metric-value">
                      {profiles.filter((p) => p.role === 'teacher').length}
                    </div>
                    <div className="admin-metric-label">Teachers &amp; Faculty</div>
                  </div>
                </div>

                <div className="admin-metric-card">
                  <div className="admin-metric-icon-box avatar-parent">👨‍👩‍👧</div>
                  <div>
                    <div className="admin-metric-value">
                      {profiles.filter((p) => p.role === 'parent').length}
                    </div>
                    <div className="admin-metric-label">Registered Parents</div>
                  </div>
                </div>
              </div>

              {/* Main User Directory Panel */}
              <div className="panel-block">
                <div className="panel-header-action" style={{ flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
                  <div>
                    <h3 className="section-title" style={{ margin: 0 }}>
                      User Directory
                    </h3>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                      All provisioned users stored in Supabase `profiles` table.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Search name, email, code..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{ width: 220, padding: '10px 14px' }}
                    />
                    <select
                      className="form-input"
                      style={{ width: 140, padding: '10px 14px' }}
                      value={roleDirectoryFilter}
                      onChange={(e) => setRoleDirectoryFilter(e.target.value as any)}
                    >
                      <option value="all">All Roles</option>
                      <option value="student">Students</option>
                      <option value="teacher">Teachers</option>
                      <option value="parent">Parents</option>
                      <option value="admin">Admins</option>
                    </select>

                    <button className="btn-secondary" onClick={onOpenBulkModal} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', fontSize: 13, whiteSpace: 'nowrap' }}>
                      📊 Bulk Import Excel
                    </button>
                    <button className="btn-primary" onClick={onOpenProvisionModal} style={{ padding: '10px 18px', fontSize: 13, whiteSpace: 'nowrap' }}>
                      + Provision User
                    </button>
                  </div>
                </div>

                <div className="card-list">
                  {filteredProfiles.length === 0 ? (
                    <div className="empty-state">
                      No matching user accounts found. Click "+ Provision User" or "Bulk Import Excel" above to add users!
                    </div>
                  ) : (
                    filteredProfiles.map((p) => {
                      const initial = (p.name || 'U').charAt(0).toUpperCase();
                      const avatarClass =
                        p.role === 'student'
                          ? 'avatar-student'
                          : p.role === 'teacher'
                          ? 'avatar-teacher'
                          : p.role === 'admin'
                          ? 'avatar-admin'
                          : 'avatar-parent';

                      const badgeClass =
                        p.role === 'student'
                          ? 'badge-test'
                          : p.role === 'teacher'
                          ? 'badge-award'
                          : p.role === 'admin'
                          ? 'badge-pending'
                          : 'badge-hub';

                      return (
                        <div className="user-dir-card" key={p.id}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <div className={`user-dir-avatar ${avatarClass}`}>{initial}</div>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <h4 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, color: 'var(--neutral-dark)' }}>
                                  {p.name}
                                </h4>
                                <span className={`badge ${badgeClass}`} style={{ margin: 0, fontSize: 10 }}>
                                  {p.role}
                                </span>
                              </div>
                              <div className="user-dir-meta">
                                <span className="user-dir-meta-item">
                                  Email: <span className="meta-email">{p.email}</span>
                                </span>
                                {(p.admission_number || p.user_code) && (
                                  <span className="user-dir-meta-item">
                                    Adm No: <span className="meta-code">{p.admission_number || p.user_code}</span>
                                  </span>
                                )}
                                {p.role === 'student' && p.grade && (
                                  <span className="user-dir-meta-item">
                                    <span className="meta-grade">
                                      {p.grade} {p.class_letter ? `(${p.class_letter})` : ''}
                                    </span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              className="btn-secondary"
                              style={{ padding: '8px 14px', fontSize: 13 }}
                              onClick={() => onEditUser(p)}
                            >
                              Edit
                            </button>
                            {p.role !== 'admin' && (
                              <button
                                className="btn-secondary"
                                style={{ padding: '8px 14px', fontSize: 13, background: '#FFF0F0', color: '#D32F2F', borderColor: '#FFCDD2' }}
                                onClick={() => {
                                  if (confirm(`Are you sure you want to delete user "${p.name}" (${p.email})?`)) {
                                    onDeleteUser(p.id);
                                  }
                                }}
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Document Submissions */}
          {activeTab === 'documents' && (
            <div>
              <div className="panel-header-action">
                <div>
                  <h3 className="section-title" style={{ marginBottom: 4 }}>
                    Parent Document Submissions
                  </h3>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    Review all uploaded documents from parents.
                  </p>
                </div>
                <select
                  className="form-input"
                  style={{ width: 200, padding: '10px 14px' }}
                  value={docFilterStudent}
                  onChange={(e) => setDocFilterStudent(e.target.value)}
                >
                  <option value="">All Students</option>
                  {studentsList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="card-list">
                {filteredDocs.length === 0 ? (
                  <div className="empty-state">No parent documents submitted in database yet.</div>
                ) : (
                  filteredDocs.map((doc, idx) => {
                    const student = profiles.find((p) => p.id === doc.student_id);
                    const isSubmitted = doc.status === 'submitted';
                    return (
                      <div className="item-card" key={doc.id || idx}>
                        <div className="item-info">
                          <span
                            className={`badge ${isSubmitted ? 'badge-submitted' : 'badge-pending'}`}
                            style={{ marginBottom: 8 }}
                          >
                            {isSubmitted ? '✓ Submitted' : '⏳ Pending'}
                          </span>
                          <h4>{doc.doc_type}</h4>
                          <p>
                            Student: {student ? student.name : 'Unknown'}{' '}
                            {isSubmitted
                              ? `· File: ${doc.file_name} · Uploaded: ${doc.uploaded_at}`
                              : '· Awaiting upload from parent'}
                          </p>
                        </div>
                        {isSubmitted ? (
                          <button className="btn-secondary btn-primary" style={{ fontSize: 13 }}>
                            View File
                          </button>
                        ) : (
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--doc-pending)' }}>Pending</span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Holistic Hub Overview */}
          {activeTab === 'hub' && (
            <div>
              <div className="panel-header-action">
                <div>
                  <h3 className="section-title" style={{ marginBottom: 4 }}>
                    Holistic Development Hub — Overview
                  </h3>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    All activities created by teachers with full participant rosters.
                  </p>
                </div>
              </div>

              <div className="card-list" style={{ gap: 16 }}>
                {hubActivities.length === 0 ? (
                  <div className="empty-state">No activities published yet.</div>
                ) : (
                  hubActivities.map((act) => {
                    const iconKey = HUB_TYPE_ICONS[act.type] || 'event';
                    const enrolledNames = (act.enrolled_student_ids || [])
                      .map((id) => profiles.find((p) => p.id === id)?.name)
                      .filter(Boolean);

                    return (
                      <div className="hub-list-item" key={act.id}>
                        <div className="hub-type-icon">{getIcon(iconKey)}</div>
                        <div className="hub-list-item-info">
                          <h4>{act.title}</h4>
                          <p style={{ marginBottom: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
                            <span>{act.type}</span> &middot;{' '}
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, verticalAlign: 'middle' }}>
                              {getIcon('date')}
                              {act.date}
                            </span>{' '}
                            &middot; <span>Target: {(act.target_grades || []).join(', ')}</span>
                          </p>
                          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                            Participants:
                          </p>
                          {enrolledNames.length > 0 ? (
                            <div className="roster-list">
                              {enrolledNames.map((n, i) => (
                                <span className="roster-chip" key={i}>
                                  {n}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>No registrations.</p>
                          )}
                        </div>
                        <div className="hub-list-item-stats">
                          <span className="hub-stat-chip">
                            {(act.enrolled_student_ids || []).length} / {studentsList.length}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
