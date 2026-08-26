'use client';

import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import {
  X,
  MessageSquare,
  BarChart3,
  Save,
  Calendar,
  ArrowLeft,
  Search,
  Download,
  SlidersHorizontal,
  TrendingUp,
  Award,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  Users,
  Percent,
  Grid,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase, SubjectClass, UserProfile } from '@/lib/supabaseClient';
import { getStoredGradeTerms } from '../Admin/AdminAssessmentTermsView';

// ── Types ───────────────────────────────────────────────────────────────────

export type Assessment = {
  id: string;
  title: string;
  assessment_date: string;
  maximum_marks: number;
  notes?: string;
};

export type MarkData = {
  marks: string;
  teacher_note: string;
  is_visible_to_student: boolean;
};

export type GridData = Record<string, Record<string, MarkData>>;

type ViewMode = 'letter' | 'percentage';
type SortOption = 'name_asc' | 'name_desc' | 'adm_asc' | 'score_desc' | 'score_asc';

// ── Helper to extract numeric grade from class ──────────────────────────────

export function extractGradeFromClass(cls: SubjectClass | string | null | undefined): string {
  if (!cls) return '10';
  const str = typeof cls === 'string' ? cls : `${cls.class_name || ''} ${cls.name || ''}`;
  const m = str.match(/\b(9|10|11|12)\b/i) || str.match(/Grade\s*(\d+)/i) || str.match(/(\d+)/);
  return m ? m[1] : '10';
}

// ── Woodlem Theme Helpers ───────────────────────────────────────────────────

function getWoodlemGrade(marks: string, max: number) {
  if (marks === '' || isNaN(Number(marks))) return null;
  const num = Number(marks);
  const pct = (num / max) * 100;

  if (pct >= 90) {
    return { letter: 'A+', label: 'Outstanding', color: '#265E5A', bg: '#EAF3EF', border: '#C7E4D8' };
  }
  if (pct >= 80) {
    return { letter: 'A', label: 'Excellent', color: '#2C6E6A', bg: '#EDF5F2', border: '#C7E4D8' };
  }
  if (pct >= 70) {
    return { letter: 'B', label: 'Very Good', color: '#2B5B75', bg: '#EBF3F7', border: '#C8DCE5' };
  }
  if (pct >= 60) {
    return { letter: 'C', label: 'Good', color: '#9E6835', bg: '#FEF7EC', border: '#F3D9A0' };
  }
  if (pct >= 50) {
    return { letter: 'D', label: 'Pass', color: '#B37D4A', bg: '#FBF6F0', border: '#ECD8C3' };
  }
  return { letter: 'F', label: 'Needs Support', color: '#D9534F', bg: '#FDF1F0', border: '#F5C6CB' };
}

function fmtDate(iso: string) {
  if (!iso) return '';
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

const QUICK_FEEDBACK_CHIPS = [
  'Outstanding performance! 🌟',
  'Good conceptual clarity. 👏',
  'Consistent effort, well done! 👍',
  'Needs revision on core topics. 📝',
  'Incomplete calculations/steps.',
  'Absent on exam day. ❌',
];

// ── Component ───────────────────────────────────────────────────────────────

export function MarkEntryModal({
  isOpen,
  onClose,
  classRoom,
  teacher,
  profiles,
  inline = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  classRoom: SubjectClass | null;
  teacher: UserProfile;
  profiles: UserProfile[];
  inline?: boolean;
}) {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [gridData, setGridData] = useState<GridData>({});
  const [initialSnapshot, setInitialSnapshot] = useState<string>('{}');

  // Toolbar state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('name_asc');
  const [viewMode, setViewMode] = useState<ViewMode>('letter');
  const [showBatchMenu, setShowBatchMenu] = useState(false);

  // Comment popover state
  const [activeCommentKey, setActiveCommentKey] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const batchRef = useRef<HTMLDivElement>(null);
  const commentRef = useRef<HTMLDivElement>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const classGrade = useMemo(() => extractGradeFromClass(classRoom), [classRoom]);

  // ── Enrolled Students ───────────────────────────────────────────────────
  const enrolledStudents = useMemo(() =>
    profiles.filter(
      p => p.role === 'student' && (classRoom?.enrolled_student_ids || []).includes(p.id)
    ),
    [profiles, classRoom]
  );

  // ── Student Summary Stats ───────────────────────────────────────────────
  const studentStatsMap = useMemo(() => {
    const map: Record<string, { totalScored: number; totalMax: number; percentage: number; gradedCount: number }> = {};

    enrolledStudents.forEach(s => {
      let totalScored = 0;
      let totalMax = 0;
      let gradedCount = 0;

      assessments.forEach(a => {
        const md = gridData[s.id]?.[a.id];
        if (md && md.marks !== '' && !isNaN(Number(md.marks))) {
          totalScored += Number(md.marks);
          totalMax += a.maximum_marks;
          gradedCount += 1;
        }
      });

      const percentage = totalMax > 0 ? (totalScored / totalMax) * 100 : 0;
      map[s.id] = { totalScored, totalMax, percentage, gradedCount };
    });

    return map;
  }, [enrolledStudents, assessments, gridData]);

  // ── Filter & Sort Students ──────────────────────────────────────────────
  const displayedStudents = useMemo(() => {
    let list = [...enrolledStudents];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        s =>
          s.name.toLowerCase().includes(q) ||
          (s.admission_number && s.admission_number.toLowerCase().includes(q)) ||
          (s.email && s.email.toLowerCase().includes(q))
      );
    }

    list.sort((a, b) => {
      if (sortOption === 'name_asc') return a.name.localeCompare(b.name);
      if (sortOption === 'name_desc') return b.name.localeCompare(a.name);
      if (sortOption === 'adm_asc') {
        const adA = a.admission_number || '';
        const adB = b.admission_number || '';
        return adA.localeCompare(adB, undefined, { numeric: true });
      }
      if (sortOption === 'score_desc') {
        const pctA = studentStatsMap[a.id]?.percentage || 0;
        const pctB = studentStatsMap[b.id]?.percentage || 0;
        return pctB - pctA;
      }
      if (sortOption === 'score_asc') {
        const pctA = studentStatsMap[a.id]?.percentage || 0;
        const pctB = studentStatsMap[b.id]?.percentage || 0;
        return pctA - pctB;
      }
      return 0;
    });

    return list;
  }, [enrolledStudents, searchQuery, sortOption, studentStatsMap]);

  // ── Overall KPIs ────────────────────────────────────────────────────────
  const overallKPIs = useMemo(() => {
    if (!assessments.length || !enrolledStudents.length) {
      return {
        classAverage: 0,
        highestScore: null as { studentName: string; score: number; max: number; pct: number } | null,
        passRate: 0,
        gradedCells: 0,
        totalCells: assessments.length * enrolledStudents.length,
        completionPct: 0,
      };
    }

    let allScoredMarks = 0;
    let allMaxMarks = 0;
    let gradedCells = 0;
    let passingCells = 0;

    let highest: { studentName: string; score: number; max: number; pct: number } | null = null;

    enrolledStudents.forEach(s => {
      assessments.forEach(a => {
        const md = gridData[s.id]?.[a.id];
        if (md && md.marks !== '' && !isNaN(Number(md.marks))) {
          const score = Number(md.marks);
          allScoredMarks += score;
          allMaxMarks += a.maximum_marks;
          gradedCells += 1;

          const pct = (score / a.maximum_marks) * 100;
          if (pct >= 50) passingCells += 1;

          if (!highest || pct > highest.pct) {
            highest = { studentName: s.name, score, max: a.maximum_marks, pct };
          }
        }
      });
    });

    const totalCells = assessments.length * enrolledStudents.length;
    const classAverage = allMaxMarks > 0 ? (allScoredMarks / allMaxMarks) * 100 : 0;
    const passRate = gradedCells > 0 ? (passingCells / gradedCells) * 100 : 0;
    const completionPct = totalCells > 0 ? Math.round((gradedCells / totalCells) * 100) : 0;

    return {
      classAverage,
      highestScore: highest,
      passRate,
      gradedCells,
      totalCells,
      completionPct,
    };
  }, [assessments, enrolledStudents, gridData]);

  const isDirty = useMemo(() => {
    return JSON.stringify(gridData) !== initialSnapshot;
  }, [gridData, initialSnapshot]);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(prev => (prev?.text === text ? null : prev));
    }, 4000);
  };

  // ── Load from DB (Sync Grade-wise assessments automatically) ───────────────
  const load = useCallback(async () => {
    if (!classRoom) return;

    try {
      const targetGrade = extractGradeFromClass(classRoom);

      // 1. Check existing assessments for this specific class
      let { data: assData, error: assErr } = await supabase
        .from('offline_assessments')
        .select('*')
        .eq('class_id', classRoom.id)
        .order('assessment_date', { ascending: true });

      if (assErr) {
        showToast('Failed to load assessments from database.', 'error');
        return;
      }

      // 2. If no assessments found for this class, check Master Store or other classrooms in this grade
      if (!assData || assData.length === 0) {
        const storedMasterTerms = getStoredGradeTerms()[targetGrade] || [];
        let termsToSeed: { title: string; maximum_marks: number }[] = storedMasterTerms.map(t => ({
          title: t.title,
          maximum_marks: t.maximum_marks,
        }));

        if (termsToSeed.length === 0) {
          const { data: gradeTerms } = await supabase
            .from('offline_assessments')
            .select('title, maximum_marks')
            .like('id', `offline_term_g${targetGrade}_%`)
            .limit(20);

          if (gradeTerms && gradeTerms.length > 0) {
            const seen = new Set<string>();
            termsToSeed = gradeTerms.filter(t => {
              if (seen.has(t.title)) return false;
              seen.add(t.title);
              return true;
            });
          }
        }

        if (termsToSeed.length > 0) {
          const newRows = termsToSeed.map(t => {
            const baseSlug = t.title.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30);
            return {
              id: `offline_term_g${targetGrade}_${baseSlug}_${classRoom.id}`,
              class_id: classRoom.id,
              teacher_id: classRoom.teacher_id || teacher.id,
              title: t.title,
              assessment_date: new Date().toISOString().slice(0, 10),
              maximum_marks: t.maximum_marks,
              notes: '',
            };
          });

          await supabase
            .from('offline_assessments')
            .upsert(newRows as never[], { onConflict: 'id' });

          const recheck = await supabase
            .from('offline_assessments')
            .select('*')
            .eq('class_id', classRoom.id);

          assData = recheck.data || [];
        }
      }

      setAssessments(assData || []);

      if (!assData || assData.length === 0) {
        setGridData({});
        setInitialSnapshot('{}');
        return;
      }

      const { data: marksData } = await supabase
        .from('offline_assessment_marks')
        .select('*')
        .in(
          'assessment_id',
          assData.map(a => a.id)
        );

      const nextGrid: GridData = {};
      enrolledStudents.forEach(s => {
        nextGrid[s.id] = {};
        assData!.forEach(a => {
          const m = (marksData || []).find(x => x.student_id === s.id && x.assessment_id === a.id);
          nextGrid[s.id][a.id] = {
            marks: m?.marks !== undefined && m?.marks !== null ? String(m.marks) : '',
            teacher_note: m?.teacher_note ?? '',
            is_visible_to_student: true,
          };
        });
      });

      setGridData(nextGrid);
      setInitialSnapshot(JSON.stringify(nextGrid));
    } catch {
      showToast('Error connecting to offline marks register.', 'error');
    }
  }, [classRoom, enrolledStudents, teacher.id]);

  useEffect(() => {
    if (isOpen) {
      setToastMessage(null);
      setActiveCommentKey(null);
      setShowBatchMenu(false);
      load();
    }
  }, [isOpen, classRoom?.id, load]);

  // ── Popover click outside listener ───────────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (batchRef.current && !batchRef.current.contains(e.target as Node)) {
        setShowBatchMenu(false);
      }
      if (commentRef.current && !commentRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement;
        if (!target.closest('.comment-trigger-btn')) {
          setActiveCommentKey(null);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen || !classRoom) return null;

  // ── Column Stats Helper ──────────────────────────────────────────────────
  const getColStats = (assessmentId: string, max: number) => {
    const scores: number[] = [];

    Object.values(gridData).forEach(m => {
      const v = m[assessmentId];
      if (v && v.marks !== '' && !isNaN(Number(v.marks))) {
        scores.push(Number(v.marks));
      }
    });

    if (!scores.length) {
      return {
        avg: '—',
        high: '—',
        low: '—',
        pass: '—',
        graded: 0,
        total: enrolledStudents.length,
      };
    }

    const sum = scores.reduce((a, b) => a + b, 0);
    const pass = scores.filter(s => s >= max * 0.5).length;
    const avgNum = sum / scores.length;

    return {
      avg: avgNum.toFixed(1),
      high: String(Math.max(...scores)),
      low: String(Math.min(...scores)),
      pass: `${Math.round((pass / scores.length) * 100)}%`,
      graded: scores.length,
      total: enrolledStudents.length,
    };
  };

  // ── Cell Setter ──────────────────────────────────────────────────────────
  const setCell = (studentId: string, assessmentId: string, field: keyof MarkData, val: string | boolean) => {
    let finalVal = val;
    if (field === 'marks' && typeof val === 'string') {
      if (val !== '') {
        const assessment = assessments.find(x => x.id === assessmentId);
        const maxMarks = assessment ? assessment.maximum_marks : Infinity;
        const num = Number(val);
        if (!isNaN(num)) {
          if (num > maxMarks) {
            finalVal = String(maxMarks);
          } else if (num < 0) {
            finalVal = '0';
          }
        }
      }
    }

    setGridData(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [assessmentId]: {
          ...prev[studentId]?.[assessmentId],
          [field]: finalVal,
        },
      },
    }));
  };

  // ── Keyboard Navigation ──────────────────────────────────────────────────
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    studentIdx: number,
    assessmentIdx: number
  ) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) {
      let targetStudentIdx = studentIdx;
      let targetAssIdx = assessmentIdx;

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        targetStudentIdx = Math.max(0, studentIdx - 1);
      } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        targetStudentIdx = Math.min(displayedStudents.length - 1, studentIdx + 1);
      } else if (e.key === 'ArrowLeft' && e.currentTarget.selectionStart === 0) {
        e.preventDefault();
        targetAssIdx = Math.max(0, assessmentIdx - 1);
      } else if (e.key === 'ArrowRight' && e.currentTarget.selectionEnd === e.currentTarget.value.length) {
        e.preventDefault();
        targetAssIdx = Math.min(assessments.length - 1, assessmentIdx + 1);
      }

      if (targetStudentIdx !== studentIdx || targetAssIdx !== assessmentIdx) {
        const targetStudent = displayedStudents[targetStudentIdx];
        const targetAss = assessments[targetAssIdx];
        if (targetStudent && targetAss) {
          const key = `${targetStudent.id}_${targetAss.id}`;
          const el = inputRefs.current[key];
          if (el) {
            el.focus();
            el.select();
          }
        }
      }
    }
  };

  // ── Save Marks ───────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    const rows: object[] = [];

    Object.entries(gridData).forEach(([sid, amap]) => {
      Object.entries(amap).forEach(([aid, md]) => {
        const assessment = assessments.find(x => x.id === aid);
        const maxMarks = assessment ? assessment.maximum_marks : Infinity;
        let numMarks: number | null = null;

        if (md.marks !== '') {
          const parsed = Number(md.marks);
          if (!isNaN(parsed)) {
            numMarks = Math.min(maxMarks, Math.max(0, parsed));
          }
        }

        rows.push({
          id: `${aid}_${sid}`,
          assessment_id: aid,
          student_id: sid,
          marks: numMarks,
          teacher_note: md.teacher_note,
          is_visible_to_student: true,
          updated_at: new Date().toISOString(),
        });
      });
    });

    const { error } = await supabase
      .from('offline_assessment_marks')
      .upsert(rows as never[], { onConflict: 'assessment_id,student_id' });

    setSaving(false);

    if (error) {
      showToast(`Save failed: ${error.message}`, 'error');
      return;
    }

    setInitialSnapshot(JSON.stringify(gridData));
    showToast('Marks saved successfully!', 'success');

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('woodlem-marks-updated'));
    }
  };

  // ── Batch Tools ──────────────────────────────────────────────────────────
  const fillEmptyWithZero = () => {
    setGridData(prev => {
      const next = { ...prev };
      displayedStudents.forEach(s => {
        if (!next[s.id]) next[s.id] = {};
        assessments.forEach(a => {
          const current = next[s.id][a.id];
          if (!current || current.marks === '') {
            next[s.id][a.id] = {
              marks: '0',
              teacher_note: current?.teacher_note || '',
              is_visible_to_student: true,
            };
          }
        });
      });
      return next;
    });
    setShowBatchMenu(false);
    showToast('Filled empty cells with 0.', 'info');
  };

  // ── Excel Export ─────────────────────────────────────────────────────────
  const handleExportExcel = () => {
    try {
      const rows: Record<string, string | number>[] = [];

      displayedStudents.forEach((s, idx) => {
        const row: Record<string, string | number> = {
          '#': idx + 1,
          'Student Name': s.name,
          'Admission No': s.admission_number || '',
          Email: s.email || '',
        };

        assessments.forEach(a => {
          const md = gridData[s.id]?.[a.id];
          const score = md && md.marks !== '' ? Number(md.marks) : '';
          row[`${a.title} (Max ${a.maximum_marks})`] = score;
          if (md?.teacher_note) {
            row[`${a.title} [Note]`] = md.teacher_note;
          }
        });

        const st = studentStatsMap[s.id];
        row['Total Marks Scored'] = st ? st.totalScored : 0;
        row['Total Maximum'] = st ? st.totalMax : 0;
        row['Overall Percentage'] = st && st.totalMax > 0 ? `${st.percentage.toFixed(1)}%` : '—';

        rows.push(row);
      });

      const avgRow: Record<string, string | number> = {
        '#': '',
        'Student Name': '--- CLASS AVERAGE ---',
        'Admission No': '',
        Email: '',
      };
      const highRow: Record<string, string | number> = {
        '#': '',
        'Student Name': '--- HIGHEST SCORE ---',
        'Admission No': '',
        Email: '',
      };
      const passRow: Record<string, string | number> = {
        '#': '',
        'Student Name': '--- PASS RATE (>=50%) ---',
        'Admission No': '',
        Email: '',
      };

      assessments.forEach(a => {
        const stats = getColStats(a.id, a.maximum_marks);
        avgRow[`${a.title} (Max ${a.maximum_marks})`] = stats.avg;
        highRow[`${a.title} (Max ${a.maximum_marks})`] = stats.high;
        passRow[`${a.title} (Max ${a.maximum_marks})`] = stats.pass;
      });

      rows.push(avgRow, highRow, passRow);

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Marks Register');

      const fileName = `${classRoom.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_Marks_Register.xlsx`;
      XLSX.writeFile(workbook, fileName);
      showToast(`Exported ${fileName} successfully.`, 'success');
    } catch {
      showToast('Export failed. Please try again.', 'error');
    }
  };

  const handleClose = () => {
    if (isDirty) {
      if (!window.confirm('You have unsaved changes. Are you sure you want to return to class without saving?')) {
        return;
      }
    }
    onClose();
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      onClick={inline ? undefined : handleClose}
      style={
        inline
          ? {
              display: 'flex',
              flexDirection: 'column',
              width: '100%',
              minHeight: '100%',
              fontFamily: 'var(--font-label)',
              color: 'var(--neutral-dark)',
              boxSizing: 'border-box',
            }
          : {
              position: 'fixed',
              inset: 0,
              zIndex: 1200,
              background: 'rgba(30, 28, 25, 0.45)',
              backdropFilter: 'blur(6px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
              boxSizing: 'border-box',
            }
      }
    >
      <div
        onClick={inline ? undefined : e => e.stopPropagation()}
        style={
          inline
            ? {
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                flex: 1,
              }
            : {
                width: 'min(1260px, 96vw)',
                maxHeight: '92vh',
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--neutral-bg)',
                borderRadius: 16,
                border: '1px solid var(--border-color)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
                padding: '24px 28px',
                overflowY: 'auto',
                boxSizing: 'border-box',
              }
        }
      >
        {/* ── TOAST MESSAGE ─────────────────────────────────────────── */}
        {toastMessage && (
          <div
            style={{
              position: 'fixed',
              top: 24,
              right: 32,
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 18px',
              borderRadius: 8,
              background:
                toastMessage.type === 'success'
                  ? '#EAF3EF'
                  : toastMessage.type === 'error'
                  ? '#FDF1F0'
                  : 'var(--surface)',
              color:
                toastMessage.type === 'success'
                  ? '#265E5A'
                  : toastMessage.type === 'error'
                  ? '#D9534F'
                  : 'var(--neutral-dark)',
              border: `1px solid ${
                toastMessage.type === 'success'
                  ? '#C7E4D8'
                  : toastMessage.type === 'error'
                  ? '#F5C6CB'
                  : 'var(--border-color)'
              }`,
              fontSize: 13,
              fontWeight: 600,
              boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            }}
          >
            {toastMessage.type === 'success' && <CheckCircle2 size={16} color="#2C6E6A" />}
            {toastMessage.type === 'error' && <AlertCircle size={16} color="#D9534F" />}
            <span>{toastMessage.text}</span>
            <button
              onClick={() => setToastMessage(null)}
              style={{
                border: 0,
                background: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: 2,
                marginLeft: 4,
              }}
            >
              <X size={13} />
            </button>
          </div>
        )}

        {/* ── 1. HEADER (WOODLEM LMS CLASSROOM HEADER PATTERN) ──────── */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 20,
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div>
            {/* Subject Pill & Target */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: 4,
                  background: '#EAF3EF',
                  color: '#2D6E5D',
                  border: '1px solid #C7E4D8',
                  textTransform: 'uppercase',
                }}
              >
                {classRoom.subject || 'Subject Class'}
              </span>

              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Target: {classRoom.class_name} {classRoom.room ? `| ${classRoom.room}` : ''} (Grade {classGrade})
              </span>

              {isDirty ? (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: '#FEF7EC',
                    color: '#B37D4A',
                    border: '1px solid #F3D9A0',
                  }}
                >
                  ● Unsaved Edits
                </span>
              ) : (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: '#EAF3EF',
                    color: '#265E5A',
                    border: '1px solid #C7E4D8',
                  }}
                >
                  ✓ All Saved
                </span>
              )}
            </div>

            {/* Page Title */}
            <h1 className="page-title" style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>
              {classRoom.name} — Marks Register
            </h1>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              {enrolledStudents.length} enrolled student{enrolledStudents.length !== 1 ? 's' : ''} · {assessments.length} assessment column{assessments.length !== 1 ? 's' : ''} for Grade {classGrade}
            </div>
          </div>

          {/* Action Buttons Header Group */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={handleExportExcel}
              disabled={enrolledStudents.length === 0 || assessments.length === 0}
              className="btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 12px',
                fontSize: 12,
                borderRadius: 8,
                cursor: enrolledStudents.length === 0 || assessments.length === 0 ? 'not-allowed' : 'pointer',
                opacity: enrolledStudents.length === 0 || assessments.length === 0 ? 0.6 : 1,
              }}
              title="Download Excel spreadsheet"
            >
              <Download size={14} />
              <span>Export</span>
            </button>

            <button
              onClick={handleSave}
              disabled={saving || assessments.length === 0}
              className="btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 16px',
                fontSize: 12,
                borderRadius: 8,
                cursor: saving || assessments.length === 0 ? 'not-allowed' : 'pointer',
                opacity: assessments.length === 0 ? 0.6 : 1,
              }}
            >
              <Save size={14} />
              <span>{saving ? 'Saving...' : 'Save Marks'}</span>
            </button>

            <button
              onClick={handleClose}
              className="btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 12px',
                fontSize: 12,
                borderRadius: 8,
                cursor: 'pointer',
              }}
              title="Return to Class Stream"
            >
              <ArrowLeft size={14} />
              <span>Back to Class</span>
            </button>
          </div>
        </div>

        {/* ── 2. ANALYTICS ROW (WOODLEM STAT-BOX STYLE) ─────────────── */}
        {assessments.length > 0 && enrolledStudents.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 14,
              marginBottom: 16,
            }}
          >
            {/* Stat 1: Class Average */}
            <div className="stat-box" style={{ padding: '14px 18px', borderRadius: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="stat-sub" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Class Average
                </span>
                <TrendingUp size={15} color="#2C6E6A" />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                  {overallKPIs.classAverage > 0 ? `${overallKPIs.classAverage.toFixed(1)}%` : '—'}
                </span>
              </div>
            </div>

            {/* Stat 2: Top Score */}
            <div className="stat-box" style={{ padding: '14px 18px', borderRadius: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="stat-sub" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Top Score
                </span>
                <Award size={15} color="#2C6E6A" />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: '#265E5A' }}>
                  {overallKPIs.highestScore ? `${overallKPIs.highestScore.pct.toFixed(0)}%` : '—'}
                </span>
                {overallKPIs.highestScore && (
                  <span
                    style={{
                      fontSize: 11.5,
                      color: 'var(--text-secondary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: 120,
                    }}
                    title={overallKPIs.highestScore.studentName}
                  >
                    {overallKPIs.highestScore.studentName}
                  </span>
                )}
              </div>
            </div>

            {/* Stat 3: Pass Rate */}
            <div className="stat-box" style={{ padding: '14px 18px', borderRadius: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="stat-sub" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Pass Rate (≥ 50%)
                </span>
                <BarChart3 size={15} color="var(--text-secondary)" />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                  {overallKPIs.gradedCells > 0 ? `${overallKPIs.passRate.toFixed(0)}%` : '—'}
                </span>
                <div style={{ flex: 1, height: 5, background: 'var(--surface-variant)', borderRadius: 3, overflow: 'hidden', maxWidth: 70 }}>
                  <div
                    style={{
                      width: `${overallKPIs.passRate}%`,
                      height: '100%',
                      background: overallKPIs.passRate >= 70 ? '#2C6E6A' : overallKPIs.passRate >= 50 ? '#D4A373' : '#D9534F',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Stat 4: Graded Entries */}
            <div className="stat-box" style={{ padding: '14px 18px', borderRadius: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="stat-sub" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Graded Progress
                </span>
                <CheckCircle2 size={15} color="#2C6E6A" />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                  {overallKPIs.completionPct}%
                </span>
                <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                  ({overallKPIs.gradedCells} / {overallKPIs.totalCells})
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── 3. TOOLBAR (SEARCH, SORT, VIEW MODES) ─────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 16,
            background: 'var(--surface)',
            padding: '12px 16px',
            borderRadius: 12,
            border: '1px solid var(--border-color)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          {/* Left: Search & Sort */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={14} style={{ position: 'absolute', left: 12, color: 'var(--text-secondary)', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Search student or roll no..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="form-input"
                style={{
                  padding: '8px 12px 8px 34px',
                  fontSize: 13,
                  width: 240,
                  height: 38,
                  borderRadius: 8,
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{ position: 'absolute', right: 10, border: 0, background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Sort:</span>
              <select
                value={sortOption}
                onChange={e => setSortOption(e.target.value as SortOption)}
                style={{
                  padding: '8px 12px',
                  fontSize: 13,
                  borderRadius: 8,
                  border: '1px solid var(--border-color)',
                  background: 'var(--surface)',
                  color: 'var(--neutral-dark)',
                  fontFamily: 'inherit',
                  height: 38,
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                <option value="name_asc">Name (A → Z)</option>
                <option value="name_desc">Name (Z → A)</option>
                <option value="adm_asc">Roll / Admission No.</option>
                <option value="score_desc">Overall Score (High → Low)</option>
                <option value="score_asc">Overall Score (Low → High)</option>
              </select>
            </div>
          </div>

          {/* Right: Batch Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Batch Menu */}
            <div style={{ position: 'relative' }} ref={batchRef}>
              <button
                onClick={() => setShowBatchMenu(!showBatchMenu)}
                className="btn-secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '0 14px',
                  fontSize: 13,
                  fontWeight: 600,
                  height: 38,
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                <SlidersHorizontal size={14} />
                <span>Batch Actions</span>
              </button>

              {showBatchMenu && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: 6,
                    background: '#FFFFFF',
                    border: '1px solid var(--border-color)',
                    borderRadius: 10,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    zIndex: 100,
                    minWidth: 200,
                    padding: '6px 0',
                  }}
                >
                  <button
                    onClick={() => fillEmptyWithZero()}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '10px 14px',
                      border: 0,
                      background: 'transparent',
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--neutral-dark)',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <RotateCcw size={14} /> Fill Empty Cells with 0
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── 4. SPREADSHEET CARD (WOODLEM PANEL-BLOCK STYLE) ───────── */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid var(--border-color)',
            borderRadius: 12,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 380,
            position: 'relative',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
          }}
        >
          {assessments.length === 0 ? (
            /* No Assessments for this Grade State (Admin controls terms) */
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '60px 20px',
                textAlign: 'center',
                gap: 14,
                flex: 1,
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'rgba(44, 110, 106, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary)',
                }}
              >
                <BarChart3 size={28} />
              </div>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--neutral-dark)', margin: 0 }}>
                  No Assessment Terms Configured for Grade {classGrade}
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8, maxWidth: 460, lineHeight: 1.5 }}>
                  Assessment terms (e.g. Periodic Tests, Half-Yearly, Final Exams) are configured centrally by the school administration for Grade {classGrade}.
                  Once configured in the Admin Dashboard, they will automatically appear here for mark entry.
                </p>
              </div>
            </div>
          ) : enrolledStudents.length === 0 ? (
            /* Empty Students State */
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '60px 20px',
                textAlign: 'center',
                gap: 14,
                flex: 1,
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'rgba(44, 110, 106, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary)',
                }}
              >
                <Users size={28} />
              </div>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--neutral-dark)', margin: 0 }}>
                  No Enrolled Students
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8, maxWidth: 400, lineHeight: 1.5 }}>
                  Please enroll students in this classroom from the class settings before entering marks.
                </p>
              </div>
            </div>
          ) : (
            /* Spreadsheet Table */
            <div style={{ overflow: 'auto', flex: 1, width: '100%' }}>
              <table style={{ width: '100%', minWidth: 'max-content', borderCollapse: 'collapse', fontSize: 12 }}>
                {/* ── Table Header ── */}
                <thead>
                  <tr style={{ background: '#F8F7F4', borderBottom: '1px solid var(--border-color)' }}>
                    {/* Frozen Student Header */}
                    <th
                      style={{
                        position: 'sticky',
                        left: 0,
                        top: 0,
                        zIndex: 25,
                        background: '#F8F7F4',
                        borderRight: '1px solid var(--border-color)',
                        borderBottom: '1px solid var(--border-color)',
                        padding: '12px 16px',
                        textAlign: 'left',
                        minWidth: 230,
                        width: 230,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          STUDENT ({displayedStudents.length})
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                          AVG %
                        </span>
                      </div>
                    </th>

                    {/* Assessment Headers */}
                    {assessments.map(a => {
                      const stats = getColStats(a.id, a.maximum_marks);

                      return (
                        <th
                          key={a.id}
                          style={{
                            position: 'sticky',
                            top: 0,
                            zIndex: 20,
                            background: '#F8F7F4',
                            borderRight: '1px solid var(--border-color)',
                            borderBottom: '1px solid var(--border-color)',
                            minWidth: 160,
                            padding: '10px 14px',
                            textAlign: 'center',
                            verticalAlign: 'top',
                            userSelect: 'none',
                          }}
                        >
                          <div style={{ position: 'relative' }}>
                            {/* Title */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 2 }}>
                              <span
                                style={{
                                  fontSize: 13,
                                  fontWeight: 700,
                                  color: 'var(--neutral-dark)',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                                title={a.title}
                              >
                                {a.title}
                              </span>
                            </div>

                            {/* Date & Max Marks */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginBottom: 6 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--text-secondary)' }}>
                                <Calendar size={10} />
                                <span>{fmtDate(a.assessment_date)}</span>
                              </div>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  padding: '1px 6px',
                                  borderRadius: 4,
                                  background: 'var(--surface-variant)',
                                  color: 'var(--neutral-dark)',
                                }}
                              >
                                Max {a.maximum_marks}
                              </span>
                            </div>

                            {/* Column Stats Chip */}
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 10.5,
                                color: 'var(--text-secondary)',
                                background: '#FFFFFF',
                                border: '1px solid var(--border-color)',
                                borderRadius: 4,
                                padding: '2px 6px',
                              }}
                            >
                              <span>Avg: <strong style={{ color: 'var(--neutral-dark)' }}>{stats.avg}</strong></span>
                            </div>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                {/* ── Table Body ── */}
                <tbody>
                  {displayedStudents.map((s, rowIdx) => {
                    const st = studentStatsMap[s.id];

                    return (
                      <tr
                        key={s.id}
                        style={{
                          background: rowIdx % 2 === 0 ? '#FFFFFF' : '#FAF9F6',
                          borderBottom: '1px solid #ECEAE5',
                        }}
                      >
                        {/* Frozen Student Profile Cell */}
                        <td
                          style={{
                            position: 'sticky',
                            left: 0,
                            zIndex: 10,
                            background: rowIdx % 2 === 0 ? '#FFFFFF' : '#FAF9F6',
                            borderRight: '1px solid var(--border-color)',
                            borderBottom: '1px solid #ECEAE5',
                            padding: '8px 14px',
                            minWidth: 230,
                            width: 230,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                              {/* Woodlem Avatar circle */}
                              <div
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: '50%',
                                  background: '#2C6E6A',
                                  color: '#FFFFFF',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  flexShrink: 0,
                                }}
                              >
                                {s.name.charAt(0).toUpperCase()}
                              </div>

                              <div style={{ minWidth: 0 }}>
                                <div
                                  style={{
                                    fontSize: 12.5,
                                    fontWeight: 600,
                                    color: 'var(--neutral-dark)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    maxWidth: 130,
                                  }}
                                  title={s.name}
                                >
                                  {s.name}
                                </div>
                                <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                                  {s.admission_number || s.email?.split('@')[0] || '—'}
                                </div>
                              </div>
                            </div>

                            {/* Overall Row Percentage */}
                            <span
                              style={{
                                fontSize: 11.5,
                                fontWeight: 700,
                                color:
                                  st && st.totalMax > 0
                                    ? st.percentage >= 70
                                      ? '#2C6E6A'
                                      : st.percentage >= 50
                                      ? '#B37D4A'
                                      : '#D9534F'
                                    : 'var(--text-secondary)',
                              }}
                            >
                              {st && st.totalMax > 0 ? `${st.percentage.toFixed(0)}%` : '—'}
                            </span>
                          </div>
                        </td>

                        {/* Assessment Score Cells */}
                        {assessments.map((a, aIdx) => {
                          const md = gridData[s.id]?.[a.id] || {
                            marks: '',
                            teacher_note: '',
                            is_visible_to_student: true,
                          };
                          const grade = getWoodlemGrade(md.marks, a.maximum_marks);
                          const isInvalid = md.marks !== '' && Number(md.marks) > a.maximum_marks;
                          const cellKey = `${s.id}_${a.id}`;
                          const isCommentOpen = activeCommentKey === cellKey;

                          return (
                            <td
                              key={a.id}
                              style={{
                                borderRight: '1px solid var(--border-color)',
                                borderBottom: '1px solid #ECEAE5',
                                padding: '4px 6px',
                                background: isInvalid ? '#FDF1F0' : 'transparent',
                                position: 'relative',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: 4,
                                  height: 40,
                                  padding: '0 4px',
                                }}
                              >
                                {/* Score Input */}
                                <input
                                  ref={el => {
                                    inputRefs.current[cellKey] = el;
                                  }}
                                  type="number"
                                  min={0}
                                  max={a.maximum_marks}
                                  step="any"
                                  value={md.marks}
                                  onChange={e => {
                                    const raw = e.target.value;
                                    if (raw === '') {
                                      setCell(s.id, a.id, 'marks', '');
                                      return;
                                    }
                                    const num = Number(raw);
                                    if (isNaN(num)) return;
                                    if (num > a.maximum_marks) {
                                      setCell(s.id, a.id, 'marks', String(a.maximum_marks));
                                      return;
                                    }
                                    if (num < 0) {
                                      setCell(s.id, a.id, 'marks', '0');
                                      return;
                                    }
                                    setCell(s.id, a.id, 'marks', raw);
                                  }}
                                  onKeyDown={e => {
                                    if (e.key === '-' || e.key === '+' || e.key === 'e' || e.key === 'E') {
                                      e.preventDefault();
                                    }
                                    handleKeyDown(e, rowIdx, aIdx);
                                  }}
                                  placeholder="—"
                                  style={{
                                    flex: 1,
                                    width: '100%',
                                    border: 'none',
                                    background: 'transparent',
                                    fontSize: 13.5,
                                    fontWeight: 700,
                                    color: isInvalid ? '#D9534F' : 'var(--neutral-dark)',
                                    textAlign: 'center',
                                    outline: 'none',
                                    fontFamily: 'inherit',
                                    padding: 0,
                                  }}
                                />

                                {/* Teacher Note Button */}
                                <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                                  <button
                                    type="button"
                                    className="comment-trigger-btn"
                                    onClick={() => setActiveCommentKey(isCommentOpen ? null : cellKey)}
                                    style={{
                                      width: 18,
                                      height: 18,
                                      borderRadius: 4,
                                      border: `1px solid ${md.teacher_note ? '#F3D9A0' : 'transparent'}`,
                                      background: md.teacher_note ? '#FEF7EC' : 'transparent',
                                      color: md.teacher_note ? '#B37D4A' : 'var(--text-secondary)',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      padding: 0,
                                      position: 'relative',
                                    }}
                                    title={md.teacher_note ? `Note: "${md.teacher_note}"` : 'Add note'}
                                  >
                                    <MessageSquare size={11} />
                                    {md.teacher_note && (
                                      <span
                                        style={{
                                          position: 'absolute',
                                          top: -1,
                                          right: -1,
                                          width: 4,
                                          height: 4,
                                          borderRadius: '50%',
                                          background: '#D4A373',
                                        }}
                                      />
                                    )}
                                  </button>
                                </div>
                              </div>

                              {/* Comment Popover */}
                              {isCommentOpen && (
                                <div
                                  ref={commentRef}
                                  style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    marginTop: 4,
                                    background: '#FFFFFF',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 8,
                                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                                    zIndex: 80,
                                    width: 260,
                                    padding: 12,
                                    textAlign: 'left',
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                    <div>
                                      <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>{s.name}</div>
                                      <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{a.title} Feedback</div>
                                    </div>
                                    <button onClick={() => setActiveCommentKey(null)} style={{ border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                      <X size={12} />
                                    </button>
                                  </div>

                                  {/* Quick Chips */}
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 6 }}>
                                    {QUICK_FEEDBACK_CHIPS.slice(0, 3).map((chip, cIdx) => (
                                      <button
                                        key={cIdx}
                                        type="button"
                                        onClick={() => {
                                          const prev = md.teacher_note.trim();
                                          setCell(s.id, a.id, 'teacher_note', prev ? `${prev} ${chip}` : chip);
                                        }}
                                        style={{
                                          fontSize: 9.5,
                                          padding: '2px 5px',
                                          borderRadius: 4,
                                          background: 'var(--surface-variant)',
                                          color: 'var(--neutral-dark)',
                                          border: '1px solid var(--border-color)',
                                          cursor: 'pointer',
                                        }}
                                      >
                                        {chip}
                                      </button>
                                    ))}
                                  </div>

                                  <textarea
                                    value={md.teacher_note}
                                    onChange={e => setCell(s.id, a.id, 'teacher_note', e.target.value)}
                                    placeholder="Private note for this student..."
                                    className="form-input"
                                    style={{
                                      width: '100%',
                                      padding: 6,
                                      fontSize: 11.5,
                                      minHeight: 52,
                                      boxSizing: 'border-box',
                                    }}
                                  />

                                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                                    <button
                                      type="button"
                                      onClick={() => setActiveCommentKey(null)}
                                      className="btn-primary"
                                      style={{ padding: '4px 12px', fontSize: 11, borderRadius: 4, cursor: 'pointer' }}
                                    >
                                      Done
                                    </button>
                                  </div>
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>

                {/* ── Summary Footer Rows ── */}
                <tfoot>
                  {[
                    { key: 'avg', label: 'Class Average', color: 'var(--neutral-dark)', bg: '#F8F7F4', borderTop: '2px solid var(--border-color)' },
                    { key: 'high', label: 'Highest Score', color: '#265E5A', bg: '#EDF5F2', borderTop: '1px solid #ECEAE5' },
                    { key: 'low', label: 'Lowest Score', color: '#D9534F', bg: '#FDF1F0', borderTop: '1px solid #ECEAE5' },
                    { key: 'pass', label: 'Pass Rate (≥ 50%)', color: 'var(--text-secondary)', bg: '#F8F7F4', borderTop: '1px solid #ECEAE5' },
                  ].map(row => (
                    <tr key={row.key} style={{ background: row.bg }}>
                      <td
                        style={{
                          position: 'sticky',
                          left: 0,
                          zIndex: 10,
                          background: row.bg,
                          borderRight: '1px solid var(--border-color)',
                          borderTop: row.borderTop,
                          padding: '8px 14px',
                          fontSize: 11,
                          fontWeight: 700,
                          color: 'var(--text-secondary)',
                          textTransform: 'uppercase',
                        }}
                      >
                        {row.label}
                      </td>

                      {assessments.map(a => {
                        const stats = getColStats(a.id, a.maximum_marks);
                        const val = (stats as Record<string, string | number | boolean>)[row.key];

                        return (
                          <td
                            key={a.id}
                            style={{
                              textAlign: 'center',
                              borderRight: '1px solid var(--border-color)',
                              borderTop: row.borderTop,
                              padding: '8px 10px',
                              fontSize: 12.5,
                              fontWeight: 700,
                              color: row.color,
                            }}
                          >
                            {String(val)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* ── 5. BOTTOM HELPER LEGEND ───────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 12,
            fontSize: 11.5,
            color: 'var(--text-secondary)',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <div>Use arrow keys or Enter for spreadsheet cell navigation</div>
        </div>
      </div>
    </div>
  );
}
