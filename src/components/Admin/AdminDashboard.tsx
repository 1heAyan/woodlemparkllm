'use client';

import React, { useState, useMemo } from 'react';
import { UserProfile, ParentDocument, HubActivity } from '@/lib/supabaseClient';
import { CustomSelect } from '@/components/UI/CustomSelect';

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
  onRefreshData?: () => void;
}

type AdminTab = 'overview' | 'directory' | 'classes' | 'documents' | 'hub' | 'system';

const ALL_CLASSES = ['10-A', '10-B', '10-C', '10-D', '12-A', '12-B', '12-C', '12-D'] as const;

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
  onRefreshData,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [roleFilter, setRoleFilter] = useState<'all' | 'student' | 'teacher' | 'parent' | 'admin'>('all');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [docStudentFilter, setDocStudentFilter] = useState('');
  const [selectedClassInspect, setSelectedClassInspect] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Grouped profiles
  const students = useMemo(() => profiles.filter((p) => p.role === 'student'), [profiles]);
  const teachers = useMemo(() => profiles.filter((p) => p.role === 'teacher'), [profiles]);
  const parents = useMemo(() => profiles.filter((p) => p.role === 'parent'), [profiles]);
  const admins = useMemo(() => profiles.filter((p) => p.role === 'admin'), [profiles]);

  // Filtered profiles for User Directory
  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      // Role filter
      if (roleFilter !== 'all' && p.role !== roleFilter) return false;

      // Class / Section filter
      if (classFilter !== 'all') {
        if (p.role === 'student') {
          const cleanG = (p.grade || '').replace(/[^0-9]/g, '');
          const cleanS = (p.class_letter || '').toUpperCase().trim();
          const studentClass = `${cleanG}-${cleanS}`;
          if (studentClass !== classFilter) return false;
        } else if (p.role === 'teacher') {
          if (p.assigned_class !== classFilter) return false;
        } else {
          return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (p.name || '').toLowerCase().includes(q);
        const matchesEmail = (p.email || '').toLowerCase().includes(q);
        const matchesCode = (p.user_code || '').toLowerCase().includes(q);
        const matchesAdm = (p.admission_number || '').toLowerCase().includes(q);
        const matchesSubject = (p.subject || '').toLowerCase().includes(q);
        return matchesName || matchesEmail || matchesCode || matchesAdm || matchesSubject;
      }
      return true;
    });
  }, [profiles, roleFilter, classFilter, searchQuery]);

  // Filtered parent documents
  const filteredDocs = useMemo(() => {
    if (!docStudentFilter) return parentDocuments;
    return parentDocuments.filter((d) => d.student_id === docStudentFilter);
  }, [parentDocuments, docStudentFilter]);

  // Format student / teacher class & subject badge
  const formatUserAssignment = (p: UserProfile) => {
    if (p.role === 'student') {
      const cleanG = (p.grade || '').replace(/[^0-9]/g, '') || p.grade;
      const cleanS = (p.class_letter || '').toUpperCase() || '';
      if (!cleanG && !cleanS) return 'Unassigned';
      return `Grade ${cleanG}${cleanS ? `-${cleanS}` : ''}`;
    }
    if (p.role === 'teacher') {
      const parts: string[] = [];
      if (p.subject) parts.push(p.subject);
      if (p.assigned_class) parts.push(`Class Teacher (${p.assigned_class})`);
      return parts.length > 0 ? parts.join(' | ') : 'Faculty';
    }
    if (p.role === 'parent') return 'Parent / Guardian';
    if (p.role === 'admin') return 'System Administrator';
    return 'General';
  };

  const handleRefresh = async () => {
    if (onRefreshData) {
      setIsRefreshing(true);
      await onRefreshData();
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  // CSV export helper
  const exportUsersCSV = () => {
    const headers = ['Name', 'Email', 'Role', 'Admission/Code', 'Grade', 'Section', 'Subject', 'Assigned Class'];
    const rows = filteredProfiles.map((p) => [
      `"${p.name || ''}"`,
      `"${p.email || ''}"`,
      `"${p.role || ''}"`,
      `"${p.admission_number || p.user_code || ''}"`,
      `"${p.grade || ''}"`,
      `"${p.class_letter || ''}"`,
      `"${p.subject || ''}"`,
      `"${p.assigned_class || ''}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `woodlem_directory_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Modern compact styles
  const thStyle: React.CSSProperties = {
    textAlign: 'left',
    padding: '7px 10px',
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#65635E',
    background: '#F5F4F0',
    borderBottom: '1px solid var(--border-color)',
    whiteSpace: 'nowrap',
  };

  const tdStyle: React.CSSProperties = {
    padding: '7px 10px',
    fontSize: 12,
    borderBottom: '1px solid #ECEAE5',
    color: 'var(--neutral-dark)',
  };

  const rolePill = (role: string) => {
    const styleMap: Record<string, { bg: string; text: string; border: string }> = {
      student: { bg: '#EBF3F2', text: '#2C6E6A', border: '#CBE2DF' },
      teacher: { bg: '#F9F1E6', text: '#9B6634', border: '#EBD4B8' },
      parent: { bg: '#EAF3EF', text: '#2D6E5D', border: '#C7E4D8' },
      admin: { bg: '#EFECE6', text: '#2D2C2A', border: '#DCD8CE' },
    };
    const s = styleMap[role] || { bg: '#F0EFEA', text: '#55534E', border: '#DDD' };
    return (
      <span
        style={{
          display: 'inline-block',
          padding: '1px 6px',
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          borderRadius: 4,
          background: s.bg,
          color: s.text,
          border: `1px solid ${s.border}`,
          whiteSpace: 'nowrap',
        }}
      >
        {role}
      </span>
    );
  };

  // ─── TAB 1: OVERVIEW ────────────────────────────────────────────────────────
  const renderOverview = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Top compact executive banner */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-color)',
          borderRadius: 8,
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--neutral-dark)', fontFamily: 'var(--font-display)' }}>
              Executive Control Console
            </span>
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 4,
                background: '#EAF3EF',
                color: '#2D6E5D',
                border: '1px solid #C7E4D8',
                letterSpacing: '0.05em',
              }}
            >
              ACTIVE INSTANCE
            </span>
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
            Logged in as {currentUser.name || 'System Admin'} ({currentUser.email}) | Total {profiles.length} Accounts in System
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {onRefreshData && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              style={{
                padding: '6px 12px',
                fontSize: 11.5,
                fontWeight: 600,
                color: 'var(--neutral-dark)',
                background: '#FFFFFF',
                border: '1px solid var(--border-color)',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              {isRefreshing ? 'Syncing...' : 'Sync Data'}
            </button>
          )}
          <button
            onClick={onOpenProvisionModal}
            style={{
              padding: '6px 12px',
              fontSize: 11.5,
              fontWeight: 600,
              color: '#FFFFFF',
              background: '#2D2C2A',
              border: '1px solid #2D2C2A',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            + Provision User
          </button>
          <button
            onClick={onOpenBulkModal}
            style={{
              padding: '6px 12px',
              fontSize: 11.5,
              fontWeight: 600,
              color: 'var(--neutral-dark)',
              background: '#FFFFFF',
              border: '1px solid var(--border-color)',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Bulk Import
          </button>
          <button
            onClick={exportUsersCSV}
            style={{
              padding: '6px 12px',
              fontSize: 11.5,
              fontWeight: 600,
              color: 'var(--neutral-dark)',
              background: '#FFFFFF',
              border: '1px solid var(--border-color)',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Export Directory
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
        {[
          { label: 'TOTAL ACCOUNTS', val: profiles.length, sub: 'Registered users', tab: 'directory' as const, role: 'all' as const },
          { label: 'STUDENTS', val: students.length, sub: 'Enrolled students', tab: 'directory' as const, role: 'student' as const },
          { label: 'FACULTY', val: teachers.length, sub: 'Teaching staff', tab: 'directory' as const, role: 'teacher' as const },
          { label: 'PARENTS', val: parents.length, sub: 'Linked guardians', tab: 'directory' as const, role: 'parent' as const },
          { label: 'VERIFICATIONS', val: parentDocuments.length, sub: 'Document filings', tab: 'documents' as const, role: 'all' as const },
        ].map((k) => (
          <div
            key={k.label}
            onClick={() => {
              setActiveTab(k.tab);
              if (k.role !== 'all') setRoleFilter(k.role);
            }}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              padding: '10px 14px',
              cursor: 'pointer',
              transition: 'border-color 0.12s, background 0.12s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#8C8983')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
          >
            <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em' }}>
              {k.label}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--neutral-dark)', fontFamily: 'var(--font-display)', margin: '3px 0 1px' }}>
              {k.val}
            </div>
            <div style={{ fontSize: 10.5, color: '#888580' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Two column layout: Class Matrix & Recent Directory Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
        {/* Class Section Capacity Matrix */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '9px 14px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--neutral-dark)' }}>
              Section Roster Matrix
            </span>
            <button
              onClick={() => setActiveTab('classes')}
              style={{ background: 'none', border: 'none', color: '#2C6E6A', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
            >
              Inspect Matrix
            </button>
          </div>

          <div style={{ padding: '10px 12px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {ALL_CLASSES.map((cls) => {
              const [g, s] = cls.split('-');
              const count = students.filter((st) => {
                const cleanG = (st.grade || '').replace(/[^0-9]/g, '');
                const cleanS = (st.class_letter || '').toUpperCase().trim();
                return cleanG === g && cleanS === s;
              }).length;
              const ct = teachers.find((t) => t.assigned_class === cls);
              return (
                <div
                  key={cls}
                  onClick={() => {
                    setClassFilter(cls);
                    setRoleFilter('student');
                    setActiveTab('directory');
                  }}
                  style={{
                    border: '1px solid var(--border-color)',
                    borderRadius: 6,
                    padding: '8px 10px',
                    background: '#FAF9F6',
                    cursor: 'pointer',
                    transition: 'all 0.12s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#2C6E6A';
                    e.currentTarget.style.background = '#F2F7F6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                    e.currentTarget.style.background = '#FAF9F6';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--neutral-dark)' }}>G{g}-{s}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#2C6E6A' }}>{count}</span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    CT: {ct ? ct.name.split(' ')[0] : 'None'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Navigation / Quick Ops Panel */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '9px 14px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--neutral-dark)' }}>
              Operational Quick Links
            </span>
          </div>
          <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { title: 'User Directory Management', desc: `${profiles.length} total profiles registered`, tab: 'directory' as const },
              { title: 'Section Roster & Class Teachers', desc: `${ALL_CLASSES.length} active cohorts`, tab: 'classes' as const },
              { title: 'Parent Clearance & Documents', desc: `${parentDocuments.length} files submitted`, tab: 'documents' as const },
              { title: 'Holistic Development Hub', desc: `${hubActivities.length} published programs`, tab: 'hub' as const },
              { title: 'System Environment & Database', desc: 'Supabase PostgreSQL Cloud', tab: 'system' as const },
            ].map((item) => (
              <div
                key={item.title}
                onClick={() => setActiveTab(item.tab)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '7px 10px',
                  border: '1px solid var(--border-color)',
                  borderRadius: 6,
                  background: '#FFFFFF',
                  cursor: 'pointer',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#F6F5F2')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#FFFFFF')}
              >
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--neutral-dark)' }}>{item.title}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-secondary)' }}>{item.desc}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#2C6E6A' }}>Open</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent User Registrations (Dense Table) */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ padding: '9px 14px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--neutral-dark)' }}>
            Recent Account Audit Log
          </span>
          <button
            onClick={() => setActiveTab('directory')}
            style={{ background: 'none', border: 'none', color: '#2C6E6A', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
          >
            View Full Directory ({profiles.length})
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Role</th>
                <th style={thStyle}>Identifier</th>
                <th style={thStyle}>Assignment</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {profiles.slice(-7).reverse().map((p) => (
                <tr
                  key={p.id}
                  style={{ background: '#FFFFFF', transition: 'background 0.1s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#F8F7F4')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#FFFFFF')}
                >
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{p.name}</td>
                  <td style={{ ...tdStyle, color: 'var(--text-secondary)', fontSize: 11.5 }}>{p.email}</td>
                  <td style={tdStyle}>{rolePill(p.role)}</td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 11 }}>
                    {p.admission_number || p.user_code || '—'}
                  </td>
                  <td style={{ ...tdStyle, fontSize: 11.5, color: '#55534E' }}>{formatUserAssignment(p)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <button
                      onClick={() => onEditUser(p)}
                      style={{
                        padding: '3px 8px',
                        fontSize: 11,
                        fontWeight: 600,
                        border: '1px solid var(--border-color)',
                        borderRadius: 4,
                        background: '#FFFFFF',
                        cursor: 'pointer',
                        marginRight: 4,
                      }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // ─── TAB 2: USER DIRECTORY ───────────────────────────────────────────────────
  const renderUserDirectory = () => (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
      {/* Search & Filter Strip */}
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
          background: '#FAF9F6',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Search name, email, code, subject..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              height: 28,
              width: 210,
              padding: '0 8px',
              fontSize: 11.5,
              borderRadius: 5,
              border: '1px solid var(--border-color)',
              background: '#FFFFFF',
              color: 'var(--neutral-dark)',
              outline: 'none',
            }}
          />

          {/* Role selector pills */}
          <div style={{ display: 'flex', border: '1px solid var(--border-color)', borderRadius: 5, overflow: 'hidden' }}>
            {(['all', 'student', 'teacher', 'parent', 'admin'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                style={{
                  height: 26,
                  padding: '0 8px',
                  fontSize: 10.5,
                  fontWeight: roleFilter === r ? 700 : 500,
                  textTransform: 'uppercase',
                  border: 'none',
                  borderRight: '1px solid var(--border-color)',
                  background: roleFilter === r ? '#2D2C2A' : '#FFFFFF',
                  color: roleFilter === r ? '#FFFFFF' : 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Class Filter */}
          <div style={{ width: 140 }}>
            <CustomSelect
              value={classFilter}
              onChange={(val) => setClassFilter(val)}
              buttonStyle={{ padding: '4px 8px', fontSize: 11.5 }}
              options={[
                { value: 'all', label: 'All Sections' },
                ...ALL_CLASSES.map((c) => ({ value: c, label: `Section ${c}` })),
              ]}
            />
          </div>

          {(searchQuery || roleFilter !== 'all' || classFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setRoleFilter('all');
                setClassFilter('all');
              }}
              style={{
                height: 26,
                padding: '0 8px',
                fontSize: 10.5,
                fontWeight: 600,
                color: '#A83B38',
                background: '#FDF1F0',
                border: '1px solid #F5C6CB',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              Reset Filters
            </button>
          )}

          <span style={{ fontSize: 11, color: 'var(--text-secondary)', paddingLeft: 4 }}>
            Showing {filteredProfiles.length} of {profiles.length} accounts
          </span>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {onRefreshData && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              style={{
                height: 28,
                padding: '0 10px',
                fontSize: 11.5,
                fontWeight: 600,
                color: 'var(--neutral-dark)',
                background: '#FFFFFF',
                border: '1px solid var(--border-color)',
                borderRadius: 5,
                cursor: 'pointer',
              }}
            >
              {isRefreshing ? 'Syncing...' : 'Sync Data'}
            </button>
          )}
          <button
            onClick={exportUsersCSV}
            style={{
              height: 28,
              padding: '0 10px',
              fontSize: 11.5,
              fontWeight: 600,
              color: 'var(--neutral-dark)',
              background: '#FFFFFF',
              border: '1px solid var(--border-color)',
              borderRadius: 5,
              cursor: 'pointer',
            }}
          >
            Export CSV
          </button>
          <button
            onClick={onOpenBulkModal}
            style={{
              height: 28,
              padding: '0 10px',
              fontSize: 11.5,
              fontWeight: 600,
              color: 'var(--neutral-dark)',
              background: '#FFFFFF',
              border: '1px solid var(--border-color)',
              borderRadius: 5,
              cursor: 'pointer',
            }}
          >
            Bulk Import
          </button>
          <button
            onClick={onOpenProvisionModal}
            style={{
              height: 28,
              padding: '0 12px',
              fontSize: 11.5,
              fontWeight: 600,
              color: '#FFFFFF',
              background: '#2D2C2A',
              border: '1px solid #2D2C2A',
              borderRadius: 5,
              cursor: 'pointer',
            }}
          >
            + Provision User
          </button>
        </div>
      </div>

      {/* Directory Table */}
      <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 180px)' }}>
        {filteredProfiles.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--neutral-dark)' }}>No user records matched your criteria</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 4 }}>Try clearing active search or filters, or click &quot;Sync Data&quot; to fetch latest records.</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 32 }}>#</th>
                <th style={thStyle}>Full Name</th>
                <th style={thStyle}>Role</th>
                <th style={thStyle}>Email Address</th>
                <th style={thStyle}>Admission / Code</th>
                <th style={thStyle}>Academic Mapping</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProfiles.map((p, idx) => (
                <tr
                  key={p.id}
                  style={{
                    background: idx % 2 === 0 ? '#FFFFFF' : '#FAF9F7',
                    transition: 'background 0.08s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#F2F1EC')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = idx % 2 === 0 ? '#FFFFFF' : '#FAF9F7')}
                >
                  <td style={{ ...tdStyle, color: '#9E9B95', fontSize: 10.5 }}>{idx + 1}</td>
                  <td style={{ ...tdStyle, fontWeight: 600, whiteSpace: 'nowrap' }}>{p.name}</td>
                  <td style={tdStyle}>{rolePill(p.role)}</td>
                  <td style={{ ...tdStyle, color: 'var(--text-secondary)', fontSize: 11.5 }}>{p.email}</td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 11, color: '#44423E' }}>
                    {p.admission_number || p.user_code || '—'}
                  </td>
                  <td style={{ ...tdStyle, fontSize: 11.5, color: '#4A4843' }}>
                    {formatUserAssignment(p)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button
                      onClick={() => onEditUser(p)}
                      style={{
                        padding: '3px 8px',
                        fontSize: 11,
                        fontWeight: 600,
                        border: '1px solid var(--border-color)',
                        borderRadius: 4,
                        background: '#FFFFFF',
                        color: 'var(--neutral-dark)',
                        cursor: 'pointer',
                        marginRight: 4,
                      }}
                    >
                      Edit
                    </button>
                    {p.role !== 'admin' && (
                      <button
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete profile for "${p.name}"?`)) {
                            onDeleteUser(p.id);
                          }
                        }}
                        style={{
                          padding: '3px 8px',
                          fontSize: 11,
                          fontWeight: 600,
                          border: '1px solid #F5C6CB',
                          borderRadius: 4,
                          background: '#FDF1F0',
                          color: '#A83B38',
                          cursor: 'pointer',
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  // ─── TAB 3: CLASSES & SECTIONS ──────────────────────────────────────────────
  const renderClasses = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--neutral-dark)' }}>Class Sections & Class Teachers</span>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
              Woodlem Park active section distribution for Grades 10 & 12
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {ALL_CLASSES.map((cls) => {
            const [g, s] = cls.split('-');
            const classStudents = students.filter((st) => {
              const cleanG = (st.grade || '').replace(/[^0-9]/g, '');
              const cleanS = (st.class_letter || '').toUpperCase().trim();
              return cleanG === g && cleanS === s;
            });
            const ct = teachers.find((t) => t.assigned_class === cls);
            const isSelected = selectedClassInspect === cls;

            return (
              <div
                key={cls}
                onClick={() => setSelectedClassInspect(isSelected ? null : cls)}
                style={{
                  border: isSelected ? '1.5px solid #2C6E6A' : '1px solid var(--border-color)',
                  borderRadius: 6,
                  padding: '10px 12px',
                  background: isSelected ? '#F0F6F5' : '#FFFFFF',
                  cursor: 'pointer',
                  transition: 'all 0.1s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>Grade {g} - Section {s}</span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: 4,
                      background: '#EBF3F2',
                      color: '#2C6E6A',
                    }}
                  >
                    {classStudents.length} Students
                  </span>
                </div>

                <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid #ECEAE5', fontSize: 11 }}>
                  <div style={{ color: 'var(--text-secondary)' }}>Class Teacher:</div>
                  <div style={{ fontWeight: 600, color: ct ? '#2C6E6A' : '#9E9B95', marginTop: 1 }}>
                    {ct ? `${ct.name} (${ct.subject || 'Faculty'})` : 'Unassigned'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Class Roster */}
      {selectedClassInspect && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
          <div
            style={{
              padding: '9px 14px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#FAF9F6',
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--neutral-dark)' }}>
              Enrolled Students: Section {selectedClassInspect}
            </span>
            <button
              onClick={() => setSelectedClassInspect(null)}
              style={{ background: 'none', border: 'none', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              Close Roster
            </button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 32 }}>#</th>
                <th style={thStyle}>Student Name</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Admission #</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const [g, s] = selectedClassInspect.split('-');
                const list = students.filter((st) => {
                  const cleanG = (st.grade || '').replace(/[^0-9]/g, '');
                  const cleanS = (st.class_letter || '').toUpperCase().trim();
                  return cleanG === g && cleanS === s;
                });
                if (list.length === 0) {
                  return (
                    <tr>
                      <td colSpan={5} style={{ ...tdStyle, textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>
                        No students currently enrolled in section {selectedClassInspect}.
                      </td>
                    </tr>
                  );
                }
                return list.map((st, idx) => (
                  <tr key={st.id} style={{ background: '#FFFFFF' }}>
                    <td style={{ ...tdStyle, color: '#9E9B95', fontSize: 10.5 }}>{idx + 1}</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{st.name}</td>
                    <td style={{ ...tdStyle, color: 'var(--text-secondary)' }}>{st.email}</td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 11 }}>{st.admission_number || st.user_code || '—'}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <button
                        onClick={() => onEditUser(st)}
                        style={{
                          padding: '2px 8px',
                          fontSize: 10.5,
                          fontWeight: 600,
                          border: '1px solid var(--border-color)',
                          borderRadius: 4,
                          background: '#FFFFFF',
                          cursor: 'pointer',
                        }}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // ─── TAB 4: DOCUMENTS ───────────────────────────────────────────────────────
  const renderDocuments = () => (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
          background: '#FAF9F6',
        }}
      >
        <div>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>Parent Document Submissions</span>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 8 }}>
            Total {filteredDocs.length} records
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 220 }}>
          <CustomSelect
            value={docStudentFilter}
            onChange={(val) => setDocStudentFilter(val)}
            placeholder="All Students"
            buttonStyle={{ padding: '4px 8px', fontSize: 11.5 }}
            options={[
              { value: '', label: 'All Students' },
              ...students.map((s) => ({
                value: s.id,
                label: `${s.name} (${s.grade ? `G${s.grade}-${s.class_letter}` : 'General'})`,
              })),
            ]}
          />
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        {filteredDocs.length === 0 ? (
          <div style={{ padding: '36px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--neutral-dark)' }}>No document records found</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Submissions by parents will appear here automatically.</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 32 }}>#</th>
                <th style={thStyle}>Document Type</th>
                <th style={thStyle}>Student Name</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Uploaded File</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.map((doc, idx) => {
                const student = profiles.find((p) => p.id === doc.student_id);
                const submitted = doc.status === 'submitted';
                return (
                  <tr
                    key={doc.id || idx}
                    style={{ background: idx % 2 === 0 ? '#FFFFFF' : '#FAF9F7' }}
                  >
                    <td style={{ ...tdStyle, color: '#9E9B95', fontSize: 10.5 }}>{idx + 1}</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{doc.doc_type}</td>
                    <td style={{ ...tdStyle, color: 'var(--neutral-dark)' }}>
                      {student ? `${student.name} (${student.grade ? `G${student.grade}-${student.class_letter}` : ''})` : 'Unknown Student'}
                    </td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '1px 6px',
                          fontSize: 9.5,
                          fontWeight: 700,
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                          borderRadius: 4,
                          background: submitted ? '#EAF3EF' : '#FEF7EC',
                          color: submitted ? '#2D6E5D' : '#9E6C1B',
                          border: submitted ? '1px solid #C7E4D8' : '1px solid #F5DEB3',
                        }}
                      >
                        {submitted ? 'SUBMITTED' : 'PENDING'}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--text-secondary)', fontSize: 11 }}>
                      {submitted ? (doc.file_name || 'File attached') : 'Awaiting submission'}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      {submitted && (
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#2C6E6A', padding: '2px 6px' }}>
                          Verified
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  // ─── TAB 5: HOLISTIC HUB ────────────────────────────────────────────────────
  const renderHub = () => (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#FAF9F6',
        }}
      >
        <div>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>Holistic Development Programs</span>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 8 }}>
            {hubActivities.length} published activities
          </span>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        {hubActivities.length === 0 ? (
          <div style={{ padding: '36px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--neutral-dark)' }}>No activities published</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Extracurricular programs created by teachers will be listed here.</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 32 }}>#</th>
                <th style={thStyle}>Activity Title</th>
                <th style={thStyle}>Category</th>
                <th style={thStyle}>Event Date</th>
                <th style={thStyle}>Target Grades</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Enrollment</th>
              </tr>
            </thead>
            <tbody>
              {hubActivities.map((act, idx) => (
                <tr key={act.id} style={{ background: idx % 2 === 0 ? '#FFFFFF' : '#FAF9F7' }}>
                  <td style={{ ...tdStyle, color: '#9E9B95', fontSize: 10.5 }}>{idx + 1}</td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{act.title}</td>
                  <td style={{ ...tdStyle, color: 'var(--text-secondary)', fontSize: 11.5 }}>{act.type}</td>
                  <td style={{ ...tdStyle, color: 'var(--text-secondary)', fontSize: 11.5 }}>{act.date}</td>
                  <td style={{ ...tdStyle, fontSize: 11.5 }}>{(act.target_grades || []).join(', ') || 'All Grades'}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <span
                      style={{
                        padding: '2px 6px',
                        fontSize: 10.5,
                        fontWeight: 700,
                        borderRadius: 4,
                        background: '#EBF3F2',
                        color: '#2C6E6A',
                        border: '1px solid #CBE2DF',
                      }}
                    >
                      {(act.enrolled_student_ids || []).length} / {students.length}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  // ─── TAB 6: SYSTEM ──────────────────────────────────────────────────────────
  const renderSystem = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '14px 16px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--neutral-dark)', marginBottom: 8 }}>
          System & Database Diagnostics
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <div style={{ border: '1px solid var(--border-color)', borderRadius: 6, padding: '10px 12px', background: '#FAF9F6' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Database Backend</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#2C6E6A', marginTop: 3 }}>Connected (Supabase Cloud)</div>
            <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginTop: 2 }}>PostgreSQL Realtime Engine</div>
          </div>
          <div style={{ border: '1px solid var(--border-color)', borderRadius: 6, padding: '10px 12px', background: '#FAF9F6' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Current Operator</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--neutral-dark)', marginTop: 3 }}>{currentUser.name || 'System Admin'}</div>
            <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginTop: 2 }}>{currentUser.email}</div>
          </div>
          <div style={{ border: '1px solid var(--border-color)', borderRadius: 6, padding: '10px 12px', background: '#FAF9F6' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Institution</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--neutral-dark)', marginTop: 3 }}>Woodlem Park School</div>
            <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginTop: 2 }}>Curriculum: Grades 10 & 12</div>
          </div>
        </div>
      </div>
    </div>
  );

  const tabs: { id: AdminTab; label: string; count?: number }[] = [
    { id: 'overview', label: 'OVERVIEW' },
    { id: 'directory', label: 'USER DIRECTORY', count: profiles.length },
    { id: 'classes', label: 'CLASSES & SECTIONS', count: ALL_CLASSES.length },
    { id: 'documents', label: 'DOCUMENTS', count: parentDocuments.length },
    { id: 'hub', label: 'HOLISTIC HUB', count: hubActivities.length },
    { id: 'system', label: 'SYSTEM DIAGNOSTICS' },
  ];

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: '#F8F7F4' }}>
      {/* COMPACT SIDEBAR (210px) */}
      <aside
        style={{
          width: 210,
          minWidth: 210,
          background: '#FFFFFF',
          borderRight: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          flexShrink: 0,
        }}
      >
        {/* Brand Header with School Logo */}
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-color)', background: '#FFFFFF' }}>
          <img
            src="/Jurf-Logo-1.png"
            alt="Woodlem Park School"
            style={{
              width: '100%',
              maxHeight: 44,
              objectFit: 'contain',
              display: 'block',
              marginBottom: 6,
            }}
          />
          <div style={{ fontSize: 9.5, fontWeight: 800, color: '#65635E', letterSpacing: '0.08em', textTransform: 'uppercase', textAlign: 'center' }}>
            ADMIN MANAGEMENT CONSOLE
          </div>
        </div>

        {/* High-Visibility Admin Operator Card */}
        <div
          style={{
            margin: '8px 10px 4px',
            padding: '9px 12px',
            background: '#F5F4EE',
            border: '1px solid #DCD8CE',
            borderRadius: 7,
          }}
        >
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1E1D1B', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {currentUser.name || 'System Admin'}
          </div>
          <div style={{ fontSize: 10, color: '#6A6862', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {currentUser.email}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, paddingTop: 6, borderTop: '1px solid #E2DED4' }}>
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 800,
                letterSpacing: '0.06em',
                padding: '2px 7px',
                borderRadius: 4,
                background: '#2D2C2A',
                color: '#FFFFFF',
                textTransform: 'uppercase',
              }}
            >
              ADMINISTRATOR
            </span>
            <span style={{ fontSize: 10, color: '#2C6E6A', fontWeight: 700 }}>
              Online
            </span>
          </div>
        </div>

        {/* Navigation list (pure text, no icons) */}
        <nav style={{ flex: 1, padding: '6px 8px', overflowY: 'auto' }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', color: '#9E9B95', padding: '6px 6px 4px' }}>
            NAVIGATION
          </div>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '7px 9px',
                  fontSize: 11,
                  fontWeight: isActive ? 700 : 500,
                  letterSpacing: '0.02em',
                  color: isActive ? '#FFFFFF' : 'var(--neutral-dark)',
                  background: isActive ? '#2D2C2A' : 'transparent',
                  border: 'none',
                  borderRadius: 5,
                  cursor: 'pointer',
                  marginBottom: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = '#F2F1EC';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'transparent';
                }}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 700,
                      padding: '1px 5px',
                      borderRadius: 3,
                      background: isActive ? '#454340' : '#EAE8E3',
                      color: isActive ? '#FFFFFF' : '#65635E',
                    }}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sign out footer */}
        <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border-color)', background: '#FFFFFF' }}>
          <button
            onClick={onSignOut}
            style={{
              width: '100%',
              padding: '6px 8px',
              fontSize: 11,
              fontWeight: 600,
              color: '#A83B38',
              background: '#FDF1F0',
              border: '1px solid #F5C6CB',
              borderRadius: 5,
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* MAIN VIEWPORT */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {/* Compact Top Header Bar */}
        <header
          style={{
            height: 38,
            minHeight: 38,
            background: '#FFFFFF',
            borderBottom: '1px solid var(--border-color)',
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--neutral-dark)' }}>
              {tabs.find((t) => t.id === activeTab)?.label}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 10.5, color: 'var(--text-secondary)' }}>
              Total Records: <strong style={{ color: 'var(--neutral-dark)' }}>{profiles.length}</strong>
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#2C6E6A', letterSpacing: '0.04em' }}>
              ONLINE
            </span>
          </div>
        </header>

        {/* Scrollable Viewport Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'directory' && renderUserDirectory()}
          {activeTab === 'classes' && renderClasses()}
          {activeTab === 'documents' && renderDocuments()}
          {activeTab === 'hub' && renderHub()}
          {activeTab === 'system' && renderSystem()}
        </div>
      </main>
    </div>
  );
};
