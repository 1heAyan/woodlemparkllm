/**
 * CS Lab — MySQL → SQLite compatibility shim.
 * Translates the common MySQL syntax used in school curricula into SQLite
 * before execution. Everything not matched passes through unchanged.
 */

export function translateMysqlToSqlite(input: string): string {
  let sql = String(input || '');

  // 0. Strip MySQL conditional comments / version directives: /*!40101 ... */
  sql = sql.replace(/\/\*!\d+[\s\S]*?\*\//g, '');

  // 1. Block-level statements that have no SQLite equivalent.
  sql = sql.replace(/^\s*(USE|CREATE\s+(DATABASE|SCHEMA)|DROP\s+(DATABASE|SCHEMA))\b[\s\S]*?;/gim, '');

  // 2. Backtick identifiers → double-quoted identifiers.
  sql = sql.replace(/`([^`]+)`/g, '"$1"');

  // 3. Strip table options after the closing paren of CREATE TABLE.
  sql = sql.replace(
    /\)\s*(ENGINE\s*=[^;]*|AUTO_INCREMENT\s*=\d+[^;]*|DEFAULT\s+CHARSET[^;]*|CHARSET\s*=[^;]*|COLLATE\s*=[^;]*)/gi,
    ')'
  );

  // 4. AUTO_INCREMENT column attribute. SQLite only accepts the exact form
  //    "INTEGER PRIMARY KEY AUTOINCREMENT", so normalize both MySQL orderings
  //    and drop any stray occurrence (a plain INTEGER PRIMARY KEY column still
  //    auto-assigns via the rowid alias).
  sql = sql.replace(/\bAUTO_INCREMENT\s+PRIMARY\s+KEY\b/gi, 'PRIMARY KEY AUTOINCREMENT');
  sql = sql.replace(/\bPRIMARY\s+KEY\s+AUTO_INCREMENT\b/gi, 'PRIMARY KEY AUTOINCREMENT');
  sql = sql.replace(/\bAUTO_INCREMENT\b/gi, '');
  sql = sql.replace(/\bUNSIGNED\b/gi, '');
  sql = sql.replace(/\bZEROFILL\b/gi, '');

  // 5. Integer types (with or without display width) → INTEGER. SQLite only
  //    auto-assigns rowid aliases when the type is exactly "INTEGER".
  sql = sql.replace(/\b(TINYINT|SMALLINT|MEDIUMINT|BIGINT)\s*\(\s*\d+\s*\)/gi, 'INTEGER');
  sql = sql.replace(/\b(TINYINT|SMALLINT|MEDIUMINT|BIGINT)\b/gi, 'INTEGER');
  sql = sql.replace(/\b(INTEGER|INT)\s*\(\s*\d+\s*\)/gi, 'INTEGER');
  sql = sql.replace(/\bINT\b/gi, 'INTEGER');

  // 6. Common MySQL types → SQLite affinity.
  sql = sql.replace(/\bVARCHAR\s*\(\s*(\d+)\s*\)/gi, 'TEXT($1)');
  sql = sql.replace(/\bCHAR\s*\(\s*(\d+)\s*\)/gi, 'TEXT($1)');
  sql = sql.replace(/\bTINYTEXT\b/gi, 'TEXT');
  sql = sql.replace(/\bMEDIUMTEXT\b/gi, 'TEXT');
  sql = sql.replace(/\bLONGTEXT\b/gi, 'TEXT');
  sql = sql.replace(/\bENUM\s*\([^)]*\)/gi, 'TEXT');
  sql = sql.replace(/\bSET\s*\([^)]*\)/gi, 'TEXT');
  sql = sql.replace(/\bDOUBLE\s+PRECISION\b/gi, 'REAL');
  sql = sql.replace(/\bDOUBLE\b/gi, 'REAL');
  sql = sql.replace(/\bFLOAT\b/gi, 'REAL');
  sql = sql.replace(/\bDATETIME\b/gi, 'TEXT');
  sql = sql.replace(/\bDATE\b/gi, 'TEXT');
  sql = sql.replace(/\bTIMESTAMP\b/gi, 'TEXT');

  // 7. INSERT IGNORE → INSERT OR IGNORE
  sql = sql.replace(/\bINSERT\s+IGNORE\b/gi, 'INSERT OR IGNORE');

  // 8. LIMIT offset, count → LIMIT count OFFSET offset
  sql = sql.replace(/\bLIMIT\s+(\d+)\s*,\s*(\d+)/gi, 'LIMIT $2 OFFSET $1');

  // 9. ON DUPLICATE KEY UPDATE has no SQLite equivalent → drop it (best effort).
  sql = sql.replace(/\bON\s+DUPLICATE\s+KEY\s+UPDATE[\s\S]*?(?=;|$)/gi, '');

  // 10. SHOW statements → SQLite catalog queries.
  if (/^\s*SHOW\s+(FULL\s+)?TABLES\b/i.test(sql)) {
    return "SELECT name AS Tables_in_database FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;";
  }
  if (/^\s*SHOW\s+(DATABASES|SCHEMAS)\b/i.test(sql)) {
    return "SELECT 'school_db' AS \"Database\";";
  }
  const describeMatch = sql.match(/^\s*(DESCRIBE|DESC)\s+["[]?(\w+)["\]]?\s*;?\s*$/i);
  if (describeMatch) {
    return `SELECT name AS \"Field\", type AS \"Type\", CASE WHEN \"notnull\"=0 THEN 'YES' ELSE 'NO' END AS \"Null\", CASE WHEN pk=1 THEN 'PRI' ELSE '' END AS \"Key\", dflt_value AS \"Default\" FROM pragma_table_info('${describeMatch[2]}');`;
  }

  // 11. CONCAT() → ||  (single-level, no nesting support)
  sql = sql.replace(/\bCONCAT\s*\(([^()]*)\)/gi, (_m, args) =>
    args
      .split(',')
      .map((a: string) => a.trim())
      .join(' || ')
  );

  // 12. IFNULL → IFNULL (SQLite has it), but IF() → CASE (simple form only)
  sql = sql.replace(/\bIF\s*\(\s*([^,]+),\s*([^,]+),\s*([^)]+)\)/gi, 'CASE WHEN $1 THEN $2 ELSE $3 END');

  return sql;
}

/** Split a script into individual statements, respecting string literals. */
export function splitSqlStatements(script: string): string[] {
  const out: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let inLineComment = false;
  let inBlockComment = false;

  const src = String(script || '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    const next = src[i + 1];

    if (inLineComment) {
      current += ch;
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      current += ch;
      if (ch === '*' && next === '/') {
        current += next;
        i++;
        inBlockComment = false;
      }
      continue;
    }
    if (!inSingle && !inDouble && !inBlockComment && ch === '-' && next === '-') {
      inLineComment = true;
      current += ch;
      continue;
    }
    if (!inSingle && !inDouble && ch === '/' && next === '*') {
      inBlockComment = true;
      current += ch;
      continue;
    }
    if (inSingle) {
      current += ch;
      if (ch === "'" && next === "'") {
        current += next;
        i++;
      } else if (ch === "'") {
        inSingle = false;
      }
      continue;
    }
    if (inDouble) {
      current += ch;
      if (ch === '"' && next === '"') {
        current += next;
        i++;
      } else if (ch === '"') {
        inDouble = false;
      }
      continue;
    }

    if (ch === "'") {
      inSingle = true;
      current += ch;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      current += ch;
      continue;
    }
    if (ch === ';') {
      out.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) out.push(current.trim());
  return out.filter((s) => s.length > 0);
}

/** Format a result set as a MySQL-CLI style table. */
export function formatSqlResultTable(columns: string[], rows: any[][]): string {
  if (!columns || columns.length === 0) return '(no columns)';
  const widths = columns.map((c) => String(c).length);
  const cell = (v: any) => (v === null || v === undefined ? 'NULL' : String(v));
  rows.forEach((r) => {
    r.forEach((v, i) => {
      if (i < widths.length) widths[i] = Math.max(widths[i], cell(v).length);
    });
  });
  const line = (l: string, m: string, r: string) =>
    l + widths.map((w) => '─'.repeat(w + 2)).join(m) + r;
  const row = (vals: any[]) =>
    '| ' + vals.map((v, i) => cell(v).padEnd(widths[i])).join(' | ') + ' |';
  const out: string[] = [];
  out.push(line('┌', '┬', '┐'));
  out.push(row(columns));
  out.push(line('├', '┼', '┤'));
  rows.forEach((r) => out.push(row(r)));
  out.push(line('└', '┴', '┘'));
  out.push(`${rows.length} row${rows.length === 1 ? '' : 's'} in set`);
  return out.join('\n');
}
