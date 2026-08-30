'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Calendar,
  Award,
  BookOpen,
  Users,
  CheckCircle2,
  AlertCircle,
  X,
  FileSpreadsheet,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { supabase, SubjectClass, UserProfile } from '@/lib/supabaseClient';
import { SegmentedControl } from '@/components/UI/SegmentedControl';

export interface GradeAssessmentTerm {
  id: string;
  title: string;
  assessment_date: string;
  maximum_marks: number;
  written_max_marks?: number;
  internal_max_marks?: number;
  notes?: string;
  grade: string;
}

// ── Helpers to encode/decode written+internal split in notes field ────────────
export function encodeAssessmentNotes(written?: number, internal?: number, text?: string): string {
  if (written !== undefined && internal !== undefined) {
    return JSON.stringify({ wm: written, im: internal, n: text || '' });
  }
  return text || '';
}

export function decodeAssessmentNotes(notes?: string): { written_max?: number; internal_max?: number; text: string } {
  if (!notes) return { text: '' };
  try {
    const j = JSON.parse(notes);
    if (typeof j === 'object' && ('wm' in j || 'im' in j)) {
      return { written_max: j.wm, internal_max: j.im, text: j.n || '' };
    }
  } catch {}
  return { text: notes };
}

export function encodeMarkNote(written?: string, internal?: string, note?: string): string {
  if ((written !== undefined && written !== '') || (internal !== undefined && internal !== '')) {
    return JSON.stringify({ w: written ?? '', i: internal ?? '', n: note || '' });
  }
  return note || '';
}

export function decodeMarkNote(teacherNote?: string): { written?: string; internal?: string; note: string } {
  if (!teacherNote) return { note: '' };
  try {
    const j = JSON.parse(teacherNote);
    if (typeof j === 'object' && ('w' in j || 'i' in j)) {
      return { written: String(j.w ?? ''), internal: String(j.i ?? ''), note: j.n || '' };
    }
  } catch {}
  return { note: teacherNote };
}

interface AdminAssessmentTermsViewProps {
  currentUser: UserProfile;
  profiles: UserProfile[];
  subjectClasses: SubjectClass[];
  onOpenMarkRegister: (classRoom: SubjectClass) => void;
}

const VALID_GRADES = ['9', '10', '11', '12'] as const;

export function extractGradeFromClass(cls: SubjectClass | string | null | undefined): string {
  if (!cls) return '10';
  const str = typeof cls === 'string' ? cls : `${cls.class_name || ''} ${cls.name || ''}`;
  const m = str.match(/\b(9|10|11|12)\b/i) || str.match(/Grade\s*(\d+)/i) || str.match(/(\d+)/);
  return m ? m[1] : '10';
}

const PRESET_ASSESSMENTS = [
  'PT-1 (Periodic Test 1)',
  'PT-2 (Periodic Test 2)',
  'Half-Yearly Examination',
  'Term-1 Final Exam',
  'Term-2 Final Exam',
  'Unit Test 1',
  'Unit Test 2',
  'Practical Assessment',
  'Annual Board Exam',
];

const PRESET_MAX_MARKS = [20, 25, 40, 50, 80, 100];

function fmtDate(iso: string) {
  if (!iso) return '—';
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

const STORAGE_KEY_GRADE_TERMS = 'woodlem_grade_assessment_terms';

export function getStoredGradeTerms(): Record<string, GradeAssessmentTerm[]> {
  if (typeof window === 'undefined') return { '9': [], '10': [], '11': [], '12': [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY_GRADE_TERMS);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { '9': [], '10': [], '11': [], '12': [] };
}

export function saveStoredGradeTerms(map: Record<string, GradeAssessmentTerm[]>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_GRADE_TERMS, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent('woodlem-marks-updated'));
  } catch {}
}

export async function fetchCloudGradeTerms(): Promise<Record<string, GradeAssessmentTerm[]>> {
  const map: Record<string, GradeAssessmentTerm[]> = { '9': [], '10': [], '11': [], '12': [] };
  try {
    const { data, error } = await supabase
      .from('achievements')
      .select('*')
      .eq('title', '__GRADE_ASSESSMENT_TERM__');

    if (!error && data) {
      data.forEach((row: any) => {
        let termObj: any = {};
        try {
          termObj = JSON.parse(row.desc_text || '{}');
        } catch {
          termObj = {
            title: row.file_name,
            maximum_marks: Number(row.file_url || 40),
            grade: row.student_id,
          };
        }
        const g = String(termObj.grade || row.student_id || '10').replace(/[^0-9]/g, '');
        if (!map[g]) map[g] = [];
        map[g].push({
          id: row.id,
          title: termObj.title || row.file_name || 'Assessment',
          assessment_date: termObj.assessment_date || new Date().toISOString().slice(0, 10),
          maximum_marks: Number(termObj.maximum_marks || row.file_url || 40),
          notes: termObj.notes || '',
          grade: g,
        });
      });
    }
  } catch (err) {
    console.error('Error fetching cloud grade terms:', err);
  }
  return map;
}

export const AdminAssessmentTermsView: React.FC<AdminAssessmentTermsViewProps> = ({
  currentUser,
  profiles,
  subjectClasses = [],
  onOpenMarkRegister,
}) => {
  const [selectedGrade, setSelectedGrade] = useState<string>('10');
  const [rawAssessments, setRawAssessments] = useState<any[]>([]);
  const [localGradeTerms, setLocalGradeTerms] = useState<Record<string, GradeAssessmentTerm[]>>({ '9': [], '10': [], '11': [], '12': [] });
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingTerm, setEditingTerm] = useState<GradeAssessmentTerm | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formMax, setFormMax] = useState('40');
  const [formNotes, setFormNotes] = useState('');
  const [formWrittenMax, setFormWrittenMax] = useState('');
  const [formInternalMax, setFormInternalMax] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(prev => (prev?.text === text ? null : prev));
    }, 4000);
  };

  // Load all offline assessments + master store directly from Supabase
  const loadAssessments = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Cloud Master Terms from Supabase achievements table
      const cloudMap = await fetchCloudGradeTerms();

      // 2. Fetch offline_assessments from database
      const { data: offlineData } = await supabase
        .from('offline_assessments')
        .select('*')
        .order('created_at', { ascending: true });

      setRawAssessments(offlineData || []);

      // 3. Merge: If offline_assessments has terms for a grade that aren't yet in cloudMap, add and save to cloud
      const classById: Record<string, SubjectClass> = {};
      subjectClasses.forEach(c => { classById[c.id] = c; });

      (offlineData || []).forEach((item: any) => {
        let g = '10';
        if (item.class_id && item.class_id.startsWith('grade_')) {
          g = item.class_id.replace('grade_', '');
        } else if (item.class_id && classById[item.class_id]) {
          g = extractGradeFromClass(classById[item.class_id]);
        } else if (item.id && item.id.includes('_g9_')) {
          g = '9';
        } else if (item.id && item.id.includes('_g10_')) {
          g = '10';
        } else if (item.id && item.id.includes('_g11_')) {
          g = '11';
        } else if (item.id && item.id.includes('_g12_')) {
          g = '12';
        }

        if (!cloudMap[g]) cloudMap[g] = [];
        const exists = cloudMap[g].some(t => t.title.toLowerCase().trim() === item.title.toLowerCase().trim());
        if (!exists) {
          const newMaster: GradeAssessmentTerm = {
            id: item.id,
            title: item.title,
            assessment_date: item.assessment_date || new Date().toISOString().slice(0, 10),
            maximum_marks: Number(item.maximum_marks || 40),
            notes: item.notes || '',
            grade: g,
          };
          cloudMap[g].push(newMaster);

          // Proactively persist to Supabase cloud master record
          supabase
            .from('achievements')
            .upsert([{
              id: `grade_term_g${g}_${item.title.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30)}`,
              student_id: g,
              title: '__GRADE_ASSESSMENT_TERM__',
              desc_text: JSON.stringify(newMaster),
              file_name: item.title,
              file_url: String(item.maximum_marks || 40),
            }], { onConflict: 'id' })
            .then(() => {});
        }
      });

      // 4. Also check localStorage for any offline-created terms and sync them to cloud
      const localStored = getStoredGradeTerms();
      VALID_GRADES.forEach(g => {
        const localList = localStored[g] || [];
        localList.forEach(lt => {
          if (!lt || !lt.title) return;
          const exists = (cloudMap[g] || []).some(
            ct => ct.title.toLowerCase().trim() === lt.title.toLowerCase().trim()
          );
          if (!exists) {
            if (!cloudMap[g]) cloudMap[g] = [];
            const baseSlug = lt.title.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30);
            const migrated: GradeAssessmentTerm = {
              id: lt.id || `grade_term_g${g}_${baseSlug}`,
              title: lt.title,
              assessment_date: lt.assessment_date || new Date().toISOString().slice(0, 10),
              maximum_marks: Number(lt.maximum_marks || 40),
              notes: lt.notes || '',
              grade: g,
            };
            cloudMap[g].push(migrated);

            // Save to Supabase cloud!
            supabase
              .from('achievements')
              .upsert([{
                id: migrated.id,
                student_id: g,
                title: '__GRADE_ASSESSMENT_TERM__',
                desc_text: JSON.stringify(migrated),
                file_name: lt.title,
                file_url: String(lt.maximum_marks || 40),
              }], { onConflict: 'id' })
              .then(() => {});
          }
        });
      });

      // 5. Update local state and localStorage cache
      setLocalGradeTerms(cloudMap);
      saveStoredGradeTerms(cloudMap);
    } catch (e) {
      console.error('Error loading assessments:', e);
      setLocalGradeTerms(getStoredGradeTerms());
    }
    setLoading(false);
  }, [subjectClasses]);

  useEffect(() => {
    loadAssessments();
    const handleUpdate = () => {
      loadAssessments();
    };
    window.addEventListener('woodlem-marks-updated', handleUpdate);
    return () => window.removeEventListener('woodlem-marks-updated', handleUpdate);
  }, [loadAssessments]);

  // Group assessments by grade (merging master grade store + DB assessments)
  const gradeTermsMap = useMemo(() => {
    const map: Record<string, GradeAssessmentTerm[]> = {
      '9': [...(localGradeTerms['9'] || [])],
      '10': [...(localGradeTerms['10'] || [])],
      '11': [...(localGradeTerms['11'] || [])],
      '12': [...(localGradeTerms['12'] || [])],
    };

    // Index classes by ID
    const classById: Record<string, SubjectClass> = {};
    subjectClasses.forEach(c => {
      classById[c.id] = c;
    });

    const seenPerGrade: Record<string, Set<string>> = {
      '9': new Set(map['9'].map(t => `${t.title.trim().toLowerCase()}_${t.maximum_marks}`)),
      '10': new Set(map['10'].map(t => `${t.title.trim().toLowerCase()}_${t.maximum_marks}`)),
      '11': new Set(map['11'].map(t => `${t.title.trim().toLowerCase()}_${t.maximum_marks}`)),
      '12': new Set(map['12'].map(t => `${t.title.trim().toLowerCase()}_${t.maximum_marks}`)),
    };

    rawAssessments.forEach(item => {
      let g = '10';
      if (item.class_id && item.class_id.startsWith('grade_')) {
        g = item.class_id.replace('grade_', '');
      } else if (item.class_id && classById[item.class_id]) {
        g = extractGradeFromClass(classById[item.class_id]);
      } else if (item.id && item.id.includes('_g9_')) {
        g = '9';
      } else if (item.id && item.id.includes('_g10_')) {
        g = '10';
      } else if (item.id && item.id.includes('_g11_')) {
        g = '11';
      } else if (item.id && item.id.includes('_g12_')) {
        g = '12';
      }

      if (!map[g]) {
        map[g] = [];
        seenPerGrade[g] = new Set();
      }

      const key = `${item.title.trim().toLowerCase()}_${item.maximum_marks}`;
      if (!seenPerGrade[g].has(key)) {
        seenPerGrade[g].add(key);
        map[g].push({
          id: item.id,
          title: item.title,
          assessment_date: item.assessment_date || new Date().toISOString().slice(0, 10),
          maximum_marks: Number(item.maximum_marks || 40),
          notes: item.notes || '',
          grade: g,
        });
      }
    });

    return map;
  }, [localGradeTerms, rawAssessments, subjectClasses]);

  // Current grade terms
  const currentGradeTerms = useMemo(() => {
    return gradeTermsMap[selectedGrade] || [];
  }, [gradeTermsMap, selectedGrade]);

  // Classes belonging to active grade
  const currentGradeClasses = useMemo(() => {
    return subjectClasses.filter(c => extractGradeFromClass(c) === selectedGrade);
  }, [subjectClasses, selectedGrade]);

  // Students belonging to active grade
  const currentGradeStudents = useMemo(() => {
    return profiles.filter(p => {
      if (p.role !== 'student') return false;
      const g = (p.grade || '').replace(/[^0-9]/g, '');
      return g === selectedGrade;
    });
  }, [profiles, selectedGrade]);

  // Open Add Term Modal
  const handleOpenAddModal = () => {
    setEditingTerm(null);
    setFormTitle('');
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormMax('40');
    setFormNotes('');
    setFormWrittenMax('');
    setFormInternalMax('');
    setFormError('');
    setShowModal(true);
  };

  // Open Edit Term Modal
  const handleOpenEditModal = (term: GradeAssessmentTerm) => {
    setEditingTerm(term);
    setFormTitle(term.title);
    setFormDate(term.assessment_date || new Date().toISOString().slice(0, 10));
    setFormMax(String(term.maximum_marks));
    const decoded = decodeAssessmentNotes(term.notes);
    setFormNotes(decoded.text);
    setFormWrittenMax(term.written_max_marks !== undefined ? String(term.written_max_marks) : decoded.written_max !== undefined ? String(decoded.written_max) : '');
    setFormInternalMax(term.internal_max_marks !== undefined ? String(term.internal_max_marks) : decoded.internal_max !== undefined ? String(decoded.internal_max) : '');
    setFormError('');
    setShowModal(true);
  };

  // Save / Propagate Assessment Term
  const handleSaveTerm = async (e: React.FormEvent) => {
    e.preventDefault();

    const numWritten = formWrittenMax !== '' ? Number(formWrittenMax) : undefined;
    const numInternal = formInternalMax !== '' ? Number(formInternalMax) : undefined;

    // If both split fields are filled, auto-compute the total
    let numMax = Number(formMax);
    if (numWritten !== undefined && numInternal !== undefined) {
      numMax = numWritten + numInternal;
    }

    if (!formTitle.trim() || numMax <= 0) {
      setFormError('Please provide a valid title and maximum marks.');
      return;
    }
    if (numWritten !== undefined && numInternal !== undefined && (numWritten < 0 || numInternal < 0)) {
      setFormError('Written and Internal marks must be positive numbers.');
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      const cleanTitle = formTitle.trim();
      const targetGrade = selectedGrade;
      const baseSlug = cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30);
      const defaultDate = new Date().toISOString().slice(0, 10);
      const termId = editingTerm?.id || `grade_term_g${targetGrade}_${baseSlug}`;

      // Encode written/internal split into notes field as JSON
      const encodedNotes = encodeAssessmentNotes(numWritten, numInternal, formNotes);

      const termData: GradeAssessmentTerm = {
        id: termId,
        title: cleanTitle,
        assessment_date: defaultDate,
        maximum_marks: numMax,
        written_max_marks: numWritten,
        internal_max_marks: numInternal,
        notes: encodedNotes,
        grade: targetGrade,
      };

      // 1. ALWAYS SAVE DIRECTLY TO SUPABASE CLOUD MASTER STORE (achievements table)
      const { error: cloudErr } = await supabase
        .from('achievements')
        .upsert([
          {
            id: termId,
            student_id: targetGrade,
            title: '__GRADE_ASSESSMENT_TERM__',
            desc_text: JSON.stringify(termData),
            file_name: cleanTitle,
            file_url: String(numMax),
          }
        ], { onConflict: 'id' });

      if (cloudErr) {
        console.error('Supabase cloud master term save error:', cloudErr);
      }

      // If updating an existing term with a changed title or ID, clean up old record
      if (editingTerm && (editingTerm.id !== termId || editingTerm.title !== cleanTitle)) {
        await supabase
          .from('achievements')
          .delete()
          .eq('id', editingTerm.id);
      }

      // 2. If classrooms currently exist in this Grade, sync to database offline_assessments
      if (currentGradeClasses.length > 0) {
        if (editingTerm) {
          await supabase
            .from('offline_assessments')
            .update({
              title: cleanTitle,
              maximum_marks: numMax,
              notes: encodedNotes,
            })
            .in('class_id', currentGradeClasses.map(c => c.id))
            .eq('title', editingTerm.title);
        } else {
          const classRows = currentGradeClasses.map(cls => ({
            id: `offline_term_g${targetGrade}_${baseSlug}_${cls.id}`,
            class_id: cls.id,
            teacher_id: cls.teacher_id || currentUser.id,
            title: cleanTitle,
            assessment_date: defaultDate,
            maximum_marks: numMax,
            notes: encodedNotes,
          }));

          await supabase
            .from('offline_assessments')
            .upsert(classRows as never[], { onConflict: 'id' });
        }
      }

      // 3. Update localStorage cache
      const stored = getStoredGradeTerms();
      const gradeList = stored[targetGrade] || [];
      const existingIdx = gradeList.findIndex(t => (editingTerm && t.id === editingTerm.id) || t.title.toLowerCase() === cleanTitle.toLowerCase());
      if (existingIdx >= 0) {
        gradeList[existingIdx] = termData;
      } else {
        gradeList.push(termData);
      }
      stored[targetGrade] = gradeList;
      saveStoredGradeTerms(stored);

      showToast(
        editingTerm
          ? `Updated assessment term "${cleanTitle}" for Grade ${targetGrade} (saved to database).`
          : currentGradeClasses.length > 0
          ? `Created assessment term "${cleanTitle}" across all ${currentGradeClasses.length} classrooms in Grade ${targetGrade} (saved to database).`
          : `Created assessment term "${cleanTitle}" for Grade ${targetGrade} (saved to database).`,
        'success'
      );

      setShowModal(false);
      setEditingTerm(null);
      await loadAssessments();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save assessment term.');
    }
    setSaving(false);
  };

  // Delete Assessment Term across Grade
  const handleDeleteTerm = async (term: GradeAssessmentTerm) => {
    if (
      !window.confirm(
        `Are you sure you want to delete "${term.title}" for Grade ${selectedGrade}?`
      )
    ) {
      return;
    }

    setLoading(true);
    try {
      // 1. Remove from Supabase Cloud Master Store (achievements)
      await supabase
        .from('achievements')
        .delete()
        .eq('id', term.id);

      await supabase
        .from('achievements')
        .delete()
        .eq('title', '__GRADE_ASSESSMENT_TERM__')
        .eq('student_id', selectedGrade)
        .eq('file_name', term.title);

      // 2. Remove from DB offline_assessments if classes exist
      const targetClassIds = currentGradeClasses.map(c => c.id);
      if (targetClassIds.length > 0) {
        await supabase
          .from('offline_assessments')
          .delete()
          .in('class_id', targetClassIds)
          .eq('title', term.title);
      }

      // 3. Remove from local store cache
      const stored = getStoredGradeTerms();
      if (stored[selectedGrade]) {
        stored[selectedGrade] = stored[selectedGrade].filter(t => t.title.toLowerCase() !== term.title.toLowerCase() && t.id !== term.id);
        saveStoredGradeTerms(stored);
      }

      showToast(`Deleted "${term.title}" from Grade ${selectedGrade}.`, 'info');
      await loadAssessments();
    } catch (err: any) {
      showToast(err.message || 'Error deleting term.', 'error');
    }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Toast Notification */}
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

      {/* Top Banner & Grade Switcher */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-color)',
          borderRadius: 10,
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 14,
        }}
      >
        <div>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: 'var(--neutral-dark)',
              fontFamily: 'var(--font-display)',
              margin: 0,
            }}
          >
            Grade-Wise Examination Terms &amp; Assessment Setup
          </h2>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="btn-primary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            fontSize: 12.5,
            fontWeight: 600,
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          <Plus size={14} />
          <span>Add Term for Grade {selectedGrade}</span>
        </button>
      </div>

      {/* Grade Selector Tabs Strip */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <SegmentedControl
          value={selectedGrade}
          onChange={(g) => setSelectedGrade(g)}
          options={VALID_GRADES.map((g) => ({
            value: g,
            label: `Grade ${g}`,
            count: (gradeTermsMap[g] || []).length,
          }))}
          height={34}
          textTransform="none"
        />
      </div>

      {/* Grade Overview KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {/* Stat 1: Terms */}
        <div className="stat-box" style={{ padding: '12px 16px', borderRadius: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-sub" style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase' }}>
              Configured Terms (Grade {selectedGrade})
            </span>
            <Award size={15} color="#2C6E6A" />
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--neutral-dark)', marginTop: 4, fontFamily: 'var(--font-display)' }}>
            {currentGradeTerms.length}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>
            Standard examination columns for Grade {selectedGrade}
          </div>
        </div>

        {/* Stat 2: Subject Classrooms */}
        <div className="stat-box" style={{ padding: '12px 16px', borderRadius: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-sub" style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase' }}>
              Subject Classrooms (Grade {selectedGrade})
            </span>
            <BookOpen size={15} color="#2C6E6A" />
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--neutral-dark)', marginTop: 4, fontFamily: 'var(--font-display)' }}>
            {currentGradeClasses.length}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>
            Sections receiving these terms automatically
          </div>
        </div>

        {/* Stat 3: Enrolled Students */}
        <div className="stat-box" style={{ padding: '12px 16px', borderRadius: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-sub" style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase' }}>
              Total Students in Grade {selectedGrade}
            </span>
            <Users size={15} color="#2C6E6A" />
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--neutral-dark)', marginTop: 4, fontFamily: 'var(--font-display)' }}>
            {currentGradeStudents.length}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>
            Enrolled student cohort
          </div>
        </div>
      </div>

      {/* Main Table: Grade Assessment Terms */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid var(--border-color)',
          borderRadius: 10,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#FAF9F6',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Layers size={15} color="#2C6E6A" />
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--neutral-dark)' }}>
              Standard Assessment Terms for Grade {selectedGrade}
            </span>
          </div>

        </div>

        {currentGradeTerms.length === 0 ? (
          <div
            style={{
              padding: '48px 24px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: 'var(--surface-variant)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-secondary)',
              }}
            >
              <Award size={24} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--neutral-dark)' }}>
                No Assessment Terms Configured for Grade {selectedGrade}
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)', maxWidth: 420 }}>
                Define standard terms (e.g. Periodic Test 1, Half-Yearly, Term-2 Final) so all teachers in Grade {selectedGrade} can record marks.
              </p>
            </div>
            <button
              onClick={handleOpenAddModal}
              className="btn-primary"
              style={{ padding: '7px 16px', fontSize: 12, borderRadius: 6, cursor: 'pointer' }}
            >
              + Create First Term for Grade {selectedGrade}
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F8F7F4', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: '#65635E', textTransform: 'uppercase', width: 50 }}>
                    #
                  </th>
                  <th style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: '#65635E', textTransform: 'uppercase' }}>
                    Assessment Term Title
                  </th>
                  <th style={{ padding: '9px 14px', textAlign: 'center', fontSize: 10.5, fontWeight: 700, color: '#65635E', textTransform: 'uppercase', width: 160 }}>
                    Maximum Marks
                  </th>
                  <th style={{ padding: '9px 14px', textAlign: 'center', fontSize: 10.5, fontWeight: 700, color: '#65635E', textTransform: 'uppercase', width: 180 }}>
                    Applicable Classrooms
                  </th>
                  <th style={{ padding: '9px 14px', textAlign: 'right', fontSize: 10.5, fontWeight: 700, color: '#65635E', textTransform: 'uppercase', width: 140 }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {currentGradeTerms.map((term, idx) => (
                  <tr
                    key={term.id}
                    style={{
                      borderBottom: '1px solid #ECEAE5',
                      background: idx % 2 === 0 ? '#FFFFFF' : '#FAF9F6',
                    }}
                  >
                    <td style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      {idx + 1}
                    </td>

                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--neutral-dark)' }}>
                        {term.title}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {(() => {
                          const dec = decodeAssessmentNotes(term.notes);
                          const wm = term.written_max_marks ?? dec.written_max;
                          const im = term.internal_max_marks ?? dec.internal_max;
                          if (wm !== undefined && im !== undefined) {
                            return <span style={{ color: '#2D6E5D', fontWeight: 600 }}>Written /{wm} · Internal /{im}</span>;
                          }
                          return <span>Grade {selectedGrade} Master Term</span>;
                        })()}
                      </div>
                    </td>

                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          fontSize: 11.5,
                          fontWeight: 700,
                          padding: '3px 10px',
                          borderRadius: 4,
                          background: '#EAF3EF',
                          color: '#265E5A',
                          border: '1px solid #C7E4D8',
                        }}
                      >
                        {term.maximum_marks} Marks
                      </span>
                    </td>

                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 600,
                          padding: '3px 8px',
                          borderRadius: 4,
                          background: currentGradeClasses.length > 0 ? 'var(--surface-variant)' : '#EAF3EF',
                          color: currentGradeClasses.length > 0 ? 'var(--neutral-dark)' : '#265E5A',
                          border: currentGradeClasses.length > 0 ? 'none' : '1px solid #C7E4D8',
                        }}
                      >
                        {currentGradeClasses.length > 0
                          ? `${currentGradeClasses.length} ${currentGradeClasses.length === 1 ? 'Class' : 'Classes'}`
                          : '💾 Cloud Stored (0 Classes yet)'}
                      </span>
                    </td>

                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <button
                          onClick={() => handleOpenEditModal(term)}
                          style={{
                            padding: '4px 8px',
                            fontSize: 11.5,
                            fontWeight: 600,
                            border: '1px solid var(--border-color)',
                            background: '#FFFFFF',
                            borderRadius: 6,
                            cursor: 'pointer',
                            color: 'var(--neutral-dark)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                          title="Edit Assessment Details"
                        >
                          <Edit2 size={11} />
                          <span>Edit</span>
                        </button>

                        <button
                          onClick={() => handleDeleteTerm(term)}
                          style={{
                            padding: '4px 8px',
                            fontSize: 11.5,
                            fontWeight: 600,
                            border: '1px solid #F5C6CB',
                            background: '#FDF1F0',
                            borderRadius: 6,
                            cursor: 'pointer',
                            color: '#D9534F',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                          title="Delete Term from Grade"
                        >
                          <Trash2 size={11} />
                          <span>Delete</span>
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

      {/* Grade Subject Classrooms Quick Inspection Panel */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-color)',
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#FAF9F6',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileSpreadsheet size={15} color="#2C6E6A" />
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--neutral-dark)' }}>
              Subject Classrooms in Grade {selectedGrade} ({currentGradeClasses.length})
            </span>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            Admin Marks Register Inspection
          </span>
        </div>

        {currentGradeClasses.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>
            No subject classrooms found for Grade {selectedGrade}. Create classes in the &quot;Classes &amp; Sections&quot; tab.
          </div>
        ) : (
          <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
            {currentGradeClasses.map(cls => {
              const enrolled = (cls.enrolled_student_ids || []).length;
              return (
                <div
                  key={cls.id}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: 4,
                          background: '#EAF3EF',
                          color: '#265E5A',
                          border: '1px solid #C7E4D8',
                          textTransform: 'uppercase',
                        }}
                      >
                        {cls.subject || 'Class'}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        {enrolled} {enrolled === 1 ? 'student' : 'students'}
                      </span>
                    </div>

                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--neutral-dark)', marginTop: 6 }}>
                      {cls.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      Teacher: {cls.teacher_name || 'Assigned Staff'} {cls.room ? `| ${cls.room}` : ''}
                    </div>
                  </div>

                  <button
                    onClick={() => onOpenMarkRegister(cls)}
                    className="btn-secondary"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '6px 12px',
                      fontSize: 11.5,
                      borderRadius: 6,
                      cursor: 'pointer',
                    }}
                  >
                    <span>Inspect Marks Register</span>
                    <ArrowRight size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CREATE / EDIT ASSESSMENT TERM MODAL */}
      {showModal && (
        <div className="modal-overlay active" onClick={() => setShowModal(false)}>
          <div
            className="modal-content"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="modal-header">
              <div>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: '#2C6E6A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Grade {selectedGrade} Exam Setup
                </span>
                <h2 className="modal-title" style={{ margin: '2px 0 0', fontSize: 17 }}>
                  {editingTerm ? `Edit Term: ${editingTerm.title}` : `Add New Assessment Term (Grade ${selectedGrade})`}
                </h2>
              </div>
              <button type="button" className="close-modal" onClick={() => setShowModal(false)}>
                &times;
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveTerm} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label className="form-label">Assessment Title *</label>
                <input
                  required
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="e.g. PT-1, Half-Yearly Examination, Unit Test"
                  className="form-input"
                  style={{ padding: '8px 12px', fontSize: 13 }}
                />

                {/* Preset Chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                  {PRESET_ASSESSMENTS.slice(0, 5).map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setFormTitle(preset.split(' (')[0])}
                      style={{
                        fontSize: 10.5,
                        padding: '2px 7px',
                        borderRadius: 4,
                        background: 'var(--surface-variant)',
                        color: 'var(--neutral-dark)',
                        border: '1px solid var(--border-color)',
                        cursor: 'pointer',
                      }}
                    >
                      + {preset.split(' (')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Written + Internal Split Section */}
              <div style={{ background: '#F8FAF9', border: '1px solid #D1EAE0', borderRadius: 8, padding: '14px 16px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#2D6E5D', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Mark Weightage Split (Optional)
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 12 }}>
                  Set a Written Exam and Internal/CA component split. Leave blank to use a single total marks field.
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label className="form-label" style={{ fontSize: 11 }}>Written Exam (Max Marks)</label>
                    <input
                      type="number"
                      min={0}
                      value={formWrittenMax}
                      onChange={e => {
                        setFormWrittenMax(e.target.value);
                        const w = Number(e.target.value);
                        const i = Number(formInternalMax);
                        if (e.target.value !== '' && formInternalMax !== '') {
                          setFormMax(String(w + i));
                        }
                      }}
                      placeholder="e.g. 35"
                      className="form-input"
                      style={{ padding: '7px 10px', fontSize: 13 }}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: 11 }}>Internal / CA (Max Marks)</label>
                    <input
                      type="number"
                      min={0}
                      value={formInternalMax}
                      onChange={e => {
                        setFormInternalMax(e.target.value);
                        const w = Number(formWrittenMax);
                        const i = Number(e.target.value);
                        if (formWrittenMax !== '' && e.target.value !== '') {
                          setFormMax(String(w + i));
                        }
                      }}
                      placeholder="e.g. 5"
                      className="form-input"
                      style={{ padding: '7px 10px', fontSize: 13 }}
                    />
                  </div>
                </div>
                {formWrittenMax !== '' && formInternalMax !== '' && (
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#2D6E5D', padding: '5px 10px', background: '#EAF3EF', borderRadius: 5, display: 'inline-block' }}>
                    Total = {Number(formWrittenMax) + Number(formInternalMax)} Marks
                  </div>
                )}
              </div>

              <div>
                <label className="form-label">Total Maximum Marks *
                  {formWrittenMax !== '' && formInternalMax !== '' && (
                    <span style={{ fontSize: 10.5, color: 'var(--text-secondary)', fontWeight: 400, marginLeft: 6 }}>(auto-computed from split above)</span>
                  )}
                </label>
                <input
                  required
                  type="number"
                  min={1}
                  value={formMax}
                  onChange={e => {
                    setFormMax(e.target.value);
                    // If user edits total manually, clear the split
                    if (formWrittenMax !== '' || formInternalMax !== '') {
                      setFormWrittenMax('');
                      setFormInternalMax('');
                    }
                  }}
                  placeholder="e.g. 40, 50, 80, 100"
                  className="form-input"
                  style={{ padding: '8px 12px', fontSize: 13 }}
                />

                {/* Preset Marks */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                  {PRESET_MAX_MARKS.map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => { setFormMax(String(m)); setFormWrittenMax(''); setFormInternalMax(''); }}
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '3px 10px',
                        borderRadius: 6,
                        background: formMax === String(m) ? 'var(--neutral-dark)' : 'var(--surface-variant)',
                        color: formMax === String(m) ? '#FFFFFF' : 'var(--neutral-dark)',
                        border: '1px solid var(--border-color)',
                        cursor: 'pointer',
                      }}
                    >
                      {m} Marks
                    </button>
                  ))}
                </div>
              </div>

              <div
                style={{
                  fontSize: 11.5,
                  color: '#265E5A',
                  background: '#EAF3EF',
                  border: '1px solid #C7E4D8',
                  padding: '8px 12px',
                  borderRadius: 6,
                }}
              >
                {currentGradeClasses.length > 0 ? (
                  <span>
                    💾 Saved to database and applied across all <strong>{currentGradeClasses.length} classrooms</strong> in Grade {selectedGrade}.
                  </span>
                ) : (
                  <span>
                    💾 Saved directly to database for <strong>Grade {selectedGrade}</strong>. Any subject classrooms created in Grade {selectedGrade} will automatically receive this term.
                  </span>
                )}
              </div>

              {formError && (
                <div style={{ fontSize: 12, color: '#D9534F', background: '#FDF1F0', border: '1px solid #F5C6CB', padding: '6px 10px', borderRadius: 6 }}>
                  {formError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowModal(false)}
                  style={{ padding: '7px 14px', fontSize: 12, borderRadius: 6, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary"
                  style={{ padding: '7px 16px', fontSize: 12, borderRadius: 6, cursor: 'pointer' }}
                >
                  {saving ? 'Saving...' : editingTerm ? 'Save Changes' : `Create Term for Grade ${selectedGrade}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
