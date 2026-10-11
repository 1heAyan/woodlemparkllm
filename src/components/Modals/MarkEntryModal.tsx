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
import { getStoredGradeTerms, decodeAssessmentNotes, encodeMarkNote, decodeMarkNote } from '../Admin/AdminAssessmentTermsView';
import { CustomSelect, CustomSelectOption } from '../UI/CustomSelect';

// ── Types ───────────────────────────────────────────────────────────────────

export type Assessment = {
  id: string;
  title: string;
  assessment_date: string;
  maximum_marks: number;
  written_max_marks?: number;
  internal_max_marks?: number;
  notes?: string;
};

export type MarkData = {
  marks: string;
  written_marks?: string;
  internal_marks?: string;
  teacher_note: string;
  is_visible_to_student: boolean;
};

export type GridData = Record<string, Record<string, MarkData>>;

export type SheetColumn = {
  key: string;
  assessmentId: string;
  subType: 'single' | 'written' | 'internal' | 'total';
  headerLabel: string;
  max: number;
  isEditable: boolean;
  assessmentTitle: string;
};

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

// ── Attempt / score helpers ─────────────────────────────────────────────────
// An exam cell counts as "attempted" only when the student actually has a
// score value (single total, or written + internal split). Unattempted cells
// return null and are excluded from EVERY average/stat in this register.

function getCellScore(md: MarkData | undefined | null, a: Assessment): { scored: number; max: number } | null {
  if (!md) return null;
  const hasSplit = a.written_max_marks !== undefined && a.internal_max_marks !== undefined;
  if (hasSplit) {
    const w = md.written_marks !== '' && md.written_marks !== undefined ? Number(md.written_marks) : null;
    const i = md.internal_marks !== '' && md.internal_marks !== undefined ? Number(md.internal_marks) : null;
    if (w !== null && !isNaN(w) && i !== null && !isNaN(i)) {
      return { scored: Math.min(a.maximum_marks, Math.max(0, w + i)), max: a.maximum_marks };
    }
    return null;
  }
  if (md.marks !== '' && !isNaN(Number(md.marks))) {
    return { scored: Math.min(a.maximum_marks, Math.max(0, Number(md.marks))), max: a.maximum_marks };
  }
  return null;
}

function hasEnteredMark(md: MarkData | undefined | null): boolean {
  if (!md) return false;
  return (
    (md.marks !== undefined && md.marks !== '') ||
    (md.written_marks !== undefined && md.written_marks !== '') ||
    (md.internal_marks !== undefined && md.internal_marks !== '')
  );
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
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string>('');
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

  // ── Selected Term / Filtered Assessments ─────────────────────────────────
  const displayedAssessments = useMemo(() => {
    if (!selectedAssessmentId || selectedAssessmentId === 'all') {
      return assessments;
    }
    const found = assessments.find(a => a.id === selectedAssessmentId);
    return found ? [found] : assessments;
  }, [assessments, selectedAssessmentId]);

  // ── Enrolled Students ───────────────────────────────────────────────────
  const enrolledStudents = useMemo(() =>
    profiles.filter(
      p => p.role === 'student' && (classRoom?.enrolled_student_ids || []).includes(p.id)
    ),
    [profiles, classRoom]
  );

  // ── Student Summary Stats ───────────────────────────────────────────────
  // Only attempted exams (added marks) count — unattempted exams are excluded
  // so an empty cell never drags a student's average down.
  const studentStatsMap = useMemo(() => {
    const map: Record<
      string,
      { totalScored: number; totalMax: number; percentage: number; gradedCount: number; attemptedCount: number; totalAssessments: number }
    > = {};

    enrolledStudents.forEach(s => {
      let totalScored = 0;
      let totalMax = 0;
      let gradedCount = 0;

      assessments.forEach(a => {
        const score = getCellScore(gridData[s.id]?.[a.id], a);
        if (score) {
          totalScored += score.scored;
          totalMax += score.max;
          gradedCount += 1;
        }
      });

      const percentage = totalMax > 0 ? (totalScored / totalMax) * 100 : 0;
      map[s.id] = {
        totalScored,
        totalMax,
        percentage,
        gradedCount,
        attemptedCount: gradedCount,
        totalAssessments: assessments.length,
      };
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

  // ── Overall KPIs (computed for displayed assessments) ───────────────────
  const overallKPIs = useMemo(() => {
    const activeAss = displayedAssessments;
    if (!activeAss.length || !enrolledStudents.length) {
      return {
        classAverage: 0,
        highestScore: null as { studentName: string; score: number; max: number; pct: number } | null,
        passRate: 0,
        gradedCells: 0,
        totalCells: activeAss.length * enrolledStudents.length,
        completionPct: 0,
        attemptedCells: 0,
      };
    }

    let allScoredMarks = 0;
    let allMaxMarks = 0;
    let gradedCells = 0;
    let passingCells = 0;

    let highest: { studentName: string; score: number; max: number; pct: number } | null = null;

    enrolledStudents.forEach(s => {
      activeAss.forEach(a => {
        const score = getCellScore(gridData[s.id]?.[a.id], a);
        if (!score) return;

        allScoredMarks += score.scored;
        allMaxMarks += score.max;
        gradedCells += 1;

        const pct = (score.scored / score.max) * 100;
        if (pct >= 50) passingCells += 1;

        if (!highest || pct > highest.pct) {
          highest = { studentName: s.name, score: score.scored, max: score.max, pct };
        }
      });
    });

    const totalCells = activeAss.length * enrolledStudents.length;
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
      attemptedCells: gradedCells,
    };
  }, [displayedAssessments, enrolledStudents, gridData]);

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

      // 2. If no assessments found for this class, check Supabase Cloud Master Store or other classrooms in this grade
      if (!assData || assData.length === 0) {
        // Query Supabase cloud master terms for this grade
        const { data: cloudMasterData } = await supabase
          .from('achievements')
          .select('*')
          .eq('title', '__GRADE_ASSESSMENT_TERM__')
          .eq('student_id', targetGrade);

        let termsToSeed: { title: string; maximum_marks: number }[] = [];

        if (cloudMasterData && cloudMasterData.length > 0) {
          termsToSeed = cloudMasterData.map((m: any) => {
            let parsed: any = {};
            try { parsed = JSON.parse(m.desc_text || '{}'); } catch { parsed = {}; }
            return {
              title: parsed.title || m.file_name || 'Assessment',
              maximum_marks: Number(parsed.maximum_marks || m.file_url || 40),
              notes: parsed.notes || '',
            };
          });
        }

        if (termsToSeed.length === 0) {
          const storedMasterTerms = getStoredGradeTerms()[targetGrade] || [];
          termsToSeed = storedMasterTerms.map(t => ({
            title: t.title,
            maximum_marks: t.maximum_marks,
          }));
        }

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
          const newRows = termsToSeed.map((t: any) => {
            const baseSlug = t.title.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30);
            return {
              id: `offline_term_g${targetGrade}_${baseSlug}_${classRoom.id}`,
              class_id: classRoom.id,
              teacher_id: classRoom.teacher_id || teacher.id,
              title: t.title,
              assessment_date: new Date().toISOString().slice(0, 10),
              maximum_marks: t.maximum_marks,
              notes: t.notes || '',
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

      // Enrich assessments with written/internal max from notes JSON
      const enrichedAssData = (assData || []).map((a: any) => {
        const dec = decodeAssessmentNotes(a.notes);
        return {
          ...a,
          written_max_marks: dec.written_max,
          internal_max_marks: dec.internal_max,
        };
      });

      setAssessments(enrichedAssData);
      if (enrichedAssData.length > 0) {
        setSelectedAssessmentId(prev => (prev && (prev === 'all' || enrichedAssData.some(a => a.id === prev)) ? prev : enrichedAssData[0].id));
      }

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
        (assData || []).forEach((a: any) => {
          const m = (marksData || []).find((x: any) => x.student_id === s.id && x.assessment_id === a.id);
          const decoded = decodeMarkNote(m?.teacher_note);
          nextGrid[s.id][a.id] = {
            marks: m?.marks !== undefined && m?.marks !== null ? String(m.marks) : '',
            written_marks: decoded.written,
            internal_marks: decoded.internal,
            teacher_note: decoded.note,
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

  // ── Sheet Columns Definition (Excel layout for displayed assessments) ───
  const sheetColumns = useMemo<SheetColumn[]>(() => {
    const cols: SheetColumn[] = [];
    displayedAssessments.forEach(a => {
      const hasSplit = a.written_max_marks !== undefined && a.internal_max_marks !== undefined;
      if (hasSplit) {
        cols.push({
          key: `${a.id}_w`,
          assessmentId: a.id,
          subType: 'written',
          headerLabel: `Written (/${a.written_max_marks})`,
          max: a.written_max_marks!,
          isEditable: true,
          assessmentTitle: a.title,
        });
        cols.push({
          key: `${a.id}_i`,
          assessmentId: a.id,
          subType: 'internal',
          headerLabel: `Internal (/${a.internal_max_marks})`,
          max: a.internal_max_marks!,
          isEditable: true,
          assessmentTitle: a.title,
        });
        cols.push({
          key: `${a.id}_t`,
          assessmentId: a.id,
          subType: 'total',
          headerLabel: `Total (/${a.maximum_marks})`,
          max: a.maximum_marks,
          isEditable: false,
          assessmentTitle: a.title,
        });
      } else {
        cols.push({
          key: a.id,
          assessmentId: a.id,
          subType: 'single',
          headerLabel: `Score (/${a.maximum_marks})`,
          max: a.maximum_marks,
          isEditable: true,
          assessmentTitle: a.title,
        });
      }
    });
    return cols;
  }, [displayedAssessments]);

  const editableCols = useMemo(() => sheetColumns.filter(c => c.isEditable), [sheetColumns]);

  const [focusedCell, setFocusedCell] = useState<{
    studentId: string;
    studentName: string;
    colKey: string;
    title: string;
    label: string;
    max: number;
  } | null>(null);

  // ── Sub-Column Stats Helper ───────────────────────────────────────────────
  const getSubColStats = (col: SheetColumn) => {
    const scores: number[] = [];
    const assessment = assessments.find(a => a.id === col.assessmentId);
    if (!assessment) {
      return { avg: '—', high: '—', low: '—', pass: '—', graded: 0, total: enrolledStudents.length };
    }

    Object.values(gridData).forEach(m => {
      const md = m[col.assessmentId];
      if (!md) return;
      if (col.subType === 'written') {
        if (md.written_marks !== '' && md.written_marks !== undefined && !isNaN(Number(md.written_marks))) {
          scores.push(Number(md.written_marks));
        }
      } else if (col.subType === 'internal') {
        if (md.internal_marks !== '' && md.internal_marks !== undefined && !isNaN(Number(md.internal_marks))) {
          scores.push(Number(md.internal_marks));
        }
      } else {
        const score = getCellScore(md, assessment);
        if (score) {
          scores.push(score.scored);
        }
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
    const pass = scores.filter(s => s >= col.max * 0.5).length;
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
    if ((field === 'written_marks' || field === 'internal_marks') && typeof val === 'string') {
      if (val !== '') {
        const assessment = assessments.find(x => x.id === assessmentId);
        const maxField = field === 'written_marks' ? assessment?.written_max_marks : assessment?.internal_max_marks;
        const maxMarks = maxField !== undefined ? maxField : Infinity;
        const num = Number(val);
        if (!isNaN(num)) {
          if (num > maxMarks) finalVal = String(maxMarks);
          else if (num < 0) finalVal = '0';
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

  // ── Excel Keyboard Navigation ─────────────────────────────────────────────
  const handleCellKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    studentIdx: number,
    editColIdx: number
  ) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      let nextCol = editColIdx + (e.shiftKey ? -1 : 1);
      let nextRow = studentIdx;
      if (nextCol >= editableCols.length) {
        nextCol = 0;
        nextRow = Math.min(displayedStudents.length - 1, studentIdx + 1);
      } else if (nextCol < 0) {
        nextCol = editableCols.length - 1;
        nextRow = Math.max(0, studentIdx - 1);
      }
      const targetStudent = displayedStudents[nextRow];
      const targetCol = editableCols[nextCol];
      if (targetStudent && targetCol) {
        const key = `${targetStudent.id}_${targetCol.key}`;
        inputRefs.current[key]?.focus();
        inputRefs.current[key]?.select();
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const nextRow = e.shiftKey ? Math.max(0, studentIdx - 1) : Math.min(displayedStudents.length - 1, studentIdx + 1);
      const targetStudent = displayedStudents[nextRow];
      const targetCol = editableCols[editColIdx];
      if (targetStudent && targetCol) {
        const key = `${targetStudent.id}_${targetCol.key}`;
        inputRefs.current[key]?.focus();
        inputRefs.current[key]?.select();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextRow = Math.min(displayedStudents.length - 1, studentIdx + 1);
      const targetStudent = displayedStudents[nextRow];
      const targetCol = editableCols[editColIdx];
      if (targetStudent && targetCol) {
        const key = `${targetStudent.id}_${targetCol.key}`;
        inputRefs.current[key]?.focus();
        inputRefs.current[key]?.select();
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const nextRow = Math.max(0, studentIdx - 1);
      const targetStudent = displayedStudents[nextRow];
      const targetCol = editableCols[editColIdx];
      if (targetStudent && targetCol) {
        const key = `${targetStudent.id}_${targetCol.key}`;
        inputRefs.current[key]?.focus();
        inputRefs.current[key]?.select();
      }
      return;
    }

    if (e.key === 'ArrowLeft' && e.currentTarget.selectionStart === 0 && e.currentTarget.selectionEnd === 0) {
      if (editColIdx > 0) {
        e.preventDefault();
        const targetStudent = displayedStudents[studentIdx];
        const targetCol = editableCols[editColIdx - 1];
        if (targetStudent && targetCol) {
          const key = `${targetStudent.id}_${targetCol.key}`;
          inputRefs.current[key]?.focus();
          inputRefs.current[key]?.select();
        }
      }
    }

    if (
      e.key === 'ArrowRight' &&
      e.currentTarget.selectionStart === e.currentTarget.value.length &&
      e.currentTarget.selectionEnd === e.currentTarget.value.length
    ) {
      if (editColIdx < editableCols.length - 1) {
        e.preventDefault();
        const targetStudent = displayedStudents[studentIdx];
        const targetCol = editableCols[editColIdx + 1];
        if (targetStudent && targetCol) {
          const key = `${targetStudent.id}_${targetCol.key}`;
          inputRefs.current[key]?.focus();
          inputRefs.current[key]?.select();
        }
      }
    }
  };

  // ── Excel Paste Support ───────────────────────────────────────────────────
  const handleCellPaste = (
    e: React.ClipboardEvent<HTMLInputElement>,
    startStudentIdx: number,
    startEditColIdx: number
  ) => {
    const text = e.clipboardData.getData('text');
    if (!text || (!text.includes('\t') && !text.includes('\n'))) {
      return; // Standard inline paste
    }
    e.preventDefault();
    const rows = text.split(/\r\n|\n|\r/).filter((r, i, arr) => i < arr.length - 1 || r.trim() !== '');
    if (rows.length === 0) return;

    setGridData(prev => {
      const next = { ...prev };
      rows.forEach((rowStr, rOffset) => {
        const sIdx = startStudentIdx + rOffset;
        if (sIdx >= displayedStudents.length) return;
        const student = displayedStudents[sIdx];
        if (!next[student.id]) next[student.id] = {};

        const cellVals = rowStr.split('\t');
        cellVals.forEach((val, cOffset) => {
          const cIdx = startEditColIdx + cOffset;
          if (cIdx >= editableCols.length) return;
          const col = editableCols[cIdx];
          const raw = val.trim();
          const num = Number(raw);

          const cur = next[student.id][col.assessmentId] || {
            marks: '',
            written_marks: '',
            internal_marks: '',
            teacher_note: '',
            is_visible_to_student: true,
          };

          let finalVal = raw;
          if (raw !== '' && !isNaN(num)) {
            finalVal = String(Math.min(col.max, Math.max(0, num)));
          }

          if (col.subType === 'written') {
            next[student.id][col.assessmentId] = { ...cur, written_marks: finalVal };
          } else if (col.subType === 'internal') {
            next[student.id][col.assessmentId] = { ...cur, internal_marks: finalVal };
          } else {
            next[student.id][col.assessmentId] = { ...cur, marks: finalVal };
          }
        });
      });
      return next;
    });

    showToast(`Pasted ${rows.length} row(s) of spreadsheet data.`, 'success');
  };

  // ── Save Marks ───────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    const rows: object[] = [];

    Object.entries(gridData).forEach(([sid, amap]) => {
      Object.entries(amap).forEach(([aid, md]) => {
        const assessment = assessments.find(x => x.id === aid);
        const hasSplit = assessment?.written_max_marks !== undefined && assessment?.internal_max_marks !== undefined;
        const maxMarks = assessment ? assessment.maximum_marks : Infinity;
        let numMarks: number | null = null;

        if (hasSplit) {
          // Compute total from written + internal
          const w = md.written_marks !== '' && md.written_marks !== undefined ? Number(md.written_marks) : null;
          const i = md.internal_marks !== '' && md.internal_marks !== undefined ? Number(md.internal_marks) : null;
          if (w !== null && !isNaN(w) && i !== null && !isNaN(i)) {
            numMarks = Math.min(maxMarks, Math.max(0, w + i));
          } else if (md.marks !== '') {
            const parsed = Number(md.marks);
            if (!isNaN(parsed)) numMarks = Math.min(maxMarks, Math.max(0, parsed));
          }
        } else {
          if (md.marks !== '') {
            const parsed = Number(md.marks);
            if (!isNaN(parsed)) {
              numMarks = Math.min(maxMarks, Math.max(0, parsed));
            }
          }
        }

        // Encode written/internal marks into teacher_note as JSON
        const encodedNote = encodeMarkNote(md.written_marks, md.internal_marks, md.teacher_note);

        rows.push({
          id: `${aid}_${sid}`,
          assessment_id: aid,
          student_id: sid,
          marks: numMarks,
          teacher_note: encodedNote,
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
          const hasSplit = a.written_max_marks !== undefined && a.internal_max_marks !== undefined;
          if (hasSplit) {
            next[s.id][a.id] = {
              marks: '0',
              written_marks: current?.written_marks !== '' && current?.written_marks !== undefined ? current.written_marks : '0',
              internal_marks: current?.internal_marks !== '' && current?.internal_marks !== undefined ? current.internal_marks : '0',
              teacher_note: current?.teacher_note || '',
              is_visible_to_student: true,
            };
          } else {
            if (!current || current.marks === '') {
              next[s.id][a.id] = {
                marks: '0',
                teacher_note: current?.teacher_note || '',
                is_visible_to_student: true,
              };
            }
          }
        });
      });
      return next;
    });
    setShowBatchMenu(false);
    showToast('Filled empty cells with 0 (counts as attempted).', 'info');
  };

  // Undo helper: mark every cell as NOT attempted (clears scores, keeps notes)
  const clearAllMarks = () => {
    setGridData(prev => {
      const next = { ...prev };
      displayedStudents.forEach(s => {
        if (!next[s.id]) next[s.id] = {};
        assessments.forEach(a => {
          next[s.id][a.id] = {
            marks: '',
            written_marks: '',
            internal_marks: '',
            teacher_note: next[s.id][a.id]?.teacher_note || '',
            is_visible_to_student: true,
          };
        });
      });
      return next;
    });
    setShowBatchMenu(false);
    showToast(`Cleared all scores — now marked as Not Attempted.`, 'info');
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
          const hasSplit = a.written_max_marks !== undefined && a.internal_max_marks !== undefined;
          if (hasSplit) {
            row[`${a.title} - Written (/${a.written_max_marks})`] = md?.written_marks ?? '';
            row[`${a.title} - Internal (/${a.internal_max_marks})`] = md?.internal_marks ?? '';
            const score = getCellScore(md, a)?.scored ?? '';
            row[`${a.title} - Total (/${a.maximum_marks})`] = score;
          } else {
            const score = getCellScore(md, a)?.scored ?? '';
            row[`${a.title} (Max ${a.maximum_marks})`] = score;
          }
          if (md?.teacher_note) {
            row[`${a.title} [Note]`] = md.teacher_note;
          }
        });

        const st = studentStatsMap[s.id];
        row['Attempted Exams'] = st ? st.attemptedCount : 0;
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

      sheetColumns.forEach(col => {
        const stats = getSubColStats(col);
        const headerName = `${col.assessmentTitle} - ${col.headerLabel}`;
        avgRow[headerName] = stats.avg;
        highRow[headerName] = stats.high;
        passRow[headerName] = stats.pass;
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
                minWidth: 0,
              }
            : {
                width: 'min(1380px, 98vw)',
                maxWidth: '100%',
                maxHeight: '94vh',
                display: 'flex',
                flexDirection: 'column',
                minWidth: 0,
                background: 'var(--neutral-bg)',
                borderRadius: 16,
                border: '1px solid var(--border-color)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
                padding: '20px 24px',
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

        {/* ── 1. HEADER ─────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 16,
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
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

            <h1 className="page-title" style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
              {classRoom.name} — Marks Register
            </h1>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              {enrolledStudents.length} enrolled student{enrolledStudents.length !== 1 ? 's' : ''} ·{' '}
              {displayedAssessments.length === 1
                ? `Showing: ${displayedAssessments[0].title} (Max ${displayedAssessments[0].maximum_marks})`
                : `${assessments.length} assessment terms (${sheetColumns.length} columns)`}
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
                padding: '6px 12px',
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
                padding: '6px 16px',
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
                padding: '6px 12px',
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

        {/* ── 2. ANALYTICS ROW ─────────────────────────────────────── */}
        {assessments.length > 0 && enrolledStudents.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 10,
              marginBottom: 12,
            }}
          >
            <div className="stat-box" style={{ padding: '10px 14px', borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="stat-sub" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Class Average
                </span>
                <TrendingUp size={14} color="#2C6E6A" />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                  {overallKPIs.classAverage > 0 ? `${overallKPIs.classAverage.toFixed(1)}%` : '—'}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                  ({overallKPIs.attemptedCells}/{overallKPIs.totalCells} cells)
                </span>
              </div>
            </div>

            <div className="stat-box" style={{ padding: '10px 14px', borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="stat-sub" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Top Score
                </span>
                <Award size={14} color="#2C6E6A" />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 700, color: '#265E5A' }}>
                  {overallKPIs.highestScore ? `${overallKPIs.highestScore.pct.toFixed(0)}%` : '—'}
                </span>
                {overallKPIs.highestScore && (
                  <span
                    style={{
                      fontSize: 10.5,
                      color: 'var(--text-secondary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: 110,
                    }}
                    title={overallKPIs.highestScore.studentName}
                  >
                    {overallKPIs.highestScore.studentName}
                  </span>
                )}
              </div>
            </div>

            <div className="stat-box" style={{ padding: '10px 14px', borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="stat-sub" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Pass Rate (≥ 50%)
                </span>
                <BarChart3 size={14} color="var(--text-secondary)" />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                  {overallKPIs.gradedCells > 0 ? `${overallKPIs.passRate.toFixed(0)}%` : '—'}
                </span>
                <div style={{ flex: 1, height: 4, background: 'var(--surface-variant)', borderRadius: 2, overflow: 'hidden', maxWidth: 60 }}>
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

            <div className="stat-box" style={{ padding: '10px 14px', borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="stat-sub" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Attempted Progress
                </span>
                <CheckCircle2 size={14} color="#2C6E6A" />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                  {overallKPIs.completionPct}%
                </span>
                <span style={{ fontSize: 10.5, color: 'var(--text-secondary)' }}>
                  ({overallKPIs.gradedCells} / {overallKPIs.totalCells})
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── 3. TOOLBAR & FORMULA BAR ──────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
            marginBottom: 8,
            background: 'var(--surface)',
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid var(--border-color)',
          }}
        >
          {/* Left: Search & Sort */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={13} style={{ position: 'absolute', left: 10, color: 'var(--text-secondary)', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Search student or roll no..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="form-input"
                style={{
                  padding: '6px 10px 6px 30px',
                  fontSize: 12,
                  width: 210,
                  height: 32,
                  borderRadius: 6,
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{ position: 'absolute', right: 8, border: 0, background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Term / Assessment Selector Dropdown */}
            {assessments.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Term:</span>
                <div style={{ minWidth: 220, maxWidth: 280 }}>
                  <CustomSelect
                    value={selectedAssessmentId}
                    onChange={val => setSelectedAssessmentId(val)}
                    options={[
                      ...assessments.map(a => ({
                        value: a.id,
                        label: `${a.title} (Max ${a.maximum_marks})`,
                        sublabel: a.assessment_date ? fmtDate(a.assessment_date) : undefined,
                      })),
                      ...(assessments.length > 1
                        ? [
                            {
                              value: 'all',
                              label: 'All Terms (Overview Grid)',
                              sublabel: 'View all columns side by side',
                            },
                          ]
                        : []),
                    ]}
                    compact
                    buttonStyle={{
                      height: 32,
                      padding: '4px 10px',
                      fontSize: 12,
                      fontWeight: 700,
                      border: '1.5px solid #2C6E6A',
                      background: '#F0FAF5',
                      color: '#265E5A',
                      borderRadius: 6,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Sort Selector Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>Sort:</span>
              <div style={{ minWidth: 170, maxWidth: 210 }}>
                <CustomSelect
                  value={sortOption}
                  onChange={val => setSortOption(val as SortOption)}
                  options={[
                    { value: 'name_asc', label: 'Name (A → Z)' },
                    { value: 'name_desc', label: 'Name (Z → A)' },
                    { value: 'adm_asc', label: 'Roll / Admission No.' },
                    { value: 'score_desc', label: 'Score (High → Low)' },
                    { value: 'score_asc', label: 'Score (Low → High)' },
                  ]}
                  compact
                  buttonStyle={{
                    height: 32,
                    padding: '4px 10px',
                    fontSize: 12,
                    fontWeight: 500,
                    border: '1px solid var(--border-color)',
                    background: 'var(--surface)',
                    color: 'var(--neutral-dark)',
                    borderRadius: 6,
                  }}
                />
              </div>
            </div>

            {/* Excel Formula / Active Cell Indicator */}
            {focusedCell && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: '#F1F5F9',
                  border: '1px solid #CBD5E1',
                  borderRadius: 6,
                  padding: '3px 8px',
                  fontSize: 11.5,
                  color: '#334155',
                }}
              >
                <span style={{ fontWeight: 700, color: '#0F172A', fontFamily: 'monospace' }}>fx</span>
                <span style={{ color: '#64748B' }}>|</span>
                <span style={{ fontWeight: 600 }}>{focusedCell.studentName}</span>
                <span style={{ color: '#94A3B8' }}>›</span>
                <span>{focusedCell.title}</span>
                <span style={{ color: '#94A3B8' }}>›</span>
                <strong style={{ color: '#2C6E6A' }}>{focusedCell.label} (Max: {focusedCell.max})</strong>
              </div>
            )}
          </div>

          {/* Right: Batch Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ position: 'relative' }} ref={batchRef}>
              <button
                onClick={() => setShowBatchMenu(!showBatchMenu)}
                className="btn-secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '0 10px',
                  fontSize: 12,
                  fontWeight: 600,
                  height: 32,
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                <SlidersHorizontal size={13} />
                <span>Batch Tools</span>
              </button>

              {showBatchMenu && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: 4,
                    background: '#FFFFFF',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    zIndex: 100,
                    minWidth: 220,
                    padding: '4px 0',
                  }}
                >
                  <button
                    onClick={() => fillEmptyWithZero()}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '8px 12px',
                      border: 0,
                      background: 'transparent',
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--neutral-dark)',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <RotateCcw size={13} /> Fill Empty Cells with 0
                  </button>
                  <button
                    onClick={() => {
                      if (
                        window.confirm(
                          'Clear ALL scores and mark every exam as "Not Attempted"? Teacher notes will be kept.'
                        )
                      ) {
                        clearAllMarks();
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '8px 12px',
                      border: 0,
                      borderTop: '1px solid var(--border-color)',
                      background: 'transparent',
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#B37D4A',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <X size={13} /> Mark All as Not Attempted (Clear)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── 4. SPREADSHEET TABLE CARD (EXCEL GRID DESIGN) ─────────── */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #CBD5E1',
            borderRadius: 8,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 400,
            minWidth: 0,
            position: 'relative',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}
        >
          {assessments.length === 0 ? (
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
                  Assessment terms are configured centrally by the school administration for Grade {classGrade}.
                  Once configured, they will automatically appear here in columns.
                </p>
              </div>
            </div>
          ) : enrolledStudents.length === 0 ? (
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
                  Please enroll students in this classroom from class settings before entering marks.
                </p>
              </div>
            </div>
          ) : (
            <div className="scroll-visible" style={{ overflow: 'auto', flex: 1, width: '100%', minWidth: 0 }}>
              <table
                style={{
                  width: '100%',
                  minWidth: 'max-content',
                  borderCollapse: 'separate',
                  borderSpacing: 0,
                  fontSize: 12,
                  fontFamily: 'inherit',
                }}
              >
                {/* ── Two-Tier Excel Table Header ── */}
                <thead>
                  {/* Tier 1: Group Headers */}
                  <tr style={{ background: '#F1F5F9' }}>
                    {/* Frozen # column */}
                    <th
                      rowSpan={2}
                      style={{
                        position: 'sticky',
                        left: 0,
                        top: 0,
                        zIndex: 35,
                        background: '#F1F5F9',
                        borderRight: '1px solid #CBD5E1',
                        borderBottom: '1px solid #CBD5E1',
                        padding: '6px 8px',
                        textAlign: 'center',
                        width: 40,
                        minWidth: 40,
                        color: '#475569',
                        fontWeight: 700,
                        fontSize: 11,
                      }}
                    >
                      #
                    </th>

                    {/* Frozen Student Profile Header */}
                    <th
                      rowSpan={2}
                      style={{
                        position: 'sticky',
                        left: 40,
                        top: 0,
                        zIndex: 35,
                        background: '#F1F5F9',
                        borderRight: '1px solid #CBD5E1',
                        borderBottom: '1px solid #CBD5E1',
                        padding: '8px 12px',
                        textAlign: 'left',
                        minWidth: 200,
                        width: 200,
                      }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Student ({displayedStudents.length})
                      </span>
                    </th>

                    {/* Frozen Overall Summary Header */}
                    <th
                      rowSpan={2}
                      style={{
                        position: 'sticky',
                        left: 240,
                        top: 0,
                        zIndex: 35,
                        background: '#F1F5F9',
                        borderRight: '2px solid #94A3B8',
                        borderBottom: '1px solid #CBD5E1',
                        padding: '8px 10px',
                        textAlign: 'center',
                        minWidth: 84,
                        width: 84,
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>
                        AVG %
                      </div>
                      <div style={{ fontSize: 9.5, color: '#64748B', fontWeight: 500 }}>
                        Attempted
                      </div>
                    </th>

                    {/* Group Column for each Assessment */}
                    {displayedAssessments.map(a => {
                      const hasSplit = a.written_max_marks !== undefined && a.internal_max_marks !== undefined;
                      const colSpan = hasSplit ? 3 : 1;

                      return (
                        <th
                          key={a.id}
                          colSpan={colSpan}
                          style={{
                            position: 'sticky',
                            top: 0,
                            zIndex: 25,
                            background: '#F1F5F9',
                            borderRight: '2px solid #CBD5E1',
                            borderBottom: '1px solid #CBD5E1',
                            padding: '6px 10px',
                            textAlign: 'center',
                            userSelect: 'none',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                            <span
                              style={{
                                fontSize: 12.5,
                                fontWeight: 700,
                                color: '#1E293B',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                maxWidth: 220,
                              }}
                              title={a.title}
                            >
                              {a.title}
                            </span>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                padding: '1px 5px',
                                borderRadius: 3,
                                background: '#E2E8F0',
                                color: '#334155',
                              }}
                            >
                              Max {a.maximum_marks}
                            </span>
                            {a.assessment_date && (
                              <span style={{ fontSize: 10, color: '#64748B' }}>
                                ({fmtDate(a.assessment_date)})
                              </span>
                            )}
                          </div>
                        </th>
                      );
                    })}
                  </tr>

                  {/* Tier 2: Sub-column Headers */}
                  <tr style={{ background: '#F8FAFC' }}>
                    {sheetColumns.map(col => {
                      const isTotal = col.subType === 'total';
                      const isWritten = col.subType === 'written';
                      const isInternal = col.subType === 'internal';

                      return (
                        <th
                          key={col.key}
                          style={{
                            position: 'sticky',
                            top: 33,
                            zIndex: 24,
                            background: isTotal ? '#F1F5F9' : isWritten ? '#F0F9FF' : isInternal ? '#F0FDF4' : '#F8FAFC',
                            borderRight: isTotal || col.subType === 'single' ? '2px solid #CBD5E1' : '1px solid #E2E8F0',
                            borderBottom: '2px solid #94A3B8',
                            padding: '4px 6px',
                            textAlign: 'center',
                            minWidth: isTotal ? 76 : 84,
                            fontSize: 11,
                            fontWeight: 700,
                            color: isWritten ? '#0369A1' : isInternal ? '#15803D' : '#334155',
                          }}
                        >
                          {col.headerLabel}
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                {/* ── Table Body ── */}
                <tbody>
                  {displayedStudents.map((s, rowIdx) => {
                    const st = studentStatsMap[s.id];
                    const isEven = rowIdx % 2 === 0;

                    return (
                      <tr
                        key={s.id}
                        style={{
                          background: isEven ? '#FFFFFF' : '#F8FAFC',
                          transition: 'background 0.1s',
                        }}
                        className="spreadsheet-row"
                      >
                        {/* 1. Sl No (#) */}
                        <td
                          style={{
                            position: 'sticky',
                            left: 0,
                            zIndex: 15,
                            background: isEven ? '#FFFFFF' : '#F8FAFC',
                            borderRight: '1px solid #E2E8F0',
                            borderBottom: '1px solid #E2E8F0',
                            padding: '0 4px',
                            textAlign: 'center',
                            fontSize: 11,
                            fontWeight: 600,
                            color: '#94A3B8',
                            height: 36,
                          }}
                        >
                          {rowIdx + 1}
                        </td>

                        {/* 2. Student Info */}
                        <td
                          style={{
                            position: 'sticky',
                            left: 40,
                            zIndex: 15,
                            background: isEven ? '#FFFFFF' : '#F8FAFC',
                            borderRight: '1px solid #E2E8F0',
                            borderBottom: '1px solid #E2E8F0',
                            padding: '4px 10px',
                            minWidth: 200,
                            width: 200,
                            height: 36,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <div
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: 4,
                                background: '#2C6E6A',
                                color: '#FFFFFF',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 10,
                                fontWeight: 700,
                                flexShrink: 0,
                              }}
                            >
                              {s.name.charAt(0).toUpperCase()}
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div
                                style={{
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: '#0F172A',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                                title={s.name}
                              >
                                {s.name}
                              </div>
                              <div style={{ fontSize: 10, color: '#64748B', fontFamily: 'monospace' }}>
                                {s.admission_number || s.email?.split('@')[0] || '—'}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 3. Overall Student Score Column */}
                        <td
                          style={{
                            position: 'sticky',
                            left: 240,
                            zIndex: 15,
                            background: isEven ? '#FFFFFF' : '#F8FAFC',
                            borderRight: '2px solid #94A3B8',
                            borderBottom: '1px solid #E2E8F0',
                            padding: '4px 8px',
                            textAlign: 'center',
                            minWidth: 84,
                            height: 36,
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color:
                                  st && st.totalMax > 0
                                    ? st.percentage >= 70
                                      ? '#2C6E6A'
                                      : st.percentage >= 50
                                      ? '#B37D4A'
                                      : '#D9534F'
                                    : '#94A3B8',
                              }}
                            >
                              {st && st.totalMax > 0 ? `${st.percentage.toFixed(0)}%` : '—'}
                            </span>
                            <span style={{ fontSize: 9.5, color: '#94A3B8' }}>
                              {st ? `${st.attemptedCount}/${st.totalAssessments}` : `0/${assessments.length}`}
                            </span>
                          </div>
                        </td>

                        {/* 4. Assessment Columns */}
                        {sheetColumns.map(col => {
                          const md = gridData[s.id]?.[col.assessmentId] || {
                            marks: '',
                            written_marks: '',
                            internal_marks: '',
                            teacher_note: '',
                            is_visible_to_student: true,
                          };

                          const cellKey = `${s.id}_${col.key}`;
                          const isCommentOpen = activeCommentKey === `${s.id}_${col.assessmentId}`;
                          const hasNote = Boolean(md.teacher_note);

                          // For editable columns
                          if (col.isEditable) {
                            const editColIdx = editableCols.findIndex(ec => ec.key === col.key);
                            const val =
                              col.subType === 'written'
                                ? md.written_marks ?? ''
                                : col.subType === 'internal'
                                ? md.internal_marks ?? ''
                                : md.marks ?? '';

                            const isInvalid = val !== '' && Number(val) > col.max;

                            return (
                              <td
                                key={col.key}
                                style={{
                                  borderRight: '1px solid #E2E8F0',
                                  borderBottom: '1px solid #E2E8F0',
                                  padding: 0,
                                  height: 36,
                                  position: 'relative',
                                  background: isInvalid ? '#FEF2F2' : 'transparent',
                                }}
                              >
                                <input
                                  ref={el => {
                                    inputRefs.current[cellKey] = el;
                                  }}
                                  type="number"
                                  min={0}
                                  max={col.max}
                                  step="any"
                                  value={val}
                                  onFocus={() => {
                                    setFocusedCell({
                                      studentId: s.id,
                                      studentName: s.name,
                                      colKey: col.key,
                                      title: col.assessmentTitle,
                                      label: col.headerLabel,
                                      max: col.max,
                                    });
                                  }}
                                  onBlur={() => {
                                    setFocusedCell(null);
                                  }}
                                  onChange={e => {
                                    const raw = e.target.value;
                                    const field =
                                      col.subType === 'written'
                                        ? 'written_marks'
                                        : col.subType === 'internal'
                                        ? 'internal_marks'
                                        : 'marks';
                                    setCell(s.id, col.assessmentId, field, raw);
                                  }}
                                  onKeyDown={e => {
                                    if (e.key === '-' || e.key === '+' || e.key === 'e' || e.key === 'E') {
                                      e.preventDefault();
                                    }
                                    handleCellKeyDown(e, rowIdx, editColIdx);
                                  }}
                                  onPaste={e => {
                                    handleCellPaste(e, rowIdx, editColIdx);
                                  }}
                                  placeholder="—"
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    border: 'none',
                                    background: 'transparent',
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: isInvalid
                                      ? '#DC2626'
                                      : val !== ''
                                      ? '#0F172A'
                                      : '#94A3B8',
                                    textAlign: 'center',
                                    outline: 'none',
                                    fontFamily: 'inherit',
                                    padding: '0 4px',
                                    boxSizing: 'border-box',
                                  }}
                                  className="excel-cell-input"
                                />

                                {/* Excel-Style Note Triangle Marker */}
                                {hasNote && (
                                  <div
                                    onClick={() => setActiveCommentKey(isCommentOpen ? null : `${s.id}_${col.assessmentId}`)}
                                    style={{
                                      position: 'absolute',
                                      top: 0,
                                      right: 0,
                                      width: 0,
                                      height: 0,
                                      borderTop: '7px solid #D97706',
                                      borderLeft: '7px solid transparent',
                                      cursor: 'pointer',
                                      zIndex: 5,
                                    }}
                                    title={`Note: "${md.teacher_note}" (Click to view/edit)`}
                                  />
                                )}

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
                                      boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
                                      zIndex: 100,
                                      width: 250,
                                      padding: 10,
                                      textAlign: 'left',
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                      <div>
                                        <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>{s.name}</div>
                                        <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{col.assessmentTitle} Note</div>
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
                                            setCell(s.id, col.assessmentId, 'teacher_note', prev ? `${prev} ${chip}` : chip);
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
                                      onChange={e => setCell(s.id, col.assessmentId, 'teacher_note', e.target.value)}
                                      placeholder="Private note for this student..."
                                      className="form-input"
                                      style={{
                                        width: '100%',
                                        padding: 6,
                                        fontSize: 11.5,
                                        minHeight: 50,
                                        boxSizing: 'border-box',
                                      }}
                                    />

                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                                      <button
                                        type="button"
                                        onClick={() => setActiveCommentKey(null)}
                                        className="btn-primary"
                                        style={{ padding: '3px 10px', fontSize: 11, borderRadius: 4, cursor: 'pointer' }}
                                      >
                                        Done
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </td>
                            );
                          }

                          // ── Total (Calculated / Read-only Column) ──
                          const wNum = md.written_marks !== '' && md.written_marks !== undefined ? Number(md.written_marks) : null;
                          const iNum = md.internal_marks !== '' && md.internal_marks !== undefined ? Number(md.internal_marks) : null;
                          const calculatedTotal =
                            wNum !== null && !isNaN(wNum) && iNum !== null && !isNaN(iNum)
                              ? wNum + iNum
                              : null;

                          return (
                            <td
                              key={col.key}
                              style={{
                                borderRight: '2px solid #CBD5E1',
                                borderBottom: '1px solid #E2E8F0',
                                padding: '4px 6px',
                                height: 36,
                                background: isEven ? '#F8FAFC' : '#F1F5F9',
                                textAlign: 'center',
                                position: 'relative',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                                <span
                                  style={{
                                    fontSize: 12.5,
                                    fontWeight: 700,
                                    color:
                                      calculatedTotal !== null
                                        ? calculatedTotal >= col.max * 0.7
                                          ? '#15803D'
                                          : calculatedTotal >= col.max * 0.5
                                          ? '#B45309'
                                          : '#DC2626'
                                        : '#94A3B8',
                                  }}
                                >
                                  {calculatedTotal !== null ? calculatedTotal : '—'}
                                </span>
                                {/* Note button in total cell for quick access */}
                                <button
                                  type="button"
                                  className="comment-trigger-btn"
                                  onClick={() => setActiveCommentKey(isCommentOpen ? null : `${s.id}_${col.assessmentId}`)}
                                  style={{
                                    width: 15,
                                    height: 15,
                                    borderRadius: 3,
                                    border: `1px solid ${md.teacher_note ? '#F3D9A0' : 'transparent'}`,
                                    background: md.teacher_note ? '#FEF7EC' : 'transparent',
                                    color: md.teacher_note ? '#B37D4A' : '#94A3B8',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: 0,
                                  }}
                                  title={md.teacher_note ? `Note: "${md.teacher_note}"` : 'Add note'}
                                >
                                  <MessageSquare size={9} />
                                </button>
                              </div>
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
                    { key: 'avg', label: 'Class Average', color: '#0F172A', bg: '#F1F5F9', borderTop: '2px solid #94A3B8' },
                    { key: 'high', label: 'Highest Score', color: '#15803D', bg: '#F0FDF4', borderTop: '1px solid #E2E8F0' },
                    { key: 'low', label: 'Lowest Score', color: '#DC2626', bg: '#FEF2F2', borderTop: '1px solid #E2E8F0' },
                    { key: 'pass', label: 'Pass Rate (≥ 50%)', color: '#334155', bg: '#F8FAFC', borderTop: '1px solid #E2E8F0' },
                  ].map(row => (
                    <tr key={row.key} style={{ background: row.bg }}>
                      <td
                        style={{
                          position: 'sticky',
                          left: 0,
                          zIndex: 20,
                          background: row.bg,
                          borderRight: '1px solid #CBD5E1',
                          borderTop: row.borderTop,
                          padding: '6px 4px',
                          textAlign: 'center',
                          fontSize: 10,
                          fontWeight: 700,
                          color: '#64748B',
                        }}
                      >
                        —
                      </td>
                      <td
                        style={{
                          position: 'sticky',
                          left: 40,
                          zIndex: 20,
                          background: row.bg,
                          borderRight: '1px solid #CBD5E1',
                          borderTop: row.borderTop,
                          padding: '6px 12px',
                          fontSize: 11,
                          fontWeight: 700,
                          color: '#334155',
                          textTransform: 'uppercase',
                        }}
                      >
                        {row.label}
                      </td>
                      <td
                        style={{
                          position: 'sticky',
                          left: 240,
                          zIndex: 20,
                          background: row.bg,
                          borderRight: '2px solid #94A3B8',
                          borderTop: row.borderTop,
                          padding: '6px 8px',
                          textAlign: 'center',
                          fontSize: 11,
                          fontWeight: 700,
                          color: row.color,
                        }}
                      >
                        {row.key === 'avg' && overallKPIs.classAverage > 0 ? `${overallKPIs.classAverage.toFixed(1)}%` : row.key === 'pass' && overallKPIs.gradedCells > 0 ? `${overallKPIs.passRate.toFixed(0)}%` : '—'}
                      </td>

                      {sheetColumns.map(col => {
                        const stats = getSubColStats(col);
                        const val = (stats as Record<string, string | number | boolean>)[row.key];
                        const isTotal = col.subType === 'total';

                        return (
                          <td
                            key={col.key}
                            style={{
                              textAlign: 'center',
                              borderRight: isTotal || col.subType === 'single' ? '2px solid #CBD5E1' : '1px solid #E2E8F0',
                              borderTop: row.borderTop,
                              padding: '6px 8px',
                              fontSize: 11.5,
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

        {/* ── 5. EXCEL KEYBOARD & SHORTCUTS FOOTER ──────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 8,
            fontSize: 11,
            color: 'var(--text-secondary)',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span>
              <strong>Keyboard:</strong> <kbd style={{ background: '#E2E8F0', padding: '1px 4px', borderRadius: 3, fontSize: 10 }}>Enter</kbd> / <kbd style={{ background: '#E2E8F0', padding: '1px 4px', borderRadius: 3, fontSize: 10 }}>↓</kbd> next student, <kbd style={{ background: '#E2E8F0', padding: '1px 4px', borderRadius: 3, fontSize: 10 }}>Tab</kbd> / <kbd style={{ background: '#E2E8F0', padding: '1px 4px', borderRadius: 3, fontSize: 10 }}>→</kbd> next column.
            </span>
            <span>
              <strong>Excel Paste:</strong> Copy columns from Excel and press <kbd style={{ background: '#E2E8F0', padding: '1px 4px', borderRadius: 3, fontSize: 10 }}>Ctrl+V</kbd> / <kbd style={{ background: '#E2E8F0', padding: '1px 4px', borderRadius: 3, fontSize: 10 }}>Cmd+V</kbd>.
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ display: 'inline-block', width: 0, height: 0, borderTop: '6px solid #D97706', borderLeft: '6px solid transparent' }} />
              <span>Cell with teacher note</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ display: 'inline-block', width: 10, height: 10, background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: 2 }} />
              <span>Calculated Total</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
