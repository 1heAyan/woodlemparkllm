'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Check, Eye, EyeOff, FileText, Plus, X } from 'lucide-react';
import { supabase, SubjectClass, UserProfile } from '@/lib/supabaseClient';
import { CustomSelect } from '@/components/UI/CustomSelect';

type Assessment = { id: string; title: string; assessment_date: string; maximum_marks: number; notes?: string };
type Mark = { student_id: string; marks: string; teacher_note: string; is_visible_to_student: boolean };

export function MarkEntryModal({ isOpen, onClose, classRoom, teacher, profiles, inline = false }: { isOpen: boolean; onClose: () => void; classRoom: SubjectClass | null; teacher: UserProfile; profiles: UserProfile[]; inline?: boolean }) {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [title, setTitle] = useState(''); const [date, setDate] = useState(new Date().toISOString().slice(0, 10)); const [maximum, setMaximum] = useState('40'); const [notes, setNotes] = useState('');
  const [creating, setCreating] = useState(false); const [saving, setSaving] = useState(false); const [message, setMessage] = useState('');
  const students = useMemo(() => profiles.filter(p => p.role === 'student' && (classRoom?.enrolled_student_ids || []).includes(p.id)), [profiles, classRoom]);
  const selected = assessments.find(a => a.id === selectedId);

  const load = async () => {
    if (!classRoom) return;
    const { data, error } = await supabase.from('offline_assessments').select('*').eq('class_id', classRoom.id).order('assessment_date', { ascending: false });
    if (error) { setMessage('Marks register is not set up yet. Run the latest supabase_schema.sql migration, then refresh.'); return; }
    setAssessments(data || []);
    if (data?.[0]) setSelectedId(data[0].id);
  };
  useEffect(() => { if (isOpen) { setMessage(''); setCreating(false); load(); } }, [isOpen, classRoom?.id]);
  useEffect(() => { (async () => {
    if (!selectedId) return;
    const { data } = await supabase.from('offline_assessment_marks').select('*').eq('assessment_id', selectedId);
    const next: Record<string, Mark> = {};
    students.forEach(s => { const old = (data || []).find((m: any) => m.student_id === s.id); next[s.id] = { student_id: s.id, marks: old?.marks ?? '', teacher_note: old?.teacher_note ?? '', is_visible_to_student: old?.is_visible_to_student ?? false }; });
    setMarks(next);
  })(); }, [selectedId, students.length]);
  if (!isOpen || !classRoom) return null;

  const create = async (e: React.FormEvent) => {
    e.preventDefault(); setMessage('');
    if (!title.trim() || !Number(maximum)) return setMessage('Add an assessment name and valid maximum marks.');
    setSaving(true); const item = { id: `offline-assessment-${Date.now()}`, class_id: classRoom.id, teacher_id: teacher.id, title: title.trim(), assessment_date: date, maximum_marks: Number(maximum), notes: notes.trim() };
    const { error } = await supabase.from('offline_assessments').insert(item); setSaving(false);
    if (error) {
      console.error('Marks register term creation failed:', error);
      return setMessage(`Could not create term: ${error.message}`);
    }
    setAssessments(prev => [item, ...prev]); setSelectedId(item.id); setCreating(false); setTitle(''); setNotes('');
  };
  const save = async () => {
    if (!selected) return; setSaving(true); setMessage('');
    const invalid = Object.values(marks).some(m => m.marks !== '' && (Number(m.marks) < 0 || Number(m.marks) > Number(selected.maximum_marks)));
    if (invalid) { setSaving(false); return setMessage(`Marks must be between 0 and ${selected.maximum_marks}.`); }
    const rows = Object.values(marks).filter(m => m.marks !== '').map(m => ({ id: `${selected.id}_${m.student_id}`, assessment_id: selected.id, student_id: m.student_id, marks: Number(m.marks), teacher_note: m.teacher_note, is_visible_to_student: m.is_visible_to_student, updated_at: new Date().toISOString() }));
    const { error } = await supabase.from('offline_assessment_marks').upsert(rows, { onConflict: 'assessment_id,student_id' }); setSaving(false);
    if (error) {
      console.error('Marks register save failed:', error);
      setMessage(`Could not save marks: ${error.message}`);
      return;
    }
    setMessage('Marks saved. Only released results are visible to the relevant student.');
  };
  const update = (id: string, patch: Partial<Mark>) => setMarks(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  return <div className={inline ? 'marks-register-page' : 'modal-overlay marks-register-overlay'} style={{ zIndex: 1000 }}><div className={inline ? 'marks-register-inline' : 'modal-content marks-register-modal'} style={{ width: 920, maxWidth: '96vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
    <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}><div><div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#8A532B' }}><FileText size={17}/><span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Private marks register</span></div><h2 style={{ margin: '5px 0 3px', fontSize: 20 }}>{classRoom.name}</h2><p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>Enter in-school marks and release each student&apos;s result only when you are ready.</p></div><button onClick={onClose} className="icon-btn"><X size={18}/></button></div>
    <div style={{ padding: '14px 24px', background: '#FAF9F6', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 10 }}><CustomSelect value={selectedId} onChange={value => { setSelectedId(value); setCreating(false); }} placeholder="Select a term" options={assessments.map(a => ({ value: a.id, label: `${a.title} · ${new Date(a.assessment_date + 'T00:00:00').toLocaleDateString()}`, sublabel: `Out of ${a.maximum_marks}` }))} style={{ flex: 1 }} buttonStyle={{ padding: '9px 10px' }}/><button className="btn-primary" onClick={() => { setCreating(true); setSelectedId(''); }} style={{ whiteSpace: 'nowrap', display: 'flex', gap: 5, alignItems: 'center' }}><Plus size={15}/> New term</button></div>
    {creating ? <form onSubmit={create} style={{ padding: 24, display: 'grid', gridTemplateColumns: '1.4fr .8fr .55fr', gap: 12, alignItems: 'end' }}><label className="form-group"><span className="form-label">Assessment name</span><input required className="form-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Term 1 Mathematics Test"/></label><label className="form-group"><span className="form-label">Exam date</span><input required type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)}/></label><label className="form-group"><span className="form-label">Out of</span><input required min="1" type="number" className="form-input" value={maximum} onChange={e => setMaximum(e.target.value)}/></label><label className="form-group" style={{ gridColumn: '1 / -1' }}><span className="form-label">Teacher note (optional)</span><input className="form-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="For your reference only"/></label><div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="button" className="btn-secondary" onClick={() => setCreating(false)}>Cancel</button><button disabled={saving} className="btn-primary">{saving ? 'Creating…' : 'Create & enter marks'}</button></div></form> : selected ? <><div style={{ padding: '13px 24px', display: 'flex', justifyContent: 'space-between', background: '#FFF' }}><div><strong style={{ fontSize: 14 }}>{selected.title}</strong><span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-secondary)' }}>{new Date(selected.assessment_date + 'T00:00:00').toLocaleDateString()} · out of {selected.maximum_marks}</span></div><span style={{ fontSize: 11, color: '#8A532B', fontWeight: 700 }}>PRIVATE UNTIL RELEASED</span></div><div style={{ overflowY: 'auto', padding: '0 24px 18px' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}><thead><tr style={{ textAlign: 'left', color: 'var(--text-secondary)', fontSize: 11 }}><th style={{ padding: '10px 8px' }}>STUDENT</th><th>MARKS / {selected.maximum_marks}</th><th>PRIVATE NOTE</th><th>STUDENT ACCESS</th></tr></thead><tbody>{students.map(s => { const m = marks[s.id] || { marks: '', teacher_note: '', is_visible_to_student: false }; return <tr key={s.id} style={{ borderTop: '1px solid var(--border-color)' }}><td style={{ padding: '10px 8px', fontWeight: 600 }}>{s.name}<div style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-secondary)' }}>{s.admission_number || s.email}</div></td><td><input type="number" min="0" max={selected.maximum_marks} className="form-input" value={m.marks} onChange={e => update(s.id, { marks: e.target.value })} style={{ width: 92, padding: '7px 8px' }}/></td><td><input className="form-input" value={m.teacher_note} onChange={e => update(s.id, { teacher_note: e.target.value })} placeholder="Optional" style={{ padding: '7px 8px' }}/></td><td><button type="button" onClick={() => update(s.id, { is_visible_to_student: !m.is_visible_to_student })} style={{ border: 0, background: 'transparent', color: m.is_visible_to_student ? '#3D7A6E' : '#9A9690', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600 }}>{m.is_visible_to_student ? <Eye size={15}/> : <EyeOff size={15}/>} {m.is_visible_to_student ? 'Released' : 'Private'}</button></td></tr>; })}</tbody></table>{students.length === 0 && <p style={{ textAlign: 'center', padding: 30, color: 'var(--text-secondary)' }}>Enroll students in this class before entering marks.</p>}</div><div style={{ padding: '14px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: 12, color: message.includes('saved') ? '#3D7A6E' : '#A83B38' }}>{message}</span><button disabled={saving || students.length === 0} onClick={save} className="btn-primary" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Check size={15}/>{saving ? 'Saving…' : 'Save marks'}</button></div></> : <div style={{ padding: 50, textAlign: 'center', color: 'var(--text-secondary)' }}>Create an assessment to start entering marks.</div>}
  </div></div>;
}
