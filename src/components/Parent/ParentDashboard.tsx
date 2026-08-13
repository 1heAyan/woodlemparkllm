'use client';

import React, { useState } from 'react';
import {
  Student,
  TestItem,
  AssignmentItem,
  SyllabusTerm,
  ParentDocument,
  HubActivity,
} from '@/lib/supabaseClient';
import { getIcon } from '../Icons';

interface ParentDashboardProps {
  currentChild: Student;
  tests: TestItem[];
  assignments: AssignmentItem[];
  syllabus: SyllabusTerm[];
  attendance: Record<string, Record<string, string>>;
  parentDocuments: ParentDocument[];
  hubActivities: HubActivity[];
  onUploadDoc: (docType: string, fileName: string) => void;
  onRemoveDoc: (docType: string) => void;
  onOpenVideoModal: (activity: HubActivity) => void;
  onSignOut: () => void;
}

const REQUIRED_DOC_TYPES = [
  { type: 'Student ID', iconKey: 'id_card', desc: "A clear photo of the student's ID card or government-issued photo ID." },
  { type: 'Admission Form', iconKey: 'admission', desc: 'Completed and signed school admission form.' },
  { type: 'Medical Form', iconKey: 'medical', desc: 'Student health declaration and immunization records.' },
  { type: 'Consent Letter', iconKey: 'consent', desc: 'General parental consent letter for school activities.' },
  { type: 'Permission Slip — Field Trip', iconKey: 'permission', desc: 'Signed permission slip for upcoming field trips.' },
  { type: 'Emergency Contact Form', iconKey: 'emergency', desc: 'Emergency contact details and medical alerts.' },
];

export const ParentDashboard: React.FC<ParentDashboardProps> = ({
  currentChild,
  tests,
  assignments,
  syllabus,
  attendance,
  parentDocuments,
  hubActivities,
  onUploadDoc,
  onRemoveDoc,
  onOpenVideoModal,
  onSignOut,
}) => {
  const [activeTab, setActiveTab] = useState<'progress' | 'documents' | 'hub'>('progress');

  // Attendance stats for child
  const dates = Object.keys(attendance).sort().slice(-5);
  let presentCount = 0;
  let absentCount = 0;

  dates.forEach((d) => {
    const status = (attendance[d] || {})[currentChild.id];
    if (status === 'present') presentCount++;
    else if (status) absentCount++;
  });

  // Syllabus %
  let totalTopics = 0;
  let teacherDone = 0;
  syllabus.forEach((t) => {
    (t.topics || []).forEach((topic) => {
      totalTopics++;
      if (topic.teacher_checked) teacherDone++;
    });
  });
  const syllabusPct = totalTopics > 0 ? Math.round((teacherDone / totalTopics) * 100) : 0;

  const handleFileInputChange = (docType: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUploadDoc(docType, e.target.files[0].name);
    }
  };

  return (
    <div className="app-viewport">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <img src="/image_35dba9.jpeg" alt="Woodlem Park" className="sidebar-logo" />
          </div>
          <div className="profile-card">
            <div className="profile-avatar avatar-parent">P</div>
            <div className="profile-info">
              <h3>Mrs. Jenkins</h3>
              <p>Parent / Guardian</p>
            </div>
          </div>
        </div>
        <nav className="nav-menu">
          <div className="nav-label">My Child</div>
          <button className="nav-item active">
            {currentChild.name}
          </button>
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
            <h1 className="page-title">{currentChild.name} — Overview</h1>
          </div>
          <div className="tabs">
            <button className={`tab-btn ${activeTab === 'progress' ? 'active' : ''}`} onClick={() => setActiveTab('progress')}>
              Academic Progress
            </button>
            <button className={`tab-btn ${activeTab === 'documents' ? 'active' : ''}`} onClick={() => setActiveTab('documents')}>
              Document Uploads
            </button>
            <button className={`tab-btn ${activeTab === 'hub' ? 'active' : ''}`} onClick={() => setActiveTab('hub')}>
              {getIcon('plant')} Holistic Hub
            </button>
          </div>
        </header>

        <div className="content-body">
          {/* Academic Progress */}
          {activeTab === 'progress' && (
            <div>
              <div className="parent-stats-row">
                <div className="parent-stat-card">
                  <div className="parent-stat-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22, stroke: 'var(--parent)' }}>
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                  </div>
                  <div>
                    <div className="parent-stat-value">{presentCount}</div>
                    <div className="parent-stat-label">Days Present (last 5)</div>
                  </div>
                </div>

                <div className="parent-stat-card">
                  <div className="parent-stat-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22, stroke: 'var(--primary)' }}>
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                  </div>
                  <div>
                    <div className="parent-stat-value">{absentCount}</div>
                    <div className="parent-stat-label">Absences Recorded</div>
                  </div>
                </div>

                <div className="parent-stat-card">
                  <div className="parent-stat-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22, stroke: 'var(--parent)' }}>
                      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                    </svg>
                  </div>
                  <div>
                    <div className="parent-stat-value">{syllabusPct}%</div>
                    <div className="parent-stat-label">Syllabus Coverage</div>
                  </div>
                </div>
              </div>

              {/* Attendance Log */}
              <div className="panel-block">
                <h3 className="section-title">Attendance Log — Last 5 Sessions</h3>
                {dates.length === 0 ? (
                  <div className="empty-state">No attendance records logged in database yet.</div>
                ) : (
                  dates.map((d) => {
                    const status = (attendance[d] || {})[currentChild.id] || 'not recorded';
                    const color =
                      status === 'present'
                        ? 'var(--doc-submitted)'
                        : status === 'auth_absent'
                        ? 'var(--doc-pending)'
                        : status === 'unauth_absent'
                        ? 'var(--primary)'
                        : 'var(--text-secondary)';

                    const label =
                      status === 'present'
                        ? 'Present'
                        : status === 'auth_absent'
                        ? 'Auth. Absent'
                        : status === 'unauth_absent'
                        ? 'Unauth. Absent'
                        : 'Not Recorded';

                    return (
                      <div className="item-card" key={d} style={{ marginBottom: 10 }}>
                        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14 }}>
                          📅 {d}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700, color }}>{label}</span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Syllabus Progress */}
              <div className="panel-block">
                <h3 className="section-title">Syllabus Progress</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {syllabus.length === 0 ? (
                    <div className="empty-state">No syllabus data available.</div>
                  ) : (
                    syllabus.map((term) => {
                      const tTopics = term.topics || [];
                      const termTotal = tTopics.length;
                      const termDone = tTopics.filter((t) => t.teacher_checked).length;
                      const pct = termTotal > 0 ? Math.round((termDone / termTotal) * 100) : 0;
                      return (
                        <div key={term.id}>
                          <div className="progress-header">
                            <p className="progress-label">
                              {term.name} ({termDone}/{termTotal} topics covered)
                            </p>
                            <span className="progress-value">{pct}%</span>
                          </div>
                          <div className="progress-track">
                            <div className="progress-fill fill-parent" style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Active Tests & Assignments */}
              <div className="panel-block">
                <h3 className="section-title">Active Tests &amp; Assignments</h3>
                <div className="card-list">
                  {tests.length === 0 && assignments.length === 0 ? (
                    <div className="empty-state">No active tests or assignments.</div>
                  ) : (
                    <>
                      {tests.map((t) => (
                        <div className="item-card" key={t.id}>
                          <div className="item-info">
                            <span className="badge badge-test">Active Test</span>
                            <h4>{t.title}</h4>
                          </div>
                          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>In Progress</span>
                        </div>
                      ))}
                      {assignments.map((a) => (
                        <div className="item-card" key={a.id}>
                          <div className="item-info">
                            <span className="badge badge-test" style={{ background: 'var(--secondary-light)', color: 'var(--secondary)' }}>
                              Assignment
                            </span>
                            <h4>{a.title}</h4>
                          </div>
                          <span style={{ fontSize: 13, color: 'var(--doc-pending)' }}>Due Soon</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Document Uploads */}
          {activeTab === 'documents' && (
            <div>
              <div style={{ marginBottom: 28 }}>
                <h3 className="section-title" style={{ marginBottom: 6 }}>
                  Required Documents
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Upload the required documents for your child's enrollment. Files are securely stored and reviewed by the school administration.
                </p>
              </div>

              <div className="doc-grid">
                {REQUIRED_DOC_TYPES.map((docDef) => {
                  const existing = parentDocuments.find(
                    (d) => d.student_id === currentChild.id && d.doc_type === docDef.type
                  );
                  const isSubmitted = existing && existing.status === 'submitted';
                  const fileName = existing?.file_name || '';

                  return (
                    <div
                      className={`doc-card ${isSubmitted ? 'status-submitted' : 'status-pending'}`}
                      key={docDef.type}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div className="doc-card-icon">{getIcon(docDef.iconKey)}</div>
                        <span className={`badge ${isSubmitted ? 'badge-submitted' : 'badge-pending'}`} style={{ margin: 0 }}>
                          {isSubmitted ? '✓ Submitted' : '⏳ Pending'}
                        </span>
                      </div>
                      <div>
                        <div className="doc-card-title">{docDef.type}</div>
                        <div className="doc-card-subtitle">{docDef.desc}</div>
                      </div>
                      {isSubmitted ? (
                        <div className="doc-filename" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {getIcon('attachment')} {fileName}
                        </div>
                      ) : (
                        <label className="doc-upload-area">
                          Click to upload file
                          <br />
                          <span style={{ fontSize: 11 }}>PDF, JPG, PNG accepted</span>
                          <input
                            type="file"
                            className="doc-file-input"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => handleFileInputChange(docDef.type, e)}
                          />
                        </label>
                      )}
                      {isSubmitted && (
                        <button className="action-btn" style={{ fontSize: 12 }} onClick={() => onRemoveDoc(docDef.type)}>
                          Replace File
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Holistic Hub */}
          {activeTab === 'hub' && (
            <div>
              <div style={{ marginBottom: 28 }}>
                <h3 className="section-title" style={{ marginBottom: 6 }}>
                  Your Child's Activity Participation
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  View all school programmes, events, and opportunities. Registration is managed by your child from their student portal.
                </p>
              </div>

              <div className="hub-grid">
                {hubActivities.length === 0 ? (
                  <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                    No school activities published yet.
                  </div>
                ) : (
                  hubActivities.map((act) => {
                    const isEnrolled = (act.enrolled_student_ids || []).includes(currentChild.id);
                    return (
                      <div className={`hub-card ${isEnrolled ? 'enrolled' : ''}`} key={act.id}>
                        <div className="hub-card-media">
                          <img src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=80" alt={act.title} />
                          {act.video_url && (
                            <div className="video-play-overlay" onClick={() => onOpenVideoModal(act)}>
                              <div className="play-btn-circle">{getIcon('video_play')}</div>
                            </div>
                          )}
                        </div>
                        <div className="hub-card-body">
                          <div className="hub-card-meta">
                            <span className="badge badge-hub" style={{ margin: 0 }}>{act.type}</span>
                            {isEnrolled && (
                              <span className="badge badge-hub-enrolled" style={{ margin: 0 }}>Child Enrolled</span>
                            )}
                          </div>
                          <div className="hub-card-title">{act.title}</div>
                          <div className="hub-card-desc">{act.description}</div>
                          <div className="hub-card-meta">
                            <span className="hub-card-date">{getIcon('date')} {act.date}</span>
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                              Grades: {(act.target_grades || []).join(', ')}
                            </span>
                          </div>
                        </div>
                        <div className="hub-card-footer">
                          <span className="hub-card-enroll-count">
                            {(act.enrolled_student_ids || []).length} students enrolled
                          </span>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: isEnrolled ? 'var(--doc-submitted)' : 'var(--text-secondary)',
                            }}
                          >
                            {isEnrolled ? '✓ Your child is registered' : 'Not registered'}
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
