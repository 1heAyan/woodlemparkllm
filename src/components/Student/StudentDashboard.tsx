'use client';

import React, { useState } from 'react';
import {
  Student,
  TestItem,
  AssignmentItem,
  SyllabusTerm,
  Achievement,
  HubActivity,
} from '@/lib/supabaseClient';
import { getIcon } from '../Icons';

interface StudentDashboardProps {
  currentStudent: Student;
  tests: TestItem[];
  assignments: AssignmentItem[];
  syllabus: SyllabusTerm[];
  achievements: Achievement[];
  hubActivities: HubActivity[];
  onToggleTopicCheck: (termId: string, topicId: string, role: 'teacher' | 'student', isChecked: boolean) => void;
  onAddAchievementClick: () => void;
  onToggleHubEnrollment: (activityId: string) => void;
  onOpenVideoModal: (activity: HubActivity) => void;
  onSignOut: () => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  currentStudent,
  tests,
  assignments,
  syllabus,
  achievements,
  hubActivities,
  onToggleTopicCheck,
  onAddAchievementClick,
  onToggleHubEnrollment,
  onOpenVideoModal,
  onSignOut,
}) => {
  const [activeTab, setActiveTab] = useState<'tests' | 'syllabus' | 'awards' | 'hub'>('tests');
  const [activeSubject, setActiveSubject] = useState('Physics');
  const [hubFilter, setHubFilter] = useState('');

  // Calculate Syllabus progress
  let totalTopics = 0;
  let teacherDone = 0;
  let studentDone = 0;
  syllabus.forEach((term) => {
    (term.topics || []).forEach((topic) => {
      totalTopics++;
      if (topic.teacher_checked) teacherDone++;
      if (topic.student_checked) studentDone++;
    });
  });
  const teacherPct = totalTopics > 0 ? Math.round((teacherDone / totalTopics) * 100) : 0;
  const studentPct = totalTopics > 0 ? Math.round((studentDone / totalTopics) * 100) : 0;

  // Filter hub activities
  const filteredHub = hubFilter
    ? hubActivities.filter((a) => a.type === hubFilter)
    : hubActivities;

  const myAchievements = achievements.filter((a) => a.student_id === currentStudent.id);

  return (
    <div className="app-viewport">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <img src="/image_35dba9.jpeg" alt="Woodlem Park" className="sidebar-logo" />
          </div>
          <div className="profile-card">
            <div className="profile-avatar avatar-student">S</div>
            <div className="profile-info">
              <h3>{currentStudent.name}</h3>
              <p>{currentStudent.grade || 'Grade 12 (CBSE)'}</p>
            </div>
          </div>
        </div>
        <nav className="nav-menu">
          <div className="nav-label">My Subjects</div>
          {['Physics', 'Chemistry', 'Biology'].map((subj) => (
            <button
              key={subj}
              className={`nav-item ${activeSubject === subj && activeTab !== 'hub' ? 'active' : ''}`}
              onClick={() => {
                setActiveSubject(subj);
                if (activeTab === 'hub') setActiveTab('tests');
              }}
            >
              {subj}
            </button>
          ))}
          <div className="nav-label">School</div>
          <button
            className={`nav-item ${activeTab === 'hub' ? 'active' : ''}`}
            onClick={() => {
              setActiveSubject('Holistic Development Hub');
              setActiveTab('hub');
            }}
          >
            {getIcon('plant')} Holistic Hub
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
            <h1 className="page-title">{activeSubject}</h1>
          </div>
          <div className="tabs">
            <button
              className={`tab-btn ${activeTab === 'tests' ? 'active' : ''}`}
              onClick={() => setActiveTab('tests')}
            >
              Tests &amp; Assignments
            </button>
            <button
              className={`tab-btn ${activeTab === 'syllabus' ? 'active' : ''}`}
              onClick={() => setActiveTab('syllabus')}
            >
              Syllabus Tracker
            </button>
            <button
              className={`tab-btn ${activeTab === 'awards' ? 'active' : ''}`}
              onClick={() => setActiveTab('awards')}
            >
              Achievements
            </button>
            <button
              className={`tab-btn ${activeTab === 'hub' ? 'active' : ''}`}
              onClick={() => setActiveTab('hub')}
            >
              {getIcon('plant')} Holistic Hub
            </button>
          </div>
        </header>

        <div className="content-body">
          {/* Tests & Assignments */}
          {activeTab === 'tests' && (
            <div>
              <h3 className="section-title">Active Assessments</h3>
              <div className="card-list" style={{ marginBottom: 32 }}>
                {tests.length === 0 ? (
                  <div className="empty-state">No active tests scheduled.</div>
                ) : (
                  tests.map((test) => (
                    <div className="item-card" key={test.id}>
                      <div className="item-info">
                        <span className="badge badge-test">Active Test</span>
                        <h4>{test.title}</h4>
                      </div>
                      <button className="btn-primary">Start</button>
                    </div>
                  ))
                )}
              </div>

              <h3 className="section-title">Pending Tasks</h3>
              <div className="card-list">
                {assignments.length === 0 ? (
                  <div className="empty-state">No pending assignments.</div>
                ) : (
                  assignments.map((ass) => (
                    <div className="item-card" key={ass.id}>
                      <div className="item-info">
                        <span className="badge badge-test" style={{ background: 'var(--secondary-light)', color: 'var(--secondary)' }}>
                          Assignment
                        </span>
                        <h4>{ass.title}</h4>
                      </div>
                      <button className="btn-secondary btn-primary">Submit File</button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Syllabus Tracker */}
          {activeTab === 'syllabus' && (
            <div>
              <div className="panel-block" style={{ display: 'flex', gap: 48, marginBottom: 32 }}>
                <div style={{ flex: 1 }}>
                  <div className="progress-header">
                    <p className="progress-label">Class Progress</p>
                    <span className="progress-value">{teacherPct}%</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill fill-teacher" style={{ width: `${teacherPct}%` }}></div>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="progress-header">
                    <p className="progress-label">Personal Study</p>
                    <span className="progress-value">{studentPct}%</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill fill-student" style={{ width: `${studentPct}%` }}></div>
                  </div>
                </div>
              </div>

              {syllabus.length === 0 ? (
                <div className="empty-state">Syllabus topics pending teacher creation.</div>
              ) : (
                syllabus.map((term) => (
                  <div className="panel-block" key={term.id}>
                    <h3 className="section-title">{term.name}</h3>
                    <div className="card-list">
                      {!term.topics || term.topics.length === 0 ? (
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No topics assigned.</p>
                      ) : (
                        term.topics.map((topic) => (
                          <div className="item-card" key={topic.id}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                              <input
                                type="checkbox"
                                className="syllabus-checkbox"
                                checked={topic.student_checked}
                                onChange={(e) => onToggleTopicCheck(term.id, topic.id, 'student', e.target.checked)}
                              />
                              <div className="item-info">
                                <h4>{topic.title}</h4>
                              </div>
                            </div>
                            {topic.teacher_checked ? (
                              <span className="badge badge-system" style={{ margin: 0 }}>Taught</span>
                            ) : (
                              <span className="badge badge-system" style={{ margin: 0, background: 'transparent', border: '1px solid var(--border-color)' }}>
                                Pending
                              </span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Achievements */}
          {activeTab === 'awards' && (
            <div>
              <div className="panel-header-action">
                <h3 className="section-title">My Awards &amp; Certifications</h3>
                <button className="btn-primary" onClick={onAddAchievementClick}>
                  + Add Achievement
                </button>
              </div>
              <div className="grid-layout">
                {myAchievements.length === 0 ? (
                  <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                    No achievements added yet. Click "+ Add Achievement" to showcase your accomplishments!
                  </div>
                ) : (
                  myAchievements.map((aw) => (
                    <div className="grid-card" key={aw.id}>
                      <span className="badge badge-award" style={{ width: 'fit-content' }}>
                        Certificate Attached
                      </span>
                      <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 16, margin: '8px 0' }}>
                        {aw.title}
                      </h4>
                      <p style={{ fontFamily: 'var(--font-label)', color: 'var(--text-secondary)', fontSize: 13 }}>
                        {aw.description}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Holistic Hub */}
          {activeTab === 'hub' && (
            <div>
              <div className="panel-header-action">
                <div>
                  <h3 className="section-title" style={{ marginBottom: 4 }}>Holistic Development Hub</h3>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 0 }}>
                    Browse school programmes, events, and opportunities. Click Register to participate.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select
                    className="form-input"
                    style={{ width: 200, padding: '10px 14px' }}
                    value={hubFilter}
                    onChange={(e) => setHubFilter(e.target.value)}
                  >
                    <option value="">All Types</option>
                    <option value="Counselling Appointment">Counselling</option>
                    <option value="Club Registration">Clubs</option>
                    <option value="Summer Programme">Summer</option>
                    <option value="Workshop">Workshop</option>
                    <option value="Event">Event</option>
                    <option value="Volunteer Opportunity">Volunteer</option>
                    <option value="Leadership Programme">Leadership</option>
                  </select>
                </div>
              </div>

              <div className="hub-grid">
                {filteredHub.length === 0 ? (
                  <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                    No activities published right now. Check back soon!
                  </div>
                ) : (
                  filteredHub.map((act) => {
                    const isEnrolled = (act.enrolled_student_ids || []).includes(currentStudent.id);
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
                              <span className="badge badge-hub-enrolled" style={{ margin: 0 }}>Enrolled</span>
                            )}
                          </div>
                          <div className="hub-card-title">{act.title}</div>
                          <div className="hub-card-desc">{act.description}</div>
                          <div className="hub-card-meta">
                            <span className="hub-card-date">{getIcon('date')} {act.date}</span>
                            {act.attached_file_name && (
                              <span className="badge badge-system" style={{ margin: 0, fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                {getIcon('attachment')} {act.attached_file_name}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="hub-card-footer">
                          <span className="hub-card-enroll-count">
                            {(act.enrolled_student_ids || []).length} enrolled
                          </span>
                          <button
                            className={isEnrolled ? 'btn-enrolled btn-primary' : 'btn-hub btn-primary'}
                            onClick={() => onToggleHubEnrollment(act.id)}
                          >
                            {isEnrolled ? '✓ Enrolled' : 'Register / Apply'}
                          </button>
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
