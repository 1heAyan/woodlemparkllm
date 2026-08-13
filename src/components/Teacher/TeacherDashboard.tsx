'use client';

import React, { useState } from 'react';
import {
  Student,
  TestItem,
  AssignmentItem,
  SyllabusTerm,
  Achievement,
  AttendanceRecord,
  HubActivity,
} from '@/lib/supabaseClient';
import { getIcon, HUB_TYPE_ICONS } from '../Icons';

interface TeacherDashboardProps {
  students: Student[];
  tests: TestItem[];
  assignments: AssignmentItem[];
  syllabus: SyllabusTerm[];
  achievements: Achievement[];
  attendance: Record<string, Record<string, string>>; // date -> studentId -> status
  hubActivities: HubActivity[];
  onOpenCreateTestModal: () => void;
  onOpenCreateAssignmentModal: () => void;
  onOpenAddTermModal: () => void;
  onOpenAddTopicModal: (termId?: string) => void;
  onToggleTopicCheck: (termId: string, topicId: string, role: 'teacher' | 'student', isChecked: boolean) => void;
  onSaveAttendance: (date: string, records: Record<string, string>) => void;
  onOpenCreateHubActivityModal: () => void;
  onDeleteHubActivity: (id: string) => void;
  onSignOut: () => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  students,
  tests,
  assignments,
  syllabus,
  achievements,
  attendance,
  hubActivities,
  onOpenCreateTestModal,
  onOpenCreateAssignmentModal,
  onOpenAddTermModal,
  onOpenAddTopicModal,
  onToggleTopicCheck,
  onSaveAttendance,
  onOpenCreateHubActivityModal,
  onDeleteHubActivity,
  onSignOut,
}) => {
  const [activeTab, setActiveTab] = useState<'manage' | 'syllabus' | 'attendance' | 'awards' | 'hub'>('manage');
  const [activeClass, setActiveClass] = useState('Grade 12 - Physics (A)');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [dailyRecords, setDailyRecords] = useState<Record<string, string>>({});
  const [awardSearch, setAwardSearch] = useState('');
  const [copiedNotification, setCopiedNotification] = useState(false);

  // Sync attendance state when date changes or attendance prop updates
  React.useEffect(() => {
    if (attendance[selectedDate]) {
      setDailyRecords(attendance[selectedDate]);
    } else {
      setDailyRecords({});
    }
  }, [selectedDate, attendance]);

  const handleAttendanceRadio = (studentId: string, value: string) => {
    setDailyRecords((prev) => ({ ...prev, [studentId]: value }));
  };

  const handleSaveAttendanceClick = () => {
    onSaveAttendance(selectedDate, dailyRecords);
    alert('Attendance successfully logged & updated in Supabase!');
  };

  // Generate automated report
  let presentCount = 0;
  let authCount = 0;
  let unauthCount = 0;
  const authNames: string[] = [];
  const unauthNames: string[] = [];

  students.forEach((s) => {
    const status = dailyRecords[s.id];
    if (status === 'present') presentCount++;
    else if (status === 'auth_absent') {
      authCount++;
      authNames.push(s.name);
    } else if (status === 'unauth_absent') {
      unauthCount++;
      unauthNames.push(s.name);
    }
  });

  let reportText = `📊 Daily Attendance Report\n📅 Date: ${selectedDate}\n🏫 Class: ${activeClass}\n\n`;
  reportText += `✅ Present: ${presentCount}\n⚠️ Auth Absent: ${authCount}\n❌ Unauth Absent: ${unauthCount}\n`;
  if (authNames.length > 0) {
    reportText += `\nAuthorized Absences:\n` + authNames.map((n) => `- ${n}`).join('\n') + '\n';
  }
  if (unauthNames.length > 0) {
    reportText += `\nUnauthorized Absences (ACTION REQ):\n` + unauthNames.map((n) => `- ${n}`).join('\n') + '\n';
  }

  const copyReport = () => {
    navigator.clipboard.writeText(reportText);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 3000);
  };

  // Syllabus progress
  let totalTopics = 0;
  let teacherDone = 0;
  syllabus.forEach((term) => {
    (term.topics || []).forEach((topic) => {
      totalTopics++;
      if (topic.teacher_checked) teacherDone++;
    });
  });
  const overallPct = totalTopics > 0 ? Math.round((teacherDone / totalTopics) * 100) : 0;

  // Filter achievements
  const filteredAwards = achievements.filter((aw) => {
    const student = students.find((s) => s.id === aw.student_id);
    const sName = student ? student.name.toLowerCase() : '';
    const term = awardSearch.toLowerCase();
    return aw.title.toLowerCase().includes(term) || sName.includes(term);
  });

  // Attendance Trend data calculation
  const dates = Object.keys(attendance).sort().slice(-5);

  return (
    <div className="app-viewport">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <img src="/image_35dba9.jpeg" alt="Woodlem Park" className="sidebar-logo" />
          </div>
          <div className="profile-card">
            <div className="profile-avatar avatar-teacher">T</div>
            <div className="profile-info">
              <h3>Prof. Davis</h3>
              <p>Science Dept.</p>
            </div>
          </div>
        </div>
        <nav className="nav-menu">
          <div className="nav-label">My Classes</div>
          {['Grade 12 - Physics (A)', 'Grade 12 - Physics (B)'].map((cls) => (
            <button
              key={cls}
              className={`nav-item ${activeClass === cls ? 'active' : ''}`}
              onClick={() => setActiveClass(cls)}
            >
              {cls}
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
            <h1 className="page-title">{activeClass}</h1>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn-secondary btn-primary" onClick={onOpenCreateAssignmentModal}>
                Add Assignment
              </button>
              <button className="btn-primary" onClick={onOpenCreateTestModal}>
                Create Test
              </button>
            </div>
          </div>
          <div className="tabs">
            <button className={`tab-btn ${activeTab === 'manage' ? 'active' : ''}`} onClick={() => setActiveTab('manage')}>
              Class Overview
            </button>
            <button className={`tab-btn ${activeTab === 'syllabus' ? 'active' : ''}`} onClick={() => setActiveTab('syllabus')}>
              Syllabus Manager
            </button>
            <button className={`tab-btn ${activeTab === 'attendance' ? 'active' : ''}`} onClick={() => setActiveTab('attendance')}>
              Attendance &amp; Analytics
            </button>
            <button className={`tab-btn ${activeTab === 'awards' ? 'active' : ''}`} onClick={() => setActiveTab('awards')}>
              Awards Database
            </button>
            <button className={`tab-btn ${activeTab === 'hub' ? 'active' : ''}`} onClick={() => setActiveTab('hub')}>
              {getIcon('plant')} Holistic Hub
            </button>
          </div>
        </header>

        <div className="content-body">
          {/* Overview */}
          {activeTab === 'manage' && (
            <div>
              <h3 className="section-title">Active Assessments &amp; Tasks</h3>
              <div className="card-list">
                {tests.length === 0 && assignments.length === 0 ? (
                  <div className="empty-state">No assessments created. Click "Create Test" or "Add Assignment" above!</div>
                ) : (
                  <>
                    {tests.map((test) => (
                      <div className="item-card" key={test.id}>
                        <div className="item-info">
                          <span className="badge badge-test">Active Test</span>
                          <h4>{test.title}</h4>
                        </div>
                        <button className="btn-secondary btn-primary">Review Scores</button>
                      </div>
                    ))}
                    {assignments.map((ass) => (
                      <div className="item-card" key={ass.id}>
                        <div className="item-info">
                          <span className="badge badge-test" style={{ background: 'var(--secondary-light)', color: 'var(--secondary)' }}>
                            Assignment
                          </span>
                          <h4>{ass.title}</h4>
                        </div>
                        <button className="btn-secondary btn-primary">Grade</button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Syllabus Manager */}
          {activeTab === 'syllabus' && (
            <div>
              <div className="panel-block" style={{ display: 'flex', gap: 48, marginBottom: 32 }}>
                <div style={{ flex: 1 }}>
                  <div className="progress-header">
                    <p className="progress-label">Overall Syllabus Taught</p>
                    <span className="progress-value">{overallPct}%</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill fill-teacher" style={{ width: `${overallPct}%` }}></div>
                  </div>
                </div>
              </div>

              {syllabus.length === 0 ? (
                <div className="empty-state" style={{ marginBottom: 24 }}>
                  No syllabus terms created.
                </div>
              ) : (
                syllabus.map((term) => (
                  <div className="panel-block" key={term.id}>
                    <div className="panel-header-action">
                      <h3 className="section-title" style={{ margin: 0 }}>
                        {term.name}
                      </h3>
                      <button className="action-btn" onClick={() => onOpenAddTopicModal(term.id)}>
                        + Add Topic
                      </button>
                    </div>
                    <div className="card-list">
                      {!term.topics || term.topics.length === 0 ? (
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No topics added in this term block.</p>
                      ) : (
                        term.topics.map((topic) => (
                          <div className="item-card" key={topic.id}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                              <input
                                type="checkbox"
                                className="syllabus-checkbox"
                                checked={topic.teacher_checked}
                                onChange={(e) => onToggleTopicCheck(term.id, topic.id, 'teacher', e.target.checked)}
                              />
                              <div className="item-info">
                                <h4>{topic.title}</h4>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))
              )}

              <button className="btn-add-minimal" onClick={onOpenAddTermModal}>
                + Create New Term Block
              </button>
            </div>
          )}

          {/* Attendance & Analytics */}
          {activeTab === 'attendance' && (
            <div>
              <div className="analytics-grid">
                <div className="stat-box">
                  <h3 className="section-title">Class Attendance Trend</h3>
                  <p className="stat-sub">Last recorded sessions in Supabase</p>
                  <div className="chart-container">
                    {dates.length === 0 ? (
                      <div style={{ width: '100%', textAlign: 'center', fontSize: 12, color: 'var(--text-secondary)' }}>
                        No historical attendance recorded.
                      </div>
                    ) : (
                      dates.map((d) => {
                        const rec = attendance[d] || {};
                        let p = 0;
                        let tot = 0;
                        students.forEach((s) => {
                          if (rec[s.id]) tot++;
                          if (rec[s.id] === 'present') p++;
                        });
                        const pct = tot > 0 ? (p / tot) * 100 : 100;
                        return (
                          <div className="chart-bar-group" key={d}>
                            <div className="bar-wrap">
                              <div className={`bar-fill ${pct < 75 ? 'bad' : ''}`} style={{ height: `${pct}%` }}></div>
                            </div>
                            <span className="bar-label">{d.split('-').slice(1).join('/')}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="stat-box">
                  <h3 className="section-title">AI Insights</h3>
                  <p className="stat-sub">Based on live register logs</p>
                  <div className="insight-list">
                    <div className="insight-item">
                      <span className="insight-icon good">●</span>
                      <span>
                        <b>Attendance Sync:</b> All student logs automatically sync live to Supabase.
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="panel-block">
                <div className="panel-header-action">
                  <div>
                    <h3 className="section-title" style={{ margin: 0 }}>
                      Daily Register Log
                    </h3>
                    <p className="stat-sub">Select any date to view or edit historical records.</p>
                  </div>
                  <input
                    type="date"
                    className="form-input"
                    style={{ width: 200, fontWeight: 600 }}
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                  />
                </div>

                <div className="card-list" style={{ marginBottom: 32 }}>
                  {students.map((student) => {
                    const status = dailyRecords[student.id] || '';
                    return (
                      <div
                        className="item-card"
                        key={student.id}
                        style={{ padding: '16px 24px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>
                          {student.name}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <label>
                            <input
                              type="radio"
                              name={`att_${student.id}`}
                              value="present"
                              className="att-radio"
                              checked={status === 'present'}
                              onChange={() => handleAttendanceRadio(student.id, 'present')}
                            />
                            <div className="att-label">Present</div>
                          </label>
                          <label>
                            <input
                              type="radio"
                              name={`att_${student.id}`}
                              value="auth_absent"
                              className="att-radio"
                              checked={status === 'auth_absent'}
                              onChange={() => handleAttendanceRadio(student.id, 'auth_absent')}
                            />
                            <div className="att-label">Auth. Absent</div>
                          </label>
                          <label>
                            <input
                              type="radio"
                              name={`att_${student.id}`}
                              value="unauth_absent"
                              className="att-radio"
                              checked={status === 'unauth_absent'}
                              onChange={() => handleAttendanceRadio(student.id, 'unauth_absent')}
                            />
                            <div className="att-label">Unauth. Absent</div>
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button className="btn-primary" style={{ width: '100%', padding: 16 }} onClick={handleSaveAttendanceClick}>
                  Log &amp; Update Register
                </button>
              </div>

              <div className="panel-block" style={{ background: 'var(--surface-variant)' }}>
                <div className="panel-header-action">
                  <h4 className="section-title" style={{ margin: 0 }}>
                    Automated Daily Report
                  </h4>
                  <button className="btn-secondary btn-primary" onClick={copyReport}>
                    {copiedNotification ? '✓ Copied!' : 'Copy Text'}
                  </button>
                </div>
                <div className="report-box">{reportText}</div>
              </div>
            </div>
          )}

          {/* Awards Database */}
          {activeTab === 'awards' && (
            <div>
              <div className="panel-block">
                <div className="panel-header-action">
                  <div>
                    <h3 className="section-title" style={{ margin: 0 }}>
                      Awards &amp; Certifications
                    </h3>
                    <p className="stat-sub">Search across all student achievements.</p>
                  </div>
                  <input
                    type="text"
                    className="form-input"
                    style={{ width: 300 }}
                    placeholder="Search student or award..."
                    value={awardSearch}
                    onChange={(e) => setAwardSearch(e.target.value)}
                  />
                </div>
                <div className="grid-layout">
                  {filteredAwards.length === 0 ? (
                    <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                      No achievements found in database.
                    </div>
                  ) : (
                    filteredAwards.map((aw) => {
                      const student = students.find((s) => s.id === aw.student_id);
                      return (
                        <div className="grid-card" key={aw.id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <span className="badge badge-award" style={{ width: 'fit-content' }}>
                              Verified
                            </span>
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: 'var(--neutral-dark)',
                                background: 'var(--surface-variant)',
                                padding: '4px 8px',
                                borderRadius: 4,
                              }}
                            >
                              {student ? student.name : 'Student'}
                            </span>
                          </div>
                          <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 16, margin: '12px 0 8px 0' }}>
                            {aw.title}
                          </h4>
                          <p style={{ fontFamily: 'var(--font-label)', color: 'var(--text-secondary)', fontSize: 13 }}>
                            {aw.description}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Holistic Hub */}
          {activeTab === 'hub' && (
            <div>
              <div className="panel-header-action">
                <div>
                  <h3 className="section-title" style={{ marginBottom: 4 }}>
                    Holistic Development Hub
                  </h3>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    Create and manage school programmes, events, and opportunities.
                  </p>
                </div>
                <button className="btn-hub btn-primary" onClick={onOpenCreateHubActivityModal}>
                  + Create Activity
                </button>
              </div>

              <div className="card-list" style={{ gap: 16 }}>
                {hubActivities.length === 0 ? (
                  <div className="empty-state">No activities created yet. Click "+ Create Activity" to get started!</div>
                ) : (
                  hubActivities.map((act) => {
                    const iconKey = HUB_TYPE_ICONS[act.type] || 'event';
                    const enrolledNames = (act.enrolled_student_ids || [])
                      .map((id) => students.find((s) => s.id === id)?.name)
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
                          {enrolledNames.length > 0 ? (
                            <div className="roster-list">
                              {enrolledNames.map((n, i) => (
                                <span className="roster-chip" key={i}>
                                  {n}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>No registrations yet.</p>
                          )}
                        </div>
                        <div className="hub-list-item-stats">
                          <span className="hub-stat-chip">{(act.enrolled_student_ids || []).length} enrolled</span>
                          <button className="action-btn" style={{ fontSize: 12 }} onClick={() => onDeleteHubActivity(act.id)}>
                            Remove
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
