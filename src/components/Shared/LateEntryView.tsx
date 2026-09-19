'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  UserProfile,
  LateEntryRecord,
  supabase,
} from '@/lib/supabaseClient';
import {
  LATE_ENTRY_REASONS,
  getTodayDateString,
  getFormattedCurrentTime,
  saveLateEntry,
  deleteLateEntry,
  updateLateEntry,
  toggleStaffLateEntryAccess,
  computeLateEntryFrequency,
  exportLateEntriesToCSV,
  LateFrequencyItem,
  loadAuthorizedStaffIds,
  fetchCloudAuthorizedStaffIds,
} from '@/lib/lateEntryHelper';
import { SegmentedControl } from '@/components/UI/SegmentedControl';
import { CustomSelect } from '@/components/UI/CustomSelect';
import {
  Clock,
  Search,
  Plus,
  Trash2,
  Edit2,
  Download,
  Users,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  X,
  UserCheck,
  Filter,
  ChevronDown,
  History,
  TrendingUp,
  Award,
  AlertCircle,
  FileSpreadsheet,
  Zap,
  Mail,
} from 'lucide-react';

const COMMON_LATE_PRESETS = [
  '07:15 AM',
  '07:30 AM',
  '07:45 AM',
  '08:00 AM',
  '08:15 AM',
  '08:30 AM',
  '08:45 AM',
  '09:00 AM',
];

const HOUR_OPTIONS = Array.from({ length: 12 }, (_, i) => {
  const val = String(i + 1).padStart(2, '0');
  return { value: val, label: val };
});

const getMinuteOptions = (currentMin?: string) => {
  const base = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];
  const all = currentMin && !base.includes(currentMin) ? [...base, currentMin].sort() : base;
  return all.map((m) => ({ value: m, label: m }));
};

const PERIOD_OPTIONS = [
  { value: 'AM', label: 'AM' },
  { value: 'PM', label: 'PM' },
];

const parseTimeParts = (t: string) => {
  const match = (t || '').trim().match(/^(\d{1,2}):(\d{2})(?:\s*([AaPp][Mm]))?$/i);
  if (match) {
    let h = parseInt(match[1], 10);
    const m = match[2];
    let p: 'AM' | 'PM' = match[3] ? (match[3].toUpperCase() === 'PM' ? 'PM' : 'AM') : (h >= 12 ? 'PM' : 'AM');
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    return {
      hour: String(h).padStart(2, '0'),
      minute: m,
      period: p,
    };
  }
  return { hour: '07', minute: '30', period: 'AM' as const };
};

interface LateEntryViewProps {
  mode: 'desk' | 'admin';
  currentUser: UserProfile;
  profiles: UserProfile[];
  lateEntries: LateEntryRecord[];
  onRefreshData?: () => void;
}

export const LateEntryView: React.FC<LateEntryViewProps> = ({
  mode,
  currentUser,
  profiles,
  lateEntries,
  onRefreshData,
}) => {
  // Navigation tabs within Late Entry View
  const [adminSubTab, setAdminSubTab] = useState<'desk' | 'authorized_staff' | 'frequency' | 'history'>('desk');

  // Today's date string
  const todayStr = getTodayDateString();

  // Search query for today's table
  const [todaySearch, setTodaySearch] = useState('');
  const [todayRoleFilter, setTodayRoleFilter] = useState<'all' | 'student' | 'teacher'>('all');

  // History filters
  const [historySearch, setHistorySearch] = useState('');
  const [historyRoleFilter, setHistoryRoleFilter] = useState<'all' | 'student' | 'teacher'>('all');
  const [historyGradeFilter, setHistoryGradeFilter] = useState('all');
  const [historyDateFilter, setHistoryDateFilter] = useState('all'); // 'all' | 'today' | 'last7' | 'last30'

  // Recording form state
  const [personSearch, setPersonSearch] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<UserProfile | null>(null);
  const [entryDate, setEntryDate] = useState(todayStr);
  const [entryTime, setEntryTime] = useState(getFormattedCurrentTime());
  const [entryReason, setEntryReason] = useState(LATE_ENTRY_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [entryNotes, setEntryNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit record modal
  const [editingRecord, setEditingRecord] = useState<LateEntryRecord | null>(null);
  const [editTime, setEditTime] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Frequency drill-down modal
  const [selectedFrequencyItem, setSelectedFrequencyItem] = useState<LateFrequencyItem | null>(null);

  // Staff Assignment modal
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [staffSearch, setStaffSearch] = useState('');

  // Authorized Staff IDs
  const [authorizedStaffIds, setAuthorizedStaffIds] = useState<string[]>(() => loadAuthorizedStaffIds());

  useEffect(() => {
    fetchCloudAuthorizedStaffIds().then((ids) => {
      if (ids && ids.length > 0) {
        setAuthorizedStaffIds(ids);
      }
    });
  }, []);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const parsedEntryTime = useMemo(() => parseTimeParts(entryTime), [entryTime]);
  const parsedEditTime = useMemo(() => parseTimeParts(editTime), [editTime]);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };



  // Keep time updated if user hasn't selected a person yet
  useEffect(() => {
    const timer = setInterval(() => {
      if (!selectedPerson) {
        setEntryTime(getFormattedCurrentTime());
      }
    }, 30000);
    return () => clearInterval(timer);
  }, [selectedPerson]);

  // Active searchable students and teachers
  const eligiblePersons = useMemo(() => {
    const query = personSearch.trim().toLowerCase();
    if (!query) return [];

    return profiles
      .filter((p) => !p.is_deactivated && (p.role === 'student' || p.role === 'teacher'))
      .filter((p) => {
        const name = (p.name || '').toLowerCase();
        const email = (p.email || '').toLowerCase();
        const code = (p.user_code || p.admission_number || '').toLowerCase();
        const gradeStr = p.grade ? `grade ${p.grade}` : '';
        const classStr = p.class_letter ? `${p.grade}-${p.class_letter}`.toLowerCase() : '';
        const subjectStr = (p.subject || '').toLowerCase();

        return (
          name.includes(query) ||
          email.includes(query) ||
          code.includes(query) ||
          gradeStr.includes(query) ||
          classStr.includes(query) ||
          subjectStr.includes(query)
        );
      })
      .slice(0, 10);
  }, [personSearch, profiles]);

  // Authorized staff list
  const authorizedStaffMembers = useMemo(() => {
    return profiles.filter(
      (p) => !p.is_deactivated && (p.can_manage_late_entry || authorizedStaffIds.includes(p.id))
    );
  }, [profiles, authorizedStaffIds]);

  // Filtered today's records
  const todayRecords = useMemo(() => {
    return lateEntries.filter((entry) => {
      if (entry.date !== todayStr) return false;
      if (todayRoleFilter !== 'all' && entry.role !== todayRoleFilter) return false;
      if (todaySearch.trim()) {
        const q = todaySearch.toLowerCase();
        return (
          entry.person_name.toLowerCase().includes(q) ||
          (entry.user_code && entry.user_code.toLowerCase().includes(q)) ||
          (entry.reason && entry.reason.toLowerCase().includes(q)) ||
          (entry.grade && `grade ${entry.grade}`.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [lateEntries, todayStr, todayRoleFilter, todaySearch]);

  // Today metrics
  const todayTotalCount = todayRecords.length;
  const todayStudentCount = todayRecords.filter((r) => r.role === 'student').length;
  const todayTeacherCount = todayRecords.filter((r) => r.role === 'teacher').length;

  // Full history filtered
  const filteredHistory = useMemo(() => {
    return lateEntries.filter((entry) => {
      if (historyRoleFilter !== 'all' && entry.role !== historyRoleFilter) return false;
      if (historyGradeFilter !== 'all' && entry.grade !== historyGradeFilter) return false;

      // Date filter
      if (historyDateFilter === 'today' && entry.date !== todayStr) return false;
      if (historyDateFilter === 'last7') {
        const entryTime = new Date(entry.date).getTime();
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        if (entryTime < sevenDaysAgo) return false;
      }
      if (historyDateFilter === 'last30') {
        const entryTime = new Date(entry.date).getTime();
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        if (entryTime < thirtyDaysAgo) return false;
      }

      if (historySearch.trim()) {
        const q = historySearch.toLowerCase();
        return (
          entry.person_name.toLowerCase().includes(q) ||
          (entry.user_code && entry.user_code.toLowerCase().includes(q)) ||
          (entry.reason && entry.reason.toLowerCase().includes(q)) ||
          (entry.recorded_by_name && entry.recorded_by_name.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [lateEntries, historyRoleFilter, historyGradeFilter, historyDateFilter, historySearch, todayStr]);

  // Frequency rankings
  const frequencyRankings = useMemo(() => {
    return computeLateEntryFrequency(lateEntries);
  }, [lateEntries]);

  // Handle submit late arrival
  const handleRecordLateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPerson) {
      showToast('Please search and select a student or teacher first.', 'error');
      return;
    }

    const finalReason =
      entryReason === 'Unspecified / Other' && customReason.trim()
        ? customReason.trim()
        : entryReason;

    setIsSubmitting(true);
    try {
      await saveLateEntry({
        user_id: selectedPerson.id,
        person_name: selectedPerson.name,
        role: selectedPerson.role as 'student' | 'teacher',
        grade: selectedPerson.grade || '',
        class_letter: selectedPerson.class_letter || '',
        user_code: selectedPerson.user_code || selectedPerson.admission_number || '',
        date: entryDate,
        time: entryTime,
        entry_timestamp: new Date().toISOString(),
        reason: finalReason,
        notes: entryNotes.trim(),
        recorded_by_id: currentUser.id,
        recorded_by_name: currentUser.name,
        acknowledged: false,
      });

      showToast(`Late entry recorded for ${selectedPerson.name} (${entryTime}).`, 'success');

      // Reset form
      setSelectedPerson(null);
      setPersonSearch('');
      setEntryNotes('');
      setCustomReason('');
      setEntryReason(LATE_ENTRY_REASONS[0]);
      setEntryTime(getFormattedCurrentTime());

      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error(err);
      showToast('Failed to record late entry. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete record
  const handleDeleteRecord = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove the late arrival record for ${name}?`)) {
      return;
    }

    try {
      await deleteLateEntry(id);
      showToast(`Removed late arrival entry for ${name}.`, 'info');
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error(err);
      showToast('Could not delete record.', 'error');
    }
  };

  // Handle update record
  const handleSaveEditRecord = async () => {
    if (!editingRecord) return;

    try {
      await updateLateEntry(editingRecord.id, {
        time: editTime,
        reason: editReason,
        notes: editNotes,
      });
      showToast('Late entry record updated successfully.', 'success');
      setEditingRecord(null);
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error(err);
      showToast('Failed to update record.', 'error');
    }
  };

  // Handle toggle staff access
  const handleToggleStaff = async (userId: string, userName: string, grant: boolean) => {
    try {
      const ok = await toggleStaffLateEntryAccess(userId, grant);
      if (ok) {
        setAuthorizedStaffIds(loadAuthorizedStaffIds());
        const target = profiles.find((p) => p.id === userId);
        if (target) {
          target.can_manage_late_entry = grant;
        }
        showToast(
          grant
            ? `Granted Late Entry Desk access to ${userName}.`
            : `Revoked Late Entry Desk access from ${userName}.`,
          'success'
        );
        if (onRefreshData) onRefreshData();
      } else {
        showToast('Error updating staff access.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error updating staff access.', 'error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', minWidth: 0 }}>
      {/* TOAST FEEDBACK */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: 24,
            right: 24,
            zIndex: 9999,
            padding: '12px 18px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            background:
              toastMessage.type === 'error'
                ? '#991B1B'
                : toastMessage.type === 'info'
                ? '#1E293B'
                : '#166534',
            color: '#FFFFFF',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          {toastMessage.type === 'error' ? (
            <AlertCircle size={16} />
          ) : (
            <CheckCircle2 size={16} />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* TOP BANNER & NAVIGATION */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-color)',
          borderRadius: 8,
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 8,
              background: '#EAF3EF',
              border: '1px solid #C7E4D8',
              color: '#2C6E6A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Clock size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--neutral-dark)' }}>
                Late Entry Management
              </h2>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 4,
                  background: mode === 'admin' ? '#1A1A1A' : '#EAF3EF',
                  color: mode === 'admin' ? '#FFFFFF' : '#2C6E6A',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {mode === 'admin' ? 'Admin Controller' : 'Gate Duty Desk'}
              </span>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
              {mode === 'admin'
                ? 'Manage designated staff, record arrivals, and monitor school-wide late entry frequency patterns.'
                : 'Rapidly record student and faculty late arrivals for today and manage the daily gate registry.'}
            </p>
          </div>
        </div>

        {/* Quick Date Stamp */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 6,
              background: '#FAF9F6',
              border: '1px solid #E5E3DF',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--neutral-dark)',
            }}
          >
            <Calendar size={14} style={{ color: '#2C6E6A' }} />
            <span>Today: {todayStr}</span>
          </div>

          {mode === 'admin' && (
            <button
              type="button"
              onClick={() => exportLateEntriesToCSV(lateEntries, `woodlem_all_late_entries_${todayStr}.csv`)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 6,
                background: '#FFFFFF',
                border: '1px solid #E5E3DF',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--neutral-dark)',
                cursor: 'pointer',
              }}
            >
              <Download size={13} />
              <span>Export All CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* ADMIN SUB-TABS (Only visible in admin mode) */}
      {mode === 'admin' && (
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <SegmentedControl
            value={adminSubTab}
            onChange={(val) => setAdminSubTab(val as any)}
            options={[
              { value: 'desk', label: "Daily Gate Desk & Today's Queue", count: todayTotalCount },
              { value: 'frequency', label: 'Frequency & Repeat Analysis', count: frequencyRankings.length },
              { value: 'history', label: 'Complete Audit Log', count: lateEntries.length },
              { value: 'authorized_staff', label: 'Designated Staff Access', count: authorizedStaffMembers.length },
            ]}
            height={34}
            textTransform="uppercase"
          />
        </div>
      )}



      {/* ========================================================================= */}
      {/* SECTION 1: DAILY GATE DESK (Visible in desk mode OR admin 'desk' tab)      */}
      {/* ========================================================================= */}
      {(mode === 'desk' || adminSubTab === 'desk') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* TOP SUMMARY STATS ROW */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 12,
            }}
          >
            <div
              style={{
                background: '#FFFFFF',
                border: '1px solid var(--border-color)',
                borderRadius: 8,
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Total Late Today
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--neutral-dark)', marginTop: 2 }}>
                  {todayTotalCount}
                </div>
              </div>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 8,
                  background: '#FDF1F0',
                  color: '#A83B38',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Clock size={18} />
              </div>
            </div>

            <div
              style={{
                background: '#FFFFFF',
                border: '1px solid var(--border-color)',
                borderRadius: 8,
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Students Late
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#2C6E6A', marginTop: 2 }}>
                  {todayStudentCount}
                </div>
              </div>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 8,
                  background: '#EAF3EF',
                  color: '#2C6E6A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Users size={18} />
              </div>
            </div>

            <div
              style={{
                background: '#FFFFFF',
                border: '1px solid var(--border-color)',
                borderRadius: 8,
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Teachers Late
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#7C5CBF', marginTop: 2 }}>
                  {todayTeacherCount}
                </div>
              </div>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 8,
                  background: '#F3EFFA',
                  color: '#7C5CBF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <UserCheck size={18} />
              </div>
            </div>
          </div>

          {/* TWO-COLUMN WORKBENCH: Record Late Arrival (Left) & Today's Queue (Right) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(320px, 380px) minmax(0, 1fr)',
              gap: 16,
              alignItems: 'start',
            }}
          >
            {/* RECORD FORM PANEL (LEFT) */}
            <div
              style={{
                background: '#FFFFFF',
                border: '1px solid var(--border-color)',
                borderRadius: 8,
                padding: '16px 20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Plus size={16} style={{ color: '#2C6E6A' }} />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--neutral-dark)' }}>
                  Record Late Arrival
                </h3>
              </div>

              <form onSubmit={handleRecordLateEntry} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* 1. Person Search / Autocomplete */}
                <div>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--neutral-dark)', marginBottom: 6 }}>
                    Select Student or Teacher <span style={{ color: '#A83B38' }}>*</span>
                  </label>

                  {selectedPerson ? (
                    <div
                      style={{
                        padding: '10px 12px',
                        borderRadius: 6,
                        background: '#FAF9F6',
                        border: '1px solid #C7E4D8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                            {selectedPerson.name}
                          </span>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: 4,
                              background: selectedPerson.role === 'teacher' ? '#F3EFFA' : '#EAF3EF',
                              color: selectedPerson.role === 'teacher' ? '#7C5CBF' : '#2C6E6A',
                              textTransform: 'uppercase',
                            }}
                          >
                            {selectedPerson.role}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                          {selectedPerson.role === 'student' && selectedPerson.grade
                            ? `Grade ${selectedPerson.grade}${selectedPerson.class_letter ? `-${selectedPerson.class_letter}` : ''}`
                            : selectedPerson.subject || 'Faculty'}
                          {selectedPerson.user_code ? ` • Code: ${selectedPerson.user_code}` : ''}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPerson(null);
                          setPersonSearch('');
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#A83B38',
                          cursor: 'pointer',
                          padding: 4,
                        }}
                        title="Deselect"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div style={{ position: 'relative' }}>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <Search size={14} style={{ position: 'absolute', left: 10, color: '#8C8A84', pointerEvents: 'none' }} />
                        <input
                          type="text"
                          placeholder="Search student or teacher name, code..."
                          value={personSearch}
                          onChange={(e) => setPersonSearch(e.target.value)}
                          style={{
                            width: '100%',
                            height: 34,
                            paddingLeft: 30,
                            paddingRight: 10,
                            fontSize: 12,
                            borderRadius: 6,
                            border: '1px solid #E5E3DF',
                            background: '#FFFFFF',
                            color: '#1A1A1A',
                            outline: 'none',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>

                      {/* Autocomplete Dropdown */}
                      {eligiblePersons.length > 0 && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 38,
                            left: 0,
                            right: 0,
                            background: '#FFFFFF',
                            border: '1px solid #E5E3DF',
                            borderRadius: 6,
                            boxShadow: '0 6px 18px rgba(0,0,0,0.08)',
                            zIndex: 60,
                            maxHeight: 220,
                            overflowY: 'auto',
                          }}
                        >
                          {eligiblePersons.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setSelectedPerson(p);
                                setPersonSearch('');
                              }}
                              style={{
                                width: '100%',
                                padding: '8px 12px',
                                textAlign: 'left',
                                background: 'none',
                                border: 'none',
                                borderBottom: '1px solid #F0EFEA',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = '#FAF9F6')}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                            >
                              <div>
                                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                                  {p.name}
                                </div>
                                <div style={{ fontSize: 10.5, color: 'var(--text-secondary)' }}>
                                  {p.role === 'student' && p.grade
                                    ? `Grade ${p.grade}${p.class_letter ? `-${p.class_letter}` : ''}`
                                    : p.subject || 'Faculty'}
                                  {p.user_code ? ` • ${p.user_code}` : ''}
                                </div>
                              </div>
                              <span
                                style={{
                                  fontSize: 9.5,
                                  fontWeight: 700,
                                  padding: '1px 5px',
                                  borderRadius: 4,
                                  background: p.role === 'teacher' ? '#F3EFFA' : '#EAF3EF',
                                  color: p.role === 'teacher' ? '#7C5CBF' : '#2C6E6A',
                                  textTransform: 'uppercase',
                                }}
                              >
                                {p.role}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 2. Date */}
                <div>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--neutral-dark)', marginBottom: 5 }}>
                    Date
                  </label>
                  <input
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    style={{
                      width: '100%',
                      height: 32,
                      padding: '0 10px',
                      fontSize: 12,
                      borderRadius: 6,
                      border: '1px solid #E5E3DF',
                      background: '#FFFFFF',
                      color: '#1A1A1A',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* 3. Time of Arrival — Direct Custom Dropdowns */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                    <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                      Time of Arrival
                    </label>
                    <button
                      type="button"
                      onClick={() => setEntryTime(getFormattedCurrentTime())}
                      title="Snap to current clock time"
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#2C6E6A',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                      }}
                    >
                      <Zap size={10} />
                      <span>Now ({getFormattedCurrentTime()})</span>
                    </button>
                  </div>

                  {/* 3 Custom Dropdowns: Hour, Minute, Period */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                    <div>
                      <CustomSelect
                        value={parsedEntryTime.hour}
                        onChange={(val) => setEntryTime(`${val}:${parsedEntryTime.minute} ${parsedEntryTime.period}`)}
                        options={HOUR_OPTIONS}
                        compact
                        menuWidth={70}
                        buttonStyle={{ height: 32, fontSize: 12, borderRadius: 6, borderColor: '#E5E3DF', padding: '0 8px' }}
                      />
                    </div>
                    <div>
                      <CustomSelect
                        value={parsedEntryTime.minute}
                        onChange={(val) => setEntryTime(`${parsedEntryTime.hour}:${val} ${parsedEntryTime.period}`)}
                        options={getMinuteOptions(parsedEntryTime.minute)}
                        compact
                        menuWidth={70}
                        buttonStyle={{ height: 32, fontSize: 12, borderRadius: 6, borderColor: '#E5E3DF', padding: '0 8px' }}
                      />
                    </div>
                    <div>
                      <CustomSelect
                        value={parsedEntryTime.period}
                        onChange={(val) => setEntryTime(`${parsedEntryTime.hour}:${parsedEntryTime.minute} ${val}`)}
                        options={PERIOD_OPTIONS}
                        compact
                        menuWidth={70}
                        buttonStyle={{ height: 32, fontSize: 12, borderRadius: 6, borderColor: '#E5E3DF', padding: '0 8px' }}
                      />
                    </div>
                  </div>

                  {/* Quick Common Times */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                    {COMMON_LATE_PRESETS.map((p) => {
                      const isSelected = entryTime === p;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setEntryTime(p)}
                          style={{
                            padding: '3px 7px',
                            fontSize: 10.5,
                            fontWeight: isSelected ? 700 : 500,
                            borderRadius: 4,
                            border: isSelected ? '1px solid #1A1A1A' : '1px solid #E5E3DF',
                            background: isSelected ? '#1A1A1A' : '#FAF9F6',
                            color: isSelected ? '#FFFFFF' : 'var(--neutral-dark)',
                            cursor: 'pointer',
                            transition: 'all 0.1s ease',
                          }}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Reason for Delay */}
                <div>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--neutral-dark)', marginBottom: 5 }}>
                    Late Reason
                  </label>
                  <CustomSelect
                    value={entryReason}
                    onChange={(val) => setEntryReason(val)}
                    buttonStyle={{ height: 32, fontSize: 12, borderRadius: 6, borderColor: '#E5E3DF' }}
                    options={LATE_ENTRY_REASONS.map((r) => ({ value: r, label: r }))}
                  />
                  {entryReason === 'Unspecified / Other' && (
                    <input
                      type="text"
                      placeholder="Specify custom reason..."
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      style={{
                        width: '100%',
                        height: 32,
                        padding: '0 10px',
                        fontSize: 12,
                        borderRadius: 6,
                        border: '1px solid #E5E3DF',
                        background: '#FFFFFF',
                        color: '#1A1A1A',
                        outline: 'none',
                        boxSizing: 'border-box',
                        marginTop: 6,
                      }}
                    />
                  )}
                </div>

                {/* 4. Gate / Officer Notes */}
                <div>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--neutral-dark)', marginBottom: 5 }}>
                    Gate Notes / Observations (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Parent informed school, arriving from Clinic..."
                    value={entryNotes}
                    onChange={(e) => setEntryNotes(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      fontSize: 12,
                      borderRadius: 6,
                      border: '1px solid #E5E3DF',
                      background: '#FFFFFF',
                      color: '#1A1A1A',
                      outline: 'none',
                      boxSizing: 'border-box',
                      resize: 'none',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>

                {/* Recording Officer Attribution */}
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                    background: '#FAF9F6',
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: '1px solid #E5E3DF',
                  }}
                >
                  Recorded by: <strong>{currentUser.name}</strong> ({currentUser.role.toUpperCase()})
                </div>

                {/* Submit Action */}
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedPerson}
                  style={{
                    height: 36,
                    borderRadius: 6,
                    background: selectedPerson ? '#1A1A1A' : '#E5E3DF',
                    color: selectedPerson ? '#FFFFFF' : '#8C8A84',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: 12.5,
                    cursor: selectedPerson ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Plus size={15} />
                  <span>{isSubmitting ? 'Recording...' : 'Record Late Arrival'}</span>
                </button>
              </form>
            </div>

            {/* DAILY OVERVIEW: TODAY'S QUEUE (RIGHT) */}
            <div
              style={{
                background: '#FFFFFF',
                border: '1px solid var(--border-color)',
                borderRadius: 8,
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Table Toolbar */}
              <div
                style={{
                  padding: '12px 16px',
                  background: '#FAF9F6',
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: 'var(--neutral-dark)' }}>
                    Today's Gate Registry
                  </h3>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '1px 7px',
                      borderRadius: 10,
                      background: '#FDF1F0',
                      color: '#A83B38',
                    }}
                  >
                    {todayRecords.length}
                  </span>
                </div>

                {/* Filters */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {/* Search */}
                  <div style={{ position: 'relative', width: 170 }}>
                    <Search size={13} style={{ position: 'absolute', left: 8, top: 9, color: '#8C8A84' }} />
                    <input
                      type="text"
                      placeholder="Search today's late..."
                      value={todaySearch}
                      onChange={(e) => setTodaySearch(e.target.value)}
                      style={{
                        width: '100%',
                        height: 30,
                        paddingLeft: 26,
                        paddingRight: 8,
                        fontSize: 11.5,
                        borderRadius: 6,
                        border: '1px solid #E5E3DF',
                        background: '#FFFFFF',
                        color: '#1A1A1A',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  {/* Role Segment */}
                  <SegmentedControl
                    value={todayRoleFilter}
                    onChange={(r) => setTodayRoleFilter(r as any)}
                    options={[
                      { value: 'all', label: 'ALL' },
                      { value: 'student', label: 'STUDENTS' },
                      { value: 'teacher', label: 'TEACHERS' },
                    ]}
                    height={30}
                    size="sm"
                  />

                  {/* Export Today's CSV */}
                  {todayRecords.length > 0 && (
                    <button
                      type="button"
                      onClick={() => exportLateEntriesToCSV(todayRecords, `woodlem_late_today_${todayStr}.csv`)}
                      style={{
                        height: 30,
                        padding: '0 9px',
                        fontSize: 11,
                        fontWeight: 600,
                        borderRadius: 6,
                        background: '#FFFFFF',
                        border: '1px solid #E5E3DF',
                        color: 'var(--neutral-dark)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                      title="Export Today's Registry"
                    >
                      <Download size={12} />
                      <span>CSV</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Table Body */}
              {todayRecords.length === 0 ? (
                <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                  <Clock size={32} style={{ margin: '0 auto 8px', color: '#D4D0C8', display: 'block' }} />
                  {todaySearch || todayRoleFilter !== 'all'
                    ? 'No late arrivals match the current filter.'
                    : 'No late arrivals recorded yet for today.'}
                </div>
              ) : (
                <div style={{ overflowX: 'auto', maxHeight: 420 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#F9F8F6', borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--neutral-dark)' }}>Time</th>
                        <th style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--neutral-dark)' }}>Person</th>
                        <th style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--neutral-dark)' }}>Role / Cohort</th>
                        <th style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--neutral-dark)' }}>Reason</th>
                        <th style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--neutral-dark)' }}>Officer</th>
                        <th style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--neutral-dark)', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todayRecords.map((entry) => (
                        <tr
                          key={entry.id}
                          style={{ borderBottom: '1px solid #F0EFEA' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#FAF9F6')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                        >
                          <td style={{ padding: '9px 12px', fontWeight: 700, color: '#A83B38', whiteSpace: 'nowrap' }}>
                            {entry.time}
                          </td>
                          <td style={{ padding: '9px 12px', fontWeight: 600, color: 'var(--neutral-dark)' }}>
                            {entry.person_name}
                            {entry.user_code && (
                              <div style={{ fontSize: 10.5, color: 'var(--text-secondary)' }}>
                                {entry.user_code}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                padding: '1px 6px',
                                borderRadius: 4,
                                background: entry.role === 'teacher' ? '#F3EFFA' : '#EAF3EF',
                                color: entry.role === 'teacher' ? '#7C5CBF' : '#2C6E6A',
                                textTransform: 'uppercase',
                                marginRight: 6,
                              }}
                            >
                              {entry.role}
                            </span>
                            <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                              {entry.role === 'student' && entry.grade
                                ? `Gr. ${entry.grade}${entry.class_letter ? `-${entry.class_letter}` : ''}`
                                : 'Faculty'}
                            </span>
                          </td>
                          <td style={{ padding: '9px 12px', color: 'var(--neutral-dark)' }}>
                            <div style={{ fontWeight: 500 }}>{entry.reason || 'Unspecified'}</div>
                            {entry.notes && (
                              <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                "{entry.notes}"
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '9px 12px', fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                            {entry.recorded_by_name}
                          </td>
                          <td style={{ padding: '9px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'inline-flex', gap: 4 }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingRecord(entry);
                                  setEditTime(entry.time);
                                  setEditReason(entry.reason || LATE_ENTRY_REASONS[0]);
                                  setEditNotes(entry.notes || '');
                                }}
                                style={{
                                  padding: '3px 7px',
                                  borderRadius: 4,
                                  border: '1px solid #E5E3DF',
                                  background: '#FFFFFF',
                                  color: 'var(--neutral-dark)',
                                  cursor: 'pointer',
                                }}
                                title="Edit Record"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteRecord(entry.id, entry.person_name)}
                                style={{
                                  padding: '3px 7px',
                                  borderRadius: 4,
                                  border: '1px solid #F5C6CB',
                                  background: '#FDF1F0',
                                  color: '#A83B38',
                                  cursor: 'pointer',
                                }}
                                title="Delete Record"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: FREQUENCY & REPEAT OFFENDER ANALYSIS (Admin Only)               */}
      {/* ========================================================================= */}
      {mode === 'admin' && adminSubTab === 'frequency' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Header Info Banner */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={18} style={{ color: '#2C6E6A' }} />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--neutral-dark)' }}>
                  Late Arrival Frequency Analysis
                </h3>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                Identifies recurring tardiness patterns across students and teachers, sorted by total frequency.
              </p>
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Total Individuals Monitored: <strong>{frequencyRankings.length}</strong>
            </div>
          </div>

          {/* Frequency Table */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            {frequencyRankings.length === 0 ? (
              <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                No late arrivals recorded in the system yet.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#FAF9F6', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--neutral-dark)', width: 60 }}>Rank</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--neutral-dark)' }}>Person Name</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--neutral-dark)' }}>Role</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--neutral-dark)' }}>Grade / Subject</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--neutral-dark)' }}>Total Late Count</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--neutral-dark)' }}>Most Recent Late Entry</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--neutral-dark)', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {frequencyRankings.map((item, idx) => {
                      const isHighFrequency = item.count >= 3;
                      return (
                        <tr
                          key={item.userId}
                          style={{ borderBottom: '1px solid #F0EFEA' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#FAF9F6')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                        >
                          <td style={{ padding: '10px 14px', fontWeight: 700, color: idx < 3 ? '#A83B38' : 'var(--text-secondary)' }}>
                            #{idx + 1}
                          </td>
                          <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--neutral-dark)' }}>
                            {item.personName}
                            {item.userCode && (
                              <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>
                                {item.userCode}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                padding: '2px 7px',
                                borderRadius: 4,
                                background: item.role === 'teacher' ? '#F3EFFA' : '#EAF3EF',
                                color: item.role === 'teacher' ? '#7C5CBF' : '#2C6E6A',
                                textTransform: 'uppercase',
                              }}
                            >
                              {item.role}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>
                            {item.role === 'student' && item.grade
                              ? `Grade ${item.grade}${item.classLetter ? `-${item.classLetter}` : ''}`
                              : 'Faculty'}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 800,
                                padding: '3px 9px',
                                borderRadius: 12,
                                background: isHighFrequency ? '#FDF1F0' : '#FAF9F6',
                                color: isHighFrequency ? '#A83B38' : 'var(--neutral-dark)',
                                border: isHighFrequency ? '1px solid #F5C6CB' : '1px solid #E5E3DF',
                              }}
                            >
                              {item.count} {item.count === 1 ? 'time' : 'times'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: 11.5, color: 'var(--neutral-dark)' }}>
                            <strong>{item.lastDate}</strong> at {item.lastTime}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                            <button
                              type="button"
                              onClick={() => setSelectedFrequencyItem(item)}
                              style={{
                                padding: '4px 10px',
                                fontSize: 11,
                                fontWeight: 600,
                                borderRadius: 5,
                                border: '1px solid #E5E3DF',
                                background: '#FFFFFF',
                                color: 'var(--neutral-dark)',
                                cursor: 'pointer',
                              }}
                            >
                              View History ({item.count})
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 3: COMPLETE AUDIT LOG / ALL HISTORICAL RECORDS (Admin Only)        */}
      {/* ========================================================================= */}
      {mode === 'admin' && adminSubTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* History Search & Filter Strip */}
          <div
            style={{
              background: '#FAF9F6',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
              {/* Search Bar */}
              <div style={{ position: 'relative', width: 240, flexShrink: 0 }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: '#8C8A84' }} />
                <input
                  type="text"
                  placeholder="Search name, code, officer..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  style={{
                    width: '100%',
                    height: 32,
                    paddingLeft: 30,
                    paddingRight: 10,
                    fontSize: 12,
                    borderRadius: 6,
                    border: '1px solid #E5E3DF',
                    background: '#FFFFFF',
                    color: '#1A1A1A',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Role Segment */}
              <SegmentedControl
                value={historyRoleFilter}
                onChange={(r) => setHistoryRoleFilter(r as any)}
                options={[
                  { value: 'all', label: 'ALL' },
                  { value: 'student', label: 'STUDENTS' },
                  { value: 'teacher', label: 'TEACHERS' },
                ]}
                height={32}
              />

              {/* Date Filter */}
              <div style={{ width: 140 }}>
                <CustomSelect
                  value={historyDateFilter}
                  onChange={(val) => setHistoryDateFilter(val)}
                  buttonStyle={{ height: 32, fontSize: 12, borderRadius: 6, borderColor: '#E5E3DF' }}
                  options={[
                    { value: 'all', label: 'All Dates' },
                    { value: 'today', label: 'Today Only' },
                    { value: 'last7', label: 'Last 7 Days' },
                    { value: 'last30', label: 'Last 30 Days' },
                  ]}
                />
              </div>

              {/* Grade Filter */}
              <div style={{ width: 120 }}>
                <CustomSelect
                  value={historyGradeFilter}
                  onChange={(val) => setHistoryGradeFilter(val)}
                  buttonStyle={{ height: 32, fontSize: 12, borderRadius: 6, borderColor: '#E5E3DF' }}
                  options={[
                    { value: 'all', label: 'All Grades' },
                    { value: '9', label: 'Grade 9' },
                    { value: '10', label: 'Grade 10' },
                    { value: '11', label: 'Grade 11' },
                    { value: '12', label: 'Grade 12' },
                  ]}
                />
              </div>

              {/* Reset Filters */}
              {(historySearch || historyRoleFilter !== 'all' || historyGradeFilter !== 'all' || historyDateFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setHistorySearch('');
                    setHistoryRoleFilter('all');
                    setHistoryGradeFilter('all');
                    setHistoryDateFilter('all');
                  }}
                  style={{
                    height: 28,
                    padding: '0 9px',
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#A83B38',
                    background: '#FDF1F0',
                    border: '1px solid #F5C6CB',
                    borderRadius: 5,
                    cursor: 'pointer',
                  }}
                >
                  Reset Filters
                </button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                Showing <strong>{filteredHistory.length}</strong> records
              </div>
              <button
                type="button"
                onClick={() => exportLateEntriesToCSV(filteredHistory, 'woodlem_filtered_late_history.csv')}
                style={{
                  height: 32,
                  padding: '0 10px',
                  borderRadius: 6,
                  border: '1px solid #E5E3DF',
                  background: '#FFFFFF',
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: 'var(--neutral-dark)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <Download size={13} />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* History Table */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            {filteredHistory.length === 0 ? (
              <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                No late arrival records match your criteria.
              </div>
            ) : (
              <div style={{ overflowX: 'auto', maxHeight: 520 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#FAF9F6', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, zIndex: 10 }}>
                      <th style={{ padding: '9px 12px', fontWeight: 700, color: 'var(--neutral-dark)' }}>Date</th>
                      <th style={{ padding: '9px 12px', fontWeight: 700, color: 'var(--neutral-dark)' }}>Arrival Time</th>
                      <th style={{ padding: '9px 12px', fontWeight: 700, color: 'var(--neutral-dark)' }}>Person Name</th>
                      <th style={{ padding: '9px 12px', fontWeight: 700, color: 'var(--neutral-dark)' }}>Role</th>
                      <th style={{ padding: '9px 12px', fontWeight: 700, color: 'var(--neutral-dark)' }}>Cohort / Class</th>
                      <th style={{ padding: '9px 12px', fontWeight: 700, color: 'var(--neutral-dark)' }}>Reason</th>
                      <th style={{ padding: '9px 12px', fontWeight: 700, color: 'var(--neutral-dark)' }}>Recorded By</th>
                      <th style={{ padding: '9px 12px', fontWeight: 700, color: 'var(--neutral-dark)', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.map((entry) => (
                      <tr
                        key={entry.id}
                        style={{ borderBottom: '1px solid #F0EFEA' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#FAF9F6')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                      >
                        <td style={{ padding: '9px 12px', fontWeight: 600, color: 'var(--neutral-dark)', whiteSpace: 'nowrap' }}>
                          {entry.date}
                        </td>
                        <td style={{ padding: '9px 12px', fontWeight: 700, color: '#A83B38', whiteSpace: 'nowrap' }}>
                          {entry.time}
                        </td>
                        <td style={{ padding: '9px 12px', fontWeight: 700, color: 'var(--neutral-dark)' }}>
                          {entry.person_name}
                          {entry.user_code && (
                            <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', fontWeight: 500 }}>
                              {entry.user_code}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: 4,
                              background: entry.role === 'teacher' ? '#F3EFFA' : '#EAF3EF',
                              color: entry.role === 'teacher' ? '#7C5CBF' : '#2C6E6A',
                              textTransform: 'uppercase',
                            }}
                          >
                            {entry.role}
                          </span>
                        </td>
                        <td style={{ padding: '9px 12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          {entry.role === 'student' && entry.grade
                            ? `Grade ${entry.grade}${entry.class_letter ? `-${entry.class_letter}` : ''}`
                            : 'Faculty'}
                        </td>
                        <td style={{ padding: '9px 12px' }}>
                          <div style={{ fontWeight: 500, color: 'var(--neutral-dark)' }}>
                            {entry.reason || 'Unspecified'}
                          </div>
                          {entry.notes && (
                            <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                              "{entry.notes}"
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '9px 12px', fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          {entry.recorded_by_name}
                        </td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            onClick={() => handleDeleteRecord(entry.id, entry.person_name)}
                            style={{
                              padding: '3px 7px',
                              borderRadius: 4,
                              border: '1px solid #F5C6CB',
                              background: '#FDF1F0',
                              color: '#A83B38',
                              cursor: 'pointer',
                            }}
                            title="Delete Record"
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 4: DESIGNATED STAFF ACCESS MANAGEMENT (Admin Only)                */}
      {/* ========================================================================= */}
      {mode === 'admin' && adminSubTab === 'authorized_staff' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Header Banner */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              padding: '16px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldCheck size={20} style={{ color: '#2C6E6A' }} />
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--neutral-dark)' }}>
                  Authorized Late Entry Gate Officers
                </h3>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                Designated staff members gain access to the Late Entry Panel on their portal sidebar to record and manage arrivals at school gates.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsStaffModalOpen(true)}
              style={{
                height: 34,
                padding: '0 14px',
                borderRadius: 6,
                background: '#1A1A1A',
                color: '#FFFFFF',
                border: 'none',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Plus size={14} />
              <span>Authorize Staff Member</span>
            </button>
          </div>

          {/* List of Designated Officers */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 480px))',
              gap: 16,
            }}
          >
            {authorizedStaffMembers.length === 0 ? (
              <div
                style={{
                  gridColumn: '1 / -1',
                  background: '#FFFFFF',
                  border: '1px dashed var(--border-color)',
                  borderRadius: 10,
                  padding: '48px 20px',
                  textAlign: 'center',
                  color: 'var(--text-secondary)',
                  fontSize: 13,
                }}
              >
                <ShieldCheck size={36} style={{ margin: '0 auto 10px', color: '#CBD5E1', display: 'block' }} />
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--neutral-dark)', marginBottom: 4 }}>
                  No Designated Staff Members
                </div>
                <div>Click "Authorize Staff Member" above to assign gate duty access to a teacher or staff member.</div>
              </div>
            ) : (
              authorizedStaffMembers.map((staff) => (
                <div
                  key={staff.id}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid var(--border-color)',
                    borderRadius: 10,
                    padding: '18px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 14,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                  }}
                >
                  {/* Card Top: Avatar, Name, Faculty & Badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 8,
                          background: '#EAF3EF',
                          border: '1px solid #C7E4D8',
                          color: '#2C6E6A',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: 16,
                          flexShrink: 0,
                          overflow: 'hidden',
                        }}
                      >
                        {staff.avatar_url ? (
                          <img
                            src={staff.avatar_url}
                            alt={staff.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          staff.name.charAt(0).toUpperCase()
                        )}
                      </div>

                      <div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--neutral-dark)', lineHeight: 1.3 }}>
                          {staff.name}
                        </div>
                        <div style={{ fontSize: 12, color: '#2C6E6A', fontWeight: 600, marginTop: 2 }}>
                          {staff.subject ? `Faculty: ${staff.subject}` : staff.role.toUpperCase()}
                        </div>
                      </div>
                    </div>

                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        padding: '3px 8px',
                        borderRadius: 5,
                        background: '#EAF3EF',
                        color: '#2C6E6A',
                        border: '1px solid #C7E4D8',
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: '#10B981',
                          display: 'inline-block',
                        }}
                      />
                      Gate Duty
                    </span>
                  </div>

                  {/* Card Body: Email & Capabilities */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: 12,
                        color: 'var(--text-secondary)',
                        background: '#FAF9F6',
                        padding: '7px 10px',
                        borderRadius: 6,
                        border: '1px solid #E5E3DF',
                      }}
                    >
                      <Mail size={13} style={{ color: '#8C8A84', flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500, color: 'var(--neutral-dark)' }}>
                        {staff.email}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 600,
                          padding: '2px 7px',
                          borderRadius: 4,
                          background: '#F0FDF4',
                          color: '#166534',
                          border: '1px solid #BBF7D0',
                        }}
                      >
                        ✓ Gate Desk Access
                      </span>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 600,
                          padding: '2px 7px',
                          borderRadius: 4,
                          background: '#F0FDF4',
                          color: '#166534',
                          border: '1px solid #BBF7D0',
                        }}
                      >
                        ✓ Log Arrivals
                      </span>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 600,
                          padding: '2px 7px',
                          borderRadius: 4,
                          background: '#F0FDF4',
                          color: '#166534',
                          border: '1px solid #BBF7D0',
                        }}
                      >
                        ✓ Search Directory
                      </span>
                    </div>
                  </div>

                  {/* Card Footer: Status & Revoke Button */}
                  <div
                    style={{
                      paddingTop: 12,
                      borderTop: '1px solid var(--border-color)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      Authority: <strong style={{ color: 'var(--neutral-dark)' }}>Active Duty Officer</strong>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleStaff(staff.id, staff.name, false)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        border: '1px solid #FCA5A5',
                        background: '#FEF2F2',
                        color: '#DC2626',
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Trash2 size={13} />
                      <span>Revoke Access</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: AUTHORIZE STAFF MEMBER MODAL                                      */}
      {/* ========================================================================= */}
      {isStaffModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            padding: 16,
          }}
          onClick={() => setIsStaffModalOpen(false)}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 8,
              border: '1px solid var(--border-color)',
              width: '100%',
              maxWidth: 480,
              overflow: 'hidden',
              boxShadow: '0 16px 36px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '14px 18px',
                background: '#FAF9F6',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--neutral-dark)' }}>
                Authorize Staff for Late Entry Panel
              </h3>
              <button
                type="button"
                onClick={() => setIsStaffModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
                Select a teacher or administrative staff member to grant duty access to the Late Entry Panel:
              </p>

              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: '#8C8A84' }} />
                <input
                  type="text"
                  placeholder="Filter teachers by name or email..."
                  value={staffSearch}
                  onChange={(e) => setStaffSearch(e.target.value)}
                  style={{
                    width: '100%',
                    height: 32,
                    paddingLeft: 30,
                    paddingRight: 10,
                    fontSize: 12,
                    borderRadius: 6,
                    border: '1px solid #E5E3DF',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {profiles
                  .filter(
                    (p) =>
                      !p.is_deactivated &&
                      (p.role === 'teacher' || p.role === 'admin') &&
                      !p.can_manage_late_entry &&
                      !authorizedStaffIds.includes(p.id)
                  )
                  .filter((p) => {
                    if (!staffSearch.trim()) return true;
                    const q = staffSearch.toLowerCase();
                    return p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q);
                  })
                  .map((p) => (
                    <div
                      key={p.id}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 8,
                        border: '1px solid #E5E3DF',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: '#FAF9F6',
                        gap: 12,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 6,
                            background: '#EAF3EF',
                            color: '#2C6E6A',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: 13,
                            flexShrink: 0,
                          }}
                        >
                          {p.name.charAt(0)}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--neutral-dark)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.name}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.email} • {p.role.toUpperCase()} {p.subject ? `(${p.subject})` : ''}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={async () => {
                          await handleToggleStaff(p.id, p.name, true);
                          setIsStaffModalOpen(false);
                        }}
                        style={{
                          padding: '6px 14px',
                          borderRadius: 6,
                          background: '#1A1A1A',
                          color: '#FFFFFF',
                          border: 'none',
                          fontSize: 11.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}
                      >
                        Grant Access
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: EDIT LATE ENTRY RECORD MODAL                                     */}
      {/* ========================================================================= */}
      {editingRecord && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            padding: 16,
          }}
          onClick={() => setEditingRecord(null)}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 8,
              border: '1px solid var(--border-color)',
              width: '100%',
              maxWidth: 440,
              overflow: 'hidden',
              boxShadow: '0 16px 36px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '14px 18px',
                background: '#FAF9F6',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--neutral-dark)' }}>
                Edit Late Arrival Record
              </h3>
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 12.5, color: 'var(--neutral-dark)' }}>
                Record for: <strong>{editingRecord.person_name}</strong> ({editingRecord.date})
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--neutral-dark)', marginBottom: 5 }}>
                  Arrival Time
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                  <CustomSelect
                    value={parsedEditTime.hour}
                    onChange={(val) => setEditTime(`${val}:${parsedEditTime.minute} ${parsedEditTime.period}`)}
                    options={HOUR_OPTIONS}
                    compact
                    menuWidth={70}
                    buttonStyle={{ height: 32, fontSize: 12, borderRadius: 6, borderColor: '#E5E3DF', padding: '0 8px' }}
                  />
                  <CustomSelect
                    value={parsedEditTime.minute}
                    onChange={(val) => setEditTime(`${parsedEditTime.hour}:${val} ${parsedEditTime.period}`)}
                    options={getMinuteOptions(parsedEditTime.minute)}
                    compact
                    menuWidth={70}
                    buttonStyle={{ height: 32, fontSize: 12, borderRadius: 6, borderColor: '#E5E3DF', padding: '0 8px' }}
                  />
                  <CustomSelect
                    value={parsedEditTime.period}
                    onChange={(val) => setEditTime(`${parsedEditTime.hour}:${parsedEditTime.minute} ${val}`)}
                    options={PERIOD_OPTIONS}
                    compact
                    menuWidth={70}
                    buttonStyle={{ height: 32, fontSize: 12, borderRadius: 6, borderColor: '#E5E3DF', padding: '0 8px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--neutral-dark)', marginBottom: 5 }}>
                  Reason
                </label>
                <input
                  type="text"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  style={{
                    width: '100%',
                    height: 32,
                    padding: '0 10px',
                    fontSize: 12,
                    borderRadius: 6,
                    border: '1px solid #E5E3DF',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--neutral-dark)', marginBottom: 5 }}>
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: 12,
                    borderRadius: 6,
                    border: '1px solid #E5E3DF',
                    outline: 'none',
                    boxSizing: 'border-box',
                    resize: 'none',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  style={{
                    height: 32,
                    padding: '0 12px',
                    borderRadius: 6,
                    background: '#FFFFFF',
                    border: '1px solid #E5E3DF',
                    fontSize: 11.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditRecord}
                  style={{
                    height: 32,
                    padding: '0 14px',
                    borderRadius: 6,
                    background: '#1A1A1A',
                    color: '#FFFFFF',
                    border: 'none',
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: INDIVIDUAL LATE HISTORY DRILLDOWN                                */}
      {/* ========================================================================= */}
      {selectedFrequencyItem && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            padding: 16,
          }}
          onClick={() => setSelectedFrequencyItem(null)}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 8,
              border: '1px solid var(--border-color)',
              width: '100%',
              maxWidth: 560,
              overflow: 'hidden',
              boxShadow: '0 16px 36px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '14px 18px',
                background: '#FAF9F6',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--neutral-dark)' }}>
                  Late Arrival Timeline: {selectedFrequencyItem.personName}
                </h3>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Total Recorded Entries: <strong>{selectedFrequencyItem.count}</strong>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFrequencyItem(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '16px 18px', maxHeight: 360, overflowY: 'auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selectedFrequencyItem.entries.map((ent) => (
                  <div
                    key={ent.id}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 6,
                      background: '#FAF9F6',
                      border: '1px solid #E5E3DF',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                          {ent.date}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: 4,
                            background: '#FDF1F0',
                            color: '#A83B38',
                          }}
                        >
                          {ent.time}
                        </span>
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 3 }}>
                        Reason: <strong>{ent.reason || 'Unspecified'}</strong>
                      </div>
                      {ent.notes && (
                        <div style={{ fontSize: 11, color: '#888580', fontStyle: 'italic', marginTop: 2 }}>
                          "{ent.notes}"
                        </div>
                      )}
                    </div>

                    <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', textAlign: 'right' }}>
                      Logged by:
                      <div style={{ fontWeight: 600, color: 'var(--neutral-dark)' }}>
                        {ent.recorded_by_name}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}


    </div>
  );
};
