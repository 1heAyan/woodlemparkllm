'use client';

import React, { useRef } from 'react';
import { Play, Square, RotateCcw, Database, Code2, FlaskConical } from 'lucide-react';
import { PyRunner } from '@/lib/csLab/pyRunner';
import { SqlLabSession, SqlStatementResult } from '@/lib/csLab/sqlRunner';
import { CodeEditor } from './CodeEditor';
import { LabOutputPanel } from './shared';

export interface LabPlaygroundHandle {
  pyRunnerRef: React.MutableRefObject<PyRunner | null>;
  sqlSessionRef: React.MutableRefObject<SqlLabSession | null>;
}

interface LabPlaygroundProps {
  language: 'python' | 'sql';
  code: string;
  onCodeChange: (v: string) => void;
  stdin: string;
  onStdinChange: (v: string) => void;
  sqlSetup: string;
  onSqlSetupChange: (v: string) => void;
  output: string;
  error: string;
  running: boolean;
  statusText?: string;
  onOutputChange: (v: string) => void;
  onErrorChange: (v: string) => void;
  onRunningChange: (v: boolean) => void;
  onStatements?: (s: SqlStatementResult[]) => void;
  onLanguageChange?: (lang: 'python' | 'sql') => void;
  runners: LabPlaygroundHandle;
  showSetupEditor?: boolean;
  /** 'reset' = re-seed from setup before every run (assignments). 'continuous' = state persists across runs (saved sessions). */
  sqlMode?: 'reset' | 'continuous';
  /** Change to force a fresh SQL session (e.g. when switching saved sessions). */
  sessionKey?: string;
  /** Saved DB state to restore in continuous mode. */
  initialCheckpoint?: string;
  /** Emitted after each continuous SQL run so the parent can persist state. */
  onSqlCheckpoint?: (checkpointB64: string) => void;
}

const LANG_TABS = [
  { id: 'python' as const, label: 'Python', icon: Code2 },
  { id: 'sql' as const, label: 'SQL (MySQL)', icon: Database },
];

export const LabPlayground: React.FC<LabPlaygroundProps> = ({
  language,
  code,
  onCodeChange,
  stdin,
  onStdinChange,
  sqlSetup,
  onSqlSetupChange,
  output,
  error,
  running,
  statusText,
  onOutputChange,
  onErrorChange,
  onRunningChange,
  onStatements,
  onLanguageChange,
  runners,
  showSetupEditor = true,
  sqlMode = 'reset',
  sessionKey = 'default',
  initialCheckpoint = '',
  onSqlCheckpoint,
}) => {
  const lastSetupRef = useRef<string>('');
  const lastModeRef = useRef<string>('');
  const lastKeyRef = useRef<string>('');

  const ensureSqlSession = async (setup: string): Promise<SqlLabSession> => {
    const needsRebuild =
      !runners.sqlSessionRef.current ||
      lastModeRef.current !== sqlMode ||
      lastKeyRef.current !== sessionKey ||
      (sqlMode === 'reset' && lastSetupRef.current !== setup);

    if (needsRebuild) {
      runners.sqlSessionRef.current?.dispose();
      runners.sqlSessionRef.current = null;
      let session: SqlLabSession;
      if (sqlMode === 'continuous' && initialCheckpoint) {
        session = await SqlLabSession.fromCheckpoint(initialCheckpoint, '');
      } else {
        session = new SqlLabSession(setup);
        await session.init();
      }
      runners.sqlSessionRef.current = session;
      lastSetupRef.current = setup;
      lastModeRef.current = sqlMode;
      lastKeyRef.current = sessionKey;
    }
    return runners.sqlSessionRef.current;
  };

  const handleRun = async () => {
    if (running) return;
    onRunningChange(true);
    onOutputChange('');
    onErrorChange('');
    try {
      if (language === 'python') {
        if (!runners.pyRunnerRef.current) runners.pyRunnerRef.current = new PyRunner();
        const r = await runners.pyRunnerRef.current.run(code, stdin);
        onOutputChange(r.output);
        onErrorChange(r.error);
      } else {
        const session = await ensureSqlSession(sqlSetup);
        const r = sqlMode === 'continuous'
          ? session.runScriptContinuous(code)
          : await session.runScript(code);
        onOutputChange(r.output);
        onErrorChange(r.error);
        onStatements?.(r.statements);
        if (sqlMode === 'continuous') {
          onSqlCheckpoint?.(session.exportCheckpoint());
        }
      }
    } catch (e: any) {
      onErrorChange(e?.message || String(e));
    } finally {
      onRunningChange(false);
    }
  };

  const handleStop = () => {
    if (language === 'python') {
      runners.pyRunnerRef.current?.terminate();
      onRunningChange(false);
      onErrorChange('Execution stopped.');
    } else {
      lastSetupRef.current = '';
      handleRun();
    }
  };

  const handleResetDb = async () => {
    runners.sqlSessionRef.current?.dispose();
    runners.sqlSessionRef.current = null;
    lastSetupRef.current = '';
    lastModeRef.current = '';
    lastKeyRef.current = '';
    const session = await ensureSqlSession(sqlSetup);
    if (sqlMode === 'continuous') {
      onSqlCheckpoint?.(session.exportCheckpoint());
    }
    onOutputChange('Database re-seeded. Run your statements again.');
    onErrorChange('');
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 16 }}>
      {/* Left: editor */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'inline-flex', background: '#F3F2EF', borderRadius: 8, padding: 3, gap: 2 }}>
            {LANG_TABS.map((t) => {
              const Icon = t.icon;
              const active = language === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={running}
                  onClick={() => {
                    if (t.id === language) return;
                    onOutputChange('');
                    onErrorChange('');
                    onLanguageChange?.(t.id);
                  }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 14px', borderRadius: 6, border: 'none',
                    fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    background: active ? '#1A1A1A' : 'transparent',
                    color: active ? '#FFFFFF' : '#55534E',
                  }}
                >
                  <Icon size={13} /> {t.label}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {language === 'sql' && (
              <button
                type="button"
                onClick={handleResetDb}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 7, background: '#FFFFFF', border: '1px solid var(--border-color)', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#55534E' }}
              >
                <RotateCcw size={13} /> Reset DB
              </button>
            )}
            {running && (
              <button
                type="button"
                onClick={handleStop}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 7, background: '#FDF1F0', border: '1px solid #FECACA', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: '#B91C1C' }}
              >
                <Square size={12} /> Stop
              </button>
            )}
            <button
              type="button"
              onClick={handleRun}
              disabled={running}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 18px', borderRadius: 7, background: running ? '#8C8983' : '#166534', color: '#fff', border: 'none', fontSize: 12.5, fontWeight: 700, cursor: running ? 'wait' : 'pointer' }}
            >
              <Play size={13} /> {running ? 'Running…' : 'Run'}
            </button>
          </div>
        </div>

        <CodeEditor value={code} onChange={onCodeChange} language={language} height="360px" />

        {language === 'python' && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#55534E', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Custom Input (stdin) — one value per line for input()
            </div>
            <textarea
              value={stdin}
              onChange={(e) => onStdinChange(e.target.value)}
              placeholder="Lines here are fed to input() calls"
              style={{ width: '100%', minHeight: 64, boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border-color)', fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 12, background: '#FFFFFF', color: '#1A1A1A', resize: 'vertical' }}
            />
          </div>
        )}

        {language === 'sql' && showSetupEditor && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#55534E', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Database Setup (CREATE TABLE / INSERT seed) — edit freely in the playground
            </div>
            <textarea
              value={sqlSetup}
              onChange={(e) => onSqlSetupChange(e.target.value)}
              spellCheck={false}
              style={{ width: '100%', minHeight: 90, boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border-color)', fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 12, background: '#FFFEFB', color: '#1A1A1A', resize: 'vertical' }}
            />
          </div>
        )}
      </div>

      {/* Right: output */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#55534E', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
          <FlaskConical size={12} /> Output
        </div>
        <LabOutputPanel output={output} error={error} running={running} statusText={statusText} height={300} />
        <div style={{ marginTop: 10, padding: '9px 12px', borderRadius: 8, background: '#F8F7F4', border: '1px solid #ECEAE5', fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {language === 'python'
            ? 'Python runs locally in your browser via WebAssembly. Input(), print(), loops, functions — all supported. Infinite loops are stopped automatically after 15 seconds.'
            : 'MySQL-style SQL runs on an embedded local database. SHOW TABLES, DESCRIBE, AUTO_INCREMENT and JOINs work. Use Reset DB to start over.'}
        </div>
      </div>
    </div>
  );
};
