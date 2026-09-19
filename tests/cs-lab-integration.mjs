let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name + ' ' + (extra || '')); }
}
// CS Lab integration test: sql.js + MySQL shim + grading pipeline
import initSqlJs from 'sql.js';
import fs from 'fs';

// Boot sql.js from the SAME vendored wasm file the browser loads
const wasmBinary = new Uint8Array(fs.readFileSync(new URL('../public/vendor/sql-wasm.wasm', import.meta.url)));
const SQL = await initSqlJs({ wasmBinary });
console.log('sql.js booted from vendored wasm (' + wasmBinary.length + ' bytes)');

console.log('\n-- Loading real shim + grading modules from src/lib/csLab --');
// Bundle the ACTUAL TypeScript modules with esbuild so the tests exercise the
// production code, not a copy.
const { execSync } = await import('child_process');
execSync('npx esbuild src/lib/csLab/sqlCompat.ts --bundle --format=esm --outfile=tests/.tmp/sqlCompat.bundle.mjs', { stdio: 'pipe' });
execSync('npx esbuild src/lib/csLab/grading.ts --bundle --format=esm --outfile=tests/.tmp/grading.bundle.mjs --external:../supabaseClient', { stdio: 'pipe' });
const shim = await import('./.tmp/sqlCompat.bundle.mjs');
const { translateMysqlToSqlite, splitSqlStatements } = shim;
check('shim module loaded with exports', typeof translateMysqlToSqlite === 'function' && typeof splitSqlStatements === 'function');
const gradingMod = await import('./.tmp/grading.bundle.mjs');
const { normalizeOutput, normalizeCode, sqlGridsEqual, gradeCsAttempt } = gradingMod;
check('grading module loaded with exports', typeof gradeCsAttempt === 'function');

function newDb(setup) {
  const db = new SQL.Database();
  if (setup) for (const st of splitSqlStatements(translateMysqlToSqlite(setup))) db.run(st);
  return db;
}
function runScript(db, code) {
  const out = []; let error = '';
  for (const raw of splitSqlStatements(translateMysqlToSqlite(code))) {
    try {
      if (/^\s*(SELECT|WITH|PRAGMA|EXPLAIN|SHOW|DESCRIBE|DESC)\b/i.test(raw)) {
        const res = db.exec(raw);
        if (res && res[0]) {
          const cols = res[0].columns, vals = res[0].values;
          out.push({ kind: 'rows', cols, vals, text: cols.join(' | ') + '\n' + vals.map(r => r.join(' | ')).join('\n') + '\n(' + vals.length + ' rows)' });
        } else out.push({ kind: 'rows', cols: [], vals: [], text: 'Empty set' });
      } else {
        db.run(raw);
        out.push({ kind: 'ok', text: 'Query OK, ' + db.getRowsModified() + ' rows affected' });
      }
    } catch (e) { error = 'ERROR: ' + e.message; break; }
  }
  return { statements: out, error };
}
function lastGrid(statements) {
  for (let i = statements.length - 1; i >= 0; i--) {
    const s = statements[i];
    if (s.kind === 'rows' && s.cols && s.cols.length) return { columns: s.cols, rows: s.vals };
  }
  return null;
}

console.log('\n-- Test 1: MySQL DDL (AUTO_INCREMENT, VARCHAR, ENGINE) --');
{
  const setup = 'CREATE TABLE students (\n id INT AUTO_INCREMENT PRIMARY KEY,\n name VARCHAR(50),\n grade INT\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;';
  const db = newDb(setup);
  const r = runScript(db, "INSERT INTO students (name, grade) VALUES ('Amit', 12), ('Priya', 11), ('Zoya', 12); SELECT * FROM students ORDER BY id;");
  check('DDL + inserts succeed', r.error === '', r.error);
  const g = lastGrid(r.statements);
  check('3 rows returned', !!g && g.rows.length === 3);
  check('auto ids 1,2,3', !!g && g.rows[0][0] === 1 && g.rows[2][0] === 3, JSON.stringify(g && g.rows));
}

console.log('\n-- Test 2: SHOW TABLES / DESCRIBE --');
{
  const db = newDb('CREATE TABLE students (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(50)); CREATE TABLE marks (id INT AUTO_INCREMENT PRIMARY KEY, student_id INT);');
  const r1 = runScript(db, 'SHOW TABLES;');
  check('SHOW TABLES works', r1.error === '' && lastGrid(r1.statements).rows.length === 2, r1.error);
  const r2 = runScript(db, 'DESCRIBE students;');
  check('DESCRIBE works', r2.error === '' && lastGrid(r2.statements).rows.length === 2, r2.error);
}

console.log('\n-- Test 3: JOIN + GROUP BY + LIMIT offset + CONCAT --');
{
  const setup = "CREATE TABLE students (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(50), grade INT);\n INSERT INTO students (name, grade) VALUES ('Amit', 12), ('Priya', 11), ('Zoya', 12);\n CREATE TABLE marks (id INT AUTO_INCREMENT PRIMARY KEY, student_id INT, subject VARCHAR(30), score INT);\n INSERT INTO marks (student_id, subject, score) VALUES (1, 'CS', 95), (1, 'Math', 88), (2, 'CS', 91), (3, 'CS', 78);";
  const db = newDb(setup);
  const r1 = runScript(db, "SELECT s.name, m.subject, m.score FROM students s INNER JOIN marks m ON m.student_id = s.id WHERE m.subject = 'CS' ORDER BY m.score DESC LIMIT 1, 2;");
  check('JOIN + LIMIT offset works', r1.error === '' && lastGrid(r1.statements).rows.length === 2, r1.error);
  check('LIMIT 1,2 skips top row', lastGrid(r1.statements).rows[0][0] === 'Priya', JSON.stringify(lastGrid(r1.statements).rows));
  const r2 = runScript(db, 'SELECT grade, COUNT(*) AS n FROM students s INNER JOIN marks m ON m.student_id = s.id GROUP BY grade ORDER BY grade;');
  check('GROUP BY works', r2.error === '' && lastGrid(r2.statements).rows.length === 2, r2.error);
  const r3 = runScript(db, "SELECT CONCAT(name, ' (Grade ', grade, ')') AS label FROM students ORDER BY id LIMIT 1;");
  check('CONCAT translates', r3.error === '' && lastGrid(r3.statements).rows[0][0] === 'Amit (Grade 12)', JSON.stringify(lastGrid(r3.statements) && lastGrid(r3.statements).rows));
}

console.log('\n-- Test 4: statement splitter keeps semicolons in strings --');
{
  const db = newDb('CREATE TABLE t (id INT, note VARCHAR(50));');
  const r = runScript(db, "INSERT INTO t VALUES (1, 'has;semicolon'); SELECT note FROM t;");
  check('semicolon in string survives', r.error === '' && lastGrid(r.statements).rows[0][0] === 'has;semicolon', r.error);
}

console.log('\n-- Test 5: snapshot isolation between runs --');
{
  const setup = 'CREATE TABLE t (id INT, v INT); INSERT INTO t VALUES (1, 10);';
  const seedDb = newDb(setup);
  const snapshot = seedDb.export();
  const db1 = new SQL.Database(snapshot);
  runScript(db1, 'INSERT INTO t VALUES (2, 20);');
  const db2 = new SQL.Database(snapshot);
  const r2 = runScript(db2, 'SELECT COUNT(*) AS n FROM t;');
  check('snapshot restore isolates runs', lastGrid(r2.statements).rows[0][0] === 1);
}

console.log('\n-- Test 6: grading verdicts on a SQL question --');
{
  const q = {
    setup_sql: 'CREATE TABLE students (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(50), grade INT); INSERT INTO students (name, grade) VALUES (\'Amit\', 12), (\'Priya\', 11), (\'Zoya\', 12);',
    solution_code: 'SELECT name FROM students WHERE grade = 12 ORDER BY name;',
    expected: null,
  };
  const tdb = newDb(q.setup_sql);
  const tres = runScript(tdb, q.solution_code);
  q.expected = lastGrid(tres.statements);
  check('expected grid captured from teacher solution', !!q.expected && q.expected.rows.length === 2);

  const gradeAttempt = (code) => {
    const db = newDb(q.setup_sql);
    const r = runScript(db, code);
    if (r.error) return { verdict: 'failed', r };
    const grid = lastGrid(r.statements);
    const res = gradeCsAttempt(
      { language: 'sql', setup_sql: q.setup_sql, solution_code: q.solution_code, expected_sql_result: q.expected },
      '', code, grid
    );
    return { verdict: res.verdict, r };
  };

  check('identical solution = passed', gradeAttempt('SELECT name FROM students WHERE grade = 12 ORDER BY name;').verdict === 'passed');
  check('same output, diff style = passed_review', gradeAttempt('SELECT name FROM students WHERE grade=12 ORDER BY name ASC;').verdict === 'passed_review');
  check('wrong filter = failed', gradeAttempt('SELECT name FROM students WHERE grade = 11;').verdict === 'failed');
  check('SQL error = failed', gradeAttempt('SELECT name FROM nope_table;').verdict === 'failed');
}

console.log('\n-- Test 7: code/output normalization --');
{
  check('trailing python comment ignored', normalizeCode("print('hello')  # greeting") === normalizeCode("print('hello')"));
  check('sql case/whitespace normalized', normalizeCode('SELECT  x ,  y\nFROM  t') === normalizeCode('select x, y from t'));
  check('spacing around punctuation ignored', normalizeCode('range ( 10 ) , x ;') === normalizeCode('range(10), x;'));
  check('sql grid comparison is case-insensitive on headers + numeric tolerant',
    sqlGridsEqual({ columns: ['NAME', 'SCORE'], rows: [['Amit', '95']] }, { columns: ['name', 'score'], rows: [['Amit', 95]] }));
  check('output normalization trims trailing newlines', normalizeOutput('hello\n\n') === 'hello');
}

console.log('\n=== RESULTS: ' + pass + ' passed, ' + fail + ' failed ===');
process.exit(fail > 0 ? 1 : 0);
