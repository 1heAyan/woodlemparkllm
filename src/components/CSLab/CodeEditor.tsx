'use client';

import React from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { sql } from '@codemirror/lang-sql';
import { CsLanguage } from '@/lib/supabaseClient';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: CsLanguage;
  height?: string;
  readOnly?: boolean;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  language,
  height = '320px',
  readOnly = false,
}) => {
  const extensions = React.useMemo(
    () => (language === 'python' ? [python()] : [sql()]),
    [language]
  );

  return (
    <div
      style={{
        border: '1px solid #2A2A28',
        borderRadius: 8,
        overflow: 'hidden',
        background: '#1E1E1C',
      }}
    >
      <CodeMirror
        value={value}
        height={height}
        extensions={extensions}
        onChange={(v) => onChange(v)}
        readOnly={readOnly}
        theme="dark"
        basicSetup={{
          lineNumbers: true,
          highlightActiveLine: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
        }}
      />
    </div>
  );
};
