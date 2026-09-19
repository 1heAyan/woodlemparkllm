import React from 'react';
import { CsSubmission } from '@/lib/supabaseClient';

export const CS_STATUS_META: Record<
  string,
  { label: string; bg: string; color: string; border: string; dot: string }
> = {
  passed: {
    label: 'Completed ✓',
    bg: '#EAF7EF',
    color: '#166534',
    border: '#BBE7C9',
    dot: '#16A34A',
  },
  passed_review: {
    label: 'Correct — Review',
    bg: '#FEF6E7',
    color: '#92400E',
    border: '#FDE68A',
    dot: '#D97706',
  },
  failed: {
    label: 'Wrong ✗',
    bg: '#FDF1F0',
    color: '#B91C1C',
    border: '#FECACA',
    dot: '#DC2626',
  },
  draft: {
    label: 'In Progress',
    bg: '#F3F2EF',
    color: '#55534E',
    border: '#E5E3DF',
    dot: '#8C8983',
  },
  none: {
    label: 'Not Started',
    bg: '#FFFFFF',
    color: '#8C8983',
    border: '#ECEAE5',
    dot: '#C9C6C0',
  },
};

export const StatusChip: React.FC<{ status?: string; small?: boolean }> = ({ status, small }) => {
  const meta = CS_STATUS_META[status || 'none'] || CS_STATUS_META.none;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: small ? '1px 7px' : '2px 9px',
        borderRadius: 999,
        fontSize: small ? 10 : 11,
        fontWeight: 700,
        background: meta.bg,
        color: meta.color,
        border: `1px solid ${meta.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.dot }} />
      {meta.label}
    </span>
  );
};

export const LabOutputPanel: React.FC<{
  output: string;
  error: string;
  running: boolean;
  statusText?: string;
  height?: number;
}> = ({ output, error, running, statusText, height = 220 }) => (
  <div
    style={{
      background: '#141414',
      border: '1px solid #2A2A28',
      borderRadius: 8,
      padding: '12px 14px',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      fontSize: 12.5,
      lineHeight: 1.55,
      color: '#D4D4D4',
      overflow: 'auto',
      whiteSpace: 'pre-wrap',
      minHeight: height,
      maxHeight: height * 2,
    }}
  >
    {running ? (
      <span style={{ color: '#8C8983' }}>
        {statusText || 'Running…'}
        <span className="el-spin" style={{ marginLeft: 8, width: 11, height: 11, borderWidth: 2, display: 'inline-block' }} />
      </span>
    ) : (
      <>
        {output && <span style={{ color: '#D4D4D4' }}>{output}</span>}
        {output && error && '\n'}
        {error && <span style={{ color: '#F87171' }}>{error}</span>}
        {!output && !error && <span style={{ color: '#5A5854' }}>Output will appear here. Click Run to execute your code.</span>}
      </>
    )}
  </div>
);

/** Result grid used for SQL questions (student answer vs expected). */
export const SqlResultGrid: React.FC<{ columns: string[]; rows: any[][]; title?: string }> = ({
  columns,
  rows,
  title,
}) => {
  if (!columns || columns.length === 0) return null;
  return (
    <div style={{ marginBottom: 14 }}>
      {title && (
        <div style={{ fontSize: 11, fontWeight: 700, color: '#55534E', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {title}
        </div>
      )}
      <div style={{ border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'auto', maxWidth: '100%' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#F8F7F4', borderBottom: '1px solid var(--border-color)' }}>
              {columns.map((c, i) => (
                <th key={i} style={{ textAlign: 'left', padding: '7px 12px', fontSize: 10.5, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ padding: '12px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                  Empty set
                </td>
              </tr>
            ) : (
              rows.map((r, ri) => (
                <tr key={ri} style={{ borderBottom: '1px solid #ECEAE5', background: ri % 2 ? '#FAF9F7' : '#FFFFFF' }}>
                  {(r || []).map((v, ci) => (
                    <td key={ci} style={{ padding: '7px 12px', color: v === null || v === undefined ? '#B0ADA7' : 'var(--neutral-dark)' }}>
                      {v === null || v === undefined ? 'NULL' : String(v)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const countLabStats = (submissions: CsSubmission[]) => ({
  passed: submissions.filter((s) => s.status === 'passed').length,
  passedReview: submissions.filter((s) => s.status === 'passed_review').length,
  failed: submissions.filter((s) => s.status === 'failed').length,
  inProgress: submissions.filter((s) => s.status === 'draft').length,
});
