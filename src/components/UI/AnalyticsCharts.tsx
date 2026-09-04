import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Award,
  AlertTriangle,
  CheckCircle2,
  Clock,
  BarChart3,
  Calendar,
  Layers,
  GraduationCap,
  Users,
  Target,
  ArrowUpRight,
  ShieldCheck,
  Check,
  Star,
  ChevronRight,
  Info,
  MoreHorizontal,
  Sparkles,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import {
  ScoreBracket,
  SubjectMastery,
  AttendanceDayTrend,
  SyllabusDepartmentProgress,
  MarkComplianceSummary,
  AtRiskStudent,
  DistinctionStudent,
} from '@/lib/analyticsHelper';
import { SubjectClass, UserProfile, TestItem } from '@/lib/supabaseClient';

// ─── 1. TOP KPI SPARKLINES CARDS (FROM REFERENCE DESIGN) ────────────────────

interface KpiSparklineCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  growthText?: string;
  sparklineData?: number[]; // Array of 5 to 7 heights (0 to 100)
  isAlert?: boolean;
  onClick?: () => void;
}

export const KpiSparklineCard: React.FC<KpiSparklineCardProps> = ({
  label,
  value,
  subValue,
  growthText = '',
  sparklineData = [],
  isAlert = false,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      style={{
        background: '#FFFFFF',
        border: '1px solid #EBE9E5',
        borderRadius: 12,
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.borderColor = '#1A1A1A';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          e.currentTarget.style.borderColor = '#EBE9E5';
          e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.02)';
        }
      }}
    >
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              color: '#8C8983',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              fontFamily: 'var(--font-display)',
            }}
          >
            {label}
          </span>
          <Info size={13} style={{ color: '#A8A29E', cursor: 'pointer' }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 4 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span
              style={{
                fontSize: 24,
                fontWeight: 800,
                color: isAlert ? '#DC2626' : '#1A1A1A',
                fontFamily: 'var(--font-display)',
                letterSpacing: '-0.02em',
              }}
            >
              {value}
            </span>
            {subValue && (
              <span style={{ fontSize: 11.5, color: '#78716C', fontWeight: 500 }}>
                {subValue}
              </span>
            )}
          </div>

          {/* Micro Bar Sparkline Graphic */}
          {sparklineData && sparklineData.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 26, paddingBottom: 2 }}>
              {sparklineData.map((h, i) => {
                const isDark = i >= sparklineData.length - 3;
                return (
                  <div
                    key={i}
                    style={{
                      width: 3.5,
                      height: `${Math.max(15, h)}%`,
                      background: isAlert ? '#FCA5A5' : isDark ? '#1A1A1A' : '#E5E3DF',
                      borderRadius: 1.5,
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 8, borderTop: '1px solid #F5F4F0' }}>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: isAlert ? '#DC2626' : '#16A34A',
            display: 'flex',
            alignItems: 'center',
            gap: 3,
          }}
        >
          {growthText}
        </span>
      </div>
    </div>
  );
};

// ─── 2. MAIN MATRIX / WAFFLE-STACKED BAR CHART (REFERENCE DESIGN) ────────────

interface MatrixTrendChartProps {
  data: ScoreBracket[];
  overallAverage: number;
  totalStudents: number;
  title?: string;
  subtitle?: string;
}

export const MatrixTrendChart: React.FC<MatrixTrendChartProps> = ({
  data = [],
  overallAverage = 0,
  totalStudents = 0,
  title = 'ACADEMIC PERFORMANCE TREND',
}) => {
  const [activeGranularity, setActiveGranularity] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const hasData = overallAverage > 0 && data && data.some((b) => b.count > 0);
  const totalScoreCount = data.reduce((acc, b) => acc + b.count, 0) || 1;

  // Real columns mapped directly from score brackets (A+, A, B, C, D, F)
  const columns = data.map((b) => ({
    label: b.gradeLetter,
    subLabel: b.label,
    count: b.count,
    max: totalScoreCount,
    activeCount: b.count,
    value: `${b.percentage}%`,
    range: b.range,
    isHighlight: b.gradeLetter === 'A+' || b.gradeLetter === 'A',
  }));

  const totalBlocks = 12; // 12 stacked squares per column

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #EBE9E5',
        borderRadius: 12,
        padding: '20px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
      }}
    >
      {/* Top Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 800,
              color: '#1A1A1A',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              fontFamily: 'var(--font-display)',
            }}
          >
            {title}
          </span>
          <Info size={13} style={{ color: '#A8A29E', cursor: 'pointer' }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#78716C',
              padding: 2,
            }}
          >
            <MoreHorizontal size={16} />
          </button>
        </div>
      </div>

      {/* Sub-Header Strip with Big Total, Legend & Filter Pills */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 12, color: '#78716C', fontWeight: 600 }}>Overall Mean:</span>
          <span
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: '#1A1A1A',
              fontFamily: 'var(--font-display)',
            }}
          >
            {overallAverage > 0 ? `${overallAverage}%` : '—'}
          </span>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#D4D4D8' }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: '#78716C' }}>BENCHMARK</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#1A1A1A' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#1A1A1A' }}>CURRENT COHORT</span>
          </div>
        </div>

        {/* Granularity Switch Capsule (Weekly / Monthly / Yearly) */}
        <div
          style={{
            display: 'flex',
            background: '#F5F4F0',
            padding: 3,
            borderRadius: 7,
            border: '1px solid #EBE9E5',
          }}
        >
          {(['weekly', 'monthly', 'yearly'] as const).map((g) => (
            <button
              key={g}
              onClick={() => setActiveGranularity(g)}
              style={{
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 700,
                border: 'none',
                borderRadius: 5,
                background: activeGranularity === g ? '#FFFFFF' : 'transparent',
                color: activeGranularity === g ? '#1A1A1A' : '#78716C',
                boxShadow: activeGranularity === g ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* ── SVG & WAFFLE-MATRIX CHART CANVAS ── */}
      {!hasData ? (
        <div style={{ padding: '48px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>
            No Academic Assessment Data Recorded Yet
          </div>
          <p style={{ fontSize: 11.5, color: '#8C8983', margin: '4px 0 0' }}>
            Performance brackets and assessment trends will populate automatically once faculty record graded tests and examinations.
          </p>
        </div>
      ) : (
        <div style={{ position: 'relative', width: '100%', height: 230, display: 'flex', marginTop: 10 }}>
          {/* Left Y-Axis Scale */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              paddingRight: 10,
              paddingBottom: 22,
              fontSize: 10,
              fontWeight: 600,
              color: '#A8A29E',
              textAlign: 'right',
              width: 32,
              flexShrink: 0,
            }}
          >
            <span>100%</span>
            <span>80%</span>
            <span>60%</span>
            <span>40%</span>
            <span>20%</span>
            <span>0%</span>
          </div>

          {/* Matrix Grid Container */}
          <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
            {/* Background Dotted Gridlines */}
            <div style={{ position: 'absolute', inset: 0, bottom: 22, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none' }}>
              {[0, 1, 2, 3, 4, 5].map((line) => (
                <div
                  key={line}
                  style={{
                    width: '100%',
                    height: 1,
                    borderBottom: '1px dashed #EBEAE5',
                  }}
                />
              ))}
            </div>

            {/* Matrix Columns */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-around',
                gap: 8,
                paddingBottom: 24,
                position: 'relative',
                zIndex: 2,
              }}
            >
              {columns.map((col, idx) => {
                const isHovered = hoveredIdx === idx;
                const activeBlocks = Math.round((col.activeCount / col.max) * totalBlocks);

                return (
                  <div
                    key={col.label}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      height: '100%',
                      cursor: 'pointer',
                      position: 'relative',
                    }}
                  >
                    {/* Vertical Hover Highlight Line */}
                    {isHovered && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          bottom: 0,
                          width: 1,
                          borderLeft: '1.5px dashed #1A1A1A',
                          pointerEvents: 'none',
                          zIndex: 1,
                        }}
                      />
                    )}

                    {/* Dot on top when hovered */}
                    {isHovered && (
                      <div
                        style={{
                          position: 'absolute',
                          top: `${Math.max(0, 100 - (activeBlocks / totalBlocks) * 100)}%`,
                          transform: 'translateY(-50%)',
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: '#1A1A1A',
                          border: '2px solid #FFFFFF',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                          zIndex: 4,
                        }}
                      />
                    )}

                    {/* Stacked Waffle / Block Cubes */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column-reverse',
                        gap: 2,
                        width: '100%',
                        maxWidth: 24,
                        alignItems: 'center',
                        zIndex: 3,
                      }}
                    >
                      {Array.from({ length: totalBlocks }).map((_, blockIdx) => {
                        const isFilled = blockIdx < activeBlocks;
                        return (
                          <div
                            key={blockIdx}
                            style={{
                              width: '100%',
                              height: 7,
                              background: isFilled ? '#1A1A1A' : '#E5E3DF',
                              borderRadius: 1.5,
                              transition: 'all 0.15s ease',
                            }}
                          />
                        );
                      })}
                    </div>

                    {/* Grade Bracket Label at Bottom */}
                    <span
                      style={{
                        position: 'absolute',
                        bottom: -20,
                        fontSize: 10.5,
                        fontWeight: isHovered ? 800 : 600,
                        color: isHovered ? '#1A1A1A' : '#8C8983',
                        textTransform: 'uppercase',
                        transition: 'color 0.12s',
                      }}
                    >
                      {col.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Floating Tooltip */}
            {hoveredIdx !== null && columns[hoveredIdx] && (
              <div
                style={{
                  position: 'absolute',
                  left: `${(hoveredIdx / Math.max(1, columns.length - 1)) * 80 + 10}%`,
                  top: 20,
                  transform: 'translateX(-50%)',
                  background: '#FFFFFF',
                  border: '1px solid #E5E3DF',
                  borderRadius: 8,
                  padding: '10px 14px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                  zIndex: 10,
                  pointerEvents: 'none',
                  minWidth: 140,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: '#1A1A1A', marginBottom: 6 }}>
                  Grade {columns[hoveredIdx].label} ({columns[hoveredIdx].range})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#78716C' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#D4D4D8' }} />
                    <span>Cohort Share: <strong>{columns[hoveredIdx].value}</strong></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#1A1A1A' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#1A1A1A' }} />
                    <span>Total: <strong>{columns[hoveredIdx].count} tests</strong></span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── 3. DUAL-TONE THIN PIN/BAR BREAKDOWN CHART (REFERENCE DESIGN) ────────────

interface PinBarBreakdownChartProps {
  data: SubjectMastery[];
  targetBenchmark?: number;
}

export const PinBarBreakdownChart: React.FC<PinBarBreakdownChartProps> = ({
  data = [],
  targetBenchmark = 75,
}) => {
  const [selectedRange, setSelectedRange] = useState('All Subjects');

  const hasData = data && data.length > 0 && data.some((d) => d.totalAssessed > 0);

  const pinBars = data.map((d) => ({
    label: (d.subject || '').slice(0, 4).toUpperCase(),
    fullName: d.subject,
    score: d.averageScore,
    target: targetBenchmark,
  }));

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #EBE9E5',
        borderRadius: 12,
        padding: '20px 22px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: 14,
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
      }}
    >
      <div>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 800,
                color: '#1A1A1A',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                fontFamily: 'var(--font-display)',
              }}
            >
              SUBJECT BREAKDOWN
            </span>
            <Info size={13} style={{ color: '#A8A29E', cursor: 'pointer' }} />
          </div>

          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#78716C', padding: 2 }}>
            <MoreHorizontal size={16} />
          </button>
        </div>

        {/* Big Total & Dropdown Capsule */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: '#78716C', fontWeight: 600 }}>Mean Across Disciplines</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#1A1A1A', fontFamily: 'var(--font-display)' }}>
              {hasData
                ? `${(pinBars.reduce((a, b) => a + b.score, 0) / Math.max(1, pinBars.length)).toFixed(1)}%`
                : '—'}
            </div>
          </div>

          <div
            style={{
              padding: '5px 10px',
              borderRadius: 6,
              background: '#F5F4F0',
              border: '1px solid #EBE9E5',
              fontSize: 11,
              fontWeight: 700,
              color: '#1A1A1A',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              cursor: 'pointer',
            }}
          >
            <Calendar size={12} /> {selectedRange} ▾
          </div>
        </div>

        {/* AI Insight / Institutional Benchmark Banner Pill */}
        {hasData && (
          <div
            style={{
              background: '#FAF9F6',
              border: '1px solid #EBEAE5',
              borderRadius: 7,
              padding: '7px 10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 11,
              color: '#44403C',
              marginBottom: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={13} style={{ color: '#D97706' }} />
              <span>
                {Math.round((pinBars.filter((p) => p.score >= targetBenchmark).length / Math.max(1, pinBars.length)) * 100)}% of subjects meeting the {targetBenchmark}% target benchmark
              </span>
            </div>
            <ChevronRight size={13} style={{ color: '#A8A29E' }} />
          </div>
        )}
      </div>

      {/* Slender Dual-Tone Pin Bars Canvas */}
      {!hasData ? (
        <div style={{ padding: '28px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1A1A1A' }}>
            No Subject Performance Data Available Yet
          </div>
          <p style={{ fontSize: 11, color: '#8C8983', margin: '3px 0 0' }}>
            Subject breakdown metrics will appear once faculty enter assessment marks.
          </p>
        </div>
      ) : (
        <div style={{ position: 'relative', width: '100%', height: 120, display: 'flex', flexDirection: 'column' }}>
          {/* Background Gridlines */}
          <div style={{ position: 'absolute', inset: 0, bottom: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none' }}>
            {[0, 1, 2, 3].map((line) => (
              <div key={line} style={{ width: '100%', height: 1, borderBottom: '1px dashed #F0EFEA' }} />
            ))}
          </div>

          {/* Pin Bars */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 6, paddingBottom: 20, position: 'relative', zIndex: 2 }}>
            {pinBars.map((p) => {
              return (
                <div
                  key={p.label}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    height: '100%',
                  }}
                >
                  {/* Slender Pin Track */}
                  <div
                    style={{
                      width: 3.5,
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column-reverse',
                      borderRadius: 2,
                      overflow: 'hidden',
                    }}
                  >
                    {/* Solid bottom segment */}
                    <div
                      style={{
                        width: '100%',
                        height: `${Math.min(100, Math.max(0, p.score))}%`,
                        background: '#1A1A1A',
                      }}
                    />
                    {/* Gray top segment */}
                    <div
                      style={{
                        width: '100%',
                        height: `${Math.max(0, 100 - p.score)}%`,
                        background: '#E5E3DF',
                      }}
                    />
                  </div>

                  <span
                    style={{
                      position: 'absolute',
                      bottom: 2,
                      fontSize: 8.5,
                      fontWeight: 700,
                      color: '#8C8983',
                    }}
                  >
                    {p.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Timeline Axis Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: '#A8A29E', borderTop: '1px solid #F0EFEA', paddingTop: 4 }}>
            <span>Term 1 Baseline</span>
            <span>Mid-Term Focus</span>
            <span>Final Board Prep</span>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── 4. RECENT CLASSROOM REGISTERS & TRANSACTIONS TABLE ───────────────────────

interface RecentRegistersTableProps {
  subjectClasses?: SubjectClass[];
  profiles?: UserProfile[];
  testResults?: Record<string, any>;
  tests?: TestItem[];
  onOpenClassMarks?: (className: string) => void;
}

export const RecentRegistersTable: React.FC<RecentRegistersTableProps> = ({
  subjectClasses = [],
  profiles = [],
  testResults = {},
  tests = [],
  onOpenClassMarks,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const students = useMemo(() => profiles.filter((p) => p.role === 'student'), [profiles]);
  const teachers = useMemo(() => profiles.filter((p) => p.role === 'teacher'), [profiles]);

  const registers = useMemo(() => {
    if (!subjectClasses || subjectClasses.length === 0) {
      return [];
    }

    // Build a lookup: test_id -> TestItem for fast join
    const testMap = new Map<string, TestItem>();
    (tests || []).forEach((t) => testMap.set(t.id, t));

    return subjectClasses.map((sc, idx) => {
      const id = `#${String(idx + 1).padStart(5, '0')}`;
      const classRoom = sc.name || sc.class_name || `Class ${idx + 1}`;

      // Match teacher
      const teacherObj = teachers.find(
        (t) => t.id === sc.teacher_id || t.name === sc.teacher_name || t.assigned_class === sc.class_name
      );
      const teacher = teacherObj ? teacherObj.name : sc.teacher_name || 'Faculty Member';

      // Enrolled count: prefer enrolled_student_ids list, fall back to student grade/section matching
      let enrolledCount = (sc.enrolled_student_ids || []).length;
      if (enrolledCount === 0) {
        const cleanClassName = (sc.class_name || sc.name || '').replace(/^Grade\s*/i, '').trim();
        const m = cleanClassName.match(/^(\d+)\s*[-:]?\s*([A-Z])/i) || cleanClassName.match(/^(\d+)\s+([A-Z])/i);
        if (m) {
          const [_, g, s] = m;
          enrolledCount = students.filter((st) => {
            const cleanG = (st.grade || '').replace(/[^0-9]/g, '');
            const cleanS = (st.class_letter || '').toUpperCase().trim();
            return cleanG === g && cleanS === s.toUpperCase();
          }).length;
        } else {
          enrolledCount = students.filter((st) => (st.grade || '').toLowerCase() === cleanClassName.toLowerCase()).length;
        }
      }

      // Calculate class average from real test results:
      // Join testResult -> TestItem -> match class_name or subject against SubjectClass
      const matchingTestResults = Object.values(testResults || {}).filter((tr: any) => {
        if (!tr) return false;
        // Try matching via test_id -> TestItem -> class_name
        const testItem = testMap.get(tr.test_id);
        if (testItem) {
          if (testItem.class_name === sc.class_name || testItem.class_name === sc.name) return true;
          // Also check target_sections
          if ((testItem.target_sections || []).includes(sc.class_name)) return true;
        }
        // Also match if the student is enrolled in this class
        if (tr.student_id && (sc.enrolled_student_ids || []).includes(tr.student_id)) return true;
        return false;
      });

      let mean = '\u2014';
      let status: 'Finalized' | 'Pending' | 'In Progress' = 'Pending';

      if (matchingTestResults.length > 0) {
        const scores = matchingTestResults
          .map((tr: any) => tr.score ?? tr.marks ?? null)
          .filter((s): s is number => typeof s === 'number');
        if (scores.length > 0) {
          const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
          mean = `${avg.toFixed(1)}%`;
          status = enrolledCount > 0 && scores.length < enrolledCount ? 'In Progress' : 'Finalized';
        }
      }

      return {
        id,
        classRoom,
        teacher,
        status,
        count: enrolledCount,
        mean,
      };
    });
  }, [subjectClasses, profiles, testResults, tests, students, teachers]);


  const filteredRegisters = useMemo(() => {
    if (!searchTerm.trim()) return registers;
    const q = searchTerm.toLowerCase().trim();
    return registers.filter(
      (r) =>
        r.classRoom.toLowerCase().includes(q) ||
        r.teacher.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q)
    );
  }, [registers, searchTerm]);

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #EBE9E5',
        borderRadius: 12,
        padding: '20px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 800,
              color: '#1A1A1A',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              fontFamily: 'var(--font-display)',
            }}
          >
            RECENT MARKS REGISTERS &amp; VERIFICATIONS
          </span>
          <Info size={13} style={{ color: '#A8A29E', cursor: 'pointer' }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              height: 32,
              padding: '0 12px',
              borderRadius: 6,
              background: '#FFFFFF',
              border: '1px solid #E5E3DF',
              fontSize: 12,
              boxSizing: 'border-box',
            }}
          >
            <Search size={13} style={{ color: '#8C8983' }} />
            <input
              type="text"
              placeholder="Search registers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 12, width: 140 }}
            />
          </div>

          <button
            onClick={() => onOpenClassMarks && onOpenClassMarks('')}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: 'none',
              background: '#1A1A1A',
              color: '#FFFFFF',
              fontSize: 11.5,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            + Audit Marks
          </button>
        </div>
      </div>

      {/* Table / Empty state */}
      {filteredRegisters.length === 0 ? (
        <div style={{ padding: '36px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>
            {searchTerm.trim() ? 'No marks registers matching search' : 'No marks registers recorded yet'}
          </div>
          <p style={{ fontSize: 11.5, color: '#8C8983', margin: '4px 0 0' }}>
            {searchTerm.trim()
              ? 'Try searching by a different classroom or faculty name.'
              : 'Marks registers and student grade distributions will appear here when faculty submit verified assessments.'}
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #EBEAE5', color: '#8C8983', fontSize: 10.5, letterSpacing: '0.04em' }}>
                <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 700 }}>ID</th>
                <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 700 }}>CLASSROOM</th>
                <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 700 }}>FACULTY</th>
                <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 700 }}>STATUS</th>
                <th style={{ textAlign: 'center', padding: '8px 10px', fontWeight: 700 }}>ENROLLED</th>
                <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 700 }}>CLASS MEAN</th>
                <th style={{ textAlign: 'center', padding: '8px 10px', fontWeight: 700 }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredRegisters.map((r) => (
                <tr
                  key={r.id}
                  style={{
                    borderBottom: '1px solid #F5F4F0',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#FAF9F6')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '10px', color: '#8C8983', fontWeight: 600 }}>{r.id}</td>
                  <td style={{ padding: '10px', fontWeight: 700, color: '#1A1A1A' }}>{r.classRoom}</td>
                  <td style={{ padding: '10px', color: '#57534E' }}>{r.teacher}</td>
                  <td style={{ padding: '10px' }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 12,
                        background: r.status === 'Finalized' ? '#EAF3EF' : '#FFFBEB',
                        color: r.status === 'Finalized' ? '#16A34A' : '#D97706',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      ● {r.status}
                    </span>
                  </td>
                  <td style={{ padding: '10px', textAlign: 'center', fontWeight: 600 }}>{r.count}</td>
                  <td style={{ padding: '10px', textAlign: 'right', fontWeight: 800, color: '#1A1A1A', fontFamily: 'var(--font-display)' }}>
                    {r.mean}
                  </td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>
                    <button
                      onClick={() => onOpenClassMarks && onOpenClassMarks(r.classRoom)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#8C8983',
                      }}
                    >
                      <MoreHorizontal size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export const ScoreDistributionChart = MatrixTrendChart;
export const SubjectComparisonChart = PinBarBreakdownChart;

export const AttendanceTrendChart: React.FC<any> = ({ data, overallRate }) => {
  return (
    <MatrixTrendChart
      data={[]}
      overallAverage={overallRate || 0}
      totalStudents={0}
      title="30-DAY ATTENDANCE TREND"
    />
  );
};

export const SyllabusVelocityCard: React.FC<any> = ({ departments, overallProgress }) => {
  return (
    <PinBarBreakdownChart
      data={departments || []}
      targetBenchmark={75}
    />
  );
};

export const MarkComplianceDonut: React.FC<any> = ({ data, onOpenClassMarks }) => {
  return (
    <PinBarBreakdownChart
      data={data || []}
      targetBenchmark={75}
    />
  );
};

export const AtRiskHonorRollGrid: React.FC<any> = ({
  distinctions,
  atRisk,
  onSelectStudent,
  subjectClasses,
  profiles,
  testResults,
  tests,
  onOpenClassMarks,
}) => {
  return (
    <RecentRegistersTable
      subjectClasses={subjectClasses}
      profiles={profiles}
      testResults={testResults}
      tests={tests}
      onOpenClassMarks={onOpenClassMarks}
    />
  );
};
