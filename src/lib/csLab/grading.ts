/**
 * CS Lab — auto-grading.
 * Verdict rules (per school decision):
 *  1. Output matches + code matches solution (normalized) → "passed"
 *  2. Output matches but code differs → "passed_review" (flagged for manual review)
 *  3. Output wrong / runtime error → "failed"
 * Teacher can always override manually.
 */

import { CsQuestion } from '../supabaseClient';

export interface SqlGrid {
  columns: string[];
  rows: any[][];
}

export type CsVerdict = 'passed' | 'passed_review' | 'failed';

export interface CsGradeResult {
  verdict: CsVerdict;
  outputMatches: boolean;
  codeMatches: boolean;
  detail: string;
}

/** Normalize program output: unify newlines, trim trailing spaces, drop trailing blank lines. */
export function normalizeOutput(text?: string | null): string {
  if (!text) return '';
  return String(text)
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+$/g, ''))
    .join('\n')
    .replace(/\n+$/, '');
}

/** Normalize code for comparison: strip comments, collapse whitespace. */
export function normalizeCode(code?: string | null): string {
  if (!code) return '';
  let c = String(code);

  // Strip Python-style comments (careful not to eat strings — approximation is fine here).
  c = c.replace(/#[^\n"']*$/gm, '');
  // Strip SQL line comments.
  c = c.replace(/--[^\n]*$/gm, '');
  // Strip block comments (SQL + Python docstrings approximation).
  c = c.replace(/\/\*[\s\S]*?\*\//g, '');

  return c
    .toLowerCase()
    .replace(/\s+/g, ' ')
    // Ignore spacing around punctuation so "x , y" matches "x, y",
    // "range (10)" matches "range(10)", etc. Word-internal spaces stay.
    .replace(/\s*([,();:=<>+*/%])\s*/g, '$1')
    .replace(/\s+-\s+/g, '-')
    .trim();
}

/** Numeric-aware cell equality for SQL result grids. */
function cellEquals(a: any, b: any): boolean {
  if (a === null || a === undefined) a = null;
  if (b === null || b === undefined) b = null;
  if (a === b) return true;
  const na = typeof a === 'number' ? a : parseFloat(String(a));
  const nb = typeof b === 'number' ? b : parseFloat(String(b));
  if (!isNaN(na) && !isNaN(nb) && String(a).trim() !== '' && String(b).trim() !== '') {
    return Math.abs(na - nb) < 1e-9;
  }
  return String(a) === String(b);
}

/** Compare two SQL result grids with numeric tolerance and case-insensitive headers. */
export function sqlGridsEqual(a: SqlGrid | null, b: SqlGrid | null): boolean {
  if (!a || !b) return false;
  if (a.columns.length !== b.columns.length) return false;
  const colsA = a.columns.map((c) => String(c).toLowerCase().trim());
  const colsB = b.columns.map((c) => String(c).toLowerCase().trim());
  for (let i = 0; i < colsA.length; i++) {
    if (colsA[i] !== colsB[i]) return false;
  }
  if (a.rows.length !== b.rows.length) return false;
  for (let r = 0; r < a.rows.length; r++) {
    const ra = a.rows[r] || [];
    const rb = b.rows[r] || [];
    if (ra.length !== rb.length) return false;
    for (let c = 0; c < ra.length; c++) {
      if (!cellEquals(ra[c], rb[c])) return false;
    }
  }
  return true;
}

/** Expected value from a question: text output for Python, grid for SQL. */
function getExpectedGrid(q: CsQuestion): SqlGrid | null {
  return q.expected_sql_result || null;
}

/**
 * Grade a student run against a question.
 * `studentGrid` should be null for Python questions.
 */
export function gradeCsAttempt(
  q: CsQuestion,
  studentOutput: string,
  studentCode: string,
  studentGrid: SqlGrid | null = null
): CsGradeResult {
  const outMatches =
    q.language === 'sql' && getExpectedGrid(q)
      ? sqlGridsEqual(getExpectedGrid(q), studentGrid)
      : normalizeOutput(q.expected_output) === normalizeOutput(studentOutput);

  const codeMatches = normalizeCode(q.solution_code) === normalizeCode(studentCode);

  let verdict: CsVerdict;
  let detail: string;

  if (outMatches && codeMatches) {
    verdict = 'passed';
    detail = 'Output and code both match the solution. Auto-graded as Completed.';
  } else if (outMatches && !codeMatches) {
    verdict = 'passed_review';
    detail = 'Output matches, but code differs from the reference solution. Flagged for teacher review.';
  } else {
    verdict = 'failed';
    detail = studentOutput
      ? 'Output does not match the expected result.'
      : 'No output produced — check for errors and run again before submitting.';
  }

  return { verdict, outputMatches: outMatches, codeMatches, detail };
}
