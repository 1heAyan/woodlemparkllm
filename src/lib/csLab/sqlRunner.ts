/**
 * CS Lab — SQL runner built on sql.js (SQLite compiled to WebAssembly).
 * Per-session isolated databases, MySQL-CLI-style messaging,
 * a setup seed (teacher's schema), snapshot reset, and
 * localStorage checkpointing for saved playground sessions.
 */

import { getSqlJs } from './sqlLoader';
import { translateMysqlToSqlite, splitSqlStatements, formatSqlResultTable } from './sqlCompat';

export interface SqlStatementResult {
  kind: 'rows' | 'ok';
  message: string;
  columns?: string[];
  rows?: any[][];
}

export interface SqlRunOutcome {
  statements: SqlStatementResult[];
  combinedOutput: string;
  error: string;
  failedAtIndex: number;
}

/** Run one translated statement and shape its result. */
function execOne(db: any, stmt: string): SqlStatementResult {
  const trimmed = stmt.trim();
  const isSelect = /^\s*(SELECT|WITH|PRAGMA|EXPLAIN)\b/i.test(trimmed);
  const isShowLike = /^\s*(SHOW|DESCRIBE|DESC)\b/i.test(trimmed);

  if (isSelect || isShowLike) {
    const res = db.exec(trimmed);
    if (!res || res.length === 0) {
      return { kind: 'rows', message: 'Empty set', columns: [], rows: [] };
    }
    const r0 = res[0];
    return {
      kind: 'rows',
      message: formatSqlResultTable(r0.columns, r0.values),
      columns: r0.columns,
      rows: r0.values,
    };
  }

  db.run(trimmed);
  const affected = db.getRowsModified();
  return {
    kind: 'ok',
    message: `Query OK, ${affected} row${affected === 1 ? '' : 's'} affected`,
  };
}

/** Execute a script (already translated) statement by statement. */
export function execScript(db: any, script: string): SqlRunOutcome {
  const statements: SqlStatementResult[] = [];
  let combined = '';
  let error = '';
  let failedAtIndex = -1;

  const stmts = splitSqlStatements(script);
  for (let i = 0; i < stmts.length; i++) {
    try {
      const r = execOne(db, stmts[i]);
      statements.push(r);
      combined += (combined ? '\n' : '') + r.message;
    } catch (e: any) {
      error = `ERROR ${i + 1} (${stmts[i].split(/\s+/)[0] || 'stmt'}): ${e?.message || e}`;
      failedAtIndex = i;
      break;
    }
  }
  return { statements, combinedOutput: combined, error, failedAtIndex };
}

/**
 * Snapshot-restore SQL runner. Executes setup_sql once per session,
 * then re-runs the seed from the snapshot before every execution batch.
 * Can also restore from a saved session checkpoint (playground sessions).
 */
export class SqlLabSession {
  private SQL: any = null;
  private db: any = null;
  private snapshot: Uint8Array | null = null;
  private setupSql: string;

  constructor(setupSql: string) {
    this.setupSql = setupSql || '';
  }

  async init(): Promise<void> {
    this.SQL = await getSqlJs();
    this.db = new this.SQL.Database();
    if (this.setupSql.trim()) {
      const translated = translateMysqlToSqlite(this.setupSql);
      execScript(this.db, translated);
    }
    this.snapshot = this.db.export();
  }

  /** Build a session whose initial state comes from a saved checkpoint. */
  static async fromCheckpoint(checkpointB64: string, setupSql: string = ''): Promise<SqlLabSession> {
    const session = new SqlLabSession(setupSql);
    session.SQL = await getSqlJs();
    try {
      const bin = Uint8Array.from(atob(checkpointB64), (ch) => ch.charCodeAt(0));
      session.db = new session.SQL.Database(bin);
      session.snapshot = session.db.export();
    } catch {
      // Corrupt checkpoint — start fresh.
      session.db = new session.SQL.Database();
      session.snapshot = session.db.export();
    }
    return session;
  }

  /** Current live database handle (for grading / UI grid). */
  getDatabase(): any {
    return this.db;
  }

  /**
   * Run student statements against a freshly re-seeded database.
   */
  async runScript(code: string): Promise<{ output: string; error: string; statements: SqlStatementResult[] }> {
    if (!this.SQL || !this.db) await this.init();

    // Restore snapshot so every run starts from the seeded schema.
    if (this.snapshot) {
      this.db.close();
      this.db = new this.SQL.Database(this.snapshot);
    }

    const translated = translateMysqlToSqlite(code);
    const outcome = execScript(this.db, translated);
    return {
      output: outcome.combinedOutput,
      error: outcome.error,
      statements: outcome.statements,
    };
  }

  /** Run WITHOUT resetting — used by saved playground sessions so state persists. */
  runScriptContinuous(code: string): { output: string; error: string; statements: SqlStatementResult[] } {
    if (!this.db) {
      // Synchronous fallback: session not initialised yet.
      return { output: '', error: 'Session not initialised. Click Run again.', statements: [] };
    }
    const translated = translateMysqlToSqlite(code);
    const outcome = execScript(this.db, translated);
    return {
      output: outcome.combinedOutput,
      error: outcome.error,
      statements: outcome.statements,
    };
  }

  /** Export the current database state as a base64 checkpoint. */
  exportCheckpoint(): string {
    if (!this.db) return '';
    try {
      const bytes: Uint8Array = this.db.export();
      let binary = '';
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
      }
      return btoa(binary);
    } catch {
      return '';
    }
  }

  /** Last SELECT's result set as a grid (used for grading SQL questions). */
  getLastSelectResult(statements: SqlStatementResult[]): { columns: string[]; rows: any[][] } | null {
    for (let i = statements.length - 1; i >= 0; i--) {
      const s = statements[i];
      if (s.kind === 'rows' && s.columns && s.columns.length > 0) {
        return { columns: s.columns, rows: s.rows || [] };
      }
    }
    return null;
  }

  dispose(): void {
    try {
      this.db?.close();
    } catch {}
    this.db = null;
    this.snapshot = null;
  }
}
